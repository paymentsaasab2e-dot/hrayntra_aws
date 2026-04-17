'use client';

import React from 'react';
import { AccessDenied } from './AccessDenied';
import { usePermissions } from '../hooks/usePermissions';

interface PermissionRouteGuardProps {
  anyPermissions: string[];
  children: React.ReactNode;
}

export default function PermissionRouteGuard({ anyPermissions, children }: PermissionRouteGuardProps) {
  const { hasAnyPermission } = usePermissions();

  if (!anyPermissions?.length) {
    return <>{children}</>;
  }

  if (!hasAnyPermission(anyPermissions)) {
    return <AccessDenied />;
  }

  return <>{children}</>;
}
