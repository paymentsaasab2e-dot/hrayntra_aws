import { prisma, getActiveTenantDbName } from '../config/prisma.js';
import {
  resolveSmartSearchTakeLimit,
  smartSearchFindManyTake,
} from './smartSearchLimits.js';
import { buildSuperAdminOwnerScope, mergeWhereWithScope } from '../utils/superAdminScope.js';
import {
  canViewAllAssignments,
  hasAnyPermission,
} from '../utils/permissionScope.js';
import {
  loadLeadsTenantSearchContext,
  normalizeLeadsAiFiltersAgainstTenant,
  sanitizeMatchingLeadIds,
} from './smartSearchLeadContext.service.js';
import { buildClientsListScopeWhere } from './clientMemberScope.service.js';
import { buildAssigneeVisibilityOr } from './memberVisibility.service.js';

export { buildClientsListScopeWhere };

export function isValidObjectId(value) {
  return typeof value === 'string' && /^[a-fA-F0-9]{24}$/.test(value.trim());
}

function clip(value, max = 120) {
  const text = String(value || '').trim();
  if (!text) return '';
  return text.length <= max ? text : `${text.slice(0, max)}…`;
}

export function uniqueNonEmpty(values, limit = 80) {
  const seen = new Set();
  const out = [];
  for (const value of values) {
    const text = String(value || '').trim();
    if (!text || seen.has(text.toLowerCase())) continue;
    seen.add(text.toLowerCase());
    out.push(text);
    if (out.length >= limit) break;
  }
  return out;
}

export function findClosestMatch(token, options = []) {
  const needle = String(token || '').trim().toLowerCase();
  if (!needle) return null;
  const exact = options.find((item) => String(item).toLowerCase() === needle);
  if (exact) return exact;
  const contains = options.find(
    (item) =>
      String(item).toLowerCase().includes(needle) || needle.includes(String(item).toLowerCase()),
  );
  return contains || null;
}

/** Generic sanitizer — keep only ids present in the tenant snapshot sent to OpenAI. */
export function sanitizeMatchingIds(ids = [], allowedSet = new Set()) {
  const list = Array.isArray(ids) ? ids : [];
  const out = [];
  const seen = new Set();
  for (const id of list) {
    const normalized = String(id || '').trim();
    if (!isValidObjectId(normalized)) continue;
    if (!allowedSet.has(normalized)) continue;
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    out.push(normalized);
  }
  return out;
}

function resolveRecruiterId(token, recruiters = []) {
  if (!token) return '';
  if (isValidObjectId(token)) return token;
  const needle = String(token).trim().toLowerCase();
  const recruiter = recruiters.find((item) => {
    const name = String(item.name || '').toLowerCase();
    const email = String(item.email || '').toLowerCase();
    return name.includes(needle) || needle.includes(name) || email === needle;
  });
  return recruiter?.id || '';
}

function resolveNamedId(token, options = []) {
  if (!token) return '';
  if (isValidObjectId(token)) return token;
  const needle = String(token).trim().toLowerCase();
  const match = options.find((item) => {
    const name = String(item.name || item.companyName || '').toLowerCase();
    return name.includes(needle) || needle.includes(name);
  });
  return match?.id || '';
}

function buildTenantMeta(tenantDbName, total, loaded, allRecordIds, totalKey, loadedKey) {
  const maxTake = resolveSmartSearchTakeLimit();
  return {
    tenantDbName: tenantDbName || 'default',
    totalRecords: total,
    recordsLoadedForAi: loaded,
    truncated: maxTake ? total > loaded : false,
    maxRecordsContext: maxTake ?? null,
    allRecordIds,
    ...(totalKey ? { [totalKey]: total } : {}),
    ...(loadedKey ? { [loadedKey]: loaded } : {}),
  };
}

// —— Jobs ——

export function buildJobsListScopeWhere(req) {
  const where = {};
  if (!canViewAllAssignments(req) && req?.user?.id) {
    where.OR = buildAssigneeVisibilityOr(req.user.id);
  }
  const superAdminScope = buildSuperAdminOwnerScope(req, ['createdById', 'assignedToId']);
  let scopedWhere = mergeWhereWithScope(where, superAdminScope);
  return { AND: [scopedWhere, { isDeleted: { not: true } }] };
}

