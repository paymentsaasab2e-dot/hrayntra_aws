/**
 * Canonical RBAC permission catalog for Phase 2.
 * Keep in sync with frontphase2/src/lib/rbac/permissions.ts
 *
 * Sequence matters: the Team page renders modules in RBAC_MODULE_ORDER, grouped
 * by RBAC_MODULE_GROUPS (CRM → Recruitment → Workspace → Insights & Finance →
 * Administration). Each line's dashboard module sits inside its own group, so
 * CRM Dashboard lives under CRM and Recruitment Dashboard under Recruitment.
 * Keep this array in the same order so the fallback grouping in rolesController
 * matches what the UI shows.
 */
export const DEFAULT_PERMISSIONS = [
  // ══ CRM ═══════════════════════════════════════════════════════════════
  // Leads
  { permissionName: 'leads_create', module: 'Leads', description: 'Create leads' },
  { permissionName: 'leads_read', module: 'Leads', description: 'View leads' },
  { permissionName: 'leads_update', module: 'Leads', description: 'Update leads' },
  { permissionName: 'leads_delete', module: 'Leads', description: 'Delete leads' },
  { permissionName: 'view_all_leads', module: 'Leads', description: 'View all leads in my organization' },
  { permissionName: 'convert_lead', module: 'Leads', description: 'Convert a lead into a client' },

  // Clients
  { permissionName: 'clients_create', module: 'Clients', description: 'Create clients' },
  { permissionName: 'clients_read', module: 'Clients', description: 'View clients' },
  { permissionName: 'clients_update', module: 'Clients', description: 'Update clients' },
  { permissionName: 'clients_delete', module: 'Clients', description: 'Delete clients' },
  { permissionName: 'view_all_clients', module: 'Clients', description: 'View all clients in my organization' },
  { permissionName: 'clients_handoff', module: 'Clients', description: 'Hand off clients to another department' },

  // Contacts
  { permissionName: 'contacts_create', module: 'Contacts', description: 'Create contacts' },
  { permissionName: 'contacts_read', module: 'Contacts', description: 'View contacts' },
  { permissionName: 'contacts_update', module: 'Contacts', description: 'Update contacts' },
  { permissionName: 'contacts_delete', module: 'Contacts', description: 'Delete contacts' },

  // Agreements
  { permissionName: 'agreements_read', module: 'Agreements', description: 'View Agreements & Terms on clients and leads' },
  { permissionName: 'agreements_manage', module: 'Agreements', description: 'Create or update Agreements & Terms on clients and leads' },

  // CRM dashboard tabs — how wide the data goes is set by the Dashboard level.
  { permissionName: 'dash_crm_insights', module: 'CRM Dashboard', description: 'CRM dashboard tab: Insights & actions' },
  { permissionName: 'dash_crm_pipeline', module: 'CRM Dashboard', description: 'CRM dashboard tab: Pipeline & records' },
  { permissionName: 'dash_crm_team', module: 'CRM Dashboard', description: 'CRM dashboard tab: Team & outreach (also unlocks Hours & scores tab)' },
  { permissionName: 'dash_crm_people', module: 'CRM Dashboard', description: 'CRM dashboard tab: Hours & scores — follows Team tab; people list uses Dashboard level' },

  // ══ Recruitment ════════════════════════════════════════════════════════
  // Jobs
  { permissionName: 'jobs_create', module: 'Jobs', description: 'Create jobs' },
  { permissionName: 'jobs_read', module: 'Jobs', description: 'View jobs' },
  { permissionName: 'jobs_update', module: 'Jobs', description: 'Update jobs' },
  { permissionName: 'jobs_delete', module: 'Jobs', description: 'Delete jobs' },
  { permissionName: 'assign_job', module: 'Jobs', description: 'Assign jobs to recruiters' },
  { permissionName: 'view_all_jobs', module: 'Jobs', description: 'View all jobs in my organization' },
  { permissionName: 'publish_job', module: 'Jobs', description: 'Publish jobs to the portal and social channels' },

  // Candidates
  { permissionName: 'candidates_create', module: 'Candidates', description: 'Create candidates' },
  { permissionName: 'candidates_read', module: 'Candidates', description: 'View candidates' },
  { permissionName: 'candidates_update', module: 'Candidates', description: 'Update candidates' },
  { permissionName: 'candidates_delete', module: 'Candidates', description: 'Delete candidates' },
  { permissionName: 'view_all_candidates', module: 'Candidates', description: 'View all candidates in my organization' },
  { permissionName: 'view_assigned_candidates', module: 'Candidates', description: 'View only assigned candidates' },
  { permissionName: 'move_pipeline', module: 'Candidates', description: 'Move candidates in pipeline' },
  { permissionName: 'submit_candidate', module: 'Candidates', description: 'Submit candidates to jobs' },

  // Matches
  { permissionName: 'matches_read', module: 'Matches', description: 'View candidate–job matches' },
  { permissionName: 'matches_manage', module: 'Matches', description: 'Save, submit, or reject matches' },

  // Pipeline
  { permissionName: 'pipeline_read', module: 'Pipeline', description: 'View pipeline boards' },
  { permissionName: 'pipeline_manage', module: 'Pipeline', description: 'Move stages and manage pipeline' },

  // Interviews
  { permissionName: 'interviews_create', module: 'Interviews', description: 'Schedule interviews' },
  { permissionName: 'interviews_read', module: 'Interviews', description: 'View interviews' },
  { permissionName: 'interviews_update', module: 'Interviews', description: 'Update interviews' },
  { permissionName: 'interviews_delete', module: 'Interviews', description: 'Cancel or delete interviews' },
  { permissionName: 'interviews_feedback', module: 'Interviews', description: 'Record interview feedback and outcomes' },

  // Placements
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
  // Tasks
  { permissionName: 'tasks_create', module: 'Tasks', description: 'Create tasks' },
  { permissionName: 'tasks_read', module: 'Tasks', description: 'View tasks' },
  { permissionName: 'tasks_update', module: 'Tasks', description: 'Update tasks' },
  { permissionName: 'tasks_delete', module: 'Tasks', description: 'Delete tasks' },

  // Calendar
  { permissionName: 'calendar_read', module: 'Calendar', description: 'View calendar' },
  { permissionName: 'calendar_manage', module: 'Calendar', description: 'Create or edit calendar events' },

  // Events
  { permissionName: 'events_read', module: 'Events', description: 'View events and registrations' },
  { permissionName: 'events_manage', module: 'Events', description: 'Create, edit, or cancel events' },

  // Inbox
  { permissionName: 'inbox_read', module: 'Inbox', description: 'View inbox messages' },
  { permissionName: 'inbox_manage', module: 'Inbox', description: 'Send and manage inbox messages' },

  // Request
  { permissionName: 'requests_create', module: 'Request', description: 'Send requests' },
  { permissionName: 'requests_read', module: 'Request', description: 'View requests' },
  { permissionName: 'requests_update', module: 'Request', description: 'Update request status' },
  { permissionName: 'requests_delete', module: 'Request', description: 'Cancel or delete requests' },
  { permissionName: 'view_all_requests', module: 'Request', description: 'View all requests in my organization' },
  { permissionName: 'approve_requests', module: 'Request', description: 'Approve or reject requests raised to you' },

  // ══ Insights & Finance ═════════════════════════════════════════════════
  // Reports
  { permissionName: 'reports_create', module: 'Reports / Analytics', description: 'Create custom reports' },
  { permissionName: 'reports_read', module: 'Reports / Analytics', description: 'View reports and analytics' },
  { permissionName: 'reports_update', module: 'Reports / Analytics', description: 'Update reports' },
  { permissionName: 'reports_delete', module: 'Reports / Analytics', description: 'Delete reports' },

  // Behaviour analytics (/thebehave, /tenant-behave)
  { permissionName: 'behavior_read', module: 'Behaviour', description: 'View behaviour and engagement analytics' },
  { permissionName: 'behavior_manage', module: 'Behaviour', description: 'Configure behaviour tracking and scoring rules' },

  // Billing
  { permissionName: 'access_billing', module: 'Billing', description: 'Access billing module' },
  { permissionName: 'create_invoice', module: 'Billing', description: 'Create and send invoices' },
  { permissionName: 'record_payment', module: 'Billing', description: 'Record payments' },
  { permissionName: 'manage_billing_settings', module: 'Billing', description: 'Manage billing settings' },
  { permissionName: 'manage_subscription', module: 'Billing', description: 'View and change the tenant subscription plan' },

  // ══ Administration ═════════════════════════════════════════════════════
  // Team
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

  // Organization
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

  // Company page (public tenant profile)
  { permissionName: 'company_page_read', module: 'Company Page', description: 'View the public company page' },
  { permissionName: 'company_page_manage', module: 'Company Page', description: 'Edit the public company page and its job listings' },

  // System
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

export const DEFAULT_PERMISSION_NAMES = DEFAULT_PERMISSIONS.map((p) => p.permissionName);

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
];

