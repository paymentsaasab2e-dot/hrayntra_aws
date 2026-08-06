const STORAGE_PREFIX = 'hryantra.drawer-engine.dismissed.';

function key(scope: string) {
  return `${STORAGE_PREFIX}${scope}`;
}

export function wasDrawerAlertDismissed(scope: string): boolean {
  if (typeof sessionStorage === 'undefined') return false;
  try {
    return sessionStorage.getItem(key(scope)) === '1';
  } catch {
    return false;
  }
}

export function dismissDrawerAlert(scope: string) {
  if (typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.setItem(key(scope), '1');
  } catch {
    // ignore quota / private mode
  }
}

export function drawerAlertScope(entityKind: string, entityId: string, kind: 'missing' | 'overdue' | 'all') {
  return `${entityKind}:${entityId}:${kind}`;
}

export function tenantOverdueAlertScope(tenantKey: string) {
  return `tenant-overdue:${tenantKey}:${new Date().toISOString().slice(0, 10)}`;
}
