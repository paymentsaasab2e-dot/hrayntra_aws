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
  applyUrl: string;
};

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
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return raw;
  return parsed.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function appendLine(lines: string[], label: string, value?: string) {
  const v = String(value || '').trim();
  if (v) lines.push(`${label}: ${v}`);
}

export function buildJobSocialDetailLines(input: JobSocialPostInput): string[] {
  const lines: string[] = [];
  const title = String(input.jobTitle || '').trim();
  const company = String(input.companyName || '').trim();

  if (title && company) {
    lines.push(`Role: ${title} at ${company}`);
  } else if (title) {
    lines.push(`Role: ${title}`);
  }

  appendLine(lines, 'Location', formatLocation(input));
  appendLine(lines, 'Openings', input.numberOfOpenings);
  appendLine(lines, 'Priority', input.priority);
  appendLine(lines, 'Employment type', input.employmentType);
  appendLine(lines, 'Industry', input.industryType);
  appendLine(lines, 'Nationality', input.nationality);
  appendLine(lines, 'Target hire date', formatHireDate(input.targetHireDate));
  appendLine(lines, 'Experience', formatExperience(input));
  appendLine(lines, 'Salary', formatSalary(input));

  const skills = (input.skills || []).map((s) => String(s).trim()).filter(Boolean);
  if (skills.length) appendLine(lines, 'Skills', skills.join(', '));

  const languages = formatLanguages(input.languages);
  if (languages) appendLine(lines, 'Languages', languages);

  appendLine(lines, 'Contact', input.contactPersonName);

  const description = stripHtml(input.jobDescriptionHtml || '');
  if (description) {
    const excerpt = description.length > 220 ? `${description.slice(0, 220).trim()}…` : description;
    lines.push('');
    lines.push(excerpt);
  }

  return lines;
}

export function buildLinkedInJobPost(input: JobSocialPostInput, maxLength = 700): string {
  const title = String(input.jobTitle || 'Open role').trim();
  const company = String(input.companyName || 'our team').trim();
  const applyUrl = String(input.applyUrl || '').trim();

  const bodyLines = buildJobSocialDetailLines(input);
  const header = `We're hiring: ${title} at ${company}!`;
  const footer = applyUrl
    ? `\n\nApply now:\n${applyUrl}\n\n#hiring #jobs #careers`
    : '\n\n#hiring #jobs #careers';

  let post = `${header}\n\n${bodyLines.join('\n')}${footer}`;
  if (post.length <= maxLength) return post;

  // Trim description first, then drop lower-priority detail lines
  const compactLines = bodyLines.filter((line) => !line.startsWith('Languages:') && !line.startsWith('Nationality:'));
  post = `${header}\n\n${compactLines.join('\n')}${footer}`;
  if (post.length <= maxLength) return post.substring(0, maxLength);

  const minimal = [
    header,
    formatLocation(input) ? `Location: ${formatLocation(input)}` : '',
    input.numberOfOpenings ? `Openings: ${input.numberOfOpenings}` : '',
    input.employmentType ? `Type: ${input.employmentType}` : '',
    applyUrl ? `Apply: ${applyUrl}` : '',
    '#hiring #jobs #careers',
  ]
    .filter(Boolean)
    .join('\n\n');

  return minimal.substring(0, maxLength);
}

export function buildTwitterJobPost(input: JobSocialPostInput, maxLength = 280): string {
  const title = String(input.jobTitle || 'Open role').trim();
  const company = String(input.companyName || 'our team').trim();
  const applyUrl = String(input.applyUrl || '').trim();
  const location = formatLocation(input);

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

export function buildCandidatePortalApplyUrlPreview(tenantDbName?: string | null): string {
  const base =
    process.env.NEXT_PUBLIC_PHASE1_FRONTEND_URL?.trim() ||
    process.env.NEXT_PUBLIC_JOB_PORTAL_URL?.trim() ||
    (typeof window !== 'undefined'
      ? `${window.location.protocol}//${window.location.hostname}:3000`
      : 'http://localhost:3000');
  const tenant = String(tenantDbName || '').trim();
  const qs = tenant ? `?tenantDbName=${encodeURIComponent(tenant)}` : '';
  return `${base.replace(/\/$/, '')}/apply/[link-on-save]${qs}`;
}
