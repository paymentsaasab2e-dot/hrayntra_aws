'use client';

import React from 'react';
import { motion } from 'framer-motion';
import {
  AlertTriangle,
  Award,
  Briefcase,
  Calendar,
  Percent,
  UserRound,
} from 'lucide-react';
import type { RecruitmentOverview } from '@/lib/dashboard/api';
import { formatInr, formatNum, recCard, useRecDashboard } from './recShared';

type KpiDef = {
  key: string;
  label: string;
  href: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  tone: string;
  format?: 'number' | 'percent' | 'money';
  subtitle?: (overview: RecruitmentOverview | null) => string;
};

const KPI_DEFS: KpiDef[] = [
  {
    key: 'openJobs',
    label: 'Open Jobs',
    href: '/job',
    icon: Briefcase,
    tone: 'bg-amber-50 text-amber-700',
    subtitle: (o) =>
      `${formatNum(o?.kpis?.hotJobs)} hot · ${formatNum(o?.kpis?.jobsNoCandidates)} no candidates`,
  },
  {
    key: 'totalCandidates',
    label: 'Candidates',
    href: '/candidate',
    icon: UserRound,
    tone: 'bg-violet-50 text-violet-700',
    subtitle: (o) =>
      `${formatNum(o?.kpis?.newCandidates)} new · ${formatNum(o?.kpis?.activeCandidates)} active`,
  },
  {
    key: 'interviewsToday',
    label: 'Interviews Today',
    href: '/interviews',
    icon: Calendar,
    tone: 'bg-sky-50 text-sky-700',
    subtitle: (o) =>
      `${formatNum(o?.kpis?.interviewsUpcoming)} upcoming · ${formatNum(o?.kpis?.interviewsOverdueFeedback)} feedback due`,
  },
  {
    key: 'joinedPlacements',
    label: 'Joined',
    href: '/placement',
    icon: Award,
    tone: 'bg-emerald-50 text-emerald-700',
    subtitle: (o) =>
      `${formatNum(o?.kpis?.offersSent)} offers · ${formatNum(o?.kpis?.pendingPlacements)} pending`,
  },
  {
    key: 'fillRate',
    label: 'Fill Rate',
    href: '/job',
    icon: Percent,
    tone: 'bg-slate-100 text-slate-700',
    format: 'percent',
    subtitle: (o) =>
      `${formatNum(o?.kpis?.filledJobs)} filled of ${formatNum(Number(o?.kpis?.openJobs || 0) + Number(o?.kpis?.filledJobs || 0))} roles`,
  },
  {
    key: 'alerts',
    label: 'Alerts',
    href: '/recruitment',
    icon: AlertTriangle,
    tone: 'bg-rose-50 text-rose-700',
    subtitle: (o) =>
      `${formatNum(o?.kpis?.jobsSlaRisk)} SLA risk · ${formatInr(o?.kpis?.placementRevenue as number)} revenue`,
  },
];

function fmt(value: number | null | undefined, format?: KpiDef['format']) {
  if (value == null) return '—';
  if (format === 'percent') return `${value}%`;
  if (format === 'money') return formatInr(value);
  return formatNum(value);
}

type Props = { overview: RecruitmentOverview | null; loading?: boolean };

export function RecKpiGrid({ overview, loading }: Props) {
  const { openDrillDown } = useRecDashboard();
  const k = overview?.kpis || {};

  if (loading && !overview) {
    return (
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-[108px] animate-pulse rounded-2xl bg-white" />
        ))}
      </div>
    );
  }

  return (
    <section className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
      {KPI_DEFS.map((def, idx) => {
        const Icon = def.icon;
        const value = k[def.key];
        return (
          <motion.button
            key={def.key}
            type="button"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(idx * 0.03, 0.18) }}
            whileTap={{ scale: 0.98 }}
            onClick={() =>
              openDrillDown({
                title: def.label,
                href: def.href,
                metricKey: def.key,
                subtitle: def.subtitle?.(overview),
                rows: [{ metric: def.label, value: value ?? 0 }],
              })
            }
            className={`${recCard} group p-4 text-left transition hover:border-slate-300 hover:shadow-sm`}
          >
            <div className="flex items-center gap-2.5">
              <span
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${def.tone}`}
              >
                <Icon size={15} />
              </span>
              <p className="truncate text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                {def.label}
              </p>
            </div>
            <p className="mt-3 text-[26px] font-bold leading-none tracking-tight tabular-nums text-slate-900">
              {fmt(value as number, def.format)}
            </p>
            <p className="mt-2 truncate text-[11px] leading-snug text-slate-400">
              {def.subtitle?.(overview) || 'View details'}
            </p>
          </motion.button>
        );
      })}
    </section>
  );
}
