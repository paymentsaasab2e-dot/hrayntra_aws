'use client';

import React from 'react';
import type { ClientCommandCenterTab } from '@/lib/dashboard/commandCenterTableFilter';

const CLIENT_TAB_OPTIONS: { value: ClientCommandCenterTab; label: string }[] = [
  { value: 'all', label: 'All Clients' },
  { value: 'active', label: 'Active' },
  { value: 'on-hold', label: 'On Hold' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'hot', label: 'Hot' },
];

type Props = {
  value: ClientCommandCenterTab;
  onChange: (tab: ClientCommandCenterTab) => void;
  disabled?: boolean;
};

/** Status category for client KPI cards (same tabs as /client page). */
export function KpiCardClientTabSelect({ value, onChange, disabled }: Props) {
  return (
    <label className="block space-y-1">
      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Status</span>
      <select
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value as ClientCommandCenterTab)}
        className="w-full rounded-lg border border-indigo-200/90 bg-white px-2.5 py-2 text-sm font-medium text-slate-800 shadow-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 disabled:opacity-60"
      >
        {CLIENT_TAB_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export { CLIENT_TAB_OPTIONS };
