'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Download, Mail, MessageSquare, Trash2, UserPlus } from 'lucide-react';
import { downloadCsv } from '../../utils/csv';
import TopBar from '../../components/matches/TopBar';
import AIManualToggle from '../../components/matches/AIManualToggle';
import JobSelector from '../../components/matches/JobSelector';
import FilterBar from '../../components/matches/FilterBar';
import CandidateList from '../../components/matches/CandidateList';
import BulkEmailDrawer from '../../components/matches/BulkEmailDrawer';
import BulkPipelineDrawer from '../../components/matches/BulkPipelineDrawer';
import BulkRejectDrawer from '../../components/matches/BulkRejectDrawer';
import PipelineModal from '../../components/matches/PipelineModal';
import SubmitModal from '../../components/matches/SubmitModal';
import RejectModal from '../../components/matches/RejectModal';
import DuplicateAlert from '../../components/matches/DuplicateAlert';
import ProfileDrawer from '../../components/matches/ProfileDrawer';
import type { MatchCandidate, MatchFilters, MatchJob, MatchMode, OpenModal } from '../../components/matches/types';
import { 
  apiAddCandidateToPipeline,
  apiBulkAddMatchesToPipeline,
  apiBulkEmailMatches,
  apiBulkRejectMatches,
  apiCreateMatch,
  apiGetCandidates,
  apiGetClients,
  apiGetJobs,
  apiGetMatches,
  apiGetUsers,
  apiRejectMatch,
  apiSubmitMatch,
  apiToggleSavedMatch,
  apiUpdateCandidate,
  apiUpdateClient,
  apiUpdateContact,
  apiUpdateJob,
  type BackendCandidate,
  type BackendClient,
  type BackendJob,
  type BackendMatch,
  type BackendUser,
} from '../../lib/api';

// Show every match candidate by default (AI and manual). Recruiters can
// tighten filters via the FilterBar; the legacy 75% / 5-10 yrs preset hid
// most candidates on first load.
const INITIAL_FILTERS: MatchFilters = {
  skillMatch: 0,
  expMin: 0,
  expMax: 50,
  location: '',
  salaryMin: null,
  salaryMax: null,
  noticePeriod: null,
  savedOnly: false,
};

const CLEAR_FILTERS: MatchFilters = {
  skillMatch: 0,
  expMin: 0,
  expMax: 50,
  location: '',
  salaryMin: null,
  salaryMax: null,
  noticePeriod: null,
  savedOnly: false,
};

const statusRank = {
  Submitted: 0,
  Selected: 1,
  'Sent to Pipeline': 2,
  Reviewed: 3,
  New: 4,
  Rejected: 5,
} as const;

function matchesNoticePeriod(candidateNotice: string, filterNotice: MatchFilters['noticePeriod']) {
  if (!filterNotice) return true;
  if (filterNotice === 'Immediate') return candidateNotice.toLowerCase().includes('immediate');
  return candidateNotice.includes(filterNotice.replace('d', ''));
}

function unwrapCollection<T>(value: T[] | { data?: T[]; pagination?: any } | undefined | null): T[] {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.data)) return value.data;
  return [];
}

function mapJobToOption(job: BackendJob): MatchJob {
  const status = String(job.priority || job.status || '').toLowerCase();
  return {
    id: job.id,
    title: job.title,
    client: job.client?.companyName || 'Unknown Client',
    clientId: job.client?.id,
    clientContactId: undefined,
    clientEmail: undefined,
    location: job.location || '',
    clientLocation: '',
    status: status.includes('urgent')
      ? 'Urgent'
      : String(job.status || '').toUpperCase() === 'ON_HOLD'
      ? 'On Hold'
      : 'Open',
    skills: Array.isArray(job.skills) ? job.skills : [],
    preferredSkills: Array.isArray(job.preferredSkills) ? job.preferredSkills : [],
    experienceRequired: job.experienceRequired || null,
  };
}

/** Parse a free-form experience requirement (e.g. "3-5 years", "5+", "Min 2") into a min/max. */
function parseExperienceRequirement(raw?: string | null): { min: number; max: number } | null {
  if (!raw) return null;
  const text = String(raw).toLowerCase();
  const numbers = (text.match(/\d+(?:\.\d+)?/g) || []).map(Number);
  if (!numbers.length) return null;
  if (numbers.length === 1) {
    const value = numbers[0];
    if (text.includes('+') || text.includes('min')) return { min: value, max: value + 10 };
    if (text.includes('max') || text.includes('up to') || text.includes('<')) return { min: 0, max: value };
    return { min: Math.max(0, value - 1), max: value + 1 };
  }
  return { min: Math.min(numbers[0], numbers[1]), max: Math.max(numbers[0], numbers[1]) };
}

