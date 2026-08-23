'use client';

import React, { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  Briefcase,
  Building2,
  CircleDollarSign,
  ClipboardList,
  Flame,
  Mail,
  MessageCircle,
  Percent,
  Phone,
  TrendingDown,
  TrendingUp,
  UserCheck,
  Users,
  UserSearch,
  Wallet,
  ChevronDown,
} from 'lucide-react';
import type { DashboardOverview } from '@/lib/dashboard/api';
import { useEnterpriseDashboard } from './smartDashboardFilters';
import { cardClass, cardHover, formatCount, formatMoney } from './dashboardUi';

type KpiDef = {
  key: string;
  label: string;
  href: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  iconBg: string;
  iconColor: string;
  format?: 'number' | 'money' | 'percent';
  hero?: boolean;
};

const HERO_KPIS: KpiDef[] = [
  {
    key: 'leads',
    label: 'Total Leads',
    href: '/leads',
    icon: Building2,
    iconBg: 'bg-violet-50',
    iconColor: 'text-violet-600',
    hero: true,
  },
  {
    key: 'qualifiedLeads',
    label: 'Qualified Leads',
    href: '/leads',
    icon: UserCheck,
    iconBg: 'bg-orange-50',
    iconColor: 'text-orange-500',
    hero: true,
  },
  {
    key: 'clients',
    label: 'Clients',
    href: '/client',
    icon: Briefcase,
    iconBg: 'bg-blue-50',
    iconColor: 'text-blue-600',
    hero: true,
  },
  {
    key: 'activeJobs',
    label: 'Open Jobs',
    href: '/job',
    icon: ClipboardList,
    iconBg: 'bg-fuchsia-50',
    iconColor: 'text-fuchsia-600',
    hero: true,
  },
  {
    key: 'candidates',
    label: 'Candidates',
    href: '/candidate',
    icon: UserSearch,
    iconBg: 'bg-sky-50',
    iconColor: 'text-sky-600',
    hero: true,
  },
  {
    key: 'placements',
    label: 'Placements',
    href: '/placement',
    icon: UserCheck,
    iconBg: 'bg-amber-50',
    iconColor: 'text-amber-600',
    hero: true,
  },
  {
    key: 'revenue',
    label: 'Revenue',
    href: '/billing',
    icon: CircleDollarSign,
    iconBg: 'bg-emerald-50',
    iconColor: 'text-emerald-600',
    format: 'money',
    hero: true,
  },
  {
    key: 'pipelineValue',
    label: 'Pipeline Value',
    href: '/leads',
    icon: Wallet,
    iconBg: 'bg-indigo-50',
    iconColor: 'text-indigo-600',
    format: 'money',
    hero: true,
  },
];

const EXTRA_KPIS: KpiDef[] = [
  { key: 'interviewsToday', label: 'Interview Today', href: '/interviews', icon: Users, iconBg: 'bg-lime-50', iconColor: 'text-lime-700' },
  { key: 'meetingsScheduled', label: 'Meetings Today', href: '/interviews', icon: Users, iconBg: 'bg-violet-50', iconColor: 'text-violet-600' },
  { key: 'callsMade', label: 'Calls Today', href: '/inbox', icon: Phone, iconBg: 'bg-indigo-50', iconColor: 'text-indigo-600' },
  { key: 'emailsSent', label: 'Emails Today', href: '/inbox', icon: Mail, iconBg: 'bg-blue-50', iconColor: 'text-blue-600' },
  { key: 'whatsappSent', label: 'WhatsApp Sent', href: '/inbox', icon: MessageCircle, iconBg: 'bg-emerald-50', iconColor: 'text-emerald-600' },
  { key: 'pendingRevenue', label: 'Pending Revenue', href: '/billing', icon: CircleDollarSign, iconBg: 'bg-orange-50', iconColor: 'text-orange-600', format: 'money' },
  { key: 'overdueFollowups', label: 'Overdue Follow-ups', href: '/leads', icon: Flame, iconBg: 'bg-rose-50', iconColor: 'text-rose-600' },
  { key: 'conversionRate', label: 'Conversion %', href: '/placement', icon: Percent, iconBg: 'bg-sky-50', iconColor: 'text-sky-600', format: 'percent' },
  { key: 'lostLeads', label: 'Lost Leads', href: '/leads', icon: Flame, iconBg: 'bg-rose-50', iconColor: 'text-rose-500' },
  { key: 'hotLeads', label: 'Hot Leads', href: '/leads', icon: Flame, iconBg: 'bg-orange-50', iconColor: 'text-orange-500' },
  { key: 'activeUsers', label: 'Active Recruiters', href: '/team', icon: Users, iconBg: 'bg-slate-50', iconColor: 'text-slate-600' },
];

