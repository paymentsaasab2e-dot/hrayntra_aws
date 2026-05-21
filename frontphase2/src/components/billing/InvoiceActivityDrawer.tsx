'use client';

/**
 * Drawer that opens when a user clicks the "next" arrow on an invoice row.
 *
 * Renders the full chronological journey for the invoice: lead → client →
 * job → candidate → pipeline moves → interviews → placement → invoice →
 * payment, plus any free-form Activity rows tied to those entities.
 *
 * Also surfaces a currency picker. Saving here updates the BillingRecord
 * (and every sibling for the same placement) so the placement-wide revenue
 * chain stays in a single currency — exactly what the user asked for.
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  X,
  Sparkles,
  Building2,
  Briefcase,
  User,
  GitBranch,
  Calendar,
  Award,
  Receipt,
  CreditCard,
  Activity as ActivityIcon,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import {
  apiGetInvoiceActivity,
  apiUpdateBillingRecord,
  apiUpdateInvoiceCurrency,
  type InvoiceActivityEvent,
  type InvoiceActivityResponse,
} from '../../lib/api';
import { usePermissions } from '../../hooks/usePermissions';
import { SUPPORTED_CURRENCIES, formatCurrencyAmount } from '../../utils/currency';
import { formatDateTimeDMY } from '../../utils/dateDisplay';
import { Skeleton } from '../ui/Skeleton';

type Tone = {
  bg: string;
  ring: string;
  icon: string;
};

const KIND_TONE: Record<InvoiceActivityEvent['kind'], Tone> = {
  lead: { bg: 'bg-amber-50', ring: 'ring-amber-200', icon: 'text-amber-600' },
  client: { bg: 'bg-blue-50', ring: 'ring-blue-200', icon: 'text-blue-600' },
  job: { bg: 'bg-indigo-50', ring: 'ring-indigo-200', icon: 'text-indigo-600' },
  candidate: { bg: 'bg-violet-50', ring: 'ring-violet-200', icon: 'text-violet-600' },
  pipeline: { bg: 'bg-cyan-50', ring: 'ring-cyan-200', icon: 'text-cyan-600' },
  interview: { bg: 'bg-purple-50', ring: 'ring-purple-200', icon: 'text-purple-600' },
  placement: { bg: 'bg-emerald-50', ring: 'ring-emerald-200', icon: 'text-emerald-600' },
  invoice: { bg: 'bg-slate-50', ring: 'ring-slate-200', icon: 'text-slate-700' },
  payment: { bg: 'bg-green-50', ring: 'ring-green-200', icon: 'text-green-700' },
  activity: { bg: 'bg-zinc-50', ring: 'ring-zinc-200', icon: 'text-zinc-600' },
};

const KIND_ICON: Record<InvoiceActivityEvent['kind'], React.ComponentType<{ size?: number; className?: string }>> = {
  lead: Sparkles,
  client: Building2,
  job: Briefcase,
  candidate: User,
  pipeline: GitBranch,
  interview: Calendar,
  placement: Award,
  invoice: Receipt,
  payment: CreditCard,
  activity: ActivityIcon,
};

function formatTimestamp(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return formatDateTimeDMY(d);
}

interface Props {
  invoiceId: string | null;
  open: boolean;
  onClose: () => void;
  /** Called after a successful currency save so the parent table can refresh. */
  onCurrencyChanged?: (next: string) => void;
  /** Called after invoice status changes (e.g. marked paid). */
  onStatusChanged?: () => void;
}

