'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import type { RecruitmentOverview } from '@/lib/dashboard/api';
import { HqInfoTip } from '@/components/hq/analytics/HqPhase2DashboardParts';
import { formatNum, recCard, relativeTime, useRecDashboard } from './recShared';

const COLORS = ['#D97706', '#059669', '#2563EB', '#7C3AED', '#E11D48', '#0891B2', '#4F46E5', '#64748B'];

function formatDateTime(iso?: string | null) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return '—';
  return d.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

type Props = { overview: RecruitmentOverview | null; loading?: boolean };

function PieHoverTip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number; payload?: { name?: string; value?: number } }>;
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0];
  const name = String(row.name ?? row.payload?.name ?? '—');
  const value = Number(row.value ?? row.payload?.value ?? 0);
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] shadow-lg shadow-slate-200/80">
      <span className="font-semibold capitalize text-slate-800">{name}</span>
      <span className="ml-2 tabular-nums font-medium text-slate-600">{formatNum(value)}</span>
    </div>
  );
}

function PieBlock({
  title,
  subtitle,
  info,
  data,
  center,
}: {
  title: string;
  subtitle?: string;
  info: string;
  data: Array<{ name: string; value: number }>;
  center?: string;
}) {
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  return (
    <div className={`${recCard} flex h-full flex-col overflow-visible p-5`}>
      <div className="mb-4 flex min-w-0 items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <h3 className="truncate text-[13px] font-semibold tracking-tight text-slate-900">
              {title}
            </h3>
            <HqInfoTip text={info} />
          </div>
          {subtitle ? <p className="mt-0.5 text-[11px] text-slate-400">{subtitle}</p> : null}
        </div>
      </div>

      <div className="flex flex-1 flex-col items-center gap-5 overflow-visible sm:flex-row sm:items-center">
        <div className="relative z-0 h-[148px] w-[148px] shrink-0 overflow-visible">
          {data.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
                <Pie
                  data={data}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={46}
                  outerRadius={68}
                  paddingAngle={3}
                  cornerRadius={4}
                  stroke="#fff"
                  strokeWidth={2}
                  onMouseEnter={(_, index) => setActiveIndex(index)}
                  onMouseLeave={() => setActiveIndex(null)}
                >
                  {data.map((_, i) => (
                    <Cell
                      key={i}
                      fill={COLORS[i % COLORS.length]}
                      opacity={activeIndex == null || activeIndex === i ? 1 : 0.45}
                      strokeWidth={activeIndex === i ? 3 : 2}
                    />
                  ))}
                </Pie>
                <Tooltip
                  content={<PieHoverTip />}
                  cursor={false}
                  allowEscapeViewBox={{ x: true, y: true }}
                  // Park tip beside the donut (legend side) so it never covers TOTAL
                  position={{ x: 152, y: 16 }}
                  wrapperStyle={{ zIndex: 40, outline: 'none', pointerEvents: 'none' }}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-slate-400">
              No data
            </div>
          )}
          {center ? (
            <div className="pointer-events-none absolute inset-0 z-0 flex flex-col items-center justify-center">
              <p className="text-[10px] uppercase tracking-wider text-slate-400">Total</p>
              <p className="text-lg font-bold tabular-nums text-slate-900">{center}</p>
            </div>
          ) : null}
        </div>

        <ul className="relative z-10 min-w-0 flex-1 space-y-1.5">
          {data.length ? (
            data.slice(0, 6).map((d, i) => (
              <li
                key={d.name}
                className={`flex items-center justify-between gap-2 rounded-md px-1 py-0.5 text-xs transition ${
                  activeIndex === i ? 'bg-slate-50' : ''
                }`}
                onMouseEnter={() => setActiveIndex(i)}
                onMouseLeave={() => setActiveIndex(null)}
              >
                <span className="flex min-w-0 items-center gap-2 truncate text-slate-600">
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ background: COLORS[i % COLORS.length] }}
                  />
                  <span className="truncate capitalize">{d.name}</span>
                </span>
                <span className="shrink-0 font-semibold tabular-nums text-slate-800">
                  {formatNum(d.value)}
                  <span className="ml-1 font-normal text-slate-400">
                    ({Math.round((d.value / total) * 100)}%)
                  </span>
                </span>
              </li>
            ))
          ) : (
            <li className="text-xs text-slate-400">Nothing to chart yet</li>
          )}
        </ul>
      </div>
    </div>
  );
}

