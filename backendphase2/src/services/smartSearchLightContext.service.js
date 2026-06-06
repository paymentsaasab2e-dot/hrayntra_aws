import { prisma, getActiveTenantDbName } from '../config/prisma.js';
import { buildLeadsListScopeWhere } from './smartSearchLeadContext.service.js';
import {
  buildJobsListScopeWhere,
  buildClientsListScopeWhere,
  buildCandidateListScopeWhere,
  buildInterviewsListScopeWhere,
  uniqueNonEmpty,
} from './smartSearchTenantContext.service.js';
import { getEntitySchema, SCHEMA_ENUMS } from './smartSearchSchema.config.js';

const OPTION_LIMIT = 100;

async function distinctValues(model, field, where) {
  try {
    const rows = await prisma[model].findMany({
      where,
      distinct: [field],
      select: { [field]: true },
      take: OPTION_LIMIT,
    });
    return uniqueNonEmpty(rows.map((row) => row[field]));
  } catch {
    return [];
  }
}

async function loadRecruiterOptions(userIds = []) {
  const ids = [...new Set(userIds.filter(Boolean))].slice(0, OPTION_LIMIT);
  if (!ids.length) return [];
  return prisma.user.findMany({
    where: { id: { in: ids } },
    select: { id: true, name: true, email: true },
    orderBy: { name: 'asc' },
    take: OPTION_LIMIT,
  });
}

/** Small metadata snapshot for AI — no full row dumps (low token usage). */
export async function loadLeadsSmartSearchLightContext(req) {
  const where = buildLeadsListScopeWhere(req);
  const tenantDbName = getActiveTenantDbName() || String(req?.user?.tenantDbName || '').trim();
  const totalLeads = await prisma.lead.count({ where });

  const [statuses, sources, priorities, assigneeRows, companyRows] = await Promise.all([
    distinctValues('lead', 'status', where),
    distinctValues('lead', 'source', where),
    distinctValues('lead', 'priority', where),
    prisma.lead.findMany({
      where,
      distinct: ['assignedToId'],
      select: { assignedToId: true, assignedToIds: true },
      take: OPTION_LIMIT,
    }),
    prisma.lead.findMany({
      where,
      distinct: ['companyName'],
      select: { companyName: true },
      orderBy: { companyName: 'asc' },
      take: OPTION_LIMIT,
    }),
  ]);

  const recruiterIds = new Set();
  for (const row of assigneeRows) {
    if (row.assignedToId) recruiterIds.add(row.assignedToId);
    for (const id of row.assignedToIds || []) if (id) recruiterIds.add(id);
  }
  const recruiters = await loadRecruiterOptions([...recruiterIds]);

  const schema = getEntitySchema('leads');
  return {
    tenantDbName,
    totalLeads,
    searchMode: 'ai_parse_db_query',
    prismaModel: schema?.prismaModel,
    schemaEnums: SCHEMA_ENUMS,
    statuses,
    sources,
    priorities,
    companies: uniqueNonEmpty(companyRows.map((row) => row.companyName), 100),
    recruiters,
  };
}

export async function loadJobsSmartSearchLightContext(req) {
  const where = buildJobsListScopeWhere(req);
  const tenantDbName = getActiveTenantDbName() || String(req?.user?.tenantDbName || '').trim();
  const totalJobs = await prisma.job.count({ where });

  const [statuses, clientIdRows, recruiterIdRows] = await Promise.all([
    distinctValues('job', 'status', where),
    prisma.job.findMany({
      where: { ...where, clientId: { not: null } },
      distinct: ['clientId'],
      select: { clientId: true },
      take: OPTION_LIMIT,
    }),
    prisma.job.findMany({
      where: { ...where, assignedToId: { not: null } },
      distinct: ['assignedToId'],
      select: { assignedToId: true },
      take: OPTION_LIMIT,
    }),
  ]);

  const clientIds = clientIdRows.map((row) => row.clientId).filter(Boolean);
  const clients = clientIds.length
    ? await prisma.client.findMany({
        where: { id: { in: clientIds } },
        select: { id: true, companyName: true },
        take: OPTION_LIMIT,
      })
    : [];
  const recruiters = await loadRecruiterOptions(recruiterIdRows.map((row) => row.assignedToId));

  const schema = getEntitySchema('jobs');
  return {
    tenantDbName,
    totalJobs,
    searchMode: 'ai_parse_db_query',
    prismaModel: schema?.prismaModel,
    schemaEnums: { JobStatus: SCHEMA_ENUMS.JobStatus, JobType: SCHEMA_ENUMS.JobType },
    statuses,
    clients: clients.map((c) => ({ id: c.id, name: c.companyName })),
    recruiters,
  };
}

