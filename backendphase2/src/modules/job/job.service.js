import { prisma } from '../../config/prisma.js';
import { getPaginationParams, formatPaginationResponse } from '../../utils/pagination.js';
import { dbLogger } from '../../utils/db-logger.js';
import activityService from '../../services/activityService.js';
import { sendJobAssignmentEmail } from '../../services/emailService.js';

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

export const jobService = {
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
    }
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
      clientId: data.clientId,
      assignedToId: data.assignedToId,
      createdById: createdByUserId || undefined,
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
      include: {
        client: {
          select: { id: true, companyName: true },
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
            select: { id: true, companyName: true },
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

      return updatedJob;
    }

    const updated = await prisma.$transaction(async (tx) => {
      const savedJob = await tx.job.update({
        where: { id },
        data: updateData,
        include: {
          client: {
            select: { id: true, companyName: true },
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
    const scope =
      mineFilter && req?.user?.id
        ? { createdById: req.user.id }
        : {};

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

    // No Candidates - jobs with no matches
    const jobsWithNoCandidates = await prisma.job.findMany({
      where: {
        ...scope,
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
      noCandidates: noCandidatesCount,
      nearSla: nearSlaCount,
      closedThisMonth,
    };
  },
};
