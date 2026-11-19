'use client';

import React, { useEffect, useState } from 'react';
import { FileText } from 'lucide-react';
import { toast } from 'sonner';
import { apiGetEmployees, apiIssueLetter, apiListLetters, type BackendEmployee } from '../../../lib/api';
import { getCountryPack } from '../../../lib/peoplecore/countryPacks';
import {
  PeopleBanner,
  PeopleCard,
  PeopleFormRow,
  Ph2ModulePageLayout,
  PH2_HEADER_PILL_PRIMARY,
  fieldClass,
} from '../_components/PeopleModule';

export default function LettersPage() {
  const [employees, setEmployees] = useState<BackendEmployee[]>([]);
  const [letters, setLetters] = useState<any[]>([]);
  const [employeeId, setEmployeeId] = useState('');
  const [letterType, setLetterType] = useState('');
  const employee = employees.find((row) => row.id === employeeId);
  const pack = getCountryPack(employee?.legalEmployerCountry);

  const load = async () => {
    // Keep the current rows visible until the refreshed list arrives.
    const [emp, list] = await Promise.all([apiGetEmployees({ limit: 50 }), apiListLetters()]);
    setEmployees(emp.data?.data || []);
    setLetters((list.data as any[]) || []);
  };

  useEffect(() => {
    void load();
  }, []);

  return (
    <Ph2ModulePageLayout title="Letters" icon={<FileText className="h-5 w-5" />} subtitle="Templates and language come from the country pack.">
      <PeopleBanner text="Cameroon: contrat / avenant / certificat de travail. India: appointment / relieving / experience. Relieving is blocked while assets are Allocated." />
      <PeopleCard>
        <PeopleFormRow>
          <select className={fieldClass} value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
            <option value="">Employee</option>
            {employees.map((row) => (
              <option key={row.id} value={row.id}>
                {row.firstName} {row.lastName} ({row.legalEmployerCountry})
              </option>
            ))}
          </select>
          <select className={fieldClass} value={letterType} onChange={(e) => setLetterType(e.target.value)}>
            <option value="">Letter</option>
            {(pack?.letterTypes || []).map((row) => (
              <option key={row.id} value={row.id}>
                {row.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            className={`${PH2_HEADER_PILL_PRIMARY} !w-auto !px-4`}
            onClick={async () => {
              try {
                await apiIssueLetter({ employeeId, letterType });
                toast.success('Letter issued');
                await load();
              } catch (error: any) {
                toast.error(error?.message);
              }
            }}
          >
            Issue letter
          </button>
        </PeopleFormRow>
        <ul className="mt-3 text-sm">
          {letters.map((row) => (
            <li key={row.id} className="py-2">
              {row.serial} · {row.letterType} · {row.language}
            </li>
          ))}
        </ul>
      </PeopleCard>
    </Ph2ModulePageLayout>
  );
}
