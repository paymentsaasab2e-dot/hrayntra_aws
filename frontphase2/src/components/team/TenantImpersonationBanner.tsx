'use client';

import { useEffect, useState } from 'react';
import { LogOut, UserRound } from 'lucide-react';
import {
  exitTenantImpersonation,
  getTenantImpersonationMeta,
  hasTenantImpersonationReturn,
  type TenantImpersonationMeta,
} from '@/lib/sessionAuth';

const BANNER_HEIGHT = '2.5rem';
const BANNER_VAR = '--ph2-impersonation-banner-h';

export function TenantImpersonationBanner() {
  const [meta, setMeta] = useState<TenantImpersonationMeta | null>(null);

  useEffect(() => {
    setMeta(getTenantImpersonationMeta());
  }, []);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (!meta) {
      document.documentElement.style.removeProperty(BANNER_VAR);
      return;
    }
    document.documentElement.style.setProperty(BANNER_VAR, BANNER_HEIGHT);
    return () => {
      document.documentElement.style.removeProperty(BANNER_VAR);
    };
  }, [meta]);

  if (!meta) return null;

  return (
    <div className="fixed inset-x-0 top-0 z-[80] flex h-10 items-center justify-between gap-2 border-b border-amber-200 bg-amber-50 px-4 text-xs text-amber-950 shadow-sm">
      <p className="flex min-w-0 items-center gap-2 truncate">
        <UserRound className="h-3.5 w-3.5 shrink-0 text-amber-700" />
        <span className="truncate">
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
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-amber-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-amber-900 hover:bg-amber-100"
        >
          <LogOut className="h-3.5 w-3.5" />
          Return to my account
        </button>
      ) : null}
    </div>
  );
}
