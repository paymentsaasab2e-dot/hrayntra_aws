import { apiFetch, type ApiResponse } from './core';
import type { CountryPack, PeopleCorePayrollCapability } from '../peoplecore/countryPacks';

export type EmployeeEngagementType =
  | 'EMPLOYEE'
  | 'INTERN'
  | 'CONTRACTOR'
  | 'CONSULTANT'
  | 'TRAINEE';

export type EmployeeStatus =
  | 'PREBOARDING'
  | 'READY'
  | 'JOINED'
  | 'ACTIVE'
  | 'DEFERRED'
  | 'NO_SHOW'
  | 'EXITED';

export type EmployeeCompensation = {
  amount: number | null;
  currency: string | null;
  period: 'ANNUAL' | 'MONTHLY';
  notes?: string;
};

export type BackendEmployee = {
  id: string;
  personId: string | null;
  candidateId: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  legalEmployerCountry: string;
  legalEmployerId?: string | null;
  workLocationId?: string | null;
  legalName?: string | null;
  dateOfBirth?: string | null;
  gender?: string | null;
  emergencyContact?: Record<string, string> | null;
  bank?: Record<string, string> | null;
  nominees?: Record<string, unknown> | null;
  engagementType: EmployeeEngagementType;
  status: EmployeeStatus;
  employmentStartDate: string | null;
  employmentEndDate: string | null;
  designation: string | null;
  departmentId: string | null;
  orgUnitId: string | null;
  reportingManagerEmployeeId: string | null;
  workLocation: string | null;
  compensation: EmployeeCompensation | null;
  countryFields: Record<string, string> | null;
  hiredFromCandidateAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PeopleCoreSettings = {
  legalEmployerCountry: string | null;
  payrollCapability: PeopleCorePayrollCapability;
  hrEnabled: boolean;
  timezone: string | null;
  currency: string | null;
  locale: string | null;
  pack: CountryPack | null;
  defaultLegalEmployerId?: string | null;
  payslipsEnabled: false;
  phase: 3;
};

export type EmployeeListPayload = {
  data: BackendEmployee[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export type HireFromCandidateResult = {
  employee: BackendEmployee;
  alreadyHired: boolean;
};

export async function apiGetCountryPacks() {
  return apiFetch<{ packs: CountryPack[]; payslipsEnabled: false; phase: 3 }>(
    '/peoplecore/country-packs',
    { auth: true, includeTenantHeader: true },
  );
}

export async function apiGetPeopleCoreSettings() {
  return apiFetch<PeopleCoreSettings>('/peoplecore/settings', {
    auth: true,
    includeTenantHeader: true,
  });
}

export async function apiPutPeopleCoreSettings(legalEmployerCountry: string) {
  return apiFetch<PeopleCoreSettings>('/peoplecore/settings', {
    method: 'PUT',
    auth: true,
    includeTenantHeader: true,
    body: { legalEmployerCountry },
  });
}

export async function apiGetEmployees(params: {
  search?: string;
  status?: string;
  engagementType?: string;
  page?: number;
  limit?: number;
  candidateId?: string;
} = {}) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    query.set(key, String(value));
  });
  const qs = query.toString();
  return apiFetch<EmployeeListPayload>(`/employees${qs ? `?${qs}` : ''}`, {
    auth: true,
    includeTenantHeader: true,
  });
}

export async function apiCreateEmployee(body: {
  firstName: string;
  lastName?: string;
  email?: string;
  phone?: string;
  engagementType?: EmployeeEngagementType;
  status?: EmployeeStatus;
  designation?: string;
  workLocation?: string;
  employmentStartDate?: string;
  compensation?: EmployeeCompensation | null;
  countryFields?: Record<string, string>;
  personId?: string;
  legalEmployerId?: string;
}) {
  return apiFetch<BackendEmployee>('/employees', {
    method: 'POST',
    auth: true,
    includeTenantHeader: true,
    body,
  });
}

