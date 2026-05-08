import {
  prisma,
  getActiveTenantDbName,
  getDefaultPrismaClient,
  getJobPortalPrismaClient,
} from '../../config/prisma.js';
import { getPaginationParams, formatPaginationResponse } from '../../utils/pagination.js';
import { dbLogger } from '../../utils/db-logger.js';
import activityService from '../../services/activityService.js';
import { sendJobAssignmentEmail } from '../../services/emailService.js';
import { buildSuperAdminOwnerScope, mergeWhereWithScope } from '../../utils/superAdminScope.js';
import { canViewAllAssignments } from '../../utils/permissionScope.js';

// Helper function to get color for pipeline stage
function getStageColor(stageName) {
  const colorMap = {
    'Applied': '#3b82f6',
    'Screening': '#8b5cf6',
    'Screened': '#8b5cf6',
    'Technical Interview': '#f59e0b',
    'Interview': '#f59e0b',
    'HR Interview': '#10b981',
    'Offer': '#10b981',
    'Hired': '#059669',
    'Joined': '#059669',
  };
  return colorMap[stageName] || '#6b7280';
}

function mapStageToMatchStatus(stage) {
  const normalizedStage = String(stage || '').toLowerCase();

  if (normalizedStage.includes('shortlist')) return 'SHORTLISTED';
  if (normalizedStage.includes('reject')) return 'REJECTED';

  return 'REVIEWED';
}

function normalizeSalaryData(salary) {
  if (!salary || typeof salary !== 'object') return salary;

  const normalized = {
    ...salary,
  };

  if (normalized.amount !== undefined && normalized.amount !== null) {
    normalized.amount = String(normalized.amount).trim();
  }

  if (!normalized.amount && normalized.type && !normalized.min && !normalized.max) {
    normalized.amount = String(normalized.type).trim();
  }

  return normalized;
}

/**
 * Resolved client row (logo included) — portal listings use client.logo when no job-specific image URL exists.
 */
async function loadClientMirrorForPortalSync(job) {
  const clientId = job?.clientId;
  if (!clientId) return null;
  return prisma.client.findUnique({
    where: { id: clientId },
    select: { id: true, companyName: true, industry: true, logo: true, location: true },
  });
}

