'use client';

import React, { useMemo } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { CrmOverview } from '@/lib/dashboard/api';
import { HqInfoTip } from '@/components/hq/analytics/HqPhase2DashboardParts';
import { buildKpiDrillDown } from './crmDrillDown';
import { dashCard, formatNum, useCrmDashboard } from './crmShared';

const TIP = {
  borderRadius: 12,
  border: '1px solid #e2e8f0',
  boxShadow: '0 8px 24px rgba(15,23,42,0.08)',
  fontSize: 12,
  padding: '8px 10px',
};

const FOLLOWUP_COLORS = {
  today: '#6366F1',
  tomorrow: '#8B5CF6',
  overdue: '#E11D48',
  completed: '#84CC16',
};

const OWNER_COLORS = ['#6366F1', '#F43F5E'];
const ENGAGE_COLORS = ['#84CC16', '#E2E8F0'];

type Props = { overview: CrmOverview | null };

function ChartShell({
  title,
  info,
  subtitle,
  children,
  className = '',
}: {
  title: string;
  info: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`${dashCard} relative flex h-full min-h-[280px] flex-col overflow-hidden rounded-[1.5rem] p-4 sm:p-5 shadow-[0_14px_40px_-24px_rgba(15,23,42,0.2)] ${className}`}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-indigo-500 via-violet-400 to-lime-400" />
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <h3 className="flex items-center gap-1.5 text-[15px] font-bold tracking-tight text-slate-900">
            {title}
            <HqInfoTip text={info} />
          </h3>
          {subtitle ? <p className="mt-0.5 text-[11px] font-medium text-slate-400">{subtitle}</p> : null}
        </div>
      </div>
      <div className="min-h-0 flex-1">{children}</div>
    </section>
  );
}

function EmptyChart({ label }: { label: string }) {
  return (
    <div className="flex h-full min-h-[180px] items-center justify-center text-sm text-slate-400">
      {label}
    </div>
  );
}

