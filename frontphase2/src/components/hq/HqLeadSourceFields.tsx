'use client';

import React from 'react';
import { ChevronDown } from 'lucide-react';
import {
  HQ_LEAD_SOURCE_DETAIL_FIELDS,
  HQ_LEAD_SOURCE_OPTIONS,
  type HqLeadSourceOption,
} from '@/app/hq/leads/hqLeadsData';

const INPUT_CLASS =
  'w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-slate-300 focus:ring-2 focus:ring-slate-200';

function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="mb-1.5 block text-sm font-medium text-slate-800">
      {children}
      {required ? <span className="ml-0.5 text-rose-500">*</span> : null}
    </label>
  );
}

type HqLeadSourceFieldsProps = {
  leadSource: string;
  leadSourceDetail: string;
  onChange: (patch: { leadSource?: string; leadSourceDetail?: string }) => void;
  required?: boolean;
  className?: string;
};

export function HqLeadSourceFields({
  leadSource,
  leadSourceDetail,
  onChange,
  required = false,
  className = '',
}: HqLeadSourceFieldsProps) {
  const detailConfig = leadSource
    ? HQ_LEAD_SOURCE_DETAIL_FIELDS[leadSource as HqLeadSourceOption]
    : null;

  const handleSourceChange = (nextSource: string) => {
    onChange({
      leadSource: nextSource,
      leadSourceDetail: nextSource === leadSource ? leadSourceDetail : '',
    });
  };

  return (
    <div className={`space-y-4 ${className}`.trim()}>
      <div>
        <FieldLabel required={required}>Lead Source</FieldLabel>
        <div className="relative">
          <select
            className={`${INPUT_CLASS} appearance-none pr-10`}
            value={leadSource}
            onChange={(e) => handleSourceChange(e.target.value)}
          >
            <option value="">Select source</option>
            {HQ_LEAD_SOURCE_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        </div>
      </div>

      {detailConfig ? (
        <div>
          <FieldLabel required={required}>{detailConfig.label}</FieldLabel>
          <input
            className={INPUT_CLASS}
            value={leadSourceDetail}
            onChange={(e) => onChange({ leadSourceDetail: e.target.value })}
            placeholder={detailConfig.placeholder}
          />
        </div>
      ) : null}
    </div>
  );
}

export function validateHqLeadSourceFields(leadSource: string, leadSourceDetail: string): string | null {
  if (!leadSource) {
    return 'Lead source is required.';
  }
  const detailConfig = HQ_LEAD_SOURCE_DETAIL_FIELDS[leadSource as HqLeadSourceOption];
  if (detailConfig && !leadSourceDetail.trim()) {
    return `${detailConfig.label} is required.`;
  }
  return null;
}
