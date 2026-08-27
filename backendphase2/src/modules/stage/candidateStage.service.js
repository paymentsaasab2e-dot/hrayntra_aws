import { prisma } from '../../config/prisma.js';
import { getJobPortalPrismaClient } from '../../config/prisma.js';
import { env, isLoopbackPublicUrl, normalizePublicUrl } from '../../config/env.js';
import {
  buildPublicUploadsAccessUrl,
  normalizeRelativeUploadPath,
} from '../../utils/publicUploads.util.js';
import {
  notifyCandidateHired,
  notifyCandidateStageChanged,
} from '../setting/alert-notify.helpers.js';

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
  if (n.includes('applied') || n === 'apply' || n.includes('submit')) return PIPELINE_STAGES.APPLIED;
  if (/\b(hired|joined|placed|onboarded)\b/.test(n)) {
    return PIPELINE_STAGES.HIRED;
  }
  if (n.includes('offer')) return PIPELINE_STAGES.OFFER;
  if (n.includes('interview')) return PIPELINE_STAGES.INTERVIEW;
  if (n.includes('screen') || n.includes('review') || n.includes('assess') || n.includes('shortlist')) {
    return PIPELINE_STAGES.SCREENING;
  }
  return PIPELINE_STAGES.APPLIED;
}

/**
 * Resolve the tenant CRM `PipelineStage` row for a canonical bucket (PIPELINE_STAGES.*).
 * Prefer explicit `systemRole` on the stage; else substring bucket from `name`.
 */
export async function resolveJobPipelineStageForRole(jobId, canonicalStage) {
  const role = String(canonicalStage || '').toUpperCase();
  if (!jobId || !role) return null;
  const stages = await prisma.pipelineStage.findMany({
    where: { jobId },
    orderBy: { order: 'asc' },
  });
  if (!stages.length) return null;
  const tagged = stages.find((s) => s.systemRole && String(s.systemRole).toUpperCase() === role);
  if (tagged) return tagged;
  return stages.find((s) => mapStageNameToPipelineBucket(s.name) === role) || null;
}

/** When a job has no pipeline columns yet, create a default stage for workflow moves (e.g. Interviewing). */
export async function ensureJobPipelineStageForRole(jobId, canonicalStage) {
  const existing = await resolveJobPipelineStageForRole(jobId, canonicalStage);
  if (existing) return existing;

  const role = String(canonicalStage || '').toUpperCase();
  if (!jobId || !role) return null;

  const label = mapPipelineStageToCrmCandidateLabel(canonicalStage);
  const maxOrderRow = await prisma.pipelineStage.findFirst({
    where: { jobId },
    orderBy: { order: 'desc' },
    select: { order: true },
  });

  return prisma.pipelineStage.create({
    data: {
      jobId,
      name: label,
      order: (maxOrderRow?.order ?? 0) + 1,
      systemRole: role,
    },
  });
}

async function upsertTenantPipelineEntry(candidateId, jobId, stageId, movedById) {
  if (!candidateId || !jobId || !stageId) return;
  const existing = await prisma.pipelineEntry.findFirst({
    where: { candidateId, jobId },
    select: { id: true },
  });
  const data = {
    stageId,
    movedAt: new Date(),
    ...(movedById ? { movedById } : {}),
  };
  if (existing) {
    await prisma.pipelineEntry.update({
      where: { id: existing.id },
      data,
    });
  } else {
    await prisma.pipelineEntry.create({
      data: {
        candidateId,
        jobId,
        stageId,
        movedById: movedById || null,
      },
    });
  }
}

async function resolvePortalJobPipelineStageForRole(portal, jobId, canonicalStage) {
  const role = String(canonicalStage || '').toUpperCase();
  if (!jobId || !role) return null;
  const stages = await portal.pipelineStage.findMany({
    where: { jobId },
    orderBy: { order: 'asc' },
  });
  if (!stages.length) return null;
  return stages.find((s) => mapStageNameToPipelineBucket(s.name) === role) || null;
}

async function ensurePortalJobPipelineStageForRole(portal, jobId, canonicalStage) {
  const existing = await resolvePortalJobPipelineStageForRole(portal, jobId, canonicalStage);
  if (existing) return existing;

  const role = String(canonicalStage || '').toUpperCase();
  if (!jobId || !role) return null;

  const label = mapPipelineStageToCrmCandidateLabel(canonicalStage);
  const maxOrderRow = await portal.pipelineStage.findFirst({
    where: { jobId },
    orderBy: { order: 'desc' },
    select: { order: true },
  });

  return portal.pipelineStage.create({
    data: {
      jobId,
      name: label,
      order: (maxOrderRow?.order ?? 0) + 1,
    },
  });
}

