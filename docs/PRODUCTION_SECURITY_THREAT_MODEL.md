# Production Security — Threat Model & Mitigation Roadmap

> **Status:** Planning document (not yet implemented)  
> **Last updated:** 2026-08-12  
> **Scope:** Phase 2 employers stack — Vercel frontend, EC2 backend + DB, nginx reverse proxy

---

## Current production architecture

```text
Browser (employers / HQ)
    → Vercel (Next.js frontend + /api/proxy/*)
        → nginx on EC2 (TLS, port mapping)
            → Node backend (:5001)
                → MongoDB (same EC2 or Atlas via connection string)
                → S3 (uploads)
                → third-party APIs (OpenAI, Razorpay, Resend, etc.)
```

| Component | Location | Notes |
|-----------|----------|-------|
| Frontend (employers + HQ) | Vercel (`frontphase2`) | Next.js, proxies API via `/api/proxy/[...path]` |
| Backend API | EC2 `:5001` | Express, `backendphase2` |
| Database | EC2 (local Mongo) or Atlas | Multi-tenant: one Mongo DB per tenant |
| Edge / TLS | nginx on EC2 | Only mapped ports exposed publicly |
| Public API host | `api2.hryantra.com` | Default proxy target in frontend |

**Key files referenced in this doc:**

- `backendphase2/src/middleware/auth.middleware.js` — JWT validation
- `backendphase2/src/middleware/tenant-context.middleware.js` — tenant DB scoping
- `backendphase2/src/config/env.js` — JWT expiry defaults, secrets
- `backendphase2/src/modules/hq/hq.routes.js` — HQ routes including open `/setup`
- `backendphase2/src/modules/internal/portal-sync.routes.js` — internal sync secret
- `backendphase2/src/utils/publicUploads.util.js` — public file access
- `frontphase2/src/app/api/proxy/[...path]/route.ts` — Vercel → EC2 proxy
- `frontphase2/src/lib/hqAccess.ts` — HQ UI allowlist (client-side only)

---

## Executive summary

The setup is workable for early production, but the **biggest structural risk** is **single EC2 blast radius** (app + secrets + possibly DB on one host). Combined with **very long-lived JWTs** and an **open HQ bootstrap route**, a moderate compromise could escalate to a **full multi-tenant data breach**.

**Highest ROI fixes:**

1. Network isolation (security groups, DB not public)
2. Secret hygiene (IAM roles, Secrets Manager, rotate keys)
3. JWT hardening (short expiry, reject expired tokens)
4. Disable `/hq/setup` in production
5. Edge rate limiting + WAF in front of nginx

---

## Threat scenarios (ranked by severity)

### 1. EC2 compromise → full data breach

**Risk:** Critical  
**Likelihood:** Medium (misconfigured SG, leaked SSH key, unpatched OS)

If backend and DB live on the same EC2:

| Attacker gets | They can access |
|---------------|-----------------|
| SSH / shell | `.env` with `DATABASE_URL`, JWT secrets, AWS keys, Razorpay, OpenAI |
| Local Mongo | All tenant DBs in one shot |
| Process memory / logs | Tokens, PII, API keys |

**Mitigations:**

- [ ] Move DB to **MongoDB Atlas** (or separate private subnet) with **IP allowlist = EC2 only** (never `0.0.0.0/0`)
- [ ] EC2 security group: **443/80 public**, **22 from VPN/office IP only**, **DB port never public**
- [ ] Use **IAM role on EC2** for S3 instead of long-lived `AWS_ACCESS_KEY_ID` in `.env`
- [ ] Store secrets in **AWS Secrets Manager / SSM Parameter Store**, not plain `.env` on disk
- [ ] Enable **encrypted EBS**, automated snapshots, **offline/immutable backups**
- [ ] Bind Mongo/Redis/backend to `127.0.0.1` only, not `0.0.0.0`

---

### 2. Stolen JWT → long-lived access

**Risk:** Critical  
**Code:** `backendphase2/src/middleware/auth.middleware.js`, `backendphase2/src/config/env.js`

