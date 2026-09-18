# Data Protection — Phase 1 & Phase 2

**Product:** HRYantra  
**Last updated:** 2026-09-17  
**Owner:** Engineering / Security  

This document describes how personal and business data is collected, stored, accessed, and protected across the **candidate portal (Phase 1)** and **employer CRM (Phase 2)**.

---

## 1. Scope & roles

| Role | Systems | Typical data |
|------|---------|--------------|
| **Candidate (data subject)** | Phase 1 portal | Profile, CV, applications, LMS activity |
| **Recruiter / employer user** | Phase 2 CRM | Candidates, clients, interviews, billing |
| **Client reviewer** | Public client-review links | Shared presentation + selected CV only |
| **HQ / super admin** | HQ modules | Tenant provisioning, cross-tenant ops |

Legal bases (to be confirmed with counsel for each market): contract performance, legitimate interest (recruitment matching), consent where required (marketing, optional processing).

---

## 2. Data classification

| Class | Examples | Handling |
|-------|----------|----------|
| **C0 — Public** | Marketing pages, public job blurbs | CDN / public web |
| **C1 — Internal** | Job pipeline stage names, non-PII config | Authenticated users |
| **C2 — Confidential PII** | Name, email, phone, LinkedIn, work history, resume text | Encrypted in transit; access-controlled; tenant-scoped in Phase 2 |
| **C3 — Sensitive** | Offer letters, KYC-like docs, vaccination/visa fields, interview feedback | Least privilege; proxy downloads; short-lived share tokens |
| **C4 — Secrets** | JWT secrets, AWS keys, sync secrets, payment keys | Env / secrets manager; never in client bundles |

---

## 3. Data stores

### 3.1 Phase 1 (Portal)

| Store | Contents |
|-------|----------|
| Portal MongoDB (`DATABASE_URL`) | Candidates, profile sections, jobs, applications, sessions, OTP, LMS |
| `candidatecommon` Mongo | Denormalized candidate snapshots for CRM reuse (`profileSnapshot`) |
| AWS S3 (`uploads/phase1/...`) | Resumes, photos, LMS assignment files |
| Local `/uploads` (legacy) | Fallback static serving — prefer S3 in production |

### 3.2 Phase 2 (CRM)

| Store | Contents |
|-------|----------|
| **One Mongo DB per tenant** | Candidates, clients, jobs, matches, interviews, billing, placements, RBAC |
| Headquarters Mongo | Tenant registry, HQ users / ops |
| `candidatecommon` | Read/upsert bridge from Phase 1 |
| Job portal Mongo (read paths) | Cross-system job / application sync |
| AWS S3 (`uploads/phase2/...`) | Candidate docs, offer letters, entity files |
| Redis (optional) | Caching / realtime support |

### 3.3 Transit

- TLS terminated at nginx / Vercel edge.  
- Browser → API: HTTPS.  
- FE Vercel proxy → EC2 API: HTTPS to `api1` / `api2`.  
- Client-review resume/files streamed via API so clients do not need raw S3 credentials.

---

## 4. Personal data inventory (summary)

| Category | Phase 1 | Phase 2 |
|----------|---------|---------|
| Identity | Name, email, phone, photo | Same + recruiter-owned candidate records |
| Professional | CV, work, education, skills | Presentation sections, match scores, notes |
| Preferences | Salary, locations, job types | Career preferences shared to client when enabled |
| Special (handle carefully) | Visa / vaccination profile fields | Same if mirrored into client presentation |
| Auth | Password hash, OTP, sessions | Password hash, JWT sessions, role permissions |
| Financial | — | Billing / Razorpay references |
| Behaviour analytics | — | `TenantBehaviorSnapshot` (product usage JSON) |

---

## 5. Access control

### Phase 1

- JWT (`Authorization: Bearer` / `x-auth-token`) bound to Mongo session where enabled.  
- Candidate can only access own profile resources via `protect` middleware.  
- System admin / HQ routes gated separately.  
- Inter-service: `PHASE2_PORTAL_SYNC_SECRET` required for portal ↔ CRM sync in production.

### Phase 2

