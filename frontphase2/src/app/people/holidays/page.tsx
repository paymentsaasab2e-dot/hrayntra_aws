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
  const [leaveTypes, setLeaveTypes] = useState<Array<{ id: string; code: string; name: string; country: string }>>([]);

  const load = async (id: string) => {
    if (!id) return;
    try {
      const [h, l] = await Promise.all([apiListHolidays(id), apiListLeaveTypes(id)]);
      const cal = h.data as { holidays?: Array<{ date: string; name: string }> };
      setHolidays(cal?.holidays || []);
      setLeaveTypes((l.data as any[]) || []);
    } catch (error: any) {
      toast.error(error?.message || 'Failed to load holidays');
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
          <ul className="mt-2 text-sm">
            {holidays.map((row) => (
              <li key={`${row.date}-${row.name}`} className="py-1">
                {row.date} · {row.name}
              </li>
            ))}
          </ul>
        </PeopleCard>
        <PeopleCard>
          <h2 className="text-sm font-semibold">Leave types</h2>
          <ul className="mt-2 text-sm">
            {leaveTypes.map((row) => (
              <li key={row.id} className="py-1">
                {row.code} · {row.name} · {row.country}
              </li>
            ))}
          </ul>
        </PeopleCard>
      </div>
    </Ph2ModulePageLayout>
  );
}
