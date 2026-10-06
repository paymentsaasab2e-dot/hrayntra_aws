/* candidates API */
import { ApiResponse, apiFetch, apiFetchFormData, buildTrashQuery, getAccessToken, getTenantDbName, resolveApiBaseForPath } from './core';
import { createHttpApiError, normalizeFetchError, readApiJson } from '../apiNetworkErrors';
import { waitForCvParseJob } from '../cvParseJobClient';
import type { AddCandidatePayload, AgreementDocumentParseData, BackendCandidate, BulkCvExpandZipResult, BulkImportResult, CandidateAiGeneratedDetails, CandidateAssessmentResultGroup, CandidateTagSuggestion, DuplicateCheckResponse, ImportedProfileData, KycDocumentParseData, LeadAiChatMessage, RepairBadNamesResult, ServerFailedBulkResume, UpdateCandidatePayload } from './types';


export async function apiBulkCvExpandZip(
  archive: File,
  sessionId: string,
  options: { signal?: AbortSignal; apiBase?: string } = {}
) {
  const formData = new FormData();
  formData.append('sessionId', sessionId);
  formData.append('archive', archive);
  return apiFetchFormData<BulkCvExpandZipResult>('/candidates/bulk-cv/expand-zip', formData, {
    method: 'POST',
    auth: true,
    signal: options.signal,
    apiBase: options.apiBase,
  });
}

export async function apiBulkCvReleaseZip(
  sessionId: string,
  options: { apiBase?: string } = {}
) {
  const apiBase = options.apiBase?.replace(/\/$/, '') || resolveApiBaseForPath('/candidates/bulk-cv/release-zip');
  const url = `${apiBase}/candidates/bulk-cv/release-zip`;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = getAccessToken();
  if (!token) throw new Error('Authentication required. Please log in.');
  headers.Authorization = `Bearer ${token}`;
  const tenantDbName = getTenantDbName();
  if (tenantDbName) headers['x-tenant-db-name'] = tenantDbName;

  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ sessionId }),
      credentials: 'include',
      mode: 'cors',
      cache: 'no-store',
    });
  } catch (fetchError: unknown) {
    throw normalizeFetchError(fetchError);
  }

  const json = await readApiJson<any>(res);
  if (!res.ok || json?.success === false) {
    throw createHttpApiError(res.status, json?.message || `Request failed with status ${res.status}`, {
      data: json?.data,
      raw: json,
    });
  }
  return json as ApiResponse<unknown>;
}

/** Download a ZIP-extracted CV still on the server (before release-zip). */

export async function apiBulkCvDownloadStoredFile(
  sessionId: string,
  storedFileId: string,
  options: { apiBase?: string; signal?: AbortSignal } = {}
): Promise<File> {
  const apiBase =
    options.apiBase?.replace(/\/$/, '') || resolveApiBaseForPath('/candidates/bulk-cv/stored-file');
  const qs = new URLSearchParams({
    sessionId: String(sessionId || '').trim(),
    storedFileId: String(storedFileId || '').trim(),
  });
  const url = `${apiBase}/candidates/bulk-cv/stored-file?${qs.toString()}`;
  const headers: Record<string, string> = {};
  const token = getAccessToken();
  if (!token) throw new Error('Authentication required. Please log in.');
  headers.Authorization = `Bearer ${token}`;
  const tenantDbName = getTenantDbName();
  if (tenantDbName) headers['x-tenant-db-name'] = tenantDbName;

  let res: Response;
  try {
    res = await fetch(url, {
      method: 'GET',
      headers,
      credentials: 'include',
      mode: 'cors',
      cache: 'no-store',
      signal: options.signal,
    });
  } catch (fetchError: unknown) {
    throw normalizeFetchError(fetchError);
  }

  if (!res.ok) {
    let message = `Request failed with status ${res.status}`;
    try {
      const json = await res.json();
      if (json?.message) message = String(json.message);
    } catch {
      /* ignore */
    }
    throw createHttpApiError(res.status, message);
  }

  const blob = await res.blob();
  const disposition = res.headers.get('Content-Disposition') || '';
  const match = /filename\*=UTF-8''([^;]+)|filename="?([^";]+)"?/i.exec(disposition);
  const rawName = decodeURIComponent(match?.[1] || match?.[2] || 'resume');
  const mime = res.headers.get('Content-Type') || blob.type || 'application/octet-stream';
  return new File([blob], rawName, { type: mime });
}

