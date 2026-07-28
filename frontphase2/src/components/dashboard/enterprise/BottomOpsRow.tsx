'use client';

import React from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  Info,
  Phone,
  Sparkles,
} from 'lucide-react';
import type { DashboardOverview } from '@/lib/dashboard/api';
import { useEnterpriseDashboard } from './smartDashboardFilters';
import {
  cardClass,
  formatClock,
  formatShortDate,
  relativeTime,
} from './dashboardUi';

type Props = {
  overview: DashboardOverview | null;
  loading?: boolean;
};

function PanelShell({
  title,
  children,
  href,
  linkLabel = 'View All',
}: {
  title: string;
  children: React.ReactNode;
  href?: string;
  linkLabel?: string;
}) {
  return (
    <section className={`${cardClass} flex min-h-[320px] flex-col p-5`}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-sm font-bold text-slate-900">{title}</h2>
        {href ? (
          <Link href={href} className="text-[11px] font-semibold text-[#3B82F6] hover:underline">
            {linkLabel} →
          </Link>
        ) : null}
      </div>
      <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto pr-1">{children}</div>
    </section>
  );
}

export function BottomOpsRow({ overview, loading }: Props) {
  const { openDrillDown } = useEnterpriseDashboard();
  const followups = overview?.upcomingFollowups || [];
  const schedule =
    overview?.todaysSchedule?.length
      ? overview.todaysSchedule
      : (overview?.calendarItems || [])
          .filter((c) => c.type === 'interview' || c.type === 'meeting')
          .slice(0, 8)
          .map((c) => ({
            id: c.id,
            title: c.title,
            at: c.at,
            duration: '30m',
            href: c.href,
          }));
  const activities = overview?.activityTimeline || [];
  const alerts = overview?.alerts || [];

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
      <PanelShell title="Upcoming Follow-ups" href="/leads">
        {followups.length ? (
          followups.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() =>
                openDrillDown({
                  title: f.company,
                  href: f.href || '/leads',
                  rows: [
                    {
                      company: f.company,
                      type: f.type,
                      when: f.at,
                      assignee: f.assignee,
                    },
                  ],
                })
              }
              className="flex w-full items-start gap-3 rounded-xl border border-slate-100 bg-slate-50/50 px-3 py-2.5 text-left hover:border-blue-200 hover:bg-blue-50/40"
            >
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                <Phone size={14} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-slate-800">
                  {f.company}
                </span>
                <span className="block text-[11px] text-slate-500">{f.type || 'Follow-up'}</span>
                <span className="mt-0.5 flex flex-wrap gap-x-2 text-[11px] text-slate-400">
                  <span>
                    {formatShortDate(f.at)} · {formatClock(f.at)}
                  </span>
                  <span>{f.assignee}</span>
                </span>
              </span>
            </button>
          ))
        ) : (
          <p className="text-sm text-slate-400">No upcoming follow-ups</p>
        )}
      </PanelShell>

      <PanelShell title="Today's Schedule" href="/interviews">
        {schedule.length ? (
          <ol className="relative space-y-0 border-l border-slate-200 pl-4">
            {schedule.map((item, i) => (
              <li key={item.id} className="relative pb-4 last:pb-0">
                <span
                  className={`absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full ring-4 ring-white ${
                    i % 3 === 0 ? 'bg-blue-500' : i % 3 === 1 ? 'bg-violet-500' : 'bg-emerald-500'
                  }`}
                />
                <button
                  type="button"
                  onClick={() =>
                    openDrillDown({
                      title: item.title,
                      href: item.href || '/interviews',
                      rows: [{ title: item.title, at: item.at, duration: item.duration }],
                    })
                  }
                  className="w-full text-left"
                >
                  <p className="text-[11px] font-semibold text-slate-400">
                    {formatClock(item.at)}
                    {item.duration ? (
                      <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500">
                        {item.duration}
                      </span>
                    ) : null}
                  </p>
                  <p className="text-sm font-semibold text-slate-800">{item.title}</p>
                </button>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-sm text-slate-400">Nothing scheduled today</p>
        )}
      </PanelShell>

      <PanelShell title="Recent Activities" href="/Task&Activites">
        {activities.length ? (
          activities.slice(0, 12).map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() =>
                openDrillDown({
                  title: a.label,
                  rows: [
                    {
                      activity: a.label,
                      detail: a.detail,
                      by: a.performer,
                      at: a.at,
                    },
                  ],
                })
              }
              className="flex w-full items-start gap-2.5 rounded-xl px-1 py-1.5 text-left hover:bg-slate-50"
            >
              <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                <CheckCircle2 size={13} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-slate-800">{a.label}</span>
                {a.detail ? (
                  <span className="block truncate text-[11px] text-slate-500">{a.detail}</span>
                ) : null}
                <span className="text-[10px] text-slate-400">
                  {relativeTime(a.at)}
                  {a.performer ? ` · ${a.performer}` : ''}
                </span>
              </span>
            </button>
          ))
        ) : (
          <p className="text-sm text-slate-400">No recent activity</p>
        )}
      </PanelShell>

      <PanelShell title="Notifications" href="/dashboard" linkLabel="View Details">
        {alerts.length ? (
          alerts.slice(0, 10).map((alert) => {
            const Icon =
              alert.severity === 'high'
                ? AlertTriangle
                : alert.severity === 'medium'
                  ? Info
                  : Bell;
            const tone =
              alert.severity === 'high'
                ? 'bg-rose-50 text-rose-600'
                : alert.severity === 'medium'
                  ? 'bg-amber-50 text-amber-600'
                  : 'bg-blue-50 text-blue-600';
            return (
              <button
                key={alert.id}
                type="button"
                onClick={() =>
                  openDrillDown({
                    title: 'Notification',
                    href: alert.href,
                    rows: [{ alert: alert.text, action: alert.action || '' }],
                  })
                }
                className="flex w-full items-start gap-2.5 rounded-xl border border-slate-100 px-3 py-2.5 text-left hover:border-slate-200 hover:bg-slate-50"
              >
                <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${tone}`}>
                  <Icon size={13} />
                </span>
                <span
                  className={`text-[13px] leading-snug ${
                    alert.severity === 'high' ? 'font-medium text-rose-600' : 'text-slate-700'
                  }`}
                >
                  {alert.text}
                </span>
              </button>
            );
          })
        ) : (
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <Sparkles size={14} /> All clear — no urgent alerts
          </div>
        )}
      </PanelShell>
    </div>
  );
}
