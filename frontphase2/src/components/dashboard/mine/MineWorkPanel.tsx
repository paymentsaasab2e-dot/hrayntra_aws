'use client';

import React from 'react';
import Link from 'next/link';
import { CheckSquare, Clock3, ShieldCheck } from 'lucide-react';
import type { DashboardMyWork, DashboardStatsAccess } from '@/lib/dashboard/api';
import { CrmDecisionInsights } from '@/components/dashboard/crm/CrmDecisionInsights';
import { RecDecisionInsights } from '@/components/dashboard/recruitment/RecDecisionInsights';
import type { CrmOverview, RecruitmentOverview } from '@/lib/dashboard/api';
import { useDashboardAccess } from '@/lib/dashboard/useDashboardAccess';

function formatNum(value: number | null | undefined) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n.toLocaleString() : '0';
}

function kindLabel(kind: string) {
  if (kind === 'team') return 'Team request';
  if (kind === 'cross-dept') return 'Cross-dept';
  if (kind === 'lead-conversion') return 'Lead conversion';
  if (kind === 'task-completion') return 'Task completion';
  return 'Approval';
}

export function DashScopeBanner({
  access,
  mineTab,
}: {
  access?: DashboardStatsAccess | null;
  mineTab?: boolean;
}) {
  if (mineTab) {
    return (
      <p className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-[12px] text-slate-600">
        <span className="font-semibold text-slate-800">My work</span>
        {' — '}
        your assigned records and tasks. Approvals waiting on you appear here when that bucket is on
        (Super Admin / Rank 1 by default, or the My work: approvals permission).
      </p>
    );
  }
  if (!access) return null;

  const level = access.dashboardLevel || (access.statsScope === 'self' ? 'self' : 'tenant');
  const label =
    access.scopeLabel ||
    (level === 'self'
      ? 'your assigned records'
      : level === 'department'
        ? access.departmentName
          ? `${access.departmentName} department`
          : 'your department'
        : level === 'company'
          ? 'this company'
          : 'all companies');

  if (level === 'self') {
    return (
      <p className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2 text-[12px] text-amber-900">
        Showing <span className="font-semibold">your jobs only</span>
        {' — '}
        numbers are limited to records assigned to you. Department Rank 1 sees the whole department;
        company heads see their company; Super Admin (or{' '}
        <span className="font-semibold">Dashboard level: Whole tenant</span> on a role) sees everything.
      </p>
    );
  }

  if (level === 'department') {
    return (
      <p className="rounded-xl border border-sky-200 bg-sky-50 px-3.5 py-2 text-[12px] text-sky-950">
        Showing <span className="font-semibold">{label}</span>
        {' — '}
        stats include everyone in your department. Open <span className="font-semibold">My work</span>{' '}
        for your own tasks and approvals.
      </p>
    );
  }

  if (level === 'company') {
    return (
      <p className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-[12px] text-slate-600">
        Showing <span className="font-semibold text-slate-800">{label}</span>
        {' — '}
        stats for this company / branch. Open <span className="font-semibold">My work</span> for your
        own tasks and approvals.
      </p>
    );
  }

  return (
    <p className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-[12px] text-slate-600">
      Showing <span className="font-semibold text-slate-800">{label}</span>
      {' — '}
      full tenant stats for the tabs on this dashboard. Open{' '}
      <span className="font-semibold">My work</span> for your own tasks and approvals.
    </p>
  );
}

function MyWorkKpis({
  myWork,
  showApprovals,
}: {
  myWork?: DashboardMyWork | null;
  showApprovals?: boolean;
}) {
  const pendingApprovals = Number(
    myWork?.pendingApprovalsTotal ??
      Number(myWork?.awaitingTaskApproval || 0) +
        Number(myWork?.pendingLeadConversions || 0) +
        Number(myWork?.pendingCrossDept || 0) +
        Number(myWork?.pendingTeamRequests || 0),
  );

  const cards = [
    {
      label: 'Open tasks',
      value: formatNum(myWork?.openTasks),
      href: '/Task&Activites',
      icon: CheckSquare,
      hint: `${formatNum(myWork?.overdueTasks)} overdue`,
    },
    {
      label: 'Overdue tasks',
      value: formatNum(myWork?.overdueTasks),
      href: '/Task&Activites',
      icon: Clock3,
      hint: 'Past due, still open',
    },
  ];

  if (showApprovals) {
    cards.push({
      label: 'Waiting on you',
      value: formatNum(pendingApprovals),
      href: '/request?view=approvals',
      icon: ShieldCheck,
      hint: `${formatNum(myWork?.pendingTeamRequests)} team · ${formatNum(myWork?.awaitingTaskApproval)} task · ${formatNum(myWork?.pendingLeadConversions)} conversion · ${formatNum(myWork?.pendingCrossDept)} cross-dept`,
    });
  }

  return (
    <div className={`grid grid-cols-1 gap-3 ${showApprovals ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <Link
            key={card.label}
            href={card.href}
            className="rounded-2xl border border-slate-100 bg-white px-4 py-3.5 transition hover:border-slate-200 hover:bg-slate-50"
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{card.label}</p>
              <Icon size={15} className="text-slate-400" />
            </div>
            <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">{card.value}</p>
            <p className="mt-0.5 text-[11px] text-slate-500">{card.hint}</p>
          </Link>
        );
      })}
    </div>
  );
}

function MyApprovalsList({ myWork }: { myWork?: DashboardMyWork | null }) {
  const items = myWork?.approvals || [];
  return (
    <div className="rounded-2xl border border-slate-100 bg-white px-4 py-3.5">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-slate-900">Approvals waiting on you</p>
        <Link href="/request?view=approvals" className="text-[12px] font-semibold text-blue-600 hover:text-blue-700">
          Open bucket
        </Link>
      </div>
      {items.length ? (
        <ul className="divide-y divide-slate-100">
          {items.map((item) => (
            <li key={`${item.kind}-${item.id}`}>
              <Link href={item.href} className="flex items-start justify-between gap-3 py-2.5 hover:bg-slate-50">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-800">{item.title}</p>
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    {kindLabel(item.kind)}
                    {item.from ? ` · ${item.from}` : ''}
                    {item.at
                      ? ` · ${new Date(item.at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}`
                      : ''}
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800 ring-1 ring-amber-200/80">
                  Act
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-6 text-center text-sm text-slate-500">
          Nothing waiting on you right now.
        </p>
      )}
    </div>
  );
}

export function CrmMineWorkPanel({
  overview,
  loading,
}: {
  overview: CrmOverview | null;
  loading?: boolean;
}) {
  const { showMineApprovals } = useDashboardAccess();
  return (
    <div className="space-y-4">
      <DashScopeBanner mineTab />
      <MyWorkKpis myWork={overview?.myWork} showApprovals={showMineApprovals} />
      {showMineApprovals ? <MyApprovalsList myWork={overview?.myWork} /> : null}
      <CrmDecisionInsights overview={overview} loading={loading} />
    </div>
  );
}

export function RecMineWorkPanel({
  overview,
  loading,
}: {
  overview: RecruitmentOverview | null;
  loading?: boolean;
}) {
  const { showMineApprovals } = useDashboardAccess();
  return (
    <div className="space-y-4">
      <DashScopeBanner mineTab />
      <MyWorkKpis myWork={overview?.myWork} showApprovals={showMineApprovals} />
      {showMineApprovals ? <MyApprovalsList myWork={overview?.myWork} /> : null}
      <RecDecisionInsights overview={overview} loading={loading} />
    </div>
  );
}