export async function apiBulkCvProcessFile(
  payload: { file?: File; storedFileId?: string },
  sessionId: string,
  fileIndex: number,
  options: { signal?: AbortSignal; apiBase?: string } = {}
) {
  const formData = new FormData();
  formData.append('sessionId', sessionId);
  formData.append('fileIndex', String(fileIndex));
  if (payload.storedFileId) {
    formData.append('storedFileId', payload.storedFileId);
  } else if (payload.file) {
    formData.append('resume', payload.file);
  }
  const enqueued = await apiFetchFormData<Record<string, unknown>>('/candidates/bulk-cv/process-file', formData, {
    method: 'POST',
    auth: true,
    signal: options.signal,
    apiBase: options.apiBase,
  });
  const jobId = String(
    (enqueued as { jobId?: string }).jobId || (enqueued.data as { jobId?: string } | undefined)?.jobId || '',
  ).trim();
  if (!jobId) {
    // Synchronous legacy response — pass through unchanged.
    return enqueued;
  }
  const data = await waitForCvParseJob(jobId, {
    signal: options.signal,
    timeoutMs: 30 * 60 * 1000,
    getJob: async (id) => {
      const res = (await apiGetCvParseJob(id, { signal: options.signal })) as unknown as {
        jobId?: string;
        status?: string;
        error?: string;
        data?: Record<string, unknown>;
      };
      return { jobId: res.jobId, status: res.status, error: res.error, data: res.data };
    },
  });
  return { success: true, message: 'ok', data };
}

export async function apiBulkCvSaveFailedResumes(
  items: Array<{ file: File | Blob; fileName?: string; reason: string }>,
  options: { signal?: AbortSignal } = {}
) {
  if (!items.length) {
    return { saved: [] as ServerFailedBulkResume[], errors: [] as Array<{ fileName: string; message: string }>, activeCount: 0 };
  }
  const formData = new FormData();
  const reasons: string[] = [];
  for (const item of items) {
    const name = item.fileName || (item.file instanceof File ? item.file.name : 'resume');
    const file =
      item.file instanceof File
        ? item.file
        : new File([item.file], name, { type: (item.file as Blob).type || 'application/octet-stream' });
    formData.append('resumes', file);
    reasons.push(String(item.reason || 'Bulk CV processing failed'));
  }
  formData.append('reasons', JSON.stringify(reasons));
  const res = await apiFetchFormData<{
    saved: ServerFailedBulkResume[];
    errors: Array<{ fileName: string; message: string }>;
    activeCount: number;
  }>('/candidates/bulk-cv/failed', formData, {
    method: 'POST',
    auth: true,
    signal: options.signal,
  });
  return (
    res.data || {
      saved: [],
      errors: [],
      activeCount: 0,
    }
  );
}

export async function apiBulkCvListFailedResumes(options: { signal?: AbortSignal } = {}) {
  const res = await apiFetch<{ items: ServerFailedBulkResume[]; count: number }>(
    '/candidates/bulk-cv/failed',
    {
      method: 'GET',
      auth: true,
      signal: options.signal,
    }
  );
  return res.data || { items: [], count: 0 };
}

