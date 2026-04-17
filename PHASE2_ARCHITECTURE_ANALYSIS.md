# Phase 2 Architecture Analysis - AI-Powered Recruitment & CRM System

## Scope
This document defines implementation-ready, module-wise architecture for Phase 2 across backend (`/api/v1/*`) and frontend pages in `frontphase2`.

---

## MODULE NAME: Leads

### 1. Pages
- List Page: `GET /api/v1/leads` with filters, sort, pagination, bulk actions.
- Create Page/Drawer: create single lead.
- Edit Page/Drawer: update lead lifecycle data.
- Detail View Page: lead profile, activities, notes, files, assignment.
- Import Preview Page: CSV preview and validation.
- Import Execute Page: bulk import confirmation and mapping.
- Conversion Page: convert lead to client/job/candidate entities.
- AI Automation Page: lead enrichment, dedupe recommendation, quality score.

### 2. CRUD
- CREATE
  - Single lead record.
  - Lead notes and files.
  - Bulk imported leads.
- READ
  - Lead list with status/source/owner/priority filters.
  - Lead detail with activity timeline.
  - Related conversion targets.
- UPDATE
  - Contact/company details.
  - Ownership, status, priority, follow-up date, tags.
  - Qualification fields and conversion flags.
- DELETE
  - Soft delete recommended for compliance.
  - Hard delete only for admin with audit log.

### 3. Data Model
```json
{
  "Lead": {
    "id": "string (cuid, pk)",
    "leadCode": "string, unique",
    "type": "enum(Company|Individual|Referral), required",
    "source": "enum(Website|LinkedIn|Email|Referral|Campaign), required",
    "status": "enum(New|Contacted|Qualified|Converted|Lost), indexed",
    "priority": "enum(High|Medium|Low)",
    "companyName": "string",
    "contactName": "string, required",
    "email": "string, unique nullable",
    "phone": "string",
    "designation": "string",
    "industry": "string",
    "city": "string",
    "notes": "string",
    "assignedTo": "string (fk -> User.id), indexed",
    "nextFollowUpAt": "date",
    "lastContactedAt": "date",
    "convertedToClientId": "string (fk -> Client.id)",
    "convertedToJobId": "string (fk -> Job.id)",
    "convertedToCandidateId": "string (fk -> Candidate.id)",
    "createdAt": "date",
    "updatedAt": "date"
  }
}
```
- Relationships
  - `Lead 1:N LeadNote`
  - `Lead 1:N LeadFile`
  - `Lead N:1 User (assignedTo)`
  - `Lead 0..1 -> Client/Job/Candidate` via conversion fields
- Indexing suggestions
  - `(status, assignedTo, nextFollowUpAt)`
  - `(source, createdAt)`
  - trigram/fulltext on `companyName`, `contactName`, `email`

### 4. APIs
- `POST /api/v1/leads`
  - Body: contact, source, type, assignment, qualification.
  - `201 Created`: `{ success: true, data: Lead }`
  - `400`: validation error, `409`: duplicate.
- `GET /api/v1/leads`
  - Query: `page,limit,search,status,source,assignedTo,startDate,endDate`.
  - `200 OK`: paginated list.
- `GET /api/v1/leads/:id`
  - `200 OK`: lead detail + relations.
  - `404 Not Found`.
- `PATCH /api/v1/leads/:id`
  - Body: partial mutable fields.
  - `200 OK` updated object.
- `DELETE /api/v1/leads/:id`
  - `200/204` success, `403` unauthorized.
- `POST /api/v1/leads/import/preview`
  - Body: mapped CSV payload.
  - `200`: row-level validation summary.
- `POST /api/v1/leads/import`
  - `202 Accepted`: async import job id.
- `POST /api/v1/leads/:id/convert`
  - Body: conversion target (`client/job/candidate`) + mapping.
  - `200`: created entity refs.
