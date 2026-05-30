# Phase 2 Dashboard — Module-Wise Build Guide (Backend-Aligned)

> **Status (implemented):** **Dashboard V2** is live at `/dashboard` — Layer 1 global KPI strip (`GET /dashboard/overview`), Layer 2 module tabs + command centers (existing `GET /dashboard/data/:datasetId` + module stats), Layer 3 collapsible **Advanced widgets** (`CustomDashboard`). See `frontphase2/src/components/dashboard/v2/DashboardV2Page.tsx`.

> **Goal:** Restructure `/dashboard` so each **sidebar module** shows data in a **fixed, structured way** on the frontend — using **APIs that already exist** where possible, and a clear list of **net-new backend work** only where gaps remain (especially per-row engagement counts, alerts, and cron).

**Companion docs:** `PHASE2_REPORTS_PAGE_DESIGN.md` (analytics depth), `PHASE2_DASHBOARD_LEADS_DESIGN.md` (redirect to this file).

---

## 1. Sidebar → dashboard sections (source of truth)

The dashboard page should mirror the **left navigation** (not invent extra modules unless permitted):

| Sidebar (nav) | App route | Dashboard section key | Permission gate (typical) |
|---------------|-----------|------------------------|---------------------------|
| Dashboard | `/dashboard` | _(this page)_ | `view_dashboard` |
| Leads | `/leads` | `leads` | `leads_read` |
| Clients | `/client` | `clients` | `clients_read` |
| Jobs | `/job` | `jobs` | `jobs_read` / `view_jobs` |
| Candidates | `/candidate` | `candidates` | `candidates_read` |
| Interviews | `/interviews` | `interviews` | `interviews_read` |
| Placements | `/placements` | `placements` | `placements_read` |
| **Recruitment hub** | | | |
| Pipeline | pipeline UI (per job) | `pipeline` | `pipeline_read` / `move_pipeline` |
| Matches | matches UI | `matches` | `matches_read` |
| Tasks & Activities | `/Task&Activites` | `tasks` | `tasks_read` |

Optional dashboard sections (already in widget catalog, not main nav): **Team**, **Departments**.

---

## 2. What the backend has today (inventory)

### 2.1 Dashboard module (`/api/v1/dashboard`)

Mounted in `app.js` → `dashboard.routes.js`.

| Endpoint | Purpose | Used by frontend today |
|----------|---------|----------------------|
| `GET /dashboard/catalog` | Lists datasets + module groups | `CustomDashboard` → `apiDashboardCatalog()` |
| `GET /dashboard/data/:datasetId` | Rows for charts/tables (max ~800 rows) | `apiDashboardDataset()` per widget |
| `POST /dashboard/analyze` | Chart suggestions from rows | Add Widget wizard |
| `GET /dashboard/layout` | Saved widget layout | `apiDashboardGetLayout()` |
| `PUT /dashboard/layout` | Persist widgets | `apiDashboardSaveLayout()` |

**Registry:** `backendphase2/src/modules/dashboard/dashboard.registry.js`  
**Fetch logic:** `backendphase2/src/modules/dashboard/dashboard.service.js`

#### Dataset registry ↔ module (exists now)

| `datasetId` | Module label | `kind` | Fields returned today (list datasets) |
|-------------|--------------|--------|----------------------------------------|
| `leads` | Leads | list | `id`, `companyName`, `status`, `source`, `location`, `createdAt`, `updatedAt` |
| `clients` | Clients | list | `id`, `name`/`companyName`, `status`, `industry`, `location`, dates |
| `clients_metrics` | Clients | metrics | Via `clientService.getMetrics(req)` → KPI rows |
| `jobs` | Jobs | list | `title`, `status`, `openings`, `client`, `applied`, `interviewed`, `offered`, `joined`, dates |
| `jobs_metrics` | Jobs | metrics | Via `jobService.getMetrics(req)` |
| `candidates` | Candidates | list | `name`, `status`, `source`, `location`, dates |
| `candidates_pipeline` | Candidates | metrics | Stage counts via `candidateService.getStats()` |
| `interviews` | Interviews | list | `status`, `round`, `scheduledAt`, `candidate`, `job` |
| `interviews_kpis` | Interviews | metrics | Via `interviewService.getKpis(req)` |
| `placements` | Placements | list | `status`, `revenue`, dates, `candidate`, `client` |
| `placements_stats` | Placements | metrics | Via `placementService.getStats()` |
| `tasks_and_activity` | Task and activity | list | Merged `TeamTask` + `UserActivity` (not CRM `Task` model) |
| `team` | Team | list | User name, email, department, role, status |
| `departments` | Departments | list | Name, member count |

