"use client";

import React, { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useSearchParams } from 'next/navigation';
import {
  Mail,
  User,
  Lock,
  ArrowRight,
  Hash,
  RefreshCcw,
  Plus,
  Eye,
  Trash2,
} from 'lucide-react';
import {
  buildApiUrl,
  apiHqProvisionTenant,
  apiHqListTenants,
  apiHqAssignTenantPlan,
  apiHqDeleteTenant,
  apiHqSetTenantPause,
  apiHqGetAnalytics,
  type HqTenantRow,
  type HqSubscriptionPackage,
  type HqAnalyticsPayload,
} from '../../lib/api';
import { HqPackagesPanel } from '../../components/hq/HqPackagesPanel';
import {
  DeleteTenantConfirmModal,
  type DeleteTenantTarget,
} from '../../components/hq/DeleteTenantConfirmModal';
import { HqTenantDetailDrawer } from '../../components/hq/HqTenantDetailDrawer';
import {
  CreateTenantModal,
  emptyProvisionTenantForm,
  type ProvisionTenantFormData,
} from '../../components/hq/CreateTenantModal';
import {
  getPackageOptionLabel,
  getPlanLabel,
  formatBillingCycleLabel,
  subscriptionPackagesWithPricing,
  findPackageForPlan,
  getPackagePresentation,
  getDisplayedPrice,
  type BillingCycle,
} from '../../components/hq/hqPackagePresentation';
import { formatDateDMY } from '../../utils/dateDisplay';
import type { HqNavTab } from '../../components/hq/HqSidebar';
import { HQ_NAV_ITEMS } from '../../components/hq/HqSidebar';
import {
  HqAlert,
  HqFieldText,
  HqPageContainer,
  HqPageHeader,
  HqPageMain,
  HqPanel,
  HqPanelTitle,
  HqPrimaryButton,
  HqSecondaryButton,
  HqStatCard,
} from '../../components/hq/hqUi';
import {
  HqAnalyticsViewTabs,
  type HqAnalyticsView,
} from '../../components/hq/analytics/HqAnalyticsViewTabs';
import { HqPhase1CommandDashboard } from '../../components/hq/analytics/HqPhase1CommandDashboard';
import { HqPhase2CommandDashboard } from '../../components/hq/analytics/HqPhase2CommandDashboard';
import { HqAnalyticsLoadingSkeleton } from '../../components/hq/analytics/HqAnalyticsLoadingSkeleton';

interface HqStats {
  total: number;
  agency: number;
  standalone: number;
  landingPurchases?: number;
  landingTrials?: number;
  planCounts: Record<string, number>;
}

const TAB_DESCRIPTIONS: Record<HqNavTab, string> = {
  dashboard: 'Portal and employer platform analytics, plus tenant overview.',
  tenants: 'All Phase 2 workspaces — including employers who purchased from the landing page.',
  plans: '',
  bootstrap: 'Local-only super admin credential injection.',
};

const VIEW_DESCRIPTIONS: Record<HqAnalyticsView, string> = {
  employee:
    'Portal analytics — candidates, applications, jobs, match scores, and talent insights.',
  employer:
    'Hiring analytics — tenants, jobs, pipelines, placements, and HQ CRM lead/company funnel.',
  platform: 'Platform health, tenant counts, and plan distribution.',
};

const FALLBACK_PLAN_OPTIONS: HqSubscriptionPackage[] = [
  {
    id: 'starter',
    slug: 'starter',
    name: 'Starter',
    displayName: 'STARTER',
    description: 'For small teams hiring their first roles on HRYANTRA.',
    price: '149',
    yearlyPrice: '119',
    pricePeriod: 'per month',
    features: [
      'Up to 25 active job postings',
      'AI CV screening & ATS scoring',
      'Candidate pipeline & interviews',
      'Basic analytics dashboard',
      'Email support (48h response)',
    ],
    isPopular: false,
    maxUsers: 5,
    maxJobs: 25,
    annualMaxUsers: 8,
    annualMaxJobs: 40,
    isSystem: true,
  },
  {
    id: 'professional',
    slug: 'professional',
    name: 'Professional',
    displayName: 'PROFESSIONAL',
    description: 'For growing companies running hiring and HR in one place.',
    price: '399',
    yearlyPrice: '319',
    pricePeriod: 'per month',
    features: [
      'Unlimited job postings',
      'Full AI recruitment suite',
      'Employee management & onboarding',
      'Performance & payroll modules',
      'Multi-platform job publishing',
      'Priority support (24h response)',
      'Team collaboration & roles',
    ],
    isPopular: true,
    maxUsers: 25,
    maxJobs: null,
    annualMaxUsers: 40,
    annualMaxJobs: null,
    isSystem: true,
  },
  {
    id: 'enterprise',
    slug: 'enterprise',
    name: 'Enterprise',
    displayName: 'ENTERPRISE',
    description: 'For large organizations with complex HR operations.',
    price: '999',
    yearlyPrice: '799',
    pricePeriod: 'per month',
    features: [
      'Everything in Professional',
      'Custom workflows & integrations',
      'Dedicated account manager',
      'SSO & advanced security',
      'SLA-backed uptime',
      'On-premise / private cloud options',
      'Custom contracts & training',
    ],
    isPopular: false,
    maxUsers: null,
    maxJobs: null,
    annualMaxUsers: null,
    annualMaxJobs: null,
    isSystem: true,
  },
];

