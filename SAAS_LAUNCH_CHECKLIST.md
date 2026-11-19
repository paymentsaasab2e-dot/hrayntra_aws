# Framework HRMS — SaaS Launch Checklist

**Product:** Framework HRMS  
**Audience:** Founders / platform team preparing to sell to Indian SMEs (sales-led or public SaaS)  
**Based on:** Current two-layer system (Platform owner `/superadmin` → Tenant admin `/login` → ops)

Use this as the go/no-go document before taking paying clients.

---

## 1. How the product is meant to sell

### Layer A — Platform owner (you / product company)

| Item | Value |
|------|--------|
| Portal | `/superadmin` (login: `/superadmin/login`) |
| Role | `PLATFORM_OWNER` |
| Job | Create and control clients (tenants). Does **not** run day-to-day attendance, leave, or org tree for a client. |

**Core routes**

- `/superadmin/dashboard` — Platform KPIs  
- `/superadmin/tenants` — Clients list  
- `/superadmin/tenants/new` — Create client (hierarchy + Tenant admin + module chips)  
- `/superadmin/tenants/[id]` — Edit, credentials, modules, analytics  
- `/superadmin/leads` — Sales pipeline (demo / early)  
- `/superadmin/subscriptions` — Package / seats view  

### Layer B — Tenant HQ admin (the client’s super admin)

| Item | Value |
|------|--------|
| Portal | `/login` → tenant dashboard |
| Role | `ADMIN` (UI: Tenant admin) |
| Job | Run one company: org tree, users, approvals, master data, operations |

**Visibility**

- Tenant HQ (Main Branch / L1) → whole company  
- Division head → self + subtree  
- Site head → that site only  
- Platform owner → **not** attached to a tenant  

---

## 2. What already works (demo / pilot ready)

| Area | Status |
|------|--------|
| Platform owner console | Create client, hierarchy levels, Tenant admin login, module chips, suspend/delete, credentials reset |
| Tenant admin portal | Org structure, users, leave, attendance, tasks, assets, approvals, reports (when modules enabled) |
| Packages | Starter / Professional / Enterprise + custom module selection |
| Org scope | HQ = whole company; manager ≈ subtree via org units |
| Email (optional) | Resend welcome on tenant admin / user create (needs real API key + domain) |
| India-oriented HR | CL/SL/EL leave, CTC PF/ESI structure, geofence attendance |
| Platform tabs | Dashboard, Clients, Leads (demo), Subscriptions (package view) |

**Verdict:** Enough for a **controlled pilot** with 1–3 friendly clients. **Not** enough for open public SaaS until Critical items below are closed.

---

## 3. CRITICAL — must fix before selling to real clients

### 3.1 Data isolation (security blocker)

**Implemented (backend):**

- Fail-closed tenant resolve (no `findFirst()` inventing a company)
- `tenantId` on Employee, WorkLocation, Holiday, Asset, Document, Project, Task
- Org scope middleware on users, holidays, locations, assets, documents, projects, tasks, employees, leave, attendance, performance, etc.
- Visibility logic: **HQ (ADMIN/HR)** = whole tenant; **MANAGER** = org subtree; **EMPLOYEE** = self
- Backfill script: `npx ts-node src/scripts/backfill-tenant-ids.ts` (from `hrms-backend`)

**Pass checkpoint**

- [ ] Create Client A and Client B  
- [ ] Login as Tenant admin A  
- [ ] A never sees B’s users, holidays, locations, punches, leaves, assets, documents, tasks  
- [ ] Manager under Division X only sees employees/tasks in X subtree  
- [ ] Employee only sees own attendance/leave/tasks  

**Fail = do not launch multi-tenant SaaS.**

### 3.2 Auth & account lifecycle

Missing / incomplete for production:

- [ ] Forgot / reset password  
- [ ] Invite link (email → set password)  
- [ ] Force change password on first login  
- [ ] Session revoke / logout everywhere  
- [ ] Login lockout / brute-force protection  
- [ ] Production `JWT_SECRET` (not `change-me`)  
- [ ] CORS locked to your real frontend domain(s)  

