import { clearAllEmployerPageCaches } from '@/lib/employerPageCache';

const STORAGE_ID = 'activeOrgUnitId';
const STORAGE_NAME = 'activeOrgUnitName';
export const ORG_WORKSPACE_EVENT = 'org-workspace-changed';

export function normalizeOrgUnitId(value: unknown): string {
  const id = String(value ?? '').trim();
  if (!id || id === 'null' || id === 'undefined') return '';
  return /^[a-fA-F0-9]{24}$/.test(id) ? id : '';
}

export function getActiveOrgUnitId(): string {
  if (typeof window === 'undefined') return '';
  try {
    return normalizeOrgUnitId(localStorage.getItem(STORAGE_ID));
  } catch {
    return '';
  }
}

export function getActiveOrgUnitName(): string {
  if (typeof window === 'undefined') return '';
  try {
    return String(localStorage.getItem(STORAGE_NAME) || '').trim();
  } catch {
    return '';
  }
}

/** Drop a saved company switch without forcing a full reload (used when user cannot switch). */
export function clearActiveOrgUnit(options?: { reload?: boolean }) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(STORAGE_ID);
    localStorage.removeItem(STORAGE_NAME);
  } catch {
    /* ignore */
  }
  try {
    clearAllEmployerPageCaches();
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event(ORG_WORKSPACE_EVENT));
  if (options?.reload) window.location.reload();
}

/** Persist the company Super Admin / tenant HQ is operating in. Reloads so CRM and recruitment refetch. */
export function setActiveOrgUnit(id: string, name?: string) {
  if (typeof window === 'undefined') return;
  const next = normalizeOrgUnitId(id);
  const prev = getActiveOrgUnitId();
  if (next === prev) return;
  try {
    if (!next) {
      localStorage.removeItem(STORAGE_ID);
      localStorage.removeItem(STORAGE_NAME);
    } else {
      localStorage.setItem(STORAGE_ID, next);
      if (name) localStorage.setItem(STORAGE_NAME, name);
    }
  } catch {
    return;
  }
  try {
    clearAllEmployerPageCaches();
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event(ORG_WORKSPACE_EVENT));
  window.location.reload();
}
