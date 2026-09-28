/* org API */
import { cacheClientPageFieldVisibility, normalizeClientPageFieldVisibility } from '../clientPageFieldVisibility';
import { ORG_SUMMARY_CLIENT_TTL_MS, TENANT_COINS_CLIENT_TTL_MS, apiFetch, getAccessToken, getOrgSummaryInflight, setOrgSummaryInflight, getOrgSummaryLastAt, setOrgSummaryLastAt, getTenantCoinsCache, setTenantCoinsCache, getTenantCoinsInflight, setTenantCoinsInflight } from './core';
import type { BillingSettingsSnapshot, CreatePlacementInvoicePayload } from '../../types/recruitmentInvoice';
import type { AiCoinPack, HqAiFeature, HqTenantSubscriptionPlan, OrgPlanUsageCache, SubscriptionPaymentOrder, SubscriptionPlanOption } from './types';


export const ORG_RECRUITMENT_CACHE_EVENT = 'hrayntra:org-recruitment-cache';

export function getCachedOrgRecruitmentMode(): 'agency' | 'standalone' {
  if (typeof window === 'undefined') return 'agency';
  return localStorage.getItem('orgRecruitmentMode') === 'standalone' ? 'standalone' : 'agency';
}

/** When unset, billing nav is shown (matches legacy agency behavior). */

export function isOrgBillingNavEnabled(): boolean {
  if (typeof window === 'undefined') return true;
  return localStorage.getItem('orgBillingEnabled') !== '0';
}

export function getCachedOrgSubscriptionPlanName(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('orgSubscriptionPlanName') || '';
}

export function getCachedOrgPlanUsage(): OrgPlanUsageCache | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem('orgPlanUsage');
  if (!raw) return null;
  try {
    return JSON.parse(raw) as OrgPlanUsageCache;
  } catch {
    return null;
  }
}

/** Tenant-wide default currency code (ISO 4217). Falls back to USD when unset. */

export function getCachedOrgDefaultCurrency(): string {
  if (typeof window === 'undefined') return 'USD';
  const v = localStorage.getItem('orgDefaultCurrency');
  return v && v.length === 3 ? v.toUpperCase() : 'USD';
}

/** When false, HQ has not restricted tabs — Phase 2 shows all RBAC-allowed modules. */

export function isOrgModulesRestricted(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem('orgModulesRestricted') === '1';
}

export function getCachedOrgEnabledModules(): string[] {
  if (typeof window === 'undefined') return [];
  const raw = localStorage.getItem('orgEnabledModules');
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.map((m) => String(m || '').trim()).filter(Boolean)
      : [];
  } catch {
    return [];
  }
}

/** HQ module gate for Phase 2 sidenav / routes. Unrestricted tenants always return true. */

export function isOrgModuleEnabled(moduleId: string): boolean {
  if (!moduleId) return true;
  if (!isOrgModulesRestricted()) return true;
  const list = getCachedOrgEnabledModules();
  if (list.length === 0) return false;
  return list.includes(moduleId);
}

/**
 * Phase 1 (Hrayntra candidatecommon) access for this tenant.
 * Missing cache → true (legacy tenants keep All candidates + Phase 1 pool).
 */

