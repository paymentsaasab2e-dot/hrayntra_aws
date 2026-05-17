import { apiCreateMatch, apiGetMatches, type BackendMatch } from './api';
import type { JobCandidateItem } from '../components/drawers/JobDetailsDrawer';

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

export function backendMatchToJobCandidateItem(
  match: BackendMatch,
  fallbackRecruiter = 'Unassigned',
): JobCandidateItem {
  const score =
    typeof match.score === 'number' && match.score > 0
      ? `${Math.round(match.score)}%`
      : '-';
  return {
    id: match.candidateId || match.id,
    candidateName: match.name?.trim() || '—',
    email: match.email || undefined,
    avatar: match.photo?.trim() || null,
    designation: match.currentTitle?.trim() || '',
    company: match.currentCompany?.trim() || '',
    experience: typeof match.experience === 'number' ? match.experience : 0,
    location: match.location?.trim() || '—',
    phone: match.phone?.trim() || '',
    currentStage: match.status || 'Applied',
    score,
    recruiter: match.createdBy?.name || fallbackRecruiter,
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
      experience:
        candidate.experience ??
        (typeof match.experience === 'number' ? match.experience : 0),
      location: candidate.location || match.location || '—',
      phone: candidate.phone || match.phone || '',
      currentStage: candidate.currentStage || match.status || 'Applied',
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
        experience: typeof c?.experience === 'number' ? c.experience : 0,
        location: c?.location ? String(c.location).trim() : '—',
        phone: c?.phone ? String(c.phone).trim() : '',
        currentStage: stageName,
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

/** Find or create a match row so submit-to-client can post to /matches/:id/submit */
export async function resolveMatchIdForSubmit(
  candidateId: string,
  jobId: string,
  score = 0,
  existingMatchId?: string,
): Promise<string | null> {
  if (existingMatchId) return existingMatchId;

  try {
    const matchesResponse = await apiGetMatches({ jobId, candidateId, limit: 20 });
    const rows = unwrapMatchRows(matchesResponse) as BackendMatch[];
    const existing = rows.find((row) => String(row.candidateId || '') === candidateId);
    const rawId = String(existing?.id || '');
    if (rawId && !rawId.startsWith('applied-pending-')) return rawId;
  } catch {
    // fall through to create
  }

  try {
    const created = await apiCreateMatch({
      candidateId,
      jobId,
      score: score > 0 ? score : undefined,
      status: 'SUGGESTED',
    });
    return created?.data?.id || null;
  } catch {
    return null;
  }
}
