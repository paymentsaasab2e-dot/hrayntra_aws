'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { HqInfoTip } from '@/components/hq/analytics/HqPhase2DashboardParts';
import { comboBarClass, comboToneClasses, type CrmComboMetric, type CrmInsightCategory } from './crmInsights';
import { dashCard } from './crmShared';

const CATEGORY_META: Record<
  CrmInsightCategory,
  { title: string; subtitle: string; accent: 'indigo' | 'blue' | 'emerald'; panelInfo: string }
> = {
  leads: {
    title: 'Leads',
    subtitle: 'Pipeline conversion & follow-up',
    accent: 'indigo',
    panelInfo: 'Key lead metrics — conversion speed, engagement, and overdue follow-ups.',
  },
  clients: {
    title: 'Clients',
    subtitle: 'Account health & portfolio',
    accent: 'emerald',
    panelInfo: 'Client retention and portfolio size — active accounts vs total.',
  },
  team: {
    title: 'Team',
    subtitle: 'Rep performance & workload',
    accent: 'blue',
    panelInfo: 'How your team is performing on follow-ups, conversions, and outreach.',
  },
};

export function CrmCategoryStatsPanel({
  category,
  metrics,
  onMetricClick,
}: {
  category: CrmInsightCategory;
  metrics: CrmComboMetric[];
  onMetricClick: (metric: CrmComboMetric) => void;
}) {
  const meta = CATEGORY_META[category];
  const topBar = {
    indigo: 'from-indigo-500/70 via-blue-400/50 to-violet-400/40',
    blue: 'from-blue-500/70 via-indigo-400/50 to-cyan-400/40',
    emerald: 'from-emerald-500/70 via-teal-400/50 to-blue-400/40',
  }[meta.accent];

  if (!metrics.length) return null;

  return (
    <section className={`${dashCard} relative flex h-full flex-col overflow-hidden p-4 sm:p-5`}>
      <div className={`pointer-events-none absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r ${topBar}`} />
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <h2 className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
            <span
              className={`h-4 w-1 shrink-0 rounded-full bg-gradient-to-b ${
                meta.accent === 'indigo'
                  ? 'from-indigo-500 to-violet-400'
                  : meta.accent === 'emerald'
                    ? 'from-emerald-500 to-teal-400'
                    : 'from-blue-500 to-indigo-400'
              }`}
            />
            {meta.title}
            <HqInfoTip text={meta.panelInfo} />
          </h2>
          <p className="mt-0.5 text-[11px] text-slate-400">{meta.subtitle}</p>
        </div>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
          {metrics.length} stat{metrics.length === 1 ? '' : 's'}
        </span>
      </div>
      <ul className="flex flex-1 flex-col gap-2">
        {metrics.map((metric, i) => (
          <CrmInsightStatRow
            key={metric.key}
            metric={metric}
            index={i}
            onClick={() => onMetricClick(metric)}
          />
        ))}
      </ul>
    </section>
  );
}

