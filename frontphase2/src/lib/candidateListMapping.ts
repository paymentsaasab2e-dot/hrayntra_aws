import type { BackendCandidate } from './api';
import { mapBackendStage } from './mapCandidateProfile';
import { isSubmittedToClientStage } from '../utils/candidateStage';
import { resolveSubmitJobIdFromBackend } from './candidateSubmitToClient';
import { formatTableLocation } from './formatTableLocation';
import { readTableLocationDisplayMode } from './tableLocationDisplayStorage';

function displayPipelineStageName(currentStage?: string | null): string {
  const normalized = String(currentStage || '').trim();
  if (!normalized || normalized.toLowerCase() === 'new') return 'Applied';
  return normalized;
}

/** AI Matches scoring rows must not appear as assign/apply on the Candidates list. */
function matchRepresentsCrmJobLink(match: {
  evaluation?: { origin?: string; pending?: boolean } | null;
  createdById?: string | null;
}): boolean {
  const ev = match?.evaluation;
  if (ev && typeof ev === 'object') {
    if (ev.pending) return false;
    if (ev.origin === 'ai') return false;
    if (ev.origin === 'applied') return true;
  }
  if (match?.createdById) return true;
  return false;
}

function crmLinkedMatches(c: BackendCandidate) {
  return (Array.isArray(c.matches) ? c.matches : []).filter((row) => matchRepresentsCrmJobLink(row));
}

export function candidateHasRealJobAssignment(c: BackendCandidate): boolean {
  if (c.isJobAppliedCandidate === true) return true;
  if (resolveCandidateAssignedJobTitles(c).length > 0) return true;
  if (Array.isArray(c.assignedJobs) && c.assignedJobs.some((id) => String(id || '').trim())) {
    return true;
  }
  if (Array.isArray(c.applications) && c.applications.length > 0) return true;
  if (Array.isArray(c.pipelineEntries) && c.pipelineEntries.length > 0) return true;
  if (crmLinkedMatches(c).length > 0) return true;
  return false;
}

function stageRank(stage: string): number {
  const s = String(stage || '').trim().toLowerCase();
  if (!s || s === 'new') return 0;
  if (s.includes('reject')) return 70;
  if (s.includes('hire') || s.includes('placed') || s.includes('joined')) return 60;
  if (s.includes('offer')) return 50;
  if (s.includes('interview') && s.includes('complet')) return 45;
  if (isSubmittedToClientStage(s)) return 42;
  if (s.includes('interview')) return 40;
  if (s.includes('screen') || s.includes('short') || s.includes('long')) return 30;
  if (s.includes('submit')) return 30;
  if (s.includes('applied') || s.includes('apply')) return 20;
  return 15;
}

function mergeStages(...stages: Array<string | null | undefined>): string {
  let best = '';
  let bestRank = -1;
  for (const stage of stages) {
    const label = String(stage || '').trim();
    if (!label) continue;
    const rank = stageRank(label);
    if (rank > bestRank) {
      bestRank = rank;
      best = label;
    }
  }
  return best;
}

const TERMINAL_INTERVIEW_STATUSES = new Set(['CANCELLED', 'CANCELED', 'REJECTED', 'NO_SHOW']);
const COMPLETED_INTERVIEW_STATUSES = new Set(['COMPLETED', 'FEEDBACK_SUBMITTED']);

function normalizeInterviewStatus(row: { status?: string }): string {
  return String(row?.status || 'SCHEDULED').toUpperCase();
}

function isRelevantInterview(row: { status?: string }): boolean {
  return !TERMINAL_INTERVIEW_STATUSES.has(normalizeInterviewStatus(row));
}

function hasUpcomingInterview(c: BackendCandidate): boolean {
  const interviews = Array.isArray(c.interviews) ? c.interviews : [];
  return interviews.some((row) => {
    const status = normalizeInterviewStatus(row);
    if (TERMINAL_INTERVIEW_STATUSES.has(status)) return false;
    return !COMPLETED_INTERVIEW_STATUSES.has(status);
  });
}

