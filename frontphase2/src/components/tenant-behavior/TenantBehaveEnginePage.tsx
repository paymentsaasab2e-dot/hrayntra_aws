'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Brain, ChevronDown, ChevronRight, Copy, Loader2, RefreshCw, Search } from 'lucide-react';
import { Ph2ModulePageLayout, PH2_TOOLBAR_SELECT_CLASS } from '@/components/layout/Ph2ModulePageLayout';
import {
  buildEngineRecommendations,
  fetchTenantBehaviorEngine,
  formatDuration,
  type EngineRec,
  type EngineRecAudience,
  type TenantBehaviorEngineReport,
  type TenantEngineIdList,
  type TenantEngineUserRow,
} from '@/lib/tenant-behavior-engine';

type RangeKey = 'today' | 'week' | 'month' | 'year';

function copyText(value: string) {
  void navigator.clipboard?.writeText(value);
}

function looksLikeIdQuery(q: string) {
  return q.trim().length >= 4;
}

function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-xl border border-indigo-100/70 bg-white/90 px-3 py-2.5 shadow-sm">
      <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-0.5 text-xl font-semibold tabular-nums text-slate-900">{value}</p>
      {hint ? <p className="text-[11px] text-slate-500">{hint}</p> : null}
    </div>
  );
}

