# Phase 2 RBAC permissions — company & organization scope

This guide explains every Team → Roles permission and how **company / organization** scoping works.

Canonical catalogs (keep in sync):

- Backend: `backendphase2/src/modules/role/default-permissions.js`
- Frontend: `frontphase2/src/lib/rbac/permissions.ts`

---

## Core rule (read this first)

| Situation | What the person sees |
|---|---|
| Person A belongs to **Organization A** and has module permissions (e.g. Clients, Jobs) | **Org A data only** (subject to “my assigned” vs “all in my current company”) |
| Person A also has module “view all …” ticks | Still **Org A only** — “view all” never unlocks Org B |
| Person A needs Org B (or any other company) | Tick **Organization — switch companies**, then pick CRM and/or Recruitment organizations under that tick |
| Super Admin | Can switch to any company by default |

**Organization — switch companies** is a separate gate. Module permissions open pages and actions *inside* the active company. They do not replace the switcher.

### Example

1. **Priya** is a member of **Keystone** (Org A). Role has `clients_read` + `view_all_clients`.
   - She sees all CRM clients stamped under Keystone.
   - She does **not** see **Northwind** clients.
2. Admin adds **Organization — switch companies** and ticks Northwind under **CRM**.
   - Priya gets the company switcher.
   - After switching to Northwind, her CRM client permissions apply there.
3. Without the switch tick (or without org picks), the switcher stays hidden and lists stay pinned to her home company.

---

## Two layers of access

1. **Company layer** — which organization(s) you may open  
   - Default: home company / organization  
   - Extra companies: `switch_companies` + CRM/Recruitment picks  
2. **Module layer** — what you can do inside the active company  
   - e.g. `clients_read`, `view_all_clients`, `jobs_update`

Retired tick `view_all_companies` does **not** grant access anymore. Use switch companies + picks.

---

## CRM

### Leads

| Key | Label / meaning | Example |
|---|---|---|
| `leads_create` | Create leads | Priya can add a lead in Keystone |
| `leads_read` | Open Leads page | Sees leads she may access in current company |
| `leads_update` | Edit leads | Update stages / details |
| `leads_delete` | Delete leads | Soft-delete in current company |
| `view_all_leads` | All leads in **current company** | All Keystone leads — not Northwind |
| `convert_lead` | Convert lead → client | Only for leads she can open |

### Clients (CRM)

| Key | Label / meaning | Example |
|---|---|---|
| `clients_create` | Create CRM clients | New CRM client under active company |
| `clients_read` | My assigned / org members in **current company** | Assigned + teammate-linked clients in Keystone |
| `clients_update` | Update CRM clients | Edit details |
| `clients_delete` | Delete CRM clients | Delete in current company |
| `view_all_clients` | All CRM clients in **current company** | Every Keystone CRM client — still not Northwind without switch |
| `clients_handoff` | Hand off to another department | Forward a client internally |

### Contacts

| Key | Meaning |
|---|---|
| `contacts_create` / `read` / `update` / `delete` | Contacts page CRUD (scoped with the related CRM records / company) |

### Agreements

| Key | Meaning |
|---|---|
| `agreements_read` | View Agreements & Terms on clients and leads |
| `agreements_manage` | Create or update Agreements & Terms |

### CRM Dashboard tabs

| Key | Meaning |
|---|---|
| `dash_crm_insights` | Tab: Insights & actions |
| `dash_crm_pipeline` | Tab: Pipeline & records |
| `dash_crm_team` | Tab: Team & outreach (also unlocks Hours & scores) |
| `dash_crm_people` | Tab: Hours & scores |

How wide dashboard numbers go is controlled by **Dashboard level** permissions under System (`dash_*_scope`), still limited by company switch rules.

---

## Recruitment

### Recruitment Clients

Independent of CRM Clients.

| Key | Meaning | Example |
|---|---|---|
| `recruitment_clients_create` | Create recruitment clients | New recruitment client in Keystone |
| `recruitment_clients_read` | My assigned / org members in **current company** | Assigned recruitment clients in Keystone |
| `recruitment_clients_update` / `delete` | Update / delete | Within current company |
| `view_all_recruitment_clients` | All recruitment clients in **current company** | All Keystone recruitment clients — not other orgs without switch |

### Jobs

| Key | Meaning |
|---|---|
| `jobs_create` / `read` / `update` / `delete` | Jobs page CRUD |
| `assign_job` | Assign jobs to recruiters |
| `view_all_jobs` | All jobs in **current company** |
| `publish_job` | Publish to portal / social |

### Candidates

| Key | Meaning |
|---|---|
| `candidates_create` / `read` / `update` / `delete` | Candidates page CRUD |
| `view_all_candidates` | All candidates in **current company** |
| `view_assigned_candidates` | Assigned candidates only |
| `move_pipeline` | Move candidates on Pipeline |
| `submit_candidate` | Submit candidates to jobs |

