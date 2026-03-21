/**
 * Same query as the /job table: only jobs created by the logged-in user.
 * Use anywhere we need “my jobs” (Add Candidate drawer, candidate pipeline picker, etc.).
 */
export const MY_JOBS_LIST_PARAMS = { mine: true as const, limit: 200 };
