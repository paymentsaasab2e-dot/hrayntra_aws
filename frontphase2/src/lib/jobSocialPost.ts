import { formatDateDMY } from '../utils/dateDisplay';
import {
  isJobFieldPubliclyVisible,
  parseJobPublicFieldVisibility,
  type JobPublicFieldVisibility,
} from './jobPublicFieldVisibility';
import {
  defaultLinkedInPostTemplateSchema,
  type LinkedInPostSectionKey,
  type LinkedInPostTemplateSection,
} from './jobLinkedInPostTemplate';

export type JobSocialPostInput = {
  jobTitle: string;
  companyName: string;
  contactPersonName?: string;
  numberOfOpenings?: string;
  priority?: string;
  nationality?: string;
  industryType?: string;
  employmentType?: string;
  targetHireDate?: string;
  city?: string;
  state?: string;
  country?: string;
  minExperience?: string;
  maxExperience?: string;
  currency?: string;
  minSalary?: string;
  maxSalary?: string;
  skills?: string[];
  languages?: Array<{ language: string; proficiency: string }>;
  jobDescriptionHtml?: string;
  jobSummary?: string;
  keyResponsibilitiesText?: string;
  qualificationsExperienceText?: string;
  candidateRequirementsText?: string;
  compensationBenefitsText?: string;
  educationalQualification?: string;
  educationalSpecialization?: string;
  applyUrl: string;
  showClientNamePublicly?: boolean;
  publicFieldVisibility?: JobPublicFieldVisibility | null;
  /** Optional section order / visibility from a LinkedIn post template. */
  linkedInPostSections?: LinkedInPostTemplateSection[] | null;
};

/** LinkedIn organic posts allow up to 3000 characters. */
export const LINKEDIN_POST_MAX_LENGTH = 3000;

