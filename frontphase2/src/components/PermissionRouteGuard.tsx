'use client';

import React, { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { AccessDenied } from './AccessDenied';
import { usePermissions } from '../hooks/usePermissions';
import { isOrgModuleEnabled, ORG_RECRUITMENT_CACHE_EVENT } from '../lib/api';
import { getHqModuleIdForPath } from '../lib/tenantModuleCatalog';

interface PermissionRouteGuardProps {
  anyPermissions: string[];
  children: React.ReactNode;
  /** When set, shown instead of AccessDenied if the user lacks permissions. */
  fallback?: React.ReactNode;
  /**
   * HQ tenant module id (from tenantModuleCatalog).
   * When omitted, resolved from the current pathname.
   */
  hqModuleId?: string | null;
}

/** Neutral shell shown on server + first client paint (permissions live in localStorage). */
function PermissionGuardShell() {
  return (
    <div
      className="min-h-[50vh] w-full animate-pulse rounded-xl border border-slate-200/80 bg-white/90"
      aria-busy="true"
      aria-label="Loading"
    />
  );
}

export default function PermissionRouteGuard({
  anyPermissions,
  children,
  fallback,
  hqModuleId,
}: PermissionRouteGuardProps) {
  const [mounted, setMounted] = useState(false);
  const [modulesTick, setModulesTick] = useState(0);
  const pathname = usePathname();
  const { hasAnyPermission } = usePermissions();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const bump = () => setModulesTick((n) => n + 1);
    window.addEventListener(ORG_RECRUITMENT_CACHE_EVENT, bump);
    window.addEventListener('storage', bump);
    return () => {
      window.removeEventListener(ORG_RECRUITMENT_CACHE_EVENT, bump);
      window.removeEventListener('storage', bump);
    };
  }, []);

  if (!anyPermissions?.length && hqModuleId == null && !getHqModuleIdForPath(pathname)) {
    return <>{children}</>;
  }

  // Permissions / HQ modules are read from localStorage — must not branch during SSR.
  if (!mounted) {
    return <PermissionGuardShell />;
  }

  const resolvedModuleId = hqModuleId ?? getHqModuleIdForPath(pathname);
  // modulesTick forces re-check after HQ updates tenant tabs
  void modulesTick;
  if (resolvedModuleId && !isOrgModuleEnabled(resolvedModuleId)) {
    return fallback != null ? (
      <>{fallback}</>
    ) : (
      <AccessDenied
          title="This section isn’t available"
          message="It isn’t enabled for your organization."
        />
    );
  }

  if (anyPermissions?.length && !hasAnyPermission(anyPermissions)) {
    return fallback != null ? <>{fallback}</> : <AccessDenied />;
  }

  return <>{children}</>;
}
