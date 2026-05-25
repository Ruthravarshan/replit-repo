import { Router } from "express";
import { eq, and, inArray } from "drizzle-orm";
import { db, approvalsTable, distributionsTable, stocksTable, ledgerTable, activityTable } from "@workspace/db";
import {
  ListApprovalsQueryParams,
  ListApprovalsResponse,
  GetApprovalParams,
  GetApprovalResponse,
  ApproveRequestParams,
  ApproveRequestBody,
  ApproveRequestResponse,
  RejectRequestParams,
  RejectRequestBody,
  RejectRequestResponse,
} from "@workspace/api-zod";

const router = Router();

async function buildApprovalResponse(approval: typeof approvalsTable.$inferSelect) {
  const [dist] = await db.select().from(distributionsTable).where(eq(distributionsTable.id, approval.distributionId));
  const [stock] = dist ? await db.select().from(stocksTable).where(eq(stocksTable.id, dist.stockId)) : [null];

  return {
    id: approval.id,
    distributionId: approval.distributionId,
    distribution: dist
      ? {
          id: dist.id,
          stockId: dist.stockId,
          stockName: stock?.stockName ?? "Unknown",
          stockCode: stock?.stockCode ?? null,
          quantityDistributed: dist.quantityDistributed,
          distributionDate: dist.distributionDate,
          recipient: dist.recipient,
          purpose: dist.purpose ?? null,
          status: dist.status,
          remarks: dist.remarks ?? null,
          submittedAt: dist.submittedAt?.toISOString() ?? null,
          approvedAt: dist.approvedAt?.toISOString() ?? null,
          createdAt: dist.createdAt.toISOString(),
        }
      : null,
    status: approval.status,
    remarks: approval.remarks ?? null,
    approvedBy: approval.approvedBy ?? null,
    approvedAt: approval.approvedAt?.toISOString() ?? null,
    aiRecommendation: approval.aiRecommendation
      ? {
          recommendation: approval.aiRecommendation,
          riskScore: approval.aiRiskScore ?? 0,
          riskLevel: approval.aiRiskLevel ?? "low",
          reasoning: approval.aiReasoning ?? "",
          confidence: approval.aiConfidence ?? null,
        }
      : null,
    createdAt: approval.createdAt.toISOString(),
  };
}

router.get("/approvals", async (req, res): Promise<void> => {
  const query = ListApprovalsQueryParams.safeParse(req.query);
  if (!query.success) { res.status(400).json({ error: query.error.message }); return; }
  const { status } = query.data;
  const rows = status
    ? await db.select().from(approvalsTable).where(eq(approvalsTable.status, status)).orderBy(approvalsTable.createdAt)
    : await db.select().from(approvalsTable).orderBy(approvalsTable.createdAt);

  const enriched = await Promise.all(rows.map(buildApprovalResponse));
  res.json(ListApprovalsResponse.parse(enriched));
});

router.get("/approvals/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = GetApprovalParams.safeParse({ id: Number(raw) });
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const [approval] = await db.select().from(approvalsTable).where(eq(approvalsTable.id, params.data.id));
  if (!approval) { res.status(404).json({ error: "Approval not found" }); return; }
  const enriched = await buildApprovalResponse(approval);
  res.json(GetApprovalResponse.parse(enriched));
});

