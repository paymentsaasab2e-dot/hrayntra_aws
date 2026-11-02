import { apiGetCandidates, apiGetJobs, type BackendCandidate, type BackendJob } from './api';
import { fetchAllPaginated, totalPagesFromPagination } from './export/fetchAllPaginated';
import { parseCandidatesListFromResponse, parseJobsListFromResponse } from './parseApiList';

/**
 * Same query as the /job table: only jobs created by the logged-in user.
 * Use anywhere we need “my jobs” (Add Candidate drawer, candidate pipeline picker, etc.).
 */
export const MY_JOBS_LIST_PARAMS = { mine: true as const, limit: 200 };

/**
 * Placement / billing forms: every job this user can access in the tenant
 * (respects view_all_jobs / assignee visibility). Includes closed + filled.
 * Server list pages are capped (~100), so callers should use
 * `fetchAllAccessibleJobsForPlacementPicker` instead of a single request.
 */
export const PLACEMENT_FORM_JOBS_PARAMS = {
  page: 1 as const,
  limit: 100,
  status: 'ALL' as const,
};

function paginationFromListResponse(res: { data?: unknown; pagination?: { totalPages?: number; total?: number } }) {
  const nested =
    res?.data && typeof res.data === 'object' && !Array.isArray(res.data)
      ? (res.data as { pagination?: { totalPages?: number; total?: number } }).pagination
      : undefined;
  return res?.pagination || nested;
}

/** Load every accessible job for Add Manual Placement / similar pickers. */
export async function fetchAllAccessibleJobsForPlacementPicker(
  signal?: AbortSignal,
): Promise<BackendJob[]> {
  return fetchAllPaginated<BackendJob>({
    batchSize: 100,
    fetchPage: async (page, limit) => {
      const jobsRes = await apiGetJobs({
        page,
        limit,
        status: 'ALL',
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
 * Load every candidate this user can access for Add Manual Placement.
 * Pages through the server list cap (~100). Skips Phase 1 common-pool merge.
 */
export async function fetchAllAccessibleCandidatesForPlacementPicker(
  signal?: AbortSignal,
): Promise<BackendCandidate[]> {
  return fetchAllPaginated<BackendCandidate>({
    batchSize: 100,
    fetchPage: async (page, limit) => {
      const candidatesRes = await apiGetCandidates(
        {
          page,
          limit,
          includeCommonPool: false,
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
