'use client';

import React, { createContext, useContext, useMemo, useState } from 'react';
import type { DrillDownPayload, RecruitmentDashboardFilters } from '@/lib/dashboard/api';

export type RecSectionId =
  | 'kpis'
  | 'charts'
  | 'tables'
  | 'schedule'
  | 'team'
  | 'alerts'
  | 'modules';

export const REC_SECTIONS: Array<{ id: RecSectionId; label: string }> = [
  { id: 'kpis', label: 'KPI Cards' },
  { id: 'charts', label: 'Pipeline & Charts' },
  { id: 'tables', label: 'Jobs & Candidates' },
  { id: 'schedule', label: 'Interview Schedule' },
  { id: 'team', label: 'Team Performance' },
  { id: 'alerts', label: 'Alerts' },
  { id: 'modules', label: 'Module Shortcuts' },
];

type RecDashboardContextValue = {
  filters: RecruitmentDashboardFilters;
  setFilters: React.Dispatch<React.SetStateAction<RecruitmentDashboardFilters>>;
  hiddenSections: Set<string>;
  toggleSection: (id: string) => void;
  refreshKey: number;
  bumpRefresh: () => void;
  drillDown: DrillDownPayload | null;
  openDrillDown: (payload: DrillDownPayload) => void;
  closeDrillDown: () => void;
};

const RecDashboardContext = createContext<RecDashboardContextValue | null>(null);

export function RecDashboardProvider({
  children,
  initialHidden = [],
  onHiddenChange,
}: {
  children: React.ReactNode;
  initialHidden?: string[];
  onHiddenChange?: (hidden: string[]) => void;
}) {
  const [filters, setFilters] = useState<RecruitmentDashboardFilters>({ dateRange: 'last_30_days' });
  const [hidden, setHidden] = useState<string[]>(initialHidden);
  const [refreshKey, setRefreshKey] = useState(0);
  const [drillDown, setDrillDown] = useState<DrillDownPayload | null>(null);

  const value = useMemo<RecDashboardContextValue>(
    () => ({
      filters,
      setFilters,
      hiddenSections: new Set(hidden),
      toggleSection: (id: string) => {
        setHidden((prev) => {
          const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
          onHiddenChange?.(next);
          return next;
        });
      },
      refreshKey,
      bumpRefresh: () => setRefreshKey((k) => k + 1),
      drillDown,
      openDrillDown: setDrillDown,
      closeDrillDown: () => setDrillDown(null),
    }),
    [filters, hidden, refreshKey, drillDown, onHiddenChange],
  );

  return <RecDashboardContext.Provider value={value}>{children}</RecDashboardContext.Provider>;
}

export function useRecDashboard() {
  const ctx = useContext(RecDashboardContext);
  if (!ctx) throw new Error('useRecDashboard requires RecDashboardProvider');
  return ctx;
}

export const recCard =
  'rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_20px_rgba(15,23,42,0.04)]';

export function formatInr(value: number | null | undefined) {
  if (value == null || !Number.isFinite(Number(value))) return '—';
  const n = Number(value);
  if (n >= 10_000_000) return `₹${(n / 10_000_000).toFixed(2)}Cr`;
  if (n >= 100_000) return `₹${(n / 100_000).toFixed(2)}L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(1)}k`;
  return `₹${n.toLocaleString('en-IN')}`;
}

export function formatNum(value: number | null | undefined) {
  if (value == null || !Number.isFinite(Number(value))) return '—';
  return Number(value).toLocaleString('en-IN');
}

export function relativeTime(iso?: string | null) {
  if (!iso) return '';
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return '';
  const mins = Math.round((Date.now() - t) / 60_000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}
