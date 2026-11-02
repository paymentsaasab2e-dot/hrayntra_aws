import { apiGetCandidates, apiGetJobs, type BackendCandidate, type BackendJob } from './api';
import { fetchAllPaginated, totalPagesFromPagination } from './export/fetchAllPaginated';
import { parseCandidatesListFromResponse, parseJobsListFromResponse } from './parseApiList';

/**
 * Same query as the /job table: only jobs created by the logged-in user.
 * Use anywhere we need “my jobs” (Add Candidate drawer, candidate pipeline picker, etc.).
 */
export const MY_JOBS_LIST_PARAMS = { mine: true as const, limit: 200 };

/** Lean page size for Add Manual Placement (backend placementPicker max is 2000). */
export const PLACEMENT_PICKER_PAGE_LIMIT = 1000;

/**
 * Placement / billing forms: every job this user can access in the tenant
 * (respects view_all_jobs / assignee visibility). Includes closed + filled.
 */
export const PLACEMENT_FORM_JOBS_PARAMS = {
  page: 1 as const,
  limit: PLACEMENT_PICKER_PAGE_LIMIT,
  status: 'ALL' as const,
  placementPicker: true as const,
};

function paginationFromListResponse(res: {
  data?: unknown;
  pagination?: { totalPages?: number; total?: number };
}) {
  const nested =
    res?.data && typeof res.data === 'object' && !Array.isArray(res.data)
      ? (res.data as { pagination?: { totalPages?: number; total?: number } }).pagination
      : undefined;
  return res?.pagination || nested;
}

/**
 * Fast lean job list for Add Manual Placement (id/title/client/salary only).
 * Pages through every accessible job. Search returns a focused match page.
 */
export async function fetchAllAccessibleJobsForPlacementPicker(
  signal?: AbortSignal,
  search?: string,
): Promise<BackendJob[]> {
  const q = String(search || '').trim();
  if (q) {
    const jobsRes = await apiGetJobs({
      page: 1,
      limit: 200,
      status: 'ALL',
      placementPicker: true,
      search: q,
      signal,
    });
    return parseJobsListFromResponse(jobsRes);
  }

  return fetchAllPaginated<BackendJob>({
    batchSize: PLACEMENT_PICKER_PAGE_LIMIT,
    fetchPage: async (page, limit) => {
      const jobsRes = await apiGetJobs({
        page,
        limit,
        status: 'ALL',
        placementPicker: true,
        signal,
      });
      const items = parseJobsListFromResponse(jobsRes);
      return {
        items,
        totalPages: totalPagesFromPagination(paginationFromListResponse(jobsRes), items.length, limit),
      };
    },
  });
}

/**
 * Fast lean candidate list for Add Manual Placement (id/name/email only).
 * Pages through every accessible candidate. Search returns a focused match page.
 */
export async function fetchAllAccessibleCandidatesForPlacementPicker(
  signal?: AbortSignal,
  search?: string,
): Promise<BackendCandidate[]> {
  const q = String(search || '').trim();
  if (q) {
    const candidatesRes = await apiGetCandidates(
      {
        page: 1,
        limit: 200,
        includeCommonPool: false,
        placementPicker: true,
        search: q,
      },
      { signal },
    );
    return parseCandidatesListFromResponse(candidatesRes);
  }

  return fetchAllPaginated<BackendCandidate>({
    batchSize: PLACEMENT_PICKER_PAGE_LIMIT,
    fetchPage: async (page, limit) => {
      const candidatesRes = await apiGetCandidates(
        {
          page,
          limit,
          includeCommonPool: false,
          placementPicker: true,
        },
        { signal },
      );
      const items = parseCandidatesListFromResponse(candidatesRes);
      return {
        items,
        totalPages: totalPagesFromPagination(
          paginationFromListResponse(candidatesRes),
          items.length,
          limit,
        ),
      };
    },
  });
}

/** First lean page only — for progressive drawer open. */
export async function fetchPlacementPickerCandidatesPage(
  page: number,
  signal?: AbortSignal,
): Promise<{ items: BackendCandidate[]; totalPages: number }> {
  const candidatesRes = await apiGetCandidates(
    {
      page,
      limit: PLACEMENT_PICKER_PAGE_LIMIT,
      includeCommonPool: false,
      placementPicker: true,
    },
    { signal },
  );
  const items = parseCandidatesListFromResponse(candidatesRes);
  return {
    items,
    totalPages: totalPagesFromPagination(
      paginationFromListResponse(candidatesRes),
      items.length,
      PLACEMENT_PICKER_PAGE_LIMIT,
    ),
  };
}
