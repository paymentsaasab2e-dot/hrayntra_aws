'use client';

import React from 'react';
import {
  formatCourseDurationDisplay,
  formatEducationDateLine,
  formatEducationTitle,
  formatInstitutionLine,
  formatStoredGradeForDisplay,
  isSchoolCertificateEntry,
  normalizeEducationRecord,
  type CandidateEducationRecord,
} from '@/lib/candidateEducationFields';
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

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h4 className="border-b border-slate-200 pb-2 text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
      {children}
    </h4>
  );
}

function EducationSection({
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

export function CandidateEducationEntryView({
  entry,
  index,
}: {
  entry: CandidateEducationRecord | Record<string, unknown>;
  index: number;
}) {
  const normalized = normalizeEducationRecord(entry);
  const isSchoolCert = isSchoolCertificateEntry(
    normalized.educationLevel || '',
    normalized.degreeProgram || '',
  );
  const title = formatEducationTitle(
    normalized.educationLevel || '',
    normalized.degreeProgram || '',
  );
  const institutionLine = formatInstitutionLine(
    normalized.institutionName || '',
    normalized.institutionLocation,
  );
  const dateLine = formatEducationDateLine(
    normalized.startYear || '',
    normalized.startMonth || '',
    normalized.endYear || '',
    normalized.endMonth || '',
    normalized.currentlyStudying === true,
  );
  const documents = Array.isArray(normalized.documents) ? normalized.documents : [];
  const gradeDisplay = formatStoredGradeForDisplay(normalized.grade || '');
  const durationDisplay = formatCourseDurationDisplay(normalized.courseDuration || '');

  const hasBasics = Boolean(
    display(normalized.educationLevel) ||
      display(title) ||
      display(institutionLine) ||
      display(normalized.fieldOfStudy),
  );
  const hasDates = Boolean(dateLine || normalized.currentlyStudying);
  const hasAcademic = Boolean(
    gradeDisplay || display(normalized.modeOfStudy) || durationDisplay,
  );
  const hasDocuments = documents.length > 0;

  return (
    <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-4">
      <div className="rounded-xl border border-slate-100 bg-slate-50/80 px-4 py-3">
        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
          Preview (how it appears on your profile)
        </p>
        <div className="mt-2 space-y-1">
          <p className="text-sm font-bold uppercase tracking-wide text-slate-900">
            {title || `Education ${index + 1}`}
          </p>
          {institutionLine ? <p className="text-sm text-slate-700">{institutionLine}</p> : null}
          {dateLine ? <p className="text-sm text-slate-600">{dateLine}</p> : null}
        </div>
      </div>

      <div className="space-y-4">
        <EducationSection title="Education Details" show={hasBasics}>
          <div className="grid gap-3 sm:grid-cols-2">
            <FieldBlock label="Education Level" value={normalized.educationLevel} />
            <FieldBlock label="Qualification / Program" value={normalized.degreeProgram} />
            <FieldBlock label="School / College / University" value={normalized.institutionName} />
            <FieldBlock label="Location (City / Area)" value={normalized.institutionLocation} />
            {!isSchoolCert ? (
              <FieldBlock label="Field of Study / Major" value={normalized.fieldOfStudy} />
            ) : null}
          </div>
        </EducationSection>

        <EducationSection title="Dates" show={hasDates}>
          <div className="grid gap-3 sm:grid-cols-2">
            <FieldBlock
              label="Start Date"
              value={formatEducationDateLine(
                normalized.startYear || '',
                normalized.startMonth || '',
                '',
                '',
                false,
              )}
            />
            <FieldBlock
              label="End Date"
              value={
                normalized.currentlyStudying
                  ? 'Present'
                  : formatEducationDateLine('', '', normalized.endYear || '', normalized.endMonth || '', false)
              }
            />
            <FieldBlock
              label="I am currently studying here"
              value={normalized.currentlyStudying ? 'Yes' : ''}
            />
          </div>
        </EducationSection>

        {!isSchoolCert ? (
          <EducationSection title="Academic Details" show={hasAcademic}>
            <div className="grid gap-3 sm:grid-cols-2">
              <FieldBlock label="Grade / Percentage / GPA" value={gradeDisplay} />
              <FieldBlock label="Mode of Study" value={normalized.modeOfStudy} />
              <FieldBlock label="Course Duration" value={durationDisplay} />
            </div>
          </EducationSection>
        ) : null}

        <EducationSection title="Certificates & Documents" show={hasDocuments}>
          <CandidateWorkExperienceDocumentsField
            documents={documents}
            readOnly
            hideWhenEmpty
            uploadLabel="Upload Your Education Certificates/Documents"
            readOnlyListLabel="Education Certificates/Documents"
          />
        </EducationSection>
      </div>
    </div>
  );
}
