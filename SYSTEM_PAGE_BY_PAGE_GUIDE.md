# System Page-By-Page Guide

This document explains the current ATS system across:

- frontend pages in `frontphase2`
- backend modules in `backendphase2`
- how pages connect to APIs
- how core entities connect to each other
- the main lead creation flow and related AI flow

## 1. Project Structure

### Frontend

- Root: `C:\Users\Admin\Desktop\jobportalcopy\frontphase2`
- Main app routes: `frontphase2/src/app`
- Shared UI: `frontphase2/src/components`
- Drawers/modals: `frontphase2/src/components/drawers`
- API client: `frontphase2/src/lib/api.ts`

### Backend

- Root: `C:\Users\Admin\Desktop\jobportalcopy\backendphase2`
- Express app bootstrap: `backendphase2/src/app.js`
- Server start: `backendphase2/src/server.js`
- Business modules: `backendphase2/src/modules`
- Database schema: `backendphase2/prisma/schema.prisma`

## 2. Backend API Root Map

Main API base:

- `/api/v1/auth`
- `/api/v1/users`
- `/api/v1/candidates`
- `/api/v1/clients`
- `/api/v1/contacts`
- `/api/v1/jobs`
- `/api/v1/leads`
- `/api/v1/pipeline`
- `/api/v1/matches`
- `/api/v1/interviews`
- `/api/v1/placements`
- `/api/v1/tasks`
- `/api/v1/inbox`
- `/api/v1/reports`
- `/api/v1/teams`
- `/api/v1/settings`
- `/api/v1/ai`

Mounted in:

- `backendphase2/src/app.js`

## 3. Core Business Entities And Relationships

Defined mainly in:

- `backendphase2/prisma/schema.prisma`

Primary entities:

- `User`
- `Lead`
- `Client`
- `Candidate`
- `Job`
- `PipelineStage`
- `PipelineEntry`
- `Match`
- `Interview`
- `Placement`
- `Task`

Main relationships:

- A `Lead` can be converted into a `Client`.
- A `Client` owns hiring demand and is connected to `Jobs`.
- A `Job` can have many `Candidates` linked through `PipelineEntry` and `Match`.
- A `Candidate` can be added to a `Job` pipeline.
- A `Candidate` can have notes, tags, interviews, files, and recruiter assignment.
- A `Match` represents candidate-job fit before or during submission.
- A `PipelineStage` belongs to a `Job`.
- A `PipelineEntry` links `Candidate + Job + Stage`.
- An `Interview` is typically tied to candidate/job workflow.
- A `Placement` is the post-hire outcome and is tied to joined/failed/replacement flow.
- A `Task` is assigned to users and supports day-to-day execution.
- `User` is reused across assignment for leads, clients, candidates, tasks, team, and communication settings.

## 4. Shared Frontend Layers

### API Layer

Main file:

- `frontphase2/src/lib/api.ts`

Purpose:

- handles `fetch`
- auth token handling
- refresh token retry
- common request/response typing
- all page API helpers

### Shared Drawers / Major Shared UI

Important files:

- `frontphase2/src/components/drawers/LeadDetailsDrawer.tsx`
- `frontphase2/src/components/drawers/ClientDetailsDrawer.tsx`
- `frontphase2/src/components/drawers/CandidateProfileDrawer.tsx`
- `frontphase2/src/components/drawers/JobDetailsDrawer.tsx`
- `frontphase2/src/components/drawers/PlacementDetailsDrawer.tsx`
- `frontphase2/src/components/drawers/TaskDetailsDrawer.tsx`
- `frontphase2/src/components/FloatingBotButton.tsx`
- `frontphase2/src/components/AssistantChatPanel.tsx`

### AI Assistant Layer

Frontend:

- `frontphase2/src/components/FloatingBotButton.tsx`
- `frontphase2/src/components/AssistantChatPanel.tsx`

Backend:

- `backendphase2/src/modules/ai/ai.routes.js`
- `backendphase2/src/modules/ai/ai.controller.js`

Functions:

- page-wise contextual bubble
- page-wise starter greeting
- assistant chat endpoint
- lead AI generation
- job description AI generation
- assistant history endpoints exist on backend

## 5. Page-By-Page Functional Map

## 5.1 Dashboard

