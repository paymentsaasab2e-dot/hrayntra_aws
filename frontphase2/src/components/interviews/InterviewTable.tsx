import React from 'react';
import { CalendarDays, Eye, FilePenLine, FlagTriangleRight, MapPin, MonitorPlay, Phone, XCircle } from 'lucide-react';
import type { Interview } from '../../types/interview.types';
import PaginationAll from '../PaginationAll';
import { getCandidateStageBadgeClasses, getCandidateStageLabel } from '../../utils/candidateStage';

interface InterviewTableProps {
  interviews: Interview[];
  selectedIds: string[];
  page: number;
  totalPages: number;
  totalEntries: number;
  pageSize: number;
  onToggleSelect: (interviewId: string) => void;
  onToggleSelectAll: () => void;
  onRowClick: (interview: Interview) => void;
  onViewCandidate: (interview: Interview) => void;
  onEditInterview: (interview: Interview) => void;
  onNoShowInterview: (interview: Interview) => void;
  onRejectCandidate: (interview: Interview) => void;
  onPageChange: (page: number) => void;
}

const statusClasses = {
  Scheduled: 'bg-blue-50 text-[#2563EB]',
  Completed: 'bg-green-50 text-[#16A34A]',
  Cancelled: 'bg-red-50 text-[#DC2626]',
  Rescheduled: 'bg-orange-50 text-[#F59E0B]',
  'No Show': 'bg-slate-100 text-[#6B7280]',
};

const feedbackClasses = {
  Pending: 'text-[#F59E0B]',
  Submitted: 'text-[#16A34A]',
  'N/A': 'text-[#9CA3AF]',
};

function modeIcon(type: Interview['type']) {
  if (type === 'Phone') return <Phone className="size-4 text-[#6B7280]" />;
  if (type === 'In-Person') return <MapPin className="size-4 text-[#6B7280]" />;
  return <MonitorPlay className="size-4 text-[#6B7280]" />;
}

