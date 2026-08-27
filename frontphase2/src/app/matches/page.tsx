'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Download, Mail, MessageSquare, Sparkles, Trash2, UserPlus, RefreshCw, GitMerge, Users } from 'lucide-react';
import { downloadCsv } from '../../utils/csv';
import { ExportColumnsModal } from '../../components/export/ExportColumnsModal';
import { buildMatchesCsvColumns, MATCHES_EXPORT_COLUMNS } from '../../lib/export/matchesExportColumns';
import { TableColumnsMenu } from '../../components/table/TableColumnsMenu';
import { usePersistedColumnVisibility } from '../../hooks/usePersistedColumnVisibility';
import { MATCH_TABLE_COLUMNS } from '../../lib/tableColumns/moduleTableColumns';
import { Toaster } from 'sonner';
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
import {
  CandidateProfileDrawer,
  type CandidateProfileDrawerData,
  type CandidatePipelineJobOption,
  type CandidatePipelineRecruiterOption,
  type CandidateTagItem,
} from '../../components/drawers/CandidateProfileDrawer';
import type { MatchCandidate, MatchFilters, MatchJob, MatchMode, OpenModal } from '../../components/matches/types';
import { AI_SCORE_TIERS, computeAiTierStats } from '../../components/matches/types';
import { mapBackendMatch } from '../../lib/mapBackendMatch';
import {
  apiAddCandidateNote,
  apiAddCandidateTag,
  apiAddCandidateToPipeline,
  apiRemoveCandidateFromPipeline,
  apiBulkAddMatchesToPipeline,
  apiBulkEmailMatches,
  apiBulkRejectMatches,
  apiCreateMatch,
  apiDeleteCandidateNote,
  apiGetCandidate,
  apiGetCandidates,
  apiGetClients,
  apiGetJobs,
  apiGetMatches,
  apiGetUsers,
  apiPinCandidateNote,
  apiRejectMatch,
  apiSubmitMatch,
  apiToggleSavedMatch,
  apiUpdateCandidate,
  apiUpdateCandidateNote,
  apiUpdateClient,
  apiUpdateContact,
  apiUpdateJob,
  apiRemoveCandidateTag,
  type BackendCandidate,
  type BackendClient,
  type BackendJob,
  type BackendMatch,
  type BackendUser,
} from '../../lib/api';
import {
  enrichProfileWithMatchData,
  extractApiData,
  getTagColor,
  isValidObjectId,
  mapCandidateProfile,
} from '../../lib/mapCandidateProfile';
import { usePageAutoRefresh } from '../../hooks/usePageAutoRefresh';
import { useWorkspaceEntityAlerts } from '../../hooks/useWorkspaceEntityAlerts';

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

function isUnknownNoticePeriod(notice: string) {
  const normalized = String(notice || '')
    .trim()
    .toLowerCase();
  return !normalized || normalized === 'not shared' || normalized === 'unknown' || normalized === 'n/a';
}

function matchesNoticePeriod(candidateNotice: string, filterNotice: MatchFilters['noticePeriod']) {
  if (!filterNotice) return true;
  if (isUnknownNoticePeriod(candidateNotice)) return true;
  if (filterNotice === 'Immediate') return candidateNotice.toLowerCase().includes('immediate');
  return candidateNotice.includes(filterNotice.replace('d', ''));
}

