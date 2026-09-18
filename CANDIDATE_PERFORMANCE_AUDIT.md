# Candidate Performance Audit — Phase 2

**Date:** 2026-09-18  
**Scope:** HRYANTRA / SAASA Phase 2 Candidate Management (`frontphase2` + `backendphase2`)  
**Goal:** Keep UX identical while making list/search scalable toward 100k–1M+ candidates without scaling servers alone.

---

## 1. Current architecture

| Layer | Path |
|-------|------|
| Page | `frontphase2/src/app/candidate/page.tsx` |
| Table | `frontphase2/src/app/candidate/components/CandidateTable.tsx` |
| Filters | `frontphase2/src/app/candidate/components/CandidateTableFilters.tsx` |
| API client | `frontphase2/src/lib/api.ts` → `apiGetCandidates` |
| List cache | `frontphase2/src/lib/employerPageCache.ts` |
| Routes | `backendphase2/src/modules/candidate/candidate.routes.js` → `GET /api/v1/candidates` |
| Controller | `candidate.controller.js` → `getAll` |
| Service | `candidate.service.js` → `candidateService.getAll` |
| Prisma model | `backendphase2/prisma/schema.prisma` → `Candidate` (`@@map("candidates")`) |

Tenant isolation uses Prisma ALS + existing RBAC helpers (`buildCandidateListVisibilityScope`, `buildMineCandidatesScope`, `applyOrgCompanyAssigneeWhere`, etc.). **Do not remove these.**

---

## 2. Current API flow

```
Candidate page
  → apiGetCandidates({ page, limit, search, filters, mine?, includeCommonPool? })
  → GET /api/v1/candidates
  → candidateController.getAll
  → candidateService.getAll
       ├─ mine=true          → DB count + findMany(skip/take)  ✅ true pagination
       ├─ tenant + pool/portal → lean FULL index merge → slice → hydrate page  ❌
       └─ non-tenant no pool → DB count + findMany(skip/take)  ✅
  → formatPaginationResponse
```

---

## 3. Current DB query flow

- **My candidates:** `prisma.candidate.count` + `findMany` with `candidateListInclude`, `orderBy updatedAt/createdAt`, `skip`/`take`.
- **All candidates (tenant-scoped):**  
  1. `findMany` **all** matching lean rows (`candidateListIndexSelect`) — no skip/take  
  2. Portal lean index + optional Phase 1 common index (cap ~5000)  
  3. In-memory merge / filter / sort  
  4. Cache 60s (max 6 keys)  
  5. Hydrate only current page with heavy `include`
- Search: Prisma `contains` + `mode: 'insensitive'` on many fields → Mongo `$regexMatch` (often COLLSCAN without text strategy).

---

## 4. Current frontend rendering flow

- Default **pageSize = 100** (options 10 / 50 / 100).
- Loads **one page** into React state (does not mount 100k DOM rows).
- **Main search is not debounced** → keystroke storms.
- Column filters debounced **400ms**.
- AbortController + request-id for stale responses (already present).
- Session list cache via `employerPageCache`.
- **No** TanStack Query; **no** row virtualization (acceptable at ≤100 rows/page).

---

## 5. Identified bottlenecks

| # | Bottleneck | Impact |
|---|------------|--------|
| 1 | All-candidates **full lean merge** before paging | Dominates at 10k–100k+ |
| 2 | Multi-field regex `contains` search | Slow / no index use |
| 3 | Heavy `candidateListInclude` (matches×40, apps×30, …) | Large payload + DB work per page |
| 4 | FE default page size 100 + undebounced search | Extra load + request storms |
| 5 | Missing indexes on email / stage / phone / sort fields | Slower filters & sorts |
| 6 | Portal resume hydrate on list page | Extra I/O after list |

---

## 6. N+1 queries

- Classic Prisma N+1 on list page: **largely avoided** (batched includes + `attachPlacementsToCandidates` + job title batch).
- Residual cost is **wide includes** and **full-index merge**, not per-row round trips.

---

## 7. Missing indexes (before change)

Existing: `status`, `assignedToId`, `createdById`, `orgUnitId`, `isDeleted`.

Missing for list/search/sort patterns: `email`, `phone`, `stage`, `source`, compound `(isDeleted, updatedAt)`.

---

## 8. Excessive payloads

List hydrate returns nested applications/matches/pipeline/interviews far beyond table columns. Detail drawer should own deep history via `GET /candidates/:id`.

---

## 9. Client-side filtering

- Primary search/filter: **server-side**.
- Smart-search keyword chips filter the **current page only** (acceptable).
- **Anti-pattern elsewhere:** Clients page loads up to 500 then client-slices; Pipeline loads up to 500 candidates.

---

## 10. Rendering problems

- Table maps all rows for the page (OK if page ≤ 50–100).
- Virtualization not required if page size stays bounded.
- Undebounced search causes flicker and duplicate work.

---

## 11. Recommended architecture (target)

```
User → Debounced search (300–400ms)
     → Candidate List API (limit 25–100, auth scope preserved)
     → Slim Prisma select/include + indexed Mongo query
     → Page only → FE cache / AbortController
     → Table (≤ pageSize rows)
Detail drawer → GET /candidates/:id (full payload)
```

Preserve offset pagination UX (`page` / `total` / `totalPages`). Prefer true DB `skip`/`take` whenever merge is unnecessary; keep merge only for portal/common pool correctness; expand merge cache; slim includes.

---

## 12. Files to modify

- `backendphase2/prisma/schema.prisma` — indexes  
- `backendphase2/src/modules/candidate/candidate.service.js` — slim include, search/list opts, cache  
- `frontphase2/src/app/candidate/page.tsx` — debounce, default page size  
- `frontphase2/src/constants/tablePagination.ts` — optional 25  
- `frontphase2/src/app/client/page.tsx` — stop load-all-500 client paging (shared pattern)  
- `frontphase2/src/app/pipeline/page.tsx` — lower bootstrap limit / page  
- Docs: this audit + `CANDIDATE_PERFORMANCE_REPORT.md`

---

## 13. Expected improvements

| Area | Expectation |
|------|-------------|
| My candidates / non-merge paths | Faster via indexes + slim include |
| Search UX | Far fewer requests (debounce) |
| Payload / page | Smaller JSON, less Prisma work |
| All + common pool first load | Better with cache + slim hydrate; **full merge still scales with index size** — remaining bottleneck documented |
| Other Phase 2 lists | Same pagination/debounce discipline |

---

## 14. Risks / regressions

- Slimmer includes must still supply fields used by stage/job chips on the table.
- Reducing match/application take must not break “assigned job titles” / stage resolution for typical cases.
- Index adds require `prisma db push` / deploy on each tenant DB.
- Do not weaken RBAC or tenant scoping while optimizing.

---

## 15. Other Phase 2 modules (same pattern)

| Module | Issue | Apply same approach |
|--------|-------|---------------------|
| Clients | Fetch 500 + client slice | Server page + debounce |
| Pipeline | limit 500 board load | Cap / page / server filters |
| Matches | Single chunk 100 | Explicit pagination |
| Interviews | Extra limit 500 bootstraps | Trim side-loads |
| Leads / Jobs / Placements | Already closer to OK | Debounce + indexes as needed |
