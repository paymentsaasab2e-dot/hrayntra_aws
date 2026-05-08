import { prisma } from '../../config/prisma.js';
import { getJobPortalPrismaClient } from '../../config/prisma.js';

export const PIPELINE_STAGES = {
  APPLIED: 'APPLIED',
  SCREENING: 'SCREENING',
  INTERVIEW: 'INTERVIEW',
  OFFER: 'OFFER',
  HIRED: 'HIRED',
  REJECTED: 'REJECTED',
};

/**
 * Map internal pipeline stage to job-portal `ApplicationStatus` (Prisma enum on portal DB).
 */
export function mapPipelineStageToPortalApplicationStatus(stage) {
  const s = String(stage || '').toUpperCase();
  switch (s) {
    case PIPELINE_STAGES.APPLIED:
      return 'SUBMITTED';
    case PIPELINE_STAGES.SCREENING:
      return 'UNDER_REVIEW';
    case PIPELINE_STAGES.INTERVIEW:
      return 'INTERVIEW';
    case PIPELINE_STAGES.OFFER:
      return 'FINAL_DECISION';
    case PIPELINE_STAGES.HIRED:
      return 'SELECTED';
    case PIPELINE_STAGES.REJECTED:
      return 'REJECTED';
    default:
      return 'UNDER_REVIEW';
  }
}

/**
 * Infer the canonical pipeline bucket from a free-form custom stage name.
 *
 * Recruiters can rename per-job pipeline columns (e.g. "Tech Round 1", "Final Onsite",
 * "Offer Sent"). For UI tags + portal `Application.status` we still need to bucket
 * each stage into one of the canonical PIPELINE_STAGES so the chip everywhere
 * (Candidates, Interviews, Job drawer, Job Portal /applications) stays consistent.
 *
 * Rules (first match wins):
 *   reject        → REJECTED
 *   hired/joined/placed/onboard → HIRED
 *   offer         → OFFER
 *   interview     → INTERVIEW
 *   screen/review/assess → SCREENING
 *   shortlist     → SCREENING (closest canonical bucket)
 *   anything else → APPLIED
 */
export function mapStageNameToPipelineBucket(stageName) {
  const n = String(stageName || '').trim().toLowerCase();
  if (!n) return PIPELINE_STAGES.APPLIED;
  if (n.includes('reject')) return PIPELINE_STAGES.REJECTED;
  if (n.includes('hire') || n.includes('joined') || n.includes('placed') || n.includes('onboard')) {
    return PIPELINE_STAGES.HIRED;
  }
  if (n.includes('offer')) return PIPELINE_STAGES.OFFER;
  if (n.includes('interview')) return PIPELINE_STAGES.INTERVIEW;
  if (n.includes('screen') || n.includes('review') || n.includes('assess') || n.includes('shortlist')) {
    return PIPELINE_STAGES.SCREENING;
  }
  return PIPELINE_STAGES.APPLIED;
}

/** CRM / list `candidate.stage` string (tenant + portal profile). */
export function mapPipelineStageToCrmCandidateLabel(stage) {
  const s = String(stage || '').toUpperCase();
  switch (s) {
    case PIPELINE_STAGES.APPLIED:
      return 'Applied';
    case PIPELINE_STAGES.SCREENING:
      return 'Screening';
    case PIPELINE_STAGES.INTERVIEW:
      return 'Interviewing';
    case PIPELINE_STAGES.OFFER:
      return 'Offer';
    case PIPELINE_STAGES.HIRED:
      return 'Hired';
    case PIPELINE_STAGES.REJECTED:
      return 'Rejected';
    default:
      return 'Applied';
  }
}

/** Human-ready title for portal ApplicationTimeline (avoid generic "Interview"). */
function interviewTypeToPortalTimelineTitle(metadata) {
  if (!metadata || typeof metadata !== 'object') return null;
  const raw = String(metadata.interviewTitle || metadata.type || '').trim();
  if (!raw) return null;
  const upper = raw.replace(/[\s-]+/g, '_').toUpperCase();
  const map = {
    PHONE: 'Phone screening',
    VIDEO: 'Video interview',
    IN_PERSON: 'In-person interview',
    TECHNICAL_TEST: 'Technical test',
    ASSESSMENT: 'Assessment',
    GROUP_DISCUSSION: 'Group discussion',
    ONSITE: 'On-site interview',
    TECHNICAL: 'Technical round',
    FINAL: 'Final interview',
    SCREENING: 'HR screening',
    HR_SCREENING: 'HR screening',
  };
  if (map[upper]) return map[upper];
  const collapsed = upper.replace(/_/g, '');
  const key = Object.keys(map).find((k) => k.replace(/_/g, '') === collapsed);
  if (key) return map[key];
  if (/^[A-Z][A-Z0-9_]*$/.test(upper)) {
    return upper
      .split('_')
      .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
      .join(' ');
  }
  return raw;
}

