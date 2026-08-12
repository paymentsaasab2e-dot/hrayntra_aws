'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Pencil, Plus, RefreshCcw, Star, Trash2, Users, Briefcase, X, Coins } from 'lucide-react';
import {
  apiHqCreatePackage,
  apiHqDeletePackage,
  apiHqListPackages,
  apiHqUpdatePackage,
  type HqSubscriptionPackage,
  type HqTenantRow,
} from '@/lib/api';
import {
  HQ_SELECT_CLASS,
  HqPanel,
  HqPanelTitle,
  HqPrimaryButton,
  HqSecondaryButton,
} from './hqUi';
import {
  getDisplayedPrice,
  getPackageLimitsForCycle,
  getPackageOptionLabel,
  getPackagePresentation,
  getPlanLabel,
  formatBillingCycleLabel,
  type BillingCycle,
} from './hqPackagePresentation';
import { HqAiPlansPanel } from './HqAiPlansPanel';
import { HqAiCoinPacksPanel } from './HqAiCoinPacksPanel';

type PackageFormState = {
  name: string;
  displayName: string;
  description: string;
  price: string;
  yearlyPrice: string;
  isPopular: boolean;
  maxUsers: string;
  maxJobs: string;
  annualMaxUsers: string;
  annualMaxJobs: string;
};

const EMPTY_FORM: PackageFormState = {
  name: '',
  displayName: '',
  description: '',
  price: '',
  yearlyPrice: '',
  isPopular: false,
  maxUsers: '',
  maxJobs: '',
  annualMaxUsers: '',
  annualMaxJobs: '',
};

const inputClass =
  'w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 outline-none focus:border-sky-300 focus:ring-2 focus:ring-sky-100';

function formatLimit(value: number | null | undefined, unit: string) {
  if (value === null || value === undefined) return `Unlimited ${unit}`;
  return `Up to ${value} ${unit}`;
}

function packageToForm(pkg: HqSubscriptionPackage): PackageFormState {
  const presentation = getPackagePresentation(pkg);
  return {
    name: pkg.name,
    displayName: presentation.displayName,
    description: pkg.description || '',
    price: presentation.monthlyPrice === '—' ? '' : presentation.monthlyPrice,
    yearlyPrice: presentation.yearlyPrice === '—' ? '' : presentation.yearlyPrice,
    isPopular: Boolean(pkg.isPopular ?? presentation.isPopular),
    maxUsers: pkg.maxUsers === null || pkg.maxUsers === undefined ? '' : String(pkg.maxUsers),
    maxJobs: pkg.maxJobs === null || pkg.maxJobs === undefined ? '' : String(pkg.maxJobs),
    annualMaxUsers:
      pkg.annualMaxUsers === null || pkg.annualMaxUsers === undefined ? '' : String(pkg.annualMaxUsers),
    annualMaxJobs:
      pkg.annualMaxJobs === null || pkg.annualMaxJobs === undefined ? '' : String(pkg.annualMaxJobs),
  };
}

function parseLimitInput(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n < 0) throw new Error('Limits must be empty (unlimited) or a positive number');
  return Math.floor(n);
}

function buildPackagePayload(form: PackageFormState) {
  if (!form.name.trim()) throw new Error('Plan name is required');

  return {
    name: form.name.trim(),
    displayName: form.displayName.trim() || form.name.trim(),
    description: form.description.trim(),
    price: form.price.trim(),
    yearlyPrice: form.yearlyPrice.trim(),
    pricePeriod: 'per month',
    features: [] as string[],
    isPopular: form.isPopular,
    maxUsers: parseLimitInput(form.maxUsers),
    maxJobs: parseLimitInput(form.maxJobs),
    annualMaxUsers: parseLimitInput(form.annualMaxUsers),
    annualMaxJobs: parseLimitInput(form.annualMaxJobs),
  };
}

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

