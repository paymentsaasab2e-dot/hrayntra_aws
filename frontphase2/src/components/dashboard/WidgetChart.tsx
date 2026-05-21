'use client';

import React from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Funnel,
  FunnelChart,
  LabelList,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { CHART_COLORS, buildChartSeries } from '../../lib/dashboard/chartData';
import { CHART_TOOLTIP_STYLE } from '../../lib/dashboard/chartTheme';
import { getModuleListRoute } from '../../lib/dashboard/moduleRoutes';
import { moduleForDatasetId } from '../../lib/dashboard/moduleGroups';
import type { WidgetConfig } from '../../lib/dashboard/types';
import { DashboardDataTable } from './DashboardDataTable';

function ChartShell({ height, children }: { height: number; children: React.ReactNode }) {
  return (
    <div className="w-full min-h-[200px]" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        {children}
      </ResponsiveContainer>
    </div>
  );
}

type PartitionSlice = { name: string; value: number };

function PartitionPieTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number; payload?: PartitionSlice }>;
}) {
  if (!active || !payload?.length) return null;
  const item = payload[0];
  const name = item?.name ?? item?.payload?.name ?? '';
  const value = Number(item?.value ?? item?.payload?.value ?? 0);
  return (
    <div
      className="rounded-xl border border-indigo-200/60 bg-white px-3 py-2 text-xs shadow-lg"
      style={CHART_TOOLTIP_STYLE as React.CSSProperties}
    >
      <p className="font-semibold text-slate-900">{name}</p>
      <p className="mt-0.5 tabular-nums text-slate-600">{value.toLocaleString()} records</p>
    </div>
  );
}

function PartitionChartLegend({
  data,
  showLegend,
}: {
  data: PartitionSlice[];
  showLegend: boolean;
}) {
  if (!showLegend || !data.length) return null;
  const total = data.reduce((sum, item) => sum + item.value, 0) || 1;

  return (
    <ul className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
      {data.map((item, i) => {
        const pct = Math.round((item.value / total) * 100);
        return (
          <li key={`${item.name}-${i}`} className="flex items-center gap-2 text-xs">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}
              aria-hidden
            />
            <span className="font-medium text-slate-800">{item.name}</span>
            <span className="tabular-nums text-slate-500">
              {item.value.toLocaleString()} · {pct}%
            </span>
          </li>
        );
      })}
    </ul>
  );
}

type Props = {
  chartType: string;
  rows: Record<string, unknown>[];
  config?: WidgetConfig;
  datasetId?: string;
  module?: string;
  height?: number;
  /** When true, table widgets show more rows (e.g. fullscreen). */
  expandTable?: boolean;
};

