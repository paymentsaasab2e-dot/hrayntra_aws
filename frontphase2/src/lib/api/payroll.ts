import { apiFetch } from './core';

export type PayrollRun = {
  id: string;
  legalEmployerId: string;
  country: string;
  year: number;
  month: number;
  status: string;
  capability: string;
  totals: Record<string, number> | null;
  lockedAt: string | null;
};

export async function apiListPayrollRuns(legalEmployerId?: string) {
  const qs = legalEmployerId ? `?legalEmployerId=${encodeURIComponent(legalEmployerId)}` : '';
  return apiFetch<PayrollRun[]>(`/payroll-runs${qs}`, { auth: true, includeTenantHeader: true });
}

export async function apiRunPayroll(body: { legalEmployerId: string; year: number; month: number }) {
  return apiFetch('/payroll-runs', {
    method: 'POST',
    auth: true,
    includeTenantHeader: true,
    body,
  });
}

export async function apiApprovePayroll(id: string) {
  return apiFetch(`/payroll-runs/${id}/approve`, {
    method: 'POST',
    auth: true,
    includeTenantHeader: true,
    body: {},
  });
}

export async function apiLockPayroll(id: string) {
  return apiFetch(`/payroll-runs/${id}/lock`, {
    method: 'POST',
    auth: true,
    includeTenantHeader: true,
    body: {},
  });
}

export async function apiListPayslips(runId: string) {
  return apiFetch(`/payroll-runs/${runId}/payslips`, { auth: true, includeTenantHeader: true });
}

export async function apiPayrollPaymentFile(runId: string) {
  return apiFetch(`/payroll-runs/${runId}/payment-file`, { auth: true, includeTenantHeader: true });
}