export function stripHtml(html: string): string {
  return String(html || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function formatLocation(input: JobSocialPostInput): string {
  const parts = [input.city, input.state, input.country].map((p) => String(p || '').trim()).filter(Boolean);
  return parts.join(', ');
}

function formatExperience(input: JobSocialPostInput): string {
  const min = String(input.minExperience || '').trim();
  const max = String(input.maxExperience || '').trim();
  if (min && max) return `${min}–${max} years`;
  if (min) return `${min}+ years`;
  if (max) return `Up to ${max} years`;
  return '';
}

function formatSalary(input: JobSocialPostInput): string {
  const currency = String(input.currency || '').trim();
  const min = String(input.minSalary || '').trim();
  const max = String(input.maxSalary || '').trim();
  if (!min && !max) return '';
  const prefix = currency ? `${currency} ` : '';
  if (min && max) return `${prefix}${min} – ${max}`;
  if (min) return `${prefix}${min}+`;
  return `${prefix}up to ${max}`;
}

function formatLanguages(languages: JobSocialPostInput['languages']): string {
  if (!Array.isArray(languages) || !languages.length) return '';
  return languages
    .map((entry) => {
      const lang = String(entry.language || '').trim();
      const prof = String(entry.proficiency || '').trim();
      return prof ? `${lang} (${prof})` : lang;
    })
    .filter(Boolean)
    .join(', ');
}

function formatHireDate(value?: string): string {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const formatted = formatDateDMY(raw);
  return formatted || raw;
}

function formatEducation(input: JobSocialPostInput): string {
  const qualification = String(input.educationalQualification || '').trim();
  const specialization = String(input.educationalSpecialization || '').trim();
  if (qualification && specialization) return `${qualification} — ${specialization}`;
  return qualification || specialization;
}

function toBulletLines(value?: string): string[] {
  return String(value || '')
    .split(/\r?\n|;/)
    .map((line) => line.replace(/^[-•*\d.)\s]+/, '').trim())
    .filter(Boolean);
}

function appendLine(lines: string[], label: string, value?: string) {
  const v = String(value || '').trim();
  if (v) lines.push(`${label}: ${v}`);
}

function appendSection(lines: string[], heading: string, body?: string) {
  const bullets = toBulletLines(body);
  if (!bullets.length) {
    const plain = String(body || '').trim();
    if (!plain) return;
    lines.push('');
    lines.push(heading);
    lines.push(plain);
    return;
  }
  lines.push('');
  lines.push(heading);
  bullets.forEach((item) => lines.push(`• ${item}`));
}

export function buildJobSocialDetailLines(input: JobSocialPostInput): string[] {
  const lines: string[] = [];
  const visibility = parseJobPublicFieldVisibility(input.publicFieldVisibility);
  const showClient = isJobFieldPubliclyVisible(
    visibility,
    'client',
    input.showClientNamePublicly !== false,
  );
  const title = isJobFieldPubliclyVisible(visibility, 'jobTitle')
    ? String(input.jobTitle || '').trim()
    : '';
  const company = showClient ? String(input.companyName || '').trim() : '';

  const templateSections =
    Array.isArray(input.linkedInPostSections) && input.linkedInPostSections.length
      ? [...input.linkedInPostSections].sort((a, b) => a.order - b.order)
      : defaultLinkedInPostTemplateSchema().sections;

  const sectionVisible = (key: LinkedInPostSectionKey) => {
    const row = templateSections.find((s) => s.key === key);
    if (row && row.visible === false) return false;
    return true;
  };

  const appendSectionByKey = (key: LinkedInPostSectionKey) => {
    if (!sectionVisible(key)) return;

    switch (key) {
      case 'role': {
        if (title && company) lines.push(`Role: ${title} at ${company}`);
        else if (title) lines.push(`Role: ${title}`);
        break;
      }
      case 'location':
        if (isJobFieldPubliclyVisible(visibility, 'location')) {
          appendLine(lines, 'Location', formatLocation(input));
        }
        break;
      case 'openings':
        if (isJobFieldPubliclyVisible(visibility, 'openings')) {
          appendLine(lines, 'Openings', input.numberOfOpenings);
        }
        break;
      case 'priority':
        if (isJobFieldPubliclyVisible(visibility, 'priority')) {
          appendLine(lines, 'Priority', input.priority);
        }
        break;
      case 'employmentType':
        if (isJobFieldPubliclyVisible(visibility, 'employmentType')) {
          appendLine(lines, 'Employment type', input.employmentType);
        }
        break;
      case 'industryType':
        if (isJobFieldPubliclyVisible(visibility, 'industryType')) {
          appendLine(lines, 'Industry', input.industryType);
        }
        break;
      case 'nationality':
        if (isJobFieldPubliclyVisible(visibility, 'nationality')) {
          appendLine(lines, 'Nationality', input.nationality);
        }
        break;
      case 'targetHireDate':
        if (isJobFieldPubliclyVisible(visibility, 'targetHireDate')) {
          appendLine(lines, 'Target hire date', formatHireDate(input.targetHireDate));
        }
        break;
      case 'experience':
        if (isJobFieldPubliclyVisible(visibility, 'experience')) {
          appendLine(lines, 'Experience', formatExperience(input));
        }
        break;
      case 'salary':
        if (isJobFieldPubliclyVisible(visibility, 'salary')) {
          appendLine(lines, 'Salary', formatSalary(input));
        }
        break;
      case 'skills':
        if (isJobFieldPubliclyVisible(visibility, 'skills')) {
          const skills = (input.skills || []).map((s) => String(s).trim()).filter(Boolean);
          if (skills.length) appendLine(lines, 'Skills', skills.join(', '));
        }
        break;
      case 'languages':
        if (isJobFieldPubliclyVisible(visibility, 'languages')) {
          const languages = formatLanguages(input.languages);
          if (languages) appendLine(lines, 'Languages', languages);
        }
        break;
      case 'contactPerson':
        if (isJobFieldPubliclyVisible(visibility, 'contactPerson')) {
          appendLine(lines, 'Contact', input.contactPersonName);
        }
        break;
      case 'overview':
        if (isJobFieldPubliclyVisible(visibility, 'jobDescription')) {
          const summary = String(input.jobSummary || '').trim();
          if (summary) appendSection(lines, 'Overview', summary);
        }
        break;
      case 'keyResponsibilities':
        if (isJobFieldPubliclyVisible(visibility, 'keyResponsibilities')) {
          appendSection(lines, 'Key Responsibilities', input.keyResponsibilitiesText);
        }
        break;
      case 'qualifications':
        if (isJobFieldPubliclyVisible(visibility, 'qualifications')) {
          const education = formatEducation(input);
          const qualificationBullets = toBulletLines(input.qualificationsExperienceText);
          if (education || qualificationBullets.length) {
            lines.push('');
            lines.push('Preferred Education / Qualifications');
            if (education) lines.push(education);
            qualificationBullets.forEach((item) => lines.push(`• ${item}`));
          }
        }
        break;
      case 'candidateRequirements':
        if (isJobFieldPubliclyVisible(visibility, 'candidateRequirements')) {
          appendSection(lines, 'Candidate Requirements', input.candidateRequirementsText);
        }
        break;
      case 'compensationBenefits':
        if (isJobFieldPubliclyVisible(visibility, 'jobDescription')) {
          appendSection(lines, 'Compensation & Benefits', input.compensationBenefitsText);
        }
        break;
      default:
        break;
    }
  };

  templateSections.forEach((section) => appendSectionByKey(section.key));

  // Fallback: if structured JD sections are empty, include HTML description.
  const hasStructuredJd =
    Boolean(String(input.keyResponsibilitiesText || '').trim()) ||
    Boolean(String(input.qualificationsExperienceText || '').trim()) ||
    Boolean(String(input.candidateRequirementsText || '').trim()) ||
    Boolean(String(input.jobSummary || '').trim()) ||
    Boolean(formatEducation(input));

  if (
    !hasStructuredJd &&
    sectionVisible('overview') &&
    isJobFieldPubliclyVisible(visibility, 'jobDescription')
  ) {
    const description = stripHtml(input.jobDescriptionHtml || '');
    if (description) {
      lines.push('');
      lines.push(description);
    }
  }

  return lines;
}

export function buildLinkedInJobPost(
  input: JobSocialPostInput,
  maxLength = LINKEDIN_POST_MAX_LENGTH,
): string {
  const visibility = parseJobPublicFieldVisibility(input.publicFieldVisibility);
  const showClient = isJobFieldPubliclyVisible(
    visibility,
    'client',
    input.showClientNamePublicly !== false,
  );
  const title = isJobFieldPubliclyVisible(visibility, 'jobTitle')
    ? String(input.jobTitle || 'Open role').trim()
    : 'Open role';
  const company = showClient ? String(input.companyName || 'our team').trim() : 'our team';
  const applyUrl = String(input.applyUrl || '').trim();

  const bodyLines = buildJobSocialDetailLines(input);
  const header = `We're hiring: ${title} at ${company}!`;
  const footer = applyUrl
    ? `\n\nApply now:\n${applyUrl}\n\n#hiring #jobs #careers`
    : '\n\n#hiring #jobs #careers';

  const post = `${header}\n\n${bodyLines.join('\n')}${footer}`;
  if (post.length <= maxLength) return post;
  return `${post.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

export function buildTwitterJobPost(input: JobSocialPostInput, maxLength = 280): string {
  const visibility = parseJobPublicFieldVisibility(input.publicFieldVisibility);
  const showClient = isJobFieldPubliclyVisible(
    visibility,
    'client',
    input.showClientNamePublicly !== false,
  );
  const title = isJobFieldPubliclyVisible(visibility, 'jobTitle')
    ? String(input.jobTitle || 'Open role').trim()
    : 'Open role';
  const company = showClient ? String(input.companyName || 'our team').trim() : 'our team';
  const applyUrl = String(input.applyUrl || '').trim();
  const location = isJobFieldPubliclyVisible(visibility, 'location') ? formatLocation(input) : '';

  const parts: string[] = [`We're hiring a ${title} at ${company}!`];
  if (location) parts.push(`📍 ${location}`);
  if (input.numberOfOpenings) parts.push(`${input.numberOfOpenings} opening(s)`);
  if (input.employmentType) parts.push(input.employmentType);
  if (applyUrl) parts.push(`Apply: ${applyUrl}`);
  parts.push('#hiring #jobs');

  let tweet = parts.join(' | ');
  if (tweet.length <= maxLength) return tweet;

  tweet = `We're hiring: ${title} at ${company}!${location ? ` ${location}.` : ''}${applyUrl ? ` Apply: ${applyUrl}` : ''} #hiring`;
  return tweet.substring(0, maxLength);
}

export const APPLY_LINK_TOKEN_PLACEHOLDER = '[link-on-save]';

const PLACEHOLDER_APPLY_URL_RE = /https?:\/\/[^\s]*\/apply\/\[link-on-save\](?:\?[^\s]*)?/gi;

/** Swap pre-save preview apply URLs in social post copy with the real link after the job is saved. */
export function replaceApplyUrlInSocialPostText(
  text: string,
  realApplyUrl: string,
  previewApplyUrl?: string,
): string {
  const body = String(text || '');
  const resolved = String(realApplyUrl || '').trim();
  if (!resolved) return body;

  let next = body;
  const preview = String(previewApplyUrl || '').trim();
  if (preview) {
    next = next.split(preview).join(resolved);
  }
  next = next.replace(PLACEHOLDER_APPLY_URL_RE, resolved);
  if (next.includes(APPLY_LINK_TOKEN_PLACEHOLDER)) {
    next = next.replaceAll(APPLY_LINK_TOKEN_PLACEHOLDER, resolved);
  }
  return next;
}

export function buildCandidatePortalApplyUrlPreview(tenantDbName?: string | null): string {
  const base =
    process.env.NEXT_PUBLIC_PHASE1_FRONTEND_URL?.trim() ||
    process.env.NEXT_PUBLIC_JOB_PORTAL_URL?.trim() ||
    (typeof window !== 'undefined'
      ? `${window.location.protocol}//${window.location.hostname}:3000`
      : 'http://localhost:3000');
  const tenant = String(tenantDbName || '').trim();
  const qs = tenant ? `?tenantDbName=${encodeURIComponent(tenant)}` : '';
  return `${base.replace(/\/$/, '')}/apply/${APPLY_LINK_TOKEN_PLACEHOLDER}${qs}`;
}
