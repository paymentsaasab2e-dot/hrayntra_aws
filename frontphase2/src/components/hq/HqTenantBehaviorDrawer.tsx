'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  BarChart3,
  Brain,
  Clock3,
  GitBranch,
  LayoutGrid,
  Lightbulb,
  Loader2,
  LogIn,
  MousePointerClick,
  Radio,
  RefreshCw,
  Search,
  Sparkles,
  TrendingUp,
  X,
  Zap,
} from 'lucide-react';
import {
  apiHqGetTenantBehavior,
  type HqTenantBehaviorAnalysis,
  type HqTenantRow,
} from '@/lib/api';

type DrawerTab = 'overview' | 'modules' | 'funnel' | 'triggers' | 'live';
type TimelineRange = 'today' | 'week' | 'month' | 'year';
type FeedEvent = HqTenantBehaviorAnalysis['liveFeed'][number];

const DRAWER_TABS: Array<{ id: DrawerTab; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: 'overview', label: 'Overview', icon: LayoutGrid },
  { id: 'modules', label: 'Modules', icon: BarChart3 },
  { id: 'funnel', label: 'Funnel', icon: GitBranch },
  { id: 'triggers', label: 'Triggers', icon: AlertTriangle },
  { id: 'live', label: 'Live feed', icon: Radio },
];

const TIMELINE_RANGES: Array<{ id: TimelineRange; label: string }> = [
  { id: 'today', label: 'Today' },
  { id: 'week', label: 'This week' },
  { id: 'month', label: 'Month' },
  { id: 'year', label: 'Year' },
];

const MODULE_LABELS: Record<string, string> = {
  jobs: 'Jobs',
  candidates: 'Candidates',
  leads: 'Leads',
  clients: 'Clients',
  contacts: 'Contacts',
  interviews: 'Interviews',
  placements: 'Placements',
  pipeline: 'Pipeline',
  matches: 'Matches',
  reports: 'Reports',
  calendar: 'Calendar',
  inbox: 'Inbox',
  team: 'Team',
  billing: 'Billing',
  settings: 'Settings',
  ai: 'AI',
  recruitment: 'Recruitment',
  dashboard: 'Dashboard',
  other: 'Other',
};

const EVENT_TONE: Record<string, string> = {
  login: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
  logout: 'bg-slate-100 text-slate-600 ring-slate-200',
  session_end: 'bg-slate-100 text-slate-600 ring-slate-200',
  page_visit: 'bg-sky-50 text-sky-700 ring-sky-100',
  search: 'bg-violet-50 text-violet-700 ring-violet-100',
  workflow_step: 'bg-indigo-50 text-indigo-700 ring-indigo-100',
  time_slice: 'bg-slate-50 text-slate-500 ring-slate-200',
};

function formatDuration(ms: number) {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return `${totalSec}s`;
}

