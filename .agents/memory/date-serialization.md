---
name: Date serialization in API routes
description: Drizzle ORM returns Date objects but Zod schemas expect ISO strings — must serialize before parse
---

**Rule:** Every route that calls `.parse()` on a Drizzle result must first map dates to `.toISOString()`.

**Why:** Drizzle returns native JS `Date` objects from Postgres. The generated Zod schemas (from OpenAPI `type: string`) reject Date objects with a Zod validation error.

**How to apply:** Use a `serializeXxx()` helper function at the top of each route file that spreads the row and converts all Date fields:
```ts
function serializeStock(s: typeof stocksTable.$inferSelect) {
  return { ...s, createdAt: s.createdAt.toISOString(), updatedAt: s.updatedAt?.toISOString() ?? null, deletedAt: s.deletedAt?.toISOString() ?? null };
}
```
Apply to: stocks, distributions (via `enrichDistribution`), approvals (via `buildApprovalResponse`), activity, ledger.
