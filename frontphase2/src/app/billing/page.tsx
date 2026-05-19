'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Building2,
  Calendar,
  CheckCircle2,
  ChevronRight,
  CreditCard,
  Download,
  FileCheck2,
  Filter,
  Receipt,
  Search,
  Settings,
  Wallet,
} from 'lucide-react';
import {
  apiFetch,
  getCachedOrgDefaultCurrency,
  isOrgBillingNavEnabled,
  ORG_RECRUITMENT_CACHE_EVENT,
} from '../../lib/api';
import { usePermissions } from '../../hooks/usePermissions';
import { usePageAutoRefresh } from '../../hooks/usePageAutoRefresh';
import { Skeleton } from '../../components/ui/Skeleton';
import { useRouter } from 'next/navigation';
import PaginationAll from '../../components/PaginationAll';
import { TABLE_PAGE_SIZE_OPTIONS, type TablePageSize } from '../../constants/tablePagination';
import InvoiceActivityDrawer from '../../components/billing/InvoiceActivityDrawer';
import {
  SUPPORTED_CURRENCIES,
  convertAmount,
  formatCurrencyAmount,
} from '../../utils/currency';

type BillingTab =
  | 'Invoices'
  | 'Payments'
  | 'Clients & Contracts'
  | 'Commission & Payouts'
  | 'Taxes & Compliance'
  | 'Billing Settings';

type Option = { id: string; name: string };
type DateOption = { value: string; label: string };

type BillingSettings = {
  invoicePrefix: string;
  defaultCurrency: string;
  defaultPaymentTerms: string;
  bankName: string;
  accountNumber: string;
  swiftCode: string;
  taxLabel: string;
  taxRate: number;
};

type SummaryResponse = {
  filters: {
    dateRange: string;
    clientId: string;
    recruiterId: string;
    search: string;
    invoiceStatus: string;
  };
  options: {
    dateRanges: DateOption[];
    clients: Option[];
    recruiters: Option[];
    invoiceStatuses: string[];
  };
  kpis: {
    totalBilled: number;
    totalReceived: number;
    pendingAmount: number;
    overdueAmount: number;
    monthRevenue: number;
    nextPayout: number;
    invoiceCount: number;
    collectionRate: number;
  };
  invoices: Array<Record<string, any>>;
  payments: Array<Record<string, any>>;
  placements: Array<Record<string, any>>;
  clients: Array<Record<string, any>>;
  commissions: Array<Record<string, any>>;
  taxes: {
    outputTax: number;
    inputCredit: number;
    netPayable: number;
    effectiveRate: number;
    compliance: Array<{ status: string; title: string; description: string }>;
  };
  settings: BillingSettings;
};

type FiltersState = {
  dateRange: string;
  clientId: string;
  recruiterId: string;
  invoiceStatus: string;
  search: string;
};

// "Placements Billing" was a near-duplicate of the Invoices view, so it's
// retired here. Payments now strictly shows received receipts (no pending
// data already covered by the Invoices tab).
const TABS: Array<{ name: BillingTab; icon: React.ComponentType<{ size?: number; className?: string }> }> = [
  { name: 'Invoices', icon: Receipt },
  { name: 'Payments', icon: CreditCard },
  { name: 'Clients & Contracts', icon: Building2 },
  { name: 'Commission & Payouts', icon: Wallet },
  { name: 'Taxes & Compliance', icon: FileCheck2 },
  { name: 'Billing Settings', icon: Settings },
];

const DEFAULT_FILTERS: FiltersState = {
  dateRange: 'last_30_days',
  clientId: '',
  recruiterId: '',
  invoiceStatus: '',
  search: '',
};

const TAB_EXPORT_KEY: Record<BillingTab, string> = {
  Invoices: 'invoices',
  Payments: 'payments',
  'Clients & Contracts': 'clients-contracts',
  'Commission & Payouts': 'commission-payouts',
  'Taxes & Compliance': 'taxes-compliance',
  'Billing Settings': 'billing-settings',
};

