# Phase 2 Reports Page — Design & Build Guide

> **Product vision:** Feel like **Power BI + HubSpot + Zoho Recruit**, but **much simpler**.  
> **Technical reality:** Phase 2 backend already powers most analytics; this doc is the blueprint to build the frontend and the small gaps on the API.

---

## 0. What users actually want (only 4 questions)

Everything in this product rolls up to four questions. If a widget does not answer one of them, it is **secondary**.

| # | Question | Primary UI | Secondary detail |
|---|----------|------------|------------------|
| 1 | **How is my business doing?** | Executive Dashboard — KPIs + trend + funnel | Entity chips, conversion % |
| 2 | **Which recruiter is performing best?** | Team Analytics — leaderboard + productivity score | Placement leaderboard, pending feedback |
| 3 | **Which jobs/clients are generating placements?** | Client + Placement sections — rankings, revenue | Client health badges |
| 4 | **Can I export the raw data?** | Raw Data Explorer — table + CSV/Excel/PDF | Saved report presets |

All other charts (skills, source mix, activity timeline) support these four questions — they are not the homepage story.

---

## 1. Final UI structure

```
Reports
│
├── Executive Dashboard          ← default landing (homepage)
├── Recruitment Analytics
├── Client Analytics
├── Candidate Analytics
├── Interview Analytics
├── Placement Analytics
├── Revenue Analytics
├── Team Analytics
├── Activity Analytics
└── Raw Data Explorer
```

**Navigation:** Left **sidebar inside Reports** (not horizontal tabs). Users scan vertical lists faster than nine top tabs.

**Saved reports (sidebar footer):**

```
⭐ My Reports
   Monthly Revenue
   Recruiter Performance
   Client Placements
   Interview Pipeline
```

Powered by existing `Report` CRUD (`POST/GET/PATCH/DELETE /reports`) — store `name`, `type`, `filters` JSON.

---

## 2. Global chrome (every section)

### 2.1 Top bar (always visible)

```
┌──────────────────────────────────────────────────────────────┐
│ Reports                                                       │
│                                                               │
│ Last 30 Days ▼   Client ▼   Job ▼   Recruiter ▼              │
│ More Filters ▼                              [Refresh] [Export]│
└──────────────────────────────────────────────────────────────┘
```

| Control | Behavior |
|---------|----------|
| **Date** | Presets: Last 7d / 30d / 90d / This month / Quarter / Year + custom From/To |
| **Client / Job / Recruiter** | High-value scope — answers “for whom?” without opening More Filters |
| **More Filters** | Collapsed drawer — status, source, industry, department, report modules |
| **Refresh** | Re-fetch active section |
| **Export** | Current section → CSV / Excel / PDF (`export_data` permission) |

**Do not** show 20 filters on load. Layer 1 = date + 3 scopes; everything else behind **More Filters**.

### 2.2 Layout wireframe

```
┌─────────────┬────────────────────────────────────────────────┐
│  SIDEBAR    │  TOP BAR (filters)                              │
│             ├────────────────────────────────────────────────┤
│  Executive  │                                                 │
│  Recruitment│  SECTION CONTENT                                │
│  Clients    │  (KPIs, charts, tables — per sidebar item)      │
│  Candidates │                                                 │
│  Interviews │                                                 │
│  Placements │                                                 │
│  Revenue    │                                                 │
│  Team       │                                                 │
│  Activity   │                                                 │
│  Raw Data   │                                                 │
│             │                                                 │
│  ─────────  │                                                 │
│  My Reports │                                                 │
└─────────────┴────────────────────────────────────────────────┘
```

### 2.3 Sidebar item → route & API

| Sidebar label | Route slug | `activeSection` key | Primary API |
|---------------|------------|---------------------|-------------|
| Executive Dashboard | `/reports` or `?section=executive` | `executive` | `GET /reports/summary` (subset) |
| Recruitment Analytics | `?section=recruitment` | `recruitment` | `summary.pipelineFunnel` + `candidates.sources` |
| Client Analytics | `?section=clients` | `clients` | `summary.jobsClients` + client dataset |
| Candidate Analytics | `?section=candidates` | `candidates` | `summary.candidates` |
| Interview Analytics | `?section=interviews` | `interviews` | `summary.interviews` |
| Placement Analytics | `?section=placements` | `placements` | `summary.placementsRevenue` + placements dataset |
| Revenue Analytics | `?section=revenue` | `revenue` | `summary.placementsRevenue` |
| Team Analytics | `?section=team` | `team` | `summary.teamPerformance` |
| Activity Analytics | `?section=activity` | `activity` | `summary.activityProductivity` |
| Raw Data Explorer | `?section=raw` | `raw` | `GET /reports/dataset/:entity` |

