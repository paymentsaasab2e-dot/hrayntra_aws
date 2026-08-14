'use client';

/**
 * HQ CRM Dashboard — aggregates HQ DB only (leads + clients/companies + team).
 * Built for sales + management: pipeline health, conversion, $, velocity, risk, coverage.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  Building2,
  ClipboardList,
  LayoutDashboard,
  Loader2,
  Plus,
  RefreshCw,
  Target,
  Ticket,
  UserPlus,
  Users,
} from 'lucide-react';
import { HqModulePageLayout } from '@/components/hq/HqModulePageLayout';
import { useHqMoney } from '@/components/hq/HqCurrencyProvider';
import { HqDashCategoryTabs } from '@/components/hq/analytics/HqDashCategoryTabs';
import {
  apiHqGetAnalytics,
  apiHqListCompanies,
  apiHqListLeads,
  apiHqListTeam,
  type HqAnalyticsChartPoint,
  type HqCompanyApiRow,
  type HqLeadApiRow,
  type HqTeamMemberRow,
} from '@/lib/api';
import { HQ_LEAD_STAGE_LABELS, type HqLeadStage } from '@/app/hq/leads/hqLeadsData';

const OPEN_STAGES = new Set<HqLeadStage>(['new', 'demo', 'contacted', 'qualified']);
const CLOSED_STAGES = new Set<HqLeadStage>(['converted', 'lost']);

/** Forecast weights — documented for sales (spec §7.9). */
const STAGE_WEIGHT: Record<HqLeadStage, number> = {
  new: 0.1,
  contacted: 0.2,
  demo: 0.4,
  qualified: 0.6,
  converted: 1,
  lost: 0,
};

/** Match Employees / Employers dash header actions */
const HQ_DASH_BTN_PRIMARY =
  'inline-flex h-10 items-center justify-center gap-2 rounded-full bg-gradient-to-r from-slate-900 via-slate-800 to-blue-900 px-5 text-sm font-semibold text-white shadow-[0_10px_24px_-10px_rgba(15,23,42,0.55)] transition hover:brightness-110 disabled:opacity-50';
const HQ_DASH_BTN_SECONDARY =
  'inline-flex h-10 items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-800 shadow-[0_8px_20px_-12px_rgba(15,23,42,0.35)] transition hover:border-slate-300 hover:bg-slate-50 disabled:opacity-50';

const CRM_CATEGORY_TABS = [
  {
    id: 'funnel',
    label: 'Funnel & pipeline',
    blurb: 'Demo → trial → paid conversion, plus HQ lead stages',
  },
  {
    id: 'velocity',
    label: 'Velocity & risk',
    blurb: 'Overdue SLA, stale aging, days in stage, act-now queues',
  },
  {
    id: 'coverage',
    label: 'Coverage & quality',
    blurb: 'Owner load, source → convert, lost deals, recent lists',
  },
] as const;

function startOfDay(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function daysBetween(a: Date, b: Date) {
  return Math.floor((a.getTime() - b.getTime()) / 86400000);
}

function pctDelta(current: number, prior: number): string | undefined {
  if (prior <= 0 && current <= 0) return undefined;
  if (prior <= 0) return `+${current} new`;
  const p = Math.round(((current - prior) / prior) * 1000) / 10;
  const sign = p > 0 ? '+' : '';
  return `${sign}${p}% vs prior`;
}

function leadSource(l: HqLeadApiRow) {
  return String(l.leadSource || l.source || 'Unknown').trim() || 'Unknown';
}

function lastActivityAt(l: HqLeadApiRow): Date | null {
  const stamps: number[] = [];
  if (l.createdAt) stamps.push(+new Date(l.createdAt));
  for (const f of l.followUps || []) {
    if (f.completedAt) stamps.push(+new Date(f.completedAt));
    if (f.createdAt) stamps.push(+new Date(f.createdAt));
    if (f.scheduledAt) stamps.push(+new Date(f.scheduledAt));
  }
  for (const r of l.remarks || []) {
    if (r.createdAt) stamps.push(+new Date(r.createdAt));
  }
  if (!stamps.length) return null;
  return new Date(Math.max(...stamps));
}

function median(nums: number[]) {
  if (!nums.length) return null;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : Math.round(((s[mid - 1] + s[mid]) / 2) * 10) / 10;
}

function stageConvPct(current: number, prior: number) {
  if (!prior) return null;
  return Math.round((current / prior) * 1000) / 10;
}

function Panel({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-2xl border border-white/80 bg-white/75 p-4 shadow-[0_1px_0_rgba(255,255,255,0.85)_inset,0_18px_48px_-24px_rgba(15,23,42,0.16)] backdrop-blur-xl sm:p-5 ${className}`}
    >
      {children}
    </div>
  );
}

function PanelTitle({ title, right }: { title: string; right?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2">
        <span className="h-4 w-1 shrink-0 rounded-full bg-gradient-to-b from-indigo-500 to-teal-400" />
        <h3 className="truncate text-[13px] font-semibold tracking-tight text-slate-800">{title}</h3>
      </div>
      {right}
    </div>
  );
}

function RiskPill({
  href,
  label,
  count,
  tone,
}: {
  href: string;
  label: string;
  count: number;
  tone: 'rose' | 'amber' | 'indigo' | 'slate';
}) {
  const tones = {
    rose: 'border-rose-200/80 bg-rose-50 text-rose-800',
    amber: 'border-amber-200/80 bg-amber-50 text-amber-900',
    indigo: 'border-indigo-200/80 bg-indigo-50 text-indigo-800',
    slate: 'border-slate-200 bg-white text-slate-600',
  };
  return (
    <Link
      href={href}
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition hover:brightness-[0.98] ${tones[tone]}`}
    >
      <span className="tabular-nums font-bold">{count}</span>
      <span className="opacity-80">{label}</span>
    </Link>
  );
}

