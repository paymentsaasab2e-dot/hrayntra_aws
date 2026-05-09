"use client";

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Shield,
  Mail,
  User,
  Lock,
  ArrowRight,
  Loader2,
  CheckCircle,
  AlertCircle,
  Hash,
  Database,
  Terminal,
  Server,
  Building2,
  LayoutDashboard,
  Users,
  Tag,
  RefreshCcw,
} from 'lucide-react';
import {
  buildApiUrl,
  apiHqProvisionTenant,
  apiHqListTenants,
  apiHqAssignTenantPlan,
  apiHqDeleteTenant,
  type HqTenantRow,
  type SubscriptionPlanOption,
} from '../../lib/api';

type HqTab = 'dashboard' | 'tenants' | 'provision' | 'plans' | 'bootstrap';

interface HqStats {
  total: number;
  agency: number;
  standalone: number;
  planCounts: Record<string, number>;
}

const TAB_CONFIG: { id: HqTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'tenants', label: 'Tenants', icon: Users },
  { id: 'provision', label: 'Create tenant', icon: Building2 },
  { id: 'plans', label: 'Plans', icon: Tag },
  { id: 'bootstrap', label: 'Local bootstrap', icon: Terminal },
];

const FALLBACK_PLAN_OPTIONS: SubscriptionPlanOption[] = [
  { id: 'basic', name: 'Basic' },
  { id: 'pro', name: 'Pro' },
  { id: 'enterprise', name: 'Enterprise' },
];

