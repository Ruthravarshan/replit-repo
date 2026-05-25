import { Router } from "express";
import { eq, isNull, and } from "drizzle-orm";
import { db, stocksTable, distributionsTable, approvalsTable, anomaliesTable, activityTable } from "@workspace/db";
import {
  GetDashboardSummaryResponse,
  GetRecentActivityResponse,
  GetStockHealthScoresResponse,
} from "@workspace/api-zod";

const router = Router();

router.get("/dashboard/summary", async (req, res): Promise<void> => {
  const stocks = await db.select().from(stocksTable).where(isNull(stocksTable.deletedAt));
  const pendingApprovals = await db.select().from(approvalsTable).where(eq(approvalsTable.status, "pending"));
  const anomalies = await db.select().from(anomaliesTable).where(eq(anomaliesTable.dismissed, false));
  const allDistributions = await db.select().from(distributionsTable);

  const healthyCount = stocks.filter((s) => (s.healthScore ?? 0) >= 70).length;
  const warningCount = stocks.filter((s) => { const h = s.healthScore ?? 0; return h >= 40 && h < 70; }).length;
  const criticalCount = stocks.filter((s) => (s.healthScore ?? 0) < 40).length;
  const totalAvailableUnits = stocks.reduce((sum, s) => sum + s.availableQuantity, 0);

  const summary = {
    totalStockItems: stocks.length,
    totalAvailableUnits,
    pendingApprovals: pendingApprovals.length,
    anomalyCount: anomalies.length,
    healthyCount,
    warningCount,
    criticalCount,
    totalDistributions: allDistributions.length,
    automationPercentage: 73.5,
  };

  res.json(GetDashboardSummaryResponse.parse(summary));
});

router.get("/dashboard/activity", async (req, res): Promise<void> => {
  const rows = await db.select().from(activityTable).orderBy(activityTable.timestamp).limit(20);
  const activity = rows.reverse().map((r) => ({
    id: r.id,
    type: r.type,
    description: r.description,
    timestamp: r.timestamp.toISOString(),
    actor: r.actor ?? null,
    stockCode: r.stockCode ?? null,
  }));
  res.json(GetRecentActivityResponse.parse(activity));
});

router.get("/activity", async (req, res): Promise<void> => {
  const limitRaw = req.query.limit ? Number(req.query.limit) : 200;
  const type = typeof req.query.type === "string" ? req.query.type : undefined;
  const actor = typeof req.query.actor === "string" ? req.query.actor : undefined;

  let rows = await db.select().from(activityTable).orderBy(activityTable.timestamp);
  if (type) rows = rows.filter((r) => r.type === type);
  if (actor) rows = rows.filter((r) => r.actor === actor);
  rows = rows.slice(-limitRaw).reverse();

  const activity = rows.map((r) => ({
    id: r.id,
    type: r.type,
    description: r.description,
    timestamp: r.timestamp.toISOString(),
    actor: r.actor ?? null,
    stockCode: r.stockCode ?? null,
  }));
  res.json(activity);
});

router.get("/dashboard/health-scores", async (req, res): Promise<void> => {
  const stocks = await db.select().from(stocksTable).where(isNull(stocksTable.deletedAt));
  const scores = stocks.map((s) => {
    const h = s.healthScore ?? 50;
    return {
      stockId: s.id,
      stockCode: s.stockCode,
      stockName: s.stockName,
      healthScore: h,
      healthStatus: h >= 70 ? "Healthy" : h >= 40 ? "Warning" : "Critical",
      availableQuantity: s.availableQuantity,
      category: s.category,
      location: s.location ?? null,
    };
  });
  res.json(GetStockHealthScoresResponse.parse(scores));
});

export default router;
