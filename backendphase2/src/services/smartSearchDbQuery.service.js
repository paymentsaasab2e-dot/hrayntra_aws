import { getActiveTenantDbName, prisma } from '../config/prisma.js';
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
  SEARCH_STOP_WORDS,
} from './smartSearchSchema.config.js';
import { buildAssigneeVisibilityOr } from './memberVisibility.service.js';
import {
  compareRelevanceThenDate,
  scoreFieldRelevance,
} from '../utils/quickSearch.js';

/** When more matches exist, return filters only (avoid huge ?ids= URLs). */
export const SMART_SEARCH_MAX_IDS_IN_RESPONSE = 500;

const CANDIDATE_COLLECTION = 'candidates';
const CANDIDATE_TEXT_INDEX = 'candidates_smart_search_text';
const textIndexReadyByDb = new Map();
const textIndexBuildByDb = new Map();

const CANDIDATE_TEXT_INDEX_SPEC = {
  name: CANDIDATE_TEXT_INDEX,
  key: {
    firstName: 'text',
    lastName: 'text',
    currentTitle: 'text',
    designation: 'text',
    currentCompany: 'text',
    skills: 'text',
    recruiterSkills: 'text',
    cvSummary: 'text',
    city: 'text',
    location: 'text',
    preferredLocation: 'text',
    education: 'text',
  },
  default_language: 'english',
  weights: {
    skills: 10,
    recruiterSkills: 8,
    currentTitle: 8,
    designation: 7,
    firstName: 6,
    lastName: 6,
    city: 6,
    location: 6,
    cvSummary: 4,
    education: 3,
    currentCompany: 3,
  },
};

function mongoDocId(value) {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (value.$oid) return String(value.$oid);
  return String(value);
}

function searchTermsFromText(value) {
  return String(value || '')
    .trim()
    .split(/\s+/)
    .map((term) => term.trim())
    .filter((term) => term.length >= 2 && !SEARCH_STOP_WORDS.has(term.toLowerCase()));
}

function kickCandidateSmartSearchTextIndex() {
  // Live promote: do not create Mongo indexes unless explicitly enabled.
  if (String(process.env.CANDIDATE_CREATE_INDEXES || '').trim() !== '1') {
    return Promise.resolve(false);
  }
  const dbKey = getActiveTenantDbName() || '_default';
  if (textIndexReadyByDb.get(dbKey) === true) return Promise.resolve(true);
  if (textIndexBuildByDb.has(dbKey)) return textIndexBuildByDb.get(dbKey);
  const pending = prisma
    .$runCommandRaw({
      createIndexes: CANDIDATE_COLLECTION,
      indexes: [CANDIDATE_TEXT_INDEX_SPEC],
    })
    .then(() => {
      textIndexReadyByDb.set(dbKey, true);
      return true;
    })
    .catch((err) => {
      const msg = String(err?.message || err);
      if (/already exists|IndexOptionsConflict|IndexKeySpecsConflict/i.test(msg)) {
        textIndexReadyByDb.set(dbKey, true);
        return true;
      }
      console.warn('[smart-search] text index skipped:', msg.split('\n')[0]);
      textIndexReadyByDb.set(dbKey, false);
      return false;
    })
    .finally(() => {
      textIndexBuildByDb.delete(dbKey);
    });
  textIndexBuildByDb.set(dbKey, pending);
  return pending;
}

/** Fire-and-forget: never block a search on createIndexes. */
export function warmupCandidateSmartSearchTextIndex() {
  try {
    void kickCandidateSmartSearchTextIndex();
  } catch {
    /* tenant prisma not ready */
  }
}

async function ensureCandidateSmartSearchTextIndex() {
  const dbKey = getActiveTenantDbName() || '_default';
  if (textIndexReadyByDb.get(dbKey) === true) return true;
  if (textIndexReadyByDb.get(dbKey) === false) return false;
  void kickCandidateSmartSearchTextIndex();
  return true;
}

