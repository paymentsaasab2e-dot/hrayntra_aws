'use client';

/**
 * HQ Reports — analytics control tower for Employees, Employers, CRM, and HQ Operations.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BarChart3, Download, RefreshCw, X } from 'lucide-react';
import { toast } from 'sonner';
import { HqModulePageLayout } from '@/components/hq/HqModulePageLayout';
import { useHqMoney } from '@/components/hq/HqCurrencyProvider';
import type { HqDemoRequestRow } from '@/app/hq/leads/hqLeadsData';
import {
  apiHqGetBilling,
  apiHqListCandidates,
  apiHqListCompanies,
  apiHqListCourses,
  apiHqListCustomReports,
  apiHqListDemoRequests,
  apiHqListHelpTickets,
  apiHqListKycInterviewers,
  apiHqListLeads,
  apiHqListPortal,
  apiHqListRecycleBin,
  apiHqListTeam,
  apiHqListTenants,
  apiHqListTickets,
  type HqBillingPayload,
  type HqCompanyApiRow,
  type HqCourseRow,
  type HqCustomReportRow,
  type HqHelpTicket,
  type HqKycInterviewerRow,
  type HqLeadApiRow,
  type HqPortalCandidateRow,
  type HqPortalJobRow,
  type HqSupportTicket,
  type HqTeamMemberRow,
  type HqTenantRow,
} from '@/lib/api';
import { apiListHqPortalEvents, type PortalEventRow } from '@/lib/portal-events-api';
import { HqCustomReportsPanel } from './HqCustomReportsPanel';
import { HqReportChartGrid } from './HqReportCharts';
import { HqReportInsightRow, HqReportKpiRow } from './HqReportKpiRow';
import { HqReportRecordsTable } from './HqReportRecordsTable';
import { HqReportsDashNav } from './HqReportsNav';
import { HQ_REPORT_NAV, hqReportPageTitle, type HqReportPageId } from './hqReportsCatalog';
import {
  downloadCsv,
  inDateRange,
  resolveReportRange,
  type HqReportRange,
} from './hqReportsBuild';
import { applyHqChartFilter, buildHqReportVisuals, type HqChartFilter } from './hqReportsVisuals';
import { buildHqReportView, type HqReportSourceData } from './hqReportsViews';
import { HQ_REPORTS_BTN_PRIMARY, HQ_REPORTS_BTN_SECONDARY } from './hqReportsChrome';

const RANGE_OPTIONS: Array<{ id: HqReportRange; label: string }> = [
  { id: 'all', label: 'All' },
  { id: '7d', label: '7 Days' },
  { id: '30d', label: '30 Days' },
  { id: '90d', label: '90 Days' },
  { id: 'custom', label: 'Custom' },
];

const FILTER_KEYS = new Set([
  'origin',
  'status',
  'stage',
  'kind',
  'category',
  'type',
  'source',
  'plan',
  'score',
  'priority',
  'mode',
  'workMode',
  'industry',
  'country',
  'owner',
  'cycle',
  'trial',
  'department',
  'role',
  'company',
]);

function isReportPageId(value: string | null): value is HqReportPageId {
  return HQ_REPORT_NAV.some((group) => group.pages.some((page) => page.id === value));
}

type HqReportSourceKey =
  | 'leads'
  | 'companies'
  | 'demos'
  | 'tenants'
  | 'tickets'
  | 'team'
  | 'candidates'
  | 'kyc'
  | 'courses'
  | 'jobs'
  | 'events'
  | 'helpTickets'
  | 'recycle'
  | 'billing'
  | 'reports';

type HqSourceStatus = 'idle' | 'loading' | 'ready' | 'error';

const SOURCE_TIMEOUT_MS = 12000;
const HEAVY_SOURCE_TIMEOUT_MS = 25000;
const HEAVY_SOURCES = new Set<HqReportSourceKey>(['candidates', 'jobs', 'billing', 'tenants', 'kyc']);

function sourceTimeoutMs(key: HqReportSourceKey) {
  return HEAVY_SOURCES.has(key) ? HEAVY_SOURCE_TIMEOUT_MS : SOURCE_TIMEOUT_MS;
}

const PAGE_SOURCES: Record<HqReportPageId, HqReportSourceKey[]> = {
  'emp-overview': ['candidates', 'kyc', 'courses', 'jobs', 'events', 'helpTickets', 'billing'],
  'emp-candidates': ['candidates'],
  'emp-kyc': ['kyc'],
  'emp-courses': ['courses'],
  'emp-jobs': ['jobs'],
  'emp-events': ['events'],
  'emp-subscriptions': ['billing'],
  'emp-tickets': ['helpTickets'],
  'er-overview': ['tenants', 'tickets'],
  'er-companies': ['companies'],
  'er-users': ['tenants'],
  'er-plans': ['tenants', 'billing'],
  'er-tickets': ['tickets'],
  'er-recycle': ['recycle'],
  'crm-overview': ['leads', 'companies', 'demos'],
  'crm-leads': ['leads'],
  'crm-clients': ['companies'],
  'crm-demos': ['demos'],
  'ops-team': ['team'],
  'ops-billing': ['billing'],
  custom: ['reports', 'leads'],
  'custom-saved': ['reports'],
};

const PAGE_PRIMARY: Partial<Record<HqReportPageId, HqReportSourceKey>> = {
  'emp-overview': 'candidates',
  'emp-candidates': 'candidates',
  'emp-kyc': 'kyc',
  'emp-courses': 'courses',
  'emp-jobs': 'jobs',
  'emp-events': 'events',
  'emp-subscriptions': 'billing',
  'emp-tickets': 'helpTickets',
  'er-overview': 'tenants',
  'er-companies': 'companies',
  'er-users': 'tenants',
  'er-plans': 'tenants',
  'er-tickets': 'tickets',
  'er-recycle': 'recycle',
  'crm-overview': 'leads',
  'crm-leads': 'leads',
  'crm-clients': 'companies',
  'crm-demos': 'demos',
  'ops-team': 'team',
  'ops-billing': 'billing',
  'custom-saved': 'reports',
};

const CUSTOM_DATASETS: HqReportSourceKey[] = [
  'leads',
  'companies',
  'demos',
  'tenants',
  'tickets',
  'helpTickets',
  'team',
  'candidates',
  'kyc',
  'courses',
  'jobs',
  'events',
];

function withTimeout<T>(task: Promise<T>, label: string, ms = SOURCE_TIMEOUT_MS): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error(`${label} timed out`)), ms);
    task.then(
      (value) => {
        window.clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        window.clearTimeout(timer);
        reject(err);
      },
    );
  });
}

function sourceErrorMessage(err: unknown) {
  return err && typeof err === 'object' && 'message' in err ? String((err as { message?: string }).message) : 'failed';
}

const SOURCE_LABELS: Record<HqReportSourceKey, string> = {
  leads: 'Leads',
  companies: 'Clients',
  demos: 'Demos',
  tenants: 'Tenants',
  tickets: 'Employer tickets',
  team: 'Team',
  candidates: 'Candidates',
  kyc: 'KYC',
  courses: 'Courses',
  jobs: 'Portal jobs',
  events: 'Events',
  helpTickets: 'Employee tickets',
  recycle: 'Recycle bin',
  billing: 'Billing',
  reports: 'Custom reports',
};

export default function HqReportsPage() {
  const { formatMoney } = useHqMoney();
  const [pageId, setPageId] = useState<HqReportPageId>('emp-overview');
  const [range, setRange] = useState<HqReportRange>('all');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [leads, setLeads] = useState<HqLeadApiRow[]>([]);
  const [companies, setCompanies] = useState<HqCompanyApiRow[]>([]);
  const [demos, setDemos] = useState<HqDemoRequestRow[]>([]);
  const [tenants, setTenants] = useState<HqTenantRow[]>([]);
  const [tickets, setTickets] = useState<HqSupportTicket[]>([]);
  const [team, setTeam] = useState<HqTeamMemberRow[]>([]);
  const [candidates, setCandidates] = useState<HqPortalCandidateRow[]>([]);
  const [kyc, setKyc] = useState<HqKycInterviewerRow[]>([]);
  const [courses, setCourses] = useState<HqCourseRow[]>([]);
  const [jobs, setJobs] = useState<HqPortalJobRow[]>([]);
  const [events, setEvents] = useState<PortalEventRow[]>([]);
  const [helpTickets, setHelpTickets] = useState<HqHelpTicket[]>([]);
  const [recycle, setRecycle] = useState<HqTenantRow[]>([]);
  const [billing, setBilling] = useState<HqBillingPayload | null>(null);
  const [savedReports, setSavedReports] = useState<HqCustomReportRow[]>([]);
  const [sourceStatus, setSourceStatus] = useState<Partial<Record<HqReportSourceKey, HqSourceStatus>>>({});
  const [sourceErrors, setSourceErrors] = useState<string[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [search, setSearch] = useState('');
  const [chartFilter, setChartFilter] = useState<HqChartFilter | null>(null);
  const [tableFilters, setTableFilters] = useState<Record<string, string>>({});
  const readyRef = useRef<Set<HqReportSourceKey>>(new Set());
  const inflightRef = useRef<Partial<Record<HqReportSourceKey, Promise<void>>>>({});

  const loadOne = useCallback(async (key: HqReportSourceKey, force = false) => {
    if (!force && readyRef.current.has(key)) return;
    if (!force && inflightRef.current[key]) return inflightRef.current[key];

    const label = SOURCE_LABELS[key];
    const timeoutMs = sourceTimeoutMs(key);
    let run: Promise<void>;
    run = (async () => {
      if (!readyRef.current.has(key)) {
        setSourceStatus((prev) => ({ ...prev, [key]: 'loading' }));
      }
      try {
        switch (key) {
          case 'leads': {
            const res = await withTimeout(apiHqListLeads(), label, timeoutMs);
            setLeads(res.data?.leads ?? []);
            break;
          }
          case 'companies': {
            const res = await withTimeout(apiHqListCompanies(), label, timeoutMs);
            setCompanies(res.data?.companies ?? []);
            break;
          }
          case 'demos': {
            const res = await withTimeout(apiHqListDemoRequests(), label, timeoutMs);
            setDemos((res.data?.demos as HqDemoRequestRow[]) ?? []);
            break;
          }
          case 'tenants': {
            const res = await withTimeout(apiHqListTenants(), label, timeoutMs);
            setTenants(res.data?.tenants ?? []);
            break;
          }
          case 'tickets': {
            const res = await withTimeout(apiHqListTickets(), label, timeoutMs);
            setTickets(res.data?.tickets ?? []);
            break;
          }
          case 'team': {
            const res = await withTimeout(apiHqListTeam(), label, timeoutMs);
            setTeam(res.data?.members ?? []);
            break;
          }
          case 'candidates': {
            const res = await withTimeout(apiHqListCandidates(), label, timeoutMs);
            setCandidates(res.data?.candidates ?? []);
            break;
          }
          case 'kyc': {
            const res = await withTimeout(apiHqListKycInterviewers(), label, timeoutMs);
            setKyc(res.data?.interviewers ?? []);
            break;
          }
          case 'courses': {
            const res = await withTimeout(apiHqListCourses(), label, timeoutMs);
            setCourses(res.data?.courses ?? []);
            break;
          }
          case 'jobs': {
            const res = await withTimeout(apiHqListPortal(), label, timeoutMs);
            setJobs(res.data?.jobs ?? []);
            break;
          }
          case 'events': {
            const res = await withTimeout(apiListHqPortalEvents(), label, timeoutMs);
            setEvents(res ?? []);
            break;
          }
          case 'helpTickets': {
            const res = await withTimeout(apiHqListHelpTickets({ limit: 1000 }), label, timeoutMs);
            setHelpTickets(res.data?.tickets ?? []);
            break;
          }
          case 'recycle': {
            const res = await withTimeout(apiHqListRecycleBin(), label, timeoutMs);
            setRecycle(res.data?.items ?? []);
            break;
          }
          case 'billing': {
            const res = await withTimeout(apiHqGetBilling(), label, timeoutMs);
            setBilling(res.data ?? null);
            break;
          }
          case 'reports': {
            const res = await withTimeout(apiHqListCustomReports(), label, timeoutMs);
            setSavedReports(res.data?.reports ?? []);
            break;
          }
          default:
            break;
        }
        readyRef.current.add(key);
        setSourceStatus((prev) => ({ ...prev, [key]: 'ready' }));
        setSourceErrors((prev) => prev.filter((item) => !item.startsWith(`${label}:`)));
      } catch (err) {
        setSourceStatus((prev) => ({ ...prev, [key]: 'error' }));
        const message = `${label}: ${sourceErrorMessage(err)}`;
        setSourceErrors((prev) => (prev.includes(message) ? prev : [...prev, message]));
      } finally {
        if (inflightRef.current[key] === run) delete inflightRef.current[key];
      }
    })();

    inflightRef.current[key] = run;
    return run;
  }, []);

  const loadKeys = useCallback(
    async (keys: HqReportSourceKey[], force = false) => {
      await Promise.all(keys.map((key) => loadOne(key, force)));
    },
    [loadOne],
  );

  const loadPage = useCallback(
    async (target: HqReportPageId, force = false) => {
      const keys = PAGE_SOURCES[target];
      const primary = PAGE_PRIMARY[target];
      if (primary && keys.includes(primary)) {
        await loadOne(primary, force);
        const rest = keys.filter((key) => key !== primary);
        const light = rest.filter((key) => !HEAVY_SOURCES.has(key));
        const heavy = rest.filter((key) => HEAVY_SOURCES.has(key));
        void (async () => {
          if (light.length) await loadKeys(light, force);
          for (const key of heavy) await loadOne(key, force);
        })();
      } else {
        void loadKeys(keys, force);
      }
      if (target === 'custom') {
        void (async () => {
          const light = CUSTOM_DATASETS.filter((key) => !HEAVY_SOURCES.has(key));
          const heavy = CUSTOM_DATASETS.filter((key) => HEAVY_SOURCES.has(key));
          if (light.length) await loadKeys(light, force);
          for (const key of heavy) await loadOne(key, force);
        })();
      }
    },
    [loadKeys, loadOne],
  );

  const refresh = useCallback(async () => {
    const keys = PAGE_SOURCES[pageId];
    keys.forEach((key) => readyRef.current.delete(key));
    if (pageId === 'custom') {
      CUSTOM_DATASETS.forEach((key) => readyRef.current.delete(key));
    }
    setRefreshing(true);
    try {
      await loadPage(pageId, true);
    } finally {
      setRefreshing(false);
    }
  }, [loadPage, pageId]);

  useEffect(() => {
    void loadPage(pageId);
  }, [loadPage, pageId]);

  useEffect(() => {
    setSearch('');
    setChartFilter(null);
    setTableFilters({});
  }, [pageId]);

  const primary = PAGE_PRIMARY[pageId];
  const primaryStatus = primary ? sourceStatus[primary] : 'ready';
  const loading = Boolean(primary) && primaryStatus !== 'ready' && primaryStatus !== 'error';
  const busy = loading || refreshing;

  const { from: fromIso, to: toIso } = resolveReportRange(range, customFrom, customTo);

  const dated: HqReportSourceData = useMemo(
    () => ({
      leads: leads.filter((row) => inDateRange(row.createdAt, fromIso, toIso)),
      companies: companies.filter((row) => inDateRange(row.createdAt, fromIso, toIso)),
      demos: demos.filter((row) => inDateRange(row.createdAt || row.submittedAt, fromIso, toIso)),
      tenants: tenants.filter((row) => inDateRange(row.createdAt, fromIso, toIso)),
      tickets: tickets.filter((row) => inDateRange(row.createdAt, fromIso, toIso)),
      team: team.filter((row) => inDateRange(row.createdAt, fromIso, toIso)),
      candidates: candidates.filter((row) => inDateRange(row.createdAt, fromIso, toIso)),
      kyc: kyc.filter((row) => inDateRange(row.createdAt, fromIso, toIso)),
      courses: courses.filter((row) => inDateRange(row.createdAt, fromIso, toIso)),
      jobs: jobs.filter((row) => inDateRange(row.postedDate, fromIso, toIso)),
      events: events.filter((row) => inDateRange(row.scheduledAt, fromIso, toIso)),
      helpTickets: helpTickets.filter((row) => inDateRange(row.createdAt, fromIso, toIso)),
      recycle: recycle.filter((row) => inDateRange(row.deletedAt || row.updatedAt, fromIso, toIso)),
      billing: billing
        ? {
            ...billing,
            candidate: {
              ...billing.candidate,
              transactions: (billing.candidate.transactions || []).filter((row) => inDateRange(row.occurredAt, fromIso, toIso)),
            },
            employer: {
              ...billing.employer,
              tenantCycles: (billing.employer.tenantCycles || []).filter((row) => inDateRange(row.purchasedAt || row.createdAt, fromIso, toIso)),
              purchaseRequests: (billing.employer.purchaseRequests || []).filter((row) => inDateRange(row.submittedAt || row.createdAt, fromIso, toIso)),
              transactions: (billing.employer.transactions || []).filter((row) => inDateRange(row.occurredAt, fromIso, toIso)),
            },
          }
        : null,
    }),
    [billing, candidates, companies, courses, demos, events, fromIso, helpTickets, jobs, kyc, leads, recycle, team, tenants, tickets, toIso],
  );

  const filtered = useMemo(() => {
    let next = dated;
    if (chartFilter) next = applyHqChartFilter(pageId, next, chartFilter);
    for (const [key, value] of Object.entries(tableFilters)) {
      if (value) next = applyHqChartFilter(pageId, next, { key, value });
    }
    return next;
  }, [chartFilter, dated, pageId, tableFilters]);

  const isCustom = pageId === 'custom' || pageId === 'custom-saved';
  const view = useMemo(() => (isCustom ? null : buildHqReportView(pageId, filtered, formatMoney)), [filtered, formatMoney, isCustom, pageId]);
  const visuals = useMemo(() => (isCustom ? { charts: [], insights: [] } : buildHqReportVisuals(pageId, filtered, formatMoney)), [filtered, formatMoney, isCustom, pageId]);
  const dateOnlyView = useMemo(() => (isCustom ? null : buildHqReportView(pageId, dated, formatMoney)), [dated, formatMoney, isCustom, pageId]);

  const filterOptions = useMemo(() => {
    if (!dateOnlyView) return [];
    return dateOnlyView.columns
      .filter((col) => FILTER_KEYS.has(col.key))
      .map((col) => ({
        key: col.key,
        label: col.label,
        values: [...new Set(dateOnlyView.rows.map((row) => String(row[col.key] || '')).filter((value) => value && value !== '—'))].slice(0, 40),
      }))
      .filter((option) => option.values.length > 1);
  }, [dateOnlyView]);

  const handleExport = () => {
    if (!view) return;
    setExporting(true);
    try {
      const q = search.trim().toLowerCase();
      const rows = q
        ? view.rows.filter((row) => Object.values(row).some((value) => String(value).toLowerCase().includes(q)))
        : view.rows;
      const isOverview = pageId.endsWith('-overview');
      if (isOverview) {
        downloadCsv(view.csvName, ['Section', 'Label', 'Value'], [
          ...view.kpis.map((kpi) => ['KPI', kpi.label, kpi.value]),
          ...visuals.charts.flatMap((chart) => chart.rows.map((row) => [chart.title, row.label, row.count])),
        ]);
      } else {
        downloadCsv(
          view.csvName,
          view.columns.map((col) => col.label),
          rows.map((row) => view.columns.map((col) => (row[col.key] === '—' ? '' : row[col.key] ?? ''))),
        );
      }
      toast.success('Report exported');
    } finally {
      setExporting(false);
    }
  };

  return (
    <HqModulePageLayout
      title="HQ Reports"
      subtitle="Centralized analytics and operational intelligence across Employees, Employers, CRM and HQ Operations."
      icon={<BarChart3 className="h-5 w-5" />}
      locked={false}
      actions={
        <div className="flex flex-wrap items-center justify-end gap-2">
          <button type="button" onClick={() => void refresh()} disabled={busy} className={HQ_REPORTS_BTN_SECONDARY}>
            <RefreshCw className={`h-4 w-4 ${busy ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button type="button" onClick={handleExport} disabled={loading || exporting || isCustom} className={HQ_REPORTS_BTN_PRIMARY}>
            <Download className="h-4 w-4" />
            {exporting ? 'Exporting…' : 'Export'}
          </button>
        </div>
      }
    >
      <div className="hq-dash-page dash-ui text-slate-900">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className="inline-flex h-1.5 w-10 rounded-full bg-gradient-to-r from-slate-900 to-blue-900" />
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700 ring-1 ring-emerald-200/90">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
            Live
          </span>
          <p className="text-[11px] text-slate-400">{hqReportPageTitle(pageId)}</p>
        </div>

        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5 rounded-2xl border border-slate-200/80 bg-slate-50/90 p-1">
            <span className="px-2 text-[10px] font-bold uppercase tracking-wide text-slate-400">Range</span>
            {RANGE_OPTIONS.map((opt) => {
              const on = range === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setRange(opt.id)}
                  className={`rounded-xl px-2.5 py-1.5 text-[11px] font-semibold transition ${
                    on
                      ? 'bg-gradient-to-r from-slate-900 via-slate-800 to-blue-900 text-white shadow-sm'
                      : 'text-slate-500 hover:bg-white hover:text-slate-800'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
          {range === 'custom' ? (
            <div className="flex flex-wrap items-center gap-2">
              <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="rounded-xl border border-slate-200 bg-white px-2 py-1.5 text-sm" />
              <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="rounded-xl border border-slate-200 bg-white px-2 py-1.5 text-sm" />
            </div>
          ) : (
            <p className="text-[10px] text-slate-400">
              Filters KPIs, charts and records · selected <strong className="text-slate-600">{RANGE_OPTIONS.find((item) => item.id === range)?.label}</strong>
            </p>
          )}
        </div>

        <HqReportsDashNav pageId={pageId} onPageChange={(id) => isReportPageId(id) && setPageId(id)} />

        {sourceErrors.length > 0 ? (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200/80 bg-amber-50/80 px-4 py-3 text-xs text-amber-800">
            <span>Unable to load some HQ sources. Other sections remain available. {sourceErrors.join(' · ')}</span>
            <button type="button" onClick={() => void refresh()} className={`${HQ_REPORTS_BTN_SECONDARY} h-8 px-3 text-xs`}>
              Retry
            </button>
          </div>
        ) : null}

        {isCustom ? (
          <HqCustomReportsPanel
            mode={pageId === 'custom-saved' ? 'saved' : 'builder'}
            data={filtered}
            savedReports={savedReports}
            setSavedReports={setSavedReports}
            fromIso={fromIso}
            toIso={toIso}
            onOpenInBuilder={() => setPageId('custom')}
          />
        ) : view ? (
          <div className="space-y-5">
            {chartFilter ? (
              <button
                type="button"
                onClick={() => setChartFilter(null)}
                className="inline-flex items-center gap-1.5 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-[11px] font-semibold text-indigo-700"
              >
                Scope: {chartFilter.key} = {chartFilter.value}
                <X className="h-3.5 w-3.5" />
              </button>
            ) : null}
            <HqReportKpiRow kpis={view.kpis} loading={loading} />
            {loading ? (
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="h-64 animate-pulse rounded-2xl border border-white/80 bg-white/50" />
                <div className="h-64 animate-pulse rounded-2xl border border-white/80 bg-white/50" />
              </div>
            ) : (
              <HqReportChartGrid
                charts={visuals.charts}
                activeLabel={chartFilter?.value || null}
                onSliceClick={(key, label) => setChartFilter({ key, value: label })}
              />
            )}
            <HqReportInsightRow items={visuals.insights} />
            <HqReportRecordsTable
              title={view.tableTitle}
              columns={view.columns}
              rows={view.rows}
              loading={loading}
              search={search}
              onSearchChange={setSearch}
              filterOptions={filterOptions}
              filters={tableFilters}
              onFilterChange={(key, value) => setTableFilters((prev) => ({ ...prev, [key]: value }))}
            />
          </div>
        ) : null}
      </div>
    </HqModulePageLayout>
  );
}