Current behavior:

- JWT access/refresh default expiry: **3650 days (~10 years)** (`JWT_ACCESS_EXPIRES`, `JWT_REFRESH_EXPIRES`)
- Auth middleware accepts **expired tokens** if user still exists and is active (decodes without verification as fallback)

**Threat:** XSS, leaked token in logs, stolen device, malicious extension → attacker keeps access for years.

**Mitigations:**

- [ ] Short access tokens (15–60 min) + refresh token rotation
- [ ] Enforce `jwt.verify()` — **reject expired tokens** (remove unverified decode fallback for auth)
- [ ] Keep `SINGLE_ACTIVE_SESSION_ENABLED=true` in production
- [ ] HttpOnly secure cookies for refresh (instead of localStorage bearer tokens where possible)
- [ ] MFA for HQ / Super Admin accounts

---

### 3. Unauthenticated HQ bootstrap endpoint

**Risk:** Critical  
**Code:** `backendphase2/src/modules/hq/hq.routes.js`

```js
router.post('/setup', hqController.setupSuperAdmin);  // No authMiddleware
```

**Threat:** Anyone who can hit `POST /api/v1/hq/setup` can create/overwrite a Super Admin if still enabled in prod.

**Mitigations:**

- [ ] **Disable or remove in production** (env-gated one-time bootstrap, or delete route after first deploy)
- [ ] Block at nginx: `location ~* /hq/setup { deny all; }`
- [ ] Verify route returns 404/deny on production smoke test

---

### 4. Vercel proxy is not a security layer

**Risk:** High  
**Code:** `frontphase2/src/app/api/proxy/[...path]/route.ts`

The proxy forwards client headers/body straight to EC2. It does not add mTLS or a shared internal secret.

**Threats:**

- If `api2.hryantra.com` is reachable directly, attackers bypass Vercel (CORS is not server-side auth)
- No global rate limiting at the edge → brute force login, scraping, DoS
- Authorization headers pass through unchanged

**Mitigations:**

- [ ] nginx: allow backend only from **Vercel IP ranges** + admin IPs, OR require `X-Internal-Proxy-Secret` checked in nginx
- [ ] Evaluate **direct browser → api2.hryantra.com** with strict CORS (drop proxy for most routes — simpler, fewer hops)
- [ ] Add **Cloudflare / AWS WAF** in front of nginx: rate limits, bot protection
- [ ] Document Vercel egress IP ranges and rotate nginx allowlist when Vercel changes them

---

### 5. Multi-tenant isolation

**Risk:** High  
**Code:** `backendphase2/src/middleware/tenant-context.middleware.js`

Tenant DB selection order:

```js
tokenTenantDbName || headerTenantDbName || queryTenantDbName || bodyTenantDbName
```

**Good:** Normal logins embed `tenantDbName` in JWT — header spoofing blocked when token has tenant.

**Remaining risks:**

- Code paths without `tenantDbName` in token could fall back to `x-tenant-db-name` header
- Public routes (job apply, lead forms, public uploads) accept `tenantDbName` in query — required functionally, must validate carefully
- Public file access tries multiple S3 key paths (`default`, hardcoded tenant names) when resolving uploads — filename guessing risk

**Mitigations:**

- [ ] **Authenticated routes:** use JWT `tenantDbName` only — ignore header/query overrides
- [ ] Public uploads: **signed URLs with expiry** instead of guessable paths
- [ ] Per-tenant encryption keys for highly sensitive docs (offer letters, KYC)
- [ ] Audit all public endpoints that accept `tenantDbName` in query/body

---

### 6. HQ console = root-level access

**Risk:** High  
**Code:** `backendphase2/src/modules/hq/hq.service.js` (`assertPlatformProvisioner`), `frontphase2/src/lib/hqAccess.ts`

Backend gates HQ with Super Admin + `HRAYNTRA_PLATFORM_PROVISION_EMAILS`. Frontend allowlist is **UI only — not security**.

**Threats:**

