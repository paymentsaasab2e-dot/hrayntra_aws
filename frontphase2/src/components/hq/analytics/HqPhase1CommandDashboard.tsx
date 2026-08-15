'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  ArrowRight,
  Award,
  Calendar,
  CheckCircle2,
  ClipboardList,
  Clock3,
  ExternalLink,
  Globe2,
  LogIn,
  MapPin,
  MonitorSmartphone,
  MousePointerClick,
  Radio,
  RefreshCcw,
  Search,
  Ticket,
  Trophy,
  Upload,
  UserPlus,
  Users,
  X,
  Zap,
} from 'lucide-react';
import Link from 'next/link';
import type { HqEmployeeAnalytics } from '@/lib/api';
import { HqModulePageLayout } from '@/components/hq/HqModulePageLayout';
import { HQ_SVG_ASSETS, HqSvgKpiCard } from './HqSvgKpiCard';
import { HqInfoTip } from './HqPhase2DashboardParts';
import { HqDashCategoryTabs } from './HqDashCategoryTabs';

const HQ_DASH_BTN_PRIMARY =
  'inline-flex h-10 items-center justify-center gap-2 rounded-full bg-gradient-to-r from-slate-900 via-slate-800 to-blue-900 px-5 text-sm font-semibold text-white shadow-[0_10px_24px_-10px_rgba(15,23,42,0.55)] transition hover:brightness-110 disabled:opacity-50';
const HQ_DASH_BTN_SECONDARY =
  'inline-flex h-10 items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-800 shadow-[0_8px_20px_-12px_rgba(15,23,42,0.35)] transition hover:border-slate-300 hover:bg-slate-50 disabled:opacity-50';

const INDIGO = '#6366F1';
const PURPLE = '#8B5CF6';
const TEAL = '#14B8A6';
const ORANGE = '#F97316';
const GREEN = '#22C55E';
const BLUE = '#3B82F6';
const GOLD = '#EAB308';
const SOURCE_COLORS = ['#6366F1', '#8B5CF6', '#14B8A6', '#F97316', '#3B82F6', '#64748B'];
const INTERVIEW_COLORS = ['#F59E0B', '#6366F1', '#22C55E', '#94A3B8', '#EF4444'];
/** Distinct hues — avoid adjacent indigo/violet twins that read as the same shade */
const FUNNEL_COLORS = ['#3B82F6', '#14B8A6', '#EF4444', '#F97316', '#FBBF24', '#22C55E'];
const CATEGORY_COLORS = ['#6366F1', '#8B5CF6', '#14B8A6', '#F97316', '#94A3B8'];

/** Behaviour flags that matter for CRM follow-up / sales. */
const CRM_IMPORTANT_SIGNAL_RE =
  /sales[_\s-]?follow[_\s-]?up|high[_\s-]?intent|premium|did not purchase|no[_\s-]?purchase|company research|keyword|ats gap|shallow premium/i;

const TIMELINE_OPTIONS = [
  { id: '1h', label: '1 hour', days: 0, hours: 1 },
  { id: '1d', label: 'Day', days: 1, hours: 0 },
  { id: '7d', label: 'Week', days: 7, hours: 0 },
  { id: '30d', label: 'Month', days: 30, hours: 0 },
  { id: '90d', label: '3 months', days: 90, hours: 0 },
  { id: '365d', label: 'Year', days: 365, hours: 0 },
] as const;

type TimelineId = (typeof TIMELINE_OPTIONS)[number]['id'];

function timelineCutoffMs(id: TimelineId, now = Date.now()) {
  const opt = TIMELINE_OPTIONS.find((t) => t.id === id) || TIMELINE_OPTIONS[2];
  const ms = (opt.days || 0) * 86400000 + (opt.hours || 0) * 3600000;
  return now - Math.max(ms, 60 * 60 * 1000);
}

function sliceDailySeries(
  rows: Array<{ name: string; value: number }>,
  timeline: TimelineId,
) {
  if (!rows.length) return rows;
  if (timeline === '1h' || timeline === '1d') return rows.slice(-1);
  if (timeline === '7d') return rows.slice(-7);
  if (timeline === '30d') return rows.slice(-30);
  if (timeline === '90d') return rows.slice(-90);
  return rows;
}

function isImportantCrmSignal(name: string) {
  return CRM_IMPORTANT_SIGNAL_RE.test(String(name || ''));
}

function signalDisplayName(name: string) {
  return String(name || '').replace(/_/g, ' ');
}

type Props = {
  data: HqEmployeeAnalytics | null;
  generatedAt?: string | null;
  durationMs?: number | null;
  loading?: boolean;
  onRefresh?: () => void;
};

function fmt(n: number | null | undefined) {
  if (n == null || Number.isNaN(Number(n))) return '—';
  return Number(n).toLocaleString();
}

function num(n: number | null | undefined) {
  return Number(n) || 0;
}

function growthPct(recent: number, baseline: number) {
  if (!baseline && !recent) return null;
  if (!baseline) return recent > 0 ? 100 : null;
  return Math.round(((recent - baseline) / baseline) * 1000) / 10;
}

function sumLast(rows: { value: number }[], n: number) {
  return rows.slice(-n).reduce((s, d) => s + (Number(d.value) || 0), 0);
}

function sumPrior(rows: { value: number }[], n: number) {
  if (rows.length < n * 2) return sumLast(rows.slice(0, -n), n);
  return rows.slice(-(n * 2), -n).reduce((s, d) => s + (Number(d.value) || 0), 0);
}

function mapPoints(rows?: Array<{ name: string; value: number }> | null) {
  if (!rows?.length) return [] as { name: string; value: number }[];
  return rows.map((d) => ({ name: String(d.name), value: Number(d.value) || 0 }));
}

function withPct(rows: { name: string; value: number }[]) {
  const total = rows.reduce((s, d) => s + d.value, 0) || 1;
  return rows.map((d) => ({
    ...d,
    pct: Math.round((d.value / total) * 1000) / 10,
  }));
}

function seriesToSpark(rows: { value: number }[]) {
  if (!rows.length) return [{ i: 0, v: 0 }];
  return rows.slice(-10).map((d, i) => ({ i, v: Number(d.value) || 0 }));
}

function formatDurationMs(ms: number | null | undefined) {
  if (ms == null || !Number.isFinite(Number(ms)) || Number(ms) < 0) return '—';
  const totalSec = Math.floor(Number(ms) / 1000);
  if (totalSec < 60) return `${totalSec}s`;
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  if (mins < 60) return `${mins}m ${String(secs).padStart(2, '0')}s`;
  const hours = Math.floor(mins / 60);
  const rem = mins % 60;
  return `${hours}h ${String(rem).padStart(2, '0')}m`;
}

/** Tick every second so open-session durations advance without reload. */
function useLiveNowMs(enabled = true, intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!enabled) return;
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [enabled, intervalMs]);
  return now;
}

function liveSessionDurationMs(
  row: {
    loginAt?: string | null;
    logoutAt?: string | null;
    durationMs?: number;
    status?: string;
    isActive?: boolean;
  },
  nowMs: number,
) {
  const open = row.status === 'online' || (Boolean(row.isActive) && !row.logoutAt);
  if (open && row.loginAt) {
    const loginMs = new Date(row.loginAt).getTime();
    if (Number.isFinite(loginMs) && loginMs <= nowMs) {
      return Math.max(0, nowMs - loginMs);
    }
  }
  return typeof row.durationMs === 'number' && row.durationMs > 0 ? row.durationMs : null;
}

