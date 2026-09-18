# Phase 1 — Full Condition Audit for Speed, Minimal Loading, Saves & AI Parsing

**Purpose of this document:** Hand this file to ChatGPT (or any architect) and ask for a concrete plan to make **all of Phase 1 faster** — every page, drawer/modal, data save, and the CV/AI parsing engine (speed **and** accuracy).

**Audit date:** 2026-09-18  
**Method:** Static code analysis of live repos (no production APM / p50–p95 timings).  
**Prior scores (May 2026 audit):** Performance **58/100** · Overall Phase 1 **50/100**.

---

## 0. What “Phase 1” is (do not confuse with Phase 2)

| Role | Path | Runtime |
|------|------|---------|
| **Phase 1 frontend** (candidate portal) | `C:\Users\Admin\Desktop\SAASAAll\jobportal_himanshu` | Next.js 16 App Router, React 19, Tailwind 4, TanStack Query v5, Framer Motion, TipTap |
| **Phase 1 backend** (API) | `C:\Users\Admin\Desktop\SAASAAll\hrayntra_aws\backend1` | Express `:5000`, Prisma → MongoDB, prod `https://api1.hryantra.com` |
| **Not Phase 1** | `hrayntra_aws/frontphase2` + `backendphase2` | CRM (Phase 2) — out of scope for this speed program |

There is **no** `frontphase1/` folder. ADR-002: portal (Phase 1) and CRM (Phase 2) are split apps.

**Phase 1 product surface:** WhatsApp/email OTP login, rich candidate profile, CV upload + AI parse, job discovery/apply, applications, interviews, notifications, LMS, AI chat/completion, ATS check, sync into Phase 2 common pool / portal applications.

---

## 1. Architecture snapshot (current)

```text
Browser (jobportal_himanshu)
  ├─ AuthContext → GET /api/profile/:id (FULL profile) on boot / tab focus
  ├─ AuthGuard → GlobalLoader on most authenticated routes while auth loading
  ├─ Root layout ALWAYS mounts: Chat FAB, Gossips sync, Suggestions, Activity tracker,
  │    NavigationLoader, TokensProvider, QueryProvider, …
  ├─ Hot pages: dashboard, profile, explore-jobs, searchjobs, applications, LMS, uploadcv/extract
  └─ /api/proxy → Phase 2 public jobs (when needed)

backend1 (Express)
  ├─ JWT auth (many write routes historically under-protected — security separate)
  ├─ Controllers are large “god” modules (profile, jobs, cv)
  ├─ MongoDB jobportal + candidatecommon
  ├─ CV parse: sync await inside upload request (no job queue)
  ├─ AI: OpenAI → Mistral → Gemini → Claude cascade
  ├─ In-memory Maps only (no Redis)
  └─ express.json limit 50MB
```

---

## 2. Goal statement (what we want ChatGPT to optimize for)

1. **Minimal loading** on every page and drawer/modal — prefer skeletons / partial paint / cached paint; avoid full-screen `GlobalLoader` whenever possible.
2. **Fast first paint** after login — slim auth bootstrap, not full profile graph.
3. **Fast navigation** between portal pages — warm caches, code-split mega pages, no waterfall.
4. **Fast saves** — section PATCH without mandatory full-profile reload; optimistic/debounced where safe.
5. **CV / AI parsing** — cut wall-clock latency **and** raise field accuracy (identity, location, dates, skills, experience).
6. Keep UX correct: no blank screens, no stale wrong data after save, no silent parse failures.

---

## 3. Boot, auth, and global loading (biggest UX tax)

### 3.1 Current behavior

| Step | What happens | File evidence |
|------|----------------|---------------|
| App mount | `AuthProvider` → `refreshUser()` | `jobportal_himanshu/src/components/auth/AuthContext.tsx` |
| Auth fetch | **Full** `GET /api/profile/:candidateId` (not a slim me/session DTO) | same |
| 401 | Wait 400ms, retry once, then logout | same |
| Guard | Non-public routes show **`GlobalLoader`** while `isLoading` | `AuthGuard.tsx` |
| Exceptions | `/uploadcv`, `/extract` intentionally **not** blocked by AuthGuard loader | `AuthGuard.tsx` |
| Tab focus | Visibility refresh can hit full profile again | `useTabVisibilityRefresh` + AuthContext |
| Navigation | `NavigationLoader` shows GlobalLoader after **~180ms** click delay | root layout |