export async function apiHireEmployeeFromCandidate(
  candidateId: string,
  body: {
    engagementType?: EmployeeEngagementType;
    designation?: string;
    employmentStartDate?: string;
    legalEmployerId?: string;
  } = {},
): Promise<ApiResponse<HireFromCandidateResult>> {
  return apiFetch<HireFromCandidateResult>(`/employees/from-candidate/${candidateId}`, {
    method: 'POST',
    auth: true,
    includeTenantHeader: true,
    body,
  });
}

export async function apiGetEmployee(id: string) {
  return apiFetch<BackendEmployee>(`/employees/${id}`, { auth: true, includeTenantHeader: true });
}

export async function apiUpdateEmployee(id: string, body: Record<string, unknown>) {
  return apiFetch<BackendEmployee>(`/employees/${id}`, {
    method: 'PATCH',
    auth: true,
    includeTenantHeader: true,
    body,
  });
}

function peopleGet<T>(path: string) {
  return apiFetch<T>(path, { auth: true, includeTenantHeader: true });
}

function peoplePost<T>(path: string, body: Record<string, unknown> = {}) {
  return apiFetch<T>(path, { method: 'POST', auth: true, includeTenantHeader: true, body });
}

export type LegalEmployer = {
  id: string;
  name: string;
  country: string;
  identifiers: Record<string, string>;
  payrollCapability: string;
  timezone: string | null;
  currency: string | null;
  locale: string | null;
};

export async function apiListLegalEmployers() {
  return peopleGet<LegalEmployer[]>('/legal-employers');
}

export async function apiCreateLegalEmployer(body: {
  name: string;
  country: string;
  identifiers?: Record<string, string>;
}) {
  return peoplePost<LegalEmployer>('/legal-employers', body);
}

export async function apiListPeopleLocations(legalEmployerId?: string) {
  const qs = legalEmployerId ? `?legalEmployerId=${encodeURIComponent(legalEmployerId)}` : '';
  return peopleGet(`/people-locations${qs}`);
}

export async function apiCreatePeopleLocation(body: Record<string, unknown>) {
  return peoplePost('/people-locations', body);
}

export async function apiListHolidays(legalEmployerId: string, year?: number) {
  const qs = new URLSearchParams({ legalEmployerId });
  if (year) qs.set('year', String(year));
  return peopleGet(`/holiday-calendars?${qs}`);
}

export async function apiListLeaveTypes(legalEmployerId?: string) {
  const qs = legalEmployerId ? `?legalEmployerId=${encodeURIComponent(legalEmployerId)}` : '';
  return peopleGet(`/leave-types${qs}`);
}

export async function apiListOnboarding(employeeId: string) {
  return peopleGet(`/employees/${employeeId}/onboarding`);
}

export async function apiCompleteOnboardingTask(taskId: string) {
  return peoplePost(`/onboarding-tasks/${taskId}/complete`);
}

export async function apiMarkNoShow(employeeId: string) {
  return peoplePost(`/employees/${employeeId}/no-show`);
}

export async function apiPunch(body: Record<string, unknown>) {
  return peoplePost('/attendance/punches', body);
}

export async function apiListPunches(employeeId?: string) {
  const qs = employeeId ? `?employeeId=${encodeURIComponent(employeeId)}` : '';
  return peopleGet(`/attendance/punches${qs}`);
}

export async function apiLockAttendancePeriod(legalEmployerId: string, year: number, month: number) {
  return peoplePost('/attendance/periods/lock', { legalEmployerId, year, month });
}

export async function apiApplyLeave(body: Record<string, unknown>) {
  return peoplePost('/leave-requests', body);
}

export async function apiListLeave(employeeId?: string) {
  const qs = employeeId ? `?employeeId=${encodeURIComponent(employeeId)}` : '';
  return peopleGet(`/leave-requests${qs}`);
}

export async function apiDecideLeave(id: string, status: string, remark?: string) {
  return peoplePost(`/leave-requests/${id}/decide`, { status, remark });
}

export async function apiListExits() {
  return peopleGet('/exit-cases');
}

export async function apiCreateExit(body: Record<string, unknown>) {
  return peoplePost('/exit-cases', body);
}

