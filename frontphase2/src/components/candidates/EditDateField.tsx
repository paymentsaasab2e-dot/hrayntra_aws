'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { CalendarDays } from 'lucide-react';
import { isoToDMYDate, maskDateDMYInput, parseDMYToYMD } from '@/utils/formatLeadDateTime';
import { phase1FieldLabelClass, phase1FieldValueClass } from '@/lib/phase1Typography';

export function normalizeDateFieldValue(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  return parseDMYToYMD(trimmed) || trimmed;
}

function toDisplayDmy(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(trimmed)) return trimmed;
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    const dmy = isoToDMYDate(trimmed);
    if (dmy) return dmy;
  }
  return trimmed;
}

function toPickerYmd(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';
  const fromDmy = parseDMYToYMD(toDisplayDmy(trimmed));
  if (fromDmy) return fromDmy;
  const isoPrefix = trimmed.match(/^(\d{4}-\d{2}-\d{2})/);
  return isoPrefix ? isoPrefix[1] : '';
}

type EditDateFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  variant?: 'phase1' | 'ats';
  min?: string;
  max?: string;
  placeholder?: string;
  /** When true, onChange receives YYYY-MM-DD when the date is valid. */
  outputIso?: boolean;
  /** Hide the built-in label when a parent already renders one. */
  hideLabel?: boolean;
};

export function EditDateField({
  label,
  value,
  onChange,
  variant = 'phase1',
  min,
  max,
  placeholder = 'DD/MM/YYYY',
  outputIso = false,
  hideLabel = false,
}: EditDateFieldProps) {
  const displayFromValue = useMemo(() => toDisplayDmy(value), [value]);
  const [dateText, setDateText] = useState(displayFromValue);
  const [error, setError] = useState('');

  useEffect(() => {
    setDateText(displayFromValue);
    setError('');
  }, [displayFromValue]);

  const pickerDateValue = useMemo(() => toPickerYmd(dateText || value), [dateText, value]);

  const labelClass =
    variant === 'phase1'
      ? phase1FieldLabelClass
      : 'text-xs font-medium uppercase tracking-wide text-slate-500';
  const inputClass =
    variant === 'phase1'
      ? phase1FieldValueClass
      : 'text-sm text-slate-700';

  const commit = (nextDate: string) => {
    const d = nextDate.trim();
    if (!d) {
      setError('');
      onChange('');
      return;
    }
    const ymd = parseDMYToYMD(d);
    if (!ymd) {
      setError('Use DD/MM/YYYY (e.g. 15/05/2026)');
      return;
    }
    if (max && ymd > max) {
      setError('Date cannot be in the future');
      return;
    }
    if (min && ymd < min) {
      setError('Date is too early');
      return;
    }
    setError('');
    onChange(outputIso ? ymd : d);
  };

  const handleCalendarChange = (nextYmd: string) => {
    if (!nextYmd) {
      setDateText('');
      setError('');
      onChange('');
      return;
    }
    const [year, month, day] = nextYmd.split('-');
    if (!year || !month || !day) return;
    const nextDate = `${day}/${month}/${year}`;
    setDateText(nextDate);
    commit(nextDate);
  };

  return (
    <div className="block">
      {hideLabel ? null : <span className={`mb-1.5 block ${labelClass}`}>{label}</span>}
      <div className="relative">
        <input
          type="text"
          inputMode="numeric"
          autoComplete="off"
          placeholder={placeholder}
          value={dateText}
          onChange={(e) => setDateText(maskDateDMYInput(e.target.value))}
          onBlur={() => commit(dateText)}
          className={`w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 pr-11 outline-none ${
            variant === 'ats'
              ? 'focus:border-blue-400 focus:ring-2 focus:ring-blue-100'
              : 'focus:border-violet-400 focus:ring-2 focus:ring-violet-100'
          } ${inputClass} ${error ? 'border-red-300 focus:border-red-400 focus:ring-red-100' : ''}`}
        />
        <input
          type="date"
          value={pickerDateValue}
          min={min}
          max={max}
          onChange={(e) => handleCalendarChange(e.target.value)}
          aria-label={`${label} calendar picker`}
          className="absolute right-2 top-1/2 z-10 h-8 w-8 -translate-y-1/2 cursor-pointer opacity-0"
        />
        <span
          className="pointer-events-none absolute right-2 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400"
          aria-hidden="true"
        >
          <CalendarDays size={16} />
        </span>
      </div>
      {error ? <p className="mt-1 text-xs font-medium text-red-600">{error}</p> : null}
    </div>
  );
}
