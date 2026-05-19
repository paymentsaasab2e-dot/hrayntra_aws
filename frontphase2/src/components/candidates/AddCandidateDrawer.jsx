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
  StopCircle,
  Upload,
  UserRound,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  apiBulkCvProcessFile,
  apiBulkImportCandidates,
  apiCheckCandidateDuplicate,
  apiCreateCandidateFromDrawer,
  apiFetchFormData,
  apiGetCandidateTagSuggestions,
  apiGetJobs,
  apiGetUsers,
  apiParseCandidateResume,
  apiUpdateCandidate,
  apiUploadCandidateResumeFile,
  buildSocketBaseUrl,
} from '@/lib/api';
import { MY_JOBS_LIST_PARAMS } from '@/lib/myJobsListParams';
import { addFailedBulkResumeRecords, removeFailedBulkResumesByFileName } from '@/lib/failedBulkResumesStore';
import { AddCandidateFormSections, CANDIDATE_FORM_STEPS } from './AddCandidateFormSections';

/** Align with backend `RESUME_MAX_FILE_BYTES` (default 25MB). Optional: NEXT_PUBLIC_RESUME_MAX_FILE_BYTES (bytes). */
const MAX_RESUME_FILE_BYTES = (() => {
  if (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_RESUME_MAX_FILE_BYTES) {
    const n = parseInt(String(process.env.NEXT_PUBLIC_RESUME_MAX_FILE_BYTES).trim(), 10);
    if (Number.isFinite(n) && n >= 5 * 1024 * 1024) return n;
  }
  return 25 * 1024 * 1024;
})();
const MAX_RESUME_FILE_LABEL = `${Math.round(MAX_RESUME_FILE_BYTES / (1024 * 1024))}MB`;
const MAX_AVATAR_FILE_BYTES = 5 * 1024 * 1024;

const METHOD_TABS = [
  { key: 'manual', label: 'Manual Entry' },
  { key: 'resume', label: 'Upload Resume' },
  { key: 'csv', label: 'Bulk CSV' },
  { key: 'bulkResume', label: 'Bulk CV Upload' },
];

const DRAWER_TITLES = {
  manual: 'Add New Candidate',
  resume: 'Upload Resume',
  csv: 'Bulk CSV Import',
  bulkResume: 'Bulk CV Upload',
};

const DRAWER_DESCRIPTIONS = {
  manual: 'Create a candidate profile manually.',
  resume: 'Upload a resume and let the parser fill the form.',
  csv: 'Import candidates from a CSV file.',
  bulkResume: 'Create candidates from multiple resume files.',
};

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
const MARITAL_STATUS_OPTIONS = ['Single', 'Married', 'Divorced', 'Widowed', 'Prefer not to say'];
const PROFICIENCY_OPTIONS = ['Basic', 'Conversational', 'Professional', 'Native'];
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const KNOWN_DOMAINS = [
  'gmail.com',
  'yahoo.com',
  'outlook.com',
  'hotmail.com',
  'icloud.com',
  'rediffmail.com',
  'mail.com',
  'live.com',
];
const LINKEDIN_REGEX = /^(https?:\/\/)?(www\.)?linkedin\.com\/in\/[A-Za-z0-9-_%]+\/?$/i;
const NO_DIGITS_REGEX = /\d/;
const CANDIDATES_CHANGED_EVENT = 'jobportal:candidates-changed';

const DEFAULT_FORM_DATA = {
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
  educationEntries: [{ qualification: '', instituteName: '' }],
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

function extractItems(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.items)) return payload.items;
  return [];
}

/** Only trust parse-time URLs that can be stored on the candidate (Cloudinary / remote). */
function isPersistableRemoteResumeUrl(value) {
  return typeof value === 'string' && /^https?:\/\//i.test(String(value).trim());
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

function notifyCandidatesChanged() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(CANDIDATES_CHANGED_EVENT));
}

function getInitials(name = '') {
  return String(name)
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

function levenshtein(a, b) {
  const m = a.length;
  const n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) =>
    Array(n + 1).fill(0).map((_, j) => (j === 0 ? i : 0))
  );

  for (let j = 0; j <= n; j += 1) dp[0][j] = j;
  for (let i = 1; i <= m; i += 1) {
    for (let j = 1; j <= n; j += 1) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1]);
    }
  }

  return dp[m][n];
}

function validateEmail(email) {
  const value = String(email || '').trim();

  if (!EMAIL_REGEX.test(value)) {
    return { valid: false, message: 'Invalid email format' };
  }

  const domain = value.split('@')[1]?.toLowerCase() || '';
  if (!KNOWN_DOMAINS.includes(domain)) {
    let best = null;
    let bestDist = Infinity;

    for (const known of KNOWN_DOMAINS) {
      const dist = levenshtein(domain, known);
      if (dist < bestDist) {
        bestDist = dist;
        best = known;
      }
    }

    if (bestDist <= 3 && best) {
      return { valid: false, message: `Did you mean @${best}?` };
    }
  }

  return { valid: true, message: 'Valid email' };
}

function validateNoDigits(value, label) {
  const text = String(value || '').trim();
  if (!text) return { valid: false, message: `${label} is required` };
  if (NO_DIGITS_REGEX.test(text)) {
    return { valid: false, message: `${label} cannot contain numbers` };
  }
  return { valid: true, message: '' };
}