function compactJobRowForAi(job, recruiterNameById = new Map(), clientNameById = new Map(), managerNameById = new Map()) {
  return {
    id: job.id,
    title: clip(job.title, 80),
    status: clip(job.status, 30),
    location: clip(job.location, 60),
    type: clip(job.type, 30),
    priority: clip(job.priority, 20),
    nationality: clip(job.nationality, 40),
    country: clip(job.country, 40),
    state: clip(job.state, 40),
    city: clip(job.city, 40),
    workMode: clip(job.workMode, 30),
    experienceRequired: clip(job.experienceRequired, 40),
    education: clip(job.education, 80),
    hiringManager: clip(job.hiringManager, 60),
    skills: clip((job.skills || []).join(', '), 100),
    responsibilities: clip((job.keyResponsibilities || []).join(', '), 120),
    requirements: clip((job.candidateRequirements || job.requirements || []).join(', '), 120),
    clientName: clip(clientNameById.get(job.clientId) || '', 60),
    clientId: job.clientId || '',
    assignedTo: clip(recruiterNameById.get(job.assignedToId) || '', 60),
    assignedToId: job.assignedToId || '',
    manager: clip(managerNameById.get(job.managerId) || '', 60),
    managerId: job.managerId || '',
    descriptionSnippet: clip(job.description, 160),
  };
}

export async function loadJobsTenantSearchContext(req) {
  const where = buildJobsListScopeWhere(req);
  const tenantDbName = getActiveTenantDbName() || String(req?.user?.tenantDbName || '').trim();
  const totalJobs = await prisma.job.count({ where });

  const rawJobs = await prisma.job.findMany({
    where,
    ...smartSearchFindManyTake(),
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      title: true,
      status: true,
      location: true,
      type: true,
      priority: true,
      nationality: true,
      country: true,
      state: true,
      city: true,
      workMode: true,
      experienceRequired: true,
      education: true,
      hiringManager: true,
      description: true,
      skills: true,
      keyResponsibilities: true,
      candidateRequirements: true,
      requirements: true,
      clientId: true,
      assignedToId: true,
      managerId: true,
    },
  });

  const clientIds = [...new Set(rawJobs.map((job) => job.clientId).filter(Boolean))];
  const recruiterIds = [...new Set(rawJobs.map((job) => job.assignedToId).filter(Boolean))];
  const managerIds = [...new Set(rawJobs.map((job) => job.managerId).filter(Boolean))];
  const userIds = [...new Set([...recruiterIds, ...managerIds])];

  const [clients, users] = await Promise.all([
    clientIds.length
      ? prisma.client.findMany({
          where: { id: { in: clientIds } },
          select: { id: true, companyName: true },
        })
      : [],
    userIds.length
      ? prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, name: true, email: true },
        })
      : [],
  ]);

  const recruiters = users.filter((user) => recruiterIds.includes(user.id));
  const clientNameById = new Map(clients.map((client) => [client.id, client.companyName]));
  const recruiterNameById = new Map(recruiters.map((user) => [user.id, user.name]));
  const managerNameById = new Map(users.map((user) => [user.id, user.name]));
  const allJobs = rawJobs.map((job) =>
    compactJobRowForAi(job, recruiterNameById, clientNameById, managerNameById),
  );
  const allJobIds = new Set(allJobs.map((job) => job.id));

  return {
    ...buildTenantMeta(tenantDbName, totalJobs, allJobs.length, allJobIds, 'totalJobs', 'jobsLoadedForAi'),
    statuses: uniqueNonEmpty(rawJobs.map((job) => job.status)),
    priorities: uniqueNonEmpty(rawJobs.map((job) => job.priority)),
    employmentTypes: uniqueNonEmpty(rawJobs.map((job) => job.type)),
    clients: clients.map((client) => ({ id: client.id, name: client.companyName })),
    recruiters,
    allJobs,
    allJobIds,
  };
}

