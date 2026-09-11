'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { Sidenav } from '../../components/Sidenav';
import { AccessDenied } from '../../components/AccessDenied';
import { usePermissions } from '../../hooks/usePermissions';

export default function AccessLayout({ children }: { children: ReactNode }) {
  const { isSuperAdmin } = usePermissions();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="min-h-screen bg-slate-50 font-['Arimo',sans-serif]">
        <Sidenav>
          <div
            className="min-h-[50vh] w-full animate-pulse rounded-xl border border-slate-200/80 bg-white/90"
            aria-busy="true"
            aria-label="Loading"
          />
        </Sidenav>
      </div>
    );
  }

  if (!isSuperAdmin()) {
    return (
      <div className="min-h-screen bg-slate-50 font-['Arimo',sans-serif]">
        <Sidenav>
          <AccessDenied
            title="Super Admin only"
            message="HRyantra portal access is managed by the tenant Super Admin."
          />
        </Sidenav>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 font-['Arimo',sans-serif]">
      <Sidenav>{children}</Sidenav>
    </div>
  );
}
