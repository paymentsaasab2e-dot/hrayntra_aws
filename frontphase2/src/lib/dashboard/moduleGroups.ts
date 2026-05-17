import type { DashboardCatalog, DashboardWidget } from './types';

/** Matches backend `DASHBOARD_MODULE_ORDER`. */
export const DASHBOARD_MODULE_ORDER = [
  'Leads',
  'Clients',
  'Jobs',
  'Candidates',
  'Interviews',
  'Placements',
  'Task and activity',
  'Team',
  'Departments',
] as const;

export const DATASET_TO_MODULE: Record<string, string> = {
  leads: 'Leads',
  clients: 'Clients',
  clients_metrics: 'Clients',
  jobs: 'Jobs',
  jobs_metrics: 'Jobs',
  candidates: 'Candidates',
  candidates_pipeline: 'Candidates',
  interviews: 'Interviews',
  interviews_kpis: 'Interviews',
  placements: 'Placements',
  placements_stats: 'Placements',
  tasks_and_activity: 'Task and activity',
  tasks: 'Task and activity',
  activities: 'Task and activity',
  team: 'Team',
  departments: 'Departments',
};

const LEGACY_DATASET_IDS: Record<string, string> = {
  tasks: 'tasks_and_activity',
  activities: 'tasks_and_activity',
};

export function resolveDatasetId(datasetId: string) {
  return LEGACY_DATASET_IDS[datasetId] || datasetId;
}

export function moduleForDatasetId(datasetId: string, catalog?: DashboardCatalog | null): string {
  const resolved = resolveDatasetId(datasetId);
  if (catalog?.datasets?.length) {
    const meta = catalog.datasets.find((d) => d.id === resolved);
    if (meta?.module) return meta.module;
  }
  return DATASET_TO_MODULE[resolved] || 'Other';
}

export function resolveWidgetModule(widget: DashboardWidget, catalog?: DashboardCatalog | null): string {
  if (widget.module?.trim()) return widget.module.trim();
  return moduleForDatasetId(widget.datasetId, catalog);
}

export function hydrateWidgets(widgets: DashboardWidget[], catalog?: DashboardCatalog | null): DashboardWidget[] {
  return widgets.map((w) => ({
    ...w,
    module: resolveWidgetModule(w, catalog),
  }));
}

export type DashboardSection = {
  module: string;
  widgets: DashboardWidget[];
};

export function groupWidgetsByModule(
  widgets: DashboardWidget[],
  catalog?: DashboardCatalog | null
): DashboardSection[] {
  const hydrated = hydrateWidgets(widgets, catalog);
  const byModule = new Map<string, DashboardWidget[]>();

  for (const widget of hydrated) {
    const mod = resolveWidgetModule(widget, catalog);
    const list = byModule.get(mod) || [];
    list.push(widget);
    byModule.set(mod, list);
  }

  const ordered: DashboardSection[] = [];
  for (const name of DASHBOARD_MODULE_ORDER) {
    const list = byModule.get(name);
    if (list?.length) ordered.push({ module: name, widgets: list });
  }

  for (const [name, list] of byModule.entries()) {
    if (!DASHBOARD_MODULE_ORDER.includes(name as (typeof DASHBOARD_MODULE_ORDER)[number])) {
      ordered.push({ module: name, widgets: list });
    }
  }

  return ordered;
}