function formatClock(isoStr: string | null | undefined) {
  if (!isoStr) return '—';
  const d = new Date(isoStr);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString(undefined, {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function EmptyChart({ label = 'No live data yet' }: { label?: string }) {
  return (
    <div className="flex h-full min-h-[120px] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-200/80 bg-slate-50/40 px-4 text-center">
      <span className="h-8 w-8 rounded-full bg-slate-100 ring-1 ring-slate-200/80" />
      <p className="text-xs font-medium text-slate-400">{label}</p>
    </div>
  );
}

function MiniSpark({
  data,
  color,
  height = 28,
}: {
  data: { i: number; v: number }[];
  color: string;
  height?: number;
}) {
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={`ms-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.35} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="v"
            stroke={color}
            fill={`url(#ms-${color.replace('#', '')})`}
            strokeWidth={1.6}
            dot={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function Card({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      whileHover={{ y: -2 }}
      transition={{ duration: 0.18, ease: 'easeOut' }}
      className={`hq-dash-card relative overflow-visible rounded-2xl border border-white/80 bg-white/75 p-5 shadow-[0_1px_0_rgba(255,255,255,0.85)_inset,0_18px_48px_-24px_rgba(15,23,42,0.18)] backdrop-blur-xl ${className}`}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-indigo-300/60 to-transparent"
      />
      {children}
    </motion.div>
  );
}

function SectionTitle({
  title,
  info,
  right,
}: {
  title: string;
  info?: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="relative z-10 mb-4 flex items-center justify-between gap-3 overflow-visible">
      <div className="flex min-w-0 items-center gap-2.5">
        <span className="h-4 w-1 shrink-0 rounded-full bg-gradient-to-b from-slate-900 to-blue-900" />
        <h3 className="truncate text-[13px] font-semibold tracking-tight text-slate-800">{title}</h3>
        {info ? <HqInfoTip text={info} /> : null}
      </div>
      {right}
    </div>
  );
}

function rankUsageRows(
  rows: Array<{ name: string; value: number; hint?: string }>,
  limit = 8,
) {
  const sorted = [...rows]
    .filter((d) => d.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, limit);
  const max = Math.max(...sorted.map((d) => d.value), 1);
  return sorted.map((d, i) => ({
    ...d,
    rank: i + 1,
    pctOfTop: Math.round((d.value / max) * 1000) / 10,
  }));
}

function SkillUsageRows({
  rows,
}: {
  rows: Array<{ name: string; value: number }>;
}) {
  const max = Math.max(...rows.map((d) => d.value), 1);
  return (
    <div className="space-y-3">
      {rows.map((row) => (
        <div key={row.name} className="min-w-0">
          <div className="mb-1 flex items-start justify-between gap-2">
            <p className="min-w-0 text-[12px] font-medium leading-snug text-slate-700">{row.name}</p>
            <span className="shrink-0 tabular-nums text-[11px] font-semibold text-slate-800">
              {fmt(row.value)}
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-violet-500"
              style={{ width: `${Math.max(8, Math.round((row.value / max) * 100))}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function RankedUsageList({
  rows,
  emptyLabel,
  valueSuffix = '',
}: {
  rows: Array<{ name: string; value: number; rank: number; pctOfTop: number; hint?: string }>;
  emptyLabel: string;
  valueSuffix?: string;
}) {
  if (!rows.length) return <EmptyChart label={emptyLabel} />;
  return (
    <div className="space-y-2.5">
      {rows.map((row, i) => (
        <div key={`${row.name}-${i}`}>
          <div className="mb-1 flex items-center justify-between gap-2 text-[12px]">
            <span className="flex min-w-0 items-center gap-2 font-semibold text-slate-700">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-indigo-50 text-[10px] font-bold text-indigo-700">
                {String(row.rank).padStart(2, '0')}
              </span>
              <span className="min-w-0 truncate">
                {row.name}
                {row.hint ? (
                  <span className="ml-1.5 font-normal text-[10px] text-slate-400">{row.hint}</span>
                ) : null}
              </span>
            </span>
            <span className="shrink-0 tabular-nums text-slate-500">
              <strong className="text-slate-900">{fmt(row.value)}</strong>
              {valueSuffix ? <span className="text-[10px]"> {valueSuffix}</span> : null}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-100">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${Math.max(6, row.pctOfTop)}%` }}
              className="h-full rounded-full"
              style={{ background: FUNNEL_COLORS[i % FUNNEL_COLORS.length] }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function RangeToggle({
  options,
  value,
  onChange,
}: {
  options: readonly string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex rounded-full border border-slate-200/80 bg-slate-50/80 p-0.5 text-[10px] font-semibold shadow-inner">
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          onClick={() => onChange(opt)}
          className={`rounded-full px-2.5 py-1 transition ${
            value === opt
              ? 'bg-slate-900 text-white shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}

const tip = {
  borderRadius: 12,
  border: '1px solid rgba(99,102,241,0.14)',
  fontSize: 12,
  fontWeight: 500,
  background: 'rgba(255,255,255,0.96)',
  color: '#0f172a',
  boxShadow: '0 16px 40px -12px rgba(15,23,42,0.2)',
  padding: '8px 12px',
};

const axisTick = { fontSize: 11, fill: '#94A3B8', fontWeight: 500 as const };
const gridStroke = '#EEF2FF';

const EMPLOYEE_CATEGORY_TABS = [
  {
    id: 'growth',
    label: 'Growth & conversion',
    blurb: 'Signups over time, hiring funnel, applications trend, and candidate journey',
  },
  {
    id: 'supply',
    label: 'Supply & quality',
    blurb: 'Sources, skills, locations, AI quality, jobs mix, and conversion rates',
  },
  {
    id: 'engagement',
    label: 'Engagement & sessions',
    blurb: 'Login sessions, duration, devices, and geo locations',
  },
  {
    id: 'live',
    label: 'Live tracking',
    blurb:
      'Behaviour engine — premium usage, features, entry points, Office Gossip, interests, page mix & live feed',
  },
] as const;

export function HqPhase1CommandDashboard({
  data,
  generatedAt,
  loading,
  onRefresh,
}: Props) {
  const k = data?.kpis;
  const c = data?.charts;
  const t = data?.tables;
  const insights = data?.insights || [];
  const liveTracking = data?.liveTracking;
  const hasLiveTracker = Boolean(liveTracking?.available);
  const isLive = Boolean(data?.live ?? data?.available);
  const [appRange, setAppRange] = useState<'Daily' | 'Weekly' | 'Monthly'>('Monthly');
  const [candRange, setCandRange] = useState<'Daily' | 'Monthly'>('Monthly');
  const [category, setCategory] = useState<(typeof EMPLOYEE_CATEGORY_TABS)[number]['id']>('growth');
  const [timeline, setTimeline] = useState<TimelineId>('30d');
  const [feedSearch, setFeedSearch] = useState('');
  const [feedSuggestOpen, setFeedSuggestOpen] = useState(false);
  const [feedCategory, setFeedCategory] = useState('all');
  const [feedRegion, setFeedRegion] = useState('all');
  const [feedSort, setFeedSort] = useState<'latest' | 'oldest' | 'visits' | 'active'>('latest');
  const [skillsOpen, setSkillsOpen] = useState(false);
  const feedSearchWrapRef = useRef<HTMLDivElement>(null);

  const totalCandidates = num(k?.totalCandidates);
  const newCandidates = num(k?.new30d ?? k?.new7d);
  const activeJobs = num(k?.openJobs);
  const applications = num(k?.applications);
  const activeApplications = num(k?.activeApplications);
  const interviewReqs = num(k?.interviewRequests);
  const matchAvg = k?.avgMatchScore != null ? Math.round(Number(k.avgMatchScore)) : null;
  const profilePct = k?.profileCompleteness != null ? Math.round(Number(k.profileCompleteness)) : null;
  const totalResumes = num(k?.resumesUploaded);
  const aiMatches = num(k?.aiMatches);
  const selected = num(k?.selectedApplications);
  const placements = selected;
  const atsScore = k?.avgAtsScore != null ? Math.round(Number(k.avgAtsScore)) : null;
  const cvScore = k?.avgCvScore != null ? Math.round(Number(k.avgCvScore)) : null;
  const apps7d = num(k?.applications7d);
  const apps30d = num(k?.applications30d);
  const new7d = num(k?.new7d);
  const new1d = num(k?.new1d);
  const jobsToday = num(k?.jobsPostedToday);
  const jobsWeek = num(k?.jobsPosted7d);
  const jobsMonth = num(k?.jobsPosted30d);

  const candidatesMonthly = useMemo(() => mapPoints(c?.candidatesOverTime), [c]);
  const candidatesDailyRaw = useMemo(() => mapPoints(c?.candidatesDaily), [c]);
  const candidatesDaily = useMemo(
    () => sliceDailySeries(candidatesDailyRaw, timeline),
    [candidatesDailyRaw, timeline],
  );
  const candidatesOverTime = candRange === 'Daily' ? candidatesDaily : candidatesMonthly;

  const applicationsMonthly = useMemo(() => mapPoints(c?.applicationsOverTime), [c]);
  const applicationsDailyRaw = useMemo(() => mapPoints(c?.applicationsDaily), [c]);
  const applicationsDaily = useMemo(
    () => sliceDailySeries(applicationsDailyRaw, timeline),
    [applicationsDailyRaw, timeline],
  );
  const applicationsWeekly = useMemo(() => {
    if (!applicationsDaily.length) return [];
    const chunks: { name: string; value: number }[] = [];
    for (let i = 0; i < applicationsDaily.length; i += 7) {
      const slice = applicationsDaily.slice(i, i + 7);
      chunks.push({
        name: `W${chunks.length + 1}`,
        value: slice.reduce((s, d) => s + d.value, 0),
      });
    }
    return chunks;
  }, [applicationsDaily]);

  const applicationsOverTime = useMemo(() => {
    if (appRange === 'Daily') return applicationsDaily;
    if (appRange === 'Weekly') return applicationsWeekly.length ? applicationsWeekly : applicationsDaily;
    return applicationsMonthly;
  }, [appRange, applicationsDaily, applicationsWeekly, applicationsMonthly]);

  const loginsDaily = useMemo(
    () => sliceDailySeries(mapPoints(c?.loginsDaily), timeline),
    [c, timeline],
  );
  const candGrowth = growthPct(sumLast(candidatesDaily, 7), sumPrior(candidatesDaily, 7));
  const newGrowth = growthPct(new1d, Math.max(new7d - new1d, 0));
  const appGrowth = growthPct(sumLast(applicationsDaily, 7), sumPrior(applicationsDaily, 7));
  const interviewGrowth = growthPct(num(k?.interviewPending), Math.max(interviewReqs - num(k?.interviewPending), 0));

  const kpis = [
    {
      label: 'Total Candidates',
      value: totalCandidates,
      growth: candGrowth,
      iconSrc: HQ_SVG_ASSETS.totalCandidates.icon,
      sparkData: seriesToSpark(candidatesDaily.length ? candidatesDaily : candidatesMonthly),
      sparkColor: INDIGO,
      compareLabel: new7d ? `${new7d} new in 7d` : 'Portal',
      info: 'All candidates registered on the job portal.',
    },
    {
      label: 'New Candidates',
      value: newCandidates,
      growth: newGrowth,
      iconSrc: HQ_SVG_ASSETS.newCandidates.icon,
      sparkData: seriesToSpark(candidatesDaily),
      sparkColor: GREEN,
      compareLabel: `${new1d} today · ${new7d} in 7d`,
      info: 'New portal sign-ups in the selected window (today / 7d).',
    },
    {
      label: 'Applications',
      value: applications,
      growth: appGrowth,
      iconSrc: HQ_SVG_ASSETS.applications.icon,
      sparkData: seriesToSpark(applicationsDaily.length ? applicationsDaily : applicationsMonthly),
      sparkColor: PURPLE,
      compareLabel: `${apps7d} in 7d · ${activeApplications} active`,
      info: 'Job applications submitted through the portal.',
    },
    {
      label: 'Interview Requests',
      value: interviewReqs,
      growth: interviewGrowth,
      iconSrc: HQ_SVG_ASSETS.interviewRequests.icon,
      sparkData: seriesToSpark([
        { value: num(k?.interviewCompleted) },
        { value: num(k?.interviewPending) },
        { value: interviewReqs },
      ]),
      sparkColor: '#EC4899',
      compareLabel: `${num(k?.interviewPending)} open`,
      info: 'Interview requests raised from portal applications.',
    },
  ];

  const funnel = useMemo(() => {
    const byStatus = mapPoints(c?.applicationsByStatus);
    const shortlisted = byStatus.find((d) => /shortlist/i.test(d.name))?.value ?? 0;
    const interviewStage = byStatus.find((d) => /interview/i.test(d.name))?.value ?? 0;
    return [
      { name: 'Jobs Published', value: activeJobs },
      { name: 'Applications', value: applications },
      { name: 'AI Shortlisted', value: shortlisted || aiMatches },
      { name: 'Interview Requests', value: interviewReqs || interviewStage },
      { name: 'Selected', value: selected },
      { name: 'Joined', value: placements },
    ];
  }, [c, activeJobs, applications, aiMatches, interviewReqs, selected, placements]);

  const sources = useMemo(() => withPct(mapPoints(c?.candidatesBySource)), [c]);
  const skills = useMemo(() => mapPoints(c?.topSkills), [c]);
  const previewSkills = skills.slice(0, 4);
  const experience = useMemo(() => mapPoints(c?.experienceBands), [c]);
  const locations = useMemo(() => mapPoints(c?.topLocations).slice(0, 6), [c]);
  const interviewStatus = useMemo(() => withPct(mapPoints(c?.interviewRequestsByStatus)), [c]);
  const loginsByCountry = useMemo(() => withPct(mapPoints(c?.loginsByCountry).slice(0, 6)), [c]);
  const loginsByState = useMemo(() => mapPoints(c?.loginsByState).slice(0, 6), [c]);
  const loginsByCity = useMemo(() => mapPoints(c?.loginsByCity).slice(0, 6), [c]);
  const loginsByDevice = useMemo(() => withPct(mapPoints(c?.loginsByDevice)), [c]);
  const recentSessions = t?.recentSessions || [];
  const timelineCutoff = useMemo(() => timelineCutoffMs(timeline), [timeline]);
  const filteredSessions = useMemo(() => {
    return recentSessions.filter((row) => {
      const ms = row.loginAt ? new Date(row.loginAt).getTime() : NaN;
      return Number.isFinite(ms) && ms >= timelineCutoff;
    });
  }, [recentSessions, timelineCutoff]);
  const loginsToday = num(k?.loginsToday);
  const logins7d = num(k?.logins7d);
  const activeSessions = Math.max(
    num(k?.activeSessions),
    hasLiveTracker ? num(liveTracking?.onlineNow) : 0,
  );
  const hasOpenSessions = recentSessions.some(
    (r) => r.status === 'online' || (Boolean(r.isActive) && !r.logoutAt),
  );
  const nowMs = useLiveNowMs(
    category === 'engagement' || category === 'live' || hasOpenSessions,
  );
  const avgSessionMs = useMemo(() => {
    const open = filteredSessions.filter(
      (r) => r.status === 'online' || (Boolean(r.isActive) && !r.logoutAt),
    );
    if (open.length) {
      const sum = open.reduce((acc, row) => acc + (liveSessionDurationMs(row, nowMs) || 0), 0);
      return Math.round(sum / open.length);
    }
    return k?.avgSessionDurationMs ?? liveTracking?.avgActiveMsPerUser7d ?? null;
  }, [filteredSessions, nowMs, k?.avgSessionDurationMs, liveTracking?.avgActiveMsPerUser7d]);
  const liveVisits7d = num(k?.liveVisits7d ?? liveTracking?.totalVisits7d);
  const liveApplies7d = num(k?.liveApplies7d ?? liveTracking?.totalApplies7d);
  const liveJobClicks7d = num(k?.liveJobClicks7d ?? liveTracking?.totalJobClicks7d);
  const liveActiveMs7d = num(k?.liveActiveMs7d ?? liveTracking?.totalActiveMs7d);
  const liveTrackedUsers = num(k?.liveTrackedUsers ?? liveTracking?.trackedUsers);
  const livePageVisits = useMemo(
    () => mapPoints(liveTracking?.pageVisitsByCategory).slice(0, 6),
    [liveTracking],
  );
  const liveTriggers = useMemo(
    () => mapPoints(liveTracking?.topTriggers).slice(0, 8),
    [liveTracking],
  );
  const liveFeed = liveTracking?.liveFeed || [];

  const feedCategoryOptions = useMemo(() => {
    const set = new Set<string>();
    for (const row of liveFeed) {
      if (row.topFirstOpen) set.add(String(row.topFirstOpen));
      if (row.topInterest) set.add(`Interest · ${row.topInterest}`);
    }
    return ['all', ...[...set].sort()];
  }, [liveFeed]);

  const feedRegionOptions = useMemo(() => {
    const set = new Set<string>();
    for (const row of recentSessions) {
      if (row.country && row.country !== '—') set.add(String(row.country));
      if (row.state && row.state !== '—') set.add(String(row.state));
    }
    return ['all', ...[...set].sort()];
  }, [recentSessions]);

  const sessionUserRegion = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of recentSessions) {
      const id = String(row.candidateId || '');
      if (!id) continue;
      const region = [row.city, row.state, row.country].filter((p) => p && p !== '—').join(', ');
      if (region) map.set(id, region);
    }
    return map;
  }, [recentSessions]);

  const candidateNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of recentSessions) {
      const id = String(row.candidateId || '');
      if (!id) continue;
      if (row.candidate) map.set(id, String(row.candidate));
    }
    return map;
  }, [recentSessions]);

  const liveScopeActive = Boolean(
    feedSearch.trim() || feedCategory !== 'all' || feedRegion !== 'all',
  );

  const liveSearchSuggestions = useMemo(() => {
    const q = feedSearch.trim().toLowerCase();
    if (!q) return [] as Array<{ id: string; label: string; sub?: string; apply: string }>;
    const seen = new Set<string>();
    const out: Array<{ id: string; label: string; sub?: string; apply: string }> = [];
    const push = (id: string, label: string, sub: string | undefined, apply: string) => {
      const key = `${label}|${apply}`.toLowerCase();
      if (seen.has(key)) return;
      const hay = `${label} ${sub || ''} ${apply}`.toLowerCase();
      if (!hay.includes(q)) return;
      seen.add(key);
      out.push({ id, label, sub, apply });
    };
    for (const row of liveFeed) {
      const uid = String(row.userId || '');
      const name = candidateNameById.get(uid);
      const region = sessionUserRegion.get(uid);
      if (name) push(`name-${uid}`, name, region || uid, name);
      if (uid) push(`user-${uid}`, uid, name || row.topInterest || 'User id', uid);
      if (row.topInterest) {
        push(`int-${row.topInterest}`, String(row.topInterest), 'Interest', String(row.topInterest));
      }
      if (row.topFirstOpen) {
        push(
          `land-${row.topFirstOpen}`,
          String(row.topFirstOpen),
          'Landing',
          String(row.topFirstOpen),
        );
      }
      if (row.topTrigger) {
        push(`trig-${row.topTrigger}`, String(row.topTrigger), 'Signal', String(row.topTrigger));
      }
    }
    for (const [id, name] of candidateNameById) {
      push(`sess-${id}`, name, id, name);
    }
    return out.slice(0, 10);
  }, [feedSearch, liveFeed, candidateNameById, sessionUserRegion]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!feedSearchWrapRef.current?.contains(e.target as Node)) {
        setFeedSuggestOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const filteredLiveFeed = useMemo(() => {
    const q = feedSearch.trim().toLowerCase();
    let rows = liveFeed.filter((row) => {
      const at = row.activityStateUpdatedAt || row.capturedAt;
      const ms = at ? new Date(at).getTime() : NaN;
      const hasHistory =
        (Number(row.visits7d) || 0) +
          (Number(row.applies7d) || 0) +
          (Number(row.jobCardClicks7d) || 0) +
          (Number(row.activeMs7d) || 0) >
        0;
      // Keep users with older tracker totals even if they were not active in this window.
      if (Number.isFinite(ms) && ms < timelineCutoff && !hasHistory) return false;

      if (feedCategory !== 'all') {
        const landing = String(row.topFirstOpen || '');
        const interest = row.topInterest ? `Interest · ${row.topInterest}` : '';
        if (landing !== feedCategory && interest !== feedCategory) return false;
      }

      if (feedRegion !== 'all') {
        const region = sessionUserRegion.get(String(row.userId)) || '';
        if (!region.toLowerCase().includes(feedRegion.toLowerCase())) return false;
      }

      if (q) {
        const name = candidateNameById.get(String(row.userId)) || '';
        const hay = [
          row.userId,
          name,
          row.topTrigger,
          row.topInterest,
          row.topFirstOpen,
          sessionUserRegion.get(String(row.userId)),
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    rows = [...rows].sort((a, b) => {
      if (feedSort === 'visits') return (b.visits7d || 0) - (a.visits7d || 0);
      if (feedSort === 'active') return (b.activeMs7d || 0) - (a.activeMs7d || 0);
      const am = new Date(a.activityStateUpdatedAt || a.capturedAt || 0).getTime();
      const bm = new Date(b.activityStateUpdatedAt || b.capturedAt || 0).getTime();
      return feedSort === 'oldest' ? am - bm : bm - am;
    });
    return rows;
  }, [
    liveFeed,
    timelineCutoff,
    feedCategory,
    feedRegion,
    feedSearch,
    feedSort,
    sessionUserRegion,
    candidateNameById,
  ]);

  /** When searching/filtering a candidate, pulse stats follow the matched users. */
  const scopedLivePulse = useMemo(() => {
    if (!liveScopeActive) return null;
    const rows = filteredLiveFeed;
    return {
      trackedUsers: rows.length,
      onlineNow: rows.filter((r) => {
        const at = r.activityStateUpdatedAt || r.capturedAt;
        const ms = at ? new Date(at).getTime() : NaN;
        return Number.isFinite(ms) && Date.now() - ms <= 2 * 60 * 1000;
      }).length,
      visits: rows.reduce((s, r) => s + (Number(r.visits7d) || 0), 0),
      jobClicks: rows.reduce((s, r) => s + (Number(r.jobCardClicks7d) || 0), 0),
      applies: rows.reduce((s, r) => s + (Number(r.applies7d) || 0), 0),
      activeMs: rows.reduce((s, r) => s + (Number(r.activeMs7d) || 0), 0),
    };
  }, [liveScopeActive, filteredLiveFeed]);

  const displayTrackedUsers = scopedLivePulse
    ? scopedLivePulse.trackedUsers
    : liveTrackedUsers || liveFeed.length;
  const displayOnline = scopedLivePulse ? scopedLivePulse.onlineNow : activeSessions;
  const displayVisits = scopedLivePulse
    ? scopedLivePulse.visits || liveVisits7d
    : liveVisits7d || num(k?.logins7d) || num(k?.logins30d);
  const displayJobClicks = scopedLivePulse
    ? scopedLivePulse.jobClicks || liveJobClicks7d
    : liveJobClicks7d || num(k?.aiMatches) || num(k?.savedJobs);
  const displayApplies = scopedLivePulse
    ? scopedLivePulse.applies || liveApplies7d
    : liveApplies7d || num(k?.applications7d) || num(k?.applications30d) || num(k?.applications);
  const displayActiveMs = scopedLivePulse
    ? scopedLivePulse.activeMs || liveActiveMs7d
    : liveActiveMs7d;

  const timelineLabel =
    TIMELINE_OPTIONS.find((t) => t.id === timeline)?.label || 'Week';

  const clearLiveFilters = () => {
    setFeedSearch('');
    setFeedCategory('all');
    setFeedRegion('all');
    setFeedSort('latest');
    setFeedSuggestOpen(false);
  };

  /** Most → least used portal features (paid / free) — never HQ insight alerts. */
  const featureUsageRanked = useMemo(() => {
    const isInsightNoise = (name: string) =>
      /visited services but did not purchase|did not purchase|without applying|hesitat|incomplete profile|short visits on premium|hq[_ ]/i.test(
        name,
      );

    const fromPopular = mapPoints(liveTracking?.popularFeatures)
      .filter((d) => !isInsightNoise(String(d.name)))
      .map((d) => ({
      name: String(d.name),
      value: d.value,
    }));
    const fromPages = mapPoints(liveTracking?.pageVisitsByCategory)
      .filter((d) => !/other portal|^\s*other\s*$/i.test(String(d.name)))
      .map((d) => ({
      name: String(d.name),
      value: d.value,
    }));

    let rows = fromPopular.length ? fromPopular : fromPages;
    if (!rows.length) {
      rows = [
        { name: 'Free · AI job matching', value: aiMatches },
        { name: 'Free · My applications', value: applications },
        { name: 'Free · Explore jobs clicks', value: liveJobClicks7d },
        { name: 'Paid · AI CV analyses', value: num(k?.cvAnalyses) },
        { name: 'Free / paid · LMS enrollments', value: num(k?.lmsEnrollments) },
        { name: 'Free · Saved jobs', value: num(k?.savedJobs) },
        { name: 'Free · Interview requests', value: interviewReqs },
        { name: 'Free · Resumes uploaded', value: totalResumes },
      ];
    }
    return rankUsageRows(rows.filter((r) => r.value > 0 && !isInsightNoise(r.name)));
  }, [
    liveTracking,
    applications,
    liveJobClicks7d,
    aiMatches,
    k,
    interviewReqs,
    totalResumes,
  ]);

  const premiumServicesRanked = useMemo(() => {
    const rows = (liveTracking?.premiumServicesUsage || []).map((d) => ({
      name: String(d.name),
      value: d.value,
      hint:
        (d as { tokens?: number }).tokens != null && Number((d as { tokens?: number }).tokens) > 0
          ? `${fmt(Number((d as { tokens?: number }).tokens))} tokens`
          : undefined,
    }));
    if (rows.length) return rankUsageRows(rows);
    const fallback = mapPoints(liveTracking?.pageVisitsByCategory)
      .filter((d) =>
        /premium|course|interview|ai cv|lms|event/i.test(String(d.name)),
      )
      .map((d) => ({ name: String(d.name), value: d.value }));
    return rankUsageRows(fallback);
  }, [liveTracking]);

  const entryPointsRanked = useMemo(() => {
    return rankUsageRows(
      mapPoints(liveTracking?.entryPoints).map((d) => ({
        name: String(d.name),
        value: d.value,
      })),
    );
  }, [liveTracking]);

  const communityRanked = useMemo(() => {
    const og = liveTracking?.officeGossip;
    if (og?.available || (og && (og.usersOnOfficeGossip || og.referenceChecks))) {
      const summary = og.referenceChecksSummary || {};
      return rankUsageRows(
        [
          { name: 'Users on Office Gossip', value: Number(og.usersOnOfficeGossip) || 0 },
          { name: 'Ref checks initiated', value: Number(summary.initiated) || 0 },
          { name: 'Ref checks responded', value: Number(summary.responded) || 0 },
          { name: 'Ref checks completed', value: Number(summary.completed) || 0 },
          { name: 'Ref checks rejected', value: Number(summary.rejected) || 0 },
          { name: 'Open for reference', value: Number(og.openForReference) || 0 },
          { name: 'Communities', value: Number(og.communities) || 0 },
          { name: 'Posts', value: Number(og.posts) || 0 },
        ].filter((r) => r.value > 0),
      );
    }
    const rows = mapPoints(liveTracking?.communityBehavior).map((d) => ({
      name: String(d.name),
      value: d.value,
    }));
    if (rows.length) return rankUsageRows(rows);
    return rankUsageRows(
      mapPoints(liveTracking?.pageVisitsByCategory)
        .filter((d) => /community|gossip|chat|reference/i.test(String(d.name)))
        .map((d) => ({ name: String(d.name), value: d.value })),
    );
  }, [liveTracking]);

  const topInterestsRanked = useMemo(() => {
    const rows = (liveTracking?.topInterests || []).map((d) => {
      const users = Number((d as { users?: number }).users ?? 0) || 0;
      const scoreSum = Math.round((Number(d.scoreSum ?? d.value) || 0) * 10) / 10;
      const avg =
        users > 0
          ? Math.round((scoreSum / users) * 10) / 10
          : d.avgScore != null
            ? Math.round(Number(d.avgScore) * 10) / 10
            : null;
      return {
        name: String(d.name),
        value: scoreSum,
        hint:
          avg != null
            ? `${fmt(users)} users · avg ${avg}`
            : users
              ? `${fmt(users)} users`
              : undefined,
      };
    });
    if (rows.length) return rankUsageRows(rows);
    return rankUsageRows([]);
  }, [liveTracking]);

  const trendingTopicsRanked = useMemo(() => {
    const interestNames = new Set(
      (liveTracking?.topInterests || []).map((d) => String(d.name || '').toLowerCase()),
    );
    const kindLabel: Record<string, string> = {
      role: 'role',
      company: 'company',
      landing: 'landing',
      interest: 'interest',
    };
    const rows = mapPoints(liveTracking?.trendingTopics)
      .filter((d) => !interestNames.has(String(d.name || '').toLowerCase()))
      .map((d) => {
        const kind = String((d as { kind?: string }).kind || '');
        return {
          name: String(d.name),
          value: d.value,
          hint: kindLabel[kind] || (kind || undefined),
        };
      });
    if (rows.length) return rankUsageRows(rows, 8);
    return rankUsageRows(
      mapPoints(liveTracking?.entryPoints).map((d) => ({
        name: String(d.name),
        value: d.value,
        hint: 'landing',
      })),
      8,
    );
  }, [liveTracking]);

  const featureMost = featureUsageRanked[0] || null;
  const featureLeast = featureUsageRanked.length
    ? featureUsageRanked[featureUsageRanked.length - 1]
    : null;
  const premiumMost = premiumServicesRanked[0] || null;

  const topJobs = useMemo(() => {
    if (!t?.topJobsByApplications?.length) return [];
    return t.topJobsByApplications.slice(0, 5).map((row) => ({
      title: row.title,
      applications: row.applications,
      match: row.avgMatchScore ?? matchAvg ?? 0,
      selected: row.selected ?? 0,
      joined: row.joined ?? row.selected ?? 0,
    }));
  }, [t, matchAvg]);

  const journey = [
    {
      label: 'Registration',
      value: totalCandidates,
      rate: 100,
      icon: UserPlus,
      color: INDIGO,
    },
    {
      label: 'Resume Upload',
      value: totalResumes,
      rate: totalCandidates > 0 ? Math.round((totalResumes / totalCandidates) * 1000) / 10 : 0,
      icon: Upload,
      color: BLUE,
    },
    {
      label: 'Profile Complete',
      value: profilePct == null ? 0 : Math.round(totalCandidates * (profilePct / 100)),
      rate: profilePct ?? 0,
      icon: CheckCircle2,
      color: TEAL,
    },
    {
      label: 'Application',
      value: applications,
      rate: totalCandidates > 0 ? Math.round((applications / totalCandidates) * 1000) / 10 : 0,
      icon: ClipboardList,
      color: ORANGE,
    },
    {
      label: 'Interview',
      value: interviewReqs,
      rate: applications > 0 ? Math.round((interviewReqs / applications) * 1000) / 10 : 0,
      icon: Calendar,
      color: PURPLE,
    },
    {
      label: 'Offer',
      value: selected,
      rate: applications > 0 ? Math.round((selected / applications) * 1000) / 10 : 0,
      icon: Award,
      color: GOLD,
    },
    {
      label: 'Joined',
      value: placements,
      rate: selected > 0 ? Math.round((placements / selected) * 1000) / 10 : 0,
      icon: Trophy,
      color: GREEN,
    },
  ];

  const categories = useMemo(() => {
    const rows = mapPoints(c?.jobsByStatus);
    if (!rows.length) return [];
    const total = rows.reduce((s, d) => s + d.value, 0) || 1;
    return rows.slice(0, 5).map((d) => ({
      name: d.name,
      pct: Math.round((d.value / total) * 1000) / 10,
    }));
  }, [c]);

  const appRate =
    totalCandidates > 0 ? Math.round((applications / totalCandidates) * 1000) / 10 : 0;
  const offerRate =
    applications > 0 ? Math.round((selected / applications) * 1000) / 10 : 0;

  const appRateSpark = seriesToSpark(applicationsOverTime);
  const offerSpark = seriesToSpark(
    applicationsOverTime.map((d) => ({
      value: applications > 0 ? Math.round((d.value * selected) / applications) : 0,
    })),
  );
  const aiSparks = [
    seriesToSpark(applicationsDaily.length ? applicationsDaily : applicationsMonthly),
    seriesToSpark(candidatesDaily.length ? candidatesDaily : candidatesMonthly),
    seriesToSpark(applicationsMonthly),
    seriesToSpark(candidatesMonthly),
  ];

  const updatedLabel = generatedAt
    ? new Date(generatedAt).toLocaleString(undefined, {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '—';

  const maxFunnel = Math.max(...funnel.map((f) => f.value), 1);

  return (
    <HqModulePageLayout
      title="Employees dashboard"
      subtitle="Talent platform overview · portal analytics"
      icon={<Users className="h-5 w-5" />}
      locked={false}
      actions={
          <div className="flex flex-wrap items-center gap-2">
          <Link href="/hq/candidates" prefetch={false} className={HQ_DASH_BTN_SECONDARY}>
            <Users className="h-4 w-4 text-emerald-600" />
            Candidates
          </Link>
          <Link href="/hq/tickets?audience=employee" prefetch={false} className={HQ_DASH_BTN_SECONDARY}>
            <Ticket className="h-4 w-4 text-violet-600" />
            Tickets
          </Link>
            <button
              type="button"
              onClick={onRefresh}
              disabled={loading}
            className={HQ_DASH_BTN_PRIMARY}
            >
              <RefreshCcw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
      }
    >
      <div className="hq-dash-page dash-ui text-slate-900">
        {/* Heading graphics strip — no action buttons (those live in the top bar) */}
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <span className="inline-flex h-1.5 w-10 rounded-full bg-gradient-to-r from-slate-900 to-blue-900" />
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700 ring-1 ring-emerald-200/90">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
              Live
            </span>
            <p className="text-[11px] text-slate-400">
              Updated {updatedLabel}
              {hasLiveTracker
                ? ` · tracker ${liveTrackedUsers} users · ${activeSessions} online`
                : ' · portal DB + sessions'}
            </p>
          </div>
        </div>

        {insights.length > 0 ? (
          <div className="mb-5 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {insights.slice(0, 3).map((insight, i) => (
              <div
                key={`${insight.text}-${i}`}
                className={`rounded-2xl border px-3.5 py-3 text-xs leading-relaxed shadow-[0_10px_28px_-18px_rgba(15,23,42,0.2)] backdrop-blur-sm ${
                  insight.tone === 'good'
                    ? 'border-emerald-200/80 bg-emerald-50/80 text-emerald-800'
                    : insight.tone === 'warn'
                      ? 'border-amber-200/80 bg-amber-50/80 text-amber-800'
                      : 'border-white/70 bg-white/75 text-slate-600'
                }`}
              >
                {insight.text}
              </div>
            ))}
          </div>
        ) : null}

        {/* KPI pulse — 4 hero cards only (rest live under category tabs) */}
        <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {kpis.map((item) => (
            <HqSvgKpiCard
              key={item.label}
              item={{ ...item, compareLabel: item.compareLabel || 'vs prior' }}
            />
          ))}
        </div>

        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5 rounded-2xl border border-slate-200/80 bg-slate-50/90 p-1">
            <span className="px-2 text-[10px] font-bold uppercase tracking-wide text-slate-400">
              Timeline
            </span>
            {TIMELINE_OPTIONS.map((opt) => {
              const on = timeline === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setTimeline(opt.id)}
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
          <p className="text-[10px] text-slate-400">
            Filters sessions, live feed & daily charts · selected{' '}
            <strong className="text-slate-600">{timelineLabel}</strong>
          </p>
        </div>

        <HqDashCategoryTabs
          tabs={[...EMPLOYEE_CATEGORY_TABS]}
          value={category}
          onChange={(id) => setCategory(id as typeof category)}
          instanceId="employees"
        />

        {category === 'growth' ? (
        <>
        {/* Charts + Funnel */}
        <div className="mb-6 grid grid-cols-12 gap-4">
          <Card className="col-span-12 lg:col-span-5">
            <SectionTitle
              title="Candidates Joined Over Time"
              info="New candidates joining the portal over time."
              right={
                <RangeToggle
                  options={['Daily', 'Monthly'] as const}
                  value={candRange}
                  onChange={(v) => setCandRange(v as 'Daily' | 'Monthly')}
                />
              }
            />
            <div className="h-[250px]">
              {candidatesOverTime.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={candidatesOverTime} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="candFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={PURPLE} stopOpacity={0.34} />
                        <stop offset="100%" stopColor={PURPLE} stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="4 8" stroke={gridStroke} vertical={false} />
                    <XAxis dataKey="name" tick={axisTick} axisLine={false} tickLine={false} />
                    <YAxis tick={axisTick} axisLine={false} tickLine={false} width={40} />
                    <Tooltip contentStyle={tip} cursor={{ stroke: '#C7D2FE', strokeWidth: 1 }} />
                    <Area
                      type="monotone"
                      dataKey="value"
                      stroke={PURPLE}
                      fill="url(#candFill)"
                      strokeWidth={2.6}
                      strokeLinecap="round"
                      activeDot={{ r: 5, strokeWidth: 2, stroke: '#fff' }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <EmptyChart label="No candidate timeline from the portal yet" />
              )}
            </div>
          </Card>

          <Card className="col-span-12 lg:col-span-3">
            <SectionTitle title="Hiring Funnel" info="Portal hiring stages from jobs published through joined." />
            <div className="flex flex-col items-center gap-1.5 pt-1">
              {funnel.map((step, i) => {
                const widthPct = 100 - i * 11;
                return (
                  <div key={step.name} className="flex w-full items-center gap-2">
                    <span className="w-[88px] shrink-0 text-right text-[10px] font-medium leading-tight text-slate-500">
                      {step.name}
                    </span>
                    <div className="flex flex-1 justify-center">
                      <motion.div
                        initial={{ scaleX: 0.7, opacity: 0 }}
                        animate={{ scaleX: 1, opacity: 1 }}
                        transition={{ delay: i * 0.05, duration: 0.35 }}
                        className="flex h-8 items-center justify-center rounded-lg text-[10px] font-bold text-white shadow-[0_8px_16px_-8px_rgba(15,23,42,0.45)]"
                        style={{
                          width: `${Math.max(28, (step.value / maxFunnel) * widthPct + 20)}%`,
                          background: FUNNEL_COLORS[i],
                          clipPath: 'polygon(4% 0%, 96% 0%, 100% 100%, 0% 100%)',
                        }}
                      />
                    </div>
                    <span className="w-[52px] shrink-0 text-[11px] font-semibold text-slate-700">{fmt(step.value)}</span>
                  </div>
                );
              })}
            </div>
          </Card>

          <Card className="col-span-12 lg:col-span-4">
            <SectionTitle
              title="Applications Over Time"
              info="Applications submitted on the portal over time."
              right={
                <RangeToggle
                  options={['Daily', 'Weekly', 'Monthly'] as const}
                  value={appRange}
                  onChange={(v) => setAppRange(v as 'Daily' | 'Weekly' | 'Monthly')}
                />
              }
            />
            <div className="h-[250px]">
              {applicationsOverTime.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={applicationsOverTime} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="appFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={INDIGO} stopOpacity={0.32} />
                        <stop offset="100%" stopColor={INDIGO} stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="4 8" stroke={gridStroke} vertical={false} />
                    <XAxis dataKey="name" tick={axisTick} axisLine={false} tickLine={false} />
                    <YAxis tick={axisTick} axisLine={false} tickLine={false} width={40} />
                    <Tooltip contentStyle={tip} cursor={{ stroke: '#C7D2FE', strokeWidth: 1 }} />
                    <Area
                      type="monotone"
                      dataKey="value"
                      stroke={INDIGO}
                      fill="url(#appFill)"
                      strokeWidth={2.6}
                      strokeLinecap="round"
                      activeDot={{ r: 5, strokeWidth: 2, stroke: '#fff' }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <EmptyChart label="No application timeline from the portal yet" />
              )}
            </div>
          </Card>
        </div>

        {/* ROW 4 */}
        <div className="mb-5 grid grid-cols-12 gap-4">
          <Card className="col-span-12 md:col-span-4 xl:col-span-3">
            <SectionTitle title="Interview Status" info="Breakdown of interview request statuses." />
            {interviewStatus.length ? (
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="mx-auto h-[140px] w-[140px] shrink-0 sm:mx-0">
                  <ResponsiveContainer width="100%" height={140}>
                    <PieChart>
                      <Pie
                        data={interviewStatus}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={40}
                        outerRadius={62}
                        paddingAngle={3}
                        stroke="#fff"
                        strokeWidth={2}
                      >
                        {interviewStatus.map((_, i) => (
                          <Cell key={i} fill={INTERVIEW_COLORS[i % INTERVIEW_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={tip} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="min-w-0 flex-1 space-y-2">
                  {interviewStatus.map((s, i) => (
                    <div key={s.name} className="flex items-center justify-between gap-2 text-[11px]">
                      <span className="flex min-w-0 items-center gap-1.5 text-slate-600">
                        <span
                          className="h-2 w-2 shrink-0 rounded-full"
                          style={{ background: INTERVIEW_COLORS[i % INTERVIEW_COLORS.length] }}
                        />
                        <span className="truncate capitalize" title={s.name}>
                          {String(s.name || '').replace(/_/g, ' ').toLowerCase()}
                        </span>
                      </span>
                      <span className="shrink-0 tabular-nums font-semibold text-slate-800">
                        {s.pct}% · {fmt(s.value)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <EmptyChart />
            )}
          </Card>

          <Card className="col-span-12 md:col-span-8 xl:col-span-5 !p-0 overflow-hidden">
            <div className="border-b border-slate-100 px-5 py-4">
              <h3 className="text-sm font-semibold text-slate-800">Top Performing Jobs</h3>
            </div>
            <div className="overflow-x-auto">
              {topJobs.length ? (
                <table className="w-full min-w-[480px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/70 text-[10px] uppercase tracking-wider text-slate-400">
                      <th className="px-5 py-3 font-semibold">Job Title</th>
                      <th className="px-3 py-3 font-semibold text-right">Applications</th>
                      <th className="px-3 py-3 font-semibold text-center">Avg Match %</th>
                      <th className="px-3 py-3 font-semibold text-right">Selected</th>
                      <th className="px-5 py-3 font-semibold text-right">Joined</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topJobs.map((row) => (
                      <tr key={row.title} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60">
                        <td className="px-5 py-3 font-semibold text-slate-900">{row.title}</td>
                        <td className="px-3 py-3 text-right text-slate-600">{fmt(row.applications)}</td>
                        <td className="px-3 py-3 text-center">
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-bold ${
                              row.match >= 80
                                ? 'bg-emerald-50 text-emerald-700'
                                : 'bg-violet-50 text-violet-700'
                            }`}
                          >
                            {row.match || '—'}{row.match ? '%' : ''}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-right font-medium text-slate-700">{fmt(row.selected)}</td>
                        <td className="px-5 py-3 text-right font-bold text-indigo-600">{fmt(row.joined)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="px-5 py-10">
                  <EmptyChart label="No job application rankings yet" />
                </div>
              )}
            </div>
          </Card>

          <Card className="col-span-12 xl:col-span-4">
            <SectionTitle title="Candidate Journey" info="How candidates progress through portal stages." />
            <div className="flex items-start justify-between gap-1 overflow-x-auto pb-1 pt-2">
              {journey.map((step, i) => {
                const Icon = step.icon;
                return (
                  <div key={step.label} className="flex min-w-[72px] flex-1 flex-col items-center text-center">
                    <div className="flex w-full items-center">
                      {i > 0 ? <div className="h-px flex-1 bg-slate-200" /> : <div className="flex-1" />}
                      <div
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white shadow-sm"
                        style={{ backgroundColor: step.color }}
                      >
                        <Icon className="h-4 w-4" />
                      </div>
                      {i < journey.length - 1 ? (
                        <div className="flex flex-1 items-center">
                          <div className="h-px flex-1 bg-slate-200" />
                          <ArrowRight className="h-3 w-3 shrink-0 text-slate-300" />
                        </div>
                      ) : (
                        <div className="flex-1" />
                      )}
                    </div>
                    <p className="mt-2 text-[10px] font-medium leading-tight text-slate-500">{step.label}</p>
                    <p className="mt-1 text-sm font-bold text-slate-900">{fmt(step.value)}</p>
                    <p className="mt-0.5 text-[10px] font-semibold text-slate-500">{step.rate}%</p>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>

        </>
        ) : null}

        {category === 'supply' ? (
        <>
        {/* ROW 3 — Distributions */}
        <div className="mb-5 grid grid-cols-12 gap-4">
          <Card className="col-span-12 md:col-span-6 xl:col-span-3">
            <SectionTitle title="Candidates by Source" info="Where portal candidates came from." />
            {sources.length ? (
              <div className="flex items-center gap-3">
                <div className="h-[170px] w-[170px] shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={sources}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={50}
                        outerRadius={74}
                        paddingAngle={3}
                        stroke="#fff"
                        strokeWidth={2}
                      >
                        {sources.map((_, i) => (
                          <Cell key={i} fill={SOURCE_COLORS[i % SOURCE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={tip} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="min-w-0 flex-1 space-y-1.5">
                  {sources.map((s, i) => (
                    <div key={s.name} className="flex items-center justify-between gap-2 text-[11px]">
                      <span className="flex min-w-0 items-center gap-1.5 truncate text-slate-600">
                        <span
                          className="h-2 w-2 shrink-0 rounded-full"
                          style={{ background: SOURCE_COLORS[i % SOURCE_COLORS.length] }}
                        />
                        <span className="truncate">{s.name}</span>
                      </span>
                      <span className="shrink-0 tabular-nums font-semibold text-slate-800">
                        {s.pct}% · {fmt(s.value)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <EmptyChart />
            )}
          </Card>

          <Card className="col-span-12 md:col-span-6 xl:col-span-2">
            <SectionTitle title="Top Skills" info="Most common skills on portal candidate profiles. Click to see the full list." />
            {previewSkills.length ? (
              <button
                type="button"
                onClick={() => setSkillsOpen(true)}
                className="w-full rounded-xl text-left outline-none transition hover:bg-slate-50/80 focus-visible:ring-2 focus-visible:ring-indigo-200"
              >
                <SkillUsageRows rows={previewSkills} />
                {skills.length > previewSkills.length ? (
                  <p className="mt-3 text-center text-[11px] font-semibold text-indigo-600">
                    View all {fmt(skills.length)} skills
                  </p>
                ) : (
                  <p className="mt-3 text-center text-[10px] text-slate-400">Click to enlarge</p>
                )}
              </button>
            ) : (
              <EmptyChart />
            )}
          </Card>

          <Card className="col-span-12 md:col-span-6 xl:col-span-2">
            <SectionTitle title="Experience Distribution" info="Candidate experience bands on the portal." />
            <div className="h-[190px]">
              {experience.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={experience} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="4 8" stroke={gridStroke} vertical={false} />
                    <XAxis dataKey="name" tick={{ ...axisTick, fontSize: 9 }} axisLine={false} tickLine={false} interval={0} />
                    <YAxis tick={{ ...axisTick, fontSize: 10 }} axisLine={false} tickLine={false} width={28} />
                    <Tooltip contentStyle={tip} cursor={{ fill: 'rgba(99,102,241,0.06)' }} />
                    <Bar dataKey="value" radius={[8, 8, 0, 0]} barSize={18}>
                      {experience.map((_, i) => (
                        <Cell key={i} fill={i % 2 === 0 ? INDIGO : PURPLE} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <EmptyChart />
              )}
            </div>
          </Card>

          <Card className="col-span-12 md:col-span-6 xl:col-span-3">
            <SectionTitle title="AI Analytics Overview" info="AI match and scoring signals from the portal." />
            <div className="grid grid-cols-2 gap-2.5">
              {[
                { label: 'Avg ATS Score', value: atsScore, suffix: '%', color: INDIGO, spark: aiSparks[0] },
                { label: 'Avg Match %', value: matchAvg, suffix: '%', color: PURPLE, spark: aiSparks[1] },
                { label: 'Avg Resume Score', value: cvScore, suffix: '%', color: TEAL, spark: aiSparks[2] },
                { label: 'Profile Completeness', value: profilePct, suffix: '%', color: ORANGE, spark: aiSparks[3] },
              ].map((m) => (
                <div
                  key={m.label}
                  className="rounded-xl border border-slate-100 bg-slate-50/80 p-2.5"
                >
                  <p className="text-[9px] font-semibold uppercase leading-tight tracking-wide text-slate-400">
                    {m.label}
                  </p>
                  <p className="mt-1 text-lg font-bold tabular-nums" style={{ color: m.color }}>
                    {m.value == null ? '—' : `${m.value}${m.suffix}`}
                  </p>
                  <MiniSpark data={m.spark} color={m.color} height={22} />
                </div>
              ))}
            </div>
          </Card>

          <Card className="col-span-12 md:col-span-6 xl:col-span-2">
            <SectionTitle title="Top Candidate Locations" info="Where portal candidates are based." />
            {locations.length ? (
              <div className="space-y-2">
                {locations.map((loc) => (
                  <div key={loc.name} className="flex items-center justify-between gap-2 text-[11px]">
                    <span className="flex min-w-0 items-center gap-1.5 truncate text-slate-600">
                      <MapPin className="h-3 w-3 shrink-0 text-violet-500" />
                      <span className="truncate">{loc.name}</span>
                    </span>
                    <span className="shrink-0 font-semibold text-slate-800">{fmt(loc.value)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyChart />
            )}
          </Card>
        </div>

        {/* ROW 5 — Bottom */}
        <div className="mb-4 grid grid-cols-12 gap-4">
          <Card className="col-span-12 md:col-span-4 lg:col-span-3">
            <SectionTitle title="Recently Posted Jobs" info="Latest jobs visible on the portal." />
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Today', value: jobsToday },
                { label: 'This Week', value: jobsWeek },
                { label: 'This Month', value: jobsMonth || activeJobs },
              ].map((item) => (
                <div key={item.label} className="rounded-xl bg-slate-50 px-3 py-3 text-center">
                  <p className="text-[10px] font-medium text-slate-400">{item.label}</p>
                  <p className="mt-1 text-xl font-bold text-slate-900">{fmt(item.value)}</p>
                </div>
              ))}
            </div>
            {t?.recentOpenJobs?.length ? (
              <div className="mt-3 max-h-[120px] space-y-1.5 overflow-y-auto">
                {t.recentOpenJobs.slice(0, 5).map((job) => (
                  <div key={job.id} className="flex items-center justify-between gap-2 rounded-lg px-1 py-1 text-[11px]">
                    <span className="truncate font-medium text-slate-700">{job.title}</span>
                    <span className="shrink-0 text-slate-400">{job.location}</span>
                  </div>
                ))}
              </div>
            ) : null}
          </Card>

          <Card className="col-span-12 md:col-span-8 lg:col-span-5">
            <SectionTitle title="Job Status Mix" info="Open vs closed and other job statuses." />
            {categories.length ? (
              <>
                <div className="mb-3 flex h-3.5 overflow-hidden rounded-full bg-slate-100/80 ring-1 ring-slate-100">
                  {categories.map((cat, i) => (
                    <div
                      key={cat.name}
                      className="h-full first:rounded-l-full last:rounded-r-full"
                      style={{ width: `${cat.pct}%`, background: CATEGORY_COLORS[i % CATEGORY_COLORS.length] }}
                    />
                  ))}
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-2">
                  {categories.map((cat, i) => (
                    <div key={cat.name} className="flex items-center gap-1.5 text-[11px] text-slate-600">
                      <span className="h-2 w-2 rounded-full" style={{ background: CATEGORY_COLORS[i % CATEGORY_COLORS.length] }} />
                      {cat.name}
                      <span className="font-semibold text-slate-800">{cat.pct}%</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <EmptyChart label="No job status mix yet" />
            )}
          </Card>

          <Card className="col-span-6 lg:col-span-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Application Rate</p>
            <div className="mt-2 flex items-end justify-between gap-2">
              <div>
                <p className="hq-display text-2xl font-bold tabular-nums text-indigo-600">{appRate}%</p>
                <p className="mt-1 text-[11px] text-slate-400">apps / candidates</p>
              </div>
              <div className="w-16">
                <MiniSpark data={appRateSpark} color={INDIGO} />
              </div>
            </div>
          </Card>

          <Card className="col-span-6 lg:col-span-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Offer Rate</p>
            <div className="mt-2 flex items-end justify-between gap-2">
              <div>
                <p className="hq-display text-2xl font-bold tabular-nums text-violet-600">{offerRate}%</p>
                <p className="mt-1 text-[11px] text-slate-400">selected / apps · 7d {fmt(apps7d)}</p>
              </div>
              <div className="w-16">
                <MiniSpark data={offerSpark} color={PURPLE} />
              </div>
            </div>
          </Card>
        </div>

        {/* ROW 6 — Login / session / geo analytics */}
        </>
        ) : null}

        {category === 'engagement' ? (
        <section className="mb-2">
          <div className="grid grid-cols-12 gap-4">
            {/* Row 1 — Session Overview (wide) + Country */}
            <Card className="col-span-12 !p-4 lg:col-span-7">
              <SectionTitle title="Session Overview" info="Login sessions, duration, and device mix." />
              <div className="grid gap-4 sm:grid-cols-12 sm:items-center">
                <div className="grid grid-cols-2 gap-2.5 sm:col-span-5">
                  {[
                    { label: 'Logins today', value: fmt(loginsToday), icon: LogIn, color: INDIGO },
                    { label: 'Logins 7d', value: fmt(logins7d), icon: Calendar, color: PURPLE },
                    {
                      label: 'Online now',
                      value: fmt(activeSessions),
                      icon: MonitorSmartphone,
                      color: TEAL,
                    },
                    {
                      label: 'Avg duration',
                      value: formatDurationMs(avgSessionMs),
                      icon: Clock3,
                      color: ORANGE,
                    },
                  ].map((item) => {
                    const Icon = item.icon;
                    return (
                      <div
                        key={item.label}
                        className="rounded-xl border border-slate-100 bg-slate-50/80 p-3"
                      >
                        <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                          <Icon className="h-3 w-3 shrink-0" style={{ color: item.color }} />
                          <span className="min-w-0 flex-1 truncate">{item.label}</span>
                        </div>
                        <p className="mt-1.5 text-xl font-bold tabular-nums text-slate-900">{item.value}</p>
                      </div>
                    );
                  })}
                </div>
                <div className="h-[180px] sm:col-span-7">
                  {loginsDaily.length ? (
                    <ResponsiveContainer width="100%" height={180}>
                      <AreaChart data={loginsDaily} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                        <defs>
                          <linearGradient id="loginFill" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={TEAL} stopOpacity={0.28} />
                            <stop offset="100%" stopColor={TEAL} stopOpacity={0.02} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="4 8" stroke={gridStroke} vertical={false} />
                        <XAxis
                          dataKey="name"
                          tick={{ ...axisTick, fontSize: 9 }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <YAxis tick={axisTick} axisLine={false} tickLine={false} width={28} />
                        <Tooltip contentStyle={tip} cursor={{ stroke: '#99F6E4', strokeWidth: 1 }} />
                        <Area
                          type="monotone"
                          dataKey="value"
                          stroke={TEAL}
                          fill="url(#loginFill)"
                          strokeWidth={2.4}
                          strokeLinecap="round"
                          activeDot={{ r: 4, strokeWidth: 2, stroke: '#fff' }}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <EmptyChart label="No login timeline yet" />
                  )}
                </div>
              </div>
            </Card>

            <Card className="col-span-12 !p-4 lg:col-span-5">
              <SectionTitle title="Logins by Country" info="Portal logins grouped by country." />
              {loginsByCountry.length ? (
                <div className="flex items-center gap-4">
                  <div className="h-[180px] w-[180px] shrink-0">
                    <ResponsiveContainer width="100%" height={180}>
                      <PieChart>
                        <Pie
                          data={loginsByCountry}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          innerRadius={48}
                          outerRadius={72}
                          paddingAngle={3}
                          stroke="#fff"
                          strokeWidth={2}
                        >
                          {loginsByCountry.map((_, i) => (
                            <Cell key={i} fill={SOURCE_COLORS[i % SOURCE_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={tip} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="min-w-0 flex-1 space-y-2">
                    {loginsByCountry.map((s, i) => (
                      <div key={s.name} className="flex items-center justify-between gap-2 text-[12px]">
                        <span className="flex min-w-0 items-center gap-1.5 truncate text-slate-600">
                          <Globe2 className="h-3.5 w-3.5 shrink-0 text-indigo-500" />
                          <span
                            className="h-2 w-2 shrink-0 rounded-full"
                            style={{ background: SOURCE_COLORS[i % SOURCE_COLORS.length] }}
                          />
                          {s.name}
                        </span>
                        <span className="shrink-0 font-semibold text-slate-800">
                          {s.pct}% · {fmt(s.value)}
                        </span>
                      </div>
                    ))}
                    {loginsByDevice.length ? (
                      <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
                        {loginsByDevice.map((d, i) => (
                          <span
                            key={d.name}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-50 px-2 py-1 text-[10px] text-slate-600"
                          >
                            <span
                              className="h-1.5 w-1.5 rounded-full"
                              style={{ background: SOURCE_COLORS[i % SOURCE_COLORS.length] }}
                            />
                            <span className="capitalize">{d.name}</span>
                            <span className="font-semibold text-slate-800">{d.pct}%</span>
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : (
                <EmptyChart label="No country login data yet" />
              )}
            </Card>

            {/* Row 2 — Recent Sessions (wide) + State/Region */}
            <Card className="col-span-12 flex min-h-[260px] flex-col overflow-hidden !p-0 lg:col-span-9">
              <div className="border-b border-slate-100 px-4 py-2.5">
                <div className="flex items-center gap-2">
                  <span className="h-4 w-1 shrink-0 rounded-full bg-gradient-to-b from-slate-900 to-blue-900" />
                  <h3 className="text-sm font-semibold text-slate-800">Recent Sessions</h3>
                </div>
                <p className="mt-0.5 pl-3 text-[11px] text-slate-400">
                  Login · logout · duration · device · location
                </p>
              </div>
              <div className="max-h-[320px] flex-1 overflow-auto">
                {filteredSessions.length ? (
                  <table className="w-full min-w-[560px] text-left text-sm">
                    <thead className="sticky top-0 z-[1]">
                      <tr className="border-b border-slate-100 bg-slate-50/95 text-[10px] uppercase tracking-wider text-slate-400 backdrop-blur">
                        <th className="px-4 py-2.5 font-semibold">User</th>
                        <th className="px-3 py-2.5 font-semibold">Login</th>
                        <th className="px-3 py-2.5 font-semibold">Logout</th>
                        <th className="px-3 py-2.5 font-semibold">Duration</th>
                        <th className="px-3 py-2.5 font-semibold">Device</th>
                        <th className="px-4 py-2.5 font-semibold">Location</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredSessions.slice(0, 10).map((row, idx) => (
                        <tr
                          key={`${row.candidateId}-${row.loginAt}-${idx}`}
                          className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60"
                        >
                          <td className="px-4 py-2.5">
                            <div className="font-semibold text-slate-900">{row.candidate}</div>
                            <div className="text-[10px] text-slate-400">
                              {row.status === 'online' || row.isActive ? (
                                <span className="font-semibold text-emerald-600">Online</span>
                              ) : row.status === 'idle' ? (
                                <span className="font-semibold text-amber-600">Idle</span>
                              ) : (
                                <span className="font-semibold text-slate-400">Closed</span>
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-2.5 text-[11px] text-slate-600">{formatClock(row.loginAt)}</td>
                          <td className="px-3 py-2.5 text-[11px] text-slate-600">{formatClock(row.logoutAt)}</td>
                          <td className="px-3 py-2.5 text-[11px] font-semibold text-slate-800">
                            {(() => {
                              const liveMs = liveSessionDurationMs(row, nowMs);
                              return liveMs != null && liveMs > 0 ? formatDurationMs(liveMs) : '—';
                            })()}
                          </td>
                          <td className="px-3 py-2.5 text-[11px] text-slate-600">
                            <div className="font-medium capitalize">{row.deviceType}</div>
                            <div className="text-[10px] text-slate-400">
                              {row.browser} · {row.operatingSystem}
                            </div>
                          </td>
                          <td className="px-4 py-2.5 text-[11px] text-slate-600">
                            {[row.city, row.state, row.country].filter((p) => p && p !== '—').join(', ') || '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="px-5 py-10">
                    <EmptyChart label={`No sessions in this ${timelineLabel.toLowerCase()} window`} />
                  </div>
                )}
              </div>
            </Card>

            <Card className="col-span-12 !p-4 lg:col-span-3">
              <SectionTitle title="By State / Region" info="Portal logins grouped by state or region." />
              <div className="space-y-2">
                {loginsByState.length ? (
                  loginsByState.map((row) => (
                    <div key={row.name} className="flex items-center justify-between text-[12px]">
                      <span className="truncate text-slate-600">{row.name}</span>
                      <span className="font-semibold text-slate-800">{fmt(row.value)}</span>
                    </div>
                  ))
                ) : (
                  <EmptyChart label="No state data" />
                )}
              </div>
              <div className="mt-4 border-t border-slate-100 pt-3">
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400">By city</p>
                <div className="space-y-1.5">
                  {loginsByCity.length ? (
                    loginsByCity.map((row) => (
                      <div key={row.name} className="flex items-center justify-between text-[12px]">
                        <span className="flex items-center gap-1 truncate text-slate-600">
                          <MapPin className="h-3 w-3 text-violet-500" />
                          {row.name}
                        </span>
                        <span className="font-semibold text-slate-800">{fmt(row.value)}</span>
                      </div>
                    ))
                  ) : (
                    <p className="text-[11px] text-slate-400">No city data yet</p>
                  )}
                </div>
              </div>
            </Card>
          </div>
        </section>
        ) : null}

        {category === 'live' ? (
        <section className="mb-2">
          <div className="mb-4 rounded-2xl border border-slate-200/90 bg-white p-3 shadow-sm sm:p-4">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Search candidate / user
              </p>
              {liveScopeActive || feedSort !== 'latest' ? (
                <button
                  type="button"
                  onClick={clearLiveFilters}
                  className="text-[11px] font-semibold text-blue-700 hover:text-blue-900"
                >
                  Clear filters
                </button>
              ) : null}
            </div>
            <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
              <div className="relative min-w-0 flex-1" ref={feedSearchWrapRef}>
                <Search className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={feedSearch}
                  onChange={(e) => {
                    setFeedSearch(e.target.value);
                    setFeedSuggestOpen(true);
                  }}
                  onFocus={() => setFeedSuggestOpen(true)}
                  placeholder="Search by name, user id, interest, or landing…"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/80 py-2.5 pl-10 pr-3 text-sm text-slate-800 outline-none ring-blue-200 placeholder:text-slate-400 focus:bg-white focus:ring-2"
                  autoComplete="off"
                />
                {feedSuggestOpen && feedSearch.trim() && liveSearchSuggestions.length ? (
                  <ul className="absolute left-0 right-0 top-[calc(100%+4px)] z-30 max-h-64 overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-lg shadow-slate-200/80">
                    {liveSearchSuggestions.map((s) => (
                      <li key={s.id}>
                        <button
                          type="button"
                          className="flex w-full flex-col gap-0.5 px-3 py-2 text-left hover:bg-blue-50"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => {
                            setFeedSearch(s.apply);
                            setFeedSuggestOpen(false);
                          }}
                        >
                          <span className="truncate text-[13px] font-semibold text-slate-800">
                            {s.label}
                          </span>
                          {s.sub ? (
                            <span className="truncate text-[10px] text-slate-500">{s.sub}</span>
                          ) : null}
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : feedSuggestOpen && feedSearch.trim() ? (
                  <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-30 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-[12px] text-slate-400 shadow-lg">
                    No matching candidates
                  </div>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-2">
                <select
                  value={feedCategory}
                  onChange={(e) => setFeedCategory(e.target.value)}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-[12px] font-semibold text-slate-700"
                >
                  {feedCategoryOptions.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt === 'all' ? 'All categories' : opt}
                    </option>
                  ))}
                </select>
                <select
                  value={feedRegion}
                  onChange={(e) => setFeedRegion(e.target.value)}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-[12px] font-semibold text-slate-700"
                >
                  {feedRegionOptions.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt === 'all' ? 'All regions' : opt}
                    </option>
                  ))}
                </select>
                <select
                  value={feedSort}
                  onChange={(e) =>
                    setFeedSort(e.target.value as 'latest' | 'oldest' | 'visits' | 'active')
                  }
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-[12px] font-semibold text-slate-700"
                >
                  <option value="latest">Latest users</option>
                  <option value="oldest">Oldest users</option>
                  <option value="visits">Most visits</option>
                  <option value="active">Most active time</option>
                </select>
              </div>
            </div>
            <p className="mt-2 text-[11px] text-slate-500">
              {liveScopeActive ? (
                <>
                  Showing stats for{' '}
                  <strong className="text-slate-700">{filteredLiveFeed.length}</strong> matched
                  candidate{filteredLiveFeed.length === 1 ? '' : 's'} · timeline {timelineLabel}
                </>
              ) : (
                <>
                  Platform-wide live tracking · {fmt(liveTrackedUsers)} users · timeline{' '}
                  {timelineLabel}
                </>
              )}
            </p>
          </div>

          <div className="mb-4 grid grid-cols-12 gap-4">
            <Card className="col-span-12 xl:col-span-9">
              <SectionTitle
                title="Live pulse"
                info="Realtime behaviour from the portal — online users, visits, job clicks, applies, and active time. Search or filter above to scope these numbers to a candidate."
                right={
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700 ring-1 ring-emerald-100">
                    <Radio className="h-3 w-3" />
                    {liveScopeActive
                      ? 'Filtered'
                      : hasLiveTracker
                        ? 'Behaviour engine'
                        : 'Sessions fallback'}
                  </span>
                }
              />
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
                {[
                  { label: 'Online now', value: fmt(displayOnline), icon: Radio, color: TEAL },
                  { label: 'Tracked users', value: fmt(displayTrackedUsers), icon: Users, color: INDIGO },
                  { label: 'Visits 7d', value: fmt(displayVisits), icon: Globe2, color: BLUE },
                  { label: 'Job clicks 7d', value: fmt(displayJobClicks), icon: MousePointerClick, color: ORANGE },
                  { label: 'Applies 7d', value: fmt(displayApplies), icon: ClipboardList, color: PURPLE },
                  {
                    label: 'Active time 7d',
                    value: formatDurationMs(displayActiveMs || null),
                    icon: Zap,
                    color: GREEN,
                  },
                ].map((item) => {
                  const Icon = item.icon;
                  return (
                    <div
                      key={item.label}
                      className="rounded-xl border border-white/70 bg-gradient-to-br from-white to-slate-50/90 p-3 shadow-[0_8px_20px_-14px_rgba(15,23,42,0.2)] ring-1 ring-slate-100/80"
                    >
                      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                        <Icon className="h-3 w-3 shrink-0" style={{ color: item.color }} />
                        <span className="min-w-0 flex-1 truncate">{item.label}</span>
                      </div>
                      <p className="mt-1.5 text-lg font-bold tabular-nums text-slate-900">{item.value}</p>
                    </div>
                  );
                })}
              </div>
              {!displayVisits && !displayApplies && !liveFeed.length ? (
                <p className="mt-3 text-[11px] text-slate-400">
                  No employee activity in tracker or portal history yet.
                </p>
              ) : liveTracking?.source !== 'phase1_behavior_tracker' ? (
                <p className="mt-3 text-[11px] text-slate-400">
                  Showing existing portal history (applies, logins, matches). New tracker
                  heartbeats will replace these with live visits.
                </p>
              ) : null}
            </Card>

            <Card className="col-span-12 xl:col-span-3">
              <SectionTitle
                title="Behaviour signals"
                info="Important CRM-ready signals from the behavioural engine — sales follow-up, high intent, premium gaps."
                right={
                  <Link
                    href="/hq/crm-dashboard"
                    className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-rose-700 hover:bg-rose-100"
                  >
                    CRM
                    <ExternalLink className="h-3 w-3" />
                  </Link>
                }
              />
              {liveTriggers.length ? (
                <ul className="space-y-2">
                  {liveTriggers.map((row) => {
                    const important = isImportantCrmSignal(row.name);
                    return (
                      <li
                        key={row.name}
                        className={`rounded-xl px-2.5 py-2 text-xs ${
                          important
                            ? 'border border-rose-200/90 bg-gradient-to-r from-rose-50 via-amber-50 to-orange-50 shadow-sm ring-1 ring-rose-100'
                            : 'border border-slate-100 bg-slate-50/70'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            {important ? (
                              <span className="mb-1 inline-flex items-center rounded-full bg-rose-600 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">
                                Important · CRM
                              </span>
                            ) : null}
                            <p
                              className={`truncate font-semibold capitalize ${
                                important ? 'text-rose-900' : 'text-slate-700'
                              }`}
                            >
                              {signalDisplayName(row.name)}
                            </p>
                          </div>
                          <span
                            className={`shrink-0 tabular-nums font-bold ${
                              important ? 'text-rose-700' : 'text-slate-900'
                            }`}
                          >
                            {fmt(row.value)}
                          </span>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <EmptyChart label="No signals yet" />
              )}
            </Card>
          </div>

          <div className="mb-4 grid grid-cols-12 gap-4">
            <Card className="col-span-12 !p-4 lg:col-span-5">
              <SectionTitle
                title="Premium services usage"
                info="Named premium services from Subscriptions (AI CV Edit, ATS Check, course unlocks…) that users spend tokens on."
                right={
                  <span className="rounded-lg border border-slate-200 px-2 py-0.5 text-[10px] font-medium text-slate-500">
                    7d · token spends
                  </span>
                }
              />
              <p className="mb-3 text-[10px] text-slate-400">
                Premium catalog spends (AI CV, interview, courses, LMS…)
                {liveTracking?.premiumTokensSpent7d
                  ? ` · ${fmt(liveTracking.premiumTokensSpent7d)} tokens`
                  : liveTracking?.premiumVisits7d
                    ? ` · ${fmt(liveTracking.premiumVisits7d)} spends`
                  : ''}
              </p>
              <RankedUsageList
                rows={premiumServicesRanked}
                emptyLabel="No premium token spends yet"
                valueSuffix="spends"
              />
            </Card>

            <Card className="col-span-12 !p-4 lg:col-span-4">
              <SectionTitle
                title="Popular features"
                info="Portal features HQ can act on — Paid (token spends / premium tools) and Free (jobs, profile, earn, gossip)."
                right={
                  <span className="rounded-lg border border-slate-200 px-2 py-0.5 text-[10px] font-medium text-slate-500">
                    Paid · free
                  </span>
                }
              />
              <p className="mb-3 text-[10px] text-slate-400">
                Labels match the job portal (AI CV Edit, Explore jobs, Profile completion…)
              </p>
              <RankedUsageList
                rows={featureUsageRanked}
                emptyLabel="No feature usage signals yet"
              />
            </Card>

            <Card className="col-span-12 !p-4 lg:col-span-3">
              <SectionTitle title="Highlights" info="Key behaviour highlights from live tracking." />
              <div className="space-y-3">
                <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 px-3 py-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-700/80">
                    Top premium
                  </p>
                  {premiumMost ? (
                    <>
                      <p className="mt-1 truncate text-sm font-bold text-slate-900">{premiumMost.name}</p>
                      <p className="mt-0.5 text-[11px] text-slate-500">
                        <strong className="text-emerald-700">{fmt(premiumMost.value)}</strong>{' '}
                        {liveTracking?.tokenUsage?.available ? 'spends' : 'visits'}
                      </p>
                    </>
                  ) : (
                    <p className="mt-2 text-xs text-slate-400">No premium data yet</p>
                  )}
                </div>
                <div className="rounded-xl border border-indigo-100 bg-indigo-50/40 px-3 py-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-indigo-700/80">
                    Most used feature
                  </p>
                  {featureMost ? (
                    <>
                      <p className="mt-1 truncate text-sm font-bold text-slate-900">{featureMost.name}</p>
                      <p className="mt-0.5 text-[11px] text-slate-500">
                        <strong className="text-indigo-700">{fmt(featureMost.value)}</strong> events
                      </p>
                    </>
                  ) : (
                    <p className="mt-2 text-xs text-slate-400">No data yet</p>
                  )}
                </div>
                <div className="rounded-xl border border-amber-100 bg-amber-50/40 px-3 py-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-700/80">
                    Least used
                  </p>
                  {featureLeast && featureUsageRanked.length > 1 ? (
                    <>
                      <p className="mt-1 truncate text-sm font-bold text-slate-900">{featureLeast.name}</p>
                      <p className="mt-0.5 text-[11px] text-slate-500">
                        <strong className="text-amber-800">{fmt(featureLeast.value)}</strong> events
                      </p>
                    </>
                  ) : (
                    <p className="mt-2 text-xs text-slate-400">Need 2+ features</p>
                  )}
                </div>
              </div>
            </Card>

            <Card className="col-span-12 !p-4 lg:col-span-4">
              <SectionTitle
                title="Entry points"
                info="Landing / services pages where candidates first open after arriving (UTM / campaign sources come later)."
                right={
                  <span className="rounded-lg border border-slate-200 px-2 py-0.5 text-[10px] font-medium text-slate-500">
                    First landing
                  </span>
                }
              />
              <p className="mb-3 text-[10px] text-slate-400">
                Portal landings — Services / Premium, Explore jobs, Candidate home, Profile…
              </p>
              <RankedUsageList
                rows={entryPointsRanked}
                emptyLabel="No first-open landing data yet"
                valueSuffix="opens"
              />
            </Card>

            <Card className="col-span-12 !p-4 lg:col-span-4">
              <SectionTitle
                title="Community & chat"
                info="Office Gossip users and reference-check pipeline (initiated → responded → completed)."
              />
              <p className="mb-3 text-[10px] text-slate-400">
                Office Gossip · reference check
                {liveTracking?.officeGossip?.usersOnOfficeGossip
                  ? ` · ${fmt(liveTracking.officeGossip.usersOnOfficeGossip)} users`
                  : liveTracking?.communityVisits7d
                  ? ` · ${fmt(liveTracking.communityVisits7d)} community visits`
                  : ''}
              </p>
              {liveTracking?.officeGossip?.referenceChecksSummary ? (
                <div className="mb-3 grid grid-cols-2 gap-2">
                  {[
                    {
                      label: 'Users',
                      value: liveTracking.officeGossip.usersOnOfficeGossip,
                      color: TEAL,
                    },
                    {
                      label: 'Initiated',
                      value: liveTracking.officeGossip.referenceChecksSummary.initiated,
                      color: INDIGO,
                    },
                    {
                      label: 'Responded',
                      value: liveTracking.officeGossip.referenceChecksSummary.responded,
                      color: PURPLE,
                    },
                    {
                      label: 'Completed',
                      value: liveTracking.officeGossip.referenceChecksSummary.completed,
                      color: GREEN,
                    },
                  ].map((m) => (
                    <div
                      key={m.label}
                      className="rounded-xl border border-slate-100 bg-slate-50/80 px-2.5 py-2"
                    >
                      <p className="text-[9px] font-semibold uppercase tracking-wide text-slate-400">
                        {m.label}
                      </p>
                      <p className="mt-0.5 text-lg font-bold tabular-nums" style={{ color: m.color }}>
                        {fmt(Number(m.value) || 0)}
                      </p>
                    </div>
                  ))}
                </div>
              ) : null}
              <RankedUsageList
                rows={communityRanked}
                emptyLabel="No Office Gossip / reference-check data yet"
              />
            </Card>

            <Card className="col-span-12 !p-4 lg:col-span-4">
              <SectionTitle title="Page mix (7d)" info="Full category attention mix from the behaviour tracker." />
              <p className="mb-3 text-[10px] text-slate-400">Portal surface visits ranked</p>
              {livePageVisits.length ? (
                <div className="space-y-2">
                  {livePageVisits.map((p, i) => {
                    const max = Math.max(...livePageVisits.map((x) => x.value), 1);
                    const pct = Math.round((p.value / max) * 1000) / 10;
                    return (
                      <div key={p.name}>
                        <div className="mb-1 flex justify-between text-[12px]">
                          <span className="truncate text-slate-600">{p.name}</span>
                          <span className="font-semibold text-slate-800">{fmt(p.value)}</span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${Math.max(6, pct)}%`,
                              background: FUNNEL_COLORS[i % FUNNEL_COLORS.length],
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <EmptyChart label="No page visits yet" />
              )}
            </Card>
                </div>

          <div className="mb-4 grid grid-cols-12 gap-4">
            <Card className="col-span-12 lg:col-span-4">
              <SectionTitle
                title="Interest aggregate"
                info="Same score for every user on a topic, summed. Right side is that total (users × average)."
              />
              <RankedUsageList
                rows={topInterestsRanked}
                emptyLabel="No interest topics yet — needs behaviour heartbeats"
              />
            </Card>

            <Card className="col-span-12 lg:col-span-4">
              <SectionTitle
                title="Trending topics"
                info="Roles, companies, and landing pages — not a second copy of Interest aggregate."
              />
              <RankedUsageList
                rows={trendingTopicsRanked}
                emptyLabel="No trending topics yet"
              />
            </Card>

            <Card className="col-span-12 lg:col-span-4">
              <SectionTitle
                title="Live feed"
                info="Matched candidates from the search bar above — pulse stats update with this list."
                right={
                  <span className="rounded-lg border border-slate-200 px-2 py-0.5 text-[10px] font-medium text-slate-500">
                    {filteredLiveFeed.length}/{liveFeed.length}
                  </span>
                }
              />
              {filteredLiveFeed.length ? (
                <ul className="max-h-[320px] space-y-2 overflow-y-auto">
                  {filteredLiveFeed.slice(0, 24).map((row) => {
                    const name = candidateNameById.get(String(row.userId));
                    return (
                      <li
                        key={`${row.userId}-${row.capturedAt}`}
                        className="rounded-lg border border-slate-100 bg-slate-50/70 px-2.5 py-2 text-[11px]"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-semibold text-slate-800">
                            {name || formatDurationMs(row.activeMs7d)}
                            {name ? (
                              <span className="ml-1.5 font-normal text-slate-500">
                                · {row.visits7d} visits
                              </span>
                            ) : (
                              <span> · {row.visits7d} visits</span>
                            )}
                          </p>
                          <span className="shrink-0 text-[10px] text-slate-400">
                            {formatClock(row.activityStateUpdatedAt || row.capturedAt)}
                        </span>
                      </div>
                        {name ? (
                          <p className="mt-0.5 text-[10px] text-slate-500">
                            {formatDurationMs(row.activeMs7d)} active · {row.applies7d} applies ·{' '}
                            {row.jobCardClicks7d} clicks
                          </p>
                        ) : null}
                        <p className="mt-0.5 truncate text-slate-500">
                          {row.topInterest
                            ? `Interest · ${row.topInterest}`
                            : row.topTrigger ||
                              `${row.applies7d} applies · ${row.jobCardClicks7d} clicks`}
                        </p>
                        {row.topFirstOpen ? (
                          <p className="mt-0.5 text-[10px] text-slate-400">
                            Landed · {row.topFirstOpen}
                          </p>
                        ) : null}
                        {sessionUserRegion.get(String(row.userId)) ? (
                          <p className="mt-0.5 text-[10px] text-slate-400">
                            Region · {sessionUserRegion.get(String(row.userId))}
                          </p>
                        ) : null}
                        <p className="mt-0.5 truncate font-mono text-[10px] text-slate-400">
                          {row.userId}
                        </p>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <EmptyChart
                  label={
                    liveScopeActive
                      ? 'No candidates match this search'
                      : 'No live feed rows yet'
                  }
                />
              )}
            </Card>
          </div>
        </section>
        ) : null}

        {/* FOOTER */}
        <div className="hq-dash-card flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/80 bg-white/75 px-5 py-3.5 text-xs text-slate-500 shadow-[0_18px_48px_-24px_rgba(15,23,42,0.14)] backdrop-blur-xl">
          <div className="flex items-center gap-2">
            <span>
              Last updated: <strong className="text-slate-700">{updatedLabel}</strong>
              {apps30d > 0 ? <span className="ml-2 text-slate-400">· {fmt(apps30d)} apps in 30d</span> : null}
            </span>
          </div>
          <div className="inline-flex items-center gap-1.5">
            <span className={`h-1.5 w-1.5 rounded-full ${isLive ? 'bg-emerald-500' : 'bg-amber-500'}`} />
            {isLive
              ? 'Live portal data · auto-refreshes every 15s'
              : 'Waiting for portal analytics response'}
          </div>
        </div>
        {skillsOpen ? (
          <div
            className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-[2px]"
            onClick={() => setSkillsOpen(false)}
            role="presentation"
          >
            <div
              className="flex max-h-[min(80vh,640px)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-labelledby="hq-top-skills-title"
            >
              <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
                <div>
                  <h3 id="hq-top-skills-title" className="text-base font-semibold text-slate-900">
                    All skills
                  </h3>
                  <p className="mt-0.5 text-[12px] text-slate-500">
                    {fmt(skills.length)} skills from candidate profiles · scroll to see the rest
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSkillsOpen(false)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-800"
                  aria-label="Close skills list"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
                <SkillUsageRows rows={skills} />
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </HqModulePageLayout>
  );
}
