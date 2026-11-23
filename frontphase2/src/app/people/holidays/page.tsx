'use client';

import React, { useEffect, useState } from 'react';
import { CalendarDays } from 'lucide-react';
import { toast } from 'sonner';
import { apiListHolidays, apiListLeaveTypes, apiListLegalEmployers, type LegalEmployer } from '../../../lib/api';
import { PeopleBanner, PeopleCard, Ph2ModulePageLayout, fieldClass } from '../_components/PeopleModule';

export default function HolidaysPage() {
  const [employers, setEmployers] = useState<LegalEmployer[]>([]);
  const [legalEmployerId, setLegalEmployerId] = useState('');
  const [holidays, setHolidays] = useState<Array<{ date: string; name: string }>>([]);
  const [holidaysReady, setHolidaysReady] = useState(false);
  const [leaveTypes, setLeaveTypes] = useState<Array<{ id: string; code: string; name: string; country: string }>>([]);

  const load = async (id: string) => {
    if (!id) return;
    // Keep the current holiday and leave-type lists visible until the refreshed data arrives.
    try {
      const [h, l] = await Promise.all([apiListHolidays(id), apiListLeaveTypes(id)]);
      const cal = h.data as { holidays?: Array<{ date: string; name: string }> };
      setHolidays(cal?.holidays || []);
      setLeaveTypes((l.data as any[]) || []);
    } catch (error: any) {
      toast.error(error?.message || 'Failed to load holidays');
    } finally {
      setHolidaysReady(true);
    }
  };

  useEffect(() => {
    void (async () => {
      const emp = await apiListLegalEmployers();
      const list = (emp.data as LegalEmployer[]) || [];
      setEmployers(list);
      const id = list[0]?.id || '';
      setLegalEmployerId(id);
      await load(id);
    })();
  }, []);

  return (
    <Ph2ModulePageLayout title="Holidays and leave types" icon={<CalendarDays className="h-5 w-5" />} subtitle="Seeded from the country pack. Balances and apply come in attendance/leave.">
      <PeopleBanner text="Cameroon leave types are Congé annuel / Maladie / Maternité — not CL/SL/EL. India pack keeps CL/SL/EL." />
      <select
        className={`${fieldClass} mb-3`}
        value={legalEmployerId}
        onChange={(e) => {
          setLegalEmployerId(e.target.value);
          void load(e.target.value);
        }}
      >
        {employers.map((row) => (
          <option key={row.id} value={row.id}>
            {row.name} ({row.country})
          </option>
        ))}
      </select>
      <div className="grid gap-3 lg:grid-cols-2">
        <PeopleCard>
          <h2 className="text-sm font-semibold">Holidays</h2>
          <table className="mt-2 w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th className="py-2 pr-4 text-left">Date</th>
                <th className="py-2 pl-4 text-left">Holiday</th>
              </tr>
            </thead>
            <tbody>
            {holidays.map((row) => (
              <tr key={`${row.date}-${row.name}`} className="border-b border-slate-100">
                <td className="py-2 pr-4 text-left text-slate-800">{row.date}</td>
                <td className="py-2 pl-4 text-left text-slate-800">{row.name}</td>
              </tr>
            ))}
            </tbody>
          </table>
          {holidaysReady && holidays.length === 0 ? <p className="py-2 text-sm text-slate-500">No holidays for this country yet.</p> : null}
        </PeopleCard>
        <PeopleCard>
          <h2 className="text-sm font-semibold">Leave types</h2>
          <table className="mt-2 w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th className="py-2 pr-4 text-left">Leave</th>
                <th className="px-4 py-2 text-left">Paid</th>
                <th className="py-2 pl-4 text-left">Country</th>
              </tr>
            </thead>
            <tbody>
            {leaveTypes.map((row) => (
              <tr key={row.id} className="border-b border-slate-100">
                <td className="py-2 pr-4 text-left font-semibold text-slate-800">{row.name}</td>
                <td className="px-4 py-2 text-left text-slate-700">{(row as { paid?: boolean }).paid === false ? 'Unpaid' : 'Paid'}</td>
                <td className="py-2 pl-4 text-left text-slate-700">{row.country}</td>
              </tr>
            ))}
            </tbody>
          </table>
        </PeopleCard>
      </div>
    </Ph2ModulePageLayout>
  );
}