async function syncJobToJobPortalDb(job, payload = {}) {
  const tenantDbName = getActiveTenantDbName();
  if (!tenantDbName) return;

  // Mirror into the shared job-portal DB (JOB_PORTAL_DATABASE_URL), not tenant/default DATABASE_URL.
  // backend1 `/api/jobs` reads this DB — screening questions must land here or Apply shows no modal.
  const portalPrisma = getJobPortalPrismaClient();

  // Mirror tenant client into the portal DB — company name, industry, location, **and logo**
  // — so Explore Jobs shows the same image as Clients / converted Leads.
  const mirrorClient = await loadClientMirrorForPortalSync(job);
  if (mirrorClient?.id && mirrorClient.companyName) {
    try {
      await portalPrisma.client.upsert({
        where: { id: mirrorClient.id },
        create: {
          id: mirrorClient.id,
          companyName: mirrorClient.companyName,
          industry: mirrorClient.industry || null,
          logo: mirrorClient.logo || null,
          location: mirrorClient.location || job.location || null,
          status: 'ACTIVE',
        },
        update: {
          companyName: mirrorClient.companyName,
          industry: mirrorClient.industry || null,
          logo: mirrorClient.logo ?? null,
          location: mirrorClient.location || job.location || null,
        },
      });
    } catch (clientSyncError) {
      console.error(
        `Job portal sync: failed to mirror client ${mirrorClient.id}, proceeding with job sync.`,
        clientSyncError?.message || clientSyncError
      );
    }
  }

  const jobPortalData = {
    title: job.title,
    location: job.location || null,
    description: job.description || null,
    overview: job.overview || null,
    requirements: Array.isArray(job.requirements) ? job.requirements : [],
    skills: Array.isArray(job.skills) ? job.skills : [],
    preferredSkills: Array.isArray(job.preferredSkills) ? job.preferredSkills : [],
    keyResponsibilities: Array.isArray(job.keyResponsibilities) ? job.keyResponsibilities : [],
    type: job.type ? String(job.type) : 'FULL_TIME',
    status: ['CLOSED', 'FILLED'].includes(String(job.status || '').toUpperCase()) ? 'CLOSED' : 'OPEN',
    // Origin tenant — backend1 reads this on every apply to route the new
    // Application / Match / pipeline write into the correct tenant DB.
    // Carrying it on every Job means the system supports as many agencies /
    // tenants as needed without any per-deployment env config.
    tenantDbName,
    clientId: job.clientId || null,
    assignedToId: job.assignedToId || null,
    createdById: job.createdById || null,
    openings: job.openings || 1,
    salary: job.salary || null,
    experienceRequired: job.experienceRequired || null,
    education: job.education || null,
    benefits: Array.isArray(job.benefits) ? job.benefits : [],
    postedDate: job.postedDate || new Date(),
    hiringManager: job.hiringManager || null,
    hiringManagerId: job.hiringManagerId || null,
    priority: job.priority || null,
    department: job.department || null,
    jobCategory: job.jobCategory || null,
    jobLocationType: job.jobLocationType || null,
    workMode: job.workMode || null,
    expectedClosureDate: job.expectedClosureDate || null,
    jdFileName: job.jdFileName || null,
    hot: Boolean(job.hot),
    aiMatch: Boolean(job.aiMatch),
    noCandidates: Boolean(job.noCandidates),
    slaRisk: Boolean(job.slaRisk),
    visibility: job.visibility || null,
    distributionPlatforms: job.distributionPlatforms || null,
    supportingRecruiters: Array.isArray(job.supportingRecruiters) ? job.supportingRecruiters : [],
    applicationFormEnabled: Boolean(job.applicationFormEnabled),
    applicationFormLogo: job.applicationFormLogo || null,
    applicationFormQuestions: Array.isArray(job.applicationFormQuestions) ? job.applicationFormQuestions : [],
    applicationFormNote: job.applicationFormNote || null,
  };

  await portalPrisma.job.upsert({
    where: { id: job.id },
    create: {
      id: job.id,
      ...jobPortalData,
    },
    update: jobPortalData,
  });

  // Mirror this job's pipeline stages into the portal DB so the
  // candidate-portal application-detail view can resolve the per-job
  // stage flow ("Applied → Screening → Interview → Offer …") AND so
  // backend1's `syncApplicationToRecruiterView` can create a per-job
  // PipelineEntry on every apply. Without this, freshly-created portal
  // jobs have no pipeline_stages rows, the apply-time pipeline-entry
  // create bails on "no first stage", and the application detail page
  // is forced to fall back on the global `candidate.stage` (which then
  // bleeds previous-job rejections into brand-new applications).
  try {
    const tenantStages = await prisma.pipelineStage.findMany({
      where: { jobId: job.id },
      orderBy: { order: 'asc' },
      select: { id: true, name: true, order: true, color: true },
    });
    if (tenantStages.length) {
      // Replace-and-rewrite is safer than per-row diff: stage IDs are
      // referenced by `pipeline_entries`, so we delete in two steps to
      // keep referential integrity in the portal DB.
      await portalPrisma.pipelineEntry.deleteMany({
        where: { jobId: job.id, NOT: { stageId: { in: tenantStages.map((s) => s.id) } } },
      });
      for (const stage of tenantStages) {
        await portalPrisma.pipelineStage.upsert({
          where: { id: stage.id },
          create: {
            id: stage.id,
            jobId: job.id,
            name: stage.name,
            order: stage.order,
            color: stage.color || null,
          },
          update: {
            name: stage.name,
            order: stage.order,
            color: stage.color || null,
          },
        });
      }
      // Drop any portal pipeline_stages for this job that no longer exist
      // on the tenant side (e.g. recruiter customised the pipeline and
      // removed a stage).
      await portalPrisma.pipelineStage.deleteMany({
        where: {
          jobId: job.id,
          NOT: { id: { in: tenantStages.map((s) => s.id) } },
        },
      });
    }
  } catch (pipelineMirrorError) {
    console.warn(
      `[syncJobToJobPortalDb] pipeline-stages mirror failed for job ${job.id} (non-fatal):`,
      pipelineMirrorError?.message || pipelineMirrorError
    );
  }
}

/**
 * Remove portal / Phase 1 job mirror so backend1 & public listings stay in sync with tenant deletes.
 * Jobs are upserted to `getDefaultPrismaClient()` (DATABASE_URL); applications may live on
 * JOB_PORTAL_DATABASE_URL when it differs from DATABASE_URL.
 */
async function deleteAppsForJob(client, jobId) {
  const applications = await client.application.findMany({
    where: { jobId },
    select: { id: true },
  });
  const applicationIds = applications.map((a) => a.id);
  if (applicationIds.length) {
    await client.applicationTimeline.deleteMany({
      where: { applicationId: { in: applicationIds } },
    });
  }
  await client.application.deleteMany({ where: { jobId } });
}

