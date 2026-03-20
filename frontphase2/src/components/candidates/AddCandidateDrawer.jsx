import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Check,
  ChevronDown,
  ChevronRight,
  Download,
  FileSpreadsheet,
  FileText,
  Loader2,
  Upload,
  UserRound,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  apiBulkImportCandidates,
  apiCheckCandidateDuplicate,
  apiCreateCandidateFromDrawer,
  apiGetCandidateTagSuggestions,
  apiGetJobs,
  apiGetUsers,
  apiImportCandidateFromLinkedIn,
  apiParseCandidateResume,
  apiUploadCandidateResumeFile,
} from '@/lib/api';

const METHOD_TABS = [
  { key: 'manual', label: 'Manual Entry' },
  { key: 'resume', label: 'Upload Resume' },
  { key: 'linkedin', label: 'LinkedIn URL' },
  { key: 'csv', label: 'Bulk CSV' },
];

const PIPELINE_STAGES = ['Applied', 'Screening', 'Shortlist', 'Interview', 'Offer', 'Hired'];
const SOURCE_OPTIONS = [
  'LinkedIn',
  'Naukri',
  'Indeed',
  'Referral',
  'Company Career Page',
  'Agency',
  'Other',
];
const PRIORITY_OPTIONS = ['High', 'Medium', 'Low'];
const NOTICE_PERIOD_OPTIONS = ['Immediate', '15 days', '30 days', '45 days', '60 days', '90 days+'];
const AVAILABILITY_OPTIONS = ['Available', 'Interviewing Elsewhere', 'Not Available'];
const CURRENCY_OPTIONS = ['INR', 'USD', 'GBP', 'AED', 'EUR'];
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const LINKEDIN_REGEX = /^(https?:\/\/)?(www\.)?linkedin\.com\/in\/[A-Za-z0-9-_%]+\/?$/i;

const DEFAULT_FORM_DATA = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  currentCompany: '',
  currentDesignation: '',
  experience: '',
  location: '',
  linkedinUrl: '',
  jobId: '',
  stage: 'Applied',
  recruiterId: '',
  source: '',
  sourceUrl: '',
  referrerName: '',
  agencyName: '',
  priority: 'Medium',
  tags: [],
  expectedSalary: '',
  currency: 'INR',
  noticePeriod: 'Immediate',
  availabilityStatus: 'Available',
  portfolioUrl: '',
  skills: [],
  initialNote: '',
};

function hasMeaningfulValue(value) {
  if (Array.isArray(value)) return value.length > 0;
  return String(value ?? '').trim().length > 0;
}

function getDirtyState(formData, extras = {}) {
  return Object.values(formData).some((value) => hasMeaningfulValue(value)) || Object.values(extras).some(Boolean);
}

function extractItems(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.items)) return payload.items;
  return [];
}

function normalizeAutoFilledFields(parsedData) {
  const fields = {};
  Object.entries(parsedData || {}).forEach(([key, value]) => {
    if (Array.isArray(value) ? value.length > 0 : String(value ?? '').trim() !== '') {
      fields[key] = true;
    }
  });
  return fields;
}

