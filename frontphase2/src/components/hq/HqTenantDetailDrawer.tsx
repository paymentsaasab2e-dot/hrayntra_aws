'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import {
  Activity,
  Coins,
  CreditCard,
  DollarSign,
  LayoutGrid,
  Loader2,
  Pause,
  Pencil,
  Play,
  Settings2,
  Building2,
  KeyRound,
  Copy,
  Eye,
  EyeOff,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';
import {
  apiHqSetTenantCoins,
  apiHqUpdateTenantModules,
  apiHqUpdateTenantOrganizationName,
  apiHqIssueTenantJobsApiKey,
  apiHqRevokeTenantJobsApiKey,
  type HqSubscriptionPackage,
  type HqTenantRow,
} from '@/lib/api';
import {
  ALL_TENANT_MODULES,
  defaultModulesForProductLine,
  type TenantProductLine,
} from '@/lib/tenantModuleCatalog';
import { getPackageOptionLabel, type BillingCycle } from './hqPackagePresentation';
import {
  findPackageForPlan,
  formatBillingCycleLabel,
  getDisplayedPrice,
  getPackageLimitsForCycle,
  getPackagePresentation,
  subscriptionPackagesWithPricing,
} from './hqPackagePresentation';
import { formatDateDMY } from '@/utils/dateDisplay';
import { DrawerCloseButton } from '../drawers/DrawerCloseButton';
import { DrawerTabBar } from '../drawers/DrawerTabBar';
import { HqPrimaryButton, HqSecondaryButton, HQ_SELECT_CLASS } from './hqUi';
import { requestConfirm, requestSuccess } from '@/lib/appDialog';
import { HqTenantBehaviorAnalyticsPanel } from './HqTenantBehaviorDrawer';

type DetailTab = 'overview' | 'pricing' | 'analytics' | 'tabs' | 'status';

const DETAIL_TABS: Array<{
  id: DetailTab;
  label: string;
  icon: React.ComponentType<{ className?: string; size?: number }>;
}> = [
  { id: 'overview', label: 'Overview', icon: Building2 },
  { id: 'pricing', label: 'Pricing', icon: CreditCard },
  { id: 'analytics', label: 'Analytics', icon: Activity },
  { id: 'tabs', label: 'Tabs', icon: LayoutGrid },
  { id: 'status', label: 'Status', icon: Settings2 },
];

type Props = {
  open: boolean;
  tenant: HqTenantRow | null;
  planOptions: HqSubscriptionPackage[];
  pendingPlanEmail: string;
  pendingPauseEmail: string;
  onClose: () => void;
  onSaved: () => void;
  onAssignPlan: (email: string, planId: string, billingCycle?: BillingCycle) => void;
  onSetTenantPause: (email: string, paused: boolean) => void;
};

function isTenantPaused(tenant: HqTenantRow) {
  return String(tenant.status || 'ACTIVE').toUpperCase() === 'PAUSED';
}

function tenantPlanId(tenant: HqTenantRow, planOptions: HqSubscriptionPackage[]) {
  if (tenant.subscriptionPlan?.id) return tenant.subscriptionPlan.id;
  const match = planOptions.find(
    (pkg) => pkg.name.toLowerCase() === String(tenant.subscriptionPlan?.name || '').toLowerCase(),
  );
  return match?.id || '';
}

function tenantBillingCycle(tenant: HqTenantRow): BillingCycle {
  return tenant.subscriptionPlan?.billingCycle === 'annual' ? 'annual' : 'monthly';
}

function formatPlanLimits(plan: HqTenantRow['subscriptionPlan']) {
  if (!plan) return '—';
  const users = plan.maxUsers == null ? '∞ users' : `${plan.maxUsers} users`;
  const jobs = plan.maxJobs == null ? '∞ jobs' : `${plan.maxJobs} jobs`;
  return `${users} · ${jobs}`;
}

function formatUsd(amount: string) {
  const trimmed = String(amount || '').trim();
  if (!trimmed || trimmed === '—') return '—';
  return trimmed.startsWith('$') ? trimmed : `$${trimmed}`;
}

function planOptionLabelWithPrice(
  pkg: HqSubscriptionPackage,
  billingCycle: BillingCycle,
): string {
  const presentation = getPackagePresentation(pkg);
  const { amount, periodLabel } = getDisplayedPrice(presentation, billingCycle);
  return `${getPackageOptionLabel(pkg)} — ${formatUsd(amount)} ${periodLabel}`;
}

