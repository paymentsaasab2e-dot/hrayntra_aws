'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { Building, CreditCard, LayoutDashboard, Loader2, Radio, RefreshCcw, Search, Ticket, Users, X } from 'lucide-react';
import Link from 'next/link';
import {
  apiHqGetTenantBehavior,
  type HqEmployerAnalytics,
  type HqEmployerTenantRow,
  type HqTenantBehaviorAnalysis,
  type HqTenantRow,
} from '@/lib/api';
import { HqModulePageLayout } from '@/components/hq/HqModulePageLayout';
import { HqTenantBehaviorDrawer } from '@/components/hq/HqTenantBehaviorDrawer';
import { useHqMoney } from '@/components/hq/HqCurrencyProvider';
import { HQ_SVG_ASSETS, HqSvgKpiCard } from './HqSvgKpiCard';
import { HqDashCategoryTabs } from './HqDashCategoryTabs';
import {
  HqPhase2ActivityFeed,
  HqPhase2Card as Card,
  HqPhase2Footer,
  HqPhase2HealthGauge as HealthGauge,
  HqInfoTip,
  HqPhase2SystemHealth,
  HqPhase2Title as Title,
} from './HqPhase2DashboardParts';

const HQ_DASH_BTN_PRIMARY =
  'inline-flex h-10 items-center justify-center gap-2 rounded-full bg-slate-900 px-5 text-sm font-semibold text-white shadow-[0_10px_24px_-10px_rgba(15,23,42,0.55)] transition hover:bg-slate-800 disabled:opacity-50';
const HQ_DASH_BTN_SECONDARY =
  'inline-flex h-10 items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-800 shadow-[0_8px_20px_-12px_rgba(15,23,42,0.35)] transition hover:border-slate-300 hover:bg-slate-50 disabled:opacity-50';

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
/** Distinct hues — blue · teal · red · orange · amber · green (no adjacent violet twins) */
const FUNNEL_COLORS = [BLUE, TEAL, DANGER, ORANGE, WARNING, SUCCESS];
const PLAN_COLORS = [INDIGO, PURPLE, TEAL, ORANGE, BLUE];
const HIRE_COLORS = [BLUE, TEAL, DANGER, ORANGE, WARNING, SUCCESS];
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

function pct(part: number, whole: number) {
  if (!whole) return 0;
  return Math.round((part / whole) * 1000) / 10;
}

function formatActiveMs(ms: number) {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return `${totalSec}s`;
}

function toBehaviorDrawerTenant(row: HqEmployerTenantRow): HqTenantRow {
  return {
    id: row.tenantDbName || row.email || row.name,
    name: row.name || row.tenantDbName || 'Tenant',
    email: row.email || '',
    loginId: row.email || row.tenantDbName || '',
    organizationType: row.organizationType === 'agency' ? 'agency' : 'standalone',
    signupSource: row.signupSource,
    subscriptionPlan: null,
    tenantDbName: row.tenantDbName,
    tenantProvisioningMode: '',
    status: row.status,
    createdAt: null,
    updatedAt: null,
  };
}

type LiveRange = 'today' | 'week' | 'month';

function behaviorMetricsForRange(analysis: HqTenantBehaviorAnalysis | undefined, range: LiveRange) {
  if (!analysis) return { visits: 0, actions: 0, activeMs: 0, onlineNow: 0, health: 0, lastAt: null as string | null };
  if (range === 'today') {
    return {
      visits: num(analysis.todayMetrics?.visits),
      actions: num(analysis.todayMetrics?.actions),
      activeMs: num(analysis.todayMetrics?.activeMs),
      onlineNow: num(analysis.engagement?.onlineNow),
      health: num(analysis.tenantHealthScore),
      lastAt: analysis.engagement?.lastActivityAt || null,
    };
  }
  // week + month both use 7d rollups from the behaviour engine (30d rollup not stored yet)
  return {
    visits: num(analysis.weekMetrics?.visits ?? analysis.engagement?.totalVisits7d),
    actions: num(analysis.weekMetrics?.actions ?? analysis.engagement?.totalActions7d),
    activeMs: num(analysis.weekMetrics?.activeMs ?? analysis.engagement?.totalActiveMs7d),
    onlineNow: num(analysis.engagement?.onlineNow),
    health: num(analysis.tenantHealthScore),
    lastAt: analysis.engagement?.lastActivityAt || null,
  };
}

function mapPoints(rows?: Array<{ name: string; value: number }> | null) {
  if (!rows?.length) return [] as { name: string; value: number }[];
  return rows.map((d) => ({ name: String(d.name), value: Number(d.value) || 0 }));
}

