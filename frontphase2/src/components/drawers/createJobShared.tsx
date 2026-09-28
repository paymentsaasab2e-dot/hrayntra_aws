'use client';

import { Upload } from 'lucide-react';
import { type JobCreationPipelineResult, type BackendClient } from '../../lib/api';
import type { TeamRequestJobPrefill } from '../../types/team';
import { extractAdditionalJdSectionsFromHtml, mergeCustomJdSections, type JobCustomJdSection } from '../../lib/jobCustomJdSections';
import { normalizeJobSalaryCurrency, parseJobSalaryMoneyNumber } from '../../constants/jobSalary';
import { normalizeCompanyNameKey } from '../../lib/companyNameKey';
import { normalizeExtractedJobTitle } from '../../lib/normalizeExtractedJobTitle';

export type ApplicationLogoOption = 'account' | 'company' | 'none' | 'custom';

export type ScreeningQuestionType = 'short_text' | 'yes_no' | 'single_choice' | 'slider';

export interface ScreeningQuestion {
  id: string;
  type: ScreeningQuestionType;
  label: string;
  required?: boolean;
  options?: string[];
  min?: number;
  max?: number;
  step?: number;
  minLabel?: string;
  maxLabel?: string;
}

export const SCREENING_TYPE_OPTIONS: { value: ScreeningQuestionType; label: string; hint: string }[] = [
  { value: 'short_text', label: 'Short text', hint: 'Open answer (single line)' },
  { value: 'yes_no', label: 'Yes / No', hint: 'Two-option toggle' },
  { value: 'single_choice', label: 'Multiple choice', hint: 'Pick one from your options' },
  { value: 'slider', label: 'Proficiency slider', hint: 'Slider scale (e.g. Beginner → Expert)' },
];

