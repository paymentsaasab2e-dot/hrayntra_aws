/* clients API */
import { apiFetch, apiFetchFormData, buildTrashQuery } from './core';
import { cacheClientPageFieldVisibility, normalizeClientPageFieldVisibility } from '../clientPageFieldVisibility';
import {
  cacheCandidateEditFieldVisibility,
  normalizeCandidateEditFieldVisibility,
  type CandidateEditFieldVisibility,
} from '../candidateEditFieldVisibility';
import { ORG_RECRUITMENT_CACHE_EVENT } from './org';
import { dedupeCompanyNamedPayload } from '../companyNameKey';
import type { InterviewClientReviewContext } from '../clientReviewTypes';
import type { BackendClient, BackendClientNote, BackendUser, ClientAiGeneratedDetails, ClientImportDuplicateCheckResult, ClientImportExecuteResult, ClientImportPreviewResult, ClientMetrics, ConvertLeadToClientData, CreateClientData, CreateClientNoteData, CrmAssignableMember, LeadAiChatMessage, PublicClientReviewPayload, ScheduledMeeting, StatusCatalogResponse, SubmitToClientVisibilityDefaultsPayload, UpdateClientData, UpdateClientNoteData } from './types';


export async function apiGetWorkspaceClient(): Promise<{
  data?: {
    recruitmentMode?: string;
    workspaceClient?: BackendClient | null;
  };
}> {
  return apiFetch('/settings/org/workspace-client', { auth: true });
}

export function isOwnCompanyWorkspaceClient(
  client?: { website?: string | null; industry?: string | null } | null,
): boolean {
  if (!client) return false;
  return (
    String(client.website || '').startsWith('tenant://') ||
    String(client.industry || '') === 'Workspace'
  );
}

export async function apiGetClientPageFieldVisibility() {
  return apiFetch<{
    clientPageFieldVisibility: {
      interestLevel: boolean;
      status: boolean;
      assignedTo: boolean;
    };
    defaults: {
      interestLevel: boolean;
      status: boolean;
      assignedTo: boolean;
    };
  }>('/settings/org/client-page-fields', { auth: true });
}

export async function apiSetClientPageFieldVisibility(fields: {
  interestLevel?: boolean;
  status?: boolean;
  assignedTo?: boolean;
}) {
  const res = await apiFetch<{
    clientPageFieldVisibility: {
      interestLevel: boolean;
      status: boolean;
      assignedTo: boolean;
    };
  }>('/settings/org/client-page-fields', {
    method: 'PUT',
    auth: true,
    body: { clientPageFieldVisibility: fields },
  });
  if (typeof window !== 'undefined' && res.data?.clientPageFieldVisibility) {
    cacheClientPageFieldVisibility(normalizeClientPageFieldVisibility(res.data.clientPageFieldVisibility));
    window.dispatchEvent(new CustomEvent(ORG_RECRUITMENT_CACHE_EVENT));
  }
  return res;
}

export async function apiGetCandidateEditFieldVisibility() {
  return apiFetch<{
    candidateEditFieldVisibility: CandidateEditFieldVisibility;
    defaults: CandidateEditFieldVisibility;
  }>('/settings/org/candidate-edit-fields', { auth: true });
}

export async function apiSetCandidateEditFieldVisibility(
  fields: Partial<CandidateEditFieldVisibility>,
) {
  const res = await apiFetch<{
    candidateEditFieldVisibility: CandidateEditFieldVisibility;
  }>('/settings/org/candidate-edit-fields', {
    method: 'PUT',
    auth: true,
    body: { candidateEditFieldVisibility: fields },
  });
  if (typeof window !== 'undefined' && res.data?.candidateEditFieldVisibility) {
    cacheCandidateEditFieldVisibility(
      normalizeCandidateEditFieldVisibility(res.data.candidateEditFieldVisibility),
    );
    window.dispatchEvent(new CustomEvent(ORG_RECRUITMENT_CACHE_EVENT));
  }
  return res;
}

/** Tenant-wide table Columns prefs (synced across browsers). */

export async function apiGetClientLeadStatusCatalog() {
  return apiFetch<StatusCatalogResponse>('/settings/org/client-lead-statuses', { auth: true });
}

export async function apiAppendClientLeadStatus(status: string) {
  return apiFetch<StatusCatalogResponse>('/settings/org/client-lead-statuses/append', {
    method: 'POST',
    auth: true,
    body: { status },
  });
}

export async function apiRemoveClientLeadStatus(status: string) {
  return apiFetch<StatusCatalogResponse>('/settings/org/client-lead-statuses/remove', {
    method: 'POST',
    auth: true,
    body: { status },
  });
}

export async function apiGetClientPriorityCatalog() {
  return apiFetch<StatusCatalogResponse>('/settings/org/client-priorities', { auth: true });
}

export async function apiAppendClientPriority(priority: string) {
  return apiFetch<StatusCatalogResponse>('/settings/org/client-priorities/append', {
    method: 'POST',
    auth: true,
    body: { priority },
  });
}

