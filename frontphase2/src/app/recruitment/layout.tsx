'use client';

import { Sidenav } from '../../components/Sidenav';
import PermissionRouteGuard from '../../components/PermissionRouteGuard';
import { DashboardLayoutProvider } from '../../lib/dashboard/DashboardLayoutProvider';
import { MODULE_ACCESS_MAP } from '../../lib/rbac/moduleAccess';

/** Only dash_rec_* ticks — not view_dashboard / Jobs / Candidates. */
const RECRUITMENT_DASHBOARD_PERMS = MODULE_ACCESS_MAP.RecDashboard;

export default function RecruitmentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const avatarUrl =
    'https://images.unsplash.com/photo-1701463387028-3947648f1337?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwcm9mZXNzaW9uYWwlMjBidXNpbmVzcyUyMHBvcnRyYWl0JTIwYXZhdGFyfGVufDF8fHx8MTc3MDE4MTAyMHww&ixlib=rb-4.1.0&q=80&w=1080';

  return (
    <div className="min-h-screen bg-slate-50 font-['Arimo',sans-serif]">
      <Sidenav avatarUrl={avatarUrl}>
        <PermissionRouteGuard anyPermissions={RECRUITMENT_DASHBOARD_PERMS}>
          <DashboardLayoutProvider>{children}</DashboardLayoutProvider>
        </PermissionRouteGuard>
      </Sidenav>
    </div>
  );
}
