import { Router } from "express";
import { eq, or } from "drizzle-orm";
import { db, anomaliesTable, stocksTable, activityTable } from "@workspace/db";
import {
  ListAnomaliesResponse,
  DismissAnomalyParams,
  DismissAnomalyResponse,
} from "@workspace/api-zod";

const router = Router();

function serializeAnomaly(anomaly: typeof anomaliesTable.$inferSelect, stock: typeof stocksTable.$inferSelect | null) {
  return {
    id: anomaly.id,
    stockId: anomaly.stockId,
    stockCode: stock?.stockCode ?? "N/A",
    stockName: stock?.stockName ?? "Unknown",
    type: anomaly.type,
    severity: anomaly.severity,
    description: anomaly.description,
    explanation: anomaly.explanation ?? null,
    detectedAt: anomaly.detectedAt.toISOString(),
    dismissed: anomaly.dismissed,
    status: anomaly.status ?? "active",
    acknowledgedBy: anomaly.acknowledgedBy ?? null,
    acknowledgedAt: anomaly.acknowledgedAt?.toISOString() ?? null,
    resolvedBy: anomaly.resolvedBy ?? null,
    resolvedAt: anomaly.resolvedAt?.toISOString() ?? null,
    resolutionNotes: anomaly.resolutionNotes ?? null,
  };
}

router.get("/anomalies", async (req, res): Promise<void> => {
  const showAll = req.query.all === "true";
  const statusFilter = req.query.status as string | undefined;

  let rows;
  if (showAll) {
    rows = await db.select().from(anomaliesTable).orderBy(anomaliesTable.detectedAt);
  } else if (statusFilter) {
    rows = await db.select().from(anomaliesTable).where(eq(anomaliesTable.status, statusFilter)).orderBy(anomaliesTable.detectedAt);
  } else {
    rows = await db.select().from(anomaliesTable).where(eq(anomaliesTable.dismissed, false)).orderBy(anomaliesTable.detectedAt);
  }

  const enriched = await Promise.all(
    rows.map(async (a) => {
      const [stock] = await db.select().from(stocksTable).where(eq(stocksTable.id, a.stockId));
      return serializeAnomaly(a, stock ?? null);
    }),
  );
  res.json(ListAnomaliesResponse.parse(enriched));
});

router.post("/anomalies/:id/dismiss", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = DismissAnomalyParams.safeParse({ id: Number(raw) });
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const [anomaly] = await db.update(anomaliesTable)
    .set({ dismissed: true, status: "resolved" })
    .where(eq(anomaliesTable.id, params.data.id)).returning();
  if (!anomaly) { res.status(404).json({ error: "Anomaly not found" }); return; }

  const [stock] = await db.select().from(stocksTable).where(eq(stocksTable.id, anomaly.stockId));
  await db.insert(activityTable).values({
    type: "anomaly_dismissed",
    description: `Anomaly dismissed: ${anomaly.description.substring(0, 60)}`,
    actor: "Manager",
    stockCode: stock?.stockCode,
  });

  res.json(DismissAnomalyResponse.parse(serializeAnomaly(anomaly, stock ?? null)));
});

router.post("/anomalies/:id/acknowledge", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = Number(raw);
  const { acknowledgedBy } = req.body;

  const [anomaly] = await db.update(anomaliesTable)
    .set({
      status: "acknowledged",
      acknowledgedBy: acknowledgedBy ?? "Manager",
      acknowledgedAt: new Date(),
    })
    .where(eq(anomaliesTable.id, id)).returning();
  if (!anomaly) { res.status(404).json({ error: "Anomaly not found" }); return; }

  const [stock] = await db.select().from(stocksTable).where(eq(stocksTable.id, anomaly.stockId));
  await db.insert(activityTable).values({
    type: "anomaly_acknowledged",
    description: `Anomaly acknowledged: ${anomaly.description.substring(0, 60)}`,
    actor: acknowledgedBy ?? "Manager",
    stockCode: stock?.stockCode,
  });

  res.json(serializeAnomaly(anomaly, stock ?? null));
});

router.post("/anomalies/:id/resolve", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = Number(raw);
  const { notes, resolvedBy } = req.body;
  if (!notes || notes.length < 10) {
    res.status(400).json({ error: "Resolution notes must be at least 10 characters" });
    return;
  }

  const [anomaly] = await db.update(anomaliesTable)
    .set({
      dismissed: true,
      status: "resolved",
      resolvedBy: resolvedBy ?? "Manager",
      resolvedAt: new Date(),
      resolutionNotes: notes,
    })
    .where(eq(anomaliesTable.id, id)).returning();
  if (!anomaly) { res.status(404).json({ error: "Anomaly not found" }); return; }

  const [stock] = await db.select().from(stocksTable).where(eq(stocksTable.id, anomaly.stockId));
  await db.insert(activityTable).values({
    type: "anomaly_resolved",
    description: `Anomaly resolved: ${anomaly.description.substring(0, 60)} — ${notes.substring(0, 50)}`,
    actor: resolvedBy ?? "Manager",
    stockCode: stock?.stockCode,
  });

  res.json(serializeAnomaly(anomaly, stock ?? null));
});

export default router;