Frontend:

- `frontphase2/src/app/dashboard/page.tsx`

Main functions:

- overview KPIs
- activity feed
- task stats
- client metrics
- candidate stats
- job metrics
- placement stats
- interview KPIs

Main API calls:

- `apiGetClientMetrics`
- `apiGetCandidateStats`
- `apiGetJobMetrics`
- `apiGetPlacementStats`
- `apiGetInterviewKpis`
- `apiGetTaskStats`
- `apiGetJobs`
- `apiGetInterviews`
- `apiGetTasks`
- `apiGetUsers`
- `apiGetPlacements`
- `apiGetActivityFeed`

Backend modules:

- `client`
- `candidate`
- `job`
- `placement`
- `interview`
- `task`
- `activity`
- `user`

Connection summary:

- Dashboard is the top-level reporting page pulling data from almost every main business module.

## 5.2 Leads

Frontend:

- `frontphase2/src/app/leads/page.tsx`
- `frontphase2/src/components/drawers/LeadDetailsDrawer.tsx`
- `frontphase2/src/components/drawers/LeadImportDrawer.tsx`

Main functions:

- list leads
- search and filter leads
- add lead manually
- generate lead with AI
- ask only for missing required lead fields
- store unmatched prompt data in `otherDetails`
- edit lead
- assign lead owner
- bulk update status/owner
- delete lead
- bulk delete
- convert lead to client
- import leads
- view lead activities
- notes support

Main API calls:

- `apiGetLeads`
- `apiUpdateLead`
- `apiDeleteLead`
- `apiConvertLeadToClient`
- `apiGetUsers`
- `apiCreateLead`
- `apiGetLead`
- `apiGetLeadActivities`
- `apiGenerateLeadDetails`
- `apiImportLeads`
- `apiPreviewLeadImport`

Backend modules:

- `lead`
- `ai`
- `user`
- `activity`

Key backend routes:

- `GET /api/v1/leads`
- `POST /api/v1/leads`
- `PATCH /api/v1/leads/:id`
- `DELETE /api/v1/leads/:id`
- `POST /api/v1/leads/:id/convert`
- `GET /api/v1/leads/:id/activities`
- `POST /api/v1/ai/lead-details`

Connection summary:

- Leads are the entry point for business opportunities.
- Leads can be assigned to users.
- Leads can be converted into clients.
- AI helps normalize raw user prompt data into system fields.
- Extra prompt information is stored in `otherDetails`.

## 5.3 Clients

Frontend:

- `frontphase2/src/app/client/page.tsx`
- `frontphase2/src/components/drawers/ClientDetailsDrawer.tsx`
- `frontphase2/src/components/drawers/ClientImportDrawer.tsx`

Main functions:

- list clients
- search/filter clients
- add/edit client
- delete client
- bulk delete
- bulk assign/update
- notes and files
- import preview and import
- activities view

Main API calls:

- `apiGetClients`
- `apiDeleteClient`
- `apiGetUsers`
- `apiUpdateClient`

Backend modules:

- `client`
- `user`
- `activity`

Connection summary:

- Clients are downstream from leads.
- Clients connect strongly with jobs and long-term account management.

## 5.4 Candidates

Frontend:

- `frontphase2/src/app/candidate/page.tsx`
- `frontphase2/src/components/drawers/CandidateProfileDrawer.tsx`
- `frontphase2/src/app/candidate/components/BulkActions.tsx`

Main functions:

- list candidates
- candidate profile drawer
- update candidate
- assign recruiter
- bulk assign recruiter
- add to pipeline
- bulk move stage
- reject candidate
- bulk reject
- delete candidate
- bulk delete
- notes CRUD
- pin note
- tags add/remove
- schedule interview
- update interview
- export selected candidates

Main API calls:

- `apiGetCandidates`
- `apiGetCandidate`
- `apiUpdateCandidate`
- `apiDeleteCandidate`
- `apiBulkActionCandidates`
- `apiAddCandidateNote`
- `apiUpdateCandidateNote`
- `apiDeleteCandidateNote`
- `apiPinCandidateNote`
- `apiAddCandidateTag`
- `apiRemoveCandidateTag`
- `apiAddCandidateToPipeline`
- `apiMoveCandidateStage`
- `apiRejectCandidate`
- `apiScheduleCandidateInterview`
- `apiUpdateCandidateInterview`
- `apiGetJobs`
- `apiGetUsers`
- `apiGetPipelineStages`