export function normalizeJobsAiFiltersAgainstTenant(filters = {}, keywords = [], tenantDb = {}) {
  const nextFilters = { ...filters };
  const nextKeywords = Array.isArray(keywords) ? [...keywords] : [];

  if (nextFilters.status) {
    nextFilters.status = findClosestMatch(nextFilters.status, tenantDb.statuses || []) || nextFilters.status;
  }
  if (nextFilters.clientId) {
    nextFilters.clientId = resolveNamedId(nextFilters.clientId, tenantDb.clients || []);
  }
  if (nextFilters.recruiterId) {
    nextFilters.recruiterId = resolveRecruiterId(nextFilters.recruiterId, tenantDb.recruiters || []);
  }
  if (nextFilters.priority) {
    nextFilters.priority =
      findClosestMatch(nextFilters.priority, tenantDb.priorities || []) || nextFilters.priority;
  }
  if (nextFilters.employmentType) {
    nextFilters.employmentType =
      findClosestMatch(nextFilters.employmentType, tenantDb.employmentTypes || []) ||
      nextFilters.employmentType;
  }

  for (let i = 0; i < nextKeywords.length; i += 1) {
    const chip = nextKeywords[i];
    if (chip?.kind === 'client' && chip.value) {
      const id = resolveNamedId(chip.value, tenantDb.clients || []);
      if (id) {
        nextKeywords[i] = {
          ...chip,
          value: id,
          label: tenantDb.clients?.find((c) => c.id === id)?.name || chip.label,
        };
        if (!nextFilters.clientId) nextFilters.clientId = id;
      }
    }
    if (chip?.kind === 'recruiter' && chip.value) {
      const id = resolveRecruiterId(chip.value, tenantDb.recruiters || []);
      if (id) {
        const recruiter = tenantDb.recruiters?.find((r) => r.id === id);
        nextKeywords[i] = { ...chip, value: id, label: recruiter?.name || chip.label };
        if (!nextFilters.recruiterId) nextFilters.recruiterId = id;
      }
    }
  }

  return { filters: nextFilters, keywords: nextKeywords };
}

// —— Clients ——

function flattenJsonForSearch(value) {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return value.map(flattenJsonForSearch).join(' ');
  if (typeof value === 'object') {
    return Object.values(value).map(flattenJsonForSearch).join(' ');
  }
  return '';
}

function compactClientRowForAi(client, recruiterNameById = new Map()) {
  return {
    id: client.id,
    companyName: clip(client.companyName, 80),
    status: clip(client.status, 30),
    leadStatus: clip(client.leadStatus, 30),
    industry: clip(client.industry, 50),
    location: clip(client.location, 60),
    city: clip(client.city, 40),
    state: clip(client.state, 40),
    country: clip(client.country, 40),
    priority: clip(client.priority, 20),
    hot: Boolean(client.hot),
    assignedTo: clip(recruiterNameById.get(client.assignedToId) || '', 60),
    assignedToId: client.assignedToId || '',
    website: clip(client.website, 80),
    servicesNeeded: clip(client.servicesNeeded, 80),
    expectedBusinessValue: clip(client.expectedBusinessValue, 60),
    teamMemberEmail: clip(client.teamMemberEmail, 60),
    teamMemberDesignation: clip(client.teamMemberDesignation, 60),
    agreementLevel: clip(client.agreementLevel, 40),
    agreementServiceChargePercent: clip(client.agreementServiceChargePercent, 20),
    agreementTimePeriod: clip(client.agreementTimePeriod, 80),
    kycSummary: clip(flattenJsonForSearch(client.postServiceKycForm), 220),
  };
}