function IdDrawer({ list, label, forceOpen }: { list?: TenantEngineIdList; label: string; forceOpen: boolean }) {
  const [open, setOpen] = useState(false);
  if (!list || !list.count) return null;
  const show = forceOpen || open;
  return (
    <div className="mt-2">
      <button
        type="button"
        className="inline-flex items-center gap-1 text-[11px] font-medium text-indigo-600 hover:text-indigo-800"
        onClick={() => setOpen((v) => !v)}
      >
        {show ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        {label} · {list.count}
        {list.truncated ? ' (capped)' : ''}
      </button>
      {show ? (
        <div className="mt-1.5">
          <button
            type="button"
            className="mb-1 inline-flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-800"
            onClick={() => copyText(list.ids.join('\n'))}
          >
            <Copy className="h-3 w-3" />
            copy ids
          </button>
          <div className="flex flex-wrap gap-1">
            {list.ids.map((id) => (
              <button
                key={id}
                type="button"
                title={id}
                onClick={() => copyText(id)}
                className="max-w-[9.5rem] truncate rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-mono text-[10px] text-slate-700 hover:border-indigo-300 hover:bg-indigo-50"
              >
                {id}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function WorkloadBlock({
  title,
  assigned,
  open,
  done,
  extra,
  ids,
  revealIds,
}: {
  title: string;
  assigned: number;
  open: number;
  done: number;
  extra?: string;
  ids?: { assigned?: TenantEngineIdList; open?: TenantEngineIdList; done?: TenantEngineIdList };
  revealIds: boolean;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-sm font-semibold text-slate-800">{title}</p>
        {extra ? <p className="text-[11px] text-amber-700">{extra}</p> : null}
      </div>
      <p className="mt-1 text-xs tabular-nums text-slate-600">
        assigned {assigned} · open {open} · done {done}
      </p>
      <IdDrawer list={ids?.open} label="Open ids" forceOpen={revealIds} />
      <IdDrawer list={ids?.done} label="Done ids" forceOpen={revealIds} />
      <IdDrawer list={ids?.assigned} label="Assigned ids" forceOpen={revealIds} />
    </div>
  );
}

const AUDIENCE_LABEL: Record<EngineRecAudience, string> = {
  user: 'User',
  tenant_admin: 'Tenant admin',
  hq_sales: 'Hryantra sales',
};

const AUDIENCE_STYLE: Record<EngineRecAudience, string> = {
  user: 'border-indigo-200 bg-indigo-50/50',
  tenant_admin: 'border-emerald-200 bg-emerald-50/50',
  hq_sales: 'border-amber-200 bg-amber-50/60',
};

function RecCard({ rec }: { rec: EngineRec }) {
  return (
    <div className={`rounded-lg border p-3 ${AUDIENCE_STYLE[rec.audience]}`}>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{AUDIENCE_LABEL[rec.audience]}</p>
      <p className="mt-0.5 text-sm font-semibold text-slate-900">{rec.title}</p>
      <p className="mt-1 text-xs text-slate-600">{rec.why}</p>
      <p className="mt-1.5 text-xs font-medium text-slate-800">{rec.action}</p>
    </div>
  );
}

export function TenantBehaveEnginePage() {
  const [range, setRange] = useState<RangeKey>('week');
  const [q, setQ] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [report, setReport] = useState<TenantBehaviorEngineReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showIds, setShowIds] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchTenantBehaviorEngine({ range });
      setReport(data);
      setSelectedId((prev) => {
        if (prev && data?.users.some((u) => u.userId === prev)) return prev;
        return data?.users[0]?.userId || null;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load engine');
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => {
    void load();
  }, [load]);

  const users = useMemo(() => {
    const list = report?.users || [];
    const needle = q.trim().toLowerCase();
    if (!needle) return list;
    return list.filter((u) => u.userId.toLowerCase().includes(needle));
  }, [q, report?.users]);

  const selected: TenantEngineUserRow | undefined = users.find((u) => u.userId === selectedId) || users[0];
  const tw = report?.tenantWide;
  const revealIds = showIds || looksLikeIdQuery(q);
  const recs = useMemo(() => buildEngineRecommendations(report, selected), [report, selected]);

  return (
    <Ph2ModulePageLayout
      title="Tenant behave"
      icon={<Brain className="h-5 w-5" />}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <select
            className={PH2_TOOLBAR_SELECT_CLASS}
            value={range}
            onChange={(e) => setRange(e.target.value as RangeKey)}
          >
            <option value="today">Today</option>
            <option value="week">Week</option>
            <option value="month">Month</option>
            <option value="year">Year</option>
          </select>
          <label className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-100 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 shadow-sm">
            <input type="checkbox" checked={showIds} onChange={(e) => setShowIds(e.target.checked)} />
            Show ids
          </label>
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-100 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:bg-indigo-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      }
    >
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
        <div className="grid shrink-0 grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
          <Stat label="Users" value={tw?.activity.trackedUsers ?? 0} hint={`${tw?.activity.activeUsers ?? 0} active`} />
          <Stat label="Time" value={formatDuration(tw?.activity.activeMs || 0)} />
          <Stat label="Actions" value={tw?.activity.actions ?? 0} />
          <Stat label="Visits" value={tw?.activity.visits ?? 0} />
          <Stat
            label="Tasks"
            value={`${tw?.workload.tasks.open ?? 0}/${tw?.workload.tasks.done ?? 0}`}
            hint="open / done"
          />
          <Stat
            label="Leads"
            value={`${tw?.workload.leads.assigned ?? 0}/${tw?.workload.leads.unassigned ?? 0}`}
            hint="assigned / unassigned"
          />
          <Stat label="Jobs open" value={tw?.workload.jobs.open ?? 0} />
          <Stat label="Overdue tasks" value={tw?.workload.tasks.overdue ?? 0} />
        </div>

        {error ? (
          <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</p>
        ) : null}

        <div className="grid min-h-0 flex-1 gap-3 overflow-hidden lg:grid-cols-[minmax(240px,280px)_1fr]">
          <div className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-indigo-100/70 bg-white/90 shadow-sm">
            <div className="flex items-center gap-2 border-b border-indigo-50 px-3 py-2">
              <Search className="h-3.5 w-3.5 text-slate-400" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search id to reveal"
                className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
              />
            </div>
            <div className="min-h-0 flex-1 overflow-auto">
              {loading && !report ? (
                <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-500">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading
                </div>
              ) : null}
              {users.map((u, idx) => {
                const active = u.userId === selected?.userId;
                const all = report?.users || [];
                const n = all.findIndex((row) => row.userId === u.userId) + 1 || idx + 1;
                return (
                  <button
                    key={u.userId}
                    type="button"
                    onClick={() => setSelectedId(u.userId)}
                    className={`flex w-full flex-col gap-0.5 border-b border-slate-100 px-3 py-2.5 text-left hover:bg-indigo-50/60 ${
                      active ? 'bg-indigo-50' : ''
                    }`}
                  >
                    <span className="text-sm font-medium text-slate-800">Member {n}</span>
                    {revealIds ? (
                      <span className="truncate font-mono text-[10px] text-slate-500">{u.userId}</span>
                    ) : null}
                    <span className="text-[11px] tabular-nums text-slate-500">
                      {u.activity.actions} acts · {formatDuration(u.activity.activeMs)} · tasks {u.workload.tasks.open}/
                      {u.workload.tasks.done}
                    </span>
                  </button>
                );
              })}
              {!loading && !users.length ? (
                <p className="px-3 py-8 text-center text-sm text-slate-500">No users in this range.</p>
              ) : null}
            </div>
          </div>

          <div className="min-h-0 overflow-auto rounded-xl border border-indigo-100/70 bg-white/90 p-4 shadow-sm">
            {!selected ? (
              <p className="text-sm text-slate-500">Pick a member to see activity and recs.</p>
            ) : (
              <div className="space-y-4">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Selected</p>
                  <p className="text-sm font-semibold text-slate-900">
                    Member {(report?.users || []).findIndex((row) => row.userId === selected.userId) + 1}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    First open: {selected.activity.topFirstOpen || '—'} · last{' '}
                    {selected.activity.lastActive
                      ? new Date(selected.activity.lastActive).toLocaleString()
                      : '—'}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <Stat label="Actions" value={selected.activity.actions} />
                  <Stat label="Time" value={formatDuration(selected.activity.activeMs)} />
                  <Stat label="Opens" value={selected.activity.entityViews} />
                  <Stat
                    label="Tasks"
                    value={`${selected.workload.tasks.open}/${selected.workload.tasks.done}`}
                    hint={`${selected.workload.tasks.overdue} overdue`}
                  />
                </div>

                {recs.length ? (
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Recs from this activity
                    </p>
                    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                      {recs.map((rec) => (
                        <RecCard key={rec.id} rec={rec} />
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-slate-500">No rec triggers fired for this mix of activity and workload.</p>
                )}

                <div className="grid gap-2 sm:grid-cols-2">
                  <WorkloadBlock
                    title="Tasks"
                    assigned={selected.workload.tasks.assigned}
                    open={selected.workload.tasks.open}
                    done={selected.workload.tasks.done}
                    extra={selected.workload.tasks.overdue ? `${selected.workload.tasks.overdue} overdue` : undefined}
                    ids={selected.workload.tasks.ids}
                    revealIds={revealIds}
                  />
                  <WorkloadBlock
                    title="Leads"
                    assigned={selected.workload.leads.assigned}
                    open={selected.workload.leads.open}
                    done={selected.workload.leads.done}
                    ids={selected.workload.leads.ids}
                    revealIds={revealIds}
                  />
                  <WorkloadBlock
                    title="Jobs"
                    assigned={selected.workload.jobs.assigned}
                    open={selected.workload.jobs.open}
                    done={selected.workload.jobs.done}
                    ids={selected.workload.jobs.ids}
                    revealIds={revealIds}
                  />
                  <WorkloadBlock
                    title="Candidates"
                    assigned={selected.workload.candidates.assigned}
                    open={selected.workload.candidates.open}
                    done={selected.workload.candidates.done}
                    ids={selected.workload.candidates.ids}
                    revealIds={revealIds}
                  />
                  <WorkloadBlock
                    title="Clients"
                    assigned={selected.workload.clients.assigned}
                    open={selected.workload.clients.open}
                    done={selected.workload.clients.done}
                    ids={selected.workload.clients.ids}
                    revealIds={revealIds}
                  />
                  <WorkloadBlock
                    title="Interviews"
                    assigned={selected.workload.interviews.assigned}
                    open={selected.workload.interviews.open}
                    done={selected.workload.interviews.done}
                    ids={selected.workload.interviews.ids}
                    revealIds={revealIds}
                  />
                </div>

                {selected.activity.openedEntityIds.length ? (
                  <IdDrawer
                    list={{
                      count: selected.activity.openedEntityIds.length,
                      ids: selected.activity.openedEntityIds.map((row) => row.entityId),
                    }}
                    label="Opened record ids"
                    forceOpen={revealIds}
                  />
                ) : null}

                {Object.keys(selected.workload.tasks.linkedEntityIds || {}).length
                  ? Object.entries(selected.workload.tasks.linkedEntityIds).map(([type, list]) => (
                      <IdDrawer key={type} list={list} label={`Task linked · ${type}`} forceOpen={revealIds} />
                    ))
                  : null}

                <p className="text-[11px] text-slate-500">
                  Tracking is automatic while people use the CRM (pages, time, saves). This page is numbers-first. Use
                  Show ids, expand a row, or search an id when you need audit.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </Ph2ModulePageLayout>
  );
}
