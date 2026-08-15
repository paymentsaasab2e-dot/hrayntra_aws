'use client';

import React, { useState } from 'react';
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
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { RecruitmentOverview } from '@/lib/dashboard/api';
import { HqInfoTip } from '@/components/hq/analytics/HqPhase2DashboardParts';
import { formatNum } from './recShared';
import { CrmStatNumber, CrmStockDelta } from '@/components/dashboard/crm/crmStatNumber';

export const REC_ORANGE = '#F97316';
export const REC_CHARCOAL = '#334155';
export const REC_TRACK = '#E8EEF4';
export const REC_SLICE = [REC_CHARCOAL, REC_ORANGE, '#64748B', '#0F766E', '#1E3A8A', '#7C3AED', '#E11D48', '#0891B2'];
export const REC_CARD =
  'relative h-full rounded-[1.25rem] border border-slate-100/80 bg-white shadow-[0_14px_40px_-28px_rgba(15,23,42,0.22)]';
export const REC_CARD_PAD = `${REC_CARD} p-4`;
export const REC_CARD_COMPACT = `${REC_CARD} p-3.5`;

export type RecGaugeTone = 'lime' | 'indigo' | 'violet' | 'rose' | 'amber';
const TONE_TICKS: Record<RecGaugeTone, [string, string, string]> = {
  lime: ['#E8F9A8', '#A3E635', '#65A30D'],
  indigo: ['#C7D2FE', '#818CF8', '#4F46E5'],
  violet: ['#DDD6FE', '#A78BFA', '#7C3AED'],
  rose: ['#FECDD3', '#FB7185', '#E11D48'],
  amber: ['#FDE68A', '#FBBF24', '#D97706'],
};

export function recInitials(name?: string) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

export function recKpi(overview: RecruitmentOverview | null, key: string) {
  return Number(overview?.kpis?.[key] || 0);
}

export function RecChartHead({ title, sub, info }: { title: string; sub?: string; info: string }) {
  return (
    <div className="mb-2 flex items-start justify-between gap-2">
      <div className="min-w-0">
        <h3 className="text-[13px] font-bold text-slate-900">{title}</h3>
        {sub ? <p className="mt-0.5 text-[11px] font-medium text-slate-400">{sub}</p> : null}
      </div>
      <span className="shrink-0">
        <HqInfoTip text={info} />
      </span>
    </div>
  );
}