function FunnelStep({
  step,
  label,
  value,
  hint,
  isLast,
}: {
  step: number;
  label: string;
  value: string | number;
  hint?: string;
  isLast?: boolean;
}) {
  return (
    <div className="relative flex min-w-0 flex-1 items-stretch">
      <div className="flex min-w-0 flex-1 flex-col rounded-xl border border-slate-200/90 bg-white px-3.5 py-3 shadow-[0_8px_22px_-18px_rgba(15,23,42,0.35)]">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-slate-900 text-[10px] font-bold text-white">
            {step}
          </span>
          <p className="truncate text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500">{label}</p>
        </div>
        <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900 tabular-nums">{value}</p>
        {hint ? <p className="mt-1 line-clamp-2 text-[11px] font-medium leading-snug text-slate-500">{hint}</p> : null}
      </div>
      {!isLast ? (
        <div
          aria-hidden
          className="pointer-events-none absolute -right-2 top-1/2 z-10 hidden h-4 w-4 -translate-y-1/2 rotate-45 border-r border-t border-slate-200 bg-white xl:block"
        />
      ) : null}
    </div>
  );
}

function SalesMetric({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className="min-w-0 rounded-xl border border-slate-200/80 bg-slate-50/80 px-3.5 py-3">
      <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-bold tracking-tight text-slate-900 tabular-nums sm:text-2xl">{value}</p>
      {hint ? <p className="mt-0.5 text-[11px] text-slate-500">{hint}</p> : null}
    </div>
  );
}

