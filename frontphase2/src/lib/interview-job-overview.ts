import type { Interview } from '../types/interview.types';

const ACTIVE_STATUSES = new Set<Interview['status']>(['Scheduled', 'Rescheduled']);
const VISIBLE_STATUSES = new Set<Interview['status']>([
  'Scheduled',
  'Rescheduled',
  'Completed',
  'No Show',
]);

export type InterviewJobSummary = {
  jobId: string;
  jobTitle: string;
  clientName: string;
  clientId?: string;
  candidateCount: number;
  interviewCount: number;
  rounds: number[];
  scheduledCount: number;
  completedCount: number;
  nextInterview: Interview | null;
  latestActivityAt: number;
};

function roundNumberFor(interview: Interview, roundNumberById: Record<string, number>): number {
  return roundNumberById[interview.id] || 1;
}

function activityTime(interview: Interview): number {
  const raw = interview.updatedAt || interview.scheduledAt || 0;
  const t = new Date(raw).getTime();
  return Number.isFinite(t) ? t : 0;
}

/** Jobs that currently have interviews, with per-job round and candidate counts. */
export function buildInterviewJobSummaries(
  interviews: Interview[],
  roundNumberById: Record<string, number>,
): InterviewJobSummary[] {
  const byJob = new Map<string, Interview[]>();
  for (const interview of interviews) {
    if (!VISIBLE_STATUSES.has(interview.status)) continue;
    const jobId = interview.job?.id;
    if (!jobId) continue;
    const list = byJob.get(jobId);
    if (list) list.push(interview);
    else byJob.set(jobId, [interview]);
  }

  const summaries: InterviewJobSummary[] = [];
  for (const [jobId, rows] of byJob) {
    const hasActive = rows.some((row) => ACTIVE_STATUSES.has(row.status));
    const hasCompleted = rows.some((row) => row.status === 'Completed');
    if (!hasActive && !hasCompleted) continue;

    const candidateIds = new Set(rows.map((row) => row.candidate.id));
    const rounds = [
      ...new Set(rows.map((row) => roundNumberFor(row, roundNumberById))),
    ].sort((a, b) => a - b);

    const upcoming = rows
      .filter((row) => ACTIVE_STATUSES.has(row.status))
      .sort(
        (a, b) =>
          new Date(a.scheduledAt || 0).getTime() - new Date(b.scheduledAt || 0).getTime(),
      );

    const first = rows[0];
    summaries.push({
      jobId,
      jobTitle: first.job.title,
      clientName: first.job.client,
      clientId: first.job.clientId,
      candidateCount: candidateIds.size,
      interviewCount: rows.length,
      rounds,
      scheduledCount: rows.filter((row) => ACTIVE_STATUSES.has(row.status)).length,
      completedCount: rows.filter((row) => row.status === 'Completed').length,
      nextInterview: upcoming[0] || null,
      latestActivityAt: Math.max(...rows.map(activityTime)),
    });
  }

  return summaries.sort((a, b) => b.latestActivityAt - a.latestActivityAt);
}

export function interviewsForJob(
  interviews: Interview[],
  jobId: string,
): Interview[] {
  return interviews.filter((interview) => interview.job.id === jobId);
}

export function uniqueRoundNumbersForJob(
  interviews: Interview[],
  jobId: string,
  roundNumberById: Record<string, number>,
): number[] {
  const rounds = new Set<number>();
  for (const interview of interviewsForJob(interviews, jobId)) {
    if (!VISIBLE_STATUSES.has(interview.status)) continue;
    rounds.add(roundNumberFor(interview, roundNumberById));
  }
  return [...rounds].sort((a, b) => a - b);
}

/** Candidate counts per chronological round for a job (for Round tab badges). */
export function candidateCountsByRoundForJob(
  interviews: Interview[],
  jobId: string,
  roundNumberById: Record<string, number>,
): Record<number, number> {
  const byRound = new Map<number, Set<string>>();
  for (const interview of interviewsForJob(interviews, jobId)) {
    if (!VISIBLE_STATUSES.has(interview.status)) continue;
    const round = roundNumberFor(interview, roundNumberById);
    const set = byRound.get(round) || new Set<string>();
    set.add(interview.candidate.id);
    byRound.set(round, set);
  }
  const out: Record<number, number> = {};
  for (const [round, candidates] of byRound) {
    out[round] = candidates.size;
  }
  return out;
}

export function interviewsForJobRound(
  interviews: Interview[],
  jobId: string,
  roundNumber: number | 'all',
  roundNumberById: Record<string, number>,
): Interview[] {
  const forJob = interviewsForJob(interviews, jobId);
  if (roundNumber === 'all') return forJob;
  return forJob.filter((interview) => roundNumberFor(interview, roundNumberById) === roundNumber);
}

export function paginateInterviewCandidateGroups(
  interviews: Interview[],
  page: number,
  pageSize: number,
): { items: Interview[]; totalGroups: number; totalPages: number } {
  const byCandidate = new Map<string, Interview[]>();
  for (const interview of interviews) {
    const list = byCandidate.get(interview.candidate.id);
    if (list) list.push(interview);
    else byCandidate.set(interview.candidate.id, [interview]);
  }

  const groups = [...byCandidate.values()].sort((a, b) => {
    const aMax = Math.max(...a.map(activityTime));
    const bMax = Math.max(...b.map(activityTime));
    return bMax - aMax;
  });

  const totalGroups = groups.length;
  const safeSize = Math.max(pageSize, 1);
  const totalPages = Math.max(1, Math.ceil(totalGroups / safeSize) || 1);
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const start = (safePage - 1) * safeSize;
  return {
    items: groups.slice(start, start + safeSize).flat(),
    totalGroups,
    totalPages,
  };
}

export function filterInterviewsForJobOverview(
  interviews: Interview[],
  params: {
    searchQuery: string;
    status: string;
    round: string;
    mode: string;
    interviewer: string;
    clientJob: string;
    matchingInterviewIds: string[];
    allStatusLabel: string;
  },
): Interview[] {
  const search = params.searchQuery.trim().toLowerCase();
  const matchingSet =
    params.matchingInterviewIds.length > 0 ? new Set(params.matchingInterviewIds) : null;

  return interviews.filter((interview) => {
    if (matchingSet && !matchingSet.has(interview.id)) return false;
    if (params.status !== params.allStatusLabel && interview.status !== params.status) return false;
    if (params.round !== 'All Rounds' && interview.round !== params.round) return false;
    if (params.mode !== 'All Modes' && interview.mode !== params.mode) return false;
    if (params.interviewer !== 'All Interviewers') {
      const hasInterviewer = interview.panel.some((member) => member.name === params.interviewer);
      if (!hasInterviewer) return false;
    }
    if (params.clientJob !== 'All Clients') {
      const label = `${interview.job.client} • ${interview.job.title}`;
      if (label !== params.clientJob) return false;
    }
    if (!search) return true;
    const haystack = [
      interview.candidate.name,
      interview.candidate.email,
      interview.job.title,
      interview.job.client,
      interview.notes,
      interview.round,
    ]
      .join(' ')
      .toLowerCase();
    return haystack.includes(search);
  });
}
