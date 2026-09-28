/* leads API */
import { apiFetch, apiFetchFormData, buildTrashQuery, syncTenantDbName } from './core';
import type { AriaLeadsResponse, BackendActivity, BackendLead, BackendLeadNote, ConvertLeadToClientData, CreateLeadData, CreateLeadNoteData, CrmAssignableMember, LeadAiChatMessage, LeadAiGeneratedDetails, LeadImportDuplicateCheckResult, LeadImportExecuteResult, LeadImportPreviewResult, StatusCatalogResponse, UpdateLeadNoteData } from './types';


export async function apiGetLeadStatusCatalog() {
  return apiFetch<StatusCatalogResponse>('/settings/org/lead-statuses', { auth: true });
}

export async function apiAppendLeadStatus(status: string) {
  return apiFetch<StatusCatalogResponse>('/settings/org/lead-statuses/append', {
    method: 'POST',
    auth: true,
    body: { status },
  });
}

export async function apiRemoveLeadStatus(status: string) {
  return apiFetch<StatusCatalogResponse>('/settings/org/lead-statuses/remove', {
    method: 'POST',
    auth: true,
    body: { status },
  });
}

export const apiPreviewLeadImport = async (file: File) => {
  const formData = new FormData();
  formData.append('file', file);
  return apiFetchFormData<LeadImportPreviewResult>('/leads/import/preview', formData, {
    method: 'POST',
    auth: true,
  });
};

export const apiImportLeads = async (payload: {
  rows: Record<string, string | number | boolean | null>[];
  mapping: Record<string, string>;
  duplicateRule: string;
}) => {
  return apiFetch<LeadImportExecuteResult>('/leads/import', {
    method: 'POST',
    body: payload,
    auth: true,
  });
};

export const apiCheckLeadImportDuplicates = async (payload: {
  rows: Record<string, string | number | boolean | null>[];
  mapping: Record<string, string>;
}) => {
  return apiFetch<LeadImportDuplicateCheckResult>('/leads/import/check-duplicates', {
    method: 'POST',
    body: payload,
    auth: true,
  });
};

export const apiGetLeads = async (params: {
  status?: string;
  source?: string;
  type?: string;
  priority?: string;
  assignedToId?: string;
  search?: string;
  /** Comma-separated lead ids from AI smart search (tenant DB row ids). */
  ids?: string;
  page?: number;
  limit?: number;
} = {}) => {
  const query = new URLSearchParams();
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      query.set(key, String(value));
    }
  });
  const qs = query.toString();
  const path = `/leads${qs ? `?${qs}` : ''}`;
  // Backend returns: { success: true, message: "...", data: { data: [...], pagination: {...} } }
  const response = await apiFetch<{ data: BackendLead[]; pagination?: any } | BackendLead[]>(path, { auth: true });
  // Do not collapse same-company leads on the list — that hid newly created rows
  // that shared a normalized company name with an older lead.
  return response;
};

export const apiGetLead = async (id: string) => {
  return apiFetch<BackendLead>(`/leads/${id}`, { auth: true });
};

export const apiCreateLead = async (data: CreateLeadData) => {
  return apiFetch<BackendLead>('/leads', {
    method: 'POST',
    body: data,
    auth: true,
  });
};

export const apiGetLeadPublicFormLink = async () => {
  const frontendBase =
    typeof window !== 'undefined'
      ? `${window.location.protocol}//${window.location.host}`
      : undefined;
  const qs = frontendBase ? `?frontendBase=${encodeURIComponent(frontendBase)}` : '';
  return apiFetch<{ token: string; formUrl: string; title?: string; tenantDbName?: string | null }>(
    `/leads/public-form-link${qs}`,
    { auth: true }
  );
};

export const apiGetLeadPublicFormAccess = async () => {
  return apiFetch<{
    tenantDbName?: string;
    token?: string;
    accessCount?: number;
    leadsFilledCount?: number;
    members?: Array<{ name?: string; email?: string; leadCount?: number }>;
  }>('/leads/public-form-link/access', { auth: true });
};

export const apiInviteLeadPublicFormMember = async (payload: {
  name: string;
  designation: string;
  email: string;
  password: string;
}) => {
  const frontendBase =
    typeof window !== 'undefined'
      ? `${window.location.protocol}//${window.location.host}`
      : undefined;
  return apiFetch<{
    memberCreated?: boolean;
    alreadyExisted?: boolean;
    name?: string;
    designation?: string;
    email?: string;
    loginId?: string;
    formUrl?: string;
    tenantDbName?: string;
    emailSent?: boolean;
  }>('/leads/public-form-link/invite', {
    method: 'POST',
    auth: true,
    body: { ...payload, frontendBase },
  });
};

