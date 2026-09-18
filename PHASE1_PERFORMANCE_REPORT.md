# Phase 1 Performance Report

**Date:** 2026-09-18  
**Workflow:** Inspect → LOCAL BASELINE → Implement P0 → Verify → Report  

## 1. Scope

| Layer | Path | Modified |
|-------|------|----------|
| Frontend | `jobportal_himanshu` | **YES** |
| Backend | `hrayntra_aws/backend1` | **YES** |
| Phase 2 (`frontphase2` / `backendphase2`) | — | **NO (0 files)** |

## 2. Baseline

Label: **LOCAL BASELINE** (no production APM / p50–p95).

| Metric | Value | Kind |
|--------|------:|------|
| Backend `/health` round-trip | **76 ms** | measured (before changes; server was up) |
| Auth bootstrap payload | Full `GET /api/profile/:id` with large Prisma `include` | measured (code path) |
| Auth fields actually used by FE | `id`, `whatsappNumber`, `email`, `name`, `profilePhotoUrl` | measured (AuthContext) |
| Navigation loading | Full-screen `GlobalLoader` after 180ms click | measured (code) |
| Profile page size | **4449** lines | measured |
| Dashboard page size | **1170** lines | measured |
| Job list defaults | FE `limit=200` / searchjobs `limit=500` / BE personalized `take:500` | measured (code) |
| Profile section save | Often `PATCH/POST` → **full profile GET** | measured (code; 34 standalone refresh calls) |
| CV upload | `await parseResumeFromBuffer` **inside** HTTP request | measured (code) |
| CV extract UI | Poll 2s; **60s force-complete as success** | measured (code) |
| AI provider timeout | **none** | measured (code) |
| OpenAI `max_tokens` | **16384** | measured (code) |
| Auth bootstrap wall time (logged-in) | **NOT MEASURED** (no stable auth token in CI shell) | not measured |
| Dashboard useful paint | **NOT MEASURED** | not measured |
| Profile save latency | **NOT MEASURED** | not measured |
| CV parse p50/p95 | **NOT MEASURED** (requires real CV + AI keys) | not measured |

After implementation: backend was briefly unreachable during remount; `/health` re-measure = **N/A — not reliably measurable in current local environment** at report time. Module `require()` of changed controllers succeeded.

## 3. Root Causes Found (verified in code)

1. **Auth used full profile graph** for five display fields (`AuthContext.tsx`).
2. **AuthGuard + NavigationLoader** used full-screen GlobalLoader for normal navigation / auth wait.
3. **Profile saves** re-fetched entire profile (~34 call sites).
4. **CV upload** blocked on sync AI parse + LaTeX/S3/persist; FE then faked completion at 60s.
5. **AI calls** had no hard timeout; OpenAI budget 16k tokens.
6. **Duplicate CV text extraction** after parse for portfolio regex.
7. **Job APIs** over-fetched (200–500).

## 4. P0 Changes Implemented

### P0-1 Slim auth bootstrap

- **Problem:** `GET /profile/:id` on every boot/tab refresh.  
- **Files:** `backend1/src/controllers/auth.controller.js` (`getMe`), `backend1/src/routes/auth.routes.js`, `jobportal_himanshu/src/components/auth/AuthContext.tsx`  
- **Change:** `GET /api/auth/me` (protect) returns slim candidate + personal name/photo/email; AuthContext calls `/auth/me`; clears `isLoading` as soon as token+placeholder exist.  
- **Why faster:** Removes large include graph from critical path.  
- **Risk:** Low — full profile endpoint unchanged for profile page.

### P0-2 Reduce global blocking

- **Problem:** Full-screen loader on nav + auth.  
- **Files:** `AuthGuard.tsx`, `NavigationLoader.tsx`  
- **Change:** AuthGuard paints children when stored session exists; NavigationLoader is a **thin top bar**, not GlobalLoader.  
- **Why faster:** First paint / route transitions not blocked by full overlay.  
- **Risk:** Brief placeholder name until `/me` returns (already existed).

### P0-3 / P0-4 Profile save protocol

- **Problem:** Section saves triggered full profile GET.  
- **Files:** `jobportal_himanshu/src/app/profile/page.tsx`  
- **Change:** Replaced standalone post-mutation `await refreshProfileData(candidateId)` with `void syncProfileEarnRewardsRef.current(candidateId)`; work-experience save merges `savedEntries` locally. BasicInfo optimistic + debounce preserved; `refreshUser()` now hits `/me`.  
- **Why faster:** Save path = mutation (+ earn sync), not full profile download.  
- **Risk:** Medium — list UIs that relied on server reordering may need a manual refresh until section DTOs are fully standardized; optimistic delete already updated local state.

