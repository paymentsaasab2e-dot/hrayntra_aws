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
  HqPhase2Navbar,
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
const FUNNEL_COLORS = [INDIGO, PURPLE, '#A855F7', ORANGE, SUCCESS];
const PLAN_COLORS = [INDIGO, PURPLE, TEAL, ORANGE, BLUE];
const HIRE_COLORS = [INDIGO, PURPLE, TEAL, WARNING, SUCCESS];

type Props = {
  data: HqEmployerAnalytics | null;
  generatedAt?: string | null;
  durationMs?: number | null;
  loading?: boolean;
  onRefresh?: () => void;
};

function fmt(n: number | null | undefined) {
  if (n == null || Number.isNaN(Number(n))) return '—';
  return Number(n).toLocaleString();
}

function money(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${Math.round(n).toLocaleString()}`;
  return `$${n}`;
}

function monthly(base: number, growth = 0.1) {
  const months = ['Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May'];
  let v = Math.max(10, Math.round(base / Math.pow(1 + growth, 11)));
  return months.map((name) => {
    v = Math.round(v * (1 + growth + ((v % 7) - 3) * 0.008));
    return { name, value: v };
  });
}

const tip = {
  borderRadius: 10,
  border: '1px solid #e2e8f0',
  fontSize: 12,
  boxShadow: '0 8px 24px rgba(15,23,42,0.08)',
};

export function HqPhase2CommandDashboard({
  data,
  generatedAt,
  loading,
  onRefresh,
}: Props) {
  const k = data?.kpis;
  const c = data?.charts;
  const t = data?.tables;

  const companies = k?.hqCompanies ?? 1248;
  const tenants = k?.tenants ?? 486;
  const mrr = 248650;
  const arr = mrr * 12;
  const trials = k?.landingTrials ?? 128;
  const paid = k?.onPlan ?? 358;
  const demos = (k?.demosVerified ?? 0) + (k?.demosPurchases ?? 0) + (k?.demosTrials ?? 0) || 842;
  const activeJobs = k?.openJobs ?? 3842;

  const kpis = [
    {
      label: 'Total Companies',
      value: companies,
      growth: 18.6,
      iconSrc: HQ_SVG_ASSETS.totalCandidates.icon,
      sparkSrc: HQ_SVG_ASSETS.totalCandidates.spark,
    },
    {
      label: 'Total Tenants',
      value: tenants,
      growth: 14.2,
      iconSrc: HQ_SVG_ASSETS.newCandidates.icon,
      sparkSrc: HQ_SVG_ASSETS.newCandidates.spark,
    },
    {
      label: 'Monthly Revenue',
      value: money(mrr),
      growth: 22.7,
      iconSrc: HQ_SVG_ASSETS.avgMatchScore.icon,
      sparkSrc: HQ_SVG_ASSETS.avgMatchScore.spark,
    },
    {
      label: 'ARR',
      value: money(arr),
      growth: 19.4,
      iconSrc: HQ_SVG_ASSETS.profileCompleteness.icon,
      sparkSrc: HQ_SVG_ASSETS.profileCompleteness.spark,
    },
    {
      label: 'Trial Accounts',
      value: trials,
      growth: 11.8,
      iconSrc: HQ_SVG_ASSETS.activeApplications.icon,
      sparkSrc: HQ_SVG_ASSETS.activeApplications.spark,
    },
    {
      label: 'Paid Accounts',
      value: paid,
      growth: 16.3,
      iconSrc: HQ_SVG_ASSETS.applications.icon,
      sparkSrc: HQ_SVG_ASSETS.applications.spark,
    },
    {
      label: 'Demo Requests',
      value: demos,
      growth: 24.5,
      iconSrc: HQ_SVG_ASSETS.interviewRequests.icon,
      sparkSrc: HQ_SVG_ASSETS.interviewRequests.spark,
    },
    {
      label: 'Active Jobs',
      value: activeJobs,
      growth: 12.8,
      iconSrc: HQ_SVG_ASSETS.openJobs.icon,
      sparkSrc: HQ_SVG_ASSETS.openJobs.spark,
    },
  ];

  const revenueSeries = useMemo(() => monthly(mrr, 0.12), [mrr]);
  const tenantGrowth = useMemo(() => {
    if (c?.tenantActivity?.length) {
      return c.tenantActivity.slice(0, 12).map((d) => ({ name: String(d.name), value: Number(d.value) || 0 }));
    }
    return monthly(42, 0.08);
  }, [c]);

  const conversionFunnel = [
    { name: 'Visitors', value: 48200 },
    { name: 'Demo Requests', value: demos },
    { name: 'Trials', value: trials },
    { name: 'Paid Customers', value: paid },
    { name: 'Active Customers', value: Math.round(paid * 0.92) },
    { name: 'Renewals', value: Math.round(paid * 0.78) },
  ];
  const maxConv = Math.max(...conversionFunnel.map((f) => f.value), 1);

  const pipelineStages = [
    { name: 'New', value: Math.round((k?.hqLeads ?? 420) * 0.28), color: INDIGO },
    { name: 'Contacted', value: Math.round((k?.hqLeads ?? 420) * 0.22), color: BLUE },
    { name: 'Demo Scheduled', value: Math.round((k?.hqLeads ?? 420) * 0.18), color: PURPLE },
    { name: 'Negotiation', value: Math.round((k?.hqLeads ?? 420) * 0.14), color: WARNING },
    { name: 'Won', value: Math.round((k?.hqLeads ?? 420) * 0.12), color: SUCCESS },
    { name: 'Lost', value: Math.round((k?.hqLeads ?? 420) * 0.06), color: DANGER },
  ];
  const pipelineValue = k?.pipelineValue ?? 1_240_000;

  const tenantDist = useMemo(() => {
    const agency = k?.agency ?? 186;
    const standalone = k?.standalone ?? 214;
    const paused = k?.paused ?? 28;
    const enterprise = Math.round(tenants * 0.12);
    const others = Math.max(0, tenants - agency - standalone - paused - enterprise);
    return [
      { name: 'Agency', value: agency },
      { name: 'Standalone', value: standalone },
      { name: 'Enterprise', value: enterprise },
      { name: 'Paused', value: paused },
      { name: 'Others', value: others || 18 },
    ];
  }, [k, tenants]);

  const plans = useMemo(() => {
    if (c?.tenantsByPlan?.length) {
      return c.tenantsByPlan.map((d) => ({ name: String(d.name), value: Number(d.value) || 0 }));
    }
    return [
      { name: 'Starter', value: 142 },
      { name: 'Professional', value: 168 },
      { name: 'Business', value: 86 },
      { name: 'Enterprise', value: 54 },
      { name: 'Custom', value: 36 },
    ];
  }, [c]);

  const hiringFunnel = [
    { name: 'Jobs', value: k?.jobs ?? activeJobs, rate: 100 },
    { name: 'Applications', value: k?.applications ?? 28400, rate: 100 },
    { name: 'Interviews', value: k?.interviews ?? 6420, rate: 22.6 },
    { name: 'Offers', value: Math.round((k?.placements ?? 1280) * 1.4), rate: 28.1 },
    { name: 'Placements', value: k?.placements ?? 1280, rate: 71.4 },
  ];
  const maxHire = Math.max(...hiringFunnel.map((h) => h.value), 1);

  const platformUsage = [
    { name: 'ATS', value: 32 },
    { name: 'CRM', value: 24 },
    { name: 'Interview AI', value: 18 },
    { name: 'LMS', value: 12 },
    { name: 'Assessments', value: 9 },
    { name: 'Other', value: 5 },
  ];

  const cities = [
    { name: 'Mumbai', value: 186 },
    { name: 'Bengaluru', value: 164 },
    { name: 'Delhi NCR', value: 128 },
    { name: 'Hyderabad', value: 98 },
    { name: 'Pune', value: 86 },
    { name: 'Chennai', value: 72 },
  ];

  const topTenants = useMemo(() => {
    if (t?.rankedTenants?.length) {
      return t.rankedTenants.slice(0, 6).map((row, i) => ({
        name: row.name || row.tenantDbName,
        plan: row.plan || 'Professional',
        jobs: row.openJobs,
        apps: row.applications,
        placements: row.placements,
        health: Math.min(98, 72 + (row.activityScore || 10) + i),
      }));
    }
    return [
      { name: 'Acme Talent', plan: 'Enterprise', jobs: 48, apps: 1240, placements: 62, health: 94 },
      { name: 'Nexus Hire', plan: 'Business', jobs: 36, apps: 980, placements: 41, health: 88 },
      { name: 'Quantum Staff', plan: 'Professional', jobs: 28, apps: 760, placements: 33, health: 85 },
      { name: 'Orbit Careers', plan: 'Enterprise', jobs: 52, apps: 1420, placements: 71, health: 91 },
      { name: 'BrightPath', plan: 'Starter', jobs: 14, apps: 320, placements: 12, health: 76 },
      { name: 'Vertex HR', plan: 'Business', jobs: 22, apps: 540, placements: 24, health: 82 },
    ];
  }, [t]);

  const demoAnalytics = useMemo(() => {
    return [
      { name: 'Requested', value: k?.demosVerified ? Math.round(demos * 0.35) : 294 },
      { name: 'Scheduled', value: Math.round(demos * 0.28) || 236 },
      { name: 'Completed', value: Math.round(demos * 0.22) || 185 },
      { name: 'Converted', value: k?.demosPurchases || Math.round(demos * 0.1) || 84 },
      { name: 'Lost', value: Math.round(demos * 0.05) || 43 },
    ];
  }, [k, demos]);

  const activities = [
    { text: "New company 'Quantum Solutions' registered", time: '2 min ago', color: SUCCESS },
    { text: 'Tenant Orbit Careers upgraded to Enterprise', time: '18 min ago', color: PURPLE },
    { text: 'Demo completed with BrightPath HR', time: '42 min ago', color: INDIGO },
    { text: 'Payment received · $4,800 ARR', time: '1 hr ago', color: TEAL },
    { text: 'Placement completed at Nexus Hire', time: '2 hr ago', color: WARNING },
    { text: 'Trial started · Vertex Staffing', time: '3 hr ago', color: ORANGE },
    { text: 'API sync healthy across all regions', time: '4 hr ago', color: BLUE },
  ];

  const healthScore = 85;
  const updatedLabel = generatedAt
    ? (() => {
        const mins = Math.max(1, Math.round((Date.now() - new Date(generatedAt).getTime()) / 60000));
        return mins < 60 ? `${mins} min ago` : `${Math.round(mins / 60)} hr ago`;
      })()
    : '2 min ago';

  return (
    <div className="min-h-full bg-[#F8FAFC] font-[Inter,ui-sans-serif,system-ui,sans-serif] text-[#111827]">
      <HqPhase2Navbar />

      <div className="mx-auto w-full max-w-[1920px] px-6 py-6 xl:px-8">
        <HqPhase2PageHeader updatedLabel={updatedLabel} loading={loading} onRefresh={onRefresh} />

        {/* ROW 1 — 8 KPIs */}
        <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4 xl:grid-cols-8">
          {kpis.map((item) => (
            <HqSvgKpiCard key={item.label} item={item} />
          ))}
        </div>

        {/* ROW 2 */}
        <div className="mb-6 grid grid-cols-12 gap-6">
          <Card className="col-span-12 lg:col-span-4 xl:col-span-4">
            <Title
              title="Revenue Overview"
              right={<span className="rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-medium text-slate-600">Monthly</span>}
            />
            <p className="mb-2 text-xs text-[#6B7280]">
              May 2025: <strong className="text-[#111827]">{money(mrr)}</strong>{' '}
              <span className="font-semibold text-emerald-600">▲ 22.7%</span>
            </p>
            <div className="h-[240px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={revenueSeries} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="revFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={PURPLE} stopOpacity={0.3} />
                      <stop offset="100%" stopColor={PURPLE} stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} width={44} tickFormatter={(v) => `$${Math.round(v / 1000)}k`} />
                  <Tooltip contentStyle={tip} formatter={(v: number) => [money(v), 'Revenue']} />
                  <Area type="monotone" dataKey="value" stroke={PURPLE} fill="url(#revFill)" strokeWidth={2.4} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card className="col-span-12 lg:col-span-3">
            <Title title="Tenant Growth" />
            <div className="h-[270px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={tenantGrowth} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="tenFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={INDIGO} stopOpacity={0.28} />
                      <stop offset="100%" stopColor={INDIGO} stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} width={32} />
                  <Tooltip contentStyle={tip} />
                  <Area type="monotone" dataKey="value" stroke={INDIGO} fill="url(#tenFill)" strokeWidth={2.4} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <div className="col-span-12 grid grid-cols-1 gap-6 lg:col-span-5">
            <Card>
              <Title title="Trial to Paid Conversion Funnel" />
              <div className="space-y-1.5">
                {conversionFunnel.map((step, i) => (
                  <div key={step.name} className="flex items-center gap-2">
                    <span className="w-[110px] shrink-0 text-right text-[10px] font-medium text-[#6B7280]">{step.name}</span>
                    <div className="flex flex-1 justify-center">
                      <motion.div
                        initial={{ scaleX: 0.6, opacity: 0 }}
                        animate={{ scaleX: 1, opacity: 1 }}
                        transition={{ delay: i * 0.04 }}
                        className="flex h-7 items-center justify-center rounded-md text-[10px] font-bold text-white"
                        style={{
                          width: `${Math.max(22, (step.value / maxConv) * (100 - i * 10))}%`,
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
              <div className="mb-3 grid grid-cols-3 gap-2 sm:grid-cols-6">
                {pipelineStages.map((s) => (
                  <div key={s.name} className="rounded-xl border border-slate-100 bg-slate-50/80 px-2 py-2 text-center">
                    <div className="mx-auto mb-1 h-1.5 w-1.5 rounded-full" style={{ background: s.color }} />
                    <p className="text-[9px] font-medium leading-tight text-[#6B7280]">{s.name}</p>
                    <p className="mt-1 text-sm font-bold text-[#111827]">{fmt(s.value)}</p>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between rounded-xl border border-indigo-100 bg-indigo-50/50 px-4 py-3">
                <div>
                  <p className="text-[11px] font-medium text-[#6B7280]">Pipeline Value</p>
                  <p className="mt-0.5 text-2xl font-bold text-indigo-700">{money(Number(pipelineValue))}</p>
                </div>
                <img
                  src={HQ_SVG_ASSETS.avgMatchScore.spark}
                  alt=""
                  width={120}
                  height={36}
                  className="h-9 w-[120px] object-fill"
                />
              </div>
            </Card>
          </div>
        </div>

        {/* ROW 3 */}
        <div className="mb-6 grid grid-cols-12 gap-6">
          <Card className="col-span-12 md:col-span-6 xl:col-span-2">
            <Title title="Tenant Distribution" />
            <div className="h-[150px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={tenantDist} dataKey="value" nameKey="name" innerRadius={42} outerRadius={62} paddingAngle={2}>
                    {tenantDist.map((_, i) => (
                      <Cell key={i} fill={TENANT_COLORS[i % TENANT_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tip} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-1 space-y-1">
              {tenantDist.map((s, i) => (
                <div key={s.name} className="flex items-center justify-between text-[10px]">
                  <span className="flex items-center gap-1.5 text-[#6B7280]">
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: TENANT_COLORS[i] }} />
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
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={plans} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#94A3B8' }} axisLine={false} tickLine={false} interval={0} />
                  <YAxis tick={{ fontSize: 10, fill: '#94A3B8' }} axisLine={false} tickLine={false} width={28} />
                  <Tooltip contentStyle={tip} />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]} barSize={18}>
                    {plans.map((_, i) => (
                      <Cell key={i} fill={PLAN_COLORS[i % PLAN_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card className="col-span-12 md:col-span-6 xl:col-span-3">
            <Title title="Hiring Funnel" />
            <div className="space-y-3">
              {hiringFunnel.map((step, i) => (
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
                      animate={{ width: `${Math.max(12, (step.value / maxHire) * 100)}%` }}
                      className="h-full rounded-full"
                      style={{ background: HIRE_COLORS[i] }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card className="col-span-12 md:col-span-6 xl:col-span-2">
            <Title title="Platform Usage" />
            <div className="h-[150px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={platformUsage} dataKey="value" nameKey="name" innerRadius={42} outerRadius={62} paddingAngle={2}>
                    {platformUsage.map((_, i) => (
                      <Cell key={i} fill={USAGE_COLORS[i % USAGE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tip} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-1 space-y-1">
              {platformUsage.slice(0, 4).map((s, i) => (
                <div key={s.name} className="flex items-center justify-between text-[10px]">
                  <span className="flex items-center gap-1.5 text-[#6B7280]">
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: USAGE_COLORS[i] }} />
                    {s.name}
                  </span>
                  <span className="font-semibold">{s.value}%</span>
                </div>
              ))}
            </div>
          </Card>

          <Card className="col-span-12 xl:col-span-3">
            <Title title="Customer Health Score" />
            <HealthGauge score={healthScore} />
            <p className="mt-1 text-center text-xs font-semibold text-emerald-600">▲ +6 Points vs last month</p>
          </Card>
        </div>

        {/* ROW 4 */}
        <div className="mb-6 grid grid-cols-12 gap-6">
          <Card className="col-span-12 lg:col-span-3">
            <Title title="Geographical Distribution" />
            <div className="flex gap-3">
              <div className="relative flex h-[160px] w-[120px] shrink-0 items-center justify-center overflow-hidden rounded-xl bg-violet-50/60 ring-1 ring-violet-100">
                <svg viewBox="0 0 120 150" className="h-full w-full">
                  <path
                    d="M58 18c8 2 18 8 24 18 6 10 10 14 14 24 4 10 2 18-2 26-4 8-10 16-12 24-2 8 0 16 2 22-8 2-16 0-24-4-8-4-14-8-20-6-6 2-12 8-18 6-4-10-2-20 2-28 4-8 8-14 8-22 0-8-4-16-2-24 6-8 16-14 28-16z"
                    fill="#DDD6FE"
                    stroke="#A78BFA"
                    strokeWidth="1.5"
                  />
                  {[[52, 55], [48, 70], [62, 48], [70, 78], [58, 90], [55, 105]].map(([cx, cy], i) => (
                    <circle key={i} cx={cx} cy={cy} r={5} fill={PURPLE} opacity={0.75}>
                      <animate attributeName="opacity" values="0.5;1;0.5" dur={`${1.8 + i * 0.15}s`} repeatCount="indefinite" />
                    </circle>
                  ))}
                </svg>
              </div>
              <div className="min-w-0 flex-1 space-y-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Top Cities</p>
                {cities.map((city) => (
                  <div key={city.name} className="flex items-center justify-between text-[11px]">
                    <span className="text-[#6B7280]">{city.name}</span>
                    <span className="font-semibold text-[#111827]">{fmt(city.value)}</span>
                  </div>
                ))}
              </div>
            </div>
          </Card>

          <Card className="col-span-12 lg:col-span-5 !p-0 overflow-hidden">
            <div className="border-b border-slate-100 px-6 py-4">
              <h3 className="text-sm font-semibold text-[#111827]">Top Performing Tenants</h3>
            </div>
            <div className="overflow-x-auto">
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
                    <tr key={row.name} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/70">
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
                              : row.health >= 80
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
            </div>
          </Card>

          <Card className="col-span-12 md:col-span-6 lg:col-span-2">
            <Title title="Demo Analytics" />
            <div className="h-[140px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={demoAnalytics} dataKey="value" nameKey="name" innerRadius={38} outerRadius={58} paddingAngle={2}>
                    {demoAnalytics.map((_, i) => (
                      <Cell key={i} fill={DEMO_COLORS[i % DEMO_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tip} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-1 space-y-1">
              {demoAnalytics.map((s, i) => (
                <div key={s.name} className="flex items-center justify-between text-[10px]">
                  <span className="flex items-center gap-1.5 text-[#6B7280]">
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: DEMO_COLORS[i] }} />
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
                  label: 'Time to Hire',
                  value: '28 Days',
                  growth: '-2.1%',
                  color: INDIGO,
                  spark: HQ_SVG_ASSETS.openJobs.spark,
                },
                {
                  label: 'Offer Acceptance',
                  value: '76%',
                  growth: '+4.2%',
                  color: PURPLE,
                  spark: HQ_SVG_ASSETS.applications.spark,
                },
                {
                  label: 'Placement Rate',
                  value: '42%',
                  growth: '+3.8%',
                  color: TEAL,
                  spark: HQ_SVG_ASSETS.activeApplications.spark,
                },
                {
                  label: 'Retention',
                  value: '88%',
                  growth: '+1.6%',
                  color: SUCCESS,
                  spark: HQ_SVG_ASSETS.profileCompleteness.spark,
                },
              ].map((m) => (
                <div key={m.label} className="rounded-xl border border-slate-100 bg-slate-50/80 p-2.5">
                  <p className="text-[9px] font-semibold uppercase tracking-wide text-slate-400 leading-tight">{m.label}</p>
                  <p className="mt-1 text-lg font-bold" style={{ color: m.color }}>
                    {m.value}
                  </p>
                  <img src={m.spark} alt="" className="mt-1.5 h-5 w-full object-fill" />
                  <p className="mt-0.5 text-[10px] font-semibold text-emerald-600">{m.growth}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* ROW 5 */}
        <div className="mb-6 grid grid-cols-12 gap-6">
          <Card className="col-span-12 lg:col-span-4 !p-0 overflow-hidden">
            <div className="border-b border-slate-100 px-6 py-4">
              <h3 className="text-sm font-semibold text-[#111827]">Recent Activity</h3>
            </div>
            <HqPhase2ActivityFeed activities={activities} />
          </Card>

          <Card className="col-span-12 lg:col-span-5">
            <Title title="System Health" />
            <HqPhase2SystemHealth />
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

        <HqPhase2Footer updatedLabel={updatedLabel} />
      </div>
    </div>
  );
}
