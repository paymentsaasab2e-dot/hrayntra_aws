/* misc API */
import { API_BASE, ApiResponse, NOTIFICATION_TRIGGER_SETTINGS_KEY, apiFetch, apiFetchFormData, getAccessToken, parseInboxThreadList } from './core';
import { dedupeContactsPayload } from '../clientContactDedupe';
import { emitNotificationsUpdated } from './core-helpers';
import type { CreatePlacementPayload, MarkFailedPayload, MarkJoinedPayload, Placement, PlacementFilters, PlacementStats, RequestReplacementPayload, ScheduleJoiningPayload } from '../../types/placement';
import type { CreatePlacementInvoicePayload } from '../../types/recruitmentInvoice';
import type { ActivityVisibilityCapabilities, AlertChannelSettings, AlertManagementPayload, AppNotification, AppNotificationCategory, AriaUndoPayload, AssistantActionLogItem, AssistantChatMessage, AssistantConversationMemory, AssistantHistoryMessage, AssistantHistoryRecord, AssistantStructuredResponse, AssistantTaskChain, BackendActivity, BackendContact, BackendContactActivity, BackendContactCommunication, BackendContactNote, BackendGlobalActivity, BackendTask, BackendUser, BrainAskResult, CommunicationConnections, CommunicationFullResponse, CommunicationSettingsShape, CompanyServiceSuggestion, ContactFilters, ContactImportExecuteResult, ContactImportPreviewResult, ContactStats, CreateContactData, CreateScheduledMeetingData, CreateTaskData, EntityChatType, GmailInboxMessage, GmailInboxResponse, GmailMessageActionResult, HqSupportTicket, HqSupportTicketCategory, HqSupportTicketMessage, HqSupportTicketPriority, HqSupportTicketStats, HqSupportTicketStatus, InboxMessage, InboxThread, IndustrySuggestion, IntegrationProvider, IntegrationStatusResponse, InvoiceActivityResponse, InvoicePaymentReminder, LanguageSuggestion, LinkedInStatus, MailboxSignatureResult, MailboxStatusResponse, NotificationTriggerEffectiveTemplate, NotificationTriggerSettingsPayload, NotificationTriggerTemplateOverride, NotificationsListResponse, OutlookComposeDraftResult, OutlookSendMailResult, PlacementInvoiceCreateResponse, PlacementPaginatedResponse, PutCommunicationBody, RecruitmentForwardTargets, ScheduledAnalysisSettings, ScheduledMeeting, SendInvoiceReminderPayload, SocialPublishingAccount, StatusCatalogResponse, TaskStats, UnifiedCalendarResponse, UpdateScheduledMeetingData, UpdateTaskData } from './types';


export async function apiGetTableColumnVisibility() {
  return apiFetch<{ columns: Record<string, string[]> }>('/settings/org/table-columns', {
    auth: true,
  });
}

export async function apiSetTableColumnVisibility(columns: Record<string, string[]>) {
  return apiFetch<{ columns: Record<string, string[]> }>('/settings/org/table-columns', {
    method: 'PUT',
    auth: true,
    body: { columns },
  });
}

export async function apiGetRazorpayConfig() {
  return apiFetch<{
    enabled: boolean;
    mode?: 'clone' | 'live';
    keyId: string;
    merchantName: string;
    merchantUpi: string;
    currency: string;
  }>('/settings/org/subscription-plan/razorpay-config', { auth: true });
}

export async function apiGetCompanyServices() {
  return apiFetch<{
    services: string[];
    recommended?: string[];
    defaults?: string[];
    aiEnabled?: boolean;
  }>('/settings/org/company-services', { auth: true });
}

export async function apiSuggestIndustries(params: {
  q?: string;
  selected?: string[];
  limit?: number;
  companyName?: string;
}) {
  const sp = new URLSearchParams();
  const q = String(params.q ?? '').trim();
  if (q) sp.set('q', q);
  if (params.companyName?.trim()) sp.set('companyName', params.companyName.trim());
  if (params.limit) sp.set('limit', String(params.limit));
  if (params.selected?.length) sp.set('selected', params.selected.join(';'));
  const qs = sp.toString();
  return apiFetch<{
    suggestions: IndustrySuggestion[];
    aiEnabled: boolean;
  }>(`/settings/org/industries/suggest${qs ? `?${qs}` : ''}`, { auth: true });
}

export async function apiSuggestLanguages(params: {
  q?: string;
  selected?: string[];
  limit?: number;
  jobTitle?: string;
}) {
  const sp = new URLSearchParams();
  const q = String(params.q ?? '').trim();
  if (q) sp.set('q', q);
  if (params.jobTitle?.trim()) sp.set('jobTitle', params.jobTitle.trim());
  if (params.limit) sp.set('limit', String(params.limit));
  if (params.selected?.length) sp.set('selected', params.selected.join(';'));
  const qs = sp.toString();
  return apiFetch<{
    suggestions: LanguageSuggestion[];
    aiEnabled: boolean;
  }>(`/settings/org/languages/suggest${qs ? `?${qs}` : ''}`, { auth: true });
}

export async function apiSuggestProficiencies(params: {
  q?: string;
  selected?: string[];
  limit?: number;
  language?: string;
}) {
  const sp = new URLSearchParams();
  const q = String(params.q ?? '').trim();
  if (q) sp.set('q', q);
  if (params.language?.trim()) sp.set('language', params.language.trim());
  if (params.limit) sp.set('limit', String(params.limit));
  if (params.selected?.length) sp.set('selected', params.selected.join(';'));
  const qs = sp.toString();
  return apiFetch<{
    suggestions: LanguageSuggestion[];
    aiEnabled: boolean;
  }>(`/settings/org/proficiencies/suggest${qs ? `?${qs}` : ''}`, { auth: true });
}

export async function apiSuggestCompanyServices(params: {
  q?: string;
  selected?: string[];
  limit?: number;
  industry?: string;
}) {
  const sp = new URLSearchParams();
  const q = String(params.q ?? '').trim();
  if (q) sp.set('q', q);
  if (params.industry?.trim()) sp.set('industry', params.industry.trim());
  if (params.limit) sp.set('limit', String(params.limit));
  if (params.selected?.length) sp.set('selected', params.selected.join(';'));
  const qs = sp.toString();
  return apiFetch<{
    suggestions: CompanyServiceSuggestion[];
    aiEnabled: boolean;
  }>(`/settings/org/company-services/suggest${qs ? `?${qs}` : ''}`, { auth: true });
}

export async function apiSetCompanyServices(services: string[]) {
  return apiFetch<{ services: string[] }>('/settings/org/company-services', {
    method: 'PUT',
    auth: true,
    body: { services },
  });
}

