'use client';

import React, { useMemo } from 'react';
import { asList, type CrmOverview } from '@/lib/dashboard/api';
import { HqInfoTip } from '@/components/hq/analytics/HqPhase2DashboardParts';
import { buildKpiDrillDown } from './crmDrillDown';
import { buildCrmPipelineStats, type CrmComboMetric } from './crmInsights';
import { CrmClientCompareTimeline, CrmLeadCompareTimeline } from './CrmCompareTimeline';
import { formatMoney, formatMoneyCompact, formatNum, useCrmDashboard } from './crmShared';
import type { CrmPipelineSection } from './CrmRecordScopePicker';
import { CrmStatNumber, sparkDelta } from './crmStatNumber';

type GaugeTone = 'lime' | 'indigo' | 'violet' | 'rose' | 'amber';

const TONE_TICKS: Record<GaugeTone, [string, string, string]> = {
  lime: ['#E8F9A8', '#A3E635', '#65A30D'],
  indigo: ['#C7D2FE', '#818CF8', '#4F46E5'],
  violet: ['#DDD6FE', '#A78BFA', '#7C3AED'],
  rose: ['#FECDD3', '#FB7185', '#E11D48'],
  amber: ['#FDE68A', '#FBBF24', '#D97706'],
};

function toneFromMetric(metric: CrmComboMetric): GaugeTone {
  if (metric.tone === 'rose') return 'rose';
  if (metric.tone === 'amber') return 'amber';
  if (metric.tone === 'indigo') return 'violet';
  if (metric.key === 'newToContact' || metric.key === 'leadCoverage') return 'indigo';
  return 'lime';
}

function daysSince(iso?: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return null;
  return Math.round((Date.now() - d.getTime()) / (24 * 60 * 60 * 1000));
}

/** Smooth gradient semi-circle — one stat per card */
function SynthoStatCard({
  display,
  pct,
  label,
  sub,
  info,
  tone = 'lime',
  deltaPct,
  invertDelta,
  onClick,
}: {
  display: string;
  pct: number;
  label: string;
  sub?: string;
  info?: string;
  tone?: GaugeTone;
  deltaPct?: number | null;
  invertDelta?: boolean;
  onClick?: () => void;
}) {
  const gid = React.useId().replace(/:/g, '');
  const fillPct = Math.min(100, Math.max(0, pct));
  const [c0, c1, c2] = TONE_TICKS[tone];
  const r = 78;
  const trackLen = Math.PI * r;
  const fillLen = (fillPct / 100) * trackLen;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick?.();
        }
      }}
      className="group relative flex h-full cursor-pointer flex-col items-center overflow-visible rounded-[1.75rem] border border-white/80 bg-white px-4 pb-4 pt-5 text-center shadow-[0_18px_48px_-28px_rgba(15,23,42,0.28)] transition hover:-translate-y-0.5 hover:shadow-[0_22px_52px_-24px_rgba(15,23,42,0.32)]"
    >
      {info ? (
        <span
          className="absolute right-3 top-3 z-20"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          <HqInfoTip text={info} />
        </span>
      ) : null}
      <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-indigo-400/10 blur-2xl" />
      <div className="relative w-full max-w-[220px]">
        <svg viewBox="0 0 220 118" className="h-auto w-full" aria-hidden>
          <defs>
            <linearGradient id={`g-${gid}`} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor={c0} />
              <stop offset="48%" stopColor={c1} />
              <stop offset="100%" stopColor={c2} />
            </linearGradient>
            <filter id={`glow-${gid}`} x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="2.2" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <path
            d="M 32 104 A 78 78 0 0 1 188 104"
            fill="none"
            stroke="#EEF2F6"
            strokeWidth="16"
            strokeLinecap="round"
          />
          {fillPct > 0 ? (
            <path
              d="M 32 104 A 78 78 0 0 1 188 104"
              fill="none"
              stroke={`url(#g-${gid})`}
              strokeWidth="16"
              strokeLinecap="round"
              strokeDasharray={`${fillLen} ${trackLen}`}
              filter={`url(#glow-${gid})`}
            />
          ) : null}
        </svg>
        <div className="absolute inset-x-0 bottom-0 flex flex-col items-center px-2">
          <CrmStatNumber value={display} label={label} size="lg" variant="gauge" deltaPct={deltaPct} invertDelta={invertDelta} />
        </div>
      </div>
      {sub ? (
        <p className="mt-3 line-clamp-2 max-w-[220px] text-[12px] leading-snug text-slate-500">{sub}</p>
      ) : null}
    </div>
  );
}

