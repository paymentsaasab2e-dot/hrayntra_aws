# Phase 2 List Performance (all modules)

**Date:** 2026-09-18  
**Companion to:** `CANDIDATE_PERFORMANCE.md` (candidates remain the reference implementation)

This extends the same speed model — **bounded DB fetch, no full-table Node merge, debounce, page caps** — across other Phase 2 list pages.

---

## Shared backend

| Change | File |
|--------|------|
| List `limit` hard-capped (default max **100**, env `LIST_PAGE_MAX_LIMIT`) | `backendphase2/src/utils/pagination.js` |

---

## Module coverage

| Module | What was slow | What we changed |
|--------|---------------|-----------------|
| **Candidates** | Unbounded merge + mine heavy include | See `CANDIDATE_PERFORMANCE.md` (complete) |
| **Jobs** | `uniqueJobIdsForAllCompanies` loaded **all** job ids | Bounded window (`JOB_LIST_UNIQUE_MAX_K`, default 2500); metrics use `count` + capped job id take |
| **Interviews** | `list` loaded **all** matching ids for orphan check | Bounded orphan scan + DB `count`; page from validated window |
| **Clients** | Unbounded `job.findMany` for recruitment client ids; FE fetched page1×100 then sliced | `distinct`/`bounded` clientIds; FE uses **server** `page` + `pageSize` |
| **Leads** | Metrics looped `limit:500` until all leads in browser | Metrics = **one** bounded sample (`limit: 100`) |
| **Interviews FE** | Meta/`jobId` pulls `limit:500`; search instant | Meta/job drill `limit:100`; search **350ms** debounce |
| **Jobs FE** | Search hit API on every keystroke | **350ms** debounce via `useDebouncedValue` |

Shared FE helper: `frontphase2/src/hooks/useListRequestGate.ts` (`useDebouncedValue`, abort/request gate).

---

## Still follow-up (not fully rewritten)

| Module | Note |
|--------|------|
| Pipeline board | Still board `limit:100` window — intentional for board UX |
| Tasks & Activities | Still may fetch large windows — prefer server page next |
| Placements options | Options lists may still use 500/1000 — list API already capped |
| Contacts filter debounce | Worth fixing broken debounce in `ContactsFilterBar` |
| Lead/Job summary cards | Sampled metrics ≠ exact global histogram until a dedicated stats API |

---

## How to verify

1. Restart backend (`pnpm dev` in `backendphase2`).
2. Hit Jobs / Clients / Interviews / Leads / Candidates list pages.
3. Confirm Network: list calls use `page` + `limit≤100`, search waits ~350ms.
4. Deploy before expecting `employers.hryantra.com` to change.

---

## Ops

```bash
# Candidates indexes/backfill (existing)
cd backendphase2
node scripts/ensure-candidate-search-indexes.mjs --tenants=YOUR_TENANT --bench
```

Optional env:

```text
LIST_PAGE_MAX_LIMIT=100
JOB_LIST_UNIQUE_MAX_K=2500
INTERVIEW_LIST_ORPHAN_SCAN_MAX=2500
CANDIDATE_LIST_MAX_K=2500
```
