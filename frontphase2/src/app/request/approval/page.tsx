'use client';

import React, { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Building2, ClipboardList, ShieldCheck, UserCheck } from 'lucide-react';
import { Toaster } from 'sonner';
import {
  UnifiedApprovalsPanel,
  type ApprovalKindFilter,
} from '../../../components/team/UnifiedApprovalsPanel';
import {
  CROSS_DEPT_REQUESTS_UPDATED_EVENT,
  LEAD_CONVERSION_REQUESTS_UPDATED_EVENT,
  TEAM_REQUESTS_UPDATED_EVENT,
  getCurrentUserRequestIdentity,
  getTeamRequestsForApproval,
  listCrossDeptRequests,
  listLeadConversionRequests,
} from '../../../lib/api/teamApi';
import { apiGetTasks, type BackendTask } from '../../../lib/api';

export const dynamic = 'force-dynamic';

type ApprovalTab = ApprovalKindFilter;

function extractTasks(responseData: unknown): BackendTask[] {
  if (!responseData) return [];
  if (Array.isArray(responseData)) return responseData as BackendTask[];
  const payload = responseData as { data?: unknown; items?: unknown };
  if (Array.isArray(payload.data)) return payload.data as BackendTask[];
  if (Array.isArray(payload.items)) return payload.items as BackendTask[];
  return [];
}

function ApprovalPageContent() {
  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab');
  const activeTab: ApprovalTab =
    tabParam === 'cross-dept'
      ? 'cross-dept'
      : tabParam === 'lead-conversion'
        ? 'lead-conversion'
        : tabParam === 'team'
          ? 'team'
          : tabParam === 'task-completion'
            ? 'task-completion'
            : 'all';

  const [pendingCounts, setPendingCounts] = useState({
    all: 0,
    team: 0,
    crossDept: 0,
    leadConversion: 0,
    taskCompletion: 0,
  });

  useEffect(() => {
    const loadPending = async () => {
      const user = getCurrentUserRequestIdentity();
      const userId = String(user.id || '').trim().toLowerCase();

      try {
        const [teamRes, crossDept, leads, tasksRes] = await Promise.all([
          getTeamRequestsForApproval({ currentUser: user }).catch(() => ({ data: [] })),
          listCrossDeptRequests('inbox').catch(() => []),
          listLeadConversionRequests('inbox').catch(() => []),
          apiGetTasks({ status: 'Awaiting Approval', limit: 200 }).catch(() => ({ data: [] })),
        ]);

        const teamPending = (Array.isArray(teamRes.data) ? teamRes.data : []).filter(
          (request) =>
            request.status === 'pending' &&
            (String(request.sendToId || '').toLowerCase() === userId ||
              String(request.sendToEmail || '').toLowerCase() ===
                String(user.email || '').toLowerCase()),
        ).length;

        const crossPending = crossDept.filter((r) => r.status === 'pending').length;
        const leadPending = leads.filter((r) => r.status === 'pending').length;
        const taskPending = extractTasks(tasksRes.data).filter(
          (task) =>
            task.status === 'AWAITING_APPROVAL' &&
            String(task.completionApproverId || '').toLowerCase() === userId,
        ).length;

        setPendingCounts({
          all: teamPending + crossPending + leadPending + taskPending,
          team: teamPending,
          crossDept: crossPending,
          leadConversion: leadPending,
          taskCompletion: taskPending,
        });
      } catch {
        setPendingCounts({
          all: 0,
          team: 0,
          crossDept: 0,
          leadConversion: 0,
          taskCompletion: 0,
        });
      }
    };

    void loadPending();
    const onUpdate = () => void loadPending();
    window.addEventListener(TEAM_REQUESTS_UPDATED_EVENT, onUpdate);
    window.addEventListener(CROSS_DEPT_REQUESTS_UPDATED_EVENT, onUpdate);
    window.addEventListener(LEAD_CONVERSION_REQUESTS_UPDATED_EVENT, onUpdate);
    window.addEventListener('focus', onUpdate);
    return () => {
      window.removeEventListener(TEAM_REQUESTS_UPDATED_EVENT, onUpdate);
      window.removeEventListener(CROSS_DEPT_REQUESTS_UPDATED_EVENT, onUpdate);
      window.removeEventListener(LEAD_CONVERSION_REQUESTS_UPDATED_EVENT, onUpdate);
      window.removeEventListener('focus', onUpdate);
    };
  }, []);

  const tabs = useMemo(
    () => [
      {
        id: 'all' as const,
        label:
          pendingCounts.all > 0 ? `All approvals (${pendingCounts.all})` : 'All approvals',
        href: '/request/approval',
        icon: ShieldCheck,
      },
      {
        id: 'team' as const,
        label: pendingCounts.team > 0 ? `Team requests (${pendingCounts.team})` : 'Team requests',
        href: '/request/approval?tab=team',
        icon: ShieldCheck,
      },
      {
        id: 'cross-dept' as const,
        label:
          pendingCounts.crossDept > 0
            ? `Cross-department (${pendingCounts.crossDept})`
            : 'Cross-department',
        href: '/request/approval?tab=cross-dept',
        icon: Building2,
      },
      {
        id: 'lead-conversion' as const,
        label:
          pendingCounts.leadConversion > 0
            ? `Lead conversions (${pendingCounts.leadConversion})`
            : 'Lead conversions',
        href: '/request/approval?tab=lead-conversion',
        icon: UserCheck,
      },
      {
        id: 'task-completion' as const,
        label:
          pendingCounts.taskCompletion > 0
            ? `Task completion (${pendingCounts.taskCompletion})`
            : 'Task completion',
        href: '/request/approval?tab=task-completion',
        icon: ClipboardList,
      },
    ],
    [pendingCounts],
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
                  One inbox for every approval sent to you on the platform.
                </p>
              </div>
            </div>
            {pendingCounts.all > 0 ? (
              <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800 ring-1 ring-amber-200/80">
                {pendingCounts.all} pending
              </span>
            ) : null}
          </header>

          <div className="border-b border-slate-200 bg-white px-4 sm:px-6">
            <div className="mx-auto flex max-w-[1600px] flex-wrap gap-1 py-2">
              {tabs.map((tab) => {
                const isActive = activeTab === tab.id;
                const Icon = tab.icon;
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
                    <Icon className="h-4 w-4" />
                    {tab.label}
                  </Link>
                );
              })}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-3 py-4 sm:px-5 sm:py-6 lg:px-6">
            <div className="mx-auto max-w-[1600px]">
              <UnifiedApprovalsPanel kindFilter={activeTab} />
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
