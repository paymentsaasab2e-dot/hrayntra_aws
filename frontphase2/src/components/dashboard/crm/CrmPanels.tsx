'use client';

import React from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  Info,
  Phone,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { CrmOverview } from '@/lib/dashboard/api';
import { crmCard, formatInr, formatNum, relativeTime, useCrmDashboard } from './crmShared';

const COLORS = ['#3B82F6', '#6366F1', '#10B981', '#F59E0B', '#EC4899', '#06B6D4', '#8B5CF6', '#94A3B8'];

type Props = { overview: CrmOverview | null; loading?: boolean };

export function CrmAnalyticsRow({ overview }: Props) {
  const { openDrillDown } = useCrmDashboard();
  const pipeline = overview?.pipeline || [];
  const sources = overview?.leadSources || [];
  const statusBars = overview?.leadStatusBars || [];
  const industries = overview?.industries || [];
  const countries = overview?.countries || [];
  const growth = overview?.clientGrowth || [];
  const k = overview?.kpis || {};

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <section className={`${crmCard} space-y-4 p-5`}>
        <h2 className="text-sm font-bold text-slate-900">Lead Analytics</h2>
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">Pipeline Funnel</p>
          <div className="flex flex-wrap gap-1.5">
            {pipeline.map((stage, i) => (
              <button
                key={stage.stage}
                type="button"
                onClick={() =>
                  openDrillDown({
                    title: `${stage.stage} leads`,
                    href: stage.href || '/leads',
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
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">Lead Sources</p>
            <div className="h-44">
              {sources.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={sources} dataKey="value" nameKey="name" innerRadius={40} outerRadius={60} paddingAngle={2}>
                      {sources.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <p className="flex h-full items-center justify-center text-sm text-slate-400">No source data</p>
              )}
            </div>
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">Lead Status</p>
            <div className="h-44">
              {statusBars.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={statusBars.slice(0, 6)}>
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                    <YAxis hide />
                    <Tooltip />
                    <Bar dataKey="value" fill="#3B82F6" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="flex h-full items-center justify-center text-sm text-slate-400">No status data</p>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className={`${crmCard} space-y-4 p-5`}>
        <h2 className="text-sm font-bold text-slate-900">Client Analytics</h2>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {[
            { label: 'Total', value: k.totalClients, href: '/client' },
            { label: 'Active', value: k.activeClients, href: '/client' },
            { label: 'Inactive', value: k.inactiveClients, href: '/client' },
            { label: 'Hot', value: k.hotClients, href: '/client' },
            { label: 'Cold', value: k.coldClients, href: '/client' },
            { label: 'On Hold', value: k.onHoldClients, href: '/client' },
          ].map((c) => (
            <button
              key={c.label}
              type="button"
              onClick={() => openDrillDown({ title: c.label, href: c.href, rows: [{ count: c.value }] })}
              className="rounded-xl bg-slate-50 px-2 py-2.5 text-center hover:bg-blue-50"
            >
              <p className="text-base font-bold text-slate-900">{formatNum(c.value as number)}</p>
              <p className="text-[10px] text-slate-500">{c.label}</p>
            </button>
          ))}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">Client Growth</p>
            <div className="h-40">
              {growth.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={growth}>
                    <XAxis dataKey="label" hide />
                    <YAxis hide />
                    <Tooltip />
                    <Area type="monotone" dataKey="value" stroke="#6366F1" fill="#6366F1" fillOpacity={0.2} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <p className="flex h-full items-center justify-center text-sm text-slate-400">No growth data</p>
              )}
            </div>
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">Industry</p>
            <ul className="max-h-40 space-y-1.5 overflow-y-auto text-xs">
              {industries.length ? (
                industries.map((d, i) => (
                  <li key={d.name} className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5 truncate text-slate-600">
                      <span className="h-2 w-2 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                      {d.name}
                    </span>
                    <span className="font-semibold text-slate-800">{d.value}</span>
                  </li>
                ))
              ) : (
                <li className="text-slate-400">No industry data</li>
              )}
            </ul>
            {countries.length ? (
              <div className="mt-3">
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Country</p>
                <p className="text-xs text-slate-600">
                  {countries.slice(0, 4).map((c) => `${c.name} (${c.value})`).join(' · ')}
                </p>
              </div>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  );
}

export function CrmFollowupActivity({ overview }: Props) {
  const { openDrillDown } = useCrmDashboard();
  const fu = overview?.followups;
  const calendar = overview?.calendar || [];
  const activities = overview?.activityTimeline || [];

  return (
    <div className="grid gap-4 xl:grid-cols-12">
      <section className={`${crmCard} p-5 xl:col-span-5`}>
        <h2 className="mb-3 text-sm font-bold text-slate-900">Follow-up Dashboard</h2>
        <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            { label: "Today's", value: fu?.today, tone: 'bg-blue-50 text-blue-700' },
            { label: 'Tomorrow', value: fu?.tomorrow, tone: 'bg-indigo-50 text-indigo-700' },
            { label: 'Overdue', value: fu?.overdue, tone: 'bg-rose-50 text-rose-700' },
            { label: 'Completed', value: fu?.completed, tone: 'bg-emerald-50 text-emerald-700' },
          ].map((c) => (
            <button
              key={c.label}
              type="button"
              onClick={() =>
                openDrillDown({
                  title: `${c.label} follow-ups`,
                  href: '/leads',
                  rows: (fu?.upcoming || []).map((item) => ({
                    Company: item.company,
                    Contact: item.contact || '—',
                    When: item.at ? new Date(item.at).toLocaleString() : '—',
                    Status: item.status || '—',
                    Priority: item.priority || '—',
                    Assignee: item.assignee || '—',
                  })),
                })
              }
              className={`rounded-xl px-3 py-3 text-left ${c.tone}`}
            >
              <p className="text-xl font-bold">{formatNum(c.value)}</p>
              <p className="text-[11px] opacity-80">{c.label}</p>
            </button>
          ))}
        </div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">Upcoming Follow-ups</p>
        <ul className="max-h-56 space-y-2 overflow-y-auto">
          {(fu?.upcoming || []).length ? (
            fu!.upcoming.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() =>
                    openDrillDown({
                      title: item.company,
                      href: item.href || '/leads',
                      rows: [
                        {
                          Company: item.company,
                          Contact: item.contact || '—',
                          When: item.at ? new Date(item.at).toLocaleString() : '—',
                          Status: item.status || '—',
                          Priority: item.priority || '—',
                          Assignee: item.assignee || '—',
                        },
                      ],
                    })
                  }
                  className="flex w-full items-start gap-2 rounded-xl border border-slate-100 px-3 py-2 text-left hover:bg-slate-50"
                >
                  <Phone size={14} className="mt-1 text-blue-500" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-slate-800">{item.company}</span>
                    <span className="block text-[11px] text-slate-500">
                      {item.assignee} · {item.at ? new Date(item.at).toLocaleString() : '—'}
                    </span>
                  </span>
                </button>
              </li>
            ))
          ) : (
            <li className="text-sm text-slate-400">No upcoming follow-ups</li>
          )}
        </ul>
      </section>

      <section className={`${crmCard} p-5 xl:col-span-3`}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-900">Calendar</h2>
          <Link href="/Task&Activites" className="text-[11px] font-semibold text-blue-600">
            View all →
          </Link>
        </div>
        <ul className="max-h-[22rem] space-y-2 overflow-y-auto">
          {calendar.length ? (
            calendar.map((item) => (
              <li key={item.id} className="rounded-xl border border-slate-100 px-3 py-2">
                <p className="text-[10px] font-semibold uppercase text-slate-400">{item.type}</p>
                <p className="text-sm font-semibold text-slate-800">{item.title}</p>
                <p className="text-[11px] text-slate-500">
                  {item.at ? new Date(item.at).toLocaleString() : '—'}
                  {item.time ? ` · ${item.time}` : ''}
                </p>
              </li>
            ))
          ) : (
            <li className="text-sm text-slate-400">No meetings or calls upcoming</li>
          )}
        </ul>
      </section>

      <section className={`${crmCard} p-5 xl:col-span-4`}>
        <div className="mb-3 flex items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Recent Activities</h2>
            <p className="text-[11px] text-slate-500">Team activity by your access level</p>
          </div>
        </div>
        <ul className="max-h-[22rem] space-y-2 overflow-y-auto">
          {activities.length ? (
            activities.map((a) => (
              <li key={a.id}>
                <button
                  type="button"
                  onClick={() =>
                    openDrillDown({
                      title: a.label,
                      rows: [{ detail: a.detail, by: a.performer, at: a.at }],
                    })
                  }
                  className="flex w-full items-start gap-2 rounded-xl px-1 py-1.5 text-left hover:bg-slate-50"
                >
                  <CheckCircle2 size={14} className="mt-0.5 text-emerald-500" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-slate-800">{a.label}</span>
                    <span className="text-[10px] text-slate-400">
                      {relativeTime(a.at)}
                      {a.performer ? ` · ${a.performer}` : ''}
                    </span>
                  </span>
                </button>
              </li>
            ))
          ) : (
            <li className="text-sm text-slate-400">No recent CRM activity</li>
          )}
        </ul>
      </section>
    </div>
  );
}

export function CrmCommunication({ overview }: Props) {
  const { openDrillDown } = useCrmDashboard();
  const c = overview?.communication;
  const cards = [
    { key: 'calls', label: 'Calls', data: c?.calls },
    { key: 'meetings', label: 'Meetings', data: c?.meetings },
    { key: 'emails', label: 'Emails', data: c?.emails },
    { key: 'whatsapp', label: 'WhatsApp', data: c?.whatsapp },
  ];

  return (
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <button
          key={card.key}
          type="button"
          onClick={() =>
            openDrillDown({
              title: card.label,
              href: '/Task&Activites',
              rows: [
                {
                  completed: card.data?.completed,
                  pending: card.data?.pending,
                  cancelled: card.data?.cancelled,
                  successRate: `${card.data?.successRate ?? 0}%`,
                },
              ],
            })
          }
          className={`${crmCard} p-4 text-left transition hover:-translate-y-0.5 hover:shadow-md`}
        >
          <p className="text-sm font-bold text-slate-900">{card.label}</p>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
            <div>
              <p className="text-lg font-bold text-emerald-600">{formatNum(card.data?.completed)}</p>
              <p className="text-slate-400">Done</p>
            </div>
            <div>
              <p className="text-lg font-bold text-amber-600">{formatNum(card.data?.pending)}</p>
              <p className="text-slate-400">Pending</p>
            </div>
            <div>
              <p className="text-lg font-bold text-slate-700">{card.data?.successRate ?? 0}%</p>
              <p className="text-slate-400">Success</p>
            </div>
          </div>
        </button>
      ))}
    </section>
  );
}