export function generateScreeningQuestionId() {
  return `q_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
}

export function parseScreeningQuestion(raw: string | ScreeningQuestion | null | undefined): ScreeningQuestion | null {
  if (!raw) return null;
  if (typeof raw === 'object' && raw !== null && typeof (raw as ScreeningQuestion).label === 'string') {
    const obj = raw as ScreeningQuestion;
    return {
      id: obj.id || generateScreeningQuestionId(),
      type: (obj.type as ScreeningQuestionType) || 'short_text',
      label: obj.label,
      required: !!obj.required,
      options: Array.isArray(obj.options) ? obj.options.map((s) => String(s)) : undefined,
      min: typeof obj.min === 'number' ? obj.min : undefined,
      max: typeof obj.max === 'number' ? obj.max : undefined,
      step: typeof obj.step === 'number' ? obj.step : undefined,
      minLabel: typeof obj.minLabel === 'string' ? obj.minLabel : undefined,
      maxLabel: typeof obj.maxLabel === 'string' ? obj.maxLabel : undefined,
    };
  }
  const text = String(raw).trim();
  if (!text) return null;
  if (text.startsWith('{')) {
    try {
      const parsed = JSON.parse(text);
      if (parsed && typeof parsed === 'object' && typeof parsed.label === 'string') {
        return parseScreeningQuestion(parsed);
      }
    } catch {
      /* fall through to plain-text */
    }
  }
  return { id: generateScreeningQuestionId(), type: 'short_text', label: text };
}

export function parseScreeningQuestionList(raw: unknown): ScreeningQuestion[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((entry) => parseScreeningQuestion(entry as string | ScreeningQuestion))
    .filter((q): q is ScreeningQuestion => Boolean(q && q.label));
}

export function serializeScreeningQuestion(q: ScreeningQuestion): string {
  const payload: ScreeningQuestion = {
    id: q.id || generateScreeningQuestionId(),
    type: q.type,
    label: q.label.trim(),
    required: !!q.required,
  };
  if (q.type === 'single_choice') {
    payload.options = (q.options || []).map((s) => s.trim()).filter(Boolean);
  } else if (q.type === 'slider') {
    payload.min = typeof q.min === 'number' ? q.min : 0;
    payload.max = typeof q.max === 'number' ? q.max : 100;
    payload.step = typeof q.step === 'number' && q.step > 0 ? q.step : 1;
    payload.minLabel = (q.minLabel || 'Beginner').trim();
    payload.maxLabel = (q.maxLabel || 'Expert').trim();
  }
  return JSON.stringify(payload);
}

export function makeShortTextScreeningQuestion(label: string): ScreeningQuestion {
  return {
    id: generateScreeningQuestionId(),
    type: 'short_text',
    label: label.trim(),
    required: false,
  };
}

export function extractLabeledPromptValue(text: string, labels: string[]): string {
  const sortedLabels = [...labels].sort((a, b) => b.length - a.length);
  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    const trimmedLine = line.trim();
    if (!trimmedLine) continue;
    for (const label of sortedLabels) {
      const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const pattern = new RegExp(`^\\s*${escaped}\\s*[:\\-–—]\\s*(.+)$`, 'i');
      const match = trimmedLine.match(pattern);
      if (match?.[1]) return match[1].trim();
    }
  }
  return '';
}

export function extractJobSectionTextFromHtml(html: string, sectionTitle: string): string {
  if (!html || typeof window === 'undefined') return '';
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const headings = Array.from(doc.querySelectorAll('h2, h3, h4'));
    const heading = headings.find((node) =>
      (node.textContent || '').trim().toLowerCase().includes(sectionTitle.toLowerCase()),
    );
    if (!heading) return '';

    const chunks: string[] = [];
    let cursor = heading.nextElementSibling;
    while (cursor && !['H2', 'H3', 'H4'].includes(cursor.tagName)) {
      if (cursor.tagName === 'LI') {
        const text = (cursor.textContent || '').trim();
        if (text) chunks.push(text);
      } else if (cursor.tagName === 'UL' || cursor.tagName === 'OL') {
        cursor.querySelectorAll('li').forEach((li) => {
          const text = (li.textContent || '').trim();
          if (text) chunks.push(text);
        });
      } else {
        const text = (cursor.textContent || '').trim();
        if (text) chunks.push(text);
      }
      cursor = cursor.nextElementSibling;
    }
    return chunks.join('\n');
  } catch {
    return '';
  }
}

export function hydrateJobListFieldsFromPipelineResult(data: JobCreationPipelineResult): {
  keyResponsibilitiesText: string;
  qualificationsExperienceText: string;
  candidateRequirementsText: string;
  compensationBenefitsText: string;
  customJdSections: JobCustomJdSection[];
} {
  const html = String(data.jobDescriptionHtml || '').trim();
  const pick = (value: string | undefined, ...sectionTitles: string[]) => {
    const direct = String(value || '').trim();
    if (direct) return direct;
    for (const title of sectionTitles) {
      const fromHtml = extractJobSectionTextFromHtml(html, title);
      if (fromHtml.trim()) return fromHtml.trim();
    }
    return '';
  };

  const qualificationsParts = [
    pick(data.qualificationsExperienceText, 'requirements', 'requirement'),
    extractJobSectionTextFromHtml(html, 'preferred qualifications'),
    extractJobSectionTextFromHtml(html, 'preferred qualification'),
    extractJobSectionTextFromHtml(html, 'qualifications'),
    extractJobSectionTextFromHtml(html, 'education'),
  ].filter(Boolean);

  let candidateRequirementsText = pick(
    data.candidateRequirementsText,
    'candidate requirements',
    'additional requirements',
  );
  if (!candidateRequirementsText) {
    const fallbackLines = [
      data.educationalQualification,
      data.educationalSpecialization,
      data.minExperience != null && data.maxExperience != null && data.minExperience > 0
        ? `${data.minExperience}–${data.maxExperience} years of relevant experience`
        : data.minExperience != null && data.minExperience > 0
          ? `At least ${data.minExperience} years of relevant experience`
          : '',
      data.nationality ? `Nationality: ${data.nationality}` : '',
      data.country ? `Eligible to work in ${data.country}` : '',
    ].filter((line): line is string => Boolean(String(line || '').trim()));
    candidateRequirementsText = fallbackLines.join('\n');
  }

  const pipelineAdditional = Array.isArray((data as { additionalSections?: unknown }).additionalSections)
    ? ((data as { additionalSections: Array<{ title?: string; bodyText?: string; body?: string }> }).additionalSections || [])
        .map((section) => ({
          id: `pipe_${Math.random().toString(36).slice(2, 9)}`,
          title: String(section.title || '').trim(),
          body: String(section.bodyText || section.body || '').trim(),
        }))
        .filter((section) => section.title || section.body)
    : [];

  return {
    keyResponsibilitiesText: pick(
      data.keyResponsibilitiesText,
      'key responsibilities',
      'responsibilities',
    ),
    qualificationsExperienceText:
      qualificationsParts.length > 0
        ? qualificationsParts.join('\n')
        : pick(data.qualificationsExperienceText, 'qualifications', 'qualification'),
    candidateRequirementsText,
    compensationBenefitsText: pick(
      data.compensationBenefitsText,
      'benefits',
      'compensation',
      'perks',
    ),
    customJdSections: mergeCustomJdSections(
      pipelineAdditional,
      extractAdditionalJdSectionsFromHtml(html),
    ),
  };
}

export function inferJobTitleFromPrompt(prompt: string): string {
  const labeled = extractLabeledPromptValue(prompt, ['job title', 'role title', 'role', 'position', 'designation']);
  if (labeled) return normalizeExtractedJobTitle(labeled);

  const cleanPrompt = prompt.trim().replace(/\s+/g, ' ');
  if (!cleanPrompt) return '';

  const patterns = [
    /(?:creat|create|generate|write|make)\s+(?:a\s+)?job(?:\s+description|\s+jd)?\s+(?:for|of)\s+(?:an?\s+|the\s+)?(.+?)(?:\s+in\s+[A-Za-z]|\s+with\s+salary|\s+for\s+salary|\s+salary\s+|\s+only\s+for|,|$)/i,
    /(?:hiring|looking\s+for|need)\s+(?:an?\s+)?(.+?)(?:\s+in\s+[A-Za-z]|\s+with\s+salary|\s+for\s+salary|,|$)/i,
    /(?:creat|create|generate|write|make)\s+(?:a\s+)?job(?:\s+description|\s+jd)?\s+(?:for|of)\s+(?:an?\s+|the\s+)?(.+)/i,
    /(?:for|of)\s+(?:an?\s+|the\s+)?([a-z][a-z\s/&-]{2,})$/i,
    /^(?:an?\s+|the\s+)?([a-z][a-z\s/&-]{2,})$/i,
  ];

  for (const pattern of patterns) {
    const match = cleanPrompt.match(pattern);
    if (match?.[1]) {
      return normalizeExtractedJobTitle(match[1].trim().replace(/[.!,]$/, ''));
    }
  }

  return '';
}

export function inferWorkModeFromText(text: string): string {
  const normalized = text.toLowerCase();
  if (normalized.includes('hybrid')) return 'Hybrid';
  if (normalized.includes('remote')) return 'Remote';
  if (normalized.includes('on-site') || normalized.includes('onsite')) return 'On-site';
  return '';
}

export function parseJobLocationFromText(location: string) {
  const workMode = inferWorkModeFromText(location);
  const withoutParens = location.replace(/\([^)]*\)/g, '').trim();
  const parts = withoutParens.split(',').map((part) => part.trim()).filter(Boolean);
  let city = '';
  let state = '';
  let country = '';
  if (parts.length >= 3) {
    city = parts[0];
    state = parts[1];
    country = parts[parts.length - 1];
  } else if (parts.length === 2) {
    city = parts[0];
    country = parts[1];
  } else if (parts.length === 1) {
    country = parts[0];
  }
  return { city, state, country, workMode, jobLocation: withoutParens || location.trim() };
}

export function parseExperienceRangeYears(text: string): { min?: number; max?: number } {
  if (!text.trim()) return {};
  const range = text.match(/(\d+)\s*(?:to|-|–)\s*(\d+)/i);
  if (range) return { min: Number(range[1]), max: Number(range[2]) };
  const plus = text.match(/(\d+)\s*\+\s*years?/i);
  if (plus) return { min: Number(plus[1]) };
  const years = text.match(/(\d+)\s*years?/i);
  if (years) return { min: Number(years[1]) };
  return {};
}

export function normalizeCompanyMatchKey(name: string): string {
  return normalizeCompanyNameKey(name);
}

export function resolveClientIdByCompanyName(name: string, clients: BackendClient[]): string {
  const raw = name.trim();
  if (!raw) return '';
  const normalized = raw.toLowerCase();
  const compact = normalizeCompanyMatchKey(raw);

  const exact = clients.find((client) => (client.companyName || '').trim().toLowerCase() === normalized);
  if (exact?.id) return exact.id;

  const compactMatch = clients.find(
    (client) => compact && normalizeCompanyMatchKey(client.companyName || '') === compact,
  );
  if (compactMatch?.id) return compactMatch.id;

  const partial = clients.find((client) => {
    const companyName = (client.companyName || '').trim().toLowerCase();
    if (!companyName) return false;
    return companyName.includes(normalized) || normalized.includes(companyName);
  });
  if (partial?.id) return partial.id;

  const token = compact.slice(0, Math.max(4, Math.floor(compact.length * 0.6)));
  if (token.length >= 4) {
    const tokenMatch = clients.find((client) =>
      normalizeCompanyMatchKey(client.companyName || '').includes(token),
    );
    if (tokenMatch?.id) return tokenMatch.id;
  }

  return '';
}

export function defaultTargetHireDateIso(): string {
  const date = new Date();
  date.setDate(date.getDate() + 30);
  return date.toISOString().slice(0, 10);
}

export function parseTargetHireDateValue(raw: string): string {
  const isoMatch = raw.match(/\d{4}-\d{2}-\d{2}/);
  if (isoMatch) return isoMatch[0];
  const parsed = Date.parse(raw);
  if (!Number.isNaN(parsed)) return new Date(parsed).toISOString().slice(0, 10);
  return '';
}

export function parseExperienceRequiredForForm(experienceRequired?: string | null): {
  min: string;
  max: string;
} {
  const raw = String(experienceRequired || '').trim();
  if (!raw) return { min: '', max: '' };

  const rangeMatch = raw.match(/^(\d+)\s*-\s*(\d+)/);
  if (rangeMatch) {
    return {
      min: rangeMatch[1],
      max: rangeMatch[2],
    };
  }

  const openEndedMatch = raw.match(/^(\d+)\s*-/);
  if (openEndedMatch) {
    return { min: openEndedMatch[1], max: '' };
  }

  const singleMatch = raw.match(/^(\d+)/);
  if (singleMatch) {
    return { min: singleMatch[1], max: '' };
  }

  return { min: '', max: '' };
}

export interface JobPromptHints {
  jobTitle: string;
  openings: string;
  companyName: string;
  companyId: string;
  nationality: string;
  industryType: string;
  location: string;
  country: string;
  city: string;
  state: string;
  workMode: string;
  salary: string;
  salaryCurrency: string;
  payRangeMin: string;
  payRangeMax: string;
  qualification: string;
  employmentType: string;
  minExperienceYears?: number;
  maxExperienceYears?: number;
  skills: string[];
  targetHireDate: string;
}

export function emptyJobPromptHints(): JobPromptHints {
  return {
    jobTitle: '',
    openings: '',
    companyName: '',
    companyId: '',
    nationality: '',
    industryType: '',
    location: '',
    country: '',
    city: '',
    state: '',
    workMode: '',
    salary: '',
    salaryCurrency: '',
    payRangeMin: '',
    payRangeMax: '',
    qualification: '',
    employmentType: '',
    skills: [],
    targetHireDate: '',
  };
}

export function normalizeEmploymentTypeValue(value: string): string {
  const normalized = String(value || '').toLowerCase();
  if (!normalized) return '';
  if (normalized.includes('part')) return 'Part Time';
  if (normalized.includes('contract')) return 'Contract';
  if (normalized.includes('intern')) return 'Internship';
  if (normalized.includes('freelance')) return 'Freelance';
  if (normalized.includes('full')) return 'Full Time';
  return '';
}

export function parseSalaryHint(raw: string, contextText = ''): { currency: string; min: string; max: string } {
  const text = String(raw || '').trim();
  const blob = `${text} ${String(contextText || '')}`.trim();
  if (!text && !blob) return { currency: '', min: '', max: '' };

  const inferCurrency = () => {
    if (/\bINR\b/i.test(blob) || /\bIndia\b/i.test(blob) || /\b₹\b/.test(blob) || /\bLPA\b/i.test(blob)) {
      return 'INR';
    }
    if (/\bUSD\b/i.test(blob) || /\$/.test(blob)) return 'USD';
    return '';
  };

  const kRange = blob.match(/(\d+(?:\.\d+)?)\s*k\s*(?:to|-|–)\s*(\d+(?:\.\d+)?)\s*k/i);
  if (kRange) {
    return {
      currency: inferCurrency() || 'INR',
      min: String(Math.round(Number(kRange[1]) * 1000)),
      max: String(Math.round(Number(kRange[2]) * 1000)),
    };
  }

  const currencyMatch = text.match(/\b(INR|USD|EUR|GBP|AED|SAR|CAD|AUD|XAF|XOF|CFA|UGX|NGN|KES)\b/i);
  const currency = normalizeJobSalaryCurrency(currencyMatch?.[1] || '');
  const range = text.match(/(\d{1,3}(?:,\d{3})*(?:\.\d+)?|\d+(?:\.\d+)?)\s*(?:to|-|–)\s*(\d{1,3}(?:,\d{3})*(?:\.\d+)?|\d+(?:\.\d+)?)/i);
  if (range) {
    const min = parseJobSalaryMoneyNumber(range[1]);
    const max = parseJobSalaryMoneyNumber(range[2]);
    return {
      currency,
      min: Number.isFinite(min) ? String(min) : range[1].replace(/,/g, ''),
      max: Number.isFinite(max) ? String(max) : range[2].replace(/,/g, ''),
    };
  }
  const single = text.match(/(\d{1,3}(?:,\d{3})*(?:\.\d+)?|\d+(?:\.\d+)?)\s*(k|lpa|lakh|l)?\b/i);
  if (single) {
    const parsed = parseJobSalaryMoneyNumber(`${single[1]}${single[2] || ''}`);
    return {
      currency,
      min: Number.isFinite(parsed) ? String(parsed) : single[1].replace(/,/g, ''),
      max: '',
    };
  }
  return { currency, min: '', max: '' };
}

export function inferSalaryFromNaturalPrompt(prompt: string): string {
  const labeled = extractLabeledPromptValue(prompt, ['salary', 'compensation', 'ctc', 'pay', 'package']);
  if (labeled) return labeled;
  const patterns = [
    /salary\s+(?:is\s+)?(\d+\s*k\s*(?:to|-|–)\s*\d+\s*k)/i,
    /(\d+\s*k\s*(?:to|-|–)\s*\d+\s*k)/i,
  ];
  for (const pattern of patterns) {
    const match = prompt.match(pattern);
    if (match?.[1]) return match[1].trim();
  }
  return '';
}

export function inferCityFromNaturalPrompt(prompt: string): string {
  const labeled = extractLabeledPromptValue(prompt, ['location', 'job location', 'work location', 'city']);
  if (labeled) {
    const parsed = parseJobLocationFromText(labeled);
    return parsed.city || labeled.split(',')[0]?.trim() || '';
  }
  const inCity = prompt.match(
    /\bin\s+([A-Za-z][A-Za-z\s]{1,40}?)(?:\s*,|\s+for\s+|\s+with\s+|\s+salary|\s+only\s+for|,|$)/i,
  );
  if (inCity?.[1]) {
    const candidate = inCity[1].trim();
    if (!/^(india|the|a|an|only)$/i.test(candidate)) return candidate;
  }
  return '';
}

export function parseJobPromptHints(prompt: string, clients: BackendClient[]): JobPromptHints {
  const hints = emptyJobPromptHints();
  hints.jobTitle = inferJobTitleFromPrompt(prompt);

  const openingsRaw = extractLabeledPromptValue(prompt, [
    'openings',
    'number of openings',
    'vacancies',
    'no of openings',
  ]);
  if (openingsRaw) {
    const num = openingsRaw.match(/\d+/)?.[0];
    hints.openings = num || openingsRaw;
  }

  hints.companyName = extractLabeledPromptValue(prompt, ['company', 'client', 'employer']);
  hints.companyId = resolveClientIdByCompanyName(hints.companyName, clients);
  hints.nationality = extractLabeledPromptValue(prompt, ['nationality']);
  if (!hints.nationality && /\b(?:only\s+for\s+)?India\b/i.test(prompt)) hints.nationality = 'Indian';
  hints.industryType = extractLabeledPromptValue(prompt, ['industry', 'industry type', 'domain']);

  hints.location = extractLabeledPromptValue(prompt, ['location', 'job location', 'work location']);
  if (!hints.location) {
    const inferredCity = inferCityFromNaturalPrompt(prompt);
    if (inferredCity) hints.location = inferredCity;
  }
  if (hints.location) {
    const parsed = parseJobLocationFromText(hints.location);
    hints.city = parsed.city;
    hints.state = parsed.state;
    hints.country = parsed.country;
    hints.workMode = parsed.workMode;
    hints.location = parsed.jobLocation;
  }

  if (!hints.city) {
    const inferredCity = inferCityFromNaturalPrompt(prompt);
    if (inferredCity) hints.city = inferredCity;
  }
  if (!hints.country && /\b(?:only\s+for\s+)?India\b/i.test(prompt)) hints.country = 'India';
  if (!hints.country && /\bUnited States\b|\bUSA\b|\bUS\b/i.test(prompt)) hints.country = 'United States';
  if (hints.city && hints.country && !hints.location) {
    hints.location = [hints.city, hints.state, hints.country].filter(Boolean).join(', ');
  }

  hints.salary =
    extractLabeledPromptValue(prompt, ['salary', 'compensation', 'ctc', 'pay']) ||
    inferSalaryFromNaturalPrompt(prompt);
  const salaryParts = parseSalaryHint(hints.salary, prompt);
  hints.salaryCurrency = salaryParts.currency;
  hints.payRangeMin = salaryParts.min;
  hints.payRangeMax = salaryParts.max;
  hints.qualification = extractLabeledPromptValue(prompt, ['requirements', 'qualification', 'education']);
  hints.employmentType = normalizeEmploymentTypeValue(
    extractLabeledPromptValue(prompt, ['employment type', 'job type', 'engagement type']),
  );

  const experienceLine = extractLabeledPromptValue(prompt, ['experience', 'exp']);
  const experience = parseExperienceRangeYears(experienceLine);
  hints.minExperienceYears = experience.min;
  hints.maxExperienceYears = experience.max;

  const skillsLine = extractLabeledPromptValue(prompt, ['skills', 'skill set', 'tech stack']);
  if (skillsLine) {
    hints.skills = skillsLine
      .split(/[,;|]/)
      .map((skill) => skill.trim())
      .filter(Boolean);
  }

  const labeledHireDate = extractLabeledPromptValue(prompt, [
    'target hire date',
    'hire date',
    'expected closure',
    'closing date',
  ]);
  hints.targetHireDate = labeledHireDate ? parseTargetHireDateValue(labeledHireDate) : '';

  if (!hints.workMode) hints.workMode = inferWorkModeFromText(prompt);

  return hints;
}

export function buildPlainJobDescriptionHtml(hints: JobPromptHints, prompt: string): string {
  const responsibilities = extractLabeledPromptValue(prompt, ['responsibilities', 'responsibility']);
  const requirements = extractLabeledPromptValue(prompt, ['requirements', 'requirement', 'qualifications']);
  const benefits = extractLabeledPromptValue(prompt, ['benefits', 'benefit']);
  const sections: string[] = [];

  if (hints.jobTitle) {
    sections.push(`<h2>${hints.jobTitle}</h2>`);
  }
  if (hints.companyName) {
    sections.push(`<p><strong>Company:</strong> ${hints.companyName}</p>`);
  }
  if (hints.location || hints.country) {
    const locationText = [hints.city, hints.state, hints.country].filter(Boolean).join(', ') || hints.location;
    sections.push(`<p><strong>Location:</strong> ${locationText}${hints.workMode ? ` (${hints.workMode})` : ''}</p>`);
  }
  if (hints.salary) {
    sections.push(`<p><strong>Compensation:</strong> ${hints.salary}</p>`);
  }
  if (responsibilities) {
    sections.push(`<h3>Key Responsibilities</h3><p>${responsibilities}</p>`);
  }
  if (requirements) {
    sections.push(`<h3>Requirements</h3><p>${requirements}</p>`);
  }
  if (benefits) {
    sections.push(`<h3>Benefits</h3><p>${benefits}</p>`);
  }
  if (hints.skills.length) {
    sections.push(`<h3>Skills</h3><ul>${hints.skills.map((skill) => `<li>${skill}</li>`).join('')}</ul>`);
  }

  return sections.join('\n');
}

export interface CreateJobDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onJobCreated?: () => void;
  jobId?: string;
  duplicateFromJobId?: string | null;
  onJobUpdated?: (jobId: string) => void | Promise<void>;
  /** When opening “Add job” from a client, pre-select this client (company) in the form */
  defaultClientId?: string | null;
  /** Standalone: pre-fill job fields from an approved team request */
  prefillFromRequest?: TeamRequestJobPrefill | null;
}

export interface AccordionSection {
  id: 'details' | 'application' | 'publish';
  label: string;
  isOpen: boolean;
}

export const DEFAULT_JOB_DRAWER_ACCORDIONS: AccordionSection[] = [
  { id: 'details', label: 'Job Details', isOpen: true },
  { id: 'application', label: 'Job Application Form', isOpen: false },
  { id: 'publish', label: 'Publish & Share', isOpen: false },
];

export type CreateJobWizardStep = 'client' | 'jd' | 'details' | 'application' | 'publish';

export const CREATE_JOB_WIZARD_STEPS: { id: CreateJobWizardStep; label: string }[] = [
  { id: 'client', label: 'Client' },
  { id: 'jd', label: 'Upload JD' },
  { id: 'details', label: 'Job Form' },
  { id: 'application', label: 'Application' },
  { id: 'publish', label: 'Publish' },
];

export const CREATE_JOB_EDIT_WIZARD_STEPS: { id: CreateJobWizardStep; label: string }[] = [
  { id: 'details', label: 'Job Details' },
  { id: 'application', label: 'Application' },
  { id: 'publish', label: 'Publish' },
];

export const CREATE_JOB_WIZARD_HINTS: Record<CreateJobWizardStep, string> = {
  client: 'Step 1 — select your own company or a client for this job',
  jd: 'Step 2 — upload a JD to auto-fill fields',
  details: 'Step 3 — review and edit the complete job form',
  application: 'Application form and pre-screen',
  publish: 'Publish and share this job',
};

export const CREATE_JOB_OAUTH_DRAFT_KEY = 'create_job_drawer_oauth_draft_v1';

export type CreateJobOauthDraft = {
  formData: Record<string, unknown>;
  linkedInPostText: string;
  linkedInPostTextTouched: boolean;
  linkedInImageUrl?: string;
  twitterPostTextTouched: boolean;
  selectedLinkedInTargets: string[];
  selectedTwitterTargets: string[];
  applicationApplyUrl: string;
  skillInput: string;
  aiDraftData?: AiDraftData;
  savedAt: number;
};

export function saveCreateJobOauthDraft(draft: Omit<CreateJobOauthDraft, 'savedAt'>) {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(
      CREATE_JOB_OAUTH_DRAFT_KEY,
      JSON.stringify({ ...draft, savedAt: Date.now() } satisfies CreateJobOauthDraft),
    );
    sessionStorage.setItem('oauth_navigation', '1');
    sessionStorage.setItem('reopen_create_job_drawer', '1');
  } catch (err) {
    console.warn('Failed to persist create-job draft before OAuth:', err);
  }
}

export function peekCreateJobOauthDraft(): CreateJobOauthDraft | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(CREATE_JOB_OAUTH_DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CreateJobOauthDraft;
    if (!parsed?.formData || typeof parsed.formData !== 'object') return null;
    // Ignore drafts older than 2 hours
    if (parsed.savedAt && Date.now() - parsed.savedAt > 2 * 60 * 60 * 1000) {
      sessionStorage.removeItem(CREATE_JOB_OAUTH_DRAFT_KEY);
      return null;
    }
    return parsed;
  } catch {
    sessionStorage.removeItem(CREATE_JOB_OAUTH_DRAFT_KEY);
    return null;
  }
}

export function clearCreateJobOauthDraft() {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(CREATE_JOB_OAUTH_DRAFT_KEY);
}

export interface AiDescriptionSection {
  heading: string;
  paragraphs: string[];
  items: string[];
}

export interface AiChatMessage {
  id: string;
  role: 'ai' | 'user';
  content: string;
}

export interface AiDraftData {
  originalPrompt: string;
  jobTitle: string;
  openings: string;
  companyId: string;
  location: string;
  salary: string;
  qualification: string;
  workMode: string;
}
