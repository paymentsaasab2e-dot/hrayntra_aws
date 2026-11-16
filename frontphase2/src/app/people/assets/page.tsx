'use client';

import React, { useEffect, useState } from 'react';
import { Briefcase } from 'lucide-react';
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
          <input className={fieldClass} placeholder="Serial" value={serial} onChange={(e) => setSerial(e.target.value)} />
          <input className={fieldClass} placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
          <button
            type="button"
            className={PH2_HEADER_PILL_PRIMARY}
            onClick={async () => {
              await apiCreateAsset({ serial, name });
              setSerial('');
              setName('');
              await load();
            }}
          >
            Add
          </button>
        </PeopleFormRow>
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
            className={PH2_HEADER_PILL_PRIMARY}
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
        </PeopleFormRow>
        <ul className="mt-3 text-sm">
          {assignments.map((row) => (
            <li key={row.id} className="flex items-center justify-between py-2">
              <span>
                {row.assetId} · {row.returnedAt ? 'Returned' : 'Allocated'} · {row.employeeId}
              </span>
              {!row.returnedAt ? (
                <button
                  type="button"
                  className={PH2_HEADER_PILL}
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
              ) : null}
            </li>
          ))}
        </ul>
      </PeopleCard>
    </Ph2ModulePageLayout>
  );
}
