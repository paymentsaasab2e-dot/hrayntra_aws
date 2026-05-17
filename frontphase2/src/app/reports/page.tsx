'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  Briefcase,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Download,
  FileText,
  Mail,
  Phone,
  RefreshCcw,
  Target,
  TrendingUp,
  Users,
  XCircle,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Funnel,
  FunnelChart,
  LabelList,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart as RechartsPieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { AnimatePresence, motion } from 'motion/react';
import { apiFetch } from '../../lib/api';
import { usePermissions } from '../../hooks/usePermissions';
import { usePageAutoRefresh } from '../../hooks/usePageAutoRefresh';
import { SkeletonCard } from '../../components/ui/Skeleton';
import { SummaryCard, SummaryCardSkeleton, type SummaryCardColor } from '../../components/ui/SummaryCard';
import {
  PH2_TABLE_CARD_CLASS,
  PH2_TOOLBAR_ROW_CLASS,
  PH2_TOOLBAR_SELECT_CLASS,
} from '../../components/layout/Ph2ModulePageLayout';
import {
  buildReportQueryString,
  DEFAULT_REPORT_FILTERS,
  ReportsFiltersToolbar,
  type FiltersState,
  type ReportFilterOptions,
} from './reports-filters';
import {
  exportReportEntityCsv,
  fetchReportTabDetail,
  type ReportDataset,
  type TabDetailResponse,
} from '../../lib/reportTabExports';
import { toast } from 'sonner';

type ReportTab =
  | 'Recruitment Performance'
  | 'Pipeline & Funnel'
  | 'Jobs & Clients'
  | 'Candidates'
  | 'Interviews'
  | 'Placements & Revenue'
  | 'Team Performance'
  | 'Activity & Productivity'
  | 'Custom Reports';

type SummaryResponse = {
  filters: FiltersState;
  options: ReportFilterOptions;
  recruitmentPerformance: {
    kpis: {
      totalOpenJobs: number;
      activeCandidates: number;
      interviews: number;
      offersReleased: number;
      placements: number;
      conversionPct: number;
    };
    trend: Array<{ label: string; openJobs: number; placements: number; candidates: number; interviews: number }>;
  };
  pipelineFunnel: {
    funnel: Array<{ name: string; value: number; fill: string }>;
    stageDistribution: Array<{ name: string; value: number; fill: string }>;
  };
  jobsClients: {
    jobs: Array<{ id: string; title: string; client: string; status: string; count: number; aging: string }>;
    topClients: Array<{ name: string; volume: number }>;
  };
  candidates: {
    sources: Array<{ name: string; value: number }>;
    skills: Array<{ skill: string; count: number; percentage: number }>;
  };
  interviews: {
    trend: Array<{ label: string; scheduled: number; completed: number }>;
    feedbackPending: Array<{ userId: string; name: string; pending: number }>;
  };
  placementsRevenue: {
    kpis: {
      totalPlacements: number;
      totalRevenue: number;
      avgBilling: number;
    };
    trend: Array<{ label: string; revenue: number }>;
  };
  teamPerformance: {
    leaderboard: Array<{
      id: string;
      name: string;
      jobs: number;
      submissions: number;
      interviews: number;
      placements: number;
      rank: number;
    }>;
  };
  activityProductivity: {
    kpis: {
      callsMade: number;
      emailsSent: number;
      tasksCompleted: number;
      overdueTasks: number;
    };
    trend: Array<{ label: string; calls: number; emails: number; tasks: number }>;
  };
  entityCounts?: Record<string, number>;
};

type DatasetResponse = {
  entity: string;
  title: string;
  columns: string[];
  rows: Record<string, string | number>[];
};

const TABS: ReportTab[] = [
  'Recruitment Performance',
  'Pipeline & Funnel',
  'Jobs & Clients',
  'Candidates',
  'Interviews',
  'Placements & Revenue',
  'Team Performance',
  'Activity & Productivity',
  'Custom Reports',
];

const TAB_EXPORT_KEY: Record<Exclude<ReportTab, 'Custom Reports'>, string> = {
  'Recruitment Performance': 'recruitment-performance',
  'Pipeline & Funnel': 'pipeline-funnel',
  'Jobs & Clients': 'jobs-clients',
  Candidates: 'candidates',
  Interviews: 'interviews',
  'Placements & Revenue': 'placements-revenue',
  'Team Performance': 'team-performance',
  'Activity & Productivity': 'activity-productivity',
};

const MODULE_DETAIL_TABS: ReportTab[] = [
  'Jobs & Clients',
  'Candidates',
  'Interviews',
  'Placements & Revenue',
];

const CHART_COLORS = ['#2563eb', '#8b5cf6', '#f59e0b', '#10b981', '#ef4444', '#0f172a'];

/** Table header row — aligned with Leads list chrome. */
const REPORTS_TABLE_HEAD_ROW =
  'bg-gradient-to-r from-slate-50/95 via-indigo-50/50 to-violet-50/40 border-b border-indigo-100/50 text-indigo-950/45 uppercase text-[9px] font-bold tracking-[0.12em]';

