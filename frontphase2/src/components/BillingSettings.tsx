'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CreditCard, Info, RefreshCcw } from 'lucide-react';
import {
  apiGetSubscriptionPlan,
  getCachedOrgDefaultCurrency,
  type HqTenantSubscriptionPlan,
  type SubscriptionPlanOption,
} from '@/lib/api';
import {
  findPackageForPlan,
  formatBillingCycleLabel,
  getDisplayedPrice,
  getPackagePresentation,
  subscriptionPackagesWithPricing,
} from '@/components/hq/hqPackagePresentation';
import { formatDateDMY } from '@/utils/dateDisplay';
import { formatCurrencyAmount } from '@/utils/currency';

type PlanUsage = {
  activeJobs: number;
  activeUsers: number;
  maxJobs: number | null;
  maxUsers: number | null;
  jobsRemaining: number | null;
  usersRemaining: number | null;
};

function formatLimit(value: number | null | undefined, unit: string) {
  if (value === null || value === undefined) return `Unlimited ${unit}`;
  return `Up to ${value} ${unit}`;
}

function usagePercent(used: number, max: number | null | undefined) {
  if (max == null || max <= 0) return null;
  return Math.min(100, Math.round((used / max) * 100));
}

function planStatus(plan: HqTenantSubscriptionPlan | null): { label: string; tone: 'active' | 'expired' | 'unknown' } {
  if (!plan?.planEndDate) return { label: 'ACTIVE', tone: 'active' };
  const end = new Date(`${plan.planEndDate}T23:59:59`);
  if (Number.isNaN(end.getTime())) return { label: 'ACTIVE', tone: 'active' };
  if (end.getTime() < Date.now()) return { label: 'EXPIRED', tone: 'expired' };
  return { label: 'ACTIVE', tone: 'active' };
}

function ReadOnlyRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
      <p className="text-sm font-medium text-slate-900">{value || '—'}</p>
    </div>
  );
}

