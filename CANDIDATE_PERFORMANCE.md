# HRYANTRA Phase 2 — Candidate Performance (Search, Indexes, Scale, Report)

**Date:** 2026-09-18  
**Single source of truth** for candidate list/search/pagination performance.  
Supersedes: `CANDIDATE_SEARCH_PERFORMANCE.md`, `CANDIDATE_INDEX_STRATEGY.md`, `CANDIDATE_PERFORMANCE_REPORT.md`, `CANDIDATE_SCALE_ARCHITECTURE.md`, `CANDIDATE_INDEXES.md`.

**Ops script:** `backendphase2/scripts/ensure-candidate-search-indexes.mjs`  
(creates indexes, backfills `nameNormalized` + `nameSearchGrams`, explain + micro-bench)

---

## 1. Scale architecture (bounded k-way merge)

### Why the full merge existed

| Source | Why loaded | Typical size |
|--------|------------|--------------|
| **Tenant `candidates`** | CRM-owned profiles (primary) | Can be 100k–1M+ |
| **Portal `candidates`** | Job-portal applicants linked to tenant jobs | Usually ≪ tenant, but unbounded |
| **`candidateCommon` (Phase 1)** | Verified discovery pool when `includeCommonPool` | Already capped (~5k) |

Global “newest 50” across **three Mongo DBs** cannot be one Prisma `skip/take`.

### Selected: Option C — Bounded k-way merge

> Global top **K** ⊆ union(top **K** of each source).

```text
K = min(resolveCandidateListK(skip, limit, search), CANDIDATE_LIST_MAX_K)
Fetch top K tenant + portal + common
Merge + dedupe in Node (≤ 3K lean rows)
Sort → slice page → hydrate only page IDs
```

| Request | Max lean rows in Node |
|---------|------------------------|
| Page 1, limit 50 | ≤ 150 |
| Page 20, limit 50 | ≤ 3 × ~1000 |
| Beyond MAX_K window | K capped; **last safe window** returned (not empty, not 100k fetch) |

**Never** load 100k–1M lean rows for a normal list request.

Rejected for now: cross-DB `$unionWith` (separate DBs); projection collection (deferred sync work).

### Authorization order (unchanged)

```text
Auth → tenant ALS → where (soft-delete, CRM, mine/visibility, org, search, filters)
     → DB take K per source → bounded merge → hydrate page
```

No “search globally then authorize in Node.”

### Totals

1. `tenantTotal = count(tenant where)` — exact  
2. Portal-only ids (capped scan) not in tenant  
3. Common-only ids (bounded take) not in tenant  
4. Short-lived count cache (~45s), keyed by tenant/user/filters/search — no cross-tenant leak  
5. No fake totals

### Cache

No full merged-index cache. Count TTL only. Correctness from DB-first bounded fetch.

---

## 2. Search architecture

```text
User types
  → 350ms debounce (FE)
  → min length ≥2 for name/general (id/email/phone exempt)
  → classifyCandidateSearch
        id | email | phone | name | general
  → Authorization scope AND Filters
  → Indexed / gram / narrow DB query
  → Sort + LIMIT (take K)
  → Bounded merge → ~25–50–100 rows → table
```

| Kind | Detection | Fields |
|------|-----------|--------|
| `id` | 24-hex ObjectId | `id` only |
| `email` | contains `@` | `email`, `linkedIn` |
| `phone` | ≥7 digits, phone-like | `phone` |
| `name` | letters / spaces | `nameNormalized` prefix, `firstName`/`lastName` prefix, **`nameSearchGrams`** (mid-string), contains fallback |
| `general` | mixed | identity + title/company/designation/skills — **not** `cvSummary` |

### Mid-string name without Atlas (solved)

`nameSearchGrams` stores 2–3 character n-grams of the normalized name.  
Search `"man"` → `{ nameSearchGrams: { has: "man" } }` → **multikey IXSCAN**.  
Preserves UX: `man` finds `Himanshu`. Atlas Search remains **optional**, not required.

### Prisma → Mongo

`contains` / `startsWith` + insensitive → `$regex`. Prefix and gram `has` can use indexes; leading-wildcard alone cannot.

---

## 3. Index strategy

### Schema indexes (`Candidate`)

| Fields | Query | Reason | Benefit | Write cost |
|--------|-------|--------|---------|------------|
| `[email]` | Email classifier | Email lookup | Avoid email COLLSCAN | Low |
| `[phone]` | Phone classifier | Phone lookup | Avoid phone COLLSCAN | Low |
| `[nameNormalized]` | Name prefix | Lowercased full name | Prefix IXSCAN | Low + backfill |
| `[nameSearchGrams]` | Mid-string name | N-gram multikey | Mid-string IXSCAN w/o Atlas | Med + backfill |
| `[firstName, lastName]` | Name prefix/eq | Interim + schema | Prefix IXSCAN | Low |
| `[stage]`, `[source]` | Filters | Table filters | Selectivity | Low |
| `[isDeleted]` | Soft-delete | Every list | Narrow active | Low |
| `[isDeleted, updatedAt]` | List + sort + take K | Primary list | Sort+limit IXSCAN | Med |
| `[isDeleted, createdAt]` | Alternate sort | Export | Same | Med |
| `[status]`, `[assignedToId]`, `[createdById]`, `[orgUnitId]` | RBAC / filters | Existing | Visibility | Low |

**Do not add** blind indexes on `cvSummary`, `location`, `education` for list search.

### Apply / backfill (solved)

```bash
cd backendphase2
node scripts/ensure-candidate-search-indexes.mjs --tenants=YOUR_TENANT --bench
# or: --discover   (lists DBs; skip empty DBs / Atlas 500-collection limit)
```

