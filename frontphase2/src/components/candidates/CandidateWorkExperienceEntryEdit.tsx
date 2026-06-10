'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Sparkles, X } from 'lucide-react';
import { CandidateWorkExperienceDocumentsField } from './CandidateWorkExperienceDocumentsField';
import { toast } from 'sonner';
import {
  WORK_EMPLOYMENT_TYPE_OPTIONS,
  WORK_INDUSTRY_OPTIONS,
  WORK_MODE_OPTIONS,
  WORK_TURNOVER_CURRENCIES,
  formatStoredTurnover,
  normalizeWorkExperienceRecord,
  type CandidateWorkExperienceDocument,
  type CandidateWorkExperienceRecord,
} from '@/lib/candidateWorkExperienceFields';
import { searchCscCities } from '@/lib/cscData';
import { phase1FieldLabelClass, phase1FieldValueClass, phase1SectionTitleClass } from '@/lib/phase1Typography';
import { EditDateField } from './EditDateField';

const inputClass = `w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 ${phase1FieldValueClass}`;
const textareaClass = `${inputClass} min-h-[100px] resize-y`;

function SectionHeading({ children }: { children: React.ReactNode }) {
  return <h4 className={`${phase1SectionTitleClass} border-b border-slate-200 pb-2`}>{children}</h4>;
}

function FieldLabel({
  label,
  hint,
  action,
}: {
  label: string;
  hint?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
      <span className={phase1FieldLabelClass}>{label}</span>
      {action}
      {hint ? <p className="w-full text-[11px] text-slate-400">{hint}</p> : null}
    </div>
  );
}

