/**
 * Canonical RBAC permission catalog for Phase 2.
 * Keep in sync with frontphase2/src/lib/rbac/permissionCatalog.ts
 */
export const DEFAULT_PERMISSIONS = [
  // Leads
  { permissionName: 'leads_create', module: 'Leads', description: 'Create leads' },
  { permissionName: 'leads_read', module: 'Leads', description: 'View leads' },
  { permissionName: 'leads_update', module: 'Leads', description: 'Update leads' },
  { permissionName: 'leads_delete', module: 'Leads', description: 'Delete leads' },
  { permissionName: 'view_all_leads', module: 'Leads', description: 'View all leads in tenant' },

  // Clients
  { permissionName: 'clients_create', module: 'Clients', description: 'Create clients' },
  { permissionName: 'clients_read', module: 'Clients', description: 'View clients' },
  { permissionName: 'clients_update', module: 'Clients', description: 'Update clients' },
  { permissionName: 'clients_delete', module: 'Clients', description: 'Delete clients' },
  { permissionName: 'view_all_clients', module: 'Clients', description: 'View all clients in tenant' },
  { permissionName: 'clients_handoff', module: 'Clients', description: 'Hand off clients to another department' },

  // Jobs
  { permissionName: 'jobs_create', module: 'Jobs', description: 'Create jobs' },
  { permissionName: 'jobs_read', module: 'Jobs', description: 'View jobs' },
  { permissionName: 'jobs_update', module: 'Jobs', description: 'Update jobs' },
  { permissionName: 'jobs_delete', module: 'Jobs', description: 'Delete jobs' },
  { permissionName: 'assign_job', module: 'Jobs', description: 'Assign jobs to recruiters' },
  { permissionName: 'view_all_jobs', module: 'Jobs', description: 'View all jobs in tenant' },

  // Candidates
  { permissionName: 'candidates_create', module: 'Candidates', description: 'Create candidates' },
  { permissionName: 'candidates_read', module: 'Candidates', description: 'View candidates' },
  { permissionName: 'candidates_update', module: 'Candidates', description: 'Update candidates' },
  { permissionName: 'candidates_delete', module: 'Candidates', description: 'Delete candidates' },
  { permissionName: 'view_all_candidates', module: 'Candidates', description: 'View all candidates in tenant' },
  { permissionName: 'view_assigned_candidates', module: 'Candidates', description: 'View only assigned candidates' },
  { permissionName: 'move_pipeline', module: 'Candidates', description: 'Move candidates in pipeline' },
  { permissionName: 'submit_candidate', module: 'Candidates', description: 'Submit candidates to jobs' },

  // Interviews
  { permissionName: 'interviews_create', module: 'Interviews', description: 'Schedule interviews' },
  { permissionName: 'interviews_read', module: 'Interviews', description: 'View interviews' },
  { permissionName: 'interviews_update', module: 'Interviews', description: 'Update interviews' },
  { permissionName: 'interviews_delete', module: 'Interviews', description: 'Cancel or delete interviews' },

  // Placements
  { permissionName: 'placements_create', module: 'Placements', description: 'Create placements' },
  { permissionName: 'placements_read', module: 'Placements', description: 'View placements' },
  { permissionName: 'placements_update', module: 'Placements', description: 'Update placements' },
  { permissionName: 'placements_delete', module: 'Placements', description: 'Delete placements' },

  // Contacts
  { permissionName: 'contacts_create', module: 'Contacts', description: 'Create contacts' },
  { permissionName: 'contacts_read', module: 'Contacts', description: 'View contacts' },
  { permissionName: 'contacts_update', module: 'Contacts', description: 'Update contacts' },
  { permissionName: 'contacts_delete', module: 'Contacts', description: 'Delete contacts' },

  // Tasks
  { permissionName: 'tasks_create', module: 'Tasks', description: 'Create tasks' },
  { permissionName: 'tasks_read', module: 'Tasks', description: 'View tasks' },
  { permissionName: 'tasks_update', module: 'Tasks', description: 'Update tasks' },
  { permissionName: 'tasks_delete', module: 'Tasks', description: 'Delete tasks' },

  // Pipeline
  { permissionName: 'pipeline_read', module: 'Pipeline', description: 'View pipeline boards' },
  { permissionName: 'pipeline_manage', module: 'Pipeline', description: 'Move stages and manage pipeline' },

  // Matches
  { permissionName: 'matches_read', module: 'Matches', description: 'View candidate–job matches' },
  { permissionName: 'matches_manage', module: 'Matches', description: 'Save, submit, or reject matches' },

  // Agreements
  { permissionName: 'agreements_read', module: 'Agreements', description: 'View agreements' },
  { permissionName: 'agreements_manage', module: 'Agreements', description: 'Create or update agreements' },

  // Inbox
  { permissionName: 'inbox_read', module: 'Inbox', description: 'View inbox messages' },
  { permissionName: 'inbox_manage', module: 'Inbox', description: 'Send and manage inbox messages' },

  // Calendar
  { permissionName: 'calendar_read', module: 'Calendar', description: 'View calendar' },
  { permissionName: 'calendar_manage', module: 'Calendar', description: 'Create or edit calendar events' },

  // Reports
  { permissionName: 'reports_create', module: 'Reports / Analytics', description: 'Create custom reports' },
  { permissionName: 'reports_read', module: 'Reports / Analytics', description: 'View reports and analytics' },
  { permissionName: 'reports_update', module: 'Reports / Analytics', description: 'Update reports' },
  { permissionName: 'reports_delete', module: 'Reports / Analytics', description: 'Delete reports' },

  // Billing
  { permissionName: 'access_billing', module: 'Billing', description: 'Access billing module' },
  { permissionName: 'create_invoice', module: 'Billing', description: 'Create and send invoices' },
  { permissionName: 'record_payment', module: 'Billing', description: 'Record payments' },
  { permissionName: 'manage_billing_settings', module: 'Billing', description: 'Manage billing settings' },

  // Team
  { permissionName: 'view_team', module: 'Team', description: 'View team directory' },
  { permissionName: 'add_team_member', module: 'Team', description: 'Add team members' },
  { permissionName: 'edit_team_member', module: 'Team', description: 'Edit or deactivate team members' },
  { permissionName: 'assign_roles', module: 'Team', description: 'Assign roles to members' },
  { permissionName: 'manage_roles', module: 'Team', description: 'Create and edit roles & permissions' },
  { permissionName: 'generate_credentials', module: 'Team', description: 'Generate login credentials' },
  { permissionName: 'manage_commission', module: 'Team', description: 'Manage commission rules' },
  { permissionName: 'manage_targets', module: 'Team', description: 'Manage recruiter targets' },
  { permissionName: 'view_team_activity', module: 'Team', description: 'View team login and activity logs' },

  // Request
  { permissionName: 'requests_create', module: 'Request', description: 'Send requests' },
  { permissionName: 'requests_read', module: 'Request', description: 'View requests' },
  { permissionName: 'requests_update', module: 'Request', description: 'Update request status' },
  { permissionName: 'requests_delete', module: 'Request', description: 'Cancel or delete requests' },
  { permissionName: 'view_all_requests', module: 'Request', description: 'View all requests in tenant' },

  // System
  { permissionName: 'manage_settings', module: 'System', description: 'Manage organization settings' },
  { permissionName: 'access_integrations', module: 'System', description: 'Access integrations' },
  { permissionName: 'export_data', module: 'System', description: 'Export data to CSV or files' },
  { permissionName: 'view_activity_log', module: 'System', description: 'View company activity feed' },
  { permissionName: 'recycle_bin_manage', module: 'System', description: 'Restore or purge recycle bin items' },
  { permissionName: 'view_dashboard', module: 'System', description: 'View main dashboard' },
  { permissionName: 'org_structure', module: 'Organization', description: 'Create and edit the company tree (HQ, companies, sites)' },
  { permissionName: 'node_org_structure', module: 'Organization', description: 'Manage sites and people under your own company node' },
  {
    permissionName: 'dash_full_scope',
    module: 'System',
    description:
      'Complete dashboard stats: see all records on allowed CRM/Recruitment tabs. Rank 1 and Super Admin already have this. Tick for a Rank 2+ deputy.',
  },
  {
    permissionName: 'dash_mine_approvals',
    module: 'System',
    description:
      'My work: include the approvals bucket (team requests, task completion, lead conversion, cross-dept). Super Admin and Rank 1 have this on by default. Tick for other roles that have Approvals / request / task permissions.',
  },
  { permissionName: 'dash_crm_insights', module: 'CRM Dashboard', description: 'CRM dashboard tab: Insights & actions' },
  { permissionName: 'dash_crm_pipeline', module: 'CRM Dashboard', description: 'CRM dashboard tab: Pipeline & records' },
  { permissionName: 'dash_crm_team', module: 'CRM Dashboard', description: 'CRM dashboard tab: Team & outreach' },
  { permissionName: 'dash_crm_people', module: 'CRM Dashboard', description: 'CRM dashboard tab: People intel' },
  { permissionName: 'dash_rec_insights', module: 'Recruitment Dashboard', description: 'Recruitment dashboard tab: Insights & actions' },
  { permissionName: 'dash_rec_pipeline', module: 'Recruitment Dashboard', description: 'Recruitment dashboard tab: Pipeline & records' },
  { permissionName: 'dash_rec_team', module: 'Recruitment Dashboard', description: 'Recruitment dashboard tab: Team & performance' },
  { permissionName: 'dash_rec_people', module: 'Recruitment Dashboard', description: 'Recruitment dashboard tab: People intel' },
];

