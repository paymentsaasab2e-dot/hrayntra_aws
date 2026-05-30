'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { LayoutDashboard } from 'lucide-react';
import { apiDashboardOverview } from '@/lib/dashboard/api';
import type { DashboardOverview } from '@/lib/dashboard/api';
import { DASHBOARD_MODULE_TABS, type ModuleTabKey } from '@/lib/dashboard/moduleCommandConfig';
import { usePermissions } from '@/hooks/usePermissions';
import { MODULE_ACCESS_MAP } from '@/lib/rbac/moduleAccess';
import { DashboardModuleTabs } from './DashboardModuleTabs';
import { ModuleCommandCenter } from './ModuleCommandCenter';

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

export function DashboardV2Page() {
  const { hasAnyPermission, isSuperAdmin } = usePermissions();
  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [activeModule, setActiveModule] = useState<ModuleTabKey>('leads');
  /** Permissions come from localStorage — only available after mount (avoids SSR mismatch). */
  const [clientReady, setClientReady] = useState(false);

  useEffect(() => {
    setClientReady(true);
  }, []);

  const visibleTabs = useMemo(() => {
    if (!clientReady) return [];
    return DASHBOARD_MODULE_TABS.filter((tab) => {
      if (isSuperAdmin()) return true;
      const perms = MODULE_ACCESS_MAP[tab.label] || tab.permissions;
      return hasAnyPermission(perms);
    });
  }, [clientReady, hasAnyPermission, isSuperAdmin]);

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

  return (
    <div className="space-y-6">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-slate-900">
          <LayoutDashboard className="text-indigo-600" size={26} />
          Dashboard
        </h1>
        <p className="mt-0.5 text-sm text-slate-500">
          Module command centers with custom widgets per module.
        </p>
      </header>

      {!clientReady ? (
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
          />

          <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm sm:p-6">
            <ModuleCommandCenter moduleKey={activeModule} overview={overview} />
          </div>
        </>
      ) : (
        <p className="text-sm text-slate-500">You do not have access to any dashboard modules.</p>
      )}
    </div>
  );
}
