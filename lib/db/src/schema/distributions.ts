import { pgTable, text, serial, timestamp, real, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const distributionsTable = pgTable("distributions", {
  id: serial("id").primaryKey(),
  stockId: integer("stock_id").notNull(),
  quantityDistributed: real("quantity_distributed").notNull(),
  distributionDate: text("distribution_date").notNull(),
  recipient: text("recipient").notNull(),
  purpose: text("purpose"),
  status: text("status").notNull().default("draft"),
  remarks: text("remarks"),
  submittedAt: timestamp("submitted_at", { withTimezone: true }),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertDistributionSchema = createInsertSchema(distributionsTable).omit({ id: true, createdAt: true, updatedAt: true, submittedAt: true, approvedAt: true });
export type InsertDistribution = z.infer<typeof insertDistributionSchema>;
export type Distribution = typeof distributionsTable.$inferSelect;
