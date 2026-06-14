import { prisma } from '../config/prisma.js';
import { buildLeadsListScopeWhere } from './smartSearchLeadContext.service.js';
import {
  buildJobsListScopeWhere,
  buildClientsListScopeWhere,
  buildCandidateListScopeWhere,
  buildInterviewsListScopeWhere,
  isValidObjectId,
} from './smartSearchTenantContext.service.js';
import {
  buildSchemaTextSearchWhere,
  getEntitySchema,
  normalizeEnumToken,
  normalizeInterviewStatusFilter,
  SCHEMA_ENUMS,
} from './smartSearchSchema.config.js';
import { buildAssigneeVisibilityOr } from './memberVisibility.service.js';

/** When more matches exist, return filters only (avoid huge ?ids= URLs). */
export const SMART_SEARCH_MAX_IDS_IN_RESPONSE = 500;

const CANDIDATE_EXPERIENCE_RANGES = {
  '0-2': { min: 0, max: 2 },
  '2-5': { min: 2, max: 5 },
  '5-10': { min: 5, max: 10 },
  '10+': { min: 10, max: null },
};

const STAGE_FILTER_VARIANTS = {
  new: ['New', 'NEW'],
  applied: ['Applied', 'APPLIED'],
  longlist: ['Longlist', 'Long List', 'LONGLIST'],
  shortlist: ['Shortlist', 'Short List', 'SHORTLIST'],
  screening: ['Screening', 'SCREENING'],
  submitted: ['Submitted', 'SUBMITTED'],
  interviewing: ['Interviewing', 'Interview', 'INTERVIEW', 'INTERVIEWING'],
  offered: ['Offered', 'Offer', 'OFFER', 'OFFERED'],
  hired: ['Hired', 'HIRED', 'Placed', 'PLACED'],
  rejected: ['Rejected', 'REJECTED'],
};

function scopeToAndParts(scope) {
  if (!scope || !Object.keys(scope).length) return [];
  if (Array.isArray(scope.AND)) return [...scope.AND];
  return [scope];
}

function buildWhereFromAndParts(andParts) {
  if (!andParts.length) return {};
  return andParts.length === 1 ? andParts[0] : { AND: andParts };
}

function normalizeStageFilterKey(stageParam) {
  const raw = String(stageParam || '').trim();
  if (!raw) return '';
  const lower = raw.toLowerCase();
  const keys = Object.keys(STAGE_FILTER_VARIANTS);
  if (keys.includes(lower)) return lower;
  const byVariant = keys.find((key) =>
    (STAGE_FILTER_VARIANTS[key] || []).some((v) => String(v).toLowerCase() === lower),
  );
  return byVariant || lower;
}

function buildStagePrismaWhereClause(stageParam) {
  const key = normalizeStageFilterKey(stageParam);
  if (!key) return null;
  if (key === 'new') {
    return {
      OR: [{ stage: null }, { stage: '' }, { stage: 'New' }, { stage: 'NEW' }],
    };
  }
  const variants = STAGE_FILTER_VARIANTS[key] || [String(stageParam || '').trim()];
  const unique = [...new Set(variants.map((v) => String(v).trim()).filter(Boolean))];
  return { OR: unique.map((variant) => ({ stage: variant })) };
}

