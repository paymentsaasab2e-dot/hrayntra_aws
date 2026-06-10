'use client';

import React from 'react';
import {
  countryDisplayName,
  normalizeVisaEntryRecord,
  type CandidateVisaEntryRecord,
} from '@/lib/candidateVisaWorkAuthorizationFields';
import { phase1FieldLabelClass, phase1FieldValueClass } from '@/lib/phase1Typography';
import { formatDateDMY } from '@/utils/dateDisplay';
import { CandidateWorkExperienceDocumentsField } from './CandidateWorkExperienceDocumentsField';

function display(value: unknown): string {
  if (value === undefined || value === null) return '';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return String(value).trim();
}

function FieldBlock({ label, value }: { label: string; value: unknown }) {
  const text = display(value);
  if (!text) return null;
  return (
    <div>
      <p className={phase1FieldLabelClass}>{label}</p>
      <p className={`mt-1 whitespace-pre-line ${phase1FieldValueClass}`}>{text}</p>
    </div>
  );
}

export function CandidateVisaWorkAuthorizationEntryView({
  entry,
  index,
}: {
  entry: CandidateVisaEntryRecord | Record<string, unknown>;
  index: number;
}) {
  const normalized = normalizeVisaEntryRecord(entry);
  const documents = Array.isArray(normalized.documents) ? normalized.documents : [];
  const countryLabel =
    normalized.countryName ||
    countryDisplayName(normalized.country) ||
    `Country authorization ${index + 1}`;

  return (
    <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-4">
      <div className="rounded-xl border border-slate-100 bg-slate-50/80 px-4 py-3">
        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
          Visa & work authorization
        </p>
        <p className="mt-2 text-sm font-bold text-slate-900">{countryLabel}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <FieldBlock label="Country" value={countryLabel} />
        <FieldBlock
          label="Do you require a visa for this country?"
          value={normalized.requiresVisa}
        />
        {normalized.requiresVisa === 'Yes' ? (
          <>
            <FieldBlock label="Visa Type" value={normalized.visaType} />
            <FieldBlock label="Visa Status" value={normalized.visaStatus} />
            <FieldBlock
              label="Visa Expiry Date"
              value={formatDateDMY(normalized.visaExpiryDate)}
            />
            <FieldBlock label="Work Permit Number" value={normalized.workPermitNumber} />
          </>
        ) : null}
        {normalized.requiresVisa === 'No' ? (
          <FieldBlock
            label="Visa / work permit required"
            value={normalized.visaWorkpermitRequired}
          />
        ) : null}
      </div>

      <FieldBlock label="Additional Notes" value={normalized.additionalRemarks} />

      {documents.length > 0 ? (
        <CandidateWorkExperienceDocumentsField
          documents={documents}
          readOnly
          hideWhenEmpty
          uploadLabel="Upload Visa / Work Permit Document"
          readOnlyListLabel="Visa / Work Permit Documents"
        />
      ) : null}
    </div>
  );
}
