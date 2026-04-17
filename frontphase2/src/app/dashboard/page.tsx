'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Users,
  Briefcase,
  UserRound,
  Calendar,
  Award,
  ClipboardList,
  BarChart3,
  CheckCircle,
  TrendingUp,
  TrendingDown,
  Clock,
  AlertCircle,
  ChevronRight,
  Loader2,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
} from 'recharts';
import { ImageWithFallback } from '../../components/ImageWithFallback';
import {
  apiGetActivityFeed,
  apiGetCandidateStats,
  apiGetClientMetrics,
  apiGetInterviewKpis,
  apiGetInterviews,
  apiGetJobMetrics,
  apiGetJobs,
  apiGetPlacementStats,
  apiGetPlacements,
  apiGetTaskStats,
  apiGetTasks,
  apiGetUsers,
  type BackendGlobalActivity,
  type BackendInterviewListItem,
  type BackendJob,
  type BackendTask,
  type BackendUser,
  type ClientMetrics,
} from '../../lib/api';
import type { Placement } from '../../types/placement';

function unwrapPaginated<T>(res: { data?: unknown }): { items: T[]; total: number } {
  const raw = res?.data as { data?: T[]; pagination?: { total?: number } } | T[] | undefined;
  if (!raw) return { items: [], total: 0 };
  if (Array.isArray(raw)) return { items: raw, total: raw.length };
  const items = Array.isArray(raw.data) ? raw.data : [];
  const total = raw.pagination?.total ?? items.length;
  return { items, total };
}

function getStoredUserId(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem('currentUser');
    if (!raw) return null;
    const u = JSON.parse(raw);
    return u?.id ?? null;
  } catch {
    return null;
  }
}

function formatCount(n: number) {
  return new Intl.NumberFormat().format(n);
}

function formatMoney(n: number) {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(
    n || 0
  );
}

function formatTrendPct(trend: number, up: boolean) {
  const v = Math.abs(Math.round(trend));
  return { text: `${v}%`, up };
}

function interviewStatusLabel(status: string) {
  const u = status.toUpperCase();
  if (u.includes('COMPLET')) return 'Completed';
  if (u.includes('CANCEL')) return 'Cancelled';
  if (u.includes('NO_SHOW')) return 'No show';
  if (u.includes('PROGRESS') || u === 'IN_PROGRESS') return 'In Progress';
  return 'Upcoming';
}

function avgOpenJobAgingDays(jobs: BackendJob[]): number | null {
  const open = jobs.filter((j) => j.status === 'OPEN');
  if (!open.length) return null;
  const sum = open.reduce((acc, j) => {
    const t = new Date(j.postedDate || j.createdAt || Date.now()).getTime();
    return acc + (Date.now() - t) / 86400000;
  }, 0);
  return Math.round(sum / open.length);
}

function buildJobsByClient(jobs: BackendJob[]) {
  const map = new Map<string, number>();
  for (const j of jobs) {
    if (j.status !== 'OPEN') continue;
    const name = j.client?.companyName?.trim() || 'No client';
    map.set(name, (map.get(name) || 0) + 1);
  }
  return [...map.entries()]
    .map(([name, jobsCount]) => ({ name, jobs: jobsCount }))
    .sort((a, b) => b.jobs - a.jobs)
    .slice(0, 8);
}

function buildJobStatusPie(jobs: BackendJob[]) {
  if (!jobs.length) {
    return { data: [{ name: 'Open', value: 0, color: '#3b82f6' }], open: 0, total: 0 };
  }
  let open = 0;
  for (const j of jobs) {
    if (j.status === 'OPEN') open += 1;
  }
  const closed = Math.max(0, jobs.length - open);
  const total = jobs.length;
  const openPct = total ? Math.round((open / total) * 100) : 0;
  const closedPct = total ? Math.max(0, 100 - openPct) : 0;
  return {
    data: [
      { name: 'Open', value: openPct, color: '#3b82f6' },
      { name: 'Other', value: closedPct, color: '#e2e8f0' },
    ],
    open,
    total,
  };
}

