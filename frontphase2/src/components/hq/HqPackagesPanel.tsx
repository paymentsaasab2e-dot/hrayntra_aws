'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Check, Pencil, Plus, RefreshCcw, Star, Trash2, Users, Briefcase, X } from 'lucide-react';
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
import { getPackagePresentation, getDisplayedPrice, getPackageLimitsForCycle, getPackageOptionLabel, getPlanLabel, formatBillingCycleLabel, HQ_PLANS_SECTION, type BillingCycle } from './hqPackagePresentation';

type PackageFormState = {
  name: string;
  displayName: string;
  description: string;
  price: string;
  yearlyPrice: string;
  features: string[];
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
  features: [''],
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
    description: pkg.description || presentation.footnote,
    price: presentation.monthlyPrice === '—' ? '' : presentation.monthlyPrice,
    yearlyPrice: presentation.yearlyPrice === '—' ? '' : presentation.yearlyPrice,
    features: presentation.features.length > 0 ? [...presentation.features] : [''],
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
  const features = form.features.map((item) => item.trim()).filter(Boolean);
  if (features.length === 0) throw new Error('Add at least one bullet point');

  return {
    name: form.name.trim(),
    displayName: form.displayName.trim() || form.name.trim().toUpperCase(),
    description: form.description.trim(),
    price: form.price.trim(),
    yearlyPrice: form.yearlyPrice.trim(),
    pricePeriod: 'per month',
    features,
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

function PackageForm({
  form,
  onChange,
  onSubmit,
  onCancel,
  submitLabel,
  submitting,
  disableName,
}: {
  form: PackageFormState;
  onChange: (next: PackageFormState) => void;
  onSubmit: () => void;
  onCancel?: () => void;
  submitLabel: string;
  submitting: boolean;
  disableName?: boolean;
}) {
  const updateFeature = (index: number, value: string) => {
    const next = [...form.features];
    next[index] = value;
    onChange({ ...form, features: next });
  };

  const removeFeature = (index: number) => {
    const next = form.features.filter((_, i) => i !== index);
    onChange({ ...form, features: next.length > 0 ? next : [''] });
  };

  const addFeature = () => {
    onChange({ ...form, features: [...form.features, ''] });
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">
            Package name
          </label>
          <input
            className={inputClass}
            value={form.name}
            disabled={disableName}
            onChange={(e) => onChange({ ...form, name: e.target.value })}
            placeholder="e.g. Starter"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">
            Display label
          </label>
          <input
            className={inputClass}
            value={form.displayName}
            onChange={(e) => onChange({ ...form, displayName: e.target.value })}
            placeholder="e.g. STARTER"
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
            placeholder="e.g. 119 (billed annually)"
          />
        </div>
        <div className="md:col-span-2">
          <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">
            Card footnote
          </label>
          <input
            className={inputClass}
            value={form.description}
            onChange={(e) => onChange({ ...form, description: e.target.value })}
            placeholder="Short line shown below the card"
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
            Monthly max active jobs
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
            placeholder="Empty = use monthly limit"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">
            Annual max active jobs
          </label>
          <input
            type="number"
            min={0}
            className={inputClass}
            value={form.annualMaxJobs}
            onChange={(e) => onChange({ ...form, annualMaxJobs: e.target.value })}
            placeholder="Empty = use monthly limit"
          />
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          checked={form.isPopular}
          onChange={(e) => onChange({ ...form, isPopular: e.target.checked })}
          className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-300"
        />
        Mark as popular plan
      </label>

      <div>
        <div className="mb-2 flex items-center justify-between gap-2">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Bullet points
          </label>
          <button
            type="button"
            onClick={addFeature}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
          >
            <Plus className="h-3.5 w-3.5" />
            Add bullet
          </button>
        </div>
        <div className="space-y-2">
          {form.features.map((feature, index) => (
            <div key={`feature-${index}`} className="flex items-center gap-2">
              <input
                className={inputClass}
                value={feature}
                onChange={(e) => updateFeature(index, e.target.value)}
                placeholder={`Bullet point ${index + 1}`}
              />
              <button
                type="button"
                onClick={() => removeFeature(index)}
                className="rounded-lg border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-50 hover:text-rose-600"
                title="Remove bullet point"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <HqPrimaryButton type="button" onClick={onSubmit} disabled={submitting}>
          {submitting ? 'Saving…' : submitLabel}
        </HqPrimaryButton>
        {onCancel ? (
          <HqSecondaryButton type="button" onClick={onCancel} disabled={submitting}>
            Cancel
          </HqSecondaryButton>
        ) : null}
      </div>
    </div>
  );
}

function CreatePackageModal({
  open,
  onClose,
  onCreate,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (payload: ReturnType<typeof buildPackagePayload>) => Promise<void>;
}) {
  const [form, setForm] = useState<PackageFormState>(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm({ ...EMPTY_FORM, features: [''] });
    setError(null);
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

  const handleSubmit = async () => {
    setError(null);
    setSubmitting(true);
    try {
      if (!form.name.trim()) throw new Error('Package name is required');
      await onCreate(buildPackagePayload(form));
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create package');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[500] flex items-start justify-center overflow-y-auto p-4 sm:p-6">
      <button
        type="button"
        aria-label="Close modal backdrop"
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-[2px]"
        onClick={onClose}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-hq-package-title"
        className="relative my-4 w-full max-w-3xl rounded-2xl border border-slate-200 bg-white shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-5 sm:px-8">
          <div>
            <h2 id="create-hq-package-title" className="text-2xl font-bold text-slate-900">
              Create custom package
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Build a bespoke plan with pricing, bullet points, user limits, and job posting limits.
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

        <div className="px-6 py-5 sm:px-8">
          {error ? (
            <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
              {error}
            </div>
          ) : null}

          <PackageForm
            form={form}
            onChange={setForm}
            onSubmit={() => void handleSubmit()}
            onCancel={onClose}
            submitLabel="Create package"
            submitting={submitting}
          />
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
  const [localPackages, setLocalPackages] = useState(packages);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<PackageFormState>(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('monthly');

  useEffect(() => {
    setLocalPackages(packages);
  }, [packages]);

  const loadPackages = useCallback(async () => {
    const res = await apiHqListPackages();
    setLocalPackages(res.data?.packages || []);
  }, []);

  const handleCreate = async (payload: ReturnType<typeof buildPackagePayload>) => {
    setError(null);
    await apiHqCreatePackage(payload);
    await loadPackages();
    await onPackagesChanged();
  };

  const handleUpdate = async (packageId: string) => {
    setError(null);
    setSubmitting(true);
    try {
      if (!editForm.name.trim()) throw new Error('Package name is required');
      await apiHqUpdatePackage(packageId, buildPackagePayload(editForm));
      setEditingId(null);
      await loadPackages();
      await onPackagesChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update package');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (pkg: HqSubscriptionPackage) => {
    if (pkg.isSystem) return;
    const proceed = window.confirm(`Delete package "${pkg.name}"? This cannot be undone.`);
    if (!proceed) return;
    setError(null);
    setSubmitting(true);
    try {
      await apiHqDeletePackage(pkg.id);
      if (editingId === pkg.id) setEditingId(null);
      await loadPackages();
      await onPackagesChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete package');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end gap-2">
        {onRefresh ? (
          <HqSecondaryButton onClick={onRefresh} disabled={refreshing}>
            <RefreshCcw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh data
          </HqSecondaryButton>
        ) : null}
        <HqPrimaryButton type="button" onClick={() => setCreateModalOpen(true)}>
          <Plus className="h-4 w-4" />
          Create package
        </HqPrimaryButton>
      </div>

      <div className="text-center">
        <h2 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          {HQ_PLANS_SECTION.title}
        </h2>
        <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-slate-600 sm:text-base">
          {HQ_PLANS_SECTION.description}
        </p>
        <div className="mt-5 flex justify-center">
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
                billingCycle === 'annual' ? 'bg-slate-900' : 'bg-slate-200'
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
      </div>

      <CreatePackageModal
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onCreate={handleCreate}
      />

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-3">
        {localPackages.map((pkg) => {
          const count =
            planSummaryRows.find((row) => row.name === getPackageOptionLabel(pkg))?.count ?? 0;
          const isEditing = editingId === pkg.id;
          const presentation = getPackagePresentation(pkg);
          const displayedPrice = getDisplayedPrice(presentation, billingCycle);
          const activeLimits = getPackageLimitsForCycle(pkg, billingCycle);
          return (
            <HqPanel
              key={pkg.id}
              className={`flex h-full flex-col ${presentation.isPopular ? 'ring-2 ring-slate-900' : ''}`}
            >
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      {presentation.displayName}
                    </p>
                    {presentation.isPopular ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                        <Star className="h-3 w-3 fill-current" />
                        Popular
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-2 flex items-end gap-1">
                    {displayedPrice.amount && displayedPrice.amount !== '—' ? (
                      <>
                        <span className="text-3xl font-bold text-slate-900">${displayedPrice.amount}</span>
                        <span className="pb-1 text-sm text-slate-500">/ {displayedPrice.periodLabel}</span>
                      </>
                    ) : (
                      <span className="text-2xl font-bold text-slate-900">{pkg.name}</span>
                    )}
                  </div>
                  {!isEditing && presentation.monthlyPrice !== '—' && presentation.yearlyPrice !== '—' ? (
                    <p className="mt-1 text-[11px] text-slate-500">
                      {billingCycle === 'monthly'
                        ? `Annual: $${presentation.yearlyPrice} / month billed annually`
                        : `Monthly: $${presentation.monthlyPrice} / month`}
                    </p>
                  ) : null}
                  {pkg.isSystem ? (
                    <span className="mt-2 inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-600">
                      System
                    </span>
                  ) : (
                    <span className="mt-2 inline-flex rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-violet-700">
                      Custom
                    </span>
                  )}
                </div>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingId(pkg.id);
                      setEditForm(packageToForm(pkg));
                    }}
                    className="rounded-lg border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-50 hover:text-slate-800"
                    title="Edit package"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  {!pkg.isSystem ? (
                    <button
                      type="button"
                      onClick={() => void handleDelete(pkg)}
                      disabled={submitting}
                      className="rounded-lg border border-rose-200 p-2 text-rose-600 transition hover:bg-rose-50 disabled:opacity-50"
                      title="Delete package"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  ) : null}
                </div>
              </div>

              {!isEditing ? (
                <>
                  <ul className="mb-4 space-y-2">
                    {presentation.features.map((feature, index) => (
                      <li key={`${feature}-${index}`} className="flex items-start gap-2 text-sm text-slate-700">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <div className="mb-4 space-y-2 rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2.5 text-sm text-slate-600">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      {billingCycle === 'monthly' ? 'Monthly limits' : 'Annual limits'}
                    </p>
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-slate-400" />
                      {formatLimit(activeLimits.maxUsers, 'users')}
                    </div>
                    <div className="flex items-center gap-2">
                      <Briefcase className="h-4 w-4 text-slate-400" />
                      {formatLimit(activeLimits.maxJobs, 'jobs')}
                    </div>
                  </div>

                  <p className="mb-3 text-xs leading-relaxed text-slate-500">{presentation.footnote}</p>
                </>
              ) : null}

              <p className="mt-auto text-xs text-slate-500">
                {count} tenant{count === 1 ? '' : 's'} assigned
              </p>

              {isEditing ? (
                <div className="mt-4 border-t border-slate-100 pt-4">
                  <PackageForm
                    form={editForm}
                    onChange={setEditForm}
                    onSubmit={() => void handleUpdate(pkg.id)}
                    onCancel={() => setEditingId(null)}
                    submitLabel="Save package"
                    submitting={submitting}
                    disableName={pkg.isSystem}
                  />
                </div>
              ) : null}
            </HqPanel>
          );
        })}
      </div>

      <HqPanel>
        <HqPanelTitle title="Assign package to companies" />
        <p className="mb-4 text-sm text-slate-500">
          Each tenant company receives the selected package and billing cycle. Monthly and annual plans
          can have different user and job limits.
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
    </div>
  );
}
