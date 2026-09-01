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
  { permissionName: 'leads_create', module: 'Leads', description: 'Leads page — create' },
  { permissionName: 'leads_read', module: 'Leads', description: 'Leads page' },
  { permissionName: 'leads_update', module: 'Leads', description: 'Leads page — update' },
  { permissionName: 'leads_delete', module: 'Leads', description: 'Leads page — delete' },
  { permissionName: 'view_all_leads', module: 'Leads', description: 'Leads page — all records in the organization' },
  { permissionName: 'convert_lead', module: 'Leads', description: 'Leads page — convert a lead into a client' },

  // Clients
  { permissionName: 'clients_create', module: 'Clients', description: 'Clients page — create' },
  { permissionName: 'clients_read', module: 'Clients', description: 'Clients page' },
  { permissionName: 'clients_update', module: 'Clients', description: 'Clients page — update' },
  { permissionName: 'clients_delete', module: 'Clients', description: 'Clients page — delete' },
  { permissionName: 'view_all_clients', module: 'Clients', description: 'Clients page — all records in the organization' },
  { permissionName: 'clients_handoff', module: 'Clients', description: 'Clients page — hand off to another department' },

  // Contacts
  { permissionName: 'contacts_create', module: 'Contacts', description: 'Contacts page — create' },
  { permissionName: 'contacts_read', module: 'Contacts', description: 'Contacts page' },
  { permissionName: 'contacts_update', module: 'Contacts', description: 'Contacts page — update' },
  { permissionName: 'contacts_delete', module: 'Contacts', description: 'Contacts page — delete' },

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
  { permissionName: 'jobs_create', module: 'Jobs', description: 'Jobs page — create' },
  { permissionName: 'jobs_read', module: 'Jobs', description: 'Jobs page' },
  { permissionName: 'jobs_update', module: 'Jobs', description: 'Jobs page — update' },
  { permissionName: 'jobs_delete', module: 'Jobs', description: 'Jobs page — delete' },
  { permissionName: 'assign_job', module: 'Jobs', description: 'Jobs page — assign to recruiters' },
  { permissionName: 'view_all_jobs', module: 'Jobs', description: 'Jobs page — all records in the organization' },
  { permissionName: 'publish_job', module: 'Jobs', description: 'Jobs page — publish to the portal and social channels' },

  // Candidates
  { permissionName: 'candidates_create', module: 'Candidates', description: 'Candidates page — create' },
  { permissionName: 'candidates_read', module: 'Candidates', description: 'Candidates page' },
  { permissionName: 'candidates_update', module: 'Candidates', description: 'Candidates page — update' },
  { permissionName: 'candidates_delete', module: 'Candidates', description: 'Candidates page — delete' },
  { permissionName: 'view_all_candidates', module: 'Candidates', description: 'Candidates page — all records in the organization' },
  { permissionName: 'view_assigned_candidates', module: 'Candidates', description: 'Candidates page — assigned records only' },
  { permissionName: 'move_pipeline', module: 'Candidates', description: 'Pipeline page — move candidates' },
  { permissionName: 'submit_candidate', module: 'Candidates', description: 'Candidates page — submit to Jobs' },

  // Matches
  { permissionName: 'matches_read', module: 'Matches', description: 'Matches page' },
  { permissionName: 'matches_manage', module: 'Matches', description: 'Matches page — save, submit, or reject' },

  // Pipeline
  { permissionName: 'pipeline_read', module: 'Pipeline', description: 'Pipeline page' },
  { permissionName: 'pipeline_manage', module: 'Pipeline', description: 'Pipeline page — manage stages' },

  // Interviews
  { permissionName: 'interviews_create', module: 'Interviews', description: 'Interviews page — schedule' },
  { permissionName: 'interviews_read', module: 'Interviews', description: 'Interviews page' },
  { permissionName: 'interviews_update', module: 'Interviews', description: 'Interviews page — update' },
  { permissionName: 'interviews_delete', module: 'Interviews', description: 'Interviews page — cancel or delete' },
  { permissionName: 'interviews_feedback', module: 'Interviews', description: 'Interviews page — record feedback' },

  // Placements
  { permissionName: 'placements_create', module: 'Placements', description: 'Placements page — create' },
  { permissionName: 'placements_read', module: 'Placements', description: 'Placements page' },
  { permissionName: 'placements_update', module: 'Placements', description: 'Placements page — update' },
  { permissionName: 'placements_delete', module: 'Placements', description: 'Placements page — delete' },

  // Recruitment dashboard tabs — breadth is set by the Dashboard level.
  { permissionName: 'dash_rec_insights', module: 'Recruitment Dashboard', description: 'Recruitment dashboard tab: Insights & actions' },
  { permissionName: 'dash_rec_pipeline', module: 'Recruitment Dashboard', description: 'Recruitment dashboard tab: Pipeline & records' },
  { permissionName: 'dash_rec_team', module: 'Recruitment Dashboard', description: 'Recruitment dashboard tab: Team & performance (also unlocks Hours & scores tab)' },
  { permissionName: 'dash_rec_people', module: 'Recruitment Dashboard', description: 'Recruitment dashboard tab: Hours & scores — follows Team tab; people list uses Dashboard level' },

  // ══ Workspace ══════════════════════════════════════════════════════════
  // Tasks
  { permissionName: 'tasks_create', module: 'Tasks', description: 'Tasks & Activities — create' },
  { permissionName: 'tasks_read', module: 'Tasks', description: 'Tasks & Activities' },
  { permissionName: 'tasks_update', module: 'Tasks', description: 'Tasks & Activities — update' },
  { permissionName: 'tasks_delete', module: 'Tasks', description: 'Tasks & Activities — delete' },

  // Calendar
  { permissionName: 'calendar_read', module: 'Calendar', description: 'Calendar' },
  { permissionName: 'calendar_manage', module: 'Calendar', description: 'Calendar — create or edit' },

  // Events
  { permissionName: 'events_read', module: 'Events', description: 'Portal Events' },
  { permissionName: 'events_manage', module: 'Events', description: 'Portal Events — create, edit, or cancel' },

  // Inbox
  { permissionName: 'inbox_read', module: 'Inbox', description: 'Inbox → Gmail and Outlook' },
  { permissionName: 'inbox_manage', module: 'Inbox', description: 'Chat tab on Leads, Clients, Candidates, Jobs, and other records — send messages' },

  // Request
  { permissionName: 'requests_create', module: 'Request', description: 'Requests — send' },
  { permissionName: 'requests_read', module: 'Request', description: 'Requests' },
  { permissionName: 'requests_update', module: 'Request', description: 'Requests — update' },
  { permissionName: 'requests_delete', module: 'Request', description: 'Requests — delete' },
  { permissionName: 'view_all_requests', module: 'Request', description: 'Requests — all records in the organization' },
  { permissionName: 'approve_requests', module: 'Request', description: 'Requests — Approvals' },

  // ══ Insights & Finance ═════════════════════════════════════════════════
  // Reports
  { permissionName: 'reports_create', module: 'Reports / Analytics', description: 'Reports — create' },
  { permissionName: 'reports_read', module: 'Reports / Analytics', description: 'Reports' },
  { permissionName: 'reports_update', module: 'Reports / Analytics', description: 'Reports — update' },
  { permissionName: 'reports_delete', module: 'Reports / Analytics', description: 'Reports — delete' },

  // Behaviour analytics (/thebehave, /tenant-behave)
  { permissionName: 'behavior_read', module: 'Behaviour', description: 'View behaviour and engagement analytics' },
  { permissionName: 'behavior_manage', module: 'Behaviour', description: 'Configure behaviour tracking and scoring rules' },

  // Billing
  { permissionName: 'access_billing', module: 'Billing', description: 'Billing page' },
  { permissionName: 'create_invoice', module: 'Billing', description: 'Billing → Invoices' },
  { permissionName: 'record_payment', module: 'Billing', description: 'Billing → Payments' },
  { permissionName: 'manage_billing_settings', module: 'Billing', description: 'Settings → Invoice template (also Billing → Billing Settings)' },
  { permissionName: 'manage_subscription', module: 'Billing', description: 'Settings → Subscription & Plan (also Subscription in the sidenav)' },

  // ══ Administration ═════════════════════════════════════════════════════
  // Team
  { permissionName: 'view_team', module: 'Team', description: 'Team → Members' },
  {
    permissionName: 'view_cross_company_members',
    module: 'Team',
    description:
      'Team — view and assign members from other companies in this tenant. Super Admin has this by default.',
  },
  { permissionName: 'add_team_member', module: 'Team', description: 'Team → Members — add member' },
  { permissionName: 'edit_team_member', module: 'Team', description: 'Team → Members — edit or deactivate' },
  { permissionName: 'assign_roles', module: 'Team', description: 'Team → Roles' },
  { permissionName: 'manage_roles', module: 'Team', description: 'Team → Roles — create and edit roles' },
  { permissionName: 'manage_departments', module: 'Team', description: 'Team → Departments' },
  { permissionName: 'generate_credentials', module: 'Team', description: 'Team → Credentials' },
  { permissionName: 'manage_commission', module: 'Team', description: 'Settings → Commission slabs' },
  { permissionName: 'manage_targets', module: 'Team', description: 'Team → Targets & KPI' },
  { permissionName: 'view_team_activity', module: 'Team', description: 'Team member Activity' },

  // Organization
  { permissionName: 'org_structure', module: 'Organization', description: 'Open Organization — edit the company tree (HQ, companies, sites)' },
  { permissionName: 'node_org_structure', module: 'Organization', description: 'Organization — manage sites and people under your own company' },
  {
    permissionName: 'switch_companies',
    module: 'Organization',
    description:
      'Show the company switcher. After ticking this, choose CRM and/or Recruitment organizations below — the role then has full access of those companies. Super Admin has this by default.',
  },
  {
    permissionName: 'view_all_companies',
    module: 'Organization',
    description:
      'Retired — use Switch companies, then pick CRM and Recruitment organizations. Kept for Super Admin and existing roles until they are saved again.',
  },

  // Company page (public tenant profile)
  { permissionName: 'company_page_read', module: 'Company Page', description: 'Company Page' },
  { permissionName: 'company_page_manage', module: 'Company Page', description: 'Company Page — edit' },

  // System
  { permissionName: 'manage_settings', module: 'System', description: 'Settings → Notifications Trigger Points, Alerts Management, Recruitment workflow, Data & Security, Customization' },
  { permissionName: 'access_integrations', module: 'System', description: 'Settings → Communication & Integrations' },
  { permissionName: 'export_data', module: 'System', description: 'Export from lists and Reports' },
  { permissionName: 'view_activity_log', module: 'System', description: 'Activity log (sidenav) and Settings → Activity Log' },
  { permissionName: 'recycle_bin_manage', module: 'System', description: 'Recycle Bin' },
  { permissionName: 'view_dashboard', module: 'System', description: 'CRM → Dashboard and Recruitment → Dashboard' },
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

