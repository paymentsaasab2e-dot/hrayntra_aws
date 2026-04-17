import React from 'react';
import { ChevronLeft, ChevronRight, MapPin, MonitorPlay, Phone } from 'lucide-react';
import type { Interview } from '../../types/interview.types';

interface InterviewCalendarViewProps {
  interviews: Interview[];
  onSelectInterview: (interview: Interview) => void;
}

function iconForType(type: Interview['type']) {
  if (type === 'Phone') return <Phone className="size-3" />;
  if (type === 'In-Person') return <MapPin className="size-3" />;
  return <MonitorPlay className="size-3" />;
}

export function InterviewCalendarView({ interviews, onSelectInterview }: InterviewCalendarViewProps) {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const getDayNumber = (value: string) => {
    const match = value.match(/[A-Za-z]{3}\s+(\d{1,2}),/);
    return match ? Number(match[1]) : null;
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-[#E5E7EB] px-5 py-4">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-semibold text-[#111827]">February 2026</h3>
          <button type="button" className="rounded-lg border border-[#E5E7EB] p-2 text-[#6B7280]"><ChevronLeft className="size-4" /></button>
          <button type="button" className="rounded-lg border border-[#E5E7EB] p-2 text-[#6B7280]"><ChevronRight className="size-4" /></button>
        </div>
        <div className="rounded-xl bg-[#F3F4F6] p-1 text-sm font-semibold text-[#374151]">
          <button type="button" className="rounded-lg bg-white px-3 py-1 shadow-sm">Month</button>
        </div>
      </div>

      <div className="grid grid-cols-7 border-b border-[#E5E7EB] bg-[#F9FAFB]">
        {days.map((day) => (
          <div key={day} className="px-3 py-2 text-center text-xs font-bold uppercase tracking-[0.16em] text-[#6B7280]">
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {Array.from({ length: 35 }).map((_, index) => {
          const dateLabel = index - 2;
          const dayInterviews = interviews.filter((interview) => getDayNumber(interview.date) === dateLabel);

          return (
            <div key={index} className="min-h-[150px] border-b border-r border-[#F3F4F6] p-2 last:border-r-0">
              <div className="mb-2 text-sm font-semibold text-[#374151]">{dateLabel > 0 ? dateLabel : ''}</div>
              <div className="space-y-2">
                {dayInterviews.slice(0, 3).map((interview) => (
                  <button
                    key={interview.id}
                    type="button"
                    onClick={() => onSelectInterview(interview)}
                    className="w-full rounded-xl bg-[#2563EB] p-2 text-left text-white"
                  >
                    <div className="flex items-center justify-between text-[10px] font-semibold">
                      <span>{interview.time}</span>
                      {iconForType(interview.type)}
                    </div>
                    <div className="mt-1 truncate text-xs font-semibold">{interview.candidate.name}</div>
                    <div className="truncate text-[10px] opacity-80">{interview.round}</div>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