export async function loadClientsTenantSearchContext(req) {
  const where = await buildClientsListScopeWhere(req);
  const tenantDbName = getActiveTenantDbName() || String(req?.user?.tenantDbName || '').trim();
  const totalClients = await prisma.client.count({ where });

  const rawClients = await prisma.client.findMany({
    where,
    ...smartSearchFindManyTake(),
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      companyName: true,
      status: true,
      leadStatus: true,
      industry: true,
      location: true,
      city: true,
      state: true,
      country: true,
      priority: true,
      hot: true,
      assignedToId: true,
      website: true,
      servicesNeeded: true,
      expectedBusinessValue: true,
      teamMemberEmail: true,
      teamMemberDesignation: true,
      agreementLevel: true,
      agreementServiceChargePercent: true,
      agreementTimePeriod: true,
      postServiceKycForm: true,
    },
  });

  const recruiterIds = [...new Set(rawClients.map((client) => client.assignedToId).filter(Boolean))];
  const recruiters = recruiterIds.length
    ? await prisma.user.findMany({
        where: { id: { in: recruiterIds } },
        select: { id: true, name: true, email: true },
      })
    : [];

  const recruiterNameById = new Map(recruiters.map((user) => [user.id, user.name]));
  const allClients = rawClients.map((client) => compactClientRowForAi(client, recruiterNameById));
  const allClientIds = new Set(allClients.map((client) => client.id));

  return {
    ...buildTenantMeta(
      tenantDbName,
      totalClients,
      allClients.length,
      allClientIds,
      'totalClients',
      'clientsLoadedForAi',
    ),
    statuses: uniqueNonEmpty(rawClients.map((client) => client.status)),
    priorities: uniqueNonEmpty(rawClients.map((client) => client.priority)),
    industries: uniqueNonEmpty(rawClients.map((client) => client.industry)),
    companies: uniqueNonEmpty(rawClients.map((client) => client.companyName), 200),
    recruiters,
    allClients,
    allClientIds,
  };
}

export function normalizeClientsAiFiltersAgainstTenant(filters = {}, keywords = [], tenantDb = {}) {
  const nextFilters = { ...filters };
  const nextKeywords = Array.isArray(keywords) ? [...keywords] : [];

  if (nextFilters.priority) {
    nextFilters.priority =
      findClosestMatch(nextFilters.priority, tenantDb.priorities || []) || nextFilters.priority;
  }
  if (nextFilters.searchText) {
    const companyHint = findClosestMatch(nextFilters.searchText, tenantDb.companies || []);
    if (companyHint && !nextFilters.searchText.toLowerCase().includes(companyHint.toLowerCase())) {
      nextFilters.searchText = companyHint;
    }
  }

  return { filters: nextFilters, keywords: nextKeywords };
}

// —— Candidates ——

function buildCrmCandidatesListScopeClause() {
  return {
    OR: [
      { NOT: { source: 'phase1' } },
      { assignedJobs: { isEmpty: false } },
      { applications: { some: {} } },
      { pipelineEntries: { some: {} } },
    ],
  };
}

export async function buildCandidateListScopeWhere(req) {
  const andParts = [{ isDeleted: { not: true } }, buildCrmCandidatesListScopeClause()];
  const superAdminScope = buildSuperAdminOwnerScope(req, ['createdById', 'assignedToId']);
  const canViewAllCandidates =
    canViewAllAssignments(req) || hasAnyPermission(req, ['view_all_candidates']);

  if (superAdminScope) {
    andParts.push(superAdminScope);
  } else if (!canViewAllCandidates && req?.user?.id) {
    const userId = req.user.id;
    const jobs = await prisma.job.findMany({
      where: { isDeleted: { not: true } },
      select: { id: true },
    });
    const visibleJobIds = jobs.map((job) => job.id);
    const visibilityOr = buildAssigneeVisibilityOr(userId);
    if (visibleJobIds.length > 0) {
      visibilityOr.push({ assignedJobs: { hasSome: visibleJobIds } });
      visibilityOr.push({ applications: { some: { jobId: { in: visibleJobIds } } } });
      visibilityOr.push({ matches: { some: { jobId: { in: visibleJobIds } } } });
      visibilityOr.push({ pipelineEntries: { some: { jobId: { in: visibleJobIds } } } });
    }
    andParts.push({ OR: visibilityOr });
  }

  return { AND: andParts };
}

