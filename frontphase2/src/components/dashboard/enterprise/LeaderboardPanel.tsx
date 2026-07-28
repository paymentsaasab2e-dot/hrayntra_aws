'use client';

import React from 'react';
import { Trophy } from 'lucide-react';
import type { DashboardOverview } from '@/lib/dashboard/api';

type Props = {
  overview: DashboardOverview | null;
  loading?: boolean;
};

export function LeaderboardPanel({ overview, loading }: Props) {
  const rows = overview?.teamLeaderboard || [];

  return (
    <section
      className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm sm:p-5"
      aria-label="Leaderboards"
    >
      <div className="mb-3 flex items-center gap-2">
        <Trophy size={16} className="text-amber-500" />
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400">
          Team leaderboard
        </h2>
      </div>
      {loading && !rows.length ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-10 animate-pulse rounded-lg bg-slate-100" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <p className="text-sm text-slate-400">No leaderboard data for this period.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[28rem] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-[11px] uppercase tracking-wider text-slate-400">
                <th className="pb-2 pr-2 font-semibold">#</th>
                <th className="pb-2 pr-2 font-semibold">Person</th>
                <th className="pb-2 pr-2 font-semibold">Score</th>
                <th className="pb-2 pr-2 font-semibold">Placements</th>
                <th className="pb-2 font-semibold">Revenue</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 10).map((row, i) => {
                const name = String(
                  row.name || row.recruiter || row.userName || row.email || `Member ${i + 1}`,
                );
                const score = row.score ?? row.performanceScore ?? row.points ?? '—';
                const placements = row.placements ?? row.placementCount ?? '—';
                const revenue = row.revenue ?? row.totalRevenue ?? '—';
                return (
                  <tr key={String(row.id || name)} className="border-b border-slate-50">
                    <td className="py-2.5 pr-2 tabular-nums text-slate-400">{i + 1}</td>
                    <td className="py-2.5 pr-2 font-medium text-slate-800">{name}</td>
                    <td className="py-2.5 pr-2 tabular-nums text-slate-700">{String(score)}</td>
                    <td className="py-2.5 pr-2 tabular-nums text-slate-700">{String(placements)}</td>
                    <td className="py-2.5 tabular-nums text-slate-700">
                      {typeof revenue === 'number' ? revenue.toLocaleString() : String(revenue)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
