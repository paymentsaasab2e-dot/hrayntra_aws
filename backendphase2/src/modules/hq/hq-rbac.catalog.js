/**
 * HQ-scoped RBAC permission catalog aligned with the HQ sidebar:
 * Employees · Entrepreneurs · CRM · Ops · Settings
 */
export const HQ_PERMISSION_CATALOG = [
  // Employees (Phase 1)
  {
    permissionName: 'hq_dashboard_read',
    module: 'Employees · Dashboard',
    description: 'Employees → Dashboard',
  },
  {
    permissionName: 'hq_candidates_read',
    module: 'Employees · Candidates',
    description: 'Employees → Candidates',
  },
  {
    permissionName: 'hq_kyc_interviewers_read',
    module: 'Employees · KYC verified',
    description: 'Employees → KYC verified',
  },
  {
    permissionName: 'hq_candidates_write',
    module: 'Employees · Candidates',
    description: 'Employees → Candidates — manage',
  },
  {
    permissionName: 'hq_candidates_delete',
    module: 'Employees · Candidates',
    description: 'Employees → Candidates — delete',
  },
  {
    permissionName: 'hq_courses_read',
    module: 'Employees · Courses',
    description: 'Employees → Courses',
  },
  {
    permissionName: 'hq_courses_write',
    module: 'Employees · Courses',
    description: 'Employees → Courses — manage',
  },
  {
    permissionName: 'hq_courses_delete',
    module: 'Employees · Courses',
    description: 'Employees → Courses — delete',
  },
  {
    permissionName: 'hq_portal_read',
    module: 'Employees · Portal',
    description: 'Employees → Portal jobs',
  },
  {
    permissionName: 'hq_portal_write',
    module: 'Employees · Portal',
    description: 'Employees → Portal jobs — manage',
  },
  {
    permissionName: 'hq_portal_delete',
    module: 'Employees · Portal',
    description: 'Employees → Portal jobs — delete',
  },
  {
    permissionName: 'hq_events_read',
    module: 'Employees · Events',
    description: 'Employees → Events',
  },
  {
    permissionName: 'hq_events_write',
    module: 'Employees · Events',
    description: 'Employees → Events — manage',
  },
  {
    permissionName: 'hq_events_delete',
    module: 'Employees · Events',
    description: 'Employees → Events — delete',
  },
  {
    permissionName: 'hq_subscriptions_read',
    module: 'Employees · Subscriptions',
    description: 'Employees → Subscriptions',
  },
  {
    permissionName: 'hq_subscriptions_write',
    module: 'Employees · Subscriptions',
    description: 'Employees → Subscriptions — manage',
  },
  {
    permissionName: 'hq_employee_tickets_read',
    module: 'Employees · Tickets',
    description: 'Employees → Tickets',
  },
  {
    permissionName: 'hq_employee_tickets_write',
    module: 'Employees · Tickets',
    description: 'Employees → Tickets — update',
  },

  // Entrepreneurs (Phase 2)
  {
    permissionName: 'hq_employers_dashboard_read',
    module: 'Entrepreneurs · Dashboard',
    description: 'Entrepreneurs → Dashboard',
  },
  {
    permissionName: 'hq_companies_read',
    module: 'Entrepreneurs · Companies',
    description: 'Entrepreneurs → Companies',
  },
  {
    permissionName: 'hq_companies_write',
    module: 'Entrepreneurs · Companies',
    description: 'Entrepreneurs → Companies — manage',
  },
  {
    permissionName: 'hq_companies_delete',
    module: 'Entrepreneurs · Companies',
    description: 'Entrepreneurs → Companies — delete',
  },
  {
    permissionName: 'hq_tickets_read',
    module: 'Entrepreneurs · Tickets',
    description: 'Entrepreneurs → Tickets',
  },
  {
    permissionName: 'hq_tickets_write',
    module: 'Entrepreneurs · Tickets',
    description: 'Entrepreneurs → Tickets — update',
  },
  {
    permissionName: 'hq_tickets_delete',
    module: 'Entrepreneurs · Tickets',
    description: 'Entrepreneurs → Tickets — delete',
  },
  {
    permissionName: 'hq_tenants_read',
    module: 'Entrepreneurs · Tenants',
    description: 'Entrepreneurs → Users',
  },
  {
    permissionName: 'hq_tenants_write',
    module: 'Entrepreneurs · Tenants',
    description: 'Entrepreneurs → Users — manage',
  },
  {
    permissionName: 'hq_tenants_delete',
    module: 'Entrepreneurs · Tenants',
    description: 'Entrepreneurs → Recycle Bin',
  },
  {
    permissionName: 'hq_billing_read',
    module: 'Entrepreneurs · Plans',
    description: 'Entrepreneurs → Subscriptions',
  },
  {
    permissionName: 'hq_billing_write',
    module: 'Entrepreneurs · Plans',
    description: 'Entrepreneurs → Subscriptions — manage',
  },
  {
    permissionName: 'hq_packages_read',
    module: 'Entrepreneurs · Packages',
    description: 'Entrepreneurs → Packages',
  },
  {
    permissionName: 'hq_packages_write',
    module: 'Entrepreneurs · Packages',
    description: 'Entrepreneurs → Packages — manage',
  },
  {
    permissionName: 'hq_ai_features_read',
    module: 'Entrepreneurs · AI Features',
    description: 'Entrepreneurs → AI Features',
  },
  {
    permissionName: 'hq_ai_features_write',
    module: 'Entrepreneurs · AI Features',
    description: 'Entrepreneurs → AI Features — manage',
  },

  // CRM
  {
    permissionName: 'hq_crm_dashboard_read',
    module: 'CRM · Dashboard',
    description: 'CRM → Dashboard',
  },
  {
    permissionName: 'hq_leads_read',
    module: 'CRM · Leads',
    description: 'CRM → Leads',
  },
  {
    permissionName: 'hq_leads_write',
    module: 'CRM · Leads',
    description: 'CRM → Leads — manage',
  },
  {
    permissionName: 'hq_leads_delete',
    module: 'CRM · Leads',
    description: 'CRM → Leads — delete',
  },
  {
    permissionName: 'hq_leads_assign',
    module: 'CRM · Leads',
    description: 'CRM → Leads — assign',
  },
  {
    permissionName: 'hq_clients_read',
    module: 'CRM · Clients',
    description: 'CRM → Clients',
  },
  {
    permissionName: 'hq_clients_write',
    module: 'CRM · Clients',
    description: 'CRM → Clients — manage',
  },
  {
    permissionName: 'hq_clients_delete',
    module: 'CRM · Clients',
    description: 'CRM → Clients — delete',
  },
  {
    permissionName: 'hq_demos_read',
    module: 'CRM · Demos',
    description: 'View demo requests',
  },
  {
    permissionName: 'hq_demos_write',
    module: 'CRM · Demos',
    description: 'Manage demo requests and follow-ups',
  },

  // Ops
  {
    permissionName: 'hq_team_read',
    module: 'Ops · Team',
    description: 'Ops → Team',
  },
  {
    permissionName: 'hq_team_write',
    module: 'Ops · Team',
    description: 'Ops → Team — manage',
  },
  {
    permissionName: 'hq_team_hierarchy',
    module: 'Ops · Team',
    description: 'Ops → Team — hierarchy',
  },
  {
    permissionName: 'hq_roles_manage',
    module: 'Ops · Team',
    description: 'Ops → Team — roles',
  },
  {
    permissionName: 'hq_reports_read',
    module: 'Ops · Reports',
    description: 'Ops → Reports',
  },
  {
    permissionName: 'hq_reports_export',
    module: 'Ops · Reports',
    description: 'Ops → Reports — export',
  },
  {
    permissionName: 'hq_ops_billing_read',
    module: 'Ops · Billing',
    description: 'Ops → Billing',
  },
  {
    permissionName: 'hq_analytics_read',
    module: 'Analytics',
    description: 'View platform analytics APIs used by HQ dashboards',
  },
  {
    permissionName: 'hq_analytics_export',
    module: 'Analytics',
    description: 'Export platform analytics data',
  },

  // Settings
  {
    permissionName: 'hq_settings_read',
    module: 'Ops · Settings',
    description: 'Ops → Settings',
  },
  {
    permissionName: 'hq_settings_write',
    module: 'Ops · Settings',
    description: 'Ops → Settings — update',
  },
];

