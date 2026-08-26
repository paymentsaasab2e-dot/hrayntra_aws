'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CreditCard, Info, RefreshCcw } from 'lucide-react';
import {
  apiGetSubscriptionPlan,
  getCachedOrgDefaultCurrency,
  type HqSubscriptionPackage,
  type HqTenantSubscriptionPlan,
  type SubscriptionPlanOption,
} from '@/lib/api';
import { PackageUpgradeSection } from '@/components/billing/PackageUpgradeSection';
import type { BillingCycle } from '@/components/hq/hqPackagePresentation';
import {
  findPackageForPlan,
  formatBillingCycleLabel,
  getDisplayedPrice,
  getPackagePresentation,
  subscriptionPackagesWithPricing,
} from '@/components/hq/hqPackagePresentation';
import { formatDateDMY } from '@/utils/dateDisplay';
import { formatCurrencyAmount } from '@/utils/currency';
import { SettingsPageHero, SettingsPanel } from '@/components/settings/SettingsPageHero';

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
  const [upgradePackages, setUpgradePackages] = useState<HqSubscriptionPackage[]>([]);
  const [upgradeMessage, setUpgradeMessage] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await apiGetSubscriptionPlan();
      setPlan((res.data?.plan as HqTenantSubscriptionPlan | null) ?? null);
      setUsage((res.data?.planUsage as PlanUsage | null) ?? null);
      setPlanOptions(Array.isArray(res.data?.options) ? res.data.options : []);
      setUpgradePackages(Array.isArray(res.data?.upgradeOptions?.upgradePackages) ? res.data.upgradeOptions.upgradePackages : []);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load subscription details';
      setError(message);
      setPlan(null);
      setUsage(null);
      setPlanOptions([]);
      setUpgradePackages([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') void load();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
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

  const handleUpgrade = useCallback(
    async (pkg: HqSubscriptionPackage, cycle: BillingCycle) => {
      setUpgradeMessage('');
      await load();
      setUpgradeMessage(`Upgraded to ${pkg.displayName || pkg.name}. Your user and job limits have been increased.`);
    },
    [load],
  );

  return (
    <div className="space-y-6">
      <SettingsPageHero
        eyebrow="Subscription"
        title="Subscription & plan"
        description="Review your package, usage limits, and upgrade options when you need more capacity."
        icon={<CreditCard className="h-3.5 w-3.5 text-indigo-200" />}
        actions={
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl border border-indigo-100 bg-white px-3 py-2 text-xs font-semibold text-indigo-700 shadow-sm transition hover:bg-indigo-50 disabled:opacity-50"
          >
            <RefreshCcw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        }
        stats={
          !loading && plan ? (
            <span
              className={`rounded-full border px-3 py-1.5 text-xs font-bold ${
                status.tone === 'expired'
                  ? 'border-rose-200 bg-rose-50 text-rose-700'
                  : 'border-emerald-200 bg-emerald-50 text-emerald-700'
              }`}
            >
              {status.label}
            </span>
          ) : null
        }
      />

      {loading ? (
        <div className="h-64 animate-pulse rounded-3xl border border-slate-200 bg-slate-100" />
      ) : error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          {error}
        </div>
      ) : (
        <>
          <section className="overflow-hidden rounded-xl border border-indigo-500/30 bg-gradient-to-br from-blue-600 via-indigo-600 to-violet-700 text-white shadow-[0_12px_40px_-18px_rgba(79,70,229,0.45)]">
            <div className="flex flex-col gap-4 p-6 md:flex-row md:items-start md:justify-between lg:p-7">
              <div>
                <p className="text-sm text-indigo-100/80">Current package</p>
                <h3 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
                  {plan?.name || 'Unassigned'}
                </h3>
                {planPricing ? (
                  <div className="mt-3 flex flex-wrap items-end gap-x-2 gap-y-1">
                    <span className="text-3xl font-bold text-white">{planPricing.amountLabel}</span>
                    <span className="pb-1 text-sm text-indigo-100">/ {planPricing.periodLabel}</span>
                  </div>
                ) : null}
                {planPricing?.alternateLabel ? (
                  <p className="mt-1 text-xs text-indigo-100/80">{planPricing.alternateLabel}</p>
                ) : null}
                <p className="mt-2 text-sm text-indigo-100">
                  Billing: {formatBillingCycleLabel(plan?.billingCycle)}
                  {plan?.planStartDate ? ` · Started ${formatDateDMY(plan.planStartDate)}` : ''}
                  {plan?.planEndDate ? ` · Ends ${formatDateDMY(plan.planEndDate)}` : ''}
                </p>
                {plan?.upgradedAt ? (
                  <p className="mt-2 text-xs text-emerald-200">
                    Upgraded from {plan.upgradedFrom || 'previous plan'} on{' '}
                    {formatDateDMY(plan.upgradedAt.slice(0, 10))}
                  </p>
                ) : null}
              </div>
            </div>
          </section>

          <SettingsPanel title="Plan details" description="Limits and billing dates for your current package.">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
          </SettingsPanel>

          {usage ? (
            <SettingsPanel title="Usage" description="Live seat and job consumption against your package caps.">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
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
                        className="h-full rounded-full bg-indigo-500 transition-all"
                        style={{ width: `${usersPct}%` }}
                      />
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500">No user cap on this package.</p>
                  )}
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
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
                        className="h-full rounded-full bg-indigo-500 transition-all"
                        style={{ width: `${jobsPct}%` }}
                      />
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500">No job cap on this package.</p>
                  )}
                </div>
              </div>
            </SettingsPanel>
          ) : null}

          {upgradeMessage ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              {upgradeMessage}
            </div>
          ) : null}

          <PackageUpgradeSection
            currentPlan={plan}
            upgradePackages={upgradePackages}
            billingCycle={billingCycle}
            currency={currency}
            onUpgrade={handleUpgrade}
          />

          <div className="flex items-start gap-2 rounded-2xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-xs text-indigo-900">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-indigo-600" />
            <p>
              Commission, tax, invoice prefix, and payment terms are managed in the Billing module when
              placement invoicing is enabled for your organization.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