- `GET /api/v1/leads/:id/activities`
- `POST|GET|PATCH|DELETE /api/v1/leads/:leadId/notes/*`

### 5. AI Features
- Lead deduplication (semantic + exact match).
- Lead quality score (fit, intent, response probability).
- Auto-enrich from domain/email/company signals.
- Suggested next action and follow-up date.
- Auto-generated lead summary and call prep notes.

### 5.1 ARIA Leads Assistant (Implemented in Phase 2 Codebase)
- Endpoint: `POST /api/v1/ai/aria`
- Backend files:
  - `backendphase2/src/ai/prompts/ariaLeadsSystemPrompt.js`
  - `backendphase2/src/config/openai.js`
  - `backendphase2/src/ai/memory/ariaMemory.js`
  - `backendphase2/src/controllers/ariaController.js`
  - `backendphase2/src/services/ariaService.js`
  - `backendphase2/src/utils/csvParser.js`
  - `backendphase2/src/routes/ariaRoutes.js`
- Frontend files:
  - `frontphase2/src/components/AriaChat.js`
  - `frontphase2/src/app/leads/page.tsx` (UI action handler integration)
  - `frontphase2/src/lib/api.ts` (ARIA API client)
- Supported intents:
  - `CREATE_LEAD`
  - `BULK_CREATE_LEADS`
  - `FETCH_LEADS`
  - `UPDATE_LEAD`
  - `DELETE_LEAD`
  - `UPLOAD_FILE_LEADS`
  - `UNDO_LAST_ACTION`
  - `SEARCH_LEADS`
  - `FILTER_LEADS`
- Guarantees:
  - Multi-tenant scope by `orgId` for ARIA lead operations.
  - In-memory action memory (last 5 actions per user).
  - Undo for create, bulk create, update, and soft delete.
  - UI payload contract for table mutations: `INSERT_ROW`, `REPLACE_TABLE`, `UPDATE_ROW`, `DELETE_ROW`, `BULK_INSERT`.

### 6. Roles
- Admin: full CRUD/import/convert/delete.
- Recruiter: create/read/update assigned leads, convert with permission.
- Client: no direct lead CRUD.
- Candidate: no access.

### 7. Workflow
- Capture lead manually/import/API.
- AI enrich + score.
- Qualify lead and schedule follow-up.
- Convert qualified lead to client or job request.
- Log activity for SLA and conversion tracking.

### 8. Validations
- Email unique when provided.
- Mandatory `contactName`, `source`, `type`.
- Cannot convert same lead twice to same entity type.
- Lost/Converted leads require closure reason.
- Assignment changes must create activity log.

### 9. Scaling
- Cursor pagination on list APIs.
- Queue-based bulk import and enrichment jobs.
- Search index (OpenSearch/PG trigram).
- Redis cache for lead list filters and metrics.
- Event bus for conversion events to Clients/Jobs.

### 10. Metrics
- Lead-to-client conversion rate.
- Lead response time (first touch SLA).
- Source-wise conversion quality.
- Follow-up adherence rate.
- Recruiter conversion productivity.

---

## MODULE NAME: Clients

### 1. Pages
- Client List Page.
- Client Create Page/Drawer.
- Client Edit Page/Drawer.
- Client Detail Page (company, contacts, jobs, placements, notes, files).
- Client Metrics Dashboard.
- Client Import Preview + Import Execute.
- AI Insights Page (account health, risk, upsell).

### 2. CRUD
- CREATE
  - Client account from lead conversion or direct create.
  - Client notes/files/meetings.
- READ
  - Client list with status, account owner, industry.
  - Client detail with linked jobs and placements.
- UPDATE
  - Company profile, billing terms, SLA, status.
  - Ownership and engagement metadata.
- DELETE
  - Soft delete inactive clients without active jobs.

