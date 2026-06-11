import type { Candidate } from '../app/candidate/components/CandidateTable';
import type { CandidateProfileDrawerData } from '../components/drawers/CandidateProfileDrawer';
import type { JobCandidateItem } from '../components/drawers/JobDetailsDrawer';
import { resolveJobCandidateDisplayStage } from './jobAppliedMatches';
import { getTagColor } from './mapCandidateProfile';
import { normalizeCandidateSkillLabels } from './normalizeCandidateSkills';

/** Seed profile drawer from a candidates table row before API load completes. */
export function candidateTableRowToProfileStub(
  candidate: Candidate,
  opts?: { jobId?: string | null; jobTitle?: string | null },
): CandidateProfileDrawerData {
  const jobTitle = opts?.jobTitle ?? candidate.assignedJobs[0] ?? '—';
  return {
    id: candidate.id,
    name: candidate.name,
    currentTitle: candidate.designation,
    currentCompany: candidate.company,
    designation: candidate.designation,
    stage: candidate.stage,
    experience: candidate.experience,
    location: candidate.location,
    email: candidate.email,
    phone: candidate.phone,
    expectedSalary: candidate.salary.expected || '—',
    noticePeriod: candidate.noticePeriod || '—',
    assignedJob: jobTitle,
    assignedJobId: opts?.jobId ?? candidate.pipelineJobId ?? null,
    recruiter: candidate.owner,
    source: candidate.source,
    isPhase1Candidate: candidate.isPhase1Candidate,
    availability: 'limited',
    summary: null,
    resumeUrl: null,
    tags: normalizeCandidateSkillLabels(candidate.skills).map((tag) => ({
      id: `tag-${tag.toLowerCase().replace(/\s+/g, '-')}`,
      label: tag,
      color: getTagColor(tag),
    })),
    notes: [],
    files: [],
    scheduledInterviews: [],
    activity: [],
  };
}

/** Profile stub for AddToPipelineModal when moving stage from the job drawer table. */
export function jobCandidateItemToMoveStageProfile(
  item: JobCandidateItem,
  job: { id: string; title: string; department?: string | null; clientId?: string | null; clientName?: string | null },
): CandidateProfileDrawerData {
  const stage = resolveJobCandidateDisplayStage(item.currentStage);
  const jobId = String(job.id);
  return {
    id: item.id,
    name: item.candidateName,
    email: item.email || null,
    phone: item.phone || '—',
    stage,
    experience: item.experience ?? 0,
    location: item.location || '—',
    assignedJob: job.title,
    assignedJobId: jobId,
    assignedJobs: [
      {
        id: jobId,
        title: job.title,
        department: job.department || job.clientName || null,
        stage,
        status: null,
        isPipelineEntry: true,
      },
    ],
    recruiter: item.recruiter || 'Unassigned',
    source: '—',
    availability: 'limited',
    summary: null,
    resumeUrl: null,
    tags: [],
    notes: [],
    files: [],
    scheduledInterviews: [],
    activity: [],
  };
}
