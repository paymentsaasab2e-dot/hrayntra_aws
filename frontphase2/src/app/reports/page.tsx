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
  Target,
  TrendingUp,
  Users,
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
import { apiFetch, buildApiUrl } from '../../lib/api';

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

type FilterOption = { id: string; name: string };
type DateRangeOption = { value: string; label: string };

type SummaryResponse = {
  filters: {
    dateRange: string;
    clientId: string | null;
    jobId: string | null;
    recruiterId: string | null;
  };
  options: {
    dateRanges: DateRangeOption[];
    clients: FilterOption[];
    jobs: FilterOption[];
    recruiters: FilterOption[];
  };
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
};

type DatasetResponse = {
  entity: string;
  title: string;
  columns: string[];
  rows: Record<string, string | number>[];
};

type FiltersState = {
  dateRange: string;
  clientId: string;
  jobId: string;
  recruiterId: string;
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

const DEFAULT_FILTERS: FiltersState = {
  dateRange: 'last_30_days',
  clientId: '',
  jobId: '',
  recruiterId: '',
};

const CHART_COLORS = ['#2563eb', '#8b5cf6', '#f59e0b', '#10b981', '#ef4444', '#0f172a'];

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

function buildQueryString(filters: FiltersState, extra: Record<string, string> = {}) {
  const params = new URLSearchParams();
  if (filters.dateRange) params.set('dateRange', filters.dateRange);
  if (filters.clientId) params.set('clientId', filters.clientId);
  if (filters.jobId) params.set('jobId', filters.jobId);
  if (filters.recruiterId) params.set('recruiterId', filters.recruiterId);
  Object.entries(extra).forEach(([key, value]) => {
    if (value) params.set(key, value);
  });
  return params.toString();
}

function getUploadUrl(fileUrl: string) {
  const base = buildApiUrl('/').replace(/\/api\/v1\/?$/, '').replace(/\/api\/proxy\/?$/, '');
  return fileUrl.startsWith('http') ? fileUrl : `${base}${fileUrl}`;
}

const Card = ({ title, children, className = '' }: { title?: string; children: React.ReactNode; className?: string }) => (
  <div className={`overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm ${className}`}>
    {title ? (
      <div className="border-b border-slate-100 px-6 py-4">
        <h3 className="font-semibold text-slate-800">{title}</h3>
      </div>
    ) : null}
    <div className="p-6">{children}</div>
  </div>
);

const KPICard = ({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: string | number;
  icon: any;
  color: string;
}) => (
  <Card>
    <div className="mb-4 flex items-center justify-between">
      <div className={`rounded-lg ${color} bg-opacity-10 p-2`}>
        <Icon size={20} className={color.replace('bg-', 'text-')} />
      </div>
    </div>
    <div className="text-2xl font-bold text-slate-900">{value}</div>
    <div className="mt-1 text-sm text-slate-500">{label}</div>
  </Card>
);

const SectionHeader = ({ title, subtitle }: { title: string; subtitle?: string }) => (
  <div className="mb-6">
    <h2 className="text-xl font-bold text-slate-900">{title}</h2>
    {subtitle ? <p className="mt-1 text-sm text-slate-500">{subtitle}</p> : null}
  </div>
);

const EmptyState = ({ text }: { text: string }) => (
  <div className="flex min-h-[180px] items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 text-sm text-slate-500">
    {text}
  </div>
);

function ReportsContent({
  activeTab,
  summary,
  customSource,
  setCustomSource,
  customDataset,
  customColumns,
  setCustomColumns,
  customLoading,
  onGenerateCustom,
}: {
  activeTab: ReportTab;
  summary: SummaryResponse | null;
  customSource: string;
  setCustomSource: (value: string) => void;
  customDataset: DatasetResponse | null;
  customColumns: string[];
  setCustomColumns: React.Dispatch<React.SetStateAction<string[]>>;
  customLoading: boolean;
  onGenerateCustom: () => void;
}) {
  if (!summary) return <EmptyState text="No report data available." />;

  switch (activeTab) {
    case 'Recruitment Performance':
      return (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3 lg:grid-cols-6">
            <KPICard label="Total Open Jobs" value={formatNumber(summary.recruitmentPerformance.kpis.totalOpenJobs)} icon={Briefcase} color="bg-blue-600" />
            <KPICard label="Active Candidates" value={formatNumber(summary.recruitmentPerformance.kpis.activeCandidates)} icon={Users} color="bg-purple-600" />
            <KPICard label="Interviews" value={formatNumber(summary.recruitmentPerformance.kpis.interviews)} icon={Calendar} color="bg-orange-600" />
            <KPICard label="Offers Released" value={formatNumber(summary.recruitmentPerformance.kpis.offersReleased)} icon={FileText} color="bg-indigo-600" />
            <KPICard label="Placements" value={formatNumber(summary.recruitmentPerformance.kpis.placements)} icon={CheckCircle2} color="bg-green-600" />
            <KPICard label="Conversion %" value={`${summary.recruitmentPerformance.kpis.conversionPct}%`} icon={TrendingUp} color="bg-pink-600" />
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
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2" title="Active Job Status">
            {summary.jobsClients.jobs.length ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <th className="pb-4 pt-0 text-sm font-semibold text-slate-600">Job Title</th>
                      <th className="pb-4 pt-0 text-sm font-semibold text-slate-600">Client</th>
                      <th className="pb-4 pt-0 text-sm font-semibold text-slate-600">Status</th>
                      <th className="pb-4 pt-0 text-sm font-semibold text-slate-600">Candidates</th>
                      <th className="pb-4 pt-0 text-sm font-semibold text-slate-600">Aging</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {summary.jobsClients.jobs.map((job) => (
                      <tr key={job.id} className="hover:bg-slate-50">
                        <td className="py-4 text-sm font-medium text-slate-900">{job.title}</td>
                        <td className="py-4 text-sm text-slate-600">{job.client}</td>
                        <td className="py-4 text-xs"><span className="rounded-full bg-slate-100 px-2 py-1 font-medium text-slate-700">{job.status}</span></td>
                        <td className="py-4 text-sm text-slate-600">{formatNumber(job.count)}</td>
                        <td className="py-4 text-sm text-slate-600">{job.aging}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState text="No job data found." />
            )}
          </Card>
          <Card title="Top Clients by Volume">
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
      );

    case 'Candidates':
      return (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card title="Candidate Sourcing Channels">
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
      );

    case 'Interviews':
      return (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2" title="Scheduled vs Completed Interviews">
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
      );

    case 'Placements & Revenue':
      return (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            <KPICard label="Total Placements" value={formatNumber(summary.placementsRevenue.kpis.totalPlacements)} icon={Target} color="bg-green-600" />
            <KPICard label="Total Revenue" value={formatCurrency(summary.placementsRevenue.kpis.totalRevenue)} icon={TrendingUp} color="bg-blue-600" />
            <KPICard label="Avg. Billing" value={formatCurrency(summary.placementsRevenue.kpis.avgBilling)} icon={BarChart3} color="bg-indigo-600" />
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
        </div>
      );

    case 'Team Performance':
      return (
        <Card title="Recruiter Leaderboard">
          {summary.teamPerformance.leaderboard.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="pb-4 pt-0 text-sm font-semibold text-slate-600">Rank</th>
                    <th className="pb-4 pt-0 text-sm font-semibold text-slate-600">Recruiter</th>
                    <th className="pb-4 pt-0 text-sm font-semibold text-slate-600">Jobs Handled</th>
                    <th className="pb-4 pt-0 text-sm font-semibold text-slate-600">Submissions</th>
                    <th className="pb-4 pt-0 text-sm font-semibold text-slate-600">Interviews</th>
                    <th className="pb-4 pt-0 text-sm font-semibold text-slate-600">Placements</th>
                    <th className="pb-4 pt-0 text-sm font-semibold text-slate-600">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {summary.teamPerformance.leaderboard.map((recruiter) => (
                    <tr key={recruiter.id} className="hover:bg-slate-50">
                      <td className="py-4 text-sm">
                        <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${recruiter.rank === 1 ? 'bg-yellow-100 text-yellow-700' : recruiter.rank === 2 ? 'bg-slate-200 text-slate-700' : recruiter.rank === 3 ? 'bg-orange-100 text-orange-700' : 'bg-slate-100 text-slate-500'}`}>
                          {recruiter.rank}
                        </span>
                      </td>
                      <td className="py-4 text-sm font-medium text-slate-900">{recruiter.name}</td>
                      <td className="py-4 text-sm text-slate-600">{formatNumber(recruiter.jobs)}</td>
                      <td className="py-4 text-sm text-slate-600">{formatNumber(recruiter.submissions)}</td>
                      <td className="py-4 text-sm text-slate-600">{formatNumber(recruiter.interviews)}</td>
                      <td className="py-4 text-sm font-semibold text-blue-600">{formatNumber(recruiter.placements)}</td>
                      <td className="py-4"><ChevronRight size={18} className="text-slate-400" /></td>
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
          <div className="grid grid-cols-1 gap-6 md:grid-cols-4">
            <KPICard label="Calls Made" value={formatNumber(summary.activityProductivity.kpis.callsMade)} icon={Phone} color="bg-blue-600" />
            <KPICard label="Emails Sent" value={formatNumber(summary.activityProductivity.kpis.emailsSent)} icon={Mail} color="bg-purple-600" />
            <KPICard label="Tasks Completed" value={formatNumber(summary.activityProductivity.kpis.tasksCompleted)} icon={CheckCircle2} color="bg-green-600" />
            <KPICard label="Overdue Tasks" value={formatNumber(summary.activityProductivity.kpis.overdueTasks)} icon={Clock} color="bg-red-600" />
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
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none transition-all focus:ring-2 focus:ring-blue-500"
                  value={customSource}
                  onChange={(event) => setCustomSource(event.target.value)}
                >
                  <option value="jobs">Jobs</option>
                  <option value="candidates">Candidates</option>
                  <option value="interviews">Interviews</option>
                  <option value="placements">Placements</option>
                  <option value="clients">Clients</option>
                  <option value="leads">Leads</option>
                  <option value="tasks">Tasks</option>
                  <option value="team">Team Performance</option>
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
              <button
                onClick={onGenerateCustom}
                disabled={customLoading}
                className="w-full rounded-lg bg-blue-600 py-2 font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {customLoading ? 'Generating...' : 'Generate Report'}
              </button>
            </div>
          </Card>
          <Card className="lg:col-span-2" title="Report Preview">
            {customDataset && customDataset.rows.length ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-slate-100">
                      {customDataset.columns.map((column) => (
                        <th key={column} className="pb-3 pr-4 text-sm font-semibold text-slate-600">{column}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {customDataset.rows.slice(0, 15).map((row, index) => (
                      <tr key={`${customDataset.entity}-${index}`}>
                        {customDataset.columns.map((column) => (
                          <td key={column} className="py-3 pr-4 text-sm text-slate-700">{String(row[column] ?? '')}</td>
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
  const [activeTab, setActiveTab] = useState<ReportTab>('Recruitment Performance');
  const [draftFilters, setDraftFilters] = useState<FiltersState>(DEFAULT_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState<FiltersState>(DEFAULT_FILTERS);
  const [summary, setSummary] = useState<SummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState<'csv' | 'pdf' | null>(null);
  const [customSource, setCustomSource] = useState('jobs');
  const [customDataset, setCustomDataset] = useState<DatasetResponse | null>(null);
  const [customColumns, setCustomColumns] = useState<string[]>([]);
  const [customLoading, setCustomLoading] = useState(false);

  const loadSummary = async (filters: FiltersState) => {
    setLoading(true);
    setError(null);
    try {
      const query = buildQueryString(filters);
      const response = await apiFetch<SummaryResponse>(`/reports/summary?${query}`, { auth: true });
      setSummary(response.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load reports');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadSummary(appliedFilters);
  }, [appliedFilters]);

  useEffect(() => {
    setCustomDataset(null);
    setCustomColumns([]);
  }, [customSource]);

  const generateCustomPreview = async () => {
    setCustomLoading(true);
    setError(null);
    try {
      const query = buildQueryString(appliedFilters, {
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

  const dateLabel = useMemo(() => {
    const option = summary?.options.dateRanges.find((item) => item.value === draftFilters.dateRange);
    return option?.label || 'Last 30 Days';
  }, [summary, draftFilters.dateRange]);

  const handleExport = async (format: 'csv' | 'pdf') => {
    setExporting(format);
    setError(null);
    try {
      if (activeTab === 'Custom Reports') {
        const query = buildQueryString(appliedFilters);
        const response = await apiFetch<{ downloadUrl: string }>(`/reports/export/${customSource}/${format}?${query}`, { auth: true });
        window.open(getUploadUrl(response.data.downloadUrl), '_blank', 'noopener,noreferrer');
        return;
      }

      const tabKey = TAB_EXPORT_KEY[activeTab as Exclude<ReportTab, 'Custom Reports'>];
      const query = buildQueryString(appliedFilters);
      const response = await apiFetch<{ downloadUrl: string }>(`/reports/summary/export/${tabKey}/${format}?${query}`, { auth: true });
      window.open(getUploadUrl(response.data.downloadUrl), '_blank', 'noopener,noreferrer');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to export report');
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] font-sans text-slate-900">
      <div className="sticky top-0 z-10 border-b border-slate-200 bg-white px-8 py-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex cursor-default items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
            <Calendar size={16} className="text-slate-500" />
            <span className="text-sm font-medium text-slate-700">{dateLabel}</span>
            <ChevronDown size={14} className="text-slate-400" />
          </div>

          <select
            value={draftFilters.dateRange}
            onChange={(event) => setDraftFilters((prev) => ({ ...prev, dateRange: event.target.value }))}
            className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none transition-all focus:ring-2 focus:ring-blue-500"
          >
            {(summary?.options.dateRanges || [{ value: 'last_30_days', label: 'Last 30 Days' }]).map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>

          <select
            value={draftFilters.clientId}
            onChange={(event) => setDraftFilters((prev) => ({ ...prev, clientId: event.target.value }))}
            className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none transition-all focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Clients</option>
            {(summary?.options.clients || []).map((client) => (
              <option key={client.id} value={client.id}>{client.name}</option>
            ))}
          </select>

          <select
            value={draftFilters.jobId}
            onChange={(event) => setDraftFilters((prev) => ({ ...prev, jobId: event.target.value }))}
            className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none transition-all focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Jobs</option>
            {(summary?.options.jobs || []).map((job) => (
              <option key={job.id} value={job.id}>{job.name}</option>
            ))}
          </select>

          <select
            value={draftFilters.recruiterId}
            onChange={(event) => setDraftFilters((prev) => ({ ...prev, recruiterId: event.target.value }))}
            className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none transition-all focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Recruiters</option>
            {(summary?.options.recruiters || []).map((recruiter) => (
              <option key={recruiter.id} value={recruiter.id}>{recruiter.name}</option>
            ))}
          </select>

          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={() => setAppliedFilters(draftFilters)}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition-all hover:bg-slate-800"
            >
              Apply Filters
            </button>
            <button
              onClick={() => {
                setDraftFilters(DEFAULT_FILTERS);
                setAppliedFilters(DEFAULT_FILTERS);
              }}
              className="px-4 py-2 text-sm font-medium text-slate-500 transition-colors hover:text-slate-900"
            >
              Reset
            </button>
          </div>
        </div>
      </div>

      <div className="flex overflow-x-auto border-b border-slate-200 bg-white px-8 no-scrollbar">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`relative whitespace-nowrap border-b-2 px-4 py-4 text-sm font-medium transition-all ${activeTab === tab ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
          >
            {tab}
            {activeTab === tab ? <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600" /> : null}
          </button>
        ))}
      </div>

      <div className="p-8">
        <div className="mb-8 flex items-center justify-between gap-4">
          <SectionHeader
            title={activeTab}
            subtitle={`Detailed insights and performance data for ${activeTab.toLowerCase()}.`}
          />

          <div className="flex items-center gap-2">
            <button
              onClick={() => void handleExport('csv')}
              disabled={!!exporting}
              className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition-all hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Download size={16} /> {exporting === 'csv' ? 'Exporting...' : 'Export CSV'}
            </button>
            <button
              onClick={() => void handleExport('pdf')}
              disabled={!!exporting}
              className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition-all hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <FileText size={16} /> {exporting === 'pdf' ? 'Exporting...' : 'PDF Report'}
            </button>
            <button
              onClick={() => void generateCustomPreview()}
              className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition-all hover:bg-slate-50"
            >
              <Mail size={16} /> Refresh Data
            </button>
          </div>
        </div>

        {error ? (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        ) : null}

        {loading ? (
          <EmptyState text="Loading real report data..." />
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
                customSource={customSource}
                setCustomSource={setCustomSource}
                customDataset={customDataset}
                customColumns={customColumns}
                setCustomColumns={setCustomColumns}
                customLoading={customLoading}
                onGenerateCustom={() => void generateCustomPreview()}
              />
            </motion.div>
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