Script:

1. Creates the indexes above on each DB that **already has** a `candidates` collection  
2. Backfills `nameNormalized` + `nameSearchGrams`  
3. Prints explain plans + micro-benchmarks  

Create/update/materialize paths maintain both fields on write.

**Atlas note:** Creating indexes on a DB with **no** `candidates` collection can fail with “500 collections of 500”. Script skips missing collections. Run on tenant DBs that already store candidates.

### Sort

`updatedAt DESC`, `createdAt DESC` + `isDeleted ≠ true` → supported by `[isDeleted, updatedAt]` once deployed.

---

## 4. Deep pagination (solved UX)

- Env: `CANDIDATE_LIST_MAX_K` (default **2500**)  
- Search keeps a smaller K via `resolveCandidateListK`  
- If `skip + limit > MAX_K`: **clamp to the last safe window inside the merged top-K** (still returns rows; does not grow K toward 100k; totals stay real)  
- Cursor pagination deferred; numbered UX retained  

---

## 5. Explain findings (measured)

**Method:** Mongo `explain` via Prisma `$runCommandRaw`  
**DB:** `jobportal` on `DATABASE_URL` after `ensure-candidate-search-indexes.mjs`

| Query intent | Winning stages |
|--------------|----------------|
| Active list + sort (`isDeleted` + `updatedAt`) | **SORT > FETCH > IXSCAN** |
| Email contains | **IXSCAN** |
| Phone contains | **IXSCAN** |
| `nameNormalized` prefix | **IXSCAN** |
| `nameSearchGrams` has (`man`) | **IXSCAN** |
| `firstName` prefix | **IXSCAN** |

Before deploy (same cluster): list/phone/`nameNormalized` were **COLLSCAN**. That gap is closed on DBs where the script ran successfully.

---

## 6. Benchmark results (measured)

Dataset on probed `jobportal`: **4** candidates (small). Timings are wall-clock Prisma `findMany` on that DB — **not** synthetic 100k/1M load.

| Operation | Time | Notes |
|-----------|------|-------|
| First page (take 50, active) | **11 ms** | `n=0` active after soft-delete filter |
| Name prefix / Himanshu path | **15 ms** | |
| Mid-string grams (`man`) | **18 ms** | IXSCAN path |
| Email contains | **14 ms** | |
| Page-20 window (take 1000) | **11 ms** | |
| Heap delta (bench process) | **~239 KB** | Approximate |

| Dataset size | Status |
|--------------|--------|
| 10k / 100k / 500k / 1M synthetic | **Not loaded in this environment** — re-run script after seeding; architecture remains O(K) |

Payload: slim list include retained (no deep history on list). Detail stays lazy-loaded.

---

## 7. Node memory & perf logging

List path memory is **O(K)** (`K ≤ CANDIDATE_LIST_MAX_K`).  

Enable: `CANDIDATE_PERF_LOG=1` or `NODE_ENV=development`

```text
[CandidatePerformance] searchKind=… K=… sourceCounts=… tenantQuery=…ms merge=…ms fetched=… memoryDeltaKb=… totalMs=…
```

No PII.

---

## 8. Frontend

- Debounce **350ms**  
- `candidateSearchGate.ts`: ≥2 chars for name/general  
- `employerPageCache` keys: tenant/user/org + tab/page/limit/search + **filterSig**  
- Max page size **100**; no virtualization  

---

## 9. Security verification

| Check | Status |
|-------|--------|
| Search after auth scopes | YES |
| No global search then Node filter | YES |
| Count cache scoped | YES |
| Soft-deleted excluded | YES |
| Mine / company / portal / common bounds | YES |
| Detail lazy-loaded | YES |
| No N+1 on list hydrate | YES |

---

## 10. Limitations closed vs remaining

| Former limitation | Status |
|-------------------|--------|
| Deploy indexes per tenant | **Solved** — script + run on DBs with `candidates` |
| Backfill `nameNormalized` | **Solved** — script + write-path |
| Mid-string COLLSCAN without Atlas | **Solved** — `nameSearchGrams` multikey IXSCAN |
| Extreme deep pages empty | **Solved** — clamp to last safe window |
| Load-test timings unmeasured | **Partial** — real ms on current DB; large synthetic N not present |
| Atlas 500-collection limit on empty DBs | **Documented** — skip missing collections; run on live tenant DBs |
| `getStats` / non-list endpoints | Out of scope |

---

## 11. Acceptance checklist

| Requirement | Status |
|-------------|--------|
| No unbounded candidate merge | YES |
| Search classified + DB/gram optimized | YES |
| Search authorization-scoped | YES |
| First / normal pages bounded | YES |
| Deep pagination safe | YES (MAX_K + last-window clamp) |
| Lightweight list payload | YES |
| Detail lazy-loaded | YES |
| Mongo plans inspected | YES (IXSCAN after deploy) |
| RBAC/tenant preserved | YES |
| Benchmarks | Measured on current DB; large-N not fabricated |

---

## 12. Key files

- `backendphase2/prisma/schema.prisma` — `nameNormalized`, `nameSearchGrams`, indexes  
- `backendphase2/src/modules/candidate/candidate.service.js` — classifier, grams, K clamp, count cache, perf logs  
- `backendphase2/src/services/candidateCommon/candidateCommonPool.service.js` — classified common search  
- `backendphase2/scripts/ensure-candidate-search-indexes.mjs` — indexes + backfill + explain + bench  
- `frontphase2/src/lib/candidateSearchGate.ts`  
- `frontphase2/src/lib/employerPageCache.ts`  
- `frontphase2/src/app/candidate/page.tsx`  
- **This file:** `CANDIDATE_PERFORMANCE.md`
