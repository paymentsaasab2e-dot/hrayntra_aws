import { prisma } from '../../config/prisma.js';

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

  async moveCandidate(candidateId, jobId, stageId, movedById) {
    // Remove from old stage
    await prisma.pipelineEntry.deleteMany({
      where: {
        candidateId,
        jobId,
      },
    });

    // Add to new stage
    return prisma.pipelineEntry.create({
      data: {
        candidateId,
        jobId,
        stageId,
        movedById,
      },
      include: {
        candidate: true,
        stage: true,
      },
    });
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
    return prisma.pipelineStage.update({
      where: { id },
      data: {
        name: data.name,
        order: data.order,
        color: data.color,
      },
    });
  },

  async deleteStage(id) {
    await prisma.pipelineStage.delete({ where: { id } });
    return { message: 'Stage deleted successfully' };
  },
};
