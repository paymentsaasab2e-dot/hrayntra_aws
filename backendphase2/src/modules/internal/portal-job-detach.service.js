import { prisma, getJobPortalPrismaClient } from '../../config/prisma.js';

function isTerminalCandidateStage(stage) {
  const normalized = String(stage || '').trim().toLowerCase();
  if (!normalized) return false;
  return (
    normalized.includes('hire') ||
    normalized === 'placed' ||
    normalized === 'joined' ||
    normalized === 'onboarded' ||
    normalized.includes('reject')
  );
}

async function getTenantJobIdSet() {
  const jobs = await prisma.job.findMany({
    where: { isDeleted: { not: true } },
    select: { id: true },
  });
  return new Set(jobs.map((job) => String(job.id)));
}

async function candidateStillHasTenantJobLinks(candidateId, assignedJobs) {
  const tenantJobIdSet = await getTenantJobIdSet();
  const scopedAssigned = (assignedJobs || []).filter((id) => tenantJobIdSet.has(String(id)));
  if (scopedAssigned.length > 0) return true;

  const [matchCount, appCount, pipeCount] = await Promise.all([
    prisma.match.count({ where: { candidateId } }),
    prisma.application.count({ where: { candidateId } }),
    prisma.pipelineEntry.count({ where: { candidateId } }),
  ]);
  return matchCount > 0 || appCount > 0 || pipeCount > 0;
}

/**
 * Remove all CRM (+ optional portal) links for one candidate↔job pair
 * (apply, match, pipeline, assignment). Resets stage to New when no job links remain.
 */
export async function detachCandidateFromJobLink(candidateId, jobId, options = {}) {
  const { skipPortalCleanup = false } = options;
  const normalizedJobId = String(jobId || '').trim();
  if (!normalizedJobId) return;

  const candidate = await prisma.candidate.findUnique({
    where: { id: candidateId },
    select: { id: true, assignedJobs: true, stage: true },
  });
  if (!candidate) return;

  const updatedAssignedJobs = (candidate.assignedJobs || []).filter(
    (id) => String(id) !== normalizedJobId,
  );

  await prisma.match.deleteMany({ where: { candidateId, jobId: normalizedJobId } });

  const tenantApps = await prisma.application.findMany({
    where: { candidateId, jobId: normalizedJobId },
    select: { id: true },
  });
  if (tenantApps.length) {
    await prisma.applicationTimeline.deleteMany({
      where: { applicationId: { in: tenantApps.map((row) => row.id) } },
    });
    await prisma.application.deleteMany({ where: { candidateId, jobId: normalizedJobId } });
  }

  await prisma.pipelineEntry.deleteMany({ where: { candidateId, jobId: normalizedJobId } });

  if (!skipPortalCleanup) {
    try {
      const portal = getJobPortalPrismaClient();
      await portal.match.deleteMany({ where: { candidateId, jobId: normalizedJobId } });
      await portal.pipelineEntry.deleteMany({ where: { candidateId, jobId: normalizedJobId } });

      const portalApp = await portal.application.findUnique({
        where: { candidateId_jobId: { candidateId, jobId: normalizedJobId } },
        select: { id: true },
      });
      if (portalApp) {
        await portal.applicationTimeline.deleteMany({ where: { applicationId: portalApp.id } });
        await portal.application.delete({ where: { id: portalApp.id } });
      }

      const portalCand = await portal.candidate.findUnique({
        where: { id: candidateId },
        select: { assignedJobs: true },
      });
      if (portalCand) {
        const portalAssigned = (portalCand.assignedJobs || []).filter(
          (id) => String(id) !== normalizedJobId,
        );
        await portal.candidate.update({
          where: { id: candidateId },
          data: { assignedJobs: portalAssigned, lastActivity: new Date() },
        });
      }
    } catch (portalErr) {
      console.warn(
        '[detachCandidateFromJobLink] portal cleanup failed:',
        portalErr?.message || portalErr,
      );
    }
  }

  const stillLinked = await candidateStillHasTenantJobLinks(candidateId, updatedAssignedJobs);

  const tenantUpdate = {
    assignedJobs: updatedAssignedJobs,
    lastActivity: new Date(),
  };
  if (!stillLinked && !isTerminalCandidateStage(candidate.stage)) {
    tenantUpdate.stage = 'New';
    tenantUpdate.status = 'NEW';
  }

  await prisma.candidate.update({
    where: { id: candidateId },
    data: tenantUpdate,
  });

  if (!skipPortalCleanup && !stillLinked && !isTerminalCandidateStage(candidate.stage)) {
    try {
      const portal = getJobPortalPrismaClient();
      await portal.candidate.update({
        where: { id: candidateId },
        data: { stage: 'New', lastActivity: new Date() },
      });
    } catch (portalStageErr) {
      console.warn(
        '[detachCandidateFromJobLink] portal stage reset failed:',
        portalStageErr?.message || portalStageErr,
      );
    }
  }
}
