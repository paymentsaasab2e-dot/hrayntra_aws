'use client';

import { useState } from 'react';
import { Check, Copy, Link2, Loader2 } from 'lucide-react';
import {
  apiHqCreateCompanyPaymentLink,
  apiHqMarkCompanyProvisionPaid,
  type HqCompanyApiRow,
} from '@/lib/api';
import { toast } from 'sonner';

type Props = {
  company: HqCompanyApiRow;
  onUpdated: (company: HqCompanyApiRow) => void;
  compact?: boolean;
};

export function CompanyProvisionPaymentActions({ company, onUpdated, compact }: Props) {
  const [busy, setBusy] = useState<'link' | 'paid' | null>(null);
  const payment = company.provisionPayment;
  const draft = company.provisionDraft;
  const paid = payment?.status === 'paid';
  const linkSent = payment?.status === 'link_sent';

  const packageLabel =
    payment?.packageName ||
    draft?.planName ||
    'Package';
  const cycle = payment?.billingCycle || draft?.billingCycle || 'monthly';
  const amountLabel = payment?.amountInr
    ? `₹${payment.amountInr}`
    : payment?.amountUsd != null
      ? `$${payment.amountUsd}`
      : draft?.customPrice
        ? `$${draft.customPrice}`
        : '—';

  const generateLink = async () => {
    setBusy('link');
    try {
      const res = await apiHqCreateCompanyPaymentLink(company.id);
      if (res.data?.company) onUpdated(res.data.company);
      const url = res.data?.payment?.paymentLinkUrl;
      if (url && !String(url).includes('razorpay.local')) {
        try {
          await navigator.clipboard.writeText(url);
          toast.success('Payment link created and copied');
        } catch {
          toast.success('Payment link created');
        }
      } else {
        toast.success(
          res.data?.alreadyPaid
            ? 'Already paid'
            : 'Payment link ready (clone mode — Mark as paid after collecting payment)',
        );
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to create payment link');
    } finally {
      setBusy(null);
    }
  };

  const markPaid = async () => {
    setBusy('paid');
    try {
      const res = await apiHqMarkCompanyProvisionPaid(company.id);
      if (res.data?.company) onUpdated(res.data.company);
      toast.success('Marked as paid — Approve is now unlocked');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to mark paid');
    } finally {
      setBusy(null);
    }
  };

  const copyLink = async () => {
    const url = payment?.paymentLinkUrl;
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Payment link copied');
    } catch {
      toast.error('Could not copy link');
    }
  };

  if (compact) {
    return (
      <div className="flex flex-wrap items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
        {!paid ? (
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => void generateLink()}
            className="rounded-lg border border-sky-300 bg-sky-50 px-2 py-1 text-[11px] font-bold text-sky-800 hover:bg-sky-100 disabled:opacity-60"
            title="Generate Razorpay payment link for selected package"
          >
            {busy === 'link' ? '…' : linkSent ? 'Resend link' : 'Pay link'}
          </button>
        ) : null}
        {!paid ? (
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => void markPaid()}
            className="rounded-lg border border-amber-300 bg-amber-50 px-2 py-1 text-[11px] font-bold text-amber-900 hover:bg-amber-100 disabled:opacity-60"
            title="Mark package payment as paid"
          >
            {busy === 'paid' ? '…' : 'Mark paid'}
          </button>
        ) : (
          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-700 ring-1 ring-emerald-200">
            Paid
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3 text-sm">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Package payment</p>
      <p className="mt-1 font-semibold text-slate-900">
        {packageLabel} · {cycle} · {amountLabel}
      </p>
      <p className="mt-0.5 text-xs text-slate-500">
        {paid
          ? 'Paid — Approve to create the tenant login.'
          : linkSent
            ? 'Awaiting payment — send the link to the client, then Approve after Paid.'
            : 'Generate a payment link for this package, then Approve after the client pays.'}
      </p>
      {payment?.paymentLinkUrl && !paid ? (
        <div className="mt-2 flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2 py-1.5">
          <Link2 className="h-3.5 w-3.5 shrink-0 text-slate-400" />
          <a
            href={payment.paymentLinkUrl.startsWith('http') ? payment.paymentLinkUrl : undefined}
            target="_blank"
            rel="noreferrer"
            className="min-w-0 flex-1 truncate text-xs text-sky-700 hover:underline"
          >
            {payment.paymentLinkUrl}
          </a>
          <button type="button" onClick={() => void copyLink()} className="rounded p-1 text-slate-500 hover:bg-slate-100">
            <Copy className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : null}
      {payment?.note ? <p className="mt-2 text-[11px] text-amber-800">{payment.note}</p> : null}
      <div className="mt-3 flex flex-wrap gap-2">
        {!paid ? (
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => void generateLink()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-700 disabled:opacity-60"
          >
            {busy === 'link' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Link2 className="h-3.5 w-3.5" />}
            {linkSent ? 'Regenerate link' : 'Generate payment link'}
          </button>
        ) : null}
        {!paid ? (
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => void markPaid()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-900 hover:bg-amber-100 disabled:opacity-60"
          >
            {busy === 'paid' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
            Mark as paid
          </button>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-800">
            <Check className="h-3.5 w-3.5" />
            Paid
            {payment?.paidAt ? ` · ${new Date(payment.paidAt).toLocaleString()}` : ''}
          </span>
        )}
      </div>
    </div>
  );
}

export function isCompanyProvisionPaid(company: HqCompanyApiRow | null | undefined) {
  return company?.provisionPayment?.status === 'paid';
}
