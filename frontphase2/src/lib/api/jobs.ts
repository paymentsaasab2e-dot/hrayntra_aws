/* jobs API */
import { API_BASE, ApiResponse, apiFetch, apiFetchFormData, buildTrashQuery, getAccessToken, getTenantDbName, resolvePhase1CandidatePortalBase } from './core';
import type { BackendActivity, BackendJob, BackendJobNote, CommunicationJobBoardKey, CreateJobData, CreateJobNoteData, JobClientRemarksPayload, JobCreationPipelineResult, JobFile, JobMetrics, JobVisibilityDefaultsPayload, LinkedInPostJobData, LinkedInPostJobResponse, PortalAccessJobRow, SocialPublishData, StatusCatalogResponse, UpdateJobNoteData } from './types';


export async function apiGetJobStatusCatalog() {
  return apiFetch<StatusCatalogResponse>('/settings/org/job-statuses', { auth: true });
}

export async function apiAppendJobStatus(status: string) {
  return apiFetch<StatusCatalogResponse>('/settings/org/job-statuses/append', {
    method: 'POST',
    auth: true,
    body: { status },
  });
}

export async function apiRemoveJobStatus(status: string) {
  return apiFetch<StatusCatalogResponse>('/settings/org/job-statuses/remove', {
    method: 'POST',
    auth: true,
    body: { status },
  });
}

export async function apiApplyPipelineTemplateToEmptyJobs() {
  return apiFetch<{
    updatedJobs: number;
    emptySeeded?: number;
    legacyReseeded?: number;
    removedStages?: number;
  }>('/settings/org/pipeline-template/apply-to-empty-jobs', { method: 'POST', auth: true, body: {} });
}

export async function apiResetJobPipelineToOrgTemplate(jobId: string) {
  return apiFetch<{ stages: Array<{ id: string; name: string; order: number; color?: string | null; systemRole?: string | null }> }>(
    `/settings/org/pipeline-template/apply-to-job/${jobId}`,
    { method: 'POST', auth: true, body: {} }
  );
}

export async function apiGetJobVisibilityDefaults() {
  return apiFetch<JobVisibilityDefaultsPayload>('/users/me/job-visibility-defaults', { auth: true });
}

export async function apiSaveJobVisibilityDefaults(body: JobVisibilityDefaultsPayload) {
  return apiFetch<JobVisibilityDefaultsPayload>('/users/me/job-visibility-defaults', {
    method: 'PUT',
    body,
    auth: true,
  });
}

export async function apiGetJobs(params: {
  status?: string;
  clientId?: string;
  assignedToId?: string;
  search?: string;
  page?: number;
  limit?: number;
  ids?: string;
  /** When true, backend returns only jobs created by the logged-in user */
  mine?: boolean;
  signal?: AbortSignal;
}) {
  const { signal, ...queryParams } = params;
  const query = new URLSearchParams();
  Object.entries(queryParams).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    if (typeof value === 'boolean') {
      if (value) query.set(key, 'true');
      return;
    }
    query.set(key, String(value));
  });
  const qs = query.toString();
  const path = `/jobs${qs ? `?${qs}` : ''}`;
  return apiFetch<BackendJob[]>(path, { auth: true, signal });
}

export async function apiGetPortalAccessJobsForMember(userId: string) {
  return apiFetch<{
    member: { id: string; name: string; email: string; roleName?: string };
    jobs: PortalAccessJobRow[];
    missingCount: number;
    publishedCount: number;
  }>(`/jobs/portal-access/members/${encodeURIComponent(userId)}/jobs`, { auth: true });
}

export async function apiSetJobsHryantraPortalAccess(body: {
  jobIds: string[];
  enabled?: boolean;
}) {
  return apiFetch<{
    enabled: boolean;
    updated: number;
    failed: number;
    results: Array<{ id: string; title?: string; ok: boolean; error?: string; onHryantraPortal?: boolean }>;
  }>('/jobs/portal-access/publish', {
    auth: true,
    method: 'POST',
    body,
  });
}

export const apiCreateJob = async (data: CreateJobData) => {
  return apiFetch<BackendJob>('/jobs', {
    method: 'POST',
    body: data,
    auth: true,
  });
};

export const apiGetJob = async (id: string) => {
  return apiFetch<BackendJob>(`/jobs/${id}`, { auth: true });
};

