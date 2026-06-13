'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { isEmailAllowedForHq } from '../../lib/hqAccess';
import { HqShell } from '../../components/hq/HqShell';

export default function HqClientLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [allowed, setAllowed] = useState<boolean | null>(null);

  const isLoginRoute = pathname === '/hq/login';

  useEffect(() => {
    if (typeof window === 'undefined' || isLoginRoute) return;

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

    setAllowed(true);
  }, [router, isLoginRoute]);

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
