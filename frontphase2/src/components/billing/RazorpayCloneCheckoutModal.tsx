'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Copy,
  CreditCard,
  Landmark,
  Loader2,
  ShieldCheck,
  Smartphone,
  Wallet,
  X,
} from 'lucide-react';
import type { SubscriptionPaymentOrder } from '@/lib/api';

type PaymentMethod = 'upi' | 'card' | 'netbanking' | 'wallet';

type Props = {
  open: boolean;
  order: SubscriptionPaymentOrder | null;
  onClose: () => void;
  onConfirmPaid: (order: SubscriptionPaymentOrder) => Promise<void>;
};

function formatInr(amountInr: string | number | undefined) {
  const num = Number(amountInr);
  if (!Number.isFinite(num)) return '₹0';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(num);
}

function qrImageUrl(upiPayLink: string) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=8&data=${encodeURIComponent(upiPayLink)}`;
}

export function RazorpayCloneCheckoutModal({ open, order, onClose, onConfirmPaid }: Props) {
  const [method, setMethod] = useState<PaymentMethod>('upi');
  const [secondsLeft, setSecondsLeft] = useState(15 * 60);
  const [copied, setCopied] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) {
      setMethod('upi');
      setSecondsLeft(15 * 60);
      setCopied(false);
      setConfirming(false);
      setSuccess(false);
      setError('');
    }
  }, [open]);

  useEffect(() => {
    if (!open || success) return;
    const timer = window.setInterval(() => {
      setSecondsLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [open, success]);

  const timerLabel = useMemo(() => {
    const m = Math.floor(secondsLeft / 60);
    const s = secondsLeft % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }, [secondsLeft]);

  const copyUpi = useCallback(async () => {
    if (!order?.merchantUpi) return;
    try {
      await navigator.clipboard.writeText(order.merchantUpi);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Could not copy UPI ID');
    }
  }, [order?.merchantUpi]);

  const handleConfirm = async () => {
    if (!order) return;
    setError('');
    setConfirming(true);
    try {
      await new Promise((r) => setTimeout(r, 1200));
      await onConfirmPaid(order);
      setSuccess(true);
      await new Promise((r) => setTimeout(r, 800));
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not confirm payment');
    } finally {
      setConfirming(false);
    }
  };

  if (!open || !order) return null;

  const amountLabel = formatInr(order.amountInr);
  const qrUrl = order.upiPayLink ? qrImageUrl(order.upiPayLink) : '';

  return (
    <div className="fixed inset-0 z-[700] flex items-center justify-center p-3 sm:p-4">
      <button type="button" aria-label="Close" className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative flex max-h-[95vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 bg-[#072654] px-4 py-3 text-white sm:px-5">
          <div className="flex items-center gap-2">
            <div className="rounded-md bg-white px-2 py-0.5 text-sm font-black tracking-tight text-[#072654]">Razorpay</div>
            <span className="hidden text-xs text-white/70 sm:inline">Secure Payment</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="rounded-full bg-white/10 px-2.5 py-1 text-xs font-semibold tabular-nums">{timerLabel}</span>
            <button type="button" onClick={onClose} className="rounded-lg p-1.5 hover:bg-white/10">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {success ? (
          <div className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
            <CheckCircle2 className="h-14 w-14 text-emerald-500" />
            <p className="mt-4 text-xl font-bold text-slate-900">Payment received</p>
            <p className="mt-1 text-sm text-slate-500">Upgrading your package…</p>
          </div>
        ) : (
          <div className="grid min-h-0 flex-1 overflow-auto md:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
            <aside className="border-b border-slate-100 bg-[#072654] p-5 text-white md:border-b-0 md:border-r md:border-white/10">
              <p className="text-xs uppercase tracking-wide text-white/60">Paying to</p>
              <p className="mt-1 text-lg font-bold">{order.merchantName}</p>
              <p className="mt-4 text-3xl font-bold tabular-nums">{amountLabel}</p>
              <p className="mt-1 text-sm text-white/70">{order.description}</p>
              <div className="mt-6 space-y-2 rounded-xl bg-white/10 p-4 text-sm">
                <div className="flex justify-between gap-3">
                  <span className="text-white/60">Order ID</span>
                  <span className="truncate font-mono text-xs">{order.orderId}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-white/60">Package</span>
                  <span className="font-medium">{order.packageName}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-white/60">Billing</span>
                  <span className="capitalize">{order.billingCycle}</span>
                </div>
              </div>
              <p className="mt-5 flex items-center gap-2 text-xs text-white/60">
                <ShieldCheck className="h-4 w-4" /> Secured by Razorpay
              </p>
            </aside>

            <section className="p-5">
              <p className="text-sm font-semibold text-slate-900">Payment method</p>

              <div className="mt-3 grid grid-cols-4 gap-2">
                {(
                  [
                    { id: 'upi' as const, label: 'UPI', icon: Smartphone },
                    { id: 'card' as const, label: 'Card', icon: CreditCard },
                    { id: 'netbanking' as const, label: 'Netbanking', icon: Landmark },
                    { id: 'wallet' as const, label: 'Wallet', icon: Wallet },
                  ] as const
                ).map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setMethod(id)}
                    className={`flex flex-col items-center gap-1 rounded-xl border px-2 py-2.5 text-[11px] font-semibold ${
                      method === id
                        ? 'border-[#2b7fff] bg-sky-50 text-[#2b7fff]'
                        : 'border-slate-200 text-slate-600'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {label}
                  </button>
                ))}
              </div>

              {method === 'upi' ? (
                <div className="mt-5">
                  <p className="text-center text-sm font-medium text-slate-700">Scan QR with any UPI app</p>
                  <p className="mt-1 text-center text-xs text-slate-500">Google Pay · PhonePe · Paytm · BHIM</p>

                  <div className="mx-auto mt-4 w-fit rounded-2xl border-2 border-slate-100 bg-white p-3 shadow-inner">
                    {qrUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={qrUrl} alt="UPI QR code" width={240} height={240} className="block rounded-lg" />
                    ) : (
                      <div className="flex h-[240px] w-[240px] items-center justify-center text-sm text-slate-400">QR unavailable</div>
                    )}
                  </div>

                  <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">UPI ID</p>
                    <div className="mt-1 flex items-center justify-between gap-2">
                      <p className="truncate font-mono text-sm font-semibold text-slate-900">{order.merchantUpi}</p>
                      <button
                        type="button"
                        onClick={() => void copyUpi()}
                        className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        <Copy className="h-3.5 w-3.5" />
                        {copied ? 'Copied' : 'Copy'}
                      </button>
                    </div>
                    <p className="mt-2 text-xs text-slate-500">
                      Pay exactly <span className="font-semibold text-slate-800">{amountLabel}</span> to this UPI ID, then
                      confirm below.
                    </p>
                  </div>

                  <button
                    type="button"
                    disabled={confirming || secondsLeft === 0}
                    onClick={() => void handleConfirm()}
                    className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-[#2b7fff] px-4 py-3.5 text-sm font-bold text-white shadow-lg shadow-sky-200 transition hover:bg-[#1a6fe8] disabled:opacity-60"
                  >
                    {confirming ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                    {confirming ? 'Confirming payment…' : 'I have completed UPI payment'}
                  </button>
                </div>
              ) : (
                <div className="mt-8 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center">
                  <p className="text-sm font-semibold text-slate-700">{method === 'card' ? 'Cards' : method === 'netbanking' ? 'Netbanking' : 'Wallets'} — use UPI for now</p>
                  <p className="mt-2 text-xs text-slate-500">
                    Scan the UPI QR or pay to <span className="font-semibold">{order.merchantUpi}</span>. Real Razorpay card/netbanking
                    will activate when API keys are added.
                  </p>
                  <button
                    type="button"
                    onClick={() => setMethod('upi')}
                    className="mt-4 rounded-lg bg-[#072654] px-4 py-2 text-xs font-semibold text-white"
                  >
                    Pay with UPI QR
                  </button>
                </div>
              )}

              {error ? <p className="mt-3 text-sm text-rose-600">{error}</p> : null}

              <p className="mt-4 text-center text-[11px] text-slate-400">
                Razorpay clone checkout · payments go to {order.merchantUpi}
              </p>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