function PackageFormFields({
  form,
  onChange,
  disableName,
}: {
  form: PackageFormState;
  onChange: (next: PackageFormState) => void;
  disableName?: boolean;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div>
        <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">
          Plan name
        </label>
        <input
          className={inputClass}
          value={form.name}
          disabled={disableName}
          onChange={(e) => onChange({ ...form, name: e.target.value })}
          placeholder="e.g. Growth"
        />
      </div>
      <div>
        <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">
          Display name
        </label>
        <input
          className={inputClass}
          value={form.displayName}
          onChange={(e) => onChange({ ...form, displayName: e.target.value })}
          placeholder="Shown on cards / assign lists"
        />
      </div>
      <div>
        <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">
          Monthly price (USD)
        </label>
        <input
          className={inputClass}
          value={form.price}
          onChange={(e) => onChange({ ...form, price: e.target.value })}
          placeholder="e.g. 149"
        />
      </div>
      <div>
        <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">
          Annual price (USD / month)
        </label>
        <input
          className={inputClass}
          value={form.yearlyPrice}
          onChange={(e) => onChange({ ...form, yearlyPrice: e.target.value })}
          placeholder="e.g. 119"
        />
      </div>
      <div>
        <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">
          Monthly max users
        </label>
        <input
          type="number"
          min={0}
          className={inputClass}
          value={form.maxUsers}
          onChange={(e) => onChange({ ...form, maxUsers: e.target.value })}
          placeholder="Empty = unlimited"
        />
      </div>
      <div>
        <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">
          Monthly max jobs
        </label>
        <input
          type="number"
          min={0}
          className={inputClass}
          value={form.maxJobs}
          onChange={(e) => onChange({ ...form, maxJobs: e.target.value })}
          placeholder="Empty = unlimited"
        />
      </div>
      <div>
        <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">
          Annual max users
        </label>
        <input
          type="number"
          min={0}
          className={inputClass}
          value={form.annualMaxUsers}
          onChange={(e) => onChange({ ...form, annualMaxUsers: e.target.value })}
          placeholder="Empty = use monthly"
        />
      </div>
      <div>
        <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">
          Annual max jobs
        </label>
        <input
          type="number"
          min={0}
          className={inputClass}
          value={form.annualMaxJobs}
          onChange={(e) => onChange({ ...form, annualMaxJobs: e.target.value })}
          placeholder="Empty = use monthly"
        />
      </div>
      <div className="md:col-span-2">
        <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">
          Description
        </label>
        <input
          className={inputClass}
          value={form.description}
          onChange={(e) => onChange({ ...form, description: e.target.value })}
          placeholder="Short note for this plan"
        />
      </div>
      <div className="md:col-span-2">
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={form.isPopular}
            onChange={(e) => onChange({ ...form, isPopular: e.target.checked })}
            className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-300"
          />
          Mark as popular plan
        </label>
      </div>
    </div>
  );
}

function PlanFormModal({
  open,
  mode,
  form,
  onChange,
  onClose,
  onSubmit,
  submitting,
  error,
  disableName,
}: {
  open: boolean;
  mode: 'create' | 'edit';
  form: PackageFormState;
  onChange: (next: PackageFormState) => void;
  onClose: () => void;
  onSubmit: () => void;
  submitting: boolean;
  error: string | null;
  disableName?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[500] flex items-center justify-center p-4 sm:p-6">
      <button
        type="button"
        aria-label="Close modal backdrop"
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="hq-plan-modal-title"
        className="relative w-full max-w-xl rounded-2xl border border-slate-200 bg-white shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-5">
          <div>
            <h2 id="hq-plan-modal-title" className="text-xl font-bold text-slate-900">
              {mode === 'create' ? 'Create plan' : 'Edit plan'}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Set the plan name, pricing, and user/job limits for tenant assignment.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-50 hover:text-slate-800"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto px-6 py-5">
          {error ? (
            <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
              {error}
            </div>
          ) : null}
          <PackageFormFields form={form} onChange={onChange} disableName={disableName} />
        </div>

        <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 px-6 py-4">
          <HqSecondaryButton type="button" onClick={onClose} disabled={submitting}>
            Cancel
          </HqSecondaryButton>
          <HqPrimaryButton type="button" onClick={onSubmit} disabled={submitting}>
            {submitting ? 'Saving…' : mode === 'create' ? 'Create plan' : 'Save plan'}
          </HqPrimaryButton>
        </div>
      </div>
    </div>
  );
}

