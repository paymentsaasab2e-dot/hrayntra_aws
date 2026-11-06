'use client';

import { useMemo, useState } from 'react';
import { ArrowUpRight, Check, Loader2, Sparkles } from 'lucide-react';
import type { BillingCycle } from '@/components/hq/hqPackagePresentation';
import type { HqSubscriptionPackage, HqTenantSubscriptionPlan, SubscriptionPaymentOrder } from '@/lib/api';
import {
  formatBillingCycleLabel,
  getDisplayedPrice,
  getPackageLimitsForCycle,
  getPackagePresentation,
} from '@/components/hq/hqPackagePresentation';
import { formatCurrencyAmount } from '@/utils/currency';
import {
  apiCreateSubscriptionPaymentOrder,
  apiUpgradeSubscriptionPlan,
} from '@/lib/api';
import { openRazorpayCheckout, readCurrentUserPrefill } from '@/lib/razorpayCheckout';
import { RazorpayCloneCheckoutModal } from './RazorpayCloneCheckoutModal';

type PurchaseMeta = { queued?: boolean; activatesAt?: string | null };

type Props = {
  currentPlan: HqTenantSubscriptionPlan | null;
  /** All HQ packages available to buy (full catalog). */
  packages: HqSubscriptionPackage[];
  /** @deprecated Prefer `packages` — kept for older call sites. */
  upgradePackages?: HqSubscriptionPackage[];
  billingCycle: BillingCycle;
  currency: string;
  onUpgrade: (
    pkg: HqSubscriptionPackage,
    billingCycle: BillingCycle,
    meta?: PurchaseMeta,
  ) => Promise<void>;
};

function isCurrentPeriodActive(plan: HqTenantSubscriptionPlan | null) {
  if (!plan?.planEndDate) return false;
  const kind = String(plan.accountKind || '').toLowerCase();
  if (kind === 'free_jobs' || kind === 'free') return false;
  const end = new Date(`${plan.planEndDate}T23:59:59`);
  return !Number.isNaN(end.getTime()) && end.getTime() >= Date.now();
}

function isSamePlan(current: HqTenantSubscriptionPlan | null, pkg: HqSubscriptionPackage) {
  if (!current || !pkg) return false;
  const curId = String(current.id || '').trim().toLowerCase();
  const pkgId = String(pkg.id || '').trim().toLowerCase();
  const pkgSlug = String(pkg.slug || '').trim().toLowerCase();
  if (curId && (curId === pkgId || curId === pkgSlug)) return true;
  const curName = String(current.name || '').trim().toLowerCase();
  const pkgName = String(pkg.name || pkg.displayName || '').trim().toLowerCase();
  return Boolean(curName && pkgName && curName === pkgName);
}

