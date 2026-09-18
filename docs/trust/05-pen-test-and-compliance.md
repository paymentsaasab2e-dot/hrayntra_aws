# Penetration Test Summary & Compliance Certificates

**Product:** HRYantra (Phase 1 Job Portal + Phase 2 Employer CRM)  
**Last updated:** 2026-09-17  
**Document type:** Register + templates for enterprise due diligence  

> **Honesty note for reviewers:** Fill the tables below with real vendor reports and certificate PDFs before sending to customers. Until an external assessment is attached, mark status as **Planned / In progress**, not **Passed**.

---

## 1. Penetration test summary (Phase 1 + Phase 2)

### 1.1 Engagement overview

| Field | Value |
|-------|--------|
| Scope systems | Phase 1: `hryantra.com` + `api1.hryantra.com`; Phase 2: `employers.hryantra.com` + `api2.hryantra.com` |
| Out of scope (default) | Third-party SaaS admin consoles, physical, social engineering (unless contracted) |
| Test types | External black-box + authenticated grey-box (recruiter + candidate roles) |
| Environment | Staging preferred; production only with change window |
| Vendor | _[TBD — e.g. CREST / CERT-In empaneled]_ |
| Report date | _YYYY-MM-DD_ |
| Retest date | _YYYY-MM-DD_ |
| Overall rating | _Critical / High / Medium / Low — after report_ |

### 1.2 Scope checklist

| Surface | Phase | Included |
|---------|-------|----------|
| Candidate auth (OTP, password, sessions) | 1 | ☐ |
| Profile / CV upload & parse | 1 | ☐ |
| Job apply + portal sync | 1→2 | ☐ |
| Recruiter login, JWT, RBAC | 2 | ☐ |
| Tenant isolation (cross-tenant IDOR) | 2 | ☐ |
| Client-review public token + resume proxy | 2 | ☐ |
| File / S3 proxy abuse | 1+2 | ☐ |
| HQ routes & impersonation | 2 | ☐ |
| Billing / Razorpay webhooks | 2 | ☐ |
| Vercel `/api/proxy` abuse | 1+2 | ☐ |

### 1.3 Findings summary (populate from vendor report)

| ID | Severity | Title | Phase | Status |
|----|----------|-------|-------|--------|
| PT-001 | — | _Example: expired JWT still accepted_ | 2 | Open / Fixed / Accepted risk |
| PT-002 | — | | | |
| PT-003 | — | | | |

Severity definitions: Critical (RCE / full tenant breach), High (auth bypass / cross-tenant read), Medium (IDOR limited, XSS stored), Low (info disclosure), Informational.

### 1.4 Pre-assessment self-check (internal)

Aligned with `docs/PRODUCTION_SECURITY_THREAT_MODEL.md`:

| Item | Owner | Done |
|------|-------|------|
| Short-lived JWTs; reject expired tokens | Backend | ☐ |
| `/hq/setup` disabled in production | Backend | ☐ |
| DB not publicly reachable; Atlas IP allowlist | Ops | ☐ |
| Secrets in Secrets Manager / IAM role for S3 | Ops | ☐ |
| Rate limit + WAF on nginx / edge | Ops | ☐ |
| Sync secret required; no default JWT secret in prod | Backend | ☐ |
| Client-review URL masking verified | Backend + QA | ☐ |
| Cross-tenant IDOR test cases in QA | QA | ☐ |

### 1.5 Remediaton SLA (suggested)

| Severity | Fix target | Retest |
|----------|------------|--------|
| Critical | 7 days | Required |
| High | 14 days | Required |
| Medium | 30 days | Sample |
| Low | Next release | Optional |

### 1.6 Attestation block (after real pen test)

```text
Vendor: ____________________
Report reference: ____________________
Phases covered: Phase 1 □  Phase 2 □
No open Critical/High findings as of: __________
Signed: ____________________  Date: __________
```

Attach PDF under: `docs/trust/artifacts/pentest/` (do not commit customer-specific raw dumps with live secrets).

