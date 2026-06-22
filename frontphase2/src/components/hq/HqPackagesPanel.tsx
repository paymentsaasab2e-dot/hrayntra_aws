'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Pencil, Plus, Trash2, Users, Briefcase } from 'lucide-react';
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

type PackageFormState = {
  name: string;
  description: string;
  maxUsers: string;
  maxJobs: string;
};

const EMPTY_FORM: PackageFormState = {
  name: '',
  description: '',
  maxUsers: '',
  maxJobs: '',
};

function formatLimit(value: number | null | undefined, unit: string) {
  if (value === null || value === undefined) return `Unlimited ${unit}`;
  return `Up to ${value} ${unit}`;
}

function packageToForm(pkg: HqSubscriptionPackage): PackageFormState {
  return {
    name: pkg.name,
    description: pkg.description || '',
    maxUsers: pkg.maxUsers === null || pkg.maxUsers === undefined ? '' : String(pkg.maxUsers),
    maxJobs: pkg.maxJobs === null || pkg.maxJobs === undefined ? '' : String(pkg.maxJobs),
  };
}

function parseLimitInput(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n < 0) throw new Error('Limits must be empty (unlimited) or a positive number');
  return Math.floor(n);
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
  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">
            Package name
          </label>
          <input
            className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 outline-none focus:border-sky-300 focus:ring-2 focus:ring-sky-100"
            value={form.name}
            disabled={disableName}
            onChange={(e) => onChange({ ...form, name: e.target.value })}
            placeholder="e.g. Growth"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">
            Description
          </label>
          <input
            className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 outline-none focus:border-sky-300 focus:ring-2 focus:ring-sky-100"
            value={form.description}
            onChange={(e) => onChange({ ...form, description: e.target.value })}
            placeholder="Short summary for HQ operators"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">
            Max users
          </label>
          <input
            type="number"
            min={0}
            className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 outline-none focus:border-sky-300 focus:ring-2 focus:ring-sky-100"
            value={form.maxUsers}
            onChange={(e) => onChange({ ...form, maxUsers: e.target.value })}
            placeholder="Empty = unlimited"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">
            Max active jobs
          </label>
          <input
            type="number"
            min={0}
            className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 outline-none focus:border-sky-300 focus:ring-2 focus:ring-sky-100"
            value={form.maxJobs}
            onChange={(e) => onChange({ ...form, maxJobs: e.target.value })}
            placeholder="Empty = unlimited"
          />
        </div>
      </div>

      <p className="text-xs text-slate-500">
        All platform modules are included on every package. Only user and job posting limits differ.
      </p>

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

export function HqPackagesPanel({
  packages,
  planSummaryRows,
  tenants,
  onAssignPlan,
  pendingPlanEmail,
  onPackagesChanged,
}: {
  packages: HqSubscriptionPackage[];
  planSummaryRows: { name: string; count: number }[];
  tenants: HqTenantRow[];
  onAssignPlan: (email: string, planId: string) => void;
  pendingPlanEmail: string;
  onPackagesChanged: () => Promise<void>;
}) {
  const [localPackages, setLocalPackages] = useState(packages);
  const [createForm, setCreateForm] = useState<PackageFormState>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<PackageFormState>(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setLocalPackages(packages);
  }, [packages]);

  const loadPackages = useCallback(async () => {
    const res = await apiHqListPackages();
    setLocalPackages(res.data?.packages || []);
  }, []);

  const handleCreate = async () => {
    setError(null);
    setSubmitting(true);
    try {
      if (!createForm.name.trim()) throw new Error('Package name is required');
      await apiHqCreatePackage({
        name: createForm.name.trim(),
        description: createForm.description.trim(),
        maxUsers: parseLimitInput(createForm.maxUsers),
        maxJobs: parseLimitInput(createForm.maxJobs),
      });
      setCreateForm(EMPTY_FORM);
      await loadPackages();
      await onPackagesChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create package');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdate = async (packageId: string) => {
    setError(null);
    setSubmitting(true);
    try {
      if (!editForm.name.trim()) throw new Error('Package name is required');
      await apiHqUpdatePackage(packageId, {
        name: editForm.name.trim(),
        description: editForm.description.trim(),
        maxUsers: parseLimitInput(editForm.maxUsers),
        maxJobs: parseLimitInput(editForm.maxJobs),
      });
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
      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-3">
        {localPackages.map((pkg) => {
          const count = planSummaryRows.find((row) => row.name === pkg.name)?.count ?? 0;
          const isEditing = editingId === pkg.id;
          return (
            <HqPanel key={pkg.id} className="flex h-full flex-col">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Package</p>
                  <p className="mt-1 text-2xl font-bold text-slate-900">{pkg.name}</p>
                  {pkg.isSystem ? (
                    <span className="mt-1 inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-600">
                      System
                    </span>
                  ) : (
                    <span className="mt-1 inline-flex rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-violet-700">
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

              {pkg.description ? <p className="mb-4 text-sm text-slate-600">{pkg.description}</p> : null}

              <div className="mb-4 space-y-2 text-sm text-slate-600">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-slate-400" />
                  {formatLimit(pkg.maxUsers, 'users')}
                </div>
                <div className="flex items-center gap-2">
                  <Briefcase className="h-4 w-4 text-slate-400" />
                  {formatLimit(pkg.maxJobs, 'jobs')}
                </div>
              </div>

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
        <HqPanelTitle
          title="Create custom package"
          meta={<Plus className="h-4 w-4 text-slate-400" />}
        />
        <p className="mb-4 text-sm text-slate-500">
          Build a bespoke plan with user and job posting limits, then assign it to any tenant company.
        </p>
        <PackageForm
          form={createForm}
          onChange={setCreateForm}
          onSubmit={() => void handleCreate()}
          submitLabel="Create package"
          submitting={submitting}
        />
      </HqPanel>

      <HqPanel>
        <HqPanelTitle title="Assign package to companies" />
        <p className="mb-4 text-sm text-slate-500">
          Each tenant company receives the selected package. User and job limits are copied into that
          tenant&apos;s workspace settings for enforcement.
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
                      Current: {tenant.subscriptionPlan.name}
                      {tenant.subscriptionPlan.maxUsers != null
                        ? ` · ${tenant.subscriptionPlan.maxUsers} users`
                        : ' · unlimited users'}
                    </div>
                  ) : null}
                </div>
                <select
                  value={tenantPlanId(tenant, localPackages)}
                  onChange={(e) => onAssignPlan(tenant.email, e.target.value)}
                  disabled={pendingPlanEmail === tenant.email}
                  className={HQ_SELECT_CLASS}
                >
                  <option value="">—</option>
                  {localPackages.map((pkg) => (
                    <option key={pkg.id} value={pkg.id}>
                      {pkg.name}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        )}
      </HqPanel>
    </div>
  );
}
