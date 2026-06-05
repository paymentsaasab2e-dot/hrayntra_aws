'use client';

import React, { useState } from 'react';
import { Check, ChevronDown, FileText, Plus, Upload, UserRound, X } from 'lucide-react';
import { ResumeUploadReadyCard } from './ResumeUploadReadyCard';
import { normalizeCandidateEmailInput } from '../../lib/candidateEmailValidation';
import {
  EMPTY_EDUCATION_ENTRY,
  EDUCATION_LEVEL_OPTIONS,
  EDUCATION_MONTH_OPTIONS,
  buildEducationYearOptions,
  formatEducationDateLine,
  formatEducationTitle,
  formatInstitutionLine,
  isSchoolCertificateEntry,
  normalizeEducationRow,
} from '../../lib/candidateEducation';

export const CANDIDATE_FORM_STEPS = [
  { id: 1, label: 'Personal Information' },
  { id: 2, label: 'Education' },
  { id: 3, label: 'Professional Information' },
  { id: 4, label: 'Social Network Information' },
  { id: 5, label: 'Summary & Additional' },
];

const inputClass =
  'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20';
const labelClass = 'text-xs font-semibold text-slate-700';

export function calculateAgeFromBirthDate(birthDate) {
  if (!birthDate) return '';
  const born = new Date(birthDate);
  if (Number.isNaN(born.getTime())) return '';
  const today = new Date();
  let age = today.getFullYear() - born.getFullYear();
  const monthDiff = today.getMonth() - born.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < born.getDate())) {
    age -= 1;
  }
  return age >= 0 ? String(age) : '';
}

function DrawerInput({
  label,
  required,
  value,
  onChange,
  placeholder,
  error,
  onBlur,
  type = 'text',
  suffix,
  autoFilled,
  readOnly,
  children,
  inputRef,
  maxLength,
  hint,
}) {
  return (
    <div className="space-y-1.5">
      <label className={`flex items-center gap-2 ${labelClass}`}>
        <span>
          {label}
          {required ? ' *' : ''}
        </span>
        {autoFilled ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
            <Check size={11} />
            Auto-filled
          </span>
        ) : null}
      </label>
      {children || (
        <div className="relative">
          <input
            ref={inputRef}
            type={type}
            value={value}
            onChange={onChange}
            onBlur={onBlur}
            readOnly={readOnly}
            placeholder={placeholder}
            maxLength={maxLength}
            className={`${inputClass} ${error ? 'border-red-400' : ''} ${suffix ? 'pr-16' : ''} ${
              readOnly ? 'cursor-not-allowed bg-slate-50 text-slate-600' : ''
            }`}
          />
          {suffix ? (
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">
              {suffix}
            </span>
          ) : null}
        </div>
      )}
      {hint ? <p className="text-xs text-slate-500">{hint}</p> : null}
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  );
}

