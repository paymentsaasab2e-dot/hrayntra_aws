'use client';

import React from 'react';
import {
  normalizeCompetitiveExamRecord,
  type CandidateCompetitiveExamRecord,
} from '@/lib/candidateCompetitiveExamFields';
import { phase1FieldLabelClass, phase1FieldValueClass } from '@/lib/phase1Typography';
import { CandidateWorkExperienceDocumentsField } from './CandidateWorkExperienceDocumentsField';

function display(value: unknown): string {
  if (value === undefined || value === null) return '';
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

export function CandidateCompetitiveExamEntryView({
  entry,
  index,
}: {
  entry: CandidateCompetitiveExamRecord | Record<string, unknown>;
  index: number;
}) {
  const normalized = normalizeCompetitiveExamRecord(entry);
  const documents = Array.isArray(normalized.documents) ? normalized.documents : [];
  const headline = normalized.examName || `Competitive exam ${index + 1}`;
  const scoreDisplay =
    normalized.scoreMarks && normalized.scoreType
      ? `${normalized.scoreMarks} (${normalized.scoreType})`
      : normalized.scoreMarks || normalized.scoreType;

  return (
    <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-sm font-semibold text-slate-900">{headline}</p>

      <div className="grid gap-3 sm:grid-cols-2">
        <FieldBlock label="Exam Name" value={normalized.examName} />
        <FieldBlock label="Year Taken" value={normalized.yearTaken} />
        <FieldBlock label="Result Status" value={normalized.resultStatus} />
        <FieldBlock label="Score / Marks" value={scoreDisplay} />
        <FieldBlock label="Valid Until" value={normalized.validUntil} />
      </div>

      <FieldBlock label="Additional Notes" value={normalized.additionalNotes} />

      {documents.length > 0 ? (
        <CandidateWorkExperienceDocumentsField
          documents={documents}
          readOnly
          hideWhenEmpty
          uploadLabel="Upload Your Competitive Exam Certificates/Documents"
          readOnlyListLabel="Competitive Exam Certificates/Documents"
        />
      ) : null}
    </div>
  );
}