function tenantBillingCycle(tenant: HqTenantRow): BillingCycle {
  return tenant.subscriptionPlan?.billingCycle === 'annual' ? 'annual' : 'monthly';
}

function tenantPlanId(tenant: HqTenantRow, packages: HqSubscriptionPackage[]) {
  if (tenant.subscriptionPlan?.id) return tenant.subscriptionPlan.id;
  const match = packages.find(
    (pkg) => pkg.name.toLowerCase() === String(tenant.subscriptionPlan?.name || '').toLowerCase()
  );
  return match?.id || '';
}

function formatTenantPrice(tenant: HqTenantRow, packages: HqSubscriptionPackage[]) {
  const pkg =
    findPackageForPlan(tenant.subscriptionPlan, packages) ||
    packages.find((p) => p.id === tenantPlanId(tenant, packages));
  if (!pkg) return null;
  const cycle = tenantBillingCycle(tenant);
  const { amount, periodLabel } = getDisplayedPrice(getPackagePresentation(pkg), cycle);
  const raw = String(amount || '').trim();
  if (!raw || raw === '—') return null;
  const withDollar = raw.startsWith('$') ? raw : `$${raw}`;
  const shortPeriod = cycle === 'annual' ? '/mo yr' : '/mo';
  return { price: withDollar, period: shortPeriod, periodLabel };
}

export default function HQSetupPageWrapper() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen flex-1 items-center justify-center bg-[#f4f5f7] text-sm text-slate-500">
          Loading HQ console…
        </main>
      }
    >
      <HQSetupPage />
    </Suspense>
  );
}

