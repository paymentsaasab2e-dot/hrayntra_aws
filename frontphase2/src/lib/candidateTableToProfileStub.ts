import type { Candidate } from '../app/candidate/components/CandidateTable';
import type { CandidateProfileDrawerData } from '../components/drawers/CandidateProfileDrawer';
import { getTagColor } from './mapCandidateProfile';

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
    availability: 'limited',
    summary: null,
    resumeUrl: null,
    tags: candidate.skills.map((tag) => ({
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
