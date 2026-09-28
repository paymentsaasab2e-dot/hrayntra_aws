'use client';

import { useState } from 'react';
import { Check, ChevronDown, Upload, X } from 'lucide-react';
import { EMPTY_EDUCATION_ENTRY } from '@/lib/candidateEducation';
import { CANDIDATE_FORM_STEPS } from './AddCandidateFormSections';

export const MAX_RESUME_FILE_BYTES = (() => {
  if (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_RESUME_MAX_FILE_BYTES) {
    const n = parseInt(String(process.env.NEXT_PUBLIC_RESUME_MAX_FILE_BYTES).trim(), 10);
    if (Number.isFinite(n) && n >= 5 * 1024 * 1024) return n;
  }
  return 25 * 1024 * 1024;
})();

export const MAX_RESUME_FILE_LABEL = `${Math.round(MAX_RESUME_FILE_BYTES / (1024 * 1024))}MB`;

export const MAX_AVATAR_FILE_BYTES = 5 * 1024 * 1024;

export const BROWSER_FILE_PICKER_SOFT_CAP = 100;

export const MAX_BULK_CV_FILES_PER_SESSION = (() => {
  if (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_MAX_BULK_CV_FILES) {
    const n = parseInt(String(process.env.NEXT_PUBLIC_MAX_BULK_CV_FILES).trim(), 10);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return 5000;
})();

export const BULK_CV_PREVIEW_NAME_LIMIT = 40;

export const BULK_CV_DUPLICATE_POLICY_STORAGE_KEY = 'bulkCvDuplicatePolicy';

export const BULK_CV_DUPLICATE_POLICY_OPTIONS = [
  {
    id: 'create_anyway',
    title: 'Create anyway',
    description:
      'When the email already exists, save a new candidate copy with the same email from the CV and a distinct last name.',
  },
  {
    id: 'cancel',
    title: 'Duplicate found — still continue',
    description: 'Skip CVs that match an existing email and continue processing the rest of the batch.',
  },
  {
    id: 'update_existing',
    title: 'Update existing',
    description: 'Merge parsed CV data into the candidate profile that already uses this email.',
  },
];

export function readStoredBulkCvDuplicatePolicy() {
  if (typeof window === 'undefined') return 'update_existing';
  const stored = String(window.localStorage.getItem(BULK_CV_DUPLICATE_POLICY_STORAGE_KEY) || '').trim();
  return BULK_CV_DUPLICATE_POLICY_OPTIONS.some((opt) => opt.id === stored) ? stored : 'update_existing';
}

export function bulkCvFileKey(file) {
  return `${file.name}::${file.size}::${file.lastModified ?? 0}`;
}

export function mergeBulkCvFiles(existing, incoming) {
  const seen = new Set(existing.map(bulkCvFileKey));
  const merged = [...existing];
  let added = 0;
  let skippedDup = 0;
  let skippedLarge = 0;

  for (const file of incoming) {
    if (!file) continue;
    if (file.size > MAX_RESUME_FILE_BYTES) {
      skippedLarge += 1;
      continue;
    }
    const key = bulkCvFileKey(file);
    if (seen.has(key)) {
      skippedDup += 1;
      continue;
    }
    seen.add(key);
    merged.push(file);
    added += 1;
  }

  return { merged, added, skippedDup, skippedLarge };
}

export function buildBulkCvWorkItems(storedEntries, localFiles) {
  const items = [];
  for (const e of storedEntries) {
    items.push({
      kind: 'stored',
      name: e.name,
      size: e.size,
      storedFileId: e.storedFileId,
    });
  }
  for (const f of localFiles) {
    items.push({ kind: 'local', name: f.name, size: f.size, file: f });
  }
  return items;
}

export const METHOD_TABS = [
  { key: 'manual', label: 'Manual Entry' },
  { key: 'resume', label: 'Upload Resume' },
  { key: 'csv', label: 'Bulk CSV' },
  { key: 'bulkResume', label: 'Bulk CV Upload' },
];

export const DRAWER_TITLES = {
  manual: 'Add New Candidate',
  resume: 'Upload Resume',
  csv: 'Bulk CSV Import',
  bulkResume: 'Bulk CV Upload',
};

export const DRAWER_DESCRIPTIONS = {
  manual: 'Fill personal, education, and professional details, then create.',
  resume: 'Upload a resume and let the parser fill the form.',
  csv: 'Import candidates from a CSV file.',
  bulkResume: 'Create candidates from multiple resume files.',
};

export const PIPELINE_STAGES = ['Applied', 'Screening', 'Shortlist', 'Interview', 'Offer', 'Hired'];

export const SOURCE_OPTIONS = [
  'LinkedIn',
  'Naukri',
  'Indeed',
  'Referral',
  'Company Career Page',
  'Agency',
  'Other',
];

export const PRIORITY_OPTIONS = ['High', 'Medium', 'Low'];

export const NOTICE_PERIOD_OPTIONS = ['Immediate', '15 days', '30 days', '45 days', '60 days', '90 days+'];

export const AVAILABILITY_OPTIONS = ['Available', 'Interviewing Elsewhere', 'Not Available'];

export const CURRENCY_OPTIONS = ['INR', 'USD', 'GBP', 'AED', 'EUR'];

export const MARITAL_STATUS_OPTIONS = ['Single', 'Married', 'Divorced', 'Widowed', 'Prefer not to say'];

export const PROFICIENCY_OPTIONS = ['Basic', 'Conversational', 'Professional', 'Native'];

export const LINKEDIN_REGEX = /^(https?:\/\/)?(www\.)?linkedin\.com\/in\/[A-Za-z0-9-_%]+\/?$/i;

export const NO_DIGITS_REGEX = /\d/;

export const CANDIDATES_CHANGED_EVENT = 'jobportal:candidates-changed';

export const DEFAULT_FORM_DATA = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  age: '',
  candidateScore: '',
  cityState: '',
  address: '',
  zip: '',
  avatar: '',
  nationality: '',
  currentCompanyWebsite: '',
  maritalStatus: '',
  birthDate: '',
  passportNumber: '',
  educationEntries: [{ ...EMPTY_EDUCATION_ENTRY }],
  remarks: '',
  experience: '',
  currentCompany: '',
  currentDesignation: '',
  currentSalary: '',
  currentSalaryCurrency: 'INR',
  currentBenefits: '',
  expectedSalary: '',
  currency: 'INR',
  expectedBenefits: '',
  noticePeriodDays: '',
  courses: '',
  extracurricularActivities: '',
  volunteers: '',
  linkedinUrl: '',
  twitter: '',
  xing: '',
  skypeId: '',
  facebook: '',
  stackOverflow: '',
  website: '',
  summary: '',
  workHistory: '',
  educationHistory: '',
  certificates: [],
  honoursAwards: '',
  languageEntries: [],
  referralCampaign: 'No',
  location: '',
  jobId: '',
  stage: 'Applied',
  recruiterId: '',
  source: '',
  sourceUrl: '',
  referrerName: '',
  agencyName: '',
  priority: 'Medium',
  tags: [],
  noticePeriod: 'Immediate',
  availabilityStatus: 'Available',
  portfolioUrl: '',
  skills: [],
  initialNote: '',
};