/**
 * Compute a quick client-side match score (0-100) for an applied candidate
 * that doesn't yet have a backend Match row. Mirrors the backend's broad
 * weighting: ~70% skills overlap, ~30% experience fit.
 */
function computeAppliedCandidateScore(
  candidateSkills: string[],
  candidateExperience: number,
  job: MatchJob | null,
): number {
  if (!job) return 0;
  const norm = (value: string) => String(value || '').trim().toLowerCase();
  const cSet = new Set((candidateSkills || []).map(norm).filter(Boolean));
  const requiredSkills = (job.skills || []).map(norm).filter(Boolean);
  const preferredSkills = (job.preferredSkills || []).map(norm).filter(Boolean);

  let skillScore = 0;
  if (requiredSkills.length) {
    const matched = requiredSkills.filter((skill) => cSet.has(skill)).length;
    skillScore = (matched / requiredSkills.length) * 70;
    if (preferredSkills.length) {
      const preferredMatched = preferredSkills.filter((skill) => cSet.has(skill)).length;
      skillScore += (preferredMatched / preferredSkills.length) * 5;
    }
  } else if (preferredSkills.length) {
    const preferredMatched = preferredSkills.filter((skill) => cSet.has(skill)).length;
    skillScore = (preferredMatched / preferredSkills.length) * 65;
  } else {
    skillScore = 55;
  }

  const range = parseExperienceRequirement(job.experienceRequired);
  let expScore = 30;
  if (range) {
    const { min, max } = range;
    if (candidateExperience >= min && candidateExperience <= max) {
      expScore = 30;
    } else if (candidateExperience < min) {
      expScore = min > 0 ? Math.max(5, (candidateExperience / min) * 30) : 30;
    } else {
      expScore = 22;
    }
  }

  return Math.min(100, Math.round(skillScore + expScore));
}

function primaryClientEmail(client?: BackendClient | null) {
  if (!client) return '';
  const firstContactEmail = Array.isArray(client.contacts)
    ? client.contacts.map((contact) => String(contact.email || '').trim()).find(Boolean)
    : '';
  return firstContactEmail || '';
}

function primaryClientContactId(client?: BackendClient | null) {
  if (!client) return '';
  return Array.isArray(client.contacts) ? client.contacts.find((contact) => Boolean(contact.id))?.id || '' : '';
}

function mapRecruiter(user: BackendUser) {
  return {
    id: user.id,
    name: user.name,
  };
}

function mapBackendMatch(match: BackendMatch): MatchCandidate {
  return {
    id: match.candidateId,
    matchId: match.id,
    isAppliedCandidate: false,
    name: match.name,
    photo: match.photo,
    initials: match.initials,
    score: match.score,
    skills: match.skills,
    experience: match.experience,
    location: match.location,
    salary: match.salary,
    noticePeriod: match.noticePeriod,
    status: match.status as MatchCandidate['status'],
    matchSource: match.matchSource,
    explanation: match.explanation,
    currentTitle: match.currentTitle,
    currentCompany: match.currentCompany,
    email: match.email,
    phone: match.phone,
    resumeName: match.resumeName,
    portfolioUrl: match.portfolioUrl,
    savedAt: match.savedAt,
    notes: match.notes,
    activity: match.activity,
    matchRating: match.matchRating || undefined,
    submittedHistory: match.submittedHistory || null,
  };
}

function mapCandidateNotes(candidate: BackendCandidate) {
  return (Array.isArray(candidate.internalNotes) ? candidate.internalNotes : []).map((note) => ({
    id: note.id,
    text: note.text,
    createdAt: note.createdAt,
    author: note.recruiter?.name || 'System',
  }));
}

function mapCandidateActivity(candidate: BackendCandidate) {
  return (Array.isArray(candidate.activityFeed) ? candidate.activityFeed : []).map((activity) => ({
    id: activity.id,
    title: activity.title || activity.type || 'Activity',
    description: activity.description || activity.title || '',
    timestamp: activity.timestamp,
  }));
}

function isCandidateAppliedToJob(candidate: BackendCandidate, jobId: string) {
  const assigned = Array.isArray(candidate.assignedJobs) ? candidate.assignedJobs : [];
  const matchedJobs = Array.isArray(candidate.matches) ? candidate.matches : [];
  if (assigned.includes(jobId)) return true;
  return matchedJobs.some((match) => String(match.job?.id || '') === jobId);
}