function compactCandidateRowForAi(candidate, recruiterNameById = new Map(), jobTitleById = new Map()) {
  const jobIds = [
    ...(Array.isArray(candidate.assignedJobs) ? candidate.assignedJobs : []),
    ...(candidate.applications || []).map((app) => app.jobId).filter(Boolean),
  ].filter(Boolean);
  const jobTitles = [...new Set(jobIds.map((id) => jobTitleById.get(id)).filter(Boolean))].join(', ');
  const workSnippet = flattenJsonForSearch(candidate.cvWorkExperienceEntries);
  const educationSnippet = flattenJsonForSearch(candidate.cvEducationEntries);
  const portfolioSnippet = flattenJsonForSearch(candidate.cvPortfolioLinks);

  return {
    id: candidate.id,
    name: clip(`${candidate.firstName || ''} ${candidate.lastName || ''}`.trim(), 60),
    email: clip(candidate.email, 80),
    phone: clip(candidate.phone, 40),
    status: clip(candidate.status, 30),
    stage: clip(candidate.stage, 30),
    source: clip(candidate.source, 30),
    currentCompany: clip(candidate.currentCompany, 60),
    currentTitle: clip(candidate.currentTitle, 60),
    designation: clip(candidate.designation, 60),
    location: clip(candidate.location, 60),
    city: clip(candidate.city, 40),
    country: clip(candidate.country, 40),
    experience: candidate.experience ?? candidate.experienceYears ?? null,
    availability: clip(candidate.availability, 40),
    skills: clip((candidate.skills || []).join(', '), 100),
    education: clip(candidate.education, 80),
    cvSummary: clip(candidate.cvSummary, 160),
    workSnippet: clip(workSnippet, 160),
    educationSnippet: clip(educationSnippet, 120),
    portfolioSnippet: clip(portfolioSnippet, 120),
    assignedTo: clip(recruiterNameById.get(candidate.assignedToId) || '', 60),
    assignedToId: candidate.assignedToId || '',
    jobs: clip(jobTitles, 100),
  };
}

export async function loadCandidatesTenantSearchContext(req) {
  const where = await buildCandidateListScopeWhere(req);
  const tenantDbName = getActiveTenantDbName() || String(req?.user?.tenantDbName || '').trim();
  const totalCandidates = await prisma.candidate.count({ where });

  const rawCandidates = await prisma.candidate.findMany({
    where,
    ...smartSearchFindManyTake(),
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      status: true,
      stage: true,
      source: true,
      currentCompany: true,
      currentTitle: true,
      designation: true,
      location: true,
      city: true,
      country: true,
      experience: true,
      experienceYears: true,
      availability: true,
      education: true,
      cvSummary: true,
      cvEducationEntries: true,
      cvWorkExperienceEntries: true,
      cvPortfolioLinks: true,
      skills: true,
      assignedToId: true,
      assignedJobs: true,
      applications: { select: { jobId: true }, take: 5 },
    },
  });

  const jobIds = new Set();
  const recruiterIds = new Set();
  for (const candidate of rawCandidates) {
    if (candidate.assignedToId) recruiterIds.add(candidate.assignedToId);
    for (const id of candidate.assignedJobs || []) if (id) jobIds.add(id);
    for (const app of candidate.applications || []) if (app.jobId) jobIds.add(app.jobId);
  }

  const [jobs, recruiters] = await Promise.all([
    jobIds.size
      ? prisma.job.findMany({
          where: { id: { in: Array.from(jobIds) } },
          select: { id: true, title: true },
        })
      : [],
    recruiterIds.size
      ? prisma.user.findMany({
          where: { id: { in: Array.from(recruiterIds) } },
          select: { id: true, name: true, email: true },
        })
      : [],
  ]);

  const jobTitleById = new Map(jobs.map((job) => [job.id, job.title]));
  const recruiterNameById = new Map(recruiters.map((user) => [user.id, user.name]));
  const allCandidates = rawCandidates.map((candidate) =>
    compactCandidateRowForAi(candidate, recruiterNameById, jobTitleById),
  );
  const allCandidateIds = new Set(allCandidates.map((candidate) => candidate.id));

  return {
    ...buildTenantMeta(
      tenantDbName,
      totalCandidates,
      allCandidates.length,
      allCandidateIds,
      'totalCandidates',
      'candidatesLoadedForAi',
    ),
    stages: uniqueNonEmpty(rawCandidates.map((candidate) => candidate.stage || candidate.status)),
    statuses: uniqueNonEmpty(rawCandidates.map((candidate) => candidate.status)),
    sources: uniqueNonEmpty(rawCandidates.map((candidate) => candidate.source)),
    jobs: jobs.map((job) => ({ id: job.id, name: job.title })),
    recruiters,
    allCandidates,
    allCandidateIds,
  };
}