**Gaps vs product ask:** No per-record **calls / emails / WhatsApp**, **assignee** (leads), **last activity**, or **alert** in any dashboard dataset. Those require **new aggregation** (Wave 0–1+).

---

### 2.2 Module APIs (outside dashboard — reuse on dashboard)

| Module | Base path | List / detail | Metrics / stats | Per-entity activities |
|--------|-----------|---------------|-----------------|------------------------|
| **Leads** | `/api/v1/leads` | `GET /` | _(none dedicated)_ | `GET /:id/activities` |
| **Clients** | `/api/v1/clients` | `GET /` | `getMetrics` used by dashboard dataset | `getActivities` in service |
| **Jobs** | `/api/v1/jobs` | `GET /` | `getMetrics` in `job.service.js` | Job notes/files routes |
| **Candidates** | `/api/v1/candidates` | `GET /` | `GET /stats` (stage counts) | Candidate activities |
| **Interviews** | `/api/v1/interviews` | `GET /` | `GET /kpis` | Interview logs/feedback |
| **Placements** | `/api/v1/placements` | `GET /` | `GET /stats` | Placement service |
| **Tasks** | `/api/v1/tasks` | `GET /` | `GET /stats` | `GET /:id/activities` |
| **Pipeline** | `/api/v1/pipeline` | `GET /job/:jobId` | _(per job)_ | `POST .../move` |
| **Matches** | `/api/v1/matches` | `GET /` | _(in list)_ | submit/reject actions |
| **Contacts** | `/api/v1/contacts` | `GET /` | `GET /stats` | Not in main nav |
| **Reports** | `/api/v1/reports` | `GET /dataset/:entity` | `GET /summary` | Export columns |
| **Notifications** | `/api/v1/notifications` | `GET /`, unread count | — | Bell drawer |
| **Settings** | `/api/v1/settings` (generic) | — | — | Trigger key `notification_email_trigger_points_v1` |

**Reports `GET /summary`** (cross-module, RBAC-scoped) already exposes:

- `recruitmentPerformance`, `pipelineFunnel`, `jobsClients`, `candidates`, `interviews`, `placementsRevenue`, `teamPerformance`, **`activityProductivity`** (calls, emails, tasks completed, overdue), `entityCounts`

Use this for the **Overview strip** on the dashboard without duplicating report SQL.

---

### 2.3 Activity & notification data (for engagement columns + alerts)

| Store | Model / API | Used for |
|-------|-------------|----------|
| CRM activity log | `Activity` (`entityType`: LEAD, CLIENT, CANDIDATE, JOB, …) | Per-entity calls/emails/meetings when logged via `activityService` |
| Lead follow-up | `Lead.lastFollowUp`, `Lead.nextFollowUp` | Overdue follow-up alerts |
| Client follow-up | `Client.nextFollowUpDue` | Client overdue (email: `client.followup_email`) |
| User audit | `UserActivity` | Shown in dashboard `tasks_and_activity` dataset only |
| CRM tasks | `Task` (`/api/v1/tasks`) | Task module stats — **not** the same as `TeamTask` in dashboard dataset |
| Bell | `Notification` | In-app alerts (category per module) |
| Email gates | `notification-trigger-settings.js` | `isNotificationTriggerEnabled(triggerId)` |

**Important:** Dashboard `tasks_and_activity` ≠ `/api/v1/tasks`. The command center for **Tasks & Activities** should call **`/tasks` + `/tasks/stats`**, not only the dashboard dataset.

---

## 3. Target frontend structure (`/dashboard`)

### 3.1 Layout (recommended)

