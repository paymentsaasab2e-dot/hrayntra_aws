'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { MessageSquarePlus, Plus, ShieldCheck } from 'lucide-react';
import { Toaster } from 'sonner';
import { RequestsTab } from '../../components/team/tabs/RequestsTab';
import { usePermissions } from '../../hooks/usePermissions';
import {
  LEAD_CONVERSION_REQUESTS_UPDATED_EVENT,
  listLeadConversionRequests,
} from '../../lib/api/teamApi';

export const dynamic = 'force-dynamic';

export default function RequestPage() {
  const { hasPermission } = usePermissions();
  const canCreateRequest = hasPermission('requests_create');
  const canReviewLeadConversions =
    hasPermission('leads_update') || hasPermission('requests_update') || hasPermission('clients_create');
  const [pendingLeadConversions, setPendingLeadConversions] = useState(0);

  useEffect(() => {
    if (!canReviewLeadConversions) return;
    const load = async () => {
      try {
        const data = await listLeadConversionRequests('inbox');
        setPendingLeadConversions(data.filter((r) => r.status === 'pending').length);
      } catch {
        setPendingLeadConversions(0);
      }
    };
    void load();
    const onUpdate = () => void load();
    window.addEventListener(LEAD_CONVERSION_REQUESTS_UPDATED_EVENT, onUpdate);
    return () => window.removeEventListener(LEAD_CONVERSION_REQUESTS_UPDATED_EVENT, onUpdate);
  }, [canReviewLeadConversions]);

  return (
    <>
      <Toaster position="top-right" richColors style={{ top: '5rem' }} />
      <div className="w-full min-h-screen overflow-hidden text-slate-900">
        <main className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
          <header className="flex min-h-[4.5rem] shrink-0 flex-wrap items-center justify-between gap-3 border-b border-indigo-100/50 bg-white/80 px-4 py-3 shadow-[inset_0_-1px_0_0_rgba(99,102,241,0.08)] backdrop-blur-md sm:px-6">
            <div className="flex items-center gap-2.5 sm:gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 via-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-500/30 ring-1 ring-white/20">
                <MessageSquarePlus className="h-5 w-5" strokeWidth={2.2} />
              </div>
              <div>
                <h1 className="text-xl font-bold leading-none tracking-tight text-slate-900 sm:text-[1.35rem]">
                  Request
                </h1>
                <p className="mt-1 text-xs text-slate-500">Send requests to department heads across all departments.</p>
              </div>
            </div>
            {canCreateRequest ? (
              <button
                type="button"
                onClick={() => window.dispatchEvent(new CustomEvent('request:open-request-drawer'))}
                className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 px-3.5 py-2 text-xs font-semibold text-white shadow-lg shadow-indigo-500/30 transition-all hover:from-blue-700 hover:via-indigo-700 hover:to-violet-700 active:scale-[0.98]"
              >
                <Plus size={16} className="text-white" strokeWidth={2.5} />
                <span>Send Request</span>
              </button>
            ) : null}
          </header>

          <div className="flex-1 overflow-y-auto px-3 py-4 sm:px-5 sm:py-6 lg:px-6">
            <div className="mx-auto max-w-[1600px] space-y-4">
              {canReviewLeadConversions && pendingLeadConversions > 0 ? (
                <Link
                  href="/request/approval?tab=lead-conversion"
                  className="flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 hover:bg-amber-100/80"
                >
                  <span className="inline-flex items-center gap-2 font-semibold">
                    <ShieldCheck className="h-4 w-4" />
                    {pendingLeadConversions} lead conversion
                    {pendingLeadConversions === 1 ? '' : 's'} waiting for your approval
                  </span>
                  <span className="text-xs font-bold text-amber-700">Open Approvals →</span>
                </Link>
              ) : null}
              <RequestsTab />
            </div>
          </div>
        </main>
      </div>
    </>
  );
}
