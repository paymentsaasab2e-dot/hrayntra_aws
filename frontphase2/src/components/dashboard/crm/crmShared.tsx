'use client';

import React, { createContext, useContext, useMemo, useState } from 'react';
import type { CrmDashboardFilters, DrillDownPayload } from '@/lib/dashboard/api';

export type CrmSectionId =
  | 'kpis'
  | 'charts'
  | 'tables'
  | 'followups'
  | 'team'
  | 'alerts';

export const CRM_SECTIONS: Array<{ id: CrmSectionId; label: string }> = [
  { id: 'kpis', label: 'KPI Cards' },
  { id: 'charts', label: 'Pie Charts' },
  { id: 'tables', label: 'Leads & Clients Tables' },
  { id: 'followups', label: 'Follow-ups' },
  { id: 'team', label: 'Team Performance' },
  { id: 'alerts', label: 'Alerts' },
];

type CrmDashboardContextValue = {
  filters: CrmDashboardFilters;
  setFilters: React.Dispatch<React.SetStateAction<CrmDashboardFilters>>;
  hiddenSections: Set<string>;
  toggleSection: (id: string) => void;
  refreshKey: number;
  bumpRefresh: () => void;
  drillDown: DrillDownPayload | null;
  openDrillDown: (payload: DrillDownPayload) => void;
  closeDrillDown: () => void;
};

const CrmDashboardContext = createContext<CrmDashboardContextValue | null>(null);

export function CrmDashboardProvider({
  children,
  initialHidden = [],
  onHiddenChange,
}: {
  children: React.ReactNode;
  initialHidden?: string[];
  onHiddenChange?: (hidden: string[]) => void;
}) {
  const [filters, setFilters] = useState<CrmDashboardFilters>({ dateRange: 'last_30_days' });
  const [hidden, setHidden] = useState<string[]>(initialHidden);
  const [refreshKey, setRefreshKey] = useState(0);
  const [drillDown, setDrillDown] = useState<DrillDownPayload | null>(null);

  const value = useMemo<CrmDashboardContextValue>(
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

  return <CrmDashboardContext.Provider value={value}>{children}</CrmDashboardContext.Provider>;
}

export function useCrmDashboard() {
  const ctx = useContext(CrmDashboardContext);
  if (!ctx) throw new Error('useCrmDashboard requires CrmDashboardProvider');
  return ctx;
}

export const crmCard =
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
