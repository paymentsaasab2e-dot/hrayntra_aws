'use client';

import React from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
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

type Props = {
  chartType: string;
  rows: Record<string, unknown>[];
  config?: WidgetConfig;
  datasetId?: string;
  height?: number;
};

export function WidgetChart({ chartType, rows, config = {}, datasetId, height = 260 }: Props) {
  const built = buildChartSeries(rows, chartType, config, datasetId);
  const { series, tableRows, kpiValue } = built;

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
    return (
      <div className="flex h-full min-h-[220px] w-full flex-col">
        <DashboardDataTable
          rows={tableRows}
          variant={variant}
          maxRows={200}
          maxColumns={10}
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
    const pieData = series.filter((s) => s.value > 0);
    if (!pieData.length) {
      return (
        <div className="flex h-full min-h-[120px] items-center justify-center text-sm text-slate-500">
          No values to display for this chart.
        </div>
      );
    }
    return (
      <ChartShell height={height}>
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
            {pieData.map((_, i) => (
              <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip />
          {config.showLegend !== false ? <Legend /> : null}
        </PieChart>
      </ChartShell>
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

  if (chartType === 'funnel' || chartType === 'progressBar') {
    const max = Math.max(...series.map((s) => s.value), 1);
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
                className="h-full rounded-full"
                style={{
                  width: `${(item.value / max) * 100}%`,
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

