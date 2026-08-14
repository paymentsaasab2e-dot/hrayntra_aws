'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { ExternalLink, X } from 'lucide-react';
import { toast } from 'sonner';
import {
  apiCrmDashboardOverview,
  type CrmOverview,
} from '@/lib/dashboard/api';
import { useDashboardLayoutStore } from '@/lib/dashboard/DashboardLayoutProvider';
import { HqDashCategoryTabs } from '@/components/hq/analytics/HqDashCategoryTabs';
import {
  CRM_CATEGORY_TABS,
  CrmDashboardProvider,
  type CrmCategoryTabId,
  useCrmDashboard,
} from './crmShared';
import { CrmHeader, CrmTimelinePills } from './CrmHeader';
import { CrmChartsAndTables } from './CrmChartsAndTables';
import { CrmDecisionInsights } from './CrmDecisionInsights';
import { CrmTeamIntelligence } from './CrmTeamIntelligence';
import { PeoplePerfPanel } from '@/components/dashboard/people-perf/PeoplePerfPanel';
import { crmTextFont, dashFontVars } from './crmStatNumber';
import { useDashboardAccess } from '@/lib/dashboard/useDashboardAccess';
import {
  isCrmOverviewCacheFresh,
  readCrmOverviewCache,
  writeCrmOverviewCache,
} from '@/lib/employerPageCache';
import { CrmMineWorkPanel, DashScopeBanner } from '@/components/dashboard/mine/MineWorkPanel';

const POLL_MS = 60_000;

function CrmDrillDownModal() {
  const { drillDown, closeDrillDown } = useCrmDashboard();
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
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700"
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

function CrmDashboardInner() {
  const { filters, refreshKey } = useCrmDashboard();
  const access = useDashboardAccess();
  const [overview, setOverview] = useState<CrmOverview | null>(() => {
    const cached = readCrmOverviewCache({ dateRange: 'last_30_days', category: 'insights' });
    return cached?.data ? (cached.data as CrmOverview) : null;
  });
  const [loading, setLoading] = useState(
    () => !readCrmOverviewCache({ dateRange: 'last_30_days', category: 'insights' })?.data,
  );
  const [category, setCategory] = useState<CrmCategoryTabId>('insights');
  const visibleTabs = CRM_CATEGORY_TABS.filter((tab) => access.crmTabs[tab.id]);

  useEffect(() => {
    if (!visibleTabs.length) return;
    if (!access.crmTabs[category]) setCategory(visibleTabs[0].id);
  }, [access.crmTabs, category, visibleTabs]);

  useEffect(() => {
    const query =
      category === 'mine' ? { ...filters, scope: 'self' as const, assignedTo: undefined } : filters;
    const cached = readCrmOverviewCache({ ...query, category } as Record<string, string | undefined | null>);
    if (cached?.data) setOverview(cached.data as CrmOverview);
  }, [category, filters]);

  const load = useCallback(async () => {
    const query =
      category === 'mine' ? { ...filters, scope: 'self' as const, assignedTo: undefined } : filters;
    const cacheFilters = { ...query, category } as Record<string, string | undefined | null>;
    const cached = readCrmOverviewCache(cacheFilters);
    const silent = Boolean(cached?.data);
    if (!silent) setLoading(true);
    try {
      const data = await apiCrmDashboardOverview(query);
      setOverview(data);
      writeCrmOverviewCache(data as Record<string, unknown>, cacheFilters);
    } catch (error: unknown) {
      if (!cached?.data) setOverview(null);
      const message = error instanceof Error ? error.message : 'Failed to load CRM dashboard';
      if (!silent) toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [filters, category]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  useEffect(() => {
    const id = window.setInterval(() => {
      const query =
        category === 'mine' ? { ...filters, scope: 'self' as const, assignedTo: undefined } : filters;
      const cacheFilters = { ...query, category } as Record<string, string | undefined | null>;
      if (isCrmOverviewCacheFresh(readCrmOverviewCache(cacheFilters))) return;
      void apiCrmDashboardOverview(query)
        .then((data) => {
          setOverview(data);
          writeCrmOverviewCache(data as Record<string, unknown>, cacheFilters);
        })
        .catch(() => undefined);
    }, POLL_MS);
    return () => window.clearInterval(id);
  }, [filters, category]);

  return (
    <div className={`${dashFontVars} ${crmTextFont} dash-ui space-y-5 antialiased`}>
      <CrmHeader overview={overview} onRefresh={() => void load()} />

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <HqDashCategoryTabs
          instanceId="crm-tenant"
          tabs={visibleTabs}
          value={category}
          onChange={(id) => setCategory(id as CrmCategoryTabId)}
          className="mb-0 min-w-0 flex-1"
        />
        <CrmTimelinePills className="lg:mt-1.5" />
      </div>

      {category !== 'mine' ? (
        <DashScopeBanner
          access={{
            statsScope: access.canFullStats ? 'full' : 'self',
            canFullStats: access.canFullStats,
            showMineTab: access.showMineTab,
            showMineApprovals: access.showMineApprovals,
          }}
        />
      ) : null}

      {visibleTabs.length === 0 ? (
        <p className="rounded-2xl border border-slate-100 bg-white px-5 py-10 text-center text-sm text-slate-500">
          No CRM dashboard tabs are assigned to this role. Ask an admin to enable Insights, Pipeline, Team, or Hours & scores in Team → Roles.
        </p>
      ) : null}

      {category === 'mine' && access.crmTabs.mine ? (
        <CrmMineWorkPanel overview={overview} loading={loading} />
      ) : null}

      {category === 'insights' && access.crmTabs.insights ? (
        <CrmDecisionInsights overview={overview} loading={loading} />
      ) : null}

      {category === 'portfolio' && access.crmTabs.portfolio ? (
        <CrmChartsAndTables overview={overview} loading={loading} mode="portfolio" />
      ) : null}

      {category === 'team' && access.crmTabs.team ? <CrmTeamIntelligence overview={overview} /> : null}
      {category === 'people' && access.crmTabs.people ? <PeoplePerfPanel product="crm" /> : null}

      {overview?.generatedAt ? (
        <p className="pb-2 text-center text-[11px] text-slate-400">
          Last updated {new Date(overview.generatedAt).toLocaleString()}
        </p>
      ) : null}

      <CrmDrillDownModal />
    </div>
  );
}

function CrmDashboardWithLayout() {
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
        crm: { ...(layout.crm || {}), hiddenSections },
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
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-2xl bg-white" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <CrmDashboardProvider
      initialHidden={layout.crm?.hiddenSections || []}
      onHiddenChange={onHiddenChange}
    >
      <CrmDashboardInner />
    </CrmDashboardProvider>
  );
}

export function CrmDashboard() {
  return <CrmDashboardWithLayout />;
}