function HQSetupPage() {
  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab');
  const viewParam = searchParams.get('view');
  const activeTab: HqNavTab =
    tabParam === 'tenants' ||
    tabParam === 'plans' ||
    tabParam === 'bootstrap'
      ? tabParam
      : 'dashboard';
  const analyticsView: HqAnalyticsView =
    viewParam === 'employer' || viewParam === 'platform' ? viewParam : 'employee';

  const activeNav =
    activeTab === 'dashboard' && analyticsView === 'employer'
      ? HQ_NAV_ITEMS.find((item) => item.id === 'employerDashboard')
      : HQ_NAV_ITEMS.find((item) => item.id === activeTab);

  const [bootstrapForm, setBootstrapForm] = useState({ name: '', email: '', userId: '', password: '' });
  const [isBootstrapLoading, setIsBootstrapLoading] = useState(false);

  const [provisionData, setProvisionData] = useState<ProvisionTenantFormData>(emptyProvisionTenantForm());
  const [isProvisionLoading, setIsProvisionLoading] = useState(false);
  const [createTenantModalOpen, setCreateTenantModalOpen] = useState(false);

  const [status, setStatus] = useState<{ type: 'idle' | 'success' | 'error'; message: string }>({
    type: 'idle',
    message: '',
  });

  const [tenants, setTenants] = useState<HqTenantRow[]>([]);
  const [stats, setStats] = useState<HqStats | null>(null);
  const [planOptions, setPlanOptions] = useState<HqSubscriptionPackage[]>(FALLBACK_PLAN_OPTIONS);
  const [tenantsLoading, setTenantsLoading] = useState(false);
  const [tenantsError, setTenantsError] = useState<string>('');
  const [pendingPlanEmail, setPendingPlanEmail] = useState<string>('');
  const [pendingDeleteEmail, setPendingDeleteEmail] = useState<string>('');
  const [pendingPauseEmail, setPendingPauseEmail] = useState<string>('');

  const [analytics, setAnalytics] = useState<HqAnalyticsPayload | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsError, setAnalyticsError] = useState('');

  const refreshTenants = useCallback(async () => {
    setTenantsLoading(true);
    setTenantsError('');
    try {
      const res = await apiHqListTenants();
      const d = res.data;
      setTenants(d?.tenants || []);
      setStats(d?.stats || { total: 0, agency: 0, standalone: 0, planCounts: {} });
      const opts = d?.planOptions && d.planOptions.length > 0 ? d.planOptions : FALLBACK_PLAN_OPTIONS;
      setPlanOptions(subscriptionPackagesWithPricing(opts));
    } catch (err: any) {
      // Tenants list requires a super admin session in the main app — fail soft.
      setTenantsError(err?.message || 'Sign in as super admin in the main app first to load tenants.');
      setTenants([]);
      setStats(null);
    } finally {
      setTenantsLoading(false);
    }
  }, []);

  const refreshAnalytics = useCallback(async (opts?: { silent?: boolean }) => {
    const silent = Boolean(opts?.silent);
    if (!silent) setAnalyticsLoading(true);
    setAnalyticsError('');
    try {
      const res = await apiHqGetAnalytics();
      setAnalytics(res.data || null);
    } catch (err: any) {
      setAnalyticsError(err?.message || 'Failed to load analytics.');
      if (!silent) setAnalytics(null);
    } finally {
      if (!silent) setAnalyticsLoading(false);
    }
  }, []);

  const refreshDashboard = useCallback(async () => {
    await Promise.all([refreshTenants(), refreshAnalytics()]);
  }, [refreshTenants, refreshAnalytics]);

  useEffect(() => {
    void refreshTenants();
  }, [refreshTenants]);

  useEffect(() => {
    if (activeTab !== 'dashboard') return;
    if (analyticsView === 'platform') return;
    void refreshAnalytics();
  }, [activeTab, analyticsView, refreshAnalytics]);

  useEffect(() => {
    if (activeTab !== 'dashboard') return;
    if (analyticsView === 'platform') return;
  const intervalMs = analyticsView === 'employee' || analyticsView === 'employer' ? 15000 : 45000;
    const timer = window.setInterval(() => {
      void refreshAnalytics({ silent: true });
    }, intervalMs);
    return () => window.clearInterval(timer);
  }, [activeTab, analyticsView, refreshAnalytics]);

  const handleBootstrapSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsBootstrapLoading(true);
    setStatus({ type: 'idle', message: '' });
    try {
      const apiUrl = buildApiUrl('/hq/setup');
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bootstrapForm),
      });
      const data = await response.json();
      if (response.ok) {
        setStatus({
          type: 'success',
          message: 'SuperAdmin credentials injected into database successfully!',
        });
        setBootstrapForm({ name: '', email: '', userId: '', password: '' });
      } else {
        setStatus({ type: 'error', message: data.message || 'Injection failed. Check backend logs.' });
      }
    } catch {
      setStatus({ type: 'error', message: 'Backend connection refused. Ensure server is running.' });
    } finally {
      setIsBootstrapLoading(false);
    }
  };

  const handleProvisionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProvisionLoading(true);
    setStatus({ type: 'idle', message: '' });
    try {
      if (provisionData.enabledModules.length === 0) {
        setStatus({ type: 'error', message: 'Select at least one CRM or Recruitment tab.' });
        setIsProvisionLoading(false);
        return;
      }
      if (provisionData.source === 'company' && !provisionData.companyId) {
        setStatus({ type: 'error', message: 'Select an HQ company, or switch to Manual create.' });
        setIsProvisionLoading(false);
        return;
      }
      const maxUsers = provisionData.maxUsers ? Number(provisionData.maxUsers) : null;
      const maxJobs = provisionData.maxJobs ? Number(provisionData.maxJobs) : null;
      const res = await apiHqProvisionTenant({
        name: provisionData.name.trim(),
        email: provisionData.email.trim().toLowerCase(),
        loginId: provisionData.loginId.trim(),
        password: provisionData.password,
        organizationType: provisionData.organizationType,
        productLine: provisionData.productLine,
        enabledModules: provisionData.enabledModules,
        billingCycle: provisionData.billingCycle,
        planStartDate: provisionData.planStartDate || undefined,
        planEndDate: provisionData.planEndDate || undefined,
        companyId:
          provisionData.source === 'company' && provisionData.companyId
            ? provisionData.companyId
            : undefined,
        plan: {
          name: provisionData.planName,
          billingCycle: provisionData.billingCycle,
          planStartDate: provisionData.planStartDate || undefined,
          planEndDate: provisionData.planEndDate || undefined,
          ...(provisionData.customPrice ? { price: provisionData.customPrice } : {}),
          ...(maxUsers ? { maxUsers } : {}),
          ...(maxJobs ? { maxJobs } : {}),
          ...(provisionData.coins ? { coins: Number(provisionData.coins) || 0 } : {}),
        } as any,
      });
      const d = res.data as {
        tenantDbName?: string;
        organizationType?: string;
        subscriptionPlan?: { name?: string } | null;
        credentialEmailSent?: boolean;
        credentialEmailError?: string | null;
      };
      const emailSuffix = d?.credentialEmailSent
        ? ' Credentials emailed to the new admin.'
        : d?.credentialEmailError
          ? ` Credential email failed: ${d.credentialEmailError}`
          : '';
      const fromCompany =
        provisionData.source === 'company' ? ' from HQ company' : ' (manual)';
      setStatus({
        type: 'success',
        message: `Tenant provisioned${fromCompany} (${
          provisionData.productLine === 'recruitment' ? 'Recruitment' : 'CRM'
        }, ${provisionData.enabledModules.length} tabs). DB: ${d?.tenantDbName || '—'} (${
          d?.organizationType || provisionData.organizationType
        }). Assign a plan on Tenants or Billing when ready.${emailSuffix}`,
      });
      setProvisionData(emptyProvisionTenantForm());
      setCreateTenantModalOpen(false);
      void refreshTenants();
    } catch (error: any) {
      setStatus({
        type: 'error',
        message:
          error?.message ||
          'Provisioning failed. Sign in to the tenant app as a super admin and verify HRAYNTRA_PLATFORM_PROVISION_EMAILS if set.',
      });
    } finally {
      setIsProvisionLoading(false);
    }
  };

  const handleAssignPlan = async (
    email: string,
    planId: string,
    billingCycle?: BillingCycle
  ) => {
    if (!email || !planId) return;
    setPendingPlanEmail(email);
    setStatus({ type: 'idle', message: '' });
    try {
      const tenant = tenants.find((item) => item.email === email);
      const cycle = billingCycle ?? (tenant ? tenantBillingCycle(tenant) : 'monthly');
      const pkg = planOptions.find((item) => item.id === planId);
      await apiHqAssignTenantPlan({
        email,
        billingCycle: cycle,
        plan: { id: planId, billingCycle: cycle },
      });
      setStatus({
        type: 'success',
        message: `Plan for ${email} updated to ${pkg ? getPackageOptionLabel(pkg) : 'selected package'} (${formatBillingCycleLabel(cycle)}).`,
      });
      void refreshTenants();
    } catch (err: any) {
      setStatus({ type: 'error', message: err?.message || 'Failed to update plan' });
    } finally {
      setPendingPlanEmail('');
    }
  };

  const handleSetTenantPause = async (email: string, paused: boolean) => {
    if (!email) return;
    setPendingPauseEmail(email);
    setStatus({ type: 'idle', message: '' });
    try {
      await apiHqSetTenantPause({ email, paused });
      setStatus({
        type: 'success',
        message: paused
          ? `Tenant ${email} paused. Users will see a blocking notice in Phase 2.`
          : `Tenant ${email} resumed. Operations can continue.`,
      });
      void refreshTenants();
    } catch (err: any) {
      setStatus({ type: 'error', message: err?.message || 'Failed to update tenant status' });
    } finally {
      setPendingPauseEmail('');
    }
  };

  const handleDeleteTenant = async (email: string, dbName: string) => {
    if (!email) return;

    setPendingDeleteEmail(email);
    setStatus({ type: 'idle', message: '' });
    try {
      const res = await apiHqDeleteTenant({ email, dropDatabase: true });
      const d = res.data;
      setStatus({
        type: 'success',
        message: d?.databaseDropped
          ? `Tenant ${email} deleted and database "${d.tenantDbName || dbName}" dropped.`
          : `Tenant ${email} deleted (database was not dropped — see server logs).`,
      });
      void refreshTenants();
    } catch (err: any) {
      setStatus({ type: 'error', message: err?.message || 'Failed to delete tenant' });
    } finally {
      setPendingDeleteEmail('');
    }
  };

  const planSummaryRows = useMemo(() => {
    const counts = stats?.planCounts || {};
    const known = planOptions.map((opt) => ({
      name: getPackageOptionLabel(opt),
      count:
        counts[opt.name] ||
        counts[getPackageOptionLabel(opt)] ||
        counts[String(opt.slug || '').toLowerCase()] ||
        0,
    }));
    const unassigned = counts['Unassigned'] ?? 0;
    return [...known, { name: 'Unassigned', count: unassigned }];
  }, [stats, planOptions]);

  const isPhase1EmployeeDashboard = activeTab === 'dashboard' && analyticsView === 'employee';
  const isPhase2EmployerDashboard = activeTab === 'dashboard' && analyticsView === 'employer';

  if (isPhase1EmployeeDashboard) {
    return (
      <main className="ph2-main-surface flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        {analyticsLoading && !analytics ? (
          <div className="p-6 sm:p-8">
            <HqAnalyticsLoadingSkeleton />
          </div>
        ) : analyticsError && !analytics ? (
          <div className="p-6 sm:p-8">
            <HqAlert type="error" message={analyticsError} />
          </div>
        ) : (
          <HqPhase1CommandDashboard
            data={analytics?.employee || null}
            generatedAt={analytics?.generatedAt}
            durationMs={analytics?.durationMs}
            loading={analyticsLoading}
            onRefresh={() => void refreshDashboard()}
          />
        )}
      </main>
    );
  }

  if (isPhase2EmployerDashboard) {
    return (
      <main className="ph2-main-surface flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        {analyticsLoading && !analytics ? (
          <div className="p-6 sm:p-8">
            <HqAnalyticsLoadingSkeleton />
          </div>
        ) : analyticsError && !analytics ? (
          <div className="p-6 sm:p-8">
            <HqAlert type="error" message={analyticsError} />
          </div>
        ) : (
          <HqPhase2CommandDashboard
            data={analytics?.employer || null}
            generatedAt={analytics?.generatedAt}
            durationMs={analytics?.durationMs}
            loading={analyticsLoading}
            onRefresh={() => void refreshDashboard()}
          />
        )}
      </main>
    );
  }

  return (
    <HqPageMain>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
      >
        <HqPageContainer>
          {activeTab !== 'plans' ? (
            <HqPageHeader
              title={
                activeTab === 'dashboard'
                  ? 'Platform overview'
                  : activeNav?.label || 'Dashboard'
              }
              subtitle={
                activeTab === 'dashboard'
                  ? VIEW_DESCRIPTIONS[analyticsView]
                  : TAB_DESCRIPTIONS[activeTab]
              }
              actions={
                <HqSecondaryButton
                  onClick={() =>
                    void (activeTab === 'dashboard' && analyticsView !== 'platform'
                      ? refreshDashboard()
                      : refreshTenants())
                  }
                  disabled={
                    tenantsLoading ||
                    (activeTab === 'dashboard' && analyticsView !== 'platform' && analyticsLoading)
                  }
                >
                  <RefreshCcw
                    className={`h-4 w-4 ${
                      tenantsLoading || analyticsLoading ? 'animate-spin' : ''
                    }`}
                  />
                  Refresh data
                </HqSecondaryButton>
              }
            />
          ) : null}

        {activeTab === 'dashboard' && (
          <>
            <HqAnalyticsViewTabs active={analyticsView} />
            {analyticsView === 'platform' ? (
              <DashboardPanel
                stats={stats}
                tenants={tenants}
                planSummaryRows={planSummaryRows}
                planOptions={planOptions}
                tenantsError={tenantsError}
                tenantsLoading={tenantsLoading}
              />
            ) : analyticsLoading && !analytics ? (
              <HqAnalyticsLoadingSkeleton />
            ) : analyticsError && !analytics ? (
              <HqAlert type="error" message={analyticsError} />
            ) : (
              <HqAlert type="error" message="Unknown dashboard view." />
            )}
          </>
        )}

        {activeTab === 'tenants' && (
          <>
            <TenantsPanel
              tenants={tenants}
              tenantStats={stats}
              tenantsLoading={tenantsLoading}
              tenantsError={tenantsError}
              planOptions={planOptions}
              onAssignPlan={handleAssignPlan}
              pendingPlanEmail={pendingPlanEmail}
              onDeleteTenant={handleDeleteTenant}
              pendingDeleteEmail={pendingDeleteEmail}
              onSetTenantPause={handleSetTenantPause}
              pendingPauseEmail={pendingPauseEmail}
              onCreateTenant={() => {
                setProvisionData(emptyProvisionTenantForm());
                setCreateTenantModalOpen(true);
              }}
              onCoinsUpdated={() => void refreshTenants()}
            />
            <CreateTenantModal
              open={createTenantModalOpen}
              onClose={() => setCreateTenantModalOpen(false)}
              data={provisionData}
              onChange={setProvisionData}
              onSubmit={handleProvisionSubmit}
              isLoading={isProvisionLoading}
            />
          </>
        )}

        {activeTab === 'plans' && (
          <HqPackagesPanel
            packages={planOptions}
            planSummaryRows={planSummaryRows}
            tenants={tenants}
            onAssignPlan={handleAssignPlan}
            pendingPlanEmail={pendingPlanEmail}
            onPackagesChanged={refreshTenants}
            onRefresh={() => void refreshTenants()}
            refreshing={tenantsLoading}
          />
        )}

        {activeTab === 'bootstrap' && (
          <BootstrapPanel
            data={bootstrapForm}
            onChange={setBootstrapForm}
            onSubmit={handleBootstrapSubmit}
            isLoading={isBootstrapLoading}
          />
        )}

        <AnimatePresence mode="wait">
          {status.type !== 'idle' && (
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
              <HqAlert type={status.type === 'success' ? 'success' : 'error'} message={status.message} />
            </motion.div>
          )}
        </AnimatePresence>
        </HqPageContainer>
      </motion.div>
    </HqPageMain>
  );
}

