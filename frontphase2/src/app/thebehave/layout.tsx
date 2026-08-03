'use client';

import { Sidenav } from '../../components/Sidenav';
import { PasswordResetGuard } from '../../components/PasswordResetGuard';
import PermissionRouteGuard from '../../components/PermissionRouteGuard';

const THEBEHAVE_PERMISSIONS = [
  'view_team_activity',
  'reports_read',
  'view_activity_log',
  'manage_settings',
  'view_dashboard',
];

export default function TheBehaveLayout({ children }: { children: React.ReactNode }) {
  const avatarUrl =
    'https://images.unsplash.com/photo-1701463387028-3947648f1337?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwcm9mZXNzaW9uYWwlMjBidXNpbmVzcyUyMHBlcnNvbiUyMHBvcnRyYWl0JTIwYXZhdGFyfGVufDF8fHx8MTc3MDE4MTAyMHww&ixlib=rb-4.1.0&q=80&w=1080';

  return (
    <PasswordResetGuard>
      <div className="min-h-screen bg-slate-50 font-['Arimo',sans-serif]">
        <Sidenav avatarUrl={avatarUrl}>
          <PermissionRouteGuard anyPermissions={THEBEHAVE_PERMISSIONS}>{children}</PermissionRouteGuard>
        </Sidenav>
      </div>
    </PasswordResetGuard>
  );
}
