'use client';

import React, { useMemo } from 'react';
import {
  buildClientTimezoneSelectOptions,
  buildIanaTimezoneSelectOptions,
  resolveIanaFromTimezoneValue,
} from '../../utils/inferTimezone';

const SELECT_CLASS =
  'w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 ' +
  'focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white';

type ClientTimezoneSelectProps = {
  value: string;
  onChange: (value: string) => void;
  onManualChange?: () => void;
  className?: string;
  placeholder?: string;
  /** When true, option values are IANA ids (for interview scheduling). */
  valueAsIana?: boolean;
};

export function ClientTimezoneSelect({
  value,
  onChange,
  onManualChange,
  className,
  placeholder = 'Select timezone…',
  valueAsIana = false,
}: ClientTimezoneSelectProps) {
  const options = useMemo(
    () => (valueAsIana ? buildIanaTimezoneSelectOptions(value) : buildClientTimezoneSelectOptions(value)),
    [value, valueAsIana],
  );
  const selectValue = valueAsIana ? resolveIanaFromTimezoneValue(value, '') : value;

  return (
    <select
      value={selectValue}
      onChange={(e) => {
        onManualChange?.();
        onChange(e.target.value);
      }}
      className={className ?? SELECT_CLASS}
    >
      <option value="">{placeholder}</option>
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}
