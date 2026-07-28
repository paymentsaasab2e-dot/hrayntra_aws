'use client';

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
import { HqPanel, HqPanelTitle } from '../hqUi';
import type { HqAnalyticsChartPoint } from '@/lib/api';

const COLORS = ['#0f172a', '#0284c7', '#059669', '#d97706', '#7c3aed', '#e11d48', '#0891b2', '#64748b'];

function EmptyChart({ label }: { label?: string }) {
  return (
    <div className="flex h-[200px] items-center justify-center text-xs text-slate-400">
      {label || 'No data yet'}
    </div>
  );
}

function ChartShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <HqPanel>
      <HqPanelTitle
        title={title}
        meta={subtitle ? <span className="text-[10px] text-slate-400">{subtitle}</span> : null}
      />
      {children}
    </HqPanel>
  );
}

const tooltipStyle = {
  borderRadius: 12,
  border: '1px solid #e2e8f0',
  fontSize: 12,
  boxShadow: '0 8px 24px rgba(15,23,42,0.08)',
};

export function HqAnalyticsBarChart({
  title,
  subtitle,
  data,
  horizontal,
}: {
  title: string;
  subtitle?: string;
  data: HqAnalyticsChartPoint[];
  horizontal?: boolean;
}) {
  const hasData = data.some((d) => Number(d.value) > 0);
  return (
    <ChartShell title={title} subtitle={subtitle}>
      {!hasData ? (
        <EmptyChart />
      ) : (
        <div className="h-[220px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              layout={horizontal ? 'vertical' : 'horizontal'}
              margin={{ top: 8, right: 8, left: horizontal ? 8 : 0, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={!horizontal} />
              {horizontal ? (
                <>
                  <XAxis type="number" tick={{ fontSize: 10, fill: '#64748b' }} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={88}
                    tick={{ fontSize: 10, fill: '#64748b' }}
                  />
                </>
              ) : (
                <>
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#64748b' }} interval={0} angle={-20} textAnchor="end" height={56} />
                  <YAxis tick={{ fontSize: 10, fill: '#64748b' }} allowDecimals={false} />
                </>
              )}
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="value" radius={[6, 6, 0, 0]} fill="#0f172a" maxBarSize={36} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </ChartShell>
  );
}

export function HqAnalyticsAreaChart({
  title,
  subtitle,
  data,
  color = '#0284c7',
}: {
  title: string;
  subtitle?: string;
  data: HqAnalyticsChartPoint[];
  color?: string;
}) {
  const hasData = data.some((d) => Number(d.value) > 0);
  return (
    <ChartShell title={title} subtitle={subtitle}>
      {!hasData ? (
        <EmptyChart />
      ) : (
        <div className="h-[220px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id={`hq-area-${title.replace(/\s+/g, '-')}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={color} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#64748b' }} />
              <YAxis tick={{ fontSize: 10, fill: '#64748b' }} allowDecimals={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Area
                type="monotone"
                dataKey="value"
                stroke={color}
                fill={`url(#hq-area-${title.replace(/\s+/g, '-')})`}
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </ChartShell>
  );
}

export function HqAnalyticsPieChart({
  title,
  subtitle,
  data,
}: {
  title: string;
  subtitle?: string;
  data: HqAnalyticsChartPoint[];
}) {
  const total = data.reduce((s, d) => s + (Number(d.value) || 0), 0);
  return (
    <ChartShell title={title} subtitle={subtitle}>
      {!total ? (
        <EmptyChart />
      ) : (
        <div className="flex flex-col items-center gap-4 sm:flex-row">
          <div className="h-[180px] w-[180px] shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={48}
                  outerRadius={72}
                  paddingAngle={3}
                  cornerRadius={4}
                  stroke="#fff"
                  strokeWidth={2}
                >
                  {data.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(v: number, name: string) => [
                    `${v} (${((Number(v) / total) * 100).toFixed(1)}%)`,
                    name,
                  ]}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <ul className="w-full space-y-1.5">
            {data.slice(0, 6).map((row, i) => (
              <li key={row.name} className="flex items-center justify-between gap-2 text-xs">
                <span className="flex min-w-0 items-center gap-2 text-slate-600">
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ background: COLORS[i % COLORS.length] }}
                  />
                  <span className="truncate">{row.name}</span>
                </span>
                <span className="font-semibold text-slate-900">{row.value}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </ChartShell>
  );
}
