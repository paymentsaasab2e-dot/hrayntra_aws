# HRMS testing guide (web only)

This guide covers **hrms** (frontend) and **hrms_backend** only. Payroll and mobile apps are out of scope.

## Prerequisites

1. MongoDB running with `DATABASE_URL` set in `hrms_backend/.env`
2. Backend: `cd hrms_backend && npm install && npx prisma generate && npx prisma db push && node prisma/seed.js`
3. Backend server: `npm run dev` (default port **5000**)
4. Frontend: `cd hrms && npm install && npm run dev` (default port **3000**)
5. Optional: `NEXT_PUBLIC_API_BASE_URL=http://localhost:5000/api` in `hrms/.env.local`

## Default accounts (after seed)

| Role | Email | Password |
|------|-------|----------|
| Superadmin (full access) | `superadmin@hrms.local` | `SuperAdmin@123` |
| HR | `sarah.connor@hryantra.com` | `password123` |
| Manager | `michael.c@hryantra.com` | `password123` |
| Employee | `david.wallace@hryantra.com` | `password123` |

## 1. Superadmin login and full access

1. Open http://localhost:3000
2. Log in with **superadmin@hrms.local** / **SuperAdmin@123**
3. Confirm sidebar shows all modules including **Users**
4. Open **Users** — create/edit/delete user accounts
5. Open Employees, Tasks, Time Off, Approvals — all should work (no “access restricted”)

## 2. Welcome email (Resend)

When you create a user, the backend can email login details. Add to `hrms_backend/.env`:

```env
RESEND_API_KEY=re_your_key_here
RESEND_FROM_EMAIL=HRMS Yantra <onboarding@resend.dev>
HRMS_APP_URL=http://localhost:3000
```

See `hrms_backend/docs/EMAIL_SETUP.md` for full steps. Without the API key, users are still created but no email is sent.

## 3. Create a custom member with limited permissions

1. Stay logged in as superadmin → **Users**
2. Create user, for example:
   - Email: `limited@hrms.local`
   - Password: `Test@12345`
   - Role template: `EMPLOYEE`
   - Uncheck most tabs; keep only **Dashboard**, **Tasks**, **Attendance**
   - Uncheck destructive actions (delete employee, delete task, users_manage)
   - Optionally link to an employee record (e.g. David Wallace)
3. Log out
4. Log in as `limited@hrms.local` / `Test@12345`
5. Confirm sidebar only shows allowed tabs
6. Try opening `/employees` in the browser — you should be redirected to dashboard

## 4. HR and role templates

1. Log in as `sarah.connor@hryantra.com` / `password123`
2. HR should see HR tabs (no **Users** unless you grant `userManagement` / `users_manage`)
3. Test leave apply + approvals, attendance punch, task assignment

## 5. Tasks and approvals

1. As HR or superadmin: **Tasks** → create task with deadline
2. As employee: submit task for approval
3. As HR: **Approvals** → approve/reject
4. Watch for **Approaching** / **Escalated** badges near deadlines

## 6. API sanity (optional)

```bash
# Login
curl -s -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"superadmin@hrms.local\",\"password\":\"SuperAdmin@123\"}"

# Use token from response
curl -s http://localhost:5000/api/users -H "Authorization: Bearer YOUR_TOKEN"
```

## Troubleshooting

- **Unable to reach HRMS backend**: start `hrms_backend` on port 5000
- **Invalid credentials**: re-run seed (`node prisma/seed.js`)
- **401 on API calls**: log out and log in again (JWT stored in `localStorage` as `token`)
- **Empty data after login**: ensure MongoDB is seeded and backend logs show no Prisma errors

## 7. Work locations and geofence punch

1. Log in as superadmin or HR.
2. Open **Locations** in the sidebar.
3. Add a site (name, lat, lng, radius in meters). Click the map to move the pin; green circle = geofence.
4. **Employees** → Add/assign employee → pick **Work location**.
5. Log in as that employee → **Attendance** → **Check In** (office). Browser asks for GPS; backend rejects if outside radius (403).
6. HR punching for another employee skips geofence when `attendance_punch_hr` is allowed.

**Frontend maps:** Leaflet + OpenStreetMap tiles (`LocationMapPreview`). **Mobile** (flutter_map + background auto-punch) is prepared via shared API fields (`workLocationLat`, `radiusMeters`) but not implemented in this repo yet.

After schema changes:
```powershell
cd hrms_backend
npx prisma db push
node prisma/seed.js
cd ..\hrms
npm install
```

## Deferred (not in this phase)

- Mobile apps
- Payroll module
- Multi-tenant platform owner console (single tenant org tree is implemented)
- Master forms / public mobile signup with org cascading
