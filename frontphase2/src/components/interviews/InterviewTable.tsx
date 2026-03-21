import React from 'react';
import { CalendarDays, CheckSquare, ExternalLink, MessageSquareText, MapPin, MonitorPlay, Phone, Users } from 'lucide-react';
import { ActionsDropdown, type InterviewAction } from './ActionsDropdown';
import type { Interview } from '../../types/interview.types';
import { getCandidateStageBadgeClasses, getCandidateStageLabel } from '../../utils/candidateStage';

interface InterviewTableProps {
  interviews: Interview[];
  selectedIds: string[];
  page: number;
  totalPages: number;
  onToggleSelect: (interviewId: string) => void;
  onToggleSelectAll: () => void;
  onRowClick: (interview: Interview) => void;
  onAction: (action: InterviewAction, interview: Interview) => void;
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
  onToggleSelect,
  onToggleSelectAll,
  onRowClick,
  onAction,
  onPageChange,
}: InterviewTableProps) {
  const allSelected = interviews.length > 0 && interviews.every((interview) => selectedIds.includes(interview.id));

  return (
    <div className="rounded-2xl border border-[#E5E7EB] bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-full text-left">
          <thead className="border-b border-[#E5E7EB] bg-[#F9FAFB]">
            <tr className="text-xs uppercase tracking-[0.14em] text-[#6B7280]">
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
              <th className="px-5 py-4 text-right">Actions</th>
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
                    <div className="flex size-10 items-center justify-center rounded-full bg-blue-100 text-sm font-semibold text-[#2563EB]">
                      {interview.candidate.name
                        .split(' ')
                        .map((part) => part[0])
                        .slice(0, 2)
                        .join('')}
                    </div>
                    <div>
                      <div className="font-semibold text-[#111827]">{interview.candidate.name}</div>
                      <div className="text-sm text-[#6B7280]">{interview.candidate.email}</div>
                    </div>
                  </div>
                </td>
                <td className="px-5 py-4">
                  <div className="font-semibold text-[#111827]">{interview.job.title}</div>
                  <div className="text-sm text-[#6B7280]">{interview.job.client}</div>
                </td>
                <td className="px-5 py-4">
                  <div className="font-semibold text-[#111827]">{interview.round}</div>
                  <div className="mt-1 flex items-center gap-1.5 text-sm text-[#6B7280]">
                    {modeIcon(interview.type)}
                    {interview.type}
                  </div>
                </td>
                <td className="px-5 py-4">
                  <div className="flex items-center gap-2 font-semibold text-[#111827]">
                    <CalendarDays className="size-4 text-[#6B7280]" />
                    {interview.date}
                  </div>
                  <div className="pl-6 text-sm text-[#6B7280]">{interview.time}</div>
                </td>
                <td className="px-5 py-4">
                  <div className="flex items-center">
                    {interview.panel.slice(0, 3).map((member, index) => (
                      <div
                        key={member.id}
                        title={member.name}
                        className="-ml-2 flex size-8 items-center justify-center rounded-full border-2 border-white bg-[#DBEAFE] text-xs font-semibold text-[#2563EB]"
                        style={{ marginLeft: index === 0 ? 0 : -8 }}
                      >
                        {member.avatar}
                      </div>
                    ))}
                    {interview.panel.length > 3 ? (
                      <div className="-ml-2 flex size-8 items-center justify-center rounded-full border-2 border-white bg-[#F3F4F6] text-xs font-semibold text-[#374151]">
                        +{interview.panel.length - 3}
                      </div>
                    ) : null}
                  </div>
                </td>
                <td className="px-5 py-4">
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusClasses[interview.status]}`}>
                    {interview.status}
                  </span>
                  {interview.candidate.stage ? (
                    <div className="mt-2">
                      <span
                        className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${getCandidateStageBadgeClasses(
                          interview.candidate.stage
                        )}`}
                      >
                        {getCandidateStageLabel(interview.candidate.stage)}
                      </span>
                    </div>
                  ) : null}
                </td>
                <td className={`px-5 py-4 text-sm font-semibold ${feedbackClasses[interview.feedbackStatus]}`}>
                  {interview.feedbackStatus}
                </td>
                <td className="px-5 py-4">
                  <div className="flex justify-end gap-1" onClick={(event) => event.stopPropagation()}>
                    <button
                      type="button"
                      onClick={() => onAction('feedback', interview)}
                      className="rounded-lg p-2 text-[#6B7280] hover:bg-[#F3F4F6]"
                    >
                      <MessageSquareText className="size-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onAction('view', interview)}
                      className="rounded-lg p-2 text-[#6B7280] hover:bg-[#F3F4F6]"
                    >
                      <ExternalLink className="size-4" />
                    </button>
                    <ActionsDropdown onSelect={(action) => onAction(action, interview)} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between border-t border-[#E5E7EB] px-5 py-4">
        <div className="flex items-center gap-2 text-sm text-[#6B7280]">
          <CheckSquare className="size-4" />
          {selectedIds.length} selected
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={page === 1}
            onClick={() => onPageChange(page - 1)}
            className="rounded-lg border border-[#E5E7EB] px-3 py-1.5 text-sm font-medium text-[#374151] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Prev
          </button>
          {Array.from({ length: totalPages }).map((_, index) => (
            <button
              key={index}
              type="button"
              onClick={() => onPageChange(index + 1)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                page === index + 1 ? 'bg-[#2563EB] text-white' : 'border border-[#E5E7EB] text-[#374151]'
              }`}
            >
              {index + 1}
            </button>
          ))}
          <button
            type="button"
            disabled={page === totalPages}
            onClick={() => onPageChange(page + 1)}
            className="rounded-lg border border-[#E5E7EB] px-3 py-1.5 text-sm font-medium text-[#374151] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
