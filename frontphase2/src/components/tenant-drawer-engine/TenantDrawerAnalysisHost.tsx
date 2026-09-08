'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { getAccessToken, getTenantDbName } from '@/lib/api';
import { useUser } from '@/hooks/useUser';
import { isEmployerPublicAuthPath } from '@/lib/sessionAuth';
import { flushAppDialogs } from '@/lib/appDialog';
import {
  alertTenantOverdueScan,
  type TenantOverdueScanResult,
} from '@/lib/tenant-drawer-engine';
import {
  clearTenantIntelligenceCache,
  getCachedTenantIntelligence,
  refreshTenantIntelligence,
} from '@/lib/phase2-intelligence';

const PUBLIC_PREFIXES = [
  '/login',
  '/hq/login',
  '/forgot-password',
  '/reset-password',
  '/apply',
  '/client-review',
  '/hq',
];

function isPublicPath(path: string) {
  if (isEmployerPublicAuthPath(path)) return true;
  const p = (path || '/').toLowerCase();
  return PUBLIC_PREFIXES.some((prefix) => p === prefix || p.startsWith(`${prefix}/`));
}

/**
 * Drawer-engine host, powered by shared Phase 2 intelligence.
 * Uses the same scan/cache as the behavior engine so they stay in sync.
 * Scoped per tenant + user — never reuses another workspace's CRM alerts.
 */
export function TenantDrawerAnalysisHost() {
  const pathname = usePathname();
  const { user, loading } = useUser();
  const [tenantDbName, setTenantDbName] = useState(() => getTenantDbName());
  const ranForKeyRef = useRef<string | null>(null);

  useEffect(() => {
    const sync = () => setTenantDbName(getTenantDbName());
    window.addEventListener('hryantra:tenant-changed', sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener('hryantra:tenant-changed', sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  useEffect(() => {
    if (isPublicPath(pathname || '/')) {
      ranForKeyRef.current = null;
      return;
    }
    if (loading || !user?.id || !tenantDbName) return;
    if (!getAccessToken()) return;

    const scopeKey = `${tenantDbName}::${user.id}`;
    if (ranForKeyRef.current && ranForKeyRef.current !== scopeKey) {
      clearTenantIntelligenceCache();
      flushAppDialogs();
    }
    if (ranForKeyRef.current === scopeKey) return;
    ranForKeyRef.current = scopeKey;

    let cancelled = false;

    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          if (getTenantDbName() !== tenantDbName) return;

          const cache =
            getCachedTenantIntelligence(tenantDbName, user.id) ||
            (await refreshTenantIntelligence({
              userId: user.id,
              tenantDbName,
            }));
          if (cancelled || !cache) return;
          if (getTenantDbName() !== tenantDbName) return;

          const scan: TenantOverdueScanResult = {
            overdueMeetings: cache.snapshot.topOverdue,
            scannedAt: cache.snapshot.scannedAt,
          };
          if (!scan.overdueMeetings.length) return;

          const review = await alertTenantOverdueScan(scan, tenantDbName);
          if (review && typeof window !== 'undefined' && getTenantDbName() === tenantDbName) {
            const first = scan.overdueMeetings[0];
            window.location.href = first?.entityKind === 'client' ? '/client' : '/leads';
          }
        } catch {
          // Silent — must never break shell
        }
      })();
    }, 2800);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [loading, user?.id, tenantDbName, pathname]);

  return null;
}