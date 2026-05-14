'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { isEmailAllowedForHq } from '../../lib/hqAccess';

export default function HqLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [allowed, setAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const token = window.localStorage.getItem('accessToken');
    if (!token) {
      router.replace(`/login?redirect=${encodeURIComponent('/hq')}`);
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
  }, [router]);

  if (allowed !== true) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4 text-center text-sm text-slate-400">
        Verifying headquarters access…
      </div>
    );
  }

  return <>{children}</>;
}