const REPORTS_TABLE_TH = 'px-4 py-3 text-left first:pl-6 last:pr-6';

const REPORTS_TABLE_BODY_ROW = 'transition-colors even:bg-slate-50/35 hover:bg-indigo-50/45';

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('en-US').format(Number(value || 0));
}

function buildDownloadHref(fileUrl: string, filename: string) {
  const params = new URLSearchParams({
    path: fileUrl,
    filename,
  });
  return `/api/download-file?${params.toString()}`;
}

const Card = ({ title, children, className = '' }: { title?: string; children: React.ReactNode; className?: string }) => (
  <div
    className={`mb-4 overflow-hidden rounded-xl border border-indigo-100/60 bg-white/70 shadow-[0_12px_40px_-18px_rgba(59,130,246,0.18)] backdrop-blur-sm transition-shadow hover:shadow-[0_16px_48px_-14px_rgba(79,70,229,0.16)] ${className}`}
  >
    {title ? (
      <div className="border-b border-indigo-100/40 bg-gradient-to-br from-white via-indigo-50/20 to-violet-50/15 px-5 py-3 sm:px-6">
        <h3 className="text-sm font-semibold tracking-tight text-slate-900">{title}</h3>
      </div>
    ) : null}
    <div className="p-5 sm:p-6">{children}</div>
  </div>
);

const EmptyState = ({ text }: { text: string }) => (
  <div className="flex min-h-[180px] items-center justify-center rounded-xl border border-dashed border-indigo-100/80 bg-indigo-50/20 text-sm text-slate-500">
    {text}
      </div>
);

