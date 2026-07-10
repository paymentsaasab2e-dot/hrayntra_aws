import { normalizeLeadSourceValue } from '../../app/leads/leadsSmartSearch';
import type { AssigneeOption, NamedOption, SmartSearchKeywordChip, SmartSearchParseBase } from './types';
import {
  buildSummary,
  extractLabeledPhrase,
  extractQuotedPhrases,
  finalizeKeywords,
  matchAssignee,
  matchEnumToken,
  matchNamedOption,
  matchStatusFromList,
  slugId,
} from './core';

const BASE_STOP_WORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'with', 'from', 'in', 'on', 'at', 'to', 'for', 'of', 'me', 'my', 'all', 'any',
  'show', 'find', 'search', 'filter', 'get', 'list', 'having', 'that', 'who', 'are', 'is', 'was', 'be',
]);

function emptyParse(entityLabel: string): SmartSearchParseBase {
  return { keywords: [], summary: `Enter a prompt to search ${entityLabel}` };
}

// —— Jobs ——

export type JobsSmartSearchResult = SmartSearchParseBase & {
  status: string | null;
  clientId: string | null;
  recruiterId: string | null;
  priority: string | null;
  employmentType: string | null;
  searchText: string;
  matchingJobIds?: string[];
};

export const JOBS_SMART_SEARCH_EXAMPLES = [
  { label: 'Open · Client', query: 'open active jobs for Acme' },
  { label: 'On hold', query: 'on hold jobs' },
  { label: 'High priority', query: 'high priority open jobs' },
  { label: 'Bengaluru React', query: 'React developer jobs in Bengaluru' },
  { label: 'Full time remote', query: 'full time remote jobs' },
  { label: 'Customer Success', query: 'customer success manager roles' },
  { label: '5+ years', query: 'jobs requiring 5 years experience' },
  { label: 'Indian nationality', query: 'jobs for Indian nationality' },
] as const;

const JOB_STATUS_LABELS: Record<string, string> = {
  OPEN: 'Open',
  ON_HOLD: 'On hold',
  CLOSED: 'Closed',
  DRAFT: 'Draft',
  FILLED: 'Filled',
};

function consumeMatchedPhrases(prompt: string, consumed: string[], patterns: RegExp[]) {
  for (const pattern of patterns) {
    const match = prompt.match(pattern);
    if (match?.[0]) consumed.push(match[0]);
  }
}

export function mergeJobsSmartSearchResult(
  local: JobsSmartSearchResult,
  ai: JobsSmartSearchResult,
): JobsSmartSearchResult {
  const keywords = [...ai.keywords];
  for (const chip of local.keywords) {
    if (chip.kind === 'status' || chip.kind === 'client' || chip.kind === 'recruiter' || chip.kind === 'priority') {
      if (!keywords.some((item) => item.kind === chip.kind && item.value === chip.value)) {
        keywords.push(chip);
      }
    }
  }

  const noiseSearch = /^(on\s*-?\s*hold|onhold|open|active|closed|draft|filled|jobs?|roles?)$/i;
  const aiSearch = String(ai.searchText || '').trim();
  const localSearch = String(local.searchText || '').trim();

  return {
    ...ai,
    keywords,
    status: ai.status || local.status,
    clientId: ai.clientId || local.clientId,
    recruiterId: ai.recruiterId || local.recruiterId,
    priority: ai.priority || local.priority,
    employmentType: ai.employmentType || local.employmentType,
    searchText:
      aiSearch && !noiseSearch.test(aiSearch)
        ? aiSearch
        : localSearch && !noiseSearch.test(localSearch)
          ? localSearch
          : '',
    matchingJobIds: ai.matchingJobIds,
    summary: ai.summary || local.summary,
  };
}

