'use client';

import React, { useMemo, useState } from 'react';
import { CandidateWorkExperienceDocumentsField } from './CandidateWorkExperienceDocumentsField';
import {
  VISA_STATUS_OPTIONS,
  VISA_TYPE_OPTIONS,
  VISA_WORKPERMIT_OPTIONS,
  countryDisplayName,
  normalizeVisaEntryRecord,
} from '@/lib/candidateVisaWorkAuthorizationFields';
import { getCscCountryOptions } from '@/lib/cscData';
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

function CountrySelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (countryCode: string, countryName: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const options = useMemo(() => getCscCountryOptions(), []);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (option) =>
        option.label.toLowerCase().includes(q) || option.value.toLowerCase().includes(q),
    );
  }, [options, query]);

  const selectedLabel = countryDisplayName(value) || 'Select country';

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={`${inputClass} flex items-center justify-between text-left`}
      >
        <span>{selectedLabel}</span>
        <span className="text-slate-400">▼</span>
      </button>
      {open ? (
        <div className="absolute z-20 mt-1 max-h-64 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
          <div className="border-b border-slate-100 p-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search countries..."
              className={inputClass}
              autoFocus
            />
          </div>
          <div className="max-h-48 overflow-y-auto">
            {filtered.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  onChange(option.value, option.label);
                  setOpen(false);
                  setQuery('');
                }}
                className="block w-full px-3 py-2 text-left text-sm text-slate-800 hover:bg-violet-50"
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}
      <p className="mt-1 text-[11px] text-slate-400">
        Full world list — use search to filter quickly. Pick where you are legally authorized to work.
      </p>
    </div>
  );
}

export function CandidateVisaWorkAuthorizationEntryEdit({
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
  const normalized = normalizeVisaEntryRecord(entry);
  const documents = Array.isArray(normalized.documents) ? normalized.documents : [];
  const requiresVisa = normalized.requiresVisa || '';
  const patch = (patchValue: Record<string, unknown>) => onChange(index, patchValue);

  return (
    <div className="space-y-5 rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-sm font-semibold text-slate-900">
        Visa authorization {index + 1}
      </p>

      <div className="space-y-4">
        <SectionHeading>Country authorization</SectionHeading>
        <label className="block">
          <FieldLabel label="Select Countries" />
          <CountrySelect
            value={normalized.country || ''}
            onChange={(countryCode, countryName) =>
              patch({ country: countryCode, countryName })
            }
          />
        </label>

        {normalized.country || normalized.countryName ? (
          <div>
            <FieldLabel label="Do you require a visa for this country?" />
            <div className="flex flex-wrap gap-4">
              {(['Yes', 'No'] as const).map((option) => (
                <label key={option} className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="radio"
                    name={`requiresVisa-${index}`}
                    checked={requiresVisa === option}
                    onChange={() =>
                      patch({
                        requiresVisa: option,
                        ...(option === 'No'
                          ? {
                              visaType: '',
                              visaStatus: '',
                              visaExpiryDate: '',
                              workPermitNumber: '',
                              documents: [],
                            }
                          : { visaWorkpermitRequired: '' }),
                      })
                    }
                    className="h-4 w-4 text-violet-600 focus:ring-violet-500"
                  />
                  {option}
                </label>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      {requiresVisa === 'Yes' ? (
        <div className="space-y-4 border-t border-slate-100 pt-4">
          <SectionHeading>Visa details</SectionHeading>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <FieldLabel label="Visa Type" />
              <select
                value={normalized.visaType || ''}
                onChange={(e) => patch({ visaType: e.target.value })}
                className={inputClass}
              >
                <option value="">Select Visa Type</option>
                {VISA_TYPE_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <FieldLabel label="Visa Status" />
              <select
                value={normalized.visaStatus || 'Active'}
                onChange={(e) => patch({ visaStatus: e.target.value })}
                className={inputClass}
              >
                {VISA_STATUS_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <FieldLabel
                label="Visa Expiry Date"
                hint="This helps employers understand your visa timeline."
              />
              <input
                type="date"
                value={normalized.visaExpiryDate || ''}
                onChange={(e) => patch({ visaExpiryDate: e.target.value })}
                className={inputClass}
              />
            </label>
            <label className="block">
              <FieldLabel label="Work Permit Number" />
              <input
                value={normalized.workPermitNumber || ''}
                onChange={(e) => patch({ workPermitNumber: e.target.value })}
                placeholder="Enter work permit number"
                className={inputClass}
              />
            </label>
          </div>
          <CandidateWorkExperienceDocumentsField
            candidateId={candidateId}
            documents={documents}
            onChange={(nextDocuments) => patch({ documents: nextDocuments })}
            uploadLabel="Upload Visa / Work Permit Document"
            readOnlyListLabel="Visa / Work Permit Documents"
            uploadCategory="Visa Work Permit Document"
          />
          <p className="text-[11px] text-slate-400">Accepted: PDF, JPG, PNG. Max 5MB.</p>
        </div>
      ) : null}

      {requiresVisa === 'No' ? (
        <div className="space-y-3 border-t border-slate-100 pt-4">
          <SectionHeading>Work authorization</SectionHeading>
          <FieldLabel label="Visa / work permit required?" />
          <div className="space-y-2">
            {VISA_WORKPERMIT_OPTIONS.map((option) => (
              <label key={option} className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="radio"
                  name={`visaWorkpermit-${index}`}
                  checked={normalized.visaWorkpermitRequired === option}
                  onChange={() => patch({ visaWorkpermitRequired: option })}
                  className="h-4 w-4 text-violet-600 focus:ring-violet-500"
                />
                {option}
              </label>
            ))}
          </div>
        </div>
      ) : null}

      <div className="space-y-4 border-t border-slate-100 pt-4">
        <SectionHeading>Additional notes</SectionHeading>
        <label className="block">
          <FieldLabel label="Additional Notes" />
          <textarea
            value={normalized.additionalRemarks || ''}
            onChange={(e) => patch({ additionalRemarks: e.target.value })}
            placeholder="Any additional visa or work authorization details"
            className={textareaClass}
          />
        </label>
      </div>
    </div>
  );
}