### 3.2 Always-on root layout hosts (extra JS + background work on every page)

From `src/app/layout.tsx` (always mounted):

- `ApiHealthChecker`
- `NavigationLoader` (GlobalLoader)
- `PortalNavigationWarmup`
- `HryantraChatFab` + `HryantraChatSyncHost`
- `OfficeGossipsSyncHost`
- `SuggestionsEngineHost`
- `UserActivityTrackerHost`
- `FloatingAlertsHost`
- `TokensProvider`, `InactivityGuard`, etc.

**Condition:** Even “light” pages pay for chat/gossips/suggestions/activity infrastructure.

### 3.3 Problem for “minimal loading”

Authenticated pages often cannot paint content until:

1. Full profile auth GET finishes, **and/or**
2. Page’s own primary queries finish (often tied to the same GlobalLoader).

---

## 4. Hot pages — current condition

| Page | Approx size | Loading pattern today | Data pattern / limits | Speed smell |
|------|-------------|----------------------|------------------------|-------------|
| **candidate-dashboard** | ~1170 LOC | **Full-page GlobalLoader** if `loading \|\| jobsLoading` | Parallel react-query: CV dashboard + jobs list + personalized jobs; also completeness + profile snapshot; courses sequential fallback | Loader waits on **jobs**, not only critical above-the-fold |
| **profile** | ~**4449** LOC | GlobalLoader only if no session cache + loading | Session cache paint (5 min stale) → full `GET /profile/:id` → CV analysis GET/POST/GET | Mega-bundle; post-save usually full GET again |
| **explore-jobs** | ~**3323** LOC | GlobalLoader when loading and list empty | Progressive: batch **10**, deeper personalized ≥ **120** | Huge page; multi-phase fetch |
| **searchjobs** | ~542 LOC | Skeleton grid (better) | Single `GET /jobs?limit=**500**` | Fetches up to 500 jobs in one shot |
| **applications** | client ~1622 LOC | GlobalLoader + list skeleton | Apps query + jobs list `limit=**80**` | Dual fetch; loader on auth/list |
| **uploadcv** | ~297 LOC | Own progress UI (AuthGuard does not block) | XHR `POST /cv/upload`, redirect in **~100ms** while upload continues | UX OK; **server** still sync-parses |
| **extract** | ~279 LOC | Custom `HryantraLoader` | Poll `GET /cv/status/:id` every **2s**; force-complete **60s**; fake progress | Polling only masks sync backend work |
| **LMS dashboard** | ~405 LOC | GlobalLoader until hydrated + dashboard data | LMS API client | Full-page block |

**Backend job matching:** `getPersonalizedJobs` historically uses `take: **500**` (`backend1/.../job.controller.js`) — large in-memory pool.

---

## 5. Drawers & modals — current condition

### 5.1 Inventory (profile)

Wired from `profile/page.tsx` (hydrate mostly from parent `initialData`; open does **not** re-GET independently):

BasicInfo, Summary, GapExplanation, WorkExperience, Internship, Education, AcademicAchievement, CompetitiveExams, Skills, Languages, Project, PortfolioLinks, Certification, Accomplishment, CareerPreferences, VisaWorkAuthorization, Vaccination, Resume (+ DocumentViewer).

Other drawers:

| Drawer | On open | Loading |
|--------|---------|---------|
| `ProfileDrawer` | Shell only | Light |
| `ProfileCompletionDrawer` | `POST /ai/profile-questions`; each turn often `extract-profile-data` **+** next question → **~2 LLM calls/message** | Local spinners (not GlobalLoader) |
| `ScreeningQuestionsDrawer` | Props from parent job | Light |
| CareerPreferencesModal | Debounced `POST /api/ai/job-title-suggestions` while typing | Extra AI while modal open |

### 5.2 Save → reload pattern (critical)

