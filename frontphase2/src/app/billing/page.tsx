'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Briefcase,
  Building2,
  Calendar,
  CheckCircle2,
  ChevronRight,
  CreditCard,
  Download,
  FileCheck2,
  Filter,
  Receipt,
  Save,
  Search,
  Settings,
  Wallet,
} from 'lucide-react';
import { apiFetch, buildApiUrl } from '../../lib/api';

type BillingTab =
  | 'Invoices'
  | 'Payments'
  | 'Placements Billing'
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

const TABS: Array<{ name: BillingTab; icon: React.ComponentType<{ size?: number; className?: string }> }> = [
  { name: 'Invoices', icon: Receipt },
  { name: 'Payments', icon: CreditCard },
  { name: 'Placements Billing', icon: Briefcase },
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
  'Placements Billing': 'placements-billing',
  'Clients & Contracts': 'clients-contracts',
  'Commission & Payouts': 'commission-payouts',
  'Taxes & Compliance': 'taxes-compliance',
  'Billing Settings': 'billing-settings',
};

const DEFAULT_COLUMNS: Record<Exclude<BillingTab, 'Taxes & Compliance' | 'Billing Settings'>, string[]> = {
  Invoices: ['Invoice #', 'Client', 'Candidate', 'Job', 'Date', 'Due Date', 'Amount', 'Total', 'Status'],
  Payments: ['Source', 'Client', 'Invoice #', 'Amount', 'Mode', 'Transaction', 'Date', 'Received By', 'Status'],
  'Placements Billing': ['Candidate', 'Job', 'Client', 'Recruiter', 'Joining Date', 'Billing Type', 'Fee', 'Invoice Generated', 'Status'],
  'Clients & Contracts': ['Client', 'Status', 'Industry', 'Location', 'Owner', 'Placements', 'Invoices', 'Billed', 'Outstanding', 'SLA'],
  'Commission & Payouts': ['Recruiter', 'Placement', 'Commission %', 'Amount', 'Status', 'Payout Date'],
};

function formatCurrency(value: number, currency = 'USD') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function buildQuery(filters: FiltersState) {
  const params = new URLSearchParams();
  if (filters.dateRange) params.set('dateRange', filters.dateRange);
  if (filters.clientId) params.set('clientId', filters.clientId);
  if (filters.recruiterId) params.set('recruiterId', filters.recruiterId);
  if (filters.invoiceStatus) params.set('invoiceStatus', filters.invoiceStatus);
  if (filters.search) params.set('search', filters.search);
  return params.toString();
}