/**
 * Section headers for the Team page permission picker. Every module in
 * RBAC_MODULE_ORDER belongs to exactly one group, in the same sequence.
 */
export const RBAC_MODULE_GROUPS = [
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
    (n) =>
      n !== 'view_team_activity' &&
      n !== 'dash_full_scope' &&
      n !== 'dash_dept_scope' &&
      n !== 'dash_company_scope' &&
      n !== 'view_cross_company_members' &&
      n !== 'view_all_companies',
  ),
  'Senior Recruiter': [
    'leads_read', 'leads_create', 'leads_update', 'convert_lead',
    'clients_read', 'clients_create', 'clients_update', 'view_all_clients', 'clients_handoff',
    'contacts_read', 'contacts_create', 'contacts_update',
    'agreements_read', 'agreements_manage',
    'jobs_read', 'jobs_create', 'jobs_update', 'assign_job', 'view_all_jobs', 'publish_job',
    'candidates_read', 'candidates_create', 'candidates_update', 'view_all_candidates', 'move_pipeline', 'submit_candidate',
    'matches_read', 'matches_manage',
    'pipeline_read', 'pipeline_manage',
    'interviews_read', 'interviews_create', 'interviews_update', 'interviews_feedback',
    'placements_read', 'placements_create', 'placements_update',
    'tasks_read', 'tasks_create', 'tasks_update',
    'calendar_read', 'calendar_manage',
    'events_read',
    'inbox_read', 'inbox_manage',
    'requests_read', 'requests_create', 'requests_update', 'requests_delete',
    'reports_read',
    'company_page_read',
    'view_dashboard',
    'dash_crm_insights', 'dash_crm_pipeline', 'dash_crm_team',
    'dash_rec_insights', 'dash_rec_pipeline', 'dash_rec_team',
    'view_activity_log',
  ],
  Recruiter: [
    'leads_read', 'clients_read', 'contacts_read',
    'jobs_read',
    'view_assigned_candidates', 'candidates_read', 'candidates_create', 'candidates_update',
    'move_pipeline', 'submit_candidate',
    'matches_read', 'matches_manage',
    'pipeline_read', 'pipeline_manage',
    'interviews_read', 'interviews_create', 'interviews_update', 'interviews_feedback',
    'placements_read',
    'tasks_read', 'tasks_create', 'tasks_update',
    'calendar_read', 'events_read', 'inbox_read',
    'requests_read', 'requests_create', 'requests_update', 'requests_delete',
    'company_page_read',
    'view_dashboard',
    'dash_rec_insights', 'dash_rec_pipeline',
  ],
  'Account Manager': [
    'leads_read', 'leads_create', 'leads_update', 'view_all_leads', 'convert_lead',
    'clients_read', 'clients_create', 'clients_update', 'view_all_clients', 'clients_handoff',
    'contacts_read', 'contacts_create', 'contacts_update',
    'agreements_read', 'agreements_manage',
    'jobs_read', 'jobs_create', 'jobs_update',
    'tasks_read', 'tasks_create', 'tasks_update',
    'calendar_read', 'events_read', 'inbox_read', 'inbox_manage',
    'requests_read', 'requests_create', 'requests_update', 'requests_delete',
    'reports_read',
    'company_page_read', 'company_page_manage',
    'view_dashboard',
    'dash_crm_insights', 'dash_crm_pipeline',
  ],
  Finance: [
    'clients_read', 'placements_read',
    'access_billing', 'create_invoice', 'record_payment', 'manage_billing_settings',
    'manage_subscription',
    'agreements_read',
    'reports_read', 'export_data', 'view_dashboard',
  ],
  Manager: [
    'view_team', 'add_team_member', 'edit_team_member', 'manage_targets', 'view_team_activity',
    'leads_read', 'clients_read', 'contacts_read', 'jobs_read',
    'view_all_candidates', 'view_all_jobs', 'view_all_clients', 'view_all_leads',
    'clients_handoff',
    'events_read',
    'requests_read', 'requests_create', 'requests_update', 'requests_delete', 'view_all_requests',
    'approve_requests',
    'reports_read', 'behavior_read',
    'company_page_read',
    'view_dashboard',
    'dash_crm_insights', 'dash_crm_pipeline', 'dash_crm_team',
    'dash_rec_insights', 'dash_rec_pipeline', 'dash_rec_team',
    'dash_mine_approvals',
    // Organization (company/branch tree) stays with Admin — Managers get it only
    // when an admin ticks org_structure for them.
  ],
  'Line Manager': [
    'requests_create',
    'requests_read',
    'requests_update',
    'requests_delete',
    'view_all_requests',
    'approve_requests',
    'view_dashboard',
    'view_team',
    'dash_mine_approvals',
  ],
  Viewer: [
    'leads_read', 'clients_read', 'contacts_read', 'agreements_read',
    'jobs_read', 'candidates_read', 'view_assigned_candidates',
    'matches_read', 'pipeline_read', 'interviews_read', 'placements_read',
    'tasks_read', 'calendar_read', 'events_read',
    'requests_read', 'requests_update',
    'company_page_read',
    'reports_read', 'view_dashboard',
  ],
};