- JWT with `userId`, `orgId` / `tenantDbName`, optional `sessionId`.  
- RBAC via `SystemRole` permissions (`requireAnyPermission`).  
- Prisma queries execute only inside **tenant AsyncLocalStorage context**.  
- Client review: no recruiter JWT; time-limited review token; field visibility / tracker options limit what clients see.  
- Resume download gated by tracker `downloadResume` and share mode (`original` / `edited` / `saasa`).

### File access

| Path | Control |
|------|---------|
| Authenticated entity files | Logged-in user + tenant context |
| PDF / resume proxy | Allowlisted S3 / known storage hosts |
| Client-review `/resume` & `/files/:id` | Valid review token + match scope |
| Direct S3 URLs | Masked in client-review payloads where possible |

---

## 6. Encryption & secrets

| Control | Current state | Target / recommendation |
|---------|---------------|-------------------------|
| TLS in transit | Yes (nginx / Vercel) | Maintain TLS 1.2+ |
| Encryption at rest (Mongo) | Atlas / volume encryption if configured | Confirm Atlas encryption + EBS encryption on EC2 |
| Encryption at rest (S3) | SSE-S3 / SSE-KMS (configure on bucket) | Prefer SSE-KMS for C3 objects |
| Passwords | bcrypt | Keep; no reversible storage |
| JWT signing | `JWT_SECRET` env | Rotate; short-lived access tokens (see threat model) |
| Cloud credentials | Env on EC2 | IAM instance role + Secrets Manager |
| Application secrets | `.env` | No secrets in git; rotate sync secret |

---

## 7. Retention & deletion

| Data | Suggested policy (confirm legally) |
|------|-------------------------------------|
| Candidate account | Retain while account active; delete/anonymize on verified request |
| Applications | Retain for recruitment audit window (e.g. 12–24 months) then archive |
| Client-review tokens | Expire ~14 days; invalidate on regenerate |
| Sessions | Expire / logout-all; purge inactive |
| OTP codes | Short TTL; single use |
| S3 objects | Delete with candidate/file records; lifecycle rules for orphans |
| Backups | Encrypted backups; retention separate from live delete (document lag) |
| Billing records | Retain per tax / accounting law |

**GDPR-style rights (process):** access, rectification, erasure, restriction, portability, objection — fulfilled via support + admin tooling; automate where feasible.

---

## 8. Third-party processors

| Processor | Purpose | Data shared |
|-----------|---------|-------------|
| AWS S3 | Object storage | Resumes, documents |
| MongoDB Atlas (if used) | Primary databases | Full app data |
| Vercel | Frontend hosting | Request metadata; no DB |
| Resend / email | OTP, notifications | Email, name, message content |
| OpenAI / other AI | Parsing, matching, assistants | CV / job text (minimize; no secrets) |
| Razorpay | Payments (Phase 2) | Billing identifiers |
| Job boards (Adzuna / Careerjet) | Feed ingest | Public job metadata |

Execute DPAs with processors; region pin where required (e.g. EU data residency).

---

## 9. Logging & monitoring

- Prefer structured API logs without raw CV bodies or full tokens.  
- Do not log Authorization headers or OTP codes.  
- Tenant DB write markers include tenant id / actor for audit (ops visibility).  
- Security incidents: follow `PRODUCTION_SECURITY_THREAT_MODEL.md` escalation.

---

## 10. Cross-phase data movement

```text
Phase 1 apply / profile update
  → candidatecommon upsert
  → Phase 2 tenant Candidate (source: phase1) when synced
  → Controlled by tenantDbName on Job + sync secret
```

Rules:

1. Portal is **not** multi-tenant; isolation starts when data lands in a Phase 2 tenant DB.  
2. Sync endpoints must reject missing/invalid sync secret in production.  
3. Client-facing exports must respect Phase 2 field visibility settings.

---

## 11. Open hardening items (honest backlog)

Tracked in `docs/PRODUCTION_SECURITY_THREAT_MODEL.md`:

- Shorten JWT lifetime; reject expired tokens consistently.  
- Prefer Atlas + network isolation over DB-on-same-EC2.  
- Disable open HQ bootstrap in production.  
- Formalize GDPR delete workflows and pen test before large enterprise deals.

---

## 12. Contact

For data-subject requests or security reports: **[security@ / dpo@ — fill before customer delivery]**.
