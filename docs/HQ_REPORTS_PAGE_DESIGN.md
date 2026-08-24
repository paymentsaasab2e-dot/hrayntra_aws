# HQ Reports Page — Design & Build Guide

> **Product vision:** Headquarters reports should feel like a **full platform control tower**, not a three-card CRM snapshot.  
> **Scope:** This file lists **every HQ sidebar page**, **extra HQ surfaces**, and **every parameter HQ APIs return**. `/hq/reports` must follow this inventory.

Source of chrome: `frontphase2/src/components/hq/HqSidebar.tsx` (`HQ_NAV_ITEMS`)  
Source of APIs: `backendphase2/src/modules/hq/hq.routes.js` (`/api/v1/hq/...`)

---

## 0. What HQ reports must answer

| # | Question | Where it lives |
|---|----------|----------------|
| 1 | How is the **employee (Phase 1) portal** performing? | Employees pillar |
| 2 | How is the **employer (Phase 2 tenant) estate** performing? | Employers pillar |
| 3 | How is **HQ CRM** (leads → demo → trial → client) performing? | CRM pillar |
| 4 | How are **HQ team / billing ledgers** performing? | HQ ops pillar |
| 5 | Can HQ **export** the current view and **save custom reports**? | Export + Custom |

If a widget does not map to a real HQ page + API, it does not belong on this page.

---

## 1. Complete HQ sidebar inventory

Every item in `HQ_NAV_ITEMS` is listed here. Nothing in the HQ left nav is omitted.

### 1.1 Employees (Phase 1 / candidate portal)

| Sidebar label | Nav id | Route | Backend | Report page | Status |
|---------------|--------|-------|---------|-------------|--------|
| Dashboard | `dashboard` | `/hq?view=employee` | `GET /hq/analytics` → `employee` | `emp-overview` | Report |
| Candidates | `candidates` | `/hq/candidates` | `GET /hq/candidates` | `emp-candidates` | Report |
| KYC verified | `kycVerified` | `/hq/kyc-verified` | `GET /hq/kyc-interviewers` | `emp-kyc` | Report |
| Courses | `courses` | `/hq/courses` | `GET /hq/courses` | `emp-courses` | Report |
| Portal jobs | `portal` | `/hq/portal` | `GET /hq/portal` | `emp-jobs` | Report |
| Events | `events` | `/hq/events` | `GET /hq/events` | `emp-events` | Report |
| Subscriptions | `subscriptions` | `/hq/subscriptions` | `GET /hq/billing` → `candidate` + `GET /hq/phase1-tokens` | `emp-subscriptions` | Report |
| Tickets | `employeeTickets` | `/hq/tickets?audience=employee` | `GET /hq/help-tickets` | `emp-tickets` | Report |

### 1.2 Employers (Phase 2 tenants)

| Sidebar label | Nav id | Route | Backend | Report page | Status |
|---------------|--------|-------|---------|-------------|--------|
| Dashboard | `employerDashboard` | `/hq?view=employer` | `GET /hq/analytics` → `employer` | `er-overview` | Report |
| Companies | `company` | `/hq/company` | `GET /hq/companies` | `er-companies` | Report |
| Users | `tenants` | `/hq?tab=tenants` | `GET /hq/tenants` | `er-users` | Report |
| Subscriptions | `plans` | `/hq?tab=plans` | `GET /hq/tenants` + `GET /hq/billing` → `employer` + `GET /hq/packages` + `GET /hq/ai-features` | `er-plans` | Report |
| Tickets | `employerTickets` | `/hq/tickets?audience=employer` | `GET /hq/tickets` | `er-tickets` | Report |
| Recycle Bin | `recycleBin` | `/hq/recycle-bin` | `GET /hq/recycle-bin` | `er-recycle` | Report |

### 1.3 CRM (HQ CRM database only — never tenant CRM)

| Sidebar label | Nav id | Route | Backend | Report page | Status |
|---------------|--------|-------|---------|-------------|--------|
| Dashboard | `crmDashboard` | `/hq/crm-dashboard` | leads + companies + demos | `crm-overview` | Report |
| Leads | `leads` | `/hq/leads` | `GET /hq/leads` | `crm-leads` | Report |
| Clients | `clients` | `/hq/clients` | `GET /hq/companies` | `crm-clients` | Report |
| Demos / landing signups | *(tab on Leads, not its own sidebar item)* | `/hq/leads` → Demos | `GET /hq/demos` | `crm-demos` | Report |

