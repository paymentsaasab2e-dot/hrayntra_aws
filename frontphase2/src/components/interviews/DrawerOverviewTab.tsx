import React from 'react';
import { CalendarDays, Clock3, Link as LinkIcon, MapPin } from 'lucide-react';
import type { Interview } from '../../types/interview.types';

interface DrawerOverviewTabProps {
  interview: Interview;
}

export function DrawerOverviewTab({ interview }: DrawerOverviewTabProps) {
  const items = [
    ['Interview Round', interview.round],
    ['Interview Type', interview.type],
    ['Date', interview.date],
    ['Time', interview.time],
    ['Duration', `${interview.duration} minutes`],
    ['Status', interview.status],
    ['Created By', interview.createdBy],
  ];

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        {items.map(([label, value]) => (
          <div key={label} className="rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] p-4">
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[#6B7280]">{label}</div>
            <div className="mt-2 text-sm font-semibold text-[#111827]">{value}</div>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-[#E5E7EB] p-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-[#111827]">
          <CalendarDays className="size-4 text-[#6B7280]" />
          Interview Schedule
        </div>
        <div className="mt-3 space-y-3 text-sm text-[#374151]">
          <div className="flex items-center gap-2">
            <Clock3 className="size-4 text-[#6B7280]" />
            {interview.date} at {interview.time} ({interview.timezone})
          </div>
          {interview.meetingLink ? (
            <a
              href={interview.meetingLink}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 text-[#2563EB] underline-offset-2 hover:underline"
            >
              <LinkIcon className="size-4" />
              {interview.meetingLink}
            </a>
          ) : null}
          {interview.location ? (
            <div className="flex items-center gap-2">
              <MapPin className="size-4 text-[#6B7280]" />
              {interview.location}
            </div>
          ) : null}
        </div>
      </div>

      <div className="rounded-xl border border-[#E5E7EB] p-4">
        <div className="text-sm font-semibold text-[#111827]">Notes</div>
        <p className="mt-2 text-sm leading-6 text-[#4B5563]">{interview.notes || 'No notes added yet.'}</p>
      </div>
    </div>
  );
}
