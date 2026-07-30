# Phase 1 and Phase 2 API Parameter Reference

## Scope
This document summarizes the current API surface and important parameter models for:

- `Phase 1`: employee / candidate / public apply / interview form flows
- `Phase 2`: employer / tenant / HQ / CRM / org settings flows

It is based on the code currently present in this workspace.

## Base Routing

### Backend mounts
- Legacy Phase 1 backend: `backend1`
  - base prefix: `/api/*`
- Current multi-tenant backend: `backendphase2`
  - base prefix: `/api/v1/*`

### Frontend API client
- Shared client: `frontphase2/src/lib/api.ts`
- Team and RBAC client: `frontphase2/src/lib/api/teamApi.ts`
- Proxy route: `frontphase2/src/app/api/proxy/[...path]/route.ts`

### Important note
There is no separate `frontphase1` app in the current workspace. Current frontend API usage is mostly centralized in `frontphase2`, even for Phase 1 public and candidate-facing flows.

---

## Phase 1 APIs

## 1. Authentication

### Legacy auth routes
- Prefix: `/api/auth`
- Endpoints:
  - `POST /send-otp`
  - `POST /verify-otp`
  - `POST /resend-otp`
  - `POST /login`
  - `POST /set-password`

### Current auth routes
- Prefix: `/api/v1/auth`
- Endpoints:
  - `POST /register`
  - `POST /login`
  - `POST /logout`
  - `POST /refresh`
  - `POST /forgot-password`
  - `POST /verify-otp`
  - `POST /reset-password`
  - `POST /change-password`

### Important auth parameters
- `email`
- `password`
- `otp`
- `refreshToken`
- `tenantDbName`

### Important auth response fields
- `accessToken`
- `token`
- `refreshToken`
- `permissions`
- `requirePasswordReset`
- `tenantDbName`
- `duplicateSession`
- `activeSession`

---

## 2. Candidate Profile APIs

### Prefix
- `/api/profile`

### Main endpoints
- `GET /completeness/:candidateId`
- `POST /sync-common-dashboard/:candidateId`
- `GET /:candidateId`
- `PUT /personal-info/:candidateId`
- `PUT /summary/:candidateId`
- `PUT /career-preferences/:candidateId`
- section CRUD for:
  - education
  - work experience
  - skills
  - languages
  - internship
  - project
  - certifications
  - accomplishments
  - visa
  - vaccination
- upload endpoints for:
  - resume
  - photo
  - documents

### Important candidate/profile parameters
- `candidateId`
- `firstName`
- `lastName`
- `email`
- `phone`
- `location`
- `summary`
- `careerPreferences`
- `skills`
- `education`
- `workExperience`
- `languages`
- `projects`
- `certifications`
- `resume`
- `photo`

### Important candidate response model fields
- `isPhase1Candidate`
- `isNewCandidate`
- `isJobAppliedCandidate`
- `poolOrigin`
- `applications`
- `careerPreferences`

---

## 3. Job Discovery APIs

### Prefix
- `/api/jobs`

### Endpoints
- `GET /personalized`
- `GET /location-recommend`
- `GET /recommend`
- `GET /`
- `GET /:jobId/pre-screen-assessments`
- `GET /:jobId`

### Important job parameters
- `jobId`
- `candidateId`
- `location`
- `skills`
- `experience`

### Important job model fields
- `title`
- `company`
- `location`
- `description`
- `requirements`
- `skills`
- `benefits`
- `employmentType`
- `workMode`
- `salary`
- `applicationFormEnabled`
- `applicationFormLogo`
- `applicationFormQuestions`
- `applicationFormNote`
- `applicationFormSchema`
- `showClientNamePublicly`
- `publicFieldVisibility`
- `preScreenAssessments`

---

## 4. Job Application APIs

### Legacy prefix
- `/api/applications`

### Endpoints
- `POST /`
- `GET /check/:candidateId/:jobId`
- `GET /detail/:applicationId`
- `POST /detail/:applicationId/offer-response`
- `DELETE /detail/:applicationId`
- `GET /:candidateId`

### Public apply prefix
- `/api/v1/jobs`

### Public endpoints
- `GET /public/apply/:token`
- `POST /public/apply/:token/submit`
- `GET /:jobId/apply-link`

### Important public apply parameters
- `token`
- `tenantDbName`
- `answers`
- file uploads keyed by field id

### Public apply response shape
- `job`
- `formSchema`

### `job` summary fields commonly used
- `title`
- `company`
- `logo`
- `location`
- `description`
- `requirements`
- `skills`
- `benefits`
- `employmentType`
- `workMode`
- `salary`
- `applicationFormNote`
- `applicationFormLogo`

---

## 5. Application Form Parameters

### Core schema types
- `ApplicationFormSchema`
- `ApplicationFormField`

### Supported field types
- `short_text`
- `long_text`
- `email`
- `phone`
- `number`
- `date`
- `yes_no`
- `single_choice`
- `multi_choice`
- `education`
- `work_history`
- `photo`
- `resume`
- `section_title`

### Important field-level parameters
- `id`
- `type`
- `label`
- `required`
- `placeholder`
- `helpText`
- `options`
- `accept`
- `maxSize`

---

## 6. Interview Request APIs

### Prefix
- `/api/interview-requests`

### Endpoints
- `POST /`
- `GET /my`
- `GET /my/summary`
- `POST /:requestId/rematch`
- `POST /:requestId/schedule-decision`
- `GET /:requestId/chat`
- `POST /:requestId/chat`

### Important parameters
- `requestId`
- `candidateId`
- `role`
- `status`
- `difficulty`
- `matchingScore`
- `preferredDate`
- `chat`

---

## 7. Interview Application Form APIs

### Prefix
- `/api/v1/interview-applications`

### Public endpoints
- `GET /public/forms`
- `GET /public/forms/:token`
- `POST /public/forms/:token/submit`

### Internal endpoints
- `/forms`
- `/applications`
- `/applications/interviewer`

### Important models
- `InterviewApplicationForm`
- `InterviewApplicationRow`
- `InterviewApplicationStatus`

### Important parameters
- `publicToken`
- `schema`
- `status`
- `responses`
- `assignedInterviewerIds`
- `phase1SubmissionId`

---

## 8. Pre-Screen Assessment APIs

