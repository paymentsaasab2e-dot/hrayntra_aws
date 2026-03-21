'use client';

import React from 'react';
import { usePermissions } from '../hooks/usePermissions';
import { AccessDenied } from './AccessDenied';

interface PermissionGateProps {
  permission: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export const PermissionGate: React.FC<PermissionGateProps> = ({ permission, children, fallback }) => {
  const { hasPermission } = usePermissions();

  if (!hasPermission(permission)) {
    return fallback || <AccessDenied />;
  }

  return <>{children}</>;
};
