import type { DashboardCatalog } from './types';
import type { ModuleTabKey } from './moduleCommandConfig';

export const CATALOG_MODULE_TO_TAB_KEY: Record<string, ModuleTabKey> = {
  Leads: 'leads',
  Clients: 'clients',
  Jobs: 'jobs',
  Candidates: 'candidates',
  Interviews: 'interviews',
  Placements: 'placements',
  'Task and activity': 'tasks',
  Team: 'team',
  Departments: 'departments',
};

export function permittedTabKeysFromCatalog(
  catalog: DashboardCatalog,
  options?: { includeMatches?: boolean; includePipeline?: boolean },
): Set<ModuleTabKey> {
  const keys = new Set<ModuleTabKey>();
  for (const mod of catalog.modules || []) {
    const key = CATALOG_MODULE_TO_TAB_KEY[mod.name];
    if (key) keys.add(key);
  }
  const datasetIds = new Set((catalog.datasets || []).map((d) => d.id));
  if (options?.includePipeline && datasetIds.has('candidates_pipeline')) {
    keys.add('pipeline');
  }
  if (options?.includeMatches) {
    keys.add('matches');
  }
  return keys;
}

export function allowedDatasetIdsFromCatalog(catalog: DashboardCatalog): Set<string> {
  return new Set((catalog.datasets || []).map((d) => d.id));
}
