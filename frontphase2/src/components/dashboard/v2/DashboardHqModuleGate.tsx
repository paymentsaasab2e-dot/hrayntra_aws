'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  isOrgModuleEnabled,
  isOrgModulesRestricted,
  ORG_RECRUITMENT_CACHE_EVENT,
} from '@/lib/api';

/**
 * Free Jobs / HQ-restricted tenants do not get CRM Dashboard.
 * Prefer Recruitment Dashboard (/recruitment), then Jobs / Candidates.
 */
export function DashboardHqModuleGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    setReady(true);
  }, []);

  useEffect(() => {
    const bump = () => setTick((n) => n + 1);
    window.addEventListener(ORG_RECRUITMENT_CACHE_EVENT, bump);
    window.addEventListener('storage', bump);
    return () => {
      window.removeEventListener(ORG_RECRUITMENT_CACHE_EVENT, bump);
      window.removeEventListener('storage', bump);
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    void tick;
    if (!isOrgModulesRestricted()) return;
    if (isOrgModuleEnabled('crm_dashboard')) return;
    if (isOrgModuleEnabled('command_center')) {
      router.replace('/recruitment');
      return;
    }
    if (isOrgModuleEnabled('jobs')) {
      router.replace('/job');
      return;
    }
    if (isOrgModuleEnabled('candidates')) {
      router.replace('/candidate');
    }
  }, [ready, router, tick]);

  if (!ready) {
    return (
      <div
        className="min-h-[50vh] w-full animate-pulse rounded-xl border border-slate-200/80 bg-white/90"
        aria-busy="true"
        aria-label="Loading"
      />
    );
  }

  if (isOrgModulesRestricted() && !isOrgModuleEnabled('crm_dashboard')) {
    return (
      <div
        className="min-h-[50vh] w-full animate-pulse rounded-xl border border-slate-200/80 bg-white/90"
        aria-busy="true"
        aria-label="Redirecting"
      />
    );
  }

  return <>{children}</>;
}
