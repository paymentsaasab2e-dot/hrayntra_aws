'use client';

import React from 'react';
import { ExternalLink } from 'lucide-react';
import {
  formatProjectDateDisplay,
  formatProjectDateLine,
  normalizeProjectRecord,
  type CandidateProjectRecord,
} from '@/lib/candidateProjectFields';
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

export function CandidateProjectEntryView({
  entry,
  index,
}: {
  entry: CandidateProjectRecord | Record<string, unknown>;
  index: number;
}) {
  const normalized = normalizeProjectRecord(entry);
  const documents = Array.isArray(normalized.documents) ? normalized.documents : [];
  const technologies = Array.isArray(normalized.technologies) ? normalized.technologies : [];
  const headline = normalized.projectTitle || `Project ${index + 1}`;
  const dateLine = formatProjectDateLine(
    normalized.startDate,
    normalized.endDate,
    normalized.currentlyWorking === true,
  );
  const projectLink = display(normalized.projectLink);

  return (
    <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-4">
      <div className="rounded-xl border border-slate-100 bg-slate-50/80 px-4 py-3">
        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Project</p>
        <div className="mt-2 space-y-1">
          <p className="text-sm font-bold text-slate-900">{headline}</p>
          {normalized.projectType ? (
            <p className="text-sm text-slate-700">{normalized.projectType}</p>
          ) : null}
          {dateLine ? <p className="text-sm text-slate-600">{dateLine}</p> : null}
        </div>
      </div>

      <div className="space-y-4">
        <div className="space-y-3">
          <SectionTitle>Project Details</SectionTitle>
          <div className="grid gap-3 sm:grid-cols-2">
            <FieldBlock label="Project Title" value={normalized.projectTitle} />
            <FieldBlock label="Project Type" value={normalized.projectType} />
            <FieldBlock
              label="Organization / Client"
              value={normalized.organizationClient}
            />
            <FieldBlock
              label="I am currently working on this project"
              value={normalized.currentlyWorking ? 'Yes' : ''}
            />
          </div>
        </div>

        <div className="space-y-3">
          <SectionTitle>Dates</SectionTitle>
          <div className="grid gap-3 sm:grid-cols-2">
            <FieldBlock
              label="Start Date"
              value={formatProjectDateDisplay(normalized.startDate)}
            />
            <FieldBlock
              label="End Date"
              value={
                normalized.currentlyWorking
                  ? 'Present'
                  : formatProjectDateDisplay(normalized.endDate)
              }
            />
          </div>
        </div>

        <FieldBlock label="Project Description" value={normalized.projectDescription} />
        <FieldBlock label="Responsibilities / Contributions" value={normalized.responsibilities} />

        {technologies.length > 0 ? (
          <div>
            <p className={phase1FieldLabelClass}>Technologies / Tools Used</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {technologies.map((tech) => (
                <span
                  key={tech}
                  className="rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-xs font-medium text-violet-800"
                >
                  {tech}
                </span>
              ))}
            </div>
          </div>
        ) : null}

        <FieldBlock label="Project Outcome / Results" value={normalized.projectOutcome} />

        {projectLink ? (
          <div>
            <p className={phase1FieldLabelClass}>Project Link</p>
            <a
              href={projectLink}
              target="_blank"
              rel="noopener noreferrer"
              className={`mt-1 inline-flex items-center gap-1.5 text-sm font-medium text-violet-700 hover:text-violet-900 ${phase1FieldValueClass}`}
            >
              {projectLink}
              <ExternalLink className="h-3.5 w-3.5 shrink-0" />
            </a>
          </div>
        ) : null}

        {documents.length > 0 ? (
          <div className="space-y-3">
            <SectionTitle>Project Documents / Certificates</SectionTitle>
            <CandidateWorkExperienceDocumentsField
              documents={documents}
              readOnly
              hideWhenEmpty
              uploadLabel="Upload Your Project Documents/Certificates"
              readOnlyListLabel="Project Documents/Certificates"
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