function DashboardPanel({
  stats,
  tenants,
  planSummaryRows,
  planOptions,
  tenantsError,
  tenantsLoading,
}: {
  stats: HqStats | null;
  tenants: HqTenantRow[];
  planSummaryRows: { name: string; count: number }[];
  planOptions: HqSubscriptionPackage[];
  tenantsError: string;
  tenantsLoading: boolean;
}) {
  const recent = tenants.slice(0, 5);
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        <HqStatCard label="Tenants" value={stats?.total ?? (tenantsLoading ? '…' : 0)} active />
        <HqStatCard label="Landing purchases" value={stats?.landingPurchases ?? tenants.filter((t) => t.signupSource === 'landing_purchase').length} />
        <HqStatCard label="Agency" value={stats?.agency ?? 0} />
        <HqStatCard label="Standalone" value={stats?.standalone ?? 0} />
        <HqStatCard label="On a plan" value={tenants.filter((t) => t.subscriptionPlan?.name).length} />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <HqPanel>
          <HqPanelTitle title="Plan distribution" meta={<span className="text-[10px] text-slate-400">Live</span>} />
          <div className="space-y-2">
            {planSummaryRows.map((row) => (
              <div
                key={row.name}
                className="flex items-center justify-between border-b border-slate-100 py-2 text-sm last:border-b-0"
              >
                <span className="text-slate-600">{row.name}</span>
                <span className="font-bold text-slate-900">{row.count}</span>
              </div>
            ))}
          </div>
        </HqPanel>
        <HqPanel>
          <HqPanelTitle title="Recent tenants" />
          {tenantsError ? (
            <p className="text-xs text-rose-600">{tenantsError}</p>
          ) : recent.length === 0 ? (
            <p className="text-xs text-slate-500">{tenantsLoading ? 'Loading…' : 'No tenants provisioned yet.'}</p>
          ) : (
            <div className="space-y-2">
              {recent.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between border-b border-slate-100 py-2 text-sm last:border-b-0"
                >
                  <div className="min-w-0">
                    <div className="truncate font-semibold text-slate-900">{t.name}</div>
                    <div className="truncate text-xs text-slate-500">{t.email}</div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-sky-700">{t.organizationType}</div>
                    {t.productLine ? (
                      <div className="text-[10px] font-semibold uppercase tracking-wide text-indigo-600">
                        {t.productLine === 'recruitment' ? 'Recruitment' : 'CRM'}
                      </div>
                    ) : null}
                    <div className="text-xs text-slate-500">{getPlanLabel(t.subscriptionPlan, planOptions) || '—'}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </HqPanel>
      </div>
    </div>
  );
}

function formatPlanLimits(plan: HqTenantRow['subscriptionPlan']) {
  if (!plan) return '—';
  const users = plan.maxUsers == null ? '∞ users' : `${plan.maxUsers} users`;
  const jobs = plan.maxJobs == null ? '∞ jobs' : `${plan.maxJobs} jobs`;
  return `${users} · ${jobs}`;
}

function isTenantPaused(tenant: HqTenantRow) {
  return String(tenant.status || 'ACTIVE').toUpperCase() === 'PAUSED';
}

function tenantSignupSourceLabel(source?: string) {
  if (source === 'landing_purchase') return 'Landing purchase';
  if (source === 'landing_trial') return 'Landing trial';
  if (source === 'hq_company') return 'From company';
  if (source === 'hq_manual') return 'HQ created';
  return 'Platform tenant';
}

function tenantSignupSourceClass(source?: string) {
  if (source === 'landing_purchase') return 'bg-violet-50 text-violet-700 ring-violet-100';
  if (source === 'landing_trial') return 'bg-orange-50 text-orange-700 ring-orange-100';
  if (source === 'hq_company') return 'bg-emerald-50 text-emerald-700 ring-emerald-100';
  if (source === 'hq_manual') return 'bg-slate-100 text-slate-600 ring-slate-200';
  return 'bg-sky-50 text-sky-700 ring-sky-100';
}

function TenantsPanel({
  tenants,
  tenantStats,
  tenantsLoading,
  tenantsError,
  planOptions,
  onAssignPlan,
  pendingPlanEmail,
  onDeleteTenant,
  pendingDeleteEmail,
  onSetTenantPause,
  pendingPauseEmail,
  onCreateTenant,
  onCoinsUpdated,
}: {
  tenants: HqTenantRow[];
  tenantStats: HqStats | null;
  tenantsLoading: boolean;
  tenantsError: string;
  planOptions: HqSubscriptionPackage[];
  onAssignPlan: (email: string, planId: string, billingCycle?: BillingCycle) => void;
  pendingPlanEmail: string;
  onDeleteTenant: (email: string, dbName: string) => void;
  pendingDeleteEmail: string;
  onSetTenantPause: (email: string, paused: boolean) => void;
  pendingPauseEmail: string;
  onCreateTenant: () => void;
  onCoinsUpdated: () => void;
}) {
  const landingPurchases = tenantStats?.landingPurchases ?? tenants.filter((t) => t.signupSource === 'landing_purchase').length;
  const landingTrials = tenantStats?.landingTrials ?? tenants.filter((t) => t.signupSource === 'landing_trial').length;
  const [detailTenant, setDetailTenant] = useState<HqTenantRow | null>(null);
  const [deleteTenant, setDeleteTenant] = useState<DeleteTenantTarget | null>(null);

  const openDetail = (tenant: HqTenantRow) => {
    setDetailTenant(tenant);
  };

  // Keep detail drawer in sync after list refresh (plan/coins/tabs/pause).
  const detailEmail = detailTenant?.email;
  useEffect(() => {
    if (!detailEmail) return;
    const next = tenants.find((t) => t.email === detailEmail);
    if (next) setDetailTenant(next);
  }, [tenants, detailEmail]);

  return (
    <HqPanel className="!p-0 overflow-hidden">
      <HqTenantDetailDrawer
        open={Boolean(detailTenant)}
        tenant={detailTenant}
        planOptions={planOptions}
        pendingPlanEmail={pendingPlanEmail}
        pendingPauseEmail={pendingPauseEmail}
        onClose={() => setDetailTenant(null)}
        onSaved={onCoinsUpdated}
        onAssignPlan={onAssignPlan}
        onSetTenantPause={onSetTenantPause}
      />
      <DeleteTenantConfirmModal
        open={Boolean(deleteTenant)}
        tenant={deleteTenant}
        deleting={Boolean(deleteTenant && pendingDeleteEmail === deleteTenant.email)}
        onClose={() => {
          if (pendingDeleteEmail) return;
          setDeleteTenant(null);
        }}
        onConfirm={() => {
          if (!deleteTenant) return;
          void (async () => {
            await onDeleteTenant(deleteTenant.email, deleteTenant.dbName);
            setDeleteTenant(null);
            if (detailTenant?.email === deleteTenant.email) setDetailTenant(null);
          })();
        }}
      />
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-gradient-to-b from-white to-slate-50/80 px-5 py-4">
        <HqPanelTitle
          title="Tenants"
          meta={
            <span className="text-[10px] font-medium text-slate-400">
              {tenants.length} total · {landingPurchases} landing purchases · {landingTrials} landing trials
            </span>
          }
        />
        <HqPrimaryButton type="button" onClick={onCreateTenant}>
          <Plus className="h-4 w-4" />
          Create tenant
        </HqPrimaryButton>
      </div>
      {tenantsError ? (
        <div className="m-5 rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-700">{tenantsError}</div>
      ) : tenants.length === 0 ? (
        <div className="px-5 pb-5 text-xs text-slate-500">{tenantsLoading ? 'Loading…' : 'No tenants yet.'}</div>
      ) : (
        <div className="hq-table-scroll px-1 pb-2">
          <table className="min-w-full text-left">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Source</th>
                <th>Type</th>
                <th>Product</th>
                <th>DB</th>
                <th>Plan</th>
                <th>Price</th>
                <th>AI coins</th>
                <th>Limits</th>
                <th>Billing</th>
                <th>Start</th>
                <th>End</th>
                <th>Status</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {tenants.map((t) => (
                <tr
                  key={t.id}
                  className="border-b border-slate-100 last:border-b-0 transition-colors hover:bg-slate-50/60 cursor-pointer"
                  onClick={() => openDetail(t)}
                  title="Open tenant details"
                >
                  <td className="py-3 pr-3">
                    <p className="font-semibold text-slate-900">{t.name}</p>
                    {t.organizationName ? (
                      <p className="text-[10px] text-slate-500">{t.organizationName}</p>
                    ) : null}
                  </td>
                  <td className="py-3 pr-3 text-slate-600">{t.email}</td>
                  <td className="py-3 pr-3">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ${tenantSignupSourceClass(t.signupSource)}`}
                    >
                      {tenantSignupSourceLabel(t.signupSource)}
                    </span>
                    {t.isLandingSignupOnly ? (
                      <p className="mt-1 text-[10px] font-medium text-amber-600">Provisioned — sync pending</p>
                    ) : null}
                  </td>
                  <td className="py-3 pr-3 font-semibold text-sky-700">{t.organizationType}</td>
                  <td className="py-3 pr-3">
                    {t.productLine ? (
                      <div className="space-y-0.5">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ${
                            t.productLine === 'recruitment'
                              ? 'bg-amber-50 text-amber-800 ring-amber-100'
                              : 'bg-sky-50 text-sky-800 ring-sky-100'
                          }`}
                        >
                          {t.productLine === 'recruitment' ? 'Recruitment' : 'CRM'}
                        </span>
                        {Array.isArray(t.enabledModules) && t.enabledModules.length > 0 ? (
                          <p className="text-[10px] text-slate-500">{t.enabledModules.length} tabs</p>
                        ) : t.modulesRestricted ? (
                          <p className="text-[10px] text-amber-600">0 tabs</p>
                        ) : (
                          <p className="text-[10px] text-slate-400">All tabs</p>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </td>
                  <td className="py-3 pr-3 font-mono text-xs text-slate-500">{t.tenantDbName || '—'}</td>
                  <td className="py-3 pr-3 text-xs font-medium text-slate-700">
                    {getPlanLabel(t.subscriptionPlan, planOptions) || '—'}
                  </td>
                  <td className="py-3 pr-3">
                    {(() => {
                      const priced = formatTenantPrice(t, planOptions);
                      if (!priced) {
                        return <span className="text-xs text-slate-400">—</span>;
                      }
                      return (
                        <div className="leading-tight">
                          <p className="text-sm font-semibold text-emerald-700">{priced.price}</p>
                          <p className="text-[10px] text-slate-500">{priced.period}</p>
                        </div>
                      );
                    })()}
                  </td>
                  <td className="py-3 pr-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                        Number(t.subscriptionPlan?.coins ?? 0) > 0
                          ? 'bg-amber-50 text-amber-800'
                          : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {Number(t.subscriptionPlan?.coins ?? 0)}
                    </span>
                  </td>
                  <td className="py-3 pr-3 text-xs font-medium text-slate-600">{formatPlanLimits(t.subscriptionPlan)}</td>
                  <td className="py-3 pr-3 text-xs text-slate-600">
                    {tenantPlanId(t, planOptions)
                      ? formatBillingCycleLabel(tenantBillingCycle(t))
                      : '—'}
                  </td>
                  <td className="py-3 pr-3 text-xs text-slate-600">
                    {formatDateDMY(t.subscriptionPlan?.planStartDate) || '—'}
                  </td>
                  <td className="py-3 pr-3 text-xs text-slate-600">
                    {formatDateDMY(t.subscriptionPlan?.planEndDate) || '—'}
                  </td>
                  <td className="py-3 pr-3">
                    {isTenantPaused(t) ? (
                      <span className="inline-flex rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700 ring-1 ring-amber-100">
                        Paused
                      </span>
                    ) : (
                      <span className="inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700 ring-1 ring-emerald-100">
                        Running
                      </span>
                    )}
                  </td>
                  <td className="py-3 pl-3 text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="inline-flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => openDetail(t)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-sky-200 bg-sky-50 text-sky-700 transition hover:bg-sky-100"
                        title="View details"
                        aria-label={`View ${t.name || t.email}`}
                      >
                        <Eye size={15} strokeWidth={2.25} />
                      </button>
                      {t.isLandingSignupOnly ? null : (
                        <button
                          type="button"
                          onClick={() =>
                            setDeleteTenant({
                              email: t.email,
                              dbName: t.tenantDbName,
                              name: t.name,
                            })
                          }
                          disabled={pendingDeleteEmail === t.email}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-rose-200 bg-rose-50 text-rose-700 transition hover:bg-rose-100 disabled:opacity-50"
                          title="Delete tenant"
                          aria-label={`Delete ${t.name || t.email}`}
                        >
                          <Trash2 size={15} strokeWidth={2.25} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </HqPanel>
  );
}

function BootstrapPanel({
  data,
  onChange,
  onSubmit,
  isLoading,
}: {
  data: { name: string; email: string; userId: string; password: string };
  onChange: (next: { name: string; email: string; userId: string; password: string }) => void;
  onSubmit: (e: React.FormEvent) => void;
  isLoading: boolean;
}) {
  return (
    <form onSubmit={onSubmit} className="max-w-2xl space-y-5">
      <HqPanel>
      <p className="text-sm leading-relaxed text-slate-500">
        Unsecured local bootstrap — injects Super Admin credentials directly into the tenant database. Use only on a
        fresh local environment.
      </p>
      <div className="mt-5 space-y-5">
      <HqFieldText
        label="Full Name"
        icon={User}
        value={data.name}
        onChange={(v) => onChange({ ...data, name: v })}
        placeholder="e.g. Master Administrator"
      />
      <HqFieldText
        label="Email Address"
        icon={Mail}
        type="email"
        value={data.email}
        onChange={(v) => onChange({ ...data, email: v })}
        placeholder="admin@hryantra.com"
      />
      <HqFieldText
        label="User ID / Login ID"
        icon={Hash}
        value={data.userId}
        onChange={(v) => onChange({ ...data, userId: v })}
        placeholder="superuser_hq"
      />
      <HqFieldText
        label="System Password"
        icon={Lock}
        type="password"
        value={data.password}
        onChange={(v) => onChange({ ...data, password: v })}
      />
      <HqPrimaryButton type="submit" disabled={isLoading} loading={isLoading} className="w-full">
        Inject Credentials
        <ArrowRight className="h-4 w-4" />
      </HqPrimaryButton>
      </div>
      </HqPanel>
    </form>
  );
}
