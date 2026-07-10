import { apiFetch } from '../api';
import { slugId } from './core';
import type { LeadsSmartSearchParseResult } from '../../app/leads/leadsSmartSearch';
import type {
  CandidatesSmartSearchResult,
  ClientsSmartSearchResult,
  InterviewsSmartSearchResult,
  JobsSmartSearchResult,
  PlacementsSmartSearchResult,
} from './parsers';
import type { SmartSearchChipKind, SmartSearchKeywordChip } from './types';

export type SmartSearchEntity =
  | 'leads'
  | 'jobs'
  | 'clients'
  | 'candidates'
  | 'interviews'
  | 'placements';

type AiSmartSearchFilters = {
  status?: string;
  source?: string;
  recruiterId?: string;
  clientId?: string;
  companyId?: string;
  activeTab?: string;
  priority?: string;
  ownerScope?: string;
  stage?: string;
  ownerId?: string;
  company?: string;
  location?: string;
  jobId?: string;
  experienceRange?: string;
  round?: string;
  mode?: string;
  interviewer?: string;
  clientJob?: string;
  employmentType?: string;
  searchText?: string;
};

type AiSmartSearchResponse = {
  keywords: Array<{ kind: SmartSearchChipKind; value: string; label: string }>;
  filters: AiSmartSearchFilters;
  matchingLeadIds?: string[];
  matchingJobIds?: string[];
  matchingClientIds?: string[];
  matchingCandidateIds?: string[];
  matchingInterviewIds?: string[];
  matchingPlacementIds?: string[];
  summary: string;
  source?: string;
  tenantDatabase?: {
    tenantDbName: string;
    totalLeads?: number;
    totalRecords?: number;
    leadsLoadedForAi?: number;
    recordsLoadedForAi?: number;
    truncated?: boolean;
  };
};

function normalizeKeywords(
  raw: AiSmartSearchResponse['keywords'] | undefined,
): SmartSearchKeywordChip[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((chip) => {
      const value = String(chip?.value || '').trim();
      const label = String(chip?.label || value).trim() || value;
      const kind = (chip?.kind || 'text') as SmartSearchChipKind;
      if (!value) return null;
      return {
        id: slugId(kind, value),
        value,
        label,
        kind,
      };
    })
    .filter((chip): chip is SmartSearchKeywordChip => chip !== null);
}

export async function fetchAiSmartSearchParse(
  entity: SmartSearchEntity,
  prompt: string,
  context: Record<string, unknown> = {},
): Promise<AiSmartSearchResponse | null> {
  try {
    const response = await apiFetch<AiSmartSearchResponse>('/ai/smart-search/parse', {
      method: 'POST',
      auth: true,
      body: {
        entity,
        prompt,
        context,
        // Backend: AI parses prompt → tenant DB query (low tokens, OPENAI_API_KEY on server).
        useTenantDatabase: true,
      },
    });
    const payload = response?.data;
    if (!payload?.keywords) return null;
    return {
      ...payload,
      keywords: normalizeKeywords(payload.keywords),
    };
  } catch {
    return null;
  }
}

export function mapAiToLeadsResult(ai: AiSmartSearchResponse): LeadsSmartSearchParseResult {
  const filters = ai.filters || {};
  const priorityFromKeywords = ai.keywords.find((chip) => chip.kind === 'priority')?.value || null;
  const searchText =
    filters.searchText ||
    ai.keywords.filter((k) => k.kind === 'text').map((k) => k.value).join(' ');
  return {
    keywords: ai.keywords,
    status: filters.status || null,
    source: filters.source || null,
    recruiterId: filters.recruiterId || null,
    priority: filters.priority || priorityFromKeywords || null,
    searchText,
    matchingLeadIds: Array.isArray(ai.matchingLeadIds) ? ai.matchingLeadIds : [],
    summary: ai.summary,
    tenantDatabase: ai.tenantDatabase,
  };
}

