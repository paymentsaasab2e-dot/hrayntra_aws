const STORAGE_ID = 'activeOrgUnitId';
const STORAGE_NAME = 'activeOrgUnitName';
export const ORG_WORKSPACE_EVENT = 'org-workspace-changed';

export function getActiveOrgUnitId(): string {
  if (typeof window === 'undefined') return '';
  try {
    return String(localStorage.getItem(STORAGE_ID) || '').trim();
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

/** Persist the company Super Admin / tenant HQ is operating in. Reloads so CRM and recruitment refetch. */
export function setActiveOrgUnit(id: string, name?: string) {
  if (typeof window === 'undefined') return;
  const next = String(id || '').trim();
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
  window.dispatchEvent(new Event(ORG_WORKSPACE_EVENT));
  window.location.reload();
}