export function HqPackagesPanel({
  packages,
  planSummaryRows,
  tenants,
  onAssignPlan,
  pendingPlanEmail,
  onPackagesChanged,
  onRefresh,
  refreshing = false,
}: {
  packages: HqSubscriptionPackage[];
  planSummaryRows: { name: string; count: number }[];
  tenants: HqTenantRow[];
  onAssignPlan: (email: string, planId: string, billingCycle?: BillingCycle) => void;
  pendingPlanEmail: string;
  onPackagesChanged: () => Promise<void>;
  onRefresh?: () => void;
  refreshing?: boolean;
}) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const plansTabParam = searchParams.get('plansTab');
  const initialSubTab: 'subscription' | 'ai' | 'packs' =
    plansTabParam === 'ai' || plansTabParam === 'packs' ? plansTabParam : 'subscription';
  const [localPackages, setLocalPackages] = useState(packages);
  const [subTab, setSubTab] = useState<'subscription' | 'ai' | 'packs'>(initialSubTab);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingIsSystem, setEditingIsSystem] = useState(false);
  const [form, setForm] = useState<PackageFormState>(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('monthly');

  useEffect(() => {
    setLocalPackages(packages);
  }, [packages]);

  useEffect(() => {
    const next =
      plansTabParam === 'ai' || plansTabParam === 'packs' ? plansTabParam : 'subscription';
    setSubTab(next);
  }, [plansTabParam]);

  const selectSubTab = (next: 'subscription' | 'ai' | 'packs') => {
    setSubTab(next);
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', 'plans');
    if (next === 'subscription') {
      params.delete('plansTab');
    } else {
      params.set('plansTab', next);
    }
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  const loadPackages = useCallback(async () => {
    const res = await apiHqListPackages();
    setLocalPackages(res.data?.packages || []);
  }, []);

  const openCreate = () => {
    setModalMode('create');
    setEditingId(null);
    setEditingIsSystem(false);
    setForm({ ...EMPTY_FORM });
    setError(null);
    setModalOpen(true);
  };

  const openEdit = (pkg: HqSubscriptionPackage) => {
    setModalMode('edit');
    setEditingId(pkg.id);
    setEditingIsSystem(Boolean(pkg.isSystem));
    setForm(packageToForm(pkg));
    setError(null);
    setModalOpen(true);
  };

  const closeModal = () => {
    if (submitting) return;
    setModalOpen(false);
    setEditingId(null);
    setError(null);
  };

  const handleSubmit = async () => {
    setError(null);
    setSubmitting(true);
    try {
      const payload = buildPackagePayload(form);
      if (modalMode === 'create') {
        await apiHqCreatePackage(payload);
      } else {
        if (!editingId) throw new Error('Missing plan id');
        await apiHqUpdatePackage(editingId, payload);
      }
      setModalOpen(false);
      setEditingId(null);
      await loadPackages();
      await onPackagesChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save plan');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (pkg: HqSubscriptionPackage) => {
    if (pkg.isSystem) return;
    const proceed = window.confirm(`Delete plan "${pkg.name}"? This cannot be undone.`);
    if (!proceed) return;
    setError(null);
    setSubmitting(true);
    try {
      await apiHqDeletePackage(pkg.id);
      if (editingId === pkg.id) {
        setModalOpen(false);
        setEditingId(null);
      }
      await loadPackages();
      await onPackagesChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete plan');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="inline-flex rounded-full border border-slate-200 bg-white p-1 shadow-sm">
        <button
          type="button"
          onClick={() => selectSubTab('subscription')}
          className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
            subTab === 'subscription'
              ? 'bg-sky-600 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          Subscription plans
        </button>
        <button
          type="button"
          onClick={() => selectSubTab('ai')}
          className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition ${
            subTab === 'ai' ? 'bg-amber-500 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          <Coins className="h-4 w-4" />
          AI Plans
        </button>
        <button
          type="button"
          onClick={() => selectSubTab('packs')}
          className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition ${
            subTab === 'packs' ? 'bg-orange-500 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          <Coins className="h-4 w-4" />
          Coin packs
        </button>
      </div>

      {subTab === 'ai' ? <HqAiPlansPanel /> : null}
      {subTab === 'packs' ? <HqAiCoinPacksPanel /> : null}

      {subTab === 'subscription' ? (
        <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Subscription plans</h2>
          <p className="mt-1 text-sm text-slate-500">
            Create plans with names, pricing, and limits — then assign them to tenants.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {onRefresh ? (
            <HqSecondaryButton onClick={onRefresh} disabled={refreshing}>
              <RefreshCcw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </HqSecondaryButton>
          ) : null}
          <HqPrimaryButton type="button" onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Create plan
          </HqPrimaryButton>
        </div>
      </div>

      <div className="flex justify-start">
        <div className="inline-flex items-center gap-3 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm shadow-sm">
          <span className={billingCycle === 'monthly' ? 'font-semibold text-slate-900' : 'text-slate-500'}>
            Monthly
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={billingCycle === 'annual'}
            onClick={() => setBillingCycle((prev) => (prev === 'monthly' ? 'annual' : 'monthly'))}
            className={`relative h-6 w-11 rounded-full transition ${
              billingCycle === 'annual' ? 'bg-sky-600' : 'bg-slate-200'
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition ${
                billingCycle === 'annual' ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
          <span className={billingCycle === 'annual' ? 'font-semibold text-slate-900' : 'text-slate-500'}>
            Annual
            <span className="ml-1 text-xs font-medium text-emerald-600">Save 20%</span>
          </span>
        </div>
      </div>

      <PlanFormModal
        open={modalOpen}
        mode={modalMode}
        form={form}
        onChange={setForm}
        onClose={closeModal}
        onSubmit={() => void handleSubmit()}
        submitting={submitting}
        error={error}
        disableName={modalMode === 'edit' && editingIsSystem}
      />

      {error && !modalOpen ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</div>
      ) : null}

      <div className="hq-table-wrap">
        <div className="hq-table-scroll">
          <table className="w-full min-w-[720px] text-left">
            <thead>
              <tr>
                <th>Plan</th>
                <th>Price</th>
                <th>Limits</th>
                <th className="text-right">Tenants</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {localPackages.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-slate-500">
                    No plans yet. Create your first plan to assign to tenants.
                  </td>
                </tr>
              ) : (
                localPackages.map((pkg) => {
                  const count =
                    planSummaryRows.find((row) => row.name === getPackageOptionLabel(pkg))?.count ?? 0;
                  const presentation = getPackagePresentation(pkg);
                  const displayedPrice = getDisplayedPrice(presentation, billingCycle);
                  const activeLimits = getPackageLimitsForCycle(pkg, billingCycle);

                  return (
                    <tr key={pkg.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60">
                      <td className="px-5 py-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-slate-900">
                            {getPackageOptionLabel(pkg)}
                          </span>
                          {presentation.isPopular ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-sky-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                              <Star className="h-3 w-3 fill-current" />
                              Popular
                            </span>
                          ) : null}
                          {pkg.isSystem ? (
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-600">
                              System
                            </span>
                          ) : (
                            <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-violet-700">
                              Custom
                            </span>
                          )}
                        </div>
                        {pkg.description ? (
                          <p className="mt-1 max-w-md text-xs text-slate-500">{pkg.description}</p>
                        ) : null}
                      </td>
                      <td className="px-3 py-4">
                        {displayedPrice.amount && displayedPrice.amount !== '—' ? (
                          <div>
                            <p className="font-bold text-slate-900">${displayedPrice.amount}</p>
                            <p className="text-[11px] text-slate-500">/ {displayedPrice.periodLabel}</p>
                          </div>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-3 py-4 text-slate-600">
                        <div className="flex items-center gap-1.5 text-xs">
                          <Users className="h-3.5 w-3.5 text-slate-400" />
                          {formatLimit(activeLimits.maxUsers, 'users')}
                        </div>
                        <div className="mt-1 flex items-center gap-1.5 text-xs">
                          <Briefcase className="h-3.5 w-3.5 text-slate-400" />
                          {formatLimit(activeLimits.maxJobs, 'jobs')}
                        </div>
                      </td>
                      <td className="px-3 py-4 text-right font-semibold text-slate-800">{count}</td>
                      <td className="px-5 py-4">
                        <div className="flex justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => openEdit(pkg)}
                            className="rounded-lg border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-50 hover:text-slate-800"
                            title="Edit plan"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          {!pkg.isSystem ? (
                            <button
                              type="button"
                              onClick={() => void handleDelete(pkg)}
                              disabled={submitting}
                              className="rounded-lg border border-rose-200 p-2 text-rose-600 transition hover:bg-rose-50 disabled:opacity-50"
                              title="Delete plan"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <HqPanel>
        <HqPanelTitle title="Assign plan to companies" />
        <p className="mb-4 text-sm text-slate-500">
          Each tenant receives the selected plan and billing cycle. Monthly and annual can use different
          user and job limits.
        </p>
        {tenants.length === 0 ? (
          <p className="text-xs text-slate-500">No tenants yet.</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {tenants.map((tenant) => (
              <div
                key={tenant.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/80 p-3"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-slate-900">{tenant.name}</div>
                  <div className="truncate text-xs text-slate-500">{tenant.email}</div>
                  {tenant.subscriptionPlan ? (
                    <div className="mt-1 text-[11px] text-slate-500">
                      Current: {getPlanLabel(tenant.subscriptionPlan, localPackages)} ·{' '}
                      {formatBillingCycleLabel(tenantBillingCycle(tenant))}
                      {tenant.subscriptionPlan.maxUsers != null
                        ? ` · ${tenant.subscriptionPlan.maxUsers} users`
                        : ' · unlimited users'}
                    </div>
                  ) : null}
                </div>
                <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
                  <select
                    value={tenantPlanId(tenant, localPackages)}
                    onChange={(e) =>
                      onAssignPlan(tenant.email, e.target.value, tenantBillingCycle(tenant))
                    }
                    disabled={pendingPlanEmail === tenant.email}
                    className={HQ_SELECT_CLASS}
                  >
                    <option value="">—</option>
                    {localPackages.map((pkg) => (
                      <option key={pkg.id} value={pkg.id}>
                        {getPackageOptionLabel(pkg)}
                      </option>
                    ))}
                  </select>
                  <select
                    value={tenantBillingCycle(tenant)}
                    onChange={(e) => {
                      const planId = tenantPlanId(tenant, localPackages);
                      if (!planId) return;
                      onAssignPlan(tenant.email, planId, e.target.value as BillingCycle);
                    }}
                    disabled={pendingPlanEmail === tenant.email || !tenantPlanId(tenant, localPackages)}
                    className={HQ_SELECT_CLASS}
                  >
                    <option value="monthly">Monthly</option>
                    <option value="annual">Annual</option>
                  </select>
                </div>
              </div>
            ))}
          </div>
        )}
      </HqPanel>
        </>
      ) : null}
    </div>
  );
}