export function RecChartsAndTables({ overview, loading }: Props) {
  const { openDrillDown, hiddenSections } = useRecDashboard();
  const [mode, setMode] = useState<'jobs' | 'candidates' | 'interviews' | 'placements'>('jobs');
  const [q, setQ] = useState('');

  const pipeline = overview?.pipeline || [];
  const showCharts = !hiddenSections.has('charts');
  const showTables = !hiddenSections.has('tables');

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (mode === 'jobs') {
      const source = overview?.jobsTable || [];
      if (!needle) return source;
      return source.filter((r) =>
        [r.title, r.status, r.client, r.department, r.assignee, r.location]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(needle)),
      );
    }
    if (mode === 'candidates') {
      const source = overview?.candidatesTable || [];
      if (!needle) return source;
      return source.filter((r) =>
        [r.name, r.status, r.source, r.email, r.assignee, r.title]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(needle)),
      );
    }
    if (mode === 'interviews') {
      const source = overview?.interviewsTable || [];
      if (!needle) return source;
      return source.filter((r) =>
        [r.candidate, r.job, r.status, r.round]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(needle)),
      );
    }
    const source = overview?.placementsTable || [];
    if (!needle) return source;
    return source.filter((r) =>
      [r.candidate, r.client, r.job, r.status]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(needle)),
    );
  }, [overview, mode, q]);

  if (loading && !overview) {
    return (
      <div className="space-y-4">
        <div className="h-28 animate-pulse rounded-2xl bg-white" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-64 animate-pulse rounded-2xl bg-white" />
          ))}
        </div>
      </div>
    );
  }

  const hrefMap = {
    jobs: '/job',
    candidates: '/candidate',
    interviews: '/interviews',
    placements: '/placement',
  } as const;

  return (
    <div className="space-y-4">
      {showCharts ? (
        <>
          <section className={`${recCard} space-y-4 p-5`}>
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-bold text-slate-900">Hiring Pipeline</h2>
              <p className="text-[11px] text-slate-400">Applied → Joined</p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {pipeline.map((stage, i) => (
                <button
                  key={stage.stage}
                  type="button"
                  onClick={() =>
                    openDrillDown({
                      title: `${stage.stage} stage`,
                      href: stage.href || '/candidate',
                      rows: [{ stage: stage.stage, count: stage.count }],
                    })
                  }
                  className="min-w-[72px] flex-1 rounded-xl px-2 py-2.5 text-center text-white transition hover:opacity-90"
                  style={{ background: COLORS[i % COLORS.length] }}
                >
                  <p className="text-[10px] font-semibold uppercase opacity-90">{stage.stage}</p>
                  <p className="text-sm font-bold">{formatNum(stage.count)}</p>
                </button>
              ))}
            </div>
          </section>

          <div className="grid items-stretch gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <PieBlock
              title="Jobs by Status"
              subtitle="Open roles & closures"
              info="Mix of job statuses in the selected date range and team filter — open vs closed / filled roles."
              data={overview?.jobStatusPie || []}
              center={formatNum(overview?.kpis?.totalJobs)}
            />
            <PieBlock
              title="Candidates by Status"
              subtitle="Talent pipeline mix"
              info="How candidates are distributed across pipeline statuses (new, active, hired, etc.) for the current filters."
              data={overview?.candidateStatusPie || []}
              center={formatNum(overview?.kpis?.totalCandidates)}
            />
            <PieBlock
              title="Candidate Sources"
              subtitle="Where talent comes from"
              info="Acquisition channels for candidates — portal, bulk CV, referrals, and other sources in this period."
              data={overview?.candidateSources || []}
              center={formatNum(
                (overview?.candidateSources || []).reduce((s, d) => s + (d.value || 0), 0),
              )}
            />
            <PieBlock
              title="Open Jobs by Dept"
              subtitle="Demand by department"
              info="Open requisitions grouped by department so you can see where hiring demand is concentrated."
              data={overview?.jobsByDepartment || []}
              center={formatNum(overview?.kpis?.openJobs)}
            />
          </div>
        </>
      ) : null}

      {showTables ? (
        <section className={`${recCard} overflow-hidden`}>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-3">
            <div className="flex flex-wrap items-center gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Recruitment Records</h3>
                <p className="text-[11px] text-slate-500">{rows.length} records shown</p>
              </div>
              <div
                className="inline-flex flex-wrap rounded-xl border border-slate-200 bg-slate-50 p-1"
                role="tablist"
              >
                {(
                  [
                    ['jobs', 'Jobs'],
                    ['candidates', 'Candidates'],
                    ['interviews', 'Interviews'],
                    ['placements', 'Placements'],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    role="tab"
                    aria-selected={mode === id}
                    onClick={() => {
                      setMode(id);
                      setQ('');
                    }}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                      mode === id
                        ? 'bg-amber-600 text-white shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={`Filter ${mode}…`}
                className="h-9 w-44 rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs outline-none focus:bg-white focus:ring-2 focus:ring-amber-500/20"
              />
              <Link
                href={hrefMap[mode]}
                className="text-xs font-semibold text-amber-700 hover:underline"
              >
                View all →
              </Link>
            </div>
          </div>

          <div className="max-h-[28rem] overflow-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="sticky top-0 bg-slate-50 text-[11px] uppercase tracking-wider text-slate-400">
                {mode === 'jobs' ? (
                  <tr>
                    <th className="px-4 py-2.5 font-semibold">Job</th>
                    <th className="px-3 py-2.5 font-semibold">Status</th>
                    <th className="px-3 py-2.5 font-semibold">Client</th>
                    <th className="px-3 py-2.5 font-semibold">Pipeline</th>
                    <th className="px-3 py-2.5 font-semibold">Assignee</th>
                    <th className="px-3 py-2.5 font-semibold">Updated</th>
                  </tr>
                ) : null}
                {mode === 'candidates' ? (
                  <tr>
                    <th className="px-4 py-2.5 font-semibold">Candidate</th>
                    <th className="px-3 py-2.5 font-semibold">Status</th>
                    <th className="px-3 py-2.5 font-semibold">Source</th>
                    <th className="px-3 py-2.5 font-semibold">Title</th>
                    <th className="px-3 py-2.5 font-semibold">Assignee</th>
                    <th className="px-3 py-2.5 font-semibold">Updated</th>
                  </tr>
                ) : null}
                {mode === 'interviews' ? (
                  <tr>
                    <th className="px-4 py-2.5 font-semibold">Candidate</th>
                    <th className="px-3 py-2.5 font-semibold">Job</th>
                    <th className="px-3 py-2.5 font-semibold">Status</th>
                    <th className="px-3 py-2.5 font-semibold">Round</th>
                    <th className="px-3 py-2.5 font-semibold">Scheduled</th>
                  </tr>
                ) : null}
                {mode === 'placements' ? (
                  <tr>
                    <th className="px-4 py-2.5 font-semibold">Candidate</th>
                    <th className="px-3 py-2.5 font-semibold">Client</th>
                    <th className="px-3 py-2.5 font-semibold">Status</th>
                    <th className="px-3 py-2.5 font-semibold">Job</th>
                    <th className="px-3 py-2.5 font-semibold">Updated</th>
                  </tr>
                ) : null}
              </thead>
              <tbody>
                {rows.length ? (
                  rows.map((row) => (
                    <tr
                      key={`${mode}-${String((row as { id: string }).id)}`}
                      className="cursor-pointer border-t border-slate-100 hover:bg-amber-50/40"
                      onClick={() =>
                        openDrillDown({
                          title:
                            mode === 'jobs'
                              ? String((row as { title?: string }).title || 'Job')
                              : mode === 'candidates'
                                ? String((row as { name?: string }).name || 'Candidate')
                                : String((row as { candidate?: string }).candidate || 'Record'),
                          href: String((row as { href?: string }).href || hrefMap[mode]),
                          rows: [row as Record<string, unknown>],
                        })
                      }
                    >
                      {mode === 'jobs' ? (
                        <>
                          <td className="px-4 py-2.5 font-semibold text-slate-800">
                            {(row as { title?: string }).title}
                            {(row as { hot?: boolean }).hot ? (
                              <span className="ml-1.5 rounded-full bg-rose-50 px-1.5 py-0.5 text-[10px] font-semibold text-rose-600">
                                HOT
                              </span>
                            ) : null}
                          </td>
                          <td className="px-3 py-2.5">
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700">
                              {(row as { status?: string }).status || '—'}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-slate-600">
                            {(row as { client?: string }).client || '—'}
                          </td>
                          <td className="px-3 py-2.5 text-xs text-slate-600">
                            {formatNum((row as { applicants?: number }).applicants)} apps ·{' '}
                            {formatNum((row as { interviews?: number }).interviews)} int ·{' '}
                            {formatNum((row as { placements?: number }).placements)} plc
                          </td>
                          <td className="px-3 py-2.5 text-slate-600">
                            {(row as { assignee?: string }).assignee || '—'}
                          </td>
                          <td className="px-3 py-2.5 text-slate-500">
                            {relativeTime((row as { updatedAt?: string }).updatedAt) ||
                              formatDateTime((row as { updatedAt?: string }).updatedAt)}
                          </td>
                        </>
                      ) : null}
                      {mode === 'candidates' ? (
                        <>
                          <td className="px-4 py-2.5 font-semibold text-slate-800">
                            {(row as { name?: string }).name}
                          </td>
                          <td className="px-3 py-2.5">
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700">
                              {(row as { status?: string }).status || '—'}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-slate-600">
                            {(row as { source?: string }).source || '—'}
                          </td>
                          <td className="px-3 py-2.5 text-slate-600">
                            {(row as { title?: string }).title || '—'}
                          </td>
                          <td className="px-3 py-2.5 text-slate-600">
                            {(row as { assignee?: string }).assignee || '—'}
                          </td>
                          <td className="px-3 py-2.5 text-slate-500">
                            {relativeTime((row as { updatedAt?: string }).updatedAt)}
                          </td>
                        </>
                      ) : null}
                      {mode === 'interviews' ? (
                        <>
                          <td className="px-4 py-2.5 font-semibold text-slate-800">
                            {(row as { candidate?: string }).candidate}
                          </td>
                          <td className="px-3 py-2.5 text-slate-600">
                            {(row as { job?: string }).job || '—'}
                          </td>
                          <td className="px-3 py-2.5">
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700">
                              {(row as { status?: string }).status || '—'}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-slate-600">
                            {(row as { round?: string }).round || '—'}
                          </td>
                          <td className="px-3 py-2.5 text-slate-500">
                            {formatDateTime((row as { scheduledAt?: string }).scheduledAt)}
                          </td>
                        </>
                      ) : null}
                      {mode === 'placements' ? (
                        <>
                          <td className="px-4 py-2.5 font-semibold text-slate-800">
                            {(row as { candidate?: string }).candidate}
                          </td>
                          <td className="px-3 py-2.5 text-slate-600">
                            {(row as { client?: string }).client || '—'}
                          </td>
                          <td className="px-3 py-2.5">
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700">
                              {(row as { status?: string }).status || '—'}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-slate-600">
                            {(row as { job?: string }).job || '—'}
                          </td>
                          <td className="px-3 py-2.5 text-slate-500">
                            {relativeTime((row as { updatedAt?: string }).updatedAt)}
                          </td>
                        </>
                      ) : null}
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-10 text-center text-sm text-slate-500"
                    >
                      No {mode} in the current filter.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </div>
  );
}
