import { Router } from "express";
import { db, stocksTable, distributionsTable, approvalsTable, anomaliesTable, activityTable } from "@workspace/db";
import { eq, isNull, desc } from "drizzle-orm";

const router = Router();

// In-memory config (reset on restart — fine for demo)
let systemConfig = {
  l2EscalationThreshold: 50,
  slaHours: 48,
  anomalySensitivity: "medium" as "low" | "medium" | "high",
  aiEnabled: true,
  emailNotifications: true,
  autoApproveThreshold: 0,
};

// Mocked users
const MOCK_USERS = [
  { id: 1, name: "System Admin", email: "admin@hexaware.com", role: "admin", department: "IT Operations", location: "Mumbai", status: "active", lastLogin: "2026-05-21T10:00:00Z" },
  { id: 2, name: "Priya Sharma", email: "priya.sharma@hexaware.com", role: "executive", department: "Supply Chain", location: "Chennai", status: "active", lastLogin: "2026-05-21T09:15:00Z" },
  { id: 3, name: "Rahul Mehta", email: "rahul.mehta@hexaware.com", role: "manager", department: "Finance", location: "Mumbai", status: "active", lastLogin: "2026-05-21T08:45:00Z" },
  { id: 4, name: "Anjali Nair", email: "anjali.nair@hexaware.com", role: "executive", department: "Engineering", location: "Bangalore", status: "active", lastLogin: "2026-05-20T17:30:00Z" },
  { id: 5, name: "Vikram Singh", email: "vikram.singh@hexaware.com", role: "manager", department: "Operations", location: "Pune", status: "inactive", lastLogin: "2026-05-15T11:00:00Z" },
];

let userList = [...MOCK_USERS];
let nextUserId = 6;

router.get("/admin/system-health", async (_req, res): Promise<void> => {
  const startTime = Date.now();

  // DB health check
  let dbStatus = "healthy";
  let dbLatency = 0;
  try {
    const t = Date.now();
    await db.select().from(stocksTable).limit(1);
    dbLatency = Date.now() - t;
  } catch {
    dbStatus = "degraded";
  }

  const apiLatency = Date.now() - startTime;

  const [stocks, distributions, approvals, anomalies, activity] = await Promise.all([
    db.select().from(stocksTable).where(isNull(stocksTable.deletedAt)),
    db.select().from(distributionsTable),
    db.select().from(approvalsTable),
    db.select().from(anomaliesTable).where(eq(anomaliesTable.dismissed, false)),
    db.select().from(activityTable).orderBy(desc(activityTable.timestamp)).limit(10),
  ]);

  const bottlenecks = distributions.filter((d) => {
    if (d.status !== "submitted" || !d.submittedAt) return false;
    const hoursSince = (Date.now() - new Date(d.submittedAt).getTime()) / 3600000;
    return hoursSince > systemConfig.slaHours;
  });

  const statusCounts = {
    draft: distributions.filter((d) => d.status === "draft").length,
    submitted: distributions.filter((d) => d.status === "submitted").length,
    approved: distributions.filter((d) => d.status === "approved").length,
    rejected: distributions.filter((d) => d.status === "rejected").length,
  };

  // Top distributed items
  const distByStock: Record<number, number> = {};
  distributions.filter((d) => d.status === "approved").forEach((d) => {
    distByStock[d.stockId] = (distByStock[d.stockId] ?? 0) + d.quantityDistributed;
  });
  const topStockIds = Object.entries(distByStock)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([id]) => Number(id));
  const topItems = await Promise.all(
    topStockIds.map(async (stockId) => {
      const [s] = await db.select().from(stocksTable).where(eq(stocksTable.id, stockId));
      return { stockId, stockName: s?.stockName ?? "Unknown", stockCode: s?.stockCode ?? "", distributed: distByStock[stockId] };
    })
  );

  res.json({
    services: {
      api: { status: "healthy", latency: apiLatency },
      database: { status: dbStatus, latency: dbLatency },
      aiEngine: { status: "healthy", latency: 0 },
      storage: { status: "healthy", latency: 0 },
    },
    stats: {
      totalStocks: stocks.length,
      totalDistributions: distributions.length,
      totalApprovals: approvals.length,
      activeAnomalies: anomalies.length,
      activeUsers: userList.filter((u) => u.status === "active").length,
      bottlenecks: bottlenecks.length,
    },
    distributionStatusCounts: statusCounts,
    topDistributedItems: topItems,
    anomalySummary: {
      critical: anomalies.filter((a) => a.severity === "critical").length,
      high: anomalies.filter((a) => a.severity === "high").length,
      medium: anomalies.filter((a) => a.severity === "medium").length,
      low: anomalies.filter((a) => a.severity === "low").length,
    },
    recentActivity: activity.map((a) => ({ ...a, timestamp: a.timestamp.toISOString(), createdAt: a.createdAt.toISOString() })),
    config: systemConfig,
    approvalBottlenecks: bottlenecks.map((d) => ({
      id: d.id, stockId: d.stockId, recipient: d.recipient, submittedAt: d.submittedAt?.toISOString(), hoursElapsed: Math.round((Date.now() - new Date(d.submittedAt!).getTime()) / 3600000),
    })),
  });
});

router.get("/admin/users", (_req, res) => {
  res.json(userList);
});

router.post("/admin/users", (req, res) => {
  const { name, email, role, department, location } = req.body;
  if (!name || !email || !role) {
    res.status(400).json({ error: "Name, email, and role are required" });
    return;
  }
  const newUser = { id: nextUserId++, name, email, role, department: department ?? "", location: location ?? "", status: "active" as const, lastLogin: new Date().toISOString() };
  userList.push(newUser);
  res.status(201).json(newUser);
});

router.patch("/admin/users/:id/deactivate", (req, res) => {
  const id = Number(req.params.id);
  const user = userList.find((u) => u.id === id);
  if (!user) { res.status(404).json({ error: "User not found" }); return; }
  user.status = "inactive";
  res.json(user);
});

router.patch("/admin/users/:id/activate", (req, res) => {
  const id = Number(req.params.id);
  const user = userList.find((u) => u.id === id);
  if (!user) { res.status(404).json({ error: "User not found" }); return; }
  user.status = "active";
  res.json(user);
});

router.get("/admin/config", (_req, res) => {
  res.json(systemConfig);
});

router.patch("/admin/config", (req, res) => {
  systemConfig = { ...systemConfig, ...req.body };
  res.json(systemConfig);
});

// Master data lookups (in-memory for demo)
let categories = ["IT Equipment", "Office Supplies", "Health & Safety", "Furniture", "Electronics", "Stationery", "Networking"];
let unitsOfMeasure = ["Units", "Pcs", "Reams", "Bottles", "Kits", "Packs", "Boxes", "Sets"];

router.get("/admin/categories", (_req, res) => res.json(categories));
router.post("/admin/categories", (req, res) => {
  const { name } = req.body;
  if (!name) { res.status(400).json({ error: "Name required" }); return; }
  if (!categories.includes(name)) categories.push(name);
  res.json(categories);
});
router.delete("/admin/categories/:name", (req, res) => {
  categories = categories.filter((c) => c !== req.params.name);
  res.json(categories);
});

router.get("/admin/uom", (_req, res) => res.json(unitsOfMeasure));
router.post("/admin/uom", (req, res) => {
  const { name } = req.body;
  if (!name) { res.status(400).json({ error: "Name required" }); return; }
  if (!unitsOfMeasure.includes(name)) unitsOfMeasure.push(name);
  res.json(unitsOfMeasure);
});

export default router;
