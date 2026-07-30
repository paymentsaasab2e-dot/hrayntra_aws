'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Brain,
  Clock3,
  GitBranch,
  LayoutGrid,
  Loader2,
  LogIn,
  LogOut,
  Radio,
  RefreshCw,
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

const DRAWER_TABS: Array<{ id: DrawerTab; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: 'overview', label: 'Overview', icon: LayoutGrid },
  { id: 'modules', label: 'Modules', icon: BarChart3 },
  { id: 'funnel', label: 'Funnel', icon: GitBranch },
  { id: 'triggers', label: 'Triggers', icon: AlertTriangle },
  { id: 'live', label: 'Live feed', icon: Radio },
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
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm">
      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
        <Icon className="h-3 w-3" />
        {label}
      </div>
      <div className="mt-0.5 text-lg font-bold tabular-nums text-slate-900">{value}</div>
      {hint ? <p className="text-[10px] text-slate-500">{hint}</p> : null}
    </div>
  );
}

function OverviewTab({
  analysis,
  eng,
}: {
  analysis: HqTenantBehaviorAnalysis;
  eng: HqTenantBehaviorAnalysis['engagement'];
}) {
  return (
    <div className="space-y-5">
      {analysis.dataSource === 'none' ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          No behaviour snapshots yet. Activity appears after the tenant team uses Phase 2 CRM.
        </div>
      ) : null}

      {analysis.intelligenceSummary?.length ? (
        <div className="rounded-xl border border-sky-100 bg-sky-50/50 px-4 py-3 text-sm text-slate-700">
          <p className="mb-2 flex items-center gap-2 font-semibold text-sky-900">
            <TrendingUp className="h-4 w-4" />
            HQ analysis
          </p>
          <ul className="space-y-1">
            {analysis.intelligenceSummary.map((line) => (
              <li key={line} className="flex gap-2 text-xs">
                <span className="text-sky-500">→</span>
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div>
        <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">
          Platform engagement (tenant-wide)
        </h4>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          <Metric label="Health score" value={`${analysis.tenantHealthScore}/100`} icon={TrendingUp} />
          <Metric label="Logins (7d)" value={eng?.totalLogins7d ?? 0} icon={LogIn} />
          <Metric label="Logouts (7d)" value={eng?.totalLogouts7d ?? 0} icon={LogOut} />
          <Metric label="Sessions (7d)" value={eng?.totalSessions7d ?? 0} icon={Activity} />
          <Metric
            label="Time on platform"
            value={formatDuration(eng?.totalActiveMs7d ?? 0)}
            hint={`Today: ${formatDuration(eng?.totalActiveMsToday ?? 0)}`}
            icon={Clock3}
          />
          <Metric
            label="Active users (7d)"
            value={eng?.activeUsers7d ?? 0}
            hint={`${eng?.onlineNow ?? 0} online now`}
            icon={Radio}
          />
          <Metric label="Last activity" value={formatWhen(eng?.lastActivityAt)} icon={Zap} />
          <Metric
            label="CRM actions (7d)"
            value={eng?.totalActions7d ?? 0}
            hint={`${eng?.totalApiMutations7d ?? 0} API mutations`}
            icon={GitBranch}
          />
        </div>
      </div>

      {analysis.crmContext ? (
        <div>
          <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">Live CRM workload</h4>
          <div className="grid grid-cols-3 gap-2 md:grid-cols-4">
            {[
              ['Jobs', analysis.crmContext.openJobs],
              ['Candidates', analysis.crmContext.openCandidates],
              ['Leads', analysis.crmContext.openLeads],
              ['Clients', analysis.crmContext.openClients],
              ['Interviews', analysis.crmContext.pendingInterviews],
              ['Placements', analysis.crmContext.openPlacements],
              ['Pipeline', analysis.crmContext.pipelineEntries],
              ['Tasks', analysis.crmContext.pendingTasks],
              ['Team', analysis.crmContext.teamMembers],
            ].map(([label, value]) => (
              <div key={String(label)} className="rounded-lg border border-slate-200 bg-white px-2.5 py-2">
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
                <p className="text-lg font-bold tabular-nums text-slate-900">{Number(value ?? 0)}</p>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {analysis.insights?.length ? (
        <div>
          <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">Aggregated insights</h4>
          <div className="grid gap-2 md:grid-cols-2">
            {analysis.insights.map((insight) => (
              <div key={insight.id} className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm">
                <p className="font-medium text-slate-900">{insight.label}</p>
                <p className="mt-0.5 text-xs text-slate-600">{insight.summary}</p>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ModulesTab({ analysis }: { analysis: HqTenantBehaviorAnalysis }) {
  if (!analysis.moduleMatrix?.length) {
    return <p className="text-sm text-slate-500">No module activity recorded for this tenant yet.</p>;
  }
  return (
    <div className="space-y-4">
      <div className="overflow-auto rounded-xl border border-slate-200 bg-white">
        <table className="min-w-full text-xs">
          <thead className="bg-slate-50 text-left text-[10px] uppercase text-slate-400">
            <tr>
              <th className="px-3 py-2">Module</th>
              <th className="px-2 py-2 text-right">Visits</th>
              <th className="px-2 py-2 text-right">Time</th>
              <th className="px-2 py-2 text-right">Actions</th>
              <th className="px-2 py-2 text-right">Conv%</th>
            </tr>
          </thead>
          <tbody>
            {analysis.moduleMatrix.map((row) => (
              <tr key={row.category} className="border-t border-slate-100">
                <td className="px-3 py-2 font-semibold text-slate-800">{row.label}</td>
                <td className="px-2 py-2 text-right tabular-nums">{row.visits}</td>
                <td className="px-2 py-2 text-right tabular-nums">{formatDuration(row.activeMs)}</td>
                <td className="px-2 py-2 text-right tabular-nums">{row.actions}</td>
                <td className="px-2 py-2 text-right tabular-nums">{row.conversionRate}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {analysis.actionBreakdown && Object.keys(analysis.actionBreakdown).length ? (
        <div>
          <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">Action types</h4>
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(analysis.actionBreakdown)
              .filter(([, n]) => (n || 0) > 0)
              .sort((a, b) => (b[1] || 0) - (a[1] || 0))
              .map(([key, count]) => (
                <span
                  key={key}
                  className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium capitalize text-slate-700"
                >
                  {key} {count}
                </span>
              ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function FunnelTab({ analysis }: { analysis: HqTenantBehaviorAnalysis }) {
  if (!analysis.funnelSteps?.length) {
    return <p className="text-sm text-slate-500">No funnel data yet.</p>;
  }
  const max = Math.max(1, analysis.funnelSteps[0]?.visits || 1);
  return (
    <div className="space-y-2">
      {analysis.funnelSteps.map((step) => (
        <div
          key={step.category}
          className="flex items-center gap-3 rounded-xl border border-slate-100 bg-white px-4 py-3"
        >
          <span className="w-28 shrink-0 text-sm font-medium text-slate-700">{step.label}</span>
          <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-gradient-to-r from-sky-500 to-indigo-500"
              style={{ width: `${Math.min(100, (step.visits / max) * 100)}%` }}
            />
          </div>
          <span className="w-8 shrink-0 text-right text-sm font-bold tabular-nums text-slate-800">{step.visits}</span>
        </div>
      ))}
    </div>
  );
}

function TriggersTab({ analysis }: { analysis: HqTenantBehaviorAnalysis }) {
  if (!analysis.topTriggers?.length) {
    return <p className="text-sm text-slate-500">No triggers detected for this tenant.</p>;
  }
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {analysis.topTriggers.map((trigger) => (
        <div key={trigger.id} className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="font-semibold text-slate-900">{trigger.title}</p>
          <p className="mt-1 text-xs uppercase text-slate-400">{trigger.flag.replace(/_/g, ' ')}</p>
          <p className="mt-2 text-sm text-slate-600">{trigger.reason}</p>
          {trigger.evidence?.length ? (
            <ul className="mt-2 space-y-0.5 text-xs text-slate-500">
              {trigger.evidence.map((line) => (
                <li key={line}>• {line}</li>
              ))}
            </ul>
          ) : null}
          <p className="mt-3 text-xs font-medium text-sky-700">{trigger.recommendedAction}</p>
        </div>
      ))}
    </div>
  );
}

function LiveTab({ analysis }: { analysis: HqTenantBehaviorAnalysis }) {
  if (!analysis.liveFeed?.length) {
    return <p className="text-sm text-slate-500">Waiting for live CRM events from this tenant…</p>;
  }
  return (
    <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white">
      {analysis.liveFeed.map((ev, idx) => (
        <li key={`${ev.at}-${idx}`} className="flex flex-wrap gap-2 px-4 py-2.5 text-xs">
          <span className="tabular-nums text-slate-400">
            {new Date(ev.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </span>
          <span className="font-medium capitalize text-slate-700">{ev.type.replace(/_/g, ' ')}</span>
          <span className="text-slate-500">{MODULE_LABELS[ev.category] || ev.category}</span>
          {ev.path ? <span className="truncate text-slate-400">{ev.path}</span> : null}
        </li>
      ))}
    </ul>
  );
}

export function HqTenantBehaviorDrawer({
  tenant,
  onClose,
}: {
  tenant: HqTenantRow;
  onClose: () => void;
}) {
  const [analysis, setAnalysis] = useState<HqTenantBehaviorAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<DrawerTab>('overview');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const load = useCallback(async () => {
    if (!tenant.tenantDbName) {
      setError('Tenant has no database name');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await apiHqGetTenantBehavior(tenant.tenantDbName);
      setAnalysis(res.data || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tenant behaviour');
      setAnalysis(null);
    } finally {
      setLoading(false);
    }
  }, [tenant.tenantDbName]);

  useEffect(() => {
    setTab('overview');
    void load();
    const timer = window.setInterval(() => void load(), 12_000);
    return () => window.clearInterval(timer);
  }, [load, tenant.id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const eng = analysis?.engagement;
  const dataSourceLabel =
    analysis?.dataSource === 'behavior_engine'
      ? 'Phase 2 behaviour engine (live)'
      : analysis?.dataSource === 'sessions_fallback'
        ? 'Session fallback — full engine data pending'
        : 'No behaviour data yet';

  if (!mounted) return null;

  const drawer = (
    <div className="fixed inset-0 z-[120] flex">
      <button type="button" className="absolute inset-0 bg-slate-900/45" onClick={onClose} aria-label="Close drawer" />
      <aside className="relative ml-auto flex h-full w-full max-w-3xl flex-col bg-[#f8fafc] shadow-2xl">
        <header className="shrink-0 border-b border-slate-200 bg-white px-5 py-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-slate-500">
                <Brain className="h-3.5 w-3.5 text-sky-600" />
                Tenant behaviour analytics
              </p>
              <h2 className="mt-1 truncate text-xl font-semibold text-slate-900">{tenant.name}</h2>
              <p className="mt-1 text-sm text-slate-600">
                {tenant.email} · <span className="font-mono text-slate-800">{tenant.tenantDbName}</span>
              </p>
              <p className="mt-1 text-xs text-slate-500">{dataSourceLabel} · aggregated, not per-user</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span className="hidden items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-700 ring-1 ring-emerald-100 sm:inline-flex">
                <Radio className="h-2.5 w-2.5" />
                Live
              </span>
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
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="mt-4 flex gap-1 overflow-x-auto border-b border-slate-100 pb-0">
            {DRAWER_TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={`inline-flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2 text-xs font-semibold transition ${
                  tab === id
                    ? 'border-sky-600 text-sky-700'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </button>
            ))}
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
          {loading && !analysis ? (
            <div className="flex justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-sky-500" />
            </div>
          ) : error ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</div>
          ) : analysis ? (
            <>
              {tab === 'overview' ? <OverviewTab analysis={analysis} eng={eng} /> : null}
              {tab === 'modules' ? <ModulesTab analysis={analysis} /> : null}
              {tab === 'funnel' ? <FunnelTab analysis={analysis} /> : null}
              {tab === 'triggers' ? <TriggersTab analysis={analysis} /> : null}
              {tab === 'live' ? <LiveTab analysis={analysis} /> : null}
            </>
          ) : (
            <p className="text-sm text-slate-600">No behaviour data available for this tenant.</p>
          )}
        </div>

        {analysis?.capturedAt ? (
          <footer className="shrink-0 border-t border-slate-200 bg-white px-5 py-2 text-[10px] text-slate-400">
            Last synced {new Date(analysis.capturedAt).toLocaleString()}
            {eng?.lastActivityAt ? ` · Last tenant activity ${formatWhen(eng.lastActivityAt)}` : ''}
          </footer>
        ) : null}
      </aside>
    </div>
  );

  return createPortal(drawer, document.body);
}

/** @deprecated use HqTenantBehaviorDrawer */
export const HqTenantBehaviorPanel = HqTenantBehaviorDrawer;