Backend modules:

- `candidate`
- `pipeline`
- `job`
- `interview`
- `user`
- `activity`

Connection summary:

- Candidates connect directly to jobs, interviews, pipeline, recruiter assignment, and match workflows.

## 5.5 Jobs

Frontend:

- `frontphase2/src/app/job/page.tsx`
- `frontphase2/src/components/drawers/CreateJobDrawer.tsx`
- `frontphase2/src/components/drawers/JobDetailsDrawer.tsx`

Main functions:

- list jobs
- job metrics
- get job detail
- create job
- update job
- delete job
- add candidate to job pipeline
- manage job stages
- notes
- files

Main API calls:

- `apiGetJobs`
- `apiGetJob`
- `apiGetJobMetrics`
- `apiDeleteJob`
- `apiUpdateJob`
- `apiAddCandidateToPipeline`
- `apiGetCandidates`

Backend modules:

- `job`
- `pipeline`
- `candidate`
- `files`
- `activity`

Connection summary:

- Jobs sit in the center of operational hiring.
- Jobs connect clients, candidates, pipeline stages, matches, interviews, and placements.

## 5.6 Pipeline

Frontend:

- dedicated page route exists at `frontphase2/src/app/pipeline`

Backend routes:

- `GET /api/v1/pipeline/job/:jobId`
- `POST /api/v1/pipeline/job/:jobId/move`
- `POST /api/v1/pipeline/job/:jobId/stages`
- `PATCH /api/v1/pipeline/stages/:stageId`
- `DELETE /api/v1/pipeline/stages/:stageId`

Main functions:

- fetch pipeline stages for a job
- move candidate between stages
- create/update/delete job-specific stages

Connection summary:

- Pipeline is the operational layer between jobs and candidate progress.

## 5.7 Matches

Frontend:

- `frontphase2/src/app/matches/page.tsx`

Main functions:

- list matches
- save match
- submit match
- reject match
- bulk reject
- bulk add matches to pipeline
- bulk email

Main API calls:

- `apiGetMatches`
- `apiGetJobs`
- `apiGetUsers`
- `apiBulkRejectMatches`
- `apiBulkAddMatchesToPipeline`
- `apiBulkEmailMatches`
- `apiToggleSavedMatch`
- `apiAddCandidateToPipeline`
- `apiSubmitMatch`
- `apiRejectMatch`

Backend modules:

- `match`
- `candidate`
- `pipeline`
- `job`
- `user`

Connection summary:

- Matches connect candidate-job fit into recruiter submission and pipeline actions.

## 5.8 Interviews

Frontend:

- `frontphase2/src/app/interviews/page.tsx`
- interview components under `frontphase2/src/components/interviews`
- hooks under `frontphase2/src/hooks`

Main functions:

- interview list view
- calendar view
- KPIs
- schedule interview
- reschedule
- cancel
- add notes
- update panel
- submit feedback
- mark no-show
- upload recording

Backend modules:

- `interview`
- `candidate`
- `calendar`

Connection summary:

- Interviews connect candidate/job pipeline progression with evaluation and scheduling.

## 5.9 Placements

Frontend:

- `frontphase2/src/app/placements`
- `frontphase2/src/app/placement/[id]/page.tsx`
- `frontphase2/src/components/drawers/PlacementDetailsDrawer.tsx`

Main functions:

- placement listing
- placement detail
- create placement
- update placement
- mark joined
- mark failed
- request replacement
- export CSV

Main API calls:

- `apiGetPlacement`
- placement functions in `frontphase2/src/lib/api.ts`

Backend modules:

- `placement`
- `billing`

Connection summary:

- Placements are the hire outcome layer after interviews/job closure.
- Placement data also feeds billing/revenue logic.

## 5.10 Tasks & Activities

Frontend:

- `frontphase2/src/app/Task&Activites/page.tsx`
- `frontphase2/src/components/drawers/TaskDetailsDrawer.tsx`

Main functions:

- task list
- task detail
- get task stats
- mark completed
- delete task
- task notes/files

