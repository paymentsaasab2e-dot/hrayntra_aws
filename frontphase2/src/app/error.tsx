'use client';

import { useEffect } from 'react';
import { isStaleClientBundleError, reloadOnceForStaleBundle } from '@/lib/staleClientBundle';

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
    if (isStaleClientBundleError(error)) {
      reloadOnceForStaleBundle();
    }
  }, [error]);

  return (
    <div className="flex min-h-[70vh] items-center justify-center bg-[#F8FAFC] px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <p className="text-xs font-bold uppercase tracking-wider text-slate-400">HRYANTRA</p>
        <h1 className="mt-2 text-xl font-bold text-slate-900">This page couldn’t load</h1>
        <p className="mt-2 text-sm text-slate-500">
          Something went wrong in the employer workspace. You can retry this screen without signing in again.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => {
              if (isStaleClientBundleError(error) && reloadOnceForStaleBundle()) return;
              reset();
            }}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            Try again
          </button>
          <a
            href="/dashboard"
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Go to dashboard
          </a>
        </div>
      </div>
    </div>
  );
}