export function parseJobsSmartSearchPrompt(
  rawPrompt: string,
  options: { clients: NamedOption[]; recruiters: AssigneeOption[] },
): JobsSmartSearchResult {
  const prompt = rawPrompt.trim();
  if (!prompt) {
    return {
      ...emptyParse('jobs'),
      status: null,
      clientId: null,
      recruiterId: null,
      priority: null,
      employmentType: null,
      searchText: '',
    };
  }

  const keywords: SmartSearchKeywordChip[] = [];
  const consumed: string[] = [];
  const stopWords = new Set([...BASE_STOP_WORDS, 'job', 'jobs', 'role', 'roles', 'position', 'positions']);

  const status = matchEnumToken(prompt, [
    { patterns: [/\bopen\b/i, /\bactive\b/i], value: 'OPEN' },
    { patterns: [/\bon\s*-?\s*hold\b/i, /\bonhold\b/i], value: 'ON_HOLD' },
    { patterns: [/\bclosed\b/i], value: 'CLOSED' },
    { patterns: [/\bdraft\b/i], value: 'DRAFT' },
    { patterns: [/\bfilled\b/i], value: 'FILLED' },
  ]);
  if (status) {
    consumed.push(status, JOB_STATUS_LABELS[status] || status);
    consumeMatchedPhrases(prompt, consumed, [
      /\bon\s*-?\s*hold\b/i,
      /\bonhold\b/i,
      /\bopen\b/i,
      /\bactive\b/i,
      /\bclosed\b/i,
      /\bdraft\b/i,
      /\bfilled\b/i,
    ]);
    keywords.push({
      id: slugId('status', status),
      value: status,
      label: JOB_STATUS_LABELS[status] || status.replace('_', ' '),
      kind: 'status',
    });
  }

  const priority = matchEnumToken(prompt, [
    { patterns: [/\burgent\b/i], value: 'Urgent' },
    { patterns: [/\bhigh\s+priority\b/i, /\bpriority\s+high\b/i, /\bhigh\b/i], value: 'High' },
    { patterns: [/\bmedium\s+priority\b/i, /\bmedium\b/i], value: 'Medium' },
    { patterns: [/\blow\s+priority\b/i, /\blow\b/i], value: 'Low' },
  ]);
  if (priority) {
    consumed.push(priority);
    consumeMatchedPhrases(prompt, consumed, [
      /\burgent\b/i,
      /\bhigh\s+priority\b/i,
      /\bmedium\s+priority\b/i,
      /\blow\s+priority\b/i,
    ]);
    keywords.push({ id: slugId('priority', priority), value: priority, label: priority, kind: 'priority' });
  }

  const employmentType = matchEnumToken(prompt, [
    { patterns: [/\bfull\s*-?\s*time\b/i], value: 'FULL_TIME' },
    { patterns: [/\bpart\s*-?\s*time\b/i], value: 'PART_TIME' },
    { patterns: [/\bcontract\b/i], value: 'CONTRACT' },
    { patterns: [/\bfreelance\b/i], value: 'FREELANCE' },
    { patterns: [/\binternship\b/i], value: 'INTERNSHIP' },
  ]);
  if (employmentType) {
    consumed.push(employmentType);
    keywords.push({
      id: slugId('employment', employmentType),
      value: employmentType,
      label: employmentType.replace(/_/g, ' ').toLowerCase(),
      kind: 'employment',
    });
  }

  const client = matchNamedOption(prompt, options.clients, ['client', 'company', 'for']);
  if (client) {
    consumed.push(client.name, `client ${client.name}`, `for ${client.name}`);
    keywords.push({ id: slugId('client', client.id), value: client.id, label: client.name, kind: 'client' });
  }

  const recruiter = matchAssignee(prompt, options.recruiters);
  if (recruiter) {
    consumed.push(recruiter.name, `assigned to ${recruiter.name}`, `recruiter ${recruiter.name}`);
    keywords.push({ id: slugId('recruiter', recruiter.id), value: recruiter.id, label: recruiter.name, kind: 'recruiter' });
  }

  const nationality = extractLabeledPhrase(prompt, ['nationality', 'citizen', 'citizenship']);
  if (nationality) {
    consumed.push(nationality, `nationality ${nationality}`);
    keywords.push({ id: slugId('text', nationality), value: nationality, label: nationality, kind: 'text' });
  }

  const industry = extractLabeledPhrase(prompt, ['industry', 'sector']);
  if (industry) {
    consumed.push(industry, `industry ${industry}`);
    keywords.push({ id: slugId('text', industry), value: industry, label: industry, kind: 'text' });
  }

  const location = extractLabeledPhrase(prompt, ['location', 'city', 'in', 'country', 'state']);
  if (location) {
    consumed.push(location, `location ${location}`, `in ${location}`);
    keywords.push({ id: slugId('text', location), value: location, label: location, kind: 'text' });
  }

  const title = extractLabeledPhrase(prompt, ['title', 'role', 'position']);
  if (title) {
    consumed.push(title, `title ${title}`, `role ${title}`);
    keywords.push({ id: slugId('text', title), value: title, label: title, kind: 'text' });
  }

  for (const phrase of extractQuotedPhrases(prompt)) {
    consumed.push(phrase);
    keywords.push({ id: slugId('text', phrase), value: phrase, label: phrase, kind: 'text' });
  }

  finalizeKeywords(prompt, keywords, consumed, stopWords);
  const searchText = keywords.filter((k) => k.kind === 'text').map((k) => k.value).join(' ');

  return {
    keywords,
    status,
    clientId: client?.id ?? null,
    recruiterId: recruiter?.id ?? null,
    priority,
    employmentType,
    searchText,
    summary: buildSummary(keywords, 'jobs'),
  };
}

// —— Clients ——

export type ClientsSmartSearchResult = SmartSearchParseBase & {
  activeTab: string | null;
  priority: string | null;
  ownerScope: 'me' | null;
  searchText: string;
  matchingClientIds?: string[];
};

export const CLIENTS_SMART_SEARCH_EXAMPLES = [
  { label: 'Active clients', query: 'active clients' },
  { label: 'On hold', query: 'on hold clients' },
  { label: 'On hold · High', query: 'on hold high priority clients' },
  { label: 'Hot clients', query: 'hot clients' },
  { label: 'Bengaluru IT', query: 'technology clients in Bengaluru' },
  { label: 'Company Acme', query: 'company Acme' },
  { label: 'KYC pending', query: 'clients with KYC not approved' },
  { label: 'Service charge 8%', query: 'service charge above 8 percent' },
] as const;

const CLIENT_STAGE_LABELS: Record<string, string> = {
  active: 'Active',
  'on-hold': 'On Hold',
  inactive: 'Inactive',
  hot: 'Hot',
};

