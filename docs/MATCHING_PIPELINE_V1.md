# HR Job–Candidate Matching Pipeline v1.0 — Audit

This document describes the **4-pass matching pipeline** integrated into **phase 2** (`backendphase2` + `frontphase2`): what changed, which files are involved, how data flows, and how to verify it.

## Goal

For a **single selected OPEN job**, evaluate **all eligible tenant candidates** (same Prisma database as the rest of phase 2), score each pair with **four parallel passes**, merge with **dynamic weights**, generate **LLM suggestions** for pairs above the minimum score, apply **threshold + soft filters**, persist **`Match.evaluation`**, and return the existing **`BackendMatch`** list shape for the Matches UI.

## End-to-end flow

1. **Frontend** (`frontphase2/src/app/matches/page.tsx`): On the **AI Matches** tab, when a job is selected, `apiGetMatches` is called with `source: 'ai'`, `jobId`, `limit: 100`, and **`minScore: 60`**. The header **Refresh** control passes **`refresh: '1'`** so the backend **re-runs** the pipeline (bypasses the 24h cache).
2. **Backend** (`backendphase2/src/modules/match/match.service.js`): For `source === 'ai'` and a `jobId`, **`runMatchPipeline`** from `matchPipelineRunner.cjs` runs **before** listing matches. Then Prisma returns AI matches with `createdById: null`, **`score >= minScore`** (default **60** when `minScore` is omitted), mapped through **`mapMatchRecord`**, which merges **`match.evaluation`** into **`explanation`** and **`explanation.aiEngine`** (breakdown, weights, suggestion, `runId`, formula).
3. **Pipeline** (`matchPipelineRunner.cjs`): Stages 0–6 — load job + candidates, normalize/map profiles, run passes 1–4 **in parallel per candidate** (with a **concurrency pool**), merge scores, batch **suggestions**, **`applyThreshold`**, **delete** non-rejected AI matches for the job, **create** new rows with **`evaluation`**, structured logs via **`stageLogger.cjs`**.

## 24-hour cache

If **`forceRefresh`** is false (no `refresh=1` / `forceRefresh=1` on the request), the runner checks existing AI matches for the job: if **`computedAt`** on stored evaluation is **&lt; 24h** and match count **≥** eligible candidate count, the heavy pipeline is **skipped** (fast path; see server logs for cache hit).

## Files added (backend)

All under `backendphase2/src/services/jobMatchEngine/`:

| File | Role |
|------|------|
| `stageLogger.cjs` | Human-readable stage and per-pair logs (including optional candidate snapshot on pair logs). |
| `pass1SkillsMatch.cjs` | Deterministic required/preferred skills + adjacency bonus. |
| `pass2ExperienceMatch.cjs` | Parsed experience range, years/seniority/domain scoring. |
| `pass3SemanticMatch.cjs` | Section-weighted embeddings (OpenAI primary, Mistral fallback, shared embedding cache from `pipeline.cjs`). |
| `pass4CulturalFit.cjs` | JSON cultural dimensions via `llmChatFallback.service.js`. |
| `scoreMerger.cjs` | Weighted merge; adjusts weights when cultural is skipped or semantic is neutral. |
| `suggestionEngine.cjs` | Batched recruiter suggestions via chat completion + JSON parse. |
| `thresholdFilter.cjs` | Location/employment penalties, salary **flag** (no score drop), min score, band sort. |
| `matchPipelineRunner.cjs` | Orchestrator; **exported** `runMatchPipeline`. |

## Files modified