export function CrmTeamLeaderboard({ overview }: Props) {
  const { openDrillDown } = useCrmDashboard();
  const rows = overview?.leaderboard || [];
  const maxAssigned = Math.max(1, ...rows.map((r) => r.assignedLeads || 0));
  const totals = rows.reduce(
    (acc, r) => ({
      leads: acc.leads + (r.assignedLeads || 0),
      clients: acc.clients + (r.assignedClients || 0),
      conversions: acc.conversions + (r.conversions || 0),
      followups: acc.followups + (r.followups || 0),
      overdue: acc.overdue + (r.overdueFollowups || 0),
      calls: acc.calls + (r.calls || 0),
      meetings: acc.meetings + (r.meetings || 0),
    }),
    { leads: 0, clients: 0, conversions: 0, followups: 0, overdue: 0, calls: 0, meetings: 0 },
  );

  const initials = (name?: string) => {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/).filter(Boolean);
    return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || '?';
  };

  const formatShort = (iso?: string | null) => {
    if (!iso) return '—';
    const d = new Date(iso);
    if (!Number.isFinite(d.getTime())) return '—';
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const avgRate =
    totals.leads > 0 ? ((totals.conversions / totals.leads) * 100).toFixed(1) : '0';

  return (
    <section className={`${crmCard} overflow-hidden`}>
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-100 px-6 py-5">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
            Leaderboard
          </p>
          <h2 className="mt-1 text-xl font-bold tracking-tight text-slate-900">Team Performance</h2>
          <p className="mt-0.5 text-sm text-slate-500">Leads & clients ownership across your team</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="rounded-2xl bg-slate-50 px-3.5 py-2 text-center ring-1 ring-slate-100">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Members</p>
            <p className="text-base font-bold text-slate-900">{rows.length}</p>
          </div>
          <div className="rounded-2xl bg-blue-50 px-3.5 py-2 text-center ring-1 ring-blue-100">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-blue-500">Leads</p>
            <p className="text-base font-bold text-blue-700">{formatNum(totals.leads)}</p>
          </div>
          <div className="rounded-2xl bg-indigo-50 px-3.5 py-2 text-center ring-1 ring-indigo-100">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-indigo-500">Clients</p>
            <p className="text-base font-bold text-indigo-700">{formatNum(totals.clients)}</p>
          </div>
          <div className="rounded-2xl bg-emerald-50 px-3.5 py-2 text-center ring-1 ring-emerald-100">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-500">Conv.</p>
            <p className="text-base font-bold text-emerald-700">{avgRate}%</p>
          </div>
          {totals.overdue > 0 ? (
            <div className="rounded-2xl bg-rose-50 px-3.5 py-2 text-center ring-1 ring-rose-100">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-rose-500">Overdue</p>
              <p className="text-base font-bold text-rose-700">{formatNum(totals.overdue)}</p>
            </div>
          ) : null}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full text-left">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/70 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
              <th className="px-6 py-3 font-semibold">Team member</th>
              <th className="px-3 py-3 font-semibold">Leads</th>
              <th className="px-3 py-3 font-semibold">Clients</th>
              <th className="px-3 py-3 font-semibold">Calls</th>
              <th className="px-3 py-3 font-semibold">Meetings</th>
              <th className="px-3 py-3 font-semibold">Follow-ups</th>
              <th className="px-3 py-3 font-semibold">Converted</th>
              <th className="px-3 py-3 font-semibold">Rate</th>
              <th className="px-3 py-3 font-semibold">Last activity</th>
              <th className="px-6 py-3 font-semibold">Next follow-up</th>
            </tr>
          </thead>
          <tbody>
            {rows.length ? (
              rows.map((r, i) => {
                const nextOverdue =
                  r.nextFollowUp && Number.isFinite(new Date(r.nextFollowUp).getTime())
                    ? new Date(r.nextFollowUp).getTime() < Date.now()
                    : false;
                const barPct = Math.round(((r.assignedLeads || 0) / maxAssigned) * 100);
                const medal =
                  i === 0
                    ? 'bg-amber-100 text-amber-700 ring-amber-200'
                    : i === 1
                      ? 'bg-slate-100 text-slate-600 ring-slate-200'
                      : i === 2
                        ? 'bg-orange-100 text-orange-700 ring-orange-200'
                        : 'bg-white text-slate-400 ring-slate-200';

                return (
                  <tr
                    key={r.id}
                    onClick={() =>
                      openDrillDown({
                        title: r.name,
                        href: '/team',
                        rows: [
                          {
                            Name: r.name,
                            Role: String(r.role || 'Team').replace(/_/g, ' '),
                            Leads: r.assignedLeads,
                            Clients: r.assignedClients || 0,
                            Calls: r.calls,
                            Meetings: r.meetings,
                            Emails: r.emails || 0,
                            'Follow-ups': r.followups,
                            Overdue: r.overdueFollowups || 0,
                            Converted: r.conversions,
                            Rate: `${r.completionRate}%`,
                            Business: formatInr(r.businessGenerated),
                            'Last Activity': r.lastActivity
                              ? new Date(r.lastActivity).toLocaleString()
                              : '—',
                            'Next Follow-up': r.nextFollowUp
                              ? new Date(r.nextFollowUp).toLocaleString()
                              : '—',
                          },
                        ],
                      })
                    }
                    className="cursor-pointer border-b border-slate-50 transition hover:bg-blue-50/40"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <span
                          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ring-1 ${medal}`}
                        >
                          {i + 1}
                        </span>
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#3B82F6] to-[#6366F1] text-xs font-bold text-white shadow-sm shadow-blue-500/20">
                          {initials(r.name)}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-semibold text-slate-900">
                            {r.name}
                          </span>
                          <span className="block truncate text-[11px] text-slate-400">
                            {String(r.role || 'Team').replace(/_/g, ' ')}
                          </span>
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-4">
                      <p className="text-sm font-bold tabular-nums text-slate-900">{r.assignedLeads}</p>
                      <div className="mt-1.5 h-1 w-16 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-[#3B82F6]"
                          style={{ width: `${Math.max(barPct, 4)}%` }}
                        />
                      </div>
                    </td>
                    <td className="px-3 py-4 text-sm font-semibold tabular-nums text-slate-800">
                      {r.assignedClients || 0}
                    </td>
                    <td className="px-3 py-4 text-sm tabular-nums text-slate-700">{r.calls}</td>
                    <td className="px-3 py-4 text-sm tabular-nums text-slate-700">{r.meetings}</td>
                    <td className="px-3 py-4">
                      <p className="text-sm font-semibold tabular-nums text-slate-800">{r.followups}</p>
                      {(r.overdueFollowups || 0) > 0 ? (
                        <span className="mt-1 inline-flex rounded-md bg-rose-50 px-1.5 py-0.5 text-[10px] font-bold text-rose-600 ring-1 ring-rose-100">
                          {r.overdueFollowups} overdue
                        </span>
                      ) : (
                        <span className="mt-1 inline-flex rounded-md bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-600 ring-1 ring-emerald-100">
                          On track
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-4 text-sm font-bold tabular-nums text-emerald-600">
                      {r.conversions}
                    </td>
                    <td className="px-3 py-4">
                      <span className="inline-flex rounded-full bg-blue-50 px-2.5 py-1 text-xs font-bold tabular-nums text-blue-700 ring-1 ring-blue-100">
                        {r.completionRate}%
                      </span>
                    </td>
                    <td className="px-3 py-4">
                      {r.lastActivity ? (
                        <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                          {relativeTime(r.lastActivity)}
                        </span>
                      ) : (
                        <span className="text-sm text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {r.nextFollowUp ? (
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${
                            nextOverdue
                              ? 'bg-rose-50 text-rose-700 ring-rose-100'
                              : 'bg-sky-50 text-sky-700 ring-sky-100'
                          }`}
                        >
                          {nextOverdue ? 'Overdue' : 'Due'} · {formatShort(r.nextFollowUp)}
                        </span>
                      ) : (
                        <span className="text-sm text-slate-300">—</span>
                      )}
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={10} className="px-6 py-14 text-center text-sm text-slate-400">
                  No team assignment data yet
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function CrmBusinessSummary({ overview }: Props) {
  const { openDrillDown } = useCrmDashboard();
  const b = overview?.businessSummary;
  const cards = [
    { label: 'Potential Business Value', value: formatInr(b?.potentialBusinessValue), href: '/leads' },
    { label: 'Expected Revenue', value: formatInr(b?.expectedRevenue), href: '/leads' },
    { label: 'Average Lead Value', value: formatInr(b?.averageLeadValue), href: '/leads' },
    { label: 'Average Client Value', value: formatInr(b?.averageClientValue), href: '/client' },
    {
      label: 'Highest Value Lead',
      value: b?.highestValueLead ? `${b.highestValueLead.name} · ${formatInr(b.highestValueLead.value)}` : '—',
      href: '/leads',
    },
    {
      label: 'Highest Value Client',
      value: b?.highestValueClient
        ? `${b.highestValueClient.name} · ${formatInr(b.highestValueClient.value)}`
        : '—',
      href: '/client',
    },
  ];

  return (
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
      {cards.map((c) => (
        <button
          key={c.label}
          type="button"
          onClick={() => openDrillDown({ title: c.label, href: c.href, rows: [{ value: c.value }] })}
          className={`${crmCard} p-4 text-left transition hover:-translate-y-0.5 hover:shadow-md`}
        >
          <p className="text-[11px] font-medium text-slate-500">{c.label}</p>
          <p className="mt-1 text-sm font-bold leading-snug text-slate-900">{c.value}</p>
        </button>
      ))}
    </section>
  );
}

export function CrmAlertsPanel({ overview }: Props) {
  const { openDrillDown } = useCrmDashboard();
  const alerts = overview?.alerts || [];

  return (
    <aside className={`${crmCard} flex h-full min-h-[280px] flex-col p-5`}>
      <div className="mb-3 flex items-center gap-2">
        <Bell size={16} className="text-blue-600" />
        <h2 className="text-sm font-bold text-slate-900">Alerts</h2>
        {alerts.length ? (
          <span className="rounded-full bg-rose-500 px-1.5 text-[10px] font-bold text-white">
            {alerts.length}
          </span>
        ) : null}
      </div>
      <ul className="flex-1 space-y-2 overflow-y-auto">
        {alerts.length ? (
          alerts.map((a) => {
            const Icon = a.severity === 'high' ? AlertTriangle : a.severity === 'medium' ? Info : CheckCircle2;
            const tone =
              a.severity === 'high'
                ? 'border-rose-100 bg-rose-50 text-rose-700'
                : a.severity === 'medium'
                  ? 'border-amber-100 bg-amber-50 text-amber-800'
                  : 'border-emerald-100 bg-emerald-50 text-emerald-800';
            return (
              <li key={a.id}>
                <button
                  type="button"
                  onClick={() =>
                    openDrillDown({
                      title: a.text,
                      href: a.href || '/dashboard',
                      rows: [
                        {
                          Alert: a.text,
                          Severity: a.severity || 'info',
                          Action: a.action || '—',
                        },
                      ],
                    })
                  }
                  className={`flex w-full items-start gap-2 rounded-xl border px-3 py-2.5 text-left ${tone}`}
                >
                  <Icon size={14} className="mt-0.5 shrink-0" />
                  <span className="text-[13px] leading-snug">{a.text}</span>
                </button>
              </li>
            );
          })
        ) : (
          <li className="text-sm text-slate-400">No critical alerts — CRM looks healthy</li>
        )}
      </ul>
    </aside>
  );
}