---

## 2. Compliance certificate register

### 2.1 Current status

| Framework / cert | Status | Scope | Evidence location | Expiry |
|------------------|--------|-------|-------------------|--------|
| **SOC 2 Type I** | Planned | Phase 1 + 2 controls | _TBD auditor letter_ | — |
| **SOC 2 Type II** | Planned | Same | _TBD_ | — |
| **ISO/IEC 27001** | Planned | ISMS covering both products | _TBD certificate_ | — |
| **GDPR readiness** | In progress (process docs) | EU candidate / client data | This pack + DPAs | Continuous |
| **India DPDP Act readiness** | In progress | Indian personal data | Policies + consent UX | Continuous |
| **PCI DSS** | N/A (Razorpay processes cards) | Payments | Razorpay AoC (vendor) | Per vendor |
| **CERT-In** guidelines | Follow ops hardening | Hosting in India / serving India | Ops runbooks | Continuous |
| **Penetration test** | Planned | External app + API | §1 above | Annual |

### 2.2 Certificate placeholders (attach when issued)

Store binary artifacts here (git-lfs or private drive link):

```text
docs/trust/artifacts/
  pentest/
    YYYY-pen-test-executive-summary.pdf
    YYYY-pen-test-retest-letter.pdf
  certificates/
    soc2-type1.pdf
    soc2-type2.pdf
    iso27001.pdf
    insurance-cyber.pdf
  processors/
    aws-soc-bridge.pdf
    mongodb-atlas-compliance.pdf
    vercel-dpa.pdf
    razorpay-aoc.pdf
```

### 2.3 Subprocessor compliance (inherit)

| Subprocessor | Relevant attestations (typical) | Notes |
|--------------|---------------------------------|-------|
| AWS | SOC 2 / ISO 27001 | S3, EC2, optional Secrets Manager |
| MongoDB Atlas | SOC 2 / ISO | Tenant + portal DBs |
| Vercel | SOC 2 | Frontends only |
| Resend | Security page / DPA | Email OTP |
| OpenAI | Enterprise DPA / zero-retention options | Minimize PII in prompts |
| Razorpay | PCI via provider | Card data not stored in HRYantra |

### 2.4 Control mapping (lightweight)

| Control theme | Phase 1 | Phase 2 | Doc |
|---------------|---------|---------|-----|
| Access control | JWT + sessions | JWT + RBAC | Data protection §5 |
| Tenant isolation | N/A (shared portal) | DB-per-tenant | Multi-tenancy model |
| Encryption in transit | TLS | TLS | Architecture / DP |
| Encryption at rest | S3 + volume/Atlas | Same | DP §6 |
| Secure SDLC | Code review + audits | Same | Threat model |
| Vulnerability mgmt | Pen test + deps | Same | This document |
| Incident response | Runbook TBD | Same | Threat model |
| Privacy | Candidate rights | Employer + candidate | DP §7 |

---

## 3. Customer-facing one-pager (copy/paste)

**HRYantra security posture (Phase 1 & Phase 2)**

- Candidate portal and employer CRM are **separate applications** with separate APIs.  
- Employer data is isolated using a **database-per-tenant** model.  
- Client CV sharing uses **time-limited tokens** and **server-side file proxies** (no raw bucket URLs in the client package).  
- Data in transit is protected with **TLS**; passwords are **bcrypt**-hashed.  
- We maintain architecture, data-protection, multi-tenancy, and ADR documentation under `docs/trust/`.  
- Independent penetration testing and SOC 2 / ISO certifications are tracked in our compliance register; latest reports available under NDA.

---

## 4. Next actions for the team

1. Book external pen test (Phase 1 + Phase 2 authenticated).  
2. Close Critical/High items from threat model before test.  
3. Start SOC 2 gap assessment (access reviews, change mgmt, logging).  
4. Appoint DPO / security contact emails in Data Protection doc.  
5. Collect processor DPAs into `artifacts/processors/`.  
6. Revisit annually or after major architecture change.
