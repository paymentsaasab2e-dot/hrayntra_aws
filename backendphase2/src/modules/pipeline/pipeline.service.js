import { prisma } from '../../config/prisma.js';

const PIPELINE_ACTIVITY_KIND = 'candidate-pipeline';
const CANDIDATE_ACTIVITY_ENTITY = 'candidate';

function mapStageToMatchStatus(stage) {
  const normalizedStage = String(stage || '').toLowerCase();

  if (normalizedStage.includes('shortlist')) return 'SHORTLISTED';
  if (normalizedStage.includes('reject')) return 'REJECTED';

  return 'REVIEWED';
}

export const pipelineService = {
  async getStagesByJob(jobId) {
    return prisma.pipelineStage.findMany({
      where: { jobId },
      include: {
        entries: {
          include: {
            candidate: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                avatar: true,
                experience: true,
                location: true,
                skills: true,
              },
            },
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
    const candidate = await prisma.candidate.findUnique({
      where: { id: candidateId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        assignedJobs: true,
        assignedToId: true,
      },
    });

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
      select: { id: true, name: true },
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
          candidate: true,
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

      const updatedAssignedJobs = Array.from(new Set([...(candidate.assignedJobs || []), jobId]));

      await tx.candidate.update({
        where: { id: candidateId },
        data: {
          stage: stage.name,
          assignedJobs: updatedAssignedJobs,
          lastActivity: new Date(),
          status: 'ACTIVE',
          assignedToId: candidate.assignedToId || undefined,
        },
      });

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