### Prefix
- `/api/v1/pre-screen-assessments`

### Public endpoints
- `GET /public/jobs/:jobId`
- `POST /public/sessions/start`
- `GET /public/sessions/:token`
- `POST /public/sessions/:token/proctoring`
- `POST /public/sessions/:token/submit`

### Important parameters
- `jobId`
- `token`
- `sessionId`
- `assessmentId`
- `responses`
- `proctoringEvents`
- `tenantDbName`

---

## 9. CV / Resume APIs

### CV editor prefix
- `/api/cveditor`

### Endpoints
- `GET /resume/:candidateId`
- `POST /save`
- `POST /ai-improve`
- `POST /export`

### Resume preview prefix
- `/api/resume-preview`

### Endpoints
- `GET /`
- `GET /bytes`

### Important parameters
- `candidateId`
- `template`
- `resumeData`
- `improvementPrompt`
- `format`

---

## 10. Mock Interview APIs

### Prefix
- `/api/mock-interview`

### Endpoints
- `POST /start`
- `POST /next`
- `GET /result/:id`

### Important parameters
- `id`
- `candidateId`
- `jobTitle`
- `question`
- `answer`
- `sessionState`

---

## 11. LMS APIs

### Prefix
- `/api/lms`

### Main sub-groups
- `/dashboard`
- `/courses`
- `/events`
- `/notes`
- `/resume`
- `/career-path`
- `/interview`
- `/quizzes`

### Typical parameters
- `courseId`
- `eventId`
- `noteId`
- `resumeId`
- `quizId`
- `candidateId`

---

## 12. Candidate Token / Coins APIs

### Prefix
- `/api/tokens`

### Endpoints
- `GET /balance`
- `GET /catalog`
- `GET /transactions`
- `GET /unlocks`
- `POST /purchase`
- `POST /claim-welcome`
- `POST /spend`
- `POST /spend-amount`
- `POST /grant-amount`

### Important parameters
- `amount`
- `productId`
- `reason`
- `candidateId`

### Important response fields
- `balance`
- `transactions`
- `catalog`
- `unlocks`

---

## Phase 1 dashboard and analytics parameters

These are the main metrics currently shown in the HQ Phase 1 analytics dashboard:

- `totalCandidates`
- `commonCandidates`
- `new1d`
- `new7d`
- `new30d`
- `portalJobs`
- `openJobs`
- `closedJobs`
- `applications`
- `activeApplications`
- `applicationsToday`
- `applications7d`
- `applications30d`
- `selectedApplications`
- `rejectedApplications`
- `avgMatchScore`
- `avgCvScore`
- `avgAtsScore`
- `savedJobs`
- `interviewRequests`
- `interviewPending`
- `interviewCompleted`
- `cvAnalyses`
- `lmsEnrollments`
- `aiMatches`
- `profileCompleteness`

### Phase 1 chart groups
- `applicationsByStatus`
- `candidatesOverTime`
- `applicationsOverTime`
- `candidatesDaily`
- `applicationsDaily`
- `candidatesByStatus`
- `candidatesBySource`
- `topLocations`
- `topSkills`
- `experienceBands`
- `jobsByStatus`
- `matchScoreBuckets`
- `interviewRequestsByStatus`

### Phase 1 table groups
- `recentCandidates`
- `recentApplications`
- `topJobsByApplications`
- `recentOpenJobs`
- `recentInterviewRequests`

---

## Phase 2 APIs

## 1. HQ APIs

### Prefix
- `/api/v1/hq`

### Setup and tenant endpoints
- `GET /setup`
- `POST /provision-tenant`
- `GET /tenants`
- `DELETE /tenants/:email`
- `POST /tenants/plan`
- `POST /tenants/pause`

### Package endpoints
- `GET /packages/public`
- `GET /packages`
- `POST /packages`
- `PUT /packages/:id`
- `DELETE /packages/:id`

### Lead endpoints
- `GET /leads`
- `POST /leads`
- `PUT /leads/:id`
- `DELETE /leads/:id`
- `POST /leads/:id/follow-ups`
- `PUT /leads/:id/follow-ups/:followUpId`
- `POST /leads/:id/follow-ups/:followUpId/complete`
- `DELETE /leads/:id/follow-ups/:followUpId`
- `POST /leads/:id/remarks`
- `POST /leads/:id/convert-to-company`

### Demo endpoints
- `GET /demos`
- `DELETE /demos/:id`

### Company endpoints
- `GET /companies`
- `POST /companies`
- `PUT /companies/:id`
- `DELETE /companies/:id`
- `POST /companies/:id/follow-ups`
- `PUT /companies/:id/follow-ups/:followUpId`
- `POST /companies/:id/follow-ups/:followUpId/complete`
- `DELETE /companies/:id/follow-ups/:followUpId`
- `POST /companies/:id/remarks`

### Team and RBAC endpoints
- `GET /team`
- `POST /team`
- `PUT /team/:id`
- `DELETE /team/:id`
- `GET /permissions`
- `GET /roles`
- `POST /roles`
- `PUT /roles/:id`
- `DELETE /roles/:id`

### Portal and analytics endpoints
- `GET /portal`
- `DELETE /portal/jobs/:id`
- `GET /candidates`
- `GET /analytics`

---

## 2. Tenant Lead / CRM APIs

### Leads prefix
- `/api/v1/leads`

### Endpoints
- `GET /public-form-link`
- `GET /assignable-members`
- `GET /conversion-capabilities`
- `GET /`
- `POST /`
- `GET /:id`
- `PUT /:id`
- `DELETE /:id`
- `GET /:id/activities`
- `GET /trash`
- `POST /trash/bulk-purge`
- `POST /:id/restore`
- `DELETE /:id/purge`
- `POST /duplicate-check`
- `POST /import/preview`
- `POST /import/check-duplicates`
- `POST /import`
- `POST /:id/follow-ups/complete`
- `POST /:id/conversion-request`
- `POST /:id/convert`
- `GET /:leadId/notes`
- `POST /:leadId/notes`
- `PUT /:leadId/notes/:noteId`
- `DELETE /:leadId/notes/:noteId`

### Important lead parameters
- `id`
- `name`
- `company`
- `email`
- `phone`
- `source`
- `status`
- `score`
- `priority`
- `owner`
- `nextFollowUp`
- `estimatedDealValue`
- `industry`
- `country`
- `notes`