Use **one** `GET /reports/summary` on filter apply; lazy-load `tab-detail` / `dataset` only when a section needs a preview table.

---

## 3. Executive Dashboard (homepage)

**Default when user opens Reports.** This is the **Executive Dashboard** — not a generic “overview tab.”

### 3.1 KPI row (5 cards)

```
┌──────┬──────┬──────┬──────┬──────┐
│ Jobs │ Cand │ Intv │ Place│ Rev  │
└──────┴──────┴──────┴──────┴──────┘
```

| Card | Metric | Backend field |
|------|--------|---------------|
| Jobs | Open jobs | `recruitmentPerformance.kpis.totalOpenJobs` |
| Cand | Active candidates | `recruitmentPerformance.kpis.activeCandidates` |
| Intv | Interviews | `recruitmentPerformance.kpis.interviews` |
| Place | Placements | `recruitmentPerformance.kpis.placements` |
| Rev | Total revenue | `placementsRevenue.kpis.totalRevenue` |

Also show **Conversion %** as a sixth mini-KPI or subtitle on Placements card: `recruitmentPerformance.kpis.conversionPct`.

**Click behavior:** drill to Raw Data or the matching sidebar section with filters preserved.

### 3.2 Charts & tables (below KPIs)

| Block | Content |
|-------|---------|
| **Recruitment trend** | Line chart: open jobs, candidates, interviews, placements over time — `recruitmentPerformance.trend` |
| **Recruitment funnel** | Vertical funnel: Applied → … → Joined — `pipelineFunnel.funnel` |
| **Top recruiters** | Top 5–8 from `teamPerformance.leaderboard` (placements, interviews) |
| **Top clients** | `jobsClients.topClients` |
| **Top jobs** | `jobsClients.jobs` |
| **Recent activities** | Timeline (see §10 — **needs backend extension** or client-side `activities` dataset slice) |

### 3.3 Trend period toggle (on chart)

Quick switch on the trend graph only:

- **7d** / **30d** / **90d** → maps to `dateRange=last_7_days` | `last_30_days` | custom 90-day range

Global top bar date still wins for KPIs; chart toggle can optionally sync global filters.

### 3.4 Export

`GET /reports/summary/export/recruitment-performance/{csv|pdf|excel}`

---

## 4. Recruitment Analytics

**Most important ATS report** after the executive view.

### 4.1 Pipeline funnel

```
Applied
   ↓
Screened
   ↓
Shortlisted
   ↓
Interviewed
   ↓
Selected
   ↓
Joined
```

**Backend today** (`pipelineFunnel.funnel`): Applied, Screened, Interviewed, Offered, Joined.

| UI label | Map from backend |
|----------|------------------|
| Applied | `Applied` |
| Screened | `Screened` |
| Shortlisted | Map from stage distribution or add alias in service |
| Interviewed | `Interviewed` |
| Selected | `Offered` (rename in UI) |
| Joined | `Joined` |

**Build task:** Align stage names with tenant pipeline stages in `report.service.js` (read from `Stage` model), not hardcoded fallbacks only.

### 4.2 Conversion rates (between stages)

Show three percentages:

- Applied → Interviewed  
- Interviewed → Selected (Offered)  
- Selected → Joined  

**Compute on frontend** from funnel counts, or add `pipelineFunnel.conversions[]` in API.

### 4.3 Source performance

| Source | Candidates | Placements | Conversion % |
|--------|------------|------------|--------------|
| LinkedIn | … | … | … |
| Naukri | … | … | … |
| Indeed | … | … | … |
| Referral | … | … | … |
| Career Site | … | … | … |

**Backend today:** `candidates.sources` (counts only).

**Build task:** Extend summary with `sourcesWithPlacements` — group candidates + placements by `source`.

---