export async function apiCompleteExit(id: string, body: Record<string, unknown> = {}) {
  return peoplePost(`/exit-cases/${id}/complete`, body);
}

export async function apiSaveFnf(body: Record<string, unknown>) {
  return peoplePost('/fnf-worksheets', body);
}

export async function apiListAssets() {
  return peopleGet('/assets');
}

export async function apiCreateAsset(body: Record<string, unknown>) {
  return peoplePost('/assets', body);
}

export async function apiAssignAsset(body: Record<string, unknown>) {
  return peoplePost('/assets/assign', body);
}

export async function apiReturnAsset(id: string, condition?: string) {
  return peoplePost(`/asset-assignments/${id}/return`, { condition });
}

export async function apiIssueLetter(body: Record<string, unknown>) {
  return peoplePost('/people-letters', body);
}

export async function apiListLetters(employeeId?: string) {
  const qs = employeeId ? `?employeeId=${encodeURIComponent(employeeId)}` : '';
  return peopleGet(`/people-letters${qs}`);
}

export async function apiListPeopleInbox() {
  return peopleGet('/people-inbox');
}

export async function apiDecideInbox(id: string, status: string, remark?: string) {
  return peoplePost(`/people-inbox/${id}/decide`, { status, remark });
}

export async function apiDelegateInbox(id: string, delegatedToId: string) {
  return peoplePost(`/people-inbox/${id}/delegate`, { delegatedToId });
}

export async function apiPeopleReportsHome() {
  return peopleGet('/peoplecore/reports/home');
}

export async function apiInspectorPack(legalEmployerId: string, year?: number) {
  const qs = new URLSearchParams({ legalEmployerId });
  if (year) qs.set('year', String(year));
  return peopleGet(`/peoplecore/reports/inspector?${qs}`);
}

export async function apiListHrPolicies() {
  return peopleGet('/hr-policies');
}

export async function apiPublishHrPolicy(body: Record<string, unknown>) {
  return peoplePost('/hr-policies', body);
}

export async function apiAckHrPolicy(body: Record<string, unknown>) {
  return peoplePost('/hr-policies/ack', body);
}

export async function apiGetPeopleSecurity() {
  return peopleGet('/peoplecore/security');
}

export async function apiPutPeopleSecurity(body: Record<string, unknown>) {
  return apiFetch('/peoplecore/security', {
    method: 'PUT',
    auth: true,
    includeTenantHeader: true,
    body,
  });
}

export async function apiJoinEmployee(employeeId: string, body: Record<string, unknown> = {}) {
  return peoplePost(`/employees/${employeeId}/join`, body);
}

export async function apiDeferEmployee(employeeId: string, body: Record<string, unknown> = {}) {
  return peoplePost(`/employees/${employeeId}/defer`, body);
}

export async function apiPeopleAlerts() {
  return peopleGet('/peoplecore/alerts');
}

export async function apiListLeaveBalances(employeeId?: string) {
  const qs = employeeId ? `?employeeId=${encodeURIComponent(employeeId)}` : '';
  return peopleGet(`/leave-balances${qs}`);
}

export async function apiOnboardingQueue() {
  return peopleGet('/peoplecore/onboarding-queue');
}

export async function apiMuster(legalEmployerId: string, year: number, month: number) {
  const qs = new URLSearchParams({
    legalEmployerId,
    year: String(year),
    month: String(month),
  });
  return peopleGet(`/attendance/muster?${qs}`);
}

export async function apiRegularise(body: Record<string, unknown>) {
  return peoplePost('/attendance/regularise', body);
}

export async function apiListAssetAssignments() {
  return peopleGet('/asset-assignments');
}

export async function apiPayrollExceptions(runId: string) {
  return peopleGet(`/payroll-runs/${runId}/exceptions`);
}

export async function apiListDocuments(employeeId: string) {
  return peopleGet(`/employees/${employeeId}/documents`);
}

export async function apiAddDocument(employeeId: string, body: Record<string, unknown>) {
  return peoplePost(`/employees/${employeeId}/documents`, body);
}
