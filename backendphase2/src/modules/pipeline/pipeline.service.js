import { prisma, getActiveTenantDbName, getDefaultPrismaClient } from '../../config/prisma.js';
import {
  mapStageNameToPipelineBucket,
  updateCandidateStage,
} from '../stage/candidateStage.service.js';

const PIPELINE_ACTIVITY_KIND = 'candidate-pipeline';
const CANDIDATE_ACTIVITY_ENTITY = 'CANDIDATE';

function mapStageToMatchStatus(stage) {
  const normalizedStage = String(stage || '').toLowerCase();

  if (normalizedStage.includes('appl')) return 'REVIEWED';
  if (normalizedStage.includes('review')) return 'REVIEWED';
  if (
    (normalizedStage.includes('submit') && normalizedStage.includes('client')) ||
    normalizedStage.includes('submitted_to_client')
  ) {
    return 'SHORTLISTED';
  }
  if (normalizedStage.includes('shortlist')) return 'SHORTLISTED';
  if (normalizedStage.includes('interview')) return 'SHORTLISTED';
  if (normalizedStage.includes('offer')) return 'SHORTLISTED';
  if (normalizedStage.includes('place')) return 'SHORTLISTED';
  if (normalizedStage.includes('join')) return 'SHORTLISTED';
  if (normalizedStage.includes('hire')) return 'SHORTLISTED';
  if (normalizedStage.includes('reject')) return 'REJECTED';

  return 'REVIEWED';
}

