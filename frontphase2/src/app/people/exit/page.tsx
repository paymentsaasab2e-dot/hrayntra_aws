'use client';

import React, { useEffect, useState } from 'react';
import { ChevronDown, LogOut } from 'lucide-react';
import { toast } from 'sonner';
import {
  apiCompleteExit,
  apiCreateExit,
  apiGetEmployees,
  apiListExits,
  apiSaveFnf,
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

export default function ExitPage() {
  const [employees, setEmployees] = useState<BackendEmployee[]>([]);
  const [exits, setExits] = useState<any[]>([]);
  const [employeeId, setEmployeeId] = useState('');
  const [encash, setEncash] = useState('0');
  const [notice, setNotice] = useState('0');
  const [recovery, setRecovery] = useState('0');

  const load = async () => {
    // Keep the current rows visible until the refreshed list arrives.
    const [emp, list] = await Promise.all([apiGetEmployees({ limit: 50 }), apiListExits()]);
    setEmployees(emp.data?.data || []);
    setExits((list.data as any[]) || []);
  };

  useEffect(() => {
    void load();
  }, []);

  return (
    <Ph2ModulePageLayout title="Exit" icon={<LogOut className="h-5 w-5" />} subtitle="Clearance first. Money is a worksheet, not a payslip.">
      <PeopleBanner text="Relieving letters stay blocked while assets are Allocated. FnF here is inputs only (leave encashment, notice recovery, asset recovery)." />
      <PeopleCard>
        <PeopleFormRow>
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
                await apiCreateExit({ employeeId, kind: 'RESIGNATION' });
                toast.success('Exit opened');
                await load();
              } catch (error: any) {
                toast.error(error?.message);
              }
            }}
          >
            Open exit
          </button>
          <input className={fieldClass} placeholder="Encash days" value={encash} onChange={(e) => setEncash(e.target.value)} />
          <input className={fieldClass} placeholder="Notice recovery" value={notice} onChange={(e) => setNotice(e.target.value)} />
          <input className={fieldClass} placeholder="Asset recovery" value={recovery} onChange={(e) => setRecovery(e.target.value)} />
        </PeopleFormRow>
        <ul className="mt-3 text-sm">
          {exits.map((row) => (
            <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <span>
                {row.kind} · {row.status}
              </span>
              <details className="group shrink-0">
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
                        await apiSaveFnf({
                          exitCaseId: row.id,
                          employeeId: row.employeeId,
                          leaveEncashmentDays: Number(encash),
                          noticeRecoveryDays: Number(notice),
                          assetRecoveryAmount: Number(recovery),
                        });
                        toast.success('FnF worksheet saved (no money calculated)');
                      } catch (error: any) {
                        toast.error(error?.message);
                      }
                    }}
                  >
                    FnF worksheet
                  </button>
                  <button
                    type="button"
                    className={`${PH2_HEADER_PILL} !w-auto !px-3`}
                    onClick={async () => {
                      try {
                        await apiCompleteExit(row.id, {});
                        toast.success('Cleared');
                        await load();
                      } catch (error: any) {
                        toast.error(error?.message);
                      }
                    }}
                  >
                    Complete
                  </button>
                </div>
              </details>
            </li>
          ))}
        </ul>
      </PeopleCard>
    </Ph2ModulePageLayout>
  );
}