## 5. Client Analytics

### 5.1 Top clients table

| Client | Jobs | Placements | Revenue |
|--------|------|------------|---------|
| Client A | 12 | 4 | ₹… |
| Client B | 8 | 2 | ₹… |

**Backend today:** `jobsClients.topClients` (job volume only).

**Build task:** Join placements + revenue per `clientId` for full table.

### 5.2 Client health score (badges)

| Badge | Rule (suggested) |
|-------|------------------|
| 🟢 **Active** | Activity or placement in last 14 days |
| 🟡 **Slow** | Last activity 15–45 days ago |
| 🔴 **No activity** | No activity 45+ days |

**Build task:** New `clientHealth` array in summary or compute in frontend from `clients` dataset + `lastActivity`.

Very useful for managers — prioritize in Phase B.

---

## 6. Candidate Analytics

### 6.1 Breakdowns

| Chart / table | Data |
|---------------|------|
| By source | `candidates.sources` ✅ |
| By location | **Build:** group `candidate.location` in service |
| By skills | `candidates.skills` ✅ (top 8) |
| By recruiter | **Build:** group by `assignedToId` |

### 6.2 Skill demand (horizontal bars)

```
React     ████████████████ 150
Node      ██████████████   120
Java      ████████████      95
AWS       ██████████        85
```

**Backend today:** `candidates.skills` with `count` + `percentage` ✅

---

## 7. Interview Analytics

### 7.1 Interview funnel

| Stage | Source |
|-------|--------|
| Scheduled | Count by `status` |
| Completed | `COMPLETED`, `FEEDBACK_SUBMITTED` |
| Rescheduled | status = rescheduled |
| Cancelled | status = cancelled |
| No show | status = no_show |

**Backend today:** `interviews.trend` (scheduled vs completed over time).

**Build task:** Add `interviews.funnel` status breakdown in `getReportsSummary`.

### 7.2 Pending feedback by recruiter

| Recruiter | Pending |
|-----------|---------|
| John | 12 |
| Sarah | 8 |

**Backend today:** `interviews.feedbackPending` ✅

---

## 8. Placement Analytics

### 8.1 Placement leaderboard

| Recruiter | Placements |
|-----------|------------|
| John | 15 |
| Sarah | 12 |
| David | 10 |

**Backend today:** `teamPerformance.leaderboard` sorted by placements ✅ (reuse here).

### 8.2 Joining status

| Status | Count |
|--------|-------|
| Offered | … |
| Accepted | … |
| Joined | … |
| Rejected | … |

**Build task:** Aggregate `Placement.status` in summary → `placements.joiningStatus`.

---

## 9. Revenue Analytics

For management / finance view.

### 9.1 Revenue KPIs

| KPI | Backend |
|-----|---------|
| Total revenue | `placementsRevenue.kpis.totalRevenue` ✅ |
| Avg placement fee | `placementsRevenue.kpis.avgBilling` ✅ |
| Commission paid | **Build:** sum from `BillingRecord` where paid |
| Outstanding payment | **Build:** sum pending billing |

### 9.2 Revenue trend

Monthly line chart — `placementsRevenue.trend` ✅

### 9.3 Revenue by client

| Client | Revenue |
|--------|---------|
| Client A | … |
| Client B | … |

**Build task:** `placementsRevenue.byClient[]` — group placements by `clientId`.

---

## 10. Team Analytics

### 10.1 Recruiter performance table

| Recruiter | Candidates added | Interviews | Placements | Revenue | Tasks completed |
|-----------|------------------|------------|------------|---------|-----------------|
| … | … | … | … | … | … |

**Backend today** (`teamPerformance.leaderboard`): jobs, submissions, interviews, placements.

**Build task:** Add `candidatesAdded`, `revenue`, `tasksCompleted` per recruiter.

### 10.2 Productivity score (managers love this)

**Formula:**

```
Score = 40% Placements
      + 25% Interviews
      + 20% Candidates added
      + 15% Activities logged
```

Normalize each metric 0–100 within the filtered team, then weighted sum.

Display:

```
John   95/100
Sarah  88/100
David  80/100
```

**Build task:** Compute in frontend from leaderboard + activity KPIs, or add `teamPerformance.productivity[]` in API.

---

