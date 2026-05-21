import type { BackendCandidate } from './api';
import { mapBackendStage } from './mapCandidateProfile';

export function candidateHasRealJobAssignment(c: BackendCandidate): boolean {
  const assigned = Array.isArray(c.assignedJobs) && c.assignedJobs.some((id) => String(id || '').trim());
  const hasTitles = resolveCandidateAssignedJobTitles(c).length > 0;
  const hasApplications =
    Array.isArray((c as { applications?: unknown[] }).applications) &&
    (c as { applications: unknown[] }).applications.length > 0;
  const hasPipeline =
    Array.isArray((c as { pipelineEntries?: unknown[] }).pipelineEntries) &&
    (c as { pipelineEntries: unknown[] }).pipelineEntries.length > 0;
  return Boolean(assigned || hasTitles || hasApplications || hasPipeline);
}

/** CRM stage for list/drawer — job-linked candidates show Applied unless a later stage is set. */
export function resolveCandidateListStage(c: BackendCandidate): string {
  const explicit = String(c.stage || '').trim();
  const explicitLower = explicit.toLowerCase();
  if (explicit && explicitLower !== 'new') {
    return explicit;
  }
  if (candidateHasRealJobAssignment(c)) {
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
  return candidateHasRealJobAssignment(c) && resolveCandidateListStage(c) === 'Applied';
}
