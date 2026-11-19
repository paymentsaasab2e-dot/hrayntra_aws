A. Who gets which portal
Employee portal — employee (or custom access role with no manager modules). Menu: Home, Attendance, Leaves, Activity History, Settings.
Manager portal — branch_manager (division), site_supervisor (site), or any user with read on a manager module. Full manager menu + self-service Attendance/Leaves.
HQ / tenant admin bypass — tenant_admin, admin, platform_owner. All module actions are on (read / create / update / delete / approve). Tenant-wide analytics. Same mobile screens as manager, no extra HQ org-structure screen on mobile.
B. Device (OS) permissions — purpose
Internet — API login, punch, leaves, reports.
Fine + coarse location — GPS punch, geofence check at assigned location.
Background location — auto punch in/out while punched in.
Foreground service + location service + wake lock — keep geofence running in background.
Notifications — punch-in status notification.
Camera — attendance proof photo + signup document/photo capture.
iOS photo library add — save attendance photos if needed.
C. App RBAC modules (access roles)
Each module can have: read, create, update, delete, approve.

Module Purpose
dashboard
Team / tenant analytics dashboard
users
Team user list, edit, approve/reject, delete
locations
Geofence locations (name, lat/lng, radius)
shifts
Shift timings
departments
Departments
designations
Designations
leaves
Team leaves + leave approve
holidays
Holiday calendar
attendance
Team attendance + own calendar if read
reports
Register / summary reports + export
master
Master forms (web; signup uses public forms)
headquarters
HQ home / tenant analytics (web)
org_structure
HQ org tree (web)
hq_approvals
HQ approval inbox
hq_settings
Approval levels / leave policy (web)
settings
Settings + Access Roles on mobile
approval_roles
Approval-role mapping (web)
node_org_structure
Sites & team under a division (web)
Approvals screen shows if: HQ/tenant admin, or leaves.approve, or users.approve, or hq_approvals read/approve.

D. Mobile pages (live routes) — UI purpose + functions
Auth / onboarding
Splash /
Purpose: boot / restore session.
Functions: load token, send to Welcome, Pending, or Home.

Welcome /welcome
Purpose: landing / branding.
Functions: go to Login or Sign up.

Login /login
Purpose: sign in.
Functions: email or mobile + password; error toast; after login go Home or Pending.

Sign up /signup
Purpose: self-register.
Functions: master form fields, org hierarchy, photo/file upload (camera), submit; then wait for approval.

Approval pending /approval-pending
Purpose: blocked until HQ/manager approves the account.
Functions: wait message, refresh status, logout.

Self-service (all logged-in users)
Home /dashboard (SaasDashboard)
Purpose: personal attendance home.
Functions: punch in / punch out (GPS + camera), today’s hours, geofence status, recent punches, charts, notifications, pending-approval badge, profile drawer, service grid / menu by role.

Attendance /attendance-records
Purpose: my attendance (and Team if attendance.read).
Functions:

My: calendar, holidays, day detail, hours.
Team: team punch list, day/week/month filter, day detail sheet.
Leaves /leaves
Purpose: my leaves (and Team if leaves.read).
Functions:

My: balance, apply leave, list status.
Team: pending/all team leaves, search, timeline filter.
Activity History /activity-history
Purpose: local + server punch log.
Functions: punch success/fail, login/other local events, newest first.

Settings /settings
Purpose: personal settings (employees always; managers need settings.read unless HQ admin).
Functions:

Attendance tab: today status/hours, assignment, geofence auto-punch info.
Notifications: enable/disable punch status notification.
Account: profile, mobile number (login with mobile), theme, logout.
Profile drawer (sheet from Home, not a route)
Purpose: my profile.
Functions: view/edit location, shift, department, designation; today’s punch summary.

