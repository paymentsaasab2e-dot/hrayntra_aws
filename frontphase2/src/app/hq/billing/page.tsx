'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Briefcase,
  Building2,
  Coins,
  CreditCard,
  RefreshCw,
  Search,
  UserRound,
} from 'lucide-react';
import {
  HqModulePageLayout,
  HQ_TABLE_BODY_SCROLL_CLASS,
  HQ_TABLE_CARD_CLASS,
  HQ_TOOLBAR_ROW_CLASS,
} from '@/components/hq/HqModulePageLayout';
import { HqSecondaryButton, HqStatCard } from '@/components/hq/hqUi';
import { formatBillingCycleLabel } from '@/components/hq/hqPackagePresentation';
import { HqBillingEntityDrawer } from '@/components/hq/HqBillingEntityDrawer';
import {
  apiHqGetBilling,
  type HqBillingCandidateTransactionRow,
  type HqBillingEmployerTransactionRow,
  type HqBillingPayload,
  type HqBillingPurchaseRequestRow,
  type HqBillingTenantCycleRow,
} from '@/lib/api';

type BillingTab = 'candidate' | 'employer';
type EmployerView = 'transactions' | 'cycles' | 'purchases';
type DrawerState = {
  kind: 'candidate' | 'employer';
  entityKey: string;
} | null;

function formatDate(value: string | null | undefined) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

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

