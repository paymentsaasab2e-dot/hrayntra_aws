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
  { permissionName: 'leads_create', module: 'Leads', description: 'Leads page — create' },
  { permissionName: 'leads_read', module: 'Leads', description: 'Leads page' },
  { permissionName: 'leads_update', module: 'Leads', description: 'Leads page — update' },
  { permissionName: 'leads_delete', module: 'Leads', description: 'Leads page — delete' },
  { permissionName: 'view_all_leads', module: 'Leads', description: 'Leads page — all records in the organization' },
  { permissionName: 'convert_lead', module: 'Leads', description: 'Leads page — convert a lead into a client' },

  { permissionName: 'clients_create', module: 'Clients', description: 'Clients page — create' },
  { permissionName: 'clients_read', module: 'Clients', description: 'Clients page' },
  { permissionName: 'clients_update', module: 'Clients', description: 'Clients page — update' },
  { permissionName: 'clients_delete', module: 'Clients', description: 'Clients page — delete' },
  { permissionName: 'view_all_clients', module: 'Clients', description: 'Clients page — all records in the organization' },
  { permissionName: 'clients_handoff', module: 'Clients', description: 'Clients page — hand off to another department' },

  { permissionName: 'contacts_create', module: 'Contacts', description: 'Contacts page — create' },
  { permissionName: 'contacts_read', module: 'Contacts', description: 'Contacts page' },
  { permissionName: 'contacts_update', module: 'Contacts', description: 'Contacts page — update' },
  { permissionName: 'contacts_delete', module: 'Contacts', description: 'Contacts page — delete' },

  { permissionName: 'agreements_read', module: 'Agreements', description: 'View Agreements & Terms on clients and leads' },
  { permissionName: 'agreements_manage', module: 'Agreements', description: 'Create or update Agreements & Terms on clients and leads' },

  // CRM dashboard tabs — how wide the data goes is set by the Dashboard level.
  { permissionName: 'dash_crm_insights', module: 'CRM Dashboard', description: 'CRM dashboard tab: Insights & actions' },
  { permissionName: 'dash_crm_pipeline', module: 'CRM Dashboard', description: 'CRM dashboard tab: Pipeline & records' },
  { permissionName: 'dash_crm_team', module: 'CRM Dashboard', description: 'CRM dashboard tab: Team & outreach (also unlocks Hours & scores tab)' },
  { permissionName: 'dash_crm_people', module: 'CRM Dashboard', description: 'CRM dashboard tab: Hours & scores — follows Team tab; people list uses Dashboard level' },

  // ══ Recruitment ════════════════════════════════════════════════════════
  { permissionName: 'recruitment_clients_create', module: 'Recruitment Clients', description: 'Recruitment → Clients — create' },
  { permissionName: 'recruitment_clients_read', module: 'Recruitment Clients', description: 'Recruitment → Clients' },
  { permissionName: 'recruitment_clients_update', module: 'Recruitment Clients', description: 'Recruitment → Clients — update' },
  { permissionName: 'recruitment_clients_delete', module: 'Recruitment Clients', description: 'Recruitment → Clients — delete' },
  { permissionName: 'view_all_recruitment_clients', module: 'Recruitment Clients', description: 'Recruitment → Clients — all records in the organization' },

  { permissionName: 'jobs_create', module: 'Jobs', description: 'Jobs page — create' },
  { permissionName: 'jobs_read', module: 'Jobs', description: 'Jobs page' },
  { permissionName: 'jobs_update', module: 'Jobs', description: 'Jobs page — update' },
  { permissionName: 'jobs_delete', module: 'Jobs', description: 'Jobs page — delete' },
  { permissionName: 'assign_job', module: 'Jobs', description: 'Jobs page — assign to recruiters' },
  { permissionName: 'view_all_jobs', module: 'Jobs', description: 'Jobs page — all records in the organization' },
  { permissionName: 'publish_job', module: 'Jobs', description: 'Jobs page — publish to the portal and social channels' },

  { permissionName: 'candidates_create', module: 'Candidates', description: 'Candidates page — create' },
  { permissionName: 'candidates_read', module: 'Candidates', description: 'Candidates page' },
  { permissionName: 'candidates_update', module: 'Candidates', description: 'Candidates page — update' },
  { permissionName: 'candidates_delete', module: 'Candidates', description: 'Candidates page — delete' },
  { permissionName: 'view_all_candidates', module: 'Candidates', description: 'Candidates page — all records in the organization' },
  { permissionName: 'view_assigned_candidates', module: 'Candidates', description: 'Candidates page — assigned records only' },
  { permissionName: 'move_pipeline', module: 'Candidates', description: 'Pipeline page — move candidates' },
  { permissionName: 'submit_candidate', module: 'Candidates', description: 'Candidates page — submit to Jobs' },

  { permissionName: 'matches_read', module: 'Matches', description: 'Matches page' },
  { permissionName: 'matches_manage', module: 'Matches', description: 'Matches page — save, submit, or reject' },

  { permissionName: 'pipeline_read', module: 'Pipeline', description: 'Pipeline page' },
  { permissionName: 'pipeline_manage', module: 'Pipeline', description: 'Pipeline page — manage stages' },

  { permissionName: 'interviews_create', module: 'Interviews', description: 'Interviews page — schedule' },
  { permissionName: 'interviews_read', module: 'Interviews', description: 'Interviews page' },
  { permissionName: 'interviews_update', module: 'Interviews', description: 'Interviews page — update' },
  { permissionName: 'interviews_delete', module: 'Interviews', description: 'Interviews page — cancel or delete' },
  { permissionName: 'interviews_feedback', module: 'Interviews', description: 'Interviews page — record feedback' },

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
  { permissionName: 'tasks_create', module: 'Tasks', description: 'Tasks & Activities — create' },
  { permissionName: 'tasks_read', module: 'Tasks', description: 'Tasks & Activities' },
  { permissionName: 'tasks_update', module: 'Tasks', description: 'Tasks & Activities — update' },
  { permissionName: 'tasks_delete', module: 'Tasks', description: 'Tasks & Activities — delete' },

  { permissionName: 'calendar_read', module: 'Calendar', description: 'Calendar' },
  { permissionName: 'calendar_manage', module: 'Calendar', description: 'Calendar — create or edit' },

  { permissionName: 'events_read', module: 'Events', description: 'Portal Events' },
  { permissionName: 'events_manage', module: 'Events', description: 'Portal Events — create, edit, or cancel' },

  { permissionName: 'inbox_read', module: 'Inbox', description: 'Inbox → Gmail and Outlook' },
  { permissionName: 'inbox_manage', module: 'Inbox', description: 'Chat tab on Leads, Clients, Candidates, Jobs, and other records — send messages' },

  { permissionName: 'requests_create', module: 'Request', description: 'Requests — send' },
  { permissionName: 'requests_read', module: 'Request', description: 'Requests' },
  { permissionName: 'requests_update', module: 'Request', description: 'Requests — update' },
  { permissionName: 'requests_delete', module: 'Request', description: 'Requests — delete' },
  { permissionName: 'view_all_requests', module: 'Request', description: 'Requests — all records in the organization' },
  { permissionName: 'approve_requests', module: 'Request', description: 'Requests — Approvals' },

  // ══ Insights & Finance ═════════════════════════════════════════════════
  { permissionName: 'reports_create', module: 'Reports / Analytics', description: 'Reports — create' },
  { permissionName: 'reports_read', module: 'Reports / Analytics', description: 'Reports' },
  { permissionName: 'reports_update', module: 'Reports / Analytics', description: 'Reports — update' },
  { permissionName: 'reports_delete', module: 'Reports / Analytics', description: 'Reports — delete' },

  { permissionName: 'behavior_read', module: 'Behaviour', description: 'View behaviour analytics' },
  { permissionName: 'behavior_manage', module: 'Behaviour', description: 'Configure behaviour tracking' },

  { permissionName: 'access_billing', module: 'Billing', description: 'Billing page' },
  { permissionName: 'create_invoice', module: 'Billing', description: 'Billing → Invoices' },
  { permissionName: 'record_payment', module: 'Billing', description: 'Billing → Payments' },
  { permissionName: 'manage_billing_settings', module: 'Billing', description: 'Settings → Invoice template (also Billing → Billing Settings)' },
  { permissionName: 'manage_subscription', module: 'Billing', description: 'Settings → Subscription & Plan (also Subscription in the sidenav)' },

  // ══ Administration ═════════════════════════════════════════════════════
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
      'Retired — use Switch companies, then pick CRM and Recruitment organizations.',
  },

  { permissionName: 'company_page_read', module: 'Company Page', description: 'Company Page' },
  { permissionName: 'company_page_manage', module: 'Company Page', description: 'Company Page — edit' },

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