export function RecStatShell({
  children,
  onClick,
  info,
  className = '',
}: {
  children: React.ReactNode;
  onClick?: () => void;
  info?: string;
  className?: string;
}) {
  return (
    <div
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={(e) => {
        if (!onClick) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      className={`${onClick ? 'cursor-pointer transition hover:-translate-y-0.5' : ''} ${className}`}
    >
      {info ? (
        <span className="absolute right-2.5 top-2.5 z-20" onClick={(e) => e.stopPropagation()}>
          <HqInfoTip text={info} />
        </span>
      ) : null}
      {children}
    </div>
  );
}

export function RecSegmentedBar({
  parts,
  height = 12,
}: {
  parts: Array<{ value: number; color: string }>;
  height?: number;
}) {
  const sum = parts.reduce((s, p) => s + Math.max(0, p.value), 0);
  return (
    <div className="flex w-full overflow-hidden rounded-md bg-[#E8EEF4]" style={{ height }}>
      {sum <= 0
        ? null
        : parts.map((p, i) =>
            p.value > 0 ? (
              <div
                key={`${p.color}-${i}`}
                className="h-full min-w-0"
                style={{ width: `${(p.value / sum) * 100}%`, background: p.color }}
              />
            ) : null,
          )}
    </div>
  );
}

export function RecFillBar({ pct, color, height = 12 }: { pct: number; color: string; height?: number }) {
  const w = Math.min(100, Math.max(0, pct));
  return (
    <div className="w-full overflow-hidden rounded-md bg-[#E8EEF4]" style={{ height }}>
      <div className="h-full rounded-none" style={{ width: `${w}%`, background: color }} />
    </div>
  );
}

export function RecNavyTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value?: number; name?: string; color?: string; payload?: Record<string, number | string> }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const total = payload.reduce((s, p) => s + Number(p.value || 0), 0);
  const denom = total || 1;
  const prev = Number(payload[0]?.payload?.prev ?? 0);
  const delta = prev > 0 ? Math.round(((total - prev) / prev) * 1000) / 10 : null;
  return (
    <div className="min-w-[168px] rounded-xl bg-[#1E293B] px-3 py-2.5 text-white shadow-[0_12px_28px_-12px_rgba(15,23,42,0.55)]">
      <p className="text-[10px] font-medium text-slate-400">{label}</p>
      <div className="mt-1 flex items-center gap-2">
        <p className="text-lg font-bold tabular-nums leading-none">{formatNum(total)}</p>
        {delta != null ? (
          <span
            className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${
              delta >= 0 ? 'bg-emerald-400/20 text-emerald-300' : 'bg-rose-400/20 text-rose-300'
            }`}
          >
            {delta >= 0 ? '+' : ''}
            {delta}%
          </span>
        ) : null}
      </div>
      <div className="mt-2.5 flex h-2 overflow-hidden rounded-md bg-white/10">
        {payload.map((p, i) => {
          const v = Number(p.value || 0);
          if (v <= 0) return null;
          return (
            <div
              key={p.name || i}
              className="h-full"
              style={{ width: `${(v / denom) * 100}%`, background: p.color || REC_ORANGE }}
            />
          );
        })}
      </div>
      <div className="mt-1.5 flex justify-between gap-2 text-[10px] text-slate-400">
        {payload.map((p) => (
          <span key={p.name}>
            {p.name} {formatNum(Number(p.value || 0))}
          </span>
        ))}
      </div>
    </div>
  );
}

export function RecSemiGauge({
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
  tone?: RecGaugeTone;
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
  const long = display.length > 5;

  return (
    <RecStatShell onClick={onClick} info={info} className={`${REC_CARD_PAD} flex flex-col items-center px-5 pb-6 pt-6 text-center`}>
      <div className="relative w-full max-w-[240px]">
        <svg viewBox="0 0 220 128" className="h-auto w-full" aria-hidden>
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
          <path d="M 32 104 A 78 78 0 0 1 188 104" fill="none" stroke={REC_TRACK} strokeWidth="18" strokeLinecap="round" />
          {fillPct > 0 ? (
            <path
              d="M 32 104 A 78 78 0 0 1 188 104"
              fill="none"
              stroke={`url(#g-${gid})`}
              strokeWidth="18"
              strokeLinecap="round"
              strokeDasharray={`${fillLen} ${trackLen}`}
              filter={`url(#glow-${gid})`}
            />
          ) : null}
        </svg>
        <div className="pointer-events-none absolute inset-x-0 bottom-[18px] flex justify-center px-3">
          <CrmStatNumber
            value={display}
            size={long ? 'md' : 'lg'}
            variant="gauge"
            deltaPct={deltaPct}
            invertDelta={invertDelta}
          />
        </div>
      </div>
      <p className="mt-4 max-w-[260px] px-2 text-[13px] font-semibold leading-snug tracking-tight text-slate-800">{label}</p>
      {sub ? <p className="mt-1.5 max-w-[280px] px-3 text-[12px] font-medium leading-relaxed text-slate-400">{sub}</p> : null}
    </RecStatShell>
  );
}

export function RecChartTip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value?: number; name?: string; color?: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="min-w-[132px] rounded-xl bg-[#1E293B] px-3 py-2 text-white shadow-[0_12px_28px_-12px_rgba(15,23,42,0.55)]">
      {label ? <p className="text-[10px] font-medium text-slate-400">{label}</p> : null}
      {payload.map((p, i) => (
        <p key={`${p.name || i}`} className="mt-0.5 flex items-center gap-1.5 text-[12px] font-semibold tabular-nums">
          <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: p.color || REC_ORANGE }} />
          {p.name && p.name !== label ? <span className="font-medium text-slate-300">{p.name}</span> : null}
          {formatNum(Number(p.value || 0))}
        </p>
      ))}
    </div>
  );
}

type Slice = { name: string; value: number; color?: string };