export default function InvoiceActivityDrawer({
  invoiceId,
  open,
  onClose,
  onCurrencyChanged,
  onStatusChanged,
}: Props) {
  const { hasPermission } = usePermissions();
  const canRecordPayment = hasPermission('record_payment') || hasPermission('create_invoice');
  const [data, setData] = useState<InvoiceActivityResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [savingCurrency, setSavingCurrency] = useState(false);
  const [savingStatus, setSavingStatus] = useState(false);
  const [currencyDraft, setCurrencyDraft] = useState<string>('');
  const [savedFlash, setSavedFlash] = useState<string>('');

  useEffect(() => {
    if (!open || !invoiceId) return;
    let active = true;
    setLoading(true);
    setError('');
    setData(null);
    setSavedFlash('');
    apiGetInvoiceActivity(invoiceId)
      .then((res) => {
        if (!active) return;
        setData(res.data || null);
        setCurrencyDraft(res.data?.invoice?.currency || 'USD');
      })
      .catch((err: any) => {
        if (!active) return;
        setError(err?.message || 'Could not load invoice activity');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [open, invoiceId]);

  const baseCurrency = data?.invoice?.currency || 'USD';
  const currencyDirty = currencyDraft && currencyDraft !== baseCurrency;

  const canMarkPaid =
    canRecordPayment &&
    data?.invoice &&
    data.invoice.status !== 'Paid' &&
    data.invoice.status !== 'Cancelled';

  const handleMarkPaid = async () => {
    if (!invoiceId || !canMarkPaid) return;
    setSavingStatus(true);
    setError('');
    try {
      await apiUpdateBillingRecord(invoiceId, { status: 'PAID' });
      const res = await apiGetInvoiceActivity(invoiceId);
      setData(res.data || null);
      setSavedFlash('Invoice marked as paid.');
      onStatusChanged?.();
      window.dispatchEvent(new CustomEvent('jobportal:billing-changed'));
      window.dispatchEvent(new CustomEvent('jobportal:placements-changed'));
    } catch (err: any) {
      setError(err?.message || 'Failed to update invoice status');
    } finally {
      setSavingStatus(false);
    }
  };

  const handleSaveCurrency = async () => {
    if (!invoiceId || !currencyDirty) return;
    setSavingCurrency(true);
    setError('');
    try {
      const res = await apiUpdateInvoiceCurrency(invoiceId, currencyDraft);
      const next = res.data?.currency || currencyDraft;
      setData((prev) => (prev ? { ...prev, invoice: { ...prev.invoice, currency: next } } : prev));
      setSavedFlash(
        res.data?.updatedRecords && res.data.updatedRecords > 1
          ? `Currency set to ${next} on ${res.data.updatedRecords} invoice(s) for this placement.`
          : `Currency set to ${next}.`
      );
      onCurrencyChanged?.(next);
    } catch (err: any) {
      setError(err?.message || 'Failed to save currency');
    } finally {
      setSavingCurrency(false);
    }
  };

  const headerSummary = useMemo(() => {
    if (!data?.invoice) return null;
    return formatCurrencyAmount(Number(data.invoice.amount || 0), data.invoice.currency || 'USD');
  }, [data]);

  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-[80] bg-black/50 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        aria-hidden
      />
      <aside
        className="fixed right-0 top-0 z-[81] flex h-full w-3/4 max-w-6xl flex-col border-l border-slate-200 bg-white shadow-2xl"
        role="dialog"
        aria-label="Invoice activity timeline"
      >
        <header className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Invoice activity</p>
            <h2 className="mt-0.5 truncate text-lg font-bold text-slate-900">
              {data?.invoice?.invoiceNumber || (loading ? 'Loading…' : 'Invoice')}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
            aria-label="Close drawer"
          >
            <X size={18} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {error ? (
            <div className="mb-4 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          ) : null}

          {loading && !data ? (
            <div className="space-y-4">
              <Skeleton className="h-20 w-full rounded-xl" />
              <Skeleton className="h-32 w-full rounded-xl" />
              <Skeleton className="h-64 w-full rounded-xl" />
            </div>
          ) : data ? (
            <>
              <section className="mb-5 rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Total</p>
                    <p className="mt-0.5 text-2xl font-black tracking-tight text-slate-900">{headerSummary}</p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span
                      className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
                        data.invoice.status === 'Paid'
                          ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
                          : data.invoice.status === 'Overdue'
                            ? 'bg-rose-50 text-rose-700 ring-1 ring-rose-200'
                            : 'bg-amber-50 text-amber-700 ring-1 ring-amber-200'
                      }`}
                    >
                      {data.invoice.status}
                    </span>
                    {canMarkPaid ? (
                      <button
                        type="button"
                        onClick={handleMarkPaid}
                        disabled={savingStatus}
                        className="rounded-lg bg-emerald-600 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {savingStatus ? 'Saving…' : 'Mark as paid'}
                      </button>
                    ) : null}
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-slate-500">
                  <div>
                    <span className="font-bold uppercase tracking-wider text-slate-400">Issued</span>
                    <div className="text-slate-700">{data.invoice.date || '—'}</div>
                  </div>
                  <div>
                    <span className="font-bold uppercase tracking-wider text-slate-400">Due</span>
                    <div className="text-slate-700">{data.invoice.dueDate || '—'}</div>
                  </div>
                  {data.client?.companyName && (
                    <div>
                      <span className="font-bold uppercase tracking-wider text-slate-400">Client</span>
                      <div className="text-slate-700 truncate">{data.client.companyName}</div>
                    </div>
                  )}
                  {data.candidate?.name && (
                    <div>
                      <span className="font-bold uppercase tracking-wider text-slate-400">Candidate</span>
                      <div className="text-slate-700 truncate">{data.candidate.name}</div>
                    </div>
                  )}
                </div>
              </section>

              <section className="mb-5 rounded-2xl border border-slate-200 bg-white p-4">
                <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  Currency for this placement
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={currencyDraft || baseCurrency}
                    onChange={(e) => setCurrencyDraft(e.target.value)}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 outline-none focus:border-blue-500"
                  >
                    {SUPPORTED_CURRENCIES.map((code) => (
                      <option key={code} value={code}>
                        {code}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={handleSaveCurrency}
                    disabled={!currencyDirty || savingCurrency}
                    className="rounded-lg bg-blue-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {savingCurrency ? 'Saving…' : 'Save & propagate'}
                  </button>
                  {savedFlash ? (
                    <span className="flex items-center gap-1.5 text-[12px] font-medium text-emerald-700">
                      <CheckCircle2 size={14} />
                      {savedFlash}
                    </span>
                  ) : null}
                </div>
                <p className="mt-2 text-[11px] text-slate-500">
                  Saving applies the new currency to every invoice for this placement so the revenue chain stays
                  consistent.
                </p>
              </section>

              <section>
                <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">Timeline</p>
                {data.events.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">
                    No activity recorded for this invoice yet.
                  </p>
                ) : (
                  <ol className="relative space-y-4 border-l-2 border-slate-100 pl-5">
                    {data.events.map((evt, idx) => {
                      const tone = KIND_TONE[evt.kind] || KIND_TONE.activity;
                      const Icon = KIND_ICON[evt.kind] || ActivityIcon;
                      return (
                        <li key={`${evt.at}-${idx}`} className="relative">
                          <span
                            className={`absolute -left-[27px] flex h-6 w-6 items-center justify-center rounded-full ring-2 ring-white ${tone.bg} ring-offset-0`}
                          >
                            <Icon size={12} className={tone.icon} />
                          </span>
                          <div
                            className={`rounded-xl border border-slate-100 p-3 ${tone.bg} bg-opacity-30`}
                          >
                            <div className="flex items-baseline justify-between gap-3">
                              <p className="text-sm font-bold text-slate-800">{evt.title}</p>
                              <p className="shrink-0 text-[11px] text-slate-500 tabular-nums">
                                {formatTimestamp(evt.at)}
                              </p>
                            </div>
                            {evt.description ? (
                              <p className="mt-1 text-[12px] text-slate-600">{evt.description}</p>
                            ) : null}
                            {evt.meta && Object.keys(evt.meta).length > 0 ? (
                              <div className="mt-2 flex flex-wrap gap-1.5">
                                {Object.entries(evt.meta)
                                  .filter(([, v]) => v !== null && v !== undefined && v !== '')
                                  .map(([k, v]) => (
                                    <span
                                      key={k}
                                      className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-600"
                                    >
                                      {k}: {String(v)}
                                    </span>
                                  ))}
                              </div>
                            ) : null}
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                )}
              </section>
            </>
          ) : null}
        </div>
      </aside>
    </>
  );
}
