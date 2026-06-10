'use client';

import React, { useMemo } from 'react';
import { CandidateWorkExperienceDocumentsField } from './CandidateWorkExperienceDocumentsField';
import {
  COMPETITIVE_EXAM_NAME_OPTIONS,
  COMPETITIVE_EXAM_RESULT_STATUS_OPTIONS,
  COMPETITIVE_EXAM_SCORE_TYPE_OPTIONS,
  buildCompetitiveExamYearOptions,
  normalizeCompetitiveExamRecord,
} from '@/lib/candidateCompetitiveExamFields';
import { phase1FieldLabelClass, phase1FieldValueClass, phase1SectionTitleClass } from '@/lib/phase1Typography';

const inputClass = `w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 ${phase1FieldValueClass}`;
const textareaClass = `${inputClass} min-h-[100px] resize-y`;

function SectionHeading({ children }: { children: React.ReactNode }) {
  return <h4 className={`${phase1SectionTitleClass} border-b border-slate-200 pb-2`}>{children}</h4>;
}

function FieldLabel({ label }: { label: string }) {
  return <span className={`mb-1.5 block ${phase1FieldLabelClass}`}>{label}</span>;
}

export function CandidateCompetitiveExamEntryEdit({
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
  const normalized = normalizeCompetitiveExamRecord(entry);
  const yearOptions = useMemo(() => buildCompetitiveExamYearOptions(), []);
  const documents = Array.isArray(normalized.documents) ? normalized.documents : [];

  const patch = (patchValue: Record<string, unknown>) => onChange(index, patchValue);

  return (
    <div className="space-y-5 rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-sm font-semibold text-slate-900">Competitive exam {index + 1}</p>

      <div className="space-y-4">
        <SectionHeading>Exam Details</SectionHeading>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <FieldLabel label="Exam Name" />
            <select
              value={normalized.examName || ''}
              onChange={(e) => patch({ examName: e.target.value })}
              className={inputClass}
            >
              <option value="">Select exam...</option>
              {COMPETITIVE_EXAM_NAME_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <FieldLabel label="Year Taken" />
            <select
              value={normalized.yearTaken || ''}
              onChange={(e) => patch({ yearTaken: e.target.value })}
              className={inputClass}
            >
              <option value="">Select year</option>
              {yearOptions.map((year) => (
                <option key={year} value={String(year)}>
                  {year}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <FieldLabel label="Result Status" />
            <select
              value={normalized.resultStatus || ''}
              onChange={(e) => patch({ resultStatus: e.target.value })}
              className={inputClass}
            >
              <option value="">Select status</option>
              {COMPETITIVE_EXAM_RESULT_STATUS_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <FieldLabel label="Score / Marks" />
            <input
              value={normalized.scoreMarks || ''}
              onChange={(e) => patch({ scoreMarks: e.target.value.replace(/\D/g, '') })}
              inputMode="numeric"
              placeholder="Enter marks"
              className={inputClass}
            />
          </label>
          <label className="block">
            <FieldLabel label="Score Type" />
            <select
              value={normalized.scoreType || ''}
              onChange={(e) => patch({ scoreType: e.target.value })}
              className={inputClass}
            >
              <option value="">Select score type</option>
              {COMPETITIVE_EXAM_SCORE_TYPE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label className="block sm:col-span-2">
            <FieldLabel label="Valid Until" />
            <input
              type="date"
              value={normalized.validUntil || ''}
              onChange={(e) => patch({ validUntil: e.target.value })}
              className={inputClass}
            />
          </label>
          <label className="block sm:col-span-2">
            <FieldLabel label="Additional Notes" />
            <textarea
              value={normalized.additionalNotes || ''}
              onChange={(e) => patch({ additionalNotes: e.target.value })}
              placeholder="Attempts, section scores, or other details..."
              className={textareaClass}
            />
          </label>
        </div>
      </div>

      <div className="space-y-4 border-t border-slate-100 pt-4">
        <SectionHeading>Certificates & Documents</SectionHeading>
        <CandidateWorkExperienceDocumentsField
          candidateId={candidateId}
          documents={documents}
          onChange={(nextDocuments) => patch({ documents: nextDocuments })}
          uploadLabel="Upload Your Competitive Exam Certificates/Documents"
          readOnlyListLabel="Competitive Exam Certificates/Documents"
          uploadCategory="Competitive Exam Certificate"
        />
      </div>
    </div>
  );
}
