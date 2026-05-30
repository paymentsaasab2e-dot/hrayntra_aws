'use client';

import React from 'react';
import { LEAD_PIPELINE_STATUS_OPTIONS } from '@/lib/dashboard/statusFilterOptions';
import type { DashboardFilterDef, WidgetFilters } from '@/lib/dashboard/types';

type Props = {
  definitions: DashboardFilterDef[];
  values: WidgetFilters;
  onChange: (next: WidgetFilters) => void;
  disabled?: boolean;
};

/** Status dropdown for KPI cards (matches Leads filter picker). */
export function KpiCardStatusSelect({ definitions, values, onChange, disabled }: Props) {
  const statusDef = definitions.find((d) => d.key === 'status');
  const options =
    statusDef?.options?.length && statusDef.options.length > 1
      ? statusDef.options
      : LEAD_PIPELINE_STATUS_OPTIONS;

  return (
    <label className="block space-y-1">
      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Status</span>
      <select
        value={values.status ?? 'all'}
        disabled={disabled}
        onChange={(e) => onChange({ ...values, status: e.target.value })}
        className="w-full rounded-lg border border-indigo-200/90 bg-white px-2.5 py-2 text-sm font-medium text-slate-800 shadow-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 disabled:opacity-60"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  );
}
