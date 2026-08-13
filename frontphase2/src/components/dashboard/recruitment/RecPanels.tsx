'use client';

import React from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  Award,
  Bell,
  Briefcase,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Info,
  UserRound,
} from 'lucide-react';
import type { RecruitmentOverview } from '@/lib/dashboard/api';
import { formatInr, formatNum, recCard, relativeTime } from './recShared';

type Props = { overview: RecruitmentOverview | null; loading?: boolean };

function formatWhen(iso?: string | null) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return '—';
  return d.toLocaleString([], {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const MODULES = [
  {
    href: '/job',
    label: 'Jobs',
    icon: Briefcase,
    accent: 'text-amber-700 hover:bg-amber-50',
  },
  {
    href: '/candidate',
    label: 'Candidates',
    icon: UserRound,
    accent: 'text-violet-700 hover:bg-violet-50',
  },
  {
    href: '/interviews',
    label: 'Interviews',
    icon: Calendar,
    accent: 'text-sky-700 hover:bg-sky-50',
  },
  {
    href: '/placement',
    label: 'Placements',
    icon: Award,
    accent: 'text-emerald-700 hover:bg-emerald-50',
  },
] as const;

export function RecModuleShortcuts() {
  return (
    <nav
      aria-label="Recruitment modules"
      className={`${recCard} flex flex-wrap items-center gap-1 px-2 py-1.5`}
    >
      <span className="hidden px-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400 sm:inline">
        Go to
      </span>
      {MODULES.map(({ href, label, icon: Icon, accent }) => (
        <Link
          key={href}
          href={href}
          className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-[13px] font-semibold text-slate-700 transition ${accent}`}
        >
          <Icon size={15} className="opacity-80" />
          {label}
          <ChevronRight size={12} className="text-slate-300" />
        </Link>
      ))}
    </nav>
  );
}

export function RecSchedulePanel({ overview, loading }: Props) {
  const items = overview?.schedule || [];
  const timeline = overview?.activityTimeline || [];

  if (loading && !overview) {
    return (
      <>
        <div className="h-[320px] animate-pulse rounded-2xl bg-white" />
        <div className="h-[320px] animate-pulse rounded-2xl bg-white" />
      </>
    );
  }

  return (
    <>
      <section className={`${recCard} flex h-[320px] flex-col p-4`}>
        <div className="mb-3 flex shrink-0 items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-900">Upcoming Interviews</h2>
          <Link
            href="/interviews"
            className="text-[11px] font-semibold text-amber-700 hover:underline"
          >
            Calendar →
          </Link>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {items.length ? (
            <ul className="space-y-2">
              {items.map((item) => (
                <li
                  key={item.id}
                  className="flex items-start justify-between gap-2 rounded-xl border border-slate-100 bg-slate-50/70 px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-semibold text-slate-800">{item.title}</p>
                    <p className="mt-0.5 truncate text-[11px] text-slate-500">
                      {formatWhen(item.at)}
                      {item.round ? ` · ${item.round}` : ''}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-md bg-white px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 ring-1 ring-slate-200">
                    {item.status || 'SCHEDULED'}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="flex h-full flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 px-4 text-center">
              <Calendar className="mb-2 text-slate-300" size={22} />
              <p className="text-[13px] text-slate-500">No interviews in the next 7 days</p>
            </div>
          )}
        </div>
      </section>

      <section className={`${recCard} flex h-[320px] flex-col p-4`}>
        <div className="mb-3 flex shrink-0 items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-900">Recent Activity</h2>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
            {timeline.length}
          </span>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {timeline.length ? (
            <ul className="space-y-0">
              {timeline.slice(0, 12).map((item) => (
                <li
                  key={item.id}
                  className="flex gap-2.5 border-b border-slate-50 py-2.5 last:border-0"
                >
                  <div className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="truncate text-[13px] font-medium text-slate-800">{item.label}</p>
                      <span className="shrink-0 text-[10px] text-slate-400">
                        {relativeTime(item.at)}
                      </span>
                    </div>
                    <p className="mt-0.5 truncate text-[11px] text-slate-500">
                      {item.detail || item.entityType || ''}
                      {item.performer ? ` · ${item.performer}` : ''}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-slate-200 px-4 text-center text-[13px] text-slate-500">
              No recent recruitment activity
            </div>
          )}
        </div>
      </section>
    </>
  );
}

export function RecTeamLeaderboard({ overview, loading }: Props) {
  const rows = overview?.leaderboard || [];
  const recommendations = overview?.recommendations || [];

  if (loading && !overview) {
    return <div className="h-64 animate-pulse rounded-2xl bg-white" />;
  }

  return (
    <div className="grid gap-4 xl:grid-cols-5">
      <section className={`${recCard} p-5 xl:col-span-3`}>
        <h2 className="mb-3 text-sm font-bold text-slate-900">Recruiter Performance</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-[11px] uppercase tracking-wider text-slate-400">
              <tr>
                <th className="pb-2 font-semibold">Recruiter</th>
                <th className="pb-2 font-semibold">Open Jobs</th>
                <th className="pb-2 font-semibold">Candidates</th>
                <th className="pb-2 font-semibold">Interviews</th>
                <th className="pb-2 font-semibold">Placements</th>
              </tr>
            </thead>
            <tbody>
              {rows.length ? (
                rows.map((r) => (
                  <tr key={r.id} className="border-t border-slate-100">
                    <td className="py-2.5 font-semibold text-slate-800">{r.name}</td>
                    <td className="py-2.5 tabular-nums text-slate-600">{formatNum(r.openJobs)}</td>
                    <td className="py-2.5 tabular-nums text-slate-600">{formatNum(r.candidates)}</td>
                    <td className="py-2.5 tabular-nums text-slate-600">{formatNum(r.interviews)}</td>
                    <td className="py-2.5 tabular-nums text-slate-600">{formatNum(r.placements)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-sm text-slate-500">
                    Assign jobs and candidates to recruiters to see rankings.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className={`${recCard} p-5 xl:col-span-2`}>
        <h2 className="mb-3 text-sm font-bold text-slate-900">Recommended Actions</h2>
        <ul className="space-y-2">
          {recommendations.length ? (
            recommendations.map((rec) => (
              <li key={rec.id}>
                <Link
                  href={rec.href || '/recruitment'}
                  className="block rounded-xl border border-slate-100 bg-slate-50/70 px-3 py-2.5 transition hover:border-amber-200 hover:bg-amber-50/50"
                >
                  <p className="text-sm font-semibold text-slate-800">{rec.text}</p>
                  {rec.detail ? (
                    <p className="mt-0.5 text-[11px] text-slate-500">{rec.detail}</p>
                  ) : null}
                </Link>
              </li>
            ))
          ) : (
            <li className="rounded-xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
              You&apos;re caught up — no urgent hiring actions.
            </li>
          )}
        </ul>
        {overview?.todaySummary ? (
          <div className="mt-4 grid grid-cols-2 gap-2">
            <div className="rounded-xl bg-amber-50 px-3 py-2">
              <p className="text-[10px] font-semibold uppercase text-amber-700">Open jobs</p>
              <p className="text-lg font-bold text-amber-900">
                {formatNum(overview.todaySummary.openJobs)}
              </p>
            </div>
            <div className="rounded-xl bg-emerald-50 px-3 py-2">
              <p className="text-[10px] font-semibold uppercase text-emerald-700">Revenue</p>
              <p className="text-lg font-bold text-emerald-900">
                {formatInr(overview.todaySummary.placementRevenue)}
              </p>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}

export function RecAlertsPanel({ overview, loading }: Props) {
  const alerts = overview?.alerts || [];

  if (loading && !overview) {
    return <div className="h-[320px] animate-pulse rounded-2xl bg-white" />;
  }

  const iconFor = (severity?: string) => {
    if (severity === 'high') return AlertTriangle;
    if (severity === 'medium') return Bell;
    if (severity === 'info') return Info;
    return CheckCircle2;
  };

  const toneFor = (severity?: string) => {
    if (severity === 'high') return 'bg-rose-50 text-rose-700 border-rose-100';
    if (severity === 'medium') return 'bg-amber-50 text-amber-800 border-amber-100';
    return 'bg-sky-50 text-sky-800 border-sky-100';
  };

  return (
    <section className={`${recCard} flex h-[320px] flex-col p-4`}>
      <div className="mb-3 flex shrink-0 items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-900">Hiring Alerts</h2>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
          {alerts.length}
        </span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {alerts.length ? (
          <ul className="space-y-2">
            {alerts.map((alert) => {
              const Icon = iconFor(alert.severity);
              return (
                <li key={alert.id}>
                  <Link
                    href={alert.href || '/recruitment'}
                    className={`flex gap-2.5 rounded-xl border px-3 py-2.5 transition hover:shadow-sm ${toneFor(alert.severity)}`}
                  >
                    <Icon size={15} className="mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-[13px] font-semibold leading-snug">{alert.text}</p>
                      {alert.action ? (
                        <p className="mt-0.5 text-[11px] font-medium opacity-80">{alert.action} →</p>
                      ) : null}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="flex h-full flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 px-4 text-center">
            <CheckCircle2 className="mb-2 text-emerald-500" size={22} />
            <p className="text-[13px] text-slate-500">No hiring alerts right now</p>
          </div>
        )}
      </div>
    </section>
  );
}
