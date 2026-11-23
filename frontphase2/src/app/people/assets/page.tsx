'use client';

import React, { useEffect, useState } from 'react';
import { Briefcase, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import {
  apiAssignAsset,
  apiCreateAsset,
  apiGetEmployees,
  apiListAssetAssignments,
  apiListAssets,
  apiReturnAsset,
  type BackendEmployee,
} from '../../../lib/api';
import {
  PeopleBanner,
  PeopleCard,
  PeopleFormRow,
  Ph2ModulePageLayout,
  PH2_HEADER_PILL,
  PH2_HEADER_PILL_PRIMARY,
  employeeDisplayName,
  fieldClass,
} from '../_components/PeopleModule';

export default function AssetsPage() {
  const [assets, setAssets] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [employees, setEmployees] = useState<BackendEmployee[]>([]);
  const [serial, setSerial] = useState('');
  const [name, setName] = useState('');
  const [assetId, setAssetId] = useState('');
  const [employeeId, setEmployeeId] = useState('');

  const load = async () => {
    // Keep the current rows visible until the refreshed list arrives.
    const [a, e, asg] = await Promise.all([
      apiListAssets(),
      apiGetEmployees({ limit: 50 }),
      apiListAssetAssignments(),
    ]);
    setAssets((a.data as any[]) || []);
    setEmployees(e.data?.data || []);
    setAssignments((asg.data as any[]) || []);
  };

  useEffect(() => {
    void load();
  }, []);

  return (
    <Ph2ModulePageLayout title="Assets" icon={<Briefcase className="h-5 w-5" />} subtitle="Serial, assign, return. Exit cannot complete while Allocated.">
      <PeopleBanner text="Recovery value is a proposed amount. Whether payroll may deduct it is a country-pack decision in Phase 4." />
      <PeopleCard>
        <PeopleFormRow>
          <select className={fieldClass} value={assetId} onChange={(e) => setAssetId(e.target.value)}>
            <option value="">Asset</option>
            {assets.map((row) => (
              <option key={row.id} value={row.id}>
                {row.serial} · {row.name} · {row.status}
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
            className={`${PH2_HEADER_PILL_PRIMARY} !w-auto !px-4`}
            onClick={async () => {
              try {
                await apiAssignAsset({ assetId, employeeId });
                toast.success('Allocated');
                await load();
              } catch (error: any) {
                toast.error(error?.message);
              }
            }}
          >
            Assign
          </button>
          <details className="group">
            <summary className={`${PH2_HEADER_PILL} !w-auto cursor-pointer list-none !px-3 [&::-webkit-details-marker]:hidden`}>
              More
              <ChevronDown aria-hidden="true" className="h-3.5 w-3.5 transition-transform group-open:rotate-180" />
            </summary>
            <div className="mt-2 flex w-full flex-wrap items-end gap-2">
              <input className={fieldClass} placeholder="Serial" value={serial} onChange={(e) => setSerial(e.target.value)} />
              <input className={fieldClass} placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
              <button
                type="button"
                className={`${PH2_HEADER_PILL} !w-auto !px-3`}
                onClick={async () => {
                  await apiCreateAsset({ serial, name });
                  setSerial('');
                  setName('');
                  await load();
                }}
              >
                Add
              </button>
            </div>
          </details>
        </PeopleFormRow>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th className="py-2 pr-4 text-left">Asset</th>
                <th className="px-4 py-2 text-left">Employee</th>
                <th className="px-4 py-2 text-left">Status</th>
                <th className="py-2 pl-4 text-right" />
              </tr>
            </thead>
            <tbody>
          {assignments.map((row) => {
            const asset = assets.find((item) => item.id === row.assetId);
            return (
            <tr key={row.id} className="border-b border-slate-100">
              <td className="py-2 pr-4 text-left font-semibold text-slate-800">{asset ? `${asset.name} · ${asset.serial}` : 'Asset'}</td>
              <td className="px-4 py-2 text-left text-slate-800">{employeeDisplayName(employees, row.employeeId)}</td>
              <td className="px-4 py-2 text-left text-slate-700">{row.returnedAt ? 'Returned' : 'With the employee'}</td>
              <td className="py-2 pl-4 text-right">
              {!row.returnedAt ? (
                <details className="group inline-block text-left">
                  <summary className={`${PH2_HEADER_PILL} !w-auto cursor-pointer list-none !px-3 [&::-webkit-details-marker]:hidden`}>
                    More
                    <ChevronDown aria-hidden="true" className="h-3.5 w-3.5 transition-transform group-open:rotate-180" />
                  </summary>
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      className={`${PH2_HEADER_PILL} !w-auto !px-3`}
                      onClick={async () => {
                        try {
                          await apiReturnAsset(row.id, 'GOOD');
                          toast.success('Returned');
                          await load();
                        } catch (error: any) {
                          toast.error(error?.message);
                        }
                      }}
                    >
                      Return
                    </button>
                  </div>
                </details>
              ) : null}
              </td>
            </tr>
            );
          })}
            </tbody>
          </table>
        </div>
      </PeopleCard>
    </Ph2ModulePageLayout>
  );
}