function hasCompletedInterviewOnly(c: BackendCandidate): boolean {
  const interviews = Array.isArray(c.interviews) ? c.interviews : [];
  const relevant = interviews.filter(isRelevantInterview);
  if (!relevant.length) return false;
  return relevant.every((row) => COMPLETED_INTERVIEW_STATUSES.has(normalizeInterviewStatus(row)));
}

/** CRM stage for list/drawer — prefer assigned-job pipeline stage (same as Job Details). */
export function resolveCandidateListStage(c: BackendCandidate): string {
  const primaryJobId = resolveSubmitJobIdFromBackend(c);
  if (primaryJobId) {
    const entry = (Array.isArray(c.pipelineEntries) ? c.pipelineEntries : []).find(
      (row) => String(row?.jobId || '').trim() === primaryJobId,
    );
    const pipelineName = String(entry?.stage?.name || '').trim();
    if (pipelineName) {
      return displayPipelineStageName(pipelineName);
    }
  }

  const backendStage = String(c.stage || '').trim();
  const hasTenantJob = candidateHasRealJobAssignment(c);
  const explicit = backendStage;
  const explicitLower = explicit.toLowerCase();
  const upcomingInterview = hasUpcomingInterview(c);
  const interviewCompletedOnly = hasCompletedInterviewOnly(c);
  const pipelineStageNames = (Array.isArray(c.pipelineEntries) ? c.pipelineEntries : [])
    .map((row) => String(row?.stage?.name || '').trim())
    .filter(Boolean);
  const submittedStage = [explicit, ...pipelineStageNames].find((stage) =>
    isSubmittedToClientStage(stage),
  );
  if (submittedStage) {
    return submittedStage;
  }

  if (interviewCompletedOnly && !upcomingInterview) {
    const merged = mergeStages(explicit, 'Interview completed');
    if (hasTenantJob || (explicit && explicitLower !== 'new')) {
      return merged || 'Interview completed';
    }
  }

  if (upcomingInterview) {
    const merged = mergeStages(explicit, 'Interviewing');
    if (hasTenantJob || (explicit && explicitLower !== 'new')) {
      return merged || 'Interviewing';
    }
  }

  if (
    interviewCompletedOnly &&
    (explicitLower === 'interviewing' || explicitLower === 'interview')
  ) {
    return 'Interview completed';
  }

  // Trust API/DB workflow stages (Applied, Screening, …). Never force "New" just
  // because assignedJobs/applications were omitted from a lean list payload —
  // that broke My Candidates stage filters (Applied filter showed New tags).
  if (explicit && explicitLower !== 'new') {
    return explicit;
  }

  if (c.isJobAppliedCandidate === true) {
    return 'Applied';
  }

  const hasApplication =
    Array.isArray(c.applications) && c.applications.length > 0;
  if (hasApplication || hasTenantJob) {
    return 'Applied';
  }

  if (pipelineStageNames.length) {
    return displayPipelineStageName(mergeStages(...pipelineStageNames));
  }

  const status = String(c.status || '').toUpperCase();
  if (status === 'NEW' || status === 'ACTIVE') return 'New';

  return mapBackendStage(c.status || '') || 'New';
}

function findJobTitleById(c: BackendCandidate, jobId: string): string {
  const id = String(jobId || '').trim();
  if (!id) return '';
  for (const match of crmLinkedMatches(c)) {
    if (String(match?.jobId || match?.job?.id || '').trim() === id) {
      const title = String(match?.job?.title || '').trim();
      if (title) return title;
    }
  }
  for (const app of c.applications || []) {
    const row = app as { jobId?: string; job?: { id?: string; title?: string | null } };
    if (String(row?.jobId || row?.job?.id || '').trim() === id) {
      const title = String(row?.job?.title || '').trim();
      if (title) return title;
    }
  }
  for (const entry of c.pipelineEntries || []) {
    const row = entry as { jobId?: string; job?: { title?: string | null } };
    if (String(row?.jobId || '').trim() === id) {
      const title = String(row?.job?.title || '').trim();
      if (title) return title;
    }
  }
  for (const interview of c.interviews || []) {
    const row = interview as { jobId?: string; job?: { id?: string; title?: string | null } };
    if (String(row?.jobId || row?.job?.id || '').trim() === id) {
      const title = String(row?.job?.title || '').trim();
      if (title) return title;
    }
  }
  return '';
}

