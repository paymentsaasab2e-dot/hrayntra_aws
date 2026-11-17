/**
 * HQ-controlled Phase 2 sidenav modules / tabs.
 * Keep ids stable — they are stored on HQ workspace users + tenant org settings.
 */
import type { LucideIcon } from 'lucide-react';
import {
  Award,
  BarChart3,
  Briefcase,
  Calendar,
  CalendarDays,
  CheckSquare,
  Contact,
  CreditCard,
  GitBranch,
  History,
  LayoutDashboard,
  Mail,
  MessageSquarePlus,
  Settings,
  ShieldCheck,
  Target,
  Trash2,
  UserPlus,
  UserRound,
  Users,
  Zap,
} from 'lucide-react';

export type TenantProductLine = 'crm' | 'recruitment';

export type TenantModuleDef = {
  id: string;
  label: string;
  icon: LucideIcon;
  /** Which product-line catalogs highlight this module by default */
  lines: TenantProductLine[];
};

/** Full catalog HQ can enable / disable for any tenant (including after create). */
export const ALL_TENANT_MODULES: TenantModuleDef[] = [
  { id: 'leads', label: 'Leads', icon: Target, lines: ['crm'] },
  { id: 'clients', label: 'CRM Clients', icon: Users, lines: ['crm'] },
  { id: 'crm_dashboard', label: 'CRM Dashboard', icon: LayoutDashboard, lines: ['crm'] },
  { id: 'recruitment_clients', label: 'Recruitment Clients', icon: Users, lines: ['recruitment'] },
  { id: 'jobs', label: 'Jobs', icon: Briefcase, lines: ['recruitment'] },
  { id: 'candidates', label: 'Candidates', icon: UserRound, lines: ['recruitment'] },
  { id: 'interviews', label: 'Interviews', icon: Calendar, lines: ['recruitment'] },
  { id: 'placements', label: 'Placements', icon: Award, lines: ['recruitment'] },
  { id: 'command_center', label: 'Command Center', icon: LayoutDashboard, lines: ['recruitment'] },
  { id: 'pipeline', label: 'Pipeline', icon: GitBranch, lines: ['recruitment'] },
  { id: 'matches', label: 'Matches', icon: Zap, lines: ['recruitment'] },
  { id: 'tasks_activities', label: 'Tasks & Activities', icon: CheckSquare, lines: ['crm', 'recruitment'] },
  { id: 'events', label: 'Portal Events', icon: CalendarDays, lines: ['crm', 'recruitment'] },
  { id: 'inbox', label: 'Inbox', icon: Mail, lines: ['recruitment'] },
  { id: 'contacts', label: 'Contacts', icon: Contact, lines: ['recruitment'] },
  { id: 'reports', label: 'Reports', icon: BarChart3, lines: ['crm', 'recruitment'] },
  { id: 'billing', label: 'Billing', icon: CreditCard, lines: ['crm', 'recruitment'] },
  { id: 'recycle_bin', label: 'Recycle Bin', icon: Trash2, lines: ['crm', 'recruitment'] },
  { id: 'activity_feed', label: 'Activity log', icon: History, lines: ['crm', 'recruitment'] },
  { id: 'team', label: 'Team', icon: UserPlus, lines: ['crm', 'recruitment'] },
  { id: 'requests', label: 'Request', icon: MessageSquarePlus, lines: ['crm', 'recruitment'] },
  { id: 'approvals', label: 'Approvals', icon: ShieldCheck, lines: ['crm', 'recruitment'] },
  { id: 'settings', label: 'Settings', icon: Settings, lines: ['crm', 'recruitment'] },
];

export const CRM_TENANT_MODULES = ALL_TENANT_MODULES.filter((m) => m.lines.includes('crm'));
export const RECRUITMENT_TENANT_MODULES = ALL_TENANT_MODULES.filter((m) =>
  m.lines.includes('recruitment'),
);

export function defaultModulesForProductLine(line: TenantProductLine): string[] {
  const list = line === 'recruitment' ? RECRUITMENT_TENANT_MODULES : CRM_TENANT_MODULES;
  return list.map((m) => m.id);
}

export function modulesForProductLine(line: TenantProductLine): TenantModuleDef[] {
  return line === 'recruitment' ? RECRUITMENT_TENANT_MODULES : CRM_TENANT_MODULES;
}

