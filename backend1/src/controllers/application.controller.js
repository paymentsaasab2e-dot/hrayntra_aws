const { prisma } = require('../lib/prisma');
const { createCandidateNotification } = require('../services/notification.service');
const { scheduleCandidateCommonSync } = require('../services/candidateCommonSync.service');
const { loadTailoredCvForJob, syncTailoredCvToPhase2AfterApply } = require('../services/lmsTailoredCvPhase2Sync.service');
const { mapLmsDraftToRecruiterCvFields } = require('../services/lmsTailoredCvMapper.service');
const {
  resolvePublicCompanyName,
  shouldShowClientNamePublicly,
} = require('../utils/formatPortalJob.util');
const { resolvePhase2UploadUrl } = require('../utils/phase2InternalApi.util');

/** True for Prisma Mongo write conflicts / transient transaction failures (case + message fallbacks). */
function isMongoTransientWriteConflict(e) {
  if (!e) return false;
  const code = e.code;
  if (code === 'P2034' || code === 2034) return true;
  const msg = String(e.message || '').toLowerCase();
  return msg.includes('write conflict') || msg.includes('deadlock') || msg.includes('please retry your transaction');
}

/** MongoDB (replica set) can surface Prisma P2034 on conflicting writes — retry with backoff per Prisma docs. */
async function withMongoWriteConflictRetry(fn, maxAttempts = 12) {
  let lastErr;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      if (e.code === 'ALREADY_APPLIED') throw e;
      if (isMongoTransientWriteConflict(e) && attempt < maxAttempts - 1) {
        const backoff = Math.min(2000, 40 * 2 ** attempt + Math.floor(Math.random() * 80));
        await new Promise((r) => setTimeout(r, backoff));
        continue;
      }
      throw e;
    }
  }
  throw lastErr;
}

function splitFullName(fullName) {
  const value = String(fullName || '').trim();
  if (!value) return { firstName: null, lastName: null };

  const parts = value.split(/\s+/);
  return {
    firstName: parts[0] || null,
    lastName: parts.slice(1).join(' ') || null,
  };
}

function calculateExperienceYears(workExperiences) {
  if (!Array.isArray(workExperiences) || workExperiences.length === 0) return null;

  const totalMs = workExperiences.reduce((sum, item) => {
    const start = item?.startDate ? new Date(item.startDate).getTime() : null;
    const end = item?.isCurrentJob ? Date.now() : item?.endDate ? new Date(item.endDate).getTime() : Date.now();
    if (!start || Number.isNaN(start) || Number.isNaN(end) || end < start) return sum;
    return sum + (end - start);
  }, 0);

  if (!totalMs) return null;
  return Math.max(0, Math.round(totalMs / (1000 * 60 * 60 * 24 * 365)));
}

