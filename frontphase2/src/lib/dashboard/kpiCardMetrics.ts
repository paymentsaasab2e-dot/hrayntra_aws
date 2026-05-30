import {
  filterClientsByCommandCenterTab,
  filterInterviewsByKpiSlug,
  interviewSlugFromWidget,
} from './commandCenterTableFilter';
import type { DashboardWidget, WidgetFilters } from './types';

export type KpiMetricKind = 'count' | 'overdue_followups' | 'metric_value';

const DEFAULT_FILTERS: WidgetFilters = { dateRange: 'all', status: 'all' };

export function kpiWidgetFilters(widget: DashboardWidget): WidgetFilters {
  return { ...DEFAULT_FILTERS, ...(widget.config?.filters || {}) };
}

export function computeKpiValue(
  rows: Record<string, unknown>[],
  widget: DashboardWidget,
): number {
  if (widget.datasetId === 'clients' && widget.config?.clientTab) {
    return filterClientsByCommandCenterTab(rows, widget.config.clientTab).length;
  }

  if (widget.datasetId === 'interviews') {
    const slug = interviewSlugFromWidget(widget);
    if (slug !== 'all') {
      return filterInterviewsByKpiSlug(rows, slug).length;
    }
  }

  const metric = widget.config?.kpiMetric;
  if (metric === 'overdue_followups') {
    const now = new Date();
    return rows.filter((row) => {
      const raw = row.nextFollowUp;
      if (!raw) return false;
      const d = new Date(String(raw));
      return !Number.isNaN(d.getTime()) && d < now;
    }).length;
  }
  if (metric === 'metric_value') {
    const key = String(widget.config?.metricKey || '').toLowerCase();
    if (!key) return 0;
    const row = rows.find((r) => String(r.metric || '').toLowerCase().includes(key));
    return row ? Number(row.value ?? 0) : 0;
  }
  return rows.length;
}