export function mergeClientsSmartSearchResult(
  local: ClientsSmartSearchResult,
  ai: ClientsSmartSearchResult,
): ClientsSmartSearchResult {
  const keywords = [...ai.keywords];
  for (const chip of local.keywords) {
    if (chip.kind === 'stage' || chip.kind === 'priority' || chip.kind === 'recruiter') {
      if (!keywords.some((item) => item.kind === chip.kind && item.value === chip.value)) {
        keywords.push(chip);
      }
    }
  }

  const noiseSearch = /^(on\s*-?\s*hold|onhold|active|inactive|hot|clients?)$/i;
  const aiSearch = String(ai.searchText || '').trim();
  const localSearch = String(local.searchText || '').trim();

  return {
    ...ai,
    keywords,
    activeTab: ai.activeTab || local.activeTab,
    priority: ai.priority || local.priority,
    ownerScope: ai.ownerScope || local.ownerScope,
    searchText:
      aiSearch && !noiseSearch.test(aiSearch)
        ? aiSearch
        : localSearch && !noiseSearch.test(localSearch)
          ? localSearch
          : '',
    matchingClientIds: ai.matchingClientIds,
    summary: ai.summary || local.summary,
  };
}

export function parseClientsSmartSearchPrompt(
  rawPrompt: string,
  options?: { recruiters?: AssigneeOption[] },
): ClientsSmartSearchResult {
  const prompt = rawPrompt.trim();
  if (!prompt) return { ...emptyParse('clients'), activeTab: null, priority: null, ownerScope: null, searchText: '' };

  const keywords: SmartSearchKeywordChip[] = [];
  const consumed: string[] = [];
  const stopWords = new Set([...BASE_STOP_WORDS, 'client', 'clients', 'account', 'accounts']);

  const activeTab = matchEnumToken(prompt, [
    { patterns: [/\bactive\b/i], value: 'active' },
    { patterns: [/\bon\s*-?\s*hold\b/i, /\bonhold\b/i], value: 'on-hold' },
    { patterns: [/\binactive\b/i], value: 'inactive' },
    { patterns: [/\bhot\b/i], value: 'hot' },
  ]);
  if (activeTab) {
    consumed.push(activeTab, CLIENT_STAGE_LABELS[activeTab] || activeTab);
    consumeMatchedPhrases(prompt, consumed, [
      /\bon\s*-?\s*hold\b/i,
      /\bonhold\b/i,
      /\bactive\b/i,
      /\binactive\b/i,
      /\bhot\b/i,
    ]);
    keywords.push({
      id: slugId('stage', activeTab),
      value: activeTab,
      label: CLIENT_STAGE_LABELS[activeTab] || activeTab,
      kind: 'stage',
    });
  }

  const priority = matchEnumToken(prompt, [
    { patterns: [/\bhigh\s+priority\b/i, /\bpriority\s+high\b/i, /\bhigh\b/i], value: 'High' },
    { patterns: [/\bmedium\s+priority\b/i, /\bmedium\b/i], value: 'Medium' },
    { patterns: [/\blow\s+priority\b/i, /\blow\b/i], value: 'Low' },
  ]);
  if (priority) {
    consumed.push(priority);
    consumeMatchedPhrases(prompt, consumed, [
      /\bhigh\s+priority\b/i,
      /\bpriority\s+high\b/i,
      /\bmedium\s+priority\b/i,
      /\blow\s+priority\b/i,
      /\bhigh\b/i,
      /\bmedium\b/i,
      /\blow\b/i,
    ]);
    keywords.push({ id: slugId('priority', priority), value: priority, label: priority, kind: 'priority' });
  }

  const ownerScope = /\b(my|mine)\s+clients?\b/i.test(prompt) ? 'me' : null;
  if (ownerScope) {
    consumed.push('my clients', 'mine');
    keywords.push({ id: 'owner-me', value: 'me', label: 'My clients', kind: 'recruiter' });
  }

  const assignee = options?.recruiters?.length ? matchAssignee(prompt, options.recruiters) : null;
  if (assignee) {
    consumed.push(assignee.name);
    keywords.push({
      id: slugId('recruiter', assignee.id),
      value: assignee.id,
      label: assignee.name,
      kind: 'recruiter',
    });
  }

  const location = extractLabeledPhrase(prompt, ['location', 'city', 'in', 'country']);
  if (location) {
    consumed.push(location, `location ${location}`, `in ${location}`);
    keywords.push({ id: slugId('text', location), value: location, label: location, kind: 'text' });
  }

  const industry = extractLabeledPhrase(prompt, ['industry', 'sector']);
  if (industry) {
    consumed.push(industry, `industry ${industry}`);
    keywords.push({ id: slugId('text', industry), value: industry, label: industry, kind: 'text' });
  }

  const company = extractLabeledPhrase(prompt, ['company', 'client', 'firm', 'organisation', 'organization']);
  if (company) {
    consumed.push(company, `company ${company}`);
    keywords.push({ id: slugId('text', company), value: company, label: company, kind: 'text' });
  }

  for (const phrase of extractQuotedPhrases(prompt)) {
    consumed.push(phrase);
    keywords.push({ id: slugId('text', phrase), value: phrase, label: phrase, kind: 'text' });
  }

  finalizeKeywords(prompt, keywords, consumed, stopWords);
  const searchText = keywords.filter((k) => k.kind === 'text').map((k) => k.value).join(' ');

  return {
    keywords,
    activeTab,
    priority,
    ownerScope,
    searchText,
    summary: buildSummary(keywords, 'clients'),
  };
}

// —— Candidates ——

