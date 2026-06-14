'use client';

import React, { useEffect, useState } from 'react';
import { AccessDenied } from './AccessDenied';
import { usePermissions } from '../hooks/usePermissions';

interface PermissionRouteGuardProps {
  anyPermissions: string[];
  children: React.ReactNode;
  /** When set, shown instead of AccessDenied if the user lacks permissions. */
  fallback?: React.ReactNode;
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

export default function PermissionRouteGuard({ anyPermissions, children, fallback }: PermissionRouteGuardProps) {
  const [mounted, setMounted] = useState(false);
  const { hasAnyPermission } = usePermissions();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!anyPermissions?.length) {
    return <>{children}</>;
  }

  // Permissions are read from localStorage — must not branch on them during SSR.
  if (!mounted) {
    return <PermissionGuardShell />;
  }

  if (!hasAnyPermission(anyPermissions)) {
    return fallback != null ? <>{fallback}</> : <AccessDenied />;
  }

  return <>{children}</>;
}