export function normalizeCandidatesAiFiltersAgainstTenant(filters = {}, keywords = [], tenantDb = {}) {
  const nextFilters = { ...filters };
  const nextKeywords = Array.isArray(keywords) ? [...keywords] : [];

  if (nextFilters.stage) {
    nextFilters.stage =
      findClosestMatch(nextFilters.stage, tenantDb.stages || []) || nextFilters.stage;
  }
  if (nextFilters.ownerId) {
    nextFilters.ownerId = resolveRecruiterId(nextFilters.ownerId, tenantDb.recruiters || []);
  }
  if (nextFilters.jobId) {
    nextFilters.jobId = resolveNamedId(nextFilters.jobId, tenantDb.jobs || []);
  }
  if (nextFilters.status) {
    nextFilters.status =
      findClosestMatch(nextFilters.status, tenantDb.statuses || []) || nextFilters.status;
  }
  if (nextFilters.source) {
    nextFilters.source =
      findClosestMatch(nextFilters.source, tenantDb.sources || []) || nextFilters.source;
  }

  return { filters: nextFilters, keywords: nextKeywords };
}

// —— Interviews ——

function buildInterviewAssignmentScope(req) {
  if (canViewAllAssignments(req) || !req?.user?.id) return null;
  return {
    OR: [
      { interviewerId: req.user.id },
      { createdById: req.user.id },
      { panel: { some: { userId: req.user.id } } },
    ],
  };
}

export function buildInterviewsListScopeWhere(req) {
  const assignmentScope = buildInterviewAssignmentScope(req);
  return assignmentScope ? { AND: [assignmentScope] } : {};
}

function compactInterviewRowForAi(interview, nameMaps = {}) {
  const candidate = interview.candidate || {};
  const job = interview.job || {};
  const client = interview.client || {};
  const interviewer = interview.interviewer || {};

  return {
    id: interview.id,
    status: clip(interview.status, 30),
    round: clip(interview.round, 30),
    mode: clip(interview.mode, 20),
    scheduledAt: interview.scheduledAt ? new Date(interview.scheduledAt).toISOString() : '',
    candidateName: clip(`${candidate.firstName || ''} ${candidate.lastName || ''}`.trim(), 60),
    jobTitle: clip(job.title, 60),
    clientName: clip(client.companyName, 60),
    interviewerName: clip(interviewer.name, 60),
    clientJob: clip(`${client.companyName || ''} • ${job.title || ''}`.trim(), 100),
  };
}

export async function loadInterviewsTenantSearchContext(req) {
  const where = buildInterviewsListScopeWhere(req);
  const tenantDbName = getActiveTenantDbName() || String(req?.user?.tenantDbName || '').trim();
  const totalInterviews = await prisma.interview.count({ where });

  const rawInterviews = await prisma.interview.findMany({
    where,
    ...smartSearchFindManyTake(),
    orderBy: { scheduledAt: 'desc' },
    select: {
      id: true,
      status: true,
      round: true,
      mode: true,
      scheduledAt: true,
      candidate: { select: { firstName: true, lastName: true } },
      job: { select: { id: true, title: true } },
      client: { select: { id: true, companyName: true } },
      interviewer: { select: { id: true, name: true, email: true } },
    },
  });

  const allInterviews = rawInterviews.map((row) => compactInterviewRowForAi(row));
  const allInterviewIds = new Set(allInterviews.map((row) => row.id));

  const interviewers = uniqueNonEmpty(
    rawInterviews.map((row) => row.interviewer?.name).filter(Boolean),
    100,
  ).map((name) => ({ name }));
  const clientJobs = uniqueNonEmpty(
    rawInterviews.map((row) => {
      const client = row.client?.companyName || '';
      const job = row.job?.title || '';
      return client && job ? `${client} • ${job}` : '';
    }),
    200,
  );

  return {
    ...buildTenantMeta(
      tenantDbName,
      totalInterviews,
      allInterviews.length,
      allInterviewIds,
      'totalInterviews',
      'interviewsLoadedForAi',
    ),
    statuses: uniqueNonEmpty(rawInterviews.map((row) => row.status)),
    rounds: uniqueNonEmpty(rawInterviews.map((row) => row.round)),
    modes: uniqueNonEmpty(rawInterviews.map((row) => row.mode)),
    interviewers,
    clientJobs,
    allInterviews,
    allInterviewIds,
  };
}