export function WidgetChart({
  chartType,
  rows,
  config = {},
  datasetId,
  module,
  height = 260,
  expandTable = false,
}: Props) {
  const built = buildChartSeries(rows, chartType, config, datasetId);
  const { series, tableRows, kpiValue, partitionMetricsBlocked } = built as typeof built & {
    partitionMetricsBlocked?: boolean;
  };

  if (chartType === 'kpi' || chartType === 'counter' || chartType === 'gauge') {
    const display = chartType === 'counter' ? kpiValue : kpiValue;
    return (
      <div className="flex h-full min-h-[120px] flex-col items-center justify-center">
        <p className="text-4xl font-bold tracking-tight text-slate-900">
          {new Intl.NumberFormat().format(display)}
        </p>
        <p className="mt-1 text-xs font-medium uppercase tracking-wider text-slate-500">
          {chartType === 'gauge' ? 'Performance' : chartType === 'counter' ? 'Total count' : 'Key metric'}
        </p>
        {chartType === 'gauge' ? (
          <div className="mt-4 h-2 w-full max-w-xs overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-indigo-600 transition-all"
              style={{ width: `${Math.min(100, Math.max(8, (display % 100) + 10))}%` }}
            />
          </div>
        ) : null}
      </div>
    );
  }

  if (chartType === 'table' || chartType === 'expandableTable' || chartType === 'pivotTable') {
    const variant =
      chartType === 'expandableTable' ? 'expandable' : chartType === 'pivotTable' ? 'pivot' : 'table';
    const viewAllHref =
      getModuleListRoute(module) ||
      (datasetId ? getModuleListRoute(moduleForDatasetId(datasetId)) : null);
    const viewAllLabel = module ? `View all ${module}` : 'View all';
    return (
      <div className="flex h-full min-h-[160px] w-full flex-col">
        <DashboardDataTable
          rows={tableRows}
          variant={variant}
          maxRows={200}
          maxColumns={10}
          previewRowLimit={expandTable ? 50 : 5}
          viewAllHref={expandTable ? null : viewAllHref}
          viewAllLabel={viewAllLabel}
          fillHeight
          aria-label={
            variant === 'pivot' ? 'Pivot table' : variant === 'expandable' ? 'Expandable table' : 'Data table'
          }
        />
      </div>
    );
  }

  if (!series.length) {
    return (
      <div className="flex h-full min-h-[120px] items-center justify-center text-sm text-slate-500">
        No chartable data for this configuration.
      </div>
    );
  }

  const horizontal = chartType === 'horizontalBar';

  if (chartType === 'pie' || chartType === 'donut') {
    if (partitionMetricsBlocked) {
      return (
        <div className="flex h-full min-h-[120px] flex-col items-center justify-center gap-2 px-4 text-center text-sm text-slate-600">
          <p className="font-medium text-slate-800">Use a list dataset for this chart</p>
          <p className="text-xs text-slate-500">
            Pie and donut charts show status breakdowns (e.g. All clients). Remove this widget and
            add one from <strong>All clients</strong>, not Client metrics.
          </p>
        </div>
      );
    }
    const pieData = series.filter((s) => s.value > 0);
    if (!pieData.length) {
      return (
        <div className="flex h-full min-h-[120px] items-center justify-center text-sm text-slate-500">
          No values to display for this chart.
        </div>
      );
    }
    const showLegend = config.showLegend !== false;
    const total = pieData.reduce((sum, item) => sum + item.value, 0);
    const legendBlockHeight = showLegend ? 88 : 0;
    const chartHeight = Math.max(160, height - legendBlockHeight);

    return (
      <div className="flex h-full min-h-[200px] w-full flex-col" style={{ height }}>
        <div className="min-h-0 w-full flex-1">
          <ChartShell height={chartHeight}>
            <PieChart>
              <Pie
                data={pieData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={chartType === 'donut' ? 52 : 0}
                outerRadius={88}
                paddingAngle={2}
              >
                {pieData.map((entry, i) => (
                  <Cell key={`${entry.name}-${i}`} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip content={<PartitionPieTooltip />} />
            </PieChart>
          </ChartShell>
        </div>
        {showLegend ? (
          <div className="shrink-0 border-t border-slate-100 pt-3 text-center">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Breakdown
            </p>
            <PartitionChartLegend data={pieData} showLegend={showLegend} />
            <p className="mt-2 text-[10px] tabular-nums text-slate-500">
              Total {total.toLocaleString()}
            </p>
          </div>
        ) : null}
      </div>
    );
  }

  if (chartType === 'scatter' || chartType === 'bubble') {
    return (
      <ChartShell height={height}>
        <ScatterChart>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="x" type="number" />
          <YAxis dataKey="y" type="number" />
          <Tooltip cursor={{ strokeDasharray: '3 3' }} />
          <Scatter data={series} fill="#2563eb" />
        </ScatterChart>
      </ChartShell>
    );
  }

  if (chartType === 'line' || chartType === 'timeline') {
    return (
      <ChartShell height={height}>
        <LineChart data={series}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="name" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip />
          <Line type="monotone" dataKey="value" stroke="#2563eb" strokeWidth={2.5} dot={false} />
        </LineChart>
      </ChartShell>
    );
  }

  if (chartType === 'area') {
    return (
      <ChartShell height={height}>
        <AreaChart data={series}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="name" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip />
          <Area type="monotone" dataKey="value" stroke="#2563eb" fill="#2563eb" fillOpacity={0.15} />
        </AreaChart>
      </ChartShell>
    );
  }

  if (chartType === 'funnel') {
    const funnelData = series
      .filter((s) => s.value > 0)
      .map((item, i) => ({
        name: item.name,
        value: item.value,
        fill: CHART_COLORS[i % CHART_COLORS.length],
      }));
    if (!funnelData.length) {
      return (
        <div className="flex h-full min-h-[120px] items-center justify-center text-sm text-slate-500">
          No values to display for this funnel.
        </div>
      );
    }
    const funnelHeight = Math.max(height, 300);
    return (
      <ChartShell height={funnelHeight}>
        <FunnelChart margin={{ top: 12, right: 96, bottom: 12, left: 12 }}>
          <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
          <Funnel dataKey="value" data={funnelData} isAnimationActive>
            <LabelList position="right" fill="#64748b" stroke="none" dataKey="name" fontSize={11} />
            <LabelList position="center" fill="#fff" stroke="none" dataKey="value" fontSize={11} />
          </Funnel>
        </FunnelChart>
      </ChartShell>
    );
  }

  if (chartType === 'progressBar') {
    const topValue = series[0]?.value || Math.max(...series.map((s) => s.value), 1);
    return (
      <div className="space-y-2 py-1">
        {series.map((item, i) => (
          <div key={item.name}>
            <div className="mb-1 flex justify-between text-xs text-slate-600">
              <span>{item.name}</span>
              <span className="font-semibold text-slate-900">{item.value}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${Math.max(4, (item.value / topValue) * 100)}%`,
                  backgroundColor: CHART_COLORS[i % CHART_COLORS.length],
                }}
              />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <ChartShell height={height}>
      <BarChart data={series} layout={horizontal ? 'vertical' : 'horizontal'}>
        <CartesianGrid strokeDasharray="3 3" vertical={!horizontal} horizontal={horizontal} />
        {horizontal ? (
          <>
            <XAxis type="number" tick={{ fontSize: 11 }} />
            <YAxis dataKey="name" type="category" width={90} tick={{ fontSize: 10 }} />
          </>
        ) : (
          <>
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
          </>
        )}
        <Tooltip />
        <Bar dataKey="value" fill="#2563eb" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ChartShell>
  );
}