function splitResponsibilities(value) {
  const text = String(value || '').trim();
  if (!text) return [];

  return text
    .split(/\r?\n|[.;]\s+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function formatApplicationStatus(status) {
  const statusMap = {
    SUBMITTED: 'Applied',
    UNDER_REVIEW: 'Screening',
    SHORTLISTED: 'Shortlisted',
    ASSESSMENT: 'Assessment',
    INTERVIEW: 'Interview',
    FINAL_DECISION: 'Final Decision',
    SELECTED: 'Selected',
    REJECTED: 'Rejected',
  };

  return statusMap[status] || status || 'Submitted';
}

function normalizePipelineStageToken(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Applied / Submitted pipeline columns are behind a synced UNDER_REVIEW application row. */
function isEarlyPipelineStageName(name) {
  const n = normalizePipelineStageToken(name);
  if (!n) return true;
  return n.includes('applied') || n.includes('submit') || n === 'new';
}

/**
 * Prefer CRM-synced `Application.status` when the stored pipeline entry is still
 * on an early column (e.g. Applied) but the application enum already advanced.
 */
function pipelineStageAheadOfAppStatus(pipelineStageName, appStatus) {
  const pipelineText = String(pipelineStageName || '').trim();
  if (!pipelineText) return false;

  const appU = String(appStatus || '').toUpperCase();
  if (appU === 'UNDER_REVIEW') {
    return !isEarlyPipelineStageName(pipelineText);
  }
  if (appU === 'SUBMITTED') {
    return !isEarlyPipelineStageName(pipelineText);
  }
  return true;
}

function pipelineStageNamesEquivalent(stageA, stageB) {
  const a = normalizePipelineStageToken(stageA);
  const b = normalizePipelineStageToken(stageB);
  if (!a || !b) return false;
  if (a === b) return true;
  if (isEarlyPipelineStageName(a) && isEarlyPipelineStageName(b)) return true;
  return false;
}

function pipelineStageAlreadyRepresented(stageName, existingNames = []) {
  const target = String(stageName || '').trim();
  if (!target) return true;
  return existingNames.some((existing) => pipelineStageNamesEquivalent(existing, target));
}

/**
 * Derive the per-application "current pipeline stage" label using ONLY
 * per-application signals — never the global `candidate.stage`, which can
 * be stale or inherited from an unrelated job. Used by both
 * `getApplications` (list) and `getApplicationById` (detail) so the portal
 * card and the detail view always agree, and a freshly submitted Job B
 * never inherits "Rejected" from a previously-rejected Job A.
 */
function deriveApplicationPipelineStage({
  pipelineStageName,
  appStatus,
  matchStatus,
  timelineStatuses,
}) {
  const appU = String(appStatus || '').toUpperCase();
  const pipelineText = String(pipelineStageName || '').trim();
  if (pipelineText && pipelineStageAheadOfAppStatus(pipelineText, appStatus)) {
    return pipelineText;
  }

  if (appU === 'REJECTED') return 'Rejected';

  if (appU === 'SUBMITTED' && pipelineText) {
    const pipeNorm = normalizePipelineStageToken(pipelineText);
    if (pipeNorm.includes('applied') || pipeNorm.includes('submit')) {
      return pipeNorm.includes('applied') ? pipelineText : 'Applied';
    }
  }

  if (['INTERVIEW', 'SHORTLISTED', 'ASSESSMENT'].includes(appU)) {
    return formatApplicationStatus(appStatus);
  }

  if (Array.isArray(timelineStatuses)) {
    const latest = [...timelineStatuses]
      .map((s) => String(s || '').toUpperCase())
      .filter(Boolean);
    const lastStrong = [...latest]
      .reverse()
      .find((s) =>
        ['INTERVIEW', 'SHORTLISTED', 'ASSESSMENT', 'FINAL_DECISION', 'SELECTED'].includes(s)
      );
    if (lastStrong) return formatApplicationStatus(lastStrong);
    if (latest.includes('REJECTED')) return 'Rejected';
    const lastUnderReview = [...latest].reverse().find((s) => s === 'UNDER_REVIEW');
    if (lastUnderReview) return formatApplicationStatus(lastUnderReview);
  }

  if (appStatus) return formatApplicationStatus(appStatus);

  const matchU = String(matchStatus || '').toUpperCase();
  if (matchU) {
    if (matchU === 'REJECTED') return 'Rejected';
    if (matchU === 'HIRED' || matchU === 'PLACED') return 'Hired';
    if (matchU === 'OFFER' || matchU === 'OFFERED') return 'Offer';
    if (matchU === 'INTERVIEW' || matchU === 'INTERVIEWING' || matchU === 'INTERVIEW_SCHEDULED') {
      return 'Interview';
    }
    if (matchU === 'SHORTLISTED') return 'Shortlisted';
    if (matchU === 'REVIEWED') return 'Screening';
  }

  return 'Applied';
}

function formatMatchStatus(status) {
  const statusMap = {
    REVIEWED: 'Screening',
    SHORTLISTED: 'Shortlisted',
    INTERVIEW: 'Interview',
    INTERVIEWING: 'Interview',
    INTERVIEW_SCHEDULED: 'Interview',
    OFFER: 'Offer',
    OFFERED: 'Offer',
    PLACED: 'Hired',
    HIRED: 'Hired',
    REJECTED: 'Rejected',
  };
  return statusMap[String(status || '').toUpperCase()] || null;
}

/**
 * Compute the chip + progress label for ONE application row on the candidate
 * portal. Designed to be resilient to multi-job candidates and stale
 * application enums.
 *
 * Priority order:
 *   1. Application.status === REJECTED                      (per-application terminal)
 *   2. Any ApplicationTimeline entry with status REJECTED   (covers older CRM
 *      rejects that flipped the timeline but never the enum, and any reject
 *      flow without a `jobId`)
 *   3. Match.status === REJECTED                            (recruiter view)
 *   4. Per-job pipeline stage name containing "reject"
 *   5. Strong Application enum (INTERVIEW / FINAL_DECISION / etc.)
 *   6. Pipeline stage name / match text / candidate.stage   (display fallbacks)
 *
 * IMPORTANT: `candidate.stage` is a SINGLE field on the candidate row and gets
 * overwritten by the apply flow every time the candidate applies to a new job.
 * It therefore CANNOT be trusted to detect rejection on a specific older
 * application — only the per-application signals (1-4) are.
 */
function resolveApplicationDisplayStatus({
  appStatus,
  matchStatus,
  candidateStage,
  pipelineStageName,
  timelineStatuses,
}) {
  const appU = String(appStatus || '').toUpperCase();
  if (appU === 'REJECTED') {
    return formatApplicationStatus('REJECTED');
  }

  const strongApp = new Set(['INTERVIEW', 'FINAL_DECISION', 'SELECTED', 'SHORTLISTED', 'ASSESSMENT']);
  if (appStatus && strongApp.has(appU)) {
    return formatApplicationStatus(appStatus);
  }

  if (Array.isArray(timelineStatuses)) {
    const rejectedInTimeline = timelineStatuses.some(
      (s) => String(s || '').toUpperCase() === 'REJECTED'
    );
    if (rejectedInTimeline) {
      return formatApplicationStatus('REJECTED');
    }
  }

  const matchU = String(matchStatus || '').toUpperCase();
  if (matchU === 'REJECTED') {
    return formatMatchStatus(matchStatus) || 'Rejected';
  }

  const pipeLower = String(pipelineStageName || '').trim().toLowerCase();
  if (pipeLower.includes('reject')) {
    return pipelineStageName.trim();
  }

  if (appU === 'SUBMITTED' || appU === 'UNDER_REVIEW') {
    const pipeLooksTerminal =
      pipeLower.includes('hire') ||
      pipeLower.includes('placed') ||
      pipeLower.includes('joined') ||
      pipeLower.includes('onboard');
    if (pipeLooksTerminal) {
      return 'Applied';
    }
    const pipelineStageText = String(pipelineStageName || '').trim();
    if (pipelineStageText && pipelineStageAheadOfAppStatus(pipelineStageText, appStatus)) {
      return pipelineStageText;
    }
    if (appU === 'SUBMITTED' && pipelineStageText && isEarlyPipelineStageName(pipelineStageText)) {
      return normalizePipelineStageToken(pipelineStageText).includes('applied')
        ? pipelineStageText
        : formatApplicationStatus(appStatus);
    }
    if (Array.isArray(timelineStatuses)) {
      const lastUnderReview = [...timelineStatuses]
        .map((s) => String(s || '').toUpperCase())
        .filter(Boolean)
        .reverse()
        .find((s) => s === 'UNDER_REVIEW');
      if (lastUnderReview) return formatApplicationStatus(lastUnderReview);
    }
    return formatApplicationStatus(appStatus) || 'Applied';
  }

  const pipelineStageText = String(pipelineStageName || '').trim();
  if (pipelineStageText && pipelineStageAheadOfAppStatus(pipelineStageText, appStatus)) {
    return pipelineStageText;
  }

  const matchText = formatMatchStatus(matchStatus);
  if (matchText) return matchText;

  const stageText = String(candidateStage || '').trim();
  if (stageText) return stageText;

  return formatApplicationStatus(appStatus);
}

/**
 * Parse portal timeline description for interview rows (Phase 2 syncApplicationState stores lines here).
 */
/** Map Phase 2 / Prisma InterviewType-like tokens to candidate-friendly labels */
const INTERVIEW_TYPE_DISPLAY = new Map([
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
]);

function humanizeInterviewTypeLabel(raw) {
  const s = String(raw || '')
    .trim()
    .replace(/\s+/g, ' ');
  if (!s) return null;
  const upper = s.replace(/[\s_-]+/g, '_').toUpperCase();
  if (INTERVIEW_TYPE_DISPLAY.has(upper)) return INTERVIEW_TYPE_DISPLAY.get(upper);
  const compact = upper.replace(/_/g, '');
  for (const [k, v] of INTERVIEW_TYPE_DISPLAY) {
    if (k.replace(/_/g, '') === compact) return v;
  }
  const looksLikeEnum = /^[A-Z][A-Z0-9_]*$/i.test(s.replace(/\s+/g, '')) && /^[A-Z0-9 _-]+$/i.test(s);
  if (looksLikeEnum) {
    return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }
  return s;
}

function parseInterviewDetailsFromDescription(description, title) {
  const text = `${String(description || '')}\n${String(title || '')}`;
  const linkMatch = text.match(/https?:\/\/[^\s]+/i);
  const meetingLink = linkMatch ? linkMatch[0].replace(/[),.;]+$/, '') : null;
  let location = null;
  const locLine = text.split(/\r?\n/).find((l) => /^location\s*:/i.test(l.trim()));
  if (locLine) location = locLine.replace(/^location\s*:/i, '').trim();
  const whenLine = text.split(/\r?\n/).find((l) => /^when\s*:/i.test(l.trim()));
  let scheduledAt = null;
  if (whenLine) {
    const raw = whenLine.replace(/^when\s*:/i, '').trim();
    const d = new Date(raw);
    if (!Number.isNaN(d.getTime())) scheduledAt = d.toISOString();
  }

  let typeFromLine = null;
  const typeLine = text.split(/\r?\n/).find((l) => /^type\s*:/i.test(l.trim()));
  if (typeLine) typeFromLine = typeLine.replace(/^type\s*:/i, '').trim() || null;

  let recruiterRound = null;
  const desc = String(description || '');
  const recruiterMatch = desc.match(/Recruiter scheduled\s+([^.]+\.?)/i);
  if (recruiterMatch) recruiterRound = recruiterMatch[1].replace(/\.$/, '').trim();

  // Names of the assigned interviewer(s) and recruiter who scheduled — written by
  // backendphase2 `buildInterviewTimelineDescription` as `Interviewer: A, B` and `Recruiter: C`.
  let interviewerNames = [];
  const interviewerLine = text.split(/\r?\n/).find((l) => /^interviewer(s)?\s*:/i.test(l.trim()));
  if (interviewerLine) {
    interviewerNames = interviewerLine
      .replace(/^interviewer(s)?\s*:/i, '')
      .split(/[,;|]/)
      .map((name) => name.trim())
      .filter(Boolean);
  }

  let recruiterName = null;
  const recruiterLine = text.split(/\r?\n/).find((l) => /^recruiter\s*:/i.test(l.trim()));
  if (recruiterLine) {
    recruiterName = recruiterLine.replace(/^recruiter\s*:/i, '').trim() || null;
  }

  let outcome = null;
  const outcomeLine = text.split(/\r?\n/).find((l) => /^outcome\s*:/i.test(l.trim()));
  if (outcomeLine) {
    outcome = outcomeLine.replace(/^outcome\s*:/i, '').trim() || null;
  }

  let recommendationLabel = null;
  const recommendationLine = text.split(/\r?\n/).find((l) => /^recommendation\s*:/i.test(l.trim()));
  if (recommendationLine) {
    recommendationLabel = recommendationLine.replace(/^recommendation\s*:/i, '').trim() || null;
  }

  let remark = null;
  const remarkLine = text.split(/\r?\n/).find((l) => /^remark\s*:/i.test(l.trim()));
  if (remarkLine) {
    remark = remarkLine.replace(/^remark\s*:/i, '').trim() || null;
  }

  let overallRating = null;
  const ratingLine = text.split(/\r?\n/).find((l) => /^overall rating\s*:/i.test(l.trim()));
  if (ratingLine) {
    const ratingMatch = ratingLine.match(/(\d+(?:\.\d+)?)\s*\/\s*5/i);
    if (ratingMatch) overallRating = Number(ratingMatch[1]);
  }

  const technicalScore = parseCategoryScoreFromText(text, /^technical skills?\s*:/i);
  const communicationScore = parseCategoryScoreFromText(text, /^communication\s*:/i);
  const problemSolvingScore = parseCategoryScoreFromText(text, /^problem solving\s*:/i);
  const cultureFitScore = parseCategoryScoreFromText(text, /^culture fit\s*:/i);
  const experienceMatchScore = parseCategoryScoreFromText(text, /^experience match\s*:/i);
  const strengths = parseInterviewTextField(text, 'Strengths');
  const weaknesses = parseInterviewTextField(text, 'Weaknesses');

  let explicitRound = null;
  const roundLine = text.split(/\r?\n/).find((l) => /^round\s*:/i.test(l.trim()));
  if (roundLine) {
    explicitRound = roundLine.replace(/^round\s*:/i, '').trim() || null;
  }

  return {
    meetingLink,
    location,
    scheduledAt,
    interviewType: typeFromLine,
    recruiterRound,
    interviewerNames,
    recruiterName,
    outcome,
    recommendationLabel,
    remark,
    overallRating,
    technicalScore,
    communicationScore,
    problemSolvingScore,
    cultureFitScore,
    experienceMatchScore,
    strengths,
    weaknesses,
    explicitRound,
  };
}

function interviewRoundLabelsEquivalent(a, b) {
  const normalize = (value) =>
    String(value || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .replace(/\bround\s*\d+\b/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  const left = normalize(a);
  const right = normalize(b);
  if (!left || !right) return false;
  if (left === right) return true;
  const stripHr = (value) => value.replace(/^hr\s+/, '').trim();
  if (stripHr(left) === stripHr(right)) return true;
  return left.includes(right) || right.includes(left);
}

function interviewRoundFeedbackRichness(round = {}) {
  let score = 0;
  if (round.technicalScore != null) score += 12;
  if (round.communicationScore != null) score += 8;
  if (round.problemSolvingScore != null) score += 8;
  if (round.cultureFitScore != null) score += 8;
  if (round.experienceMatchScore != null) score += 8;
  if (round.overallRating != null || round.overallScore != null) score += 6;
  if (round.strengths) score += 5;
  if (round.weaknesses) score += 5;
  if (round.recommendationLabel || round.outcome) score += 3;
  if (round.comments || round.remark) score += 2;
  return score;
}

function pickRichestInterviewOutcome(candidates = []) {
  const list = (candidates || []).filter(Boolean);
  if (!list.length) return null;
  return [...list].sort(
    (a, b) => interviewRoundFeedbackRichness(b) - interviewRoundFeedbackRichness(a)
  )[0];
}

function parseCategoryScoreFromText(text, labelPattern) {
  const line = String(text || '')
    .split(/\r?\n/)
    .find((entry) => labelPattern.test(entry.trim()));
  if (!line) return null;
  const match = line.match(/(\d+(?:\.\d+)?)\s*\/\s*5/i);
  return match ? Number(match[1]) : null;
}

function parseInterviewTextField(text, label) {
  const line = String(text || '')
    .split(/\r?\n/)
    .find((entry) => new RegExp(`^${label}\\s*:`, 'i').test(entry.trim()));
  if (!line) return null;
  const value = line.replace(new RegExp(`^${label}\\s*:`, 'i'), '').trim();
  return value || null;
}

function findInterviewOutcomeMatchIndex(rounds, stored, allOutcomes = []) {
  const roundLabel = stored?.roundLabel || null;
  const interviewId = stored?.interviewId ? String(stored.interviewId) : null;

  if (interviewId) {
    const byInterviewId = rounds.findIndex(
      (round) => round?.interviewId && String(round.interviewId) === interviewId
    );
    if (byInterviewId >= 0) return byInterviewId;
  }

  if (roundLabel) {
    const byLabel = rounds.findIndex((round) =>
      interviewRoundLabelsEquivalent(round.roundLabel, roundLabel)
    );
    if (byLabel >= 0) return byLabel;
  }

  if (rounds.length === 1) return 0;

  const incompleteIdx = rounds.findIndex((round) => !round.isCompleted);
  if (incompleteIdx >= 0 && allOutcomes.length === 1) return incompleteIdx;

  return -1;
}

function mergePhase2OutcomesIntoPortal(storedOutcomes = [], phase2Outcomes = []) {
  if (!phase2Outcomes.length) return storedOutcomes;
  if (!storedOutcomes.length) return phase2Outcomes;

  const next = storedOutcomes.map((stored) => {
    const match = pickRichestInterviewOutcome(
      phase2Outcomes.filter(
        (entry) =>
          (stored?.interviewId &&
            String(entry?.interviewId || '') === String(stored.interviewId)) ||
          interviewRoundLabelsEquivalent(stored?.roundLabel, entry?.roundLabel)
      )
    );
    if (!match) return stored;
    return {
      ...stored,
      ...match,
      completedAt: match.completedAt || stored.completedAt || null,
    };
  });

  for (const entry of phase2Outcomes) {
    const exists = next.some(
      (stored) =>
        (entry?.interviewId &&
          String(stored?.interviewId || '') === String(entry.interviewId)) ||
        interviewRoundLabelsEquivalent(stored?.roundLabel, entry?.roundLabel)
    );
    if (!exists) next.push(entry);
  }

  return next;
}

function interviewOutcomeNeedsPhase2Backfill(outcome = {}) {
  return (
    outcome.technicalScore == null &&
    outcome.communicationScore == null &&
    outcome.problemSolvingScore == null &&
    outcome.cultureFitScore == null &&
    outcome.experienceMatchScore == null &&
    !outcome.strengths &&
    !outcome.weaknesses
  );
}

const PHASE2_FETCH_TIMEOUT_MS = Number(process.env.PHASE2_PORTAL_FETCH_TIMEOUT_MS || 4000);

async function fetchPhase2Internal(url, body) {
  const base =
    process.env.PHASE2_INTERNAL_API_URL ||
    process.env.PHASE2_API_URL ||
    process.env.PHASE2_BASE_URL ||
    'http://localhost:5001';
  const secret =
    process.env.PHASE2_PORTAL_SYNC_SECRET || 'phase2-portal-sync-2026-shared-secret';
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PHASE2_FETCH_TIMEOUT_MS);

  try {
    return await fetch(`${String(base).replace(/\/$/, '')}${url}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-phase2-portal-sync-secret': secret,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

async function fetchPhase2PortalInterviewFeedback({
  tenantDbName,
  candidateId,
  jobId,
  interviewIds = [],
}) {
  const res = await fetchPhase2Internal('/api/v1/internal/portal-interview-feedback-lookup', {
    tenantDbName,
    candidateId,
    jobId,
    interviewIds,
    repairPortal: false,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    console.warn('[Application] Phase2 interview feedback lookup failed:', res.status, text);
    return [];
  }

  const payload = await res.json().catch(() => null);
  return Array.isArray(payload?.data) ? payload.data : [];
}

async function fetchPhase2PortalInterviewRounds({ tenantDbName, candidateId, jobId }) {
  const res = await fetchPhase2Internal('/api/v1/internal/portal-interview-rounds-lookup', {
    tenantDbName,
    candidateId,
    jobId,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    console.warn('[Application] Phase2 interview rounds lookup failed:', res.status, text);
    return [];
  }

  const payload = await res.json().catch(() => null);
  return Array.isArray(payload?.data) ? payload.data : [];
}

function mergeInterviewRoundsWithPhase2(timelineRounds, phase2Rounds, interviewOutcomes = []) {
  if (!Array.isArray(phase2Rounds) || phase2Rounds.length === 0) {
    return reconcileInterviewRounds(timelineRounds);
  }

  const outcomeByInterviewId = new Map();
  for (const outcome of interviewOutcomes) {
    if (outcome?.interviewId) {
      outcomeByInterviewId.set(String(outcome.interviewId), outcome);
    }
  }

  const timelineByInterviewId = new Map();
  for (const round of timelineRounds || []) {
    if (round?.interviewId) {
      timelineByInterviewId.set(String(round.interviewId), round);
    }
  }

  const merged = phase2Rounds.map((phase2) => {
    const interviewId = phase2?.interviewId ? String(phase2.interviewId) : null;
    const outcome = interviewId ? outcomeByInterviewId.get(interviewId) : null;
    let timeline =
      (interviewId ? timelineByInterviewId.get(interviewId) : null) ||
      (timelineRounds || []).find((round) =>
        interviewRoundLabelsEquivalent(round?.roundLabel, phase2?.roundLabel)
      ) ||
      null;

    let round = {
      interviewId,
      timelineId: timeline?.timelineId || null,
      timelineTitle: timeline?.timelineTitle || phase2.roundLabel || 'Interview',
      scheduledAt: phase2.scheduledAt || timeline?.scheduledAt || null,
      roundLabel: phase2.roundLabel || timeline?.roundLabel || null,
      format: timeline?.format || null,
      meetingLink: phase2.meetingLink || timeline?.meetingLink || null,
      location: phase2.location || timeline?.location || null,
      notes: timeline?.notes || null,
      interviewerNames: Array.isArray(timeline?.interviewerNames) ? timeline.interviewerNames : [],
      recruiterName: timeline?.recruiterName || null,
      isCompleted: Boolean(phase2.isCompleted || timeline?.isCompleted),
      outcome: timeline?.outcome || null,
      remark: timeline?.remark || null,
      overallRating: timeline?.overallRating ?? null,
      completedAt: timeline?.completedAt || null,
    };

    if (outcome) {
      round = applyInterviewOutcomeToRound(round, {
        ...outcome,
        roundLabel: phase2.roundLabel || outcome.roundLabel,
      });
    }

    return round;
  });

  return sortInterviewRoundsChronologically(reconcileInterviewRounds(merged));
}

function sortInterviewRoundsChronologically(rounds) {
  return [...(rounds || [])].sort((a, b) => {
    const aTime = a?.scheduledAt ? new Date(a.scheduledAt).getTime() : 0;
    const bTime = b?.scheduledAt ? new Date(b.scheduledAt).getTime() : 0;
    return aTime - bTime;
  });
}

async function enrichInterviewOutcomesForPortal({
  interviewOutcomes,
  candidateId,
  jobId,
  tenantDbName,
}) {
  const stored = Array.isArray(interviewOutcomes) ? interviewOutcomes : [];
  if (!tenantDbName || !candidateId || !jobId) {
    return stored;
  }

  try {
    const interviewIds = stored.map((entry) => entry?.interviewId).filter(Boolean);
    const phase2Outcomes = await fetchPhase2PortalInterviewFeedback({
      tenantDbName,
      candidateId,
      jobId,
      interviewIds,
    });
    const merged = mergePhase2OutcomesIntoPortal(stored, phase2Outcomes);
    if (merged.length) return merged;
    return phase2Outcomes;
  } catch (error) {
    console.warn(
      '[Application] Phase2 interview feedback enrich failed:',
      error?.message || error
    );
    return stored;
  }
}

function parseRejectionDescriptionText(description) {
  const text = String(description || '').trim();
  if (!text) return { reason: null, feedback: null };

  const reasonLine = text.split(/\r?\n/).find((line) => /^reason\s*:/i.test(line.trim()));
  const feedbackLine = text.split(/\r?\n/).find((line) => /^feedback\s*:/i.test(line.trim()));

  if (reasonLine || feedbackLine) {
    return {
      reason: reasonLine ? reasonLine.replace(/^reason\s*:/i, '').trim() || null : null,
      feedback: feedbackLine ? feedbackLine.replace(/^feedback\s*:/i, '').trim() || null : null,
    };
  }

  const legacyParts = text.split(' — ').map((part) => part.trim()).filter(Boolean);
  if (legacyParts.length >= 2) {
    return {
      reason: legacyParts[0] || null,
      feedback: legacyParts.slice(1).join(' — ') || null,
    };
  }

  return { reason: null, feedback: text };
}

function isRejectedTimelineEntry(row) {
  const blob = `${row?.status || ''} ${row?.title || ''}`.toLowerCase();
  return blob.includes('reject') || blob.includes('not selected');
}

function buildRejectionDetailsForApplication({
  applicationStatus,
  statusCode,
  storedRejection = {},
  rawTimeline = [],
}) {
  const status = String(applicationStatus || '').toLowerCase();
  const code = String(statusCode || '').toUpperCase();
  const looksRejected =
    code === 'REJECTED' || (status.includes('reject') && !status.includes('offer'));

  let reason = storedRejection.reason || null;
  let feedback = storedRejection.feedback || null;
  let sharedAt = storedRejection.sharedAt || null;

  const rejectionRows = rawTimeline
    .filter((row) => isRejectedTimelineEntry(row))
    .sort((a, b) => new Date(b.occurredAt) - new Date(a.occurredAt));

  const latest = rejectionRows[0];
  if (latest) {
    const parsed = parseRejectionDescriptionText(latest.description);
    reason = reason || parsed.reason || null;
    feedback = feedback || parsed.feedback || null;
    sharedAt =
      sharedAt ||
      (latest.occurredAt ? new Date(latest.occurredAt).toISOString() : null);
  }

  if (!reason && !feedback) {
    return null;
  }

  return {
    reason,
    feedback,
    sharedAt,
    title: latest?.title || 'Not selected',
  };
}

function applyInterviewOutcomeToRound(round, outcomeEntry = {}) {
  if (!outcomeEntry || typeof outcomeEntry !== 'object') return round;
  return {
    ...round,
    isCompleted: true,
    outcome: outcomeEntry.outcome || round.outcome || null,
    recommendationLabel: outcomeEntry.recommendationLabel || round.recommendationLabel || null,
    remark: outcomeEntry.remark || outcomeEntry.comments || round.remark || null,
    comments: outcomeEntry.comments || outcomeEntry.remark || round.comments || null,
    companyName: outcomeEntry.companyName || round.companyName || null,
    technicalScore:
      outcomeEntry.technicalScore != null ? Number(outcomeEntry.technicalScore) : round.technicalScore ?? null,
    communicationScore:
      outcomeEntry.communicationScore != null
        ? Number(outcomeEntry.communicationScore)
        : round.communicationScore ?? null,
    problemSolvingScore:
      outcomeEntry.problemSolvingScore != null
        ? Number(outcomeEntry.problemSolvingScore)
        : round.problemSolvingScore ?? null,
    cultureFitScore:
      outcomeEntry.cultureFitScore != null ? Number(outcomeEntry.cultureFitScore) : round.cultureFitScore ?? null,
    experienceMatchScore:
      outcomeEntry.experienceMatchScore != null
        ? Number(outcomeEntry.experienceMatchScore)
        : round.experienceMatchScore ?? null,
    strengths: outcomeEntry.strengths ?? round.strengths ?? null,
    weaknesses: outcomeEntry.weaknesses ?? round.weaknesses ?? null,
    overallRating:
      outcomeEntry.overallScore != null
        ? Number(outcomeEntry.overallScore)
        : outcomeEntry.overallRating != null
          ? Number(outcomeEntry.overallRating)
          : round.overallRating ?? null,
    completedAt: outcomeEntry.completedAt || round.completedAt || null,
  };
}

/** CRM pipeline stage moves — not a recruiter-scheduled interview with date/time/panel. */
function isGenericPipelineStageInterviewRow(item) {
  const title = String(item?.title || '').trim().toLowerCase();
  const desc = String(item?.description || '').trim().toLowerCase();
  if (desc === 'interviewing stage' || desc === 'interview stage') return true;
  if (
    (title === 'interviewing' || title === 'interview') &&
    !desc.includes('when:') &&
    !desc.includes('type:') &&
    !desc.includes('interviewer:') &&
    !desc.includes('meeting link:') &&
    !/recruiter scheduled/i.test(desc)
  ) {
    return true;
  }
  return false;
}

function buildInterviewRoundsFromTimeline(rawTimeline, interviewOutcomes = []) {
  const rows = (rawTimeline || [])
    .filter((item) => String(item?.status || '').toUpperCase() === 'INTERVIEW')
    .sort((a, b) => new Date(a.occurredAt) - new Date(b.occurredAt));

  const scheduledRows = rows
    .filter((item) => !/interview completed/i.test(String(item.title || '')))
    .filter((item) => !isGenericPipelineStageInterviewRow(item));
  const completedRows = rows.filter((item) => /interview completed/i.test(String(item.title || '')));
  const total = scheduledRows.length;

  const rounds = scheduledRows.map((item, index) => {
    const parsed = parseInterviewDetailsFromDescription(item.description, item.title);
    const fromType = humanizeInterviewTypeLabel(parsed.interviewType);
    const fromRecruiter = humanizeInterviewTypeLabel(parsed.recruiterRound);
    const titleRaw = String(item.title || '').trim();
    const titleOK = titleRaw && !/^interview$/i.test(titleRaw);

    let roundLabel = fromType || fromRecruiter || (titleOK ? humanizeInterviewTypeLabel(titleRaw) : null);

    if (!roundLabel && total > 1) {
      roundLabel = `Round ${index + 1} of ${total}`;
    }

    return {
      timelineId: item.id,
      timelineTitle: item.title || 'Interview',
      scheduledAt: parsed.scheduledAt || (item.occurredAt ? new Date(item.occurredAt).toISOString() : null),
      roundLabel: roundLabel || null,
      format: null,
      meetingLink: parsed.meetingLink,
      location: parsed.location,
      notes: item.description || null,
      interviewerNames: Array.isArray(parsed.interviewerNames) ? parsed.interviewerNames : [],
      recruiterName: parsed.recruiterName || null,
      isCompleted: false,
      outcome: null,
      remark: null,
      overallRating: null,
      completedAt: null,
    };
  });

  for (const item of completedRows) {
    const parsed = parseInterviewDetailsFromDescription(item.description, item.title);
    const titleRaw = String(item.title || '').trim();
    const roundFromTitle = titleRaw.replace(/^interview completed\s*[—-]\s*/i, '').trim();
    const roundLabel = humanizeInterviewTypeLabel(
      parsed.explicitRound || roundFromTitle || parsed.recruiterRound || parsed.interviewType || null
    );
    const outcomeEntry = {
      outcome: parsed.outcome,
      recommendationLabel: parsed.recommendationLabel,
      remark: parsed.remark,
      overallRating: parsed.overallRating,
      technicalScore: parsed.technicalScore,
      communicationScore: parsed.communicationScore,
      problemSolvingScore: parsed.problemSolvingScore,
      cultureFitScore: parsed.cultureFitScore,
      experienceMatchScore: parsed.experienceMatchScore,
      strengths: parsed.strengths,
      weaknesses: parsed.weaknesses,
      completedAt: item.occurredAt ? new Date(item.occurredAt).toISOString() : null,
      roundLabel,
    };

    const matchIdx = rounds.findIndex((round) =>
      interviewRoundLabelsEquivalent(round.roundLabel, roundLabel)
    );
    if (matchIdx >= 0) {
      rounds[matchIdx] = applyInterviewOutcomeToRound(rounds[matchIdx], outcomeEntry);
    } else {
      rounds.push({
        timelineId: item.id,
        timelineTitle: titleRaw || 'Interview completed',
        scheduledAt: item.occurredAt ? new Date(item.occurredAt).toISOString() : null,
        roundLabel: roundLabel || 'Interview',
        format: null,
        meetingLink: null,
        location: null,
        notes: item.description || null,
        interviewerNames: [],
        recruiterName: null,
        ...applyInterviewOutcomeToRound({}, outcomeEntry),
      });
    }
  }

  for (const stored of interviewOutcomes) {
    const roundLabel = stored?.roundLabel || null;
    if (!roundLabel && !stored?.interviewId) continue;
    const matchIdx = findInterviewOutcomeMatchIndex(rounds, stored, interviewOutcomes);
    const outcomeEntry = {
      interviewId: stored.interviewId ? String(stored.interviewId) : null,
      outcome: stored.outcome,
      recommendationLabel: stored.recommendationLabel,
      remark: stored.remark,
      comments: stored.comments || stored.remark,
      overallScore: stored.overallScore,
      overallRating: stored.overallRating,
      companyName: stored.companyName,
      technicalScore: stored.technicalScore,
      communicationScore: stored.communicationScore,
      problemSolvingScore: stored.problemSolvingScore,
      cultureFitScore: stored.cultureFitScore,
      experienceMatchScore: stored.experienceMatchScore,
      strengths: stored.strengths,
      weaknesses: stored.weaknesses,
      completedAt: stored.completedAt,
      roundLabel: roundLabel || stored.roundLabel || 'Interview',
    };
    if (matchIdx >= 0) {
      rounds[matchIdx] = applyInterviewOutcomeToRound(rounds[matchIdx], outcomeEntry);
    } else {
      rounds.push({
        timelineId: null,
        timelineTitle: `Interview completed — ${roundLabel}`,
        scheduledAt: stored.completedAt || null,
        roundLabel,
        format: null,
        meetingLink: null,
        location: null,
        notes: stored.remark || null,
        interviewerNames: [],
        recruiterName: null,
        ...applyInterviewOutcomeToRound({}, outcomeEntry),
      });
    }
  }

  return sortInterviewRoundsChronologically(reconcileInterviewRounds(rounds));
}

/** Merge completed-only rounds onto scheduled rounds when labels differ (e.g. "Interviewing" vs "Technical round"). */
function reconcileInterviewRounds(rounds) {
  if (!Array.isArray(rounds) || rounds.length <= 1) return rounds || [];

  const scheduled = rounds.filter((round) => !round.isCompleted);
  const completed = rounds.filter((round) => round.isCompleted);
  if (!completed.length) return rounds;

  if (!scheduled.length) {
    return completed.sort((a, b) => {
      const aTime = a.scheduledAt ? new Date(a.scheduledAt).getTime() : 0;
      const bTime = b.scheduledAt ? new Date(b.scheduledAt).getTime() : 0;
      return aTime - bTime;
    });
  }

  const merged = scheduled.map((sched) => {
    const labelMatch = completed.find((comp) =>
      interviewRoundLabelsEquivalent(sched.roundLabel, comp.roundLabel)
    );
    if (!labelMatch) return sched;
    return applyInterviewOutcomeToRound(sched, labelMatch);
  });

  for (const comp of completed) {
    const alreadyMerged = merged.some(
      (round) =>
        round.isCompleted &&
        interviewRoundLabelsEquivalent(round.roundLabel, comp.roundLabel)
    );
    if (!alreadyMerged && interviewRoundFeedbackRichness(comp) > 0) {
      merged.push(comp);
    }
  }

  return sortInterviewRoundsChronologically(merged);
}

function formatSalaryText(job) {
  const salary = job?.salary;
  if (salary && typeof salary === 'object') {
    if (salary.amount) return String(salary.amount);
    if (salary.min && salary.max) {
      const currency = salary.currency || '';
      const type = salary.type ? `/${String(salary.type).toLowerCase()}` : '';
      return `${currency}${salary.min} - ${currency}${salary.max}${type}`;
    }
  }

  if (job?.salaryMin && job?.salaryMax) {
    const currency = job.salaryCurrency || '';
    const type = job.salaryType ? `/${String(job.salaryType).toLowerCase()}` : '';
    return `${currency}${job.salaryMin} - ${currency}${job.salaryMax}${type}`;
  }

  return 'Not specified';
}

function normalizePortfolioLinks(links) {
  if (!Array.isArray(links)) return [];

  return links
    .map((item) => {
      if (typeof item === 'string') {
        const url = item.trim();
        return url ? { type: 'Link', url } : null;
      }

      if (!item || typeof item !== 'object') return null;
      const url = String(item.url || item.link || '').trim();
      if (!url) return null;

      return {
        type: String(item.type || item.label || 'Link').trim() || 'Link',
        url,
      };
    })
    .filter(Boolean);
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeResumeSkills(skills) {
  return asArray(skills)
    .map((item) => {
      if (typeof item === 'string') return item.trim();
      if (!item || typeof item !== 'object') return '';
      return String(item.name || item.skill || item.title || item.languageName || '').trim();
    })
    .filter(Boolean);
}

function normalizeResumeLanguages(languages) {
  return asArray(languages)
    .map((item) => {
      if (typeof item === 'string') return item.trim();
      if (!item || typeof item !== 'object') return '';
      return String(item.name || item.language || item.languageName || '').trim();
    })
    .filter(Boolean);
}

function normalizeResumeEducationEntries(entries) {
  return asArray(entries)
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      return {
        degree: String(item.degree || item.educationLevel || item.title || '').trim() || null,
        institution: String(item.institution || item.school || item.college || '').trim() || null,
        startYear: item.startYear || item.start_date || item.from || null,
        endYear: item.endYear || item.end_date || item.to || null,
      };
    })
    .filter(Boolean);
}

function normalizeResumeWorkEntries(entries) {
  return asArray(entries)
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      return {
        title: String(item.title || item.jobTitle || item.role || '').trim() || null,
        company: String(item.company || item.organization || '').trim() || null,
        location: String(item.location || item.workLocation || '').trim() || null,
        startDate: String(item.startDate || item.start_date || item.from || '').trim() || null,
        endDate: String(item.endDate || item.end_date || item.to || '').trim() || null,
        responsibilities: splitResponsibilities(
          Array.isArray(item.responsibilities) ? item.responsibilities.join('. ') : item.responsibilities || item.description || ''
        ),
      };
    })
    .filter(Boolean);
}

async function syncApplicationToRecruiterView(candidateId, job) {
  const tailoredCv = await loadTailoredCvForJob(candidateId, job.id);
  const tailoredFields = tailoredCv?.draft
    ? mapLmsDraftToRecruiterCvFields(tailoredCv.draft, {
        templateId: tailoredCv.templateId,
        jobTitle: tailoredCv.jobTitle || job.title,
        company: tailoredCv.company,
        resumeHtml: tailoredCv.resumeHtml,
        avatarUrl: tailoredCv.avatarUrl,
      })
    : null;

  const candidate = await prisma.candidate.findUnique({
    where: { id: candidateId },
    include: {
      profile: true,
      resume: true,
      summary: true,
      portfolioLinks: true,
      educations: {
        orderBy: [{ endYear: 'desc' }, { startYear: 'desc' }],
        take: 3,
      },
      skills: {
        include: {
          skill: {
            select: { name: true },
          },
        },
      },
      languages: true,
      workExperiences: {
        orderBy: { startDate: 'desc' },
      },
      careerPreferences: true,
    },
  });

  if (!candidate) return;

  const resumeJson =
    candidate.resume?.resumeJson && typeof candidate.resume.resumeJson === 'object'
      ? candidate.resume.resumeJson
      : {};
  const { firstName, lastName } = splitFullName(candidate.profile?.fullName);
  const latestWork = candidate.workExperiences?.[0];
  const educationSummary = candidate.educations?.[0]
    ? [candidate.educations[0].degree, candidate.educations[0].specialization].filter(Boolean).join(' - ')
    : null;
  const recruiterSkills = (candidate.skills || []).map((item) => item.skill?.name).filter(Boolean);
  const recruiterLanguages = (candidate.languages || []).map((item) => item.name).filter(Boolean);
  const resumeSkills = normalizeResumeSkills(resumeJson.skills);
  const resumeLanguages = normalizeResumeLanguages(resumeJson.languages);
  const assignedJobs = Array.from(new Set([...(candidate.assignedJobs || []), job.id]));
  const cvEducationEntries = (candidate.educations || []).map((item) => ({
    degree: item.degree || null,
    institution: item.institution || null,
    startYear: item.startYear || null,
    endYear: item.endYear || (item.isOngoing ? 'Present' : null),
  }));
  const cvWorkExperienceEntries = (candidate.workExperiences || []).map((item) => ({
    title: item.jobTitle || null,
    company: item.company || null,
    location: item.workLocation || null,
    startDate: item.startDate ? new Date(item.startDate).toISOString().split('T')[0] : null,
    endDate: item.isCurrentJob ? 'Present' : item.endDate ? new Date(item.endDate).toISOString().split('T')[0] : null,
    responsibilities: splitResponsibilities(item.responsibilities),
  }));
  const cvPortfolioLinks = normalizePortfolioLinks(candidate.portfolioLinks?.links);
  const fallbackEducationEntries = normalizeResumeEducationEntries(resumeJson.education);
  const fallbackWorkEntries = normalizeResumeWorkEntries(
    resumeJson.workExperience || resumeJson.experience
  );
  const resumePersonalInfo = resumeJson.personalInformation || resumeJson.personalInfo || {};
  const resumeSummary = String(resumeJson.summary || '').trim() || null;
  const resumeCertifications = asArray(resumeJson.certifications)
    .map((item) => (typeof item === 'string' ? item.trim() : String(item?.name || item?.title || '').trim()))
    .filter(Boolean);

  // Stage-flip policy on a fresh portal apply (mirrors backendphase2
  // applyPortalApplicationSync — keep the two backends in agreement):
  //  • Rejected → Applied  ✅ (re-activate the candidate; lifetime activity
  //    log stays intact because Activity rows are append-only on entityId).
  //  • Hired / Placed / Joined / Onboarded → keep terminal (positive
  //    outcomes must NOT silently regress just because the candidate
  //    browsed a new posting; per-application status chips remain correct
  //    via the per-Application enum and per-app pipelineStage anyway).
  //  • Anything else → Applied.
  const previousStageLower = String(candidate.stage || '').trim().toLowerCase();
  const stageIsPositiveTerminal =
    previousStageLower.includes('hire') ||
    previousStageLower === 'placed' ||
    previousStageLower === 'joined' ||
    previousStageLower === 'onboarded';
  const nextStage = stageIsPositiveTerminal ? candidate.stage : 'Applied';

  await prisma.candidate.update({
    where: { id: candidateId },
    data: {
      firstName: firstName || resumePersonalInfo.fullName?.split?.(' ')?.[0] || candidate.firstName || null,
      lastName:
        lastName ||
        (typeof resumePersonalInfo.fullName === 'string'
          ? resumePersonalInfo.fullName.split(' ').slice(1).join(' ') || null
          : null) ||
        candidate.lastName ||
        null,
      email: candidate.profile?.email || candidate.email || resumePersonalInfo.email || null,
      phone: candidate.profile?.phoneNumber || candidate.whatsappNumber || candidate.phone || resumePersonalInfo.phoneNumber || null,
      linkedIn: candidate.profile?.linkedinUrl || candidate.linkedIn || resumePersonalInfo.linkedinUrl || null,
      resumeUrl: candidate.resume?.fileUrl || candidate.resumeUrl || null,
      recruiterSkills: tailoredFields?.recruiterSkills?.length
        ? tailoredFields.recruiterSkills
        : recruiterSkills.length
          ? recruiterSkills
          : resumeSkills,
      experienceYears: calculateExperienceYears(candidate.workExperiences),
      currentTitle:
        tailoredFields?.currentTitle || latestWork?.jobTitle || candidate.currentTitle || null,
      currentCompany: latestWork?.company || candidate.currentCompany || null,
      location: latestWork?.workLocation || candidate.location || candidate.profile?.city || resumePersonalInfo.city || null,
      addressLine: candidate.profile?.address || candidate.addressLine || resumePersonalInfo.address || null,
      city: candidate.profile?.city || candidate.city || resumePersonalInfo.city || null,
      country: candidate.profile?.country || candidate.country || resumePersonalInfo.country || null,
      recruiterStatus: 'ACTIVE',
      source: candidate.source || 'Job Portal Application',
      availability: candidate.careerPreferences?.availabilityToStart || candidate.availability || null,
      noticePeriod: candidate.careerPreferences?.noticePeriod || candidate.noticePeriod || null,
      avatar: candidate.profile?.profilePhotoUrl || candidate.avatar || null,
      designation: latestWork?.jobTitle || candidate.designation || null,
      expectedSalary: candidate.careerPreferences?.preferredSalary || candidate.expectedSalary || null,
      currentSalary: candidate.careerPreferences?.currentSalary || candidate.currentSalary || null,
      recruiterEducation: educationSummary || candidate.recruiterEducation || fallbackEducationEntries[0]?.degree || null,
      recruiterLanguages: recruiterLanguages.length ? recruiterLanguages : resumeLanguages,
      certificationsList: resumeCertifications,
      cvSummary:
        tailoredFields?.cvSummary ||
        candidate.summary?.summaryText ||
        candidate.cvSummary ||
        resumeSummary,
      cvEducationEntries: tailoredFields?.cvEducationEntries?.length
        ? tailoredFields.cvEducationEntries
        : cvEducationEntries.length
          ? cvEducationEntries
          : fallbackEducationEntries,
      cvWorkExperienceEntries: tailoredFields?.cvWorkExperienceEntries?.length
        ? tailoredFields.cvWorkExperienceEntries
        : cvWorkExperienceEntries.length
          ? cvWorkExperienceEntries
          : fallbackWorkEntries,
      cvPortfolioLinks,
      preferredLocation:
        candidate.careerPreferences?.preferredLocations?.[0] ||
        candidate.profile?.city ||
        candidate.profile?.country ||
        candidate.preferredLocation ||
        null,
      assignedJobs,
      stage: nextStage,
      lastActivity: new Date(),
    },
  });

  scheduleCandidateCommonSync(candidateId);

  const existingMatch = await prisma.match.findFirst({
    where: { candidateId, jobId: job.id },
    select: { id: true },
  });

  if (!existingMatch) {
    await prisma.match.create({
      data: {
        candidateId,
        jobId: job.id,
        score: 75,
        status: 'REVIEWED',
        notes: 'Applied from candidate portal',
        createdById: job.createdById || job.assignedToId || undefined,
      },
    });
  }

  const firstStage = await prisma.pipelineStage.findFirst({
    where: { jobId: job.id },
    orderBy: { order: 'asc' },
    select: { id: true },
  });

  if (!firstStage) return;

  const existingPipelineEntry = await prisma.pipelineEntry.findFirst({
    where: { candidateId, jobId: job.id },
    select: { id: true },
  });

  if (!existingPipelineEntry) {
    await prisma.pipelineEntry.create({
      data: {
        candidateId,
        jobId: job.id,
        stageId: firstStage.id,
        movedById: job.createdById || job.assignedToId || undefined,
        notes: 'Applied from candidate portal',
      },
    });
  }
}

/**
 * Mirror the portal apply into the Phase 2 tenant DB (assignedJobs merge, match,
 * pipeline, stage engine, activity feed).
 *
 * Multi-agency design:
 *  - Each portal Job document now carries `tenantDbName` (written by the CRM at
 *    job-mirror time) — read it from the Job here and pass to the webhook so the
 *    apply lands in the correct tenant DB no matter how many agencies share the
 *    portal. No per-deployment env-var configuration is required for routing.
 *  - `PHASE2_DEFAULT_TENANT_DB_NAME` is only used as a fallback for legacy jobs
 *    that were mirrored before this field existed.
 *  - `PHASE2_INTERNAL_API_URL` defaults to the typical local CRM dev port.
 *  - `PHASE2_PORTAL_SYNC_SECRET` is the shared secret for the webhook auth; both
 *    backends ship a sane local default so dev environments work out of the box.
 */
async function syncPhase2TenantAfterPortalApply(candidateId, jobId) {
  const base =
    process.env.PHASE2_INTERNAL_API_URL ||
    process.env.PHASE2_API_URL ||
    process.env.PHASE2_BASE_URL ||
    'http://localhost:5001';
  const secret =
    process.env.PHASE2_PORTAL_SYNC_SECRET || 'phase2-portal-sync-2026-shared-secret';

  // Resolve which tenant DB this job belongs to.
  // 1. Read from the portal Job's `tenantDbName` (preferred — multi-agency safe).
  // 2. Fall back to `PHASE2_DEFAULT_TENANT_DB_NAME` env var for legacy jobs.
  let tenantDbName = null;
  let assignedJobsSnapshot = [];
  try {
    const job = await prisma.job.findUnique({
      where: { id: jobId },
      select: { tenantDbName: true },
    });
    tenantDbName = String(job?.tenantDbName || '').trim() || null;
  } catch (e) {
    console.warn('[Application] Could not read job.tenantDbName:', e?.message || e);
  }
  if (!tenantDbName) {
    tenantDbName = String(process.env.PHASE2_DEFAULT_TENANT_DB_NAME || '').trim() || null;
  }

  if (!tenantDbName) {
    console.warn(
      `[Application] Phase2 tenant sync skipped — no tenantDbName on Job ${jobId} and no PHASE2_DEFAULT_TENANT_DB_NAME env fallback. ` +
        `Set tenantDbName on the portal Job (CRM job-mirror writes it now) or configure the env default.`
    );
    return;
  }

  try {
    const c = await prisma.candidate.findUnique({
      where: { id: candidateId },
      select: { assignedJobs: true },
    });
    if (Array.isArray(c?.assignedJobs)) {
      assignedJobsSnapshot = c.assignedJobs;
    }
  } catch (e) {
    console.warn('[Application] Could not load candidate for Phase2 sync:', e?.message || e);
  }

  const url = `${String(base).replace(/\/$/, '')}/api/v1/internal/sync-portal-application`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-phase2-portal-sync-secret': secret,
      },
      body: JSON.stringify({
        tenantDbName,
        candidateId,
        jobId,
        assignedJobsSnapshot,
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      console.warn('[Application] Phase2 tenant sync HTTP error:', res.status, text);
    } else {
      console.log(
        `✅ Phase2 tenant sync ok | candidateId=${candidateId} jobId=${jobId} tenantDbName=${tenantDbName}`
      );
    }
  } catch (e) {
    console.warn('[Application] Phase2 tenant sync failed:', e?.message || e);
  }
}

/**
 * Mirror portal withdraw into the Phase 2 tenant DB (detach match, application, pipeline).
 */
async function syncPhase2AfterPortalWithdraw(candidateId, jobId) {
  const base =
    process.env.PHASE2_INTERNAL_API_URL ||
    process.env.PHASE2_API_URL ||
    process.env.PHASE2_BASE_URL ||
    'http://localhost:5001';
  const secret =
    process.env.PHASE2_PORTAL_SYNC_SECRET || 'phase2-portal-sync-2026-shared-secret';

  let tenantDbName = null;
  try {
    const job = await prisma.job.findUnique({
      where: { id: jobId },
      select: { tenantDbName: true },
    });
    tenantDbName = String(job?.tenantDbName || '').trim() || null;
  } catch (e) {
    console.warn('[Application] Could not read job.tenantDbName for withdraw:', e?.message || e);
  }
  if (!tenantDbName) {
    tenantDbName = String(process.env.PHASE2_DEFAULT_TENANT_DB_NAME || '').trim() || null;
  }

  if (!tenantDbName) {
    console.warn(
      `[Application] Phase2 withdraw sync skipped — no tenantDbName on Job ${jobId} and no PHASE2_DEFAULT_TENANT_DB_NAME env fallback.`
    );
    return;
  }

  const url = `${String(base).replace(/\/$/, '')}/api/v1/internal/sync-portal-withdraw-application`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-phase2-portal-sync-secret': secret,
      },
      body: JSON.stringify({
        tenantDbName,
        candidateId,
        jobId,
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      console.warn('[Application] Phase2 withdraw sync HTTP error:', res.status, text);
    } else {
      console.log(
        `✅ Phase2 withdraw sync ok | candidateId=${candidateId} jobId=${jobId} tenantDbName=${tenantDbName}`
      );
    }
  } catch (e) {
    console.warn('[Application] Phase2 withdraw sync failed:', e?.message || e);
  }
}

function isTerminalPortalCandidateStage(stage) {
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

/**
 * Create a new job application
 * POST /api/applications
 */
async function createApplication(req, res) {
  try {
    const { candidateId, jobId, screeningAnswers } = req.body;

    if (!candidateId || !jobId) {
      return res.status(400).json({
        success: false,
        message: 'Candidate ID and Job ID are required',
      });
    }

    // Verify IDs are valid ObjectIds (24-char hex)
    const objectIdRegex = /^[0-9a-fA-F]{24}$/;
    if (!objectIdRegex.test(candidateId) || !objectIdRegex.test(jobId)) {
      console.warn(`[Application] Invalid ID format: candidateId=${candidateId}, jobId=${jobId}`);
      return res.status(400).json({
        success: false,
        message: candidateId === 'guest' ? 'Please log in to apply for jobs' : 'Invalid ID format provided',
      });
    }

    // Check if application already exists
    const existingApplication = await prisma.application.findUnique({
      where: {
        candidateId_jobId: {
          candidateId,
          jobId,
        },
      },
    });

    if (existingApplication) {
      return res.status(400).json({
        success: false,
        message: 'You have already applied to this job',
        data: {
          applicationId: existingApplication.id,
        },
      });
    }

    // Verify job exists
    const job = await prisma.job.findUnique({
      where: { id: jobId },
      include: { company: true, client: true },
    });

    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job not found',
      });
    }

    let application;

    try {
      // Avoid interactive multi-write transactions: they trigger P2034 on Mongo far more often than
      // two separate writes. Duplicate applies are still blocked by @@unique([candidateId, jobId]).
      application = await withMongoWriteConflictRetry(
        () =>
          prisma.application.create({
            data: {
              candidateId,
              jobId,
              status: 'SUBMITTED',
              screeningAnswers: screeningAnswers || {},
            },
            include: {
              job: {
                include: {
                  company: true,
                  client: true,
                },
              },
            },
          }),
        12
      );

      await prisma.applicationTimeline
        .create({
          data: {
            applicationId: application.id,
            status: 'SUBMITTED',
            title: 'Application Submitted',
            description: 'Your application has been successfully submitted',
          },
        })
        .catch((timelineErr) => {
          console.warn('[Application] Timeline create failed (non-fatal):', timelineErr?.message || timelineErr);
        });
    } catch (e) {
      if (e.code === 'ALREADY_APPLIED') {
        return res.status(400).json({
          success: false,
          message: 'You have already applied to this job',
        });
      }
      if (e.code === 'P2002') {
        return res.status(400).json({
          success: false,
          message: 'You have already applied to this job',
        });
      }
      throw e;
    }

    console.log(`✅ Application created: ${application.id} for job ${jobId} by candidate ${candidateId}`);

    const responsePayload = {
      success: true,
      message: 'Application submitted successfully',
      data: {
        applicationId: application.id,
        status: application.status,
        appliedAt: application.appliedAt,
        job: {
          id: application.job.id,
          title: application.job.title,
          company: resolvePublicCompanyName(application.job, ''),
          tenantDbName: job.tenantDbName || null,
          preScreenAssessments: Array.isArray(job.preScreenAssessments) ? job.preScreenAssessments : [],
        },
      },
    };

    res.json(responsePayload);

    // Persist a bell notification for the candidate ("Application submitted")
    // so it shows up under the bell icon alongside the toast. Failures are
    // swallowed inside the helper so they cannot affect the HTTP response.
    void createCandidateNotification(candidateId, {
      type: 'application',
      title: 'Application submitted successfully',
      description: `Your application for ${
        application.job.title || 'a role'
      } at ${resolvePublicCompanyName(application.job, 'the company')} has been received.`,
      actionButton: 'View application',
      actionPath: `/applications/${application.id}`,
      metadata: {
        applicationId: application.id,
        jobId: job.id,
        jobTitle: application.job.title || null,
        companyName: shouldShowClientNamePublicly(application.job)
          ? application.job.company?.name || application.job.client?.companyName || null
          : null,
        status: application.status,
        kind: 'application_submitted',
        channel: 'activity',
      },
    });

    // Heavy / outbound sync must not block or fail the HTTP response (avoids client "Failed to fetch" on hangs / crashes).
    void (async () => {
      try {
        await syncApplicationToRecruiterView(candidateId, job);
      } catch (e) {
        console.error('[Application] Portal recruiter sync failed:', e);
      }
      try {
        await syncPhase2TenantAfterPortalApply(candidateId, job.id);
        await syncTailoredCvToPhase2AfterApply(candidateId, job.id);
      } catch (e) {
        console.error('[Application] Phase2 apply/tailored-CV sync failed:', e);
      }
    })();
  } catch (error) {
    console.error('Error creating application:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit application',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}

/**
 * Get all applications for a candidate
 * GET /api/applications/:candidateId
 */
async function getApplications(req, res) {
  try {
    const { candidateId } = req.params;
    const startedAt = Date.now();

    if (!candidateId) {
      return res.status(400).json({
        success: false,
        message: 'Candidate ID is required',
      });
    }

    console.log(`📥 DB fetch requested: applications | candidateId=${candidateId}`);
    const applications = await prisma.application.findMany({
      where: { candidateId },
      select: {
        id: true,
        jobId: true,
        status: true,
        appliedAt: true,
        matchScore: true,
        job: {
          select: {
            id: true,
            title: true,
            salaryMin: true,
            salaryMax: true,
            salaryCurrency: true,
            salaryType: true,
            location: true,
            employmentType: true,
            workMode: true,
            showClientNamePublicly: true,
            publicFieldVisibility: true,
            company: { select: { name: true } },
            client: { select: { companyName: true } },
          },
        },
        candidate: {
          select: { stage: true },
        },
        timeline: {
          select: { status: true },
        },
      },
      orderBy: {
        appliedAt: 'desc',
      },
    });

    const jobIds = Array.from(new Set(applications.map((app) => app.jobId).filter(Boolean)));
    const matches = jobIds.length
      ? await prisma.match.findMany({
          where: {
            candidateId,
            jobId: { in: jobIds },
          },
          select: {
            jobId: true,
            status: true,
            updatedAt: true,
          },
          orderBy: { updatedAt: 'desc' },
        })
      : [];
    const matchByJobId = new Map();
    for (const match of matches) {
      if (!matchByJobId.has(match.jobId)) {
        matchByJobId.set(match.jobId, match);
      }
    }

    const pipelineEntries = jobIds.length
      ? await prisma.pipelineEntry.findMany({
          where: {
            candidateId,
            jobId: { in: jobIds },
          },
          select: {
            jobId: true,
            movedAt: true,
            createdAt: true,
            stage: {
              select: { name: true },
            },
          },
          orderBy: [{ movedAt: 'desc' }, { createdAt: 'desc' }],
        })
      : [];
    const pipelineStageByJobId = new Map();
    for (const entry of pipelineEntries) {
      if (!pipelineStageByJobId.has(entry.jobId)) {
        pipelineStageByJobId.set(entry.jobId, entry?.stage?.name || null);
      }
    }

    // Transform applications to match frontend format
    const transformedApplications = applications.map((app) => {
      const job = app.job;

      // Format salary
      let salary = 'Not specified';
      if (job.salaryMin && job.salaryMax) {
        const currency = job.salaryCurrency || 'USD';
        const salaryType = job.salaryType === 'ANNUAL' ? '/year' : job.salaryType === 'MONTHLY' ? '/month' : '';
        salary = `${currency === 'USD' ? '$' : currency}${job.salaryMin.toLocaleString()} - ${currency === 'USD' ? '$' : currency}${job.salaryMax.toLocaleString()}${salaryType}`;
      }

      // Format status
      const statusMap = {
        SUBMITTED: 'Applied',
        UNDER_REVIEW: 'Screening',
        SHORTLISTED: 'Shortlisted',
        ASSESSMENT: 'Assessment',
        INTERVIEW: 'Interview',
        FINAL_DECISION: 'Final Decision',
        SELECTED: 'Selected',
        REJECTED: 'Rejected',
      };

      const recruiterMatch = matchByJobId.get(app.jobId) || null;
      const pipelineStageName = pipelineStageByJobId.get(app.jobId) || null;
      const timelineStatuses = Array.isArray(app.timeline)
        ? app.timeline.map((t) => t?.status).filter(Boolean)
        : [];
      const displayStatus = resolveApplicationDisplayStatus({
        appStatus: app.status,
        matchStatus: recruiterMatch?.status,
        candidateStage: app.candidate?.stage,
        pipelineStageName,
        timelineStatuses,
      });
      const perAppPipelineStage = deriveApplicationPipelineStage({
        pipelineStageName,
        appStatus: app.status,
        matchStatus: recruiterMatch?.status,
        timelineStatuses,
      });

      return {
        id: app.id,
        jobId: job.id,
        jobTitle: job.title,
        company: resolvePublicCompanyName(job, ''),
        status: displayStatus,
        applicationStatus: statusMap[app.status] || app.status,
        pipelineStatusCode: recruiterMatch?.status || null,
        // Per-application pipeline label. We deliberately do NOT fall back
        // to `app.candidate?.stage` here — that single global field bleeds
        // across all of a candidate's applications, so a previously
        // rejected candidate would otherwise see "Rejected" on a brand
        // new Job B's card just because Job A was rejected.
        pipelineStage: perAppPipelineStage,
        appliedDate: app.appliedAt.toISOString().split('T')[0],
        matchScore: app.matchScore || 0,
        salary,
        location: job.location || 'Not specified',
        employmentType: job.employmentType || 'Full-time',
        workMode: job.workMode || 'On-site',
      };
    });

    console.log(
      `📦 DB fetch result: applications | candidateId=${candidateId} | count=${applications.length} | elapsedMs=${Date.now() - startedAt}`
    );

    res.json({
      success: true,
      data: transformedApplications,
    });
  } catch (error) {
    const message = String(error?.message || '');
    const isDbUnavailable =
      error?.code === 'P2010' ||
      message.includes('Server selection timeout') ||
      message.includes('No such host is known') ||
      message.includes('forcibly closed by the remote host') ||
      message.includes('connection');

    if (isDbUnavailable) {
      console.warn('DB unavailable - getApplications');
      return res.status(503).json({
        success: false,
        message: 'Database unavailable',
      });
    }

    console.error('Error fetching applications:', message);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch applications',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}

/**
 * Get single application detail by applicationId
 * GET /api/applications/detail/:applicationId
 */
async function getApplicationById(req, res) {
  try {
    const { applicationId } = req.params;
    const startedAt = Date.now();

    if (!applicationId) {
      return res.status(400).json({
        success: false,
        message: 'Application ID is required',
      });
    }

    console.log(`📥 DB fetch requested: application-detail | applicationId=${applicationId}`);

    const application = await prisma.application.findUnique({
      where: { id: applicationId },
      include: {
        candidate: {
          select: { stage: true },
        },
        job: {
          include: {
            company: true,
            client: true,
          },
        },
        timeline: {
          orderBy: {
            occurredAt: 'asc',
          },
        },
        communications: {
          orderBy: {
            sentAt: 'asc',
          },
        },
      },
    });

    if (!application) {
      return res.status(404).json({
        success: false,
        message: 'Application not found',
      });
    }

    const recruiterMatch = await prisma.match.findFirst({
      where: {
        candidateId: application.candidateId,
        jobId: application.jobId,
      },
      select: {
        status: true,
      },
      orderBy: { updatedAt: 'desc' },
    });

    const latestPipelineEntry = await prisma.pipelineEntry.findFirst({
      where: {
        candidateId: application.candidateId,
        jobId: application.jobId,
      },
      select: {
        stage: {
          select: { name: true },
        },
      },
      orderBy: [{ movedAt: 'desc' }, { createdAt: 'desc' }],
    });
    const orderedPipelineStages = await prisma.pipelineStage.findMany({
      where: { jobId: application.jobId },
      select: { id: true, name: true, order: true },
      orderBy: { order: 'asc' },
    });
    const normalizedStageNames = new Set(
      orderedPipelineStages
        .map((stage) => String(stage?.name || '').trim().toLowerCase())
        .filter(Boolean)
    );
    const detailTimelineStatuses = Array.isArray(application.timeline)
      ? application.timeline.map((t) => t?.status).filter(Boolean)
      : [];
    // Per-application current stage. We deliberately do NOT fall back to
    // `application.candidate?.stage` (the global candidate field) — that
    // value persists across a candidate's other jobs and would, for
    // example, paint a brand-new Job B's "Pipeline Stage" card as
    // "Rejected" the moment a previous Job A was rejected.
    const currentPipelineStageName = deriveApplicationPipelineStage({
      pipelineStageName: latestPipelineEntry?.stage?.name,
      appStatus: application.status,
      matchStatus: recruiterMatch?.status,
      timelineStatuses: detailTimelineStatuses,
    });
    const currentStageNormalized = String(currentPipelineStageName || '').trim().toLowerCase();
    const pipelineStages = orderedPipelineStages.map((stage) => String(stage.name || '').trim()).filter(Boolean);
    if (
      currentPipelineStageName &&
      !pipelineStageAlreadyRepresented(currentPipelineStageName, pipelineStages)
    ) {
      pipelineStages.push(String(currentPipelineStageName).trim());
    }

    const statusLabel = resolveApplicationDisplayStatus({
      appStatus: application.status,
      matchStatus: recruiterMatch?.status,
      candidateStage: application.candidate?.stage,
      pipelineStageName: latestPipelineEntry?.stage?.name,
      timelineStatuses: detailTimelineStatuses,
    });
    // Keep `statusCode` aligned with the human-facing label when the resolver
    // infers rejection from match / portal-candidate stage (stale
    // `Application.status` can still read `INTERVIEW` after older CRM rejects
    // that omitted `jobId`).
    const displayLooksRejected = String(statusLabel || '').toLowerCase().includes('reject');
    const responseStatusCode =
      String(application.status || '').toUpperCase() === 'REJECTED' || displayLooksRejected
        ? 'REJECTED'
        : application.status;
    const rawTimeline = application.timeline || [];

    let offerLetterUrl = null;
    let offerLetterFileName = null;
    let offerLetterUploadedAt = null;
    let offerDetailsText = application.offerDetails || null;
    let placementId = null;
    let placementStatus = null;
    let offerResponse = null;
    let offerRespondedAt = null;
    let offerRejectionRemark = null;
    let offerResentAt = null;
    let interviewOutcomes = [];
    let rejectionReason = null;
    let rejectionFeedback = null;
    let rejectionSharedAt = null;
    let joiningDate = null;
    let reportingToName = null;
    let reportingToTitle = null;
    let reportingToEmail = null;
    let joiningNotes = null;
    if (application.offerDetails) {
      try {
        const parsed = JSON.parse(application.offerDetails);
        if (parsed && typeof parsed === 'object') {
          offerLetterUrl = resolvePhase2UploadUrl(
            parsed.offerLetterUrl || null,
            parsed.offerLetterRelativeUrl || null,
          );
          offerLetterFileName = parsed.offerLetterFileName || null;
          offerLetterUploadedAt = parsed.offerLetterUploadedAt || null;
          offerDetailsText = parsed.legacyOfferText || null;
          placementId = parsed.placementId || null;
          placementStatus = parsed.placementStatus || null;
          offerResponse = parsed.offerResponse || null;
          offerRespondedAt = parsed.offerRespondedAt || null;
          offerRejectionRemark = parsed.offerRejectionRemark || null;
          offerResentAt = parsed.offerResentAt || null;
          interviewOutcomes = Array.isArray(parsed.interviewOutcomes) ? parsed.interviewOutcomes : [];
          rejectionReason = parsed.rejectionReason || null;
          rejectionFeedback = parsed.rejectionFeedback || null;
          rejectionSharedAt = parsed.rejectionSharedAt || null;
          joiningDate = parsed.joiningDate || null;
          reportingToName = parsed.reportingToName || null;
          reportingToTitle = parsed.reportingToTitle || null;
          reportingToEmail = parsed.reportingToEmail || null;
          joiningNotes = parsed.joiningNotes || null;
        }
      } catch {
        offerDetailsText = application.offerDetails;
      }
    }

    let tenantDbName = String(application.job?.tenantDbName || '').trim() || null;
    if (!tenantDbName) {
      tenantDbName = String(process.env.PHASE2_DEFAULT_TENANT_DB_NAME || '').trim() || null;
    }

    const [enrichedInterviewOutcomes, phase2Rounds] = await Promise.all([
      enrichInterviewOutcomesForPortal({
        interviewOutcomes,
        candidateId: application.candidateId,
        jobId: application.jobId,
        tenantDbName,
      }),
      tenantDbName
        ? fetchPhase2PortalInterviewRounds({
            tenantDbName,
            candidateId: application.candidateId,
            jobId: application.jobId,
          }).catch((roundsErr) => {
            console.warn(
              '[Application] Phase2 interview rounds enrich failed:',
              roundsErr?.message || roundsErr
            );
            return [];
          })
        : Promise.resolve([]),
    ]);
    interviewOutcomes = enrichedInterviewOutcomes;

    const timelineRounds = buildInterviewRoundsFromTimeline(rawTimeline, interviewOutcomes);

    const interviewRounds = mergeInterviewRoundsWithPhase2(
      timelineRounds,
      phase2Rounds,
      interviewOutcomes
    );
    const latestInterview = interviewRounds.length ? interviewRounds[interviewRounds.length - 1] : null;
    const rejectionDetails = buildRejectionDetailsForApplication({
      applicationStatus: statusLabel,
      statusCode: responseStatusCode,
      storedRejection: {
        reason: rejectionReason,
        feedback: rejectionFeedback,
        sharedAt: rejectionSharedAt,
      },
      rawTimeline,
    });

    const timeline = rawTimeline.map((item) => ({
      id: item.id,
      status: formatApplicationStatus(item.status),
      title: item.title || formatApplicationStatus(item.status),
      description: item.description || null,
      occurredAt: item.occurredAt,
    }));

    const communications = (application.communications || []).map((item) => ({
      id: item.id,
      channel: String(item.channel || '').toLowerCase(),
      subject: item.subject || null,
      message: item.message || '',
      sentAt: item.sentAt,
    }));

    console.log(
      `📦 DB fetch result: application-detail | applicationId=${applicationId} | status=${application.status} | timeline=${timeline.length} | communications=${communications.length} | elapsedMs=${Date.now() - startedAt}`
    );

    return res.json({
      success: true,
      data: {
        id: application.id,
        candidateId: application.candidateId,
        jobId: application.jobId,
        status: statusLabel,
        statusCode: responseStatusCode,
        pipelineStatusCode: recruiterMatch?.status || null,
        pipelineStage: currentPipelineStageName,
        pipelineStages,
        appliedAt: application.appliedAt,
        updatedAt: application.updatedAt,
        emailUpdates: application.emailUpdates,
        whatsappUpdates: application.whatsappUpdates,
        offerDetails: offerDetailsText,
        offerLetterUrl,
        offerLetterFileName,
        offerLetterUploadedAt,
        placementId,
        placementStatus,
        offerResponse,
        offerRespondedAt,
        offerRejectionRemark,
        offerResentAt,
        joiningDate,
        reportingToName,
        reportingToTitle,
        reportingToEmail,
        joiningNotes,
        screeningAnswers: application.screeningAnswers || null,
        interviewRounds,
        interviewDetails: latestInterview,
        rejectionDetails,
        job: {
          id: application.job.id,
          title: application.job.title,
          company: resolvePublicCompanyName(application.job, ''),
          location: application.job.location || 'Not specified',
          workMode: application.job.workMode || application.job.jobLocationType || 'Not specified',
          experience:
            application.job.experienceRequired ||
            application.job.experienceLevel ||
            'Not specified',
          employmentType: application.job.employmentType || application.job.type || 'Full-time',
          salary: formatSalaryText(application.job),
        },
        timeline,
        communications,
      },
    });
  } catch (error) {
    console.error('Error fetching application detail:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch application detail',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}

async function syncPhase2PlacementOfferResponse(candidateId, jobId, decision, remark) {
  const base =
    process.env.PHASE2_INTERNAL_API_URL ||
    process.env.PHASE2_API_URL ||
    process.env.PHASE2_BASE_URL ||
    'http://localhost:5001';
  const secret =
    process.env.PHASE2_PORTAL_SYNC_SECRET || 'phase2-portal-sync-2026-shared-secret';

  let tenantDbName = null;
  try {
    const job = await prisma.job.findUnique({
      where: { id: jobId },
      select: { tenantDbName: true },
    });
    tenantDbName = String(job?.tenantDbName || '').trim() || null;
  } catch (e) {
    console.warn('[Application] Could not read job.tenantDbName for offer response:', e?.message || e);
  }
  if (!tenantDbName) {
    tenantDbName = String(process.env.PHASE2_DEFAULT_TENANT_DB_NAME || '').trim() || null;
  }
  if (!tenantDbName) {
    throw new Error('Tenant routing is not configured for this job');
  }

  const url = `${String(base).replace(/\/$/, '')}/api/v1/internal/placement-offer-response`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-phase2-portal-sync-secret': secret,
    },
    body: JSON.stringify({ tenantDbName, candidateId, jobId, decision, remark: remark || undefined }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || `Phase2 offer response failed (${res.status})`);
  }
  return res.json();
}

/**
 * POST /api/applications/detail/:applicationId/offer-response
 * Body: { candidateId, decision: 'accept' | 'reject', remark?: string }
 */
async function respondToOfferLetter(req, res) {
  try {
    const { applicationId } = req.params;
    const candidateId = String(req.body?.candidateId || '').trim();
    const decision = String(req.body?.decision || '').trim().toLowerCase();
    const remark = String(req.body?.remark || '').trim();

    if (!applicationId || !candidateId) {
      return res.status(400).json({ success: false, message: 'applicationId and candidateId are required' });
    }
    if (!['accept', 'reject'].includes(decision)) {
      return res.status(400).json({ success: false, message: 'decision must be accept or reject' });
    }
    if (decision === 'reject' && !remark) {
      return res.status(400).json({
        success: false,
        message: 'Please share a brief reason for declining the offer',
      });
    }
    if (decision === 'reject' && remark.length > 2000) {
      return res.status(400).json({
        success: false,
        message: 'Remark must be 2000 characters or fewer',
      });
    }

    const application = await prisma.application.findUnique({
      where: { id: applicationId },
      select: { id: true, candidateId: true, jobId: true, offerDetails: true },
    });
    if (!application || application.candidateId !== candidateId) {
      return res.status(404).json({ success: false, message: 'Application not found' });
    }

    let parsed = {};
    if (application.offerDetails) {
      try {
        const maybe = JSON.parse(application.offerDetails);
        parsed = maybe && typeof maybe === 'object' ? maybe : {};
      } catch {
        parsed = {};
      }
    }
    if (!parsed.offerLetterUrl) {
      return res.status(400).json({ success: false, message: 'No offer letter is available for this application' });
    }
    if (parsed.offerResponse && parsed.offerResponse !== 'PENDING') {
      return res.status(400).json({ success: false, message: 'You have already responded to this offer' });
    }

    const phase2 = await syncPhase2PlacementOfferResponse(
      candidateId,
      application.jobId,
      decision,
      decision === 'reject' ? remark : undefined
    );

    const isAccept = decision === 'accept';
    parsed.offerResponse = isAccept ? 'ACCEPTED' : 'REJECTED';
    parsed.offerRespondedAt = new Date().toISOString();
    parsed.placementStatus = isAccept ? 'OFFER_ACCEPTED' : 'OFFER_REJECTED';
    if (!isAccept && remark) {
      parsed.offerRejectionRemark = remark;
    }
    if (phase2?.data?.placementId) {
      parsed.placementId = String(phase2.data.placementId);
    }

    await prisma.application.update({
      where: { id: applicationId },
      data: { offerDetails: JSON.stringify(parsed) },
    });

    return res.json({
      success: true,
      message: decision === 'accept' ? 'Offer accepted successfully' : 'Offer declined',
      data: {
        ...(phase2?.data || {}),
        offerResponse: parsed.offerResponse,
        offerRespondedAt: parsed.offerRespondedAt,
        placementStatus: parsed.placementStatus,
        offerRejectionRemark: parsed.offerRejectionRemark || null,
      },
    });
  } catch (error) {
    console.error('Error responding to offer:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to submit offer response',
    });
  }
}

/**
 * Check if candidate has applied to a job
 * GET /api/applications/check/:candidateId/:jobId
 */
async function checkApplication(req, res) {
  try {
    const { candidateId, jobId } = req.params;
    const startedAt = Date.now();

    if (!candidateId || !jobId) {
      return res.status(400).json({
        success: false,
        message: 'Candidate ID and Job ID are required',
      });
    }

    console.log(`📥 DB fetch requested: check-application | candidateId=${candidateId} | jobId=${jobId}`);
    const application = await prisma.application.findUnique({
      where: {
        candidateId_jobId: {
          candidateId,
          jobId,
        },
      },
    });

    console.log(
      `📦 DB fetch result: check-application | candidateId=${candidateId} | jobId=${jobId} | hasApplied=${!!application} | elapsedMs=${Date.now() - startedAt}`
    );

    res.json({
      success: true,
      data: {
        hasApplied: !!application,
        applicationId: application?.id || null,
        status: application?.status || null,
      },
    });
  } catch (error) {
    const message = String(error?.message || '');
    const isDbUnavailable =
      error?.code === 'P2010' ||
      message.includes('Server selection timeout') ||
      message.includes('No such host is known') ||
      message.includes('forcibly closed by the remote host') ||
      message.includes('connection');

    if (isDbUnavailable) {
      console.warn('DB unavailable - checkApplication');
      return res.status(503).json({
        success: false,
        message: 'Database unavailable',
      });
    }

    console.error('Error checking application:', message);
    res.status(500).json({
      success: false,
      message: 'Failed to check application status',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}

/**
 * Withdraw (delete) an existing application.
 * DELETE /api/applications/detail/:applicationId?candidateId=...
 */
async function withdrawApplication(req, res) {
  try {
    const { applicationId } = req.params;
    const candidateId = String(req.query?.candidateId || req.body?.candidateId || '').trim();

    if (!applicationId) {
      return res.status(400).json({
        success: false,
        message: 'Application ID is required',
      });
    }

    if (!candidateId) {
      return res.status(400).json({
        success: false,
        message: 'Candidate ID is required',
      });
    }

    const app = await prisma.application.findUnique({
      where: { id: applicationId },
      select: { id: true, candidateId: true, jobId: true },
    });

    // Idempotent success: if already deleted, treat as withdrawn.
    if (!app) {
      return res.json({
        success: true,
        message: 'Application already withdrawn',
      });
    }

    if (app.candidateId !== candidateId) {
      return res.status(403).json({
        success: false,
        message: 'You can only withdraw your own application',
      });
    }

    await withMongoWriteConflictRetry(async () => {
      await prisma.application.delete({ where: { id: app.id } });

      // Clean recruiter-side mirror records created during apply flow.
      await Promise.all([
        prisma.match.deleteMany({ where: { candidateId, jobId: app.jobId } }),
        prisma.pipelineEntry.deleteMany({ where: { candidateId, jobId: app.jobId } }),
      ]);

      // Remove this job from candidate.assignedJobs so Explore Jobs can show it again as not-applied.
      const candidate = await prisma.candidate.findUnique({
        where: { id: candidateId },
        select: { assignedJobs: true, stage: true },
      });
      if (candidate && Array.isArray(candidate.assignedJobs)) {
        const nextAssignedJobs = candidate.assignedJobs.filter((j) => String(j) !== String(app.jobId));
        if (nextAssignedJobs.length !== candidate.assignedJobs.length) {
          const portalUpdate = { assignedJobs: nextAssignedJobs, lastActivity: new Date() };
          if (
            nextAssignedJobs.length === 0 &&
            !isTerminalPortalCandidateStage(candidate.stage)
          ) {
            portalUpdate.stage = 'New';
          }
          await prisma.candidate.update({
            where: { id: candidateId },
            data: portalUpdate,
          });
        }
      }
    }, 10);

    await syncPhase2AfterPortalWithdraw(candidateId, app.jobId);

    return res.json({
      success: true,
      message: 'Application withdrawn successfully',
      data: {
        applicationId: app.id,
        jobId: app.jobId,
        candidateId: app.candidateId,
      },
    });
  } catch (error) {
    console.error('Error withdrawing application:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to withdraw application',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}

module.exports = {
  createApplication,
  getApplications,
  getApplicationById,
  withdrawApplication,
  checkApplication,
  respondToOfferLetter,
};
