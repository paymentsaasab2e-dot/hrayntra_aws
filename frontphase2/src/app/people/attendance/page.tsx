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
  const [regDate, setRegDate] = useState(() => new Date().toISOString().slice(0, 10));
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
      <PeopleBanner text="Lock the month before payroll. Present, Absent, and Paid leave count weekdays only. Weekends are left out. Absent includes unpaid leave. Overtime hours are added on the punch." />
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
          <details className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs">
            <summary className="cursor-pointer font-semibold text-slate-700">More</summary>
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
          </details>
        </PeopleFormRow>
        <div className="mt-4 overflow-x-auto">
          <p className="mb-2 text-xs font-semibold text-slate-700">
            Punches for {employees.find((row) => row.id === employeeId) ? `${employees.find((row) => row.id === employeeId)?.firstName || ''} ${employees.find((row) => row.id === employeeId)?.lastName || ''}`.trim() : 'the selected employee'}
          </p>
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th className="py-2 pr-4 text-left">Date</th>
                <th className="px-4 py-2 text-left">Timezone</th>
                <th className="px-4 py-2 text-left">How</th>
                <th className="py-2 pl-4 text-right">Overtime hours</th>
              </tr>
            </thead>
            <tbody>
              {punches.map((row) => (
                <tr key={row.id} className="border-b border-slate-100">
                  <td className="py-2 pr-4 text-left text-slate-800">{row.localWorkDate}</td>
                  <td className="px-4 py-2 text-left text-slate-700">{row.timezone}</td>
                  <td className="px-4 py-2 text-left text-slate-700">{({ WEB: 'Web', HR_PROXY: 'Entered by HR', HALF_DAY: 'Half day' } as Record<string, string>)[row.source] || row.source}</td>
                  <td className="py-2 pl-4 text-right tabular-nums text-slate-800">{row.overtimeMinutes ? Math.round((row.overtimeMinutes / 60) * 10) / 10 : 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
          <h2 className="mb-3 text-sm font-semibold">Muster {muster.year}-{String(muster.month).padStart(2, '0')}</h2>
          <div className="overflow-x-auto">
            <table className="w-auto border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <th className="py-2 pr-8 text-left">Name</th>
                  <th className="px-4 py-2 text-right">Present</th>
                  <th className="px-4 py-2 text-right">Absent</th>
                  <th className="px-4 py-2 text-right">Paid leave</th>
                  <th className="py-2 pl-4 text-right">Overtime hours</th>
                </tr>
              </thead>
              <tbody>
                {muster.rows.map((row: any) => (
                  <tr key={row.employeeId} className="border-b border-slate-100">
                    <td className="py-2 pr-8 text-left text-slate-800">{row.name}</td>
                    <td className="px-4 py-2 text-right tabular-nums text-slate-800">{row.present}</td>
                    <td className="px-4 py-2 text-right tabular-nums text-slate-800">{row.absent}</td>
                    <td className="px-4 py-2 text-right tabular-nums text-slate-800">{row.leave}</td>
                    <td className="py-2 pl-4 text-right tabular-nums text-slate-800">{row.overtimeHours || 0}</td>
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
