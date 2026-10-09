'use client';

import React from 'react';
import { Briefcase, GraduationCap, User } from 'lucide-react';
import type { CandidateEditFormState } from './CandidateEditAtsSections';
import {
  isCandidateEditFieldVisible,
  type CandidateEditFieldId,
  type CandidateEditFieldVisibility,
} from '@/lib/candidateEditFieldVisibility';
import { CandidateHiringEditSection } from './CandidateHiringSection';
import { CandidatePhotoUpload } from './AddCandidateFormSections';

const GENDER_OPTIONS = [
  { label: 'Male', value: 'Male' },
  { label: 'Female', value: 'Female' },
  { label: 'Other', value: 'Other' },
  { label: 'Prefer not to say', value: 'Prefer not to say' },
];

function EditField({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
      />
    </label>
  );
}

function EditSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{ label: string; value: string }>;
  onChange: (value: string) => void;
}) {
  const selectOptions =
    value && !options.some((option) => option.value === value)
      ? [...options, { label: value, value }]
      : options;
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
      >
        <option value="">Select</option>
        {selectOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function EditTextarea({
  label,
  value,
  onChange,
  rows = 3,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
}) {
  return (
    <label className="block md:col-span-2">
      <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={rows}
        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
      />
    </label>
  );
}

function Section({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: typeof User;
  children: React.ReactNode;
}) {
  const childList = React.Children.toArray(children).filter(Boolean);
  if (childList.length === 0) return null;
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50/80">
      <div className="flex items-center gap-2 border-b border-slate-200/80 bg-white/60 px-4 py-3">
        <span className="rounded-lg bg-white p-2 text-indigo-600 shadow-sm ring-1 ring-slate-200/80">
          <Icon size={16} />
        </span>
        <h4 className="text-sm font-bold text-slate-900">{title}</h4>
      </div>
      <div className="grid grid-cols-1 gap-4 p-4 md:grid-cols-2">{childList}</div>
    </section>
  );
}

type Props = {
  form: CandidateEditFormState;
  onChange: <K extends keyof CandidateEditFormState>(
    field: K,
    value: CandidateEditFormState[K],
  ) => void;
  recruiters: Array<{ id: string; name: string }>;
  jobs: Array<{ id: string; title: string; department?: string | null }>;
  fieldVisibility: Partial<CandidateEditFieldVisibility> | null | undefined;
  avatarPreview?: string;
  onAvatarFile?: (file: File) => void;
  onAvatarRemove?: () => void;
  /** Extra fields enabled in Settings — rendered in Additional sections. */
  extraFields?: React.ReactNode;
};

function careerScalar(prefs: Record<string, unknown> | undefined, key: string, fallback = ''): string {
  const raw = prefs?.[key];
  if (raw == null || raw === '') return fallback;
  if (Array.isArray(raw)) return raw.map(String).filter(Boolean).join('; ');
  return String(raw);
}

/**
 * Compact Edit Candidate layout: only the tenant-visible fields, grouped into
 * Personal / Professional / Qualification & Languages.
 */
export function CandidateStreamlinedProfileEdit({
  form,
  onChange,
  recruiters,
  jobs,
  fieldVisibility,
  avatarPreview = '',
  onAvatarFile,
  onAvatarRemove,
  extraFields,
}: Props) {
  const show = (id: CandidateEditFieldId) => isCandidateEditFieldVisible(fieldVisibility, id);
  const prefs = (form.careerPreferences || {}) as Record<string, unknown>;

  const patchCareer = (updates: Record<string, unknown>) => {
    onChange('careerPreferences', { ...prefs, ...updates });
  };

  const currentSalaryValue = form.currentSalary || careerScalar(prefs, 'currentSalary');
  const currentBenefitsValue =
    form.currentBenefits || careerScalar(prefs, 'currentBenefits');
  const expectedSalaryValue =
    form.expectedSalary ||
    careerScalar(prefs, 'preferredSalary') ||
    careerScalar(prefs, 'salaryAmount');
  const expectedBenefitsValue =
    form.expectedBenefits || careerScalar(prefs, 'preferredBenefits');
  const noticePeriodValue = form.noticePeriod || careerScalar(prefs, 'noticePeriod');
  const locationValue = form.location || careerScalar(prefs, 'currentLocation');

  return (
    <div className="space-y-5">
      <CandidateHiringEditSection
        form={form}
        onChange={onChange}
        recruiters={recruiters}
        jobs={jobs}
        fieldVisibility={fieldVisibility}
      />

      {onAvatarFile && onAvatarRemove && show('avatar') ? (
        <CandidatePhotoUpload
          preview={avatarPreview || form.avatar}
          onSelectFile={onAvatarFile}
          onRemove={onAvatarRemove}
        />
      ) : null}

      <Section title="Personal Information" icon={User}>
        {show('fullName') ? (
          <EditField
            label="Name (First)"
            value={form.firstName}
            onChange={(v) => onChange('firstName', v)}
          />
        ) : null}
        {show('fullName') ? (
          <EditField
            label="Name (Last)"
            value={form.lastName}
            onChange={(v) => onChange('lastName', v)}
          />
        ) : null}
        {show('phone') ? (
          <EditField
            label="Phone number"
            value={form.phone}
            onChange={(v) => onChange('phone', v)}
          />
        ) : null}
        {show('email') ? (
          <EditField
            label="E-mail"
            value={form.email}
            onChange={(v) => onChange('email', v)}
            type="email"
          />
        ) : null}
        {show('location') ? (
          <EditField
            label="Current Location"
            value={locationValue}
            onChange={(v) => {
              onChange('location', v);
              patchCareer({ currentLocation: v });
            }}
          />
        ) : null}
        {show('age') ? (
          <EditField
            label="Age"
            value={form.age}
            onChange={(v) => onChange('age', v)}
            type="number"
          />
        ) : null}
        {show('gender') ? (
          <EditSelect
            label="Gender"
            value={form.gender}
            options={GENDER_OPTIONS}
            onChange={(v) => onChange('gender', v)}
          />
        ) : null}
        {show('maritalStatus') ? (
          <EditField
            label="Marital Status"
            value={form.maritalStatus}
            onChange={(v) => onChange('maritalStatus', v)}
          />
        ) : null}
        {show('nationality') ? (
          <EditField
            label="Nationality"
            value={form.nationality}
            onChange={(v) => onChange('nationality', v)}
          />
        ) : null}
        {show('passportNumber') ? (
          <EditField
            label="Passport number"
            value={form.passportNumber}
            onChange={(v) => onChange('passportNumber', v)}
          />
        ) : null}
      </Section>

      <Section title="Professional Details" icon={Briefcase}>
        {show('currentCompany') ? (
          <EditField
            label="Current Organization"
            value={form.currentCompany}
            onChange={(v) => onChange('currentCompany', v)}
          />
        ) : null}
        {show('currentTitle') ? (
          <EditField
            label="Designation"
            value={form.currentTitle || careerScalar(prefs, 'currentRole')}
            onChange={(v) => {
              onChange('currentTitle', v);
              patchCareer({ currentRole: v });
            }}
          />
        ) : null}
        {show('experience') ? (
          <EditField
            label="Total Years of experience"
            value={form.experience}
            onChange={(v) => onChange('experience', v)}
            placeholder="e.g. 5"
          />
        ) : null}
        {show('currentSalary') ? (
          <EditField
            label="Current Salary"
            value={currentSalaryValue}
            onChange={(v) => {
              onChange('currentSalary', v);
              patchCareer({ currentSalary: v });
            }}
          />
        ) : null}
        {show('currentBenefits') ? (
          <EditField
            label="Current Benefits"
            value={currentBenefitsValue}
            onChange={(v) => {
              onChange('currentBenefits', v);
              patchCareer({ currentBenefits: v });
            }}
          />
        ) : null}
        {show('expectedSalary') ? (
          <EditField
            label="Expected Salary"
            value={expectedSalaryValue}
            onChange={(v) => {
              onChange('expectedSalary', v);
              patchCareer({ preferredSalary: v, salaryAmount: v });
            }}
          />
        ) : null}
        {show('expectedBenefits') ? (
          <EditField
            label="Expected Benefits"
            value={expectedBenefitsValue}
            onChange={(v) => {
              onChange('expectedBenefits', v);
              patchCareer({ preferredBenefits: v });
            }}
          />
        ) : null}
        {show('noticePeriod') ? (
          <EditField
            label="Notice Period"
            value={noticePeriodValue}
            onChange={(v) => {
              onChange('noticePeriod', v);
              patchCareer({ noticePeriod: v });
            }}
          />
        ) : null}
        {show('remarks') ? (
          <EditTextarea
            label="Reason for Current Job Change"
            value={
              form.remarks ||
              careerScalar(prefs, 'reasonForJobChange') ||
              careerScalar(prefs, 'remarks')
            }
            onChange={(v) => {
              onChange('remarks', v);
              patchCareer({ reasonForJobChange: v, remarks: v });
            }}
            rows={3}
          />
        ) : null}
      </Section>

      <Section title="Qualification & Languages" icon={GraduationCap}>
        {show('educationSummary') ? (
          <EditTextarea
            label="Qualification"
            value={form.educationSummary || form.education}
            onChange={(v) => {
              onChange('educationSummary', v);
              onChange('education', v);
            }}
            rows={2}
          />
        ) : null}
        {show('languageProficiency') ? (
          <EditTextarea
            label="Language known"
            value={form.languageProficiency || form.languages}
            onChange={(v) => {
              onChange('languageProficiency', v);
              onChange('languages', v);
            }}
            rows={3}
          />
        ) : null}
      </Section>

      {extraFields}
    </div>
  );
}