export async function apiBulkCvDownloadFailedResumeFile(
  id: string,
  options: { signal?: AbortSignal } = {}
): Promise<File> {
  const apiBase = resolveApiBaseForPath('/candidates/bulk-cv/failed');
  const url = `${apiBase}/candidates/bulk-cv/failed/${encodeURIComponent(id)}/file`;
  const headers: Record<string, string> = {};
  const token = getAccessToken();
  if (!token) throw new Error('Authentication required. Please log in.');
  headers.Authorization = `Bearer ${token}`;
  const tenantDbName = getTenantDbName();
  if (tenantDbName) headers['x-tenant-db-name'] = tenantDbName;

  let res: Response;
  try {
    res = await fetch(url, {
      method: 'GET',
      headers,
      credentials: 'include',
      mode: 'cors',
      cache: 'no-store',
      signal: options.signal,
    });
  } catch (fetchError: unknown) {
    throw normalizeFetchError(fetchError);
  }

  if (!res.ok) {
    let message = `Request failed with status ${res.status}`;
    try {
      const json = await res.json();
      if (json?.message) message = String(json.message);
    } catch {
      /* ignore */
    }
    throw createHttpApiError(res.status, message);
  }

  const blob = await res.blob();
  const disposition = res.headers.get('Content-Disposition') || '';
  const match = /filename\*=UTF-8''([^;]+)|filename="?([^";]+)"?/i.exec(disposition);
  const rawName = decodeURIComponent(match?.[1] || match?.[2] || 'resume');
  const mime = res.headers.get('Content-Type') || blob.type || 'application/octet-stream';
  return new File([blob], rawName, { type: mime });
}

export async function apiBulkCvTrashFailedResumes(ids: string[]) {
  return apiFetch<{ count: number; activeCount: number }>('/candidates/bulk-cv/failed/trash', {
    method: 'POST',
    auth: true,
    body: { ids },
  });
}

export async function apiBulkCvResolveFailedResumes(ids: string[]) {
  return apiFetch<{ count: number; activeCount: number }>('/candidates/bulk-cv/failed/resolve', {
    method: 'POST',
    auth: true,
    body: { ids },
  });
}

export async function apiRepairBadCandidateNames(options: {
  execute?: boolean;
  dryRun?: boolean;
  limit?: number;
  scopeAllCompanies?: boolean;
  signal?: AbortSignal;
} = {}) {
  const res = await apiFetch<RepairBadNamesResult>('/candidates/repair-bad-names', {
    method: 'POST',
    auth: true,
    body: {
      execute: options.execute === true,
      dryRun: options.dryRun === true,
      limit: options.limit,
      scopeAllCompanies: options.scopeAllCompanies === true,
    },
    signal: options.signal,
  });
  const data = res.data || {
    scanned: 0,
    badNames: 0,
    updated: 0,
    wouldUpdate: 0,
    skippedNoResume: 0,
    skippedUnparseable: 0,
    unchanged: 0,
    dryRun: true,
    changes: [],
    samples: [],
  };
  if (!Array.isArray(data.changes) || !data.changes.length) {
    data.changes = Array.isArray(data.samples) ? data.samples : [];
  }
  return data;
}

// ────────────────────────────────────────────────────────────
// Auth
// ────────────────────────────────────────────────────────────

export async function apiUploadCandidateAvatar(candidateId: string, file: File) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('entityType', 'candidate');
  formData.append('entityId', candidateId);
  formData.append('fileType', 'Photo');
  return apiFetchFormData<{ id?: string; fileUrl?: string }>('/files', formData, {
    method: 'POST',
    auth: true,
  });
}

// ────────────────────────────────────────────────────────────
// Jobs
// ────────────────────────────────────────────────────────────

export const getCandidateAssessmentResults = async (
  candidateId: string,
  jobId?: string | null,
) => {
  const scopedJobId = String(jobId || '').trim();
  const qs = scopedJobId ? `?jobId=${encodeURIComponent(scopedJobId)}` : '';
  return apiFetch<CandidateAssessmentResultGroup[]>(
    `/pre-screen-assessments/candidates/${encodeURIComponent(candidateId)}/results${qs}`,
    { auth: true },
  );
};