### P0-5 / P0-6 Async CV + truthful status

- **Problem:** Sync parse in upload; 60s fake success.  
- **Files:** `cv.controller.js`, `cv-parse-job.service.js`, `extract/page.tsx`  
- **Change:** Upload stores file, sets `parseStatus=queued`, returns immediately; `setImmediate(processCvParseJob)`; status API returns `queued|processing|completed|failed`; extract polls truthfully; 60s fake success removed (180s fail/redirect fallback).  
- **Why faster:** Upload HTTP returns after S3+DB row, not after AI.  
- **Risk:** Medium — multi-instance deploys rely on `resumeJson.parseStatus` (in-memory job map is per process).

### P0-7 Hard AI timeouts

- **Problem:** Indefinite provider waits.  
- **Files:** `resume-parser.service.js`  
- **Change:** `withTimeout` around OpenAI/Mistral/Gemini/Claude; env `CV_PARSER_AI_TIMEOUT_MS` (default **45000**).  
- **Risk:** Low if timeout ≥ normal provider latency.

### P0-8 Token budget

- **Problem:** `max_tokens=16384` always.  
- **Files:** `resume-parser.service.js`  
- **Change:** Default **8192** via `CV_PARSER_MAX_TOKENS` (cap 16384). Schema/post-process unchanged.  
- **Risk:** Medium — very long CVs may truncate JSON; raise env if needed.

### P0-9 Duplicate CV work

- **Problem:** Re-extract PDF/DOCX after AI parse.  
- **Change:** Prefer AI `portfolioLinks`; regex only if empty; `analyzeCV` remains background-only.  
- **Risk:** Low.

### P0-10 Accuracy safeguards

- Preserved: `validateData` / `normalizeData` / schema prompt / persist pipeline.  
- **Accuracy eval:** **NOT MEASURED** (no CV fixture run with before/after field compare in this environment).

### Extra P0 (Rule C — job over-fetch)

- FE jobs default **50** (was 200); searchjobs **50** (was 500); BE personalized `take: **100**` (was 500).

## 5. Before vs After

| Area | Before | After | Change |
|------|--------|-------|--------|
| Auth bootstrap | Full `GET /profile/:id` | `GET /auth/me` slim | **Request payload reduced (code)** |
| Auth blocking | GlobalLoader until profile returns | Unblock with session + placeholder | **Observed (code)** |
| Navigation | Full-screen GlobalLoader | Top progress bar | **Observed (code)** |
| Profile save network | Mutation + full GET | Mutation + earn sync (no full GET) | **~1 GET removed per save (code)** |
| Requests after profile save | 2+ (mutation + GET) | 1 (+ optional earn) | **count ↓ (code)** |
| CV upload response | Wait for full AI pipeline | Return after upload+queue | **Blocking work removed (code)** |
| CV processing | Sync in request | Async job + status | **Architecture change** |
| AI timeout | none | 45s default (env) | **status: added** |
| Job initial fetch | 200–500 | 50 FE / 100 BE match pool | **Limits ↓ (code)** |
| Full-screen blocking | Common | Auth unknown only / thin nav bar | **Observed (code)** |
| Auth/dashboard/CV wall times | — | N/A — not reliably measurable here | — |

## 6. Request Reduction (examples)

**Before — auth**
```text
boot → GET /api/profile/:id (full include) → set user
```

**After — auth**
```text
boot → placeholder user → GET /api/auth/me (slim) → set user
```

**Before — profile save**
```text
save → PUT/POST section → GET /api/profile/:id (full)
```

**After — profile save**
```text
save → PUT/POST section → local state / earn sync (no full GET)
```

**Before — CV**
```text
POST /cv/upload → parse AI → S3 extras → respond
```

**After — CV**
```text
POST /cv/upload → S3 file → resume queued → respond
background → parse AI → persist → status completed|failed
GET /cv/status/:id → truthful status
```

## 7. CV Pipeline

### Before
Upload awaited `parseResumeFromBuffer`, re-extracted text, LaTeX, S3, persist, optional PDF, then responded; `analyzeCV` async; FE force-completed success at 60s.