function CrmInsightStatRow({
  metric,
  index,
  onClick,
}: {
  metric: CrmComboMetric;
  index: number;
  onClick: () => void;
}) {
  const pct = Math.min(100, Math.max(0, metric.pct ?? 0));

  return (
    <motion.li
      initial={{ opacity: 0, x: -4 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: Math.min(index * 0.04, 0.16) }}
    >
      <button
        type="button"
        onClick={onClick}
        className="group w-full rounded-xl border border-slate-100/90 bg-gradient-to-r from-white to-slate-50/40 px-3.5 py-3 text-left transition hover:border-blue-200/70 hover:shadow-sm"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-1">
            <p className="truncate text-[11px] font-medium text-slate-600">{metric.label}</p>
            {metric.info ? <HqInfoTip text={metric.info} /> : null}
          </div>
          <span
            className={`shrink-0 rounded-md px-2 py-0.5 text-[11px] font-bold tabular-nums ring-1 ${comboToneClasses(metric.tone)}`}
          >
            {metric.value}
          </span>
        </div>
        <p className="mt-1 line-clamp-2 text-[10px] leading-relaxed text-slate-400">{metric.sub}</p>
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-slate-100">
          <div
            className={`h-full rounded-full ${comboBarClass(metric.tone)}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        {metric.priority === 'high' ? (
          <span className="mt-1.5 inline-flex rounded-full bg-rose-50 px-2 py-0.5 text-[9px] font-semibold text-rose-600 ring-1 ring-rose-100">
            Needs action
          </span>
        ) : null}
      </button>
    </motion.li>
  );
}

// Legacy grid components — used on Team tab
export function CrmSectionHeader({
  title,
  subtitle,
  accent = 'indigo',
  info,
}: {
  title: string;
  subtitle?: string;
  accent?: 'indigo' | 'blue' | 'emerald' | 'violet';
  info?: string;
}) {
  const accentClass = {
    indigo: 'from-indigo-500 to-teal-400',
    blue: 'from-blue-500 to-indigo-400',
    emerald: 'from-emerald-500 to-teal-400',
    violet: 'from-violet-500 to-indigo-400',
  }[accent];

  return (
    <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
      <h2 className="flex items-center gap-1.5 text-sm font-semibold tracking-tight text-slate-900">
        <span className={`h-4 w-1 shrink-0 rounded-full bg-gradient-to-b ${accentClass}`} />
        {title}
        {info ? <HqInfoTip text={info} /> : null}
      </h2>
      {subtitle ? <p className="text-[11px] text-slate-400">{subtitle}</p> : null}
    </div>
  );
}

export function CrmStatTile({
  metric,
  onClick,
  index = 0,
  size = 'md',
}: {
  metric: CrmComboMetric;
  onClick: () => void;
  index?: number;
  size?: 'sm' | 'md' | 'lg';
}) {
  const pct = Math.min(100, Math.max(0, metric.pct ?? 0));
  const valueSize = size === 'lg' ? 'text-2xl' : size === 'sm' ? 'text-base' : 'text-xl';

  return (
    <motion.button
      type="button"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.03, 0.18) }}
      onClick={onClick}
      className="group flex h-full flex-col rounded-xl border border-slate-100/80 bg-gradient-to-b from-white to-slate-50/60 p-3.5 text-left shadow-[0_1px_2px_rgba(15,23,42,0.03)] transition hover:border-blue-200/60 hover:shadow-[0_8px_24px_-12px_rgba(37,99,235,0.18)]"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1">
          <p className="text-[11px] font-medium leading-tight text-slate-500">{metric.label}</p>
          {metric.info ? <HqInfoTip text={metric.info} /> : null}
        </div>
      </div>
      <p className={`mt-2 font-bold tabular-nums tracking-tight text-slate-900 ${valueSize}`}>
        {metric.value}
      </p>
      <p className="mt-1 line-clamp-2 flex-1 text-[10px] leading-relaxed text-slate-400">
        {metric.sub}
      </p>
      <div className="mt-2.5 h-1 overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-full rounded-full transition-all ${comboBarClass(metric.tone)}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {metric.priority === 'high' ? (
        <span className="mt-2 inline-flex w-fit rounded-full bg-rose-50 px-2 py-0.5 text-[9px] font-semibold text-rose-600 ring-1 ring-rose-100">
          Needs action
        </span>
      ) : null}
    </motion.button>
  );
}

export function CrmMetricPanel({
  title,
  subtitle,
  accent = 'indigo',
  info,
  children,
  className = '',
}: {
  title: string;
  subtitle?: string;
  accent?: 'indigo' | 'blue' | 'emerald' | 'violet';
  info?: string;
  children: React.ReactNode;
  className?: string;
}) {
  const topBar = {
    indigo: 'from-indigo-500/70 via-blue-400/50 to-teal-400/40',
    blue: 'from-blue-500/70 via-indigo-400/50 to-violet-400/40',
    emerald: 'from-emerald-500/70 via-teal-400/50 to-blue-400/40',
    violet: 'from-violet-500/70 via-indigo-400/50 to-blue-400/40',
  }[accent];

  return (
    <section className={`${dashCard} relative overflow-hidden p-4 sm:p-5 ${className}`}>
      <div className={`pointer-events-none absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r ${topBar}`} />
      <CrmSectionHeader title={title} subtitle={subtitle} accent={accent} info={info} />
      {children}
    </section>
  );
}

export function CrmMetricGrid({
  metrics,
  onMetricClick,
  columns = 2,
  size = 'md',
}: {
  metrics: CrmComboMetric[];
  onMetricClick: (metric: CrmComboMetric) => void;
  columns?: 2 | 3 | 4;
  size?: 'sm' | 'md' | 'lg';
}) {
  const colClass =
    columns === 4
      ? 'grid-cols-2 lg:grid-cols-4'
      : columns === 3
        ? 'grid-cols-1 sm:grid-cols-3'
        : 'grid-cols-1 sm:grid-cols-2';

  return (
    <div className={`grid gap-2.5 ${colClass}`}>
      {metrics.map((metric, i) => (
        <CrmStatTile
          key={metric.key}
          metric={metric}
          index={i}
          size={size}
          onClick={() => onMetricClick(metric)}
        />
      ))}
    </div>
  );
}
