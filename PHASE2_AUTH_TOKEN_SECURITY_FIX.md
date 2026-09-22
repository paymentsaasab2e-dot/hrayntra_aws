# Phase 2 Auth Security Fix — Report

**Product:** HRYantra / SAASA Phase 2 (CRM)  
**Scope:** `backendphase2` + `frontphase2`  
**Date:** 2026-09-22  
**Status:** Implemented (full fix)

---

## 1. The issue

**Finding:** Phase 2 CRM login tokens effectively never expired in a meaningful way.

### What was wrong

| Problem | Detail |
|--------|--------|
| **Very long defaults** | If env vars were missing, access + refresh JWTs defaulted to **`3650d` (~10 years)** in `env.js`. |
| **Expired tokens still worked** | `auth.middleware.js` used `jwt.decode` when `jwt.verify` failed, so **expired** tokens were still accepted if the user existed and was active. |
| **Forgery risk** | `jwt.decode` does **not** check the signature. A crafted payload with a real `userId` could be treated as logged-in after verify failed. |
| **Session gap** | With single-session on, tokens **without** `sessionId` skipped session checks, so old long-lived tokens could keep working. |

**Impact:** Anyone who stole a token (browser storage, logs, shared laptop) could stay in the CRM for a long time — even after the JWT `exp` claim.

---

## 2. Goal of the fix

- Stolen / expired / invalid access tokens must **fail**.
- Users stay signed in via **short access + refresh rotation**.
- Logout / refresh reuse must **kill sessions**.

---

## 3. What we changed

### Backend (`backendphase2`)

| File | Change |
|------|--------|
| `src/middleware/auth.middleware.js` | Removed decode bypass. Only verified, unexpired JWTs pass. Require active `sessionId` when single-session is on (except HQ impersonation). Clear error codes (`TOKEN_EXPIRED`, `TOKEN_INVALID`, `SESSION_REQUIRED`, …). |
| `src/utils/jwt.js` | Added `verifyAccessTokenDetailed` (signature + expiry). Safe defaults: access **30m**, refresh **7d**. Fail if secrets missing. |
| `src/config/env.js` | Defaults changed from **`3650d` → `30m` / `7d`**. |
| `src/modules/session/session.service.js` | Hardened refresh: inactive user rejected; **refresh reuse** → revoke all sessions (`REFRESH_REUSED`); rotation kept. |
| `.env` | Documented short TTLs (`JWT_ACCESS_EXPIRES=30m`, `JWT_REFRESH_EXPIRES=7d`). |

### Frontend (`frontphase2`)

| File | Change |
|------|--------|
| `src/lib/api.ts` | Single-flight refresh (avoids parallel refresh races). On 401: refresh → retry. Same for **form uploads**. Clear session on `SESSION_REQUIRED` / `REFRESH_REUSED` / `TOKEN_INVALID`. |

---

## 4. How we solved it

```text
Before:
  Login → JWT up to ~10 years
  Expired JWT → still accepted via jwt.decode + “user is active”
  Stolen token → long-lived access to CRM

After:
  Login → access 30m + refresh 7d (+ sessionId when single-session on)
  API call → must verify signature + exp
  Access expired → FE calls /auth/refresh → new access (+ rotated refresh)
  Old refresh reused → all sessions revoked → must log in again
  Logout / password reset → refresh cleared, sessions revoked
```

### New token behavior

| Event | Result |
|--------|--------|
| Access expires (~30 min) | Silent refresh; user stays in CRM |
| Refresh expires (~7 days) or logout | Must sign in again |
| Stolen access token | Useless after ≤ ~30 min |
| Stolen / replayed old refresh | All sessions revoked |
| Expired / forged access JWT | **401** — no decode bypass |

---

## 5. Ops checklist

1. Restart **backendphase2** after deploy.
2. Users should **log out and log in once** (old long/session-less tokens won’t work).
3. Production must set (do not leave blank — blanks used to become 10 years):

```env
JWT_ACCESS_EXPIRES=30m
JWT_REFRESH_EXPIRES=7d
JWT_ACCESS_SECRET=<strong secret>
JWT_REFRESH_SECRET=<strong secret>
```

---

## 6. Bottom line

| | |
|--|--|
| **Issue** | Tokens lasted ~10 years by default, and auth accepted expired/invalid JWTs. |
| **Risk** | Stolen tokens = long CRM access. |
| **Fix** | Short TTLs + strict verify + refresh rotation + session enforcement + FE auto-refresh. |

