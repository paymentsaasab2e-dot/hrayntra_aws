'use client';

import React from 'react';
import { motion } from 'motion/react';
import {
  AlertTriangle,
  Clock3,
  Percent,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { Area, AreaChart, ResponsiveContainer } from 'recharts';
import type { CrmOverview } from '@/lib/dashboard/api';
import { HqInfoTip } from '@/components/hq/analytics/HqPhase2DashboardParts';
import { dashCard, formatNum, useCrmDashboard } from './crmShared';
import { useDashboardAccess } from '@/lib/dashboard/useDashboardAccess';
import { buildKpiDrillDown } from './crmDrillDown';
import { CrmStatNumber, sparkDelta, sparkValues } from './crmStatNumber';

type KpiDef = {
  key: string;
  label: string;
  href: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  tone: string;
  format?: 'number' | 'percent';
  info: string;
  module?: 'leads' | 'clients' | 'tasks';
  subtitle?: (overview: CrmOverview | null) => string;
  resolveValue?: (overview: CrmOverview | null) => number | null | undefined;
};

/** Actionable insights only — totals for leads/clients live in pipeline pies. */
const INSIGHT_KPI_DEFS: KpiDef[] = [
  {
    key: 'conversionRate',
    label: 'Conversion rate',
    href: '/leads?status=Converted',
    icon: Percent,
    tone: 'bg-emerald-50 text-emerald-600',
    format: 'percent',
    module: 'leads',
    info: 'Overall % of leads converted in the selected period (all stages → converted). Differs from Insights “Qualified → win”, which only measures the qualified subset.',
    subtitle: (o) =>
      `${formatNum(o?.kpis?.convertedLeads)} converted of ${formatNum(o?.kpis?.totalLeads)} leads`,
  },
  {
    key: 'overdueFollowups',
    label: 'Overdue follow-ups',
    href: '/dashboard',
    icon: Clock3,
    tone: 'bg-rose-50 text-rose-600',
    module: 'leads',
    info: 'Leads whose next follow-up date is in the past. Open Insights → Follow-up dashboard for Today / Tomorrow / Overdue / Completed breakdown.',
    subtitle: (o) => {
      const today = formatNum(o?.followups?.today);
      const tomorrow = formatNum(o?.followups?.tomorrow);
      return `${today} due today · ${tomorrow} tomorrow`;
    },
  },
  {
    key: 'alerts',
    label: 'Active alerts',
    href: '/dashboard',
    icon: AlertTriangle,
    tone: 'bg-amber-50 text-amber-700',
    info: 'Open CRM risk alerts for your scope. High-priority items should be reviewed first in the Alerts panel.',
    subtitle: (o) => {
      const high = (o?.alerts || []).filter((a) => a.severity === 'high').length;
      return high > 0 ? `${high} high priority` : 'Review CRM risks';
    },
  },
  {
    key: 'newLeads',
    label: 'New leads',
    href: '/leads',
    icon: Sparkles,
    tone: 'bg-blue-50 text-blue-600',
    module: 'leads',
    info: 'New leads in the selected date filter (period total). Today’s pulse shows today’s intake only.',
    subtitle: (o) =>
      `${formatNum(o?.kpis?.convertedLeads)} converted in period · ${formatNum(o?.kpis?.activeClients)} active clients`,
  },
  {
    key: 'waitingOnYou',
    label: 'Waiting on you',
    href: '/request?view=approvals',
    icon: ShieldCheck,
    tone: 'bg-violet-50 text-violet-700',
    info: 'Approvals in your bucket: team requests, task completion, lead conversion, and cross-department work.',
    subtitle: (o) => {
      const w = o?.myWork;
      if (!w) return 'Open Approvals to act';
      return `${formatNum(w.pendingTeamRequests)} team · ${formatNum(w.awaitingTaskApproval)} task`;
    },
    resolveValue: (o) =>
      o?.myWork?.pendingApprovalsTotal ?? o?.kpis?.waitingOnYou ?? 0,
  },
];

function fmt(value: number | null | undefined, format?: KpiDef['format']) {
  if (value == null) return '—';
  if (format === 'percent') return `${value}%`;
  return formatNum(value);
}

type Props = { overview: CrmOverview | null; loading?: boolean };

export function CrmKpiGrid({ overview, loading }: Props) {
  const { openDrillDown } = useCrmDashboard();
  const { modules, showMineApprovals } = useDashboardAccess();
  const k = overview?.kpis || {};
  const spark = overview?.leadSpark || [];
  const defs = INSIGHT_KPI_DEFS.filter((def) => {
    if (def.key === 'waitingOnYou') return showMineApprovals;
    return !def.module || modules[def.module];
  });

  if (loading && !overview) {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-32 animate-pulse rounded-2xl bg-white" />
        ))}
      </div>
    );
  }

  return (
    <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4">
      {defs.map((def, idx) => {
        const Icon = def.icon;
        const value = def.resolveValue ? def.resolveValue(overview) : k[def.key];
        return (
          <motion.div
            key={def.key}
            role="button"
            tabIndex={0}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(idx * 0.03, 0.2) }}
            whileTap={{ scale: 0.98 }}
            onClick={() =>
              openDrillDown(buildKpiDrillDown(overview, def.key, def.label, def.href))
            }
            onKeyDown={(e) => {
              if (e.key !== 'Enter' && e.key !== ' ') return;
              e.preventDefault();
              openDrillDown(buildKpiDrillDown(overview, def.key, def.label, def.href));
            }}
            className={`${dashCard} group relative cursor-pointer overflow-hidden p-4 text-left transition hover:shadow-[0_18px_48px_-24px_rgba(15,23,42,0.2)]`}
          >
            <div className="pointer-events-none absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-indigo-500/60 via-blue-400/40 to-teal-400/40 opacity-80" />
            <div className="flex items-start justify-between gap-2">
              <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${def.tone}`}>
                <Icon size={18} />
              </span>
              <div className="h-9 w-20 opacity-80">
                {spark.length && def.key === 'newLeads' ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={spark}>
                      <Area
                        type="monotone"
                        dataKey="value"
                        stroke="#3B82F6"
                        fill="#3B82F6"
                        fillOpacity={0.15}
                        strokeWidth={1.5}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : null}
              </div>
            </div>
            <div className="mt-3 flex items-center gap-1">
              <p className="text-[11px] font-medium text-slate-500">{def.label}</p>
              <HqInfoTip text={def.info} />
            </div>
            <CrmStatNumber
              className="mt-1"
              value={fmt(value as number, def.format)}
              label={def.key === 'conversionRate' ? 'rate' : def.key === 'newLeads' ? 'leads' : def.key === 'overdueFollowups' ? 'overdue' : 'open'}
              deltaPct={def.key === 'newLeads' ? sparkDelta(spark) : null}
              spark={def.key === 'newLeads' ? sparkValues(spark) : undefined}
              invertDelta={def.key === 'overdueFollowups' || def.key === 'alerts'}
            />
            <p className="mt-1 text-[10px] leading-snug text-slate-400">
              {def.subtitle?.(overview) || 'Click for details'}
            </p>
          </motion.div>
        );
      })}
    </section>
  );
}