function dedupeMatchCandidates(rows: MatchCandidate[]): MatchCandidate[] {
  const bestById = new Map<string, MatchCandidate>();
  for (const row of rows) {
    const existing = bestById.get(row.id);
    if (!existing) {
      bestById.set(row.id, row);
      continue;
    }
    const preferRow =
      (row.isAppliedCandidate && !existing.isAppliedCandidate) ||
      (row.isAppliedCandidate === existing.isAppliedCandidate && row.score > existing.score);
    if (preferRow) bestById.set(row.id, row);
  }
  return Array.from(bestById.values());
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
  const [profileDrawerEditOpenToken, setProfileDrawerEditOpenToken] = useState<number | null>(null);
  const [selectedCandidateProfile, setSelectedCandidateProfile] = useState<CandidateProfileDrawerData | null>(null);
  const [loadingCandidateProfile, setLoadingCandidateProfile] = useState(false);
  const [availableDrawerTags, setAvailableDrawerTags] = useState<CandidateTagItem[]>([]);
  const [sortBy, setSortBy] = useState('Highest Match');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportMatches, setExportMatches] = useState<MatchCandidate[]>([]);
  const matchColumnVisibility = usePersistedColumnVisibility(
    'matches.visibleColumns',
    MATCH_TABLE_COLUMNS,
  );
  const [bulkActionLoading, setBulkActionLoading] = useState<'reject' | 'pipeline' | null>(null);
  const [bulkEmailLoading, setBulkEmailLoading] = useState(false);
  const [bulkEmailOpen, setBulkEmailOpen] = useState(false);
  const [bulkRejectOpen, setBulkRejectOpen] = useState(false);
  const [bulkPipelineOpen, setBulkPipelineOpen] = useState(false);
  const [aiPipelineRunning, setAiPipelineRunning] = useState(false);
  const [appliedPipelineRunning, setAppliedPipelineRunning] = useState(false);
  const prevActiveTabRef = useRef<MatchMode>(activeTab);
  const prevSelectedJobIdRef = useRef<string | null>(null);

  const activeCandidate = useMemo(
    () => candidates.find((candidate) => candidate.id === activeCandidateId) || null,
    [activeCandidateId, candidates]
  );

  const drawerMatchCandidate = useMemo(
    () => candidates.find((candidate) => candidate.id === profileDrawerCandidateId) || null,
    [candidates, profileDrawerCandidateId]
  );

  const drawerPipelineJobs = useMemo<CandidatePipelineJobOption[]>(
    () =>
      jobs.map((job) => ({
        id: job.id,
        title: job.title,
        department: job.client || null,
      })),
    [jobs]
  );

  const drawerRecruiters = useMemo<CandidatePipelineRecruiterOption[]>(
    () =>
      recruiters.map((recruiter) => ({
        id: recruiter.id,
        name: recruiter.name,
        avatar: null,
      })),
    [recruiters]
  );

  const currentDrawerUser = useMemo(
    () => ({
      id: 'current-user',
      name: selectedCandidateProfile?.recruiter || 'You',
      avatar: null as string | null,
    }),
    [selectedCandidateProfile?.recruiter]
  );

  const refreshMatches = useCallback(async (opts?: {
    forcePipeline?: boolean;
    runPipeline?: boolean;
    source?: MatchMode;
  }) => {
    if (!selectedJob) {
      setCandidates([]);
      setSavedMatches([]);
      return [] as MatchCandidate[];
    }

    const tab = opts?.source ?? activeTab;
    const apiSource = tab === 'manual' || tab === 'applied' ? 'applied' : 'ai';

    setLoading(true);
    setError(null);
    try {
      const runPipeline =
        (apiSource === 'ai' || apiSource === 'applied') &&
        Boolean(opts?.runPipeline || opts?.forcePipeline);
      const matchesResponse = await apiGetMatches({
        jobId: selectedJob.id,
        source: apiSource,
        limit: 100,
        ...(runPipeline ? { runPipeline: '1' } : {}),
        ...(opts?.forcePipeline && (apiSource === 'ai' || apiSource === 'applied') ? { refresh: '1' } : {}),
      });
      const matchPayload = matchesResponse.data;
      const matchRows = Array.isArray(matchPayload)
        ? matchPayload
        : Array.isArray(matchPayload?.data)
          ? matchPayload.data
          : [];
      const mergedCandidates = dedupeMatchCandidates(matchRows.map(mapBackendMatch));
      setCandidates(mergedCandidates);
      setSavedMatches(
        mergedCandidates
          .filter((candidate) => Boolean(candidate.savedAt))
          .map((candidate) => candidate.id)
      );
      return mergedCandidates;
    } catch (fetchError: any) {
      setError(fetchError.message || 'Unable to load matches');
      setCandidates([]);
      setSavedMatches([]);
      return [] as MatchCandidate[];
    } finally {
      setLoading(false);
    }
  }, [activeTab, selectedJob]);

  const reloadMatchMeta = useCallback(async () => {
    try {
      const [jobsResponse, usersResponse, clientsResponse] = await Promise.all([
        apiGetJobs({ status: 'OPEN', limit: 100 }),
        apiGetUsers({ assignable: true, role: 'RECRUITER', isActive: true, limit: 100 }),
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

  const handleRunAiMatches = useCallback(async () => {
    if (!selectedJob) return;
    setAiPipelineRunning(true);
    setError(null);
    try {
      const list = await refreshMatches({
        forcePipeline: true,
        runPipeline: true,
        source: 'ai',
      });
      const sorted = [...list].sort((a, b) => b.score - a.score);
      const top = sorted[0];
      const stats = computeAiTierStats(list);
      const phase1Count = list.filter((c) => c.isPhase1Candidate).length;
      if (top) {
        const summary = AI_SCORE_TIERS.map((t) => `${t.label}: ${stats[t.id]}`).join(' · ');
        const phase1Note = phase1Count ? ` · ${phase1Count} Phase 1` : '';
        setToast(
          `AI complete — ${list.length} scored. Top: ${top.name} (${top.score}%). ${summary}${phase1Note}`
        );
      } else {
        setToast('AI matching complete');
      }
    } catch (runError: unknown) {
      setError(runError instanceof Error ? runError.message : 'Unable to run AI matching');
    } finally {
      setAiPipelineRunning(false);
    }
  }, [refreshMatches, selectedJob]);

  const handleRunAppliedMatches = useCallback(async () => {
    if (!selectedJob) return;
    setAppliedPipelineRunning(true);
    setError(null);
    try {
      const list = await refreshMatches({
        forcePipeline: true,
        runPipeline: true,
        source: 'applied',
      });
      const sorted = [...list].sort((a, b) => b.score - a.score);
      const top = sorted[0];
      if (top && top.score > 0) {
        setToast(
          `Applied matching complete — ${list.length} candidate(s). Top: ${top.name} (${top.score}%).`
        );
      } else if (list.length) {
        setToast(
          `${list.length} applied candidate(s) loaded. Run AI Applied Matches to score them.`
        );
      } else {
        setToast('No candidates assigned to this job in your workspace yet.');
      }
    } catch (runError: unknown) {
      setError(runError instanceof Error ? runError.message : 'Unable to run applied matching');
    } finally {
      setAppliedPipelineRunning(false);
    }
  }, [refreshMatches, selectedJob]);

  const handleMatchTabChange = useCallback((mode: MatchMode) => {
    setActiveTab(mode);
  }, []);

  useEffect(() => {
    if (!selectedJob) {
      prevSelectedJobIdRef.current = null;
      setCandidates([]);
      setSavedMatches([]);
      return;
    }

    const jobChanged = prevSelectedJobIdRef.current !== selectedJob.id;
    const switchedToAi = prevActiveTabRef.current !== 'ai' && activeTab === 'ai';
    prevSelectedJobIdRef.current = selectedJob.id;
    prevActiveTabRef.current = activeTab;

    if (activeTab === 'ai' && (switchedToAi || jobChanged)) {
      void handleRunAiMatches();
      return;
    }

    void refreshMatches({ source: activeTab });
  }, [selectedJob?.id, activeTab, refreshMatches, handleRunAiMatches, selectedJob]);

  useEffect(() => {
    setSelectedCandidates([]);
    setExpandedAnalysis(null);
    setActiveCandidateId(null);
    setProfileDrawerCandidateId(null);
    setSelectedCandidateProfile(null);
  }, [selectedJob?.id, activeTab]);

  const loadCandidateProfile = useCallback(
    async (candidateId: string, matchCandidate?: MatchCandidate | null) => {
      if (!isValidObjectId(candidateId)) return null;
      const backendCandidate = extractApiData<BackendCandidate>(await apiGetCandidate(candidateId));
      let profile = mapCandidateProfile(backendCandidate);
      const match =
        matchCandidate ?? candidates.find((item) => item.id === candidateId) ?? null;
      profile = enrichProfileWithMatchData(profile, match, selectedJob?.title || null);
      setSelectedCandidateProfile(profile);
      if (profile.tags?.length) {
        setAvailableDrawerTags((prev) => {
          const merged = [...prev];
          for (const tag of profile.tags || []) {
            if (!merged.some((t) => t.id === tag.id || t.label === tag.label)) {
              merged.push(tag);
            }
          }
          return merged;
        });
      }
      return profile;
    },
    [candidates, selectedJob?.title]
  );

  useEffect(() => {
    if (!profileDrawerCandidateId) {
      setSelectedCandidateProfile(null);
      setLoadingCandidateProfile(false);
      return;
    }

    let cancelled = false;
    const match = candidates.find((item) => item.id === profileDrawerCandidateId) || null;
    void (async () => {
      setLoadingCandidateProfile(true);
      try {
        await loadCandidateProfile(profileDrawerCandidateId, match);
      } catch (loadError: unknown) {
        if (!cancelled) {
          setError(
            loadError instanceof Error ? loadError.message : 'Unable to load candidate profile'
          );
        }
      } finally {
        if (!cancelled) setLoadingCandidateProfile(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [profileDrawerCandidateId, candidates, loadCandidateProfile]);

  const handleMatchDataUpdated = useCallback(async () => {
    await reloadMatchMeta();
    await refreshMatches();
  }, [refreshMatches, reloadMatchMeta]);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(null), 4500);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  // Reusable auto-refresh — re-runs `refreshMatches` while visible / on focus
  // / on candidate-or-job changes. Same hook used across the app.
  usePageAutoRefresh(() => refreshMatches(), {
    events: ['jobportal:candidates-changed', 'jobportal:jobs-changed'],
  });

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

  const { alertsByEntityId: workspaceAlertsByEntityId } = useWorkspaceEntityAlerts(
    'CANDIDATE',
    filteredCandidates.map((candidate) => candidate.id),
  );

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
    _tab: 'overview' | 'resume' | 'ai' | 'notes' = 'overview',
    openEditDirectly = false
  ) => {
    setProfileDrawerCandidateId(candidateId);
    setProfileDrawerEditOpenToken(openEditDirectly ? Date.now() : null);
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

  const exportColumnsForModal = useMemo(() => {
    const savedSet = new Set(savedMatches);
    return MATCHES_EXPORT_COLUMNS.map((col) =>
      col.id === 'saved'
        ? {
            ...col,
            accessor: (c: MatchCandidate) => (savedSet.has(c.id) ? 'true' : 'false'),
          }
        : col,
    );
  }, [savedMatches]);

  const openExportModal = useCallback(() => {
    const list = filteredCandidates;
    setExportMatches(list);
    setExportModalOpen(true);
    if (list.length === 0) {
      setToast('No matches to export with current filters.');
    }
  }, [filteredCandidates]);

  const handleExportMatchesCsv = useCallback(
    (selectedColumnIds: string[]) => {
      const columns = buildMatchesCsvColumns(selectedColumnIds, savedMatches);
      if (columns.length === 0) {
        setToast('Select at least one column to export.');
        return;
      }
      const rowsToExport = exportMatches.length > 0 ? exportMatches : filteredCandidates;
      if (rowsToExport.length === 0) {
        setToast('No matches to export with current filters.');
        return;
      }
      downloadCsv<MatchCandidate>(
        `matches-${selectedJob?.title ? selectedJob.title.toLowerCase().replace(/\s+/g, '-') : 'list'}-${new Date().toISOString().slice(0, 10)}.csv`,
        columns,
        rowsToExport,
      );
      setToast(`Exported ${rowsToExport.length} match${rowsToExport.length === 1 ? '' : 'es'} to CSV`);
    },
    [exportMatches, filteredCandidates, savedMatches, selectedJob?.title],
  );

  return (
    <div className="w-full min-h-screen overflow-hidden text-slate-900">
      <Toaster position="top-right" richColors style={{ top: '5rem' }} />
      <main className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
        <header className="flex min-h-[4.5rem] shrink-0 flex-wrap items-center justify-between gap-3 border-b border-indigo-100/50 bg-white/80 px-4 py-3 shadow-[inset_0_-1px_0_0_rgba(99,102,241,0.08)] backdrop-blur-md sm:px-6">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 via-indigo-600 to-blue-600 text-white shadow-lg shadow-indigo-500/30 ring-1 ring-white/20">
              <GitMerge className="h-5 w-5" strokeWidth={2.2} />
            </div>
            <div>
              <h1 className="text-xl font-bold leading-none tracking-tight text-slate-900 sm:text-[1.35rem]">Matches</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void refreshMatches()}
              disabled={loading}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-indigo-200/80 bg-white text-indigo-700 shadow-[0_4px_14px_-4px_rgba(99,102,241,0.2)] transition-all hover:border-indigo-300 hover:bg-indigo-50/90 active:scale-[0.98] disabled:opacity-50"
              title="Refresh"
            >
              <RefreshCw size={16} strokeWidth={2.25} className={loading ? 'animate-spin' : ''} />
            </button>
            <button
              type="button"
              onClick={openExportModal}
              className="flex items-center gap-1.5 rounded-lg border border-indigo-200/70 bg-white px-3 py-2 text-xs font-semibold text-indigo-900 shadow-[0_4px_14px_-4px_rgba(99,102,241,0.25)] transition-all hover:border-indigo-300 hover:bg-indigo-50/90 hover:shadow-[0_6px_20px_-4px_rgba(99,102,241,0.35)] active:scale-[0.98]"
              title="Export visible matches to CSV"
            >
              <Download size={16} className="text-indigo-600" strokeWidth={2.25} />
              <span>Export</span>
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-3 py-4 sm:px-5 sm:py-6 lg:px-6">
          <div className="mb-4 overflow-hidden rounded-xl border border-indigo-100/60 bg-white/70 shadow-[0_12px_40px_-18px_rgba(59,130,246,0.18)] backdrop-blur-sm transition-shadow hover:shadow-[0_16px_48px_-14px_rgba(79,70,229,0.16)]">
            <div className="flex flex-col gap-3 border-b border-indigo-100/40 bg-gradient-to-br from-white via-indigo-50/25 to-violet-50/20 p-3 sm:p-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                <AIManualToggle activeTab={activeTab} onChange={handleMatchTabChange} />
                {selectedJob ? <JobSelector jobs={jobs} selectedJob={selectedJob} onSelect={setSelectedJob} /> : null}
              </div>
              {activeTab === 'ai' ? (
                <button
                  type="button"
                  onClick={() => void handleRunAiMatches()}
                  disabled={!selectedJob || loading || aiPipelineRunning}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 via-indigo-600 to-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 transition hover:from-violet-700 hover:via-indigo-700 hover:to-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                  title="Run the 4-pass AI matching pipeline for this job"
                >
                  <Sparkles
                    size={16}
                    className={aiPipelineRunning ? 'animate-spin' : ''}
                    strokeWidth={2.25}
                  />
                  {aiPipelineRunning ? 'Running AI matches…' : 'Run AI Matches'}
                </button>
              ) : null}
              {activeTab === 'manual' ? (
                <button
                  type="button"
                  onClick={() => void handleRunAppliedMatches()}
                  disabled={!selectedJob || loading || appliedPipelineRunning}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-500/25 transition hover:from-emerald-700 hover:via-teal-700 hover:to-cyan-700 disabled:cursor-not-allowed disabled:opacity-60"
                  title="Score only tenant candidates assigned/applied to this job"
                >
                  <Users
                    size={16}
                    className={appliedPipelineRunning ? 'animate-spin' : ''}
                    strokeWidth={2.25}
                  />
                  {appliedPipelineRunning ? 'Running applied matches…' : 'Run AI Applied Matches'}
                </button>
              ) : null}
            </div>

            <FilterBar filters={filters} onChange={setFilters} onReset={resetFilters} embedded />

            {error ? (
              <div className="mx-3 my-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 sm:mx-4">
                {error}
              </div>
            ) : null}

            <CandidateList
              candidates={filteredCandidates}
              embedded
              loading={loading}
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
        onViewProfile={(candidateId) => openProfileDrawer(candidateId, 'overview', true)}
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
        workspaceAlertsByEntityId={workspaceAlertsByEntityId}
        isColumnVisible={matchColumnVisibility.isVisible}
        columnsMenu={
          <TableColumnsMenu
            columns={MATCH_TABLE_COLUMNS}
            isVisible={matchColumnVisibility.isVisible}
            onToggle={matchColumnVisibility.toggle}
            onReset={matchColumnVisibility.resetToDefault}
            unlockedVisibleCount={matchColumnVisibility.unlockedVisibleCount}
          />
        }
      />
          </div>
        </div>
      </main>

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
        onRequestSubmitToClient={() => setOpenModal('submit')}
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

      <CandidateProfileDrawer
        key={selectedCandidateProfile?.id || profileDrawerCandidateId || 'match-candidate'}
        isOpen={Boolean(profileDrawerCandidateId)}
        currentUser={currentDrawerUser}
        availableTags={availableDrawerTags}
        jobs={drawerPipelineJobs}
        recruiters={drawerRecruiters}
        existingInterviews={selectedCandidateProfile?.scheduledInterviews || []}
        candidate={
          loadingCandidateProfile && selectedCandidateProfile
            ? {
                ...selectedCandidateProfile,
                summary: selectedCandidateProfile.summary || 'Loading candidate details...',
              }
            : selectedCandidateProfile
        }
        onClose={() => {
          setProfileDrawerCandidateId(null);
          setProfileDrawerEditOpenToken(null);
          setSelectedCandidateProfile(null);
        }}
        openEditDirectly={Boolean(profileDrawerEditOpenToken)}
        editModalOpenToken={profileDrawerEditOpenToken}
        loadingCandidateProfile={loadingCandidateProfile}
        onAddNote={async (candidateId, note) => {
          await apiAddCandidateNote(candidateId, note);
          await loadCandidateProfile(candidateId, drawerMatchCandidate);
        }}
        onEditNote={async (candidateId, noteId, updatedNote) => {
          await apiUpdateCandidateNote(candidateId, noteId, updatedNote);
          await loadCandidateProfile(candidateId, drawerMatchCandidate);
        }}
        onDeleteNote={async (candidateId, noteId) => {
          await apiDeleteCandidateNote(candidateId, noteId);
          await loadCandidateProfile(candidateId, drawerMatchCandidate);
        }}
        onPinNote={async (candidateId, noteId, isPinned) => {
          await apiPinCandidateNote(candidateId, noteId, isPinned);
          await loadCandidateProfile(candidateId, drawerMatchCandidate);
        }}
        onAddTag={async (candidateId, tag) => {
          await apiAddCandidateTag(candidateId, tag);
          await loadCandidateProfile(candidateId, drawerMatchCandidate);
        }}
        onRemoveTag={async (candidateId, tagId) => {
          await apiRemoveCandidateTag(candidateId, tagId);
          await loadCandidateProfile(candidateId, drawerMatchCandidate);
        }}
        onCreateTag={(_, tagName) => {
          const newTag: CandidateTagItem = {
            id: `tag-${tagName.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`,
            label: tagName,
            color: getTagColor(tagName),
          };
          setAvailableDrawerTags((prev) => {
            if (prev.some((tag) => tag.label.toLowerCase() === tagName.toLowerCase())) return prev;
            return [...prev, newTag];
          });
          return newTag;
        }}
        onAddToPipeline={async ({ candidateId, jobId, stage, recruiterId, priority, notes }) => {
          await apiAddCandidateToPipeline(candidateId, {
            jobId,
            stage,
            recruiterId,
            priority,
            notes,
          });
          await loadCandidateProfile(candidateId, drawerMatchCandidate);
          await refreshMatches();
        }}
        onRemoveFromPipeline={async ({ candidateId, jobId }) => {
          await apiRemoveCandidateFromPipeline(candidateId, jobId);
          await loadCandidateProfile(candidateId, drawerMatchCandidate);
          await refreshMatches();
        }}
        onUpdateCandidate={async (candidateId, payload) => {
          await apiUpdateCandidate(candidateId, payload);
          await loadCandidateProfile(candidateId, drawerMatchCandidate);
          await refreshMatches();
        }}
      />

      <ExportColumnsModal
        isOpen={exportModalOpen}
        onClose={() => {
          setExportModalOpen(false);
          setExportMatches([]);
        }}
        title="Export matches"
        rowCount={exportMatches.length}
        rowLabelSingular="match"
        rowLabelPlural="matches"
        columns={exportColumnsForModal}
        rows={exportMatches}
        getRowKey={(candidate) => candidate.id}
        onExport={handleExportMatchesCsv}
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