export function mapAiToJobsResult(ai: AiSmartSearchResponse): JobsSmartSearchResult {
  const filters = ai.filters || {};
  const statusChip = ai.keywords.find((chip) => chip.kind === 'status');
  const priorityChip = ai.keywords.find((chip) => chip.kind === 'priority');
  const employmentChip = ai.keywords.find((chip) => chip.kind === 'employment');
  const rawStatus = filters.status || statusChip?.value || null;
  const status =
    rawStatus === 'on hold' || rawStatus === 'onhold'
      ? 'ON_HOLD'
      : rawStatus === 'open' || rawStatus === 'active'
        ? 'OPEN'
        : rawStatus;
  const searchText =
    filters.searchText ||
    ai.keywords.filter((k) => k.kind === 'text').map((k) => k.value).join(' ');
  return {
    keywords: ai.keywords,
    status,
    clientId: filters.clientId || null,
    recruiterId: filters.recruiterId || null,
    priority: filters.priority || priorityChip?.value || null,
    employmentType: filters.employmentType || employmentChip?.value || null,
    searchText,
    matchingJobIds: Array.isArray(ai.matchingJobIds) ? ai.matchingJobIds : [],
    summary: ai.summary,
  };
}

export function mapAiToClientsResult(ai: AiSmartSearchResponse): ClientsSmartSearchResult {
  const filters = ai.filters || {};
  const stageChip = ai.keywords.find((chip) => chip.kind === 'stage');
  const rawTab = filters.activeTab || stageChip?.value || null;
  const activeTab =
    rawTab === 'on hold' || rawTab === 'onhold'
      ? 'on-hold'
      : rawTab;
  const searchText =
    filters.searchText ||
    ai.keywords.filter((k) => k.kind === 'text').map((k) => k.value).join(' ');
  return {
    keywords: ai.keywords,
    activeTab,
    priority: filters.priority || null,
    ownerScope: filters.ownerScope === 'me' ? 'me' : null,
    searchText,
    matchingClientIds: Array.isArray(ai.matchingClientIds) ? ai.matchingClientIds : [],
    summary: ai.summary,
  };
}

export function mapAiToCandidatesResult(ai: AiSmartSearchResponse): CandidatesSmartSearchResult {
  const filters = ai.filters || {};
  const stageChip = ai.keywords.find((chip) => chip.kind === 'stage');
  const statusChip = ai.keywords.find((chip) => chip.kind === 'status');
  const recruiterChip = ai.keywords.find((chip) => chip.kind === 'recruiter');
  const jobChip = ai.keywords.find((chip) => chip.kind === 'client');
  const searchText =
    filters.searchText ||
    ai.keywords.filter((k) => k.kind === 'text').map((k) => k.value).join(' ');
  return {
    keywords: ai.keywords,
    stage: filters.stage || stageChip?.value || '',
    status: filters.status || statusChip?.value || '',
    source: filters.source || '',
    ownerId: filters.ownerId || recruiterChip?.value || '',
    company: filters.company || '',
    location: filters.location || '',
    jobId: filters.jobId || jobChip?.value || '',
    experienceRange: filters.experienceRange || '',
    searchText,
    matchingCandidateIds: Array.isArray(ai.matchingCandidateIds) ? ai.matchingCandidateIds : [],
    summary: ai.summary,
  };
}

export function mapAiToInterviewsResult(ai: AiSmartSearchResponse): InterviewsSmartSearchResult {
  const filters = ai.filters || {};
  const searchText =
    filters.searchText ||
    ai.keywords.filter((k) => k.kind === 'text').map((k) => k.value).join(' ');
  return {
    keywords: ai.keywords,
    status: filters.status || '',
    round: filters.round || '',
    mode: filters.mode || '',
    interviewer: filters.interviewer || '',
    clientJob: filters.clientJob || '',
    searchText,
    matchingInterviewIds: Array.isArray(ai.matchingInterviewIds) ? ai.matchingInterviewIds : [],
    summary: ai.summary,
  };
}

export function mapAiToPlacementsResult(ai: AiSmartSearchResponse): PlacementsSmartSearchResult {
  const filters = ai.filters || {};
  const searchText =
    filters.searchText ||
    ai.keywords.filter((k) => k.kind === 'text').map((k) => k.value).join(' ');
  return {
    keywords: ai.keywords,
    status: filters.status || '',
    companyId: filters.companyId || '',
    recruiterId: filters.recruiterId || '',
    employmentType: filters.employmentType || '',
    searchText,
    matchingPlacementIds: Array.isArray(ai.matchingPlacementIds) ? ai.matchingPlacementIds : [],
    summary: ai.summary,
  };
}

export async function parseSmartSearchWithAi<TParsed>(
  entity: SmartSearchEntity,
  prompt: string,
  context: Record<string, unknown>,
  mapResult: (ai: AiSmartSearchResponse) => TParsed,
): Promise<TParsed | null> {
  const ai = await fetchAiSmartSearchParse(entity, prompt, context);
  if (!ai) return null;
  return mapResult(ai);
}
