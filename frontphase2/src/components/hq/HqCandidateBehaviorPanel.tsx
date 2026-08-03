'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  Briefcase,
  Clock3,
  Lightbulb,
  Loader2,
  LogIn,
  MonitorSmartphone,
  MousePointerClick,
  RefreshCw,
  Send,
  X,
} from 'lucide-react';
import {
  apiHqGetCandidateBehavior,
  type HqCandidateBehaviorAnalysis,
  type HqCandidateBehaviorRollup,
  type HqPortalCandidateRow,
} from '@/lib/api';

const CATEGORY_LABELS: Record<string, string> = {
  jobs: 'Jobs',
  lms: 'LMS',
  courses: 'Courses',
  premium: 'Premium services',
  community: 'Community',
  profile: 'Profile',
  applications: 'Applications',
  interview_prep: 'Interview prep',
  ai_cv: 'AI CV',
  events: 'Events',
  dashboard: 'Dashboard',
  other: 'Other',
};

const RANGES = [
  { id: 'week', label: '7 days' },
  { id: 'today', label: 'Today' },
  { id: 'month', label: '30 days' },
  { id: 'all', label: 'All time' },
] as const;

function categoryLabel(cat: string) {
  return CATEGORY_LABELS[cat] || cat;
}

function formatDuration(ms: number) {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function severityStyles(severity: string) {
  if (severity === 'action') return 'border-amber-300 bg-amber-50 text-amber-950';
  if (severity === 'watch') return 'border-sky-200 bg-sky-50 text-sky-950';
  return 'border-slate-200 bg-slate-50 text-slate-800';
}

function Metric({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon: typeof Activity;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-500">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <div className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">{value}</div>
      {hint ? <p className="mt-0.5 text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}

function BehaviorBody({
  analysis,
  rollup,
}: {
  analysis: HqCandidateBehaviorAnalysis;
  rollup: HqCandidateBehaviorRollup | null;
}) {
  const snap = rollup?.profileSnapshot;
  const db = analysis.dbSummary;

  const categoryRows = useMemo(() => {
    if (!rollup?.pageVisitsByCategory) return [];
    return Object.entries(rollup.pageVisitsByCategory)
      .map(([category, count]) => ({ category, count: count || 0 }))
      .sort((a, b) => b.count - a.count);
  }, [rollup]);

  const timeRows = useMemo(() => {
    if (!rollup?.activeMsByCategory) return [];
    return Object.entries(rollup.activeMsByCategory)
      .map(([category, ms]) => ({ category, ms: ms || 0 }))
      .filter((row) => row.ms > 0)
      .sort((a, b) => b.ms - a.ms);
  }, [rollup]);

  const firstOpenRows = useMemo(() => {
    if (!rollup?.firstOpenBreakdown) return [];
    return Object.entries(rollup.firstOpenBreakdown)
      .map(([category, count]) => ({ category, count: count || 0 }))
      .sort((a, b) => b.count - a.count);
  }, [rollup]);

  const logins = rollup?.logins ?? db.logins;
  const visits = rollup?.visits ?? '—';
  const applies = rollup?.applies ?? db.applies;
  const activeMs = rollup?.activeMs ?? db.activeMs;

  return (
    <div className="space-y-8">
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <Metric
          icon={LogIn}
          label="Logins / sessions"
          value={logins}
          hint={`${rollup?.sessionCount ?? db.sessionCount} tracked sessions`}
        />
        <Metric
          icon={Activity}
          label="Page visits"
          value={visits}
          hint={rollup?.daysActive != null ? `${rollup.daysActive} active days` : undefined}
        />
        <Metric
          icon={MousePointerClick}
          label="Job card clicks"
          value={rollup?.jobCardClicks ?? '—'}
        />
        <Metric
          icon={Send}
          label="Applies tracked"
          value={applies}
          hint={
            snap || analysis.applicationStats.total
              ? `${snap?.applicationsTotal ?? analysis.applicationStats.total} apps in portal · ${snap?.rejectionsTotal ?? analysis.applicationStats.rejections} rejections`
              : undefined
          }
        />
        <Metric
          icon={Clock3}
          label="Time spent"
          value={formatDuration(activeMs || 0)}
          hint={
            rollup?.avgActiveMsPerDay != null
              ? `Avg ${formatDuration(rollup.avgActiveMsPerDay)} / active day`
              : undefined
          }
        />
        <Metric
          icon={Briefcase}
          label="Most opened first"
          value={rollup?.topFirstOpen ? categoryLabel(rollup.topFirstOpen) : '—'}
          hint="First meaningful page each day"
        />
        <Metric
          icon={Lightbulb}
          label="Skills (profile)"
          value={snap?.skillsCount ?? '—'}
          hint={
            snap?.cvScore != null
              ? `CV ${Math.round(snap.cvScore)}% · profile ${snap.profileCompleteness != null ? `${Math.round(snap.profileCompleteness)}%` : '—'}`
              : 'Synced from Phase 1 tracker'
          }
        />
        <Metric
          icon={MonitorSmartphone}
          label="Range"
          value={
            rollup?.fromDate && rollup?.toDate
              ? `${rollup.fromDate} → ${rollup.toDate}`
              : 'Last 7 days'
          }
        />
      </section>

      {Array.isArray(analysis.triggers) && analysis.triggers.length > 0 ? (
        <section>
          <h3 className="mb-3 text-lg font-semibold text-slate-900">HQ follow-up triggers</h3>
          <ul className="space-y-3">
            {analysis.triggers.map((trigger) => (
              <li key={trigger.id} className="rounded-xl border border-indigo-200 bg-indigo-50/60 px-4 py-3">
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="font-semibold text-indigo-950">{trigger.title}</span>
                  <span className="text-xs uppercase text-indigo-700/80">{trigger.flag}</span>
                </div>
                <p className="mt-1 text-sm text-indigo-900/90">{trigger.reason}</p>
                <p className="mt-2 text-xs font-medium text-indigo-800">{trigger.recommendedAction}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {rollup?.insights?.length ? (
        <section>
          <h3 className="mb-3 text-lg font-semibold text-slate-900">Behaviour insights</h3>
          <ul className="space-y-3">
            {rollup.insights.map((insight) => (
              <li
                key={insight.id}
                className={`rounded-xl border px-4 py-3 ${severityStyles(insight.severity)}`}
              >
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="font-semibold">{insight.label}</span>
                  <span className="text-xs uppercase opacity-70">{insight.severity}</span>
                </div>
                <p className="mt-1 text-sm">{insight.summary}</p>
                <ul className="mt-2 flex flex-wrap gap-2">
                  {insight.evidence.map((e) => (
                    <li key={e} className="rounded-md bg-white/70 px-2 py-0.5 text-xs">
                      {e}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <section>
          <h3 className="mb-3 text-lg font-semibold text-slate-900">Visits by area</h3>
          {categoryRows.length === 0 ? (
            <p className="text-sm text-slate-500">No visit breakdown yet.</p>
          ) : (
            <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
              {categoryRows.map((row) => (
                <li key={row.category} className="flex items-center justify-between px-4 py-2.5 text-sm">
                  <span className="text-slate-700">{categoryLabel(row.category)}</span>
                  <span className="font-mono tabular-nums text-slate-900">{row.count}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h3 className="mb-3 text-lg font-semibold text-slate-900">Time spent by area</h3>
          {timeRows.length === 0 ? (
            <p className="text-sm text-slate-500">No time attribution yet.</p>
          ) : (
            <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
              {timeRows.map((row) => (
                <li key={row.category} className="flex items-center justify-between px-4 py-2.5 text-sm">
                  <span className="text-slate-700">{categoryLabel(row.category)}</span>
                  <span className="font-mono tabular-nums text-slate-900">{formatDuration(row.ms)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section>
          <h3 className="mb-3 text-lg font-semibold text-slate-900">First open of day</h3>
          {firstOpenRows.length === 0 ? (
            <p className="text-sm text-slate-500">No first-open data yet.</p>
          ) : (
            <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
              {firstOpenRows.map((row) => (
                <li key={row.category} className="flex items-center justify-between px-4 py-2.5 text-sm">
                  <span className="text-slate-700">{categoryLabel(row.category)}</span>
                  <span className="font-mono tabular-nums text-slate-900">
                    {row.count} day{row.count === 1 ? '' : 's'}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h3 className="mb-3 text-lg font-semibold text-slate-900">Suggestion preferences</h3>
          {rollup?.behaviourSignals ? (
            <div className="space-y-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
              <p>
                <span className="text-slate-500">Prefer: </span>
                {(rollup.behaviourSignals.preferSlotIds || []).join(', ') || '—'}
              </p>
              <p>
                <span className="text-slate-500">Deprioritize: </span>
                {(rollup.behaviourSignals.deprioritizeSlotIds || []).join(', ') || '—'}
              </p>
            </div>
          ) : (
            <p className="text-sm text-slate-500">Collecting behaviour…</p>
          )}
        </section>
      </div>

      <section>
        <h3 className="mb-3 text-lg font-semibold text-slate-900">Full activity timeline</h3>
        {!rollup?.recentEvents?.length ? (
          <p className="text-sm text-slate-500">No tracked events yet for this candidate.</p>
        ) : (
          <ul className="max-h-80 divide-y divide-slate-100 overflow-y-auto rounded-xl border border-slate-200 bg-white">
            {rollup.recentEvents.map((ev) => (
              <li key={ev.id} className="px-4 py-2.5 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium text-slate-800">
                    {ev.type.replace(/_/g, ' ')} · {categoryLabel(ev.category)}
                  </span>
                  <span className="text-xs tabular-nums text-slate-500">
                    {new Date(ev.at).toLocaleString()}
                  </span>
                </div>
                <p className="truncate text-xs text-slate-500">{ev.path || '—'}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h3 className="mb-3 text-lg font-semibold text-slate-900">Recent portal sessions</h3>
        {(rollup?.recentSessions?.length || analysis.portalSessions.length) ? (
          <ul className="space-y-2">
            {(rollup?.recentSessions?.length
              ? rollup.recentSessions.map((s) => ({
                  id: s.id,
                  startedAt: s.startedAt,
                  endedAt: s.endedAt,
                  durationMs: s.durationMs,
                  pageCount: s.pageCount,
                  deviceType: s.deviceType,
                  browser: s.browser,
                  operatingSystem: s.operatingSystem,
                  city: s.city,
                  country: s.country,
                  firstPath: s.firstPath,
                  lastPath: s.lastPath,
                }))
              : analysis.portalSessions.map((s) => ({
                  id: s.id,
                  startedAt: s.startedAt,
                  endedAt: s.endedAt,
                  durationMs: s.durationMs,
                  pageCount: 0,
                  deviceType: s.deviceType,
                  browser: s.browser,
                  operatingSystem: s.operatingSystem,
                  city: s.city,
                  country: s.country,
                  firstPath: undefined,
                  lastPath: undefined,
                }))
            ).map((s) => (
              <li key={s.id} className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-mono text-xs text-slate-500">{s.id.slice(-8)}</span>
                  <span className="tabular-nums text-slate-700">
                    {formatDuration(s.durationMs)} · {s.pageCount || 0} pages
                  </span>
                </div>
                <p className="mt-1 text-slate-600">
                  Login: {new Date(s.startedAt).toLocaleString()}
                  {s.endedAt ? ` · Logout: ${new Date(s.endedAt).toLocaleString()}` : ' · active'}
                </p>
                <p className="mt-0.5 text-xs text-slate-500">
                  {[s.deviceType, s.browser, s.operatingSystem].filter(Boolean).join(' · ') || 'Device unknown'}
                  {[s.city, s.country].filter(Boolean).length
                    ? ` · ${[s.city, s.country].filter(Boolean).join(', ')}`
                    : ''}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-500">No portal login sessions recorded yet.</p>
        )}
      </section>

      {analysis.applications.length > 0 ? (
        <section>
          <h3 className="mb-3 text-lg font-semibold text-slate-900">Recent applications</h3>
          <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
            {analysis.applications.map((app) => (
              <li key={app.id} className="px-4 py-2.5 text-sm">
                <div className="font-medium text-slate-800">{app.jobTitle}</div>
                <div className="text-xs text-slate-500">
                  {app.company} · {app.status} · {new Date(app.createdAt).toLocaleDateString()}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

type HqCandidateBehaviorPanelProps = {
  candidate: HqPortalCandidateRow;
  onClose: () => void;
};

export function HqCandidateBehaviorPanel({ candidate, onClose }: HqCandidateBehaviorPanelProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<HqCandidateBehaviorAnalysis | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiHqGetCandidateBehavior(candidate.id);
      setAnalysis(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load behaviour analysis');
      setAnalysis(null);
    } finally {
      setLoading(false);
    }
  }, [candidate.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const rollup = analysis?.rollup7d ?? null;
  const dataSourceLabel =
    analysis?.dataSource === 'phase1_behavior_tracker'
      ? 'Phase 1 behaviour tracker (live)'
      : analysis?.dataSource === 'portal_db_sessions'
        ? 'Portal DB sessions only — candidate has not synced behaviour yet'
        : 'No behaviour data yet';

  return (
    <div className="fixed inset-0 z-[120] flex">
      <button type="button" className="absolute inset-0 bg-slate-900/45" onClick={onClose} aria-label="Close" />
      <aside className="relative ml-auto flex h-full w-full max-w-4xl flex-col bg-[#f8fafc] shadow-2xl">
        <header className="shrink-0 border-b border-slate-200 bg-white px-5 py-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
                Behaviour analysis · Phase 1 user-stats view
              </p>
              <h2 className="mt-1 truncate text-xl font-semibold text-slate-900">{candidate.name}</h2>
              <p className="mt-1 text-sm text-slate-600">
                {candidate.email || '—'} · <span className="font-mono text-slate-800">{candidate.id}</span>
              </p>
              <p className="mt-1 text-xs text-slate-500">{dataSourceLabel}</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={() => void load()}
                disabled={loading}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                title="Refresh"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
              <button
                type="button"
                onClick={onClose}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {RANGES.map((r) => (
              <span
                key={r.id}
                className={`rounded-full px-3 py-1 text-xs font-medium ${
                  r.id === 'week'
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-500'
                }`}
              >
                {r.label}
              </span>
            ))}
            {analysis?.capturedAt ? (
              <span className="text-xs text-slate-400">
                Synced {new Date(analysis.capturedAt).toLocaleString()}
              </span>
            ) : null}
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-6">
          {loading ? (
            <div className="flex justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
            </div>
          ) : error ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
              {error}
            </div>
          ) : analysis ? (
            <BehaviorBody analysis={analysis} rollup={rollup} />
          ) : (
            <p className="text-sm text-slate-600">No behaviour data available for this candidate.</p>
          )}
        </div>
      </aside>
    </div>
  );
}