export type CandidatesSmartSearchResult = SmartSearchParseBase & {
  stage: string;
  status: string;
  source: string;
  ownerId: string;
  company: string;
  location: string;
  jobId: string;
  experienceRange: string;
  searchText: string;
  matchingCandidateIds?: string[];
};

const CANDIDATE_STAGE_LABELS: Record<string, string> = {
  new: 'New',
  applied: 'Applied',
  longlist: 'Longlist',
  shortlist: 'Shortlist',
  screening: 'Screening',
  submitted: 'Submitted',
  interviewing: 'Interviewing',
  offered: 'Offered',
  hired: 'Hired',
  rejected: 'Rejected',
};

const CANDIDATE_STAGE_TOKENS = Object.keys(CANDIDATE_STAGE_LABELS);

export const CANDIDATES_SMART_SEARCH_EXAMPLES = [
  { label: 'Interviewing', query: 'candidates interviewing' },
  { label: 'React · Bengaluru', query: 'React developers in Bengaluru' },
  { label: 'Accounts Assistant', query: 'candidates on Accounts Assistant job' },
  { label: 'Himanshu recruiter', query: 'candidates assigned to Himanshu' },
  { label: '5+ years', query: 'candidates with 5-10 years experience' },
  { label: 'Phase 1 available', query: 'phase1 candidates available' },
  { label: 'Panvel India', query: 'candidates in Panvel India' },
  { label: 'Frontend SDE', query: 'frontend developer SDE candidates' },
] as const;

export function mergeCandidatesSmartSearchResult(
  local: CandidatesSmartSearchResult,
  ai: CandidatesSmartSearchResult,
): CandidatesSmartSearchResult {
  const keywords = [...ai.keywords];
  for (const chip of local.keywords) {
    if (chip.kind === 'stage' || chip.kind === 'recruiter' || chip.kind === 'client' || chip.kind === 'status') {
      if (!keywords.some((item) => item.kind === chip.kind && item.value === chip.value)) {
        keywords.push(chip);
      }
    }
  }

  const noiseSearch = /^(interviewing|active|new|phase\s*1|phase1|candidates?|available)$/i;
  const aiSearch = String(ai.searchText || '').trim();
  const localSearch = String(local.searchText || '').trim();

  return {
    ...ai,
    keywords,
    stage: ai.stage || local.stage,
    status: ai.status || local.status,
    source: ai.source || local.source,
    ownerId: ai.ownerId || local.ownerId,
    company: ai.company || local.company,
    location: ai.location || local.location,
    jobId: ai.jobId || local.jobId,
    experienceRange: ai.experienceRange || local.experienceRange,
    searchText:
      aiSearch && !noiseSearch.test(aiSearch)
        ? aiSearch
        : localSearch && !noiseSearch.test(localSearch)
          ? localSearch
          : '',
    matchingCandidateIds: ai.matchingCandidateIds,
    summary: ai.summary || local.summary,
  };
}

