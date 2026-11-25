'use client';

import { Sidenav } from '../../components/Sidenav';
import PermissionRouteGuard from '../../components/PermissionRouteGuard';

export default function CandidateSpeedLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50 font-['Arimo',sans-serif]">
      <Sidenav
        avatarUrl=""
        userProfile={{ name: 'Recruiter', role: 'Member', avatarUrl: '' }}
      >
        <PermissionRouteGuard
          anyPermissions={[
            'candidates_read',
            'view_all_candidates',
            'view_assigned_candidates',
            'manage_settings',
          ]}
        >
          {children}
        </PermissionRouteGuard>
      </Sidenav>
    </div>
  );
}
