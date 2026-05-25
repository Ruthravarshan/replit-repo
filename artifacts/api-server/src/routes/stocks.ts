import { Router } from "express";
import { eq, and, isNull } from "drizzle-orm";
import { db, stocksTable, ledgerTable } from "@workspace/db";
import {
  ListStocksQueryParams,
  ListStocksResponse,
  CreateStockBody,
  GetStockParams,
  GetStockResponse,
  UpdateStockParams,
  UpdateStockBody,
  UpdateStockResponse,
  DeleteStockParams,
  GetStockLedgerParams,
  GetStockLedgerResponse,
} from "@workspace/api-zod";

const router = Router();

function serializeStock(s: typeof stocksTable.$inferSelect) {
  return {
    ...s,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt?.toISOString() ?? null,
    deletedAt: s.deletedAt?.toISOString() ?? null,
  };
}

function serializeLedger(l: typeof ledgerTable.$inferSelect) {
  return { ...l, createdAt: l.createdAt.toISOString() };
}

router.get("/stocks", async (req, res): Promise<void> => {
  const query = ListStocksQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }
  const { category, location, status, search } = query.data;

  let conditions = [isNull(stocksTable.deletedAt)];
  if (category) conditions.push(eq(stocksTable.category, category));
  if (location) conditions.push(eq(stocksTable.location, location));
  if (status) conditions.push(eq(stocksTable.status, status));

  let rows = await db.select().from(stocksTable).where(and(...conditions)).orderBy(stocksTable.createdAt);

  if (search) {
    const s = search.toLowerCase();
    rows = rows.filter(
      (r) =>
        r.stockCode.toLowerCase().includes(s) ||
        r.stockName.toLowerCase().includes(s) ||
        r.category.toLowerCase().includes(s),
    );
  }

  res.json(ListStocksResponse.parse(rows.map(serializeStock)));
});

router.post("/stocks", async (req, res): Promise<void> => {
  const parsed = CreateStockBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { stockCode, stockName, category, unitOfMeasure, openingQuantity, location } = parsed.data;
  const healthScore = openingQuantity >= 70 ? 85 : openingQuantity >= 40 ? 60 : 25;
  const [stock] = await db
    .insert(stocksTable)
    .values({ stockCode, stockName, category, unitOfMeasure, openingQuantity, availableQuantity: openingQuantity, location, healthScore })
    .returning();
  await db.insert(ledgerTable).values({ stockId: stock.id, type: "opening", quantity: openingQuantity, description: "Opening stock entry", createdBy: "system" });
  res.status(201).json(GetStockResponse.parse(serializeStock(stock)));
});

router.get("/stocks/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = GetStockParams.safeParse({ id: Number(raw) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [stock] = await db.select().from(stocksTable).where(and(eq(stocksTable.id, params.data.id), isNull(stocksTable.deletedAt)));
  if (!stock) {
    res.status(404).json({ error: "Stock not found" });
    return;
  }
  res.json(GetStockResponse.parse(serializeStock(stock)));
});

router.patch("/stocks/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = UpdateStockParams.safeParse({ id: Number(raw) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateStockBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [stock] = await db.update(stocksTable).set(parsed.data).where(and(eq(stocksTable.id, params.data.id), isNull(stocksTable.deletedAt))).returning();
  if (!stock) {
    res.status(404).json({ error: "Stock not found" });
    return;
  }
  res.json(UpdateStockResponse.parse(serializeStock(stock)));
});

router.delete("/stocks/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = DeleteStockParams.safeParse({ id: Number(raw) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [stock] = await db.update(stocksTable).set({ deletedAt: new Date() }).where(and(eq(stocksTable.id, params.data.id), isNull(stocksTable.deletedAt))).returning();
  if (!stock) {
    res.status(404).json({ error: "Stock not found" });
    return;
  }
  res.sendStatus(204);
});

router.get("/stocks/:id/ledger", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = GetStockLedgerParams.safeParse({ id: Number(raw) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const entries = await db.select().from(ledgerTable).where(eq(ledgerTable.stockId, params.data.id)).orderBy(ledgerTable.createdAt);
  res.json(GetStockLedgerResponse.parse(entries.map(serializeLedger)));
});

export default router;
