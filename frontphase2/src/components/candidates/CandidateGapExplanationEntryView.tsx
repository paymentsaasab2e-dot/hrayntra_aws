'use client';

import React from 'react';
import {
  formatGapReasonLabel,
  getGapPreferredSupportLabels,
  normalizeGapExplanationRecord,
  type CandidateGapExplanationRecord,
} from '@/lib/candidateGapExplanationFields';
import { phase1FieldLabelClass, phase1FieldValueClass } from '@/lib/phase1Typography';

function display(value: unknown): string {
  if (value === undefined || value === null) return '';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (Array.isArray(value)) return value.filter(Boolean).map(String).join(', ');
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

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h4 className="border-b border-slate-200 pb-2 text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
      {children}
    </h4>
  );
}

function GapSection({
  title,
  show,
  children,
}: {
  title: string;
  show: boolean;
  children: React.ReactNode;
}) {
  if (!show) return null;
  return (
    <div className="space-y-3">
      <SectionTitle>{title}</SectionTitle>
      {children}
    </div>
  );
}

export function CandidateGapExplanationEntryView({
  entry,
  index,
}: {
  entry: CandidateGapExplanationRecord | Record<string, unknown>;
  index: number;
}) {
  const normalized = normalizeGapExplanationRecord(entry);
  const skills = Array.isArray(normalized.selectedSkills) ? normalized.selectedSkills : [];
  const supportLabels = getGapPreferredSupportLabels(normalized.preferredSupport);
  const headline =
    [normalized.gapCategory, formatGapReasonLabel(normalized.reasonForGap || '')]
      .filter(Boolean)
      .join(' · ') || `Employment gap ${index + 1}`;

  const hasCategory = Boolean(display(normalized.gapCategory));
  const hasReason = Boolean(display(formatGapReasonLabel(normalized.reasonForGap || '')));
  const hasDuration = Boolean(display(normalized.gapDuration));
  const hasSkills = skills.length > 0;
  const hasCourses = Boolean(display(normalized.coursesText));
  const hasSupport = supportLabels.length > 0;

  return (
    <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-sm font-semibold text-slate-900">{headline}</p>

      <div className="space-y-4">
        <GapSection title="Gap Category" show={hasCategory}>
          <FieldBlock label="Category" value={normalized.gapCategory} />
        </GapSection>

        <GapSection title="Reason & Duration" show={hasReason || hasDuration}>
          <div className="grid gap-3 sm:grid-cols-2">
            <FieldBlock
              label="Reason for Gap"
              value={formatGapReasonLabel(normalized.reasonForGap || '')}
            />
            <FieldBlock label="Gap Duration" value={normalized.gapDuration} />
          </div>
        </GapSection>

        <GapSection title="Skills You Continued During the Gap" show={hasSkills}>
          <div className="flex flex-wrap gap-2">
            {skills.map((skill) => (
              <span
                key={skill}
                className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700"
              >
                {skill}
              </span>
            ))}
          </div>
        </GapSection>

        <GapSection title="Courses, Trainings, or Certifications" show={hasCourses}>
          <FieldBlock label="Details" value={normalized.coursesText} />
        </GapSection>

        <GapSection title="Preferred Support When Returning to Work" show={hasSupport}>
          <div className="flex flex-wrap gap-2">
            {supportLabels.map((label) => (
              <span
                key={label}
                className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-800"
              >
                {label}
              </span>
            ))}
          </div>
        </GapSection>
      </div>
    </div>
  );
}
