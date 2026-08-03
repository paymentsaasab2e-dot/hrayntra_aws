'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { ExternalLink, X } from 'lucide-react';
import { toast } from 'sonner';
import {
  apiRecruitmentDashboardOverview,
  type RecruitmentOverview,
} from '@/lib/dashboard/api';
import { useDashboardLayoutStore } from '@/lib/dashboard/DashboardLayoutProvider';
import { RecDashboardProvider, useRecDashboard } from './recShared';
import { RecHeader } from './RecHeader';
import { RecKpiGrid } from './RecKpiGrid';
import { RecChartsAndTables } from './RecChartsAndTables';
import {
  RecAlertsPanel,
  RecModuleShortcuts,
  RecSchedulePanel,
  RecTeamLeaderboard,
} from './RecPanels';

const POLL_MS = 60_000;

function RecDrillDownModal() {
  const { drillDown, closeDrillDown } = useRecDashboard();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!drillDown) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeDrillDown();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [drillDown, closeDrillDown]);

  if (!mounted || !drillDown) return null;

  const rows = drillDown.rows || [];
  const columns = rows.length
    ? Array.from(
        rows.reduce((set, row) => {
          Object.keys(row || {}).forEach((key) => set.add(key));
          return set;
        }, new Set<string>()),
      )
    : [];

  const modal = (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/45 backdrop-blur-[1px]"
        aria-label="Close"
        onClick={closeDrillDown}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={drillDown.title}
        className="relative z-10 flex max-h-[85vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Details</p>
            <h3 className="text-lg font-bold text-slate-900">{drillDown.title}</h3>
            <p className="mt-0.5 text-xs text-slate-500">
              {drillDown.subtitle ||
                (rows.length ? `${rows.length} record${rows.length === 1 ? '' : 's'}` : 'No records')}
            </p>
          </div>
          <button
            type="button"
            onClick={closeDrillDown}
            className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X size={16} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-auto px-5 py-4">
          {rows.length && columns.length ? (
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="min-w-full text-left text-sm">
                <thead className="sticky top-0 bg-slate-50 text-[11px] uppercase tracking-wider text-slate-400">
                  <tr>
                    {columns.map((col) => (
                      <th key={col} className="whitespace-nowrap px-3 py-2.5 font-semibold">
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => (
                    <tr key={i} className="border-t border-slate-100 hover:bg-slate-50/80">
                      {columns.map((col) => (
                        <td key={col} className="whitespace-nowrap px-3 py-2.5 text-slate-700">
                          {String(row?.[col] ?? '—')}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
              No matching records in the current dashboard data.
            </p>
          )}
        </div>

        <div className="flex shrink-0 justify-end gap-2 border-t border-slate-100 px-5 py-3">
          <button
            type="button"
            onClick={closeDrillDown}
            className="rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-100"
          >
            Close
          </button>
          {drillDown.href ? (
            <Link
              href={drillDown.href}
              onClick={closeDrillDown}
              className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-2 text-sm font-semibold text-white hover:bg-amber-700"
            >
              Open records <ExternalLink size={14} />
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}

function RecruitmentDashboardInner() {
  const { filters, refreshKey, hiddenSections } = useRecDashboard();
  const [overview, setOverview] = useState<RecruitmentOverview | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiRecruitmentDashboardOverview(filters);
      setOverview(data);
    } catch (error: unknown) {
      setOverview(null);
      const message = error instanceof Error ? error.message : 'Failed to load recruitment dashboard';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  useEffect(() => {
    const id = window.setInterval(() => {
      void apiRecruitmentDashboardOverview(filters)
        .then((data) => setOverview(data))
        .catch(() => undefined);
    }, POLL_MS);
    return () => window.clearInterval(id);
  }, [filters]);

  const show = (id: string) => !hiddenSections.has(id);

  return (
    <div className="space-y-5">
      <RecHeader overview={overview} onRefresh={() => void load()} />

      {show('modules') ? <RecModuleShortcuts /> : null}

      {show('kpis') ? <RecKpiGrid overview={overview} loading={loading} /> : null}

      {show('charts') || show('tables') ? (
        <RecChartsAndTables overview={overview} loading={loading} />
      ) : null}

      <div className="grid gap-4 xl:grid-cols-12">
        <div className="space-y-5 xl:col-span-9">
          {show('schedule') ? <RecSchedulePanel overview={overview} loading={loading} /> : null}
          {show('team') ? <RecTeamLeaderboard overview={overview} loading={loading} /> : null}
        </div>
        <div className="xl:col-span-3">
          {show('alerts') ? <RecAlertsPanel overview={overview} loading={loading} /> : null}
        </div>
      </div>

      {overview?.generatedAt ? (
        <p className="pb-2 text-center text-[11px] text-slate-400">
          Last updated {new Date(overview.generatedAt).toLocaleString()}
        </p>
      ) : null}

      <RecDrillDownModal />
    </div>
  );
}

function RecruitmentDashboardWithLayout() {
  const { layout, setLayout, saveLayout, loading: layoutLoading } = useDashboardLayoutStore();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!layoutLoading) setReady(true);
  }, [layoutLoading]);

  const onHiddenChange = useCallback(
    (hiddenSections: string[]) => {
      const next = {
        ...layout,
        version: 2 as const,
        recruitment: { ...(layout.recruitment || {}), hiddenSections },
      };
      setLayout(next);
      void saveLayout(next);
    },
    [layout, setLayout, saveLayout],
  );

  if (!ready) {
    return (
      <div className="space-y-4">
        <div className="h-24 animate-pulse rounded-2xl bg-white" />
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-2xl bg-white" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <RecDashboardProvider
      initialHidden={layout.recruitment?.hiddenSections || []}
      onHiddenChange={onHiddenChange}
    >
      <RecruitmentDashboardInner />
    </RecDashboardProvider>
  );
}

export function RecruitmentDashboard() {
  return <RecruitmentDashboardWithLayout />;
}
