'use client';

import React from 'react';
import { Briefcase, Calendar, Users } from 'lucide-react';
import type { InterviewJobSummary } from '../../lib/interview-job-overview';

type InterviewJobsTableProps = {
  jobs: InterviewJobSummary[];
  onSelectJob: (jobId: string) => void;
};

export function InterviewJobsTable({ jobs, onSelectJob }: InterviewJobsTableProps) {
  if (jobs.length === 0) {
    return (
      <div className="px-4 py-14 text-center">
        <p className="text-sm font-semibold text-slate-800">No jobs currently under interview</p>
        <p className="mt-1 text-xs text-slate-500">Schedule an interview to see the job listed here.</p>
      </div>
    );
  }

  return (
    <table className="min-w-full border-collapse text-left text-sm">
      <thead className="sticky top-0 z-10">
        <tr className="border-b border-indigo-100/50 bg-gradient-to-r from-slate-50/95 via-indigo-50/50 to-violet-50/40 text-[9px] font-bold uppercase tracking-[0.12em] text-indigo-950/45 backdrop-blur-sm">
          <th className="px-3 py-2 first:pl-4 sm:px-4">Job</th>
          <th className="px-3 py-2 sm:px-4">Client</th>
          <th className="px-3 py-2 sm:px-4">Candidates</th>
          <th className="px-3 py-2 sm:px-4">Rounds</th>
          <th className="px-3 py-2 sm:px-4">Next interview</th>
          <th className="px-3 py-2 sm:px-4">Status</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100/80">
        {jobs.map((job) => (
          <tr
            key={job.jobId}
            className="cursor-pointer align-top transition-colors duration-200 even:bg-slate-50/35 hover:bg-indigo-50/45"
            onClick={() => onSelectJob(job.jobId)}
          >
            <td className="px-3 py-2.5 first:pl-4 sm:px-4">
              <div className="flex items-center gap-2.5">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700">
                  <Briefcase className="size-4" />
                </div>
                <div className="min-w-0">
                  <div className="truncate text-[13px] font-semibold text-[#111827]">{job.jobTitle}</div>
                  <div className="text-[11px] text-[#6B7280]">
                    {job.interviewCount} interview{job.interviewCount === 1 ? '' : 's'}
                  </div>
                </div>
              </div>
            </td>
            <td className="max-w-[12rem] px-3 py-2.5 sm:px-4">
              <div className="truncate text-[12px] font-medium text-[#111827]">{job.clientName}</div>
            </td>
            <td className="px-3 py-2.5 sm:px-4">
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                <Users className="size-3" />
                {job.candidateCount}
              </span>
            </td>
            <td className="px-3 py-2.5 sm:px-4">
              <div className="flex flex-wrap gap-1">
                {job.rounds.map((round) => (
                  <span
                    key={round}
                    className="inline-flex rounded-md bg-[#EFF6FF] px-2 py-0.5 text-[11px] font-bold tracking-wide text-[#1D4ED8]"
                  >
                    R{round}
                  </span>
                ))}
              </div>
            </td>
            <td className="px-3 py-2.5 sm:px-4">
              {job.nextInterview ? (
                <div className="flex items-center gap-1.5 text-[12px] text-slate-700">
                  <Calendar className="size-3.5 shrink-0 text-indigo-500" />
                  <span>
                    {job.nextInterview.date} · {job.nextInterview.time}
                  </span>
                </div>
              ) : (
                <span className="text-[12px] text-slate-400">No upcoming</span>
              )}
            </td>
            <td className="px-3 py-2.5 sm:px-4">
              <div className="flex flex-wrap gap-1">
                {job.scheduledCount > 0 ? (
                  <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700">
                    {job.scheduledCount} scheduled
                  </span>
                ) : null}
                {job.completedCount > 0 ? (
                  <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                    {job.completedCount} completed
                  </span>
                ) : null}
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
