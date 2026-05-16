# HR job–candidate matching — Phase 2 adapted specification

**Version:** 1.0 (Phase 2 CRM)  
**Stack:** `hrayntra_aws/frontphase2` (Matches UI) + `hrayntra_aws/backendphase2` (API, Prisma, job match engine)  
**Related:** Generic design doc “HRJob+Candidate Matching Pipeline v1.0” (4 parallel passes, 30/25/30/15 weights). This document **maps that intent to what the codebase and database actually implement today**, and defines how to close gaps.

---

## 1. Purpose

- Drive the **Matches** experience: recruiters pick a job, switch **AI** vs **Manual**, review ranked candidates, expand AI analysis, pipeline/submit/reject.
- Optionally expose the same match payload to other clients (future REST contract).

---

## 2. End-to-end flow (as implemented)

| Step | Where | Behavior |
|------|--------|----------|
| Load open jobs | `frontphase2` → `apiGetJobs({ status: 'OPEN' })` | Mapped to `MatchJob` (`skills`, `preferredSkills`, `experienceRequired`, location, client). |
| Load matches | `GET /matches?jobId=&source=ai\|manual&limit=` | `match.service.js` → Prisma `Match` + `Candidate` + `Job`. |
| AI tab enrichment | `match.service.js` when `source === 'ai'` | Loads full job + extended candidate; calls `scoreRecruiterCandidateAgainstJob` from `src/services/jobMatchEngine/pipeline.cjs`; merges `finalScore`, explanation text, `matchedSkills` / `missingSkills`, `aiEngine` block via `mergeRecruiterAiEngineIntoRow`. Parallelism: **4** concurrent scoring calls per request batch. |
| Manual tab | Same endpoint, `source=manual` | Rows where `createdById` is set; **no** `pipeline.cjs` re-score on list; explanation from `buildExplanation` (skill overlap vs job `skills`, rough experience/location/salary flags). |
| Applied candidates (no `Match` row) | `matches/page.tsx` | Merged from `apiGetCandidates`; score from linked match or `computeAppliedCandidateScore` (client-side ~70% skills + ~30% experience vs parsed `experienceRequired`). |

**Key code references**

- UI: `frontphase2/src/app/matches/page.tsx`, `frontphase2/src/components/matches/types.ts`, `AIAnalysisPanel.tsx`, `CandidateCard.tsx`
- API: `backendphase2/src/modules/match/match.service.js`
- Engine: `backendphase2/src/services/jobMatchEngine/pipeline.cjs`, `mapPhase2Candidate.cjs`, `job-normalization.cjs`, `feature-extraction.cjs`
- LLM fallback: `llmChatFallback.service.js` (used by `pipeline.cjs` via `jobMatchChatCompletion`)

---

## 3. Database source of truth (Prisma)

### 3.1 `Job` (`jobs`)

Fields **most relevant** to matching:

| Field | Type / notes |
|-------|----------------|
| `id`, `title` | Identity |
| `description`, `overview` | Long text for semantic / LLM context |
| `requirements` | `String[]` |
| `skills`, `preferredSkills` | `String[]` — primary structured skill inputs |
| `experienceRequired` | `String?` — **free text**, not min/max integers (frontend parses ranges heuristically) |
| `keyResponsibilities` | `String[]` |
| `location`, `workMode`, `jobLocationType` | Location / hybrid / remote |
| `type` | `JobType` enum (`FULL_TIME`, …) |
| `department`, `education`, `benefits` | Classification / JD richness |
| `salary` | `Json?` — budget band (app-defined shape) |
| `status` | `JobStatus` — pipeline should only use `OPEN` (plus product rules) |
| `clientId`, `assignedToId`, `createdById` | Ownership / visibility |

**Gap vs generic v1.0 doc:** no dedicated `cultureNotes`; use **`overview` + `description` + `benefits`** (or extend schema later).

### 3.2 `Candidate` (`candidates`)

