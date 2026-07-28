'use client';

import React, { createContext, useContext, useMemo, useState } from 'react';
import type { DrillDownPayload, SmartDashboardFilters } from '@/lib/dashboard/api';

export type EnterpriseSectionId =
  | 'kpis'
  | 'summary'
  | 'alerts'
  | 'pipelines'
  | 'analytics'
  | 'performance'
  | 'team'
  | 'calendar'
  | 'timeline'
  | 'chat';

export const ENTERPRISE_SECTIONS: Array<{ id: EnterpriseSectionId; label: string }> = [
  { id: 'kpis', label: 'KPI Cards' },
  { id: 'summary', label: 'AI Insights + Pipeline' },
  { id: 'alerts', label: 'Notifications' },
  { id: 'pipelines', label: 'Pipeline Overview' },
  { id: 'analytics', label: 'Charts & Credits' },
  { id: 'performance', label: 'Revenue Trend' },
  { id: 'team', label: 'Top Recruiters' },
  { id: 'calendar', label: "Today's Schedule" },
  { id: 'timeline', label: 'Activities & Follow-ups' },
  { id: 'chat', label: 'HRYANTRA Brain' },
];

type EnterpriseDashboardContextValue = {
  filters: SmartDashboardFilters;
  setFilters: React.Dispatch<React.SetStateAction<SmartDashboardFilters>>;
  hiddenSections: Set<string>;
  toggleSection: (id: string) => void;
  compact: boolean;
  setCompact: (v: boolean) => void;
  darkMode: boolean;
  setDarkMode: (v: boolean) => void;
  refreshKey: number;
  bumpRefresh: () => void;
  drillDown: DrillDownPayload | null;
  openDrillDown: (payload: DrillDownPayload) => void;
  closeDrillDown: () => void;
  savedView: string;
  setSavedView: (v: string) => void;
};

const EnterpriseDashboardContext = createContext<EnterpriseDashboardContextValue | null>(null);

export function EnterpriseDashboardProvider({
  children,
  initialHidden = [],
  initialCompact = false,
  onHiddenChange,
  onCompactChange,
}: {
  children: React.ReactNode;
  initialHidden?: string[];
  initialCompact?: boolean;
  onHiddenChange?: (hidden: string[]) => void;
  onCompactChange?: (compact: boolean) => void;
}) {
  const [filters, setFilters] = useState<SmartDashboardFilters>({ dateRange: 'last_30_days' });
  const [hidden, setHidden] = useState<string[]>(initialHidden);
  const [compact, setCompactState] = useState(initialCompact);
  const [darkMode, setDarkMode] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [drillDown, setDrillDown] = useState<DrillDownPayload | null>(null);
  const [savedView, setSavedView] = useState('Executive');

  const value = useMemo<EnterpriseDashboardContextValue>(
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
      compact,
      setCompact: (v: boolean) => {
        setCompactState(v);
        onCompactChange?.(v);
      },
      darkMode,
      setDarkMode,
      refreshKey,
      bumpRefresh: () => setRefreshKey((k) => k + 1),
      drillDown,
      openDrillDown: setDrillDown,
      closeDrillDown: () => setDrillDown(null),
      savedView,
      setSavedView,
    }),
    [filters, hidden, compact, darkMode, refreshKey, drillDown, savedView, onHiddenChange, onCompactChange],
  );

  return (
    <EnterpriseDashboardContext.Provider value={value}>{children}</EnterpriseDashboardContext.Provider>
  );
}

export function useEnterpriseDashboard() {
  const ctx = useContext(EnterpriseDashboardContext);
  if (!ctx) throw new Error('useEnterpriseDashboard requires EnterpriseDashboardProvider');
  return ctx;
}
