'use client';

import React, { useMemo } from 'react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { CrmOverview } from '@/lib/dashboard/api';
import { HqInfoTip } from '@/components/hq/analytics/HqPhase2DashboardParts';
import { dashCard } from './crmShared';

const LINE_COLORS = ['#84CC16', '#6366F1', '#8B5CF6', '#0EA5E9', '#F43F5E', '#F59E0B'];

const TIP = {
  borderRadius: 14,
  border: '1px solid #e2e8f0',
  boxShadow: '0 12px 28px rgba(15,23,42,0.08)',
  fontSize: 12,
  padding: '8px 12px',
};

type CompareBlock = NonNullable<NonNullable<CrmOverview['entityCompare']>['leads']>;

function MultiLineCompare({
  title,
  subtitle,
  info,
  block,
  emptyLabel,
}: {
  title: string;
  subtitle: string;
  info: string;
  block?: CompareBlock | null;
  emptyLabel: string;
}) {
  const lines = (block?.lines || []).slice(0, 5);
  const days = block?.days || [];

  const data = useMemo(() => {
    if (!days.length || !lines.length) return [];
    return days.map((label, i) => {
      const row: Record<string, string | number> = { label };
      lines.forEach((line, idx) => {
        row[`s${idx}`] = Number(line.values?.[i] || 0);
      });
      return row;
    });
  }, [days, lines]);

  return (
    <section className={`${dashCard} relative overflow-hidden rounded-[1.75rem] p-4 sm:p-5 shadow-[0_18px_48px_-28px_rgba(15,23,42,0.28)]`}>
      <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-indigo-500 via-violet-400 to-lime-400" />
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <h3 className="flex items-center gap-1.5 text-[13px] font-bold tracking-tight text-slate-900">
            {title}
            <HqInfoTip text={info} />
          </h3>
          <p className="mt-0.5 text-[11px] font-medium text-slate-400">{subtitle}</p>
        </div>
      </div>

      {data.length && lines.length ? (
        <div className="h-[220px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
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
              <Legend
                iconType="circle"
                iconSize={8}
                wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
              />
              {lines.map((line, idx) => (
                <Line
                  key={line.id || idx}
                  type="monotone"
                  dataKey={`s${idx}`}
                  name={line.name}
                  stroke={LINE_COLORS[idx % LINE_COLORS.length]}
                  strokeWidth={2.6}
                  dot={{ r: 3, strokeWidth: 0, fill: LINE_COLORS[idx % LINE_COLORS.length] }}
                  activeDot={{ r: 5 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="flex h-[160px] items-center justify-center text-sm text-slate-400">
          {emptyLabel}
        </div>
      )}
    </section>
  );
}

function PortfolioGrowth({ overview }: { overview: CrmOverview | null }) {
  const leadSpark = overview?.leadSpark || [];
  const clientGrowth = overview?.clientGrowth || [];

  const data = useMemo(() => {
    const map = new Map<string, { label: string; leads: number; clients: number }>();
    for (const p of leadSpark) {
      map.set(p.label, { label: p.label, leads: Number(p.value || 0), clients: 0 });
    }
    for (const p of clientGrowth) {
      const row = map.get(p.label) || { label: p.label, leads: 0, clients: 0 };
      row.clients = Number(p.value || 0);
      map.set(p.label, row);
    }
    return [...map.values()];
  }, [leadSpark, clientGrowth]);

  if (!data.length) return null;

  return (
    <section className={`${dashCard} relative overflow-hidden rounded-[1.5rem] p-4 sm:p-5`}>
      <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-indigo-500 via-violet-400 to-lime-400" />
      <div className="mb-3">
        <h3 className="flex items-center gap-1.5 text-[13px] font-bold tracking-tight text-slate-900">
          Portfolio growth
          <HqInfoTip text="New leads vs new clients over the same labels — existing spark series, not a new metric." />
        </h3>
        <p className="mt-0.5 text-[11px] font-medium text-slate-400">
          Intake volume · leads vs clients
        </p>
      </div>
      <div className="h-[200px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
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
            <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
            <Line
              type="monotone"
              dataKey="leads"
              name="New leads"
              stroke="#6366F1"
              strokeWidth={2.6}
              dot={{ r: 3, strokeWidth: 0, fill: '#6366F1' }}
              activeDot={{ r: 5 }}
            />
            <Line
              type="monotone"
              dataKey="clients"
              name="New clients"
              stroke="#84CC16"
              strokeWidth={2.6}
              dot={{ r: 3, strokeWidth: 0, fill: '#84CC16' }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

type Props = { overview: CrmOverview | null };

export function CrmLeadCompareTimeline({ overview }: Props) {
  return (
    <MultiLineCompare
      title="Top leads · engagement growth"
      subtitle="Cumulative touchpoints · last 14 days · different color per lead"
      info="Compares activity growth for your top leads (completed tasks + logged activities). Only records with real activity in the window."
      block={overview?.entityCompare?.leads}
      emptyLabel="No lead activity in the last 14 days to compare yet"
    />
  );
}

export function CrmClientCompareTimeline({ overview }: Props) {
  return (
    <MultiLineCompare
      title="Top clients · engagement growth"
      subtitle="Cumulative touchpoints · last 14 days · different color per client"
      info="Compares activity growth for your top clients (completed tasks + logged activities). Only accounts with real activity in the window."
      block={overview?.entityCompare?.clients}
      emptyLabel="No client activity in the last 14 days to compare yet"
    />
  );
}

export function CrmPortfolioGrowthTimeline({ overview }: Props) {
  return <PortfolioGrowth overview={overview} />;
}