export const DEFAULT_PERMISSION_NAMES = DEFAULT_PERMISSIONS.map((p) => p.permissionName);

export const RBAC_MODULE_ORDER = [
  'Leads',
  'Clients',
  'Jobs',
  'Candidates',
  'Interviews',
  'Placements',
  'Contacts',
  'Tasks',
  'Pipeline',
  'Matches',
  'Agreements',
  'Inbox',
  'Calendar',
  'Reports / Analytics',
  'Billing',
  'Team',
  'Request',
  'System',
  'Organization',
  'CRM Dashboard',
  'Recruitment Dashboard',
];

export const DEFAULT_SYSTEM_ROLES = [
  { roleName: 'Super Admin', description: 'Full system access', color: 'red' },
  { roleName: 'Admin', description: 'Administrative access', color: 'blue' },
  { roleName: 'Senior Recruiter', description: 'Senior recruitment role', color: 'teal' },
  { roleName: 'Recruiter', description: 'Recruitment operations access', color: 'green' },
  { roleName: 'Account Manager', description: 'Client account management', color: 'amber' },
  { roleName: 'Finance', description: 'Finance and billing access', color: 'orange' },
  { roleName: 'Manager', description: 'Team management access', color: 'purple' },
  { roleName: 'Line Manager', description: 'Review and manage team requests', color: 'indigo' },
  { roleName: 'Viewer', description: 'Read-only access', color: 'gray' },
];

