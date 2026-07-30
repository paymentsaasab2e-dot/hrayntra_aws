'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  fetchTenantBehaviorLive,
  TENANT_BEHAVIOR_LIVE_UPDATED_EVENT,
  TENANT_BEHAVIOR_SYNC_EVENT,
  type TenantBehaviorLiveDashboard,
} from '@/lib/tenant-behavior-engine';

const DEFAULT_POLL_MS = 8_000;

export function useTenantBehaviorLive(pollMs = DEFAULT_POLL_MS) {
  const [data, setData] = useState<TenantBehaviorLiveDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const mountedRef = useRef(true);

  const refresh = useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true);
    setError(null);
    try {
      const live = await fetchTenantBehaviorLive();
      if (!mountedRef.current) return;
      setData(live);
      setLastUpdated(new Date());
    } catch (err) {
      if (!mountedRef.current) return;
      setError(err instanceof Error ? err.message : 'Failed to load live behaviour');
    } finally {
      if (mountedRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    void refresh(false);

    const onLocalSync = () => void refresh(true);
    window.addEventListener(TENANT_BEHAVIOR_SYNC_EVENT, onLocalSync as EventListener);
    window.addEventListener(TENANT_BEHAVIOR_LIVE_UPDATED_EVENT, onLocalSync as EventListener);

    const timer = window.setInterval(() => void refresh(true), pollMs);

    return () => {
      mountedRef.current = false;
      window.clearInterval(timer);
      window.removeEventListener(TENANT_BEHAVIOR_SYNC_EVENT, onLocalSync as EventListener);
      window.removeEventListener(TENANT_BEHAVIOR_LIVE_UPDATED_EVENT, onLocalSync as EventListener);
    };
  }, [pollMs, refresh]);

  return { data, loading, refreshing, error, lastUpdated, refresh };
}