**Pass checkpoint**

- [ ] Tenant admin can onboard staff without pasting passwords on WhatsApp  

### 3.3 Email & domain

- [ ] Resend (or equivalent) with **verified sending domain**  
- [ ] Welcome email for Tenant admin on client create  
- [ ] Welcome / invite email for users  
- [ ] Password reset templates  
- [ ] `HRMS_APP_URL` = production URL (not `localhost`)  

### 3.4 Honest product boundaries (sales + contract)

Do **not** oversell:

| Claim carefully | Reality today |
|-----------------|---------------|
| Full payroll | CTC / PF / ESI **structure** exists; payslip runs, bank transfer, Form 16 do **not** |
| Native mobile app | Spec / guide exists (`mobileguidetomake.md`); not a shipped production app |
| Self-serve signup | Platform owner provisions tenants; open marketplace signup is not built |

Put this in proposals, demos, and contracts.

### 3.5 Production operations

- [ ] Host frontend + API + MongoDB (e.g. Atlas)  
- [ ] HTTPS everywhere  
- [ ] Automated backups + restore drill  
- [ ] Uptime monitoring  
- [ ] Error tracking (e.g. Sentry)  
- [ ] Separate prod vs demo environments  
- [ ] Seed / demo passwords removed or changed in production  
- [ ] Platform owner accounts only for your internal team  

### 3.6 Legal / India SaaS basics

- [ ] Terms of Service  
- [ ] Privacy Policy  
- [ ] DPDP-aligned data handling statement  
- [ ] Data ownership + deletion policy (tenant delete already wipes users/org — document it; align with soft/hard delete in §13)  
- [ ] GST invoicing process (manual OK for sales-led start)  

---

## 4. IMPORTANT — needed soon after first pilots

| Item | Why | Done |
|------|-----|------|
| Seat limit enforcement | `maxUsers` exists — block create-user at limit | [ ] |
| Soft delete + restore | Accidental deletes; DPDP retention; undo without cascade disaster | [ ] |
| Hard delete (purge) | Legal “erase me”, tenant offboarding, storage cleanup | [ ] |
| Tenant first-login wizard | Locations → Org → Users → Attendance policy | [ ] |
| Audit logs | Who changed leave / attendance / users / deletes | [ ] |
| Support playbook | How clients raise issues; you reset admin via `/superadmin` | [ ] |
| Subscriptions = real billing | Package UI exists; Razorpay/Stripe + invoices do not | [ ] |
| Leads → real CRM fields | Leads tab is demo data today | [ ] |
| Gmail / Outlook connect (tenant inbox) | HR mail in-app for leave replies, candidate mail, support | [ ] |
| Rate limits on login/API | Reduce abuse | [ ] |
| Status page / incident notes | Client trust | [ ] |

---

## 5. NICE-TO-HAVE (after revenue)

- [ ] Native mobile apps (employee / manager portals per mobile guide)  
- [ ] Full payroll engine (payslips, bank files, statutory filings)  
- [ ] Customer self-upgrade of packages  
- [ ] White-label / custom domain per client  
- [ ] SSO / Google login (separate from Gmail mailbox OAuth in §14)  
- [ ] Shared mailbox / multi-inbox per department (HR, Recruiting, Support)  
- [ ] Auto-create leave/task from inbound email rules  
- [ ] Hindi + English UI  
- [ ] Public self-serve trial signup  

---

## 6. Two launch models — pick one first

### A. Sales-led SaaS (recommended first)

Matches current product (you create every client in `/superadmin`).

**You need before first paid client**

1. Tenant isolation (Critical 3.1)  
2. Prod hosting + secrets + CORS  
3. Email for credentials / welcome  
4. Legal pages + GST invoice process  
5. Support + password reset path (even if admin-assisted at first)  
6. Honest sales scope (no fake payroll/mobile claims)  
7. Soft delete on users/employees at minimum (hard purge optional but planned)  

