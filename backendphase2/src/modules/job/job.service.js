import { prisma } from '../../config/prisma.js';
import { getPaginationParams, formatPaginationResponse } from '../../utils/pagination.js';
import { dbLogger } from '../../utils/db-logger.js';
import { activityService } from '../activity/activity.service.js';

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

export const jobService = {
  async getAll(req) {
    const { page, limit, skip } = getPaginationParams(req);
    const { status, clientId, assignedToId, search } = req.query;

    const where = {};
    if (status) where.status = status;
    if (clientId) where.clientId = clientId;
    if (assignedToId) where.assignedToId = assignedToId;
    if (search) {
      where.title = { contains: search, mode: 'insensitive' };
    }

    const [jobs, total] = await Promise.all([
      prisma.job.findMany({
        where,
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
      prisma.job.count({ where }),
    ]);

    return formatPaginationResponse(jobs, page, limit, total);
  },

  async getById(id) {
    return prisma.job.findUnique({
      where: { id },
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
  },

  async create(data) {
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
      clientId: data.clientId,
      assignedToId: data.assignedToId,
      openings: data.openings || 1,
      salary: data.salary,
      experienceRequired: data.experienceRequired,
      education: data.education,
      benefits: data.benefits || [],
      postedDate: data.postedDate ? new Date(data.postedDate) : null,
      hiringManager: data.hiringManager,
      hiringManagerId: data.hiringManagerId, // Support hiringManagerId from frontend
      department: data.department,
      jobCategory: data.jobCategory,
      jobLocationType: data.jobLocationType,
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

    // Log data being stored
    dbLogger.logCreate('JOB', jobData);

    const job = await prisma.job.create({
      data: jobData,
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

    return job;
  },

  async update(id, data) {
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
      salary: data.salary,
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

    const updated = await prisma.$transaction(async (tx) => {
      const savedJob = await tx.job.update({
        where: { id },
        data: updateData,
      });

      if (Array.isArray(data.pipelineStages)) {
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
            select: { id: true },
            orderBy: { order: 'asc' },
          });
          const existingIds = new Set(existingStages.map((s) => s.id));

          // Upsert stages (update existing by id, create new otherwise)
          const keptIds = new Set();
          for (let idx = 0; idx < incoming.length; idx += 1) {
            const stage = incoming[idx];
            const order = idx + 1;
            const color = getStageColor(stage.name);
            if (stage.id && existingIds.has(stage.id)) {
              keptIds.add(stage.id);
              await tx.pipelineStage.update({
                where: { id: stage.id },
                data: { name: stage.name, order, color },
              });
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
            await tx.pipelineEntry.updateMany({
              where: { jobId: id, stageId: { in: toDelete } },
              data: { stageId: fallbackStageId, movedAt: new Date() },
            });
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
    });

    console.log(`✅ Job updated successfully (ID: ${id})\n`);

    return updated;
  },

  async delete(id) {
    await prisma.job.delete({ where: { id } });
    return { message: 'Job deleted successfully' };
  },

  async getMetrics() {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - 7);
    startOfWeek.setHours(0, 0, 0, 0);

    // Active Jobs (status = OPEN)
    const activeJobs = await prisma.job.count({
      where: { status: 'OPEN' },
    });

    // New Jobs (This Week) - jobs created in the last 7 days
    const newJobsThisWeek = await prisma.job.count({
      where: {
        createdAt: { gte: startOfWeek },
      },
    });

    // No Candidates - jobs with no matches
    const jobsWithNoCandidates = await prisma.job.findMany({
      where: {
        status: { in: ['OPEN', 'DRAFT'] },
      },
      include: {
        _count: {
          select: { matches: true },
        },
      },
    });
    const noCandidatesCount = jobsWithNoCandidates.filter(job => job._count.matches === 0).length;

    // Near SLA - jobs with slaRisk = true
    const nearSlaCount = await prisma.job.count({
      where: {
        slaRisk: true,
        status: { in: ['OPEN', 'DRAFT'] },
      },
    });

    // Closed This Month - jobs closed this month
    const closedThisMonth = await prisma.job.count({
      where: {
        status: { in: ['CLOSED', 'FILLED'] },
        updatedAt: { gte: startOfMonth },
      },
    });

    return {
      activeJobs,
      newJobsThisWeek,
      noCandidates: noCandidatesCount,
      nearSla: nearSlaCount,
      closedThisMonth,
    };
  },
};