export function InterviewTable({
  interviews,
  selectedIds,
  page,
  totalPages,
  totalEntries,
  pageSize,
  onToggleSelect,
  onToggleSelectAll,
  onRowClick,
  onViewCandidate,
  onEditInterview,
  onNoShowInterview,
  onRejectCandidate,
  onPageChange,
}: InterviewTableProps) {
  const allSelected = interviews.length > 0 && interviews.every((interview) => selectedIds.includes(interview.id));
  const safePageSize = Math.max(pageSize || 1, 1);
  const displayTotal = totalEntries > 0 ? totalEntries : interviews.length;
  const start = displayTotal > 0 ? Math.min((page - 1) * safePageSize + 1, displayTotal) : 0;
  const end = displayTotal > 0 ? Math.min(page * safePageSize, displayTotal) : 0;

  return (
    <div className="rounded-2xl border border-[#E5E7EB] bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-[#E5E7EB] bg-[#F9FAFB]">
            <tr className="text-[11px] uppercase tracking-[0.12em] text-[#6B7280]">
              <th className="px-5 py-4">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={onToggleSelectAll}
                  className="size-4 rounded border-[#D1D5DB] text-[#2563EB]"
                />
              </th>
              <th className="px-5 py-4">Candidate</th>
              <th className="px-5 py-4">Job / Client</th>
              <th className="px-5 py-4">Round / Mode</th>
              <th className="px-5 py-4">Date & Time</th>
              <th className="px-5 py-4">Interviewer(s)</th>
              <th className="px-5 py-4">Status</th>
              <th className="px-5 py-4">Feedback</th>
              <th className="px-5 py-4">Actions</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-[#F3F4F6]">
            {interviews.map((interview) => (
              <tr
                key={interview.id}
                onClick={() => onRowClick(interview)}
                className="cursor-pointer transition-colors hover:bg-[#F9FAFB]"
              >
                <td className="px-5 py-4" onClick={(event) => event.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(interview.id)}
                    onChange={() => onToggleSelect(interview.id)}
                    className="size-4 rounded border-[#D1D5DB] text-[#2563EB]"
                  />
                </td>
                <td className="px-5 py-4">
                  <div className="flex items-center gap-3">
                    <div className="flex size-10 items-center justify-center rounded-full bg-blue-100 text-[12px] font-semibold text-[#2563EB]">
                      {interview.candidate.name
                        .split(' ')
                        .map((part) => part[0])
                        .slice(0, 2)
                        .join('')}
                    </div>
                    <div>
                      <div className="text-[13px] font-semibold text-[#111827]">{interview.candidate.name}</div>
                      <div className="text-[12px] text-[#6B7280]">{interview.candidate.email || 'No email available'}</div>
                    </div>
                  </div>
                </td>
                <td className="px-5 py-4">
                  <div className="text-[13px] font-semibold text-[#111827]">{interview.job.title}</div>
                  <div className="text-[12px] text-[#6B7280]">{interview.job.client}</div>
                </td>
                <td className="px-5 py-4">
                  <div className="text-[13px] font-semibold text-[#111827]">{interview.round}</div>
                  <div className="mt-1 flex items-center gap-1.5 text-[12px] text-[#6B7280]">
                    {modeIcon(interview.type)}
                    {interview.type}
                  </div>
                </td>
                <td className="px-5 py-4">
                  <div className="flex items-center gap-2 text-[13px] font-semibold text-[#111827]">
                    <CalendarDays className="size-4 text-[#6B7280]" />
                    {interview.date}
                  </div>
                  <div className="pl-6 text-[12px] text-[#6B7280]">{interview.time}</div>
                </td>
                <td className="px-5 py-4">
                  <div className="flex items-center">
                    {interview.panel.slice(0, 3).map((member, index) => (
                      <div
                        key={member.id}
                        title={member.name}
                        className="-ml-2 flex size-8 items-center justify-center rounded-full border-2 border-white bg-[#DBEAFE] text-[11px] font-semibold text-[#2563EB]"
                        style={{ marginLeft: index === 0 ? 0 : -8 }}
                      >
                        {member.avatar}
                      </div>
                    ))}
                    {interview.panel.length > 3 ? (
                      <div className="-ml-2 flex size-8 items-center justify-center rounded-full border-2 border-white bg-[#F3F4F6] text-[11px] font-semibold text-[#374151]">
                        +{interview.panel.length - 3}
                      </div>
                    ) : null}
                  </div>
                </td>
                <td className="px-5 py-4">
                  <span className={`rounded-full px-3 py-1 text-[11px] font-semibold ${statusClasses[interview.status]}`}>
                    {interview.status}
                  </span>
                  {interview.candidate.stage && getCandidateStageLabel(interview.candidate.stage) !== 'Interviewing' ? (
                    <div className="mt-2">
                      <span
                        className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-semibold ${getCandidateStageBadgeClasses(
                          interview.candidate.stage
                        )}`}
                      >
                        {getCandidateStageLabel(interview.candidate.stage)}
                      </span>
                    </div>
                  ) : null}
                </td>
                <td className={`px-5 py-4 text-[12px] font-semibold ${feedbackClasses[interview.feedbackStatus]}`}>
                  {interview.feedbackStatus}
                </td>
                <td className="px-5 py-4" onClick={(event) => event.stopPropagation()}>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => onViewCandidate(interview)}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-[#E5E7EB] text-[#6B7280] hover:bg-[#F9FAFB] hover:text-[#111827]"
                      title="View candidate"
                      aria-label="View candidate"
                    >
                      <Eye className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onEditInterview(interview)}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-[#E5E7EB] text-[#6B7280] hover:bg-[#F9FAFB] hover:text-[#111827]"
                      title="Edit interview"
                      aria-label="Edit interview"
                    >
                      <FilePenLine className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onNoShowInterview(interview)}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-[#E5E7EB] text-[#6B7280] hover:bg-[#F9FAFB] hover:text-[#111827]"
                      title="Mark no show"
                      aria-label="Mark no show"
                    >
                      <FlagTriangleRight className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onRejectCandidate(interview)}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-red-200 bg-red-50 text-red-600 hover:bg-red-100"
                      title="Reject candidate"
                      aria-label="Reject candidate"
                    >
                      <XCircle className="size-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between gap-4 border-t border-[#E5E7EB] px-5 py-4">
        <PaginationAll
          initialPage={page}
          totalPages={Math.max(totalPages, 1)}
          totalCount={displayTotal}
          pageSize={pageSize}
          itemLabel="interviews"
          onPageChange={onPageChange}
        />
      </div>
    </div>
  );
}
