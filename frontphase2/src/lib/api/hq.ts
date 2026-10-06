/* hq API */
import { apiFetch, apiFetchFormData } from './core';
import { dedupeCompanyNamedPayload } from '../companyNameKey';
import type { CreateClientData, CreateLeadData, HqAccountSupportLookup, HqAiCoinPack, HqAiFeature, HqAnalyticsPayload, HqBillingCandidateLedgerPayload, HqBillingEmployerLedgerPayload, HqBillingPayload, HqCandidateBehaviorAnalysis, HqCompanyApiRow, HqCompanyStats, HqCourseCertificate, HqCourseEnrollmentResult, HqCoursePayload, HqCourseRow, HqCourseStats, HqCustomReportRow, HqDemoRequestApiRow, HqDemoStats, HqHelpTicket, HqHelpTicketMessage, HqHelpTicketStats, HqHelpTicketStatus, HqKycInterviewerRow, HqLeadApiRow, HqLeadStats, HqLeadStorageInfo, HqPermissionRow, HqPortalCandidateRow, HqPortalJobRow, HqPortalStats, HqPortalStorageInfo, HqPushJobsToFeedsResult, HqRoleRow, HqSubscriptionPackage, HqSupportTicket, HqSupportTicketMessage, HqSupportTicketPriority, HqSupportTicketStats, HqSupportTicketStatus, HqSyncTenantJobsToPhase1Result, HqTeamMemberRow, HqTeamMemberStatus, HqTeamStats, HqTenantBehaviorAnalysis, HqTenantRow, HqTenantSubscriptionPlan } from './types';


export async function apiHqProvisionTenant(body: {
  name: string;
  organizationName?: string;
  email: string;
  loginId: string;
  password: string;
  organizationType?: 'agency' | 'standalone';
  billingCycle?: 'monthly' | 'annual';
  planStartDate?: string;
  planEndDate?: string;
  /** Phase 2 workspace line: CRM or Recruitment */
  productLine?: 'crm' | 'recruitment';
  /** Enabled Phase 2 sidebar module ids for this tenant */
  enabledModules?: string[];
  /** When true, All candidates includes Phase 1 (Hrayntra) candidatecommon pool. Default true. */
  phase1CommonPoolEnabled?: boolean;
  /** Optional HQ company id (Lead → Client → Company funnel) */
  companyId?: string;
  plan?: {
    id?: string;
    name?: string;
    billingCycle?: 'monthly' | 'annual';
    planStartDate?: string;
    planEndDate?: string;
    price?: string;
    maxUsers?: number | null;
    maxJobs?: number | null;
    coins?: number;
  };
}) {
  return apiFetch<{
    tenantDbName?: string;
    tenantDatabaseUrl?: string;
    tenantProvisioningMode?: string;
    organizationType?: string;
    productLine?: 'crm' | 'recruitment';
    enabledModules?: string[];
    phase1CommonPoolEnabled?: boolean;
    subscriptionPlan?: { name: string } | null;
    user?: { id: string; email: string; loginId: string };
    companyId?: string | null;
  }>('/hq/provision-tenant', { method: 'POST', auth: true, body });
}

export async function apiHqListPackages() {
  return apiFetch<{
    packages: HqSubscriptionPackage[];
  }>('/hq/packages', { auth: true });
}

export async function apiHqCreatePackage(body: {
  name: string;
  displayName?: string;
  description?: string;
  price?: string;
  yearlyPrice?: string;
  pricePeriod?: string;
  features?: string[];
  isPopular?: boolean;
  maxUsers?: number | null;
  maxJobs?: number | null;
  annualMaxUsers?: number | null;
  annualMaxJobs?: number | null;
}) {
  return apiFetch<{ package: HqSubscriptionPackage }>('/hq/packages', {
    method: 'POST',
    auth: true,
    body,
  });
}

export async function apiHqUpdatePackage(
  packageId: string,
  body: {
    name?: string;
    displayName?: string;
    description?: string;
    price?: string;
    yearlyPrice?: string;
    pricePeriod?: string;
    features?: string[];
    isPopular?: boolean;
    maxUsers?: number | null;
    maxJobs?: number | null;
    annualMaxUsers?: number | null;
    annualMaxJobs?: number | null;
  }
) {
  return apiFetch<{ package: HqSubscriptionPackage }>(`/hq/packages/${encodeURIComponent(packageId)}`, {
    method: 'PUT',
    auth: true,
    body,
  });
}

export async function apiHqDeletePackage(packageId: string) {
  return apiFetch<{ deleted: boolean; id: string }>(`/hq/packages/${encodeURIComponent(packageId)}`, {
    method: 'DELETE',
    auth: true,
  });
}

