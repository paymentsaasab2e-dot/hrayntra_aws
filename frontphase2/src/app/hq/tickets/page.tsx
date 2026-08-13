'use client';

import React, { useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { Ticket } from 'lucide-react';
import { HqModulePageLayout } from '@/components/hq/HqModulePageLayout';
import { HqCrmHelpTicketsPanel } from '@/components/hq/HqCrmHelpTicketsPanel';

function Panel({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-2xl border border-white/80 bg-white/75 p-4 shadow-[0_1px_0_rgba(255,255,255,0.85)_inset,0_18px_48px_-24px_rgba(15,23,42,0.16)] backdrop-blur-xl sm:p-5 ${className}`}
    >
      {children}
    </div>
  );
}

function PanelTitle({ title, right }: { title: string; right?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2">
        <span className="h-4 w-1 shrink-0 rounded-full bg-gradient-to-b from-blue-600 to-emerald-500" />
        <h3 className="truncate text-[13px] font-semibold tracking-tight text-slate-800">{title}</h3>
      </div>
      {right}
    </div>
  );
}

export default function HqTicketsPage() {
  const searchParams = useSearchParams();
  const audience = useMemo(() => {
    const raw = String(searchParams.get('audience') || 'employee').toLowerCase();
    return raw === 'employer' ? ('employer' as const) : ('employee' as const);
  }, [searchParams]);

  const isEmployer = audience === 'employer';

  return (
    <HqModulePageLayout
      title={isEmployer ? 'Employer tickets' : 'Employee tickets'}
      subtitle={
        isEmployer
          ? 'Tenant Help Center support queue for employer workspaces.'
          : 'Candidate portal /help support queue.'
      }
      icon={<Ticket className="h-5 w-5" />}
    >
      <HqCrmHelpTicketsPanel
        Panel={Panel}
        PanelTitle={PanelTitle}
        lockedAudience={audience}
      />
    </HqModulePageLayout>
  );
}