### 3. Data Model
```json
{
  "Client": {
    "id": "string (cuid, pk)",
    "clientCode": "string, unique",
    "companyName": "string, required, indexed",
    "website": "string",
    "industry": "string, indexed",
    "size": "string",
    "email": "string",
    "phone": "string",
    "city": "string",
    "country": "string",
    "status": "enum(ACTIVE|PROSPECT|ON_HOLD|INACTIVE), indexed",
    "accountManagerId": "string (fk -> User.id), indexed",
    "billingCycle": "string",
    "paymentTerms": "string",
    "contractStartDate": "date",
    "contractEndDate": "date",
    "notes": "string",
    "createdFromLeadId": "string (fk -> Lead.id)",
    "createdAt": "date",
    "updatedAt": "date"
  }
}
```
- Relationships
  - `Client 1:N Job`
  - `Client 1:N Placement`
  - `Client 1:N ClientNote`
  - `Client 1:N ClientFile`
  - `Client 1:N ScheduledMeeting`
- Indexing suggestions
  - `(status, accountManagerId)`
  - `(industry, createdAt)`
  - unique on normalized `companyName`

### 4. APIs
- `POST /api/v1/clients`
- `GET /api/v1/clients`
- `GET /api/v1/clients/:id`
- `PATCH /api/v1/clients/:id`
- `DELETE /api/v1/clients/:id`
- `GET /api/v1/clients/metrics`
- `POST /api/v1/clients/import/preview`
- `POST /api/v1/clients/import`
- `GET /api/v1/clients/:clientId/activities`
- `POST|GET|PATCH|DELETE /api/v1/clients/:clientId/notes/*`
- `POST|GET|DELETE /api/v1/clients/:clientId/files/*`
- Response pattern
  - Success: `{ success: true, data, meta? }`
  - Error: `{ success: false, message, code, errors? }`

### 5. AI Features
- Auto-enrich company profile from domain.
- Account health score (job closure velocity, feedback latency).
- Churn risk prediction for client accounts.
- Similar-client strategy recommendation.
- AI-generated meeting briefs and follow-up emails.

### 6. Roles
- Admin: full CRUD + import + delete.
- Recruiter: read clients, update assigned engagement fields.
- Client: self-view and own job/interview/shortlist actions.
- Candidate: no direct client access.

### 7. Workflow
- Lead converted to client.
- Client onboarding profile completed.
- Client creates jobs and interview panel access.
- Placements/billing tied to client account.

### 8. Validations
- `companyName` unique per tenant.
- Client cannot be deleted with active jobs/interviews.
- Contract end must be after contract start.
- Account manager required for ACTIVE clients.

### 9. Scaling
- Cache client metrics and health scores.
- Async enrichment jobs in worker queues.
- Read replicas for client-heavy analytics queries.
- Materialized views for account performance.

### 10. Metrics
- Client retention/churn rate.
- Jobs per client and closure rate.
- Revenue per client.
- Avg feedback turnaround time.
- Account manager performance.

---

## MODULE NAME: Jobs

### 1. Pages
- Job List Page with filters and pipeline counts.
- Job Create Page/Drawer.
- Job Edit Page/Drawer.
- Job Detail Page (JD, pipeline, candidates, interviews, notes/files).
- Public Feed Page (`/api/v1/jobs/public-feed`).
- Job Metrics Dashboard.
- AI Matching Page (recommended candidates and score reasons).

### 2. CRUD
- CREATE
  - Job under a client with JD, skills, compensation, openings.
- READ
  - Job list/detail, status, assigned recruiters.
  - Candidate pipeline and match scores.
- UPDATE
  - JD fields, status, assignment, stages, SLA.
- DELETE
  - Restricted if dependencies exist (interviews/placements).