export function applyOrgRecruitmentSummaryPayload(
  payload:
    | {
        recruitmentMode?: string;
        billingEnabled?: boolean;
        subscriptionPlan?: HqTenantSubscriptionPlan | null;
        planUsage?: OrgPlanUsageCache | null;
        defaultCurrency?: string | null;
        tenantPaused?: boolean;
        tenantPausedAt?: string | null;
        productLine?: string | null;
        enabledModules?: string[] | null;
        modulesRestricted?: boolean;
        phase1CommonPoolEnabled?: boolean;
        organizationName?: string | null;
        companyName?: string | null;
        clientPageFieldVisibility?: {
          interestLevel?: boolean;
          status?: boolean;
          assignedTo?: boolean;
        } | null;
      }
    | null
    | undefined
): void {
  if (typeof window === 'undefined') return;
  const mode = payload?.recruitmentMode === 'standalone' ? 'standalone' : 'agency';
  const billing = payload?.billingEnabled !== false;
  localStorage.setItem('orgRecruitmentMode', mode);
  localStorage.setItem('orgBillingEnabled', billing ? '1' : '0');
  const planName = String(payload?.subscriptionPlan?.name || '').trim();
  if (planName) {
    localStorage.setItem('orgSubscriptionPlanName', planName);
  } else {
    localStorage.removeItem('orgSubscriptionPlanName');
  }
  const sp = payload?.subscriptionPlan as
    | {
        name?: string;
        planStartDate?: string;
        planEndDate?: string;
        isTrial?: boolean;
        trialDays?: number;
      }
    | null
    | undefined;
  if (sp && (sp.name || sp.planStartDate || sp.planEndDate)) {
    localStorage.setItem(
      'orgSubscriptionPlan',
      JSON.stringify({
        name: sp.name || planName || undefined,
        planStartDate: sp.planStartDate || undefined,
        planEndDate: sp.planEndDate || undefined,
        isTrial: Boolean(sp.isTrial),
        trialDays: sp.trialDays ?? undefined,
      })
    );
  } else {
    localStorage.removeItem('orgSubscriptionPlan');
  }
  if (payload?.planUsage) {
    localStorage.setItem(
      'orgPlanUsage',
      JSON.stringify({
        activeJobs: Number(payload.planUsage.activeJobs) || 0,
        activeUsers: Number(payload.planUsage.activeUsers) || 0,
        maxJobs: payload.planUsage.maxJobs ?? null,
        maxUsers: payload.planUsage.maxUsers ?? null,
      })
    );
  }
  const currency = String(payload?.defaultCurrency || '').trim().toUpperCase();
  if (currency && currency.length === 3) {
    localStorage.setItem('orgDefaultCurrency', currency);
  }
  if (payload && Object.prototype.hasOwnProperty.call(payload, 'clientPageFieldVisibility')) {
    cacheClientPageFieldVisibility(
      normalizeClientPageFieldVisibility(payload.clientPageFieldVisibility),
    );
  }
  if (
    payload &&
    (Object.prototype.hasOwnProperty.call(payload, 'modulesRestricted') ||
      Object.prototype.hasOwnProperty.call(payload, 'enabledModules'))
  ) {
    const modules = Array.isArray(payload.enabledModules)
      ? payload.enabledModules.map((m) => String(m || '').trim()).filter(Boolean)
      : [];
    const restricted =
      payload.modulesRestricted === true ||
      modules.length > 0;
    localStorage.setItem('orgModulesRestricted', restricted ? '1' : '0');
    localStorage.setItem('orgEnabledModules', JSON.stringify(modules));
    const line = String(payload.productLine || '').trim().toLowerCase();
    if (line === 'crm' || line === 'recruitment') {
      localStorage.setItem('orgProductLine', line);
    } else if (Object.prototype.hasOwnProperty.call(payload, 'productLine')) {
      localStorage.removeItem('orgProductLine');
    }
  }
  if (payload && Object.prototype.hasOwnProperty.call(payload, 'phase1CommonPoolEnabled')) {
    localStorage.setItem(
      'orgPhase1CommonPoolEnabled',
      payload.phase1CommonPoolEnabled === false ? '0' : '1',
    );
  }
  if (payload?.tenantPaused) {
    localStorage.setItem('orgTenantPaused', '1');
    if (payload.tenantPausedAt) {
      localStorage.setItem('orgTenantPausedAt', String(payload.tenantPausedAt));
    } else {
      localStorage.removeItem('orgTenantPausedAt');
    }
  } else if (payload && Object.prototype.hasOwnProperty.call(payload, 'tenantPaused')) {
    localStorage.setItem('orgTenantPaused', '0');
    localStorage.removeItem('orgTenantPausedAt');
  }
  const orgName = String(payload?.organizationName || payload?.companyName || '').trim();
  if (orgName) {
    try {
      const raw = localStorage.getItem('currentUser');
      const current = raw ? JSON.parse(raw) : {};
      if (current && typeof current === 'object') {
        localStorage.setItem(
          'currentUser',
          JSON.stringify({ ...current, organizationName: orgName, companyName: orgName }),
        );
      }
    } catch {
      /* ignore corrupt currentUser */
    }
  }
  window.dispatchEvent(new CustomEvent(ORG_RECRUITMENT_CACHE_EVENT));
}

/** Refreshes org recruitment mode + billing flags + plan after login or when settings change. */