router.post("/approvals/:id/approve", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = ApproveRequestParams.safeParse({ id: Number(raw) });
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const body = ApproveRequestBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }

  const [approval] = await db.select().from(approvalsTable).where(eq(approvalsTable.id, params.data.id));
  if (!approval || approval.status !== "pending") { res.status(400).json({ error: "Approval not pending" }); return; }

  const now = new Date();
  const [updated] = await db.update(approvalsTable)
    .set({ status: "approved", remarks: body.data.remarks, approvedBy: "Manager", approvedAt: now })
    .where(eq(approvalsTable.id, params.data.id)).returning();

  const [dist] = await db.update(distributionsTable)
    .set({ status: "approved", approvedAt: now })
    .where(eq(distributionsTable.id, approval.distributionId)).returning();

  if (dist) {
    const [s] = await db.select().from(stocksTable).where(eq(stocksTable.id, dist.stockId));
    const newQty = Math.max(0, (s?.availableQuantity ?? 0) - dist.quantityDistributed);
    await db.update(stocksTable).set({ availableQuantity: newQty }).where(eq(stocksTable.id, dist.stockId));
    await db.insert(ledgerTable).values({ stockId: dist.stockId, type: "distribution", quantity: -dist.quantityDistributed, description: `Distributed to ${dist.recipient} — approved`, createdBy: "Manager" });
    await db.insert(activityTable).values({ type: "distribution_approved", description: `Distribution approved for ${s?.stockName ?? "stock"}`, actor: "Manager", stockCode: s?.stockCode });
  }

  const enriched = await buildApprovalResponse(updated);
  res.json(ApproveRequestResponse.parse(enriched));
});

router.post("/approvals/:id/reject", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = RejectRequestParams.safeParse({ id: Number(raw) });
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const body = RejectRequestBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }

  if (!body.data.remarks || body.data.remarks.length < 20) {
    res.status(400).json({ error: "Rejection remarks must be at least 20 characters" });
    return;
  }

  const [approval] = await db.select().from(approvalsTable).where(eq(approvalsTable.id, params.data.id));
  if (!approval || approval.status !== "pending") { res.status(400).json({ error: "Approval not pending" }); return; }

  const [updated] = await db.update(approvalsTable)
    .set({ status: "rejected", remarks: body.data.remarks, approvedBy: "Manager", approvedAt: new Date() })
    .where(eq(approvalsTable.id, params.data.id)).returning();
  const [dist] = await db.update(distributionsTable)
    .set({ status: "rejected", remarks: body.data.remarks })
    .where(eq(distributionsTable.id, approval.distributionId)).returning();

  if (dist) {
    const [stock] = await db.select().from(stocksTable).where(eq(stocksTable.id, dist.stockId));
    await db.insert(activityTable).values({ type: "distribution_rejected", description: `Distribution rejected — ${stock?.stockName ?? "stock"}`, actor: "Manager", stockCode: stock?.stockCode });
  }

  const enriched = await buildApprovalResponse(updated);
  res.json(RejectRequestResponse.parse(enriched));
});

// Bulk approve low-risk items
router.post("/approvals/bulk-approve", async (req, res): Promise<void> => {
  const { ids, remarks } = req.body as { ids: number[]; remarks?: string };
  if (!Array.isArray(ids) || ids.length === 0) {
    res.status(400).json({ error: "ids array required" });
    return;
  }

  const pendingApprovals = await db.select().from(approvalsTable)
    .where(and(inArray(approvalsTable.id, ids), eq(approvalsTable.status, "pending")));

  const now = new Date();
  let processed = 0;

  for (const approval of pendingApprovals) {
    await db.update(approvalsTable)
      .set({ status: "approved", remarks: remarks ?? "Bulk approved — low risk", approvedBy: "Manager", approvedAt: now })
      .where(eq(approvalsTable.id, approval.id));

    const [dist] = await db.update(distributionsTable)
      .set({ status: "approved", approvedAt: now })
      .where(eq(distributionsTable.id, approval.distributionId)).returning();

    if (dist) {
      const [s] = await db.select().from(stocksTable).where(eq(stocksTable.id, dist.stockId));
      const newQty = Math.max(0, (s?.availableQuantity ?? 0) - dist.quantityDistributed);
      await db.update(stocksTable).set({ availableQuantity: newQty }).where(eq(stocksTable.id, dist.stockId));
      await db.insert(ledgerTable).values({ stockId: dist.stockId, type: "distribution", quantity: -dist.quantityDistributed, description: `Bulk approved — distributed to ${dist.recipient}`, createdBy: "Manager" });
      await db.insert(activityTable).values({ type: "distribution_approved", description: `Bulk approved: ${s?.stockName ?? "stock"} → ${dist.recipient}`, actor: "Manager", stockCode: s?.stockCode });
    }
    processed++;
  }

  res.json({ processed, total: ids.length });
});

export default router;
