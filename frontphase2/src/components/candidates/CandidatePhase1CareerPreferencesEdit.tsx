'use client';

import React, { useMemo } from 'react';
import {
  listToSemicolon,
  normalizeCareerPreferencesRecord,
} from '@/lib/normalizeCareerPreferencesRecord';
import { parseAvailabilityFields } from '@/lib/candidateCareerPreferencesModel';
import { phase1FieldLabelClass, phase1FieldValueClass } from '@/lib/phase1Typography';
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
    <label className="block">
      <span className={`mb-1.5 block ${phase1FieldLabelClass}`}>{label}</span>
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          placeholder={placeholder}
          className={`w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 ${phase1FieldValueClass}`}
        />
      ) : (
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={`w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 ${phase1FieldValueClass}`}
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

export function CandidatePhase1CareerPreferencesEdit({ careerPreferences, onChange }: Props) {
  const prefs = useMemo(
    () => normalizeCareerPreferencesRecord(careerPreferences || {}) || {},
    [careerPreferences],
  );

  const availability = parseAvailabilityFields(prefs.availabilityToStart);

  const patch = (updates: Record<string, unknown>) => {
    onChange({
      ...(careerPreferences || {}),
      ...updates,
    });
  };

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <SectionHeading title="Current package" />
      <EditField
        label="Current role"
        value={String(prefs.currentRole ?? '')}
        onChange={(v) => patch({ currentRole: v })}
      />
      <EditField
        label="Current currency"
        value={String(prefs.currentCurrency ?? '')}
        onChange={(v) => patch({ currentCurrency: v })}
      />
      <EditField
        label="Current salary type"
        value={String(prefs.currentSalaryType ?? '')}
        onChange={(v) => patch({ currentSalaryType: v })}
      />
      <EditField
        label="Current salary"
        value={prefs.currentSalary != null ? String(prefs.currentSalary) : ''}
        onChange={(v) => patch({ currentSalary: v })}
      />
      <EditField
        label="Current location"
        value={String(prefs.currentLocation ?? '')}
        onChange={(v) => patch({ currentLocation: v })}
      />
      <div className="sm:col-span-2">
        <EditField
          label="Current benefits (; separated)"
          value={listToSemicolon(prefs.currentBenefits)}
          onChange={(v) => patch({ currentBenefits: v })}
        />
      </div>

      <SectionHeading title="Preferred package" />
      <div className="sm:col-span-2">
        <EditField
          label="Preferred roles (; separated)"
          value={listToSemicolon(prefs.preferredRoles || prefs.preferredJobTitles)}
          onChange={(v) => patch({ preferredRoles: v, preferredJobTitles: v })}
        />
      </div>
      <EditField
        label="Preferred currency"
        value={String(prefs.preferredCurrency ?? prefs.salaryCurrency ?? '')}
        onChange={(v) => patch({ preferredCurrency: v, salaryCurrency: v })}
      />
      <EditField
        label="Preferred salary type"
        value={String(prefs.preferredSalaryType ?? prefs.salaryFrequency ?? '')}
        onChange={(v) => patch({ preferredSalaryType: v, salaryFrequency: v })}
      />
      <EditField
        label="Preferred salary"
        value={
          prefs.preferredSalary != null
            ? String(prefs.preferredSalary)
            : prefs.salaryAmount != null
              ? String(prefs.salaryAmount)
              : ''
        }
        onChange={(v) => patch({ preferredSalary: v, salaryAmount: v })}
      />
      <div className="sm:col-span-2">
        <EditField
          label="Preferred locations (; separated)"
          value={listToSemicolon(prefs.preferredLocations)}
          onChange={(v) => patch({ preferredLocations: v })}
        />
      </div>
      <div className="sm:col-span-2">
        <EditField
          label="Preferred work modes (; separated)"
          value={listToSemicolon(prefs.workModes)}
          onChange={(v) => patch({ workModes: v })}
          placeholder="Remote; On-site; Hybrid"
        />
      </div>
      <div className="sm:col-span-2">
        <EditField
          label="Preferred benefits (; separated)"
          value={listToSemicolon(prefs.preferredBenefits)}
          onChange={(v) => patch({ preferredBenefits: v })}
        />
      </div>

      <SectionHeading title="Role & domain" />
      <div className="sm:col-span-2">
        <EditField
          label="Preferred industries (; separated)"
          value={listToSemicolon(prefs.preferredIndustries || prefs.preferredIndustry)}
          onChange={(v) => patch({ preferredIndustries: v, preferredIndustry: v })}
        />
      </div>
      <div className="sm:col-span-2">
        <EditField
          label="Functional areas (; separated)"
          value={listToSemicolon(prefs.functionalAreas || prefs.functionalArea)}
          onChange={(v) => patch({ functionalAreas: v, functionalArea: v })}
        />
      </div>
      <div className="sm:col-span-2">
        <EditField
          label="Job types (; separated)"
          value={listToSemicolon(prefs.jobTypes)}
          onChange={(v) => patch({ jobTypes: v })}
          placeholder="Full-time; Contract; Part-time"
        />
      </div>

      <SectionHeading title="Relocation & availability" />
      <EditField
        label="Relocation preference"
        value={String(prefs.relocationPreference ?? '')}
        onChange={(v) => patch({ relocationPreference: v })}
        placeholder="Open to Relocate"
      />
      <EditField
        label="Notice period"
        value={String(prefs.noticePeriod ?? '')}
        onChange={(v) => patch({ noticePeriod: v })}
      />
      <EditDateField
        label="Earliest start date"
        value={availability.earliestStartDate}
        outputIso
        onChange={(v) => patch({ earliestStartDate: v, availabilityToStart: v })}
      />
      <EditField
        label="Describe availability"
        value={availability.describeAvailability}
        onChange={(v) => patch({ describeAvailability: v })}
      />
    </div>
  );
}
