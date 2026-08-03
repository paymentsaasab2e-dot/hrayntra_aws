/**
 * HQ-scoped RBAC permission catalog aligned with the current HQ sidebar:
 * Employees · Employers · CRM · Ops
 */
export const HQ_PERMISSION_CATALOG = [
  // Employees (Phase 1)
  {
    permissionName: 'hq_dashboard_read',
    module: 'Employees · Dashboard',
    description: 'View Phase 1 employee analytics dashboard',
  },
  {
    permissionName: 'hq_candidates_read',
    module: 'Employees · Candidates',
    description: 'View Phase 1 candidates',
  },
  {
    permissionName: 'hq_candidates_write',
    module: 'Employees · Candidates',
    description: 'Manage Phase 1 candidates',
  },
  {
    permissionName: 'hq_courses_read',
    module: 'Employees · Courses',
    description: 'View Phase 1 LMS courses',
  },
  {
    permissionName: 'hq_courses_write',
    module: 'Employees · Courses',
    description: 'Create and edit Phase 1 LMS courses',
  },
  {
    permissionName: 'hq_courses_delete',
    module: 'Employees · Courses',
    description: 'Delete Phase 1 LMS courses',
  },
  {
    permissionName: 'hq_portal_read',
    module: 'Employees · Portal',
    description: 'View portal jobs',
  },
  {
    permissionName: 'hq_portal_write',
    module: 'Employees · Portal',
    description: 'Manage portal jobs',
  },
  {
    permissionName: 'hq_events_read',
    module: 'Employees · Events',
    description: 'View HQ portal events',
  },
  {
    permissionName: 'hq_events_write',
    module: 'Employees · Events',
    description: 'Create and edit portal events',
  },
  {
    permissionName: 'hq_events_delete',
    module: 'Employees · Events',
    description: 'Delete portal events',
  },
  {
    permissionName: 'hq_subscriptions_read',
    module: 'Employees · Subscriptions',
    description: 'View Phase 1 coin packs and spend costs',
  },
  {
    permissionName: 'hq_subscriptions_write',
    module: 'Employees · Subscriptions',
    description: 'Edit Phase 1 coin packs and spend costs',
  },

  // Employers (Phase 2)
  {
    permissionName: 'hq_employers_dashboard_read',
    module: 'Employers · Dashboard',
    description: 'View Phase 2 employer analytics dashboard',
  },
  {
    permissionName: 'hq_companies_read',
    module: 'Employers · Companies',
    description: 'View HQ companies',
  },
  {
    permissionName: 'hq_companies_write',
    module: 'Employers · Companies',
    description: 'Create and edit HQ companies',
  },
  {
    permissionName: 'hq_companies_delete',
    module: 'Employers · Companies',
    description: 'Delete HQ companies',
  },
  {
    permissionName: 'hq_tenants_read',
    module: 'Employers · Tenants',
    description: 'View tenants',
  },
  {
    permissionName: 'hq_tenants_write',
    module: 'Employers · Tenants',
    description: 'Create and manage tenants / AI coins',
  },
  {
    permissionName: 'hq_billing_read',
    module: 'Employers · Plans',
    description: 'View employer subscription plans, AI plans, and coin packs',
  },
  {
    permissionName: 'hq_billing_write',
    module: 'Employers · Plans',
    description: 'Manage employer plans, AI feature costs, and coin packs',
  },

  // CRM
  {
    permissionName: 'hq_crm_dashboard_read',
    module: 'CRM · Dashboard',
    description: 'View HQ CRM dashboard',
  },
  {
    permissionName: 'hq_leads_read',
    module: 'CRM · Leads',
    description: 'View HQ leads',
  },
  {
    permissionName: 'hq_leads_write',
    module: 'CRM · Leads',
    description: 'Create and edit HQ leads',
  },
  {
    permissionName: 'hq_leads_delete',
    module: 'CRM · Leads',
    description: 'Delete HQ leads',
  },
  {
    permissionName: 'hq_clients_read',
    module: 'CRM · Clients',
    description: 'View HQ clients',
  },
  {
    permissionName: 'hq_clients_write',
    module: 'CRM · Clients',
    description: 'Create and edit HQ clients',
  },
  {
    permissionName: 'hq_clients_delete',
    module: 'CRM · Clients',
    description: 'Delete HQ clients',
  },

  // Ops
  {
    permissionName: 'hq_team_read',
    module: 'Ops · Team',
    description: 'View HQ team members',
  },
  {
    permissionName: 'hq_team_write',
    module: 'Ops · Team',
    description: 'Add and edit HQ team members',
  },
  {
    permissionName: 'hq_roles_manage',
    module: 'Ops · Team',
    description: 'Create and edit HQ roles & permissions',
  },
  {
    permissionName: 'hq_reports_read',
    module: 'Ops · Reports',
    description: 'View HQ reports',
  },
  {
    permissionName: 'hq_ops_billing_read',
    module: 'Ops · Billing',
    description: 'View Ops billing shortcut (employer plans)',
  },
  {
    permissionName: 'hq_analytics_read',
    module: 'Analytics',
    description: 'View platform analytics APIs used by HQ dashboards',
  },
];

