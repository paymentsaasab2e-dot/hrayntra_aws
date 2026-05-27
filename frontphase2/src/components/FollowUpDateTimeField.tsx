'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { CalendarDays } from 'lucide-react';
import {
  combineDMYAndTimeToISO,
  isoToDMYDate,
  isoToTimeHM,
  maskDateDMYInput,
  parseDMYToYMD,
} from '../utils/formatLeadDateTime';
import { getLocalDateTimeInputMinNow } from '../utils/dateInputConstraints';

type Props = {
  value: string;
  onChange: (isoValue: string) => void;
  /** When true, date/time cannot be in the past (default for next follow-up). */
  enforceFuture?: boolean;
  label?: string;
  dateLabel?: string;
  timeLabel?: string;
  className?: string;
};

export function FollowUpDateTimeField({
  value,
  onChange,
  enforceFuture = true,
  label = 'Next Follow-up Date & Time',
  dateLabel = 'Date (DD/MM/YYYY)',
  timeLabel = 'Time',
  className = '',
}: Props) {
  const parsed = useMemo(
    () => ({
      date: isoToDMYDate(value),
      time: isoToTimeHM(value) || '09:00',
    }),
    [value]
  );

  const [dateText, setDateText] = useState(parsed.date);
  const [timeText, setTimeText] = useState(parsed.time);
  const [dateError, setDateError] = useState('');

  useEffect(() => {
    setDateText(parsed.date);
    setTimeText(parsed.time);
    setDateError('');
  }, [parsed.date, parsed.time]);

  const pickerDateValue = useMemo(() => parseDMYToYMD(dateText) || '', [dateText]);
  const pickerMinDate = enforceFuture ? getLocalDateTimeInputMinNow().slice(0, 10) : undefined;

  const commit = (nextDate: string, nextTime: string) => {
    const d = nextDate.trim();
    const t = (nextTime || '09:00').trim().slice(0, 5);
    if (!d) {
      setDateError('');
      onChange('');
      return;
    }
    if (!parseDMYToYMD(d)) {
      setDateError('Use DD/MM/YYYY (e.g. 15/05/2026)');
      return;
    }
    const iso = combineDMYAndTimeToISO(d, t);
    if (!iso) {
      setDateError('Invalid date or time');
      return;
    }
    if (enforceFuture) {
      const min = getLocalDateTimeInputMinNow();
      const minDate = new Date(min);
      const chosen = new Date(iso);
      if (chosen.getTime() < minDate.getTime()) {
        setDateError('Follow-up must be in the future');
        return;
      }
    }
    setDateError('');
    onChange(iso);
  };

  const handleCalendarDateChange = (nextYmd: string) => {
    if (!nextYmd) {
      setDateText('');
      setDateError('');
      onChange('');
      return;
    }
    const [year, month, day] = nextYmd.split('-');
    if (!year || !month || !day) return;
    const nextDate = `${day}/${month}/${year}`;
    setDateText(nextDate);
    commit(nextDate, timeText);
  };

  return (
    <div className={className}>
      {label ? (
        <label className="mb-2 block text-[11px] font-bold uppercase tracking-wider text-slate-400">
          {label}
        </label>
      ) : null}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-[10px] font-semibold text-slate-500">{dateLabel}</label>
          <div className="relative">
            <input
              type="text"
              inputMode="numeric"
              autoComplete="off"
              placeholder="DD/MM/YYYY"
              value={dateText}
              onChange={(e) => setDateText(maskDateDMYInput(e.target.value))}
              onBlur={() => commit(dateText, timeText)}
              className="w-full rounded-xl border border-slate-200 px-4 py-2.5 pr-12 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
            <input
              type="date"
              value={pickerDateValue}
              min={pickerMinDate}
              onChange={(e) => handleCalendarDateChange(e.target.value)}
              aria-label={`${dateLabel} calendar picker`}
              className="absolute right-2 top-1/2 z-10 h-8 w-8 -translate-y-1/2 cursor-pointer opacity-0"
            />
            <span
              className="pointer-events-none absolute right-2 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400"
              aria-hidden="true"
            >
              <CalendarDays size={16} />
            </span>
          </div>
        </div>
        <div>
          <label className="mb-1 block text-[10px] font-semibold text-slate-500">{timeLabel}</label>
          <input
            type="time"
            value={timeText}
            onChange={(e) => {
              const next = e.target.value;
              setTimeText(next);
              if (dateText && parseDMYToYMD(dateText)) commit(dateText, next);
            }}
            className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
        </div>
      </div>
      {dateError ? <p className="mt-1.5 text-xs font-medium text-red-600">{dateError}</p> : null}
    </div>
  );
}