## 11. Activity Analytics

Uses **Activity** logs + **Tasks**.

### 11.1 KPI row

| KPI | Backend |
|-----|---------|
| Calls made | `activityProductivity.kpis.callsMade` ✅ |
| Emails sent | `activityProductivity.kpis.emailsSent` ✅ |
| Tasks completed | `activityProductivity.kpis.tasksCompleted` ✅ |
| Notes added | **Build:** classify activity type `NOTE` |
| Meetings conducted | **Build:** classify activity type `MEETING` |

### 11.2 Activity timeline

```
09:00  Call with Client A
10:00  Candidate Added — Rahul Sharma
11:00  Interview Scheduled — Frontend Dev
```

**Build task:** `GET /reports/activity-feed?limit=20` or use `dataset/activities` sorted by `createdAt` desc.

### 11.3 Activity trend chart

`activityProductivity.trend` — calls, emails, tasks over time ✅

---

## 12. Raw Data Explorer (most powerful page)

Power users and exports live here. Answers question **#4** directly.

### 12.1 Entity picker

```
Entity ▼
  Candidates
  Jobs
  Clients
  Interviews
  Placements
  Leads
  Activities
  Tasks
  Team
  AI Matches
  AI Applied Matches
```

`GET /reports/dataset/:entity?{filters}`

### 12.2 Dynamic filters (critical UX rule)

**Do not show all filters at once.** Show filters based on selected entity:

| Entity selected | Show filters |
|-----------------|--------------|
| **Candidates** | Status, Source, Recruiter, Location, Skills (search) |
| **Jobs** | Status, Department, Location, Client, Type |
| **Clients** | Status, Industry, Recruiter |
| **Interviews** | Status, Client, Job, Recruiter |
| **Placements** | Status, Client, Job, Recruiter |
| **Leads** | Status, Source, Recruiter |
| **Activities** | Type, Recruiter, Date (inherits global) |

Implement `ENTITY_FILTER_CONFIG` in `reports-filters.tsx` — render only keys for active entity.

### 12.3 Table + export

- Paginated or virtualized table (all columns from `reportModuleFormats.js`)
- Search → `search=` query param
- **Export CSV / Excel / PDF** → `GET /reports/export/:entity/:format`
- Column picker (optional): `columns=` param

### 12.4 Full export column reference

Same as list pages — see **Appendix A** at end of this doc.

---

## 13. Saved reports (“My Reports”)

**Feature most ATS systems miss — we already have the API.**

### 13.1 Prisma model

```prisma
model Report {
  id            String
  name          String      // "Monthly Revenue"
  type          ReportType  // maps to sidebar section
  filters       Json?       // full FiltersState snapshot
  generatedById String
  scheduledAt   DateTime?   // future: email schedule
}
```

### 13.2 UX

1. User sets filters on any section → **Save report** → name + star.
2. Sidebar **My Reports** lists saved items.
3. Click → restore `filters` + navigate to `type` section.
4. Edit / delete → `PATCH` / `DELETE /reports/:id`

### 13.3 Starter templates (seed or defaults)

| Name | Section | Default filters |
|------|---------|-----------------|
| Monthly Revenue | Revenue | `dateRange=this_month` |
| Recruiter Performance | Team | `dateRange=last_30_days` |
| Client Placements | Clients | `entities=placements,clients` |
| Interview Pipeline | Interviews | `interviewStatus=SCHEDULED` |

**Permissions:** `reports_create` to save; `reports_read` to run.

---

## 14. Backend readiness matrix