/** Preferred module order in Team → Roles permission picker (matches new HQ sidebar). */
export const HQ_MODULE_ORDER = [
  'Employees · Dashboard',
  'Employees · Candidates',
  'Employees · Courses',
  'Employees · Portal',
  'Employees · Events',
  'Employees · Subscriptions',
  'Employers · Dashboard',
  'Employers · Companies',
  'Employers · Tenants',
  'Employers · Plans',
  'CRM · Dashboard',
  'CRM · Leads',
  'CRM · Clients',
  'Ops · Team',
  'Ops · Reports',
  'Ops · Billing',
  'Analytics',
  // Legacy module names (if any old roles still reference them in UI maps)
  'Dashboard',
  'Leads',
  'Clients',
  'Companies',
  'Tenants',
  'Candidates',
  'Portal',
  'Team',
  'Reports',
  'Billing',
];

const ALL_IDS = HQ_PERMISSION_CATALOG.map((p) => p.permissionName);

const MANAGER_DENY = new Set([
  'hq_tenants_write',
  'hq_billing_write',
  'hq_portal_write',
  'hq_events_delete',
  'hq_subscriptions_write',
  'hq_companies_delete',
  'hq_candidates_write',
  'hq_courses_delete',
  'hq_roles_manage',
]);

export const HQ_DEFAULT_ROLES = [
  {
    roleName: 'HQ Admin',
    description: 'Full access to the new headquarters console (Employees, Employers, CRM, Ops)',
    color: '#4F46E5',
    permissionIds: [...ALL_IDS],
  },
  {
    roleName: 'HQ Manager',
    description: 'Operate CRM and employee modules without destructive / billing admin rights',
    color: '#0EA5E9',
    permissionIds: ALL_IDS.filter((id) => !MANAGER_DENY.has(id)),
  },
  {
    roleName: 'HQ Viewer',
    description: 'Read-only access across the new HQ modules',
    color: '#64748B',
    permissionIds: ALL_IDS.filter((id) => id.endsWith('_read')),
  },
];

/** Map sidebar nav ids → required permission (any-of). */
export const HQ_NAV_PERMISSION_MAP = {
  dashboard: ['hq_dashboard_read', 'hq_analytics_read'],
  candidates: ['hq_candidates_read'],
  courses: ['hq_courses_read'],
  portal: ['hq_portal_read'],
  events: ['hq_events_read'],
  subscriptions: ['hq_subscriptions_read'],
  employerDashboard: ['hq_employers_dashboard_read', 'hq_dashboard_read', 'hq_analytics_read'],
  company: ['hq_companies_read'],
  tenants: ['hq_tenants_read'],
  plans: ['hq_billing_read'],
  crmDashboard: ['hq_crm_dashboard_read', 'hq_leads_read', 'hq_dashboard_read'],
  leads: ['hq_leads_read'],
  clients: ['hq_clients_read', 'hq_companies_read'],
  team: ['hq_team_read'],
  reports: ['hq_reports_read'],
  billing: ['hq_billing_read', 'hq_ops_billing_read'],
};

export function listHqPermissions() {
  return HQ_PERMISSION_CATALOG.map((p) => ({
    id: p.permissionName,
    permissionName: p.permissionName,
    module: p.module,
    description: p.description,
  }));
}

export function permissionsByModule() {
  const map = {};
  for (const p of listHqPermissions()) {
    if (!map[p.module]) map[p.module] = [];
    map[p.module].push(p);
  }
  return map;
}

export function normalizePermissionIds(ids) {
  const allowed = new Set(HQ_PERMISSION_CATALOG.map((p) => p.permissionName));
  if (!Array.isArray(ids)) return [];
  return [...new Set(ids.map((id) => String(id || '').trim()).filter((id) => allowed.has(id)))];
}

export function sortHqModules(modules) {
  return [...modules].sort((a, b) => {
    const aIndex = HQ_MODULE_ORDER.indexOf(a);
    const bIndex = HQ_MODULE_ORDER.indexOf(b);
    if (aIndex === -1 && bIndex === -1) return a.localeCompare(b);
    if (aIndex === -1) return 1;
    if (bIndex === -1) return -1;
    return aIndex - bIndex;
  });
}