function PillButton({ active, children, onClick, tone = 'blue' }) {
  const toneClasses = {
    blue: active ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-200',
    green: active ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-slate-600 border-slate-200',
    slate: active ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200',
  };
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${toneClasses[tone] || toneClasses.blue}`}
    >
      {children}
    </button>
  );
}

function SearchableDropdown({
  label,
  value,
  onSelect,
  options,
  placeholder,
  getLabel,
  getSecondary,
  error,
  emptyMessage,
  disabled = false,
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const selected = options.find((option) => option.id === value) || null;
  const filteredOptions = options.filter((option) => {
    const primary = getLabel(option).toLowerCase();
    const secondary = (getSecondary?.(option) || '').toLowerCase();
    const q = query.toLowerCase();
    return primary.includes(q) || secondary.includes(q);
  });

  return (
    <div className="space-y-1.5">
      <label className={labelClass}>{label}</label>
      <div className="relative">
        <button
          type="button"
          disabled={disabled}
          onClick={() => !disabled && setOpen((v) => !v)}
          className={`flex w-full items-center justify-between rounded-xl border bg-white px-3 py-2.5 text-left text-sm ${
            error ? 'border-red-400' : 'border-slate-200'
          } ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}
        >
          {selected ? (
            <span className="text-slate-800">{getLabel(selected)}</span>
          ) : (
            <span className="text-slate-400">{placeholder}</span>
          )}
          <ChevronDown size={16} className="shrink-0 text-slate-400" />
        </button>
        {open ? (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
            <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
              <div className="border-b border-slate-100 p-2">
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search…"
                  autoFocus
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-blue-400"
                />
              </div>
              <ul className="max-h-48 overflow-y-auto py-1">
                {filteredOptions.length === 0 ? (
                  <li className="px-3 py-2 text-sm text-slate-500">{emptyMessage || 'No results'}</li>
                ) : (
                  filteredOptions.map((option) => (
                    <li key={option.id}>
                      <button
                        type="button"
                        onClick={() => {
                          onSelect(option.id);
                          setOpen(false);
                          setQuery('');
                        }}
                        className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50"
                      >
                        <span className="block font-medium text-slate-800">{getLabel(option)}</span>
                        {getSecondary?.(option) ? (
                          <span className="block text-xs text-slate-500">{getSecondary(option)}</span>
                        ) : null}
                      </button>
                    </li>
                  ))
                )}
              </ul>
            </div>
          </>
        ) : null}
      </div>
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  );
}

function TagInput({ label, values, onChange, placeholder, helperText, maxItems = 10 }) {
  const [input, setInput] = useState('');
  const add = () => {
    const next = input.trim();
    if (!next || values.includes(next) || values.length >= maxItems) return;
    onChange([...values, next]);
    setInput('');
  };
  return (
    <div className="space-y-1.5">
      <label className={labelClass}>{label}</label>
      <div className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              add();
            }
          }}
          placeholder={placeholder}
          className={inputClass}
        />
        <button type="button" onClick={add} className="rounded-xl border border-slate-200 px-3 text-sm font-medium text-slate-700">
          Add
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        {values.map((tag) => (
          <span key={tag} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
            {tag}
            <button type="button" onClick={() => onChange(values.filter((v) => v !== tag))}>
              <X size={12} />
            </button>
          </span>
        ))}
      </div>
      {helperText ? <p className="text-xs text-slate-500">{helperText}</p> : null}
    </div>
  );
}

function StepPanel({ step, currentStep, title, children }) {
  if (step !== currentStep) return null;
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-blue-100 bg-blue-50/60 px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">
          Step {step} of {CANDIDATE_FORM_STEPS.length}
        </p>
        <h3 className="text-base font-bold text-slate-900">{title}</h3>
      </div>
      {children}
    </div>
  );
}

export function CandidatePhotoUpload({ preview, onSelectFile, onRemove, className = '' }) {
  return (
    <div className={`space-y-2 ${className}`}>
      <label className={labelClass}>Candidate photo (optional)</label>
      <div className="flex flex-col gap-4 rounded-2xl border border-dashed border-slate-300 bg-gradient-to-br from-slate-50 to-white p-4 sm:flex-row sm:items-center">
        {preview ? (
          <img
            src={preview}
            alt="Candidate preview"
            className="h-24 w-24 shrink-0 rounded-full border-2 border-white object-cover shadow-md ring-2 ring-slate-200"
          />
        ) : (
          <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-full border-2 border-dashed border-slate-200 bg-white text-slate-400">
            <UserRound size={36} />
          </div>
        )}
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <p className="text-sm text-slate-600">
            Upload a profile image for this candidate. It appears in the candidates list and profile drawer.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <label className="inline-flex cursor-pointer items-center justify-center rounded-xl bg-[#2563EB] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#1D4ED8]">
              {preview ? 'Change photo' : 'Upload image'}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) onSelectFile(file);
                  e.target.value = '';
                }}
              />
            </label>
            {preview ? (
              <button
                type="button"
                onClick={onRemove}
                className="rounded-xl border border-red-200 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50"
              >
                Remove
              </button>
            ) : null}
          </div>
          <p className="text-xs text-slate-500">JPG, PNG, WebP, or GIF · max 5MB</p>
        </div>
      </div>
    </div>
  );
}