| Field | Type / notes |
|-------|----------------|
| `firstName`, `lastName`, `email`, `phone` | Identity / contact |
| `skills`, `recruiterSkills` | `String[]` — merged for engine input |
| `experience`, `experienceYears` | Numbers used in scoring |
| `currentTitle`, `currentCompany`, `designation` | Role context |
| `location`, `city`, `country`, `preferredLocation` | Geo fit |
| `cvSummary`, `notes`, `recruiterNotes` | **Resume-ish text** for LLM (engine uses slice of `cvSummary` \|\| `notes` \|\| `recruiterNotes`, ~6000 chars) |
| `cvWorkExperienceEntries`, `cvEducationEntries` | `Json` — mapped in `mapPhase2Candidate.cjs` |
| `certifications`, `certificationsList`, `education` | Extra signals |
| `expectedSalary`, `salary` | Expectation vs job budget (heuristic in `buildExplanation` / engine) |
| `noticePeriod`, `availability` | Ops fit |
| `status` | `CandidateStatus` enum |
| `assignedJobs` | `String[]` — used to detect “applied” without a match row |
| `hotlist` | Drives “saved” display in list mapping |

**Gap vs generic v1.0 doc:** no dedicated **soft-skills array**; culture/soft signals must be **inferred** from CV text/titles or added later.

### 3.3 `Match` (`matches`) — persistence reality

Persisted today:

- `candidateId`, `jobId`, `score` (Float), `status` (`SUGGESTED` \| `REVIEWED` \| `SHORTLISTED` \| `REJECTED`), `notes`, `createdById`, timestamps.

**Not persisted:** per-pass scores, composite breakdown JSON, recruiter **band** label (`Excellent Fit`, …), long **suggestion** paragraph, **flags** array, **runId**, audit rows for hidden pairs.

Implication: **rich AI breakdown** is recomputed when `GET /matches?source=ai` runs (unless you add columns / side table per plan below).

### 3.4 `Application` (`applications`)

- Unique `(candidateId, jobId)` — canonical “applied to this job” if you migrate off `assignedJobs` string matching.
- `matchScore` — optional stored score at apply time (separate from `Match.score`).

---

## 4. Generic v1.0 design vs Phase 2 engine (`pipeline.cjs`)

| v1.0 concept | Phase 2 today |
|--------------|----------------|
| **Stage 0** — bulk pull all active jobs × all candidates | **On-demand:** matches for **one job** (plus optional candidate fan-out inside service). No standalone Cartesian batch worker in this repo path. |
| **Stage 1** — alias map, section chunking, pair batches of 100 | **Partial:** `job-normalization.cjs`, `feature-extraction.cjs`; batching is **request-scoped** (e.g. concurrency 4), not 100-pair global chunks. |
| **Pass 1** Skills 30% — required/preferred/adjacency formula | **Different:** deterministic overlap in `buildExplanation` + LLM breakdown `skills` (0–40 in system prompt inside `pipeline.cjs`, not 0–70+20+10). |
| **Pass 2** Experience 25% — years + seniority tiers + domain | **Partially covered** by LLM `experience` + `industry` breakdown and heuristics in `buildExplanation` (simplified years check vs string `experienceRequired`). |
| **Pass 3** Semantic 30% — embeddings OpenAI → Mistral, section-weighted cosine | **Partially:** `pipeline.cjs` includes embedding / semantic paths (see file for caches and fallbacks); **not** guaranteed to match v1.0 section weights 0.50/0.35/0.15 exactly. |
| **Pass 4** Culture 15% — five LLM dimensions; skip redistributes weights | **No isolated pass:** culture-like signal may appear inside **single** LLM JSON (`analysis`, summary) or inferred; **no** automatic weight redistribution to 35%/40%. |
| **Stage 3** Merger 30/25/30/15 | **Single `finalScore`** from engine blend + merge into row; internal weights are **engine-defined**, not the v1.0 table unless you refactor. |
| **Stage 4** Suggestion engine (batched 20) | Summary from **`explanationSummary` / `aiAnalysis.summary`** in merge path; not a separate second pass with batch size 20 in contract form. |
| **Stage 5** Hide &lt; 60, bands 60–69 … 90–100 | Engine uses **`MIN_VISIBLE_SCORE = 20`** internally; UI filters are **recruiter-controlled** (`MatchFilters`). Product “hide &lt; 60” is **not** enforced server-side for matches list today. |
| **Stage 6** Webhooks / ATS | **Not** in this path; JSON list to front end only. |

