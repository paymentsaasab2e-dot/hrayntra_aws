/**
 * Maps new HQ sidebar nav items → permission keys (any-of).
 * Used when filtering HQ nav for team members with assigned roles.
 */
export const HQ_PERMISSIONS_STORAGE_KEY = 'hrayntra:hq-permission-ids';

export const HQ_NAV_PERMISSION_MAP: Record<string, string[]> = {
  dashboard: ['hq_dashboard_read', 'hq_analytics_read'],
  candidates: ['hq_candidates_read'],
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

export function readHqPermissionIds(): string[] | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(HQ_PERMISSIONS_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : null;
  } catch {
    return null;
  }
}

export function writeHqPermissionIds(permissionIds: string[] | null | undefined): void {
  if (typeof window === 'undefined') return;
  if (!permissionIds || permissionIds.length === 0) {
    localStorage.removeItem(HQ_PERMISSIONS_STORAGE_KEY);
    return;
  }
  localStorage.setItem(HQ_PERMISSIONS_STORAGE_KEY, JSON.stringify(permissionIds));
}

export function canAccessHqNav(navId: string, permissionIds: string[] | null | undefined): boolean {
  // Platform / unrestricted sessions (no team permission list) keep full nav.
  if (!permissionIds || permissionIds.length === 0) return true;
  const required = HQ_NAV_PERMISSION_MAP[navId];
  if (!required?.length) return true;
  const set = new Set(permissionIds);
  return required.some((id) => set.has(id));
}