### Important lead models
- `BackendLead`
- `CreateLeadData`
- `ConvertLeadToClientData`

---

## 3. Tenant Client / Company APIs

### Prefix
- `/api/v1/clients`

### Endpoints
- `GET /assignable-members`
- `GET /`
- `POST /`
- `GET /metrics`
- `GET /:id`
- `PUT /:id`
- `DELETE /:id`
- `GET /:clientId/activities`
- `GET /trash`
- `POST /trash/bulk-purge`
- `POST /:id/restore`
- `DELETE /:id/purge`
- `POST /import/preview`
- `POST /import/check-duplicates`
- `POST /import`
- `GET /:clientId/notes`
- `POST /:clientId/notes`
- `PUT /:clientId/notes/:noteId`
- `DELETE /:clientId/notes/:noteId`
- `GET /:clientId/files`
- `POST /:clientId/files`
- `DELETE /:clientId/files/:fileId`

### Important client parameters
- `id`
- `name`
- `status`
- `score`
- `industry`
- `country`
- `owner`
- `nextFollowUp`
- `agreementLevel`
- `priority`
- `services`
- `contacts`
- `files`

### Important client models
- `BackendClient`
- `CreateClientData`
- `UpdateClientData`
- `ClientMetrics`

---

## 4. Org Settings and Subscription APIs

### Prefix
- `/api/v1/settings/org`

### Endpoints
- `GET /recruitment-summary`
- `GET /coins`
- `GET /workspace-client`
- `GET /default-currency`
- `GET /recruitment-mode`
- `GET /client-page-fields/visibility`
- `PUT /client-page-fields/visibility`
- `GET /client-page-fields`
- `GET /pipeline-template`
- `POST /pipeline-template/apply-to-empty-jobs`
- `POST /pipeline-template/apply-to-job/:jobId`
- `GET /subscription-plan`
- `GET /subscription-plan/razorpay-config`
- `POST /subscription-plan/payment-order`
- `POST /subscription-plan/upgrade`
- `PUT /subscription-plan`
- `GET /company-services`
- `PUT /company-services`
- `POST /company-services/append`
- `GET /company-services/suggest`
- `GET /industries/suggest`
- `GET /languages/suggest`
- `GET /proficiencies/suggest`
- `GET /lead-statuses`
- `POST /lead-statuses/append`
- `POST /lead-statuses/remove`
- `GET /client-lead-statuses`
- `POST /client-lead-statuses/append`
- `POST /client-lead-statuses/remove`
- `GET /client-priorities`
- `POST /client-priorities/append`
- `POST /client-priorities/remove`
- `GET /agreement-levels`
- `POST /agreement-levels/append`
- `POST /agreement-levels/remove`

### Important subscription parameters
- `planName`
- `billingCycle`
- `planStartDate`
- `price`
- `maxUsers`
- `maxJobs`
- `coins`

### Important subscription and org response types
- `HqTenantSubscriptionPlan`
- `OrgPlanUsageCache`
- `SubscriptionPaymentOrder`
- `StatusCatalogResponse`

---

## 5. Team, Roles, Permissions, Departments APIs

### Team prefix
- `/api/team`

### Team endpoints
- `GET /assignable`
- `GET /`
- `POST /`
- `GET /:id`
- `PUT /:id`
- `DELETE /:id`
- `POST /:id/deactivate`
- `POST /:id/activate`
- `POST /:id/credentials`
- `POST /:id/reset-password`
- `POST /:id/resend-invite`
- `POST /:id/lock`
- `POST /:id/unlock`
- `GET /:id/login-history`
- `GET /:id/activity`
- `GET /:id/targets`
- `PUT /:id/targets`

### Roles prefix
- `/api/roles`

### Roles endpoints
- `GET /`
- `POST /`
- `GET /:id`
- `PUT /:id`
- `DELETE /:id`
- `GET /all-permissions`

### Permissions prefix
- `/api/permissions`
- alias: `/api/v1/permissions`

### Permissions endpoints
- `GET /`

### Departments prefix
- `/api/departments`

### Departments endpoints
- `GET /`
- `POST /`
- `GET /:id`
- `PUT /:id`
- `DELETE /:id`
- `GET /:id/reporting-managers`

### Important team and RBAC types
- `TeamMember`
- `TeamMemberDetail`
- `CreateMemberPayload`
- `UpdateMemberPayload`
- `GenerateCredentialsPayload`
- `Role`
- `Permission`
- `Department`
- `DepartmentRoleInput`
- `LoginHistory`
- `UserActivity`

---

## 6. User Permission APIs

### Prefix
- `/api/v1/users`

### Endpoints
- `GET /me`
- `GET /me/permissions`

### Important response type
- `MyPermissionsPayload`

---

## 7. Phase 2 dashboard and analytics parameters

These are the main metrics currently shown in the HQ Phase 2 analytics dashboard.

### Tenant and plan KPIs
- `tenants`
- `agency`
- `standalone`
- `paused`
- `onPlan`
- `landingPurchases`
- `landingTrials`

### Recruitment KPIs
- `openJobs`
- `closedJobs`
- `jobs`
- `candidates`
- `candidates7d`
- `applications`
- `applications7d`
- `interviews`
- `interviewsToday`
- `interviewsScheduled`
- `interviewsCompleted`
- `placements`
- `placementsJoined`
- `clients`
- `tenantLeads`
- `tasks`
- `tasksOpen`

### HQ CRM KPIs
- `hqLeads`
- `hqLeadConversionRate`
- `hqCompanies`
- `hotLeads`
- `pipelineValue`
- `demosVerified`
- `demosPurchases`
- `demosTrials`
- `followUpsToday`

### Phase 2 chart groups
- `hiringFunnel`
- `tenantsByPlan`
- `tenantsByType`
- `tenantsBySignup`
- `leadsByStage`
- `leadsByScore`
- `companiesByStatus`
- `demosByKind`
- `demosByStatus`
- `jobsByStatus`
- `interviewsByStatus`
- `placementsByStatus`
- `tenantActivity`