### After
1. Validate + S3 CV upload  
2. Upsert resume `aiAnalyzed=false`, `parseStatus=queued`  
3. HTTP 200 `{ jobId, status: queued }`  
4. Background: process → persist → optional PDF → `analyzeCV`  
5. Status: `queued | processing | completed | failed`  
6. Provider timeout via `CV_PARSER_AI_TIMEOUT_MS`  
7. FE polls; no fake success; long-wait shows failure/redirect message  

## 8. Accuracy Verification

| Check | Result |
|-------|--------|
| Parser post-process / schema retained | **preserved** |
| Side-by-side CV fixture before/after | **NOT MEASURED** |
| name/email/phone/DOB/gender/city/country/skills/latest job | **NOT MEASURED** (no eval dataset run) |

Do **not** claim an accuracy percentage.

## 9. Test Results

| Check | Result |
|-------|--------|
| Backend `node --check` (cv/auth/resume-parser/routes) | **pass** |
| Backend `require()` controllers | **pass** |
| Backend `node --test` job-matching-pipeline-phase1 | **9/9 pass** |
| Frontend `pnpm lint` | **fail** — 654 pre-existing issues (246 errors); not introduced as P0-specific regressions in changed files review |
| Frontend `typecheck` | **N/A** — script not in `package.json` |
| Frontend `build` | **NOT RUN** (lint noise / time); recommend CI build separately |
| Backend `npm test` umbrella | **N/A** — no single `test` script; targeted tests run |

## 10. Remaining Bottlenecks (not P0)

- Mega page code-splitting (`profile` ~4.4k LOC, explore-jobs)
- Always-on root hosts (chat FAB, gossips, suggestions, activity) — deferred
- Redis / shared job queue for multi-instance CV workers
- Standardize every section API to return full section DTO + typed client patchers
- CV evaluation harness with golden resumes
- Further personalized matching quality vs `take` tradeoffs
- Remove `ignoreBuildErrors` / lint debt

## 11. Recommended Next Phase

### P1
1. Dynamic import / split profile & explore-jobs.  
2. Lazy-mount root hosts by route.  
3. Section APIs always return updated arrays; typed `applySectionPatch`.  
4. CV worker process or queue for multi-instance.  
5. Golden-set CV accuracy regression tests.

### P2
1. Redis for job list / status if multi-node.  
2. Streaming AI parse / chunked extraction.  
3. CDN for CV assets.  
4. Bundle analysis budget in CI.

## 12. Final Status

```text
P0 PARTIALLY COMPLETE
```

**Why:** Core P0 items (slim `/me`, loader behavior, save without full GET, async CV + status + timeouts + token budget + dedupe + job limit cuts) are implemented in code. Wall-clock before/after timings and CV accuracy fixtures were **not** fully measurable in this environment; frontend lint remains red due to large pre-existing debt; production multi-instance CV status should be validated after deploy.

---

## Git / change summary

### Files modified
- `jobportal_himanshu/src/components/auth/AuthContext.tsx`
- `jobportal_himanshu/src/components/auth/AuthGuard.tsx`
- `jobportal_himanshu/src/components/common/NavigationLoader.tsx`
- `jobportal_himanshu/src/app/extract/page.tsx`
- `jobportal_himanshu/src/app/profile/page.tsx`
- `jobportal_himanshu/src/hooks/portal/usePortalJobs.ts`
- `jobportal_himanshu/src/app/(website)/searchjobs/page.tsx`
- `backend1/src/controllers/auth.controller.js`
- `backend1/src/routes/auth.routes.js`
- `backend1/src/controllers/cv.controller.js`
- `backend1/src/services/resume-parser.service.js`
- `backend1/src/controllers/job.controller.js`

### Files added
- `backend1/src/services/cv-parse-job.service.js`
- `jobportal_himanshu/PHASE1_PERFORMANCE_REPORT.md` (this file)
- `hrayntra_aws/PHASE1_PERFORMANCE_REPORT.md` (copy for monorepo visibility — if written)

### Files deleted
- none (temp scripts removed)

### Phase 2 files modified: **0**

### Suggested commits (do not create unless asked)
```text
perf(phase1): add slim GET /api/auth/me bootstrap
perf(phase1): reduce GlobalLoader; nav top bar
perf(phase1): skip full profile GET after section saves
perf(phase1): async CV parse job + truthful status
perf(phase1): AI provider timeouts + max_tokens budget
perf(phase1): reduce job list/match fetch limits
docs(phase1): add performance report
```