This is the **full fix** for the Phase 2 “login tokens never really expire” finding.

---

# Phase 2 HQ Setup Bootstrap Lockdown

**Finding:** `POST /api/v1/hq/setup` was unauthenticated (“intended for bootstrap”). In production, anyone could create or overwrite a Super Admin.

## Issue

| Risk | Detail |
|------|--------|
| Open route | No auth on `POST /api/v1/hq/setup` |
| Upsert overwrite | Existing user by email could be promoted to Super Admin / password replaced |
| Production exposure | If reachable on the public API, attacker gets HQ Super Admin |

## Fix (implemented)

| Change | Detail |
|--------|--------|
| Secret required | Header `x-hq-setup-secret` must match `HQ_SETUP_SECRET` (≥16 chars) |
| Production gate | Disabled unless `HQ_SETUP_ENABLED=true` |
| Fail closed | Empty/missing secret → route returns 403 |
| Rate limit | Max 5 attempts / hour / IP |
| No overwrite | If any active Super Admin exists → 403 `HQ_SETUP_ALREADY_INITIALIZED` |
| Create-only | Email already exists → 409; no upsert |

### Files

- `backendphase2/src/middleware/hqSetup.middleware.js` (new)
- `backendphase2/src/modules/hq/hq.routes.js`
- `backendphase2/src/modules/hq/hq.service.js`
- `backendphase2/src/modules/hq/hq.controller.js`
- `backendphase2/src/config/env.js`
- `backendphase2/.env` (placeholders)

### Ops

```env
# Only while bootstrapping the first Super Admin:
HQ_SETUP_SECRET=<long random secret ≥16 chars>
HQ_SETUP_ENABLED=true   # production only when intentionally bootstrapping

# After first Super Admin exists — turn off:
HQ_SETUP_ENABLED=false
# Optionally clear HQ_SETUP_SECRET
```

```http
POST /api/v1/hq/setup
x-hq-setup-secret: <HQ_SETUP_SECRET>
Content-Type: application/json

{ "name": "...", "email": "...", "userId": "...", "password": "..." }
```

---

# Secrets-in-Git cleanup (2026-09-22)

**Finding:** Real passwords and cloud secrets were committed in docs / examples.

## What was wrong

| File | Leak |
|------|------|
| `backendphase2/USER_CREDENTIALS.md` | Real emails, login IDs, passwords, user IDs |
| `README.md` / `SETUP_INSTRUCTIONS.md` / `QUICK_START.md` (+ `backend1` copies) | Mongo URI with password, Cloudinary secret, JWT secrets, Resend API key |
| `frontphase2/.env.example` / `backendphase2/.env.example` | Personal Razorpay UPI id |
| OTP / Resend setup docs | Personal inbox email + Resend key |

## What we did (working tree)

| Action | Detail |
|--------|--------|
| Scrub docs | Replaced live secrets with placeholders (`<DB_PASSWORD>`, `<generate_strong_secret>`, etc.) |
| `USER_CREDENTIALS.md` | Rewrote as role reference **without passwords**; use `USER_CREDENTIALS.local.md` for private notes |
| `.gitignore` | Ignore `.env.*` (keep `.env.example`), `*CREDENTIALS.local.md`, `secrets/` |
| JWT rotate (local) | New `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` in `backendphase2/.env` (gitignored). **Restart backend**; all users must re-login |
| UPI scrub | Removed personal UPI from examples and local `.env` comment/value |

## You still must rotate in dashboards (cannot do from repo alone)

Git history may still contain old values until history is rewritten. **Treat leaked values as compromised:**

1. **MongoDB Atlas** — rotate the DB user password that was in the old docs; update all local/server `.env` `DATABASE_URL*` strings.
2. **Cloudinary** — rotate API secret; update `.env`.
3. **Resend** — revoke any API key that appeared in docs; create a new key.
4. **Seeded CRM users** — force password reset for every account that was listed in the old `USER_CREDENTIALS.md` (Super Admin → Viewer).
5. **Razorpay** — confirm settlement UPI in dashboard only; do not re-commit UPI ids.
6. Optional: purge secrets from git history (`git filter-repo` / BFG) after rotation, then force-push with team coordination.

## Rule going forward

- Real secrets → `.env` / secret manager only.
- Docs / `.env.example` → placeholders only.
- Never commit `USER_CREDENTIALS*.md` with passwords.
