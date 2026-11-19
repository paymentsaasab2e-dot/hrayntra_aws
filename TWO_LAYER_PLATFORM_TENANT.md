# Two-layer Platform vs Tenant HQ (Framework)

This is how Framework splits **Platform owner** and **Tenant admin** after the `/superadmin` upgrade.

## Layer A — Platform owner

| Item | Value |
|------|--------|
| Portal | `/superadmin` (login: `/superadmin/login`) |
| Role | `PLATFORM_OWNER` (UI: Platform owner) |
| Job | Create/control clients only — **not** day-to-day attendance, leave, or org tree |

**Routes**

- `/superadmin/tenants` — Clients list  
- `/superadmin/tenants/new` — Create client (hierarchy levels + Tenant admin login)  
- `/superadmin/tenants/[id]` — Detail: edit, credentials, location-column flag, analytics, read-only hierarchy  

Legacy `/platform` redirects here.

**Does not:** build divisions/sites, punch, leave, or open tenant HQ ops (forced back to Clients).

## Layer B — Tenant HQ admin

| Item | Value |
|------|--------|
| Portal | `/login` → tenant dashboard |
| Role | `ADMIN` (UI label: **Tenant admin**; code still `Superadmin` / `ADMIN`) |
| Job | Run one company: org tree, users, approvals, master data, operations |

**Aliases**

- `/headquarters` → dashboard  
- `/headquarters/org-structure` → `/org-structure`  
- `/headquarters/approvals` → `/approvals`  

**Permission rule:** Tenant admin (`ADMIN`) **bypasses package module matrix** — full tenant modules, never Platform Console.

## Visibility

- Tenant HQ (Main Branch / L1) → whole company  
- Division head → self + subtree  
- Site head → that site only  
- Platform owner → no tenant org attachment  

## Demo logins (seed)

- Platform owner: `platform.owner@hrms.local` / `PlatformOwner@123` → `/superadmin/login`  
- Tenant admin: `superadmin@hrms.local` / `SuperAdmin@123` → `/login`  