### 1.4 HQ ops (Workspace group in sidebar)

| Sidebar label | Nav id | Route | Backend | Report page | Status |
|---------------|--------|-------|---------|-------------|--------|
| Team | `team` | `/hq/team` | `GET /hq/team` + `GET /hq/roles` + `GET /hq/permissions` | `ops-team` | Report |
| Reports | `reports` | `/hq/reports` | `GET/POST/PUT/DELETE /hq/reports` | `custom` | This page |
| Billing | `billing` | `/hq/billing` | `GET /hq/billing` | `ops-billing` | Report |
| Settings | `settings` | `/hq/settings` | Display currency only (no HQ data API) | — | Config UI, not an operational dataset |

### 1.5 Extra HQ surfaces (not in `HQ_NAV_ITEMS`, still HQ)

| Surface | Route | Backend | In reports? |
|---------|-------|---------|-------------|
| HQ login | `/hq/login` | HQ auth | No — auth, not data |
| Local bootstrap | `/hq?tab=bootstrap` | `POST /hq/setup` | No — local super-admin inject |
| Team → Roles tab | `/hq/team` roles | `GET/POST/PUT/DELETE /hq/roles` | Listed under Team parameters |
| Billing → Candidate / Employer tabs | `/hq/billing` | `GET /hq/billing` | `ops-billing` + emp/er subscription pages |
| Employer plans → AI costs | `/hq?tab=plans` AI subtab | `GET/PUT /hq/ai-features`, `GET/PUT /hq/ai-coin-packs` | Parameters listed; config more than records |
| Candidate token packs / spend / earns | `/hq/subscriptions` | `GET/PUT /hq/phase1-tokens*` | Parameters listed on emp-subscriptions |
| Candidate / employer billing ledger drawers | `/hq/billing/.../ledger` | `GET /hq/billing/candidate/:id/ledger`, `GET /hq/billing/employer/:key/ledger` | Per-entity; HQ billing page already lists transactions |
| Tenant impersonation | Users actions | `POST /hq/tenants/impersonate` | Action, not a report dataset |
| Logout | sidebar footer | `POST` logout | No |

---

## 2. UI structure (must match this tree)

```
HQ Reports
│
├── Employees
│   ├── Overview
│   ├── Candidates
│   ├── KYC / Interviewers
│   ├── Courses
│   ├── Portal jobs
│   ├── Events
│   ├── Subscriptions
│   └── Tickets
│
├── Employers
│   ├── Overview
│   ├── Companies
│   ├── Users
│   ├── Subscriptions
│   ├── Tickets
│   └── Recycle bin
│
├── CRM
│   ├── Overview
│   ├── Leads
│   ├── Clients
│   └── Demos & trials
│
├── HQ ops
│   ├── Team
│   └── Billing
│
└── Custom
    ├── Builder (dataset + group-by + metric)
    └── Saved HQ reports
```

**Layout**

1. Inner left nav grouped like the HQ sidebar (Employees / Employers / CRM / HQ ops / Custom).
2. Header: current page title, date range (All / 7d / 30d / 90d), Refresh, **Export**.
3. Body for every detailed page:
   - KPI cards (real counts from HQ APIs)
   - Breakdowns (bars by status / source / stage / plan)
   - **Records table** showing the actual rows (not only totals)
4. Export downloads a CSV of the **current page’s records table** (overview pages export KPI + breakdowns).

---

## 3. Detailed page contracts

### 3.1 Employees — Overview (`emp-overview`)

KPIs: candidates, portal vs common vs Phase 2 candidates, KYC live, courses published, portal jobs, events, help tickets open, candidate token purchases.  
Breakdowns: candidate origin, KYC status mix, course publish mix, help-ticket status.  
Table: latest 50 candidates (name, email, origin, status, KYC).

### 3.2 Employees — Candidates (`emp-candidates`)

