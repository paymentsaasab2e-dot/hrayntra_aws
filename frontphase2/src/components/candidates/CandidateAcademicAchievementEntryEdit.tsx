'use client';

import React, { useMemo } from 'react';
import { CandidateWorkExperienceDocumentsField } from './CandidateWorkExperienceDocumentsField';
import {
  ACADEMIC_ACHIEVEMENT_CATEGORY_OPTIONS,
  buildAcademicAchievementYearOptions,
  normalizeAcademicAchievementRecord,
} from '@/lib/candidateAcademicAchievementFields';
import { phase1FieldLabelClass, phase1FieldValueClass, phase1SectionTitleClass } from '@/lib/phase1Typography';

const inputClass = `w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 ${phase1FieldValueClass}`;
const textareaClass = `${inputClass} min-h-[100px] resize-y`;

function SectionHeading({ children }: { children: React.ReactNode }) {
  return <h4 className={`${phase1SectionTitleClass} border-b border-slate-200 pb-2`}>{children}</h4>;
}

function FieldLabel({ label }: { label: string }) {
  return <span className={`mb-1.5 block ${phase1FieldLabelClass}`}>{label}</span>;
}

export function CandidateAcademicAchievementEntryEdit({
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
  const normalized = normalizeAcademicAchievementRecord(entry);
  const yearOptions = useMemo(() => buildAcademicAchievementYearOptions(), []);
  const documents = Array.isArray(normalized.documents) ? normalized.documents : [];

  const patch = (patchValue: Record<string, unknown>) => onChange(index, patchValue);

  return (
    <div className="space-y-5 rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-sm font-semibold text-slate-900">Academic achievement {index + 1}</p>

      <div className="space-y-4">
        <SectionHeading>Achievement Details</SectionHeading>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <FieldLabel label="Achievement Title" />
            <input
              value={normalized.achievementTitle || ''}
              onChange={(e) => patch({ achievementTitle: e.target.value })}
              placeholder="e.g., University Rank 3"
              className={inputClass}
            />
          </label>
          <label className="block">
            <FieldLabel label="Awarded By" />
            <input
              value={normalized.awardedBy || ''}
              onChange={(e) => patch({ awardedBy: e.target.value })}
              placeholder="University / Board / Institution name"
              className={inputClass}
            />
          </label>
          <label className="block">
            <FieldLabel label="Year Received" />
            <select
              value={normalized.yearReceived || ''}
              onChange={(e) => patch({ yearReceived: e.target.value })}
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
          <label className="block sm:col-span-2">
            <FieldLabel label="Category / Type" />
            <select
              value={normalized.categoryType || ''}
              onChange={(e) => patch({ categoryType: e.target.value })}
              className={inputClass}
            >
              <option value="">Select a category</option>
              {ACADEMIC_ACHIEVEMENT_CATEGORY_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label className="block sm:col-span-2">
            <FieldLabel label="Description" />
            <textarea
              value={normalized.description || ''}
              onChange={(e) => patch({ description: e.target.value })}
              placeholder="Short description of the achievement, criteria, rank, and significance."
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
          uploadLabel="Upload Your Academic Achievements Certificates/Documents"
          readOnlyListLabel="Academic Achievement Certificates/Documents"
          uploadCategory="Academic Achievement Certificate"
        />
      </div>
    </div>
  );
}