export async function apiHqListTenants() {
  return apiFetch<{
    tenants: HqTenantRow[];
    stats: {
      total: number;
      agency: number;
      standalone: number;
      landingPurchases?: number;
      landingTrials?: number;
      planCounts: Record<string, number>;
    };
    planOptions: HqSubscriptionPackage[];
  }>('/hq/tenants', { auth: true });
}

export async function apiHqAccountSupportLookup(params: {
  email?: string;
  customerId?: string;
  tenantDbName?: string;
  q?: string;
}) {
  const q = new URLSearchParams();
  if (params.email) q.set('email', params.email);
  if (params.customerId) q.set('customerId', params.customerId);
  if (params.tenantDbName) q.set('tenantDbName', params.tenantDbName);
  if (params.q) q.set('q', params.q);
  return apiFetch<HqAccountSupportLookup>(`/hq/account-support?${q.toString()}`, {
    auth: true,
  });
}

export async function apiHqListLeads() {
  const response = await apiFetch<{
    leads: HqLeadApiRow[];
    stats: HqLeadStats;
    storage: HqLeadStorageInfo;
  }>('/hq/leads', { auth: true });
  return {
    ...response,
    data: dedupeCompanyNamedPayload(response.data),
  };
}

export async function apiHqListDemoRequests() {
  return apiFetch<{
    demos: HqDemoRequestApiRow[];
    stats: HqDemoStats;
    storage: HqLeadStorageInfo;
  }>('/hq/demos', { auth: true });
}

export async function apiHqDeleteDemoRequest(demoId: string) {
  return apiFetch<{
    deleted: boolean;
    id: string;
    storage: HqLeadStorageInfo;
  }>(`/hq/demos/${encodeURIComponent(demoId)}`, { method: 'DELETE', auth: true });
}

export async function apiHqGrantDemoTrial(
  demoId: string,
  body: { trialDays?: number; note?: string } = {}
) {
  return apiFetch<{
    alreadyProvisioned?: boolean;
    tenantDbName?: string;
    loginId?: string;
    loginUrl?: string;
    trialEndsAt?: string | null;
    trialStartsAt?: string | null;
    trialDays?: number;
    credentialEmailSent?: boolean;
    credentialEmailError?: string | null;
    message?: string;
  }>(`/hq/demos/${encodeURIComponent(demoId)}/grant-trial`, {
    method: 'POST',
    auth: true,
    body,
  });
}

export async function apiHqGrantLeadTrial(
  leadId: string,
  body: { email: string; trialDays?: number; note?: string; notifyEmails?: string[] }
) {
  return apiFetch<{
    alreadyProvisioned?: boolean;
    tenantDbName?: string;
    loginId?: string;
    loginUrl?: string;
    trialEndsAt?: string | null;
    trialStartsAt?: string | null;
    trialDays?: number;
    credentialEmailSent?: boolean;
    credentialEmailError?: string | null;
    extraEmailResults?: Array<{ email: string; sent: boolean; error?: string }>;
    message?: string;
    lead?: HqLeadApiRow;
  }>(`/hq/leads/${encodeURIComponent(leadId)}/grant-trial`, {
    method: 'POST',
    auth: true,
    body,
  });
}

export async function apiHqCreateLead(
  body:
    | CreateLeadData
    | {
        contactName: string;
        companyName: string;
        email: string;
        phone?: string;
        industry: string;
        country: string;
        expectedUsers: string | number;
        estimatedDealValue: string | number;
        leadSource: string;
        leadSourceDetail?: string;
        stage?: 'new' | 'contacted' | 'qualified' | 'converted' | 'lost';
        nextFollowUpAt?: string;
        interestedModules: string[];
        initialNotes?: string;
      },
) {
  return apiFetch<{
    lead: HqLeadApiRow;
    storage: HqLeadStorageInfo;
  }>('/hq/leads', { method: 'POST', auth: true, body });
}

export async function apiHqUpdateLead(
  leadId: string,
  body:
    | CreateLeadData
    | Record<string, unknown>
    | {
        contactName: string;
        companyName: string;
        email: string;
        phone?: string;
        industry: string;
        country: string;
        expectedUsers: string | number;
        estimatedDealValue: string | number;
        leadSource: string;
        leadSourceDetail?: string;
        nextFollowUpAt?: string;
        interestedModules: string[];
        initialNotes?: string;
        stage: HqLeadApiRow['stage'];
      },
) {
  return apiFetch<{
    lead: HqLeadApiRow;
    storage: HqLeadStorageInfo;
  }>(`/hq/leads/${encodeURIComponent(leadId)}`, { method: 'PUT', auth: true, body });
}

export async function apiHqDeleteLead(leadId: string) {
  return apiFetch<{
    deleted: boolean;
    id: string;
    storage: HqLeadStorageInfo;
  }>(`/hq/leads/${encodeURIComponent(leadId)}`, { method: 'DELETE', auth: true });
}

