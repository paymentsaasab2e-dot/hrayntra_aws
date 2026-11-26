'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiGetJobMetrics } from '../lib/api/jobs';
import { apiPeopleReportsHome } from '../lib/api/workforce';

type TodayAction = { label: string; href: string };

type TodayState = {
  jobs: number | null;
  applicants: number | null;
  leave: number | null;
  action: TodayAction;
};

const PUBLISH: TodayAction = { label: 'Publish a job', href: '/job' };

function pickAction(applicants: number, leave: number | null, payrollBlocks: number): TodayAction {
  if (leave != null && leave > 0) return { label: 'Approve leave', href: '/people/leave' };
  if (payrollBlocks > 0) return { label: 'Close the month', href: '/people/payroll' };
  if (applicants > 0) return { label: 'Review applicants', href: '/candidate' };
  return PUBLISH;
}

export function TodayStrip() {
  const [today, setToday] = useState<TodayState>({
    jobs: null,
    applicants: null,
    leave: null,
    action: PUBLISH,
  });

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [jobsRes, peopleRes] = await Promise.all([
        apiGetJobMetrics().catch(() => null),
        apiPeopleReportsHome().catch(() => null),
      ]);
      if (cancelled) return;
      const metrics = jobsRes?.data;
      const home = peopleRes?.data as { pendingLeave?: number; payrollExceptions?: number } | undefined;
      const jobs = metrics?.activeJobs ?? 0;
      const applicants = metrics?.appliedCandidates ?? 0;
      const leave = home ? Number(home.pendingLeave || 0) : null;
      const payrollBlocks = home ? Number(home.payrollExceptions || 0) : 0;
      setToday({
        jobs,
        applicants,
        leave,
        action: pickAction(applicants, leave, payrollBlocks),
      });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const show = (value: number | null) => (value == null ? '…' : String(value));

  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-slate-200/80 bg-white px-2.5 py-1 text-xs text-slate-700 shadow-sm">
      <span className="font-semibold text-[#101b35]">Today</span>
      <span className="rounded-full bg-slate-100 px-2 py-0.5">Jobs {show(today.jobs)}</span>
      <span className="rounded-full bg-slate-100 px-2 py-0.5">Applicants {show(today.applicants)}</span>
      <span className="rounded-full bg-slate-100 px-2 py-0.5">Leave waiting {show(today.leave)}</span>
      <Link
        href={today.action.href}
        className="ml-auto inline-flex h-7 items-center rounded-full bg-[#101b35] px-3 font-semibold text-white"
      >
        {today.action.label}
      </Link>
    </div>
  );
}
