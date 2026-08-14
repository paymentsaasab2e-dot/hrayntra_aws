'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Building2, ClipboardList, ShieldCheck, UserCheck } from 'lucide-react';
import {
  UnifiedApprovalsPanel,
  type ApprovalKindFilter,
} from './UnifiedApprovalsPanel';
import {
  CROSS_DEPT_REQUESTS_UPDATED_EVENT,
  LEAD_CONVERSION_REQUESTS_UPDATED_EVENT,
  TEAM_REQUESTS_UPDATED_EVENT,
  getCurrentUserRequestIdentity,
  getTeamRequestsForApproval,
  listCrossDeptRequests,
  listLeadConversionRequests,
} from '../../lib/api/teamApi';
import { apiGetTasks, type BackendTask } from '../../lib/api';

type ApprovalTab = ApprovalKindFilter;

function extractTasks(responseData: unknown): BackendTask[] {
  if (!responseData) return [];
  if (Array.isArray(responseData)) return responseData as BackendTask[];
  const payload = responseData as { data?: unknown; items?: unknown };
  if (Array.isArray(payload.data)) return payload.data as BackendTask[];
  if (Array.isArray(payload.items)) return payload.items as BackendTask[];
  return [];
}

export function ApprovalsInbox() {
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
        label: pendingCounts.all > 0 ? `All (${pendingCounts.all})` : 'All',
        href: '/request?view=approvals',
        icon: ShieldCheck,
      },
      {
        id: 'team' as const,
        label: pendingCounts.team > 0 ? `Team (${pendingCounts.team})` : 'Team',
        href: '/request?view=approvals&tab=team',
        icon: ShieldCheck,
      },
      {
        id: 'cross-dept' as const,
        label:
          pendingCounts.crossDept > 0
            ? `Cross-dept (${pendingCounts.crossDept})`
            : 'Cross-dept',
        href: '/request?view=approvals&tab=cross-dept',
        icon: Building2,
      },
      {
        id: 'lead-conversion' as const,
        label:
          pendingCounts.leadConversion > 0
            ? `Conversions (${pendingCounts.leadConversion})`
            : 'Conversions',
        href: '/request?view=approvals&tab=lead-conversion',
        icon: UserCheck,
      },
      {
        id: 'task-completion' as const,
        label:
          pendingCounts.taskCompletion > 0
            ? `Tasks (${pendingCounts.taskCompletion})`
            : 'Tasks',
        href: '/request?view=approvals&tab=task-completion',
        icon: ClipboardList,
      },
    ],
    [pendingCounts],
  );

  return (
    <div className="space-y-4">
      {pendingCounts.all > 0 ? (
        <p className="text-[12px] font-semibold text-amber-800">
          {pendingCounts.all} pending in your inbox
        </p>
      ) : null}
      <div className="flex flex-wrap gap-1">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          const Icon = tab.icon;
          return (
            <Link
              key={tab.id}
              href={tab.href}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-semibold transition-colors ${
                isActive
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {tab.label}
            </Link>
          );
        })}
      </div>
      <UnifiedApprovalsPanel kindFilter={activeTab} />
    </div>
  );
}
