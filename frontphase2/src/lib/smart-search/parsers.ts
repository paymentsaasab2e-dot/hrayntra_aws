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
  searchText: string;
};

export const JOBS_SMART_SEARCH_EXAMPLES = [
  { label: 'Open · Client', query: 'open active jobs for Acme' },
  { label: 'On hold', query: 'on hold jobs' },
  { label: 'Filled roles', query: 'filled jobs' },
  { label: 'Bangalore', query: 'jobs in Bangalore' },
] as const;

export function parseJobsSmartSearchPrompt(
  rawPrompt: string,
  options: { clients: NamedOption[]; recruiters: AssigneeOption[] },
): JobsSmartSearchResult {
  const prompt = rawPrompt.trim();
  if (!prompt) return { ...emptyParse('jobs'), status: null, clientId: null, recruiterId: null, searchText: '' };

  const keywords: SmartSearchKeywordChip[] = [];
  const consumed: string[] = [];
  const stopWords = new Set([...BASE_STOP_WORDS, 'job', 'jobs', 'role', 'roles', 'position']);

  const status = matchEnumToken(prompt, [
    { patterns: [/\bopen\b/i, /\bactive\b/i], value: 'OPEN' },
    { patterns: [/\bon\s*hold\b/i], value: 'ON_HOLD' },
    { patterns: [/\bclosed\b/i], value: 'CLOSED' },
    { patterns: [/\bdraft\b/i], value: 'DRAFT' },
    { patterns: [/\bfilled\b/i], value: 'FILLED' },
  ]);
  if (status) {
    consumed.push(status, status.toLowerCase().replace('_', ' '));
    keywords.push({ id: slugId('status', status), value: status, label: status.replace('_', ' '), kind: 'status' });
  }

  const client = matchNamedOption(prompt, options.clients, ['client', 'company', 'for']);
  if (client) {
    consumed.push(client.name, `client ${client.name}`, `for ${client.name}`);
    keywords.push({ id: slugId('client', client.id), value: client.id, label: client.name, kind: 'client' });
  }

  const recruiter = matchAssignee(prompt, options.recruiters);
  if (recruiter) {
    consumed.push(recruiter.name, `assigned to ${recruiter.name}`);
    keywords.push({ id: slugId('recruiter', recruiter.id), value: recruiter.id, label: recruiter.name, kind: 'recruiter' });
  }

  for (const phrase of extractQuotedPhrases(prompt)) {
    consumed.push(phrase);
    keywords.push({ id: slugId('text', phrase), value: phrase, label: phrase, kind: 'text' });
  }

  const location = extractLabeledPhrase(prompt, ['location', 'city']);
  if (location) {
    consumed.push(location, `location ${location}`, `in ${location}`);
    keywords.push({ id: slugId('text', location), value: location, label: location, kind: 'text' });
  }

  finalizeKeywords(prompt, keywords, consumed, stopWords);
  const searchText = keywords.filter((k) => k.kind === 'text').map((k) => k.value).join(' ');

  return {
    keywords,
    status,
    clientId: client?.id ?? null,
    recruiterId: recruiter?.id ?? null,
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
};

export const CLIENTS_SMART_SEARCH_EXAMPLES = [
  { label: 'Active clients', query: 'active clients' },
  { label: 'On hold · High', query: 'on hold high priority clients' },
  { label: 'Hot clients', query: 'hot clients' },
  { label: 'Company Acme', query: 'company Acme' },
] as const;

export function parseClientsSmartSearchPrompt(
  rawPrompt: string,
  _options?: { recruiters?: AssigneeOption[] },
): ClientsSmartSearchResult {
  const prompt = rawPrompt.trim();
  if (!prompt) return { ...emptyParse('clients'), activeTab: null, priority: null, ownerScope: null, searchText: '' };

  const keywords: SmartSearchKeywordChip[] = [];
  const consumed: string[] = [];
  const stopWords = new Set([...BASE_STOP_WORDS, 'client', 'clients', 'account', 'accounts']);

  const activeTab = matchEnumToken(prompt, [
    { patterns: [/\bactive\b/i], value: 'active' },
    { patterns: [/\bon\s*hold\b/i], value: 'on-hold' },
    { patterns: [/\binactive\b/i], value: 'inactive' },
    { patterns: [/\bhot\b/i], value: 'hot' },
  ]);
  if (activeTab) {
    consumed.push(activeTab);
    keywords.push({ id: slugId('stage', activeTab), value: activeTab, label: activeTab, kind: 'stage' });
  }

  const priority = matchEnumToken(prompt, [
    { patterns: [/\bhigh\s+priority\b/i, /\bpriority\s+high\b/i, /\bhigh\b/i], value: 'High' },
    { patterns: [/\bmedium\s+priority\b/i, /\bmedium\b/i], value: 'Medium' },
    { patterns: [/\blow\s+priority\b/i, /\blow\b/i], value: 'Low' },
  ]);
  if (priority) {
    consumed.push(priority);
    keywords.push({ id: slugId('priority', priority), value: priority, label: priority, kind: 'priority' });
  }

  const ownerScope = /\b(my|mine)\s+clients?\b/i.test(prompt) ? 'me' : null;
  if (ownerScope) {
    consumed.push('my clients', 'mine');
    keywords.push({ id: 'owner-me', value: 'me', label: 'My clients', kind: 'recruiter' });
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
  ownerId: string;
  company: string;
  location: string;
  jobId: string;
  experienceRange: string;
  searchText: string;
};

const CANDIDATE_STAGE_TOKENS = [
  'new', 'applied', 'longlist', 'shortlist', 'screening', 'submitted', 'interviewing', 'offered', 'hired', 'rejected',
];

export const CANDIDATES_SMART_SEARCH_EXAMPLES = [
  { label: 'Interviewing', query: 'candidates interviewing' },
  { label: 'Shortlist · 5 yrs', query: 'shortlist experience 5-10 years' },
  { label: 'Rejected', query: 'rejected candidates' },
  { label: 'Bangalore', query: 'candidates in Bangalore' },
] as const;

export function parseCandidatesSmartSearchPrompt(
  rawPrompt: string,
  options: { jobs: NamedOption[]; recruiters: AssigneeOption[]; companies?: string[] },
): CandidatesSmartSearchResult {
  const prompt = rawPrompt.trim();
  if (!prompt) {
    return {
      ...emptyParse('candidates'),
      stage: '',
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
    keywords.push({ id: slugId('stage', stageValue), value: stageValue, label: stageValue, kind: 'stage' });
  }

  const experienceRange = matchEnumToken(prompt, [
    { patterns: [/\b0\s*[-–]\s*2\b/, /\b0-2\b/], value: '0-2' },
    { patterns: [/\b2\s*[-–]\s*5\b/, /\b2-5\b/], value: '2-5' },
    { patterns: [/\b5\s*[-–]\s*10\b/, /\b5-10\b/], value: '5-10' },
    { patterns: [/\b10\s*\+/, /\b10\+\b/], value: '10+' },
  ]) || '';

  if (experienceRange) {
    consumed.push(experienceRange);
    keywords.push({ id: slugId('text', experienceRange), value: experienceRange, label: `${experienceRange} yrs`, kind: 'text' });
  }

  const recruiter = matchAssignee(prompt, options.recruiters);
  const ownerId = recruiter?.id || '';
  if (recruiter) {
    consumed.push(recruiter.name);
    keywords.push({ id: slugId('recruiter', recruiter.id), value: recruiter.id, label: recruiter.name, kind: 'recruiter' });
  }

  const job = matchNamedOption(prompt, options.jobs, ['job', 'role', 'position']);
  const jobId = job?.id || '';
  if (job) {
    consumed.push(job.name);
    keywords.push({ id: slugId('client', job.id), value: job.id, label: job.name, kind: 'client' });
  }

  const companyPhrase = extractLabeledPhrase(prompt, ['company', 'client']);
  let company = companyPhrase || '';
  if (!company && options.companies?.length) {
    const hit = options.companies.find((name) => new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(prompt));
    if (hit) company = hit;
  }
  if (company) {
    consumed.push(company);
    keywords.push({ id: slugId('text', company), value: company, label: company, kind: 'text' });
  }

  const location = extractLabeledPhrase(prompt, ['location', 'city']) || '';
  if (location) {
    consumed.push(location, `in ${location}`);
    keywords.push({ id: slugId('text', location), value: location, label: location, kind: 'text' });
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
    { patterns: [/\boffer\s*accepted\b/i], value: 'OFFER_ACCEPTED' },
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

export function clientMatchesSmartKeywordChips(
  client: { name: string; stage?: string; priority?: string; owner?: { name?: string }; industry?: string; location?: string },
  keywords: SmartSearchKeywordChip[],
  currentUserName?: string,
): boolean {
  if (keywords.length === 0) return true;

  const haystack = [
    client.name,
    client.stage,
    client.priority,
    client.owner?.name,
    client.industry,
    client.location,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return keywords.every((chip) => {
    const value = chip.value.toLowerCase();
    if (chip.kind === 'stage') {
      if (chip.value === 'active') return client.stage === 'Active';
      if (chip.value === 'on-hold') return client.stage === 'On Hold';
      if (chip.value === 'inactive') return client.stage === 'Inactive';
      if (chip.value === 'hot') return client.priority === 'High';
      return true;
    }
    if (chip.kind === 'priority') {
      return String(client.priority || '').toLowerCase() === value;
    }
    if (chip.kind === 'recruiter' && chip.value === 'me') {
      const owner = client.owner?.name?.toLowerCase() || '';
      const me = currentUserName?.toLowerCase() || '';
      return me ? owner.includes(me) || me.includes(owner) : true;
    }
    return haystack.includes(value);
  });
}

// Re-export for leads source normalization used in lead parser only
export { normalizeLeadSourceValue };
