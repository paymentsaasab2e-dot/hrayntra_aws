import { prisma, runWithTenantContext } from '../../config/prisma.js';
import { PIPELINE_STAGES, updateCandidateStage } from '../stage/candidateStage.service.js';

/**
 * When a candidate applies on the job portal, mirror the application into the tenant DB
 * (merge `assignedJobs`, match, pipeline) and run the stage engine (portal application row + timeline).
 */
export async function applyPortalApplicationSync({
  tenantDbName,
  candidateId,
  jobId,
  assignedJobsSnapshot = [],
  performedById,
}) {
  const tdb = String(tenantDbName || '').trim();
  if (!tdb) {
    throw new Error('tenantDbName is required');
  }
  const candId = String(candidateId || '').trim();
  const jId = String(jobId || '').trim();
  if (!candId || !jId) {
    throw new Error('candidateId and jobId are required');
  }

  return runWithTenantContext(tdb, async () => {
    const existing = await prisma.candidate.findUnique({
      where: { id: candId },
      select: { id: true, assignedJobs: true },
    });
    if (!existing) {
      throw new Error('Candidate not found in tenant database');
    }

    const union = new Set(
      [...(Array.isArray(existing.assignedJobs) ? existing.assignedJobs : []), ...(Array.isArray(assignedJobsSnapshot) ? assignedJobsSnapshot : []), jId]
        .filter(Boolean)
        .map(String)
    );

    await prisma.candidate.update({
      where: { id: candId },
      data: {
        assignedJobs: Array.from(union),
        stage: 'Applied',
        lastActivity: new Date(),
        status: 'ACTIVE',
      },
    });

    const job = await prisma.job.findUnique({
      where: { id: jId },
      select: { id: true, createdById: true, assignedToId: true },
    });
    if (!job) {
      throw new Error('Job not found');
    }

    const existingMatch = await prisma.match.findFirst({
      where: { candidateId: candId, jobId: jId },
      select: { id: true },
    });
    if (!existingMatch) {
      await prisma.match.create({
        data: {
          candidateId: candId,
          jobId: jId,
          score: 75,
          status: 'REVIEWED',
          notes: 'Applied from candidate portal',
          createdById: performedById || job.createdById || job.assignedToId || undefined,
        },
      });
    }

    const firstStage = await prisma.pipelineStage.findFirst({
      where: { jobId: jId },
      orderBy: { order: 'asc' },
      select: { id: true },
    });
    if (firstStage) {
      const pe = await prisma.pipelineEntry.findFirst({
        where: { candidateId: candId, jobId: jId },
        select: { id: true },
      });
      if (!pe) {
        await prisma.pipelineEntry.create({
          data: {
            candidateId: candId,
            jobId: jId,
            stageId: firstStage.id,
            movedById: performedById || job.createdById || job.assignedToId || undefined,
            notes: 'Applied from candidate portal',
          },
        });
      }
    }

    await updateCandidateStage({
      candidateId: candId,
      jobId: jId,
      stage: PIPELINE_STAGES.APPLIED,
      performedById: performedById || undefined,
      skipStageActivity: true,
    });
  });
}
