'use client';

import { useEffect, useState } from 'react';
import { LogOut, UserRound } from 'lucide-react';
import {
  exitTenantImpersonation,
  getTenantImpersonationMeta,
  hasTenantImpersonationReturn,
  type TenantImpersonationMeta,
} from '@/lib/sessionAuth';

export function TenantImpersonationBanner() {
  const [meta, setMeta] = useState<TenantImpersonationMeta | null>(null);

  useEffect(() => {
    setMeta(getTenantImpersonationMeta());
  }, []);

  if (!meta) return null;

  return (
    <div className="sticky top-0 z-[80] flex flex-wrap items-center justify-between gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-950 shadow-sm">
      <p className="flex min-w-0 items-center gap-2">
        <UserRound className="h-4 w-4 shrink-0 text-amber-700" />
        <span>
          Viewing as <span className="font-semibold">{meta.memberName}</span>
          {meta.actorName ? (
            <span className="text-amber-800/80"> · Super Admin {meta.actorName} (they stay signed in)</span>
          ) : null}
        </span>
      </p>
      {hasTenantImpersonationReturn() ? (
        <button
          type="button"
          onClick={() => {
            if (exitTenantImpersonation()) {
              window.location.href = '/team';
            }
          }}
          className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-900 hover:bg-amber-100"
        >
          <LogOut className="h-3.5 w-3.5" />
          Return to my account
        </button>
      ) : null}
    </div>
  );
}
