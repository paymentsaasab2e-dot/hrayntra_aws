# Employers behaviour engine API

Stats and **entity ids only** (no duplicated lead/job names). Use this to inspect tenant-wide and per-user activity before wiring HQ UI.

Base: `/api/v1` on **backendphase2** (local `http://localhost:5001`).

## HQ (check this first)

HQ JWT required (same as other `/hq/*` routes).

```
GET /api/v1/hq/tenants/:tenantDbName/behavior-engine
```

Query:

| Param | Values | Default |
|-------|--------|---------|
| `range` | `today` `week` `month` `year` | `week` |
| `userId` | CRM user ObjectId | all users |

PowerShell:

```powershell
$P2 = "http://localhost:5001"
$TOKEN = "<HQ JWT>"
$TENANT = "<tenantDbName>"

Invoke-RestMethod -Headers @{ Authorization = "Bearer $TOKEN" } `
  "$P2/api/v1/hq/tenants/$TENANT/behavior-engine?range=week"
```

Single user:

```
.../behavior-engine?range=week&userId=<userObjectId>
```

This is **separate** from the existing HQ rollup:

```
GET /api/v1/hq/tenants/:tenantDbName/behavior
```

## Tenant (same payload, employers portal token)

```
GET /api/v1/tenant-behavior/engine?range=week
GET /api/v1/tenant-behavior/engine?range=week&userId=<userObjectId>
```

## What is stored / returned

On `POST /api/v1/tenant-behavior`, snapshots are slimmed: **counts + entity ids**, not names/labels.

Engine response shape:

```json
{
  "engine": "employers-behavior-engine",
  "tenantDbName": "...",
  "range": "week",
  "tenantWide": {
    "activity": { "visits": 0, "activeMs": 0, "actions": 0, "trackedUsers": 0, "activeUsers": 0 },
    "workload": {
      "tasks": { "total": 0, "assigned": 0, "open": 0, "done": 0, "overdue": 0 },
      "leads": { "total": 0, "assigned": 0, "unassigned": 0, "open": 0, "done": 0, "unassignedIds": { "count": 0, "ids": [], "truncated": false } }
    }
  },
  "users": [
    {
      "userId": "...",
      "activity": { "visits": 0, "activeMs": 0, "actions": 0, "openedEntityIds": [{ "entityType": "lead", "entityId": "...", "views": 1 }] },
      "workload": {
        "tasks": { "assigned": 0, "open": 0, "done": 0, "overdue": 0, "ids": { "open": { "count": 0, "ids": [] } }, "linkedEntityIds": { "JOB": { "count": 0, "ids": [] } } },
        "leads": { "assigned": 0, "open": 0, "done": 0, "ids": { "assigned": { "count": 0, "ids": [] } } }
      }
    }
  ]
}
```

Id lists are capped at 40 (`truncated: true` if more). Resolve names from CRM by id when you need them for audit UI.