| Feature | Status | Notes |
|---------|--------|-------|
| Executive KPIs + trend | ✅ Ready | `recruitmentPerformance` |
| Pipeline funnel | ✅ Mostly | Map Offered → “Selected” in UI |
| Top jobs / clients (basic) | ✅ Ready | `jobsClients` |
| Source breakdown | ✅ Ready | counts only |
| Skills demand | ✅ Ready | `candidates.skills` |
| Interview trend + pending feedback | ✅ Ready | `interviews` |
| Revenue KPIs + trend | ✅ Ready | `placementsRevenue` |
| Team leaderboard | ✅ Ready | jobs, submissions, interviews, placements |
| Activity KPIs + trend | ✅ Ready | calls, emails, tasks |
| Raw dataset + export | ✅ Ready | all entities |
| Filter options API | ✅ Ready | `/filter-options` |
| Saved reports CRUD | ✅ Ready | `/reports` POST/GET |
| Source → placement conversion | 🔧 Build | extend `getReportsSummary` |
| Client revenue column | 🔧 Build | join placements |
| Client health badges | 🔧 Build | activity recency rules |
| Interview status funnel | 🔧 Build | group by status |
| Joining status breakdown | 🔧 Build | placement statuses |
| Revenue by client | 🔧 Build | aggregate placements |
| Commission / outstanding | 🔧 Build | billing records |
| Productivity score | 🔧 Build | frontend or API |
| Activity timeline feed | 🔧 Build | recent activities endpoint |
| Candidate by location/recruiter | 🔧 Build | extra groupBy |
| Pipeline stages from tenant | 🔧 Build | read `Stage` model |

---

## 15. Implementation phases

### Phase 1 — Shell + Executive Dashboard (2–3 days)

**Goal:** Sidebar + top bar + homepage answering Q1.

Files:

- `frontphase2/src/app/reports/page.tsx` — layout shell
- `frontphase2/src/app/reports/ReportsSidebar.tsx` — new
- `frontphase2/src/app/reports/sections/ExecutiveDashboard.tsx` — new
- Reuse `reports-filters.tsx` — split `ReportsTopBar` + `ReportsMoreFilters`

Tasks:

1. Sidebar navigation with `section` query param.
2. Top bar: date + client + job + recruiter + More Filters (collapsed).
3. Fetch `/reports/summary` + `/reports/filter-options` on Apply.
4. Executive Dashboard: 5 KPI cards + trend + funnel + top tables.
5. Section export button.

### Phase 2 — Analytics sections (3–4 days)

One component per sidebar item under `sections/`:

- `RecruitmentAnalytics.tsx`
- `ClientAnalytics.tsx`
- `CandidateAnalytics.tsx`
- `InterviewAnalytics.tsx`
- `PlacementAnalytics.tsx`
- `RevenueAnalytics.tsx`
- `TeamAnalytics.tsx` (include productivity score — frontend calc OK for v1)
- `ActivityAnalytics.tsx`

Wire existing summary keys first; stub cards marked “Coming soon” only where API missing.

### Phase 3 — Raw Data Explorer (2 days)

- `RawDataExplorer.tsx`
- `ENTITY_FILTER_CONFIG` dynamic filters
- `fetchReportDataset` + server export
- “Open in Raw Data” links from KPI clicks

### Phase 4 — Saved reports (1–2 days)

- `MyReportsPanel.tsx` in sidebar
- `POST /reports` on save
- `GET /reports` list for current user
- Restore filters on click

### Phase 5 — Backend extensions (parallel, 2–3 days)

Extend `getReportsSummary` in `report.service.js` for gaps in §14.

---

## 16. Frontend state model

```ts
type ReportSection =
  | 'executive'
  | 'recruitment'
  | 'clients'
  | 'candidates'
  | 'interviews'
  | 'placements'
  | 'revenue'
  | 'team'
  | 'activity'
  | 'raw';

const [section, setSection] = useState<ReportSection>('executive');
const [filters, setFilters] = useState<FiltersState>(DEFAULT_REPORT_FILTERS);
const [draftFilters, setDraftFilters] = useState<FiltersState>(DEFAULT_REPORT_FILTERS);
const [summary, setSummary] = useState<ReportsSummary | null>(null);
const [rawEntity, setRawEntity] = useState<ReportEntityKey>('candidates');
```

Sync `section` ↔ URL: `useSearchParams().set('section', section)`.

---

## 17. Design rules (what NOT to do)

| Avoid | Do instead |
|-------|------------|
| Horizontal tabs for 10 reports | Left sidebar |
| 20 filters always visible | Top 3 scopes + More Filters |
| Charts with no drill-down | Click → Raw Data with filters |
| Different export columns than list pages | Use `reportModuleFormats.js` |
| Loading all datasets on every visit | Summary once; dataset lazy per section |
| Building new APIs before using `/summary` | Wire UI to existing keys first |

---

## 18. Success criteria

Reports v2 is complete when:

