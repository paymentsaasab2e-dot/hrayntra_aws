/**
 * Dashboard dataset permissions — kept in sync with frontphase2/src/lib/rbac/moduleAccess.ts
 */
export const DASHBOARD_MODULE_PERMISSIONS = {
  Leads: ['leads_create', 'leads_read', 'leads_update', 'leads_delete', 'view_all_leads'],
  Clients: [
    'clients_create', 'clients_read', 'clients_update', 'clients_delete',
    'view_all_clients', 'clients_handoff',
  ],
  RecruitmentClients: [
    'recruitment_clients_create', 'recruitment_clients_read', 'recruitment_clients_update',
    'recruitment_clients_delete', 'view_all_recruitment_clients',
  ],
  Jobs: [
    'jobs_create', 'jobs_read', 'jobs_update', 'jobs_delete', 'assign_job',
    'view_all_jobs', 'create_job', 'edit_job', 'delete_job', 'view_jobs',
  ],
  Candidates: [
    'candidates_create', 'candidates_read', 'candidates_update', 'candidates_delete',
    'view_all_candidates', 'view_assigned_candidates', 'add_candidate', 'edit_candidate',
    'delete_candidate', 'move_pipeline', 'submit_candidate',
  ],
  Interviews: ['interviews_create', 'interviews_read', 'interviews_update', 'interviews_delete'],
  Placements: ['placements_create', 'placements_read', 'placements_update', 'placements_delete'],
  'Task and activity': ['tasks_create', 'tasks_read', 'tasks_update', 'tasks_delete'],
  Team: [
    'view_team', 'add_team_member', 'edit_team_member', 'assign_roles', 'manage_roles',
    'generate_credentials', 'manage_commission', 'manage_targets', 'view_team_activity',
  ],
  Departments: ['add_team_member', 'manage_settings', 'view_team'],
  Pipeline: ['pipeline_read', 'pipeline_manage', 'move_pipeline'],
  Matches: ['matches_read', 'matches_manage'],
  Reports: ['reports_create', 'reports_read', 'reports_update', 'reports_delete'],
  Request: [
    'requests_create', 'requests_read', 'requests_update', 'requests_delete', 'view_all_requests',
  ],
};

export const CATALOG_MODULE_TO_TAB_KEY = {
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

export const ALL_DASHBOARD_TAB_KEYS = [
  'leads',
  'clients',
  'jobs',
  'candidates',
  'interviews',
  'placements',
  'pipeline',
  'matches',
  'tasks',
  'team',
  'departments',
];

/** Role-name → preferred visible tabs (subset of permitted). */
export const ROLE_DEFAULT_TAB_KEYS = {
  Manager: ['leads', 'clients', 'jobs', 'candidates', 'tasks'],
  'Line Manager': ['tasks', 'team'],
  Viewer: ['leads', 'clients', 'jobs', 'candidates', 'interviews', 'placements', 'tasks'],
  Recruiter: ['candidates', 'jobs', 'interviews', 'tasks'],
  'HR Manager': ['candidates', 'interviews', 'placements', 'tasks', 'team'],
};
