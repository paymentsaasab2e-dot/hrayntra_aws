'use client';

import React, { useEffect, useState } from 'react';
import { Settings } from 'lucide-react';
import { toast } from 'sonner';
import {
  apiCreateLegalEmployer,
  apiGetPeopleSecurity,
  apiListLegalEmployers,
  apiPutPeopleSecurity,
  type LegalEmployer,
} from '../../../lib/api';
import { getCountryPack, listCountryPacks, payrollCapabilityLabel } from '../../../lib/peoplecore/countryPacks';
import {
  PeopleBanner,
  PeopleCard,
  PeopleFormRow,
  Ph2ModulePageLayout,
  PH2_HEADER_PILL_PRIMARY,
  fieldClass,
} from '../_components/PeopleModule';

export default function PeopleSettingsPage() {
  const [employers, setEmployers] = useState<LegalEmployer[]>([]);
  const [name, setName] = useState('');
  const [country, setCountry] = useState('CM');
  const [identifiers, setIdentifiers] = useState<Record<string, string>>({});
  const [security, setSecurity] = useState<Record<string, boolean>>({});
  const pack = getCountryPack(country);

  const load = async () => {
    try {
      const [emp, sec] = await Promise.all([apiListLegalEmployers(), apiGetPeopleSecurity()]);
      setEmployers((emp.data as LegalEmployer[]) || []);
      setSecurity((sec.data as Record<string, boolean>) || {});
    } catch (error: any) {
      toast.error(error?.message || 'Failed to load settings');
    }
  };

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    setIdentifiers({});
  }, [country]);

  const create = async () => {
    try {
      await apiCreateLegalEmployer({ name, country, identifiers });
      toast.success(`${pack?.name} legal employer created. Holidays and leave types seeded from the pack.`);
      setName('');
      await load();
    } catch (error: any) {
      toast.error(error?.message || 'Could not create legal employer');
    }
  };

  return (
    <Ph2ModulePageLayout
      title="People settings"
      icon={<Settings className="h-5 w-5" />}
      subtitle="Legal employer owns the country pack. Only India calculates pay. Other countries do not inherit India PF/ESI."
    >
      <PeopleBanner text="Slice 1 SET+ORG. Create a legal employer first. Payroll capability is informational — Phase 3 still does not print payslips." />
      <PeopleCard>
        <h2 className="text-sm font-semibold text-slate-900">New legal employer</h2>
        <PeopleFormRow>
          <input className={fieldClass} placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
          <select className={fieldClass} value={country} onChange={(e) => setCountry(e.target.value)}>
            {listCountryPacks().map((row) => (
              <option key={row.iso} value={row.iso}>
                {row.name} · {payrollCapabilityLabel(row.payrollCapability)}
              </option>
            ))}
          </select>
          <button type="button" className={PH2_HEADER_PILL_PRIMARY} onClick={() => void create()}>
            Save
          </button>
        </PeopleFormRow>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {(pack?.companyIdentifierFields || []).map((field) => (
            <input
              key={field.id}
              className={fieldClass}
              placeholder={field.label}
              value={identifiers[field.id] || ''}
              onChange={(e) => setIdentifiers((c) => ({ ...c, [field.id]: e.target.value }))}
            />
          ))}
        </div>
        <p className="mt-2 text-[11px] text-slate-500">{pack?.payrollNote}</p>
      </PeopleCard>
      <div className="mt-3">
        <PeopleCard>
          <h2 className="text-sm font-semibold text-slate-900">Legal employers</h2>
          <ul className="mt-2 divide-y divide-slate-100 text-sm">
            {employers.map((row) => (
              <li key={row.id} className="py-2">
                <span className="font-medium">{row.name}</span>
                <span className="ml-2 text-xs text-slate-500">
                  {row.country} · {row.currency} · {payrollCapabilityLabel(row.payrollCapability)}
                </span>
                <div className="text-[11px] text-slate-500">
                  {Object.entries(row.identifiers || {}).map(([k, v]) => `${k}: ${v}`).join(' · ') || 'No identifiers yet'}
                </div>
              </li>
            ))}
            {employers.length === 0 ? <li className="py-4 text-slate-500">None yet.</li> : null}
          </ul>
        </PeopleCard>
      </div>
      <div className="mt-3">
        <PeopleCard>
          <h2 className="text-sm font-semibold text-slate-900">Trust flags (SEC + PLT)</h2>
          <p className="mt-1 text-xs text-slate-500">
            MFA for payroll-run users. Bank and national IDs are masked in the API. Billing stays on HQ Razorpay — not a second stack.
          </p>
          <label className="mt-3 flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={security.mfaRequiredForPayroll !== false}
              onChange={(e) => {
                const next = { ...security, mfaRequiredForPayroll: e.target.checked };
                setSecurity(next);
                void apiPutPeopleSecurity(next);
              }}
            />
            MFA required for payroll close
          </label>
          <label className="mt-2 flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={security.payrollModuleEnabled === true}
              onChange={(e) => {
                const next = { ...security, payrollModuleEnabled: e.target.checked };
                setSecurity(next);
                void apiPutPeopleSecurity(next);
              }}
            />
            Payroll module enabled (still blocked until attendance is locked)
          </label>
        </PeopleCard>
      </div>
    </Ph2ModulePageLayout>
  );
}
