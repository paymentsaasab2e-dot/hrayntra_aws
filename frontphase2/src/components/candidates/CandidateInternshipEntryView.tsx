'use client';

import React from 'react';
import {
  formatInternshipDomainLabel,
  formatInternshipTypeLabel,
  formatWorkModeLabel,
  normalizeInternshipRecord,
  type CandidateInternshipRecord,
} from '@/lib/candidateInternshipFields';
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

function InternshipSection({
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

export function CandidateInternshipEntryView({
  entry,
  index,
  headline,
}: {
  entry: CandidateInternshipRecord | Record<string, unknown>;
  index: number;
  headline?: string;
}) {
  const normalized = normalizeInternshipRecord(entry);
  const title =
    headline ||
    [normalized.internshipTitle, normalized.companyName].filter(Boolean).join(' @ ') ||
    `Internship ${index + 1}`;
  const skills = Array.isArray(normalized.skills) ? normalized.skills : [];
  const documents = Array.isArray(normalized.documents) ? normalized.documents : [];

  const hasBasicInfo = Boolean(
    display(normalized.internshipTitle) ||
      display(formatInternshipTypeLabel(normalized.internshipType || '')) ||
      display(normalized.companyName) ||
      display(formatInternshipDomainLabel(normalized.domainDepartment || '')),
  );
  const hasDates = Boolean(
    display(normalized.startDate) ||
      display(normalized.currentlyWorking ? 'Present' : normalized.endDate) ||
      normalized.currentlyWorking,
  );
  const hasLocation = Boolean(
    display(normalized.location) || display(formatWorkModeLabel(normalized.workMode || '')),
  );
  const hasRoleDetails = Boolean(
    display(normalized.responsibilities) || display(normalized.learnings) || skills.length > 0,
  );
  const hasDocuments = documents.length > 0;

  return (
    <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-sm font-semibold text-slate-900">{title}</p>

      <div className="space-y-4">
        <InternshipSection title="Internship Details" show={hasBasicInfo}>
          <div className="grid gap-3 sm:grid-cols-2">
            <FieldBlock label="Internship Title" value={normalized.internshipTitle} />
            <FieldBlock
              label="Internship Type"
              value={formatInternshipTypeLabel(normalized.internshipType || '')}
            />
            <FieldBlock label="Company / Organization Name" value={normalized.companyName} />
            <FieldBlock
              label="Domain / Department"
              value={formatInternshipDomainLabel(normalized.domainDepartment || '')}
            />
          </div>
        </InternshipSection>

        <InternshipSection title="Dates" show={hasDates}>
          <div className="grid gap-3 sm:grid-cols-2">
            <FieldBlock label="Start Date" value={normalized.startDate} />
            <FieldBlock
              label="End Date"
              value={normalized.currentlyWorking ? 'Present' : normalized.endDate}
            />
            <FieldBlock
              label="I am currently working here"
              value={normalized.currentlyWorking ? 'Yes' : ''}
            />
          </div>
        </InternshipSection>

        <InternshipSection title="Location & Mode" show={hasLocation}>
          <div className="grid gap-3 sm:grid-cols-2">
            <FieldBlock label="Location" value={normalized.location} />
            <FieldBlock label="Work Mode" value={formatWorkModeLabel(normalized.workMode || '')} />
          </div>
        </InternshipSection>

        <InternshipSection title="Role Details" show={hasRoleDetails}>
          <FieldBlock label="Responsibilities / Tasks Performed" value={normalized.responsibilities} />
          <FieldBlock label="Learnings" value={normalized.learnings} />
          {skills.length ? (
            <div>
              <p className={phase1FieldLabelClass}>Skills Applied</p>
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
        </InternshipSection>

        <InternshipSection title="Certificates & Documents" show={hasDocuments}>
          <CandidateWorkExperienceDocumentsField
            documents={documents}
            readOnly
            hideWhenEmpty
            uploadLabel="Upload Your Internship Certificates/Documents"
            readOnlyListLabel="Internship Certificates/Documents"
          />
        </InternshipSection>
      </div>
    </div>
  );
}
