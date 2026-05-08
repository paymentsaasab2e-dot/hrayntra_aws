import { prisma, runWithTenantContext, getJobPortalPrismaClient } from '../../config/prisma.js';
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
    let existing = await prisma.candidate.findUnique({
      where: { id: candId },
      select: {
        id: true,
        assignedJobs: true,
        firstName: true,
        lastName: true,
        email: true,
        stage: true,
      },
    });

    // Self-heal: if the recruiter manually deleted this candidate from the CRM,
    // a brand-new portal apply would otherwise be lost. Recreate the tenant
    // candidate row from the portal candidate so the apply lands and the
    // candidate re-enters the lifecycle cleanly. Lifetime activity logs are
    // append-only on the same `candidateId`, so any prior Activity rows that
    // weren't cascade-deleted will still surface.
    if (!existing) {
      try {
        const portal = getJobPortalPrismaClient();
        const portalCand = await portal.candidate.findUnique({
          where: { id: candId },
          select: {
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            linkedIn: true,
            resumeUrl: true,
            location: true,
            city: true,
            country: true,
            currentTitle: true,
            currentCompany: true,
            avatar: true,
            designation: true,
          },
        });
        if (!portalCand) {
          throw new Error('Candidate not found in portal database either');
        }
        existing = await prisma.candidate.create({
          data: {
            id: candId,
            firstName: portalCand.firstName || null,
            lastName: portalCand.lastName || null,
            email: portalCand.email || null,
            phone: portalCand.phone || null,
            linkedIn: portalCand.linkedIn || null,
            resumeUrl: portalCand.resumeUrl || null,
            resume: portalCand.resumeUrl || null,
            location: portalCand.location || null,
            city: portalCand.city || null,
            country: portalCand.country || null,
            currentTitle: portalCand.currentTitle || null,
            currentCompany: portalCand.currentCompany || null,
            avatar: portalCand.avatar || null,
            designation: portalCand.designation || null,
            source: 'Job Portal',
            stage: 'Applied',
            status: 'ACTIVE',
            assignedJobs: [],
            lastActivity: new Date(),
          },
          select: {
            id: true,
            assignedJobs: true,
            firstName: true,
            lastName: true,
            email: true,
            stage: true,
          },
        });
        console.log(
          `[applyPortalApplicationSync] Recreated tenant candidate ${candId} from portal record (was previously deleted from CRM).`
        );
      } catch (recreateError) {
        console.error(
          '[applyPortalApplicationSync] Could not recreate deleted candidate:',
          recreateError?.message || recreateError
        );
        throw new Error('Candidate not found in tenant database');
      }
    }

    const union = new Set(
      [...(Array.isArray(existing.assignedJobs) ? existing.assignedJobs : []), ...(Array.isArray(assignedJobsSnapshot) ? assignedJobsSnapshot : []), jId]
        .filter(Boolean)
        .map(String)
    );

    // Stage-flip policy on a new portal apply:
    //  • Rejected → Applied  ✅ (re-activate the candidate; lifetime activity log
    //    stays intact because Activity rows are append-only on `entityId`).
    //  • Hired / Placed / Joined / Onboarded → keep terminal (positive outcomes
    //    must not silently regress just because the candidate browses a new
    //    posting; per-application status chips remain correct via Application).
    //  • Anything else → Applied.
    const previousStageLower = String(existing.stage || '').trim().toLowerCase();
    const previouslyRejected = previousStageLower.includes('reject');
    const stageIsPositiveTerminal =
      previousStageLower.includes('hire') ||
      previousStageLower === 'placed' ||
      previousStageLower === 'joined' ||
      previousStageLower === 'onboarded';

    await prisma.candidate.update({
      where: { id: candId },
      data: {
        assignedJobs: Array.from(union),
        ...(stageIsPositiveTerminal ? {} : { stage: 'Applied' }),
        lastActivity: new Date(),
        // Bring the candidate back to ACTIVE on any new apply unless they're
        // already in a positive terminal stage (where status is meaningful and
        // typically PLACED).
        ...(stageIsPositiveTerminal ? {} : { status: 'ACTIVE' }),
      },
    });

    const job = await prisma.job.findUnique({
      where: { id: jId },
      select: { id: true, title: true, createdById: true, assignedToId: true },
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

    // Run the stage engine for THIS specific job so the per-job pipeline +
    // portal Application timeline reflect APPLIED. We run it for non-terminal
    // and previously-rejected cases (so a re-apply correctly publishes APPLIED
    // to the portal). We skip only when the candidate is in a positive
    // terminal stage on a different job — otherwise we'd cascade an APPLIED
    // label onto a hired candidate's profile.
    if (!stageIsPositiveTerminal) {
      await updateCandidateStage({
        candidateId: candId,
        jobId: jId,
        stage: PIPELINE_STAGES.APPLIED,
        performedById: performedById || undefined,
        skipStageActivity: true,
      });
    }

    // If this apply re-activated a previously-rejected candidate, surface a
    // distinct Activity row so the recruiter sees the lifecycle inflection in
    // the candidate drawer ("Re-activated by candidate apply"). The generic
    // "Candidate applied" row is still added below for the new job.
    if (previouslyRejected) {
      const activityActor = performedById || job.createdById || job.assignedToId || null;
      if (activityActor) {
        try {
          await prisma.activity.create({
            data: {
              action: 'Candidate re-activated',
              description: `Candidate applied to ${job.title || 'a new job'} after a previous rejection — stage moved back to Applied.`,
              performedById: activityActor,
              entityType: 'CANDIDATE',
              entityId: candId,
              category: 'Candidates',
              relatedType: 'job',
              relatedId: jId,
              relatedLabel: job.title || null,
              metadata: {
                kind: 'portal-reapply-after-reject',
                jobId: jId,
                jobTitle: job.title || null,
                previousStage: existing.stage || null,
              },
            },
          });
        } catch (reactErr) {
          console.warn(
            '[applyPortalApplicationSync] re-activation activity failed (non-fatal):',
            reactErr?.message || reactErr
          );
        }
      }
    }

    // Surface a CRM Activity row so the candidate drawer's Activity feed in
    // FrontPhase 2 shows "Candidate applied to <Job>" — alongside the existing
    // rejection / interview events. Activity requires a User `performedById`,
    // so we attribute to the recruiter who owns the job (createdBy or
    // assignedTo). If neither is available we silently skip — the Match +
    // pipeline rows above still surface the apply across other CRM views.
    const activityActor = performedById || job.createdById || job.assignedToId || null;
    if (activityActor) {
      const fullName =
        `${existing.firstName || ''} ${existing.lastName || ''}`.trim() ||
        existing.email ||
        'Candidate';
      try {
        await prisma.activity.create({
          data: {
            action: 'Candidate applied',
            description: `${fullName} applied to ${job.title || 'a job'}.`,
            performedById: activityActor,
            entityType: 'CANDIDATE',
            entityId: candId,
            category: 'Candidates',
            relatedType: 'job',
            relatedId: jId,
            relatedLabel: job.title || null,
            metadata: {
              kind: 'portal-apply',
              jobId: jId,
              jobTitle: job.title || null,
            },
          },
        });
      } catch (activityError) {
        console.warn(
          '[applyPortalApplicationSync] activity log failed (non-fatal):',
          activityError?.message || activityError
        );
      }
    }
  });
}