| Pattern | Where | Effect |
|---------|--------|--------|
| **Full profile GET after save** | Most section modals → `refreshProfileData(candidateId)` | Every small edit re-downloads **massive include graph** |
| **Optimistic + skip full reload** | BasicInfo (patch session cache; still may `refreshUser()` = another full profile GET) | Faster UI; auth path still heavy |
| **Debounced silent save** | BasicInfoModal **750ms** while typing | Good for perceived speed; still hits API |
| **Summary** | Patches cache; skips full refresh on some paths | Better than average |

**Condition:** Drawer UX feels slow not because the modal is heavy, but because **save closes → full profile round-trip → re-render mega page**.

### 5.3 Desired “minimal loading” for drawers (current gap)

- Open: paint from parent/cache immediately (already mostly true).
- Save: return **section DTO only**, patch local state/cache; **no** GlobalLoader; **no** mandatory full GET.
- AI drawers: one LLM call per turn max; stream if possible; never block whole app shell.

---

## 6. Data saving — current condition

### 6.1 Endpoints (section CRUD)

Under `/api/profile/...` (representative):  
`personal-info`, `summary`, `gap-explanation`, `work-experience`, `internship`, `education`, `academic-achievement`, `competitive-exam`, `skills`, `languages`, `project`, `portfolio-links`, `certifications`, `accomplishments`, `career-preferences`, `visa-work-authorization`, `vaccination`, `resume` (+ upload/inspect).

### 6.2 Patterns

| Pattern | Prevalence | Notes |
|---------|------------|-------|
| Explicit modal Save | Dominant | Wait for API success |
| Debounced silent | BasicInfo only (750ms) | Not generalized |
| Optimistic UI | Settings toggles; BasicInfo partial | Not standard for lists (work/edu) |
| Cache invalidate | Portal page/session caches; logout clears | Profile session stale **5 min** |
| Over-fetch | **Yes** — full GET after most saves | Main save latency |

### 6.3 Profile GET cost

Backend profile GET uses a **large Prisma include graph** (work, education, skills, languages, documents, etc.). This is the same payload used for:

- Auth boot
- Profile page load
- Most post-save refreshes
- Often tab-visibility refresh

**There is no first-class slim `/api/me` or `/api/profile/:id?fields=` used by the FE today.**

---

## 7. Caching — current condition

### 7.1 Frontend

| Layer | Behavior |
|-------|----------|
| TanStack Query defaults | `refetchOnMount: false`, `refetchOnWindowFocus: false`, `retry: 2`, `gcTime` 10m |
| STALE_TIMES | list **90s**, detail **120s**, dashboard/jobs **5 min** (`lib/query/query-client.ts`) |
| Session / memory page caches | dashboard, explore-jobs, profile, events (`portal-page-caches.ts`); profile/dashboard stale **5 min** |
| Explore progressive | batch 10, stale 5 min |

**Axios / SWR:** not used. Most profile CRUD is **raw `fetch`**, so Query cache does **not** automatically cover profile sections.

### 7.2 Backend

| Layer | Behavior |
|-------|----------|
| Redis | **Not used** |
| In-memory | Jobs list cache TTL **5 min**; some AI/matching Maps |
| CDN | Not evidenced in code for API/lists (S3 URLs only; CloudFront recommended historically) |
| Body parser | `express.json({ limit: '50mb' })` |

---

## 8. CV / AI parsing engine — current condition (speed + accuracy)

### 8.1 User flow

```text
/uploadcv  → XHR POST /api/cv/upload (cv + candidateId)
           → UI redirects to /extract in ~100ms (upload still running)
/extract   → poll GET /api/cv/status/:candidateId every 2s
           → force UI complete at 60s if still “processing”
```

**Important:** From the **server** perspective, parse is **synchronous** (`await parseResumeFromBuffer(...)` inside `uploadCV`). There is **no** Bull/queue/worker. The poll endpoint only observes status while the upload request (or a parallel path) does the work.

### 8.2 Pipeline (`backend1/src/services/resume-parser.service.js`)

1. Buffer → text (`cv-parser.service.js`: pdf-parse / mammoth + regex helpers)
2. Clean text
3. **One** large LLM structure call: `structureResumeWithAI`
4. `validateData` → `normalizeData` (+ name enrich, city/country derive, junk work filter, skill/language cleanup)

