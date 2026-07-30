'use client';

import { useMemo } from 'react';
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
import type { HqEmployerAnalytics } from '@/lib/api';
import { HQ_SVG_ASSETS, HqSvgKpiCard } from './HqSvgKpiCard';
import {
  HqPhase2ActivityFeed,
  HqPhase2Card as Card,
  HqPhase2Footer,
  HqPhase2HealthGauge as HealthGauge,
  HqPhase2PageHeader,
  HqPhase2QuickActions,
  HqPhase2SystemHealth,
  HqPhase2Title as Title,
} from './HqPhase2DashboardParts';

const INDIGO = '#4F46E5';
const PURPLE = '#7C3AED';
const SUCCESS = '#22C55E';
const WARNING = '#F59E0B';
const DANGER = '#EF4444';
const TEAL = '#14B8A6';
const BLUE = '#3B82F6';
const ORANGE = '#F97316';

const TENANT_COLORS = [INDIGO, PURPLE, TEAL, WARNING, '#64748B'];
const USAGE_COLORS = [INDIGO, PURPLE, TEAL, ORANGE, BLUE, '#94A3B8'];
const DEMO_COLORS = [WARNING, INDIGO, SUCCESS, PURPLE, DANGER];
const FUNNEL_COLORS = [INDIGO, PURPLE, '#A855F7', ORANGE, SUCCESS, TEAL];
const PLAN_COLORS = [INDIGO, PURPLE, TEAL, ORANGE, BLUE];
const HIRE_COLORS = [INDIGO, PURPLE, TEAL, WARNING, SUCCESS];
const STAGE_COLORS = [INDIGO, BLUE, PURPLE, WARNING, SUCCESS, DANGER];

type Props = {
  data: HqEmployerAnalytics | null;
  generatedAt?: string | null;
  durationMs?: number | null;
  loading?: boolean;
  onRefresh?: () => void;
};

function num(n: number | null | undefined) {
  return Number(n) || 0;
}

function fmt(n: number | null | undefined) {
  if (n == null || Number.isNaN(Number(n))) return '—';
  return Number(n).toLocaleString();
}