export const apiGetPublicLeadForm = async (token: string, tenantDbName?: string) => {
  const tenant = String(tenantDbName || '').trim();
  const qs = tenant ? `?tenantDbName=${encodeURIComponent(tenant)}` : '';
  if (tenant && typeof window !== 'undefined') {
    syncTenantDbName(tenant);
  }
  return apiFetch<{
    title: string;
    token: string;
    fields: string[];
  }>(`/leads/public/form/${encodeURIComponent(token)}${qs}`, {
    auth: false,
    includeTenantHeader: Boolean(tenant),
  });
};

export const apiSubmitPublicLeadForm = async (
  token: string,
  body: Record<string, unknown>,
  tenantDbName?: string
) => {
  const tenant = String(tenantDbName || '').trim();
  const qs = tenant ? `?tenantDbName=${encodeURIComponent(tenant)}` : '';
  if (tenant && typeof window !== 'undefined') {
    syncTenantDbName(tenant);
  }
  return apiFetch<{
    id: string;
    companyName?: string;
    contactPerson?: string;
    email?: string;
    phone?: string;
    status?: string;
    source?: string;
    industry?: string;
    location?: string;
    createdAt?: string;
    message?: string;
  }>(`/leads/public/form/${encodeURIComponent(token)}/submit${qs}`, {
    method: 'POST',
    body: tenant ? { ...body, tenantDbName: tenant } : body,
    auth: true,
    includeTenantHeader: Boolean(tenant),
  });
};

export const apiUpdatePublicLeadFormLead = async (
  token: string,
  leadId: string,
  body: Record<string, unknown>,
  tenantDbName?: string
) => {
  const tenant = String(tenantDbName || '').trim();
  const qs = tenant ? `?tenantDbName=${encodeURIComponent(tenant)}` : '';
  if (tenant && typeof window !== 'undefined') {
    syncTenantDbName(tenant);
  }
  return apiFetch<BackendLead>(
    `/leads/public/form/${encodeURIComponent(token)}/leads/${encodeURIComponent(leadId)}${qs}`,
    {
      method: 'PATCH',
      body: tenant ? { ...body, tenantDbName: tenant } : body,
      auth: true,
      includeTenantHeader: Boolean(tenant),
    }
  );
};

export const apiDeletePublicLeadFormLead = async (
  token: string,
  leadId: string,
  tenantDbName?: string
) => {
  const tenant = String(tenantDbName || '').trim();
  const qs = tenant ? `?tenantDbName=${encodeURIComponent(tenant)}` : '';
  if (tenant && typeof window !== 'undefined') {
    syncTenantDbName(tenant);
  }
  return apiFetch<{ id: string; deleted?: boolean }>(
    `/leads/public/form/${encodeURIComponent(token)}/leads/${encodeURIComponent(leadId)}${qs}`,
    {
      method: 'DELETE',
      auth: true,
      includeTenantHeader: Boolean(tenant),
    }
  );
};

export const apiGetPublicLeadFormSubmissions = async (token: string, tenantDbName?: string) => {
  const tenant = String(tenantDbName || '').trim();
  const qs = tenant ? `?tenantDbName=${encodeURIComponent(tenant)}` : '';
  if (tenant && typeof window !== 'undefined') {
    syncTenantDbName(tenant);
  }
  return apiFetch<{
    token: string;
    tenantDbName: string;
    leads: Array<Record<string, unknown>>;
  }>(`/leads/public/form/${encodeURIComponent(token)}/submissions${qs}`, {
    auth: false,
    includeTenantHeader: Boolean(tenant),
  });
};

export const apiUpdateLead = async (id: string, data: Partial<CreateLeadData>) => {
  return apiFetch<BackendLead>(`/leads/${id}`, {
    method: 'PATCH',
    body: data,
    auth: true,
  });
};

/** Mark the lead’s current scheduled follow-up / meet as done with a completion remark. */

export const apiCompleteLeadFollowUp = async (leadId: string, body: { remark: string }) => {
  return apiFetch<BackendLead>(`/leads/${encodeURIComponent(leadId)}/follow-ups/complete`, {
    method: 'POST',
    body,
    auth: true,
  });
};

export const apiDeleteLead = async (id: string) => {
  return apiFetch<{ message: string }>(`/leads/${id}`, {
    method: 'DELETE',
    auth: true,
  });
};