function buildRevenueTrendFromPlacements(placements: Placement[]) {
  const labels: { key: string; month: string }[] = [];
  const now = new Date();
  for (let i = 5; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    labels.push({
      key,
      month: d.toLocaleString('en', { month: 'short' }),
    });
  }
  const totals = new Map<string, number>();
  labels.forEach((l) => totals.set(l.key, 0));
  for (const p of placements) {
    const raw = p.offerDate || p.createdAt;
    if (!raw) continue;
    const d = new Date(raw);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (!totals.has(key)) continue;
    const amt = Number(p.revenue ?? p.placementFee ?? 0) || 0;
    totals.set(key, (totals.get(key) || 0) + amt);
  }
  return labels.map((l) => ({ month: l.month, revenue: totals.get(l.key) || 0 }));
}

const PIPELINE_STYLES = [
  'bg-blue-50 text-blue-600 border-blue-100',
  'bg-slate-50 text-slate-600 border-slate-100',
  'bg-indigo-50 text-indigo-600 border-indigo-100',
  'bg-violet-50 text-violet-600 border-violet-100',
  'bg-purple-50 text-purple-600 border-purple-100',
  'bg-pink-50 text-pink-600 border-pink-100',
  'bg-orange-50 text-orange-600 border-orange-100',
  'bg-emerald-50 text-emerald-600 border-emerald-100',
];

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [clientMetrics, setClientMetrics] = useState<ClientMetrics | null>(null);
  const [candidateStats, setCandidateStats] = useState<Awaited<ReturnType<typeof apiGetCandidateStats>>['data'] | null>(
    null
  );
  const [jobMetrics, setJobMetrics] = useState<Awaited<ReturnType<typeof apiGetJobMetrics>>['data'] | null>(null);
  const [placementStats, setPlacementStats] = useState<Awaited<ReturnType<typeof apiGetPlacementStats>>['data'] | null>(
    null
  );
  const [interviewKpis, setInterviewKpis] = useState<Awaited<ReturnType<typeof apiGetInterviewKpis>>['data'] | null>(
    null
  );
  const [taskStats, setTaskStats] = useState<Awaited<ReturnType<typeof apiGetTaskStats>>['data'] | null>(null);
  const [jobs, setJobs] = useState<BackendJob[]>([]);
  const [todayInterviews, setTodayInterviews] = useState<BackendInterviewListItem[]>([]);
  const [tasks, setTasks] = useState<BackendTask[]>([]);
  const [teamUsers, setTeamUsers] = useState<BackendUser[]>([]);
  const [placementsSample, setPlacementsSample] = useState<Placement[]>([]);
  const [activities, setActivities] = useState<BackendGlobalActivity[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const userId = getStoredUserId();
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setHours(23, 59, 59, 999);

    try {
      const [
        cm,
        cs,
        jm,
        ps,
        ik,
        ts,
        jobsRes,
        intRes,
        tasksRes,
        usersRes,
        placRes,
        actRes,
      ] = await Promise.all([
        apiGetClientMetrics(),
        apiGetCandidateStats(),
        apiGetJobMetrics(),
        apiGetPlacementStats(),
        apiGetInterviewKpis(),
        apiGetTaskStats(userId || undefined),
        apiGetJobs({ limit: 400, page: 1 }),
        apiGetInterviews({ dateFrom: start.toISOString(), dateTo: end.toISOString(), limit: 50, page: 1 }),
        apiGetTasks({ limit: 80, page: 1, assignedToId: userId || undefined }),
        apiGetUsers({ limit: 30, isActive: true, page: 1 }),
        apiGetPlacements({ limit: 200, page: 1 }),
        apiGetActivityFeed({ limit: 12, page: 1 }),
      ]);

      setClientMetrics(cm.data ?? null);
      setCandidateStats(cs.data ?? null);
      setJobMetrics(jm.data ?? null);
      setPlacementStats(ps.data ?? null);
      setInterviewKpis(ik.data ?? null);
      setTaskStats(ts.data ?? null);

      const { items: jobItems } = unwrapPaginated<BackendJob>(jobsRes);
      setJobs(jobItems);

      const intBody = intRes.data as
        | { data?: BackendInterviewListItem[]; kpis?: { todayCount?: number } }
        | undefined;
      setTodayInterviews(Array.isArray(intBody?.data) ? intBody.data : []);

      const { items: taskItems } = unwrapPaginated<BackendTask>(tasksRes);
      setTasks(
        taskItems.filter((t) => t.status === 'TODO' || t.status === 'IN_PROGRESS').slice(0, 8)
      );

      const usersPayload = usersRes.data as BackendUser[] | { data?: BackendUser[] } | undefined;
      const uList = Array.isArray(usersPayload)
        ? usersPayload
        : Array.isArray((usersPayload as any)?.data)
          ? (usersPayload as any).data
          : [];
      setTeamUsers(uList);

      const { items: placItems } = unwrapPaginated<Placement>(placRes);
      setPlacementsSample(placItems);

      const actPayload = actRes.data as { data?: BackendGlobalActivity[] } | undefined;
      setActivities(Array.isArray(actPayload?.data) ? actPayload.data : []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const kpiCards = useMemo(() => {
    const cm = clientMetrics;
    const ps = placementStats;
    const ik = interviewKpis;
    if (!cm) return [];

    const ac = formatTrendPct(cm.activeClients.trend, cm.activeClients.trendUp);
    const oj = formatTrendPct(cm.openJobs.trend, cm.openJobs.trendUp);
    const cp = formatTrendPct(cm.candidatesInProgress.trend, cm.candidatesInProgress.trendUp);
    const pm = formatTrendPct(cm.placementsThisMonth.trend, cm.placementsThisMonth.trendUp);

    return [
      {
        title: 'Active Clients',
        href: '/client',
        count: formatCount(cm.activeClients.value),
        trend: ac.text,
        up: ac.up,
        icon: Users,
        color: 'text-blue-500',
        bg: 'bg-blue-500/10',
      },
      {
        title: 'Open Jobs',
        href: '/job',
        count: formatCount(cm.openJobs.value),
        trend: oj.text,
        up: oj.up,
        icon: Briefcase,
        color: 'text-purple-500',
        bg: 'bg-purple-500/10',
      },
      {
        title: 'Active Candidates',
        href: '/candidate',
        count: formatCount(cm.candidatesInProgress.value),
        trend: cp.text,
        up: cp.up,
        icon: UserRound,
        color: 'text-emerald-500',
        bg: 'bg-emerald-500/10',
      },
      {
        title: 'Interviews Today',
        href: '/interviews',
        count: formatCount(ik?.todayCount ?? todayInterviews.length),
        trend: ik?.upcomingCount != null ? `${ik.upcomingCount} upcoming` : '—',
        up: true,
        icon: Calendar,
        color: 'text-orange-500',
        bg: 'bg-orange-500/10',
        trendIsText: true,
      },
      {
        title: 'Offers / Joining',
        href: '/placements',
        count: formatCount(ps?.joiningPending ?? 0),
        trend: 'pipeline',
        up: true,
        icon: ClipboardList,
        color: 'text-indigo-500',
        bg: 'bg-indigo-500/10',
        trendIsText: true,
      },
      {
        title: 'Placements Joined',
        href: '/placements',
        count: formatCount(ps?.joined ?? cm.placementsThisMonth.value),
        trend: pm.text,
        up: pm.up,
        icon: Award,
        color: 'text-pink-500',
        bg: 'bg-pink-500/10',
      },
    ];
  }, [clientMetrics, placementStats, interviewKpis, todayInterviews.length]);

  const pipelineStages = useMemo(() => {
    const s = candidateStats;
    if (!s) return [];
    const defs = [
      { label: 'Applied', count: s.applied },
      { label: 'Longlist', count: s.longlist },
      { label: 'Shortlist', count: s.shortlist },
      { label: 'Screening', count: s.screening },
      { label: 'Submitted', count: s.submitted },
      { label: 'Interviewing', count: s.interviewing },
      { label: 'Offered', count: s.offered },
      { label: 'Hired', count: s.hired },
    ];
    return defs.map((d, i) => ({
      ...d,
      color: PIPELINE_STYLES[i % PIPELINE_STYLES.length],
    }));
  }, [candidateStats]);

  const jobsByClientData = useMemo(() => buildJobsByClient(jobs), [jobs]);
  const jobPie = useMemo(() => buildJobStatusPie(jobs), [jobs]);
  const aging = useMemo(() => avgOpenJobAgingDays(jobs), [jobs]);
  const revenueTrend = useMemo(() => buildRevenueTrendFromPlacements(placementsSample), [placementsSample]);

  const recruiterRows = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of placementsSample) {
      if (p.recruiterId) counts.set(p.recruiterId, (counts.get(p.recruiterId) || 0) + 1);
    }
    return teamUsers.slice(0, 12).map((u) => ({
      id: u.id,
      name: u.name,
      avatar: u.avatar,
      placements: counts.get(u.id) ?? 0,
    }));
  }, [teamUsers, placementsSample]);

  const alerts = useMemo(() => {
    const list: {
      title: string;
      desc: string;
      href: string;
      icon: typeof AlertCircle;
      color: string;
      border: string;
    }[] = [];
    if (jobMetrics && jobMetrics.nearSla > 0) {
      list.push({
        title: 'Jobs near SLA',
        desc: `${jobMetrics.nearSla} open job(s) flagged with SLA risk.`,
        href: '/job',
        icon: AlertCircle,
        color: 'text-red-600 bg-red-50',
        border: 'border-red-100',
      });
    }
    if (taskStats && taskStats.overdueCount > 0) {
      list.push({
        title: 'Overdue tasks',
        desc: `You have ${taskStats.overdueCount} overdue task(s).`,
        href: '/Task&Activites',
        icon: Clock,
        color: 'text-orange-600 bg-orange-50',
        border: 'border-orange-100',
      });
    }
    if (placementStats && placementStats.joiningPending > 0) {
      list.push({
        title: 'Joining pending',
        desc: `${placementStats.joiningPending} placement(s) in offer / joining pipeline.`,
        href: '/placements',
        icon: AlertCircle,
        color: 'text-pink-600 bg-pink-50',
        border: 'border-pink-100',
      });
    }
    if (jobMetrics && jobMetrics.noCandidates > 0) {
      list.push({
        title: 'Open jobs without candidates',
        desc: `${jobMetrics.noCandidates} open job(s) have no matches yet.`,
        href: '/matches',
        icon: AlertCircle,
        color: 'text-amber-600 bg-amber-50',
        border: 'border-amber-100',
      });
    }
    return list.slice(0, 4);
  }, [jobMetrics, taskStats, placementStats]);

  const revenueMain = clientMetrics?.revenueGenerated?.formatted ?? formatMoney(placementStats?.revenueGenerated ?? 0);
  const pendingApprox = placementStats?.joiningPending
    ? `${placementStats.joiningPending} in pipeline`
    : '—';

  const todayLabel = new Date().toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const taskPriorityClass: Record<string, string> = {
    HIGH: 'bg-red-50 text-red-600 border border-red-100',
    MEDIUM: 'bg-orange-50 text-orange-600 border border-orange-100',
    LOW: 'bg-blue-50 text-blue-600 border border-blue-100',
  };

  if (loading) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 p-8 text-slate-500">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        <p className="text-sm font-medium">Loading dashboard…</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 p-8 duration-500 animate-in fade-in">
      <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
        <div className="space-y-1">
          <h2 className="text-2xl font-black tracking-tight text-slate-900">Agency Dashboard</h2>
          <p className="text-sm font-medium text-slate-500">Live data from your recruitment database</p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="self-start rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-600 shadow-sm hover:bg-slate-50"
        >
          Refresh
        </button>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      ) : null}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        {kpiCards.map((kpi, i) => (
          <Link
            key={i}
            href={kpi.href}
            aria-label={`${kpi.title}: ${kpi.count}. Go to related page.`}
            className="group block rounded-2xl border border-slate-200 bg-white p-5 shadow-sm outline-none ring-offset-2 transition-all hover:border-blue-200 hover:shadow-md focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            <div className="mb-4 flex items-start justify-between">
              <div className={`rounded-xl p-2.5 ${kpi.bg} ${kpi.color} transition-transform group-hover:scale-110`}>
                <kpi.icon size={20} />
              </div>
              <div
                className={`flex items-center gap-0.5 rounded-lg px-1.5 py-0.5 text-[10px] font-black ${
                  (kpi as { trendIsText?: boolean }).trendIsText
                    ? 'bg-slate-50 text-slate-500'
                    : kpi.up
                      ? 'bg-emerald-50 text-emerald-600'
                      : 'bg-red-50 text-red-600'
                }`}
              >
                {!((kpi as { trendIsText?: boolean }).trendIsText) ? (
                  kpi.up ? (
                    <TrendingUp size={10} />
                  ) : (
                    <TrendingDown size={10} />
                  )
                ) : null}{' '}
                {kpi.trend}
              </div>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{kpi.title}</p>
              <p className="mt-1 text-xl font-black text-slate-900">{kpi.count}</p>
            </div>
          </Link>
        ))}
      </div>

      {/* Pipeline */}
      <Link
        href="/pipeline"
        aria-label="Open candidate pipeline page"
        className="block overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm outline-none ring-offset-2 transition-all hover:border-blue-200 hover:shadow-md focus-visible:ring-2 focus-visible:ring-blue-500"
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500">Candidate pipeline (stages)</h3>
          <span className="text-[10px] font-bold text-slate-400">From candidate stats API · Click to open pipeline</span>
        </div>
        <div className="p-6">
          <div className="no-scrollbar flex w-full items-center gap-2 overflow-x-auto pb-2">
            {pipelineStages.map((stage, i) => (
              <React.Fragment key={stage.label}>
                <div
                  className={`flex min-w-[120px] flex-1 flex-col items-center rounded-xl border p-4 text-center transition-all hover:shadow-md ${stage.color}`}
                >
                  <span className="mb-1 text-[10px] font-black uppercase tracking-widest opacity-70">{stage.label}</span>
                  <span className="text-xl font-black">{formatCount(stage.count)}</span>
                </div>
                {i < pipelineStages.length - 1 ? (
                  <div className="flex shrink-0 items-center">
                    <ChevronRight size={14} className="text-slate-300" />
                  </div>
                ) : null}
              </React.Fragment>
            ))}
          </div>
        </div>
      </Link>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <Link
          href="/job"
          aria-label="Open jobs list"
          className="block rounded-2xl border border-slate-200 bg-white p-6 shadow-sm outline-none ring-offset-2 transition-all hover:border-blue-200 hover:shadow-md focus-visible:ring-2 focus-visible:ring-blue-500 lg:col-span-7"
        >
          <h3 className="mb-6 text-xs font-bold uppercase tracking-widest text-slate-500">Open jobs by client</h3>
          <div className="h-[300px] w-full">
            {jobsByClientData.length === 0 ? (
              <p className="py-16 text-center text-sm text-slate-400">No open jobs to chart.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={jobsByClientData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 700 }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 700 }} allowDecimals={false} />
                  <RechartsTooltip
                    cursor={{ fill: '#f8fafc', radius: 4 }}
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  />
                  <Bar dataKey="jobs" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={40} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Link>

        <Link
          href="/job"
          aria-label="Open jobs — job status"
          className="block rounded-2xl border border-slate-200 bg-white p-6 shadow-sm outline-none ring-offset-2 transition-all hover:border-blue-200 hover:shadow-md focus-visible:ring-2 focus-visible:ring-blue-500 lg:col-span-5"
        >
          <div className="mb-6 flex items-start justify-between">
            <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500">Job status (sample)</h3>
            <div className="text-right">
              <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Avg. open job aging</p>
              <p className="text-lg font-black text-slate-900">{aging != null ? `${aging} days` : '—'}</p>
            </div>
          </div>
          <div className="relative flex h-[250px] w-full items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={jobPie.data}
                  innerRadius={70}
                  outerRadius={90}
                  paddingAngle={5}
                  dataKey="value"
                  stroke="none"
                >
                  {jobPie.data.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <RechartsTooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl font-black tracking-tighter text-slate-900">{jobPie.total}</span>
              <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Jobs (loaded)</span>
            </div>
          </div>
          <div className="mt-4 flex justify-center gap-6">
            {jobPie.data.map((item, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                <span className="text-[11px] font-bold text-slate-500">
                  {item.name} ({item.value}%)
                </span>
              </div>
            ))}
          </div>
          <p className="mt-2 text-center text-[10px] text-slate-400">
            Open: {jobPie.open} · Based on up to {jobs.length} jobs from API
          </p>
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Link
          href="/Task&Activites"
          aria-label="Open tasks and activities"
          className="block overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm outline-none ring-offset-2 transition-all hover:border-blue-200 hover:shadow-md focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
            <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500">My pending tasks</h3>
            <span className="flex items-center gap-0.5 text-[10px] font-black uppercase tracking-widest text-blue-600">
              View all
              <ChevronRight size={12} className="opacity-80" />
            </span>
          </div>
          <div className="space-y-4 p-6">
            {tasks.length === 0 ? (
              <p className="text-sm text-slate-400">No pending tasks assigned to you.</p>
            ) : (
              tasks.map((item) => (
                <div
                  key={item.id}
                  className="group flex items-center gap-4 rounded-xl border border-transparent p-3 transition-all hover:border-slate-100 hover:bg-slate-50/80"
                >
                  <div className="flex h-5 w-5 items-center justify-center rounded border-2 border-slate-200 transition-all group-hover:border-blue-500 group-hover:bg-blue-50">
                    <div className="h-2 w-2 rounded-sm bg-blue-500 opacity-0 transition-all group-hover:opacity-100" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-bold tracking-tight text-slate-800">{item.title}</p>
                    <div className="mt-1 flex items-center gap-2">
                      <Clock size={12} className="text-slate-400" />
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                        {new Date(item.dueDate).toLocaleString()}
                        {item.dueTime ? ` · ${item.dueTime}` : ''}
                      </span>
                    </div>
                  </div>
                  <span
                    className={`text-[9px] font-black uppercase tracking-widest ${taskPriorityClass[item.priority] || 'border border-slate-100 bg-slate-50 text-slate-600'}`}
                  >
                    {item.priority}
                  </span>
                </div>
              ))
            )}
          </div>
        </Link>

        <Link
          href="/team"
          aria-label="Open team page"
          className="block overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm outline-none ring-offset-2 transition-all hover:border-blue-200 hover:shadow-md focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          <div className="border-b border-slate-100 px-6 py-4">
            <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500">Team · placements (sample)</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-50 text-[10px] font-black uppercase tracking-widest text-slate-400">
                  <th className="px-6 py-4">User</th>
                  <th className="px-6 py-4 text-center">Placements</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {recruiterRows.length === 0 ? (
                  <tr>
                    <td colSpan={2} className="px-6 py-6 text-center text-sm text-slate-400">
                      No team users loaded.
                    </td>
                  </tr>
                ) : (
                  recruiterRows.map((item) => (
                    <tr key={item.id} className="transition-all hover:bg-slate-50/50">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <ImageWithFallback
                            src={item.avatar || ''}
                            className="h-8 w-8 rounded-lg shadow-sm"
                            alt={item.name}
                          />
                          <span className="text-sm font-bold text-slate-800">{item.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="rounded-lg border border-blue-100 bg-blue-50 px-2 py-1 text-sm font-black text-blue-600 shadow-sm">
                          {item.placements}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Link>
      </div>

      {/* Interviews */}
      <Link
        href="/interviews"
        aria-label="Open interviews page"
        className="block overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm outline-none ring-offset-2 transition-all hover:border-blue-200 hover:shadow-md focus-visible:ring-2 focus-visible:ring-blue-500"
      >
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/30 px-6 py-4">
          <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500">Today&apos;s interviews</h3>
          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
            <Calendar size={14} /> {todayLabel}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-50 text-[10px] font-black uppercase tracking-widest text-slate-400">
                <th className="px-6 py-4">Candidate</th>
                <th className="px-6 py-4">Client</th>
                <th className="px-6 py-4">Role</th>
                <th className="px-6 py-4">Time</th>
                <th className="px-6 py-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {todayInterviews.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-sm text-slate-400">
                    No interviews scheduled for today.
                  </td>
                </tr>
              ) : (
                todayInterviews.map((item) => {
                  const st = interviewStatusLabel(item.status);
                  return (
                    <tr key={item.id} className="transition-all hover:bg-slate-50">
                      <td className="px-6 py-4">
                        <span className="text-sm font-bold text-slate-800">
                          {item.candidate.firstName} {item.candidate.lastName}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm font-medium text-slate-600">{item.client?.companyName ?? '—'}</td>
                      <td className="px-6 py-4">
                        <span className="rounded-lg bg-slate-100 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                          {item.job.title}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-xs font-semibold text-slate-600">
                        {new Date(item.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span
                          className={`rounded-xl border px-2.5 py-1.5 text-[9px] font-black uppercase tracking-widest ${
                            st === 'Completed'
                              ? 'border-emerald-100 bg-emerald-50 text-emerald-600'
                              : st === 'In Progress'
                                ? 'border-blue-100 bg-blue-50 text-blue-600'
                                : 'border-slate-100 bg-slate-50 text-slate-400'
                          }`}
                        >
                          {st}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Link>

      <div className="grid grid-cols-1 gap-6 pb-8 xl:grid-cols-3">
        <div className="space-y-4">
          <h3 className="ml-1 text-xs font-black uppercase tracking-widest text-slate-400">Alerts</h3>
          <div className="space-y-3">
            {alerts.length === 0 ? (
              <p className="text-sm text-slate-400">No automated alerts right now.</p>
            ) : (
              alerts.map((alert, i) => (
                <Link
                  key={i}
                  href={alert.href}
                  aria-label={alert.title}
                  className={`flex gap-4 rounded-2xl border bg-white p-4 shadow-sm outline-none ring-offset-2 transition-transform hover:translate-x-1 hover:shadow-md focus-visible:ring-2 focus-visible:ring-blue-500 ${alert.border}`}
                >
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${alert.color}`}>
                    <alert.icon size={18} />
                  </div>
                  <div>
                    <h4 className="text-sm font-black tracking-tight text-slate-900">{alert.title}</h4>
                    <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-slate-500">{alert.desc}</p>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>

        <Link
          href="/reports"
          aria-label="Open reports"
          className="block rounded-2xl border border-slate-200 bg-white p-6 shadow-sm outline-none ring-offset-2 transition-all hover:border-blue-200 hover:shadow-md focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          <h3 className="mb-6 text-xs font-bold uppercase tracking-widest text-slate-500">Recent activity</h3>
          <div className="relative space-y-6 before:absolute before:bottom-2 before:left-[9px] before:top-2 before:w-px before:bg-slate-100">
            {activities.length === 0 ? (
              <p className="text-sm text-slate-400">No recent activities.</p>
            ) : (
              activities.map((item) => (
                <div key={item.id} className="relative flex gap-5 pl-7">
                  <div className="absolute left-0 top-1.5 z-10 flex h-5 w-5 items-center justify-center rounded-lg bg-blue-600 text-white shadow-sm ring-4 ring-white">
                    <BarChart3 size={10} />
                  </div>
                  <div>
                    <p className="text-[13px] leading-snug text-slate-600">
                      <span className="font-black text-slate-900">{item.performedBy?.name ?? 'User'}</span>{' '}
                      <span className="font-bold text-slate-800">{item.action}</span>
                      {item.relatedLabel ? (
                        <>
                          {' '}
                          · <span className="font-semibold text-slate-700">{item.relatedLabel}</span>
                        </>
                      ) : null}
                    </p>
                    <p className="mt-1 text-[9px] font-black uppercase tracking-widest text-slate-400">
                      {new Date(item.createdAt).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </Link>

        <Link
          href="/billing"
          aria-label="Open billing"
          className="block rounded-2xl border border-slate-200 bg-white p-6 shadow-sm outline-none ring-offset-2 transition-all hover:border-blue-200 hover:shadow-md focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          <h3 className="mb-6 text-xs font-bold uppercase tracking-widest text-slate-500">Revenue snapshot</h3>
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Revenue (month / fmt)</p>
                <p className="mt-1 text-xl font-black text-slate-900">{revenueMain}</p>
              </div>
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Joining pipeline</p>
                <p className="mt-1 text-xl font-black text-slate-900">{pendingApprox}</p>
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">Task productivity</span>
                <span className="text-[10px] font-black text-blue-600">
                  {taskStats?.productivityPercent != null ? `${Math.round(taskStats.productivityPercent)}%` : '—'}
                </span>
              </div>
              <div className="flex h-2 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full bg-blue-600 shadow-[0_0_10px_rgba(59,130,246,0.2)] transition-all"
                  style={{ width: `${Math.min(100, Math.max(0, taskStats?.productivityPercent ?? 0))}%` }}
                />
              </div>
            </div>
            <div className="h-[120px] w-full pt-4">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={revenueTrend}>
                  <defs>
                    <linearGradient id="colorRevDash" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Area type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#colorRevDash)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <p className="text-[10px] text-slate-400">Fees/revenue by month from last {placementsSample.length} placements (sample).</p>
          </div>
        </Link>
      </div>
    </div>
  );
}