async function safeDeleteJobRow(client, jobId) {
  try {
    await client.job.delete({ where: { id: jobId } });
  } catch (e) {
    const code = e?.code;
    const msg = String(e?.message || '');
    if (
      code === 'P2025' ||
      msg.includes('Record to delete does not exist') ||
      msg.includes('No record was found')
    ) {
      return;
    }
    throw e;
  }
}

async function deleteMirroredJobForPhase1(jobId) {
  if (!getActiveTenantDbName()) return;

  const defaultDb = getDefaultPrismaClient();
  const portalDb = getJobPortalPrismaClient();

  if (defaultDb === portalDb) {
    await defaultDb.$transaction(async (tx) => {
      await deleteAppsForJob(tx, jobId);
      await safeDeleteJobRow(tx, jobId);
    });
    return;
  }

  await portalDb.$transaction(async (tx) => {
    await deleteAppsForJob(tx, jobId);
    await safeDeleteJobRow(tx, jobId);
  });

  await defaultDb.$transaction(async (tx) => {
    await deleteAppsForJob(tx, jobId);
    await safeDeleteJobRow(tx, jobId);
  });
}

function isTenantScopedRequest() {
  return Boolean(getActiveTenantDbName());
}

async function getPortalMatchCountMap(jobIds = []) {
  if (!isTenantScopedRequest() || !Array.isArray(jobIds) || !jobIds.length) {
    return new Map();
  }

  const portalPrisma = getDefaultPrismaClient();
  const rows = await portalPrisma.match.findMany({
    where: { jobId: { in: jobIds } },
    select: { jobId: true },
  });

  const counts = new Map();
  for (const row of rows) {
    if (!row?.jobId) continue;
    counts.set(row.jobId, (counts.get(row.jobId) || 0) + 1);
  }
  return counts;
}

function mergeJobMatches(tenantMatches = [], portalMatches = []) {
  const mergedByKey = new Map();
  for (const match of portalMatches) {
    const key = match?.candidateId || `match:${match?.id || Math.random()}`;
    mergedByKey.set(key, match);
  }
  for (const match of tenantMatches) {
    const key = match?.candidateId || `match:${match?.id || Math.random()}`;
    mergedByKey.set(key, match);
  }
  return Array.from(mergedByKey.values());
}

function mergeJobApplications(tenantApplications = [], portalApplications = []) {
  const mergedByKey = new Map();
  for (const app of portalApplications) {
    const key = app?.id || `${app?.candidateId || 'candidate'}:${app?.jobId || 'job'}`;
    mergedByKey.set(key, app);
  }
  for (const app of tenantApplications) {
    const key = app?.id || `${app?.candidateId || 'candidate'}:${app?.jobId || 'job'}`;
    mergedByKey.set(key, app);
  }
  return Array.from(mergedByKey.values()).sort((a, b) => {
    const aTs = a?.appliedAt ? new Date(a.appliedAt).getTime() : 0;
    const bTs = b?.appliedAt ? new Date(b.appliedAt).getTime() : 0;
    return bTs - aTs;
  });
}

