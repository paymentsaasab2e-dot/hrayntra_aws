'use client';

import React from 'react';
import type { DashboardFilterDef, WidgetFilters } from '../../lib/dashboard/types';

type Props = {
  definitions: DashboardFilterDef[];
  values: WidgetFilters;
  onChange: (next: WidgetFilters) => void;
  compact?: boolean;
};

export function DashboardFilterFields({ definitions, values, onChange, compact }: Props) {
  if (!definitions.length) return null;

  const gridClass = compact ? 'grid grid-cols-2 gap-2' : 'grid grid-cols-1 gap-3 sm:grid-cols-2';

  return (
    <div className={gridClass}>
      {definitions.map((def) => (
        <label key={def.key} className="space-y-1">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">{def.label}</span>
          <select
            value={values[def.key] ?? def.defaultValue ?? 'all'}
            onChange={(e) => onChange({ ...values, [def.key]: e.target.value })}
            className={`w-full rounded border border-slate-200 px-2 py-1.5 text-sm ${compact ? '' : 'rounded-xl px-3 py-2'}`}
          >
            {def.options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
      ))}
    </div>
  );
}
