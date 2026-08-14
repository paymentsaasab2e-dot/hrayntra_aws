'use client';

import React, { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { MessageSquarePlus, Plus, ShieldCheck } from 'lucide-react';
import { Toaster } from 'sonner';
import { RequestsTab } from '../../components/team/tabs/RequestsTab';
import { ApprovalsInbox } from '../../components/team/ApprovalsInbox';
import { usePermissions } from '../../hooks/usePermissions';
import { dashTextFont } from '../../lib/dashTypeFonts';

export const dynamic = 'force-dynamic';

type HubView = 'requests' | 'approvals';

function RequestHubInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { hasPermission } = usePermissions();
  const canCreateRequest = hasPermission('requests_create');
  const view: HubView = searchParams.get('view') === 'approvals' ? 'approvals' : 'requests';

  const setView = (next: HubView) => {
    const q = new URLSearchParams(searchParams.toString());
    if (next === 'approvals') q.set('view', 'approvals');
    else q.delete('view');
    if (next === 'requests') q.delete('tab');
    const qs = q.toString();
    router.replace(qs ? `/request?${qs}` : '/request');
  };

  return (
    <>
      <Toaster position="top-right" richColors style={{ top: '5rem' }} />
      <div className={`${dashTextFont} w-full min-h-screen overflow-hidden text-slate-900`}>
        <main className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
          <header className="flex min-h-[4.5rem] shrink-0 flex-wrap items-center justify-between gap-3 border-b border-slate-200/80 bg-white/80 px-4 py-3 backdrop-blur-md sm:px-6">
            <div className="flex min-w-0 flex-wrap items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white shadow-lg shadow-slate-900/20">
                {view === 'approvals' ? (
                  <ShieldCheck className="h-5 w-5" strokeWidth={2.2} />
                ) : (
                  <MessageSquarePlus className="h-5 w-5" strokeWidth={2.2} />
                )}
              </div>
              <div className="min-w-0">
                <h1 className="text-xl font-bold leading-none tracking-tight text-slate-900 sm:text-[1.35rem]">
                  Requests
                </h1>
                <p className="mt-1 text-xs text-slate-500">
                  {view === 'approvals'
                    ? 'Approvals waiting on you — team, conversions, tasks, and cross-dept.'
                    : 'Send requests to department heads across the organisation.'}
                </p>
              </div>
              <div
                role="tablist"
                aria-label="Requests or approvals"
                className="relative ml-1 grid h-10 w-[220px] shrink-0 grid-cols-2 rounded-full bg-slate-100 p-1 ring-1 ring-slate-200/90"
              >
                <span
                  aria-hidden
                  className={`absolute top-1 bottom-1 w-[calc(50%-4px)] rounded-full bg-slate-900 shadow-sm transition-all duration-200 ease-out ${
                    view === 'requests' ? 'left-1' : 'left-[calc(50%)]'
                  }`}
                />
                <button
                  type="button"
                  role="tab"
                  aria-selected={view === 'requests'}
                  onClick={() => setView('requests')}
                  className={`relative z-10 rounded-full text-[13px] font-semibold ${
                    view === 'requests' ? 'text-white' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  Request
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={view === 'approvals'}
                  onClick={() => setView('approvals')}
                  className={`relative z-10 rounded-full text-[13px] font-semibold ${
                    view === 'approvals' ? 'text-white' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  Approvals
                </button>
              </div>
            </div>
            {view === 'requests' && canCreateRequest ? (
              <button
                type="button"
                onClick={() => window.dispatchEvent(new CustomEvent('request:open-request-drawer'))}
                className="flex items-center gap-1.5 rounded-full bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white shadow-lg shadow-slate-900/20 transition hover:bg-slate-800 active:scale-[0.98]"
              >
                <Plus size={16} strokeWidth={2.5} />
                Send Request
              </button>
            ) : null}
          </header>

          <div className="flex-1 overflow-y-auto px-3 py-4 sm:px-5 sm:py-6 lg:px-6">
            <div className="mx-auto max-w-[1600px] space-y-4">
              {view === 'approvals' ? <ApprovalsInbox /> : <RequestsTab />}
            </div>
          </div>
        </main>
      </div>
    </>
  );
}

export default function RequestPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-slate-500">Loading…</div>}>
      <RequestHubInner />
    </Suspense>
  );
}