export function extractItems(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.items)) return payload.items;
  return [];
}

export function isPersistableRemoteResumeUrl(value) {
  return typeof value === 'string' && /^https?:\/\//i.test(String(value).trim());
}

export function normalizeAutoFilledFields(parsedData) {
  const fields = {};
  Object.entries(parsedData || {}).forEach(([key, value]) => {
    if (Array.isArray(value) ? value.length > 0 : String(value ?? '').trim() !== '') {
      fields[key] = true;
    }
  });
  return fields;
}

export function parseCsvLine(line) {
  const values = [];
  let current = '';
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (inQuotes && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (char === ',' && !inQuotes) {
      values.push(current.trim());
      current = '';
      continue;
    }
    current += char;
  }

  values.push(current.trim());
  return values;
}

export function parseCsvContent(content) {
  const lines = String(content)
    .replace(/\r\n/g, '\n')
    .split('\n')
    .filter((line) => line.trim().length > 0);

  if (!lines.length) return [];

  const headers = parseCsvLine(lines[0]);
  return lines.slice(1).map((line, index) => {
    const values = parseCsvLine(line);
    const row = { __rowNumber: index + 2 };
    headers.forEach((header, headerIndex) => {
      row[header] = values[headerIndex] || '';
    });
    return row;
  });
}

export function notifyCandidatesChanged() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(CANDIDATES_CHANGED_EVENT));
}

