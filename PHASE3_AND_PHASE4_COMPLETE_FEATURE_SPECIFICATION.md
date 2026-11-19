# CareerOS / Framework HRMS — Complete Phase 3 & Phase 4 Feature Specification
**Document Type:** Enterprise Product Feature & Production Utilization Blueprint  
**Market Focus:** Indian SME, Mid-Market & Enterprise Ecosystem  
**Target Systems:** `D:\careerOS-prod\phase 3` (Frontend & Backend Live Codebase) & `D:\careerOS-prod\phase 4` (Next-Phase Payroll, Mobile & Statutory Modules)  
**Date:** October 2026  

---

## Executive Summary & System Architecture

The platform is an end-to-end multi-tenant **Workforce Operating System & HRMS** built specifically for the operational realities of the Indian market. It addresses critical Indian enterprise pain points: **fake/buddy attendance punching across distributed sites, unorganized WhatsApp leave approvals, manual Indian CTC (PF/ESI/PT/TDS) calculations, chaotic joiner onboarding, untracked IT assets (laptops/SIMs/ID cards), loose policy enforcement, messy notice-period resignations, and untracked field sales forces.**

The architecture is divided into two operational phases:
1. **Phase 3 (Live System in `phase 3/`):** Full-stack web platform consisting of:
   - **Backend (`phase 3/backend/hrms-backend`):** Node.js/Express, TypeScript, Prisma ORM, MongoDB, JWT auth with multi-tenant data isolation, role-based access control (RBAC), and materialized-path org hierarchy.
   - **Frontend (`phase 3/frontend/hrms-frontend`):** Next.js App Router, React 19, TypeScript, Tailwind CSS, custom design system atomics/molecules (`packages/ui`), Leaflet/OpenStreetMap geospatial visualization, and Lucide icons.
2. **Phase 4 (Enterprise Extensions in `phase 4/`):** Designated architectural extension layer covering **Full Indian Statutory Payroll (EPFO ECR, ESIC returns, Form 16, Bank NEFT batch files), Native Cross-Platform Mobile App (Android/iOS geofence auto-punch), Biometric Hardware Bridge, WhatsApp HR Bot, Public ATS/Career Portal, Razorpay SaaS Billing, and DPDP Act 2023 compliance.**

---

```
                                      ┌─────────────────────────────────────────────────────────────┐
                                      │              PLATFORM OWNER CONSOLE (/superadmin)           │
                                      │   Tenants (Clients) • Packages • Subscriptions • Leads      │
                                      └──────────────────────────────┬──────────────────────────────┘
                                                                     │ Provisions Client Tenant
                                                                     ▼
                                      ┌─────────────────────────────────────────────────────────────┐
                                      │               TENANT HQ ADMIN PORTAL (/login)               │
                                      │  Org Tree • Roles • Work Locations • Master Policies • Approvals
                                      └──────────────┬──────────────────────────────┬───────────────┘
                                                     │                              │
                     ┌───────────────────────────────┴──────────┐        ┌──────────┴───────────────────────────────┐
                     ▼                                          ▼        ▼                                          ▼
     ┌──────────────────────────────┐            ┌──────────────────────────────┐            ┌──────────────────────────────┐
     │      DIVISION MANAGERS       │            │       SITE SUPERVISORS       │            │          EMPLOYEES           │
     │ Org Subtree • Team Leaves/Punches│        │ Local Site Attendance • Tasks│            │ Self-Service Punch • Apply Leave│
     └──────────────────────────────┘            └──────────────────────────────┘            └──────────────────────────────┘
```

---

# PART 1: PHASE 3 — LIVE SYSTEM FEATURES (FRONTEND & BACKEND)

Below is the complete, granular breakdown of every module, route, function, backend API, database model, purpose, and exact utilization in production for Indian clients.

---

### Module 1: Two-Layer Architecture & Multi-Tenant SaaS Platform Console

#### 1. Backend Implementation (`hrms-backend/src/modules/platform`)
- **Prisma Models:** `Tenant`, `TenantHierarchyLevel`, `TenantApprovalLevel`, `TenantPackageKey` (STARTER, PROFESSIONAL, ENTERPRISE).
- **Routes & Controllers (`platform.routes.ts`, `platform.controller.ts`):**
  - `GET /api/platform/stats` — Aggregates active tenants, user count, licenses, and revenue metrics.
  - `GET /api/platform/tenants` — Lists all client companies with status, user counts, and plan details.
  - `GET /api/platform/tenants/:id` — Fetches complete tenant profile, provisioned admin, and enabled module chips.
  - `GET /api/platform/tenants/:id/credentials` — Retrieves provisioned admin credentials for handover.
  - `POST /api/platform/tenants` — Creates a new tenant company, seeds root HQ org unit, generates hierarchy levels (L1 HQ, L2 Division, L3 Site), and creates tenant admin user.
  - `PATCH /api/platform/tenants/:id` — Updates company profile, status (`ACTIVE`, `INACTIVE`, `SUSPENDED`), and toggles (e.g. `showUsersLocationColumn`).
  - `PATCH /api/platform/tenants/:id/admin` — Resets or updates tenant admin login credentials.
  - `PATCH /api/platform/tenants/:id/package` — Upgrades/downgrades plan package and overrides granular module permissions.
  - `DELETE /api/platform/tenants/:id` — Suspends/purges tenant data with fail-closed security.
  - `GET /api/platform/packages` — Returns predefined SaaS tiers (Starter: 25 users; Professional: 100 users; Enterprise: unlimited).
- **Tenant Isolation Middleware (`src/shared/tenant/resolve-tenant.ts`, `org-scope.service.ts`):** Fail-closed multi-tenancy. Every request extracts `tenantId` from verified JWT. Strict filter prevents Tenant A from querying or modifying Tenant B's employees, punches, leaves, or documents.

#### 2. Frontend Implementation (`hrms-frontend/src/app/superadmin`)
- **Pages & Routes:**
  - `/superadmin/login` — Dedicated login for platform owner (`PLATFORM_OWNER` role).
  - `/superadmin/dashboard` — Platform overview, tenant distribution, growth cards.
  - `/superadmin/tenants` — Interactive client list with package badges, status toggles, quick credentials view.
  - `/superadmin/tenants/new` — 3-step wizard to create client: Company Details, Hierarchy Levels builder, Tenant Admin credentials, and Module Permission chips.
  - `/superadmin/tenants/[id]` — Tenant detail hub: edit metadata, reset passwords, suspend/reactivate client, view read-only org tree, customize enabled modules.
  - `/superadmin/leads` — Inbound sales pipeline tracker for trial and demo requests.
  - `/superadmin/subscriptions` — Client licensing, seat utilization vs package limits.

#### 3. Purpose & Core Value
Separates the **Software Vendor (You / Platform Owner)** from the **Client (Tenant HQ Admin)**. The vendor provisions and manages client organizations and licenses without meddling in private employee attendance or salary records.

#### 4. Production Utilization in the Indian Market
- **B2B SaaS Commercial Model:** Sell subscriptions to Indian SMEs, CA firms, manufacturing groups, and retail chains.
- **Controlled Pilots & Tiered Monetization:** Offer a 25-user Starter plan for small clinics or IT startups, upgrade to 100-user Professional for mid-market distributors, and deploy Enterprise for multi-branch companies.
- **Immediate Tenant Provisioning:** Sales teams can spin up a dedicated, isolated portal for a client in 60 seconds with their custom corporate branding and admin credentials.

---

### Module 2: Tenant HQ Administration & Role-Based Access Control (RBAC)

#### 1. Backend Implementation (`hrms-backend/src/modules/users`, `auth`)
- **Prisma Models:** `User`, `Role` (`PLATFORM_OWNER`, `ADMIN`, `HR`, `MANAGER`, `EMPLOYEE`), `UserAccountStatus` (`ACTIVE`, `INACTIVE`).
- **Permissions Engine (`src/shared/permissions.ts`):** 
  - 19 functional tabs: `dashboard`, `employees`, `onboarding`, `tasks`, `attendance`, `leave`, `timeOff`, `performance`, `approvals`, `documents`, `reports`, `locations`, `orgStructure`, `userManagement`, `assets`, `policies`, `separations`, `fieldVisits`, `settings`.
  - 21 granular actions: `employees_create`, `employees_edit`, `employees_delete`, `tasks_create`, `tasks_approve`, `leaves_apply`, `leaves_approve`, `attendance_punch_self`, `attendance_punch_hr`, `attendance_punch_remote_self`, `attendance_approve_late`, `reports_view`, `locations_manage`, `org_manage`, `users_manage`, `documents_manage`, `assets_manage`, `policies_manage`, `separation_manage`, `field_visits_manage`.
- **Routes & Controllers (`user.routes.ts`, `auth.routes.ts`):**
  - `POST /api/auth/login` — Issues tenant-scoped JWT with user role, display name, and computed permission matrix.
  - `GET /api/auth/profile` — Returns current logged-in user context.
  - `GET /api/users` — Lists all users in the tenant with org unit and employee mappings.
  - `POST /api/users` — Creates user account with customized permission overrides, enforces package seat ceiling (blocks user creation if `maxUsers` reached).
  - `PUT /api/users/:id` — Edits user profile, role, and permission flags.
  - `DELETE /api/users/:id` — Deactivates/removes user account.
  - Automatic Welcome Email via Resend (`src/shared/provisioning/memberProvisioning.ts`).

#### 2. Frontend Implementation (`hrms-frontend/src/app/users`, `/login`, `AppShell.tsx`)
- **Pages & Routes:**
  - `/login` — Unified branded login for client employees, managers, HR, and Tenant Admins.
  - `/users` — User management directory with search, role filters, seat usage meter, and status badges.
