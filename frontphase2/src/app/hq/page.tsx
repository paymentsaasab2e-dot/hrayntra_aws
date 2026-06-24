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
} from 'lucide-react';
import {
  buildApiUrl,
  apiHqProvisionTenant,
  apiHqListTenants,
  apiHqAssignTenantPlan,
  apiHqDeleteTenant,
  type HqTenantRow,
  type HqSubscriptionPackage,
} from '../../lib/api';
import { HqPackagesPanel } from '../../components/hq/HqPackagesPanel';
import { CreateTenantModal, ProvisionTenantFormFields } from '../../components/hq/CreateTenantModal';
import { getPackageOptionLabel, getPlanLabel, formatBillingCycleLabel, type BillingCycle } from '../../components/hq/hqPackagePresentation';
import type { HqNavTab } from '../../components/hq/HqSidebar';
import { HQ_NAV_ITEMS } from '../../components/hq/HqSidebar';
import {
  HQ_SELECT_CLASS,
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

interface HqStats {
  total: number;
  agency: number;
  standalone: number;
  planCounts: Record<string, number>;
}

const TAB_DESCRIPTIONS: Record<HqNavTab, string> = {
  dashboard: 'Platform health, tenant counts, and plan distribution.',
  tenants: 'Browse and manage all provisioned tenants.',
  provision: 'Create a new tenant workspace and database.',
  plans: '',
  bootstrap: 'Local-only super admin credential injection.',
};

const FALLBACK_PLAN_OPTIONS: HqSubscriptionPackage[] = [
  {
    id: 'starter',
    slug: 'starter',
    name: 'Starter',
    displayName: 'STARTER',
    description: 'For small teams hiring their first roles on SAASA B2E.',
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
  const activeTab: HqNavTab =
    tabParam === 'tenants' ||
    tabParam === 'provision' ||
    tabParam === 'plans' ||
    tabParam === 'bootstrap'
      ? tabParam
      : 'dashboard';

  const activeNav = HQ_NAV_ITEMS.find((item) => item.id === activeTab);

  const [bootstrapForm, setBootstrapForm] = useState({ name: '', email: '', userId: '', password: '' });
  const [isBootstrapLoading, setIsBootstrapLoading] = useState(false);

  const [provisionData, setProvisionData] = useState({
    name: '',
    email: '',
    loginId: '',
    password: '',
    organizationType: 'agency' as 'agency' | 'standalone',
    plan: 'starter',
    billingCycle: 'monthly' as BillingCycle,
  });
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

  const refreshTenants = useCallback(async () => {
    setTenantsLoading(true);
    setTenantsError('');
    try {
      const res = await apiHqListTenants();
      const d = res.data;
      setTenants(d?.tenants || []);
      setStats(d?.stats || { total: 0, agency: 0, standalone: 0, planCounts: {} });
      const opts = d?.planOptions && d.planOptions.length > 0 ? d.planOptions : FALLBACK_PLAN_OPTIONS;
      setPlanOptions(opts);
    } catch (err: any) {
      // Tenants list requires a super admin session in the main app — fail soft.
      setTenantsError(err?.message || 'Sign in as super admin in the main app first to load tenants.');
      setTenants([]);
      setStats(null);
    } finally {
      setTenantsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshTenants();
  }, [refreshTenants]);

  useEffect(() => {
    if (planOptions.length === 0) return;
    setProvisionData((prev) => {
      if (planOptions.some((pkg) => pkg.id === prev.plan)) return prev;
      const starter =
        planOptions.find((pkg) => pkg.slug === 'starter') ||
        planOptions.find((pkg) => getPackageOptionLabel(pkg) === 'STARTER') ||
        planOptions[0];
      return starter ? { ...prev, plan: starter.id } : prev;
    });
  }, [planOptions]);

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
      const res = await apiHqProvisionTenant({
        name: provisionData.name.trim(),
        email: provisionData.email.trim().toLowerCase(),
        loginId: provisionData.loginId.trim(),
        password: provisionData.password,
        organizationType: provisionData.organizationType,
        billingCycle: provisionData.billingCycle,
        plan: provisionData.plan
          ? { id: provisionData.plan, billingCycle: provisionData.billingCycle }
          : undefined,
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
      setStatus({
        type: 'success',
        message: `Tenant provisioned. DB: ${d?.tenantDbName || '—'} (${
          d?.organizationType || provisionData.organizationType
        }) — plan: ${getPlanLabel(d?.subscriptionPlan, planOptions) || provisionData.plan || 'Unassigned'}.${emailSuffix}`,
      });
      setProvisionData({
        name: '',
        email: '',
        loginId: '',
        password: '',
        organizationType: 'agency',
        plan: 'starter',
        billingCycle: 'monthly',
      });
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

  const handleDeleteTenant = async (email: string, dbName: string) => {
    if (!email) return;
    // Use a native confirm so this stays consistent with existing destructive
    // flows in the HQ shell (it has no toast/modal infra of its own).
    const proceed = window.confirm(
      `Delete tenant ${email}?\n\nThis will:\n  • Remove the HQ workspace user record\n  • Drop the tenant database "${dbName || '(unknown)'}"\n  • Clear the directory mapping\n\nThis action cannot be undone.`
    );
    if (!proceed) return;

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
              title={activeNav?.label || 'Dashboard'}
              subtitle={TAB_DESCRIPTIONS[activeTab]}
              actions={
                <HqSecondaryButton onClick={() => void refreshTenants()} disabled={tenantsLoading}>
                  <RefreshCcw className={`h-4 w-4 ${tenantsLoading ? 'animate-spin' : ''}`} />
                  Refresh data
                </HqSecondaryButton>
              }
            />
          ) : null}

        {activeTab === 'dashboard' && (
          <DashboardPanel
            stats={stats}
            tenants={tenants}
            planSummaryRows={planSummaryRows}
            planOptions={planOptions}
            tenantsError={tenantsError}
            tenantsLoading={tenantsLoading}
          />
        )}

        {activeTab === 'tenants' && (
          <>
            <TenantsPanel
              tenants={tenants}
              tenantsLoading={tenantsLoading}
              tenantsError={tenantsError}
              planOptions={planOptions}
              onAssignPlan={handleAssignPlan}
              pendingPlanEmail={pendingPlanEmail}
              onDeleteTenant={handleDeleteTenant}
              pendingDeleteEmail={pendingDeleteEmail}
              onCreateTenant={() => setCreateTenantModalOpen(true)}
            />
            <CreateTenantModal
              open={createTenantModalOpen}
              onClose={() => setCreateTenantModalOpen(false)}
              data={provisionData}
              onChange={setProvisionData}
              onSubmit={handleProvisionSubmit}
              isLoading={isProvisionLoading}
              planOptions={planOptions}
            />
          </>
        )}

        {activeTab === 'provision' && (
          <ProvisionPanel
            data={provisionData}
            onChange={setProvisionData}
            onSubmit={handleProvisionSubmit}
            isLoading={isProvisionLoading}
            planOptions={planOptions}
          />
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
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <HqStatCard label="Tenants" value={stats?.total ?? (tenantsLoading ? '…' : 0)} active />
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

function TenantsPanel({
  tenants,
  tenantsLoading,
  tenantsError,
  planOptions,
  onAssignPlan,
  pendingPlanEmail,
  onDeleteTenant,
  pendingDeleteEmail,
  onCreateTenant,
}: {
  tenants: HqTenantRow[];
  tenantsLoading: boolean;
  tenantsError: string;
  planOptions: HqSubscriptionPackage[];
  onAssignPlan: (email: string, planId: string, billingCycle?: BillingCycle) => void;
  pendingPlanEmail: string;
  onDeleteTenant: (email: string, dbName: string) => void;
  pendingDeleteEmail: string;
  onCreateTenant: () => void;
}) {
  return (
    <HqPanel className="p-0">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <HqPanelTitle title="All tenants" meta={<span className="text-[10px] text-slate-400">{tenants.length} total</span>} />
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
        <div className="overflow-x-auto px-5 pb-5">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400">
                <th className="py-2 pr-3">Name</th>
                <th className="py-2 pr-3">Email</th>
                <th className="py-2 pr-3">Type</th>
                <th className="py-2 pr-3">DB</th>
                <th className="py-2 pr-3">Plan</th>
                <th className="py-2 pr-3">Billing</th>
                <th className="py-2 pl-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {tenants.map((t) => (
                <tr key={t.id} className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50/60">
                  <td className="py-3 pr-3 font-semibold text-slate-900">{t.name}</td>
                  <td className="py-3 pr-3 text-slate-600">{t.email}</td>
                  <td className="py-3 pr-3 font-semibold text-sky-700">{t.organizationType}</td>
                  <td className="py-3 pr-3 font-mono text-xs text-slate-500">{t.tenantDbName || '—'}</td>
                  <td className="py-3 pr-3">
                    <select
                      value={tenantPlanId(t, planOptions)}
                      onChange={(e) => onAssignPlan(t.email, e.target.value, tenantBillingCycle(t))}
                      disabled={pendingPlanEmail === t.email}
                      className={HQ_SELECT_CLASS}
                    >
                      <option value="">—</option>
                      {planOptions.map((opt) => (
                        <option key={opt.id} value={opt.id}>
                          {getPackageOptionLabel(opt)}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="py-3 pr-3">
                    <select
                      value={tenantBillingCycle(t)}
                      onChange={(e) => {
                        const planId = tenantPlanId(t, planOptions);
                        if (!planId) return;
                        onAssignPlan(t.email, planId, e.target.value as BillingCycle);
                      }}
                      disabled={pendingPlanEmail === t.email || !tenantPlanId(t, planOptions)}
                      className={HQ_SELECT_CLASS}
                    >
                      <option value="monthly">Monthly</option>
                      <option value="annual">Annual</option>
                    </select>
                  </td>
                  <td className="py-3 pl-3 text-right">
                    <button
                      type="button"
                      onClick={() => onDeleteTenant(t.email, t.tenantDbName)}
                      disabled={pendingDeleteEmail === t.email}
                      className="rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-rose-700 transition hover:bg-rose-100 disabled:opacity-50"
                      title="Permanently delete this tenant and drop its database"
                    >
                      {pendingDeleteEmail === t.email ? 'Deleting…' : 'Delete'}
                    </button>
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

function ProvisionPanel({
  data,
  onChange,
  onSubmit,
  isLoading,
  planOptions,
}: {
  data: {
    name: string;
    email: string;
    loginId: string;
    password: string;
    organizationType: 'agency' | 'standalone';
    plan: string;
    billingCycle: BillingCycle;
  };
  onChange: (
    next: {
      name: string;
      email: string;
      loginId: string;
      password: string;
      organizationType: 'agency' | 'standalone';
      plan: string;
      billingCycle: BillingCycle;
    }
  ) => void;
  onSubmit: (e: React.FormEvent) => void;
  isLoading: boolean;
  planOptions: HqSubscriptionPackage[];
}) {
  return (
    <form onSubmit={onSubmit} className="max-w-2xl space-y-5">
      <HqPanel>
      <p className="text-sm leading-relaxed text-slate-500">
        Sign in to the main tenant app first so your access token is stored; this calls{' '}
        <code className="rounded bg-slate-100 px-1 py-0.5 text-xs text-sky-800">POST /api/v1/hq/provision-tenant</code>.
        Provisioning creates a workspace record + dedicated tenant DB, seeds the chosen plan, and{' '}
        <span className="font-semibold text-emerald-700">emails the new admin their login credentials automatically</span>.
      </p>

      <div className="mt-5 space-y-5">
      <ProvisionTenantFormFields
        data={data}
        onChange={onChange}
        planOptions={planOptions}
        orgTypeName="provisionOrgType"
      />

      <HqPrimaryButton type="submit" disabled={isLoading} loading={isLoading} className="w-full">
        Provision tenant
        <ArrowRight className="h-4 w-4" />
      </HqPrimaryButton>
      </div>
      </HqPanel>
    </form>
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