### 3. Data Model
```json
{
  "Job": {
    "id": "string (cuid, pk)",
    "jobCode": "string, unique",
    "title": "string, required, indexed",
    "description": "string, required",
    "skills": "string[]",
    "location": "string",
    "employmentType": "string",
    "experienceMin": "number",
    "experienceMax": "number",
    "salaryMin": "number",
    "salaryMax": "number",
    "openings": "number, required",
    "status": "string, indexed",
    "priority": "enum(High|Medium|Low)",
    "clientId": "string (fk -> Client.id), required, indexed",
    "assignedRecruiterId": "string (fk -> User.id), indexed",
    "applicationDeadline": "date",
    "isPublic": "boolean",
    "createdAt": "date",
    "updatedAt": "date"
  }
}
```
- Relationships
  - `Job N:1 Client`
  - `Job 1:N Interview`
  - `Job 1:N Placement`
  - `Job 1:N Match`
  - `Job 1:N PipelineStage`
  - `Job 1:N JobNote/JobFile`
- Indexing suggestions
  - `(clientId, status, createdAt)`
  - GIN on `skills`
  - `(assignedRecruiterId, status)`

### 4. APIs
- `GET /api/v1/jobs/public-feed`
- `POST /api/v1/jobs`
- `GET /api/v1/jobs`
- `GET /api/v1/jobs/:id`
- `PATCH /api/v1/jobs/:id`
- `DELETE /api/v1/jobs/:id`
- `GET /api/v1/jobs/metrics`
- `POST|GET|PATCH|DELETE /api/v1/jobs/:jobId/notes/*`
- `POST|GET|DELETE /api/v1/jobs/:jobId/files/*`
- Status codes
  - `201` created, `200` success, `204` delete, `400` validation, `404` missing, `409` conflict.

### 5. AI Features
- JD parser and quality scoring.
- Job-to-candidate matching with explainable score.
- Auto-shortlist generation.
- Compensation benchmarking recommendations.
- Predicted time-to-fill and risk alerts.

### 6. Roles
- Admin: full CRUD.
- Recruiter: CRUD on assigned jobs, pipeline ops.
- Client: create/view own jobs, shortlist decisioning.
- Candidate: view public/assigned jobs and apply.

### 7. Workflow
- Client creates job.
- AI parses JD and creates matching criteria.
- Candidates are matched and moved through stages.
- Interviews scheduled, then placement created.

### 8. Validations
- Job must belong to existing client.
- `openings > 0`.
- `salaryMin <= salaryMax`.
- Cannot close job with pending interviews unless override.
- Cannot delete job with active placement process.

### 9. Scaling
- Job feed cached with invalidation by status updates.
- Match scoring via async queue (batch + incremental).
- Partition heavy match/interview tables by month/tenant.
- Elastic search for job discovery and facet filters.

### 10. Metrics
- Job fill rate.
- Time-to-fill.
- Source of hire per job.
- Pipeline drop-off per stage.
- Recruiter response SLA per job.

---

## MODULE NAME: Candidates

### 1. Pages
- Candidate List Page.
- Candidate Create Page/Drawer.
- Candidate Edit Page/Drawer.
- Candidate Detail Page (profile, resume, applications, notes, interviews).
- Candidate Pipeline Board.
- Candidate Stats Page (`/api/v1/candidates/stats`).
- AI Resume Intelligence Page.

### 2. CRUD
- CREATE
  - Candidate profile, resume, skills, preferences.
  - Candidate notes/tags/files.
- READ
  - Candidate list/detail with stage/status.
  - Assigned jobs, interview history, match scores.
- UPDATE
  - Contact/profile fields, skills, expected salary, stage.
- DELETE
  - Soft delete with retention policy.