// Payments → only receipt fields; we no longer mirror invoice "amount due"
//   here since the Invoices tab already shows pending balances.
// Clients & Contracts → only relationship fields. "Placements / Invoices /
//   Billed / Outstanding" were duplicates of figures already on Invoices and
//   Payments, so they're dropped from this tab.
const DEFAULT_COLUMNS: Record<Exclude<BillingTab, 'Taxes & Compliance' | 'Billing Settings'>, string[]> = {
  Invoices: ['Invoice #', 'Client', 'Candidate', 'Job', 'Date', 'Due Date', 'Amount', 'Total', 'Status'],
  Payments: ['Receipt #', 'Client', 'Amount', 'Mode', 'Date', 'Received By', 'Status'],
  'Clients & Contracts': ['Client', 'Status', 'Industry', 'Location', 'Owner', 'SLA'],
  'Commission & Payouts': ['Recruiter', 'Placement', 'Commission %', 'Amount', 'Status', 'Payout Date'],
};

function formatCurrency(value: number, currency = 'USD') {
  return formatCurrencyAmount(Number(value || 0), currency);
}

const MONETARY_COLUMNS_BY_TAB: Record<string, Set<string>> = {
  Invoices: new Set(['Amount', 'Total']),
  Payments: new Set(['Amount']),
  'Clients & Contracts': new Set(),
  'Commission & Payouts': new Set(['Amount']),
};

function buildQuery(filters: FiltersState) {
  const params = new URLSearchParams();
  if (filters.dateRange) params.set('dateRange', filters.dateRange);
  if (filters.clientId) params.set('clientId', filters.clientId);
  if (filters.recruiterId) params.set('recruiterId', filters.recruiterId);
  if (filters.invoiceStatus) params.set('invoiceStatus', filters.invoiceStatus);
  if (filters.search) params.set('search', filters.search);
  return params.toString();
}

function buildDownloadHref(fileUrl: string, filename: string) {
  const params = new URLSearchParams({
    path: fileUrl,
    filename,
  });
  return `/api/download-file?${params.toString()}`;
}

function Badge({ value }: { value: string }) {
  const key = String(value || '').toLowerCase();
  const style =
    key === 'paid' || key === 'confirmed' || key === 'success'
      ? 'bg-green-50 text-green-700 border-green-200'
      : key === 'overdue' || key === 'warning'
        ? 'bg-red-50 text-red-700 border-red-200'
        : key === 'pending'
          ? 'bg-amber-50 text-amber-700 border-amber-200'
          : key === 'info'
            ? 'bg-blue-50 text-blue-700 border-blue-200'
            : 'bg-slate-50 text-slate-700 border-slate-200';
  return <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${style}`}>{value}</span>;
}

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-slate-200 bg-white shadow-sm ${className}`}>{children}</div>;
}

function CurrencyCell({
  amount,
  baseCurrency,
  currency,
  onCurrencyChange,
}: {
  amount: number;
  baseCurrency: string;
  currency: string;
  onCurrencyChange: (next: string) => void;
}) {
  const converted = convertAmount(amount, baseCurrency, currency);
  return (
    <div className="flex items-center gap-2">
      <span className="font-semibold text-slate-900 tabular-nums">
        {formatCurrencyAmount(converted, currency)}
      </span>
      <select
        value={currency}
        onChange={(event) => onCurrencyChange(event.target.value)}
        onClick={(event) => event.stopPropagation()}
        className="rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-[11px] font-semibold text-slate-600 outline-none focus:border-blue-500"
        title="Display this row in another currency (does not change saved values)"
      >
        {SUPPORTED_CURRENCIES.map((code) => (
          <option key={code} value={code}>
            {code}
          </option>
        ))}
      </select>
      {currency !== baseCurrency ? (
        <span className="text-[10px] text-slate-400">~ {baseCurrency} {Math.round(amount).toLocaleString()}</span>
      ) : null}
    </div>
  );
}

