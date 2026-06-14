'use client';

import React, { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Building2, ShieldCheck, UserCheck } from 'lucide-react';
import { Toaster } from 'sonner';
import { RequestApprovalsPanel } from '../../../components/team/RequestApprovalsPanel';
import { CrossDepartmentApprovalsPanel } from '../../../components/team/CrossDepartmentApprovalsPanel';
import { LeadConversionApprovalsPanel } from '../../../components/team/LeadConversionApprovalsPanel';
import {
  LEAD_CONVERSION_REQUESTS_UPDATED_EVENT,
  listLeadConversionRequests,
} from '../../../lib/api/teamApi';

export const dynamic = 'force-dynamic';

type ApprovalTab = 'team' | 'cross-dept' | 'lead-conversion';

function ApprovalPageContent() {
  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab');
  const activeTab: ApprovalTab =
    tabParam === 'cross-dept'
      ? 'cross-dept'
      : tabParam === 'lead-conversion'
        ? 'lead-conversion'
        : 'team';
  const [pendingLeadConversions, setPendingLeadConversions] = useState(0);

  useEffect(() => {
    const loadPending = async () => {
      try {
        const data = await listLeadConversionRequests('inbox');
        setPendingLeadConversions(data.filter((r) => r.status === 'pending').length);
      } catch {
        setPendingLeadConversions(0);
      }
    };
    void loadPending();
    const onUpdate = () => void loadPending();
    window.addEventListener(LEAD_CONVERSION_REQUESTS_UPDATED_EVENT, onUpdate);
    return () => window.removeEventListener(LEAD_CONVERSION_REQUESTS_UPDATED_EVENT, onUpdate);
  }, []);

  const tabs = useMemo(
    () => [
      { id: 'team' as const, label: 'Team requests', href: '/request/approval?tab=team' },
      {
        id: 'lead-conversion' as const,
        label:
          pendingLeadConversions > 0
            ? `Lead conversions (${pendingLeadConversions})`
            : 'Lead conversions',
        href: '/request/approval?tab=lead-conversion',
      },
      { id: 'cross-dept' as const, label: 'Cross-department', href: '/request/approval?tab=cross-dept' },
    ],
    [pendingLeadConversions],
  );

  return (
    <>
      <Toaster position="top-right" richColors style={{ top: '5rem' }} />
      <div className="w-full min-h-screen overflow-hidden text-slate-900">
        <main className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
          <header className="flex min-h-[4.5rem] shrink-0 flex-wrap items-center justify-between gap-3 border-b border-indigo-100/50 bg-white/80 px-4 py-3 shadow-[inset_0_-1px_0_0_rgba(99,102,241,0.08)] backdrop-blur-md sm:px-6">
            <div className="flex items-center gap-2.5 sm:gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 via-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-500/30 ring-1 ring-white/20">
                <ShieldCheck className="h-5 w-5" strokeWidth={2.2} />
              </div>
              <div>
                <h1 className="text-xl font-bold leading-none tracking-tight text-slate-900 sm:text-[1.35rem]">
                  Approvals
                </h1>
                <p className="mt-1 text-xs text-slate-500">
                  Team requests, lead conversions, and cross-department work.
                </p>
              </div>
            </div>
          </header>

          <div className="border-b border-slate-200 bg-white px-4 sm:px-6">
            <div className="mx-auto flex max-w-[1600px] flex-wrap gap-1 py-2">
              {tabs.map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                  <Link
                    key={tab.id}
                    href={tab.href}
                    className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
                      isActive
                        ? 'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200/80'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    }`}
                  >
                    {tab.id === 'cross-dept' ? <Building2 className="h-4 w-4" /> : null}
                    {tab.id === 'lead-conversion' ? <UserCheck className="h-4 w-4" /> : null}
                    {tab.label}
                  </Link>
                );
              })}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-3 py-4 sm:px-5 sm:py-6 lg:px-6">
            <div className="mx-auto max-w-[1600px]">
              {activeTab === 'cross-dept' ? (
                <CrossDepartmentApprovalsPanel />
              ) : activeTab === 'lead-conversion' ? (
                <LeadConversionApprovalsPanel />
              ) : (
                <RequestApprovalsPanel />
              )}
            </div>
          </div>
        </main>
      </div>
    </>
  );
}

export default function RequestApprovalPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-slate-500">Loading…</div>}>
      <ApprovalPageContent />
    </Suspense>
  );
}
