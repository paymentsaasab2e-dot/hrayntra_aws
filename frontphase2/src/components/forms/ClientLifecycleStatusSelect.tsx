'use client';

import React from 'react';
import {
  CLIENT_LIFECYCLE_STATUS_OPTIONS,
  normalizeClientLifecycleStatus,
  type ClientLifecycleBackendStatus,
} from '../../lib/clientLifecycleStatus';

export interface ClientLifecycleStatusSelectProps {
  value: string;
  onChange: (value: ClientLifecycleBackendStatus) => void;
  disabled?: boolean;
  className?: string;
  id?: string;
}

export function ClientLifecycleStatusSelect({
  value,
  onChange,
  disabled = false,
  className = '',
  id,
}: ClientLifecycleStatusSelectProps) {
  const normalized = normalizeClientLifecycleStatus(value);

  return (
    <select
      id={id}
      disabled={disabled}
      value={normalized}
      onChange={(e) => onChange(e.target.value as ClientLifecycleBackendStatus)}
      className={`w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
    >
      {CLIENT_LIFECYCLE_STATUS_OPTIONS.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
