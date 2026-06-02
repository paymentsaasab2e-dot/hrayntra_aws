import type { Candidate } from '../app/candidate/components/CandidateTable';
import type { CandidateProfileDrawerData } from '../components/drawers/CandidateProfileDrawer';
import type { BackendCandidate } from './api';
import { isValidObjectId } from './mapCandidateProfile';

/** Resolve a job id used for submit-to-client from list row data. */
export function resolveSubmitJobIdForRow(row: Candidate): string | null {
  if (row.pipelineJobId && isValidObjectId(row.pipelineJobId)) {
    return row.pipelineJobId;
  }
  return null;
}

/** True when candidate is assigned, applied, or in a job pipeline (list row). */
export function candidateRowCanSubmitToClient(row: Candidate): boolean {
  return Boolean(resolveSubmitJobIdForRow(row));
}

/** Resolve job id from loaded profile drawer data. */
export function resolveSubmitJobIdForProfile(profile: CandidateProfileDrawerData): string | null {
  if (profile.assignedJobId && isValidObjectId(profile.assignedJobId)) {
    return profile.assignedJobId;
  }
  const fromPipeline = profile.assignedJobs?.find(
    (job) => job.id && isValidObjectId(String(job.id)),
  );
  return fromPipeline?.id ? String(fromPipeline.id) : null;
}

/** True when profile has at least one job link (assigned, applied, or pipeline). */
export function profileCanSubmitToClient(profile: CandidateProfileDrawerData): boolean {
  if (resolveSubmitJobIdForProfile(profile)) return true;
  return (profile.assignedJobs?.length ?? 0) > 0;
}

/** Backend check when mapping list rows — same rules as profile eligibility. */
export function backendCandidateCanSubmitToClient(c: BackendCandidate): boolean {
  if (Array.isArray(c.assignedJobs) && c.assignedJobs.some((id) => isValidObjectId(String(id || '')))) {
    return true;
  }
  if (Array.isArray(c.pipelineEntries) && c.pipelineEntries.length > 0) {
    return true;
  }
  if (Array.isArray(c.assignedJobTitles) && c.assignedJobTitles.some((t) => String(t || '').trim())) {
    return true;
  }
  return false;
}

/** Best job id for submit from backend candidate payload (real job links only — not AI suggestions). */
export function resolveSubmitJobIdFromBackend(c: BackendCandidate): string | undefined {
  const fromAssigned = c.assignedJobs?.find((id) => isValidObjectId(String(id || '')));
  if (fromAssigned) return String(fromAssigned);
  const fromPipeline = c.pipelineEntries?.find((e) => isValidObjectId(String(e.jobId || '')))?.jobId;
  if (fromPipeline) return String(fromPipeline);
  return undefined;
}