KPIs: total, portal, common pool, Phase 2 CRM, KYC verified.  
Breakdowns: origin, status, stage.  
Table: all loaded candidates — name, email, phone, title, location, origin, status, stage, KYC, interviewer, tenant DB, created.

### 3.3 Employees — KYC / Interviewers (`emp-kyc`)

KPIs: total, applicants, interviewers, KYC verified, pending HQ verify, live for candidates.  
Breakdowns: kind, HQ verified, live flag.  
Table: name, email, phone, kind, application status, KYC, HQ verified, live, company, role, experience, price, created.

### 3.4 Employees — Courses (`emp-courses`)

KPIs: total, published, draft, premium, enrollments.  
Breakdowns: published vs draft, category, access tier.  
Table: title, category, level, published, enrollments, token cost, certified, instructor, lessons, hours.

### 3.5 Employees — Portal jobs (`emp-jobs`)

KPIs: total jobs, portal-only, tenant jobs, Phase 2 jobs.  
Breakdowns: origin, status, work mode.  
Table: title, company, location, status, work mode, origin, openings, posted by, tenant DB, visibility, posted.

### 3.6 Employees — Events (`emp-events`)

KPIs: total, published, cancelled, registrations.  
Breakdowns: published, type, mode.  
Table: title, type, mode, location, scheduled, published, status, registrations, access, token cost, created by.

### 3.7 Employees — Subscriptions (`emp-subscriptions`)

KPIs: candidate purchases, unique buyers, tokens sold, tokens spent, grants.  
Breakdowns: pack / type.  
Table: candidate billing transactions — email, name, type, tokens, amount, direction, pack, service, date.

### 3.8 Employees — Tickets (`emp-tickets`)

KPIs: total, open, in progress, closed.  
Breakdowns: status, category.  
Table: id, name, email, category, subject, status, source, created.

### 3.9 Employers — Overview (`er-overview`)

KPIs: tenants, agency vs standalone, companies, tenants on plan, monthly/annual cycles, open employer tickets, recycle-bin count.  
Breakdowns: org type, signup source, plan, ticket status.  
Table: latest tenants — org, email, type, source, plan, status, created.

### 3.10 Employers — Companies (`er-companies`)

KPIs: total, active, inactive, on hold, closed.  
Breakdowns: status, industry, country, owner.  
Table: name, contact, email, status, industry, owner, country, source, tenant DB, created.

### 3.11 Employers — Users (`er-users`)

KPIs: total, agency, standalone, landing trial, landing purchase.  
Breakdowns: type, source, plan, status.  
Table: name, email, login, type, source, plan, product line, tenant DB, paused, created.

### 3.12 Employers — Subscriptions (`er-plans`)

KPIs: tenants on plan, monthly cycles, annual cycles, landing purchases, purchase requests.  
Breakdowns: plan name, billing cycle, trial vs paid.  
Table: tenant cycles — org, email, plan, cycle, trial, status, price, dates.

### 3.13 Employers — Tickets (`er-tickets`)

KPIs: total, open, in progress, resolved, closed, high priority.  
Breakdowns: status, priority, category.  
Table: ticket number, subject, org, status, priority, category, raised by, email, tenant DB, created.

### 3.14 Employers — Recycle bin (`er-recycle`)

KPIs: deleted tenant count.  
Table: name, email, tenant DB, deleted at, deleted by.

### 3.15 CRM — Overview (`crm-overview`)

KPIs: leads, converted, lost, conversion %, open pipeline, demo stage, trial stage, clients, demos, trials granted.  
Breakdowns: lead stage, lead source, client status, demo status.  
Table: latest leads — name, company, stage, source, owner, pipeline, created.

### 3.16 CRM — Leads (`crm-leads`)

KPIs: total, new, demo, trial, contacted, qualified, converted, lost, pipeline.  
Breakdowns: stage, source, owner, score.  
Table: name, company, email, phone, stage, source, owner, score, industry, country, pipeline, modules, next follow-up, created.

### 3.17 CRM — Clients (`crm-clients`)

KPIs: total, active, inactive, on hold, closed.  
Breakdowns: status, industry, owner, country.  
Table: name, contact, email, phone, status, industry, owner, country, source, created.