function stripDigits(value) {
  return String(value || '').replace(/\d/g, '');
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
  const steps = CANDIDATE_FORM_STEPS;

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
              <span className={`hidden text-xs font-medium sm:inline sm:text-sm ${current || complete ? 'text-slate-900' : 'text-slate-400'}`}>
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

export default function AddCandidateDrawer({
  isOpen,
  onClose,
  onSuccess,
  currentUser,
  initialTab = 'manual',
  defaultJobId = '',
  lockJobSelection = false,
  showMethodTabs = true,
  /** When set (e.g. from Failed resumes → Re-upload), opens Bulk CV with this single file once. */
  pendingBulkRetryFile = null,
  onBulkRetryFileConsumed,
}) {
  const [activeTab, setActiveTab] = useState(initialTab);
  const [currentStep, setCurrentStep] = useState(1);
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState('');
  const avatarPreviewRef = useRef('');
  const [formData, setFormData] = useState(DEFAULT_FORM_DATA);
  const [errors, setErrors] = useState({});
  const [parsedResumeFile, setParsedResumeFile] = useState(null);
  const [manualResumeFile, setManualResumeFile] = useState(null);
  const [parsedData, setParsedData] = useState(null);
  const [resumeAnalysis, setResumeAnalysis] = useState(null);
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
  const [duplicateDecision, setDuplicateDecision] = useState(null);
  const [inlineSuccess, setInlineSuccess] = useState('');
  const [entryError, setEntryError] = useState('');
  const [csvExpanded, setCsvExpanded] = useState(false);
  const [bulkResumeFiles, setBulkResumeFiles] = useState([]);
  const [bulkResumePhase, setBulkResumePhase] = useState('upload');
  const [bulkResumeProgress, setBulkResumeProgress] = useState({ current: 0, total: 0 });
  const [bulkResumeResults, setBulkResumeResults] = useState([]);
  const [bulkCvSummary, setBulkCvSummary] = useState(null);
  // Stop-parsing flag for the bulk CV uploader. We mirror state + ref so the running
  // import loop can pick up the change immediately while the UI re-renders to show
  // a "Stopping…" state on the Stop button. `bulkResumeAbortRef` holds the
  // AbortController used to also cancel the in-flight HTTP request so the user does
  // not have to wait for the current (potentially 8s) parse-resume call to finish.
  const [bulkResumeStopRequested, setBulkResumeStopRequested] = useState(false);
  const bulkResumeStopRequestedRef = useRef(false);
  const bulkResumeAbortRef = useRef(null);
  const bulkCvSocketRef = useRef(null);
  const bulkCvSessionIdRef = useRef('');
  const bulkCvCurrentFileIndexRef = useRef(-1);
  /** Parallel bulk parse: duplicate modals must queue so each fileIndex gets a user decision. */
  const bulkCvDupQueueRef = useRef([]);
  const bulkCvDupShowingRef = useRef(false);
  const bulkCvDupAwaitingIndicesRef = useRef(new Set());
  const [bulkDuplicateModal, setBulkDuplicateModal] = useState(null);
  const fieldRefs = useRef({});
  const importProgressRef = useRef(null);
  /** Last chosen resume File (manual step or parse); survives edge cases around save. */
  const resumeFileRef = useRef(null);
  const formScrollRef = useRef(null);
  const normalizedDefaultJobId = String(defaultJobId || '').trim();

  // Reset the scroll position whenever the active wizard step changes.
  // Without this, navigating from a tall step (Step 2) to Step 3 leaves the
  // scrollable form container at the previous offset, so the user can't see
  // the start of the new step.
  useEffect(() => {
    const node = formScrollRef.current;
    if (!node || typeof node.scrollTo !== 'function') return;
    node.scrollTo({ top: 0, behavior: 'smooth' });
  }, [currentStep, activeTab]);

  useEffect(() => {
    resumeFileRef.current = manualResumeFile || parsedResumeFile;
  }, [manualResumeFile, parsedResumeFile]);

  const selectedJob = useMemo(() => jobs.find((job) => job.id === formData.jobId) || null, [jobs, formData.jobId]);
  const selectedRecruiter = useMemo(
    () => recruiters.find((recruiter) => recruiter.id === formData.recruiterId) || null,
    [recruiters, formData.recruiterId]
  );

  // Same scope as /job table: only jobs created by the logged-in user (not all OPEN jobs in the tenant).
  useEffect(() => {
    if (!isOpen) {
      setDataLoaded(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    setActiveTab(initialTab || 'manual');
  }, [initialTab, isOpen]);

  useEffect(() => {
    if (!isOpen || !pendingBulkRetryFile) return;
    const file = pendingBulkRetryFile;
    setEntryError('');
    setActiveTab('bulkResume');
    setBulkResumeFiles([file]);
    setBulkResumePhase('preview');
    setBulkResumeResults([]);
    setBulkCvSummary(null);
    setBulkResumeProgress({ current: 0, total: 1 });
    if (typeof onBulkRetryFileConsumed === 'function') {
      onBulkRetryFileConsumed();
    }
  }, [isOpen, pendingBulkRetryFile, onBulkRetryFileConsumed]);

  useEffect(() => {
    if (!isOpen || !normalizedDefaultJobId) return;
    setFormData((prev) => ({ ...prev, jobId: normalizedDefaultJobId }));
  }, [isOpen, normalizedDefaultJobId]);

  useEffect(() => {
    if (!isOpen || dataLoaded) return;

    let ignore = false;
    async function loadOptions() {
      try {
        const [jobsRes, recruitersRes, tagsRes] = await Promise.all([
          apiGetJobs(MY_JOBS_LIST_PARAMS),
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
    if (avatarPreviewRef.current) {
      URL.revokeObjectURL(avatarPreviewRef.current);
      avatarPreviewRef.current = '';
    }
    setAvatarFile(null);
    setAvatarPreview('');
    setFormData({
      ...DEFAULT_FORM_DATA,
      recruiterId: currentUser?._id || '',
      jobId: normalizedDefaultJobId || '',
    });
    setErrors({});
    setParsedResumeFile(null);
    setManualResumeFile(null);
    resumeFileRef.current = null;
    setParsedData(null);
    setResumeAnalysis(null);
    setAutoFilledFields({});
    setDuplicateWarning(null);
    setSaveBanner(null);
    setDuplicateDecision(null);
    setInlineSuccess('');
    setEntryError('');
    setCsvPhase('upload');
    setCsvRows([]);
    setCsvResult(null);
    setCsvFile(null);
    setCsvExpanded(false);
    setCsvImportProgress({ current: 0, total: 0 });
    setBulkResumeFiles([]);
    setBulkResumePhase('upload');
    setBulkResumeProgress({ current: 0, total: 0 });
    setBulkResumeResults([]);
    setBulkResumeStopRequested(false);
    bulkResumeStopRequestedRef.current = false;
    // Abort any leftover in-flight import (defensive: resetForNext is also called
    // on tab change / close, and we don't want a stale controller to silently keep
    // running on the network).
    try {
      bulkResumeAbortRef.current?.abort();
    } catch (_abortError) {
      // ignore
    }
    bulkResumeAbortRef.current = null;
    try {
      bulkCvSocketRef.current?.disconnect();
    } catch (_e) {
      /* ignore */
    }
    bulkCvSocketRef.current = null;
    bulkCvSessionIdRef.current = '';
    bulkCvCurrentFileIndexRef.current = -1;
    bulkCvDupQueueRef.current = [];
    bulkCvDupShowingRef.current = false;
    bulkCvDupAwaitingIndicesRef.current.clear();
    setBulkDuplicateModal(null);
    if (nextTab) setActiveTab(nextTab);
  };

  // Bulk CV parsing must not be killed mid-loop by a stray backdrop click — abandoning the
  // loop would leave partially-created candidates without showing the user what finished
  // and what didn't. While `bulkResumePhase === 'importing'` the drawer ignores backdrop /
  // X / Cancel clicks; users have to use the explicit "Stop parsing" button instead.
  const isBulkResumeBusy = activeTab === 'bulkResume' && bulkResumePhase === 'importing';

  const handleDrawerClose = () => {
    if (isBulkResumeBusy) return;
    resetForNext(activeTab);
    onClose();
  };

  const handleStopBulkResume = () => {
    if (!isBulkResumeBusy || bulkResumeStopRequestedRef.current) return;
    bulkResumeStopRequestedRef.current = true;
    setBulkResumeStopRequested(true);
    const sid = bulkCvSessionIdRef.current;
    const socket = bulkCvSocketRef.current;
    if (sid && socket) {
      const indices = new Set(bulkCvDupAwaitingIndicesRef.current);
      const modalIdx = bulkDuplicateModal?.fileIndex;
      if (modalIdx !== undefined && modalIdx !== null) indices.add(modalIdx);
      bulkCvDupQueueRef.current.forEach((p) => {
        if (p?.fileIndex !== undefined && p?.fileIndex !== null) indices.add(p.fileIndex);
      });
      for (const fileIndex of indices) {
        try {
          socket.emit('duplicate_decision', {
            sessionId: sid,
            fileIndex,
            decision: 'cancel',
          });
        } catch (_e) {
          /* ignore */
        }
      }
    }
    bulkCvDupAwaitingIndicesRef.current.clear();
    bulkCvDupQueueRef.current = [];
    bulkCvDupShowingRef.current = false;
    setBulkDuplicateModal(null);
    // Abort the in-flight HTTP request so the current parse/create call is killed
    // immediately instead of waiting for it to resolve.
    try {
      bulkResumeAbortRef.current?.abort();
    } catch (_abortError) {
      // ignore – the controller may already be aborted or garbage-collected
    }
  };

  const handleTabChange = (nextTab) => {
    if (nextTab === activeTab) return;
    resetForNext(nextTab);
  };

  const handleDownloadCsvTemplate = async () => {
    try {
      const apiBase = process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, '') || 'http://localhost:5001/api/v1';
      const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
      const response = await fetch(`${apiBase}/candidates/bulk-import/template`, {
        method: 'GET',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });

      if (!response.ok) {
        throw new Error(`Failed to download template (${response.status})`);
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'candidate_import_template.csv';
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast.error(error?.message || 'Failed to download CSV template');
    }
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

  const validateForm = () => {
    const nextErrors = {};
    const firstNameCheck = validateNoDigits(formData.firstName, 'First name');
    if (!firstNameCheck.valid) nextErrors.firstName = firstNameCheck.message;

    const lastNameCheck = validateNoDigits(formData.lastName, 'Last name');
    if (!lastNameCheck.valid) nextErrors.lastName = lastNameCheck.message;

    if (!formData.email.trim()) {
      nextErrors.email = 'Email is required';
    } else {
      const result = validateEmail(formData.email.trim());
      if (!result.valid) {
        nextErrors.email = result.message;
      }
    }

    const companyCheck = validateNoDigits(formData.currentCompany, 'Current company');
    if (formData.currentCompany.trim() && !companyCheck.valid) {
      nextErrors.currentCompany = companyCheck.message;
    }
    if (formData.phone && !/^\d{7,15}$/.test(formData.phone.trim())) {
      nextErrors.phone = 'Phone must be 7-15 digits';
    }
    const experience = Number(formData.experience);
    if (formData.experience !== '' && !Number.isNaN(experience) && (experience < 0 || experience > 50)) {
      nextErrors.experience = 'Experience must be between 0 and 50';
    }
    if (formData.linkedinUrl && !LINKEDIN_REGEX.test(formData.linkedinUrl.trim())) {
      nextErrors.linkedinUrl = 'Enter a valid LinkedIn URL';
    }
    if (!formData.source) {
      nextErrors.source = 'Source is required';
    }
    if (formData.expectedSalary && Number(formData.expectedSalary) <= 0) {
      nextErrors.expectedSalary = 'Salary must be a positive number';
    }
    if (formData.website && !/^https?:\/\//i.test(formData.website.trim())) {
      nextErrors.website = 'Website URL must start with http:// or https://';
    }
    if (formData.skills.length > 10) {
      nextErrors.skills = 'Maximum 10 skills allowed';
    }

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      const firstKey = Object.keys(nextErrors)[0];
      scrollToField(firstKey);
      return false;
    }
    return true;
  };

  const validateStep = (step) => {
    if (step === 5) {
      return validateForm();
    }

    const nextErrors = {};

    if (step === 1) {
      const firstNameCheck = validateNoDigits(formData.firstName, 'First name');
      if (!firstNameCheck.valid) nextErrors.firstName = firstNameCheck.message;

      const lastNameCheck = validateNoDigits(formData.lastName, 'Last name');
      if (!lastNameCheck.valid) nextErrors.lastName = lastNameCheck.message;

      if (!formData.email.trim()) {
        nextErrors.email = 'Email is required';
      } else {
        const result = validateEmail(formData.email.trim());
        if (!result.valid) {
          nextErrors.email = result.message;
        }
      }
      if (formData.phone && !/^\d{7,15}$/.test(formData.phone.trim())) {
        nextErrors.phone = 'Phone must be 7-15 digits';
      }
    }

    if (step === 3) {
      const companyCheck = validateNoDigits(formData.currentCompany, 'Current company');
      if (formData.currentCompany.trim() && !companyCheck.valid) {
        nextErrors.currentCompany = companyCheck.message;
      }
      const experience = Number(formData.experience);
      if (formData.experience !== '' && !Number.isNaN(experience) && (experience < 0 || experience > 50)) {
        nextErrors.experience = 'Experience must be between 0 and 50';
      }
      if (!formData.source) {
        nextErrors.source = 'Source is required';
      }
      if (formData.expectedSalary && Number(formData.expectedSalary) <= 0) {
        nextErrors.expectedSalary = 'Salary must be a positive number';
      }
    }

    if (step === 4) {
      if (formData.linkedinUrl && !LINKEDIN_REGEX.test(formData.linkedinUrl.trim())) {
        nextErrors.linkedinUrl = 'Enter a valid LinkedIn URL';
      }
      if (formData.website && !/^https?:\/\//i.test(formData.website.trim())) {
        nextErrors.website = 'Website URL must start with http:// or https://';
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

  const handleAvatarFile = (file) => {
    if (!file) return;
    if (file.size > MAX_AVATAR_FILE_BYTES) {
      toast.error('Photo must be 5MB or smaller.');
      return;
    }
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file.');
      return;
    }
    if (avatarPreviewRef.current) {
      URL.revokeObjectURL(avatarPreviewRef.current);
    }
    const preview = URL.createObjectURL(file);
    avatarPreviewRef.current = preview;
    setAvatarPreview(preview);
    setAvatarFile(file);
  };

  const clearAvatarFile = () => {
    if (avatarPreviewRef.current) {
      URL.revokeObjectURL(avatarPreviewRef.current);
      avatarPreviewRef.current = '';
    }
    setAvatarPreview('');
    setAvatarFile(null);
    updateFormData('avatar', '');
  };

  const uploadCandidateAvatar = async (candidateId, file) => {
    const body = new FormData();
    body.append('file', file);
    body.append('entityType', 'candidate');
    body.append('entityId', candidateId);
    body.append('fileType', 'Photo');
    const response = await apiFetchFormData('/files', body, { method: 'POST', auth: true });
    return response?.data?.fileUrl || response?.fileUrl || null;
  };

  const handleDuplicateCheck = async (field) => {
    const value = field === 'email' ? formData.email.trim() : formData.phone.trim();
    if (!value) return;
    if (field === 'email' && !validateEmail(value).valid) return;
    if (field === 'phone' && !/^\d{7,15}$/.test(value)) return;

    try {
      const response = await apiCheckCandidateDuplicate(
        field === 'email' ? { email: value } : { phone: value }
      );
      const payload = response.data;
      if (payload?.isDuplicate) {
        setDuplicateWarning({ field, ...payload });
        setDuplicateDecision({
          field,
          source: 'field',
          mode: 'save',
          candidate: payload.candidate || null,
          message:
            field === 'email'
              ? 'A duplicate candidate was found for this email.'
              : 'A duplicate candidate was found for this phone number.',
          canUpdate: field === 'email',
          canCreateAnyway: field !== 'email',
        });
      } else if (duplicateWarning?.field === field) {
        setDuplicateWarning(null);
      }
    } catch (error) {
      console.error('Duplicate check failed:', error);
    }
  };

  const applyImportedData = (data, sourceType, file = null) => {
    const derivedLocation =
      data.location ||
      [data.city, data.country]
        .map((value) => String(value || '').trim())
        .filter(Boolean)
        .join(', ');
    const importedSummary = String(data.summary || '').trim();

    const nextData = {
      firstName: data.firstName || '',
      lastName: data.lastName || '',
      email: data.email || '',
      phone: String(data.phone || '').replace(/[^\d]/g, ''),
      currentCompany: data.currentCompany || '',
      currentDesignation: data.currentDesignation || data.designation || '',
      experience: data.experience ?? '',
      cityState: derivedLocation,
      location: derivedLocation,
      address: data.address || '',
      linkedinUrl: data.linkedinUrl || '',
      website: data.website || data.portfolioUrl || '',
      portfolioUrl: data.portfolioUrl || '',
      educationEntries: Array.isArray(data.educationEntries) && data.educationEntries.length
        ? data.educationEntries.map((entry) => ({
            qualification: entry.degree || '',
            instituteName: entry.institution || '',
          }))
        : data.education
          ? [{ qualification: data.education, instituteName: '' }]
          : [{ qualification: '', instituteName: '' }],
      summary: importedSummary,
      workHistory: Array.isArray(data.workExperienceEntries)
        ? data.workExperienceEntries
            .map((entry) =>
              [entry.title, entry.company, entry.startDate, entry.endDate].filter(Boolean).join(' · ')
            )
            .join('\n')
        : '',
      educationHistory: Array.isArray(data.educationEntries)
        ? data.educationEntries
            .map((entry) => [entry.degree, entry.institution].filter(Boolean).join(' · '))
            .join('\n')
        : '',
      certificates: Array.isArray(data.certifications) ? data.certifications.slice(0, 15) : [],
      languageEntries: Array.isArray(data.languages)
        ? data.languages.slice(0, 10).map((lang) => {
            const text = String(lang);
            const match = text.match(/^(.+?)\s*\((.+)\)$/);
            return match
              ? { language: match[1].trim(), proficiency: match[2].trim() }
              : { language: text, proficiency: 'Conversational' };
          })
        : [],
      source: data.source || 'Other',
      priority: data.priority || 'Medium',
      expectedSalary: data.expectedSalary || '',
      currency: data.currency || 'INR',
      noticePeriod: data.noticePeriod || 'Immediate',
      skills: Array.isArray(data.skills) ? data.skills.slice(0, 10) : [],
      tags: Array.isArray(data.tags) ? data.tags.slice(0, 10) : [],
      initialNote: importedSummary,
      avatar:
        typeof data.profilePhotoUrl === 'string' && data.profilePhotoUrl.trim()
          ? data.profilePhotoUrl.trim()
          : typeof data.avatar === 'string' && data.avatar.trim()
            ? data.avatar.trim()
            : '',
    };

    setFormData((prev) => ({
      ...prev,
      ...nextData,
      source: prev.source || nextData.source,
      initialNote: prev.initialNote || nextData.initialNote,
    }));
    setParsedData(data);
    setResumeAnalysis(data.score || null);
    setAutoFilledFields(normalizeAutoFilledFields(nextData));
    if (file) {
      resumeFileRef.current = file;
      setParsedResumeFile(file);
    }
  };

  const handleResumeFile = async (file) => {
    if (!file) return;
    if (file.size > MAX_RESUME_FILE_BYTES) {
      setEntryError(`Resume must be ${MAX_RESUME_FILE_LABEL} or smaller.`);
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
      notifyCandidatesChanged();
      onSuccess?.(null);
    } catch (error) {
      clearInterval(importProgressRef.current);
      setCsvPhase('preview');
      setEntryError(error.message || 'Bulk import failed');
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Bulk CV identity fallback
  //
  // Many CVs omit an email. We do not invent placeholder emails — the API stores
  // `null` when none is parsed. Names may still be derived from the file name when
  // the parser returns blanks so create validation (first/last name) can succeed.
  // ─────────────────────────────────────────────────────────────────────────
  const deriveBulkResumeIdentity = (parsed, file) => {
    const trimmedEmail = String(parsed?.email || '').trim();
    const identity = {
      firstName: String(parsed?.firstName || '').trim(),
      lastName: String(parsed?.lastName || '').trim(),
      email: trimmedEmail || null,
      syntheticName: false,
    };

    if (!identity.firstName || !identity.lastName) {
      const base = String(file?.name || '')
        .replace(/\.[^.]+$/, '')
        .replace(/^[0-9_,\-\s]+/, '')
        .replace(/(^|\s)(cv|resume)\b/gi, ' ')
        .replace(/[_,\-]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      const tokens = base.split(' ').filter(Boolean);
      if (!identity.firstName) identity.firstName = tokens.shift() || 'Unknown';
      if (!identity.lastName) identity.lastName = tokens.join(' ') || 'Candidate';
      identity.syntheticName = true;
    }

    return identity;
  };

  const buildBulkResumePayload = (parsedCandidate) => {
    const preferredLocation =
      parsedCandidate.location ||
      [parsedCandidate.city, parsedCandidate.country].filter(Boolean).join(', ') ||
      undefined;

    const rawEmail = parsedCandidate.email;
    const trimmedEmail =
      rawEmail === undefined || rawEmail === null ? '' : String(rawEmail).trim();

    return {
      firstName: parsedCandidate.firstName || '',
      lastName: parsedCandidate.lastName || '',
      email: trimmedEmail === '' ? null : trimmedEmail,
      phone: parsedCandidate.phone ? String(parsedCandidate.phone).trim() : undefined,
      currentCompany: parsedCandidate.currentCompany || undefined,
      currentDesignation: parsedCandidate.currentDesignation || parsedCandidate.designation || undefined,
      designation: parsedCandidate.currentDesignation || parsedCandidate.designation || undefined,
      experience:
        parsedCandidate.experience === '' || parsedCandidate.experience == null
          ? 0
          : Number(parsedCandidate.experience) || 0,
      location: preferredLocation || undefined,
      linkedinUrl: parsedCandidate.linkedinUrl || undefined,
      website: parsedCandidate.githubUrl || undefined,
      // Bulk CV: pool-only — no job, owner, or pipeline stage until assigned later.
      source: 'Bulk CV Upload',
      priority: parsedCandidate.priority || 'Medium',
      tags: ['New'],
      expectedSalary:
        parsedCandidate.expectedSalary == null || parsedCandidate.expectedSalary === ''
          ? undefined
          : Number(parsedCandidate.expectedSalary),
      currentSalary:
        parsedCandidate.currentSalary == null || parsedCandidate.currentSalary === ''
          ? undefined
          : Number(parsedCandidate.currentSalary),
      currency: parsedCandidate.currency || undefined,
      portfolioUrl: parsedCandidate.portfolioUrl || undefined,
      education: parsedCandidate.education || undefined,
      certifications: Array.isArray(parsedCandidate.certifications) ? parsedCandidate.certifications : undefined,
      languages: Array.isArray(parsedCandidate.languages) ? parsedCandidate.languages : undefined,
      notes: parsedCandidate.summary || undefined,
      cvSummary: parsedCandidate.summary || undefined,
      cvEducationEntries: Array.isArray(parsedCandidate.educationEntries) ? parsedCandidate.educationEntries : undefined,
      cvWorkExperienceEntries: Array.isArray(parsedCandidate.workExperienceEntries)
        ? parsedCandidate.workExperienceEntries
        : undefined,
      cvPortfolioLinks: (() => {
        const raw = Array.isArray(parsedCandidate.portfolioLinks) ? [...parsedCandidate.portfolioLinks] : [];
        if (parsedCandidate.githubUrl && !raw.some((l) => String(l?.url || '').includes('github.com'))) {
          raw.push({ type: 'GitHub', url: parsedCandidate.githubUrl });
        }
        return raw.length ? raw : undefined;
      })(),
      extraData:
        parsedCandidate.extraData && typeof parsedCandidate.extraData === 'object' && !Array.isArray(parsedCandidate.extraData)
          ? parsedCandidate.extraData
          : undefined,
      city: parsedCandidate.city || undefined,
      country: parsedCandidate.country || undefined,
      preferredLocation,
      noticePeriod: parsedCandidate.noticePeriod || undefined,
      skills: Array.isArray(parsedCandidate.skills) ? parsedCandidate.skills.slice(0, 10) : undefined,
      resume: parsedCandidate.resumeUrl || undefined,
      avatar: (() => {
        const u = String(parsedCandidate.profilePhotoUrl || parsedCandidate.avatar || '').trim();
        return /^https?:\/\//i.test(u) ? u : undefined;
      })(),
      duplicateAction: 'create',
    };
  };

  const handleBulkResumeSelected = (fileList) => {
    const files = Array.from(fileList || []).filter(Boolean);
    if (!files.length) return;
    const tooLarge = files.filter((f) => f.size > MAX_RESUME_FILE_BYTES);
    if (tooLarge.length) {
      setEntryError(
        `${tooLarge.length} file(s) exceed ${MAX_RESUME_FILE_LABEL} each: ${tooLarge.map((f) => f.name).join(', ')}`
      );
      return;
    }
    setEntryError('');
    setBulkResumeFiles(files);
    setBulkResumePhase('preview');
    setBulkResumeResults([]);
    setBulkCvSummary(null);
    setBulkResumeProgress({ current: 0, total: files.length });
  };

  const handleBulkResumeImport = async () => {
    if (!bulkResumeFiles.length) return;

    bulkResumeStopRequestedRef.current = false;
    setBulkResumeStopRequested(false);
    bulkResumeAbortRef.current = new AbortController();
    const abortSignal = bulkResumeAbortRef.current.signal;

    setBulkResumePhase('importing');
    setBulkResumeProgress({ current: 0, total: bulkResumeFiles.length });
    setBulkCvSummary(null);
    const initialBulkRows = bulkResumeFiles.map((f) => ({
      fileName: f.name,
      status: 'processing',
      message: 'Queued…',
    }));
    setBulkResumeResults(initialBulkRows);

    const batchStart = Date.now();
    let createdCount = 0;
    let stoppedEarly = false;
    const backgroundUploads = [];

    const isAbortError = (err) =>
      !!err && (err.name === 'AbortError' || /aborted|abort/i.test(String(err?.message || '')));

    const bumpProgress = () => {
      setBulkResumeProgress((prev) => ({
        current: Math.min(prev.total, prev.current + 1),
        total: prev.total,
      }));
    };

    const rawConc = Number(
      typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_BULK_CV_CONCURRENCY : NaN
    );
    const BULK_CV_CONCURRENCY = Math.min(
      6,
      Math.max(1, Number.isFinite(rawConc) && rawConc > 0 ? Math.floor(rawConc) : 3)
    );

    const sessionId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 11)}`;
    bulkCvSessionIdRef.current = sessionId;

    let socket = null;
    try {
      const { io } = await import('socket.io-client');
      const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
      const tenantDbName =
        typeof window !== 'undefined' ? String(localStorage.getItem('tenantDbName') || '').trim() : '';
      if (!token) {
        throw new Error('Not logged in — cannot run bulk CV with duplicate detection.');
      }
      socket = io(buildSocketBaseUrl(), {
        auth: { token, ...(tenantDbName ? { tenantDbName } : {}) },
        transports: ['websocket', 'polling'],
      });
      bulkCvSocketRef.current = socket;

      await new Promise((resolve, reject) => {
        const t = window.setTimeout(() => reject(new Error('Socket connection timeout')), 15000);
        socket.once('connect', () => {
          window.clearTimeout(t);
          resolve();
        });
        socket.once('connect_error', (err) => {
          window.clearTimeout(t);
          reject(err);
        });
      });

      socket.emit('bulk_cv_join', { sessionId });
      socket.on('duplicate_found', (payload) => {
        if (payload?.fileIndex !== undefined && payload?.fileIndex !== null) {
          bulkCvDupAwaitingIndicesRef.current.add(payload.fileIndex);
        }
        if (!bulkCvDupShowingRef.current) {
          bulkCvDupShowingRef.current = true;
          setBulkDuplicateModal(payload);
        } else {
          bulkCvDupQueueRef.current.push(payload);
        }
      });
    } catch (socketErr) {
      console.error('[bulk-cv] Socket init failed', socketErr);
      setBulkResumePhase('preview');
      setEntryError(
        socketErr?.message ||
          'Could not connect for duplicate detection. Check that the API server is running and Socket.IO is enabled.'
      );
      try {
        socket?.disconnect();
      } catch (_e) {
        /* ignore */
      }
      bulkCvSocketRef.current = null;
      bulkCvSessionIdRef.current = '';
      return;
    }

    const fileCount = bulkResumeFiles.length;
    const outcomes = new Array(fileCount).fill(null);
    let nextFileIndex = 0;

    const markFinalRow = (index, row) => {
      outcomes[index] = row;
      setBulkResumeResults((prev) => {
        const next = [...prev];
        next[index] = row;
        return next;
      });
      bumpProgress();
    };

    const processIndex = async (index) => {
      const file = bulkResumeFiles[index];

      if (bulkResumeStopRequestedRef.current) {
        stoppedEarly = true;
        markFinalRow(index, {
          fileName: file.name,
          status: 'failed',
          message: 'Stopped by user',
        });
        return;
      }

      setBulkResumeResults((prev) => {
        const next = [...prev];
        next[index] = { ...next[index], status: 'processing', message: 'Parsing CV…' };
        return next;
      });

      try {
        const parsedResponse = await apiBulkCvProcessFile(file, sessionId, index, { signal: abortSignal });
        const envelope = parsedResponse.data || {};

        if (envelope?.skipped) {
          markFinalRow(index, {
            fileName: file.name,
            status: 'skipped',
            message: 'Skipped — duplicate (you chose not to import this CV)',
          });
          return;
        }

        const parsedCandidate = envelope.normalized || {};
        const duplicateResolution = envelope.duplicateResolution || null;
        const identity = deriveBulkResumeIdentity(parsedCandidate, file);
        const enrichedCandidate = {
          ...parsedCandidate,
          firstName: identity.firstName,
          lastName: identity.lastName,
          email: identity.email,
        };

        const createResponse = await apiCreateCandidateFromDrawer(
          buildBulkResumePayload(enrichedCandidate),
          { signal: abortSignal }
        );
        const candidate = createResponse.data;
        const savedFirst = String(candidate?.firstName || enrichedCandidate.firstName || '').trim();
        const savedLast = String(candidate?.lastName || enrichedCandidate.lastName || '').trim();

        const bulkCandidateId = candidate.id || candidate._id;
        if (file && bulkCandidateId && !isPersistableRemoteResumeUrl(parsedCandidate?.resumeUrl)) {
          backgroundUploads.push(
            apiUploadCandidateResumeFile(bulkCandidateId, file, { signal: abortSignal }).catch((uploadError) => {
              if (!isAbortError(uploadError)) {
                console.error('Resume upload failed after candidate creation:', uploadError);
              }
            })
          );
        }

        const placeholderParts = [];
        if (identity.syntheticName) placeholderParts.push('name');
        let successMessage = placeholderParts.length
          ? `Created — placeholder ${placeholderParts.join(' & ')} added (please update)`
          : 'Candidate created successfully';
        if (duplicateResolution === 'replaced') {
          successMessage = 'Replaced — existing candidate removed; new profile saved';
        } else if (duplicateResolution === 'create_anyway') {
          successMessage = 'Saved as copy — duplicate resolved with a new last name / email variant';
        }

        createdCount += 1;
        removeFailedBulkResumesByFileName(file.name);
        markFinalRow(index, {
          fileName: file.name,
          status: 'created',
          duplicateResolution,
          candidateName:
            `${savedFirst} ${savedLast}`.trim() ||
            candidate.email ||
            enrichedCandidate.email ||
            'Candidate',
          message: successMessage,
        });
      } catch (error) {
        if (isAbortError(error) || bulkResumeStopRequestedRef.current) {
          stoppedEarly = true;
          markFinalRow(index, {
            fileName: file.name,
            status: 'failed',
            message: 'Stopped by user',
          });
        } else {
          markFinalRow(index, {
            fileName: file.name,
            status: 'failed',
            message: error.message || 'Failed to create candidate',
          });
        }
      }
    };

    async function poolWorker() {
      while (true) {
        const index = nextFileIndex++;
        if (index >= fileCount) return;
        await processIndex(index);
      }
    }

    try {
      const poolSize = Math.min(BULK_CV_CONCURRENCY, fileCount);
      await Promise.all(Array.from({ length: poolSize }, () => poolWorker()));

      for (let i = 0; i < fileCount; i += 1) {
        if (outcomes[i] != null) continue;
        const f = bulkResumeFiles[i];
        stoppedEarly = stoppedEarly || bulkResumeStopRequestedRef.current;
        markFinalRow(i, {
          fileName: f.name,
          status: 'failed',
          message: bulkResumeStopRequestedRef.current ? 'Stopped by user' : 'Not processed',
        });
      }
    } finally {
      bulkCvDupQueueRef.current = [];
      bulkCvDupAwaitingIndicesRef.current.clear();
      bulkCvDupShowingRef.current = false;
      setBulkDuplicateModal(null);
      bulkCvCurrentFileIndexRef.current = -1;
      try {
        socket?.disconnect();
      } catch (_e) {
        /* ignore */
      }
      bulkCvSocketRef.current = null;
      bulkCvSessionIdRef.current = '';
    }

    const slotResults = bulkResumeFiles.map((f, i) =>
      outcomes[i] != null
        ? outcomes[i]
        : { fileName: f.name, status: 'failed', message: 'Not processed' }
    );
    const elapsed = Date.now() - batchStart;
    const succeeded = slotResults.filter((item) => item.status === 'created').length;
    const failed = slotResults.filter((item) => item.status === 'failed').length;
    const skipped = slotResults.filter((item) => item.status === 'skipped').length;
    const failures = slotResults
      .filter((item) => item.status === 'failed')
      .map((item) => ({ fileName: item.fileName, reason: item.message }));

    setBulkCvSummary({
      totalReceived: bulkResumeFiles.length,
      succeeded,
      failed,
      skipped,
      failures,
      durationMs: elapsed,
    });
    if (failures.length) {
      addFailedBulkResumeRecords(failures);
    }
    console.log(
      `[bulk-cv] done in ${elapsed}ms | files=${bulkResumeFiles.length} ok=${succeeded} skip=${skipped} fail=${failed}`
    );

    setBulkResumePhase('complete');
    setBulkResumeStopRequested(false);
    bulkResumeStopRequestedRef.current = false;
    bulkResumeAbortRef.current = null;

    if (createdCount > 0) {
      const suffix = stoppedEarly ? ' (stopped early)' : '';
      toast.success(
        `${createdCount} candidate${createdCount === 1 ? '' : 's'} created from CV upload${suffix}`
      );
      notifyCandidatesChanged();
      onSuccess?.(null);
    } else if (stoppedEarly) {
      toast.info('Bulk CV parsing stopped');
    }
    void Promise.allSettled(backgroundUploads).then(() => {
      notifyCandidatesChanged();
    });
  };

  const buildCandidatePayload = (duplicateAction = 'create') => {
    const cityStateParts = String(formData.cityState || '')
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean);
    const languageLabels = (formData.languageEntries || [])
      .filter((row) => row.language?.trim())
      .map((row) => `${row.language.trim()} (${row.proficiency || 'Conversational'})`);
    const filledEducation = (formData.educationEntries || []).filter(
      (row) => row.qualification?.trim() || row.instituteName?.trim()
    );
    const educationSummary = filledEducation
      .map((row) => [row.qualification, row.instituteName].filter(Boolean).join(' · '))
      .join('; ');
    const noticePeriod =
      formData.noticePeriodDays?.trim() !== ''
        ? `${formData.noticePeriodDays} days`
        : formData.noticePeriod;

    return {
      firstName: formData.firstName,
      lastName: formData.lastName,
      email: formData.email,
      phone: formData.phone || undefined,
      currentCompany: formData.currentCompany || undefined,
      designation: formData.currentDesignation,
      currentDesignation: formData.currentDesignation,
      experience: formData.experience === '' ? 0 : Number(formData.experience),
      location: formData.cityState || formData.location || undefined,
      linkedinUrl: formData.linkedinUrl || undefined,
      jobId: formData.jobId || undefined,
      stage: formData.stage,
      recruiterId: formData.recruiterId || undefined,
      source: formData.source || 'Other',
      sourceUrl: formData.sourceUrl || undefined,
      referrerName: formData.referrerName || undefined,
      agencyName: formData.agencyName || undefined,
      priority: formData.priority,
      tags: formData.tags,
      expectedSalary: formData.expectedSalary ? Number(formData.expectedSalary) : undefined,
      currency: formData.currency,
      noticePeriod,
      availabilityStatus: formData.availabilityStatus,
      portfolioUrl: formData.portfolioUrl || formData.website || undefined,
      website: formData.website || undefined,
      skills: formData.skills,
      currentSalary: formData.currentSalary
        ? Number(formData.currentSalary)
        : parsedData?.currentSalary
          ? Number(parsedData.currentSalary)
          : undefined,
      education: educationSummary || formData.educationHistory || parsedData?.education || undefined,
      cvEducationEntries:
        filledEducation.length > 0
          ? filledEducation.map((row) => ({
              degree: row.qualification || undefined,
              institution: row.instituteName || undefined,
            }))
          : Array.isArray(parsedData?.educationEntries)
            ? parsedData.educationEntries
            : undefined,
      certifications:
        formData.certificates?.length > 0
          ? formData.certificates
          : Array.isArray(parsedData?.certifications)
            ? parsedData.certifications
            : undefined,
      languages:
        languageLabels.length > 0
          ? languageLabels
          : Array.isArray(parsedData?.languages)
            ? parsedData.languages
            : undefined,
      notes:
        [formData.remarks, formData.initialNote, parsedData?.summary]
          .filter(Boolean)
          .join('\n\n') || undefined,
      cvSummary: formData.summary || parsedData?.summary || undefined,
      cvWorkExperienceEntries: Array.isArray(parsedData?.workExperienceEntries)
        ? parsedData.workExperienceEntries
        : undefined,
      cvPortfolioLinks: Array.isArray(parsedData?.portfolioLinks) ? parsedData.portfolioLinks : undefined,
      city: cityStateParts[0] || parsedData?.city || undefined,
      country: cityStateParts.slice(1).join(', ') || parsedData?.country || undefined,
      address: formData.address || undefined,
      preferredLocation: formData.cityState || parsedData?.location || formData.location || undefined,
      resume: parsedData?.resumeUrl || undefined,
      avatar: [formData.avatar, parsedData?.profilePhotoUrl, parsedData?.avatar]
        .map((x) => String(x || '').trim())
        .find((x) => /^https?:\/\//i.test(x)),
      extraData: {
        age: formData.age || undefined,
        candidateScore: formData.candidateScore || undefined,
        zip: formData.zip || undefined,
        nationality: formData.nationality || undefined,
        currentCompanyWebsite: formData.currentCompanyWebsite || undefined,
        maritalStatus: formData.maritalStatus || undefined,
        birthDate: formData.birthDate || undefined,
        passportNumber: formData.passportNumber || undefined,
        instituteName: formData.instituteName || undefined,
        currentBenefits: formData.currentBenefits || undefined,
        currentSalaryCurrency: formData.currentSalaryCurrency || undefined,
        expectedBenefits: formData.expectedBenefits || undefined,
        noticePeriodDays: formData.noticePeriodDays || undefined,
        courses: formData.courses || undefined,
        extracurricularActivities: formData.extracurricularActivities || undefined,
        volunteers: formData.volunteers || undefined,
        twitter: formData.twitter || undefined,
        xing: formData.xing || undefined,
        skypeId: formData.skypeId || undefined,
        facebook: formData.facebook || undefined,
        stackOverflow: formData.stackOverflow || undefined,
        workHistoryText: formData.workHistory || undefined,
        educationHistoryText: formData.educationHistory || undefined,
        honoursAwards: formData.honoursAwards || undefined,
        languageEntries: formData.languageEntries?.length ? formData.languageEntries : undefined,
        referralCampaign: formData.referralCampaign === 'Yes',
      },
      duplicateAction,
    };
  };

  const openDuplicateDecision = ({
    field = 'email',
    mode = 'save',
    source = 'save',
    candidate = null,
    message,
    canUpdate,
    canCreateAnyway,
  }) => {
    setDuplicateDecision({
      field,
      mode,
      source,
      candidate,
      message:
        message ||
        (field === 'email'
          ? 'A duplicate candidate was found for this email.'
          : 'A duplicate candidate was found for this phone number.'),
      canUpdate: canUpdate ?? field === 'email',
      canCreateAnyway: canCreateAnyway ?? field !== 'email',
    });
  };

  const closeDuplicateDecision = () => {
    setDuplicateDecision(null);
  };

  const handleSave = async (mode, duplicateAction = 'create') => {
    if (!validateForm()) return;
    if (duplicateAction === 'create' && duplicateWarning) {
      openDuplicateDecision({
        field: duplicateWarning.field,
        source: 'save',
        mode,
        candidate: duplicateWarning.candidate || null,
        canUpdate: duplicateWarning.field === 'email',
        canCreateAnyway: duplicateWarning.field !== 'email',
      });
      return;
    }

    setIsSaving(true);
    setSaveBanner(null);
    try {
      const payload = buildCandidatePayload(duplicateAction);

      const response = await apiCreateCandidateFromDrawer(payload);
      let candidate = response?.data || {};
      // Prisma + Mongo always projects `id`, but tolerate `_id` from any future
      // serializer change so the resume upload doesn't silently fail and the
      // user doesn't see "Candidate not found" after a successful create.
      const candidateId = candidate.id || candidate._id || null;
      // Prefer manual attachment (step 3) over parsed file; ref mirrors state
      // so the File is still available at save time.
      const uploadFile = resumeFileRef.current || manualResumeFile || parsedResumeFile;
      const parsedResumeRemote = isPersistableRemoteResumeUrl(parsedData?.resumeUrl);
      // Upload when we have a file and either (a) user picked a manual file, or
      // (b) parse did not yield a storable remote URL (Cloudinary failed, temp path, etc.).
      // Skip only when parse already produced https/http and the file came from that parse.
      const shouldUploadResume =
        Boolean(candidateId && uploadFile) &&
        (Boolean(manualResumeFile) || !parsedResumeRemote);

      // Await the resume upload BEFORE we close the drawer / refresh the
      // parent list so the candidate row reflects the resume in the same
      // refresh cycle (otherwise the parent fetched the row before `resume`
      // was set on the backend and the file appeared "missing").
      let resumeUploadFailed = false;
      if (shouldUploadResume) {
        if (!candidateId) {
          resumeUploadFailed = true;
          console.error('Cannot upload resume: created candidate is missing an id', candidate);
          toast.error('Candidate saved, but resume upload could not start (missing candidate id).');
        } else {
          try {
            const uploadResponse = await apiUploadCandidateResumeFile(candidateId, uploadFile);
            const updated = uploadResponse?.data;
            if (updated && typeof updated === 'object') {
              candidate = { ...candidate, ...updated };
            }
          } catch (uploadError) {
            resumeUploadFailed = true;
            console.error('Resume upload failed after candidate creation:', uploadError);
            toast.error(uploadError?.message || 'Candidate saved, but resume upload failed');
          }
        }
      }

      if (candidateId && avatarFile) {
        try {
          const photoUrl = await uploadCandidateAvatar(candidateId, avatarFile);
          if (photoUrl) {
            const updated = await apiUpdateCandidate(candidateId, { avatar: photoUrl });
            if (updated?.data) {
              candidate = { ...candidate, ...updated.data };
            }
          }
        } catch (photoError) {
          console.error('Candidate photo upload failed:', photoError);
          toast.error(photoError?.message || 'Candidate saved, but photo upload failed');
        }
      }

      toast.success(
        duplicateAction === 'updateExisting'
          ? `${formData.firstName} ${formData.lastName} updated successfully`
          : `${formData.firstName} ${formData.lastName} added successfully`
      );

      if (mode === 'saveAndAddAnother') {
        resetForNext(activeTab);
        setInlineSuccess(
          resumeUploadFailed
            ? 'Candidate saved (resume upload failed). Fill in the next one.'
            : 'Candidate saved! Fill in the next one.'
        );
      } else {
        onSuccess?.(candidate);
        notifyCandidatesChanged();
        resetForNext(activeTab);
        onClose();
      }
    } catch (error) {
      if (String(error.message || '').toLowerCase().includes('already exists')) {
        const duplicateData = error?.data || error?.raw?.data || {};
        openDuplicateDecision({
          field: 'email',
          source: 'save',
          mode,
          candidate: duplicateData.existingCandidate || null,
          message: 'A candidate with this email already exists.',
          canUpdate: duplicateData.canUpdate !== false,
          canCreateAnyway: duplicateData.canCreateAnyway === true,
        });
        setSaveBanner({
          type: 'duplicate',
          message: 'A candidate with this email already exists.',
          existingCandidate: duplicateData.existingCandidate || null,
          canUpdate: duplicateData.canUpdate !== false,
          canCreateAnyway: duplicateData.canCreateAnyway === true,
        });
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

  const renderCandidateConflict = (field) => {
    if (!duplicateWarning || duplicateWarning.field !== field) return null;
    const existing = duplicateWarning.candidate;
    const isEmailDuplicate = field === 'email';

    return (
      <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
        <div className="flex items-start gap-2">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <div className="space-y-2">
            <p className="font-medium">
              {isEmailDuplicate
                ? 'This email already belongs to an existing candidate.'
                : 'This phone number matches an existing candidate.'}
            </p>
            <p className="text-xs text-amber-800">
              {existing?.name} - {existing?.designation || 'Candidate'} at {existing?.currentCompany || 'Unknown Company'} ({existing?.stage || 'Applied'})
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => window.open(`/candidate?candidateId=${existing?._id}`, '_blank', 'noopener,noreferrer')}
                className="rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-900"
              >
                View Existing Candidate
              </button>
              {isEmailDuplicate ? (
                <button
                  type="button"
                  onClick={() => {
                    setDuplicateWarning(null);
                    handleSave('save', 'updateExisting');
                  }}
                  className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white"
                >
                  Update Existing
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setDuplicateWarning(null)}
                  className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white"
                >
                  Create Anyway
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const entryBanner = parsedData ? (
    <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
      Fields below were auto-filled from resume parsing. Review and edit before saving.
    </div>
  ) : null;

  const csvSummary = useMemo(() => {
    const ready = csvRows.filter((row) => row.__status === 'Ready').length;
    const duplicates = csvRows.filter((row) => row.__status === 'Duplicate').length;
    const errorsCount = csvRows.filter((row) => row.__status === 'Missing fields').length;
    return { ready, duplicates, errorsCount };
  }, [csvRows]);

  const drawerTitle = DRAWER_TITLES[activeTab] || DRAWER_TITLES.manual;
  const drawerDescription = DRAWER_DESCRIPTIONS[activeTab] || DRAWER_DESCRIPTIONS.manual;

  const formatExistingCandidateDate = (value) => {
    if (value == null || value === '') return '—';
    try {
      return new Date(value).toLocaleString();
    } catch {
      return '—';
    }
  };

  const emitBulkDuplicateDecision = (decision) => {
    const modal = bulkDuplicateModal;
    if (!modal) return;
    const sid = bulkCvSessionIdRef.current;
    if (modal.fileIndex !== undefined && modal.fileIndex !== null) {
      bulkCvDupAwaitingIndicesRef.current.delete(modal.fileIndex);
    }
    try {
      bulkCvSocketRef.current?.emit('duplicate_decision', {
        sessionId: sid,
        fileIndex: modal.fileIndex,
        decision,
      });
    } catch (_e) {
      /* ignore */
    }
    const next = bulkCvDupQueueRef.current.shift();
    if (next) {
      setBulkDuplicateModal(next);
    } else {
      bulkCvDupShowingRef.current = false;
      setBulkDuplicateModal(null);
    }
  };

  const bulkResumeResultRowClass = (result) => {
    if (result.status === 'created') {
      if (result.duplicateResolution === 'replaced') {
        return 'border border-violet-200 bg-white text-violet-800';
      }
      if (result.duplicateResolution === 'create_anyway') {
        return 'border border-sky-200 bg-white text-sky-800';
      }
      return 'border border-emerald-200 bg-white text-emerald-700';
    }
    if (result.status === 'skipped') {
      return 'border border-slate-200 bg-white text-slate-700';
    }
    if (result.status === 'processing') {
      return 'border border-amber-200 bg-white text-amber-800';
    }
    return 'border border-red-200 bg-white text-red-700';
  };

  const bulkResumeCompleteCardClass = (result) => {
    if (result.status === 'created') {
      if (result.duplicateResolution === 'replaced') return 'border-violet-200 bg-violet-50';
      if (result.duplicateResolution === 'create_anyway') return 'border-sky-200 bg-sky-50';
      return 'border-emerald-200 bg-emerald-50';
    }
    if (result.status === 'skipped') return 'border-slate-200 bg-slate-50';
    if (result.status === 'processing') return 'border-amber-200 bg-amber-50';
    return 'border-red-200 bg-red-50';
  };

  const bulkResumeStatusPill = (result) => {
    if (result.status === 'skipped') {
      return { label: 'skipped', className: 'bg-slate-100 text-slate-700' };
    }
    if (result.status === 'created' && result.duplicateResolution === 'replaced') {
      return { label: 'replaced', className: 'bg-violet-100 text-violet-800' };
    }
    if (result.status === 'created' && result.duplicateResolution === 'create_anyway') {
      return { label: 'saved as copy', className: 'bg-sky-100 text-sky-800' };
    }
    if (result.status === 'created') {
      return { label: 'created', className: 'bg-emerald-100 text-emerald-700' };
    }
    if (result.status === 'failed') {
      return { label: 'Failed', className: 'bg-red-100 text-red-700' };
    }
    return { label: result.status, className: 'bg-red-100 text-red-700' };
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[90]">
      {bulkDuplicateModal ? (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/70 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="bulk-dup-title"
        >
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <h3 id="bulk-dup-title" className="text-base font-semibold text-slate-900">
              Possible duplicate candidate
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              File: <span className="font-medium text-slate-700">{bulkDuplicateModal.fileName}</span>
            </p>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-blue-100 bg-blue-50/80 p-3 text-sm">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-blue-700">From this CV</p>
                <p className="mt-2 font-medium text-slate-900">
                  {(bulkDuplicateModal.newCandidate?.firstName || '').trim()}{' '}
                  {(bulkDuplicateModal.newCandidate?.lastName || '').trim()}
                </p>
                <p className="mt-1 text-xs text-slate-600">{bulkDuplicateModal.newCandidate?.email || '—'}</p>
              </div>
              <div className="rounded-xl border border-amber-100 bg-amber-50/80 p-3 text-sm">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-800">Already in database</p>
                <p className="mt-2 font-medium text-slate-900">
                  {(bulkDuplicateModal.existingCandidate?.firstName || '').trim()}{' '}
                  {(bulkDuplicateModal.existingCandidate?.lastName || '').trim()}
                </p>
                <p className="mt-1 text-xs text-slate-600">{bulkDuplicateModal.existingCandidate?.email || '—'}</p>
                <p className="mt-1 text-xs text-slate-600">
                  Role: {bulkDuplicateModal.existingCandidate?.designation || '—'}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Added: {formatExistingCandidateDate(bulkDuplicateModal.existingCandidate?.createdAt)}
                </p>
              </div>
            </div>

            <p className="mt-4 text-xs text-slate-600">
              Parsing is paused until you choose. If you do nothing for ~5 minutes, this file is skipped.
            </p>

            <div className="mt-5 flex flex-col gap-2">
              <button
                type="button"
                onClick={() => emitBulkDuplicateDecision('create_anyway')}
                className="w-full rounded-xl border border-sky-200 bg-sky-50 px-4 py-2.5 text-center text-sm font-semibold text-sky-900 transition hover:bg-sky-100"
              >
                Create anyway
              </button>
              <button
                type="button"
                onClick={() => emitBulkDuplicateDecision('replace')}
                className="w-full rounded-xl border border-violet-200 bg-violet-50 px-4 py-2.5 text-center text-sm font-semibold text-violet-900 transition hover:bg-violet-100"
              >
                Replace existing
              </button>
              <button
                type="button"
                onClick={() => emitBulkDuplicateDecision('cancel')}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-center text-sm font-semibold text-slate-800 transition hover:bg-slate-50"
              >
                Skip this CV
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div
        className={`absolute inset-0 bg-slate-900/50 ${isBulkResumeBusy ? 'cursor-not-allowed' : ''}`}
        onClick={handleDrawerClose}
      />

      <div
        className={`absolute inset-x-0 bottom-0 h-[92vh] rounded-t-2xl bg-white shadow-2xl transition-transform duration-300 sm:inset-y-0 sm:right-0 sm:left-auto sm:h-full sm:w-[520px] sm:rounded-none ${
          isOpen ? 'translate-y-0 sm:translate-x-0' : 'translate-y-full sm:translate-x-full'
        } flex flex-col`}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h2 className="text-base font-medium text-slate-900">{drawerTitle}</h2>
            <p className="mt-0.5 text-xs text-slate-500">{drawerDescription}</p>
            {inlineSuccess ? <p className="mt-1 text-xs font-medium text-emerald-600">{inlineSuccess}</p> : null}
            {isBulkResumeBusy ? (
              <p className="mt-1 text-xs font-medium text-blue-600">
                Parsing in progress — close is disabled. Use “Stop parsing” to cancel.
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={handleDrawerClose}
            disabled={isBulkResumeBusy}
            title={isBulkResumeBusy ? 'Parsing in progress — stop parsing first' : 'Close'}
            className={`rounded-full p-2 transition ${
              isBulkResumeBusy
                ? 'cursor-not-allowed text-slate-300'
                : 'text-slate-400 hover:bg-slate-100 hover:text-slate-700'
            }`}
          >
            <X size={18} />
          </button>
        </div>

        <div ref={formScrollRef} className="flex-1 overflow-y-auto px-6 py-5">
          {showMethodTabs ? (
            <div className="mb-5 flex flex-wrap gap-2">
              {METHOD_TABS.map((tab) => (
                <PillButton key={tab.key} active={activeTab === tab.key} onClick={() => handleTabChange(tab.key)}>
                  {tab.label}
                </PillButton>
              ))}
            </div>
          ) : null}

          {saveBanner ? (
            <div
              className={`mb-4 rounded-xl border px-4 py-3 text-sm ${
                saveBanner.type === 'duplicate'
                  ? 'border-amber-200 bg-amber-50 text-amber-900'
                  : 'border-red-200 bg-red-50 text-red-700'
              }`}
            >
              {saveBanner.type === 'duplicate' ? (
                <div className="space-y-3">
                  <p className="font-medium">{saveBanner.message}</p>
                  {saveBanner.existingCandidate ? (
                    <p className="text-xs text-amber-800">
                      {saveBanner.existingCandidate.name} - {saveBanner.existingCandidate.currentTitle || 'Candidate'} at{' '}
                      {saveBanner.existingCandidate.currentCompany || 'Unknown Company'} ({saveBanner.existingCandidate.stage || 'Applied'})
                    </p>
                  ) : null}
                  <div className="flex flex-wrap gap-2">
                    {saveBanner.existingCandidate ? (
                      <button
                        type="button"
                        onClick={() =>
                          window.open(
                            `/candidate?candidateId=${saveBanner.existingCandidate?._id}`,
                            '_blank',
                            'noopener,noreferrer'
                          )
                        }
                        className="rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-900"
                      >
                        View Existing Candidate
                      </button>
                    ) : null}
                    {saveBanner.canUpdate ? (
                      <button
                        type="button"
                        onClick={() => handleSave('save', 'updateExisting')}
                        className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white"
                      >
                        Update Existing
                      </button>
                    ) : null}
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-3">
                  <span>{saveBanner.message}</span>
                </div>
              )}
            </div>
          ) : null}

          {activeTab === 'resume' ? (
            <div className="mb-5">
              {!parsedResumeFile ? (
                <label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 px-6 py-8 text-center">
                  <Upload size={24} className="mb-3 text-slate-400" />
                  <p className="text-sm font-medium text-slate-700">Drag resume here or click to browse</p>
                  <p className="mt-1 text-xs text-slate-500">PDF, DOC, DOCX · Max {MAX_RESUME_FILE_LABEL}</p>
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
                        setResumeAnalysis(null);
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
              {resumeAnalysis ? (
                <div className="mt-4 rounded-2xl border border-blue-100 bg-blue-50/60 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">AI Resume Score</p>
                      <p className="mt-1 text-3xl font-bold text-slate-900">{resumeAnalysis.overall || 0}%</p>
                    </div>
                    <div className="grid flex-1 grid-cols-2 gap-3 text-xs text-slate-600">
                      <div className="rounded-xl bg-white px-3 py-2">
                        <p className="font-semibold text-slate-700">Skills</p>
                        <p className="mt-1">{resumeAnalysis.breakdown?.skillsMatch || 0}%</p>
                      </div>
                      <div className="rounded-xl bg-white px-3 py-2">
                        <p className="font-semibold text-slate-700">Experience</p>
                        <p className="mt-1">{resumeAnalysis.breakdown?.experienceFit || 0}%</p>
                      </div>
                      <div className="rounded-xl bg-white px-3 py-2">
                        <p className="font-semibold text-slate-700">Education</p>
                        <p className="mt-1">{resumeAnalysis.breakdown?.educationFit || 0}%</p>
                      </div>
                      <div className="rounded-xl bg-white px-3 py-2">
                        <p className="font-semibold text-slate-700">Keywords</p>
                        <p className="mt-1">{resumeAnalysis.breakdown?.keywordMatch || 0}%</p>
                      </div>
                    </div>
                  </div>
                  {Array.isArray(resumeAnalysis.insights) && resumeAnalysis.insights.length ? (
                    <div className="mt-3 rounded-xl bg-white p-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Insights</p>
                      <ul className="mt-2 space-y-1 text-sm text-slate-700">
                        {resumeAnalysis.insights.slice(0, 4).map((insight) => (
                          <li key={insight}>• {insight}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
              ) : null}
              {parsedData ? (
                <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Extracted Resume Data
                      </p>
                      <p className="mt-1 text-sm text-slate-600">
                        Review all parsed CV details section by section before saving.
                      </p>
                    </div>
                    {parsedData.resumeUrl ? (
                      <a
                        href={parsedData.resumeUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700"
                      >
                        View CV
                      </a>
                    ) : null}
                  </div>

                  <div className="space-y-4">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Personal Information</p>
                      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div className="rounded-xl bg-white p-3">
                          <p className="text-xs text-slate-500">Name</p>
                          <p className="mt-1 text-sm font-medium text-slate-900">
                            {[parsedData.firstName, parsedData.lastName].filter(Boolean).join(' ') || 'Not found'}
                          </p>
                        </div>
                        <div className="rounded-xl bg-white p-3">
                          <p className="text-xs text-slate-500">Email</p>
                          <p className="mt-1 text-sm font-medium text-slate-900">{parsedData.email || 'Not found'}</p>
                        </div>
                        <div className="rounded-xl bg-white p-3">
                          <p className="text-xs text-slate-500">Phone</p>
                          <p className="mt-1 text-sm font-medium text-slate-900">{parsedData.phone || 'Not found'}</p>
                        </div>
                        <div className="rounded-xl bg-white p-3">
                          <p className="text-xs text-slate-500">Location</p>
                          <p className="mt-1 text-sm font-medium text-slate-900">
                            {parsedData.location || [parsedData.city, parsedData.country].filter(Boolean).join(', ') || 'Not found'}
                          </p>
                        </div>
                        <div className="rounded-xl bg-white p-3">
                          <p className="text-xs text-slate-500">Current Company</p>
                          <p className="mt-1 text-sm font-medium text-slate-900">{parsedData.currentCompany || 'Not found'}</p>
                        </div>
                        <div className="rounded-xl bg-white p-3">
                          <p className="text-xs text-slate-500">Current Designation</p>
                          <p className="mt-1 text-sm font-medium text-slate-900">
                            {parsedData.currentDesignation || parsedData.designation || 'Not found'}
                          </p>
                        </div>
                      </div>
                      {parsedData.summary ? (
                        <div className="mt-3 rounded-xl bg-white p-3">
                          <p className="text-xs text-slate-500">Summary</p>
                          <p className="mt-1 text-sm leading-6 text-slate-700">{parsedData.summary}</p>
                        </div>
                      ) : null}
                    </div>

                    {(parsedData.linkedinUrl || parsedData.portfolioUrl || parsedData.portfolioLinks?.length) ? (
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Links</p>
                        <div className="mt-3 space-y-2">
                          {parsedData.linkedinUrl ? (
                            <a
                              href={parsedData.linkedinUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="block rounded-xl bg-white p-3 text-sm font-medium text-blue-600"
                            >
                              LinkedIn: {parsedData.linkedinUrl}
                            </a>
                          ) : null}
                          {parsedData.portfolioUrl ? (
                            <a
                              href={parsedData.portfolioUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="block rounded-xl bg-white p-3 text-sm font-medium text-blue-600"
                            >
                              Portfolio: {parsedData.portfolioUrl}
                            </a>
                          ) : null}
                          {Array.isArray(parsedData.portfolioLinks)
                            ? parsedData.portfolioLinks
                                .filter((item) => item?.url && item.url !== parsedData.linkedinUrl && item.url !== parsedData.portfolioUrl)
                                .map((item) => (
                                  <a
                                    key={`${item.type}-${item.url}`}
                                    href={item.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="block rounded-xl bg-white p-3 text-sm font-medium text-blue-600"
                                  >
                                    {item.type || 'Link'}: {item.url}
                                  </a>
                                ))
                            : null}
                        </div>
                      </div>
                    ) : null}

                    {Array.isArray(parsedData.educationEntries) && parsedData.educationEntries.length ? (
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Education</p>
                        <div className="mt-3 space-y-3">
                          {parsedData.educationEntries.map((item, index) => (
                            <div key={`${item.degree || 'education'}-${index}`} className="rounded-xl bg-white p-3">
                              <p className="text-sm font-semibold text-slate-900">{item.degree || 'Education entry'}</p>
                              <p className="mt-1 text-sm text-slate-600">{item.institution || 'Institution not found'}</p>
                              <p className="mt-2 text-xs text-slate-500">
                                {[item.startYear, item.endYear].filter(Boolean).join(' - ') || 'Dates not found'}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : parsedData.education ? (
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Education</p>
                        <div className="mt-3 rounded-xl bg-white p-3 text-sm leading-6 text-slate-700">
                          {parsedData.education}
                        </div>
                      </div>
                    ) : null}

                    {Array.isArray(parsedData.workExperienceEntries) && parsedData.workExperienceEntries.length ? (
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Work Experience</p>
                        <div className="mt-3 space-y-3">
                          {parsedData.workExperienceEntries.map((item, index) => (
                            <div key={`${item.title || 'experience'}-${index}`} className="rounded-xl bg-white p-3">
                              <p className="text-sm font-semibold text-slate-900">
                                {item.title || 'Role not found'}
                                {item.company ? ` at ${item.company}` : ''}
                              </p>
                              <p className="mt-1 text-xs text-slate-500">
                                {[item.location, [item.startDate, item.endDate].filter(Boolean).join(' - ')].filter(Boolean).join(' • ') || 'Details not found'}
                              </p>
                              {Array.isArray(item.responsibilities) && item.responsibilities.length ? (
                                <ul className="mt-3 space-y-1 text-sm text-slate-700">
                                  {item.responsibilities.slice(0, 4).map((responsibility, responsibilityIndex) => (
                                    <li key={`${item.title || 'experience'}-${responsibilityIndex}`}>• {responsibility}</li>
                                  ))}
                                </ul>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    {(parsedData.skills?.length || parsedData.tags?.length || parsedData.certifications?.length || parsedData.languages?.length) ? (
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Skills & Qualifications</p>
                        <div className="mt-3 space-y-3">
                          {Array.isArray(parsedData.skills) && parsedData.skills.length ? (
                            <div className="rounded-xl bg-white p-3">
                              <p className="text-xs text-slate-500">Skills</p>
                              <div className="mt-2 flex flex-wrap gap-2">
                                {parsedData.skills.map((skill) => (
                                  <span key={skill} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                                    {skill}
                                  </span>
                                ))}
                              </div>
                            </div>
                          ) : null}
                          {Array.isArray(parsedData.tags) && parsedData.tags.length ? (
                            <div className="rounded-xl bg-white p-3">
                              <p className="text-xs text-slate-500">Tags</p>
                              <div className="mt-2 flex flex-wrap gap-2">
                                {parsedData.tags.map((tag) => (
                                  <span key={tag} className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">
                                    {tag}
                                  </span>
                                ))}
                              </div>
                            </div>
                          ) : null}
                          {Array.isArray(parsedData.languages) && parsedData.languages.length ? (
                            <div className="rounded-xl bg-white p-3">
                              <p className="text-xs text-slate-500">Languages</p>
                              <p className="mt-1 text-sm text-slate-700">{parsedData.languages.join(', ')}</p>
                            </div>
                          ) : null}
                          {Array.isArray(parsedData.certifications) && parsedData.certifications.length ? (
                            <div className="rounded-xl bg-white p-3">
                              <p className="text-xs text-slate-500">Certifications</p>
                              <ul className="mt-2 space-y-1 text-sm text-slate-700">
                                {parsedData.certifications.map((certification) => (
                                  <li key={certification}>• {certification}</li>
                                ))}
                              </ul>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : null}
              {entryBanner}
            </div>
          ) : null}

          {activeTab === 'bulkResume' ? (
            <div className="space-y-4">
              {bulkResumePhase === 'upload' ? (
                <label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center">
                  <Upload size={26} className="mb-3 text-slate-400" />
                  <p className="text-sm font-medium text-slate-700">Upload multiple CV files at once</p>
                  <p className="mt-1 text-xs text-slate-500">
                    PDF, DOC, DOCX · max {MAX_RESUME_FILE_LABEL} each · candidates will be created automatically
                  </p>
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx"
                    multiple
                    className="hidden"
                    onChange={(event) => handleBulkResumeSelected(event.target.files)}
                  />
                </label>
              ) : null}

              {bulkResumePhase === 'preview' ? (
                <div className="space-y-4">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Ready To Process</p>
                    <p className="mt-1 text-sm text-slate-600">
                      {bulkResumeFiles.length} CV file{bulkResumeFiles.length === 1 ? '' : 's'} selected. Each file will be added to the candidate pool with a &quot;New&quot; tag — no job or owner until you assign them later.
                    </p>
                    <div className="mt-4 max-h-72 space-y-2 overflow-y-auto">
                      {bulkResumeFiles.map((file) => (
                        <div key={`${file.name}-${file.size}`} className="flex items-center justify-between rounded-xl bg-white px-4 py-3 text-sm text-slate-700">
                          <span className="flex items-center gap-2">
                            <FileText size={16} />
                            {file.name}
                          </span>
                          <span className="text-xs text-slate-500">{Math.max(1, Math.round(file.size / 1024))} KB</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : null}

              {bulkResumePhase === 'importing' ? (
                <div className="rounded-2xl border border-blue-100 bg-blue-50/70 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 text-blue-700">
                      <Loader2 size={18} className="animate-spin" />
                      <div>
                        <p className="text-sm font-semibold">
                          {bulkResumeStopRequested
                            ? 'Stopping after current file...'
                            : 'Creating candidates from uploaded CVs...'}
                        </p>
                        <p className="text-xs text-blue-600">
                          Processed {bulkResumeProgress.current} of {bulkResumeProgress.total}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleStopBulkResume}
                      disabled={bulkResumeStopRequested}
                      className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${
                        bulkResumeStopRequested
                          ? 'cursor-not-allowed border-red-200 bg-red-50 text-red-400'
                          : 'border-red-200 bg-white text-red-600 hover:bg-red-50'
                      }`}
                    >
                      <StopCircle size={14} />
                      {bulkResumeStopRequested ? 'Stopping…' : 'Stop parsing'}
                    </button>
                  </div>
                  <div className="mt-4 h-2 overflow-hidden rounded-full bg-blue-100">
                    <div
                      className="h-full rounded-full bg-blue-600 transition-all"
                      style={{
                        width: `${bulkResumeProgress.total ? (bulkResumeProgress.current / bulkResumeProgress.total) * 100 : 0}%`,
                      }}
                    />
                  </div>
                  {bulkResumeResults.length ? (
                    <div className="mt-4 max-h-72 space-y-2 overflow-y-auto">
                      {bulkResumeResults.map((result, index) => (
                        <div
                          key={`${result.fileName}-${index}`}
                          className={`rounded-xl px-4 py-3 text-sm ${bulkResumeResultRowClass(result)}`}
                        >
                          <p className="font-medium">{result.fileName}</p>
                          <p className="mt-1 text-xs">{result.message}</p>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}

              {bulkResumePhase === 'complete' ? (
                <div className="space-y-4">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Bulk CV Upload Result</p>
                    <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                      <div className="rounded-xl bg-white p-3">
                        <p className="text-xs text-slate-500">Total Files</p>
                        <p className="mt-1 text-lg font-semibold text-slate-900">
                          {bulkCvSummary?.totalReceived ?? bulkResumeResults.length}
                        </p>
                      </div>
                      <div className="rounded-xl bg-white p-3">
                        <p className="text-xs text-slate-500">Created</p>
                        <p className="mt-1 text-lg font-semibold text-emerald-600">
                          {bulkCvSummary?.succeeded ?? bulkResumeResults.filter((item) => item.status === 'created').length}
                        </p>
                      </div>
                      <div className="rounded-xl bg-white p-3">
                        <p className="text-xs text-slate-500">Skipped</p>
                        <p className="mt-1 text-lg font-semibold text-slate-600">
                          {bulkCvSummary?.skipped ?? bulkResumeResults.filter((item) => item.status === 'skipped').length}
                        </p>
                      </div>
                      <div className="rounded-xl bg-white p-3">
                        <p className="text-xs text-slate-500">Failed</p>
                        <p className="mt-1 text-lg font-semibold text-red-600">
                          {bulkCvSummary?.failed ?? bulkResumeResults.filter((item) => item.status === 'failed').length}
                        </p>
                      </div>
                      <div className="rounded-xl bg-white p-3">
                        <p className="text-xs text-slate-500">Batch time</p>
                        <p className="mt-1 text-sm font-semibold text-slate-900">
                          {bulkCvSummary?.durationMs != null
                            ? `${(bulkCvSummary.durationMs / 1000).toFixed(1)}s`
                            : '—'}
                        </p>
                      </div>
                    </div>
                    {bulkCvSummary?.failures?.length ? (
                      <div className="mt-3 rounded-xl border border-red-100 bg-white p-3 text-xs text-red-800">
                        <p className="font-semibold text-red-900">Failures</p>
                        <ul className="mt-2 list-inside list-disc space-y-1">
                          {bulkCvSummary.failures.map((f) => (
                            <li key={f.fileName}>
                              <span className="font-medium">{f.fileName}</span> — {f.reason}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </div>

                  <div className="max-h-80 space-y-2 overflow-y-auto">
                    {bulkResumeResults.map((result, index) => {
                      const pill = bulkResumeStatusPill(result);
                      return (
                        <div
                          key={`${result.fileName}-${index}`}
                          className={`rounded-xl border px-4 py-3 ${bulkResumeCompleteCardClass(result)}`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-semibold text-slate-900">{result.fileName}</p>
                              {result.candidateName ? (
                                <p className="mt-1 text-xs text-slate-600">{result.candidateName}</p>
                              ) : null}
                            </div>
                            <span
                              className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${pill.className}`}
                            >
                              {pill.label}
                            </span>
                          </div>
                          <p className="mt-2 text-xs text-slate-600">{result.message}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : null}
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
                  <button
                    type="button"
                    onClick={handleDownloadCsvTemplate}
                    className="inline-flex items-center gap-2 text-sm font-medium text-blue-600"
                  >
                    <Download size={16} />
                    Download CSV template
                  </button>
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
          ) : activeTab === 'bulkResume' ? null : (
            <>
              <StepProgress currentStep={currentStep} />
              <AddCandidateFormSections
              currentStep={currentStep}
              formData={formData}
              updateFormData={updateFormData}
              errors={errors}
              autoFilledFields={autoFilledFields}
              fieldRefs={fieldRefs}
              jobs={jobs}
              recruiters={recruiters}
              selectedJob={selectedJob}
              lockJobSelection={lockJobSelection}
              manualResumeFile={manualResumeFile}
              setManualResumeFile={setManualResumeFile}
              resumeFileRef={resumeFileRef}
              parsedResumeFile={parsedResumeFile}
              activeTab={activeTab}
              avatarPreview={avatarPreview || formData.avatar}
              onAvatarFile={handleAvatarFile}
              onAvatarRemove={clearAvatarFile}
              renderCandidateConflict={renderCandidateConflict}
              handleDuplicateCheck={handleDuplicateCheck}
              validateEmail={validateEmail}
              validateNoDigits={validateNoDigits}
              stripDigits={stripDigits}
              maxResumeFileLabel={MAX_RESUME_FILE_LABEL}
              currencyOptions={CURRENCY_OPTIONS}
              pipelineStages={PIPELINE_STAGES}
              sourceOptions={SOURCE_OPTIONS}
              maritalStatusOptions={MARITAL_STATUS_OPTIONS}
              proficiencyOptions={PROFICIENCY_OPTIONS}
            />
            </>
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
          ) : activeTab === 'bulkResume' ? (
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={handleDrawerClose}
                disabled={isBulkResumeBusy}
                title={isBulkResumeBusy ? 'Parsing in progress — stop parsing first' : ''}
                className={`rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium ${
                  isBulkResumeBusy
                    ? 'cursor-not-allowed text-slate-400'
                    : 'text-slate-700'
                }`}
              >
                {bulkResumePhase === 'complete' ? 'Done' : 'Cancel'}
              </button>
              {bulkResumePhase === 'preview' ? (
                <button
                  type="button"
                  onClick={handleBulkResumeImport}
                  className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white"
                >
                  Create {bulkResumeFiles.length} Candidates →
                </button>
              ) : null}
              {bulkResumePhase === 'importing' ? (
                <button
                  type="button"
                  onClick={handleStopBulkResume}
                  disabled={bulkResumeStopRequested}
                  className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition ${
                    bulkResumeStopRequested
                      ? 'cursor-not-allowed bg-red-300'
                      : 'bg-red-600 hover:bg-red-700'
                  }`}
                >
                  <StopCircle size={16} />
                  {bulkResumeStopRequested ? 'Stopping…' : 'Stop parsing'}
                </button>
              ) : null}
              {bulkResumePhase === 'complete' ? (
                <button
                  type="button"
                  onClick={() => {
                    resetForNext(activeTab);
                    onClose();
                  }}
                  className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white"
                >
                  Close
                </button>
              ) : null}
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3">
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
              <div className="ml-auto flex flex-wrap items-center gap-3">
                {currentStep < CANDIDATE_FORM_STEPS.length ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (!validateStep(currentStep)) return;
                      setCurrentStep((prev) => prev + 1);
                    }}
                    className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white"
                  >
                    Next →
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
                      {isSaving ? 'Submitting...' : 'Submit'}
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        {duplicateDecision ? (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-slate-900/40 px-4">
            <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl">
              <div className="flex items-start gap-3">
                <div className="rounded-full bg-amber-100 p-2 text-amber-700">
                  <AlertCircle size={18} />
                </div>
                <div className="flex-1">
                  <h3 className="text-base font-semibold text-slate-900">Duplicate Candidate Found</h3>
                  <p className="mt-1 text-sm text-slate-600">{duplicateDecision.message}</p>
                  {duplicateDecision.candidate ? (
                    <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                      <p className="font-medium text-slate-900">{duplicateDecision.candidate.name}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {duplicateDecision.candidate.currentTitle || 'Candidate'} at{' '}
                        {duplicateDecision.candidate.currentCompany || 'Unknown Company'} ({duplicateDecision.candidate.stage || 'Applied'})
                      </p>
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="mt-5 grid grid-cols-1 gap-2">
                <button
                  type="button"
                  disabled={!duplicateDecision.canCreateAnyway}
                  onClick={() => {
                    const nextMode = duplicateDecision.mode || 'save';
                    closeDuplicateDecision();
                    if (duplicateDecision.canCreateAnyway) {
                      handleSave(nextMode, 'createAnyway');
                    }
                  }}
                  className={`rounded-xl px-4 py-2.5 text-sm font-semibold ${
                    duplicateDecision.canCreateAnyway
                      ? 'bg-amber-500 text-white'
                      : 'cursor-not-allowed bg-slate-100 text-slate-400'
                  }`}
                >
                  Create Anyway
                </button>
                <button
                  type="button"
                  onClick={() => closeDuplicateDecision()}
                  className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700"
                >
                  Duplicate Found Still Continue
                </button>
                <button
                  type="button"
                  disabled={!duplicateDecision.canUpdate}
                  onClick={() => {
                    const nextMode = duplicateDecision.mode || 'save';
                    closeDuplicateDecision();
                    if (duplicateDecision.canUpdate) {
                      handleSave(nextMode, 'updateExisting');
                    }
                  }}
                  className={`rounded-xl px-4 py-2.5 text-sm font-semibold ${
                    duplicateDecision.canUpdate
                      ? 'bg-slate-900 text-white'
                      : 'cursor-not-allowed bg-slate-100 text-slate-400'
                  }`}
                >
                  Update Existing
                </button>
              </div>

              <p className="mt-3 text-xs text-slate-500">
                `Create Anyway` is available only when the duplicate is from phone or when email is different/missing.
              </p>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
