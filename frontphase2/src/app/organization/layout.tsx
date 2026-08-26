'use client';

import type { ReactNode } from 'react';
import { Sidenav } from '../../components/Sidenav';
import PermissionRouteGuard from '../../components/PermissionRouteGuard';

export default function OrganizationLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50 font-['Arimo',sans-serif]">
      <Sidenav>
        <PermissionRouteGuard anyPermissions={['org_structure', 'node_org_structure', 'view_team']}>
          {children}
        </PermissionRouteGuard>
      </Sidenav>
    </div>
  );
}
