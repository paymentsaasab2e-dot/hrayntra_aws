import type { ModuleTabKey } from './moduleCommandConfig';
import type { DashboardWidget } from './types';

export type ClientCommandCenterTab = 'all' | 'active' | 'on-hold' | 'inactive' | 'hot';

export type InterviewKpiSlug = 'today' | 'upcoming' | 'completed' | 'feedback-pending';

/** KPI bucket for interviews command center (matches module buildKpis logic). */
export function filterInterviewsByKpiSlug(
  rows: Record<string, unknown>[],
  slug: string | null | undefined,
): Record<string, unknown>[] {
  const key = String(slug || 'all').toLowerCase();
  if (key === 'all') return rows;

  const now = new Date();
  const todayStr = now.toDateString();

  switch (key) {
    case 'today':
      return rows.filter((row) => {
        if (!row.scheduledAt) return false;
        const d = new Date(String(row.scheduledAt));
        return !Number.isNaN(d.getTime()) && d.toDateString() === todayStr;
      });
    case 'upcoming':
      return rows.filter((row) => {
        if (!row.scheduledAt) return false;
        const d = new Date(String(row.scheduledAt));
        return !Number.isNaN(d.getTime()) && d > now;
      });
    case 'completed':
      return rows.filter((row) => String(row.status || '').toUpperCase() === 'COMPLETED');
    case 'feedback-pending':
      return rows.filter((row) => {
        const status = String(row.status || '').toUpperCase();
        return status === 'FEEDBACK_PENDING' || status === 'COMPLETED';
      });
    default:
      return rows;
  }
}

export function interviewSlugFromWidget(widget: DashboardWidget): string {
  const slug = widget.config?.kpiSlug;
  if (
    slug === 'today' ||
    slug === 'upcoming' ||
    slug === 'completed' ||
    slug === 'feedback-pending'
  ) {
    return slug;
  }
  return 'all';
}

/** Row field used for KPI status filtering on leads (pipeline status). */
export function commandCenterStatusField(moduleKey: ModuleTabKey): string {
  return moduleKey === 'clients' ? 'leadStatus' : 'status';
}

export function normalizeCommandCenterStatus(value: string | null | undefined) {
  const v = String(value || 'all').trim();
  return v.toLowerCase() === 'all' ? 'all' : v;
}

/** Same tab logic as /client page StatusCards. */
export function filterClientsByCommandCenterTab(
  rows: Record<string, unknown>[],
  tab: string | null | undefined,
): Record<string, unknown>[] {
  const key = String(tab || 'all').toLowerCase();
  switch (key) {
    case 'active':
      return rows.filter((row) => row.stage === 'Active');
    case 'on-hold':
      return rows.filter((row) => row.stage === 'On Hold');
    case 'inactive':
      return rows.filter((row) => row.stage === 'Inactive');
    case 'hot':
      return rows.filter((row) => String(row.priority || '') === 'High');
    case 'all':
    default:
      return rows;
  }
}

export function clientTabFromWidget(widget: DashboardWidget): ClientCommandCenterTab {
  const tab = widget.config?.clientTab;
  if (tab === 'active' || tab === 'on-hold' || tab === 'inactive' || tab === 'hot') return tab;
  return 'all';
}

export function filterRowsByCommandCenterStatus(
  moduleKey: ModuleTabKey,
  rows: Record<string, unknown>[],
  statusFilter: string | null | undefined,
) {
  if (moduleKey === 'clients') {
    return filterClientsByCommandCenterTab(rows, statusFilter);
  }
  if (moduleKey === 'interviews') {
    const slug = normalizeCommandCenterStatus(statusFilter);
    if (slug === 'all') return rows;
    return filterInterviewsByKpiSlug(rows, slug);
  }
  const filter = normalizeCommandCenterStatus(statusFilter);
  if (filter === 'all') return rows;
  const field = commandCenterStatusField(moduleKey);
  const want = filter.toLowerCase();
  return rows.filter((row) => String(row[field] ?? '').toLowerCase() === want);
}

export function kpiCardMatchesTableFilter(
  moduleKey: ModuleTabKey,
  widget: DashboardWidget,
  tableStatusFilter: string | null | undefined,
) {
  if (moduleKey === 'clients') {
    const cardTab = clientTabFromWidget(widget);
    const tableTab = String(tableStatusFilter || 'all').toLowerCase();
    if (cardTab === 'all') return tableTab === 'all';
    return tableTab === cardTab;
  }
  if (moduleKey === 'interviews') {
    const cardSlug = interviewSlugFromWidget(widget);
    const tableSlug = String(tableStatusFilter || 'all').toLowerCase();
    if (tableSlug === 'all') return false;
    return cardSlug === tableSlug;
  }
  const cardStatus = normalizeCommandCenterStatus(widget.config?.filters?.status);
  const tableStatus = normalizeCommandCenterStatus(tableStatusFilter);
  if (cardStatus === 'all') return tableStatus === 'all';
  return tableStatus === cardStatus;
}

export function kpiCardFilterKey(moduleKey: ModuleTabKey, widget: DashboardWidget): string {
  if (moduleKey === 'clients') return clientTabFromWidget(widget);
  if (moduleKey === 'interviews') return interviewSlugFromWidget(widget);
  return normalizeCommandCenterStatus(widget.config?.filters?.status);
}
