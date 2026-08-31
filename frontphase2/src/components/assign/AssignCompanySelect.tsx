'use client';

import type { AssignCompanyOption } from '@/hooks/useAssignableMembers';

type AssignCompanySelectProps = {
  companies: AssignCompanyOption[];
  value: string;
  onChange: (companyId: string) => void;
  disabled?: boolean;
  label?: string;
  className?: string;
};

export function AssignCompanySelect({
  companies,
  value,
  onChange,
  disabled = false,
  label = 'Select Company',
  className = '',
}: AssignCompanySelectProps) {
  if (!companies.length) return null;

  return (
    <div className={className}>
      <label className="block text-sm font-medium text-slate-700 mb-1.5">{label}</label>
      <select
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 disabled:bg-slate-50"
      >
        <option value="">Select Company</option>
        {companies.map((company) => (
          <option key={company.id} value={company.id}>
            {company.name}
          </option>
        ))}
      </select>
    </div>
  );
}
