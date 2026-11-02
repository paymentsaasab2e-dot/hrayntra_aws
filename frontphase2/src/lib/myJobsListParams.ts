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
 */
export const PLACEMENT_FORM_JOBS_PARAMS = {
  page: 1 as const,
  limit: 1000,
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
 * Falls back to paged lean requests if the first page is full.
 */
export async function fetchAllAccessibleJobsForPlacementPicker(
  signal?: AbortSignal,
): Promise<BackendJob[]> {
  const first = await apiGetJobs({
    page: 1,
    limit: 1000,
    status: 'ALL',
    placementPicker: true,
    signal,
  });
  const firstItems = parseJobsListFromResponse(first);
  const pagination = paginationFromListResponse(first);
  const totalPages = totalPagesFromPagination(pagination, firstItems.length, 1000);
  if (totalPages <= 1 || firstItems.length < 1000) return firstItems;

  const rest = await fetchAllPaginated<BackendJob>({
    batchSize: 1000,
    fetchPage: async (page, limit) => {
      if (page === 1) {
        return { items: firstItems, totalPages };
      }
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
  return rest;
}

/**
 * Fast lean candidate list for Add Manual Placement (id/name/email only).
 * Falls back to paged lean requests if the first page is full.
 */
export async function fetchAllAccessibleCandidatesForPlacementPicker(
  signal?: AbortSignal,
): Promise<BackendCandidate[]> {
  const first = await apiGetCandidates(
    {
      page: 1,
      limit: 1000,
      includeCommonPool: false,
      placementPicker: true,
    },
    { signal },
  );
  const firstItems = parseCandidatesListFromResponse(first);
  const pagination = paginationFromListResponse(first);
  const totalPages = totalPagesFromPagination(pagination, firstItems.length, 1000);
  if (totalPages <= 1 || firstItems.length < 1000) return firstItems;

  return fetchAllPaginated<BackendCandidate>({
    batchSize: 1000,
    fetchPage: async (page, limit) => {
      if (page === 1) {
        return { items: firstItems, totalPages };
      }
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