/** Ticked on every role unless an admin later turns it off. */
export const DEFAULT_EVERYONE_PERMISSIONS = ['access_integrations'];

function withEveryoneDefaults(names = []) {
  return [...new Set([...(names || []), ...DEFAULT_EVERYONE_PERMISSIONS])];
}

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
  Admin: withEveryoneDefaults(
    DEFAULT_PERMISSION_NAMES.filter(
      (n) =>
        n !== 'view_team_activity' &&
        n !== 'dash_full_scope' &&
        n !== 'dash_dept_scope' &&
        n !== 'dash_company_scope' &&
        n !== 'view_cross_company_members' &&
        n !== 'view_all_companies',
    ),
  ),
  'Senior Recruiter': withEveryoneDefaults([
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
  ]),
  Recruiter: withEveryoneDefaults([
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
  ]),
  'Account Manager': withEveryoneDefaults([
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
  ]),
  Finance: withEveryoneDefaults([
    'clients_read', 'placements_read',
    'access_billing', 'create_invoice', 'record_payment', 'manage_billing_settings',
    'manage_subscription',
    'agreements_read',
    'reports_read', 'export_data', 'view_dashboard',
  ]),
  Manager: withEveryoneDefaults([
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
  ]),
  'Line Manager': withEveryoneDefaults([
    'requests_create',
    'requests_read',
    'requests_update',
    'requests_delete',
    'view_all_requests',
    'approve_requests',
    'view_dashboard',
    'view_team',
    'dash_mine_approvals',
  ]),
  Viewer: withEveryoneDefaults([
    'leads_read', 'clients_read', 'contacts_read', 'agreements_read',
    'jobs_read', 'candidates_read', 'view_assigned_candidates',
    'matches_read', 'pipeline_read', 'interviews_read', 'placements_read',
    'tasks_read', 'calendar_read', 'events_read',
    'requests_read', 'requests_update',
    'company_page_read',
    'reports_read', 'view_dashboard',
  ]),
};
