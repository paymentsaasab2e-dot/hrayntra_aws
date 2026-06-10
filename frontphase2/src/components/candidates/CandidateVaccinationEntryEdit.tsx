'use client';

import React, { useMemo } from 'react';
import { CandidateWorkExperienceDocumentsField } from './CandidateWorkExperienceDocumentsField';
import {
  normalizeVaccinationRecord,
  VACCINATION_MONTH_OPTIONS,
  type VaccinationValidityMode,
} from '@/lib/candidateVaccinationFields';
import { phase1FieldLabelClass, phase1FieldValueClass, phase1SectionTitleClass } from '@/lib/phase1Typography';
import { EditDateField } from './EditDateField';

const inputClass = `w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 ${phase1FieldValueClass}`;
const selectClass = `${inputClass} appearance-none`;

function SectionHeading({ children }: { children: React.ReactNode }) {
  return <h4 className={`${phase1SectionTitleClass} border-b border-slate-200 pb-2`}>{children}</h4>;
}

function FieldLabel({ label, hint }: { label: string; hint?: string }) {
  return (
    <div className="mb-1.5">
      <span className={phase1FieldLabelClass}>{label}</span>
      {hint ? <p className="mt-0.5 text-[11px] text-slate-400">{hint}</p> : null}
    </div>
  );
}

export function CandidateVaccinationEntryEdit({
  candidateId,
  entry,
  birthDateMax,
  onChange,
}: {
  candidateId?: string;
  entry: Record<string, unknown>;
  birthDateMax?: string;
  onChange: (patch: Record<string, unknown>) => void;
}) {
  const normalized = useMemo(() => normalizeVaccinationRecord(entry), [entry]);
  const documents = Array.isArray(normalized.documents) ? normalized.documents : [];
  const validityMode = normalized.validityMode || 'lifetime';

  const yearOptions = useMemo(() => {
    const startYear = new Date().getFullYear();
    return Array.from({ length: 20 }, (_, index) => String(startYear + index));
  }, []);

  const patch = (patchValue: Record<string, unknown>) => {
    onChange({ ...normalized, ...patchValue });
  };

  const setValidityMode = (mode: VaccinationValidityMode) => {
    if (mode === 'lifetime') {
      patch({
        validityMode: 'lifetime',
        validityMonth: 'LIFETIME',
        validityYear: '',
      });
      return;
    }
    patch({
      validityMode: 'custom',
      validityMonth: normalized.validityMonth === 'LIFETIME' ? '' : normalized.validityMonth || '',
      validityYear: normalized.validityYear || '',
    });
  };

  return (
    <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-4">
      <label className="block">
        <FieldLabel label="Vaccine Type" />
        <input
          value={normalized.vaccineType || ''}
          onChange={(e) => patch({ vaccineType: e.target.value })}
          placeholder="eg. Yellow Fever"
          className={inputClass}
        />
      </label>

      <div>
        <EditDateField
          label="Last Vaccination Date"
          value={normalized.lastVaccinationDate || ''}
          outputIso
          max={birthDateMax}
          onChange={(value) => patch({ lastVaccinationDate: value })}
        />
        <p className="mt-1 text-[11px] text-slate-400">The date of your last vaccination.</p>
      </div>

      <div className="space-y-3 border-t border-slate-100 pt-4">
        <SectionHeading>Validity of Vaccination</SectionHeading>
        <label className="block">
          <FieldLabel label="Validity" />
          <select
            value={validityMode}
            onChange={(e) => setValidityMode(e.target.value as VaccinationValidityMode)}
            className={selectClass}
          >
            <option value="lifetime">Lifetime</option>
            <option value="custom">Custom validity</option>
          </select>
        </label>

        {validityMode === 'custom' ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <FieldLabel label="Month" />
              <select
                value={normalized.validityMonth === 'LIFETIME' ? '' : normalized.validityMonth || ''}
                onChange={(e) => patch({ validityMode: 'custom', validityMonth: e.target.value })}
                className={selectClass}
              >
                <option value="">Select Month</option>
                {VACCINATION_MONTH_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <FieldLabel label="Year" />
              <select
                value={normalized.validityYear || ''}
                onChange={(e) => patch({ validityMode: 'custom', validityYear: e.target.value })}
                className={selectClass}
              >
                <option value="">Select Year</option>
                {yearOptions.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </label>
          </div>
        ) : null}

        <p className="text-[11px] text-slate-400">
          Choose lifetime validity or set a custom month and year.
        </p>
      </div>

      <div className="space-y-3 border-t border-slate-100 pt-4">
        <CandidateWorkExperienceDocumentsField
          candidateId={candidateId}
          documents={documents}
          onChange={(nextDocuments) => patch({ documents: nextDocuments })}
          uploadLabel="Vaccination Certificates / Documents"
          readOnlyListLabel={
            documents.length
              ? `Uploaded documents (${documents.length})`
              : 'Vaccination Certificates / Documents'
          }
          uploadCategory="Vaccination Certificate"
        />
        <p className="text-[11px] text-slate-400">
          Optional. Upload one or more certificates if required by the employer.
        </p>
      </div>
    </div>
  );
}
