'use client';

import React from 'react';
import { ExternalLink } from 'lucide-react';
import {
  formatCertificationMonthDisplay,
  normalizeCertificationRecord,
  type CandidateCertificationRecord,
} from '@/lib/candidateCertificationFields';
import { phase1FieldLabelClass, phase1FieldValueClass } from '@/lib/phase1Typography';
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

export function CandidateCertificationEntryView({
  entry,
  index,
}: {
  entry: CandidateCertificationRecord | Record<string, unknown>;
  index: number;
}) {
  const normalized = normalizeCertificationRecord(entry);
  const documents = Array.isArray(normalized.documents) ? normalized.documents : [];
  const headline = normalized.certificationName || `Certification ${index + 1}`;
  const credentialUrl = display(normalized.credentialUrl);

  return (
    <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-4">
      <div className="rounded-xl border border-slate-100 bg-slate-50/80 px-4 py-3">
        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Certification</p>
        <div className="mt-2 space-y-1">
          <p className="text-sm font-bold text-slate-900">{headline}</p>
          {normalized.issuingOrganization ? (
            <p className="text-sm text-slate-700">{normalized.issuingOrganization}</p>
          ) : null}
          {normalized.issueDate ? (
            <p className="text-sm text-slate-600">
              Issued {formatCertificationMonthDisplay(normalized.issueDate)}
            </p>
          ) : null}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <FieldBlock label="Certification Name" value={normalized.certificationName} />
        <FieldBlock label="Issuing Organization" value={normalized.issuingOrganization} />
        <FieldBlock
          label="Issue Date"
          value={formatCertificationMonthDisplay(normalized.issueDate)}
        />
        <FieldBlock label="Credential ID" value={normalized.credentialId} />
        <FieldBlock
          label="Expiry Date"
          value={
            normalized.doesNotExpire
              ? 'This certification does not expire'
              : formatCertificationMonthDisplay(normalized.expiryDate)
          }
        />
      </div>

      {credentialUrl ? (
        <div>
          <p className={phase1FieldLabelClass}>Credential URL</p>
          <a
            href={credentialUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={`mt-1 inline-flex items-center gap-1.5 text-sm font-medium text-violet-700 hover:text-violet-900 ${phase1FieldValueClass}`}
          >
            {credentialUrl}
            <ExternalLink className="h-3.5 w-3.5 shrink-0" />
          </a>
        </div>
      ) : null}

      <FieldBlock label="Description" value={normalized.description} />

      {documents.length > 0 ? (
        <CandidateWorkExperienceDocumentsField
          documents={documents}
          readOnly
          hideWhenEmpty
          uploadLabel="Upload Certificate"
          readOnlyListLabel="Certificate Documents"
        />
      ) : null}
    </div>
  );
}
