'use client';

import { Suspense } from 'react';
import { HqSidebar, HQ_SIDEBAR_W } from './HqSidebar';

function HqSidebarFallback() {
  return (
    <aside
      className="h-full shrink-0 border-r border-white/[0.06] bg-[#071018]"
      style={{ width: HQ_SIDEBAR_W }}
    />
  );
}

/**
 * HQ shell — Phase 2–style main surface beside the HQ sidebar.
 * List pages use `.ph2-page-shell` so only the table card scrolls.
 */
export function HqShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-[100dvh] min-h-0 overflow-hidden bg-slate-50 text-slate-900">
      <Suspense fallback={<HqSidebarFallback />}>
        <HqSidebar />
      </Suspense>
      <div className="ph2-main-surface min-h-0 min-w-0 flex-1 overflow-y-auto">{children}</div>
    </div>
  );
}
