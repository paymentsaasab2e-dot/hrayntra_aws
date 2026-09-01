import crypto from 'node:crypto';
import { prisma, runWithTenantContext, getJobPortalPrismaClient } from '../../config/prisma.js';
import { env } from '../../config/env.js';
import { headquartersAuthService } from '../auth/headquarters-auth.service.js';
import { getPaginationParams, formatPaginationResponse } from '../../utils/pagination.js';
import { escapePrismaRegex } from '../../utils/escapePrismaRegex.js';

export const JOBS_API_KEY_PREFIX = 'hryj_';

function portalPublicOrigin() {
  return String(
    process.env.JOB_PORTAL_PUBLIC_URL ||
      process.env.PORTAL_PUBLIC_URL ||
      'https://www.hryantra.com',
  ).replace(/\/$/, '');
}

export function tenantJobsFeedUrl(apiKey) {
  const base = String(env.BACKEND_PUBLIC_URL || '').replace(/\/$/, '');
  const path = '/api/v1/public/tenant-jobs';
  if (!apiKey) return `${base}${path}`;
  return `${base}${path}/${encodeURIComponent(apiKey)}`;
}

export function generateJobsApiKey() {
  return `${JOBS_API_KEY_PREFIX}${crypto.randomBytes(24).toString('base64url')}`;
}

export function extractJobsApiKey(req) {
  const headerKey = String(req.headers['x-api-key'] || '').trim();
  if (headerKey) return headerKey;
  const auth = String(req.headers.authorization || '').trim();
  if (/^bearer\s+/i.test(auth)) return auth.replace(/^bearer\s+/i, '').trim();
  const paramKey = String(req.params?.apiKey || req.params?.id || '').trim();
  if (paramKey.startsWith(JOBS_API_KEY_PREFIX)) return paramKey;
  return String(req.query?.apiKey || req.query?.api_key || '').trim();
}

