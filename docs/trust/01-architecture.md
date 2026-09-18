# Architecture Diagrams — Phase 1 & Phase 2

**Product:** HRYantra  
**Last updated:** 2026-09-17  

---

## 1. Integrated system (high level)

```mermaid
flowchart TB
  subgraph Users
    CAND[Candidates]
    REC[Recruiters / Employers]
    HQ[HQ / Super Admin]
  end

  subgraph Edge
    V1[Vercel — Portal FE<br/>hryantra.com]
    V2[Vercel — CRM FE<br/>employers.hryantra.com]
    NGX[nginx TLS<br/>api1 / api2]
  end

  subgraph Compute["EC2 / Node (PM2)"]
    B1[backend1 :5000<br/>Phase 1 API]
    B2[backendphase2 :5001<br/>Phase 2 API]
  end

  subgraph Data
    M1[(Mongo — Portal DB)]
    CC[(Mongo — candidatecommon)]
    TN[(Mongo — one DB per tenant<br/>e.g. adm01, rus01)]
    HQDB[(Mongo — Headquarters)]
    S3[(AWS S3<br/>uploads/phase1 & phase2)]
  end

  subgraph External
    AI[OpenAI / other AI]
    MAIL[Resend / email]
    PAY[Razorpay]
  end

  CAND --> V1
  REC --> V2
  HQ --> V2
  V1 -->|/api/proxy or direct| NGX
  V2 -->|/api/proxy| NGX
  NGX --> B1
  NGX --> B2
  B1 --> M1
  B1 --> CC
  B1 --> S3
  B1 --> AI
  B1 --> MAIL
  B2 --> TN
  B2 --> HQDB
  B2 --> CC
  B2 --> S3
  B2 --> AI
  B2 --> MAIL
  B2 --> PAY
  B1 <-->|portal sync secret<br/>tenantDbName| B2
```

---

## 2. Phase 1 — Candidate Job Portal

### 2.1 Logical architecture

```mermaid
flowchart LR
  subgraph FE["jobportal_himanshu (Next.js 16)"]
    WEB[Marketing / auth]
    PROF[Profile & CV]
    JOBS[Jobs & applications]
    LMS[LMS / tokens]
  end

  subgraph BE["backend1 (Express)"]
    AUTH[/api/auth OTP + JWT]
    PROFILE[/profile /cv]
    APPS[/applications]
    INT[/internal sync]
  end

  FE --> BE
  BE --> M[(Portal Mongo)]
  BE --> S3[(S3 phase1/)]
  BE --> CC[(candidatecommon)]
  INT -->|x-phase2-portal-sync-secret<br/>tenantDbName| P2[Phase 2 API]
```

### 2.2 Component stack

| Layer | Technology |
|-------|------------|
| UI | Next.js App Router, React 19, Tailwind, TanStack Query, Zustand |
| API | Express, Prisma 5 → MongoDB |
| Auth | Email/WhatsApp OTP (Resend), JWT + Mongo `Session`, bcrypt passwords |
| Files | AWS S3 (`uploads/phase1/...`), multer memory limits |
| AI | Resume parse, ATS, job matching |
| Realtime | Socket.IO (interview rooms) |

### 2.3 Request path (production)

```text
Browser → Vercel (portal)
       → api1.hryantra.com (nginx)
       → backend1 :5000
       → Mongo (portal) + S3 + optional Phase 2 sync
```

### 2.4 Key domains

- Auth / sessions / OTP  
- Candidate profile (personal, work, education, visa, vaccination, prefs, …)  
- CV upload, parse, editor, ATS  
- Jobs & applications (including mirrored CRM jobs)  
- Matching pipeline & notifications  
- LMS, mock interview, token wallet  
- HQ admin surfaces on portal  

---

## 3. Phase 2 — Employer CRM

### 3.1 Logical architecture

