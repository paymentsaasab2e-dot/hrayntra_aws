'use client';

import React from 'react';
import Link from 'next/link';
import { Sparkles } from 'lucide-react';
import type { DashboardOverview } from '@/lib/dashboard/api';
import { useEnterpriseDashboard } from './smartDashboardFilters';

type Props = {
  overview: DashboardOverview | null;
  loading?: boolean;
};

export function AiInsightsPanel({ overview, loading }: Props) {
  const { openDrillDown } = useEnterpriseDashboard();
  const summary = overview?.executiveSummary;
  const scores = overview?.healthScores;

  if (loading && !summary) {
    return <div className="h-56 animate-pulse rounded-2xl bg-slate-100" />;
  }

  return (
    <section
      className="rounded-2xl border border-slate-200/80 bg-gradient-to-br from-[#E8F6FC] via-white to-slate-50 p-5 shadow-sm"
      aria-label="Enterprise AI Summary"
    >
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#2098C8] text-white shadow-md">
            <Sparkles size={18} />
          </span>
          <div>
            <h2 className="text-base font-bold text-slate-900">Enterprise AI Summary</h2>
            <p className="text-xs text-slate-500">Generated from live tenant data · no hallucinations</p>
          </div>
        </div>
        <div className="rounded-2xl border border-white bg-white/90 px-4 py-2 text-center shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Business health</p>
          <p className="text-lg font-bold text-[#2098C8]">{summary?.healthLabel || '—'}</p>
        </div>
      </div>

      {scores ? (
        <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {(
            [
              ['Overall', scores.overall],
              ['Business', scores.business],
              ['Hiring', scores.hiring],
              ['Revenue', scores.revenue],
              ['Productivity', scores.productivity],
              ['Risk', scores.risk],
            ] as const
          ).map(([label, value]) => (
            <div key={label} className="rounded-xl border border-white/80 bg-white/90 px-3 py-2 shadow-sm">
              <p className="text-[10px] font-semibold uppercase text-slate-400">{label}</p>
              <p className="text-xl font-bold tabular-nums text-slate-900">{value}</p>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
                <div
                  className={`h-full rounded-full ${label === 'Risk' ? 'bg-rose-400' : 'bg-[#2098C8]'}`}
                  style={{ width: `${Math.min(100, value)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      ) : null}

      <ul className="mb-4 grid gap-2 md:grid-cols-2">
        {(summary?.bullets || []).map((b, i) => (
          <li key={i} className="rounded-xl border border-slate-100 bg-white/80 px-3 py-2 text-sm text-slate-700">
            • {b}
          </li>
        ))}
      </ul>

      <div>
        <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">AI recommendations</p>
        <div className="flex flex-wrap gap-2">
          {(summary?.recommendations || []).map((r, i) => (
            <button
              key={i}
              type="button"
              onClick={() =>
                openDrillDown({
                  title: r.text,
                  href: r.href,
                })
              }
              className="rounded-full border border-sky-200 bg-white px-3 py-1.5 text-xs font-semibold text-sky-800 hover:bg-sky-50"
            >
              {r.text}
            </button>
          ))}
          {!summary?.recommendations?.length ? (
            <Link href="/dashboard" className="text-xs font-semibold text-[#2098C8]">
              Ask Brain for next actions
            </Link>
          ) : null}
        </div>
      </div>
    </section>
  );
}
