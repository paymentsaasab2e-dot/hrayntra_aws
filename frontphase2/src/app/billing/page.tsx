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
  FilePenLine,
  Plus,
  Receipt,
  Search,
  Settings,
  Trash2,
  TrendingUp,
  Wallet,
  XCircle,
} from 'lucide-react';
import { SummaryCard, SummaryCardSkeleton, type SummaryCardColor } from '../../components/ui/SummaryCard';
import { toast } from 'sonner';
import { CreatePlacementInvoiceModal } from '../../components/placements/modals/CreatePlacementInvoiceModal';
import { usePlacementInvoiceModal } from '../../hooks/usePlacementInvoiceModal';
import type { Placement } from '../../types/placement';
import {
  apiDeleteBillingRecord,
  apiFetch,
  apiUpdateBillingRecord,
  getCachedOrgDefaultCurrency,
  isOrgBillingNavEnabled,
  ORG_RECRUITMENT_CACHE_EVENT,
} from '../../lib/api';
import { requestConfirm } from '../../lib/appDialog';
import { usePermissions } from '../../hooks/usePermissions';
import { usePageAutoRefresh } from '../../hooks/usePageAutoRefresh';
import { Skeleton } from '../../components/ui/Skeleton';
import { useRouter, useSearchParams } from 'next/navigation';
import PaginationAll from '../../components/PaginationAll';
import { TABLE_PAGE_SIZE_OPTIONS, type TablePageSize } from '../../constants/tablePagination';
import InvoiceActivityDrawer from '../../components/billing/InvoiceActivityDrawer';
import { TableAuditColumnHeader, TableAuditCell } from '../../components/table/TableAuditCell';
import type { AuditMeta } from '../../types/audit';
import {
  SUPPORTED_CURRENCIES,
  convertAmount,
  formatCurrencyAmount,
} from '../../utils/currency';

type BillingTab =
  | 'Saved drafts'
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
    draftCount?: number;
    collectionRate: number;
  };
  draftInvoices?: Array<Record<string, any>>;
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
  { name: 'Saved drafts', icon: FilePenLine },
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

const BILLING_FILTER_SELECT =
  'rounded-lg border border-indigo-100/90 bg-white/95 px-2.5 py-1.5 text-xs font-medium text-slate-800 shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500/25 focus:border-indigo-300 cursor-pointer hover:border-indigo-200/90 hover:bg-indigo-50/40';

const TABLE_TABS: BillingTab[] = [
  'Saved drafts',
  'Invoices',
  'Payments',
  'Clients & Contracts',
  'Commission & Payouts',
];

const TAB_EXPORT_KEY: Record<BillingTab, string> = {
  'Saved drafts': 'saved-drafts',
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
  'Saved drafts': ['Invoice #', 'Client', 'Candidate', 'Job', 'Date', 'Due Date', 'Amount', 'Total', 'Status'],
  Invoices: ['Invoice #', 'Client', 'Candidate', 'Job', 'Date', 'Due Date', 'Amount', 'Total', 'Status'],
  Payments: ['Receipt #', 'Client', 'Amount', 'Mode', 'Date', 'Received By', 'Status'],
  'Clients & Contracts': ['Client', 'Status', 'Industry', 'Location', 'Owner', 'SLA'],
  'Commission & Payouts': ['Recruiter', 'Placement', 'Commission %', 'Amount', 'Status', 'Payout Date'],
};

function formatCurrency(value: number, currency = 'USD') {
  return formatCurrencyAmount(Number(value || 0), currency);
}

