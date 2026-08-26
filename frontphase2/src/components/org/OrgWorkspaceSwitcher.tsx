'use client';

import React from 'react';
import { useOrgWorkspace } from '@/lib/org/useOrgWorkspace';

type Props = {
  variant?: 'header' | 'light';
};

export function OrgWorkspaceSwitcher({ variant = 'light' }: Props) {
  const { orgUnitId, orgUnitName, companies, canSwitchCompanies, purpose, setActiveOrgUnit } =
    useOrgWorkspace();

  if (canSwitchCompanies && companies.length) {
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

  if (orgUnitName && (purpose === 'company_head' || purpose === 'site_head')) {
    return (
      <span className="inline-flex h-9 items-center rounded-xl border border-slate-200 bg-slate-50 px-3 text-[13px] font-medium text-slate-600">
        {orgUnitName}
      </span>
    );
  }

  return null;
}

export function OrgWorkspaceBanner() {
  const { orgUnitId, orgUnitName, canSwitchCompanies, setActiveOrgUnit } = useOrgWorkspace();
  if (!canSwitchCompanies || !orgUnitId) return null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-sky-200 bg-sky-50 px-4 py-2 text-[13px] text-sky-950">
      <p>
        Operating in <span className="font-semibold">{orgUnitName || 'this company'}</span> as Super
        Admin of that company. CRM and recruitment show this company only — same modules as HQ, scoped
        to its people.
      </p>
      <button
        type="button"
        onClick={() => setActiveOrgUnit('')}
        className="shrink-0 rounded-lg border border-sky-300 bg-white px-2.5 py-1 text-[12px] font-semibold text-sky-800 hover:bg-sky-100"
      >
        Back to all companies
      </button>
    </div>
  );
}
