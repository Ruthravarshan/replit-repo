import { pgTable, text, serial, timestamp, real, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const stocksTable = pgTable("stocks", {
  id: serial("id").primaryKey(),
  stockCode: text("stock_code").notNull().unique(),
  stockName: text("stock_name").notNull(),
  category: text("category").notNull(),
  unitOfMeasure: text("unit_of_measure").notNull(),
  openingQuantity: real("opening_quantity").notNull().default(0),
  availableQuantity: real("available_quantity").notNull().default(0),
  minStockLevel: real("min_stock_level").default(0),
  location: text("location"),
  status: text("status").notNull().default("active"),
  healthScore: real("health_score"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

export const insertStockSchema = createInsertSchema(stocksTable).omit({ id: true, createdAt: true, updatedAt: true, deletedAt: true });
export type InsertStock = z.infer<typeof insertStockSchema>;
export type Stock = typeof stocksTable.$inferSelect;