export function RecDonut({
  data,
  center,
  height = 168,
}: {
  data: Slice[];
  center?: { value: string; label?: string };
  height?: number;
}) {
  const [active, setActive] = useState<number | null>(null);
  const total = data.reduce((s, d) => s + Math.max(0, d.value), 0) || 1;
  const rows = data.filter((d) => d.value > 0);

  return (
    <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-center">
      <div className="relative shrink-0" style={{ width: height, height }}>
        {rows.length ? (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={rows}
                dataKey="value"
                nameKey="name"
                innerRadius={height * 0.28}
                outerRadius={height * 0.42}
                paddingAngle={3}
                cornerRadius={4}
                stroke="#fff"
                strokeWidth={2}
                onMouseEnter={(_, i) => setActive(i)}
                onMouseLeave={() => setActive(null)}
              >
                {rows.map((d, i) => (
                  <Cell
                    key={d.name}
                    fill={d.color || REC_SLICE[i % REC_SLICE.length]}
                    opacity={active == null || active === i ? 1 : 0.45}
                  />
                ))}
              </Pie>
              <Tooltip content={<RecChartTip />} cursor={false} />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full items-center justify-center px-3 text-center text-[12px] text-slate-400">
            Nothing in this mix yet
          </div>
        )}
        {center && rows.length ? (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <CrmStatNumber value={center.value} label={center.label} size="sm" variant="gauge" />
          </div>
        ) : null}
      </div>
      <ul className="min-w-0 flex-1 space-y-1">
        {rows.slice(0, 6).map((d, i) => (
          <li
            key={d.name}
            className={`flex items-center justify-between gap-2 rounded-md px-1 py-0.5 text-[11px] ${
              active === i ? 'bg-slate-50' : ''
            }`}
            onMouseEnter={() => setActive(i)}
            onMouseLeave={() => setActive(null)}
          >
            <span className="flex min-w-0 items-center gap-1.5 truncate text-slate-600">
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: d.color || REC_SLICE[i % REC_SLICE.length] }} />
              <span className="truncate capitalize">{d.name}</span>
            </span>
            <span className="shrink-0 font-semibold tabular-nums text-slate-800">
              {formatNum(d.value)}
              <span className="ml-1 font-normal text-slate-400">({Math.round((d.value / total) * 100)}%)</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function RecVBars({
  data,
  height = 180,
  grouped,
}: {
  data: Array<Record<string, string | number>>;
  height?: number;
  grouped?: Array<{ key: string; color: string }>;
}) {
  const series = grouped?.length ? grouped : [{ key: 'value', color: REC_CHARCOAL }];
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 4, left: -18, bottom: data.length > 4 ? 18 : 0 }}>
          <CartesianGrid vertical={false} stroke="#EEF2F7" />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 10, fill: '#64748B' }}
            axisLine={false}
            tickLine={false}
            interval={0}
            angle={data.length > 4 ? -28 : 0}
            textAnchor={data.length > 4 ? 'end' : 'middle'}
            height={data.length > 4 ? 42 : 24}
          />
          <YAxis tick={{ fontSize: 10, fill: '#94A3B8' }} axisLine={false} tickLine={false} allowDecimals={false} />
          <Tooltip content={<RecChartTip />} cursor={{ fill: 'rgba(15,23,42,0.04)' }} />
          {series.map((s) => (
            <Bar key={s.key} dataKey={s.key} name={s.key === 'value' ? 'Count' : s.key} fill={s.color} radius={[6, 6, 0, 0]} maxBarSize={grouped ? 18 : 28}>
              {!grouped
                ? data.map((d, i) => (
                    <Cell key={String(d.name || i)} fill={typeof d.color === 'string' ? d.color : REC_SLICE[i % REC_SLICE.length]} />
                  ))
                : null}
            </Bar>
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function RecHBars({
  data,
  height = 200,
}: {
  data: Slice[];
  height?: number;
}) {
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart layout="vertical" data={data} margin={{ top: 4, right: 12, left: 4, bottom: 0 }}>
          <CartesianGrid horizontal={false} stroke="#EEF2F7" />
          <XAxis type="number" hide />
          <YAxis
            type="category"
            dataKey="name"
            width={84}
            tick={{ fontSize: 11, fill: '#64748B' }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={<RecChartTip />} cursor={{ fill: 'rgba(15,23,42,0.04)' }} />
          <Bar dataKey="value" radius={[0, 6, 6, 0]} maxBarSize={16}>
            {data.map((d, i) => (
              <Cell key={d.name} fill={d.color || REC_SLICE[i % REC_SLICE.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function stageMovedPct(from: number, to: number): number | null {
  if (from === 0 && to === 0) return null;
  if (from === 0) return to > 0 ? 100 : null;
  const pct = Math.round(((to - from) / Math.abs(from)) * 1000) / 10;
  return pct === 0 ? null : pct;
}

export function RecFunnel({
  stages,
}: {
  stages: Array<{ name: string; value: number; color?: string }>;
}) {
  const gid = React.useId().replace(/:/g, '');
  const rows = stages.length ? stages : [];
  const h = 26;
  const gap = 8;
  const vbH = Math.max(80, rows.length * (h + gap) - gap + 4);
  const vbW = 400;
  const colors = ['#0F172A', '#1E3A8A', '#334155', '#EA580C', '#0F766E'];
  const important = rows.some((r) => r.name === 'Active')
    ? ['Active', 'Applied', 'Interview', 'Offer', 'Joined']
    : ['Applied', 'Interview', 'Offer', 'Joined'];
  const highlights = important
    .map((name) => rows.find((r) => r.name === name))
    .filter((r): r is NonNullable<typeof r> => Boolean(r));

  return (
    <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-10">
      <svg
        viewBox={`0 0 ${vbW} ${vbH}`}
        className="col-span-1 h-[200px] w-full min-w-0 lg:col-span-7"
        role="img"
        aria-label="Hiring funnel"
      >
        <defs>
          {rows.map((s, i) => (
            <linearGradient key={s.name} id={`fn-${gid}-${i}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={s.color || colors[i % colors.length]} stopOpacity="1" />
              <stop offset="100%" stopColor={s.color || colors[i % colors.length]} stopOpacity="0.88" />
            </linearGradient>
          ))}
        </defs>
        {rows.map((s, i) => {
          const y = i * (h + gap);
          const inset = 28 + i * 24;
          const nextInset = 28 + (i + 1) * 24;
          return (
            <g key={s.name}>
              <polygon
                points={`${inset},${y} ${vbW - inset},${y} ${vbW - nextInset},${y + h} ${nextInset},${y + h}`}
                fill={`url(#fn-${gid}-${i})`}
              />
              <text
                x={vbW / 2}
                y={y + h / 2 + 4}
                textAnchor="middle"
                fill="#fff"
                fontSize="11"
                fontWeight="600"
                style={{ fontFamily: 'Plus Jakarta Sans, system-ui, sans-serif' }}
              >
                {s.name}
                <tspan dx="6" fontSize="13" fontWeight="700" style={{ fontFamily: 'Inter, ui-sans-serif, system-ui' }}>
                  {formatNum(s.value)}
                </tspan>
              </text>
            </g>
          );
        })}
      </svg>
      <ul className="col-span-1 min-w-0 space-y-2 pt-0.5 lg:col-span-3">
        {highlights.map((s, i) => {
          const prev = highlights[i - 1];
          const moved = prev ? stageMovedPct(prev.value, s.value) : null;
          return (
            <li key={s.name} className="rounded-xl bg-slate-50 px-3 py-2">
              <p className="text-[11px] font-medium text-slate-400">
                {s.name}
                {prev ? ` vs ${prev.name}` : ''}
              </p>
              <div className="mt-0.5 flex items-center gap-1.5">
                <CrmStatNumber value={formatNum(s.value)} size="sm" />
                <CrmStockDelta pct={moved} />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function RecMultiLine({
  data,
  series,
  height = 188,
}: {
  data: Array<Record<string, string | number>>;
  series: Array<{ key: string; color: string }>;
  height?: number;
}) {
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="#EEF2F7" />
          <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 10, fill: '#94A3B8' }} axisLine={false} tickLine={false} allowDecimals={false} />
          <Tooltip content={<RecChartTip />} />
          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, paddingTop: 4 }} />
          {series.map((s) => (
            <Line
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.key}
              stroke={s.color}
              strokeWidth={2}
              dot={{ r: 2.5, fill: s.color, stroke: '#fff', strokeWidth: 1 }}
              activeDot={{ r: 4 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function RecSparkArea({
  data,
  height = 96,
  color = REC_ORANGE,
}: {
  data: Array<{ label: string; value: number }>;
  height?: number;
  color?: string;
}) {
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 6, left: 0, bottom: 0 }}>
          <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
          <Tooltip content={<RecNavyTooltip />} cursor={{ stroke: '#94A3B8', strokeWidth: 1 }} />
          <Area
            type="monotone"
            dataKey="value"
            name="Opened"
            stroke={color}
            strokeWidth={1.75}
            fill="rgba(249,115,22,0.14)"
            activeDot={{ r: 4, fill: color, stroke: '#fff', strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