function ReportDatasetTable({
  dataset,
  loading,
  emptyText,
}: {
  dataset?: ReportDataset | null;
  loading?: boolean;
  emptyText?: string;
}) {
  if (loading) {
    return <EmptyState text="Loading live data…" />;
  }
  if (!dataset?.rows?.length) {
    return <EmptyState text={emptyText || 'No records match the current filters.'} />;
  }
  const total = dataset.totalRows ?? dataset.rows.length;
  const shown = dataset.rows.length;
  return (
    <div className="space-y-2">
      <p className="text-xs text-slate-500">
        Showing {formatNumber(shown)} of {formatNumber(total)} record{total === 1 ? '' : 's'} (live data)
      </p>
      <div className="no-scrollbar max-h-[360px] overflow-auto rounded-xl border border-indigo-100/60">
        <table className="w-full min-w-[640px] text-left">
          <thead className="sticky top-0 z-[1]">
            <tr className={REPORTS_TABLE_HEAD_ROW}>
              {dataset.columns.map((column) => (
                <th key={column} className={REPORTS_TABLE_TH}>
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100/80">
            {dataset.rows.map((row, index) => (
              <tr key={`${dataset.entity || 'row'}-${index}`} className={REPORTS_TABLE_BODY_ROW}>
                {dataset.columns.map((column) => (
                  <td key={column} className="px-4 py-2.5 text-sm text-slate-700 first:pl-6 last:pr-6">
                    {String(row[column] ?? '')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
  </div>
);
}

function TabExportBar({
  buttons,
  exporting,
}: {
  buttons: Array<{ label: string; onClick: () => void | Promise<void> }>;
  exporting?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {buttons.map((button) => (
        <button
          key={button.label}
          type="button"
          disabled={exporting}
          onClick={() => void button.onClick()}
          className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200/70 bg-white px-3 py-1.5 text-xs font-semibold text-indigo-900 shadow-sm transition-all hover:border-indigo-300 hover:bg-indigo-50/90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Download size={14} className="text-indigo-600" strokeWidth={2.25} />
          {exporting ? 'Exporting…' : button.label}
        </button>
      ))}
  </div>
);
}

function ReportsContent({
  activeTab,
  summary,
  filterOptions,
  customSource,
  setCustomSource,
  customDataset,
  customColumns,
  setCustomColumns,
  customLoading,
  onGenerateCustom,
  tabDetail,
  tabDetailLoading,
  tabExporting,
  onExportEntity,
  canExportData,
}: {
  activeTab: ReportTab;
  summary: SummaryResponse | null;
  filterOptions: ReportFilterOptions | null;
  customSource: string;
  setCustomSource: (value: string) => void;
  customDataset: DatasetResponse | null;
  customColumns: string[];
  setCustomColumns: React.Dispatch<React.SetStateAction<string[]>>;
  customLoading: boolean;
  onGenerateCustom?: () => void;
  tabDetail: TabDetailResponse | null;
  tabDetailLoading: boolean;
  tabExporting: boolean;
  onExportEntity: (entity: 'jobs' | 'clients' | 'candidates' | 'interviews' | 'placements') => Promise<void>;
  canExportData: boolean;
}) {
  if (!summary) return <EmptyState text="No report data available." />;

  switch (activeTab) {
    case 'Recruitment Performance':
      return (
        <div className="space-y-6">
          <div className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-6">
            <SummaryCard
              label="Total open jobs"
              count={formatNumber(summary.recruitmentPerformance.kpis.totalOpenJobs)}
              color="blue"
              icon={<Briefcase size={16} strokeWidth={2.35} />}
            />
            <SummaryCard
              label="Active candidates"
              count={formatNumber(summary.recruitmentPerformance.kpis.activeCandidates)}
              color="purple"
              icon={<Users size={16} strokeWidth={2.35} />}
            />
            <SummaryCard
              label="Interviews"
              count={formatNumber(summary.recruitmentPerformance.kpis.interviews)}
              color="orange"
              icon={<Calendar size={16} strokeWidth={2.35} />}
            />
            <SummaryCard
              label="Offers released"
              count={formatNumber(summary.recruitmentPerformance.kpis.offersReleased)}
              color="indigo"
              icon={<FileText size={16} strokeWidth={2.35} />}
            />
            <SummaryCard
              label="Placements"
              count={formatNumber(summary.recruitmentPerformance.kpis.placements)}
              color="green"
              icon={<CheckCircle2 size={16} strokeWidth={2.35} />}
            />
            <SummaryCard
              label="Conversion %"
              count={`${summary.recruitmentPerformance.kpis.conversionPct}%`}
              color="rose"
              icon={<TrendingUp size={16} strokeWidth={2.35} />}
            />
          </div>
          <Card title="Recruitment Activity Overview">
            {summary.recruitmentPerformance.trend.length ? (
              <div className="h-[350px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={summary.recruitmentPerformance.trend}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="label" axisLine={false} tickLine={false} />
                    <YAxis axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }} />
                    <Legend />
                    <Line type="monotone" dataKey="openJobs" stroke="#2563eb" strokeWidth={3} dot={false} name="Open Jobs" />
                    <Line type="monotone" dataKey="placements" stroke="#16a34a" strokeWidth={3} dot={false} name="Placements" />
                    <Line type="monotone" dataKey="candidates" stroke="#8b5cf6" strokeWidth={2} dot={false} name="Candidates" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <EmptyState text="No recruitment activity for the selected filters." />
            )}
          </Card>
        </div>
      );

    case 'Pipeline & Funnel':
      return (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card title="Hiring Funnel (Aggregated)">
            {summary.pipelineFunnel.funnel.length ? (
              <div className="h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                  <FunnelChart>
                    <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }} />
                    <Funnel dataKey="value" data={summary.pipelineFunnel.funnel} isAnimationActive>
                      <LabelList position="right" fill="#64748b" stroke="none" dataKey="name" />
                    </Funnel>
                  </FunnelChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <EmptyState text="No pipeline funnel data found." />
            )}
          </Card>
          <Card title="Stage-wise Candidate Distribution">
            {summary.pipelineFunnel.stageDistribution.length ? (
              <div className="h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={summary.pipelineFunnel.stageDistribution} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} width={110} />
                    <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }} />
                    <Bar dataKey="value" fill="#2563eb" radius={[0, 4, 4, 0]} barSize={26} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <EmptyState text="No stage distribution found." />
            )}
          </Card>
        </div>
      );

    case 'Jobs & Clients':
      return (
        <div className="space-y-6">
          <div className="mb-1 grid grid-cols-2 gap-2 sm:grid-cols-2 sm:gap-3">
            <SummaryCard
              label="Open jobs"
              count={formatNumber(summary.entityCounts?.jobs ?? summary.jobsClients.jobs.length)}
              color="blue"
              icon={<Briefcase size={16} strokeWidth={2.35} />}
            />
            <SummaryCard
              label="Clients"
              count={formatNumber(summary.entityCounts?.clients ?? summary.jobsClients.topClients.length)}
              color="indigo"
              icon={<Users size={16} strokeWidth={2.35} />}
            />
              </div>
          {canExportData ? (
            <TabExportBar
              exporting={tabExporting}
              buttons={[
                { label: 'Export jobs (CSV)', onClick: () => onExportEntity('jobs') },
                { label: 'Export clients (CSV)', onClick: () => onExportEntity('clients') },
              ]}
            />
          ) : null}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2" title="Jobs (live)">
            <ReportDatasetTable
              dataset={tabDetail?.jobs ?? null}
              loading={tabDetailLoading}
              emptyText="No jobs match the current filters."
            />
          </Card>
          <Card title="Top clients by job volume">
            {summary.jobsClients.topClients.length ? (
              <>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={summary.jobsClients.topClients}>
                      <XAxis dataKey="name" hide />
                      <YAxis hide />
                      <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }} />
                      <Bar dataKey="volume" fill="#2563eb" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-4 space-y-2">
                  {summary.jobsClients.topClients.map((client) => (
                    <div key={client.name} className="flex items-center justify-between text-sm">
                      <span className="text-slate-600">{client.name}</span>
                      <span className="font-semibold text-slate-900">{client.volume} Jobs</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <EmptyState text="No client job volume found." />
            )}
          </Card>
          </div>
          <Card title="Clients (live)">
            <ReportDatasetTable
              dataset={tabDetail?.clients ?? null}
              loading={tabDetailLoading}
              emptyText="No clients match the current filters."
            />
          </Card>
        </div>
      );

    case 'Candidates':
      return (
        <div className="space-y-6">
          <SummaryCard
            label="Candidates"
            count={formatNumber(summary.entityCounts?.candidates ?? 0)}
            color="purple"
            icon={<Users size={16} strokeWidth={2.35} />}
          />
          {canExportData ? (
            <TabExportBar
              exporting={tabExporting}
              buttons={[{ label: 'Export candidates (CSV)', onClick: () => onExportEntity('candidates') }]}
            />
          ) : null}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card title="Candidate sourcing">
            {summary.candidates.sources.length ? (
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsPieChart>
                    <Pie data={summary.candidates.sources} cx="50%" cy="50%" innerRadius={60} outerRadius={84} paddingAngle={4} dataKey="value">
                      {summary.candidates.sources.map((entry, index) => (
                        <Cell key={entry.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }} />
                    <Legend verticalAlign="bottom" align="center" />
                  </RechartsPieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <EmptyState text="No candidate source data found." />
            )}
          </Card>
          <Card title="Skill Distribution">
            {summary.candidates.skills.length ? (
              <div className="space-y-4">
                {summary.candidates.skills.map((item) => (
                  <div key={item.skill} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium text-slate-700">{item.skill}</span>
                      <span className="text-slate-500">{item.count} Candidates</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-blue-600" style={{ width: `${item.percentage}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState text="No candidate skills found." />
            )}
          </Card>
          </div>
          <Card title="Candidates (live)">
            <ReportDatasetTable
              dataset={tabDetail?.candidates ?? null}
              loading={tabDetailLoading}
              emptyText="No candidates match the current filters."
            />
          </Card>
        </div>
      );

    case 'Interviews':
      return (
        <div className="space-y-6">
          <SummaryCard
            label="Interviews"
            count={formatNumber(summary.entityCounts?.interviews ?? 0)}
            color="orange"
            icon={<Calendar size={16} strokeWidth={2.35} />}
          />
          {canExportData ? (
            <TabExportBar
              exporting={tabExporting}
              buttons={[{ label: 'Export interviews (CSV)', onClick: () => onExportEntity('interviews') }]}
            />
          ) : null}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2" title="Scheduled vs completed">
            {summary.interviews.trend.length ? (
              <div className="h-[350px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={summary.interviews.trend}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="label" axisLine={false} tickLine={false} />
                    <YAxis axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }} />
                    <Legend />
                    <Bar dataKey="scheduled" name="Scheduled" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="completed" name="Completed" fill="#2563eb" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <EmptyState text="No interview trend data found." />
            )}
          </Card>
          <Card title="Interviewer Feedback Pending">
            {summary.interviews.feedbackPending.length ? (
              <div className="space-y-4">
                {summary.interviews.feedbackPending.map((item) => (
                  <div key={item.userId} className="flex items-center justify-between rounded-lg bg-slate-50 p-3">
                    <span className="text-sm font-medium text-slate-700">{item.name}</span>
                    <span className="rounded-md bg-orange-100 px-2 py-1 text-xs font-bold text-orange-700">{item.pending} Pending</span>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState text="No pending feedback found." />
            )}
          </Card>
          </div>
          <Card title="Interviews (live)">
            <ReportDatasetTable
              dataset={tabDetail?.interviews ?? null}
              loading={tabDetailLoading}
              emptyText="No interviews match the current filters."
            />
          </Card>
        </div>
      );

    case 'Placements & Revenue':
      return (
        <div className="space-y-6">
          {canExportData ? (
            <TabExportBar
              exporting={tabExporting}
              buttons={[{ label: 'Export placements (CSV)', onClick: () => onExportEntity('placements') }]}
            />
          ) : null}
          <div className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-3">
            <SummaryCard
              label="Total placements"
              count={formatNumber(summary.placementsRevenue.kpis.totalPlacements)}
              color="green"
              icon={<Target size={16} strokeWidth={2.35} />}
            />
            <SummaryCard
              label="Total revenue"
              count={formatCurrency(summary.placementsRevenue.kpis.totalRevenue)}
              color="blue"
              icon={<TrendingUp size={16} strokeWidth={2.35} />}
            />
            <SummaryCard
              label="Avg. billing"
              count={formatCurrency(summary.placementsRevenue.kpis.avgBilling)}
              color="indigo"
              icon={<BarChart3 size={16} strokeWidth={2.35} />}
            />
          </div>
          <Card title="Revenue Trend">
            {summary.placementsRevenue.trend.length ? (
              <div className="h-[350px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={summary.placementsRevenue.trend}>
                    <defs>
                      <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#2563eb" stopOpacity={0.12} />
                        <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="label" axisLine={false} tickLine={false} />
                    <YAxis axisLine={false} tickLine={false} tickFormatter={(value) => `$${Math.round(Number(value) / 1000)}k`} />
                    <Tooltip formatter={(value) => [formatCurrency(Number(value)), 'Revenue']} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }} />
                    <Area type="monotone" dataKey="revenue" stroke="#2563eb" fillOpacity={1} fill="url(#colorRevenue)" strokeWidth={3} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <EmptyState text="No placement revenue found." />
            )}
          </Card>
          <Card title="Placements (live)">
            <ReportDatasetTable
              dataset={tabDetail?.placements ?? null}
              loading={tabDetailLoading}
              emptyText="No placements match the current filters."
            />
          </Card>
        </div>
      );

    case 'Team Performance':
      return (
        <Card title="Recruiter Leaderboard">
          {summary.teamPerformance.leaderboard.length ? (
            <div className="no-scrollbar overflow-x-auto">
              <table className="w-full min-w-[720px] text-left">
                <thead>
                  <tr className={REPORTS_TABLE_HEAD_ROW}>
                    <th className={REPORTS_TABLE_TH}>Rank</th>
                    <th className={REPORTS_TABLE_TH}>Recruiter</th>
                    <th className={REPORTS_TABLE_TH}>Jobs Handled</th>
                    <th className={REPORTS_TABLE_TH}>Submissions</th>
                    <th className={REPORTS_TABLE_TH}>Interviews</th>
                    <th className={REPORTS_TABLE_TH}>Placements</th>
                    <th className={`${REPORTS_TABLE_TH} text-right`}>Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100/80">
                  {summary.teamPerformance.leaderboard.map((recruiter) => (
                    <tr key={recruiter.id} className={REPORTS_TABLE_BODY_ROW}>
                      <td className="px-4 py-3 text-sm first:pl-6 last:pr-6">
                        <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${recruiter.rank === 1 ? 'bg-yellow-100 text-yellow-700' : recruiter.rank === 2 ? 'bg-slate-200 text-slate-700' : recruiter.rank === 3 ? 'bg-orange-100 text-orange-700' : 'bg-slate-100 text-slate-500'}`}>
                          {recruiter.rank}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-slate-900">{recruiter.name}</td>
                      <td className="px-4 py-3 text-sm text-slate-600">{formatNumber(recruiter.jobs)}</td>
                      <td className="px-4 py-3 text-sm text-slate-600">{formatNumber(recruiter.submissions)}</td>
                      <td className="px-4 py-3 text-sm text-slate-600">{formatNumber(recruiter.interviews)}</td>
                      <td className="px-4 py-3 text-sm font-semibold text-indigo-600">{formatNumber(recruiter.placements)}</td>
                      <td className="px-4 py-3 text-right last:pr-6">
                        <ChevronRight size={18} className="ml-auto text-slate-400" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState text="No recruiter performance found." />
          )}
        </Card>
      );

    case 'Activity & Productivity':
      return (
        <div className="space-y-6">
          <div className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-2 sm:gap-3 lg:grid-cols-4">
            <SummaryCard
              label="Calls made"
              count={formatNumber(summary.activityProductivity.kpis.callsMade)}
              color="blue"
              icon={<Phone size={16} strokeWidth={2.35} />}
            />
            <SummaryCard
              label="Emails sent"
              count={formatNumber(summary.activityProductivity.kpis.emailsSent)}
              color="purple"
              icon={<Mail size={16} strokeWidth={2.35} />}
            />
            <SummaryCard
              label="Tasks completed"
              count={formatNumber(summary.activityProductivity.kpis.tasksCompleted)}
              color="green"
              icon={<CheckCircle2 size={16} strokeWidth={2.35} />}
            />
            <SummaryCard
              label="Overdue tasks"
              count={formatNumber(summary.activityProductivity.kpis.overdueTasks)}
              color="rose"
              icon={<Clock size={16} strokeWidth={2.35} />}
            />
          </div>
          <Card title="Daily Activity Trend">
            {summary.activityProductivity.trend.length ? (
              <div className="h-[350px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={summary.activityProductivity.trend}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="label" axisLine={false} tickLine={false} />
                    <YAxis axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }} />
                    <Legend />
                    <Bar dataKey="calls" name="Calls" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="emails" name="Emails" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="tasks" name="Tasks" fill="#10b981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <EmptyState text="No activity data found." />
            )}
          </Card>
        </div>
      );

    case 'Custom Reports':
      return (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-1" title="Report Builder">
            <div className="space-y-6">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Data Source</label>
                <select
                  className={`${PH2_TOOLBAR_SELECT_CLASS} h-9 w-full`}
                  value={customSource}
                  onChange={(event) => setCustomSource(event.target.value)}
                >
                  {(filterOptions?.customSources || []).map((source) => (
                    <option key={source.value} value={source.value}>
                      {source.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Select Columns</label>
                <div className="max-h-64 space-y-2 overflow-y-auto rounded-lg border border-slate-100 bg-slate-50 p-3">
                  {(customDataset?.columns || []).length ? (
                    customDataset?.columns.map((column) => (
                      <label key={column} className="flex cursor-pointer items-center gap-2">
                        <input
                          type="checkbox"
                          checked={customColumns.includes(column)}
                          onChange={(event) => {
                            setCustomColumns((prev) =>
                              event.target.checked ? [...prev, column] : prev.filter((item) => item !== column)
                            );
                          }}
                          className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm text-slate-600">{column}</span>
                      </label>
                    ))
                  ) : (
                    <p className="text-sm text-slate-500">Generate a preview to load available columns.</p>
                  )}
                </div>
              </div>
              {onGenerateCustom && (
                <button
                  onClick={onGenerateCustom}
                  disabled={customLoading}
                  className="w-full rounded-lg bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 py-2.5 text-xs font-semibold text-white shadow-lg shadow-indigo-500/30 transition-all hover:from-blue-700 hover:via-indigo-700 hover:to-violet-700 disabled:cursor-not-allowed disabled:opacity-60 active:scale-[0.98]"
                >
                  {customLoading ? 'Generating…' : 'Generate report'}
                </button>
              )}
            </div>
          </Card>
          <Card className="lg:col-span-2" title="Report Preview">
            {customDataset && customDataset.rows.length ? (
              <div className="no-scrollbar overflow-x-auto">
                <table className="w-full min-w-[480px] text-left">
                  <thead>
                    <tr className={REPORTS_TABLE_HEAD_ROW}>
                      {customDataset.columns.map((column) => (
                        <th key={column} className={REPORTS_TABLE_TH}>
                          {column}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100/80">
                    {customDataset.rows.slice(0, 15).map((row, index) => (
                      <tr key={`${customDataset.entity}-${index}`} className={REPORTS_TABLE_BODY_ROW}>
                        {customDataset.columns.map((column) => (
                          <td key={column} className="px-4 py-3 pr-4 text-sm text-slate-700 first:pl-6 last:pr-6">
                            {String(row[column] ?? '')}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState text="Select a data source and generate a preview to see real data here." />
            )}
          </Card>
        </div>
      );

    default:
      return <EmptyState text="Unsupported report tab." />;
  }
}

export default function ReportsPage() {
  const { hasPermission } = usePermissions();
  const canCreateReports = hasPermission('reports_create');
  const canExportData = hasPermission('export_data');
  const [activeTab, setActiveTab] = useState<ReportTab>('Recruitment Performance');
  const [draftFilters, setDraftFilters] = useState<FiltersState>(DEFAULT_REPORT_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState<FiltersState>(DEFAULT_REPORT_FILTERS);
  const [filterOptions, setFilterOptions] = useState<ReportFilterOptions | null>(null);
  const [summary, setSummary] = useState<SummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState<'csv' | 'pdf' | null>(null);
  const [customSource, setCustomSource] = useState('jobs');
  const [customDataset, setCustomDataset] = useState<DatasetResponse | null>(null);
  const [customColumns, setCustomColumns] = useState<string[]>([]);
  const [customLoading, setCustomLoading] = useState(false);
  const [pullRefreshing, setPullRefreshing] = useState(false);
  const [tabDetail, setTabDetail] = useState<TabDetailResponse | null>(null);
  const [tabDetailLoading, setTabDetailLoading] = useState(false);
  const [tabExporting, setTabExporting] = useState(false);

  const loadFilterOptions = async () => {
    try {
      const response = await apiFetch<ReportFilterOptions>('/reports/filter-options', { auth: true });
      setFilterOptions(response.data);
    } catch {
      // Summary response still provides options when this fails.
    }
  };

  const loadSummary = async (filters: FiltersState, opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    setError(null);
    try {
      const query = buildReportQueryString(filters);
      const response = await apiFetch<SummaryResponse>(`/reports/summary?${query}`, { auth: true });
      setSummary(response.data);
      setFilterOptions(response.data.options);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load reports');
    } finally {
      if (!opts?.silent) setLoading(false);
    }
  };

  useEffect(() => {
    void loadFilterOptions();
  }, []);

  useEffect(() => {
    void loadSummary(appliedFilters);
  }, [appliedFilters]);

  const loadTabDetail = async (tab: ReportTab, filters: FiltersState, opts?: { silent?: boolean }) => {
    if (!MODULE_DETAIL_TABS.includes(tab)) {
      setTabDetail(null);
      return;
    }
    if (!opts?.silent) setTabDetailLoading(true);
    try {
      const tabKey = TAB_EXPORT_KEY[tab as Exclude<ReportTab, 'Custom Reports'>];
      const detail = await fetchReportTabDetail(tabKey, filters);
      setTabDetail(detail);
    } catch (err) {
      if (!opts?.silent) {
        toast.error(err instanceof Error ? err.message : 'Failed to load report details');
      }
      setTabDetail(null);
    } finally {
      if (!opts?.silent) setTabDetailLoading(false);
    }
  };

  useEffect(() => {
    void loadTabDetail(activeTab, appliedFilters);
  }, [activeTab, appliedFilters]);

  usePageAutoRefresh(
    ({ silent }) => {
      void loadSummary(appliedFilters, { silent });
      if (MODULE_DETAIL_TABS.includes(activeTab)) {
        void loadTabDetail(activeTab, appliedFilters, { silent });
      }
    },
    {
    events: ['jobportal:placements-changed', 'jobportal:jobs-changed'],
    },
  );

  useEffect(() => {
    setCustomDataset(null);
    setCustomColumns([]);
  }, [customSource]);

  const generateCustomPreview = async () => {
    setCustomLoading(true);
    setError(null);
    try {
      const query = buildReportQueryString(appliedFilters, {
        columns: customColumns.join(','),
      });
      const response = await apiFetch<DatasetResponse>(`/reports/dataset/${customSource}?${query}`, { auth: true });
      setCustomDataset(response.data);
      if (!customColumns.length) {
        setCustomColumns(response.data.columns);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate custom report');
    } finally {
      setCustomLoading(false);
    }
  };

  const handleExport = async (format: 'csv' | 'pdf') => {
    setExporting(format);
    setError(null);
    try {
      if (activeTab === 'Custom Reports') {
        const query = buildReportQueryString(appliedFilters);
        const response = await apiFetch<{ downloadUrl: string }>(`/reports/export/${customSource}/${format}?${query}`, { auth: true });
        const extension = format === 'csv' ? 'csv' : 'pdf';
        const downloadName = `${customSource.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-${new Date().toISOString().split('T')[0]}.${extension}`;
        const href = buildDownloadHref(response.data.downloadUrl, downloadName);
        const link = document.createElement('a');
        link.href = href;
        link.download = downloadName;
        link.rel = 'noopener noreferrer';
        document.body.appendChild(link);
        link.click();
        link.remove();
        return;
      }

      const tabKey = TAB_EXPORT_KEY[activeTab as Exclude<ReportTab, 'Custom Reports'>];
      const query = buildReportQueryString(appliedFilters);
      const response = await apiFetch<{ downloadUrl: string }>(`/reports/summary/export/${tabKey}/${format}?${query}`, { auth: true });
      const extension = format === 'csv' ? 'csv' : 'pdf';
      const downloadName = `${tabKey}-${new Date().toISOString().split('T')[0]}.${extension}`;
      const href = buildDownloadHref(response.data.downloadUrl, downloadName);
      const link = document.createElement('a');
      link.href = href;
      link.download = downloadName;
      link.rel = 'noopener noreferrer';
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to export report');
    } finally {
      setExporting(null);
    }
  };

  const handlePullRefresh = async () => {
    setPullRefreshing(true);
    try {
      await loadSummary(appliedFilters, { silent: true });
      if (MODULE_DETAIL_TABS.includes(activeTab)) {
        await loadTabDetail(activeTab, appliedFilters, { silent: true });
      }
    } finally {
      setPullRefreshing(false);
    }
  };

  const handleExportEntity = async (
    entity: 'jobs' | 'clients' | 'candidates' | 'interviews' | 'placements',
  ) => {
    if (!canExportData) return;
    setTabExporting(true);
    setError(null);
    try {
      const rowCount = await exportReportEntityCsv(entity, appliedFilters);
      toast.success(`Exported ${rowCount} row${rowCount === 1 ? '' : 's'} to CSV.`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to export CSV';
      setError(message);
      toast.error(message);
    } finally {
      setTabExporting(false);
    }
  };

  const resolvedOptions = filterOptions ?? summary?.options ?? null;

  return (
    <div className="w-full min-h-screen overflow-hidden text-slate-900">
      <main className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
        <header className="flex min-h-[4.5rem] shrink-0 flex-wrap items-center justify-between gap-3 border-b border-indigo-100/50 bg-white/80 px-4 py-3 shadow-[inset_0_-1px_0_0_rgba(99,102,241,0.08)] backdrop-blur-md sm:px-6">
          <div className="flex items-start gap-2.5 sm:gap-3">
            <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 via-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-500/30 ring-1 ring-white/20">
              <BarChart3 className="h-5 w-5" strokeWidth={2.2} />
          </div>
            <div>
              <h1 className="text-xl font-bold leading-tight tracking-tight text-slate-900 sm:text-[1.35rem]">Reports</h1>
              <p className="mt-0.5 max-w-2xl text-xs text-slate-500">
                <span className="font-semibold text-slate-700">{activeTab}</span>
                <span className="text-slate-400"> · </span>
                Analytics and exports for your recruitment pipeline.
              </p>
        </div>
      </div>
          <div className="flex flex-wrap items-center gap-2">
          <button
              type="button"
              onClick={() => void handlePullRefresh()}
              disabled={pullRefreshing || loading}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-indigo-200/80 bg-white text-indigo-700 shadow-[0_4px_14px_-4px_rgba(99,102,241,0.2)] transition-all hover:border-indigo-300 hover:bg-indigo-50/90 active:scale-[0.98] disabled:opacity-50"
              title="Refresh data"
            >
              <RefreshCcw size={16} strokeWidth={2.25} className={pullRefreshing ? 'animate-spin' : ''} />
          </button>
            {canExportData && (
              <button
                type="button"
                onClick={() => void handleExport('csv')}
                disabled={!!exporting}
                className="flex items-center gap-1.5 rounded-lg border border-indigo-200/70 bg-white px-3 py-2 text-xs font-semibold text-indigo-900 shadow-[0_4px_14px_-4px_rgba(99,102,241,0.25)] transition-all hover:border-indigo-300 hover:bg-indigo-50/90 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Download size={16} className="text-indigo-600" strokeWidth={2.25} />
                <span>{exporting === 'csv' ? 'Exporting…' : 'Export CSV'}</span>
              </button>
            )}
            {canExportData && (
              <button
                type="button"
                onClick={() => void handleExport('pdf')}
                disabled={!!exporting}
                className="flex items-center gap-1.5 rounded-lg border border-indigo-200/70 bg-white px-3 py-2 text-xs font-semibold text-indigo-900 shadow-[0_4px_14px_-4px_rgba(99,102,241,0.25)] transition-all hover:border-indigo-300 hover:bg-indigo-50/90 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <FileText size={16} className="text-indigo-600" strokeWidth={2.25} />
                <span>{exporting === 'pdf' ? 'Exporting…' : 'PDF report'}</span>
              </button>
            )}
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-3 py-4 sm:px-5 sm:py-6 lg:px-6">
          <div className="mx-auto max-w-[1600px]">
            <div className={PH2_TABLE_CARD_CLASS}>
              <div className={PH2_TOOLBAR_ROW_CLASS}>
                <ReportsFiltersToolbar
                  draftFilters={draftFilters}
                  options={resolvedOptions}
                  onPatch={(key, value) => setDraftFilters((prev) => ({ ...prev, [key]: value }))}
                  onApply={() => setAppliedFilters({ ...draftFilters })}
                  onReset={() => {
                    setDraftFilters(DEFAULT_REPORT_FILTERS);
                    setAppliedFilters(DEFAULT_REPORT_FILTERS);
                  }}
                />
        </div>

              <div className="no-scrollbar flex overflow-x-auto border-b border-indigo-100/40 bg-white/40 px-1 sm:px-2">
                {TABS.map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setActiveTab(tab)}
                    className={`relative whitespace-nowrap px-3 py-3 text-xs font-semibold transition-all sm:px-4 sm:text-sm ${
                      activeTab === tab
                        ? 'text-indigo-700'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    {tab}
                    {activeTab === tab ? (
                      <motion.div layoutId="reportsActiveTab" className="absolute bottom-0 left-2 right-2 h-0.5 rounded-full bg-indigo-600 sm:left-3 sm:right-3" />
                    ) : null}
                  </button>
                ))}
              </div>

              <div className="p-4 sm:p-5 lg:p-6">
        {error ? (
                  <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
                ) : null}

                {summary?.entityCounts ? (
                  <div className="mb-4 flex flex-wrap gap-2">
                    {Object.entries(summary.entityCounts).map(([key, count]) => (
                      <span
                        key={key}
                        className="rounded-full border border-indigo-100 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700 shadow-sm"
                      >
                        {key.replace(/([A-Z])/g, ' $1').replace(/^./, (char) => char.toUpperCase())}: {count}
                      </span>
                    ))}
                  </div>
        ) : null}

        {loading ? (
                  <div className="space-y-6" role="status" aria-label="Loading report data">
                    <div className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-6">
                      {(['blue', 'cyan', 'orange', 'indigo', 'green', 'rose'] as SummaryCardColor[]).map((c, i) => (
                        <SummaryCardSkeleton key={i} color={c} />
                      ))}
                    </div>
                    <SkeletonCard
                      heightClass="h-[280px]"
                      lines={4}
                      className="overflow-hidden rounded-xl border border-indigo-100/60 bg-white/70 shadow-[0_12px_40px_-18px_rgba(59,130,246,0.18)] backdrop-blur-sm"
                    />
                  </div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              <ReportsContent
                activeTab={activeTab}
                summary={summary}
                        filterOptions={resolvedOptions}
                customSource={customSource}
                setCustomSource={setCustomSource}
                customDataset={customDataset}
                customColumns={customColumns}
                setCustomColumns={setCustomColumns}
                customLoading={customLoading}
                onGenerateCustom={canCreateReports ? () => void generateCustomPreview() : undefined}
                        tabDetail={tabDetail}
                        tabDetailLoading={tabDetailLoading}
                        tabExporting={tabExporting}
                        onExportEntity={handleExportEntity}
                        canExportData={canExportData}
              />
            </motion.div>
          </AnimatePresence>
        )}
      </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