Replace “widgets only” as the **only** experience with a **two-layer** page:

```
┌─────────────────────────────────────────────────────────────┐
│  Overview strip (optional) — GET /reports/summary (subset)   │
├─────────────────────────────────────────────────────────────┤
│  Module tabs: [Leads] [Clients] [Jobs] … (permission-filtered)│
├─────────────────────────────────────────────────────────────┤
│  Active module: CommandCenterPanel                           │
│    • Summary chips (module summary API)                      │
│    • Toolbar filters                                         │
│    • Fixed-column table (CommandCenterTable)                 │
│    • Row click → existing drawer / route                     │
├─────────────────────────────────────────────────────────────┤
│  “Custom widgets” (collapsible) — existing CustomDashboard     │
│    • GET /dashboard/catalog + layout (power users)           │
└─────────────────────────────────────────────────────────────┘
```

**Files (target):**

| Piece | Path |
|-------|------|
| Page shell | `frontphase2/src/app/dashboard/page.tsx` |
| Module tabs | `components/dashboard/DashboardModuleTabs.tsx` |
| Per-module panel | `components/dashboard/command-centers/<Module>CommandCenter.tsx` |
| Shared table | `components/dashboard/CommandCenterTable.tsx` |
| Shared chips | `components/dashboard/CommandCenterSummaryChips.tsx` |
| API client | `lib/dashboard/commandCenterApi.ts` |
| Existing widgets | `components/dashboard/CustomDashboard.tsx` (unchanged, nested) |

### 3.2 What to show **today** vs **after waves** (per module)

Legend: ✅ = use existing API as-is · 🔧 = extend existing · 🆕 = new endpoint/aggregation

---

#### Leads (`leads`)

| UI column | Today (ship with existing) | Target (command center) | Backend source |
|-----------|----------------------------|-------------------------|----------------|
| Lead name | ✅ `companyName` from `GET /dashboard/data/leads` | Same | `fetchLeadsList` |
| Status / source | ✅ dataset | Same | |
| Team member | 🔧 `GET /leads` list includes assignee in full API; **not** in dashboard dataset | `assignedTo` on list API or extend fetch | 
| Total calls / emails / WhatsApp | 🆕 | Aggregate `Activity` LEAD | Wave 1 |
| Last activity | 🆕 | Max `Activity.createdAt` | Wave 1 |
| Alert | 🆕 | Rule engine | Wave 1–2 |
| Summary chips | 🔧 Count by status on client from list, or `reports/summary.entityCounts.leads` | `withAlerts`, overdue follow-up | Wave 1 |

**Interim (Wave 0):** Table with name, status, source, location, updated — from **`GET /dashboard/data/leads`** + link to `/leads`.  
**MVP (Wave 1):** Full table per product spec via **`GET /dashboard/modules/leads/command-center`** (new).

---

#### Clients (`clients`)

| UI column | Today | Target | Backend |
|-----------|-------|--------|---------|
| Client name | ✅ dashboard `clients` | Same | `fetchClientsList` |
| KPI strip | ✅ `clients_metrics` dataset | Open jobs, placements, revenue | `clientService.getMetrics` |
| Owner / open jobs | 🔧 full client list API | Extend command center | Client service + counts |
| Calls / emails / WhatsApp | 🆕 | `Activity` CLIENT + contact activities | Wave 3 |
| Next follow-up / alert | 🆕 | `nextFollowUpDue`, `client.followup_email` | Wave 3 |

**Interim:** List table + metrics widget from **`clients`** + **`clients_metrics`**.

---

#### Jobs (`jobs`)

| UI column | Today | Target | Backend |
|-----------|-------|--------|---------|
| Job title, client, status | ✅ dashboard `jobs` | Same | `fetchJobsList` (+ pipeline counts) |
| Applied / interviewed / offered / joined | ✅ already on dashboard rows | Same | `buildJobPipelineCounts` |
| KPIs | ✅ `jobs_metrics` | activeJobs, near SLA, no candidates | `jobService.getMetrics` |
| Owner, SLA alert | 🔧 metrics include `nearSlaCount`, `noCandidatesCount` | Row-level alert | Wave 3 |

