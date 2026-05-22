'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';

import { refreshLocalUserPermissions } from '../lib/api';

/**
 * Mounts once at the app root and keeps the local permission cache in sync
 * with what the admin configured server-side. We refresh:
 *  - on initial mount,
 *  - whenever the route changes (so navigating to a guarded page reflects the
 *    latest role assignment / permission edits without forcing a logout),
 *  - when the tab regains focus,
 *  - and on a slow heartbeat so long-lived sessions still pick up updates.
 *
 * The fetch is best-effort and silent: failures don't surface to the user
 * (e.g. the user is logged out, network hiccup, etc.).
 */
export function UserPermissionsSync() {
  const pathname = usePathname();
  const inFlightRef = useRef(false);
  const lastRunRef = useRef(0);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const MIN_INTERVAL_MS = 5_000; // throttle bursty triggers (focus + nav)

    const refresh = async () => {
      if (pathname === '/apply' || pathname?.startsWith('/apply/')) return;
      if (pathname === '/client-review' || pathname?.startsWith('/client-review/')) return;
      if (inFlightRef.current) return;
      const now = Date.now();
      if (now - lastRunRef.current < MIN_INTERVAL_MS) return;
      inFlightRef.current = true;
      lastRunRef.current = now;
      try {
        await refreshLocalUserPermissions();
      } finally {
        inFlightRef.current = false;
      }
    };

    void refresh();

    const onFocus = () => void refresh();
    const onVisibility = () => {
      if (document.visibilityState === 'visible') void refresh();
    };

    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);

    const interval = window.setInterval(() => {
      void refresh();
    }, 60_000);

    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
      window.clearInterval(interval);
    };
  }, [pathname]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!pathname) return;
    if (pathname === '/apply' || pathname.startsWith('/apply/')) return;
    if (pathname === '/client-review' || pathname.startsWith('/client-review/')) return;
    void refreshLocalUserPermissions();
  }, [pathname]);

  return null;
}