export const RBAC_MODULE_ORDER = [
  // CRM
  'Leads',
  'Clients',
  'Contacts',
  'Agreements',
  'CRM Dashboard',
  // Recruitment
  'Recruitment Clients',
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
      'Delivery side — recruitment clients, jobs through to placements, plus the Recruitment dashboard tabs.',
    modules: [
      'Recruitment Clients',
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

/**
 * Tick labels in Team → Roles. Keep the same wording as the page or Settings
 * section the permission actually opens. Internal `permissionName` keys stay
 * unchanged so existing roles keep working.
 */
export const PERMISSION_DISPLAY_LABELS: Record<string, string> = {
  // CRM pages
  leads_create: 'Leads — create',
  leads_read: 'Leads',
  leads_update: 'Leads — update',
  leads_delete: 'Leads — delete',
  view_all_leads: 'Leads — view all in my organization',
  convert_lead: 'Leads — convert to client',

  clients_create: 'Clients — create',
  clients_read: 'Clients',
  clients_update: 'Clients — update',
  clients_delete: 'Clients — delete',
  view_all_clients: 'Clients — view all in my organization',
  clients_handoff: 'Clients — hand off',

  recruitment_clients_create: 'Recruitment Clients — create',
  recruitment_clients_read: 'Recruitment Clients',
  recruitment_clients_update: 'Recruitment Clients — update',
  recruitment_clients_delete: 'Recruitment Clients — delete',
  view_all_recruitment_clients: 'Recruitment Clients — view all in my organization',

  contacts_create: 'Contacts — create',
  contacts_read: 'Contacts',
  contacts_update: 'Contacts — update',
  contacts_delete: 'Contacts — delete',

  agreements_read: 'Agreements & Terms — view',
  agreements_manage: 'Agreements & Terms — manage',

  dash_crm_insights: 'CRM Dashboard — Insights & actions',
  dash_crm_pipeline: 'CRM Dashboard — Pipeline & records',
  dash_crm_team: 'CRM Dashboard — Team & outreach',
  dash_crm_people: 'CRM Dashboard — Hours & scores',

  // Recruitment pages
  jobs_create: 'Jobs — create',
  jobs_read: 'Jobs',
  jobs_update: 'Jobs — update',
  jobs_delete: 'Jobs — delete',
  assign_job: 'Jobs — assign',
  view_all_jobs: 'Jobs — view all in my organization',
  publish_job: 'Jobs — publish',
  create_job: 'Jobs — create',
  edit_job: 'Jobs — update',
  delete_job: 'Jobs — delete',
  view_jobs: 'Jobs',

  candidates_create: 'Candidates — create',
  candidates_read: 'Candidates',
  candidates_update: 'Candidates — update',
  candidates_delete: 'Candidates — delete',
  view_all_candidates: 'Candidates — view all in my organization',
  view_assigned_candidates: 'Candidates — assigned only',
  move_pipeline: 'Pipeline — move candidates',
  submit_candidate: 'Candidates — submit to Jobs',
  add_candidate: 'Candidates — create',
  edit_candidate: 'Candidates — update',
  delete_candidate: 'Candidates — delete',

  matches_read: 'Matches',
  matches_manage: 'Matches — manage',

  pipeline_read: 'Pipeline',
  pipeline_manage: 'Pipeline — manage',

  interviews_create: 'Interviews — schedule',
  interviews_read: 'Interviews',
  interviews_update: 'Interviews — update',
  interviews_delete: 'Interviews — cancel or delete',
  interviews_feedback: 'Interviews — record feedback',

  placements_create: 'Placements — create',
  placements_read: 'Placements',
  placements_update: 'Placements — update',
  placements_delete: 'Placements — delete',

  dash_rec_insights: 'Recruitment Dashboard — Insights & actions',
  dash_rec_pipeline: 'Recruitment Dashboard — Pipeline & records',
  dash_rec_team: 'Recruitment Dashboard — Team & performance',
  dash_rec_people: 'Recruitment Dashboard — Hours & scores',

  // Workspace pages
  tasks_create: 'Tasks & Activities — create',
  tasks_read: 'Tasks & Activities',
  tasks_update: 'Tasks & Activities — update',
  tasks_delete: 'Tasks & Activities — delete',

  calendar_read: 'Calendar',
  calendar_manage: 'Calendar — create or edit',

  events_read: 'Portal Events',
  events_manage: 'Portal Events — manage',

  inbox_read: 'Inbox (Gmail & Outlook)',
  inbox_manage: 'Chat',

  requests_create: 'Requests — send',
  requests_read: 'Requests',
  requests_update: 'Requests — update',
  requests_delete: 'Requests — delete',
  view_all_requests: 'Requests — view all in my organization',
  approve_requests: 'Requests — Approvals',

  // Insights & finance pages
  reports_create: 'Reports — create',
  reports_read: 'Reports',
  reports_update: 'Reports — update',
  reports_delete: 'Reports — delete',

  behavior_read: 'Behaviour',
  behavior_manage: 'Behaviour — configure',

  access_billing: 'Billing',
  create_invoice: 'Billing — Invoices',
  record_payment: 'Billing — Payments',
  manage_billing_settings: 'Settings — Invoice template',
  manage_subscription: 'Settings — Subscription & Plan',

  // Team page tabs
  view_team: 'Team — Members',
  view_cross_company_members: 'Team — view members across companies',
  VIEW_CROSS_COMPANY_MEMBERS: 'Team — view members across companies',
  add_team_member: 'Team — Members (add)',
  edit_team_member: 'Team — Members (edit)',
  assign_roles: 'Team — Roles',
  manage_roles: 'Team — Roles (create and edit)',
  manage_departments: 'Team — Departments',
  generate_credentials: 'Team — Credentials',
  manage_commission: 'Settings — Commission slabs',
  manage_targets: 'Team — Targets & KPI',
  view_team_activity: 'Team — Activity',

  org_structure: 'Organization',
  node_org_structure: 'Organization — own company',
  switch_companies: 'Organization — switch companies',
  view_all_companies: 'Organization — full access of all companies',

  company_page_read: 'Company Page',
  company_page_manage: 'Company Page — edit',

  // Settings sections (exact sidebar names)
  manage_settings:
    'Settings — Notifications Trigger Points, Alerts Management, Recruitment workflow, Data & Security, Customization',
  access_integrations: 'Settings — Communication & Integrations',
  export_data: 'Export data',
  view_activity_log: 'Activity log',
  recycle_bin_manage: 'Recycle Bin',
  view_dashboard: 'Dashboard',
  dash_dept_scope: 'Dashboard level — My department',
  dash_company_scope: 'Dashboard level — This company',
  dash_full_scope: 'Dashboard level — Whole tenant',
  dash_mine_approvals: 'Requests — Approvals (My work)',

  // HQ sidebar (same names as HQ nav)
  hq_dashboard_read: 'Employees — Dashboard',
  hq_candidates_read: 'Employees — Candidates',
  hq_candidates_write: 'Employees — Candidates (manage)',
  hq_candidates_delete: 'Employees — Candidates (delete)',
  hq_kyc_interviewers_read: 'Employees — KYC verified',
  hq_courses_read: 'Employees — Courses',
  hq_courses_write: 'Employees — Courses (manage)',
  hq_courses_delete: 'Employees — Courses (delete)',
  hq_portal_read: 'Employees — Portal jobs',
  hq_portal_write: 'Employees — Portal jobs (manage)',
  hq_portal_delete: 'Employees — Portal jobs (delete)',
  hq_events_read: 'Employees — Events',
  hq_events_write: 'Employees — Events (manage)',
  hq_events_delete: 'Employees — Events (delete)',
  hq_subscriptions_read: 'Employees — Subscriptions',
  hq_subscriptions_write: 'Employees — Subscriptions (manage)',
  hq_employee_tickets_read: 'Employees — Tickets',
  hq_employee_tickets_write: 'Employees — Tickets (update)',
  hq_employers_dashboard_read: 'Entrepreneurs — Dashboard',
  hq_companies_read: 'Entrepreneurs — Companies',
  hq_companies_write: 'Entrepreneurs — Companies (manage)',
  hq_companies_delete: 'Entrepreneurs — Companies (delete)',
  hq_tickets_read: 'Entrepreneurs — Tickets',
  hq_tickets_write: 'Entrepreneurs — Tickets (update)',
  hq_tickets_delete: 'Entrepreneurs — Tickets (delete)',
  hq_tenants_read: 'Entrepreneurs — Users',
  hq_tenants_write: 'Entrepreneurs — Users (manage)',
  hq_tenants_delete: 'Entrepreneurs — Recycle Bin',
  hq_billing_read: 'Entrepreneurs — Subscriptions',
  hq_billing_write: 'Entrepreneurs — Subscriptions (manage)',
  hq_packages_read: 'Entrepreneurs — Packages',
  hq_packages_write: 'Entrepreneurs — Packages (manage)',
  hq_ai_features_read: 'Entrepreneurs — AI Features',
  hq_ai_features_write: 'Entrepreneurs — AI Features (manage)',
  hq_crm_dashboard_read: 'CRM — Dashboard',
  hq_leads_read: 'CRM — Leads',
  hq_leads_write: 'CRM — Leads (manage)',
  hq_leads_delete: 'CRM — Leads (delete)',
  hq_leads_assign: 'CRM — Leads (assign)',
  hq_clients_read: 'CRM — Clients',
  hq_clients_write: 'CRM — Clients (manage)',
  hq_clients_delete: 'CRM — Clients (delete)',
  hq_demos_read: 'CRM — Demos',
  hq_demos_write: 'CRM — Demos (manage)',
  hq_team_read: 'Ops — Team',
  hq_team_write: 'Ops — Team (manage)',
  hq_team_hierarchy: 'Ops — Team (hierarchy)',
  hq_roles_manage: 'Ops — Team (roles)',
  hq_reports_read: 'Ops — Reports',
  hq_reports_export: 'Ops — Reports (export)',
  hq_ops_billing_read: 'Ops — Billing',
  hq_analytics_read: 'Analytics',
  hq_analytics_export: 'Analytics (export)',
  hq_settings_read: 'Ops — Settings',
  hq_settings_write: 'Ops — Settings (update)',
};

/** Module headers in the role picker — same names as the sidenav / Settings. */
export const MODULE_DISPLAY_LABELS: Record<string, string> = {
  Leads: 'Leads',
  Clients: 'Clients',
  Contacts: 'Contacts',
  Agreements: 'Agreements & Terms',
  'CRM Dashboard': 'CRM Dashboard',
  'Recruitment Clients': 'Recruitment Clients',
  Jobs: 'Jobs',
  Candidates: 'Candidates',
  Matches: 'Matches',
  Pipeline: 'Pipeline',
  Interviews: 'Interviews',
  Placements: 'Placements',
  'Recruitment Dashboard': 'Recruitment Dashboard',
  Tasks: 'Tasks & Activities',
  Calendar: 'Calendar',
  Events: 'Portal Events',
  Inbox: 'Inbox',
  Request: 'Requests',
  'Reports / Analytics': 'Reports',
  Behaviour: 'Behaviour',
  Billing: 'Billing',
  Team: 'Team',
  Organization: 'Organization',
  'Company Page': 'Company Page',
  System: 'Settings',
  'Employees · Portal': 'Employees — Portal jobs',
  'Entrepreneurs · Tenants': 'Entrepreneurs — Users',
  'Entrepreneurs · Plans': 'Entrepreneurs — Subscriptions',
};
