'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Info, Mail, MessageSquare, Trash2, UserPlus } from 'lucide-react';
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
  apiGetJobs,
  apiGetMatches,
  apiGetUsers,
  apiRejectMatch,
  apiSubmitMatch,
  apiToggleSavedMatch,
  type BackendJob,
  type BackendMatch,
  type BackendUser,
} from '../../lib/api';

const INITIAL_FILTERS: MatchFilters = {
  skillMatch: 75,
  expMin: 5,
  expMax: 10,
  location: '',
  salaryMin: null,
  salaryMax: null,
  noticePeriod: null,
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
    status: status.includes('urgent')
      ? 'Urgent'
      : String(job.status || '').toUpperCase() === 'ON_HOLD'
      ? 'On Hold'
      : 'Open',
  };
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

export default function MatchesPage() {
  const [activeView, setActiveView] = useState<'internal' | 'client'>('internal');
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
  const [profileDrawerTab, setProfileDrawerTab] = useState<'overview' | 'resume' | 'ai' | 'notes' | 'activity'>('overview');
  const [sortBy, setSortBy] = useState('Highest Match');
  const [copiedCandidateId, setCopiedCandidateId] = useState<string | null>(null);
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
      const response = await apiGetMatches({
        jobId: selectedJob.id,
        source: activeTab,
        limit: 100,
      });
      const matchItems = (response.data.data || []).map(mapBackendMatch);
      setCandidates(matchItems);
      setSavedMatches(matchItems.filter((candidate) => Boolean(candidate.savedAt)).map((candidate) => candidate.id));
    } catch (fetchError: any) {
      setError(fetchError.message || 'Unable to load matches');
      setCandidates([]);
      setSavedMatches([]);
    } finally {
      setLoading(false);
    }
  }, [activeTab, selectedJob]);

  useEffect(() => {
    const loadMeta = async () => {
      setLoading(true);
      setError(null);
      try {
        const [jobsResponse, usersResponse] = await Promise.all([
          apiGetJobs({ status: 'OPEN', limit: 100 }),
          apiGetUsers({ role: 'RECRUITER', isActive: true, limit: 100 }),
        ]);

        const jobOptions = unwrapCollection(jobsResponse.data).map(mapJobToOption);
        setJobs(jobOptions);
        setSelectedJob((current) => current || jobOptions[0] || null);
        setRecruiters(unwrapCollection(usersResponse.data).map(mapRecruiter));
      } catch (fetchError: any) {
        setError(fetchError.message || 'Unable to load match metadata');
      } finally {
        setLoading(false);
      }
    };

    void loadMeta();
  }, []);

  useEffect(() => {
    void refreshMatches();
  }, [refreshMatches]);

  useEffect(() => {
    setSelectedCandidates([]);
    setExpandedAnalysis(null);
    setActiveCandidateId(null);
    setProfileDrawerCandidateId(null);
  }, [selectedJob?.id, activeTab]);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(null), 1800);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const filteredCandidates = useMemo(() => {
    const list = candidates
      .filter((candidate) => candidate.score >= filters.skillMatch)
      .filter((candidate) => candidate.experience >= filters.expMin && candidate.experience <= filters.expMax)
      .filter((candidate) =>
        filters.location
          ? candidate.location.toLowerCase().includes(filters.location.toLowerCase())
          : true
      )
      .filter((candidate) =>
        filters.salaryMin !== null ? candidate.salary.amount >= filters.salaryMin : true
      )
      .filter((candidate) =>
        filters.salaryMax !== null ? candidate.salary.amount <= filters.salaryMax : true
      )
      .filter((candidate) => matchesNoticePeriod(candidate.noticePeriod, filters.noticePeriod));

    return [...list].sort((left, right) => {
      if (sortBy === 'Experience') return right.experience - left.experience;
      if (sortBy === 'Status') return statusRank[left.status] - statusRank[right.status];
      return right.score - left.score;
    });
  }, [activeTab, candidates, filters, sortBy]);

  const resetFilters = () => setFilters(INITIAL_FILTERS);

  const toggleCandidateSelection = (candidateId: string) => {
    setSelectedCandidates((previous) =>
      previous.includes(candidateId)
        ? previous.filter((id) => id !== candidateId)
        : [...previous, candidateId]
    );
  };

  const openCandidateModal = (candidateId: string, modal: Exclude<OpenModal, null>) => {
    setActiveCandidateId(candidateId);
    setOpenModal(modal);
  };

  const openProfileDrawer = (
    candidateId: string,
    tab: 'overview' | 'resume' | 'ai' | 'notes' | 'activity' = 'overview'
  ) => {
    setProfileDrawerCandidateId(candidateId);
    setProfileDrawerTab(tab);
  };

  const handleCopyLink = async (candidateId: string) => {
    const url = `${window.location.origin}/candidate/${candidateId}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedCandidateId(candidateId);
      window.setTimeout(() => setCopiedCandidateId((current) => (current === candidateId ? null : current)), 1500);
    } catch {
      setCopiedCandidateId(null);
    }
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
        .map((candidate) => candidate.matchId),
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

  const handleBulkEmail = async (payload: { subject: string; message: string }) => {
    if (!selectedMatchIds.length) return;

    setBulkEmailLoading(true);
    try {
      await apiBulkEmailMatches({
        matchIds: selectedMatchIds,
        subject: payload.subject,
        message: payload.message,
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
      <TopBar activeView={activeView} onChangeView={setActiveView} />

      <div className="border-b border-[#E5E7EB] bg-white px-6 py-4 sm:px-8">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
            <AIManualToggle activeTab={activeTab} onChange={setActiveTab} />
            {selectedJob ? <JobSelector jobs={jobs} selectedJob={selectedJob} onSelect={setSelectedJob} /> : null}
              </div>
          </div>
        </div>
        
      <FilterBar filters={filters} onChange={setFilters} onReset={resetFilters} />

      {error ? (
        <div className="mx-auto mt-4 max-w-6xl rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
              </div>
      ) : null}

      {activeView === 'client' ? (
        <div className="border-b border-blue-700 bg-[#2563EB] px-6 py-2.5 text-white sm:px-8">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Info size={16} />
              <span>Client Preview Mode: internal scores and recruiter-only actions are hidden.</span>
          </div>
                 <button 
              type="button"
              onClick={() => setActiveView('internal')}
              className="text-xs font-bold uppercase tracking-widest hover:underline"
            >
              Exit Preview
                   </button>
                </div>
            </div>
      ) : null}

      <CandidateList
        candidates={loading ? [] : filteredCandidates}
        activeTab={activeTab}
        activeView={activeView}
        selectedCandidates={selectedCandidates}
        savedMatches={savedMatches}
        expandedAnalysis={expandedAnalysis}
        copiedCandidateId={copiedCandidateId}
        sortBy={sortBy}
        onSortChange={setSortBy}
        onToggleSelect={toggleCandidateSelection}
        onToggleSave={(candidateId) => {
          const candidate = candidates.find((item) => item.id === candidateId);
          if (!candidate) return;
          const nextSaved = !savedMatches.includes(candidateId);

          void (async () => {
            try {
              await apiToggleSavedMatch(candidate.matchId, nextSaved);
              setSavedMatches((previous) =>
                nextSaved ? [...previous, candidateId] : previous.filter((id) => id !== candidateId)
              );
              updateCandidate(candidateId, (current) => ({
                ...current,
                savedAt: nextSaved ? new Date().toISOString() : null,
              }));
              setToast(nextSaved ? 'Match saved' : 'Saved match removed');
            } catch (toggleError: any) {
              setError(toggleError.message || 'Unable to update saved match');
              setToast(toggleError.message || 'Unable to update saved match');
            }
          })();
        }}
        onCopyLink={handleCopyLink}
        onToggleAnalysis={(candidateId) =>
          setExpandedAnalysis((previous) => (previous === candidateId ? null : candidateId))
        }
        onViewProfile={openProfileDrawer}
        onOpenPipeline={(candidateId) => openCandidateModal(candidateId, 'pipeline')}
        onOpenSubmit={(candidateId) => {
          const candidate = candidates.find((item) => item.id === candidateId);
          if (candidate?.submittedHistory && candidate.status === 'Submitted') {
            openCandidateModal(candidateId, 'duplicate');
            return;
          }
          openCandidateModal(candidateId, 'submit');
        }}
        onOpenReject={(candidateId) => openCandidateModal(candidateId, 'reject')}
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
        onSubmit={async ({ message, notifyClient }) => {
          if (!activeCandidate?.matchId) return;
          try {
            await apiSubmitMatch(activeCandidate.matchId, { message, notifyClient });
            await refreshMatches();
            setOpenModal(null);
            setToast('Candidate submitted to client');
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
          openProfileDrawer(activeCandidateId, 'activity');
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