### Phase 2 table groups
- `rankedTenants`
- `recentTenantActivity`
- `recentJobs`
- `recentPlacements`
- `crmLeads`
- `crmCompanies`
- `recentDemos`
- `crmLeadStats`
- `crmCompanyStats`
- `demoStats`

---

## Key Phase 2 payload families

### HQ payloads
- `HqSubscriptionPackage`
- `HqTenantSubscriptionPlan`
- `HqTenantRow`
- `HqLeadApiRow`
- `HqLeadFollowUp`
- `HqLeadRemark`
- `HqLeadStats`
- `HqDemoRequestApiRow`
- `HqDemoStats`
- `HqLeadStorageInfo`
- `HqCompanyApiRow`
- `HqCompanyStats`
- `HqTeamMemberRow`
- `HqRoleRow`
- `HqPermissionRow`
- `HqTeamStats`
- `HqPortalCandidateRow`
- `HqPortalJobRow`
- `HqPortalStats`
- `HqPortalStorageInfo`
- `HqAnalyticsPayload`
- `HqEmployeeAnalytics`
- `HqEmployerAnalytics`
- `HqEmployerTenantRow`

### Most important HQ provisioning and plan parameters
- `organizationName`
- `email`
- `phone`
- `organizationType`
- `productLine`
- `enabledModules`
- `tenantDbName`
- `plan.name`
- `plan.billingCycle`
- `plan.planStartDate`
- `plan.price`
- `plan.maxUsers`
- `plan.maxJobs`
- `plan.coins`

---

## Recommended source files

Use these files as the source of truth when this document needs updates:

- `backend1/src/server.js`
- `backend1/src/routes/*.routes.js`
- `backend1/src/lms/lms.router.js`
- `backendphase2/src/app.js`
- `backendphase2/src/modules/hq/hq.routes.js`
- `backendphase2/src/modules/lead/lead.routes.js`
- `backendphase2/src/modules/client/client.routes.js`
- `backendphase2/src/modules/setting/org-recruitment.routes.js`
- `backendphase2/src/modules/auth/auth.routes.js`
- `backendphase2/src/modules/job/job.routes.js`
- `backendphase2/src/modules/interview-application/interviewApplication.routes.js`
- `backendphase2/src/modules/pre-screen-assessment/assessment.routes.js`
- `backendphase2/src/routes/teamRoutes.js`
- `backendphase2/src/routes/rolesRoutes.js`
- `backendphase2/src/routes/permissionsRoutes.js`
- `backendphase2/src/routes/departmentsRoutes.js`
- `frontphase2/src/lib/api.ts`
- `frontphase2/src/lib/api/teamApi.ts`
- `frontphase2/src/lib/applicationFormTypes.ts`

---

## Summary

### Phase 1
Phase 1 covers candidate-facing and public-apply flows:
- authentication
- profile management
- job discovery
- public application forms
- interview requests
- assessments
- resume tools
- LMS
- candidate tokens

### Phase 2
Phase 2 covers employer, tenant, and HQ flows:
- HQ tenant provisioning
- packages and plans
- tenant CRM leads and clients
- org settings and subscription plans
- team and RBAC
- portal and analytics
- tenant coins and usage controls

---

# API Sheet (Table Style)

Clean endpoint inventory using:

`Method | Path | Request Params | Response Type`

This section is additive. All previous sections above remain unchanged.

---

## Phase 1 API Sheet

### Auth (legacy `/api/auth`)

| Method | Path | Request Params | Response Type |
|--------|------|----------------|---------------|
| POST | `/api/auth/send-otp` | `email` | `{ success, message }` |
| POST | `/api/auth/verify-otp` | `email`, `otp` | `{ success, token? }` |
| POST | `/api/auth/resend-otp` | `email` | `{ success, message }` |
| POST | `/api/auth/login` | `email`, `password` | `AuthPayload` |
| POST | `/api/auth/set-password` | `email`, `password`, `otp?` | `{ success }` |

### Auth (current `/api/v1/auth`)

| Method | Path | Request Params | Response Type |
|--------|------|----------------|---------------|
| POST | `/api/v1/auth/register` | `email`, `password`, `name?`, `tenantDbName?` | `AuthPayload` |
| POST | `/api/v1/auth/login` | `email`, `password`, `tenantDbName?` | `AuthPayload` / `AuthUser` |
| POST | `/api/v1/auth/logout` | auth headers | `{ success }` |
| POST | `/api/v1/auth/refresh` | `refreshToken` | `AuthPayload` |
| POST | `/api/v1/auth/forgot-password` | `email` | `{ success, message }` |
| POST | `/api/v1/auth/verify-otp` | `email`, `otp` | `{ success, verified }` |
| POST | `/api/v1/auth/reset-password` | `email`, `otp`, `password` | `{ success }` |
| POST | `/api/v1/auth/change-password` | `currentPassword`, `newPassword` | `{ success }` |

### Candidate Profile (`/api/profile`)

| Method | Path | Request Params | Response Type |
|--------|------|----------------|---------------|
| GET | `/api/profile/completeness/:candidateId` | `candidateId` | `{ completeness, missingFields }` |
| POST | `/api/profile/sync-common-dashboard/:candidateId` | `candidateId` | `{ success }` |
| GET | `/api/profile/:candidateId` | `candidateId` | `BackendCandidate` / profile object |
| PUT | `/api/profile/personal-info/:candidateId` | `firstName`, `lastName`, `email`, `phone`, `location` | updated profile |
| PUT | `/api/profile/summary/:candidateId` | `summary` | updated profile |
| PUT | `/api/profile/career-preferences/:candidateId` | `careerPreferences` | updated profile |
| POST / PUT / DELETE | `/api/profile/...section.../:candidateId` | section payload (`education`, `skills`, `workExperience`, etc.) | updated section |
| POST | `/api/profile/...upload.../:candidateId` | `file` (`resume` / `photo` / document) | `{ url, success }` |

### Jobs (`/api/jobs`)

| Method | Path | Request Params | Response Type |
|--------|------|----------------|---------------|
| GET | `/api/jobs/personalized` | `candidateId?`, filters | `BackendJob[]` |
| GET | `/api/jobs/location-recommend` | `location`, `candidateId?` | `BackendJob[]` |
| GET | `/api/jobs/recommend` | `candidateId?`, skills/filters | `BackendJob[]` |
| GET | `/api/jobs/` | `search?`, `status?`, `page?`, `limit?` | paginated jobs |
| GET | `/api/jobs/:jobId/pre-screen-assessments` | `jobId` | assessment list |
| GET | `/api/jobs/:jobId` | `jobId` | `BackendJob` |