export function getInitials(name = '') {
  return String(name)
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

export function validateNoDigits(value, label) {
  const text = String(value || '').trim();
  if (!text) return { valid: false, message: `${label} is required` };
  if (NO_DIGITS_REGEX.test(text)) {
    return { valid: false, message: `${label} cannot contain numbers` };
  }
  return { valid: true, message: '' };
}

export function stripDigits(value) {
  return String(value || '').replace(/\d/g, '');
}

export function DrawerInput({
  label,
  name,
  required,
  value,
  onChange,
  placeholder,
  error,
  onBlur,
  type = 'text',
  suffix,
  autoFilled,
  children,
  inputRef,
  maxLength,
}) {
  return (
    <div className="space-y-1.5">
      <label className="flex items-center gap-2 text-xs font-semibold text-slate-700">
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
            name={name}
            type={type}
            value={value}
            onChange={onChange}
            onBlur={onBlur}
            placeholder={placeholder}
            maxLength={maxLength}
            className={`w-full rounded-xl border bg-white px-3 py-2.5 text-sm outline-none transition ${
              error
                ? 'border-red-400 focus:border-red-500'
                : 'border-slate-200 focus:border-blue-500'
            } ${suffix ? 'pr-16' : ''}`}
          />
          {suffix ? (
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">
              {suffix}
            </span>
          ) : null}
        </div>
      )}
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  );
}

export function SearchableDropdown({
  label,
  value,
  onSelect,
  options,
  placeholder,
  getLabel,
  getSecondary,
  error,
  autoFilled,
  emptyMessage,
  disabled = false,
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const selected = options.find((option) => option.id === value) || null;
  const filteredOptions = options.filter((option) => {
    const primary = getLabel(option).toLowerCase();
    const secondary = (getSecondary?.(option) || '').toLowerCase();
    return primary.includes(query.toLowerCase()) || secondary.includes(query.toLowerCase());
  });

  return (
    <div className="space-y-1.5">
      <label className="flex items-center gap-2 text-xs font-semibold text-slate-700">
        <span>{label}</span>
        {autoFilled ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
            <Check size={11} />
            Auto-filled
          </span>
        ) : null}
      </label>
      <div className="relative">
        <button
          type="button"
          onClick={() => {
            if (disabled) return;
            setOpen((prev) => !prev);
          }}
          disabled={disabled}
          className={`flex w-full items-center justify-between rounded-xl border bg-white px-3 py-2.5 text-left text-sm ${
            error ? 'border-red-400' : 'border-slate-200'
          } ${disabled ? 'cursor-not-allowed bg-slate-50 text-slate-400' : ''}`}
        >
          <span className={selected ? 'text-slate-900' : 'text-slate-400'}>
            {selected ? getLabel(selected) : placeholder}
          </span>
          <ChevronDown size={16} className="text-slate-400" />
        </button>
        {open ? (
          <div className="absolute z-20 mt-2 w-full rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search..."
              className="mb-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500"
            />
            <div className="max-h-56 overflow-y-auto">
              {filteredOptions.length ? (
                filteredOptions.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => {
                      onSelect(option.id);
                      setOpen(false);
                      setQuery('');
                    }}
                    className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left hover:bg-slate-50"
                  >
                    <div>
                      <p className="text-sm font-medium text-slate-900">{getLabel(option)}</p>
                      {getSecondary ? (
                        <p className="mt-0.5 text-xs text-slate-500">{getSecondary(option)}</p>
                      ) : null}
                    </div>
                  </button>
                ))
              ) : (
                <div className="px-3 py-4 text-center text-xs text-slate-500">{emptyMessage}</div>
              )}
            </div>
          </div>
        ) : null}
      </div>
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  );
}

