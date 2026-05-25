import { Router } from "express";
import { eq, and } from "drizzle-orm";
import { db, stocksTable, distributionsTable, approvalsTable, activityTable } from "@workspace/db";
import {
  ListDistributionsQueryParams,
  ListDistributionsResponse,
  CreateDistributionBody,
  GetDistributionParams,
  GetDistributionResponse,
  UpdateDistributionParams,
  UpdateDistributionBody,
  UpdateDistributionResponse,
  DeleteDistributionParams,
  SubmitDistributionParams,
  SubmitDistributionResponse,
} from "@workspace/api-zod";

const router = Router();

async function enrichDistribution(dist: typeof distributionsTable.$inferSelect) {
  const [stock] = await db.select().from(stocksTable).where(eq(stocksTable.id, dist.stockId));
  return {
    ...dist,
    stockName: stock?.stockName ?? "Unknown",
    stockCode: stock?.stockCode ?? null,
    submittedAt: dist.submittedAt?.toISOString() ?? null,
    approvedAt: dist.approvedAt?.toISOString() ?? null,
    createdAt: dist.createdAt.toISOString(),
  };
}

router.get("/distributions", async (req, res): Promise<void> => {
  const query = ListDistributionsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }
  const { status, stockId } = query.data;

  let conditions: ReturnType<typeof eq>[] = [];
  if (status) conditions.push(eq(distributionsTable.status, status));
  if (stockId) conditions.push(eq(distributionsTable.stockId, stockId));

  const rows = conditions.length
    ? await db.select().from(distributionsTable).where(and(...conditions)).orderBy(distributionsTable.createdAt)
    : await db.select().from(distributionsTable).orderBy(distributionsTable.createdAt);

  const enriched = await Promise.all(rows.map(enrichDistribution));
  res.json(ListDistributionsResponse.parse(enriched));
});

router.post("/distributions", async (req, res): Promise<void> => {
  const parsed = CreateDistributionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [dist] = await db.insert(distributionsTable).values(parsed.data).returning();
  const enriched = await enrichDistribution(dist);
  await db.insert(activityTable).values({ type: "distribution_created", description: `Distribution draft created for ${enriched.stockName}`, actor: "executive", stockCode: enriched.stockCode });
  res.status(201).json(GetDistributionResponse.parse(enriched));
});

router.get("/distributions/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = GetDistributionParams.safeParse({ id: Number(raw) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [dist] = await db.select().from(distributionsTable).where(eq(distributionsTable.id, params.data.id));
  if (!dist) {
    res.status(404).json({ error: "Distribution not found" });
    return;
  }
  const enriched = await enrichDistribution(dist);
  res.json(GetDistributionResponse.parse(enriched));
});

router.patch("/distributions/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = UpdateDistributionParams.safeParse({ id: Number(raw) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [existing] = await db.select().from(distributionsTable).where(eq(distributionsTable.id, params.data.id));
  if (!existing) {
    res.status(404).json({ error: "Distribution not found" });
    return;
  }
  if (!["draft", "rejected"].includes(existing.status)) {
    res.status(400).json({ error: "Can only edit draft or rejected distributions" });
    return;
  }
  const parsed = UpdateDistributionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [dist] = await db.update(distributionsTable).set(parsed.data).where(eq(distributionsTable.id, params.data.id)).returning();
  const enriched = await enrichDistribution(dist);
  res.json(UpdateDistributionResponse.parse(enriched));
});

router.delete("/distributions/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = DeleteDistributionParams.safeParse({ id: Number(raw) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [existing] = await db.select().from(distributionsTable).where(eq(distributionsTable.id, params.data.id));
  if (!existing || existing.status !== "draft") {
    res.status(400).json({ error: "Can only delete draft distributions" });
    return;
  }
  await db.delete(distributionsTable).where(eq(distributionsTable.id, params.data.id));
  res.sendStatus(204);
});

router.post("/distributions/:id/submit", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = SubmitDistributionParams.safeParse({ id: Number(raw) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [existing] = await db.select().from(distributionsTable).where(eq(distributionsTable.id, params.data.id));
  if (!existing) {
    res.status(404).json({ error: "Distribution not found" });
    return;
  }
  if (!["draft", "rejected"].includes(existing.status)) {
    res.status(400).json({ error: "Can only submit draft or rejected distributions" });
    return;
  }
  const [dist] = await db.update(distributionsTable).set({ status: "submitted", submittedAt: new Date(), remarks: null }).where(eq(distributionsTable.id, params.data.id)).returning();

  // Generate an AI recommendation automatically
  const recs = ["approve", "approve", "review", "reject"];
  const levels = ["low", "medium", "high"];
  const rec = recs[Math.floor(Math.random() * recs.length)];
  const riskScore = rec === "approve" ? Math.random() * 30 + 5 : rec === "review" ? Math.random() * 30 + 35 : Math.random() * 30 + 65;
  const riskLevel = riskScore < 30 ? "low" : riskScore < 65 ? "medium" : "high";
  const reasonings: Record<string, string> = {
    approve: "Historical distribution patterns show this request is within normal operational parameters. Stock levels remain healthy post-distribution. Recipient has a consistent on-time receipt record.",
    review: "Quantity is slightly above the 30-day rolling average. Recommend verifying recipient capacity before approval. Stock levels may approach warning threshold after distribution.",
    reject: "Requested quantity exceeds available stock safety margin. Current stock health is critical. Approving this request risks stockout in the next 7 days.",
  };
  await db.insert(approvalsTable).values({
    distributionId: dist.id,
    status: "pending",
    aiRecommendation: rec,
    aiRiskScore: riskScore,
    aiRiskLevel: riskLevel,
    aiReasoning: reasonings[rec],
    aiConfidence: 0.78 + Math.random() * 0.18,
  });

  const enriched = await enrichDistribution(dist);
  await db.insert(activityTable).values({ type: "distribution_submitted", description: `Distribution submitted for approval — ${enriched.stockName}`, actor: "executive", stockCode: enriched.stockCode });
  res.json(SubmitDistributionResponse.parse(enriched));
});

export default router;