### 3. Data Model
```json
{
  "Candidate": {
    "id": "string (cuid, pk)",
    "candidateCode": "string, unique",
    "firstName": "string, required",
    "lastName": "string",
    "email": "string, required, unique, indexed",
    "phone": "string, required, unique",
    "currentCity": "string",
    "currentCompany": "string",
    "totalExperienceYears": "number",
    "skills": "string[]",
    "resumeUrl": "string",
    "noticePeriodDays": "number",
    "currentSalary": "number",
    "expectedSalary": "number",
    "status": "enum(NEW|ACTIVE|PLACED|INACTIVE|BLACKLISTED), indexed",
    "stage": "string, indexed",
    "source": "string",
    "assignedRecruiterId": "string (fk -> User.id), indexed",
    "createdAt": "date",
    "updatedAt": "date"
  }
}
```
- Relationships
  - `Candidate 1:N Interview`
  - `Candidate 1:N Placement`
  - `Candidate 1:N Match`
  - `Candidate 1:N PipelineEntry`
  - `Candidate 1:N CandidateFile`
- Indexing suggestions
  - `(status, stage, assignedRecruiterId)`
  - GIN on `skills`
  - unique normalized email + phone

### 4. APIs
- `POST /api/v1/candidates`
- `GET /api/v1/candidates`
- `GET /api/v1/candidates/:id`
- `PATCH /api/v1/candidates/:id`
- `DELETE /api/v1/candidates/:id`
- `GET /api/v1/candidates/stats`
- `POST /api/v1/candidates/:id/notes`
- `POST /api/v1/candidates/:id/tags`
- `PATCH /api/v1/candidates/:id/pipeline`
- `PATCH /api/v1/candidates/:id/reject`
- `POST /api/v1/candidates/:id/schedule-interview`
- `PATCH /api/v1/candidates/:id/interviews/:interviewId`
- `POST /api/v1/candidates/bulk-action`
- Request body examples
  - Create: profile + source + recruiter assignment.
  - Pipeline update: `{ jobId, stage, reason? }`

### 5. AI Features
- Resume parser to structured profile.
- Skill normalization and taxonomy mapping.
- Job fit score + explainability.
- Duplicate profile detection.
- Attrition/offer-drop probability prediction.

### 6. Roles
- Admin: full CRUD/export/delete.
- Recruiter: full CRUD for assigned candidates and pipeline transitions.
- Client: view shortlisted candidates for own jobs, provide feedback.
- Candidate: self-profile edit, job applications, interview availability.

### 7. Workflow
- Candidate created from application/import/referral.
- Resume parsed and enriched.
- Matched to jobs and added to pipeline.
- Interview lifecycle updates candidate stage.
- Final selection creates placement.

### 8. Validations
- Email/phone uniqueness with normalization.
- Candidate cannot apply twice to same job.
- Stage transition must follow allowed state machine.
- BLACKLISTED candidates blocked from interview scheduling.
- Resume file type/size constraints.

### 9. Scaling
- Async resume parsing workers.
- Batched match scoring and cache top-N recommendations.
- Read-optimized denormalized candidate search index.
- Bulk APIs with idempotency keys.

### 10. Metrics
- Candidate sourcing channel performance.
- Interview-to-offer ratio.
- Candidate response time.
- Offer acceptance rate.
- Candidate NPS/experience score.

---

## MODULE NAME: Interviews

### 1. Pages
- Interview List Page.
- Interview Calendar Page (`/calendar`).
- Schedule Interview Drawer.
- Interview Detail Page.
- Feedback Submission Page.
- Panel Management Page.
- Interview KPIs Page (`/kpis`).

### 2. CRUD
- CREATE
  - Interview linked to candidate, job, client.
  - Panel assignments and meeting details.
  - Feedback entries and notes.
- READ
  - Interview schedule list/calendar.
  - Candidate/job/client context and feedback history.
- UPDATE
  - Reschedule, status transitions, panel updates.
  - Feedback updates before lock deadline.
- DELETE
  - Cancelled records retained for audit; hard delete admin only.