export async function syncOrgRecruitmentSummaryFromApi(options?: {
  force?: boolean;
}): Promise<void> {
  if (typeof window === 'undefined') return;
  if (!getAccessToken()) return;

  const force = Boolean(options?.force);
  const now = Date.now();
  if (!force && getOrgSummaryLastAt() && now - getOrgSummaryLastAt() < ORG_SUMMARY_CLIENT_TTL_MS) {
    return;
  }
  if (getOrgSummaryInflight()) {
    await getOrgSummaryInflight();
    return;
  }

  setOrgSummaryInflight((async () => {
    try {
      const res = await apiFetch<{
        recruitmentMode?: string;
        billingEnabled?: boolean;
        subscriptionPlan?: HqTenantSubscriptionPlan | null;
        planUsage?: OrgPlanUsageCache | null;
        tenantPaused?: boolean;
        tenantPausedAt?: string | null;
        defaultCurrency?: string | null;
        productLine?: string | null;
        enabledModules?: string[] | null;
        modulesRestricted?: boolean;
        phase1CommonPoolEnabled?: boolean;
        organizationName?: string | null;
        companyName?: string | null;
        clientPageFieldVisibility?: {
          interestLevel?: boolean;
          status?: boolean;
          assignedTo?: boolean;
        };
      }>('/settings/org/recruitment-summary', { auth: true });
      applyOrgRecruitmentSummaryPayload(res.data as Parameters<typeof applyOrgRecruitmentSummaryPayload>[0]);
      setOrgSummaryLastAt(Date.now());
    } catch {
      applyOrgRecruitmentSummaryPayload({ recruitmentMode: 'agency', billingEnabled: true, subscriptionPlan: null });
    } finally {
      setOrgSummaryInflight(null);
    }
  })());

  await getOrgSummaryInflight();
}

/** Tenant own-company record used when creating jobs for this organization. */

export async function apiSetTableColumnModuleVisibility(
  moduleKey: string,
  visibleIds: string[],
) {
  return apiFetch<{ columns: Record<string, string[]>; moduleKey: string }>(
    '/settings/org/table-columns',
    {
      method: 'PUT',
      auth: true,
      body: { moduleKey, visibleIds },
    },
  );
}

export async function apiGetOrgDefaultCurrency() {
  return apiFetch<{ code: string; supportedCurrencies: string[]; fallback: string }>(
    '/settings/org/default-currency',
    { auth: true }
  );
}

export async function apiGetOrgCommissionSlabs() {
  return apiFetch<{
    commissionSlabs: import('../commissionSlabs').CommissionSlabSettings;
    defaults: import('../commissionSlabs').CommissionSlabSettings;
  }>('/settings/org/commission-slabs', { auth: true });
}

export async function apiSetOrgCommissionSlabs(
  commissionSlabs: import('../commissionSlabs').CommissionSlabSettings,
) {
  return apiFetch<{ commissionSlabs: import('../commissionSlabs').CommissionSlabSettings }>(
    '/settings/org/commission-slabs',
    { method: 'PUT', auth: true, body: { commissionSlabs } },
  );
}

export async function apiGetOrgWatermark() {
  return apiFetch<{
    watermark: import('../exportWatermark').ExportWatermarkSettings;
    defaults: import('../exportWatermark').ExportWatermarkSettings;
  }>('/settings/org/watermark', { auth: true });
}

export async function apiSetOrgWatermark(
  watermark: import('../exportWatermark').ExportWatermarkSettings,
) {
  return apiFetch<{ watermark: import('../exportWatermark').ExportWatermarkSettings }>(
    '/settings/org/watermark',
    { method: 'PUT', auth: true, body: { watermark } },
  );
}

/** Super Admin — upload logo image used as org export watermark. */

export async function apiSetOrgDefaultCurrency(code: string) {
  const res = await apiFetch<{ code: string }>('/settings/org/default-currency', {
    method: 'PUT',
    auth: true,
    body: { code },
  });
  // Push the new currency into local cache + broadcast so every open tab
  // (Billing, Dashboard, Candidate "expected pay", etc.) refreshes its formatter.
  if (typeof window !== 'undefined') {
    const next = String(res.data?.code || code || '').trim().toUpperCase();
    if (next && next.length === 3) {
      localStorage.setItem('orgDefaultCurrency', next);
      window.dispatchEvent(new CustomEvent(ORG_RECRUITMENT_CACHE_EVENT));
    }
  }
  return res;
}

export async function apiGetSubscriptionPlan() {
  return apiFetch<{
    plan: HqTenantSubscriptionPlan | null;
    planUsage?: {
      activeJobs: number;
      activeUsers: number;
      maxJobs: number | null;
      maxUsers: number | null;
      jobsRemaining: number | null;
      usersRemaining: number | null;
    };
    options: SubscriptionPlanOption[];
    upgradeOptions?: {
      currentPlan: HqTenantSubscriptionPlan | null;
      upgradePackages: SubscriptionPlanOption[];
      canUpgrade: boolean;
    };
  }>('/settings/org/subscription-plan', { auth: true });
}

