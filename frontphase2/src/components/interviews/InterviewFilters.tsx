import React from 'react';
import { BriefcaseBusiness, ChevronDown, Filter, UserRound, Video, X, CalendarDays, CircleDot } from 'lucide-react';
import type { InterviewFiltersState } from '../../types/interview.types';

interface InterviewFiltersProps {
  filters: InterviewFiltersState;
  interviewerOptions: string[];
  clientJobOptions: string[];
  onChange: (field: keyof InterviewFiltersState, value: string) => void;
  onClear: () => void;
}

const fieldMeta: Array<{
  key: keyof InterviewFiltersState;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  options: string[];
}> = [
  { key: 'date', label: 'Date', icon: CalendarDays, options: ['This Week', 'Today', 'This Month'] },
  { key: 'status', label: 'Status', icon: CircleDot, options: ['All Status', 'Scheduled', 'Completed', 'Cancelled', 'Rescheduled', 'No Show'] },
  { key: 'round', label: 'Interview Round', icon: BriefcaseBusiness, options: ['All Rounds', 'Screening', 'Technical', 'HR', 'Managerial', 'Client', 'Final'] },
  { key: 'mode', label: 'Mode', icon: Video, options: ['All Modes', 'Online', 'Offline', 'Video', 'Phone', 'In-Person', 'Technical Test', 'Assessment'] },
];

export function InterviewFilters({
  filters,
  interviewerOptions,
  clientJobOptions,
  onChange,
  onClear,
}: InterviewFiltersProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 px-1">
        <Filter className="size-4 text-[#6B7280]" />
        <span className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#6B7280]">Quick Filters</span>
      </div>

      <div className="rounded-2xl border border-[#E5E7EB] bg-white p-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          {fieldMeta.map(({ key, label, icon: Icon, options }) => (
            <label
              key={key}
              className="flex min-w-[165px] items-center gap-2 rounded-xl border border-[#E5E7EB] bg-white px-3 py-2 text-sm text-[#111827]"
            >
              <Icon className="size-4 text-[#6B7280]" />
              <span className="text-[#6B7280]">{label}</span>
              <select
                value={filters[key]}
                onChange={(event) => onChange(key, event.target.value)}
                className="flex-1 appearance-none bg-transparent font-semibold outline-none"
              >
                {options.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
              <ChevronDown className="size-4 text-[#9CA3AF]" />
            </label>
          ))}

          <label className="flex min-w-[185px] items-center gap-2 rounded-xl border border-[#E5E7EB] bg-white px-3 py-2 text-sm text-[#111827]">
            <UserRound className="size-4 text-[#6B7280]" />
            <span className="text-[#6B7280]">Interviewer</span>
            <select
              value={filters.interviewer}
              onChange={(event) => onChange('interviewer', event.target.value)}
              className="flex-1 appearance-none bg-transparent font-semibold outline-none"
            >
              <option value="All Interviewers">All Interviewers</option>
              {interviewerOptions.map((option, idx) => (
                <option key={`${option}-${idx}`} value={option}>
                  {option}
                </option>
              ))}
            </select>
            <ChevronDown className="size-4 text-[#9CA3AF]" />
          </label>

          <label className="flex min-w-[190px] items-center gap-2 rounded-xl border border-[#E5E7EB] bg-white px-3 py-2 text-sm text-[#111827]">
            <BriefcaseBusiness className="size-4 text-[#6B7280]" />
            <span className="text-[#6B7280]">Client / Job</span>
            <select
              value={filters.clientJob}
              onChange={(event) => onChange('clientJob', event.target.value)}
              className="flex-1 appearance-none bg-transparent font-semibold outline-none"
            >
              <option value="All Clients">All Clients</option>
              {clientJobOptions.map((option, idx) => (
                <option key={`${option}-${idx}`} value={option}>
                  {option}
                </option>
              ))}
            </select>
            <ChevronDown className="size-4 text-[#9CA3AF]" />
          </label>

          <button
            type="button"
            onClick={onClear}
            className="ml-auto inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-[#6B7280] hover:bg-[#F3F4F6] hover:text-[#111827]"
          >
            <X className="size-4" />
            Clear Filters
          </button>
        </div>
      </div>
    </div>
  );
}
