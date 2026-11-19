# Complete Hierarchy System Specification (HRMS)

Portable reference for the org hierarchy implemented in `phase_3` HRMS (`hrms` + `hrms_backend`). Adapted from the multi-tenant attendance platform spec; this deployment uses a **single tenant** with full org-tree, scope filtering, and L1–L3 approval chains.

---

## Table of contents

1. [Overview and mental model](#1-overview-and-mental-model)
2. [Tenant and hierarchy levels](#2-tenant-and-hierarchy-levels)
3. [Org unit data model](#3-org-unit-data-model)
4. [Roles and portals](#4-roles-and-portals)
5. [Building the org tree (HQ)](#5-building-the-org-tree-hq)
6. [Building the org tree (division manager)](#6-building-the-org-tree-division-manager)
7. [Org scope middleware](#7-org-scope-middleware)
8. [User creation and assignment](#8-user-creation-and-assignment)
9. [Approval system L1 / L2 / L3](#9-approval-system-l1--l2--l3)
10. [Scoped operational data](#10-scoped-operational-data)
11. [Dashboard routing and UI](#11-dashboard-routing-and-ui)
12. [Attendance and geofence](#12-attendance-and-geofence)
13. [API reference](#13-api-reference)
14. [Porting checklist](#14-porting-checklist)

---

## 1. Overview and mental model

**Three layers:** Platform (future) → Tenant → Org tree → Users

**Two node types:**

| `isLeaf` | Meaning |
|----------|---------|
| `false` | Branch / division — can have children |
| `true` | Operational leaf site — employees are assigned here |

**HRMS mapping (single tenant):**

```
Tenant: Hryantra
└── Yantra HQ (level 1)
    ├── Engineering (division)
    │   └── Pune Office (site)
    └── Finance & Operations (division)
        └── Mumbai Office (site)
```

**Code:** `prisma/schema.prisma` — `Tenant`, `OrgUnit`, `TenantHierarchyLevel`, `TenantApprovalLevel`, `ApprovalRequest`

---

## 2. Tenant and hierarchy levels

On seed, one tenant is created with three hierarchy levels:

| levelOrder | code | displayName | isLeaf |
|------------|------|-------------|--------|
| 1 | hq | Headquarters | false |
| 2 | division | Division | false |
| 3 | site | Site | true |

Approval level names (L1–L3):

| level | displayName |
|-------|-------------|
| 1 | Site Supervisor |
| 2 | Division Manager |
| 3 | HQ Admin |

**Rule:** `maxHierarchyDepth = levels.length`. Each `OrgUnit` stores `levelOrder` and `isLeaf` on the instance.

**Seed:** `prisma/seed.js`

---

## 3. Org unit data model

| Field | Purpose |
|-------|---------|
| `tenantId` | Tenant isolation |
| `parentId` | Tree parent (`null` = HQ root) |
| `levelOrder` | Depth (1=HQ, 2=division, 3=site) |
| `name` | Display name |
| `path` | Materialized path `/{tenantId}/{id}/.../` for subtree queries |
| `isLeaf` | Branch vs operational site |
| `status` | `ACTIVE` or `PENDING_HQ_APPROVAL` |
| `createdByUserId` | Audit — who proposed the node |

**Subtree scope:** all descendants match `path.startsWith(root.path)`.

**Service:** `src/shared/org/org-scope.service.ts` — `getDescendantOrgUnitIds()`

---

## 4. Roles and portals

| HRMS role | Spec equivalent | Bound to | Scope |
|-----------|-----------------|----------|-------|
| `ADMIN` | tenant_admin | HQ | All org units |
| `HR` | tenant_admin | HQ | All org units |
| `MANAGER` | branch_manager | Division | Self + descendants |
| `EMPLOYEE` | employee | Site | Own org unit only |

JWT payload includes `tenantId`, `orgUnitId`, `employeeId`, `permissions`.

**Auth:** `src/modules/auth/auth.service.ts`

---

## 5. Building the org tree (HQ)

HQ (`ADMIN` / `HR`) can create:

1. **Division** under HQ (`isLeaf: false`) — active immediately
2. **Site under division** (`isLeaf: true`) — active immediately
3. **Site directly under HQ** (`isLeaf: true`, parent = HQ) — skip division

**API:** `POST /api/org-units` with `{ parentId, name, isLeaf }`

**UI:** `/org-structure` — `hrms/src/modules/org/pages/OrgStructurePage.tsx`

---

## 6. Building the org tree (division manager)

`MANAGER` bound to a division can only add **leaf sites** under their division.

- New sites → `status: PENDING_HQ_APPROVAL`
- HQ approves via `POST /api/org-units/:id/approve` or rejects via `POST /api/org-units/:id/reject`
- Reject deletes the pending org unit

---

## 7. Org scope middleware

Attached to `req.orgScope` on scoped routes:

| Property | Meaning |
|----------|---------|
| `tenantId` | Current tenant |
| `orgUnitId` | User's bound org node |
| `allowedOrgUnitIds` | Org units user can see (`null` = unrestricted) |
| `scopedEmployeeIds` | Employee record IDs in scope (`null` = unrestricted) |
| `employeeSelfOnly` | Employee sees only self |
| `isHqAdmin` | ADMIN or HR |

**Scope by role:**

- `ADMIN` / `HR` → unrestricted
- `MANAGER` → division + descendants via `path`
- `EMPLOYEE` → own `orgUnitId` only

**Middleware:** `src/shared/middleware/org-scope.ts`

**Filtered APIs:** employees (`GET /api/employees`), leaves (`GET /api/leaves`), org units (`GET /api/org-units`)

---

## 8. User creation and assignment

Each user/employee has `orgUnitId` (and optional `reportsToUserId` on employee).

| Creator | Can assign |
|---------|------------|
| HQ (User Management) | Any org unit |
| Manager | Should assign within division scope (enforced on data APIs) |

**User Management UI:** org unit dropdown on create/edit — `UserManagementPage.tsx`

**Backend:** `user.service.ts` — syncs `orgUnitId` on user and linked employee

---

## 9. Approval system L1 / L2 / L3

| Type | Trigger | Default flow |
|------|---------|--------------|
| `LEAVE` | Leave applied | L1; L1→L2 if days > 3 |
| `ORG_SETTINGS` | Manager proposes new site | L3 (HQ) only |

**Inbox:** `GET /api/approvals/inbox` — enriched with employee + leave/org site details

**Act:** `POST /api/approvals/:id/act` — `{ action: "approve"|"reject", remark? }`

**UI:** Approvals dashboard loads hierarchy inbox and shows L1/L2/L3 badges; approve/reject calls the API.

Multi-level leave: advances `currentLevel` until `maxLevel`, then approves leave record.

**Service:** `src/modules/approvals/approval.service.ts`

---

## 10. Scoped operational data

| Entity | Org link | Scoped by |
|--------|----------|-----------|
| `Employee` | `orgUnitId` | `scopedEmployeeIds` |
| `WorkLocation` | `orgUnitId` (optional) | HQ manages all |
| `Leave` | via employee | `scopedEmployeeIds` |
| `Attendance` | via employee | `scopedEmployeeIds` on history API |
| `Task` | via assignee | `scopedEmployeeIds` on list API |

---

## 11. Dashboard routing and UI

| Role | Org Structure tab | Employees visible |
|------|-------------------|-------------------|
| ADMIN / HR | Full tree + approve pending | All |
| MANAGER | Subtree + propose sites | Division subtree |
| EMPLOYEE | Hidden (unless granted tab) | Self |

**Nav tab:** `orgStructure` — permission `org_manage`

**Files:** `AppShell.tsx`, `shared/permissions.ts`

---

## 12. Attendance and geofence

Employees punch at assigned `WorkLocation` (geofence). `orgUnitId` on location links site to geo center.

Remote punch: permission `attendance_punch_remote_self` skips geofence; GPS still recorded.

---

## 13. API reference

| Area | Endpoints |
|------|-----------|
| Org units | `GET/POST /api/org-units`, `PUT/DELETE /api/org-units/:id`, `POST .../approve`, `POST .../reject` |
| Approvals | `GET /api/approvals/inbox`, `POST /api/approvals/:id/act` |
| Employees | `GET /api/employees` (scoped) |
| Leaves | `GET /api/leaves` (scoped), `POST /api/leaves` (creates approval) |
| Users | `POST/PUT /api/users` (accepts `orgUnitId`) |

---

## 14. Porting checklist

1. Add `Tenant` + `TenantHierarchyLevel` + seed root `OrgUnit`
2. Implement `path`-based subtree scope (`org-scope.service.ts`)
3. Add `orgUnitId` on `User`, `Employee`, `WorkLocation`
4. Mount `orgScopeMiddleware` on list APIs
5. Map roles: ADMIN/HR = HQ, MANAGER = division, EMPLOYEE = site
6. Add approval queue for leave + org site proposals
7. Org Structure UI + User Management org assignment
8. Optional: multi-tenant platform console, master forms, mobile signup

**Default example:** HQ → Division → Site (3 levels). Extend with more `TenantHierarchyLevel` rows and `levelOrder` on nodes.

---

## Key implementation files

| Area | Path |
|------|------|
| Schema | `hrms_backend/prisma/schema.prisma` |
| Scope engine | `hrms_backend/src/shared/org/org-scope.service.ts` |
| Scope middleware | `hrms_backend/src/shared/middleware/org-scope.ts` |
| Org CRUD | `hrms_backend/src/modules/org-units/` |
| Approvals | `hrms_backend/src/modules/approvals/` |
| Seed | `hrms_backend/prisma/seed.js` |
| Org UI | `hrms/src/modules/org/pages/OrgStructurePage.tsx` |
| Permissions | `hrms/src/shared/permissions.ts` |
