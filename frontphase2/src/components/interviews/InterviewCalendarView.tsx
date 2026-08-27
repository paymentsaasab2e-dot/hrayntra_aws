'use client';

import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  ExternalLink,
  MapPin,
  MonitorPlay,
  Phone,
  Users,
  X,
} from 'lucide-react';
import type { Interview } from '../../types/interview.types';
import { formatDateDMY } from '../../utils/dateDisplay';
import { formatTimezoneDisplay, resolveIanaFromTimezoneValue } from '../../utils/inferTimezone';

interface InterviewCalendarViewProps {
  interviews: Interview[];
  onSelectInterview: (interview: Interview) => void;
}

function iconForType(type: Interview['type']) {
  if (type === 'Phone') return <Phone className="size-3.5" />;
  if (type === 'In-Person') return <MapPin className="size-3.5" />;
  return <MonitorPlay className="size-3.5" />;
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date: Date, amount: number) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

function formatMonthTitle(date: Date) {
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  return `${mm}/${date.getFullYear()}`;
}

function toInterviewDate(interview: Interview) {
  if (interview.scheduledAt) {
    const parsed = new Date(interview.scheduledAt);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }

  const fallback = new Date(`${interview.date} ${interview.time}`);
  return Number.isNaN(fallback.getTime()) ? null : fallback;
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function isSameMonth(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

function formatDetailDate(date: Date | null) {
  if (!date) return 'Unknown date';
  const weekday = date.toLocaleDateString('en-GB', { weekday: 'long' });
  return `${weekday}, ${formatDateDMY(date)}`;
}

export function InterviewCalendarView({ interviews, onSelectInterview }: InterviewCalendarViewProps) {
  const today = useMemo(() => new Date(), []);
  const [currentMonth, setCurrentMonth] = useState(() => startOfMonth(today));
  const [selectedInterview, setSelectedInterview] = useState<Interview | null>(null);

  const interviewsByDate = useMemo(() => {
    const map = new Map<string, Array<{ interview: Interview; date: Date }>>();
    for (const interview of interviews) {
      const date = toInterviewDate(interview);
      if (!date) continue;
      const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
      const list = map.get(key) || [];
      list.push({ interview, date });
      map.set(key, list);
    }

    for (const list of map.values()) {
      list.sort((a, b) => a.date.getTime() - b.date.getTime());
    }

    return map;
  }, [interviews]);

  const calendarCells = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const startOffset = (monthStart.getDay() + 6) % 7;
    const firstCell = new Date(monthStart);
    firstCell.setDate(firstCell.getDate() - startOffset);

    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(firstCell);
      date.setDate(firstCell.getDate() + index);
      const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
      const dayInterviews = interviewsByDate.get(key) || [];
      return {
        date,
        inMonth: isSameMonth(date, monthStart),
        isToday: sameDay(date, today),
        interviews: dayInterviews,
      };
    });
  }, [currentMonth, interviewsByDate, today]);

  const selectedDate = selectedInterview ? toInterviewDate(selectedInterview) : null;

  return (
    <>
      <div className="overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-[#E5E7EB] px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setCurrentMonth((current) => addMonths(current, -1))}
              className="rounded-xl border border-[#E5E7EB] bg-white p-2 text-[#6B7280] transition-colors hover:bg-[#F9FAFB] hover:text-[#111827]"
              aria-label="Previous month"
            >
              <ChevronLeft className="size-4" />
            </button>
            <div>
              <h3 className="text-lg font-semibold text-[#111827]">{formatMonthTitle(currentMonth)}</h3>
              <p className="text-xs text-[#6B7280]">Scheduled interviews shown by date</p>
            </div>
            <button
              type="button"
              onClick={() => setCurrentMonth((current) => addMonths(current, 1))}
              className="rounded-xl border border-[#E5E7EB] bg-white p-2 text-[#6B7280] transition-colors hover:bg-[#F9FAFB] hover:text-[#111827]"
              aria-label="Next month"
            >
              <ChevronRight className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => setCurrentMonth(startOfMonth(today))}
              className="rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] px-3 py-2 text-xs font-semibold text-[#374151] transition-colors hover:bg-[#F3F4F6]"
            >
              Today
            </button>
          </div>

          <div className="inline-flex items-center gap-2 rounded-xl bg-[#F9FAFB] px-3 py-2 text-xs font-semibold text-[#6B7280]">
            <CalendarDays className="size-4 text-[#2563EB]" />
            Click an interview to view details
          </div>
        </div>

        <div className="grid grid-cols-7 border-b border-[#E5E7EB] bg-[#F9FAFB]">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
            <div key={day} className="px-2 py-2 text-center text-[11px] font-bold uppercase tracking-[0.14em] text-[#6B7280]">
              {day}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {calendarCells.map((cell) => (
            <div
              key={cell.date.toISOString()}
              className={`min-h-[138px] border-b border-r border-[#F3F4F6] p-2 last:border-r-0 ${
                cell.inMonth ? 'bg-white' : 'bg-[#FAFAFA] text-[#C1C7D0]'
              } ${cell.isToday ? 'bg-[#EFF6FF]' : ''}`}
            >
              <div className="mb-2 flex items-center justify-between">
                <div
                  className={`text-sm font-semibold ${
                    cell.isToday ? 'text-[#2563EB]' : cell.inMonth ? 'text-[#374151]' : 'text-[#CBD5E1]'
                  }`}
                >
                  {cell.date.getDate()}
                </div>
                {cell.interviews.length > 0 ? (
                  <div className="rounded-full bg-[#DBEAFE] px-1.5 py-0.5 text-[10px] font-semibold text-[#2563EB]">
                    {cell.interviews.length}
                  </div>
                ) : null}
              </div>

              <div className="space-y-1.5">
                {cell.interviews.slice(0, 3).map(({ interview }) => (
                  <button
                    key={interview.id}
                    type="button"
                    onClick={() => setSelectedInterview(interview)}
                    className="w-full rounded-xl border border-[#DBEAFE] bg-[#EFF6FF] px-2 py-2 text-left transition-colors hover:bg-[#DBEAFE]"
                  >
                    <div className="flex items-center justify-between gap-2 text-[10px] font-semibold text-[#2563EB]">
                      <span className="truncate">{interview.time}</span>
                      {iconForType(interview.type)}
                    </div>
                    <div className="mt-1 truncate text-[11px] font-semibold text-[#111827]">{interview.candidate.name}</div>
                    <div className="truncate text-[10px] text-[#6B7280]">
                      {interview.job.title} • {interview.round}
                    </div>
                  </button>
                ))}
                {cell.interviews.length > 3 ? (
                  <button
                    type="button"
                    onClick={() => setSelectedInterview(cell.interviews[3].interview)}
                    className="w-full rounded-lg border border-dashed border-[#BFDBFE] px-2 py-1.5 text-center text-[10px] font-semibold text-[#2563EB] hover:bg-[#EFF6FF]"
                  >
                    +{cell.interviews.length - 3} more
                  </button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </div>

      <AnimatePresence>
        {selectedInterview ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/45 px-4"
            onClick={() => setSelectedInterview(null)}
          >
            <motion.div
              initial={{ y: 16, opacity: 0, scale: 0.98 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 12, opacity: 0, scale: 0.98 }}
              transition={{ type: 'spring', damping: 24, stiffness: 240 }}
              onClick={(event) => event.stopPropagation()}
              className="w-full max-w-2xl overflow-hidden rounded-3xl bg-white shadow-2xl"
            >
              <div className="flex items-start justify-between gap-4 border-b border-[#E5E7EB] px-5 py-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#6B7280]">Interview details</p>
                  <h4 className="mt-1 text-xl font-semibold text-[#111827]">{selectedInterview.candidate.name}</h4>
                  <p className="text-sm text-[#6B7280]">
                    {selectedInterview.job.title} • {selectedInterview.job.client}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedInterview(null)}
                  className="rounded-xl p-2 text-[#6B7280] transition-colors hover:bg-[#F3F4F6] hover:text-[#111827]"
                  aria-label="Close details"
                >
                  <X className="size-5" />
                </button>
              </div>

              <div className="grid gap-4 p-5 sm:grid-cols-2">
                <DetailCard label="Date" value={formatDetailDate(selectedDate)} icon={<CalendarDays className="size-4 text-[#2563EB]" />} />
                <DetailCard label="Time" value={`${selectedInterview.time} (${formatTimezoneDisplay(resolveIanaFromTimezoneValue(selectedInterview.timezone))})`} icon={<Clock3 className="size-4 text-[#2563EB]" />} />
                <DetailCard label="Round" value={selectedInterview.round} icon={<Users className="size-4 text-[#2563EB]" />} />
                <DetailCard label="Type" value={`${selectedInterview.type} • ${selectedInterview.mode}`} icon={iconForType(selectedInterview.type)} />
                <DetailCard label="Job" value={selectedInterview.job.title} />
                <DetailCard label="Client" value={selectedInterview.job.client} />
                <DetailCard label="Status" value={selectedInterview.status} />
                <DetailCard label="Duration" value={`${selectedInterview.duration} minutes`} />
              </div>

              <div className="px-5 pb-5">
                {selectedInterview.location ? (
                  <div className="mb-4 rounded-2xl border border-[#E5E7EB] bg-[#FAFAFA] p-4">
                    <div className="text-xs font-bold uppercase tracking-[0.14em] text-[#6B7280]">Location</div>
                    <div className="mt-1 text-sm font-medium text-[#111827]">{selectedInterview.location}</div>
                  </div>
                ) : null}

                {selectedInterview.meetingLink ? (
                  <a
                    href={selectedInterview.meetingLink}
                    target="_blank"
                    rel="noreferrer"
                    className="mb-4 inline-flex items-center gap-2 rounded-xl bg-[#2563EB] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#1D4ED8]"
                  >
                    <ExternalLink className="size-4" />
                    Open meeting link
                  </a>
                ) : null}

                <div className="rounded-2xl border border-[#E5E7EB] bg-[#FAFAFB] p-4">
                  <div className="text-xs font-bold uppercase tracking-[0.14em] text-[#6B7280]">Notes</div>
                  <p className="mt-1 text-sm leading-6 text-[#374151]">
                    {selectedInterview.notes || 'No interview notes available.'}
                  </p>
                </div>

                <div className="mt-4 flex justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      onSelectInterview(selectedInterview);
                      setSelectedInterview(null);
                    }}
                    className="rounded-xl bg-[#111827] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#0F172A]"
                  >
                    Open full details
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}

function DetailCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-[#E5E7EB] bg-[#FAFAFB] p-4">
      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-[#6B7280]">
        {icon ? <span className="inline-flex">{icon}</span> : null}
        <span>{label}</span>
      </div>
      <div className="mt-1 text-sm font-semibold text-[#111827]">{value}</div>
    </div>
  );
}