- **Drawers & Modals:**
  - `UserCreateModal` / `UserEditModal` — Create/edit user, select role template (`ADMIN`, `HR`, `MANAGER`, `EMPLOYEE`), link to existing `Employee` record, and fine-tune permission checkboxes.
  - Dynamic Navigation Rendering (`AppShell.tsx`): The sidebar strictly filters visible modules based on the user's role and package ceiling. An employee only sees self-service tabs; an HR sees operational modules; Tenant Admin sees all client modules.

#### 3. Purpose & Core Value
Provides ironclad data governance. Prevents unauthorized staff from accessing confidential CTCs, salary registers, or employee personal documents while empowering HR and managers with necessary tools.

#### 4. Production Utilization in the Indian Market
- **Branch & Hierarchy Segregation:** Indian companies often have floor managers or site supervisors who need to check attendance but must NEVER see salary or delete employee records.
- **Seat Limit Enforcement:** Indian SaaS buyers purchase fixed seat packages (e.g. 50 seats). The system enforces this cap, prompting an upsell when the client attempts to add employee #51.
- **WhatsApp-Free Credential Delivery:** Sends automated welcome emails with initial login credentials directly to joiners, eliminating insecure password sharing on WhatsApp.

---

### Module 3: Multi-Tier Org Hierarchy & Subtree Scoping

#### 1. Backend Implementation (`hrms-backend/src/modules/org-units`, `approvals`)
- **Prisma Models:** `OrgUnit`, `TenantHierarchyLevel`, `TenantApprovalLevel`, `ApprovalRequest`.
- **Materialized Path Structure:** Each `OrgUnit` stores `path` (`/{tenantId}/{hqId}/{divisionId}/{siteId}/`), allowing lightning-fast subtree queries using `path.startsWith()`.
- **Routes & Controllers (`org-unit.routes.ts`, `org-unit.controller.ts`):**
  - `GET /api/org-units` — Fetches nested hierarchy tree based on user's authorized scope.
  - `GET /api/org-units/:id` — Returns single org unit with assigned employees, locations, and managers.
  - `POST /api/org-units` — Creates new node. If created by a Branch Manager, status is set to `PENDING_HQ_APPROVAL` and creates an `ApprovalRequest` for HQ Admin. If created by Tenant Admin, automatically `ACTIVE`.
  - `PUT /api/org-units/:id` — Edits org unit name, parent, or level.
  - `POST /api/org-units/:id/approve` — Tenant Admin approves division/site creation.
  - `POST /api/org-units/:id/reject` — Rejects proposed org unit with remarks.
  - `DELETE /api/org-units/:id` — Deletes empty org unit.
- **Org Scope Middleware (`src/shared/org/org-scope.service.ts`):**
  - HQ (`ADMIN`, `HR`): Tenant-wide scope across all divisions and sites.
  - Division Manager (`MANAGER`): Scoped strictly to their division and descendant operational sites.
  - Site Employee (`EMPLOYEE`): Scoped only to self.

#### 2. Frontend Implementation (`hrms-frontend/src/app/org-structure`, `headquarters/org-structure`)
- **Pages & Routes:**
  - `/org-structure` — Interactive visual org tree viewer displaying HQ Root $\to$ Divisions $\to$ Operational Sites with headcount pills, branch manager badges, and pending approval markers.
- **Drawers & Modals:**
  - `AddOrgUnitDrawer` — Dynamic level selector (Level 1: Headquarters, Level 2: Division/Regional Office, Level 3: Factory/Store/Branch Site).
  - Quick-action buttons to assign branch managers, link geofenced work locations, and trigger approval requests.

#### 3. Purpose & Core Value
Solves the complexity of Indian multi-location businesses (e.g. Head Office in Mumbai, Divisions in North/South/West, and Retail Stores/Depots across 50 cities).

#### 4. Production Utilization in the Indian Market
- **Delegated Branch Management:** Regional managers in Delhi can propose adding a new Gurgaon depot or showroom; Head Office in Mumbai retains full approval authority before it goes live.
- **Zero Cross-Branch Leakage:** Branch Manager of Pune cannot peek into Bangalore branch data, preventing internal salary friction and customer list poaching.

---

### Module 4: Employee Directory & 360° Profile Management

#### 1. Backend Implementation (`hrms-backend/src/modules/employees`)
- **Prisma Models:** `Employee`, `EmployeeStatus` (`ACTIVE`, `INACTIVE`, `TERMINATED`, `ON_LEAVE`).
- **Fields:** `employeeId` (e.g. EMP001), `firstName`, `lastName`, `email`, `phone`, `designation`, `department`, `joiningDate`, `probationEndDate`, `locationId`, `orgUnitId`, `reportsToUserId`, `totalLeaves`.
- **Routes & Controllers (`employee.routes.ts`, `employee.controller.ts`):**
  - `GET /api/employees` — Retrieves list of employees with search, department, location, and status filters, scoped by org hierarchy.
  - `GET /api/employees/:id` — Comprehensive 360° view including active asset allocations, leave history, document vault, tasks, attendance log, and compensation profile.
  - `POST /api/employees` — Creates employee record, binds to `WorkLocation` and `OrgUnit`.
  - `PUT /api/employees/:id` — Updates personal info, reporting manager, probation status, designation.
  - `DELETE /api/employees/:id` — Soft-deactivates employee.

#### 2. Frontend Implementation (`hrms-frontend/src/app/employees`, `/employees/[id]`)
- **Pages & Routes:**
  - `/employees` — Table/Grid view with employee avatars, designation badges, location pills, status indicators, and export buttons.
  - `/employees/[id]` — Tabbed 360° Profile Hub:
    - *Overview Tab:* Personal details, reporting manager, joining date, probation tracker, emergency contact.
    - *Attendance Tab:* Monthly calendar, punch timeline, late marks count.
    - *Leave Tab:* Available balances (CL/SL/EL), leave application history.
    - *Assets Tab:* List of all issued laptops, phones, tools with serial numbers and return dates.
    - *Documents Tab:* Uploaded Aadhaar, PAN, offer letter, educational certificates.
    - *Compensation Tab:* CTC breakdown, gross pay, deductions.
- **Drawers & Modals:**
  - `AddEmployeeDrawer` — Validated multi-field form with department dropdown, auto-suggested employee IDs, and location binding.

#### 3. Purpose & Core Value
Centralizes employee data in one single source of truth, completely eliminating scattered Excel sheets, paper folders, and lost employee records.

#### 4. Production Utilization in the Indian Market
- **Probation Tracking:** Indian companies typically have a 3 to 6-month probation period. Automated tracking notifies HR before confirmation to review performance.
- **Audit & Regulatory Compliance:** Readily accessible employee records fulfill mandatory requirements under Indian State Shops and Establishment Acts and Factories Act.

---

### Module 5: Geofenced GPS Attendance & Anti-Buddy Punch System

#### 1. Backend Implementation (`hrms-backend/src/modules/attendance`, `locations`)
- **Prisma Models:** `Attendance`, `WorkLocation`, `AttendanceStatus` (`PRESENT`, `ABSENT`, `LATE`, `HALFDAY`), `AttendancePunchStatus` (`ACCEPTED`, `REJECTED`).
- **Geofence Engine (`src/modules/attendance/attendance.service.ts`):**
  - Computes exact distance using Haversine formula:
    $$d = 2R \arcsin\left(\sqrt{\sin^2\left(\frac{\Delta \phi}{2}\right) + \cos(\phi_1)\cos(\phi_2)\sin^2\left(\frac{\Delta \lambda}{2}\right)}\right)$$
  - Compares employee coordinates $(\text{lat}, \text{lng})$ against assigned `WorkLocation` $(lat_0, lng_0)$ and `radiusMeters` (default 100m).
  - If employee is outside the radius and `allowRemotePunch` is `false`, the punch is **REJECTED** with status `403 Forbidden` and logged with `rejectionReason: "Outside geofence radius"`.
  - Automated Late Mark calculation based on tenant work start time + grace period (e.g. 9:30 AM + 15 min grace).
  - Half-Day calculation if total work hours are under the configured threshold (e.g. < 4 hours).
- **Routes & Controllers (`attendance.routes.ts`, `attendance.controller.ts`):**
  - `POST /api/attendance/check-in` — Submits check-in punch with browser/device GPS coordinates.
  - `POST /api/attendance/check-out/:id` — Submits check-out punch and calculates total work hours.
  - `GET /api/attendance/today-status` — Returns today's punch state for the logged-in user.
  - `GET /api/attendance/history` — Scoped attendance logs with date range and status filters.
  - `POST /api/attendance/hr-punch` — HR exception punch override (skips geofence when employee was on official outdoor duty).

#### 2. Frontend Implementation (`hrms-frontend/src/app/attendance`, `modules/attendance`)
- **Pages & Routes:**
  - `/attendance` — Real-time attendance cockpit with interactive Check-In/Check-Out action card, GPS status pill ("Inside Office Geofence" / "Outside Geofence"), live work timer, and monthly log calendar.
- **Components & Modals:**
  - `AttendanceDashboard` — Daily stats: Total Present, Late Arrivals, On Leave, Missing Punches.
  - `AttendanceLogsDashboard` — Filterable table with punch-in/out timestamps, GPS distance, punch mode (`OFFICE` / `REMOTE` / `HR_OVERRIDE`), and status chips.
  - `ApprovalPanel` — HR review queue for regularizing late marks or missed punches.
  - Leaflet Map Preview displaying user's current pin relative to the office boundary circle.

#### 3. Purpose & Core Value
Eliminates **"Buddy Punching"**, fake biometric thumbs, and proxy attendance without requiring expensive biometric hardware at every remote branch or warehouse.

