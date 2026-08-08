'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  Building2,
  Hash,
  Lock,
  Mail,
  User,
  X,
} from 'lucide-react';
import { apiHqListCompanies, type HqCompanyApiRow } from '@/lib/api';
import {
  CRM_TENANT_MODULES,
  RECRUITMENT_TENANT_MODULES,
  defaultModulesForProductLine,
  type TenantProductLine,
} from '@/lib/tenantModuleCatalog';
import { HqFieldText, HqPrimaryButton, HqSecondaryButton } from './hqUi';

export type { TenantProductLine };
export type TenantCreateSource = 'company' | 'manual';

export type TenantBillingCycle = 'monthly' | 'annual';
export type TenantPlanName = 'Starter' | 'Professional' | 'Enterprise' | 'Custom';

export type ProvisionTenantFormData = {
  name: string;
  email: string;
  loginId: string;
  password: string;
  organizationType: 'agency' | 'standalone';
  productLine: TenantProductLine;
  enabledModules: string[];
  source: TenantCreateSource;
  companyId: string;
  planName: TenantPlanName;
  billingCycle: TenantBillingCycle;
  planStartDate: string;
  planEndDate: string;
  maxUsers: string;
  maxJobs: string;
  customPrice: string;
  coins: string;
};

export {
  CRM_TENANT_MODULES,
  RECRUITMENT_TENANT_MODULES,
  defaultModulesForProductLine,
};

const PLAN_PRESETS: Record<TenantPlanName, { price: string; yearlyPrice: string; maxUsers: string; maxJobs: string; coins: string }> = {
  Starter: { price: '149', yearlyPrice: '119', maxUsers: '5', maxJobs: '25', coins: '100' },
  Professional: { price: '399', yearlyPrice: '319', maxUsers: '25', maxJobs: '', coins: '500' },
  Enterprise: { price: '999', yearlyPrice: '799', maxUsers: '', maxJobs: '', coins: '2000' },
  Custom: { price: '', yearlyPrice: '', maxUsers: '', maxJobs: '', coins: '' },
};

