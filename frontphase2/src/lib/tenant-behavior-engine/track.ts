import { getTenantDbName } from '../api';
import { classifyTenantApiCall, extractEntityLabelFromBody } from './api-classifier';
import { parseEntityFromPath } from './path-entities';
import {
  recordTenantAction,
  recordTenantEntityClick,
  recordTenantEntityView,
} from './store';

function resolveTrackingContext() {
  if (typeof window === 'undefined') return null;
  try {
    const tenantDbName = getTenantDbName();
    const raw = localStorage.getItem('currentUser');
    if (!tenantDbName || !raw) return null;
    const user = JSON.parse(raw) as { id?: string };
    if (!user?.id) return null;
    return { tenantDbName, userId: user.id };
  } catch {
    return null;
  }
}

/** Track successful API mutations (create/update/delete/export/etc.). */
export function trackTenantApiCall(path: string, method: string, body?: unknown) {
  const ctx = resolveTrackingContext();
  if (!ctx) return;
  const classified = classifyTenantApiCall(path, method);
  if (!classified?.trackable) return;

  const label = extractEntityLabelFromBody(body);
  recordTenantAction(ctx.tenantDbName, ctx.userId, {
    actionType: classified.actionType,
    category: classified.category,
    path: typeof window !== 'undefined' ? window.location.pathname : undefined,
    entityType: classified.entityType,
    entityId: classified.entityId,
    entityLabel: label,
    source: 'api',
    meta: { apiPath: path, method },
  });
}

/** Track navigation to entity detail pages. */
export function trackTenantPathEntity(pathname: string, search = '') {
  const ctx = resolveTrackingContext();
  if (!ctx) return;
  const parsed = parseEntityFromPath(pathname);
  if (!parsed.entityType || !parsed.entityId) return;

  recordTenantEntityView(ctx.tenantDbName, ctx.userId, {
    pathname: `${pathname}${search}`,
    entityType: parsed.entityType,
    entityId: parsed.entityId,
    category: parsed.category,
  });
}

/** Manual entity click tracking from list rows / cards. */
export function trackTenantEntityClick(input: {
  entityType: string;
  entityId?: string;
  entityLabel?: string;
  category: import('./types').TenantActivityCategory;
  pathname?: string;
}) {
  const ctx = resolveTrackingContext();
  if (!ctx) return;
  recordTenantEntityClick(ctx.tenantDbName, ctx.userId, input);
}

/** Manual UI action (drawer save, bulk action, etc.). */
export function trackTenantUiAction(input: {
  actionType: string;
  category: import('./types').TenantActivityCategory;
  entityType?: string;
  entityId?: string;
  entityLabel?: string;
  meta?: Record<string, unknown>;
}) {
  const ctx = resolveTrackingContext();
  if (!ctx) return;
  recordTenantAction(ctx.tenantDbName, ctx.userId, {
    ...input,
    source: 'ui',
    path: typeof window !== 'undefined' ? window.location.pathname : undefined,
  });
}
