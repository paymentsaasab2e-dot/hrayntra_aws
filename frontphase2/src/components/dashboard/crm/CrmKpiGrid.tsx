'use client';

import React from 'react';
import { motion } from 'framer-motion';
import {
  AlertTriangle,
  Building2,
  Coins,
  Percent,
  Users,
  UserRound,
} from 'lucide-react';
import { Area, AreaChart, ResponsiveContainer } from 'recharts';
import type { CrmOverview } from '@/lib/dashboard/api';
import { crmCard, formatNum, useCrmDashboard } from './crmShared';
import { buildKpiDrillDown } from './crmDrillDown';

type KpiDef = {
  key: string;
  label: string;
  href: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  tone: string;
  format?: 'number' | 'percent' | 'tokens';
  subtitle?: (overview: CrmOverview | null) => string;
};

const KPI_DEFS: KpiDef[] = [
  {
    key: 'totalLeads',
    label: 'Total Leads',
    href: '/leads',
    icon: Building2,
    tone: 'bg-blue-50 text-blue-600',
    subtitle: (o) => `${formatNum(o?.kpis?.newLeads)} new · ${formatNum(o?.kpis?.convertedLeads)} converted`,
  },
  {
    key: 'totalClients',
    label: 'Total Clients',
    href: '/client',
    icon: Users,
    tone: 'bg-indigo-50 text-indigo-600',
    subtitle: (o) => `${formatNum(o?.kpis?.activeClients)} active · ${formatNum(o?.kpis?.inactiveClients)} inactive`,
  },
  {
    key: 'teamMembers',
    label: 'Team Members',
    href: '/team',
    icon: UserRound,
    tone: 'bg-violet-50 text-violet-600',
    subtitle: () => 'Active CRM users',
  },
  {
    key: 'alerts',
    label: 'Alerts',
    href: '/dashboard',
    icon: AlertTriangle,
    tone: 'bg-rose-50 text-rose-600',
    subtitle: (o) => `${formatNum(o?.kpis?.overdueFollowups)} overdue follow-ups`,
  },
  {
    key: 'conversionRate',
    label: 'Conversion Rate',
    href: '/leads?status=Converted',
    icon: Percent,
    tone: 'bg-emerald-50 text-emerald-600',
    format: 'percent',
    subtitle: (o) => `${formatNum(o?.kpis?.convertedLeads)} of ${formatNum(o?.kpis?.totalLeads)} leads`,
  },
  {
    key: 'aiTokens',
    label: 'AI Tokens',
    href: '/dashboard#crm-brain',
    icon: Coins,
    tone: 'bg-amber-50 text-amber-600',
    format: 'tokens',
    subtitle: (o) =>
      `${formatNum(o?.aiTokens?.remaining ?? o?.kpis?.aiTokensRemaining)} remaining of ${formatNum(o?.aiTokens?.total ?? o?.kpis?.aiTokensTotal)}`,
  },
];

function fmt(value: number | null | undefined, format?: KpiDef['format'], overview?: CrmOverview | null) {
  if (value == null) return '—';
  if (format === 'percent') return `${value}%`;
  if (format === 'tokens') {
    const total = overview?.aiTokens?.total ?? overview?.kpis?.aiTokensTotal ?? 10000;
    return `${formatNum(value)} / ${formatNum(total as number)}`;
  }
  return formatNum(value);
}

type Props = { overview: CrmOverview | null; loading?: boolean };

export function CrmKpiGrid({ overview, loading }: Props) {
  const { openDrillDown } = useCrmDashboard();
  const k = overview?.kpis || {};
  const spark = overview?.leadSpark || [];

  if (loading && !overview) {
    return (
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-32 animate-pulse rounded-2xl bg-white" />
        ))}
      </div>
    );
  }

  return (
    <section className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      {KPI_DEFS.map((def, idx) => {
        const Icon = def.icon;
        const value = k[def.key];
        return (
          <motion.button
            key={def.key}
            type="button"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(idx * 0.03, 0.2) }}
            whileTap={{ scale: 0.98 }}
            onClick={() =>
              openDrillDown(buildKpiDrillDown(overview, def.key, def.label, def.href))
            }
            className={`${crmCard} group p-4 text-left transition hover:-translate-y-0.5 hover:shadow-md`}
          >
            <div className="flex items-start justify-between gap-2">
              <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${def.tone}`}>
                <Icon size={18} />
              </span>
              <div className="h-9 w-20 opacity-80">
                {spark.length ? (
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
            <p className="mt-3 text-[11px] font-medium text-slate-500">{def.label}</p>
            <p className="text-2xl font-bold tracking-tight text-slate-900">
              {fmt(value as number, def.format, overview)}
            </p>
            <p className="mt-1 truncate text-[10px] text-slate-400">
              {def.subtitle?.(overview) || 'Click for details'}
            </p>
          </motion.button>
        );
      })}
    </section>
  );
}
