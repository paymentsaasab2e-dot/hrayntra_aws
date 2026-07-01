/** Build list API params — when smart-search AI returns matching ids, they take priority over filter params. */

export function buildJobsListApiParams(filters: {
  currentPage: number;
  pageSize: number;
  searchFilter?: string;
  statusFilter?: string;
  clientFilterId?: string;
  recruiterFilterId?: string;
  matchingJobIds?: string[];
}) {
  if (filters.matchingJobIds && filters.matchingJobIds.length > 0) {
    return {
      ids: filters.matchingJobIds.join(','),
      page: filters.currentPage,
      limit: filters.pageSize,
    };
  }
  return {
    page: filters.currentPage,
    limit: filters.pageSize,
    search: filters.searchFilter || undefined,
    status: filters.statusFilter || undefined,
    clientId: filters.clientFilterId || undefined,
    assignedToId: filters.recruiterFilterId || undefined,
  };
}

export function buildClientsListApiParams(filters: {
  search?: string;
  page?: number;
  limit?: number;
  matchingClientIds?: string[];
  includeContacts?: boolean;
  includeLeadFields?: boolean;
}) {
  if (filters.matchingClientIds && filters.matchingClientIds.length > 0) {
    return {
      ids: filters.matchingClientIds.join(','),
      page: filters.page ?? 1,
      limit: filters.limit ?? 500,
      includeContacts: filters.includeContacts ?? false,
      includeLeadFields: filters.includeLeadFields ?? false,
    };
  }
  return {
    search: filters.search || undefined,
    page: filters.page ?? 1,
    limit: filters.limit ?? 500,
    includeContacts: filters.includeContacts ?? false,
    includeLeadFields: filters.includeLeadFields ?? false,
  };
}

export function buildCandidatesListApiParams(filters: {
  page: number;
  limit: number;
  search?: string;
  company?: string;
  location?: string;
  jobId?: string;
  experienceRange?: string;
  assignedToId?: string;
  stage?: string;
  status?: string;
  mine?: boolean;
  includeCommonPool?: boolean;
  matchingCandidateIds?: string[];
}) {
  if (filters.matchingCandidateIds && filters.matchingCandidateIds.length > 0) {
    return {
      ids: filters.matchingCandidateIds.join(','),
      page: filters.page,
      limit: filters.limit,
      ...(filters.mine ? { mine: true } : {}),
      ...(filters.includeCommonPool !== false ? { includeCommonPool: true } : {}),
    };
  }
  const params: Record<string, string | number | boolean> = {
    page: filters.page,
    limit: filters.limit,
  };
  if (filters.search) params.search = filters.search;
  if (filters.company) params.company = filters.company;
  if (filters.location) params.location = filters.location;
  if (filters.jobId) params.jobId = filters.jobId;
  if (filters.experienceRange) params.experienceRange = filters.experienceRange;
  if (filters.assignedToId) params.assignedToId = filters.assignedToId;
  if (filters.stage) params.stage = filters.stage;
  if (filters.status) params.status = filters.status;
  if (filters.mine) params.mine = true;
  if (filters.includeCommonPool !== false) params.includeCommonPool = true;
  return params;
}

export function buildInterviewsListApiParams(filters: {
  page: number;
  limit: number;
  status?: string;
  round?: string;
  mode?: string;
  interviewerId?: string;
  jobId?: string;
  search?: string;
  matchingInterviewIds?: string[];
}) {
  if (filters.matchingInterviewIds && filters.matchingInterviewIds.length > 0) {
    return {
      ids: filters.matchingInterviewIds.join(','),
      page: filters.page,
      limit: filters.limit,
    };
  }
  return {
    page: filters.page,
    limit: filters.limit,
    status: filters.status || undefined,
    round: filters.round || undefined,
    mode: filters.mode || undefined,
    interviewerId: filters.interviewerId || undefined,
    jobId: filters.jobId || undefined,
    search: filters.search || undefined,
  };
}

export function buildPlacementsListApiParams(
  filters: Record<string, string | number | undefined> & { matchingPlacementIds?: string[] },
) {
  if (filters.matchingPlacementIds && filters.matchingPlacementIds.length > 0) {
    const { matchingPlacementIds: _omit, ...rest } = filters;
    return {
      ...rest,
      ids: filters.matchingPlacementIds.join(','),
      page: filters.page ?? 1,
      limit: filters.limit ?? 10,
    };
  }
  const { matchingPlacementIds: _omit, ...rest } = filters;
  return rest;
}