### Matches / Pipeline / Interviews / Placements

| Key | Meaning |
|---|---|
| `matches_read` / `matches_manage` | Matches page |
| `pipeline_read` / `pipeline_manage` | Pipeline page |
| `interviews_create` / `read` / `update` / `delete` / `feedback` | Interviews |
| `placements_create` / `read` / `update` / `delete` | Placements |

### Recruitment Dashboard tabs

| Key | Meaning |
|---|---|
| `dash_rec_insights` | Insights & actions |
| `dash_rec_pipeline` | Pipeline & records |
| `dash_rec_team` | Team & performance (also Hours & scores) |
| `dash_rec_people` | Hours & scores |

---

## Workspace

| Key | Meaning |
|---|---|
| `tasks_create` / `read` / `update` / `delete` | Tasks & Activities |
| `calendar_read` / `calendar_manage` | Calendar |
| `events_read` / `events_manage` | Portal Events |
| `inbox_read` | Inbox → Gmail and Outlook |
| `inbox_manage` | Chat tab on records — send messages |
| `requests_create` / `read` / `update` / `delete` | Requests |
| `view_all_requests` | All requests in **current company** |
| `approve_requests` | Requests — Approvals |

---

## Insights & Finance

| Key | Meaning |
|---|---|
| `reports_create` / `read` / `update` / `delete` | Reports |
| `behavior_read` / `behavior_manage` | Behaviour analytics |
| `access_billing` | Billing page |
| `create_invoice` | Billing → Invoices |
| `record_payment` | Billing → Payments |
| `manage_billing_settings` | Invoice template / billing settings |
| `manage_subscription` | Subscription & Plan |

---

## Administration

### Team

| Key | Meaning | Example |
|---|---|---|
| `view_team` | Team → Members | See members (usually own company) |
| `view_cross_company_members` | View / assign members from **other companies** in this tenant | Pick a company, then its people — separate from switch companies |
| `add_team_member` / `edit_team_member` | Add / edit members |
| `assign_roles` / `manage_roles` | Roles tab |
| `manage_departments` | Departments |
| `generate_credentials` | Credentials |
| `manage_commission` | Commission slabs |
| `manage_targets` | Targets & KPI |
| `view_team_activity` | Member activity |

### Organization (company gate)

| Key | Meaning | Example |
|---|---|---|
| `org_structure` | Edit full company tree (HQ, companies, sites) | HQ admin reshapes the tree |
| `node_org_structure` | Manage sites & people under **own company only** | Keystone company head manages Keystone sites |
| `switch_companies` | **Required** to open other companies’ data; shows switcher; then pick CRM / Recruitment orgs | Priya (Keystone) + Northwind CRM pick → can switch into Northwind CRM |
| `view_all_companies` | **Retired** — grants nothing | Do not rely on this tick |

Under **switch_companies**, the role editor shows CRM and Recruitment organization checklists. At least one org on one side must be ticked when switch is enabled.

### Company Page

| Key | Meaning |
|---|---|
| `company_page_read` / `company_page_manage` | Public tenant company page |

### System / Dashboard level

| Key | Meaning |
|---|---|
| `manage_settings` | Notifications, alerts, recruitment workflow, data & security, customization |
| `access_integrations` | Communication & Integrations |
| `export_data` | Export from lists / reports |
| `view_activity_log` | Activity log |
| `recycle_bin_manage` | Recycle Bin |
| `view_dashboard` | Open CRM / Recruitment dashboards |
| `dash_dept_scope` | Dashboard level: my department |
| `dash_company_scope` | Dashboard level: this company / branch |
| `dash_full_scope` | Dashboard “whole tenant” **only if** Switch companies is active (with picks / All). Without switch, stays at own company |
| `dash_mine_approvals` | My work — approvals bucket |

---

## How to configure a role (checklist)

1. Assign the person to **Organization A** (home company).
2. Tick module permissions they need for Org A work (`clients_read`, `jobs_read`, etc.).
3. Optionally tick “all in my current company” (`view_all_clients`, `view_all_jobs`, …) for breadth **inside Org A**.
4. If they must also work in Org B / Org C:
   - Tick **Organization — switch companies**
   - Open CRM and/or Recruitment under that tick
   - Select the organizations they may enter
5. Save the role. User must re-login or refresh for JWT/permission cache if needed.

---

## Common mistakes

| Mistake | Result |
|---|---|
| Tick `view_all_clients` expecting every company | Only current company; other orgs still blocked |
| Tick `switch_companies` but pick no CRM/Recruitment orgs | Save is rejected; switcher will not work |
| Tick `dash_full_scope` without switch | Dashboard stays company-scoped to home org |
| Rely on retired `view_all_companies` | No effect |

---

## Super Admin note

Super Admin always has tenant-wide company access and does not need the switch tick or org picks. Company switcher is available for focusing lists on one organization.