/** Full picker list for edit-after-create (CRM + Recruitment + shared). */
export function allModulesForHqPicker(): TenantModuleDef[] {
  return ALL_TENANT_MODULES;
}

/**
 * Map Phase 2 route prefixes → HQ tenant module ids.
 * Used by sidenav (already) and route guards so disabled tabs cannot be opened via URL.
 */
export const ROUTE_HQ_MODULE_MAP: Array<{ prefix: string; moduleId: string }> = [
  { prefix: '/leads', moduleId: 'leads' },
  { prefix: '/client', moduleId: 'clients' },
  { prefix: '/dashboard', moduleId: 'crm_dashboard' },
  { prefix: '/job', moduleId: 'jobs' },
  { prefix: '/candidate', moduleId: 'candidates' },
  { prefix: '/interviews', moduleId: 'interviews' },
  { prefix: '/placement', moduleId: 'placements' },
  { prefix: '/placements', moduleId: 'placements' },
  { prefix: '/recruitment', moduleId: 'command_center' },
  { prefix: '/pipeline', moduleId: 'pipeline' },
  { prefix: '/matches', moduleId: 'matches' },
  { prefix: '/Task&Activites', moduleId: 'tasks_activities' },
  { prefix: '/events', moduleId: 'events' },
  { prefix: '/calendar', moduleId: 'events' },
  { prefix: '/inbox', moduleId: 'inbox' },
  { prefix: '/contacts', moduleId: 'contacts' },
  { prefix: '/reports', moduleId: 'reports' },
  { prefix: '/billing', moduleId: 'billing' },
  { prefix: '/recycle-bin', moduleId: 'recycle_bin' },
  { prefix: '/activity-feed', moduleId: 'activity_feed' },
  { prefix: '/team', moduleId: 'team' },
  { prefix: '/request/approval', moduleId: 'approvals' },
  { prefix: '/request', moduleId: 'requests' },
  { prefix: '/subscription', moduleId: 'settings' },
  { prefix: '/setting', moduleId: 'settings' },
  { prefix: '/administration', moduleId: 'settings' },
  { prefix: '/thebehave', moduleId: 'settings' },
  { prefix: '/tenant-behave', moduleId: 'settings' },
];

const CRM_SURFACE_MODULE_IDS = new Set(['leads', 'crm_dashboard']);
const RECRUITMENT_SURFACE_MODULE_IDS = new Set([
  'recruitment_clients',
  'jobs',
  'candidates',
  'command_center',
  'pipeline',
  'matches',
  'interviews',
  'placements',
  'inbox',
  'contacts',
  'peoplecore',
  'hrms',
  'payroll',
]);

/** Expand legacy shared `clients` into CRM vs Recruitment client module ids. */
export function expandLegacyClientModules(modules: string[]): string[] {
  const list = [...new Set((modules || []).map((m) => String(m || '').trim()).filter(Boolean))];
  if (!list.includes('clients') || list.includes('recruitment_clients')) return list;

  const hasCrm = list.some((id) => CRM_SURFACE_MODULE_IDS.has(id));
  const hasRecruitment = list.some((id) => RECRUITMENT_SURFACE_MODULE_IDS.has(id));

  if (hasRecruitment && !hasCrm) {
    return list.map((id) => (id === 'clients' ? 'recruitment_clients' : id));
  }
  if (hasRecruitment && hasCrm) {
    return [...list, 'recruitment_clients'];
  }
  return list;
}

export function getHqModuleIdForPath(
  pathname: string | null | undefined,
  search?: string | null,
): string | null {
  const raw = String(pathname || '');
  const path = raw.split('?')[0];
  const query = String(search ?? (raw.includes('?') ? raw.slice(raw.indexOf('?')) : '') || '');
  if (!path) return null;

  if (path === '/client' || path.startsWith('/client/')) {
    const params = new URLSearchParams(query.startsWith('?') ? query.slice(1) : query);
    if (params.get('scope') === 'recruitment') return 'recruitment_clients';
    return 'clients';
  }

  const hit = ROUTE_HQ_MODULE_MAP.find(
    (row) => path === row.prefix || path.startsWith(`${row.prefix}/`),
  );
  return hit?.moduleId || null;
}