const HQSetupPage = () => {
  const [activeTab, setActiveTab] = useState<HqTab>('dashboard');

  const [bootstrapForm, setBootstrapForm] = useState({ name: '', email: '', userId: '', password: '' });
  const [isBootstrapLoading, setIsBootstrapLoading] = useState(false);

  const [provisionData, setProvisionData] = useState({
    name: '',
    email: '',
    loginId: '',
    password: '',
    organizationType: 'agency' as 'agency' | 'standalone',
    plan: 'Basic',
  });
  const [isProvisionLoading, setIsProvisionLoading] = useState(false);

  const [status, setStatus] = useState<{ type: 'idle' | 'success' | 'error'; message: string }>({
    type: 'idle',
    message: '',
  });

  const [tenants, setTenants] = useState<HqTenantRow[]>([]);
  const [stats, setStats] = useState<HqStats | null>(null);
  const [planOptions, setPlanOptions] = useState<SubscriptionPlanOption[]>(FALLBACK_PLAN_OPTIONS);
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
        plan: provisionData.plan ? { name: provisionData.plan } : undefined,
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
        }) — plan: ${d?.subscriptionPlan?.name || provisionData.plan || 'Unassigned'}.${emailSuffix}`,
      });
      setProvisionData({
        name: '',
        email: '',
        loginId: '',
        password: '',
        organizationType: 'agency',
        plan: 'Basic',
      });
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

  const handleAssignPlan = async (email: string, planName: string) => {
    if (!email || !planName) return;
    setPendingPlanEmail(email);
    setStatus({ type: 'idle', message: '' });
    try {
      await apiHqAssignTenantPlan({ email, plan: { name: planName } });
      setStatus({ type: 'success', message: `Plan for ${email} updated to ${planName}.` });
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
      name: opt.name,
      count: counts[opt.name] || 0,
    }));
    const unassigned = counts['Unassigned'] ?? 0;
    return [...known, { name: 'Unassigned', count: unassigned }];
  }, [stats, planOptions]);

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white p-6 font-sans relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none overflow-hidden">
        <div className="absolute -top-1/4 -right-1/4 w-[600px] h-[600px] bg-sky-500/10 blur-[120px] rounded-full" />
        <div className="absolute -bottom-1/4 -left-1/4 w-[600px] h-[600px] bg-indigo-500/10 blur-[120px] rounded-full" />
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '40px 40px' }}
        />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="relative z-10 max-w-6xl mx-auto"
      >
        <div className="flex flex-wrap items-center gap-4 mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-sky-500 to-indigo-600 shadow-[0_0_30px_-5px_rgba(14,165,233,0.4)]">
            <Shield className="w-7 h-7 text-white" />
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl md:text-3xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white to-slate-400">
              Headquarters Console
            </h1>
            <p className="text-slate-500 text-sm font-medium">
              Provision tenants, assign plans, and watch platform health.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void refreshTenants()}
            className="ml-auto inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-slate-300 transition-colors"
            disabled={tenantsLoading}
          >
            <RefreshCcw className={`w-3.5 h-3.5 ${tenantsLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        <div className="flex flex-wrap gap-1 p-1 rounded-2xl bg-[#1c1c1f] border border-white/5 mb-6">
          {TAB_CONFIG.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setActiveTab(tab.id);
                  setStatus({ type: 'idle', message: '' });
                }}
                className={`flex-1 min-w-[140px] inline-flex items-center justify-center gap-2 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-wider transition-colors ${
                  active ? 'bg-gradient-to-r from-sky-600 to-indigo-600 text-white shadow' : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {activeTab === 'dashboard' && (
          <DashboardPanel
            stats={stats}
            tenants={tenants}
            planSummaryRows={planSummaryRows}
            tenantsError={tenantsError}
            tenantsLoading={tenantsLoading}
          />
        )}

        {activeTab === 'tenants' && (
          <TenantsPanel
            tenants={tenants}
            tenantsLoading={tenantsLoading}
            tenantsError={tenantsError}
            planOptions={planOptions}
            onAssignPlan={handleAssignPlan}
            pendingPlanEmail={pendingPlanEmail}
            onDeleteTenant={handleDeleteTenant}
            pendingDeleteEmail={pendingDeleteEmail}
          />
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
          <PlansPanel
            planOptions={planOptions}
            planSummaryRows={planSummaryRows}
            tenants={tenants}
            onAssignPlan={handleAssignPlan}
            pendingPlanEmail={pendingPlanEmail}
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
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className={`mt-6 flex items-start gap-3 p-4 rounded-2xl text-[13px] font-semibold leading-relaxed ${
                status.type === 'success'
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                  : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
              }`}
            >
              {status.type === 'success' ? (
                <CheckCircle className="w-5 h-5 shrink-0" />
              ) : (
                <AlertCircle className="w-5 h-5 shrink-0" />
              )}
              <span>{status.message}</span>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-6 text-[11px] font-black uppercase tracking-[0.2em] text-slate-700">
          <div className="flex items-center gap-2">
            <Server className="w-3 h-3" />
            <span>Auth Service v2.4</span>
          </div>
          <div className="flex items-center gap-2">
            <Database className="w-3 h-3" />
            <span>MongoDB Atlas</span>
          </div>
          <div className="flex items-center gap-2">
            <Terminal className="w-3 h-3" />
            <span>CLI Access Enabled</span>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default HQSetupPage;

function StatCard({ label, value, accent }: { label: string; value: string | number; accent?: string }) {
  return (
    <div className={`rounded-2xl p-5 bg-[#121214] border border-white/5 ${accent || ''}`}>
      <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">{label}</div>
      <div className="text-3xl font-black mt-2 text-white">{value}</div>
    </div>
  );
}

