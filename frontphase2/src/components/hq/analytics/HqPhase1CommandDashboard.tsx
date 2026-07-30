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
  Bell,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  Clock3,
  Download,
  Globe2,
  Info,
  LogIn,
  MapPin,
  MonitorSmartphone,
  RefreshCcw,
  Trophy,
  Upload,
  UserPlus,
} from 'lucide-react';
import type { HqEmployeeAnalytics } from '@/lib/api';
import { HQ_SVG_ASSETS, HqSvgKpiCard } from './HqSvgKpiCard';
import { HqPhase1ConnectionBar } from '../HqPhase1ConnectionBar';

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
  if (!baseline) return recent > 0 ? 100 : 0;
  return Math.round(((recent / baseline) * 1000) / 10);
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
    <div className="flex h-full min-h-[120px] items-center justify-center text-xs text-slate-400">
      {label}
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
      whileHover={{ y: -1 }}
      transition={{ duration: 0.15 }}
      className={`rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] ${className}`}
    >
      {children}
    </motion.div>
  );
}

function SectionTitle({
  title,
  right,
}: {
  title: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
      {right}
    </div>
  );
}

const tip = {
  borderRadius: 10,
  border: '1px solid #e2e8f0',
  fontSize: 12,
  boxShadow: '0 8px 24px rgba(15,23,42,0.08)',
};

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
  const isLive = Boolean(data?.live ?? data?.available);
  const [appRange, setAppRange] = useState<'Daily' | 'Weekly' | 'Monthly'>('Monthly');
  const [candRange, setCandRange] = useState<'Daily' | 'Monthly'>('Monthly');

  const totalCandidates = num(k?.totalCandidates);
  const newCandidates = num(k?.new30d ?? k?.new7d);
  const activeJobs = num(k?.openJobs);
  const applications = num(k?.applications);
  const activeApplications = num(k?.activeApplications);
  const interviewReqs = num(k?.interviewRequests);
  const matchAvg = k?.avgMatchScore != null ? Math.round(Number(k.avgMatchScore)) : null;
  const profilePct = k?.profileCompleteness != null ? Math.round(Number(k.profileCompleteness)) : null;
  const totalResumes = num(k?.cvAnalyses);
  const aiMatches = num(k?.aiMatches);
  const selected = num(k?.selectedApplications);
  const placements = selected;
  const atsScore = k?.avgAtsScore != null ? Math.round(Number(k.avgAtsScore)) : null;
  const cvScore = k?.avgCvScore != null ? Math.round(Number(k.avgCvScore)) : null;
  const apps7d = num(k?.applications7d);
  const apps30d = num(k?.applications30d);
  const new7d = num(k?.new7d);
  const jobsToday = num(k?.jobsPostedToday);
  const jobsWeek = num(k?.jobsPosted7d);
  const jobsMonth = num(k?.jobsPosted30d);

  const candGrowth = growthPct(new7d, Math.max(totalCandidates - new7d, 1));
  const newGrowth = growthPct(num(k?.new1d), Math.max(new7d, 1));
  const appGrowth = growthPct(apps7d, Math.max(applications - apps7d, 1));
  const activeAppGrowth = growthPct(apps7d, Math.max(activeApplications, 1));
  const interviewGrowth = growthPct(num(k?.interviewPending), Math.max(interviewReqs, 1));

  const kpis = [
    {
      label: 'Total Candidates',
      value: totalCandidates,
      growth: candGrowth,
      iconSrc: HQ_SVG_ASSETS.totalCandidates.icon,
      sparkSrc: HQ_SVG_ASSETS.totalCandidates.spark,
    },
    {
      label: 'New Candidates',
      value: newCandidates,
      growth: newGrowth,
      iconSrc: HQ_SVG_ASSETS.newCandidates.icon,
      sparkSrc: HQ_SVG_ASSETS.newCandidates.spark,
    },
    {
      label: 'Open Jobs',
      value: activeJobs,
      growth: growthPct(jobsWeek, Math.max(activeJobs, 1)),
      iconSrc: HQ_SVG_ASSETS.openJobs.icon,
      sparkSrc: HQ_SVG_ASSETS.openJobs.spark,
    },
    {
      label: 'Applications',
      value: applications,
      growth: appGrowth,
      iconSrc: HQ_SVG_ASSETS.applications.icon,
      sparkSrc: HQ_SVG_ASSETS.applications.spark,
    },
    {
      label: 'Active Applications',
      value: activeApplications,
      growth: activeAppGrowth,
      iconSrc: HQ_SVG_ASSETS.activeApplications.icon,
      sparkSrc: HQ_SVG_ASSETS.activeApplications.spark,
    },
    {
      label: 'Interview Requests',
      value: interviewReqs,
      growth: interviewGrowth,
      iconSrc: HQ_SVG_ASSETS.interviewRequests.icon,
      sparkSrc: HQ_SVG_ASSETS.interviewRequests.spark,
    },
    {
      label: 'Avg Match Score',
      value: matchAvg == null ? '—' : `${matchAvg}%`,
      growth: matchAvg == null ? 0 : Math.max(0, Math.round(matchAvg - 50)),
      iconSrc: HQ_SVG_ASSETS.avgMatchScore.icon,
      sparkSrc: HQ_SVG_ASSETS.avgMatchScore.spark,
    },
    {
      label: 'Profile Completeness',
      value: profilePct == null ? '—' : `${profilePct}%`,
      growth: profilePct == null ? 0 : Math.max(0, Math.round(profilePct - 50)),
      iconSrc: HQ_SVG_ASSETS.profileCompleteness.icon,
      sparkSrc: HQ_SVG_ASSETS.profileCompleteness.spark,
    },
  ];

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

  const funnel = useMemo(() => {
    const byStatus = mapPoints(c?.applicationsByStatus);
    const shortlisted =
      byStatus.find((d) => /shortlist/i.test(d.name))?.value ??
      Math.min(aiMatches || applications, applications);
    const interviewStage =
      byStatus.find((d) => /interview/i.test(d.name))?.value ?? interviewReqs;
    return [
      { name: 'Jobs Published', value: activeJobs },
      { name: 'Applications', value: applications },
      { name: 'AI Shortlisted', value: aiMatches || shortlisted },
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
  const activeSessions = num(k?.activeSessions);
  const avgSessionMs = k?.avgSessionDurationMs ?? null;

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
    { label: 'Registration', value: totalCandidates, growth: candGrowth, icon: UserPlus, color: INDIGO },
    { label: 'Resume Upload', value: totalResumes, growth: growthPct(totalResumes, Math.max(totalCandidates, 1)), icon: Upload, color: BLUE },
    {
      label: 'Profile Complete',
      value: profilePct == null ? 0 : Math.round(totalCandidates * (profilePct / 100)),
      growth: profilePct ?? 0,
      icon: CheckCircle2,
      color: TEAL,
    },
    { label: 'Application', value: applications, growth: appGrowth, icon: ClipboardList, color: ORANGE },
    { label: 'Interview', value: interviewReqs, growth: interviewGrowth, icon: Calendar, color: PURPLE },
    { label: 'Offer', value: selected, growth: growthPct(selected, Math.max(applications, 1)), icon: Award, color: GOLD },
    { label: 'Joined', value: placements, growth: growthPct(placements, Math.max(selected, 1)), icon: Trophy, color: GREEN },
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

  const rangeLabel = useMemo(() => {
    const end = generatedAt ? new Date(generatedAt) : new Date();
    const start = new Date(end);
    start.setDate(start.getDate() - 29);
    const fmtDate = (d: Date) =>
      d.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
    return `${fmtDate(start)} - ${fmtDate(end)}`;
  }, [generatedAt]);

  const maxFunnel = Math.max(...funnel.map((f) => f.value), 1);

  return (
    <div className="min-h-full bg-[#F8FAFC] font-[Inter,ui-sans-serif,system-ui,sans-serif] text-slate-900">
      <div className="mx-auto w-full max-w-[1800px] px-5 py-5 xl:px-7">
        {/* HEADER */}
        <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-[28px] font-bold tracking-tight text-slate-900">Phase 1 Dashboard</h1>
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                  isLive ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200' : 'bg-amber-50 text-amber-700 ring-1 ring-amber-200'
                }`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${isLive ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                {isLive ? 'Live Phase 1' : 'Waiting for data'}
              </span>
            </div>
            <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-500">
              Talent Platform Overview · connected to Phase 1 portal backend
              <Info className="h-3.5 w-3.5 text-slate-400" />
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 shadow-sm"
            >
              <Calendar className="h-4 w-4 text-slate-400" />
              {rangeLabel}
              <ChevronDown className="h-4 w-4 text-slate-400" />
            </button>
            <button
              type="button"
              onClick={onRefresh}
              disabled={loading}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 shadow-sm disabled:opacity-50"
            >
              <RefreshCcw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button
              type="button"
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 shadow-sm"
            >
              <Download className="h-4 w-4" />
              Export
            </button>
            <button
              type="button"
              className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 shadow-sm"
            >
              <Bell className="h-4 w-4" />
              <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white" />
            </button>
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-xs font-bold text-white shadow-sm">
              SA
            </div>
          </div>
        </div>

        <HqPhase1ConnectionBar
          live={isLive}
          generatedAt={generatedAt}
          candidateCount={totalCandidates}
          sessionLogins7d={logins7d}
          onRefresh={onRefresh}
          loading={loading}
        />

        {insights.length > 0 ? (
          <div className="mb-5 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {insights.slice(0, 3).map((insight, i) => (
              <div
                key={`${insight.text}-${i}`}
                className={`rounded-xl border px-3.5 py-2.5 text-xs leading-relaxed ${
                  insight.tone === 'good'
                    ? 'border-emerald-200 bg-emerald-50/70 text-emerald-800'
                    : insight.tone === 'warn'
                      ? 'border-amber-200 bg-amber-50/70 text-amber-800'
                      : 'border-slate-200 bg-white text-slate-600'
                }`}
              >
                {insight.text}
              </div>
            ))}
          </div>
        ) : null}

        {/* ROW 1 — 8 KPIs using real /public/svgs icons + sparkline charts */}
        <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-8">
          {kpis.map((item) => (
            <HqSvgKpiCard key={item.label} item={{ ...item, compareLabel: 'vs prior' }} />
          ))}
        </div>

        {/* ROW 2 — Charts + Funnel */}
        <div className="mb-5 grid grid-cols-12 gap-4">
          <Card className="col-span-12 lg:col-span-5">
            <SectionTitle
              title="Candidates Joined Over Time"
              right={
                <div className="flex rounded-lg border border-slate-200 p-0.5 text-[10px] font-semibold">
                  {(['Daily', 'Monthly'] as const).map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setCandRange(opt)}
                      className={`rounded-md px-2 py-1 transition ${
                        candRange === opt ? 'bg-indigo-50 text-indigo-700' : 'text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              }
            />
            <div className="h-[250px]">
              {candidatesOverTime.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={candidatesOverTime} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="candFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={PURPLE} stopOpacity={0.28} />
                        <stop offset="100%" stopColor={PURPLE} stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} width={40} />
                    <Tooltip contentStyle={tip} />
                    <Area type="monotone" dataKey="value" stroke={PURPLE} fill="url(#candFill)" strokeWidth={2.4} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <EmptyChart label="No candidate timeline from Phase 1 yet" />
              )}
            </div>
          </Card>

          <Card className="col-span-12 lg:col-span-3">
            <SectionTitle title="Hiring Funnel" />
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
                        className="flex h-8 items-center justify-center rounded-md text-[10px] font-bold text-white shadow-sm"
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
              right={
                <div className="flex rounded-lg border border-slate-200 p-0.5 text-[10px] font-semibold">
                  {(['Daily', 'Weekly', 'Monthly'] as const).map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setAppRange(opt)}
                      className={`rounded-md px-2 py-1 transition ${
                        appRange === opt ? 'bg-indigo-50 text-indigo-700' : 'text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              }
            />
            <div className="h-[250px]">
              {applicationsOverTime.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={applicationsOverTime} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="appFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={INDIGO} stopOpacity={0.28} />
                        <stop offset="100%" stopColor={INDIGO} stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} width={40} />
                    <Tooltip contentStyle={tip} />
                    <Area type="monotone" dataKey="value" stroke={INDIGO} fill="url(#appFill)" strokeWidth={2.4} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <EmptyChart label="No application timeline from Phase 1 yet" />
              )}
            </div>
          </Card>
        </div>

        {/* ROW 3 — Distributions */}
        <div className="mb-5 grid grid-cols-12 gap-4">
          <Card className="col-span-12 md:col-span-6 xl:col-span-3">
            <SectionTitle title="Candidates by Source" />
            {sources.length ? (
              <div className="flex items-center gap-3">
                <div className="h-[170px] w-[170px] shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={sources} dataKey="value" nameKey="name" innerRadius={48} outerRadius={72} paddingAngle={2}>
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
                        <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: SOURCE_COLORS[i % SOURCE_COLORS.length] }} />
                        {s.name}
                      </span>
                      <span className="shrink-0 font-semibold text-slate-800">{s.pct}%</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <EmptyChart />
            )}
          </Card>

          <Card className="col-span-12 md:col-span-6 xl:col-span-2">
            <SectionTitle title="Top Skills" />
            <div className="h-[190px]">
              {skills.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={skills} layout="vertical" margin={{ top: 0, right: 8, left: 4, bottom: 0 }}>
                    <XAxis type="number" hide />
                    <YAxis type="category" dataKey="name" width={70} tick={{ fontSize: 10, fill: '#64748B' }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={tip} />
                    <Bar dataKey="value" fill={PURPLE} radius={[0, 6, 6, 0]} barSize={12} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <EmptyChart />
              )}
            </div>
          </Card>

          <Card className="col-span-12 md:col-span-6 xl:col-span-2">
            <SectionTitle title="Experience Distribution" />
            <div className="h-[190px]">
              {experience.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={experience} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#94A3B8' }} axisLine={false} tickLine={false} interval={0} />
                    <YAxis tick={{ fontSize: 10, fill: '#94A3B8' }} axisLine={false} tickLine={false} width={28} />
                    <Tooltip contentStyle={tip} />
                    <Bar dataKey="value" radius={[6, 6, 0, 0]} barSize={18}>
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
            <SectionTitle title="Top Candidate Locations" />
            {locations.length ? (
              <div className="flex gap-3">
                <div className="relative flex h-[150px] w-[120px] shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-50 ring-1 ring-slate-100">
                  <svg viewBox="0 0 120 150" className="h-full w-full opacity-80">
                    <path
                      d="M58 18c8 2 18 8 24 18 6 10 10 14 14 24 4 10 2 18-2 26-4 8-10 16-12 24-2 8 0 16 2 22-8 2-16 0-24-4-8-4-14-8-20-6-6 2-12 8-18 6-4-10-2-20 2-28 4-8 8-14 8-22 0-8-4-16-2-24 6-8 16-14 28-16z"
                      fill="#E2E8F0"
                      stroke="#CBD5E1"
                      strokeWidth="1.5"
                    />
                    {locations.slice(0, 6).map((_, i) => {
                      const pts = [
                        [52, 55],
                        [48, 70],
                        [62, 48],
                        [70, 78],
                        [58, 90],
                        [55, 105],
                      ] as const;
                      const [cx, cy] = pts[i];
                      return (
                        <circle key={i} cx={cx} cy={cy} r={4} fill={PURPLE} opacity={0.85}>
                          <animate attributeName="r" values="3;5;3" dur={`${1.6 + i * 0.2}s`} repeatCount="indefinite" />
                        </circle>
                      );
                    })}
                  </svg>
                </div>
                <div className="min-w-0 flex-1 space-y-2">
                  {locations.map((loc) => (
                    <div key={loc.name} className="flex items-center justify-between text-[11px]">
                      <span className="flex items-center gap-1.5 text-slate-600">
                        <MapPin className="h-3 w-3 text-violet-500" />
                        {loc.name}
                      </span>
                      <span className="font-semibold text-slate-800">{fmt(loc.value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <EmptyChart />
            )}
          </Card>

          <Card className="col-span-12 xl:col-span-2">
            <SectionTitle title="AI Analytics Overview" />
            <div className="grid grid-cols-2 gap-2.5">
              {[
                { label: 'Avg ATS Score', value: atsScore, suffix: '%', color: INDIGO, spark: aiSparks[0] },
                { label: 'Avg Match %', value: matchAvg, suffix: '%', color: PURPLE, spark: aiSparks[1] },
                { label: 'Avg Resume Score', value: cvScore, suffix: '%', color: TEAL, spark: aiSparks[2] },
                { label: 'Profile Completeness', value: profilePct, suffix: '%', color: ORANGE, spark: aiSparks[3] },
              ].map((m) => (
                <div key={m.label} className="rounded-xl border border-slate-100 bg-slate-50/70 p-2.5">
                  <p className="text-[9px] font-semibold uppercase tracking-wide text-slate-400 leading-tight">{m.label}</p>
                  <p className="mt-1 text-lg font-bold" style={{ color: m.color }}>
                    {m.value == null ? '—' : `${m.value}${m.suffix}`}
                  </p>
                  <MiniSpark data={m.spark} color={m.color} height={22} />
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* ROW 4 */}
        <div className="mb-5 grid grid-cols-12 gap-4">
          <Card className="col-span-12 md:col-span-4 xl:col-span-3">
            <SectionTitle title="Interview Status" />
            {interviewStatus.length ? (
              <div className="flex items-center gap-3">
                <div className="h-[170px] w-[170px] shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={interviewStatus} dataKey="value" nameKey="name" innerRadius={48} outerRadius={72} paddingAngle={2}>
                        {interviewStatus.map((_, i) => (
                          <Cell key={i} fill={INTERVIEW_COLORS[i % INTERVIEW_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={tip} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="min-w-0 flex-1 space-y-1.5">
                  {interviewStatus.map((s, i) => (
                    <div key={s.name} className="flex items-center justify-between gap-2 text-[11px]">
                      <span className="flex items-center gap-1.5 text-slate-600">
                        <span className="h-2 w-2 rounded-full" style={{ background: INTERVIEW_COLORS[i % INTERVIEW_COLORS.length] }} />
                        {s.name}
                      </span>
                      <span className="font-semibold text-slate-800">{s.pct}%</span>
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
            <SectionTitle title="Candidate Journey" />
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
                    <p className="mt-0.5 text-[10px] font-semibold text-emerald-600">▲ {step.growth}%</p>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>

        {/* ROW 5 — Bottom */}
        <div className="mb-4 grid grid-cols-12 gap-4">
          <Card className="col-span-12 md:col-span-4 lg:col-span-3">
            <SectionTitle title="Recently Posted Jobs" />
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
            <SectionTitle title="Job Status Mix" />
            {categories.length ? (
              <>
                <div className="mb-3 flex h-3 overflow-hidden rounded-full">
                  {categories.map((cat, i) => (
                    <div key={cat.name} style={{ width: `${cat.pct}%`, background: CATEGORY_COLORS[i % CATEGORY_COLORS.length] }} />
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
            <p className="text-[11px] font-medium text-slate-500">Application Rate</p>
            <div className="mt-2 flex items-end justify-between gap-2">
              <div>
                <p className="text-2xl font-bold text-indigo-600">{appRate}%</p>
                <p className="mt-1 text-[11px] text-slate-400">apps / candidates</p>
              </div>
              <div className="w-16">
                <MiniSpark data={appRateSpark} color={INDIGO} />
              </div>
            </div>
          </Card>

          <Card className="col-span-6 lg:col-span-2">
            <p className="text-[11px] font-medium text-slate-500">Offer Rate</p>
            <div className="mt-2 flex items-end justify-between gap-2">
              <div>
                <p className="text-2xl font-bold text-violet-600">{offerRate}%</p>
                <p className="mt-1 text-[11px] text-slate-400">selected / apps · 7d {fmt(apps7d)}</p>
              </div>
              <div className="w-16">
                <MiniSpark data={offerSpark} color={PURPLE} />
              </div>
            </div>
          </Card>
        </div>

        {/* ROW 6 — Login / session / geo analytics */}
        <div className="mb-4 grid grid-cols-12 gap-4">
          <Card className="col-span-12 xl:col-span-3">
            <SectionTitle title="Session Overview" />
            <div className="grid grid-cols-2 gap-2.5">
              {[
                { label: 'Logins today', value: fmt(loginsToday), icon: LogIn, color: INDIGO },
                { label: 'Logins 7d', value: fmt(logins7d), icon: Calendar, color: PURPLE },
                { label: 'Active now', value: fmt(activeSessions), icon: MonitorSmartphone, color: TEAL },
                { label: 'Avg duration', value: formatDurationMs(avgSessionMs), icon: Clock3, color: ORANGE },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.label} className="rounded-xl border border-slate-100 bg-slate-50/70 p-3">
                    <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                      <Icon className="h-3 w-3" style={{ color: item.color }} />
                      {item.label}
                    </div>
                    <p className="mt-1.5 text-xl font-bold text-slate-900">{item.value}</p>
                  </div>
                );
              })}
            </div>
            <div className="mt-3 h-[110px]">
              {mapPoints(c?.loginsDaily).length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={mapPoints(c?.loginsDaily)} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="loginFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={TEAL} stopOpacity={0.28} />
                        <stop offset="100%" stopColor={TEAL} stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={tip} />
                    <Area type="monotone" dataKey="value" stroke={TEAL} fill="url(#loginFill)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <EmptyChart label="No login timeline yet" />
              )}
            </div>
          </Card>

          <Card className="col-span-12 md:col-span-6 xl:col-span-3">
            <SectionTitle title="Logins by Country" />
            {loginsByCountry.length ? (
              <div className="flex items-center gap-3">
                <div className="h-[170px] w-[150px] shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={loginsByCountry} dataKey="value" nameKey="name" innerRadius={42} outerRadius={66} paddingAngle={2}>
                        {loginsByCountry.map((_, i) => (
                          <Cell key={i} fill={SOURCE_COLORS[i % SOURCE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={tip} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="min-w-0 flex-1 space-y-1.5">
                  {loginsByCountry.map((s, i) => (
                    <div key={s.name} className="flex items-center justify-between gap-2 text-[11px]">
                      <span className="flex min-w-0 items-center gap-1.5 truncate text-slate-600">
                        <Globe2 className="h-3 w-3 shrink-0 text-indigo-500" />
                        <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: SOURCE_COLORS[i % SOURCE_COLORS.length] }} />
                        {s.name}
                      </span>
                      <span className="shrink-0 font-semibold text-slate-800">{s.pct}%</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <EmptyChart label="No country login data yet" />
            )}
          </Card>

          <Card className="col-span-12 md:col-span-6 xl:col-span-2">
            <SectionTitle title="By State / Region" />
            <div className="space-y-2">
              {loginsByState.length ? (
                loginsByState.map((row) => (
                  <div key={row.name} className="flex items-center justify-between text-[11px]">
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
                    <div key={row.name} className="flex items-center justify-between text-[11px]">
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

          <Card className="col-span-12 xl:col-span-4 !p-0 overflow-hidden">
            <div className="border-b border-slate-100 px-5 py-4">
              <h3 className="text-sm font-semibold text-slate-800">Recent Sessions</h3>
              <p className="mt-0.5 text-[11px] text-slate-400">Login · logout · duration · device · location</p>
            </div>
            <div className="overflow-x-auto">
              {recentSessions.length ? (
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/70 text-[10px] uppercase tracking-wider text-slate-400">
                      <th className="px-4 py-2.5 font-semibold">User</th>
                      <th className="px-3 py-2.5 font-semibold">Login</th>
                      <th className="px-3 py-2.5 font-semibold">Logout</th>
                      <th className="px-3 py-2.5 font-semibold">Duration</th>
                      <th className="px-3 py-2.5 font-semibold">Device</th>
                      <th className="px-4 py-2.5 font-semibold">Location</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentSessions.slice(0, 8).map((row, idx) => (
                      <tr key={`${row.candidateId}-${row.loginAt}-${idx}`} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60">
                        <td className="px-4 py-2.5">
                          <div className="font-semibold text-slate-900">{row.candidate}</div>
                          <div className="text-[10px] text-slate-400">
                            {row.isActive ? (
                              <span className="font-semibold text-emerald-600">Active</span>
                            ) : (
                              'Closed'
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-[11px] text-slate-600">{formatClock(row.loginAt)}</td>
                        <td className="px-3 py-2.5 text-[11px] text-slate-600">{formatClock(row.logoutAt)}</td>
                        <td className="px-3 py-2.5 text-[11px] font-semibold text-slate-800">{formatDurationMs(row.durationMs)}</td>
                        <td className="px-3 py-2.5 text-[11px] text-slate-600">
                          <div className="font-medium capitalize">{row.deviceType}</div>
                          <div className="text-[10px] text-slate-400">{row.browser} · {row.operatingSystem}</div>
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
                  <EmptyChart label="No session rows yet — log in on Phase 1 to populate" />
                </div>
              )}
            </div>
            {loginsByDevice.length ? (
              <div className="flex flex-wrap gap-3 border-t border-slate-100 px-5 py-3">
                {loginsByDevice.map((d, i) => (
                  <span key={d.name} className="inline-flex items-center gap-1.5 text-[11px] text-slate-600">
                    <span className="h-2 w-2 rounded-full" style={{ background: SOURCE_COLORS[i % SOURCE_COLORS.length] }} />
                    <span className="capitalize">{d.name}</span>
                    <span className="font-semibold text-slate-800">{d.pct}%</span>
                  </span>
                ))}
              </div>
            ) : null}
          </Card>
        </div>

        {/* FOOTER */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200/80 bg-white px-5 py-3 text-xs text-slate-500 shadow-sm">
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
              ? 'Live Phase 1 data · auto-refreshes every 45s'
              : 'Waiting for Phase 1 analytics response'}
          </div>
        </div>
      </div>
    </div>
  );
}