### 3.18 CRM — Demos & trials (`crm-demos`)

KPIs: total, pending, verified, expired, trials granted.  
Breakdowns: status, request kind, trial granted.  
Table: name, email, company, kind, status, trial, package, cycle, submitted, trial start/end.

### 3.19 HQ ops — Team (`ops-team`)

KPIs: total, active, inactive.  
Breakdowns: status, role, department.  
Table: name, email, role, department, status, phone, designation, rank, reports to, login, created.

### 3.20 HQ ops — Billing (`ops-billing`)

KPIs: candidate purchases/spends/grants, employer tenants on plan, monthly/annual cycles, landing purchases, purchase requests.  
Breakdowns: candidate pack/type, employer billing cycle.  
Table: unified ledger — side (candidate/employer), name, email, type, amount, direction, date.

### 3.21 Custom (`custom`)

Builder datasets: leads, clients, demos, tenants, companies, tickets, help tickets, team, candidates, kyc, courses, jobs, events.  
Save via `POST /hq/reports`. Load/delete from saved list. Export grouped rows.

---

## 4. Shared behaviours

- **Date range** filters rows by `createdAt` / `submittedAt` / `scheduledAt` / `postedDate` / `occurredAt` / `deletedAt` when the field exists.
- **Failed APIs** must not blank the whole page — load each HQ source independently.
- **Export** is always visible; CSV file name = `hq-{pillar}-{page}-{date}.csv`.
- **No tenant CRM leakage** — CRM reports use headquarters collections (`/hq/leads`, `/hq/companies`, `/hq/demos`) only.
- Employees vs employers tickets are **different APIs** (help-tickets vs support tickets). Never mix them.

---

## 5. Files

| File | Role |
|------|------|
| `frontphase2/src/app/hq/reports/page.tsx` | Page shell, independent HQ API load, page switcher |
| `frontphase2/src/app/hq/reports/hqReportsCatalog.ts` | Pillars + page ids (this tree) |
| `frontphase2/src/app/hq/reports/hqReportsBuild.ts` | Grouping, date filter, CSV |
| `frontphase2/src/app/hq/reports/hqReportsViews.ts` | Per-page KPIs, breakdowns, records, and export rows |
| `frontphase2/src/app/hq/reports/HqReportsNav.tsx` | Inner grouped nav |
| `frontphase2/src/app/hq/reports/HqReportRecordsTable.tsx` | Detailed records table |
| `backendphase2/src/modules/hq/hq-reports.service.js` | Saved custom report definitions |
| `GET/POST/PUT/DELETE /hq/reports` | Custom report CRUD |

---

## 6. Definition of done

- `/hq/reports` is **not** a 3-card CRM summary.
- Every HQ Employees, Employers, CRM, **Team**, and **Billing** page has a matching detailed report with KPIs + breakdowns + a records table.
- This document lists **every HQ sidebar item** and **every HQ API parameter** (section 7).
- Export works on the current detailed page.
- Custom reports can be saved and reopened for HQ.

---

## 7. HQ parameter catalog (every field)

These are the parameters HQ actually stores / returns. Report tables show the operational columns from section 3. Drawer-only fields stay on the source HQ page.

### 7.1 Candidates (`GET /hq/candidates`) — `HqPortalCandidateRow`

`id`, `name`, `email`, `phone`, `title`, `location`, `status`, `source`, `stage`, `tenantDbName`, `origin` (`phase1_portal` \| `phase1_common` \| `phase2_crm`), `kycVerified`, `isInterviewer`, `createdAt`, `updatedAt`.

### 7.2 KYC / interviewers (`GET /hq/kyc-interviewers`) — `HqKycInterviewerRow`

`id`, `applicationId`, `name`, `email`, `phone`, `currentRole`, `currentCompany`, `yearsOfExperience`, `interviewPrice`, `expertiseAreas[]`, `interviewTypes[]`, `languages[]`, `weeklyAvailability`, `aboutYourself`, `feedbackStyle`, `linkedinUrl`, `resumeUrl`, `profilePhotoUrl`, `dateOfBirth`, `passportNumber`, `applicationStatus`, `profileStatus`, `reviewedBy`, `reviewNotes`, `kycVerified`, `kycMissing[]`, `hqVerified`, `liveForCandidates`, `kind` (`applicant` \| `interviewer`), `createdAt`, `updatedAt`.