function stageCountFromOverview(overview: CrmOverview | null, pattern: RegExp) {
  const slices = [
    ...asList<{ name?: string; value?: number }>(overview?.leadStagePie),
    ...asList<{ name?: string; value?: number }>(overview?.leadStatusBars),
    ...asList(overview?.pipeline).map((p) => ({ name: p.stage, value: p.count })),
  ];
  const hit = slices.find((s) => pattern.test(String(s.name || '')));
  if (hit) return Number(hit.value || 0);
  return asList(overview?.leadsTable).filter((l) => pattern.test(String(l.status || ''))).length;
}

type GaugeItem = {
  key: string;
  display: string;
  pct: number;
  label: string;
  sub?: string;
  info?: string;
  tone: GaugeTone;
  href: string;
};

type Props = {
  overview: CrmOverview | null;
  section?: CrmPipelineSection;
  leadCharts?: React.ReactNode;
  clientCharts?: React.ReactNode;
};

const PULSE_GLASS: Record<string, string> = {
  indigo: 'from-indigo-500/90 via-indigo-600/85 to-violet-700/90',
  rose: 'from-rose-500/90 via-rose-600/85 to-orange-600/80',
  sky: 'from-sky-500/90 via-cyan-600/85 to-indigo-600/80',
  emerald: 'from-emerald-500/90 via-teal-600/85 to-lime-600/75',
};

function MiniPulse({
  label,
  value,
  unit,
  hint,
  tone,
  deltaPct,
  spark,
  invertDelta,
}: {
  label: string;
  value: string;
  unit?: string;
  hint: string;
  tone: keyof typeof PULSE_GLASS;
  deltaPct?: number | null;
  spark?: number[];
  invertDelta?: boolean;
}) {
  return (
    <div
      className={`relative flex min-h-[108px] flex-col justify-between overflow-hidden rounded-[1.25rem] border border-white/25 bg-gradient-to-br p-3.5 text-white backdrop-blur-xl ${PULSE_GLASS[tone]}`}
    >
      <div className="pointer-events-none absolute -right-6 -top-8 h-20 w-20 rounded-full bg-white/20 blur-2xl" />
      <p className="text-[10px] font-semibold uppercase tracking-wider text-white/75">{label}</p>
      <CrmStatNumber
        value={value}
        label={unit}
        light
        size="md"
        deltaPct={deltaPct}
        invertDelta={invertDelta}
      />
      <p className="text-[10px] font-medium text-white/80">{hint}</p>
    </div>
  );
}

