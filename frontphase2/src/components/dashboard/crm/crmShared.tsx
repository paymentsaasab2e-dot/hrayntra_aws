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

/** Legacy customize panel — maps to category tabs where possible. */
export const CRM_SECTIONS: Array<{ id: CrmSectionId; label: string }> = [
  { id: 'followups', label: 'Insights & follow-ups' },
  { id: 'charts', label: 'Pipeline & records' },
  { id: 'team', label: 'Team & outreach' },
  { id: 'alerts', label: 'Alerts sidebar' },
];

export type CrmCategoryTabId = 'mine' | 'insights' | 'portfolio' | 'team' | 'people';

export const CRM_CATEGORY_TABS: Array<{
  id: CrmCategoryTabId;
  label: string;
  blurb: string;
}> = [
  {
    id: 'mine',
    label: 'My work',
    blurb: 'Your assigned records, tasks & approvals — separate from team stats',
  },
  {
    id: 'insights',
    label: 'Insights & actions',
    blurb: 'Today’s work, trends & follow-up visuals — then alerts',
  },
  {
    id: 'portfolio',
    label: 'Pipeline & records',
    blurb: 'Lead or client stats · search a record for health, timeline & outreach',
  },
  {
    id: 'team',
    label: 'Team & outreach',
    blurb: 'Team stats, recruiter performance & outreach activity',
  },
  {
    id: 'people',
    label: 'Hours & scores',
    blurb: 'Each person’s hours, utilization and scores vs the standard week (unlock with coins)',
  },
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

/** HQ-style glass card — matches platform analytics dashboards */
export const dashCard =
  'rounded-2xl border border-white/80 bg-white/90 shadow-[0_1px_0_rgba(255,255,255,0.85)_inset,0_18px_48px_-24px_rgba(15,23,42,0.14)] backdrop-blur-xl';

/** Tenant org default currency (ISO 4217), falls back to USD. */
export function getCrmCurrency(): string {
  if (typeof window === 'undefined') return 'USD';
  try {
    const v = localStorage.getItem('orgDefaultCurrency');
    return v && v.length === 3 ? v.toUpperCase() : 'USD';
  } catch {
    return 'USD';
  }
}

/** Locale-aware money for CRM dashboard (uses org default currency). */
export function formatMoney(
  value: number | null | undefined,
  currency?: string,
  options: { maximumFractionDigits?: number } = {},
) {
  if (value == null || !Number.isFinite(Number(value))) return '—';
  const n = Number(value);
  const code = (currency || getCrmCurrency()).toUpperCase();
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: code,
      maximumFractionDigits: options.maximumFractionDigits ?? (Math.abs(n) >= 1000 ? 0 : 2),
    }).format(n);
  } catch {
    return `${code} ${n.toLocaleString()}`;
  }
}

/** Compact money for dense stat tiles (e.g. $12.4k, €1.2M). */
export function formatMoneyCompact(value: number | null | undefined, currency?: string) {
  if (value == null || !Number.isFinite(Number(value))) return '—';
  const n = Number(value);
  const code = (currency || getCrmCurrency()).toUpperCase();
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: code,
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(n);
  } catch {
    if (Math.abs(n) >= 1_000_000) return `${code} ${(n / 1_000_000).toFixed(1)}M`;
    if (Math.abs(n) >= 1000) return `${code} ${(n / 1000).toFixed(1)}k`;
    return `${code} ${n.toFixed(0)}`;
  }
}

/** @deprecated Prefer formatMoney — kept so older CRM call sites keep working. */
export function formatInr(value: number | null | undefined) {
  return formatMoney(value);
}

export function formatNum(value: number | null | undefined) {
  if (value == null || !Number.isFinite(Number(value))) return '—';
  return Number(value).toLocaleString(undefined);
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
