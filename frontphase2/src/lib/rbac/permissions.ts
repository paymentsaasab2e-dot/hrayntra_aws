/**
 * Canonical RBAC catalog — keep aligned with
 * backendphase2/src/modules/role/default-permissions.js
 *
 * Sequence matters: the Team page permission picker renders modules in
 * RBAC_MODULE_ORDER and draws a section header per RBAC_MODULE_GROUPS entry
 * (CRM → Recruitment → Workspace → Insights & Finance → Administration). Each
 * line's dashboard module sits inside its own group, so CRM Dashboard lives
 * under CRM and Recruitment Dashboard under Recruitment. Keep this array in the
 * same order.
 */
export type PermissionSeed = {
  permissionName: string;
  module: string;
  description: string;
};

export const RBAC_PERMISSION_SEED: PermissionSeed[] = [
  // ══ CRM ═══════════════════════════════════════════════════════════════
  { permissionName: 'leads_create', module: 'Leads', description: 'Create leads' },
  { permissionName: 'leads_read', module: 'Leads', description: 'View leads' },
  { permissionName: 'leads_update', module: 'Leads', description: 'Update leads' },
  { permissionName: 'leads_delete', module: 'Leads', description: 'Delete leads' },
  { permissionName: 'view_all_leads', module: 'Leads', description: 'View all leads in my organization' },
  { permissionName: 'convert_lead', module: 'Leads', description: 'Convert a lead into a client' },

  { permissionName: 'clients_create', module: 'Clients', description: 'Create clients' },
  { permissionName: 'clients_read', module: 'Clients', description: 'View clients' },
  { permissionName: 'clients_update', module: 'Clients', description: 'Update clients' },
  { permissionName: 'clients_delete', module: 'Clients', description: 'Delete clients' },
  { permissionName: 'view_all_clients', module: 'Clients', description: 'View all clients in my organization' },
  { permissionName: 'clients_handoff', module: 'Clients', description: 'Hand off clients to another department' },

  { permissionName: 'contacts_create', module: 'Contacts', description: 'Create contacts' },
  { permissionName: 'contacts_read', module: 'Contacts', description: 'View contacts' },
  { permissionName: 'contacts_update', module: 'Contacts', description: 'Update contacts' },
  { permissionName: 'contacts_delete', module: 'Contacts', description: 'Delete contacts' },

  { permissionName: 'agreements_read', module: 'Agreements', description: 'View Agreements & Terms on clients and leads' },
  { permissionName: 'agreements_manage', module: 'Agreements', description: 'Create or update Agreements & Terms on clients and leads' },

  // CRM dashboard tabs — how wide the data goes is set by the Dashboard level.
  { permissionName: 'dash_crm_insights', module: 'CRM Dashboard', description: 'CRM dashboard tab: Insights & actions' },
  { permissionName: 'dash_crm_pipeline', module: 'CRM Dashboard', description: 'CRM dashboard tab: Pipeline & records' },
  { permissionName: 'dash_crm_team', module: 'CRM Dashboard', description: 'CRM dashboard tab: Team & outreach (also unlocks Hours & scores tab)' },
  { permissionName: 'dash_crm_people', module: 'CRM Dashboard', description: 'CRM dashboard tab: Hours & scores — follows Team tab; people list uses Dashboard level' },

  // ══ Recruitment ════════════════════════════════════════════════════════
  { permissionName: 'jobs_create', module: 'Jobs', description: 'Create jobs' },
  { permissionName: 'jobs_read', module: 'Jobs', description: 'View jobs' },
  { permissionName: 'jobs_update', module: 'Jobs', description: 'Update jobs' },
  { permissionName: 'jobs_delete', module: 'Jobs', description: 'Delete jobs' },
  { permissionName: 'assign_job', module: 'Jobs', description: 'Assign jobs to recruiters' },
  { permissionName: 'view_all_jobs', module: 'Jobs', description: 'View all jobs in my organization' },
  { permissionName: 'publish_job', module: 'Jobs', description: 'Publish jobs to the portal and social channels' },

  { permissionName: 'candidates_create', module: 'Candidates', description: 'Create candidates' },
  { permissionName: 'candidates_read', module: 'Candidates', description: 'View candidates' },
  { permissionName: 'candidates_update', module: 'Candidates', description: 'Update candidates' },
  { permissionName: 'candidates_delete', module: 'Candidates', description: 'Delete candidates' },
  { permissionName: 'view_all_candidates', module: 'Candidates', description: 'View all candidates in my organization' },
  { permissionName: 'view_assigned_candidates', module: 'Candidates', description: 'View only assigned candidates' },
  { permissionName: 'move_pipeline', module: 'Candidates', description: 'Move candidates in pipeline' },
  { permissionName: 'submit_candidate', module: 'Candidates', description: 'Submit candidates to jobs' },

  { permissionName: 'matches_read', module: 'Matches', description: 'View candidate–job matches' },
  { permissionName: 'matches_manage', module: 'Matches', description: 'Save, submit, or reject matches' },

  { permissionName: 'pipeline_read', module: 'Pipeline', description: 'View pipeline boards' },
  { permissionName: 'pipeline_manage', module: 'Pipeline', description: 'Move stages and manage pipeline' },

  { permissionName: 'interviews_create', module: 'Interviews', description: 'Schedule interviews' },
  { permissionName: 'interviews_read', module: 'Interviews', description: 'View interviews' },
  { permissionName: 'interviews_update', module: 'Interviews', description: 'Update interviews' },
  { permissionName: 'interviews_delete', module: 'Interviews', description: 'Cancel or delete interviews' },
  { permissionName: 'interviews_feedback', module: 'Interviews', description: 'Record interview feedback and outcomes' },

  { permissionName: 'placements_create', module: 'Placements', description: 'Create placements' },
  { permissionName: 'placements_read', module: 'Placements', description: 'View placements' },
  { permissionName: 'placements_update', module: 'Placements', description: 'Update placements' },
  { permissionName: 'placements_delete', module: 'Placements', description: 'Delete placements' },

  // Recruitment dashboard tabs — breadth is set by the Dashboard level.
  { permissionName: 'dash_rec_insights', module: 'Recruitment Dashboard', description: 'Recruitment dashboard tab: Insights & actions' },
  { permissionName: 'dash_rec_pipeline', module: 'Recruitment Dashboard', description: 'Recruitment dashboard tab: Pipeline & records' },
  { permissionName: 'dash_rec_team', module: 'Recruitment Dashboard', description: 'Recruitment dashboard tab: Team & performance (also unlocks Hours & scores tab)' },
  { permissionName: 'dash_rec_people', module: 'Recruitment Dashboard', description: 'Recruitment dashboard tab: Hours & scores — follows Team tab; people list uses Dashboard level' },

  // ══ Workspace ══════════════════════════════════════════════════════════
  { permissionName: 'tasks_create', module: 'Tasks', description: 'Create tasks' },
  { permissionName: 'tasks_read', module: 'Tasks', description: 'View tasks' },
  { permissionName: 'tasks_update', module: 'Tasks', description: 'Update tasks' },
  { permissionName: 'tasks_delete', module: 'Tasks', description: 'Delete tasks' },

  { permissionName: 'calendar_read', module: 'Calendar', description: 'View calendar' },
  { permissionName: 'calendar_manage', module: 'Calendar', description: 'Create or edit calendar events' },

  { permissionName: 'events_read', module: 'Events', description: 'View events and registrations' },
  { permissionName: 'events_manage', module: 'Events', description: 'Create, edit, or cancel events' },

  { permissionName: 'inbox_read', module: 'Inbox', description: 'View inbox messages' },
  { permissionName: 'inbox_manage', module: 'Inbox', description: 'Send and manage inbox messages' },

  { permissionName: 'requests_create', module: 'Request', description: 'Send requests' },
  { permissionName: 'requests_read', module: 'Request', description: 'View requests' },
  { permissionName: 'requests_update', module: 'Request', description: 'Update request status' },
  { permissionName: 'requests_delete', module: 'Request', description: 'Cancel or delete requests' },
  { permissionName: 'view_all_requests', module: 'Request', description: 'View all requests in my organization' },
  { permissionName: 'approve_requests', module: 'Request', description: 'Approve or reject requests raised to you' },

  // ══ Insights & Finance ═════════════════════════════════════════════════
  { permissionName: 'reports_create', module: 'Reports / Analytics', description: 'Create custom reports' },
  { permissionName: 'reports_read', module: 'Reports / Analytics', description: 'View reports and analytics' },
  { permissionName: 'reports_update', module: 'Reports / Analytics', description: 'Update reports' },
  { permissionName: 'reports_delete', module: 'Reports / Analytics', description: 'Delete reports' },

  { permissionName: 'behavior_read', module: 'Behaviour', description: 'View behaviour and engagement analytics' },
  { permissionName: 'behavior_manage', module: 'Behaviour', description: 'Configure behaviour tracking and scoring rules' },

  { permissionName: 'access_billing', module: 'Billing', description: 'Access billing module' },
  { permissionName: 'create_invoice', module: 'Billing', description: 'Create and send invoices' },
  { permissionName: 'record_payment', module: 'Billing', description: 'Record payments' },
  { permissionName: 'manage_billing_settings', module: 'Billing', description: 'Manage billing settings' },
  { permissionName: 'manage_subscription', module: 'Billing', description: 'View and change the tenant subscription plan' },

  // ══ Administration ═════════════════════════════════════════════════════
  { permissionName: 'view_team', module: 'Team', description: 'View team directory' },
  {
    permissionName: 'view_cross_company_members',
    module: 'Team',
    description:
      'Allows users to view and assign members from other companies within their current tenant. Super Admin has this by default. Never grants access to other tenants.',
  },
  { permissionName: 'add_team_member', module: 'Team', description: 'Add team members' },
  { permissionName: 'edit_team_member', module: 'Team', description: 'Edit or deactivate team members' },
  { permissionName: 'assign_roles', module: 'Team', description: 'Assign roles to members' },
  { permissionName: 'manage_roles', module: 'Team', description: 'Create and edit roles & permissions' },
  { permissionName: 'manage_departments', module: 'Team', description: 'Create and edit departments and their role ranks' },
  { permissionName: 'generate_credentials', module: 'Team', description: 'Generate login credentials' },
  { permissionName: 'manage_commission', module: 'Team', description: 'Manage commission rules' },
  { permissionName: 'manage_targets', module: 'Team', description: 'Manage recruiter targets' },
  { permissionName: 'view_team_activity', module: 'Team', description: 'View team login and activity logs' },

  { permissionName: 'org_structure', module: 'Organization', description: 'Create and edit the company tree (HQ, companies, sites)' },
  { permissionName: 'node_org_structure', module: 'Organization', description: 'Manage sites and people under your own company node' },
  {
    permissionName: 'switch_companies',
    module: 'Organization',
    description:
      'Show the company/branch switcher and operate CRM/recruitment across companies. Super Admin has this by default; grant only to HQ users who may work across companies.',
  },
  {
    permissionName: 'view_all_companies',
    module: 'Organization',
    description:
      'Full access of all companies — see jobs, leads, clients, candidates, and related lists across every company in this tenant. Without this, View all is limited to the member’s own organization.',
  },

  { permissionName: 'company_page_read', module: 'Company Page', description: 'View the public company page' },
  { permissionName: 'company_page_manage', module: 'Company Page', description: 'Edit the public company page and its job listings' },

  { permissionName: 'manage_settings', module: 'System', description: 'Manage organization settings' },
  { permissionName: 'access_integrations', module: 'System', description: 'Access integrations' },
  { permissionName: 'export_data', module: 'System', description: 'Export data to CSV or files' },
  { permissionName: 'view_activity_log', module: 'System', description: 'View company activity feed' },
  { permissionName: 'recycle_bin_manage', module: 'System', description: 'Restore or purge recycle bin items' },
  { permissionName: 'view_dashboard', module: 'System', description: 'View main dashboard' },
  {
    permissionName: 'dash_dept_scope',
    module: 'System',
    description:
      'Dashboard level: My department — see all records assigned to people in the user’s department. Rank 1 already has this.',
  },
  {
    permissionName: 'dash_company_scope',
    module: 'System',
    description:
      'Dashboard level: This company — see records for the user’s company / branch. Company and site heads already have this.',
  },
  {
    permissionName: 'dash_full_scope',
    module: 'System',
    description:
      'Dashboard level: Whole tenant — see all companies on allowed CRM/Recruitment tabs. Super Admin already has this.',
  },
  {
    permissionName: 'dash_mine_approvals',
    module: 'System',
    description:
      'My work: include the approvals bucket (team requests, task completion, lead conversion, cross-dept). Super Admin and Rank 1 have this on by default. Tick for other roles that have Approvals / request / task permissions.',
  },
];

