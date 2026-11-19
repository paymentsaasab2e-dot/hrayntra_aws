# Policy Center & Exit Workflow — Testing Guide

Base URL: `http://localhost:5000/api`  
Frontend: `http://localhost:3000`

## Test credentials

| Role | Email | Password |
|------|-------|----------|
| Tenant admin / HR | `superadmin@hrms.local` or `sarah.connor@hryantra.com` | `SuperAdmin@123` / `password123` |
| Manager (Engineering) | `michael.c@hryantra.com` | `password123` |
| Employee (Pune) | `priya.sharma@hryantra.com` | `password123` |

---

## Plan 1: Policy Center (compliance / leave & attendance rules)

### UI flows

1. **View active policy** — Login as HR → **Policy Center** (`/policies`) or **Settings → Leave Policies**
2. **Upload document** — Policy Center → upload PDF → review extracted text → edit rules → **Publish**
3. **Enforcement** — Login as Priya → apply leave starting tomorrow → should fail (3-day advance notice required)

### API endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/policies/active` | Any logged-in user | Active leave/attendance/exit rules |
| `PATCH` | `/policies/active` | ADMIN, HR | Update active rules JSON |
| `GET` | `/policies` | ADMIN, HR | List policy documents |
| `GET` | `/policies/:id` | ADMIN, HR | Document + draft rules + extracted text |
| `POST` | `/policies/upload` | ADMIN, HR | Multipart: `title`, `file` |
| `POST` | `/policies` | ADMIN, HR | Create manual draft `{ "title": "..." }` |
| `PATCH` | `/policies/:id/rules` | ADMIN, HR | Save draft `{ "rules": { leave, attendance, exit } }` |
| `POST` | `/policies/:id/publish` | ADMIN, HR | Publish version → becomes active |
| `POST` | `/policies/versions/:versionId/acknowledge` | Any user | Acknowledge policy |

### Example: get active policy

```bash
# Login first, then:
curl -H "Authorization: Bearer $TOKEN" http://localhost:5000/api/policies/active
```

### Example: publish manual policy

```bash
curl -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"title":"Leave Policy 2026"}' http://localhost:5000/api/policies

# PATCH rules on returned id, then:
curl -X POST -H "Authorization: Bearer $TOKEN" \
  http://localhost:5000/api/policies/{id}/publish
```

### Leave enforcement (after policy published)

- `leaveAdvanceNoticeDays` — blocks apply if start date too soon
- `maxConsecutiveLeaveDays` — blocks long single requests
- `annualCasualLeave + annualSickLeave + annualEarnedLeave` — total balance cap

Test leave apply:

```bash
curl -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"employeeId":"EMP-004","type":"CASUAL","startDate":"2026-06-10","endDate":"2026-06-10","reason":"Test"}' \
  http://localhost:5000/api/leaves
```

---

## Plan 2: Resignation & notice period

### UI flows

1. **Submit** — Priya → **My Exit** (`/my-exit`) → reason + requested LWD → Submit
2. **Manager L1** — Michael → **Approvals** → Exit card → Approve
3. **HR L2** — Sarah → **Approvals** → Exit card → set confirmed LWD → Approve
4. **Checklist** — Sarah → **Separations** (`/separations`) → mark checklist items
5. **Complete** — After LWD date → **Complete exit** → employee `TERMINATED`, login disabled

### API endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/separation/policy` | Any user | Notice period policy (from active tenant rules) |
| `GET` | `/separation/mine` | Any user | Own separation status + checklist |
| `POST` | `/separation` | Any user | Submit `{ "reason", "requestedLWD", "submit": true }` |
| `POST` | `/separation/:id/withdraw` | Employee | Withdraw if still SUBMITTED |
| `GET` | `/separation` | ADMIN, HR, MANAGER | List separations (org-scoped) |
| `GET` | `/separation/:id` | ADMIN, HR, MANAGER | Detail |
| `PATCH` | `/separation/:id/checklist` | ADMIN, HR, MANAGER | `{ "items": [{ "label", "done" }] }` |
| `POST` | `/separation/:id/complete` | ADMIN, HR | Finalize after LWD |

### Approval endpoints (EXIT uses existing inbox)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/approvals/inbox` | Shows EXIT requests for manager (L1) and HR (L2) |
| `POST` | `/approvals/:id/act` | `{ "action": "approve", "remark": "...", "approvedLWD": "2026-07-08" }` |

**L1:** Manager approves → moves to HR  
**L2:** HR approves with `approvedLWD` → status `IN_NOTICE`

### Example: submit resignation

```bash
curl -X POST -H "Authorization: Bearer $PRIYA_TOKEN" -H "Content-Type: application/json" \
  -d '{"reason":"Pursuing new opportunity","requestedLWD":"2026-07-15","submit":true}' \
  http://localhost:5000/api/separation
```

### Example: HR approve with LWD

```bash
curl -X POST -H "Authorization: Bearer $HR_TOKEN" -H "Content-Type: application/json" \
  -d '{"action":"approve","remark":"Accepted","approvedLWD":"2026-07-15"}' \
  http://localhost:5000/api/approvals/{approvalRequestId}/act
```

---

## Re-seed (optional)

After schema changes, run:

```bash
cd hrms_backend
npx prisma db push
node prisma/seed.js
```

Seed includes published **Hryantra Leave & Attendance Policy v1** with 3-day leave advance notice and 30-day employment notice.

---

## Quick end-to-end checklist

- [ ] `GET /policies/active` returns rules for Hryantra tenant
- [ ] Upload + publish new policy from `/policies`
- [ ] Leave apply blocked when notice < 3 days
- [ ] Employee submits resignation on `/my-exit`
- [ ] Manager sees Exit in `/approvals` inbox
- [ ] HR approves with LWD
- [ ] HR manages checklist on `/separations`
- [ ] Complete exit sets employee TERMINATED
