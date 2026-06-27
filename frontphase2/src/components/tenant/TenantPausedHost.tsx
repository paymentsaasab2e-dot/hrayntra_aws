'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  getAccessToken,
  getCachedTenantPaused,
  ORG_RECRUITMENT_CACHE_EVENT,
  syncOrgRecruitmentSummaryFromApi,
} from '@/lib/api';
import { TenantPausedModal } from './TenantPausedModal';

/** Blocks Phase 2 UI when HQ has paused the active tenant workspace. */
export function TenantPausedHost() {
  const [paused, setPaused] = useState(false);
  const [pausedAt, setPausedAt] = useState<string | null>(null);

  const syncPauseState = useCallback(() => {
    if (typeof window === 'undefined' || !getAccessToken()) {
      setPaused(false);
      setPausedAt(null);
      return;
    }
    const snapshot = getCachedTenantPaused();
    setPaused(Boolean(snapshot.paused));
    setPausedAt(snapshot.pausedAt);
  }, []);

  useEffect(() => {
    syncPauseState();
    const onCache = () => syncPauseState();
    window.addEventListener(ORG_RECRUITMENT_CACHE_EVENT, onCache);
    return () => window.removeEventListener(ORG_RECRUITMENT_CACHE_EVENT, onCache);
  }, [syncPauseState]);

  useEffect(() => {
    if (!getAccessToken()) return undefined;
    void syncOrgRecruitmentSummaryFromApi().then(() => syncPauseState());
    const interval = window.setInterval(() => {
      void syncOrgRecruitmentSummaryFromApi().then(() => syncPauseState());
    }, 30000);
    const onFocus = () => {
      void syncOrgRecruitmentSummaryFromApi().then(() => syncPauseState());
    };
    window.addEventListener('focus', onFocus);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', onFocus);
    };
  }, [syncPauseState]);

  return <TenantPausedModal open={paused} pausedAt={pausedAt} />;
}