/** Default permission sets for seeded non–Super Admin roles (by role name). */
export const DEFAULT_ROLE_PERMISSION_PRESETS = {
  Admin: DEFAULT_PERMISSION_NAMES.filter(
    (n) => n !== 'view_team_activity' && n !== 'dash_full_scope',
  ),
  'Senior Recruiter': [
    'leads_read', 'leads_create', 'leads_update',
    'clients_read', 'clients_create', 'clients_update', 'view_all_clients', 'clients_handoff',
    'jobs_read', 'jobs_create', 'jobs_update', 'assign_job', 'view_all_jobs',
    'candidates_read', 'candidates_create', 'candidates_update', 'view_all_candidates', 'move_pipeline', 'submit_candidate',
    'interviews_read', 'interviews_create', 'interviews_update',
    'placements_read', 'placements_create', 'placements_update',
    'contacts_read', 'contacts_create', 'contacts_update',
    'tasks_read', 'tasks_create', 'tasks_update',
    'pipeline_read', 'pipeline_manage',
    'matches_read', 'matches_manage',
    'agreements_read', 'agreements_manage',
    'inbox_read', 'inbox_manage',
    'calendar_read', 'calendar_manage',
    'reports_read',
    'view_dashboard',
    'dash_crm_insights', 'dash_crm_pipeline', 'dash_crm_team', 'dash_crm_people',
    'dash_rec_insights', 'dash_rec_pipeline', 'dash_rec_team', 'dash_rec_people',
    'view_activity_log',
    'requests_read',
    'requests_create',
    'requests_update',
    'requests_delete',
  ],
  Recruiter: [
    'leads_read', 'clients_read', 'jobs_read', 'view_assigned_candidates', 'candidates_read', 'candidates_create', 'candidates_update',
    'move_pipeline', 'submit_candidate', 'interviews_read', 'interviews_create', 'interviews_update',
    'placements_read', 'contacts_read', 'tasks_read', 'tasks_create', 'tasks_update',
    'pipeline_read', 'pipeline_manage', 'matches_read', 'matches_manage',
    'inbox_read', 'calendar_read', 'view_dashboard',
    'dash_rec_insights', 'dash_rec_pipeline',
    'requests_read', 'requests_create', 'requests_update', 'requests_delete',
  ],
  'Account Manager': [
    'leads_read', 'leads_create', 'leads_update', 'view_all_leads',
    'clients_read', 'clients_create', 'clients_update', 'view_all_clients', 'clients_handoff',
    'jobs_read', 'jobs_create', 'jobs_update',
    'contacts_read', 'contacts_create', 'contacts_update',
    'agreements_read', 'agreements_manage',
    'reports_read', 'view_dashboard',
    'dash_crm_insights', 'dash_crm_pipeline',
    'requests_read', 'requests_create', 'requests_update', 'requests_delete',
  ],
  Finance: [
    'placements_read', 'access_billing', 'create_invoice', 'record_payment', 'manage_billing_settings',
    'reports_read', 'export_data', 'view_dashboard',
  ],
  Manager: [
    'view_team', 'add_team_member', 'edit_team_member', 'manage_targets', 'view_team_activity',
    'leads_read', 'clients_read', 'jobs_read',
    'reports_read', 'view_dashboard', 'view_all_candidates', 'view_all_jobs', 'view_all_clients', 'view_all_leads',
    'dash_crm_insights', 'dash_crm_pipeline', 'dash_crm_team', 'dash_crm_people',
    'dash_rec_insights', 'dash_rec_pipeline', 'dash_rec_team', 'dash_rec_people',
    'clients_handoff',
    'requests_read', 'requests_create', 'requests_update', 'requests_delete', 'view_all_requests',
    'dash_mine_approvals',
    'org_structure',
    'node_org_structure',
  ],
  'Line Manager': [
    'requests_create',
    'requests_read',
    'requests_update',
    'requests_delete',
    'view_all_requests',
    'view_dashboard',
    'view_team',
    'dash_mine_approvals',
  ],
  Viewer: [
    'leads_read', 'clients_read', 'jobs_read', 'candidates_read', 'view_assigned_candidates',
    'interviews_read', 'placements_read', 'contacts_read', 'tasks_read', 'pipeline_read', 'matches_read',
    'reports_read', 'view_dashboard',
    'requests_read', 'requests_update',
  ],
};