export const apiGetLeadActivities = async (leadId: string) => {
  return apiFetch<BackendActivity[]>(`/leads/${leadId}/activities`, { auth: true });
};

export const apiSubmitLeadConversionRequest = async (id: string, clientData: ConvertLeadToClientData) => {
  return apiFetch<any>(`/leads/${id}/conversion-request`, {
    method: 'POST',
    body: clientData,
    auth: true,
  });
};

export const apiGetLeadConversionCapabilities = async () => {
  return apiFetch<{ canDirectConvert: boolean }>(`/leads/conversion-capabilities`, { auth: true });
};

export const apiGetLeadAssignableMembers = async (companyId?: string) => {
  const query = companyId ? `?companyId=${encodeURIComponent(companyId)}` : '';
  return apiFetch<CrmAssignableMember[]>(`/leads/assignable-members${query}`, { auth: true });
};

export const apiGetLeadNotes = async (leadId: string) => {
  return apiFetch<BackendLeadNote[]>(`/leads/${leadId}/notes`, {
    auth: true,
  });
};

export const apiCreateLeadNote = async (
  leadId: string,
  data: CreateLeadNoteData
) => {
  return apiFetch<BackendLeadNote>(`/leads/${leadId}/notes`, {
    method: 'POST',
    body: data,
    auth: true,
  });
};

export const apiUpdateLeadNote = async (
  leadId: string,
  noteId: string,
  data: UpdateLeadNoteData
) => {
  return apiFetch<BackendLeadNote>(`/leads/${leadId}/notes/${noteId}`, {
    method: 'PATCH',
    body: data,
    auth: true,
  });
};

export const apiDeleteLeadNote = async (
  leadId: string,
  noteId: string
) => {
  return apiFetch<{ message: string }>(`/leads/${leadId}/notes/${noteId}`, {
    method: 'DELETE',
    auth: true,
  });
};

// ────────────────────────────────────────────────────────────
// Job Notes API
// ────────────────────────────────────────────────────────────

export async function apiAriaLeads(
  body: { userMessage: string; currentPage?: string },
  file?: File | null
) {
  if (file) {
    const formData = new FormData();
    formData.append('userMessage', body.userMessage || '');
    formData.append('currentPage', body.currentPage || 'leads');
    formData.append('file', file);
    return apiFetchFormData<AriaLeadsResponse>('/ai/aria', formData, {
      method: 'POST',
      auth: true,
    });
  }

  return apiFetch<AriaLeadsResponse>('/ai/aria', {
    method: 'POST',
    body,
    auth: true,
  });
}

export async function apiGenerateLeadDetails(body: {
  prompt: string;
  currentForm?: Record<string, unknown>;
}) {
  return apiFetch<LeadAiGeneratedDetails>('/ai/lead-details', {
    method: 'POST',
    body,
    auth: true,
  });
}

export async function apiLeadAiChat(body: {
  message: string;
  currentForm?: Record<string, unknown>;
  history?: LeadAiChatMessage[];
}) {
  return apiFetch<{
    reply: string;
    readyToCreate: boolean;
    lead: LeadAiGeneratedDetails;
  }>('/ai/lead-chat', {
    method: 'POST',
    body,
    auth: true,
  });
}

export async function apiCheckLeadDuplicate(body: {
  email?: string;
  phone?: string;
  companyName?: string;
  contactPerson?: string;
}) {
  return apiFetch<{
    duplicate: boolean;
    leadId?: string;
    matchedBy?: string[];
    existing?: {
      id: string;
      companyName?: string | null;
      contactPerson?: string | null;
      email?: string | null;
      phone?: string | null;
      ownerName?: string | null;
      createdAt?: string;
    };
  }>('/leads/duplicate-check', {
    method: 'POST',
    body,
    auth: true,
  });
}

export const apiGetLeadsTrash = async (opts: { page?: number; limit?: number } = {}) => {
  return apiFetch<any>(`/leads/trash${buildTrashQuery(opts)}`, { method: 'GET', auth: true });
};

export const apiRestoreLead = async (id: string) => {
  return apiFetch<{ message: string }>(`/leads/${id}/restore`, { method: 'POST', auth: true });
};

export const apiPurgeLead = async (id: string) => {
  return apiFetch<{ message: string }>(`/leads/${id}/purge`, { method: 'DELETE', auth: true });
};

export const apiBulkPurgeLeads = async (ids: string[]) => {
  return apiFetch<{ success: number; failed: number; failures: { id: string; message: string }[] }>(
    '/leads/trash/bulk-purge',
    { method: 'POST', auth: true, body: { ids } }
  );
};