### 7.3 Courses (`GET /hq/courses`) — `HqCourseRow`

`id`, `title`, `description`, `category`, `level`, `thumbnailUrl`, `videoUrl`, `instructorName`, `instructorAvatar`, `totalLessons`, `estimatedHours`, `tags[]`, `isPublished`, `accessTier`, `tokenCost`, `isCertified`, `enrolledCount`, `createdAt`, `updatedAt`.  
Stats: `total`, `published`, `draft`, `premium`, `enrollments`.

### 7.4 Portal jobs (`GET /hq/portal`) — `HqPortalJobRow`

`id`, `title`, `company`, `location`, `status`, `workMode`, `tenantDbName`, `postedBy`, `openings`, `visibility`, `origin` (`phase1_portal` \| `phase2_crm`), `postedDate`, `updatedAt`.  
Stats: `totalCandidates`, `portalCandidates`, `commonCandidates`, `phase2Candidates`, `totalJobs`, `phase2Jobs`, `tenantJobs`, `portalOnlyJobs`, `tenantCount`.

### 7.5 Events (`GET /hq/events`) — `PortalEventRow`

`id`, `title`, `description`, `location`, `sections[]`, `media[]`, `type`, `mode`, `scheduledAt`, `durationMinutes`, `isPublished`, `status` (`active` \| `cancelled`), `registrationCount`, `createdByName`, `createdByEmail`, `accessType` (`free` \| `purchase`), `tokenCost`, `isFree`, `ctaLabel`.

### 7.6 Candidate subscriptions / tokens

**Billing transactions** (`GET /hq/billing` → `candidate.transactions`): `id`, `candidateId`, `candidateName`, `candidateEmail`, `candidatePhone`, `type`, `label`, `amount`, `direction` (`credit` \| `debit`), `unit`, `balanceAfter`, `packageId`, `packageName`, `service`, `reference`, `description`, `occurredAt`.

**Overview candidate KPIs:** `totalPurchases`, `totalSpends`, `totalGrants`, `totalTokensSold`, `totalTokensSpent`, `uniqueBuyers`, `activePackTypes`, `totalTransactions`.

**Phase 1 token config** (`GET /hq/phase1-tokens`) — packs: `id`, `name`, `tokens`, `priceAmount`, `priceLabel`, `currency`, `description`, `popular`, `active`, `sortOrder`.  
Services: `id`, `name`, `description`, `cost`, `category`, `defaultCost`, `isCustomCost`.  
Earn tasks: `id`, `name`, `description`, `tokens`, `category`, `order`, `defaultTokens`, `isCustomTokens`.

### 7.7 Employee help tickets (`GET /hq/help-tickets`) — `HqHelpTicket`

`id`, `createdAt`, `name`, `email`, `category`, `subject`, `description`, `problemId`, `userId`, `status` (`open` \| `in_progress` \| `closed`), `source`.  
Stats: `total`, `open`, `inProgress`, `closed`.

### 7.8 Tenants / Users (`GET /hq/tenants`) — `HqTenantRow`

`id`, `name`, `email`, `loginId`, `organizationType` (`agency` \| `standalone`), `organizationName`, `signupSource` (`landing_purchase` \| `landing_trial` \| `hq_manual`), `productLine` (`crm` \| `recruitment`), `enabledModules[]`, `modulesRestricted`, `phase1CommonPoolEnabled`, `subscriptionPlan` (see 7.9), `tenantDbName`, `tenantProvisioningMode`, `status`, `pausedAt`, `pausedBy`, `createdAt`, `updatedAt`, `isLandingSignupOnly`, `isDeleted`, `deletedAt`, `deletedBy`, `source`.

### 7.9 Tenant subscription plan (nested on tenant)

`id`, `name`, `billingCycle` (`monthly` \| `annual`), `maxUsers`, `maxJobs`, `planStartDate`, `planEndDate`, `isTrial`, `trialDays`, `upgradedAt`, `upgradedFrom`, `lastPaymentReference`, `purchasedAt`, `employerDemoRequestId`, `upgradedBy`, `coins`, `price`.

