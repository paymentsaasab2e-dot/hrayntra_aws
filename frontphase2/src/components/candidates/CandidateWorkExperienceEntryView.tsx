'use client';

import React from 'react';
import {
  formatEmploymentTypeLabel,
  formatWorkModeLabel,
  normalizeWorkExperienceRecord,
  type CandidateWorkExperienceRecord,
} from '@/lib/candidateWorkExperienceFields';
import { formatWorkEntryMeta, formatWorkEntryTenureLabel } from '@/lib/candidateExperience';
import { phase1FieldLabelClass, phase1FieldValueClass } from '@/lib/phase1Typography';
import { CandidateWorkExperienceDocumentsField } from './CandidateWorkExperienceDocumentsField';

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

function WorkExperienceSection({
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

export function CandidateWorkExperienceEntryView({
  entry,
  index,
  headline,
}: {
  entry: CandidateWorkExperienceRecord | Record<string, unknown>;
  index: number;
  headline?: string;
}) {
  const normalized = normalizeWorkExperienceRecord(entry);
  const title = headline || [normalized.jobTitle, normalized.companyName].filter(Boolean).join(' @ ') || `Role ${index + 1}`;
  const meta = formatWorkEntryMeta(normalized);
  const tenureLabel = formatWorkEntryTenureLabel(normalized);
  const skills = Array.isArray(normalized.workSkills) ? normalized.workSkills : [];
  const documents = Array.isArray(normalized.documents) ? normalized.documents : [];
  const hasRoleDetails = Boolean(
    display(normalized.jobTitle) ||
      display(normalized.companyName) ||
      display(formatEmploymentTypeLabel(normalized.employmentType || '')) ||
      display(normalized.industryDomain) ||
      display(normalized.numberOfReportees),
  );
  const hasDuration = Boolean(
    display(normalized.startDate) ||
      display(normalized.currentlyWorkHere ? 'Present' : normalized.endDate) ||
      normalized.currentlyWorkHere,
  );
  const hasLocation = Boolean(
    display(normalized.workLocation) || display(formatWorkModeLabel(normalized.workMode || '')),
  );
  const hasCompanyDetails = Boolean(
    display(normalized.companyProfile) || display(normalized.companyTurnover),
  );
  const hasRoleContribution = Boolean(
    display(normalized.keyResponsibilities) || display(normalized.achievements),
  );
  const hasSkillsAndDocuments = skills.length > 0 || documents.length > 0;

  return (
    <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="text-sm font-semibold text-slate-900">{title}</p>
        {tenureLabel ? (
          <span className="shrink-0 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-800">
            {tenureLabel}
          </span>
        ) : null}
      </div>
      {meta ? <p className="text-xs text-slate-500">{meta}</p> : null}

      <div className="space-y-4">
        <WorkExperienceSection title="Role Details" show={hasRoleDetails}>
          <div className="grid gap-3 sm:grid-cols-2">
            <FieldBlock label="Job Title" value={normalized.jobTitle} />
            <FieldBlock label="Company Name" value={normalized.companyName} />
            <FieldBlock label="Employment Type" value={formatEmploymentTypeLabel(normalized.employmentType || '')} />
            <FieldBlock label="Industry" value={normalized.industryDomain} />
            <FieldBlock label="Number of Reportees" value={normalized.numberOfReportees} />
          </div>
        </WorkExperienceSection>

        <WorkExperienceSection title="Duration" show={hasDuration}>
          <div className="grid gap-3 sm:grid-cols-2">
            <FieldBlock label="Start Date" value={normalized.startDate} />
            <FieldBlock
              label="End Date"
              value={normalized.currentlyWorkHere ? 'Present' : normalized.endDate}
            />
            <FieldBlock label="I currently work here" value={normalized.currentlyWorkHere ? 'Yes' : ''} />
          </div>
        </WorkExperienceSection>

        <WorkExperienceSection title="Location & Work Mode" show={hasLocation}>
          <div className="grid gap-3 sm:grid-cols-2">
            <FieldBlock label="Work Location" value={normalized.workLocation} />
            <FieldBlock label="Work Mode" value={formatWorkModeLabel(normalized.workMode || '')} />
          </div>
        </WorkExperienceSection>

        <WorkExperienceSection title="Company Details" show={hasCompanyDetails}>
          <FieldBlock label="Company Profile" value={normalized.companyProfile} />
          <FieldBlock label="Company Turnover" value={normalized.companyTurnover} />
        </WorkExperienceSection>

        <WorkExperienceSection title="Role Contribution" show={hasRoleContribution}>
          <FieldBlock label="Key Responsibilities" value={normalized.keyResponsibilities} />
          <FieldBlock label="Achievements" value={normalized.achievements} />
        </WorkExperienceSection>

        <WorkExperienceSection title="Skills & Documents" show={hasSkillsAndDocuments}>
          {skills.length ? (
            <div>
              <p className={phase1FieldLabelClass}>Skills Used</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {skills.map((skill) => (
                  <span
                    key={skill}
                    className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
          {documents.length > 0 ? (
            <CandidateWorkExperienceDocumentsField documents={documents} readOnly hideWhenEmpty />
          ) : null}
        </WorkExperienceSection>
      </div>
    </div>
  );
}
