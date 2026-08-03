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
    description: 'Open roles, requisitions, and hiring needs.',
    icon: Briefcase,
    accent: 'text-amber-700 bg-amber-50 border-amber-200',
  },
  {
    href: '/candidate',
    label: 'Candidates',
    description: 'Talent profiles and applicant progress.',
    icon: UserRound,
    accent: 'text-violet-600 bg-violet-50 border-violet-200',
  },
  {
    href: '/interviews',
    label: 'Interviews',
    description: 'Schedule rounds and review outcomes.',
    icon: Calendar,
    accent: 'text-cyan-600 bg-cyan-50 border-cyan-200',
  },
  {
    href: '/placement',
    label: 'Placements',
    description: 'Offers, joinings, and closed placements.',
    icon: Award,
    accent: 'text-emerald-600 bg-emerald-50 border-emerald-200',
  },
] as const;

export function RecModuleShortcuts() {
  return (
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {MODULES.map(({ href, label, description, icon: Icon, accent }) => (
        <Link
          key={href}
          href={href}
          className={`group flex items-start gap-3 rounded-2xl border bg-white p-4 shadow-sm transition hover:shadow-md ${accent}`}
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-inherit bg-white">
            <Icon size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-slate-900">{label}</h3>
              <ChevronRight
                size={14}
                className="text-slate-400 transition-transform group-hover:translate-x-0.5"
              />
            </div>
            <p className="mt-0.5 text-xs text-slate-500">{description}</p>
          </div>
        </Link>
      ))}
    </section>
  );
}

export function RecSchedulePanel({ overview, loading }: Props) {
  const items = overview?.schedule || [];
  const timeline = overview?.activityTimeline || [];

  if (loading && !overview) {
    return <div className="h-72 animate-pulse rounded-2xl bg-white" />;
  }

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <section className={`${recCard} p-5`}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-900">Upcoming Interviews</h2>
          <Link href="/interviews" className="text-xs font-semibold text-amber-700 hover:underline">
            Open calendar →
          </Link>
        </div>
        <ul className="space-y-2">
          {items.length ? (
            items.map((item) => (
              <li
                key={item.id}
                className="flex items-start justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-2.5"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-800">{item.title}</p>
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    {formatWhen(item.at)}
                    {item.round ? ` · ${item.round}` : ''}
                    {item.assignee ? ` · ${item.assignee}` : ''}
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-600 ring-1 ring-slate-200">
                  {item.status || 'SCHEDULED'}
                </span>
              </li>
            ))
          ) : (
            <li className="rounded-xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
              No interviews in the next 7 days.
            </li>
          )}
        </ul>
      </section>

      <section className={`${recCard} p-5`}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-900">Recent Activity</h2>
          <span className="text-[11px] text-slate-400">{timeline.length} events</span>
        </div>
        <ul className="space-y-2">
          {timeline.length ? (
            timeline.slice(0, 10).map((item) => (
              <li key={item.id} className="flex gap-3 border-b border-slate-50 pb-2 last:border-0">
                <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-amber-500" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-800">{item.label}</p>
                  <p className="truncate text-[11px] text-slate-500">
                    {item.detail || item.entityType || ''}
                    {item.performer ? ` · ${item.performer}` : ''}
                  </p>
                  <p className="text-[10px] text-slate-400">{relativeTime(item.at)}</p>
                </div>
              </li>
            ))
          ) : (
            <li className="rounded-xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
              No recent recruitment activity.
            </li>
          )}
        </ul>
      </section>
    </div>
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
    return <div className="h-72 animate-pulse rounded-2xl bg-white" />;
  }

  const iconFor = (severity?: string) => {
    if (severity === 'high') return AlertTriangle;
    if (severity === 'medium') return Bell;
    if (severity === 'info') return Info;
    return CheckCircle2;
  };

  const toneFor = (severity?: string) => {
    if (severity === 'high') return 'bg-rose-50 text-rose-600 border-rose-100';
    if (severity === 'medium') return 'bg-amber-50 text-amber-700 border-amber-100';
    return 'bg-sky-50 text-sky-700 border-sky-100';
  };

  return (
    <section className={`${recCard} sticky top-4 p-5`}>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-bold text-slate-900">Hiring Alerts</h2>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
          {alerts.length}
        </span>
      </div>
      <ul className="space-y-2">
        {alerts.length ? (
          alerts.map((alert) => {
            const Icon = iconFor(alert.severity);
            return (
              <li key={alert.id}>
                <Link
                  href={alert.href || '/recruitment'}
                  className={`flex gap-2.5 rounded-xl border px-3 py-2.5 transition hover:shadow-sm ${toneFor(alert.severity)}`}
                >
                  <Icon size={16} className="mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold leading-snug">{alert.text}</p>
                    {alert.action ? (
                      <p className="mt-0.5 text-[11px] font-medium opacity-80">{alert.action} →</p>
                    ) : null}
                  </div>
                </Link>
              </li>
            );
          })
        ) : (
          <li className="rounded-xl border border-dashed border-slate-200 px-4 py-10 text-center text-sm text-slate-500">
            <CheckCircle2 className="mx-auto mb-2 text-emerald-500" size={22} />
            No hiring alerts right now.
          </li>
        )}
      </ul>
    </section>
  );
}