export async function apiRemoveClientPriority(priority: string) {
  return apiFetch<StatusCatalogResponse>('/settings/org/client-priorities/remove', {
    method: 'POST',
    auth: true,
    body: { priority },
  });
}

export async function apiGetSubmitToClientVisibilityDefaults() {
  return apiFetch<SubmitToClientVisibilityDefaultsPayload>('/users/me/submit-to-client-visibility-defaults', {
    auth: true,
  });
}

export async function apiSaveSubmitToClientVisibilityDefaults(body: SubmitToClientVisibilityDefaultsPayload) {
  return apiFetch<SubmitToClientVisibilityDefaultsPayload>('/users/me/submit-to-client-visibility-defaults', {
    method: 'PUT',
    body,
    auth: true,
  });
}

export const apiPreviewClientImport = async (file: File) => {
  const formData = new FormData();
  formData.append('file', file);
  return apiFetchFormData<ClientImportPreviewResult>('/clients/import/preview', formData, {
    method: 'POST',
    auth: true,
  });
};

export const apiImportClients = async (payload: {
  rows: Record<string, string | number | boolean | null>[];
  mapping: Record<string, string>;
  duplicateRule: string;
  recruitmentEnabled?: boolean;
}) => {
  return apiFetch<ClientImportExecuteResult>('/clients/import', {
    method: 'POST',
    body: payload,
    auth: true,
  });
};

export const apiCheckClientImportDuplicates = async (payload: {
  rows: Record<string, string | number | boolean | null>[];
  mapping: Record<string, string>;
}) => {
  return apiFetch<ClientImportDuplicateCheckResult>('/clients/import/check-duplicates', {
    method: 'POST',
    body: payload,
    auth: true,
  });
};

export const apiSubmitInterviewToClient = async (
  id: string,
  payload: {
    toEmail?: string;
    message?: string;
    submissionType?: string;
    cvShareMode?: 'edited' | 'original' | 'saasa';
    resumeFileId?: string;
  }
) => {
  return apiFetch<{
    success: boolean;
    recipients: string[];
    reviewUrl: string;
    submissionType?: string;
    emailSent?: boolean;
    emailError?: string | null;
  }>(`/interviews/${id}/submit-client`, {
    method: 'POST',
    body: payload,
    auth: true,
  });
};

export const apiGetPublicClientReview = async (token: string) => {
  return apiFetch<PublicClientReviewPayload>(
    `/interviews/public/review/${encodeURIComponent(token)}`,
    {
      method: 'GET',
      auth: false,
    }
  );
};

export const apiGetInterviewClientReviewContext = async (interviewId: string) => {
  return apiFetch<InterviewClientReviewContext>(`/interviews/${interviewId}/client-review`, {
    auth: true,
  });
};

export const apiSubmitPublicClientTag = async (
  token: string,
  data: { tag: string; comments?: string; offerLetter?: File | null }
) => {
  // We always send multipart so the same endpoint handles both the
  // tag-only case (initial / interim review) and the offer-letter upload
  // case without forking into two routes on the backend.
  const formData = new FormData();
  formData.append('tag', data.tag);
  if (data.comments) formData.append('comments', data.comments);
  if (data.offerLetter) formData.append('offerLetter', data.offerLetter);
  return apiFetchFormData<{
    success: boolean;
    tag: string;
    interviewId: string;
    offerLetterUrl?: string | null;
  }>(`/interviews/public/review/${encodeURIComponent(token)}/tag`, formData, {
    method: 'POST',
    auth: false,
  });
};

export const apiUpdateClientTracker = async (
  matchId: string,
  payload: {
    trackerOptions: Record<string, boolean>;
    allowedClientStages?: string[];
    clientStageCatalog?: string[];
    batchMatchIds?: string[];
  },
) => {
  return apiFetch<{
    matchId: string;
    trackerOptions: Record<string, boolean>;
    allowedClientStages?: string[];
    clientStageCatalog?: string[];
  }>(`/matches/${matchId}/client-tracker`, {
    method: 'PATCH',
    body: payload,
    auth: true,
  });
};

export const apiConvertLeadToClient = async (id: string, clientData: ConvertLeadToClientData) => {
  return apiFetch<any>(`/leads/${id}/convert`, {
    method: 'POST',
    body: clientData,
    auth: true,
  });
};

export const apiGetClientAssignableMembers = async (
  companyId?: string,
  options?: { recruitment?: boolean },
) => {
  const params = new URLSearchParams();
  if (companyId) params.set('companyId', companyId);
  if (options?.recruitment) {
    params.set('recruitmentEnabled', 'true');
    params.set('module', 'RecruitmentClients');
  }
  const query = params.toString() ? `?${params.toString()}` : '';
  return apiFetch<CrmAssignableMember[]>(`/clients/assignable-members${query}`, { auth: true });
};

export const apiGetClients = async (params: {
  status?: string;
  assignedToId?: string;
  search?: string;
  type?: string;
  page?: number;
  limit?: number;
  ids?: string;
  includeContacts?: boolean;
  includeLeadFields?: boolean;
  recruitmentEnabled?: boolean;
} = {}) => {
  const query = new URLSearchParams();
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      query.set(key, String(value));
    }
  });
  const qs = query.toString();
  const path = `/clients${qs ? `?${qs}` : ''}`;
  const response = await apiFetch<{ data: BackendClient[]; pagination?: any } | BackendClient[]>(path, { auth: true });
  return {
    ...response,
    data: dedupeCompanyNamedPayload(response.data),
  };
};

