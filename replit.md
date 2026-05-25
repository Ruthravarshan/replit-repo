# Mavericks Inventory

Autonomous Inventory Intelligence Platform for the Hexaware Mavericks GenAI Designathon 2026. An AI-augmented system combining enterprise-grade maker-checker controls with AI-driven anomaly detection, approval recommendations, and inventory insights.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm --filter @workspace/mavericks-inventory run dev` — run the frontend (port 26222)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite, Tailwind CSS, Recharts, Framer Motion, Lucide React
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `lib/api-spec/openapi.yaml` — OpenAPI contract (source of truth)
- `lib/db/src/schema/` — Drizzle table definitions: stocks, distributions, approvals, anomalies, activity, ledger
- `artifacts/api-server/src/routes/` — Express route handlers (stocks, distributions, approvals, dashboard, anomalies, insights)
- `artifacts/mavericks-inventory/src/` — React frontend (App.tsx, pages/, components/)
- `lib/api-client-react/src/generated/` — Generated React Query hooks
- `lib/api-zod/src/generated/` — Generated Zod validation schemas

## Architecture decisions

- OpenAPI-first: spec gates codegen which gates both frontend hooks and backend Zod validators
- AI recommendations are generated server-side at distribution submit time (no external API calls; deterministic logic with realistic outputs)
- Maker-checker: distributions follow Draft → Submitted → Approved/Rejected; stock quantity only deducted on approval
- Soft deletes for stock master (deletedAt column); no hard deletes on transactional data
- Health scores computed at insert time based on quantity thresholds (≥70 = Healthy, 40-69 = Warning, <40 = Critical)

## Product

- **Dashboard** — real-time KPI cards, AI anomaly banners (dismissible), AI synthesis panel, health score chart
- **Approval Workspace** — pending distribution requests with glassmorphic AI recommendation cards (approve/review/reject + risk score)
- **Stock Master** — searchable inventory table with health indicators, CRUD modal
- **Distributions** — distribution history with status lifecycle tracking
- **New Distribution** — form to create and submit distribution entries

## User preferences

- Dark mode by default with teal primary color palette
- Enterprise-grade premium aesthetic — glassmorphism on AI cards, dense information layout
- No emojis in the UI

## Gotchas

- Always run `pnpm --filter @workspace/api-spec run codegen` after changing `openapi.yaml`
- Stock quantities only update after approval — distributions don't affect stock in draft/submitted state
- AI recommendations are auto-generated when a distribution is submitted (not from an external AI API)