### 3. Data Model
```json
{
  "Interview": {
    "id": "string (cuid, pk)",
    "candidateId": "string (fk -> Candidate.id), required, indexed",
    "jobId": "string (fk -> Job.id), required, indexed",
    "clientId": "string (fk -> Client.id), indexed",
    "round": "number",
    "mode": "enum(virtual|onsite|phone)",
    "platform": "string",
    "scheduledAt": "date, required, indexed",
    "durationMinutes": "number",
    "timeZone": "string",
    "meetingLink": "string",
    "status": "enum(SCHEDULED|FEEDBACK_PENDING|COMPLETED|CANCELLED|NO_SHOW), indexed",
    "createdBy": "string (fk -> User.id)",
    "createdAt": "date",
    "updatedAt": "date"
  }
}
```
- Relationships
  - `Interview 1:N InterviewPanel`
  - `Interview 1:N InterviewFeedback`
  - `Interview 1:N InterviewNote`
  - `Interview 1:N InterviewActivityLog`
- Indexing suggestions
  - `(scheduledAt, status)`
  - `(candidateId, jobId, round)` unique optional

### 4. APIs
- `POST /api/v1/interviews`
- `GET /api/v1/interviews`
- `GET /api/v1/interviews/calendar`
- `GET /api/v1/interviews/kpis`
- `GET /api/v1/interviews/:id`
- `PATCH /api/v1/interviews/:id`
- `DELETE /api/v1/interviews/:id`
- `POST /api/v1/interviews/:id/reschedule`
- `POST /api/v1/interviews/:id/cancel`
- `POST /api/v1/interviews/:id/no-show`
- `POST /api/v1/interviews/:id/regenerate-link`
- `POST|GET|PATCH|DELETE /api/v1/interviews/:id/feedback*`
- `POST|GET|PATCH|DELETE /api/v1/interviews/:id/panel*`
- `POST|GET|PATCH|DELETE /api/v1/interviews/:id/notes*`

### 5. AI Features
- Smart slot recommendation using panel/candidate availability.
- Auto-generated interview questions from JD + candidate profile.
- Feedback summarization and sentiment scoring.
- Bias/risk flagging in feedback language.
- No-show risk prediction and reminder optimization.

### 6. Roles
- Admin: full control.
- Recruiter: schedule/reschedule/cancel, manage panel, submit feedback.
- Client: view and submit panel feedback for own jobs.
- Candidate: view schedule, confirm/reschedule request.

### 7. Workflow
- Candidate stage reaches interview-ready.
- Recruiter schedules interview with panel.
- Candidate + panel notified.
- Feedback captured and decision passed to pipeline.
- Selected candidates proceed to offer/placement.

### 8. Validations
- Interview cannot be scheduled in past.
- No overlapping interview for same candidate/time.
- Feedback required before moving to final decision stage.
- Status transitions enforce lifecycle (SCHEDULED -> COMPLETED/NO_SHOW/CANCELLED).

### 9. Scaling
- Calendar reads from denormalized schedule store.
- Notification queue for reminders and updates.
- ICS/Google/Outlook sync via webhook workers.
- Partition logs by month for activity table.

### 10. Metrics
- Interview show-up rate.
- Round-wise pass rate.
- Feedback submission SLA.
- Time from schedule to decision.
- Panel utilization.

---

## MODULE NAME: Placements

### 1. Pages
- Placement List Page.
- Placement Create Drawer.
- Placement Detail Page (`/placement/[id]`).
- Placement Update Drawer.
- Placement Status Actions (mark joined/failed/replacement).
- Placement Stats Page (`/stats`).
- Export Page (`/export`).

### 2. CRUD
- CREATE
  - Placement after successful interview/offer.
  - Billing, commission, documents records.
- READ
  - Placement list by status/client/recruiter.
  - Revenue and payout details.
- UPDATE
  - Offer/joining dates, compensation, status, billing state.
- DELETE
  - Restricted; usually archival only.

