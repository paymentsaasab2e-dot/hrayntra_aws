import { categorizePhase2Path } from './categories';
import type { TenantActivityCategory } from './types';

export type ParsedPathEntity = {
  entityType?: string;
  entityId?: string;
  entityLabel?: string;
  category: TenantActivityCategory;
};

const DETAIL_PATTERNS: Array<{ re: RegExp; entityType: string; category: TenantActivityCategory }> = [
  { re: /^\/job\/([^/?#]+)/i, entityType: 'job', category: 'jobs' },
  { re: /^\/candidate\/([^/?#]+)/i, entityType: 'candidate', category: 'candidates' },
  { re: /^\/leads?\/([^/?#]+)/i, entityType: 'lead', category: 'leads' },
  { re: /^\/client\/([^/?#]+)/i, entityType: 'client', category: 'clients' },
  { re: /^\/contacts?\/([^/?#]+)/i, entityType: 'contact', category: 'contacts' },
  { re: /^\/interviews?\/([^/?#]+)/i, entityType: 'interview', category: 'interviews' },
  { re: /^\/placement\/([^/?#]+)/i, entityType: 'placement', category: 'placements' },
  { re: /^\/pipeline\/([^/?#]+)/i, entityType: 'pipeline', category: 'pipeline' },
  { re: /^\/matches?\/([^/?#]+)/i, entityType: 'match', category: 'matches' },
  { re: /^\/events?\/([^/?#]+)/i, entityType: 'event', category: 'calendar' },
  { re: /^\/team\/([^/?#]+)/i, entityType: 'team_member', category: 'team' },
  { re: /^\/request\/([^/?#]+)/i, entityType: 'request', category: 'team' },
];

export function parseEntityFromPath(pathname: string): ParsedPathEntity {
  const path = (pathname || '/').split('?')[0];
  for (const row of DETAIL_PATTERNS) {
    const match = path.match(row.re);
    if (match?.[1] && match[1] !== 'new' && match[1] !== 'create') {
      return {
        entityType: row.entityType,
        entityId: decodeURIComponent(match[1]),
        category: row.category,
      };
    }
  }
  return { category: categorizePhase2Path(path) };
}

export function parseSearchIntent(search: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (!search) return out;
  try {
    const params = new URLSearchParams(search.startsWith('?') ? search : `?${search}`);
    for (const key of ['search', 'q', 'tab', 'status', 'filter', 'stage', 'assignedTo']) {
      const val = params.get(key);
      if (val) out[key] = val.slice(0, 80);
    }
  } catch {
    /* ignore */
  }
  return out;
}

/** Recruitment funnel order for journey scoring */
export const WORKFLOW_FUNNEL: TenantActivityCategory[] = [
  'leads',
  'clients',
  'jobs',
  'candidates',
  'pipeline',
  'matches',
  'interviews',
  'placements',
];

export function funnelIndex(category: TenantActivityCategory): number {
  const idx = WORKFLOW_FUNNEL.indexOf(category);
  return idx >= 0 ? idx : -1;
}

export function isForwardFunnelStep(from: TenantActivityCategory, to: TenantActivityCategory): boolean {
  const a = funnelIndex(from);
  const b = funnelIndex(to);
  return a >= 0 && b >= 0 && b > a;
}