export const pipelineService = {
  async getStagesByJob(jobId) {
    return prisma.pipelineStage.findMany({
      where: { jobId },
      include: {
        entries: {
          select: {
            id: true,
            candidateId: true,
            stageId: true,
            jobId: true,
            movedAt: true,
            movedById: true,
            notes: true,
            movedBy: {
              select: { id: true, name: true },
            },
          },
        },
      },
      orderBy: { order: 'asc' },
    });
  },

  async moveCandidate(candidateId, jobId, stageId, movedById, notes) {
    const isTenantScoped = Boolean(getActiveTenantDbName());
    const portalPrisma = getDefaultPrismaClient();

    let candidateClient = prisma;
    let candidate = await prisma.candidate.findUnique({
      where: { id: candidateId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        assignedJobs: true,
        assignedToId: true,
      },
    });

    if (!candidate && isTenantScoped) {
      candidate = await portalPrisma.candidate.findUnique({
        where: { id: candidateId },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          assignedJobs: true,
          assignedToId: true,
        },
      });
      if (candidate) {
        candidateClient = portalPrisma;
      }
    }

    if (!candidate) {
      throw new Error('Candidate not found');
    }

    const job = await prisma.job.findUnique({
      where: { id: jobId },
      select: { id: true, title: true },
    });

    if (!job) {
      throw new Error('Job not found');
    }

    const stage = await prisma.pipelineStage.findFirst({
      where: { id: stageId, jobId },
      select: { id: true, name: true, order: true, color: true },
    });

    if (!stage) {
      throw new Error('Pipeline stage not found');
    }

    const pipelineNotes = String(notes || '').trim() || null;

    const result = await prisma.$transaction(async (tx) => {
      await tx.pipelineEntry.deleteMany({
        where: {
          candidateId,
          jobId,
        },
      });

      const entry = await tx.pipelineEntry.create({
        data: {
          candidateId,
          jobId,
          stageId: stage.id,
          movedById,
          notes: pipelineNotes,
        },
        include: {
          stage: true,
        },
      });

      const existingMatch = await tx.match.findFirst({
        where: { candidateId, jobId },
        select: { id: true, notes: true },
      });

      if (existingMatch) {
        await tx.match.update({
          where: { id: existingMatch.id },
          data: {
            status: mapStageToMatchStatus(stage.name),
            notes: pipelineNotes || existingMatch.notes || null,
          },
        });
      } else {
        await tx.match.create({
          data: {
            candidateId,
            jobId,
            createdById: movedById,
            score: 75,
            status: mapStageToMatchStatus(stage.name),
            notes: pipelineNotes,
          },
        });
      }

      await tx.activity.create({
        data: {
          action: 'Candidate moved in pipeline',
          description: `${candidate.firstName || ''} ${candidate.lastName || ''}`.trim()
            ? `${candidate.firstName} ${candidate.lastName} moved to ${stage.name} stage for ${job.title}.`
            : `Candidate moved to ${stage.name} stage for ${job.title}.`,
          performedById: movedById,
          entityType: CANDIDATE_ACTIVITY_ENTITY,
          entityId: candidateId,
          category: 'Candidates',
          relatedType: 'job',
          relatedId: job.id,
          relatedLabel: job.title,
          metadata: {
            kind: PIPELINE_ACTIVITY_KIND,
            jobId: job.id,
            relatedJobTitle: job.title,
            stage: stage.name,
            notes: pipelineNotes,
          },
        },
      });

      return entry;
    });

    const updatedAssignedJobs = Array.from(new Set([...(candidate.assignedJobs || []), jobId]));

    await candidateClient.candidate.update({
      where: { id: candidateId },
      data: {
        stage: stage.name,
        assignedJobs: updatedAssignedJobs,
        lastActivity: new Date(),
        status: 'ACTIVE',
        assignedToId: candidate.assignedToId || undefined,
      },
    });

    // Canonicalize the stage chip and mirror to the job portal.
    // Custom pipeline names ("Tech Round 1", "Offer Sent", etc.) get bucketed into the
    // standard PIPELINE_STAGES so every list view shows a consistent tag.
    if (candidateClient === prisma) {
      try {
        await updateCandidateStage({
          candidateId,
          jobId,
          stage: mapStageNameToPipelineBucket(stage.name),
          performedById: movedById,
          skipStageActivity: true,
          metadata: {
            customStageName: stage.name,
            pipelineNotes: pipelineNotes || null,
          },
        });
      } catch (stageError) {
        console.warn(
          '[pipeline.moveCandidate] candidate stage sync failed:',
          stageError?.message || stageError,
        );
      }
    }

    // If candidate lives in portal/default DB (Phase 1), mirror pipeline + match there
    // so candidate-portal applications page reflects latest stage updates from Phase 2.
    const shouldSyncPortalPipeline = isTenantScoped && candidateClient === portalPrisma;
    if (shouldSyncPortalPipeline) {
      const portalJob = await portalPrisma.job.findUnique({
        where: { id: jobId },
        select: { id: true },
      });

      if (portalJob) {
        await portalPrisma.$transaction(async (portalTx) => {
          const portalStages = await portalTx.pipelineStage.findMany({
            where: { jobId },
            select: { id: true, name: true, order: true },
            orderBy: { order: 'asc' },
          });

          let portalStage =
            portalStages.find((s) => s.id === stage.id) ||
            portalStages.find((s) => String(s.name || '').trim().toLowerCase() === String(stage.name || '').trim().toLowerCase());

          if (!portalStage) {
            const maxOrder = portalStages.reduce((max, s) => Math.max(max, Number(s.order || 0)), 0);
            portalStage = await portalTx.pipelineStage.create({
              data: {
                jobId,
                name: stage.name,
                order: Number(stage.order || maxOrder + 1),
                color: stage.color || undefined,
              },
              select: { id: true, name: true, order: true },
            });
          }

          await portalTx.pipelineEntry.deleteMany({
            where: {
              candidateId,
              jobId,
            },
          });

          await portalTx.pipelineEntry.create({
            data: {
              candidateId,
              jobId,
              stageId: portalStage.id,
              movedById,
              notes: pipelineNotes,
            },
          });

          const existingPortalMatch = await portalTx.match.findFirst({
            where: { candidateId, jobId },
            select: { id: true, notes: true },
          });

          if (existingPortalMatch) {
            await portalTx.match.update({
              where: { id: existingPortalMatch.id },
              data: {
                status: mapStageToMatchStatus(stage.name),
                notes: pipelineNotes || existingPortalMatch.notes || null,
              },
            });
          } else {
            await portalTx.match.create({
              data: {
                candidateId,
                jobId,
                createdById: movedById || undefined,
                score: 75,
                status: mapStageToMatchStatus(stage.name),
                notes: pipelineNotes,
              },
            });
          }
        });
      }
    }

    return result;
  },

  async createStage(jobId, data) {
    const maxOrder = await prisma.pipelineStage.findFirst({
      where: { jobId },
      orderBy: { order: 'desc' },
      select: { order: true },
    });

    return prisma.pipelineStage.create({
      data: {
        name: data.name,
        order: maxOrder ? maxOrder.order + 1 : 1,
        color: data.color,
        jobId,
      },
    });
  },

  async updateStage(id, data) {
    const existingStage = await prisma.pipelineStage.findUnique({
      where: { id },
      select: { id: true, jobId: true, name: true },
    });

    if (!existingStage) {
      throw new Error('Stage not found');
    }

    const updatedStage = await prisma.pipelineStage.update({
      where: { id },
      data: {
        name: data.name,
        order: data.order,
        color: data.color,
      },
    });

    const nextStageName = String(data?.name || '').trim();
    if (nextStageName && nextStageName !== existingStage.name) {
      const entryCandidateIds = (
        await prisma.pipelineEntry.findMany({
          where: { stageId: id, jobId: existingStage.jobId },
          select: { candidateId: true },
        })
      ).map((entry) => entry.candidateId);

      if (entryCandidateIds.length) {
        await prisma.candidate.updateMany({
          where: { id: { in: entryCandidateIds } },
          data: {
            stage: nextStageName,
            lastActivity: new Date(),
          },
        });

        await prisma.match.updateMany({
          where: { jobId: existingStage.jobId, candidateId: { in: entryCandidateIds } },
          data: { status: mapStageToMatchStatus(nextStageName) },
        });
      }
    }

    return updatedStage;
  },

  async deleteStage(id) {
    await prisma.pipelineStage.delete({ where: { id } });
    return { message: 'Stage deleted successfully' };
  },
};