function seriesToSpark(rows: { value: number }[] | null | undefined, fallback = 0) {
  const vals = (rows?.length ? rows : [{ value: fallback }]).map((d) => Number(d.value) || 0);
  const last = vals[vals.length - 1] ?? fallback;
  const POINTS = 8;

  // One or two category points (e.g. single job status) look like a dot in Recharts —
  // synthesize a short trend ending at the current value so the sparkline always renders.
  let series: number[];
  if (vals.length < 3) {
    series = Array.from({ length: POINTS }, (_, i) => {
      const t = i / (POINTS - 1);
      const eased = 0.4 + 0.6 * t;
      return Math.max(0, Math.round(last * eased * 100) / 100);
    });
    series[POINTS - 1] = last;
  } else {
    series = vals.slice(-POINTS);
    while (series.length < POINTS) series.unshift(series[0] ?? 0);
  }
  return series.map((v, i) => ({ i, v }));
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

const EMPLOYER_CATEGORY_TABS = [
  {
    id: 'growth',
    label: 'Growth & tenants',
    blurb: 'Demo acquisition, lead funnel, tenant activity, and plan mix',
  },
  {
    id: 'health',
    label: 'Health & hiring',
    blurb: 'Platform health, feature usage, hiring throughput, and workload mix',
  },
  {
    id: 'market',
    label: 'Market, risk & activity',
    blurb: 'Geography, rankings, at-risk tenants, ops benchmarks, and recent platform events',
  },
  {
    id: 'live',
    label: 'Live tracking',
    blurb: 'Tenant behaviour tracking — search employers, filter today / week / month, open a tenant for full detail',
  },
] as const;

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
  const { formatMoney: money, currency } = useHqMoney();
  const [tenantQuery, setTenantQuery] = useState('');
  const [billingFilter, setBillingFilter] = useState<'all' | 'free' | 'paid'>('all');
  const [selectedTenantIds, setSelectedTenantIds] = useState<string[]>([]);
  const [category, setCategory] = useState<(typeof EMPLOYER_CATEGORY_TABS)[number]['id']>('growth');

  /** Live tracking — tenant behaviour */
  const [liveSearch, setLiveSearch] = useState('');
  const [liveSuggestOpen, setLiveSuggestOpen] = useState(false);
  const [liveCategory, setLiveCategory] = useState('all');
  const [liveSort, setLiveSort] = useState<'latest' | 'oldest' | 'activity' | 'jobs'>('activity');
  const [liveRange, setLiveRange] = useState<LiveRange>('today');
  const [behaviorByTenant, setBehaviorByTenant] = useState<Record<string, HqTenantBehaviorAnalysis>>({});
  const [behaviorLoading, setBehaviorLoading] = useState(false);
  const [behaviorTenant, setBehaviorTenant] = useState<HqTenantRow | null>(null);
  const liveSearchWrapRef = useRef<HTMLDivElement>(null);
  const behaviorFetchGen = useRef(0);

  const k = data?.kpis;
  const c = data?.charts;
  const t = data?.tables;
  const isLive = Boolean(data?.live ?? data?.available);

  const allTenants = useMemo(() => t?.rankedTenants || [], [t]);

  const tenantKey = (row: HqEmployerTenantRow) => row.tenantDbName || row.name;

  const liveCategoryOptions = useMemo(() => {
    const set = new Set<string>();
    for (const row of allTenants) {
      if (row.organizationType) set.add(String(row.organizationType));
      if (row.plan) set.add(`Plan · ${row.plan}`);
    }
    return ['all', ...[...set].sort()];
  }, [allTenants]);

  const liveSearchSuggestions = useMemo(() => {
    const q = liveSearch.trim().toLowerCase();
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
    for (const row of allTenants) {
      const key = tenantKey(row);
      if (row.name) push(`n-${key}`, row.name, row.tenantDbName || row.email, row.name);
      if (row.tenantDbName) {
        push(`db-${key}`, row.tenantDbName, row.name || 'Tenant db', row.tenantDbName);
      }
      if (row.email) push(`e-${key}`, row.email, row.name || 'Email', row.email);
      if (row.plan) push(`p-${row.plan}`, String(row.plan), 'Plan', String(row.plan));
      if (row.organizationType) {
        push(
          `t-${row.organizationType}`,
          String(row.organizationType),
          'Org type',
          String(row.organizationType),
        );
      }
    }
    return out.slice(0, 10);
  }, [liveSearch, allTenants]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!liveSearchWrapRef.current?.contains(e.target as Node)) {
        setLiveSuggestOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const clearLiveFilters = () => {
    setLiveSearch('');
    setLiveCategory('all');
    setLiveSort('activity');
    setLiveRange('today');
  };

  const filteredTenants = useMemo(() => {
    const q = tenantQuery.trim().toLowerCase();
    return allTenants.filter((row) => {
      const plan = String(row.plan || '').toLowerCase();
      const isFree =
        !plan ||
        plan === 'unassigned' ||
        plan.includes('trial') ||
        plan.includes('free') ||
        String(row.signupSource || '').includes('trial');
      if (billingFilter === 'free' && !isFree) return false;
      if (billingFilter === 'paid' && isFree) return false;
      if (!q) return true;
      return (
        String(row.name || '').toLowerCase().includes(q) ||
        String(row.tenantDbName || '').toLowerCase().includes(q) ||
        String(row.email || '').toLowerCase().includes(q) ||
        plan.includes(q)
      );
    });
  }, [allTenants, tenantQuery, billingFilter]);

  const selectedTenants = useMemo(() => {
    if (!selectedTenantIds.length) return [] as HqEmployerTenantRow[];
    const set = new Set(selectedTenantIds);
    return allTenants.filter((r) => set.has(tenantKey(r)));
  }, [allTenants, selectedTenantIds]);

  /** Scoped tenants: picks → else Free/Paid/search cohort → else null (platform). */
  const scopedTenants = useMemo(() => {
    if (selectedTenants.length) return selectedTenants;
    if (billingFilter !== 'all' || tenantQuery.trim()) return filteredTenants;
    return null as HqEmployerTenantRow[] | null;
  }, [selectedTenants, billingFilter, tenantQuery, filteredTenants]);

  const isTenantScoped = Boolean(scopedTenants && scopedTenants.length);

  const scopedTenantMatch = useCallback(
    (name?: string | null, db?: string | null) => {
      if (!scopedTenants?.length) return true;
      const n = String(name || '').toLowerCase();
      const d = String(db || '').toLowerCase();
      return scopedTenants.some((r) => {
        const rn = String(r.name || '').toLowerCase();
        const rd = String(r.tenantDbName || '').toLowerCase();
        return (n && (n === rn || n.includes(rn) || rn.includes(n))) || (d && d === rd);
      });
    },
    [scopedTenants],
  );

  const scopeLabel = useMemo(() => {
    if (selectedTenants.length === 1) {
      return selectedTenants[0].name || selectedTenants[0].tenantDbName;
    }
    if (selectedTenants.length > 1) return `${selectedTenants.length} tenants`;
    if (billingFilter === 'free') return 'Free / trial cohort';
    if (billingFilter === 'paid') return 'Paid cohort';
    if (tenantQuery.trim()) return `Search · ${filteredTenants.length} match`;
    return null as string | null;
  }, [selectedTenants, billingFilter, tenantQuery, filteredTenants.length]);

  const toggleTenant = (id: string) => {
    setSelectedTenantIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const liveScopeActive = Boolean(
    isTenantScoped || liveSearch.trim() || liveCategory !== 'all',
  );

  const filteredLiveTenants = useMemo(() => {
    const q = liveSearch.trim().toLowerCase();
    const base = scopedTenants?.length ? scopedTenants : allTenants;
    let rows = base.filter((row) => {
      if (liveCategory !== 'all') {
        const org = String(row.organizationType || '');
        const plan = row.plan ? `Plan · ${row.plan}` : '';
        if (org !== liveCategory && plan !== liveCategory) return false;
      }
      if (q) {
        const hay = [
          row.name,
          row.tenantDbName,
          row.email,
          row.plan,
          row.organizationType,
          row.status,
          row.signupSource,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    rows = [...rows].sort((a, b) => {
      if (liveSort === 'activity') {
        const am = behaviorMetricsForRange(behaviorByTenant[tenantKey(a)], liveRange);
        const bm = behaviorMetricsForRange(behaviorByTenant[tenantKey(b)], liveRange);
        const diff =
          bm.actions + bm.visits + bm.onlineNow * 10 - (am.actions + am.visits + am.onlineNow * 10);
        if (diff !== 0) return diff;
        return num(b.activityScore) - num(a.activityScore);
      }
      if (liveSort === 'jobs') return num(b.openJobs) - num(a.openJobs);
      const an = String(a.name || a.tenantDbName || '').toLowerCase();
      const bn = String(b.name || b.tenantDbName || '').toLowerCase();
      return liveSort === 'oldest' ? bn.localeCompare(an) : an.localeCompare(bn);
    });
    return rows;
  }, [allTenants, scopedTenants, liveSearch, liveCategory, liveSort, behaviorByTenant, liveRange]);

  const liveTenantDbKey = useMemo(
    () =>
      filteredLiveTenants
        .filter((r) => Boolean(r.tenantDbName))
        .slice(0, 20)
        .map((r) => r.tenantDbName)
        .join('|'),
    [filteredLiveTenants],
  );

  const liveTenantSlice = useMemo(
    () => filteredLiveTenants.filter((r) => Boolean(r.tenantDbName)).slice(0, 20),
    [filteredLiveTenants, liveTenantDbKey],
  );

  useEffect(() => {
    if (category !== 'live') return;
    const keys = liveTenantDbKey ? liveTenantDbKey.split('|').filter(Boolean) : [];
    if (!keys.length) {
      setBehaviorByTenant({});
      setBehaviorLoading(false);
      return;
    }

    const gen = ++behaviorFetchGen.current;
    let cancelled = false;
    let first = true;

    const run = async () => {
      if (first) setBehaviorLoading(true);
      const next: Record<string, HqTenantBehaviorAnalysis> = {};
      const concurrency = 4;
      for (let i = 0; i < keys.length; i += concurrency) {
        if (cancelled || behaviorFetchGen.current !== gen) return;
        const batch = keys.slice(i, i + concurrency);
        const results = await Promise.allSettled(
          batch.map(async (db) => {
            const res = await apiHqGetTenantBehavior(db);
            return { db, data: res.data };
          }),
        );
        for (const result of results) {
          if (result.status === 'fulfilled' && result.value.data) {
            next[result.value.db] = result.value.data;
          }
        }
      }
      if (cancelled || behaviorFetchGen.current !== gen) return;
      setBehaviorByTenant(next);
      setBehaviorLoading(false);
      first = false;
    };

    void run();
    const timer = window.setInterval(() => {
      void run();
    }, 20000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [category, liveTenantDbKey]);

  const liveBehaviorRows = useMemo(() => {
    return liveTenantSlice.map((row) => {
      const key = row.tenantDbName;
      const analysis = key ? behaviorByTenant[key] : undefined;
      const metrics = behaviorMetricsForRange(analysis, liveRange);
      return { row, analysis, metrics };
    });
  }, [liveTenantSlice, behaviorByTenant, liveRange]);

  const liveBehaviorPulse = useMemo(() => {
    let online = 0;
    let visits = 0;
    let actions = 0;
    let activeMs = 0;
    let healthSum = 0;
    let healthN = 0;
    let withData = 0;
    for (const item of liveBehaviorRows) {
      online += item.metrics.onlineNow;
      visits += item.metrics.visits;
      actions += item.metrics.actions;
      activeMs += item.metrics.activeMs;
      if (item.analysis) {
        withData += 1;
        healthSum += item.metrics.health;
        healthN += 1;
      }
    }
    return {
      tenants: liveBehaviorRows.length,
      online,
      visits,
      actions,
      activeMs,
      avgHealth: healthN ? Math.round(healthSum / healthN) : 0,
      withData,
    };
  }, [liveBehaviorRows]);

  const clientFeatureUsage = useMemo(() => {
    if (!scopedTenants) return mapPoints(c?.featureUsage);
    if (!scopedTenants.length) return [];
    const sum = (fn: (r: HqEmployerTenantRow) => number) =>
      scopedTenants.reduce((s, r) => s + fn(r), 0);
    return [
      { name: 'Open jobs', value: sum((r) => num(r.openJobs)) },
      { name: 'Candidates', value: sum((r) => num(r.candidates)) },
      { name: 'Applications', value: sum((r) => num(r.applications)) },
      { name: 'Apps (7d)', value: sum((r) => num(r.applications7d)) },
      { name: 'Interviews', value: sum((r) => num(r.interviews)) },
      { name: 'Placements', value: sum((r) => num(r.placements)) },
      { name: 'Open tasks', value: sum((r) => num(r.tasksOpen)) },
    ].filter((r) => r.value > 0);
  }, [scopedTenants, c]);

  const selectedTenant = selectedTenants[0] || null;

  const companies = num(k?.hqCompanies);
  const tenants = num(k?.tenants);
  const trials = num(k?.landingTrials ?? k?.demosTrials);
  const paid = num(k?.onPlan);
  const demos = num(k?.demosTotal) || num(k?.demosVerified) + num(k?.demosPurchases) + num(k?.demosTrials);
  const demosPending = num(k?.demosPending);
  const demosGiven = num(k?.demosVerified);
  const trialsLive = num(k?.demosTrialsLive);
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
    if (scopedTenants && scopedTenants.length) {
      const sum = (fn: (r: HqEmployerTenantRow) => number) =>
        scopedTenants.reduce((s, r) => s + fn(r), 0);
      const steps = [
        { name: 'Jobs', value: sum((r) => num(r.openJobs) || num(r.jobs)) },
        { name: 'Applications', value: sum((r) => num(r.applications)) },
        { name: 'Interviews', value: sum((r) => num(r.interviews)) },
        { name: 'Placements', value: sum((r) => num(r.placements)) },
        { name: 'Joined', value: sum((r) => num(r.placementsJoined)) },
      ];
      return steps.map((d, i) => ({
        name: d.name,
        value: d.value,
        rate: i === 0 ? 100 : pct(d.value, steps[i - 1]?.value || 0),
      }));
    }
    const fromApi = mapPoints(c?.hiringFunnel).filter(
      (d) => !/^candidates?$/i.test(String(d.name).trim()),
    );
    const steps = fromApi.length
      ? fromApi
      : [
      { name: 'Jobs', value: num(k?.jobs) || activeJobs },
      { name: 'Applications', value: applications },
      { name: 'Interviews', value: interviews },
      { name: 'Placements', value: placements },
      { name: 'Joined', value: placementsJoined },
    ];
    return steps.map((d, i) => ({
      name: d.name,
      value: d.value,
      rate: i === 0 ? 100 : pct(d.value, steps[i - 1]?.value || 0),
    }));
  }, [scopedTenants, c, k, activeJobs, applications, interviews, placements, placementsJoined]);

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
    let rows: { name: string; value: number }[];
    if (scopedTenants && scopedTenants.length) {
      const sum = (fn: (r: HqEmployerTenantRow) => number) =>
        scopedTenants.reduce((s, r) => s + fn(r), 0);
      rows = [
        { name: 'Jobs', value: sum((r) => num(r.openJobs) || num(r.jobs)) },
        { name: 'Candidates', value: sum((r) => num(r.candidates)) },
        { name: 'Applications', value: sum((r) => num(r.applications)) },
        { name: 'Interviews', value: sum((r) => num(r.interviews)) },
        { name: 'CRM Leads', value: sum((r) => num(r.leads)) },
        { name: 'Clients', value: sum((r) => num(r.clients)) },
      ].filter((r) => r.value > 0);
    } else {
      rows = [
      { name: 'Jobs', value: num(k?.jobs) || activeJobs },
      { name: 'Candidates', value: candidates },
      { name: 'Applications', value: applications },
      { name: 'Interviews', value: interviews },
      { name: 'CRM Leads', value: hqLeads + num(k?.tenantLeads) },
      { name: 'Clients', value: num(k?.clients) },
    ].filter((r) => r.value > 0);
    }
    const total = rows.reduce((s, r) => s + r.value, 0) || 1;
    return rows.map((r) => ({
      name: r.name,
      value: Math.round((r.value / total) * 1000) / 10,
      count: r.value,
    }));
  }, [scopedTenants, k, activeJobs, candidates, applications, interviews, hqLeads]);

  const scopedHealthScore = useMemo(() => {
    if (!scopedTenants || !scopedTenants.length) return null as number | null;
    const vals = scopedTenants
      .map((r) => (typeof r.health === 'number' ? r.health : null))
      .filter((n): n is number => n != null);
    if (!vals.length) return null;
    return Math.round(vals.reduce((s, n) => s + n, 0) / vals.length);
  }, [scopedTenants]);

  const geoRows = useMemo(() => {
    const map: Record<string, number> = {};
    // HQ CRM geo is platform-wide — skip when tenant-scoped
    if (!isTenantScoped) {
    for (const row of t?.crmCompanies || []) {
      const key = String(row.country || '').trim();
      if (key) map[key] = (map[key] || 0) + 1;
    }
    for (const row of t?.crmLeads || []) {
      const key = String(row.country || '').trim();
      if (key) map[key] = (map[key] || 0) + 1;
      }
    }
    for (const row of t?.recentJobs || []) {
      if (isTenantScoped && !scopedTenantMatch(row.tenant, row.tenantDbName)) continue;
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
  }, [t, isTenantScoped, scopedTenantMatch]);

  const topTenants = useMemo(() => {
    const source = scopedTenants?.length
      ? [...scopedTenants].sort(
          (a, b) =>
            num(b.health) - num(a.health) ||
            num(b.applications7d) - num(a.applications7d) ||
            num(b.openJobs) - num(a.openJobs),
        )
      : t?.rankedTenants || [];
    return source.slice(0, 8).map((row) => {
      const health =
        typeof row.health === 'number'
          ? Math.min(100, Math.max(0, Math.round(row.health)))
          : (() => {
              let score = 0;
              if (row.openJobs > 0) score += 25;
              if ((row.applications7d || 0) > 0) score += 25;
              if ((row.interviews || 0) > 0) score += 20;
              if ((row.placements || 0) > 0) score += 20;
              if ((row.applications7d || 0) > 0 || row.openJobs > 0) score += 10;
              return score;
            })();
      return {
        name: row.name || row.tenantDbName || '—',
        plan: row.plan || '—',
        jobs: row.openJobs,
        apps: row.applications,
        placements: row.placements,
        health,
      };
    });
  }, [t, scopedTenants]);

  const atRiskTenants = useMemo(() => {
    const fromApi = t?.atRiskTenants || [];
    let rows =
      fromApi.length > 0
        ? fromApi.slice(0, 12).map((row) => ({
            name: row.name || row.tenantId || '—',
            plan: row.plan || '—',
            health: row.health || 0,
            reason: row.reason || 'at risk',
            jobs: row.openJobs || 0,
            apps7d: row.applications7d || 0,
          }))
        : topTenants
            .filter((r) => r.health < 40 || r.jobs === 0)
            .slice(0, 8)
            .map((r) => ({
              name: r.name,
              plan: r.plan,
              health: r.health,
              reason: r.jobs === 0 ? 'zero open jobs' : 'low health',
              jobs: r.jobs,
              apps7d: 0,
            }));

    if (isTenantScoped && scopedTenants?.length) {
      rows = rows.filter((r) => scopedTenantMatch(r.name));
      // If API had no match, derive at-risk from scoped tenants directly
      if (!rows.length) {
        rows = scopedTenants
          .filter((r) => {
            const h = typeof r.health === 'number' ? r.health : 50;
            return h < 40 || num(r.openJobs) === 0 || num(r.applications7d) === 0;
          })
          .slice(0, 8)
          .map((r) => ({
            name: r.name || r.tenantDbName || '—',
            plan: r.plan || '—',
            health: typeof r.health === 'number' ? Math.round(r.health) : 0,
            reason:
              num(r.openJobs) === 0
                ? 'zero open jobs'
                : num(r.applications7d) === 0
                  ? 'no apps / 7d'
                  : 'low health',
            jobs: num(r.openJobs),
            apps7d: num(r.applications7d),
          }));
      }
    }
    return rows.slice(0, 8);
  }, [t, topTenants, isTenantScoped, scopedTenants, scopedTenantMatch]);

  const jobsByStatusRows = useMemo(() => {
    if (scopedTenants?.length) {
      const open = scopedTenants.reduce((s, r) => s + num(r.openJobs), 0);
      const closed = scopedTenants.reduce((s, r) => s + num(r.closedJobs), 0);
      return [
        { name: 'Open', value: open },
        { name: 'Closed', value: closed },
      ].filter((r) => r.value > 0);
    }
    return mapPoints(c?.jobsByStatus);
  }, [scopedTenants, c]);

  const concentration = useMemo(() => {
    const top1 = num(k?.concentrationTop1JobsPct);
    const top3 = num(k?.concentrationTop3JobsPct);
    if (top1 > 0 || top3 > 0) {
      const ranked = [...(t?.rankedTenants || [])].sort((a, b) => b.openJobs - a.openJobs);
      return { top1, top3, name: ranked[0]?.name || tenantActivity[0]?.name || null };
    }
    const ranked = [...(t?.rankedTenants || [])].sort((a, b) => b.openJobs - a.openJobs);
    const sumJobs = ranked.reduce((s, r) => s + (r.openJobs || 0), 0) || activeJobs || 1;
    const t1 = ranked[0]?.openJobs || 0;
    const t3 = ranked.slice(0, 3).reduce((s, r) => s + (r.openJobs || 0), 0);
    return {
      top1: pct(t1, sumJobs),
      top3: pct(t3, sumJobs),
      name: ranked[0]?.name || null,
    };
  }, [k, tenantActivity, t, activeJobs]);

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
    const fromApi = mapPoints(c?.landingFunnel);
    const steps = (
      fromApi.length
        ? fromApi
        : [
            { name: 'Demo requested', value: demos },
            { name: 'Pending / scheduled', value: demosPending },
            { name: 'Demo given', value: demosGiven },
            { name: 'Free trials given', value: trials },
            { name: 'Trials active', value: trialsLive },
            { name: 'Paid / purchases', value: num(k?.demosPurchases) || paid },
          ]
    ).filter(
      (s) =>
        s.value > 0 ||
        ['Demo requested', 'Demo given', 'Free trials given', 'Paid / purchases'].includes(s.name),
    );
    const base = steps.length ? steps : [{ name: 'Tenants', value: tenants }];
    return base.map((s, i) => ({
      ...s,
      convPct: i === 0 ? null : pct(s.value, base[i - 1]?.value || 0),
    }));
  }, [c, demos, demosPending, demosGiven, trials, trialsLive, k, paid, tenants]);
  const maxConv = Math.max(...conversionFunnel.map((f) => f.value), 1);

  const landingStageCards = useMemo(
    () => [
      { label: 'Requested', value: demos, hint: 'All demo form submits' },
      { label: 'Scheduled', value: demosPending, hint: 'Pending OTP / awaiting' },
      { label: 'Demo given', value: demosGiven, hint: 'Verified demos' },
      { label: 'Trials given', value: trials, hint: 'Free trial requests' },
      { label: 'Using trial', value: trialsLive, hint: 'Provisioned & live' },
      { label: 'Paid', value: num(k?.demosPurchases), hint: 'Purchase requests' },
    ],
    [demos, demosPending, demosGiven, trials, trialsLive, k],
  );

  const healthScore = useMemo(() => {
    if (scopedHealthScore != null) return Math.min(100, Math.max(0, scopedHealthScore));
    if (typeof k?.platformHealthScore === 'number' && k.platformHealthScore > 0) {
      return Math.min(100, Math.max(0, Math.round(k.platformHealthScore)));
    }
    if (!tenants || !topTenants.length) return 0;
    return Math.min(
      100,
      Math.max(0, Math.round(topTenants.reduce((s, r) => s + r.health, 0) / topTenants.length)),
    );
  }, [scopedHealthScore, k, tenants, topTenants]);

  const scopedPulse = useMemo(() => {
    if (!scopedTenants || !scopedTenants.length) {
      return {
        active: activeTenants,
        paused,
        apps7d,
        top1: concentration.top1,
      };
    }
    const pausedN = scopedTenants.filter((r) => /pause|inactive/i.test(String(r.status || ''))).length;
    const apps = scopedTenants.reduce((s, r) => s + num(r.applications7d), 0);
    const jobs = scopedTenants.reduce((s, r) => s + num(r.openJobs), 0) || 1;
    const top = Math.max(...scopedTenants.map((r) => num(r.openJobs)), 0);
    return {
      active: Math.max(0, scopedTenants.length - pausedN),
      paused: pausedN,
      apps7d: apps,
      top1: pct(top, jobs),
    };
  }, [scopedTenants, activeTenants, paused, apps7d, concentration.top1]);

  const mrr = num(k?.mrr);
  const arr = num(k?.arr) || mrr * 12;

  /** Sum helpers for scoped tenant rows */
  const scopeSum = useCallback(
    (fn: (r: HqEmployerTenantRow) => number) =>
      (scopedTenants || []).reduce((s, r) => s + fn(r), 0),
    [scopedTenants],
  );

  const placementRate = pct(placementsJoined || placements, applications || 1);
  const interviewRate = pct(interviews, applications || 1);
  const joinRate = pct(placementsJoined, placements || 1);
  const leadConv = num(k?.hqLeadConversionRate);

  const scopedRates = useMemo(() => {
    if (!isTenantScoped || !scopedTenants?.length) return null;
    const apps = scopeSum((r) => num(r.applications));
    const ints = scopeSum((r) => num(r.interviews));
    const places = scopeSum((r) => num(r.placements));
    const joined = scopeSum((r) => num(r.placementsJoined));
    const openJ = scopeSum((r) => num(r.openJobs));
    const filledish = joined || places;
    return {
      interviewRate: pct(ints, apps || 1),
      placementRate: pct(places, apps || 1),
      joinRate: pct(joined, places || 1),
      fillRate: pct(filledish, openJ + filledish || 1),
      apps,
      ints,
      places,
      joined,
    };
  }, [isTenantScoped, scopedTenants, scopeSum]);

  const displayInterviewRate = scopedRates?.interviewRate ?? interviewRate;
  const displayPlacementRate = scopedRates?.placementRate ?? placementRate;
  const displayJoinRate = scopedRates?.joinRate ?? joinRate;

  const activities = useMemo(() => {
    const items: Array<{ text: string; time: string; color: string; at: number; weight: number }> = [];
    // Platform HQ demos / CRM leads only when not tenant-scoped
    if (!isTenantScoped) {
    for (const d of t?.recentDemos || []) {
      items.push({
        text: `Demo · ${d.company || d.name} · ${d.requestKind || d.status}`,
        time: formatWhen(d.submittedAt),
        color: PURPLE,
        at: d.submittedAt ? new Date(d.submittedAt).getTime() : 0,
          weight: 40,
      });
    }
    for (const lead of (t?.crmLeads || []).slice(0, 8)) {
      items.push({
        text: `HQ lead · ${lead.name || lead.company} · ${lead.stage}`,
        time: lead.nextFollowUp ? `Follow-up ${lead.nextFollowUp}` : 'CRM',
        color: ORANGE,
        at: 0,
          weight: 35,
      });
    }
    }
    for (const row of t?.recentTenantActivity || []) {
      if (isTenantScoped && !scopedTenantMatch(row.tenant, row.tenantDbName)) continue;
      items.push({
        text: `${row.tenant} · ${row.openJobs} open jobs · ${row.applications7d ?? 0} apps (7d)`,
        time: row.plan || 'tenant',
        color: TEAL,
        at: 0,
        weight: 30,
      });
    }
    for (const p of t?.recentPlacements || []) {
      if (isTenantScoped && !scopedTenantMatch(p.tenant, p.tenantDbName)) continue;
      items.push({
        text: `Placement · ${p.candidate || 'Candidate'} → ${p.company || p.job} (${p.status})`,
        time: formatWhen(p.updatedAt || p.joiningDate),
        color: SUCCESS,
        at: new Date(p.updatedAt || p.joiningDate || 0).getTime() || 0,
        weight: 25,
      });
    }
    for (const job of t?.recentJobs || []) {
      if (isTenantScoped && !scopedTenantMatch(job.tenant, job.tenantDbName)) continue;
      items.push({
        text: `Job “${job.title}” · ${job.company || job.tenant} · ${job.status}`,
        time: formatWhen(job.updatedAt),
        color: INDIGO,
        at: job.updatedAt ? new Date(job.updatedAt).getTime() : 0,
        weight: 10,
      });
    }
    items.sort((a, b) => b.weight - a.weight || b.at - a.at);
    return items.slice(0, 10).map(({ text, time, color }) => ({ text, time, color }));
  }, [t, isTenantScoped, scopedTenantMatch]);

  const systemHealth = useMemo(() => {
    if (isTenantScoped && scopedTenants?.length) {
      const n = scopedTenants.length;
      const pausedN = scopedPulse.paused;
      const openJ = scopeSum((r) => num(r.openJobs));
      const cands = scopeSum((r) => num(r.candidates));
      const ints = scopeSum((r) => num(r.interviews));
      const joined = scopeSum((r) => num(r.placementsJoined));
      const avgHealth =
        scopedHealthScore != null
          ? scopedHealthScore
          : Math.round(
              scopedTenants.reduce((s, r) => s + num(r.health), 0) / Math.max(n, 1),
            );
      const items = [
        {
          label: n === 1 ? 'Tenant' : 'Tenants',
          value: n === 1 ? String(scopedTenants[0].name || scopedTenants[0].tenantDbName) : `${n} scoped`,
          warn: false,
        },
        {
          label: 'Health',
          value: `${avgHealth}`,
          warn: avgHealth < 50,
        },
        {
          label: 'Open jobs',
          value: fmt(openJ),
          warn: false,
        },
        {
          label: 'Candidates',
          value: fmt(cands),
          warn: false,
        },
        {
          label: 'Apps (7d)',
          value: fmt(scopedPulse.apps7d),
          warn: false,
        },
        {
          label: 'Interviews',
          value: fmt(ints),
          warn: false,
        },
        {
          label: 'Joined',
          value: fmt(joined),
          warn: openJ > 0 && joined === 0,
        },
        {
          label: 'Paused',
          value: `${pausedN}`,
          warn: pausedN > 0,
        },
      ];
      // Hide empty/zero noise for single-tenant views
      return n === 1 ? items.filter((x) => x.label === 'Tenant' || x.label === 'Health' || !/^0$/.test(String(x.value))) : items;
    }
    return [
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
        label: 'Paid accounts',
        value: fmt(paid),
        warn: false,
      },
      {
        label: 'Joined',
        value: fmt(placementsJoined),
        warn: applications > 0 && placementsJoined === 0,
      },
      {
        label: 'Concentration',
        value: `${concentration.top1}% top-1`,
        warn: concentration.top1 >= 40,
      },
    ];
  }, [
    isTenantScoped,
    scopedTenants,
    scopedPulse,
    scopedHealthScore,
    scopeSum,
    isLive,
    tenants,
    paused,
    activeJobs,
    apps7d,
    paid,
    placementsJoined,
    applications,
    concentration,
  ]);

  const kpis = useMemo(() => {
    if (isTenantScoped && scopedTenants?.length) {
      const n = scopedTenants.length;
      const openJ = scopeSum((r) => num(r.openJobs));
      const closedJ = scopeSum((r) => num(r.closedJobs));
      const cands = scopeSum((r) => num(r.candidates));
      const cands7 = scopeSum((r) => num(r.candidates7d));
      const apps = scopeSum((r) => num(r.applications));
      const apps7 = scopeSum((r) => num(r.applications7d));
      const ints = scopeSum((r) => num(r.interviews));
      const intsToday = scopeSum((r) => num(r.interviewsToday));
      const places = scopeSum((r) => num(r.placements));
      const joined = scopeSum((r) => num(r.placementsJoined));
      const leads = scopeSum((r) => num(r.leads));
      const clients = scopeSum((r) => num(r.clients));
      const tasksOpen = scopeSum((r) => num(r.tasksOpen));
      const avgHealth =
        scopedHealthScore != null
          ? scopedHealthScore
          : Math.round(scopedTenants.reduce((s, r) => s + num(r.health), 0) / Math.max(n, 1));
      const planLabel =
        n === 1
          ? String(scopedTenants[0].plan || 'Unassigned')
          : `${scopedTenants.filter((r) => r.plan && !/trial|free|unassigned/i.test(String(r.plan))).length} paid plans`;

      const cards = [
        {
          label: n === 1 ? 'Workspace' : 'Scoped tenants',
          value: n === 1 ? String(scopedTenants[0].name || scopedTenants[0].tenantDbName).slice(0, 18) : n,
          growth: null as number | null,
          iconSrc: HQ_SVG_ASSETS.newCandidates.icon,
          sparkData: seriesToSpark([{ value: avgHealth }, { value: openJ }, { value: apps7 }]),
          sparkColor: PURPLE,
          compareLabel:
            n === 1
              ? `${scopedTenants[0].plan || '—'} · ${scopedTenants[0].status || '—'}`
              : planLabel,
          info: 'Tenant scope from search / chip selection — platform acquisition KPIs are hidden.',
        },
        {
          label: 'Health',
          value: avgHealth,
          growth: null,
          iconSrc: HQ_SVG_ASSETS.profileCompleteness.icon,
          sparkData: seriesToSpark([{ value: avgHealth }]),
          sparkColor: avgHealth >= 70 ? SUCCESS : avgHealth >= 40 ? WARNING : DANGER,
          compareLabel: avgHealth >= 70 ? 'Healthy' : avgHealth >= 40 ? 'Watch' : 'At risk',
          info: 'Average tenant health score for the current scope.',
        },
        {
          label: 'Open jobs',
          value: openJ,
          growth: null,
          iconSrc: HQ_SVG_ASSETS.openJobs.icon,
          sparkData: seriesToSpark([{ value: openJ }, { value: closedJ }]),
          sparkColor: INDIGO,
          compareLabel: `${closedJ} closed · ${scopedRates?.fillRate ?? 0}% fill-ish`,
          info: 'Open job postings in this tenant scope.',
        },
        {
          label: 'Candidates',
          value: cands,
          growth: null,
          iconSrc: HQ_SVG_ASSETS.totalCandidates.icon,
          sparkData: seriesToSpark([{ value: cands7 }, { value: cands }]),
          sparkColor: BLUE,
          compareLabel: `${cands7} new/7d`,
          info: 'Talent records in scoped tenant DBs.',
        },
        {
          label: 'Apps (7d)',
          value: apps7,
          growth: null,
          iconSrc: HQ_SVG_ASSETS.applications.icon,
          sparkData: seriesToSpark([{ value: apps7 }, { value: apps }]),
          sparkColor: TEAL,
          compareLabel: `${apps} total applications`,
          info: 'Applications in the last 7 days for this scope.',
        },
        {
          label: 'Interviews',
          value: ints,
          growth: null,
          iconSrc: HQ_SVG_ASSETS.interviewRequests.icon,
          sparkData: seriesToSpark([{ value: intsToday }, { value: ints }]),
          sparkColor: ORANGE,
          compareLabel: `${intsToday} today · ${scopedRates?.interviewRate ?? 0}% of apps`,
          info: 'Interviews scheduled/completed in scope.',
        },
        {
          label: 'Placements',
          value: places,
          growth: null,
          iconSrc: HQ_SVG_ASSETS.activeApplications.icon,
          sparkData: seriesToSpark([{ value: joined }, { value: places }]),
          sparkColor: SUCCESS,
          compareLabel: `${joined} joined · ${scopedRates?.joinRate ?? 0}% join`,
          info: 'Placements and joined hires for scoped tenants.',
        },
        {
          label: 'CRM · tasks',
          value: leads || clients || tasksOpen,
          growth: null,
          iconSrc: HQ_SVG_ASSETS.avgMatchScore.icon,
          sparkData: seriesToSpark([{ value: leads }, { value: clients }, { value: tasksOpen }]),
          sparkColor: PURPLE,
          compareLabel: `${leads} leads · ${clients} clients · ${tasksOpen} open tasks`,
          info: 'Tenant CRM size and open tasks (when present in snapshot).',
        },
      ];

      // Hide cards with no signal (except Workspace + Health)
      return cards.filter((card, idx) => {
        if (idx <= 1) return true;
        if (typeof card.value === 'number') return card.value > 0;
        return true;
      });
    }

    return [
    {
      label: 'Total Companies',
      value: companies,
      growth: null as number | null,
      iconSrc: HQ_SVG_ASSETS.totalCandidates.icon,
        sparkData: seriesToSpark(mapPoints(c?.companiesByStatus), companies),
      sparkColor: INDIGO,
      compareLabel: 'HQ CRM companies',
        info: 'Companies stored in HQ CRM — sales accounts, not platform tenants.',
    },
    {
      label: 'Total Tenants',
      value: tenants,
      growth: null,
      iconSrc: HQ_SVG_ASSETS.newCandidates.icon,
      sparkData: seriesToSpark(tenantActivity),
      sparkColor: PURPLE,
      compareLabel: `${activeTenants} active · ${paused} paused`,
        info: 'Customer workspaces on the platform. Active vs paused shows who can use the product.',
    },
    {
      label: 'Pipeline Value',
      value: money(pipelineValue),
      growth: null,
      iconSrc: HQ_SVG_ASSETS.avgMatchScore.icon,
        sparkData: seriesToSpark(pipelineStages, pipelineValue),
      sparkColor: TEAL,
        compareLabel: `${currency} · ${hqLeads} leads · ${hotLeads} hot`,
        info: `Sum of estimated deal values on open HQ CRM leads (stored in USD, shown in ${currency}).`,
    },
    {
        label: mrr > 0 ? 'MRR' : 'Candidates',
        value: mrr > 0 ? money(mrr) : candidates,
      growth: null,
      iconSrc: HQ_SVG_ASSETS.profileCompleteness.icon,
        sparkData: seriesToSpark(
          mrr > 0
            ? mapPoints(c?.mrrByPlan)
            : [{ value: candidates7d }, { value: apps7d }, { value: candidates }],
        ),
      sparkColor: BLUE,
        compareLabel:
          mrr > 0
            ? `ARR ${money(arr)} · ${candidates7d} new talent/7d`
            : `${candidates7d} new/7d · ${apps7d} apps/7d (DB size)`,
        info:
          mrr > 0
            ? 'Estimated monthly recurring revenue from priced tenant plans.'
            : 'Talent records across tenants. Prefer new/7d and apps/7d over raw DB size.',
    },
    {
      label: 'Trial Accounts',
      value: trials,
      growth: null,
      iconSrc: HQ_SVG_ASSETS.activeApplications.icon,
      sparkData: seriesToSpark([{ value: trials }, { value: paid }]),
      sparkColor: ORANGE,
      compareLabel: 'landing / demo trials',
        info: 'Tenants currently on a trial or landing-trial path.',
    },
    {
      label: 'Paid Accounts',
      value: paid,
      growth: null,
      iconSrc: HQ_SVG_ASSETS.applications.icon,
      sparkData: seriesToSpark(plans),
      sparkColor: SUCCESS,
      compareLabel: 'tenants on a plan',
        info: 'Tenants assigned to a paid subscription plan.',
    },
    {
      label: 'Demo Requests',
      value: demos,
      growth: null,
      iconSrc: HQ_SVG_ASSETS.interviewRequests.icon,
      sparkData: seriesToSpark(demoAnalytics),
      sparkColor: WARNING,
      compareLabel: `${num(k?.demosPurchases)} purchases`,
        info: 'Inbound demo / trial / purchase requests from the employer funnel.',
    },
    {
      label: 'Active Jobs',
      value: activeJobs,
      growth: null,
      iconSrc: HQ_SVG_ASSETS.openJobs.icon,
        sparkData: seriesToSpark(mapPoints(c?.jobsByStatus), activeJobs),
      sparkColor: INDIGO,
      compareLabel: `${num(k?.closedJobs)} closed · ${apps7d} apps/7d`,
        info: 'Open job postings across all tenants right now.',
      },
    ];
  }, [
    isTenantScoped,
    scopedTenants,
    scopedHealthScore,
    scopedRates,
    scopeSum,
    companies,
    tenants,
    activeTenants,
    paused,
    pipelineValue,
    pipelineStages,
    hqLeads,
    hotLeads,
    mrr,
    arr,
    candidates,
    candidates7d,
    apps7d,
    trials,
    paid,
    plans,
    demos,
    demoAnalytics,
    activeJobs,
    tenantActivity,
    c,
    k,
    currency,
    money,
  ]);

  const healthPanels = useMemo(() => {
    const hiringHas = hiringFunnelLive.some((s) => s.value > 0);
    const usageHas = clientFeatureUsage.length > 0;
    const workloadHas = platformUsage.length > 0;
    return {
      hiring: !isTenantScoped || hiringHas,
      health: true,
      usage: !isTenantScoped || usageHas,
      workload: !isTenantScoped || workloadHas,
    };
  }, [hiringFunnelLive, clientFeatureUsage, platformUsage, isTenantScoped]);

  const marketPanels = useMemo(() => {
    const geo = geoRows.length > 0;
    const top = topTenants.length > 0;
    const risk = atRiskTenants.length > 0;
    const jobs = jobsByStatusRows.length > 0;
    const recruitApps = isTenantScoped
      ? num(scopedRates?.apps) + num(scopedRates?.ints) + num(scopedRates?.places)
      : applications + interviews + placements;
    const recruit = recruitApps > 0 || (!isTenantScoped && leadConv > 0);
    const activity = activities.length > 0;
    return {
      geo,
      top,
      risk,
      jobs,
      recruit,
      activity,
      any: geo || top || risk || jobs || recruit || activity,
    };
  }, [
    geoRows,
    topTenants,
    atRiskTenants,
    jobsByStatusRows,
    isTenantScoped,
    scopedRates,
    applications,
    interviews,
    placements,
    leadConv,
    activities,
  ]);

  const liveTabHasStats = filteredLiveTenants.length > 0 || !isTenantScoped;

  const visibleCategoryTabs = useMemo(() => {
    return EMPLOYER_CATEGORY_TABS.filter((tab) => {
      if (tab.id === 'growth') return !isTenantScoped;
      if (tab.id === 'health') {
        if (!isTenantScoped) return true;
        return (
          healthPanels.hiring ||
          healthPanels.usage ||
          healthPanels.workload ||
          healthPanels.health
        );
      }
      if (tab.id === 'market') return !isTenantScoped || marketPanels.any;
      if (tab.id === 'live') return liveTabHasStats;
      return true;
    });
  }, [isTenantScoped, healthPanels, marketPanels, liveTabHasStats]);

  useEffect(() => {
    if (!visibleCategoryTabs.some((t) => t.id === category)) {
      setCategory((visibleCategoryTabs[0]?.id as typeof category) || 'health');
    }
  }, [visibleCategoryTabs, category]);

  const updatedLabel = generatedAt
    ? (() => {
        const mins = Math.max(0, Math.round((Date.now() - new Date(generatedAt).getTime()) / 60000));
        if (mins < 1) return 'just now';
        return mins < 60 ? `${mins} min ago` : `${Math.round(mins / 60)} hr ago`;
      })()
    : '—';

  return (
    <HqModulePageLayout
      title="Employers dashboard"
      subtitle="HQ management · platform usage, monetization & tenant health"
      icon={<LayoutDashboard className="h-5 w-5" />}
      locked={false}
      actions={
        <div className="flex max-w-full flex-wrap items-center justify-end gap-2">
          <Link href="/hq/company" prefetch={false} className={HQ_DASH_BTN_SECONDARY}>
            <Building className="h-4 w-4 text-indigo-600" />
            Companies
          </Link>
          <Link href="/hq?tab=tenants" prefetch={false} className={HQ_DASH_BTN_SECONDARY}>
            <Users className="h-4 w-4 text-blue-600" />
            Tenants
          </Link>
          <Link href="/hq?tab=plans" prefetch={false} className={HQ_DASH_BTN_SECONDARY}>
            <CreditCard className="h-4 w-4 text-amber-600" />
            Plans
          </Link>
          <Link href="/hq/tickets?audience=employer" prefetch={false} className={HQ_DASH_BTN_SECONDARY}>
            <Ticket className="h-4 w-4 text-violet-600" />
            Tickets
          </Link>
          <button type="button" onClick={onRefresh} disabled={loading} className={HQ_DASH_BTN_PRIMARY}>
            <RefreshCcw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      }
    >
      <div className="hq-dash-page text-slate-900">
        {/* Status strip only — nav actions stay in the sticky top bar */}
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className="inline-flex h-1.5 w-10 rounded-full bg-gradient-to-r from-indigo-500 to-teal-400" />
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700 ring-1 ring-emerald-200/90">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
            Live
          </span>
          {updatedLabel ? (
            <p className="text-[11px] text-slate-400">Last updated: {updatedLabel}</p>
          ) : null}
        </div>

        {/* Live pulse — platform-wide or tenant-scoped */}
        <div className="mb-3 rounded-2xl border border-white/80 bg-white/70 px-3 py-2.5 shadow-[0_10px_28px_-20px_rgba(15,23,42,0.18)] backdrop-blur-xl">
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                {isTenantScoped ? 'Tenant pulse' : 'Live platform'}
              </p>
              <HqInfoTip
                text={
                  isTenantScoped
                    ? 'Pulse for the current search / filter / selection — platform-wide acquisition stats are hidden.'
                    : 'Realtime pulse across tenants — jobs, apps, paid accounts, and concentration risk.'
                }
              />
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700 ring-1 ring-emerald-200/90">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
              {isTenantScoped ? 'Scoped' : 'Live'}
            </span>
          </div>
          <HqPhase2SystemHealth items={systemHealth} compact />
        </div>

        {/* Tenant filter — scopes KPI cards + Health charts */}
        <div className="mb-3 rounded-2xl border border-white/80 bg-white/80 px-3 py-2.5 shadow-[0_10px_28px_-20px_rgba(15,23,42,0.18)] backdrop-blur-xl">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center">
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <input
                  type="search"
                  value={tenantQuery}
                  onChange={(e) => setTenantQuery(e.target.value)}
                  placeholder="Search tenant, email, or plan…"
                  className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-800 outline-none ring-indigo-200 placeholder:text-slate-400 focus:ring-2"
                />
              </div>
              <div className="flex shrink-0 gap-1 rounded-xl border border-slate-200 bg-slate-50 p-0.5">
                {([
                  ['all', 'All'],
                  ['free', 'Free / trial'],
                  ['paid', 'Paid'],
                ] as const).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setBillingFilter(id)}
                    className={`rounded-lg px-3 py-1.5 text-[11px] font-semibold transition ${
                      billingFilter === id
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'text-slate-600 hover:bg-white'
                    }`}
                  >
                    {label}
                  </button>
            ))}
          </div>
            </div>
            {selectedTenantIds.length || scopeLabel ? (
              <button
                type="button"
                onClick={() => {
                  setSelectedTenantIds([]);
                  setTenantQuery('');
                  setBillingFilter('all');
                }}
                className="inline-flex items-center gap-1.5 self-start rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-[11px] font-semibold text-indigo-700"
              >
                Scope: {scopeLabel || `${selectedTenantIds.length} selected`}
                <X className="h-3.5 w-3.5" />
              </button>
            ) : (
              <p className="text-[11px] text-slate-500">
                Search or click chips — all tabs & KPI cards switch to that tenant (empty tabs hide)
              </p>
            )}
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {filteredTenants.slice(0, 10).map((row) => {
              const id = tenantKey(row);
              const active = selectedTenantIds.includes(id);
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => toggleTenant(id)}
                  className={`max-w-[200px] truncate rounded-lg border px-2.5 py-1 text-[11px] font-medium transition ${
                    active
                      ? 'border-indigo-300 bg-indigo-600 text-white'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-indigo-200 hover:bg-indigo-50'
                  }`}
                  title={`${row.name} · ${row.plan || '—'} · click to ${active ? 'remove' : 'add'}`}
                >
                  {row.name || row.tenantDbName}
                </button>
              );
            })}
            {filteredTenants.length === 0 ? (
              <span className="text-xs text-slate-400">No matching tenants</span>
        ) : null}
            {filteredTenants.length > 10 ? (
              <span className="self-center text-[10px] text-slate-400">
                +{filteredTenants.length - 10} more — refine search
              </span>
            ) : null}
          </div>
          {isTenantScoped ? (
            <p className="mt-2 text-[11px] font-medium text-indigo-700">
              Showing tenant workspace stats only · tabs/panels without data for this scope are hidden
            </p>
          ) : null}
        </div>

        <div
          className={`mb-3 grid gap-3 ${
            kpis.length <= 4
              ? 'grid-cols-2 sm:grid-cols-4'
              : kpis.length <= 6
                ? 'grid-cols-2 sm:grid-cols-3 xl:grid-cols-6'
                : 'grid-cols-2 sm:grid-cols-4 xl:grid-cols-8'
          }`}
        >
          {kpis.map((item) => (
            <HqSvgKpiCard key={item.label} item={item} />
          ))}
        </div>

        <HqDashCategoryTabs
          tabs={[...visibleCategoryTabs]}
          value={category}
          onChange={(id) => setCategory(id as typeof category)}
          instanceId="employers"
        />

        {category === 'growth' && !isTenantScoped ? (
        <section className="mb-2">
          {/* Bento grid — pack by size so columns fill (no empty mid-column void) */}
          <div className="grid grid-cols-12 gap-4">
            {/* Row 1: Demo | Funnel | Dist */}
            <Card className="col-span-12 flex h-full flex-col !p-4 lg:col-span-4">
            <Title
                title="Demo Analytics"
                info="Landing-page demo pipeline: requested → scheduled → given → free trial → active → paid."
              />
              <div className="mb-2 grid grid-cols-3 gap-1.5">
                {landingStageCards.map((s) => (
                  <div key={s.label} className="rounded-lg bg-slate-50 px-1.5 py-1.5 text-center" title={s.hint}>
                    <p className="text-[8px] font-semibold uppercase tracking-wide text-slate-400">{s.label}</p>
                    <p className="text-sm font-bold text-[#111827]">{fmt(s.value)}</p>
                </div>
                ))}
            </div>
              <div className="min-h-[140px] flex-1">
                {demoAnalytics.length ? (
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={demoAnalytics}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={36}
                        outerRadius={56}
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
                  <div className="flex h-full min-h-[140px] items-center justify-center text-xs text-slate-400">
                    No demos yet
                </div>
              )}
            </div>
              <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1">
                {demoAnalytics.slice(0, 4).map((s, i) => (
                  <div key={s.name} className="flex items-center justify-between text-[10px]">
                    <span className="flex items-center gap-1.5 truncate text-[#6B7280]">
                      <span
                        className="h-1.5 w-1.5 shrink-0 rounded-full"
                        style={{ background: DEMO_COLORS[i % DEMO_COLORS.length] }}
                      />
                      {s.name}
                    </span>
                    <span className="font-semibold text-[#111827]">{fmt(s.value)}</span>
                  </div>
                ))}
              </div>
          </Card>

            <Card className="col-span-12 flex h-full flex-col !p-4 lg:col-span-5">
              <Title
                title="Demo → Trial → Paid Funnel"
                info="Landing funnel stages matching the public demo flow. % is conversion from the previous stage."
              />
              <div className="flex flex-1 flex-col justify-center space-y-2.5">
                {conversionFunnel.map((step, i) => (
                  <div key={step.name} className="flex items-center gap-2">
                    <span className="w-[118px] shrink-0 text-right text-[10px] font-medium text-[#6B7280]">
                      {step.name}
                      {step.convPct != null ? (
                        <span className="mt-0.5 block text-[9px] font-semibold text-indigo-600">
                          {step.convPct}% ←
                        </span>
                      ) : null}
                    </span>
                    <div className="flex flex-1 justify-center">
                      <motion.div
                        initial={{ scaleX: 0.6, opacity: 0 }}
                        animate={{ scaleX: 1, opacity: 1 }}
                        transition={{ delay: i * 0.04 }}
                        className="flex h-7 items-center justify-center rounded-md text-[10px] font-bold text-white"
                        style={{
                          width: `${Math.max(22, (step.value / maxConv) * (100 - i * 6))}%`,
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

            <Card className="col-span-12 flex h-full flex-col !p-4 lg:col-span-3">
              <Title title="Tenant Distribution" info="Mix of agency vs standalone (and paused) customers." />
              <div className="min-h-[130px] flex-1">
              {tenantDist.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={tenantDist}
                      dataKey="value"
                      nameKey="name"
                        innerRadius={34}
                        outerRadius={52}
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
                  <div className="flex h-full min-h-[130px] items-center justify-center text-xs text-slate-400">
                    No data
                  </div>
              )}
            </div>
              <div className="mt-2 space-y-1.5">
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

            {/* Row 2: Activity (wide) | Plans | Lead Pipeline */}
            <Card className="col-span-12 flex h-full flex-col !p-4 lg:col-span-5">
              <Title
                title="Tenant Activity"
                info="How active each tenant is (jobs, apps, placements). High concentration means one customer dominates the platform."
                right={
                  <span className="rounded-lg border border-slate-200 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                    Live score
                  </span>
                }
              />
              <p className="mb-1.5 text-[11px] text-[#6B7280]">
                Pipeline: <strong className="text-[#111827]">{money(pipelineValue)}</strong>
                {' · '}
                {apps7d} apps / 7d
              </p>
              {concentration.top1 > 0 ? (
                <p
                  className={`mb-1.5 rounded-lg px-2 py-1 text-[10px] font-medium ${
                    concentration.top1 >= 40
                      ? 'bg-amber-50 text-amber-800 ring-1 ring-amber-200/80'
                      : 'bg-slate-50 text-slate-600'
                  }`}
                >
                  Top 1 = <strong>{concentration.top1}%</strong>
                  {concentration.name ? ` (${concentration.name})` : ''}
                  {' · '}
                  top 3 = <strong>{concentration.top3}%</strong>
                </p>
              ) : null}
              <div className="min-h-[200px] flex-1">
                {tenantActivity.length ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={tenantActivity} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="tenFillLive" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={INDIGO} stopOpacity={0.28} />
                          <stop offset="100%" stopColor={INDIGO} stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="4 8" stroke={gridStroke} vertical={false} />
                      <XAxis
                        dataKey="name"
                        tick={{ ...axisTick, fontSize: 9 }}
                        axisLine={false}
                        tickLine={false}
                        interval={0}
                      />
                      <YAxis tick={axisTick} axisLine={false} tickLine={false} width={28} />
                      <Tooltip contentStyle={tip} cursor={{ stroke: '#C7D2FE', strokeWidth: 1 }} />
                      <Area
                        type="monotone"
                        dataKey="value"
                        stroke={INDIGO}
                        fill="url(#tenFillLive)"
                        strokeWidth={2.4}
                        strokeLinecap="round"
                        activeDot={{ r: 4, strokeWidth: 2, stroke: '#fff' }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full min-h-[200px] items-center justify-center text-xs text-slate-400">
                    No tenant activity scores yet
                  </div>
                )}
              </div>
            </Card>

            <Card className="col-span-12 flex h-full flex-col !p-4 sm:col-span-6 lg:col-span-3">
              <Title
                title="Subscription Plans"
                info="How many tenants sit on each plan. MRR appears when plan prices are set."
              />
              {mrr > 0 ? (
                <p className="mb-1 text-[10px] font-medium text-emerald-700">
                  Est. MRR {money(mrr)} · ARR {money(arr)}
                </p>
              ) : (
                <p className="mb-1 text-[10px] text-slate-400">Pair with plan prices for MRR</p>
              )}
              <div className="min-h-[180px] flex-1">
              {plans.length ? (
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={plans} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="4 8" stroke={gridStroke} vertical={false} />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 9, fill: '#94A3B8' }}
                      axisLine={false}
                      tickLine={false}
                      interval={0}
                    />
                      <YAxis
                        tick={{ fontSize: 10, fill: '#94A3B8' }}
                        axisLine={false}
                        tickLine={false}
                        width={24}
                      />
                    <Tooltip contentStyle={tip} />
                      <Bar dataKey="value" radius={[6, 6, 0, 0]} barSize={16}>
                      {plans.map((_, i) => (
                        <Cell key={i} fill={PLAN_COLORS[i % PLAN_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                  <div className="flex h-full min-h-[180px] items-center justify-center text-xs text-slate-400">
                  No plan distribution yet
                </div>
              )}
            </div>
          </Card>

            <Card className="col-span-12 flex h-full flex-col !p-4 sm:col-span-6 lg:col-span-4">
              <Title
                title="Lead Pipeline"
                info="HQ CRM leads by stage, plus total pipeline value and lead conversion rate."
              />
              {pipelineStages.length ? (
                <div className="flex flex-1 flex-col justify-between gap-3">
                  <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                    {pipelineStages.map((s) => (
                      <div
                        key={s.name}
                        className="rounded-xl border border-slate-100 bg-slate-50/80 px-2 py-2.5 text-center"
                      >
                        <div
                          className="mx-auto mb-1 h-1.5 w-1.5 rounded-full"
                          style={{ background: s.color }}
                        />
                        <p className="text-[9px] font-medium leading-tight text-[#6B7280]">{s.name}</p>
                        <p className="mt-0.5 text-sm font-bold text-[#111827]">{fmt(s.value)}</p>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center justify-between rounded-xl border border-indigo-100 bg-indigo-50/50 px-3 py-3">
                    <div>
                      <p className="text-[10px] font-medium text-[#6B7280]">Pipeline Value</p>
                      <p className="mt-0.5 text-xl font-bold text-indigo-700">{money(pipelineValue)}</p>
                    </div>
                    <p className="text-xs font-semibold text-indigo-600">{leadConv}% conversion</p>
                  </div>
                </div>
              ) : (
                <p className="flex flex-1 items-center justify-center py-6 text-center text-xs text-slate-400">
                  No HQ lead stages yet
                </p>
              )}
            </Card>
          </div>
        </section>

        ) : null}

        {category === 'health' ? (
        <section className="mb-2">
          <div className="grid grid-cols-12 gap-4">
            {healthPanels.hiring ? (
            <Card className="col-span-12 flex h-full flex-col !p-4 lg:col-span-7">
              <Title
                title={scopeLabel ? `Hiring Funnel · ${scopeLabel}` : 'Hiring Funnel'}
                info="Hiring throughput for the current scope. Each % is conversion from the previous stage."
              />
              <p className="mb-3 text-[10px] text-slate-400">
                % = conversion from previous stage
                {scopeLabel ? ` · ${scopeLabel}` : ''}
              </p>
              <div className="grid flex-1 content-center grid-cols-1 gap-x-8 gap-y-3.5 sm:grid-cols-2">
              {hiringFunnelLive.map((step, i) => (
                <div key={step.name}>
                    <div className="mb-1 flex items-center justify-between text-[12px]">
                    <span className="font-semibold text-slate-700">{step.name}</span>
                    <span className="text-[#6B7280]">
                      <strong className="text-[#111827]">{fmt(step.value)}</strong>
                        {i > 0 ? ` · ${step.rate}% of prior` : ''}
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
            ) : null}

            {healthPanels.health ? (
            <Card className="col-span-12 flex h-full flex-col !p-4 sm:col-span-6 lg:col-span-5">
              <Title
                title={scopeLabel ? 'Tenant Health' : 'Platform Health'}
                info="Average tenant health (0–100) from open jobs, apps/7d, interviews, placements, and engagement."
              />
              <div className="flex flex-1 flex-col justify-center">
                <HealthGauge score={healthScore} />
                <div className="mt-2 grid grid-cols-2 gap-1.5">
                  <div className="rounded-lg bg-slate-50 px-2 py-1.5 text-center">
                    <p className="text-[9px] font-semibold uppercase tracking-wide text-slate-400">Active</p>
                    <p className="text-sm font-bold text-[#111827]">{fmt(scopedPulse.active)}</p>
                  </div>
                  <div className="rounded-lg bg-slate-50 px-2 py-1.5 text-center">
                    <p className="text-[9px] font-semibold uppercase tracking-wide text-slate-400">Paused</p>
                    <p className="text-sm font-bold text-[#111827]">{fmt(scopedPulse.paused)}</p>
                  </div>
                  <div className="rounded-lg bg-slate-50 px-2 py-1.5 text-center">
                    <p className="text-[9px] font-semibold uppercase tracking-wide text-slate-400">Apps / 7d</p>
                    <p className="text-sm font-bold text-[#111827]">{fmt(scopedPulse.apps7d)}</p>
                  </div>
                  <div className="rounded-lg bg-slate-50 px-2 py-1.5 text-center">
                    <p className="text-[9px] font-semibold uppercase tracking-wide text-slate-400">Top-1 jobs</p>
                    <p className="text-sm font-bold text-[#111827]">{scopedPulse.top1}%</p>
                  </div>
                </div>
                <p className="mt-2 text-center text-[10px] text-slate-400">
                  {scopeLabel ? `Scoped · ${scopeLabel}` : `Spec formula · ${topTenants.length} ranked`}
                </p>
              </div>
            </Card>
            ) : null}

            {healthPanels.usage ? (
            <Card className="col-span-12 flex h-full flex-col !p-4 lg:col-span-7">
              <Title
                title={
                  scopeLabel
                    ? selectedTenants.length > 1
                      ? `Usage · ${selectedTenants.length} tenants`
                      : `Usage · ${scopeLabel}`
                    : 'Feature usage'
                }
                info={
                  scopeLabel
                    ? 'Feature mix for the selected tenants / billing cohort. Clear scope to return to platform-wide.'
                    : 'Platform-wide feature mix. Filter Free/Paid or multi-select tenants above to drill in.'
                }
              />
              <div className="min-h-[200px] flex-1">
                {clientFeatureUsage.length ? (
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={clientFeatureUsage}
                      layout="vertical"
                      margin={{ top: 8, right: 16, left: 4, bottom: 8 }}
                    >
                      <CartesianGrid strokeDasharray="4 8" stroke={gridStroke} horizontal={false} />
                      <XAxis type="number" tick={axisTick} axisLine={false} tickLine={false} />
                      <YAxis
                        type="category"
                        dataKey="name"
                        width={84}
                        tick={{ ...axisTick, fontSize: 10 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip contentStyle={tip} />
                      <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={14}>
                        {clientFeatureUsage.map((_, i) => (
                          <Cell key={i} fill={FUNNEL_COLORS[i % FUNNEL_COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full min-h-[200px] items-center justify-center text-xs text-slate-400">
                    {scopeLabel ? 'No usage signals for this scope yet' : 'No feature usage data yet'}
                  </div>
                )}
              </div>
              {selectedTenants.length === 1 ? (
                <p className="mt-2 text-[11px] text-slate-500">
                  Plan <strong className="text-slate-700">{selectedTenants[0].plan || '—'}</strong>
                  {' · '}
                  Health{' '}
                  <strong className="text-slate-700">
                    {typeof selectedTenants[0].health === 'number'
                      ? Math.round(selectedTenants[0].health)
                      : '—'}
                  </strong>
                </p>
              ) : scopeLabel ? (
                <p className="mt-2 text-[11px] text-slate-500">
                  Showing summed feature counts for <strong className="text-slate-700">{scopeLabel}</strong>
                </p>
              ) : null}
            </Card>
            ) : null}

            {healthPanels.workload ? (
            <Card className="col-span-12 flex h-full flex-col !p-4 sm:col-span-6 lg:col-span-5">
              <Title
                title="Workload Mix"
                info="Share of records (jobs, candidates, apps…). Updates for the tenant scope from the filter bar."
              />
              <p className="mb-1 text-[10px] text-slate-400">
                {scopeLabel ? `Scoped · ${scopeLabel}` : 'Secondary · storage shape · platform'}
              </p>
              <div className="flex flex-1 flex-col items-stretch gap-3 sm:flex-row sm:items-center">
                <div className="h-[160px] w-full shrink-0 sm:w-[58%]">
                  {platformUsage.length ? (
                    <ResponsiveContainer width="100%" height={160}>
                  <PieChart>
                    <Pie
                      data={platformUsage}
                      dataKey="value"
                      nameKey="name"
                          cx="50%"
                          cy="50%"
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
                    <div className="flex h-[160px] items-center justify-center text-xs text-slate-400">
                      No usage yet for this scope
                    </div>
              )}
            </div>
                <div className="w-full space-y-1.5 sm:w-[42%] sm:shrink-0">
                  {platformUsage.slice(0, 5).map((s, i) => (
                <div key={s.name} className="flex items-center justify-between text-[10px]">
                  <span className="flex items-center gap-1.5 text-[#6B7280]">
                    <span
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ background: USAGE_COLORS[i % USAGE_COLORS.length] }}
                    />
                    {s.name}
                  </span>
                      <span className="font-semibold">
                        {s.value}%
                        {typeof s.count === 'number' ? ` · ${fmt(s.count)}` : ''}
                      </span>
                </div>
              ))}
                </div>
            </div>
          </Card>
            ) : null}
        </div>
        </section>
        ) : null}

        {category === 'market' ? (
        <section className="mb-2">
          <div className="grid grid-cols-12 gap-4">
            {marketPanels.geo ? (
            <Card className="col-span-12 flex h-full flex-col !p-4 lg:col-span-3">
              <Title
                title={scopeLabel ? `Locations · ${scopeLabel}` : 'Geographical'}
                info={
                  scopeLabel
                    ? 'Job locations for the scoped tenant(s).'
                    : 'Where HQ leads, companies, or jobs are located (top countries / cities).'
                }
              />
              <div className="mt-1 flex flex-1 flex-col justify-center space-y-2.5">
                {geoRows.map((row) => (
                  <div key={row.name} className="flex items-center justify-between text-[11px]">
                    <span className="truncate text-[#6B7280]">{row.name}</span>
                    <span className="font-semibold text-[#111827]">{fmt(row.value)}</span>
                  </div>
                ))}
              </div>
          </Card>
            ) : null}

            {marketPanels.top ? (
            <Card
              className={`col-span-12 flex h-full min-h-[220px] flex-col overflow-hidden !p-0 ${
                marketPanels.geo ? 'lg:col-span-9' : 'lg:col-span-12'
              }`}
            >
              <div className="flex items-center justify-between gap-3 border-b border-emerald-100/80 bg-gradient-to-r from-emerald-50/80 to-white px-4 py-2.5">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                    <span className="text-sm font-bold">↑</span>
                  </span>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <h3 className="text-sm font-semibold text-[#111827]">
                        {scopeLabel ? 'Scoped tenant performance' : 'Top Performing Tenants'}
                      </h3>
                      <HqInfoTip text="Tenants ranked by activity and health for the current scope." />
            </div>
                    <p className="text-[10px] font-medium text-emerald-700/80">
                      Ranked by activity &amp; health · {topTenants.length} shown
                      {scopeLabel ? ` · ${scopeLabel}` : ''}
                    </p>
                  </div>
                </div>
              </div>
              <div className="min-h-0 flex-1 overflow-auto">
                <table className="w-full min-w-[440px] text-left text-sm">
                  <thead className="sticky top-0 z-[1]">
                    <tr className="border-b border-slate-100 bg-slate-50/95 text-[10px] uppercase tracking-wider text-slate-400 backdrop-blur">
                      <th className="px-4 py-2 font-semibold">Tenant</th>
                      <th className="px-2 py-2 font-semibold">Plan</th>
                      <th className="px-2 py-2 font-semibold text-right">Jobs</th>
                      <th className="px-2 py-2 font-semibold text-right">Apps</th>
                      <th className="px-2 py-2 font-semibold text-right">Placed</th>
                      <th className="px-4 py-2 font-semibold text-right">Health</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topTenants.map((row, idx) => (
                      <tr
                        key={row.name}
                        className="border-b border-slate-50 last:border-0 hover:bg-emerald-50/40"
                      >
                        <td className="px-4 py-2">
                          <div className="flex items-center gap-2">
                            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-[10px] font-bold text-indigo-700">
                              {String(idx + 1).padStart(2, '0')}
                            </span>
                            <span className="truncate font-semibold text-[#111827]">{row.name}</span>
                          </div>
                        </td>
                        <td className="px-2 py-2">
                          <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">
                            {row.plan}
                          </span>
                        </td>
                        <td className="px-2 py-2 text-right font-medium tabular-nums">{fmt(row.jobs)}</td>
                        <td className="px-2 py-2 text-right font-medium tabular-nums">{fmt(row.apps)}</td>
                        <td className="px-2 py-2 text-right font-medium tabular-nums">{fmt(row.placements)}</td>
                        <td className="px-4 py-2 text-right">
                          <span
                            className={`inline-flex min-w-[2rem] justify-center rounded-full px-2 py-0.5 text-[11px] font-bold ${
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
            </div>
          </Card>
            ) : null}

            {marketPanels.risk ? (
            <Card className="col-span-12 flex h-full min-h-[240px] flex-col overflow-hidden !p-0 lg:col-span-4">
              <div className="flex items-center justify-between gap-3 border-b border-amber-100/80 bg-gradient-to-r from-amber-50/90 to-white px-4 py-2.5">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
                    <span className="text-sm font-bold">!</span>
                  </span>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <h3 className="text-sm font-semibold text-[#111827]">At-risk Tenants</h3>
                      <HqInfoTip text="Customers with low health, zero activity, or jobs with no recent applications." />
                    </div>
                    <p className="text-[10px] font-medium text-amber-700/80">
                      Needs attention · {atRiskTenants.length} flagged
                      {scopeLabel ? ` · ${scopeLabel}` : ''}
                    </p>
                  </div>
                </div>
              </div>
              <div className="min-h-0 flex-1 space-y-0 overflow-y-auto">
                {atRiskTenants.map((row) => (
                  <div
                    key={row.name}
                    className="border-b border-amber-50 px-4 py-2.5 last:border-0 hover:bg-amber-50/40"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-[#111827]">{row.name}</p>
                        <p className="mt-0.5 text-[10px] text-slate-500">
                          {row.plan} · {fmt(row.jobs)} jobs · {fmt(row.apps7d)} apps/7d
                        </p>
                        <div className="mt-1 flex flex-wrap gap-1">
                          <span className="rounded-md bg-amber-100/80 px-1.5 py-0.5 text-[9px] font-semibold text-amber-800">
                            {row.reason}
                          </span>
            </div>
                      </div>
                      <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-800">
                        {row.health}
                  </span>
                    </div>
                </div>
              ))}
            </div>
          </Card>
            ) : null}

            {marketPanels.jobs ? (
            <Card className="col-span-12 flex h-full min-h-[240px] flex-col !p-4 sm:col-span-6 lg:col-span-4">
              <Title
                title={scopeLabel ? 'Jobs by Status · scoped' : 'Jobs by Status'}
                info="Open vs closed job statuses for the current scope."
              />
              <div className="min-h-[180px] flex-1">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={jobsByStatusRows} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="4 8" stroke={gridStroke} vertical={false} />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 9, fill: '#94A3B8' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: '#94A3B8' }}
                      axisLine={false}
                      tickLine={false}
                      width={28}
                    />
                    <Tooltip contentStyle={tip} />
                    <Bar dataKey="value" radius={[6, 6, 0, 0]} barSize={16} fill={PURPLE} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
            ) : null}

            {marketPanels.recruit ? (
            <Card className="col-span-12 flex h-full min-h-[240px] flex-col !p-4 sm:col-span-6 lg:col-span-4">
              <Title
                title={scopeLabel ? 'Recruitment · scoped' : 'Recruitment Analytics'}
                info="Interview, placement, and join conversion rates for the current scope."
              />
              <div className="grid flex-1 grid-cols-2 content-center gap-2">
              {[
                {
                  label: 'Interview Rate',
                    value: `${displayInterviewRate}%`,
                    hint: `${fmt(scopedRates?.ints ?? interviews)} / apps`,
                  color: INDIGO,
                    show: true,
                },
                {
                  label: 'Lead Conversion',
                  value: `${leadConv}%`,
                  hint: `${fmt(hqLeads)} HQ leads`,
                  color: PURPLE,
                    show: !isTenantScoped,
                },
                {
                  label: 'Placement Rate',
                    value: `${displayPlacementRate}%`,
                    hint: `${fmt(scopedRates?.places ?? (placementsJoined || placements))} placed`,
                  color: TEAL,
                    show: true,
                },
                {
                  label: 'Join Rate',
                    value: `${displayJoinRate}%`,
                    hint: `${fmt(scopedRates?.joined ?? placementsJoined)} joined`,
                  color: SUCCESS,
                    show: true,
                },
                ]
                  .filter((m) => m.show)
                  .map((m) => (
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
            ) : null}

            {marketPanels.activity ? (
            <Card className="col-span-12 overflow-hidden !p-0">
              <div className="border-b border-slate-100 px-4 py-2.5">
                <div className="flex items-center gap-1.5">
                  <span className="h-4 w-1 shrink-0 rounded-full bg-gradient-to-b from-indigo-500 to-teal-400" />
                  <h3 className="text-sm font-semibold text-[#111827]">
                    {scopeLabel ? 'Recent Activity · scoped' : 'Recent Activity'}
                  </h3>
                  <HqInfoTip text="Latest jobs, placements, and tenant events for the current scope." />
            </div>
              </div>
              <HqPhase2ActivityFeed activities={activities} />
            </Card>
            ) : null}
          </div>
        </section>
        ) : null}

        {category === 'live' ? (
        <section className="mb-2">
          <div className="mb-4 rounded-2xl border border-slate-200/90 bg-white p-3 shadow-sm sm:p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="inline-flex rounded-full border border-slate-200 bg-slate-50 p-1">
                {([
                  { id: 'today' as const, label: 'Today' },
                  { id: 'week' as const, label: 'Week' },
                  { id: 'month' as const, label: 'Month' },
                ]).map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setLiveRange(opt.id)}
                    className={`rounded-full px-3.5 py-1.5 text-[12px] font-semibold transition ${
                      liveRange === opt.id
                        ? 'bg-slate-900 text-white shadow-sm'
                        : 'text-slate-600 hover:bg-white hover:text-slate-900'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                {behaviorLoading ? (
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-400">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Syncing behaviour…
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700 ring-1 ring-emerald-100">
                    <Radio className="h-3 w-3" />
                    Live
                  </span>
                )}
                {liveScopeActive || liveSort !== 'activity' || liveRange !== 'today' ? (
                  <button
                    type="button"
                    onClick={clearLiveFilters}
                    className="text-[11px] font-semibold text-blue-700 hover:text-blue-900"
                  >
                    Clear filters
                  </button>
                ) : null}
              </div>
            </div>

            <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
              <div className="relative min-w-0 flex-1" ref={liveSearchWrapRef}>
                <Search className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={liveSearch}
                  onChange={(e) => {
                    setLiveSearch(e.target.value);
                    setLiveSuggestOpen(true);
                  }}
                  onFocus={() => setLiveSuggestOpen(true)}
                  placeholder="Search tenant by company, db name, email, or plan…"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/80 py-2.5 pl-10 pr-3 text-sm text-slate-800 outline-none ring-blue-200 placeholder:text-slate-400 focus:bg-white focus:ring-2"
                  autoComplete="off"
                />
                {liveSuggestOpen && liveSearch.trim() && liveSearchSuggestions.length ? (
                  <ul className="absolute left-0 right-0 top-[calc(100%+4px)] z-30 max-h-64 overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-lg shadow-slate-200/80">
                    {liveSearchSuggestions.map((s) => (
                      <li key={s.id}>
                        <button
                          type="button"
                          className="flex w-full flex-col gap-0.5 px-3 py-2 text-left hover:bg-blue-50"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => {
                            setLiveSearch(s.apply);
                            setLiveSuggestOpen(false);
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
                ) : liveSuggestOpen && liveSearch.trim() ? (
                  <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-30 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-[12px] text-slate-400 shadow-lg">
                    No matching employers
                  </div>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-2">
                <select
                  value={liveCategory}
                  onChange={(e) => setLiveCategory(e.target.value)}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-[12px] font-semibold text-slate-700"
                >
                  {liveCategoryOptions.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt === 'all' ? 'All categories' : opt}
                    </option>
                  ))}
                </select>
                <select
                  value={liveSort}
                  onChange={(e) =>
                    setLiveSort(e.target.value as 'latest' | 'oldest' | 'activity' | 'jobs')
                  }
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-[12px] font-semibold text-slate-700"
                >
                  <option value="activity">Most behaviour</option>
                  <option value="latest">Name A–Z</option>
                  <option value="oldest">Name Z–A</option>
                  <option value="jobs">Most open jobs</option>
                </select>
              </div>
            </div>
            <p className="mt-2 text-[11px] text-slate-500">
              Behaviour from tenant CRM tracking ·{' '}
              <strong className="text-slate-700">{liveBehaviorPulse.tenants}</strong> tenants shown ·{' '}
              {liveRange === 'today' ? 'today' : liveRange === 'week' ? 'last 7 days' : 'last 7 days (month window uses week rollup)'}
              {liveBehaviorPulse.withData ? ` · ${liveBehaviorPulse.withData} with engine data` : ''}
            </p>
          </div>

          <div className="mb-4 grid grid-cols-12 gap-4">
            <Card className="col-span-12 xl:col-span-4">
              <Title
                title="Behaviour pulse"
                info="Aggregated from the same tenant behaviour engine used when you open a tenant — online users, visits, actions, and active time for the selected range."
              />
              <div className="grid grid-cols-2 gap-2.5">
                {[
                  { label: 'Online now', value: fmt(liveBehaviorPulse.online), color: SUCCESS },
                  { label: 'Visits', value: fmt(liveBehaviorPulse.visits), color: BLUE },
                  { label: 'Actions', value: fmt(liveBehaviorPulse.actions), color: INDIGO },
                  {
                    label: 'Active time',
                    value: formatActiveMs(liveBehaviorPulse.activeMs),
                    color: TEAL,
                  },
                  {
                    label: 'Avg health',
                    value: liveBehaviorPulse.avgHealth ? `${liveBehaviorPulse.avgHealth}` : '—',
                    color: ORANGE,
                  },
                  {
                    label: 'Open jobs',
                    value: fmt(liveBehaviorRows.reduce((s, r) => s + num(r.row.openJobs), 0)),
                    color: PURPLE,
                  },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="rounded-xl border border-white/70 bg-gradient-to-br from-white to-slate-50/90 p-3 shadow-[0_8px_20px_-14px_rgba(15,23,42,0.2)] ring-1 ring-slate-100/80"
                  >
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                      {item.label}
                    </p>
                    <p className="mt-1.5 text-lg font-bold tabular-nums" style={{ color: item.color }}>
                      {item.value}
                    </p>
        </div>
                ))}
              </div>
            </Card>

            <Card className="col-span-12 xl:col-span-8">
              <Title
                title="Tenant behaviour"
                info="Same behavioural tracking shown when opening a tenant. Click a row for full overview, modules, funnel, triggers, and live feed."
              />
              {liveBehaviorRows.length ? (
                <ul className="max-h-[420px] divide-y divide-slate-100 overflow-y-auto rounded-xl border border-slate-100">
                  {liveBehaviorRows.map(({ row, analysis, metrics }) => {
                    const trigger = analysis?.topTriggers?.[0];
                    const online = metrics.onlineNow > 0;
                    return (
                      <li key={tenantKey(row)}>
                        <button
                          type="button"
                          onClick={() => setBehaviorTenant(toBehaviorDrawerTenant(row))}
                          className="flex w-full flex-col gap-1.5 px-3 py-3 text-left transition hover:bg-indigo-50/60 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span
                                className={`h-2 w-2 shrink-0 rounded-full ${
                                  online ? 'bg-emerald-500' : 'bg-slate-300'
                                }`}
                              />
                              <p className="truncate text-sm font-semibold text-slate-900">
                                {row.name || row.tenantDbName}
                              </p>
                              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                                {row.plan || '—'}
                              </span>
                              {metrics.health ? (
                                <span className="text-[10px] font-semibold text-indigo-600">
                                  Health {metrics.health}
                                </span>
                              ) : null}
      </div>
                            <p className="mt-0.5 truncate font-mono text-[10px] text-slate-400">
                              {row.tenantDbName || row.email}
                            </p>
                            {trigger ? (
                              <p className="mt-1 truncate text-[11px] text-amber-700">
                                Signal: {trigger.title}
                              </p>
                            ) : analysis?.dataSource === 'none' ? (
                              <p className="mt-1 text-[11px] text-slate-400">No behaviour snapshots yet</p>
                            ) : null}
    </div>
                          <div className="flex shrink-0 flex-wrap gap-3 text-[11px] sm:justify-end">
                            <span className="tabular-nums text-slate-600">
                              <strong className="text-slate-900">{fmt(metrics.visits)}</strong> visits
                            </span>
                            <span className="tabular-nums text-slate-600">
                              <strong className="text-slate-900">{fmt(metrics.actions)}</strong> actions
                            </span>
                            <span className="tabular-nums text-slate-600">
                              <strong className="text-slate-900">{formatActiveMs(metrics.activeMs)}</strong>
                            </span>
                            <span className="tabular-nums text-slate-600">
                              <strong className="text-slate-900">{fmt(metrics.onlineNow)}</strong> online
                            </span>
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="py-10 text-center text-sm text-slate-400">
                  {liveScopeActive ? 'No employers match this search' : 'No tenant rows yet'}
                </p>
              )}
            </Card>
          </div>
        </section>
        ) : null}

        <HqPhase2Footer updatedLabel={isLive ? `Live · ${updatedLabel}` : updatedLabel} />
      </div>

      {behaviorTenant?.tenantDbName ? (
        <HqTenantBehaviorDrawer tenant={behaviorTenant} onClose={() => setBehaviorTenant(null)} />
      ) : null}
    </HqModulePageLayout>
  );
}