- Compromised HQ Super Admin → provision tenants, read all behavior analytics, CRM, billing
- Default allowlist in code includes `admin@gmail.com` — must override via env in prod

**Mitigations:**

- [ ] Separate HQ domain + IP allowlist (VPN/office only)
- [ ] MFA mandatory for HQ
- [ ] Audit log every HQ action (plan changes, tenant pause, data export)
- [ ] Shorter HQ session TTL than employer app
- [ ] Set `HRAYNTRA_PLATFORM_PROVISION_EMAILS` and `NEXT_PUBLIC_HQ_ALLOWED_EMAILS` to real operator emails only

---

### 7. Internal portal-sync secret

**Risk:** Medium–High  
**Code:** `backendphase2/src/modules/internal/portal-sync.routes.js`

Uses shared header `x-phase2-portal-sync-secret`. Production requires env secret; dev has hardcoded fallback.

**Mitigations:**

- [ ] Strong random secret in prod (never use dev fallback)
- [ ] Restrict `/api/v1/internal/*` to **private network / backend-to-backend only** at nginx
- [ ] Rotate secret periodically
- [ ] Log and alert on failed sync auth attempts

---

### 8. Data in transit

**Risk:** Medium (if misconfigured)

**Current:** Browser → Vercel (HTTPS) → EC2 nginx (HTTPS) — OK if TLS configured correctly.

**Watch for:**

- Mixed HTTP internal hops
- Mongo not using TLS (Atlas `mongodb+srv` is fine; local Mongo must enable TLS)
- Secrets in query strings or request logs

**Mitigations:**

- [ ] HSTS on nginx
- [ ] TLS 1.2+ only, modern ciphers
- [ ] Redact `Authorization` headers in access logs
- [ ] Verify `TRUST_PROXY=true` only when nginx strips/spoof-proofs `X-Forwarded-For`

---

### 9. No meaningful rate limiting

**Risk:** Medium  
**Code:** `backendphase2/src/middleware/rateLimit.middleware.js`

Rate limit is **in-memory** and only applied to LinkedIn routes. Single EC2 = easy login/API abuse.

**Mitigations:**

- [ ] nginx `limit_req` on `/auth/login`, `/auth/register`, public apply endpoints
- [ ] Redis-backed rate limiting in app (`.env` supports optional `REDIS_URL`)
- [ ] Fail2ban or WAF for repeated 401/403/429 patterns

---

## Data breach impact map

| Asset | Sensitivity | If breached |
|-------|-------------|-------------|
| Mongo tenant DBs | Critical | All candidates, clients, jobs, interviews, billing |
| HQ analytics / behavior | High | Cross-tenant usage patterns, employer activity |
| S3 uploads | High | CVs, offer letters, client-review PDFs |
| JWT + refresh secrets | Critical | Forge sessions for any user |
| AWS keys | Critical | Read/delete all uploads, possibly EC2 control |
| Razorpay / payment refs | High | Billing fraud, customer PII |
| OpenAI / email keys | Medium | Cost abuse, phishing via your domain |

---

## Implementation roadmap

### Phase A — This week (low effort, high impact)

- [ ] Lock down EC2 security groups (443 public, 22 restricted, DB closed)
- [ ] Remove/block `/hq/setup` in production
- [ ] Shorten JWT lifetime; stop accepting expired tokens
- [ ] Rotate all secrets if `.env` was ever committed or shared
- [ ] nginx: rate limit auth + public endpoints; deny direct access to internal routes
- [ ] Verify Mongo Atlas network access is not open to the world
- [ ] Enable MongoDB backup + test restore (monthly drill)

### Phase B — Next 1–2 months

- [ ] Split DB off EC2 (Atlas dedicated cluster, private endpoint if possible)
- [ ] IAM role for S3 on EC2 (drop static AWS keys)
- [ ] WAF / Cloudflare in front of `api2.hryantra.com`
- [ ] Centralized logging (CloudWatch/Datadog) + alerts on auth spikes, 5xx, HQ actions
- [ ] Signed URLs for resumes and offer letters
- [ ] Redis for sessions + rate limits (supports future multi-instance backend)

