import { apiFetch } from '../api';
import type {
  DashboardCatalog,
  DashboardWidget,
  DatasetAnalysis,
  DatasetPayload,
  WidgetFilters,
} from './types';

function filtersToQuery(filters?: WidgetFilters) {
  if (!filters) return '';
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value != null && String(value).trim() !== '') {
      params.set(key, String(value));
    }
  }
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export async function apiDashboardCatalog(): Promise<DashboardCatalog> {
  const res = await apiFetch<DashboardCatalog>('/dashboard/catalog', { auth: true });
  return {
    datasets: res.data.datasets || [],
    modules: res.data.modules || [],
  };
}

export async function apiDashboardDataset(datasetId: string, filters?: WidgetFilters) {
  const res = await apiFetch<DatasetPayload>(
    `/dashboard/data/${encodeURIComponent(datasetId)}${filtersToQuery(filters)}`,
    { auth: true }
  );
  return res.data;
}

export async function apiDashboardAnalyze(rows: Record<string, unknown>[]) {
  const res = await apiFetch<DatasetAnalysis>('/dashboard/analyze', {
    method: 'POST',
    auth: true,
    body: { rows },
  });
  return res.data;
}

export async function apiDashboardGetLayout() {
  const res = await apiFetch<{ widgets: DashboardWidget[] }>('/dashboard/layout', { auth: true });
  return res.data.widgets || [];
}

export async function apiDashboardSaveLayout(widgets: DashboardWidget[]) {
  const res = await apiFetch<{ widgets: DashboardWidget[] }>('/dashboard/layout', {
    method: 'PUT',
    auth: true,
    body: { widgets },
  });
  return res.data.widgets || [];
}
