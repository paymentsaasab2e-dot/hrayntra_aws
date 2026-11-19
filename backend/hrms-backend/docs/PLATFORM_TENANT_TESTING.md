# Platform HQ → Tenant → Org Structure — Testing Guide

Strict flow per hierarchy plan: **Platform Owner** creates **Tenants (clients)** → **Tenant Admin** builds **org structure** → **Branch managers** delegate within their division.

---

## Base URLs

| Layer | URL |
|-------|-----|
| Frontend | http://localhost:3000 |
| Backend API | http://localhost:5000/api |
| Health | http://localhost:5000/health |

Reseed:

```powershell
cd d:\phase_3\hrms_backend
npx prisma generate
npx prisma db push
node prisma/seed.js
```

---

## Role map (plan → HRMS)

| Plan role | HRMS role | Login | Tenant | Page |
|-----------|-----------|-------|--------|------|
| Platform owner | `PLATFORM_OWNER` | `platform.owner@hrms.local` / `PlatformOwner@123` | None | http://localhost:3000/superadmin/tenants |
| Tenant admin (HQ) | `ADMIN` | `superadmin@hrms.local` / `SuperAdmin@123` | Hryantra | http://localhost:3000/org-structure |
| Branch manager | `MANAGER` | `michael.c@hryantra.com` / `password123` | Hryantra | Engineering division |
| Site employee | `EMPLOYEE` | `priya.sharma@hryantra.com` / `password123` | Hryantra | Pune site |

---

## Flow diagram

```
Platform Owner
  POST /api/platform/tenants
       ↓
Tenant + HQ root + hierarchy levels + L1/L2/L3
  Tenant Admin → /org-structure → POST /api/org-units
       ↓
Branch Manager → POST /api/org-units (sites pending HQ)
       ↓
Tenant Admin → /approvals → POST /api/approvals/:id/act
```

---

## NEW — Platform API endpoints

| Method | Endpoint | Who | Purpose |
|--------|----------|-----|---------|
| `POST` | `/api/auth/login` | All | Get JWT |
| `GET` | `/api/platform/tenants` | Platform owner | List clients |
| `GET` | `/api/platform/tenants/:id` | Platform owner | Tenant detail |
| `POST` | `/api/platform/tenants` | Platform owner | Create client tenant |

### POST /api/platform/tenants body

```json
{
  "name": "Acme Corporation",
  "slug": "acme",
  "rootOrgName": "Acme HQ",
  "levels": [
    { "levelOrder": 1, "code": "hq", "displayName": "Headquarters", "isLeaf": false },
    { "levelOrder": 2, "code": "division", "displayName": "Division", "isLeaf": false },
    { "levelOrder": 3, "code": "site", "displayName": "Site", "isLeaf": true }
  ],
  "tenantAdmin": {
    "email": "admin@acme.com",
    "password": "AcmeAdmin@123",
    "displayName": "Acme Admin"
  }
}
```

---

## Tenant org + approvals endpoints

| Method | Endpoint | Who |
|--------|----------|-----|
| `GET` | `/api/org-units` | Tenant users (scoped) |
| `POST` | `/api/org-units` | ADMIN/HR/MANAGER |
| `GET` | `/api/approvals/inbox` | ADMIN/HR/MANAGER |
| `POST` | `/api/approvals/:id/act` | ADMIN/HR/MANAGER |

---

## UI test steps

### 1. Platform owner — create client

1. http://localhost:3000 → `platform.owner@hrms.local` / `PlatformOwner@123`
2. http://localhost:3000/platform → create Acme tenant + admin
3. API: `POST /api/platform/tenants`

### 2. Tenant admin — org structure

1. Logout → `admin@acme.com` / `AcmeAdmin@123`
2. http://localhost:3000/org-structure → add division + site
3. API: `POST /api/org-units`

### 3. Branch delegation

1. Create MANAGER on division at http://localhost:3000/users
2. Manager adds leaf site → tenant admin approves at http://localhost:3000/approvals

### 4. Hryantra seed (existing client)

- Tenant admin: `superadmin@hrms.local` / `SuperAdmin@123`
- Manager leave test: `priya.sharma@hryantra.com` applies leave → `michael.c@hryantra.com` approves

---

## curl

```bash
# Platform login
curl -s -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"platform.owner@hrms.local","password":"PlatformOwner@123"}'

# List tenants
curl -s http://localhost:5000/api/platform/tenants -H "Authorization: Bearer TOKEN"

# Create tenant
curl -s -X POST http://localhost:5000/api/platform/tenants \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Beta Corp","slug":"beta","tenantAdmin":{"email":"admin@beta.com","password":"BetaAdmin@123"}}'
```