export async function apiHqAddLeadFollowUp(
  leadId: string,
  body: {
    type: string;
    scheduledAt: string;
    notes?: string;
  }
) {
  return apiFetch<{
    lead: HqLeadApiRow;
    storage: HqLeadStorageInfo;
  }>(`/hq/leads/${encodeURIComponent(leadId)}/follow-ups`, { method: 'POST', auth: true, body });
}

export async function apiHqUpdateLeadFollowUp(
  leadId: string,
  followUpId: string,
  body: {
    type: string;
    scheduledAt: string;
    notes?: string;
  }
) {
  return apiFetch<{
    lead: HqLeadApiRow;
    storage: HqLeadStorageInfo;
  }>(`/hq/leads/${encodeURIComponent(leadId)}/follow-ups/${encodeURIComponent(followUpId)}`, {
    method: 'PUT',
    auth: true,
    body,
  });
}

export async function apiHqCompleteLeadFollowUp(
  leadId: string,
  followUpId: string,
  body?: { notes?: string; remark?: string; type?: string; scheduledAt?: string },
) {
  return apiFetch<{
    lead: HqLeadApiRow;
    storage: HqLeadStorageInfo;
  }>(
    `/hq/leads/${encodeURIComponent(leadId)}/follow-ups/${encodeURIComponent(followUpId)}/complete`,
    { method: 'POST', auth: true, body: body || {} },
  );
}

export async function apiHqDeleteLeadFollowUp(leadId: string, followUpId: string) {
  return apiFetch<{
    lead: HqLeadApiRow;
    storage: HqLeadStorageInfo;
  }>(`/hq/leads/${encodeURIComponent(leadId)}/follow-ups/${encodeURIComponent(followUpId)}`, {
    method: 'DELETE',
    auth: true,
  });
}

export async function apiHqAddLeadRemark(leadId: string, body: { text: string }) {
  return apiFetch<{
    lead: HqLeadApiRow;
    storage: HqLeadStorageInfo;
  }>(`/hq/leads/${encodeURIComponent(leadId)}/remarks`, { method: 'POST', auth: true, body });
}

export async function apiHqConvertLeadToCompany(leadId: string) {
  return apiFetch<{
    company: HqCompanyApiRow;
    lead: HqLeadApiRow;
    alreadyConverted?: boolean;
    storage: HqLeadStorageInfo;
  }>(`/hq/leads/${encodeURIComponent(leadId)}/convert-to-company`, {
    method: 'POST',
    auth: true,
    body: {},
  });
}

export async function apiHqListCompanies() {
  const response = await apiFetch<{
    companies: HqCompanyApiRow[];
    stats: HqCompanyStats;
    storage: HqLeadStorageInfo;
  }>('/hq/companies', { auth: true });
  return {
    ...response,
    data: dedupeCompanyNamedPayload(response.data),
  };
}

export async function apiHqListTickets(params?: {
  status?: string;
  priority?: string;
  tenantDbName?: string;
}) {
  const query = new URLSearchParams();
  if (params?.status) query.set('status', params.status);
  if (params?.priority) query.set('priority', params.priority);
  if (params?.tenantDbName) query.set('tenantDbName', params.tenantDbName);
  const qs = query.toString();
  return apiFetch<{ tickets: HqSupportTicket[]; stats: HqSupportTicketStats }>(
    `/hq/tickets${qs ? `?${qs}` : ''}`,
    { auth: true },
  );
}

export async function apiHqUpdateTicket(
  ticketId: string,
  body: { status?: HqSupportTicketStatus; priority?: HqSupportTicketPriority; hqNotes?: string },
) {
  return apiFetch<{ ticket: HqSupportTicket }>(`/hq/tickets/${encodeURIComponent(ticketId)}`, {
    method: 'PATCH',
    body,
    auth: true,
  });
}

/** Phase 1 Help-page tickets (candidate portal `/help` → `/api/hq-tickets`). */

export async function apiHqListHelpTickets(params?: {
  status?: HqHelpTicketStatus | '';
  email?: string;
  id?: string;
  limit?: number;
}) {
  const query = new URLSearchParams();
  if (params?.status) query.set('status', params.status);
  if (params?.email) query.set('email', params.email);
  if (params?.id) query.set('id', params.id);
  if (params?.limit) query.set('limit', String(params.limit));
  const qs = query.toString();
  return apiFetch<{
    tickets: HqHelpTicket[];
    stats: HqHelpTicketStats;
    openCount?: number;
    count?: number;
    note?: string | null;
    source?: string;
  }>(`/hq/help-tickets${qs ? `?${qs}` : ''}`, { auth: true });
}

