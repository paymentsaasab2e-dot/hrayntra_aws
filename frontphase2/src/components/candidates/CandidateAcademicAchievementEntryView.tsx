'use client';

import React from 'react';
import {
  normalizeAcademicAchievementRecord,
  type CandidateAcademicAchievementRecord,
} from '@/lib/candidateAcademicAchievementFields';
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

export function CandidateAcademicAchievementEntryView({
  entry,
  index,
}: {
  entry: CandidateAcademicAchievementRecord | Record<string, unknown>;
  index: number;
}) {
  const normalized = normalizeAcademicAchievementRecord(entry);
  const documents = Array.isArray(normalized.documents) ? normalized.documents : [];
  const headline = normalized.achievementTitle || `Academic achievement ${index + 1}`;

  return (
    <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-sm font-semibold text-slate-900">{headline}</p>

      <div className="grid gap-3 sm:grid-cols-2">
        <FieldBlock label="Achievement Title" value={normalized.achievementTitle} />
        <FieldBlock label="Awarded By" value={normalized.awardedBy} />
        <FieldBlock label="Year Received" value={normalized.yearReceived} />
        <FieldBlock label="Category / Type" value={normalized.categoryType} />
      </div>

      <FieldBlock label="Description" value={normalized.description} />

      {documents.length > 0 ? (
        <CandidateWorkExperienceDocumentsField
          documents={documents}
          readOnly
          hideWhenEmpty
          uploadLabel="Upload Your Academic Achievements Certificates/Documents"
          readOnlyListLabel="Academic Achievement Certificates/Documents"
        />
      ) : null}
    </div>
  );
}