export function TagInput({
  label,
  values,
  onChange,
  suggestions = [],
  placeholder,
  maxItems = 10,
  allowCustom = true,
  autoFilled,
  helperText,
}) {
  const [input, setInput] = useState('');
  const filteredSuggestions = suggestions
    .filter((suggestion) => !values.includes(suggestion.name || suggestion.label))
    .filter((suggestion) =>
      (suggestion.name || suggestion.label || '').toLowerCase().includes(input.toLowerCase())
    )
    .slice(0, 8);

  const addValue = (rawValue) => {
    const value = String(rawValue || '').trim();
    if (!value || values.includes(value) || values.length >= maxItems) return;
    onChange([...values, value]);
    setInput('');
  };

  return (
    <div className="space-y-2">
      <label className="flex items-center gap-2 text-xs font-semibold text-slate-700">
        <span>{label}</span>
        {autoFilled ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
            <Check size={11} />
            Auto-filled
          </span>
        ) : null}
      </label>
      <div className="rounded-xl border border-slate-200 bg-white p-2">
        <div className="flex flex-wrap gap-2">
          {values.map((value) => (
            <span
              key={value}
              className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700"
            >
              {value}
              <button
                type="button"
                onClick={() => onChange(values.filter((item) => item !== value))}
                className="text-slate-400 hover:text-slate-700"
              >
                <X size={12} />
              </button>
            </span>
          ))}
          <input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                if (allowCustom) addValue(input);
              }
            }}
            placeholder={values.length >= maxItems ? `Max ${maxItems}` : placeholder}
            disabled={values.length >= maxItems}
            className="min-w-[120px] flex-1 px-2 py-1 text-sm outline-none"
          />
        </div>
        {filteredSuggestions.length ? (
          <div className="mt-2 flex flex-wrap gap-2 border-t border-slate-100 pt-2">
            {filteredSuggestions.map((suggestion) => {
              const value = suggestion.name || suggestion.label;
              return (
                <button
                  key={suggestion.id || value}
                  type="button"
                  onClick={() => addValue(value)}
                  className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100"
                >
                  {value}
                </button>
              );
            })}
          </div>
        ) : null}
      </div>
      {helperText ? <p className="text-xs text-slate-500">{helperText}</p> : null}
    </div>
  );
}

export function StepProgress({ currentStep }) {
  const steps = CANDIDATE_FORM_STEPS;
  const stepIndex = Math.max(0, steps.findIndex((step) => step.id === currentStep));

  return (
    <div className="mb-6">
      <div className="flex items-center gap-2">
        {steps.map((step, index) => {
          const complete = currentStep > step.id;
          const current = currentStep === step.id;
          return (
            <div key={step.id} className="flex min-w-0 flex-1 items-center gap-2">
              <div
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[0.7rem] font-bold transition-all ${
                  complete
                    ? 'bg-[#2098C8] text-white shadow-md shadow-[#2098C8]/30'
                    : current
                      ? 'bg-[#2098C8] text-white shadow-lg shadow-[#2098C8]/30 ring-4 ring-[#2098C8]/25'
                      : 'bg-slate-100 text-slate-400 ring-1 ring-slate-200'
                }`}
                title={step.label}
              >
                {complete ? <Check size={14} /> : step.id}
              </div>
              <span
                className={`hidden min-w-0 truncate text-xs font-semibold sm:block ${
                  current ? 'text-slate-900' : complete ? 'text-[#2098C8]' : 'text-slate-400'
                }`}
              >
                {step.label}
              </span>
              {index < steps.length - 1 ? (
                <div
                  className={`h-1.5 min-w-[6px] flex-1 rounded-full ${
                    complete
                      ? 'bg-[#2098C8]'
                      : current
                        ? 'bg-gradient-to-r from-[#2098C8] to-slate-200'
                        : 'bg-slate-200/90'
                  }`}
                />
              ) : null}
            </div>
          );
        })}
      </div>
      <p className="mt-2.5 text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-slate-400">
        Step {stepIndex + 1} of {steps.length} · {steps[stepIndex]?.label}
      </p>
    </div>
  );
}

export function AddCandidateAiFlowProgress({ stage }) {
  const steps = [
    { id: 'chat', label: 'Chat with AI' },
    { id: 'form', label: 'Review form' },
  ];
  const activeIndex = stage === 'chat' ? 0 : 1;

  return (
    <div className="shrink-0 border-b border-indigo-100/80 bg-white/90 px-6 py-3">
      <div className="flex items-center gap-1 rounded-2xl bg-white/80 p-1 shadow-[0_8px_24px_-16px_rgba(79,70,229,0.45)] ring-1 ring-indigo-100/80">
        {steps.map((step, i) => {
          const done = i < activeIndex;
          const active = i === activeIndex;
          return (
            <div
              key={step.id}
              className={`flex min-w-0 flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-xs font-semibold transition ${
                active
                  ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-500/25'
                  : done
                    ? 'text-indigo-700'
                    : 'text-slate-400'
              }`}
            >
              <span
                className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
                  active ? 'bg-white/20 text-white' : done ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-400'
                }`}
              >
                {done ? <Check className="h-3 w-3" /> : i + 1}
              </span>
              <span className="truncate">{step.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
