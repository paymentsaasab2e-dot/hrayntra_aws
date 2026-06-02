import { apiCreateMatch, apiGetMatches, apiResolveMatchForSubmit, type BackendMatch } from './api';
import type { JobCandidateItem } from '../components/drawers/JobDetailsDrawer';
import {
  pickCandidateOwnerLabel,
  resolveCandidateExperienceYears,
  resolveCandidateLocationLabel,
} from './candidateListMapping';
import { extractApiData, isValidObjectId } from './mapCandidateProfile';

/** Map portal/CRM application enum to pipeline stage label. */
export function mapApplicationStatusToCrmStage(status?: string | null): string {
  const key = String(status || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '_');
  switch (key) {
    case 'SUBMITTED':
    case 'UNDER_REVIEW':
    case 'REVIEWED':
      return 'Applied';
    case 'SHORTLISTED':
      return 'Shortlisted';
    case 'ASSESSMENT':
      return 'Screening';
    case 'INTERVIEW':
      return 'Interviewing';
    case 'FINAL_DECISION':
      return 'Offer';
    case 'SELECTED':
      return 'Hired';
    case 'REJECTED':
      return 'Rejected';
    default:
      return '';
  }
}

function stageLooksTerminalHire(stage?: string | null): boolean {
  const s = String(stage || '').trim().toLowerCase();
  return /\b(hired|placed|joined|onboarded)\b/.test(s);
}

/** Stage label for job drawer / candidates tab — linked rows default to Applied. */
export function resolveJobCandidateDisplayStage(currentStage?: string | null): string {
  const normalized = String(currentStage || '').trim();
  if (!normalized || normalized.toLowerCase() === 'new') return 'Applied';
  const fromApp = mapApplicationStatusToCrmStage(normalized);
  if (fromApp) return fromApp;
  return normalized;
}

export function isJobAppliedDisplayStage(stage?: string | null): boolean {
  return resolveJobCandidateDisplayStage(stage) === 'Applied';
}

/** Match row workflow status — not the candidate CRM pipeline stage. */
export function isMatchWorkflowStatus(status?: string | null): boolean {
  const key = String(status || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '_');
  if (!key) return false;
  return (
    key === 'SUGGESTED' ||
    key === 'SHORTLISTED' ||
    key === 'REVIEWED' ||
    key === 'REJECTED' ||
    key === 'SELECTED' ||
    key === 'SUBMITTED' ||
    key.startsWith('SENT_TO_PIPELINE')
  );
}

/** Job drawer stage: CRM candidate stage first, never raw match status like SUGGESTED. */
export function resolveJobCandidateStageFromMatchRow(
  match: {
    status?: string | null;
    candidateStage?: string | null;
    candidate?: { stage?: string | null } | null;
  },
  existingStage?: string | null,
): string {
  const seeded = String(existingStage || '').trim();
  if (seeded && !isMatchWorkflowStatus(seeded)) {
    return resolveJobCandidateDisplayStage(seeded);
  }

  const displayStatus = String(match.status || '').trim();
  const fromMatchEnum = mapApplicationStatusToCrmStage(displayStatus);
  if (fromMatchEnum) {
    return fromMatchEnum;
  }

  const crmStage = String(match.candidateStage || match.candidate?.stage || '').trim();
  if (crmStage && crmStage.toLowerCase() !== 'new') {
    const matchIsAppliedWorkflow =
      isMatchWorkflowStatus(displayStatus) &&
      ['REVIEWED', 'SUBMITTED'].includes(displayStatus.toUpperCase());
    if (stageLooksTerminalHire(crmStage) && matchIsAppliedWorkflow) {
      return 'Applied';
    }
    if (stageLooksTerminalHire(crmStage) && mapApplicationStatusToCrmStage(displayStatus)) {
      return 'Applied';
    }
    return resolveJobCandidateDisplayStage(crmStage);
  }

  if (displayStatus && !isMatchWorkflowStatus(displayStatus)) {
    return resolveJobCandidateDisplayStage(displayStatus);
  }

  return resolveJobCandidateDisplayStage(crmStage || 'Applied');
}

/** True when a match row represents a real job link (applied/manual), not AI score-only. */
export function isJobLinkedBackendMatch(match: {
  evaluation?: unknown;
  createdById?: string | null;
}): boolean {
  const evaluation = match?.evaluation;
  if (evaluation && typeof evaluation === 'object' && evaluation !== null && 'origin' in evaluation) {
    const origin = String((evaluation as { origin?: string }).origin || '').toLowerCase();
    if (origin === 'ai' || origin === 'tenant' || origin === 'phase1') return false;
    if (origin === 'applied') return true;
  }
  return Boolean(match?.createdById);
}