function formatWhen(iso: string | null | undefined) {
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

function formatTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

function dayKey(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'Unknown';
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

function rangeSuffix(range: TimelineRange) {
  if (range === 'today') return 'today';
  if (range === 'month') return '30d';
  if (range === 'year') return 'year';
  return '7d';
}

function rangeTitle(range: TimelineRange) {
  return TIMELINE_RANGES.find((r) => r.id === range)?.label || 'This week';
}

function healthTone(score: number) {
  if (score >= 75) return { ring: '#10b981', text: 'text-emerald-700', bg: 'from-emerald-50 to-white', label: 'Healthy' };
  if (score >= 50) return { ring: '#f59e0b', text: 'text-amber-700', bg: 'from-amber-50 to-white', label: 'Watch' };
  return { ring: '#f43f5e', text: 'text-rose-700', bg: 'from-rose-50 to-white', label: 'At risk' };
}

function eventLabel(type: string) {
  return String(type || 'event').replace(/_/g, ' ');
}

function isHqNoise(ev: FeedEvent) {
  const path = String(ev.path || '').toLowerCase();
  return path === '/hq' || path.startsWith('/hq?') || path.startsWith('/hq/');
}

function collapseFeed(feed: FeedEvent[]) {
  const meaningful = feed.filter((ev) => !isHqNoise(ev));
  const source = meaningful.length ? meaningful : feed;
  const out: Array<FeedEvent & { count?: number }> = [];

  for (const ev of source) {
    const last = out[out.length - 1];
    const sameBurst =
      last &&
      last.type === ev.type &&
      last.category === ev.category &&
      last.path === ev.path &&
      (ev.type === 'time_slice' || ev.type === 'page_visit') &&
      Math.abs(Date.parse(last.at) - Date.parse(ev.at)) < 8 * 60 * 1000;
    if (sameBurst && last) {
      last.count = (last.count || 1) + 1;
      continue;
    }
    out.push({ ...ev, count: 1 });
  }

  return out.slice(0, 28);
}

function groupByDay(events: Array<FeedEvent & { count?: number }>) {
  const map = new Map<string, Array<FeedEvent & { count?: number }>>();
  for (const ev of events) {
    const key = dayKey(ev.at);
    const list = map.get(key) || [];
    list.push(ev);
    map.set(key, list);
  }
  return [...map.entries()];
}

function HealthRing({ score }: { score: number }) {
  const safe = Math.max(0, Math.min(100, Number(score) || 0));
  const tone = healthTone(safe);
  const r = 28;
  const c = 2 * Math.PI * r;
  const offset = c - (safe / 100) * c;
  return (
    <div className={`relative overflow-hidden rounded-2xl border border-slate-200/80 bg-gradient-to-br ${tone.bg} p-4 shadow-sm`}>
      <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-slate-500">Health score</p>
      <div className="mt-2 flex items-center gap-4">
        <div className="relative h-[76px] w-[76px] shrink-0">
          <svg viewBox="0 0 72 72" className="h-full w-full -rotate-90">
            <circle cx="36" cy="36" r={r} fill="none" stroke="#e2e8f0" strokeWidth="8" />
            <circle
              cx="36"
              cy="36"
              r={r}
              fill="none"
              stroke={tone.ring}
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={c}
              strokeDashoffset={offset}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-lg font-bold tabular-nums text-slate-900">{safe}</span>
          </div>
        </div>
        <div>
          <p className={`text-sm font-bold ${tone.text}`}>{tone.label}</p>
          <p className="mt-0.5 text-xs text-slate-500">Tenant engagement across the selected timeline.</p>
        </div>
      </div>
    </div>
  );
}

function KpiCard({
  label,
  value,
  hint,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon: typeof Activity;
  accent: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-[0_8px_24px_-16px_rgba(15,23,42,0.25)]">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-bold uppercase tracking-[0.06em] text-slate-400">{label}</p>
        <span className={`inline-flex h-8 w-8 items-center justify-center rounded-xl ${accent}`}>
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <p className="mt-2 text-2xl font-bold tracking-tight tabular-nums text-slate-900">{value}</p>
      {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}

function EmptyState({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="flex min-h-[180px] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 px-6 text-center">
      <p className="text-sm font-semibold text-slate-700">{title}</p>
      <p className="mt-1 max-w-sm text-xs text-slate-500">{hint}</p>
    </div>
  );
}

function SectionHeader({
  title,
  subtitle,
  badge,
}: {
  title: string;
  subtitle?: string;
  badge?: string;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
      <div>
        <h4 className="text-sm font-bold text-slate-900">{title}</h4>
        {subtitle ? <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p> : null}
      </div>
      {badge ? (
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">
          {badge}
        </span>
      ) : null}
    </div>
  );
}

function triggerTone(priority?: number) {
  const p = Number(priority || 0);
  if (p >= 80) return { badge: 'Critical', className: 'bg-rose-50 text-rose-700 ring-rose-100', bar: 'from-rose-500 to-orange-400' };
  if (p >= 60) return { badge: 'High', className: 'bg-amber-50 text-amber-700 ring-amber-100', bar: 'from-amber-500 to-orange-400' };
  if (p >= 40) return { badge: 'Watch', className: 'bg-sky-50 text-sky-700 ring-sky-100', bar: 'from-sky-500 to-indigo-400' };
  return { badge: 'Info', className: 'bg-slate-100 text-slate-600 ring-slate-200', bar: 'from-slate-400 to-slate-500' };
}

function moduleAccent(index: number) {
  const accents = [
    'from-sky-500 to-indigo-500',
    'from-violet-500 to-fuchsia-500',
    'from-emerald-500 to-teal-500',
    'from-amber-500 to-orange-500',
    'from-rose-500 to-pink-500',
    'from-cyan-500 to-blue-500',
  ];
  return accents[index % accents.length];
}

function OverviewTab({
  analysis,
  eng,
  range,
}: {
  analysis: HqTenantBehaviorAnalysis;
  eng: HqTenantBehaviorAnalysis['engagement'];
  range: TimelineRange;
}) {
  const suffix = rangeSuffix(range);
  const timeline = useMemo(() => collapseFeed(analysis.liveFeed || []), [analysis.liveFeed]);
  const grouped = useMemo(() => groupByDay(timeline), [timeline]);
  const workload = [
    ['Jobs', analysis.crmContext?.openJobs],
    ['Candidates', analysis.crmContext?.openCandidates],
    ['Leads', analysis.crmContext?.openLeads],
    ['Clients', analysis.crmContext?.openClients],
    ['Interviews', analysis.crmContext?.pendingInterviews],
    ['Placements', analysis.crmContext?.openPlacements],
    ['Pipeline', analysis.crmContext?.pipelineEntries],
    ['Tasks', analysis.crmContext?.pendingTasks],
    ['Team', analysis.crmContext?.teamMembers],
  ] as const;

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
      <div className="space-y-5">
        {analysis.dataSource === 'none' ? (
          <EmptyState
            title="No behaviour snapshots yet"
            hint="Activity appears after the tenant team uses Phase 2 CRM."
          />
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2">
          <HealthRing score={analysis.tenantHealthScore} />
          <div className="rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50/80 via-white to-sky-50/60 p-4 shadow-sm">
            <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.08em] text-indigo-500">
              <Sparkles className="h-3.5 w-3.5" />
              HQ analysis · {rangeTitle(range)}
            </p>
            {analysis.intelligenceSummary?.length ? (
              <ul className="mt-3 space-y-2.5">
                {analysis.intelligenceSummary.map((line, idx) => (
                  <li key={line} className="flex gap-2.5 text-sm text-slate-700">
                    <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-[10px] font-bold text-white">
                      {idx + 1}
                    </span>
                    <span className="leading-5">{line}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-slate-500">No intelligence summary for this range yet.</p>
            )}
          </div>
        </div>

        <section>
          <div className="mb-3 flex items-end justify-between gap-2">
            <div>
              <h4 className="text-sm font-bold text-slate-900">Platform engagement</h4>
              <p className="text-xs text-slate-500">{rangeTitle(range)} · tenant-wide, not per user</p>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <KpiCard
              label={`Logins (${suffix})`}
              value={eng?.totalLogins7d ?? 0}
              hint={`${eng?.totalLogouts7d ?? 0} logouts`}
              icon={LogIn}
              accent="bg-emerald-50 text-emerald-600"
            />
            <KpiCard
              label={`Sessions (${suffix})`}
              value={eng?.totalSessions7d ?? 0}
              hint={`${eng?.activeUsers7d ?? 0} active users`}
              icon={Activity}
              accent="bg-sky-50 text-sky-600"
            />
            <KpiCard
              label="Time on platform"
              value={formatDuration(eng?.totalActiveMs7d ?? 0)}
              hint={range === 'today' ? undefined : `Today ${formatDuration(eng?.totalActiveMsToday ?? 0)}`}
              icon={Clock3}
              accent="bg-violet-50 text-violet-600"
            />
            <KpiCard
              label="Online now"
              value={eng?.onlineNow ?? 0}
              hint={`Last activity ${formatWhen(eng?.lastActivityAt)}`}
              icon={Radio}
              accent="bg-amber-50 text-amber-600"
            />
            <KpiCard
              label={`CRM actions (${suffix})`}
              value={eng?.totalActions7d ?? 0}
              hint={`${eng?.totalApiMutations7d ?? 0} API mutations`}
              icon={GitBranch}
              accent="bg-indigo-50 text-indigo-600"
            />
            <KpiCard
              label={`Searches (${suffix})`}
              value={eng?.totalSearches7d ?? 0}
              hint={`${eng?.totalEntityViews7d ?? 0} entity views`}
              icon={Search}
              accent="bg-rose-50 text-rose-600"
            />
          </div>
        </section>

        {analysis.crmContext ? (
          <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h4 className="text-sm font-bold text-slate-900">Live CRM workload</h4>
              <span className="text-[11px] font-medium text-slate-400">Current snapshot</span>
            </div>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
              {workload.map(([label, value]) => {
                const n = Number(value ?? 0);
                return (
                  <div
                    key={label}
                    className={`rounded-xl px-3 py-2.5 ${
                      n > 0 ? 'bg-sky-50 ring-1 ring-sky-100' : 'bg-slate-50'
                    }`}
                  >
                    <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
                    <p className={`mt-0.5 text-lg font-bold tabular-nums ${n > 0 ? 'text-sky-800' : 'text-slate-400'}`}>
                      {n}
                    </p>
                  </div>
                );
              })}
            </div>
          </section>
        ) : null}

        {analysis.insights?.length ? (
          <section>
            <h4 className="mb-3 text-sm font-bold text-slate-900">Insights</h4>
            <div className="grid gap-3 md:grid-cols-2">
              {analysis.insights.map((insight) => (
                <div key={insight.id} className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
                  <p className="text-sm font-semibold text-slate-900">{insight.label}</p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">{insight.summary}</p>
                </div>
              ))}
            </div>
          </section>
        ) : null}
      </div>

      <aside className="min-h-[420px] rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm xl:sticky xl:top-0">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div>
            <h4 className="text-sm font-bold text-slate-900">Activity timeline</h4>
            <p className="text-xs text-slate-500">{rangeTitle(range)} · HQ noise collapsed</p>
          </div>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-500">
            {timeline.length} events
          </span>
        </div>
        {grouped.length === 0 ? (
          <EmptyState title="No timeline events" hint="Meaningful CRM activity will appear here for the selected range." />
        ) : (
          <div className="max-h-[640px] space-y-5 overflow-y-auto pr-1">
            {grouped.map(([day, events]) => (
              <div key={day}>
                <p className="sticky top-0 z-[1] mb-2 bg-white/95 py-1 text-[11px] font-bold uppercase tracking-wider text-slate-400 backdrop-blur">
                  {day}
                </p>
                <ol className="relative space-y-2 border-l border-slate-200 pl-4">
                  {events.map((ev, idx) => (
                    <li key={`${ev.at}-${idx}`} className="relative">
                      <span className="absolute -left-[1.3rem] top-2.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-sky-500 shadow-sm" />
                      <div className="rounded-xl border border-slate-100 bg-slate-50/70 px-3 py-2.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[11px] font-semibold tabular-nums text-slate-500">
                            {formatTime(ev.at)}
                          </span>
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold capitalize ring-1 ${
                              EVENT_TONE[ev.type] || 'bg-slate-50 text-slate-600 ring-slate-200'
                            }`}
                          >
                            {eventLabel(ev.type)}
                            {(ev.count || 1) > 1 ? ` ×${ev.count}` : ''}
                          </span>
                          <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-600 ring-1 ring-slate-200">
                            {MODULE_LABELS[ev.category] || ev.category}
                          </span>
                        </div>
                        {ev.path ? <p className="mt-1 truncate font-mono text-[11px] text-slate-400">{ev.path}</p> : null}
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
        )}
      </aside>
    </div>
  );
}

function ModulesTab({
  analysis,
  range,
}: {
  analysis: HqTenantBehaviorAnalysis;
  range: TimelineRange;
}) {
  const rows = analysis.moduleMatrix || [];
  if (!rows.length) {
    return <EmptyState title="No module activity yet" hint="Module visits and time will appear after CRM usage." />;
  }

  const totalVisits = rows.reduce((sum, row) => sum + (row.visits || 0), 0);
  const totalActions = rows.reduce((sum, row) => sum + (row.actions || 0), 0);
  const totalTime = rows.reduce((sum, row) => sum + (row.activeMs || 0), 0);
  const maxVisits = Math.max(1, ...rows.map((row) => row.visits || 0));
  const maxTime = Math.max(1, ...rows.map((row) => row.activeMs || 0));
  const maxActions = Math.max(1, ...rows.map((row) => row.actions || 0));
  const top = rows[0];
  const actionRows = Object.entries(analysis.actionBreakdown || {})
    .filter(([, n]) => (n || 0) > 0)
    .sort((a, b) => (b[1] || 0) - (a[1] || 0));
  const maxActionCount = Math.max(1, ...actionRows.map(([, n]) => Number(n || 0)));

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Modules used" value={rows.length} hint={rangeTitle(range)} icon={LayoutGrid} accent="bg-sky-50 text-sky-600" />
        <KpiCard label="Total visits" value={totalVisits} hint={top ? `Top: ${top.label}` : undefined} icon={MousePointerClick} accent="bg-indigo-50 text-indigo-600" />
        <KpiCard label="Total actions" value={totalActions} hint="Across all modules" icon={Zap} accent="bg-amber-50 text-amber-600" />
        <KpiCard label="Time in CRM" value={formatDuration(totalTime)} hint="Active time" icon={Clock3} accent="bg-violet-50 text-violet-600" />
      </div>

      <section>
        <SectionHeader title="Module mix" subtitle="Ranked by visits, time, and conversion" badge={`${rows.length} modules`} />
        <div className="grid gap-3 lg:grid-cols-2">
          {rows.map((row, idx) => (
            <div key={row.category} className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_8px_24px_-16px_rgba(15,23,42,0.25)]">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className={`inline-flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br text-xs font-bold text-white ${moduleAccent(idx)}`}>
                    {idx + 1}
                  </span>
                  <div>
                    <p className="text-sm font-bold text-slate-900">{row.label}</p>
                    <p className="text-xs text-slate-500">{row.conversionRate}% conversion</p>
                  </div>
                </div>
                <span className="rounded-full bg-slate-50 px-2.5 py-1 text-xs font-bold tabular-nums text-slate-700 ring-1 ring-slate-200">
                  {row.visits} visits
                </span>
              </div>
              <div className="mt-4 space-y-2.5">
                {[
                  ['Visits', row.visits, maxVisits, 'from-sky-500 to-indigo-500'],
                  ['Time', row.activeMs, maxTime, 'from-violet-500 to-fuchsia-500'],
                  ['Actions', row.actions, maxActions, 'from-emerald-500 to-teal-500'],
                ].map(([label, value, max, bar]) => (
                  <div key={String(label)}>
                    <div className="mb-1 flex items-center justify-between text-[11px]">
                      <span className="font-semibold uppercase tracking-wide text-slate-400">{label}</span>
                      <span className="font-bold tabular-nums text-slate-700">
                        {label === 'Time' ? formatDuration(Number(value)) : value}
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className={`h-full rounded-full bg-gradient-to-r ${bar}`}
                        style={{ width: `${Math.min(100, (Number(value) / Number(max)) * 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {actionRows.length ? (
        <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
          <SectionHeader title="Action types" subtitle="What the tenant actually did in CRM" />
          <div className="space-y-3">
            {actionRows.map(([key, count]) => (
              <div key={key} className="flex items-center gap-3">
                <span className="w-36 shrink-0 truncate text-sm font-medium capitalize text-slate-700">
                  {key.replace(/_/g, ' ')}
                </span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-sky-500"
                    style={{ width: `${Math.min(100, (Number(count) / maxActionCount) * 100)}%` }}
                  />
                </div>
                <span className="w-10 shrink-0 text-right text-sm font-bold tabular-nums text-slate-800">{count}</span>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function FunnelTab({
  analysis,
  range,
}: {
  analysis: HqTenantBehaviorAnalysis;
  range: TimelineRange;
}) {
  const steps = analysis.funnelSteps || [];
  if (!steps.length) {
    return <EmptyState title="No funnel data yet" hint="Funnel steps fill in as the tenant moves through CRM modules." />;
  }

  const max = Math.max(1, ...steps.map((step) => step.visits || 0));
  const first = steps[0]?.visits || 0;
  const last = steps[steps.length - 1]?.visits || 0;
  const overall = first > 0 ? Math.round((last / first) * 100) : 0;

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-3">
        <KpiCard label="Funnel start" value={first} hint={steps[0]?.label || 'First step'} icon={GitBranch} accent="bg-sky-50 text-sky-600" />
        <KpiCard label="Funnel end" value={last} hint={steps[steps.length - 1]?.label || 'Last step'} icon={Sparkles} accent="bg-indigo-50 text-indigo-600" />
        <KpiCard label="Overall conversion" value={`${overall}%`} hint={rangeTitle(range)} icon={TrendingUp} accent="bg-emerald-50 text-emerald-600" />
      </div>

      <section className="rounded-2xl border border-slate-200/80 bg-gradient-to-br from-slate-50 via-white to-indigo-50/40 p-5 shadow-sm">
        <SectionHeader title="Recruitment / CRM funnel" subtitle="Drop-off between each stage" badge={`${steps.length} stages`} />
        <div className="space-y-2">
          {steps.map((step, idx) => {
            const prev = idx === 0 ? step.visits : steps[idx - 1]?.visits || 0;
            const drop = idx === 0 || prev <= 0 ? null : Math.round(((prev - step.visits) / prev) * 100);
            const width = Math.max(18, Math.min(100, (step.visits / max) * 100));
            return (
              <div key={step.category}>
                {drop != null ? (
                  <div className="mb-1 flex items-center justify-center gap-1 text-[11px] font-semibold text-rose-500">
                    <ArrowDownRight className="h-3.5 w-3.5" />
                    {drop}% drop-off
                  </div>
                ) : null}
                <div className="mx-auto" style={{ width: `${width}%`, minWidth: '42%' }}>
                  <div className="flex items-center justify-between gap-3 rounded-2xl bg-gradient-to-r from-sky-600 via-indigo-600 to-violet-600 px-4 py-3 text-white shadow-md">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/20 text-[11px] font-bold">
                        {idx + 1}
                      </span>
                      <span className="truncate text-sm font-semibold">{step.label}</span>
                    </div>
                    <span className="text-sm font-bold tabular-nums">{step.visits}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function TriggersTab({
  analysis,
  range,
}: {
  analysis: HqTenantBehaviorAnalysis;
  range: TimelineRange;
}) {
  const triggers = analysis.topTriggers || [];
  if (!triggers.length) {
    return <EmptyState title="No triggers detected" hint="Risk and engagement signals appear here when behaviour patterns emerge." />;
  }

  const critical = triggers.filter((t) => Number(t.priority || 0) >= 80).length;
  const watch = triggers.filter((t) => Number(t.priority || 0) >= 40 && Number(t.priority || 0) < 80).length;

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-3">
        <KpiCard label="Signals" value={triggers.length} hint={rangeTitle(range)} icon={AlertTriangle} accent="bg-amber-50 text-amber-600" />
        <KpiCard label="Critical" value={critical} hint="Priority 80+" icon={Zap} accent="bg-rose-50 text-rose-600" />
        <KpiCard label="Watch" value={watch} hint="Needs attention" icon={Lightbulb} accent="bg-sky-50 text-sky-600" />
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        {triggers.map((trigger) => {
          const tone = triggerTone(trigger.priority);
          return (
            <article key={trigger.id} className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_8px_24px_-16px_rgba(15,23,42,0.28)]">
              <div className={`h-1.5 bg-gradient-to-r ${tone.bar}`} />
              <div className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-slate-900">{trigger.title}</p>
                    <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                      {trigger.flag.replace(/_/g, ' ')}
                    </p>
                  </div>
                  <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ring-1 ${tone.className}`}>
                    {tone.badge}
                  </span>
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-600">{trigger.reason}</p>
                {trigger.evidence?.length ? (
                  <div className="mt-3 rounded-xl bg-slate-50 px-3 py-2">
                    <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">Evidence</p>
                    <ul className="space-y-1 text-xs text-slate-600">
                      {trigger.evidence.map((line) => (
                        <li key={line} className="flex gap-2">
                          <span className="text-slate-300">•</span>
                          <span>{line}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                <div className="mt-3 flex items-start gap-2 rounded-xl bg-indigo-50 px-3 py-2.5">
                  <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-indigo-600" />
                  <p className="text-xs font-medium leading-5 text-indigo-800">{trigger.recommendedAction}</p>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

function LiveTab({
  analysis,
  range,
}: {
  analysis: HqTenantBehaviorAnalysis;
  range: TimelineRange;
}) {
  const events = collapseFeed(analysis.liveFeed || []);
  const grouped = groupByDay(events);
  if (!events.length) {
    return <EmptyState title="Waiting for live events" hint="CRM activity from this tenant will stream into the live feed." />;
  }

  const typeCounts = events.reduce<Record<string, number>>((acc, ev) => {
    acc[ev.type] = (acc[ev.type] || 0) + (ev.count || 1);
    return acc;
  }, {});
  const topTypes = Object.entries(typeCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-3">
        <KpiCard label="Live events" value={events.length} hint={rangeTitle(range)} icon={Radio} accent="bg-emerald-50 text-emerald-600" />
        <KpiCard label="Event types" value={topTypes.length} hint="Collapsed HQ noise" icon={Activity} accent="bg-sky-50 text-sky-600" />
        <KpiCard
          label="Latest"
          value={formatTime(events[0]?.at || '')}
          hint={MODULE_LABELS[events[0]?.category] || events[0]?.category || '—'}
          icon={Clock3}
          accent="bg-indigo-50 text-indigo-600"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {topTypes.map(([type, count]) => (
          <span
            key={type}
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold capitalize ring-1 ${
              EVENT_TONE[type] || 'bg-slate-50 text-slate-600 ring-slate-200'
            }`}
          >
            {eventLabel(type)}
            <span className="tabular-nums opacity-80">{count}</span>
          </span>
        ))}
      </div>

      <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
        <SectionHeader title="Live activity stream" subtitle="Grouped by day · HQ console noise hidden" badge="Live" />
        <div className="space-y-5">
          {grouped.map(([day, dayEvents]) => (
            <div key={day}>
              <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">{day}</p>
              <div className="space-y-2">
                {dayEvents.map((ev, idx) => (
                  <div
                    key={`${ev.at}-${idx}`}
                    className="flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50/70 px-3 py-3"
                  >
                    <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white ring-1 ring-slate-200">
                      <Radio className="h-4 w-4 text-emerald-500" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-bold tabular-nums text-slate-500">{formatTime(ev.at)}</span>
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold capitalize ring-1 ${
                            EVENT_TONE[ev.type] || 'bg-slate-50 text-slate-600 ring-slate-200'
                          }`}
                        >
                          {eventLabel(ev.type)}
                          {(ev.count || 1) > 1 ? ` ×${ev.count}` : ''}
                        </span>
                        <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-600 ring-1 ring-slate-200">
                          {MODULE_LABELS[ev.category] || ev.category}
                        </span>
                      </div>
                      {ev.path ? <p className="mt-1 truncate font-mono text-[11px] text-slate-400">{ev.path}</p> : null}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

/** Embeddable behaviour analytics (for tenant detail modal Analytics tab). */
export function HqTenantBehaviorAnalyticsPanel({ tenant }: { tenant: HqTenantRow }) {
  const [analysis, setAnalysis] = useState<HqTenantBehaviorAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<DrawerTab>('overview');
  const [range, setRange] = useState<TimelineRange>('week');

  const load = useCallback(async () => {
    if (!tenant.tenantDbName) {
      setError('Tenant has no database name');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await apiHqGetTenantBehavior(tenant.tenantDbName, range);
      setAnalysis(res.data || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tenant behaviour');
      setAnalysis(null);
    } finally {
      setLoading(false);
    }
  }, [tenant.tenantDbName, range]);

  useEffect(() => {
    setTab('overview');
    setRange('week');
  }, [tenant.id]);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 12_000);
    return () => window.clearInterval(timer);
  }, [load]);

  const eng = analysis?.engagement;
  const dataSourceLabel =
    analysis?.dataSource === 'behavior_engine'
      ? 'Live behaviour engine'
      : analysis?.dataSource === 'sessions_fallback'
        ? 'Session fallback'
        : 'No behaviour data yet';

  return (
    <div className="-mx-1 flex min-h-0 flex-col gap-4">
      <div className="rounded-2xl border border-slate-200/80 bg-gradient-to-r from-slate-50 via-white to-indigo-50/40 p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.08em] text-slate-500">
              <Brain className="h-3.5 w-3.5 text-indigo-600" />
              Behaviour analytics
            </p>
            <p className="mt-1 text-sm text-slate-600">
              {dataSourceLabel}
              {tenant.tenantDbName ? (
                <>
                  {' '}
                  · <span className="font-mono text-xs text-slate-500">{tenant.tenantDbName}</span>
                </>
              ) : null}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-emerald-700 ring-1 ring-emerald-100">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Live
            </span>
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading}
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
              title="Refresh"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div
            role="tablist"
            aria-label="Analytics sections"
            className="inline-flex flex-wrap gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm"
          >
            {DRAWER_TABS.map(({ id, label, icon: Icon }) => {
              const active = tab === id;
              return (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setTab(id)}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                    active ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </button>
              );
            })}
          </div>
          <div
            role="tablist"
            aria-label="Analytics timeline"
            className="inline-flex flex-wrap gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm"
          >
            {TIMELINE_RANGES.map((r) => {
              const active = range === r.id;
              return (
                <button
                  key={r.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setRange(r.id)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                    active ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {r.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="min-h-[280px]">
        {loading && !analysis ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</div>
        ) : analysis ? (
          <>
            {tab === 'overview' ? <OverviewTab analysis={analysis} eng={eng} range={range} /> : null}
            {tab === 'modules' ? <ModulesTab analysis={analysis} range={range} /> : null}
            {tab === 'funnel' ? <FunnelTab analysis={analysis} range={range} /> : null}
            {tab === 'triggers' ? <TriggersTab analysis={analysis} range={range} /> : null}
            {tab === 'live' ? <LiveTab analysis={analysis} range={range} /> : null}
          </>
        ) : (
          <EmptyState title="No behaviour data" hint="This tenant has not synced CRM behaviour yet." />
        )}
      </div>

      {analysis?.capturedAt ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-[11px] text-slate-500">
          <span>Showing {rangeTitle(range).toLowerCase()}</span>
          <span>
            Synced {new Date(analysis.capturedAt).toLocaleString()}
            {eng?.lastActivityAt ? ` · Last activity ${formatWhen(eng.lastActivityAt)}` : ''}
          </span>
        </div>
      ) : null}
    </div>
  );
}

export function HqTenantBehaviorDrawer({
  tenant,
  onClose,
}: {
  tenant: HqTenantRow;
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!mounted) return null;

  const drawer = (
    <div className="fixed inset-0 z-[120] flex">
      <button type="button" className="absolute inset-0 bg-slate-900/45" onClick={onClose} aria-label="Close drawer" />
      <aside className="relative ml-auto flex h-full w-full max-w-5xl flex-col bg-[#f8fafc] shadow-2xl">
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-200 bg-white px-5 py-4">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-slate-500">
              <Brain className="h-3.5 w-3.5 text-sky-600" />
              Tenant behaviour analytics
            </p>
            <h2 className="mt-1 truncate text-xl font-semibold text-slate-900">{tenant.name}</h2>
            <p className="mt-1 text-sm text-slate-600">
              {tenant.email} · <span className="font-mono text-slate-800">{tenant.tenantDbName}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
          <HqTenantBehaviorAnalyticsPanel tenant={tenant} />
        </div>
      </aside>
    </div>
  );

  return createPortal(drawer, document.body);
}

/** @deprecated use HqTenantBehaviorAnalyticsPanel */
export const HqTenantBehaviorPanel = HqTenantBehaviorAnalyticsPanel;