export async function apiGetCandidates(
  params: {
    status?: string;
    stage?: string;
    assignedToId?: string;
    search?: string;
    company?: string;
    location?: string;
    jobId?: string;
    experienceRange?: string;
    page?: number;
    limit?: number;
    ids?: string;
    mine?: boolean;
    /** Merge verified Phase 1 snapshots from candidatecommon DB */
    includeCommonPool?: boolean;
    /** Lightweight id/name/phone/job rows for the schedule-interview picker. */
    picker?: boolean;
  },
  options: { signal?: AbortSignal } = {},
) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    if (typeof value === 'boolean') {
      if (key === 'includeCommonPool' || key === 'mine' || key === 'picker') {
        query.set(key, value ? 'true' : 'false');
        return;
      }
      if (value) query.set(key, 'true');
      return;
    }
    query.set(key, String(value));
  });
  const qs = query.toString();
  const path = `/candidates${qs ? `?${qs}` : ''}`;
  return apiFetch<BackendCandidate[]>(path, {
    auth: true,
    includeTenantHeader: true,
    signal: options.signal,
  });
}

export const apiGetCandidate = async (id: string) => {
  return apiFetch<BackendCandidate>(`/candidates/${id}`, { auth: true });
};

export const apiUpdateCandidate = async (id: string, data: UpdateCandidatePayload) => {
  return apiFetch<BackendCandidate>(`/candidates/${id}`, {
    method: 'PATCH',
    body: data,
    auth: true,
  });
};

export const apiDeleteCandidate = async (id: string) => {
  return apiFetch<{ message: string }>(`/candidates/${id}`, {
    method: 'DELETE',
    auth: true,
  });
};

export const apiCreateCandidateFromDrawer = async (
  payload: AddCandidatePayload,
  options: { signal?: AbortSignal } = {}
) => {
  return apiFetch<BackendCandidate>('/candidates/create', {
    method: 'POST',
    body: payload,
    auth: true,
    signal: options.signal,
  });
};

export const apiParseCandidateResume = async (
  file: File,
  options: { signal?: AbortSignal } = {}
) => {
  const formData = new FormData();
  formData.append('resume', file);
  return apiFetchFormData<ImportedProfileData>('/candidates/parse-resume', formData, {
    method: 'POST',
    auth: true,
    signal: options.signal,
  });
};

export const apiEnqueueCvParseJob = async (
  file: File,
  options: { signal?: AbortSignal; candidateId?: string } = {}
) => {
  const formData = new FormData();
  formData.append('resume', file);
  if (options.candidateId) formData.append('candidateId', options.candidateId);
  return apiFetchFormData<{ jobId?: string; status?: string }>('/cv/parse-jobs', formData, {
    method: 'POST',
    auth: true,
    signal: options.signal,
  });
};

export const apiGetCvParseJob = async (jobId: string, options: { signal?: AbortSignal } = {}) => {
  const id = encodeURIComponent(String(jobId || '').trim());
  return apiFetch<ImportedProfileData>(`/cv/parse-jobs/${id}`, {
    auth: true,
    signal: options.signal,
  });
};

/** Queue CV parse, poll until done. Falls back to sync parse-resume if enqueue fails. */
export const apiParseCandidateResumeQueued = async (
  file: File,
  options: { signal?: AbortSignal; candidateId?: string } = {}
) => {
  try {
    const enqueued = await apiEnqueueCvParseJob(file, options);
    const jobId = String(
      (enqueued as { jobId?: string }).jobId || (enqueued.data as { jobId?: string } | undefined)?.jobId || '',
    ).trim();
    const enqueueStatus = String(
      (enqueued as { status?: string }).status || (enqueued.data as { status?: string } | undefined)?.status || '',
    ).toLowerCase();
    if (!jobId || enqueueStatus === 'error') {
      throw new Error('Could not start resume parse');
    }

    const data = await waitForCvParseJob(jobId, {
      signal: options.signal,
      getJob: async (id) => {
        const res = await apiGetCvParseJob(id, { signal: options.signal });
        const raw = res as {
          status?: string;
          error?: string;
          data?: ImportedProfileData;
          jobId?: string;
        };
        return {
          jobId: raw.jobId,
          status: raw.status,
          error: raw.error,
          data: raw.data as Record<string, unknown> | undefined,
        };
      },
    });

    return {
      success: true,
      message: 'Resume parsed',
      data: data as ImportedProfileData,
    };
  } catch (error) {
    if (options.signal?.aborted) throw error;
    const message = error instanceof Error ? error.message : '';
    if (/timed out|could not parse resume|invalid cv/i.test(message)) {
      throw error;
    }
    return apiParseCandidateResume(file, options);
  }
};

