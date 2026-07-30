'use client';

import { useEffect, useRef } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { apiFetch, getTenantDbName } from '@/lib/api';
import { useUser } from '@/hooks/useUser';
import {
  buildTenantBehaviorPayload,
  postTenantBehaviorPayload,
  ensureTenantActivitySession,
  recordTenantActiveTime,
  recordTenantPageVisit,
  endTenantActivitySession,
  syncTenantCrmSnapshot,
  TENANT_BEHAVIOR_SYNC_EVENT,
  trackTenantPathEntity,
} from '@/lib/tenant-behavior-engine';

const HEARTBEAT_MS = 15_000;
const CRM_SYNC_MS = 180_000;

const PUBLIC_PREFIXES = ['/login', '/hq/login', '/forgot-password', '/reset-password', '/apply', '/client-review'];

function isPublicPath(path: string) {
  const p = (path || '/').toLowerCase();
  return PUBLIC_PREFIXES.some((prefix) => p.startsWith(prefix));
}

/**
 * Intelligent Phase 2 CRM behaviour tracker:
 * sessions, navigation, entity views, clicks, API mutations, workflow journey, CRM context.
 */
export function TenantBehaviorTrackerHost() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user, loading } = useUser();
  const userId = user?.id || null;
  const tenantDbName = getTenantDbName();
  const lastPathRef = useRef<string | null>(null);
  const lastSearchRef = useRef<string | null>(null);
  const userName =
    [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim() ||
    user?.name ||
    user?.email ||
    undefined;

  const search = searchParams?.toString() ? `?${searchParams.toString()}` : '';

  useEffect(() => {
    if (loading || !userId || !tenantDbName) return;
    if (isPublicPath(pathname || '/')) return;

    const path = pathname || '/';
    const full = `${path}${search}`;
    ensureTenantActivitySession(tenantDbName, userId, { path, userName });

    if (lastPathRef.current !== path || lastSearchRef.current !== search) {
      recordTenantPageVisit(tenantDbName, userId, path, search);
      trackTenantPathEntity(path, search);
      lastPathRef.current = path;
      lastSearchRef.current = search;
    }
  }, [loading, userId, tenantDbName, pathname, search, userName]);

  useEffect(() => {
    if (loading || !userId || !tenantDbName || isPublicPath(pathname || '/')) return;

    const onVis = () => {
      if (document.visibilityState !== 'visible') return;
      ensureTenantActivitySession(tenantDbName, userId, { path: pathname || '/', userName });
    };
    document.addEventListener('visibilitychange', onVis);

    const timer = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      recordTenantActiveTime(tenantDbName, userId, HEARTBEAT_MS, pathname || '/');
    }, HEARTBEAT_MS);

    const onUnload = () => endTenantActivitySession(tenantDbName, userId);
    window.addEventListener('pagehide', onUnload);

    return () => {
      document.removeEventListener('visibilitychange', onVis);
      window.clearInterval(timer);
      window.removeEventListener('pagehide', onUnload);
    };
  }, [loading, userId, tenantDbName, pathname, userName]);

  // Global click capture for entity rows/cards with data-track attributes
  useEffect(() => {
    if (loading || !userId || !tenantDbName) return;

    const onClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      const el = target.closest('[data-behavior-entity]') as HTMLElement | null;
      if (!el) return;
      const entityType = el.getAttribute('data-behavior-entity') || '';
      const entityId = el.getAttribute('data-behavior-id') || undefined;
      const entityLabel = el.getAttribute('data-behavior-label') || undefined;
      const category = (el.getAttribute('data-behavior-category') || 'other') as import('@/lib/tenant-behavior-engine').TenantActivityCategory;
      if (!entityType) return;
      import('@/lib/tenant-behavior-engine').then(({ trackTenantEntityClick }) => {
        trackTenantEntityClick({
          entityType,
          entityId,
          entityLabel,
          category,
          pathname: pathname || '/',
        });
      });
    };

    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [loading, userId, tenantDbName, pathname]);

  // Sync live CRM workload context for intelligent triggers
  useEffect(() => {
    if (loading || !userId || !tenantDbName) return;
    let cancelled = false;

    const syncCrm = async () => {
      try {
        const res = await apiFetch<{
          openJobs?: number;
          openCandidates?: number;
          openLeads?: number;
          openClients?: number;
          pendingInterviews?: number;
          openPlacements?: number;
          pendingTasks?: number;
        }>('/tenant-behavior/crm-context', { auth: true });
        if (cancelled || !res.data) return;
        syncTenantCrmSnapshot(tenantDbName, userId, res.data);
      } catch {
        /* best-effort */
      }
    };

    void syncCrm();
    const onBehave = (pathname || '').startsWith('/thebehave');
    const timer = window.setInterval(syncCrm, onBehave ? 45_000 : CRM_SYNC_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [loading, userId, tenantDbName, pathname]);

  useEffect(() => {
    if (loading || !userId || !tenantDbName) return;
    const onBehavePage = (pathname || '').startsWith('/thebehave');
    const debounceMs = onBehavePage ? 400 : 900;
    let timer: number | undefined;

    const flush = () => {
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        const payload = buildTenantBehaviorPayload(tenantDbName, userId, userName);
        if (!payload) return;
        void postTenantBehaviorPayload(payload);
      }, debounceMs);
    };

    const onBehavior = () => flush();
    window.addEventListener(TENANT_BEHAVIOR_SYNC_EVENT, onBehavior as EventListener);
    flush();

    const interval = window.setInterval(flush, onBehavePage ? 12_000 : 25_000);

    return () => {
      if (timer) window.clearTimeout(timer);
      window.clearInterval(interval);
      window.removeEventListener(TENANT_BEHAVIOR_SYNC_EVENT, onBehavior as EventListener);
    };
  }, [loading, userId, tenantDbName, userName, pathname]);

  return null;
}
