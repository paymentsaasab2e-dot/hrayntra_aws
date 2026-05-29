import type { BackendCandidate } from './api';
import { mapBackendStage } from './mapCandidateProfile';

export function candidateHasRealJobAssignment(c: BackendCandidate): boolean {
  if (c.isJobAppliedCandidate === true) return true;
  if (c.isJobAppliedCandidate === false) return false;
  // Only treat as job-linked when this tenant resolved at least one assigned job title.
  return resolveCandidateAssignedJobTitles(c).length > 0;
}

function stageRank(stage: string): number {
  const s = String(stage || '').trim().toLowerCase();
  if (!s || s === 'new') return 0;
  if (s.includes('reject')) return 70;
  if (s.includes('hire') || s.includes('placed') || s.includes('joined')) return 60;
  if (s.includes('offer')) return 50;
  if (s.includes('interview')) return 40;
  if (s.includes('screen') || s.includes('short') || s.includes('long') || s.includes('submit')) return 30;
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

function hasActiveInterview(c: BackendCandidate): boolean {
  const interviews = Array.isArray(c.interviews) ? c.interviews : [];
  return interviews.some((row) => {
    const status = String((row as { status?: string }).status || 'SCHEDULED').toUpperCase();
    return !['CANCELLED', 'CANCELED', 'REJECTED'].includes(status);
  });
}

/** CRM stage for list/drawer — job-linked candidates show Applied unless a later stage is set. */
export function resolveCandidateListStage(c: BackendCandidate): string {
  const explicit = String(c.stage || '').trim();
  const explicitLower = explicit.toLowerCase();
  const hasTenantJob = candidateHasRealJobAssignment(c);
  const interviewing = hasActiveInterview(c);

  if (interviewing) {
    const merged = mergeStages(explicit, 'Interviewing');
    if (hasTenantJob || explicitLower !== 'new') {
      return merged || 'Interviewing';
    }
  }

  if (explicit && explicitLower !== 'new') {
    if (!hasTenantJob) {
      return 'New';
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

/** Job titles / links shown on Candidates list — real assignments only, not AI suggestions. */
export function resolveCandidateAssignedJobTitles(c: BackendCandidate): string[] {
  const fromTitles = (c.assignedJobTitles || []).filter((title) => Boolean(title && title.trim()));
  if (fromTitles.length) return fromTitles;
  return [];
}

export function candidateShowsAppliedTag(c: BackendCandidate): boolean {
  if (c.isJobAppliedCandidate === true) return true;
  if (c.isJobAppliedCandidate === false) return false;
  return candidateHasRealJobAssignment(c) && resolveCandidateListStage(c) === 'Applied';
}