### 3. Data Model
```json
{
  "Placement": {
    "id": "string (cuid, pk)",
    "placementCode": "string, unique",
    "candidateId": "string (fk -> Candidate.id), required, indexed",
    "jobId": "string (fk -> Job.id), required, indexed",
    "clientId": "string (fk -> Client.id), required, indexed",
    "recruiterId": "string (fk -> User.id), indexed",
    "offerDate": "date",
    "joiningDate": "date",
    "ctcOffered": "number",
    "feePercent": "number",
    "feeAmount": "number",
    "status": "enum(PENDING|JOINED|FAILED|REPLACEMENT_REQUESTED), indexed",
    "replacementWindowDays": "number",
    "invoiceStatus": "string",
    "paymentStatus": "string",
    "createdAt": "date",
    "updatedAt": "date"
  }
}
```
- Relationships
  - `Placement N:1 Candidate/Job/Client/User`
  - `Placement 1:N PlacementBilling`
  - `Placement 1:N PlacementCommission`
  - `Placement 1:N PlacementDocument`
  - `Placement 1:N PlacementActivityLog`
- Indexing suggestions
  - `(status, joiningDate)`
  - `(clientId, status)`
  - `(recruiterId, createdAt)`

### 4. APIs
- `POST /api/v1/placements`
- `GET /api/v1/placements`
- `GET /api/v1/placements/:id`
- `PATCH /api/v1/placements/:id`
- `DELETE /api/v1/placements/:id`
- `GET /api/v1/placements/stats`
- `GET /api/v1/placements/export`
- `POST /api/v1/placements/:id/mark-joined`
- `POST /api/v1/placements/:id/mark-failed`
- `POST /api/v1/placements/:id/request-replacement`
- Response
  - Include linked candidate/job/client summary for UI cards.

### 5. AI Features
- Placement success probability scoring.
- Early attrition risk prediction.
- Compensation anomaly detection.
- Automated replacement candidate recommendation.
- Revenue forecast from active offers.

### 6. Roles
- Admin: full CRUD + financial controls.
- Recruiter: create/update placements for owned pipeline.
- Client: confirm joining/failure and replacement requests.
- Candidate: limited view of offer/joining milestones.

### 7. Workflow
- Interview result marked selected.
- Placement created from candidate-job pair.
- Billing and commission triggered.
- Joining confirmation updates status.
- Failure/replacement loops back to candidate pipeline.

### 8. Validations
- Placement allowed only after positive interview outcome.
- Only one active placement per candidate-job pair.
- `joiningDate >= offerDate`.
- Replacement allowed only inside replacement window.

### 9. Scaling
- Financial events via durable queue.
- Event-sourcing for status changes.
- Monthly partitioned billing tables.
- Cached stats endpoint with short TTL.

### 10. Metrics
- Placement success rate.
- Join ratio vs offers made.
- Revenue realized vs projected.
- Replacement rate.
- Recruiter billing contribution.

---

## MODULE NAME: Reports / Analytics

### 1. Pages
- Reports Dashboard Page (`/reports`).
- Summary Tab (cross-module KPIs).
- Dataset Explorer Page per entity.
- Report Builder Page (saved filters/templates).
- Report Detail Page.
- Export Center Page (CSV/XLSX/PDF).

### 2. CRUD
- CREATE
  - Saved report definitions and schedules.
- READ
  - Live summary, dataset tables, report outputs.
- UPDATE
  - Filters, columns, schedule, access scope.
- DELETE
  - Remove saved reports and schedules.

### 3. Data Model
```json
{
  "Report": {
    "id": "string (cuid, pk)",
    "name": "string, required",
    "type": "enum(RECRUITMENT_PERFORMANCE|PIPELINE_FUNNEL|JOBS_CLIENTS|CANDIDATES|INTERVIEWS|PLACEMENTS_REVENUE|CUSTOM), indexed",
    "filters": "object(json)",
    "columns": "array<string>",
    "groupBy": "array<string>",
    "schedule": "object(json)",
    "resultCache": "object(json)",
    "generatedBy": "string (fk -> User.id)",
    "lastRunAt": "date",
    "createdAt": "date",
    "updatedAt": "date"
  }
}
```
- Relationships
  - `Report N:1 User`
  - Optional relation to export/audit logs.