function Table({
  columns,
  rows,
  monetaryColumns,
  baseCurrency,
  rowCurrency,
  onRowCurrencyChange,
  onRowOpen,
}: {
  columns: string[];
  rows: Array<Record<string, any>>;
  monetaryColumns: Set<string>;
  baseCurrency: string;
  rowCurrency: (rowId: string) => string;
  onRowCurrencyChange: (rowId: string, currency: string) => void;
  /**
   * When provided, an extra column with a "next" chevron is appended to each
   * row. Clicking the chevron opens a deeper view (e.g. invoice activity).
   */
  onRowOpen?: (rowId: string, row: Record<string, any>) => void;
}) {
  const trailingActionColumn = onRowOpen ? 1 : 0;
  const totalCols = columns.length + trailingActionColumn;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[900px] border-collapse">
        <thead>
          <tr className="border-b border-slate-100">
            {columns.map((column) => (
              <th key={column} className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">
                {column}
              </th>
            ))}
            {onRowOpen ? <th className="px-3 py-3" aria-label="Actions" /> : null}
          </tr>
        </thead>
        <tbody>
          {rows.length ? (
            rows.map((row, index) => {
              const rowId = String(row.id ?? index);
              return (
                <tr key={rowId} className="border-b border-slate-50 last:border-b-0 hover:bg-slate-50/60">
                  {columns.map((column) => {
                    const value = row[column];
                    const isStatus = String(column).toLowerCase().includes('status');
                    const isMonetary = monetaryColumns.has(column) && typeof value === 'number';
                    return (
                      <td key={column} className="px-4 py-3 text-sm text-slate-700">
                        {isStatus ? (
                          <Badge value={String(value ?? '-')} />
                        ) : isMonetary ? (
                          <CurrencyCell
                            amount={value as number}
                            baseCurrency={baseCurrency}
                            currency={rowCurrency(rowId)}
                            onCurrencyChange={(next) => onRowCurrencyChange(rowId, next)}
                          />
                        ) : (
                          (value ?? '-') as React.ReactNode
                        )}
                      </td>
                    );
                  })}
                  {onRowOpen ? (
                    <td className="px-3 py-3 text-right">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onRowOpen(rowId, row);
                        }}
                        className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-600"
                        aria-label="Open activity timeline"
                        title="See full activity for this entry"
                      >
                        <ChevronRight size={14} />
                      </button>
                    </td>
                  ) : null}
                </tr>
              );
            })
          ) : (
            <tr>
              <td colSpan={totalCols} className="px-4 py-10 text-center text-sm text-slate-500">
                No records found for the selected billing filters.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export default function BillingPage() {
  const router = useRouter();
  const { hasPermission } = usePermissions();

  useEffect(() => {
    const enforce = () => {
      if (!isOrgBillingNavEnabled()) {
        router.replace('/setting?section=profile');
      }
    };
    enforce();
    window.addEventListener(ORG_RECRUITMENT_CACHE_EVENT, enforce);
    return () => window.removeEventListener(ORG_RECRUITMENT_CACHE_EVENT, enforce);
  }, [router]);
  const canExportData = hasPermission('export_data');
  const canManageSettings = hasPermission('manage_settings');
  const [activeTab, setActiveTab] = useState<BillingTab>('Invoices');
  const [draftFilters, setDraftFilters] = useState<FiltersState>(DEFAULT_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState<FiltersState>(DEFAULT_FILTERS);
  const [data, setData] = useState<SummaryResponse | null>(null);
  const [settingsForm, setSettingsForm] = useState<BillingSettings | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<TablePageSize>(10);
  const [loading, setLoading] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [exporting, setExporting] = useState<string | null>(null);
  const [error, setError] = useState('');
  // ID of the invoice whose activity drawer is open, or null when closed.
  const [activeInvoiceId, setActiveInvoiceId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function load(opts?: { silent?: boolean }) {
      if (!opts?.silent) setLoading(true);
      setError('');
      try {
        const query = buildQuery(appliedFilters);
        const response = await apiFetch<SummaryResponse>(`/billing/summary?${query}`, { auth: true });
        if (!active) return;
        setData(response.data);
        setSettingsForm(response.data.settings);
      } catch (err: any) {
        if (!active) return;
        setError(err?.message || 'Failed to load billing data.');
      } finally {
        if (active && !opts?.silent) setLoading(false);
      }
    }
    void load();
    // expose for the auto-refresh hook below
    (load as any).__expose = load;
    (window as any).__billingReload = load;
    return () => {
      active = false;
    };
  }, [appliedFilters]);

  // Auto-refresh on focus / interval / billing-changed events.
  usePageAutoRefresh(
    ({ silent }) => {
      const fn = (window as any).__billingReload as ((o?: { silent?: boolean }) => Promise<void>) | undefined;
      if (fn) void fn({ silent });
    },
    { events: ['jobportal:billing-changed', 'jobportal:placements-changed'] }
  );

  // The tenant-wide default currency (from Settings → System) is the source of
  // truth. The legacy `data.settings.defaultCurrency` only acts as a fallback
  // until billing settings ship; either way we always end up with a valid code.
  const currency = (getCachedOrgDefaultCurrency() || data?.settings?.defaultCurrency || 'USD').toUpperCase();

  const tableRows = useMemo(() => {
    if (!data) return [];
    if (activeTab === 'Invoices') {
      return data.invoices.map((row) => ({
        id: row.id ?? row.invoiceNumber,
        'Invoice #': row.invoiceNumber,
        Client: row.clientName,
        Candidate: row.candidateName,
        Job: row.jobTitle,
        Date: row.date,
        'Due Date': row.dueDate,
        Amount: Number(row.amount || 0),
        Total: Number(row.total || 0),
        Status: row.status,
      }));
    }
    if (activeTab === 'Payments') {
      // Payments view = receipts of money received only. Pending invoice
      // amounts and source labels live on the Invoices tab; not duplicated.
      return data.payments.map((row) => ({
        id: row.id ?? `${row.receiptNumber || row.invoiceNumber}-${row.transactionId}`,
        'Receipt #': row.receiptNumber || row.invoiceNumber || '-',
        Client: row.clientName,
        Amount: Number(row.amount || 0),
        Mode: row.mode,
        Date: row.date,
        'Received By': row.receivedBy,
        Status: row.status,
      }));
    }
    if (activeTab === 'Clients & Contracts') {
      // Relationship-only view — financial totals removed because they're
      // already shown on Invoices and Payments and were duplicating the data.
      return data.clients.map((row) => ({
        id: row.id ?? row.name,
        Client: row.name,
        Status: row.status,
        Industry: row.industry,
        Location: row.location,
        Owner: row.owner,
        SLA: row.sla,
      }));
    }
    if (activeTab === 'Commission & Payouts') {
      return data.commissions.map((row) => ({
        id: row.id ?? `${row.recruiter}-${row.placement}-${row.date}`,
        Recruiter: row.recruiter,
        Placement: row.placement,
        'Commission %': `${row.percentage}%`,
        Amount: Number(row.amount || 0),
        Status: row.status,
        'Payout Date': row.date,
      }));
    }
    return [];
  }, [activeTab, data]);

  // Per-row currency override. Keyed by tab + row id so each tab keeps independent state.
  const [rowCurrencies, setRowCurrencies] = useState<Record<string, string>>({});

  const monetaryColumns = useMemo(() => {
    return MONETARY_COLUMNS_BY_TAB[activeTab] || new Set<string>();
  }, [activeTab]);

  const rowCurrencyKey = (rowId: string) => `${activeTab}::${rowId}`;
  const getRowCurrency = (rowId: string) => rowCurrencies[rowCurrencyKey(rowId)] || currency;
  const setRowCurrency = (rowId: string, next: string) =>
    setRowCurrencies((current) => ({ ...current, [rowCurrencyKey(rowId)]: next }));

  const columns = tableRows[0]
    ? Object.keys(tableRows[0]).filter((column) => column !== 'id')
    : activeTab === 'Taxes & Compliance' || activeTab === 'Billing Settings'
      ? []
      : DEFAULT_COLUMNS[activeTab];

  const totalPages = Math.max(Math.ceil(tableRows.length / pageSize), 1);
  const visibleRows = tableRows.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, appliedFilters, data]);

  async function exportTab(format: 'csv' | 'excel' | 'pdf') {
    try {
      setExporting(format);
      const query = buildQuery(appliedFilters);
      const key = TAB_EXPORT_KEY[activeTab];
      const response = await apiFetch<{ fileUrl: string }>(`/billing/export/${key}/${format}?${query}`, { auth: true });
      const extension = format === 'excel' ? 'xlsx' : format;
      const downloadName = `billing-${key}-${new Date().toISOString().split('T')[0]}.${extension}`;
      const href = buildDownloadHref(response.data.fileUrl, downloadName);
      const link = document.createElement('a');
      link.href = href;
      link.download = downloadName;
      link.rel = 'noopener noreferrer';
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err: any) {
      setError(err?.message || 'Failed to export billing data.');
    } finally {
      setExporting(null);
    }
  }

  async function saveSettings() {
    if (!settingsForm) return;
    try {
      setSavingSettings(true);
      setError('');
      const response = await apiFetch<BillingSettings>('/billing/settings', {
        method: 'PUT',
        body: settingsForm,
        auth: true,
      });
      setSettingsForm(response.data);
      setData((current) => (current ? { ...current, settings: response.data } : current));
    } catch (err: any) {
      setError(err?.message || 'Failed to save billing settings.');
    } finally {
      setSavingSettings(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 px-6 py-6 text-slate-900 md:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
              <span>Finance</span>
              <ChevronRight size={10} />
              <span className="text-blue-600">Billing Overview</span>
            </div>
            <h1 className="text-3xl font-bold tracking-tight">Billing</h1>
            <p className="mt-1 text-sm text-slate-500">Live invoice, payment, placement, commission, and tax data from your recruitment system.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {canExportData && (
              <button onClick={() => exportTab('csv')} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">{exporting === 'csv' ? 'Exporting...' : 'CSV'}</button>
            )}
            {canExportData && (
              <button onClick={() => exportTab('excel')} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">{exporting === 'excel' ? 'Exporting...' : 'Excel'}</button>
            )}
            {canExportData && (
              <button onClick={() => exportTab('pdf')} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"><Download size={16} />{exporting === 'pdf' ? 'Exporting...' : 'PDF'}</button>
            )}
          </div>
        </div>

        <Card className="p-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
            <div className="xl:col-span-2">
              <label className="mb-2 block text-[11px] font-bold uppercase tracking-wider text-slate-500">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input value={draftFilters.search} onChange={(e) => setDraftFilters((current) => ({ ...current, search: e.target.value }))} placeholder="Search invoices, clients, candidates..." className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-blue-500" />
              </div>
            </div>
            {[{ key: 'dateRange', label: 'Date Range', options: data?.options.dateRanges || [] }, { key: 'clientId', label: 'Client', options: [{ id: '', name: 'All Clients' }, ...(data?.options.clients || [])] }, { key: 'recruiterId', label: 'Recruiter', options: [{ id: '', name: 'All Recruiters' }, ...(data?.options.recruiters || [])] }, { key: 'invoiceStatus', label: 'Invoice Status', options: [{ id: '', name: 'All Status' }, ...((data?.options.invoiceStatuses || []).map((value) => ({ id: value, name: value })))] }].map((field) => (
              <div key={field.key}>
                <label className="mb-2 block text-[11px] font-bold uppercase tracking-wider text-slate-500">{field.label}</label>
                <select value={(draftFilters as any)[field.key]} onChange={(e) => setDraftFilters((current) => ({ ...current, [field.key]: e.target.value }))} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500">
                  {field.options.map((option: any) => (
                    <option key={option.id || option.value || option.name} value={option.id ?? option.value}>
                      {option.name ?? option.label}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button onClick={() => setAppliedFilters(draftFilters)} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"><Filter size={16} />Apply Filters</button>
            <button onClick={() => { setDraftFilters(DEFAULT_FILTERS); setAppliedFilters(DEFAULT_FILTERS); }} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Reset</button>
          </div>
        </Card>

        {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
          {[
            ['Total Billed', formatCurrency(data?.kpis.totalBilled || 0, currency)],
            ['Total Received', `${formatCurrency(data?.kpis.totalReceived || 0, currency)} (${data?.kpis.collectionRate || 0}%)`],
            ['Pending', formatCurrency(data?.kpis.pendingAmount || 0, currency)],
            ['Overdue', formatCurrency(data?.kpis.overdueAmount || 0, currency)],
            ['This Month Revenue', formatCurrency(data?.kpis.monthRevenue || 0, currency)],
            ['Next Payout', formatCurrency(data?.kpis.nextPayout || 0, currency)],
          ].map(([label, value]) => (
            <Card key={String(label)} className="p-4">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{label}</div>
              <div className="mt-2 text-2xl font-bold text-slate-900">
                {loading ? <Skeleton className="h-7 w-24 rounded-md" /> : value}
              </div>
            </Card>
          ))}
        </div>

        <div className="flex gap-6 overflow-x-auto border-b border-slate-200">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.name;
            // Billing Settings is intentionally restricted with a "Soon" badge —
            // the tab still navigates so users can see what's coming, but the
            // panel is read-only.
            const comingSoon = tab.name === 'Billing Settings';
            return (
              <button
                key={tab.name}
                onClick={() => setActiveTab(tab.name)}
                className={`relative flex items-center gap-2 border-b-2 pb-4 text-sm font-semibold whitespace-nowrap ${
                  isActive ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                <Icon size={16} />
                {tab.name}
                {comingSoon ? (
                  <span className="ml-1 rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-700 ring-1 ring-amber-200">
                    Soon
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>

        {loading ? (
          <Card className="p-6">
            <Skeleton className="h-4 w-1/3 rounded-md mb-6" />
            <div className="space-y-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="h-4 w-1/6 rounded-md" />
                  <Skeleton className="h-3 flex-1 rounded-full" />
                  <Skeleton className="h-4 w-24 rounded-md" />
                </div>
              ))}
            </div>
          </Card>
        ) : activeTab === 'Taxes & Compliance' && data ? (
          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="p-6">
              <div className="mb-6 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-slate-900"><Calendar size={16} className="text-blue-600" />Tax Summary</div>
              <div className="space-y-4 text-sm">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3"><span className="text-slate-500">Tax Collected</span><span className="font-semibold">{formatCurrency(data.taxes.outputTax, currency)}</span></div>
                <div className="flex items-center justify-between border-b border-slate-100 pb-3"><span className="text-slate-500">Input Credit</span><span className="font-semibold">{formatCurrency(data.taxes.inputCredit, currency)}</span></div>
                <div className="flex items-center justify-between border-b border-slate-100 pb-3"><span className="text-slate-500">Net Payable</span><span className="font-semibold">{formatCurrency(data.taxes.netPayable, currency)}</span></div>
                <div className="flex items-center justify-between"><span className="text-slate-500">Effective Rate</span><span className="font-semibold">{data.taxes.effectiveRate}%</span></div>
              </div>
            </Card>
            <Card className="p-6">
              <div className="mb-6 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-slate-900"><FileCheck2 size={16} className="text-green-600" />Compliance Status</div>
              <div className="space-y-3">
                {data.taxes.compliance.map((item) => (
                  <div key={item.title} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <div className="mb-2 flex items-center gap-2 font-semibold text-slate-900">
                      {item.status === 'success' ? <CheckCircle2 size={16} className="text-green-600" /> : <AlertCircle size={16} className="text-amber-600" />}
                      {item.title}
                    </div>
                    <p className="text-sm text-slate-600">{item.description}</p>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        ) : activeTab === 'Billing Settings' ? (
          <Card className="relative overflow-hidden p-6">
            {/* Read-only preview of the upcoming Billing Settings panel.
                The form fields render but every input is disabled and the
                Save button is hidden behind a "Coming Soon" overlay. The
                org-level default currency configured under Settings → System
                still drives the actual portal currency. */}
            <div className="grid gap-4 md:grid-cols-2 opacity-60 pointer-events-none select-none">
              {[
                ['invoicePrefix', 'Invoice Prefix'],
                ['defaultCurrency', 'Default Currency'],
                ['defaultPaymentTerms', 'Default Payment Terms'],
                ['bankName', 'Bank Name'],
                ['accountNumber', 'Account Number'],
                ['swiftCode', 'SWIFT / BIC'],
                ['taxLabel', 'Tax Label'],
              ].map(([key, label]) => (
                <div key={key}>
                  <label className="mb-2 block text-[11px] font-bold uppercase tracking-wider text-slate-500">{label}</label>
                  <input
                    value={settingsForm ? ((settingsForm as any)[key] || '') : ''}
                    disabled
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500"
                  />
                </div>
              ))}
              <div>
                <label className="mb-2 block text-[11px] font-bold uppercase tracking-wider text-slate-500">Tax Rate (%)</label>
                <input
                  type="number"
                  value={settingsForm?.taxRate ?? 0}
                  disabled
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500"
                />
              </div>
            </div>
            <div className="mt-8 flex flex-col items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50/60 px-6 py-8 text-center">
              <span className="rounded-full bg-amber-100 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-amber-700 ring-1 ring-amber-200">
                Coming Soon
              </span>
              <p className="max-w-md text-sm text-slate-600">
                Self-serve Billing Settings (invoice prefix, bank details, tax fields…) are getting a dedicated rewrite.
                Until they ship, your <strong>portal currency</strong> is driven by the organization default in{' '}
                <strong>Settings → System</strong> and applies to every invoice, placement, and report automatically.
              </p>
            </div>
          </Card>
        ) : (
          <Card>
            <Table
              columns={columns}
              rows={visibleRows}
              monetaryColumns={monetaryColumns}
              baseCurrency={currency}
              rowCurrency={getRowCurrency}
              onRowCurrencyChange={setRowCurrency}
              // Only the Invoices tab opens the activity drawer — every other
              // tab is a flat list and the row already exposes everything.
              onRowOpen={
                activeTab === 'Invoices'
                  ? (rowId) => setActiveInvoiceId(rowId)
                  : undefined
              }
            />
            {columns.length ? (
              <div className="flex items-center justify-between gap-4 border-t border-[#E5E7EB] px-5 py-4">
                <PaginationAll
                  initialPage={currentPage}
                  totalPages={Math.max(totalPages, 1)}
                  totalCount={tableRows.length}
                  pageSize={pageSize}
                  pageSizeOptions={[...TABLE_PAGE_SIZE_OPTIONS]}
                  onPageSizeChange={(n) => {
                    if (!(TABLE_PAGE_SIZE_OPTIONS as readonly number[]).includes(n)) return;
                    setPageSize(n as TablePageSize);
                    setCurrentPage(1);
                  }}
                  itemLabel="records"
                  onPageChange={setCurrentPage}
                />
              </div>
            ) : null}
          </Card>
        )}
      </div>

      <InvoiceActivityDrawer
        invoiceId={activeInvoiceId}
        open={Boolean(activeInvoiceId)}
        onClose={() => setActiveInvoiceId(null)}
        onCurrencyChanged={() => {
          // Refresh the table so the new currency is reflected immediately
          // for this invoice and any siblings that share its placement.
          // The page exposes its loader on the window for the auto-refresh
          // hook; we reuse it here for a silent reload.
          const fn = (window as any).__billingReload as
            | ((o?: { silent?: boolean }) => Promise<void>)
            | undefined;
          if (fn) void fn({ silent: true });
        }}
      />
    </div>
  );
}
