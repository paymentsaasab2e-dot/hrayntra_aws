'use client';

import { Sidenav } from '../../components/Sidenav';
import { usePermissions } from '../../hooks/usePermissions';
import { dashTextFont } from '../../lib/dashTypeFonts';

export default function SubscriptionLayout({ children }: { children: React.ReactNode }) {
  const { isSuperAdmin, hasPermission } = usePermissions();
  const canManageSubscription = isSuperAdmin() || hasPermission('manage_subscription');

  return (
    <div className={`min-h-screen bg-slate-50 ${dashTextFont}`}>
      <Sidenav
        avatarUrl=""
        userProfile={{ name: '', role: '', avatarUrl: '' }}
      >
        {canManageSubscription ? (
          children
        ) : (
          <div className="p-10 text-center text-sm text-slate-500">
            Subscription tokens require Super Admin or the Manage subscription permission.
          </div>
        )}
      </Sidenav>
    </div>
  );
}