**Interim:** **`GET /dashboard/data/jobs`** + **`jobs_metrics`** chart/KPI widget.

---

#### Candidates (`candidates`)

| UI column | Today | Target | Backend |
|-----------|-------|--------|---------|
| Name, status, source | ✅ `candidates` dataset | Same | `fetchCandidatesList` |
| Pipeline stages | ✅ `candidates_pipeline` | Funnel bar | `candidateService.getStats` |
| Stage / owner / last activity | 🔧 `GET /candidates` full list | Command center | Wave 4 |
| Stuck-in-stage alert | 🆕 | Stats + pipeline entries | Wave 4 |

**Interim:** List + pipeline chart from existing datasets.

---

#### Interviews (`interviews`)

| UI column | Today | Target | Backend |
|-----------|-------|--------|---------|
| Candidate, job, schedule | ✅ `interviews` dataset | Same | `fetchInterviewsList` |
| KPIs | ✅ `interviews_kpis` | today / upcoming / completed | `GET /interviews/kpis` |
| Feedback overdue | 🆕 | `interviewFeedback` + rules | Wave 4 |

**Interim:** List + KPI widget — **fully supported by current dashboard backend**.

---

#### Placements (`placements`)

| UI column | Today | Target | Backend |
|-----------|-------|--------|---------|
| Candidate, client, status, revenue | ✅ `placements` dataset | Same | `fetchPlacementsList` |
| Stats | ✅ `placements_stats` | joined, pending, revenue | `GET /placements/stats` |

**Interim:** List + stats — **supported today**.

---

#### Pipeline (`pipeline`)

| Today | Target |
|-------|--------|
| ❌ Not in `DATASET_REGISTRY` | Job-scoped pipeline table or “stale stage” list |
| Use **`reports/summary.pipelineFunnel`** for overview chart | 🆕 `GET /dashboard/modules/pipeline/command-center` or embed report section |

**Interim:** Small **Pipeline funnel** card from **`GET /reports/summary`** (read-only).

---

#### Matches (`matches`)

| Today | Target |
|-------|--------|
| ❌ Not in dashboard registry | Table: candidate, job, score, status, owner, alert |
| — | 🆕 Reuse `GET /api/v1/matches` + command-center wrapper |

**Interim:** Link card “Open Matches” + count from reports `entityCounts.aiMatches` if enabled.

---

#### Tasks & Activities (`tasks`)

| Today | Target |
|-------|--------|
| Dashboard dataset uses **TeamTask + UserActivity** | CRM **Task** command center |
| — | **`GET /tasks`**, **`GET /tasks/stats`** (overdue, due today) |

**Interim:** Wire section to **`/api/v1/tasks`** + stats, not `tasks_and_activity` dataset.  
Keep `tasks_and_activity` widget only under “Custom widgets” if desired.

---

## 4. Unified command-center API (net-new, Wave 0–1 foundation)

Today there is **no** `/dashboard/modules/...` route. Add when building structured tables:

```
GET /api/v1/dashboard/modules/:moduleKey/command-center
GET /api/v1/dashboard/modules/:moduleKey/command-center/summary
GET /api/v1/dashboard/overview          → thin wrapper on reports/summary KPIs
```

`moduleKey`: `leads` | `clients` | `jobs` | `candidates` | `interviews` | `placements` | `pipeline` | `matches` | `tasks`

**Implementation strategy:**

1. **Reuse** `buildWhere`/RBAC patterns from `report.service.js` `buildWhereForEntity`.
2. **Reuse** list queries from `fetch*List` in `dashboard.service.js` where fields match.
3. **Add** one shared `aggregateActivitiesByEntity(entityType, entityIds)` for call/email/WhatsApp counts.
4. **Add** shared `evaluateAlerts(moduleKey, row, rules)` (Leads first).

Until this ships, frontend **Module tabs** should call **existing** endpoints in §2.1–2.2 (structured columns hard-coded per module).

---

## 5. Notification panel (alerts + email) — module map

Settings UI: `NotificationTriggerSettings.tsx`  
Backend: `notification-trigger-settings.js`  
Bell: `GET /api/v1/notifications`