export const apiGetJobApplyLink = async (jobId: string) => {
  const frontendBase = resolvePhase1CandidatePortalBase();
  const qs = frontendBase ? `?frontendBase=${encodeURIComponent(frontendBase)}` : '';
  return apiFetch<{ token: string; applyUrl: string }>(`/jobs/${jobId}/apply-link${qs}`, {
    auth: true,
  });
};

/** Normalize apply-link API payloads (and optional token fallback) into a usable URL. */

export function resolveJobApplyUrlFromResponse(
  response: unknown,
  fallbackToken?: string | null,
): string | null {
  const root = (response || {}) as {
    data?: { applyUrl?: string; token?: string };
    applyUrl?: string;
    token?: string;
  };
  const payload = root.data && typeof root.data === 'object' ? root.data : root;
  const direct = String(payload?.applyUrl || root.applyUrl || '').trim();
  if (direct) return direct;

  const token = String(payload?.token || root.token || fallbackToken || '').trim();
  if (!token) return null;

  const base =
    resolvePhase1CandidatePortalBase() ||
    (typeof window !== 'undefined' ? window.location.origin : '');
  if (!base) return null;
  const tenant = getTenantDbName();
  const qs = tenant ? `?tenantDbName=${encodeURIComponent(tenant)}` : '';
  return `${base.replace(/\/$/, '')}/apply/${encodeURIComponent(token)}${qs}`;
}

export const getJobPreScreenAssessments = async (jobId: string) => {
  return apiFetch<unknown[]>(`/pre-screen-assessments/jobs/${jobId}`, { auth: true });
};

export const replaceJobPreScreenAssessments = async (
  jobId: string,
  links: NonNullable<CreateJobData['preScreenAssessments']>
) => {
  return apiFetch<unknown[]>(`/pre-screen-assessments/jobs/${jobId}`, {
    method: 'PUT',
    body: { preScreenAssessments: links },
    auth: true,
  });
};

export const apiGetJobMetrics = async (params?: { mine?: boolean }) => {
  const qs =
    params?.mine === true ? '?mine=true' : '';
  return apiFetch<JobMetrics>(`/jobs/metrics${qs}`, { auth: true });
};

export const apiUpdateJob = async (id: string, data: CreateJobData) => {
  return apiFetch<BackendJob>(`/jobs/${id}`, {
    method: 'PATCH',
    body: data,
    auth: true,
  });
};

export const apiDeleteJob = async (id: string) => {
  return apiFetch<{ message: string }>(`/jobs/${id}`, {
    method: 'DELETE',
    auth: true,
  });
};

// ────────────────────────────────────────────────────────────
// Candidates
// ────────────────────────────────────────────────────────────

export const apiGetJobNotes = async (jobId: string) => {
  return apiFetch<BackendJobNote[]>(`/jobs/${jobId}/notes`, {
    auth: true,
  });
};

export const apiCreateJobNote = async (
  jobId: string,
  data: CreateJobNoteData
) => {
  return apiFetch<BackendJobNote>(`/jobs/${jobId}/notes`, {
    method: 'POST',
    body: data,
    auth: true,
  });
};

export const apiUpdateJobNote = async (
  jobId: string,
  noteId: string,
  data: UpdateJobNoteData
) => {
  return apiFetch<BackendJobNote>(`/jobs/${jobId}/notes/${noteId}`, {
    method: 'PATCH',
    body: data,
    auth: true,
  });
};

export const apiDeleteJobNote = async (jobId: string, noteId: string) => {
  return apiFetch<{ message: string }>(`/jobs/${jobId}/notes/${noteId}`, {
    method: 'DELETE',
    auth: true,
  });
};

// ────────────────────────────────────────────────────────────
// Job Activities API
// ────────────────────────────────────────────────────────────

export const apiGetJobActivities = async (jobId: string) => {
  return apiFetch<BackendActivity[]>(`/jobs/${jobId}/activities`, { auth: true });
};

export const apiGetJobClientRemarks = async (jobId: string) => {
  return apiFetch<JobClientRemarksPayload>(`/jobs/${jobId}/client-remarks`, { auth: true });
};

// ────────────────────────────────────────────────────────────
// Contacts
// ────────────────────────────────────────────────────────────

export const apiUploadJobFile = async (jobId: string, file: File, fileType: string = 'JD', description?: string) => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('fileType', fileType);
  if (description) {
    formData.append('description', description);
  }

  const token = getAccessToken();
  if (!token) {
    throw new Error('No access token found');
  }

  const url = `${API_BASE}/jobs/${jobId}/files`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const json = await response.json().catch(() => ({}));
    const msg = json?.message || `Request failed with status ${response.status}`;
    throw new Error(msg);
  }

  return response.json() as Promise<ApiResponse<JobFile>>;
};

