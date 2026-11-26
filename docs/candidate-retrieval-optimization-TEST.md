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
6. Mine lists stay **user-scoped**. All lists are **per user** too, except full-access Super Admins who share one entry (see "Visibility safety" below — the earlier "shared across same permission fingerprint" design was unsafe and was replaced)

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
3. Press **Compare: no cache vs cached** — steps 3–5 should show `L1_HIT`, 0 Mongo operations and a much lower ms.  
4. Open All Candidates as a second recruiter in the **same** org — gets its **own** entry (first load MISS, then L1_HIT). Only full-access Super Admins share an entry.  
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

## Completion report (testing)

### Files created
- `backendphase2/src/services/candidateRetrieval/*` — engine, L1/L2, keys, coalescer, version, invalidation, metrics
- `backendphase2/src/modules/candidatePerformance/*` — secured perf APIs
- `frontphase2/src/app/candidate-speed/*` + `frontphase2/src/app/candidate/speed/page.tsx`
- `frontphase2/src/components/candidate-speed/CandidateSpeedDashboard.tsx`
- `frontphase2/src/lib/api/candidatePerformance.ts`
- `docs/candidate-retrieval-optimization-TEST.md`

### Files modified
- `backendphase2/src/modules/candidate/candidate.controller.js` — optional cache wrapper + invalidation hooks
- `backendphase2/src/app.js` — mount `/api/v1/candidate-performance`

### Architecture
Organization-scoped L1 (process memory LRU) → L2 (optional Redis) → single-flight coalescer → existing `candidateService.getAll`. Cache keys include env namespace, tenantId, visibility, tab, permission hash, filter hash, sort, page, limit, org version. Mine stays user-scoped; All is shared for the same permission fingerprint.

### Cache / env
- Flags: `CANDIDATE_ORG_CACHE_ENABLED`, `CANDIDATE_ORG_CACHE_ENV=test`, `CANDIDATE_ORG_CACHE_TTL_SEC`, `CANDIDATE_PERF_ENABLED`
- Redis optional via existing `REDIS_*`; fail-open to Mongo when unavailable

### Invalidation
Candidate create/update/delete bumps org version and clears org key prefix (L1 + L2 pattern).

### Mongo indexes
No production indexes added. Recommend evaluating compound indexes on tenant Candidate + common pool verified/updatedAt only after `explain` on test data.

### APIs
`GET/POST /api/v1/candidate-performance/{overview,cache-stats,history,run-test,concurrency-test,cache-refresh,cache-clear,reset-stats}`

### Before/after
Measure on test via `/candidate/speed` Cold→warm: warm should be L1/L2 hit with near-zero Mongo ops. Absolute ms depends on test dataset size.

### Limitations
Count/common-index Redis caches, distributed lock across multi-instance, and background warmer are deferred. Neighbor prefetch still stubbed.

### Deploy (test only)
1. Merge/push `speed-proven-phase2`  
2. Set env vars on **test** backend only  
3. Restart test backend  
4. Validate dashboard + list flows  
5. Do **not** enable on production until accepted

### Rollback
Disable `CANDIDATE_ORG_CACHE_ENABLED` and restart.

---

## Update: making the real Candidates tab fast (in-process caching first, Redis later)

**Stats live only on `/candidate-speed` (and `/candidate/speed`).** The Candidates tab shows nothing extra;
`GET /api/v1/candidates` only adds two tiny response headers (`X-Candidate-Cache`, `X-Candidate-Cache-Ms`).
Add request header `x-candidate-perf: 1` to receive the full `_retrievalPerf` object in the body.

### What changed
- **Bug fix (the reason the tab stayed slow):** the combined list (All + Phase 1 common pool) was being flagged
  "degraded" on every request because a query-budget timer fired even when the query had finished in time, so the
  result was never cached. Timers are now cleared and only count if they actually win the race. Measured on `adm01`
  after the fix: cold 2.7 s -> warm 0-1 ms, 0 Mongo operations.
- **Invalidation covers every write path:** one middleware (`candidateCacheInvalidation.middleware.js`, mounted after
  the tenant context) invalidates the active organization after any successful POST/PUT/PATCH/DELETE on candidates,
  CV, jobs, matches, pipeline, interviews, placements, users/team/roles/permissions/departments/org units, portal
  sync and the three discovery-affecting org settings. The local version bump and L1 clear happen synchronously just
  before the response is flushed (no stale read after a save); Redis cleanup + warm-up follow. Stage changes and HQ
  module toggles also invalidate from their services (non-HTTP callers).
