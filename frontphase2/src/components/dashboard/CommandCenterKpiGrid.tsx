'use client';

import React from 'react';
import { BarChart3 } from 'lucide-react';
import { SummaryCard, type SummaryCardColor } from '@/components/ui/SummaryCard';
import type { KpiDef } from '@/lib/dashboard/moduleCommandConfig';

type Props = {
  kpis: KpiDef[];
  compact?: boolean;
};

/** KPI row matching list-page SummaryCard tiles (Total leads, New, Qualified, …). */
export function CommandCenterKpiGrid({ kpis, compact = false }: Props) {
  if (!kpis.length) {
    return (
      <p className="py-4 text-center text-sm text-slate-500">No KPI data for this module.</p>
    );
  }

  return (
    <div
      className={`grid gap-2 sm:gap-3 ${
        compact
          ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5'
          : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5'
      }`}
    >
      {kpis.map((k) => (
        <SummaryCard
          key={k.label}
          label={k.label}
          count={k.value}
          color={k.color as SummaryCardColor}
          icon={<BarChart3 size={16} strokeWidth={2.25} />}
        />
      ))}
    </div>
  );
}
