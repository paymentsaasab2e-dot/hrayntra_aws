'use client';

import React, { useEffect, useState } from 'react';
import { Cloud } from 'lucide-react';
import { toast } from 'sonner';
import {
  apiApplyLeave,
  apiDecideLeave,
  apiGetEmployees,
  apiListLeave,
  apiListLeaveBalances,
  apiListLeaveTypes,
  apiListLegalEmployers,
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

export default function LeavePage() {
  const [employees, setEmployees] = useState<BackendEmployee[]>([]);
  const [types, setTypes] = useState<any[]>([]);
  const [rows, setRows] = useState<any[]>([]);
  const [balances, setBalances] = useState<any[]>([]);
  const [employeeId, setEmployeeId] = useState('');
  const [leaveTypeId, setLeaveTypeId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const load = async () => {
    const [emp, er, list] = await Promise.all([
      apiGetEmployees({ limit: 50 }),
      apiListLegalEmployers(),
      apiListLeave(),
    ]);
    setEmployees(emp.data?.data || []);
    setRows((list.data as any[]) || []);
    const bal = await apiListLeaveBalances();
    setBalances((bal.data as any[]) || []);
    const employerId = (er.data as any[])?.[0]?.id;
    if (employerId) {
      const t = await apiListLeaveTypes(employerId);
      setTypes((t.data as any[]) || []);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  return (
    <Ph2ModulePageLayout title="Leave" icon={<Cloud className="h-5 w-5" />} subtitle="Apply / approve / ledger. Types come from the legal employer pack.">
      <PeopleBanner text="Do not seed CL/SL/EL onto Cameroon. Auto unpaid after cut-off is a later leave-year job; this slice stores the request and ledger." />
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
          <select className={fieldClass} value={leaveTypeId} onChange={(e) => setLeaveTypeId(e.target.value)}>
            <option value="">Leave type</option>
            {types.map((row) => (
              <option key={row.id} value={row.id}>
                {row.name} ({row.country})
              </option>
            ))}
          </select>
          <input className={fieldClass} type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          <input className={fieldClass} type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          <button
            type="button"
            className={PH2_HEADER_PILL_PRIMARY}
            onClick={async () => {
              try {
                await apiApplyLeave({ employeeId, leaveTypeId, startDate, endDate });
                toast.success('Leave requested');
                await load();
              } catch (error: any) {
                toast.error(error?.message);
              }
            }}
          >
            Apply
          </button>
        </PeopleFormRow>
        <ul className="mt-3 text-sm">
          {rows.map((row) => (
            <li key={row.id} className="flex items-center justify-between py-2">
              <span>
                {String(row.startDate).slice(0, 10)} → {String(row.endDate).slice(0, 10)} · {row.days}d · {row.status}
              </span>
              {row.status === 'PENDING' ? (
                <span className="flex gap-2">
                  <button type="button" className={PH2_HEADER_PILL} onClick={() => void apiDecideLeave(row.id, 'APPROVED').then(load)}>
                    Approve
                  </button>
                  <button type="button" className={PH2_HEADER_PILL} onClick={() => void apiDecideLeave(row.id, 'REJECTED').then(load)}>
                    Reject
                  </button>
                </span>
              ) : null}
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs font-semibold">Ledger (taken)</p>
        <ul className="text-xs">
          {balances.map((row) => (
            <li key={row.id} className="py-1">
              {row.year} · taken {row.taken} · opening {row.opening}
            </li>
          ))}
        </ul>
      </PeopleCard>
    </Ph2ModulePageLayout>
  );
}