function parseCsvLine(line) {
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

function parseCsvContent(content) {
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

function getInitials(name = '') {
  return String(name)
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

function DrawerInput({
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

function PillButton({ active, children, onClick, tone = 'blue' }) {
  const toneClasses = {
    blue: active ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-200',
    red: active ? 'bg-rose-600 text-white border-rose-600' : 'bg-white text-slate-600 border-slate-200',
    amber: active ? 'bg-amber-500 text-white border-amber-500' : 'bg-white text-slate-600 border-slate-200',
    green: active ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-slate-600 border-slate-200',
    slate: active ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200',
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${toneClasses[tone]}`}
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
  autoFilled,
  emptyMessage,
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
          onClick={() => setOpen((prev) => !prev)}
          className={`flex w-full items-center justify-between rounded-xl border bg-white px-3 py-2.5 text-left text-sm ${
            error ? 'border-red-400' : 'border-slate-200'
          }`}
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

function TagInput({
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

function StepProgress({ currentStep }) {
  const steps = [
    { id: 1, label: 'Basic Info' },
    { id: 2, label: 'Job & Pipeline' },
    { id: 3, label: 'Professional Details' },
  ];

  return (
    <div className="mb-6 flex items-center justify-between gap-2">
      {steps.map((step, index) => {
        const complete = currentStep > step.id;
        const current = currentStep === step.id;
        return (
          <React.Fragment key={step.id}>
            <div className="flex items-center gap-2">
              <div
                className={`flex h-7 w-7 items-center justify-center rounded-full border text-xs font-semibold ${
                  complete
                    ? 'border-blue-600 bg-blue-600 text-white'
                    : current
                      ? 'border-blue-600 bg-blue-600 text-white'
                      : 'border-slate-300 bg-white text-slate-400'
                }`}
              >
                {complete ? <Check size={14} /> : step.id}
              </div>
              <span className={`text-sm font-medium ${current || complete ? 'text-slate-900' : 'text-slate-400'}`}>
                {step.label}
              </span>
            </div>
            {index < steps.length - 1 ? <div className="h-px flex-1 bg-slate-200" /> : null}
          </React.Fragment>
        );
      })}
    </div>
  );
}

export default function AddCandidateDrawer({ isOpen, onClose, onSuccess, currentUser }) {
  const [activeTab, setActiveTab] = useState('manual');
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState(DEFAULT_FORM_DATA);
  const [errors, setErrors] = useState({});
  const [parsedResumeFile, setParsedResumeFile] = useState(null);
  const [manualResumeFile, setManualResumeFile] = useState(null);
  const [parsedData, setParsedData] = useState(null);
  const [autoFilledFields, setAutoFilledFields] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState(null);
  const [csvPhase, setCsvPhase] = useState('upload');
  const [csvRows, setCsvRows] = useState([]);
  const [csvResult, setCsvResult] = useState(null);
  const [csvFile, setCsvFile] = useState(null);
  const [csvImportProgress, setCsvImportProgress] = useState({ current: 0, total: 0 });
  const [jobs, setJobs] = useState([]);
  const [recruiters, setRecruiters] = useState([]);
  const [tagSuggestions, setTagSuggestions] = useState([]);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [saveBanner, setSaveBanner] = useState(null);
  const [inlineSuccess, setInlineSuccess] = useState('');
  const [linkedInInput, setLinkedInInput] = useState('');
  const [entryError, setEntryError] = useState('');
  const [csvExpanded, setCsvExpanded] = useState(false);
  const fieldRefs = useRef({});
  const importProgressRef = useRef(null);

  const selectedJob = useMemo(() => jobs.find((job) => job.id === formData.jobId) || null, [jobs, formData.jobId]);
  const selectedRecruiter = useMemo(
    () => recruiters.find((recruiter) => recruiter.id === formData.recruiterId) || null,
    [recruiters, formData.recruiterId]
  );

  const hasUnsavedChanges = useMemo(
    () =>
      getDirtyState(formData, {
        parsedResumeFile,
        manualResumeFile,
        parsedData,
        linkedInInput,
        csvFile,
        csvRows: csvRows.length > 0,
        csvResult,
      }),
    [csvFile, csvResult, csvRows.length, formData, linkedInInput, manualResumeFile, parsedData, parsedResumeFile]
  );

  useEffect(() => {
    if (!isOpen || dataLoaded) return;

    let ignore = false;
    async function loadOptions() {
      try {
        const [jobsRes, recruitersRes, tagsRes] = await Promise.all([
          apiGetJobs({ status: 'OPEN', limit: 100 }),
          apiGetUsers({ role: 'RECRUITER', isActive: true, limit: 100 }),
          apiGetCandidateTagSuggestions(),
        ]);

        if (ignore) return;
        setJobs(extractItems(jobsRes.data).map((job) => ({
          id: job.id,
          title: job.title,
          department: job.department || job.client?.companyName || 'General',
        })));
        setRecruiters(extractItems(recruitersRes.data).map((user) => ({
          id: user.id,
          name: user.name,
          email: user.email,
          avatar: user.avatar,
        })));
        setTagSuggestions(extractItems(tagsRes.data));
        setDataLoaded(true);
      } catch (loadError) {
        console.error('Failed to load add-candidate options:', loadError);
      }
    }

    loadOptions();
    return () => {
      ignore = true;
    };
  }, [dataLoaded, isOpen]);

  useEffect(() => {
    if (!formData.recruiterId && currentUser?._id) {
      setFormData((prev) => ({ ...prev, recruiterId: currentUser._id }));
    }
  }, [currentUser, formData.recruiterId]);

  useEffect(() => {
    if (!isOpen) {
      clearInterval(importProgressRef.current);
    }
  }, [isOpen]);

  const resetForNext = (nextTab = activeTab) => {
    setCurrentStep(1);
    setFormData({
      ...DEFAULT_FORM_DATA,
      recruiterId: currentUser?._id || '',
    });
    setErrors({});
    setParsedResumeFile(null);
    setManualResumeFile(null);
    setParsedData(null);
    setAutoFilledFields({});
    setDuplicateWarning(null);
    setSaveBanner(null);
    setInlineSuccess('');
    setLinkedInInput('');
    setEntryError('');
    setCsvPhase('upload');
    setCsvRows([]);
    setCsvResult(null);
    setCsvFile(null);
    setCsvExpanded(false);
    setCsvImportProgress({ current: 0, total: 0 });
    if (nextTab) setActiveTab(nextTab);
  };

  const confirmDiscard = () => {
    if (!hasUnsavedChanges) return true;
    return window.confirm('You have unsaved changes. Close anyway?');
  };

  const handleDrawerClose = () => {
    if (!confirmDiscard()) return;
    resetForNext(activeTab);
    onClose();
  };

  const handleTabChange = (nextTab) => {
    if (nextTab === activeTab) return;
    if (!confirmDiscard()) return;
    resetForNext(nextTab);
  };

  const updateFormData = (name, value) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => {
      if (!prev[name]) return prev;
      const next = { ...prev };
      delete next[name];
      return next;
    });
    setInlineSuccess('');
  };

  const scrollToField = (fieldName) => {
    const node = fieldRefs.current[fieldName];
    if (node && typeof node.scrollIntoView === 'function') {
      node.scrollIntoView({ behavior: 'smooth', block: 'center' });
      if (typeof node.focus === 'function') node.focus();
    }
  };

  const validateStep = (step) => {
    const nextErrors = {};

    if (step === 1) {
      if (!formData.firstName.trim()) nextErrors.firstName = 'First name is required';
      if (!formData.lastName.trim()) nextErrors.lastName = 'Last name is required';
      if (!formData.email.trim()) {
        nextErrors.email = 'Email is required';
      } else if (!EMAIL_REGEX.test(formData.email.trim())) {
        nextErrors.email = 'Enter a valid email address';
      }
      if (formData.phone && !/^\d{7,15}$/.test(formData.phone.trim())) {
        nextErrors.phone = 'Phone must be 7-15 digits';
      }
      const experience = Number(formData.experience);
      if (formData.experience === '' || Number.isNaN(experience)) {
        nextErrors.experience = 'Experience is required';
      } else if (experience < 0 || experience > 50) {
        nextErrors.experience = 'Experience must be between 0 and 50';
      }
      if (formData.linkedinUrl && !LINKEDIN_REGEX.test(formData.linkedinUrl.trim())) {
        nextErrors.linkedinUrl = 'Enter a valid LinkedIn URL';
      }
    }

    if (step === 2) {
      if (!formData.source) {
        nextErrors.source = 'Source is required';
      }
      if (['LinkedIn', 'Naukri', 'Indeed'].includes(formData.source) && !formData.sourceUrl.trim()) {
        nextErrors.sourceUrl = 'Source profile URL is required';
      }
      if (formData.source === 'Referral' && !formData.referrerName.trim()) {
        nextErrors.referrerName = 'Referrer name is required';
      }
      if (formData.source === 'Agency' && !formData.agencyName.trim()) {
        nextErrors.agencyName = 'Agency name is required';
      }
      if (formData.tags.length > 10) {
        nextErrors.tags = 'Maximum 10 tags allowed';
      }
    }

    if (step === 3) {
      if (formData.expectedSalary && Number(formData.expectedSalary) <= 0) {
        nextErrors.expectedSalary = 'Salary must be a positive number';
      }
      if (formData.portfolioUrl && !/^https?:\/\//i.test(formData.portfolioUrl.trim())) {
        nextErrors.portfolioUrl = 'Portfolio URL must start with http:// or https://';
      }
      if (formData.skills.length > 10) {
        nextErrors.skills = 'Maximum 10 skills allowed';
      }
      if (formData.initialNote.length > 500) {
        nextErrors.initialNote = 'Initial note cannot exceed 500 characters';
      }
    }

    setErrors(nextErrors);
    const firstError = Object.keys(nextErrors)[0];
    if (firstError) {
      scrollToField(firstError);
      return false;
    }
    return true;
  };

  const handleDuplicateCheck = async (field) => {
    const value = field === 'email' ? formData.email.trim() : formData.phone.trim();
    if (!value) return;
    if (field === 'email' && !EMAIL_REGEX.test(value)) return;
    if (field === 'phone' && !/^\d{7,15}$/.test(value)) return;

    try {
      const response = await apiCheckCandidateDuplicate(
        field === 'email' ? { email: value } : { phone: value }
      );
      const payload = response.data;
      if (payload?.isDuplicate) {
        setDuplicateWarning({ field, ...payload });
      } else if (duplicateWarning?.field === field) {
        setDuplicateWarning(null);
      }
    } catch (error) {
      console.error('Duplicate check failed:', error);
    }
  };

  const applyImportedData = (data, sourceType, file = null) => {
    const nextData = {
      firstName: data.firstName || '',
      lastName: data.lastName || '',
      email: data.email || '',
      phone: String(data.phone || '').replace(/[^\d]/g, ''),
      currentCompany: data.currentCompany || '',
      currentDesignation: data.designation || '',
      experience: data.experience || '',
      location: data.location || '',
      linkedinUrl: data.linkedinUrl || '',
      expectedSalary: data.expectedSalary || '',
      currency: data.currency || 'INR',
      portfolioUrl: data.portfolioUrl || '',
      skills: Array.isArray(data.skills) ? data.skills.slice(0, 10) : [],
    };

    setFormData((prev) => ({
      ...prev,
      ...nextData,
      source: prev.source || (sourceType === 'linkedin' ? 'LinkedIn' : prev.source),
    }));
    setParsedData(data);
    setAutoFilledFields(normalizeAutoFilledFields(nextData));
    if (file) setParsedResumeFile(file);
  };

  const handleResumeFile = async (file) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setEntryError('Resume must be 5MB or smaller.');
      return;
    }

    setIsLoading(true);
    setEntryError('');
    try {
      const response = await apiParseCandidateResume(file);
      applyImportedData(response.data, 'resume', file);
    } catch (error) {
      setEntryError(error.message || 'Could not parse resume. Try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLinkedInImport = async () => {
    const value = linkedInInput.trim();
    if (!value || !value.includes('linkedin.com/in/')) {
      setEntryError('Invalid LinkedIn URL');
      return;
    }

    setIsLoading(true);
    setEntryError('');
    try {
      const response = await apiImportCandidateFromLinkedIn(value);
      applyImportedData(response.data, 'linkedin');
      updateFormData('linkedinUrl', value);
    } catch (error) {
      setEntryError(error.message || 'Could not fetch profile. Check the URL and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCsvSelected = async (file) => {
    if (!file) return;
    const content = await file.text();
    const rows = parseCsvContent(content);
    setCsvFile(file);

    const previewRows = await Promise.all(
      rows.map(async (row, index) => {
        const missingRequired = !String(row.firstName || '').trim() || !String(row.email || '').trim();
        if (missingRequired) {
          return { ...row, __index: index + 1, __status: 'Missing fields' };
        }

        try {
          const duplicateRes = await apiCheckCandidateDuplicate({ email: row.email });
          if (duplicateRes.data?.isDuplicate) {
            return { ...row, __index: index + 1, __status: 'Duplicate' };
          }
        } catch (error) {
          console.error('Duplicate preview check failed:', error);
        }

        return { ...row, __index: index + 1, __status: 'Ready' };
      })
    );

    setCsvRows(previewRows);
    setCsvPhase('preview');
  };

  const handleBulkImport = async () => {
    if (!csvFile) return;
    const readyCount = csvRows.filter((row) => row.__status === 'Ready').length;
    setCsvPhase('importing');
    setCsvImportProgress({ current: 0, total: readyCount });

    importProgressRef.current = window.setInterval(() => {
      setCsvImportProgress((prev) => ({
        ...prev,
        current: prev.current < prev.total ? prev.current + 1 : prev.current,
      }));
    }, 120);

    try {
      const response = await apiBulkImportCandidates(csvFile);
      clearInterval(importProgressRef.current);
      setCsvImportProgress({ current: readyCount, total: readyCount });
      setCsvResult(response.data);
      setCsvPhase('complete');
      toast.success(`${response.data.created} candidates imported successfully`);
    } catch (error) {
      clearInterval(importProgressRef.current);
      setCsvPhase('preview');
      setEntryError(error.message || 'Bulk import failed');
    }
  };

  const handleSave = async (mode) => {
    if (!validateStep(3)) return;

    setIsSaving(true);
    setSaveBanner(null);
    try {
      const payload = {
        ...formData,
        designation: formData.currentDesignation,
        experience: Number(formData.experience),
        expectedSalary: formData.expectedSalary ? Number(formData.expectedSalary) : undefined,
      };

      const response = await apiCreateCandidateFromDrawer(payload);
      const candidate = response.data;
      const uploadFile = parsedResumeFile || manualResumeFile;
      if (uploadFile) {
        await apiUploadCandidateResumeFile(candidate.id, uploadFile);
      }

      toast.success(`${formData.firstName} ${formData.lastName} added successfully`);

      if (mode === 'saveAndAddAnother') {
        resetForNext(activeTab);
        setInlineSuccess('Candidate saved! Fill in the next one.');
      } else {
        onSuccess?.(candidate);
        resetForNext(activeTab);
        onClose();
      }
    } catch (error) {
      if (String(error.message || '').toLowerCase().includes('already exists')) {
        setSaveBanner({ type: 'duplicate', message: 'This candidate already exists.' });
      } else {
        setSaveBanner({ type: 'error', message: error.message || 'Something went wrong. Try again.' });
      }
    } finally {
      setIsSaving(false);
    }
  };

  const renderDuplicateWarning = (field) => {
    if (!duplicateWarning || duplicateWarning.field !== field) return null;
    const existing = duplicateWarning.candidate;
    return (
      <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
        <div className="flex items-start gap-2">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <div className="space-y-2">
            <p className="font-medium">A candidate with this {field} already exists:</p>
            <p className="text-xs text-amber-800">
              {existing?.name} - {existing?.designation || 'Candidate'} at {existing?.currentCompany || 'Unknown Company'} ({existing?.stage || 'Applied'})
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => window.open(`/candidate?candidateId=${existing?._id}`, '_blank', 'noopener,noreferrer')}
                className="rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-amber-900 border border-amber-300"
              >
                View Existing Candidate ↗
              </button>
              <button
                type="button"
                onClick={() => setDuplicateWarning(null)}
                className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white"
              >
                Continue Anyway
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const entryBanner = parsedData ? (
    <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
      Fields below were auto-filled from {activeTab === 'linkedin' ? 'LinkedIn' : 'resume'}. Review and edit before saving.
    </div>
  ) : null;

  const csvSummary = useMemo(() => {
    const ready = csvRows.filter((row) => row.__status === 'Ready').length;
    const duplicates = csvRows.filter((row) => row.__status === 'Duplicate').length;
    const errorsCount = csvRows.filter((row) => row.__status === 'Missing fields').length;
    return { ready, duplicates, errorsCount };
  }, [csvRows]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[90]">
      <div className="absolute inset-0 bg-slate-900/50" onClick={handleDrawerClose} />

      <div
        className={`absolute inset-x-0 bottom-0 h-[92vh] rounded-t-2xl bg-white shadow-2xl transition-transform duration-300 sm:inset-y-0 sm:right-0 sm:left-auto sm:h-full sm:w-[520px] sm:rounded-none ${
          isOpen ? 'translate-y-0 sm:translate-x-0' : 'translate-y-full sm:translate-x-full'
        } flex flex-col`}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h2 className="text-base font-medium text-slate-900">Add New Candidate</h2>
            {inlineSuccess ? <p className="mt-1 text-xs font-medium text-emerald-600">{inlineSuccess}</p> : null}
          </div>
          <button
            type="button"
            onClick={handleDrawerClose}
            className="rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          <div className="mb-5 flex flex-wrap gap-2">
            {METHOD_TABS.map((tab) => (
              <PillButton key={tab.key} active={activeTab === tab.key} onClick={() => handleTabChange(tab.key)}>
                {tab.label}
              </PillButton>
            ))}
          </div>

          {saveBanner ? (
            <div
              className={`mb-4 rounded-xl border px-4 py-3 text-sm ${
                saveBanner.type === 'duplicate'
                  ? 'border-amber-200 bg-amber-50 text-amber-900'
                  : 'border-red-200 bg-red-50 text-red-700'
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <span>{saveBanner.message}</span>
              </div>
            </div>
          ) : null}

          {activeTab !== 'csv' ? <StepProgress currentStep={currentStep} /> : null}

          {activeTab === 'resume' ? (
            <div className="mb-5">
              {!parsedResumeFile ? (
                <label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 px-6 py-8 text-center">
                  <Upload size={24} className="mb-3 text-slate-400" />
                  <p className="text-sm font-medium text-slate-700">Drag resume here or click to browse</p>
                  <p className="mt-1 text-xs text-slate-500">PDF, DOC, DOCX · Max 5MB</p>
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx"
                    className="hidden"
                    onChange={(event) => handleResumeFile(event.target.files?.[0])}
                  />
                </label>
              ) : (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                  <div className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-2">
                      <Check size={16} />
                      {parsedResumeFile.name} Parsed successfully
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setParsedResumeFile(null);
                        setParsedData(null);
                        setAutoFilledFields({});
                      }}
                      className="text-xs font-semibold text-emerald-700"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              )}
              {isLoading ? (
                <div className="mt-3 flex items-center gap-2 text-sm text-blue-600">
                  <Loader2 size={16} className="animate-spin" />
                  AI is reading the resume...
                </div>
              ) : null}
              {entryError ? (
                <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  <div className="flex items-center justify-between gap-3">
                    <span>{entryError}</span>
                    <button type="button" onClick={() => setEntryError('')} className="text-xs font-semibold">
                      Retry
                    </button>
                  </div>
                </div>
              ) : null}
              {entryBanner}
            </div>
          ) : null}

          {activeTab === 'linkedin' ? (
            <div className="mb-5">
              {!parsedData ? (
                <div className="rounded-2xl border border-slate-200 bg-white p-3">
                  <div className="flex items-center gap-2">
                    <input
                      value={linkedInInput}
                      onChange={(event) => setLinkedInInput(event.target.value)}
                      placeholder="linkedin.com/in/username"
                      className="flex-1 rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-500"
                    />
                    <button
                      type="button"
                      onClick={handleLinkedInImport}
                      className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white"
                    >
                      {isLoading ? <Loader2 size={16} className="animate-spin" /> : 'Import'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                  <div className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-2">
                      <Check size={16} />
                      Profile imported from LinkedIn
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setParsedData(null);
                        setAutoFilledFields({});
                        setLinkedInInput('');
                      }}
                      className="text-xs font-semibold text-emerald-700"
                    >
                      Clear
                    </button>
                  </div>
                </div>
              )}
              {entryError ? <p className="mt-2 text-sm text-red-600">{entryError}</p> : null}
              {entryBanner}
            </div>
          ) : null}

          {activeTab === 'csv' ? (
            <div className="space-y-5">
              {csvPhase === 'upload' ? (
                <>
                  <label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center">
                    <FileSpreadsheet size={24} className="mb-3 text-slate-400" />
                    <p className="text-sm font-medium text-slate-700">Drag CSV file here or click browse</p>
                    <p className="mt-1 text-xs text-slate-500">.csv files only</p>
                    <input
                      type="file"
                      accept=".csv,text/csv"
                      className="hidden"
                      onChange={(event) => handleCsvSelected(event.target.files?.[0])}
                    />
                  </label>
                  <a
                    href={`${process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, '') || 'http://localhost:5000/api/v1'}/candidates/bulk-import/template`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 text-sm font-medium text-blue-600"
                  >
                    <Download size={16} />
                    Download CSV template
                  </a>
                </>
              ) : null}

              {csvPhase === 'preview' ? (
                <>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                    {csvSummary.ready} ready to import · {csvSummary.duplicates} duplicates will be skipped ·{' '}
                    {csvSummary.errorsCount} rows have errors
                  </div>
                  <div className="overflow-hidden rounded-2xl border border-slate-200">
                    <div className="max-h-[420px] overflow-auto">
                      <table className="min-w-full text-left text-sm">
                        <thead className="sticky top-0 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                          <tr>
                            <th className="px-3 py-2">#</th>
                            <th className="px-3 py-2">Name</th>
                            <th className="px-3 py-2">Email</th>
                            <th className="px-3 py-2">Company</th>
                            <th className="px-3 py-2">Designation</th>
                            <th className="px-3 py-2">Source</th>
                            <th className="px-3 py-2">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {csvRows.slice(0, 10).map((row) => (
                            <tr key={row.__index} className="border-t border-slate-100">
                              <td className="px-3 py-2">{row.__index}</td>
                              <td className="px-3 py-2">{`${row.firstName || ''} ${row.lastName || ''}`.trim() || '-'}</td>
                              <td className="px-3 py-2">{row.email || '-'}</td>
                              <td className="px-3 py-2">{row.currentCompany || '-'}</td>
                              <td className="px-3 py-2">{row.designation || '-'}</td>
                              <td className="px-3 py-2">{row.source || '-'}</td>
                              <td className="px-3 py-2">
                                <span
                                  className={`rounded-full px-2 py-1 text-xs font-semibold ${
                                    row.__status === 'Ready'
                                      ? 'bg-emerald-50 text-emerald-700'
                                      : row.__status === 'Duplicate'
                                        ? 'bg-amber-50 text-amber-700'
                                        : 'bg-rose-50 text-rose-700'
                                  }`}
                                >
                                  {row.__status}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              ) : null}

              {csvPhase === 'importing' ? (
                <div className="rounded-2xl border border-slate-200 bg-white p-5">
                  <div className="mb-3 flex items-center gap-2 text-sm font-medium text-slate-800">
                    <Loader2 size={16} className="animate-spin" />
                    Importing... {csvImportProgress.current} / {csvImportProgress.total}
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-blue-600 transition-all"
                      style={{
                        width: `${csvImportProgress.total ? (csvImportProgress.current / csvImportProgress.total) * 100 : 0}%`,
                      }}
                    />
                  </div>
                </div>
              ) : null}

              {csvPhase === 'complete' && csvResult ? (
                <div className="rounded-2xl border border-slate-200 bg-white p-5">
                  <div className="space-y-3 text-sm text-slate-700">
                    <p className="font-semibold text-emerald-600">✓ {csvResult.created} candidates imported successfully</p>
                    <p className="font-semibold text-amber-600">⚠ {csvResult.skipped} skipped (duplicate email)</p>
                    <p className="font-semibold text-rose-600">✕ {csvResult.failed} failed (missing required fields)</p>
                    <button
                      type="button"
                      onClick={() => setCsvExpanded((prev) => !prev)}
                      className="inline-flex items-center gap-1 text-sm font-medium text-slate-700"
                    >
                      {csvExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                      Show skipped details
                    </button>
                    {csvExpanded && csvResult.skippedDetails?.length ? (
                      <div className="rounded-xl bg-slate-50 p-3 text-xs">
                        {csvResult.skippedDetails.map((detail, index) => (
                          <div key={`${detail.row}-${index}`} className="py-1">
                            Row {detail.row} - {detail.email || 'No email'} - {detail.reason}
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="space-y-8">
              {currentStep === 1 ? (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <DrawerInput
                    label="First Name"
                    name="firstName"
                    required
                    value={formData.firstName}
                    onChange={(event) => updateFormData('firstName', event.target.value)}
                    error={errors.firstName}
                    inputRef={(node) => {
                      fieldRefs.current.firstName = node;
                    }}
                    autoFilled={autoFilledFields.firstName}
                  />
                  <DrawerInput
                    label="Last Name"
                    name="lastName"
                    required
                    value={formData.lastName}
                    onChange={(event) => updateFormData('lastName', event.target.value)}
                    error={errors.lastName}
                    inputRef={(node) => {
                      fieldRefs.current.lastName = node;
                    }}
                    autoFilled={autoFilledFields.lastName}
                  />

                  <div className="sm:col-span-1" ref={(node) => (fieldRefs.current.email = node?.querySelector?.('input') || node)}>
                    <DrawerInput
                      label="Email"
                      name="email"
                      required
                      value={formData.email}
                      onChange={(event) => updateFormData('email', event.target.value)}
                      onBlur={() => handleDuplicateCheck('email')}
                      error={errors.email}
                      autoFilled={autoFilledFields.email}
                    />
                    {renderDuplicateWarning('email')}
                  </div>

                  <div ref={(node) => (fieldRefs.current.phone = node?.querySelector?.('input') || node)}>
                    <DrawerInput
                      label="Phone"
                      name="phone"
                      value={formData.phone}
                      onChange={(event) => updateFormData('phone', event.target.value.replace(/[^\d]/g, ''))}
                      onBlur={() => handleDuplicateCheck('phone')}
                      error={errors.phone}
                      autoFilled={autoFilledFields.phone}
                    />
                    {renderDuplicateWarning('phone')}
                  </div>

                  <DrawerInput
                    label="Current Company"
                    name="currentCompany"
                    value={formData.currentCompany}
                    onChange={(event) => updateFormData('currentCompany', event.target.value)}
                    autoFilled={autoFilledFields.currentCompany}
                  />
                  <DrawerInput
                    label="Current Designation"
                    name="currentDesignation"
                    value={formData.currentDesignation}
                    onChange={(event) => updateFormData('currentDesignation', event.target.value)}
                    autoFilled={autoFilledFields.currentDesignation}
                  />
                  <DrawerInput
                    label="Total Experience"
                    name="experience"
                    required
                    value={formData.experience}
                    onChange={(event) => updateFormData('experience', event.target.value.replace(/[^\d.]/g, ''))}
                    error={errors.experience}
                    suffix="years"
                    autoFilled={autoFilledFields.experience}
                  />
                  <DrawerInput
                    label="Location"
                    name="location"
                    value={formData.location}
                    onChange={(event) => updateFormData('location', event.target.value)}
                    placeholder="City, Country"
                    autoFilled={autoFilledFields.location}
                  />
                  <div className="sm:col-span-2">
                    <DrawerInput
                      label="LinkedIn URL"
                      name="linkedinUrl"
                      value={formData.linkedinUrl}
                      onChange={(event) => updateFormData('linkedinUrl', event.target.value)}
                      placeholder="https://linkedin.com/in/username"
                      error={errors.linkedinUrl}
                      autoFilled={autoFilledFields.linkedinUrl}
                    />
                  </div>
                </div>
              ) : null}

              {currentStep === 2 ? (
                <div className="space-y-5">
                  <SearchableDropdown
                    label="Apply for Job"
                    value={formData.jobId}
                    onSelect={(value) => updateFormData('jobId', value)}
                    options={jobs}
                    placeholder="Search and select a job"
                    getLabel={(job) => job.title}
                    getSecondary={(job) => job.department}
                    emptyMessage="No active jobs found"
                  />

                  {selectedJob ? (
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-slate-700">Pipeline Stage</label>
                      <div className="flex flex-wrap gap-2">
                        {PIPELINE_STAGES.map((stage) => (
                          <PillButton
                            key={stage}
                            active={formData.stage === stage}
                            onClick={() => updateFormData('stage', stage)}
                          >
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

                  <DrawerInput
                    label="Source"
                    name="source"
                    required
                    value={formData.source}
                    onChange={() => {}}
                    error={errors.source}
                    children={
                      <select
                        value={formData.source}
                        onChange={(event) => updateFormData('source', event.target.value)}
                        className={`w-full rounded-xl border bg-white px-3 py-2.5 text-sm outline-none ${
                          errors.source ? 'border-red-400' : 'border-slate-200 focus:border-blue-500'
                        }`}
                      >
                        <option value="">Select source</option>
                        {SOURCE_OPTIONS.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    }
                  />

                  {['LinkedIn', 'Naukri', 'Indeed'].includes(formData.source) ? (
                    <DrawerInput
                      label="Source Profile URL"
                      name="sourceUrl"
                      value={formData.sourceUrl}
                      onChange={(event) => updateFormData('sourceUrl', event.target.value)}
                      error={errors.sourceUrl}
                    />
                  ) : null}
                  {formData.source === 'Referral' ? (
                    <DrawerInput
                      label="Referrer Name"
                      name="referrerName"
                      value={formData.referrerName}
                      onChange={(event) => updateFormData('referrerName', event.target.value)}
                      error={errors.referrerName}
                    />
                  ) : null}
                  {formData.source === 'Agency' ? (
                    <DrawerInput
                      label="Agency Name"
                      name="agencyName"
                      value={formData.agencyName}
                      onChange={(event) => updateFormData('agencyName', event.target.value)}
                      error={errors.agencyName}
                    />
                  ) : null}

                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-slate-700">Priority</label>
                    <div className="flex flex-wrap gap-2">
                      {PRIORITY_OPTIONS.map((priority) => (
                        <PillButton
                          key={priority}
                          active={formData.priority === priority}
                          onClick={() => updateFormData('priority', priority)}
                          tone={priority === 'High' ? 'red' : priority === 'Medium' ? 'amber' : 'green'}
                        >
                          {priority}
                        </PillButton>
                      ))}
                    </div>
                  </div>

                  <div ref={(node) => (fieldRefs.current.tags = node)}>
                    <TagInput
                      label="Tags"
                      values={formData.tags}
                      onChange={(values) => updateFormData('tags', values)}
                      suggestions={tagSuggestions}
                      placeholder="Type tag and press Enter"
                      helperText={errors.tags || 'Max 10 tags'}
                    />
                  </div>
                </div>
              ) : null}

              {currentStep === 3 ? (
                <div className="space-y-5">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_120px]">
                    <DrawerInput
                      label="Expected Salary"
                      name="expectedSalary"
                      value={formData.expectedSalary}
                      onChange={(event) => updateFormData('expectedSalary', event.target.value.replace(/[^\d]/g, ''))}
                      error={errors.expectedSalary}
                    />
                    <DrawerInput
                      label="Currency"
                      name="currency"
                      value={formData.currency}
                      onChange={() => {}}
                      children={
                        <select
                          value={formData.currency}
                          onChange={(event) => updateFormData('currency', event.target.value)}
                          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500"
                        >
                          {CURRENCY_OPTIONS.map((currency) => (
                            <option key={currency} value={currency}>
                              {currency}
                            </option>
                          ))}
                        </select>
                      }
                    />
                  </div>

                  <DrawerInput
                    label="Notice Period"
                    name="noticePeriod"
                    value={formData.noticePeriod}
                    onChange={() => {}}
                    children={
                      <select
                        value={formData.noticePeriod}
                        onChange={(event) => updateFormData('noticePeriod', event.target.value)}
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500"
                      >
                        {NOTICE_PERIOD_OPTIONS.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    }
                  />

                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-slate-700">Availability Status</label>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                      {AVAILABILITY_OPTIONS.map((option) => (
                        <PillButton
                          key={option}
                          active={formData.availabilityStatus === option}
                          onClick={() => updateFormData('availabilityStatus', option)}
                          tone={
                            option === 'Available'
                              ? 'green'
                              : option === 'Interviewing Elsewhere'
                                ? 'amber'
                                : 'red'
                          }
                        >
                          {option}
                        </PillButton>
                      ))}
                    </div>
                  </div>

                  {activeTab !== 'resume' ? (
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-slate-700">Resume Upload</label>
                      {!manualResumeFile ? (
                        <label className="flex cursor-pointer items-center justify-between rounded-2xl border border-dashed border-slate-300 px-4 py-4">
                          <div>
                            <p className="text-sm font-medium text-slate-700">Upload Resume</p>
                            <p className="text-xs text-slate-500">PDF, DOC, DOCX · 5MB</p>
                          </div>
                          <span className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white">Choose File</span>
                          <input
                            type="file"
                            accept=".pdf,.doc,.docx"
                            className="hidden"
                            onChange={(event) => setManualResumeFile(event.target.files?.[0] || null)}
                          />
                        </label>
                      ) : (
                        <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                          <span className="flex items-center gap-2">
                            <FileText size={16} />
                            {manualResumeFile.name}
                          </span>
                          <button type="button" onClick={() => setManualResumeFile(null)} className="text-xs font-semibold">
                            Remove
                          </button>
                        </div>
                      )}
                    </div>
                  ) : null}

                  <DrawerInput
                    label="Portfolio / Website URL"
                    name="portfolioUrl"
                    value={formData.portfolioUrl}
                    onChange={(event) => updateFormData('portfolioUrl', event.target.value)}
                    placeholder="https://yourportfolio.com"
                    error={errors.portfolioUrl}
                    autoFilled={autoFilledFields.portfolioUrl}
                  />

                  <div ref={(node) => (fieldRefs.current.skills = node)}>
                    <TagInput
                      label="Skills"
                      values={formData.skills}
                      onChange={(values) => updateFormData('skills', values)}
                      placeholder="Type skill and press Enter"
                      autoFilled={Object.keys(autoFilledFields).some((key) => key === 'skills')}
                      helperText={errors.skills || 'Free text skills, max 10'}
                      allowCustom
                      maxItems={10}
                    />
                  </div>

                  <DrawerInput
                    label="Initial Note"
                    name="initialNote"
                    value={formData.initialNote}
                    onChange={() => {}}
                    error={errors.initialNote}
                    children={
                      <div>
                        <textarea
                          value={formData.initialNote}
                          onChange={(event) => updateFormData('initialNote', event.target.value.slice(0, 500))}
                          placeholder="Add any initial notes about this candidate..."
                          className={`min-h-[120px] w-full rounded-xl border bg-white px-3 py-2.5 text-sm outline-none ${
                            errors.initialNote ? 'border-red-400' : 'border-slate-200 focus:border-blue-500'
                          }`}
                        />
                        <div className="mt-1 text-right text-xs text-slate-500">{formData.initialNote.length} / 500</div>
                      </div>
                    }
                  />
                </div>
              ) : null}
            </div>
          )}
        </div>

        <div className="border-t border-slate-200 bg-white px-6 py-4">
          {activeTab === 'csv' ? (
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={handleDrawerClose}
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700"
              >
                {csvPhase === 'complete' ? 'Done' : 'Cancel'}
              </button>
              {csvPhase === 'preview' ? (
                <button
                  type="button"
                  onClick={handleBulkImport}
                  className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white"
                >
                  Import {csvSummary.ready} Candidates →
                </button>
              ) : null}
              {csvPhase === 'complete' ? (
                <button
                  type="button"
                  onClick={() => {
                    onSuccess?.(null);
                    resetForNext(activeTab);
                    onClose();
                  }}
                  className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white"
                >
                  Done
                </button>
              ) : null}
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                {currentStep === 1 ? (
                  <button
                    type="button"
                    onClick={handleDrawerClose}
                    className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700"
                  >
                    Cancel
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setCurrentStep((prev) => Math.max(1, prev - 1))}
                    className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700"
                  >
                    ← Back
                  </button>
                )}
              </div>

              <div className="ml-auto flex flex-wrap items-center gap-3">
                {currentStep < 3 ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (!validateStep(currentStep)) return;
                      setCurrentStep((prev) => prev + 1);
                    }}
                    className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white"
                  >
                    {currentStep === 1 ? 'Next: Job Details →' : 'Next: Professional Details →'}
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => handleSave('saveAndAddAnother')}
                      disabled={isSaving}
                      className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 disabled:opacity-60"
                    >
                      Save & Add Another
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSave('save')}
                      disabled={isSaving}
                      className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                    >
                      {isSaving ? 'Saving...' : 'Save Candidate'}
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