function appendCandidateFilterParts(andParts, filters) {
  const company = String(filters.company || '').trim();
  const location = String(filters.location || '').trim();
  const jobId = String(filters.jobId || '').trim();
  const experienceRange = String(filters.experienceRange || '').trim();
  const stage = String(filters.stage || '').trim();
  const range = CANDIDATE_EXPERIENCE_RANGES[experienceRange];

  const stageClause = buildStagePrismaWhereClause(stage);
  if (stageClause) andParts.push(stageClause);

  if (company) {
    andParts.push({
      OR: [
        { currentCompany: { contains: company, mode: 'insensitive' } },
        {
          matches: {
            some: {
              job: { client: { companyName: { contains: company, mode: 'insensitive' } } },
            },
          },
        },
      ],
    });
  }
  if (location) {
    andParts.push({
      OR: [
        { location: { contains: location, mode: 'insensitive' } },
        { city: { contains: location, mode: 'insensitive' } },
        { preferredLocation: { contains: location, mode: 'insensitive' } },
      ],
    });
  }
  if (jobId && isValidObjectId(jobId)) {
    andParts.push({
      OR: [
        { assignedJobs: { has: jobId } },
        { matches: { some: { jobId } } },
        { applications: { some: { jobId } } },
        { pipelineEntries: { some: { jobId } } },
      ],
    });
  }
  if (range) {
    const expBounds = [];
    const experienceClause = {};
    const experienceYearsClause = {};
    if (range.min != null) {
      experienceClause.gte = range.min;
      experienceYearsClause.gte = range.min;
    }
    if (range.max != null) {
      experienceClause.lte = range.max;
      experienceYearsClause.lte = range.max;
    } else if (range.min != null) {
      experienceClause.gte = range.min;
      experienceYearsClause.gte = range.min;
    }
    if (Object.keys(experienceClause).length) expBounds.push({ experience: experienceClause });
    if (Object.keys(experienceYearsClause).length) {
      expBounds.push({ experienceYears: experienceYearsClause });
    }
    if (expBounds.length) andParts.push({ OR: expBounds });
  }
}

/** Client UI tab → Prisma Client.status / priority (schema has no hot flag on Client). */
function mapClientActiveTabToWhere(activeTab) {
  const tab = String(activeTab || '').trim().toLowerCase();
  if (tab === 'active') {
    return { OR: [{ status: 'ACTIVE' }, { status: 'PROSPECT' }] };
  }
  if (tab === 'on-hold') return { status: 'ON_HOLD' };
  if (tab === 'inactive') return { status: 'INACTIVE' };
  if (tab === 'hot') return { priority: 'High' };
  return null;
}

async function queryLeadIds(filters, req) {
  const andParts = scopeToAndParts(buildLeadsListScopeWhere(req));
  if (filters.status) andParts.push({ status: filters.status });
  if (filters.source) {
    const source = normalizeEnumToken(filters.source, 'LeadSource');
    if (source) andParts.push({ source });
  }
  if (filters.priority) {
    const priority = normalizeEnumToken(filters.priority, 'Priority');
    if (priority) andParts.push({ priority });
  }
  if (filters.recruiterId && isValidObjectId(filters.recruiterId)) {
    andParts.push({
      OR: [
        { assignedToId: filters.recruiterId },
        { assignedToIds: { has: filters.recruiterId } },
      ],
    });
  }
  const searchFilter = buildSchemaTextSearchWhere('leads', filters.searchText);
  if (searchFilter) andParts.push(searchFilter);

  const rows = await prisma.lead.findMany({
    where: buildWhereFromAndParts(andParts),
    select: { id: true },
    orderBy: { createdAt: 'desc' },
  });
  return rows.map((row) => row.id);
}

async function queryJobIds(filters, req) {
  const andParts = scopeToAndParts(buildJobsListScopeWhere(req));
  if (filters.status) {
    const status = normalizeEnumToken(filters.status, 'JobStatus');
    if (status) andParts.push({ status });
  }
  if (filters.clientId && isValidObjectId(filters.clientId)) {
    andParts.push({ clientId: filters.clientId });
  }
  if (filters.recruiterId && isValidObjectId(filters.recruiterId)) {
    andParts.push({ assignedToId: filters.recruiterId });
  }
  const searchFilter = buildSchemaTextSearchWhere('jobs', filters.searchText);
  if (searchFilter) andParts.push(searchFilter);

  const rows = await prisma.job.findMany({
    where: buildWhereFromAndParts(andParts),
    select: { id: true },
    orderBy: { createdAt: 'desc' },
  });
  return rows.map((row) => row.id);
}