export async function apiAppendCompanyService(service: string) {
  return apiFetch<{ services: string[] }>('/settings/org/company-services/append', {
    method: 'POST',
    auth: true,
    body: { service },
  });
}

export async function apiGetAgreementLevelCatalog() {
  return apiFetch<StatusCatalogResponse>('/settings/org/agreement-levels', { auth: true });
}

export async function apiAppendAgreementLevel(level: string) {
  return apiFetch<StatusCatalogResponse>('/settings/org/agreement-levels/append', {
    method: 'POST',
    auth: true,
    body: { level },
  });
}

export async function apiRemoveAgreementLevel(level: string) {
  return apiFetch<StatusCatalogResponse>('/settings/org/agreement-levels/remove', {
    method: 'POST',
    auth: true,
    body: { level },
  });
}

export async function apiCreateSupportTicket(body: {
  subject: string;
  description: string;
  priority?: HqSupportTicketPriority;
  category?: HqSupportTicketCategory;
  organizationName?: string;
}) {
  return apiFetch<{ ticket: HqSupportTicket }>('/support/tickets', {
    method: 'POST',
    body,
    auth: true,
  });
}

export async function apiListMySupportTickets() {
  return apiFetch<{ tickets: HqSupportTicket[]; stats: HqSupportTicketStats }>('/support/tickets', {
    auth: true,
  });
}

export async function apiUpdateMySupportTicket(ticketId: string, status: 'closed') {
  return apiFetch<{ ticket: HqSupportTicket }>(`/support/tickets/${encodeURIComponent(ticketId)}`, {
    method: 'PATCH',
    body: { status },
    auth: true,
  });
}

export async function apiListSupportTicketMessages(ticketId: string) {
  return apiFetch<{
    ticketId: string;
    subject: string;
    status: HqSupportTicketStatus;
    messages: HqSupportTicketMessage[];
  }>(`/support/tickets/${encodeURIComponent(ticketId)}/messages`, { auth: true });
}

export async function apiSendSupportTicketMessage(ticketId: string, body: string) {
  return apiFetch<{ message: HqSupportTicketMessage }>(
    `/support/tickets/${encodeURIComponent(ticketId)}/messages`,
    {
      method: 'POST',
      body: { body },
      auth: true,
    },
  );
}

export async function apiSendInvoiceReminder(invoiceId: string, payload: SendInvoiceReminderPayload) {
  return apiFetch<{ billingRecordId: string; reminder: InvoicePaymentReminder }>(
    `/billing/${encodeURIComponent(invoiceId)}/reminders`,
    { method: 'POST', auth: true, body: payload },
  );
}

export async function apiListInvoiceReminders(invoiceId: string) {
  return apiFetch<{
    billingRecordId: string;
    canRemind: boolean;
    status: string;
    reminders: InvoicePaymentReminder[];
  }>(`/billing/${encodeURIComponent(invoiceId)}/reminders`, { auth: true });
}

export async function apiCancelInvoiceReminder(invoiceId: string, reminderId: string) {
  return apiFetch<{ billingRecordId: string; reminderId: string; status: string }>(
    `/billing/${encodeURIComponent(invoiceId)}/reminders/${encodeURIComponent(reminderId)}`,
    { method: 'DELETE', auth: true },
  );
}

export async function apiGetInvoiceActivity(invoiceId: string) {
  return apiFetch<InvoiceActivityResponse>(`/billing/invoice/${encodeURIComponent(invoiceId)}/activity`, {
    auth: true,
  });
}

export async function apiUpdateInvoiceCurrency(invoiceId: string, currency: string) {
  return apiFetch<{ invoiceId: string; placementId: string | null; currency: string; updatedRecords: number }>(
    `/billing/invoice/${encodeURIComponent(invoiceId)}/currency`,
    { method: 'PATCH', auth: true, body: { currency } }
  );
}

export async function apiGetMe() {
  return apiFetch<BackendUser>('/users/me', { auth: true });
}

export async function apiUpdateMe(data: Partial<BackendUser>) {
  return apiFetch<BackendUser>('/users/me', {
    method: 'PATCH',
    body: data,
    auth: true,
  });
}

export const apiListApplicationFormTemplates = async () => {
  return apiFetch<Array<{ id: string; name: string; schema: unknown }>>(
    '/jobs/application-form-templates',
    { auth: true }
  );
};

export const apiCreateApplicationFormTemplate = async (payload: {
  name: string;
  schema: unknown;
}) => {
  return apiFetch<{ id: string; name: string; schema: unknown }>(
    '/jobs/application-form-templates',
    { method: 'POST', body: payload, auth: true }
  );
};

export const apiListLinkedInPostTemplates = async () => {
  return apiFetch<Array<{ id: string; name: string; schema: unknown; createdAt?: string; updatedAt?: string }>>(
    '/jobs/linkedin-post-templates',
    { auth: true },
  );
};

export const apiCreateLinkedInPostTemplate = async (payload: {
  name: string;
  schema: unknown;
}) => {
  return apiFetch<{ id: string; name: string; schema: unknown }>(
    '/jobs/linkedin-post-templates',
    { method: 'POST', body: payload, auth: true },
  );
};

export const apiUpdateLinkedInPostTemplate = async (
  id: string,
  payload: { name?: string; schema?: unknown },
) => {
  return apiFetch<{ id: string; name: string; schema: unknown }>(
    `/jobs/linkedin-post-templates/${id}`,
    { method: 'PATCH', body: payload, auth: true },
  );
};

export const apiDeleteLinkedInPostTemplate = async (id: string) => {
  return apiFetch<{ deleted: boolean }>(`/jobs/linkedin-post-templates/${id}`, {
    method: 'DELETE',
    auth: true,
  });
};

export const apiGetPublicApplyPage = async (token: string, tenantDbName?: string) => {
  const tenant = String(tenantDbName || '').trim();
  const qs = tenant ? `?tenantDbName=${encodeURIComponent(tenant)}` : '';
  return apiFetch<{ job: Record<string, unknown>; formSchema: unknown }>(
    `/jobs/public/apply/${encodeURIComponent(token)}${qs}`,
    { auth: false, includeTenantHeader: Boolean(tenant) }
  );
};

export const apiSubmitPublicApply = async (
  token: string,
  formData: FormData,
  tenantDbName?: string
) => {
  const tenant = String(tenantDbName || '').trim();
  const qs = tenant ? `?tenantDbName=${encodeURIComponent(tenant)}` : '';
  const headers: Record<string, string> = {};
  if (tenant) headers['x-tenant-db-name'] = tenant;
  const res = await fetch(
    `${API_BASE}/jobs/public/apply/${encodeURIComponent(token)}/submit${qs}`,
    {
      method: 'POST',
      body: formData,
      headers,
    }
  );
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json?.message || 'Failed to submit application');
  }
  return json;
};