export function parseCandidatesSmartSearchPrompt(
  rawPrompt: string,
  options: { jobs: NamedOption[]; recruiters: AssigneeOption[]; companies?: string[] },
): CandidatesSmartSearchResult {
  const prompt = rawPrompt.trim();
  if (!prompt) {
    return {
      ...emptyParse('candidates'),
      stage: '',
      status: '',
      source: '',
      ownerId: '',
      company: '',
      location: '',
      jobId: '',
      experienceRange: '',
      searchText: '',
    };
  }

  const keywords: SmartSearchKeywordChip[] = [];
  const consumed: string[] = [];
  const stopWords = new Set([...BASE_STOP_WORDS, 'candidate', 'candidates']);

  const stageMatch = prompt.match(/\bstage\s*[:=]\s*([a-z]+)/i);
  const stageValue =
    (stageMatch?.[1] && CANDIDATE_STAGE_TOKENS.find((s) => s === stageMatch[1].toLowerCase())) ||
    CANDIDATE_STAGE_TOKENS.find((s) => new RegExp(`\\b${s}\\b`, 'i').test(prompt)) ||
    '';

  if (stageValue) {
    consumed.push(stageValue);
    consumeMatchedPhrases(prompt, consumed, [new RegExp(`\\b${stageValue}\\b`, 'i')]);
    keywords.push({
      id: slugId('stage', stageValue),
      value: stageValue,
      label: CANDIDATE_STAGE_LABELS[stageValue] || stageValue,
      kind: 'stage',
    });
  }

  const status = matchEnumToken(prompt, [
    { patterns: [/\bactive\b/i], value: 'ACTIVE' },
    { patterns: [/\bnew\b/i], value: 'NEW' },
    { patterns: [/\bplaced\b/i], value: 'PLACED' },
    { patterns: [/\binactive\b/i], value: 'INACTIVE' },
    { patterns: [/\bblacklisted\b/i], value: 'BLACKLISTED' },
  ]);
  if (status) {
    consumed.push(status);
    keywords.push({ id: slugId('status', status), value: status, label: status, kind: 'status' });
  }

  const source = /\bphase\s*1\b/i.test(prompt) || /\bphase1\b/i.test(prompt) ? 'phase1' : '';
  if (source) {
    consumed.push('phase1', 'phase 1');
    keywords.push({ id: slugId('text', source), value: source, label: 'Phase 1', kind: 'text' });
  }

  const availability = matchEnumToken(prompt, [
    { patterns: [/\bavailable\b/i], value: 'available' },
    { patterns: [/\bnot\s+available\b/i], value: 'not available' },
  ]);
  if (availability) {
    consumed.push(availability);
    keywords.push({ id: slugId('text', availability), value: availability, label: availability, kind: 'text' });
  }

  const experienceRange = matchEnumToken(prompt, [
    { patterns: [/\b0\s*[-–]\s*2\b/, /\b0-2\b/], value: '0-2' },
    { patterns: [/\b2\s*[-–]\s*5\b/, /\b2-5\b/], value: '2-5' },
    { patterns: [/\b5\s*[-–]\s*10\b/, /\b5-10\b/], value: '5-10' },
    { patterns: [/\b10\s*\+/, /\b10\+\b/, /\b5\s*\+\s*years?\b/i], value: '10+' },
  ]) || '';

  if (experienceRange) {
    consumed.push(experienceRange);
    keywords.push({ id: slugId('text', experienceRange), value: experienceRange, label: `${experienceRange} yrs`, kind: 'text' });
  }

  const recruiter = matchAssignee(prompt, options.recruiters);
  const ownerId = recruiter?.id || '';
  if (recruiter) {
    consumed.push(recruiter.name, `assigned to ${recruiter.name}`);
    keywords.push({ id: slugId('recruiter', recruiter.id), value: recruiter.id, label: recruiter.name, kind: 'recruiter' });
  }

  const job = matchNamedOption(prompt, options.jobs, ['job', 'role', 'position', 'assigned']);
  const jobId = job?.id || '';
  if (job) {
    consumed.push(job.name);
    keywords.push({ id: slugId('client', job.id), value: job.id, label: job.name, kind: 'client' });
  }

  const companyPhrase = extractLabeledPhrase(prompt, ['company', 'client', 'employer']);
  let company = companyPhrase || '';
  if (!company && options.companies?.length) {
    const hit = options.companies.find((name) => new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(prompt));
    if (hit) company = hit;
  }
  if (company) {
    consumed.push(company);
    keywords.push({ id: slugId('text', company), value: company, label: company, kind: 'text' });
  }

  const nationality = extractLabeledPhrase(prompt, ['nationality', 'citizen', 'citizenship']);
  if (nationality) {
    consumed.push(nationality, `nationality ${nationality}`);
    keywords.push({ id: slugId('text', nationality), value: nationality, label: nationality, kind: 'text' });
  }

  const skillPhrase = extractLabeledPhrase(prompt, ['skill', 'skills', 'knows', 'knowing']);
  if (skillPhrase) {
    consumed.push(skillPhrase, `skill ${skillPhrase}`);
    keywords.push({ id: slugId('text', skillPhrase), value: skillPhrase, label: skillPhrase, kind: 'text' });
  }

  const location = extractLabeledPhrase(prompt, ['location', 'city', 'in', 'country', 'state']) || '';
  if (location) {
    consumed.push(location, `in ${location}`);
    keywords.push({ id: slugId('text', location), value: location, label: location, kind: 'text' });
  }

  const title = extractLabeledPhrase(prompt, ['title', 'designation', 'role']);
  if (title) {
    consumed.push(title, `role ${title}`);
    keywords.push({ id: slugId('text', title), value: title, label: title, kind: 'text' });
  }

  for (const phrase of extractQuotedPhrases(prompt)) {
    consumed.push(phrase);
    keywords.push({ id: slugId('text', phrase), value: phrase, label: phrase, kind: 'text' });
  }

  finalizeKeywords(prompt, keywords, consumed, stopWords, CANDIDATE_STAGE_TOKENS);
  const searchText = keywords.filter((k) => k.kind === 'text').map((k) => k.value).join(' ');

  return {
    keywords,
    stage: stageValue,
    status,
    source,
    ownerId,
    company,
    location,
    jobId,
    experienceRange,
    searchText,
    summary: buildSummary(keywords, 'candidates'),
  };
}

// —— Interviews ——

export type InterviewsSmartSearchResult = SmartSearchParseBase & {
  status: string;
  round: string;
  mode: string;
  interviewer: string;
  clientJob: string;
  searchText: string;
  matchingInterviewIds?: string[];
};

export const INTERVIEWS_SMART_SEARCH_EXAMPLES = [
  { label: 'Scheduled', query: 'scheduled interviews' },
  { label: 'Technical round', query: 'technical round online' },
  { label: 'Completed', query: 'completed HR round' },
  { label: 'This week', query: 'interviews this week' },
] as const;

