'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { getTenantDbName } from '@/lib/api';
import { useUser } from '@/hooks/useUser';
import {
  alertTenantOverdueScan,
  type TenantOverdueScanResult,
} from '@/lib/tenant-drawer-engine';
import {
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
  const p = (path || '/').toLowerCase();
  return PUBLIC_PREFIXES.some((prefix) => p === prefix || p.startsWith(`${prefix}/`));
}

/**
 * Drawer-engine host, powered by shared Phase 2 intelligence.
 * Uses the same scan/cache as the behavior engine so they stay in sync.
 */
export function TenantDrawerAnalysisHost() {
  const pathname = usePathname();
  const { user, loading } = useUser();
  const ranRef = useRef(false);

  useEffect(() => {
    if (loading || !user?.id) return;
    if (isPublicPath(pathname || '/')) return;
    if (ranRef.current) return;
    ranRef.current = true;

    const tenantKey = getTenantDbName() || user.id;
    let cancelled = false;

    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const cache =
            getCachedTenantIntelligence() ||
            (await refreshTenantIntelligence({
              userId: user.id,
              tenantDbName: getTenantDbName(),
            }));
          if (cancelled || !cache) return;

          const scan: TenantOverdueScanResult = {
            overdueMeetings: cache.snapshot.topOverdue,
            scannedAt: cache.snapshot.scannedAt,
          };
          if (!scan.overdueMeetings.length && !cache.snapshot.incompleteLeads) return;

          // Prefer overdue popup; if only incomplete, still nudge once via overdue path when any overdue exist
          if (!scan.overdueMeetings.length) return;

          const review = await alertTenantOverdueScan(scan, tenantKey);
          if (review && typeof window !== 'undefined') {
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
  }, [loading, user?.id, pathname]);

  return null;
}
