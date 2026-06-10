'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { CandidateWorkExperienceDocumentsField } from './CandidateWorkExperienceDocumentsField';
import {
  EDUCATION_LEVEL_OPTIONS,
  EDUCATION_MODE_OPTIONS,
  EDUCATION_MONTH_OPTIONS,
  buildEducationYearOptions,
  computeCourseDurationFromDates,
  decodeStoredGrade,
  encodeStoredGrade,
  formatEducationDateLine,
  formatEducationTitle,
  formatInstitutionLine,
  isSchoolCertificateEntry,
  normalizeEducationRecord,
  type EducationGradeMetricType,
} from '@/lib/candidateEducationFields';
import { searchCscCities } from '@/lib/cscData';
import { phase1FieldLabelClass, phase1FieldValueClass, phase1SectionTitleClass } from '@/lib/phase1Typography';

const inputClass = `w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 ${phase1FieldValueClass}`;

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

export function CandidateEducationEntryEdit({
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
  const normalized = normalizeEducationRecord(entry);
  const [locationQuery, setLocationQuery] = useState(normalized.institutionLocation || '');
  const [locationHits, setLocationHits] = useState<ReturnType<typeof searchCscCities>>([]);
  const [locationOpen, setLocationOpen] = useState(false);
  const [gradeMetricType, setGradeMetricType] = useState<EducationGradeMetricType>(
    decodeStoredGrade(normalized.grade || '').type,
  );
  const [gradeInput, setGradeInput] = useState(decodeStoredGrade(normalized.grade || '').value);
  const [durationManuallyEdited, setDurationManuallyEdited] = useState(false);

  const yearOptions = useMemo(() => buildEducationYearOptions(), []);
  const isSchoolCert = isSchoolCertificateEntry(
    normalized.educationLevel || '',
    normalized.degreeProgram || '',
  );

  useEffect(() => {
    setLocationQuery(normalized.institutionLocation || '');
  }, [normalized.institutionLocation, index]);

  useEffect(() => {
    const decoded = decodeStoredGrade(normalized.grade || '');
    setGradeMetricType(decoded.type);
    setGradeInput(decoded.value);
  }, [normalized.grade, index]);

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

  const patchInstitutionLocation = (value: string) => {
    patch({ institutionLocation: value, location: value });
  };

  const syncDuration = (
    startYear: string,
    startMonth: string,
    endYear: string,
    endMonth: string,
    currentlyStudying: boolean,
  ) => {
    if (durationManuallyEdited) return;
    const computed = computeCourseDurationFromDates(
      startYear,
      startMonth,
      endYear,
      endMonth,
      currentlyStudying,
    );
    if (computed) patch({ courseDuration: computed });
  };

  const patchGrade = (type: EducationGradeMetricType, value: string) => {
    patch({ grade: encodeStoredGrade(type, value) });
  };

  const documents = Array.isArray(normalized.documents) ? normalized.documents : [];
  const computedDuration = computeCourseDurationFromDates(
    normalized.startYear || '',
    normalized.startMonth || '',
    normalized.currentlyStudying ? '' : normalized.endYear || '',
    normalized.currentlyStudying ? '' : normalized.endMonth || '',
    normalized.currentlyStudying === true,
  );

  const previewTitle = formatEducationTitle(
    normalized.educationLevel || '',
    normalized.degreeProgram || '',
  );
  const previewInstitution = formatInstitutionLine(
    normalized.institutionName || '',
    normalized.institutionLocation,
  );
  const previewDates = formatEducationDateLine(
    normalized.startYear || '',
    normalized.startMonth || '',
    normalized.endYear || '',
    normalized.endMonth || '',
    normalized.currentlyStudying === true,
  );

  return (
    <div className="space-y-5 rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-sm font-semibold text-slate-900">Education {index + 1}</p>

      <div className="rounded-xl border border-slate-100 bg-slate-50/80 px-4 py-3">
        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
          Preview (how it appears on your profile)
        </p>
        <div className="mt-2 space-y-1">
          <p className="text-sm font-bold uppercase tracking-wide text-slate-900">{previewTitle || '—'}</p>
          <p className="text-sm text-slate-700">{previewInstitution || '—'}</p>
          <p className="text-sm text-slate-600">{previewDates || '—'}</p>
        </div>
      </div>

      <div className="space-y-4">
        <SectionHeading>Education Details</SectionHeading>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <FieldLabel label="Education Level" />
            <select
              value={normalized.educationLevel || ''}
              onChange={(e) => patch({ educationLevel: e.target.value })}
              className={inputClass}
            >
              <option value="">Select Education Level</option>
              {EDUCATION_LEVEL_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <FieldLabel label="Qualification / Program" />
            <input
              value={normalized.degreeProgram || ''}
              onChange={(e) => patch({ degreeProgram: e.target.value, degree: e.target.value })}
              placeholder={isSchoolCert ? 'e.g. HSC or SSC' : 'e.g. B.E.'}
              className={inputClass}
            />
          </label>
          <label className="block">
            <FieldLabel label="School / College / University" />
            <input
              value={normalized.institutionName || ''}
              onChange={(e) =>
                patch({ institutionName: e.target.value, institution: e.target.value })
              }
              placeholder="e.g. Vishwakarma Institute of Technology"
              className={inputClass}
            />
          </label>
          <div className="relative sm:col-span-2">
            <FieldLabel
              label="Location (City / Area)"
              hint='Shown after the institution name, e.g. "College Name, Panvel"'
            />
            <input
              value={locationQuery}
              onChange={(e) => {
                setLocationQuery(e.target.value);
                patchInstitutionLocation(e.target.value);
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
                      patchInstitutionLocation(hit.displayName);
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
          {!isSchoolCert ? (
            <label className="block sm:col-span-2">
              <FieldLabel label="Field of Study / Major" />
              <input
                value={normalized.fieldOfStudy || ''}
                onChange={(e) => patch({ fieldOfStudy: e.target.value, field: e.target.value })}
                placeholder="e.g., Computer Engineering"
                className={inputClass}
              />
            </label>
          ) : null}
        </div>
      </div>

      <div className="space-y-4 border-t border-slate-100 pt-4">
        <SectionHeading>Dates</SectionHeading>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <FieldLabel label="Start Date" />
            <div className="grid grid-cols-2 gap-2">
              <select
                value={normalized.startMonth || ''}
                onChange={(e) => {
                  const startMonth = e.target.value;
                  patch({ startMonth });
                  syncDuration(
                    normalized.startYear || '',
                    startMonth,
                    normalized.endYear || '',
                    normalized.endMonth || '',
                    normalized.currentlyStudying === true,
                  );
                }}
                className={inputClass}
              >
                <option value="">Month</option>
                {EDUCATION_MONTH_OPTIONS.map((month) => (
                  <option key={month.value} value={month.value}>
                    {month.label}
                  </option>
                ))}
              </select>
              <select
                value={normalized.startYear || ''}
                onChange={(e) => {
                  const startYear = e.target.value;
                  patch({ startYear });
                  syncDuration(
                    startYear,
                    normalized.startMonth || '',
                    normalized.endYear || '',
                    normalized.endMonth || '',
                    normalized.currentlyStudying === true,
                  );
                }}
                className={inputClass}
              >
                <option value="">Year</option>
                {yearOptions.map((year) => (
                  <option key={year} value={String(year)}>
                    {year}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <FieldLabel label="End Date" />
            <div className="grid grid-cols-2 gap-2">
              <select
                value={normalized.endMonth || ''}
                disabled={normalized.currentlyStudying === true}
                onChange={(e) => {
                  const endMonth = e.target.value;
                  patch({ endMonth });
                  syncDuration(
                    normalized.startYear || '',
                    normalized.startMonth || '',
                    normalized.endYear || '',
                    endMonth,
                    false,
                  );
                }}
                className={inputClass}
              >
                <option value="">Month</option>
                {EDUCATION_MONTH_OPTIONS.map((month) => (
                  <option key={month.value} value={month.value}>
                    {month.label}
                  </option>
                ))}
              </select>
              <select
                value={normalized.endYear || ''}
                disabled={normalized.currentlyStudying === true}
                onChange={(e) => {
                  const endYear = e.target.value;
                  patch({ endYear });
                  syncDuration(
                    normalized.startYear || '',
                    normalized.startMonth || '',
                    endYear,
                    normalized.endMonth || '',
                    false,
                  );
                }}
                className={inputClass}
              >
                <option value="">Year</option>
                {yearOptions.map((year) => (
                  <option key={year} value={String(year)}>
                    {year}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
        {!isSchoolCert ? (
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={Boolean(normalized.currentlyStudying)}
              onChange={(e) => {
                const currentlyStudying = e.target.checked;
                patch({
                  currentlyStudying,
                  endYear: currentlyStudying ? '' : normalized.endYear || '',
                  endMonth: currentlyStudying ? '' : normalized.endMonth || '',
                });
                syncDuration(
                  normalized.startYear || '',
                  normalized.startMonth || '',
                  currentlyStudying ? '' : normalized.endYear || '',
                  currentlyStudying ? '' : normalized.endMonth || '',
                  currentlyStudying,
                );
              }}
              className="h-4 w-4 rounded text-violet-600 focus:ring-violet-500"
            />
            I am currently studying here
          </label>
        ) : null}
      </div>

      {!isSchoolCert ? (
        <div className="space-y-4 border-t border-slate-100 pt-4">
          <SectionHeading>Academic Details</SectionHeading>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <FieldLabel label="Grade / Percentage / GPA" hint="Use letters, numbers, and common grade symbols only." />
              <div className="grid gap-2 sm:grid-cols-[minmax(9rem,11rem)_1fr]">
                <select
                  value={gradeMetricType}
                  onChange={(e) => {
                    const type = e.target.value as EducationGradeMetricType;
                    setGradeMetricType(type);
                    patchGrade(type, gradeInput);
                  }}
                  className={inputClass}
                >
                  <option value="percentage">Percentage</option>
                  <option value="gpa">GPA</option>
                  <option value="grade">Grade</option>
                </select>
                <input
                  value={gradeInput}
                  onChange={(e) => {
                    setGradeInput(e.target.value);
                    patchGrade(gradeMetricType, e.target.value);
                  }}
                  placeholder={
                    gradeMetricType === 'percentage'
                      ? 'e.g. 72 or 85.5'
                      : gradeMetricType === 'gpa'
                        ? 'e.g. 8.4/10'
                        : 'e.g. A+, First Class'
                  }
                  className={inputClass}
                />
              </div>
            </div>
            <label className="block">
              <FieldLabel label="Mode of Study" />
              <select
                value={normalized.modeOfStudy || ''}
                onChange={(e) => patch({ modeOfStudy: e.target.value })}
                className={inputClass}
              >
                <option value="">Select Mode of Study</option>
                {EDUCATION_MODE_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
            <div>
              <FieldLabel
                label="Course Duration (years)"
                hint={
                  computedDuration
                    ? `Auto-filled from dates (${previewDates}). You can edit if needed.`
                    : 'Enter a valid number of years (up to 2 decimals).'
                }
              />
              <div className="flex gap-2">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={normalized.courseDuration || ''}
                  onChange={(e) => {
                    setDurationManuallyEdited(true);
                    patch({ courseDuration: e.target.value });
                  }}
                  placeholder="e.g. 3.75"
                  className={inputClass}
                />
                {computedDuration &&
                durationManuallyEdited &&
                normalized.courseDuration !== computedDuration ? (
                  <button
                    type="button"
                    onClick={() => {
                      setDurationManuallyEdited(false);
                      patch({ courseDuration: computedDuration });
                    }}
                    className="shrink-0 rounded-xl border border-violet-200 bg-violet-50 px-3 text-xs font-semibold text-violet-700 hover:bg-violet-100"
                  >
                    Use calculated
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <div className="space-y-4 border-t border-slate-100 pt-4">
        <SectionHeading>Certificates & Documents</SectionHeading>
        <CandidateWorkExperienceDocumentsField
          candidateId={candidateId}
          documents={documents}
          onChange={(nextDocuments) => patch({ documents: nextDocuments })}
          uploadLabel="Upload Your Education Certificates/Documents"
          readOnlyListLabel="Education Certificates/Documents"
          uploadCategory="Education Certificate"
        />
      </div>
    </div>
  );
}
