import type { Lead } from './types';
import type { LeadStatus } from './types';
import { formatDirectorDisplay } from '../../constants/salutations';
import { normalizeContactList } from '../../lib/contact-channels';

const LEAD_SOURCE_OPTIONS = ['Website', 'LinkedIn', 'Email', 'Referral', 'Campaign'] as const;

const STOP_WORDS = new Set([
  'a',
  'an',
  'the',
  'and',
  'or',
  'with',
  'from',
  'in',
  'on',
  'at',
  'to',
  'for',
  'of',
  'me',
  'my',
  'all',
  'any',
  'show',
  'find',
  'search',
  'filter',
  'get',
  'list',
  'lead',
  'leads',
  'having',
  'that',
  'who',
  'are',
  'is',
  'was',
  'be',
]);

export type SmartSearchKeywordChip = {
  id: string;
  value: string;
  label: string;
  kind: 'status' | 'source' | 'recruiter' | 'text';
};

export type LeadsSmartSearchParseResult = {
  keywords: SmartSearchKeywordChip[];
  status: LeadStatus | 'All' | null;
  source: string | null;
  recruiterId: string | null;
  summary: string;
};

export const LEADS_SMART_SEARCH_EXAMPLES = [
  { label: 'New · Website', query: 'new leads from website' },
  { label: 'Qualified · LinkedIn', query: 'qualified leads from LinkedIn' },
  { label: 'Company Acme', query: 'company Acme Bangalore' },
  { label: 'Contacted · Referral', query: 'contacted referral' },
  { label: 'Lost · Email', query: 'lost leads email source' },
] as const;

type RecruiterOption = { id: string; name: string };

/** Map prompt tokens to Prisma/API LeadSource enum values. */
export function normalizeLeadSourceValue(value: string): (typeof LEAD_SOURCE_OPTIONS)[number] | null {
  const token = String(value || '').trim().toLowerCase();
  if (!token) return null;
  if (token === 'website') return 'Website';
  if (token === 'linkedin' || token === 'linked in') return 'LinkedIn';
  if (token === 'email') return 'Email';
  if (token === 'referral') return 'Referral';
  if (token === 'campaign') return 'Campaign';
  const exact = LEAD_SOURCE_OPTIONS.find((source) => source.toLowerCase() === token);
  return exact ?? null;
}