export function parseJobCandidateScore(score: string | number | undefined): number {
  if (typeof score === 'number' && Number.isFinite(score)) return Math.round(score);
  const normalized = String(score ?? '')
    .replace(/%/g, '')
    .trim();
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? Math.round(parsed) : 0;
}

export function unwrapMatchRows(response: unknown): BackendMatch[] {
  const payload = (response as { data?: unknown })?.data ?? response;
  if (Array.isArray(payload)) return payload as BackendMatch[];
  if (payload && typeof payload === 'object') {
    const nested = payload as { data?: unknown; items?: unknown };
    if (Array.isArray(nested.data)) return nested.data as BackendMatch[];
    if (Array.isArray(nested.items)) return nested.items as BackendMatch[];
  }
  return [];
}

function pickRealMatchId(rows: BackendMatch[], candidateId: string): string | null {
  const existing = rows.find((row) => String(row.candidateId || '') === candidateId);
  const rawId = String(existing?.id || '');
  if (rawId && !rawId.startsWith('applied-pending-')) return rawId;
  return null;
}

export function backendMatchToJobCandidateItem(
  match: BackendMatch,
  fallbackRecruiter = 'Unassigned',
): JobCandidateItem {
  const score =
    typeof match.score === 'number' && match.score > 0
      ? `${Math.round(match.score)}%`
      : '-';
  const resolvedStage = resolveJobCandidateStageFromMatchRow({
    status: match.status,
    candidateStage: match.candidateStage,
    candidate: match.candidate,
  });
  return {
    id: match.candidateId || match.id,
    candidateName: match.name?.trim() || '—',
    email: match.email || undefined,
    avatar: match.photo?.trim() || null,
    designation: match.currentTitle?.trim() || '',
    company: match.currentCompany?.trim() || '',
    experience: resolveCandidateExperienceYears(match),
    location: resolveCandidateLocationLabel(match),
    phone: match.phone?.trim() || '',
    currentStage: resolvedStage,
    isJobAppliedCandidate: isJobAppliedDisplayStage(resolvedStage),
    score,
    recruiter: pickCandidateOwnerLabel(
      match.candidateOwner,
      match.createdBy?.name,
      fallbackRecruiter,
    ),
    interviewStatus: 'Not scheduled',
    lastActivity: match.createdAt ? String(match.createdAt) : '—',
  };
}

/** Merge pipeline scores from applied matches into existing job drawer rows. */
export function mergeJobCandidatesWithAppliedMatches(
  existing: JobCandidateItem[],
  matchRows: BackendMatch[],
  fallbackRecruiter = 'Unassigned',
): JobCandidateItem[] {
  const scoreByCandidateId = new Map<string, BackendMatch>();
  for (const row of matchRows) {
    const id = row.candidateId || row.id;
    if (!id) continue;
    const prev = scoreByCandidateId.get(id);
    if (!prev || (row.score ?? 0) > (prev.score ?? 0)) {
      scoreByCandidateId.set(id, row);
    }
  }

  const seen = new Set<string>();
  const merged = existing.map((candidate) => {
    seen.add(candidate.id);
    const match = scoreByCandidateId.get(candidate.id);
    if (!match) return candidate;
    const numericScore = typeof match.score === 'number' ? Math.round(match.score) : 0;
    return {
      ...candidate,
      score: numericScore > 0 ? `${numericScore}%` : candidate.score,
      candidateName: candidate.candidateName || match.name || '—',
      designation: candidate.designation || match.currentTitle || '',
      company: candidate.company || match.currentCompany || '',
      experience: (() => {
        const fromRow = resolveCandidateExperienceYears({ experience: candidate.experience });
        const fromMatch = resolveCandidateExperienceYears(match);
        return fromRow > 0 ? fromRow : fromMatch;
      })(),
      location: (() => {
        const fromRow = resolveCandidateLocationLabel({ location: candidate.location });
        const fromMatch = resolveCandidateLocationLabel(match);
        return fromRow !== '—' ? fromRow : fromMatch;
      })(),
      phone: candidate.phone || match.phone || '',
      recruiter: pickCandidateOwnerLabel(
        candidate.recruiter,
        match.candidateOwner,
        match.createdBy?.name,
        fallbackRecruiter,
      ),
      currentStage: resolveJobCandidateStageFromMatchRow(match, candidate.currentStage),
      isJobAppliedCandidate:
        candidate.isJobAppliedCandidate ??
        isJobAppliedDisplayStage(resolveJobCandidateStageFromMatchRow(match, candidate.currentStage)),
    };
  });

  for (const match of matchRows) {
    const id = match.candidateId || match.id;
    if (!id || seen.has(id)) continue;
    merged.push(backendMatchToJobCandidateItem(match, fallbackRecruiter));
    seen.add(id);
  }

  return merged.sort(
    (a, b) => parseJobCandidateScore(b.score) - parseJobCandidateScore(a.score),
  );
}