export function CrmPipelineIntelligence({ overview, section = 'leads', leadCharts, clientCharts }: Props) {
  const { openDrillDown } = useCrmDashboard();
  const metrics = useMemo(() => buildCrmPipelineStats(overview), [overview]);
  const byKey = (key: string) => metrics.find((m) => m.key === key);

  const totalLeads = Number(overview?.kpis?.totalLeads || overview?.leadsTable?.length || 0);
  const totalClients = Number(overview?.kpis?.totalClients || overview?.clientsTable?.length || 0);
  const proposal = stageCountFromOverview(overview, /proposal/i);
  const negotiation = stageCountFromOverview(overview, /negotiat/i);

  const open = (key: string, label: string, href: string) => {
    openDrillDown(buildKpiDrillDown(overview, key, label, href));
  };

  const leadGauges: GaugeItem[] = [];

  if (proposal > 0) {
    leadGauges.push({
      key: 'proposal',
      display: String(proposal),
      pct: totalLeads > 0 ? Math.round((proposal / totalLeads) * 100) : 0,
      label: 'Proposal',
      sub: `${totalLeads ? Math.round((proposal / totalLeads) * 100) : 0}% of current pipeline`,
      info: 'Leads currently in Proposal — late-stage volume from your funnel.',
      tone: 'violet',
      href: '/leads',
    });
  }
  if (negotiation > 0) {
    leadGauges.push({
      key: 'negotiation',
      display: String(negotiation),
      pct: totalLeads > 0 ? Math.round((negotiation / totalLeads) * 100) : 0,
      label: 'Negotiation',
      sub: `${totalLeads ? Math.round((negotiation / totalLeads) * 100) : 0}% of current pipeline`,
      info: 'Leads currently in Negotiation — closest to close.',
      tone: 'lime',
      href: '/leads',
    });
  }

  (['newToContact', 'engagement', 'leadCoverage', 'overdueFu'] as const).forEach(
    (key) => {
      const m = byKey(key);
      if (!m || m.value === '—') return;
      const rawPct = Math.min(100, Math.max(0, m.pct ?? 0));
      const pct =
        key === 'leadCoverage' && totalLeads > 0
          ? Math.round((Number(m.value || 0) / totalLeads) * 100)
          : rawPct;
      leadGauges.push({
        key: m.key,
        display: m.value,
        pct,
        label: m.label,
        sub: m.sub,
        info: m.info,
        tone: toneFromMetric(m),
        href: m.href || '/leads',
      });
    },
  );

  const clients = asList(overview?.clientsTable);
  const unassignedClients = clients.filter(
    (c) => !c.assignee || /unassigned/i.test(String(c.assignee)),
  ).length;
  const recentClients = clients.filter((c) => {
    const d = daysSince(c.lastActivity);
    return d != null && d <= 14;
  }).length;
  const recencyPct = totalClients > 0 ? Math.round((recentClients / totalClients) * 100) : 0;
  const ownedClientPct =
    totalClients > 0 ? Math.round(((totalClients - unassignedClients) / totalClients) * 100) : 100;
  const clientBook = clients.reduce((s, c) => s + Number(c.value || 0), 0);
  const hotClients = Number(overview?.todaySummary?.hotClients || overview?.kpis?.hotClients || 0);
  const prospectClients = Number(overview?.kpis?.prospectClients || 0);
  const onHoldClients = Number(overview?.kpis?.onHoldClients || 0);

  const clientGauges: GaugeItem[] = [];
  if (totalClients > 0) {
    clientGauges.push({
      key: 'clientRecency',
      display: `${recencyPct}%`,
      pct: recencyPct,
      label: 'Touched 14d',
      sub: `${recentClients} of ${totalClients} accounts active recently`,
      info: 'Share of clients with a logged touch in the last 14 days — recency, not status label.',
      tone: recencyPct >= 60 ? 'lime' : recencyPct >= 30 ? 'amber' : 'rose',
      href: '/client',
    });
    clientGauges.push({
      key: 'clientCoverage',
      display: String(unassignedClients),
      pct: ownedClientPct,
      label: 'Unassigned',
      sub:
        unassignedClients > 0
          ? `${ownedClientPct}% owned · need an owner`
          : `All ${totalClients} accounts have an owner`,
      info: 'Client accounts without an assignee.',
      tone: unassignedClients > 0 ? 'rose' : 'lime',
      href: '/client',
    });
  }

  const today = overview?.todaySummary;
  const converted = stageCountFromOverview(overview, /convert|won/i);
  const pipelineValue = Number(overview?.businessSummary?.potentialBusinessValue || 0);
  const meetingsToday = Number(today?.meetingsScheduled || 0);
  const showLeads = section === 'leads';

  return (
    <div className="space-y-6">
      {showLeads ? (
        <section className="space-y-3">
          <div>
            <h2 className="text-[15px] font-bold tracking-tight text-slate-900">Lead intelligence</h2>
            <p className="text-[11px] font-medium text-slate-400">
              Today’s pulse · engagement · funnel & sources
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MiniPulse
              label="In pipeline"
              value={formatNum(totalLeads)}
              unit="leads"
              hint="Open lead records"
              tone="indigo"
              deltaPct={sparkDelta(overview?.leadSpark)}
            />
            <MiniPulse
              label="New today"
              value={formatNum(today?.newLeads)}
              unit="today"
              hint="Intake today"
              tone="sky"
              deltaPct={sparkDelta(overview?.leadSpark)}
            />
            <MiniPulse
              label="Meetings today"
              value={formatNum(meetingsToday)}
              unit="meetings"
              hint="On the calendar"
              tone="emerald"
            />
            <MiniPulse
              label={converted > 0 ? 'Converted' : pipelineValue ? 'Pipeline value' : 'Follow-ups due'}
              value={
                converted > 0
                  ? formatNum(converted)
                  : pipelineValue
                    ? formatMoneyCompact(pipelineValue)
                    : formatNum(today?.followupsPending)
              }
              unit={converted > 0 ? 'won' : pipelineValue ? 'value' : 'due'}
              hint={
                converted > 0
                  ? 'Won this period'
                  : pipelineValue
                    ? 'Potential business'
                    : 'Today’s queue'
              }
              tone="rose"
              invertDelta={!converted && !pipelineValue}
            />
          </div>
          {leadGauges.length ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {leadGauges.map((g) => (
                <SynthoStatCard
                  key={g.key}
                  display={g.display}
                  pct={g.pct}
                  label={g.label}
                  sub={g.sub}
                  info={g.info}
                  tone={g.tone}
                  deltaPct={
                    g.key === 'newToContact' || g.key === 'engaged' ? sparkDelta(overview?.leadSpark) : null
                  }
                  onClick={() => open(g.key, g.label, g.href)}
                />
              ))}
            </div>
          ) : null}
          {leadCharts}
          <CrmLeadCompareTimeline overview={overview} />
        </section>
      ) : (
        <section className="space-y-3">
          <div>
            <h2 className="text-[15px] font-bold tracking-tight text-slate-900">Client intelligence</h2>
            <p className="text-[11px] font-medium text-slate-400">
              Portfolio pulse · health mix · engagement growth
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MiniPulse
              label="Hot accounts"
              value={formatNum(hotClients)}
              unit="hot"
              hint="Priority clients"
              tone="rose"
            />
            <MiniPulse
              label="Prospects"
              value={formatNum(prospectClients)}
              unit="prospects"
              hint="Not yet active"
              tone="indigo"
            />
            <MiniPulse
              label="On hold"
              value={formatNum(onHoldClients)}
              unit="paused"
              hint="Paused accounts"
              tone="sky"
            />
            <MiniPulse
              label="Book value"
              value={clientBook ? formatMoneyCompact(clientBook) : formatMoney(0)}
              unit="book"
              hint={`${formatNum(totalClients)} accounts`}
              tone="emerald"
            />
          </div>
          <div className="grid gap-3 lg:grid-cols-12 lg:items-stretch">
            {clientGauges.map((g) => (
              <div key={g.key} className="lg:col-span-3">
                <SynthoStatCard
                  display={g.display}
                  pct={g.pct}
                  label={g.label}
                  sub={g.sub}
                  info={g.info}
                  tone={g.tone}
                  onClick={() => open(g.key, g.label, g.href)}
                />
              </div>
            ))}
            {clientCharts ? (
              <div className={clientGauges.length >= 2 ? 'lg:col-span-6' : 'lg:col-span-12'}>
                {clientCharts}
              </div>
            ) : null}
          </div>
          <CrmClientCompareTimeline overview={overview} />
        </section>
      )}
    </div>
  );
}