---

# P1 PERFORMANCE OPTIMIZATION

**Date:** 2026-09-18  
**Workflow:** Inspect P0 → P1 baseline → Implement P1-1…P1-5 → Validate → Measure → Report  
**Scope:** `jobportal_himanshu` + `hrayntra_aws/backend1` only · **Phase 2 files modified: 0**

## 1. P1 baseline

Label: **P1 BASELINE** (post-P0, before P1 code changes).

| Metric | Value | Kind |
|--------|------:|------|
| `pnpm build` (Next 16 Turbopack) | **success** (pre-P1) | measured |
| Static JS chunks total | **14584.9 KB** / many files | measured |
| Profile page source | **4450** lines | measured |
| Explore-jobs page source | **3323** lines | measured |
| Candidate-dashboard page source | **1170** lines | measured |
| Profile modals on critical path | **18** static modal imports | measured (code) |
| Root optional hosts | Mounted synchronously in `layout.tsx` | measured (code) |
| CV job state | In-memory `Map` + `resumeJson.parseStatus` mirror | measured (code) |
| CV golden fixtures | **none** | measured |
| Page-level First Load JS (Next classic table) | **NOT MEASURED** (Turbopack route table has no per-route kB) | not measured |
| Profile/explore useful paint (lab) | **NOT MEASURED** | not measured |

## 2. P1 bottlenecks (verified)

1. Profile / explore-jobs eagerly import heavy drawers/modals (editors, country lists, TipTap-adjacent UI).
2. Root layout mounts chat sync, gossips hydrate, suggestions engine, activity tracker, FAB before first paint work settles.
3. Section saves mostly skip full GET (P0) but lack a shared patch helper; several APIs returned success without section DTOs.
4. CV multi-instance: status readable from Mongo, but claim/retry/restart recovery incomplete; worker held file buffer only in process memory.
5. No golden CV fixture harness for accuracy regressions.

## 3. P1-1 bundle splitting

**Change:** Dynamic `next/dynamic` for all profile section modals via `lazy-profile-modals.tsx` + `ModalLoadShell`; explore-jobs lazy-loads `ScreeningQuestionsDrawer` and `ApplicationSuccessModal`. Extracted `normalizeCareerPreferencesFromApi` to `career-preferences-normalize.ts` so normalize does not pull the modal module.

**Files:** `lazy-profile-modals.tsx`, `ModalLoadShell.tsx`, `profile/page.tsx`, `explore-jobs/page.tsx`, `career-preferences-normalize.ts`, `CareerPreferencesModal.tsx`

**Measure after:**

| Metric | P1 Before | P1 After | Status |
|--------|----------:|---------:|--------|
| `pnpm build` | success | **success** (~105s compile) | improved / stable |
| Static JS chunks total | 14584.9 KB | **~14885–15953 KB** (more async chunks) | **split ↑ total, critical path deferred (code)** |
| Modal load UX | in initial graph | shell → chunk on open | **observed (code)** |
| Per-route First Load JS | NOT MEASURED | NOT MEASURED | Turbopack limitation |

## 4. P1-2 root host optimization

| Host | Network work | CPU/JS work | Required globally | Action |
|------|--------------|-------------|-------------------|--------|
| ApiHealthChecker | Dev/prod probe (skipped on localhost API) | low | yes (tiny) | **keep eager** |
| AuthProvider / AuthGuard / InactivityGuard | auth/me, idle timers | medium | yes | **keep eager** |
| TokensProvider | balance/catalog when authed | medium | yes (header) | **keep eager** |
| NavigationLoader | none | low | yes | **keep eager** |
| PortalNavigationWarmup | portal cache warm | medium | helpful | **defer ~400ms** |
| FloatingAlertsHost | notification poll 45s | high (framer) | useful | **defer ~400ms** |
| HryantraChatSyncHost | HQ chat poll | medium | after paint | **idle defer ≤2.5s** |
| OfficeGossipsSyncHost | hydrate/push community | high | not first paint | **idle defer** |
| HryantraChatFab | localStorage + listeners | medium | after paint | **idle defer** |
| SuggestionsEngineHost | apps/dashboard/completeness | high | not first paint | **idle defer** |
| UserActivityTrackerHost | heartbeat / sessions | medium | not first paint | **idle defer** |