function iso(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function publicSalary(salary) {
  if (!salary || typeof salary !== 'object') return null;
  return {
    min: salary.min ?? salary.minimum ?? null,
    max: salary.max ?? salary.maximum ?? null,
    currency: salary.currency || salary.currencyCode || null,
    period: salary.period || salary.frequency || salary.type || null,
    text: salary.text || salary.display || null,
  };
}

function publicClient(job) {
  const client = job.client;
  const showName = job.showClientNamePublicly !== false && job.hqHideClientName !== true;
  if (!client) {
    return {
      name: showName ? null : null,
      hidden: !showName,
    };
  }
  return {
    id: showName ? client.id : null,
    name: showName ? client.companyName || null : null,
    logo: client.logo || null,
    industry: client.industry || null,
    location: client.location || null,
    website: showName ? client.website || null : null,
    hidden: !showName,
  };
}

function mapJobForIntegration(job, tenant) {
  const applyToken = String(job.applyLinkToken || '').trim();
  const backend = String(env.BACKEND_PUBLIC_URL || '').replace(/\/$/, '');
  const tenantDb = String(tenant.tenantDbName || '').trim();
  return {
    id: job.id,
    title: job.title || '',
    description: job.description || '',
    overview: job.overview || '',
    requirements: Array.isArray(job.requirements) ? job.requirements : [],
    skills: Array.isArray(job.skills) ? job.skills : [],
    keyResponsibilities: Array.isArray(job.keyResponsibilities) ? job.keyResponsibilities : [],
    candidateRequirements: Array.isArray(job.candidateRequirements) ? job.candidateRequirements : [],
    preferredSkills: Array.isArray(job.preferredSkills) ? job.preferredSkills : [],
    benefits: Array.isArray(job.benefits) ? job.benefits : [],
    experienceRequired: job.experienceRequired || null,
    education: job.education || null,
    location: job.location || null,
    city: job.city || null,
    state: job.state || null,
    country: job.country || null,
    nationality: job.nationality || null,
    jobLocationType: job.jobLocationType || null,
    workMode: job.workMode || null,
    type: job.type || null,
    status: job.status || null,
    statusLabel: job.statusLabel || null,
    openings: job.openings ?? 1,
    department: job.department || null,
    jobCategory: job.jobCategory || null,
    priority: job.priority || null,
    languages: job.languages || [],
    salary: publicSalary(job.salary),
    postedDate: iso(job.postedDate),
    expectedClosureDate: iso(job.expectedClosureDate),
    createdAt: iso(job.createdAt),
    updatedAt: iso(job.updatedAt),
    visibility: job.visibility || 'Public',
    aboutCompany: job.aboutCompany || null,
    videoMediaLink: job.videoMediaLink || null,
    applicationFormEnabled: job.applicationFormEnabled === true,
    applyUrl: applyToken
      ? `${backend}/api/v1/jobs/public/apply/${encodeURIComponent(applyToken)}${
          tenantDb ? `?tenantDbName=${encodeURIComponent(tenantDb)}` : ''
        }`
      : null,
    jobUrl: `${portalPublicOrigin()}/explore-jobs?job=${encodeURIComponent(job.id)}`,
    client: publicClient(job),
    tenant: {
      name: tenant.organizationName || tenant.name || null,
      organizationType: tenant.organizationType || null,
    },
  };
}

async function resolveTenantFromApiKey(apiKey) {
  const key = String(apiKey || '').trim();
  if (!key || !key.startsWith(JOBS_API_KEY_PREFIX)) {
    const err = new Error('Invalid API key');
    err.statusCode = 401;
    throw err;
  }
  const tenant = await headquartersAuthService.findWorkspaceUserByJobsApiKey(key);
  if (!tenant) {
    const err = new Error('Invalid API key');
    err.statusCode = 401;
    throw err;
  }
  if (String(tenant.status || 'ACTIVE').toUpperCase() === 'PAUSED') {
    const err = new Error('This tenant workspace is paused');
    err.statusCode = 403;
    throw err;
  }
  if (!String(tenant.tenantDbName || '').trim()) {
    const err = new Error('This tenant has no workspace yet');
    err.statusCode = 409;
    throw err;
  }
  return tenant;
}

const JOB_CLIENT_INCLUDE = {
  client: {
    select: {
      id: true,
      companyName: true,
      logo: true,
      industry: true,
      location: true,
      website: true,
    },
  },
};

function jobsWhere(req) {
  const search = String(req.query?.search || req.query?.q || '').trim();
  const type = String(req.query?.type || '').trim();
  const city = String(req.query?.city || '').trim();
  const country = String(req.query?.country || '').trim();
  const location = String(req.query?.location || '').trim();
  const department = String(req.query?.department || '').trim();
  const where = {
    AND: [{ isDeleted: { not: true } }],
  };
  if (type) where.AND.push({ type });
  if (city) where.AND.push({ city: { contains: escapePrismaRegex(city), mode: 'insensitive' } });
  if (country) {
    where.AND.push({ country: { contains: escapePrismaRegex(country), mode: 'insensitive' } });
  }
  if (location) {
    where.AND.push({ location: { contains: escapePrismaRegex(location), mode: 'insensitive' } });
  }
  if (department) {
    where.AND.push({
      department: { contains: escapePrismaRegex(department), mode: 'insensitive' },
    });
  }
  if (search) {
    const escaped = escapePrismaRegex(search);
    where.AND.push({
      OR: [
        { title: { contains: escaped, mode: 'insensitive' } },
        { description: { contains: escaped, mode: 'insensitive' } },
        { overview: { contains: escaped, mode: 'insensitive' } },
        { location: { contains: escaped, mode: 'insensitive' } },
        { jobCategory: { contains: escaped, mode: 'insensitive' } },
        { department: { contains: escaped, mode: 'insensitive' } },
        { city: { contains: escaped, mode: 'insensitive' } },
        { country: { contains: escaped, mode: 'insensitive' } },
      ],
    });
  }
  return where;
}

async function findJobsForTenant(tenant, where, skip, take) {
  const orderBy = [{ postedDate: 'desc' }, { createdAt: 'desc' }];
  const run = async (client, extraWhere = {}) => {
    const scoped = extraWhere.tenantDbName
      ? { AND: [...(where.AND || [where]), { tenantDbName: extraWhere.tenantDbName }] }
      : where;
    try {
      return await Promise.all([
        client.job.findMany({
          where: scoped,
          skip,
          take,
          orderBy,
          include: JOB_CLIENT_INCLUDE,
        }),
        client.job.count({ where: scoped }),
      ]);
    } catch {
      return Promise.all([
        client.job.findMany({ where: scoped, skip, take, orderBy }),
        client.job.count({ where: scoped }),
      ]);
    }
  };

  const tenantResult = await runWithTenantContext(tenant.tenantDbName, () => run(prisma));
  if (tenantResult[1] > 0) return tenantResult;

  const portal = getJobPortalPrismaClient();
  return run(portal, { tenantDbName: tenant.tenantDbName });
}

export async function listTenantJobsByApiKey(req) {
  const tenant = await resolveTenantFromApiKey(extractJobsApiKey(req));
  const pageRaw = Number.parseInt(String(req.query?.page || '1'), 10);
  const limitRaw = Number.parseInt(String(req.query?.limit || '50'), 10);
  req.query.page = String(Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1);
  req.query.limit = String(Math.min(100, Math.max(1, Number.isFinite(limitRaw) ? limitRaw : 50)));
  const { page, limit, skip } = getPaginationParams(req);
  const where = jobsWhere(req);
  const [rows, total] = await findJobsForTenant(tenant, where, skip, limit);
  const jobs = rows.map((job) => mapJobForIntegration(job, tenant));
  return {
    tenant: {
      name: tenant.organizationName || tenant.name || null,
      organizationType: tenant.organizationType || null,
    },
    ...formatPaginationResponse(jobs, page, limit, total),
  };
}

export async function getTenantJobByApiKey(req) {
  const tenant = await resolveTenantFromApiKey(extractJobsApiKey(req));
  const id = String(req.params?.id || '').trim();
  if (!/^[a-fA-F0-9]{24}$/.test(id)) {
    const err = new Error('Job not found');
    err.statusCode = 404;
    throw err;
  }
  const load = async (client) =>
    client.job.findFirst({
      where: { id, isDeleted: { not: true } },
      include: JOB_CLIENT_INCLUDE,
    }).catch(() =>
      client.job.findFirst({
        where: { id, isDeleted: { not: true } },
      }),
    );

  const tenantJob = await runWithTenantContext(tenant.tenantDbName, () => load(prisma));
  const job =
    tenantJob ||
    (await load(getJobPortalPrismaClient()).then((row) =>
      String(row?.tenantDbName || '') === String(tenant.tenantDbName || '') ? row : null,
    ));
  if (!job) {
    const err = new Error('Job not found');
    err.statusCode = 404;
    throw err;
  }
  return {
    tenant: {
      name: tenant.organizationName || tenant.name || null,
      organizationType: tenant.organizationType || null,
    },
    job: mapJobForIntegration(job, tenant),
  };
}
