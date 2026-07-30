/**
 * HQ-scoped RBAC permission catalog (mirrors Phase 2 PermissionPicker shape).
 * permissionName is used as the stable id.
 */
export const HQ_PERMISSION_CATALOG = [
  { permissionName: 'hq_dashboard_read', module: 'Dashboard', description: 'View HQ dashboards' },
  { permissionName: 'hq_leads_read', module: 'Leads', description: 'View HQ leads' },
  { permissionName: 'hq_leads_write', module: 'Leads', description: 'Create and edit HQ leads' },
  { permissionName: 'hq_leads_delete', module: 'Leads', description: 'Delete HQ leads' },
  { permissionName: 'hq_clients_read', module: 'Clients', description: 'View HQ clients' },
  { permissionName: 'hq_clients_write', module: 'Clients', description: 'Create and edit HQ clients' },
  { permissionName: 'hq_clients_delete', module: 'Clients', description: 'Delete HQ clients' },
  { permissionName: 'hq_companies_read', module: 'Companies', description: 'View HQ companies' },
  { permissionName: 'hq_companies_write', module: 'Companies', description: 'Create and edit HQ companies' },
  { permissionName: 'hq_tenants_read', module: 'Tenants', description: 'View tenants' },
  { permissionName: 'hq_tenants_write', module: 'Tenants', description: 'Create and manage tenants' },
  { permissionName: 'hq_candidates_read', module: 'Candidates', description: 'View Phase 1 candidates' },
  { permissionName: 'hq_portal_read', module: 'Portal', description: 'View portal jobs' },
  { permissionName: 'hq_portal_write', module: 'Portal', description: 'Manage portal jobs' },
  { permissionName: 'hq_team_read', module: 'Team', description: 'View HQ team' },
  { permissionName: 'hq_team_write', module: 'Team', description: 'Add and edit HQ team members' },
  { permissionName: 'hq_roles_manage', module: 'Team', description: 'Create and edit HQ roles & permissions' },
  { permissionName: 'hq_reports_read', module: 'Reports', description: 'View HQ reports' },
  { permissionName: 'hq_billing_read', module: 'Billing', description: 'View billing and packages' },
  { permissionName: 'hq_billing_write', module: 'Billing', description: 'Manage packages and billing' },
  { permissionName: 'hq_analytics_read', module: 'Analytics', description: 'View platform analytics' },
];

export const HQ_DEFAULT_ROLES = [
  {
    roleName: 'HQ Admin',
    description: 'Full access to headquarters console',
    color: '#4F46E5',
    permissionIds: HQ_PERMISSION_CATALOG.map((p) => p.permissionName),
  },
  {
    roleName: 'HQ Manager',
    description: 'CRM and team operations without tenant delete',
    color: '#0EA5E9',
    permissionIds: HQ_PERMISSION_CATALOG.map((p) => p.permissionName).filter(
      (id) => !['hq_tenants_write', 'hq_billing_write', 'hq_portal_write'].includes(id),
    ),
  },
  {
    roleName: 'HQ Viewer',
    description: 'Read-only access across HQ modules',
    color: '#64748B',
    permissionIds: HQ_PERMISSION_CATALOG.map((p) => p.permissionName).filter((id) =>
      id.endsWith('_read'),
    ),
  },
];

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
