'use client';

import React from 'react';
import { listToSemicolon } from '@/lib/normalizeCareerPreferencesRecord';
import { parseAvailabilityFields } from '@/lib/candidateCareerPreferencesModel';
import {
  phase1EditGridClass,
  phase1EditInputClass,
  phase1EditLabelClass,
  phase1EditTextareaClass,
} from '@/lib/phase1Typography';
import { CurrencySearchPicker } from '../CurrencySearchPicker';
import { EditDateField } from './EditDateField';

function EditField({
  label,
  value,
  onChange,
  multiline = false,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  multiline?: boolean;
  placeholder?: string;
}) {
  return (
    <label className="block min-w-0">
      <span className={`mb-1 block ${phase1EditLabelClass}`}>{label}</span>
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          placeholder={placeholder}
          className={phase1EditTextareaClass}
        />
      ) : (
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={phase1EditInputClass}
        />
      )}
    </label>
  );
}

function SectionHeading({ title }: { title: string }) {
  return (
    <p className="col-span-full text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</p>
  );
}

type Props = {
  careerPreferences?: Record<string, unknown> | null;
  onChange: (next: Record<string, unknown>) => void;
};

/** Keep in-progress text, including a trailing ";" the user has not finished yet. */
function editableListValue(primary: unknown, fallback?: unknown): string {
  if (typeof primary === 'string') return primary;
  if (Array.isArray(primary) && primary.length) return listToSemicolon(primary);
  if (typeof fallback === 'string') return fallback;
  if (Array.isArray(fallback) && fallback.length) return listToSemicolon(fallback);
  return '';
}

function editableScalar(primary: unknown, fallback?: unknown): string {
  if (typeof primary === 'string') return primary;
  if (primary != null && primary !== '') return String(primary);
  if (typeof fallback === 'string') return fallback;
  if (fallback != null && fallback !== '') return String(fallback);
  return '';
}

export function CandidatePhase1CareerPreferencesEdit({ careerPreferences, onChange }: Props) {
  const prefs =
    careerPreferences && typeof careerPreferences === 'object' ? careerPreferences : {};

  const parsedAvailability = parseAvailabilityFields(prefs.availabilityToStart);
  const earliestStartDate = editableScalar(prefs.earliestStartDate, parsedAvailability.earliestStartDate);
  const describeAvailability = editableScalar(
    prefs.describeAvailability,
    parsedAvailability.describeAvailability,
  );

  const patch = (updates: Record<string, unknown>) => {
    onChange({
      ...(careerPreferences || {}),
      ...updates,
    });
  };

  return (
    <div className={phase1EditGridClass}>
      <SectionHeading title="Current package" />
      <EditField
        label="Current role"
        value={editableScalar(prefs.currentRole)}
        onChange={(v) => patch({ currentRole: v })}
      />
      <div>
        <CurrencySearchPicker
          compact
          label="Current currency"
          value={editableScalar(prefs.currentCurrency)}
          onChange={(code) => patch({ currentCurrency: code })}
        />
      </div>
      <EditField
        label="Current salary type"
        value={editableScalar(prefs.currentSalaryType)}
        onChange={(v) => patch({ currentSalaryType: v })}
      />
      <EditField
        label="Current salary"
        value={editableScalar(prefs.currentSalary)}
        onChange={(v) => patch({ currentSalary: v })}
      />
      <EditField
        label="Current location"
        value={editableScalar(prefs.currentLocation)}
        onChange={(v) => patch({ currentLocation: v })}
      />
      <EditField
        label="Current benefits (; separated)"
        value={editableListValue(prefs.currentBenefits)}
        onChange={(v) => patch({ currentBenefits: v })}
      />

      <SectionHeading title="Preferred package" />
      <EditField
        label="Preferred roles (; separated)"
        value={editableListValue(prefs.preferredRoles, prefs.preferredJobTitles)}
        onChange={(v) => patch({ preferredRoles: v, preferredJobTitles: v })}
      />
      <div>
        <CurrencySearchPicker
          compact
          label="Preferred currency"
          value={editableScalar(prefs.preferredCurrency, prefs.salaryCurrency)}
          onChange={(code) => patch({ preferredCurrency: code, salaryCurrency: code })}
        />
      </div>
      <EditField
        label="Preferred salary type"
        value={editableScalar(prefs.preferredSalaryType, prefs.salaryFrequency)}
        onChange={(v) => patch({ preferredSalaryType: v, salaryFrequency: v })}
      />
      <EditField
        label="Preferred salary"
        value={editableScalar(prefs.preferredSalary, prefs.salaryAmount)}
        onChange={(v) => patch({ preferredSalary: v, salaryAmount: v })}
      />
      <EditField
        label="Preferred locations (; separated)"
        value={editableListValue(prefs.preferredLocations)}
        onChange={(v) => patch({ preferredLocations: v })}
      />
      <EditField
        label="Preferred work modes (; separated)"
        value={editableListValue(prefs.workModes, prefs.preferredWorkMode)}
        onChange={(v) => patch({ workModes: v })}
        placeholder="Remote; On-site; Hybrid"
      />
      <EditField
        label="Preferred benefits (; separated)"
        value={editableListValue(prefs.preferredBenefits)}
        onChange={(v) => patch({ preferredBenefits: v })}
      />

      <SectionHeading title="Role & domain" />
      <EditField
        label="Preferred industries (; separated)"
        value={editableListValue(prefs.preferredIndustries, prefs.preferredIndustry)}
        onChange={(v) => patch({ preferredIndustries: v, preferredIndustry: v })}
      />
      <EditField
        label="Functional areas (; separated)"
        value={editableListValue(prefs.functionalAreas, prefs.functionalArea)}
        onChange={(v) => patch({ functionalAreas: v, functionalArea: v })}
      />
      <EditField
        label="Job types (; separated)"
        value={editableListValue(prefs.jobTypes)}
        onChange={(v) => patch({ jobTypes: v })}
        placeholder="Full-time; Contract; Part-time"
      />

      <SectionHeading title="Relocation & availability" />
      <EditField
        label="Relocation preference"
        value={editableScalar(prefs.relocationPreference)}
        onChange={(v) => patch({ relocationPreference: v })}
        placeholder="Open to Relocate"
      />
      <EditField
        label="Notice period"
        value={editableScalar(prefs.noticePeriod)}
        onChange={(v) => patch({ noticePeriod: v })}
      />
      <EditDateField
        label="Earliest start date"
        value={earliestStartDate}
        outputIso
        onChange={(v) => patch({ earliestStartDate: v, availabilityToStart: v })}
      />
      <EditField
        label="Describe availability"
        value={describeAvailability}
        onChange={(v) => patch({ describeAvailability: v })}
      />
    </div>
  );
}