/**
 * One entry per assigned job id (same title allowed for different jobs).
 * Prefer explicit assignedJobs[] ids; fall back to linked apply/pipeline/match ids.
 */
export function resolveCandidateAssignedJobEntries(
  c: BackendCandidate,
): Array<{ id: string; title: string }> {
  const explicitIds = (Array.isArray(c.assignedJobs) ? c.assignedJobs : [])
    .map((id) => String(id || '').trim())
    .filter(Boolean);
  const titlesArr = Array.isArray(c.assignedJobTitles) ? c.assignedJobTitles : [];

  if (explicitIds.length) {
    return explicitIds.map((id, index) => {
      const fromApi = String(titlesArr[index] || '').trim();
      const title = fromApi || findJobTitleById(c, id) || 'Untitled job';
      return { id, title };
    });
  }

  const orderedIds: string[] = [];
  const pushId = (raw: string | null | undefined) => {
    const id = String(raw || '').trim();
    if (!id || orderedIds.includes(id)) return;
    orderedIds.push(id);
  };

  const primaryJobId = resolveSubmitJobIdFromBackend(c);
  if (primaryJobId) pushId(primaryJobId);
  for (const match of crmLinkedMatches(c)) {
    pushId(match?.jobId || match?.job?.id);
  }
  for (const app of c.applications || []) {
    const row = app as { jobId?: string; job?: { id?: string } };
    pushId(row?.jobId || row?.job?.id);
  }
  for (const entry of c.pipelineEntries || []) {
    const row = entry as { jobId?: string };
    pushId(row?.jobId);
  }
  for (const interview of c.interviews || []) {
    const row = interview as { jobId?: string; job?: { id?: string } };
    pushId(row?.jobId || row?.job?.id);
  }

  return orderedIds.map((id) => ({
    id,
    title: findJobTitleById(c, id) || 'Untitled job',
  }));
}

/** Job titles for Candidates list — one per job id (duplicate titles kept). */
export function resolveCandidateAssignedJobTitles(c: BackendCandidate): string[] {
  return resolveCandidateAssignedJobEntries(c).map((row) => row.title);
}

export function candidateShowsAppliedTag(c: BackendCandidate): boolean {
  if (c.isJobAppliedCandidate === true) return true;
  return candidateHasRealJobAssignment(c) && resolveCandidateListStage(c) !== 'New';
}

/** Experience years for list / job drawer (matches candidate page). */
export function resolveCandidateExperienceYears(c: {
  experience?: number | null;
  experienceYears?: number | null;
}): number {
  for (const raw of [c.experience, c.experienceYears]) {
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 0) continue;
    // Reject ISO codes / calendar years / absurd tenures (e.g. ISO 27001 → 27001y).
    if (n > 50) continue;
    if (n >= 1900 && n <= 2100) continue;
    if ([9001, 14001, 18001, 20000, 22000, 27001, 27002, 45001, 50001].includes(Math.round(n))) {
      continue;
    }
    return Math.round(n * 10) / 10;
  }
  return 0;
}

/** Location label for list / match tables — respects shared Country/State/City/Full mode. */
export function resolveCandidateLocationLabel(c: {
  location?: string | null;
  city?: string | null;
  country?: string | null;
  state?: string | null;
}): string {
  return formatTableLocation(
    {
      location: c.location,
      country: c.country,
      city: c.city,
      state: c.state,
    },
    readTableLocationDisplayMode(),
  );
}

function isBlankOwnerLabel(value?: string | null): boolean {
  const label = String(value || '').trim();
  return !label || label === '—' || label === '-' || label === 'Unassigned';
}

/** Owner / recruiter label — prefer candidate assignee over job fallback. */
export function pickCandidateOwnerLabel(...values: Array<string | null | undefined>): string {
  for (const value of values) {
    const label = String(value || '').trim();
    if (!isBlankOwnerLabel(label)) return label;
  }
  return 'Unassigned';
}
