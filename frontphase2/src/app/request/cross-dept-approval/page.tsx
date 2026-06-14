'use client';

import React, { Suspense } from 'react';
import Link from 'next/link';
import { ArrowLeft, Building2 } from 'lucide-react';
import { Toaster } from 'sonner';
import { CrossDepartmentApprovalsPanel } from '../../../components/team/CrossDepartmentApprovalsPanel';

export const dynamic = 'force-dynamic';

function CrossDeptApprovalContent() {
  return (
    <>
      <Toaster position="top-right" richColors style={{ top: '5rem' }} />
      <div className="w-full min-h-screen overflow-hidden text-slate-900">
        <main className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
          <header className="flex min-h-[4.5rem] shrink-0 flex-wrap items-center justify-between gap-3 border-b border-indigo-100/50 bg-white/80 px-4 py-3 shadow-[inset_0_-1px_0_0_rgba(99,102,241,0.08)] backdrop-blur-md sm:px-6">
            <div className="flex items-center gap-2.5 sm:gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 via-violet-600 to-purple-600 text-white shadow-lg shadow-indigo-500/30 ring-1 ring-white/20">
                <Building2 className="h-5 w-5" strokeWidth={2.2} />
              </div>
              <div>
                <h1 className="text-xl font-bold leading-none tracking-tight text-slate-900 sm:text-[1.35rem]">
                  Cross-department approvals
                </h1>
                <p className="mt-1 text-xs text-slate-500">
                  Accept or reject work requests sent from other departments.
                </p>
              </div>
            </div>
            <Link
              href="/request/approval"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              All approvals
            </Link>
          </header>

          <div className="flex-1 overflow-y-auto px-3 py-4 sm:px-5 sm:py-6 lg:px-6">
            <div className="mx-auto max-w-[1600px]">
              <CrossDepartmentApprovalsPanel />
            </div>
          </div>
        </main>
      </div>
    </>
  );
}

export default function CrossDeptApprovalPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-slate-500">Loading…</div>}>
      <CrossDeptApprovalContent />
    </Suspense>
  );
}
