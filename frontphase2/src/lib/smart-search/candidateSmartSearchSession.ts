import type { SmartSearchKeywordChip } from './types';

const PREFIX = 'hryantra:candidate-smart-search:v1:';

export type CandidateSmartSearchSession = {
  ids: string[];
  keywords: SmartSearchKeywordChip[];
  prompt: string;
  search: string;
  status: string;
  company: string;
  location: string;
  jobId: string;
  stage: string;
  experienceRange: string;
};

type SessionFilters = {
  search: string;
  status: string;
  company: string;
  location: string;
  jobId: string;
  stage: string;
  experienceRange: string;
};

function tenantKey(): string {
  if (typeof window === 'undefined') return 'ssr';
  const tenant = String(localStorage.getItem('tenantDbName') || 'none').trim() || 'none';
  return `${PREFIX}${tenant}`;
}

function signature(filters: SessionFilters): string {
  return [
    String(filters.search || '').trim(),
    String(filters.status || '').trim(),
    String(filters.company || '').trim(),
    String(filters.location || '').trim(),
    String(filters.jobId || '').trim(),
    String(filters.stage || '').trim(),
    String(filters.experienceRange || '').trim(),
  ].join('\0');
}

function isObjectId(value: unknown): value is string {
  return typeof value === 'string' && /^[a-fA-F0-9]{24}$/.test(value);
}

function isKeyword(value: unknown): value is SmartSearchKeywordChip {
  if (!value || typeof value !== 'object') return false;
  const chip = value as SmartSearchKeywordChip;
  return Boolean(chip.id && chip.value && chip.label && chip.kind);
}

export function writeCandidateSmartSearchSession(payload: CandidateSmartSearchSession): void {
  if (typeof window === 'undefined') return;
  if (!Array.isArray(payload.ids) || payload.ids.length === 0) {
    clearCandidateSmartSearchSession();
    return;
  }
  try {
    sessionStorage.setItem(
      tenantKey(),
      JSON.stringify({
        ids: payload.ids.filter(isObjectId).slice(0, 500),
        keywords: (payload.keywords || []).filter(isKeyword).slice(0, 40),
        prompt: String(payload.prompt || '').slice(0, 500),
        search: payload.search || '',
        status: payload.status || '',
        company: payload.company || '',
        location: payload.location || '',
        jobId: payload.jobId || '',
        stage: payload.stage || '',
        experienceRange: payload.experienceRange || '',
      }),
    );
  } catch {
    /* quota / private mode */
  }
}

export function clearCandidateSmartSearchSession(): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(tenantKey());
  } catch {
    /* ignore */
  }
}

export function readCandidateSmartSearchSession(
  filters: SessionFilters,
): CandidateSmartSearchSession | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(tenantKey());
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CandidateSmartSearchSession;
    const ids = Array.isArray(parsed?.ids) ? parsed.ids.filter(isObjectId).slice(0, 500) : [];
    if (!ids.length) return null;
    if (signature(parsed) !== signature(filters)) return null;
    return {
      ids,
      keywords: Array.isArray(parsed.keywords) ? parsed.keywords.filter(isKeyword) : [],
      prompt: String(parsed.prompt || ''),
      search: String(parsed.search || ''),
      status: String(parsed.status || ''),
      company: String(parsed.company || ''),
      location: String(parsed.location || ''),
      jobId: String(parsed.jobId || ''),
      stage: String(parsed.stage || ''),
      experienceRange: String(parsed.experienceRange || ''),
    };
  } catch {
    return null;
  }
}