### B. Public self-serve SaaS

Everything in A, **plus**:

- [ ] Public signup  
- [ ] Trial expiry / conversion  
- [ ] Razorpay or Stripe  
- [ ] Spam / bot protection  
- [ ] Stronger abuse and quota controls  
- [ ] Clear soft vs hard delete in account-closure UX  

---

## 7. Functional go-live script (run this end-to-end)

### A. Platform owner (you)

- [ ] Login at `/superadmin/login`  
- [ ] Open Dashboard — KPIs load  
- [ ] **Create client**: name, slug, hierarchy levels, module chips, Tenant admin name/email/password  
- [ ] Welcome email arrives **or** credentials visible on client detail  
- [ ] Edit modules → Save → Tenant admin sees only enabled tabs after refresh/login  
- [ ] Suspend client → their login blocked  
- [ ] Reset Tenant admin password from client detail  
- [ ] Soft-delete a test client (inactive / recoverable) vs hard-delete only on throwaway tenant  
- [ ] (Test only) Hard delete client → users/org purged irreversibly  

### B. Tenant admin (client HQ)

- [ ] Login at `/login` (not `/superadmin`)  
- [ ] Sees only modules you enabled  
- [ ] **Locations**: create geofence site  
- [ ] **Org structure**: Main Branch → Division → Site  
- [ ] **Users**: create employee + manager; assign org unit  
- [ ] Soft-delete a user → disappears from active list; restore works  
- [ ] Hard-delete (purge) only with confirm + permission  
- [ ] **Leave**: apply + approve  
- [ ] **Attendance**: office geofence punch works  
- [ ] **Tasks**: create with empty assignee, then select employees  
- [ ] **Reports**: open without crash  
- [ ] (If enabled) Connect Gmail or Outlook → inbox list loads for that tenant only  

### C. Isolation test (mandatory)

- [ ] Two tenants, two admins  
- [ ] Cross-check users / holidays / locations / attendance / leave  
- [ ] Connected mailboxes never mix across tenants  
- [ ] Soft-deleted records of A never appear for B  
- [ ] Zero leakage  

### D. Manager / employee smoke

- [ ] Manager sees subtree (not other divisions)  
- [ ] Employee: punch + leave + own tasks  

### E. Sales package story

- [ ] Starter / Professional / Enterprise modules match pricing sheet  
- [ ] Contract says: CTC ≠ full payroll; mobile = roadmap  
- [ ] Contract says: mailbox OAuth stores tokens per tenant; client can disconnect anytime  

---

## 8. Recommended build order (engineering)

Do in this sequence for fastest path to first paid pilot:

1. **Tenant isolation** — `tenantId` on all operational models + filter every list/get/update/delete  
2. **Remove `findFirst()` tenant fallback** — fail closed if no tenant  
3. **Users API scoped by tenant**  
4. **Soft delete + restore** on users, employees, org units (then assets/docs)  
5. **Hard delete / purge** with role gate + audit log (platform: tenants; tenant: users)  
6. **Prod secrets, CORS, HTTPS, backups**  
7. **Email + password reset (or invite link)**  
8. **Seat limit hard stop**  
9. **First-login tenant wizard**  
10. **Gmail / Outlook OAuth inbox connect** (after isolation + soft delete are solid)  
11. **Billing (Razorpay)** only when sales-led flow is stable  
12. **Mobile / payroll** as separate paid phases  

---

## 9. Demo logins (development / seed only — change in production)

| Who | Email | Password | URL |
|-----|-------|----------|-----|
| Platform owner | `platform.owner@hrms.local` | `PlatformOwner@123` | `/superadmin/login` |
| Tenant admin | `superadmin@hrms.local` | `SuperAdmin@123` | `/login` |

**Never** ship these unchanged to production.

---

## 10. Sales one-liners (safe claims)

**OK to say**