### Applications (`/api/applications`)

| Method | Path | Request Params | Response Type |
|--------|------|----------------|---------------|
| POST | `/api/applications/` | `candidateId`, `jobId`, answers/files | created application |
| GET | `/api/applications/check/:candidateId/:jobId` | `candidateId`, `jobId` | `{ applied: boolean }` |
| GET | `/api/applications/detail/:applicationId` | `applicationId` | application detail |
| POST | `/api/applications/detail/:applicationId/offer-response` | `response` (`accept`/`reject`) | updated application |
| DELETE | `/api/applications/detail/:applicationId` | `applicationId` | `{ success }` |
| GET | `/api/applications/:candidateId` | `candidateId` | application list |

### Public Apply (`/api/v1/jobs`)

| Method | Path | Request Params | Response Type |
|--------|------|----------------|---------------|
| GET | `/api/v1/jobs/public/apply/:token` | `token`, `tenantDbName?` | `{ job, formSchema }` |
| POST | `/api/v1/jobs/public/apply/:token/submit` | `FormData`: `answers` (JSON), files by field id, `tenantDbName?` | `{ success, applicationId? }` |
| GET | `/api/v1/jobs/:jobId/apply-link` | `jobId` | `{ token, url }` |

### Interview Requests (`/api/interview-requests`)

| Method | Path | Request Params | Response Type |
|--------|------|----------------|---------------|
| POST | `/api/interview-requests/` | role/category, difficulty, preferredDate, notes | created request |
| GET | `/api/interview-requests/my` | auth | request list |
| GET | `/api/interview-requests/my/summary` | auth | summary stats |
| POST | `/api/interview-requests/:requestId/rematch` | `requestId` | rematch result |
| POST | `/api/interview-requests/:requestId/schedule-decision` | `requestId`, decision payload | updated request |
| GET | `/api/interview-requests/:requestId/chat` | `requestId` | chat messages |
| POST | `/api/interview-requests/:requestId/chat` | `requestId`, `message` | created message |

### Interview Application Forms (`/api/v1/interview-applications`)

| Method | Path | Request Params | Response Type |
|--------|------|----------------|---------------|
| GET | `/api/v1/interview-applications/public/forms` | filters? | public forms |
| GET | `/api/v1/interview-applications/public/forms/:token` | `token` | `InterviewApplicationForm` |
| POST | `/api/v1/interview-applications/public/forms/:token/submit` | answers / files | `{ success, submissionId? }` |
| GET | `/api/v1/interview-applications/forms` | filters | `InterviewApplicationForm[]` |
| POST | `/api/v1/interview-applications/forms` | schema, title, settings | created form |
| PUT | `/api/v1/interview-applications/forms/:id` | schema/status updates | updated form |
| GET | `/api/v1/interview-applications/applications` | filters | `InterviewApplicationRow[]` |
| GET | `/api/v1/interview-applications/applications/interviewer` | interviewer filters | interviewer rows |
| PATCH / PUT | `/api/v1/interview-applications/applications/:id` | status / review fields | updated application |

### Pre-Screen Assessments (`/api/v1/pre-screen-assessments`)

| Method | Path | Request Params | Response Type |
|--------|------|----------------|---------------|
| GET | `/api/v1/pre-screen-assessments/public/jobs/:jobId` | `jobId`, `tenantDbName?` | assessment list |
| POST | `/api/v1/pre-screen-assessments/public/sessions/start` | `jobId`, candidate info | `{ token, session }` |
| GET | `/api/v1/pre-screen-assessments/public/sessions/:token` | `token` | session detail |
| POST | `/api/v1/pre-screen-assessments/public/sessions/:token/proctoring` | proctoring events | `{ success }` |
| POST | `/api/v1/pre-screen-assessments/public/sessions/:token/submit` | answers / responses | graded/submitted result |

### CV Editor and Resume Preview

| Method | Path | Request Params | Response Type |
|--------|------|----------------|---------------|
| GET | `/api/cveditor/resume/:candidateId` | `candidateId` | resume data |
| POST | `/api/cveditor/save` | `candidateId`, `resumeData` | `{ success }` |
| POST | `/api/cveditor/ai-improve` | resume section + prompt | improved text |
| POST | `/api/cveditor/export` | `candidateId`, `format` | export file/url |
| GET | `/api/resume-preview/` | query preview params | preview HTML/meta |
| GET | `/api/resume-preview/bytes` | query preview params | file bytes |

### Mock Interview (`/api/mock-interview`)

| Method | Path | Request Params | Response Type |
|--------|------|----------------|---------------|
| POST | `/api/mock-interview/start` | role/jobTitle, candidate context | session object |
| POST | `/api/mock-interview/next` | `sessionId`, `answer` | next question / feedback |
| GET | `/api/mock-interview/result/:id` | `id` | final score/result |

### LMS (`/api/lms`)

| Method | Path | Request Params | Response Type |
|--------|------|----------------|---------------|
| GET / POST | `/api/lms/dashboard` | candidate context | dashboard payload |
| GET / POST | `/api/lms/courses` | `courseId?` | courses / enrollment |
| GET / POST | `/api/lms/events` | `eventId?` | events |
| GET / POST | `/api/lms/notes` | `noteId?` | notes |
| GET / POST | `/api/lms/resume` | resume LMS payload | resume LMS data |
| GET / POST | `/api/lms/career-path` | career path payload | path data |
| GET / POST | `/api/lms/interview` | interview LMS payload | interview LMS data |
| GET / POST | `/api/lms/quizzes` | `quizId?`, answers? | quiz / score |

### Candidate Tokens (`/api/tokens`)

| Method | Path | Request Params | Response Type |
|--------|------|----------------|---------------|
| GET | `/api/tokens/balance` | auth | `{ balance }` |
| GET | `/api/tokens/catalog` | — | catalog list |
| GET | `/api/tokens/transactions` | filters? | transaction list |
| GET | `/api/tokens/unlocks` | — | unlock list |
| POST | `/api/tokens/purchase` | `productId`, payment meta | purchase result |
| POST | `/api/tokens/claim-welcome` | — | welcome grant |
| POST | `/api/tokens/spend` | spend item payload | updated balance |
| POST | `/api/tokens/spend-amount` | `amount`, `reason` | updated balance |
| POST | `/api/tokens/grant-amount` | `amount`, `reason` | updated balance |

