'use client';

import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import type { CrmOverview } from '@/lib/dashboard/api';
import { dashCard, formatNum, useCrmDashboard } from './crmShared';
import { buildClientSliceDrillDown, buildLeadSliceDrillDown } from './crmDrillDown';
import { CrmPipelineIntelligence } from './CrmPipelineIntelligence';
import { CrmRecordScopePicker, type CrmPipelineSection } from './CrmRecordScopePicker';
import { useDashboardAccess } from '@/lib/dashboard/useDashboardAccess';

const CHART_COLORS = ['#2563EB', '#16A34A', '#EA580C', '#0891B2', '#C026D3', '#CA8A04'];
const FUNNEL_BAR_COLORS = CHART_COLORS;

const FUNNEL_STAGE_ORDER = [
  'new',
  'contacted',
  'qualified',
  'proposal',
  'negotiation',
  'converted',
  'won',
  'lost',
  'inactive',
];

function sortFunnelStages(data: Array<{ name: string; value: number }> | null | undefined) {
  const rows = Array.isArray(data) ? data : [];
  const rank = (name: string) => {
    const key = String(name || '').trim().toLowerCase();
    const idx = FUNNEL_STAGE_ORDER.findIndex((s) => key.includes(s));
    return idx === -1 ? 99 : idx;
  };
  return [...rows].sort((a, b) => rank(a.name) - rank(b.name || '') || b.value - a.value);
}

type Props = {
  overview: CrmOverview | null;
  loading?: boolean;
  /** charts | tables | all | portfolio (breakdown + record scope) */
  mode?: 'charts' | 'tables' | 'all' | 'portfolio';
};

