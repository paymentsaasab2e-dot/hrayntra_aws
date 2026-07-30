import type { TenantActivityCategory } from './types';

export function categorizePhase2Path(pathname: string): TenantActivityCategory {
  const path = (pathname || '/').split('?')[0].toLowerCase();

  if (path.startsWith('/job')) return 'jobs';
  if (path.startsWith('/candidate')) return 'candidates';
  if (path.startsWith('/leads')) return 'leads';
  if (path.startsWith('/client')) return 'clients';
  if (path.startsWith('/contacts')) return 'contacts';
  if (path.startsWith('/interviews')) return 'interviews';
  if (path.startsWith('/placement') || path.startsWith('/placements')) return 'placements';
  if (path.startsWith('/pipeline')) return 'pipeline';
  if (path.startsWith('/matches')) return 'matches';
  if (path.startsWith('/reports')) return 'reports';
  if (path.startsWith('/calendar') || path.startsWith('/events')) return 'calendar';
  if (path.startsWith('/inbox')) return 'inbox';
  if (path.startsWith('/team')) return 'team';
  if (path.startsWith('/billing')) return 'billing';
  if (path.startsWith('/setting') || path.startsWith('/administration')) return 'settings';
  if (path.startsWith('/demoai') || path.startsWith('/brain') || path.includes('/ai')) return 'ai';
  if (path.startsWith('/recruitment')) return 'recruitment';
  if (path.startsWith('/dashboard')) return 'dashboard';
  if (path.startsWith('/thebehave')) return 'reports';
  if (path.startsWith('/activity-feed') || path.startsWith('/recycle-bin')) return 'settings';
  if (path.startsWith('/task')) return 'pipeline';
  if (path.startsWith('/request')) return 'team';
  return 'other';
}

export function categoryLabel(cat: TenantActivityCategory | string): string {
  const labels: Record<string, string> = {
    jobs: 'Jobs',
    candidates: 'Candidates',
    leads: 'Leads',
    clients: 'Clients',
    contacts: 'Contacts',
    interviews: 'Interviews',
    placements: 'Placements',
    pipeline: 'Pipeline',
    matches: 'Matches',
    reports: 'Reports & analytics',
    calendar: 'Calendar & events',
    inbox: 'Inbox',
    team: 'Team',
    billing: 'Billing',
    settings: 'Settings',
    ai: 'AI workspace',
    events: 'Events',
    recruitment: 'Recruitment hub',
    dashboard: 'Dashboard',
    other: 'Other',
  };
  return labels[cat] || String(cat);
}

export function isMeaningfulPhase2Path(pathname: string): boolean {
  const path = (pathname || '/').split('?')[0].toLowerCase();
  if (!path || path === '/') return false;
  if (path.startsWith('/login') || path.startsWith('/hq/login')) return false;
  if (path.startsWith('/forgot-password') || path.startsWith('/reset-password')) return false;
  if (path.startsWith('/apply') || path.startsWith('/client-review')) return false;
  if (path === '/thebehave') return false;
  return true;
}

export function localDateKey(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function formatDuration(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}