---

## Phase 2 API Sheet

### HQ Tenants and Packages (`/api/v1/hq`)

| Method | Path | Request Params | Response Type |
|--------|------|----------------|---------------|
| GET | `/api/v1/hq/setup` | — | HQ setup status |
| POST | `/api/v1/hq/provision-tenant` | org details + `plan` (`name`, `billingCycle`, `planStartDate`, `price`, `maxUsers`, `maxJobs`, `coins`) | provisioned tenant |
| GET | `/api/v1/hq/tenants` | filters? | `HqTenantRow[]` |
| DELETE | `/api/v1/hq/tenants/:email` | `email` | `{ success }` |
| POST | `/api/v1/hq/tenants/plan` | `email`, plan payload | updated `HqTenantRow` |
| POST | `/api/v1/hq/tenants/pause` | `email`, `paused` | updated tenant |
| GET | `/api/v1/hq/packages/public` | — | public packages |
| GET | `/api/v1/hq/packages` | — | `HqSubscriptionPackage[]` |
| POST | `/api/v1/hq/packages` | package fields | created package |
| PUT | `/api/v1/hq/packages/:id` | package fields | updated package |
| DELETE | `/api/v1/hq/packages/:id` | `id` | `{ success }` |

### HQ Leads (`/api/v1/hq/leads`)

| Method | Path | Request Params | Response Type |
|--------|------|----------------|---------------|
| GET | `/api/v1/hq/leads` | filters (`status`, search, etc.) | `{ leads: HqLeadApiRow[], stats }` |
| POST | `/api/v1/hq/leads` | company/contact/source/status/follow-up fields | `HqLeadApiRow` |
| PUT | `/api/v1/hq/leads/:id` | lead update fields | `HqLeadApiRow` |
| DELETE | `/api/v1/hq/leads/:id` | `id` | `{ success }` |
| POST | `/api/v1/hq/leads/:id/follow-ups` | date, time, channel, notes, reminder | `HqLeadFollowUp` |
| PUT | `/api/v1/hq/leads/:id/follow-ups/:followUpId` | follow-up update fields | `HqLeadFollowUp` |
| POST | `/api/v1/hq/leads/:id/follow-ups/:followUpId/complete` | optional note | completed follow-up |
| DELETE | `/api/v1/hq/leads/:id/follow-ups/:followUpId` | ids | `{ success }` |
| POST | `/api/v1/hq/leads/:id/remarks` | `text` / remark payload | `HqLeadRemark` |
| POST | `/api/v1/hq/leads/:id/convert-to-company` | conversion fields | created company |

### HQ Demos (`/api/v1/hq/demos`)

| Method | Path | Request Params | Response Type |
|--------|------|----------------|---------------|
| GET | `/api/v1/hq/demos` | filters? | `{ demos: HqDemoRequestApiRow[], stats }` |
| DELETE | `/api/v1/hq/demos/:id` | `id` | `{ success }` |

### HQ Companies (`/api/v1/hq/companies`)

| Method | Path | Request Params | Response Type |
|--------|------|----------------|---------------|
| GET | `/api/v1/hq/companies` | filters? | `{ companies: HqCompanyApiRow[], stats }` |
| POST | `/api/v1/hq/companies` | company create fields | `HqCompanyApiRow` |
| PUT | `/api/v1/hq/companies/:id` | company update fields | `HqCompanyApiRow` |
| DELETE | `/api/v1/hq/companies/:id` | `id` | `{ success }` |
| POST | `/api/v1/hq/companies/:id/follow-ups` | follow-up fields | follow-up object |
| PUT | `/api/v1/hq/companies/:id/follow-ups/:followUpId` | follow-up update | follow-up object |
| POST | `/api/v1/hq/companies/:id/follow-ups/:followUpId/complete` | optional note | completed follow-up |
| DELETE | `/api/v1/hq/companies/:id/follow-ups/:followUpId` | ids | `{ success }` |
| POST | `/api/v1/hq/companies/:id/remarks` | remark text | remark object |

### HQ Team / Roles / Portal / Analytics

| Method | Path | Request Params | Response Type |
|--------|------|----------------|---------------|
| GET | `/api/v1/hq/team` | — | `HqTeamMemberRow[]` / stats |
| POST | `/api/v1/hq/team` | member create fields | `HqTeamMemberRow` |
| PUT | `/api/v1/hq/team/:id` | member update fields | `HqTeamMemberRow` |
| DELETE | `/api/v1/hq/team/:id` | `id` | `{ success }` |
| GET | `/api/v1/hq/permissions` | — | `HqPermissionRow[]` |
| GET | `/api/v1/hq/roles` | — | `HqRoleRow[]` |
| POST | `/api/v1/hq/roles` | role name + permissions | `HqRoleRow` |
| PUT | `/api/v1/hq/roles/:id` | role update | `HqRoleRow` |
| DELETE | `/api/v1/hq/roles/:id` | `id` | `{ success }` |
| GET | `/api/v1/hq/portal` | filters? | portal jobs/candidates + stats |
| DELETE | `/api/v1/hq/portal/jobs/:id` | `id` | `{ success }` |
| GET | `/api/v1/hq/candidates` | filters? | `HqPortalCandidateRow[]` |
| GET | `/api/v1/hq/analytics` | — | `HqAnalyticsPayload` |

### Tenant Leads (`/api/v1/leads`)

