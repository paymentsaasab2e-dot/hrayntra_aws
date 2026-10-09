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
import {
  isCandidateEditFieldVisible,
  type CandidateEditFieldId,
  type CandidateEditFieldVisibility,
} from '@/lib/candidateEditFieldVisibility';
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
  /** When set, gates fields by tenant Edit Candidate visibility. Null = show all (Submit to Client). */
  fieldVisibility?: Partial<CandidateEditFieldVisibility> | null;
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

export function CandidatePhase1CareerPreferencesEdit({
  careerPreferences,
  onChange,
  fieldVisibility = null,
}: Props) {
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

  const gated = fieldVisibility != null;
  const show = (id: CandidateEditFieldId) =>
    !gated || isCandidateEditFieldVisible(fieldVisibility, id);

  // Designation / organization are edited as dedicated form fields outside this block.
  const showCurrentPackage =
    show('location') ||
    show('currentTitle') ||
    show('currentCompany') ||
    show('currentSalary') ||
    show('currentBenefits') ||
    show('careerCurrentCurrency') ||
    show('careerCurrentSalaryType') ||
    show('currentSalaryCurrency');
  const showPreferredPackage =
    show('expectedSalary') ||
    show('expectedBenefits') ||
    show('careerPreferredRoles') ||
    show('careerPreferredCurrency') ||
    show('careerPreferredSalaryType') ||
    show('careerPreferredLocations') ||
    show('careerWorkModes') ||
    show('expectedSalaryCurrency');
  const showRoleDomain =
    show('careerPreferredIndustries') ||
    show('careerFunctionalAreas') ||
    show('careerJobTypes');
  const showRelocationAvailability =
    show('careerRelocation') ||
    show('noticePeriod') ||
    show('careerEarliestStart') ||
    show('careerDescribeAvailability') ||
    show('remarks');

  if (
    gated &&
    !showCurrentPackage &&
    !showPreferredPackage &&
    !showRoleDomain &&
    !showRelocationAvailability
  ) {
    return null;
  }

  return (
    <div className={phase1EditGridClass}>
      {showCurrentPackage ? <SectionHeading title="Current package" /> : null}
      {show('careerCurrentCurrency') || show('currentSalaryCurrency') ? (
        <div>
          <CurrencySearchPicker
            compact
            label="Current currency"
            value={editableScalar(prefs.currentCurrency)}
            onChange={(code) => patch({ currentCurrency: code })}
          />
        </div>
      ) : null}
      {show('careerCurrentSalaryType') ? (
        <EditField
          label="Current salary type"
          value={editableScalar(prefs.currentSalaryType)}
          onChange={(v) => patch({ currentSalaryType: v })}
        />
      ) : null}
      {show('currentTitle') ? (
        <EditField
          label="Designation"
          value={editableScalar(prefs.currentRole)}
          onChange={(v) => patch({ currentRole: v })}
        />
      ) : null}
      {show('currentCompany') ? (
        <EditField
          label="Current Organization"
          value={editableScalar(prefs.currentCompany, prefs.currentEmployer)}
          onChange={(v) => patch({ currentCompany: v, currentEmployer: v })}
        />
      ) : null}
      {show('currentSalary') ? (
        <EditField
          label="Current Salary"
          value={editableScalar(prefs.currentSalary)}
          onChange={(v) => patch({ currentSalary: v })}
        />
      ) : null}
      {show('location') ? (
        <EditField
          label="Current Location"
          value={editableScalar(prefs.currentLocation)}
          onChange={(v) => patch({ currentLocation: v })}
        />
      ) : null}
      {show('currentBenefits') ? (
        <EditField
          label="Current Benefits"
          value={editableListValue(prefs.currentBenefits)}
          onChange={(v) => patch({ currentBenefits: v })}
        />
      ) : null}

      {showPreferredPackage ? <SectionHeading title="Preferred package" /> : null}
      {show('careerPreferredRoles') ? (
        <EditField
          label="Preferred roles (; separated)"
          value={editableListValue(prefs.preferredRoles, prefs.preferredJobTitles)}
          onChange={(v) => patch({ preferredRoles: v, preferredJobTitles: v })}
        />
      ) : null}
      {show('careerPreferredCurrency') || show('expectedSalaryCurrency') ? (
        <div>
          <CurrencySearchPicker
            compact
            label="Preferred currency"
            value={editableScalar(prefs.preferredCurrency, prefs.salaryCurrency)}
            onChange={(code) => patch({ preferredCurrency: code, salaryCurrency: code })}
          />
        </div>
      ) : null}
      {show('careerPreferredSalaryType') ? (
        <EditField
          label="Preferred salary type"
          value={editableScalar(prefs.preferredSalaryType, prefs.salaryFrequency)}
          onChange={(v) => patch({ preferredSalaryType: v, salaryFrequency: v })}
        />
      ) : null}
      {show('expectedSalary') ? (
        <EditField
          label="Expected Salary"
          value={editableScalar(prefs.preferredSalary, prefs.salaryAmount)}
          onChange={(v) => patch({ preferredSalary: v, salaryAmount: v })}
        />
      ) : null}
      {show('careerPreferredLocations') ? (
        <EditField
          label="Preferred locations (; separated)"
          value={editableListValue(prefs.preferredLocations)}
          onChange={(v) => patch({ preferredLocations: v })}
        />
      ) : null}
      {show('careerWorkModes') ? (
        <EditField
          label="Preferred work modes (; separated)"
          value={editableListValue(prefs.workModes, prefs.preferredWorkMode)}
          onChange={(v) => patch({ workModes: v })}
          placeholder="Remote; On-site; Hybrid"
        />
      ) : null}
      {show('expectedBenefits') ? (
        <EditField
          label="Expected Benefits"
          value={editableListValue(prefs.preferredBenefits)}
          onChange={(v) => patch({ preferredBenefits: v })}
        />
      ) : null}

      {showRoleDomain ? <SectionHeading title="Role & domain" /> : null}
      {show('careerPreferredIndustries') ? (
        <EditField
          label="Preferred industries (; separated)"
          value={editableListValue(prefs.preferredIndustries, prefs.preferredIndustry)}
          onChange={(v) => patch({ preferredIndustries: v, preferredIndustry: v })}
        />
      ) : null}
      {show('careerFunctionalAreas') ? (
        <EditField
          label="Functional areas (; separated)"
          value={editableListValue(prefs.functionalAreas, prefs.functionalArea)}
          onChange={(v) => patch({ functionalAreas: v, functionalArea: v })}
        />
      ) : null}
      {show('careerJobTypes') ? (
        <EditField
          label="Job types (; separated)"
          value={editableListValue(prefs.jobTypes)}
          onChange={(v) => patch({ jobTypes: v })}
          placeholder="Full-time; Contract; Part-time"
        />
      ) : null}

      {showRelocationAvailability ? (
        <SectionHeading title="Relocation & availability" />
      ) : null}
      {show('careerRelocation') ? (
        <EditField
          label="Relocation preference"
          value={editableScalar(prefs.relocationPreference)}
          onChange={(v) => patch({ relocationPreference: v })}
          placeholder="Open to Relocate"
        />
      ) : null}
      {show('noticePeriod') ? (
        <EditField
          label="Notice Period"
          value={editableScalar(prefs.noticePeriod)}
          onChange={(v) => patch({ noticePeriod: v })}
        />
      ) : null}
      {show('careerEarliestStart') ? (
        <EditDateField
          label="Earliest start date"
          value={earliestStartDate}
          outputIso
          onChange={(v) => patch({ earliestStartDate: v, availabilityToStart: v })}
        />
      ) : null}
      {show('careerDescribeAvailability') ? (
        <EditField
          label="Describe availability"
          value={describeAvailability}
          onChange={(v) => patch({ describeAvailability: v })}
        />
      ) : null}
      {show('remarks') ? (
        <EditField
          label="Reason for Current Job Change"
          value={editableScalar(prefs.reasonForJobChange, prefs.remarks)}
          onChange={(v) => patch({ reasonForJobChange: v, remarks: v })}
          multiline
        />
      ) : null}
    </div>
  );
}