export function BillingSettings() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [plan, setPlan] = useState<HqTenantSubscriptionPlan | null>(null);
  const [usage, setUsage] = useState<PlanUsage | null>(null);
  const [planOptions, setPlanOptions] = useState<SubscriptionPlanOption[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await apiGetSubscriptionPlan();
      setPlan((res.data?.plan as HqTenantSubscriptionPlan | null) ?? null);
      setUsage((res.data?.planUsage as PlanUsage | null) ?? null);
      setPlanOptions(Array.isArray(res.data?.options) ? res.data.options : []);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load subscription details';
      setError(message);
      setPlan(null);
      setUsage(null);
      setPlanOptions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const status = planStatus(plan);
  const jobsPct = usage ? usagePercent(usage.activeJobs, usage.maxJobs) : null;
  const usersPct = usage ? usagePercent(usage.activeUsers, usage.maxUsers) : null;
  const currency = (getCachedOrgDefaultCurrency() || 'USD').toUpperCase();
  const billingCycle = plan?.billingCycle === 'annual' ? 'annual' : 'monthly';
  const pricedPackages = useMemo(
    () => subscriptionPackagesWithPricing(planOptions),
    [planOptions]
  );

  const planPricing = useMemo(() => {
    if (!plan) return null;
    if (plan.isTrial) {
      return {
        amountLabel: 'Free',
        periodLabel: `${plan.trialDays ?? 5}-day trial`,
        alternateLabel: null as string | null,
      };
    }
    const matched = findPackageForPlan(plan, pricedPackages);
    if (!matched) return null;
    const presentation = getPackagePresentation(matched);
    const displayed = getDisplayedPrice(presentation, billingCycle);
    if (!displayed.amount || displayed.amount === '—') return null;
    const amount = Number.parseFloat(displayed.amount.replace(/,/g, ''));
    const amountLabel = Number.isFinite(amount)
      ? formatCurrencyAmount(amount, currency, { maximumFractionDigits: 0 })
      : `$${displayed.amount}`;
    const alternate =
      presentation.monthlyPrice !== '—' && presentation.yearlyPrice !== '—'
        ? billingCycle === 'monthly'
          ? `Annual: ${formatCurrencyAmount(Number.parseFloat(presentation.yearlyPrice) || 0, currency, { maximumFractionDigits: 0 })} / month billed annually`
          : `Monthly: ${formatCurrencyAmount(Number.parseFloat(presentation.monthlyPrice) || 0, currency, { maximumFractionDigits: 0 })} / month`
        : null;
    return {
      amountLabel,
      periodLabel: displayed.periodLabel,
      alternateLabel: alternate,
    };
  }, [plan, pricedPackages, billingCycle, currency]);

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-6">
          <div className="flex items-center gap-3">
            <CreditCard className="h-5 w-5 text-[#2b7fff]" />
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Subscription package</h2>
              <p className="mt-0.5 text-sm text-slate-500">
                Your workspace plan is assigned by HQ. Contact support to change package or billing cycle.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCcw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="p-8 text-center text-sm text-slate-500">Loading subscription details…</div>
        ) : error ? (
          <div className="m-6 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>
        ) : (
          <div className="p-6 space-y-6">
            <div className="rounded-xl border border-slate-900 bg-slate-900 p-6 text-white">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="text-sm text-slate-400">Current package</p>
                  <h3 className="mt-1 text-2xl font-bold">{plan?.name || 'Unassigned'}</h3>
                  {planPricing ? (
                    <div className="mt-3 flex flex-wrap items-end gap-x-2 gap-y-1">
                      <span className="text-3xl font-bold text-white">{planPricing.amountLabel}</span>
                      <span className="pb-1 text-sm text-slate-300">/ {planPricing.periodLabel}</span>
                    </div>
                  ) : null}
                  {planPricing?.alternateLabel ? (
                    <p className="mt-1 text-xs text-slate-400">{planPricing.alternateLabel}</p>
                  ) : null}
                  <p className={`text-sm text-slate-300 ${planPricing ? 'mt-2' : 'mt-2'}`}>
                    Billing: {formatBillingCycleLabel(plan?.billingCycle)}
                    {plan?.planStartDate ? ` · Started ${formatDateDMY(plan.planStartDate)}` : ''}
                    {plan?.planEndDate ? ` · Ends ${formatDateDMY(plan.planEndDate)}` : ''}
                  </p>
                </div>
                <span
                  className={`self-start rounded-full border px-3 py-1 text-xs font-bold ${
                    status.tone === 'expired'
                      ? 'border-rose-400/40 bg-rose-500/20 text-rose-200'
                      : 'border-[#2b7fff]/30 bg-[#2b7fff]/20 text-[#7eb8ff]'
                  }`}
                >
                  {status.label}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              <ReadOnlyRow
                label="Plan cost"
                value={
                  planPricing
                    ? `${planPricing.amountLabel} / ${planPricing.periodLabel}`
                    : plan?.isTrial
                      ? 'Free trial'
                      : '—'
                }
              />
              <ReadOnlyRow label="Billing cycle" value={formatBillingCycleLabel(plan?.billingCycle)} />
              <ReadOnlyRow label="Package start" value={formatDateDMY(plan?.planStartDate)} />
              <ReadOnlyRow label="Package end" value={formatDateDMY(plan?.planEndDate)} />
              <ReadOnlyRow label="User limit" value={formatLimit(plan?.maxUsers, 'users')} />
              <ReadOnlyRow label="Job limit" value={formatLimit(plan?.maxJobs, 'active jobs')} />
            </div>

            {usage ? (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="mb-2 flex items-center justify-between text-sm">
                    <span className="font-medium text-slate-700">Active users</span>
                    <span className="font-semibold text-slate-900">
                      {usage.activeUsers}
                      {usage.maxUsers != null ? ` / ${usage.maxUsers}` : ' (unlimited)'}
                    </span>
                  </div>
                  {usersPct != null ? (
                    <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                      <div
                        className="h-full rounded-full bg-[#2b7fff] transition-all"
                        style={{ width: `${usersPct}%` }}
                      />
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500">No user cap on this package.</p>
                  )}
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="mb-2 flex items-center justify-between text-sm">
                    <span className="font-medium text-slate-700">Active jobs</span>
                    <span className="font-semibold text-slate-900">
                      {usage.activeJobs}
                      {usage.maxJobs != null ? ` / ${usage.maxJobs}` : ' (unlimited)'}
                    </span>
                  </div>
                  {jobsPct != null ? (
                    <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                      <div
                        className="h-full rounded-full bg-[#2b7fff] transition-all"
                        style={{ width: `${jobsPct}%` }}
                      />
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500">No job cap on this package.</p>
                  )}
                </div>
              </div>
            ) : null}

            <div className="flex items-start gap-2 rounded-xl border border-sky-100 bg-sky-50 px-4 py-3 text-xs text-sky-900">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-sky-600" />
              <p>
                Commission, tax, invoice prefix, and payment terms are managed in the Billing module when
                placement invoicing is enabled for your organization.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