export async function apiHqUpdateHelpTicket(ticketId: string, status: HqHelpTicketStatus) {
  return apiFetch<{ ticket: HqHelpTicket }>(
    `/hq/help-tickets/${encodeURIComponent(ticketId)}`,
    {
      method: 'PATCH',
      body: { status },
      auth: true,
    },
  );
}

export async function apiHqListHelpTicketMessages(ticketId: string) {
  return apiFetch<{
    ticketId: string;
    subject: string;
    status: HqHelpTicketStatus;
    messages: HqHelpTicketMessage[];
  }>(`/hq/help-tickets/${encodeURIComponent(ticketId)}/messages`, { auth: true });
}

export async function apiHqSendHelpTicketMessage(ticketId: string, body: string) {
  return apiFetch<{ message: HqHelpTicketMessage }>(
    `/hq/help-tickets/${encodeURIComponent(ticketId)}/messages`,
    {
      method: 'POST',
      body: { body },
      auth: true,
    },
  );
}

export async function apiHqListSupportTicketMessages(ticketId: string) {
  return apiFetch<{
    ticketId: string;
    subject: string;
    status: HqSupportTicketStatus;
    messages: HqSupportTicketMessage[];
  }>(`/hq/tickets/${encodeURIComponent(ticketId)}/messages`, { auth: true });
}

export async function apiHqSendSupportTicketMessage(ticketId: string, body: string) {
  return apiFetch<{ message: HqSupportTicketMessage }>(
    `/hq/tickets/${encodeURIComponent(ticketId)}/messages`,
    {
      method: 'POST',
      body: { body },
      auth: true,
    },
  );
}

export async function apiHqCreateCompany(
  body:
    | CreateClientData
    | {
        companyName: string;
        primaryContactName: string;
        email: string;
        phone?: string;
        website?: string;
        industry: string;
        country: string;
        expectedUsers: string | number;
        estimatedDealValue: string | number;
        pricePerUser?: string | number;
        billingCycle?: 'monthly' | 'yearly' | 'annual';
        finalPrice?: string | number;
        accountOwner: string;
        companySource: string;
        nextFollowUpAt: string;
        interestedModules: string[];
        initialNotes?: string;
      },
) {
  return apiFetch<{ company: HqCompanyApiRow; storage: HqLeadStorageInfo }>(
    '/hq/companies',
    { method: 'POST', auth: true, body }
  );
}

export async function apiHqUploadCompanyLogo(companyId: string, file: File) {
  const formData = new FormData();
  formData.append('file', file);
  return apiFetchFormData<{
    company: HqCompanyApiRow;
    logo: string;
    storage: HqLeadStorageInfo;
  }>(`/hq/companies/${encodeURIComponent(companyId)}/logo`, formData, {
    method: 'POST',
    auth: true,
  });
}

export async function apiHqUpdateCompany(
  companyId: string,
  body:
    | CreateClientData
    | Record<string, unknown>
    | {
        companyName: string;
        primaryContactName: string;
        email: string;
        phone?: string;
        website?: string;
        industry: string;
        country: string;
        expectedUsers: string | number;
        estimatedDealValue: string | number;
        pricePerUser?: string | number;
        billingCycle?: 'monthly' | 'yearly' | 'annual';
        finalPrice?: string | number;
        accountOwner: string;
        companySource: string;
        nextFollowUpAt: string;
        interestedModules: string[];
        initialNotes?: string;
        status: HqCompanyApiRow['status'];
      },
) {
  return apiFetch<{ company: HqCompanyApiRow; storage: HqLeadStorageInfo }>(
    `/hq/companies/${encodeURIComponent(companyId)}`,
    { method: 'PUT', auth: true, body }
  );
}

export async function apiHqDeleteCompany(companyId: string) {
  return apiFetch<{ deleted: boolean; id: string; storage: HqLeadStorageInfo }>(
    `/hq/companies/${encodeURIComponent(companyId)}`,
    { method: 'DELETE', auth: true },
  );
}

export async function apiHqAddCompanyFollowUp(
  companyId: string,
  body: { type: string; scheduledAt: string; notes?: string }
) {
  return apiFetch<{ company: HqCompanyApiRow; storage: HqLeadStorageInfo }>(
    `/hq/companies/${encodeURIComponent(companyId)}/follow-ups`,
    { method: 'POST', auth: true, body }
  );
}

export async function apiHqUpdateCompanyFollowUp(
  companyId: string,
  followUpId: string,
  body: { type: string; scheduledAt: string; notes?: string }
) {
  return apiFetch<{ company: HqCompanyApiRow; storage: HqLeadStorageInfo }>(
    `/hq/companies/${encodeURIComponent(companyId)}/follow-ups/${encodeURIComponent(followUpId)}`,
    { method: 'PUT', auth: true, body }
  );
}