function DashboardPanel({
  stats,
  tenants,
  planSummaryRows,
  tenantsError,
  tenantsLoading,
}: {
  stats: HqStats | null;
  tenants: HqTenantRow[];
  planSummaryRows: { name: string; count: number }[];
  tenantsError: string;
  tenantsLoading: boolean;
}) {
  const recent = tenants.slice(0, 5);
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Tenants" value={stats?.total ?? (tenantsLoading ? '…' : 0)} />
        <StatCard label="Agency" value={stats?.agency ?? 0} />
        <StatCard label="Standalone" value={stats?.standalone ?? 0} />
        <StatCard label="On a plan" value={tenants.filter((t) => t.subscriptionPlan?.name).length} />
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="rounded-2xl p-5 bg-[#121214] border border-white/5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-black uppercase tracking-widest text-slate-400">Plan distribution</h3>
            <span className="text-[10px] text-slate-600">Live</span>
          </div>
          <div className="space-y-2">
            {planSummaryRows.map((row) => (
              <div
                key={row.name}
                className="flex items-center justify-between text-sm border-b border-white/5 last:border-b-0 py-2"
              >
                <span className="text-slate-300">{row.name}</span>
                <span className="font-black text-white">{row.count}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-2xl p-5 bg-[#121214] border border-white/5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-black uppercase tracking-widest text-slate-400">Recent tenants</h3>
          </div>
          {tenantsError ? (
            <p className="text-xs text-rose-400">{tenantsError}</p>
          ) : recent.length === 0 ? (
            <p className="text-xs text-slate-500">{tenantsLoading ? 'Loading…' : 'No tenants provisioned yet.'}</p>
          ) : (
            <div className="space-y-2">
              {recent.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between text-sm border-b border-white/5 last:border-b-0 py-2"
                >
                  <div className="min-w-0">
                    <div className="text-white font-bold truncate">{t.name}</div>
                    <div className="text-slate-500 text-xs truncate">{t.email}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-[10px] font-black uppercase tracking-widest text-sky-400">
                      {t.organizationType}
                    </div>
                    <div className="text-xs text-slate-400">{t.subscriptionPlan?.name || '—'}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
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
}: {
  tenants: HqTenantRow[];
  tenantsLoading: boolean;
  tenantsError: string;
  planOptions: SubscriptionPlanOption[];
  onAssignPlan: (email: string, planName: string) => void;
  pendingPlanEmail: string;
  onDeleteTenant: (email: string, dbName: string) => void;
  pendingDeleteEmail: string;
}) {
  return (
    <div className="rounded-2xl p-5 bg-[#121214] border border-white/5 overflow-hidden">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-black uppercase tracking-widest text-slate-400">All tenants</h3>
        <span className="text-[10px] text-slate-600">{tenants.length} total</span>
      </div>
      {tenantsError ? (
        <div className="text-xs text-rose-400 p-4 bg-rose-500/5 border border-rose-500/20 rounded-xl">
          {tenantsError}
        </div>
      ) : tenants.length === 0 ? (
        <div className="text-xs text-slate-500">{tenantsLoading ? 'Loading…' : 'No tenants yet.'}</div>
      ) : (
        <div className="overflow-x-auto -mx-5 px-5">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                <th className="text-left py-2 pr-3">Name</th>
                <th className="text-left py-2 pr-3">Email</th>
                <th className="text-left py-2 pr-3">Type</th>
                <th className="text-left py-2 pr-3">DB</th>
                <th className="text-left py-2 pr-3">Plan</th>
                <th className="text-right py-2 pl-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {tenants.map((t) => (
                <tr key={t.id} className="border-t border-white/5">
                  <td className="py-2 pr-3 text-white font-semibold">{t.name}</td>
                  <td className="py-2 pr-3 text-slate-400">{t.email}</td>
                  <td className="py-2 pr-3 text-sky-400 font-bold">{t.organizationType}</td>
                  <td className="py-2 pr-3 text-slate-500 font-mono text-xs">{t.tenantDbName || '—'}</td>
                  <td className="py-2 pr-3">
                    <select
                      value={t.subscriptionPlan?.name || ''}
                      onChange={(e) => onAssignPlan(t.email, e.target.value)}
                      disabled={pendingPlanEmail === t.email}
                      className="bg-[#1c1c1f] border border-white/10 rounded-lg px-2 py-1 text-xs text-slate-200 disabled:opacity-50"
                    >
                      <option value="">—</option>
                      {planOptions.map((opt) => (
                        <option key={opt.id} value={opt.name}>
                          {opt.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="py-2 pl-3 text-right">
                    <button
                      type="button"
                      onClick={() => onDeleteTenant(t.email, t.tenantDbName)}
                      disabled={pendingDeleteEmail === t.email}
                      className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-rose-300 hover:bg-rose-500/20 disabled:opacity-50"
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
    </div>
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
  };
  onChange: (
    next: {
      name: string;
      email: string;
      loginId: string;
      password: string;
      organizationType: 'agency' | 'standalone';
      plan: string;
    }
  ) => void;
  onSubmit: (e: React.FormEvent) => void;
  isLoading: boolean;
  planOptions: SubscriptionPlanOption[];
}) {
  return (
    <form
      onSubmit={onSubmit}
      className="bg-[#121214] border border-white/5 rounded-2xl p-6 space-y-5 max-w-2xl"
    >
      <p className="text-[11px] text-slate-500 leading-relaxed">
        Sign in to the main tenant app first so your access token is stored; this calls{' '}
        <code className="text-sky-400/90">POST /api/v1/hq/provision-tenant</code>. Provisioning creates a workspace
        record + dedicated tenant DB, seeds the chosen plan, and{' '}
        <span className="text-emerald-400 font-semibold">emails the new admin their login credentials automatically</span>.
      </p>

      <FieldText
        label="Tenant admin name"
        icon={User}
        value={data.name}
        onChange={(v) => onChange({ ...data, name: v })}
        placeholder="Acme HR Admin"
      />
      <FieldText
        label="Email"
        icon={Mail}
        type="email"
        value={data.email}
        onChange={(v) => onChange({ ...data, email: v })}
        placeholder="admin@tenant.com"
      />
      <FieldText
        label="Login ID"
        icon={Hash}
        value={data.loginId}
        onChange={(v) => onChange({ ...data, loginId: v })}
        placeholder="acme_admin"
      />
      <FieldText
        label="Password (min 8)"
        icon={Lock}
        type="password"
        minLength={8}
        value={data.password}
        onChange={(v) => onChange({ ...data, password: v })}
      />

      <div className="space-y-2">
        <label className="text-[12px] uppercase tracking-widest font-black text-slate-500 ml-1">
          Organization type
        </label>
        <div className="flex flex-wrap gap-4 text-sm text-slate-300">
          <label className="inline-flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="orgType"
              checked={data.organizationType === 'agency'}
              onChange={() => onChange({ ...data, organizationType: 'agency' })}
            />
            Agency
          </label>
          <label className="inline-flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="orgType"
              checked={data.organizationType === 'standalone'}
              onChange={() => onChange({ ...data, organizationType: 'standalone' })}
            />
            Standalone
          </label>
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-[12px] uppercase tracking-widest font-black text-slate-500 ml-1">Plan</label>
        <div className="flex flex-wrap gap-2">
          {planOptions.map((opt) => {
            const active = data.plan === opt.name;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => onChange({ ...data, plan: opt.name })}
                className={`px-4 py-2 rounded-lg text-xs font-bold border transition-colors ${
                  active
                    ? 'border-sky-500 bg-sky-500/10 text-sky-300'
                    : 'border-white/10 text-slate-400 hover:border-sky-500/40'
                }`}
              >
                {opt.name}
              </button>
            );
          })}
        </div>
        <p className="text-[11px] text-slate-600">Plan name is stored on the tenant — feature gating arrives later.</p>
      </div>

      <button
        type="submit"
        disabled={isLoading}
        className="w-full relative group overflow-hidden rounded-2xl p-[1px] font-bold disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 to-violet-600 transition-all group-hover:scale-105 duration-500" />
        <div className="relative bg-[#121214] rounded-[15px] py-4 px-6 flex items-center justify-center gap-2 group-hover:bg-transparent transition-colors duration-300">
          {isLoading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <>
              <span>Provision tenant</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </>
          )}
        </div>
      </button>
    </form>
  );
}

function PlansPanel({
  planOptions,
  planSummaryRows,
  tenants,
  onAssignPlan,
  pendingPlanEmail,
}: {
  planOptions: SubscriptionPlanOption[];
  planSummaryRows: { name: string; count: number }[];
  tenants: HqTenantRow[];
  onAssignPlan: (email: string, planName: string) => void;
  pendingPlanEmail: string;
}) {
  return (
    <div className="space-y-6">
      <div className="grid md:grid-cols-3 gap-4">
        {planOptions.map((opt) => {
          const count = planSummaryRows.find((r) => r.name === opt.name)?.count ?? 0;
          return (
            <div
              key={opt.id}
              className="rounded-2xl p-5 bg-[#121214] border border-white/5 flex flex-col gap-2"
            >
              <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">Plan</div>
              <div className="text-xl font-black text-white">{opt.name}</div>
              <div className="text-xs text-slate-500">{count} tenant{count === 1 ? '' : 's'} on this plan</div>
            </div>
          );
        })}
      </div>

      <div className="rounded-2xl p-5 bg-[#121214] border border-white/5">
        <h3 className="text-sm font-black uppercase tracking-widest text-slate-400 mb-4">Send plan to a tenant</h3>
        <p className="text-[11px] text-slate-500 mb-4">
          Pick an existing tenant by email and assign a plan. The chosen plan will surface in their sidebar in place of
          the “Free Trial” banner.
        </p>
        {tenants.length === 0 ? (
          <p className="text-xs text-slate-500">No tenants yet.</p>
        ) : (
          <div className="grid md:grid-cols-2 gap-3">
            {tenants.map((t) => (
              <div
                key={t.id}
                className="flex items-center justify-between p-3 rounded-xl bg-[#1c1c1f] border border-white/5"
              >
                <div className="min-w-0">
                  <div className="text-white text-sm font-semibold truncate">{t.name}</div>
                  <div className="text-slate-500 text-xs truncate">{t.email}</div>
                </div>
                <select
                  value={t.subscriptionPlan?.name || ''}
                  onChange={(e) => onAssignPlan(t.email, e.target.value)}
                  disabled={pendingPlanEmail === t.email}
                  className="bg-[#0a0a0b] border border-white/10 rounded-lg px-2 py-1 text-xs text-slate-200 disabled:opacity-50"
                >
                  <option value="">—</option>
                  {planOptions.map((opt) => (
                    <option key={opt.id} value={opt.name}>
                      {opt.name}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
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
    <form onSubmit={onSubmit} className="bg-[#121214] border border-white/5 rounded-2xl p-6 space-y-5 max-w-2xl">
      <p className="text-[11px] text-slate-500 leading-relaxed">
        Unsecured local bootstrap — injects Super Admin credentials directly into the tenant database. Use only on a
        fresh local environment.
      </p>
      <FieldText
        label="Full Name"
        icon={User}
        value={data.name}
        onChange={(v) => onChange({ ...data, name: v })}
        placeholder="e.g. Master Administrator"
      />
      <FieldText
        label="Email Address"
        icon={Mail}
        type="email"
        value={data.email}
        onChange={(v) => onChange({ ...data, email: v })}
        placeholder="admin@hryantra.com"
      />
      <FieldText
        label="User ID / Login ID"
        icon={Hash}
        value={data.userId}
        onChange={(v) => onChange({ ...data, userId: v })}
        placeholder="superuser_hq"
      />
      <FieldText
        label="System Password"
        icon={Lock}
        type="password"
        value={data.password}
        onChange={(v) => onChange({ ...data, password: v })}
      />
      <button
        type="submit"
        disabled={isLoading}
        className="w-full relative group overflow-hidden rounded-2xl p-[1px] font-bold disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <div className="absolute inset-0 bg-gradient-to-r from-sky-500 to-indigo-600 transition-all group-hover:scale-105 duration-500" />
        <div className="relative bg-[#121214] rounded-[15px] py-4 px-6 flex items-center justify-center gap-2 group-hover:bg-transparent transition-colors duration-300">
          {isLoading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <>
              <span>Inject Credentials</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </>
          )}
        </div>
      </button>
    </form>
  );
}

function FieldText({
  label,
  icon: Icon,
  type = 'text',
  value,
  onChange,
  placeholder,
  minLength,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  minLength?: number;
}) {
  return (
    <div className="space-y-2">
      <label className="text-[12px] uppercase tracking-widest font-black text-slate-500 ml-1">{label}</label>
      <div className="relative group/input">
        <Icon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within/input:text-sky-400 transition-colors" />
        <input
          type={type}
          required
          minLength={minLength}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-[#1c1c1f] border border-white/5 rounded-2xl py-4 pl-12 pr-4 text-white text-sm font-medium outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500/30 transition-all placeholder:text-slate-600"
        />
      </div>
    </div>
  );
}
