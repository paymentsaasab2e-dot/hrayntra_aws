'use client';

import React from 'react';
import { useOrgWorkspace } from '@/lib/org/useOrgWorkspace';

type Props = {
  variant?: 'header' | 'light';
};

/**
 * Company switcher — Super Admin / switch_companies only.
 * Other users never see the dropdown (even if localStorage has a leftover id).
 */
export function OrgWorkspaceSwitcher({ variant = 'light' }: Props) {
  const { orgUnitId, orgUnitName, companies, canSwitchCompanies, purpose, setActiveOrgUnit } =
    useOrgWorkspace();

  if (!canSwitchCompanies) {
    // Read-only home label for company/site heads — not a selector.
    if (orgUnitName && (purpose === 'company_head' || purpose === 'site_head')) {
      return (
        <span className="inline-flex h-9 items-center rounded-xl border border-slate-200 bg-slate-50 px-3 text-[13px] font-medium text-slate-600">
          {orgUnitName}
        </span>
      );
    }
    return null;
  }

  if (!companies.length) return null;

  const dark = variant === 'header';
  return (
    <label
      className={
        dark
          ? 'inline-flex h-9 max-w-[240px] items-center rounded-lg border border-white/15 bg-white/5 px-2 text-[12px] font-medium text-slate-100'
          : 'inline-flex h-9 items-center gap-2 rounded-xl border border-slate-200 bg-white px-2.5 text-[13px] font-medium text-slate-700'
      }
    >
      <span className="sr-only">Operate as company</span>
      <select
        value={orgUnitId}
        onChange={(e) => {
          const id = e.target.value;
          const name = companies.find((c) => c.id === id)?.name;
          setActiveOrgUnit(id, name);
        }}
        className={
          dark
            ? 'max-w-[220px] bg-transparent text-[12px] font-medium text-white outline-none'
            : 'max-w-[200px] bg-transparent text-[13px] font-medium text-slate-800 outline-none'
        }
        aria-label="Switch company to operate CRM and recruitment"
      >
        <option value="">All companies</option>
        {companies.map((c) => (
          <option key={c.id} value={c.id} className="text-slate-900">
            {c.name}
          </option>
        ))}
      </select>
    </label>
  );
}