export async function apiHqCompleteCompanyFollowUp(companyId: string, followUpId: string) {
  return apiFetch<{ company: HqCompanyApiRow; storage: HqLeadStorageInfo }>(
    `/hq/companies/${encodeURIComponent(companyId)}/follow-ups/${encodeURIComponent(followUpId)}/complete`,
    { method: 'POST', auth: true, body: {} }
  );
}

export async function apiHqDeleteCompanyFollowUp(companyId: string, followUpId: string) {
  return apiFetch<{ company: HqCompanyApiRow; storage: HqLeadStorageInfo }>(
    `/hq/companies/${encodeURIComponent(companyId)}/follow-ups/${encodeURIComponent(followUpId)}`,
    { method: 'DELETE', auth: true }
  );
}

export async function apiHqAddCompanyRemark(companyId: string, body: { text: string }) {
  return apiFetch<{ company: HqCompanyApiRow; storage: HqLeadStorageInfo }>(
    `/hq/companies/${encodeURIComponent(companyId)}/remarks`,
    { method: 'POST', auth: true, body }
  );
}

export async function apiHqListTeam() {
  return apiFetch<{
    members: HqTeamMemberRow[];
    stats: HqTeamStats;
    storage: HqLeadStorageInfo;
  }>('/hq/team', { auth: true });
}

export async function apiHqCreateTeamMember(body: {
  name?: string;
  firstName?: string;
  lastName?: string;
  email: string;
  role?: string;
  roleId?: string;
  permissionIds?: string[];
  phone?: string;
  designation?: string;
  status?: HqTeamMemberStatus;
  department?: string;
  rank?: number;
  reportsToId?: string | null;
  generateCredentials?: boolean;
  sendInvite?: boolean;
  customLoginId?: string;
  tempPassword?: string;
}) {
  return apiFetch<{
    member: HqTeamMemberRow;
    credentials?: {
      loginId: string;
      tempPassword: string;
      email: string;
      sendInvite: boolean;
      inviteEmailSent?: boolean;
      inviteEmailError?: string | null;
      platformTenantDbName?: string | null;
    } | null;
    storage: HqLeadStorageInfo;
  }>('/hq/team', {
    method: 'POST',
    auth: true,
    body,
  });
}

export async function apiHqUpdateTeamMember(
  memberId: string,
  body: {
    name?: string;
    firstName?: string;
    lastName?: string;
    email: string;
    role?: string;
    roleId?: string;
    permissionIds?: string[];
    phone?: string;
    designation?: string;
    status?: HqTeamMemberStatus;
    department?: string;
    rank?: number;
    reportsToId?: string | null;
  },
) {
  return apiFetch<{ member: HqTeamMemberRow; storage: HqLeadStorageInfo }>(
    `/hq/team/${encodeURIComponent(memberId)}`,
    { method: 'PUT', auth: true, body },
  );
}

export async function apiHqDeleteTeamMember(memberId: string) {
  return apiFetch<{ deleted: boolean; id: string; storage: HqLeadStorageInfo }>(
    `/hq/team/${encodeURIComponent(memberId)}`,
    { method: 'DELETE', auth: true },
  );
}

export async function apiHqListPermissions() {
  return apiFetch<{
    permissions: HqPermissionRow[];
    permissionsByModule: Record<string, HqPermissionRow[]>;
    moduleOrder?: string[];
  }>('/hq/permissions', { auth: true });
}

export async function apiHqListRoles() {
  return apiFetch<{ roles: HqRoleRow[] }>('/hq/roles', { auth: true });
}

export async function apiHqCreateRole(body: {
  roleName: string;
  description?: string;
  color?: string;
  permissionIds: string[];
}) {
  return apiFetch<{ role: HqRoleRow }>('/hq/roles', { method: 'POST', auth: true, body });
}

export async function apiHqUpdateRole(
  roleId: string,
  body: {
    roleName: string;
    description?: string;
    color?: string;
    permissionIds: string[];
  },
) {
  return apiFetch<{ role: HqRoleRow }>(`/hq/roles/${encodeURIComponent(roleId)}`, {
    method: 'PUT',
    auth: true,
    body,
  });
}

export async function apiHqDeleteRole(roleId: string) {
  return apiFetch<{ deleted: boolean; id: string }>(`/hq/roles/${encodeURIComponent(roleId)}`, {
    method: 'DELETE',
    auth: true,
  });
}

export async function apiHqListPortal() {
  return apiFetch<{
    candidates: HqPortalCandidateRow[];
    jobs: HqPortalJobRow[];
    stats: HqPortalStats;
    storage: HqPortalStorageInfo;
  }>('/hq/portal', { auth: true });
}