function mapAppliedCandidate(
  candidate: BackendCandidate,
  jobId: string,
  job: MatchJob | null,
): MatchCandidate {
  const fullName = `${candidate.firstName || ''} ${candidate.lastName || ''}`.trim() || 'Unknown Candidate';
  const skills = Array.isArray(candidate.skills) ? candidate.skills : [];
  const experience = Number(candidate.experience || 0);
  const salaryAmount = Number(candidate.expectedSalary || candidate.salary?.max || candidate.salary?.min || 0);
  const salaryCurrency = candidate.salary?.currency || 'INR';
  const matchingJobMatch = Array.isArray(candidate.matches)
    ? candidate.matches.find((match) => String(match.job?.id || '') === jobId)
    : undefined;
  // Prefer the persisted match score if one exists for this job; otherwise
  // compute a quick client-side score so applied candidates aren't all 0%.
  const score = matchingJobMatch?.score
    ? Math.round(Number(matchingJobMatch.score))
    : computeAppliedCandidateScore(skills, experience, job);

  return {
    id: candidate.id,
    matchId: matchingJobMatch?.id || '',
    isAppliedCandidate: true,
    name: fullName,
    photo: '',
    initials:
      fullName
        .split(' ')
        .map((part) => part[0])
        .filter(Boolean)
        .slice(0, 2)
        .join('')
        .toUpperCase() || 'NA',
    score,
    skills,
    experience,
    location: candidate.location || candidate.city || candidate.country || '-',
    salary: {
      expected: salaryAmount ? `${salaryCurrency} ${salaryAmount}` : '-',
      currency: salaryCurrency,
      amount: salaryAmount,
      fit: 'average',
    },
    noticePeriod: candidate.noticePeriod || 'Unknown',
    status: (matchingJobMatch?.status as MatchCandidate['status']) || 'Reviewed',
    matchSource: 'manual',
    explanation: {
      skills: 'partial',
      experience: 'partial',
      location: 'partial',
      salary: 'partial',
      text: 'Candidate is already applied for this job.',
      matchedSkills: skills.slice(0, 5),
      missingSkills: [],
      roleRequirement: 'Applied Candidate',
    },
    currentTitle: candidate.currentTitle || '-',
    currentCompany: candidate.currentCompany || '-',
    email: candidate.email || '-',
    phone: candidate.phone || '-',
    resumeName: candidate.resume ? 'Resume' : 'Not available',
    portfolioUrl: candidate.portfolio || undefined,
    savedAt: null,
    notes: mapCandidateNotes(candidate),
    activity: mapCandidateActivity(candidate),
    matchRating: undefined,
    submittedHistory: null,
  };
}