export function HqTenantDetailDrawer({
  open,
  tenant,
  planOptions,
  pendingPlanEmail,
  pendingPauseEmail,
  onClose,
  onSaved,
  onAssignPlan,
  onSetTenantPause,
}: Props) {
  const [portalReady, setPortalReady] = useState(false);
  const [activeTab, setActiveTab] = useState<DetailTab>('overview');
  const [productLine, setProductLine] = useState<TenantProductLine>('crm');
  const [enabledModules, setEnabledModules] = useState<string[]>([]);
  const [phase1CommonPoolEnabled, setPhase1CommonPoolEnabled] = useState(true);
  const [savingTabs, setSavingTabs] = useState(false);
  const [tabsError, setTabsError] = useState('');
  const [coins, setCoins] = useState('');
  const [savingCoins, setSavingCoins] = useState(false);
  const [coinsError, setCoinsError] = useState('');
  const [pricingBillingPreview, setPricingBillingPreview] = useState<BillingCycle>('monthly');
  const [editingCompanyName, setEditingCompanyName] = useState(false);
  const [companyNameDraft, setCompanyNameDraft] = useState('');
  const [savingCompanyName, setSavingCompanyName] = useState(false);
  const [companyNameError, setCompanyNameError] = useState('');
  const [jobsApiBusy, setJobsApiBusy] = useState(false);
  const [jobsApiError, setJobsApiError] = useState('');
  const [jobsApiKeyVisible, setJobsApiKeyVisible] = useState(false);

  const packagesWithPricing = useMemo(
    () => subscriptionPackagesWithPricing(planOptions),
    [planOptions],
  );

  useEffect(() => {
    setPortalReady(true);
  }, []);

  useEffect(() => {
    if (!open || !tenant) return;
    setActiveTab('overview');
    const line: TenantProductLine =
      String(tenant.productLine || '').toLowerCase() === 'recruitment' ? 'recruitment' : 'crm';
    setProductLine(line);
    setEnabledModules(
      Array.isArray(tenant.enabledModules) && tenant.enabledModules.length > 0
        ? [...tenant.enabledModules]
        : defaultModulesForProductLine(line),
    );
    setPhase1CommonPoolEnabled(tenant.phase1CommonPoolEnabled !== false);
    setCoins(String(tenant.subscriptionPlan?.coins ?? 0));
    setPricingBillingPreview(
      tenant.subscriptionPlan?.billingCycle === 'annual' ? 'annual' : 'monthly',
    );
    setTabsError('');
    setCoinsError('');
    setSavingTabs(false);
    setSavingCoins(false);
    setEditingCompanyName(false);
    setCompanyNameDraft(String(tenant.organizationName || '').trim());
    setSavingCompanyName(false);
    setCompanyNameError('');
  }, [open, tenant]);

  useEffect(() => {
    setJobsApiKeyVisible(false);
    setJobsApiError('');
  }, [tenant?.email]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !savingTabs && !savingCoins && !savingCompanyName) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, savingTabs, savingCoins, savingCompanyName, onClose]);

  const catalog = useMemo(() => ALL_TENANT_MODULES, []);

  if (!portalReady || typeof document === 'undefined') return null;
  if (!open || !tenant) return null;

  const paused = isTenantPaused(tenant);
  const planId = tenantPlanId(tenant, packagesWithPricing);
  const billing = tenantBillingCycle(tenant);
  const selectedPackage =
    findPackageForPlan(tenant.subscriptionPlan, packagesWithPricing) ||
    packagesWithPricing.find((pkg) => pkg.id === planId) ||
    null;
  const selectedPresentation = selectedPackage ? getPackagePresentation(selectedPackage) : null;
  const currentPrice = selectedPresentation
    ? getDisplayedPrice(selectedPresentation, billing)
    : tenant.subscriptionPlan?.price
      ? { amount: tenant.subscriptionPlan.price, periodLabel: 'per month' }
      : null;
  const previewLimits = selectedPackage
    ? getPackageLimitsForCycle(selectedPackage, pricingBillingPreview)
    : null;
  const planBusy = pendingPlanEmail === tenant.email;
  const pauseBusy = pendingPauseEmail === tenant.email;
  const readOnly = Boolean(tenant.isLandingSignupOnly);

  const toggleModule = (id: string) => {
    setEnabledModules((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id],
    );
  };

  const selectLineDefaults = (line: TenantProductLine) => {
    setProductLine(line);
    setEnabledModules(defaultModulesForProductLine(line));
  };

  const handleSaveTabs = async () => {
    if (enabledModules.length === 0) {
      setTabsError('Select at least one tab to keep enabled.');
      return;
    }
    setSavingTabs(true);
    setTabsError('');
    try {
      await apiHqUpdateTenantModules({
        email: tenant.email,
        productLine,
        enabledModules,
        phase1CommonPoolEnabled,
      });
      void requestSuccess('Tabs updated and synced to Phase 2. Ask the user to refresh or re-open Phase 2.');
      onSaved();
    } catch (err) {
      setTabsError(err instanceof Error ? err.message : 'Failed to update modules');
    } finally {
      setSavingTabs(false);
    }
  };

  const handleSaveCoins = async () => {
    setSavingCoins(true);
    setCoinsError('');
    try {
      const n = Math.max(0, Math.floor(Number(coins) || 0));
      await apiHqSetTenantCoins({ email: tenant.email, coins: n });
      void requestSuccess('AI coin balance updated.');
      onSaved();
    } catch (err) {
      setCoinsError(err instanceof Error ? err.message : 'Failed to update coins');
    } finally {
      setSavingCoins(false);
    }
  };

  const handleSaveCompanyName = async () => {
    const next = companyNameDraft.trim();
    if (next.length < 2) {
      setCompanyNameError('Company name must be at least 2 characters.');
      return;
    }
    setSavingCompanyName(true);
    setCompanyNameError('');
    try {
      await apiHqUpdateTenantOrganizationName({
        email: tenant.email,
        organizationName: next,
      });
      setEditingCompanyName(false);
      void requestSuccess('Company name updated.');
      onSaved();
    } catch (err) {
      setCompanyNameError(err instanceof Error ? err.message : 'Failed to update company name');
    } finally {
      setSavingCompanyName(false);
    }
  };

  const handleIssueJobsApiKey = async (rotate: boolean) => {
    if (!tenant?.email) return;
    if (rotate) {
      const ok = await requestConfirm(
        'Generate a new jobs API key? The previous key will stop working immediately.',
      );
      if (!ok) return;
    }
    setJobsApiBusy(true);
    setJobsApiError('');
    try {
      await apiHqIssueTenantJobsApiKey({ email: tenant.email });
      setJobsApiKeyVisible(true);
      void requestSuccess(rotate ? 'New jobs API key generated.' : 'Jobs API key created.');
      onSaved();
    } catch (err) {
      setJobsApiError(err instanceof Error ? err.message : 'Failed to issue jobs API key');
    } finally {
      setJobsApiBusy(false);
    }
  };

  const handleRevokeJobsApiKey = async () => {
    if (!tenant?.email) return;
    const ok = await requestConfirm(
      'Revoke this jobs API key? Any website or integration using it will stop receiving jobs.',
    );
    if (!ok) return;
    setJobsApiBusy(true);
    setJobsApiError('');
    try {
      await apiHqRevokeTenantJobsApiKey({ email: tenant.email });
      setJobsApiKeyVisible(false);
      void requestSuccess('Jobs API key revoked.');
      onSaved();
    } catch (err) {
      setJobsApiError(err instanceof Error ? err.message : 'Failed to revoke jobs API key');
    } finally {
      setJobsApiBusy(false);
    }
  };

  const copyText = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      void requestSuccess(`${label} copied.`);
    } catch {
      setJobsApiError(`Could not copy ${label.toLowerCase()}.`);
    }
  };

  const drawerTree = (
    <AnimatePresence>
      {open && tenant ? (
        <>
          <motion.div
            key="tenant-detail-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[500] bg-slate-900/45 backdrop-blur-[2px] pointer-events-auto"
          />
          <div className="pointer-events-none fixed inset-0 z-[501] flex items-center justify-center p-3 sm:p-6">
            <motion.div
              key="tenant-detail-panel"
              initial={{ opacity: 0, scale: 0.96, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 12 }}
              transition={{ type: 'spring', damping: 28, stiffness: 320 }}
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-labelledby="tenant-detail-title"
              className={`pointer-events-auto relative flex h-[min(92vh,940px)] w-full flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-2xl ring-1 ring-slate-900/5 ${
                activeTab === 'analytics' ? 'max-w-6xl' : 'max-w-4xl'
              }`}
            >
              <div className="shrink-0 border-b border-blue-100/70 bg-gradient-to-r from-blue-50/95 via-indigo-50/50 to-white px-5 py-4 sm:px-6">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2
                        id="tenant-detail-title"
                        className="text-lg font-bold tracking-tight text-slate-900"
                      >
                        {tenant.organizationName || tenant.name || 'User'}
                      </h2>
                      <button
                        type="button"
                        onClick={() => {
                          setCompanyNameDraft(String(tenant.organizationName || '').trim());
                          setCompanyNameError('');
                          setEditingCompanyName(true);
                          setActiveTab('overview');
                        }}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-600 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                      >
                        <Pencil className="h-3 w-3" />
                        Edit
                      </button>
                    </div>
                    <p className="mt-0.5 truncate text-sm text-slate-600">{tenant.email}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ${
                          paused
                            ? 'bg-amber-50 text-amber-700 ring-amber-100'
                            : 'bg-emerald-50 text-emerald-700 ring-emerald-100'
                        }`}
                      >
                        {paused ? 'Paused' : 'Running'}
                      </span>
                      {tenant.productLine ? (
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ${
                            tenant.productLine === 'recruitment'
                              ? 'bg-amber-50 text-amber-800 ring-amber-100'
                              : 'bg-sky-50 text-sky-800 ring-sky-100'
                          }`}
                        >
                          {tenant.productLine === 'recruitment' ? 'Recruitment' : 'CRM'}
                        </span>
                      ) : null}
                      {tenant.organizationType ? (
                        <span className="text-xs font-semibold text-sky-700">{tenant.organizationType}</span>
                      ) : null}
                    </div>
                  </div>
                  <DrawerCloseButton onClick={onClose} />
                </div>

                <DrawerTabBar
                  variant="embedded"
                  className="mt-4"
                  ariaLabel="User details"
                  tabs={DETAIL_TABS}
                  activeId={activeTab}
                  onChange={setActiveTab}
                />
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
                {activeTab === 'overview' ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3 sm:col-span-2">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          Company name
                        </p>
                        {!editingCompanyName ? (
                          <button
                            type="button"
                            onClick={() => {
                              setCompanyNameDraft(String(tenant.organizationName || '').trim());
                              setCompanyNameError('');
                              setEditingCompanyName(true);
                            }}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            Edit
                          </button>
                        ) : null}
                      </div>
                      {editingCompanyName ? (
                        <div className="mt-2 space-y-2">
                          <input
                            autoFocus
                            value={companyNameDraft}
                            onChange={(e) => setCompanyNameDraft(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                void handleSaveCompanyName();
                              }
                              if (e.key === 'Escape') {
                                e.preventDefault();
                                e.stopPropagation();
                                setEditingCompanyName(false);
                                setCompanyNameDraft(String(tenant.organizationName || '').trim());
                                setCompanyNameError('');
                              }
                            }}
                            disabled={savingCompanyName}
                            className="w-full rounded-xl border border-blue-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                            placeholder="Acme Recruiters Pvt Ltd"
                          />
                          {companyNameError ? (
                            <p className="text-xs text-rose-600">{companyNameError}</p>
                          ) : (
                            <p className="text-[11px] text-slate-500">
                              This name is shown on the tenant’s Phase 2 profile and company page.
                            </p>
                          )}
                          <div className="flex flex-wrap gap-2">
                            <HqPrimaryButton
                              type="button"
                              onClick={() => void handleSaveCompanyName()}
                              disabled={savingCompanyName}
                              loading={savingCompanyName}
                            >
                              Save name
                            </HqPrimaryButton>
                            <HqSecondaryButton
                              type="button"
                              disabled={savingCompanyName}
                              onClick={() => {
                                setEditingCompanyName(false);
                                setCompanyNameDraft(String(tenant.organizationName || '').trim());
                                setCompanyNameError('');
                              }}
                            >
                              Cancel
                            </HqSecondaryButton>
                          </div>
                        </div>
                      ) : (
                        <>
                          <p className="mt-1 text-sm font-semibold text-slate-900">
                            {tenant.organizationName || '—'}
                          </p>
                          <p className="mt-1 text-[11px] text-slate-500">
                            Shown on the tenant’s Phase 2 profile and company page.
                          </p>
                        </>
                      )}
                    </div>

                    <div className="sm:col-span-2 rounded-xl border border-sky-200 bg-sky-50/60 px-4 py-3">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-sky-700">
                            <KeyRound className="h-3.5 w-3.5" />
                            Jobs API key
                          </p>
                          <p className="mt-1 max-w-xl text-[11px] leading-snug text-slate-600">
                            This key only serves this tenant’s posted jobs. Do not paste the key in Google.
                            Open the jobs link below in the browser address bar.
                          </p>
                        </div>
                      </div>
                      {readOnly ? (
                        <p className="mt-3 text-xs text-amber-700">
                          Provision the tenant workspace first, then generate a key.
                        </p>
                      ) : tenant.jobsApiKey ? (
                        <div className="mt-3 space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <code className="min-w-0 flex-1 break-all rounded-lg border border-sky-100 bg-white px-3 py-2 font-mono text-[11px] text-slate-800">
                              {jobsApiKeyVisible
                                ? tenant.jobsApiKey
                                : `${tenant.jobsApiKey.slice(0, 8)}${'•'.repeat(18)}${tenant.jobsApiKey.slice(-4)}`}
                            </code>
                            <button
                              type="button"
                              onClick={() => setJobsApiKeyVisible((v) => !v)}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                              title={jobsApiKeyVisible ? 'Hide key' : 'Show key'}
                            >
                              {jobsApiKeyVisible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                            </button>
                            <button
                              type="button"
                              onClick={() => void copyText(tenant.jobsApiKey || '', 'API key')}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                              title="Copy API key"
                            >
                              <Copy className="h-3.5 w-3.5" />
                            </button>
                          </div>
                          {tenant.jobsApiUrl ? (
                            <div className="space-y-1.5">
                              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                Open this in the browser
                              </p>
                              <div className="flex flex-wrap items-center gap-2">
                                <code className="min-w-0 flex-1 break-all rounded-lg border border-sky-100 bg-white px-3 py-2 font-mono text-[11px] text-slate-600">
                                  {tenant.jobsApiUrl}
                                </code>
                                <button
                                  type="button"
                                  onClick={() => void copyText(tenant.jobsApiUrl || '', 'Jobs link')}
                                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                                  title="Copy jobs link"
                                >
                                  <Copy className="h-3.5 w-3.5" />
                                </button>
                                <a
                                  href={tenant.jobsApiUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex h-8 items-center gap-1 rounded-lg border border-sky-200 bg-white px-2.5 text-[11px] font-semibold text-sky-700 hover:bg-sky-50"
                                >
                                  <ExternalLink className="h-3.5 w-3.5" />
                                  Open
                                </a>
                              </div>
                            </div>
                          ) : null}
                          <div className="flex flex-wrap gap-2">
                            <HqSecondaryButton
                              type="button"
                              disabled={jobsApiBusy}
                              onClick={() => void handleIssueJobsApiKey(true)}
                            >
                              <RefreshCw className={`h-3.5 w-3.5 ${jobsApiBusy ? 'animate-spin' : ''}`} />
                              Regenerate
                            </HqSecondaryButton>
                            <HqSecondaryButton
                              type="button"
                              disabled={jobsApiBusy}
                              onClick={() => void handleRevokeJobsApiKey()}
                            >
                              Revoke
                            </HqSecondaryButton>
                          </div>
                        </div>
                      ) : (
                        <div className="mt-3">
                          <HqPrimaryButton
                            type="button"
                            disabled={jobsApiBusy}
                            loading={jobsApiBusy}
                            onClick={() => void handleIssueJobsApiKey(false)}
                          >
                            Generate API key
                          </HqPrimaryButton>
                        </div>
                      )}
                      {jobsApiError ? <p className="mt-2 text-xs text-rose-600">{jobsApiError}</p> : null}
                    </div>

                    <InfoCard label="Database" value={tenant.tenantDbName || '—'} mono />
                    <InfoCard
                      label="Source"
                      value={String(tenant.signupSource || '—').replace(/_/g, ' ')}
                    />
                    <InfoCard label="Plan" value={tenant.subscriptionPlan?.name || 'Unassigned'} />
                    <InfoCard
                      label="Price"
                      value={
                        currentPrice
                          ? `${formatUsd(currentPrice.amount)} ${currentPrice.periodLabel}`
                          : '—'
                      }
                    />
                    <InfoCard label="Billing" value={formatBillingCycleLabel(billing)} />
                    <InfoCard label="Limits" value={formatPlanLimits(tenant.subscriptionPlan)} />
                    <InfoCard
                      label="AI coins"
                      value={String(tenant.subscriptionPlan?.coins ?? 0)}
                    />
                    <InfoCard
                      label="Plan start"
                      value={formatDateDMY(tenant.subscriptionPlan?.planStartDate) || '—'}
                    />
                    <InfoCard
                      label="Plan end"
                      value={formatDateDMY(tenant.subscriptionPlan?.planEndDate) || '—'}
                    />
                    {readOnly ? (
                      <div className="sm:col-span-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                        Landing signup only — provision/sync pending. Pricing and tabs stay read-only until
                        the tenant DB is ready.
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {activeTab === 'pricing' ? (
                  <div className="space-y-5">
                    <section className="rounded-2xl border border-emerald-200/80 bg-gradient-to-br from-emerald-50/90 via-white to-sky-50/40 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">
                            Current pricing
                          </p>
                          <p className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
                            {currentPrice ? formatUsd(currentPrice.amount) : '—'}
                          </p>
                          <p className="text-xs text-slate-500">
                            {currentPrice?.periodLabel || 'No plan assigned'}
                            {tenant.subscriptionPlan?.name
                              ? ` · ${getPackageOptionLabel(
                                  selectedPackage || {
                                    name: tenant.subscriptionPlan.name,
                                    displayName: tenant.subscriptionPlan.name,
                                  },
                                )}`
                              : ''}
                          </p>
                        </div>
                        <div className="text-right text-xs text-slate-500">
                          <p>
                            Billing: <span className="font-semibold text-slate-700">{formatBillingCycleLabel(billing)}</span>
                          </p>
                          <p className="mt-0.5">
                            Limits:{' '}
                            <span className="font-semibold text-slate-700">
                              {formatPlanLimits(tenant.subscriptionPlan)}
                            </span>
                          </p>
                        </div>
                      </div>
                    </section>

                    <section className="rounded-2xl border border-slate-200/80 bg-slate-50/50 p-4">
                      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                          Assign subscription plan
                        </p>
                        <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs shadow-sm">
                          <span
                            className={
                              pricingBillingPreview === 'monthly'
                                ? 'font-semibold text-slate-900'
                                : 'text-slate-500'
                            }
                          >
                            Monthly
                          </span>
                          <button
                            type="button"
                            role="switch"
                            aria-checked={pricingBillingPreview === 'annual'}
                            disabled={readOnly}
                            onClick={() =>
                              setPricingBillingPreview((prev) =>
                                prev === 'monthly' ? 'annual' : 'monthly',
                              )
                            }
                            className={`relative h-5 w-9 rounded-full transition disabled:opacity-50 ${
                              pricingBillingPreview === 'annual' ? 'bg-blue-600' : 'bg-slate-200'
                            }`}
                          >
                            <span
                              className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition ${
                                pricingBillingPreview === 'annual' ? 'translate-x-4' : 'translate-x-0'
                              }`}
                            />
                          </button>
                          <span
                            className={
                              pricingBillingPreview === 'annual'
                                ? 'font-semibold text-slate-900'
                                : 'text-slate-500'
                            }
                          >
                            Annual
                          </span>
                        </div>
                      </div>

                      {packagesWithPricing.length === 0 ? (
                        <p className="rounded-xl border border-dashed border-slate-200 bg-white px-4 py-6 text-center text-sm text-slate-500">
                          No subscription plans found. Create plans under HQ → Plans first.
                        </p>
                      ) : (
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                          {packagesWithPricing.map((pkg) => {
                            const presentation = getPackagePresentation(pkg);
                            const displayed = getDisplayedPrice(presentation, pricingBillingPreview);
                            const limits = getPackageLimitsForCycle(pkg, pricingBillingPreview);
                            const active = planId === pkg.id && billing === pricingBillingPreview;
                            const selectedPlanOnly = planId === pkg.id;
                            return (
                              <button
                                key={pkg.id}
                                type="button"
                                disabled={planBusy || readOnly}
                                onClick={() => onAssignPlan(tenant.email, pkg.id, pricingBillingPreview)}
                                className={`rounded-xl border p-4 text-left transition disabled:cursor-not-allowed disabled:opacity-60 ${
                                  active
                                    ? 'border-blue-400 bg-blue-50/80 shadow-sm ring-2 ring-blue-200'
                                    : selectedPlanOnly
                                      ? 'border-indigo-200 bg-indigo-50/50 hover:border-indigo-300'
                                      : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/80'
                                }`}
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <p className="text-sm font-bold text-slate-900">
                                    {getPackageOptionLabel(pkg)}
                                  </p>
                                  {active ? (
                                    <span className="rounded-full bg-blue-600 px-2 py-0.5 text-[10px] font-bold uppercase text-white">
                                      Active
                                    </span>
                                  ) : null}
                                </div>
                                <p className="mt-2 flex items-baseline gap-1">
                                  <DollarSign className="h-4 w-4 text-emerald-600" />
                                  <span className="text-xl font-bold text-slate-900">
                                    {formatUsd(displayed.amount).replace('$', '')}
                                  </span>
                                  <span className="text-[11px] text-slate-500">{displayed.periodLabel}</span>
                                </p>
                                <p className="mt-2 text-[11px] text-slate-500">
                                  {limits.maxUsers == null ? '∞' : limits.maxUsers} users ·{' '}
                                  {limits.maxJobs == null ? '∞' : limits.maxJobs} jobs
                                </p>
                              </button>
                            );
                          })}
                        </div>
                      )}

                      <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        <div>
                          <label className="mb-1.5 block text-xs font-semibold text-slate-600">Plan</label>
                          <select
                            value={planId}
                            disabled={planBusy || readOnly}
                            onChange={(e) =>
                              onAssignPlan(tenant.email, e.target.value, pricingBillingPreview)
                            }
                            className={HQ_SELECT_CLASS}
                          >
                            <option value="">— Unassigned —</option>
                            {packagesWithPricing.map((opt) => (
                              <option key={opt.id} value={opt.id}>
                                {planOptionLabelWithPrice(opt, pricingBillingPreview)}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                            Billing cycle
                          </label>
                          <select
                            value={billing}
                            disabled={planBusy || readOnly || !planId}
                            onChange={(e) => {
                              if (!planId) return;
                              const next = e.target.value as BillingCycle;
                              setPricingBillingPreview(next);
                              onAssignPlan(tenant.email, planId, next);
                            }}
                            className={HQ_SELECT_CLASS}
                          >
                            <option value="monthly">Monthly</option>
                            <option value="annual">Annual</option>
                          </select>
                        </div>
                      </div>
                      {previewLimits ? (
                        <p className="mt-2 text-xs text-slate-500">
                          Selected preview limits:{' '}
                          {previewLimits.maxUsers == null ? '∞' : previewLimits.maxUsers} users ·{' '}
                          {previewLimits.maxJobs == null ? '∞' : previewLimits.maxJobs} jobs
                          {planBusy ? ' · Saving…' : ''}
                        </p>
                      ) : (
                        <p className="mt-2 text-xs text-slate-500">
                          Limits: {formatPlanLimits(tenant.subscriptionPlan)}
                          {planBusy ? ' · Saving…' : ''}
                        </p>
                      )}
                    </section>

                    <section className="rounded-2xl border border-slate-200/80 bg-white p-4">
                      <div className="mb-3 flex items-center gap-2">
                        <Coins className="h-4 w-4 text-amber-600" />
                        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                          AI coins
                        </p>
                      </div>
                      {coinsError ? (
                        <div className="mb-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                          {coinsError}
                        </div>
                      ) : null}
                      <div className="flex flex-wrap items-end gap-3">
                        <div className="min-w-[10rem] flex-1">
                          <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                            Coin balance
                          </label>
                          <input
                            type="number"
                            min={0}
                            value={coins}
                            disabled={savingCoins || readOnly}
                            onChange={(e) => setCoins(e.target.value)}
                            className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                          />
                        </div>
                        <HqPrimaryButton
                          type="button"
                          onClick={() => void handleSaveCoins()}
                          disabled={savingCoins || readOnly}
                          loading={savingCoins}
                        >
                          Save coins
                        </HqPrimaryButton>
                      </div>
                      <p className="mt-2 text-xs text-slate-500">
                        Tenant users spend these on Phase 2 AI features. At 0, AI actions stay locked.
                      </p>
                    </section>
                  </div>
                ) : null}

                {activeTab === 'tabs' ? (
                  <div className="space-y-4">
                    <section className="rounded-2xl border border-slate-200/80 bg-slate-50/60 p-4">
                      <p className="mb-2.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                        Product line presets
                      </p>
                      <div className="inline-flex flex-wrap gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
                        {(['crm', 'recruitment'] as TenantProductLine[]).map((line) => (
                          <button
                            key={line}
                            type="button"
                            disabled={readOnly}
                            onClick={() => selectLineDefaults(line)}
                            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50 ${
                              productLine === line
                                ? line === 'recruitment'
                                  ? 'bg-amber-600 text-white'
                                  : 'bg-blue-600 text-white'
                                : 'text-slate-600 hover:bg-slate-50'
                            }`}
                          >
                            {line === 'recruitment' ? 'Recruitment defaults' : 'CRM defaults'}
                          </button>
                        ))}
                        <button
                          type="button"
                          disabled={readOnly}
                          onClick={() => setEnabledModules(catalog.map((m) => m.id))}
                          className="rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                        >
                          Enable all
                        </button>
                        <button
                          type="button"
                          disabled={readOnly}
                          onClick={() => setEnabledModules([])}
                          className="rounded-lg px-3 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-50"
                        >
                          Clear
                        </button>
                      </div>
                    </section>

                    <section className="rounded-xl border border-violet-100 bg-violet-50/40 p-3.5">
                      <label className="flex cursor-pointer items-start gap-3">
                        <input
                          type="checkbox"
                          checked={phase1CommonPoolEnabled}
                          disabled={readOnly}
                          onChange={(e) => setPhase1CommonPoolEnabled(e.target.checked)}
                          className="mt-0.5 h-4 w-4 rounded border-slate-300 text-violet-600 focus:ring-violet-500 disabled:opacity-50"
                        />
                        <span>
                          <span className="block text-sm font-semibold text-slate-900">
                            Phase 1 candidate database access
                          </span>
                          <span className="mt-0.5 block text-[11px] leading-relaxed text-slate-500">
                            Show Hrayntra Phase 1 candidates on Phase 2 → Candidates → All candidates.
                          </span>
                        </span>
                      </label>
                    </section>

                    <div className="mb-1 flex items-center justify-between">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                        Sidenav tabs
                      </p>
                      <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-[11px] font-bold text-blue-700 ring-1 ring-blue-100">
                        {enabledModules.length} enabled
                      </span>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {catalog.map((mod) => {
                        const on = enabledModules.includes(mod.id);
                        const Icon = mod.icon;
                        return (
                          <button
                            key={mod.id}
                            type="button"
                            disabled={readOnly}
                            onClick={() => toggleModule(mod.id)}
                            className={`flex items-center gap-3 rounded-xl border px-3.5 py-3 text-left transition disabled:cursor-not-allowed disabled:opacity-60 ${
                              on
                                ? 'border-blue-300 bg-blue-50/80 shadow-sm ring-1 ring-blue-200/80'
                                : 'border-slate-200 bg-white hover:border-slate-300'
                            }`}
                          >
                            <span
                              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                                on ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'
                              }`}
                            >
                              <Icon className="h-4 w-4" />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block text-sm font-semibold text-slate-900">{mod.label}</span>
                              <span className="block truncate text-[10px] text-slate-400">{mod.id}</span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                    {tabsError ? (
                      <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                        {tabsError}
                      </div>
                    ) : null}
                    <div className="flex justify-end">
                      <HqPrimaryButton
                        type="button"
                        onClick={() => void handleSaveTabs()}
                        disabled={savingTabs || readOnly}
                        loading={savingTabs}
                      >
                        Save tabs
                      </HqPrimaryButton>
                    </div>
                  </div>
                ) : null}

                {activeTab === 'analytics' ? (
                  tenant.isLandingSignupOnly || !tenant.tenantDbName ? (
                    <div className="rounded-xl border border-dashed border-amber-200 bg-amber-50/60 px-4 py-6 text-sm text-amber-800">
                      Behaviour analytics are available after this tenant is fully provisioned and has a
                      database. Landing-only signups stay read-only until sync completes.
                    </div>
                  ) : (
                    <HqTenantBehaviorAnalyticsPanel tenant={tenant} />
                  )
                ) : null}

                {activeTab === 'status' ? (
                  <div className="space-y-4">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
                      <p className="text-sm font-semibold text-slate-900">
                        Tenant is currently {paused ? 'paused' : 'running'}
                      </p>
                      <p className="mt-1 text-xs leading-relaxed text-slate-500">
                        {paused
                          ? 'Paused tenants see a blocking notice in Phase 2 until you resume them.'
                          : 'Pause to block Phase 2 use without deleting the tenant or database.'}
                      </p>
                      <div className="mt-4">
                        {paused ? (
                          <HqPrimaryButton
                            type="button"
                            disabled={pauseBusy || readOnly}
                            onClick={() => onSetTenantPause(tenant.email, false)}
                          >
                            {pauseBusy ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Play className="h-4 w-4" />
                            )}
                            Resume tenant
                          </HqPrimaryButton>
                        ) : (
                          <HqSecondaryButton
                            type="button"
                            disabled={pauseBusy || readOnly}
                            onClick={() => onSetTenantPause(tenant.email, true)}
                            className="!border-amber-200 !text-amber-800 hover:!bg-amber-50"
                          >
                            {pauseBusy ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Pause className="h-4 w-4" />
                            )}
                            Pause tenant
                          </HqSecondaryButton>
                        )}
                      </div>
                    </div>
                    <p className="text-xs text-slate-500">
                      To permanently remove this tenant and drop its database, use the Delete icon on the
                      tenants table.
                    </p>
                  </div>
                ) : null}
              </div>

              <div className="flex shrink-0 items-center justify-end border-t border-slate-200 bg-slate-50/80 px-5 py-3.5 sm:px-6">
                <HqSecondaryButton type="button" onClick={onClose}>
                  Close
                </HqSecondaryButton>
              </div>
            </motion.div>
          </div>
        </>
      ) : null}
    </AnimatePresence>
  );

  return createPortal(drawerTree, document.body);
}

function InfoCard({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3">
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
      <p className={`mt-1 text-sm font-semibold text-slate-900 ${mono ? 'font-mono text-xs' : ''}`}>
        {value}
      </p>
    </div>
  );
}
