import type { BackendCandidate } from './api';
import { mapBackendStage } from './mapCandidateProfile';
import { isSubmittedToClientStage } from '../utils/candidateStage';

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

function hasFreshSubmittedApplication(c: BackendCandidate): boolean {
  const apps = Array.isArray(c.applications) ? c.applications : [];
  return apps.some((row) => {
    const status = String((row as { status?: string }).status || '').toUpperCase();
    return status === 'SUBMITTED' || status === 'UNDER_REVIEW';
  });
}

function stageLooksTerminalHire(stage: string): boolean {
  const s = String(stage || '').trim().toLowerCase();
  return /\b(hired|placed|joined|onboarded)\b/.test(s);
}

function explicitStageLooksJobLinked(stage: string): boolean {
  const s = String(stage || '').trim().toLowerCase();
  if (!s || s === 'new') return false;
  return (
    s.includes('applied') ||
    s.includes('apply') ||
    s.includes('submit') ||
    isSubmittedToClientStage(s) ||
    s.includes('screen') ||
    s.includes('short') ||
    s.includes('long') ||
    s.includes('interview') ||
    s.includes('offer') ||
    stageLooksTerminalHire(s) ||
    s.includes('reject')
  );
}

/** CRM stage for list/drawer — job-linked candidates show Applied unless a later stage is set. */
export function resolveCandidateListStage(c: BackendCandidate): string {
  const backendStage = String(c.stage || '').trim();
  const hasTenantJob = candidateHasRealJobAssignment(c);
  const explicit = backendStage;
  const explicitLower = explicit.toLowerCase();
  const upcomingInterview = hasUpcomingInterview(c);
  const interviewCompletedOnly = hasCompletedInterviewOnly(c);

  if (isSubmittedToClientStage(explicit)) {
    return explicit;
  }

  if (interviewCompletedOnly && !upcomingInterview) {
    const merged = mergeStages(explicit, 'Interview completed');
    if (hasTenantJob || explicitLower !== 'new' || explicit) {
      return merged || 'Interview completed';
    }
  }

  if (upcomingInterview) {
    const merged = mergeStages(explicit, 'Interviewing');
    if (hasTenantJob || explicitLower !== 'new' || explicit) {
      return merged || 'Interviewing';
    }
  }

  if (backendStage && backendStage.toLowerCase() !== 'new') {
    if (hasTenantJob || !explicitStageLooksJobLinked(backendStage)) {
      if (
        interviewCompletedOnly &&
        (explicitLower === 'interviewing' || explicitLower === 'interview')
      ) {
        return 'Interview completed';
      }
      return backendStage;
    }
  }

  if (c.isJobAppliedCandidate === true) {
    return explicit && explicitLower !== 'new' ? explicit : 'Applied';
  }

  if (explicit && explicitLower !== 'new') {
    if (!hasTenantJob) {
      return 'New';
    }
    if (hasFreshSubmittedApplication(c) && stageLooksTerminalHire(explicit)) {
      return 'Applied';
    }
    return explicit;
  }
  const hasApplication =
    Array.isArray(c.applications) && c.applications.length > 0;
  if (hasApplication || hasTenantJob) {
    return 'Applied';
  }

  const status = String(c.status || '').toUpperCase();
  if (status === 'NEW' || status === 'ACTIVE') return 'New';

  return mapBackendStage(c.status || '') || 'New';
}

/** Job titles / links shown on Candidates list — assign, apply, pipeline, or match. */
export function resolveCandidateAssignedJobTitles(c: BackendCandidate): string[] {
  const fromTitles = (c.assignedJobTitles || []).filter((title) => Boolean(title && title.trim()));
  if (fromTitles.length) return fromTitles;

  const seen = new Set<string>();
  const titles: string[] = [];
  const push = (raw: string | null | undefined) => {
    const label = String(raw || '').trim();
    if (!label || seen.has(label)) return;
    seen.add(label);
    titles.push(label);
  };

  for (const match of crmLinkedMatches(c)) {
    push(match.job?.title);
  }
  for (const app of c.applications || []) {
    const row = app as { job?: { title?: string | null } };
    push(row.job?.title);
  }

  return titles;
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
    if (Number.isFinite(n) && n >= 0) return n;
  }
  return 0;
}

/** Location label for list / job drawer — uses city/country when location is empty. */
export function resolveCandidateLocationLabel(c: {
  location?: string | null;
  city?: string | null;
  country?: string | null;
}): string {
  const direct = String(c.location || '').trim();
  if (
    direct &&
    direct !== '—' &&
    direct !== '-' &&
    direct.toLowerCase() !== 'location unavailable' &&
    direct.toLowerCase() !== 'not shared'
  ) {
    return direct;
  }
  const parts = [c.city, c.country].map((part) => String(part || '').trim()).filter(Boolean);
  if (parts.length) return parts.join(', ');
  return '—';
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