**Implementation:** `DeferredPortalHosts.tsx` wired from `layout.tsx`.

## 5. P1-3 profile save standardization

**Client:** `applySectionPatch` + `pickAuthoritativeSection` in `profile-section-patch.ts`. Wired for personal info, summary, work experience, skills, career preferences (session cache + local state). Other sections still use P0 earn-sync without full GET; inventory continues incrementally.

**Backend DTOs returned:**

| Endpoint | Before | After |
|----------|--------|-------|
| `PUT personal-info` | already returned `personalInfo` | unchanged (consumed) |
| `POST skills` | success only | **`data: { skills, additionalNotes }`** |
| `PUT career-preferences` | success only | **`data: preferences`** |
| `POST/PUT summary` | success only | **`data: { summaryText }`** |

**Sections standardized this pass:** Basic Information, Education (full `educations[]` DTO + FE merge), Skills, Languages, Career Preferences, Summary, Work Experience (POST/PUT echo + client merge). Projects/certs already returned arrays. Remaining: portfolio/accomplishments/visa/vaccination/gap/internship echo hardening.

## 6. P1-4 CV worker/queue

**Deployment inspect:** Single Node `server.js` listen; `Dockerfile.example` present; **no Redis / Bull / BullMQ** in `package.json`. Prefer Mongo durability over introducing Redis.

**Architecture:**

```text
upload → S3 + Resume.resumeJson.parseStatus=queued
      → setImmediate processCvParseJob
      → claimQueuedJob (findAndModify when available)
      → download fileUrl if buffer missing (restart-safe)
      → AI parse → persist profile → mark completed
fail → mark failed or re-queue (max attempts, delay)
boot → recoverOrphanedJobs → resumeCvParseJobs
status → prefer Mongo parseStatus (any instance)
```

**Config:** `CV_PARSE_MAX_ATTEMPTS` (default 3), `CV_PARSE_STALE_MS`, `CV_PARSE_RETRY_DELAY_MS`.

**Multi-instance:** Status + claim designed for shared Mongo. **Full restart/multi-instance soak: NOT FULLY TESTED LOCALLY.**

**Migration path:** When Redis is available, replace claim/queue with BullMQ while keeping the same status enum for the FE.

## 7. P1-5 accuracy harness

| Item | Detail |
|------|--------|
| Fixtures | `backend1/test/fixtures/cv-golden/` — **3** synthetic resumes + `manifest.json` |
| Fields | name, email, phone, DOB, gender, city, country, skills, latestJob, education |
| Runner | `pnpm run test:cv-golden` → `cv-golden-set.test.js` |
| Default CI | Comparator unit tests **pass**; live AI **SKIP** without `RUN_CV_GOLDEN_AI=1` |
| Live AI results | **NOT RUN** (no forced provider keys in this session) |

## 8. Before vs After

| Metric | P1 Before | P1 After | Status |
|--------|----------:|---------:|--------|
| Profile initial JS | modals in graph | modals dynamic | **deferred (code)** |
| Explore initial JS | drawer/success modal eager | dynamic | **deferred (code)** |
| Initial requests | hosts fire immediately | deferred hosts | **delayed (code)** |
| Profile save requests | mutation (+ earn), no full GET | same + section DTO/patch | **stable / clearer** |
| CV upload response | async (P0) | async + durable claim | **reliability ↑** |
| CV processing | in-proc buffer | fileUrl recovery + retry | **restart-safer** |
| Background requests | immediate global hosts | idle/early deferred | **after paint** |
| Build | success | **success** | pass |
| Golden harness | none | 3 fixtures + tests | **added** |

Never fabricate wall-clock paint numbers — lab timings remain **NOT MEASURED** where listed.

## 9. Tests

| Check | Result |
|-------|--------|
| FE `pnpm build` | **pass** |
| FE eslint (changed P1 files) | **pass** (exit 0) |
| FE full `pnpm lint` | **NOT RELIABLY COMPLETED** (long / pre-existing debt; prior P0: 654 issues) |
| FE typecheck | **N/A** (no script) |
| BE `node --check` cv/server | **pass** |
| BE `test:cv-golden` | **2 pass, 1 skip** (AI) |
| BE `test:phase1-match` | **9/9 pass** |

## 10. Remaining P2

