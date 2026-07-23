'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  CalendarDays,
  Mail,
  MessageCircle,
  MoreHorizontal,
  Phone,
  Users,
  Video,
} from 'lucide-react';
import {
  combineDMYAndTimeToISO,
  isoToDMYDate,
  isoToTimeHM,
  maskDateDMYInput,
  parseDMYToYMD,
} from '../utils/formatLeadDateTime';
import { getLocalDateTimeInputMinNow } from '../utils/dateInputConstraints';

export const FOLLOW_UP_TYPE_PRESETS = [
  { id: 'Call', label: 'Call', icon: Phone },
  { id: 'WhatsApp', label: 'WhatsApp', icon: MessageCircle },
  { id: 'Email', label: 'Email', icon: Mail },
  { id: 'Meet', label: 'Meet', icon: Users },
  { id: 'Video Call', label: 'Video', icon: Video },
] as const;

export const FOLLOW_UP_TYPE_OPTIONS = [
  ...FOLLOW_UP_TYPE_PRESETS,
  { id: 'Other', label: 'Other', icon: MoreHorizontal },
] as const;

const PRESET_IDS = new Set<string>(FOLLOW_UP_TYPE_PRESETS.map((o) => o.id));

export type FollowUpTypeOption = (typeof FOLLOW_UP_TYPE_OPTIONS)[number]['id'];

export function isOtherFollowUpType(type?: string | null): boolean {
  const value = String(type || '').trim();
  if (!value) return false;
  return value === 'Other' || !PRESET_IDS.has(value);
}

type Props = {
  value: string;
  onChange: (isoValue: string) => void;
  /** When true, date/time cannot be in the past (default for next follow-up). */
  enforceFuture?: boolean;
  label?: string;
  dateLabel?: string;
  timeLabel?: string;
  className?: string;
  /** Selected follow-up channel/type (Call, WhatsApp, Email, …). */
  followUpType?: string;
  onFollowUpTypeChange?: (type: string) => void;
  /** Hide type chips when not needed. Default: show when onFollowUpTypeChange is provided. */
  showFollowUpTypes?: boolean;
};

export function FollowUpDateTimeField({
  value,
  onChange,
  enforceFuture = true,
  label = 'Next Follow-up Date & Time',
  dateLabel = 'Date (DD/MM/YYYY)',
  timeLabel = 'Time',
  className = '',
  followUpType = 'Call',
  onFollowUpTypeChange,
  showFollowUpTypes,
}: Props) {
  const showTypes = showFollowUpTypes ?? Boolean(onFollowUpTypeChange);
  const otherSelected = isOtherFollowUpType(followUpType);
  const otherText =
    otherSelected && followUpType && followUpType !== 'Other' ? followUpType : '';

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

      {showTypes ? (
        <div className="mb-3">
          <p className="mb-1.5 text-[10px] font-semibold text-slate-500">Follow-up via</p>
          <div className="flex flex-wrap gap-1.5">
            {FOLLOW_UP_TYPE_OPTIONS.map((opt) => {
              const Icon = opt.icon;
              const selected =
                opt.id === 'Other' ? otherSelected : (followUpType || 'Call') === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => {
                    if (opt.id === 'Other') {
                      onFollowUpTypeChange?.(otherText || 'Other');
                      return;
                    }
                    onFollowUpTypeChange?.(opt.id);
                  }}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-xs font-semibold transition ${
                    selected
                      ? 'border-sky-500 bg-sky-50 text-sky-800 shadow-sm shadow-sky-500/10'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-sky-300 hover:bg-sky-50/50'
                  }`}
                >
                  <Icon size={13} className={selected ? 'text-sky-600' : 'text-slate-400'} />
                  {opt.label}
                </button>
              );
            })}
          </div>
          {otherSelected ? (
            <div className="mt-2.5">
              <label className="mb-1 block text-[10px] font-semibold text-slate-500">
                Specify other follow-up type
              </label>
              <input
                type="text"
                value={otherText}
                onChange={(e) => {
                  const next = e.target.value;
                  onFollowUpTypeChange?.(next.trim() ? next : 'Other');
                }}
                placeholder="e.g. LinkedIn, SMS, In-person visit…"
                autoFocus
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
              />
            </div>
          ) : null}
        </div>
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
