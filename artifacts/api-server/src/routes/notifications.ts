import { Router } from "express";
import { db, activityTable } from "@workspace/db";

const router = Router();

// Derive notifications from activity — most recent 50 events
router.get("/notifications", async (req, res): Promise<void> => {
  const rows = await db.select().from(activityTable).orderBy(activityTable.timestamp);
  const recent = rows.slice(-50).reverse();

  const notifications = recent.map((r) => ({
    id: r.id,
    type: r.type,
    title: formatTitle(r.type),
    description: r.description,
    actor: r.actor ?? null,
    stockCode: r.stockCode ?? null,
    timestamp: r.timestamp.toISOString(),
    link: linkFromType(r.type),
  }));

  res.json(notifications);
});

router.post("/notifications/read-all", async (_req, res): Promise<void> => {
  res.json({ ok: true });
});

function formatTitle(type: string): string {
  switch (type) {
    case "distribution_created": return "New Distribution Draft";
    case "distribution_submitted": return "Distribution Submitted for Approval";
    case "distribution_approved": return "Distribution Approved";
    case "distribution_rejected": return "Distribution Rejected";
    case "anomaly_detected": return "Anomaly Detected";
    case "anomaly_resolved": return "Anomaly Resolved";
    case "stock_created": return "New Stock Item Added";
    default: return type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  }
}

function linkFromType(type: string): string {
  if (type.includes("distribution")) return "/distributions";
  if (type.includes("anomaly")) return "/";
  if (type.includes("stock")) return "/stocks";
  return "/";
}

export default router;
