'use client';

import { useEffect, useMemo, useState } from 'react';
import { Loader2, Sparkles, Star, X } from 'lucide-react';
import {
  apiActivateJobPostingPremium,
  apiCreateJobPostingPremiumOrder,
  apiGetJobPostingPlan,
  type FreeJobPackOffer,
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

function formatUsd(priceUsd: number, priceLabel?: string) {
  if (priceLabel?.trim()) return priceLabel.trim();
  const n = Number(priceUsd) || 0;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: Number.isInteger(n) ? 0 : 2,
  }).format(n);
}

export function JobPostingPremiumModal({ open, onClose, initialSnapshot, onActivated }: Props) {
  const [snapshot, setSnapshot] = useState<JobPostingQuotaSnapshot | null>(initialSnapshot || null);
  const [packs, setPacks] = useState<FreeJobPackOffer[]>([]);
  const [selectedPackId, setSelectedPackId] = useState<string>('');
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
        const nextPacks =
          res.data?.packs ||
          res.data?.offer?.packs ||
          [];
        setPacks(nextPacks);
        const popular = nextPacks.find((p) => p.popular) || nextPacks[0];
        setSelectedPackId(popular?.id || '');
      })
      .catch(() => {
        /* keep initial */
      });
  }, [open, initialSnapshot]);

  const selectedPack = useMemo(
    () => packs.find((p) => p.id === selectedPackId) || null,
    [packs, selectedPackId],
  );

  if (!open) return null;

  const used = snapshot?.used ?? 0;
  const limit = snapshot?.limit ?? 10;
  const premiumLimit = selectedPack?.monthlyLimit ?? snapshot?.premiumLimit ?? 50;
  const monthlyPaise = snapshot?.pricing?.monthlyPaise ?? 99900;
  const yearlyPaise = snapshot?.pricing?.yearlyPaise ?? 999000;
  const legacyAmountPaise = cycle === 'annual' ? yearlyPaise : monthlyPaise;
  const usePacks = packs.length > 0;

  const finishActivation = async (body: {
    billingCycle?: BillingCycle;
    packId?: string;
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
      if (usePacks && !selectedPackId) {
        throw new Error('Select a pack to continue');
      }
      const orderRes = await apiCreateJobPostingPremiumOrder(
        usePacks ? { packId: selectedPackId } : { billingCycle: cycle },
      );
      const order = orderRes.data;
      if (!order?.orderId) throw new Error('Could not start checkout');

      if (order.mode === 'live' && order.keyId) {
        await openRazorpayCheckout({
          keyId: order.keyId,
          orderId: order.orderId,
          amount: Number(order.amountPaise || order.amount),
          currency: order.currency || 'INR',
          merchantName: order.merchantName || 'HRYANTRA',
          description:
            order.description ||
            (selectedPack
              ? `Free Jobs: ${selectedPack.name}`
              : 'Premium Job Posting'),
          merchantUpi: order.merchantUpi,
          prefill: readCurrentUserPrefill(),
          onSuccess: async (response) => {
            await finishActivation({
              ...(usePacks ? { packId: selectedPackId } : { billingCycle: cycle }),
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
              Free Jobs upgrade
            </div>
            <p className="mt-2 text-lg font-bold leading-snug">
              You have used {used} of {limit} free job posts this month.
            </p>
            <p className="mt-1 text-sm text-slate-300">
              {usePacks
                ? 'Pick a pack from HQ and pay with Razorpay to unlock more posts.'
                : `Upgrade to publish up to ${premiumLimit} jobs per calendar month.`}
            </p>
          </div>

          <div className="space-y-4 px-6 py-5">
            {usePacks ? (
              <div className="space-y-2">
                {packs.map((pack) => {
                  const selected = pack.id === selectedPackId;
                  return (
                    <button
                      key={pack.id}
                      type="button"
                      onClick={() => setSelectedPackId(pack.id)}
                      className={`w-full rounded-xl border px-4 py-3 text-left transition ${
                        selected
                          ? 'border-slate-900 bg-slate-900 text-white shadow-sm'
                          : 'border-slate-200 bg-slate-50 text-slate-800 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold">{pack.name}</span>
                            {pack.popular ? (
                              <span
                                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                                  selected
                                    ? 'bg-amber-300/20 text-amber-100'
                                    : 'bg-sky-100 text-sky-800'
                                }`}
                              >
                                <Star className="h-2.5 w-2.5" />
                                Popular
                              </span>
                            ) : null}
                          </div>
                          <p className={`mt-1 text-xs ${selected ? 'text-slate-300' : 'text-slate-500'}`}>
                            {pack.monthlyLimit} posts / month · {pack.durationDays} days
                            {pack.description ? ` · ${pack.description}` : ''}
                          </p>
                        </div>
                        <span className="shrink-0 text-sm font-bold">
                          {formatUsd(pack.priceUsd, pack.priceLabel)}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <>
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
                  <p className="text-2xl font-bold text-slate-900">
                    {formatInrFromPaise(legacyAmountPaise)}
                  </p>
                  <p className="text-xs text-slate-500">
                    / {cycle === 'annual' ? 'year' : 'month'} · {premiumLimit} posts / month
                  </p>
                </div>
              </>
            )}

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
                disabled={paying || (usePacks && !selectedPackId)}
                onClick={() => void startCheckout()}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
              >
                {paying ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {paying ? 'Opening…' : 'Pay with Razorpay'}
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
            ...(usePacks ? { packId: selectedPackId } : { billingCycle: cycle }),
            paymentReference: `pay_clone_${order.orderId}_${Date.now()}`,
          });
          setCheckoutOrder(null);
        }}
      />
    </>
  );
}