/**
 * One-shot backfill: walk every tenant `Job` row and stamp `tenantDbName` on
 * the matching portal `Job` mirror in the `jobportal` database. Run once per
 * tenant after deploying the new schema field — afterwards every new portal
 * Job carries its `tenantDbName` automatically (via `syncJobToJobPortalDb` at
 * job-create / update time).
 *
 * Returns counts so the caller can confirm the backfill ran end-to-end.
 */
export async function backfillPortalJobTenantDbNames({ tenantDbName }) {
  const tdb = String(tenantDbName || '').trim();
  if (!tdb) {
    throw new Error('tenantDbName is required');
  }

  return runWithTenantContext(tdb, async () => {
    const tenantJobs = await prisma.job.findMany({
      select: { id: true },
    });
    if (!tenantJobs.length) {
      return { tenantDbName: tdb, scanned: 0, updated: 0, missing: 0 };
    }

    const portal = getJobPortalPrismaClient();
    let updated = 0;
    let missing = 0;
    for (const job of tenantJobs) {
      try {
        const portalJob = await portal.job.findUnique({
          where: { id: job.id },
          select: { id: true, tenantDbName: true },
        });
        if (!portalJob) {
          missing += 1;
          continue;
        }
        if (portalJob.tenantDbName === tdb) continue;
        await portal.job.update({
          where: { id: job.id },
          data: { tenantDbName: tdb },
        });
        updated += 1;
      } catch (error) {
        console.warn(
          '[backfillPortalJobTenantDbNames] job update failed:',
          job.id,
          error?.message || error
        );
      }
    }

    return { tenantDbName: tdb, scanned: tenantJobs.length, updated, missing };
  });
}