export const RBAC_MODULE_ORDER = [
  // CRM
  'Leads',
  'Clients',
  'Contacts',
  'Agreements',
  'CRM Dashboard',
  // Recruitment
  'Jobs',
  'Candidates',
  'Matches',
  'Pipeline',
  'Interviews',
  'Placements',
  'Recruitment Dashboard',
  // Workspace
  'Tasks',
  'Calendar',
  'Events',
  'Inbox',
  'Request',
  // Insights & Finance
  'Reports / Analytics',
  'Behaviour',
  'Billing',
  // Administration
  'Team',
  'Organization',
  'Company Page',
  'System',
] as const;

export type RbacModuleGroup = {
  group: string;
  description: string;
  modules: string[];
};

/** Section headers for the Team page permission picker, in display sequence. */
export const RBAC_MODULE_GROUPS: RbacModuleGroup[] = [
  {
    group: 'CRM',
    description: 'Sales side — leads, clients, contacts, agreements, and the CRM dashboard tabs.',
    modules: ['Leads', 'Clients', 'Contacts', 'Agreements', 'CRM Dashboard'],
  },
  {
    group: 'Recruitment',
    description:
      'Delivery side — jobs through to placements, plus the Recruitment dashboard tabs.',
    modules: [
      'Jobs',
      'Candidates',
      'Matches',
      'Pipeline',
      'Interviews',
      'Placements',
      'Recruitment Dashboard',
    ],
  },
  {
    group: 'Workspace',
    description: 'Day-to-day tools shared by both sides.',
    modules: ['Tasks', 'Calendar', 'Events', 'Inbox', 'Request'],
  },
  {
    group: 'Insights & Finance',
    description: 'Reporting, behaviour analytics, invoicing, and subscription.',
    modules: ['Reports / Analytics', 'Behaviour', 'Billing'],
  },
  {
    group: 'Administration',
    description: 'People, company structure, and tenant-wide settings.',
    modules: ['Team', 'Organization', 'Company Page', 'System'],
  },
];

/** Group label for a module, or null when the module is not in the catalog. */
export function rbacGroupForModule(module: string): string | null {
  const match = RBAC_MODULE_GROUPS.find((entry) => entry.modules.includes(module));
  return match ? match.group : null;
}

export const RBAC_CATALOG_TOTAL = RBAC_PERMISSION_SEED.length;
