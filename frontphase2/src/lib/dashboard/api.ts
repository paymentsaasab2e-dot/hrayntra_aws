import { apiFetch } from '../api';
import type {
  DashboardCatalog,
  DashboardWidget,
  DatasetAnalysis,
  DatasetPayload,
  WidgetFilters,
} from './types';
import type { DashboardLayoutV2 } from './layoutV2';

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

export type DashboardOverview = {
  kpis: {
    leads: number;
    clients: number;
    activeJobs: number;
    candidates: number;
    interviews: number;
    placements: number;
    revenue: number;
    tasksDueToday: number;
    tasksCompleted?: number;
    callsMade?: number;
    emailsSent?: number;
  };
  pipelineFunnel?: Array<{ name: string; value: number }>;
  teamLeaderboard?: Array<Record<string, unknown>>;
  recruitmentTrend?: Array<Record<string, unknown>>;
};

export async function apiDashboardOverview() {
  const res = await apiFetch<DashboardOverview>('/dashboard/overview', { auth: true });
  return res.data;
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

export async function apiDashboardGetLayout(): Promise<DashboardLayoutV2 | DashboardWidget[]> {
  const res = await apiFetch<{ layout?: unknown; widgets?: unknown }>('/dashboard/layout', {
    auth: true,
  });
  return (res.data.layout ?? res.data.widgets ?? { version: 2, modules: {} }) as
    | DashboardLayoutV2
    | DashboardWidget[];
}

export async function apiDashboardSaveLayout(layout: DashboardLayoutV2) {
  const res = await apiFetch<{ layout?: DashboardLayoutV2; widgets?: DashboardLayoutV2 }>(
    '/dashboard/layout',
    {
      method: 'PUT',
      auth: true,
      body: { layout },
    },
  );
  return (res.data.layout ?? res.data.widgets ?? layout) as DashboardLayoutV2;
}