- Indexing suggestions
  - `(type, updatedAt)`
  - `(generatedBy, createdAt)`

### 4. APIs
- Summary/exports
  - `GET /api/v1/reports/summary`
  - `GET /api/v1/reports/summary/export/:tab/:format`
  - `GET /api/v1/reports/dataset/:entity`
  - `GET /api/v1/reports/export/:entity/:format`
- Saved reports CRUD
  - `POST /api/v1/reports`
  - `GET /api/v1/reports`
  - `GET /api/v1/reports/:id`
  - `PATCH /api/v1/reports/:id`
  - `DELETE /api/v1/reports/:id`
- Response standards
  - Paginated datasets return `{ data, meta: { page, limit, total } }`
  - Async exports return `202` with export job id.

### 5. AI Features
- Narrative insight generator for KPI changes.
- Forecasting (time-to-hire, expected closures, revenue).
- Anomaly detection on funnel leakage.
- Auto-generated recruiter/client performance recommendations.
- Natural-language-to-query assistant for dashboards.

### 6. Roles
- Admin: all reports including finance-sensitive data.
- Recruiter: team and self-performance reports.
- Client: only own jobs/interviews/shortlists placements snapshots.
- Candidate: no reporting access.

### 7. Workflow
- Modules emit events (lead, job, candidate, interview, placement).
- ETL/stream updates analytics store.
- Dashboard serves near-real-time summary.
- Scheduled reports delivered by email.

### 8. Validations
- Role scope filters enforced server-side.
- Report query timeout and row limits.
- Export formats validated.
- Cached data freshness SLA displayed.

### 9. Scaling
- OLTP + OLAP separation.
- Incremental materialized aggregates.
- Queue-driven export generation.
- Redis + CDN caching for heavy dashboards.
- Read replicas and partitioned analytics tables.

### 10. Metrics
- Lead conversion rate.
- Job fill rate.
- Candidate success rate.
- Time-to-hire.
- Interview pass-through ratio.
- Placement revenue and margin.
- Recruiter productivity score.
- Client satisfaction trend.

---

## Cross-Module Workflow Logic (Phase 2 Core)
- Lead -> Qualified -> Converted to Client.
- Client -> Creates Job.
- Candidate applies (Phase 1 frontend/backend) -> application ingested into Phase 2 as Candidate + Match/PipelineEntry.
- Candidate appears on Phase 2 Candidate page and linked Job page pipeline.
- Recruiter schedules interviews.
- Selected candidate converted to Placement.
- Placement status drives billing, commission, and reports.

## Global RBAC Matrix (Simplified)
- Admin: full access all modules.
- Recruiter: operational CRUD for leads/candidates/jobs/interviews/placements within scope.
- Client: scoped access to own jobs, candidate shortlists, interview feedback, placement confirmations.
- Candidate: profile, applications, interview schedule visibility.

## Global Business Rules
- Multi-tenant isolation by organization id on every table/query.
- Audit log for all create/update/delete/status actions.
- Idempotency key required for import and external application ingestion APIs.
- PII encryption at rest for candidate contact fields and documents.
- Webhook retries with DLQ for external integrations.

## Global Scalability Blueprint
- API layer: stateless pods behind load balancer.
- DB: PostgreSQL with read replicas, connection pooling, partitioning.
- Cache: Redis for sessions, rate limiting, hot queries.
- Queue: BullMQ/SQS for parsing, matching, exports, notifications.
- Workers: autoscaled consumers for AI and scheduled jobs.
- Observability: centralized logs, traces, and SLA dashboards.

## Edge Cases to Handle
- Duplicate candidate profiles from multiple sources.
- Reopened jobs with old pipeline data.
- Interview timezone mismatches and DST issues.
- Candidate withdrawal after offer release.
- Placement failure within replacement window.
- Client access revocation while active interview process exists.

