'use client';

import React, { useEffect } from 'react';
import { ArrowRight, Calendar, Hash, Lock, Mail, User, X } from 'lucide-react';
import type { HqSubscriptionPackage } from '@/lib/api';
import { formatDateDMY } from '@/utils/dateDisplay';
import { getPackageOptionLabel, getPackageLimitsForCycle, computePlanEndDate, type BillingCycle } from './hqPackagePresentation';
import { HqFieldText, HqPrimaryButton, HqSecondaryButton } from './hqUi';

export type ProvisionTenantFormData = {
  name: string;
  email: string;
  loginId: string;
  password: string;
  organizationType: 'agency' | 'standalone';
  plan: string;
  billingCycle: BillingCycle;
  planStartDate: string;
};

type ProvisionTenantFormFieldsProps = {
  data: ProvisionTenantFormData;
  onChange: (next: ProvisionTenantFormData) => void;
  planOptions: HqSubscriptionPackage[];
  orgTypeName?: string;
};

export function ProvisionTenantFormFields({
  data,
  onChange,
  planOptions,
  orgTypeName = 'orgType',
}: ProvisionTenantFormFieldsProps) {
  const planEndDate = computePlanEndDate(data.planStartDate, data.billingCycle);

  return (
    <div className="space-y-5">
      <HqFieldText
        label="Tenant admin name"
        icon={User}
        value={data.name}
        onChange={(v) => onChange({ ...data, name: v })}
        placeholder="Acme HR Admin"
      />
      <HqFieldText
        label="Email"
        icon={Mail}
        type="email"
        value={data.email}
        onChange={(v) => onChange({ ...data, email: v })}
        placeholder="admin@tenant.com"
      />
      <HqFieldText
        label="Login ID"
        icon={Hash}
        value={data.loginId}
        onChange={(v) => onChange({ ...data, loginId: v })}
        placeholder="acme_admin"
      />
      <HqFieldText
        label="Password (min 8)"
        icon={Lock}
        type="password"
        minLength={8}
        value={data.password}
        onChange={(v) => onChange({ ...data, password: v })}
      />

      <div className="space-y-2">
        <label className="ml-1 text-xs font-bold uppercase tracking-wider text-slate-500">
          Organization type
        </label>
        <div className="flex flex-wrap gap-4 text-sm text-slate-700">
          <label className="inline-flex cursor-pointer items-center gap-2">
            <input
              type="radio"
              name={orgTypeName}
              checked={data.organizationType === 'agency'}
              onChange={() => onChange({ ...data, organizationType: 'agency' })}
            />
            Agency
          </label>
          <label className="inline-flex cursor-pointer items-center gap-2">
            <input
              type="radio"
              name={orgTypeName}
              checked={data.organizationType === 'standalone'}
              onChange={() => onChange({ ...data, organizationType: 'standalone' })}
            />
            Standalone
          </label>
        </div>
      </div>

      <div className="space-y-2">
        <label className="ml-1 text-xs font-bold uppercase tracking-wider text-slate-500">Plan</label>
        <div className="flex flex-wrap gap-2">
          {planOptions.map((opt) => {
            const active = data.plan === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => onChange({ ...data, plan: opt.id })}
                className={`rounded-lg border px-4 py-2 text-xs font-bold transition-colors ${
                  active
                    ? 'border-sky-300 bg-sky-50 text-sky-800'
                    : 'border-slate-200 text-slate-600 hover:border-sky-200 hover:bg-slate-50'
                }`}
              >
                {getPackageOptionLabel(opt)}
              </button>
            );
          })}
        </div>
        <p className="text-xs text-slate-400">
          Package limits are stored on the tenant workspace based on billing cycle.
        </p>
      </div>

      <div className="space-y-2">
        <label className="ml-1 text-xs font-bold uppercase tracking-wider text-slate-500">
          Billing cycle
        </label>
        <div className="flex flex-wrap gap-2">
          {(['monthly', 'annual'] as BillingCycle[]).map((cycle) => {
            const active = data.billingCycle === cycle;
            const selected = planOptions.find((opt) => opt.id === data.plan);
            const limits = selected ? getPackageLimitsForCycle(selected, cycle) : null;
            return (
              <button
                key={cycle}
                type="button"
                onClick={() => onChange({ ...data, billingCycle: cycle })}
                className={`rounded-lg border px-4 py-2 text-left text-xs font-bold transition-colors ${
                  active
                    ? 'border-sky-300 bg-sky-50 text-sky-800'
                    : 'border-slate-200 text-slate-600 hover:border-sky-200 hover:bg-slate-50'
                }`}
              >
                <span className="block">{cycle === 'monthly' ? 'Monthly' : 'Annual'}</span>
                {limits ? (
                  <span className="mt-0.5 block text-[10px] font-medium text-slate-500">
                    {limits.maxUsers == null ? 'Unlimited users' : `${limits.maxUsers} users`}
                    {' · '}
                    {limits.maxJobs == null ? 'Unlimited jobs' : `${limits.maxJobs} jobs`}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-2">
        <label className="ml-1 text-xs font-bold uppercase tracking-wider text-slate-500">
          Package start date
        </label>
        <div className="relative">
          <Calendar className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="date"
            value={data.planStartDate}
            onChange={(e) => onChange({ ...data, planStartDate: e.target.value })}
            className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-800 outline-none transition focus:border-sky-300 focus:ring-2 focus:ring-sky-100"
          />
        </div>
        <p className="text-xs text-slate-500">
          Package ends on{' '}
          <span className="font-semibold text-slate-700">
            {planEndDate ? formatDateDMY(planEndDate) : '—'}
          </span>
          {' '}
          ({data.billingCycle === 'annual' ? '365 days' : '30 days'} from start).
        </p>
      </div>
    </div>
  );
}

type CreateTenantModalProps = {
  open: boolean;
  onClose: () => void;
  data: ProvisionTenantFormData;
  onChange: (next: ProvisionTenantFormData) => void;
  onSubmit: (e: React.FormEvent) => void;
  isLoading: boolean;
  planOptions: HqSubscriptionPackage[];
};

export function CreateTenantModal({
  open,
  onClose,
  data,
  onChange,
  onSubmit,
  isLoading,
  planOptions,
}: CreateTenantModalProps) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isLoading) onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open, onClose, isLoading]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[500] flex items-start justify-center overflow-y-auto p-4 sm:p-6">
      <button
        type="button"
        aria-label="Close modal backdrop"
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-[2px]"
        onClick={() => {
          if (!isLoading) onClose();
        }}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-tenant-title"
        className="relative my-4 w-full max-w-2xl rounded-2xl border border-slate-200 bg-white shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-5 sm:px-8">
          <div>
            <h2 id="create-tenant-title" className="text-2xl font-bold text-slate-900">
              Create tenant
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Provision a new workspace, dedicated tenant database, and email login credentials to
              the admin.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="rounded-lg border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-50 hover:text-slate-800 disabled:opacity-50"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={onSubmit} className="px-6 py-5 sm:px-8">
          <p className="mb-5 text-sm leading-relaxed text-slate-500">
            Sign in to the main tenant app first so your access token is stored. This calls{' '}
            <code className="rounded bg-slate-100 px-1 py-0.5 text-xs text-sky-800">
              POST /api/v1/hq/provision-tenant
            </code>
            .
          </p>

          <ProvisionTenantFormFields
            data={data}
            onChange={onChange}
            planOptions={planOptions}
            orgTypeName="createTenantOrgType"
          />

          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <HqSecondaryButton type="button" onClick={onClose} disabled={isLoading}>
              Cancel
            </HqSecondaryButton>
            <HqPrimaryButton type="submit" disabled={isLoading} loading={isLoading}>
              Create tenant
              <ArrowRight className="h-4 w-4" />
            </HqPrimaryButton>
          </div>
        </form>
      </div>
    </div>
  );
}