- Geofenced attendance, leave (CL/SL/EL), org hierarchy, assets, tasks, approvals, India CTC structure (PF/ESI/HRA), multi-company Platform Console  
- (When built) Soft delete with restore; optional Gmail/Outlook inbox connect for HR  

**Do not say yet**

- “Full payroll software”  
- “Native mobile app live on Play Store / App Store”  
- “Sign up online and start in 2 minutes” (unless self-serve is built)  
- “We read all your company email” — only connected inbox(es) the client authorizes  

---

## 11. Launch readiness scorecard

| Gate | Ready? |
|------|--------|
| Controlled pilot (1–3 known clients, sales-led) | Possible after Critical 3.1–3.5 |
| Paid sales-led SaaS (repeatable) | After Critical + Important (seats, soft delete, support, legal) |
| Public marketplace SaaS | After sales-led + billing + signup + abuse controls |
| Mail-integrated HR ops | After §14 Gmail/Outlook OAuth + tenant isolation |

**Bottom line**

- **Ready for:** paid pilots / closed beta **if** tenant isolation, prod hardening, email, and legal are done.  
- **Not ready for:** open public signups, or claiming full payroll + mobile.  
- **Add before serious HR mail claims:** soft/hard delete policy + connected inbox (Gmail/Outlook).  

---

## 12. Related docs in this repo

- `TWO_LAYER_PLATFORM_TENANT.md` — Platform vs Tenant HQ split  
- `HRMS_INDIA_SALES_PITCH.md` — India market pitch order  
- `mobileguidetomake.md` — Mobile app design guide (roadmap)  
- Backend: `docs/PLATFORM_TENANT_TESTING.md` — Platform / tenant test flows  

---

## 13. Soft delete vs hard delete (necessary product functions)

Today many deletes are **immediate / cascade** (e.g. platform tenant delete). For SaaS + India compliance, split into two actions everywhere it matters.

### 13.1 Soft delete (archive / deactivate)

**Purpose:** Undo mistakes, keep history for audits, stop login without wiping records.

| Rule | Detail |
|------|--------|
| Behaviour | Set `deletedAt` (and/or `status = INACTIVE` / `ARCHIVED`). Hide from default lists. |
| Login | Soft-deleted users cannot log in. |
| Restore | Tenant admin (or platform owner for tenants) can restore within retention window. |
| Scope (minimum) | Users, employees, org units, documents, assets, leave requests (as policy), tenants (platform: suspend + soft delete). |
| Lists | Active view excludes soft-deleted; “Trash / Archived” view for restore. |
| Reports | Option: exclude soft-deleted by default; include for historical attendance/leave. |

**Checkpoints**

- [ ] Soft delete user → gone from Users table, still in Trash  
- [ ] Restore user → login + org assignment work again  
- [ ] Soft-deleted employee does not appear in task assignee picker  
- [ ] Soft delete is **tenant-scoped** (A cannot restore B’s trash)  

### 13.2 Hard delete (purge)

**Purpose:** Permanent erase — client offboarding, DPDP erasure request, storage cleanup.

| Rule | Detail |
|------|--------|
| Behaviour | Physically remove row(s) and related data allowed by policy; irreversible. |
| Who | Tenant admin: purge own soft-deleted users/docs (gated). Platform owner: purge tenant after soft delete + confirm. |
| UX | Typed confirm (`DELETE`) + optional reason; never one-click. |
| Audit | Log who purged what, when, tenantId (keep audit even if row is gone). |
| Dependencies | Block hard delete if open allocations / pending clearances (or force-clear with warning). |
| Tenant hard delete | Wipe that tenant’s users, org, ops data; cannot undo. Prefer soft delete + suspend first. |

**Checkpoints**

- [ ] Hard delete only available from Trash / after soft delete (recommended)  
- [ ] Confirm dialog requires typing client/user name or `DELETE`  
- [ ] Purge does not leave orphan attendance/leave pointing at missing employee (cascade or reassign policy documented)  
- [ ] Platform hard-delete tenant is separate from day-to-day tenant ops  

