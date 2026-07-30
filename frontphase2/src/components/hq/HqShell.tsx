'use client';

import { Suspense } from 'react';
import { HqSidebar, HQ_SIDEBAR_W } from './HqSidebar';

function HqSidebarFallback() {
  return (
    <aside
      className="h-full shrink-0 border-r border-white/[0.06] bg-[#0b1220]"
      style={{ width: HQ_SIDEBAR_W }}
    />
  );
}

export function HqShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-[100dvh] min-h-0 overflow-hidden bg-[#F8FAFC] text-slate-900">
      <Suspense fallback={<HqSidebarFallback />}>
        <HqSidebar />
      </Suspense>
      <div className="min-h-0 min-w-0 flex-1 overflow-auto">{children}</div>
    </div>
  );
}
