'use client';

import React from 'react';
import type { CrmOverview } from '@/lib/dashboard/api';
import { buildKpiDrillDown } from './crmDrillDown';
import type { CrmComboMetric } from './crmInsights';
import { CrmMetricGrid, CrmMetricPanel } from './crmMetricUi';
import { useCrmDashboard } from './crmShared';

type Props = {
  title: string;
  subtitle?: string;
  metrics: CrmComboMetric[];
  overview: CrmOverview | null;
  limit?: number;
  columns?: 2 | 3 | 4;
  accent?: 'indigo' | 'blue' | 'emerald' | 'violet';
  size?: 'sm' | 'md' | 'lg';
};

export function CrmStatsBar({
  title,
  subtitle,
  metrics,
  overview,
  limit = 4,
  columns = 4,
  accent = 'blue',
  size = 'md',
}: Props) {
  const { openDrillDown } = useCrmDashboard();
  const rows = metrics.slice(0, limit);

  if (!rows.length) return null;

  const openMetric = (metric: CrmComboMetric) => {
    if (metric.href) {
      openDrillDown(buildKpiDrillDown(overview, metric.key, metric.label, metric.href));
    }
  };

  return (
    <CrmMetricPanel title={title} subtitle={subtitle} accent={accent}>
      <CrmMetricGrid
        metrics={rows}
        onMetricClick={openMetric}
        columns={columns}
        size={size}
      />
    </CrmMetricPanel>
  );
}
