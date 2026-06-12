'use client';

import { Suspense } from 'react';
import { HqSidebar } from './HqSidebar';

function HqSidebarFallback() {
  return <aside className="w-[17.5rem] shrink-0 border-r border-slate-200 bg-white" />;
}

export function HqShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-[#f4f5f7] text-slate-900">
      <Suspense fallback={<HqSidebarFallback />}>
        <HqSidebar />
      </Suspense>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
