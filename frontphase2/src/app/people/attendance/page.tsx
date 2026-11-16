'use client';

import React, { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';
import { toast } from 'sonner';
import {
  apiGetEmployees,
  apiListLegalEmployers,
  apiListPunches,
  apiLockAttendancePeriod,
  apiMuster,
  apiPunch,
  apiRegularise,
  type BackendEmployee,
  type LegalEmployer,
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

export default function AttendancePage() {
  const [employees, setEmployees] = useState<BackendEmployee[]>([]);
  const [employers, setEmployers] = useState<LegalEmployer[]>([]);
  const [employeeId, setEmployeeId] = useState('');
  const [legalEmployerId, setLegalEmployerId] = useState('');
  const [punches, setPunches] = useState<any[]>([]);
  const [muster, setMuster] = useState<any>(null);
  const [otHours, setOtHours] = useState('');
  const now = new Date();

  const load = async () => {
    const [emp, er] = await Promise.all([apiGetEmployees({ limit: 50 }), apiListLegalEmployers()]);
    setEmployees(emp.data?.data || []);
    setEmployers((er.data as LegalEmployer[]) || []);
    if (!employeeId && emp.data?.data?.[0]) setEmployeeId(emp.data.data[0].id);
    const employerId = legalEmployerId || (er.data as LegalEmployer[])?.[0]?.id || '';
    if (!legalEmployerId && employerId) setLegalEmployerId(employerId);
    if (employerId) {
      const res = await apiMuster(employerId, now.getFullYear(), now.getMonth() + 1);
      setMuster(res.data);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!employeeId) return;
    void apiListPunches(employeeId).then((res) => setPunches((res.data as any[]) || []));
  }, [employeeId]);

  const reloadMuster = async (id = legalEmployerId) => {
    if (!id) return;
    const res = await apiMuster(id, now.getFullYear(), now.getMonth() + 1);
    setMuster(res.data);
  };

  return (
    <Ph2ModulePageLayout title="Attendance" icon={<Clock className="h-5 w-5" />} subtitle="UTC punch, local work date, and overtime hours for the monthly close.">
      <PeopleBanner text="Lock the month before payroll. Muster: P present, A absent, L paid leave, U unpaid, H holiday, W weekend. Overtime hours are added on the punch and shown on the muster." />
      <PeopleCard>
        <PeopleFormRow>
          <select className={fieldClass} value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
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
                await apiPunch({ employeeId });
                toast.success('Punched');
                const res = await apiListPunches(employeeId);
                setPunches((res.data as any[]) || []);
                await reloadMuster();
              } catch (error: any) {
                toast.error(error?.message);
              }
            }}
          >
            Punch now
          </button>
          <button
            type="button"
            className={PH2_HEADER_PILL}
            onClick={async () => {
              try {
                await apiPunch({ employeeId, proxy: true });
                toast.success('HR proxy punch');
                const res = await apiListPunches(employeeId);
                setPunches((res.data as any[]) || []);
                await reloadMuster();
              } catch (error: any) {
                toast.error(error?.message);
              }
            }}
          >
            HR proxy
          </button>
          <input
            className={fieldClass}
            inputMode="decimal"
            placeholder="OT hours"
            value={otHours}
            onChange={(e) => setOtHours(e.target.value)}
          />
          <button
            type="button"
            className={PH2_HEADER_PILL}
            onClick={async () => {
              try {
                const hours = Number(otHours);
                if (!Number.isFinite(hours) || hours <= 0) {
                  toast.error('Enter overtime hours');
                  return;
                }
                const optimistic = {
                  id: `local-${Date.now()}`,
                  localWorkDate: new Date().toISOString().slice(0, 10),
                  timezone: 'saving',
                  source: 'OT',
                  overtimeMinutes: Math.round(hours * 60),
                };
                setPunches((current) => [optimistic, ...current]);
                await apiPunch({ employeeId, overtimeMinutes: Math.round(hours * 60) });
                toast.success('Overtime saved');
                const res = await apiListPunches(employeeId);
                setPunches((res.data as any[]) || []);
                await reloadMuster();
                setOtHours('');
              } catch (error: any) {
                toast.error(error?.message);
                const res = await apiListPunches(employeeId);
                setPunches((res.data as any[]) || []);
              }
            }}
          >
            Add OT
          </button>
          <button
            type="button"
            className={PH2_HEADER_PILL}
            onClick={async () => {
              try {
                await apiPunch({ employeeId, source: 'HALF_DAY' });
                toast.success('Half-day');
                const res = await apiListPunches(employeeId);
                setPunches((res.data as any[]) || []);
                await reloadMuster();
              } catch (error: any) {
                toast.error(error?.message);
              }
            }}
          >
            Half-day
          </button>
        </PeopleFormRow>
        <ul className="mt-3 text-xs">
          {punches.map((row) => (
            <li key={row.id} className="py-1">
              {row.localWorkDate} · {row.timezone} · {row.source}
              {row.overtimeMinutes ? ` · OT ${Math.round((row.overtimeMinutes / 60) * 10) / 10}h` : ''}
            </li>
          ))}
        </ul>
        <PeopleFormRow>
          <input className={fieldClass} type="date" value={regDate} onChange={(e) => setRegDate(e.target.value)} />
          <button
            type="button"
            className={PH2_HEADER_PILL}
            onClick={async () => {
              try {
                await apiRegularise({ employeeId, localWorkDate: regDate });
                toast.success('Regularisation sent to inbox');
              } catch (error: any) {
                toast.error(error?.message);
              }
            }}
          >
            Request regularisation
          </button>
        </PeopleFormRow>
        <PeopleFormRow>
          <select
            className={fieldClass}
            value={legalEmployerId}
            onChange={(e) => {
              setLegalEmployerId(e.target.value);
              void reloadMuster(e.target.value);
            }}
          >
            {employers.map((row) => (
              <option key={row.id} value={row.id}>
                {row.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            className={PH2_HEADER_PILL}
            onClick={async () => {
              try {
                await apiLockAttendancePeriod(legalEmployerId, now.getFullYear(), now.getMonth() + 1);
                toast.success('Period locked');
              } catch (error: any) {
                toast.error(error?.message);
              }
            }}
          >
            Lock this month
          </button>
        </PeopleFormRow>
      </PeopleCard>
      {muster?.rows?.length ? (
        <PeopleCard>
          <h2 className="mb-2 text-sm font-semibold">Muster {muster.year}-{String(muster.month).padStart(2, '0')}</h2>
          <div className="overflow-x-auto text-[11px]">
            <table className="min-w-full">
              <thead>
                <tr>
                  <th className="px-1 text-left">Name</th>
                  <th className="px-1">P</th>
                  <th className="px-1">A/U</th>
                  <th className="px-1">L</th>
                  <th className="px-1">OT h</th>
                </tr>
              </thead>
              <tbody>
                {muster.rows.map((row: any) => (
                  <tr key={row.employeeId}>
                    <td className="px-1 py-1">{row.name}</td>
                    <td className="px-1">{row.present}</td>
                    <td className="px-1">{row.absent}</td>
                    <td className="px-1">{row.leave}</td>
                    <td className="px-1">{row.overtimeHours || 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </PeopleCard>
      ) : null}
    </Ph2ModulePageLayout>
  );
}
