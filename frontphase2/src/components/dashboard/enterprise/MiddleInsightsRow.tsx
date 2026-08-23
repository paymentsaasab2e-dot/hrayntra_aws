'use client';

import React, { useMemo } from 'react';
import Link from 'next/link';
import { motion } from 'motion/react';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Info,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { DashboardOverview } from '@/lib/dashboard/api';
import { useEnterpriseDashboard } from './smartDashboardFilters';
import {
  cardClass,
  cardHover,
  formatCount,
  formatMoney,
  formatMoneyFull,
} from './dashboardUi';

const PIPELINE_COLORS = [
  '#6366F1',
  '#3B82F6',
  '#0EA5E9',
  '#14B8A6',
  '#F59E0B',
  '#10B981',
  '#F43F5E',
];

type Props = {
  overview: DashboardOverview | null;
  loading?: boolean;
};

function severityIcon(severity?: string) {
  if (severity === 'high') return <AlertTriangle size={14} className="text-rose-500" />;
  if (severity === 'medium') return <Info size={14} className="text-amber-500" />;
  return <CheckCircle2 size={14} className="text-emerald-500" />;
}

export function MiddleInsightsRow({ overview, loading }: Props) {
  const { openDrillDown } = useEnterpriseDashboard();
  const insights = overview?.insights || [];
  const pipeline = overview?.crmPipeline || [];
  const k = overview?.kpis || {};

  const revenueSeries = useMemo(() => {
    const raw = overview?.revenueTrend || [];
    return raw.map((row, i) => ({
      label: String(row.label || row.date || row.period || `D${i + 1}`).slice(0, 10),
      value: Number(row.value ?? row.revenue ?? row.amount ?? 0),
    }));
  }, [overview?.revenueTrend]);

  const conversion = Number(k.conversionRate || 0);
  const pipelineValue = Number(k.pipelineValue || 0);
  const revenue = Number(k.revenue || 0);

  if (loading && !overview) {
    return (
      <div className="grid gap-4 xl:grid-cols-12">
        <div className="h-72 animate-pulse rounded-[20px] bg-white xl:col-span-3" />
        <div className="h-72 animate-pulse rounded-[20px] bg-white xl:col-span-5" />
        <div className="h-72 animate-pulse rounded-[20px] bg-white xl:col-span-4" />
      </div>
    );
  }

  return (
    <div className="grid gap-4 xl:grid-cols-12">
      {/* AI Insights */}
      <section className={`${cardClass} flex flex-col p-5 xl:col-span-3`}>
        <div className="mb-3 flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
            <Sparkles size={16} />
          </span>
          <div>
            <h2 className="text-sm font-bold text-slate-900">AI Insights</h2>
            <p className="text-[11px] text-slate-500">Live recommendations</p>
          </div>
        </div>
        <ul className="flex-1 space-y-2.5">
          {(insights.length ? insights : [{ id: 'empty', severity: 'info', text: 'Business pulse looks steady — ask Brain for next actions.' }])
            .slice(0, 6)
            .map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() =>
                    openDrillDown({
                      title: 'AI Insight',
                      href: item.href || '/dashboard',
                      rows: [{ insight: item.text, action: item.action || '' }],
                    })
                  }
                  className="flex w-full items-start gap-2 rounded-xl px-1 py-1 text-left hover:bg-slate-50"
                >
                  <span className="mt-0.5 shrink-0">{severityIcon(item.severity)}</span>
                  <span
                    className={`text-[13px] leading-snug ${
                      item.severity === 'high' ? 'font-medium text-rose-600' : 'text-slate-700'
                    }`}
                  >
                    {item.text}
                  </span>
                </button>
              </li>
            ))}
        </ul>
        <Link
          href="/dashboard"
          className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-[#3B82F6] hover:underline"
        >
          View All Insights <ArrowRight size={12} />
        </Link>
      </section>

      {/* Chevron Pipeline */}
      <section className={`${cardClass} p-5 xl:col-span-5`}>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Pipeline Overview</h2>
            <p className="text-[11px] text-slate-500">Lead funnel · click a stage</p>
          </div>
          <span className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-600">
            Lead Pipeline
          </span>
        </div>

        <div className="flex flex-wrap items-stretch gap-1 sm:flex-nowrap">
          {pipeline.map((stage, i) => (
            <motion.button
              key={stage.stage}
              type="button"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.04 }}
              onClick={() =>
                openDrillDown({
                  title: `${stage.stage} leads`,
                  href: stage.href || '/leads',
                  rows: [{ stage: stage.stage, count: stage.count }],
                })
              }
              className={`${cardHover} relative min-w-0 flex-1 overflow-hidden rounded-lg px-1.5 py-3 text-center text-white`}
              style={{
                background: PIPELINE_COLORS[i % PIPELINE_COLORS.length],
                clipPath:
                  i === 0
                    ? 'polygon(0 0, calc(100% - 8px) 0, 100% 50%, calc(100% - 8px) 100%, 0 100%)'
                    : i === pipeline.length - 1
                      ? 'polygon(0 0, 100% 0, 100% 100%, 0 100%, 8px 50%)'
                      : 'polygon(0 0, calc(100% - 8px) 0, 100% 50%, calc(100% - 8px) 100%, 0 100%, 8px 50%)',
              }}
            >
              <p className="truncate text-[10px] font-semibold uppercase tracking-wide opacity-90">
                {stage.stage}
              </p>
              <p className="text-sm font-bold sm:text-base">{formatCount(stage.count)}</p>
            </motion.button>
          ))}
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4 text-sm">
          <p className="text-slate-600">
            Total Pipeline Value:{' '}
            <span className="font-bold text-slate-900">{formatMoneyFull(pipelineValue)}</span>
          </p>
          <p className="text-slate-600">
            Conversion Rate:{' '}
            <span className="font-bold text-emerald-600">
              {conversion}%{' '}
              <TrendingUp size={14} className="inline text-emerald-500" />
            </span>
          </p>
        </div>
      </section>

      {/* Revenue Trend */}
      <section className={`${cardClass} flex flex-col p-5 xl:col-span-4`}>
        <div className="mb-2 flex items-start justify-between gap-2">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Revenue Trend</h2>
            <p className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
              {formatMoneyFull(revenue)}{' '}
              <span className="text-sm font-semibold text-emerald-600">↑ live</span>
            </p>
          </div>
          <span className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-600">
            This Month
          </span>
        </div>
        <div className="min-h-[180px] flex-1">
          {revenueSeries.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueSeries}>
                <defs>
                  <linearGradient id="revFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6366F1" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#6366F1" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="label" hide />
                <YAxis hide />
                <Tooltip
                  formatter={(v: number) => formatMoney(v)}
                  contentStyle={{
                    borderRadius: 12,
                    border: '1px solid #e2e8f0',
                    fontSize: 12,
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="#6366F1"
                  strokeWidth={2.5}
                  fill="url(#revFill)"
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-slate-400">
              No revenue trend for this range yet
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
