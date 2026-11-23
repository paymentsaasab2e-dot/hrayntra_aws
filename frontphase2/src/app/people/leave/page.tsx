'use client';

import React, { useEffect, useState } from 'react';
import { ChevronDown, Cloud } from 'lucide-react';
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
  readableStatus,
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
    // Keep the current rows visible until the refreshed list arrives.
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

  const employeeName = (id: string) => {
    const person = employees.find((row) => row.id === id);
    const name = [person?.firstName, person?.lastName].filter(Boolean).join(' ');
    return name || 'Unknown employee';
  };

  const leaveName = (id: string) => types.find((row) => row.id === id)?.name || 'Leave';

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
            className={`${PH2_HEADER_PILL_PRIMARY} !w-auto !px-4`}
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
            Request leave
          </button>
        </PeopleFormRow>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th className="py-2 pr-4 text-left">Employee</th>
                <th className="px-4 py-2 text-left">Leave</th>
                <th className="px-4 py-2 text-left">Dates</th>
                <th className="px-4 py-2 text-right">Days</th>
                <th className="px-4 py-2 text-left">Status</th>
                <th className="py-2 pl-4 text-right" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-slate-100">
                  <td className="py-2 pr-4 text-left font-semibold text-slate-800">{employeeName(row.employeeId)}</td>
                  <td className="px-4 py-2 text-left text-slate-800">{leaveName(row.leaveTypeId)}</td>
                  <td className="whitespace-nowrap px-4 py-2 text-left text-slate-700">
                    {String(row.startDate).slice(0, 10)} to {String(row.endDate).slice(0, 10)}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums text-slate-800">{row.days}</td>
                  <td className="px-4 py-2 text-left text-slate-700">{readableStatus(row.status)}</td>
                  <td className="py-2 pl-4 text-right">
                    {row.status === 'PENDING' ? (
                      <details className="group inline-block text-left">
                        <summary className={`${PH2_HEADER_PILL} !w-auto cursor-pointer list-none !px-3 [&::-webkit-details-marker]:hidden`}>
                          More
                          <ChevronDown aria-hidden="true" className="h-3.5 w-3.5 transition-transform group-open:rotate-180" />
                        </summary>
                        <div className="mt-2 flex justify-end gap-2">
                          <button type="button" className={`${PH2_HEADER_PILL} !w-auto !px-3`} onClick={() => void apiDecideLeave(row.id, 'APPROVED').then(load)}>
                            Approve
                          </button>
                          <button type="button" className={`${PH2_HEADER_PILL} !w-auto !px-3`} onClick={() => void apiDecideLeave(row.id, 'REJECTED').then(load)}>
                            Reject
                          </button>
                        </div>
                      </details>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-4 text-xs font-semibold">Ledger (taken)</p>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th className="py-2 pr-4 text-left">Employee</th>
                <th className="px-4 py-2 text-left">Leave</th>
                <th className="px-4 py-2 text-right">Year</th>
                <th className="px-4 py-2 text-right">Taken</th>
                <th className="py-2 pl-4 text-right">Opening</th>
              </tr>
            </thead>
            <tbody>
              {balances.map((row) => (
                <tr key={row.id} className="border-b border-slate-100">
                  <td className="py-2 pr-4 text-left text-slate-800">{employeeName(row.employeeId)}</td>
                  <td className="px-4 py-2 text-left text-slate-800">{leaveName(row.leaveTypeId)}</td>
                  <td className="px-4 py-2 text-right tabular-nums text-slate-700">{row.year}</td>
                  <td className="px-4 py-2 text-right tabular-nums text-slate-800">{row.taken}</td>
                  <td className="py-2 pl-4 text-right tabular-nums text-slate-700">{row.opening}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </PeopleCard>
    </Ph2ModulePageLayout>
  );
}