```mermaid
flowchart TB
  subgraph FE2["frontphase2 (Next.js 15)"]
    CRM[CRM: leads, clients, contacts]
    REC2[Recruitment: jobs, pipeline, matches]
    INT2[Interviews + client review]
    BILL[Billing / placements / team]
  end

  subgraph BE2["backendphase2 (Express /api/v1)"]
    AUTH2[JWT auth + RBAC]
    TEN[Tenant context ALS]
    MOD[Domain modules]
    PUB[Public: client-review, RSVP, apply]
  end

  FE2 -->|Bearer JWT or /api/proxy| BE2
  AUTH2 --> TEN
  TEN --> MOD
  TEN --> DB[(Active tenant Mongo DB)]
  MOD --> S3[(S3 phase2/)]
  PUB --> TEN
  PUB -->|mask S3 URLs| FE2
```

### 3.2 Component stack

| Layer | Technology |
|-------|------------|
| UI | Next.js 15, React 18, Tailwind, MUI, SWR, Socket.IO client |
| API | Express, Prisma → MongoDB (DB per tenant) |
| Auth | Login JWT (access + refresh), session gate, SystemRole permissions |
| Tenancy | `AsyncLocalStorage` + Prisma URL rewrite per `tenantDbName` |
| Files | S3 + authenticated entity files + PDF/resume proxies |
| Public share | Client-review JWT / short code (≈14 days), URL masking |

### 3.3 Client-review flow

```mermaid
sequenceDiagram
  participant R as Recruiter
  participant CRM as Phase 2 API
  participant CL as Client browser
  participant S3 as S3

  R->>CRM: Submit to client (cvShareMode)
  CRM->>CRM: Sign review JWT / short code
  R->>CL: Share /client-review/{token}
  CL->>CRM: GET public/review/:token
  CRM->>CRM: Resolve tenant from token
  CRM-->>CL: Profile + masked resume href
  CL->>CRM: GET .../resume (proxy)
  CRM->>S3: Stream object
  CRM-->>CL: File bytes (no raw bucket URL)
```

### 3.4 Request path (production)

```text
Browser → Vercel (employers)
       → /api/proxy → api2.hryantra.com (nginx)
       → backendphase2 :5001 (PM2)
       → Tenant Mongo DB + S3 + integrations
```

---

## 4. Deployment topology

```mermaid
flowchart TB
  subgraph Internet
    U[Users]
  end

  subgraph Vercel
    F1[Portal FE]
    F2[CRM FE + API proxy]
  end

  subgraph AWS
    subgraph EC2
      N[nginx TLS]
      N1[Node backend1]
      N2[Node backendphase2]
      Mlocal[(Optional local Mongo)]
    end
    S3[S3 bucket]
    SM[Secrets / IAM optional]
  end

  subgraph Atlas["MongoDB Atlas (recommended)"]
    DBs[(Portal + HQ + candidatecommon + N tenant DBs)]
  end

  U --> F1 & F2
  F1 & F2 --> N
  N --> N1 & N2
  N1 & N2 --> Mlocal
  N1 & N2 --> DBs
  N1 & N2 --> S3
```

---

## 5. Trust boundaries

| Boundary | Mechanism |
|----------|-----------|
| Candidate ↔ Portal | JWT + session row; OTP for login |
| Recruiter ↔ CRM | JWT + RBAC permissions; optional single active session |
| Portal ↔ CRM | Shared `PHASE2_PORTAL_SYNC_SECRET` header |
| Tenant ↔ Tenant | Separate Mongo database per tenant |
| Client review ↔ CRM data | Time-limited token; storage URLs rewritten to API proxy |
| Browser ↔ S3 | Prefer proxied resume/file routes; avoid exposing long-lived bucket URLs |

---

## 6. Related source anchors

| Concern | Path |
|---------|------|
| Phase 1 server mounts | `backend1/src/server.js` |
| Phase 2 app mounts | `backendphase2/src/app.js` |
| Tenant Prisma context | `backendphase2/src/config/prisma.js` |
| Tenant middleware | `backendphase2/src/middleware/tenant-context.middleware.js` |
| Client-review serialize | `backendphase2/src/services/interview.service.js` |
| FE proxy | `frontphase2/src/app/api/proxy/[...path]/route.ts` |
| Threat model | `docs/PRODUCTION_SECURITY_THREAT_MODEL.md` |