const MONETARY_COLUMNS_BY_TAB: Record<string, Set<string>> = {
  'Saved drafts': new Set(['Amount', 'Total']),
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

function InvoiceStatusSelect({
  value,
  disabled,
  onChange,
}: {
  value: string;
  disabled?: boolean;
  onChange: (next: 'Paid' | 'Pending') => void;
}) {
  const normalized = String(value || '').toLowerCase();
  const isPaid = normalized === 'paid' || normalized === 'confirmed';
  if (isPaid) {
    return <Badge value={value} />;
  }
  return (
    <select
      value={value}
      disabled={disabled}
      onClick={(event) => event.stopPropagation()}
      onChange={(event) => {
        const next = event.target.value as 'Paid' | 'Pending';
        if (next === 'Paid') onChange(next);
      }}
      className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800 outline-none focus:border-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
      title="Change invoice status"
    >
      <option value={value}>{value}</option>
      <option value="Paid">Paid</option>
    </select>
  );
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
          : key === 'draft' || key === 'sent'
            ? 'bg-slate-100 text-slate-700 border-slate-200'
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
  onRowClick,
  onRowDelete,
  canUpdateInvoiceStatus,
  updatingInvoiceId,
  deletingRowId,
  onInvoiceStatusChange,
  showRecordLog,
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
  onRowClick?: (rowId: string, row: Record<string, any>) => void;
  onRowDelete?: (rowId: string, row: Record<string, any>) => void;
  canUpdateInvoiceStatus?: boolean;
  updatingInvoiceId?: string | null;
  deletingRowId?: string | null;
  onInvoiceStatusChange?: (invoiceId: string) => void;
  showRecordLog?: boolean;
}) {
  const trailingActionColumn = onRowOpen || onRowDelete ? 1 : 0;
  const recordLogColumn = showRecordLog ? 1 : 0;
  const totalCols = columns.length + recordLogColumn + trailingActionColumn;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[900px] border-collapse">
        <thead>
          <tr className="bg-gradient-to-r from-slate-50/95 via-indigo-50/50 to-violet-50/40 border-b border-indigo-100/50 text-indigo-950/45 uppercase text-[9px] font-bold tracking-[0.12em]">
            {columns.map((column) => (
              <th key={column} className="px-3 sm:px-4 py-2 text-left first:pl-4">
                {column}
              </th>
            ))}
            {showRecordLog ? <TableAuditColumnHeader className="py-2" /> : null}
            {trailingActionColumn ? (
              <th className="px-3 sm:px-4 py-2 text-right">Actions</th>
            ) : null}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100/80">
          {rows.length ? (
            rows.map((row, index) => {
              const rowId = String(row.id ?? index);
              return (
                <tr
                  key={rowId}
                  className={`transition-colors duration-200 even:bg-slate-50/35 hover:bg-indigo-50/45 ${
                    onRowClick ? 'cursor-pointer' : ''
                  }`}
                  onClick={onRowClick ? () => onRowClick(rowId, row) : undefined}
                >
                  {columns.map((column) => {
                    const value = row[column];
                    const isStatus = column === 'Status';
                    const isMonetary = monetaryColumns.has(column) && typeof value === 'number';
                    return (
                      <td
                        key={column}
                        className="px-4 py-3 text-sm text-slate-700"
                        onClick={(event) => {
                          if (isStatus || isMonetary) event.stopPropagation();
                        }}
                      >
                        {isStatus && canUpdateInvoiceStatus && onInvoiceStatusChange ? (
                          <InvoiceStatusSelect
                            value={String(value ?? 'Pending')}
                            disabled={updatingInvoiceId === rowId}
                            onChange={() => onInvoiceStatusChange(rowId)}
                          />
                        ) : isStatus ? (
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
                  {showRecordLog ? (
                    <TableAuditCell
                      audit={(row.auditMeta as AuditMeta | null | undefined) ?? null}
                      className="py-3"
                    />
                  ) : null}
                  {trailingActionColumn ? (
                    <td className="px-3 py-3 text-right" onClick={(event) => event.stopPropagation()}>
                      <div className="inline-flex items-center justify-end gap-1">
                        {onRowDelete ? (
                          <button
                            type="button"
                            disabled={deletingRowId === rowId}
                            onClick={() => onRowDelete(rowId, row)}
                            className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 hover:border-rose-300 hover:bg-rose-50 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-50"
                            aria-label="Delete draft"
                            title="Delete draft"
                          >
                            <Trash2 size={14} />
                          </button>
                        ) : null}
                        {onRowOpen ? (
                          <button
                            type="button"
                            onClick={() => onRowOpen(rowId, row)}
                            className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-600"
                            aria-label="Open activity timeline"
                            title="See full activity for this entry"
                          >
                            <ChevronRight size={14} />
                          </button>
                        ) : null}
                      </div>
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
  const searchParams = useSearchParams();
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
  const canCreateInvoice = hasPermission('create_invoice');
  const canCreatePlacement = hasPermission('placements_create');
  const canRecordPayment = hasPermission('record_payment') || canCreateInvoice;
  const [updatingInvoiceId, setUpdatingInvoiceId] = useState<string | null>(null);
  const [deletingDraftId, setDeletingDraftId] = useState<string | null>(null);
  const [invoiceModalOpen, setInvoiceModalOpen] = useState(false);
  const [invoicePlacementId, setInvoicePlacementId] = useState<string | undefined>();
  const [editBillingRecordId, setEditBillingRecordId] = useState<string | undefined>();
  const [currentUserId, setCurrentUserId] = useState<string | undefined>();
  const {
    placements: invoicePlacements,
    candidateOptions,
    jobOptions,
    recruiterOptions,
    submitting: invoiceSubmitting,
    createPlacement,
    createInvoice,
    updateDraftInvoice,
  } = usePlacementInvoiceModal(invoiceModalOpen);

  useEffect(() => {
    try {
      const currentUser = localStorage.getItem('currentUser');
      if (!currentUser) return;
      const parsed = JSON.parse(currentUser);
      setCurrentUserId(parsed.id);
    } catch {
      setCurrentUserId(undefined);
    }
  }, []);

  useEffect(() => {
    if (!canCreateInvoice) return;
    const shouldOpen =
      searchParams.get('createInvoice') === '1' || searchParams.get('createInvoice') === 'true';
    if (!shouldOpen) return;
    const placementId = searchParams.get('placementId') || undefined;
    setInvoicePlacementId(placementId);
    setInvoiceModalOpen(true);
    router.replace('/billing');
  }, [canCreateInvoice, router, searchParams]);
  const [activeTab, setActiveTab] = useState<BillingTab>('Invoices');
  const [filters, setFilters] = useState<FiltersState>(DEFAULT_FILTERS);
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
        const query = buildQuery(filters);
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
  }, [filters]);

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
    if (activeTab === 'Saved drafts') {
      return (data.draftInvoices || []).map((row) => ({
        id: row.id ?? row.invoiceNumber,
        placementId: row.placementId || '',
        'Invoice #': row.invoiceNumber,
        Client: row.clientName,
        Candidate: row.candidateName,
        Job: row.jobTitle,
        Date: row.date,
        'Due Date': row.dueDate,
        Amount: Number(row.amount || 0),
        Total: Number(row.total || 0),
        Status: row.status,
        auditMeta: row.auditMeta ?? null,
      }));
    }
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
        auditMeta: row.auditMeta ?? null,
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
    ? Object.keys(tableRows[0]).filter((column) => column !== 'id' && column !== 'auditMeta')
    : activeTab === 'Taxes & Compliance' || activeTab === 'Billing Settings'
      ? []
      : DEFAULT_COLUMNS[activeTab];

  const totalPages = Math.max(Math.ceil(tableRows.length / pageSize), 1);
  const visibleRows = tableRows.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, filters, data]);

  async function exportTab(format: 'csv' | 'excel' | 'pdf') {
    try {
      setExporting(format);
      const query = buildQuery(filters);
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

  const reloadBilling = () => {
    const fn = (window as any).__billingReload as ((o?: { silent?: boolean }) => Promise<void>) | undefined;
    if (fn) void fn({ silent: true });
  };

  async function deleteDraftInvoice(invoiceId: string, invoiceNumber?: string) {
    if (!canCreateInvoice) return;

    const label = invoiceNumber?.trim() || 'this draft';
    const confirmed = await requestConfirm(
      `Are you sure you want to delete draft invoice "${label}"? This action cannot be undone.`,
      {
        title: 'Delete draft invoice?',
        tone: 'warning',
        confirmLabel: 'Delete',
        cancelLabel: 'Cancel',
      },
    );
    if (!confirmed) return;

    try {
      setDeletingDraftId(invoiceId);
      await apiDeleteBillingRecord(invoiceId);

      if (editBillingRecordId === invoiceId) {
        setInvoiceModalOpen(false);
        setEditBillingRecordId(undefined);
        setInvoicePlacementId(undefined);
      }
      if (activeInvoiceId === invoiceId) {
        setActiveInvoiceId(null);
      }

      toast.success(`Draft ${label} deleted`);
      window.dispatchEvent(new CustomEvent('jobportal:billing-changed'));
      window.dispatchEvent(new CustomEvent('jobportal:placements-changed'));
      reloadBilling();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to delete draft');
    } finally {
      setDeletingDraftId(null);
    }
  }

  async function markInvoicePaid(invoiceId: string) {
    if (!canRecordPayment) return;
    try {
      setUpdatingInvoiceId(invoiceId);
      await apiUpdateBillingRecord(invoiceId, { status: 'PAID' });
      toast.success('Invoice marked as paid');
      window.dispatchEvent(new CustomEvent('jobportal:billing-changed'));
      window.dispatchEvent(new CustomEvent('jobportal:placements-changed'));
      reloadBilling();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to update invoice status');
    } finally {
      setUpdatingInvoiceId(null);
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

  const showsTablePanel = TABLE_TABS.includes(activeTab);

  const clearFilters = () => {
    setCurrentPage(1);
    setFilters(DEFAULT_FILTERS);
  };

  const patchFilter = (patch: Partial<FiltersState>) => {
    setCurrentPage(1);
    setFilters((current) => ({ ...current, ...patch }));
  };

  return (
    <div className="w-full min-h-screen overflow-hidden text-slate-900">
      <main className="flex flex-col overflow-hidden relative">
        <header className="min-h-[4.5rem] flex flex-wrap items-center justify-between gap-3 px-4 sm:px-6 py-3 shrink-0 border-b border-indigo-100/50 bg-white/80 backdrop-blur-md shadow-[inset_0_-1px_0_0_rgba(99,102,241,0.08)]">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 via-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-500/30 ring-1 ring-white/20">
              <Receipt className="h-5 w-5" strokeWidth={2.2} />
            </div>
            <div>
              <h1 className="text-xl sm:text-[1.35rem] font-bold tracking-tight text-slate-900 leading-none">Billing</h1>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {canCreateInvoice ? (
              <button
                type="button"
                onClick={() => {
                  setEditBillingRecordId(undefined);
                  setInvoicePlacementId(undefined);
                  setInvoiceModalOpen(true);
                }}
                className="bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 hover:from-blue-700 hover:via-indigo-700 hover:to-violet-700 text-white px-3.5 py-2 rounded-lg font-semibold text-xs flex items-center gap-1.5 transition-all shadow-lg shadow-indigo-500/30 active:scale-[0.98]"
              >
                <Plus size={16} className="text-white" strokeWidth={2.5} />
                <span>Create invoice</span>
              </button>
            ) : null}
            {canExportData ? (
              <button
                type="button"
                onClick={() => exportTab('csv')}
                className="bg-white hover:bg-indigo-50/90 text-indigo-900 px-3 py-2 rounded-lg font-semibold text-xs flex items-center gap-1.5 transition-all shadow-[0_4px_14px_-4px_rgba(99,102,241,0.25)] border border-indigo-200/70 hover:border-indigo-300 active:scale-[0.98]"
              >
                <Download size={16} className="text-indigo-600" strokeWidth={2.25} />
                <span>{exporting === 'csv' ? 'Exporting…' : 'CSV'}</span>
              </button>
            ) : null}
            {canExportData ? (
              <button
                type="button"
                onClick={() => exportTab('excel')}
                className="bg-white hover:bg-indigo-50/90 text-indigo-900 px-3 py-2 rounded-lg font-semibold text-xs transition-all border border-indigo-200/70 hover:border-indigo-300 active:scale-[0.98]"
              >
                {exporting === 'excel' ? 'Exporting…' : 'Excel'}
              </button>
            ) : null}
            {canExportData ? (
              <button
                type="button"
                onClick={() => exportTab('pdf')}
                className="bg-white hover:bg-indigo-50/90 text-indigo-900 px-3 py-2 rounded-lg font-semibold text-xs flex items-center gap-1.5 transition-all border border-indigo-200/70 hover:border-indigo-300 active:scale-[0.98]"
              >
                <Download size={16} className="text-indigo-600" strokeWidth={2.25} />
                <span>{exporting === 'pdf' ? 'Exporting…' : 'PDF'}</span>
              </button>
            ) : null}
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-3 py-4 sm:px-5 sm:py-6 lg:px-6">
          {error ? (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
          ) : null}

          <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4 mb-5">
            {loading ? (
              (['blue', 'green', 'indigo', 'purple'] as SummaryCardColor[]).map((c, i) => (
                <SummaryCardSkeleton key={i} color={c} />
              ))
            ) : (
              <>
                <SummaryCard
                  label="Total Billed"
                  count={formatCurrency(data?.kpis.totalBilled || 0, currency)}
                  color="blue"
                  icon={<Receipt size={16} strokeWidth={2.35} />}
                />
                <SummaryCard
                  label="Total Received"
                  count={formatCurrency(data?.kpis.totalReceived || 0, currency)}
                  color="green"
                  icon={<CheckCircle2 size={16} strokeWidth={2.35} />}
                  hint={`${data?.kpis.collectionRate || 0}%`}
                />
                <SummaryCard
                  label="This Month"
                  count={formatCurrency(data?.kpis.monthRevenue || 0, currency)}
                  color="indigo"
                  icon={<TrendingUp size={16} strokeWidth={2.35} />}
                />
                <SummaryCard
                  label="Next Payout"
                  count={formatCurrency(data?.kpis.nextPayout || 0, currency)}
                  color="purple"
                  icon={<CreditCard size={16} strokeWidth={2.35} />}
                />
              </>
            )}
          </div>

          <div className="mb-4 flex gap-4 overflow-x-auto border-b border-indigo-100/70">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.name;
              const comingSoon = tab.name === 'Billing Settings';
              return (
                <button
                  key={tab.name}
                  type="button"
                  onClick={() => setActiveTab(tab.name)}
                  className={`relative flex items-center gap-2 border-b-2 pb-3 text-xs font-semibold whitespace-nowrap transition-colors ${
                    isActive
                      ? 'border-indigo-600 text-indigo-700'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Icon size={15} />
                  {tab.name}
                  {tab.name === 'Saved drafts' && !loading && (data?.kpis.draftCount ?? 0) > 0 ? (
                    <span className="ml-0.5 rounded-full bg-indigo-100 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-indigo-800">
                      {data?.kpis.draftCount}
                    </span>
                  ) : null}
                  {comingSoon ? (
                    <span className="ml-0.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-700 ring-1 ring-amber-200">
                      Soon
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>

        {loading && showsTablePanel ? (
          <div className="overflow-hidden rounded-xl border border-indigo-100/60 bg-white/70 shadow-[0_12px_40px_-18px_rgba(59,130,246,0.18)] p-6">
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
          </div>
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
        ) : showsTablePanel ? (
          <div className="overflow-hidden rounded-xl border border-indigo-100/60 bg-white/70 shadow-[0_12px_40px_-18px_rgba(59,130,246,0.18)] backdrop-blur-sm transition-shadow hover:shadow-[0_16px_48px_-14px_rgba(79,70,229,0.16)]">
            <div className="p-3 sm:p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-indigo-100/40 bg-gradient-to-br from-white via-indigo-50/25 to-violet-50/20">
              <div className="relative w-full lg:max-w-md lg:flex-1">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-indigo-400"
                  size={16}
                  strokeWidth={2.25}
                />
                <input
                  type="text"
                  placeholder="Search invoices, clients, candidates..."
                  className="w-full h-9 pl-10 pr-3 bg-white/95 border border-indigo-100/90 rounded-xl text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-300 transition-all [box-shadow:inset_0_1px_2px_rgba(15,23,42,0.04)]"
                  value={filters.search}
                  onChange={(e) => patchFilter({ search: e.target.value })}
                />
              </div>

              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                <select
                  className={BILLING_FILTER_SELECT}
                  value={filters.dateRange}
                  onChange={(e) => patchFilter({ dateRange: e.target.value })}
                >
                  {(data?.options.dateRanges || []).map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>

                <select
                  className={BILLING_FILTER_SELECT}
                  value={filters.clientId}
                  onChange={(e) => patchFilter({ clientId: e.target.value })}
                >
                  <option value="">All Clients</option>
                  {(data?.options.clients || []).map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.name}
                    </option>
                  ))}
                </select>

                <select
                  className={BILLING_FILTER_SELECT}
                  value={filters.recruiterId}
                  onChange={(e) => patchFilter({ recruiterId: e.target.value })}
                >
                  <option value="">All Recruiters</option>
                  {(data?.options.recruiters || []).map((recruiter) => (
                    <option key={recruiter.id} value={recruiter.id}>
                      {recruiter.name}
                    </option>
                  ))}
                </select>

                <select
                  className={BILLING_FILTER_SELECT}
                  value={filters.invoiceStatus}
                  onChange={(e) => patchFilter({ invoiceStatus: e.target.value })}
                >
                  <option value="">All Status</option>
                  {(data?.options.invoiceStatuses || []).map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  className="text-xs text-rose-600 hover:text-rose-700 font-semibold px-2 py-1.5 rounded-lg hover:bg-rose-50 flex items-center gap-1 transition-colors"
                  onClick={clearFilters}
                >
                  <XCircle size={15} className="text-rose-500 shrink-0" strokeWidth={2.35} />
                  Clear
                </button>
              </div>
            </div>

            {activeTab === 'Saved drafts' ? (
              <div className="border-b border-indigo-50/80 bg-indigo-50/20 px-4 py-2.5 text-xs text-slate-600">
                Saved drafts from <span className="font-semibold text-slate-800">Create invoice</span> — click a row to
                edit, chevron for activity, trash to delete.
              </div>
            ) : null}

            <div className="overflow-x-auto">
              <Table
                columns={columns}
                rows={visibleRows}
                monetaryColumns={monetaryColumns}
                baseCurrency={currency}
                rowCurrency={getRowCurrency}
                onRowCurrencyChange={setRowCurrency}
                canUpdateInvoiceStatus={activeTab === 'Invoices' && canRecordPayment}
                updatingInvoiceId={updatingInvoiceId}
                onInvoiceStatusChange={activeTab === 'Invoices' ? markInvoicePaid : undefined}
                deletingRowId={deletingDraftId}
                onRowClick={
                  activeTab === 'Saved drafts' && canCreateInvoice
                    ? (rowId, row) => {
                        setEditBillingRecordId(rowId);
                        setInvoicePlacementId(String(row.placementId || '') || undefined);
                        setInvoiceModalOpen(true);
                      }
                    : undefined
                }
                onRowDelete={
                  activeTab === 'Saved drafts' && canCreateInvoice
                    ? (rowId, row) => {
                        void deleteDraftInvoice(rowId, String(row['Invoice #'] || ''));
                      }
                    : undefined
                }
                onRowOpen={
                  activeTab === 'Invoices' || activeTab === 'Saved drafts'
                    ? (rowId) => {
                        setActiveInvoiceId(rowId);
                      }
                    : undefined
                }
                showRecordLog={activeTab === 'Invoices' || activeTab === 'Saved drafts'}
              />
            </div>

            {columns.length ? (
              <div className="flex items-center justify-between gap-4 border-t border-indigo-100/50 px-4 sm:px-5 py-3">
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
          </div>
        ) : null}
        </div>
      </main>

      <CreatePlacementInvoiceModal
        isOpen={canCreateInvoice && invoiceModalOpen}
        placements={invoicePlacements}
        initialPlacementId={invoicePlacementId}
        initialBillingRecordId={editBillingRecordId}
        isSubmitting={invoiceSubmitting}
        canCreatePlacement={canCreatePlacement}
        currentUserId={currentUserId}
        candidates={candidateOptions}
        jobs={jobOptions}
        recruiters={recruiterOptions}
        onClose={() => {
          setInvoiceModalOpen(false);
          setInvoicePlacementId(undefined);
          setEditBillingRecordId(undefined);
        }}
        onSubmit={async ({ placementId, billingRecordId, newPlacement, invoice, intent }) => {
          const closeModal = intent !== 'send';
          try {
            let updated: Placement | Record<string, any> | undefined;
            let resolvedBillingRecordId = billingRecordId;
            let inv = invoice.invoiceNo || '';

            if (billingRecordId) {
              updated = await updateDraftInvoice(billingRecordId, invoice);
              inv = updated?.invoiceNumber || invoice.invoiceNo || '';
              resolvedBillingRecordId = billingRecordId;
              if (closeModal) {
                toast.success(inv ? `Draft ${inv} updated` : 'Draft invoice updated');
              }
            } else {
              let targetId = placementId;
              if (newPlacement) {
                const created = await createPlacement(newPlacement);
                if (!created?.id) {
                  throw new Error('Placement was created but could not be loaded');
                }
                targetId = created.id;
              }
              if (!targetId) {
                throw new Error('No placement selected');
              }
              updated = await createInvoice(targetId, invoice);
              inv =
                updated?.createdInvoice?.invoiceNumber ||
                updated?.invoiceNumber ||
                updated?.billing?.[0]?.invoiceNumber ||
                invoice.invoiceNo ||
                '';
              resolvedBillingRecordId = updated?.createdInvoice?.id;
              if (closeModal) {
                toast.success(
                  newPlacement
                    ? inv
                      ? `Placement and invoice ${inv} created`
                      : 'Placement and invoice created'
                    : inv
                      ? `Invoice ${inv} created`
                      : 'Invoice created successfully',
                );
              }
            }

            if (closeModal) {
              setInvoiceModalOpen(false);
              setInvoicePlacementId(undefined);
              setEditBillingRecordId(undefined);
            }
            window.dispatchEvent(new CustomEvent('jobportal:billing-changed'));
            window.dispatchEvent(new CustomEvent('jobportal:placements-changed'));
            if (closeModal) reloadBilling();
            return {
              placement: updated as Placement,
              invoiceNumber: inv,
              billingRecordId: resolvedBillingRecordId,
            };
          } catch (invoiceError: any) {
            toast.error(invoiceError.message || 'Failed to create invoice');
            throw invoiceError;
          }
        }}
      />

      <InvoiceActivityDrawer
        invoiceId={activeInvoiceId}
        open={Boolean(activeInvoiceId)}
        onClose={() => setActiveInvoiceId(null)}
        onCurrencyChanged={() => reloadBilling()}
        onStatusChanged={() => reloadBilling()}
      />
    </div>
  );
}