### 5.1 Triggers that exist today (wire to dashboard alerts when cron ships)

| Module | Trigger id (exists) | Event |
|--------|---------------------|-------|
| Leads | `lead.assignment_email`, `lead.followup_email` | Assign, follow-up schedule |
| Clients | `client.assignment_email`, `client.followup_email` | Assign, follow-up |
| Jobs | `job.assignment_email` | Assign |
| Candidates | `candidate.assignment_email` | Assign |
| Interviews | `interview.candidate_scheduled`, `interview.panel_scheduled` | Schedule |
| Placements | `placement.confirmed_email`, `placement.joining_scheduled_*` | Placement lifecycle |
| Matches | `match.submission_email` | Submit to client |

### 5.2 Triggers to add (dashboard idle/stale — by wave)

| Module | Proposed id | Wave |
|--------|-------------|------|
| Leads | `lead.no_activity_email`, `lead.no_activity_inapp`, `lead.followup_overdue_*` | 2 |
| Clients | `client.no_activity_*` | 3 |
| Jobs | `job.sla_breach_*`, `job.no_submissions_*` | 3 |
| Candidates | `candidate.stuck_stage_*` | 4 |
| Interviews | `interview.feedback_overdue_*` | 4 |
| Placements | `placement.joining_at_risk_*` | 4 |
| Tasks | `task.overdue_*`, `task.due_today_inapp` | 5 |

### 5.3 Threshold settings (org-level, new key)

`dashboard_alert_rules_v1` in `Setting` — nested per module (`leads.noActivityDays`, etc.).  
UI: Settings → **Dashboard & alerts** accordion (alongside trigger toggles).

---

## 6. Implementation waves (updated — backend-aware)

### Wave 0 — Structured dashboard shell (no new Prisma)

**Backend**

- [ ] `GET /dashboard/overview` → proxy subset of `reportService.getSummary` (KPIs only)
- [ ] (Optional) Extend `fetchLeadsList` / `fetchClientsList` to include `assignedToId` + assignee name for display

**Frontend**

- [ ] `DashboardModuleTabs` + one `CommandCenterTable` component
- [ ] Per-module **interim** panels wired to **existing** `apiDashboardDataset(datasetId)` + module stats APIs (§3.2 “Interim” rows)
- [ ] Keep `CustomDashboard` in collapsible “Advanced widgets” section
- [ ] Shared `activityChannel.ts` (client util mirroring future server mapper) for consistent labels

**Outcome:** Dashboard page is **module-organized** and shows real backend data in fixed columns (within limits of current datasets).

---

### Wave 1 — Leads command center (MVP product ask)

**Backend**

- [ ] `activityChannel` util + `aggregateActivitiesByEntity`
- [ ] `GET /dashboard/modules/leads/command-center` (+ summary)
- [ ] Alerts computed on read (`LEAD_NO_ACTIVITY`, `LEAD_FOLLOWUP_OVERDUE`, …)

**Frontend**

- [ ] `LeadsCommandCenter.tsx` — full columns: name, calls, emails, WhatsApp, team member, last activity, alert
- [ ] Row → `LeadDetailsDrawer` / `/leads?open=`

**Reuse:** `GET /leads/:id/activities` for drawer parity checks; reports lead fields for export alignment.

---

### Wave 2 — Leads notifications (email + cron)

- [ ] Cron `evaluateDashboardAlerts('leads')`
- [ ] `Notification` rows + emails gated by §5.2 triggers
- [ ] `dashboard_alert_rules_v1` + settings UI

---

### Wave 3 — Clients + Jobs command centers

**Backend:** command-center endpoints; extend metrics row shape.  
**Reuse:** `clientService.getMetrics`, `jobService.getMetrics`, dashboard `jobs` pipeline columns.  
**Frontend:** `ClientsCommandCenter`, `JobsCommandCenter`.

---

### Wave 4 — Candidates + Interviews + Placements

**Reuse:** `GET /candidates/stats`, `GET /interviews/kpis`, `GET /placements/stats`, existing dashboard datasets.  
**Add:** row-level alerts + activity aggregates where missing.

---