- **Stale-while-revalidate:** an expired entry is served instantly (`L1_STALE`) while it is rebuilt in the background
  (`CANDIDATE_ORG_CACHE_STALE_SEC`, default 300; combined views max 120).
- **Refresh-ahead warm-up:** after an invalidation the most recently used views are rebuilt in the background
  (`CANDIDATE_ORG_CACHE_WARM`, default on; `CANDIDATE_ORG_CACHE_WARM_TOP`, default 3).
- **Degraded results are never cached** (a time-budget fallback fired).
- **Single-flight** (coalescing) for concurrent identical misses.
- **Real Mongo operation counts** per request (Prisma middleware + AsyncLocalStorage). `docsExamined` is always N/A.
- **Redis is optional** and fully fail-open (circuit breaker, `SCAN` instead of `KEYS`, 2 s connect timeout).
- **Opt-in login-check memory** `AUTH_LOCAL_CACHE_TTL_SEC` (default 0 = off, max 120): remembers the user row, passed
  session check and permission set in process memory. Cleared by the same `deleteCache`/`deleteCacheByPattern` events
  that already clear the Redis copies (logout, new login, role/team edits). Only successful lookups are stored.
  Staleness is bounded by the TTL; per process. Recommended locally: 15.

### Visibility safety (permission fingerprint)
Visibility is resolved from Mongo (home org unit, `hierarchyPurpose`, `switch_companies`, org unit / side), so two users
with identical permissions can legitimately see different candidates. Therefore:
- only full-access Super Admins share an "All" entry (`sa:` scope);
- everyone else (and every "Mine" view) gets a per-user entry;
- permissions are read from `req.userWithPermissions` (the middleware-resolved value), not `req.user`.

### Env flags
| Flag | Default | Meaning |
|---|---|---|
| `CANDIDATE_ORG_CACHE_ENABLED` | off | master switch |
| `CANDIDATE_ORG_CACHE_ENV` | `test` | key namespace |
| `CANDIDATE_ORG_CACHE_TTL_SEC` | 60 | fresh window |
| `CANDIDATE_ORG_CACHE_STALE_SEC` | 300 | extra window served stale while refreshing |
| `CANDIDATE_ORG_CACHE_WARM` / `_WARM_TOP` | on / 3 | refresh-ahead |
| `CANDIDATE_ORG_CACHE_L1_MAX` / `_L1_MAX_MB` | 400 / 64 | L1 bounds (count / bytes) |
| `CANDIDATE_PERF_ENABLED` | off | enables `/candidate-performance/*` |
| `AUTH_LOCAL_CACHE_TTL_SEC` | 0 | opt-in login-check memory |
| `PRISMA_BLOCK_WRITES` | off | refuse every Prisma write (read-only measurement runs) |

### Dashboard (`/candidate-speed`)
"How to read this page" explains every button, every result label and 8 button combinations with the expected
outcome. Sections: status cards (cache, org, version, memory, Redis, warm-up, login-check memory), **Live Candidates
tab** (real traffic only), Run a test (All / Mine presets, one-click **Compare**, **Concurrency** with "Start cold",
Clear cache, Reset stats), result cards with real Mongo operation breakdown, and a history table filterable by
Live / Tests.

### Tests
`npm run test:candidate-cache` (30 tests: key collisions, L1 stale/bounds/prefix isolation, per-org metrics, auth
memo invalidation, invalidation middleware incl. "entry already gone when the response is flushed").

### Measured (read-only, `adm01`, `PRISMA_BLOCK_WRITES=1`, no Redis)
| Scenario | Result |
|---|---|
| No cache (original path) | ~3.4 s, 26 Mongo ops |
| First cached load (MISS) | ~2.8 s, 27 ops |
| Repeat cached loads | 0-1 ms, 0 ops (L1_HIT) |
| 10 simultaneous cold | 1 MISS + 9 COALESCED, 27 ops total |
| 20 simultaneous warm | 20 L1_HIT, 0 ops |
| After a mutation | MISS once, then L1_HIT |
| Permission lookup | 156 ms/1 op first, 0 ms/0 ops repeat (memo on) |

Not measured: Redis L2 (not configured here), multi-instance behaviour, `L1_STALE` timing against the real DB, and
browser/network time (the numbers are server-side list time).