export function CrmInsightCharts({ overview }: Props) {
  const { openDrillDown } = useCrmDashboard();

  const leadSpark = overview?.leadSpark || [];
  const clientGrowth = overview?.clientGrowth || [];
  const fu = overview?.followups;
  const leads = overview?.leadsTable || [];

  const followupPie = useMemo(() => {
    const rows = [
      { name: 'Today', value: Number(fu?.today || 0), key: 'today', fill: FOLLOWUP_COLORS.today },
      { name: 'Tomorrow', value: Number(fu?.tomorrow || 0), key: 'tomorrow', fill: FOLLOWUP_COLORS.tomorrow },
      { name: 'Overdue', value: Number(fu?.overdue || 0), key: 'overdue', fill: FOLLOWUP_COLORS.overdue },
      { name: 'Completed', value: Number(fu?.completed || 0), key: 'completed', fill: FOLLOWUP_COLORS.completed },
    ].filter((r) => r.value > 0);
    return rows;
  }, [fu]);

  const followupTotal = followupPie.reduce((s, r) => s + r.value, 0);

  const ownership = useMemo(() => {
    const unassigned = leads.filter(
      (l) => !l.assignee || /unassigned/i.test(String(l.assignee)),
    ).length;
    const assigned = Math.max(0, leads.length - unassigned);
    return {
      unassigned,
      assigned,
      slices: [
        { name: 'Assigned', value: assigned, fill: OWNER_COLORS[0] },
        { name: 'Unassigned', value: unassigned, fill: OWNER_COLORS[1] },
      ].filter((s) => s.value > 0),
    };
  }, [leads]);

  const engagement = useMemo(() => {
    const touched = leads.filter((l) => Number(l.totalMeetings) > 0).length;
    const zero = Math.max(0, leads.length - touched);
    const pct = leads.length ? Math.round((touched / leads.length) * 100) : 0;
    return {
      touched,
      zero,
      pct,
      slices: [
        { name: 'Touched', value: touched, fill: ENGAGE_COLORS[0] },
        { name: 'No touch', value: zero, fill: ENGAGE_COLORS[1] },
      ].filter((s) => s.value > 0),
    };
  }, [leads]);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-12 lg:items-stretch">
        <div className="lg:col-span-5">
          <ChartShell
            title="Lead inflow"
            subtitle="Trend over the selected period"
            info="New-lead volume over time. Differs from the Pipeline funnel (stage mix) and the KPI new-leads count (period total)."
          >
            {leadSpark.length ? (
              <div className="h-[200px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={leadSpark} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                    <defs>
                      <linearGradient id="crmLeadInflow" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#84CC16" stopOpacity={0.4} />
                        <stop offset="100%" stopColor="#84CC16" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 6" stroke="#E2E8F0" vertical={false} />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 10, fill: '#94A3B8' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: '#94A3B8' }}
                      axisLine={false}
                      tickLine={false}
                      allowDecimals={false}
                    />
                    <Tooltip contentStyle={TIP} />
                    <Area
                      type="monotone"
                      dataKey="value"
                      name="New leads"
                      stroke="#65A30D"
                      strokeWidth={2.5}
                      fill="url(#crmLeadInflow)"
                      dot={false}
                      activeDot={{ r: 4, strokeWidth: 0 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <EmptyChart label="No lead trend data yet" />
            )}
          </ChartShell>
        </div>

        <div className="lg:col-span-3">
          <ChartShell
            title="Follow-up queue"
            subtitle="Today · tomorrow · overdue · done"
            info="Operational follow-up mix for Insights. Same buckets as Today’s work → Follow-up dashboard — this is the visual breakdown."
          >
            {followupTotal ? (
              <div className="flex h-full flex-col items-center justify-center gap-3">
                <div className="relative h-[140px] w-[140px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={followupPie}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={44}
                        outerRadius={64}
                        paddingAngle={3}
                        stroke="#fff"
                        strokeWidth={2}
                        onClick={(entry: { name?: string }) => {
                          openDrillDown({
                            title: `${entry?.name || 'Follow-ups'}`,
                            href: '/leads',
                            rows: (fu?.upcoming || []).map((item) => ({
                              Company: item.company,
                              When: item.at ? new Date(item.at).toLocaleString() : '—',
                              Assignee: item.assignee || '—',
                              Status: item.status || '—',
                            })),
                          });
                        }}
                        className="cursor-pointer"
                      >
                        {followupPie.map((d) => (
                          <Cell key={d.key} fill={d.fill} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={TIP} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                    <p className="text-[1.35rem] font-bold tabular-nums tracking-tight text-slate-900">
                      {formatNum(followupTotal)}
                    </p>
                    <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                      Queue
                    </p>
                  </div>
                </div>
                <ul className="grid w-full grid-cols-2 gap-1.5">
                  {followupPie.map((d) => (
                    <li
                      key={d.key}
                      className="flex items-center justify-between gap-1 rounded-xl bg-slate-50/90 px-2.5 py-1.5 text-[10px]"
                    >
                      <span className="flex items-center gap-1.5 font-medium text-slate-600">
                        <span className="h-1.5 w-1.5 rounded-full" style={{ background: d.fill }} />
                        {d.name}
                      </span>
                      <span className="font-bold tabular-nums text-slate-800">{d.value}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <EmptyChart label="No follow-up queue data" />
            )}
          </ChartShell>
        </div>

        <div className="lg:col-span-4">
          <ChartShell
            title="Lead ownership"
            subtitle="Assigned vs unassigned"
            info="Who owns pipeline leads. Click the chart to drill into unassigned records."
          >
            {ownership.slices.length ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 sm:flex-row sm:items-center">
                <button
                  type="button"
                  onClick={() =>
                    openDrillDown(
                      buildKpiDrillDown(overview, 'leadCoverage', 'Unassigned leads', '/leads'),
                    )
                  }
                  className="relative h-[148px] w-[148px] shrink-0"
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={ownership.slices}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={46}
                        outerRadius={66}
                        paddingAngle={3}
                        stroke="#fff"
                        strokeWidth={2}
                        className="cursor-pointer"
                      >
                        {ownership.slices.map((d, i) => (
                          <Cell key={d.name} fill={d.fill || OWNER_COLORS[i % 2]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={TIP} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                    <p className="text-xl font-bold tabular-nums text-slate-900">
                      {ownership.unassigned}
                    </p>
                    <p className="text-[9px] font-semibold uppercase text-slate-400">Unassigned</p>
                  </div>
                </button>
                <ul className="min-w-0 flex-1 space-y-2">
                  {ownership.slices.map((d, i) => (
                    <li key={d.name} className="flex items-center justify-between gap-2 text-[12px]">
                      <span className="flex items-center gap-2 text-slate-600">
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{ background: d.fill || OWNER_COLORS[i % 2] }}
                        />
                        {d.name}
                      </span>
                      <span className="font-bold tabular-nums text-slate-800">{d.value}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <EmptyChart label="No lead ownership data" />
            )}
          </ChartShell>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-12 lg:items-stretch">
        <div className="lg:col-span-7">
          <ChartShell
            title="Client growth"
            subtitle="Portfolio trend over time"
            info="How your client count moves over the period. Pipeline “Client health” is a status mix snapshot — this chart is the growth trend."
          >
            {clientGrowth.length ? (
              <div className="h-[200px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={clientGrowth} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 6" stroke="#E2E8F0" vertical={false} />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 10, fill: '#94A3B8' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: '#94A3B8' }}
                      axisLine={false}
                      tickLine={false}
                      allowDecimals={false}
                    />
                    <Tooltip contentStyle={TIP} />
                    <Line
                      type="monotone"
                      dataKey="value"
                      name="Clients"
                      stroke="#7C3AED"
                      strokeWidth={2.5}
                      dot={{ r: 3, fill: '#7C3AED', strokeWidth: 0 }}
                      activeDot={{ r: 5 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <EmptyChart label="No client growth series yet" />
            )}
          </ChartShell>
        </div>

        <div className="lg:col-span-5">
          <ChartShell
            title="Engagement"
            subtitle="Touched vs cold leads"
            info="Share of leads with at least one logged touchpoint. Separate from ownership — this is outreach coverage."
          >
            {engagement.slices.length ? (
              <button
                type="button"
                onClick={() =>
                  openDrillDown(buildKpiDrillDown(overview, 'engagement', 'Engaged leads', '/leads'))
                }
                className="flex h-full w-full flex-col items-center justify-center gap-3 text-left sm:flex-row sm:items-center"
              >
                <div className="relative h-[148px] w-[148px] shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={engagement.slices}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={46}
                        outerRadius={66}
                        paddingAngle={3}
                        stroke="#fff"
                        strokeWidth={2}
                        className="cursor-pointer"
                      >
                        {engagement.slices.map((d, i) => (
                          <Cell key={d.name} fill={d.fill || ENGAGE_COLORS[i % 2]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={TIP} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                    <p className="text-2xl font-bold tabular-nums text-slate-900">{engagement.pct}%</p>
                    <p className="text-[9px] font-semibold uppercase text-slate-400">Touched</p>
                  </div>
                </div>
                <ul className="min-w-0 flex-1 space-y-2.5">
                  {engagement.slices.map((d, i) => {
                    const total = engagement.touched + engagement.zero || 1;
                    return (
                      <li
                        key={d.name}
                        className="flex items-center justify-between gap-2 rounded-xl bg-slate-50 px-3 py-2 text-[12px] ring-1 ring-slate-100"
                      >
                        <span className="flex items-center gap-2 font-medium text-slate-700">
                          <span
                            className="h-2.5 w-2.5 rounded-full"
                            style={{ background: d.fill || ENGAGE_COLORS[i % 2] }}
                          />
                          {d.name}
                        </span>
                        <span className="font-bold tabular-nums text-slate-900">
                          {d.value}
                          <span className="ml-1 text-[10px] font-medium text-slate-400">
                            {Math.round((d.value / total) * 100)}%
                          </span>
                        </span>
                      </li>
                    );
                  })}
                  <li className="text-[10px] text-slate-400">
                    {engagement.zero > 0
                      ? `${engagement.zero} leads still have zero touchpoints`
                      : 'All leads have been touched'}
                  </li>
                </ul>
              </button>
            ) : (
              <EmptyChart label="No engagement data yet" />
            )}
          </ChartShell>
        </div>
      </div>
    </div>
  );
}