---

## 5. Architecture decision: Option A vs Option B

| Option | Description | When to use |
|--------|-------------|-------------|
| **A — Pragmatic (documentation + UI honesty)** | Treat **`pipeline.cjs`** as the **source of truth** for scoring semantics. Adapt product copy and any internal spec to its breakdown (`skills`, `experience`, `responsibilities`, `industry`, `location`, verdict bands in prompt). | **Now** — matches shipped behavior with minimal risk. |
| **B — Target (v1.0 alignment)** | Reimplement **four explicit passes** with weights **30 / 25 / 30 / 15**, embedding + culture skip rules, threshold **60**, persist full breakdown on `Match` or `MatchEvaluation`. | When product **requires** auditability, recruiter transparency, and stable scores without recomputation. |

**Decision for this repo (recorded):** adopt **Option A** for **runtime behavior and documentation accuracy** immediately; treat **Option B** as the **roadmap** when schema + worker budget are approved.

---

## 6. API / UI contract (Matches page)

### 6.1 Response shape (conceptual)

Each row aligns with `BackendMatch` in `frontphase2/src/lib/api.ts`:

- `score` — integer 0–100 shown as `%` in UI.
- `matchSource` — `'ai' \| 'manual'`.
- `explanation` — `{ skills, experience, location, salary, text, matchedSkills, missingSkills, roleRequirement, aiEngine? }`.
- `explanation.aiEngine` (when present) — `deterministicScore`, `aiScore`, `verdict`, `confidenceLevel`, `confidenceScore`, `breakdown` (record of numeric sub-scores from LLM).

### 6.2 UI extensions (implemented alongside this doc)

- **Fit band** — derived client-side from `score` using product bands aligned with v1.0 (≥90 Excellent … ≥60 Fair; below 60 labeled for internal display when score is shown).
- **Engine panel** — when `aiEngine` is present, show **verdict**, **confidence**, and **breakdown** table so recruiters see *why* (not only headline `%`).

### 6.3 Future: persisted passes (Option B)

Add to Prisma (example): `Match.evaluation Json?` with `{ pass1, pass2, pass3, pass4, finalScore, band, suggestion, flags, engineVersion, runId, computedAt }`. Then list endpoint returns stored JSON without re-running LLM every time.

---

## 7. Thresholds and configuration (recommended alignment)

| Setting | v1.0 default | Phase 2 suggestion |
|---------|--------------|---------------------|
| Recruiter minimum visible score | 60 | Add **`minScore`** query consistently + default 60 for AI tab if product agrees; today `apiGetMatches` supports `minScore` but UI may not default it. |
| Engine floor | N/A | Keep engine internal floor separate from **recruiter** floor to avoid hiding viable rows during tuning. |
| Bands | 90 / 80 / 70 / 60 | Use same labels in UI for consistency with client expectations. |

---

## 8. Implementation backlog (ordered)

1. **Document** — this file (done).
2. **Optional API default** — default `minScore=60` for AI matches list if product confirms.
3. **Schema (Option B)** — `Match.evaluation` or sibling table; write on match creation / batch job.
4. **Worker (Option B)** — nightly or on-publish job: Stage 0 Cartesian product with caps and idempotency by `runId`.
5. **Engine refactor (Option B)** — extract Pass1–4 modules; wire Mistral/OpenAI embedding fallback exactly as compliance needs.

---

## 9. Summary

The **Matches** page **already uses** a sophisticated **AI match engine** for the **AI** tab, backed by real **Job** and **Candidate** fields in MongoDB via Prisma. It does **not** yet implement the generic v1.0 document literally (four persisted parallel passes, 30/25/30/15, hide &lt;60 server-side, culture skip redistribution). Use **this adapted spec** as the single source of truth for Phase 2; use the original v1.0 doc as the **target** if you execute **Option B**.

---

*Last updated: generated with codebase paths under `hrayntra_aws`.*
