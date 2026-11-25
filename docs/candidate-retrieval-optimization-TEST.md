# Candidate Retrieval Optimization (TESTING ONLY)

Branch: `speed-proven-phase2` (do not enable on production until validated).

## Audit summary (verified)

| Topic | Finding |
| --- | --- |
| List API | `GET /api/v1/candidates` → `candidate.controller.getAll` → `candidateService.getAll` |
| Common pool | Separate Mongo DB via `getCandidateCommonPrismaClient()` (`candidatecommon`) |
| Ownership | Tenant `Candidate` collection = org-owned; Phase 1 rows merge when `phase1CommonPoolEnabled` |
| Mine tab | Never loads common pool (`loadCommonPool = false` when `mine=true`) |
| Existing cache | In-memory **count** cache (user-scoped) in `candidate.service.js`; Redis used for team list / locks |
| Redis | `backendphase2/src/cache/redis.js` — optional via `REDIS_URL` / `REDIS_HOST` |
| Frontend | `frontphase2/src/app/candidate/useCandidateList.ts` — 45s visible poll, silent refresh, neighbor prefetch |
| Docker | `docker-compose.example.yml` has no Redis service — add separately for L2 in test |

## What was implemented

1. Org-aware L1 (memory) + L2 (Redis) list cache with versioned keys  
2. Single-flight coalescing for identical in-process requests  
3. Invalidation on candidate create/update/delete (version bump)  
4. Feature flag — off unless enabled in test env  
5. `/candidate-speed` dashboard + `/api/v1/candidate-performance/*`  
6. Mine lists stay **user-scoped**; All lists shared across same permission fingerprint

## Enable on test backend `.env`

```env
CANDIDATE_ORG_CACHE_ENABLED=1
CANDIDATE_ORG_CACHE_ENV=test
CANDIDATE_ORG_CACHE_TTL_SEC=60
CANDIDATE_PERF_ENABLED=1
# Optional L2:
REDIS_URL=redis://127.0.0.1:6379
# or REDIS_HOST / REDIS_PORT / REDIS_PASSWORD / REDIS_DB
```

Restart backendphase2 after setting env.

## How to test

1. Log into the **testing** tenant as a recruiter with candidates access.  
2. Open **`/candidate/speed`** (preferred; inherits Candidates layout/auth) or `/candidate-speed`.  
3. Run **Cold → warm compare** — second request should show `L1_HIT` or `L2_HIT` and lower ms.  
4. Open All Candidates as a second recruiter in the **same** org — should hit shared cache (All, same permissions).  
5. Confirm a **different** org does not see the first org’s data (separate `tenantId` in keys).  
6. Upload/update/delete a candidate — cache version bumps; next list is a miss then refill.  
7. Stop Redis — app must still list candidates (fail-open).

## Audit notes (follow-up)

From backend + frontend audits:

- Common pool is **opt-in** via `includeCommonPool=true` (+ HQ `phase1CommonPoolEnabled`). Cache keys now mirror that (missing flag = private).
- Neighbor page prefetch in `useCandidateList` is documented but **not implemented** — safe future win once list cache is warm.
- Compose has no Redis/Mongo services; L2 needs explicit `REDIS_*` on the test host.
- Next high-ROI cache targets (not yet done): Redis for `countMergedCandidateListTotal` and `fetchCandidateCommonListIndex`.

## Cache key shape

`candidate:{env}:{tenantId}:{visibility}:{tab}:{permHash}:{filterHash}:{sort}:{page}:{limit}:v{version}`

## Rollback

Unset `CANDIDATE_ORG_CACHE_ENABLED` (or set `0`) and restart. List API falls back to legacy `candidateService.getAll` with no cache wrapper behavior change beyond optional `_retrievalPerf` when enabled.