export function defaultPlanEndDate(
  planStartDate: string,
  billingCycle: TenantBillingCycle = 'monthly',
): string {
  const start = String(planStartDate || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start)) return '';
  const days = billingCycle === 'annual' ? 365 : 30;
  const d = new Date(`${start}T12:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function emptyProvisionTenantForm(
  overrides?: Partial<ProvisionTenantFormData>,
): ProvisionTenantFormData {
  const planStartDate = new Date().toISOString().slice(0, 10);
  const billingCycle: TenantBillingCycle = overrides?.billingCycle || 'monthly';
  return {
    name: '',
    email: '',
    loginId: '',
    password: '',
    organizationType: 'agency',
    productLine: 'crm',
    enabledModules: defaultModulesForProductLine('crm'),
    source: 'manual',
    companyId: '',
    planName: 'Starter',
    billingCycle,
    planStartDate,
    planEndDate: defaultPlanEndDate(planStartDate, billingCycle),
    maxUsers: '5',
    maxJobs: '25',
    customPrice: '149',
    coins: '100',
    ...overrides,
    planEndDate:
      overrides?.planEndDate ||
      defaultPlanEndDate(
        overrides?.planStartDate || planStartDate,
        overrides?.billingCycle || billingCycle,
      ),
  };
}

export function provisionFormFromCompany(company: {
  id: string;
  name?: string;
  email?: string;
  contact?: string;
  directorName?: string;
  hqProductLine?: string | null;
  interestedModules?: string[];
  tenantDbName?: string | null;
}): ProvisionTenantFormData {
  const line: TenantProductLine =
    String(company.hqProductLine || '').toLowerCase() === 'recruitment' ||
    (company.interestedModules || []).some((m) => /recruit/i.test(String(m)))
      ? 'recruitment'
      : 'crm';
  const contactName = company.directorName || company.contact || company.name || '';
  const loginSeed = String(company.email || company.name || 'admin')
    .split('@')[0]
    .replace(/[^a-zA-Z0-9_]/g, '_')
    .toLowerCase()
    .slice(0, 24);
  return emptyProvisionTenantForm({
    source: 'company',
    companyId: company.id,
    name: contactName || company.name || '',
    email: company.email || '',
    loginId: loginSeed ? `${loginSeed}_admin` : '',
    productLine: line,
    enabledModules: defaultModulesForProductLine(line),
    planName: 'Starter',
    billingCycle: 'monthly',
    maxUsers: '5',
    maxJobs: '25',
    customPrice: '149',
    coins: '100',
  });
}

type ProvisionTenantFormFieldsProps = {
  data: ProvisionTenantFormData;
  onChange: (next: ProvisionTenantFormData) => void;
  orgTypeName?: string;
  companies?: HqCompanyApiRow[];
  companiesLoading?: boolean;
  /** When true, company is locked (opened from a company drawer). */
  lockCompany?: boolean;
};

export function ProvisionTenantFormFields({
  data,
  onChange,
  orgTypeName = 'orgType',
  companies = [],
  companiesLoading = false,
  lockCompany = false,
}: ProvisionTenantFormFieldsProps) {
  const moduleCatalog = useMemo(
    () => (data.productLine === 'recruitment' ? RECRUITMENT_TENANT_MODULES : CRM_TENANT_MODULES),
    [data.productLine],
  );

  const availableCompanies = useMemo(
    () => companies.filter((c) => !c.tenantDbName),
    [companies],
  );

  const setProductLine = (line: TenantProductLine) => {
    onChange({
      ...data,
      productLine: line,
      enabledModules: defaultModulesForProductLine(line),
    });
  };

  const toggleModule = (id: string) => {
    const has = data.enabledModules.includes(id);
    onChange({
      ...data,
      enabledModules: has
        ? data.enabledModules.filter((m) => m !== id)
        : [...data.enabledModules, id],
    });
  };

  const selectAllModules = () => {
    onChange({ ...data, enabledModules: moduleCatalog.map((m) => m.id) });
  };

  const clearModules = () => {
    onChange({ ...data, enabledModules: [] });
  };

  const applyCompany = (companyId: string) => {
    const company = companies.find((c) => c.id === companyId);
    if (!company) {
      onChange({ ...data, companyId: '', source: 'company' });
      return;
    }
    onChange(provisionFormFromCompany(company));
  };

  return (
    <div className="space-y-5">
      <div className="space-y-3 rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50/50 via-white to-slate-50 p-4">
        <div>
          <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Create from
          </label>
          <p className="mt-1 text-[11px] text-slate-500">
            Funnel: Lead → Client → Company → Tenant. Or create a workspace manually.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={lockCompany}
            onClick={() => onChange({ ...data, source: 'company' })}
            className={`rounded-xl border px-3 py-3 text-left transition ${
              data.source === 'company'
                ? 'border-emerald-300 bg-emerald-50 ring-2 ring-emerald-400/20'
                : 'border-slate-200 bg-white hover:border-emerald-200'
            } disabled:opacity-60`}
          >
            <p className="text-sm font-bold text-slate-900">From company</p>
            <p className="mt-0.5 text-[11px] text-slate-500">Use an HQ company record</p>
          </button>
          <button
            type="button"
            disabled={lockCompany}
            onClick={() =>
              onChange({
                ...data,
                source: 'manual',
                companyId: '',
              })
            }
            className={`rounded-xl border px-3 py-3 text-left transition ${
              data.source === 'manual'
                ? 'border-sky-300 bg-sky-50 ring-2 ring-sky-400/20'
                : 'border-slate-200 bg-white hover:border-sky-200'
            } disabled:opacity-60`}
          >
            <p className="text-sm font-bold text-slate-900">Manual</p>
            <p className="mt-0.5 text-[11px] text-slate-500">Enter details yourself</p>
          </button>
        </div>

        {data.source === 'company' ? (
          <div className="space-y-2">
            <label className="ml-1 text-xs font-bold uppercase tracking-wider text-slate-500">
              HQ company *
            </label>
            <select
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100 disabled:bg-slate-50"
              value={data.companyId}
              disabled={lockCompany || companiesLoading}
              onChange={(e) => applyCompany(e.target.value)}
            >
              <option value="">
                {companiesLoading ? 'Loading companies…' : 'Select company…'}
              </option>
              {availableCompanies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.email ? ` · ${c.email}` : ''}
                </option>
              ))}
              {/* Keep selected company visible even if already provisioned (edit edge). */}
              {data.companyId &&
              !availableCompanies.some((c) => c.id === data.companyId) ? (
                <option value={data.companyId}>
                  {companies.find((c) => c.id === data.companyId)?.name || 'Selected company'}
                </option>
              ) : null}
            </select>
            {availableCompanies.length === 0 && !companiesLoading ? (
              <p className="text-xs text-amber-700">
                No companies without a tenant yet. Convert a lead to a client/company first, or
                create manually.
              </p>
            ) : null}
          </div>
        ) : null}
      </div>

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

      <div className="space-y-3 rounded-2xl border border-indigo-100 bg-gradient-to-br from-slate-50 via-white to-indigo-50/40 p-4">
        <div className="flex items-center justify-between gap-2">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Product line
          </label>
          <span className="text-[10px] font-medium text-slate-400">Phase 2 sidebar modules</span>
        </div>

        <div className="relative">
          <Building2
            className={`pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 ${
              data.productLine === 'recruitment' ? 'text-amber-500' : 'text-sky-500'
            }`}
          />
          <select
            value={data.productLine}
            onChange={(e) => setProductLine(e.target.value as TenantProductLine)}
            className="w-full appearance-none rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-sky-300 focus:ring-2 focus:ring-sky-100"
            aria-label="Select CRM or Recruitment"
          >
            <option value="crm">CRM</option>
            <option value="recruitment">Recruitment</option>
          </select>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setProductLine('crm')}
            className={`rounded-xl border px-3 py-3 text-left transition ${
              data.productLine === 'crm'
                ? 'border-sky-300 bg-sky-50 ring-2 ring-sky-400/20'
                : 'border-slate-200 bg-white hover:border-sky-200'
            }`}
          >
            <p className="text-sm font-bold text-slate-900">CRM</p>
            <p className="mt-0.5 text-[11px] text-slate-500">Leads, clients, CRM dashboard…</p>
          </button>
          <button
            type="button"
            onClick={() => setProductLine('recruitment')}
            className={`rounded-xl border px-3 py-3 text-left transition ${
              data.productLine === 'recruitment'
                ? 'border-amber-300 bg-amber-50 ring-2 ring-amber-400/20'
                : 'border-slate-200 bg-white hover:border-amber-200'
            }`}
          >
            <p className="text-sm font-bold text-slate-900">Recruitment</p>
            <p className="mt-0.5 text-[11px] text-slate-500">Jobs, candidates, placements…</p>
          </button>
        </div>

        <div className="flex items-center justify-between gap-2 pt-1">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
            {data.productLine === 'recruitment' ? 'Recruitment tabs' : 'CRM tabs'}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={selectAllModules}
              className="text-[11px] font-semibold text-sky-700 hover:underline"
            >
              Select all
            </button>
            <button
              type="button"
              onClick={clearModules}
              className="text-[11px] font-semibold text-slate-500 hover:underline"
            >
              Clear
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {moduleCatalog.map((mod) => {
            const Icon = mod.icon;
            const checked = data.enabledModules.includes(mod.id);
            return (
              <label
                key={mod.id}
                className={`flex cursor-pointer items-center gap-2.5 rounded-xl border px-3 py-2.5 transition ${
                  checked
                    ? 'border-indigo-300 bg-indigo-50/70'
                    : 'border-slate-200 bg-white hover:border-indigo-200'
                }`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleModule(mod.id)}
                  className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                    checked ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  <Icon className="h-4 w-4" strokeWidth={2.2} />
                </span>
                <span className="text-sm font-semibold text-slate-800">{mod.label}</span>
              </label>
            );
          })}
        </div>
        {data.enabledModules.length === 0 ? (
          <p className="text-xs text-amber-700">Select at least one tab for this product line.</p>
        ) : (
          <p className="text-[11px] text-slate-500">
            {data.enabledModules.length} tab{data.enabledModules.length === 1 ? '' : 's'} selected
            for {data.productLine === 'recruitment' ? 'Recruitment' : 'CRM'}.
          </p>
        )}
      </div>

      {/* ── Pricing & Limits ── */}
      <div className="space-y-3 rounded-2xl border border-amber-100 bg-gradient-to-br from-amber-50/40 via-white to-orange-50/30 p-4">
        <div>
          <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Pricing & plan
          </label>
          <p className="mt-1 text-[11px] text-slate-500">
            Choose a plan, billing cycle, and set user/job limits for this tenant.
          </p>
        </div>

        {/* Plan cards */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {(['Starter', 'Professional', 'Enterprise', 'Custom'] as TenantPlanName[]).map((plan) => {
            const preset = PLAN_PRESETS[plan];
            const active = data.planName === plan;
            return (
              <button
                key={plan}
                type="button"
                onClick={() => {
                  const price = data.billingCycle === 'annual' ? preset.yearlyPrice : preset.price;
                  onChange({
                    ...data,
                    planName: plan,
                    maxUsers: preset.maxUsers,
                    maxJobs: preset.maxJobs,
                    customPrice: price,
                    coins: preset.coins,
                  });
                }}
                className={`rounded-xl border px-3 py-3 text-left transition ${
                  active
                    ? 'border-amber-300 bg-amber-50 ring-2 ring-amber-400/20'
                    : 'border-slate-200 bg-white hover:border-amber-200'
                }`}
              >
                <p className="text-sm font-bold text-slate-900">{plan}</p>
                {plan !== 'Custom' ? (
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    ${data.billingCycle === 'annual' ? preset.yearlyPrice : preset.price}/mo
                  </p>
                ) : (
                  <p className="mt-0.5 text-[11px] text-slate-500">Set your own</p>
                )}
              </button>
            );
          })}
        </div>

        {/* Billing cycle */}
        <div className="space-y-1.5">
          <label className="ml-1 text-xs font-bold uppercase tracking-wider text-slate-500">
            Billing cycle
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                const preset = PLAN_PRESETS[data.planName];
                onChange({
                  ...data,
                  billingCycle: 'monthly',
                  customPrice: preset.price || data.customPrice,
                  planEndDate: defaultPlanEndDate(data.planStartDate, 'monthly'),
                });
              }}
              className={`rounded-xl border px-3 py-2.5 text-left transition ${
                data.billingCycle === 'monthly'
                  ? 'border-amber-300 bg-amber-50 ring-2 ring-amber-400/20'
                  : 'border-slate-200 bg-white hover:border-amber-200'
              }`}
            >
              <p className="text-sm font-bold text-slate-900">Monthly</p>
              <p className="text-[11px] text-slate-500">Billed every month</p>
            </button>
            <button
              type="button"
              onClick={() => {
                const preset = PLAN_PRESETS[data.planName];
                onChange({
                  ...data,
                  billingCycle: 'annual',
                  customPrice: preset.yearlyPrice || data.customPrice,
                  planEndDate: defaultPlanEndDate(data.planStartDate, 'annual'),
                });
              }}
              className={`rounded-xl border px-3 py-2.5 text-left transition ${
                data.billingCycle === 'annual'
                  ? 'border-emerald-300 bg-emerald-50 ring-2 ring-emerald-400/20'
                  : 'border-slate-200 bg-white hover:border-emerald-200'
              }`}
            >
              <p className="text-sm font-bold text-slate-900">Annual</p>
              <p className="text-[11px] text-emerald-700">Save ~20%</p>
            </button>
          </div>
        </div>

        {/* Price, Users, Jobs, Coins */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div>
            <label className="ml-1 mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">
              Price ($/mo)
            </label>
            <input
              type="text"
              value={data.customPrice}
              onChange={(e) => onChange({ ...data, customPrice: e.target.value })}
              placeholder="e.g. 149"
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-amber-300 focus:ring-2 focus:ring-amber-100"
            />
          </div>
          <div>
            <label className="ml-1 mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">
              Max users
            </label>
            <input
              type="text"
              value={data.maxUsers}
              onChange={(e) => onChange({ ...data, maxUsers: e.target.value })}
              placeholder="Unlimited"
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-amber-300 focus:ring-2 focus:ring-amber-100"
            />
          </div>
          <div>
            <label className="ml-1 mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">
              Max job posts
            </label>
            <input
              type="text"
              value={data.maxJobs}
              onChange={(e) => onChange({ ...data, maxJobs: e.target.value })}
              placeholder="Unlimited"
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-amber-300 focus:ring-2 focus:ring-amber-100"
            />
          </div>
          <div>
            <label className="ml-1 mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">
              AI coins
            </label>
            <input
              type="text"
              value={data.coins}
              onChange={(e) => onChange({ ...data, coins: e.target.value })}
              placeholder="For Phase 2 AI features"
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-amber-300 focus:ring-2 focus:ring-amber-100"
            />
          </div>
        </div>

        {/* Plan start / end dates */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="ml-1 mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">
              Plan start date
            </label>
            <input
              type="date"
              value={data.planStartDate}
              onChange={(e) => {
                const planStartDate = e.target.value;
                onChange({
                  ...data,
                  planStartDate,
                  planEndDate: defaultPlanEndDate(planStartDate, data.billingCycle),
                });
              }}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-amber-300 focus:ring-2 focus:ring-amber-100"
            />
          </div>
          <div>
            <label className="ml-1 mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">
              Plan end date
            </label>
            <input
              type="date"
              value={data.planEndDate}
              min={data.planStartDate || undefined}
              onChange={(e) => onChange({ ...data, planEndDate: e.target.value })}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-amber-300 focus:ring-2 focus:ring-amber-100"
            />
          </div>
        </div>

        <p className="text-[11px] text-slate-500">
          {data.planName !== 'Custom' ? (
            <>
              <span className="font-semibold">{data.planName}</span> plan · ${data.customPrice}/mo · {data.billingCycle} billing
              {data.maxUsers ? ` · ${data.maxUsers} users` : ' · Unlimited users'}
              {data.maxJobs ? ` · ${data.maxJobs} jobs` : ' · Unlimited jobs'}
              {data.coins ? ` · ${data.coins} coins` : ''}
              {data.planStartDate ? ` · ${data.planStartDate}` : ''}
              {data.planEndDate ? ` → ${data.planEndDate}` : ''}
            </>
          ) : (
            <>
              Custom pricing · ${data.customPrice || '—'}/mo · {data.billingCycle}
              {data.coins ? ` · ${data.coins} coins` : ''}
              {data.planStartDate ? ` · ${data.planStartDate}` : ''}
              {data.planEndDate ? ` → ${data.planEndDate}` : ''}
            </>
          )}
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
  /** Prefill / lock to a specific company when opened from Companies. */
  lockCompany?: boolean;
};

export function CreateTenantModal({
  open,
  onClose,
  data,
  onChange,
  onSubmit,
  isLoading,
  lockCompany = false,
}: CreateTenantModalProps) {
  const [companies, setCompanies] = useState<HqCompanyApiRow[]>([]);
  const [companiesLoading, setCompaniesLoading] = useState(false);

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

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setCompaniesLoading(true);
    apiHqListCompanies()
      .then((res) => {
        if (cancelled) return;
        setCompanies(res.data?.companies ?? []);
      })
      .catch(() => {
        if (!cancelled) setCompanies([]);
      })
      .finally(() => {
        if (!cancelled) setCompaniesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  if (!open) return null;

  const canSubmit =
    data.enabledModules.length > 0 &&
    (data.source === 'manual' || Boolean(data.companyId));

  return (
    <div className="fixed inset-0 z-[500]">
      <button
        type="button"
        aria-label="Close drawer backdrop"
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]"
        onClick={() => {
          if (!isLoading) onClose();
        }}
      />

      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-tenant-title"
        className="absolute right-0 top-0 flex h-full w-full max-w-xl flex-col overflow-hidden border-l border-slate-200 bg-white shadow-2xl"
      >
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-100 px-5 py-4 sm:px-6">
          <div>
            <h2 id="create-tenant-title" className="text-xl font-bold text-slate-900">
              Create tenant
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              From an HQ company (Lead → Client → Company) or create manually. Assign pricing later
              on Tenants / Plans.
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

        <form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
            <ProvisionTenantFormFields
              data={data}
              onChange={onChange}
              orgTypeName="createTenantOrgType"
              companies={companies}
              companiesLoading={companiesLoading}
              lockCompany={lockCompany}
            />
          </div>

          <div className="flex shrink-0 flex-col-reverse gap-3 border-t border-slate-100 bg-slate-50/80 px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
            <HqSecondaryButton type="button" onClick={onClose} disabled={isLoading}>
              Cancel
            </HqSecondaryButton>
            <HqPrimaryButton
              type="submit"
              disabled={isLoading || !canSubmit}
              loading={isLoading}
            >
              Create tenant
            </HqPrimaryButton>
          </div>
        </form>
      </aside>
    </div>
  );
}
