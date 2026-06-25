'use client';

import React, { useCallback, useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { apiLogout, getAccessToken, ORG_RECRUITMENT_CACHE_EVENT } from '@/lib/api';
import {
  getCachedOrgSubscriptionPlan,
  isTrialExpired,
  persistTrialExpiredPlan,
  TRIAL_EXPIRED_URL_PARAM,
} from '@/lib/orgTrialPlan';

const LOGOUT_LOCK_KEY = 'trialExpiredLogoutInProgress';

/** When a trial workspace expires, sign the user out and send them to login with the purchase popup. */
export function TrialPlanHost() {
  const router = useRouter();
  const pathname = usePathname();
  const handlingRef = useRef(false);

  const handleExpiredTrial = useCallback(async () => {
    if (typeof window === 'undefined') return;
    if (handlingRef.current) return;
    if (sessionStorage.getItem(LOGOUT_LOCK_KEY) === '1') return;

    const token = getAccessToken();
    if (!token) return;

    const plan = getCachedOrgSubscriptionPlan();
    if (!isTrialExpired(plan)) return;

    // Already on login with popup param — avoid redirect loop.
    if (pathname === '/login' && window.location.search.includes(`${TRIAL_EXPIRED_URL_PARAM}=1`)) {
      return;
    }

    handlingRef.current = true;
    sessionStorage.setItem(LOGOUT_LOCK_KEY, '1');

    try {
      persistTrialExpiredPlan(plan);
      await apiLogout();
      localStorage.removeItem('orgSubscriptionPlan');
      localStorage.removeItem('orgSubscriptionPlanName');
      localStorage.removeItem('orgPlanUsage');
      router.replace(`/login?${TRIAL_EXPIRED_URL_PARAM}=1`);
    } finally {
      sessionStorage.removeItem(LOGOUT_LOCK_KEY);
      handlingRef.current = false;
    }
  }, [pathname, router]);

  useEffect(() => {
    void handleExpiredTrial();
    const onCache = () => {
      void handleExpiredTrial();
    };
    window.addEventListener(ORG_RECRUITMENT_CACHE_EVENT, onCache);
    return () => window.removeEventListener(ORG_RECRUITMENT_CACHE_EVENT, onCache);
  }, [handleExpiredTrial]);

  return null;
}