async function upsertPortalPipelineEntry(portal, candidateId, jobId, stageId, options = {}) {
  if (!candidateId || !jobId || !stageId) return;
  const existing = await portal.pipelineEntry.findFirst({
    where: { candidateId, jobId },
    select: { id: true },
  });
  const data = {
    stageId,
    movedAt: new Date(),
    ...(options.pipelineNotes ? { notes: options.pipelineNotes } : {}),
  };
  if (existing) {
    await portal.pipelineEntry.update({
      where: { id: existing.id },
      data,
    });
  } else {
    await portal.pipelineEntry.create({
      data: {
        candidateId,
        jobId,
        stageId,
      },
    });
  }
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

/** Map placements table status to CRM candidate stage + pipeline bucket. */
export function mapPlacementStatusToCrmStageSync(placementStatus) {
  switch (String(placementStatus || '').toUpperCase()) {
    case 'OFFER_SENT':
      return { stage: PIPELINE_STAGES.OFFER, stageLabel: 'Offer Sent' };
    case 'OFFER_ACCEPTED':
      return { stage: PIPELINE_STAGES.OFFER, stageLabel: 'Offer Accepted' };
    case 'OFFER_REJECTED':
      return { stage: PIPELINE_STAGES.REJECTED, stageLabel: 'Offer Rejected' };
    case 'JOINING_SCHEDULED':
      return { stage: PIPELINE_STAGES.OFFER, stageLabel: 'Joining Scheduled' };
    case 'JOINED':
      return { stage: PIPELINE_STAGES.HIRED, stageLabel: 'Joined' };
    case 'NO_SHOW':
      return { stage: PIPELINE_STAGES.REJECTED, stageLabel: 'No Show' };
    case 'WITHDRAWN':
      return { stage: PIPELINE_STAGES.REJECTED, stageLabel: 'Withdrawn' };
    case 'FAILED':
      return { stage: PIPELINE_STAGES.REJECTED, stageLabel: 'Failed' };
    case 'REPLACEMENT_REQUIRED':
      return { stage: PIPELINE_STAGES.REJECTED, stageLabel: 'Replacement Required' };
    case 'REPLACED':
      return { stage: PIPELINE_STAGES.HIRED, stageLabel: 'Replaced' };
    default:
      return null;
  }
}

export function mapPlacementStatusToCrmStageLabel(placementStatus) {
  return mapPlacementStatusToCrmStageSync(placementStatus)?.stageLabel || '';
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
  if (options.stage) {
    const label = mapPipelineStageToCrmCandidateLabel(options.stage);
    return {
      title: label,
      description: options.timelineDescription || `${label} stage`,
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
  if (/^https?:\/\//i.test(url)) {
    // Rebuild loopback absolute URLs saved during local dev so portal links
    // point at the public CRM host in production.
    if (isLoopbackPublicUrl(url)) {
      const rebuilt = buildPublicUploadsAccessUrl(url);
      if (rebuilt) return rebuilt;
      try {
        const path = new URL(normalizePublicUrl(url)).pathname;
        if (path.startsWith('/uploads/')) {
          return buildPublicUploadsAccessUrl(path);
        }
      } catch {
        /* fall through */
      }
    }
    const normalized = normalizeRelativeUploadPath(url);
    if (normalized) return buildPublicUploadsAccessUrl(normalized) || url;
    return url;
  }
  const relative = normalizeRelativeUploadPath(url);
  return buildPublicUploadsAccessUrl(relative) || relative;
}

function buildRejectionPortalDescription(reason, feedback) {
  const lines = [
    reason ? `Reason: ${String(reason).trim()}` : null,
    feedback ? `Feedback: ${String(feedback).trim()}` : null,
  ].filter(Boolean);
  return lines.length ? lines.join('\n') : null;
}

/** Mirror recruiter rejection reason/feedback to the candidate portal application. */
export async function syncApplicationRejectionFeedback(
  candidateId,
  jobId,
  { reason, feedback, sharedAt } = {}
) {
  if (!candidateId || !jobId) return;

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

  parsed.rejectionReason = reason ? String(reason).trim() : null;
  parsed.rejectionFeedback = feedback ? String(feedback).trim() : null;
  parsed.rejectionSharedAt = sharedAt ? new Date(sharedAt).toISOString() : new Date().toISOString();

  await portal.application.update({
    where: { id: app.id },
    data: { offerDetails: JSON.stringify(parsed) },
  });
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
export async function syncApplicationOfferLetter(
  candidateId,
  jobId,
  { fileUrl, fileName, placementId, placementStatus, resetResponse = false }
) {
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
  if (placementId) parsed.placementId = String(placementId);
  if (placementStatus) parsed.placementStatus = String(placementStatus);
  if (resetResponse) {
    parsed.offerResponse = 'PENDING';
    delete parsed.offerRejectionRemark;
    delete parsed.offerRespondedAt;
    parsed.offerResentAt = new Date().toISOString();
  } else {
    parsed.offerResponse = parsed.offerResponse || 'PENDING';
  }
  await portal.application.update({
    where: { id: app.id },
    data: { offerDetails: JSON.stringify(parsed) },
  });
}

/** Push joining schedule + reporting contact to the candidate portal application. */
export async function syncApplicationJoiningDetails(candidateId, jobId, details = {}) {
  if (!candidateId || !jobId) return;
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
  parsed.placementStatus = 'JOINING_SCHEDULED';
  parsed.joiningScheduledAt = new Date().toISOString();
  parsed.joiningDate = details.joiningDate || null;
  parsed.reportingToName = details.reportingToName || null;
  parsed.reportingToTitle = details.reportingToTitle || null;
  parsed.reportingToEmail = details.reportingToEmail || null;
  parsed.joiningNotes = details.joiningNotes || null;
  await portal.application.update({
    where: { id: app.id },
    data: { offerDetails: JSON.stringify(parsed) },
  });

  const joiningTitle = 'Joining scheduled';
  const lines = [
    details.joiningDate ? `Date: ${details.joiningDate}` : null,
    details.reportingToName
      ? `Report to: ${details.reportingToName}${details.reportingToTitle ? ` (${details.reportingToTitle})` : ''}`
      : null,
    details.reportingToEmail ? `Contact: ${details.reportingToEmail}` : null,
    details.joiningNotes || null,
  ].filter(Boolean);
  await portal.applicationTimeline.create({
    data: {
      applicationId: app.id,
      status: 'SELECTED',
      title: joiningTitle,
      description: lines.join('\n') || 'Your joining date has been scheduled.',
    },
  });
}

/** Reset portal offer response so the candidate can accept/reject again after a resend. */
export async function resetApplicationOfferResponse(
  candidateId,
  jobId,
  { placementStatus = 'OFFER_SENT', placementId } = {}
) {
  if (!candidateId || !jobId) return;
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

  parsed.offerResponse = 'PENDING';
  parsed.placementStatus = String(placementStatus || 'OFFER_SENT');
  parsed.offerResentAt = new Date().toISOString();
  if (placementId) parsed.placementId = String(placementId);
  delete parsed.offerRejectionRemark;
  delete parsed.offerRespondedAt;

  await portal.application.update({
    where: { id: app.id },
    data: { offerDetails: JSON.stringify(parsed) },
  });

  await portal.applicationTimeline.create({
    data: {
      applicationId: app.id,
      status: 'FINAL_DECISION',
      title: 'Offer letter resent',
      description:
        'The recruiter shared a revised offer letter. Please review and respond when you are ready.',
    },
  });
}

/** Remove placement/offer mirror fields from the portal application after undo or delete. */
export async function clearApplicationPlacementDetails(candidateId, jobId) {
  if (!candidateId || !jobId) return;
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

  const placementKeys = [
    'offerLetterUrl',
    'offerLetterRelativeUrl',
    'offerLetterFileName',
    'offerLetterUploadedAt',
    'placementId',
    'placementStatus',
    'offerResponse',
    'offerRespondedAt',
    'offerResentAt',
    'offerRejectionRemark',
    'joiningScheduledAt',
    'joiningDate',
    'reportingToName',
    'reportingToTitle',
    'reportingToEmail',
    'joiningNotes',
  ];
  for (const key of placementKeys) {
    delete parsed[key];
  }

  const hasLegacyText =
    typeof parsed.legacyOfferText === 'string' && parsed.legacyOfferText.trim().length > 0;
  const remainingKeys = Object.keys(parsed).filter((key) => {
    const value = parsed[key];
    return value !== null && value !== undefined && value !== '';
  });

  await portal.application.update({
    where: { id: app.id },
    data: {
      offerDetails: remainingKeys.length || hasLegacyText ? JSON.stringify(parsed) : null,
    },
  });
}

export function mapFeedbackRecommendationForPortal(recommendation) {
  const key = String(recommendation || '').trim().toUpperCase();
  if (key === 'PASS') return 'Pass';
  if (key === 'REJECT') return 'Failed';
  return 'On hold';
}

export function mapFeedbackRecommendationLabelForPortal(recommendation) {
  const key = String(recommendation || '').trim().toUpperCase();
  if (key === 'PASS') return 'Pass';
  if (key === 'REJECT') return 'Reject';
  return 'Hold';
}

export function resolveInterviewRoundLabelForPortal(interviewLike = {}) {
  const fromRound = humanizePortalInterviewRoundLabel(interviewLike.round);
  if (fromRound) return fromRound;
  const fromType = humanizePortalInterviewRoundLabel(interviewLike.type);
  if (fromType) return fromType;
  return 'Interview';
}

const PORTAL_INTERVIEW_LABEL_MAP = new Map([
  ['PHONE', 'Phone screening'],
  ['VIDEO', 'Video interview'],
  ['IN_PERSON', 'In-person interview'],
  ['TECHNICAL_TEST', 'Technical test'],
  ['ASSESSMENT', 'Assessment'],
  ['GROUP_DISCUSSION', 'Group discussion'],
  ['ONSITE', 'On-site interview'],
  ['TECHNICAL', 'Technical round'],
  ['FINAL', 'Final interview'],
  ['SCREENING', 'HR screening'],
  ['HR_SCREENING', 'HR screening'],
  ['HR', 'HR screening'],
  ['MANAGERIAL', 'Managerial round'],
  ['CLIENT', 'Client interview'],
]);

/** Normalize CRM `round` / `type` tokens and schedule-popup labels for the candidate portal. */
export function humanizePortalInterviewRoundLabel(raw) {
  const s = String(raw || '').trim();
  if (!s) return null;

  const upper = s.replace(/[\s_-]+/g, '_').toUpperCase();
  if (PORTAL_INTERVIEW_LABEL_MAP.has(upper)) {
    return PORTAL_INTERVIEW_LABEL_MAP.get(upper);
  }

  const compact = upper.replace(/_/g, '');
  for (const [key, label] of PORTAL_INTERVIEW_LABEL_MAP) {
    if (key.replace(/_/g, '') === compact) return label;
  }

  // Schedule popup labels ("HR Screening", "Technical Round 1") — keep readable text as-is.
  if (/\s/.test(s) || /round\s*\d/i.test(s)) {
    return s;
  }

  return s
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

/** Mirror completed interview feedback (Pass/Failed + remark) to the candidate portal. */
export async function syncApplicationInterviewFeedback(
  candidateId,
  jobId,
  {
    interviewId,
    roundLabel,
    recommendation,
    comments,
    overallScore,
    companyName,
    technicalScore,
    communicationScore,
    problemSolvingScore,
    cultureFitScore,
    experienceMatchScore,
    strengths,
    weaknesses,
    submittedAt,
    skipTimeline = false,
  } = {}
) {
  if (!candidateId || !jobId) return;

  const portal = getJobPortalPrismaClient();
  const app = await portal.application.findUnique({
    where: { candidateId_jobId: { candidateId, jobId } },
    select: { id: true, offerDetails: true },
  });
  if (!app) return;

  const outcome = mapFeedbackRecommendationForPortal(recommendation);
  const recommendationLabel = mapFeedbackRecommendationLabelForPortal(recommendation);
  const round = String(roundLabel || 'Interview').trim() || 'Interview';
  const remark = String(comments || '').trim() || null;
  const score =
    overallScore != null && !Number.isNaN(Number(overallScore)) ? Number(overallScore) : null;
  const completedAt = submittedAt ? new Date(submittedAt).toISOString() : new Date().toISOString();

  const descriptionLines = [
    `Outcome: ${outcome}`,
    `Recommendation: ${recommendationLabel}`,
    remark ? `Remark: ${remark}` : null,
    score != null ? `Overall rating: ${score}/5` : null,
    technicalScore != null ? `Technical skills: ${Number(technicalScore)}/5` : null,
    communicationScore != null ? `Communication: ${Number(communicationScore)}/5` : null,
    problemSolvingScore != null ? `Problem solving: ${Number(problemSolvingScore)}/5` : null,
    cultureFitScore != null ? `Culture fit: ${Number(cultureFitScore)}/5` : null,
    experienceMatchScore != null ? `Experience match: ${Number(experienceMatchScore)}/5` : null,
    strengths ? `Strengths: ${String(strengths)}` : null,
    weaknesses ? `Weaknesses: ${String(weaknesses)}` : null,
    `Round: ${round}`,
    companyName ? `Company: ${companyName}` : null,
  ].filter(Boolean);

  if (!skipTimeline) {
    await portal.applicationTimeline.create({
      data: {
        applicationId: app.id,
        status: 'INTERVIEW',
        title: `Interview completed — ${round}`,
        description: descriptionLines.join('\n'),
      },
    });
  }

  let parsed = {};
  if (app.offerDetails) {
    try {
      const maybe = JSON.parse(app.offerDetails);
      parsed = maybe && typeof maybe === 'object' ? maybe : { legacyOfferText: app.offerDetails };
    } catch {
      parsed = { legacyOfferText: app.offerDetails };
    }
  }

  const outcomes = Array.isArray(parsed.interviewOutcomes) ? parsed.interviewOutcomes : [];
  const nextOutcome = {
    interviewId: interviewId ? String(interviewId) : null,
    roundLabel: round,
    outcome,
    recommendationLabel,
    remark,
    comments: remark,
    overallScore: score,
    companyName: companyName ? String(companyName) : null,
    technicalScore: technicalScore != null ? Number(technicalScore) : null,
    communicationScore: communicationScore != null ? Number(communicationScore) : null,
    problemSolvingScore: problemSolvingScore != null ? Number(problemSolvingScore) : null,
    cultureFitScore: cultureFitScore != null ? Number(cultureFitScore) : null,
    experienceMatchScore: experienceMatchScore != null ? Number(experienceMatchScore) : null,
    strengths: strengths ? String(strengths) : null,
    weaknesses: weaknesses ? String(weaknesses) : null,
    completedAt,
  };
  const existingIdx = outcomes.findIndex(
    (entry) =>
      (interviewId && String(entry?.interviewId || '') === String(interviewId)) ||
      String(entry?.roundLabel || '').trim().toLowerCase() === round.toLowerCase()
  );
  if (existingIdx >= 0) {
    outcomes[existingIdx] = { ...outcomes[existingIdx], ...nextOutcome };
  } else {
    outcomes.push(nextOutcome);
  }
  parsed.interviewOutcomes = outcomes;

  await portal.application.update({
    where: { id: app.id },
    data: { offerDetails: JSON.stringify(parsed) },
  });
}

export async function syncApplicationOfferResponse(
  candidateId,
  jobId,
  { decision, placementStatus, remark }
) {
  if (!candidateId || !jobId) return;
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
  parsed.offerResponse = decision === 'accept' ? 'ACCEPTED' : 'REJECTED';
  parsed.offerRespondedAt = new Date().toISOString();
  if (placementStatus) parsed.placementStatus = placementStatus;
  if (decision === 'reject' && remark) {
    parsed.offerRejectionRemark = String(remark).trim();
  }
  await portal.application.update({
    where: { id: app.id },
    data: { offerDetails: JSON.stringify(parsed) },
  });
  await portal.applicationTimeline.create({
    data: {
      applicationId: app.id,
      status: decision === 'accept' ? 'SELECTED' : 'REJECTED',
      title: decision === 'accept' ? 'Offer accepted' : 'Offer declined',
      description:
        decision === 'accept'
          ? 'You accepted the offer letter on the candidate portal.'
          : remark
            ? `You declined the offer letter on the candidate portal.\n\nReason: ${String(remark).trim()}`
            : 'You declined the offer letter on the candidate portal.',
    },
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

  const canonicalStage = String(options.stage || '').toUpperCase();
  if (canonicalStage && Object.values(PIPELINE_STAGES).includes(canonicalStage)) {
    try {
      const resolvedStage = await ensurePortalJobPipelineStageForRole(portal, jobId, canonicalStage);
      if (resolvedStage?.id) {
        await upsertPortalPipelineEntry(portal, candidateId, jobId, resolvedStage.id, options);
      }
    } catch (pipeErr) {
      console.warn(
        '[syncApplicationState] portal pipeline entry move failed:',
        pipeErr?.message || pipeErr
      );
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
  stageLabel,
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
  const label = String(stageLabel || '').trim() || mapPipelineStageToCrmCandidateLabel(stage);
  const upper = String(stage || '').toUpperCase();

  const previousCandidate = await prisma.candidate.findUnique({
    where: { id: candidateId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      stage: true,
      assignedToId: true,
    },
  });
  const previousStage = previousCandidate?.stage || null;

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
              ? buildRejectionPortalDescription(reason, feedback)
              // HR opted out of sharing — keep portal description empty so
              // the candidate's "View feedback" button stays hidden and the
              // generic "No additional notes for this step." renders.
              : null
            : null,
    };

    await syncApplicationState(candidateId, jobId, portalExtra);

    if (upper === PIPELINE_STAGES.REJECTED && showFeedbackToCandidate) {
      try {
        await syncApplicationRejectionFeedback(candidateId, jobId, {
          reason,
          feedback,
          sharedAt: new Date().toISOString(),
        });
      } catch (rejectSyncErr) {
        console.warn(
          '[updateCandidateStage] portal rejection feedback sync failed:',
          rejectSyncErr?.message || rejectSyncErr
        );
      }
    }

    try {
      const resolvedStage = await ensureJobPipelineStageForRole(jobId, upper);
      if (resolvedStage?.id) {
        await upsertTenantPipelineEntry(candidateId, jobId, resolvedStage.id, performedById || null);
      }
    } catch (pipeErr) {
      console.warn('[updateCandidateStage] tenant pipeline entry move failed:', pipeErr?.message || pipeErr);
    }
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

  try {
    if (label && label !== previousStage) {
      const job = jobId
        ? await prisma.job.findUnique({
            where: { id: jobId },
            select: { id: true, title: true, client: { select: { companyName: true } } },
          })
        : null;
      await notifyCandidateStageChanged({
        candidate: previousCandidate || { id: candidateId, stage: label },
        job,
        previousStage,
        newStage: label,
        performedById,
      });
      if (upper === PIPELINE_STAGES.HIRED) {
        await notifyCandidateHired({
          candidate: previousCandidate,
          job,
          client: job?.client,
          recruiterId: performedById || previousCandidate?.assignedToId,
        });
      }
    }
  } catch (alertErr) {
    console.warn('[updateCandidateStage] alert failed:', alertErr?.message || alertErr);
  }

  if (
    jobId &&
    (upper === PIPELINE_STAGES.OFFER || upper === PIPELINE_STAGES.HIRED) &&
    !metadata?.skipSlabPlacement
  ) {
    try {
      const { ensureSlabBackedPlacement } = await import('../placement/ensureSlabPlacement.js');
      await ensureSlabBackedPlacement({
        candidateId,
        jobId,
        performedById,
        stage: upper,
      });
    } catch (slabErr) {
      console.warn(
        '[updateCandidateStage] slab placement auto-apply failed:',
        slabErr?.message || slabErr,
      );
    }
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

/**
 * Portal DB only: append a cancellation row to the application timeline without
 * changing application status or pipeline stage.
 */
export async function syncApplicationInterviewCancelled(
  candidateId,
  jobId,
  { reason, notes, scheduledAt } = {},
) {
  const portal = getJobPortalPrismaClient();
  const app = await portal.application.findUnique({
    where: {
      candidateId_jobId: { candidateId, jobId },
    },
    select: { id: true, status: true },
  });

  if (!app) {
    return;
  }

  const whenLabel = scheduledAt
    ? new Date(scheduledAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })
    : null;
  const descriptionLines = [
    whenLabel ? `When: ${whenLabel}` : null,
    reason ? `Reason: ${reason}` : null,
    notes ? `Notes: ${notes}` : null,
  ].filter(Boolean);

  await portal.applicationTimeline.create({
    data: {
      applicationId: app.id,
      status: app.status || 'INTERVIEW',
      title: 'Interview cancelled',
      description: descriptionLines.length ? descriptionLines.join('\n') : 'Interview cancelled by recruiter.',
    },
  });

  await portal.candidate.update({
    where: { id: candidateId },
    data: { lastActivity: new Date() },
  });
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
