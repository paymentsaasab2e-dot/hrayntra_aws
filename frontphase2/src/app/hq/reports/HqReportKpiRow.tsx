'use client';

import React from 'react';
import { motion } from 'motion/react';
import {
  BarChart3,
  BookOpen,
  Briefcase,
  Building2,
  Calendar,
  Coins,
  GraduationCap,
  ShieldCheck,
  Target,
  Ticket,
  UserCog,
  Users,
} from 'lucide-react';
import { CrmFigureText } from '@/components/dashboard/crm/crmStatNumber';
import { HQ_REPORTS_CARD, HQ_REPORTS_CHART_COLORS } from './hqReportsChrome';
import type { HqReportKpi } from './hqReportsViews';

function kpiIcon(label: string) {
  const text = label.toLowerCase();
  if (text.includes('candidate') || text.includes('buyer') || text.includes('user')) return Users;
  if (text.includes('kyc') || text.includes('verif')) return ShieldCheck;
  if (text.includes('course') || text.includes('lesson') || text.includes('enroll')) return BookOpen;
  if (text.includes('job') || text.includes('opening')) return Briefcase;
  if (text.includes('event') || text.includes('demo')) return Calendar;
  if (text.includes('ticket')) return Ticket;
  if (text.includes('token') || text.includes('purchase') || text.includes('grant') || text.includes('spend') || text.includes('billing')) return Coins;
  if (text.includes('tenant') || text.includes('compan') || text.includes('client') || text.includes('org')) return Building2;
  if (text.includes('lead') || text.includes('pipeline') || text.includes('convert')) return Target;
  if (text.includes('team') || text.includes('role')) return UserCog;
  if (text.includes('plan') || text.includes('cycle')) return GraduationCap;
  return BarChart3;
}

export function HqReportKpiRow({ kpis, loading }: { kpis: HqReportKpi[]; loading?: boolean }) {
  const grid =
    !kpis.length || kpis.length <= 4
      ? 'grid-cols-2 sm:grid-cols-4'
      : kpis.length <= 6
        ? 'grid-cols-2 sm:grid-cols-3 xl:grid-cols-6'
        : 'grid-cols-2 sm:grid-cols-4 xl:grid-cols-5';

  if (loading) {
    return (
      <div className={`grid gap-3 ${grid}`}>
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className={`${HQ_REPORTS_CARD} h-[132px] animate-pulse bg-white/50`} />
        ))}
      </div>
    );
  }
  if (kpis.length === 0) return null;

  return (
    <section className={`grid gap-3 ${grid}`}>
      {kpis.map((kpi, index) => {
        const Icon = kpiIcon(kpi.label);
        const color = HQ_REPORTS_CHART_COLORS[index % HQ_REPORTS_CHART_COLORS.length];
        return (
          <motion.div
            key={kpi.label}
            whileHover={{ y: -3 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className={`${HQ_REPORTS_CARD} group`}
          >
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-indigo-300/70 to-transparent"
            />
            <div className="p-3.5 sm:p-4">
              <div className="mb-3 flex items-start justify-between gap-2">
                <div
                  className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-slate-50 to-indigo-50/80 ring-1 ring-indigo-100/70"
                  style={{ color }}
                >
                  <Icon className="h-5 w-5" />
                </div>
                {kpi.active ? (
                  <span className="rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700">
                    Focus
                  </span>
                ) : null}
              </div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.04em] text-slate-400">{kpi.label}</p>
              <p className="mt-1.5 text-[1.35rem] font-bold leading-none tracking-tight text-slate-900 sm:text-[1.45rem]">
                <CrmFigureText
                  value={typeof kpi.value === 'number' ? kpi.value.toLocaleString() : String(kpi.value)}
                />
              </p>
              <p className="mt-1.5 text-[10px] font-medium text-slate-400">This range</p>
            </div>
          </motion.div>
        );
      })}
    </section>
  );
}

export function HqReportInsightRow({ items }: { items: Array<{ label: string; value: string }> }) {
  if (items.length === 0) return null;
  return (
    <section className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => (
        <div
          key={item.label}
          className="rounded-2xl border border-white/70 bg-white/75 px-3.5 py-3 text-xs leading-relaxed text-slate-600 shadow-[0_10px_28px_-18px_rgba(15,23,42,0.2)] backdrop-blur-sm"
        >
          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{item.label}</p>
          <p className="mt-1 truncate text-sm font-semibold text-slate-900">{item.value}</p>
        </div>
      ))}
    </section>
  );
}