function buildTimelineCopy(portalStatus, options = {}) {
  if (options.timelineTitle) {
    return {
      title: options.timelineTitle,
      description: options.timelineDescription || null,
    };
  }
  const status = String(portalStatus || '');
  if (status === 'INTERVIEW') {
    return {
      title: 'Interview',
      description: options.timelineDescription || 'Interview progress updated',
    };
  }
  if (status === 'SELECTED') {
    return { title: 'Selected', description: options.timelineDescription || 'Offer / hiring update' };
  }
  if (status === 'REJECTED') {
    return { title: 'Not selected', description: options.timelineDescription || 'Application updated' };
  }
  if (status === 'FINAL_DECISION') {
    return { title: 'Final decision', description: options.timelineDescription || 'Status updated' };
  }
  return { title: 'Status update', description: options.timelineDescription || 'Application updated' };
}

/**
 * Public absolute URL for files served by this CRM backend's `/uploads/...`
 * static handler. Stored alongside the relative path so the portal frontend
 * (different origin) can open the file without rewriting URLs at view time.
 */
function buildAbsoluteUploadsUrl(relativeUrl) {
  if (!relativeUrl) return null;
  const url = String(relativeUrl).trim();
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  const base = String(
    process.env.BACKEND_PUBLIC_URL ||
      process.env.PUBLIC_BACKEND_URL ||
      `http://localhost:${process.env.PORT || '5001'}`
  ).replace(/\/+$/, '');
  const path = url.startsWith('/') ? url : `/${url}`;
  return `${base}${path}`;
}

/**
 * Mirror an offer-letter URL to the candidate's portal Application so the
 * job-portal `/applications/[id]` page can show "View / Download offer letter".
 *
 * We piggy-back on the existing `Application.offerDetails` String? column —
 * stored as JSON so we can carry both the path (for any future relative
 * resolver) and an absolute URL (for the portal frontend to open directly
 * across origins).
 */
export async function syncApplicationOfferLetter(candidateId, jobId, { fileUrl, fileName }) {
  if (!candidateId || !jobId || !fileUrl) return;
  const portal = getJobPortalPrismaClient();
  const app = await portal.application.findUnique({
    where: { candidateId_jobId: { candidateId, jobId } },
    select: { id: true, offerDetails: true },
  });
  if (!app) return;
  let parsed = {};
  if (app.offerDetails) {
    try {
      const maybe = JSON.parse(app.offerDetails);
      parsed = maybe && typeof maybe === 'object' ? maybe : { legacyOfferText: app.offerDetails };
    } catch {
      parsed = { legacyOfferText: app.offerDetails };
    }
  }
  parsed.offerLetterUrl = buildAbsoluteUploadsUrl(fileUrl) || fileUrl;
  parsed.offerLetterRelativeUrl = fileUrl;
  parsed.offerLetterFileName = fileName || null;
  parsed.offerLetterUploadedAt = new Date().toISOString();
  await portal.application.update({
    where: { id: app.id },
    data: { offerDetails: JSON.stringify(parsed) },
  });
}

/**
 * Portal DB only: application row, timeline row, portal candidate.stage; optionally move pipeline entry for INTERVIEW.
 */
export async function syncApplicationState(candidateId, jobId, options = {}) {
  const portal = getJobPortalPrismaClient();
  const portalStatus = options.portalStatus || mapPipelineStageToPortalApplicationStatus(options.stage);
  const app = await portal.application.findUnique({
    where: {
      candidateId_jobId: { candidateId, jobId },
    },
    select: { id: true },
  });

  if (!app) {
    return;
  }

  await portal.application.update({
    where: { id: app.id },
    data: { status: portalStatus },
  });

  const { title, description } = buildTimelineCopy(portalStatus, options);
  await portal.applicationTimeline.create({
    data: {
      applicationId: app.id,
      status: portalStatus,
      title,
      description,
    },
  });

  const label = mapPipelineStageToCrmCandidateLabel(options.stage);
  await portal.candidate.update({
    where: { id: candidateId },
    data: {
      stage: label,
      lastActivity: new Date(),
    },
  });

  if (String(options.stage || '').toUpperCase() === PIPELINE_STAGES.INTERVIEW) {
    const stages = await portal.pipelineStage.findMany({
      where: { jobId },
      select: { id: true, name: true, order: true },
      orderBy: { order: 'asc' },
    });
    const interviewStage = stages.find((st) => /interview/i.test(String(st.name || '')));
    if (interviewStage) {
      const existing = await portal.pipelineEntry.findFirst({
        where: { candidateId, jobId },
        select: { id: true },
      });
      if (existing) {
        await portal.pipelineEntry.update({
          where: { id: existing.id },
          data: {
            stageId: interviewStage.id,
            movedAt: new Date(),
            ...(options.pipelineNotes ? { notes: options.pipelineNotes } : {}),
          },
        });
      }
    }
  }
}

/**
 * Tenant CRM update + portal sync. Optionally records Activity on tenant (when performedById + !skipStageActivity).
 */