function money(n: number) {
  if (!Number.isFinite(n) || n <= 0) return '—';
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${Math.round(n).toLocaleString()}`;
  return `$${Math.round(n)}`;
}

function pct(part: number, whole: number) {
  if (!whole) return 0;
  return Math.round((part / whole) * 1000) / 10;
}

function mapPoints(rows?: Array<{ name: string; value: number }> | null) {
  if (!rows?.length) return [] as { name: string; value: number }[];
  return rows.map((d) => ({ name: String(d.name), value: Number(d.value) || 0 }));
}

function seriesToSpark(rows: { value: number }[]) {
  if (!rows.length) return [{ i: 0, v: 0 }];
  return rows.slice(-10).map((d, i) => ({ i, v: Number(d.value) || 0 }));
}

function formatWhen(iso?: string | null) {
  if (!iso) return 'just now';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'just now';
  const mins = Math.max(0, Math.round((Date.now() - d.getTime()) / 60000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
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

export function HqPhase2CommandDashboard({
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

  const companies = num(k?.hqCompanies);
  const tenants = num(k?.tenants);
  const trials = num(k?.landingTrials ?? k?.demosTrials);
  const paid = num(k?.onPlan);
  const demos =
    num(k?.demosVerified) + num(k?.demosPurchases) + num(k?.demosTrials);
  const activeJobs = num(k?.openJobs);
  const applications = num(k?.applications);
  const interviews = num(k?.interviews);
  const placements = num(k?.placements);
  const placementsJoined = num(k?.placementsJoined);
  const candidates = num(k?.candidates);
  const pipelineValue = num(k?.pipelineValue);
  const hqLeads = num(k?.hqLeads);
  const hotLeads = num(k?.hotLeads);
  const paused = num(k?.paused);
  const activeTenants = Math.max(0, tenants - paused);
  const apps7d = num(k?.applications7d);
  const candidates7d = num(k?.candidates7d);

  const tenantActivity = useMemo(() => mapPoints(c?.tenantActivity), [c]);
  const hiringFunnelLive = useMemo(() => {
    const fromApi = mapPoints(c?.hiringFunnel);
    if (fromApi.length) {
      const max = Math.max(...fromApi.map((d) => d.value), 1);
      return fromApi.map((d, i) => ({
        name: d.name,
        value: d.value,
        rate: i === 0 ? 100 : pct(d.value, fromApi[0]?.value || max),
      }));
    }
    const steps = [
      { name: 'Jobs', value: num(k?.jobs) || activeJobs },
      { name: 'Applications', value: applications },
      { name: 'Interviews', value: interviews },
      { name: 'Placements', value: placements },
      { name: 'Joined', value: placementsJoined },
    ];
    const base = Math.max(steps[0]?.value || 1, 1);
    return steps.map((s, i) => ({ ...s, rate: i === 0 ? 100 : pct(s.value, base) }));
  }, [c, k, activeJobs, applications, interviews, placements, placementsJoined]);

  const maxHire = Math.max(...hiringFunnelLive.map((h) => h.value), 1);

  const pipelineStages = useMemo(() => {
    const stages = mapPoints(c?.leadsByStage);
    if (stages.length) {
      return stages.slice(0, 6).map((s, i) => ({
        name: s.name,
        value: s.value,
        color: STAGE_COLORS[i % STAGE_COLORS.length],
      }));
    }
    return hqLeads
      ? [{ name: 'All leads', value: hqLeads, color: INDIGO }]
      : [];
  }, [c, hqLeads]);

  const tenantDist = useMemo(() => {
    const byType = mapPoints(c?.tenantsByType);
    if (byType.length) {
      const rows = [...byType];
      if (paused > 0 && !rows.some((r) => /pause/i.test(r.name))) {
        rows.push({ name: 'Paused', value: paused });
      }
      return rows;
    }
    return [
      { name: 'Agency', value: num(k?.agency) },
      { name: 'Standalone', value: num(k?.standalone) },
      { name: 'Paused', value: paused },
    ].filter((r) => r.value > 0);
  }, [c, k, paused]);

  const plans = useMemo(() => mapPoints(c?.tenantsByPlan), [c]);

  const platformUsage = useMemo(() => {
    const rows = [
      { name: 'Jobs', value: num(k?.jobs) || activeJobs },
      { name: 'Candidates', value: candidates },
      { name: 'Applications', value: applications },
      { name: 'Interviews', value: interviews },
      { name: 'CRM Leads', value: hqLeads + num(k?.tenantLeads) },
      { name: 'Clients', value: num(k?.clients) },
    ].filter((r) => r.value > 0);
    const total = rows.reduce((s, r) => s + r.value, 0) || 1;
    return rows.map((r) => ({
      name: r.name,
      value: Math.round((r.value / total) * 1000) / 10,
      count: r.value,
    }));
  }, [k, activeJobs, candidates, applications, interviews, hqLeads]);

  const geoRows = useMemo(() => {
    const map: Record<string, number> = {};
    for (const row of t?.crmCompanies || []) {
      const key = String(row.country || '').trim();
      if (key) map[key] = (map[key] || 0) + 1;
    }
    for (const row of t?.crmLeads || []) {
      const key = String(row.country || '').trim();
      if (key) map[key] = (map[key] || 0) + 1;
    }
    for (const row of t?.recentJobs || []) {
      const key = String(row.location || '')
        .split(',')
        .map((p) => p.trim())
        .filter(Boolean)
        .pop();
      if (key) map[key] = (map[key] || 0) + 1;
    }
    return Object.entries(map)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }, [t]);

  const topTenants = useMemo(() => {
    return (t?.rankedTenants || []).slice(0, 8).map((row) => {
      const activity = num(row.activityScore);
      const health = Math.min(
        100,
        Math.max(
          0,
          Math.round(
            activity > 0
              ? Math.min(100, 55 + activity)
              : 40 +
                  Math.min(30, row.openJobs * 2) +
                  Math.min(20, row.applications) +
                  Math.min(10, row.placements * 3),
          ),
        ),
      );
      return {
        name: row.name || row.tenantDbName || '—',
        plan: row.plan || '—',
        jobs: row.openJobs,
        apps: row.applications,
        placements: row.placements,
        health,
      };
    });
  }, [t]);

  const demoAnalytics = useMemo(() => {
    const byStatus = mapPoints(c?.demosByStatus);
    if (byStatus.length) return byStatus;
    const byKind = mapPoints(c?.demosByKind);
    if (byKind.length) return byKind;
    return [
      { name: 'Verified', value: num(k?.demosVerified) },
      { name: 'Trials', value: num(k?.demosTrials) },
      { name: 'Purchases', value: num(k?.demosPurchases) },
    ].filter((r) => r.value > 0);
  }, [c, k]);

  const conversionFunnel = useMemo(() => {
    const steps = [
      { name: 'Demo Requests', value: demos },
      { name: 'Trials', value: trials },
      { name: 'Paid Customers', value: paid },
      { name: 'Active Tenants', value: activeTenants },
      { name: 'Landing Purchases', value: num(k?.landingPurchases) },
    ].filter((s) => s.value > 0 || ['Demo Requests', 'Paid Customers', 'Active Tenants'].includes(s.name));
    return steps.length ? steps : [{ name: 'Tenants', value: tenants }];
  }, [demos, trials, paid, activeTenants, k, tenants]);
  const maxConv = Math.max(...conversionFunnel.map((f) => f.value), 1);

  const healthScore = useMemo(() => {
    if (!tenants) return 0;
    const healthy = topTenants.filter((r) => r.health >= 70).length;
    const ranked = Math.max(topTenants.length, 1);
    const activityAvg =
      topTenants.reduce((s, r) => s + r.health, 0) / ranked;
    const pausePenalty = tenants > 0 ? (paused / tenants) * 20 : 0;
    return Math.min(100, Math.max(0, Math.round(activityAvg * 0.7 + (healthy / ranked) * 30 - pausePenalty)));
  }, [tenants, topTenants, paused]);

  const placementRate = pct(placementsJoined || placements, applications || 1);
  const interviewRate = pct(interviews, applications || 1);
  const joinRate = pct(placementsJoined, placements || 1);
  const leadConv = num(k?.hqLeadConversionRate);

  const activities = useMemo(() => {
    const items: Array<{ text: string; time: string; color: string; at: number }> = [];
    for (const job of t?.recentJobs || []) {
      items.push({
        text: `Job “${job.title}” · ${job.company || job.tenant} · ${job.status}`,
        time: formatWhen(job.updatedAt),
        color: INDIGO,
        at: job.updatedAt ? new Date(job.updatedAt).getTime() : 0,
      });
    }
    for (const p of t?.recentPlacements || []) {
      items.push({
        text: `Placement · ${p.candidate || 'Candidate'} → ${p.company || p.job} (${p.status})`,
        time: formatWhen(p.updatedAt || p.joiningDate),
        color: SUCCESS,
        at: new Date(p.updatedAt || p.joiningDate || 0).getTime() || 0,
      });
    }
    for (const d of t?.recentDemos || []) {
      items.push({
        text: `Demo · ${d.company || d.name} · ${d.requestKind || d.status}`,
        time: formatWhen(d.submittedAt),
        color: PURPLE,
        at: d.submittedAt ? new Date(d.submittedAt).getTime() : 0,
      });
    }
    for (const lead of (t?.crmLeads || []).slice(0, 8)) {
      items.push({
        text: `HQ lead · ${lead.name || lead.company} · ${lead.stage}`,
        time: lead.nextFollowUp ? `Follow-up ${lead.nextFollowUp}` : 'CRM',
        color: ORANGE,
        at: 0,
      });
    }
    for (const row of (t?.recentTenantActivity || []).slice(0, 6)) {
      items.push({
        text: `${row.tenant} · ${row.openJobs} open jobs · ${row.applications7d ?? 0} apps (7d)`,
        time: row.plan || 'tenant',
        color: TEAL,
        at: 0,
      });
    }
    items.sort((a, b) => b.at - a.at);
    return items.slice(0, 10).map(({ text, time, color }) => ({ text, time, color }));
  }, [t]);

  const systemHealth = useMemo(
    () => [
      {
        label: 'Analytics',
        value: isLive ? 'Live' : 'Waiting',
        warn: !isLive,
      },
      {
        label: 'Tenants',
        value: `${tenants} total`,
        warn: tenants === 0,
      },
      {
        label: 'Paused',
        value: `${paused}`,
        warn: paused > 0,
      },
      {
        label: 'Open jobs',
        value: fmt(activeJobs),
        warn: false,
      },
      {
        label: 'Apps (7d)',
        value: fmt(apps7d),
        warn: false,
      },
      {
        label: 'Interviews today',
        value: fmt(k?.interviewsToday),
        warn: false,
      },
      {
        label: 'Follow-ups today',
        value: fmt(k?.followUpsToday),
        warn: false,
      },
      {
        label: 'Open tasks',
        value: fmt(k?.tasksOpen),
        warn: num(k?.tasksOpen) > 20,
      },
    ],
    [isLive, tenants, paused, activeJobs, apps7d, k],
  );

  const kpis = [
    {
      label: 'Total Companies',
      value: companies,
      growth: null as number | null,
      iconSrc: HQ_SVG_ASSETS.totalCandidates.icon,
      sparkData: seriesToSpark(mapPoints(c?.companiesByStatus)),
      sparkColor: INDIGO,
      compareLabel: 'HQ CRM companies',
    },
    {
      label: 'Total Tenants',
      value: tenants,
      growth: null,
      iconSrc: HQ_SVG_ASSETS.newCandidates.icon,
      sparkData: seriesToSpark(tenantActivity),
      sparkColor: PURPLE,
      compareLabel: `${activeTenants} active · ${paused} paused`,
    },
    {
      label: 'Pipeline Value',
      value: money(pipelineValue),
      growth: null,
      iconSrc: HQ_SVG_ASSETS.avgMatchScore.icon,
      sparkData: seriesToSpark(pipelineStages),
      sparkColor: TEAL,
      compareLabel: `${hqLeads} HQ leads · ${hotLeads} hot`,
    },
    {
      label: 'Candidates',
      value: candidates,
      growth: null,
      iconSrc: HQ_SVG_ASSETS.profileCompleteness.icon,
      sparkData: seriesToSpark([{ value: candidates7d }, { value: candidates }]),
      sparkColor: BLUE,
      compareLabel: `${candidates7d} new in 7d`,
    },
    {
      label: 'Trial Accounts',
      value: trials,
      growth: null,
      iconSrc: HQ_SVG_ASSETS.activeApplications.icon,
      sparkData: seriesToSpark([{ value: trials }, { value: paid }]),
      sparkColor: ORANGE,
      compareLabel: 'landing / demo trials',
    },
    {
      label: 'Paid Accounts',
      value: paid,
      growth: null,
      iconSrc: HQ_SVG_ASSETS.applications.icon,
      sparkData: seriesToSpark(plans),
      sparkColor: SUCCESS,
      compareLabel: 'tenants on a plan',
    },
    {
      label: 'Demo Requests',
      value: demos,
      growth: null,
      iconSrc: HQ_SVG_ASSETS.interviewRequests.icon,
      sparkData: seriesToSpark(demoAnalytics),
      sparkColor: WARNING,
      compareLabel: `${num(k?.demosPurchases)} purchases`,
    },
    {
      label: 'Active Jobs',
      value: activeJobs,
      growth: null,
      iconSrc: HQ_SVG_ASSETS.openJobs.icon,
      sparkData: seriesToSpark(mapPoints(c?.jobsByStatus)),
      sparkColor: INDIGO,
      compareLabel: `${num(k?.closedJobs)} closed · ${apps7d} apps/7d`,
    },
  ];

  const updatedLabel = generatedAt
    ? (() => {
        const mins = Math.max(0, Math.round((Date.now() - new Date(generatedAt).getTime()) / 60000));
        if (mins < 1) return 'just now';
        return mins < 60 ? `${mins} min ago` : `${Math.round(mins / 60)} hr ago`;
      })()
    : '—';

  return (
    <div className="hq-dash-page min-h-full text-slate-900">
      <div className="mx-auto w-full max-w-[1600px] px-4 py-5 sm:px-6 xl:px-8">
        <HqPhase2PageHeader updatedLabel={updatedLabel} loading={loading} onRefresh={onRefresh} />

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

        <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4 xl:grid-cols-8">
          {kpis.map((item) => (
            <HqSvgKpiCard key={item.label} item={item} />
          ))}
        </div>

        <div className="mb-6 grid grid-cols-12 gap-6">
          <Card className="col-span-12 lg:col-span-4">
            <Title
              title="Tenant Activity"
              right={
                <span className="rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-medium text-slate-600">
                  Live score
                </span>
              }
            />
            <p className="mb-2 text-xs text-[#6B7280]">
              Pipeline: <strong className="text-[#111827]">{money(pipelineValue)}</strong>
              {' · '}
              {apps7d} applications in 7d
            </p>
            <div className="h-[240px]">
              {tenantActivity.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={tenantActivity} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="tenFillLive" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={INDIGO} stopOpacity={0.28} />
                        <stop offset="100%" stopColor={INDIGO} stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="4 8" stroke={gridStroke} vertical={false} />
                    <XAxis dataKey="name" tick={{ ...axisTick, fontSize: 9 }} axisLine={false} tickLine={false} interval={0} />
                    <YAxis tick={axisTick} axisLine={false} tickLine={false} width={32} />
                    <Tooltip contentStyle={tip} cursor={{ stroke: '#C7D2FE', strokeWidth: 1 }} />
                    <Area
                      type="monotone"
                      dataKey="value"
                      stroke={INDIGO}
                      fill="url(#tenFillLive)"
                      strokeWidth={2.6}
                      strokeLinecap="round"
                      activeDot={{ r: 5, strokeWidth: 2, stroke: '#fff' }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-xs text-slate-400">
                  No tenant activity scores yet
                </div>
              )}
            </div>
          </Card>

          <Card className="col-span-12 lg:col-span-3">
            <Title title="Jobs by Status" />
            <div className="h-[270px]">
              {mapPoints(c?.jobsByStatus).length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={mapPoints(c?.jobsByStatus)} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="4 8" stroke={gridStroke} vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: '#94A3B8' }} axisLine={false} tickLine={false} width={28} />
                    <Tooltip contentStyle={tip} />
                    <Bar dataKey="value" radius={[6, 6, 0, 0]} barSize={18} fill={PURPLE} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-xs text-slate-400">
                  No job status data yet
                </div>
              )}
            </div>
          </Card>

          <div className="col-span-12 grid grid-cols-1 gap-6 lg:col-span-5">
            <Card>
              <Title title="Demo → Trial → Paid Funnel" />
              <div className="space-y-1.5">
                {conversionFunnel.map((step, i) => (
                  <div key={step.name} className="flex items-center gap-2">
                    <span className="w-[120px] shrink-0 text-right text-[10px] font-medium text-[#6B7280]">
                      {step.name}
                    </span>
                    <div className="flex flex-1 justify-center">
                      <motion.div
                        initial={{ scaleX: 0.6, opacity: 0 }}
                        animate={{ scaleX: 1, opacity: 1 }}
                        transition={{ delay: i * 0.04 }}
                        className="flex h-7 items-center justify-center rounded-md text-[10px] font-bold text-white"
                        style={{
                          width: `${Math.max(22, (step.value / maxConv) * (100 - i * 8))}%`,
                          background: FUNNEL_COLORS[i % FUNNEL_COLORS.length],
                          clipPath: 'polygon(3% 0%, 97% 0%, 100% 100%, 0% 100%)',
                        }}
                      >
                        {fmt(step.value)}
                      </motion.div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="!p-4">
              <Title title="Lead Pipeline" />
              {pipelineStages.length ? (
                <>
                  <div className="mb-3 grid grid-cols-3 gap-2 sm:grid-cols-6">
                    {pipelineStages.map((s) => (
                      <div
                        key={s.name}
                        className="rounded-xl border border-slate-100 bg-slate-50/80 px-2 py-2 text-center"
                      >
                        <div
                          className="mx-auto mb-1 h-1.5 w-1.5 rounded-full"
                          style={{ background: s.color }}
                        />
                        <p className="text-[9px] font-medium leading-tight text-[#6B7280]">{s.name}</p>
                        <p className="mt-1 text-sm font-bold text-[#111827]">{fmt(s.value)}</p>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center justify-between rounded-xl border border-indigo-100 bg-indigo-50/50 px-4 py-3">
                    <div>
                      <p className="text-[11px] font-medium text-[#6B7280]">Pipeline Value</p>
                      <p className="mt-0.5 text-2xl font-bold text-indigo-700">
                        {money(pipelineValue)}
                      </p>
                    </div>
                    <p className="text-xs font-semibold text-indigo-600">{leadConv}% conversion</p>
                  </div>
                </>
              ) : (
                <p className="py-8 text-center text-xs text-slate-400">No HQ lead stages yet</p>
              )}
            </Card>
          </div>
        </div>

        <div className="mb-6 grid grid-cols-12 gap-6">
          <Card className="col-span-12 md:col-span-6 xl:col-span-2">
            <Title title="Tenant Distribution" />
            <div className="h-[150px]">
              {tenantDist.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={tenantDist}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={42}
                      outerRadius={62}
                      paddingAngle={2}
                    >
                      {tenantDist.map((_, i) => (
                        <Cell key={i} fill={TENANT_COLORS[i % TENANT_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={tip} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-xs text-slate-400">No data</div>
              )}
            </div>
            <div className="mt-1 space-y-1">
              {tenantDist.map((s, i) => (
                <div key={s.name} className="flex items-center justify-between text-[10px]">
                  <span className="flex items-center gap-1.5 text-[#6B7280]">
                    <span
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ background: TENANT_COLORS[i % TENANT_COLORS.length] }}
                    />
                    {s.name}
                  </span>
                  <span className="font-semibold text-[#111827]">{fmt(s.value)}</span>
                </div>
              ))}
            </div>
          </Card>

          <Card className="col-span-12 md:col-span-6 xl:col-span-2">
            <Title title="Subscription Plans" />
            <div className="h-[220px]">
              {plans.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={plans} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="4 8" stroke={gridStroke} vertical={false} />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 9, fill: '#94A3B8' }}
                      axisLine={false}
                      tickLine={false}
                      interval={0}
                    />
                    <YAxis tick={{ fontSize: 10, fill: '#94A3B8' }} axisLine={false} tickLine={false} width={28} />
                    <Tooltip contentStyle={tip} />
                    <Bar dataKey="value" radius={[6, 6, 0, 0]} barSize={18}>
                      {plans.map((_, i) => (
                        <Cell key={i} fill={PLAN_COLORS[i % PLAN_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-xs text-slate-400">
                  No plan distribution yet
                </div>
              )}
            </div>
          </Card>

          <Card className="col-span-12 md:col-span-6 xl:col-span-3">
            <Title title="Hiring Funnel" />
            <div className="space-y-3">
              {hiringFunnelLive.map((step, i) => (
                <div key={step.name}>
                  <div className="mb-1 flex items-center justify-between text-[11px]">
                    <span className="font-semibold text-slate-700">{step.name}</span>
                    <span className="text-[#6B7280]">
                      <strong className="text-[#111827]">{fmt(step.value)}</strong>
                      {i > 0 ? ` · ${step.rate}%` : ''}
                    </span>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.max(8, (step.value / maxHire) * 100)}%` }}
                      className="h-full rounded-full"
                      style={{ background: HIRE_COLORS[i % HIRE_COLORS.length] }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card className="col-span-12 md:col-span-6 xl:col-span-2">
            <Title title="Workload Mix" />
            <div className="h-[150px]">
              {platformUsage.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={platformUsage}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={42}
                      outerRadius={62}
                      paddingAngle={2}
                    >
                      {platformUsage.map((_, i) => (
                        <Cell key={i} fill={USAGE_COLORS[i % USAGE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={tip} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-xs text-slate-400">No usage yet</div>
              )}
            </div>
            <div className="mt-1 space-y-1">
              {platformUsage.slice(0, 4).map((s, i) => (
                <div key={s.name} className="flex items-center justify-between text-[10px]">
                  <span className="flex items-center gap-1.5 text-[#6B7280]">
                    <span
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ background: USAGE_COLORS[i % USAGE_COLORS.length] }}
                    />
                    {s.name}
                  </span>
                  <span className="font-semibold">{s.value}%</span>
                </div>
              ))}
            </div>
          </Card>

          <Card className="col-span-12 xl:col-span-3">
            <Title title="Platform Health Score" />
            <HealthGauge score={healthScore} />
            <p className="mt-1 text-center text-xs font-semibold text-slate-500">
              From live tenant activity · {topTenants.length} ranked
            </p>
          </Card>
        </div>

        <div className="mb-6 grid grid-cols-12 gap-6">
          <Card className="col-span-12 lg:col-span-3">
            <Title title="Geographical Distribution" />
            {geoRows.length ? (
              <div className="space-y-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                  Top countries / locations
                </p>
                {geoRows.map((row) => (
                  <div key={row.name} className="flex items-center justify-between text-[11px]">
                    <span className="truncate text-[#6B7280]">{row.name}</span>
                    <span className="font-semibold text-[#111827]">{fmt(row.value)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="py-10 text-center text-xs text-slate-400">
                No country/location data on HQ leads or companies yet
              </p>
            )}
          </Card>

          <Card className="col-span-12 lg:col-span-5 !p-0 overflow-hidden">
            <div className="border-b border-slate-100 px-6 py-4">
              <h3 className="text-sm font-semibold text-[#111827]">Top Performing Tenants</h3>
            </div>
            <div className="overflow-x-auto">
              {topTenants.length ? (
                <table className="w-full min-w-[520px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/70 text-[10px] uppercase tracking-wider text-slate-400">
                      <th className="px-6 py-3 font-semibold">Tenant</th>
                      <th className="px-3 py-3 font-semibold">Plan</th>
                      <th className="px-3 py-3 font-semibold text-right">Active Jobs</th>
                      <th className="px-3 py-3 font-semibold text-right">Applications</th>
                      <th className="px-3 py-3 font-semibold text-right">Placements</th>
                      <th className="px-6 py-3 font-semibold text-right">Health</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topTenants.map((row) => (
                      <tr
                        key={row.name}
                        className="border-b border-slate-50 last:border-0 hover:bg-slate-50/70"
                      >
                        <td className="px-6 py-3">
                          <div className="flex items-center gap-2.5">
                            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-50 text-[10px] font-bold text-indigo-700">
                              {row.name.slice(0, 2).toUpperCase()}
                            </span>
                            <span className="font-semibold text-[#111827]">{row.name}</span>
                          </div>
                        </td>
                        <td className="px-3 py-3 text-[#6B7280]">{row.plan}</td>
                        <td className="px-3 py-3 text-right font-medium">{fmt(row.jobs)}</td>
                        <td className="px-3 py-3 text-right font-medium">{fmt(row.apps)}</td>
                        <td className="px-3 py-3 text-right font-medium">{fmt(row.placements)}</td>
                        <td className="px-6 py-3 text-right">
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-bold ${
                              row.health >= 90
                                ? 'bg-emerald-50 text-emerald-700'
                                : row.health >= 70
                                  ? 'bg-indigo-50 text-indigo-700'
                                  : 'bg-amber-50 text-amber-700'
                            }`}
                          >
                            {row.health}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="px-6 py-10 text-center text-xs text-slate-400">No ranked tenants yet</p>
              )}
            </div>
          </Card>

          <Card className="col-span-12 md:col-span-6 lg:col-span-2">
            <Title title="Demo Analytics" />
            <div className="h-[140px]">
              {demoAnalytics.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={demoAnalytics}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={38}
                      outerRadius={58}
                      paddingAngle={2}
                    >
                      {demoAnalytics.map((_, i) => (
                        <Cell key={i} fill={DEMO_COLORS[i % DEMO_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={tip} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-xs text-slate-400">No demos yet</div>
              )}
            </div>
            <div className="mt-1 space-y-1">
              {demoAnalytics.map((s, i) => (
                <div key={s.name} className="flex items-center justify-between text-[10px]">
                  <span className="flex items-center gap-1.5 text-[#6B7280]">
                    <span
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ background: DEMO_COLORS[i % DEMO_COLORS.length] }}
                    />
                    {s.name}
                  </span>
                  <span className="font-semibold">{fmt(s.value)}</span>
                </div>
              ))}
            </div>
          </Card>

          <Card className="col-span-12 md:col-span-6 lg:col-span-2">
            <Title title="Recruitment Analytics" />
            <div className="grid grid-cols-2 gap-2.5">
              {[
                {
                  label: 'Interview Rate',
                  value: `${interviewRate}%`,
                  hint: `${fmt(interviews)} / apps`,
                  color: INDIGO,
                },
                {
                  label: 'Lead Conversion',
                  value: `${leadConv}%`,
                  hint: `${fmt(hqLeads)} HQ leads`,
                  color: PURPLE,
                },
                {
                  label: 'Placement Rate',
                  value: `${placementRate}%`,
                  hint: `${fmt(placementsJoined || placements)} placed`,
                  color: TEAL,
                },
                {
                  label: 'Join Rate',
                  value: `${joinRate}%`,
                  hint: `${fmt(placementsJoined)} joined`,
                  color: SUCCESS,
                },
              ].map((m) => (
                <div key={m.label} className="rounded-xl border border-slate-100 bg-slate-50/80 p-2.5">
                  <p className="text-[9px] font-semibold uppercase tracking-wide leading-tight text-slate-400">
                    {m.label}
                  </p>
                  <p className="mt-1 text-lg font-bold" style={{ color: m.color }}>
                    {m.value}
                  </p>
                  <p className="mt-1 text-[10px] font-medium text-slate-500">{m.hint}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <div className="mb-6 grid grid-cols-12 gap-6">
          <Card className="col-span-12 lg:col-span-4 !p-0 overflow-hidden">
            <div className="border-b border-slate-100 px-6 py-4">
              <h3 className="text-sm font-semibold text-[#111827]">Recent Activity</h3>
            </div>
            {activities.length ? (
              <HqPhase2ActivityFeed activities={activities} />
            ) : (
              <p className="px-6 py-10 text-center text-xs text-slate-400">
                No recent jobs, placements, demos, or CRM leads yet
              </p>
            )}
          </Card>

          <Card className="col-span-12 lg:col-span-5">
            <Title title="Live Platform Status" />
            <HqPhase2SystemHealth items={systemHealth} />
          </Card>

          <Card className="col-span-12 lg:col-span-3">
            <Title title="Quick Actions" />
            <HqPhase2QuickActions
              INDIGO={INDIGO}
              PURPLE={PURPLE}
              TEAL={TEAL}
              ORANGE={ORANGE}
              BLUE={BLUE}
              SUCCESS={SUCCESS}
            />
          </Card>
        </div>

        <HqPhase2Footer
          updatedLabel={
            isLive ? `Live · ${updatedLabel}` : updatedLabel
          }
        />
      </div>
    </div>
  );
}