export function AddCandidateFormSections({
  currentStep,
  formData,
  updateFormData,
  errors,
  autoFilledFields,
  fieldRefs,
  jobs,
  recruiters,
  selectedJob,
  lockJobSelection,
  manualResumeFile,
  setManualResumeFile,
  resumeFileRef,
  parsedResumeFile,
  activeTab,
  renderCandidateConflict,
  handleDuplicateCheck,
  validateEmail,
  validateNoDigits,
  stripDigits,
  maxResumeFileLabel,
  currencyOptions,
  pipelineStages,
  sourceOptions,
  maritalStatusOptions,
  proficiencyOptions,
}) {
  const handleBirthDateChange = (value) => {
    updateFormData('birthDate', value);
    updateFormData('age', calculateAgeFromBirthDate(value));
  };

  const educationYearOptions = buildEducationYearOptions();

  const educationEntries =
    formData.educationEntries?.length > 0
      ? formData.educationEntries.map((row) => normalizeEducationRow(row))
      : [{ ...EMPTY_EDUCATION_ENTRY }];

  const addEducationRow = () => {
    updateFormData('educationEntries', [...educationEntries, { ...EMPTY_EDUCATION_ENTRY }]);
  };

  const updateEducationRow = (index, patch) => {
    const next = normalizeEducationRow({ ...educationEntries[index], ...patch });
    if (patch.educationLevel !== undefined && isSchoolCertificateEntry(next.educationLevel, next.qualification)) {
      if (!next.qualification.trim()) next.qualification = next.educationLevel;
    }
    updateFormData(
      'educationEntries',
      educationEntries.map((row, i) => (i === index ? next : row))
    );
  };

  const removeEducationRow = (index) => {
    if (educationEntries.length <= 1) {
      updateFormData('educationEntries', [{ ...EMPTY_EDUCATION_ENTRY }]);
      return;
    }
    updateFormData(
      'educationEntries',
      educationEntries.filter((_, i) => i !== index)
    );
  };

  const addLanguageRow = () => {
    updateFormData('languageEntries', [
      ...(formData.languageEntries || []),
      { language: '', proficiency: 'Conversational' },
    ]);
  };

  const updateLanguageRow = (index, patch) => {
    updateFormData(
      'languageEntries',
      (formData.languageEntries || []).map((row, i) => (i === index ? { ...row, ...patch } : row))
    );
  };

  const removeLanguageRow = (index) => {
    updateFormData(
      'languageEntries',
      (formData.languageEntries || []).filter((_, i) => i !== index)
    );
  };

  return (
    <div>
      <StepPanel step={1} currentStep={currentStep} title="Personal Information">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <DrawerInput
            label="Name (First)"
            required
            value={formData.firstName}
            onChange={(e) => updateFormData('firstName', stripDigits(e.target.value))}
            error={errors.firstName}
            autoFilled={autoFilledFields.firstName}
            inputRef={(node) => {
              fieldRefs.current.firstName = node;
            }}
          />
          <DrawerInput
            label="Name (Last)"
            required
            value={formData.lastName}
            onChange={(e) => updateFormData('lastName', stripDigits(e.target.value))}
            error={errors.lastName}
            autoFilled={autoFilledFields.lastName}
            inputRef={(node) => {
              fieldRefs.current.lastName = node;
            }}
          />
          <div className="sm:col-span-1" ref={(node) => (fieldRefs.current.email = node?.querySelector?.('input') || node)}>
            <DrawerInput
              label="E-mail"
              required
              value={formData.email}
              onChange={(e) => updateFormData('email', e.target.value)}
              onBlur={() => {
                const normalized = normalizeCandidateEmailInput(formData.email, {
                  firstName: formData.firstName,
                  lastName: formData.lastName,
                });
                if (normalized && normalized !== formData.email) {
                  updateFormData('email', normalized);
                }
                const value = (normalized || formData.email).trim();
                if (!value) return;
                const result = validateEmail(value);
                if (!result.valid) return;
                handleDuplicateCheck('email');
              }}
              error={errors.email}
              autoFilled={autoFilledFields.email}
            />
            {renderCandidateConflict('email')}
          </div>
          <div ref={(node) => (fieldRefs.current.phone = node?.querySelector?.('input') || node)}>
            <DrawerInput
              label="Mobile No"
              value={formData.phone}
              onChange={(e) => updateFormData('phone', e.target.value.replace(/[^\d]/g, ''))}
              onBlur={() => handleDuplicateCheck('phone')}
              error={errors.phone}
              autoFilled={autoFilledFields.phone}
            />
            {renderCandidateConflict('phone')}
          </div>
          <DrawerInput
            label="Birth Date"
            type="date"
            value={formData.birthDate}
            onChange={(e) => handleBirthDateChange(e.target.value)}
            autoFilled={autoFilledFields.birthDate}
          />
          <DrawerInput
            label="Age"
            value={formData.age}
            readOnly={Boolean(formData.birthDate)}
            onChange={(e) => updateFormData('age', e.target.value.replace(/[^\d]/g, ''))}
            hint={formData.birthDate ? 'Calculated from birth date' : 'Enter birth date to auto-calculate'}
            autoFilled={autoFilledFields.age}
          />
          <DrawerInput
            label="Candidate Score"
            value={formData.candidateScore}
            onChange={(e) => updateFormData('candidateScore', e.target.value)}
            autoFilled={autoFilledFields.candidateScore}
          />
          <DrawerInput
            label="City & State"
            value={formData.cityState}
            onChange={(e) => updateFormData('cityState', e.target.value)}
            placeholder="City, State"
            autoFilled={autoFilledFields.cityState}
          />
          <DrawerInput
            label="Current Address"
            value={formData.address}
            onChange={(e) => updateFormData('address', e.target.value)}
            autoFilled={autoFilledFields.address}
          />
          <DrawerInput
            label="Zip"
            value={formData.zip}
            onChange={(e) => updateFormData('zip', e.target.value)}
            autoFilled={autoFilledFields.zip}
          />
          <DrawerInput
            label="Nationality"
            value={formData.nationality}
            onChange={(e) => updateFormData('nationality', e.target.value)}
            autoFilled={autoFilledFields.nationality}
          />
          <DrawerInput
            label="Current Company Website"
            value={formData.currentCompanyWebsite}
            onChange={(e) => updateFormData('currentCompanyWebsite', e.target.value)}
            placeholder="https://…"
            autoFilled={autoFilledFields.currentCompanyWebsite}
          />
          <DrawerInput
            label="Marital Status"
            value={formData.maritalStatus}
            onChange={() => {}}
            children={
              <select
                value={formData.maritalStatus}
                onChange={(e) => updateFormData('maritalStatus', e.target.value)}
                className={inputClass}
              >
                <option value="">Select</option>
                {maritalStatusOptions.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            }
          />
          <DrawerInput
            label="Passport Number"
            value={formData.passportNumber}
            onChange={(e) => updateFormData('passportNumber', e.target.value)}
          />
        </div>
      </StepPanel>

      <StepPanel step={2} currentStep={currentStep} title="Education">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-600">Add qualifications and institutes.</p>
            <button
              type="button"
              onClick={addEducationRow}
              className="inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100"
            >
              <Plus size={14} />
              Add education
            </button>
          </div>
          {educationEntries.map((row, index) => {
            const isSchoolCert = isSchoolCertificateEntry(row.educationLevel, row.qualification);
            const previewTitle = formatEducationTitle(row.educationLevel, row.qualification);
            const previewInstitution = formatInstitutionLine(row.instituteName, row.instituteLocation);
            const previewDates = formatEducationDateLine(
              row.educationLevel,
              row.qualification,
              row.startYear,
              row.startMonth,
              row.endYear,
              row.endMonth,
              row.currentlyStudying
            );

            return (
            <div key={`edu-${index}`} className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500">Education {index + 1}</span>
                {educationEntries.length > 1 ? (
                  <button
                    type="button"
                    onClick={() => removeEducationRow(index)}
                    className="text-xs font-semibold text-red-600"
                  >
                    Remove
                  </button>
                ) : null}
              </div>

              <div className="mb-4 rounded-lg border border-slate-200 bg-white px-3 py-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">Preview</p>
                <p className="text-sm font-bold uppercase tracking-wide text-slate-900">{previewTitle}</p>
                <p className="text-sm text-slate-700">{previewInstitution}</p>
                <p className="text-sm text-slate-600">{previewDates}</p>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <DrawerInput
                  label="Education Level"
                  value={row.educationLevel}
                  onChange={() => {}}
                  children={
                    <select
                      value={row.educationLevel}
                      onChange={(e) => updateEducationRow(index, { educationLevel: e.target.value })}
                      className={inputClass}
                    >
                      <option value="">Select level</option>
                      {EDUCATION_LEVEL_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  }
                />
                <DrawerInput
                  label={isSchoolCert ? 'Qualification (optional)' : 'Qualification'}
                  value={row.qualification}
                  onChange={(e) => updateEducationRow(index, { qualification: e.target.value })}
                  placeholder={
                    isSchoolCert
                      ? 'e.g. HSC or SSC (uses level if blank)'
                      : 'e.g. B.E IN COMPUTER SCIENCE'
                  }
                  autoFilled={autoFilledFields.qualification}
                />
                <DrawerInput
                  label="School / College / University"
                  value={row.instituteName}
                  onChange={(e) => updateEducationRow(index, { instituteName: e.target.value })}
                  placeholder="e.g. VISHWANIKETAN [VIMEET]"
                  autoFilled={autoFilledFields.instituteName}
                />
                <DrawerInput
                  label="Location (City / Area)"
                  value={row.instituteLocation}
                  onChange={(e) => updateEducationRow(index, { instituteLocation: e.target.value })}
                  placeholder="e.g. Khopoli, Panvel"
                />

                {isSchoolCert ? (
                  <p className={`${labelClass} sm:col-span-2`}>
                    Dates{' '}
                    <span className="font-normal text-slate-500">(optional — start and completion month–year)</span>
                  </p>
                ) : null}

                <div className="sm:col-span-2">
                  <p className={`${labelClass} mb-2`}>
                    Start date{isSchoolCert ? ' (optional)' : ''}
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <select
                      value={row.startMonth}
                      onChange={(e) => updateEducationRow(index, { startMonth: e.target.value })}
                      className={inputClass}
                    >
                      <option value="">Month</option>
                      {EDUCATION_MONTH_OPTIONS.map((m) => (
                        <option key={m.value} value={m.value}>
                          {m.label}
                        </option>
                      ))}
                    </select>
                    <select
                      value={row.startYear}
                      onChange={(e) => updateEducationRow(index, { startYear: e.target.value })}
                      className={inputClass}
                    >
                      <option value="">Year</option>
                      {educationYearOptions.map((year) => (
                        <option key={`start-${year}`} value={String(year)}>
                          {year}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="sm:col-span-2">
                  <p className={`${labelClass} mb-2`}>
                    {isSchoolCert ? 'End date (completion, optional)' : 'End date'}
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <select
                      value={row.endMonth}
                      onChange={(e) => updateEducationRow(index, { endMonth: e.target.value })}
                      className={inputClass}
                      disabled={row.currentlyStudying}
                    >
                      <option value="">Month</option>
                      {EDUCATION_MONTH_OPTIONS.map((m) => (
                        <option key={m.value} value={m.value}>
                          {m.label}
                        </option>
                      ))}
                    </select>
                    <select
                      value={row.endYear}
                      onChange={(e) => updateEducationRow(index, { endYear: e.target.value })}
                      className={inputClass}
                      disabled={row.currentlyStudying}
                    >
                      <option value="">Year</option>
                      {educationYearOptions.map((year) => (
                        <option key={`end-${year}`} value={String(year)}>
                          {year}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {!isSchoolCert ? (
                  <div className="sm:col-span-2">
                    <label className="flex items-center gap-2 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={row.currentlyStudying}
                        onChange={(e) => {
                          const studying = e.target.checked;
                          updateEducationRow(index, {
                            currentlyStudying: studying,
                            ...(studying ? { endMonth: '', endYear: '' } : {}),
                          });
                        }}
                        className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      I am currently studying here
                    </label>
                  </div>
                ) : null}
              </div>
            </div>
            );
          })}
        </div>
      </StepPanel>

      <StepPanel step={3} currentStep={currentStep} title="Professional Information">
        <div className="space-y-4">
          <DrawerInput
            label="Remarks"
            value={formData.remarks}
            onChange={() => {}}
            children={
              <textarea
                value={formData.remarks}
                onChange={(e) => updateFormData('remarks', e.target.value)}
                rows={3}
                className={`min-h-[80px] ${inputClass}`}
                placeholder="Internal remarks…"
              />
            }
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <DrawerInput
              label="Experience"
              value={formData.experience}
              onChange={(e) => updateFormData('experience', e.target.value.replace(/[^\d.]/g, ''))}
              suffix="years"
              error={errors.experience}
              autoFilled={autoFilledFields.experience}
            />
            <DrawerInput
              label="Current Employer"
              value={formData.currentCompany}
              onChange={(e) => updateFormData('currentCompany', stripDigits(e.target.value))}
              error={errors.currentCompany}
              autoFilled={autoFilledFields.currentCompany}
            />
            <DrawerInput
              label="Current Designation"
              value={formData.currentDesignation}
              onChange={(e) => updateFormData('currentDesignation', e.target.value)}
              autoFilled={autoFilledFields.currentDesignation}
            />
            <DrawerInput
              label="Current Salary"
              value={formData.currentSalary}
              onChange={(e) => updateFormData('currentSalary', e.target.value.replace(/[^\d]/g, ''))}
              autoFilled={autoFilledFields.currentSalary}
            />
            <DrawerInput
              label="Current Salary Currency Type"
              value={formData.currentSalaryCurrency}
              onChange={() => {}}
              children={
                <select
                  value={formData.currentSalaryCurrency}
                  onChange={(e) => updateFormData('currentSalaryCurrency', e.target.value)}
                  className={inputClass}
                >
                  {currencyOptions.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              }
            />
            <DrawerInput
              label="Current Benefits"
              value={formData.currentBenefits}
              onChange={(e) => updateFormData('currentBenefits', e.target.value)}
              placeholder="e.g. Health, ESOP"
            />
            <DrawerInput
              label="Expected Salary"
              value={formData.expectedSalary}
              onChange={(e) => updateFormData('expectedSalary', e.target.value.replace(/[^\d]/g, ''))}
              error={errors.expectedSalary}
            />
            <DrawerInput
              label="Expected Salary Currency Type"
              value={formData.currency}
              onChange={() => {}}
              children={
                <select
                  value={formData.currency}
                  onChange={(e) => updateFormData('currency', e.target.value)}
                  className={inputClass}
                >
                  {currencyOptions.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              }
            />
            <DrawerInput
              label="Expected Benefits"
              value={formData.expectedBenefits}
              onChange={(e) => updateFormData('expectedBenefits', e.target.value)}
            />
            <DrawerInput
              label="Notice Period in days"
              value={formData.noticePeriodDays}
              onChange={(e) => updateFormData('noticePeriodDays', e.target.value.replace(/[^\d]/g, ''))}
              placeholder="e.g. 30"
            />
          </div>

          {activeTab !== 'resume' ? (
            <div className="space-y-3">
              <label className={labelClass}>Resume</label>
              <label
                className={`flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-4 py-5 text-center transition-colors sm:flex-row sm:justify-between sm:text-left ${
                  manualResumeFile
                    ? 'border-slate-300 bg-slate-50 hover:border-blue-400 hover:bg-blue-50/80'
                    : 'border-blue-200 bg-blue-50/40 hover:border-blue-400 hover:bg-blue-50'
                }`}
              >
                <div className="flex flex-col items-center gap-2 sm:flex-row sm:items-center">
                  <Upload size={22} className={manualResumeFile ? 'text-slate-400' : 'text-blue-500'} />
                  <div>
                    <p className="text-sm font-medium text-slate-700">
                      {manualResumeFile ? 'Replace resume file' : 'Upload Resume'}
                    </p>
                    <p className="text-xs text-slate-500">PDF, DOC, DOCX, TXT, PNG · {maxResumeFileLabel}</p>
                  </div>
                </div>
                <span className="mt-3 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white sm:mt-0">
                  Choose File
                </span>
                <input
                  type="file"
                  accept=".pdf,.doc,.docx,.txt,.png,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,image/png"
                  className="hidden"
                  onChange={(event) => {
                    const f = event.target.files?.[0] || null;
                    resumeFileRef.current = f;
                    setManualResumeFile(f);
                  }}
                />
              </label>
              {manualResumeFile ? (
                <ResumeUploadReadyCard
                  file={manualResumeFile}
                  badgeLabel="Resume ready to save"
                  onRemove={() => {
                    resumeFileRef.current = parsedResumeFile;
                    setManualResumeFile(null);
                  }}
                />
              ) : null}
            </div>
          ) : null}

          <DrawerInput
            label="Courses"
            value={formData.courses}
            onChange={(e) => updateFormData('courses', e.target.value)}
          />
          <DrawerInput
            label="Extracurricular Activities"
            value={formData.extracurricularActivities}
            onChange={(e) => updateFormData('extracurricularActivities', e.target.value)}
          />
          <DrawerInput
            label="Volunteers"
            value={formData.volunteers}
            onChange={(e) => updateFormData('volunteers', e.target.value)}
          />
          <DrawerInput
            label="Source"
            required
            value={formData.source}
            onChange={() => {}}
            error={errors.source}
            children={
              <select
                value={formData.source}
                onChange={(e) => updateFormData('source', e.target.value)}
                className={`${inputClass} ${errors.source ? 'border-red-400' : ''}`}
              >
                <option value="">Select source</option>
                {sourceOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            }
          />
        </div>
      </StepPanel>

      <StepPanel step={4} currentStep={currentStep} title="Social Network Information">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <DrawerInput
            label="LinkedIn"
            value={formData.linkedinUrl}
            onChange={(e) => updateFormData('linkedinUrl', e.target.value)}
            placeholder="https://linkedin.com/in/username"
            error={errors.linkedinUrl}
            autoFilled={autoFilledFields.linkedinUrl}
          />
          <DrawerInput label="Twitter" value={formData.twitter} onChange={(e) => updateFormData('twitter', e.target.value)} />
          <DrawerInput label="Xing" value={formData.xing} onChange={(e) => updateFormData('xing', e.target.value)} />
          <DrawerInput label="Skype ID" value={formData.skypeId} onChange={(e) => updateFormData('skypeId', e.target.value)} />
          <DrawerInput label="Facebook" value={formData.facebook} onChange={(e) => updateFormData('facebook', e.target.value)} />
          <DrawerInput
            label="Stack Overflow"
            value={formData.stackOverflow}
            onChange={(e) => updateFormData('stackOverflow', e.target.value)}
          />
          <DrawerInput
            label="Website"
            value={formData.website}
            onChange={(e) => updateFormData('website', e.target.value)}
            placeholder="https://…"
            error={errors.website}
          />
        </div>
      </StepPanel>

      <StepPanel step={5} currentStep={currentStep} title="Summary & Additional">
        <div className="space-y-4">
          <DrawerInput
            label="Summary"
            value={formData.summary}
            onChange={() => {}}
            children={
              <textarea
                value={formData.summary}
                onChange={(e) => updateFormData('summary', e.target.value)}
                rows={4}
                className={`min-h-[100px] ${inputClass}`}
                placeholder="Professional summary…"
              />
            }
            autoFilled={autoFilledFields.summary}
          />
          <DrawerInput
            label="Work History"
            value={formData.workHistory}
            onChange={() => {}}
            children={
              <textarea
                value={formData.workHistory}
                onChange={(e) => updateFormData('workHistory', e.target.value)}
                rows={4}
                className={`min-h-[100px] ${inputClass}`}
              />
            }
          />
          <DrawerInput
            label="Education"
            value={formData.educationHistory}
            onChange={() => {}}
            children={
              <textarea
                value={formData.educationHistory}
                onChange={(e) => updateFormData('educationHistory', e.target.value)}
                rows={3}
                className={`min-h-[80px] ${inputClass}`}
                placeholder="Additional education notes…"
              />
            }
          />
          <TagInput
            label="Certificate"
            values={formData.certificates}
            onChange={(values) => updateFormData('certificates', values)}
            placeholder="Type certificate and press Enter"
            maxItems={15}
          />
          <DrawerInput
            label="Honours & Awards"
            value={formData.honoursAwards}
            onChange={(e) => updateFormData('honoursAwards', e.target.value)}
          />

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className={labelClass}>Language & Proficiency</label>
              <button
                type="button"
                onClick={addLanguageRow}
                className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600"
              >
                <Plus size={14} />
                Add language
              </button>
            </div>
            {(formData.languageEntries || []).length === 0 ? (
              <p className="text-xs text-slate-500">No languages added.</p>
            ) : (
              (formData.languageEntries || []).map((row, index) => (
                <div key={`lang-${index}`} className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_auto]">
                  <input
                    value={row.language}
                    onChange={(e) => updateLanguageRow(index, { language: e.target.value })}
                    placeholder="Language"
                    className={inputClass}
                  />
                  <select
                    value={row.proficiency}
                    onChange={(e) => updateLanguageRow(index, { proficiency: e.target.value })}
                    className={inputClass}
                  >
                    {proficiencyOptions.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => removeLanguageRow(index)}
                    className="rounded-xl border border-slate-200 px-3 py-2 text-slate-500 hover:bg-slate-50"
                  >
                    <X size={16} />
                  </button>
                </div>
              ))
            )}
          </div>

          <div ref={(node) => (fieldRefs.current.skills = node)}>
            <TagInput
              label="Skills"
              values={formData.skills}
              onChange={(values) => updateFormData('skills', values)}
              placeholder="Type skill and press Enter"
              helperText={errors.skills || 'Max 10 skills'}
              maxItems={10}
            />
          </div>

          <div className="space-y-2">
            <label className={labelClass}>Referral Campaign</label>
            <div className="flex gap-2">
              {['Yes', 'No'].map((opt) => (
                <PillButton
                  key={opt}
                  active={formData.referralCampaign === opt}
                  onClick={() => updateFormData('referralCampaign', opt)}
                  tone={opt === 'Yes' ? 'green' : 'slate'}
                >
                  {opt}
                </PillButton>
              ))}
            </div>
          </div>

          <SearchableDropdown
            label="Assign to Job"
            value={formData.jobId}
            onSelect={(value) => updateFormData('jobId', value)}
            options={jobs}
            placeholder="Search and select a job"
            getLabel={(job) => job.title}
            getSecondary={(job) => job.department}
            emptyMessage="No jobs found"
            disabled={lockJobSelection}
          />

          {selectedJob ? (
            <div className="space-y-2">
              <label className={labelClass}>Pipeline Stage</label>
              <div className="flex flex-wrap gap-2">
                {pipelineStages.map((stage) => (
                  <PillButton key={stage} active={formData.stage === stage} onClick={() => updateFormData('stage', stage)}>
                    {stage}
                  </PillButton>
                ))}
              </div>
            </div>
          ) : null}

          <SearchableDropdown
            label="Assign Recruiter"
            value={formData.recruiterId}
            onSelect={(value) => updateFormData('recruiterId', value)}
            options={recruiters}
            placeholder="Search recruiter"
            getLabel={(user) => user.name}
            getSecondary={(user) => user.email}
            emptyMessage="No recruiters found"
          />
        </div>
      </StepPanel>
    </div>
  );
}