export const apiImportCandidateFromLinkedIn = async (linkedinUrl: string) => {
  return apiFetch<ImportedProfileData>('/candidates/import-linkedin', {
    method: 'POST',
    body: { linkedinUrl },
    auth: true,
  });
};

export const apiCheckCandidateDuplicate = async (params: { email?: string; phone?: string }) => {
  const query = new URLSearchParams();
  if (params.email) query.set('email', params.email);
  if (params.phone) query.set('phone', params.phone);
  return apiFetch<DuplicateCheckResponse>(`/candidates/check-duplicate?${query.toString()}`, {
    auth: true,
  });
};

export const apiUploadCandidateResumeFile = async (
  candidateId: string,
  file: File,
  options: { signal?: AbortSignal; replacePrimary?: boolean } = {}
) => {
  const replacePrimary = options.replacePrimary !== false;
  const formData = new FormData();
  formData.append('resume', file);
  // Send both body + query so multer/proxy cannot silently default to replace.
  formData.append('replacePrimary', replacePrimary ? 'true' : 'false');
  const qs = `?replacePrimary=${replacePrimary ? 'true' : 'false'}`;
  return apiFetchFormData<
    BackendCandidate & {
      resumeFileId?: string | null;
      resumeFileUrl?: string;
      resumeVersions?: unknown[];
    }
  >(`/candidates/${candidateId}/files${qs}`, formData, {
    method: 'POST',
    auth: true,
    signal: options.signal,
  });
};

export const apiDeleteCandidateResumeVersion = async (
  candidateId: string,
  payload: { fileId?: string | null; fileUrl?: string | null },
  options: { signal?: AbortSignal } = {}
) => {
  const params = new URLSearchParams();
  if (payload.fileId) params.set('fileId', String(payload.fileId));
  if (payload.fileUrl) params.set('fileUrl', String(payload.fileUrl));
  const qs = params.toString();
  return apiFetch<BackendCandidate & { resumeVersions?: unknown[]; deletedFileIds?: string[] }>(
    `/candidates/${candidateId}/resume-versions${qs ? `?${qs}` : ''}`,
    {
      method: 'DELETE',
      auth: true,
      body: {
        fileId: payload.fileId || undefined,
        fileUrl: payload.fileUrl || undefined,
      },
      signal: options.signal,
    }
  );
};

export const apiBulkImportCandidates = async (file: File) => {
  const formData = new FormData();
  formData.append('csvFile', file);
  return apiFetchFormData<BulkImportResult>('/candidates/bulk-import', formData, {
    method: 'POST',
    auth: true,
  });
};

export const apiParseAgreementDocument = async (
  file: File,
  options: { signal?: AbortSignal } = {},
) => {
  const formData = new FormData();
  formData.append('file', file);
  const res = await apiFetchFormData<AgreementDocumentParseData>('/agreements/parse-document', formData, {
    method: 'POST',
    auth: true,
    signal: options.signal,
  });
  const payload = (res?.data || res) as AgreementDocumentParseData & { data?: AgreementDocumentParseData };
  if (payload?.terms) return payload;
  if (payload?.data?.terms) return payload.data;
  return payload;
};

export const apiParseKycDocument = async (file: File, options: { signal?: AbortSignal } = {}) => {
  const formData = new FormData();
  formData.append('file', file);
  const res = await apiFetchFormData<KycDocumentParseData>('/kyc/parse-document', formData, {
    method: 'POST',
    auth: true,
    signal: options.signal,
  });
  return res.data;
};

export const apiGetCandidateTagSuggestions = async () => {
  return apiFetch<CandidateTagSuggestion[]>('/tags', { auth: true });
};

export const apiAddCandidateNote = async (
  candidateId: string,
  note: { text: string; tags: string[] }
) => {
  return apiFetch(`/candidates/${candidateId}/notes`, {
    method: 'POST',
    body: note,
    auth: true,
  });
};