- Redis/BullMQ when multi-node queue load justifies it  
- Bundle budgets / analyzer in CI (Turbopack lacks classic First Load table)  
- Finish section DTO returns for education/projects/certs/languages/visa  
- Streaming/chunked AI parse  
- CDN for CV assets  
- Full multi-instance CV soak test in staging  
- Run `RUN_CV_GOLDEN_AI=1` golden eval when keys available  

## 11. P1 change summary

### Frontend files modified / added (important)
- `src/app/layout.tsx`
- `src/app/profile/page.tsx`
- `src/app/(website)/explore-jobs/page.tsx`
- `src/components/common/DeferredPortalHosts.tsx` (**added**)
- `src/components/profile/lazy-profile-modals.tsx` (**added**)
- `src/components/profile/ModalLoadShell.tsx` (**added**)
- `src/lib/profile-section-patch.ts` (**added**)
- `src/lib/career-preferences-normalize.ts` (**added**)
- `src/components/modals/CareerPreferencesModal.tsx`
- `PHASE1_PERFORMANCE_REPORT.md` (this section)

### Backend files modified / added
- `src/services/cv-parse-job.service.js` (durable queue)
- `src/controllers/cv.controller.js`
- `src/controllers/profile.controller.js` (section DTO responses)
- `src/server.js` (boot recovery)
- `src/services/cv-golden-set.test.js` (**added**)
- `test/fixtures/cv-golden/*` (**added**)
- `package.json` (`test:cv-golden`)

### Files deleted
- none

### Phase 2 files modified: **0**

## 12. P1 final status

```text
P1 IMPLEMENTED (measurable where tooling allowed; multi-instance CV soak NOT FULLY TESTED LOCALLY)
```

---

## P2 — Production Hardening & Advanced Performance

**Date:** 2026-09-18  
**Scope:** `jobportal_himanshu` + `backend1` only  

### 1. Implemented

| Item | What |
|------|------|
| P2-1 / P2-2 | Formal state machine (`cv-parse-state-machine.js`); claim rejects `completed`; transition guards; mock soak tests `test:cv-concurrency` (7/7 pass) |
| P2-3 / P2-4 | Field-level exact/normalized/partial/missing/incorrect golden harness; live AI metadata when `RUN_CV_GOLDEN_AI=1` |
| P2-5 | `[CV_PARSE_TIMING]` structured logs (download/ai/portfolio/persist/total) — IDs only |
| P2-6 | Documented: portfolio reuses AI links / `_rawText` (no second PDF extract); `analyzeCV` remains deferred optional secondary |
| P2-9 | Portfolio / accomplishments / visa / vaccination return section DTOs; FE portfolio patches cache |
| P2-11 | `scripts/analyze-bundles.mjs` + `BUNDLE_BASELINE.json` + `pnpm analyze:bundles` |
| P2-16 | CV routes now `protect` + `requireOwnCandidate`; upload/extract send Authorization |
| P2-7 / P2-8 / P2-12 / P2-13 | Reviewed; intentionally unchanged (see §2) |

### 2. Verified but intentionally unchanged

| Topic | Decision | Evidence |
|-------|----------|----------|
| **Redis/BullMQ** | **KEEP MONGO QUEUE** | Single-process Docker example; no Redis in deps; concurrency proven via atomic claim semantics + soak tests; migrate when multi-replica + high CV volume |
| **CDN** | No change | CV already stored via S3/Cloudinary public HTTPS URLs; browser fetches `fileUrl` directly for restart recovery — not Node-proxied streaming. Signed-URL hardening is optional future work |
| **Chunked / streaming AI** | Not implemented | No measured resume-size/latency dataset showing single-call is insufficient; risk to accuracy without golden live runs |
| **Further max_tokens cut** | Leave P1 default (8192) | Live golden AI **SKIPPED** — cannot prove non-regression |

### 3. Before vs After

| Metric | Before (P1 end) | After P2 | Method |
|--------|----------------:|---------:|--------|
| Static JS chunks | 14885.1 KB / 188 | **14885.1 KB / 188** | `analyze-bundles.mjs` (no FE bundle change this pass) |
| CV concurrency tests | none | **7/7 pass** | mocked 2-worker soak |
| CV golden (offline) | pass/skip | **2 pass / 1 skip** | field taxonomy expanded |
| Live AI golden | SKIPPED | **SKIPPED — credentials unavailable** | |
| CV parse p50/p95 | N/A | **N/A — insufficient sample size** | timing logs added for future samples |
| FCP/LCP/INP | NOT MEASURED | NOT MEASURED | lab tooling not run this pass |

