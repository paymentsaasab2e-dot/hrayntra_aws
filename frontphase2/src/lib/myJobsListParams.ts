import { apiGetCandidates, apiGetJobs, type BackendCandidate, type BackendJob } from './api';
import { parseCandidatesListFromResponse, parseJobsListFromResponse } from './parseApiList';

/**
 * Same query as the /job table: only jobs created by the logged-in user.
 * Use anywhere we need “my jobs” (Add Candidate drawer, candidate pipeline picker, etc.).
 */
export const MY_JOBS_LIST_PARAMS = { mine: true as const, limit: 200 };

/** Initial lean page size for Add Manual Placement — keep first paint fast. */
export const PLACEMENT_PICKER_INITIAL_LIMIT = 200;

/**
 * Placement / billing forms: every job this user can access in the tenant
 * (respects view_all_jobs / assignee visibility). Includes closed + filled.
 */
export const PLACEMENT_FORM_JOBS_PARAMS = {
  page: 1 as const,
  limit: PLACEMENT_PICKER_INITIAL_LIMIT,
  status: 'ALL' as const,
  placementPicker: true as const,
};

/**
 * Fast lean job list for Add Manual Placement (id/title/client/salary only).
 * Loads one lean page for instant open; search fetches more matches on demand.
 */
export async function fetchAllAccessibleJobsForPlacementPicker(
  signal?: AbortSignal,
  search?: string,
): Promise<BackendJob[]> {
  const q = String(search || '').trim();
  const jobsRes = await apiGetJobs({
    page: 1,
    limit: q ? 80 : PLACEMENT_PICKER_INITIAL_LIMIT,
    status: 'ALL',
    placementPicker: true,
    search: q || undefined,
    signal,
  });
  return parseJobsListFromResponse(jobsRes);
}

/**
 * Fast lean candidate list for Add Manual Placement (id/name/email only).
 * Loads one lean page for instant open; search fetches more matches on demand.
 */
export async function fetchAllAccessibleCandidatesForPlacementPicker(
  signal?: AbortSignal,
  search?: string,
): Promise<BackendCandidate[]> {
  const q = String(search || '').trim();
  const candidatesRes = await apiGetCandidates(
    {
      page: 1,
      limit: q ? 80 : PLACEMENT_PICKER_INITIAL_LIMIT,
      includeCommonPool: false,
      placementPicker: true,
      search: q || undefined,
    },
    { signal },
  );
  return parseCandidatesListFromResponse(candidatesRes);
}
