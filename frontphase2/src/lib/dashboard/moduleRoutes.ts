/** List-page routes for dashboard “View all” links (matches Sidenav). */
const MODULE_LIST_ROUTES: Record<string, string> = {
  Leads: '/leads',
  Clients: '/client',
  Jobs: '/job',
  Candidates: '/candidate',
  Interviews: '/interviews',
  Placements: '/placement',
  'Task and activity': '/Task&Activites',
  Team: '/team',
  Departments: '/team?tab=departments',
};

const DATASET_LIST_ROUTES: Record<string, string> = {
  leads: '/leads',
  clients: '/client',
  clients_metrics: '/client',
  jobs: '/job',
  jobs_metrics: '/job',
  candidates: '/candidate',
  candidates_pipeline: '/candidate',
  interviews: '/interviews',
  interviews_kpis: '/interviews',
  placements: '/placement',
  placements_stats: '/placement',
  tasks_and_activity: '/Task&Activites',
  tasks: '/Task&Activites',
  activities: '/Task&Activites',
  team: '/team',
  departments: '/team?tab=departments',
  pipeline: '/job',
  matches: '/matches',
};

export function getModuleListRoute(moduleOrDataset: string | undefined | null): string | null {
  if (!moduleOrDataset?.trim()) return null;
  const key = moduleOrDataset.trim();
  if (DATASET_LIST_ROUTES[key]) return DATASET_LIST_ROUTES[key];
  if (MODULE_LIST_ROUTES[key]) return MODULE_LIST_ROUTES[key];
  return null;
}