### Wave 5 — Recruitment hub (Pipeline, Matches, Tasks)

**Pipeline:** funnel from `reports/summary.pipelineFunnel` + stale-stage table (new aggregation on `PipelineEntry`).  
**Matches:** wrap `GET /matches`.  
**Tasks:** **`GET /tasks` + `/tasks/stats`** (replace reliance on `tasks_and_activity` for main panel).

---

## 7. Module → API quick reference (for frontend devs)

| Dashboard section | Primary list (structured table) | Summary / KPIs | Drawer / route |
|-------------------|----------------------------------|----------------|----------------|
| Overview | — | `GET /reports/summary` | — |
| Leads | Wave 1: `/dashboard/modules/leads/command-center` · Interim: `/dashboard/data/leads` | Reports `entityCounts` or new summary | `/leads`, `LeadDetailsDrawer` |
| Clients | Interim: `/dashboard/data/clients` | `/dashboard/data/clients_metrics` | `/client` |
| Jobs | `/dashboard/data/jobs` | `/dashboard/data/jobs_metrics` | `/job` |
| Candidates | `/dashboard/data/candidates` | `/dashboard/data/candidates_pipeline` | `/candidate` |
| Interviews | `/dashboard/data/interviews` | `/dashboard/data/interviews_kpis` | `/interviews` |
| Placements | `/dashboard/data/placements` | `/dashboard/data/placements_stats` | `/placements` |
| Pipeline | Reports `pipelineFunnel` | Same | Job pipeline routes |
| Matches | `GET /matches` | Reports `entityCounts.aiMatches` | Matches UI |
| Tasks | `GET /tasks` | `GET /tasks/stats` | `/Task&Activites` |

**Auth:** All via `apiFetch` + tenant header; same as existing module pages.

---

## 8. Alignment with reports (avoid two truths)

| Concern | Rule |
|---------|------|
| Lead/client counts | Prefer same `where` scoping as `report.service.js` |
| Activity totals (calls/emails) | Match `summary.activityProductivity` definitions when showing org-level KPIs |
| Export columns | Module list pages + `reportModuleFormats.js` remain canonical for CSV |

---

## 9. Success criteria

1. `/dashboard` shows **one tab/section per sidebar module** (permission-filtered).
2. **Wave 0:** Each section renders **structured tables** from **real** `GET /dashboard/data/:datasetId` and/or module stats APIs — no placeholder mock data.
3. **Wave 1:** Leads section shows calls, emails, WhatsApp, assignee, last activity, alert.
4. Alerts and emails respect **Notifications Trigger Points** + `dashboard_alert_rules_v1`.
5. **Custom widgets** remain available but are not the only dashboard experience.
6. Tasks section uses **`/api/v1/tasks`**, not confused with `TeamTask` dashboard dataset.

---

## 10. Key files

| Layer | Path |
|-------|------|
| Dashboard routes | `backendphase2/src/modules/dashboard/dashboard.routes.js` |
| Dataset registry | `backendphase2/src/modules/dashboard/dashboard.registry.js` |
| Dataset fetch | `backendphase2/src/modules/dashboard/dashboard.service.js` |
| Reports summary | `backendphase2/src/modules/report/report.service.js` |
| Activity log | `backendphase2/src/services/activityService.js` |
| Notification triggers | `backendphase2/src/modules/setting/notification-trigger-settings.js` |
| Frontend dashboard | `frontphase2/src/app/dashboard/page.tsx`, `CustomDashboard.tsx` |
| Module groups | `frontphase2/src/lib/dashboard/moduleGroups.ts` |
| Trigger UI | `frontphase2/src/components/settings/NotificationTriggerSettings.tsx` |

---

## 11. Open decisions

1. **Tabs vs vertical scroll** for module sections on `/dashboard`.
2. Whether Wave 0 extends `fetchLeadsList` in place or waits for command-center API only.
3. Pipeline/Matches: full table vs KPI card until Wave 5.
4. Incognito test users for alerts — document as QA only (not dashboard scope).

---

*Document version: 2026-05-29 — Module-wise dashboard aligned to Phase 2 backend (`/dashboard`, module routes, `/reports/summary`, notifications).*