export const apiUpdateCandidateNote = async (
  candidateId: string,
  noteId: string,
  note: { text: string; tags: string[] }
) => {
  return apiFetch(`/candidates/${candidateId}/notes/${noteId}`, {
    method: 'PATCH',
    body: note,
    auth: true,
  });
};

export const apiDeleteCandidateNote = async (candidateId: string, noteId: string) => {
  return apiFetch(`/candidates/${candidateId}/notes/${noteId}`, {
    method: 'DELETE',
    auth: true,
  });
};

export const apiPinCandidateNote = async (
  candidateId: string,
  noteId: string,
  isPinned: boolean
) => {
  return apiFetch(`/candidates/${candidateId}/notes/${noteId}/pin`, {
    method: 'PATCH',
    body: { isPinned },
    auth: true,
  });
};

export const apiAddCandidateTag = async (
  candidateId: string,
  tag: { id?: string; label: string; color?: string }
) => {
  return apiFetch(`/candidates/${candidateId}/tags`, {
    method: 'POST',
    body: { tag },
    auth: true,
  });
};

export const apiRemoveCandidateTag = async (candidateId: string, tagId: string) => {
  return apiFetch(`/candidates/${candidateId}/tags/${tagId}`, {
    method: 'DELETE',
    auth: true,
  });
};

export const apiAddCandidateToPipeline = async (
  candidateId: string,
  payload: {
    jobId: string;
    stage: string;
    recruiterId?: string;
    priority: 'High' | 'Medium' | 'Low';
    notes?: string;
  }
) => {
  return apiFetch<BackendCandidate>(`/candidates/${candidateId}/pipeline`, {
    method: 'POST',
    body: payload,
    auth: true,
  });
};

export const apiRemoveCandidateFromPipeline = async (candidateId: string, jobId: string) => {
  return apiFetch<BackendCandidate>(`/candidates/${candidateId}/pipeline`, {
    method: 'DELETE',
    body: { jobId },
    auth: true,
  });
};

export const apiMoveCandidateStage = async (
  jobId: string,
  payload: {
    candidateId: string;
    stageId: string;
    notes?: string;
  }
) => {
  return apiFetch(`/pipeline/job/${jobId}/move`, {
    method: 'POST',
    body: payload,
    auth: true,
  });
};

export const apiRejectCandidate = async (
  candidateId: string,
  payload: {
    reason: string;
    feedback: string;
    sendEmail: boolean;
    /** When true, the rejection feedback is shown on the candidate's job-portal application timeline. */
    showFeedbackToCandidate?: boolean;
    /** Required for correct portal sync when multiple jobs exist — e.g. pass the interview's job id. */
    jobId?: string;
  }
) => {
  return apiFetch<BackendCandidate>(`/candidates/${candidateId}/reject`, {
    method: 'POST',
    body: payload,
    auth: true,
  });
};

export const apiGetCandidateStats = async (params?: {
  mine?: boolean;
  includeCommonPool?: boolean;
}) => {
  const query = new URLSearchParams();
  if (params?.mine === true) query.set('mine', 'true');
  if (params?.includeCommonPool === true) query.set('includeCommonPool', 'true');
  const qs = query.toString();
  return apiFetch<{
    all: number;
    applied: number;
    longlist: number;
    shortlist: number;
    screening: number;
    submitted: number;
    interviewing: number;
    offered: number;
    hired: number;
    rejected: number;
  }>(`/candidates/stats${qs ? `?${qs}` : ''}`, { auth: true });
};

export const apiBulkActionCandidates = async (
  action: 'assign_recruiter' | 'add_tag' | 'reject' | 'export',
  candidateIds: string[],
  payload?: any
) => {
  return apiFetch<any>(`/candidates/bulk-action`, {
    method: 'POST',
    body: { action, candidateIds, ...payload },
    auth: true,
  });
};