function candidateRowHaystack(row) {
  return [
    row.firstName,
    row.lastName,
    row.email,
    row.currentTitle,
    row.designation,
    row.cvSummary,
    row.education,
    row.city,
    row.country,
    row.location,
    ...(Array.isArray(row.skills) ? row.skills : []),
  ]
    .map((value) => String(value || '').toLowerCase())
    .join(' ');
}

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
  'submit-to-client': [
    'Submit to Client',
    'Submit to client',
    'SUBMITTED_TO_CLIENT',
    'Submitted to Client',
  ],
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
  const status = String(filters.status || '').trim();
  const source = String(filters.source || '').trim();
  const range = CANDIDATE_EXPERIENCE_RANGES[experienceRange];

  const stageClause = buildStagePrismaWhereClause(stage);
  if (stageClause) andParts.push(stageClause);

  if (status) {
    const normalized = normalizeEnumToken(status, 'CandidateStatus');
    if (normalized) andParts.push({ status: normalized });
  }
  if (source) {
    andParts.push({ source: { contains: source, mode: 'insensitive' } });
  }

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
    return {
      OR: [
        { status: 'ACTIVE' },
        { status: 'PROSPECT' },
        { leadStatus: { equals: 'Active', mode: 'insensitive' } },
      ],
    };
  }
  if (tab === 'on-hold') {
    return {
      OR: [
        { status: 'ON_HOLD' },
        { leadStatus: { equals: 'On Hold', mode: 'insensitive' } },
      ],
    };
  }
  if (tab === 'inactive') {
    return {
      OR: [
        { status: 'INACTIVE' },
        { leadStatus: { equals: 'Inactive', mode: 'insensitive' } },
      ],
    };
  }
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
  const searchText = String(filters.searchText || '').trim();
  const searchFilter = buildSchemaTextSearchWhere('leads', searchText);
  if (searchFilter) andParts.push(searchFilter);

  const rows = await prisma.lead.findMany({
    where: buildWhereFromAndParts(andParts),
    select: {
      id: true,
      companyName: true,
      contactPerson: true,
      contactName: true,
      email: true,
      industry: true,
      city: true,
      country: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
    take: SMART_SEARCH_MAX_IDS_IN_RESPONSE,
  });

  if (!searchText) {
    return rows.map((row) => row.id);
  }

  return rows
    .map((row) => ({
      id: row.id,
      score: scoreFieldRelevance(searchText, {
        primary: row.companyName || row.contactPerson || row.contactName,
        secondary: [row.contactPerson, row.contactName, row.email, row.industry],
        tertiary: [row.city, row.country],
      }),
      createdAt: row.createdAt,
    }))
    .sort((a, b) => compareRelevanceThenDate(a.score, b.score, a.createdAt, b.createdAt))
    .map((row) => row.id);
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
  if (filters.priority) {
    andParts.push({ priority: { equals: String(filters.priority).trim(), mode: 'insensitive' } });
  }
  if (filters.employmentType) {
    const jobType = normalizeEnumToken(filters.employmentType, 'JobType');
    if (jobType) andParts.push({ type: jobType });
  }
  const searchText = String(filters.searchText || '').trim();
  const searchFilter = buildSchemaTextSearchWhere('jobs', searchText);
  if (searchFilter) andParts.push(searchFilter);

  const rows = await prisma.job.findMany({
    where: buildWhereFromAndParts(andParts),
    select: {
      id: true,
      title: true,
      location: true,
      city: true,
      country: true,
      skills: true,
      updatedAt: true,
      createdAt: true,
      client: { select: { companyName: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: SMART_SEARCH_MAX_IDS_IN_RESPONSE,
  });

  if (!searchText) {
    return rows.map((row) => row.id);
  }

  return rows
    .map((row) => ({
      id: row.id,
      score: scoreFieldRelevance(searchText, {
        primary: row.title,
        secondary: [row.client?.companyName, ...(Array.isArray(row.skills) ? row.skills : [])],
        tertiary: [row.location, row.city, row.country],
      }),
      updatedAt: row.updatedAt,
      createdAt: row.createdAt,
    }))
    .sort((a, b) =>
      compareRelevanceThenDate(a.score, b.score, a.updatedAt || a.createdAt, b.updatedAt || b.createdAt),
    )
    .map((row) => row.id);
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
  const searchText = String(filters.searchText || '').trim();
  const searchFilter = buildSchemaTextSearchWhere('clients', searchText);
  if (searchFilter) andParts.push(searchFilter);

  const rows = await prisma.client.findMany({
    where: buildWhereFromAndParts(andParts),
    select: {
      id: true,
      companyName: true,
      industry: true,
      location: true,
      city: true,
      country: true,
      emails: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
    take: SMART_SEARCH_MAX_IDS_IN_RESPONSE,
  });

  if (!searchText) {
    return rows.map((row) => row.id);
  }

  return rows
    .map((row) => ({
      id: row.id,
      score: scoreFieldRelevance(searchText, {
        primary: row.companyName,
        secondary: [row.industry, ...(Array.isArray(row.emails) ? row.emails : [])],
        tertiary: [row.location, row.city, row.country],
      }),
      createdAt: row.createdAt,
    }))
    .sort((a, b) => compareRelevanceThenDate(a.score, b.score, a.createdAt, b.createdAt))
    .map((row) => row.id);
}

async function queryCandidateIds(filters, req) {
  const started = Date.now();
  const andParts = scopeToAndParts(await buildCandidateListScopeWhere(req));
  if (filters.ownerId && isValidObjectId(filters.ownerId)) {
    andParts.push({ assignedToId: filters.ownerId });
  }
  const location = String(filters.location || '').trim();
  const company = String(filters.company || '').trim();
  const jobId = String(filters.jobId || '').trim();
  const searchText = String(filters.searchText || '').trim();
  // Keep equality filters (stage/job/owner). Fold location/company into $text — contains COLLSCAN will not scale.
  appendCandidateFilterParts(andParts, { ...filters, location: '', company: '' });
  const extraText = [location, company, jobId && !isValidObjectId(jobId) ? jobId : '']
    .filter(Boolean)
    .join(' ');
  const combinedSearch = [searchText, extraText].filter(Boolean).join(' ').trim();
  const terms = searchTermsFromText(combinedSearch);
  const searchFilter = buildSchemaTextSearchWhere('candidates', combinedSearch);
  const hasStructured =
    Boolean(filters.ownerId && isValidObjectId(filters.ownerId)) ||
    Boolean(String(filters.status || '').trim()) ||
    Boolean(String(filters.stage || '').trim()) ||
    Boolean(String(filters.source || '').trim()) ||
    Boolean(jobId && isValidObjectId(jobId)) ||
    Boolean(String(filters.experienceRange || '').trim());
  if (!searchFilter && !hasStructured && !location && !company) {
    return [];
  }

  const candidateSearchSelect = {
    id: true,
    firstName: true,
    lastName: true,
    email: true,
    currentTitle: true,
    designation: true,
    cvSummary: true,
    education: true,
    skills: true,
    city: true,
    country: true,
    createdAt: true,
  };

  const rankRows = (rows, needle) =>
    rows
      .map((row) => ({
        id: row.id,
        score: scoreFieldRelevance(needle, {
          primary: `${row.firstName || ''} ${row.lastName || ''}`.trim() || row.email,
          secondary: [
            row.email,
            row.currentTitle,
            row.designation,
            ...(Array.isArray(row.skills) ? row.skills : []),
          ],
          tertiary: [row.cvSummary, row.education, row.city, row.country],
        }),
        createdAt: row.createdAt,
      }))
      .sort((a, b) => compareRelevanceThenDate(a.score, b.score, a.createdAt, b.createdAt))
      .map((row) => row.id);

  const useTextIndex = terms.length > 0 && (await ensureCandidateSmartSearchTextIndex());
  if (useTextIndex) {
    try {
      const quoted = terms.map((term) => `"${term.replace(/"/g, '')}"`).join(' ');
      const raw = await prisma.$runCommandRaw({
        find: CANDIDATE_COLLECTION,
        filter: {
          isDeleted: { $ne: true },
          $text: { $search: quoted },
        },
        projection: {
          _id: 1,
          firstName: 1,
          lastName: 1,
          email: 1,
          currentTitle: 1,
          designation: 1,
          cvSummary: 1,
          education: 1,
          skills: 1,
          city: 1,
          country: 1,
          location: 1,
          createdAt: 1,
        },
        limit: 2000,
      });
      const batch = raw?.cursor?.firstBatch || [];
      const needles = terms.map((term) => term.toLowerCase());
      let mapped = batch
        .map((row) => ({
          id: mongoDocId(row._id),
          firstName: row.firstName,
          lastName: row.lastName,
          email: row.email,
          currentTitle: row.currentTitle,
          designation: row.designation,
          cvSummary: row.cvSummary,
          education: row.education,
          skills: row.skills,
          city: row.city,
          country: row.country,
          location: row.location,
          createdAt: row.createdAt,
        }))
        .filter((row) => row.id && needles.every((needle) => candidateRowHaystack(row).includes(needle)));

      if (mapped.length) {
        const scoped = await prisma.candidate.findMany({
          where: {
            AND: [{ id: { in: mapped.map((row) => row.id) } }, ...andParts],
          },
          select: { id: true },
        });
        const allowed = new Set(scoped.map((row) => String(row.id)));
        mapped = mapped.filter((row) => allowed.has(String(row.id)));
      }

      const ids = rankRows(mapped, combinedSearch).slice(0, SMART_SEARCH_MAX_IDS_IN_RESPONSE);
      console.info('[smart-search] candidate $text', {
        terms,
        hits: batch.length,
        afterAnd: mapped.length,
        ids: ids.length,
        ms: Date.now() - started,
      });
      return ids;
    } catch (err) {
      console.warn('[smart-search] $text fallback to contains:', String(err?.message || err).split('\n')[0]);
    }
  }

  if (searchFilter) andParts.push(searchFilter);
  const rows = await prisma.candidate.findMany({
    where: buildWhereFromAndParts(andParts),
    select: candidateSearchSelect,
    take: SMART_SEARCH_MAX_IDS_IN_RESPONSE,
  });

  if (!combinedSearch) {
    return rows.map((row) => row.id);
  }
  return rankRows(rows, combinedSearch);
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
