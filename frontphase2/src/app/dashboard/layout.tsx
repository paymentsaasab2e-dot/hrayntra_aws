'use client';

import { Sidenav } from '../../components/Sidenav';
import PermissionRouteGuard from '../../components/PermissionRouteGuard';
import { DashboardLayoutProvider } from '../../lib/dashboard/DashboardLayoutProvider';
import { DashboardWelcomeFallback } from '../../components/dashboard/v2/DashboardWelcomeFallback';
import { ROUTE_PERMISSION_GUARDS } from '../../lib/rbac/moduleAccess';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const avatarUrl =
    'https://images.unsplash.com/photo-1701463387028-3947648f1337?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwcm9mZXNzaW9uYWwlMjBidXNpbmVzcyUyMHBlcnNvbiUyMHBvcnRyYWl0JTIwYXZhdGFyfGVufDF8fHx8MTc3MDE4MTAyMHww&ixlib=rb-4.1.0&q=80&w=1080';

  return (
    <div className="min-h-screen font-['Arimo',sans-serif]">
      <Sidenav avatarUrl={avatarUrl}>
        <PermissionRouteGuard
          anyPermissions={ROUTE_PERMISSION_GUARDS['/dashboard']}
          fallback={
            <div className="p-4 sm:p-6 lg:p-8">
              <DashboardWelcomeFallback
                title="Welcome"
                description="You do not have the main dashboard permission, but you can still open modules assigned to your role."
              />
            </div>
          }
        >
          <DashboardLayoutProvider>{children}</DashboardLayoutProvider>
        </PermissionRouteGuard>
      </Sidenav>
    </div>
  );
}