function SourcePill({ source }: { source: string }) {
  const normalized = String(source || '').trim();
  const styles: Record<string, string> = {
    landing_purchase: 'bg-violet-50 text-violet-700 ring-violet-200',
    landing_trial: 'bg-sky-50 text-sky-700 ring-sky-200',
    hq_manual: 'bg-slate-50 text-slate-600 ring-slate-200',
  };
  const labels: Record<string, string> = {
    landing_purchase: 'Landing purchase',
    landing_trial: 'Landing trial',
    hq_manual: 'HQ manual',
  };
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ${
        styles[normalized] || 'bg-slate-50 text-slate-600 ring-slate-200'
      }`}
    >
      {labels[normalized] || normalized || '—'}
    </span>
  );
}

function CyclePill({ cycle }: { cycle: string }) {
  const annual = cycle === 'annual';
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ${
        annual
          ? 'bg-indigo-50 text-indigo-700 ring-indigo-200'
          : 'bg-emerald-50 text-emerald-700 ring-emerald-200'
      }`}
    >
      {formatBillingCycleLabel(cycle)}
    </span>
  );
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
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ${
        styles[normalized] || 'bg-slate-50 text-slate-600 ring-slate-200'
      }`}
    >
      {normalized.replace(/_/g, ' ') || '—'}
    </span>
  );
}

function formatTxAmount(row: { amount: number; direction: string; unit: string }) {
  const prefix = row.direction === 'debit' ? '−' : '+';
  const value = Number(row.amount) || 0;
  if (row.unit === 'INR') return `${prefix}₹${value}`;
  return `${prefix}${value}`;
}

function filterCandidateTransactions(rows: HqBillingCandidateTransactionRow[], needle: string) {
  if (!needle) return rows;
  return rows.filter((row) =>
    [
      row.candidateName,
      row.candidateEmail,
      row.candidatePhone,
      row.packageName,
      row.service,
      row.reference,
      row.description,
      row.type,
      row.label,
    ]
      .join(' ')
      .toLowerCase()
      .includes(needle),
  );
}

function filterEmployerTransactions(rows: HqBillingEmployerTransactionRow[], needle: string) {
  if (!needle) return rows;
  return rows.filter((row) =>
    [
      row.tenantName,
      row.email,
      row.tenantDbName,
      row.type,
      row.label,
      row.reference,
      row.description,
      row.actorEmail,
    ]
      .join(' ')
      .toLowerCase()
      .includes(needle),
  );
}

function filterTenantCycles(rows: HqBillingTenantCycleRow[], needle: string) {
  if (!needle) return rows;
  return rows.filter((row) =>
    [
      row.tenantName,
      row.email,
      row.tenantDbName,
      row.planName,
      row.signupSource,
      row.lastPaymentReference,
    ]
      .join(' ')
      .toLowerCase()
      .includes(needle),
  );
}

function filterPurchaseRequests(rows: HqBillingPurchaseRequestRow[], needle: string) {
  if (!needle) return rows;
  return rows.filter((row) =>
    [row.fullName, row.email, row.organizationName, row.packageName, row.packageSlug]
      .join(' ')
      .toLowerCase()
      .includes(needle),
  );
}


export default function HqBillingPage() {
  const [tab, setTab] = useState<BillingTab>('employer');
  const [employerView, setEmployerView] = useState<EmployerView>('transactions');
  const [data, setData] = useState<HqBillingPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [drawer, setDrawer] = useState<DrawerState>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await apiHqGetBilling();
      setData(result.data || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load billing data');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const needle = search.trim().toLowerCase();

  const candidateTransactions = useMemo(
    () => filterCandidateTransactions(data?.candidate?.transactions || [], needle),
    [data, needle],
  );
  const employerTransactions = useMemo(
    () => filterEmployerTransactions(data?.employer?.transactions || [], needle),
    [data, needle],
  );
  const tenantCycles = useMemo(
    () => filterTenantCycles(data?.employer?.tenantCycles || [], needle),
    [data, needle],
  );
  const purchaseRequests = useMemo(
    () => filterPurchaseRequests(data?.employer?.purchaseRequests || [], needle),
    [data, needle],
  );

  const overview = data?.overview;

  const openCandidateDrawer = (candidateId: string) => {
    if (!candidateId) return;
    setDrawer({ kind: 'candidate', entityKey: candidateId });
  };

  const openEmployerDrawer = (row: HqBillingEmployerTransactionRow | HqBillingTenantCycleRow) => {
    const key =
      'tenantDbName' in row && row.tenantDbName
        ? row.tenantDbName
        : 'tenantId' in row && row.tenantId
          ? row.tenantId
          : row.email;
    if (!key) return;
    setDrawer({ kind: 'employer', entityKey: key });
  };

  return (
    <HqModulePageLayout
      title="Billing"
      subtitle="Every Phase 1 & Phase 2 transaction — click a row to see full purchase & spend history."
      icon={<CreditCard className="h-5 w-5" />}
      actions={
        <HqSecondaryButton onClick={() => void load()} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </HqSecondaryButton>
      }
    >
      {error ? (
        <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {error}
          <button type="button" onClick={() => void load()} className="ml-2 font-semibold underline">
            Retry
          </button>
        </div>
      ) : null}

      <div className="mb-5 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setTab('employer')}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition ${
            tab === 'employer'
              ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-500/30'
              : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
          }`}
        >
          <Briefcase className="h-4 w-4" />
          Employer (Phase 2)
        </button>
        <button
          type="button"
          onClick={() => setTab('candidate')}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition ${
            tab === 'candidate'
              ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-500/30'
              : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
          }`}
        >
          <UserRound className="h-4 w-4" />
          Candidate (Phase 1)
        </button>
      </div>

      {tab === 'employer' ? (
        <>
          <div className="mb-5 grid shrink-0 grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6 sm:gap-3">
            <HqStatCard label="Tenants" value={overview?.employer.totalTenants ?? 0} active />
            <HqStatCard label="On a plan" value={overview?.employer.tenantsOnPlan ?? 0} />
            <HqStatCard label="Transactions" value={overview?.employer.totalTransactions ?? 0} />
            <HqStatCard label="Coin purchases" value={overview?.employer.coinPurchases ?? 0} />
            <HqStatCard label="Coin spends" value={overview?.employer.coinSpends ?? 0} />
            <HqStatCard label="Purchase requests" value={overview?.employer.purchaseRequests ?? 0} />
          </div>

          <div className={HQ_TABLE_CARD_CLASS}>
            <div className={HQ_TOOLBAR_ROW_CLASS}>
              <div className="flex min-w-max items-center gap-1 overflow-x-auto">
                {(
                  [
                    { id: 'transactions' as const, label: 'All transactions' },
                    { id: 'cycles' as const, label: 'Tenant billing cycles' },
                    { id: 'purchases' as const, label: 'Landing purchases' },
                  ] as const
                ).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setEmployerView(item.id)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold capitalize transition ${
                      employerView === item.id
                        ? 'bg-indigo-600 text-white'
                        : 'text-slate-500 hover:bg-indigo-50/60 hover:text-slate-800'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
              <div className="relative min-w-[220px] flex-1 sm:max-w-xs">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-indigo-400" />
                <input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder={
                    employerView === 'transactions'
                      ? 'Search transactions…'
                      : employerView === 'cycles'
                        ? 'Search tenants…'
                        : 'Search purchases…'
                  }
                  className="h-9 w-full rounded-xl border border-indigo-100/90 bg-white/95 py-2 pl-10 pr-3 text-sm outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-500/25"
                />
              </div>
            </div>

            <div className={HQ_TABLE_BODY_SCROLL_CLASS}>
              {employerView === 'transactions' ? (
                <table className="min-w-full text-left">
                  <thead>
                    <tr>
                      <th>Tenant</th>
                      <th>Type</th>
                      <th>Amount</th>
                      <th>Who</th>
                      <th>Details</th>
                      <th>Transaction ID</th>
                      <th>When</th>
                    </tr>
                  </thead>
                  <tbody>
                    {employerTransactions.length ? (
                      employerTransactions.map((row) => (
                        <tr
                          key={row.id}
                          className="cursor-pointer border-b border-slate-100 transition hover:bg-indigo-50/40"
                          onClick={() => openEmployerDrawer(row)}
                        >
                          <td className="px-4 py-3">
                            <div className="font-semibold text-slate-900">{row.tenantName}</div>
                            <div className="text-xs text-slate-500">{row.email || '—'}</div>
                            <div className="mt-1 font-mono text-[10px] text-slate-400">{row.tenantDbName || '—'}</div>
                          </td>
                          <td className="px-4 py-3">
                            <TypePill type={row.type} />
                            <div className="mt-1 text-[11px] text-slate-500">{row.label}</div>
                          </td>
                          <td
                            className={`px-4 py-3 font-semibold ${
                              row.direction === 'debit' ? 'text-rose-700' : 'text-emerald-700'
                            }`}
                          >
                            {formatTxAmount(row)}
                            <div className="text-[10px] font-normal uppercase text-slate-400">{row.unit}</div>
                          </td>
                          <td className="px-4 py-3 text-slate-600">{row.actorEmail || row.email || '—'}</td>
                          <td className="px-4 py-3 text-slate-600">{row.description || '—'}</td>
                          <td className="px-4 py-3 font-mono text-[11px] text-slate-500">{row.reference || '—'}</td>
                          <td className="px-4 py-3 text-slate-600">{formatDateTime(row.occurredAt)}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={7} className="px-4 py-10 text-center text-slate-500">
                          {loading ? 'Loading employer transactions…' : 'No employer transactions found.'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              ) : employerView === 'cycles' ? (
                <table className="min-w-full text-left">
                  <thead>
                    <tr>
                      <th>Tenant</th>
                      <th>Plan</th>
                      <th>Cycle</th>
                      <th>Period</th>
                      <th>Price</th>
                      <th>AI coins</th>
                      <th>Source</th>
                      <th>Transaction ID</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tenantCycles.length ? (
                      tenantCycles.map((row) => (
                        <tr
                          key={row.tenantId || row.email}
                          className="cursor-pointer border-b border-slate-100 transition hover:bg-indigo-50/40"
                          onClick={() => openEmployerDrawer(row)}
                        >
                          <td className="px-4 py-3">
                            <div className="font-semibold text-slate-900">{row.tenantName}</div>
                            <div className="text-xs text-slate-500">{row.email || '—'}</div>
                            <div className="mt-1 font-mono text-[10px] text-slate-400">{row.tenantDbName || '—'}</div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-medium text-slate-800">{row.planName}</div>
                            {row.isTrial ? (
                              <span className="mt-1 inline-flex rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-700 ring-1 ring-amber-200">
                                Trial
                              </span>
                            ) : null}
                          </td>
                          <td className="px-4 py-3">
                            <CyclePill cycle={row.billingCycle} />
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-600">
                            <div>Start: {formatDate(row.planStartDate)}</div>
                            <div>End: {formatDate(row.planEndDate)}</div>
                            <div className="mt-1 text-slate-400">Purchased: {formatDate(row.purchasedAt)}</div>
                          </td>
                          <td className="px-4 py-3 font-semibold text-slate-800">
                            {row.price ? `₹${row.price}` : '—'}
                          </td>
                          <td className="px-4 py-3 text-slate-700">{row.aiCoins}</td>
                          <td className="px-4 py-3">
                            <SourcePill source={row.signupSource} />
                          </td>
                          <td className="px-4 py-3 font-mono text-[11px] text-slate-500">
                            {row.lastPaymentReference || '—'}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={8} className="px-4 py-10 text-center text-slate-500">
                          {loading ? 'Loading tenant billing cycles…' : 'No tenant billing cycles found.'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              ) : (
                <table className="min-w-full text-left">
                  <thead>
                    <tr>
                      <th>Organization</th>
                      <th>Contact</th>
                      <th>Package</th>
                      <th>Cycle</th>
                      <th>Status</th>
                      <th>Submitted</th>
                      <th>Tenant DB</th>
                    </tr>
                  </thead>
                  <tbody>
                    {purchaseRequests.length ? (
                      purchaseRequests.map((row) => (
                        <tr key={row.id} className="border-b border-slate-100">
                          <td className="px-4 py-3">
                            <div className="font-semibold text-slate-900">{row.organizationName}</div>
                            <div className="text-xs text-slate-500">{row.fullName}</div>
                          </td>
                          <td className="px-4 py-3 text-slate-700">{row.email || '—'}</td>
                          <td className="px-4 py-3 font-medium text-slate-800">{row.packageName}</td>
                          <td className="px-4 py-3">
                            <CyclePill cycle={row.billingCycle} />
                          </td>
                          <td className="px-4 py-3">
                            <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-600 ring-1 ring-slate-200">
                              {row.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-slate-600">{formatDateTime(row.submittedAt)}</td>
                          <td className="px-4 py-3 font-mono text-[11px] text-slate-500">
                            {row.trialTenantDbName || '—'}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={7} className="px-4 py-10 text-center text-slate-500">
                          {loading ? 'Loading purchase requests…' : 'No landing purchase requests found.'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          <p className="mt-3 flex items-center gap-2 text-xs text-slate-500">
            <Building2 className="h-3.5 w-3.5" />
            Phase 2 coin purchases & spends are logged from now on. Subscriptions and landing requests are included.
          </p>
        </>
      ) : (
        <>
          <div className="mb-5 grid shrink-0 grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6 sm:gap-3">
            <HqStatCard label="Transactions" value={overview?.candidate.totalTransactions ?? 0} active />
            <HqStatCard label="Purchases" value={overview?.candidate.totalPurchases ?? 0} />
            <HqStatCard label="Spends" value={overview?.candidate.totalSpends ?? 0} />
            <HqStatCard label="Tokens sold" value={overview?.candidate.totalTokensSold ?? 0} />
            <HqStatCard label="Tokens spent" value={overview?.candidate.totalTokensSpent ?? 0} />
            <HqStatCard label="Unique buyers" value={overview?.candidate.uniqueBuyers ?? 0} />
          </div>

          <div className={HQ_TABLE_CARD_CLASS}>
            <div className={HQ_TOOLBAR_ROW_CLASS}>
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                <Coins className="h-4 w-4 text-amber-500" />
                All candidate transactions
              </div>
              <div className="relative min-w-[220px] flex-1 sm:max-w-xs">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-indigo-400" />
                <input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search candidates, type, transaction ID…"
                  className="h-9 w-full rounded-xl border border-indigo-100/90 bg-white/95 py-2 pl-10 pr-3 text-sm outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-500/25"
                />
              </div>
            </div>

            <div className={HQ_TABLE_BODY_SCROLL_CLASS}>
              <table className="min-w-full text-left">
                <thead>
                  <tr>
                    <th>Candidate</th>
                    <th>Type</th>
                    <th>Amount</th>
                    <th>Balance after</th>
                    <th>Details</th>
                    <th>Transaction ID</th>
                    <th>When</th>
                  </tr>
                </thead>
                <tbody>
                  {candidateTransactions.length ? (
                    candidateTransactions.map((row) => (
                      <tr
                        key={row.id}
                        className="cursor-pointer border-b border-slate-100 transition hover:bg-indigo-50/40"
                        onClick={() => openCandidateDrawer(row.candidateId)}
                      >
                        <td className="px-4 py-3">
                          <div className="font-semibold text-slate-900">{row.candidateName}</div>
                          <div className="text-xs text-slate-500">{row.candidateEmail || '—'}</div>
                          <div className="text-xs text-slate-400">{row.candidatePhone || '—'}</div>
                        </td>
                        <td className="px-4 py-3">
                          <TypePill type={row.type} />
                          <div className="mt-1 text-[11px] text-slate-500">{row.label}</div>
                        </td>
                        <td
                          className={`px-4 py-3 font-semibold ${
                            row.direction === 'debit' ? 'text-rose-700' : 'text-emerald-700'
                          }`}
                        >
                          {formatTxAmount(row)}
                          <div className="text-[10px] font-normal uppercase text-slate-400">{row.unit}</div>
                        </td>
                        <td className="px-4 py-3 text-slate-700">{row.balanceAfter}</td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-slate-800">{row.packageName || row.service || '—'}</div>
                          {row.description ? (
                            <div className="mt-1 text-[11px] text-slate-500">{row.description}</div>
                          ) : null}
                        </td>
                        <td className="px-4 py-3 font-mono text-[11px] text-slate-500">{row.reference || '—'}</td>
                        <td className="px-4 py-3 text-slate-600">{formatDateTime(row.occurredAt)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} className="px-4 py-10 text-center text-slate-500">
                        {loading ? 'Loading candidate transactions…' : 'No candidate transactions found.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <p className="mt-3 flex items-center gap-2 text-xs text-slate-500">
            <Building2 className="h-3.5 w-3.5" />
            Phase 1 candidate purchases, spends, and grants from the job portal token ledger. Click any row for full history.
          </p>
        </>
      )}

      <HqBillingEntityDrawer
        open={Boolean(drawer)}
        kind={drawer?.kind ?? null}
        entityKey={drawer?.entityKey ?? null}
        onClose={() => setDrawer(null)}
      />
    </HqModulePageLayout>
  );
}
