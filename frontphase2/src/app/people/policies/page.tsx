'use client';

import React, { useEffect, useState } from 'react';
import { ChevronDown, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { apiGetEmployees, apiListHrPolicies, apiPublishHrPolicy, apiAckHrPolicy, type BackendEmployee } from '../../../lib/api';
import { listCountryPacks } from '../../../lib/peoplecore/countryPacks';
import {
  PeopleBanner,
  PeopleCard,
  PeopleFormRow,
  Ph2ModulePageLayout,
  PH2_HEADER_PILL,
  PH2_HEADER_PILL_PRIMARY,
  fieldClass,
} from '../_components/PeopleModule';

export default function PoliciesPage() {
  const [policies, setPolicies] = useState<any[]>([]);
  const [employees, setEmployees] = useState<BackendEmployee[]>([]);
  const [title, setTitle] = useState('Workplace conduct');
  const [body, setBody] = useState('');
  const [country, setCountry] = useState('CM');
  const [employeeId, setEmployeeId] = useState('');
  const [policyId, setPolicyId] = useState('');

  const load = async () => {
    // Keep the current rows visible until the refreshed list arrives.
    const [p, e] = await Promise.all([apiListHrPolicies(), apiGetEmployees({ limit: 50 })]);
    setPolicies((p.data as any[]) || []);
    setEmployees(e.data?.data || []);
  };

  useEffect(() => {
    void load();
  }, []);

  return (
    <Ph2ModulePageLayout title="Policies" icon={<ShieldCheck className="h-5 w-5" />} subtitle="Versioned acknowledgement. POSH Internal Committee is India-pack only.">
      <PeopleBanner text="Every country needs a workplace-conduct policy. India POSH IC is not copied onto Cameroon." />
      <PeopleCard>
        <PeopleFormRow>
          <input className={fieldClass} value={title} onChange={(e) => setTitle(e.target.value)} />
          <select className={fieldClass} value={country} onChange={(e) => setCountry(e.target.value)}>
            {listCountryPacks().map((row) => (
              <option key={row.iso} value={row.iso}>
                {row.name}
              </option>
            ))}
          </select>
          <input className={`${fieldClass} min-w-[220px]`} placeholder="Policy body" value={body} onChange={(e) => setBody(e.target.value)} />
          <button
            type="button"
            className={`${PH2_HEADER_PILL_PRIMARY} !w-auto !px-4`}
            onClick={async () => {
              try {
                await apiPublishHrPolicy({ title, body, country });
                toast.success('Published (new version)');
                await load();
              } catch (error: any) {
                toast.error(error?.message);
              }
            }}
          >
            Publish
          </button>
        </PeopleFormRow>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th className="py-2 pr-4 text-left">Policy</th>
                <th className="px-4 py-2 text-right">Version</th>
                <th className="py-2 pl-4 text-left">Country</th>
              </tr>
            </thead>
            <tbody>
          {policies.map((row) => (
            <tr key={row.id} className="border-b border-slate-100">
              <td className="py-2 pr-4 text-left font-semibold text-slate-800">{row.title}</td>
              <td className="px-4 py-2 text-right tabular-nums text-slate-800">{row.version}</td>
              <td className="py-2 pl-4 text-left text-slate-700">{row.country || 'All countries'}</td>
            </tr>
          ))}
            </tbody>
          </table>
        </div>
        <details className="group mt-3">
          <summary className={`${PH2_HEADER_PILL} !w-auto cursor-pointer list-none !px-3 [&::-webkit-details-marker]:hidden`}>
            More
            <ChevronDown aria-hidden="true" className="h-3.5 w-3.5 transition-transform group-open:rotate-180" />
          </summary>
          <PeopleFormRow>
            <select className={fieldClass} value={policyId} onChange={(e) => setPolicyId(e.target.value)}>
              <option value="">Policy</option>
              {policies.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.title} v{row.version}
                </option>
              ))}
            </select>
            <select className={fieldClass} value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
              <option value="">Employee</option>
              {employees.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.firstName} {row.lastName}
                </option>
              ))}
            </select>
            <button
              type="button"
              className={`${PH2_HEADER_PILL} !w-auto !px-3`}
              onClick={async () => {
                await apiAckHrPolicy({ policyId, employeeId });
                toast.success('Acknowledged');
              }}
            >
              Acknowledge
            </button>
          </PeopleFormRow>
        </details>
      </PeopleCard>
    </Ph2ModulePageLayout>
  );
}