#### 4. Production Utilization in the Indian Market
- **The #1 Pain Point of Indian Employers:** In India, business owners frequently complain: *"Staff bolta hai main office mein tha, par kaam pe nahi aaya."* (Staff claims they reached the office, but weren't there). This feature strictly forces the employee to be physically within the office or site perimeter (e.g. 50m to 150m) to register attendance.
- **Zero Hardware Capex:** A biometric machine costs ₹8,000–₹15,000 per location + AMC + network cables. For an Indian retail brand with 30 stores, this saves ₹3–5 Lakhs upfront.
- **Work-From-Home / Field Toggle:** HR can toggle "Allow Remote Punch" specifically for tech teams or field sales while keeping factory/retail staff locked to geofence.

---

### Module 6: India Statutory Leave & Work Week Roster Management (CL / SL / EL / LOP & Alternate Saturdays)

#### 1. Backend Implementation (`hrms-backend/src/modules/leave`, `holiday`, `policies`)
- **Prisma Models:** `Leave`, `Holiday`, `LeaveType` (`CASUAL`, `SICK`, `EARNED`, `MATERNITY`, `PATERNITY`, `LOSS_OF_PAY`), `LeaveStatus` (`PENDING`, `APPROVED`, `REJECTED`).
- **Policy & Work Week Engine (`policies/policy-rules.ts`, `leave.service.ts`):**
  - **Work Week Patterns Supported:**
    - `FIVE_DAY`: Complete Weekend Off (all Saturdays & Sundays Off).
    - `ALTERNATE_SAT_2ND_4TH`: Alternate Saturdays Off (2nd & 4th Saturday Off + Sunday Off; 1st, 3rd, and 5th Saturdays are Working) — Standard in Indian Banking & Corporate sector.
    - `ALTERNATE_SAT_1ST_3RD`: Alternate Saturdays Off (1st & 3rd Saturday Off + Sunday Off; 2nd, 4th, and 5th Saturdays are Working).
    - `SIX_DAY`: 6-Day Work Week (Only Sunday Off; all Saturdays are Working).
    - `CUSTOM`: Configurable weekly off days (e.g. Friday/Saturday, Sunday/Monday, or any customized days).
  - **Dynamic Week-Off & Alternate Saturday Calculator (`isDateWeekOff`, `getSaturdayOccurrence`):**
    - Calculates exact Saturday occurrences in any month ($\text{occurrence} = \lceil\text{dayOfMonth} / 7\rceil$).
    - Identifies whether a given date is an official off-day without requiring manual database entries.
  - **Leave Deduction & Working Days Calculation (`calculateEffectiveLeaveDays`):**
    - When `excludeWeekendsFromLeave` is enabled (default), taking leave spanning across a weekend (e.g. Friday to Monday) only consumes **2 working days** from the employee's paid leave balance, automatically excluding Sunday and scheduled Off-Saturdays.
    - Optional **Sandwich Leave Policy** toggle (`sandwichLeaveRule`): If enabled, when an employee takes leave on both the working days immediately preceding and following a weekend/holiday, the intervening week-offs are also counted as leave days.
  - **Statutory Rules:**
    - Validates `leaveAdvanceNoticeDays` (e.g. minimum 3 days advance notice required before applying for planned Casual Leave).
    - Checks `maxConsecutiveLeaveDays` (e.g. cannot take more than 15 consecutive working days without special authorization).
    - Deducts only effective working days from the employee's leave balance ledger.
    - Public Holiday overlap filtering: Automatically checks against `Holiday` table for the tenant so gazetted holidays are not unfairly deducted from leave quota.
- **Routes & Controllers (`leave.routes.ts`, `leave.controller.ts`, `holiday.routes.ts`):**
  - `GET /api/leaves/my` — Returns personal leave history and request statuses.
  - `GET /api/leaves/balance` — Returns balance ledger (Casual, Sick, Earned balances, LOP count) along with active `workWeek` pattern.
  - `GET /api/leaves/work-week-roster` — Returns active work week configuration, pattern options (Complete Weekend Off, Alternate Sat 2nd & 4th, 1st & 3rd, 6-Day, Custom), full month calendar roster with holidays, and Saturday status badges.
  - `POST /api/leaves/work-week-roster` — Allows HR/Admin to assign or update the active organization work week and alternate Saturday roster policy.
  - `POST /api/leaves/calculate-days` — Itemized calendar day breakdown between start and end date (identifies exact working days, public holidays, and scheduled weekly offs with reasons like "Sunday Off" or "4th Saturday Off").
  - `POST /api/leaves` — Submits leave request with date range, leave type, and reason. Automatically validates working days against remaining balance.
  - `DELETE /api/leaves/:id` — Cancels a pending leave request.
  - `GET /api/leaves` — Scoped list of all team leave applications for Manager and HR review.
  - `PATCH /api/leaves/:id/status` — Manager/HR approves or rejects with mandatory `adminRemark`.
  - `GET /api/holidays` & `POST /api/holidays` — Manages tenant-wide public holiday calendar.

#### 2. Frontend Implementation (`hrms-frontend/src/app/leave`, `/time-off`, `/settings`, `/attendance`)
- **Pages & Routes:**
  - `/leave` — Integrated Leave & Work Week Hub featuring a top-level tabbed cockpit:
    - **Tab 1: Leave Applications & Requests:** Balance cards, pending approval pills, export to CSV, request filtering, and employee history.
    - **Tab 2: Work Week & Weekend Roster (`WorkWeekRosterPanel`):** Dedicated roster management console:
      - *Roster Assignment Radio Cards:* Option to assign **Alternate Saturdays Off (2nd & 4th Sat)**, **Complete Weekend Off (5-Day)**, **Alternate Saturdays Off (1st & 3rd Sat)**, **6-Day Work Week (Sunday Only Off)**, or **Custom Weekly Off Days**.
      - *Save & Assign Action:* One-click policy save updating leave deduction rules across the tenant.
      - *Live Saturday Roster Cards:* Shows all Saturdays of the selected month with **🏖️ Weekly Off** vs. **💼 Working Day** badges with month switcher.
      - *Statutory Rules & Sandwich Policy Callout:* Real-world Indian compliance guide explaining leave exclusion vs. sandwich rule.
      - *Department & Employee Schedule Register:* Staff list showing active shift hours and assigned roster pattern.
  - `/settings` (Leave & Work Week tab) — Core configuration cockpit with work week dropdown, preview, and statutory quotas.
  - `/attendance` — Attendance calendar with native Weekly Off (`WO`) indicators for Sundays and scheduled Off-Saturdays, preventing false absent flags.
- **Drawers & Panels:**
  - `LeaveApplicationDrawer` — Live dynamic policy sync: Queries active work week roster and displays live breakdown cards with itemized week-off pills (e.g. *"2 Working Days (2 week-offs excluded: Sun Oct 18, 4th Sat Oct 24)"*).
  - `LeaveApprovalsPanel` — Manager inbox showing applicant name, team, leave type, effective working days, and one-click Approve / Reject.

#### 3. Purpose & Core Value
Prevents unfair leave balance deductions, models Indian corporate & manufacturing work-week realities, and removes employee friction regarding alternate Saturday working shifts.

#### 4. Production Utilization in the Indian Market
- **The "2nd & 4th Saturday Off" Reality:** 70%+ of Indian SMEs, manufacturing plants, logistics hubs, and banking partners operate on the 2nd & 4th Saturday off schedule. Standard global HR tools (like BambooHR or Workday) only support simple 5-day or 6-day weeks, creating severe pain for Indian HRs. CareerOS handles alternate Saturdays natively.
- **Fair Leave Accounting:** In standard tools, an employee taking Friday to Monday leave gets 4 leaves deducted, triggering bitter disputes. CareerOS automatically detects that Saturday and Sunday are week-offs and only deducts 2 leaves.
- **Sandwich Rule Control:** Indian employers who want strict discipline can turn on the Sandwich Rule to prevent employees from systematically clubbing weekends with leave.
Transitions leave tracking from scattered WhatsApp messages and paper slips into an automated, auditable, and rule-governed workflow.

#### 4. Production Utilization in the Indian Market
- **Standard Indian Statutory Terms:** Uses standard Indian labor law terminology (**Casual Leave - CL**, **Sick Leave - SL**, **Earned Leave - EL / Privilege Leave - PL**).
- **Festival Rush Prevention:** Indian factories and BPOs suffer massive absenteeism during Diwali, Chhath, Holi, or Eid. The advance-notice rule (e.g. 7 days advance) prevents sudden mass walkouts.
- **Loss of Pay (LOP) Tracking for Payroll:** Directly feeds unapproved absences into LOP days, ensuring the accountant deducts the exact salary amount at month-end.

---

### Module 7: Indian CTC & Compensation Structuring Engine

