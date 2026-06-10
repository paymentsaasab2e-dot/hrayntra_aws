'use client';

import React, { useState } from 'react';
import { X } from 'lucide-react';
import {
  GAP_CATEGORY_OPTIONS,
  GAP_DURATION_OPTIONS,
  GAP_PREFERRED_SUPPORT_OPTIONS,
  GAP_REASON_OPTIONS,
  MAX_GAP_SKILLS,
  normalizeGapExplanationRecord,
  type GapPreferredSupport,
} from '@/lib/candidateGapExplanationFields';
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

export function CandidateGapExplanationEntryEdit({
  entry,
  index,
  onChange,
}: {
  entry: Record<string, unknown>;
  index: number;
  onChange: (index: number, patch: Record<string, unknown>) => void;
}) {
  const normalized = normalizeGapExplanationRecord(entry);
  const [skillInput, setSkillInput] = useState('');
  const skills = Array.isArray(normalized.selectedSkills) ? normalized.selectedSkills : [];
  const preferredSupport: GapPreferredSupport = normalized.preferredSupport || {};

  const patch = (patchValue: Record<string, unknown>) => onChange(index, patchValue);

  const addSkill = () => {
    const trimmed = skillInput.trim();
    if (!trimmed || skills.length >= MAX_GAP_SKILLS) return;
    if (skills.some((skill) => skill.toLowerCase() === trimmed.toLowerCase())) {
      setSkillInput('');
      return;
    }
    patch({ selectedSkills: [...skills, trimmed] });
    setSkillInput('');
  };

  const removeSkill = (value: string) => {
    patch({
      selectedSkills: skills.filter((skill) => skill.toLowerCase() !== value.toLowerCase()),
    });
  };

  const toggleSupport = (key: keyof GapPreferredSupport, checked: boolean) => {
    patch({
      preferredSupport: {
        ...preferredSupport,
        [key]: checked,
      },
    });
  };

  return (
    <div className="space-y-5 rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-sm font-semibold text-slate-900">Employment gap {index + 1}</p>

      <div className="space-y-4">
        <SectionHeading>Gap Category</SectionHeading>
        <div className="flex flex-wrap gap-6">
          {GAP_CATEGORY_OPTIONS.map((category) => (
            <label key={category} className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="radio"
                name={`gap-category-${index}`}
                value={category}
                checked={normalized.gapCategory === category}
                onChange={() => patch({ gapCategory: category })}
                className="h-4 w-4 text-violet-600 focus:ring-violet-500"
              />
              {category}
            </label>
          ))}
        </div>
      </div>

      <div className="space-y-4 border-t border-slate-100 pt-4">
        <SectionHeading>Reason & Duration</SectionHeading>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <FieldLabel label="Reason for Gap" />
            <select
              value={normalized.reasonForGap || ''}
              onChange={(e) => patch({ reasonForGap: e.target.value })}
              className={inputClass}
            >
              <option value="">Select a reason</option>
              {GAP_REASON_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <FieldLabel
              label="Gap Duration"
              hint="Pre-filled from onboarding — you can edit if incorrect."
            />
            <select
              value={normalized.gapDuration || ''}
              onChange={(e) => patch({ gapDuration: e.target.value })}
              className={inputClass}
            >
              <option value="">Select gap duration</option>
              {GAP_DURATION_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="space-y-4 border-t border-slate-100 pt-4">
        <SectionHeading>Skills You Continued During the Gap</SectionHeading>
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
            placeholder="Type a skill and press Enter..."
            className={inputClass}
          />
          <button
            type="button"
            onClick={addSkill}
            disabled={!skillInput.trim() || skills.length >= MAX_GAP_SKILLS}
            className="shrink-0 rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Add
          </button>
        </div>
        <p className="text-[11px] text-slate-400">Allow up to ~{MAX_GAP_SKILLS} skills</p>
        {skills.length > 0 ? (
          <div className="flex flex-wrap gap-2">
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

      <div className="space-y-4 border-t border-slate-100 pt-4">
        <SectionHeading>Courses, Trainings, or Certifications</SectionHeading>
        <textarea
          value={normalized.coursesText || ''}
          onChange={(e) => patch({ coursesText: e.target.value })}
          placeholder="e.g., Completed a Data Science bootcamp, obtained PMP certification, attended workshops on Agile methodologies."
          className={textareaClass}
        />
      </div>

      <div className="space-y-4 border-t border-slate-100 pt-4">
        <SectionHeading>Preferred Support When Returning to Work</SectionHeading>
        <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/60 p-3">
          {GAP_PREFERRED_SUPPORT_OPTIONS.map((option) => (
            <label key={option.key} className="flex items-center gap-3 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={preferredSupport[option.key as keyof GapPreferredSupport] === true}
                onChange={(e) =>
                  toggleSupport(option.key as keyof GapPreferredSupport, e.target.checked)
                }
                className="h-4 w-4 rounded text-violet-600 focus:ring-violet-500"
              />
              {option.label}
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}