export function CandidateWorkExperienceEntryEdit({
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
  const normalized = useMemo(() => normalizeWorkExperienceRecord(entry), [entry]);
  const [industryInput, setIndustryInput] = useState('');
  const [industryOpen, setIndustryOpen] = useState(false);
  const [locationQuery, setLocationQuery] = useState(normalized.workLocation || '');
  const [locationHits, setLocationHits] = useState<ReturnType<typeof searchCscCities>>([]);
  const [locationOpen, setLocationOpen] = useState(false);
  const [skillInput, setSkillInput] = useState('');

  useEffect(() => {
    setLocationQuery(normalized.workLocation || '');
  }, [normalized.workLocation, index]);

  const industryItems = useMemo(() => {
    const selected = String(normalized.industryDomain || '')
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean);
    return selected;
  }, [normalized.industryDomain]);

  const industrySuggestions = useMemo(() => {
    const query = industryInput.trim().toLowerCase();
    return WORK_INDUSTRY_OPTIONS.filter((option) => {
      if (industryItems.some((item) => item.toLowerCase() === option.toLowerCase())) return false;
      if (!query) return true;
      return option.toLowerCase().includes(query);
    }).slice(0, 8);
  }, [industryInput, industryItems]);

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

  const addIndustry = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    const next = [...industryItems];
    if (!next.some((item) => item.toLowerCase() === trimmed.toLowerCase())) {
      next.push(trimmed);
    }
    patch({ industryDomain: next.join(', ') });
    setIndustryInput('');
    setIndustryOpen(false);
  };

  const removeIndustry = (value: string) => {
    patch({
      industryDomain: industryItems.filter((item) => item.toLowerCase() !== value.toLowerCase()).join(', '),
    });
  };

  const skills = Array.isArray(normalized.workSkills) ? normalized.workSkills : [];
  const documents = Array.isArray(normalized.documents) ? normalized.documents : [];

  const addSkill = () => {
    const trimmed = skillInput.trim();
    if (!trimmed) return;
    if (skills.some((skill) => skill.toLowerCase() === trimmed.toLowerCase())) {
      setSkillInput('');
      return;
    }
    patch({ workSkills: [...skills, trimmed] });
    setSkillInput('');
  };

  const removeSkill = (value: string) => {
    patch({ workSkills: skills.filter((skill) => skill.toLowerCase() !== value.toLowerCase()) });
  };

  const turnoverCurrency = normalized.companyTurnoverCurrency || 'INR';
  const turnoverAmount = normalized.companyTurnoverAmount || '';

  return (
    <div className="space-y-5 rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-sm font-semibold text-slate-900">Role {index + 1}</p>

      <div className="space-y-4">
        <SectionHeading>Role Details</SectionHeading>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <FieldLabel label="Job Title" />
            <input
              value={normalized.jobTitle || ''}
              onChange={(e) => patch({ jobTitle: e.target.value, title: e.target.value })}
              placeholder="e.g., Software Developer"
              className={inputClass}
            />
          </label>
          <label className="block">
            <FieldLabel label="Company Name" />
            <input
              value={normalized.companyName || ''}
              onChange={(e) => patch({ companyName: e.target.value, company: e.target.value })}
              placeholder="e.g., TCS, Deloitte, Amazon"
              className={inputClass}
            />
          </label>
          <label className="block">
            <FieldLabel label="Employment Type" />
            <select
              value={normalized.employmentType || ''}
              onChange={(e) => patch({ employmentType: e.target.value })}
              className={inputClass}
            >
              <option value="">Select employment type</option>
              {WORK_EMPLOYMENT_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <div className="block">
            <FieldLabel
              label="Industry"
              hint="Type to get suggestions in dropdown. Press Enter to add."
            />
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="relative">
                <input
                  value={industryInput}
                  onChange={(e) => {
                    setIndustryInput(e.target.value);
                    setIndustryOpen(true);
                  }}
                  onFocus={() => setIndustryOpen(true)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addIndustry(industrySuggestions[0] || industryInput);
                    }
                  }}
                  placeholder="Type industry"
                  className={inputClass}
                />
                {industryOpen && industrySuggestions.length > 0 ? (
                  <div className="absolute z-20 mt-1 max-h-40 w-full overflow-auto rounded-lg border border-slate-200 bg-white shadow-lg">
                    {industrySuggestions.map((option) => (
                      <button
                        key={option}
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => addIndustry(option)}
                        className="block w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-violet-50"
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
              {industryItems.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {industryItems.map((item) => (
                    <span
                      key={item}
                      className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2.5 py-1 text-xs font-medium text-violet-800"
                    >
                      {item}
                      <button type="button" onClick={() => removeIndustry(item)} aria-label={`Remove ${item}`}>
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
          <label className="block">
            <FieldLabel
              label="Number of Reportees"
              hint="How many people directly reported to you in this role?"
            />
            <input
              value={normalized.numberOfReportees || ''}
              onChange={(e) => patch({ numberOfReportees: e.target.value.replace(/\D/g, '') })}
              placeholder="e.g., 5"
              inputMode="numeric"
              className={inputClass}
            />
          </label>
        </div>
      </div>

      <div className="space-y-4 border-t border-slate-100 pt-4">
        <SectionHeading>Duration</SectionHeading>
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
              value={normalized.currentlyWorkHere ? '' : normalized.endDate || ''}
              outputIso
              onChange={(value) => patch({ endDate: value, currentlyWorkHere: false, currentlyWorking: false })}
            />
            <label className="mt-2 flex items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={Boolean(normalized.currentlyWorkHere)}
                onChange={(e) =>
                  patch({
                    currentlyWorkHere: e.target.checked,
                    currentlyWorking: e.target.checked,
                    isCurrentJob: e.target.checked,
                    endDate: e.target.checked ? '' : normalized.endDate || '',
                  })
                }
                className="h-4 w-4 rounded text-violet-600 focus:ring-violet-500"
              />
              I currently work here
            </label>
          </div>
        </div>
      </div>

      <div className="space-y-4 border-t border-slate-100 pt-4">
        <SectionHeading>Location & Work Mode</SectionHeading>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="relative">
            <FieldLabel
              label="Work Location"
              hint="Start typing a city or country and select a suggested location"
            />
            <input
              value={locationQuery}
              onChange={(e) => {
                setLocationQuery(e.target.value);
                patch({ workLocation: e.target.value, location: e.target.value });
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
                      patch({ workLocation: hit.displayName, location: hit.displayName });
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
        <SectionHeading>Company Details</SectionHeading>
        <div className="space-y-3">
          <div>
            <FieldLabel
              label="Company Profile"
              action={
                <button
                  type="button"
                  onClick={() => toast.message('AI autofill will use the candidate CV in a future update.')}
                  className="inline-flex items-center gap-1 rounded-lg border border-violet-200 bg-violet-50 px-2.5 py-1 text-[11px] font-semibold text-violet-700"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  Autofill with AI
                </button>
              }
            />
            <textarea
              value={normalized.companyProfile || ''}
              onChange={(e) => patch({ companyProfile: e.target.value })}
              placeholder="Brief description of the company (auto-filled from your CV and company name)..."
              className={textareaClass}
            />
          </div>
          <div>
            <FieldLabel label="Company Turnover" />
            <div className="flex gap-2">
              <select
                value={turnoverCurrency}
                onChange={(e) =>
                  patch({
                    companyTurnoverCurrency: e.target.value,
                    companyTurnover: formatStoredTurnover(e.target.value, turnoverAmount),
                  })
                }
                className={`${inputClass} max-w-[110px]`}
              >
                {WORK_TURNOVER_CURRENCIES.map((currency) => (
                  <option key={currency} value={currency}>
                    {currency}
                  </option>
                ))}
              </select>
              <input
                value={turnoverAmount}
                onChange={(e) =>
                  patch({
                    companyTurnoverAmount: e.target.value,
                    companyTurnover: formatStoredTurnover(turnoverCurrency, e.target.value),
                  })
                }
                placeholder="e.g. 50 Cr, 1.2M, 25000000"
                className={inputClass}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-4 border-t border-slate-100 pt-4">
        <SectionHeading>Role Contribution</SectionHeading>
        <label className="block">
          <FieldLabel label="Key Responsibilities" />
          <textarea
            value={normalized.keyResponsibilities || ''}
            onChange={(e) =>
              patch({
                keyResponsibilities: e.target.value,
                responsibilities: e.target.value
                  .split(/\n+/)
                  .map((line) => line.trim())
                  .filter(Boolean),
              })
            }
            placeholder="Describe your primary duties and responsibilities..."
            className={textareaClass}
          />
        </label>
        <label className="block">
          <FieldLabel label="Achievements" />
          <textarea
            value={normalized.achievements || ''}
            onChange={(e) => patch({ achievements: e.target.value })}
            placeholder="List your key accomplishments in this role..."
            className={textareaClass}
          />
        </label>
      </div>

      <div className="space-y-4 border-t border-slate-100 pt-4">
        <SectionHeading>Skills & Documents</SectionHeading>
        <div>
          <FieldLabel
            label="Skills Used"
            hint="Skills and company profile auto-fill shortly after you enter the company name."
            action={
              <button
                type="button"
                onClick={() => toast.message('Skill suggestions from CV will be added in a future update.')}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-700"
              >
                Suggest skills from CV
              </button>
            }
          />
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
              placeholder="Add skills you applied in this role..."
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

        <CandidateWorkExperienceDocumentsField
          candidateId={candidateId}
          documents={documents}
          onChange={(nextDocuments) => patch({ documents: nextDocuments })}
        />
      </div>
    </div>
  );
}