Manager / HQ admin (menu if module read is on)
Manager Dashboard /manager/dashboard — module dashboard
Purpose: scoped analytics UI.
Functions: KPIs, charts, refresh. Scope: tenant-wide (HQ admin), division (branch_manager), site (site_supervisor).

Reports /reports — module reports
Purpose: attendance reports.
Functions: monthly register, summary (7/30/90/365 days), org-unit filter (HQ / division), name filter, export.

Users /manager/users — module users
Purpose: team directory.
Functions: search, open user sheet.
Sheet: view, update (name, location, shift, dept, designation), approve/reject pending, delete.

Locations /manager/locations — module locations
Purpose: geofence master.
Functions: list/search, create/update via sheet (name, lat, lng, radius).

Shifts /manager/shifts — module shifts
Purpose: shift master.
Functions: list/search, create/update name + start/end.

Departments /manager/departments — module departments
Purpose: department master.
Functions: list/search, create/update.

Designations /manager/designations — module designations
Purpose: designation master.
Functions: list/search, create/update.

Holidays /manager/holidays — module holidays
Purpose: holiday master.
Functions: list/search, create/update date/type/active.

Access Roles /manager/access-roles — module settings
Purpose: RBAC roles for staff.
Functions: list, create/edit name + module permission matrix, delete. (Web still used for credential users, org nodes, web dashboard flag.)

Approvals /approvals — hq_approvals / leaves.approve / users.approve
Purpose: inbox.
Functions:

Leaves tab: pending leaves, approve/reject if leaves.approve.
Users tab: pending signups, approve/reject if users.approve.
Team Attendance /manager/attendance — same Attendance hub, Team tab first.

Team Leaves /manager/leaves — same Leaves hub, Team tab first.

Routed but not in the live menu (legacy / unused UI)
These still have routes; they are not in AppPermissions menu:

/history — old personal history
/employees — old employees
/tasks — tasks
/departments — old departments
/roles — old roles
/user-management — old admin users
/announcements — announcements
Also unused as routes: live tracking screen, old attendance dashboard, enterprise settings.

E. HQ tenant admin — permission functions (list)
Roles: tenant_admin, admin, plus platform_owner (same full bypass on mobile).

They do not use access-role checkboxes. Backend gives all modules, all 5 actions.

On mobile they can:
Open every manager screen above
Tenant-wide analytics (not locked to one site/division)
Filter reports by any org unit
CRUD locations, shifts, departments, designations, holidays
View/edit/approve/reject/delete users
Approve/reject leaves
Create/edit/delete access roles and full permission matrix
Punch, apply leave, see own calendar (self-service)
Settings without settings.read check
HQ modules they own (full R/C/U/D/A) — mostly web dashboard, not separate mobile pages:
headquarters — HQ home, tenant-wide charts, jump to org structure
org_structure — create/edit/delete divisions and sites
hq_approvals — tenant-wide approval inbox; approve/reject org units and requests
hq_settings — approval levels, leave policy
approval_roles — who can approve at which level
node_org_structure — sites & team (used more by division heads on web)
master — registration form builder (signup on mobile reads public forms)
What HQ admin cannot do on mobile (web only today)
HQ org structure tree
HQ settings / approval policy
Approval-roles page
Sites & team org page
Register employee with web dashboard access / credentials (mobile Access Roles screen says use web for that)
F. Permission action → typical page function
read — see the page / list
create — + button (locations, shifts, depts, designations, holidays, access roles)
update — edit sheet (users, master entities, roles)
delete — delete user or access role
approve — leave / user onboarding (and HQ inbox on web)
If create/update/delete/approve is on, read is forced on in the matrix UI.

G. Menu by role (short)
Employee: Home, Attendance, Leaves, Activity History, Settings

Manager (by module read): Home + Dashboard, Reports, Users, Locations, Shifts, Departments, Designations, Holidays, Access Roles, Approvals (if approve rights), Settings, Attendance, Leaves

HQ tenant admin: all of the manager menu, always, plus full CRUD/approve on every module
