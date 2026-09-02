'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { DetailsModalShell } from './DetailsModalShell';
import {
  X,
  Plus,
  Check,
  Upload,
  Info,
  Linkedin,
  Twitter,
  Facebook,
  ExternalLink,
  AlertCircle,
  User,
  SendHorizontal,
  Send,
  Sparkles,
  ArrowUp,
  ArrowLeft,
  ArrowRight,
  FileText,
  Loader2,
  GripHorizontal,
  Briefcase,
  Building2,
  Home,
  Share2,
  Users,
} from 'lucide-react';
import { RichTextEditor } from '../RichTextEditor';
import {
  apiCreateJob,
  apiUpdateJob,
  apiGetJob,
  getJobPreScreenAssessments,
  apiGetClients,
  apiGetWorkspaceClient,
  apiGetClient,
  apiGetContacts,
  apiGenerateJobDescription,
  apiGenerateJobFromPrompt,
  apiProcessJobCreationPipeline,
  type JobCreationPipelineResult,
  apiUploadJobFile,
  filesApiUpload,
  apiPublishSocialJob,
  apiGetSocialStatus,
  apiConnectIntegration,
  apiDisconnectIntegration,
  apiGetJobApplyLink,
  apiListLinkedInPostTemplates,
  type SocialPublishingAccount,
  getTenantDbName,
  getCachedOrgRecruitmentMode,
  isOwnCompanyWorkspaceClient,
  type CreateJobData,
  type BackendClient,
  type BackendContact,
  type BackendUser,
} from '../../lib/api';
import { getAllTeamMembersForAssign, getLineManagersForJobPicker, linkTeamRequestToJob, teamMembersToBackendUsers } from '../../lib/api/teamApi';
import { assigneeCompanyId, formatAssigneeDisplayName } from '../../lib/assigneeDisplay';
import type { TeamRequestJobPrefill } from '../../types/team';
import { WhatsAppIcon } from '../icons/WhatsAppIcon';
import { LinkedInPostPreview } from '../LinkedInPostPreview';
import { TwitterPostPreview } from '../TwitterPostPreview';
import { SocialAccountPicker } from '../SocialAccountPicker';
import {
  buildCandidatePortalApplyUrlPreview,
  replaceApplyUrlInSocialPostText,
  buildLinkedInJobPost,
  buildTwitterJobPost,
  buildFacebookJobPost,
  LINKEDIN_POST_MAX_LENGTH,
  type JobSocialPostInput,
} from '../../lib/jobSocialPost';
import { useLinkedIn } from '../../hooks/useLinkedIn';
import { requestError, requestInfo, requestWarning } from '../../lib/appDialog';
import { clampDateTimeLocalToMin, getLocalDateTimeInputMinNow } from '../../utils/dateInputConstraints';
import { CreateJobDetailsForm, type CreateJobDetailsFormData } from './CreateJobDetailsForm';
import {
  customJdSectionsToHtml,
  extractAdditionalJdSectionsFromHtml,
  mergeCustomJdSections,
  mergeDescriptionWithCustomJdSections,
  type JobCustomJdSection,
} from '../../lib/jobCustomJdSections';
import { usePageDrawerLifecycle } from '../../lib/pageDrawerEvents';
import { useDrawerUnsavedGuard } from '../../hooks/useDrawerUnsavedGuard';
import { normalizeJobSalaryCurrency } from '../../constants/jobSalary';
import { getCachedOrgDefaultCurrency } from '../../lib/api';
import { loadJobVisibilityUserDefaults, visibilityDefaultsForNewJob, jobVisibilityDefaultsEqual } from '../../lib/jobVisibilityUserDefaults';
import { filterClientsForAddJob } from '../../lib/recruitmentClients';
import { dedupeByCompanyName, normalizeCompanyNameKey } from '../../lib/companyNameKey';
import {
  getStoredTenantCompanyName,
  resolveAddJobWorkspaceLabel,
  useOrgWorkspace,
} from '../../lib/org/useOrgWorkspace';
import { DocumentUploadButton, useDocumentUploadFeedback } from '../import/documentUploadUi';
import { ApplicationFormBuilderModal } from '../jobs/ApplicationFormBuilderModal';
import { LinkedInPostTemplateModal } from '../jobs/LinkedInPostTemplateModal';
import { PreScreenAssessmentSection } from '../jobs/PreScreenAssessmentSection';
import type { JobPreScreenAssessmentLink } from '../../lib/preScreenAssessmentTypes';
import {
  defaultApplicationFormSchema,
  normalizeApplicationFormSchema,
  type ApplicationFormSchema,
} from '../../lib/applicationFormTypes';
import {
  applyDefaultLinkedInPostTemplate,
  normalizeLinkedInPostTemplateSchema,
  parseLinkedInPostTemplateList,
  pickDefaultLinkedInPostTemplate,
  subscribeLinkedInTemplateDefaultChanged,
  type JobLinkedInPostTemplate,
  type LinkedInPostTemplateSection,
} from '../../lib/jobLinkedInPostTemplate';
import {
  buildJobContactPersonOptions,
  type JobContactPersonOption,
} from '../../lib/jobClientContacts';
import {
  isJobFieldPubliclyVisible,
  mergeClientVisibility,
  parseJobPublicFieldVisibility,
  buildPublicFieldVisibilityPayload,
} from '../../lib/jobPublicFieldVisibility';
import {
  DrawerSectionCard,
  DRAWER_FORM_HEADER_CLASS,
  DRAWER_FORM_SCROLL_BG,
} from './drawerFormUi';

type ApplicationLogoOption = 'account' | 'company' | 'none' | 'custom';

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

const SCREENING_TYPE_OPTIONS: { value: ScreeningQuestionType; label: string; hint: string }[] = [
  { value: 'short_text', label: 'Short text', hint: 'Open answer (single line)' },
  { value: 'yes_no', label: 'Yes / No', hint: 'Two-option toggle' },
  { value: 'single_choice', label: 'Multiple choice', hint: 'Pick one from your options' },
  { value: 'slider', label: 'Proficiency slider', hint: 'Slider scale (e.g. Beginner → Expert)' },
];