1. Opening `/reports` shows **Executive Dashboard** with 5 KPIs + trend + funnel + top rankings.
2. Sidebar switches between **10 sections** without full page reload.
3. User answers **“who is best?”** in Team in under 10 seconds.
4. User answers **“which client/job pays?”** in Client + Placement + Revenue.
5. **Raw Data** exports full columns for any entity with **entity-specific filters only**.
6. User saves **Monthly Revenue** (or any preset) under **My Reports** and one-click restores it.
7. Page feels like a lightweight BI tool — not a form with 30 dropdowns.

---

## 19. Key files (Phase 2)

| Purpose | Path |
|---------|------|
| Reports page (current, minimal) | `frontphase2/src/app/reports/page.tsx` |
| Filters + toolbar | `frontphase2/src/app/reports/reports-filters.tsx` |
| Dataset helpers | `frontphase2/src/lib/reportTabExports.ts` |
| RBAC layout | `frontphase2/src/app/reports/layout.tsx` |
| Report routes | `backendphase2/src/modules/report/report.routes.js` |
| Analytics engine | `backendphase2/src/modules/report/report.service.js` |
| Export columns | `backendphase2/src/modules/report/reportModuleFormats.js` |
| Saved report model | `backendphase2/prisma/schema.prisma` → `Report` |

---

## 20. Quick start

```bash
cd hrayntra_aws/backendphase2 && pnpm dev   # :5001
cd hrayntra_aws/frontphase2 && pnpm dev    # :3001
```

Open `http://localhost:3001/reports` as a user with `reports_read` (+ `export_data` for downloads).

**First coding task:** Create `ReportsSidebar.tsx` + refactor `page.tsx` into shell with `section=executive` and wire full `/reports/summary` response.

---

## Appendix A — Export columns (raw data)

**Jobs:** title, client, location, jobLocationType, status, openings, applied, interviewed, offered, joined, owner, createdDate, hot, aiMatch, noCandidates, slaRisk

**Clients:** name, industry, location, contactPerson, email, phone, companySize, leadStatus, priority, owner, openJobs, placements, lastActivity

**Candidates:** name, email, phone, designation, company, experience, location, stage, owner, source, skills, assignedJobs, salaries, noticePeriod, hotlist, rating

**Interviews:** candidateName, jobTitle, client, round, type, mode, date, status, feedbackStatus, panel, meetingLink, notes

**Placements:** Placement ID, Candidate, Company, Job, Recruiter, Salary, Placement Fee, Commission %, Revenue, Offer Date, Joining Date, Status, Payment Status

---

## Appendix B — API reference

| Method | Path |
|--------|------|
| GET | `/reports/filter-options` |
| GET | `/reports/summary?{filters}` |
| GET | `/reports/tab-detail/:tab?{filters}` |
| GET | `/reports/dataset/:entity?{filters}` |
| GET | `/reports/summary/export/:tab/:format` |
| GET | `/reports/export/:entity/:format` |
| GET/POST/PATCH/DELETE | `/reports`, `/reports/:id` |

---

*Document version: 2026-05-28 — Executive Dashboard + sidebar architecture (Power BI / HubSpot / Zoho Recruit inspired, simplified for 4 core questions).*

---

## Implementation status (Phase 2 frontend)

**Built in `frontphase2/src/app/reports/`:**

| Item | Status |
|------|--------|
| Left sidebar (10 sections + My Reports) | ✅ |
| Mobile section dropdown | ✅ |
| Top bar filters (date, client, recruiter, More Filters) | ✅ |
| Executive Dashboard (KPIs, trend, funnel, top tables) | ✅ |
| Recruitment / Client / Candidate / Interview / Placement / Revenue / Team / Activity sections | ✅ |
| Raw Data Explorer with entity-specific filters | ✅ |
| Save report (POST `/reports`) + load from sidebar | ✅ |
| Section CSV/PDF export | ✅ |
| Productivity score (frontend formula) | ✅ |
| Client health badges (job-volume heuristic) | ✅ |

**Still backend-dependent (shows placeholder or partial data):**

- Revenue by client, outstanding payments, commission paid
- Source → placement conversion column
- Full interview status funnel (scheduled / cancelled / no-show)
- Joining status breakdown on placements
- Recent activity timeline on Executive Dashboard