/** Preferred module order in Team → Roles permission picker (matches HQ sidebar). */
export const HQ_MODULE_ORDER = [
  'Employees · Dashboard',
  'Employees · Candidates',
  'Employees · KYC verified',
  'Employees · Courses',
  'Employees · Portal',
  'Employees · Events',
  'Employees · Subscriptions',
  'Employees · Tickets',
  'Entrepreneurs · Dashboard',
  'Entrepreneurs · Companies',
  'Entrepreneurs · Tenants',
  'Entrepreneurs · Plans',
  'Entrepreneurs · Packages',
  'Entrepreneurs · AI Features',
  'Entrepreneurs · Tickets',
  'CRM · Dashboard',
  'CRM · Leads',
  'CRM · Clients',
  'CRM · Demos',
  'Ops · Team',
  'Ops · Reports',
  'Ops · Billing',
  'Ops · Settings',
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
  'hq_tenants_delete',
  'hq_billing_write',
  'hq_portal_write',
  'hq_portal_delete',
  'hq_events_delete',
  'hq_subscriptions_write',
  'hq_companies_delete',
  'hq_candidates_write',
  'hq_candidates_delete',
  'hq_courses_delete',
  'hq_roles_manage',
  'hq_team_hierarchy',
  'hq_settings_write',
  'hq_packages_write',
  'hq_ai_features_write',
  'hq_tickets_delete',
]);