export async function apiHqListCandidates() {
  return apiFetch<{
    candidates: HqPortalCandidateRow[];
    stats: Pick<
      HqPortalStats,
      'totalCandidates' | 'portalCandidates' | 'commonCandidates' | 'phase2Candidates' | 'tenantCount'
    >;
    storage: HqPortalStorageInfo;
  }>('/hq/candidates', { auth: true });
}

export async function apiHqListKycInterviewers() {
  return apiFetch<{
    interviewers: HqKycInterviewerRow[];
    stats: {
      total: number;
      applicants?: number;
      interviewers?: number;
      kycVerified: number;
      pendingHqVerify: number;
      liveForCandidates: number;
    };
  }>('/hq/kyc-interviewers', { auth: true });
}

export async function apiHqVerifyKycInterviewer(candidateId: string) {
  return apiFetch<{
    candidateId: string;
    hqVerified: boolean;
    kycVerified: boolean;
    liveForCandidates: boolean;
  }>(`/hq/kyc-interviewers/${encodeURIComponent(candidateId)}/verify`, {
    method: 'POST',
    auth: true,
  });
}

export async function apiHqRejectKycInterviewer(candidateId: string, reviewNotes?: string) {
  return apiFetch<{
    candidateId: string;
    hqVerified: boolean;
    applicationStatus: string;
    reviewNotes: string;
  }>(`/hq/kyc-interviewers/${encodeURIComponent(candidateId)}/reject`, {
    method: 'POST',
    auth: true,
    body: { reviewNotes: reviewNotes || '' },
  });
}

export async function apiHqListCourses() {
  return apiFetch<{ courses: HqCourseRow[]; stats: HqCourseStats }>('/hq/courses', { auth: true });
}

export async function apiHqListCourseEnrollments(id: string) {
  return apiFetch<HqCourseEnrollmentResult>(`/hq/courses/${encodeURIComponent(id)}/enrollments`, {
    auth: true,
  });
}

export async function apiHqCreateCourse(body: HqCoursePayload) {
  return apiFetch<{ course: HqCourseRow }>('/hq/courses', {
    method: 'POST',
    auth: true,
    body,
  });
}

export async function apiHqUpdateCourse(id: string, body: Partial<HqCoursePayload>) {
  return apiFetch<{ course: HqCourseRow }>(`/hq/courses/${encodeURIComponent(id)}`, {
    method: 'PUT',
    auth: true,
    body,
  });
}

