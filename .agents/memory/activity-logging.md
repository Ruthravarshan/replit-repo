---
name: Activity logging pattern
description: How and where to write audit trail events to activityTable
---

**Rule:** Every state-changing action must insert a row into `activityTable` with `type`, `description`, `actor`, and `stockCode`.

**Actor values:** `"executive"` (maker actions), `"Manager"` (checker actions), `"system"` (automated/anomaly), `"AI System"` (anomaly detection).

**Event types in use:** `distribution_created`, `distribution_submitted`, `distribution_approved`, `distribution_rejected`, `anomaly_detected`.

**Why:** The Audit Log page (`/audit-log`) reads from this table via `GET /activity`. The dashboard activity feed reads the 20 most recent via `GET /dashboard/activity`. Both require the timestamp field, which must be serialized to ISO string before returning.