| Method | Path | Request Params | Response Type |
|--------|------|----------------|---------------|
| GET | `/api/v1/leads/public-form-link` | — | `{ url, token }` |
| GET | `/api/v1/leads/assignable-members` | — | member list |
| GET | `/api/v1/leads/conversion-capabilities` | — | conversion capability flags |
| GET | `/api/v1/leads/` | filters/search/page | `BackendLead[]` / paginated |
| POST | `/api/v1/leads/` | `CreateLeadData` | `BackendLead` |
| GET | `/api/v1/leads/:id` | `id` | `BackendLead` |
| PUT | `/api/v1/leads/:id` | lead update fields | `BackendLead` |
| DELETE | `/api/v1/leads/:id` | `id` | `{ success }` |
| GET | `/api/v1/leads/:id/activities` | `id` | activity list |
| GET | `/api/v1/leads/trash` | — | trashed leads |
| POST | `/api/v1/leads/trash/bulk-purge` | ids / purge payload | `{ success }` |
| POST | `/api/v1/leads/:id/restore` | `id` | restored lead |
| DELETE | `/api/v1/leads/:id/purge` | `id` | `{ success }` |
| POST | `/api/v1/leads/duplicate-check` | email/phone/company fields | duplicate result |
| POST | `/api/v1/leads/import/preview` | import file/rows | preview result |
| POST | `/api/v1/leads/import/check-duplicates` | import rows | duplicate report |
| POST | `/api/v1/leads/import` | confirmed import payload | import result |
| POST | `/api/v1/leads/:id/follow-ups/complete` | follow-up complete payload | updated lead |
| POST | `/api/v1/leads/:id/conversion-request` | conversion request fields | request result |
| POST | `/api/v1/leads/:id/convert` | `ConvertLeadToClientData` | created client |
| GET | `/api/v1/leads/:leadId/notes` | `leadId` | notes list |
| POST | `/api/v1/leads/:leadId/notes` | note text | created note |
| PUT | `/api/v1/leads/:leadId/notes/:noteId` | note update | updated note |
| DELETE | `/api/v1/leads/:leadId/notes/:noteId` | ids | `{ success }` |

### Tenant Clients (`/api/v1/clients`)

| Method | Path | Request Params | Response Type |
|--------|------|----------------|---------------|
| GET | `/api/v1/clients/assignable-members` | — | member list |
| GET | `/api/v1/clients/` | filters/search/page | `BackendClient[]` / paginated |
| POST | `/api/v1/clients/` | `CreateClientData` | `BackendClient` |
| GET | `/api/v1/clients/metrics` | filters? | `ClientMetrics` |
| GET | `/api/v1/clients/:id` | `id` | `BackendClient` |
| PUT | `/api/v1/clients/:id` | `UpdateClientData` | `BackendClient` |
| DELETE | `/api/v1/clients/:id` | `id` | `{ success }` |
| GET | `/api/v1/clients/:clientId/activities` | `clientId` | activity list |
| GET | `/api/v1/clients/trash` | — | trashed clients |
| POST | `/api/v1/clients/trash/bulk-purge` | ids | `{ success }` |
| POST | `/api/v1/clients/:id/restore` | `id` | restored client |
| DELETE | `/api/v1/clients/:id/purge` | `id` | `{ success }` |
| POST | `/api/v1/clients/import/preview` | import file/rows | preview result |
| POST | `/api/v1/clients/import/check-duplicates` | import rows | duplicate report |
| POST | `/api/v1/clients/import` | confirmed import payload | import result |
| GET | `/api/v1/clients/:clientId/notes` | `clientId` | notes list |
| POST | `/api/v1/clients/:clientId/notes` | note text | created note |
| PUT | `/api/v1/clients/:clientId/notes/:noteId` | note update | updated note |
| DELETE | `/api/v1/clients/:clientId/notes/:noteId` | ids | `{ success }` |
| GET | `/api/v1/clients/:clientId/files` | `clientId` | file list |
| POST | `/api/v1/clients/:clientId/files` | file upload | created file |
| DELETE | `/api/v1/clients/:clientId/files/:fileId` | ids | `{ success }` |

### Org Settings / Coins / Subscription (`/api/v1/settings/org`)

| Method | Path | Request Params | Response Type |
|--------|------|----------------|---------------|
| GET | `/api/v1/settings/org/recruitment-summary` | — | summary + usage |
| GET | `/api/v1/settings/org/coins` | — | `{ coins, planName }` |
| GET | `/api/v1/settings/org/workspace-client` | — | workspace client |
| GET | `/api/v1/settings/org/default-currency` | — | currency config |
| GET | `/api/v1/settings/org/recruitment-mode` | — | recruitment mode |
| GET | `/api/v1/settings/org/client-page-fields/visibility` | — | visibility map |
| PUT | `/api/v1/settings/org/client-page-fields/visibility` | visibility payload | updated visibility |
| GET | `/api/v1/settings/org/client-page-fields` | — | field catalog |
| GET | `/api/v1/settings/org/pipeline-template` | — | pipeline template |
| POST | `/api/v1/settings/org/pipeline-template/apply-to-empty-jobs` | — | apply result |
| POST | `/api/v1/settings/org/pipeline-template/apply-to-job/:jobId` | `jobId` | apply result |
| GET | `/api/v1/settings/org/subscription-plan` | — | `HqTenantSubscriptionPlan` / usage |
| GET | `/api/v1/settings/org/subscription-plan/razorpay-config` | — | Razorpay config |
| POST | `/api/v1/settings/org/subscription-plan/payment-order` | plan/upgrade fields | `SubscriptionPaymentOrder` |
| POST | `/api/v1/settings/org/subscription-plan/upgrade` | upgrade fields | updated plan |
| PUT | `/api/v1/settings/org/subscription-plan` | plan fields (`name`, `billingCycle`, `price`, `maxUsers`, `maxJobs`, `coins`) | updated plan |
| GET | `/api/v1/settings/org/company-services` | — | services list |
| PUT | `/api/v1/settings/org/company-services` | services array | updated services |
| POST | `/api/v1/settings/org/company-services/append` | service name | updated services |
| GET | `/api/v1/settings/org/company-services/suggest` | query? | suggestions |
| GET | `/api/v1/settings/org/industries/suggest` | query? | suggestions |
| GET | `/api/v1/settings/org/languages/suggest` | query? | suggestions |
| GET | `/api/v1/settings/org/proficiencies/suggest` | query? | suggestions |
| GET | `/api/v1/settings/org/lead-statuses` | — | `StatusCatalogResponse` |
| POST | `/api/v1/settings/org/lead-statuses/append` | status value | updated catalog |
| POST | `/api/v1/settings/org/lead-statuses/remove` | status value | updated catalog |
| GET | `/api/v1/settings/org/client-lead-statuses` | — | `StatusCatalogResponse` |
| POST | `/api/v1/settings/org/client-lead-statuses/append` | status value | updated catalog |
| POST | `/api/v1/settings/org/client-lead-statuses/remove` | status value | updated catalog |
| GET | `/api/v1/settings/org/client-priorities` | — | `StatusCatalogResponse` |
| POST | `/api/v1/settings/org/client-priorities/append` | priority value | updated catalog |
| POST | `/api/v1/settings/org/client-priorities/remove` | priority value | updated catalog |
| GET | `/api/v1/settings/org/agreement-levels` | — | `StatusCatalogResponse` |
| POST | `/api/v1/settings/org/agreement-levels/append` | level value | updated catalog |
| POST | `/api/v1/settings/org/agreement-levels/remove` | level value | updated catalog |

