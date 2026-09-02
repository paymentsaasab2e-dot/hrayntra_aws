'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { Building2, Coins, Loader2, UserRound } from 'lucide-react';
import { DrawerCloseButton } from '../drawers/DrawerCloseButton';
import {
  apiHqGetCandidateBillingLedger,
  apiHqGetEmployerBillingLedger,
  type HqBillingCandidateLedgerPayload,
  type HqBillingCandidateTransactionRow,
  type HqBillingEmployerLedgerPayload,
  type HqBillingEmployerTransactionRow,
} from '@/lib/api';
import { formatBillingCycleLabel } from './hqPackagePresentation';

type BillingEntityKind = 'candidate' | 'employer';

type Props = {
  open: boolean;
  kind: BillingEntityKind | null;
  entityKey: string | null;
  onClose: () => void;
};

function formatDateTime(value: string | null | undefined) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDate(value: string | null | undefined) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function TypePill({ type }: { type: string }) {
  const normalized = String(type || '').toUpperCase();
  const styles: Record<string, string> = {
    PURCHASE: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    SPEND: 'bg-rose-50 text-rose-700 ring-rose-200',
    GRANT: 'bg-sky-50 text-sky-700 ring-sky-200',
    SUBSCRIPTION: 'bg-indigo-50 text-indigo-700 ring-indigo-200',
    PLAN_UPGRADE: 'bg-violet-50 text-violet-700 ring-violet-200',
    COIN_PURCHASE: 'bg-amber-50 text-amber-700 ring-amber-200',
    COIN_SPEND: 'bg-orange-50 text-orange-700 ring-orange-200',
    LANDING_PURCHASE: 'bg-fuchsia-50 text-fuchsia-700 ring-fuchsia-200',
  };
  const label = normalized.replace(/_/g, ' ');
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ${
        styles[normalized] || 'bg-slate-50 text-slate-600 ring-slate-200'
      }`}
    >
      {label || '—'}
    </span>
  );
}

function formatAmount(row: { amount: number; direction: string; unit: string }) {
  const prefix = row.direction === 'debit' ? '−' : '+';
  const value = Number(row.amount) || 0;
  if (row.unit === 'INR') return `${prefix}₹${value}`;
  return `${prefix}${value} ${row.unit === 'coins' ? 'coins' : row.unit}`;
}

function CandidateLedgerTable({ rows }: { rows: HqBillingCandidateTransactionRow[] }) {
  if (!rows.length) {
    return <p className="py-8 text-center text-sm text-slate-500">No transactions for this candidate.</p>;
  }
  return (
    <table className="min-w-full text-left text-sm">
      <thead>
        <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
          <th className="px-3 py-2">Type</th>
          <th className="px-3 py-2">Amount</th>
          <th className="px-3 py-2">Balance</th>
          <th className="px-3 py-2">Details</th>
          <th className="px-3 py-2">Transaction ID</th>
          <th className="px-3 py-2">When</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.id} className="border-b border-slate-100">
            <td className="px-3 py-2.5">
              <TypePill type={row.type} />
              <div className="mt-1 text-[11px] text-slate-500">{row.label}</div>
            </td>
            <td
              className={`px-3 py-2.5 font-semibold ${
                row.direction === 'debit' ? 'text-rose-700' : 'text-emerald-700'
              }`}
            >
              {formatAmount(row)}
            </td>
            <td className="px-3 py-2.5 text-slate-700">{row.balanceAfter}</td>
            <td className="px-3 py-2.5 text-slate-600">
              <div>{row.packageName || row.service || '—'}</div>
              {row.description ? <div className="text-[11px] text-slate-400">{row.description}</div> : null}
            </td>
            <td className="px-3 py-2.5 font-mono text-[11px] text-slate-500">{row.reference || '—'}</td>
            <td className="px-3 py-2.5 text-slate-600">{formatDateTime(row.occurredAt)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function EmployerLedgerTable({ rows }: { rows: HqBillingEmployerTransactionRow[] }) {
  if (!rows.length) {
    return <p className="py-8 text-center text-sm text-slate-500">No transactions for this entrepreneur.</p>;
  }
  return (
    <table className="min-w-full text-left text-sm">
      <thead>
        <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
          <th className="px-3 py-2">Type</th>
          <th className="px-3 py-2">Amount</th>
          <th className="px-3 py-2">Balance</th>
          <th className="px-3 py-2">Details</th>
          <th className="px-3 py-2">Who</th>
          <th className="px-3 py-2">Transaction ID</th>
          <th className="px-3 py-2">When</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.id} className="border-b border-slate-100">
            <td className="px-3 py-2.5">
              <TypePill type={row.type} />
              <div className="mt-1 text-[11px] text-slate-500">{row.label}</div>
            </td>
            <td
              className={`px-3 py-2.5 font-semibold ${
                row.direction === 'debit' ? 'text-rose-700' : 'text-emerald-700'
              }`}
            >
              {formatAmount(row)}
            </td>
            <td className="px-3 py-2.5 text-slate-700">
              {row.balanceAfter != null && row.unit === 'coins' ? row.balanceAfter : '—'}
            </td>
            <td className="px-3 py-2.5 text-slate-600">
              <div>{row.description || '—'}</div>
            </td>
            <td className="px-3 py-2.5 text-slate-600">{row.actorEmail || row.email || '—'}</td>
            <td className="px-3 py-2.5 font-mono text-[11px] text-slate-500">{row.reference || '—'}</td>
            <td className="px-3 py-2.5 text-slate-600">{formatDateTime(row.occurredAt)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function HqBillingEntityDrawer({ open, kind, entityKey, onClose }: Props) {
  const [portalReady, setPortalReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [candidateLedger, setCandidateLedger] = useState<HqBillingCandidateLedgerPayload | null>(null);
  const [employerLedger, setEmployerLedger] = useState<HqBillingEmployerLedgerPayload | null>(null);

  useEffect(() => {
    setPortalReady(true);
  }, []);

  useEffect(() => {
    if (!open || !kind || !entityKey) {
      setCandidateLedger(null);
      setEmployerLedger(null);
      setError('');
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError('');

    const load = async () => {
      try {
        if (kind === 'candidate') {
          const result = await apiHqGetCandidateBillingLedger(entityKey);
          if (!cancelled) setCandidateLedger(result.data || null);
        } else {
          const result = await apiHqGetEmployerBillingLedger(entityKey);
          if (!cancelled) setEmployerLedger(result.data || null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load billing ledger');
          setCandidateLedger(null);
          setEmployerLedger(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [open, kind, entityKey]);

  if (!portalReady) return null;

  const title =
    kind === 'candidate'
      ? candidateLedger?.entity?.name || 'Candidate billing'
      : employerLedger?.entity?.tenantName || 'Entrepreneur billing';

  const subtitle =
    kind === 'candidate'
      ? 'Phase 1 · full purchase & spend history'
      : 'Phase 2 · subscriptions, coin purchases & spends';

  return createPortal(
    <AnimatePresence>
      {open ? (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[120] bg-slate-900/40 backdrop-blur-[1px]"
            onClick={onClose}
          />
          <motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
            className="fixed inset-y-0 right-0 z-[121] flex w-full max-w-3xl flex-col border-l border-slate-200 bg-white shadow-2xl"
          >
            <div className="flex items-start justify-between border-b border-slate-200 px-5 py-4">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                  {kind === 'candidate' ? <UserRound className="h-5 w-5" /> : <Building2 className="h-5 w-5" />}
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900">{title}</h2>
                  <p className="text-sm text-slate-500">{subtitle}</p>
                </div>
              </div>
              <DrawerCloseButton onClick={onClose} />
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4">
              {loading ? (
                <div className="flex items-center justify-center gap-2 py-16 text-slate-500">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Loading ledger…
                </div>
              ) : error ? (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
                  {error}
                </div>
              ) : kind === 'candidate' && candidateLedger ? (
                <>
                  <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2.5">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Email</p>
                      <p className="text-sm font-medium text-slate-800">{candidateLedger.entity.email || '—'}</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2.5">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Phone</p>
                      <p className="text-sm font-medium text-slate-800">{candidateLedger.entity.phone || '—'}</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2.5">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Balance</p>
                      <p className="inline-flex items-center gap-1 text-sm font-semibold text-amber-700">
                        <Coins className="h-3.5 w-3.5" />
                        {candidateLedger.entity.tokenBalance} coins
                      </p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2.5">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Transactions</p>
                      <p className="text-sm font-medium text-slate-800">{candidateLedger.stats.total}</p>
                    </div>
                  </div>
                  <div className="overflow-x-auto rounded-xl border border-slate-200">
                    <CandidateLedgerTable rows={candidateLedger.transactions} />
                  </div>
                </>
              ) : kind === 'employer' && employerLedger ? (
                <>
                  <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2.5">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Email</p>
                      <p className="text-sm font-medium text-slate-800">{employerLedger.entity.email || '—'}</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2.5">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Tenant DB</p>
                      <p className="font-mono text-sm text-slate-800">{employerLedger.entity.tenantDbName || '—'}</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2.5">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Plan</p>
                      <p className="text-sm font-medium text-slate-800">
                        {employerLedger.entity.planName} · {formatBillingCycleLabel(employerLedger.entity.billingCycle)}
                      </p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2.5">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">AI coins</p>
                      <p className="inline-flex items-center gap-1 text-sm font-semibold text-amber-700">
                        <Coins className="h-3.5 w-3.5" />
                        {employerLedger.entity.aiCoins}
                      </p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2.5">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Period</p>
                      <p className="text-sm text-slate-800">
                        {formatDate(employerLedger.entity.planStartDate)} → {formatDate(employerLedger.entity.planEndDate)}
                      </p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2.5">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Transactions</p>
                      <p className="text-sm font-medium text-slate-800">{employerLedger.stats.total}</p>
                    </div>
                  </div>
                  <div className="overflow-x-auto rounded-xl border border-slate-200">
                    <EmployerLedgerTable rows={employerLedger.transactions} />
                  </div>
                </>
              ) : null}
            </div>
          </motion.aside>
        </>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}