export function normalizeInterviewsAiFiltersAgainstTenant(filters = {}, keywords = [], tenantDb = {}) {
  const nextFilters = { ...filters };
  const nextKeywords = Array.isArray(keywords) ? [...keywords] : [];

  if (nextFilters.status) {
    nextFilters.status =
      findClosestMatch(nextFilters.status, tenantDb.statuses || []) || nextFilters.status;
  }
  if (nextFilters.round) {
    nextFilters.round = findClosestMatch(nextFilters.round, tenantDb.rounds || []) || nextFilters.round;
  }
  if (nextFilters.interviewer) {
    const matched = findClosestMatch(
      nextFilters.interviewer,
      (tenantDb.interviewers || []).map((item) => item.name),
    );
    if (matched) nextFilters.interviewer = matched;
  }
  if (nextFilters.clientJob) {
    const matched = findClosestMatch(nextFilters.clientJob, tenantDb.clientJobs || []);
    if (matched) nextFilters.clientJob = matched;
  }

  return { filters: nextFilters, keywords: nextKeywords };
}

// —— Placements ——

function compactPlacementRowForAi(placement, nameMaps = {}) {
  const candidate = placement.candidate || {};
  const job = placement.job || {};
  const client = placement.client || {};
  const recruiter = placement.recruiter || {};

  return {
    id: placement.id,
    status: clip(placement.status, 30),
    employmentType: clip(placement.employmentType, 30),
    offerDate: placement.offerDate ? new Date(placement.offerDate).toISOString().slice(0, 10) : '',
    joiningDate: placement.joiningDate
      ? new Date(placement.joiningDate).toISOString().slice(0, 10)
      : '',
    candidateName: clip(`${candidate.firstName || ''} ${candidate.lastName || ''}`.trim(), 60),
    jobTitle: clip(job.title, 60),
    companyName: clip(client.companyName, 60),
    recruiterName: clip(recruiter.name, 60),
    clientId: placement.clientId || '',
    recruiterId: placement.recruiterId || '',
  };
}

export async function loadPlacementsTenantSearchContext(req) {
  const where = { deletedAt: null };
  const tenantDbName = getActiveTenantDbName() || String(req?.user?.tenantDbName || '').trim();
  const totalPlacements = await prisma.placement.count({ where });

  const rawPlacements = await prisma.placement.findMany({
    where,
    ...smartSearchFindManyTake(),
    orderBy: { offerDate: 'desc' },
    select: {
      id: true,
      status: true,
      employmentType: true,
      offerDate: true,
      joiningDate: true,
      clientId: true,
      recruiterId: true,
      candidate: { select: { firstName: true, lastName: true } },
      job: { select: { title: true } },
      client: { select: { id: true, companyName: true } },
      recruiter: { select: { id: true, name: true, email: true } },
    },
  });

  const allPlacements = rawPlacements.map((row) => compactPlacementRowForAi(row));
  const allPlacementIds = new Set(allPlacements.map((row) => row.id));
  const clients = uniqueNonEmpty(
    rawPlacements.map((row) => row.client?.companyName).filter(Boolean),
    200,
  ).map((name, index) => ({ id: rawPlacements[index]?.clientId || '', name }));
  const recruiters = rawPlacements
    .map((row) => row.recruiter)
    .filter((user) => user?.id)
    .reduce((acc, user) => {
      if (!acc.some((item) => item.id === user.id)) acc.push(user);
      return acc;
    }, []);

  return {
    ...buildTenantMeta(
      tenantDbName,
      totalPlacements,
      allPlacements.length,
      allPlacementIds,
      'totalPlacements',
      'placementsLoadedForAi',
    ),
    statuses: uniqueNonEmpty(rawPlacements.map((row) => row.status)),
    employmentTypes: uniqueNonEmpty(rawPlacements.map((row) => row.employmentType)),
    clients: rawPlacements
      .filter((row) => row.client?.id)
      .reduce((acc, row) => {
        if (!acc.some((item) => item.id === row.client.id)) {
          acc.push({ id: row.client.id, name: row.client.companyName });
        }
        return acc;
      }, []),
    recruiters,
    allPlacements,
    allPlacementIds,
  };
}