function generateScreeningQuestionId() {
  return `q_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
}

/** Parse a stored question. Legacy plain strings become a `short_text` question. */
function parseScreeningQuestion(raw: string | ScreeningQuestion | null | undefined): ScreeningQuestion | null {
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

function parseScreeningQuestionList(raw: unknown): ScreeningQuestion[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((entry) => parseScreeningQuestion(entry as string | ScreeningQuestion))
    .filter((q): q is ScreeningQuestion => Boolean(q && q.label));
}

/** Convert an editor question to the on-disk JSON-string form expected by the backend `String[]` column. */
function serializeScreeningQuestion(q: ScreeningQuestion): string {
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

function makeShortTextScreeningQuestion(label: string): ScreeningQuestion {
  return {
    id: generateScreeningQuestionId(),
    type: 'short_text',
    label: label.trim(),
    required: false,
  };
}

function extractLabeledPromptValue(text: string, labels: string[]): string {
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

function extractJobSectionTextFromHtml(html: string, sectionTitle: string): string {
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

function hydrateJobListFieldsFromPipelineResult(data: JobCreationPipelineResult): {
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

function inferJobTitleFromPrompt(prompt: string): string {
  const labeled = extractLabeledPromptValue(prompt, ['role', 'job title', 'position']);
  if (labeled) return labeled;

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
      return match[1].trim().replace(/[.!,]$/, '');
    }
  }

  return '';
}

function inferWorkModeFromText(text: string): string {
  const normalized = text.toLowerCase();
  if (normalized.includes('hybrid')) return 'Hybrid';
  if (normalized.includes('remote')) return 'Remote';
  if (normalized.includes('on-site') || normalized.includes('onsite')) return 'On-site';
  return '';
}

function parseJobLocationFromText(location: string) {
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

function parseExperienceRangeYears(text: string): { min?: number; max?: number } {
  if (!text.trim()) return {};
  const range = text.match(/(\d+)\s*(?:to|-|–)\s*(\d+)/i);
  if (range) return { min: Number(range[1]), max: Number(range[2]) };
  const plus = text.match(/(\d+)\s*\+\s*years?/i);
  if (plus) return { min: Number(plus[1]) };
  const years = text.match(/(\d+)\s*years?/i);
  if (years) return { min: Number(years[1]) };
  return {};
}

function normalizeCompanyMatchKey(name: string): string {
  return normalizeCompanyNameKey(name);
}

function resolveClientIdByCompanyName(name: string, clients: BackendClient[]): string {
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

function defaultTargetHireDateIso(): string {
  const date = new Date();
  date.setDate(date.getDate() + 30);
  return date.toISOString().slice(0, 10);
}

function parseTargetHireDateValue(raw: string): string {
  const isoMatch = raw.match(/\d{4}-\d{2}-\d{2}/);
  if (isoMatch) return isoMatch[0];
  const parsed = Date.parse(raw);
  if (!Number.isNaN(parsed)) return new Date(parsed).toISOString().slice(0, 10);
  return '';
}

/** Parse stored `experienceRequired` (e.g. `2-8`, `3`, `3-`) into numeric form strings. */
function parseExperienceRequiredForForm(experienceRequired?: string | null): {
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

function emptyJobPromptHints(): JobPromptHints {
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

function normalizeEmploymentTypeValue(value: string): string {
  const normalized = String(value || '').toLowerCase();
  if (!normalized) return '';
  if (normalized.includes('part')) return 'Part Time';
  if (normalized.includes('contract')) return 'Contract';
  if (normalized.includes('intern')) return 'Internship';
  if (normalized.includes('freelance')) return 'Freelance';
  if (normalized.includes('full')) return 'Full Time';
  return '';
}

function parseSalaryHint(raw: string, contextText = ''): { currency: string; min: string; max: string } {
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

  const currencyMatch = text.match(/\b(INR|USD|EUR|GBP|AED|SAR|CAD|AUD)\b/i);
  const currency = normalizeJobSalaryCurrency(currencyMatch?.[1] || '');
  const range = text.match(/(\d+(?:\.\d+)?)\s*(?:to|-|–)\s*(\d+(?:\.\d+)?)/i);
  if (range) {
    return { currency, min: range[1], max: range[2] };
  }
  const single = text.match(/(\d+(?:\.\d+)?)/);
  if (single) {
    return { currency, min: single[1], max: '' };
  }
  return { currency, min: '', max: '' };
}

function inferSalaryFromNaturalPrompt(prompt: string): string {
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

function inferCityFromNaturalPrompt(prompt: string): string {
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

function parseJobPromptHints(prompt: string, clients: BackendClient[]): JobPromptHints {
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

function buildPlainJobDescriptionHtml(hints: JobPromptHints, prompt: string): string {
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

interface AccordionSection {
  id: 'details' | 'application' | 'publish';
  label: string;
  isOpen: boolean;
}

const DEFAULT_JOB_DRAWER_ACCORDIONS: AccordionSection[] = [
  { id: 'details', label: 'Job Details', isOpen: true },
  { id: 'application', label: 'Job Application Form', isOpen: false },
  { id: 'publish', label: 'Publish & Share', isOpen: false },
];

type CreateJobWizardStep = 'client' | 'jd' | 'details' | 'application' | 'publish';

const CREATE_JOB_WIZARD_STEPS: { id: CreateJobWizardStep; label: string }[] = [
  { id: 'client', label: 'Client' },
  { id: 'jd', label: 'Upload JD' },
  { id: 'details', label: 'Job Form' },
  { id: 'application', label: 'Application' },
  { id: 'publish', label: 'Publish' },
];

const CREATE_JOB_EDIT_WIZARD_STEPS: { id: CreateJobWizardStep; label: string }[] = [
  { id: 'details', label: 'Job Details' },
  { id: 'application', label: 'Application' },
  { id: 'publish', label: 'Publish' },
];

const CREATE_JOB_WIZARD_HINTS: Record<CreateJobWizardStep, string> = {
  client: 'Step 1 — select your own company or a client for this job',
  jd: 'Step 2 — upload a JD to auto-fill fields',
  details: 'Step 3 — review and edit the complete job form',
  application: 'Application form and pre-screen',
  publish: 'Publish and share this job',
};

/** Survives LinkedIn / X / Facebook OAuth full-page redirects from the create-job drawer. */
const CREATE_JOB_OAUTH_DRAFT_KEY = 'create_job_drawer_oauth_draft_v1';

type CreateJobOauthDraft = {
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

function saveCreateJobOauthDraft(draft: Omit<CreateJobOauthDraft, 'savedAt'>) {
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

function peekCreateJobOauthDraft(): CreateJobOauthDraft | null {
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

function clearCreateJobOauthDraft() {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(CREATE_JOB_OAUTH_DRAFT_KEY);
}
interface AiDescriptionSection {
  heading: string;
  paragraphs: string[];
  items: string[];
}

interface AiChatMessage {
  id: string;
  role: 'ai' | 'user';
  content: string;
}

interface AiDraftData {
  originalPrompt: string;
  jobTitle: string;
  openings: string;
  companyId: string;
  location: string;
  salary: string;
  qualification: string;
  workMode: string;
}

export function CreateJobDrawer({
  isOpen,
  onClose,
  onJobCreated,
  jobId,
  duplicateFromJobId = null,
  onJobUpdated,
  defaultClientId = null,
  prefillFromRequest = null,
}: CreateJobDrawerProps) {
  usePageDrawerLifecycle(isOpen);
  const {
    panelRef: createJobPanelRef,
    requestClose: requestCreateJobClose,
    markClean: markCreateJobClean,
  } = useDrawerUnsavedGuard<HTMLDivElement>({
    isOpen,
    onClose,
  });
  const isEditMode = !!jobId;
  const isDuplicateMode = !jobId && !!duplicateFromJobId;
  const isStandaloneMode = getCachedOrgRecruitmentMode() === 'standalone';
  const useLineManagerPicker = (isStandaloneMode || !!prefillFromRequest) && !isEditMode;
  const {
    hasCompanies,
    orgUnitName,
    orgUnitId,
    homeIsOrgCompany,
  } = useOrgWorkspace();
  const [loading, setLoading] = useState(false);
  const [loadingJob, setLoadingJob] = useState(false);
  const [clients, setClients] = useState<BackendClient[]>([]);
  const [loadingClients, setLoadingClients] = useState(false);
  const [users, setUsers] = useState<BackendUser[]>([]);
  const [lineManagers, setLineManagers] = useState<BackendUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [loadingLineManagers, setLoadingLineManagers] = useState(false);
  const [contacts, setContacts] = useState<JobContactPersonOption[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [showAiPromptBox, setShowAiPromptBox] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiDrawerError, setAiDrawerError] = useState('');
  const [aiDetectedRole, setAiDetectedRole] = useState('');
  const [aiGeneratedDescription, setAiGeneratedDescription] = useState('');
  const [aiGeneratedQualification, setAiGeneratedQualification] = useState('');
  const [aiGeneratedSpecialization, setAiGeneratedSpecialization] = useState('');
  const [aiGeneratedQuestions, setAiGeneratedQuestions] = useState<string[]>([]);
  const [aiQuestionStep, setAiQuestionStep] = useState<'initial' | 'openings' | 'company' | 'location' | 'salary' | 'qualification' | 'done'>('initial');
  const [aiMessages, setAiMessages] = useState<AiChatMessage[]>([]);
  const aiConversationEndRef = useRef<HTMLDivElement | null>(null);

  const [smartJobPrompt, setSmartJobPrompt] = useState('');
  const [smartJobPromptVisible, setSmartJobPromptVisible] = useState(true);
  const [smartFillPanelHeight, setSmartFillPanelHeight] = useState(148);
  const smartJobPromptBoundsRef = useRef<HTMLDivElement>(null);
  const smartJobPromptBoxRef = useRef<HTMLDivElement>(null);
  const smartFillResizeRef = useRef<{ startY: number; startHeight: number } | null>(null);

  const SMART_FILL_MIN_HEIGHT = 120;
  const SMART_FILL_MAX_HEIGHT = 520;

  const beginSmartFillResize = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    smartFillResizeRef.current = {
      startY: event.clientY,
      startHeight: smartFillPanelHeight,
    };

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!smartFillResizeRef.current) return;
      const deltaY = smartFillResizeRef.current.startY - moveEvent.clientY;
      const nextHeight = Math.min(
        SMART_FILL_MAX_HEIGHT,
        Math.max(SMART_FILL_MIN_HEIGHT, smartFillResizeRef.current.startHeight + deltaY),
      );
      setSmartFillPanelHeight(nextHeight);
    };

    const handleMouseUp = () => {
      smartFillResizeRef.current = null;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }, [smartFillPanelHeight]);
  const [smartJobError, setSmartJobError] = useState('');
  const [smartJobFileText, setSmartJobFileText] = useState('');
  const [pastedJobDescriptionText, setPastedJobDescriptionText] = useState('');
  const [smartJobAttachment, setSmartJobAttachment] = useState<{
    file: File;
    status: 'processing' | 'ready' | 'error';
    error?: string;
  } | null>(null);
  const [pipelineDetectedCompanyName, setPipelineDetectedCompanyName] = useState('');
  const smartJobFileInputRef = useRef<HTMLInputElement | null>(null);
  const smartJobPipelineAbortRef = useRef<AbortController | null>(null);
  const [aiDraftData, setAiDraftData] = useState<AiDraftData>({
    originalPrompt: '',
    jobTitle: '',
    openings: '',
    companyId: '',
    location: '',
    salary: '',
    qualification: '',
    workMode: '',
  });
  const [linkedInPostText, setLinkedInPostText] = useState('');
  const [linkedInPostTextTouched, setLinkedInPostTextTouched] = useState(false);
  const [linkedInImageUrl, setLinkedInImageUrl] = useState('');
  const [uploadingLinkedInImage, setUploadingLinkedInImage] = useState(false);
  const linkedInImageUploadFeedback = useDocumentUploadFeedback(uploadingLinkedInImage);
  const [twitterPostTextTouched, setTwitterPostTextTouched] = useState(false);
  const [facebookCaptionTouched, setFacebookCaptionTouched] = useState(false);
  const [applicationApplyUrl, setApplicationApplyUrl] = useState('');
  const [applicationApplyUrlLoading, setApplicationApplyUrlLoading] = useState(false);
  const [showLinkedInSuccess, setShowLinkedInSuccess] = useState(false);
  const [linkedInPostUrl, setLinkedInPostUrl] = useState<string | null>(null);
  const [showFormBuilder, setShowFormBuilder] = useState(false);
  const [showLinkedInTemplateModal, setShowLinkedInTemplateModal] = useState(false);
  const [selectedLinkedInTemplateId, setSelectedLinkedInTemplateId] = useState<string | null>(null);
  const [selectedLinkedInTemplateName, setSelectedLinkedInTemplateName] = useState<string | null>(null);
  const [linkedInPostSections, setLinkedInPostSections] = useState<LinkedInPostTemplateSection[] | null>(
    null,
  );
  const [linkedinAccounts, setLinkedinAccounts] = useState<SocialPublishingAccount[]>([]);
  const [twitterAccounts, setTwitterAccounts] = useState<SocialPublishingAccount[]>([]);
  const [selectedLinkedInTargets, setSelectedLinkedInTargets] = useState<string[]>([]);
  const [selectedTwitterTargets, setSelectedTwitterTargets] = useState<string[]>([]);
  const [socialStatusLoading, setSocialStatusLoading] = useState(false);
  const [disconnectingLinkedInId, setDisconnectingLinkedInId] = useState<string | null>(null);
  const [disconnectingTwitterId, setDisconnectingTwitterId] = useState<string | null>(null);
  const [connectingLinkedIn, setConnectingLinkedIn] = useState(false);

  // LinkedIn integration hook
  const linkedIn = useLinkedIn();

  // Accordion state
  const [accordions, setAccordions] = useState<AccordionSection[]>(DEFAULT_JOB_DRAWER_ACCORDIONS);
  const [wizardStep, setWizardStep] = useState<CreateJobWizardStep>('details');

  // Form state - Section 1: Job Details
  const [formData, setFormData] = useState({
    // Job Details
    nationality: '',
    jobTitle: '',
    priority: 'Medium',
    numberOfOpenings: '1',
    companyId: '',
    showClientNamePublicly: visibilityDefaultsForNewJob().showClientNamePublicly,
    publicFieldVisibility: visibilityDefaultsForNewJob().publicFieldVisibility,
    contactPersonId: '',
    contactPersonName: '',
    industryType: '',
    employmentType: '',
    targetHireDate: '',
    videoMediaLink: '',
    forecastRevenue: '',
    managerId: '',
    languages: [] as { language: string; proficiency: string }[],
    /** Assigned recruiter / owner (User id) */
    assignedToId: '',
    assignedToName: '',
    assignedToCompanyId: '',
    
    // Job Description
    aboutCompany: '',
    jobDescriptionHtml: '',
    jobLocation: '',
    jobType: 'Part Time',
    jobLocationType: '',
    salaryInput: '',
    jobSummary: '',
    keyResponsibilitiesText: '',
    qualificationsExperienceText: '',
    candidateRequirementsText: '',
    compensationBenefitsText: '',
    customJdSections: [] as JobCustomJdSection[],
    minExperience: '',
    maxExperience: '',
    payRangeMin: '',
    payRangeMax: '',
    salaryType: 'Annual Salary',
    currency: normalizeJobSalaryCurrency(getCachedOrgDefaultCurrency()),
    minSalary: '',
    maxSalary: '',
    educationalQualification: '',
    educationalSpecialization: '',
    skills: [] as string[],
    locality: '',
    city: '',
    state: '',
    country: '',
    postalCode: '',
    fullAddress: '',
    
    // Job Application Form
    enableApplicationForm: false,
    logoOption: 'account' as ApplicationLogoOption,
    applicationLogoUrl: '',
    applicationQuestions: [] as ScreeningQuestion[],
    noteForCandidates: '',
    applicationFormSchema: defaultApplicationFormSchema() as ApplicationFormSchema,
    preScreenAssessments: [] as JobPreScreenAssessmentLink[],
    
    // Publish & Share
    linkedInEnabled: false,
    linkedInConnected: false,
    linkedInAccount: null as { name: string; avatar?: string; id: string } | null,
    linkedInPostAs: 'personal' as 'personal' | string,
    linkedInJobTitle: '',
    linkedInDescription: '',
    linkedInApplyMethod: 'linkedin' as 'linkedin' | 'external',
    linkedInExternalUrl: '',
    linkedInWorkplaceType: 'On-site' as 'On-site' | 'Remote' | 'Hybrid',
    linkedInEmploymentType: 'Full-time' as 'Full-time' | 'Part-time' | 'Contract' | 'Temporary' | 'Volunteer' | 'Internship' | 'Other',
    linkedInSeniorityLevel: 'Entry level' as 'Internship' | 'Entry level' | 'Associate' | 'Mid-Senior' | 'Director' | 'Executive',
    linkedInJobFunctions: [] as string[],
    linkedInIndustries: [] as string[],
    linkedInExpiryDate: '',
    
    twitterEnabled: false,
    twitterConnected: false,
    twitterAccountName: '',
    twitterTweetText: '',
    twitterIncludeLogo: true,
    twitterScheduleDate: '',
    
    facebookEnabled: false,
    facebookConnected: false,
    facebookPageId: '',
    facebookCaption: '',
    
    whatsappEnabled: false,
    whatsappPhoneNumber: '',
    whatsappTemplate: '',
    whatsappRecipients: [] as string[],
  });

  const [connectingSocialProvider, setConnectingSocialProvider] = useState<'twitter' | 'facebook' | null>(null);
  const [skillInput, setSkillInput] = useState('');
  // JD file upload state
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [existingOtherDocName, setExistingOtherDocName] = useState('');
  const [uploadingApplicationLogo, setUploadingApplicationLogo] = useState(false);
  const logoUploadFeedback = useDocumentUploadFeedback(uploadingApplicationLogo);
  const applicationLogoInputRef = useRef<HTMLInputElement>(null);
  const [dropdownsOpen, setDropdownsOpen] = useState({
    company: false,
    contact: false,
    manager: false,
    recruiter: false,
    jobType: false,
    locationType: false,
    minExperience: false,
    maxExperience: false,
    salaryType: false,
    currency: false,
    qualification: false,
    linkedInPostAs: false,
    linkedInWorkplaceType: false,
    linkedInEmploymentType: false,
    linkedInSeniorityLevel: false,
    linkedInJobFunctions: false,
    linkedInIndustries: false,
    applicationQuestions: false,
  });

  // Collapse accordion sections whenever the drawer opens (unless restoring OAuth draft → open Publish)
  useEffect(() => {
    if (!isOpen) return;

    const draft = !jobId && !duplicateFromJobId ? peekCreateJobOauthDraft() : null;
    if (draft) {
      setFormData((prev) => ({
        ...prev,
        ...(draft.formData as typeof prev),
      }));
      setLinkedInPostText(String(draft.linkedInPostText || ''));
      setLinkedInPostTextTouched(Boolean(draft.linkedInPostTextTouched));
      setLinkedInImageUrl(String(draft.linkedInImageUrl || ''));
      setTwitterPostTextTouched(Boolean(draft.twitterPostTextTouched));
      setSelectedLinkedInTargets(
        Array.isArray(draft.selectedLinkedInTargets) ? draft.selectedLinkedInTargets : [],
      );
      setSelectedTwitterTargets(
        Array.isArray(draft.selectedTwitterTargets) ? draft.selectedTwitterTargets : [],
      );
      setApplicationApplyUrl(String(draft.applicationApplyUrl || ''));
      setSkillInput(String(draft.skillInput || ''));
      if (draft.aiDraftData) {
        setAiDraftData(draft.aiDraftData);
      }
      setWizardStep('publish');
      setAccordions([
        { id: 'details', label: 'Job Details', isOpen: false },
        { id: 'application', label: 'Job Application Form', isOpen: false },
        { id: 'publish', label: 'Publish & Share', isOpen: true },
      ]);
      const clearTimer = window.setTimeout(() => {
        clearCreateJobOauthDraft();
      }, 0);
      return () => window.clearTimeout(clearTimer);
    }

    setWizardStep(isEditMode || jobId || duplicateFromJobId ? 'details' : 'client');
    setAccordions(DEFAULT_JOB_DRAWER_ACCORDIONS);

    if (isEditMode || jobId || duplicateFromJobId) return undefined;
    const baseline = visibilityDefaultsForNewJob();
    let cancelled = false;
    void loadJobVisibilityUserDefaults().then((defaults) => {
      if (cancelled) return;
      setFormData((prev) => {
        const untouched = jobVisibilityDefaultsEqual(
          prev.publicFieldVisibility,
          baseline.publicFieldVisibility,
          prev.showClientNamePublicly,
          baseline.showClientNamePublicly,
        );
        if (!untouched) return prev;
        return {
          ...prev,
          publicFieldVisibility: defaults.visibility,
          showClientNamePublicly: defaults.showClient,
        };
      });
    });
    return () => {
      cancelled = true;
    };
  }, [isOpen, jobId, duplicateFromJobId, isEditMode]);

  // Reset form when switching between add and edit modes
  useEffect(() => {
    if (!isOpen) {
      // Reset form when drawer closes
      setFormData({
        nationality: '',
        jobTitle: '',
        priority: 'Medium',
        numberOfOpenings: '1',
        companyId: '',
        showClientNamePublicly: visibilityDefaultsForNewJob().showClientNamePublicly,
        publicFieldVisibility: visibilityDefaultsForNewJob().publicFieldVisibility,
        contactPersonId: '',
        contactPersonName: '',
        industryType: '',
        employmentType: '',
        targetHireDate: '',
        videoMediaLink: '',
        forecastRevenue: '',
        managerId: '',
        languages: [],
        assignedToId: '',
        assignedToName: '',
        assignedToCompanyId: '',
        aboutCompany: '',
        jobDescriptionHtml: '',
        jobLocation: '',
        jobType: 'Part Time',
        jobLocationType: '',
        salaryInput: '',
        jobSummary: '',
        keyResponsibilitiesText: '',
        qualificationsExperienceText: '',
        candidateRequirementsText: '',
        compensationBenefitsText: '',
        customJdSections: [],
        minExperience: '',
        maxExperience: '',
        payRangeMin: '',
        payRangeMax: '',
        salaryType: 'Annual Salary',
        currency: normalizeJobSalaryCurrency(getCachedOrgDefaultCurrency()),
        minSalary: '',
        maxSalary: '',
        educationalQualification: '',
        educationalSpecialization: '',
        skills: [],
        locality: '',
        city: '',
        state: '',
        country: '',
        postalCode: '',
        fullAddress: '',
        enableApplicationForm: false,
        logoOption: 'account',
        applicationLogoUrl: '',
        applicationQuestions: [],
        noteForCandidates: '',
        applicationFormSchema: defaultApplicationFormSchema(),
        preScreenAssessments: [],
        linkedInEnabled: false,
        linkedInConnected: false,
        linkedInAccount: null,
        linkedInPostAs: 'personal',
        linkedInJobTitle: '',
        linkedInDescription: '',
        linkedInApplyMethod: 'linkedin',
        linkedInExternalUrl: '',
        linkedInWorkplaceType: 'On-site',
        linkedInEmploymentType: 'Full-time',
        linkedInSeniorityLevel: 'Entry level',
        linkedInJobFunctions: [],
        linkedInIndustries: [],
        linkedInExpiryDate: '',
        twitterEnabled: false,
        twitterConnected: false,
        twitterAccountName: '',
        twitterTweetText: '',
        twitterIncludeLogo: true,
        twitterScheduleDate: '',
        facebookEnabled: false,
        facebookConnected: false,
        facebookPageId: '',
        facebookCaption: '',
        whatsappEnabled: false,
        whatsappPhoneNumber: '',
        whatsappTemplate: '',
        whatsappRecipients: [],
      });
      setSkillInput('');
      setUploadedFile(null);
      setExistingOtherDocName('');
      setContacts([]);
      setShowAiPromptBox(false);
      setAiPrompt('');
      setAiDrawerError('');
      setAiDetectedRole('');
      setAiGeneratedDescription('');
      setAiGeneratedQualification('');
      setAiGeneratedSpecialization('');
      setAiGeneratedQuestions([]);
      setAiQuestionStep('initial');
      setAiMessages([]);
      setAiDraftData({
        originalPrompt: '',
        jobTitle: '',
        openings: '',
        companyId: '',
        location: '',
        salary: '',
        qualification: '',
        workMode: '',
      });
      setLinkedInPostText('');
      setLinkedInPostTextTouched(false);
      setLinkedInImageUrl('');
      setUploadingLinkedInImage(false);
      setTwitterPostTextTouched(false);
      setFacebookCaptionTouched(false);
      setApplicationApplyUrl('');
      setApplicationApplyUrlLoading(false);
      setShowLinkedInTemplateModal(false);
      setSelectedLinkedInTemplateId(null);
      setSelectedLinkedInTemplateName(null);
      setLinkedInPostSections(null);
      setLinkedinAccounts([]);
      setTwitterAccounts([]);
      setSelectedLinkedInTargets([]);
      setSelectedTwitterTargets([]);
      setSocialStatusLoading(false);
      setDisconnectingLinkedInId(null);
      setDisconnectingTwitterId(null);
      setConnectingLinkedIn(false);
      setWizardStep('details');
      setAccordions(DEFAULT_JOB_DRAWER_ACCORDIONS);
    }
  }, [isOpen]);

  // Pre-select client when opened from Client drawer (add mode only)
  useEffect(() => {
    if (!isOpen || jobId || duplicateFromJobId) return;
    if (defaultClientId) {
      setFormData((prev) => (prev.companyId ? prev : { ...prev, companyId: defaultClientId }));
    }
  }, [isOpen, defaultClientId, jobId, duplicateFromJobId]);

  useEffect(() => {
    if (!isOpen || jobId || duplicateFromJobId || !prefillFromRequest) return;

    const priorityMap: Record<string, string> = {
      high: 'High',
      medium: 'Medium',
      low: 'Low',
    };
    const subject = String(prefillFromRequest.subject || '').trim();
    const description = String(prefillFromRequest.description || '').trim();
    const priority = priorityMap[String(prefillFromRequest.priority || 'medium').toLowerCase()] || 'Medium';
    const summaryParts = [
      description,
      prefillFromRequest.requestedByName
        ? `Requested by ${prefillFromRequest.requestedByName}.`
        : '',
    ].filter(Boolean);

    setFormData((prev) => ({
      ...prev,
      jobTitle: subject || prev.jobTitle,
      jobSummary: summaryParts.join('\n\n'),
      keyResponsibilitiesText: description || prev.keyResponsibilitiesText,
      priority,
      jobDescriptionHtml: subject
        ? `<h2>${subject}</h2>${description ? `<p>${description.replace(/\n/g, '</p><p>')}</p>` : ''}`
        : prev.jobDescriptionHtml,
    }));
    setAccordions((prev) =>
      prev.map((section) =>
        section.id === 'details' ? { ...section, isOpen: true } : section,
      ),
    );

    if (prefillFromRequest.requestedById) {
      setFormData((prev) =>
        prev.managerId ? prev : { ...prev, managerId: prefillFromRequest.requestedById || '' },
      );
    }
  }, [isOpen, jobId, duplicateFromJobId, prefillFromRequest]);

  useEffect(() => {
    if (!isOpen || !formData.companyId) {
      setContacts([]);
      return;
    }

    let cancelled = false;
    const loadContacts = async () => {
      try {
        setLoadingContacts(true);
        const clientId = formData.companyId;
        const [contactsResponse, clientResponse] = await Promise.all([
          apiGetContacts({ clientId, type: 'CLIENT' }),
          apiGetClient(clientId).catch(() => null),
        ]);
        const raw = (contactsResponse as { data?: unknown }).data;
        const list = Array.isArray(raw)
          ? raw
          : raw && typeof raw === 'object' && Array.isArray((raw as { data?: unknown }).data)
            ? (raw as { data: unknown[] }).data
            : [];
        if (cancelled) return;
        const client =
          clientResponse && typeof clientResponse === 'object' && 'id' in clientResponse
            ? (clientResponse as BackendClient)
            : null;
        setContacts(
          buildJobContactPersonOptions(list as BackendContact[], client),
        );
      } catch {
        if (!cancelled) setContacts([]);
      } finally {
        if (!cancelled) setLoadingContacts(false);
      }
    };

    void loadContacts();
    return () => {
      cancelled = true;
    };
  }, [isOpen, formData.companyId]);

  // Load data on mount
  useEffect(() => {
    if (isOpen) {
      const loadData = async () => {
        const lineManagerSeed = prefillFromRequest?.requestedById;
        await Promise.all([
          loadClients(),
          loadUsers(),
          useLineManagerPicker ? loadLineManagers(lineManagerSeed) : Promise.resolve(),
          loadSocialStatus(),
        ]);
        if (jobId || duplicateFromJobId) {
          await loadJobData(jobId || duplicateFromJobId || undefined);
        }
      };
      void loadData();
    }
  }, [isOpen, jobId, duplicateFromJobId, useLineManagerPicker, prefillFromRequest?.requestedById]);

  const applyLinkedInTemplate = useCallback((template: JobLinkedInPostTemplate, persistDefault = true) => {
    const schema = normalizeLinkedInPostTemplateSchema(template.schema);
    setSelectedLinkedInTemplateId(template.id);
    setSelectedLinkedInTemplateName(template.name);
    setLinkedInPostSections(schema.sections);
    if (persistDefault) applyDefaultLinkedInPostTemplate(template);
    setLinkedInPostTextTouched(false);
    setTwitterPostTextTouched(false);
    setFacebookCaptionTouched(false);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    void apiListLinkedInPostTemplates()
      .then((res) => {
        if (cancelled) return;
        const match = pickDefaultLinkedInPostTemplate(parseLinkedInPostTemplateList(res));
        if (!match) {
          setSelectedLinkedInTemplateId(null);
          setSelectedLinkedInTemplateName(null);
          setLinkedInPostSections(null);
          return;
        }
        applyLinkedInTemplate(match, false);
      })
      .catch(() => {
        /* no saved templates — social posts follow Public Visibility */
      });
    const unsubscribe = subscribeLinkedInTemplateDefaultChanged((template) => {
      if (cancelled) return;
      if (!template) {
        setSelectedLinkedInTemplateId(null);
        setSelectedLinkedInTemplateName(null);
        setLinkedInPostSections(null);
        return;
      }
      applyLinkedInTemplate(template, false);
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [isOpen, applyLinkedInTemplate]);

  const mapIntegrationAccounts = useCallback(
    (accounts: Array<Record<string, unknown>> = []): SocialPublishingAccount[] =>
      accounts.map((account) => ({
        id: String(account.id || ''),
        key: String(account.key || account.id || ''),
        name: String(account.name || account.accountName || 'Account'),
        type: account.type === 'page' ? 'page' : 'personal',
        picture: (account.picture as string | null | undefined) || null,
        accountEmail: (account.accountEmail as string | null | undefined) || null,
        connected: account.connected !== false,
        expired: !!account.expired,
        organizationId: account.organizationId ? String(account.organizationId) : undefined,
        parentAccountId: account.parentAccountId ? String(account.parentAccountId) : undefined,
      })),
    [],
  );

  const getConnectedAccountKeys = useCallback(
    (accounts: SocialPublishingAccount[]) =>
      accounts.filter((account) => account.connected !== false).map((account) => account.key),
    [],
  );

  const loadSocialStatus = async () => {
    try {
      setSocialStatusLoading(true);
      await linkedIn.refreshStatus();
      const response = await apiGetSocialStatus();
      const nextLinkedinAccounts = mapIntegrationAccounts(response.data.linkedin.accounts || []);
      const nextTwitterAccounts = mapIntegrationAccounts(response.data.twitter.accounts || []);
      const twitterConnected = response.data.twitter.connected;
      const linkedInConnected = response.data.linkedin.connected;
      const linkedinKeys = getConnectedAccountKeys(nextLinkedinAccounts);
      const twitterKeys = getConnectedAccountKeys(nextTwitterAccounts);

      setLinkedinAccounts(nextLinkedinAccounts);
      setTwitterAccounts(nextTwitterAccounts);
      setSelectedLinkedInTargets(
        !jobId ? linkedinKeys : (prev) => prev.filter((key) => linkedinKeys.includes(key)),
      );
      setSelectedTwitterTargets(
        !jobId ? twitterKeys : (prev) => prev.filter((key) => twitterKeys.includes(key)),
      );

      setFormData((prev) => ({
        ...prev,
        twitterConnected,
        twitterAccountName: response.data.twitter.accountName || '',
        facebookConnected: response.data.facebook.connected,
        ...(!jobId && twitterConnected ? { twitterEnabled: true } : {}),
        ...(!jobId && linkedInConnected ? { linkedInEnabled: true } : {}),
      }));
    } catch (err) {
      console.error('Failed to load social status:', err);
    } finally {
      setSocialStatusLoading(false);
    }
  };

  const handleDisconnectLinkedInAccount = async (accountId: string) => {
    try {
      setDisconnectingLinkedInId(accountId);
      await linkedIn.disconnect(accountId);
      setSelectedLinkedInTargets((prev) =>
        prev.filter((key) => !linkedinAccounts.some((account) => account.id === accountId && account.key === key)),
      );
      await loadSocialStatus();
    } catch (err) {
      console.error('Failed to disconnect LinkedIn account:', err);
      requestError(err instanceof Error ? err.message : 'Could not disconnect LinkedIn account.');
    } finally {
      setDisconnectingLinkedInId(null);
    }
  };

  const handleDisconnectTwitterAccount = async (connectionId: string) => {
    try {
      setDisconnectingTwitterId(connectionId);
      await apiDisconnectIntegration('twitter', connectionId);
      setSelectedTwitterTargets((prev) => prev.filter((key) => key !== connectionId));
      await loadSocialStatus();
    } catch (err) {
      console.error('Failed to disconnect X account:', err);
      requestError(err instanceof Error ? err.message : 'Could not disconnect X account.');
    } finally {
      setDisconnectingTwitterId(null);
    }
  };

  const handleConnectSocialAccount = async (provider: 'twitter' | 'facebook') => {
    try {
      setConnectingSocialProvider(provider);
      saveCreateJobOauthDraft({
        formData: { ...formData },
        linkedInPostText,
        linkedInPostTextTouched,
        linkedInImageUrl,
        twitterPostTextTouched,
        selectedLinkedInTargets,
        selectedTwitterTargets,
        applicationApplyUrl,
        skillInput,
        aiDraftData,
      });
      sessionStorage.setItem('oauth_provider', provider);
      const returnUrl = `${window.location.origin}${window.location.pathname}${window.location.search}`;
      await apiConnectIntegration(provider, returnUrl, { reopenCreateJobDrawer: true });
    } catch (err) {
      console.error(`Failed to start ${provider} OAuth:`, err);
      requestError(
        err instanceof Error ? err.message : `Could not connect ${provider === 'twitter' ? 'X' : 'Facebook'} account.`,
      );
      setConnectingSocialProvider(null);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    void loadSocialStatus();
  }, [isOpen]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const connected = params.get('integration_connected');
    if (connected === 'twitter' || connected === 'facebook') {
      void loadSocialStatus();
    }
  }, []);

  const effectiveApplyUrl = useMemo(() => {
    const manual = String(formData.linkedInExternalUrl || '').trim();
    if (manual) return manual;
    if (applicationApplyUrl) return applicationApplyUrl;
    return buildCandidatePortalApplyUrlPreview(getTenantDbName());
  }, [formData.linkedInExternalUrl, applicationApplyUrl]);

  const selectedLinkedInPreviewAccount = useMemo(
    () =>
      linkedinAccounts.find((account) => selectedLinkedInTargets.includes(account.key)) ||
      linkedinAccounts[0] ||
      null,
    [linkedinAccounts, selectedLinkedInTargets],
  );

  const selectedTwitterPreviewAccount = useMemo(
    () =>
      twitterAccounts.find((account) => selectedTwitterTargets.includes(account.key)) ||
      twitterAccounts[0] ||
      null,
    [twitterAccounts, selectedTwitterTargets],
  );

  const socialPostInput = useMemo<JobSocialPostInput>(() => {
    const company = clients.find((c) => c.id === formData.companyId);
    return {
      jobTitle: formData.jobTitle,
      companyName: company?.companyName || '',
      contactPersonName: formData.contactPersonName,
      numberOfOpenings: formData.numberOfOpenings,
      priority: formData.priority,
      nationality: formData.nationality,
      industryType: formData.industryType,
      employmentType: formData.employmentType,
      targetHireDate: formData.targetHireDate,
      city: formData.city,
      state: formData.state,
      country: formData.country,
      minExperience: formData.minExperience,
      maxExperience: formData.maxExperience,
      currency: formData.currency,
      minSalary: formData.minSalary,
      maxSalary: formData.maxSalary,
      skills: formData.skills,
      languages: formData.languages,
      jobDescriptionHtml: formData.jobDescriptionHtml,
      jobSummary: formData.jobSummary,
      keyResponsibilitiesText: formData.keyResponsibilitiesText,
      qualificationsExperienceText: formData.qualificationsExperienceText,
      candidateRequirementsText: formData.candidateRequirementsText,
      compensationBenefitsText: formData.compensationBenefitsText,
      educationalQualification: formData.educationalQualification,
      educationalSpecialization: formData.educationalSpecialization,
      applyUrl: effectiveApplyUrl,
      showClientNamePublicly: formData.showClientNamePublicly,
      publicFieldVisibility: formData.publicFieldVisibility,
      linkedInPostSections,
      customJdSections: formData.customJdSections,
    };
  }, [clients, effectiveApplyUrl, formData, linkedInPostSections]);

  const generatedLinkedInPost = useMemo(
    () => buildLinkedInJobPost(socialPostInput),
    [socialPostInput],
  );

  const generatedTwitterPost = useMemo(
    () => buildTwitterJobPost(socialPostInput),
    [socialPostInput],
  );

  const generatedFacebookPost = useMemo(
    () => buildFacebookJobPost(socialPostInput),
    [socialPostInput],
  );

  /** When a field is hidden from public, social posts must drop it immediately. */
  const publicVisibilitySignature = useMemo(
    () =>
      JSON.stringify({
        fields: parseJobPublicFieldVisibility(formData.publicFieldVisibility),
        showClient: formData.showClientNamePublicly !== false,
        sections: linkedInPostSections,
      }),
    [formData.publicFieldVisibility, formData.showClientNamePublicly, linkedInPostSections],
  );

  useEffect(() => {
    if (!formData.jobTitle || !formData.companyId) return;
    setLinkedInPostText(generatedLinkedInPost);
    setLinkedInPostTextTouched(false);
    setFormData((prev) => ({
      ...prev,
      twitterTweetText: generatedTwitterPost,
      facebookCaption: generatedFacebookPost,
    }));
    setTwitterPostTextTouched(false);
    setFacebookCaptionTouched(false);
    // Only react to visibility toggles — form field edits keep the existing sync effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: visibility-only
  }, [publicVisibilitySignature]);

  useEffect(() => {
    if (!isOpen || !jobId) return;
    let cancelled = false;
    const loadApplyLink = async () => {
      try {
        setApplicationApplyUrlLoading(true);
        const response = await apiGetJobApplyLink(jobId);
        if (!cancelled && response.data?.applyUrl) {
          setApplicationApplyUrl(response.data.applyUrl);
        }
      } catch (err) {
        console.error('Failed to load job apply link:', err);
      } finally {
        if (!cancelled) setApplicationApplyUrlLoading(false);
      }
    };
    void loadApplyLink();
    return () => {
      cancelled = true;
    };
  }, [isOpen, jobId]);

  useEffect(() => {
    if (!formData.jobTitle || !formData.companyId) return;
    if (!formData.linkedInJobTitle) {
      setFormData((prev) => ({ ...prev, linkedInJobTitle: prev.jobTitle }));
    }
    if (!linkedInPostTextTouched) {
      setLinkedInPostText(generatedLinkedInPost);
    }
    if (!twitterPostTextTouched) {
      setFormData((prev) => ({ ...prev, twitterTweetText: generatedTwitterPost }));
    }
    if (!facebookCaptionTouched) {
      setFormData((prev) => ({ ...prev, facebookCaption: generatedFacebookPost }));
    }
  }, [
    clients,
    effectiveApplyUrl,
    formData.companyId,
    formData.jobTitle,
    formData.linkedInJobTitle,
    formData.publicFieldVisibility,
    formData.showClientNamePublicly,
    generatedLinkedInPost,
    generatedTwitterPost,
    generatedFacebookPost,
    linkedInPostTextTouched,
    twitterPostTextTouched,
    facebookCaptionTouched,
  ]);

  // Auto-populate LinkedIn Description from rich text editor
  useEffect(() => {
    if (formData.jobDescriptionHtml && formData.linkedInEnabled) {
      // Strip HTML and limit to 2000 chars
      const text = formData.jobDescriptionHtml.replace(/<[^>]*>/g, '').trim();
      const limited = text.substring(0, 2000);
      if (!formData.linkedInDescription || formData.linkedInDescription.length < limited.length) {
        setFormData(prev => ({ ...prev, linkedInDescription: limited }));
      }
    }
  }, [formData.jobDescriptionHtml, formData.linkedInEnabled]);

  const wizardSteps = isEditMode ? CREATE_JOB_EDIT_WIZARD_STEPS : CREATE_JOB_WIZARD_STEPS;
  const wizardStepIndex = Math.max(0, wizardSteps.findIndex((step) => step.id === wizardStep));

  const goWizardBack = () => {
    if (wizardStep === 'publish') {
      setWizardStep('application');
      return;
    }
    if (wizardStep === 'application') {
      setWizardStep('details');
      return;
    }
    if (wizardStep === 'details' && !isEditMode) {
      setWizardStep('jd');
      return;
    }
    if (wizardStep === 'jd') {
      setWizardStep('client');
    }
  };

  const goWizardNext = () => {
    if (wizardStep === 'client') {
      if (!formData.companyId && !isStandaloneMode) {
        void requestWarning('Select your own company or a client to continue');
        return;
      }
      setWizardStep('jd');
      return;
    }
    if (wizardStep === 'jd') {
      setWizardStep('details');
      return;
    }
    if (wizardStep === 'details') {
      if (!formData.jobTitle.trim()) {
        void requestWarning('Job Title is required');
        return;
      }
      if (!formData.companyId && !isStandaloneMode) {
        void requestWarning('Company is required');
        return;
      }
      if (!formData.numberOfOpenings) {
        void requestWarning('Number of Openings is required');
        return;
      }
      if (!formData.country.trim()) {
        void requestWarning('Country is required');
        return;
      }
      if (!formData.targetHireDate) {
        void requestWarning('Target Hire Date is required');
        return;
      }
      setWizardStep('application');
      return;
    }
    if (wizardStep === 'application') setWizardStep('publish');
  };

  const stripHtml = (value: string) =>
    value
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      .replace(/<li>/gi, '- ')
      .replace(/<\/li>/gi, '\n')
      .replace(/<[^>]*>/g, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

  const getSectionTextFromHtml = (html: string, sectionTitle: string) => {
    if (!html || typeof window === 'undefined') return '';
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      const headings = Array.from(doc.querySelectorAll('h3, h4'));
      const heading = headings.find((node) =>
        (node.textContent || '').trim().toLowerCase().includes(sectionTitle.toLowerCase())
      );
      if (!heading) return '';

      const chunks: string[] = [];
      let cursor = heading.nextElementSibling;
      while (cursor && !['H3', 'H4'].includes(cursor.tagName)) {
        const text = (cursor.textContent || '').trim();
        if (text) chunks.push(text);
        cursor = cursor.nextElementSibling;
      }
      return chunks.join('\n');
    } catch {
      return '';
    }
  };

  const loadJobData = async (sourceJobId?: string) => {
    const targetJobId = sourceJobId || jobId || duplicateFromJobId || undefined;
    if (!targetJobId) return;
    try {
      setLoadingJob(true);
      const response = await apiGetJob(targetJobId);
      const job = (response as { data?: Record<string, unknown> }).data || (response as Record<string, unknown>);
      
      if (!job) {
        throw new Error('Job data not found');
      }
      
      const salary = job.salary || {};
      const salaryType = salary.type || 'Annual Salary';
      const currency = normalizeJobSalaryCurrency(salary.currency || getCachedOrgDefaultCurrency());
      let minSalary = salary.min != null ? String(salary.min) : '';
      let maxSalary = salary.max != null ? String(salary.max) : '';
      if (!minSalary && !maxSalary && typeof salary.amount === 'string') {
        const m = salary.amount.match(/^\s*(\d+(?:\.\d+)?)\s*[-–]\s*(\d+(?:\.\d+)?)\s*$/);
        if (m) {
          minSalary = m[1];
          maxSalary = m[2];
        } else {
          const single = salary.amount.match(/^\s*(\d+(?:\.\d+)?)\s*$/);
          if (single) minSalary = single[1];
        }
      }
      
      const { min: minExperience, max: maxExperience } = parseExperienceRequiredForForm(
        job.experienceRequired,
      );
      
      // Map job type
      const mapJobTypeFromBackend = (type: string): string => {
        const t = type?.toUpperCase() || '';
        if (t.includes('FULL_TIME') || t.includes('FULL')) return 'Full Time';
        if (t.includes('PART_TIME') || t.includes('PART')) return 'Part Time';
        if (t.includes('CONTRACT')) return 'Contract';
        if (t.includes('INTERN')) return 'Internship';
        return 'Part Time';
      };
      
      // Parse location - try to extract city, state, country, locality, postalCode
      const location = job.location || '';
      // Try to parse location string (format might vary)
      const locationParts = location.split(',').map((p: string) => p.trim()).filter(p => p);
      let city = '';
      let state = '';
      let country = '';
      let locality = '';
      let postalCode = '';
      
      // Try to extract from distributionPlatforms first (if stored there)
      let fullAddress = '';
      if (job.distributionPlatforms && typeof job.distributionPlatforms === 'object') {
        const distPlatforms = job.distributionPlatforms as any;
        city = distPlatforms.city || '';
        state = distPlatforms.state || '';
        country = distPlatforms.country || '';
        locality = distPlatforms.locality || '';
        postalCode = distPlatforms.postalCode || '';
        fullAddress = distPlatforms.fullAddress || '';
      }
      
      // If not in distributionPlatforms, try to parse from location string
      // Common patterns: 
      // "City, State, Country"
      // "Locality, City, State, Country"
      // "City, State, Country, PostalCode"
      if (!city && locationParts.length > 0) {
        if (locationParts.length >= 5) {
          // Format: Locality, City, State, Country, PostalCode
          locality = locationParts[0] || '';
          city = locationParts[1] || '';
          state = locationParts[2] || '';
          country = locationParts[3] || '';
          postalCode = locationParts[4] || '';
        } else if (locationParts.length === 4) {
          // Could be: Locality, City, State, Country OR City, State, Country, PostalCode
          // Check if last part looks like postal code (numbers)
          if (/^\d+/.test(locationParts[3])) {
            city = locationParts[0] || '';
            state = locationParts[1] || '';
            country = locationParts[2] || '';
            postalCode = locationParts[3] || '';
          } else {
            locality = locationParts[0] || '';
            city = locationParts[1] || '';
            state = locationParts[2] || '';
            country = locationParts[3] || '';
          }
        } else if (locationParts.length === 3) {
          // Format: City, State, Country
          city = locationParts[0] || '';
          state = locationParts[1] || '';
          country = locationParts[2] || '';
        } else if (locationParts.length === 2) {
          city = locationParts[0] || '';
          state = locationParts[1] || '';
        } else if (locationParts.length === 1) {
          city = locationParts[0] || '';
        }
      }
      
      // Parse education field - might contain both qualification and specialization
      // Format could be: "Qualification - Specialization" or just "Qualification"
      const education = job.education || '';
      let educationalQualification = education;
      let educationalSpecialization = '';
      if (education.includes(' - ')) {
        const eduParts = education.split(' - ').map((p: string) => p.trim());
        educationalQualification = eduParts[0] || '';
        educationalSpecialization = eduParts[1] || '';
      } else if (education.includes(',')) {
        const eduParts = education.split(',').map((p: string) => p.trim());
        educationalQualification = eduParts[0] || '';
        educationalSpecialization = eduParts[1] || '';
      }
      
      // Get JD file name if available
      const jdFileName = job.jdFileName || '';
      setExistingOtherDocName(jdFileName);

      const plainDescription = stripHtml(job.description || '');
      const responsibilitiesText =
        Array.isArray(job.keyResponsibilities) && job.keyResponsibilities.length
          ? job.keyResponsibilities.join('\n')
          : getSectionTextFromHtml(job.description || '', 'key responsibilities');
      const qualificationsText =
        Array.isArray(job.requirements) && job.requirements.length
          ? job.requirements.join('\n')
          : getSectionTextFromHtml(job.description || '', 'requirements') ||
            getSectionTextFromHtml(job.description || '', 'qualifications');
      const candidateRequirementsText =
        Array.isArray((job as { candidateRequirements?: string[] }).candidateRequirements) &&
        (job as { candidateRequirements?: string[] }).candidateRequirements!.length
          ? (job as { candidateRequirements?: string[] }).candidateRequirements!.join('\n')
          : getSectionTextFromHtml(job.description || '', 'candidate requirements');
      const benefitsText =
        Array.isArray(job.benefits) && job.benefits.length
          ? job.benefits.join('\n')
          : getSectionTextFromHtml(job.description || '', 'benefits') ||
            getSectionTextFromHtml(job.description || '', 'compensation');
      const salarySummary =
        salary?.amount
          ? String(salary.amount)
          : salary?.min || salary?.max
            ? `${salary.min ? `${salary.min}` : ''}${salary.max ? ` - ${salary.max}` : ''}`.trim()
            : '';

      // Application form logo: stored value is either preset (account|company|none) or a Cloudinary URL
      const rawAppLogo = String((job as { applicationFormLogo?: string }).applicationFormLogo || '').trim();
      let parsedLogoOption: ApplicationLogoOption = 'account';
      let parsedApplicationLogoUrl = '';
      if (/^https?:\/\//i.test(rawAppLogo)) {
        parsedLogoOption = 'custom';
        parsedApplicationLogoUrl = rawAppLogo;
      } else if (rawAppLogo === 'company' || rawAppLogo === 'none' || rawAppLogo === 'account') {
        parsedLogoOption = rawAppLogo;
      }
      
      const jobExtras = job as {
        nationality?: string;
        country?: string;
        state?: string;
        city?: string;
        priority?: string;
        jobCategory?: string;
        forecastRevenue?: string;
        videoMediaLink?: string;
        languages?: { language?: string; proficiency?: string }[];
        managerId?: string;
        hiringManager?: string;
        hiringManagerId?: string;
        expectedClosureDate?: string;
      };

      const targetHireDate = jobExtras.expectedClosureDate
        ? String(jobExtras.expectedClosureDate).split('T')[0]
        : '';

      let preScreenAssessmentLinks: JobPreScreenAssessmentLink[] = [];
      const fromJob = (job as { preScreenAssessments?: JobPreScreenAssessmentLink[] }).preScreenAssessments;
      if (Array.isArray(fromJob) && fromJob.length > 0) {
        preScreenAssessmentLinks = fromJob
          .map((row, index) => ({
            id: row.id,
            assessmentId: row.assessmentId || row.assessment?.id || '',
            sortOrder: row.sortOrder ?? index,
            required: row.required !== false,
            timing: 'BEFORE_SUBMIT',
            durationOverrideMinutes: row.durationOverrideMinutes ?? null,
            passScoreOverridePercent: row.passScoreOverridePercent ?? null,
            assessment: row.assessment,
          }))
          .filter((row) => Boolean(row.assessmentId));
      } else {
        try {
          const assessRes = await getJobPreScreenAssessments(targetJobId);
          const rows = Array.isArray(assessRes?.data) ? assessRes.data : [];
          preScreenAssessmentLinks = rows
            .map((row: Record<string, unknown>, index: number) => ({
              id: typeof row.id === 'string' ? row.id : undefined,
              assessmentId: String(row.assessmentId || (row.assessment as { id?: string })?.id || ''),
              sortOrder: typeof row.sortOrder === 'number' ? row.sortOrder : index,
              required: row.required !== false,
              timing: 'BEFORE_SUBMIT',
              durationOverrideMinutes:
                typeof row.durationOverrideMinutes === 'number' ? row.durationOverrideMinutes : null,
              passScoreOverridePercent:
                typeof row.passScoreOverridePercent === 'number' ? row.passScoreOverridePercent : null,
              assessment: row.assessment as JobPreScreenAssessmentLink['assessment'],
            }))
            .filter((row) => Boolean(row.assessmentId));
        } catch {
          preScreenAssessmentLinks = [];
        }
      }

      setFormData(prev => ({
        ...prev,
        nationality: jobExtras.nationality || '',
        jobTitle: isDuplicateMode ? `${job.title || ''} Copy` : (job.title || ''),
        priority: jobExtras.priority || 'Medium',
        companyId: job.clientId || '',
        showClientNamePublicly: (job as { showClientNamePublicly?: boolean }).showClientNamePublicly !== false,
        publicFieldVisibility: mergeClientVisibility(
          parseJobPublicFieldVisibility((job as { publicFieldVisibility?: unknown }).publicFieldVisibility),
          (job as { showClientNamePublicly?: boolean }).showClientNamePublicly !== false,
        ),
        contactPersonId: jobExtras.hiringManagerId || '',
        contactPersonName: jobExtras.hiringManager || '',
        numberOfOpenings: String(job.openings || 1),
        country: jobExtras.country || country,
        state: jobExtras.state || state,
        city: jobExtras.city || city,
        industryType: jobExtras.jobCategory || '',
        employmentType: mapJobTypeFromBackend(job.type),
        targetHireDate,
        videoMediaLink: jobExtras.videoMediaLink || '',
        forecastRevenue: jobExtras.forecastRevenue || '',
        managerId: jobExtras.managerId || '',
        languages: Array.isArray(jobExtras.languages)
          ? jobExtras.languages
              .map((row) => ({
                language: String(row.language || '').trim(),
                proficiency: String(row.proficiency || 'Conversational').trim(),
              }))
              .filter((row) => row.language)
          : [],
        jobDescriptionHtml: job.description || '',
        jobLocation: location,
        jobType: mapJobTypeFromBackend(job.type),
        jobLocationType: job.jobLocationType || '',
        salaryInput: salarySummary,
        jobSummary: job.overview || plainDescription,
        keyResponsibilitiesText: responsibilitiesText,
        qualificationsExperienceText: qualificationsText,
        candidateRequirementsText,
        compensationBenefitsText: benefitsText,
        customJdSections: extractAdditionalJdSectionsFromHtml(job.description || ''),
        minExperience,
        maxExperience,
        payRangeMin: minSalary,
        payRangeMax: maxSalary,
        salaryType,
        currency,
        minSalary,
        maxSalary,
        educationalQualification,
        educationalSpecialization,
        skills: job.skills || [],
        locality,
        city,
        state,
        country,
        postalCode,
        fullAddress: fullAddress || location,
        enableApplicationForm: job.applicationFormEnabled || false,
        logoOption: parsedLogoOption,
        applicationLogoUrl: parsedApplicationLogoUrl,
        applicationQuestions: parseScreeningQuestionList(job.applicationFormQuestions),
        noteForCandidates: job.applicationFormNote || '',
        applicationFormSchema:
          normalizeApplicationFormSchema((job as { applicationFormSchema?: unknown }).applicationFormSchema) ||
          defaultApplicationFormSchema(),
        preScreenAssessments: preScreenAssessmentLinks,
        assignedToId:
          (job as { assignedToId?: string }).assignedToId || (job as { assignedTo?: { id: string } }).assignedTo?.id || '',
        assignedToName: formatAssigneeDisplayName((job as { assignedTo?: Parameters<typeof formatAssigneeDisplayName>[0] }).assignedTo) ||
          String((job as { assignedTo?: { name?: string } }).assignedTo?.name || ''),
        assignedToCompanyId: assigneeCompanyId(
          (job as { assignedTo?: { assignCompanyId?: string; orgUnitId?: string; orgUnit?: { id?: string } } }).assignedTo,
        ),
        aboutCompany: String((job as { aboutCompany?: string }).aboutCompany || ''),
      }));
      
      // Set JD file name if available (for display purposes)
      if (jdFileName) {
        // Note: We can't restore the actual file, but we can show the filename
        // The user would need to re-upload if they want to change it
      }
    } catch (error) {
      console.error('Failed to load job data:', error);
      void requestError('Failed to load job data. Please try again.');
    } finally {
      setLoadingJob(false);
    }
  };

  const loadClients = async () => {
    try {
      setLoadingClients(true);

      const workspaceResponse = await apiGetWorkspaceClient().catch(() => null);
      const workspaceClient =
        (workspaceResponse as { data?: { workspaceClient?: BackendClient | null } } | null)?.data
          ?.workspaceClient || null;

      if (isStandaloneMode) {
        if (workspaceClient?.id) {
          setClients([workspaceClient]);
          setFormData((prev) =>
            prev.companyId ? prev : { ...prev, companyId: workspaceClient.id },
          );
        } else {
          setClients([]);
        }
        return;
      }

      const extractClients = (response: Awaited<ReturnType<typeof apiGetClients>>): BackendClient[] => {
        let backendClients: BackendClient[] = [];
        if (response.data) {
          if (Array.isArray(response.data)) {
            backendClients = response.data;
          } else if (response.data && Array.isArray(response.data.data)) {
            backendClients = response.data.data;
          } else if (response.data && 'items' in response.data && Array.isArray((response.data as any).items)) {
            backendClients = (response.data as any).items;
          }
        }
        return backendClients;
      };

      const recResponse = await apiGetClients({ recruitmentEnabled: true, page: 1, limit: 500 });
      let backendClients = extractClients(recResponse);
      if (backendClients.length === 0) {
        backendClients = extractClients(await apiGetClients({ page: 1, limit: 500 }));
      }
      const crmClients = backendClients.filter(
        (client) =>
          !isOwnCompanyWorkspaceClient(client) &&
          (!workspaceClient?.id || client.id !== workspaceClient.id),
      );
      setClients(
        dedupeByCompanyName(
          workspaceClient?.id ? [workspaceClient, ...crmClients] : crmClients,
          (client) => client.companyName,
        ),
      );
    } catch (err) {
      console.error('Failed to load clients:', err);
    } finally {
      setLoadingClients(false);
    }
  };

  const loadUsers = async () => {
    try {
      setLoadingUsers(true);
      const members = await getAllTeamMembersForAssign(undefined, 'Jobs');
      setUsers(teamMembersToBackendUsers(members));
    } catch (err) {
      console.error('Failed to load users:', err);
      setUsers([]);
    } finally {
      setLoadingUsers(false);
    }
  };

  const loadLineManagers = async (includeUserId?: string) => {
    try {
      setLoadingLineManagers(true);
      const managers = await getLineManagersForJobPicker(includeUserId);
      setLineManagers(managers);
      if (includeUserId && managers.some((user) => user.id === includeUserId)) {
        setFormData((prev) =>
          prev.managerId ? prev : { ...prev, managerId: includeUserId },
        );
      }
    } catch (err) {
      console.error('Failed to load line managers:', err);
      setLineManagers([]);
    } finally {
      setLoadingLineManagers(false);
    }
  };

  const inferRoleFromPrompt = (prompt: string) => inferJobTitleFromPrompt(prompt);

  const normalizeJobType = (value?: string) => {
    const normalized = String(value || '').toLowerCase();
    if (normalized.includes('part')) return 'Part Time';
    if (normalized.includes('contract')) return 'Contract';
    if (normalized.includes('intern')) return 'Internship';
    return 'Full Time';
  };

  const normalizeMinExperience = (value?: number) => {
    const num = Number(value);
    if (!Number.isFinite(num) || num < 0) return '';
    return String(Math.trunc(num));
  };

  const normalizeMaxExperience = (value?: number) => {
    const num = Number(value);
    if (!Number.isFinite(num) || num < 0) return '';
    return String(Math.trunc(num));
  };

  const normalizeQualification = (value?: string) => {
    const normalized = String(value || '').toLowerCase();
    if (normalized.includes('master') && normalized.includes('engineering')) return 'Master of Engineering';
    if (normalized.includes('bachelor') && normalized.includes('engineering')) return 'Bachelor of Engineering';
    if (normalized.includes('master') && normalized.includes('science')) return 'Master of Science';
    if (normalized.includes('bachelor') && normalized.includes('science')) return 'Bachelor of Science';
    if (normalized.includes('mba')) return 'MBA';
    if (normalized.includes('diploma')) return 'Diploma';
    return '';
  };

  const inferWorkModeFromPrompt = (prompt: string) => inferWorkModeFromText(prompt);

  const pushAiMessage = (content: string) => {
    setAiMessages((prev) => [
      ...prev,
      {
        id: `ai-${Date.now()}-${prev.length}`,
        role: 'ai',
        content,
      },
    ]);
  };

  const scrollAiConversationToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      aiConversationEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    });
  }, []);

  const pushUserMessage = (content: string) => {
    setAiMessages((prev) => [
      ...prev,
      {
        id: `user-${Date.now()}-${prev.length}`,
        role: 'user',
        content,
      },
    ]);
  };

  const resetAiConversation = () => {
    setAiPrompt('');
    setAiDrawerError('');
    setAiDetectedRole('');
    setAiGeneratedDescription('');
    setAiGeneratedQualification('');
    setAiGeneratedSpecialization('');
    setAiGeneratedQuestions([]);
    setAiQuestionStep('initial');
    setAiDraftData({
      originalPrompt: '',
      jobTitle: '',
      openings: '',
      companyId: '',
      location: '',
      salary: '',
      qualification: '',
      workMode: '',
    });
    setAiMessages([
      {
        id: 'ai-welcome',
        role: 'ai',
        content:
          'Tell me which job you want to create. Example: "create job for Finance Analyst". I will then ask for openings, company, location, salary, and qualification.',
      },
    ]);
  };

  useEffect(() => {
    if (!showAiPromptBox) return;
    if (!aiMessages.length && !aiGeneratedDescription && !aiDrawerError && !aiGenerating) return;
    scrollAiConversationToBottom();
  }, [
    showAiPromptBox,
    aiMessages,
    aiGeneratedDescription,
    aiDrawerError,
    aiGenerating,
    aiQuestionStep,
    scrollAiConversationToBottom,
  ]);

  const parseAiDescriptionSections = (html: string) => {
    const fallback = {
      title: aiDetectedRole || formData.jobTitle || '',
      intro: [] as string[],
      sections: [] as AiDescriptionSection[],
    };

    if (!html || typeof window === 'undefined') {
      return fallback;
    }

    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      const bodyChildren = Array.from(doc.body.children);
      let title = '';
      const intro: string[] = [];
      const sections: AiDescriptionSection[] = [];
      let currentSection: AiDescriptionSection | null = null;

      for (const node of bodyChildren) {
        const tag = node.tagName.toLowerCase();
        const text = node.textContent?.trim() || '';
        if (!text) continue;

        if (!title && ['h1', 'h2'].includes(tag)) {
          title = text;
          continue;
        }

        if (tag === 'p') {
          if (!currentSection) {
            intro.push(text);
          } else {
            currentSection.paragraphs.push(text);
          }
          continue;
        }

        if (['h3', 'h4'].includes(tag)) {
          currentSection = { heading: text, paragraphs: [], items: [] };
          sections.push(currentSection);
          continue;
        }

        if (tag === 'ul' || tag === 'ol') {
          const items = Array.from(node.querySelectorAll('li'))
            .map((item) => item.textContent?.trim() || '')
            .filter(Boolean);
          if (!currentSection) {
            currentSection = { heading: 'Highlights', paragraphs: [], items: [] };
            sections.push(currentSection);
          }
          currentSection.items.push(...items);
        }
      }

      return {
        title: title || aiDetectedRole || formData.jobTitle || '',
        intro,
        sections,
      };
    } catch {
      return fallback;
    }
  };

  const aiDescriptionView = useMemo(
    () => parseAiDescriptionSections(aiGeneratedDescription),
    [aiGeneratedDescription, aiDetectedRole, formData.jobTitle]
  );

  const getJobSummaryFromAiDescription = (parsedDescription: {
    intro: string[];
    sections: AiDescriptionSection[];
  }) => {
    const introSummary = parsedDescription.intro.join('\n\n').trim();
    if (introSummary) return introSummary;

    const overviewSection = parsedDescription.sections.find((section) =>
      section.heading.toLowerCase().includes('overview')
    );
    if (!overviewSection) return '';

    return [...overviewSection.paragraphs, ...overviewSection.items].join('\n\n').trim();
  };

  const applyJobPromptHintsToFormData = useCallback(
    (
      prev: typeof formData,
      hints: JobPromptHints,
      draftOverrides: Partial<AiDraftData> | undefined,
      options: {
        jobTitle: string;
        workMode?: string;
        prompt?: string;
        generatedHtml?: string;
        generatedSkills?: string[];
        minExperienceYears?: number;
        maxExperienceYears?: number;
        qualification?: string;
      },
    ): typeof formData => {
      const prompt = options.prompt || '';
      const responsibilities = prompt
        ? extractLabeledPromptValue(prompt, ['responsibilities', 'responsibility'])
        : '';
      const requirements = prompt
        ? extractLabeledPromptValue(prompt, ['requirements', 'requirement', 'qualifications'])
        : '';
      const benefits = prompt ? extractLabeledPromptValue(prompt, ['benefits', 'benefit']) : '';
      const minExpYears = options.minExperienceYears ?? hints.minExperienceYears;
      const maxExpYears = options.maxExperienceYears ?? hints.maxExperienceYears;
      const generatedHtml =
        options.generatedHtml ||
        (prompt ? buildPlainJobDescriptionHtml(hints, prompt) : '') ||
        prev.jobDescriptionHtml;

      return {
        ...prev,
        nationality: hints.nationality || prev.nationality,
        jobTitle: options.jobTitle || hints.jobTitle || prev.jobTitle,
        numberOfOpenings: draftOverrides?.openings || hints.openings || prev.numberOfOpenings,
        companyId: draftOverrides?.companyId || hints.companyId || prev.companyId,
        country: hints.country || prev.country,
        city: hints.city || prev.city,
        state: hints.state || prev.state,
        industryType: hints.industryType || prev.industryType,
        jobLocation: hints.location || draftOverrides?.location || prev.jobLocation,
        jobLocationType: options.workMode || hints.workMode || prev.jobLocationType,
        salaryInput: draftOverrides?.salary || hints.salary || prev.salaryInput,
        payRangeMin: hints.payRangeMin || prev.payRangeMin,
        payRangeMax: hints.payRangeMax || prev.payRangeMax,
        minSalary: hints.payRangeMin || prev.minSalary,
        maxSalary: hints.payRangeMax || prev.maxSalary,
        currency: hints.salaryCurrency || prev.currency,
        employmentType: hints.employmentType || prev.employmentType,
        targetHireDate: hints.targetHireDate || prev.targetHireDate,
        minExperience:
          minExpYears != null && Number.isFinite(minExpYears)
            ? normalizeMinExperience(minExpYears)
            : prev.minExperience,
        maxExperience:
          maxExpYears != null && Number.isFinite(maxExpYears)
            ? normalizeMaxExperience(maxExpYears)
            : prev.maxExperience,
        educationalQualification:
          options.qualification ||
          normalizeQualification(draftOverrides?.qualification || hints.qualification) ||
          prev.educationalQualification,
        skills: options.generatedSkills?.length
          ? options.generatedSkills
          : hints.skills.length
            ? hints.skills
            : prev.skills,
        jobDescriptionHtml: generatedHtml,
        jobSummary: prev.jobSummary || (hints.jobTitle ? `${hints.jobTitle} at ${hints.companyName || 'the company'}.` : ''),
        keyResponsibilitiesText: responsibilities || prev.keyResponsibilitiesText,
        qualificationsExperienceText: requirements || prev.qualificationsExperienceText,
        compensationBenefitsText: benefits || prev.compensationBenefitsText,
      };
    },
    [],
  );

  const handleAiAssist = async (
    customPrompt?: string,
    draftOverrides?: Partial<AiDraftData>,
    externalHints?: JobPromptHints,
  ): Promise<{ form: typeof formData; usedAi: boolean; aiError?: string } | null> => {
    const promptText = customPrompt?.trim() || '';
    const hints = externalHints || (promptText ? parseJobPromptHints(promptText, clients) : emptyJobPromptHints());
    const inferredRole = inferRoleFromPrompt(promptText);
    const effectiveRole =
      draftOverrides?.jobTitle?.trim() ||
      hints.jobTitle ||
      formData.jobTitle.trim() ||
      inferredRole;
    const effectiveWorkMode =
      draftOverrides?.workMode ||
      hints.workMode ||
      inferWorkModeFromPrompt(promptText) ||
      formData.jobLocationType;
    const resolvedCompanyId = draftOverrides?.companyId || hints.companyId || formData.companyId;

    setAiDrawerError('');
    setAiDetectedRole(effectiveRole);
    setAiGeneratedDescription('');
    setAiGeneratedQualification('');
    setAiGeneratedSpecialization('');
    setAiGeneratedQuestions([]);

    if (!effectiveRole) {
      setAiDrawerError('Enter a job title or describe the role in the prompt, like "create job for Finance Analyst".');
      return null;
    }

    setAiGenerating(true);
    try {
      const company = clients.find((c) => c.id === resolvedCompanyId);
      const companyName = company?.companyName || hints.companyName || '';

      const experienceFromHints =
        hints.minExperienceYears != null
          ? hints.maxExperienceYears != null
            ? `${hints.minExperienceYears} to ${hints.maxExperienceYears}`
            : `${hints.minExperienceYears}`
          : '';
      const experience =
        experienceFromHints ||
        (formData.maxExperience && formData.maxExperience.trim()
          ? `${formData.minExperience} to ${formData.maxExperience}`
          : formData.minExperience);

      const response = await apiGenerateJobDescription({
        jobTitle: effectiveRole,
        company:
          (resolvedCompanyId
            ? clients.find((client) => client.id === resolvedCompanyId)?.companyName
            : companyName) || undefined,
        jobType: formData.jobType || undefined,
        locationType: effectiveWorkMode || undefined,
        experience: experience || undefined,
        skills: hints.skills.length ? hints.skills : formData.skills,
        customPrompt: customPrompt?.trim() || undefined,
      });
      const generated = response.data;
      const resolvedTitle = generated?.title?.trim() || effectiveRole;
      const generatedHtml = generated?.html?.trim() || '';
      const generatedSkills = Array.isArray(generated?.skills)
        ? Array.from(new Set(generated.skills.map((skill) => String(skill).trim()).filter(Boolean)))
        : [];
      const generatedQuestions = Array.isArray(generated?.screeningQuestions)
        ? Array.from(new Set(generated.screeningQuestions.map((question) => String(question).trim()).filter(Boolean)))
        : [];
      const qualification = normalizeQualification(generated?.educationalQualification);
      const specialization = String(generated?.educationalSpecialization || '').trim();
      const parsedDescription = parseAiDescriptionSections(generatedHtml);
      const summaryText = getJobSummaryFromAiDescription(parsedDescription);
      const findSection = (needle: string) =>
        parsedDescription.sections.find((section) =>
          section.heading.toLowerCase().includes(needle.toLowerCase())
        );
      const responsibilitiesText = findSection('key responsibilities')?.items.join('\n') || '';
      const qualificationsText = [
        ...((findSection('requirements')?.items || [])),
        ...((findSection('qualifications')?.items || [])),
      ].join('\n');
      const benefitsText = [
        ...((findSection('benefits')?.items || [])),
        ...((findSection('compensation')?.items || [])),
      ].join('\n');

      setAiDetectedRole(resolvedTitle);
      setAiGeneratedDescription(generatedHtml);
      setAiGeneratedQualification(qualification);
      setAiGeneratedSpecialization(specialization);
      setAiGeneratedQuestions(generatedQuestions);
      const minExpYears =
        hints.minExperienceYears != null
          ? hints.minExperienceYears
          : generated?.minExperience != null && Number.isFinite(Number(generated.minExperience))
            ? Number(generated.minExperience)
            : undefined;
      const maxExpYears =
        hints.maxExperienceYears != null
          ? hints.maxExperienceYears
          : generated?.maxExperience != null && Number.isFinite(Number(generated.maxExperience))
            ? Number(generated.maxExperience)
            : undefined;

      const mergeAiAssistIntoForm = (prev: typeof formData) => {
        const next = applyJobPromptHintsToFormData(prev, hints, draftOverrides, {
          jobTitle: resolvedTitle || effectiveRole,
          workMode: effectiveWorkMode,
          prompt: promptText,
          generatedHtml: generatedHtml || undefined,
          generatedSkills,
          minExperienceYears: minExpYears,
          maxExperienceYears: maxExpYears,
          qualification,
        });
        return {
          ...next,
          jobSummary: summaryText || next.jobSummary,
          keyResponsibilitiesText: responsibilitiesText || next.keyResponsibilitiesText,
          qualificationsExperienceText: qualificationsText || next.qualificationsExperienceText,
          compensationBenefitsText: benefitsText || next.compensationBenefitsText,
          jobType: normalizeJobType(generated?.jobType || prev.jobType),
          educationalSpecialization: specialization || prev.educationalSpecialization,
          enableApplicationForm: generatedQuestions.length ? true : prev.enableApplicationForm,
          applicationQuestions: generatedQuestions.length
            ? generatedQuestions.map((label: string) => makeShortTextScreeningQuestion(label))
            : prev.applicationQuestions,
        };
      };

      let mergedForm: typeof formData | null = null;
      setFormData((prev) => {
        mergedForm = mergeAiAssistIntoForm(prev);
        return mergedForm;
      });
      if (!mergedForm) {
        mergedForm = mergeAiAssistIntoForm(formData);
        setFormData(mergedForm);
      }
      return { form: mergedForm, usedAi: true };
    } catch (error: any) {
      console.error('AI Assist failed:', error);
      const message = error?.message || 'Failed to generate job description';
      setAiDrawerError(message);

      if (!effectiveRole) return null;

      const fallbackForm = applyJobPromptHintsToFormData(formData, hints, draftOverrides, {
        jobTitle: effectiveRole,
        workMode: effectiveWorkMode,
        prompt: promptText,
      });
      setFormData(fallbackForm);
      return { form: fallbackForm, usedAi: false, aiError: message };
    } finally {
      setAiGenerating(false);
    }
  };

  const handleJobDescriptionPaste = useCallback(
    (event: React.ClipboardEvent<HTMLDivElement>) => {
      const pastedText = event.clipboardData?.getData('text/plain')?.trim() || '';
      // Ignore tiny snippets; auto-extract starts from 50+ chars.
      if (pastedText.length < 50) return;
      setPastedJobDescriptionText(pastedText);
      setSmartJobError('');
    },
    [],
  );

  const handleAutoFillFromPastedJd = useCallback(async () => {
    if (aiGenerating) return;
    const editorText = stripHtml(formData.jobDescriptionHtml || '');
    const sourceText = (pastedJobDescriptionText || editorText || '').trim();
    if (sourceText.length < 50) {
      setSmartJobError('Paste a longer JD (at least 50 characters), then click Auto-fill.');
      return;
    }

    setSmartJobError('');

    try {
      const hints = parseJobPromptHints(sourceText, clients);
      if (!hints.targetHireDate) hints.targetHireDate = defaultTargetHireDateIso();

      const assistResult = await handleAiAssist(
        sourceText,
        {
          jobTitle: hints.jobTitle || formData.jobTitle,
          openings: hints.openings || formData.numberOfOpenings,
          companyId: hints.companyId || formData.companyId,
          location: hints.location,
          salary: hints.salary,
          qualification: hints.qualification,
          workMode: hints.workMode || formData.jobLocationType,
        },
        hints,
      );

      if (!assistResult?.form) {
        setSmartJobError('Could not extract enough fields. Please fill manually.');
        return;
      }

      const nextForm = assistResult.form;
      if (hints.companyName) {
        setPipelineDetectedCompanyName(hints.companyName);
      }

    } catch (error: any) {
      setSmartJobError(error?.message || 'Failed to extract details from pasted description.');
    }
  }, [aiGenerating, clients, formData, handleAiAssist, pastedJobDescriptionText]);

  const readFileAsText = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });

  const resetSmartJobPrompt = useCallback(() => {
    smartJobPipelineAbortRef.current?.abort();
    smartJobPipelineAbortRef.current = null;
    setSmartJobPrompt('');
    setSmartJobError('');
    setSmartJobFileText('');
    setSmartJobAttachment(null);
    setPipelineDetectedCompanyName('');
  }, []);

  const clearSmartJobAttachment = useCallback(() => {
    smartJobPipelineAbortRef.current?.abort();
    smartJobPipelineAbortRef.current = null;
    setSmartJobAttachment(null);
    setSmartJobFileText('');
    setPipelineDetectedCompanyName('');
  }, []);

  useEffect(() => {
    if (!pipelineDetectedCompanyName || formData.companyId) return;
    const matchedId = resolveClientIdByCompanyName(pipelineDetectedCompanyName, clients);
    if (!matchedId) return;
    setFormData((prev) => (prev.companyId === matchedId ? prev : { ...prev, companyId: matchedId }));
  }, [clients, pipelineDetectedCompanyName, formData.companyId]);

  const applyJobPipelineResult = useCallback(
    (prev: typeof formData, data: JobCreationPipelineResult): typeof formData => {
      const currency = normalizeJobSalaryCurrency(
        data.salaryCurrency || (data.country === 'India' ? 'INR' : prev.currency),
      );
      const listFields = hydrateJobListFieldsFromPipelineResult(data);
      return {
        ...prev,
        nationality: data.nationality?.trim() ? data.nationality : prev.nationality,
        jobTitle: data.jobTitle || prev.jobTitle,
        priority: data.priority || prev.priority,
        companyId: data.companyId || prev.companyId,
        numberOfOpenings: data.numberOfOpenings || prev.numberOfOpenings,
        country: data.country || prev.country,
        state: data.state || prev.state,
        city: data.city || prev.city,
        industryType: data.industryType || prev.industryType,
        employmentType: data.employmentType || prev.employmentType,
        targetHireDate: data.targetHireDate || prev.targetHireDate,
        minExperience:
          data.minExperience != null && Number.isFinite(data.minExperience)
            ? normalizeMinExperience(data.minExperience)
            : prev.minExperience,
        maxExperience:
          data.maxExperience != null && Number.isFinite(data.maxExperience)
            ? normalizeMaxExperience(data.maxExperience)
            : prev.maxExperience,
        payRangeMin: data.payRangeMin || prev.payRangeMin,
        payRangeMax: data.payRangeMax || prev.payRangeMax,
        minSalary: data.payRangeMin || prev.minSalary,
        maxSalary: data.payRangeMax || prev.maxSalary,
        currency,
        salaryInput: data.salaryInput || prev.salaryInput,
        jobLocation: data.jobLocation || prev.jobLocation,
        jobLocationType: data.jobLocationType || prev.jobLocationType,
        jobType: data.jobType || prev.jobType,
        languages: data.languages?.length ? data.languages : prev.languages,
        skills: data.skills?.length ? data.skills : prev.skills,
        jobDescriptionHtml: data.jobDescriptionHtml || prev.jobDescriptionHtml,
        jobSummary: data.jobSummary || prev.jobSummary,
        keyResponsibilitiesText:
          listFields.keyResponsibilitiesText || prev.keyResponsibilitiesText,
        qualificationsExperienceText:
          listFields.qualificationsExperienceText || prev.qualificationsExperienceText,
        candidateRequirementsText:
          listFields.candidateRequirementsText || prev.candidateRequirementsText,
        compensationBenefitsText:
          listFields.compensationBenefitsText || prev.compensationBenefitsText,
        customJdSections: mergeCustomJdSections(
          prev.customJdSections,
          listFields.customJdSections,
        ),
        educationalQualification: data.educationalQualification || prev.educationalQualification,
        educationalSpecialization:
          data.educationalSpecialization || prev.educationalSpecialization,
      };
    },
    [],
  );

  const handleSmartJobProcess = useCallback(async () => {
    const input = smartJobPrompt.trim();
    const fileText = smartJobFileText.trim();

    if (!input && !fileText) {
      setSmartJobError('Paste job details or attach a JD file first.');
      return;
    }

    setSmartJobError('');

    const combinedPrompt = [
      input,
      fileText ? `Job description (from file):\n${fileText}` : '',
    ]
      .filter(Boolean)
      .join('\n\n')
      .trim();

    setAiGenerating(true);
    try {
      const response = await apiGenerateJobFromPrompt({
        prompt: combinedPrompt,
        currentForm: {
          nationality: formData.nationality,
          jobTitle: formData.jobTitle,
          priority: formData.priority,
          companyId: formData.companyId,
          numberOfOpenings: formData.numberOfOpenings,
          country: formData.country,
          state: formData.state,
          city: formData.city,
          industryType: formData.industryType,
          employmentType: formData.employmentType,
          targetHireDate: formData.targetHireDate,
          skills: formData.skills,
        },
      });

      const data = response.data;
      if (!data?.jobTitle) {
        throw new Error('Could not extract a job title from your prompt.');
      }

      const matchedCompanyId =
        data.companyId || resolveClientIdByCompanyName(data.companyName || '', clients);
      const merged = { ...data, companyId: matchedCompanyId || data.companyId };

      setPipelineDetectedCompanyName(merged.companyName || '');
      setFormData((prev) => applyJobPipelineResult(prev, merged));
      setAccordions((prev) =>
        prev.map((section) => ({
          ...section,
          isOpen: section.id === 'details',
        })),
      );
      setSmartJobPrompt('');
    } catch (error: any) {
      console.warn('[CreateJobDrawer] full prompt pipeline failed, falling back:', error);

      try {
        const hints = parseJobPromptHints(combinedPrompt, clients);
        if (!hints.targetHireDate) hints.targetHireDate = defaultTargetHireDateIso();

        const resolvedJobTitle =
          hints.jobTitle || inferJobTitleFromPrompt(combinedPrompt);
        if (!resolvedJobTitle) {
          setSmartJobError('Add a role or job title (e.g. "create job for Frontend Developer in Mumbai").');
          return;
        }
        if (!hints.jobTitle) hints.jobTitle = resolvedJobTitle;

        const assistResult = await handleAiAssist(
          combinedPrompt,
          {
            jobTitle: resolvedJobTitle,
            openings: hints.openings,
            companyId: hints.companyId,
            location: hints.location,
            salary: hints.salary,
            qualification: hints.qualification,
            workMode: hints.workMode,
          },
          hints,
        );

        if (!assistResult?.form) {
          setSmartJobError(error?.message || 'Could not fill job details. Check your prompt and try again.');
          return;
        }

        setAccordions((prev) =>
          prev.map((section) => ({
            ...section,
            isOpen: section.id === 'details',
          })),
        );
        setSmartJobPrompt('');
      } catch (fallbackErr: any) {
        setSmartJobError(
          fallbackErr?.message || error?.message || 'Failed to process job details.',
        );
      }
    } finally {
      setAiGenerating(false);
    }
  }, [smartJobPrompt, smartJobFileText, handleAiAssist, clients, formData, applyJobPipelineResult]);

  useEffect(() => {
    if (!isOpen) return;
    if (isEditMode) return;
    setSmartJobPromptVisible(true);
  }, [isOpen, isEditMode]);

  const runJobCreationPipelineForFile = useCallback(
    async (file: File) => {
      smartJobPipelineAbortRef.current?.abort();
      const controller = new AbortController();
      smartJobPipelineAbortRef.current = controller;

      setAiGenerating(true);
      setSmartJobError('');

      try {
        const response = await apiProcessJobCreationPipeline(
          file,
          {
            nationality: formData.nationality,
            jobTitle: formData.jobTitle,
            priority: formData.priority,
            companyId: formData.companyId,
            numberOfOpenings: formData.numberOfOpenings,
            country: formData.country,
            state: formData.state,
            city: formData.city,
            industryType: formData.industryType,
            employmentType: formData.employmentType,
            targetHireDate: formData.targetHireDate,
            skills: formData.skills,
          },
          { signal: controller.signal },
        );
        const data = response.data;
        if (!data?.jobTitle) {
          throw new Error('Could not extract a job title from this document.');
        }

        const matchedCompanyId =
          data.companyId || resolveClientIdByCompanyName(data.companyName || '', clients);
        const merged = { ...data, companyId: matchedCompanyId || data.companyId };
        setPipelineDetectedCompanyName(merged.companyName || '');
        setFormData((prev) => applyJobPipelineResult(prev, merged));
        setAccordions((prev) =>
          prev.map((section) => ({
            ...section,
            isOpen: section.id === 'details',
          })),
        );

        setSmartJobAttachment({ file, status: 'ready' });
        if (!isEditMode) setWizardStep('details');
      } catch (error: any) {
        if (controller.signal.aborted) return;
        const message = error?.message || 'Failed to process job description file';
        setSmartJobAttachment({ file, status: 'error', error: message });
        setSmartJobError(message);
      } finally {
        if (smartJobPipelineAbortRef.current === controller) {
          smartJobPipelineAbortRef.current = null;
        }
        setAiGenerating(false);
      }
    },
    [applyJobPipelineResult, formData, clients, isEditMode],
  );

  const handleSmartJobFilePick = useCallback(
    async (file: File | null | undefined) => {
      if (!file) return;

      const maxBytes = 5 * 1024 * 1024;
      if (file.size > maxBytes) {
        void requestWarning('Job description file must be smaller than 5MB.');
        return;
      }

      setUploadedFile(file);
      setExistingOtherDocName(file.name);
      setSmartJobError('');
      setSmartJobAttachment({ file, status: 'processing' });

      const isPlainText = file.type.startsWith('text/') || /\.(txt|md)$/i.test(file.name);
      if (isPlainText) {
        try {
          const text = (await readFileAsText(file)).trim();
          setSmartJobFileText(text.slice(0, 14000));
        } catch {
          setSmartJobFileText('');
        }
      } else {
        setSmartJobFileText('');
      }

      await runJobCreationPipelineForFile(file);
    },
    [readFileAsText, runJobCreationPipelineForFile, clients],
  );

  const handleFinalizeAiJob = () => {
    setAccordions((prev) =>
      prev.map((section) => ({
        ...section,
        isOpen: section.id === 'details',
      }))
    );
    setShowAiPromptBox(false);
  };

  const handleAiCompanySelect = (companyId: string) => {
    if (!companyId) return;
    const companyName = clients.find((client) => client.id === companyId)?.companyName || 'Selected company';

    setAiDraftData((prev) => ({
      ...prev,
      companyId,
    }));
    pushUserMessage(companyName);
    pushAiMessage('What is the job location?');
    setAiQuestionStep('location');
  };

  const handleGenerateFromPromptBox = async () => {
    const input = aiPrompt.trim();
    if (!input) return;

    setAiPrompt('');
    setAiDrawerError('');

    if (aiQuestionStep === 'company') {
      pushUserMessage(input);
      pushAiMessage('Please choose the company from the selector below.');
      return;
    }

    pushUserMessage(input);

    if (aiQuestionStep === 'initial') {
      const inferredRole = inferRoleFromPrompt(input) || input;
      const inferredWorkMode = inferWorkModeFromPrompt(input);

      setAiDetectedRole(inferredRole);
      setAiDraftData((prev) => ({
        ...prev,
        originalPrompt: input,
        jobTitle: inferredRole,
        workMode: inferredWorkMode,
      }));
      pushAiMessage(`How many positions do you want to open for ${inferredRole}?`);
      setAiQuestionStep('openings');
      return;
    }

    if (aiQuestionStep === 'openings') {
      const openingsMatch = input.match(/\d+/);
      if (!openingsMatch) {
        pushAiMessage('Please tell me the number of openings, for example 2 or 5.');
        return;
      }

      setAiDraftData((prev) => ({
        ...prev,
        openings: openingsMatch[0],
      }));
      pushAiMessage('Select which company this job is for.');
      setAiQuestionStep('company');
      return;
    }

    if (aiQuestionStep === 'location') {
      setAiDraftData((prev) => ({
        ...prev,
        location: input,
      }));
      pushAiMessage('What is the expected salary for the candidate?');
      setAiQuestionStep('salary');
      return;
    }

    if (aiQuestionStep === 'salary') {
      setAiDraftData((prev) => ({
        ...prev,
        salary: input,
      }));
      pushAiMessage('Which qualification is required for this role?');
      setAiQuestionStep('qualification');
      return;
    }

    if (aiQuestionStep === 'qualification') {
      const finalDraft = {
        ...aiDraftData,
        qualification: input,
      };

      setAiDraftData(finalDraft);
      pushAiMessage('Thanks. I have what I need. I am creating the job details and JD now.');

      const companyName =
        clients.find((client) => client.id === finalDraft.companyId)?.companyName || '';

      const finalPrompt = [
        finalDraft.originalPrompt,
        `Role: ${finalDraft.jobTitle}.`,
        `Openings: ${finalDraft.openings}.`,
        companyName ? `Company: ${companyName}.` : '',
        finalDraft.location ? `Location: ${finalDraft.location}.` : '',
        finalDraft.salary ? `Expected salary: ${finalDraft.salary}.` : '',
        finalDraft.qualification ? `Qualification required: ${finalDraft.qualification}.` : '',
        finalDraft.workMode ? `Work mode: ${finalDraft.workMode}.` : '',
        'Generate Job Title, Number Of Openings, Company, Location, Work mode, Salary, Job Summary, Key Responsibilities, Qualifications and Experience, and Compensation & Benefits.',
      ]
        .filter(Boolean)
        .join(' ');

      await handleAiAssist(finalPrompt, finalDraft);
      pushAiMessage('Done. I filled the job fields and created the JD for this role.');
      setAiQuestionStep('done');
      return;
    }

    if (aiQuestionStep === 'done') {
      resetAiConversation();
      setAiPrompt(input);
    }
  };

  const handleConnectLinkedIn = async () => {
    try {
      setConnectingLinkedIn(true);
      saveCreateJobOauthDraft({
        formData: { ...formData },
        linkedInPostText,
        linkedInPostTextTouched,
        linkedInImageUrl,
        twitterPostTextTouched,
        selectedLinkedInTargets,
        selectedTwitterTargets,
        applicationApplyUrl,
        skillInput,
        aiDraftData,
      });
      sessionStorage.setItem('oauth_provider', 'linkedin');
      await linkedIn.connect();
    } catch (error) {
      console.error('Failed to connect LinkedIn:', error);
      setConnectingLinkedIn(false);
    }
  };

  const handleSaveJob = async () => {
    // Validate required fields
    if (!formData.jobTitle.trim()) {
      void requestWarning('Job Title is required');
      return;
    }
    let resolvedCompanyId = formData.companyId;
    if (!resolvedCompanyId) {
      if (isStandaloneMode) {
        try {
          const response = await apiGetWorkspaceClient();
          const workspaceClient = (response as { data?: { workspaceClient?: BackendClient | null } })
            ?.data?.workspaceClient;
          if (workspaceClient?.id) {
            resolvedCompanyId = workspaceClient.id;
            setFormData((prev) => ({ ...prev, companyId: workspaceClient.id }));
            setClients([workspaceClient]);
          } else {
            void requestWarning('Workspace company is not ready. Please try again.');
            return;
          }
        } catch {
          void requestWarning('Workspace company is not ready. Please try again.');
          return;
        }
      } else {
        void requestWarning('Company is required');
        return;
      }
    }
    if (!formData.numberOfOpenings) {
      void requestWarning('Number of Openings is required');
      return;
    }
    if (!formData.country.trim()) {
      void requestWarning('Country is required');
      return;
    }
    if (!formData.targetHireDate) {
      void requestWarning('Target Hire Date is required');
      return;
    }
    if (useLineManagerPicker && !formData.managerId) {
      void requestWarning('Line Manager is required');
      return;
    }

    try {
      setLoading(true);
      
      // Map UI form values to API payload
      const parsedMinExp = parseInt(String(formData.minExperience).replace(/\D/g, ''), 10);
      const parsedMaxExp = parseInt(String(formData.maxExperience).replace(/\D/g, ''), 10);
      const parseMoneyNumber = (value: string): number => {
        const text = String(value || '').trim();
        if (!text) return NaN;
        const match = text.match(/(\d+(?:\.\d+)?)/);
        return match ? Number(match[1]) : NaN;
      };
      const payMin = formData.payRangeMin !== ''
        ? parseMoneyNumber(formData.payRangeMin)
        : formData.minSalary !== ''
          ? parseMoneyNumber(formData.minSalary)
          : NaN;
      const payMax = formData.payRangeMax !== ''
        ? parseMoneyNumber(formData.payRangeMax)
        : formData.maxSalary !== ''
          ? parseMoneyNumber(formData.maxSalary)
          : NaN;

      const locationParts = [formData.city, formData.state, formData.country].map((v) => v?.trim()).filter(Boolean);
      const composedLocation = locationParts.join(', ') || formData.jobLocation || undefined;

      // Map UI job type to backend enum
      const mapJobType = (value: string): CreateJobData['type'] => {
        const v = value.toLowerCase();
        if (v.includes('full')) return 'FULL_TIME';
        if (v.includes('part')) return 'PART_TIME';
        if (v.includes('contract')) return 'CONTRACT';
        if (v.includes('intern')) return 'INTERNSHIP';
        return 'FULL_TIME';
      };

      const toList = (value: string) =>
        value
          .split('\n')
          .map((item) => item.replace(/^[\-\u2022]\s*/, '').trim())
          .filter(Boolean);

      const keyResponsibilities = toList(formData.keyResponsibilitiesText);
      const qualifications = toList(formData.qualificationsExperienceText);
      const candidateRequirements = toList(formData.candidateRequirementsText);
      const benefits = toList(formData.compensationBenefitsText);
      const customSectionsHtml = customJdSectionsToHtml(formData.customJdSections || []);
      const composedDescription = [
        `<h2>${formData.jobTitle.trim()}</h2>`,
        formData.jobSummary.trim() ? `<p>${formData.jobSummary.trim()}</p>` : '',
        keyResponsibilities.length
          ? `<h3>Key Responsibilities</h3><ul>${keyResponsibilities.map((item) => `<li>${item}</li>`).join('')}</ul>`
          : '',
        qualifications.length
          ? `<h3>Preferred Education / Qualifications</h3><ul>${qualifications.map((item) => `<li>${item}</li>`).join('')}</ul>`
          : '',
        candidateRequirements.length
          ? `<h3>Candidate Requirements</h3><ul>${candidateRequirements.map((item) => `<li>${item}</li>`).join('')}</ul>`
          : '',
        benefits.length
          ? `<h3>Compensation & Benefits</h3><ul>${benefits.map((item) => `<li>${item}</li>`).join('')}</ul>`
          : '',
        customSectionsHtml,
      ]
        .filter(Boolean)
        .join('');

      const descriptionWithCustomSections = formData.jobDescriptionHtml.trim()
        ? mergeDescriptionWithCustomJdSections(
            formData.jobDescriptionHtml.trim(),
            formData.customJdSections,
          )
        : composedDescription;

      const applicationFormLogoStored =
        formData.logoOption === 'custom' && formData.applicationLogoUrl.trim()
          ? formData.applicationLogoUrl.trim()
          : ['account', 'company', 'none'].includes(formData.logoOption)
            ? formData.logoOption
            : formData.logoOption === 'custom'
              ? 'none'
              : 'account';

      const jobData: CreateJobData = {
        title: formData.jobTitle,
        description: descriptionWithCustomSections,
        overview: formData.jobSummary || undefined,
        clientId: resolvedCompanyId,
        openings: parseInt(formData.numberOfOpenings) || 1,
        // Core job fields
        type: mapJobType(formData.employmentType || formData.jobType),
        status: 'OPEN',
        location: composedLocation,
        requirements: qualifications,
        skills: formData.skills,
        priority: formData.priority || undefined,
        nationality: formData.nationality.trim() || undefined,
        country: formData.country.trim() || undefined,
        state: formData.state.trim() || undefined,
        city: formData.city.trim() || undefined,
        forecastRevenue: formData.forecastRevenue.trim() || undefined,
        videoMediaLink: formData.videoMediaLink.trim() || undefined,
        languages: formData.languages
          .map((row) => ({
            language: row.language.trim(),
            proficiency: row.proficiency.trim(),
          }))
          .filter((row) => row.language),
        managerId: useLineManagerPicker ? formData.managerId || undefined : undefined,
        hiringManager: formData.contactPersonName.trim() || undefined,
        hiringManagerId: formData.contactPersonId || undefined,
        aboutCompany: (formData.aboutCompany || '').trim() || null,
        jobCategory: formData.industryType.trim() || undefined,
        expectedClosureDate: formData.targetHireDate || undefined,
        keyResponsibilities,
        candidateRequirements,
        experienceRequired:
          Number.isFinite(parsedMinExp) || Number.isFinite(parsedMaxExp)
            ? `${Number.isFinite(parsedMinExp) ? parsedMinExp : ''}${Number.isFinite(parsedMaxExp) ? `-${parsedMaxExp}` : ''}`.trim()
            : undefined,
        // Combine qualification and specialization for education field
        education: formData.educationalQualification 
          ? (formData.educationalSpecialization 
              ? `${formData.educationalQualification} - ${formData.educationalSpecialization}`
              : formData.educationalQualification)
          : undefined,
        salary: (() => {
          const hasMin = Number.isFinite(payMin);
          const hasMax = Number.isFinite(payMax);
          if (!hasMin && !hasMax && !formData.salaryInput) return undefined;
          return {
            min: hasMin ? payMin : undefined,
            max: hasMax ? payMax : undefined,
            currency: normalizeJobSalaryCurrency(formData.currency) || undefined,
            type: formData.salaryType || undefined,
            amount: formData.salaryInput || undefined,
          };
        })(),
        benefits,
        jobLocationType: formData.jobLocationType || undefined,
        workMode: formData.jobLocationType || undefined,
        applicationFormEnabled: formData.enableApplicationForm,
        applicationFormLogo: applicationFormLogoStored,
        applicationFormQuestions: formData.applicationQuestions
          .filter((q) => q.label.trim().length > 0)
          .map((q) => serializeScreeningQuestion(q)),
        applicationFormNote: formData.noteForCandidates.trim() ? formData.noteForCandidates.trim() : undefined,
        applicationFormSchema: formData.enableApplicationForm
          ? formData.applicationFormSchema ?? defaultApplicationFormSchema()
          : undefined,
        preScreenAssessments: (formData.preScreenAssessments ?? []).map((link, index) => ({
          assessmentId: link.assessmentId,
          sortOrder: index,
          required: link.required !== false,
          timing: 'BEFORE_SUBMIT',
          durationOverrideMinutes: link.durationOverrideMinutes ?? null,
          passScoreOverridePercent: link.passScoreOverridePercent ?? null,
        })),
        // Store JD file name if file was uploaded
        jdFileName: uploadedFile?.name || undefined,
        assignedToId: isEditMode
          ? formData.assignedToId
            ? formData.assignedToId
            : null
          : formData.assignedToId || undefined,
        showClientNamePublicly: formData.showClientNamePublicly !== false,
        publicFieldVisibility: buildPublicFieldVisibilityPayload(
          formData.publicFieldVisibility,
          formData.showClientNamePublicly,
        ),
      };

      let createdJobId: string | undefined;
      if (isEditMode && jobId) {
        await apiUpdateJob(jobId, jobData);
        createdJobId = jobId;
        await Promise.resolve(onJobUpdated?.(jobId));
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('jobportal:jobs-changed'));
        }
      } else {
        const response = await apiCreateJob(jobData);
        createdJobId = (response as any).data?.id || (response as any).data?.data?.id || (response as any).id;
        if (prefillFromRequest?.requestId && createdJobId) {
          try {
            await linkTeamRequestToJob(prefillFromRequest.requestId, createdJobId);
          } catch (linkError) {
            console.warn('[CreateJobDrawer] Failed to link request to job:', linkError);
          }
        }
        onJobCreated?.();
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('jobportal:jobs-changed'));
        }
      }

      // Post to social media if enabled
      const socialPosts: string[] = [];
      const connectedLinkedInKeys = getConnectedAccountKeys(linkedinAccounts);
      const linkedInTargetsForPublish =
        selectedLinkedInTargets.length > 0
          ? selectedLinkedInTargets
          : connectedLinkedInKeys.filter((key) => key.startsWith('personal:'));
      const linkedInAccountConnected =
        linkedIn.isConnected ||
        linkedinAccounts.some((account) => account.connected !== false);
      const platformsToPublish = {
        linkedin:
          formData.linkedInEnabled &&
          linkedInAccountConnected &&
          linkedInTargetsForPublish.length > 0,
        twitter:
          formData.twitterEnabled &&
          formData.twitterConnected &&
          selectedTwitterTargets.length > 0,
        facebook: formData.facebookEnabled && formData.facebookConnected,
      };

      if (
        formData.linkedInEnabled &&
        !platformsToPublish.linkedin &&
        createdJobId
      ) {
        void requestWarning(
          linkedInAccountConnected
            ? 'Job saved, but LinkedIn was skipped because no LinkedIn account/page was selected.'
            : 'Job saved, but LinkedIn was skipped because LinkedIn is not connected. Reconnect LinkedIn and try again.',
        );
      }

      if (Object.values(platformsToPublish).some(Boolean) && createdJobId) {
        try {
          const company = clients.find(c => c.id === formData.companyId);
          const companyName = formData.showClientNamePublicly ? company?.companyName || '' : '';
          let applyUrl = String(formData.linkedInExternalUrl || '').trim();
          if (!applyUrl) {
            try {
              const linkRes = await apiGetJobApplyLink(createdJobId);
              applyUrl = linkRes.data?.applyUrl || '';
            } catch {
              applyUrl = '';
            }
          }
          if (!applyUrl) {
            applyUrl = effectiveApplyUrl;
          }

          const previewApplyUrl = buildCandidatePortalApplyUrlPreview(getTenantDbName());
          const postInput = {
            ...socialPostInput,
            applyUrl,
            linkedInPostSections,
          };
          const hasTemplate = Array.isArray(linkedInPostSections) && linkedInPostSections.length > 0;
          const linkedInPublishText = replaceApplyUrlInSocialPostText(
            hasTemplate || !(linkedInPostTextTouched && (linkedInPostText || '').trim())
              ? buildLinkedInJobPost(postInput)
              : linkedInPostText,
            applyUrl,
            previewApplyUrl,
          );
          const twitterPublishText = replaceApplyUrlInSocialPostText(
            twitterPostTextTouched && (formData.twitterTweetText || '').trim()
              ? formData.twitterTweetText
              : buildTwitterJobPost(postInput),
            applyUrl,
            previewApplyUrl,
          );
          const showTitle = isJobFieldPubliclyVisible(formData.publicFieldVisibility, 'jobTitle');
          const showLocation = isJobFieldPubliclyVisible(formData.publicFieldVisibility, 'location');
          const resolvedFacebookPostText = replaceApplyUrlInSocialPostText(
            facebookCaptionTouched && (formData.facebookCaption || '').trim()
              ? formData.facebookCaption
              : buildFacebookJobPost(postInput),
            applyUrl,
            previewApplyUrl,
          );

          const result = await apiPublishSocialJob({
            jobId: createdJobId,
            title: showTitle ? formData.jobTitle : '',
            companyName,
            showClientNamePublicly: formData.showClientNamePublicly,
            description:
              isJobFieldPubliclyVisible(formData.publicFieldVisibility, 'jobDescription') &&
              formData.jobDescriptionHtml
                ? formData.jobDescriptionHtml.replace(/<[^>]*>/g, '')
                : undefined,
            applyUrl,
            location: showLocation
              ? formData.city || formData.fullAddress || undefined
              : undefined,
            platforms: platformsToPublish,
            linkedinPostText: linkedInPublishText,
            twitterPostText: twitterPublishText,
            facebookPostText: resolvedFacebookPostText,
            linkedinTargets: linkedInTargetsForPublish,
            twitterTargets: selectedTwitterTargets,
            linkedinImageUrl: linkedInImageUrl.trim() || undefined,
          });

          if (platformsToPublish.linkedin) {
            const linkedInResult = (result as any).data?.linkedin;
            if (linkedInResult?.success) {
              socialPosts.push('LinkedIn');
              setLinkedInPostUrl(linkedInResult.linkedinPostUrl);
              setShowLinkedInSuccess(true);
              setTimeout(() => setShowLinkedInSuccess(false), 5000);
            } else if (linkedInResult?.error) {
              void requestWarning(`Job saved, but LinkedIn posting failed: ${linkedInResult.error}`);
            } else {
              void requestWarning(
                'Job saved, but LinkedIn posting failed. Reconnect LinkedIn and try posting again.',
              );
            }
          }
          if (platformsToPublish.twitter) {
            const twitterResult = (result as any).data?.twitter;
            if (twitterResult?.success) {
              socialPosts.push('Twitter');
            } else if (twitterResult?.error) {
              void requestWarning(`Job saved, but X posting failed: ${twitterResult.error}`);
            }
          }
          if (platformsToPublish.facebook) socialPosts.push('Facebook');
        } catch (error: any) {
          console.error('Social publishing failed:', error);
          void requestWarning(
            `Job saved, but social publishing failed: ${error?.message || 'Unknown error'}`,
          );
        }
      }

      // Upload file if one was selected
      if (uploadedFile && createdJobId) {
        try {
          setUploadingFile(true);
          await apiUploadJobFile(createdJobId, uploadedFile, 'Other');
          console.log('Job description file uploaded successfully');
        } catch (error: any) {
          console.error('Failed to upload file:', error);
          // Don't block job save - file upload is optional
          void requestWarning(`Job saved successfully, but file upload failed: ${error.message}`);
        } finally {
          setUploadingFile(false);
          setUploadedFile(null);
        }
      }

      if (socialPosts.length > 0) {
        // Success message will be shown via toast/UI
        if (linkedInPostUrl) {
          // Show success toast with link
          console.log(`Job posted to LinkedIn: ${linkedInPostUrl}`);
        }
      }
      
      markCreateJobClean();
      onClose();
    } catch (error: any) {
      console.error('Failed to save job:', error);
      void requestError(error.message || 'Failed to save job');
    } finally {
      setLoading(false);
    }
  };

  const addSkill = () => {
    if (skillInput.trim()) {
      setFormData(prev => ({ ...prev, skills: [...prev.skills, skillInput.trim()] }));
      setSkillInput('');
    }
  };

  const removeSkill = (index: number) => {
    setFormData(prev => ({ ...prev, skills: prev.skills.filter((_, i) => i !== index) }));
  };

  const handleLinkedInImageFileChange = async (
    source: React.ChangeEvent<HTMLInputElement> | File,
  ) => {
    const file = source instanceof File ? source : source.target.files?.[0];
    if (!(source instanceof File) && source.target) source.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      void requestWarning('Please choose an image file (PNG, JPG, GIF, or WebP)');
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      void requestWarning('LinkedIn image must be 8MB or smaller.');
      return;
    }

    const target =
      isEditMode && jobId
        ? ({ entity: 'job' as const, id: jobId })
        : formData.companyId
          ? ({ entity: 'client' as const, id: formData.companyId })
          : null;

    if (!target) {
      void requestWarning(
        'Select a company in Job Details first so the LinkedIn image can be uploaded.',
      );
      return;
    }

    try {
      setUploadingLinkedInImage(true);
      const res = await filesApiUpload(target.entity, target.id, file, 'LINKEDIN_POST_IMAGE');
      const url = res.data?.fileUrl;
      if (!url) throw new Error('Upload succeeded but no file URL was returned.');
      setLinkedInImageUrl(url);
      linkedInImageUploadFeedback.markSuccess(file.name);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Upload failed';
      linkedInImageUploadFeedback.markError(message);
      void requestError(message);
    } finally {
      setUploadingLinkedInImage(false);
    }
  };

  const handleApplicationLogoFileChange = async (
    source: React.ChangeEvent<HTMLInputElement> | File
  ) => {
    const file = source instanceof File ? source : source.target.files?.[0];
    if (!(source instanceof File) && source.target) source.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      void requestWarning('Please choose an image file (PNG, JPG, WebP, etc.)');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      void requestWarning('Image must be 5MB or smaller.');
      return;
    }

    const target =
      isEditMode && jobId
        ? ({ entity: 'job' as const, id: jobId })
        : formData.companyId
          ? ({ entity: 'client' as const, id: formData.companyId })
          : null;

    if (!target) {
      void requestWarning('Select a company in Job Details first. When editing an existing job, you can upload without that step.');
      return;
    }

    try {
      setUploadingApplicationLogo(true);
      const res = await filesApiUpload(target.entity, target.id, file, 'APP_FORM_LOGO');
      const url = res.data?.fileUrl;
      if (!url) throw new Error('Upload succeeded but no file URL was returned.');
      setFormData((prev) => ({ ...prev, logoOption: 'custom', applicationLogoUrl: url }));
      logoUploadFeedback.markSuccess(file.name);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Upload failed';
      logoUploadFeedback.markError(message);
      void requestInfo(message);
    } finally {
      setUploadingApplicationLogo(false);
    }
  };

  const patchJobDetailsForm = useCallback(
    (patch: Partial<CreateJobDetailsFormData> | ((prev: CreateJobDetailsFormData) => Partial<CreateJobDetailsFormData>)) => {
      setFormData((prev) => {
        const current: CreateJobDetailsFormData = {
          nationality: prev.nationality,
          jobTitle: prev.jobTitle,
          priority: prev.priority,
          companyId: prev.companyId,
          showClientNamePublicly: prev.showClientNamePublicly,
          publicFieldVisibility: prev.publicFieldVisibility,
          contactPersonId: prev.contactPersonId,
          contactPersonName: prev.contactPersonName,
          numberOfOpenings: prev.numberOfOpenings,
          country: prev.country,
          state: prev.state,
          city: prev.city,
          industryType: prev.industryType,
          employmentType: prev.employmentType,
          targetHireDate: prev.targetHireDate,
          minExperience: prev.minExperience,
          maxExperience: prev.maxExperience,
          payRangeMin: prev.payRangeMin,
          payRangeMax: prev.payRangeMax,
          salaryCurrency: prev.currency,
          languages: prev.languages,
          skills: prev.skills,
          keyResponsibilitiesText: prev.keyResponsibilitiesText,
          qualificationsExperienceText: prev.qualificationsExperienceText,
          candidateRequirementsText: prev.candidateRequirementsText,
          customJdSections: prev.customJdSections || [],
          videoMediaLink: prev.videoMediaLink,
          forecastRevenue: prev.forecastRevenue,
          managerId: prev.managerId,
          assignedToId: prev.assignedToId,
          aboutCompany: prev.aboutCompany,
        };
        const nextPatch = typeof patch === 'function' ? patch(current) : patch;
        const merged = { ...prev, ...nextPatch };
        if (
          'payRangeMin' in nextPatch ||
          'payRangeMax' in nextPatch ||
          'salaryCurrency' in nextPatch
        ) {
          merged.minSalary = merged.payRangeMin;
          merged.maxSalary = merged.payRangeMax;
          const nextCurrency =
            typeof nextPatch === 'object' && nextPatch && 'salaryCurrency' in nextPatch
              ? String(nextPatch.salaryCurrency)
              : merged.currency;
          merged.currency = normalizeJobSalaryCurrency(nextCurrency);
        }
        return merged;
      });
    },
    []
  );

  const ownCompanyClient = useMemo(
    () => clients.find((client) => isOwnCompanyWorkspaceClient(client)) || null,
    [clients],
  );
  const crmClients = useMemo(
    () =>
      filterClientsForAddJob(
        clients.filter((client) => !isOwnCompanyWorkspaceClient(client)),
        { includeIds: [defaultClientId, formData.companyId] },
      ),
    [clients, defaultClientId, formData.companyId],
  );
  const jobWorkspaceLabel = resolveAddJobWorkspaceLabel({
    hasCompanies,
    orgUnitName,
    orgUnitId,
    homeIsOrgCompany,
    companyName: ownCompanyClient?.companyName || getStoredTenantCompanyName(),
  });
  const ownCompanyDisplayName = jobWorkspaceLabel.displayName;
  const workspaceOwnerHeading = jobWorkspaceLabel.useOrganizationLabel
    ? 'Organization'
    : 'Company';

  const jobDetailsFormData: CreateJobDetailsFormData = {
    nationality: formData.nationality,
    jobTitle: formData.jobTitle,
    priority: formData.priority,
    companyId: formData.companyId,
    showClientNamePublicly: formData.showClientNamePublicly,
    publicFieldVisibility: formData.publicFieldVisibility,
    contactPersonId: formData.contactPersonId,
    contactPersonName: formData.contactPersonName,
    numberOfOpenings: formData.numberOfOpenings,
    country: formData.country,
    state: formData.state,
    city: formData.city,
    industryType: formData.industryType,
    employmentType: formData.employmentType,
    targetHireDate: formData.targetHireDate,
    minExperience: formData.minExperience,
    maxExperience: formData.maxExperience,
    payRangeMin: formData.payRangeMin,
    payRangeMax: formData.payRangeMax,
    salaryCurrency: formData.currency,
    languages: formData.languages,
    skills: formData.skills,
    keyResponsibilitiesText: formData.keyResponsibilitiesText,
    qualificationsExperienceText: formData.qualificationsExperienceText,
    candidateRequirementsText: formData.candidateRequirementsText,
    customJdSections: formData.customJdSections || [],
    videoMediaLink: formData.videoMediaLink,
    forecastRevenue: formData.forecastRevenue,
    managerId: formData.managerId,
    assignedToId: formData.assignedToId,
    aboutCompany: formData.aboutCompany,
  };

  return (
    <>
    <AnimatePresence mode="wait">
      {isOpen && (
        <>
          <DetailsModalShell
            panelRef={createJobPanelRef}
            onBackdropClick={() => void requestCreateJobClose()}
            size="lg"
            zIndexClass="z-50"
            dialogTitleId="create-job-modal-title"
          >
            {/* Sticky Header */}
            <div className={`${DRAWER_FORM_HEADER_CLASS} shrink-0`}>
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-500/25">
                  <Briefcase size={20} />
                </div>
                <div className="min-w-0">
                  <h2 id="create-job-modal-title" className="text-lg font-bold tracking-tight text-slate-900">{isEditMode ? 'Edit Job' : 'Add Job'}</h2>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {CREATE_JOB_WIZARD_HINTS[wizardStep]}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={() => void requestCreateJobClose()}
                  className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
                >
                  Close
                </button>
              </div>
            </div>

            <div className="shrink-0 border-b border-blue-100/80 bg-white/90 px-6 py-4">
              <div className="flex items-center gap-2">
                {wizardSteps.map((step, i) => {
                  const done = i < wizardStepIndex;
                  const active = i === wizardStepIndex;
                  return (
                    <div key={step.id} className="flex min-w-0 flex-1 items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          if (i <= wizardStepIndex || isEditMode) setWizardStep(step.id);
                        }}
                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[0.7rem] font-bold transition-all ${
                          done
                            ? 'bg-[#2098C8] text-white shadow-md shadow-[#2098C8]/30'
                            : active
                              ? 'bg-[#2098C8] text-white shadow-lg shadow-[#2098C8]/30 ring-4 ring-[#2098C8]/25'
                              : 'bg-slate-100 text-slate-400 ring-1 ring-slate-200'
                        }`}
                        title={step.label}
                        aria-current={active ? 'step' : undefined}
                      >
                        {done ? <Check className="h-3.5 w-3.5" /> : i + 1}
                      </button>
                      <span
                        className={`hidden min-w-0 truncate text-xs font-semibold sm:block ${
                          active ? 'text-slate-900' : done ? 'text-[#2098C8]' : 'text-slate-400'
                        }`}
                      >
                        {step.label}
                      </span>
                      {i < wizardSteps.length - 1 ? (
                        <div
                          className={`h-1.5 min-w-[6px] flex-1 rounded-full ${
                            done
                              ? 'bg-[#2098C8]'
                              : active
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
                Step {wizardStepIndex + 1} of {wizardSteps.length} · {wizardSteps[wizardStepIndex]?.label}
              </p>
            </div>

            {/* Scrollable Content */}
            <div ref={smartJobPromptBoundsRef} className="flex min-h-0 flex-1 flex-col">
              <div className={`flex-1 overflow-y-auto ${DRAWER_FORM_SCROLL_BG} p-6 space-y-5`}>
              {wizardStep === 'client' ? (
                <DrawerSectionCard
                  title="Select Your Client"
                  icon={Building2}
                  accent="blue"
                >
                  <div className="space-y-3">
                    {ownCompanyClient ? (
                      <button
                        type="button"
                        onClick={() =>
                          setFormData((prev) => ({ ...prev, companyId: ownCompanyClient.id }))
                        }
                        className={`flex w-full items-center gap-3 rounded-2xl border px-4 py-3.5 text-left transition ${
                          formData.companyId === ownCompanyClient.id
                            ? 'border-[#2098C8] bg-[#E8F6FC] shadow-sm ring-2 ring-[#2098C8]/20'
                            : 'border-[#2098C8]/35 bg-gradient-to-r from-[#F3FBFE] to-white hover:border-[#2098C8]/70'
                        }`}
                      >
                        <span
                          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${
                            formData.companyId === ownCompanyClient.id
                              ? 'bg-[#2098C8] text-white'
                              : 'bg-gradient-to-br from-[#2098C8] to-[#176F96] text-white'
                          }`}
                        >
                          <Home className="h-5 w-5" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-[0.65rem] font-bold uppercase tracking-[0.16em] text-[#176F96]">
                            Own company
                          </span>
                          <span className="block truncate text-sm font-semibold text-slate-900">
                            {ownCompanyDisplayName}
                          </span>
                          <span className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
                            <Users className="h-3.5 w-3.5 shrink-0 text-[#2098C8]" />
                            Visible to all team members in this company
                          </span>
                        </span>
                        <span
                          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                            formData.companyId === ownCompanyClient.id
                              ? 'bg-[#2098C8] text-white'
                              : 'bg-slate-100 text-slate-300'
                          }`}
                        >
                          <Check className="h-3.5 w-3.5" />
                        </span>
                      </button>
                    ) : null}
                    {!isStandaloneMode ? (
                      <>
                        <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Client *
                        </label>
                        <select
                          value={
                            ownCompanyClient && formData.companyId === ownCompanyClient.id
                              ? ''
                              : formData.companyId
                          }
                          onChange={(e) =>
                            setFormData((prev) => ({ ...prev, companyId: e.target.value }))
                          }
                          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                        >
                          <option value="">Select a client…</option>
                          {crmClients.map((client) => (
                            <option key={client.id} value={client.id}>
                              {client.companyName || client.id}
                            </option>
                          ))}
                        </select>
                        <p className="text-xs text-slate-500">
                          Hire under your own company above, or link this job to a client. Continue to upload a JD.
                        </p>
                      </>
                    ) : (
                      <p className="text-xs text-slate-500">
                        This job will be created under your organization and visible to all team members.
                      </p>
                    )}
                  </div>
                </DrawerSectionCard>
              ) : null}

              {wizardStep === 'jd' ? (
                <DrawerSectionCard
                  title="Upload Job Description"
                  icon={Upload}
                  accent="blue"
                >
                  <div className="space-y-4">
                    <input
                      ref={smartJobFileInputRef}
                      type="file"
                      accept=".pdf,.doc,.docx,.txt,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        e.target.value = '';
                        void handleSmartJobFilePick(file);
                      }}
                    />
                    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-blue-200 bg-blue-50/40 px-4 py-10 text-center">
                      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-md">
                        {aiGenerating ? (
                          <Loader2 className="h-5 w-5 animate-spin" />
                        ) : (
                          <FileText className="h-5 w-5" />
                        )}
                      </span>
                      <div>
                        <p className="text-sm font-semibold text-slate-900">
                          {aiGenerating ? 'Extracting job details…' : 'Upload a JD file'}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">PDF, DOC, DOCX, or TXT</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => smartJobFileInputRef.current?.click()}
                        disabled={aiGenerating}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-60"
                      >
                        <Upload className="h-4 w-4" />
                        Upload JD
                      </button>
                    </div>
                    {smartJobAttachment ? (
                      <div className="flex items-center gap-2 rounded-lg border border-slate-700/30 bg-slate-900 px-2.5 py-2 text-white">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-600">
                          {smartJobAttachment.status === 'processing' ? (
                            <Loader2 className="h-4 w-4 animate-spin text-white" />
                          ) : (
                            <FileText className="h-4 w-4 text-white" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-medium">{smartJobAttachment.file.name}</p>
                          <p className="text-[11px] text-slate-400">
                            {smartJobAttachment.status === 'processing'
                              ? 'Extracting…'
                              : smartJobAttachment.status === 'error'
                                ? smartJobAttachment.error || 'Failed'
                                : 'Ready — continue to review the form'}
                          </p>
                        </div>
                      </div>
                    ) : null}
                    {smartJobError ? (
                      <p className="rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs text-red-700">
                        {smartJobError}
                      </p>
                    ) : null}
                    <p className="text-xs text-slate-500">
                      Or skip and fill the job form manually on the next step.
                    </p>
                  </div>
                </DrawerSectionCard>
              ) : null}

              {wizardStep === 'details' ? (
              <DrawerSectionCard
                title="Job Details"
                subtitle="Description, role info, and requirements"
                icon={Briefcase}
                accent="blue"
              >
                  <div className="space-y-6">
                    <div>
                      <input
                        ref={smartJobFileInputRef}
                        type="file"
                        accept=".pdf,.doc,.docx,.txt,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          e.target.value = '';
                          void handleSmartJobFilePick(file);
                        }}
                      />

                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h3 className="text-sm font-bold text-slate-900">
                          Job Description{' '}
                          <span className="font-normal text-slate-500">(optional)</span>
                        </h3>
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => smartJobFileInputRef.current?.click()}
                            onDragOver={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                            }}
                            onDrop={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              const file = e.dataTransfer.files?.[0];
                              if (file) void handleSmartJobFilePick(file);
                            }}
                            disabled={aiGenerating}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 hover:border-blue-300 hover:bg-blue-50/50 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            <Upload className="h-3.5 w-3.5 text-blue-600" />
                            Upload Job Description
                            <span className="font-normal text-slate-500">· PDF, DOC, DOCX, TXT</span>
                          </button>
                        </div>
                      </div>

                      <p className="mt-1 mb-3 text-xs text-slate-500">
                        Upload a JD or paste and edit the full posting below.
                      </p>

                      {smartJobAttachment ? (
                        <div className="mb-3">
                          <div className="flex items-center gap-2 rounded-lg border border-slate-700/30 bg-slate-900 px-2.5 py-2 text-white">
                            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-600">
                              {smartJobAttachment.status === 'processing' ? (
                                <Loader2 className="h-4 w-4 animate-spin text-white" strokeWidth={2.25} />
                              ) : (
                                <FileText className="h-4 w-4 text-white" strokeWidth={2} />
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-xs font-medium leading-tight">
                                {smartJobAttachment.file.name}
                              </p>
                              <p className="text-[11px] leading-tight text-slate-400">
                                {smartJobAttachment.status === 'processing'
                                  ? 'Extracting job details…'
                                  : smartJobAttachment.status === 'error'
                                    ? smartJobAttachment.error || 'Processing failed'
                                    : 'Ready — review the form and publish'}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                clearSmartJobAttachment();
                                setUploadedFile(null);
                                setExistingOtherDocName('');
                              }}
                              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
                              aria-label="Remove attached file"
                              title="Remove file"
                              disabled={smartJobAttachment.status === 'processing'}
                            >
                              <X size={12} strokeWidth={2.5} />
                            </button>
                          </div>
                        </div>
                      ) : null}

                      {smartJobAttachment && smartJobError ? (
                        <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs text-red-700">
                          {smartJobError}
                        </p>
                      ) : null}

                      {isOpen ? (
                        <div onPasteCapture={handleJobDescriptionPaste}>
                          <RichTextEditor
                            value={formData.jobDescriptionHtml}
                            onChange={(html) => setFormData((prev) => ({ ...prev, jobDescriptionHtml: html }))}
                            placeholder="Paste or enter the full job description…"
                            minHeight={360}
                          />
                        </div>
                      ) : null}
                    </div>

                    <div className="border-t border-slate-100" />

                    <CreateJobDetailsForm
                      formData={jobDetailsFormData}
                      setFormData={patchJobDetailsForm}
                      clients={
                        ownCompanyClient
                          ? [
                              ownCompanyClient,
                              ...crmClients.filter((client) => client.id !== ownCompanyClient.id),
                            ]
                          : crmClients
                      }
                      users={users}
                      contacts={contacts}
                      loadingClients={loadingClients}
                      loadingUsers={loadingUsers}
                      loadingContacts={loadingContacts}
                      dropdownsOpen={dropdownsOpen}
                      setDropdownsOpen={setDropdownsOpen}
                      skillInput={skillInput}
                      setSkillInput={setSkillInput}
                      onAddSkill={addSkill}
                      onRemoveSkill={removeSkill}
                      hideCompanyField={isStandaloneMode}
                      standaloneWorkspaceName={isStandaloneMode ? ownCompanyDisplayName : undefined}
                      ownCompanyDisplayName={ownCompanyDisplayName}
                      workspaceOwnerHeading={workspaceOwnerHeading}
                      useLineManagerPicker={useLineManagerPicker}
                      lineManagerOptions={lineManagers}
                      loadingLineManagers={loadingLineManagers}
                    />
                  </div>
              </DrawerSectionCard>
              ) : null}

              {wizardStep === 'application' ? (
              <DrawerSectionCard
                title="Job Application Form"
                subtitle="Application fields and pre-screen assessments"
                icon={FileText}
                accent="violet"
              >
                  <div className="space-y-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.enableApplicationForm}
                        onChange={(e) => setFormData(prev => ({ ...prev, enableApplicationForm: e.target.checked }))}
                        className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                      />
                      <span className="text-sm font-medium text-slate-700">
                        Enable Job Application Form
                        <span className="text-xs text-slate-500 ml-1">(Required To Post On Partner Job Boards)</span>
                      </span>
                    </label>

                    {formData.enableApplicationForm && (
                      <>
                        {isEditMode ? (
                          <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-4 space-y-3">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div>
                                <p className="text-sm font-semibold text-slate-900">Custom application form</p>
                                <p className="text-xs text-slate-600">
                                  Build fields (email, phone, resume, education, work history, etc.). Saved with this job and used on the public apply link after publish.
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={() => setShowFormBuilder(true)}
                                className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-700"
                              >
                                Edit / Create form
                              </button>
                            </div>
                            <p className="text-xs text-slate-600">
                              {(formData.applicationFormSchema?.fields?.length ?? 0)} field(s) configured
                            </p>
                          </div>
                        ) : null}
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-2">Logo selection</label>
                          <div className="space-y-2">
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="radio"
                                name="logoOption"
                                value="account"
                                checked={formData.logoOption === 'account'}
                                onChange={(e) => {
                                  const v = e.target.value as ApplicationLogoOption;
                                  setFormData((prev) => ({
                                    ...prev,
                                    logoOption: v,
                                    applicationLogoUrl: '',
                                  }));
                                }}
                                className="w-4 h-4 text-blue-600 border-slate-300 focus:ring-blue-500"
                              />
                              <span className="text-sm text-slate-700">Your Account Logo</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="radio"
                                name="logoOption"
                                value="company"
                                checked={formData.logoOption === 'company'}
                                onChange={(e) => {
                                  const v = e.target.value as ApplicationLogoOption;
                                  setFormData((prev) => ({
                                    ...prev,
                                    logoOption: v,
                                    applicationLogoUrl: '',
                                  }));
                                }}
                                className="w-4 h-4 text-blue-600 border-slate-300 focus:ring-blue-500"
                              />
                              <span className="text-sm text-slate-700">Job's Company Logo</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="radio"
                                name="logoOption"
                                value="none"
                                checked={formData.logoOption === 'none'}
                                onChange={(e) => {
                                  const v = e.target.value as ApplicationLogoOption;
                                  setFormData((prev) => ({
                                    ...prev,
                                    logoOption: v,
                                    applicationLogoUrl: '',
                                  }));
                                }}
                                className="w-4 h-4 text-blue-600 border-slate-300 focus:ring-blue-500"
                              />
                              <span className="text-sm text-slate-700">No logo</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="radio"
                                name="logoOption"
                                value="custom"
                                checked={formData.logoOption === 'custom'}
                                onChange={(e) => {
                                  const v = e.target.value as ApplicationLogoOption;
                                  setFormData((prev) => ({
                                    ...prev,
                                    logoOption: v,
                                    applicationLogoUrl: v === 'custom' ? prev.applicationLogoUrl : '',
                                  }));
                                }}
                                className="w-4 h-4 text-blue-600 border-slate-300 focus:ring-blue-500"
                              />
                              <span className="text-sm text-slate-700">Uploaded logo (Cloudinary)</span>
                            </label>
                          </div>

                          <div className="mt-3 pt-3 border-t border-slate-100 space-y-3">
                            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
                              <DocumentUploadButton
                                variant="secondary"
                                label="Upload logo"
                                uploadingLabel="Uploading"
                                accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
                                isUploading={uploadingApplicationLogo}
                                uploadSuccess={logoUploadFeedback.uploadSuccess}
                                uploadPercent={logoUploadFeedback.uploadPercent}
                                onFilesSelected={async (files) => {
                                  const file = files[0];
                                  if (file) await handleApplicationLogoFileChange(file);
                                }}
                              />
                              <p className="text-xs text-slate-500 max-w-md">
                                Images are stored in <span className="font-medium text-slate-600">Cloudinary</span> via your API.
                                {isEditMode && jobId
                                  ? ' Upload is attached to this job.'
                                  : ' Select a company in Job Details first so the file can be uploaded under that client.'}
                              </p>
                            </div>
                            {formData.applicationLogoUrl ? (
                              <div className="flex flex-wrap items-start gap-3 rounded-xl border border-slate-200 bg-slate-50/80 p-3">
                                <img
                                  src={formData.applicationLogoUrl}
                                  alt="Uploaded application form logo"
                                  className="h-20 max-h-24 w-auto max-w-[220px] rounded-lg border border-slate-200 bg-white object-contain p-1"
                                />
                                <div className="flex flex-col gap-2">
                                  <p className="text-xs font-medium text-slate-600">Preview</p>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setFormData((prev) => ({
                                        ...prev,
                                        applicationLogoUrl: '',
                                        logoOption: prev.logoOption === 'custom' ? 'none' : prev.logoOption,
                                      }))
                                    }
                                    className="self-start text-xs font-semibold text-red-600 hover:text-red-700"
                                  >
                                    Remove uploaded logo
                                  </button>
                                </div>
                              </div>
                            ) : null}
                          </div>
                        </div>

                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <label className="block text-sm font-medium text-slate-700">Job Application Form Questions</label>
                            <span className="text-xs text-slate-500">Shown to candidates when they click Apply</span>
                          </div>

                          {formData.applicationQuestions.length > 0 ? (
                            <div className="space-y-3">
                              {formData.applicationQuestions.map((question, index) => {
                                const updateQuestion = (patch: Partial<ScreeningQuestion>) => {
                                  setFormData((prev) => ({
                                    ...prev,
                                    applicationQuestions: prev.applicationQuestions.map((q, i) =>
                                      i === index ? { ...q, ...patch } : q
                                    ),
                                  }));
                                };
                                const removeQuestion = () => {
                                  setFormData((prev) => ({
                                    ...prev,
                                    applicationQuestions: prev.applicationQuestions.filter((_, i) => i !== index),
                                  }));
                                };
                                const setOption = (optionIndex: number, value: string) => {
                                  const next = [...(question.options || [])];
                                  next[optionIndex] = value;
                                  updateQuestion({ options: next });
                                };
                                const addOption = () => {
                                  updateQuestion({ options: [...(question.options || []), ''] });
                                };
                                const removeOption = (optionIndex: number) => {
                                  updateQuestion({
                                    options: (question.options || []).filter((_, i) => i !== optionIndex),
                                  });
                                };
                                return (
                                  <div
                                    key={question.id}
                                    className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm"
                                  >
                                    <div className="flex flex-wrap items-center gap-2 mb-2">
                                      <span className="text-xs font-semibold text-slate-500">#{index + 1}</span>
                                      <select
                                        value={question.type}
                                        onChange={(e) => {
                                          const nextType = e.target.value as ScreeningQuestionType;
                                          const patch: Partial<ScreeningQuestion> = { type: nextType };
                                          if (nextType === 'single_choice' && !(question.options && question.options.length)) {
                                            patch.options = ['', ''];
                                          }
                                          if (nextType === 'slider') {
                                            if (typeof question.min !== 'number') patch.min = 0;
                                            if (typeof question.max !== 'number') patch.max = 100;
                                            if (typeof question.step !== 'number') patch.step = 1;
                                            if (!question.minLabel) patch.minLabel = 'Beginner';
                                            if (!question.maxLabel) patch.maxLabel = 'Expert';
                                          }
                                          updateQuestion(patch);
                                        }}
                                        className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                      >
                                        {SCREENING_TYPE_OPTIONS.map((opt) => (
                                          <option key={opt.value} value={opt.value}>
                                            {opt.label}
                                          </option>
                                        ))}
                                      </select>
                                      <label className="ml-auto inline-flex items-center gap-1.5 text-xs text-slate-600">
                                        <input
                                          type="checkbox"
                                          checked={!!question.required}
                                          onChange={(e) => updateQuestion({ required: e.target.checked })}
                                          className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                        />
                                        Required
                                      </label>
                                      <button
                                        type="button"
                                        onClick={removeQuestion}
                                        className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                                        title="Delete question"
                                      >
                                        <X size={16} />
                                      </button>
                                    </div>

                                    <input
                                      type="text"
                                      value={question.label}
                                      onChange={(e) => updateQuestion({ label: e.target.value })}
                                      placeholder="Type your question here…"
                                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                    />

                                    <p className="mt-1 text-[11px] text-slate-500">
                                      {SCREENING_TYPE_OPTIONS.find((o) => o.value === question.type)?.hint}
                                    </p>

                                    {question.type === 'single_choice' && (
                                      <div className="mt-3 space-y-2">
                                        <p className="text-xs font-medium text-slate-600">Options</p>
                                        {(question.options || []).map((opt, optionIndex) => (
                                          <div key={optionIndex} className="flex items-center gap-2">
                                            <input
                                              type="text"
                                              value={opt}
                                              onChange={(e) => setOption(optionIndex, e.target.value)}
                                              placeholder={`Option ${optionIndex + 1}`}
                                              className="flex-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                            />
                                            <button
                                              type="button"
                                              onClick={() => removeOption(optionIndex)}
                                              className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                                              title="Remove option"
                                            >
                                              <X size={14} />
                                            </button>
                                          </div>
                                        ))}
                                        <button
                                          type="button"
                                          onClick={addOption}
                                          className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700"
                                        >
                                          <Plus size={14} /> Add option
                                        </button>
                                      </div>
                                    )}

                                    {question.type === 'slider' && (
                                      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                                        <div>
                                          <label className="block text-[11px] font-medium text-slate-600 mb-1">Min value</label>
                                          <input
                                            type="number"
                                            value={typeof question.min === 'number' ? question.min : 0}
                                            onChange={(e) => updateQuestion({ min: Number(e.target.value) })}
                                            className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                          />
                                        </div>
                                        <div>
                                          <label className="block text-[11px] font-medium text-slate-600 mb-1">Max value</label>
                                          <input
                                            type="number"
                                            value={typeof question.max === 'number' ? question.max : 100}
                                            onChange={(e) => updateQuestion({ max: Number(e.target.value) })}
                                            className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                          />
                                        </div>
                                        <div>
                                          <label className="block text-[11px] font-medium text-slate-600 mb-1">Min label</label>
                                          <input
                                            type="text"
                                            value={question.minLabel || ''}
                                            onChange={(e) => updateQuestion({ minLabel: e.target.value })}
                                            placeholder="Beginner"
                                            className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                          />
                                        </div>
                                        <div>
                                          <label className="block text-[11px] font-medium text-slate-600 mb-1">Max label</label>
                                          <input
                                            type="text"
                                            value={question.maxLabel || ''}
                                            onChange={(e) => updateQuestion({ maxLabel: e.target.value })}
                                            placeholder="Expert"
                                            className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                          />
                                        </div>
                                      </div>
                                    )}

                                    {question.type === 'yes_no' && (
                                      <p className="mt-2 text-[11px] text-slate-500">
                                        Candidates will see two buttons: <span className="font-medium">Yes</span> and{' '}
                                        <span className="font-medium">No</span>.
                                      </p>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <p className="text-sm text-slate-500 italic">No questions added yet.</p>
                          )}

                          <div className="mt-3 flex flex-wrap gap-2">
                            {SCREENING_TYPE_OPTIONS.map((opt) => (
                              <button
                                key={opt.value}
                                type="button"
                                onClick={() => {
                                  const base: ScreeningQuestion = {
                                    id: generateScreeningQuestionId(),
                                    type: opt.value,
                                    label: '',
                                    required: false,
                                  };
                                  if (opt.value === 'single_choice') base.options = ['', ''];
                                  if (opt.value === 'slider') {
                                    base.min = 0;
                                    base.max = 100;
                                    base.step = 1;
                                    base.minLabel = 'Beginner';
                                    base.maxLabel = 'Expert';
                                  }
                                  setFormData((prev) => ({
                                    ...prev,
                                    applicationQuestions: [...prev.applicationQuestions, base],
                                  }));
                                }}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:border-blue-500 hover:text-blue-600 transition-colors"
                              >
                                <Plus size={14} /> {opt.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-2">
                            Note For Candidates
                            <span className="text-xs text-slate-500 ml-1">(Required To Post On Partner Job Boards, If Job Description Is Not Provided In Text Format)</span>
                          </label>
                          <textarea
                            value={formData.noteForCandidates}
                            onChange={(e) => setFormData(prev => ({ ...prev, noteForCandidates: e.target.value }))}
                            rows={4}
                            placeholder="Add a note for candidates..."
                            className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-y"
                          />
                        </div>
                      </>
                    )}

                    <PreScreenAssessmentSection
                      jobId={isEditMode ? jobId : undefined}
                      jobTitle={formData.jobTitle}
                      skills={formData.skills}
                      jobDescription={
                        formData.jobSummary?.trim() ||
                        formData.jobDescriptionHtml?.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() ||
                        ''
                      }
                      links={formData.preScreenAssessments ?? []}
                      onChange={(preScreenAssessments) =>
                        setFormData((prev) => ({
                          ...prev,
                          preScreenAssessments: Array.isArray(preScreenAssessments)
                            ? preScreenAssessments
                            : [],
                        }))
                      }
                    />
                  </div>
              </DrawerSectionCard>
              ) : null}

              {wizardStep === 'publish' ? (
              <DrawerSectionCard
                title="Publish & Share"
                subtitle="LinkedIn, social channels, and job board publishing"
                icon={Share2}
                accent="sky"
              >
                  <div className="space-y-4">
                    {/* LinkedIn Card */}
                    <div className="border border-slate-200 rounded-xl p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
                            <Linkedin size={20} className="text-blue-600" />
                          </div>
                          <div>
                            <h4 className="text-sm font-bold text-slate-900">LinkedIn</h4>
                            <p className="text-xs text-slate-500">Share a hiring post to your LinkedIn feed</p>
                          </div>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={formData.linkedInEnabled}
                            onChange={(e) => setFormData(prev => ({ ...prev, linkedInEnabled: e.target.checked }))}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                        </label>
                      </div>

                      {formData.linkedInEnabled && (
                        <div className="mt-4 space-y-4 border-t border-slate-100 pt-4">
                          <SocialAccountPicker
                            provider="linkedin"
                            accounts={linkedinAccounts}
                            selectedKeys={selectedLinkedInTargets}
                            onSelectionChange={setSelectedLinkedInTargets}
                            onConnect={() => void handleConnectLinkedIn()}
                            onDisconnect={(accountId) => void handleDisconnectLinkedInAccount(accountId)}
                            connecting={connectingLinkedIn}
                            disconnectingId={disconnectingLinkedInId}
                            loading={socialStatusLoading || linkedIn.isLoading}
                          />

                          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="text-sm font-semibold text-slate-900">Post templates</p>
                                <p className="mt-0.5 text-xs text-slate-500">
                                  LinkedIn, X, and Facebook posts use this template. If you have not
                                  created one, they follow Public Visibility by default.
                                </p>
                                {selectedLinkedInTemplateName ? (
                                  <p className="mt-1.5 text-xs font-medium text-blue-700">
                                    Using: {selectedLinkedInTemplateName}
                                  </p>
                                ) : (
                                  <p className="mt-1.5 text-xs text-slate-400">
                                    No template yet — posting from Public Visibility
                                  </p>
                                )}
                              </div>
                              <div className="flex shrink-0 flex-wrap items-center gap-2">
                                {selectedLinkedInTemplateId ? (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSelectedLinkedInTemplateId(null);
                                      setSelectedLinkedInTemplateName(null);
                                      setLinkedInPostSections(null);
                                      applyDefaultLinkedInPostTemplate(null);
                                      setLinkedInPostTextTouched(false);
                                      setTwitterPostTextTouched(false);
                                      setFacebookCaptionTouched(false);
                                    }}
                                    className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                                  >
                                    Clear
                                  </button>
                                ) : null}
                                <button
                                  type="button"
                                  onClick={() => setShowLinkedInTemplateModal(true)}
                                  className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
                                >
                                  <FileText size={13} />
                                  Manage templates
                                </button>
                              </div>
                            </div>
                          </div>

                          {/* LinkedIn post preview — visible while composing; connection required to publish */}
                          {formData.jobTitle && formData.companyId ? (
                            <>
                              {/* LinkedIn Post Preview */}
                              <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">
                                  LinkedIn Post Preview
                                  <span className="text-xs text-slate-500 ml-1">
                                    ({linkedInPostText.length}/{LINKEDIN_POST_MAX_LENGTH} chars)
                                  </span>
                                </label>
                                <LinkedInPostPreview
                                  userName={selectedLinkedInPreviewAccount?.name || linkedIn.linkedinUser?.name || 'Your LinkedIn profile'}
                                  userPicture={selectedLinkedInPreviewAccount?.picture || linkedIn.linkedinUser?.picture}
                                  jobTitle={
                                    isJobFieldPubliclyVisible(formData.publicFieldVisibility, 'jobTitle')
                                      ? formData.jobTitle
                                      : ''
                                  }
                                  company={
                                    isJobFieldPubliclyVisible(
                                      formData.publicFieldVisibility,
                                      'client',
                                      formData.showClientNamePublicly,
                                    )
                                      ? clients.find((c) => c.id === formData.companyId)?.companyName || ''
                                      : ''
                                  }
                                  description={
                                    isJobFieldPubliclyVisible(formData.publicFieldVisibility, 'jobDescription') &&
                                    formData.jobDescriptionHtml
                                      ? formData.jobDescriptionHtml.replace(/<[^>]*>/g, '')
                                      : undefined
                                  }
                                  applyUrl={effectiveApplyUrl}
                                  location={
                                    isJobFieldPubliclyVisible(formData.publicFieldVisibility, 'location')
                                      ? formData.city || formData.state || formData.country || formData.fullAddress || undefined
                                      : undefined
                                  }
                                  postText={linkedInPostText}
                                  imageUrl={linkedInImageUrl || null}
                                />
                              </div>

                              {/* LinkedIn post image */}
                              <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">
                                  Post image (optional)
                                </label>
                                <p className="mb-2 text-xs text-slate-500">
                                  Attach a JPG, PNG, or GIF. It will be published with the LinkedIn post when you save.
                                </p>
                                <div className="flex flex-wrap items-center gap-3">
                                  <DocumentUploadButton
                                    variant="secondary"
                                    label="Upload image"
                                    uploadingLabel="Uploading"
                                    accept="image/png,image/jpeg,image/jpg,image/gif,image/webp"
                                    isUploading={uploadingLinkedInImage}
                                    uploadSuccess={linkedInImageUploadFeedback.uploadSuccess}
                                    uploadPercent={linkedInImageUploadFeedback.uploadPercent}
                                    onFilesSelected={async (files) => {
                                      const file = files[0];
                                      if (file) await handleLinkedInImageFileChange(file);
                                    }}
                                  />
                                  {formData.applicationLogoUrl && !linkedInImageUrl ? (
                                    <button
                                      type="button"
                                      onClick={() => setLinkedInImageUrl(formData.applicationLogoUrl)}
                                      className="text-xs font-semibold text-blue-600 hover:text-blue-700"
                                    >
                                      Use application logo
                                    </button>
                                  ) : null}
                                  {linkedInImageUrl ? (
                                    <button
                                      type="button"
                                      onClick={() => setLinkedInImageUrl('')}
                                      className="text-xs font-semibold text-rose-600 hover:text-rose-700"
                                    >
                                      Remove image
                                    </button>
                                  ) : null}
                                </div>
                                {linkedInImageUrl ? (
                                  <div className="mt-3 overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                      src={linkedInImageUrl}
                                      alt="LinkedIn post"
                                      className="max-h-48 w-full object-contain"
                                    />
                                  </div>
                                ) : null}
                              </div>

                              {/* Editable Post Text */}
                              <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">
                                  Edit Post Text
                                  <span className="text-xs text-slate-500 ml-1">
                                    ({linkedInPostText.length}/{LINKEDIN_POST_MAX_LENGTH} chars)
                                  </span>
                                </label>
                                <textarea
                                  value={linkedInPostText}
                                  onChange={(e) => {
                                    setLinkedInPostTextTouched(true);
                                    const text = e.target.value.substring(0, LINKEDIN_POST_MAX_LENGTH);
                                    setLinkedInPostText(text);
                                  }}
                                  rows={6}
                                  className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-y"
                                  placeholder="LinkedIn post text will be auto-generated..."
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    setLinkedInPostTextTouched(false);
                                    setLinkedInPostText(generatedLinkedInPost);
                                  }}
                                  className="mt-2 text-xs text-blue-600 hover:text-blue-700"
                                >
                                  Regenerate from job details
                                </button>
                              </div>

                              {/* Apply URL */}
                              <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">Application URL</label>
                                <input
                                  type="url"
                                  value={formData.linkedInExternalUrl || effectiveApplyUrl}
                                  onChange={(e) => setFormData(prev => ({ ...prev, linkedInExternalUrl: e.target.value }))}
                                  placeholder={buildCandidatePortalApplyUrlPreview(getTenantDbName())}
                                  className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                />
                                <p className="text-xs text-slate-500 mt-1">
                                  {applicationApplyUrlLoading
                                    ? 'Loading candidate apply link…'
                                    : jobId
                                      ? 'Public candidate apply link for this job (used in LinkedIn and X posts).'
                                      : 'A unique apply link is generated when you save the job. Preview updates as you fill job details.'}
                                </p>
                              </div>

                              {/* Success Toast */}
                              {showLinkedInSuccess && linkedInPostUrl && (
                                <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                                  <div className="flex items-center gap-2 mb-2">
                                    <Check size={16} className="text-green-600" />
                                    <span className="text-sm font-medium text-green-700">Posted to LinkedIn successfully!</span>
                                  </div>
                                  <a
                                    href={linkedInPostUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs text-blue-600 hover:text-blue-700 underline flex items-center gap-1"
                                  >
                                    View post on LinkedIn
                                    <ExternalLink size={12} />
                                  </a>
                                </div>
                              )}

                              {!linkedIn.isConnected ? (
                                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                                  Connect LinkedIn above to publish this post when you save the job.
                                </p>
                              ) : selectedLinkedInTargets.length === 0 ? (
                                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                                  Select at least one LinkedIn account or company page to publish when you save the job.
                                </p>
                              ) : null}

                              {/* Error Display */}
                              {linkedIn.error && (
                                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                                  <div className="flex items-center gap-2">
                                    <AlertCircle size={16} className="text-red-600" />
                                    <span className="text-sm text-red-700">{linkedIn.error}</span>
                                  </div>
                                  {linkedIn.error.includes('expired') && (
                                    <button
                                      type="button"
                                      onClick={handleConnectLinkedIn}
                                      className="mt-2 text-xs text-blue-600 hover:text-blue-700 underline"
                                    >
                                      Reconnect LinkedIn
                                    </button>
                                  )}
                                </div>
                              )}
                            </>
                          ) : (
                            <p className="text-xs text-slate-500">
                              Fill in Job Title and Client in Job Details to generate the LinkedIn preview.
                            </p>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Twitter/X Card */}
                    <div className="border border-slate-200 rounded-xl p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-slate-50 flex items-center justify-center">
                            <Twitter size={20} className="text-slate-900" />
                          </div>
                          <div>
                            <h4 className="text-sm font-bold text-slate-900">Twitter / X</h4>
                            <p className="text-xs text-slate-500">Post job announcement to X</p>
                          </div>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={formData.twitterEnabled}
                            onChange={(e) => setFormData(prev => ({ ...prev, twitterEnabled: e.target.checked }))}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                        </label>
                      </div>

                      {formData.twitterEnabled && (
                        <div className="mt-4 space-y-4 border-t border-slate-100 pt-4">
                          <SocialAccountPicker
                            provider="twitter"
                            accounts={twitterAccounts}
                            selectedKeys={selectedTwitterTargets}
                            onSelectionChange={setSelectedTwitterTargets}
                            onConnect={() => void handleConnectSocialAccount('twitter')}
                            onDisconnect={(connectionId) => void handleDisconnectTwitterAccount(connectionId)}
                            connecting={connectingSocialProvider === 'twitter'}
                            disconnectingId={disconnectingTwitterId}
                            loading={socialStatusLoading}
                          />

                          {formData.jobTitle && formData.companyId ? (
                            <>
                              <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">
                                  X Post Preview
                                  <span className="text-xs text-slate-500 ml-1">({formData.twitterTweetText.length}/280 chars)</span>
                                </label>
                                <TwitterPostPreview
                                  accountName={selectedTwitterPreviewAccount?.name || formData.twitterAccountName}
                                  postText={formData.twitterTweetText}
                                />
                              </div>

                              <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">
                                  Edit tweet text
                                  <span className="text-xs text-slate-500 ml-1">({formData.twitterTweetText.length}/280 chars)</span>
                                </label>
                                <textarea
                                  value={formData.twitterTweetText}
                                  onChange={(e) => {
                                    setTwitterPostTextTouched(true);
                                    const text = e.target.value.substring(0, 280);
                                    setFormData(prev => ({ ...prev, twitterTweetText: text }));
                                  }}
                                  rows={4}
                                  className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-y"
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    setTwitterPostTextTouched(false);
                                    setFormData((prev) => ({ ...prev, twitterTweetText: generatedTwitterPost }));
                                  }}
                                  className="mt-2 text-xs text-blue-600 hover:text-blue-700"
                                >
                                  Regenerate from job details
                                </button>
                              </div>

                              <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">Application URL</label>
                                <input
                                  type="url"
                                  readOnly
                                  value={effectiveApplyUrl}
                                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-700"
                                />
                              </div>
                            </>
                          ) : (
                            <p className="text-xs text-slate-500">
                              Fill in Job Title and Client in Job Details to generate the X preview.
                            </p>
                          )}

                          {!formData.twitterConnected ? (
                            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                              Connect an X account above to publish this post when you save the job.
                            </p>
                          ) : selectedTwitterTargets.length === 0 ? (
                            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                              Select at least one X account to publish when you save the job.
                            </p>
                          ) : null}

                          {formData.twitterConnected ? (
                            <>
                              <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={formData.twitterIncludeLogo}
                                  onChange={(e) => setFormData(prev => ({ ...prev, twitterIncludeLogo: e.target.checked }))}
                                  className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                                />
                                <span className="text-sm text-slate-700">Include company logo image</span>
                              </label>

                              <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">Schedule tweet (optional)</label>
                                <input
                                  type="datetime-local"
                                  min={getLocalDateTimeInputMinNow()}
                                  value={formData.twitterScheduleDate}
                                  onChange={(e) => {
                                    const v = e.target.value;
                                    const min = getLocalDateTimeInputMinNow();
                                    setFormData((prev) => ({
                                      ...prev,
                                      twitterScheduleDate: v ? clampDateTimeLocalToMin(v, min) : '',
                                    }));
                                  }}
                                  className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                />
                              </div>

                              <button
                                type="button"
                                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-100 transition-colors text-sm font-medium"
                              >
                                Preview Tweet
                              </button>
                            </>
                          ) : null}
                        </div>
                      )}
                    </div>

                    {/* Facebook Card */}
                    <div className="border border-slate-200 rounded-xl p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
                            <Facebook size={20} className="text-blue-600" />
                          </div>
                          <div>
                            <h4 className="text-sm font-bold text-slate-900">Facebook</h4>
                            <p className="text-xs text-slate-500">Post to Facebook Page</p>
                          </div>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={formData.facebookEnabled}
                            onChange={(e) => setFormData(prev => ({ ...prev, facebookEnabled: e.target.checked }))}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                        </label>
                      </div>

                      {formData.facebookEnabled && (
                        <div className="mt-4 space-y-4 border-t border-slate-100 pt-4">
                          {!formData.facebookConnected ? (
                            <button
                              type="button"
                              onClick={() => void handleConnectSocialAccount('facebook')}
                              disabled={connectingSocialProvider === 'facebook'}
                              className="w-full px-4 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors text-sm font-medium disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
                            >
                              {connectingSocialProvider === 'facebook' ? (
                                <>
                                  <Loader2 size={16} className="animate-spin" />
                                  Connecting...
                                </>
                              ) : (
                                'Connect Facebook Page'
                              )}
                            </button>
                          ) : (
                            <>
                              <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                                <Check size={16} className="text-green-600" />
                                <span className="text-sm text-green-700">Connected</span>
                              </div>

                              <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">Page selector</label>
                                <select
                                  value={formData.facebookPageId}
                                  onChange={(e) => setFormData(prev => ({ ...prev, facebookPageId: e.target.value }))}
                                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                >
                                  <option value="">Select page</option>
                                  <option value="page1">Company Page 1</option>
                                  <option value="page2">Company Page 2</option>
                                </select>
                              </div>

                              <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">Post caption</label>
                                <textarea
                                  value={formData.facebookCaption}
                                  onChange={(e) => {
                                    setFacebookCaptionTouched(true);
                                    setFormData((prev) => ({ ...prev, facebookCaption: e.target.value }));
                                  }}
                                  rows={4}
                                  className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-y"
                                />
                              </div>

                              <button
                                type="button"
                                className="w-full px-4 py-2.5 bg-blue-50 border border-blue-200 text-blue-700 rounded-xl hover:bg-blue-100 transition-colors text-sm font-medium"
                              >
                                Preview Post
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </div>

                    {/* WhatsApp Card */}
                    <div className="border border-slate-200 rounded-xl p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center">
                            <WhatsAppIcon size={20} className="text-green-600" />
                          </div>
                          <div>
                            <h4 className="text-sm font-bold text-slate-900">WhatsApp Business</h4>
                            <p className="text-xs text-slate-500">Send via WhatsApp Broadcast</p>
                          </div>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={formData.whatsappEnabled}
                            onChange={(e) => setFormData(prev => ({ ...prev, whatsappEnabled: e.target.checked }))}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                        </label>
                      </div>

                      {formData.whatsappEnabled && (
                        <div className="mt-4 space-y-4 border-t border-slate-100 pt-4">
                          <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">WhatsApp Business API phone number</label>
                            <input
                              type="tel"
                              value={formData.whatsappPhoneNumber}
                              onChange={(e) => setFormData(prev => ({ ...prev, whatsappPhoneNumber: e.target.value }))}
                              placeholder="+1234567890"
                              className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">Message template</label>
                            <select
                              value={formData.whatsappTemplate}
                              onChange={(e) => setFormData(prev => ({ ...prev, whatsappTemplate: e.target.value }))}
                              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                            >
                              <option value="">Select template</option>
                              <option>Job Opening Template 1</option>
                              <option>Job Opening Template 2</option>
                            </select>
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">Recipient list</label>
                            <input
                              type="text"
                              placeholder="Enter phone numbers or import CSV"
                              className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
              </DrawerSectionCard>
              ) : null}
              </div>

              {false && !isEditMode ? (
                <div
                  className="flex shrink-0 flex-col overflow-hidden border-t border-slate-200 bg-white"
                  style={smartJobPromptVisible ? { height: smartFillPanelHeight } : undefined}
                >
                  {smartJobPromptVisible ? (
                    <div
                      role="separator"
                      aria-orientation="horizontal"
                      aria-label="Resize smart fill panel"
                      title="Drag to resize"
                      onMouseDown={beginSmartFillResize}
                      className="group flex h-3 shrink-0 cursor-row-resize items-center justify-center border-b border-slate-100 bg-gradient-to-b from-slate-50 to-white hover:from-slate-100 hover:to-slate-50"
                    >
                      <GripHorizontal
                        size={16}
                        className="text-slate-400 transition-colors group-hover:text-slate-600"
                        aria-hidden
                      />
                    </div>
                  ) : null}

                  <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-6 py-2.5">
                    <div className="mb-2 flex shrink-0 items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Sparkles size={16} className="text-blue-600" />
                        <span className="text-sm font-semibold text-slate-900">Smart fill</span>
                        <span className="text-xs text-slate-500">Paste details to auto-fill the form</span>
                      </div>
                      {smartJobPromptVisible ? (
                        <button
                          type="button"
                          onClick={() => setSmartJobPromptVisible(false)}
                          className="text-xs font-medium text-slate-500 hover:text-slate-800"
                        >
                          Hide
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setSmartJobPromptVisible(true)}
                          className="text-xs font-medium text-blue-600 hover:text-blue-700"
                        >
                          Show
                        </button>
                      )}
                    </div>

                    {smartJobPromptVisible ? (
                      <div ref={smartJobPromptBoxRef} className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden">
                        {smartJobError ? (
                          <p className="shrink-0 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs text-red-700">
                            {smartJobError}
                          </p>
                        ) : null}

                        <div className="flex min-h-0 flex-1 flex-col rounded-xl border border-slate-200 bg-slate-50/80 p-2">
                          <div className="flex min-h-0 flex-1 items-end gap-2">
                            <textarea
                              id="job-smart-prompt"
                              value={smartJobPrompt}
                              onChange={(e) => setSmartJobPrompt(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey && !aiGenerating) {
                                  e.preventDefault();
                                  void handleSmartJobProcess();
                                }
                              }}
                              placeholder={'Role: Senior React Developer\nCompany: BluePeak Solutions\nLocation: Bengaluru, India\nSkills: React, TypeScript, Node.js…'}
                              className="h-full min-h-[56px] flex-1 resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm leading-relaxed text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:opacity-60"
                              disabled={aiGenerating}
                            />
                            <button
                              type="button"
                              onClick={() => void handleSmartJobProcess()}
                              disabled={aiGenerating || !smartJobPrompt.trim()}
                              className="mb-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-900 text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                              aria-label={aiGenerating ? 'Processing' : 'Fill form from text'}
                              title={aiGenerating ? 'Processing…' : 'Fill form (Enter)'}
                            >
                              {aiGenerating ? (
                                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                              ) : (
                                <ArrowUp size={15} strokeWidth={2.25} />
                              )}
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : null}

              <div className="relative shrink-0 border-t border-slate-200 bg-white/95 px-6 py-4 backdrop-blur-sm">
                <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-blue-200 to-transparent" />
                <div className="flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={goWizardBack}
                    disabled={
                      (isEditMode && wizardStep === 'details') ||
                      (!isEditMode && wizardStep === 'client')
                    }
                    className="inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Back
                  </button>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void requestCreateJobClose()}
                      className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                    >
                      Cancel
                    </button>
                    {wizardStep === 'publish' ? (
                      <button
                        type="button"
                        onClick={handleSaveJob}
                        disabled={loading}
                        className="inline-flex items-center gap-2 rounded-2xl bg-[#2098C8] px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-[#2098C8]/30 transition hover:bg-[#1A86B3] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <Send size={14} />
                        {loading
                          ? isEditMode
                            ? 'Saving...'
                            : 'Publishing...'
                          : isEditMode
                            ? 'Save Job'
                            : 'Publish Job'}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={goWizardNext}
                        className="inline-flex items-center gap-2 rounded-2xl bg-[#2098C8] px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-[#2098C8]/30 transition hover:bg-[#1A86B3]"
                      >
                        Continue
                        <ArrowRight className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </DetailsModalShell>

          <AnimatePresence>
            {false && showAiPromptBox && (
              <DetailsModalShell
                onBackdropClick={() => setShowAiPromptBox(false)}
                size="lg"
                zIndexClass="z-[70]"
                dialogTitleId="create-job-ai-modal-title"
              >
                <div className="flex items-center justify-between gap-4 border-b border-slate-200 bg-white px-6 py-5">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600">AI Drawer</p>
                    <h3 id="create-job-ai-modal-title" className="mt-1 text-base font-bold text-slate-900">Generate Job Description</h3>
                    <p className="mt-1 text-sm text-slate-500">
                      Use a custom prompt and generate the description with AI.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowAiPromptBox(false)}
                    className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                    aria-label="Close AI drawer"
                  >
                    <X size={18} />
                  </button>
                </div>

                <div className="flex-1 overflow-hidden bg-slate-50">
                  <div className="flex h-full flex-col">
                    <div className="flex-1 overflow-y-auto px-6 py-6">
                      <div className="space-y-4">
                        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
                          <p className="text-[15px] leading-8 text-slate-600">
                            Ask AI to write a strong job description for this role. Include tone, skills, seniority,
                            work mode, responsibilities, or any hiring details you want. Press
                            <span className="mx-1 inline-flex items-center rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-500">
                              Enter
                            </span>
                            to generate.
                          </p>
                        </div>

                        <div className="flex justify-start">
                          <div className="flex max-w-[92%] items-start gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white shadow-sm">
                              AI
                            </div>
                            <div className="max-w-[88%] rounded-[22px] border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-slate-700 shadow-sm">
                              Role: <span className="font-semibold text-slate-900">{aiDetectedRole || formData.jobTitle || 'Will detect from your prompt'}</span>
                            </div>
                          </div>
                        </div>

                        {aiMessages.map((message) => (
                          <div
                            key={message.id}
                            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                          >
                            <div className="flex max-w-[92%] items-start gap-3">
                              {message.role === 'ai' ? (
                                <>
                                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white shadow-sm">
                                    AI
                                  </div>
                                  <div className="max-w-[88%] rounded-[22px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm">
                                    {message.content}
                                  </div>
                                </>
                              ) : (
                                <>
                                  <div className="max-w-[88%] rounded-[22px] bg-blue-600 px-4 py-3 text-sm text-white shadow-sm">
                                    {message.content}
                                  </div>
                                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700 shadow-sm">
                                    You
                                  </div>
                                </>
                              )}
                            </div>
                          </div>
                        ))}

                        {aiQuestionStep === 'company' ? (
                          <div className="flex justify-start">
                            <div className="flex max-w-[92%] items-start gap-3">
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white shadow-sm">
                                AI
                              </div>
                              <div className="w-full max-w-[88%] rounded-[22px] border border-slate-200 bg-white px-4 py-4 shadow-sm">
                                <label className="block text-sm font-medium text-slate-700 mb-2">Choose company</label>
                                <select
                                  value={aiDraftData.companyId}
                                  onChange={(e) => handleAiCompanySelect(e.target.value)}
                                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                >
                                  <option value="">Select company</option>
                                  {clients.map((client) => (
                                    <option key={client.id} value={client.id}>
                                      {client.companyName}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </div>
                          </div>
                        ) : null}

                        {aiDrawerError ? (
                          <div className="flex justify-start">
                            <div className="flex max-w-[92%] items-start gap-3">
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white shadow-sm">
                                AI
                              </div>
                              <div className="max-w-[88%] rounded-[22px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 shadow-sm">
                                {aiDrawerError}
                              </div>
                            </div>
                          </div>
                        ) : null}

                        {aiGenerating ? (
                          <div className="flex justify-start">
                            <div className="flex max-w-[92%] items-start gap-3">
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white shadow-sm">
                                AI
                              </div>
                              <div className="max-w-[88%] rounded-[22px] border border-slate-200 bg-white px-4 py-4 text-sm text-slate-500 shadow-sm">
                                Generating job description...
                              </div>
                            </div>
                          </div>
                        ) : null}

                        {aiGeneratedDescription ? (
                          <div className="flex justify-start">
                            <div className="flex max-w-[92%] items-start gap-3">
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white shadow-sm">
                                AI
                              </div>
                              <div className="max-w-[88%] rounded-[22px] border border-slate-200 bg-white px-4 py-4 shadow-sm">
                                <div className="space-y-4">
                                  <div className="grid grid-cols-2 gap-3">
                                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Job Title</p>
                                      <p className="mt-2 text-sm font-medium text-slate-900">{formData.jobTitle || aiDraftData.jobTitle || '-'}</p>
                                    </div>
                                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Openings</p>
                                      <p className="mt-2 text-sm font-medium text-slate-900">{formData.numberOfOpenings || aiDraftData.openings || '-'}</p>
                                    </div>
                                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Company</p>
                                      <p className="mt-2 text-sm font-medium text-slate-900">
                                        {clients.find((client) => client.id === (formData.companyId || aiDraftData.companyId))?.companyName || '-'}
                                      </p>
                                    </div>
                                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Location</p>
                                      <p className="mt-2 text-sm font-medium text-slate-900">{formData.jobLocation || aiDraftData.location || '-'}</p>
                                    </div>
                                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Work Mode</p>
                                      <p className="mt-2 text-sm font-medium text-slate-900">{formData.jobLocationType || aiDraftData.workMode || '-'}</p>
                                    </div>
                                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Salary</p>
                                      <p className="mt-2 text-sm font-medium text-slate-900">
                                        {(() => {
                                          const min = formData.minSalary;
                                          const max = formData.maxSalary;
                                          if (min && max) return `${formData.currency} ${min} - ${max}`;
                                          if (min) return `${formData.currency} ${min}`;
                                          if (max) return `${formData.currency} ${max}`;
                                          if (formData.salaryInput) return `${formData.currency} ${formData.salaryInput}`;
                                          return aiDraftData.salary || '-';
                                        })()}
                                      </p>
                                    </div>
                                  </div>

                                  {aiDescriptionView.title ? (
                                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                                      <h4 className="text-xl font-semibold text-slate-900">{aiDescriptionView.title}</h4>
                                      {aiDescriptionView.intro.map((paragraph, index) => (
                                        <p key={`${paragraph}-${index}`} className="mt-3 text-sm leading-7 text-slate-600">
                                          {paragraph}
                                        </p>
                                      ))}
                                    </div>
                                  ) : null}

                                  {aiDescriptionView.sections.map((section) => (
                                    <div
                                      key={section.heading}
                                      className="rounded-2xl border border-slate-200 bg-white px-4 py-4"
                                    >
                                      <h5 className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-500">
                                        {section.heading}
                                      </h5>
                                      {section.paragraphs.map((paragraph, index) => (
                                        <p key={`${section.heading}-p-${index}`} className="mt-3 text-sm leading-7 text-slate-600">
                                          {paragraph}
                                        </p>
                                      ))}
                                      {section.items.length ? (
                                        <div className="mt-3 space-y-2">
                                          {section.items.map((item, index) => (
                                            <div
                                              key={`${section.heading}-i-${index}`}
                                              className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-sm text-slate-700"
                                            >
                                              {item}
                                            </div>
                                          ))}
                                        </div>
                                      ) : null}
                                    </div>
                                  ))}

                                  {(aiGeneratedQualification || aiGeneratedSpecialization) ? (
                                    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
                                      <h5 className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-500">
                                        Education
                                      </h5>
                                      {aiGeneratedQualification ? (
                                        <div className="mt-3 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                                          Qualification: {aiGeneratedQualification}
                                        </div>
                                      ) : null}
                                      {aiGeneratedSpecialization ? (
                                        <div className="mt-2 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                                          Specialization: {aiGeneratedSpecialization}
                                        </div>
                                      ) : null}
                                    </div>
                                  ) : null}

                        {aiGeneratedQuestions.length ? (
                          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
                                      <h5 className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-500">
                                        Screening Questions
                                      </h5>
                                      <div className="mt-3 space-y-2">
                                        {aiGeneratedQuestions.map((question, index) => (
                                          <div
                                            key={`screening-question-${index}`}
                                            className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-sm text-slate-700"
                                          >
                                            {index + 1}. {question}
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  ) : null}
                                </div>
                              </div>
                            </div>
                          </div>
                        ) : null}
                        <div ref={aiConversationEndRef} />
                      </div>
                    </div>

                    <div className="border-t border-slate-200 bg-white px-6 py-4">
                      <div className="flex items-center gap-3">
                        <input
                          type="text"
                          value={aiPrompt}
                          onChange={(e) => setAiPrompt(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault();
                              handleGenerateFromPromptBox();
                            }
                          }}
                          placeholder="Message the AI to generate the job description..."
                          className="flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                        />
                        <button
                          type="button"
                          onClick={handleGenerateFromPromptBox}
                          disabled={aiGenerating}
                          className="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-blue-400 text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
                          aria-label="Generate now"
                        >
                          <SendHorizontal size={18} />
                        </button>
                      </div>

                      <div className="mt-3 flex items-center justify-between gap-3">
                        <span className="text-sm text-slate-500">
                          {aiGenerating ? 'Generating job description...' : aiGeneratedDescription ? 'Job description generated' : 'Ready to generate'}
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setShowAiPromptBox(false)}
                            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
                          >
                            Close
                          </button>
                          {aiGeneratedDescription ? (
                          <button
                            type="button"
                            onClick={handleFinalizeAiJob}
                            className="rounded-xl bg-green-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-green-700"
                          >
                            Finalize This Job
                            </button>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </DetailsModalShell>
            )}
          </AnimatePresence>
        </>
      )}
    </AnimatePresence>

      <ApplicationFormBuilderModal
        isOpen={showFormBuilder}
        onClose={() => setShowFormBuilder(false)}
        schema={formData.applicationFormSchema ?? defaultApplicationFormSchema()}
        onChange={(schema) =>
          setFormData((prev) => ({
            ...prev,
            applicationFormSchema: schema,
            enableApplicationForm: true,
          }))
        }
      />

      <LinkedInPostTemplateModal
        isOpen={showLinkedInTemplateModal}
        onClose={() => setShowLinkedInTemplateModal(false)}
        selectedTemplateId={selectedLinkedInTemplateId}
        onApply={(template: JobLinkedInPostTemplate) => {
          applyLinkedInTemplate(template);
        }}
      />
    </>
  );
}
