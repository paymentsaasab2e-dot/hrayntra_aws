/**
 * Maps HQ sidebar nav items → permission keys (any-of).
 * Used when filtering HQ nav for team members with assigned roles.
 */

export const HQ_PERMISSIONS_STORAGE_KEY = 'hrayntra:hq-permission-ids';
export const HQ_PLATFORM_EMAIL = 'admin@gmail.com';

/** Keep in sync with backend `hq-rbac.catalog.js` HQ_NAV_PERMISSION_MAP */
export const HQ_NAV_PERMISSION_MAP: Record<string, string[]> = {
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

export const HQ_NAV_HREF_MAP: Record<string, string> = {
  dashboard: '/hq?view=employee',
  candidates: '/hq/candidates',
  kycVerified: '/hq/kyc-verified',
  courses: '/hq/courses',
  portal: '/hq/portal',
  events: '/hq/events',
  subscriptions: '/hq/subscriptions',
  employeeTickets: '/hq/tickets?audience=employee',
  employerDashboard: '/hq?view=employer',
  company: '/hq/company',
  tenants: '/hq?tab=tenants',
  plans: '/hq?tab=plans',
  employerTickets: '/hq/tickets?audience=employer',
  recycleBin: '/hq/recycle-bin',
  crmDashboard: '/hq/crm-dashboard',
  leads: '/hq/leads',
  clients: '/hq/clients',
  team: '/hq/team',
  reports: '/hq/reports',
  billing: '/hq/billing',
  settings: '/hq/settings',
};

/** Preferred landing order for restricted HQ team members */
export const HQ_NAV_LANDING_ORDER = [
  'dashboard',
  'candidates',
  'kycVerified',
  'courses',
  'portal',
  'events',
  'subscriptions',
  'employeeTickets',
  'employerDashboard',
  'company',
  'tenants',
  'plans',
  'employerTickets',
  'recycleBin',
  'crmDashboard',
  'leads',
  'clients',
  'team',
  'reports',
  'billing',
  'settings',
] as const;

export type HqNavAccessMode = 'full' | 'restricted';

export type HqNavAccess = {
  mode: HqNavAccessMode;
  permissionIds: string[];
  isHqTeamMember: boolean;
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

export function applyHqSessionAccess(payload: {
  isHqTeamMember?: boolean;
  hqTeamMemberId?: string;
  hqPermissionIds?: string[] | null;
  loginId?: string;
  email?: string;
}): void {
  if (typeof window === 'undefined') return;

  const isHqTeamMember = Boolean(payload.isHqTeamMember || payload.hqTeamMemberId);
  const hqPermissionIds = Array.isArray(payload.hqPermissionIds)
    ? payload.hqPermissionIds.filter((id) => String(id).startsWith('hq_'))
    : [];

  if (isHqTeamMember) {
    writeHqPermissionIds(hqPermissionIds);
    try {
      const raw = localStorage.getItem('currentUser');
      const parsed = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
      localStorage.setItem(
        'currentUser',
        JSON.stringify({
          ...parsed,
          email: payload.email || parsed.email,
          loginId: payload.loginId || parsed.loginId,
          isHqTeamMember: true,
          hqTeamMemberId: payload.hqTeamMemberId || parsed.hqTeamMemberId,
        }),
      );
    } catch {
      /* ignore */
    }
    return;
  }

  writeHqPermissionIds(null);
}

function readCurrentUserEmail(): string {
  if (typeof window === 'undefined') return '';
  try {
    const raw = localStorage.getItem('currentUser');
    if (!raw) return '';
    return String(JSON.parse(raw)?.email || '').trim().toLowerCase();
  } catch {
    return '';
  }
}

function readCurrentUserIsHqTeamMember(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const raw = localStorage.getItem('currentUser');
    if (!raw) return false;
    const user = JSON.parse(raw) as { hqTeamMemberId?: string; isHqTeamMember?: boolean };
    return Boolean(user?.hqTeamMemberId || user?.isHqTeamMember);
  } catch {
    return false;
  }
}

function parseHqAllowedEmailsLocal(): string[] {
  const raw = process.env.NEXT_PUBLIC_HQ_ALLOWED_EMAILS?.trim();
  if (raw) {
    return raw.split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
  }
  return [HQ_PLATFORM_EMAIL.toLowerCase()];
}

export function isHqPlatformOperatorEmail(email: string | undefined | null): boolean {
  const normalized = String(email || '').trim().toLowerCase();
  return normalized ? parseHqAllowedEmailsLocal().includes(normalized) : false;
}

function normalizeHqScopedPermissionIds(permissionIds: string[] | null | undefined): string[] {
  if (!Array.isArray(permissionIds)) return [];
  return permissionIds.map(String).filter((id) => id.startsWith('hq_'));
}

/**
 * Effective HQ nav permissions for the current browser session.
 * Platform operators get `mode: full`. HQ team members get `mode: restricted`.
 */
export function resolveHqNavAccess(): HqNavAccess {
  if (typeof window === 'undefined') {
    return { mode: 'full', permissionIds: [], isHqTeamMember: false };
  }

  const email = readCurrentUserEmail();
  const isTeamMember = readCurrentUserIsHqTeamMember();

  if (isHqPlatformOperatorEmail(email) && !isTeamMember) {
    const stale = readHqPermissionIds();
    if (stale?.length) writeHqPermissionIds(null);
    return { mode: 'full', permissionIds: [], isHqTeamMember: false };
  }

  if (isTeamMember) {
    return {
      mode: 'restricted',
      permissionIds: normalizeHqScopedPermissionIds(readHqPermissionIds()),
      isHqTeamMember: true,
    };
  }

  const stored = normalizeHqScopedPermissionIds(readHqPermissionIds());
  if (stored.length > 0) {
    return { mode: 'restricted', permissionIds: stored, isHqTeamMember: false };
  }

  return { mode: 'full', permissionIds: [], isHqTeamMember: false };
}

/** @deprecated Use resolveHqNavAccess().permissionIds with canAccessHqNav(access, navId) */
export function resolveHqNavPermissionIds(): string[] | null {
  const access = resolveHqNavAccess();
  return access.mode === 'full' ? null : access.permissionIds;
}

export function canAccessHqNav(navId: string, access: HqNavAccess | HqNavAccessMode | string[] | null | undefined, legacyPermissionIds?: string[] | null): boolean {
  let mode: HqNavAccessMode = 'full';
  let permissionIds: string[] = [];

  if (access && typeof access === 'object' && 'mode' in access) {
    mode = access.mode;
    permissionIds = access.permissionIds;
  } else if (Array.isArray(access)) {
    mode = 'restricted';
    permissionIds = access;
  } else if (access === 'restricted' || access === 'full') {
    mode = access;
    permissionIds = legacyPermissionIds || [];
  } else if (access === null || access === undefined) {
    mode = 'full';
  }

  if (mode === 'full') return true;

  const required = HQ_NAV_PERMISSION_MAP[navId];
  if (!required?.length) return false;
  const set = new Set(permissionIds);
  return required.some((id) => set.has(id));
}

export function resolveHqNavIdFromLocation(
  pathname: string,
  params: { tab?: string | null; view?: string | null; audience?: string | null } = {},
): string | null {
  const tab = params.tab ?? null;
  const view = params.view ?? null;
  const audience = params.audience ?? null;

  if (pathname === '/hq/leads' || pathname.startsWith('/hq/leads/')) return 'leads';
  if (pathname === '/hq/clients' || pathname.startsWith('/hq/clients/')) return 'clients';
  if (pathname === '/hq/crm-dashboard' || pathname.startsWith('/hq/crm-dashboard/')) return 'crmDashboard';
  if (pathname === '/hq/team' || pathname.startsWith('/hq/team/')) return 'team';
  if (pathname === '/hq/reports' || pathname.startsWith('/hq/reports/')) return 'reports';
  if (pathname === '/hq/billing' || pathname.startsWith('/hq/billing/')) return 'billing';
  if (pathname === '/hq/settings' || pathname.startsWith('/hq/settings/')) return 'settings';
  if (pathname === '/hq/company' || pathname.startsWith('/hq/company/')) return 'company';
  if (pathname === '/hq/candidates' || pathname.startsWith('/hq/candidates/')) return 'candidates';
  if (pathname === '/hq/kyc-verified' || pathname.startsWith('/hq/kyc-verified/')) return 'kycVerified';
  if (pathname === '/hq/courses' || pathname.startsWith('/hq/courses/')) return 'courses';
  if (pathname === '/hq/subscriptions' || pathname.startsWith('/hq/subscriptions/')) return 'subscriptions';
  if (pathname === '/hq/portal' || pathname.startsWith('/hq/portal/')) return 'portal';
  if (pathname === '/hq/events' || pathname.startsWith('/hq/events/')) return 'events';
  if (pathname === '/hq/recycle-bin' || pathname.startsWith('/hq/recycle-bin/')) return 'recycleBin';
  if (pathname === '/hq/tickets' || pathname.startsWith('/hq/tickets/')) {
    return audience === 'employer' ? 'employerTickets' : 'employeeTickets';
  }
  if (pathname === '/hq') {
    if (tab === 'tenants') return 'tenants';
    if (tab === 'plans') return 'plans';
    if (view === 'employer') return 'employerDashboard';
    if (view === 'platform') return 'dashboard';
    return 'dashboard';
  }
  return null;
}

export function pickDefaultHqPath(access: HqNavAccess): string {
  if (access.mode === 'full') return '/hq?view=employee';
  for (const navId of HQ_NAV_LANDING_ORDER) {
    if (canAccessHqNav(navId, access)) {
      return HQ_NAV_HREF_MAP[navId] || '/hq';
    }
  }
  return '/hq/login';
}
