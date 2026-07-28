'use client';

import React from 'react';
import type { DashboardOverview } from '@/lib/dashboard/api';
import { useEnterpriseDashboard } from './smartDashboardFilters';

type Props = {
  overview: DashboardOverview | null;
  loading?: boolean;
};

export function BusinessPerformancePanel({ overview, loading }: Props) {
  const { openDrillDown } = useEnterpriseDashboard();
  const k = overview?.kpis;
  if (loading && !k) {
    return <div className="h-40 animate-pulse rounded-2xl bg-slate-100" />;
  }

  const cards = [
    { label: 'Revenue', value: Number(k?.revenue || 0).toLocaleString(), hint: 'Recorded in range', href: '/billing' },
    {
      label: 'Pending / expected',
      value: Number(k?.pendingRevenue || k?.expectedRevenue || 0).toLocaleString(),
      hint: 'Outstanding signal',
      href: '/billing',
    },
    { label: 'Placements', value: Number(k?.placements || 0).toLocaleString(), hint: 'Closed hires', href: '/placement' },
    {
      label: 'Offers',
      value: Number(k?.offers || 0).toLocaleString(),
      hint: 'Offer pipeline',
      href: '/placement',
    },
    {
      label: 'Conversion',
      value: `${Number(k?.conversionRate || 0)}%`,
      hint: 'Pipeline conversion',
      href: '/placement',
    },
    { label: 'Calls', value: Number(k?.callsMade || 0).toLocaleString(), hint: 'Logged activity', href: '/inbox' },
    { label: 'Emails', value: Number(k?.emailsSent || 0).toLocaleString(), hint: 'Logged activity', href: '/inbox' },
    {
      label: 'Open jobs',
      value: Number(k?.activeJobs || 0).toLocaleString(),
      hint: 'Active requisitions',
      href: '/job',
    },
  ];

  const topClients = overview?.topClients || [];

  return (
    <section
      className="rounded-2xl border border-slate-200/80 bg-gradient-to-br from-slate-50 via-white to-amber-50/30 p-4 shadow-sm sm:p-5"
      aria-label="Revenue dashboard"
    >
      <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-slate-400">
        Revenue & performance
      </h2>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {cards.map((c) => (
          <button
            key={c.label}
            type="button"
            onClick={() => openDrillDown({ title: c.label, href: c.href, rows: [{ value: c.value }] })}
            className="rounded-xl border border-white/80 bg-white/90 px-3 py-3 text-left shadow-sm transition hover:border-amber-200 hover:shadow-md"
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{c.label}</p>
            <p className="mt-1 text-xl font-bold tabular-nums text-slate-900">{c.value}</p>
            <p className="mt-0.5 text-[11px] text-slate-500">{c.hint}</p>
          </button>
        ))}
      </div>
      {topClients.length > 0 ? (
        <div className="mt-4">
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">Top clients</p>
          <div className="flex flex-wrap gap-2">
            {topClients.slice(0, 6).map((c, i) => (
              <span
                key={i}
                className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700"
              >
                {String(c.name || c.client || c.companyName || `Client ${i + 1}`)}
                {c.revenue != null ? ` · ${Number(c.revenue).toLocaleString()}` : ''}
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