### Phase C — When scaling

- [ ] Separate EC2 (or ECS) for app vs managed DB
- [ ] Private VPC: backend in private subnet, only nginx in public subnet
- [ ] Secrets Manager + automatic rotation
- [ ] Per-tenant backup/export controls and GDPR-style deletion workflows
- [ ] External pen test before enterprise customers

---

## nginx checklist (edge hardening)

```nginx
# Rate limit auth endpoints
limit_req_zone $binary_remote_addr zone=auth:10m rate=5r/m;

location /api/v1/auth/login {
  limit_req zone=auth burst=10 nodelay;
  proxy_pass http://127.0.0.1:5001;
}

# Block bootstrap and internal routes from public internet
location ~* /api/v1/(hq/setup|internal/) {
  deny all;
}

# Trust client IP only from known proxies (Vercel / Cloudflare CIDRs)
set_real_ip_from  <trusted-proxy-cidr>;
real_ip_header    X-Forwarded-For;
```

Additional nginx tasks:

- [ ] TLS cert auto-renewal (Let's Encrypt / ACM)
- [ ] `client_max_body_size` aligned with `JSON_BODY_LIMIT` (default 15mb)
- [ ] Security headers: `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`
- [ ] Disable server tokens (`server_tokens off`)

---

## Environment variables to review

| Variable | Purpose | Security note |
|----------|---------|---------------|
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | Token signing | Must be long random; rotate if leaked |
| `JWT_ACCESS_EXPIRES` | Token TTL | Default `3650d` — shorten for prod |
| `DATABASE_URL` / `HEADQUARTERS_DATABASE_URL` | Mongo connection | Never log; restrict network access |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | S3 uploads | Prefer IAM role on EC2 |
| `PHASE2_PORTAL_SYNC_SECRET` | Internal sync | Required in prod; rotate periodically |
| `HRAYNTRA_PLATFORM_PROVISION_EMAILS` | HQ operator allowlist | Override default `admin@gmail.com` |
| `FRONTEND_URLS` | CORS allowlist | Keep minimal; no wildcards |
| `SINGLE_ACTIVE_SESSION_ENABLED` | One login per user | Keep enabled in prod |
| `REDIS_URL` | Sessions / rate limits | Enable when moving off single EC2 |

---

## CORS & public routes (awareness)

**CORS** (`backendphase2/src/app.js`):

- Allows requests **without Origin header** (server-to-server / curl) — normal for API clients, not a substitute for auth
- Allowed origins from `FRONTEND_URLS` env

**Public routes that bypass JWT** (by design — review regularly):

- `/public/review/*` — client review links
- `/jobs/public/apply/*` — job applications
- `/leads/public/form/*` — lead capture forms
- `/api/v1/public/uploads/*` — offer letters, client-review PDFs
- `POST /hq/setup` — **should not be public in prod**

---

## Testing checklist (after implementing fixes)

- [ ] `POST /api/v1/hq/setup` returns 403/404 from public internet
- [ ] Expired JWT returns 401 (not 200)
- [ ] Cannot access tenant B data with tenant A token (even with `x-tenant-db-name` header)
- [ ] MongoDB not reachable from outside EC2/Atlas allowlist
- [ ] Rate limit triggers on repeated failed logins
- [ ] Internal sync endpoints reject wrong/missing secret
- [ ] Backup restore drill completed successfully

---

## Related docs

- `HOSTING_ANALYSIS.md` — hosting architecture notes
- `PHASE2_ARCHITECTURE_ANALYSIS.md` — Phase 2 system design
- `phase2_complete_audit.md` — broader Phase 2 audit
- `backendphase2/ROUTES_MAP.md` — full API route listing

---

## Notes / open questions

- Confirm whether production Mongo is **local on EC2** or **Atlas** — changes Phase A vs Phase B priority
- Document actual nginx config location on EC2 (not in repo)
- Decide: keep Vercel proxy vs direct `api2.hryantra.com` calls from browser
- HQ `/hq/setup` — was bootstrap already run? Safe to disable permanently?
