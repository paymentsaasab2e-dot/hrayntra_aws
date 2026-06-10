'use client';

import React from 'react';
import {
  formatVaccinationValidityDisplay,
  normalizeVaccinationRecord,
  type CandidateVaccinationRecord,
} from '@/lib/candidateVaccinationFields';
import { phase1FieldLabelClass, phase1FieldValueClass } from '@/lib/phase1Typography';
import { formatDateDMY } from '@/utils/dateDisplay';
import { CandidateWorkExperienceDocumentsField } from './CandidateWorkExperienceDocumentsField';

function display(value: unknown): string {
  if (value === undefined || value === null) return '';
  return String(value).trim();
}

function FieldBlock({ label, value, hint }: { label: string; value: unknown; hint?: string }) {
  const text = display(value);
  if (!text) return null;
  return (
    <div>
      <p className={phase1FieldLabelClass}>{label}</p>
      <p className={`mt-1 whitespace-pre-line ${phase1FieldValueClass}`}>{text}</p>
      {hint ? <p className="mt-0.5 text-[11px] text-slate-400">{hint}</p> : null}
    </div>
  );
}

export function CandidateVaccinationEntryView({
  entry,
}: {
  entry: CandidateVaccinationRecord | Record<string, unknown>;
}) {
  const normalized = normalizeVaccinationRecord(entry);
  const documents = Array.isArray(normalized.documents) ? normalized.documents : [];
  const validityLabel = formatVaccinationValidityDisplay(
    normalized.validityMonth,
    normalized.validityYear,
  );

  return (
    <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-4">
      <div className="rounded-xl border border-slate-100 bg-slate-50/80 px-4 py-3">
        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Vaccination</p>
        <p className="mt-2 text-sm font-bold text-slate-900">
          {normalized.vaccineType || 'Vaccination details'}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <FieldBlock label="Vaccine Type" value={normalized.vaccineType} />
        <FieldBlock
          label="Last Vaccination Date"
          value={formatDateDMY(normalized.lastVaccinationDate)}
          hint="The date of your last vaccination."
        />
        <FieldBlock
          label="Validity of Vaccination"
          value={validityLabel}
          hint="Choose lifetime validity or set a custom month and year."
        />
        {normalized.validityMode === 'custom' ? (
          <>
            <FieldBlock
              label="Month"
              value={formatVaccinationValidityDisplay(normalized.validityMonth, '')}
            />
            <FieldBlock label="Year" value={normalized.validityYear} />
          </>
        ) : null}
      </div>

      {documents.length > 0 ? (
        <CandidateWorkExperienceDocumentsField
          documents={documents}
          readOnly
          hideWhenEmpty
          uploadLabel="Vaccination Certificates / Documents"
          readOnlyListLabel={`Uploaded documents (${documents.length})`}
        />
      ) : null}
    </div>
  );
}