export const apiGetPlacements = async (params: PlacementFilters = {}) => {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      query.set(key, String(value));
    }
  });

  const path = `/placements${query.toString() ? `?${query.toString()}` : ''}`;
  return apiFetch<PlacementPaginatedResponse<Placement>>(path, { auth: true });
};

export const apiGetPlacementStats = async () => {
  return apiFetch<PlacementStats>('/placements/stats', { auth: true });
};

export const apiGetPlacement = async (id: string) => {
  return apiFetch<Placement>(`/placements/${id}`, { auth: true });
};

export const apiCreatePlacement = async (payload: CreatePlacementPayload, offerLetter?: File | null) => {
  const formData = new FormData();
  Object.entries(payload).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      formData.append(key, String(value));
    }
  });
  if (offerLetter) {
    formData.append('offerLetter', offerLetter);
  }
  return apiFetchFormData<Placement>('/placements', formData, {
    method: 'POST',
    auth: true,
  });
};

export const apiUpdatePlacement = async (
  id: string,
  payload: Partial<CreatePlacementPayload & { joiningDate?: string }>
) => {
  return apiFetch<Placement>(`/placements/${id}`, {
    method: 'PATCH',
    body: payload,
    auth: true,
  });
};

export const apiUpdatePlacementStatus = async (id: string, status: string) => {
  return apiFetch<Placement>(`/placements/${id}/status`, {
    method: 'PATCH',
    body: { status },
    auth: true,
  });
};

export const apiMarkPlacementJoined = async (
  id: string,
  payload: MarkJoinedPayload,
  joiningLetter?: File | null
) => {
  const formData = new FormData();
  Object.entries(payload).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      formData.append(key, String(value));
    }
  });
  if (joiningLetter) {
    formData.append('joiningLetter', joiningLetter);
  }
  return apiFetchFormData<Placement>(`/placements/${id}/mark-joined`, formData, {
    method: 'PATCH',
    auth: true,
  });
};

export const apiMarkPlacementFailed = async (id: string, payload: MarkFailedPayload) => {
  return apiFetch<Placement>(`/placements/${id}/mark-failed`, {
    method: 'PATCH',
    body: payload,
    auth: true,
  });
};

export const apiGetNextInvoiceNumber = async () => {
  return apiFetch<{ nextInvoiceNo: string }>('/billing/next-invoice-number', {
    auth: true,
  });
};

export const apiCreatePlacementInvoice = async (
  placementId: string,
  payload: CreatePlacementInvoicePayload = {} as CreatePlacementInvoicePayload
) => {
  return apiFetch<PlacementInvoiceCreateResponse>(`/placements/${placementId}/invoice`, {
    method: 'POST',
    body: payload,
    auth: true,
  });
};

export const apiRequestPlacementReplacement = async (id: string, payload: RequestReplacementPayload) => {
  return apiFetch<Placement>(`/placements/${id}/request-replacement`, {
    method: 'PATCH',
    body: payload,
    auth: true,
  });
};

export const apiSchedulePlacementJoining = async (id: string, payload: ScheduleJoiningPayload) => {
  return apiFetch<Placement>(`/placements/${id}/schedule-joining`, {
    method: 'PATCH',
    body: payload,
    auth: true,
  });
};

export const apiResendPlacementOffer = async (id: string, offerLetter?: File | null) => {
  const formData = new FormData();
  if (offerLetter) {
    formData.append('offerLetter', offerLetter);
  }
  return apiFetchFormData<Placement>(`/placements/${id}/resend-offer`, formData, {
    method: 'PATCH',
    auth: true,
  });
};

export const apiUndoPlacement = async (id: string) => {
  return apiFetch<{ message: string }>(`/placements/${id}/undo`, {
    method: 'PATCH',
    auth: true,
  });
};

export const apiDeletePlacement = async (id: string) => {
  return apiFetch<{ message: string }>(`/placements/${id}`, {
    method: 'DELETE',
    auth: true,
  });
};

export const apiExportPlacements = async (params: PlacementFilters = {}) => {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      query.set(key, String(value));
    }
  });

  const token = getAccessToken();
  if (!token) {
    throw new Error('Authentication required. Please log in.');
  }

  const url = `${API_BASE}/placements/export${query.toString() ? `?${query.toString()}` : ''}`;
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const json = await response.json().catch(() => ({}));
    throw new Error(json?.message || 'Failed to export placements');
  }

  return response.blob();
};

// ────────────────────────────────────────────────────────────
// Matches (Job Candidates)
// ────────────────────────────────────────────────────────────

export const apiGetRecruitmentForwardTargets = async () => {
  return apiFetch<RecruitmentForwardTargets>('/clients/recruitment-forward-targets', { auth: true });
};

export const apiCreateScheduledMeeting = async (
  clientId: string,
  data: CreateScheduledMeetingData
) => {
  return apiFetch<ScheduledMeeting>(`/clients/${clientId}/meetings`, {
    method: 'POST',
    body: data,
    auth: true,
  });
};

export const apiUpdateScheduledMeeting = async (
  clientId: string,
  meetingId: string,
  data: UpdateScheduledMeetingData
) => {
  return apiFetch<ScheduledMeeting>(`/clients/${clientId}/meetings/${meetingId}`, {
    method: 'PATCH',
    body: data,
    auth: true,
  });
};

export const apiDeleteScheduledMeeting = async (
  clientId: string,
  meetingId: string
) => {
  return apiFetch<{ message: string }>(`/clients/${clientId}/meetings/${meetingId}`, {
    method: 'DELETE',
    auth: true,
  });
};

export const apiGetUnifiedCalendar = async (params?: {
  start?: string;
  end?: string;
  mineOnly?: boolean;
  /** When set, load that teammate’s calendar (overrides mineOnly). */
  userId?: string;
}) => {
  const queryParams = new URLSearchParams();
  if (params?.start) queryParams.set('start', params.start);
  if (params?.end) queryParams.set('end', params.end);
  if (params?.mineOnly !== undefined) queryParams.set('mineOnly', String(params.mineOnly));
  if (params?.userId) queryParams.set('userId', params.userId);

  const queryString = queryParams.toString();

  return apiFetch<UnifiedCalendarResponse>(`/calendar${queryString ? `?${queryString}` : ''}`, {
    auth: true,
  });
};

// ────────────────────────────────────────────────────────────
// Client Notes
// ────────────────────────────────────────────────────────────