### 13.3 Suggested UI labels

| Action | Button copy |
|--------|-------------|
| Soft delete | Archive / Deactivate |
| Restore | Restore |
| Hard delete | Delete permanently |

### 13.4 Current vs target

| Area | Current (approx.) | Target |
|------|-------------------|--------|
| Platform tenant delete | Hard cascade wipe | Soft delete/suspend first → optional hard purge |
| Users / employees | Often hard delete | Soft delete + restore + optional purge |
| Org units | Delete if empty | Soft delete preferred; hard only if empty + archived |

---

## 14. Gmail / Outlook integration (connect mail → in-app inbox)

**Purpose:** Let a tenant connect a company mailbox (HR / recruiting / support) so Framework can show that inbox and optionally send from it — without becoming a full email client on day one.

### 14.1 What to build (MVP)

| Capability | Detail |
|------------|--------|
| Connect Gmail | OAuth 2.0 (Google Cloud project, Gmail API scopes: read + send as needed) |
| Connect Outlook | OAuth 2.0 (Microsoft Entra app, Microsoft Graph mail scopes) |
| Per-tenant connection | Tokens stored encrypted, bound to `tenantId` (+ optional `orgUnitId` / department) |
| Inbox list | Subject, from, date, read/unread — for the connected mailbox only |
| Open thread | Read message body (sanitize HTML) |
| Reply / send | Optional MVP+: reply from connected address |
| Disconnect | Revoke token + delete stored credentials |
| Permissions | Tenant admin (or Settings → Integrations); not Platform owner reading client mail |

### 14.2 Where it lives in product

| Layer | Role |
|-------|------|
| Tenant HQ | **Settings → Integrations** or **Inbox** module (package/chip gated) |
| Platform owner | Does **not** open client mailboxes; only sees “integration enabled” flag for support |

Suggested nav (tenant): **Inbox** (or under Settings) — only if module chip / package allows.

### 14.3 Security & compliance (non-negotiable)

- [ ] OAuth tokens encrypted at rest; never logged  
- [ ] Strict `tenantId` on every mail API call  
- [ ] Refresh-token rotation / reconnect UX when expired  
- [ ] Scopes minimal (prefer read-only first; add send later)  
- [ ] Privacy Policy + ToS disclose mailbox access  
- [ ] Client can disconnect anytime; data pull stops  
- [ ] No cross-tenant inbox leakage (isolation test §7.C)  

### 14.4 Useful HR use cases (phase later)

- Leave / resignation mail parked in shared HR inbox  
- Candidate / offer replies next to onboarding  
- Support tickets from `hr@client.com`  
- Optional: rule → create task or notification from sender domain  

### 14.5 Out of scope for MVP (say so in sales)

- Full CRM mailbox for every employee  
- Migrating entire historical mail archive  
- Acting as primary company mail server  
- Reading mail without explicit OAuth connect  

### 14.6 Build checkpoints

- [ ] Google OAuth app + redirect URLs for prod/staging  
- [ ] Microsoft Entra app + redirect URLs  
- [ ] UI: Connect Gmail / Connect Outlook / Disconnect  
- [ ] Inbox list loads for connected tenant only  
- [ ] Second tenant cannot see first tenant’s threads  
- [ ] Disconnect clears tokens; next API call fails closed  
- [ ] Package/module chip: `inbox` or under Settings  

### 14.7 Relation to existing Resend email

| Channel | Use |
|---------|-----|
| **Resend (system mail)** | Welcome, password reset, notifications **from Framework** |
| **Gmail / Outlook (connected)** | Client’s **own** HR/support mailbox inside the product |

Both are needed eventually; they solve different problems.

---

*Update this checklist as isolation, soft/hard delete, mail OAuth, auth, billing, and mobile land. Treat section 3 as the hard launch gate; §13–§14 as required product functions for serious SaaS ops.*
