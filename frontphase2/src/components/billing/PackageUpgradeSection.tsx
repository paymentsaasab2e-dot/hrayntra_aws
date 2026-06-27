'use client';

import { useMemo, useState } from 'react';
import { ArrowUpRight, Loader2, Sparkles } from 'lucide-react';
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

type Props = {
  currentPlan: HqTenantSubscriptionPlan | null;
  upgradePackages: HqSubscriptionPackage[];
  billingCycle: BillingCycle;
  currency: string;
  onUpgrade: (pkg: HqSubscriptionPackage, billingCycle: BillingCycle) => Promise<void>;
};

export function PackageUpgradeSection({
  currentPlan,
  upgradePackages,
  billingCycle,
  currency,
  onUpgrade,
}: Props) {
  const [selectedCycle, setSelectedCycle] = useState<BillingCycle>(billingCycle);
  const [payingPackageId, setPayingPackageId] = useState<string | null>(null);
  const [checkoutOrder, setCheckoutOrder] = useState<SubscriptionPaymentOrder | null>(null);
  const [checkoutPkg, setCheckoutPkg] = useState<HqSubscriptionPackage | null>(null);
  const [error, setError] = useState('');

  const cards = useMemo(
    () =>
      upgradePackages.map((pkg) => {
        const presentation = getPackagePresentation(pkg);
        const displayed = getDisplayedPrice(presentation, selectedCycle);
        const amountNum = Number.parseFloat(String(displayed.amount || '').replace(/,/g, ''));
        const amountLabel = Number.isFinite(amountNum)
          ? formatCurrencyAmount(amountNum, currency, { maximumFractionDigits: 0 })
          : `$${displayed.amount}`;
        const limits = getPackageLimitsForCycle(pkg, selectedCycle);
        return { pkg, presentation, displayed, amountLabel, limits };
      }),
    [upgradePackages, selectedCycle, currency],
  );

  const closeCheckout = () => {
    setCheckoutOrder(null);
    setCheckoutPkg(null);
    setPayingPackageId(null);
  };

  const confirmClonePayment = async (order: SubscriptionPaymentOrder) => {
    if (!checkoutPkg) return;
    const paymentReference = `pay_clone_${order.orderId}_${Date.now()}`;
    await apiUpgradeSubscriptionPlan({
      packageId: checkoutPkg.id,
      billingCycle: selectedCycle,
      paymentReference,
    });
    await onUpgrade(checkoutPkg, selectedCycle);
  };

  const startUpgrade = async (pkg: HqSubscriptionPackage) => {
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
          merchantName: order.merchantName || 'Hryantra SAASA',
          description: order.description || `Upgrade to ${order.packageName}`,
          merchantUpi: order.merchantUpi,
          prefill: readCurrentUserPrefill(),
          onSuccess: async (response) => {
            await apiUpgradeSubscriptionPlan({
              packageId: pkg.id,
              billingCycle: selectedCycle,
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
            });
            await onUpgrade(pkg, selectedCycle);
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

  if (!upgradePackages.length) {
    return (
      <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 px-4 py-3 text-sm text-emerald-900">
        You are on the highest available package ({currentPlan?.name || 'Enterprise'}). Contact HQ for custom limits.
      </div>
    );
  }

  return (
    <>
      <div className="rounded-xl border border-violet-100 bg-gradient-to-br from-violet-50/80 to-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-2 text-violet-700">
              <Sparkles className="h-4 w-4" />
              <p className="text-sm font-bold">Upgrade your package</p>
            </div>
            <p className="mt-1 text-sm text-slate-600">
              Pay via UPI QR to <span className="font-semibold text-slate-800">ghodehimanshu453-4@okicici</span>. Real
              Razorpay API activates automatically when keys are added.
            </p>
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

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {cards.map(({ pkg, presentation, displayed, amountLabel, limits }) => {
            const paying = payingPackageId === pkg.id;
            return (
              <article
                key={pkg.id}
                className={`rounded-2xl border bg-white p-5 shadow-sm transition hover:shadow-md ${
                  presentation.isPopular ? 'border-[#2b7fff] ring-2 ring-[#2b7fff]/15' : 'border-slate-200'
                }`}
              >
                {presentation.isPopular ? (
                  <span className="mb-2 inline-block rounded-full bg-[#2b7fff] px-2.5 py-0.5 text-[10px] font-bold uppercase text-white">
                    Recommended
                  </span>
                ) : null}
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
                  onClick={() => void startUpgrade(pkg)}
                  className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
                >
                  {paying ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {paying ? 'Opening checkout…' : `Pay with Razorpay · ${presentation.displayName}`}
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