export const apiGetContacts = async (filters?: ContactFilters) => {
  const query = new URLSearchParams();
  const processedFilters = { ...filters };
  
  // Convert clientId to companyId for backend compatibility
  if (processedFilters?.clientId) {
    processedFilters.companyId = processedFilters.clientId;
    delete processedFilters.clientId;
  }
  
  // Convert type to contactType for backend compatibility
  if (processedFilters?.type && !processedFilters.contactType) {
    processedFilters.contactType = processedFilters.type;
    delete processedFilters.type;
  }
  
  Object.entries(processedFilters || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      if (Array.isArray(value)) {
        value.forEach(v => query.append(key, String(v)));
      } else {
        query.append(key, String(value));
      }
    }
  });

  const response = await apiFetch<ApiResponse<BackendContact[]>>(`/contacts?${query.toString()}`, { auth: true });
  return {
    ...response,
    data: dedupeContactsPayload(response.data),
  };
};

export const apiGetContact = async (id: string) => {
  return apiFetch<BackendContact>(`/contacts/${id}`, { auth: true });
};

export const apiCreateContact = async (data: CreateContactData) => {
  const processedData = { ...data };
  
  // Convert clientId to companyId for backend compatibility
  if (processedData.clientId && !processedData.companyId) {
    processedData.companyId = processedData.clientId;
    delete processedData.clientId;
  }
  
  return apiFetch<ApiResponse<BackendContact>>('/contacts', {
    method: 'POST',
    body: processedData,
    auth: true,
  });
};

export const apiUpdateContact = async (id: string, data: Partial<CreateContactData>) => {
  return apiFetch<ApiResponse<BackendContact>>(`/contacts/${id}`, {
    method: 'PATCH',
    body: data,
    auth: true,
  });
};

export const apiDeleteContact = async (id: string) => {
  return apiFetch<ApiResponse<{ message: string }>>(`/contacts/${id}`, {
    method: 'DELETE',
    auth: true,
  });
};

export const apiPreviewContactImport = async (file: File) => {
  const formData = new FormData();
  formData.append('file', file);
  return apiFetchFormData<ContactImportPreviewResult>('/contacts/import/preview', formData, {
    method: 'POST',
    auth: true,
  });
};

export const apiImportContacts = async (payload: {
  rows: Record<string, string | number | boolean | null>[];
  mapping: Record<string, string>;
  duplicateRule: string;
}) => {
  return apiFetch<ContactImportExecuteResult>('/contacts/import', {
    method: 'POST',
    body: payload,
    auth: true,
  });
};

export const apiGetContactStats = async () => {
  return apiFetch<ApiResponse<ContactStats>>('/contacts/stats', { auth: true });
};

export const apiBulkActionContacts = async (action: string, contactIds: string[], payload?: any) => {
  return apiFetch<ApiResponse<any>>('/contacts/bulk', {
    method: 'POST',
    body: { action, contactIds, payload },
    auth: true,
  });
};

export const apiMergeContacts = async (primaryId: string, duplicateId: string) => {
  return apiFetch<ApiResponse<{ message: string }>>('/contacts/merge', {
    method: 'POST',
    body: { primaryId, duplicateId },
    auth: true,
  });
};

export const apiAddContactNote = async (contactId: string, note: string) => {
  return apiFetch<ApiResponse<BackendContactNote>>(`/contacts/${contactId}/notes`, {
    method: 'POST',
    body: { note },
    auth: true,
  });
};

export const apiAddContactActivity = async (contactId: string, activityType: string, description: string) => {
  return apiFetch<ApiResponse<BackendContactActivity>>(`/contacts/${contactId}/activities`, {
    method: 'POST',
    body: { activityType, description },
    auth: true,
  });
};

export const apiAddContactCommunication = async (
  contactId: string,
  type: string,
  message: string,
  direction: string,
  subject?: string
) => {
  return apiFetch<ApiResponse<BackendContactCommunication>>(`/contacts/${contactId}/communications`, {
    method: 'POST',
    body: { type, message, direction, subject },
    auth: true,
  });
};

export const apiDetectContactDuplicates = async (email?: string, name?: string) => {
  const query = new URLSearchParams();
  if (email) query.append('email', email);
  if (name) query.append('name', name);
  return apiFetch<{ duplicates: Array<{ match: string; contact: BackendContact }> }>(
    `/contacts/duplicates?${query.toString()}`,
    { auth: true }
  );
};