#### 1. Backend Implementation (`hrms-backend/src/modules/compensation`)
- **Prisma Models:** `PayrollComplianceProfile`, `EmployeeCompensation`, `SalaryComponentRule`, `SalaryAnchorType` (`ANNUAL_CTC`, `MONTHLY_CTC`, `MONTHLY_GROSS`), `SalaryComponentSection` (`EARNING`, `DEDUCTION`, `EMPLOYER_CONTRIBUTION`), `SalaryCalcType`.
- **Statutory Rules Implemented in `default-profiles.ts` & `salary-calculator.ts`:**
  - **Basic Salary:** 40% of CTC.
  - **House Rent Allowance (HRA):** 40% of Basic (or 50% for metro cities).
  - **Conveyance Allowance:** Fixed ₹1,600 / month.
  - **Special Allowance:** Balancing component of Gross Pay ($\text{Gross} - \sum \text{Basic, HRA, Conveyance}$).
  - **Employee Provident Fund (EPF - EE):** 12% of Basic, with statutory cap rule of ₹1,800/month (based on ₹15,000 wage ceiling under Employees' Provident Funds and Miscellaneous Provisions Act, 1952).
  - **Employer Provident Fund (EPF - ER):** 12% of Basic (contributes to EPS & EPF).
  - **Employee State Insurance (ESIC - EE):** 0.75% of Gross (applicable if Gross $\le$ ₹21,000/month under ESI Act).
  - **Employer State Insurance (ESIC - ER):** 3.25% of Gross.
  - **TDS (Tax Deducted at Source):** Configurable slab / estimated percentage.
  - **Net Take-Home Pay Formula:**
    $$\text{Net Pay} = \text{Gross Earnings} - (\text{PF EE} + \text{ESI EE} + \text{PT} + \text{TDS})$$
- **Routes & Controllers (`compensation.routes.ts`, `compensation.controller.ts`):**
  - `GET /api/compensation/profiles` — Lists compliance profiles (India Standard CTC, UAE Standard, USA Standard).
  - `POST /api/compensation/calculate` — Sandbox calculator endpoint: takes Anchor Value (e.g. ₹6,00,000 Annual CTC) and returns complete itemized breakdown of earnings, deductions, and employer costs.
  - `GET /api/compensation/employee/:employeeId` — Retrieves compensation structure for an employee.
  - `PUT /api/compensation/employee/:employeeId` — Saves/updates customized CTC structure.
  - `GET /api/compensation/onboarding/:onboardingId` — Attaches CTC breakdown to candidate during hire stage.

#### 2. Frontend Implementation (`hrms-frontend/src/modules/compensation/components/CtcCalculator.tsx`)
- **Interactive UI Component:**
  - Real-time CTC breakdown calculator.
  - Dynamic input for Annual CTC or Monthly Gross.
  - Visual earnings vs deductions split-bars.
  - Tabular breakdown: Monthly ₹ and Annual ₹ columns for Basic, HRA, Conveyance, Special Allowance, PF (EE & ER), ESIC, and Net Take-Home.
  - Downloadable CTC Summary for offer letter annexures.

#### 3. Purpose & Core Value
Bridges the dangerous disconnect between HR offer letters and accounts payroll. In India, candidates often sign for "₹6 LPA CTC" expecting ₹50,000 in hand, only to get upset when they receive ₹41,000 due to PF, ESI, and PT deductions.

#### 4. Production Utilization in the Indian Market
- **100% India-Compliant Offer Letters:** Generates transparent CTC annexures during hiring, eliminating post-joining disputes.
- **Statutory PF Wage Ceiling Rule:** Properly caps PF at ₹1,800 on ₹15,000 basic unless voluntary higher PF is opted, keeping labor compliance clean.
- **ESIC Automation:** Automatically flags whether the employee qualifies for ESIC coverage ($\le$ ₹21,000 gross).

---

### Module 8: Smart Onboarding & ATS Hire Pipeline

#### 1. Backend Implementation (`hrms-backend/src/modules/onboarding`)
- **Prisma Models:** `OnboardingHire`, `OnboardingTask`, `OnboardingSource` (`MANUAL`, `BULK_IMPORT`, `EXTERNAL_ATS`).
- **Fields:** `name`, `role`, `department`, `email`, `phone`, `joinDate`, `status` (`Pending`, `In Progress`, `Completed`), `progress` (0–100%), `tasks` (dynamic checklist).
- **Default Onboarding Checklist Items:**
  1. Collect Aadhaar & PAN Card copies.
  2. Issue Official Email & Slack/Teams credentials.
  3. Assign IT Laptop & Access Card.
  4. Complete Bank Account & PF Nominee Form.
  5. Policy Document Digital Acknowledgment.
  6. Reporting Manager Introduction.
- **Routes & Controllers (`onboarding.routes.ts`, `onboarding.controller.ts`):**
  - `GET /api/onboarding` — Lists all incoming hires with status and progress bars.
  - `POST /api/onboarding` — Adds new candidate to the onboarding pipeline.
  - `POST /api/onboarding/bulk` — Bulk CSV import of campus hires or seasonal batches.
  - `PATCH /api/onboarding/:id/task` — Toggles checklist item done/undone; auto-recalculates progress percentage.
  - `POST /api/onboarding/:id/complete` — 1-click graduation: automatically creates permanent `Employee` record, generates `User` login credentials, links the attached `EmployeeCompensation` CTC, and sends welcome email.

#### 2. Frontend Implementation (`hrms-frontend/src/app/onboarding`, `modules/onboarding`)
- **Pages & Routes:**
  - `/onboarding` — Kanban/List pipeline displaying "New Hires", "In Verification", "Ready to Join", and "Graduated".
- **Drawers & Modals:**
  - `OnboardingDrawer` — Candidate profile, join date counter, task progress meter, document upload slot, and embedded `CtcCalculator` to attach salary structure before day 1.
  - Bulk Import Modal with sample CSV template download.

#### 3. Purpose & Core Value
Stops Day-1 joining chaos. Prevents new joiners from sitting idle for days without a laptop, email address, or policy clarity.

#### 4. Production Utilization in the Indian Market
- **Early Attrition Reduction:** In Indian tech and sales sectors, 15–20% of candidates drop out within the first 30 days due to poor onboarding experience.
- **Campus Hiring Batches:** Colleges and IT service firms hire 50–200 freshers in a single batch. Bulk CSV import and structured checklists allow 1 HR executive to onboard 100 freshers smoothly.

---

### Module 9: Policy Center & Digital Compliance Engine

#### 1. Backend Implementation (`hrms-backend/src/modules/policies`)
- **Prisma Models:** `PolicyDocument`, `PolicyVersion`, `PolicyAcknowledgment`, `PolicyCategory` (`LEAVE_ATTENDANCE`), `PolicyDocumentStatus` (`DRAFT`, `PUBLISHED`, `ARCHIVED`).
- **Dynamic Rule Engine (`policy-rules.ts`):**
  - Extracts structured rules from documents or manual inputs:
    - `leave.leaveAdvanceNoticeDays` (Notice required for leave).
    - `leave.maxConsecutiveLeaveDays` (Max continuous leaves allowed).
    - `leave.carryForwardLimit` (Leaves carried into next calendar year).
    - `attendance.workStartTime`, `gracePeriodMinutes`, `lateMarkAfterMinutes`.
    - `exit.standardNoticeDays` (e.g. 30, 60, or 90 days), `probationNoticeDays`.
  - Publishing a new version immediately updates `TenantHrRules` across the tenant.
- **Routes & Controllers (`policy.routes.ts`, `policy.controller.ts`):**
  - `GET /api/policies/active` — Returns live enforced HR rules for the tenant.
  - `POST /api/policies/upload` — Multipart upload for official HR Policy PDF/Word doc.
  - `POST /api/policies/:id/publish` — Activates version and triggers mandatory employee acknowledgment prompts.
  - `POST /api/policies/versions/:versionId/acknowledge` — Records employee digital signature timestamp for legal compliance.

#### 2. Frontend Implementation (`hrms-frontend/src/app/policies`)
- **Pages & Routes:**
  - `/policies` — Central Policy repository displaying active company handbook, leave guidelines, code of conduct, and acknowledgment status.
- **Drawers & Modals:**
  - `PolicyUploadDrawer` — Document uploader with extracted rule review sliders and publish button.
  - `AcknowledgmentModal` — Pop-up for employees requiring them to review the updated policy and click "I Accept and Acknowledge" before continuing.

#### 3. Purpose & Core Value
Transforms static, forgotten HR PDF handbooks into living, enforceable software rules and legally defensible employee acknowledgments.

#### 4. Production Utilization in the Indian Market
- **Labor Court & Dispute Defense:** In India, when an employee is terminated for absenteeism or misconduct, they often claim in labor conciliation: *"Mujhe policy pata nahi thi"* (I was never told the policy). The stored digital acknowledgment timestamp (with IP and user ID) serves as solid legal proof.
- **ISO & POSH Audit Readiness:** Ready-to-audit logs for ISO 9001, POSH (Prevention of Sexual Harassment) compliance, and investor due diligence.

---

### Module 10: Exit Management, Notice Period & Resignation Workflow

#### 1. Backend Implementation (`hrms-backend/src/modules/separation`, `approvals`)
- **Prisma Models:** `SeparationRequest`, `SeparationExitType` (`RESIGNATION`, `TERMINATION`, `RETIREMENT`), `SeparationStatus` (`DRAFT`, `SUBMITTED`, `MANAGER_APPROVED`, `ACCEPTED`, `IN_NOTICE`, `CLEARANCE_PENDING`, `COMPLETED`, `REJECTED`, `WITHDRAWN`).
- **Separation Service Logic (`separation.service.ts`):**
  - Calculates statutory notice period (e.g. 30/60/90 days based on active policy).
  - Detects **Notice Shortfall**: If employee requests Last Working Day (LWD) earlier than standard notice, calculates `noticeShortfallDays`.
  - Buyout Flag: Tracks whether company approved notice buyout or salary deduction.
  - Two-Level Approval:
    - **L1:** Reporting Manager reviews reason and proposed handover.
    - **L2:** HR confirms final LWD and initiates clearance.
  - **Auto-Termination on LWD:** On completed exit, automatically marks `Employee` status as `TERMINATED`, revokes `User` login access, and triggers asset return validation.
- **Routes & Controllers (`separation.routes.ts`, `separation.controller.ts`):**
  - `GET /api/separation/policy` — Returns company notice period policy.
  - `GET /api/separation/mine` — Employee views personal resignation status and clearance progress.
  - `POST /api/separation` — Submits resignation with reason, attachment, and requested LWD.
  - `POST /api/separation/:id/withdraw` — Allows employee to withdraw resignation if still in `SUBMITTED` status.
  - `GET /api/separation` — Scoped list for HR and Managers to track notice-period pipelines.
  - `PATCH /api/separation/:id/checklist` — Updates clearance items (IT asset returned, Finance dues cleared, Admin ID card surrendered).
  - `POST /api/separation/:id/complete` — Final exit sign-off: terminates employee and deactivates portal access.

#### 2. Frontend Implementation (`hrms-frontend/src/app/my-exit`, `/separations`)
- **Pages & Routes:**
  - `/my-exit` (Employee Portal) — Resignation submission card, notice days counter, countdown to Last Working Day, and clearance status checklist.
  - `/separations` (HR & Management Portal) — Offboarding pipeline tracker: "Resigned", "In Notice Period", "Clearance Pending", "Exited".
- **Drawers & Modals:**
  - `ExitReviewDrawer` — Manager/HR approval card with LWD adjustment calendar, notice shortfall alert, and remarks.
  - `ClearanceChecklistModal` — Multi-department sign-off (IT, Accounts, HR, Operations).

#### 3. Purpose & Core Value
Eliminates notice-period horror stories, unreturned company property, and payroll disputes over final settlements.

#### 4. Production Utilization in the Indian Market
- **Full & Final (F&F) Settlement Accuracy:** Unreturned laptops or unserved notice days are the top reasons Indian companies delay F&F settlements. This automated clearance checklist ensures accounts never release final payout until all items are signed off.
- **Data Protection & Ex-Employee Security:** Instantly disables login credentials on the confirmed Last Working Day, preventing disgruntled ex-employees from downloading client databases or proprietary code.

---

### Module 11: IT Asset Management & Handover Tracking

#### 1. Backend Implementation (`hrms-backend/src/modules/assets`)
- **Prisma Models:** `Asset`, `AssetAllocation`.
- **Fields:** `name`, `type` (Laptop, Phone, Monitor, SIM Card, Vehicle, Tool), `serialNumber` (Unique per tenant), `brand`, `model`, `status` (`Available`, `Allocated`, `Under Repair`, `Retired`), `condition` (`New`, `Good`, `Damaged`), `purchasedOn`, `warrantyUntil`.
- **Allocation Lifecycle:**
  - `issuedOn`, `expectedReturn`, `returnedOn`, `conditionOnIssue`, `conditionOnReturn`, `issuedBy`.
- **Routes & Controllers (`asset.routes.ts`, `asset.controller.ts`):**
  - `GET /api/assets` — Lists assets with status, type, and search filters.
  - `GET /api/assets/allocations` — Lists active and historical asset issue records.
  - `POST /api/assets` — Registers new asset with serial number and specs.
  - `POST /api/assets/assign` — Issues asset to employee; sets asset status to `Allocated`.
  - `PATCH /api/assets/return/:id` — Records asset return, verifies return condition, and resets asset status to `Available`.
  - `DELETE /api/assets/:id` — Retires/deletes asset.

#### 2. Frontend Implementation (`hrms-frontend/src/app/assets`, `employees/[id]`)
- **Pages & Routes:**
  - `/assets` — Asset inventory table with condition badges, serial number search, warranty alerts, and allocation counters.
  - Embedded inside `/employees/[id]` (Assets Tab) — Instant view of all equipment currently in possession of the employee.
- **Drawers & Modals:**
  - `AssetFormDrawer` — Register hardware with serial barcode, brand, warranty date.
  - `AssignAssetModal` — Dropdown to select employee, expected return date, and issue notes.
  - `ReturnAssetModal` — Return inspection checklist (checks for screen cracks, charger return, physical damage).

#### 3. Purpose & Core Value
Protects company capital expenditure by tracking high-value equipment across distributed and remote workforces.

#### 4. Production Utilization in the Indian Market
- **The "Missing Laptop" Problem:** Indian companies face massive asset leakage when remote employees resign and stop responding. Binding asset recovery directly to the Exit Clearance workflow (§ Module 10) prevents financial loss.
- **Hardware Audit & Warranty Tracking:** IT managers can instantly filter all Dell or MacBook laptops nearing warranty expiration for timely AMC renewals.

---

### Module 12: Employee Digital Document Vault & KYC Management

#### 1. Backend Implementation (`hrms-backend/src/modules/documents`)
- **Prisma Models:** `Document`.
- **Fields:** `name`, `type`, `category` (KYC, Employment, Education, Medical, Tax), `employeeId`, `uploadedBy`, `uploadedAt`, `size`, `url`, `status` (`Active`, `Archived`), `tags`.
- **Routes & Controllers (`document.routes.ts`, `document.controller.ts`):**
  - `GET /api/documents` — Scoped list of documents by employee or tenant.
  - `POST /api/documents` — Records new document metadata and cloud storage URL.
  - `PUT /api/documents/:id` — Edits document metadata or tags.
  - `PATCH /api/documents/:id/archive` — Soft-archives document.
  - `DELETE /api/documents/:id` — Removes document record.

#### 2. Frontend Implementation (`hrms-frontend/src/app/documents`, `employees/[id]`)
- **Pages & Routes:**
  - `/documents` — Document repository with category tabs (Identity Documents, Offer Letters, Tax Forms, Certificates) and quick search.
- **Drawers & Modals:**
  - `DocumentUploadDrawer` — File upload with category selector, expiry date picker, and tag pills.
  - `DocumentViewerModal` — In-browser preview for PDF and image documents.

#### 3. Purpose & Core Value
Provides a centralized, secure digital folder for every worker, replacing unorganized Google Drive folders and physical paper files.

#### 4. Production Utilization in the Indian Market
- **Mandatory Indian KYC Verification:** Indian labor regulations require employers to store copies of government IDs: **Aadhaar Card**, **PAN Card**, and **Bank Passbook/Cancelled Cheque** for PF account linking.
- **Instant Document Access for Visas & Background Verification (BGV):** HR can instantly package and share authenticated employee credentials with external BGV agencies.

---

### Module 13: Project & Task Management with Recurring Schedules

#### 1. Backend Implementation (`hrms-backend/src/modules/tasks`, `projects`)
- **Prisma Models:** `Project`, `Task`, `TaskPriority` (`LOW`, `LESS_URGENT`, `MEDIUM`, `HIGH`, `URGENT`), `TaskStatus` (`TODO`, `IN_PROGRESS`, `DONE`), `TaskScheduleType` (`NONE`, `SPECIFIC_DATE`, `DAY_OF_WEEK`).
- **Features:** Multi-assignee support (`assigneeIds`), progress tracking (`workDonePercent`), recurring reminder dates/weekdays, deadline escalation badges.
- **Routes & Controllers (`task.routes.ts`, `project.routes.ts`):**
  - `GET /api/tasks` — Scoped tasks list with status, priority, and project filters.
  - `GET /api/tasks/employee/:employeeId` — Fetches tasks assigned to a specific worker.
  - `POST /api/tasks` — Manager creates and assigns task.
  - `POST /api/tasks/self` — Employee creates self-managed task.
  - `PUT /api/tasks/status/:id` — Moves task across stages (`TODO` $\to$ `IN_PROGRESS` $\to$ `DONE`).
  - `PUT /api/tasks/:id` — Edits task details, due date, progress percentage.
  - `DELETE /api/tasks/:id` — Deletes task.
  - `GET /api/projects` & `POST /api/projects` — Creates and manages operational projects.

#### 2. Frontend Implementation (`hrms-frontend/src/app/tasks`)
- **Pages & Routes:**
  - `/tasks` — Switchable **Kanban Board** & **List View** with drag-and-drop status columns, priority flags, progress bars, and search filters.
- **Drawers & Modals:**
  - `TaskFormDrawer` — Task creator with project selector, multi-assignee picker, due date, priority dropdown, and schedule recurrences.
  - `TaskDetailDrawer` — Complete task audit log, remarks thread, and completion slider.

#### 3. Purpose & Core Value
Connects daily workforce execution directly with HR performance evaluations. Managers stop wasting hours on WhatsApp follow-ups (*"Kahan tak hua kaam?"*).

#### 4. Production Utilization in the Indian Market
- **First-Week ROI for Managers:** When Indian SMEs implement an HRMS, managers often see attendance as an "HR tool." Introducing the Task module gives managers immediate daily utility, dramatically boosting platform adoption.
- **Direct Feed into Performance Appraisals:** Completed tasks and on-time delivery rates automatically feed into the Performance Review algorithm (§ Module 15).

---

### Module 14: Field Visits & Field Force Geolocation Beat Tracking

#### 1. Backend Implementation (`hrms-backend/src/modules/field-visits`)
- **Prisma Models:** `FieldVisitAssignment`, `FieldVisitLocationPing`, `FieldVisitStatus` (`PENDING`, `VERIFIED`, `MISSED`, `SKIPPED`).
- **Engine Logic (`field-visit.service.ts`):**
  - Assigns daily beat plans: Employee is assigned a sequence of customer/vendor `WorkLocation` sites to visit on a specific `dateKey`.
  - When employee reaches the site, they trigger `/roster/:id/verify`.
  - System grabs device GPS coordinates, calculates distance to the client location via Haversine formula, and marks the visit `VERIFIED` only if within acceptable range.
  - Periodic background location pings (`FieldVisitLocationPing`) create an auditable timeline of the field agent's daily route.
- **Routes & Controllers (`field-visit.routes.ts`, `field-visit.controller.ts`):**
  - `GET /api/field-visits/roster` — Scoped roster of scheduled visits for today/selected date.
  - `POST /api/field-visits/roster` — Manager schedules beat plan for field executive.
  - `POST /api/field-visits/roster/:id/verify` — Executive checks in at customer site with GPS coordinates.
  - `POST /api/field-visits/roster/:id/missed` — Flags unvisited customer stop.
  - `GET /api/field-visits/mine/today` — Mobile/web view for field executive showing today's visit stops.
  - `POST /api/field-visits/ping` — Ingests periodic GPS coordinates.
  - `GET /api/field-visits/live` — Returns live map coordinates of field force for management dashboard.

#### 2. Frontend Implementation (`hrms-frontend/src/app/field-visits`)
- **Pages & Routes:**
  - `/field-visits` — Live Field Operations Command Center: Daily visit roster, visit verification timeline, and Leaflet map showing scheduled customer locations vs actual check-in pings.
- **Components & Modals:**
  - `AssignVisitDrawer` — Manager selects employee, client site from location master, planned time, and visit sequence.
  - Mobile-responsive Check-In button with one-tap location verification.

#### 3. Purpose & Core Value
Solves the chronic lack of visibility into field sales executives, service technicians, and medical representatives.

#### 4. Production Utilization in the Indian Market
- **Elimination of Fake Daily Allowance (DA) Claims:** In India, field executives frequently submit travel allowance and food bills for client visits they never actually made. Geoverified check-in creates undeniable proof of visit before travel reimbursements are cleared.
- **Logistics, FMCG & Pharma Distribution:** Essential for pharmaceutical MRs visiting doctors, FMCG distributors taking retail orders, and broadband installation technicians.

---

### Module 15: Automated Performance Review & Multi-Factor Appraisal Scoring

#### 1. Backend Implementation (`hrms-backend/src/modules/performance`)
- **Prisma Models:** `PerformanceReview`, `Metrics`, `Insights`, `SelfAssessment`, `ManagerAssessment`.
- **Weighted Multi-Factor Scoring Formula (`performanceCalculator.ts`):**
  $$\text{Final Score} = (\text{Task} \times 0.40) + (\text{Attendance} \times 0.20) + (\text{Leave} \times 0.20) + (\text{Manager} \times 0.20)$$
  - **Task Score (40% Weight):** Based on total assigned vs completed tasks, on-time delivery rate, early completions bonus, and penalty for overdue open tasks.
  - **Attendance Score (20% Weight):** Present days / Expected working days (weekdays minus gazetted holidays), with deductions for late marks and half-days.
  - **Leave Score (20% Weight):** Penalties for unannounced leaves, Loss of Pay (LOP) frequency, and leave advance notice policy adherence.
  - **Manager Score (20% Weight):** Subjective manager evaluation (1–5 stars converted to 0–100 scale).
  - **Performance Category Mapping:**
    - $\ge 90$: *Outstanding*
    - $75 - 89$: *Exceeds Expectations*
    - $60 - 74$: *Meets Expectations*
    - $< 60$: *Needs Improvement*
  - **AI-Style Algorithmic Insights:** Automatically generates lists of `strengths` (e.g. "Consistently beats task deadlines"), `weaknesses` (e.g. "Frequent late arrivals on Mondays"), and `recommendations`.
- **Routes & Controllers (`performance.routes.ts`, `performance.controller.ts`):**
  - `GET /api/performance` — Lists reviews across cycles (Monthly, Quarterly, Annual).
  - `GET /api/performance/my` — Employee views own review, metrics, and insights.
  - `POST /api/performance/compute` — Automatically calculates scores from database activity logs for an employee and cycle.
  - `PATCH /api/performance/:id/self-review` — Employee submits self-rating and comments.
  - `PATCH /api/performance/:id/manager-review` — Manager submits rating and qualitative feedback.
  - `POST /api/performance/:id/refresh` — Re-runs calculator after new tasks or punches are updated.

#### 2. Frontend Implementation (`hrms-frontend/src/app/performance`)
- **Pages & Routes:**
  - `/performance` — Performance appraisal cockpit featuring bell-curve score distribution, cycle selector (e.g. 2026-Q3), and employee scorecards.
- **Components & Modals:**
  - `ScorecardDrawer` — Displays visual radar/breakdown of the 4 score components (Task, Attendance, Leave, Manager), calculated category badge, and AI Insights cards.
  - `ReviewFormModal` — Dual-tab evaluation modal for employee self-review and manager appraisal.

#### 3. Purpose & Core Value
Replaces subjective, biased, once-a-year appraisal arguments with transparent, data-driven, continuous evaluation.

#### 4. Production Utilization in the Indian Market
- **End of Appraisal Season Bias:** Indian employees often complain: *"Manager ne mujhe pasand nahi kiya isliye rating kharab di"* (Manager didn't like me so gave a poor rating). When 80% of the score is mathematically computed from actual punch times, approved leaves, and completed tasks, arguments disappear.
- **Incentive & Bonus Alignment:** Allows founders and CFOs to distribute Diwali bonuses or annual increments based on objective mathematical performance tiers.

---

### Module 16: Operations Approvals Hub

#### 1. Backend Implementation (`hrms-backend/src/modules/approvals`)
- **Prisma Models:** `ApprovalRequest`, `ApprovalRequestType` (`USER_ONBOARDING`, `LEAVE`, `ORG_SETTINGS`, `EXIT`), `ApprovalRequestStatus` (`PENDING`, `APPROVED`, `REJECTED`).
- **Multi-Level Approval Workflow (`src/shared/approval-engine.ts`):**
  - Configurable approval depth: L1 (Site Supervisor) $\to$ L2 (Division Manager) $\to$ L3 (Tenant HQ Admin).
  - Escalation handling and payload storage.
- **Routes & Controllers (`approval.routes.ts`, `approval.controller.ts`):**
  - `GET /api/approvals/inbox` — Returns pending approval cards targeted to the logged-in user's role and hierarchy level.
  - `POST /api/approvals/:id/act` — Executes action (`approve` or `reject`) with remarks and optional parameter adjustments (such as adjusting Last Working Day for exits).

#### 2. Frontend Implementation (`hrms-frontend/src/app/approvals`, `headquarters/approvals`)
- **Pages & Routes:**
  - `/approvals` — Unified inbox categorizing pending requests into:
    - *Leave Applications*
    - *Resignation & Exit Approvals*
    - *New User & Org Unit Requests*
    - *Attendance Regularizations*
- **Drawers & Modals:**
  - `ApprovalDrawer` — Rich contextual drawer displaying applicant details, request parameters, impact analysis, and Quick Approve / Reject with remarks buttons.

#### 3. Purpose & Core Value
Consolidates all company approvals into one clean inbox instead of forcing managers to switch between 5 different screens.

#### 4. Production Utilization in the Indian Market
- **Executive Time Savings:** Company directors and branch heads receive dozens of requests daily. A single unified inbox lets them clear all operational requests in 5 minutes every morning.

---

### Module 17: Reports, Muster Rolls & Compliance Analytics

#### 1. Backend Implementation (`hrms-backend/src/modules/reports` / scoped database queries)
- **Aggregations:**
  - Monthly Muster Roll Register: Day-by-day attendance grid (P, A, L, HD, WO, H) for every employee across the calendar month.
  - Leave Utilization Summary: Opening balance, leaves availed, leaves pending, closing balance.
  - Task Delivery & Velocity Analytics: Team-wise completion metrics.
  - Org Unit Headcount & Cost Distribution.
- **Output Formats:** Scoped JSON endpoints with support for CSV / Excel exports.

#### 2. Frontend Implementation (`hrms-frontend/src/app/reports`)
- **Pages & Routes:**
  - `/reports` — Interactive reporting suite featuring:
    - *Attendance Muster Roll View:* Traditional Indian statutory register grid.
    - *Leave Summary Report:* Balance ledger per department.
    - *Performance Summary Table:* Organization-wide score distribution.
    - Export to CSV / Excel buttons.

#### 3. Purpose & Core Value
Provides management, auditors, and external labor inspectors with instant, compliant attendance and workforce records.

#### 4. Production Utilization in the Indian Market
- **Statutory Form T / Form 25 Muster Roll:** Indian state labor laws mandate maintaining physical or digital muster rolls available for inspection by Government Labor Officers. The system generates this report with one click.

---

### Module 18: Work Locations & Geo-Mapping Master

#### 1. Backend Implementation (`hrms-backend/src/modules/locations`)
- **Prisma Models:** `WorkLocation`, `LocationUsage` (`ATTENDANCE`, `VISITS`, `BOTH`).
- **Fields:** `name`, `address`, `lat`, `lng`, `radiusMeters` (default 100m), `isActive`, `usage`, `tenantId`, `orgUnitId`.
- **Routes & Controllers (`location.routes.ts`, `location.controller.ts`):**
  - `GET /api/locations` — Lists all work locations with geofence radii and assigned staff count.
  - `POST /api/locations` — Creates new location with lat/lng and radius.
  - `PUT /api/locations/:id` — Updates coordinates, radius, or address.
  - `DELETE /api/locations/:id` — Deactivates location.

#### 2. Frontend Implementation (`hrms-frontend/src/app/locations`)
- **Pages & Routes:**
  - `/locations` — Work locations management grid with interactive OpenStreetMap/Leaflet integration.
- **Drawers & Modals:**
  - `LocationFormDrawer` — Map-based location builder: drag-and-drop pin on map, interactive slider for geofence radius (50m to 1,000m) with live visual green circle overlay, address autocomplete, and usage tags.

#### 3. Purpose & Core Value
Centralizes geographical perimeters for office buildings, warehouses, client project sites, and retail branches.

#### 4. Production Utilization in the Indian Market
- **Multi-Branch Setup in Minutes:** Whether an employer has an office in Cyber City Gurugram, a factory in Manesar, and a warehouse in Bhiwandi, they can configure all three locations on the map in under 5 minutes.
- **Free OpenStreetMap Tiles:** Uses Leaflet + OpenStreetMap rather than expensive Google Maps API keys, saving clients thousands of rupees in monthly API billing.

---

### Module 19: System Notifications & Alerts

#### 1. Backend Implementation (`hrms-backend/src/shared/notifications`)
- Centralized event triggers: Task assignment, task deadline approaching, leave application submitted/approved/rejected, resignation submitted, policy update published.
- Resend transactional email integration for welcome credentials and urgent alerts.

#### 2. Frontend Implementation (`hrms-frontend/src/app/notifications`)
- **Pages & Routes:**
  - `/notifications` — Notifications feed with read/unread indicators, action links, and type icons (Task, Leave, System, Policy).
  - Floating bell icon in top navigation with unread count badge.

#### 3. Purpose & Core Value
Keeps employees and managers constantly informed without requiring repetitive manual check-ins.

#### 4. Production Utilization in the Indian Market
- Ensures zero dropped balls during high-pressure payroll cutoffs or exit notice periods.

---

# PART 2: PHASE 4 — ARCHITECTURAL ROADMAP & PRODUCTION SPECIFICATION

The `D:\careerOS-prod\phase 4` directory is the designated workspace for the **Enterprise Evolution Layer**. While Phase 3 handles complete HR, attendance, leave, tasks, assets, policies, and CTC structuring, Phase 4 delivers the critical modules required for open public SaaS, full statutory banking, mobile apps, and direct revenue collection.

Below is the exhaustive specification of the modules planned and engineered for Phase 4.

---

```
                                    ┌─────────────────────────────────────────────────────────────┐
                                    │                PHASE 4: ENTERPRISE EXTENSIONS               │
                                    │                   (D:\careerOS-prod\phase 4)                │
                                    └──────────────────────────────┬──────────────────────────────┘
                                                                   │
           ┌───────────────────────────────┬───────────────────────┼───────────────────────┬───────────────────────────────┐
           ▼                               ▼                       ▼                       ▼                               ▼
┌──────────────────────┐        ┌──────────────────────┐┌──────────────────────┐┌──────────────────────┐        ┌──────────────────────┐
│  INDIAN PAYROLL &    │        │  NATIVE MOBILE APP   ││ BIOMETRIC HARDWARE   ││ WHATSAPP HR BOT &    │        │ RAZORPAY SAAS        │
│  STATUTORY RETURNS   │        │  (Android & iOS)     ││ BRIDGE (ZKTeco/eSSL) ││ INBOUND ATS PORTAL   │        │ BILLING & DPDP 2023  │
│ 1-Click Run • Form16 │        │ Background Geofence  ││ Push SDK Listener    ││ WhatsApp Punch • Jobs│        │ Subscriptions • Invc │
│ EPFO ECR • Bank NEFT │        │ Selfie Punch • Push  ││ Auto-Sync to Server  ││ Application Pipeline │        │ Soft/Hard Data Purge │
└──────────────────────┘        └──────────────────────┘└──────────────────────┘└──────────────────────┘        └──────────────────────┘
```

---

### Module 20: Full Indian Statutory Payroll Engine & Bank Payout Integration

#### 1. Scope & Architecture (`phase 4/backend/payroll`, `phase 4/frontend/payroll`)
- **Inputs from Phase 3:**
  - Approved Attendance records (Present days, Half days, Late deductions).
  - Approved Leave records (CL, SL, EL, and Loss of Pay - LOP days).
  - Active `EmployeeCompensation` CTC snapshot (Basic, HRA, Allowances, PF, ESI, PT).
- **Core Processing Functions:**
  1. **Monthly Payroll Run:** 1-click execution for a specific pay period (e.g. October 2026).
  2. **LOP Wage Deduction:** Calculates Per-Day Salary ($\frac{\text{Monthly Gross}}{\text{Days in Month}}$) and deducts exact unpaid leave days.
  3. **State Professional Tax (PT) Slabs:** Built-in statutory PT calculation rules for Maharashtra (₹200/month, ₹300 in Feb), Karnataka (₹200), West Bengal, Gujarat, Tamil Nadu, and Telangana.
  4. **Provident Fund (EPFO ECR Generator):** Generates official pipe-delimited text format file required for upload on the EPFO Unified Portal (UAN, Member Name, Gross Wages, EPF Wages, EPS Wages, EE Share, ER Share, EPS Contribution).
  5. **ESIC Monthly Return File:** Formats monthly contribution sheets for upload on the ESIC Portal.
  6. **Income Tax TDS Calculation:** Calculates monthly TDS deductions under Old vs New Tax Regimes (Section 115BAC).
  7. **Form 16 Part A & Part B Generation:** End-of-year automated PDF generation with salary certificate and tax deducted details.
  8. **Bank Batch Transfer File (NEFT / RTGS):** Pre-formatted Excel/CSV payout files for major Indian banks (**HDFC Bank E-Net**, **ICICI Bank Corporate Banking**, **State Bank of India Corporate**, **Axis Bank**).
  9. **Employee Payslip PDF Generation:** Beautiful, password-protected (PAN or DOB format) digital payslips emailed directly to workers and available for download in self-service.

#### 2. Production Utilization in the Indian Market
- **The Ultimate Retention Lock:** Attendance software is easy to switch; payroll software is sticky. Once an Indian company runs payroll, generates Form 16s, and files PF returns through CareerOS, they will never churn.
- **Hours to Seconds for Accountants:** Replaces a 3-day monthly Excel scramble with a 30-second automated payroll run.

---

### Module 21: Native Cross-Platform Mobile Application (Android & iOS)

#### 1. Scope & Architecture (`phase 4/mobile/`)
- **Technology Stack:** Flutter or React Native with TypeScript.
- **Reference Specification:** Built directly according to `phase 3/mobileguidetomake.md`.
- **Core Mobile Capabilities:**
  1. **Background Geofenced Auto-Punch:** Uses fine location service, background geolocation, and wake locks to register attendance automatically when an employee walks onto the work premises, without requiring them to open the app.
  2. **Selfie Verification (Facial Proof):** Front camera capture at check-in with GPS watermark, eliminating any dispute over who punched in.
  3. **Offline Punch Queue:** Stores punches locally in SQLite/EncryptedStorage if internet is down (common in basement offices and remote mines in India); auto-syncs as soon as 4G/WiFi is restored.
  4. **Push Notifications:** Instant native alerts for leave approvals, task deadlines, shift changes, and payslip availability.
  5. **Manager Mobile Hub:** Managers can view team presence, approve leaves, and assign tasks directly from their smartphone.

#### 2. Production Utilization in the Indian Market
- **Blue-Collar & Factory Workforce:** Many factory workers and security guards in India do not have laptops. A lightweight Android app (under 25MB) allows 100% workforce inclusion.
- **Field & Logistics Operations:** Essential for delivery drivers, construction supervisors, and retail store staff.

---

### Module 22: Biometric Hardware IoT Bridge (ZKTeco / eSSL Sync)

#### 1. Scope & Architecture (`phase 4/backend/biometric-bridge`)
- **Hardware Support:** ZKTeco, eSSL, Realtime, BioMax fingerprint and face-recognition machines.
- **Bridge Architecture:**
  - Local lightweight Windows service / Linux daemon deployed on the client's local network (or cloud Push SDK listener).
  - Communicates with biometric hardware via TCP/IP or Push Protocol.
  - Automatically pushes every physical thumb/face punch to the CareerOS Attendance API (`POST /api/attendance/check-in` with `punchMode: "BIOMETRIC"`).
  - Handles machine user enrollment sync.

#### 2. Production Utilization in the Indian Market
- **Legacy Enterprise Clients:** Traditional Indian manufacturing factories, schools, and hospitals already have physical biometric machines and refuse to throw them away. This bridge connects their existing hardware directly to CareerOS without requiring hardware replacement.

---

### Module 23: Automated WhatsApp HR Bot

#### 1. Scope & Architecture (`phase 4/backend/whatsapp-bot`)
- **Technology:** WhatsApp Business Cloud API (Meta) with webhook handlers.
- **Core Conversational Workflows:**
  1. *Punch In / Punch Out:* Send live location on WhatsApp $\to$ Bot verifies geofence and punches attendance.
  2. *Check Leave Balance:* Send "Leave Balance" $\to$ Bot replies with CL, SL, EL available.
  3. *Apply for Leave:* Bot guides user conversationally: *"Which dates? Casual or Sick?"* $\to$ Submits request and notifies manager.
  4. *Download Payslip:* Send "Payslip October" $\to$ Bot delivers password-protected PDF directly in the chat.
  5. *Manager Approval via WhatsApp:* Manager receives WhatsApp notification with inline interactive buttons: `[Approve]` or `[Reject]`.

#### 2. Production Utilization in the Indian Market
- **India is a WhatsApp Economy:** In India, 95%+ of smartphone users live on WhatsApp. A blue-collar or warehouse worker who refuses to log into a web portal will happily punch and request leave on WhatsApp.

---

### Module 24: Inbound ATS & Public Career Portal

#### 1. Scope & Architecture (`phase 4/frontend/careers`, `phase 4/backend/ats`)
- **Public Career Portal:**
  - Branded job board hosted at `careers.clientname.com` or `/careers/[tenantSlug]`.
  - Lists open job positions with job descriptions, requirements, and location filters.
  - Public candidate application form with resume/CV upload.
- **Applicant Tracking Pipeline (ATS):**
  - Stages: *Applied*, *Screening*, *Interview Round 1*, *Interview Round 2*, *HR Discussion*, *Offered*, *Rejected*.
  - Interview scheduling with Google Meet / Teams links.
  - Offer Letter Generator with attached CTC Annexure.
  - **Zero-Friction Handover:** When a candidate accepts an offer, 1 click automatically pushes their profile into Phase 3 Smart Onboarding (`OnboardingHire`), generating their onboarding checklist.

#### 2. Production Utilization in the Indian Market
- **Full Employee Lifecycle:** Closes the loop from **Candidate Sourcing $\to$ Interviewing $\to$ Onboarding $\to$ Attendance $\to$ Performance $\to$ Exit**.

---

### Module 25: Multi-Tenant Self-Serve SaaS Billing (Razorpay Integration)

#### 1. Scope & Architecture (`phase 4/backend/billing`, `phase 4/frontend/superadmin`)
- **Payment Gateway:** Razorpay Subscriptions & Invoicing API (India's leading B2B gateway).
- **Billing Models:**
  - Per-Seat / Per-User Monthly & Annual recurring billing (e.g. ₹50/user/month for Starter; ₹100/user/month for Pro; ₹150/user/month for Enterprise).
  - Automated GST-compliant B2B Invoices with client GSTIN, State Tax code, CGST, SGST, and IGST breakdowns.
  - Automated seat upgrading: Adding employee #51 automatically updates the Razorpay subscription quota.
  - Grace periods, payment failure dunning emails, and automated portal suspension on non-payment.

#### 2. Production Utilization in the Indian Market
- **Unlocks Self-Serve Growth:** Enables public SaaS acquisition where Indian SME owners can discover the website, sign up, enter their GSTIN, pay via UPI / NetBanking / Corporate Credit Card, and start using the system without waiting for a manual sales demo.

---

### Module 26: Connected Company Mailbox (Gmail & Outlook OAuth 2.0)

#### 1. Scope & Architecture (`phase 4/backend/mail-sync`, per `SAAS_LAUNCH_CHECKLIST.md` §14)
- **OAuth Integration:** Google Cloud Project (Gmail API) & Microsoft Entra (MS Graph API).
- **Per-Tenant Mailbox Connection:** Allows a tenant to connect a shared company mailbox (`hr@client.com` or `careers@client.com`).
- **In-App HR Mailbox:**
  - Read incoming candidate emails, resignation letters, and employee inquiries.
  - Automatically detect keywords to trigger HR tasks or notifications.
  - Encrypted token storage per tenant with strict isolation.

#### 2. Production Utilization in the Indian Market
- Unifies HR communication so recruitment and grievance emails are never lost when an internal HR executive leaves the company.

---

### Module 27: DPDP Act 2023 Compliance & Soft/Hard Data Purge Lifecycle

#### 1. Scope & Architecture (`phase 4/backend/compliance`, per `SAAS_LAUNCH_CHECKLIST.md` §13)
- **Legal Compliance:** India's **Digital Personal Data Protection (DPDP) Act, 2023**.
- **Two-Tier Deletion Architecture:**
  1. **Soft Delete (Archive / Deactivate):** Sets `deletedAt`, revokes login, hides from active rosters, but retains historical records for mandatory statutory audits (labor law mandates preserving attendance/payroll registers for 3 to 8 years).
  2. **Hard Delete (Permanent Purge):** Irreversible physical erasure gated behind multi-factor confirmation (typing client name or `DELETE`) for formal Right to Erasure requests.
  3. **Audit Log Vault:** Maintains immutable audit trail of who purged what, when, and under which authorization.

#### 2. Production Utilization in the Indian Market
- Protects the software vendor and client from hefty penalties under the Indian DPDP Act (up to ₹250 Crore for personal data security lapses).

---

# PART 3: PHASE 3 VS PHASE 4 COMPARISON MATRIX

| Dimension / Capability | Phase 3 (Live in `phase 3/`) | Phase 4 (Next Phase in `phase 4/`) | Production Impact for Indian Clients |
| :--- | :--- | :--- | :--- |
| **Primary Platform Focus** | Core HRMS, Hierarchy, Attendance, Leave, Tasks, Assets, Policies | Full Statutory Payroll, Mobile Apps, Biometrics, WhatsApp Bot, Public ATS | Moves from HR Operations into Full Statutory Payroll & Mobile Ubiquity |
| **User Interface** | Web Portal (Next.js 19 App Router, Responsive Desktop/Tablet) | Native Mobile (iOS/Android Flutter) + Public Career Portal + WhatsApp | Reaches 100% of blue-collar factory & field workers without laptops |
| **Attendance Capture** | Browser GPS Geofence (Leaflet / OSM) + HR Manual Override | Auto-Punch in Background + Camera Selfie Facial Proof + Hardware Sync | 100% elimination of proxy attendance & physical machine replacement |
| **Hardware Integration** | Zero hardware required (Software GPS on smartphone/laptop) | Biometric IoT Bridge (ZKTeco / eSSL Push SDK Listener) | Connects legacy factory biometric machines directly to cloud HRMS |
| **Leave Management** | CL, SL, EL, LOP, Advance Notice Rules, Holiday Overlap Filter | Auto-sync into Month-End LOP Payroll Deductions | Unpaid leaves automatically reduce salary payout without manual entry |
| **Compensation & Salary** | CTC Structuring (PF 12% / ₹1800 cap, ESIC, HRA, PT, Gross) | 1-Click Monthly Payroll Run, Net Salary Bank Transfer File, Form 16 | Automates complete salary disbursement and statutory compliance |
| **Statutory Returns** | CTC Compliance Profiles (India, UAE, USA) | EPFO ECR text file, ESIC monthly return, Form 16 Part A/B | Zero manual Excel work for company Chartered Accountants (CAs) |
| **Banking Integration** | Downloadable CTC Annexures | Batch NEFT/RTGS Transfer Sheets (HDFC, ICICI, SBI, Axis) | Direct corporate salary disbursement with zero manual account entry |
| **Onboarding & Hiring** | Pipeline with Checklist, CTC binding, 1-Click Employee Graduation | Public Job Board, ATS Interview Stages, Offer Letter Automation | Full cycle from job advertisement to employee confirmation |
| **Employee Offboarding** | Resignation, Notice Calculation, Buyout, Clearance, Deactivation | Full & Final (F&F) Settlement Calculation + Gratuity + Leave Encashment | Legally defensible, clean final settlements with zero unreturned assets |
| **Field Force Tracking** | Daily Beat Plan Roster, Check-In Verification, Distance Audit | Background GPS Route Tracking & Auto-Mileage Claim Verification | Stops fraudulent travel allowance & daily allowance (DA) claims |
| **Performance Review** | Mathematical Auto-Score (40% Task, 20% Att, 20% Leave, 20% Mgr) | Bonus & Annual Increment Multiplier linked to Payroll Run | Transparent, data-driven annual appraisal & incentive payouts |
| **SaaS Multi-Tenancy** | Platform Console (`/superadmin`), Manual Tenant Provisioning | Razorpay Self-Serve Subscriptions, Per-Seat Billing, Auto GST Invoices | Complete zero-touch commercial B2B SaaS onboarding and revenue capture |
| **Messaging & Channels** | Resend System Emails (Welcome, Login Credentials, Alerts) | WhatsApp Business Bot (Punches, Payslips, Approvals) + Email Sync | Allows employees to interact entirely via WhatsApp without opening web app |
| **Data Protection** | Tenant Isolation Middleware + Scoped Org Queries | DPDP Act 2023 Compliant Soft/Hard Delete & Immutable Audit Vault | Total legal protection against Indian personal data protection fines |

---

# PART 4: PRODUCTION DEPLOYMENT & GO-LIVE ACTION PLAN

### Step 1: Phase 3 Pilot Deployment (Available Today)
1. **Backend Database Initialization:**
   ```bash
   cd "D:\careerOS-prod\phase 3\backend\hrms-backend"
   npm install
   npx prisma generate
   npx prisma db push
   node prisma/seed.js
   npm run dev  # Runs on port 5000
   ```
2. **Frontend App Launch:**
   ```bash
   cd "D:\careerOS-prod\phase 3\frontend\hrms-frontend"
   npm install
   npm run dev  # Runs on port 3000
   ```
3. **Seed Credentials for Demonstration & Testing:**
   - **Platform Owner (Superadmin):** `platform.owner@hrms.local` / `PlatformOwner@123` $\to$ Access `/superadmin`
   - **Tenant Admin (Client HQ):** `superadmin@hrms.local` / `SuperAdmin@123` $\to$ Access `/login`
   - **Branch Manager:** `michael.c@hryantra.com` / `password123`
   - **Site Employee:** `priya.sharma@hryantra.com` / `password123`

### Step 2: Phase 4 Rollout Sequence
1. **Milestone 1:** Deploy Full Indian Statutory Payroll Engine (`phase 4/backend/payroll`) and attach to Phase 3 month-end attendance & LOP records.
2. **Milestone 2:** Release the Native Mobile Application (`phase 4/mobile/`) on Google Play Store & Apple App Store with background geofencing and camera selfie punch.
3. **Milestone 3:** Activate Razorpay SaaS billing for self-serve client onboarding on the platform owner console.
4. **Milestone 4:** Launch the WhatsApp Business API bot for zero-friction attendance and payslip downloads.

---
*This technical specification provides the complete functional, architectural, and commercial roadmap for CareerOS / Framework HRMS across Phase 3 and Phase 4 for presentation to clients, stakeholders, and engineering teams.*
