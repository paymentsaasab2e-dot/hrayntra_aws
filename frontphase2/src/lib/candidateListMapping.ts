import type { BackendCandidate } from './api';
import { mapBackendStage } from './mapCandidateProfile';

/** CRM stage for list/drawer — never infer "Applied" from AI Match rows alone. */
export function resolveCandidateListStage(c: BackendCandidate): string {
  const explicit = String(c.stage || '').trim();
  if (explicit) return explicit;

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

export function candidateHasRealJobAssignment(c: BackendCandidate): boolean {
  const hasAssignedIds = Array.isArray(c.assignedJobs) && c.assignedJobs.some((id) => String(id || '').trim());
  const hasTitles = resolveCandidateAssignedJobTitles(c).length > 0;
  const hasPipeline = Array.isArray(c.pipelineEntries) && c.pipelineEntries.length > 0;
  return Boolean(hasAssignedIds || hasTitles || hasPipeline);
}