export function PackageUpgradeSection({
  currentPlan,
  packages,
  upgradePackages,
  billingCycle,
  currency,
  onUpgrade,
}: Props) {
  const catalog = packages?.length ? packages : upgradePackages || [];
  const periodActive = isCurrentPeriodActive(currentPlan);
  const queuedName = currentPlan?.pendingPlan?.name || null;
  const queuedStarts =
    currentPlan?.pendingPlan?.startsAt || currentPlan?.pendingPlan?.planStartDate || null;
  const [selectedCycle, setSelectedCycle] = useState<BillingCycle>(billingCycle);
  const [payingPackageId, setPayingPackageId] = useState<string | null>(null);
  const [checkoutOrder, setCheckoutOrder] = useState<SubscriptionPaymentOrder | null>(null);
  const [checkoutPkg, setCheckoutPkg] = useState<HqSubscriptionPackage | null>(null);
  const [error, setError] = useState('');

  const notifyPurchase = async (pkg: HqSubscriptionPackage, meta?: PurchaseMeta) => {
    await onUpgrade(pkg, selectedCycle, meta);
  };

  const cards = useMemo(
    () =>
      catalog.map((pkg) => {
        const presentation = getPackagePresentation(pkg);
        const displayed = getDisplayedPrice(presentation, selectedCycle);
        const amountNum = Number.parseFloat(String(displayed.amount || '').replace(/,/g, ''));
        const amountLabel = Number.isFinite(amountNum)
          ? formatCurrencyAmount(amountNum, currency, { maximumFractionDigits: 0 })
          : `$${displayed.amount}`;
        const limits = getPackageLimitsForCycle(pkg, selectedCycle);
        const current = isSamePlan(currentPlan, pkg);
        return { pkg, presentation, displayed, amountLabel, limits, current };
      }),
    [catalog, selectedCycle, currency, currentPlan],
  );

  const closeCheckout = () => {
    setCheckoutOrder(null);
    setCheckoutPkg(null);
    setPayingPackageId(null);
  };

  const confirmClonePayment = async (order: SubscriptionPaymentOrder) => {
    if (!checkoutPkg) return;
    const paymentReference = `pay_clone_${order.orderId}_${Date.now()}`;
    const res = await apiUpgradeSubscriptionPlan({
      packageId: checkoutPkg.id,
      billingCycle: selectedCycle,
      paymentReference,
    });
    await notifyPurchase(checkoutPkg, {
      queued: Boolean(res.data?.queued),
      activatesAt: res.data?.activatesAt ?? null,
    });
  };

  const startPurchase = async (pkg: HqSubscriptionPackage) => {
    setError('');
    setPayingPackageId(pkg.id);
    try {
      const orderRes = await apiCreateSubscriptionPaymentOrder({
        packageId: pkg.id,
        billingCycle: selectedCycle,
      });
      const order = orderRes.data;
      if (!order?.orderId) {
        throw new Error('Could not start checkout');
      }

      if (order.mode === 'live' && order.keyId) {
        await openRazorpayCheckout({
          keyId: order.keyId,
          orderId: order.orderId,
          amount: Number(order.amountPaise || order.amount),
          currency: order.currency || 'INR',
          merchantName: order.merchantName || 'HRYANTRA',
          description: order.description || `Subscribe to ${order.packageName}`,
          merchantUpi: order.merchantUpi,
          prefill: readCurrentUserPrefill(),
          onSuccess: async (response) => {
            const res = await apiUpgradeSubscriptionPlan({
              packageId: pkg.id,
              billingCycle: selectedCycle,
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
            });
            await notifyPurchase(pkg, {
              queued: Boolean(res.data?.queued),
              activatesAt: res.data?.activatesAt ?? null,
            });
          },
        });
        return;
      }

      setCheckoutPkg(pkg);
      setCheckoutOrder(order);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Payment failed';
      if (message !== 'Payment cancelled') {
        setError(message);
      }
    } finally {
      setPayingPackageId(null);
    }
  };

  if (!catalog.length) {
    return (
      <div className="rounded-xl border border-amber-100 bg-amber-50/50 px-4 py-3 text-sm text-amber-900">
        No HQ packages are available to purchase right now. Ask HQ to publish a plan, then refresh this page.
      </div>
    );
  }

  return (
    <>
      <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-2 text-slate-800">
              <Sparkles className="h-4 w-4 text-[#2b7fff]" />
              <p className="text-sm font-bold">Available plans</p>
            </div>
            <p className="mt-1 text-sm text-slate-600">
              {periodActive
                ? 'Your current plan stays active until it ends. Any purchase is queued (like a mobile recharge) and starts the next day after your package end date.'
                : 'All HQ packages are listed here. Buy a new plan or renew with Razorpay — it activates immediately when no active period remains.'}
            </p>
            {queuedName ? (
              <p className="mt-2 text-xs font-medium text-emerald-700">
                Queued: {queuedName}
                {queuedStarts ? ` · starts ${queuedStarts}` : ''}
              </p>
            ) : null}
          </div>
          <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1 text-xs font-semibold">
            {(['monthly', 'annual'] as BillingCycle[]).map((cycle) => (
              <button
                key={cycle}
                type="button"
                onClick={() => setSelectedCycle(cycle)}
                className={`rounded-md px-3 py-1.5 capitalize ${
                  selectedCycle === cycle ? 'bg-[#2b7fff] text-white' : 'text-slate-600'
                }`}
              >
                {formatBillingCycleLabel(cycle)}
              </button>
            ))}
          </div>
        </div>

        {error ? (
          <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
        ) : null}

        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {cards.map(({ pkg, presentation, displayed, amountLabel, limits, current }) => {
            const paying = payingPackageId === pkg.id;
            const ctaLabel = current
              ? periodActive
                ? `Queue renew · ${presentation.displayName}`
                : `Renew · ${presentation.displayName}`
              : periodActive
                ? `Buy for after current · ${presentation.displayName}`
                : `Buy · ${presentation.displayName}`;
            return (
              <article
                key={pkg.id}
                className={`rounded-2xl border bg-white p-5 shadow-sm transition hover:shadow-md ${
                  current
                    ? 'border-emerald-400 ring-2 ring-emerald-100'
                    : presentation.isPopular
                      ? 'border-[#2b7fff] ring-2 ring-[#2b7fff]/15'
                      : 'border-slate-200'
                }`}
              >
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  {current ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-2.5 py-0.5 text-[10px] font-bold uppercase text-white">
                      <Check className="h-3 w-3" />
                      Current plan
                    </span>
                  ) : null}
                  {!current && presentation.isPopular ? (
                    <span className="inline-block rounded-full bg-[#2b7fff] px-2.5 py-0.5 text-[10px] font-bold uppercase text-white">
                      Popular
                    </span>
                  ) : null}
                </div>
                <h4 className="text-lg font-bold text-slate-900">{presentation.displayName}</h4>
                <div className="mt-2 flex items-end gap-2">
                  <span className="text-2xl font-bold text-slate-900">{amountLabel}</span>
                  <span className="pb-0.5 text-xs text-slate-500">/ {displayed.periodLabel}</span>
                </div>
                <ul className="mt-3 space-y-1.5 text-sm text-slate-600">
                  <li>{limits.maxUsers == null ? 'Unlimited team users' : `Up to ${limits.maxUsers} users`}</li>
                  <li>{limits.maxJobs == null ? 'Unlimited active jobs' : `Up to ${limits.maxJobs} active jobs`}</li>
                  {presentation.features.slice(0, 2).map((feature) => (
                    <li key={feature}>• {feature}</li>
                  ))}
                </ul>
                <button
                  type="button"
                  disabled={Boolean(payingPackageId)}
                  onClick={() => void startPurchase(pkg)}
                  className={`mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60 ${
                    current ? 'bg-emerald-700 hover:bg-emerald-800' : 'bg-slate-900 hover:bg-slate-800'
                  }`}
                >
                  {paying ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {paying ? 'Opening checkout…' : ctaLabel}
                  {!paying ? <ArrowUpRight className="h-4 w-4" /> : null}
                </button>
              </article>
            );
          })}
        </div>
      </div>

      <RazorpayCloneCheckoutModal
        open={Boolean(checkoutOrder)}
        order={checkoutOrder}
        onClose={closeCheckout}
        onConfirmPaid={confirmClonePayment}
      />
    </>
  );
}
