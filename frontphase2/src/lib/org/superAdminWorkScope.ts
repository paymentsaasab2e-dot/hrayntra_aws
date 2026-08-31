import { clearAllEmployerPageCaches } from '@/lib/employerPageCache';

const STORAGE_KEY = 'superAdminWorkScope';
export const SUPER_ADMIN_WORK_SCOPE_EVENT = 'super-admin-work-scope-changed';

export type SuperAdminWorkScope = 'own' | 'all';

export function getSuperAdminWorkScope(): SuperAdminWorkScope {
  if (typeof window === 'undefined') return 'all';
  try {
    const raw = String(localStorage.getItem(STORAGE_KEY) || 'all').trim().toLowerCase();
    return raw === 'own' ? 'own' : 'all';
  } catch {
    return 'all';
  }
}

export function setSuperAdminWorkScope(scope: SuperAdminWorkScope) {
  if (typeof window === 'undefined') return;
  const next: SuperAdminWorkScope = scope === 'own' ? 'own' : 'all';
  if (getSuperAdminWorkScope() === next) return;
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {
    return;
  }
  try {
    clearAllEmployerPageCaches();
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event(SUPER_ADMIN_WORK_SCOPE_EVENT));
  window.location.reload();
}