export default function MatchesPage() {
  const activeView: 'internal' = 'internal';
  const [activeTab, setActiveTab] = useState<MatchMode>('manual');
  const [jobs, setJobs] = useState<MatchJob[]>([]);
  const [selectedJob, setSelectedJob] = useState<MatchJob | null>(null);
  const [recruiters, setRecruiters] = useState<Array<{ id: string; name: string }>>([]);
  const [filters, setFilters] = useState<MatchFilters>(INITIAL_FILTERS);
  const [candidates, setCandidates] = useState<MatchCandidate[]>([]);
  const [savedMatches, setSavedMatches] = useState<string[]>([]);
  const [selectedCandidates, setSelectedCandidates] = useState<string[]>([]);
  const [expandedAnalysis, setExpandedAnalysis] = useState<string | null>(null);
  const [openModal, setOpenModal] = useState<OpenModal>(null);
  const [activeCandidateId, setActiveCandidateId] = useState<string | null>(null);
  const [profileDrawerCandidateId, setProfileDrawerCandidateId] = useState<string | null>(null);
  const [profileDrawerTab, setProfileDrawerTab] = useState<'overview' | 'resume' | 'ai' | 'notes'>('overview');
  const [sortBy, setSortBy] = useState('Highest Match');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [bulkActionLoading, setBulkActionLoading] = useState<'reject' | 'pipeline' | null>(null);
  const [bulkEmailLoading, setBulkEmailLoading] = useState(false);
  const [bulkEmailOpen, setBulkEmailOpen] = useState(false);
  const [bulkRejectOpen, setBulkRejectOpen] = useState(false);
  const [bulkPipelineOpen, setBulkPipelineOpen] = useState(false);

  const activeCandidate = useMemo(
    () => candidates.find((candidate) => candidate.id === activeCandidateId) || null,
    [activeCandidateId, candidates]
  );

  const drawerCandidate = useMemo(
    () => candidates.find((candidate) => candidate.id === profileDrawerCandidateId) || null,
    [candidates, profileDrawerCandidateId]
  );

  const refreshMatches = useCallback(async () => {
    if (!selectedJob) {
      setCandidates([]);
      setSavedMatches([]);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const [matchesResponse, candidatesResponse] = await Promise.all([
        apiGetMatches({
          jobId: selectedJob.id,
          source: activeTab,
          limit: 100,
        }),
        apiGetCandidates({ page: 1, limit: 500 }),
      ]);
      const matchItems = (matchesResponse.data.data || []).map(mapBackendMatch);

      const candidatesData =
        (candidatesResponse as any)?.data?.data ||
        (candidatesResponse as any)?.data?.items ||
        (candidatesResponse as any)?.data ||
        [];
      const allCandidates: BackendCandidate[] = Array.isArray(candidatesData) ? candidatesData : [];
      const matchedCandidateIds = new Set(matchItems.map((item) => item.id));
      const appliedCandidates = allCandidates
        .filter((candidate) => isCandidateAppliedToJob(candidate, selectedJob.id))
        .filter((candidate) => !matchedCandidateIds.has(candidate.id))
        .map((candidate) => mapAppliedCandidate(candidate, selectedJob.id, selectedJob));

      const mergedCandidates = [...matchItems, ...appliedCandidates];
      setCandidates(mergedCandidates);
      setSavedMatches(
        mergedCandidates
          .filter((candidate) => Boolean(candidate.savedAt))
          .map((candidate) => candidate.id)
      );
    } catch (fetchError: any) {
      setError(fetchError.message || 'Unable to load matches');
      setCandidates([]);
      setSavedMatches([]);
    } finally {
      setLoading(false);
    }
  }, [activeTab, selectedJob]);

  const reloadMatchMeta = useCallback(async () => {
    try {
      const [jobsResponse, usersResponse, clientsResponse] = await Promise.all([
        apiGetJobs({ status: 'OPEN', limit: 100 }),
        apiGetUsers({ role: 'RECRUITER', isActive: true, limit: 100 }),
        apiGetClients({ page: 1, limit: 500, includeContacts: true }),
      ]);

      const clients = unwrapCollection(clientsResponse.data) as BackendClient[];
      const clientEmailById = new Map<string, string>();
      const clientContactIdById = new Map<string, string>();
      const clientLocationById = new Map<string, string>();
      clients.forEach((client) => {
        clientEmailById.set(client.id, primaryClientEmail(client));
        clientContactIdById.set(client.id, primaryClientContactId(client));
        clientLocationById.set(client.id, client.location || '');
      });

      const jobOptions = unwrapCollection(jobsResponse.data)
        .map(mapJobToOption)
        .map((job) => ({
          ...job,
          clientEmail: job.clientId ? clientEmailById.get(job.clientId) || '' : '',
          clientContactId: job.clientId ? clientContactIdById.get(job.clientId) || '' : '',
          clientLocation: job.clientId ? clientLocationById.get(job.clientId) || '' : '',
        }));
      setJobs(jobOptions);
      setSelectedJob((current) => {
        if (!current) return jobOptions[0] || null;
        const updated = jobOptions.find((job) => job.id === current.id);
        return updated || current;
      });
      setRecruiters(unwrapCollection(usersResponse.data).map(mapRecruiter));
    } catch (fetchError: any) {
      setError(fetchError.message || 'Unable to load match metadata');
    }
  }, []);

  useEffect(() => {
    const loadMeta = async () => {
      setLoading(true);
      setError(null);
      try {
        await reloadMatchMeta();
      } catch (fetchError: any) {
        setError(fetchError.message || 'Unable to load match metadata');
      } finally {
        setLoading(false);
      }
    };

    void loadMeta();
  }, [reloadMatchMeta]);

  useEffect(() => {
    void refreshMatches();
  }, [refreshMatches]);

  useEffect(() => {
    setSelectedCandidates([]);
    setExpandedAnalysis(null);
    setActiveCandidateId(null);
    setProfileDrawerCandidateId(null);
  }, [selectedJob?.id, activeTab]);

  const handleMatchDataUpdated = useCallback(async () => {
    await reloadMatchMeta();
    await refreshMatches();
  }, [refreshMatches, reloadMatchMeta]);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(null), 1800);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const filteredCandidates = useMemo(() => {
    const list = candidates
      .filter((candidate) => candidate.score >= filters.skillMatch)
      .filter(
        (candidate) => candidate.experience >= filters.expMin && candidate.experience <= filters.expMax
      )
      .filter((candidate) =>
        filters.location ? candidate.location.toLowerCase().includes(filters.location.toLowerCase()) : true
      )
      .filter((candidate) =>
        filters.salaryMin !== null ? candidate.salary.amount >= filters.salaryMin : true
      )
      .filter((candidate) =>
        filters.salaryMax !== null ? candidate.salary.amount <= filters.salaryMax : true
      )
      .filter((candidate) => matchesNoticePeriod(candidate.noticePeriod, filters.noticePeriod))
      .filter((candidate) =>
        filters.savedOnly ? savedMatches.includes(candidate.id) : true
      );

    return [...list].sort((left, right) => {
      if (sortBy === 'Experience') return right.experience - left.experience;
      if (sortBy === 'Status') return statusRank[left.status] - statusRank[right.status];
      return right.score - left.score;
    });
  }, [activeTab, candidates, filters, savedMatches, sortBy]);

  const resetFilters = () => setFilters(CLEAR_FILTERS);

  const toggleCandidateSelection = (candidateId: string) => {
    setSelectedCandidates((previous) =>
      previous.includes(candidateId)
        ? previous.filter((id) => id !== candidateId)
        : [...previous, candidateId]
    );
  };

  /**
   * Manual mode merges in candidates that *applied* to a job but don't yet
   * have a backend Match record (no `matchId`). Save / Reject / Submit all
   * need a Match row, so the first time the user acts on such a candidate
   * we create one on the fly using the score we already computed.
   */
  const ensureMatchId = useCallback(
    async (candidate: MatchCandidate): Promise<string | null> => {
      if (candidate.matchId) return candidate.matchId;
      if (!selectedJob) return null;
      try {
        const response = await apiCreateMatch({
          candidateId: candidate.id,
          jobId: selectedJob.id,
          score: candidate.score,
          status: 'SUGGESTED',
        });
        const newMatchId = response?.data?.id;
        if (newMatchId) {
          updateCandidate(candidate.id, (current) => ({
            ...current,
            matchId: newMatchId,
            isAppliedCandidate: false,
          }));
          return newMatchId;
        }
      } catch (createError: any) {
        setError(createError.message || 'Unable to create match record');
        setToast(createError.message || 'Unable to create match record');
      }
      return null;
    },
    [selectedJob]
  );

  const openCandidateModal = (candidateId: string, modal: Exclude<OpenModal, null>) => {
    setActiveCandidateId(candidateId);
    setOpenModal(modal);
  };

  const openProfileDrawer = (
    candidateId: string,
    tab: 'overview' | 'resume' | 'ai' | 'notes' = 'overview'
  ) => {
    setProfileDrawerCandidateId(candidateId);
    setProfileDrawerTab(tab);
  };

  const handleExport = (candidateId: string) => {
    const candidate = candidates.find((item) => item.id === candidateId);
    if (!candidate) return;
    const blob = new Blob(
      [
        `Candidate: ${candidate.name}\nTitle: ${candidate.currentTitle}\nCompany: ${candidate.currentCompany}\nSkills: ${candidate.skills.join(', ')}`,
      ],
      { type: 'text/plain;charset=utf-8' }
    );
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${candidate.name.toLowerCase().replace(/\s+/g, '-')}-profile.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const updateCandidate = (candidateId: string, updater: (candidate: MatchCandidate) => MatchCandidate) => {
    setCandidates((previous) =>
      previous.map((candidate) => (candidate.id === candidateId ? updater(candidate) : candidate))
    );
  };

  const selectedMatchIds = useMemo(
    () =>
      candidates
        .filter((candidate) => selectedCandidates.includes(candidate.id))
        .map((candidate) => candidate.matchId)
        .filter(Boolean),
    [candidates, selectedCandidates]
  );

  const handleBulkReject = async (payload: { reason: string; notes: string }) => {
    if (!selectedMatchIds.length) return;

    setBulkActionLoading('reject');
    try {
      await apiBulkRejectMatches({
        matchIds: selectedMatchIds,
        reason: payload.reason.trim() || 'Bulk rejection',
        notes: payload.notes,
      });
      await refreshMatches();
      setSelectedCandidates([]);
      setBulkRejectOpen(false);
      setToast(`${selectedMatchIds.length} matches rejected`);
    } catch (bulkError: any) {
      setError(bulkError.message || 'Unable to reject selected matches');
      setToast(bulkError.message || 'Unable to reject selected matches');
      throw bulkError;
    } finally {
      setBulkActionLoading(null);
    }
  };

  const handleBulkPipeline = async (payload: {
    jobId: string;
    stage: string;
    recruiterId: string;
    notes: string;
}) => {
    if (!selectedCandidates.length || !selectedJob) return;

    setBulkActionLoading('pipeline');
    try {
      await apiBulkAddMatchesToPipeline({
        candidateIds: selectedCandidates,
        jobId: payload.jobId,
        stage: payload.stage,
        recruiterId: payload.recruiterId || recruiters[0]?.id,
        notes: payload.notes,
        priority: 'Medium',
      });
      await refreshMatches();
      setSelectedCandidates([]);
      setBulkPipelineOpen(false);
      setToast(`${selectedCandidates.length} candidates sent to pipeline`);
    } catch (bulkError: any) {
      setError(bulkError.message || 'Unable to send selected candidates to pipeline');
      setToast(bulkError.message || 'Unable to send selected candidates to pipeline');
      throw bulkError;
    } finally {
      setBulkActionLoading(null);
    }
  };

  const handleBulkEmail = async (payload: {
    subject: string;
    message: string;
    submissionType: string;
  }) => {
    if (!selectedMatchIds.length) return;

    setBulkEmailLoading(true);
    try {
      await apiBulkEmailMatches({
        matchIds: selectedMatchIds,
        subject: payload.subject,
        message: payload.message,
        submissionType: payload.submissionType,
      });
      await refreshMatches();
      setBulkEmailOpen(false);
      setToast(`Email sent for ${selectedMatchIds.length} candidates`);
    } catch (emailError: any) {
      setError(emailError.message || 'Unable to send client email');
      setToast(emailError.message || 'Unable to send client email');
      throw emailError;
    } finally {
      setBulkEmailLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-slate-900">
      <TopBar />

      <div className="border-b border-[#E5E7EB] bg-white px-6 py-4 sm:px-8">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
            <AIManualToggle activeTab={activeTab} onChange={setActiveTab} />
            {selectedJob ? <JobSelector jobs={jobs} selectedJob={selectedJob} onSelect={setSelectedJob} /> : null}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                const list = filteredCandidates;
                if (list.length === 0) {
                  setToast('No matches to export with current filters.');
                  return;
                }
                downloadCsv<MatchCandidate>(
                  `matches-${selectedJob?.title ? selectedJob.title.toLowerCase().replace(/\s+/g, '-') : 'list'}-${new Date().toISOString().slice(0, 10)}.csv`,
                  [
                    { id: 'name', accessor: (c) => c.name },
                    { id: 'currentTitle', accessor: (c) => c.currentTitle || '' },
                    { id: 'currentCompany', accessor: (c) => c.currentCompany || '' },
                    { id: 'experience', accessor: (c) => c.experience ?? '' },
                    { id: 'location', accessor: (c) => c.location || '' },
                    { id: 'email', accessor: (c) => c.email || '' },
                    { id: 'phone', accessor: (c) => c.phone || '' },
                    { id: 'matchScore', accessor: (c) => c.score ?? '' },
                    { id: 'status', accessor: (c) => c.status || '' },
                    { id: 'saved', accessor: (c) => (savedMatches.includes(c.id) ? 'true' : 'false') },
                    { id: 'skills', accessor: (c) => (c.skills || []).join('; ') },
                    { id: 'savedAt', accessor: (c) => c.savedAt || '' },
                  ],
                  list,
                );
                setToast(`Exported ${list.length} match${list.length === 1 ? '' : 'es'} to CSV`);
              }}
              className="inline-flex items-center gap-2 rounded-xl border border-[#E5E7EB] bg-white px-4 py-2 text-sm font-medium text-[#374151] shadow-sm hover:bg-[#F9FAFB]"
              title="Export visible matches to CSV"
            >
              <Download className="h-4 w-4" />
              Export
            </button>
          </div>
        </div>
      </div>

      <FilterBar filters={filters} onChange={setFilters} onReset={resetFilters} />

      {error ? (
        <div className="mx-auto mt-4 max-w-6xl rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
              </div>
      ) : null}

      <CandidateList
        candidates={loading ? [] : filteredCandidates}
        activeTab={activeTab}
        activeView={activeView}
        selectedCandidates={selectedCandidates}
        savedMatches={savedMatches}
        expandedAnalysis={expandedAnalysis}
        sortBy={sortBy}
        savedOnly={filters.savedOnly}
        onSortChange={setSortBy}
        onToggleSelect={toggleCandidateSelection}
        onToggleSave={(candidateId) => {
          const candidate = candidates.find((item) => item.id === candidateId);
          if (!candidate) return;
          const nextSaved = !savedMatches.includes(candidateId);

          void (async () => {
            try {
              const matchId = await ensureMatchId(candidate);
              if (!matchId) return;
              await apiToggleSavedMatch(matchId, nextSaved);
              setSavedMatches((previous) =>
                nextSaved ? [...previous, candidateId] : previous.filter((id) => id !== candidateId)
              );
              updateCandidate(candidateId, (current) => ({
                ...current,
                matchId,
                savedAt: nextSaved ? new Date().toISOString() : null,
              }));
              setToast(
                nextSaved
                  ? 'Match saved – use "Saved only" in the filter bar to view'
                  : 'Saved match removed'
              );
            } catch (toggleError: any) {
              setError(toggleError.message || 'Unable to update saved match');
              setToast(toggleError.message || 'Unable to update saved match');
            }
          })();
        }}
        onToggleAnalysis={(candidateId) =>
          setExpandedAnalysis((previous) => (previous === candidateId ? null : candidateId))
        }
        onViewProfile={openProfileDrawer}
        onOpenPipeline={(candidateId) => openCandidateModal(candidateId, 'pipeline')}
        onOpenSubmit={(candidateId) => {
          const candidate = candidates.find((item) => item.id === candidateId);
          if (!candidate) return;
          if (candidate.submittedHistory && candidate.status === 'Submitted') {
            openCandidateModal(candidateId, 'duplicate');
            return;
          }
          // Applied-only candidates have no Match row yet; bootstrap one so
          // Submit-to-Client (which posts to /matches/:id/submit) works.
          void (async () => {
            const matchId = await ensureMatchId(candidate);
            if (!matchId) return;
            openCandidateModal(candidateId, 'submit');
          })();
        }}
        onOpenReject={(candidateId) => {
          const candidate = candidates.find((item) => item.id === candidateId);
          if (!candidate) return;
          // For applied candidates without a backend Match row, create one on
          // the fly so the Reject modal has something to act on.
          void (async () => {
            const matchId = await ensureMatchId(candidate);
            if (!matchId) return;
            openCandidateModal(candidateId, 'reject');
          })();
        }}
        onExport={handleExport}
        onRateMatch={(candidateId, rating) =>
          updateCandidate(candidateId, (candidate) => ({ ...candidate, matchRating: rating }))
        }
        onResetFilters={resetFilters}
      />

      <AnimatePresence>
        {activeView === 'internal' && selectedCandidates.length ? (
    <motion.div 
      initial={{ y: 100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-8 left-1/2 z-50 w-full max-w-4xl -translate-x-1/2 px-4"
    >
            <div className="flex items-center justify-between rounded-2xl border border-slate-700 bg-[#0f172a] p-4 text-white shadow-2xl">
        <div className="flex items-center gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#2563EB] font-bold">
                  {selectedCandidates.length}
          </div>
          <div>
                  <p className="font-semibold">Candidates Selected</p>
                  <button
                    type="button"
                    onClick={() => setSelectedCandidates([])}
                    className="text-xs text-slate-400 underline hover:text-white"
                  >
                    Deselect all
                  </button>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setBulkEmailOpen(true)}
                  disabled={bulkActionLoading !== null || bulkEmailLoading}
                  className="rounded-xl p-3 text-slate-300 hover:bg-slate-800 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Mail size={18} />
          </button>
                <button type="button" className="rounded-xl p-3 text-slate-300 hover:bg-slate-800 hover:text-white">
                  <MessageSquare size={18} />
          </button>
                <div className="mx-2 h-8 w-px bg-slate-700" />
                <button
                  type="button"
                  onClick={() => setBulkRejectOpen(true)}
                  disabled={bulkActionLoading !== null}
                  className="inline-flex items-center gap-2 rounded-xl bg-rose-600/10 px-4 py-2 text-sm font-semibold text-rose-400 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Trash2 size={16} />
                  {bulkActionLoading === 'reject' ? 'Rejecting...' : 'Bulk Reject'}
          </button>
                <button
                  type="button"
                  onClick={() => setBulkPipelineOpen(true)}
                  disabled={bulkActionLoading !== null || !selectedJob}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#2563EB] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <UserPlus size={16} />
                  {bulkActionLoading === 'pipeline' ? 'Sending...' : 'Bulk Send to Pipeline'}
          </button>
        </div>
      </div>
    </motion.div>
        ) : null}
      </AnimatePresence>

      <PipelineModal
        isOpen={openModal === 'pipeline'}
        candidate={activeCandidate}
        jobs={jobs}
        recruiters={recruiters}
        onClose={() => setOpenModal(null)}
        onSubmit={async ({ jobId, stage, recruiterId, notes }) => {
          if (!activeCandidateId) return;
          try {
            await apiAddCandidateToPipeline(activeCandidateId, {
              jobId,
              stage,
              recruiterId,
              priority: 'Medium',
              notes,
            });
            await refreshMatches();
            setOpenModal(null);
            setToast('Candidate sent to pipeline');
          } catch (submitError: any) {
            setError(submitError.message || 'Unable to send candidate to pipeline');
            setToast(submitError.message || 'Unable to send candidate to pipeline');
            throw submitError;
          }
        }}
      />

      <SubmitModal
        isOpen={openModal === 'submit'}
        candidate={activeCandidate}
        selectedJob={selectedJob || jobs[0] || { id: '', title: 'Select Job', client: 'No Client', status: 'Open' }}
        onClose={() => setOpenModal(null)}
        onUpdated={handleMatchDataUpdated}
        onSubmit={async ({ message, submissionType }) => {
          if (!activeCandidate?.matchId) {
            setError('This candidate is not linked to a match record for the selected job.');
            setToast('Unable to submit candidate without a match record');
            return;
          }
          try {
            await apiSubmitMatch(activeCandidate.matchId, {
              message,
              notifyClient: true,
              submissionType,
            });
            await refreshMatches();
            setOpenModal(null);
            setToast('Candidate submitted and email sent to client');
          } catch (submitError: any) {
            setError(submitError.message || 'Unable to submit candidate');
            setToast(submitError.message || 'Unable to submit candidate');
            throw submitError;
          }
        }}
      />

      <RejectModal
        isOpen={openModal === 'reject'}
        candidate={activeCandidate}
        onClose={() => setOpenModal(null)}
        onReject={async ({ reason, notes }) => {
          if (!activeCandidate?.matchId) return;
          try {
            await apiRejectMatch(activeCandidate.matchId, { reason, notes });
            await refreshMatches();
            setOpenModal(null);
            setToast('Match rejected');
          } catch (rejectError: any) {
            setError(rejectError.message || 'Unable to reject match');
            setToast(rejectError.message || 'Unable to reject match');
            throw rejectError;
          }
        }}
      />

      <DuplicateAlert
        isOpen={openModal === 'duplicate'}
        candidate={activeCandidate}
        previousSubmission={activeCandidate?.submittedHistory || null}
        onClose={() => setOpenModal(null)}
        onViewHistory={() => {
          if (!activeCandidateId) return;
          openProfileDrawer(activeCandidateId, 'notes');
          setOpenModal(null);
        }}
        onSubmitAnyway={() => setOpenModal('submit')}
      />

      <BulkRejectDrawer
        isOpen={bulkRejectOpen}
        selectedCount={selectedCandidates.length}
        onClose={() => setBulkRejectOpen(false)}
        onSubmit={handleBulkReject}
      />

      <BulkEmailDrawer
        isOpen={bulkEmailOpen}
        selectedCount={selectedCandidates.length}
        selectedJob={selectedJob}
        onClose={() => setBulkEmailOpen(false)}
        onSubmit={handleBulkEmail}
      />

      <BulkPipelineDrawer
        isOpen={bulkPipelineOpen}
        selectedCount={selectedCandidates.length}
        jobs={jobs}
        recruiters={recruiters}
        selectedJobId={selectedJob?.id}
        onClose={() => setBulkPipelineOpen(false)}
        onSubmit={handleBulkPipeline}
      />

      <ProfileDrawer
        isOpen={Boolean(drawerCandidate)}
        candidate={drawerCandidate}
        initialTab={profileDrawerTab}
        onClose={() => setProfileDrawerCandidateId(null)}
      />

      <AnimatePresence>
        {toast ? (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            className="fixed right-6 top-6 z-[120] rounded-xl bg-[#111827] px-4 py-3 text-sm font-medium text-white shadow-xl"
          >
            {toast}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
