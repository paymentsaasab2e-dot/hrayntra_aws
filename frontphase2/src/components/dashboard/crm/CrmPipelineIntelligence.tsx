'use client';

import React, { useMemo } from 'react';
import type { CrmOverview } from '@/lib/dashboard/api';
import { HqInfoTip } from '@/components/hq/analytics/HqPhase2DashboardParts';
import { buildKpiDrillDown } from './crmDrillDown';
import { buildCrmPipelineStats, type CrmComboMetric } from './crmInsights';
import { CrmClientCompareTimeline, CrmLeadCompareTimeline } from './CrmCompareTimeline';
import { useCrmDashboard } from './crmShared';

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

/** Syntho-style segmented semi-circle — one stat per card */
function SynthoStatCard({
  display,
  pct,
  label,
  sub,
  info,
  tone = 'lime',
  onClick,
}: {
  display: string;
  pct: number;
  label: string;
  sub?: string;
  info?: string;
  tone?: GaugeTone;
  onClick?: () => void;
}) {
  const ticks = 38;
  const fillPct = Math.min(100, Math.max(0, pct));
  const filled = Math.round((fillPct / 100) * ticks);
  const [c0, c1, c2] = TONE_TICKS[tone];

  const tickColor = (i: number) => {
    if (i >= filled) return '#E8EDF3';
    const t = filled <= 1 ? 1 : i / (filled - 1);
    if (t < 0.45) return c0;
    if (t < 0.8) return c1;
    return c2;
  };

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
      <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-indigo-400/10 blur-2xl" />
      <div className="relative w-full max-w-[220px]">
        <svg viewBox="0 0 240 128" className="h-auto w-full" aria-hidden>
          {Array.from({ length: ticks }).map((_, i) => {
            const angle = 180 - (i / Math.max(ticks - 1, 1)) * 180;
            const rad = (angle * Math.PI) / 180;
            const cx = 120;
            const cy = 118;
            const r = 82;
            const x = cx + r * Math.cos(rad);
            const y = cy - r * Math.sin(rad);
            const rotate = 90 - angle;
            const active = i < filled;
            return (
              <rect
                key={i}
                x={x - 2.2}
                y={y - 9}
                width={4.4}
                height={active ? 18 : 14}
                rx={2.2}
                fill={tickColor(i)}
                transform={`rotate(${rotate} ${x} ${y})`}
                opacity={active ? 1 : 0.9}
              />
            );
          })}
        </svg>
        <div className="absolute inset-x-0 bottom-1 flex flex-col items-center">
          <p className="text-[1.85rem] font-bold leading-none tracking-tight tabular-nums text-slate-900">
            {display}
          </p>
          <p className="mt-1.5 flex items-center justify-center gap-1 text-[12px] font-semibold text-slate-500">
            <span>{label}</span>
            {info ? (
              <span
                className="relative z-20"
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
              >
                <HqInfoTip text={info} />
              </span>
            ) : null}
          </p>
        </div>
      </div>
      {sub ? (
        <p className="mt-3 line-clamp-2 max-w-[220px] text-[11px] font-medium leading-snug text-slate-400">
          {sub}
        </p>
      ) : null}
    </div>
  );
}

function stageCountFromOverview(overview: CrmOverview | null, pattern: RegExp) {
  const slices = [
    ...(overview?.leadStagePie || []),
    ...(overview?.leadStatusBars || []),
    ...(overview?.pipeline || []).map((p) => ({ name: p.stage, value: p.count })),
  ];
  const hit = slices.find((s) => pattern.test(String(s.name || '')));
  if (hit) return Number(hit.value || 0);
  return (overview?.leadsTable || []).filter((l) => pattern.test(String(l.status || ''))).length;
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
  leadCharts?: React.ReactNode;
  clientCharts?: React.ReactNode;
};

export function CrmPipelineIntelligence({ overview, leadCharts, clientCharts }: Props) {
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

  const clientGauges: GaugeItem[] = [];
  const active = byKey('clientHealth');
  const atRisk = byKey('clientsAtRisk');
  if (totalClients > 0 && active && active.value !== '—') {
    clientGauges.push({
      key: active.key,
      display: active.value,
      pct: Math.min(100, Math.max(0, active.pct ?? 0)),
      label: active.label,
      sub: active.sub,
      info: active.info,
      tone: toneFromMetric(active),
      href: active.href || '/client',
    });
  }
  if (totalClients > 0 && atRisk) {
    clientGauges.push({
      key: atRisk.key,
      display: atRisk.value,
      pct: Math.min(100, Math.max(0, atRisk.pct ?? 0)),
      label: atRisk.label,
      sub: atRisk.sub,
      info: atRisk.info,
      tone: toneFromMetric(atRisk),
      href: atRisk.href || '/client',
    });
  }

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <div>
          <h2 className="text-[15px] font-bold tracking-tight text-slate-900">Lead intelligence</h2>
          <p className="text-[11px] font-medium text-slate-400">
            Engagement, ownership & follow-up · proposal / negotiation only when present
          </p>
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
                onClick={() => open(g.key, g.label, g.href)}
              />
            ))}
          </div>
        ) : (
          <p className="rounded-[1.5rem] border border-dashed border-slate-200 bg-white/70 px-4 py-8 text-center text-sm text-slate-400">
            No lead stage or conversion signals in this period yet
          </p>
        )}
        {leadCharts}
        <CrmLeadCompareTimeline overview={overview} />
      </section>

      <section className="space-y-3 border-t border-slate-200/80 pt-6">
        <div>
          <h2 className="text-[15px] font-bold tracking-tight text-slate-900">Client intelligence</h2>
          <p className="text-[11px] font-medium text-slate-400">
            Active share, risk, and health mix
          </p>
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
    </div>
  );
}
