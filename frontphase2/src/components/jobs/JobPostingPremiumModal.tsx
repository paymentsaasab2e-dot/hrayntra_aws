'use client';

import { useEffect, useState } from 'react';
import { Loader2, Sparkles, X } from 'lucide-react';
import {
  apiActivateJobPostingPremium,
  apiCreateJobPostingPremiumOrder,
  apiGetJobPostingPlan,
  type JobPostingQuotaSnapshot,
} from '@/lib/api';
import { openRazorpayCheckout, readCurrentUserPrefill } from '@/lib/razorpayCheckout';
import { RazorpayCloneCheckoutModal } from '@/components/billing/RazorpayCloneCheckoutModal';
import type { SubscriptionPaymentOrder } from '@/lib/api';
import { emitJobPostingQuotaRefresh } from '@/lib/jobPostingQuotaEvents';

type BillingCycle = 'monthly' | 'annual';

type Props = {
  open: boolean;
  onClose: () => void;
  initialSnapshot?: JobPostingQuotaSnapshot | null;
  onActivated?: (snapshot: JobPostingQuotaSnapshot) => void;
};

function formatInrFromPaise(paise: number) {
  const rupees = Math.round(Number(paise || 0) / 100);
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(rupees);
}

export function JobPostingPremiumModal({ open, onClose, initialSnapshot, onActivated }: Props) {
  const [snapshot, setSnapshot] = useState<JobPostingQuotaSnapshot | null>(initialSnapshot || null);
  const [cycle, setCycle] = useState<BillingCycle>('monthly');
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState('');
  const [checkoutOrder, setCheckoutOrder] = useState<SubscriptionPaymentOrder | null>(null);

  useEffect(() => {
    if (!open) return;
    setError('');
    setSnapshot(initialSnapshot || null);
    void apiGetJobPostingPlan()
      .then((res) => {
        if (res.data?.snapshot) setSnapshot(res.data.snapshot);
      })
      .catch(() => {
        /* keep initial */
      });
  }, [open, initialSnapshot]);

  if (!open) return null;

  const used = snapshot?.used ?? 0;
  const limit = snapshot?.limit ?? 10;
  const premiumLimit = snapshot?.premiumLimit ?? 50;
  const monthlyPaise = snapshot?.pricing?.monthlyPaise ?? 99900;
  const yearlyPaise = snapshot?.pricing?.yearlyPaise ?? 999000;
  const amountPaise = cycle === 'annual' ? yearlyPaise : monthlyPaise;

  const finishActivation = async (body: {
    billingCycle: BillingCycle;
    paymentReference?: string;
    razorpayOrderId?: string;
    razorpayPaymentId?: string;
    razorpaySignature?: string;
  }) => {
    const res = await apiActivateJobPostingPremium(body);
    const next = res.data?.snapshot;
    if (next) {
      setSnapshot(next);
      onActivated?.(next);
    }
    emitJobPostingQuotaRefresh();
    onClose();
  };

  const startCheckout = async () => {
    setError('');
    setPaying(true);
    try {
      const orderRes = await apiCreateJobPostingPremiumOrder({ billingCycle: cycle });
      const order = orderRes.data;
      if (!order?.orderId) throw new Error('Could not start checkout');

      if (order.mode === 'live' && order.keyId) {
        await openRazorpayCheckout({
          keyId: order.keyId,
          orderId: order.orderId,
          amount: Number(order.amountPaise || order.amount),
          currency: order.currency || 'INR',
          merchantName: order.merchantName || 'HRYANTRA',
          description: order.description || 'Premium Job Posting',
          merchantUpi: order.merchantUpi,
          prefill: readCurrentUserPrefill(),
          onSuccess: async (response) => {
            await finishActivation({
              billingCycle: cycle,
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
            });
          },
        });
        return;
      }

      setCheckoutOrder(order);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Payment failed';
      if (message !== 'Payment cancelled') setError(message);
    } finally {
      setPaying(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/45 p-4">
        <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
          <button
            type="button"
            onClick={onClose}
            className="absolute right-3 top-3 rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="bg-gradient-to-br from-slate-900 to-slate-800 px-6 py-5 text-white">
            <div className="inline-flex items-center gap-2 text-sm font-semibold text-amber-200">
              <Sparkles className="h-4 w-4" />
              Premium Job Posting
            </div>
            <p className="mt-2 text-lg font-bold leading-snug">
              You have used {used} of {limit} free job posts this month.
            </p>
            <p className="mt-1 text-sm text-slate-300">
              Upgrade to publish up to {premiumLimit} jobs per calendar month. Applicants stay free.
            </p>
          </div>

          <div className="space-y-4 px-6 py-5">
            <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1 text-xs font-semibold">
              {(['monthly', 'annual'] as BillingCycle[]).map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCycle(c)}
                  className={`rounded-md px-3 py-1.5 capitalize ${
                    cycle === c ? 'bg-slate-900 text-white' : 'text-slate-600'
                  }`}
                >
                  {c === 'annual' ? 'Yearly' : 'Monthly'}
                </button>
              ))}
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-2xl font-bold text-slate-900">{formatInrFromPaise(amountPaise)}</p>
              <p className="text-xs text-slate-500">
                / {cycle === 'annual' ? 'year' : 'month'} · {premiumLimit} posts / month
              </p>
            </div>

            {error ? (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {error}
              </div>
            ) : null}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Maybe later
              </button>
              <button
                type="button"
                disabled={paying}
                onClick={() => void startCheckout()}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
              >
                {paying ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {paying ? 'Opening…' : 'Upgrade to Premium'}
              </button>
            </div>
          </div>
        </div>
      </div>

      <RazorpayCloneCheckoutModal
        open={Boolean(checkoutOrder)}
        order={checkoutOrder}
        onClose={() => setCheckoutOrder(null)}
        onConfirmPaid={async (order) => {
          await finishActivation({
            billingCycle: cycle,
            paymentReference: `pay_clone_${order.orderId}_${Date.now()}`,
          });
          setCheckoutOrder(null);
        }}
      />
    </>
  );
}