function slugId(prefix: string, value: string): string {
  return `${prefix}-${value.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
}

function matchStatus(query: string, statuses: string[]): LeadStatus | null {
  const explicit = query.match(/\bstatus\s*[:=]\s*([a-z][a-z\s_-]{0,40})/i);
  if (explicit?.[1]) {
    const token = explicit[1].trim().toLowerCase();
    const found = statuses.find((status) => status.toLowerCase() === token);
    if (found) return found as LeadStatus;
  }

  const statusWords = ['new', 'contacted', 'qualified', 'converted', 'lost'] as const;
  for (const word of statusWords) {
    if (new RegExp(`\\b${word}\\b`, 'i').test(query)) {
      const found = statuses.find((status) => status.toLowerCase() === word);
      if (found) return found as LeadStatus;
    }
  }

  return null;
}

function matchSource(query: string): string | null {
  const explicit = query.match(/\bsource\s*[:=]\s*([a-z][a-z\s]*)/i);
  if (explicit?.[1]) {
    const normalized = normalizeLeadSourceValue(explicit[1].trim());
    if (normalized) return normalized;
  }

  const fromMatch = query.match(/\bfrom\s+(website|linkedin|linked\s*in|email|referral|campaign)\b/i);
  if (fromMatch?.[1]) {
    const normalized = normalizeLeadSourceValue(fromMatch[1].replace(/\s+/g, ''));
    if (normalized) return normalized;
  }

  for (const source of LEAD_SOURCE_OPTIONS) {
    if (new RegExp(`\\b${source}\\b`, 'i').test(query)) {
      return source;
    }
  }

  if (/\blinkedin\b/i.test(query) || /\blinked\s*in\b/i.test(query)) {
    return 'LinkedIn';
  }

  return null;
}

function matchRecruiter(query: string, recruiters: RecruiterOption[]): RecruiterOption | null {
  const patterns = [
    /\bassigned\s+to\s+([a-z][a-z0-9\s.'-]{1,60})/i,
    /\brecruiter\s+([a-z][a-z0-9\s.'-]{1,60})/i,
    /\bowner\s+([a-z][a-z0-9\s.'-]{1,60})/i,
  ];

  for (const pattern of patterns) {
    const match = query.match(pattern);
    if (!match?.[1]) continue;
    const token = match[1].trim().toLowerCase();
    const found = recruiters.find((recruiter) => {
      const name = recruiter.name.toLowerCase();
      return name.includes(token) || token.includes(name);
    });
    if (found) return found;
  }

  return null;
}

function extractQuotedPhrases(query: string): string[] {
  const phrases: string[] = [];
  const pattern = /["']([^"']{2,80})["']/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(query)) !== null) {
    if (match[1]?.trim()) phrases.push(match[1].trim());
  }
  return phrases;
}

function extractLabeledPhrase(query: string, labels: string[]): string | null {
  for (const label of labels) {
    const pattern = new RegExp(`\\b${label}\\s*[:=]\\s*([^\\n,;]+)`, 'i');
    const match = query.match(pattern);
    if (match?.[1]?.trim()) return match[1].trim();
  }
  return null;
}

function removePhrasesFromQuery(query: string, phrases: string[]): string {
  let remaining = query;
  for (const phrase of phrases) {
    if (!phrase) continue;
    remaining = remaining.replace(new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), ' ');
  }
  return remaining.replace(/\s+/g, ' ').trim();
}

function extractFreeTextKeywords(query: string, consumed: string[]): string[] {
  const consumedLower = new Set(consumed.map((item) => item.toLowerCase()));
  const emailMatch = query.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi) || [];

  const tokens = query
    .split(/[\s,;]+/)
    .map((token) => token.trim())
    .filter(Boolean);

  const keywords: string[] = [...emailMatch];

  for (const token of tokens) {
    const lower = token.toLowerCase();
    if (token.length < 2) continue;
    if (STOP_WORDS.has(lower)) continue;
    if (consumedLower.has(lower)) continue;
    if (LEAD_SOURCE_OPTIONS.some((source) => source.toLowerCase() === lower)) continue;
    if (['new', 'contacted', 'qualified', 'converted', 'lost'].includes(lower)) continue;
    if (!keywords.some((item) => item.toLowerCase() === lower)) {
      keywords.push(token);
    }
  }

  return keywords;
}

export function parseLeadsSmartSearchPrompt(
  rawPrompt: string,
  options: {
    statuses: string[];
    recruiters: RecruiterOption[];
  },
): LeadsSmartSearchParseResult {
  const prompt = rawPrompt.trim();
  if (!prompt) {
    return {
      keywords: [],
      status: null,
      source: null,
      recruiterId: null,
      summary: 'Enter a prompt first.',
    };
  }

  const keywords: SmartSearchKeywordChip[] = [];
  const consumed: string[] = [];

  const status = matchStatus(prompt, options.statuses);
  if (status) {
    consumed.push(status, String(status).toLowerCase());
    keywords.push({
      id: slugId('status', status),
      value: status,
      label: status,
      kind: 'status',
    });
  }

  const source = matchSource(prompt);
  if (source) {
    consumed.push(source, source.toLowerCase(), `from ${source}`);
    keywords.push({
      id: slugId('source', source),
      value: source,
      label: source,
      kind: 'source',
    });
  }

  const recruiter = matchRecruiter(prompt, options.recruiters);
  if (recruiter) {
    consumed.push(recruiter.name, `assigned to ${recruiter.name}`, `recruiter ${recruiter.name}`);
    keywords.push({
      id: slugId('recruiter', recruiter.id),
      value: recruiter.id,
      label: recruiter.name,
      kind: 'recruiter',
    });
  }

  const quoted = extractQuotedPhrases(prompt);
  for (const phrase of quoted) {
    consumed.push(phrase);
    keywords.push({
      id: slugId('text', phrase),
      value: phrase,
      label: phrase,
      kind: 'text',
    });
  }

  const companyPhrase = extractLabeledPhrase(prompt, ['company', 'organisation', 'organization', 'firm']);
  if (companyPhrase) {
    consumed.push(companyPhrase, `company ${companyPhrase}`);
    if (!keywords.some((item) => item.value.toLowerCase() === companyPhrase.toLowerCase())) {
      keywords.push({
        id: slugId('text', companyPhrase),
        value: companyPhrase,
        label: companyPhrase,
        kind: 'text',
      });
    }
  }

  const locationPhrase = extractLabeledPhrase(prompt, ['location', 'city', 'country']);
  if (locationPhrase) {
    consumed.push(locationPhrase, `location ${locationPhrase}`, `city ${locationPhrase}`);
    if (!keywords.some((item) => item.value.toLowerCase() === locationPhrase.toLowerCase())) {
      keywords.push({
        id: slugId('text', locationPhrase),
        value: locationPhrase,
        label: locationPhrase,
        kind: 'text',
      });
    }
  }

  let remainder = removePhrasesFromQuery(prompt, consumed);
  const freeText = extractFreeTextKeywords(remainder, consumed);
  for (const text of freeText) {
    if (keywords.some((item) => item.value.toLowerCase() === text.toLowerCase())) continue;
    keywords.push({
      id: slugId('text', text),
      value: text,
      label: text,
      kind: 'text',
    });
  }

  if (keywords.length === 0) {
    keywords.push({
      id: slugId('text', prompt),
      value: prompt,
      label: prompt,
      kind: 'text',
    });
  }

  const summary = `Found ${keywords.length} keyword${keywords.length === 1 ? '' : 's'} — showing matching leads`;

  return {
    keywords,
    status,
    source,
    recruiterId: recruiter?.id ?? null,
    summary,
  };
}

/** Live preview while typing the prompt (same chips as apply). */
export function buildSmartSearchPreviewFromPrompt(
  rawPrompt: string,
  options: {
    statuses: string[];
    recruiters: RecruiterOption[];
  },
): SmartSearchKeywordChip[] {
  return parseLeadsSmartSearchPrompt(rawPrompt, options).keywords;
}

export function applyLeadsSmartSearchParseResult(
  parsed: LeadsSmartSearchParseResult,
  setters: {
    setStatusFilter: (value: LeadStatus | 'All') => void;
    setSourceFilter: (value: string) => void;
    setRecruiterFilter: (value: string) => void;
    setActiveSmartKeywords: (keywords: SmartSearchKeywordChip[]) => void;
    setCurrentPage: (page: number) => void;
  },
): void {
  setters.setCurrentPage(1);
  setters.setStatusFilter(parsed.status ?? 'All');
  setters.setSourceFilter(parsed.source ?? '');
  setters.setRecruiterFilter(parsed.recruiterId ?? '');
  setters.setActiveSmartKeywords(parsed.keywords);
}

/** Build searchable text for a lead (all fields keywords can match). */
export function buildLeadSearchHaystack(
  lead: Lead,
  recruiterNameById: Map<string, string>,
): string {
  const assigneeNames = [
    lead.assignedTo?.name,
    ...(lead.assignedToUsers?.map((user) => user.name) || []),
    lead.assignedToId ? recruiterNameById.get(lead.assignedToId) : '',
    ...(lead.assignedToIds || []).map((id) => recruiterNameById.get(id) || ''),
  ]
    .filter(Boolean)
    .join(' ');

  const dynamicFields = Array.isArray(lead.otherDetails)
    ? lead.otherDetails
        .map((item) => `${item?.label || ''} ${item?.value || ''}`)
        .join(' ')
    : '';

  return [
    lead.companyName,
    lead.contactPerson,
    lead.directorName,
    formatDirectorDisplay(lead.directorSalutation, lead.directorName || lead.contactPerson),
    lead.email,
    lead.phone,
    ...normalizeContactList(lead.emails, lead.email),
    ...normalizeContactList(lead.phones, lead.phone),
    lead.location,
    lead.city,
    lead.country,
    lead.industry,
    lead.source,
    lead.status,
    lead.campaignName,
    lead.referralName,
    lead.interestedNeeds,
    lead.notes,
    assigneeNames,
    dynamicFields,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

/** Lead must match every keyword chip (AND). */
export function leadMatchesSmartKeywordChips(
  lead: Lead,
  keywords: SmartSearchKeywordChip[],
  recruiterNameById: Map<string, string>,
): boolean {
  if (keywords.length === 0) return true;

  const haystack = buildLeadSearchHaystack(lead, recruiterNameById);

  return keywords.every((chip) => {
    const value = chip.value.toLowerCase();
    if (chip.kind === 'status') {
      return String(lead.status || '').toLowerCase() === value;
    }
    if (chip.kind === 'source') {
      return String(lead.source || '').toLowerCase() === value;
    }
    if (chip.kind === 'recruiter') {
      return (
        lead.assignedToId === chip.value ||
        lead.assignedTo?.id === chip.value ||
        (Array.isArray(lead.assignedToIds) && lead.assignedToIds.includes(chip.value))
      );
    }
    return haystack.includes(value);
  });
}

/** @deprecated Use parseLeadsSmartSearchPrompt */
export function parseLeadsSmartSearchQuery(
  rawQuery: string,
  options: { statuses: string[]; recruiters: RecruiterOption[] },
): LeadsSmartSearchParseResult & { searchText: string } {
  const parsed = parseLeadsSmartSearchPrompt(rawQuery, options);
  const textKeywords = parsed.keywords.filter((item) => item.kind === 'text').map((item) => item.value);
  return {
    ...parsed,
    searchText: textKeywords.join(' '),
  };
}
