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
  TrendingUp,
  TrendingDown,
  Clock,
  AlertCircle,
  ChevronRight,
  Target,
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
import { usePermissions } from '../../hooks/usePermissions';
import { usePageAutoRefresh } from '../../hooks/usePageAutoRefresh';
import { PageSkeleton } from '../../components/ui/Skeleton';
import {
  apiGetActivityFeed,
  apiGetCandidateStats,
  apiGetClientMetrics,
  apiGetClients,
  apiGetInterviewKpis,
  apiGetInterviews,
  apiGetJobMetrics,
  apiGetJobs,
  apiGetLeads,
  apiGetPlacementStats,
  apiGetPlacements,
  apiGetTaskStats,
  apiGetTasks,
  apiGetUsers,
  isOrgBillingNavEnabled,
  type BackendClient,
  type BackendGlobalActivity,
  type BackendInterviewListItem,
  type BackendJob,
  type BackendLead,
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

type CandidateStatsSnapshot = {
  all: number;
  applied: number;
  longlist: number;
  shortlist: number;
  screening: number;
  submitted: number;
  interviewing: number;
  offered: number;
  hired: number;
  rejected: number;
};

function normalizeCandidateStats(payload: unknown): CandidateStatsSnapshot | null {
  if (!payload || typeof payload !== 'object') return null;
  const raw =
    'data' in payload && (payload as { data?: unknown }).data && typeof (payload as { data?: unknown }).data === 'object'
      ? (payload as { data: unknown }).data
      : payload;
  if (!raw || typeof raw !== 'object') return null;

  const stats = raw as Partial<CandidateStatsSnapshot>;
  return {
    all: Number(stats.all ?? 0),
    applied: Number(stats.applied ?? 0),
    longlist: Number(stats.longlist ?? 0),
    shortlist: Number(stats.shortlist ?? 0),
    screening: Number(stats.screening ?? 0),
    submitted: Number(stats.submitted ?? 0),
    interviewing: Number(stats.interviewing ?? 0),
    offered: Number(stats.offered ?? 0),
    hired: Number(stats.hired ?? 0),
    rejected: Number(stats.rejected ?? 0),
  };
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
  const counts = new Map<string, number>();
  const labels: Record<string, string> = {
    OPEN: 'Open',
    DRAFT: 'Draft',
    ON_HOLD: 'On hold',
    CLOSED: 'Closed',
    FILLED: 'Filled',
  };
  const colors: Record<string, string> = {
    OPEN: '#3b82f6',
    DRAFT: '#94a3b8',
    ON_HOLD: '#f59e0b',
    CLOSED: '#64748b',
    FILLED: '#10b981',
  };

  for (const job of jobs) {
    const status = (job.status || 'UNKNOWN').trim().toUpperCase();
    counts.set(status, (counts.get(status) || 0) + 1);
  }

  const order = ['OPEN', 'DRAFT', 'ON_HOLD', 'CLOSED', 'FILLED'];
  const data = order
    .filter((status) => (counts.get(status) || 0) > 0)
    .map((status) => ({
      name: labels[status],
      value: counts.get(status) || 0,
      color: colors[status],
    }));

  const open = counts.get('OPEN') || 0;
  const total = jobs.length;
  return {
    data: data.length ? data : [{ name: 'Open', value: 0, color: '#3b82f6' }],
    open,
    total,
  };
}

function buildCandidatePipelinePie(s: CandidateStatsSnapshot) {
  const segments = [
    { name: 'Applied', value: s.applied, color: '#3b82f6' },
    { name: 'Screening', value: s.screening, color: '#8b5cf6' },
    { name: 'Interviewing', value: s.interviewing, color: '#f59e0b' },
    { name: 'Offered', value: s.offered, color: '#10b981' },
    { name: 'Hired', value: s.hired, color: '#059669' },
    { name: 'Rejected', value: s.rejected, color: '#94a3b8' },
  ].filter((x) => x.value > 0);
  const total = segments.reduce((a, b) => a + b.value, 0);
  return {
    data: segments.length ? segments : [{ name: 'No data', value: 0, color: '#e2e8f0' }],
    total,
  };
}

const LEAD_STATUS_COLORS: Record<string, string> = {
  New: '#3b82f6',
  Contacted: '#8b5cf6',
  Qualified: '#10b981',
  Converted: '#059669',
  Lost: '#94a3b8',
};

function buildLeadsStatusPie(leads: Pick<BackendLead, 'status'>[]) {
  const counts = new Map<string, number>();
  for (const L of leads) {
    const k = L.status || 'Unknown';
    counts.set(k, (counts.get(k) || 0) + 1);
  }
  const data = [...counts.entries()].map(([name, value]) => ({
    name,
    value,
    color: LEAD_STATUS_COLORS[name] || '#64748b',
  }));
  return {
    data: data.length ? data : [{ name: 'No data', value: 0, color: '#e2e8f0' }],
    total: leads.length,
  };
}

const CLIENT_STATUS_COLORS: Record<string, string> = {
  ACTIVE: '#10b981',
  PROSPECT: '#3b82f6',
  ON_HOLD: '#f59e0b',
  INACTIVE: '#94a3b8',
};

function buildClientStatusPie(clients: Pick<BackendClient, 'status'>[]) {
  const counts = new Map<string, number>();
  for (const c of clients) {
    const k = c.status || 'UNKNOWN';
    counts.set(k, (counts.get(k) || 0) + 1);
  }
  const data = [...counts.entries()].map(([name, value]) => ({
    name,
    value,
    color: CLIENT_STATUS_COLORS[name] || '#64748b',
  }));
  return {
    data: data.length ? data : [{ name: 'No data', value: 0, color: '#e2e8f0' }],
    total: clients.length,
  };
}

async function fetchRes<T>(fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn();
  } catch {
    return null;
  }
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
  const { hasAnyPermission, hasPermission } = usePermissions();
  const fullAccess = hasPermission('all');

  const showLeads =
    fullAccess || hasAnyPermission(['leads_read', 'leads_create', 'leads_update', 'leads_delete']);
  const showClients =
    fullAccess || hasAnyPermission(['clients_read', 'clients_create', 'clients_update', 'clients_delete']);
  const showJobs =
    fullAccess ||
    hasAnyPermission([
      'view_jobs',
      'jobs_read',
      'jobs_create',
      'jobs_update',
      'jobs_delete',
      'create_job',
      'edit_job',
      'delete_job',
      'assign_job',
    ]);
  const showCandidates =
    fullAccess ||
    hasAnyPermission([
      'candidates_read',
      'view_all_candidates',
      'view_assigned_candidates',
      'candidates_create',
      'candidates_update',
      'candidates_delete',
      'add_candidate',
      'edit_candidate',
      'delete_candidate',
      'move_pipeline',
      'submit_candidate',
    ]);
  const showInterviews =
    fullAccess || hasAnyPermission(['interviews_read', 'interviews_create', 'interviews_update', 'interviews_delete']);
  const showPlacements =
    fullAccess ||
    hasAnyPermission(['placements_read', 'placements_create', 'placements_update', 'placements_delete']);
  const showTasks =
    fullAccess ||
    showJobs ||
    showCandidates ||
    showInterviews ||
    hasAnyPermission(['manage_settings', 'access_integrations', 'export_data']);
  const showTeam =
    fullAccess || hasAnyPermission(['add_team_member', 'edit_team_member', 'assign_roles', 'generate_credentials']);
  const showReports = fullAccess || hasAnyPermission(['reports_read', 'reports_create', 'reports_update', 'reports_delete']);
  const showActivity = showLeads || showClients || showJobs || showCandidates || showInterviews || showPlacements || showTeam;
  const showBillingCard =
    isOrgBillingNavEnabled() && (fullAccess || hasAnyPermission(['access_billing', 'manage_settings']));

  const [loading, setLoading] = useState(true);

  const [clientMetrics, setClientMetrics] = useState<ClientMetrics | null>(null);
  const [candidateStats, setCandidateStats] = useState<CandidateStatsSnapshot | null>(null);
  const [jobMetrics, setJobMetrics] = useState<Awaited<ReturnType<typeof apiGetJobMetrics>>['data'] | null>(null);
  const [placementStats, setPlacementStats] = useState<Awaited<ReturnType<typeof apiGetPlacementStats>>['data'] | null>(
    null
  );
  const [interviewKpis, setInterviewKpis] = useState<Awaited<ReturnType<typeof apiGetInterviewKpis>>['data'] | null>(
    null
  );
  const [taskStats, setTaskStats] = useState<Awaited<ReturnType<typeof apiGetTaskStats>>['data'] | null>(null);
  const [jobs, setJobs] = useState<BackendJob[]>([]);
  const [leadsSample, setLeadsSample] = useState<BackendLead[]>([]);
  const [clientsSample, setClientsSample] = useState<BackendClient[]>([]);
  const [todayInterviews, setTodayInterviews] = useState<BackendInterviewListItem[]>([]);
  const [tasks, setTasks] = useState<BackendTask[]>([]);
  const [teamUsers, setTeamUsers] = useState<BackendUser[]>([]);
  const [placementsSample, setPlacementsSample] = useState<Placement[]>([]);
  const [activities, setActivities] = useState<BackendGlobalActivity[]>([]);

  const load = useCallback(async (silent: boolean) => {
    if (!silent) setLoading(true);
    const userId = getStoredUserId();
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setHours(23, 59, 59, 999);

    const [
      cm,
      cs,
      jm,
      ps,
      ik,
      ts,
      jobsRes,
      leadsRes,
      clientsRes,
      intRes,
      tasksRes,
      usersRes,
      placRes,
      actRes,
    ] = await Promise.all([
      showClients ? fetchRes(() => apiGetClientMetrics()) : Promise.resolve(null),
      showCandidates ? fetchRes(() => apiGetCandidateStats()) : Promise.resolve(null),
      showJobs ? fetchRes(() => apiGetJobMetrics()) : Promise.resolve(null),
      showPlacements ? fetchRes(() => apiGetPlacementStats()) : Promise.resolve(null),
      showInterviews ? fetchRes(() => apiGetInterviewKpis()) : Promise.resolve(null),
      showTasks ? fetchRes(() => apiGetTaskStats(userId || undefined)) : Promise.resolve(null),
      showJobs ? fetchRes(() => apiGetJobs({ limit: 400, page: 1 })) : Promise.resolve(null),
      showLeads ? fetchRes(() => apiGetLeads({ limit: 250, page: 1 })) : Promise.resolve(null),
      showClients ? fetchRes(() => apiGetClients({ limit: 250, page: 1 })) : Promise.resolve(null),
      showInterviews
        ? fetchRes(() => apiGetInterviews({ dateFrom: start.toISOString(), dateTo: end.toISOString(), limit: 50, page: 1 }))
        : Promise.resolve(null),
      showTasks ? fetchRes(() => apiGetTasks({ limit: 80, page: 1, assignedToId: userId || undefined })) : Promise.resolve(null),
      showTeam ? fetchRes(() => apiGetUsers({ limit: 30, isActive: true, page: 1 })) : Promise.resolve(null),
      showPlacements ? fetchRes(() => apiGetPlacements({ limit: 200, page: 1 })) : Promise.resolve(null),
      showActivity ? fetchRes(() => apiGetActivityFeed({ limit: 12, page: 1 })) : Promise.resolve(null),
    ]);

    setClientMetrics(cm?.data ?? null);
    setCandidateStats(normalizeCandidateStats(cs?.data as unknown));
    setJobMetrics(jm?.data ?? null);
    setPlacementStats(ps?.data ?? null);
    setInterviewKpis(ik?.data ?? null);
    setTaskStats(ts?.data ?? null);

    if (jobsRes) {
      const { items: jobItems } = unwrapPaginated<BackendJob>(jobsRes);
      setJobs(jobItems);
    } else {
      setJobs([]);
    }

    if (leadsRes) {
      const { items } = unwrapPaginated<BackendLead>(leadsRes);
      setLeadsSample(items);
    } else {
      setLeadsSample([]);
    }

    if (clientsRes) {
      const { items } = unwrapPaginated<BackendClient>(clientsRes);
      setClientsSample(items);
    } else {
      setClientsSample([]);
    }

    const intBody = intRes?.data as
      | { data?: BackendInterviewListItem[]; kpis?: { todayCount?: number } }
      | undefined;
    setTodayInterviews(Array.isArray(intBody?.data) ? intBody.data : []);

    if (tasksRes) {
      const { items: taskItems } = unwrapPaginated<BackendTask>(tasksRes);
      setTasks(taskItems.filter((t) => t.status === 'TODO' || t.status === 'IN_PROGRESS').slice(0, 8));
    } else {
      setTasks([]);
    }

    const usersPayload = usersRes?.data as BackendUser[] | { data?: BackendUser[] } | undefined;
    const uList = Array.isArray(usersPayload)
      ? usersPayload
      : Array.isArray((usersPayload as { data?: BackendUser[] })?.data)
        ? (usersPayload as { data: BackendUser[] }).data
        : [];
    setTeamUsers(uList);

    if (placRes) {
      const { items: placItems } = unwrapPaginated<Placement>(placRes);
      setPlacementsSample(placItems);
    } else {
      setPlacementsSample([]);
    }

    const actPayload = actRes?.data as { data?: BackendGlobalActivity[] } | undefined;
    setActivities(Array.isArray(actPayload?.data) ? actPayload.data : []);

    if (!silent) setLoading(false);
  }, [
    showActivity,
    showCandidates,
    showClients,
    showInterviews,
    showJobs,
    showLeads,
    showPlacements,
    showTasks,
    showTeam,
  ]);

  useEffect(() => {
    void load(false);
  }, [load]);

  const autoLoad = useCallback(({ silent }: { silent: boolean }) => load(silent), [load]);
  usePageAutoRefresh(autoLoad);

  const kpiCards = useMemo(() => {
    type Kpi = {
      title: string;
      href: string;
      count: string;
      trend: string;
      up: boolean;
      icon: typeof Briefcase;
      color: string;
      bg: string;
      trendIsText?: boolean;
    };
    const cards: Kpi[] = [];

    if (showLeads) {
      const total = leadsSample.length;
      cards.push({
        title: 'Leads',
        href: '/leads',
        count: formatCount(total),
        trend: 'In workspace',
        up: true,
        icon: Target,
        color: 'text-sky-500',
        bg: 'bg-sky-500/10',
        trendIsText: true,
      });
    }

    if (showClients && clientMetrics) {
      const ac = formatTrendPct(clientMetrics.activeClients.trend, clientMetrics.activeClients.trendUp);
      cards.push({
        title: 'Active clients',
        href: '/client',
        count: formatCount(clientMetrics.activeClients.value),
        trend: ac.text,
        up: ac.up,
        icon: Users,
        color: 'text-blue-500',
        bg: 'bg-blue-500/10',
      });
    } else if (showClients && clientsSample.length) {
      const active = clientsSample.filter((c) => c.status === 'ACTIVE').length;
      cards.push({
        title: 'Clients',
        href: '/client',
        count: formatCount(clientsSample.length),
        trend: `${formatCount(active)} active`,
        up: true,
        icon: Users,
        color: 'text-blue-500',
        bg: 'bg-blue-500/10',
        trendIsText: true,
      });
    }

    if (showJobs && clientMetrics) {
      const oj = formatTrendPct(clientMetrics.openJobs.trend, clientMetrics.openJobs.trendUp);
      cards.push({
        title: 'Open jobs',
        href: '/job',
        count: formatCount(clientMetrics.openJobs.value),
        trend: oj.text,
        up: oj.up,
        icon: Briefcase,
        color: 'text-purple-500',
        bg: 'bg-purple-500/10',
      });
    } else if (showJobs && jobs.length) {
      const open = jobs.filter((j) => (j.status || '').toUpperCase() === 'OPEN').length;
      cards.push({
        title: 'Jobs',
        href: '/job',
        count: formatCount(jobs.length),
        trend: `${formatCount(open)} open`,
        up: true,
        icon: Briefcase,
        color: 'text-purple-500',
        bg: 'bg-purple-500/10',
        trendIsText: true,
      });
    }

    if (showCandidates && clientMetrics) {
      const cp = formatTrendPct(clientMetrics.candidatesInProgress.trend, clientMetrics.candidatesInProgress.trendUp);
      cards.push({
        title: 'Active candidates',
        href: '/candidate',
        count: formatCount(clientMetrics.candidatesInProgress.value),
        trend: cp.text,
        up: cp.up,
        icon: UserRound,
        color: 'text-emerald-500',
        bg: 'bg-emerald-500/10',
      });
    } else if (showCandidates && candidateStats && candidateStats.all > 0) {
      cards.push({
        title: 'Candidates',
        href: '/candidate',
        count: formatCount(candidateStats.all),
        trend: 'Tracked',
        up: true,
        icon: UserRound,
        color: 'text-emerald-500',
        bg: 'bg-emerald-500/10',
        trendIsText: true,
      });
    }

    if (showInterviews && (interviewKpis?.todayCount != null || todayInterviews.length > 0)) {
      cards.push({
        title: 'Interviews today',
        href: '/interviews',
        count: formatCount(interviewKpis?.todayCount ?? todayInterviews.length),
        trend: interviewKpis?.upcomingCount != null ? `${interviewKpis.upcomingCount} upcoming` : '—',
        up: true,
        icon: Calendar,
        color: 'text-orange-500',
        bg: 'bg-orange-500/10',
        trendIsText: true,
      });
    }

    if (showPlacements && placementStats) {
      const pm = clientMetrics
        ? formatTrendPct(clientMetrics.placementsThisMonth.trend, clientMetrics.placementsThisMonth.trendUp)
        : { text: '—', up: true };
      cards.push({
        title: 'Placements joined',
        href: '/placements',
        count: formatCount(placementStats.joined ?? 0),
        trend: clientMetrics ? pm.text : '—',
        up: clientMetrics ? pm.up : true,
        icon: Award,
        color: 'text-pink-500',
        bg: 'bg-pink-500/10',
        trendIsText: !clientMetrics,
      });
    }

    if (showTasks && taskStats) {
      const taskLoad =
        (taskStats.dueToday || 0) + (taskStats.overdueCount || 0) + (taskStats.upcoming7d || 0);
      cards.push({
        title: 'Tasks (you)',
        href: '/Task&Activites',
        count: formatCount(taskLoad),
        trend: taskStats.overdueCount ? `${taskStats.overdueCount} overdue` : '—',
        up: true,
        icon: ClipboardList,
        color: 'text-indigo-500',
        bg: 'bg-indigo-500/10',
        trendIsText: true,
      });
    }

    return cards;
  }, [
    candidateStats,
    clientMetrics,
    clientsSample.length,
    interviewKpis,
    jobs,
    leadsSample.length,
    placementStats,
    showCandidates,
    showClients,
    showInterviews,
    showJobs,
    showLeads,
    showPlacements,
    showTasks,
    taskStats,
    todayInterviews.length,
  ]);

  const pipelineStages = useMemo(() => {
    const s = candidateStats;
    if (!s || !showCandidates || s.all <= 0) return [];
    const defs = [
      { id: 'all', label: 'All', count: s.all },
      { id: 'applied', label: 'Applied', count: s.applied },
      { id: 'longlist', label: 'Longlist', count: s.longlist },
      { id: 'shortlist', label: 'Shortlist', count: s.shortlist },
      { id: 'screening', label: 'Screening', count: s.screening },
      { id: 'submitted', label: 'Submitted', count: s.submitted },
      { id: 'interviewing', label: 'Interviewing', count: s.interviewing },
      { id: 'offered', label: 'Offered', count: s.offered },
      { id: 'hired', label: 'Hired', count: s.hired },
      { id: 'rejected', label: 'Rejected', count: s.rejected },
    ];
    return defs.map((d, i) => ({
      ...d,
      color: PIPELINE_STYLES[i % PIPELINE_STYLES.length],
    }));
  }, [candidateStats, showCandidates]);

  const jobsByClientData = useMemo(() => buildJobsByClient(jobs), [jobs]);
  const jobPie = useMemo(() => buildJobStatusPie(jobs), [jobs]);
  const leadPie = useMemo(() => buildLeadsStatusPie(leadsSample), [leadsSample]);
  const clientPie = useMemo(() => buildClientStatusPie(clientsSample), [clientsSample]);
  const candidatePie = useMemo(() => {
    if (!candidateStats || candidateStats.all <= 0) {
      return { data: [{ name: 'No data', value: 0, color: '#e2e8f0' }], total: 0 };
    }
    return buildCandidatePipelinePie(candidateStats);
  }, [candidateStats]);

  const mainPie = useMemo(() => {
    if (showJobs && jobs.length > 0) {
      return {
        title: 'Job status',
        href: '/job' as const,
        centerLabel: 'Jobs',
        pie: jobPie.data,
        total: jobPie.total,
        foot: `Open: ${jobPie.open} · ${jobs.length} loaded`,
      };
    }
    if (showLeads && leadsSample.length > 0) {
      return {
        title: 'Leads by status',
        href: '/leads' as const,
        centerLabel: 'Leads',
        pie: leadPie.data,
        total: leadPie.total,
        foot: `Based on ${leadsSample.length} lead record(s)`,
      };
    }
    if (showClients && clientsSample.length > 0) {
      return {
        title: 'Clients by status',
        href: '/client' as const,
        centerLabel: 'Clients',
        pie: clientPie.data,
        total: clientPie.total,
        foot: `Based on ${clientsSample.length} client record(s)`,
      };
    }
    if (showCandidates && candidateStats && candidateStats.all > 0) {
      return {
        title: 'Candidate stages',
        href: '/candidate' as const,
        centerLabel: 'Candidates',
        pie: candidatePie.data,
        total: candidatePie.total,
        foot: `Total ${formatCount(candidateStats.all)} in scope`,
      };
    }
    return null;
  }, [
    candidatePie,
    candidateStats,
    clientPie,
    clientsSample.length,
    jobPie,
    jobs,
    leadPie,
    leadsSample.length,
    showCandidates,
    showClients,
    showJobs,
    showLeads,
  ]);

  const aging = useMemo(() => avgOpenJobAgingDays(jobs), [jobs]);
  const revenueTrend = useMemo(() => buildRevenueTrendFromPlacements(placementsSample), [placementsSample]);
  const revenueMain = clientMetrics?.revenueGenerated?.formatted ?? formatMoney(placementStats?.revenueGenerated ?? 0);
  const pendingApprox = placementStats?.joiningPending
    ? `${placementStats.joiningPending} in pipeline`
    : '—';

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
    if (showJobs && jobMetrics && jobMetrics.nearSla > 0) {
      list.push({
        title: 'Jobs near SLA',
        desc: `${jobMetrics.nearSla} open job(s) flagged with SLA risk.`,
        href: '/job',
        icon: AlertCircle,
        color: 'text-amber-700 bg-amber-50',
        border: 'border-amber-100',
      });
    }
    if (showTasks && taskStats && taskStats.overdueCount > 0) {
      list.push({
        title: 'Overdue tasks',
        desc: `You have ${taskStats.overdueCount} overdue task(s).`,
        href: '/Task&Activites',
        icon: Clock,
        color: 'text-orange-600 bg-orange-50',
        border: 'border-orange-100',
      });
    }
    if (showPlacements && placementStats && placementStats.joiningPending > 0) {
      list.push({
        title: 'Joining pending',
        desc: `${placementStats.joiningPending} placement(s) in offer / joining pipeline.`,
        href: '/placements',
        icon: AlertCircle,
        color: 'text-pink-600 bg-pink-50',
        border: 'border-pink-100',
      });
    }
    if (showJobs && jobMetrics && jobMetrics.noCandidates > 0) {
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
  }, [jobMetrics, placementStats, showJobs, showPlacements, showTasks, taskStats]);

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

  const activityPreview = useMemo(() => activities.slice(0, 6), [activities]);

  if (loading) {
    return <PageSkeleton kpiCount={6} />;
  }

  return (
    <div className="space-y-8 p-8 duration-500 animate-in fade-in">
      <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
        <div className="space-y-1">
          <h2 className="text-2xl font-black tracking-tight text-slate-900">Dashboard</h2>
        </div>
        <button
          type="button"
          onClick={() => void load(false)}
          className="self-start rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-600 shadow-sm hover:bg-slate-50"
        >
          Refresh
        </button>
      </div>

      <div
        className="grid gap-4"
        style={{
          // Auto-fit cards to available width so a sales user with 2 cards still
          // gets full-width tiles (no awkward gap on the right). Each card has
          // a comfortable min width and grows to fill the row.
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        }}
      >
        {kpiCards.map((kpi, i) => {
          // Gradient palette inspired by modern sales dashboards (purple → teal
          // → blue) — rotates across cards so we never get a wall of one tone.
          const gradients = [
            'from-violet-600 via-fuchsia-500 to-pink-500',
            'from-sky-500 via-blue-600 to-indigo-700',
            'from-emerald-500 via-teal-500 to-cyan-600',
            'from-orange-500 via-amber-500 to-yellow-500',
            'from-rose-500 via-pink-500 to-fuchsia-600',
            'from-indigo-500 via-purple-600 to-violet-700',
          ];
          const grad = gradients[i % gradients.length];
          return (
            <Link
              key={`${kpi.title}-${i}`}
              href={kpi.href}
              aria-label={`${kpi.title}: ${kpi.count}. Go to related page.`}
              className={`group relative block overflow-hidden rounded-2xl bg-gradient-to-br ${grad} p-5 text-white shadow-md outline-none ring-offset-2 transition-all hover:-translate-y-0.5 hover:shadow-xl focus-visible:ring-2 focus-visible:ring-white/60`}
            >
              <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
              <div className="pointer-events-none absolute -bottom-12 -left-8 h-32 w-32 rounded-full bg-black/10 blur-2xl" />
              <div className="relative mb-3 flex items-start justify-between">
                <div className="rounded-xl bg-white/15 p-2 backdrop-blur-sm ring-1 ring-white/20">
                  <kpi.icon size={20} className="text-white" />
                </div>
                <div
                  className={`flex items-center gap-0.5 rounded-lg px-2 py-0.5 text-[10px] font-black backdrop-blur-sm ${
                    kpi.trendIsText
                      ? 'bg-white/15 text-white/90 ring-1 ring-white/20'
                      : kpi.up
                        ? 'bg-emerald-300/25 text-emerald-50 ring-1 ring-emerald-200/40'
                        : 'bg-rose-300/25 text-rose-50 ring-1 ring-rose-200/40'
                  }`}
                >
                  {!kpi.trendIsText ? (kpi.up ? <TrendingUp size={10} /> : <TrendingDown size={10} />) : null}{' '}
                  {kpi.trend}
                </div>
              </div>
              <div className="relative">
                <p className="text-[10px] font-bold uppercase tracking-widest text-white/75">{kpi.title}</p>
                <p className="mt-1 text-2xl font-black tracking-tight">{kpi.count}</p>
              </div>
            </Link>
          );
        })}
      </div>

      {pipelineStages.length > 0 ? (
        <div className="ph2-card block overflow-hidden outline-none ring-offset-2 focus-visible:ring-2 focus-visible:ring-blue-500">
          <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
            <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500">Candidate pipeline</h3>
            <Link href="/candidate" className="text-[10px] font-bold text-slate-400 hover:text-blue-600">
              Open candidates
            </Link>
          </div>
          <div className="p-5 sm:p-6">
            <div className="grid w-full grid-flow-col auto-cols-fr gap-2">
              {pipelineStages.map((stage) => (
                <Link
                  key={stage.id}
                  href={`/candidate${stage.id === 'all' ? '' : `?stage=${stage.id}`}`}
                  className={`flex min-w-0 flex-col items-center rounded-xl border px-2 py-2.5 text-center transition-all hover:shadow-md ${stage.color}`}
                  aria-label={`Open candidate page for ${stage.label}`}
                >
                  <span
                    className="mb-1 w-full truncate text-[9px] font-black uppercase leading-tight tracking-widest opacity-70"
                    title={stage.label}
                  >
                    {stage.label}
                  </span>
                  <span className="text-[15px] font-black leading-none sm:text-base">{formatCount(stage.count)}</span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      <div
        className="grid gap-6"
        style={{
          // Auto-fit so when jobs-by-client chart is hidden the main pie chart
          // grows to use the full width — no awkward empty 7-column slot.
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        }}
      >
        {showJobs && jobsByClientData.length > 0 ? (
          <Link
            href="/job"
            aria-label="Open jobs list"
            className="ph2-card block p-6 outline-none ring-offset-2 focus-visible:ring-2 focus-visible:ring-blue-500"
            style={{ gridColumn: 'span 2' }}
          >
            <h3 className="mb-6 text-xs font-bold uppercase tracking-widest text-slate-500">Open jobs by client</h3>
            <div className="h-[300px] w-full">
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
            </div>
          </Link>
        ) : null}

        {mainPie ? (
          <Link
            href={mainPie.href}
            aria-label={mainPie.title}
            className="ph2-card block p-6 outline-none ring-offset-2 focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500">{mainPie.title}</h3>
              {showJobs && jobs.length > 0 && mainPie.href === '/job' ? (
                <div className="text-right">
                  <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Avg. open job aging</p>
                  <p className="text-lg font-black text-slate-900">{aging != null ? `${aging} days` : '—'}</p>
                </div>
              ) : null}
            </div>
            {/* Top-Categories style: a full pie with white percentage labels on
                each significant slice (≥6%) and a clean side legend showing
                colored squares + names. Same data, friendlier to read. */}
            <div className="grid grid-cols-1 items-center gap-4 sm:grid-cols-[minmax(240px,1fr)_minmax(0,1fr)]">
              <div className="relative flex h-[260px] w-full items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={mainPie.pie}
                      cx="50%"
                      cy="50%"
                      outerRadius={108}
                      dataKey="value"
                      stroke="#fff"
                      strokeWidth={2}
                      labelLine={false}
                      label={({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) => {
                        // Hide labels for tiny slivers — they overlap and read as noise.
                        if (!percent || percent < 0.06) return null;
                        const RAD = Math.PI / 180;
                        const r = innerRadius + (outerRadius - innerRadius) * 0.6;
                        const x = cx + r * Math.cos(-midAngle * RAD);
                        const y = cy + r * Math.sin(-midAngle * RAD);
                        return (
                          <text
                            x={x}
                            y={y}
                            fill="#ffffff"
                            textAnchor="middle"
                            dominantBaseline="central"
                            style={{
                              fontSize: 12,
                              fontWeight: 800,
                              textShadow: '0 1px 2px rgba(0,0,0,0.35)',
                            }}
                          >
                            {`${Math.round(percent * 100)}%`}
                          </text>
                        );
                      }}
                    >
                      {mainPie.pie.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <RechartsTooltip
                      formatter={(value: any, name: any) => {
                        const total = Math.max(1, mainPie.total);
                        const pct = Math.round((Number(value) / total) * 100);
                        return [`${value} (${pct}%)`, name];
                      }}
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ul className="space-y-1.5">
                {mainPie.pie.map((item, i) => {
                  const pct = mainPie.total > 0 ? Math.round((item.value / mainPie.total) * 100) : 0;
                  return (
                    <li key={i} className="flex items-center justify-between gap-3 rounded-md px-1.5 py-1 hover:bg-slate-50">
                      <span className="flex min-w-0 items-center gap-2.5">
                        <span className="h-3.5 w-3.5 shrink-0 rounded-sm" style={{ backgroundColor: item.color }} />
                        <span className="truncate text-[13px] font-semibold text-slate-700">{item.name}</span>
                      </span>
                      <span className="flex shrink-0 items-baseline gap-2">
                        <span className="text-[11px] font-bold text-slate-500">{item.value}</span>
                        <span className="text-[12px] font-black text-slate-900 tabular-nums">{pct}%</span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
            <p className="mt-3 flex items-center justify-between text-[10px] text-slate-400">
              <span>{mainPie.foot}</span>
              <span className="font-semibold uppercase tracking-widest text-slate-500">Total · {formatCount(mainPie.total)}</span>
            </p>
          </Link>
        ) : null}
      </div>

      {(showTasks || showTeam) && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {showTasks ? (
            <Link
              href="/Task&Activites"
              aria-label="Open tasks and activities"
              className="ph2-card block overflow-hidden outline-none ring-offset-2 focus-visible:ring-2 focus-visible:ring-blue-500"
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
          ) : (
            <div />
          )}

          {showTeam ? (
            <Link
              href="/team"
              aria-label="Open team page"
              className="ph2-card block overflow-hidden outline-none ring-offset-2 focus-visible:ring-2 focus-visible:ring-blue-500"
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
          ) : null}
        </div>
      )}

      {showInterviews ? (
        <Link
          href="/interviews"
          aria-label="Open interviews page"
          className="ph2-card block overflow-hidden outline-none ring-offset-2 focus-visible:ring-2 focus-visible:ring-blue-500"
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
      ) : null}

      <div
        className="grid gap-6 pb-8"
        style={{
          // Auto-fit so when billing/activity are hidden the remaining cards
          // expand to fill the available width instead of leaving an empty slot.
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        }}
      >
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

        {showActivity ? (
          <div className="ph2-card block p-6 outline-none ring-offset-2 focus-visible:ring-2 focus-visible:ring-blue-500">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500">Recent activity</h3>
              {showReports ? (
                <Link href="/reports" className="text-[10px] font-bold text-blue-600 hover:underline">
                  Reports
                </Link>
              ) : null}
            </div>
            <div className="max-h-72 overflow-y-auto pr-1">
              <div className="relative space-y-5 before:absolute before:bottom-2 before:left-[9px] before:top-2 before:w-px before:bg-slate-100">
                {activityPreview.length === 0 ? (
                  <p className="text-sm text-slate-400">No recent activities.</p>
                ) : (
                  activityPreview.map((item) => (
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
            </div>
          </div>
        ) : null}

        {showBillingCard ? (
          <Link
            href="/billing"
            aria-label="Open billing"
            className="ph2-card block p-6 outline-none ring-offset-2 focus-visible:ring-2 focus-visible:ring-blue-500"
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
        ) : null}
      </div>
    </div>
  );
}