export async function apiUpgradeSubscriptionPlan(body: {
  packageId: string;
  billingCycle: 'monthly' | 'annual';
  paymentReference?: string;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  razorpaySignature?: string;
}) {
  return apiFetch<{
    plan: HqTenantSubscriptionPlan;
    planUsage?: {
      activeJobs: number;
      activeUsers: number;
      maxJobs: number | null;
      maxUsers: number | null;
      jobsRemaining: number | null;
      usersRemaining: number | null;
    };
  }>('/settings/org/subscription-plan/upgrade', {
    method: 'POST',
    auth: true,
    body,
  });
}

export async function apiCreateSubscriptionPaymentOrder(body: {
  packageId: string;
  billingCycle: 'monthly' | 'annual';
}) {
  return apiFetch<SubscriptionPaymentOrder>('/settings/org/subscription-plan/payment-order', {
    method: 'POST',
    auth: true,
    body,
  });
}

export async function apiSetSubscriptionPlan(plan: { name: string }) {
  return apiFetch<{ plan: { name: string } }>('/settings/org/subscription-plan', {
    method: 'PUT',
    auth: true,
    body: { plan },
  });
}

export async function apiUpdateBillingRecord(
  invoiceId: string,
  payload: { status?: 'DRAFT' | 'SENT' | 'PAID' | 'OVERDUE' | 'CANCELLED'; paidAt?: string }
) {
  return apiFetch<{ id: string; status: string; paidAt: string | null }>(`/billing/${encodeURIComponent(invoiceId)}`, {
    method: 'PATCH',
    auth: true,
    body: payload,
  });
}

export async function apiGetBillingRecord(invoiceId: string) {
  return apiFetch<Record<string, any>>(`/billing/${encodeURIComponent(invoiceId)}`, { auth: true });
}

export async function apiUpdateBillingDraftInvoice(
  invoiceId: string,
  payload: CreatePlacementInvoicePayload
) {
  return apiFetch<Record<string, any>>(`/billing/${encodeURIComponent(invoiceId)}/draft-invoice`, {
    method: 'PATCH',
    auth: true,
    body: payload,
  });
}

export async function apiSendBillingInvoice(
  invoiceId: string,
  payload?: { toEmail?: string; pdfBase64?: string; pdfFilename?: string }
) {
  return apiFetch<{ billingRecordId: string; toEmail: string; invoiceNumber?: string }>(
    `/billing/${encodeURIComponent(invoiceId)}/send-invoice`,
    {
      method: 'POST',
      auth: true,
      body: payload || {},
    },
  );
}

export async function apiDeleteBillingRecord(invoiceId: string) {
  return apiFetch<{ message: string }>(`/billing/${encodeURIComponent(invoiceId)}`, {
    method: 'DELETE',
    auth: true,
  });
}

export const apiGetBillingSettings = async () => {
  return apiFetch<BillingSettingsSnapshot>('/billing/settings', {
    auth: true,
  });
};

export async function apiGetTenantCoins(): Promise<{
  coins: number;
  planName: string | null;
  features: HqAiFeature[];
  packs: AiCoinPack[];
}> {
  const now = Date.now();
  const cached = getTenantCoinsCache();
  if (cached && now - cached.at < TENANT_COINS_CLIENT_TTL_MS) {
    return cached.data;
  }
  const inflight = getTenantCoinsInflight();
  if (inflight) return inflight;

  const pending = (async () => {
    const res = await apiFetch<{
      coins: number;
      planName: string | null;
      features?: HqAiFeature[];
      packs?: AiCoinPack[];
    }>('/settings/org/coins', {
      method: 'GET',
      auth: true,
    });
    const data = {
      coins: Number(res.data?.coins ?? 0),
      planName: res.data?.planName ?? null,
      features: Array.isArray(res.data?.features) ? res.data.features : [],
      packs: Array.isArray(res.data?.packs) ? res.data.packs : [],
    };
    setTenantCoinsCache({ at: Date.now(), data });
    return data;
  })().finally(() => {
    setTenantCoinsInflight(null);
  });
  setTenantCoinsInflight(pending);
  return pending;
}

export async function apiGetAiCoinPacks() {
  return apiFetch<{ packs: AiCoinPack[]; demo: boolean }>('/settings/org/coins/packs', {
    method: 'GET',
    auth: true,
  });
}

export async function apiPurchaseAiCoinPack(packId: string) {
  return apiFetch<{
    demo: boolean;
    message: string;
    coins: number;
    previous: number;
    added: number;
    pack: AiCoinPack;
  }>('/settings/org/coins/purchase', {
    method: 'POST',
    auth: true,
    body: { packId },
  });
}
