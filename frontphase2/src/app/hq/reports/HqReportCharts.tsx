'use client';

import React from 'react';
import { motion } from 'motion/react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { HqNamedCount } from './hqReportsBuild';
import { HQ_REPORTS_CARD, HQ_REPORTS_CHART_COLORS, HQ_REPORTS_TOOLTIP } from './hqReportsChrome';

export type HqReportChartKind = 'donut' | 'bar' | 'hbar' | 'stacked' | 'funnel' | 'area' | 'ranking';

export type HqReportChartSpec = {
  id: string;
  title: string;
  kind: HqReportChartKind;
  rows: HqNamedCount[];
  filterKey?: string;
  stackedKeys?: Array<{ key: string; label: string }>;
  stackedRows?: Array<Record<string, string | number>>;
  valueLabel?: string;
};

const COLORS = HQ_REPORTS_CHART_COLORS;
const axisTick = { fontSize: 10, fill: '#64748b' };
const gridStroke = '#E2E8F0';

function EmptyChart({ label = 'Not enough data available for this visualization.' }: { label?: string }) {
  return (
    <div className="flex h-[220px] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-200/80 bg-slate-50/40 px-6 text-center">
      <span className="h-8 w-8 rounded-full bg-slate-100 ring-1 ring-slate-200/80" />
      <p className="text-xs font-medium text-slate-400">{label}</p>
    </div>
  );
}

function ChartCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <motion.section
      whileHover={{ y: -2 }}
      transition={{ duration: 0.18, ease: 'easeOut' }}
      className={`${HQ_REPORTS_CARD} p-5`}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-indigo-300/60 to-transparent"
      />
      <div className="relative z-10 mb-4 flex items-center gap-2.5">
        <span className="h-4 w-1 shrink-0 rounded-full bg-gradient-to-b from-slate-900 to-blue-900" />
        <h3 className="truncate text-[13px] font-semibold tracking-tight text-slate-800">{title}</h3>
      </div>
      {children}
    </motion.section>
  );
}

