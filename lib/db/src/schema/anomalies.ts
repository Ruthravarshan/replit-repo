import { pgTable, text, serial, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const anomaliesTable = pgTable("anomalies", {
  id: serial("id").primaryKey(),
  stockId: integer("stock_id").notNull(),
  type: text("type").notNull(),
  severity: text("severity").notNull(),
  description: text("description").notNull(),
  explanation: text("explanation"),
  dismissed: boolean("dismissed").notNull().default(false),
  status: text("status").notNull().default("active"),
  acknowledgedBy: text("acknowledged_by"),
  acknowledgedAt: timestamp("acknowledged_at", { withTimezone: true }),
  resolvedBy: text("resolved_by"),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  resolutionNotes: text("resolution_notes"),
  detectedAt: timestamp("detected_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertAnomalySchema = createInsertSchema(anomaliesTable).omit({ id: true, createdAt: true });
export type InsertAnomaly = z.infer<typeof insertAnomalySchema>;
export type Anomaly = typeof anomaliesTable.$inferSelect;
