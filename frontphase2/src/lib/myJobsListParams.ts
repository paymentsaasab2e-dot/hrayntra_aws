/**
 * Same query as the /job table: only jobs created by the logged-in user.
 * Use anywhere we need “my jobs” (Add Candidate drawer, candidate pipeline picker, etc.).
 */
export const MY_JOBS_LIST_PARAMS = { mine: true as const, limit: 200 };

/** Placement / billing forms: every job in the tenant (not filtered to current user). */
export const PLACEMENT_FORM_JOBS_PARAMS = { page: 1 as const, limit: 500 };