export default function HqCrmDashboardPage() {
  const { formatMoney: money } = useHqMoney();
  const [leads, setLeads] = useState<HqLeadApiRow[]>([]);
  const [companies, setCompanies] = useState<HqCompanyApiRow[]>([]);
  const [members, setMembers] = useState<HqTeamMemberRow[]>([]);
  const [landingFunnel, setLandingFunnel] = useState<HqAnalyticsChartPoint[]>([]);
  const [employerKpis, setEmployerKpis] = useState<{
    demosTotal: number;
    demosPending: number;
    demosVerified: number;
    demosTrials: number;
    demosTrialsLive: number;
    demosPurchases: number;
    onPlan: number;
    landingTrials: number;
    landingPurchases: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [category, setCategory] = useState<(typeof CRM_CATEGORY_TABS)[number]['id']>('funnel');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [leadsRes, companiesRes, teamRes, analyticsRes] = await Promise.all([
        apiHqListLeads(),
        apiHqListCompanies(),
        apiHqListTeam(),
        apiHqGetAnalytics().catch(() => null),
      ]);
      setLeads(leadsRes.data?.leads ?? []);
      setCompanies(companiesRes.data?.companies ?? []);
      setMembers(teamRes.data?.members ?? []);

      const emp = analyticsRes?.data?.employer;
      const k = emp?.kpis;
      if (k) {
        setEmployerKpis({
          demosTotal: Number(k.demosTotal ?? 0),
          demosPending: Number(k.demosPending ?? 0),
          demosVerified: Number(k.demosVerified ?? 0),
          demosTrials: Number(k.demosTrials ?? k.landingTrials ?? 0),
          demosTrialsLive: Number(k.demosTrialsLive ?? 0),
          demosPurchases: Number(k.demosPurchases ?? k.landingPurchases ?? 0),
          onPlan: Number(k.onPlan ?? 0),
          landingTrials: Number(k.landingTrials ?? 0),
          landingPurchases: Number(k.landingPurchases ?? 0),
        });
        const funnel = emp?.charts?.landingFunnel;
        if (Array.isArray(funnel) && funnel.length) {
          setLandingFunnel(funnel);
        } else {
          setLandingFunnel([
            { name: 'Demo requested', value: Number(k.demosTotal ?? 0) },
            { name: 'Pending / scheduled', value: Number(k.demosPending ?? 0) },
            { name: 'Demo given', value: Number(k.demosVerified ?? 0) },
            { name: 'Free trials given', value: Number(k.demosTrials ?? k.landingTrials ?? 0) },
            { name: 'Trials active', value: Number(k.demosTrialsLive ?? 0) },
            { name: 'Paid / purchases', value: Number(k.demosPurchases ?? k.landingPurchases ?? 0) },
          ]);
        }
      } else {
        setEmployerKpis(null);
        setLandingFunnel([]);
      }
      setGeneratedAt(analyticsRes?.data?.generatedAt || new Date().toISOString());
    } catch (err: any) {
      setError(err?.message || 'Failed to load HQ CRM dashboard');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const stats = useMemo(() => {
    const now = new Date();
    const today = startOfDay(now);
    const d7 = new Date(today);
    d7.setDate(d7.getDate() - 7);
    const d14 = new Date(today);
    d14.setDate(d14.getDate() - 14);
    const d30 = new Date(today);
    d30.setDate(d30.getDate() - 30);
    const d60 = new Date(today);
    d60.setDate(d60.getDate() - 60);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const stages = Object.keys(HQ_LEAD_STAGE_LABELS) as HqLeadStage[];
    const openLeads = leads.filter((l) => OPEN_STAGES.has(l.stage as HqLeadStage));
    const closedLeads = leads.filter((l) => CLOSED_STAGES.has(l.stage as HqLeadStage));

    const byStage: Record<string, number> = {};
    const valueByStage: Record<string, number> = {};
    for (const stage of stages) {
      const rows = leads.filter((l) => l.stage === stage);
      byStage[stage] = rows.length;
      valueByStage[stage] = rows.reduce((s, l) => s + Number(l.estimatedDealValue || 0), 0);
    }

    const hot = openLeads.filter(
      (l) =>
        l.score === 'Hot' ||
        String(l.priority || '').toLowerCase() === 'hot' ||
        (['demo', 'qualified'].includes(l.stage) && Number(l.estimatedDealValue || 0) >= 5000),
    );

    const openPipeline = openLeads.reduce((sum, l) => sum + Number(l.estimatedDealValue || 0), 0);
    const weightedPipeline = openLeads.reduce((sum, l) => {
      const w = STAGE_WEIGHT[l.stage as HqLeadStage] ?? 0.15;
      const hotBoost = l.score === 'Hot' ? Math.min(0.9, w + 0.1) : w;
      return sum + Number(l.estimatedDealValue || 0) * hotBoost;
    }, 0);
    const withValue = openLeads.filter((l) => Number(l.estimatedDealValue || 0) > 0).length;
    const valueCoverage =
      openLeads.length > 0 ? Math.round((withValue / openLeads.length) * 1000) / 10 : 0;

    const followUpsToday = openLeads.filter((l) => {
      if (!l.nextFollowUpAt) return false;
      return startOfDay(new Date(l.nextFollowUpAt)).getTime() === today.getTime();
    }).length;

    const overdue = openLeads.filter((l) => {
      if (!l.nextFollowUpAt) return false;
      return new Date(l.nextFollowUpAt).getTime() < today.getTime();
    });

    const unassigned = openLeads.filter((l) => !String(l.owner || '').trim() && !l.assignedToId);

    const stale7 = openLeads.filter((l) => {
      const last = lastActivityAt(l);
      if (!last) return true;
      return last.getTime() < d7.getTime();
    });
    const stale14 = openLeads.filter((l) => {
      const last = lastActivityAt(l);
      if (!last) return true;
      return last.getTime() < d14.getTime();
    });

    const converted = byStage.converted || 0;
    const lost = byStage.lost || 0;
    const closed = converted + lost;
    const winRate = closed ? Math.round((converted / closed) * 1000) / 10 : 0;

    const closed30 = closedLeads.filter((l) => {
      const t = l.createdAt ? +new Date(l.createdAt) : 0;
      return t >= +d30;
    });
    const won30 = closed30.filter((l) => l.stage === 'converted').length;
    const lost30 = closed30.filter((l) => l.stage === 'lost').length;
    const winRate30 =
      won30 + lost30 > 0 ? Math.round((won30 / (won30 + lost30)) * 1000) / 10 : winRate;

    const wonRevenue = leads
      .filter((l) => l.stage === 'converted')
      .reduce((s, l) => s + Number(l.estimatedDealValue || 0), 0);

    const stageRows = stages.map((stage, i) => {
      const prev = i > 0 ? byStage[stages[i - 1]] || 0 : 0;
      const value = byStage[stage] || 0;
      const convPct = i === 0 || !prev ? null : Math.round((value / prev) * 1000) / 10;
      const openPct =
        OPEN_STAGES.has(stage) && openLeads.length
          ? Math.round((value / openLeads.length) * 1000) / 10
          : null;
      return {
        stage,
        label: HQ_LEAD_STAGE_LABELS[stage],
        count: value,
        dollars: valueByStage[stage] || 0,
        convPct,
        openPct,
        isOpen: OPEN_STAGES.has(stage),
      };
    });

    const bottleneck = stageRows
      .filter((r) => r.convPct != null && r.convPct < 40 && (byStage[stages[stages.indexOf(r.stage as HqLeadStage) - 1]] || 0) >= 2)
      .sort((a, b) => (a.convPct ?? 100) - (b.convPct ?? 100))[0];

    const activeMembers = members.filter((m) => m.status === 'active');
    const leadsPerOwner = activeMembers
      .map((m) => {
        const name = m.name || m.email || 'Member';
        const owned = openLeads.filter((l) => {
          const owner = String(l.owner || '').toLowerCase();
          return (
            owner === String(m.name || '').toLowerCase() ||
            owner === String(m.email || '').toLowerCase() ||
            (m.name ? owner.includes(String(m.name).toLowerCase()) : false) ||
            (m.id && (l.assignedToId === m.id || l.assignedToIds?.includes(m.id)))
          );
        }).length;
        return { name, owned };
      })
      .sort((a, b) => b.owned - a.owned);

    const newLeads7d = leads.filter((l) => l.createdAt && +new Date(l.createdAt) >= +d7).length;
    const newLeadsPrior7d = leads.filter((l) => {
      if (!l.createdAt) return false;
      const t = +new Date(l.createdAt);
      return t >= +d14 && t < +d7;
    }).length;
    const newLeads30d = leads.filter((l) => l.createdAt && +new Date(l.createdAt) >= +d30).length;
    const newLeadsPrior30d = leads.filter((l) => {
      if (!l.createdAt) return false;
      const t = +new Date(l.createdAt);
      return t >= +d60 && t < +d30;
    }).length;

    const daysInStage = stages
      .filter((s) => OPEN_STAGES.has(s))
      .map((stage) => {
        const ages = openLeads
          .filter((l) => l.stage === stage)
          .map((l) => {
            const last = lastActivityAt(l) || (l.createdAt ? new Date(l.createdAt) : null);
            if (!last) return null;
            return daysBetween(now, last);
          })
          .filter((n): n is number => n != null);
        return {
          stage,
          label: HQ_LEAD_STAGE_LABELS[stage],
          count: ages.length,
          medianDays: median(ages),
        };
      });

    const sourceMap = new Map<string, { leads: number; converted: number; lost: number; value: number }>();
    for (const l of leads) {
      const src = leadSource(l);
      const row = sourceMap.get(src) || { leads: 0, converted: 0, lost: 0, value: 0 };
      row.leads += 1;
      if (l.stage === 'converted') row.converted += 1;
      if (l.stage === 'lost') row.lost += 1;
      if (OPEN_STAGES.has(l.stage as HqLeadStage)) row.value += Number(l.estimatedDealValue || 0);
      sourceMap.set(src, row);
    }
    const bySource = [...sourceMap.entries()]
      .map(([source, row]) => {
        const closedSrc = row.converted + row.lost;
        return {
          source,
          ...row,
          pct: leads.length ? Math.round((row.leads / leads.length) * 1000) / 10 : 0,
          winPct: closedSrc ? Math.round((row.converted / closedSrc) * 1000) / 10 : null,
        };
      })
      .sort((a, b) => b.leads - a.leads);

    const lostLeads = leads.filter((l) => l.stage === 'lost');
    const lostReasons = new Map<string, number>();
    for (const l of lostLeads) {
      const reason =
        String(l.initialNotes || l.notes || l.expectedBusinessValue || '')
          .trim()
          .slice(0, 48) || 'No reason logged';
      lostReasons.set(reason, (lostReasons.get(reason) || 0) + 1);
    }
    const lostReasonRows = [...lostReasons.entries()]
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);

    const newClients30d = companies.filter((c) => c.createdAt && +new Date(c.createdAt) >= +d30).length;
    const newClientsMonth = companies.filter(
      (c) => c.createdAt && +new Date(c.createdAt) >= +monthStart,
    ).length;
    const companyActive = companies.filter((c) => c.status === 'active').length;
    const companyOnHold = companies.filter((c) => c.status === 'on_hold' || c.status === 'inactive').length;

    return {
      byStage,
      hot,
      openPipeline,
      weightedPipeline,
      valueCoverage,
      followUpsToday,
      total: leads.length,
      openCount: openLeads.length,
      overdue,
      stale7,
      stale14,
      unassigned,
      winRate,
      winRate30,
      converted,
      lost,
      won30,
      lost30,
      wonRevenue,
      stageRows,
      maxStage: Math.max(...stageRows.map((s) => s.count), 1),
      bottleneck,
      leadsPerOwner,
      companyActive,
      companyTotal: companies.length,
      companyOnHold,
      newClients30d,
      newClientsMonth,
      teamActive: activeMembers.length,
      teamTotal: members.length,
      newLeads7d,
      newLeads30d,
      delta7: pctDelta(newLeads7d, newLeadsPrior7d),
      delta30: pctDelta(newLeads30d, newLeadsPrior30d),
      daysInStage,
      bySource,
      lostReasonRows,
      lostLeads,
      velocityDry: newLeads7d === 0 && openLeads.length > 0,
    };
  }, [leads, companies, members]);

  const recentLeads = useMemo(() => {
    return [...leads]
      .sort((a, b) => +new Date(b.createdAt || 0) - +new Date(a.createdAt || 0))
      .slice(0, 8);
  }, [leads]);
  const recentClients = useMemo(() => {
    return [...companies]
      .sort((a, b) => +new Date(b.createdAt || 0) - +new Date(a.createdAt || 0))
      .slice(0, 8);
  }, [companies]);

  return (
    <HqModulePageLayout
      title="CRM Dashboard"
      subtitle="Sales & management — pipeline, conversion, and risk from HQ CRM."
      icon={<LayoutDashboard className="h-5 w-5" />}
      locked={false}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/hq/leads" className={HQ_DASH_BTN_PRIMARY}>
            <Plus className="h-4 w-4" strokeWidth={2.5} />
            Add lead
          </Link>
          <Link href="/hq/leads" className={HQ_DASH_BTN_SECONDARY}>
            <ClipboardList className="h-4 w-4 text-indigo-600" />
            Leads
          </Link>
          <Link href="/hq/clients" className={HQ_DASH_BTN_SECONDARY}>
            <Building2 className="h-4 w-4 text-teal-600" />
            Clients
          </Link>
          <Link href="/hq/tickets?audience=employer" className={`${HQ_DASH_BTN_SECONDARY} hidden sm:inline-flex`}>
            <Ticket className="h-4 w-4 text-violet-600" />
            Employer tickets
          </Link>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className={HQ_DASH_BTN_SECONDARY}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Refresh
          </button>
        </div>
      }
    >
      <div className="dash-ui hq-dash-page">
      {error ? (
        <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {error}
        </div>
      ) : null}

      <section className="mb-5 space-y-4">
        <div className="overflow-hidden rounded-2xl border border-white/80 bg-white/80 shadow-[0_1px_0_rgba(255,255,255,0.85)_inset,0_18px_48px_-24px_rgba(15,23,42,0.16)] backdrop-blur-xl">
          <div className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-100 px-4 py-3 sm:px-5">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                Conversion funnel
              </p>
              <p className="mt-0.5 text-sm font-semibold text-slate-800">
                Demo → scheduled → given → trial → paid
              </p>
              {generatedAt ? (
                <p className="mt-0.5 text-[11px] text-slate-400">
                  Updated {new Date(generatedAt).toLocaleString()} · same source as Employers
                </p>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2 sm:hidden">
              <Link href="/hq/leads" className={HQ_DASH_BTN_PRIMARY}>
                <Plus className="h-4 w-4" /> Add lead
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5 p-3 sm:gap-3 sm:p-4 xl:grid-cols-6">
            <FunnelStep
              step={1}
              label="Demo requested"
              value={employerKpis?.demosTotal ?? '—'}
              hint="Landing / free demo forms"
            />
            <FunnelStep
              step={2}
              label="Scheduled"
              value={employerKpis?.demosPending ?? '—'}
              hint={
                employerKpis
                  ? `${stageConvPct(employerKpis.demosPending, employerKpis.demosTotal) ?? '—'}% of requested`
                  : 'Pending OTP / schedule'
              }
            />
            <FunnelStep
              step={3}
              label="Demo given"
              value={employerKpis?.demosVerified ?? '—'}
              hint={
                employerKpis
                  ? `${stageConvPct(employerKpis.demosVerified, employerKpis.demosTotal) ?? '—'}% verified`
                  : 'Verified demos'
              }
            />
            <FunnelStep
              step={4}
              label="Free trials"
              value={employerKpis?.demosTrials ?? '—'}
              hint={
                employerKpis
                  ? `${stageConvPct(employerKpis.demosTrials, employerKpis.demosVerified || employerKpis.demosTotal) ?? '—'}% after demo`
                  : 'Trial requests given'
              }
            />
            <FunnelStep
              step={5}
              label="Trials active"
              value={employerKpis?.demosTrialsLive ?? '—'}
              hint={
                employerKpis
                  ? `${stageConvPct(employerKpis.demosTrialsLive, employerKpis.demosTrials) ?? '—'}% using trial`
                  : 'Provisioned live trials'
              }
            />
            <FunnelStep
              step={6}
              label="Paid"
              value={employerKpis?.demosPurchases ?? employerKpis?.onPlan ?? '—'}
              hint={
                employerKpis
                  ? `${stageConvPct(employerKpis.demosPurchases || employerKpis.onPlan, employerKpis.demosTrials || employerKpis.demosVerified || employerKpis.demosTotal) ?? '—'}% converted · ${employerKpis.onPlan} on plan`
                  : 'Purchases / on plan'
              }
              isLast
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 lg:gap-3">
          <SalesMetric
            label="Open pipeline"
            value={money(stats.openPipeline)}
            hint={`${stats.valueCoverage}% of open leads have $`}
          />
          <SalesMetric
            label="Weighted forecast"
            value={money(stats.weightedPipeline)}
            hint="Stage-weighted open deals"
          />
          <SalesMetric
            label="Win rate (30d)"
            value={`${stats.winRate30}%`}
            hint={`${stats.won30} won · ${stats.lost30} lost`}
          />
          <SalesMetric
            label="Open HQ leads"
            value={stats.openCount}
            hint={`${stats.followUpsToday} follow-ups due today · ${stats.hot.length} hot`}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200/80 bg-white/70 px-3 py-2.5 backdrop-blur-sm">
          <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
            Lead queue
          </span>
          <RiskPill
            href="/hq/leads"
            label="overdue"
            count={stats.overdue.length}
            tone={stats.overdue.length ? 'rose' : 'slate'}
          />
          <RiskPill
            href="/hq/leads"
            label="unassigned"
            count={stats.unassigned.length}
            tone={stats.unassigned.length ? 'amber' : 'slate'}
          />
          <RiskPill
            href="/hq/leads"
            label="stale 14d+"
            count={stats.stale14.length}
            tone={stats.stale14.length ? 'amber' : 'slate'}
          />
          <RiskPill
            href="/hq/leads"
            label="hot"
            count={stats.hot.length}
            tone={stats.hot.length ? 'indigo' : 'slate'}
          />
          <span className="hidden text-[11px] text-slate-400 sm:inline">
            · {stats.openCount} open · {stats.followUpsToday} due today
          </span>
          <Link
            href="/hq/team"
            className="ml-auto hidden items-center gap-1 text-[11px] font-semibold text-indigo-600 hover:underline sm:inline-flex"
          >
            <UserPlus className="h-3.5 w-3.5" />
            Team coverage
          </Link>
        </div>

        {stats.velocityDry ? (
          <div className="flex items-start gap-2 rounded-xl border border-amber-200/80 bg-amber-50/90 px-3 py-2 text-[13px] text-amber-950">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <p>
              <strong>Inbound drying up:</strong> 0 new leads in 7 days while {stats.openCount} stay
              open. Push campaigns / demos or clear stale pipeline.
            </p>
          </div>
        ) : null}
      </section>

      <HqDashCategoryTabs
        tabs={[...CRM_CATEGORY_TABS]}
        value={category}
        onChange={(id) => setCategory(id as typeof category)}
        instanceId="crm"
      />

      {category === 'funnel' ? (
        <section className="mb-2 grid grid-cols-12 items-start gap-4">
          <Panel className="col-span-12 lg:col-span-7">
            <PanelTitle
              title="Demo → trial → paid"
              right={
                <Link href="/hq?view=employer" className="text-[11px] font-semibold text-indigo-600 hover:underline">
                  Employers dash →
                </Link>
              }
            />
            <p className="mb-3 text-[11px] text-slate-500">
              Track which employer leads convert: free demo requested → given → free trial → paid.
            </p>
            {landingFunnel.length ? (
              <div className="space-y-2.5">
                {landingFunnel.map((row, i) => {
                  const prior = i > 0 ? Number(landingFunnel[i - 1]?.value || 0) : 0;
                  const value = Number(row.value || 0);
                  const conv = i === 0 ? null : stageConvPct(value, prior);
                  const maxV = Math.max(...landingFunnel.map((x) => Number(x.value || 0)), 1);
                  return (
                    <div key={`${row.name}-${i}`}>
                      <div className="mb-1 flex items-center justify-between gap-2 text-[12px]">
                        <span className="font-semibold text-slate-700">{row.name}</span>
                        <span className="text-slate-500">
                          <strong className="text-slate-900">{value}</strong>
                          {conv != null ? (
                            <span className={conv < 40 ? ' text-amber-700' : ''}>
                              {` · ${conv}% of prior`}
                            </span>
                          ) : null}
                        </span>
                      </div>
                      <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-indigo-500 via-violet-500 to-teal-400"
                          style={{ width: `${Math.max(6, (value / maxV) * 100)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="py-8 text-center text-sm text-slate-400">
                Employer funnel not loaded yet — refresh or open Employers analytics.
              </p>
            )}
          </Panel>

          <div className="col-span-12 grid gap-4 lg:col-span-5">
            <Panel>
              <PanelTitle title="Conversion snapshot" />
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 px-3 py-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-indigo-600/80">
                    Demo → given
                  </p>
                  <p className="mt-1 text-xl font-bold text-indigo-800">
                    {employerKpis
                      ? `${stageConvPct(employerKpis.demosVerified, employerKpis.demosTotal) ?? '—'}%`
                      : '—'}
                  </p>
                  <p className="mt-0.5 text-[10px] text-slate-500">
                    {employerKpis?.demosVerified ?? 0} of {employerKpis?.demosTotal ?? 0} verified
                  </p>
                </div>
                <div className="rounded-xl border border-teal-100 bg-teal-50/60 px-3 py-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-teal-700/80">
                    Given → trial
                  </p>
                  <p className="mt-1 text-xl font-bold text-teal-900">
                    {employerKpis
                      ? `${stageConvPct(employerKpis.demosTrials, employerKpis.demosVerified || employerKpis.demosTotal) ?? '—'}%`
                      : '—'}
                  </p>
                  <p className="mt-0.5 text-[10px] text-slate-500">
                    {employerKpis?.demosTrials ?? 0} free trials
                  </p>
                </div>
                <div className="rounded-xl bg-emerald-50 px-3 py-3 ring-1 ring-emerald-100">
                  <p className="text-[10px] font-semibold uppercase text-emerald-700/80">
                    Trial → paid
                  </p>
                  <p className="mt-1 text-lg font-bold text-emerald-900">
                    {employerKpis
                      ? `${stageConvPct(employerKpis.demosPurchases || employerKpis.onPlan, employerKpis.demosTrials || employerKpis.demosVerified || 1) ?? '—'}%`
                      : '—'}
                  </p>
                  <p className="mt-0.5 text-[10px] text-slate-500">
                    {employerKpis?.demosPurchases ?? 0} paid · {employerKpis?.onPlan ?? 0} on plan
                  </p>
                </div>
                <div className="rounded-xl bg-slate-50 px-3 py-3">
                  <p className="flex items-center gap-1 text-[10px] font-semibold uppercase text-slate-400">
                    <Target className="h-3 w-3" /> Trials live
                  </p>
                  <p className="mt-1 text-lg font-bold text-slate-900">
                    {employerKpis?.demosTrialsLive ?? '—'}
                  </p>
                  <p className="mt-0.5 text-[10px] text-slate-500">
                    {employerKpis
                      ? `${stageConvPct(employerKpis.demosTrialsLive, employerKpis.demosTrials) ?? '—'}% of trials active`
                      : 'Using free trial now'}
                  </p>
                </div>
              </div>
            </Panel>

            <Panel>
              <PanelTitle
                title="HQ lead stages"
                right={
                  <Link href="/hq/leads" className="text-[11px] font-semibold text-indigo-600 hover:underline">
                    Open →
                  </Link>
                }
              />
              <div className="space-y-2">
                {stats.stageRows.map((row) => (
                  <div key={row.stage} className="flex items-center justify-between gap-2 text-[12px]">
                    <span className="font-medium text-slate-600">{row.label}</span>
                    <span className="tabular-nums font-semibold text-slate-900">
                      {row.count}
                      {row.dollars > 0 ? (
                        <span className="ml-1 font-medium text-slate-400">{money(row.dollars)}</span>
                      ) : null}
                    </span>
                  </div>
                ))}
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 border-t border-slate-100 pt-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase text-slate-400">Open $</p>
                  <p className="text-sm font-bold text-indigo-700">{money(stats.openPipeline)}</p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase text-slate-400">Win 30d</p>
                  <p className="text-sm font-bold text-slate-800">{stats.winRate30}%</p>
                </div>
              </div>
            </Panel>
          </div>
        </section>
      ) : null}

      {category === 'velocity' ? (
        <section className="mb-2 grid grid-cols-12 items-start gap-4">
          <Panel className="col-span-12 md:col-span-4">
            <PanelTitle title="Follow-ups & SLA" />
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-xl bg-slate-50 px-3 py-3 text-center">
                <p className="text-[10px] font-semibold uppercase text-slate-400">Due today</p>
                <p className="mt-1 text-2xl font-bold text-slate-900">{stats.followUpsToday}</p>
              </div>
              <div className="rounded-xl bg-rose-50 px-3 py-3 text-center ring-1 ring-rose-100">
                <p className="text-[10px] font-semibold uppercase text-rose-700/80">Overdue</p>
                <p className="mt-1 text-2xl font-bold text-rose-800">{stats.overdue.length}</p>
              </div>
            </div>
            <div className="mt-3 max-h-[240px] space-y-2 overflow-y-auto">
              {stats.overdue.length ? (
                stats.overdue.slice(0, 10).map((l) => (
                  <div key={l.id} className="rounded-lg border border-rose-50 bg-rose-50/40 px-2.5 py-2">
                    <p className="truncate text-sm font-semibold text-slate-900">{l.name}</p>
                    <p className="text-[10px] text-slate-500">
                      {l.company || '—'} · {HQ_LEAD_STAGE_LABELS[l.stage as HqLeadStage] || l.stage}
                      {l.owner ? ` · ${l.owner}` : ' · Unassigned'}
                    </p>
                  </div>
                ))
              ) : (
                <p className="py-6 text-center text-xs text-slate-400">No overdue follow-ups — good SLA</p>
              )}
            </div>
          </Panel>

          <Panel className="col-span-12 md:col-span-4">
            <PanelTitle title="Stale / aging" />
            <div className="mb-2 grid grid-cols-2 gap-2">
              <div className="rounded-xl bg-amber-50 px-2.5 py-2 text-center ring-1 ring-amber-100">
                <p className="text-[10px] font-semibold uppercase text-amber-700/80">7d+ quiet</p>
                <p className="text-xl font-bold text-amber-900">{stats.stale7.length}</p>
              </div>
              <div className="rounded-xl bg-amber-50/70 px-2.5 py-2 text-center ring-1 ring-amber-100">
                <p className="text-[10px] font-semibold uppercase text-amber-700/80">14d+ quiet</p>
                <p className="text-xl font-bold text-amber-900">{stats.stale14.length}</p>
              </div>
            </div>
            <p className="mb-2 text-[11px] text-slate-500">
              Based on last follow-up / remark / create — revive or mark lost.
            </p>
            <div className="max-h-[220px] space-y-2 overflow-y-auto">
              {stats.stale14.length ? (
                stats.stale14.slice(0, 10).map((l) => {
                  const last = lastActivityAt(l);
                  const age = last ? daysBetween(new Date(), last) : '—';
                  return (
                    <div
                      key={l.id}
                      className="flex items-center justify-between gap-2 border-b border-slate-50 py-2 last:border-0"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-900">{l.name}</p>
                        <p className="text-[10px] text-slate-500">
                          {HQ_LEAD_STAGE_LABELS[l.stage as HqLeadStage] || l.stage}
                          {l.owner ? ` · ${l.owner}` : ''}
                        </p>
                      </div>
                      <span className="shrink-0 rounded-md bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">
                        {age}d
                      </span>
                    </div>
                  );
                })
              ) : (
                <p className="py-6 text-center text-xs text-slate-400">No 14d+ stale leads</p>
              )}
            </div>
          </Panel>

          <Panel className="col-span-12 md:col-span-4">
            <PanelTitle title="Days in stage (median)" />
            <p className="mb-2 text-[11px] text-slate-500">
              How long open leads sit — high median = stuck stage.
            </p>
            <div className="space-y-2.5">
              {stats.daysInStage.map((row) => (
                <div key={row.stage}>
                  <div className="mb-1 flex justify-between text-[12px]">
                    <span className="font-semibold text-slate-700">{row.label}</span>
                    <span className="text-slate-500">
                      <strong className="text-slate-900">
                        {row.medianDays != null ? `${row.medianDays}d` : '—'}
                      </strong>
                      {` · ${row.count}`}
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-indigo-400"
                      style={{
                        width: `${Math.min(100, Math.max(8, ((row.medianDays || 0) / 30) * 100))}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-xl bg-slate-50 px-3 py-3 text-center">
              <p className="text-[10px] font-semibold uppercase text-slate-400">Unassigned open</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">{stats.unassigned.length}</p>
            </div>
          </Panel>
        </section>
      ) : null}

      {category === 'coverage' ? (
        <section className="mb-2 grid grid-cols-12 items-start gap-4">
          <Panel className="col-span-12 lg:col-span-3">
            <PanelTitle title="Team coverage" />
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-xl bg-slate-50 px-3 py-3 text-center">
                <p className="text-[10px] font-semibold uppercase text-slate-400">Team</p>
                <p className="mt-1 text-xl font-bold text-slate-900">{stats.teamTotal}</p>
              </div>
              <div className="rounded-xl bg-slate-50 px-3 py-3 text-center">
                <p className="flex items-center justify-center gap-1 text-[10px] font-semibold uppercase text-slate-400">
                  <Users className="h-3 w-3" /> Active
                </p>
                <p className="mt-1 text-xl font-bold text-slate-900">{stats.teamActive}</p>
              </div>
            </div>
            <p className="mt-3 text-[11px] text-slate-500">
              Avg open leads / AE:{' '}
              <strong className="text-slate-800">
                {stats.teamActive
                  ? Math.round((stats.openCount / stats.teamActive) * 10) / 10
                  : '—'}
              </strong>
            </p>
            <div className="mt-3 space-y-2">
              {stats.leadsPerOwner.length ? (
                stats.leadsPerOwner.slice(0, 6).map((row) => (
                  <div key={row.name} className="flex items-center justify-between text-[12px]">
                    <span className="truncate text-slate-600">{row.name}</span>
                    <span className="font-semibold text-slate-900">{row.owned} open</span>
                  </div>
                ))
              ) : (
                <p className="py-4 text-center text-xs text-slate-400">No active team members</p>
              )}
            </div>
            <div className="mt-3 rounded-xl border border-slate-100 bg-white px-3 py-2 text-[11px] text-slate-500">
              Clients: <strong className="text-slate-800">{stats.companyActive} active</strong>
              {stats.companyOnHold ? ` · ${stats.companyOnHold} paused` : ''}
              {` · +${stats.newClients30d} in 30d`}
            </div>
          </Panel>

          <Panel className="col-span-12 lg:col-span-4">
            <PanelTitle title="Source → convert" />
            <p className="mb-2 text-[11px] text-slate-500">
              Which channels feed pipeline and which actually win.
            </p>
            <div className="max-h-[320px] overflow-auto">
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 bg-white text-[10px] uppercase tracking-wider text-slate-400">
                  <tr>
                    <th className="pb-2 font-semibold">Source</th>
                    <th className="pb-2 font-semibold">Leads</th>
                    <th className="pb-2 font-semibold">Win%</th>
                    <th className="pb-2 font-semibold">Open $</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.bySource.length ? (
                    stats.bySource.map((row) => (
                      <tr key={row.source} className="border-t border-slate-50">
                        <td className="py-2 font-semibold text-slate-800">{row.source}</td>
                        <td className="py-2 text-slate-600">
                          {row.leads}
                          <span className="text-[10px] text-slate-400"> ({row.pct}%)</span>
                        </td>
                        <td className="py-2 text-slate-600">
                          {row.winPct != null ? `${row.winPct}%` : '—'}
                        </td>
                        <td className="py-2 text-slate-600">{money(row.value)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-xs text-slate-400">
                        No source data yet
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Panel>

          <Panel className="col-span-12 lg:col-span-5">
            <PanelTitle title="Lost deals — learn & act" />
            <p className="mb-2 text-[11px] text-slate-500">
              {stats.lost} lost all-time · {stats.lost30} in last 30d. Log reasons on lose so this
              guides coaching.
            </p>
            {stats.lostReasonRows.length ? (
              <div className="mb-3 space-y-1.5">
                {stats.lostReasonRows.map((row) => (
                  <div
                    key={row.reason}
                    className="flex items-center justify-between gap-2 rounded-lg bg-rose-50/60 px-2.5 py-1.5 text-[12px]"
                  >
                    <span className="truncate text-slate-700">{row.reason}</span>
                    <span className="shrink-0 font-bold text-rose-800">{row.count}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mb-3 text-xs text-slate-400">No lost leads yet.</p>
            )}
            <div className="max-h-[160px] space-y-1.5 overflow-y-auto">
              {stats.lostLeads.slice(0, 6).map((l) => (
                <div key={l.id} className="flex justify-between gap-2 border-b border-slate-50 py-1.5 text-[12px]">
                  <span className="truncate font-semibold text-slate-800">{l.name}</span>
                  <span className="shrink-0 text-slate-500">{l.company || '—'}</span>
                </div>
              ))}
            </div>
          </Panel>

          <Panel className="col-span-12 overflow-hidden !p-0 sm:col-span-6">
            <div className="border-b border-slate-100 px-4 py-3">
              <PanelTitle title="Recent HQ leads" />
            </div>
            <div className="max-h-[260px] overflow-auto">
              <table className="w-full min-w-[420px] text-left text-sm">
                <thead className="sticky top-0 bg-slate-50/95 text-[10px] uppercase tracking-wider text-slate-400">
                  <tr>
                    <th className="px-4 py-2 font-semibold">Name</th>
                    <th className="px-2 py-2 font-semibold">Company</th>
                    <th className="px-2 py-2 font-semibold">Stage</th>
                    <th className="px-4 py-2 font-semibold">$</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && recentLeads.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                        Loading…
                      </td>
                    </tr>
                  ) : recentLeads.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                        No HQ leads yet.
                      </td>
                    </tr>
                  ) : (
                    recentLeads.map((lead) => (
                      <tr key={lead.id} className="border-b border-slate-50 last:border-0">
                        <td className="px-4 py-2.5 font-semibold text-slate-900">{lead.name}</td>
                        <td className="px-2 py-2.5 text-slate-600">{lead.company}</td>
                        <td className="px-2 py-2.5 text-slate-600">
                          {HQ_LEAD_STAGE_LABELS[lead.stage as HqLeadStage] || lead.stage}
                        </td>
                        <td className="px-4 py-2.5 text-slate-600">
                          {money(Number(lead.estimatedDealValue || 0))}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Panel>

          <Panel className="col-span-12 overflow-hidden !p-0 sm:col-span-6">
            <div className="border-b border-slate-100 px-4 py-3">
              <PanelTitle title="Recent HQ clients" />
            </div>
            <div className="max-h-[260px] overflow-auto">
              <table className="w-full min-w-[360px] text-left text-sm">
                <thead className="sticky top-0 bg-slate-50/95 text-[10px] uppercase tracking-wider text-slate-400">
                  <tr>
                    <th className="px-4 py-2 font-semibold">Company</th>
                    <th className="px-2 py-2 font-semibold">Contact</th>
                    <th className="px-4 py-2 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && recentClients.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-4 py-8 text-center text-slate-500">
                        Loading…
                      </td>
                    </tr>
                  ) : recentClients.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-4 py-8 text-center text-slate-500">
                        No HQ clients yet.
                      </td>
                    </tr>
                  ) : (
                    recentClients.map((row) => (
                      <tr key={row.id} className="border-b border-slate-50 last:border-0">
                        <td className="px-4 py-2.5 font-semibold text-slate-900">{row.name}</td>
                        <td className="px-2 py-2.5 text-slate-600">{row.contact}</td>
                        <td className="px-4 py-2.5 capitalize text-slate-600">
                          {String(row.status || '').replace('_', ' ')}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Panel>
        </section>
      ) : null}
      </div>
    </HqModulePageLayout>
  );
}