### 7.10 Employer companies / CRM clients (`GET /hq/companies`) — `HqCompanyApiRow`

Same collection for **Employers → Companies** and **CRM → Clients**.

`id`, `name`, `contact`, `industry`, `score` (`Hot` \| `Warm` \| `Cold`), `users`, `owner`, `status` (`active` \| `inactive` \| `on_hold` \| `closed`), `nextFollowUp`, `nextFollowUpAt`, `email`, `phone`, `website`, `logo`, `country`, `state`, `city`, `estimatedDealValue`, `companySource`, `interestedModules[]`, `initialNotes`, `createdAt`, `directorName`, `directorSalutation`, `emails[]`, `phones[]`, `companySize`, `location`, `hiringLocations`, `servicesNeeded`, `expectedBusinessValue`, `linkedin`, `timezone`, `priority`, `sla`, `leadStatus`, `latitude`, `longitude`, `teamMemberDesignation`, `teamMemberEmail`, `teamMemberPhone`, `otherDetails[]`, `assignedToId`, `formSchema`, `convertedFromLeadId`, `companyTag`, `hqProductLine`, `tenantDbName`, `tenantAdminEmail`, `tenantProvisionedAt`, plus follow-ups / remarks arrays.

### 7.11 Employer tickets (`GET /hq/tickets`) — `HqSupportTicket`

`id`, `ticketNumber`, `subject`, `description`, `priority` (`low` \| `medium` \| `high` \| `urgent`), `status` (`open` \| `in_progress` \| `resolved` \| `closed`), `category` (`general` \| `billing` \| `technical` \| `account` \| `feature`), `tenantDbName`, `organizationName`, `raisedByUserId`, `raisedByName`, `raisedByEmail`, `hqNotes`, `createdAt`, `updatedAt`.

### 7.12 Recycle bin (`GET /hq/recycle-bin`)

Same `HqTenantRow` fields, with `isDeleted`, `deletedAt`, `deletedBy` populated.

### 7.13 Leads (`GET /hq/leads`) — `HqLeadApiRow`

`id`, `name`, `company`, `industry`, `score` (`Hot` \| `Warm` \| `Cold`), `users`, `owner`, `stage` (`new` \| `demo` \| `trial` \| `contacted` \| `qualified` \| `converted` \| `lost`), `nextFollowUp`, `nextFollowUpAt`, `email`, `phone`, `country`, `state`, `city`, `estimatedDealValue`, `leadSource`, `leadSourceDetail`, `interestedModules[]`, `initialNotes`, `createdAt`, `convertedToCompanyId`, `contactPerson`, `directorName`, `directorSalutation`, `emails[]`, `phones[]`, `type`, `source`, `status`, `priority`, `website`, `companyLinks[]`, `linkedIn`, `location`, `designation`, `latitude`, `longitude`, `campaignName`, `campaignLink`, `referralName`, `sourceWebsiteUrl`, `sourceLinkedInUrl`, `sourceEmail`, `teamMemberDesignation`, `teamMemberEmail`, `teamMemberPhone`, `otherDetails[]`, `interestedNeeds`, `servicesNeeded`, `expectedBusinessValue`, `notes`, `assignedToId`, `assignedToIds[]`, `assignedToUsers[]`, `formSchema`, `hqProductLine`, `hqProductLines[]`, `employerDemoRequestId`, `preferredDemoDate`, `preferredDemoTime`, plus `followUps[]` and `remarks[]`.

Follow-up: `id`, `type`, `scheduledAt`, `notes`, `status`, `createdAt`, `createdByEmail`, `completedAt`.  
Remark: `id`, `text`, `createdAt`, `createdByEmail`.

### 7.14 Demos / landing signups (`GET /hq/demos`) — `HqDemoRequestRow`