| Area | File | Change |
|------|------|--------|
| Schema | `backendphase2/prisma/schema.prisma` | `Match.evaluation Json?` for full pipeline payload. |
| Engine | `backendphase2/src/services/jobMatchEngine/pipeline.cjs` | Exposes shared embedding cache for pass 3 (no duplicate caches). |
| API | `backendphase2/src/modules/match/match.service.js` | Runs **`runMatchPipeline`** for AI tab; default **`score >= 60`** for AI when `minScore` omitted; **`mapMatchRecord`** reads **`evaluation`** into **`explanation.aiEngine`**; **removed** legacy per-row **`scoreRecruiterCandidateAgainstJob`** enrichment for the list endpoint. |
| Frontend API | `frontphase2/src/lib/api.ts` | **`apiGetMatches`**: optional **`refresh`**, **`forceRefresh`**; **`BackendMatch.explanation.aiEngine`** extended (weights, suggestion, `runId`, formula, typed breakdown). |
| Matches UI | `frontphase2/src/app/matches/page.tsx` | AI requests send **`minScore: 60`**; Refresh sends **`refresh: '1'`** on the AI tab. |
| UI | `frontphase2/src/components/matches/AIAnalysisPanel.tsx` | **Pass breakdown** table (Pass / Score / Weight) when pipeline weights + breakdown are present; optional formula line. |
| Types | `frontphase2/src/components/matches/types.ts` | Align **`aiEngine`** with API extensions. |

## LLM and API usage

- **Pass 3 (semantic):** Job embeddings **pre-computed once**; candidates scored in **batches of 3** with **500ms** pause between batches (`MATCH_EMBED_BATCH_SIZE`, `MATCH_EMBED_BATCH_PAUSE_MS`). Up to **4 concurrent** embedding HTTP calls (`MATCH_EMBED_CONCURRENCY`) with 429 retries — no per-call 350ms sequential delay. OpenAI `text-embedding-3-small` first; Mistral `mistral-embed` fallback; then **lexical overlap** if APIs fail.
- **Pass 4 logs:** `[pass4] Candidate: X → Cultural score: Y → source: llm-response|default-fallback|skipped`.
- **Stage 5 logs:** `[stage5] Threshold: 60 — candidates above: N of 32` (before/after penalties).
- **Pre-flight:** `jobPoolValidation.cjs` logs required skills vs pool (% with skill hits) and warns when most candidates are a poor fit for the job title.
- **Pass 4 (cultural):** `llmChatFallback.service.js` — OpenAI chat first, Mistral chat on failure; skipped when culture text is empty.
- **Suggestions:** Same chat fallback as Pass 4; template fallback on parse errors.

Primary provider is **OpenAI** where configured; **Mistral** is used as fallback where implemented (embeddings / shared chat fallback layer).

## Display rules (HR Matches UI)

- **All scored candidates** are persisted and returned (not only score ≥ 60).
- UI groups candidates: **100–80**, **80–60**, **Below 60**.
- Pipeline runs only when `runPipeline=1` (first AI tab visit per job per session, or Refresh with `refresh=1`).
- List fetches without `runPipeline` reload cached `Match` rows instantly.

## How to test

1. Ensure **`OPENAI_API_KEY`** (and optionally **`MISTRAL_API_KEY`**) are set in `backendphase2/.env`.
2. Run **`npx prisma generate`** (and **`npx prisma db push`** if the DB does not yet have `evaluation` on `matches`). If `prisma generate` fails with **EPERM** on Windows, stop the Node process that locks `.prisma\client` and retry.
3. Open **Matches**, **AI Matches**, select an **OPEN** job with several candidates.
4. Call or trigger: `GET /matches?jobId=<id>&source=ai` — watch backend logs for stages 0–6.
5. Call again without **`refresh=1`** within 24h — should hit cache (fast).
6. Inspect DB: `matches` rows for that job should include **`evaluation`** with `pass1`–`pass4`, `finalScore`, `band`, `weights`, `suggestion`, `runId`, `computedAt`.

## Tenant / “all databases” note

The pipeline uses the **same Prisma `DATABASE_URL`** as the rest of phase 2 for that deployment. It does **not** aggregate candidates across unrelated tenant databases; multi-tenant isolation follows your existing backend connection and middleware.

---

*Generated as part of the Matching Pipeline v1.0 implementation audit.*
