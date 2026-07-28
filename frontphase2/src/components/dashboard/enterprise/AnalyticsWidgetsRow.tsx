'use client';

import React, { useMemo } from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import type { DashboardOverview } from '@/lib/dashboard/api';
import { useEnterpriseDashboard } from './smartDashboardFilters';
import {
  CHART_COLORS,
  cardClass,
  formatCount,
  formatMoney,
  initials,
} from './dashboardUi';

type Props = {
  overview: DashboardOverview | null;
  loading?: boolean;
};

function DonutCard({
  title,
  data,
  centerLabel,
  centerValue,
}: {
  title: string;
  data: Array<{ name: string; value: number }>;
  centerLabel?: string;
  centerValue?: string;
}) {
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  return (
    <section className={`${cardClass} flex flex-col p-5`}>
      <h2 className="mb-3 text-sm font-bold text-slate-900">{title}</h2>
      <div className="relative mx-auto h-44 w-44">
        {data.length ? (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="name"
                innerRadius={52}
                outerRadius={72}
                paddingAngle={2}
                strokeWidth={0}
              >
                {data.map((_, i) => (
                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                formatter={(v: number, name: string) => [
                  `${v} (${((v / total) * 100).toFixed(1)}%)`,
                  name,
                ]}
              />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-slate-400">No data</div>
        )}
        {centerValue ? (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <p className="text-lg font-bold text-slate-900">{centerValue}</p>
            {centerLabel ? <p className="text-[10px] text-slate-500">{centerLabel}</p> : null}
          </div>
        ) : null}
      </div>
      <ul className="mt-2 max-h-28 space-y-1 overflow-y-auto text-[11px]">
        {data.slice(0, 6).map((d, i) => (
          <li key={d.name} className="flex items-center justify-between gap-2 text-slate-600">
            <span className="flex items-center gap-1.5 truncate">
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ background: CHART_COLORS[i % CHART_COLORS.length] }}
              />
              {d.name}
            </span>
            <span className="font-semibold text-slate-800">
              {((d.value / total) * 100).toFixed(0)}%
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function AnalyticsWidgetsRow({ overview, loading }: Props) {
  const { openDrillDown } = useEnterpriseDashboard();

  const leadSources = useMemo(() => {
    const raw = overview?.leadSources || [];
    return raw
      .map((r) => ({ name: r.name || 'Other', value: Number(r.value || 0) }))
      .filter((r) => r.value > 0);
  }, [overview?.leadSources]);

  const jobsDept = useMemo(() => {
    const raw = overview?.jobsByDepartment || [];
    return raw
      .map((r) => ({ name: r.name || 'Other', value: Number(r.value || 0) }))
      .filter((r) => r.value > 0);
  }, [overview?.jobsByDepartment]);

  const jobsTotal = jobsDept.reduce((s, d) => s + d.value, 0);

  const leaders = useMemo(() => {
    const raw = overview?.teamLeaderboard || [];
    return raw.slice(0, 5).map((row, i) => {
      const name = String(
        row.name || row.userName || row.recruiter || `Recruiter ${i + 1}`,
      );
      const placements = Number(row.placements || row.placementCount || row.count || 0);
      return { name, placements, revenue: Number(row.revenue || 0) };
    });
  }, [overview?.teamLeaderboard]);

  const maxPlacements = Math.max(1, ...leaders.map((l) => l.placements));
  const credits = overview?.aiCredits || { total: 10000, used: 0, remaining: 10000, usagePct: 0 };
  const gaugePct = Math.min(100, Math.max(0, credits.usagePct));

  if (loading && !overview) {
    return (
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-80 animate-pulse rounded-[20px] bg-white" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <DonutCard title="Lead Sources" data={leadSources} />
      <DonutCard
        title="Jobs by Department"
        data={jobsDept}
        centerValue={formatCount(jobsTotal || overview?.kpis?.activeJobs)}
        centerLabel="Total"
      />

      <section className={`${cardClass} p-5`}>
        <h2 className="mb-4 text-sm font-bold text-slate-900">Top Recruiters</h2>
        <ul className="space-y-3.5">
          {leaders.length ? (
            leaders.map((leader, i) => (
              <li key={`${leader.name}-${i}`}>
                <button
                  type="button"
                  onClick={() =>
                    openDrillDown({
                      title: leader.name,
                      href: '/team',
                      rows: [
                        {
                          name: leader.name,
                          placements: leader.placements,
                          revenue: formatMoney(leader.revenue),
                        },
                      ],
                    })
                  }
                  className="w-full text-left"
                >
                  <div className="mb-1.5 flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 text-[10px] font-bold text-white">
                        {initials(leader.name)}
                      </span>
                      <span className="truncate text-sm font-semibold text-slate-800">
                        {leader.name}
                      </span>
                    </div>
                    <span className="shrink-0 text-xs font-medium text-slate-500">
                      {leader.placements} Placements
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-[#3B82F6]"
                      style={{ width: `${(leader.placements / maxPlacements) * 100}%` }}
                    />
                  </div>
                </button>
              </li>
            ))
          ) : (
            <p className="text-sm text-slate-400">No recruiter rankings yet</p>
          )}
        </ul>
      </section>

      <section className={`${cardClass} p-5`}>
        <h2 className="mb-3 text-sm font-bold text-slate-900">AI Credits Usage</h2>
        <div className="flex items-center gap-4">
          <div className="relative h-32 w-32 shrink-0">
            <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
              <circle cx="60" cy="60" r="48" fill="none" stroke="#E2E8F0" strokeWidth="12" />
              <circle
                cx="60"
                cy="60"
                r="48"
                fill="none"
                stroke="#3B82F6"
                strokeWidth="12"
                strokeLinecap="round"
                strokeDasharray={`${(gaugePct / 100) * 2 * Math.PI * 48} ${2 * Math.PI * 48}`}
              />
            </svg>
            <div className="absolute inset-0 flex rotate-0 flex-col items-center justify-center text-center">
              <p className="text-lg font-bold text-slate-900">{formatCount(credits.used)}</p>
              <p className="text-[10px] text-slate-500">of {formatCount(credits.total)}</p>
            </div>
          </div>
          <dl className="min-w-0 flex-1 space-y-2 text-xs">
            <div className="flex justify-between gap-2">
              <dt className="text-slate-500">Total Credits</dt>
              <dd className="font-semibold text-slate-800">{formatCount(credits.total)}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-slate-500">Used Credits</dt>
              <dd className="font-semibold text-slate-800">{formatCount(credits.used)}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-slate-500">Remaining</dt>
              <dd className="font-semibold text-emerald-600">{formatCount(credits.remaining)}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-slate-500">Usage %</dt>
              <dd className="font-semibold text-[#3B82F6]">{credits.usagePct}%</dd>
            </div>
          </dl>
        </div>
      </section>
    </div>
  );
}