`id`, `fullName`, `email`, `organizationName`, `countryCode`, `dialCode`, `phoneNumber`, `companySize`, `outcome`, `requestKind` (`demo` \| `trial` \| `purchase`), `packageSlug`, `packageName`, `billingCycle`, `trialProvisioned`, `trialTenantDbName`, `trialLoginId`, `trialDays`, `trialStartsAt`, `trialEndsAt`, `trialLoginUrl`, `credentialsSentAt`, `status` (`PENDING` \| `VERIFIED` \| `EXPIRED`), `emailVerifiedAt`, `createdAt`, `submittedAt`.

### 7.15 Team (`GET /hq/team`) — `HqTeamMemberRow`

`id`, `name`, `firstName`, `lastName`, `email`, `role`, `roleId`, `roleColor`, `permissionIds[]`, `phone`, `designation`, `status` (`active` \| `inactive`), `department`, `rank`, `reportsToId`, `reportsToName`, `loginId`, `hasCredentials`, `createdAt`, `updatedAt`.  
*(Temporary passwords are returned only at create time — never list them in reports.)*

**Roles** (`GET /hq/roles`): `id`, `roleName`, `description`, `color`, `permissionIds[]`, `isSystem`, `createdAt`, `updatedAt`.  
**Permissions** (`GET /hq/permissions`): `id`, `permissionName`, `module`, `description`.

### 7.16 Billing (`GET /hq/billing`)

**Employer transactions:** `id`, `tenantId`, `tenantName`, `email`, `tenantDbName`, `type`, `label`, `amount`, `direction`, `unit`, `balanceAfter`, `reference`, `description`, `featureId`, `packId`, `occurredAt`, `actorEmail`.

**Tenant cycles:** `tenantId`, `tenantName`, `email`, `tenantDbName`, `signupSource`, `planName`, `planId`, `billingCycle`, `price`, `planStartDate`, `planEndDate`, `purchasedAt`, `lastPaymentReference`, `isTrial`, `aiCoins`, `status`, `createdAt`, `updatedAt`.

**Purchase requests:** `id`, `fullName`, `email`, `organizationName`, `requestKind`, `packageName`, `packageSlug`, `billingCycle`, `trialProvisioned`, `trialTenantDbName`, `status`, `submittedAt`, `createdAt`.

**Overview employer KPIs:** `totalTenants`, `tenantsOnPlan`, `monthlyCycles`, `annualCycles`, `landingPurchases`, `purchaseRequests`, `coinPurchases`, `coinSpends`, `totalTransactions`.

### 7.17 Employer packages (`GET /hq/packages`)

`id`, `name`, `displayName`, `description`, `price`, `yearlyPrice`, `pricePeriod`, `features[]`, `isPopular`, `maxUsers`, `maxJobs`, `annualMaxUsers`, `annualMaxJobs`.

### 7.18 AI features / coin packs (Employer Subscriptions AI subtab)

**Features** (`GET /hq/ai-features`): `id`, `name`, `description`, `coins`, `category`, `defaultCoins`, `isCustomCost`, `locked`, `affordable`.  
**Coin packs** (`GET /hq/ai-coin-packs`): `id`, `name`, `coins`, `priceUsd`, `priceLabel`, `description`, `popular`, `active`, `sortOrder`.

### 7.19 Settings (`/hq/settings`)

Not an HQ data collection. Parameters: display `currency` (UI only; stored amounts stay in HQ base currency), FX `rates`, `fxDate`, `fxFetchedAt`. Roles / AI / tokens do **not** live here — roles are Team, AI costs are Employer Subscriptions, candidate tokens are Employee Subscriptions.

### 7.20 Employee / employer dashboards (`GET /hq/analytics`)

Used as supporting KPIs on `emp-overview` / `er-overview`. Employee KPIs include candidate/job/application/interview/LMS/session/live-tracking counts. Employer KPIs include tenant/job/user/plan counts. These are aggregates, not record rows.

### 7.21 Custom saved reports (`GET /hq/reports`) — `HqCustomReportRow`

`id`, `name`, `dataset` (`leads` \| `clients` \| `demos` \| `tenants` \| `tickets` \| `team` \| `candidates` \| `kyc` \| `courses` \| `jobs` \| `events` \| `helpTickets` \| `companies`), `groupBy`, `metric` (`count` \| `pipeline`), `dateFrom`, `dateTo`, `createdAt`, `updatedAt`, `createdByEmail`.