export async function loadClientsSmartSearchLightContext(req) {
  const where = buildClientsListScopeWhere(req);
  const tenantDbName = getActiveTenantDbName() || String(req?.user?.tenantDbName || '').trim();
  const totalClients = await prisma.client.count({ where });

  const [statuses, priorities, companyRows, assigneeRows] = await Promise.all([
    distinctValues('client', 'status', where),
    distinctValues('client', 'priority', where),
    prisma.client.findMany({
      where,
      distinct: ['companyName'],
      select: { companyName: true },
      orderBy: { companyName: 'asc' },
      take: OPTION_LIMIT,
    }),
    prisma.client.findMany({
      where: { ...where, assignedToId: { not: null } },
      distinct: ['assignedToId'],
      select: { assignedToId: true },
      take: OPTION_LIMIT,
    }),
  ]);

  const recruiters = await loadRecruiterOptions(assigneeRows.map((row) => row.assignedToId));

  const schema = getEntitySchema('clients');
  return {
    tenantDbName,
    totalClients,
    searchMode: 'ai_parse_db_query',
    prismaModel: schema?.prismaModel,
    schemaEnums: {
      ClientStatus: SCHEMA_ENUMS.ClientStatus,
      Priority: SCHEMA_ENUMS.Priority,
    },
    statuses,
    priorities,
    companies: uniqueNonEmpty(companyRows.map((row) => row.companyName), 100),
    recruiters,
  };
}

export async function loadCandidatesSmartSearchLightContext(req) {
  const where = await buildCandidateListScopeWhere(req);
  const tenantDbName = getActiveTenantDbName() || String(req?.user?.tenantDbName || '').trim();
  const totalCandidates = await prisma.candidate.count({ where });

  const [stages, assigneeRows, jobLinkRows] = await Promise.all([
    distinctValues('candidate', 'stage', where),
    prisma.candidate.findMany({
      where: { ...where, assignedToId: { not: null } },
      distinct: ['assignedToId'],
      select: { assignedToId: true },
      take: OPTION_LIMIT,
    }),
    prisma.candidate.findMany({
      where: { ...where, assignedJobs: { isEmpty: false } },
      select: { assignedJobs: true },
      take: 50,
    }),
  ]);

  const jobIds = new Set();
  for (const row of jobLinkRows) {
    for (const id of row.assignedJobs || []) if (id) jobIds.add(id);
  }
  const jobs = jobIds.size
    ? await prisma.job.findMany({
        where: { id: { in: [...jobIds].slice(0, OPTION_LIMIT) } },
        select: { id: true, title: true },
        take: OPTION_LIMIT,
      })
    : [];
  const recruiters = await loadRecruiterOptions(assigneeRows.map((row) => row.assignedToId));
  const statusStages = await distinctValues('candidate', 'status', where);

  const schema = getEntitySchema('candidates');
  return {
    tenantDbName,
    totalCandidates,
    searchMode: 'ai_parse_db_query',
    prismaModel: schema?.prismaModel,
    schemaEnums: { CandidateStatus: SCHEMA_ENUMS.CandidateStatus },
    stages: uniqueNonEmpty([...stages, ...statusStages]),
    jobs: jobs.map((job) => ({ id: job.id, name: job.title })),
    recruiters,
  };
}

