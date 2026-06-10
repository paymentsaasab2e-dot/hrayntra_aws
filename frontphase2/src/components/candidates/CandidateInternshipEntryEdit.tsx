'use client';

import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { CandidateWorkExperienceDocumentsField } from './CandidateWorkExperienceDocumentsField';
import {
  INTERNSHIP_DOMAIN_OPTIONS,
  INTERNSHIP_TYPE_OPTIONS,
  normalizeInternshipRecord,
} from '@/lib/candidateInternshipFields';
import { WORK_MODE_OPTIONS } from '@/lib/candidateWorkExperienceFields';
import { searchCscCities } from '@/lib/cscData';
import { phase1FieldLabelClass, phase1FieldValueClass, phase1SectionTitleClass } from '@/lib/phase1Typography';
import { EditDateField } from './EditDateField';

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

export function CandidateInternshipEntryEdit({
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
  const normalized = normalizeInternshipRecord(entry);
  const [locationQuery, setLocationQuery] = useState(normalized.location || '');
  const [locationHits, setLocationHits] = useState<ReturnType<typeof searchCscCities>>([]);
  const [locationOpen, setLocationOpen] = useState(false);
  const [skillInput, setSkillInput] = useState('');

  useEffect(() => {
    setLocationQuery(normalized.location || '');
  }, [normalized.location, index]);

  useEffect(() => {
    const query = locationQuery.trim();
    if (query.length < 2) {
      setLocationHits([]);
      return;
    }
    const timer = window.setTimeout(() => {
      setLocationHits(searchCscCities(query, 12));
    }, 200);
    return () => window.clearTimeout(timer);
  }, [locationQuery]);

  const patch = (patchValue: Record<string, unknown>) => onChange(index, patchValue);

  const skills = Array.isArray(normalized.skills) ? normalized.skills : [];
  const documents = Array.isArray(normalized.documents) ? normalized.documents : [];

  const addSkill = () => {
    const trimmed = skillInput.trim();
    if (!trimmed) return;
    if (skills.some((skill) => skill.toLowerCase() === trimmed.toLowerCase())) {
      setSkillInput('');
      return;
    }
    patch({ skills: [...skills, trimmed] });
    setSkillInput('');
  };

  const removeSkill = (value: string) => {
    patch({ skills: skills.filter((skill) => skill.toLowerCase() !== value.toLowerCase()) });
  };

  return (
    <div className="space-y-5 rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-sm font-semibold text-slate-900">Internship {index + 1}</p>

      <div className="space-y-4">
        <SectionHeading>Internship Details</SectionHeading>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <FieldLabel label="Internship Title" />
            <input
              value={normalized.internshipTitle || ''}
              onChange={(e) => patch({ internshipTitle: e.target.value })}
              placeholder="e.g., Software Development Intern"
              className={inputClass}
            />
          </label>
          <label className="block">
            <FieldLabel label="Internship Type" />
            <select
              value={normalized.internshipType || ''}
              onChange={(e) => patch({ internshipType: e.target.value })}
              className={inputClass}
            >
              <option value="">Select internship type</option>
              {INTERNSHIP_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <FieldLabel label="Company / Organization Name" />
            <input
              value={normalized.companyName || ''}
              onChange={(e) => patch({ companyName: e.target.value })}
              placeholder="e.g., Zoho Corporation"
              className={inputClass}
            />
          </label>
          <label className="block">
            <FieldLabel label="Domain / Department" />
            <select
              value={normalized.domainDepartment || ''}
              onChange={(e) => patch({ domainDepartment: e.target.value })}
              className={inputClass}
            >
              <option value="">Select domain / department</option>
              {INTERNSHIP_DOMAIN_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
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
          <div>
            <EditDateField
              label="End Date"
              value={normalized.currentlyWorking ? '' : normalized.endDate || ''}
              outputIso
              onChange={(value) => patch({ endDate: value, currentlyWorking: false })}
            />
            <label className="mt-2 flex items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={Boolean(normalized.currentlyWorking)}
                onChange={(e) =>
                  patch({
                    currentlyWorking: e.target.checked,
                    endDate: e.target.checked ? '' : normalized.endDate || '',
                  })
                }
                className="h-4 w-4 rounded text-violet-600 focus:ring-violet-500"
              />
              I am currently working here
            </label>
          </div>
        </div>
      </div>

      <div className="space-y-4 border-t border-slate-100 pt-4">
        <SectionHeading>Location & Mode</SectionHeading>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="relative">
            <FieldLabel
              label="Location"
              hint="Start typing a city or country and select a suggested location"
            />
            <input
              value={locationQuery}
              onChange={(e) => {
                setLocationQuery(e.target.value);
                patch({ location: e.target.value });
                setLocationOpen(true);
              }}
              onFocus={() => setLocationOpen(true)}
              placeholder="Type city or country, then pick from the list"
              className={inputClass}
            />
            {locationOpen && locationHits.length > 0 ? (
              <div className="absolute z-20 mt-1 max-h-48 w-full overflow-auto rounded-lg border border-slate-200 bg-white shadow-lg">
                {locationHits.map((hit) => (
                  <button
                    key={`${hit.city.countryCode}-${hit.city.stateCode}-${hit.city.name}`}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      setLocationQuery(hit.displayName);
                      patch({ location: hit.displayName });
                      setLocationOpen(false);
                    }}
                    className="block w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-violet-50"
                  >
                    {hit.displayName}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          <label className="block">
            <FieldLabel label="Work Mode" />
            <select
              value={normalized.workMode || ''}
              onChange={(e) => patch({ workMode: e.target.value })}
              className={inputClass}
            >
              <option value="">Select work mode</option>
              {WORK_MODE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="space-y-4 border-t border-slate-100 pt-4">
        <SectionHeading>Role Details</SectionHeading>
        <label className="block">
          <FieldLabel label="Responsibilities / Tasks Performed" />
          <textarea
            value={normalized.responsibilities || ''}
            onChange={(e) => patch({ responsibilities: e.target.value })}
            placeholder="Describe your main tasks, duties, and contributions..."
            className={textareaClass}
          />
        </label>
        <div>
          <FieldLabel label="Skills Applied" hint="Add skills you used during this internship" />
          <div className="flex gap-2">
            <input
              value={skillInput}
              onChange={(e) => setSkillInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addSkill();
                }
              }}
              placeholder="Add skills you used during this internship..."
              className={inputClass}
            />
            <button
              type="button"
              onClick={addSkill}
              className="shrink-0 rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700"
            >
              Add
            </button>
          </div>
          {skills.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {skills.map((skill) => (
                <span
                  key={skill}
                  className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700"
                >
                  {skill}
                  <button type="button" onClick={() => removeSkill(skill)} aria-label={`Remove ${skill}`}>
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <div className="space-y-4 border-t border-slate-100 pt-4">
        <SectionHeading>Certificates & Documents</SectionHeading>
        <CandidateWorkExperienceDocumentsField
          candidateId={candidateId}
          documents={documents}
          onChange={(nextDocuments) => patch({ documents: nextDocuments })}
          uploadLabel="Upload Your Internship Certificates/Documents"
          readOnlyListLabel="Internship Certificates/Documents"
          uploadCategory="Internship Certificate"
        />
      </div>
    </div>
  );
}
