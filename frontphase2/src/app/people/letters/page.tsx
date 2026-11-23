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
  employeeDisplayName,
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
        <div className="mt-4 overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th className="py-2 pr-4 text-left">Employee</th>
                <th className="px-4 py-2 text-left">Letter</th>
                <th className="py-2 pl-4 text-left">Number</th>
              </tr>
            </thead>
            <tbody>
              {letters.map((row) => (
                <tr key={row.id} className="border-b border-slate-100">
                  <td className="py-2 pr-4 text-left font-semibold text-slate-800">{employeeDisplayName(employees, row.employeeId)}</td>
                  <td className="px-4 py-2 text-left text-slate-800">
                    {({
                      contrat_de_travail: 'Employment contract',
                      avenant: 'Amendment',
                      certificat_de_travail: 'Work certificate',
                      offer: 'Offer',
                      appointment: 'Appointment',
                      relieving: 'Relieving',
                      experience: 'Experience',
                      employment_certificate: 'Employment certificate',
                      exit_letter: 'Exit letter',
                    } as Record<string, string>)[row.letterType] || row.letterType}
                  </td>
                  <td className="py-2 pl-4 text-left text-slate-700">{row.serial}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </PeopleCard>
    </Ph2ModulePageLayout>
  );
}
