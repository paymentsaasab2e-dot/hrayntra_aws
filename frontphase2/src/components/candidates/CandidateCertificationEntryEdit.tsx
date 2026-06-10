'use client';

import React from 'react';
import { CandidateWorkExperienceDocumentsField } from './CandidateWorkExperienceDocumentsField';
import { normalizeCertificationRecord } from '@/lib/candidateCertificationFields';
import { phase1FieldLabelClass, phase1FieldValueClass, phase1SectionTitleClass } from '@/lib/phase1Typography';

const inputClass = `w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 ${phase1FieldValueClass}`;
const textareaClass = `${inputClass} min-h-[100px] resize-y`;

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

export function CandidateCertificationEntryEdit({
  candidateId,
  entry,
  index,
  onChange,
}: {
  candidateId?: string;
  entry: Record<string, unknown>;
  index: number;
  onChange: (index: number, patch: Record<string, unknown>) => void;
}) {
  const normalized = normalizeCertificationRecord(entry);
  const documents = Array.isArray(normalized.documents) ? normalized.documents : [];

  const patch = (patchValue: Record<string, unknown>) => onChange(index, patchValue);

  return (
    <div className="space-y-5 rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-sm font-semibold text-slate-900">Certification {index + 1}</p>

      <div className="space-y-4">
        <SectionHeading>Certification Details</SectionHeading>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <FieldLabel label="Certification Name" />
            <input
              value={normalized.certificationName || ''}
              onChange={(e) => patch({ certificationName: e.target.value })}
              placeholder="Enter certification name"
              className={inputClass}
            />
          </label>
          <label className="block sm:col-span-2">
            <FieldLabel label="Issuing Organization" />
            <input
              value={normalized.issuingOrganization || ''}
              onChange={(e) => patch({ issuingOrganization: e.target.value })}
              placeholder="e.g. Coursera"
              className={inputClass}
            />
          </label>
          <label className="block">
            <FieldLabel label="Issue Date" />
            <input
              type="month"
              value={normalized.issueDate || ''}
              onChange={(e) => patch({ issueDate: e.target.value })}
              className={inputClass}
            />
          </label>
          <label className="block">
            <FieldLabel label="Credential ID" />
            <input
              value={normalized.credentialId || ''}
              onChange={(e) => patch({ credentialId: e.target.value })}
              placeholder="ID or registration number"
              className={inputClass}
            />
          </label>
          <label className="block">
            <FieldLabel label="Expiry Date" />
            <input
              type="month"
              value={normalized.expiryDate || ''}
              disabled={Boolean(normalized.doesNotExpire)}
              onChange={(e) => patch({ expiryDate: e.target.value })}
              className={inputClass}
            />
          </label>
          <label className="flex items-center gap-2 sm:col-span-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={Boolean(normalized.doesNotExpire)}
              onChange={(e) => {
                const doesNotExpire = e.target.checked;
                patch({
                  doesNotExpire,
                  expiryDate: doesNotExpire ? '' : normalized.expiryDate || '',
                });
              }}
              className="h-4 w-4 rounded text-violet-600 focus:ring-violet-500"
            />
            This certification does not expire
          </label>
          <label className="block sm:col-span-2">
            <FieldLabel
              label="Credential URL"
              hint="Paste certificate verification link (https://...)"
            />
            <input
              value={normalized.credentialUrl || ''}
              onChange={(e) => patch({ credentialUrl: e.target.value })}
              placeholder="https://..."
              className={inputClass}
            />
          </label>
          <label className="block sm:col-span-2">
            <FieldLabel label="Description" />
            <textarea
              value={normalized.description || ''}
              onChange={(e) => patch({ description: e.target.value })}
              placeholder="Additional details about this certification"
              className={textareaClass}
            />
          </label>
        </div>
      </div>

      <div className="space-y-4 border-t border-slate-100 pt-4">
        <SectionHeading>Upload Certificate</SectionHeading>
        <CandidateWorkExperienceDocumentsField
          candidateId={candidateId}
          documents={documents}
          onChange={(nextDocuments) => patch({ documents: nextDocuments })}
          uploadLabel="Upload Certificate"
          readOnlyListLabel="Certificate Documents"
          uploadCategory="Certification Certificate"
        />
      </div>
    </div>
  );
}