Main API calls:

- `apiGetTasks`
- `apiGetTask`
- `apiMarkTaskCompleted`
- `apiDeleteTask`
- `apiGetTaskStats`

Backend modules:

- `task`
- `activity`

Connection summary:

- Tasks connect user execution and follow-up work across clients, candidates, and recruiting operations.

## 5.11 Inbox

Frontend:

- `frontphase2/src/app/inbox/page.tsx`

Main functions:

- Gmail inbox view
- archive message
- trash message
- toggle unread/starred
- create calendar event from email
- connect/disconnect provider

Main API calls:

- `apiConnectIntegration`
- `apiGetGmailInbox`
- `apiArchiveGmailMessage`
- `apiTrashGmailMessage`
- `apiUpdateGmailMessageFlags`
- `apiCreateCalendarEventFromGmailMessage`

Backend modules:

- `inbox`
- `integration`
- `oauth`

Connection summary:

- Inbox connects communication, Gmail integration, and calendar actions.

## 5.12 Contacts

Frontend:

- `frontphase2/src/app/contacts/page.tsx`
- `frontphase2/src/app/contacts/[id]/page.tsx`
- `frontphase2/src/components/drawers/AddContactDrawer.tsx`

Main functions:

- list contacts
- contact stats
- duplicate detection
- bulk actions
- merge contacts
- contact detail
- notes/activities/communications

Main API calls:

- `apiGetContacts`
- `apiGetContactStats`
- `apiDeleteContact`
- `apiBulkActionContacts`
- `apiGetContact`
- `apiAddContactNote`
- `apiAddContactActivity`
- `apiAddContactCommunication`

Backend modules:

- `contact`

Connection summary:

- Contacts support people/communication management outside the main lead-client-candidate pipeline.

## 5.13 Calendar

Frontend:

- `frontphase2/src/app/calendar/page.tsx`

Main functions:

- unified calendar display
- schedule visibility across modules

Main API calls:

- `apiGetUnifiedCalendar`

Backend modules:

- `calendar`
- `interview`
- `task`
- `inbox`

Connection summary:

- Calendar is a cross-module time view for interviews, events, and scheduling.

## 5.14 Team

Frontend:

- `frontphase2/src/app/team/page.tsx`
- `frontphase2/src/app/team/[id]/page.tsx`
- `frontphase2/src/components/team/tabs/*`

Main functions:

- members
- roles
- departments
- targets and KPI
- credentials
- member detail actions

Main API sources:

- `lib/api.ts`
- `lib/api/teamApi`

Backend modules:

- `team`
- `role`
- `department`
- `user`

Connection summary:

- Team controls permissions, staffing, and accountability across the entire ATS.

## 5.15 Reports

Frontend:

- `frontphase2/src/app/reports/page.tsx`

Current state:

- heavily UI/reporting oriented
- appears to use mock/demo data in the page component

Backend module available:

- `report`

Connection summary:

- Reports are intended to aggregate metrics across jobs, clients, candidates, placements, and team performance.

## 5.16 Billing

Frontend:

- `frontphase2/src/app/billing`

Backend module:

- `billing`

Connection summary:

- Billing is linked mainly with placements and revenue/account handling.

## 5.17 Administration / Settings

Frontend:

- `frontphase2/src/app/administration`
- `frontphase2/src/app/setting`

Backend modules:

- `setting`
- `user-communication`
- `twilio-test`
- `integration`

Functions:

- system settings
- communication settings
- Twilio checks
- integration settings

## 5.18 Login / Reset Password / OAuth

Frontend:

- `frontphase2/src/app/login/page.tsx`
- `frontphase2/src/app/reset-password/page.tsx`
- `frontphase2/src/app/auth/linkedin/callback`

Main API calls:

- `apiLogin`
- `apiRegister`
- `buildApiUrl` for reset flows

Backend modules:

- `auth`
- `oauth`
- `linkedin`

Connection summary:

- This layer powers authentication, token refresh, social auth callbacks, password reset, and integration auth.

## 6. Lead Creation Flow

This is the most important business flow currently.

### Manual Lead Creation

Frontend flow:

- user opens `LeadDetailsDrawer`
- fills company/contact/lead details
- frontend builds `CreateLeadData`
- frontend sends to `POST /api/v1/leads`