export const apiScheduleCandidateInterview = async (
  candidateId: string,
  payload: {
    jobId?: string | null;
    clientId?: string | null;
    type: string;
    round: number;
    date: string;
    time: string;
    duration: string;
    timezone?: string;
    mode: 'video' | 'in-person' | 'phone';
    platform?: 'GOOGLE_MEET' | 'ZOOM' | string | null;
    meetingLink?: string | null;
    location?: string | null;
    phoneNumber?: string | null;
    interviewers: Array<{
      id: string;
      name: string;
      role: 'Lead Interviewer' | 'Interviewer' | 'Observer';
    }>;
    notes?: string;
    sendCandidateInvite?: boolean;
    sendInterviewerInvite?: boolean;
  }
) => {
  return apiFetch(`/candidates/${candidateId}/interviews`, {
    method: 'POST',
    body: payload,
    auth: true,
  });
};

export const apiUpdateCandidateInterview = async (
  candidateId: string,
  interviewId: string,
  payload: {
    jobId?: string | null;
    type?: string;
    round?: number;
    date?: string;
    time?: string;
    duration?: string;
    timezone?: string;
    mode?: 'video' | 'in-person' | 'phone';
    platform?: 'GOOGLE_MEET' | 'ZOOM' | string | null;
    meetingLink?: string | null;
    location?: string | null;
    phoneNumber?: string | null;
    interviewers?: Array<{
      id: string;
      name: string;
      role: 'Lead Interviewer' | 'Interviewer' | 'Observer';
    }>;
    notes?: string;
    sendCandidateInvite?: boolean;
    sendInterviewerInvite?: boolean;
    status?: 'scheduled' | 'completed' | 'cancelled';
  }
) => {
  return apiFetch(`/candidates/${candidateId}/interviews/${interviewId}`, {
    method: 'PATCH',
    body: payload,
    auth: true,
  });
};

export const apiGenerateCandidateInterviewMeetingLink = async (
  candidateId: string,
  payload: {
    jobId?: string | null;
    date: string;
    time: string;
    duration: string;
    timezone?: string;
    mode: 'video';
    platform: 'GOOGLE_MEET' | 'ZOOM';
    interviewers?: Array<{
      id: string;
      name: string;
      role: 'Lead Interviewer' | 'Interviewer' | 'Observer';
    }>;
    notes?: string;
  }
) => {
  const res = await apiFetch<{ meetingLink: string; platform: 'GOOGLE_MEET' | 'ZOOM' }>(`/candidates/${candidateId}/interviews/meeting-link`, {
    method: 'POST',
    body: payload,
    auth: true,
  });
  return res.data;
};

// ────────────────────────────────────────────────────────────
// Interviews
// ────────────────────────────────────────────────────────────

export async function apiGenerateCandidateDetails(body: {
  prompt: string;
  currentForm?: Record<string, unknown>;
}) {
  return apiFetch<CandidateAiGeneratedDetails>('/ai/candidate-details', {
    method: 'POST',
    body,
    auth: true,
  });
}

export async function apiCandidateAiChat(body: {
  message: string;
  currentForm?: Record<string, unknown>;
  history?: LeadAiChatMessage[];
}) {
  return apiFetch<{
    reply: string;
    readyToCreate: boolean;
    candidate: CandidateAiGeneratedDetails;
  }>('/ai/candidate-chat', {
    method: 'POST',
    body,
    auth: true,
  });
}

/** Display-only base for “register this redirect URI” (local: derived from NEXT_PUBLIC_API_URL). */

export const apiGetCandidatesTrash = async (opts: { page?: number; limit?: number } = {}) => {
  return apiFetch<any>(`/candidates/trash${buildTrashQuery(opts)}`, { method: 'GET', auth: true });
};

export const apiRestoreCandidate = async (id: string) => {
  return apiFetch<{ message: string }>(`/candidates/${id}/restore`, { method: 'POST', auth: true });
};

export const apiPurgeCandidate = async (id: string) => {
  return apiFetch<{ message: string }>(`/candidates/${id}/purge`, { method: 'DELETE', auth: true });
};

export const apiBulkPurgeCandidates = async (ids: string[]) => {
  return apiFetch<{ success: number; failed: number; failures: { id: string; message: string }[] }>(
    '/candidates/trash/bulk-purge',
    { method: 'POST', auth: true, body: { ids } }
  );
};