export const apiGetJobFiles = async (jobId: string) => {
  return apiFetch<JobFile[]>(`/jobs/${jobId}/files`, { auth: true });
};

export const apiDeleteJobFile = async (jobId: string, fileId: string) => {
  return apiFetch(`/jobs/${jobId}/files/${fileId}`, {
    method: 'DELETE',
    auth: true,
  });
};

export const apiPostJobToLinkedIn = async (jobData: LinkedInPostJobData) => {
  return apiFetch<LinkedInPostJobResponse>('/linkedin/post-job', {
    method: 'POST',
    body: jobData,
    auth: true,
  });
};

export const apiPublishSocialJob = async (data: SocialPublishData) => {
  return apiFetch<any>('/social/publish', {
    method: 'POST',
    body: data,
    auth: true,
  });
};

export const apiPatchJobBoard = async (body: {
  platform: CommunicationJobBoardKey;
  apiKey?: string;
  clientId?: string;
  publisherId?: string;
}) => {
  return apiFetch<{ platform: string; connected: boolean }>('/settings/communication/job-board', {
    method: 'PATCH',
    body,
    auth: true,
  });
};

export const apiDeleteJobBoardCredentials = async (platform: CommunicationJobBoardKey) => {
  return apiFetch<{ platform: string; connected: boolean }>('/settings/communication/job-board', {
    method: 'DELETE',
    body: { platform },
    auth: true,
  });
};

export async function apiProcessJobCreationPipeline(
  file: File,
  currentForm?: Record<string, unknown>,
  options: { signal?: AbortSignal } = {}
) {
  const formData = new FormData();
  formData.append('jdFile', file);
  if (currentForm && Object.keys(currentForm).length) {
    formData.append('currentForm', JSON.stringify(currentForm));
  }
  return apiFetchFormData<JobCreationPipelineResult>('/jobs/process-jd-file', formData, {
    method: 'POST',
    auth: true,
    signal: options.signal,
  });
}

export async function apiGenerateJobFromPrompt(body: {
  prompt: string;
  currentForm?: Record<string, unknown>;
}) {
  const token = getAccessToken();
  if (!token) {
    throw new Error('Authentication required. Please log in.');
  }

  return apiFetch<JobCreationPipelineResult>('/ai/job-from-prompt', {
    method: 'POST',
    body,
    auth: true,
  });
}

export async function apiSuggestJobTitles(body: {
  query: string;
  company?: string;
  industry?: string;
  limit?: number;
}) {
  return apiFetch<{ suggestions: string[] }>('/ai/job-title-suggestions', {
    method: 'POST',
    body,
    auth: true,
  });
}

export async function apiGenerateJobDescription(body: {
  jobTitle: string;
  company?: string;
  jobType?: string;
  jobCategory?: string;
  locationType?: string;
  experience?: string;
  skills?: string[];
  customPrompt?: string;
}) {
  const token = getAccessToken();
  if (!token) {
    throw new Error('Authentication required. Please log in.');
  }

  return apiFetch<{
    title: string;
    jobType: string;
    minExperience: number;
    maxExperience: number;
    educationalQualification: string;
    educationalSpecialization: string;
    skills: string[];
    screeningQuestions: string[];
    html: string;
  }>('/ai/job-description', {
    method: 'POST',
    body,
    auth: true,
  });
}

export const apiGetJobsTrash = async (opts: { page?: number; limit?: number } = {}) => {
  return apiFetch<any>(`/jobs/trash${buildTrashQuery(opts)}`, { method: 'GET', auth: true });
};

export const apiRestoreJob = async (id: string) => {
  return apiFetch<{ message: string }>(`/jobs/${id}/restore`, { method: 'POST', auth: true });
};

export const apiPurgeJob = async (id: string) => {
  return apiFetch<{ message: string }>(`/jobs/${id}/purge`, { method: 'DELETE', auth: true });
};

export const apiBulkPurgeJobs = async (ids: string[]) => {
  return apiFetch<{ success: number; failed: number; failures: { id: string; message: string }[] }>(
    '/jobs/trash/bulk-purge',
    { method: 'POST', auth: true, body: { ids } }
  );
};