### Team / Roles / Permissions / Departments

| Method | Path | Request Params | Response Type |
|--------|------|----------------|---------------|
| GET | `/api/team/assignable` | — | assignable members |
| GET | `/api/team/` | filters? | `TeamMember[]` |
| POST | `/api/team/` | `CreateMemberPayload` | `TeamMember` |
| GET | `/api/team/:id` | `id` | `TeamMemberDetail` |
| PUT | `/api/team/:id` | `UpdateMemberPayload` | `TeamMember` |
| DELETE | `/api/team/:id` | `id` | `{ success }` |
| POST | `/api/team/:id/deactivate` | `id` | updated member |
| POST | `/api/team/:id/activate` | `id` | updated member |
| POST | `/api/team/:id/credentials` | `GenerateCredentialsPayload` | credentials result |
| POST | `/api/team/:id/reset-password` | password payload | `{ success }` |
| POST | `/api/team/:id/resend-invite` | `id` | `{ success }` |
| POST | `/api/team/:id/lock` | `id` | updated member |
| POST | `/api/team/:id/unlock` | `id` | updated member |
| GET | `/api/team/:id/login-history` | `id` | `LoginHistory[]` |
| GET | `/api/team/:id/activity` | `id` | `UserActivity[]` |
| GET | `/api/team/:id/targets` | `id` | targets |
| PUT | `/api/team/:id/targets` | targets payload | updated targets |
| GET | `/api/roles/` | — | `Role[]` |
| POST | `/api/roles/` | role + permissions | `Role` |
| GET | `/api/roles/:id` | `id` | `Role` |
| PUT | `/api/roles/:id` | role update | `Role` |
| DELETE | `/api/roles/:id` | `id` | `{ success }` |
| GET | `/api/roles/all-permissions` | — | `Permission[]` |
| GET | `/api/permissions/` | — | `Permission[]` |
| GET | `/api/departments/` | — | `Department[]` |
| POST | `/api/departments/` | department fields | `Department` |
| GET | `/api/departments/:id` | `id` | `Department` |
| PUT | `/api/departments/:id` | department update | `Department` |
| DELETE | `/api/departments/:id` | `id` | `{ success }` |
| GET | `/api/departments/:id/reporting-managers` | `id` | managers list |

### Users (`/api/v1/users`)

| Method | Path | Request Params | Response Type |
|--------|------|----------------|---------------|
| GET | `/api/v1/users/me` | auth | current user |
| GET | `/api/v1/users/me/permissions` | auth | `MyPermissionsPayload` |

---

## Analytics Response Types (Quick Reference)

### `HqAnalyticsPayload`
| Field | Type |
|-------|------|
| `generatedAt` | `string` |
| `durationMs?` | `number` |
| `live?` | `boolean` |
| `employee` | `HqEmployeeAnalytics` |
| `employer` | `HqEmployerAnalytics` |

### Phase 1 KPI fields (`HqEmployeeAnalytics.kpis`)
| Parameter | Type |
|-----------|------|
| `totalCandidates` | `number` |
| `commonCandidates` | `number` |
| `new1d?` | `number` |
| `new7d` | `number` |
| `new30d` | `number` |
| `portalJobs` | `number` |
| `openJobs` | `number` |
| `closedJobs?` | `number` |
| `applications` | `number` |
| `activeApplications` | `number` |
| `applicationsToday?` | `number` |
| `applications7d?` | `number` |
| `applications30d?` | `number` |
| `selectedApplications?` | `number` |
| `rejectedApplications?` | `number` |
| `avgMatchScore` | `number \| null` |
| `avgCvScore?` | `number \| null` |
| `avgAtsScore?` | `number \| null` |
| `savedJobs?` | `number` |
| `interviewRequests?` | `number` |
| `interviewPending?` | `number` |
| `interviewCompleted?` | `number` |
| `cvAnalyses?` | `number` |
| `lmsEnrollments?` | `number` |
| `aiMatches?` | `number` |
| `profileCompleteness?` | `number` |

### Phase 2 KPI fields (`HqEmployerAnalytics.kpis`)
| Parameter | Type |
|-----------|------|
| `tenants` | `number` |
| `agency` | `number` |
| `standalone` | `number` |
| `paused` | `number` |
| `onPlan` | `number` |
| `landingPurchases` | `number` |
| `landingTrials` | `number` |
| `openJobs` | `number` |
| `closedJobs?` | `number` |
| `jobs` | `number` |
| `candidates` | `number` |
| `candidates7d?` | `number` |
| `applications` | `number` |
| `applications7d?` | `number` |
| `interviews` | `number` |
| `interviewsToday?` | `number` |
| `interviewsScheduled?` | `number` |
| `interviewsCompleted?` | `number` |
| `placements` | `number` |
| `placementsJoined?` | `number` |
| `clients` | `number` |
| `tenantLeads` | `number` |
| `tasks?` | `number` |
| `tasksOpen?` | `number` |
| `hqLeads` | `number` |
| `hqLeadConversionRate` | `number` |
| `hqCompanies` | `number` |
| `hotLeads?` | `number` |
| `pipelineValue?` | `number` |
| `demosVerified` | `number` |
| `demosPurchases` | `number` |
| `demosTrials` | `number` |
| `followUpsToday` | `number` |

---

## How to use this sheet

1. Use the narrative sections above for domain context and parameter explanations.
2. Use this table sheet for quick lookup of `method + path + request + response`.
3. Prefer source files listed in the earlier **Recommended source files** section when updating either part of this document.