const LEAD_DENY = new Set([
  ...MANAGER_DENY,
  'hq_team_write',
  'hq_leads_delete',
  'hq_clients_delete',
  'hq_companies_write',
  'hq_tenants_read',
  'hq_billing_read',
  'hq_ops_billing_read',
  'hq_settings_read',
  'hq_analytics_export',
  'hq_reports_export',
]);

export const HQ_DEFAULT_ROLES = [
  {
    roleName: 'HQ Admin',
    description: 'Full access to headquarters (Employees, Entrepreneurs, CRM, Ops, Settings)',
    color: '#4F46E5',
    permissionIds: [...ALL_IDS],
  },
  {
    roleName: 'HQ Manager',
    description: 'Operate CRM and modules without destructive / billing admin rights',
    color: '#0EA5E9',
    permissionIds: ALL_IDS.filter((id) => !MANAGER_DENY.has(id)),
  },
  {
    roleName: 'HQ Lead',
    description: 'Mid-level hierarchy — CRM and employee ops without admin / tenant control',
    color: '#8B5CF6',
    permissionIds: ALL_IDS.filter((id) => !LEAD_DENY.has(id)),
  },
  {
    roleName: 'HQ Viewer',
    description: 'Read-only access across HQ modules',
    color: '#64748B',
    permissionIds: ALL_IDS.filter((id) => id.endsWith('_read')),
  },
];

/** Map sidebar nav ids → required permission (any-of). Keep each nav item scoped to its module. */
export const HQ_NAV_PERMISSION_MAP = {
  dashboard: ['hq_dashboard_read'],
  candidates: ['hq_candidates_read'],
  kycVerified: ['hq_kyc_interviewers_read'],
  courses: ['hq_courses_read'],
  portal: ['hq_portal_read'],
  events: ['hq_events_read'],
  subscriptions: ['hq_subscriptions_read'],
  employeeTickets: ['hq_employee_tickets_read'],
  employerDashboard: ['hq_employers_dashboard_read'],
  company: ['hq_companies_read'],
  tickets: ['hq_tickets_read'],
  employerTickets: ['hq_tickets_read'],
  tenants: ['hq_tenants_read'],
  recycleBin: ['hq_tenants_delete'],
  plans: ['hq_billing_read'],
  crmDashboard: ['hq_crm_dashboard_read'],
  leads: ['hq_leads_read'],
  clients: ['hq_clients_read'],
  team: ['hq_team_read'],
  reports: ['hq_reports_read'],
  billing: ['hq_ops_billing_read'],
  settings: ['hq_settings_read'],
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
