'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  apiDashboardOverview,
  type DashboardOverview,
} from '@/lib/dashboard/api';
import { useDashboardLayoutStore } from '@/lib/dashboard/DashboardLayoutProvider';
import {
  EnterpriseDashboardProvider,
  useEnterpriseDashboard,
} from './smartDashboardFilters';
import { SmartDashboardHeader } from './SmartDashboardHeader';
import { SmartKpiGrid } from './SmartKpiGrid';
import { MiddleInsightsRow } from './MiddleInsightsRow';
import { AnalyticsWidgetsRow } from './AnalyticsWidgetsRow';
import { BottomOpsRow } from './BottomOpsRow';
import { DashboardBrainChat } from './DashboardBrainChat';
import { DrillDownModal } from './DrillDownModal';

const POLL_MS = 60_000;

function EnterpriseSmartDashboardInner() {
  const { filters, refreshKey, hiddenSections } = useEnterpriseDashboard();
  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiDashboardOverview(filters);
      setOverview(data);
    } catch (error: any) {
      setOverview(null);
      toast.error(error?.message || 'Failed to load command center');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  useEffect(() => {
    const id = window.setInterval(() => {
      void apiDashboardOverview(filters)
        .then((data) => setOverview(data))
        .catch(() => undefined);
    }, POLL_MS);
    return () => window.clearInterval(id);
  }, [filters]);

  const show = (id: string) => !hiddenSections.has(id);

  return (
    <div className="min-h-full space-y-5 rounded-[24px] bg-[#F8FAFC] p-1 sm:p-2">
      <SmartDashboardHeader overview={overview} loading={loading} onRefresh={() => void load()} />

      {show('kpis') ? <SmartKpiGrid overview={overview} loading={loading} /> : null}

      {show('summary') || show('pipelines') || show('performance') ? (
        <MiddleInsightsRow overview={overview} loading={loading} />
      ) : null}

      {show('analytics') || show('team') ? (
        <AnalyticsWidgetsRow overview={overview} loading={loading} />
      ) : null}

      {show('timeline') || show('calendar') || show('alerts') ? (
        <BottomOpsRow overview={overview} loading={loading} />
      ) : null}

      {show('chat') ? <DashboardBrainChat /> : null}

      {overview?.generatedAt ? (
        <p className="pb-2 text-center text-[11px] text-slate-400">
          Last updated {new Date(overview.generatedAt).toLocaleString()}
        </p>
      ) : null}

      <DrillDownModal />
    </div>
  );
}

function EnterpriseSmartDashboardWithPersistence() {
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
        enterprise: { ...(layout.enterprise || {}), hiddenSections },
      };
      setLayout(next);
      void saveLayout(next);
    },
    [layout, setLayout, saveLayout],
  );

  const onCompactChange = useCallback(
    (compact: boolean) => {
      const next = {
        ...layout,
        version: 2 as const,
        enterprise: { ...(layout.enterprise || {}), compact },
      };
      setLayout(next);
      void saveLayout(next);
    },
    [layout, setLayout, saveLayout],
  );

  if (!ready) {
    return (
      <div className="space-y-4 rounded-[24px] bg-[#F8FAFC] p-2">
        <div className="h-24 animate-pulse rounded-[20px] bg-white" />
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-8">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-[118px] animate-pulse rounded-[20px] bg-white" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <EnterpriseDashboardProvider
      initialHidden={layout.enterprise?.hiddenSections || []}
      initialCompact={Boolean(layout.enterprise?.compact)}
      onHiddenChange={onHiddenChange}
      onCompactChange={onCompactChange}
    >
      <EnterpriseSmartDashboardInner />
    </EnterpriseDashboardProvider>
  );
}

export function EnterpriseSmartDashboard() {
  return <EnterpriseSmartDashboardWithPersistence />;
}
