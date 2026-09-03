import type { Candidate } from '../app/candidate/components/CandidateTable';
import type { CandidateProfileDrawerData } from '../components/drawers/CandidateProfileDrawer';
import type { BackendCandidate } from './api';
import { isValidObjectId } from './mapCandidateProfile';

/** Sentinel stage-picker value — opens Submit to client instead of moving pipeline stage. */
export const SUBMIT_TO_CLIENT_STAGE_OPTION_VALUE = '__submit_to_client__';
export const SUBMIT_TO_CLIENT_STAGE_OPTION_LABEL = 'Submit to client';

export function isSubmitToClientStageOption(value: string): boolean {
  const normalized = String(value || '').trim().toLowerCase();
  return (
    value === SUBMIT_TO_CLIENT_STAGE_OPTION_VALUE ||
    normalized === SUBMIT_TO_CLIENT_STAGE_OPTION_LABEL.toLowerCase()
  );
}

export { isSubmittedToClientStage } from '../utils/candidateStage';

function normalizePipelineStageLabel(value: string): string {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ');
}

/** Pipeline stage that should open Schedule Interview (e.g. Interviewing, Interview). */
export function isInterviewPipelineStage(stageName: string): boolean {
  const n = normalizePipelineStageLabel(stageName);
  if (!n) return false;
  if (n.includes('reject')) return false;
  return n === 'interview' || n === 'interviewing' || n.includes('interview');
}

/** Pipeline stage that should open Add Placement (e.g. Offer, Offered). */
export function isOfferPipelineStage(stageName: string): boolean {
  const n = normalizePipelineStageLabel(stageName);
  if (!n) return false;
  if (n.includes('reject') || n.includes('letter')) return false;
  return n === 'offer' || n === 'offered' || n.startsWith('offer ');
}

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
  if (resolveSubmitJobIdFromBackend(c)) return true;
  if (Array.isArray(c.assignedJobTitles) && c.assignedJobTitles.some((t) => String(t || '').trim())) {
    return true;
  }
  if (Array.isArray(c.applications) && c.applications.length > 0) return true;
  return false;
}

/** Best job id for submit / stage-move from backend candidate payload (real job links only — not AI suggestions). */
export function resolveSubmitJobIdFromBackend(c: BackendCandidate): string | undefined {
  const fromAssigned = c.assignedJobs?.find((id) => isValidObjectId(String(id || '')));
  if (fromAssigned) return String(fromAssigned);

  const fromPipeline = c.pipelineEntries?.find((e) => isValidObjectId(String(e.jobId || '')))?.jobId;
  if (fromPipeline) return String(fromPipeline);

  const fromApplication = (c.applications || []).find((row) => {
    const jobId = String(row?.jobId || row?.job?.id || '').trim();
    return isValidObjectId(jobId);
  });
  if (fromApplication) {
    return String(fromApplication.jobId || fromApplication.job?.id || '').trim();
  }

  const fromMatch = (Array.isArray(c.matches) ? c.matches : []).find((row) => {
    if (!matchRepresentsCrmJobLink(row)) return false;
    const jobId = String(row?.jobId || row?.job?.id || '').trim();
    return isValidObjectId(jobId);
  });
  if (fromMatch) {
    return String(fromMatch.jobId || fromMatch.job?.id || '').trim();
  }

  return undefined;
}

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