export const apiGetClient = async (id: string) => {
  return apiFetch<BackendClient>(`/clients/${id}`, { auth: true });
};

export const apiSendClientToRecruitment = async (id: string, memberIds?: string[]) => {
  return apiFetch<BackendClient>(`/clients/${id}/send-to-recruitment`, {
    method: 'POST',
    body: { memberIds: Array.isArray(memberIds) ? memberIds : [] },
    auth: true,
  });
};

export const apiGetClientMetrics = async () => {
  return apiFetch<ClientMetrics>('/clients/metrics', { auth: true });
};

export const apiGetClientActivities = async (clientId: string) => {
  return apiFetch<any[]>(`/clients/${clientId}/activities`, { auth: true });
};

// Scheduled Meetings API

export const apiGetClientScheduledMeetings = async (
  clientId: string,
  params?: { status?: string; upcoming?: boolean }
) => {
  const queryParams = new URLSearchParams();
  if (params?.status) queryParams.append('status', params.status);
  if (params?.upcoming) queryParams.append('upcoming', 'true');
  
  const queryString = queryParams.toString();
  const url = `/clients/${clientId}/meetings${queryString ? `?${queryString}` : ''}`;
  
  return apiFetch<ScheduledMeeting[]>(url, {
    auth: true,
  });
};

export const apiGetClientNotes = async (clientId: string) => {
  return apiFetch<BackendClientNote[]>(`/clients/${clientId}/notes`, {
    auth: true,
  });
};

export const apiCreateClientNote = async (
  clientId: string,
  data: CreateClientNoteData
) => {
  return apiFetch<BackendClientNote>(`/clients/${clientId}/notes`, {
    method: 'POST',
    body: data,
    auth: true,
  });
};

export const apiUpdateClientNote = async (
  clientId: string,
  noteId: string,
  data: UpdateClientNoteData
) => {
  return apiFetch<BackendClientNote>(`/clients/${clientId}/notes/${noteId}`, {
    method: 'PATCH',
    body: data,
    auth: true,
  });
};

export const apiDeleteClientNote = async (
  clientId: string,
  noteId: string
) => {
  return apiFetch<{ message: string }>(`/clients/${clientId}/notes/${noteId}`, {
    method: 'DELETE',
    auth: true,
  });
};

// ────────────────────────────────────────────────────────────
// Lead Notes
// ────────────────────────────────────────────────────────────

export const apiCreateClient = async (data: CreateClientData) => {
  const qs = data.recruitmentEnabled ? '?recruitmentEnabled=true' : '';
  return apiFetch<BackendClient>(`/clients${qs}`, {
    method: 'POST',
    body: data,
    auth: true,
  });
};

// User interfaces and API
// (Type-merged with the canonical `BackendUser` defined earlier in this file
// — the extra fields like `designation` are declared there.)

export const apiUpdateClient = async (id: string, data: UpdateClientData) => {
  return apiFetch<BackendClient>(`/clients/${id}`, {
    method: 'PATCH',
    body: data,
    auth: true,
  });
};

export const apiDeleteClient = async (id: string) => {
  return apiFetch<{ message: string }>(`/clients/${id}`, {
    method: 'DELETE',
    auth: true,
  });
};

// ────────────────────────────────────────────────────────────
// Tasks
// ────────────────────────────────────────────────────────────

export async function apiGenerateClientDetails(body: {
  prompt: string;
  currentForm?: Record<string, unknown>;
}) {
  return apiFetch<ClientAiGeneratedDetails>('/ai/client-details', {
    method: 'POST',
    body,
    auth: true,
  });
}

export async function apiClientAiChat(body: {
  message: string;
  currentForm?: Record<string, unknown>;
  history?: LeadAiChatMessage[];
}) {
  return apiFetch<{
    reply: string;
    readyToCreate: boolean;
    client: ClientAiGeneratedDetails;
  }>('/ai/client-chat', {
    method: 'POST',
    body,
    auth: true,
  });
}

export const apiGetClientsTrash = async (opts: { page?: number; limit?: number } = {}) => {
  return apiFetch<any>(`/clients/trash${buildTrashQuery(opts)}`, { method: 'GET', auth: true });
};

export const apiRestoreClient = async (id: string) => {
  return apiFetch<{ message: string }>(`/clients/${id}/restore`, { method: 'POST', auth: true });
};

export const apiPurgeClient = async (id: string) => {
  return apiFetch<{ message: string }>(`/clients/${id}/purge`, { method: 'DELETE', auth: true });
};

export const apiBulkPurgeClients = async (ids: string[]) => {
  return apiFetch<{ success: number; failed: number; failures: { id: string; message: string }[] }>(
    '/clients/trash/bulk-purge',
    { method: 'POST', auth: true, body: { ids } }
  );
};