export function normalizePlacementsAiFiltersAgainstTenant(filters = {}, keywords = [], tenantDb = {}) {
  const nextFilters = { ...filters };
  const nextKeywords = Array.isArray(keywords) ? [...keywords] : [];

  if (nextFilters.status) {
    nextFilters.status =
      findClosestMatch(nextFilters.status, tenantDb.statuses || []) || nextFilters.status;
  }
  if (nextFilters.companyId) {
    nextFilters.companyId = resolveNamedId(nextFilters.companyId, tenantDb.clients || []);
  }
  if (nextFilters.recruiterId) {
    nextFilters.recruiterId = resolveRecruiterId(nextFilters.recruiterId, tenantDb.recruiters || []);
  }

  return { filters: nextFilters, keywords: nextKeywords };
}

export const ENTITY_TENANT_LOADERS = {
  leads: {
    load: loadLeadsTenantSearchContext,
    normalize: normalizeLeadsAiFiltersAgainstTenant,
    sanitize: (ids, db) => sanitizeMatchingLeadIds(ids, db),
    matchingIdsField: 'matchingLeadIds',
    allRecordsKey: 'allLeads',
    totalKey: 'totalLeads',
    loadedKey: 'leadsLoadedForAi',
  },
  jobs: {
    load: loadJobsTenantSearchContext,
    normalize: normalizeJobsAiFiltersAgainstTenant,
    sanitize: (ids, db) => sanitizeMatchingIds(ids, db.allJobIds),
    matchingIdsField: 'matchingJobIds',
    allRecordsKey: 'allJobs',
    totalKey: 'totalJobs',
    loadedKey: 'jobsLoadedForAi',
  },
  clients: {
    load: loadClientsTenantSearchContext,
    normalize: normalizeClientsAiFiltersAgainstTenant,
    sanitize: (ids, db) => sanitizeMatchingIds(ids, db.allClientIds),
    matchingIdsField: 'matchingClientIds',
    allRecordsKey: 'allClients',
    totalKey: 'totalClients',
    loadedKey: 'clientsLoadedForAi',
  },
  candidates: {
    load: loadCandidatesTenantSearchContext,
    normalize: normalizeCandidatesAiFiltersAgainstTenant,
    sanitize: (ids, db) => sanitizeMatchingIds(ids, db.allCandidateIds),
    matchingIdsField: 'matchingCandidateIds',
    allRecordsKey: 'allCandidates',
    totalKey: 'totalCandidates',
    loadedKey: 'candidatesLoadedForAi',
  },
  interviews: {
    load: loadInterviewsTenantSearchContext,
    normalize: normalizeInterviewsAiFiltersAgainstTenant,
    sanitize: (ids, db) => sanitizeMatchingIds(ids, db.allInterviewIds),
    matchingIdsField: 'matchingInterviewIds',
    allRecordsKey: 'allInterviews',
    totalKey: 'totalInterviews',
    loadedKey: 'interviewsLoadedForAi',
  },
  placements: {
    load: loadPlacementsTenantSearchContext,
    normalize: normalizePlacementsAiFiltersAgainstTenant,
    sanitize: (ids, db) => sanitizeMatchingIds(ids, db.allPlacementIds),
    matchingIdsField: 'matchingPlacementIds',
    allRecordsKey: 'allPlacements',
    totalKey: 'totalPlacements',
    loadedKey: 'placementsLoadedForAi',
  },
};
