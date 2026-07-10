import { env } from '../../config/env.js';
import {
  getCandidateCommonPrismaClient,
  getJobPortalPrismaClient,
  prisma,
  runWithTenantContext,
} from '../../config/prisma.js';
import { headquartersAuthService } from '../auth/headquarters-auth.service.js';
import { jobService, removeJobFromPortalDatabases } from '../job/job.service.js';

const LIST_LIMIT = Math.min(
  10000,
  Math.max(100, Number(process.env.HQ_PORTAL_LIST_MAX || 2000) || 2000),
);

const CANDIDATE_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  phone: true,
  currentTitle: true,
  designation: true,
  location: true,
  city: true,
  status: true,
  recruiterStatus: true,
  source: true,
  stage: true,
  createdAt: true,
  updatedAt: true,
};

function portalDbName() {
  const url = String(env.JOB_PORTAL_DATABASE_URL || env.DATABASE_URL || '').trim();
  if (!url) return 'jobportal';
  try {
    return new URL(url).pathname.replace(/^\//, '') || 'jobportal';
  } catch {
    return 'jobportal';
  }
}

function commonDbName() {
  const url = String(env.CANDIDATE_COMMON_DATABASE_URL || '').trim();
  if (url) {
    try {
      return new URL(url).pathname.replace(/^\//, '') || 'candidatecommon';
    } catch {
      return 'candidatecommon';
    }
  }
  return 'candidatecommon';
}

function fullName(first, last) {
  return [first, last].filter(Boolean).join(' ').trim() || '—';
}

function candidateKey(origin, id, tenantDbName = '') {
  return `${origin}:${tenantDbName || ''}:${id}`;
}

function notSoftDeletedWhere() {
  // MongoDB nullable booleans: legacy portal rows store isDeleted as null/unset.
  // `{ not: true }` excludes those rows; match Phase 1 listing behavior instead.
  return {
    OR: [{ isDeleted: false }, { isDeleted: { isSet: false } }],
  };
}

function jobKey(id, tenantDbName = '') {
  return `${tenantDbName || 'phase1'}:${id}`;
}

function toPortalCandidateRow(doc, origin, extra = {}) {
  const tenantDbName = extra.tenantDbName || '';
  return {
    id: doc.id,
    name: fullName(doc.firstName, doc.lastName),
    email: doc.email || '',
    phone: doc.phone || '',
    title: doc.currentTitle || doc.designation || '',
    location: doc.location || doc.city || '',
    status: String(doc.status || doc.recruiterStatus || doc.stage || '—'),
    source: doc.source || origin,
    stage: doc.stage || '',
    tenantDbName,
    updatedAt: doc.updatedAt instanceof Date ? doc.updatedAt.toISOString() : null,
    createdAt: doc.createdAt instanceof Date ? doc.createdAt.toISOString() : null,
    origin,
  };
}

function toPortalJobRow(doc, origin, extra = {}) {
  const tenantDbName = extra.tenantDbName || doc.tenantDbName || '';
  const company =
    doc.client?.companyName ||
    doc.hiringManager ||
    (doc.showClientNamePublicly === false ? 'Confidential' : '') ||
    '—';

  let postedBy = 'Phase 1 portal';
  if (origin === 'phase2_crm' && tenantDbName) {
    postedBy = `CRM ${tenantDbName}`;
  } else if (tenantDbName) {
    postedBy = `Tenant ${tenantDbName}`;
  }

  return {
    id: doc.id,
    title: doc.title || '—',
    company,
    location: doc.location || doc.city || '',
    status: String(doc.status || '—'),
    workMode: doc.workMode || doc.jobLocationType || '',
    tenantDbName,
    postedBy,
    openings: doc.openings ?? 1,
    visibility: doc.visibility || '',
    origin,
    updatedAt: doc.updatedAt instanceof Date ? doc.updatedAt.toISOString() : null,
    postedDate:
      doc.postedDate instanceof Date
        ? doc.postedDate.toISOString()
        : doc.createdAt instanceof Date
          ? doc.createdAt.toISOString()
          : null,
  };
}

async function resolveTenantDbNames() {
  const tenants = await headquartersAuthService.listTenants();
  return [
    ...new Set(
      (tenants || [])
        .map((tenant) => String(tenant?.tenantDbName || '').trim())
        .filter(Boolean),
    ),
  ];
}

async function fetchPhase2Candidates(tenantDbNames) {
  if (!tenantDbNames.length) return [];

  const perTenant = Math.min(
    500,
    Math.max(50, Math.ceil(LIST_LIMIT / tenantDbNames.length)),
  );

  const batches = await Promise.all(
    tenantDbNames.map(async (tenantDbName) => {
      try {
        return await runWithTenantContext(tenantDbName, async () => {
          const rows = await prisma.candidate.findMany({
            where: notSoftDeletedWhere(),
            orderBy: { updatedAt: 'desc' },
            take: perTenant,
            select: CANDIDATE_SELECT,
          });
          return rows.map((row) =>
            toPortalCandidateRow(row, 'phase2_crm', { tenantDbName }),
          );
        });
      } catch (error) {
        console.warn(
          `[hq-portal] failed to load Phase 2 candidates for ${tenantDbName}:`,
          error?.message || error,
        );
        return [];
      }
    }),
  );

  return batches.flat();
}

async function fetchPhase2OpenJobs(tenantDbNames) {
  if (!tenantDbNames.length) return [];

  const perTenant = Math.min(
    500,
    Math.max(50, Math.ceil(LIST_LIMIT / tenantDbNames.length)),
  );

  const batches = await Promise.all(
    tenantDbNames.map(async (tenantDbName) => {
      try {
        return await runWithTenantContext(tenantDbName, async () => {
          const rows = await prisma.job.findMany({
            where: {
              ...notSoftDeletedWhere(),
              status: 'OPEN',
            },
            orderBy: { updatedAt: 'desc' },
            take: perTenant,
            include: {
              client: { select: { companyName: true } },
            },
          });
          return rows.map((row) =>
            toPortalJobRow(row, 'phase2_crm', { tenantDbName }),
          );
        });
      } catch (error) {
        console.warn(
          `[hq-portal] failed to load Phase 2 jobs for ${tenantDbName}:`,
          error?.message || error,
        );
        return [];
      }
    }),
  );

  return batches.flat();
}

export const hqPortalService = {
  /**
   * Permanently remove a job from Phase 2 tenant DB and Phase 1 portal mirror.
   * Portal-only jobs (no tenant row) are removed from the shared portal DB only.
   */
  async deletePortalJob({ jobId, tenantDbName = '' }) {
    const id = String(jobId || '').trim();
    if (!id) {
      throw new Error('Job ID is required');
    }

    const tenant = String(tenantDbName || '').trim();
    let deletedFromTenant = false;
    let deletedFromPortal = false;

    if (tenant) {
      await runWithTenantContext(tenant, async () => {
        const tenantJob = await prisma.job.findFirst({
          where: { id },
          select: { id: true },
        });
        if (!tenantJob) return;

        try {
          await removeJobFromPortalDatabases(id);
          deletedFromPortal = true;
        } catch (error) {
          console.warn(
            `[hq-portal] portal mirror delete failed for job ${id}:`,
            error?.message || error,
          );
        }

        const result = await jobService.purgeCompletely(id);
        deletedFromTenant = Boolean(result?.deleted);
      });
    }

    if (!deletedFromPortal) {
      const portal = getJobPortalPrismaClient();
      const portalJob = await portal.job.findUnique({
        where: { id },
        select: { id: true },
      });
      if (portalJob) {
        await removeJobFromPortalDatabases(id);
        deletedFromPortal = true;
      }
    }

    if (!deletedFromTenant && !deletedFromPortal) {
      throw new Error('Job not found in tenant or Phase 1 portal');
    }

    return {
      jobId: id,
      tenantDbName: tenant,
      deletedFromTenant,
      deletedFromPortal,
    };
  },

  async getPortalOverview() {
    const portal = getJobPortalPrismaClient();
    const common = getCandidateCommonPrismaClient();
    const tenantDbNames = await resolveTenantDbNames();

    const [
      portalCandidateDocs,
      commonCandidateDocs,
      portalJobDocs,
      phase2Candidates,
      phase2Jobs,
    ] = await Promise.all([
      portal.candidate.findMany({
        where: notSoftDeletedWhere(),
        orderBy: { updatedAt: 'desc' },
        take: LIST_LIMIT,
        select: CANDIDATE_SELECT,
      }),
      common
        ? common.candidateCommon.findMany({
            where: { isVerified: true },
            orderBy: { syncedAt: 'desc' },
            take: LIST_LIMIT,
            select: {
              candidateId: true,
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
              currentTitle: true,
              designation: true,
              location: true,
              city: true,
              stage: true,
              source: true,
              syncedAt: true,
              updatedAt: true,
            },
          })
        : Promise.resolve([]),
      portal.job.findMany({
        where: notSoftDeletedWhere(),
        orderBy: { updatedAt: 'desc' },
        take: LIST_LIMIT,
        include: {
          client: { select: { companyName: true } },
        },
      }),
      fetchPhase2Candidates(tenantDbNames),
      fetchPhase2OpenJobs(tenantDbNames),
    ]);

    const portalIds = new Set(portalCandidateDocs.map((row) => String(row.id)));

    const portalCandidates = portalCandidateDocs.map((row) =>
      toPortalCandidateRow(row, 'phase1_portal'),
    );

    const commonOnlyCandidates = (commonCandidateDocs || [])
      .filter((row) => row?.candidateId && !portalIds.has(String(row.candidateId)))
      .map((row) =>
        toPortalCandidateRow(
          {
            id: row.candidateId,
            firstName: row.firstName,
            lastName: row.lastName,
            email: row.email,
            phone: row.phone,
            currentTitle: row.currentTitle,
            designation: row.designation,
            location: row.location,
            city: row.city,
            stage: row.stage,
            source: row.source || 'phase1',
            status: row.stage || 'NEW',
            createdAt: row.syncedAt,
            updatedAt: row.updatedAt,
          },
          'phase1_common',
        ),
      );

    const candidateByKey = new Map();
    for (const row of [...portalCandidates, ...commonOnlyCandidates, ...phase2Candidates]) {
      candidateByKey.set(candidateKey(row.origin, row.id, row.tenantDbName), row);
    }

    const candidates = Array.from(candidateByKey.values()).sort((a, b) => {
      const ta = new Date(a.updatedAt || a.createdAt || 0).getTime();
      const tb = new Date(b.updatedAt || b.createdAt || 0).getTime();
      return tb - ta;
    });

    const portalJobs = portalJobDocs.map((row) => toPortalJobRow(row, 'phase1_portal'));
    const portalMirroredKeys = new Set(
      portalJobs
        .filter((job) => job.tenantDbName)
        .map((job) => jobKey(job.id, job.tenantDbName)),
    );

    const phase2OnlyJobs = phase2Jobs.filter(
      (job) => !portalMirroredKeys.has(jobKey(job.id, job.tenantDbName)),
    );

    const jobByKey = new Map();
    for (const row of [...portalJobs, ...phase2OnlyJobs]) {
      jobByKey.set(jobKey(row.id, row.tenantDbName), row);
    }

    const jobs = Array.from(jobByKey.values()).sort((a, b) => {
      const ta = new Date(a.updatedAt || a.postedDate || 0).getTime();
      const tb = new Date(b.updatedAt || b.postedDate || 0).getTime();
      return tb - ta;
    });

    const phase2CandidateCount = phase2Candidates.length;
    const phase2JobCount = phase2OnlyJobs.length;
    const tenantJobs = jobs.filter((job) => Boolean(job.tenantDbName)).length;

    return {
      candidates,
      jobs,
      stats: {
        totalCandidates: candidates.length,
        portalCandidates: portalCandidates.length,
        commonCandidates: commonOnlyCandidates.length,
        phase2Candidates: phase2CandidateCount,
        totalJobs: jobs.length,
        phase2Jobs: phase2JobCount,
        tenantJobs,
        portalOnlyJobs: jobs.length - tenantJobs,
        tenantCount: tenantDbNames.length,
      },
      storage: {
        portal: {
          engine: 'MongoDB',
          database: portalDbName(),
          collections: { candidates: 'candidates', jobs: 'jobs' },
        },
        common: common
          ? {
              engine: 'MongoDB',
              database: commonDbName(),
              collection: 'candidatecommon',
            }
          : null,
        phase2: {
          engine: 'MongoDB',
          tenantDatabases: tenantDbNames,
        },
      },
    };
  },
};