function getUploadUrl(fileUrl: string) {
  const base = buildApiUrl('/').replace(/\/api\/v1\/?$/, '').replace(/\/api\/proxy\/?$/, '');
  return fileUrl.startsWith('http') ? fileUrl : `${base}${fileUrl}`;
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

function Table({ columns, rows }: { columns: string[]; rows: Array<Record<string, any>> }) {
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
          </tr>
        </thead>
        <tbody>
          {rows.length ? (
            rows.map((row, index) => (
              <tr key={row.id || index} className="border-b border-slate-50 last:border-b-0">
                {columns.map((column) => (
                  <td key={column} className="px-4 py-3 text-sm text-slate-700">
                    {String(column).toLowerCase().includes('status') ? <Badge value={String(row[column] ?? '-')} /> : row[column] ?? '-'}
                  </td>
                ))}
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={columns.length} className="px-4 py-10 text-center text-sm text-slate-500">
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
  const [activeTab, setActiveTab] = useState<BillingTab>('Invoices');
  const [draftFilters, setDraftFilters] = useState<FiltersState>(DEFAULT_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState<FiltersState>(DEFAULT_FILTERS);
  const [data, setData] = useState<SummaryResponse | null>(null);
  const [settingsForm, setSettingsForm] = useState<BillingSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [exporting, setExporting] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
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
        if (active) setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [appliedFilters]);

  const currency = data?.settings?.defaultCurrency || 'USD';

  const tableRows = useMemo(() => {
    if (!data) return [];
    if (activeTab === 'Invoices') {
      return data.invoices.map((row) => ({
        'Invoice #': row.invoiceNumber,
        Client: row.clientName,
        Candidate: row.candidateName,
        Job: row.jobTitle,
        Date: row.date,
        'Due Date': row.dueDate,
        Amount: formatCurrency(row.amount, currency),
        Total: formatCurrency(row.total, currency),
        Status: row.status,
      }));
    }
    if (activeTab === 'Payments') {
      return data.payments.map((row) => ({
        Source: row.source,
        Client: row.clientName,
        'Invoice #': row.invoiceNumber,
        Amount: formatCurrency(row.amount, currency),
        Mode: row.mode,
        Transaction: row.transactionId,
        Date: row.date,
        'Received By': row.receivedBy,
        Status: row.status,
      }));
    }
    if (activeTab === 'Placements Billing') {
      return data.placements.map((row) => ({
        Candidate: row.candidate,
        Job: row.jobTitle,
        Client: row.client,
        Recruiter: row.recruiter,
        'Joining Date': row.joiningDate,
        'Billing Type': row.billingType,
        Fee: formatCurrency(row.fee, currency),
        'Invoice Generated': row.invoiceGenerated ? 'Yes' : 'No',
        Status: row.status,
      }));
    }
    if (activeTab === 'Clients & Contracts') {
      return data.clients.map((row) => ({
        Client: row.name,
        Status: row.status,
        Industry: row.industry,
        Location: row.location,
        Owner: row.owner,
        Placements: row.placements,
        Invoices: row.invoices,
        Billed: formatCurrency(row.totalBilled, currency),
        Outstanding: formatCurrency(row.outstanding, currency),
        SLA: row.sla,
      }));
    }
    if (activeTab === 'Commission & Payouts') {
      return data.commissions.map((row) => ({
        Recruiter: row.recruiter,
        Placement: row.placement,
        'Commission %': `${row.percentage}%`,
        Amount: formatCurrency(row.amount, currency),
        Status: row.status,
        'Payout Date': row.date,
      }));
    }
    return [];
  }, [activeTab, currency, data]);

  const columns = tableRows[0]
    ? Object.keys(tableRows[0])
    : activeTab === 'Taxes & Compliance' || activeTab === 'Billing Settings'
      ? []
      : DEFAULT_COLUMNS[activeTab];

  async function exportTab(format: 'csv' | 'excel' | 'pdf') {
    try {
      setExporting(format);
      const query = buildQuery(appliedFilters);
      const key = TAB_EXPORT_KEY[activeTab];
      const response = await apiFetch<{ fileUrl: string }>(`/billing/export/${key}/${format}?${query}`, { auth: true });
      window.open(getUploadUrl(response.data.fileUrl), '_blank');
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
            <button onClick={() => exportTab('csv')} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">{exporting === 'csv' ? 'Exporting...' : 'CSV'}</button>
            <button onClick={() => exportTab('excel')} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">{exporting === 'excel' ? 'Exporting...' : 'Excel'}</button>
            <button onClick={() => exportTab('pdf')} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"><Download size={16} />{exporting === 'pdf' ? 'Exporting...' : 'PDF'}</button>
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
            {[{ key: 'dateRange', label: 'Date Range', options: data?.options.dateRanges || [] }, { key: 'clientId', label: 'Client', options: [{ id: '', name: 'All Clients' }, ...(data?.options.clients || [])] }, { key: 'recruiterId', label: 'Recruiter', options: [{ id: '', name: 'All Recruiters' }, ...(data?.options.recruiters || [])] }, { key: 'invoiceStatus', label: 'Invoice Status', options: [{ id: '', name: 'All Statuses' }, ...((data?.options.invoiceStatuses || []).map((value) => ({ id: value, name: value })))] }].map((field) => (
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
              <div className="mt-2 text-2xl font-bold text-slate-900">{loading ? '...' : value}</div>
            </Card>
          ))}
        </div>

        <div className="flex gap-6 overflow-x-auto border-b border-slate-200">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.name;
            return (
              <button key={tab.name} onClick={() => setActiveTab(tab.name)} className={`flex items-center gap-2 border-b-2 pb-4 text-sm font-semibold whitespace-nowrap ${isActive ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
                <Icon size={16} />
                {tab.name}
              </button>
            );
          })}
        </div>

        {loading ? (
          <Card className="p-10 text-center text-sm text-slate-500">Loading billing data...</Card>
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
        ) : activeTab === 'Billing Settings' && settingsForm ? (
          <Card className="p-6">
            <div className="grid gap-4 md:grid-cols-2">
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
                  <input value={(settingsForm as any)[key]} onChange={(e) => setSettingsForm((current) => current ? { ...current, [key]: e.target.value } : current)} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500" />
                </div>
              ))}
              <div>
                <label className="mb-2 block text-[11px] font-bold uppercase tracking-wider text-slate-500">Tax Rate (%)</label>
                <input type="number" value={settingsForm.taxRate} onChange={(e) => setSettingsForm((current) => current ? { ...current, taxRate: Number(e.target.value || 0) } : current)} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500" />
              </div>
            </div>
            <div className="mt-6">
              <button onClick={saveSettings} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"><Save size={16} />{savingSettings ? 'Saving...' : 'Save Settings'}</button>
            </div>
          </Card>
        ) : (
          <Card>
            <Table columns={columns} rows={tableRows} />
          </Card>
        )}
      </div>
    </div>
  );
}