type PipelineStagePayload = {
  name?: string | null;
  entries?: Array<{
    candidate?: {
      id?: string;
      firstName?: string | null;
      lastName?: string | null;
      email?: string | null;
      avatar?: string | null;
      currentTitle?: string | null;
      currentCompany?: string | null;
      experience?: number | null;
      location?: string | null;
      phone?: string | null;
      stage?: string | null;
    } | null;
  }> | null;
};

type JobApplicationLike = {
  candidateId?: string | null;
  status?: string | null;
  candidate?: {
    id?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    email?: string | null;
    avatar?: string | null;
    currentTitle?: string | null;
    currentCompany?: string | null;
    experience?: number | null;
    location?: string | null;
    phone?: string | null;
    stage?: string | null;
  } | null;
};

/** Build seed rows from job application submissions (portal + tenant). */
export function extractApplicationsJobCandidateItems(
  applications: JobApplicationLike[] | null | undefined,
  fallbackRecruiter = 'Unassigned',
): JobCandidateItem[] {
  const byId = new Map<string, JobCandidateItem>();
  const rows = Array.isArray(applications) ? applications : [];

  for (const app of rows) {
    const c = app.candidate;
    const id = String(app.candidateId || c?.id || '').trim();
    if (!id || byId.has(id)) continue;
    const fullName = `${c?.firstName || ''} ${c?.lastName || ''}`.trim() || '—';
    byId.set(id, {
      id,
      candidateName: fullName,
      email: c?.email ? String(c.email).trim() : undefined,
      avatar: c?.avatar ? String(c.avatar).trim() : null,
      designation: c?.currentTitle ? String(c.currentTitle).trim() : '',
      company: c?.currentCompany ? String(c.currentCompany).trim() : '',
      experience: resolveCandidateExperienceYears(c || {}),
      location: resolveCandidateLocationLabel(c || {}),
      phone: c?.phone ? String(c.phone).trim() : '',
      currentStage: resolveJobCandidateDisplayStage(
        String(app.status || c?.stage || 'Applied').trim() || 'Applied',
      ),
      isJobAppliedCandidate: true,
      score: '-',
      recruiter: fallbackRecruiter,
      interviewStatus: 'Not scheduled',
      lastActivity: '—',
    });
  }

  return Array.from(byId.values());
}

function pickMergedJobCandidateStage(...stages: Array<string | null | undefined>): string {
  const normalized = stages
    .map((value) => {
      const raw = String(value || '').trim();
      return mapApplicationStatusToCrmStage(raw) || raw;
    })
    .filter(Boolean);
  const appliedLike = normalized.filter(
    (stage) =>
      isJobAppliedDisplayStage(stage) ||
      stage.toLowerCase().includes('applied') ||
      stage.toLowerCase().includes('submit'),
  );
  const terminalHire = normalized.filter((stage) => stageLooksTerminalHire(stage));
  if (appliedLike.length && terminalHire.length) {
    return resolveJobCandidateDisplayStage(appliedLike[0]);
  }
  for (const stage of normalized) {
    if (!isMatchWorkflowStatus(stage)) {
      return resolveJobCandidateDisplayStage(stage);
    }
  }
  return resolveJobCandidateDisplayStage(normalized[0] || 'Applied');
}

/** Merge multiple seed lists (pipeline, applications, assigned) without duplicates. */
export function mergeJobCandidateSeeds(
  ...lists: JobCandidateItem[][]
): JobCandidateItem[] {
  const byId = new Map<string, JobCandidateItem>();
  for (const list of lists) {
    for (const row of list) {
      if (!row?.id) continue;
      const prev = byId.get(row.id);
      if (!prev) {
        byId.set(row.id, row);
        continue;
      }
      const mergedStage = pickMergedJobCandidateStage(prev.currentStage, row.currentStage);
      byId.set(row.id, {
        ...prev,
        ...row,
        candidateName: prev.candidateName || row.candidateName,
        email: prev.email || row.email,
        designation: prev.designation || row.designation,
        company: prev.company || row.company,
        experience: (() => {
          const a = resolveCandidateExperienceYears({ experience: prev.experience });
          const b = resolveCandidateExperienceYears({ experience: row.experience });
          return a > 0 ? a : b;
        })(),
        location: (() => {
          const a = resolveCandidateLocationLabel({ location: prev.location });
          const b = resolveCandidateLocationLabel({ location: row.location });
          return a !== '—' ? a : b;
        })(),
        recruiter: pickCandidateOwnerLabel(prev.recruiter, row.recruiter),
        currentStage: mergedStage,
        isJobAppliedCandidate: Boolean(
          prev.isJobAppliedCandidate ||
            row.isJobAppliedCandidate ||
            isJobAppliedDisplayStage(mergedStage),
        ),
        score: prev.score !== '-' ? prev.score : row.score,
      });
    }
  }
  return Array.from(byId.values());
}

