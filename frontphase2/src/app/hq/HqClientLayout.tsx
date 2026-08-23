'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { isEmailAllowedForHq } from '../../lib/hqAccess';
import { HqShell } from '../../components/hq/HqShell';
import {
  applyHqSessionAccess,
  canAccessHqNav,
  pickDefaultHqPath,
  resolveHqNavAccess,
  resolveHqNavIdFromLocation,
} from '../../lib/hqNavPermissions';
import { apiHqGetSessionAccess } from '../../lib/api';

export default function HqClientLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [allowed, setAllowed] = useState<boolean | null>(null);

  const isLoginRoute = pathname === '/hq/login';

  useEffect(() => {
    if (typeof window === 'undefined' || isLoginRoute) return;

    let cancelled = false;

    const verify = async () => {
      const token = window.localStorage.getItem('accessToken');
      if (!token) {
        router.replace('/hq/login');
        return;
      }

      let email = '';
      try {
        const raw = window.localStorage.getItem('currentUser');
        if (raw) {
          const u = JSON.parse(raw) as { email?: string };
          email = String(u?.email || '').trim();
        }
      } catch {
        /* ignore */
      }

      if (!isEmailAllowedForHq(email)) {
        router.replace('/dashboard');
        return;
      }

      let access = resolveHqNavAccess();
      if (access.isHqTeamMember) {
        try {
          const response = await apiHqGetSessionAccess();
          if (response.data?.isHqTeamMember) {
            applyHqSessionAccess({
              isHqTeamMember: true,
              hqTeamMemberId: response.data.hqTeamMemberId,
              hqPermissionIds: response.data.hqPermissionIds || [],
              loginId: response.data.loginId,
              email: response.data.email,
            });
            access = resolveHqNavAccess();
          }
        } catch {
          /* fall back to token/local permissions */
        }
      }

      if (access.mode === 'restricted') {
        const navId = resolveHqNavIdFromLocation(pathname, {
          tab: searchParams.get('tab'),
          view: searchParams.get('view'),
          audience: searchParams.get('audience'),
        });
        if (navId && !canAccessHqNav(navId, access)) {
          router.replace(pickDefaultHqPath(access));
          return;
        }
        if (!navId && pathname === '/hq') {
          router.replace(pickDefaultHqPath(access));
          return;
        }
      }

      if (!cancelled) setAllowed(true);
    };

    void verify();
    return () => {
      cancelled = true;
    };
  }, [router, isLoginRoute, pathname, searchParams]);

  if (isLoginRoute) {
    return <>{children}</>;
  }

  if (allowed !== true) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f4f5f7] px-4 text-center text-sm text-slate-500">
        Verifying headquarters access…
      </div>
    );
  }

  return <HqShell>{children}</HqShell>;
}
