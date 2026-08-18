'use client';

import React, { useCallback, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Brain,
  ChevronRight,
  Circle,
  Clock3,
  GitBranch,
  Loader2,
  MousePointerClick,
  Radio,
  RefreshCw,
  Search,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react';
import { Ph2ModulePageLayout } from '@/components/layout/Ph2ModulePageLayout';
import { useTenantBehaviorLive } from '@/hooks/useTenantBehaviorLive';
import {
  categoryLabel,
  fetchTenantBehaviorByUser,
  formatDuration,
  PHASE2_TENANT_TRACKING_CATALOG,
  PHASE2_TRACKED_MODULES,
  type TenantBehaviorPayload,
  type TenantBehaviourTrigger,
  type TenantCrmSnapshot,
} from '@/lib/tenant-behavior-engine';

function flagStyles(flag: string) {
  if (flag === 'sales_follow_up') return 'bg-amber-100 text-amber-900 border-amber-200';
  if (flag === 'high_intent') return 'bg-emerald-100 text-emerald-900 border-emerald-200';
  if (flag === 'ops_assist') return 'bg-violet-100 text-violet-900 border-violet-200';
  if (flag === 'career_assist') return 'bg-sky-100 text-sky-900 border-sky-200';
  if (flag === 'user_nudge') return 'bg-indigo-100 text-indigo-900 border-indigo-200';
  return 'bg-slate-100 text-slate-800 border-slate-200';
}

function Metric({
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
  accent?: string;
}) {
  return (
    <div className={`rounded-xl border bg-white/90 px-4 py-3 shadow-sm ${accent || 'border-indigo-100/70'}`}>
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-500">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <div className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">{value}</div>
      {hint ? <p className="mt-0.5 text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}

function TriggerCard({ trigger }: { trigger: TenantBehaviourTrigger }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-semibold text-slate-900">
            {trigger.title && trigger.title !== 'undefined'
              ? trigger.title
              : String(trigger.id || trigger.flag || 'Signal').replace(/_/g, ' ')}
          </p>
          <p className="mt-1 text-sm text-slate-600">{trigger.reason}</p>
        </div>
        <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase ${flagStyles(trigger.flag)}`}>
          {trigger.flag.replace(/_/g, ' ')}
        </span>
      </div>
      {trigger.evidence?.length ? (
        <ul className="mt-3 space-y-1 text-xs text-slate-600">
          {trigger.evidence.map((line) => (
            <li key={line} className="flex gap-2">
              <span className="text-indigo-400">•</span>
              <span>{line}</span>
            </li>
          ))}
        </ul>
      ) : null}
      <p className="mt-3 text-xs font-medium text-indigo-700">{trigger.recommendedAction}</p>
    </div>
  );
}

function CrmContextPanel({ ctx }: { ctx: TenantCrmSnapshot }) {
  const items = [
    { label: 'Open jobs', value: ctx.openJobs ?? 0 },
    { label: 'Draft jobs', value: ctx.draftJobs ?? 0 },
    { label: 'Candidates', value: ctx.openCandidates ?? 0 },
    { label: 'Leads', value: ctx.openLeads ?? 0 },
    { label: 'Clients', value: ctx.openClients ?? 0 },
    { label: 'Contacts', value: ctx.openContacts ?? 0 },
    { label: 'Pipeline entries', value: ctx.pipelineEntries ?? 0 },
    { label: 'Matches', value: ctx.openMatches ?? 0 },
    { label: 'Interviews', value: ctx.pendingInterviews ?? 0 },
    { label: 'Placements', value: ctx.openPlacements ?? 0 },
    { label: 'Tasks', value: ctx.pendingTasks ?? 0 },
    { label: 'Team members', value: ctx.teamMembers ?? 0 },
  ];

  return (
    <div className="rounded-xl border border-emerald-100/80 bg-gradient-to-br from-emerald-50/50 to-white p-4">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800">
        <Radio className="h-4 w-4 text-emerald-500" />
        Live tenant CRM parameters
      </h3>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        {items.map((item) => (
          <div key={item.label} className="rounded-lg border border-emerald-100/60 bg-white/80 px-2.5 py-2">
            <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">{item.label}</p>
            <p className="text-lg font-semibold tabular-nums text-slate-900">{item.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function UserDetailPanel({ payload }: { payload: TenantBehaviorPayload }) {
  const rollup = payload.rollup7d || payload.rollupToday;
  if (!rollup) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-600">
        No rollup yet — user needs more CRM activity.
      </div>
    );
  }

  const today = payload.rollupToday;

  return (
    <div className="space-y-4 border-t border-indigo-100/60 bg-gradient-to-b from-indigo-50/30 to-white p-4 sm:p-5">
      {today ? (
        <p className="text-xs font-medium text-indigo-700">
          Today: {today.visits} visits · {today.actions} actions · {formatDuration(today.activeMs)} active
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <Metric label="Visits (7d)" value={rollup.visits} icon={Activity} />
        <Metric label="Actions" value={rollup.actions} hint={`${rollup.apiMutations} mutations`} icon={Zap} />
        <Metric label="Record views" value={rollup.entityViews} icon={MousePointerClick} />
        <Metric label="Searches" value={rollup.searches} icon={Search} />
        <Metric label="Workflow" value={`${rollup.workflowScore}/100`} icon={GitBranch} />
        <Metric label="Active time" value={formatDuration(rollup.activeMs)} icon={Clock3} />
      </div>

      {rollup.actionBreakdown && Object.keys(rollup.actionBreakdown).length ? (
        <div>
          <h4 className="mb-2 text-sm font-semibold text-slate-800">Action breakdown</h4>
          <div className="flex flex-wrap gap-2">
            {Object.entries(rollup.actionBreakdown)
              .filter(([, n]) => (n || 0) > 0)
              .sort((a, b) => (b[1] || 0) - (a[1] || 0))
              .map(([key, count]) => (
                <span key={key} className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium capitalize text-slate-700">
                  {key}: {count}
                </span>
              ))}
          </div>
        </div>
      ) : null}

      {rollup.funnelProgress && Object.keys(rollup.funnelProgress).length ? (
        <div>
          <h4 className="mb-2 text-sm font-semibold text-slate-800">Recruitment funnel (7d visits)</h4>
          <div className="flex flex-wrap gap-2">
            {['leads', 'clients', 'jobs', 'candidates', 'pipeline', 'interviews', 'placements'].map((cat) => (
              <span key={cat} className="rounded-lg border border-indigo-100 bg-indigo-50/60 px-2.5 py-1 text-xs font-medium text-indigo-900">
                {categoryLabel(cat)}: {rollup.funnelProgress?.[cat as keyof typeof rollup.funnelProgress] || 0}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {rollup.topEntities?.length ? (
        <div>
          <h4 className="mb-2 text-sm font-semibold text-slate-800">Focused records</h4>
          <div className="flex flex-wrap gap-2">
            {rollup.topEntities.slice(0, 8).map((entity) => (
              <span key={entity.key} className="rounded-full border border-violet-100 bg-violet-50/80 px-3 py-1 text-xs font-medium text-violet-900">
                {entity.label || entity.entityId}: {entity.views}v · {entity.clicks}c · {entity.actions}a
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {rollup.insights?.length ? (
        <div className="grid gap-2 lg:grid-cols-2">
          {rollup.insights.map((insight) => (
            <div key={insight.id} className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm">
              <p className="font-medium text-slate-900">{insight.label}</p>
              <p className="mt-0.5 text-xs text-slate-600">{insight.summary}</p>
            </div>
          ))}
        </div>
      ) : null}

      {payload.triggers?.length ? (
        <div className="grid gap-3 lg:grid-cols-2">
          {payload.triggers.map((trigger) => (
            <TriggerCard key={trigger.id} trigger={trigger} />
          ))}
        </div>
      ) : null}

      {rollup.recentEvents?.length ? (
        <div>
          <h4 className="mb-2 text-sm font-semibold text-slate-800">Live event stream</h4>
          <div className="max-h-52 overflow-auto rounded-lg border border-slate-200 bg-white">
            <ul className="divide-y divide-slate-100 text-xs">
              {rollup.recentEvents.slice(0, 25).map((ev) => (
                <li key={ev.id} className="flex flex-wrap gap-2 px-3 py-2">
                  <span className="tabular-nums text-slate-400">
                    {new Date(ev.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                  <span className="font-medium text-slate-700">{ev.type.replace(/_/g, ' ')}</span>
                  <span className="text-slate-500">{categoryLabel(ev.category)}</span>
                  {ev.path ? <span className="truncate text-slate-400">{ev.path}</span> : null}
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function TenantBehaviorDashboard() {
  const [range, setRange] = useState<'today' | 'week' | 'month' | 'year'>('week');
  const { data, loading, refreshing, error, lastUpdated, refresh } = useTenantBehaviorLive(8_000, range);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedPayload, setSelectedPayload] = useState<TenantBehaviorPayload | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const openUser = useCallback(async (userId: string) => {
    if (selectedUserId === userId) {
      setSelectedUserId(null);
      setSelectedPayload(null);
      return;
    }
    setSelectedUserId(userId);
    setDetailLoading(true);
    try {
      const payload = await fetchTenantBehaviorByUser(userId);
      setSelectedPayload(payload);
    } catch {
      setSelectedPayload(null);
    } finally {
      setDetailLoading(false);
    }
  }, [selectedUserId]);

  // Refresh open user detail on live poll
  React.useEffect(() => {
    if (!selectedUserId || !data) return;
    void fetchTenantBehaviorByUser(selectedUserId).then(setSelectedPayload).catch(() => {});
  }, [selectedUserId, data?.serverTime]);

  const liveLabel = lastUpdated
    ? `Updated ${lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`
    : 'Connecting…';

  return (
    <Ph2ModulePageLayout
      title="Tenant behaviour intelligence"
      icon={<Brain className="h-5 w-5" />}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-full border border-slate-200 bg-slate-50 p-1">
            {([
              { id: 'today' as const, label: 'Today' },
              { id: 'week' as const, label: 'Week' },
              { id: 'month' as const, label: 'Month' },
              { id: 'year' as const, label: 'Year' },
            ]).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setRange(opt.id)}
                className={`rounded-full px-3 py-1 text-[12px] font-semibold transition ${
                  range === opt.id ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-white'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800">
            <Circle className={`h-2 w-2 fill-emerald-500 text-emerald-500 ${refreshing ? 'animate-pulse' : ''}`} />
            Live · {liveLabel}
          </span>
          <button
            type="button"
            onClick={() => void refresh(false)}
            className="inline-flex items-center gap-2 rounded-lg border border-indigo-200 bg-white px-3 py-1.5 text-sm font-medium text-indigo-700 shadow-sm hover:bg-indigo-50"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      }
    >
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto">
        {error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
        ) : null}

        {loading && !data ? (
          <div className="flex flex-1 items-center justify-center gap-2 text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading live tenant intelligence…
          </div>
        ) : data ? (
          <>
            {data.crmContext ? <CrmContextPanel ctx={data.crmContext} /> : null}

            {data.intelligenceSummary?.filter((line) => line && !/undefined/i.test(line)).length ? (
              <div className="rounded-xl border border-indigo-100 bg-indigo-50/40 px-4 py-3 text-sm text-slate-700">
                <p className="mb-1 flex items-center gap-2 font-semibold text-indigo-900">
                  <TrendingUp className="h-4 w-4" />
                  AI-style tenant analysis
                </p>
                <ul className="space-y-1">
                  {data.intelligenceSummary
                    .filter((line) => line && !/undefined/i.test(line))
                    .map((line) => (
                    <li key={line} className="flex gap-2">
                      <span className="text-indigo-400">→</span>
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="grid shrink-0 gap-3 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-8">
              <Metric label="Health score" value={`${data.tenantHealthScore}/100`} icon={TrendingUp} accent="border-emerald-200" />
              <Metric label="Online now" value={data.onlineCount} hint={`${data.userCount} tracked`} icon={Radio} accent="border-emerald-200" />
              <Metric label="Active (7d)" value={data.activeUsers7d} icon={Users} />
              <Metric label="Visits (7d)" value={data.totalVisits7d} hint={`Today: ${data.todayMetrics?.visits ?? 0}`} icon={Activity} />
              <Metric label="Actions (7d)" value={data.totalActions7d} hint={`Today: ${data.todayMetrics?.actions ?? 0}`} icon={Zap} />
              <Metric label="Mutations" value={data.totalApiMutations7d} icon={GitBranch} />
              <Metric label="Record views" value={data.totalEntityViews7d} icon={MousePointerClick} />
              <Metric label="Active time" value={formatDuration(data.totalActiveMs7d)} icon={Clock3} />
            </div>

            {data.topTriggers?.length ? (
              <div>
                <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-800">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  Priority triggers
                </h2>
                <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
                  {data.topTriggers.slice(0, 6).map((trigger) => (
                    <TriggerCard key={trigger.id} trigger={trigger} />
                  ))}
                </div>
              </div>
            ) : null}

            <div className="grid gap-4 xl:grid-cols-12">
              {/* Module matrix */}
              <div className="xl:col-span-5">
                <h2 className="mb-2 text-sm font-semibold text-slate-800">Phase 2 module matrix (7d)</h2>
                <div className="overflow-auto rounded-xl border border-indigo-100/70 bg-white/90">
                  <table className="min-w-full text-sm">
                    <thead className="sticky top-0 bg-slate-50 text-left text-[10px] uppercase text-slate-500">
                      <tr>
                        <th className="px-3 py-2">Module</th>
                        <th className="px-2 py-2 text-right">Visits</th>
                        <th className="px-2 py-2 text-right">Time</th>
                        <th className="px-2 py-2 text-right">Actions</th>
                        <th className="px-2 py-2 text-right">Conv%</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(data.moduleMatrix || []).map((row) => (
                        <tr key={row.category} className="border-t border-slate-100">
                          <td className="px-3 py-2 font-medium text-slate-800">{row.label}</td>
                          <td className="px-2 py-2 text-right tabular-nums">{row.visits}</td>
                          <td className="px-2 py-2 text-right tabular-nums">{formatDuration(row.activeMs)}</td>
                          <td className="px-2 py-2 text-right tabular-nums">{row.actions}</td>
                          <td className="px-2 py-2 text-right tabular-nums">{row.conversionRate}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Funnel + actions */}
              <div className="space-y-4 xl:col-span-3">
                <div>
                  <h2 className="mb-2 text-sm font-semibold text-slate-800">Recruitment funnel</h2>
                  <div className="space-y-1.5 rounded-xl border border-indigo-100/70 bg-white/90 p-3">
                    {(data.funnelSteps || []).map((step) => (
                      <div key={step.category} className="flex items-center gap-2">
                        <span className="w-24 shrink-0 text-xs font-medium text-slate-600">{step.label}</span>
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500"
                            style={{
                              width: `${Math.min(100, (step.visits / Math.max(1, data.funnelSteps?.[0]?.visits || 1)) * 100)}%`,
                            }}
                          />
                        </div>
                        <span className="w-8 text-right text-xs tabular-nums text-slate-700">{step.visits}</span>
                      </div>
                    ))}
                  </div>
                </div>
                {data.actionBreakdown && Object.keys(data.actionBreakdown).length ? (
                  <div>
                    <h2 className="mb-2 text-sm font-semibold text-slate-800">Team action types</h2>
                    <div className="flex flex-wrap gap-1.5 rounded-xl border border-indigo-100/70 bg-white/90 p-3">
                      {Object.entries(data.actionBreakdown)
                        .filter(([, n]) => (n || 0) > 0)
                        .sort((a, b) => (b[1] || 0) - (a[1] || 0))
                        .map(([key, count]) => (
                          <span key={key} className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-medium capitalize">
                            {key} {count}
                          </span>
                        ))}
                    </div>
                  </div>
                ) : null}
              </div>

              {/* Live feed */}
              <div className="xl:col-span-4">
                <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-800">
                  <Radio className="h-4 w-4 text-emerald-500" />
                  Live activity feed
                </h2>
                <div className="max-h-80 overflow-auto rounded-xl border border-indigo-100/70 bg-white/90">
                  {data.liveFeed?.length ? (
                    <ul className="divide-y divide-slate-100 text-xs">
                      {data.liveFeed.map((ev, idx) => (
                        <li key={`${ev.id}-${idx}`} className="px-3 py-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold text-slate-800">{ev.userName || ev.userId}</span>
                            <span className="tabular-nums text-slate-400">
                              {new Date(ev.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                            </span>
                            <span className="rounded bg-slate-100 px-1.5 py-0.5 font-medium capitalize text-slate-700">
                              {ev.type.replace(/_/g, ' ')}
                            </span>
                            <span className="text-slate-500">{categoryLabel(ev.category)}</span>
                          </div>
                          {ev.path ? <p className="mt-0.5 truncate text-slate-400">{ev.path}</p> : null}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="p-4 text-sm text-slate-500">Waiting for live CRM events…</p>
                  )}
                </div>
              </div>
            </div>

            {/* Team members */}
            <div>
              <h2 className="mb-2 text-sm font-semibold text-slate-800">Team behaviour (live)</h2>
              <div className="overflow-auto rounded-xl border border-indigo-100/70 bg-white/90">
                {data.users?.length ? (
                  <div className="divide-y divide-slate-100">
                    {data.users.map((user) => {
                      const expanded = selectedUserId === user.userId;
                      return (
                        <div key={user.userId}>
                          <button
                            type="button"
                            onClick={() => void openUser(user.userId)}
                            className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-indigo-50/40"
                          >
                            <ChevronRight className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${expanded ? 'rotate-90' : ''}`} />
                            {user.online ? (
                              <Circle className="h-2.5 w-2.5 shrink-0 fill-emerald-500 text-emerald-500" />
                            ) : (
                              <Circle className="h-2.5 w-2.5 shrink-0 text-slate-300" />
                            )}
                            <div className="min-w-0 flex-1">
                              <p className="truncate font-medium text-slate-900">{user.userName || user.userId}</p>
                              <p className="text-xs text-slate-500">
                                7d: {user.visits7d} visits · {user.actions7d} actions · {formatDuration(user.activeMs7d)} ·
                                workflow {user.workflowScore}/100
                                {user.visitsToday > 0 ? ` · today ${user.visitsToday}v/${user.actionsToday}a` : ''}
                              </p>
                              {user.currentModule ? (
                                <p className="text-[10px] text-indigo-600">
                                  Last: {categoryLabel(user.currentModule)} {user.currentPath ? `· ${user.currentPath}` : ''}
                                </p>
                              ) : null}
                            </div>
                            {user.topTrigger ? (
                              <span className={`hidden shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase sm:inline ${flagStyles(user.topTrigger.flag)}`}>
                                {user.topTrigger.flag.replace(/_/g, ' ')}
                              </span>
                            ) : null}
                          </button>
                          {expanded ? (
                            detailLoading ? (
                              <div className="flex items-center gap-2 border-t border-indigo-100/60 px-4 py-6 text-sm text-slate-500">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Loading detail…
                              </div>
                            ) : selectedPayload ? (
                              <UserDetailPanel payload={selectedPayload} />
                            ) : (
                              <div className="border-t px-4 py-6 text-sm text-slate-500">No snapshot yet.</div>
                            )
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-6 text-sm text-slate-600">
                    Use the CRM across jobs, candidates, leads, clients, pipeline, interviews, and placements —
                    this dashboard updates automatically every 8 seconds.
                  </div>
                )}
              </div>
            </div>

            <section className="rounded-2xl border border-slate-200 bg-white p-4">
              <h2 className="text-sm font-bold text-slate-900">What we track for this tenant</h2>
              <p className="mt-1 text-xs text-slate-500">
                Same live engine HQ reads on Users → Analytics. Counts and record ids only — no teammate names.
              </p>
              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                {PHASE2_TENANT_TRACKING_CATALOG.map((group) => (
                  <div key={group.title}>
                    <p className="text-xs font-bold uppercase tracking-wide text-indigo-700">{group.title}</p>
                    <ul className="mt-2 space-y-1.5">
                      {group.items.map((item) => (
                        <li key={item.signal} className="text-xs text-slate-600">
                          <span className="font-semibold text-slate-800">{item.signal}.</span> {item.meaning}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex flex-wrap gap-1.5">
                {PHASE2_TRACKED_MODULES.map((mod) => (
                  <span
                    key={mod}
                    className="rounded-full bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-700 ring-1 ring-slate-200"
                  >
                    {mod}
                  </span>
                ))}
              </div>
            </section>
          </>
        ) : null}
      </div>
    </Ph2ModulePageLayout>
  );
}