export const apiGetUsers = async (params?: {
  role?: string;
  isActive?: boolean;
  search?: string;
  page?: number;
  limit?: number;
  /** When true, returns only this tenant’s assignable team (excludes HQ / platform accounts). */
  assignable?: boolean;
  companyId?: string;
  orgUnitId?: string;
  /** Assignment Rules module (Jobs, Interviews, Candidates, …). */
  module?: string;
}) => {
  const queryParams = new URLSearchParams();
  if (params?.role) queryParams.append('role', params.role);
  if (params?.isActive !== undefined) queryParams.append('isActive', String(params.isActive));
  if (params?.search) queryParams.append('search', params.search);
  if (params?.page) queryParams.append('page', String(params.page));
  if (params?.limit) queryParams.append('limit', String(params.limit));
  if (params?.assignable) queryParams.append('assignable', 'true');
  if (params?.companyId) queryParams.append('companyId', params.companyId);
  if (params?.orgUnitId) queryParams.append('orgUnitId', params.orgUnitId);
  if (params?.module) queryParams.append('module', params.module);

  const path = `/users${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
  return apiFetch<BackendUser[] | { data: BackendUser[]; pagination?: any }>(path, {
    method: 'GET',
    auth: true,
  });
};

/** Global activity feed (GET /activities) */

export async function apiGetActivityCapabilities() {
  return apiFetch<ActivityVisibilityCapabilities>('/activities/capabilities', { auth: true });
}

export const apiGetActivityFeed = async (params?: {
  page?: number;
  limit?: number;
  entityType?: string;
  category?: string;
  search?: string;
  mine?: boolean;
  scope?: 'self' | 'team' | 'department' | 'tenant';
  performedById?: string;
  departmentId?: string;
  from?: string;
  to?: string;
}) => {
  const queryParams = new URLSearchParams();
  if (params?.page) queryParams.append('page', String(params.page));
  if (params?.limit) queryParams.append('limit', String(params.limit));
  if (params?.entityType) queryParams.append('entityType', params.entityType);
  if (params?.category) queryParams.append('category', params.category);
  if (params?.search) queryParams.append('search', params.search);
  if (params?.mine) queryParams.append('mine', 'true');
  if (params?.scope) queryParams.append('scope', params.scope);
  if (params?.performedById) queryParams.append('performedById', params.performedById);
  if (params?.departmentId) queryParams.append('departmentId', params.departmentId);
  if (params?.from) queryParams.append('from', params.from);
  if (params?.to) queryParams.append('to', params.to);
  const qs = queryParams.toString();
  return apiFetch<{ data: BackendGlobalActivity[]; pagination: any }>(`/activities${qs ? `?${qs}` : ''}`, {
    auth: true,
  });
};

export async function apiGetTaskActivities(taskId: string) {
  return apiFetch<BackendActivity[]>(`/tasks/${encodeURIComponent(taskId)}/activities`, { auth: true });
}

export const apiGetTasks = async (params?: {
  assignedToId?: string;
  status?: string;
  priority?: string;
  linkedEntityType?: string;
  linkedEntityId?: string;
  page?: number;
  limit?: number;
}) => {
  const query = new URLSearchParams();
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      query.set(key, String(value));
    }
  });
  const qs = query.toString();
  const path = `/tasks${qs ? `?${qs}` : ''}`;
  return apiFetch<{ data: BackendTask[]; pagination?: any } | BackendTask[]>(path, { auth: true });
};

export const apiGetTask = async (id: string) => {
  return apiFetch<BackendTask>(`/tasks/${id}`, { auth: true });
};

export const apiGetTaskStats = async (userId?: string) => {
  const query = userId ? `?userId=${userId}` : '';
  return apiFetch<TaskStats>(`/tasks/stats${query}`, { auth: true });
};

export const apiCreateTask = async (data: CreateTaskData) => {
  return apiFetch<BackendTask>('/tasks', {
    method: 'POST',
    body: data,
    auth: true,
  });
};

export const apiUpdateTask = async (id: string, data: UpdateTaskData) => {
  return apiFetch<BackendTask>(`/tasks/${id}`, {
    method: 'PATCH',
    body: data,
    auth: true,
  });
};

export const apiDelegateTask = async (
  id: string,
  payload: { assignToId: string; setSelfAsApprover?: boolean; completionApproverId?: string },
) => {
  return apiFetch<BackendTask>(`/tasks/${id}/delegate`, {
    method: 'POST',
    body: payload,
    auth: true,
  });
};

export const apiDeleteTask = async (id: string) => {
  return apiFetch<{ message: string }>(`/tasks/${id}`, {
    method: 'DELETE',
    auth: true,
  });
};

export const apiMarkTaskCompleted = async (id: string) => {
  return apiFetch<{ task: BackendTask; submittedForApproval?: boolean }>(`/tasks/${id}/complete`, {
    method: 'POST',
    auth: true,
  });
};

export const apiApproveTaskCompletion = async (id: string) => {
  return apiFetch<BackendTask>(`/tasks/${id}/approve-completion`, {
    method: 'POST',
    auth: true,
  });
};

export const apiRejectTaskCompletion = async (id: string, note?: string) => {
  return apiFetch<BackendTask>(`/tasks/${id}/reject-completion`, {
    method: 'POST',
    body: note ? { note } : {},
    auth: true,
  });
};

export const apiAddTaskNote = async (taskId: string, note: string) => {
  return apiFetch<BackendTask>(`/tasks/${taskId}/notes`, {
    method: 'POST',
    body: { note },
    auth: true,
  });
};

// ────────────────────────────────────────────────────────────
// Task Files
// ────────────────────────────────────────────────────────────

export const apiGetGmailInbox = async (params?: {
  q?: string;
  maxResults?: number;
  pageToken?: string;
  labelId?: 'INBOX' | 'STARRED' | 'SNOOZED' | 'SENT' | 'DRAFT';
}) => {
  const query = new URLSearchParams();
  if (params?.q) query.set('q', params.q);
  if (params?.maxResults) query.set('maxResults', String(params.maxResults));
  if (params?.pageToken) query.set('pageToken', params.pageToken);
  if (params?.labelId) query.set('labelId', params.labelId);
  const suffix = query.toString() ? `?${query.toString()}` : '';
  const res = await apiFetch<GmailInboxResponse>(`/inbox/gmail/messages${suffix}`, {
    method: 'GET',
    auth: true,
  });
  return res.data;
};

export const apiGetGmailMessage = async (messageId: string) => {
  const res = await apiFetch<GmailInboxMessage>(`/inbox/gmail/messages/${messageId}`, {
    method: 'GET',
    auth: true,
  });
  return res.data;
};

export const apiArchiveGmailMessage = async (messageId: string) => {
  const res = await apiFetch<GmailMessageActionResult>(`/inbox/gmail/messages/${messageId}/archive`, {
    method: 'POST',
    auth: true,
  });
  return res.data;
};

export const apiTrashGmailMessage = async (messageId: string) => {
  const res = await apiFetch<GmailMessageActionResult>(`/inbox/gmail/messages/${messageId}/trash`, {
    method: 'POST',
    auth: true,
  });
  return res.data;
};

export const apiUpdateGmailMessageFlags = async (
  messageId: string,
  body: { unread?: boolean; starred?: boolean }
) => {
  const res = await apiFetch<GmailMessageActionResult>(`/inbox/gmail/messages/${messageId}/flags`, {
    method: 'PATCH',
    body,
    auth: true,
  });
  return res.data;
};

export const apiCreateCalendarEventFromGmailMessage = async (messageId: string) => {
  const res = await apiFetch<GmailMessageActionResult>(`/inbox/gmail/messages/${messageId}/calendar-event`, {
    method: 'POST',
    auth: true,
  });
  return res.data;
};

export const apiGetMailboxStatus = async () => {
  const res = await apiFetch<MailboxStatusResponse>('/inbox/mailboxes/status', {
    method: 'GET',
    auth: true,
  });
  return res.data;
};

export const apiGetOutlookInbox = async (params?: {
  q?: string;
  maxResults?: number;
  pageToken?: string;
  labelId?: 'INBOX' | 'STARRED' | 'SNOOZED' | 'SENT' | 'DRAFT';
}) => {
  const query = new URLSearchParams();
  if (params?.q) query.set('q', params.q);
  if (params?.maxResults) query.set('maxResults', String(params.maxResults));
  if (params?.pageToken) query.set('pageToken', params.pageToken);
  if (params?.labelId) query.set('labelId', params.labelId);
  const suffix = query.toString() ? `?${query.toString()}` : '';
  const res = await apiFetch<GmailInboxResponse>(`/inbox/outlook/messages${suffix}`, {
    method: 'GET',
    auth: true,
  });
  return res.data;
};

export const apiGetOutlookMessage = async (messageId: string) => {
  const res = await apiFetch<GmailInboxMessage>(
    `/inbox/outlook/messages/${encodeURIComponent(messageId)}`,
    {
      method: 'GET',
      auth: true,
    }
  );
  return res.data;
};

export const apiArchiveOutlookMessage = async (messageId: string) => {
  const res = await apiFetch<GmailMessageActionResult>(
    `/inbox/outlook/messages/${encodeURIComponent(messageId)}/archive`,
    {
      method: 'POST',
      auth: true,
    }
  );
  return res.data;
};

export const apiTrashOutlookMessage = async (messageId: string) => {
  const res = await apiFetch<GmailMessageActionResult>(
    `/inbox/outlook/messages/${encodeURIComponent(messageId)}/trash`,
    {
      method: 'POST',
      auth: true,
    }
  );
  return res.data;
};

export const apiUpdateOutlookMessageFlags = async (
  messageId: string,
  body: { unread?: boolean; starred?: boolean }
) => {
  const res = await apiFetch<GmailMessageActionResult>(
    `/inbox/outlook/messages/${encodeURIComponent(messageId)}/flags`,
    {
      method: 'PATCH',
      body,
      auth: true,
    }
  );
  return res.data;
};

export const apiCreateCalendarEventFromOutlookMessage = async (messageId: string) => {
  const res = await apiFetch<GmailMessageActionResult>(
    `/inbox/outlook/messages/${encodeURIComponent(messageId)}/calendar-event`,
    {
      method: 'POST',
      auth: true,
    }
  );
  return res.data;
};

export const apiCreateOutlookComposeDraft = async (body: {
  to?: string;
  cc?: string;
  bcc?: string;
  subject: string;
  body: string;
}) => {
  const res = await apiFetch<OutlookComposeDraftResult>('/inbox/outlook/compose-draft', {
    method: 'POST',
    body,
    auth: true,
  });
  return res.data;
};

/** Send mail from the connected Outlook mailbox via Microsoft Graph. */

export const apiSendOutlookComposeMail = async (body: {
  to?: string;
  cc?: string;
  bcc?: string;
  subject: string;
  body: string;
  attachments?: Array<{
    filename: string;
    contentType: string;
    contentBase64: string;
  }>;
}) => {
  const res = await apiFetch<OutlookSendMailResult>('/inbox/outlook/send-mail', {
    method: 'POST',
    body,
    auth: true,
  });
  return res.data;
};

/** Create a Gmail draft with HTML clickable links, then open it in Gmail. */

export const apiCreateGmailComposeDraft = async (body: {
  to?: string;
  cc?: string;
  bcc?: string;
  subject: string;
  body: string;
}) => {
  const res = await apiFetch<OutlookComposeDraftResult>('/inbox/gmail/compose-draft', {
    method: 'POST',
    body,
    auth: true,
  });
  return res.data;
};

/** Send mail from the connected Gmail mailbox via Gmail API (HTML body). */

export const apiSendGmailComposeMail = async (body: {
  to?: string;
  cc?: string;
  bcc?: string;
  subject: string;
  body: string;
  attachments?: Array<{
    filename: string;
    contentType: string;
    contentBase64: string;
  }>;
}) => {
  const res = await apiFetch<OutlookSendMailResult>('/inbox/gmail/send-mail', {
    method: 'POST',
    body,
    auth: true,
  });
  return res.data;
};

export const apiGetGmailSignature = async () => {
  const res = await apiFetch<MailboxSignatureResult>('/inbox/gmail/signature', { auth: true });
  return res.data;
};

/** Outlook signatures are not exposed by Graph — returns empty so the app signature is used. */

export const apiGetOutlookSignature = async () => {
  const res = await apiFetch<MailboxSignatureResult>('/inbox/outlook/signature', { auth: true });
  return res.data;
};

export const apiGetEntityChatThread = async (
  entityType: EntityChatType,
  entityId: string,
) => {
  const id = String(entityId || '').trim();
  if (!id) return null;

  const res = await apiFetch<any>(
    `/inbox/threads?relatedEntityType=${encodeURIComponent(entityType)}&relatedEntityId=${encodeURIComponent(id)}`,
    {
      method: 'GET',
      auth: true,
    },
  );

  const threads = parseInboxThreadList(res.data);
  return threads.length > 0 ? threads[0] : null;
};

// Get (at most one) chat thread for a task, if it exists

export const apiGetTaskChatThread = async (taskId: string) => {
  return apiGetEntityChatThread('TASK', taskId);
};

// Get full thread with all messages

export const apiGetInboxThread = async (threadId: string) => {
  const res = await apiFetch<InboxThread>(`/inbox/threads/${threadId}`, {
    method: 'GET',
    auth: true,
  });
  return res.data;
};

// Create a chat thread for an entity with an initial message

export const apiCreateEntityChatThread = async (
  entityType: EntityChatType,
  entityId: string,
  options: {
    subject?: string;
    initialMessage: string;
    participantIds?: string[];
  },
) => {
  const id = String(entityId || '').trim();
  if (!id) throw new Error('Entity id is required');

  const res = await apiFetch<InboxThread>('/inbox/threads', {
    method: 'POST',
    body: {
      subject: options.subject || 'Team chat',
      relatedEntityType: entityType,
      relatedEntityId: id,
      participantIds: options.participantIds || [],
      initialMessage: options.initialMessage,
      attachments: [],
    },
    auth: true,
  });
  return res.data;
};

// Create a chat thread for a task with an initial message

export const apiCreateTaskChatThread = async (taskId: string, initialMessage: string) => {
  return apiCreateEntityChatThread('TASK', taskId, {
    subject: 'Task Internal Chat',
    initialMessage,
  });
};

// Add a message to an existing thread

export const apiAddInboxChatMessage = async (threadId: string, body: string) => {
  const res = await apiFetch<InboxMessage>(`/inbox/threads/${threadId}/messages`, {
    method: 'POST',
    body: {
      body,
      attachments: [],
    },
    auth: true,
  });
  return res.data;
};

/** @deprecated Use apiAddInboxChatMessage */

export const apiAddTaskChatMessage = apiAddInboxChatMessage;

// ── LINKEDIN INTEGRATION ──

export const apiGetLinkedInStatus = async () => {
  return apiFetch<LinkedInStatus>('/linkedin/status', { auth: true });
};

export const apiDisconnectLinkedIn = async () => {
  return apiFetch<{ message: string }>('/linkedin/disconnect', {
    method: 'DELETE',
    auth: true,
  });
};

export const apiGetLinkedInAccounts = async () => {
  return apiFetch<{ accounts: SocialPublishingAccount[] }>('/linkedin/accounts', { auth: true });
};

export const apiDisconnectLinkedInAccount = async (accountId: string) => {
  return apiFetch<{ message: string }>(`/linkedin/accounts/${accountId}`, {
    method: 'DELETE',
    auth: true,
  });
};

// ── GENERAL SOCIAL PUBLISHING ──

export const apiGetSocialStatus = async () => {
  return apiFetch<{
    linkedin: { connected: boolean; accountName?: string; accounts: SocialPublishingAccount[] };
    twitter: {
      connected: boolean;
      accountName?: string;
      accountEmail?: string;
      accounts: SocialPublishingAccount[];
    };
    facebook: { connected: boolean; accountName?: string; accountEmail?: string; accounts?: SocialPublishingAccount[] };
  }>('/social/status', { auth: true });
};

// ── User communication & OAuth (all secrets live on backend .env + encrypted DB) ──

export const apiGetUserCommunication = async () => {
  return apiFetch<CommunicationFullResponse>('/settings/communication', { auth: true });
};

export const apiPutUserCommunication = async (body: PutCommunicationBody) => {
  return apiFetch<CommunicationFullResponse>('/settings/communication', {
    method: 'PUT',
    body,
    auth: true,
  });
};

export const apiPatchUserCommunicationPrefs = async (
  body: Partial<
    Pick<
      CommunicationSettingsShape,
      | 'googleCalendarSync'
      | 'teamsCalendarSync'
      | 'smsAutoNotifications'
      | 'interviewAutoScheduling'
      | 'emailComposeSignature'
      | 'emailComposeSignatureLogoUrl'
    >
  > & { linkedinApp?: Partial<CommunicationFullResponse['linkedinApp']> }
) => {
  return apiFetch<CommunicationFullResponse>('/settings/communication', {
    method: 'PATCH',
    body,
    auth: true,
  });
};

export const apiResetUserCommunication = async () => {
  return apiFetch<CommunicationFullResponse>('/settings/communication/reset', {
    method: 'POST',
    auth: true,
  });
};

export const apiGetCommunicationConnections = async () => {
  return apiFetch<CommunicationConnections>('/settings/communication/connections', { auth: true });
};

export const apiGetNotificationTriggerSettings = async () => {
  return apiFetch<{
    key: string;
    value: NotificationTriggerSettingsPayload;
    scope: string;
    userId?: string | null;
  }>(`/settings/${encodeURIComponent(NOTIFICATION_TRIGGER_SETTINGS_KEY)}`, { auth: true });
};

export const apiUpdateNotificationTriggerSettings = async (
  value: NotificationTriggerSettingsPayload,
) => {
  return apiFetch<{
    key: string;
    value: NotificationTriggerSettingsPayload;
    scope: string;
    userId?: string | null;
  }>(`/settings/${encodeURIComponent(NOTIFICATION_TRIGGER_SETTINGS_KEY)}`, {
    method: 'PATCH',
    auth: true,
    body: {
      scope: 'USER',
      value,
    },
  });
};

// ── Notification trigger templates (subject + HTML) ──

export const apiGetNotificationTriggerTemplatesEffective = async (
  ids: string[],
) => {
  const qs = new URLSearchParams();
  qs.set('ids', Array.isArray(ids) ? ids.filter(Boolean).join(',') : '');
  return apiFetch<{
    effective: Record<string, NotificationTriggerEffectiveTemplate>;
  }>(`/settings/notification-trigger-templates/effective?${qs.toString()}`, { auth: true });
};

export const apiPatchNotificationTriggerTemplatesOverrides = async (
  templates: Record<string, NotificationTriggerTemplateOverride>,
) => {
  return apiFetch<{
    templates: Record<string, NotificationTriggerTemplateOverride>;
    effective: Record<string, NotificationTriggerEffectiveTemplate>;
  }>(`/settings/notification-trigger-templates`, {
    method: 'PATCH',
    auth: true,
    body: { templates },
  });
};

// ── Alerts Management (email + portal bell per event) ──

export const apiGetAlertManagement = async () => {
  return apiFetch<AlertManagementPayload>('/settings/alert-management', { auth: true });
};

export const apiUpdateAlertManagement = async (payload: {
  channels?: Record<string, AlertChannelSettings>;
  scheduledAnalysis?: ScheduledAnalysisSettings;
}) => {
  return apiFetch<AlertManagementPayload>('/settings/alert-management', {
    method: 'PATCH',
    auth: true,
    body: { ...payload, scope: 'ORG' },
  });
};

export const apiTestAlertEmail = async (alertId: string) => {
  return apiFetch<{ alertId: string; to: string }>('/settings/alert-management/test-email', {
    method: 'POST',
    auth: true,
    body: { alertId },
  });
};

export const apiTestAlertPortal = async (alertId: string) => {
  return apiFetch<{ alertId: string; notificationId: string }>(
    '/settings/alert-management/test-portal',
    {
      method: 'POST',
      auth: true,
      body: { alertId },
    },
  );
};

export const apiTestTwilioConnection = async () => {
  return apiFetch<{ success: boolean; message?: string; error?: string }>('/settings/twilio/test', {
    method: 'POST',
    auth: true,
  });
};

/** Fetch OAuth URL with Bearer token, then redirect browser to provider. */

export async function apiGetIntegrationStatuses() {
  return apiFetch<IntegrationStatusResponse>('/integrations/status', { auth: true });
}

export async function apiConnectIntegration(
  provider: IntegrationProvider,
  returnUrl?: string,
  options?: { reopenCreateJobDrawer?: boolean },
) {
  if (typeof window !== 'undefined') {
    sessionStorage.setItem('oauth_navigation', '1');
    sessionStorage.setItem('oauth_provider', provider);
    if (options?.reopenCreateJobDrawer) {
      sessionStorage.setItem('reopen_create_job_drawer', '1');
    }
  }
  const qs = returnUrl ? `?returnUrl=${encodeURIComponent(returnUrl)}` : '';
  const res = await apiFetch<{ url: string }>(`/auth/${provider}${qs}`, { auth: true });
  if (res.data?.url) {
    window.location.href = res.data.url;
    return;
  }
  if (typeof window !== 'undefined') {
    sessionStorage.removeItem('oauth_navigation');
    sessionStorage.removeItem('oauth_provider');
  }
  throw new Error(res.message || 'OAuth URL not available');
}

export async function apiDisconnectIntegration(
  provider: IntegrationProvider,
  connectionId?: string,
) {
  return apiFetch<{ provider: string; connected: boolean }>(`/disconnect/${provider}`, {
    method: 'POST',
    body: connectionId ? { connectionId } : undefined,
    auth: true,
  });
}

export async function apiAssistantChat(body: {
  messages: AssistantChatMessage[];
  pageKey?: string;
  pathname?: string;
}) {
  const res = await apiFetch<{
    message: string;
    structured?: AssistantStructuredResponse;
    history?: AssistantHistoryRecord;
  }>('/ai/assistant-chat', {
    method: 'POST',
    body,
    auth: true,
  });

  if (res.data?.structured && !res.data.structured.chatOutput) {
    const fallback = res.data.structured as any;
    res.data.structured = {
      intent: fallback.intent || 'RESPONSE',
      module: fallback.module || '',
      currentPage: fallback.currentPage || body.pageKey || '',
      isBulk: false,
      recordCount: 0,
      clarificationNeeded: false,
      clarificationQuestion: null,
      sessionId: fallback.sessionId || '',
      memoryUpdated: false,
      actions: [],
      result: {
        status: 'SUCCESS',
        created: 0,
        updated: 0,
        deleted: 0,
        skipped: 0,
        failed: 0,
        records: [],
        errors: [],
      },
      chatOutput: {
        headline: '✳️ ARIA',
        summary: fallback.output || res.data.message || '',
        details: [],
        warnings: [],
        aiInsights: [],
        undoLine: '',
        suggestions: [],
      },
      uiPayload: fallback.uiPayload,
      undoPayload: fallback.undoPayload,
    };
  }

  return res;
}

/** HRYANTRA Enterprise Brain — orchestration over tenant data (no OpenAI required by default). */

export async function apiBrainAsk(body: {
  question: string;
  sessionKey?: string;
  pathname?: string;
  messages?: Array<{ role: 'user' | 'assistant'; content: string }>;
  executeWorkflow?: {
    action_type: string;
    record_id?: string;
    payload?: Record<string, unknown>;
    confirm?: boolean;
  } | null;
}) {
  return apiFetch<BrainAskResult>('/brain/ask', {
    method: 'POST',
    body,
    auth: true,
  });
}

export async function apiBrainSchema(entityId?: string) {
  const path = entityId ? `/brain/schema/${encodeURIComponent(entityId)}` : '/brain/schema';
  return apiFetch<{ modules?: unknown[]; entities?: unknown[]; entity?: unknown; relationships?: unknown }>(
    path,
    { auth: true },
  );
}

export async function apiBrainAnalytics() {
  return apiFetch<{ ok: boolean; metrics?: Record<string, number>; summary?: string }>('/brain/analytics', {
    auth: true,
  });
}

export async function apiBrainHealth() {
  return apiFetch<Record<string, unknown>>('/brain/health', { auth: true });
}

export async function apiExecuteUndo(actionId: string) {
  return apiFetch<{
    success: boolean;
    message: string;
    uiReverse?: AriaUndoPayload['uiReverse'];
  }>('/ai/aria/undo', {
    method: 'POST',
    body: { actionId },
    auth: true,
  });
}

export async function apiGetAssistantHistory(pageKey: string) {
  return apiFetch<AssistantHistoryRecord>(`/ai/assistant-history/${encodeURIComponent(pageKey)}`, {
    auth: true,
  });
}

export async function apiSaveAssistantHistory(
    pageKey: string,
    body: {
      pathname?: string;
      messages: AssistantHistoryMessage[];
      conversationMemory?: AssistantConversationMemory;
      taskMemory?: { tasks: AssistantTaskChain[] };
      actionLog?: AssistantActionLogItem[];
    }
  ) {
  return apiFetch<AssistantHistoryRecord>(`/ai/assistant-history/${encodeURIComponent(pageKey)}`, {
    method: 'PUT',
    body,
    auth: true,
  });
}

export async function apiDeleteAssistantHistory(pageKey: string) {
  return apiFetch<{ pageKey: string; deleted: boolean }>(`/ai/assistant-history/${encodeURIComponent(pageKey)}`, {
    method: 'DELETE',
    auth: true,
  });
}

export async function apiListNotifications(params?: {
  category?: AppNotificationCategory | 'ALL';
  onlyUnread?: boolean;
  take?: number;
}) {
  const search = new URLSearchParams();
  if (params?.category && params.category !== 'ALL') {
    search.set('category', params.category);
  }
  if (params?.onlyUnread) search.set('onlyUnread', 'true');
  if (params?.take) search.set('take', String(params.take));
  const query = search.toString();
  return apiFetch<NotificationsListResponse>(
    `/notifications${query ? `?${query}` : ''}`,
    { method: 'GET', auth: true }
  );
}

/** Push overdue / due-today / upcoming lead+client follow-ups into Alerts + email. */

export async function apiSyncFollowUpAlerts() {
  return apiFetch<{
    leads?: { dispatched?: number; scanned?: number } | null;
    clients?: { dispatched?: number; scanned?: number } | null;
  }>('/notifications/sync-follow-up-alerts', {
    method: 'POST',
    auth: true,
  });
}

export async function apiGetNotificationUnreadCount(): Promise<{
  success: boolean;
  count: number;
}> {
  const res = await apiFetch<undefined>('/notifications/unread-count', {
    method: 'GET',
    auth: true,
  });
  // Backend returns { success, count } at the top level (not inside `data`).
  return {
    success: !!(res as unknown as { success: boolean }).success,
    count: Number((res as unknown as { count?: number }).count ?? 0),
  };
}

export async function apiMarkNotificationRead(id: string) {
  const res = await apiFetch<undefined>(`/notifications/${id}/read`, {
    method: 'PUT',
    auth: true,
  });
  emitNotificationsUpdated();
  return res;
}

export async function apiMarkAllNotificationsRead() {
  const res = await apiFetch<undefined>('/notifications/mark-all-read', {
    method: 'PUT',
    auth: true,
  });
  emitNotificationsUpdated();
  return res;
}

export async function apiDeleteNotification(id: string) {
  const res = await apiFetch<undefined>(`/notifications/${id}`, {
    method: 'DELETE',
    auth: true,
  });
  emitNotificationsUpdated();
  return res;
}

export async function apiCreateNotification(payload: {
  category?: AppNotificationCategory;
  title: string;
  description?: string;
  actionLabel?: string | null;
  actionPath?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const res = await apiFetch<AppNotification>('/notifications', {
    method: 'POST',
    body: payload,
    auth: true,
  });
  emitNotificationsUpdated();
  return res;
}

// ────────────────────────────────────────────────────────────
// Recycle Bin — soft-deleted records (leads / clients / candidates / jobs).
// Backed by GET /trash, POST /:id/restore, DELETE /:id/purge per entity module.
// ────────────────────────────────────────────────────────────

/** Lightweight shape every Recycle Bin row exposes (raw backend payload still flows through). */