function formatValue(value: number | null | undefined, format?: KpiDef['format']) {
  if (value == null) return '—';
  if (format === 'money') return formatMoney(value);
  if (format === 'percent') return `${Number(value)}%`;
  return formatCount(value);
}

/** Derive a soft trend from revenue series when available; otherwise neutral live marker. */
function softTrend(key: string, overview: DashboardOverview | null): { pct: number | null; up: boolean } {
  const trend = overview?.revenueTrend || [];
  if ((key === 'revenue' || key === 'pipelineValue') && trend.length >= 4) {
    const vals = trend.map((r) => Number(r.value ?? r.revenue ?? r.amount ?? 0));
    const mid = Math.floor(vals.length / 2);
    const a = vals.slice(0, mid).reduce((s, n) => s + n, 0) / Math.max(1, mid);
    const b = vals.slice(mid).reduce((s, n) => s + n, 0) / Math.max(1, vals.length - mid);
    if (a > 0) {
      const pct = Number((((b - a) / a) * 100).toFixed(1));
      return { pct, up: pct >= 0 };
    }
  }
  return { pct: null, up: true };
}

type Props = {
  overview: DashboardOverview | null;
  loading?: boolean;
};

export function SmartKpiGrid({ overview, loading }: Props) {
  const { openDrillDown } = useEnterpriseDashboard();
  const [showExtra, setShowExtra] = useState(false);
  const k = overview?.kpis || {};

  const cards = useMemo(
    () => (showExtra ? [...HERO_KPIS, ...EXTRA_KPIS] : HERO_KPIS),
    [showExtra],
  );

  if (loading && !overview) {
    return (
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-[118px] animate-pulse rounded-[20px] bg-white/80" />
        ))}
      </div>
    );
  }

  return (
    <section aria-label="Executive KPI cards">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
        {cards.map((def, idx) => {
          const Icon = def.icon;
          const raw = k[def.key];
          const trend = softTrend(def.key, overview);
          const display = formatValue(raw as number, def.format);
          return (
            <motion.button
              key={def.key}
              type="button"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(idx * 0.03, 0.24) }}
              whileTap={{ scale: 0.98 }}
              onClick={() =>
                openDrillDown({
                  title: def.label,
                  href: def.href,
                  metricKey: def.key,
                  rows: [{ metric: def.label, value: display }],
                })
              }
              className={`${cardClass} ${cardHover} group p-3.5 text-left`}
            >
              <div className={`mb-2.5 flex h-9 w-9 items-center justify-center rounded-xl ${def.iconBg}`}>
                <Icon size={18} className={def.iconColor} />
              </div>
              <p className="text-[11px] font-medium text-slate-500">{def.label}</p>
              <p className="mt-0.5 text-[22px] font-bold leading-tight tracking-tight text-slate-900">
                {display}
              </p>
              <div className="mt-1.5 flex items-center gap-1 text-[11px]">
                {trend.pct != null ? (
                  <>
                    {trend.up ? (
                      <TrendingUp size={12} className="text-emerald-500" />
                    ) : (
                      <TrendingDown size={12} className="text-rose-500" />
                    )}
                    <span className={trend.up ? 'font-semibold text-emerald-600' : 'font-semibold text-rose-600'}>
                      {trend.up ? '↑' : '↓'} {Math.abs(trend.pct)}%
                    </span>
                    <span className="text-slate-400">vs last period</span>
                  </>
                ) : (
                  <span className="text-slate-400">Live · vs last 30 days</span>
                )}
              </div>
            </motion.button>
          );
        })}
      </div>
      <div className="mt-2 flex justify-center">
        <button
          type="button"
          onClick={() => setShowExtra((v) => !v)}
          className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold text-[#3B82F6] hover:bg-blue-50"
        >
          {showExtra ? 'Show fewer KPIs' : 'Show more KPIs'}
          <ChevronDown size={14} className={showExtra ? 'rotate-180 transition' : 'transition'} />
        </button>
      </div>
    </section>
  );
}
