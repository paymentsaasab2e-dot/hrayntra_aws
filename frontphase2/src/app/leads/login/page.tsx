'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getAccessToken } from '@/lib/api';

/**
 * Legacy broken try-free handoff landed on `/leads/login` (404).
 * Send authenticated users to the dashboard; others to real login.
 */
export default function LeadsLoginRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    if (getAccessToken()) {
      router.replace('/dashboard');
      return;
    }
    router.replace('/login?redirect=%2Fdashboard');
  }, [router]);

  return (
    <div className="flex min-h-[40vh] items-center justify-center text-sm text-slate-500">
      Redirecting…
    </div>
  );
}