export function parseInterviewsSmartSearchPrompt(
  rawPrompt: string,
  options: { interviewers: AssigneeOption[]; clientJobs: string[] },
): InterviewsSmartSearchResult {
  const prompt = rawPrompt.trim();
  if (!prompt) {
    return {
      ...emptyParse('interviews'),
      status: '',
      round: '',
      mode: '',
      interviewer: '',
      clientJob: '',
      searchText: '',
    };
  }

  const keywords: SmartSearchKeywordChip[] = [];
  const consumed: string[] = [];
  const stopWords = new Set([...BASE_STOP_WORDS, 'interview', 'interviews']);

  const statusOptions = ['Scheduled', 'Completed', 'Cancelled', 'Rescheduled', 'No Show'];
  const status = matchStatusFromList(prompt, statusOptions) || '';
  if (status) {
    consumed.push(status);
    keywords.push({ id: slugId('status', status), value: status, label: status, kind: 'status' });
  }

  const roundOptions = ['Screening', 'Technical', 'HR', 'Managerial', 'Client', 'Final'];
  const round = matchStatusFromList(prompt, roundOptions) || '';
  if (round) {
    consumed.push(round);
    keywords.push({ id: slugId('round', round), value: round, label: round, kind: 'round' });
  }

  const mode = matchEnumToken(prompt, [
    { patterns: [/\bonline\b/i, /\bvideo\b/i], value: 'Online' },
    { patterns: [/\boffline\b/i, /\bin[- ]?person\b/i], value: 'Offline' },
    { patterns: [/\bphone\b/i], value: 'Phone' },
  ]) || '';
  if (mode) {
    consumed.push(mode);
    keywords.push({ id: slugId('mode', mode), value: mode, label: mode, kind: 'mode' });
  }

  const interviewerMatch = matchAssignee(prompt, options.interviewers);
  const interviewer = interviewerMatch?.name || '';
  if (interviewerMatch) {
    consumed.push(interviewerMatch.name);
    keywords.push({
      id: slugId('recruiter', interviewerMatch.id),
      value: interviewerMatch.name,
      label: interviewerMatch.name,
      kind: 'recruiter',
    });
  }

  let clientJob = '';
  const clientJobHit = options.clientJobs.find((label) =>
    new RegExp(`\\b${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(prompt),
  );
  if (clientJobHit) {
    clientJob = clientJobHit;
    consumed.push(clientJobHit);
    keywords.push({ id: slugId('client', clientJobHit), value: clientJobHit, label: clientJobHit, kind: 'client' });
  }

  for (const phrase of extractQuotedPhrases(prompt)) {
    consumed.push(phrase);
    keywords.push({ id: slugId('text', phrase), value: phrase, label: phrase, kind: 'text' });
  }

  finalizeKeywords(prompt, keywords, consumed, stopWords);
  const searchText = keywords.filter((k) => k.kind === 'text').map((k) => k.value).join(' ');

  return {
    keywords,
    status,
    round,
    mode,
    interviewer,
    clientJob,
    searchText,
    summary: buildSummary(keywords, 'interviews'),
  };
}

// —— Placements ——

export type PlacementsSmartSearchResult = SmartSearchParseBase & {
  status: string;
  companyId: string;
  recruiterId: string;
  employmentType: string;
  searchText: string;
  matchingPlacementIds?: string[];
};

export const PLACEMENTS_SMART_SEARCH_EXAMPLES = [
  { label: 'Joined', query: 'joined placements' },
  { label: 'Permanent', query: 'permanent employment joined' },
  { label: 'No show', query: 'no show placements' },
  { label: 'Company Acme', query: 'placement company Acme' },
] as const;

export function parsePlacementsSmartSearchPrompt(
  rawPrompt: string,
  options: { clients: NamedOption[]; recruiters: AssigneeOption[] },
): PlacementsSmartSearchResult {
  const prompt = rawPrompt.trim();
  if (!prompt) {
    return {
      ...emptyParse('placements'),
      status: '',
      companyId: '',
      recruiterId: '',
      employmentType: '',
      searchText: '',
    };
  }

  const keywords: SmartSearchKeywordChip[] = [];
  const consumed: string[] = [];
  const stopWords = new Set([...BASE_STOP_WORDS, 'placement', 'placements']);

  const status = matchEnumToken(prompt, [
    { patterns: [/\bjoined\b/i], value: 'JOINED' },
    { patterns: [/\bno\s*show\b/i], value: 'NO_SHOW' },
    { patterns: [/\boffer\s*sent\b/i], value: 'OFFER_SENT' },
    { patterns: [/\boffer\s*accepted\b/i], value: 'OFFER_ACCEPTED' },
    { patterns: [/\boffer\s*reject/i], value: 'OFFER_REJECTED' },
    { patterns: [/\bjoining\s*scheduled\b/i], value: 'JOINING_SCHEDULED' },
    { patterns: [/\bjoining\s*scheduled\b/i], value: 'JOINING_SCHEDULED' },
    { patterns: [/\bwithdrawn\b/i], value: 'WITHDRAWN' },
    { patterns: [/\bfailed\b/i], value: 'FAILED' },
    { patterns: [/\breplacement\b/i], value: 'REPLACEMENT_REQUIRED' },
  ]) || '';

  if (status) {
    consumed.push(status);
    keywords.push({
      id: slugId('status', status),
      value: status,
      label: status.replace(/_/g, ' '),
      kind: 'status',
    });
  }

  const employmentType = matchEnumToken(prompt, [
    { patterns: [/\bpermanent\b/i], value: 'PERMANENT' },
    { patterns: [/\bcontract\b/i], value: 'CONTRACT' },
    { patterns: [/\bfreelance\b/i], value: 'FREELANCE' },
  ]) || '';

  if (employmentType) {
    consumed.push(employmentType);
    keywords.push({
      id: slugId('employment', employmentType),
      value: employmentType,
      label: employmentType,
      kind: 'employment',
    });
  }

  const client = matchNamedOption(prompt, options.clients, ['company', 'client']);
  const companyId = client?.id || '';
  if (client) {
    consumed.push(client.name);
    keywords.push({ id: slugId('client', client.id), value: client.id, label: client.name, kind: 'client' });
  }

  const recruiter = matchAssignee(prompt, options.recruiters);
  const recruiterId = recruiter?.id || '';
  if (recruiter) {
    consumed.push(recruiter.name);
    keywords.push({ id: slugId('recruiter', recruiter.id), value: recruiter.id, label: recruiter.name, kind: 'recruiter' });
  }

  for (const phrase of extractQuotedPhrases(prompt)) {
    consumed.push(phrase);
    keywords.push({ id: slugId('text', phrase), value: phrase, label: phrase, kind: 'text' });
  }

  finalizeKeywords(prompt, keywords, consumed, stopWords);
  const searchText = keywords.filter((k) => k.kind === 'text').map((k) => k.value).join(' ');

  return {
    keywords,
    status,
    companyId,
    recruiterId,
    employmentType,
    searchText,
    summary: buildSummary(keywords, 'placements'),
  };
}

// —— Client-side matchers (extra pass on current page rows) ——

export function candidateMatchesSmartKeywordChips(
  candidate: {
    name: string;
    email?: string;
    phone?: string;
    designation?: string;
    company?: string;
    experience?: number;
    location?: string;
    city?: string;
    country?: string;
    stage?: string;
    owner?: string;
    assignedToId?: string;
    source?: string;
    backendStatus?: string;
    skills?: string[];
    availability?: string;
    noticePeriod?: string;
    education?: string;
    cvSummary?: string;
    languages?: string[];
    certifications?: string[];
    linkedIn?: string;
    portfolio?: string;
    preferredLocation?: string;
    assignedJobs?: string[];
    jobId?: string;
    workExperienceText?: string;
    projectsText?: string;
    nationalityText?: string;
  },
  keywords: SmartSearchKeywordChip[],
): boolean {
  if (keywords.length === 0) return true;

  const haystack = [
    candidate.name,
    candidate.email,
    candidate.phone,
    candidate.designation,
    candidate.company,
    candidate.location,
    candidate.city,
    candidate.country,
    candidate.stage,
    candidate.owner,
    candidate.source,
    candidate.backendStatus,
    candidate.availability,
    candidate.noticePeriod,
    candidate.education,
    candidate.cvSummary,
    candidate.linkedIn,
    candidate.portfolio,
    candidate.preferredLocation,
    candidate.workExperienceText,
    candidate.projectsText,
    candidate.nationalityText,
    candidate.experience != null ? `${candidate.experience} years` : '',
    ...(candidate.skills || []),
    ...(candidate.languages || []),
    ...(candidate.certifications || []),
    ...(candidate.assignedJobs || []),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return keywords.every((chip) => {
    const value = chip.value.toLowerCase();
    if (chip.kind === 'stage') {
      return String(candidate.stage || '').toLowerCase() === value;
    }
    if (chip.kind === 'status') {
      return String(candidate.backendStatus || '').toUpperCase() === chip.value.toUpperCase();
    }
    if (chip.kind === 'recruiter') {
      return (
        candidate.assignedToId === chip.value ||
        String(candidate.owner || '').toLowerCase().includes(value)
      );
    }
    if (chip.kind === 'client') {
      const jobs = (candidate.assignedJobs || []).join(' ').toLowerCase();
      return candidate.jobId === chip.value || jobs.includes(value);
    }
    if (chip.value === '0-2' || chip.value === '2-5' || chip.value === '5-10' || chip.value === '10+') {
      const years = Number(candidate.experience || 0);
      if (chip.value === '0-2') return years >= 0 && years <= 2;
      if (chip.value === '2-5') return years >= 2 && years <= 5;
      if (chip.value === '5-10') return years >= 5 && years <= 10;
      if (chip.value === '10+') return years >= 10;
    }
    if (chip.value === 'phase1') {
      return String(candidate.source || '').toLowerCase().includes('phase1');
    }
    return haystack.includes(value);
  });
}

export function jobMatchesSmartKeywordChips(
  job: {
    title: string;
    client: string;
    clientId?: string;
    location: string;
    status: string;
    backendStatus?: string;
    owner: string;
    recruiterId?: string;
    priority?: string;
    employmentType?: string;
    nationality?: string;
    country?: string;
    state?: string;
    city?: string;
    industry?: string;
    description?: string;
    experienceRequired?: string;
    education?: string;
    hiringManager?: string;
    managerName?: string;
    workMode?: string;
    skills?: string[];
    requirements?: string[];
    keyResponsibilities?: string[];
    preferredSkills?: string[];
    candidateRequirements?: string[];
    benefits?: string[];
    languages?: Array<{ language?: string; proficiency?: string }>;
  },
  keywords: SmartSearchKeywordChip[],
): boolean {
  if (keywords.length === 0) return true;

  const backendStatus = String(job.backendStatus || '').trim().toUpperCase();
  const displayStatus = String(job.status || '').trim();

  const haystack = [
    job.title,
    job.client,
    job.location,
    displayStatus,
    backendStatus,
    job.owner,
    job.priority,
    job.employmentType,
    job.nationality,
    job.country,
    job.state,
    job.city,
    job.industry,
    job.description,
    job.experienceRequired,
    job.education,
    job.hiringManager,
    job.managerName,
    job.workMode,
    ...(job.skills || []),
    ...(job.requirements || []),
    ...(job.keyResponsibilities || []),
    ...(job.preferredSkills || []),
    ...(job.candidateRequirements || []),
    ...(job.benefits || []),
    ...(job.languages || []).map((item) => `${item.language || ''} ${item.proficiency || ''}`),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return keywords.every((chip) => {
    const value = chip.value.toLowerCase();
    if (chip.kind === 'status') {
      if (chip.value === 'OPEN') {
        return backendStatus === 'OPEN' || backendStatus === 'DRAFT' || displayStatus === 'Active';
      }
      if (chip.value === 'ON_HOLD') {
        return backendStatus === 'ON_HOLD' || displayStatus === 'On Hold';
      }
      if (chip.value === 'CLOSED') {
        return backendStatus === 'CLOSED' || displayStatus === 'Closed';
      }
      if (chip.value === 'FILLED') {
        return backendStatus === 'FILLED';
      }
      if (chip.value === 'DRAFT') {
        return backendStatus === 'DRAFT';
      }
      return true;
    }
    if (chip.kind === 'client') {
      return job.clientId === chip.value || job.client.toLowerCase().includes(value);
    }
    if (chip.kind === 'recruiter') {
      return job.recruiterId === chip.value || job.owner.toLowerCase().includes(value);
    }
    if (chip.kind === 'priority') {
      return String(job.priority || '').toLowerCase() === value;
    }
    if (chip.kind === 'employment') {
      return String(job.employmentType || '').toLowerCase().replace(/_/g, ' ').includes(value.replace(/_/g, ' '));
    }
    return haystack.includes(value);
  });
}

export function clientMatchesSmartKeywordChips(
  client: {
    name: string;
    stage?: string;
    leadStatus?: string | null;
    leadStatusValue?: string | null;
    priority?: string;
    owner?: { name?: string };
    industry?: string;
    location?: string;
    city?: string;
    state?: string;
    country?: string;
    website?: string;
    linkedin?: string;
    servicesNeeded?: string;
    expectedBusinessValue?: string;
    hiringLocations?: string;
    companySize?: string;
    teamMemberDesignation?: string;
    teamMemberEmail?: string;
    teamMemberPhone?: string;
    directorSalutation?: string | null;
    emails?: string[];
    phones?: string[];
    agreementsFileName?: string | null;
    agreementLevel?: string | null;
    agreementServiceChargePercent?: string | null;
    agreementTimePeriod?: string | null;
    agreementAdvancePaymentPercent?: string | null;
    agreementContractStartDate?: string | null;
    agreementContractEndDate?: string | null;
    agreementContractValidity?: string | null;
    agreementFreeReplacementValue?: number | null;
    agreementFreeReplacementUnit?: string | null;
    sla?: string;
    healthStatus?: string;
    postServiceKycForm?: unknown;
    otherDetails?: Array<{ label?: string; value?: string }>;
  },
  keywords: SmartSearchKeywordChip[],
  currentUserName?: string,
): boolean {
  if (keywords.length === 0) return true;

  const displayStatus =
    String(client.leadStatus || client.leadStatusValue || client.stage || 'Active').trim() || 'Active';

  const haystack = [
    client.name,
    displayStatus,
    client.stage,
    client.leadStatus,
    client.leadStatusValue,
    client.priority,
    client.owner?.name,
    client.industry,
    client.location,
    client.city,
    client.state,
    client.country,
    client.website,
    client.linkedin,
    client.servicesNeeded,
    client.expectedBusinessValue,
    client.hiringLocations,
    client.companySize,
    client.teamMemberDesignation,
    client.teamMemberEmail,
    client.teamMemberPhone,
    client.directorSalutation,
    ...(client.emails || []),
    ...(client.phones || []),
    client.agreementsFileName,
    client.agreementLevel,
    client.agreementServiceChargePercent,
    client.agreementTimePeriod,
    client.agreementAdvancePaymentPercent,
    client.agreementContractStartDate,
    client.agreementContractEndDate,
    client.agreementContractValidity,
    client.agreementFreeReplacementUnit,
    client.agreementFreeReplacementValue != null ? String(client.agreementFreeReplacementValue) : '',
    client.sla,
    client.healthStatus,
    flattenJsonForSmartSearch(client.postServiceKycForm),
    ...(client.otherDetails || []).map((item) => `${item.label || ''} ${item.value || ''}`),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return keywords.every((chip) => {
    const value = chip.value.toLowerCase();
    if (chip.kind === 'stage') {
      if (chip.value === 'active') return displayStatus === 'Active';
      if (chip.value === 'on-hold') return displayStatus === 'On Hold';
      if (chip.value === 'inactive') return displayStatus === 'Inactive';
      if (chip.value === 'hot') return client.priority === 'High';
      return true;
    }
    if (chip.kind === 'priority') {
      return String(client.priority || '').toLowerCase() === value;
    }
    if (chip.kind === 'recruiter') {
      if (chip.value === 'me') {
        const owner = client.owner?.name?.toLowerCase() || '';
        const me = currentUserName?.toLowerCase() || '';
        return me ? owner.includes(me) || me.includes(owner) : true;
      }
      const owner = client.owner?.name?.toLowerCase() || '';
      return owner.includes(value) || value.includes(owner);
    }
    return haystack.includes(value);
  });
}

function flattenJsonForSmartSearch(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return value.map(flattenJsonForSmartSearch).join(' ');
  if (typeof value === 'object') {
    return Object.values(value as Record<string, unknown>).map(flattenJsonForSmartSearch).join(' ');
  }
  return '';
}

// Re-export for leads source normalization used in lead parser only
export { normalizeLeadSourceValue };
