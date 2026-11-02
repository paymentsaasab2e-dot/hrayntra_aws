import { apiGetJobs, type BackendJob } from './api';
import { fetchAllPaginated, totalPagesFromPagination } from './export/fetchAllPaginated';
import { parseJobsListFromResponse } from './parseApiList';

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
      const nested =
        jobsRes?.data && typeof jobsRes.data === 'object' && !Array.isArray(jobsRes.data)
          ? (jobsRes.data as { pagination?: { totalPages?: number; total?: number } }).pagination
          : undefined;
      const pagination = jobsRes?.pagination || nested;
      return {
        items,
        totalPages: totalPagesFromPagination(pagination, items.length, limit),
      };
    },
  });
}