export async function updateCandidateStage({
  candidateId,
  jobId,
  stage,
  metadata = {},
  reason,
  feedback,
  performedById,
  skipStageActivity = false,
  // HR-controlled flag: only when true do we surface the rejection feedback
  // on the candidate-facing portal timeline. The full feedback is always
  // kept on the CRM (Activity + internal note) for recruiter records.
  showFeedbackToCandidate = true,
}) {
  const label = mapPipelineStageToCrmCandidateLabel(stage);
  const upper = String(stage || '').toUpperCase();

  let status = 'ACTIVE';
  if (upper === PIPELINE_STAGES.REJECTED) {
    status = 'INACTIVE';
  } else if (upper === PIPELINE_STAGES.HIRED) {
    status = 'PLACED';
  } else if (upper === PIPELINE_STAGES.APPLIED || upper === PIPELINE_STAGES.SCREENING || upper === PIPELINE_STAGES.INTERVIEW || upper === PIPELINE_STAGES.OFFER) {
    status = 'ACTIVE';
  }

  await prisma.candidate.update({
    where: { id: candidateId },
    data: {
      stage: label,
      lastActivity: new Date(),
      status,
    },
  });

  if (jobId) {
    const interviewTimelineTitle =
      upper === PIPELINE_STAGES.INTERVIEW ? interviewTypeToPortalTimelineTitle(metadata) : null;

    const portalExtra = {
      stage,
      ...(interviewTimelineTitle ? { timelineTitle: interviewTimelineTitle } : {}),
      timelineDescription:
        upper === PIPELINE_STAGES.INTERVIEW
          ? buildInterviewTimelineDescription(metadata)
          : upper === PIPELINE_STAGES.REJECTED
            ? showFeedbackToCandidate
              ? [reason, feedback].filter(Boolean).join(' — ') || null
              // HR opted out of sharing — keep portal description empty so
              // the candidate's "View feedback" button stays hidden and the
              // generic "No additional notes for this step." renders.
              : null
            : null,
    };

    await syncApplicationState(candidateId, jobId, portalExtra);
  } else if (upper === PIPELINE_STAGES.REJECTED) {
    // Job-scoped portal sync could not run (no `jobId` on the reject payload).
    // Still push the terminal label onto the portal candidate profile so
    // list/detail UIs that read `candidate.stage` flip to "Rejected" even
    // when the `Application` row is temporarily stale.
    try {
      const portal = getJobPortalPrismaClient();
      await portal.candidate.update({
        where: { id: candidateId },
        data: {
          stage: label,
          lastActivity: new Date(),
        },
      });
    } catch (portalCandErr) {
      console.warn(
        '[updateCandidateStage] portal candidate stage (reject, no jobId) failed:',
        portalCandErr?.message || portalCandErr
      );
    }
  }

  if (upper === PIPELINE_STAGES.HIRED && jobId) {
    await prisma.interview.updateMany({
      where: { candidateId, jobId },
      data: { status: 'COMPLETED' },
    });
  }

  if (!skipStageActivity && performedById) {
    const cand = await prisma.candidate.findUnique({
      where: { id: candidateId },
      select: { firstName: true, lastName: true, email: true },
    });
    const name = [cand?.firstName, cand?.lastName].filter(Boolean).join(' ').trim() || cand?.email || 'Candidate';
    await prisma.activity.create({
      data: {
        action: 'Stage updated',
        description: `${name} moved to ${label}.`,
        performedById,
        entityType: 'CANDIDATE',
        entityId: candidateId,
        category: 'Candidates',
        relatedType: 'candidate',
        relatedId: candidateId,
        relatedLabel: name,
        metadata: {
          stage: upper,
          jobId: jobId || null,
          reason: reason || null,
          feedback: feedback || null,
          ...metadata,
        },
      },
    });
  }
}

function buildInterviewTimelineDescription(metadata) {
  if (!metadata || typeof metadata !== 'object') return null;
  const lines = [];
  if (metadata.scheduledAt) lines.push(`When: ${metadata.scheduledAt}`);
  if (metadata.interviewTitle || metadata.type) lines.push(`Type: ${metadata.interviewTitle || metadata.type}`);
  if (metadata.meetingLink) lines.push(`Link: ${metadata.meetingLink}`);
  if (metadata.locationLine) lines.push(`Location: ${metadata.locationLine}`);
  if (metadata.mode) lines.push(`Mode: ${metadata.mode}`);
  // Surface assigned panel + scheduler so candidate-side portal can show "Interviewer: ..." / "Recruiter: ..."
  const interviewers = Array.isArray(metadata.interviewerNames)
    ? metadata.interviewerNames.map((n) => String(n || '').trim()).filter(Boolean)
    : typeof metadata.interviewerNames === 'string'
      ? [metadata.interviewerNames.trim()].filter(Boolean)
      : [];
  if (interviewers.length) {
    lines.push(`Interviewer: ${interviewers.join(', ')}`);
  }
  const recruiterName = String(metadata.recruiterName || '').trim();
  if (recruiterName) {
    lines.push(`Recruiter: ${recruiterName}`);
  }
  return lines.length ? lines.join('\n') : null;
}
