'use client';

import { useMemo, useState } from 'react';
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
  Globe2,
  LogIn,
  MapPin,
  MonitorSmartphone,
  MousePointerClick,
  Radio,
  RefreshCcw,
  Trophy,
  Upload,
  UserPlus,
  Users,
  Zap,
} from 'lucide-react';
import type { HqEmployeeAnalytics } from '@/lib/api';
import { HQ_SVG_ASSETS, HqSvgKpiCard } from './HqSvgKpiCard';
import { HqInfoTip } from './HqPhase2DashboardParts';
import { HqDashCategoryTabs } from './HqDashCategoryTabs';

const INDIGO = '#6366F1';
const PURPLE = '#8B5CF6';
const TEAL = '#14B8A6';
const ORANGE = '#F97316';
const GREEN = '#22C55E';
const BLUE = '#3B82F6';
const GOLD = '#EAB308';
const SOURCE_COLORS = ['#6366F1', '#8B5CF6', '#14B8A6', '#F97316', '#3B82F6', '#64748B'];
const INTERVIEW_COLORS = ['#F59E0B', '#6366F1', '#22C55E', '#94A3B8', '#EF4444'];
const FUNNEL_COLORS = ['#6366F1', '#8B5CF6', '#A855F7', '#F97316', '#FBBF24', '#22C55E'];
const CATEGORY_COLORS = ['#6366F1', '#8B5CF6', '#14B8A6', '#F97316', '#94A3B8'];

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
  if (ms == null || !Number.isFinite(Number(ms)) || Number(ms) <= 0) return '—';
  const totalSec = Math.round(Number(ms) / 1000);
  if (totalSec < 60) return `${totalSec}s`;
  const mins = Math.floor(totalSec / 60);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  const rem = mins % 60;
  return rem ? `${hours}h ${rem}m` : `${hours}h`;
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
        <span className="h-4 w-1 shrink-0 rounded-full bg-gradient-to-b from-indigo-500 to-teal-400" />
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
    blurb:
      'Premium services, entry points, interests, Office Gossip / chat, sessions & geo',
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
  const hasLiveTracker = Boolean(liveTracking?.available && liveTracking.source === 'phase1_behavior_tracker');
  const isLive = Boolean(data?.live ?? data?.available);
  const [appRange, setAppRange] = useState<'Daily' | 'Weekly' | 'Monthly'>('Monthly');
  const [candRange, setCandRange] = useState<'Daily' | 'Monthly'>('Monthly');
  const [category, setCategory] = useState<(typeof EMPLOYEE_CATEGORY_TABS)[number]['id']>('growth');

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
  const candidatesDaily = useMemo(() => mapPoints(c?.candidatesDaily), [c]);
  const candidatesOverTime = candRange === 'Daily' ? candidatesDaily : candidatesMonthly;

  const applicationsMonthly = useMemo(() => mapPoints(c?.applicationsOverTime), [c]);
  const applicationsDaily = useMemo(() => mapPoints(c?.applicationsDaily), [c]);
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

  const loginsDaily = useMemo(() => mapPoints(c?.loginsDaily), [c]);
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
  const skills = useMemo(() => mapPoints(c?.topSkills).slice(0, 7), [c]);
  const experience = useMemo(() => mapPoints(c?.experienceBands), [c]);
  const locations = useMemo(() => mapPoints(c?.topLocations).slice(0, 6), [c]);
  const interviewStatus = useMemo(() => withPct(mapPoints(c?.interviewRequestsByStatus)), [c]);
  const loginsByCountry = useMemo(() => withPct(mapPoints(c?.loginsByCountry).slice(0, 6)), [c]);
  const loginsByState = useMemo(() => mapPoints(c?.loginsByState).slice(0, 6), [c]);
  const loginsByCity = useMemo(() => mapPoints(c?.loginsByCity).slice(0, 6), [c]);
  const loginsByDevice = useMemo(() => withPct(mapPoints(c?.loginsByDevice)), [c]);
  const recentSessions = t?.recentSessions || [];
  const loginsToday = num(k?.loginsToday);
  const logins7d = num(k?.logins7d);
  const activeSessions = Math.max(
    num(k?.activeSessions),
    hasLiveTracker ? num(liveTracking?.onlineNow) : 0,
  );
  const avgSessionMs = k?.avgSessionDurationMs ?? liveTracking?.avgActiveMsPerUser7d ?? null;
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
    () => mapPoints(liveTracking?.topTriggers).slice(0, 5),
    [liveTracking],
  );
  const liveFeed = liveTracking?.liveFeed || [];

  /** Most → least used candidate features (popularFeatures / page mix / KPI fallback). */
  const featureUsageRanked = useMemo(() => {
    const fromPopular = mapPoints(liveTracking?.popularFeatures).map((d) => ({
      name: String(d.name),
      value: d.value,
    }));
    const fromPages = mapPoints(liveTracking?.pageVisitsByCategory).map((d) => ({
      name: String(d.name),
      value: d.value,
    }));
    const fromTriggers = mapPoints(liveTracking?.topTriggers).map((d) => ({
      name: String(d.name).replace(/_/g, ' '),
      value: d.value,
    }));

    let rows = fromPopular.length
      ? fromPopular
      : fromPages.length
        ? fromPages
        : fromTriggers;
    if (!rows.length) {
      rows = [
        { name: 'Applications', value: applications },
        { name: 'Job clicks (7d)', value: liveJobClicks7d },
        { name: 'Visits (7d)', value: liveVisits7d },
        { name: 'AI matches', value: aiMatches },
        { name: 'CV analyses', value: num(k?.cvAnalyses) },
        { name: 'LMS enrollments', value: num(k?.lmsEnrollments) },
        { name: 'Saved jobs', value: num(k?.savedJobs) },
        { name: 'Interview requests', value: interviewReqs },
        { name: 'Resumes uploaded', value: totalResumes },
      ];
    }
    return rankUsageRows(rows);
  }, [
    liveTracking,
    applications,
    liveJobClicks7d,
    liveVisits7d,
    aiMatches,
    k,
    interviewReqs,
    totalResumes,
  ]);

  const premiumServicesRanked = useMemo(() => {
    const rows = mapPoints(liveTracking?.premiumServicesUsage).map((d) => ({
      name: String(d.name),
      value: d.value,
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
    const rows = (liveTracking?.topInterests || []).map((d) => ({
      name: String(d.name),
      value: Number(d.scoreSum ?? d.value) || 0,
      hint:
        d.avgScore != null
          ? `${fmt(Number(d.value))} users · avg ${Math.round(Number(d.avgScore))}`
          : undefined,
    }));
    if (rows.length) return rankUsageRows(rows);
    return rankUsageRows(
      mapPoints(liveTracking?.trendingTopics)
        .filter((d) => String((d as { kind?: string }).kind || 'interest') === 'interest')
        .map((d) => ({ name: String(d.name), value: d.value })),
    );
  }, [liveTracking]);

  const trendingTopicsRanked = useMemo(() => {
    return rankUsageRows(
      mapPoints(liveTracking?.trendingTopics).map((d) => {
        const kind = String((d as { kind?: string }).kind || '');
        return {
          name: String(d.name),
          value: d.value,
          hint: kind ? kind : undefined,
        };
      }),
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
    <div className="hq-dash-page min-h-full text-slate-900">
      <div className="mx-auto w-full max-w-[1600px] px-4 py-5 sm:px-6 xl:px-8">
        <header className="hq-dash-card mb-5 flex flex-wrap items-end justify-between gap-4 rounded-2xl border border-white/80 bg-white/75 px-4 py-5 shadow-[0_1px_0_rgba(255,255,255,0.85)_inset,0_18px_48px_-24px_rgba(15,23,42,0.16)] backdrop-blur-xl sm:px-6">
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="inline-flex h-1.5 w-10 rounded-full bg-gradient-to-r from-indigo-500 to-teal-400" />
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700 ring-1 ring-emerald-200/80">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                Live
              </span>
            </div>
            <h1 className="hq-display text-[1.75rem] font-bold tracking-tight text-slate-900 sm:text-[2rem]">
              Employees dashboard
            </h1>
            <p className="mt-1.5 text-sm font-medium text-slate-500">
              Talent platform overview · portal analytics
            </p>
            <p className="mt-1 text-[11px] text-slate-400">
              Updated {updatedLabel}
              {hasLiveTracker
                ? ` · tracker ${liveTrackedUsers} users · ${activeSessions} online`
                : ' · portal DB + sessions'}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onRefresh}
              disabled={loading}
              className="inline-flex h-10 items-center gap-2 rounded-full bg-slate-900 px-5 text-sm font-semibold text-white shadow-[0_10px_24px_-10px_rgba(15,23,42,0.55)] transition hover:bg-slate-800 disabled:opacity-50"
            >
              <RefreshCcw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </header>

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

        {/* Live portal behaviour tracker */}
        <div className="mb-5 grid grid-cols-12 gap-4">
          <Card className="col-span-12 xl:col-span-8">
            <SectionTitle
              title="Live tracking"
              info="Realtime behaviour from the portal — online users, visits, job clicks, applies, and active time."
              right={
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700 ring-1 ring-emerald-100">
                  <Radio className="h-3 w-3" />
                  {hasLiveTracker ? 'Behaviour engine' : 'Sessions fallback'}
                </span>
              }
            />
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
              {[
                {
                  label: 'Online now',
                  value: fmt(activeSessions),
                  icon: Radio,
                  color: TEAL,
                },
                {
                  label: 'Tracked users',
                  value: fmt(liveTrackedUsers),
                  icon: Users,
                  color: INDIGO,
                },
                {
                  label: 'Visits 7d',
                  value: fmt(liveVisits7d),
                  icon: Globe2,
                  color: BLUE,
                },
                {
                  label: 'Job clicks 7d',
                  value: fmt(liveJobClicks7d),
                  icon: MousePointerClick,
                  color: ORANGE,
                },
                {
                  label: 'Applies 7d',
                  value: fmt(liveApplies7d),
                  icon: ClipboardList,
                  color: PURPLE,
                },
                {
                  label: 'Active time 7d',
                  value: formatDurationMs(liveActiveMs7d || null),
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
            {!hasLiveTracker ? (
              <p className="mt-3 text-[11px] text-slate-400">
                Waiting for live behaviour heartbeats. Open the job portal while logged in so
                `/api/hq-behavior` starts receiving payloads.
              </p>
            ) : null}
          </Card>

          <Card className="col-span-12 md:col-span-6 xl:col-span-2">
            <SectionTitle title="Page mix (7d)" info="Share of portal page visits by area in the last 7 days." />
            {livePageVisits.length ? (
              <ul className="space-y-2">
                {livePageVisits.map((row) => (
                  <li key={row.name} className="flex items-center justify-between gap-2 text-xs">
                    <span className="truncate capitalize text-slate-600">{row.name.replace(/_/g, ' ')}</span>
                    <span className="font-bold tabular-nums text-slate-900">{row.value}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyChart label="No page visits yet" />
            )}
          </Card>

          <Card className="col-span-12 md:col-span-6 xl:col-span-2">
            <SectionTitle title="Live feed" info="Latest behaviour events and trigger flags from tracked users." />
            {liveFeed.length ? (
              <ul className="max-h-[180px] space-y-2 overflow-y-auto">
                {liveFeed.slice(0, 6).map((row) => (
                  <li
                    key={`${row.userId}-${row.capturedAt}`}
                    className="rounded-lg border border-slate-100 bg-slate-50/70 px-2.5 py-2 text-[11px]"
                  >
                    <p className="font-semibold text-slate-800">
                      {formatDurationMs(row.activeMs7d)} · {row.visits7d} visits
                    </p>
                    <p className="mt-0.5 truncate text-slate-500">
                      {row.topTrigger || `${row.applies7d} applies · ${row.jobCardClicks7d} clicks`}
                    </p>
                    <p className="mt-0.5 text-[10px] text-slate-400">
                      {formatClock(row.activityStateUpdatedAt || row.capturedAt)}
                    </p>
                  </li>
                ))}
              </ul>
            ) : liveTriggers.length ? (
              <ul className="space-y-2">
                {liveTriggers.map((row) => (
                  <li key={row.name} className="flex items-center justify-between gap-2 text-xs">
                    <span className="truncate text-slate-600">{row.name.replace(/_/g, ' ')}</span>
                    <span className="font-bold tabular-nums text-slate-900">{row.value}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyChart label="No live events yet" />
            )}
          </Card>
        </div>

        {/* KPI pulse — 4 hero cards only (rest live under category tabs) */}
        <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {kpis.map((item) => (
            <HqSvgKpiCard
              key={item.label}
              item={{ ...item, compareLabel: item.compareLabel || 'vs prior' }}
            />
          ))}
        </div>

        <HqDashCategoryTabs
          tabs={[...EMPLOYEE_CATEGORY_TABS]}
          value={category}
          onChange={(id) => setCategory(id as typeof category)}
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
            <SectionTitle title="Top Skills" info="Most common skills on portal candidate profiles." />
            <div className="h-[190px]">
              {skills.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={skills} layout="vertical" margin={{ top: 0, right: 8, left: 4, bottom: 0 }}>
                    <XAxis type="number" hide />
                    <YAxis type="category" dataKey="name" width={70} tick={{ fontSize: 10, fill: '#64748B' }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={tip} />
                    <Bar dataKey="value" fill={PURPLE} radius={[0, 8, 8, 0]} barSize={11} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <EmptyChart />
              )}
            </div>
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
                  {mapPoints(c?.loginsDaily).length ? (
                    <ResponsiveContainer width="100%" height={180}>
                      <AreaChart data={mapPoints(c?.loginsDaily)} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
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

            {/* Behaviour engine — premium, entry points, interests */}
            <Card className="col-span-12 !p-4 lg:col-span-5">
              <SectionTitle
                title="Premium services usage"
                info="How often premium / paid portal services are opened."
                right={
                  <span className="rounded-lg border border-slate-200 px-2 py-0.5 text-[10px] font-medium text-slate-500">
                    7d · most → least
                  </span>
                }
              />
              <p className="mb-3 text-[10px] text-slate-400">
                Services / subscriptions, AI CV, interview prep, courses & LMS
                {liveTracking?.premiumVisits7d
                  ? ` · ${fmt(liveTracking.premiumVisits7d)} premium-surface visits`
                  : ''}
              </p>
              <RankedUsageList
                rows={premiumServicesRanked}
                emptyLabel="No premium service visits yet"
                valueSuffix="visits"
              />
            </Card>

            <Card className="col-span-12 !p-4 lg:col-span-4">
              <SectionTitle
                title="Popular features"
                info="Most-used portal features from live tracking and history."
                right={
                  <span className="rounded-lg border border-slate-200 px-2 py-0.5 text-[10px] font-medium text-slate-500">
                    Most → least
                  </span>
                }
              />
              <p className="mb-3 text-[10px] text-slate-400">
                {liveTriggers.length || livePageVisits.length || featureUsageRanked.length
                  ? 'Behaviour triggers + page mix from the live tracker'
                  : 'From portal KPIs until tracker events fill in'}
              </p>
              <RankedUsageList
                rows={featureUsageRanked}
                emptyLabel="No feature usage signals yet"
              />
            </Card>

            <Card className="col-span-12 !p-4 lg:col-span-3">
              <SectionTitle title="Highlights" info="Key engagement highlights from live tracking." />
              <div className="space-y-3">
                <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 px-3 py-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-700/80">
                    Top premium
                  </p>
                  {premiumMost ? (
                    <>
                      <p className="mt-1 truncate text-sm font-bold text-slate-900">{premiumMost.name}</p>
                      <p className="mt-0.5 text-[11px] text-slate-500">
                        <strong className="text-emerald-700">{fmt(premiumMost.value)}</strong> visits
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
                info="First pages users open when they start a session."
                right={
                  <span className="rounded-lg border border-slate-200 px-2 py-0.5 text-[10px] font-medium text-slate-500">
                    First open
                  </span>
                }
              />
              <p className="mb-3 text-[10px] text-slate-400">
                Where candidates land first (e.g. Services → login) — from behaviour first-open
              </p>
              <RankedUsageList
                rows={entryPointsRanked}
                emptyLabel="No first-open entry data yet"
                valueSuffix="days"
              />
            </Card>

            <Card className="col-span-12 !p-4 lg:col-span-4">
              <SectionTitle title="Community & chat" info="Office Gossips and chat engagement signals." />
              <p className="mb-3 text-[10px] text-slate-400">
                Office Gossip, chat, reference check
                {liveTracking?.communityVisits7d
                  ? ` · ${fmt(liveTracking.communityVisits7d)} community visits`
                  : ''}
              </p>
              <RankedUsageList
                rows={communityRanked}
                emptyLabel="No community / gossip / chat signals yet"
              />
            </Card>

            <Card className="col-span-12 !p-4 lg:col-span-4">
              <SectionTitle title="Top interests" info="Multi-interest scores from portal behaviour." />
              <p className="mb-3 text-[10px] text-slate-400">
                Affinity engine topics among candidates (score strength)
              </p>
              <RankedUsageList
                rows={topInterestsRanked}
                emptyLabel="No interest topics yet — needs OG / behaviour heartbeats"
              />
            </Card>

            <Card className="col-span-12 !p-4 lg:col-span-6">
              <SectionTitle
                title="Trending topics"
                info="Rising interest topics from portal behaviour."
                right={
                  <span className="rounded-lg border border-slate-200 px-2 py-0.5 text-[10px] font-medium text-slate-500">
                    Interests · roles · companies
                  </span>
                }
              />
              <p className="mb-3 text-[10px] text-slate-400">
                What candidates are leaning into across the portal
              </p>
              <RankedUsageList
                rows={trendingTopicsRanked}
                emptyLabel="No trending topics yet"
              />
            </Card>

            <Card className="col-span-12 !p-4 lg:col-span-6">
              <SectionTitle title="Page mix (7d)" info="Share of portal page visits by area in the last 7 days." />
              <p className="mb-3 text-[10px] text-slate-400">Full category attention mix</p>
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

            {/* Row 2 — Recent Sessions (wide) + State/Region */}
            <Card className="col-span-12 flex min-h-[260px] flex-col overflow-hidden !p-0 lg:col-span-9">
              <div className="border-b border-slate-100 px-4 py-2.5">
                <div className="flex items-center gap-2">
                  <span className="h-4 w-1 shrink-0 rounded-full bg-gradient-to-b from-indigo-500 to-teal-400" />
                  <h3 className="text-sm font-semibold text-slate-800">Recent Sessions</h3>
                </div>
                <p className="mt-0.5 pl-3 text-[11px] text-slate-400">
                  Login · logout · duration · device · location
                </p>
              </div>
              <div className="max-h-[320px] flex-1 overflow-auto">
                {recentSessions.length ? (
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
                      {recentSessions.slice(0, 10).map((row, idx) => (
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
                            {row.durationMs > 0 ? formatDurationMs(row.durationMs) : '—'}
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
                    <EmptyChart label="No session rows yet — log in on the portal to populate" />
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

        {/* FOOTER */}
        <div className="hq-dash-card flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/80 bg-white/75 px-5 py-3.5 text-xs text-slate-500 shadow-[0_18px_48px_-24px_rgba(15,23,42,0.14)] backdrop-blur-xl">
          <div className="flex items-center gap-2">
            <span>
              Last updated: <strong className="text-slate-700">{updatedLabel}</strong>
              {apps30d > 0 ? <span className="ml-2 text-slate-400">· {fmt(apps30d)} apps in 30d</span> : null}
            </span>
            <button
              type="button"
              onClick={onRefresh}
              disabled={loading}
              className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-50"
              title="Refresh"
            >
              <RefreshCcw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
          <div className="inline-flex items-center gap-1.5">
            <span className={`h-1.5 w-1.5 rounded-full ${isLive ? 'bg-emerald-500' : 'bg-amber-500'}`} />
            {isLive
              ? 'Live portal data · auto-refreshes every 15s'
              : 'Waiting for portal analytics response'}
          </div>
        </div>
      </div>
    </div>
  );
}
