import { apiGetClients, apiGetLeads, getTenantDbName } from '@/lib/api';
import { syncTenantCrmSnapshot } from '@/lib/tenant-behavior-engine';
import type { TenantCrmSnapshot } from '@/lib/tenant-behavior-engine';
import {
  analyzeClientDrawer,
  analyzeLeadDrawer,
  type DrawerAnalysisResult,
} from '@/lib/tenant-drawer-engine';
import {
  TENANT_INTELLIGENCE_UPDATED_EVENT,
  type TenantIntelligenceCache,
  type TenantIntelligenceSnapshot,
} from './types';

const CACHE_TTL_MS = 90_000;
let cache: TenantIntelligenceCache | null = null;
let cacheAt = 0;
let inflight: Promise<TenantIntelligenceCache | null> | null = null;

function unwrapList<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) return payload as T[];
  if (payload && typeof payload === 'object') {
    const root = payload as { data?: unknown };
    if (Array.isArray(root.data)) return root.data as T[];
    if (root.data && typeof root.data === 'object') {
      const nested = root.data as { data?: unknown };
      if (Array.isArray(nested.data)) return nested.data as T[];
    }
  }
  return [];
}

function buildSnapshot(
  leadAnalyses: DrawerAnalysisResult[],
  clientAnalyses: DrawerAnalysisResult[],
): TenantIntelligenceSnapshot {
  const overdueMeetings = [
    ...leadAnalyses.flatMap((a) => a.overdueMeetings),
    ...clientAnalyses.flatMap((a) => a.overdueMeetings),
  ].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());

  const incompleteLeads = leadAnalyses.filter((a) => a.missingFields.length > 0);
  const incompleteClients = clientAnalyses.filter((a) => a.missingFields.length > 0);

  return {
    scannedAt: new Date().toISOString(),
    leadCount: leadAnalyses.length,
    clientCount: clientAnalyses.length,
    overdueFollowUps: overdueMeetings.filter((m) => m.kind === 'followup').length,
    overdueMeetings: overdueMeetings.filter((m) => m.kind === 'meeting').length,
    incompleteLeads: incompleteLeads.length,
    incompleteClients: incompleteClients.length,
    topOverdue: overdueMeetings.slice(0, 12),
    incompleteLeadIds: incompleteLeads.map((a) => a.entityId),
    incompleteClientIds: incompleteClients.map((a) => a.entityId),
    sampleIncomplete: [...incompleteLeads, ...incompleteClients].slice(0, 8).map((a) => ({
      entityKind: a.entityKind,
      entityId: a.entityId,
      entityName: a.entityName,
      missingLabels: a.missingFields.map((f) => f.label),
    })),
  };
}

function publish(cacheValue: TenantIntelligenceCache) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent(TENANT_INTELLIGENCE_UPDATED_EVENT, { detail: cacheValue.snapshot }),
  );
}

/** Merge drawer-engine signals into the behavior CRM snapshot for HQ + live dashboards. */
export function mergeIntelligenceIntoCrmSnapshot(
  base: Omit<TenantCrmSnapshot, 'updatedAt'> | TenantCrmSnapshot | null | undefined,
  intelligence: TenantIntelligenceSnapshot | null | undefined,
): Omit<TenantCrmSnapshot, 'updatedAt'> {
  return {
    ...(base || {}),
    overdueFollowUps: intelligence?.overdueFollowUps ?? (base as TenantCrmSnapshot | undefined)?.overdueFollowUps ?? 0,
    overdueMeetings: intelligence?.overdueMeetings ?? (base as TenantCrmSnapshot | undefined)?.overdueMeetings ?? 0,
    incompleteLeads: intelligence?.incompleteLeads ?? (base as TenantCrmSnapshot | undefined)?.incompleteLeads ?? 0,
    incompleteClients:
      intelligence?.incompleteClients ?? (base as TenantCrmSnapshot | undefined)?.incompleteClients ?? 0,
    drawerEngineScannedAt: intelligence?.scannedAt ?? (base as TenantCrmSnapshot | undefined)?.drawerEngineScannedAt,
  };
}

/**
 * Shared Phase 2 intelligence refresh:
 * drawer completeness + overdue meetings → behavior CRM snapshot.
 */
export async function refreshTenantIntelligence(options?: {
  force?: boolean;
  userId?: string | null;
  tenantDbName?: string | null;
  baseCrm?: Omit<TenantCrmSnapshot, 'updatedAt'> | null;
}): Promise<TenantIntelligenceCache | null> {
  const now = Date.now();
  if (!options?.force && cache && now - cacheAt < CACHE_TTL_MS) {
    return cache;
  }
  if (inflight) return inflight;

  inflight = (async () => {
    try {
      const [leadsRes, clientsRes] = await Promise.all([
        apiGetLeads({ limit: 100, page: 1 }),
        apiGetClients({ limit: 100, page: 1 }),
      ]);

      const leads = unwrapList<Record<string, unknown>>(leadsRes?.data ?? leadsRes);
      const clients = unwrapList<Record<string, unknown>>(clientsRes?.data ?? clientsRes);

      const leadAnalyses = leads
        .map((lead) => analyzeLeadDrawer(lead))
        .filter((a): a is DrawerAnalysisResult => Boolean(a));
      const clientAnalyses = clients
        .map((client) => analyzeClientDrawer(client))
        .filter((a): a is DrawerAnalysisResult => Boolean(a));

      const snapshot = buildSnapshot(leadAnalyses, clientAnalyses);
      cache = { snapshot, leadAnalyses, clientAnalyses };
      cacheAt = Date.now();

      const tenantDbName = options?.tenantDbName || getTenantDbName();
      const userId = options?.userId;
      if (tenantDbName && userId) {
        const merged = mergeIntelligenceIntoCrmSnapshot(options?.baseCrm || null, snapshot);
        syncTenantCrmSnapshot(tenantDbName, userId, merged);
      }

      publish(cache);
      return cache;
    } catch {
      return cache;
    } finally {
      inflight = null;
    }
  })();

  return inflight;
}

export function getCachedTenantIntelligence(): TenantIntelligenceCache | null {
  if (!cache) return null;
  if (Date.now() - cacheAt > CACHE_TTL_MS * 2) return null;
  return cache;
}

export { trackDrawerIntelligenceEvent } from '@/lib/tenant-drawer-engine/track';