Backend flow:

- `lead.routes.js`
- `lead.controller.js`
- `lead.service.js`
- Prisma writes to `Lead`

### AI Lead Creation

Frontend flow:

- user opens `Generate With AI`
- user gives raw prompt
- frontend checks if these basics are missing:
  - company
  - email
  - phone
  - location
  - services needed
- if missing, drawer asks only for missing items
- frontend sends full prompt + current lead form context to `apiGenerateLeadDetails`
- AI returns optimized structured lead data
- frontend fills drawer inputs
- unmatched data goes into `otherDetails`
- frontend can create the lead directly

Backend flow:

- `POST /api/v1/ai/lead-details`
- AI normalizes text into system fields
- backend returns structured lead payload
- `lead.service.js` safely resolves `assignedToId` if value is id/name/email

### Lead Conversion To Client

Flow:

- frontend calls `apiConvertLeadToClient`
- backend creates/updates client-side business data from lead
- lead/client lifecycle becomes connected

## 7. Candidate To Placement Flow

Primary business pipeline:

1. Lead created
2. Lead converted to client
3. Client creates/owns jobs
4. Candidates are added or sourced
5. Candidate-job match is reviewed
6. Candidate enters pipeline
7. Interviews are scheduled
8. Candidate moves through stages
9. Placement is created after hire outcome
10. Billing/revenue follows placement

## 8. AI Functions Currently In System

Backend routes:

- `POST /api/v1/ai/job-description`
- `POST /api/v1/ai/lead-details`
- `POST /api/v1/ai/assistant-chat`
- `GET /api/v1/ai/assistant-history/:pageKey`
- `PUT /api/v1/ai/assistant-history/:pageKey`
- `DELETE /api/v1/ai/assistant-history/:pageKey`

Frontend usage:

- floating assistant with page-wise contextual messaging
- assistant chat panel
- AI lead generation
- job description generation support
- page-wise assistant history support in floating bot

Main frontend files:

- `frontphase2/src/components/FloatingBotButton.tsx`
- `frontphase2/src/components/AssistantChatPanel.tsx`
- `frontphase2/src/components/drawers/LeadDetailsDrawer.tsx`

## 9. Important Notes About Current System State

- Some pages are deeply API-driven, especially leads, clients, candidates, jobs, matches, tasks, inbox, and dashboard.
- Some pages are more UI-heavy or partially mocked, especially reports and some supporting sections.
- Team uses both module-based and legacy/new route layers.
- There are both direct backend API helpers in `lib/api.ts` and some special APIs such as `lib/api/teamApi`.
- AI assistant page history is currently handled in the floating assistant layer.

## 10. Best Starting Files For Future Changes

If you want to extend a feature quickly, start here:

- Leads: `frontphase2/src/components/drawers/LeadDetailsDrawer.tsx`
- Leads page: `frontphase2/src/app/leads/page.tsx`
- Candidates: `frontphase2/src/app/candidate/page.tsx`
- Jobs: `frontphase2/src/app/job/page.tsx`
- Clients: `frontphase2/src/app/client/page.tsx`
- Dashboard: `frontphase2/src/app/dashboard/page.tsx`
- Shared API layer: `frontphase2/src/lib/api.ts`
- Backend app route mounting: `backendphase2/src/app.js`
- Lead business logic: `backendphase2/src/modules/lead/lead.service.js`
- Candidate business logic: `backendphase2/src/modules/candidate/candidate.service.js`
- Job business logic: `backendphase2/src/modules/job/job.service.js`
- Pipeline logic: `backendphase2/src/modules/pipeline/pipeline.service.js`
- AI logic: `backendphase2/src/modules/ai/ai.controller.js`

## 11. Quick System Summary

The system is an ATS/Recruitment CRM with this main lifecycle:

- business comes in as leads
- leads become clients
- clients create jobs
- candidates are sourced and matched
- pipeline and interviews move candidates forward
- placements record successful hiring outcomes
- tasks, inbox, calendar, dashboard, and reports support execution and tracking

The strongest connected modules in the system right now are:

- Leads
- Clients
- Jobs
- Candidates
- Pipeline
- Matches
- Interviews
- Placements
- Tasks
- AI Assistant
