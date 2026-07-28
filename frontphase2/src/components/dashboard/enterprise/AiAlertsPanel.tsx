'use client';

import React from 'react';
import { AlertTriangle, BellRing, Info } from 'lucide-react';
import type { DashboardOverview } from '@/lib/dashboard/api';
import { useEnterpriseDashboard } from './smartDashboardFilters';

type Props = {
  overview: DashboardOverview | null;
  loading?: boolean;
};

function tone(severity: string) {
  if (severity === 'high') return 'border-rose-200 bg-gradient-to-br from-rose-50 to-white text-rose-900';
  if (severity === 'medium') return 'border-amber-200 bg-gradient-to-br from-amber-50 to-white text-amber-900';
  return 'border-sky-200 bg-gradient-to-br from-sky-50 to-white text-slate-800';
}

export function AiAlertsPanel({ overview, loading }: Props) {
  const { openDrillDown } = useEnterpriseDashboard();
  const alerts = overview?.alerts || overview?.insights || [];

  if (loading && !alerts.length) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-2xl bg-slate-100" />
        ))}
      </div>
    );
  }

  return (
    <section aria-label="AI Alerts">
      <div className="mb-3 flex items-center gap-2">
        <BellRing size={16} className="text-rose-500" />
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400">AI Alerts</h2>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {alerts.map((alert) => {
          const Icon = alert.severity === 'high' ? AlertTriangle : Info;
          return (
            <button
              key={alert.id}
              type="button"
              onClick={() =>
                openDrillDown({
                  title: alert.text,
                  href: alert.href,
                })
              }
              className={`rounded-2xl border p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${tone(alert.severity)}`}
            >
              <div className="mb-2 flex items-center gap-2">
                <Icon size={16} />
                <span className="text-[10px] font-bold uppercase tracking-wider opacity-70">
                  {alert.category || alert.severity}
                </span>
              </div>
              <p className="text-sm font-semibold leading-snug">{alert.text}</p>
              {alert.action ? (
                <p className="mt-2 text-xs font-bold underline-offset-2 opacity-80">{alert.action} →</p>
              ) : null}
            </button>
          );
        })}
      </div>
    </section>
  );
}