export async function loadInterviewsSmartSearchLightContext(req) {
  const where = buildInterviewsListScopeWhere(req);
  const tenantDbName = getActiveTenantDbName() || String(req?.user?.tenantDbName || '').trim();
  const totalInterviews = await prisma.interview.count({ where });

  const [statuses, rounds, modes, samples] = await Promise.all([
    distinctValues('interview', 'status', where),
    distinctValues('interview', 'round', where),
    distinctValues('interview', 'mode', where),
    prisma.interview.findMany({
      where,
      select: {
        interviewer: { select: { name: true } },
        client: { select: { companyName: true } },
        job: { select: { title: true } },
      },
      take: 60,
      orderBy: { scheduledAt: 'desc' },
    }),
  ]);

  const interviewers = uniqueNonEmpty(
    samples.map((row) => row.interviewer?.name).filter(Boolean),
    80,
  ).map((name) => ({ name }));
  const clientJobs = uniqueNonEmpty(
    samples.map((row) => {
      const client = row.client?.companyName || '';
      const job = row.job?.title || '';
      return client && job ? `${client} • ${job}` : '';
    }),
    100,
  );

  const schema = getEntitySchema('interviews');
  return {
    tenantDbName,
    totalInterviews,
    searchMode: 'ai_parse_db_query',
    prismaModel: schema?.prismaModel,
    schemaEnums: {
      InterviewStatus: SCHEMA_ENUMS.InterviewStatus,
      InterviewMode: SCHEMA_ENUMS.InterviewMode,
    },
    statuses,
    rounds,
    modes,
    interviewers,
    clientJobs,
  };
}

export async function loadPlacementsSmartSearchLightContext(req) {
  const where = { deletedAt: null };
  const tenantDbName = getActiveTenantDbName() || String(req?.user?.tenantDbName || '').trim();
  const totalPlacements = await prisma.placement.count({ where });

  const [statuses, employmentTypes, clientRows, recruiterRows] = await Promise.all([
    distinctValues('placement', 'status', where),
    distinctValues('placement', 'employmentType', where),
    prisma.placement.findMany({
      where: { ...where, clientId: { not: null } },
      distinct: ['clientId'],
      select: { clientId: true },
      take: OPTION_LIMIT,
    }),
    prisma.placement.findMany({
      where: { ...where, recruiterId: { not: null } },
      distinct: ['recruiterId'],
      select: { recruiterId: true },
      take: OPTION_LIMIT,
    }),
  ]);

  const clientIds = clientRows.map((row) => row.clientId).filter(Boolean);
  const clients = clientIds.length
    ? await prisma.client.findMany({
        where: { id: { in: clientIds } },
        select: { id: true, companyName: true },
        take: OPTION_LIMIT,
      })
    : [];
  const recruiters = await loadRecruiterOptions(recruiterRows.map((row) => row.recruiterId));

  const schema = getEntitySchema('placements');
  return {
    tenantDbName,
    totalPlacements,
    searchMode: 'ai_parse_db_query',
    prismaModel: schema?.prismaModel,
    schemaEnums: {
      PlacementStatus: SCHEMA_ENUMS.PlacementStatus,
      EmploymentType: SCHEMA_ENUMS.EmploymentType,
    },
    statuses,
    employmentTypes,
    clients: clients.map((c) => ({ id: c.id, name: c.companyName })),
    recruiters,
  };
}

export const SMART_SEARCH_LIGHT_LOADERS = {
  leads: loadLeadsSmartSearchLightContext,
  jobs: loadJobsSmartSearchLightContext,
  clients: loadClientsSmartSearchLightContext,
  candidates: loadCandidatesSmartSearchLightContext,
  interviews: loadInterviewsSmartSearchLightContext,
  placements: loadPlacementsSmartSearchLightContext,
};
