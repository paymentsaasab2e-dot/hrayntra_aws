'use client';

import type { LeadSource } from '@/app/leads/types';

export const LEAD_SOURCE_OPTIONS: LeadSource[] = ['Website', 'LinkedIn', 'Email', 'Referral', 'Campaign'];

const inputClass =
  'w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500';
const labelClass = 'block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1';

export type LeadSourceFormSlice = {
  source?: LeadSource | '';
  sourceWebsiteUrl?: string;
  sourceLinkedInUrl?: string;
  sourceEmail?: string;
  referralName?: string;
  campaignName?: string;
  campaignLink?: string;
};

type LeadSourceFieldsProps<T extends LeadSourceFormSlice> = {
  form: T;
  onChange: (patch: Partial<T>) => void;
  className?: string;
};

export function LeadSourceFields<T extends LeadSourceFormSlice>({
  form,
  onChange,
  className = '',
}: LeadSourceFieldsProps<T>) {
  const source = (form.source || 'Website') as LeadSource;

  const setSource = (next: LeadSource) => {
    onChange({
      source: next,
      campaignName: next === 'Campaign' ? form.campaignName : '',
      campaignLink: next === 'Campaign' ? form.campaignLink : '',
      referralName: next === 'Referral' ? form.referralName : '',
      sourceWebsiteUrl: next === 'Website' ? form.sourceWebsiteUrl : '',
      sourceLinkedInUrl: next === 'LinkedIn' ? form.sourceLinkedInUrl : '',
      sourceEmail: next === 'Email' ? form.sourceEmail : '',
    } as Partial<T>);
  };

  return (
    <div className={`space-y-4 ${className}`.trim()}>
      <div>
        <label className={labelClass}>Source</label>
        <select
          value={source}
          onChange={(e) => setSource(e.target.value as LeadSource)}
          className={`${inputClass} bg-white`}
        >
          {LEAD_SOURCE_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </div>

      {source === 'Website' && (
        <div>
          <label className={labelClass}>Website Link</label>
          <input
            value={form.sourceWebsiteUrl ?? ''}
            onChange={(e) => onChange({ sourceWebsiteUrl: e.target.value } as Partial<T>)}
            className={inputClass}
            placeholder="https://example.com"
          />
        </div>
      )}

      {source === 'LinkedIn' && (
        <div>
          <label className={labelClass}>LinkedIn URL</label>
          <input
            value={form.sourceLinkedInUrl ?? ''}
            onChange={(e) => onChange({ sourceLinkedInUrl: e.target.value } as Partial<T>)}
            className={inputClass}
            placeholder="https://linkedin.com/..."
          />
        </div>
      )}

      {source === 'Email' && (
        <div>
          <label className={labelClass}>Source Email</label>
          <input
            type="email"
            value={form.sourceEmail ?? ''}
            onChange={(e) => onChange({ sourceEmail: e.target.value } as Partial<T>)}
            className={inputClass}
            placeholder="lead@company.com"
          />
        </div>
      )}

      {source === 'Referral' && (
        <div>
          <label className={labelClass}>Referral Name</label>
          <input
            value={form.referralName ?? ''}
            onChange={(e) => onChange({ referralName: e.target.value } as Partial<T>)}
            className={inputClass}
            placeholder="Who referred this lead?"
          />
        </div>
      )}

      {source === 'Campaign' && (
        <>
          <div>
            <label className={labelClass}>Campaign Name</label>
            <input
              value={form.campaignName ?? ''}
              onChange={(e) => onChange({ campaignName: e.target.value } as Partial<T>)}
              className={inputClass}
              placeholder="e.g. Q1 Hiring Drive"
            />
          </div>
          <div>
            <label className={labelClass}>Campaign Link</label>
            <input
              value={form.campaignLink ?? ''}
              onChange={(e) => onChange({ campaignLink: e.target.value } as Partial<T>)}
              className={inputClass}
              placeholder="https://..."
            />
          </div>
        </>
      )}
    </div>
  );
}