async function queryClientIds(filters, req) {
  const andParts = scopeToAndParts(await buildClientsListScopeWhere(req));
  const tabWhere = mapClientActiveTabToWhere(filters.activeTab);
  if (tabWhere) andParts.push(tabWhere);
  if (filters.priority) {
    const priority = normalizeEnumToken(filters.priority, 'Priority');
    if (priority) andParts.push({ priority });
  }
  if (filters.ownerScope === 'me' && req?.user?.id) {
    andParts.push({
      OR: buildAssigneeVisibilityOr(req.user.id),
    });
  }
  const searchFilter = buildSchemaTextSearchWhere('clients', filters.searchText);
  if (searchFilter) andParts.push(searchFilter);

  const rows = await prisma.client.findMany({
    where: buildWhereFromAndParts(andParts),
    select: { id: true },
    orderBy: { createdAt: 'desc' },
  });
  return rows.map((row) => row.id);
}

async function queryCandidateIds(filters, req) {
  const andParts = scopeToAndParts(await buildCandidateListScopeWhere(req));
  if (filters.ownerId && isValidObjectId(filters.ownerId)) {
    andParts.push({ assignedToId: filters.ownerId });
  }
  appendCandidateFilterParts(andParts, filters);
  const searchFilter = buildSchemaTextSearchWhere('candidates', filters.searchText);
  if (searchFilter) andParts.push(searchFilter);

  const rows = await prisma.candidate.findMany({
    where: buildWhereFromAndParts(andParts),
    select: { id: true },
    orderBy: { createdAt: 'desc' },
  });
  return rows.map((row) => row.id);
}

async function queryInterviewIds(filters, req) {
  const andParts = scopeToAndParts(buildInterviewsListScopeWhere(req));
  if (filters.status) {
    const status = normalizeInterviewStatusFilter(filters.status);
    if (status && SCHEMA_ENUMS.InterviewStatus.includes(status)) {
      andParts.push({ status });
    } else if (filters.status) {
      andParts.push({ status: { contains: filters.status, mode: 'insensitive' } });
    }
  }
  if (filters.round) {
    andParts.push({ round: { contains: filters.round, mode: 'insensitive' } });
  }
  if (filters.mode) {
    const mode = normalizeEnumToken(filters.mode, 'InterviewMode');
    if (mode) andParts.push({ mode });
  }
  if (filters.interviewer) {
    const users = await prisma.user.findMany({
      where: { name: { contains: filters.interviewer, mode: 'insensitive' } },
      select: { id: true },
      take: 20,
    });
    const userIds = users.map((u) => u.id);
    if (userIds.length) {
      andParts.push({
        OR: [
          { interviewerId: { in: userIds } },
          { panelIds: { hasSome: userIds } },
          { panel: { some: { userId: { in: userIds } } } },
        ],
      });
    } else {
      return [];
    }
  }
  if (filters.clientJob) {
    const [clientPart, ...jobParts] = String(filters.clientJob).split('•').map((s) => s.trim());
    const jobTitle = jobParts.join(' • ').trim();
    const jobWhere = { isDeleted: { not: true } };
    if (jobTitle) jobWhere.title = { contains: jobTitle, mode: 'insensitive' };
    if (clientPart) {
      const clients = await prisma.client.findMany({
        where: { companyName: { contains: clientPart, mode: 'insensitive' } },
        select: { id: true },
        take: 20,
      });
      const clientIds = clients.map((c) => c.id);
      if (clientIds.length) jobWhere.clientId = { in: clientIds };
      else return [];
    }
    const jobs = await prisma.job.findMany({ where: jobWhere, select: { id: true }, take: 50 });
    const jobIds = jobs.map((j) => j.id);
    if (!jobIds.length) return [];
    andParts.push({ jobId: { in: jobIds } });
  }
  const search = String(filters.searchText || '').trim();
  if (search) {
    const interviewTextClause = buildSchemaTextSearchWhere('interviews', search);
    const searchOr = [
      {
        candidate: {
          is: {
            OR: [
              { firstName: { contains: search, mode: 'insensitive' } },
              { lastName: { contains: search, mode: 'insensitive' } },
              { email: { contains: search, mode: 'insensitive' } },
            ],
          },
        },
      },
    ];
    if (interviewTextClause) searchOr.push(interviewTextClause);
    andParts.push({ OR: searchOr });
  }

  const rows = await prisma.interview.findMany({
    where: buildWhereFromAndParts(andParts),
    select: { id: true },
    orderBy: { scheduledAt: 'desc' },
  });
  return rows.map((row) => row.id);
}