export function HqReportChart({
  spec,
  metric = 'count',
  onSliceClick,
  activeLabel,
}: {
  spec: HqReportChartSpec;
  metric?: 'count' | 'pipeline';
  onSliceClick?: (filterKey: string, label: string) => void;
  activeLabel?: string | null;
}) {
  const kind: HqReportChartKind = spec.kind === 'donut' && spec.rows.length > 6 ? 'hbar' : spec.kind;
  const data = spec.rows.map((row) => ({
    name: row.label,
    value: Number(metric === 'pipeline' ? row.value || 0 : row.count || 0),
  }));
  const stackedHasData = Boolean(
    spec.stackedRows?.some((row) => spec.stackedKeys?.some((item) => Number(row[item.key] || 0) > 0)),
  );
  const hasData = data.some((row) => row.value > 0) || stackedHasData;
  const handleClick = (label: string) => {
    if (spec.filterKey && onSliceClick) onSliceClick(spec.filterKey, label);
  };

  if (kind === 'funnel') {
    const max = Math.max(1, ...spec.rows.map((row) => row.count));
    return (
      <ChartCard title={spec.title}>
        {!hasData ? (
          <EmptyChart />
        ) : (
          <div className="space-y-2 py-2">
            {spec.rows.map((row, index) => {
              const width = 42 + Math.round((row.count / max) * 58);
              const active = activeLabel === row.label;
              return (
                <button
                  key={row.label}
                  type="button"
                  onClick={() => handleClick(row.label)}
                  className="block w-full"
                >
                  <div
                    className={`mx-auto rounded-lg px-3 py-2.5 text-center text-sm font-semibold text-white shadow-sm transition ${
                      active ? 'ring-2 ring-indigo-400' : ''
                    }`}
                    style={{
                      width: `${width}%`,
                      background: COLORS[index % COLORS.length],
                    }}
                  >
                    {row.label} · {row.count}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </ChartCard>
    );
  }

  if (kind === 'ranking') {
    const top = Math.max(1, ...spec.rows.map((row) => Number(metric === 'pipeline' ? row.value || 0 : row.count)));
    return (
      <ChartCard title={spec.title}>
        {!hasData ? (
          <EmptyChart />
        ) : (
          <ol className="space-y-2.5">
            {spec.rows.slice(0, 8).map((row, index) => {
              const value = metric === 'pipeline' ? Number(row.value || 0) : row.count;
              return (
                <li key={row.label}>
                  <button
                    type="button"
                    className="w-full text-left"
                    onClick={() => handleClick(row.label)}
                  >
                    <div className="mb-1 flex items-center justify-between gap-2 text-sm">
                      <span className="truncate font-medium text-slate-700">
                        <span className="mr-2 text-xs font-bold text-slate-400">{index + 1}</span>
                        {row.label}
                      </span>
                      <span className="shrink-0 font-semibold text-slate-900">{value}</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.round((value / top) * 100)}%`,
                          background: COLORS[index % COLORS.length],
                        }}
                      />
                    </div>
                  </button>
                </li>
              );
            })}
          </ol>
        )}
      </ChartCard>
    );
  }

  return (
    <ChartCard title={spec.title}>
      {!hasData ? (
        <EmptyChart />
      ) : (
        <div className="h-[240px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            {kind === 'donut' ? (
              <PieChart>
                <Pie
                  data={data}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={58}
                  outerRadius={88}
                  paddingAngle={2}
                  onClick={(entry) => handleClick(String(entry?.name || ''))}
                >
                  {data.map((row, index) => (
                    <Cell
                      key={row.name}
                      fill={COLORS[index % COLORS.length]}
                      stroke={activeLabel === row.name ? '#4f46e5' : '#fff'}
                      strokeWidth={activeLabel === row.name ? 3 : 1}
                    />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={HQ_REPORTS_TOOLTIP}
                  formatter={(value: number, name: string) => {
                    const total = data.reduce((sum, row) => sum + row.value, 0) || 1;
                    return [`${value} (${Math.round((value / total) * 100)}%)`, name];
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            ) : kind === 'area' ? (
              <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="reportsAreaFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#8B5CF6" stopOpacity={0.34} />
                    <stop offset="100%" stopColor="#8B5CF6" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="4 8" stroke={gridStroke} vertical={false} />
                <XAxis dataKey="name" tick={axisTick} axisLine={false} tickLine={false} />
                <YAxis tick={axisTick} axisLine={false} tickLine={false} width={40} allowDecimals={false} />
                <Tooltip contentStyle={HQ_REPORTS_TOOLTIP} cursor={{ stroke: '#C7D2FE', strokeWidth: 1 }} />
                <Area type="monotone" dataKey="value" stroke="#8B5CF6" fill="url(#reportsAreaFill)" strokeWidth={2.6} strokeLinecap="round" />
              </AreaChart>
            ) : kind === 'stacked' && spec.stackedRows && spec.stackedKeys ? (
              <BarChart data={spec.stackedRows} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                <CartesianGrid strokeDasharray="4 8" stroke={gridStroke} vertical={false} />
                <XAxis dataKey="label" tick={axisTick} axisLine={false} tickLine={false} />
                <YAxis tick={axisTick} axisLine={false} tickLine={false} width={40} allowDecimals={false} />
                <Tooltip contentStyle={HQ_REPORTS_TOOLTIP} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                {spec.stackedKeys.map((item, index) => (
                  <Bar key={item.key} dataKey={item.key} name={item.label} stackId="a" fill={COLORS[index % COLORS.length]} />
                ))}
              </BarChart>
            ) : kind === 'hbar' ? (
              <BarChart data={data} layout="vertical" margin={{ top: 8, right: 12, left: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="4 8" stroke={gridStroke} horizontal={false} />
                <XAxis type="number" tick={axisTick} axisLine={false} tickLine={false} allowDecimals={false} />
                <YAxis type="category" dataKey="name" width={110} tick={axisTick} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={HQ_REPORTS_TOOLTIP} />
                <Bar
                  dataKey="value"
                  radius={[0, 6, 6, 0]}
                  maxBarSize={22}
                  onClick={(entry) => handleClick(String((entry as { name?: string })?.name || ''))}
                >
                  {data.map((row, index) => (
                    <Cell key={row.name} fill={activeLabel === row.name ? '#4f46e5' : COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            ) : (
              <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 24 }}>
                <CartesianGrid strokeDasharray="4 8" stroke={gridStroke} vertical={false} />
                <XAxis dataKey="name" tick={axisTick} axisLine={false} tickLine={false} interval={0} angle={-18} textAnchor="end" height={48} />
                <YAxis tick={axisTick} axisLine={false} tickLine={false} width={40} allowDecimals={false} />
                <Tooltip contentStyle={HQ_REPORTS_TOOLTIP} />
                <Bar
                  dataKey="value"
                  radius={[6, 6, 0, 0]}
                  maxBarSize={36}
                  onClick={(entry) => handleClick(String((entry as { name?: string })?.name || ''))}
                >
                  {data.map((row, index) => (
                    <Cell key={row.name} fill={activeLabel === row.name ? '#4f46e5' : COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
      )}
    </ChartCard>
  );
}

export function HqReportChartGrid({
  charts,
  onSliceClick,
  activeLabel,
}: {
  charts: HqReportChartSpec[];
  onSliceClick?: (filterKey: string, label: string) => void;
  activeLabel?: string | null;
}) {
  if (charts.length === 0) return null;
  const [primary, secondary, ...rest] = charts;
  return (
    <div className="space-y-4">
      {primary ? (
        <div className={`grid gap-4 ${secondary ? 'lg:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]' : ''}`}>
          <HqReportChart spec={primary} onSliceClick={onSliceClick} activeLabel={activeLabel} />
          {secondary ? <HqReportChart spec={secondary} onSliceClick={onSliceClick} activeLabel={activeLabel} /> : null}
        </div>
      ) : null}
      {rest.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {rest.map((spec) => (
            <HqReportChart key={spec.id} spec={spec} onSliceClick={onSliceClick} activeLabel={activeLabel} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
