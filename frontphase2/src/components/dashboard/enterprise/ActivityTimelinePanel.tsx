'use client';

import React from 'react';
import type { DashboardOverview } from '@/lib/dashboard/api';

type Props = {
  overview: DashboardOverview | null;
  loading?: boolean;
};

function formatWhen(iso?: string | null) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function ActivityTimelinePanel({ overview, loading }: Props) {
  const items = overview?.activityTimeline || [];

  return (
    <section
      className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm sm:p-5"
      aria-label="Activity timeline"
    >
      <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-slate-400">
        Activity timeline
      </h2>
      {loading && !items.length ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-12 animate-pulse rounded-xl bg-slate-100" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <p className="text-sm text-slate-400">No recent activity in scope.</p>
      ) : (
        <ol className="relative space-y-3 border-l border-slate-200 pl-4">
          {items.slice(0, 12).map((item) => (
            <li key={item.id} className="relative">
              <span className="absolute -left-[1.3rem] top-1.5 h-2.5 w-2.5 rounded-full bg-[#2098C8] ring-4 ring-white" />
              <div className="rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-800">{item.label}</p>
                  <time className="text-[11px] text-slate-400">{formatWhen(item.at)}</time>
                </div>
                {(item.detail || item.performer) && (
                  <p className="mt-0.5 text-xs text-slate-500">
                    {[item.performer, item.detail, item.entityType].filter(Boolean).join(' · ')}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