export async function apiHqDeleteCourse(id: string) {
  return apiFetch<{ deleted: boolean; id: string }>(`/hq/courses/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    auth: true,
  });
}

export async function apiHqBulkDeleteCourses(ids: string[]) {
  return apiFetch<{
    deleted: boolean;
    deletedCount: number;
    requested: number;
    invalid?: string[];
  }>('/hq/courses/bulk-delete', {
    method: 'POST',
    auth: true,
    body: { ids },
  });
}

export async function apiHqUploadCourseThumbnail(file: File) {
  const formData = new FormData();
  formData.append('file', file);
  return apiFetchFormData<{ thumbnail: { url: string; name?: string; size?: number } }>(
    '/hq/courses/thumbnail',
    formData,
    { method: 'POST', auth: true },
  );
}

export async function apiHqUploadCourseVideo(file: File) {
  const formData = new FormData();
  formData.append('file', file);
  return apiFetchFormData<{ video: { url: string; name?: string; size?: number } }>(
    '/hq/courses/video',
    formData,
    { method: 'POST', auth: true },
  );
}

export async function apiHqUploadCourseCertificateBackground(file: File) {
  const formData = new FormData();
  formData.append('file', file);
  return apiFetchFormData<{ background: { url: string; name?: string; size?: number } }>(
    '/hq/courses/certificate-background',
    formData,
    { method: 'POST', auth: true },
  );
}

export async function apiHqPreviewCourseCertificate(body: {
  learnerName?: string;
  courseTitle?: string;
  instructorName?: string;
  certificate?: HqCourseCertificate | null;
}) {
  return apiFetch<{ html: string; certificate: HqCourseCertificate }>('/hq/courses/certificate-preview', {
    method: 'POST',
    auth: true,
    body,
  });
}

export async function apiHqPassCourseCheckpoint(courseId: string, enrollmentId: string, checkpointId: string) {
  return apiFetch<{ passed: boolean; checkpointId: string }>(
    `/hq/courses/${encodeURIComponent(courseId)}/enrollments/${encodeURIComponent(enrollmentId)}/checkpoints/${encodeURIComponent(checkpointId)}/pass`,
    { method: 'POST', auth: true },
  );
}

export async function apiHqGetCandidateBehavior(candidateId: string) {
  return apiFetch<HqCandidateBehaviorAnalysis>(
    `/hq/candidates/${encodeURIComponent(candidateId)}/behavior`,
    { auth: true },
  );
}

export async function apiHqGetTenantBehavior(
  tenantDbName: string,
  range: 'today' | 'week' | 'month' | 'year' = 'week',
) {
  const q = new URLSearchParams({ range });
  return apiFetch<HqTenantBehaviorAnalysis>(
    `/hq/tenants/${encodeURIComponent(tenantDbName)}/behavior?${q.toString()}`,
    { auth: true },
  );
}

/** Stats + entity ids (no duplicated names). Tenant-wide and per-user. Not wired into HQ UI yet. */

export async function apiHqGetTenantBehaviorEngine(
  tenantDbName: string,
  opts?: { range?: 'today' | 'week' | 'month' | 'year'; userId?: string },
) {
  const q = new URLSearchParams({ range: opts?.range || 'week' });
  if (opts?.userId) q.set('userId', opts.userId);
  return apiFetch<unknown>(
    `/hq/tenants/${encodeURIComponent(tenantDbName)}/behavior-engine?${q.toString()}`,
    { auth: true },
  );
}

export async function apiHqGetBilling() {
  return apiFetch<HqBillingPayload>('/hq/billing', { auth: true });
}

export async function apiHqGetCandidateBillingLedger(candidateId: string) {
  return apiFetch<HqBillingCandidateLedgerPayload>(
    `/hq/billing/candidate/${encodeURIComponent(candidateId)}/ledger`,
    { auth: true },
  );
}

export async function apiHqGetEmployerBillingLedger(tenantKey: string) {
  return apiFetch<HqBillingEmployerLedgerPayload>(
    `/hq/billing/employer/${encodeURIComponent(tenantKey)}/ledger`,
    { auth: true },
  );
}

export async function apiHqGetAnalytics() {
  const bust = Date.now();
  return apiFetch<HqAnalyticsPayload>(`/hq/analytics?_=${bust}`, { auth: true });
}

export async function apiHqListCustomReports() {
  return apiFetch<{ reports: HqCustomReportRow[] }>('/hq/reports', { auth: true });
}

export async function apiHqCreateCustomReport(body: {
  name: string;
  dataset: HqCustomReportRow['dataset'];
  groupBy: string;
  metric?: HqCustomReportRow['metric'];
  dateFrom?: string;
  dateTo?: string;
}) {
  return apiFetch<{ report: HqCustomReportRow }>('/hq/reports', {
    method: 'POST',
    auth: true,
    body,
  });
}

export async function apiHqUpdateCustomReport(
  reportId: string,
  body: {
    name: string;
    dataset: HqCustomReportRow['dataset'];
    groupBy: string;
    metric?: HqCustomReportRow['metric'];
    dateFrom?: string;
    dateTo?: string;
  },
) {
  return apiFetch<{ report: HqCustomReportRow }>(`/hq/reports/${encodeURIComponent(reportId)}`, {
    method: 'PUT',
    auth: true,
    body,
  });
}

export async function apiHqDeleteCustomReport(reportId: string) {
  return apiFetch<{ deleted: boolean; id: string }>(`/hq/reports/${encodeURIComponent(reportId)}`, {
    method: 'DELETE',
    auth: true,
  });
}

export async function apiHqDeletePortalJob(
  jobId: string,
  body: { tenantDbName?: string } = {},
) {
  return apiFetch<{
    jobId: string;
    tenantDbName: string;
    deletedFromTenant: boolean;
    deletedFromPortal: boolean;
  }>(`/hq/portal/jobs/${encodeURIComponent(jobId)}`, {
    method: 'DELETE',
    auth: true,
    body,
  });
}

export async function apiHqSetPortalJobClientVisibility(
  jobId: string,
  body: { showClientNamePublicly: boolean; tenantDbName?: string },
) {
  return apiFetch<{
    jobId: string;
    tenantDbName: string;
    showClientNamePublicly: boolean;
    updatedTenant: boolean;
    updatedPortal: boolean;
  }>(`/hq/portal/jobs/${encodeURIComponent(jobId)}/client-visibility`, {
    method: 'PATCH',
    auth: true,
    body,
  });
}

export async function apiHqPushJobsToExternalFeeds() {
  return apiFetch<HqPushJobsToFeedsResult>('/hq/portal/jobs/push-to-feeds', {
    method: 'POST',
    auth: true,
  });
}

export async function apiHqSyncTenantJobsToPhase1(body: {
  jobs: Array<{ tenantDbName: string; jobId: string }>;
}) {
  return apiFetch<HqSyncTenantJobsToPhase1Result>('/hq/portal/jobs/sync-to-phase1', {
    method: 'POST',
    auth: true,
    body,
  });
}

export async function apiHqAssignTenantPlan(body: {
  email: string;
  billingCycle?: 'monthly' | 'annual';
  coins?: number;
  plan: { id?: string; name?: string; billingCycle?: 'monthly' | 'annual'; coins?: number };
}) {
  return apiFetch<{ email: string; subscriptionPlan: HqTenantSubscriptionPlan | null }>(
    '/hq/tenants/plan',
    { method: 'PUT', auth: true, body }
  );
}

export async function apiHqSetTenantCoins(body: { email: string; coins: number }) {
  return apiFetch<{
    email: string;
    coins: number;
    subscriptionPlan: HqTenantSubscriptionPlan | null;
  }>('/hq/tenants/coins', { method: 'PUT', auth: true, body });
}

export async function apiHqListAiFeatures() {
  return apiFetch<{ features: HqAiFeature[] }>('/hq/ai-features', { auth: true });
}

export async function apiHqUpdateAiFeatures(body: {
  features?: Array<{ id: string; coins: number }>;
  costs?: Record<string, number>;
}) {
  return apiFetch<{
    features: HqAiFeature[];
    costs: Record<string, number>;
    changed?: Array<{ id: string; name?: string; previous?: number; coins?: number }>;
    updatedAt?: string;
  }>('/hq/ai-features', {
    method: 'PUT',
    auth: true,
    body,
  });
}

export async function apiHqListAiCoinPacks() {
  return apiFetch<{ packs: HqAiCoinPack[] }>('/hq/ai-coin-packs', { auth: true });
}

export async function apiHqSaveAiCoinPacks(body: { packs: HqAiCoinPack[] }) {
  return apiFetch<{ packs: HqAiCoinPack[] }>('/hq/ai-coin-packs', {
    method: 'PUT',
    auth: true,
    body,
  });
}

export async function apiHqSetTenantPause(body: { email: string; paused: boolean }) {
  return apiFetch<{
    email: string;
    status: string;
    pausedAt?: string | null;
    pausedBy?: string;
  }>('/hq/tenants/pause', { method: 'PUT', auth: true, body });
}

export async function apiHqIssueTenantJobsApiKey(body: { email: string }) {
  return apiFetch<{
    email: string;
    jobsApiKey: string;
    jobsApiKeyIssuedAt?: string | null;
    jobsApiUrl: string;
  }>('/hq/tenants/jobs-api-key', { method: 'POST', auth: true, body });
}

export async function apiHqRevokeTenantJobsApiKey(body: { email: string }) {
  return apiFetch<{
    email: string;
    jobsApiKey: string;
    jobsApiKeyIssuedAt?: string | null;
    jobsApiUrl: string;
  }>(`/hq/tenants/jobs-api-key?email=${encodeURIComponent(body.email)}`, {
    method: 'DELETE',
    auth: true,
    body,
  });
}

export async function apiHqUpdateTenantModules(body: {
  email: string;
  productLine?: 'crm' | 'recruitment';
  enabledModules: string[];
  phase1CommonPoolEnabled?: boolean;
}) {
  return apiFetch<{
    email: string;
    productLine?: string;
    enabledModules?: string[];
    modulesRestricted?: boolean;
    phase1CommonPoolEnabled?: boolean;
    tenantDbName?: string;
  }>('/hq/tenants/modules', { method: 'PUT', auth: true, body });
}

export async function apiHqUpdateTenantOrganizationName(body: {
  email: string;
  organizationName: string;
}) {
  return apiFetch<{
    email: string;
    organizationName: string;
    tenantDbName?: string;
    syncedToTenant?: boolean;
  }>('/hq/tenants/organization-name', { method: 'PUT', auth: true, body });
}

export async function apiHqDeleteTenant(body: { email: string; dropDatabase?: boolean }) {
  // Soft-delete: moves the tenant to HQ Recycle Bin. The tenant database is kept.
  const path = `/hq/tenants/${encodeURIComponent(body.email)}`;
  return apiFetch<{
    deleted: boolean;
    softDeleted?: boolean;
    movedToRecycleBin?: boolean;
    email: string;
    tenantDbName: string | null;
    databaseDropped: boolean;
  }>(path, { method: 'DELETE', auth: true });
}

export async function apiHqListRecycleBin() {
  return apiFetch<{ items: HqTenantRow[]; count: number }>('/hq/recycle-bin', { auth: true });
}

export async function apiHqRestoreTenant(email: string) {
  return apiFetch<{ restored: boolean; email: string; tenantDbName: string | null }>(
    '/hq/recycle-bin/restore',
    { method: 'POST', body: { email }, auth: true },
  );
}

export async function apiHqPurgeTenant(email: string, dropDatabase = true) {
  const path = `/hq/recycle-bin/${encodeURIComponent(email)}${
    dropDatabase ? '' : '?dropDatabase=false'
  }`;
  return apiFetch<{ purged: boolean; email: string; databaseDropped: boolean }>(path, {
    method: 'DELETE',
    auth: true,
  });
}
