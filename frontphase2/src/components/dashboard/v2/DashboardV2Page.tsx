'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { LayoutDashboard, Pencil, Save } from 'lucide-react';
import { apiDashboardOverview } from '@/lib/dashboard/api';
import type { DashboardOverview } from '@/lib/dashboard/api';
import { useDashboardLayoutStore } from '@/lib/dashboard/DashboardLayoutProvider';
import { DASHBOARD_MODULE_TABS, type ModuleTabKey } from '@/lib/dashboard/moduleCommandConfig';
import { usePermissions } from '@/hooks/usePermissions';
import { useDashboardTabLayout } from '@/lib/dashboard/useDashboardTabLayout';
import { DashboardModuleTabs } from './DashboardModuleTabs';
import { ModuleCommandCenter } from './ModuleCommandCenter';
import { DashboardWelcomeFallback } from './DashboardWelcomeFallback';

function DashboardModuleTabsSkeleton() {
  return (
    <div
      className="flex flex-wrap gap-1 rounded-xl border border-slate-200/80 bg-slate-50/80 p-1"
      aria-hidden
    >
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="h-9 w-[4.5rem] animate-pulse rounded-lg bg-slate-200/70 sm:w-20" />
      ))}
    </div>
  );
}

function CommandCenterSkeleton() {
  return (
    <div
      className="min-h-[20rem] animate-pulse rounded-2xl border border-slate-200/80 bg-slate-50/80"
      aria-hidden
    />
  );
}

function DashboardV2PageInner() {
  const { isSuperAdmin } = usePermissions();
  const { loading: layoutLoading, permittedTabKeys } = useDashboardLayoutStore();
  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [activeModule, setActiveModule] = useState<ModuleTabKey>('leads');
  const [clientReady, setClientReady] = useState(false);
  const tabLayout = useDashboardTabLayout();

  useEffect(() => {
    setClientReady(true);
  }, []);

  const permittedTabs = useMemo(() => {
    if (!clientReady) return [];
    return DASHBOARD_MODULE_TABS.filter((tab) => {
      if (isSuperAdmin()) return true;
      return permittedTabKeys.has(tab.key);
    });
  }, [clientReady, permittedTabKeys, isSuperAdmin]);

  const visibleTabs = useMemo(
    () => permittedTabs.filter((tab) => !tabLayout.hiddenTabSet.has(tab.key)),
    [permittedTabs, tabLayout.hiddenTabSet],
  );

  const hiddenTabsForRestore = useMemo(
    () =>
      permittedTabs
        .filter((tab) => tabLayout.sessionHiddenTabs.includes(tab.key))
        .map((tab) => ({ key: tab.key, label: tab.label })),
    [permittedTabs, tabLayout.sessionHiddenTabs],
  );

  useEffect(() => {
    if (visibleTabs.length && !visibleTabs.some((t) => t.key === activeModule)) {
      setActiveModule(visibleTabs[0].key);
    }
  }, [visibleTabs, activeModule]);

  useEffect(() => {
    let cancelled = false;
    void apiDashboardOverview()
      .then((data) => {
        if (!cancelled) setOverview(data);
      })
      .catch(() => {
        if (!cancelled) setOverview(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const pageLoading = !clientReady || layoutLoading;

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-slate-900">
            <LayoutDashboard className="text-indigo-600" size={26} />
            Dashboard
          </h1>
          <p className="mt-0.5 text-sm text-slate-500">
            Modules and widgets are tailored to your role and permissions.
          </p>
        </div>
        {!pageLoading && permittedTabs.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2">
            {tabLayout.editMode ? (
              <>
                <button
                  type="button"
                  onClick={() => void tabLayout.saveTabLayout()}
                  disabled={tabLayout.saving}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-60"
                >
                  <Save size={14} />
                  {tabLayout.saving ? 'Saving…' : 'Save dashboard'}
                </button>
                <button
                  type="button"
                  onClick={tabLayout.cancelCustomize}
                  className="rounded-lg px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100"
                >
                  Done
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={tabLayout.startCustomize}
                className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-white px-3 py-2 text-xs font-semibold text-indigo-800 shadow-sm hover:bg-indigo-50"
              >
                <Pencil size={14} />
                Customize tabs
              </button>
            )}
          </div>
        ) : null}
      </header>

      {pageLoading ? (
        <>
          <DashboardModuleTabsSkeleton />
          <CommandCenterSkeleton />
        </>
      ) : visibleTabs.length > 0 ? (
        <>
          <DashboardModuleTabs
            tabs={visibleTabs.map((t) => ({ key: t.key, label: t.label }))}
            active={activeModule}
            onChange={setActiveModule}
            editMode={tabLayout.editMode}
            onRemoveTab={tabLayout.hideTab}
            hiddenTabs={hiddenTabsForRestore}
            onRestoreTab={tabLayout.restoreTab}
          />

          <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm sm:p-6">
            <ModuleCommandCenter moduleKey={activeModule} overview={overview} />
          </div>
        </>
      ) : tabLayout.editMode && hiddenTabsForRestore.length > 0 ? (
        <>
          <DashboardModuleTabs
            tabs={[]}
            active={activeModule}
            onChange={setActiveModule}
            editMode={tabLayout.editMode}
            hiddenTabs={hiddenTabsForRestore}
            onRestoreTab={tabLayout.restoreTab}
          />
          <p className="text-sm text-slate-500">
            All tabs are hidden. Restore a tab above, then click Save dashboard.
          </p>
        </>
      ) : (
        <DashboardWelcomeFallback
          title="Your dashboard"
          description="No command-center modules are available for your role. Use the links below to open what you can access."
        />
      )}
    </div>
  );
}

export function DashboardV2Page() {
  return <DashboardV2PageInner />;
}