**Provider cascade (no hard timeout / AbortSignal found):**

| Order | Provider | Default model notes |
|-------|----------|---------------------|
| 1 | OpenAI | `OPENAI_CHAT_MODEL` default **`gpt-4.1`**, `max_tokens: **16384**` |
| 2 | Mistral | `mistral-small-latest` |
| 3 | Gemini | `gemini-2.0-flash` (env override) |
| 4 | Anthropic | `claude-3-5-sonnet-20241022`, `max_tokens: 4096` |

OpenAI may retry once without `response_format` on format errors; then cascade. **No** numeric retry budget, **no** deadline → worst case hangs until provider/network fails.

### 8.3 Extra work on the same upload path (`cv.controller.js`)

After parse (still before/around response):

- **Re-extract** PDF/DOCX text again for portfolio regex (duplicate extract)
- Upsert portfolio links
- S3 upload CV (+ LaTeX generation path)
- `persistExtractedCvProfile`
- Optional profile extract PDF
- `setImmediate(analyzeCV)` — **second AI path** (not awaited on response, but still costs tokens/CPU)

Other paths that re-run full parse: profile resume upload/inspect (`profile.controller.js`).

### 8.4 Accuracy-related pieces (what exists today)

| Concern | Current handling |
|---------|------------------|
| Schema / prompt | `cv-extraction-schema.js` — gender, DOB `YYYY-MM-DD`, city/country; prompt asks to infer city/country from address |
| Validation | Email/phone/LinkedIn/dates/years; DOB coerce |
| Post-process | `deriveCityCountryFromAddress`, `enrichPersonalInformationFromResumeText`, skill/language cleanup, junk experience filter |
| Gender | Prompted; **weak/no strict enum validation** in parser service |
| Metrics | **No** measured accuracy rates in repo (unknown p@field in prod) |
| Completion AI | Chat + extract-profile-data — separate from resume parser; can overwrite/fill gaps |

### 8.5 Latency / cost smells (parser)

1. Single huge structured extraction with **16384** max tokens (slow + expensive).
2. Provider cascade without timeout → unpredictable p95.
3. Double document text extraction on upload.
4. LaTeX + PDF + S3 work coupled to upload request path.
5. Async `analyzeCV` = second model call per CV.
6. ProfileCompletionDrawer ≈ **2 LLM calls per user message**.
7. FE 60s force-complete can mark UX “done” while backend still working or failed silently from user POV.

### 8.6 File size limits

- Client/server CV upload typically **5MB** (profile paths also 2MB in places).
- Global JSON body still **50MB** (unrelated to CV multipart, but enables huge payloads elsewhere).

---

## 9. Quantified smells (checklist for ChatGPT)

| # | Smell | Evidence |
|---|-------|----------|
| 1 | Auth boot = full profile GET | `AuthContext.tsx` |
| 2 | GlobalLoader blocks most authenticated routes during auth | `AuthGuard.tsx` |
| 3 | Navigation GlobalLoader (~180ms) | root layout `NavigationLoader` |
| 4 | Always-on chat/gossips/suggestions/activity hosts | `layout.tsx` |
| 5 | Dashboard GlobalLoader waits on jobs | `candidate-dashboard/page.tsx` |
| 6 | Mega pages (no `next/dynamic` / lazy found in audit) | profile ~4449, explore ~3323 LOC |
| 7 | `searchjobs` `limit=500` | `(website)/searchjobs/page.tsx` |
| 8 | Jobs hook default `limit=200` | `hooks/portal/usePortalJobs.ts` |
| 9 | Personalized jobs backend `take: 500` | `job.controller.js` |
| 10 | Explore deeper personalized ≥120 | `explore-jobs-progressive-fetch.ts` |
| 11 | Most modal saves → full profile GET | `profile/page.tsx` |
| 12 | Profile GET massive include | `profile` controller/service |
| 13 | No Redis; thin in-memory only | backend1 |
| 14 | `express.json` 50MB | `server.js` |
| 15 | `ignoreBuildErrors: true` | `next.config.ts` |
| 16 | CV parse awaited in HTTP request (no queue) | `cv.controller.js` + `resume-parser.service.js` |
| 17 | No parse timeout | resume-parser |
| 18 | OpenAI `max_tokens: 16384` | resume-parser |
| 19 | Double text extract + analyzeCV extra AI | cv.controller |
| 20 | Extract poll 2s / force 60s | `extract/page.tsx` |
| 21 | Completion drawer ~2 AI calls/turn | `ProfileCompletionDrawer.tsx` |
| 22 | ~91 routes; dual/legacy profile editors still present | `personal-details`, `work-exp`, etc. |

