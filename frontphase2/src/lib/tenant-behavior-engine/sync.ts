import { apiFetch } from '../api';
import { buildTenantActivityRollup } from './insights';
import { getTenantActivityState } from './store';
import type { TenantBehaviorLiveDashboard, TenantBehaviorPayload } from './types';

export const TENANT_BEHAVIOR_LIVE_UPDATED_EVENT = 'saasa:tenant-behavior-live-updated';

export function buildTenantBehaviorPayload(
  tenantDbName: string,
  userId: string,
  userName?: string,
): TenantBehaviorPayload | null {
  if (!tenantDbName || !userId) return null;
  const state = getTenantActivityState(tenantDbName, userId);
  if (userName) state.userName = userName;
  const rollupToday = buildTenantActivityRollup(state, 'today');
  const rollup7d = buildTenantActivityRollup(state, 'week');
  return {
    userId,
    tenantDbName,
    userName: state.userName || userName,
    capturedAt: new Date().toISOString(),
    activityStateUpdatedAt: state.updatedAt,
    rollupToday,
    rollup7d,
    triggers: rollup7d?.triggers || rollupToday?.triggers || [],
  };
}

export async function postTenantBehaviorPayload(payload: TenantBehaviorPayload): Promise<void> {
  await apiFetch('/tenant-behavior', {
    method: 'POST',
    auth: true,
    body: payload,
  })
    .then(() => {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent(TENANT_BEHAVIOR_LIVE_UPDATED_EVENT));
      }
    })
    .catch(() => {
      /* best-effort */
    });
}

export async function fetchTenantBehaviorLive(): Promise<TenantBehaviorLiveDashboard | null> {
  const res = await apiFetch<TenantBehaviorLiveDashboard>('/tenant-behavior/live', {
    auth: true,
  });
  return res.data || null;
}

export async function fetchTenantBehaviorAggregate(): Promise<TenantBehaviorLiveDashboard | null> {
  return fetchTenantBehaviorLive();
}

export async function fetchTenantBehaviorByUser(userId: string) {
  const res = await apiFetch<{ payload: TenantBehaviorPayload | null }>(
    `/tenant-behavior/user/${encodeURIComponent(userId)}`,
    { auth: true },
  );
  return res.data?.payload || null;
}

export async function fetchMyTenantBehavior() {
  const res = await apiFetch<{ payload: TenantBehaviorPayload | null }>('/tenant-behavior/me', {
    auth: true,
  });
  return res.data?.payload || null;
}