export const jobService = {
  async getPublicFeed(req) {
    const rawLimit = Number.parseInt(String(req.query?.limit || '200'), 10);
    const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 500) : 200;

    const jobs = await prisma.job.findMany({
      where: {
        status: 'OPEN',
      },
      take: limit,
      include: {
        client: {
          select: {
            id: true,
            companyName: true,
            logo: true,
            industry: true,
            location: true,
          },
        },
      },
      orderBy: [
        { postedDate: 'desc' },
        { createdAt: 'desc' },
      ],
    });

    return jobs.map((job) => ({
      id: job.id,
      source: 'phase2',
      clientId: job.clientId || null,
      title: job.title,
      description: job.description || null,
      overview: job.overview || null,
      requirements: Array.isArray(job.requirements) ? job.requirements : [],
      skills: Array.isArray(job.skills) ? job.skills : [],
      preferredSkills: Array.isArray(job.preferredSkills) ? job.preferredSkills : [],
      keyResponsibilities: Array.isArray(job.keyResponsibilities) ? job.keyResponsibilities : [],
      location: job.location || null,
      type: job.type || null,
      status: job.status,
      openings: job.openings ?? 1,
      experienceRequired: job.experienceRequired || null,
      education: job.education || null,
      benefits: Array.isArray(job.benefits) ? job.benefits : [],
      postedDate: job.postedDate || job.createdAt || null,
      hiringManager: job.hiringManager || null,
      department: job.department || null,
      jobCategory: job.jobCategory || null,
      jobLocationType: job.jobLocationType || null,
      workMode: job.workMode || null,
      priority: job.priority || null,
      salary: job.salary || null,
      company: job.client
        ? {
            id: job.client.id,
            companyName: job.client.companyName,
            logo: job.client.logo || null,
            industry: job.client.industry || null,
            location: job.client.location || null,
          }
        : null,
    }));
  },

  async notifyAssignment(job, performedById) {
    if (!job?.assignedTo?.email) return;

    try {
      const assignedBy = performedById
        ? await prisma.user.findUnique({
            where: { id: performedById },
            select: { name: true },
          })
        : null;

      await sendJobAssignmentEmail({
        toEmail: job.assignedTo.email,
        assigneeName: job.assignedTo.name,
        jobTitle: job.title,
        clientCompanyName: job.client?.companyName || null,
        jobLocation: job.location,
        jobType: job.type,
        jobStatus: job.status,
        openings: job.openings,
        assignedByName: assignedBy?.name || null,
        senderUserId: performedById,
      });
    } catch (emailError) {
      console.error('Failed to send job assignment email:', emailError);
    }
  },

  async getAll(req) {
    const { page, limit, skip } = getPaginationParams(req);
    const { status, clientId, assignedToId, search, mine } = req.query;

    const where = {};
    if (status) where.status = status;

    // Some legacy rows may exist with `clientId: null`.
    // `Job.clientId` is optional in Prisma now, so we should avoid filtering logic.
    // Also sanitize query values like the string "null".
    const safeClientId = clientId && clientId !== 'null' ? clientId : undefined;
    const safeAssignedToId = assignedToId && assignedToId !== 'null' ? assignedToId : undefined;

    if (safeClientId) where.clientId = safeClientId;

    if (safeAssignedToId) where.assignedToId = safeAssignedToId;

    // Jobs page: only jobs created by the authenticated user (no seeded/dummy rows unless they match)
    const mineFilter = mine === 'true' || mine === '1';
    if (mineFilter && req.user?.id) {
      where.createdById = req.user.id;
    } else if (!canViewAllAssignments(req) && req.user?.id) {
      where.OR = [{ assignedToId: req.user.id }, { createdById: req.user.id }];
    }
    if (search) {
      where.title = { contains: search, mode: 'insensitive' };
    }
    const superAdminScope = buildSuperAdminOwnerScope(req, ['createdById', 'assignedToId']);
    const scopedWhere = mergeWhereWithScope(where, superAdminScope);

    const [jobs, total] = await Promise.all([
      prisma.job.findMany({
        where: scopedWhere,
        skip,
        take: limit,
        include: {
          client: {
            select: { id: true, companyName: true, logo: true },
          },
          assignedTo: {
            select: { id: true, name: true, email: true, avatar: true },
          },
          _count: {
            select: { matches: true, interviews: true, placements: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.job.count({ where: scopedWhere }),
    ]);

    if (isTenantScopedRequest() && jobs.length) {
      const matchCountMap = await getPortalMatchCountMap(jobs.map((job) => job.id));
      const mergedJobs = jobs.map((job) => {
        const portalMatchCount = matchCountMap.get(job.id) || 0;
        const tenantMatchCount = Number(job?._count?.matches || 0);
        const mergedMatchCount = tenantMatchCount + portalMatchCount;
        return {
          ...job,
          _count: {
            ...(job._count || {}),
            matches: mergedMatchCount,
          },
          noCandidates: mergedMatchCount === 0 ? job.noCandidates : false,
        };
      });
      return formatPaginationResponse(mergedJobs, page, limit, total);
    }

    return formatPaginationResponse(jobs, page, limit, total);
  },

  async getById(id, req = null) {
    let where = { id };
    const scope = buildSuperAdminOwnerScope(req, ['createdById', 'assignedToId']);
    where = mergeWhereWithScope(where, scope);
    if (!canViewAllAssignments(req) && req?.user?.id) {
      where = mergeWhereWithScope(where, { OR: [{ assignedToId: req.user.id }, { createdById: req.user.id }] });
    }

    const job = await prisma.job.findFirst({
      where,
      include: {
        client: true,
        assignedTo: {
          select: { id: true, name: true, email: true, avatar: true },
        },
        pipelineStages: {
          include: {
            entries: {
              include: {
                candidate: {
                  select: { id: true, firstName: true, lastName: true, email: true, avatar: true },
                },
              },
            },
          },
          orderBy: { order: 'asc' },
        },
        matches: {
          include: {
            candidate: true,
          },
        },
        applications: {
          include: {
            candidate: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
          orderBy: { appliedAt: 'desc' },
        },
        interviews: {
          include: {
            candidate: {
              select: { id: true, firstName: true, lastName: true, email: true },
            },
          },
        },
        notes: {
          include: {
            createdBy: {
              select: { id: true, name: true, email: true, avatar: true },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
        files: {
          include: {
            uploadedBy: {
              select: { id: true, name: true, email: true },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!job || !isTenantScopedRequest()) {
      return job;
    }

    const portalPrisma = getJobPortalPrismaClient();
    const portalJob = await portalPrisma.job.findUnique({
      where: { id },
      include: {
        matches: {
          include: {
            candidate: true,
          },
        },
        applications: {
          include: {
            candidate: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
          orderBy: { appliedAt: 'desc' },
        },
      },
    });

    if (!portalJob?.matches?.length && !portalJob?.applications?.length) {
      return job;
    }

    const mergedMatches = mergeJobMatches(job.matches || [], portalJob.matches || []);
    const mergedApplications = mergeJobApplications(job.applications || [], portalJob.applications || []);

    return {
      ...job,
      matches: mergedMatches,
      applications: mergedApplications,
      _count: {
        matches: mergedMatches.length,
        interviews: Array.isArray(job.interviews) ? job.interviews.length : 0,
        placements: Array.isArray(job.placements) ? job.placements.length : 0,
      },
    };
  },

  async create(data, createdByUserId) {
    // Utility function to remove undefined values
    const removeUndefined = (obj) => {
      return Object.fromEntries(
        Object.entries(obj).filter(([, value]) => value !== undefined)
      );
    };

    const jobData = removeUndefined({
      title: data.title,
      description: data.description,
      overview: data.overview,
      requirements: data.requirements || [],
      skills: data.skills || [],
      preferredSkills: data.preferredSkills || [],
      keyResponsibilities: data.keyResponsibilities || [],
      location: data.location,
      type: data.type || 'FULL_TIME',
      status: data.status || 'OPEN', // Default to OPEN when creating from client drawer
      openings: data.openings || 1,
      salary: normalizeSalaryData(data.salary),
      experienceRequired: data.experienceRequired,
      education: data.education,
      benefits: data.benefits || [],
      postedDate: data.postedDate ? new Date(data.postedDate) : null,
      hiringManager: data.hiringManager,
      hiringManagerId: data.hiringManagerId, // Support hiringManagerId from frontend
      department: data.department,
      jobCategory: data.jobCategory,
      jobLocationType: data.jobLocationType,
      workMode: data.workMode || data.jobLocationType,
      expectedClosureDate: data.expectedClosureDate ? new Date(data.expectedClosureDate) : null,
      jdFileName: data.jdFileName,
      hot: data.hot || false,
      aiMatch: data.aiMatch || false,
      noCandidates: data.noCandidates || false,
      slaRisk: data.slaRisk || false,
      applicationFormEnabled: data.applicationFormEnabled || false,
      applicationFormLogo: data.applicationFormLogo,
      applicationFormQuestions: data.applicationFormQuestions || [],
      applicationFormNote: data.applicationFormNote,
      distributionPlatforms: data.distributionPlatforms,
    });

    if (data.clientId) {
      jobData.client = { connect: { id: data.clientId } };
    }

    if (data.assignedToId) {
      jobData.assignedTo = { connect: { id: data.assignedToId } };
    }

    if (createdByUserId) {
      jobData.createdBy = { connect: { id: createdByUserId } };
    }

    // Log data being stored
    dbLogger.logCreate('JOB', jobData);

    const job = await prisma.job.create({
      data: jobData,
      include: {
        client: {
          select: { id: true, companyName: true, industry: true, logo: true },
        },
        assignedTo: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    // Create pipeline stages only when explicitly provided (no default pipeline)
    const pipelineStages = Array.isArray(data.pipelineStages) ? data.pipelineStages : [];
    if (pipelineStages.length > 0) {
      const stagesToCreate = pipelineStages.map((stage, index) => ({
        name: stage.name || stage,
        order: index + 1,
        color: getStageColor(stage.name || stage),
        jobId: job.id,
      }));

      await Promise.all(
        stagesToCreate.map((stage) =>
          prisma.pipelineStage.create({
            data: stage,
          })
        )
      );
    }

    // Log created job with ID
    console.log(`✅ Job created successfully with ID: ${job.id}\n`);

    if (createdByUserId) {
      await activityService.logJobCreated({
        entityId: job.id,
        performedById: createdByUserId,
        entityName: job.title,
        metadata: {
          status: job.status,
          clientId: job.clientId || null,
        },
        clientId: job.clientId || undefined,
      });
    }

    if (job.assignedToId) {
      await this.notifyAssignment(job, createdByUserId);
    }

    try {
      await syncJobToJobPortalDb(job, data);
    } catch (syncError) {
      console.error(`Failed to sync job ${job.id} to job portal DB:`, syncError?.message || syncError);
    }

    return job;
  },

  async update(id, data) {
    const currentJob = await prisma.job.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        description: true,
        overview: true,
        requirements: true,
        skills: true,
        preferredSkills: true,
        keyResponsibilities: true,
        location: true,
        type: true,
        status: true,
        clientId: true,
        assignedToId: true,
        openings: true,
        salary: true,
        experienceRequired: true,
        education: true,
        benefits: true,
        postedDate: true,
        hiringManager: true,
        hiringManagerId: true,
        department: true,
        jobCategory: true,
        jobLocationType: true,
        expectedClosureDate: true,
        jdFileName: true,
        hot: true,
        aiMatch: true,
        noCandidates: true,
        slaRisk: true,
        workMode: true,
        priority: true,
        visibility: true,
        distributionPlatforms: true,
        supportingRecruiters: true,
        applicationFormEnabled: true,
        applicationFormLogo: true,
        applicationFormQuestions: true,
        applicationFormNote: true,
      },
    });

    if (!currentJob) {
      throw new Error('Job not found');
    }

    // Utility function to remove undefined values
    const removeUndefined = (obj) => {
      return Object.fromEntries(
        Object.entries(obj).filter(([, value]) => value !== undefined)
      );
    };

    const updateData = removeUndefined({
      title: data.title,
      description: data.description,
      overview: data.overview,
      requirements: data.requirements,
      skills: data.skills,
      preferredSkills: data.preferredSkills,
      keyResponsibilities: data.keyResponsibilities,
      location: data.location,
      type: data.type,
      status: data.status,
      clientId: data.clientId,
      assignedToId: data.assignedToId,
      openings: data.openings,
      salary: normalizeSalaryData(data.salary),
      experienceRequired: data.experienceRequired,
      education: data.education,
      benefits: data.benefits,
      postedDate: data.postedDate ? new Date(data.postedDate) : undefined,
      hiringManager: data.hiringManager,
      hiringManagerId: data.hiringManagerId,
      department: data.department,
      jobCategory: data.jobCategory,
      jobLocationType: data.jobLocationType,
      expectedClosureDate: data.expectedClosureDate ? new Date(data.expectedClosureDate) : undefined,
      jdFileName: data.jdFileName,
      hot: data.hot,
      aiMatch: data.aiMatch,
      noCandidates: data.noCandidates,
      slaRisk: data.slaRisk,
      workMode: data.workMode,
      priority: data.priority,
      visibility: data.visibility,
      distributionPlatforms: data.distributionPlatforms,
      supportingRecruiters: data.supportingRecruiters,
      applicationFormEnabled: data.applicationFormEnabled,
      applicationFormLogo: data.applicationFormLogo,
      applicationFormQuestions: data.applicationFormQuestions,
      applicationFormNote: data.applicationFormNote,
    });

    // Log data being updated
    dbLogger.logUpdate('JOB', id, updateData);

    const hasFieldUpdates = Object.keys(updateData).length > 0;
    const hasPipelineStageUpdates = Array.isArray(data.pipelineStages);

    if (!hasFieldUpdates && !hasPipelineStageUpdates) {
      return currentJob;
    }

    if (!hasPipelineStageUpdates) {
      const updatedJob = await prisma.job.update({
        where: { id },
        data: updateData,
        include: {
          client: {
            select: { id: true, companyName: true, industry: true, logo: true },
          },
          assignedTo: {
            select: { id: true, name: true, email: true },
          },
        },
      });

      console.log(`âœ… Job updated successfully (ID: ${id})\n`);
      if (data.performedById && hasFieldUpdates) {
        await activityService.logJobFieldChanges({
          entityId: id,
          performedById: data.performedById,
          oldData: currentJob,
          newData: updateData,
          clientId: updatedJob.clientId || currentJob.clientId || undefined,
        });
      }

      if (
        data.assignedToId !== undefined &&
        data.assignedToId &&
        data.assignedToId !== currentJob.assignedToId
      ) {
        await this.notifyAssignment(updatedJob, data.performedById);
      }

      try {
        await syncJobToJobPortalDb(updatedJob, data);
      } catch (syncError) {
        console.error(`Failed to sync job ${id} to job portal DB:`, syncError?.message || syncError);
      }

      return updatedJob;
    }

    const updated = await prisma.$transaction(async (tx) => {
      const savedJob = await tx.job.update({
        where: { id },
        data: updateData,
        include: {
          client: {
            select: { id: true, companyName: true, industry: true, logo: true },
          },
          assignedTo: {
            select: { id: true, name: true, email: true },
          },
        },
      });

      if (hasPipelineStageUpdates) {
        const incoming = data.pipelineStages
          .map((stage, index) => ({
            id: stage?.id ? String(stage.id) : null,
            name: String(stage?.name || '').trim(),
            order: Number(stage?.order ?? index + 1),
          }))
          .filter((stage) => stage.name);

        if (incoming.length) {
          const existingStages = await tx.pipelineStage.findMany({
            where: { jobId: id },
            select: { id: true, name: true },
            orderBy: { order: 'asc' },
          });
          const existingIds = new Set(existingStages.map((s) => s.id));
          const existingStageNames = new Map(existingStages.map((stage) => [stage.id, stage.name]));

          // Upsert stages (update existing by id, create new otherwise)
          const keptIds = new Set();
          for (let idx = 0; idx < incoming.length; idx += 1) {
            const stage = incoming[idx];
            const order = idx + 1;
            const color = getStageColor(stage.name);
            if (stage.id && existingIds.has(stage.id)) {
              keptIds.add(stage.id);
              const previousName = existingStageNames.get(stage.id);
              await tx.pipelineStage.update({
                where: { id: stage.id },
                data: { name: stage.name, order, color },
              });
              if (previousName && previousName !== stage.name) {
                const candidateIdsInStage = (
                  await tx.pipelineEntry.findMany({
                    where: { jobId: id, stageId: stage.id },
                    select: { candidateId: true },
                  })
                ).map((entry) => entry.candidateId);

                if (candidateIdsInStage.length) {
                  await tx.candidate.updateMany({
                    where: { id: { in: candidateIdsInStage } },
                    data: {
                      stage: stage.name,
                      lastActivity: new Date(),
                    },
                  });

                  await tx.match.updateMany({
                    where: { jobId: id, candidateId: { in: candidateIdsInStage } },
                    data: {
                      status: mapStageToMatchStatus(stage.name),
                    },
                  });
                }
              }
            } else {
              const created = await tx.pipelineStage.create({
                data: { name: stage.name, order, color, jobId: id },
              });
              keptIds.add(created.id);
            }
          }

          // Re-home any entries from removed stages to the first kept stage
          const fallbackStageId = Array.from(keptIds.values())[0] || null;
          const toDelete = existingStages.map((s) => s.id).filter((stageId) => !keptIds.has(stageId));
          if (fallbackStageId && toDelete.length) {
            const fallbackStage = await tx.pipelineStage.findUnique({
              where: { id: fallbackStageId },
              select: { id: true, name: true },
            });

            await tx.pipelineEntry.updateMany({
              where: { jobId: id, stageId: { in: toDelete } },
              data: { stageId: fallbackStageId, movedAt: new Date() },
            });

            const movedCandidateIds = (
              await tx.pipelineEntry.findMany({
                where: { jobId: id, stageId: fallbackStageId },
                select: { candidateId: true },
              })
            ).map((entry) => entry.candidateId);

            if (fallbackStage?.name && movedCandidateIds.length) {
              await tx.candidate.updateMany({
                where: { id: { in: movedCandidateIds } },
                data: {
                  stage: fallbackStage.name,
                  lastActivity: new Date(),
                },
              });

              await tx.match.updateMany({
                where: { jobId: id, candidateId: { in: movedCandidateIds } },
                data: { status: mapStageToMatchStatus(fallbackStage.name) },
              });
            }
          }

          if (toDelete.length) {
            await tx.pipelineStage.deleteMany({
              where: { jobId: id, id: { in: toDelete } },
            });
          }
        } else {
          // Empty pipeline: remove all stages for this job
          await tx.pipelineStage.deleteMany({ where: { jobId: id } });
        }
      }

      return savedJob;
    }, {
      maxWait: 10000,
      timeout: 20000,
    });

    console.log(`✅ Job updated successfully (ID: ${id})\n`);

    if (data.performedById && hasFieldUpdates) {
      await activityService.logJobFieldChanges({
        entityId: id,
        performedById: data.performedById,
        oldData: currentJob,
        newData: updateData,
        clientId: updated.clientId || currentJob.clientId || undefined,
      });
    }

    if (
      data.assignedToId !== undefined &&
      data.assignedToId &&
      data.assignedToId !== currentJob.assignedToId
    ) {
      await this.notifyAssignment(updated, data.performedById);
    }

    try {
      await syncJobToJobPortalDb(updated, data);
    } catch (syncError) {
      console.error(`Failed to sync job ${id} to job portal DB:`, syncError?.message || syncError);
    }

    return updated;
  },

  async delete(id, performedById) {
    const currentJob = await prisma.job.findUnique({
      where: { id },
      select: { id: true, title: true, clientId: true },
    });

    if (!currentJob) {
      throw new Error('Job not found');
    }

    // Phase 1 / job-portal mirror (same job id) — remove first so public listings never outlive CRM delete
    try {
      await deleteMirroredJobForPhase1(id);
    } catch (syncErr) {
      console.error(`deleteMirroredJobForPhase1 failed for job ${id}:`, syncErr?.message || syncErr);
      throw new Error(
        syncErr?.message
          ? `Could not remove job from shared portal database: ${syncErr.message}`
          : 'Could not remove job from shared portal database'
      );
    }

    await prisma.job.delete({ where: { id } });

    if (performedById) {
      await activityService.logJobDeleted({
        entityId: id,
        performedById,
        entityName: currentJob.title,
        clientId: currentJob.clientId || undefined,
      });
    }

    return { message: 'Job deleted successfully' };
  },

  async getMetrics(req) {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - 7);
    startOfWeek.setHours(0, 0, 0, 0);

    const mineFilter = req?.query?.mine === 'true' || req?.query?.mine === '1';
    const superAdminScope = buildSuperAdminOwnerScope(req, ['createdById', 'assignedToId']);
    const scope = superAdminScope || (
      mineFilter && req?.user?.id
        ? { createdById: req.user.id }
        : !canViewAllAssignments(req) && req?.user?.id
          ? { OR: [{ createdById: req.user.id }, { assignedToId: req.user.id }] }
          : {}
    );

    // Active Jobs (status = OPEN)
    const activeJobs = await prisma.job.count({
      where: { ...scope, status: 'OPEN' },
    });

    // New Jobs (This Week) - jobs created in the last 7 days
    const newJobsThisWeek = await prisma.job.count({
      where: {
        ...scope,
        createdAt: { gte: startOfWeek },
      },
    });

    // Candidate metrics: derive from actual match rows (tenant + jobportal mirror when applicable)
    const jobsForCandidateMetrics = await prisma.job.findMany({
      where: {
        ...scope,
      },
      select: {
        id: true,
        _count: {
          select: { matches: true },
        },
      },
    });

    const portalMatchCountMap = await getPortalMatchCountMap(jobsForCandidateMetrics.map((job) => job.id));
    const mergedMatchCounts = jobsForCandidateMetrics.map((job) => {
      const tenantMatches = Number(job?._count?.matches || 0);
      const portalMatches = Number(portalMatchCountMap.get(job.id) || 0);
      return tenantMatches + portalMatches;
    });

    const appliedCandidates = mergedMatchCounts.reduce((sum, count) => sum + count, 0);
    const noCandidatesCount = mergedMatchCounts.filter((count) => count === 0).length;

    // Near SLA - jobs with slaRisk = true
    const nearSlaCount = await prisma.job.count({
      where: {
        ...scope,
        slaRisk: true,
        status: { in: ['OPEN', 'DRAFT'] },
      },
    });

    // Closed This Month - jobs closed this month
    const closedThisMonth = await prisma.job.count({
      where: {
        ...scope,
        status: { in: ['CLOSED', 'FILLED'] },
        updatedAt: { gte: startOfMonth },
      },
    });

    return {
      activeJobs,
      newJobsThisWeek,
      appliedCandidates,
      noCandidates: noCandidatesCount,
      nearSla: nearSlaCount,
      closedThisMonth,
    };
  },
};
