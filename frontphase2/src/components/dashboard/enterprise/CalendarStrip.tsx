'use client';

import React from 'react';
import Link from 'next/link';
import { CalendarDays } from 'lucide-react';
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
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function CalendarStrip({ overview, loading }: Props) {
  const items = overview?.calendarItems || [];

  return (
    <section
      className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm sm:p-5"
      aria-label="Calendar"
    >
      <div className="mb-3 flex items-center gap-2">
        <CalendarDays size={16} className="text-[#2098C8]" />
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400">
          Upcoming · 7 days
        </h2>
      </div>
      {loading && !items.length ? (
        <div className="flex gap-2 overflow-hidden">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 w-48 shrink-0 animate-pulse rounded-xl bg-slate-100" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <p className="text-sm text-slate-400">No interviews or follow-ups scheduled this week.</p>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-1 [scrollbar-width:thin]">
          {items.map((item) => (
            <Link
              key={item.id}
              href={item.href || '/dashboard'}
              className="min-w-[11.5rem] shrink-0 rounded-xl border border-slate-200 bg-gradient-to-br from-white to-sky-50/50 p-3 shadow-sm transition hover:border-sky-300"
            >
              <p className="text-[10px] font-bold uppercase tracking-wider text-sky-700">
                {item.type}
              </p>
              <p className="mt-1 line-clamp-2 text-sm font-semibold text-slate-800">{item.title}</p>
              <p className="mt-2 text-[11px] text-slate-500">{formatWhen(item.at)}</p>
              {item.status ? (
                <p className="mt-1 text-[10px] font-medium text-slate-400">{item.status}</p>
              ) : null}
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