/** Build seed rows from job pipeline entries (candidates in this job's pipeline). */
export function extractPipelineJobCandidateItems(
  backendJob: { pipelineStages?: PipelineStagePayload[] | null } | null | undefined,
  fallbackRecruiter = 'Unassigned',
): JobCandidateItem[] {
  const stages = Array.isArray(backendJob?.pipelineStages) ? backendJob.pipelineStages : [];
  const byId = new Map<string, JobCandidateItem>();

  for (const stage of stages) {
    const stageName = String(stage?.name || 'Pipeline').trim() || 'Pipeline';
    const entries = Array.isArray(stage?.entries) ? stage.entries : [];
    for (const entry of entries) {
      const c = entry?.candidate;
      const id = c?.id ? String(c.id) : '';
      if (!id || byId.has(id)) continue;
      const fullName = `${c?.firstName || ''} ${c?.lastName || ''}`.trim() || '—';
      byId.set(id, {
        id,
        candidateName: fullName,
        email: c?.email ? String(c.email).trim() : undefined,
        avatar: c?.avatar ? String(c.avatar).trim() : null,
        designation: c?.currentTitle ? String(c.currentTitle).trim() : '',
        company: c?.currentCompany ? String(c.currentCompany).trim() : '',
        experience: resolveCandidateExperienceYears(c || {}),
        location: resolveCandidateLocationLabel(c || {}),
        phone: c?.phone ? String(c.phone).trim() : '',
        currentStage: resolveJobCandidateDisplayStage(stageName),
        isJobAppliedCandidate: isJobAppliedDisplayStage(stageName),
        score: '-',
        recruiter: fallbackRecruiter,
        interviewStatus: 'Not scheduled',
        lastActivity: '—',
      });
    }
  }

  return Array.from(byId.values());
}

/** Load applied / assigned / pipeline-linked candidates and merge AI applied match scores. */
export async function loadJobAppliedCandidates(
  jobId: string,
  options?: {
    runPipeline?: boolean;
    refresh?: boolean;
    pipelineSeed?: JobCandidateItem[];
    fallbackRecruiter?: string;
  },
): Promise<JobCandidateItem[]> {
  const response = await apiGetMatches({
    jobId,
    source: 'applied',
    limit: 500,
    ...(options?.runPipeline ? { runPipeline: '1' } : {}),
    ...(options?.refresh ? { refresh: '1' } : {}),
  });
  const matchRows = unwrapMatchRows(response);
  const seed = options?.pipelineSeed ?? [];
  return mergeJobCandidatesWithAppliedMatches(seed, matchRows, options?.fallbackRecruiter ?? 'Unassigned');
}

export type ResolveMatchForSubmitResult = {
  matchId: string | null;
  error?: string;
};

/** Find or create a match row so submit-to-client can post to /matches/:id/submit */
export async function resolveMatchIdForSubmit(
  candidateId: string,
  jobId: string,
  score = 0,
  existingMatchId?: string,
): Promise<ResolveMatchForSubmitResult> {
  if (existingMatchId && isValidObjectId(existingMatchId)) {
    return { matchId: existingMatchId };
  }
  if (!isValidObjectId(candidateId) || !isValidObjectId(jobId)) {
    return { matchId: null, error: 'Candidate must be linked to a valid job before submitting to the client' };
  }

  try {
    const resolved = await apiResolveMatchForSubmit({
      candidateId,
      jobId,
      score: score > 0 ? score : 0,
    });
    const payload = extractApiData<{ id?: string }>(resolved);
    if (payload?.id) return { matchId: String(payload.id) };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '';
    if (message) return { matchId: null, error: message };
  }

  try {
    const matchesResponse = await apiGetMatches({ jobId, candidateId, limit: 20 });
    const rows = unwrapMatchRows(matchesResponse) as BackendMatch[];
    const found = pickRealMatchId(rows, candidateId);
    if (found) return { matchId: found };
  } catch {
    // fall through
  }

  try {
    const appliedResponse = await apiGetMatches({
      jobId,
      candidateId,
      limit: 20,
      source: 'applied',
    });
    const appliedRows = unwrapMatchRows(appliedResponse) as BackendMatch[];
    const found = pickRealMatchId(appliedRows, candidateId);
    if (found) return { matchId: found };
  } catch {
    // fall through
  }

  try {
    const created = await apiCreateMatch({
      candidateId,
      jobId,
      score: score > 0 ? score : 0,
      status: 'SUGGESTED',
    });
    const match = extractApiData<{ id?: string }>(created);
    if (match?.id) return { matchId: String(match.id) };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '';
    return {
      matchId: null,
      error: message || 'Unable to create match record for this candidate and job',
    };
  }

  return { matchId: null, error: 'Unable to create match record for this candidate and job' };
}
