'use client';

import React, { useState } from 'react';
import { CandidateWorkExperienceDocumentsField } from './CandidateWorkExperienceDocumentsField';
import { EditDateField } from './EditDateField';
import {
  PROJECT_TYPE_OPTIONS,
  normalizeProjectRecord,
} from '@/lib/candidateProjectFields';
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

export function CandidateProjectEntryEdit({
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
  const normalized = normalizeProjectRecord(entry);
  const documents = Array.isArray(normalized.documents) ? normalized.documents : [];
  const technologies = Array.isArray(normalized.technologies) ? normalized.technologies : [];
  const [technologyInput, setTechnologyInput] = useState('');

  const patch = (patchValue: Record<string, unknown>) => onChange(index, patchValue);

  const addTechnology = (value: string) => {
    const next = value.trim();
    if (!next || technologies.includes(next)) return;
    patch({ technologies: [...technologies, next] });
    setTechnologyInput('');
  };

  const removeTechnology = (tech: string) => {
    patch({ technologies: technologies.filter((item) => item !== tech) });
  };

  return (
    <div className="space-y-5 rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-sm font-semibold text-slate-900">Project {index + 1}</p>

      <div className="space-y-4">
        <SectionHeading>Project Details</SectionHeading>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <FieldLabel label="Project Title" />
            <input
              value={normalized.projectTitle || ''}
              onChange={(e) => patch({ projectTitle: e.target.value })}
              placeholder="e.g. Smart Inventory Tracker"
              className={inputClass}
            />
          </label>
          <label className="block">
            <FieldLabel label="Project Type" />
            <select
              value={normalized.projectType || ''}
              onChange={(e) => patch({ projectType: e.target.value })}
              className={inputClass}
            >
              <option value="">Select project type</option>
              {PROJECT_TYPE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <FieldLabel
              label="Organization / Client"
              hint="If applicable — Company, University, or Client Name"
            />
            <input
              value={normalized.organizationClient || ''}
              onChange={(e) => patch({ organizationClient: e.target.value })}
              placeholder="Company, university, or client"
              className={inputClass}
            />
          </label>
          <label className="flex items-center gap-2 sm:col-span-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={Boolean(normalized.currentlyWorking)}
              onChange={(e) => {
                const currentlyWorking = e.target.checked;
                patch({
                  currentlyWorking,
                  endDate: currentlyWorking ? '' : normalized.endDate || '',
                });
              }}
              className="h-4 w-4 rounded text-violet-600 focus:ring-violet-500"
            />
            I am currently working on this project
          </label>
        </div>
      </div>

      <div className="space-y-4 border-t border-slate-100 pt-4">
        <SectionHeading>Dates</SectionHeading>
        <div className="grid gap-3 sm:grid-cols-2">
          <EditDateField
            label="Start Date"
            value={normalized.startDate || ''}
            outputIso
            onChange={(value) => patch({ startDate: value })}
          />
          <EditDateField
            label="End Date"
            value={normalized.endDate || ''}
            outputIso
            disabled={Boolean(normalized.currentlyWorking)}
            onChange={(value) => patch({ endDate: value })}
          />
        </div>
      </div>

      <div className="space-y-4 border-t border-slate-100 pt-4">
        <SectionHeading>Description & Contributions</SectionHeading>
        <label className="block">
          <FieldLabel label="Project Description" />
          <textarea
            value={normalized.projectDescription || ''}
            onChange={(e) => patch({ projectDescription: e.target.value })}
            placeholder="Brief overview of the project..."
            className={textareaClass}
          />
        </label>
        <label className="block">
          <FieldLabel
            label="Responsibilities / Contributions"
            hint="Features built, research done, tasks handled..."
          />
          <textarea
            value={normalized.responsibilities || ''}
            onChange={(e) => patch({ responsibilities: e.target.value })}
            placeholder="What you contributed to this project..."
            className={textareaClass}
          />
        </label>
      </div>

      <div className="space-y-4 border-t border-slate-100 pt-4">
        <SectionHeading>Technologies & Outcome</SectionHeading>
        <div>
          <FieldLabel
            label="Technologies / Tools Used"
            hint="Add technologies (e.g., React, Python, Figma, SQL)"
          />
          <div className="flex gap-2">
            <input
              value={technologyInput}
              onChange={(e) => setTechnologyInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addTechnology(technologyInput);
                }
              }}
              placeholder="Type a technology and press Enter"
              className={inputClass}
            />
            <button
              type="button"
              onClick={() => addTechnology(technologyInput)}
              className="shrink-0 rounded-xl border border-violet-200 bg-violet-50 px-4 text-sm font-semibold text-violet-700 hover:bg-violet-100"
            >
              Add
            </button>
          </div>
          {technologies.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {technologies.map((tech) => (
                <span
                  key={tech}
                  className="inline-flex items-center gap-1 rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-xs font-medium text-violet-800"
                >
                  {tech}
                  <button
                    type="button"
                    onClick={() => removeTechnology(tech)}
                    className="text-violet-500 hover:text-violet-800"
                    aria-label={`Remove ${tech}`}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          ) : null}
        </div>
        <label className="block">
          <FieldLabel label="Project Outcome / Results" />
          <textarea
            value={normalized.projectOutcome || ''}
            onChange={(e) => patch({ projectOutcome: e.target.value })}
            placeholder="e.g. deployed demo used by 50+ beta users"
            className={textareaClass}
          />
        </label>
        <label className="block">
          <FieldLabel label="Project Link" />
          <input
            value={normalized.projectLink || ''}
            onChange={(e) => patch({ projectLink: e.target.value })}
            placeholder="https://github.com/username/project"
            className={inputClass}
          />
        </label>
      </div>

      <div className="space-y-4 border-t border-slate-100 pt-4">
        <SectionHeading>Project Documents / Certificates</SectionHeading>
        <CandidateWorkExperienceDocumentsField
          candidateId={candidateId}
          documents={documents}
          onChange={(nextDocuments) => patch({ documents: nextDocuments })}
          uploadLabel="Upload Your Project Documents/Certificates"
          readOnlyListLabel="Project Documents/Certificates"
          uploadCategory="Project Document"
        />
      </div>
    </div>
  );
}
