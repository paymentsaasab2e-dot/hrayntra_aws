import { apiFetch } from '../api';
import { buildTenantSessionEngagement } from './alert-timing';
import { buildTenantBehaviourSuggestions } from './behaviour-suggestions';
import { buildTenantActivityRollup } from './insights';
import { buildTenantInterestSnapshot } from './interest-affinity';
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
  const rollupMonth = buildTenantActivityRollup(state, 'month');
  const rollupYear = buildTenantActivityRollup(state, 'year');
  const triggers = rollup7d?.triggers || rollupToday?.triggers || [];

  const sessionEngagement = buildTenantSessionEngagement(state.sessions || []);
  const { topics: interestTopics, personalizedRecs } = buildTenantInterestSnapshot(tenantDbName, userId);

  const suggestions = buildTenantBehaviourSuggestions({
    triggers,
    topModule: rollup7d?.topModules?.[0]?.label,
    topEntity: rollup7d?.topEntities?.[0]?.label || rollup7d?.topEntities?.[0]?.entityType,
    crmSnapshot: state.crmSnapshot,
  });

  return {
    userId,
    tenantDbName,
    userName: state.userName || userName,
    capturedAt: new Date().toISOString(),
    activityStateUpdatedAt: state.updatedAt,
    rollupToday,
    rollup7d,
    rollupMonth,
    rollupYear,
    triggers,
    sessionEngagement,
    interestTopics,
    personalizedRecs,
    suggestions,
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

/** Single endpoint — all tenant behaviour data for every user. */
export async function fetchAllTenantBehavior(): Promise<{
  serverTime: string;
  tenantDbName: string | null;
  userCount: number;
  crmContext: TenantBehaviorLiveDashboard['crmContext'];
  intelligenceSummary: string[];
  tenantHealthScore: number;
  users: Array<{
    userId: string;
    userName?: string;
    capturedAt: string;
    payload: TenantBehaviorPayload;
  }>;
  liveDashboard: TenantBehaviorLiveDashboard | null;
} | null> {
  const res = await apiFetch<{
    serverTime: string;
    tenantDbName: string | null;
    userCount: number;
    crmContext: TenantBehaviorLiveDashboard['crmContext'];
    intelligenceSummary: string[];
    tenantHealthScore: number;
    users: Array<{
      userId: string;
      userName?: string;
      capturedAt: string;
      payload: TenantBehaviorPayload;
    }>;
    liveDashboard: TenantBehaviorLiveDashboard | null;
  }>('/tenant-behavior/all', { auth: true });
  return res.data || null;
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