---

## 10. What already helps (do not throw away)

- Explore progressive fetch (batch 10) instead of always dumping everything at once.
- Profile session cache (5 min) can skip first GlobalLoader on revisit.
- Upload redirects early to `/extract` (perceived speed) — keep concept, fix backend async.
- BasicInfo debounced silent save + some optimistic cache patches — **extend this pattern**.
- React Query stale defaults (`refetchOnMount: false`) reduce accidental refetch storms for portal jobs/apps.
- AuthGuard already exempts upload/extract from GlobalLoader — **extend exemption philosophy** to more routes with skeletons.
- Parser has real post-processing (city/country derive, validation, junk filter) — improve, don’t delete.

---

## 11. Related docs (context only; this file is the ChatGPT handoff)

| Doc | Notes |
|-----|-------|
| `hrayntra_aws/docs/phase1_complete_audit.md` | Broader CTO audit; §9 performance; scores 58/50 |
| `hrayntra_aws/AUDIT_PHASE_1.md` | Backend-centric; FE outside monorepo |
| `hrayntra_aws/docs/OPENAI_FEATURES_PHASE1_PHASE2.md` | AI feature map |
| `hrayntra_aws/docs/PHASE1_PHASE2_API_PARAMETER_REFERENCE.md` | API params; confirms no `frontphase1` |
| `jobportal_himanshu/FRONTEND_ANALYSIS.md` | Older FE notes |
| `hrayntra_aws/CANDIDATE_PERFORMANCE.md` | **Phase 2 CRM** candidate list scale — not portal FE |

---

## 12. Prompt for ChatGPT (copy-paste)

Use this document as ground truth and produce:

1. **A phased speed roadmap** (P0 / P1 / P2) for Phase 1 only (`jobportal_himanshu` + `backend1`).
2. For each item: **problem → target UX → concrete code changes → acceptance metrics** (e.g. “dashboard interactive &lt; 1.5s on warm cache”, “modal save &lt; 400ms without full GET”, “CV parse p95 &lt; 8s with queue”).
3. **Minimal-loading design system** rules: when GlobalLoader is allowed vs skeleton vs cached paint vs optimistic.
4. **Auth bootstrap redesign**: slim `/me` vs full profile; what fields are required for first paint.
5. **Save protocol**: section PATCH response shape; client cache patch; when to invalidate Query keys.
6. **CV parse redesign** for speed **and** accuracy:
   - async job + status (keep `/extract` UX)
   - timeouts, provider strategy, chunking vs single mega-prompt
   - validation/eval harness for name, email, phone, DOB, gender, city, country, skills, last job
   - how to avoid double extract + double AI (`analyzeCV`) without losing quality
7. **Bundle strategy** for mega pages (dynamic import map).
8. **Do not** propose Phase 2 CRM list-merge work unless it directly speeds Phase 1 portal.
9. Prefer incremental PRs over a rewrite.
10. Call out security issues only if they block the speed work; otherwise keep focus on performance.

---

## 13. One-line condition summary

> Phase 1 feels slow mainly because **full-profile auth + GlobalLoader**, **mega unsplit pages**, **large job fetches (200–500)**, **modal saves that re-GET the entire profile**, **no Redis**, and a **synchronous multi-provider CV parse** (huge token budget, no timeout, duplicate extract + secondary AI) — while a few caches and progressive explore/upload UX already show the right direction to extend.

---

*End of Phase 1 speed-condition audit. Generated for optimization planning, 2026-09-18.*