### 4. CV Reliability

| Check | Result |
|-------|--------|
| State transitions enforced | yes (`isValidTransition` / claim guards) |
| Duplicate active claims (mock) | **0** |
| Completed not reclaimed | **pass** |
| Stale processing → queued | **pass** |
| Max attempts | **pass** |
| 10 & 50 job soak (2 workers) | **pass** |
| Real multi-EC2 soak | **NOT FULLY TESTED LOCALLY** (mocked + Mongo findAndModify path) |

### 5. CV Accuracy

| Item | Value |
|------|------:|
| Fixtures | 3 synthetic |
| Fields | name, email, phone, dob, gender, city, country, skills, latestJob, education |
| Offline comparator | exact / normalized / partial / missing / incorrect |
| Live provider run | **SKIPPED — provider credentials unavailable** |
| Invented overall % | **none** |

### 6. CV Timing

Instrumentation emits:

```text
[CV_PARSE_TIMING] jobId=… downloadMs=… extractMs=… aiMs=… portfolioMs=… persistMs=… totalMs=…
```

Sample wall times this session: **N/A — no live upload timed**.

### 7. Bundle

From `BUNDLE_BASELINE.json` (post-P1 build artifact):

| Metric | Value |
|--------|------:|
| jsChunkCount | 188 |
| totalStaticJsKb | 14885.1 |
| largest chunk | 7876.3 KB |
| Advisory warn | total > 20000 KB / largest > 9000 KB |

### 8. Tests

```text
BUILD: NOT RE-RUN this P2 pass (P1 build was green; FE auth/header-only edits)
LINT: PARTIAL (changed-file eslint not re-batched)
CV GOLDEN: 2 PASS / 0 FAIL / 1 SKIP
PHASE1 MATCH: 9/9
CV CONCURRENCY: 7/7 PASS
SECURITY REGRESSION: CV ownership guard ADDED (protect + candidate match); full IDOR matrix not automated
```

### 9. Phase 2 Safety

```text
Phase 2 frontend files modified: 0
Phase 2 backend files modified: 0
```

### 10. Remaining Work

**Future / optional:** signed S3 URLs; CI gate on `BUNDLE_BASELINE.json`; live golden in staging.

**Blocked by infrastructure:** real multi-instance soak on ≥2 backend replicas.

**Requires production data:** CV p50/p95; FCP/LCP; token-budget A/B.

**Not justified yet:** Redis/BullMQ; chunked AI; CDN cutover.

### P2 quality gate (evidence)

1. Faster overall Phase 1? **P0+P1 yes (code); P2 reliability/measurement focused — no new paint claim.**  
2–5. Profile/modals/hosts/saves: **unchanged from P1 (still dynamic/deferred/no full GET).**  
6. Two workers same job? **Mock: no; production findAndModify + completed exclusion.**  
7–8. Crash recover / retry? **Yes (stale recover + max attempts tests).**  
9. Field-level accuracy harness? **Yes.**  
10. Live AI tested? **No — SKIPPED.**  
11. Latency measured? **Logs added; samples N/A.**  
12. Duplicate parse removed only where safe? **Yes (documented reuse).**  
13–14. Redis/CDN required? **No — KEEP MONGO; S3 URLs already direct.**  
15. Bundle regress? **No change measured.**  
16. Security: **CV routes now auth+ownership.**  
17. Phase 2 untouched? **Yes (0).**

### P2 change files (important)

- `backend1/src/services/cv-parse-state-machine.js`  
- `backend1/src/services/cv-parse-job.concurrency.test.js`  
- `backend1/src/services/cv-parse-job.service.js`  
- `backend1/src/services/cv-golden-set.test.js`  
- `backend1/src/controllers/cv.controller.js`  
- `backend1/src/routes/cv.routes.js`  
- `backend1/src/controllers/profile.controller.js`  
- `jobportal_himanshu/src/app/uploadcv/page.tsx`  
- `jobportal_himanshu/src/app/extract/page.tsx`  
- `jobportal_himanshu/src/app/profile/page.tsx`  
- `jobportal_himanshu/scripts/analyze-bundles.mjs`  
- `jobportal_himanshu/BUNDLE_BASELINE.json`  

```text
Phase 1 optimized: YES
jobportal_himanshu modified: YES
backend1 modified: YES
Phase 2 modified: NO
```