async function queryPlacementIds(filters, req) {
  void req;
  const andParts = [{ deletedAt: null }];
  if (filters.status) {
    const status = normalizeEnumToken(filters.status, 'PlacementStatus');
    if (status) andParts.push({ status });
  }
  const companyId = filters.companyId || filters.clientId;
  if (companyId && isValidObjectId(companyId)) andParts.push({ clientId: companyId });
  if (filters.recruiterId && isValidObjectId(filters.recruiterId)) {
    andParts.push({ recruiterId: filters.recruiterId });
  }
  if (filters.employmentType) {
    const employmentType = normalizeEnumToken(filters.employmentType, 'EmploymentType');
    if (employmentType) andParts.push({ employmentType });
  }
  const search = String(filters.searchText || '').trim();
  if (search) {
    const placementTextClause = buildSchemaTextSearchWhere('placements', search);
    const [candidates, clients, jobs] = await Promise.all([
      prisma.candidate.findMany({
        where: {
          OR: [
            { firstName: { contains: search, mode: 'insensitive' } },
            { lastName: { contains: search, mode: 'insensitive' } },
            { email: { contains: search, mode: 'insensitive' } },
          ],
        },
        select: { id: true },
        take: 100,
      }),
      prisma.client.findMany({
        where: { companyName: { contains: search, mode: 'insensitive' } },
        select: { id: true },
        take: 100,
      }),
      prisma.job.findMany({
        where: { title: { contains: search, mode: 'insensitive' } },
        select: { id: true },
        take: 100,
      }),
    ]);
    const searchOr = [
      candidates.length ? { candidateId: { in: candidates.map((c) => c.id) } } : null,
      clients.length ? { clientId: { in: clients.map((c) => c.id) } } : null,
      jobs.length ? { jobId: { in: jobs.map((j) => j.id) } } : null,
      placementTextClause || null,
    ].filter(Boolean);
    if (!searchOr.length) return [];
    andParts.push(searchOr.length === 1 ? searchOr[0] : { OR: searchOr });
  }

  const rows = await prisma.placement.findMany({
    where: buildWhereFromAndParts(andParts),
    select: { id: true },
    orderBy: { offerDate: 'desc' },
  });
  return rows.map((row) => row.id);
}

const ENTITY_QUERY_HANDLERS = {
  leads: queryLeadIds,
  jobs: queryJobIds,
  clients: queryClientIds,
  candidates: queryCandidateIds,
  interviews: queryInterviewIds,
  placements: queryPlacementIds,
};

/**
 * Run a tenant DB query from AI-parsed filters. Returns ids + metadata.
 */
export async function executeSmartSearchDbQuery(entity, filters, req) {
  const schema = getEntitySchema(entity);
  const handler = ENTITY_QUERY_HANDLERS[entity];
  if (!handler || !schema) {
    return { matchingIds: [], matchCount: 0, matchingIdsField: null, useFiltersOnly: true };
  }

  const allIds = await handler(filters, req);
  const matchCount = allIds.length;
  const matchingIdsField = schema.matchingIdsField;
  const useFiltersOnly = matchCount > SMART_SEARCH_MAX_IDS_IN_RESPONSE;
  const matchingIds = useFiltersOnly ? [] : allIds;

  return {
    matchingIds,
    matchCount,
    matchingIdsField,
    useFiltersOnly,
  };
}
