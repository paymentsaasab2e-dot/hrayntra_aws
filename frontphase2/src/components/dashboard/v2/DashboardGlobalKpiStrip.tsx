'use client';

import React from 'react';
import type { DashboardOverview } from '@/lib/dashboard/api';

type Props = {
  overview: DashboardOverview | null;
  loading?: boolean;
};

function KpiTile({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex min-w-[7rem] flex-1 flex-col items-center justify-center rounded-xl border border-indigo-100/80 bg-white px-4 py-3 shadow-sm">
      <p className="text-2xl font-bold tabular-nums text-slate-900">{typeof value === 'number' ? value.toLocaleString() : value}</p>
      <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
    </div>
  );
}

export function DashboardGlobalKpiStrip({ overview, loading }: Props) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-20 animate-pulse rounded-xl bg-slate-100" />
        ))}
      </div>
    );
  }

  const k = overview?.kpis;
  const revenue =
    typeof k?.revenue === 'number'
      ? k.revenue >= 1000
        ? `${(k.revenue / 1000).toFixed(1)}k`
        : k.revenue
      : '0';

  return (
    <section
      className="rounded-2xl border border-indigo-100/60 bg-gradient-to-r from-slate-50/90 via-white to-indigo-50/40 p-4 shadow-sm"
      aria-label="Global KPIs"
    >
      <p className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-400">Executive overview</p>
      <div className="flex flex-wrap gap-2">
        <KpiTile label="Leads" value={k?.leads ?? 0} />
        <KpiTile label="Clients" value={k?.clients ?? 0} />
        <KpiTile label="Active jobs" value={k?.activeJobs ?? 0} />
        <KpiTile label="Candidates" value={k?.candidates ?? 0} />
        <KpiTile label="Interviews" value={k?.interviews ?? 0} />
        <KpiTile label="Placements" value={k?.placements ?? 0} />
        <KpiTile label="Revenue" value={revenue} />
        <KpiTile label="Tasks overdue" value={k?.tasksDueToday ?? 0} />
      </div>
    </section>
  );
}