export function PieBlock({
  title,
  subtitle,
  data,
  center,
  centerLabel = 'Total',
  onSliceClick,
  nested = false,
  compact = false,
  stack = false,
}: {
  title: string;
  subtitle?: string;
  data: Array<{ name: string; value: number }>;
  center?: string;
  centerLabel?: string;
  onSliceClick?: (sliceName: string) => void;
  nested?: boolean;
  compact?: boolean;
  stack?: boolean;
}) {
  const slices = Array.isArray(data) ? data : [];
  const total = slices.reduce((s, d) => s + d.value, 0) || 1;
  const chartSize = compact ? 128 : 168;
  const inner = compact ? 44 : 58;
  const outer = compact ? 58 : 74;

  return (
    <div
      className={
        nested
          ? 'p-1'
          : `${dashCard} group relative flex h-full ${compact ? 'min-h-[220px]' : 'min-h-[300px]'} flex-col overflow-hidden rounded-[1.75rem] ${compact ? 'p-4' : 'p-5'} shadow-[0_18px_48px_-28px_rgba(15,23,42,0.28)] transition duration-200 hover:shadow-[0_22px_52px_-24px_rgba(15,23,42,0.32)]`
      }
    >
      {!nested ? (
        <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-indigo-500 via-violet-400 to-lime-400 opacity-90" />
      ) : null}

      <div className={`${compact ? 'mb-2' : 'mb-4'}`}>
        <h3 className={`${compact ? 'text-[12px]' : 'text-[13px]'} font-semibold tracking-tight text-slate-900`}>
          {title}
        </h3>
        {subtitle ? <p className="mt-0.5 text-[11px] text-slate-400">{subtitle}</p> : null}
      </div>

      <div
        className={`flex w-full items-stretch gap-3 ${
          stack ? 'flex-col items-center' : 'flex-col sm:flex-row sm:items-center'
        }`}
      >
        <div
          className={`relative shrink-0 ${stack ? 'mx-auto' : 'mx-auto sm:mx-0'}`}
          style={{ width: chartSize, height: chartSize }}
        >
          {slices.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={slices}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={inner}
                  outerRadius={outer}
                  paddingAngle={slices.length > 1 ? 2.5 : 0}
                  cornerRadius={slices.length > 1 ? 6 : 0}
                  stroke="#fff"
                  strokeWidth={2}
                  onClick={(entry: { name?: string }) => {
                    if (entry?.name && onSliceClick) onSliceClick(String(entry.name));
                  }}
                  className={onSliceClick ? 'cursor-pointer' : undefined}
                >
                  {slices.map((_, i) => (
                    <Cell
                      key={i}
                      fill={CHART_COLORS[i % CHART_COLORS.length]}
                      className="outline-none transition-opacity hover:opacity-90"
                    />
                  ))}
                </Pie>
                <Tooltip
                  cursor={false}
                  formatter={(v: number, name: string) => [
                    `${v} (${((Number(v) / total) * 100).toFixed(1)}%)`,
                    name,
                  ]}
                  contentStyle={{
                    borderRadius: 12,
                    border: '1px solid #e2e8f0',
                    boxShadow: '0 8px 24px rgba(15,23,42,0.08)',
                    fontSize: 12,
                    padding: '8px 10px',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center rounded-full bg-slate-50 text-xs text-slate-400 ring-1 ring-slate-100">
              No data
            </div>
          )}
          {center ? (
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <p className={`${compact ? 'text-lg' : 'text-xl'} font-semibold tabular-nums text-slate-900`}>
                {center}
              </p>
              <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">{centerLabel}</p>
            </div>
          ) : null}
        </div>

        <ul className={`min-w-0 space-y-2.5 ${stack ? 'w-full max-w-sm' : 'flex-1'}`}>
          {slices.length ? (
            slices.map((d, i) => {
              const pct = (d.value / total) * 100;
              const fill = CHART_COLORS[i % CHART_COLORS.length];
              return (
                <li key={d.name} className="group/item">
                  <button
                    type="button"
                    onClick={() => onSliceClick?.(d.name)}
                    className={`mb-1 flex w-full items-center justify-between gap-2 text-left ${
                      onSliceClick ? 'cursor-pointer rounded-lg px-1 py-0.5 hover:bg-slate-50' : ''
                    }`}
                  >
                    <span className="flex min-w-0 items-center gap-2 text-[12px] font-medium text-slate-700">
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: fill }} />
                      <span className="truncate">{d.name}</span>
                    </span>
                    <span className="shrink-0 text-[12px] font-semibold tabular-nums text-slate-900">
                      {d.value}
                      <span className="ml-1 font-medium text-slate-500">{pct.toFixed(0)}%</span>
                    </span>
                  </button>
                  <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${Math.max(pct, 2)}%`, background: fill }}
                    />
                  </div>
                </li>
              );
            })
          ) : (
            <li className="text-sm text-slate-400">Nothing to chart yet</li>
          )}
        </ul>
      </div>
    </div>
  );
}

export function LeadStageFunnelBlock({
  data,
  totalLeads,
  nested = false,
  onStageClick,
  compact = false,
}: {
  data: Array<{ name: string; value: number }>;
  totalLeads: number;
  nested?: boolean;
  onStageClick?: (stageName: string) => void;
  compact?: boolean;
}) {
  const stages = sortFunnelStages(data.filter((d) => d.value > 0));
  const total = totalLeads || stages.reduce((s, d) => s + d.value, 0) || 1;
  const firstStage = stages[0]?.value || 0;
  const lastStage = stages[stages.length - 1]?.value || 0;
  const endToEndPct =
    firstStage > 0 ? Math.round((lastStage / firstStage) * 1000) / 10 : null;

  return (
    <div
      className={
        nested
          ? `flex h-full ${compact ? 'min-h-[220px]' : 'min-h-[300px]'} flex-col p-1`
          : `${dashCard} relative flex h-full ${compact ? 'min-h-[220px] rounded-[1.75rem] p-4' : 'min-h-[300px] rounded-[1.75rem] p-5'} flex-col overflow-hidden shadow-[0_18px_48px_-28px_rgba(15,23,42,0.28)]`
      }
    >
      {!nested ? (
        <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-indigo-500 via-violet-400 to-lime-400 opacity-90" />
      ) : null}
      <div className="mb-3 flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
        <div>
          <h3 className="text-[13px] font-semibold tracking-tight text-slate-900">
            Lead pipeline funnel
          </h3>
          <p className="mt-0.5 text-[11px] text-slate-400">
            Stage conversion · click a step to drill down
          </p>
        </div>
        <div className="rounded-xl bg-slate-50 px-3 py-2 text-right ring-1 ring-slate-100">
          <p className="text-lg font-bold tabular-nums leading-none text-slate-900">
            {formatNum(total)}
          </p>
          <p className="mt-0.5 text-[9px] font-semibold uppercase tracking-wider text-slate-400">
            In pipeline
          </p>
          {endToEndPct != null && stages.length > 1 ? (
            <p className="mt-1 text-[10px] font-medium text-indigo-600">
              {endToEndPct}% reach final stage
            </p>
          ) : null}
        </div>
      </div>

      {stages.length ? (
        <div className="relative flex flex-1 flex-col justify-center gap-1 py-1">
          {stages.map((stage, i) => {
            const pctTotal = Math.round((stage.value / total) * 1000) / 10;
            const prev = i > 0 ? stages[i - 1].value : null;
            const stepPct =
              prev && prev > 0 ? Math.round((stage.value / prev) * 1000) / 10 : null;
            const taperBase = 100 - i * Math.min(13, 42 / Math.max(stages.length - 1, 1));
            const widthPct = Math.max(38, taperBase * 0.92);

            return (
              <div key={stage.name} className="relative flex items-center gap-2.5 py-0.5">
                <div className="w-[92px] shrink-0 text-right">
                  <p className="text-[10px] font-semibold leading-tight text-slate-700">
                    {stage.name}
                  </p>
                  {stepPct != null ? (
                    <p className="mt-0.5 text-[9px] font-semibold text-indigo-600">
                      {stepPct}% ← prior
                    </p>
                  ) : (
                    <p className="mt-0.5 text-[9px] text-slate-400">Entry</p>
                  )}
                </div>

                <div className="flex min-w-0 flex-1 justify-center">
                  <motion.button
                    type="button"
                    initial={{ scaleX: 0.55, opacity: 0 }}
                    animate={{ scaleX: 1, opacity: 1 }}
                    transition={{ delay: i * 0.05, duration: 0.35, ease: 'easeOut' }}
                    onClick={() => onStageClick?.(stage.name)}
                    className="group relative flex h-9 min-w-[4.5rem] items-center justify-center rounded-md text-[11px] font-bold tabular-nums text-white shadow-[0_10px_20px_-12px_rgba(15,23,42,0.55)] transition hover:brightness-105"
                    style={{
                      width: `${widthPct}%`,
                      background: FUNNEL_BAR_COLORS[i % FUNNEL_BAR_COLORS.length],
                      clipPath: 'polygon(6% 0%, 94% 0%, 100% 100%, 0% 100%)',
                      transformOrigin: 'center',
                    }}
                    title={`${stage.name}: ${stage.value} (${pctTotal}% of pipeline)`}
                  >
                    <span className="relative z-[1] drop-shadow-sm">{formatNum(stage.value)}</span>
                  </motion.button>
                </div>

                <div className="w-11 shrink-0 text-right">
                  <span className="text-[11px] font-bold tabular-nums text-slate-800">
                    {pctTotal}%
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="flex flex-1 items-center justify-center py-8 text-sm text-slate-400">
          No lead stage data yet
        </p>
      )}

      {stages.length > 1 ? (
        <div className="mt-2 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
          {stages.slice(0, 4).map((s, i) => (
            <span
              key={s.name}
              className="inline-flex items-center gap-1.5 rounded-full bg-slate-50 px-2 py-0.5 text-[10px] text-slate-600 ring-1 ring-slate-100"
            >
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ background: FUNNEL_BAR_COLORS[i % FUNNEL_BAR_COLORS.length] }}
              />
              {s.name}: {s.value}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function CrmChartsAndTables({ overview, loading, mode = 'all' }: Props) {
  const { openDrillDown } = useCrmDashboard();
  const { modules } = useDashboardAccess();
  const [section, setSection] = useState<CrmPipelineSection>(modules.leads ? 'leads' : 'clients');
  const [scoped, setScoped] = useState(false);
  const isPortfolio = mode === 'portfolio';
  const showCharts = isPortfolio || mode === 'charts' || mode === 'all';
  const showScope = isPortfolio || mode === 'tables' || mode === 'all';

  const leadPie = Array.isArray(overview?.leadStagePie) && overview.leadStagePie.length
      ? overview.leadStagePie
      : (Array.isArray(overview?.leadStatusBars) ? overview.leadStatusBars : []).map((r) => ({
          name: r.name,
          value: r.value,
        }));

  const clientPie =
    Array.isArray(overview?.clientStatusPie) && overview.clientStatusPie.length
      ? overview.clientStatusPie
      : [
          { name: 'Active', value: Number(overview?.kpis?.activeClients || 0) },
          { name: 'Inactive', value: Number(overview?.kpis?.inactiveClients || 0) },
          { name: 'On Hold', value: Number(overview?.kpis?.onHoldClients || 0) },
          { name: 'Prospect', value: Number(overview?.kpis?.prospectClients || 0) },
        ].filter((x) => x.value > 0);

  const sourcePie = Array.isArray(overview?.leadSources) ? overview.leadSources : [];
  const industryPie = Array.isArray(overview?.industries) ? overview.industries : [];
  const useIndustryChart = clientPie.length <= 1 && industryPie.length > 1;
  const clientChartData = useIndustryChart ? industryPie : clientPie;
  const clientChartTitle = useIndustryChart ? 'Industries' : 'Client mix';
  const clientChartSub = useIndustryChart ? 'Account industries' : 'Status mix';

  if (loading && !overview) {
    return (
      <div className="space-y-4">
        <div className="h-24 animate-pulse rounded-2xl bg-white/80" />
        <div className="h-56 animate-pulse rounded-2xl bg-white/80" />
        {showCharts ? (
          <div className="grid gap-4 lg:grid-cols-12">
            <div className="h-56 animate-pulse rounded-2xl bg-white/80 lg:col-span-5" />
            <div className="h-56 animate-pulse rounded-2xl bg-white/80 lg:col-span-3" />
            <div className="h-56 animate-pulse rounded-2xl bg-white/80 lg:col-span-4" />
          </div>
        ) : null}
      </div>
    );
  }

  const chartsBlock = showCharts ? (
    <div className="grid gap-3 lg:grid-cols-12 lg:items-stretch">
      {modules.leads ? (
      <div className="lg:col-span-5">
        <LeadStageFunnelBlock
          nested={false}
          compact={isPortfolio}
          data={leadPie}
          totalLeads={Number(overview?.kpis?.totalLeads || 0)}
          onStageClick={(name) => openDrillDown(buildLeadSliceDrillDown(overview, name, 'status'))}
        />
      </div>
      ) : null}
      {modules.clients ? (
      <div className="lg:col-span-3">
        <PieBlock
          nested={false}
          compact={isPortfolio}
          title={clientChartTitle}
          subtitle={clientChartSub}
          data={clientChartData}
          center={formatNum(overview?.kpis?.totalClients)}
          centerLabel="Clients"
          onSliceClick={(name) => openDrillDown(buildClientSliceDrillDown(overview, name))}
        />
      </div>
      ) : null}
      {modules.leads ? (
      <div className="lg:col-span-4">
        <PieBlock
          nested={false}
          compact={isPortfolio}
          title="Lead sources"
          subtitle="Acquisition mix"
          data={sourcePie}
          center={formatNum(sourcePie.reduce((s, d) => s + Number(d.value || 0), 0))}
          centerLabel="Tagged"
          onSliceClick={(name) => openDrillDown(buildLeadSliceDrillDown(overview, name, 'source'))}
        />
      </div>
      ) : null}
    </div>
  ) : null;

  if (isPortfolio) {
    return (
      <div className="space-y-5">
        <CrmRecordScopePicker
          overview={overview}
          section={section}
          onSectionChange={setSection}
          onScopedChange={setScoped}
        />
        {!scoped ? (
          <CrmPipelineIntelligence
          overview={overview}
          section={section}
          leadCharts={
            modules.leads ? (
            <div className="grid gap-3 lg:grid-cols-12 lg:items-stretch">
              <div className="lg:col-span-7">
                <LeadStageFunnelBlock
                  nested={false}
                  compact
                  data={leadPie}
                  totalLeads={Number(overview?.kpis?.totalLeads || 0)}
                  onStageClick={(name) =>
                    openDrillDown(buildLeadSliceDrillDown(overview, name, 'status'))
                  }
                />
              </div>
              <div className="lg:col-span-5">
                <PieBlock
                  nested={false}
                  compact
                  title="Lead sources"
                  subtitle="Acquisition mix"
                  data={sourcePie}
                  center={formatNum(sourcePie.reduce((s, d) => s + Number(d.value || 0), 0))}
                  centerLabel="Tagged"
                  onSliceClick={(name) =>
                    openDrillDown(buildLeadSliceDrillDown(overview, name, 'source'))
                  }
                />
              </div>
            </div>
            ) : null
          }
          clientCharts={
            <PieBlock
              nested={false}
              compact
              stack
              title={clientChartTitle}
              subtitle={clientChartSub}
              data={clientChartData}
              center={formatNum(overview?.kpis?.totalClients)}
              centerLabel="Clients"
              onSliceClick={(name) => openDrillDown(buildClientSliceDrillDown(overview, name))}
            />
          }
          />
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {showCharts && !scoped ? chartsBlock : null}
      {showScope ? (
        <CrmRecordScopePicker
          overview={overview}
          section={section}
          onSectionChange={setSection}
          onScopedChange={setScoped}
        />
      ) : null}
    </div>
  );
}

