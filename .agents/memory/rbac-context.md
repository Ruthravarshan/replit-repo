---
name: RBAC Role Context
description: Simulated role-based access control for Hexaware designathon demo
---

**Rule:** Role switching is purely frontend — no server-side auth. Roles stored in localStorage key `mavericks_role`.

**Roles:** `admin` (full access), `executive` (Maker — can create/submit/delete draft), `manager` (Checker — can approve/reject)

**Flags:** `canMake`, `canCheck`, `canAdmin` — use these in pages to conditionally show action buttons.

**Files:** `src/contexts/role-context.tsx` (provider + hook), `src/components/app-layout.tsx` (dropdown switcher in sidebar footer).
