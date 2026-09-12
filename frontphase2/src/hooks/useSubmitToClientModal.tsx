'use client';

import { useCallback, useRef, useState } from 'react';
import { SubmitToClientPreviewLinkModal } from '../components/interviews/SubmitToClientPreviewLinkModal';
import type { Candidate } from '../app/candidate/components/CandidateTable';
import type { JobCandidateItem } from '../components/drawers/JobDetailsDrawer';
import {
  generateSubmitToClientPreview,
  type BulkSubmitCandidateEntry,
} from '../lib/generateSubmitToClientPreview';
import { parseJobCandidateScore } from '../lib/jobAppliedMatches';
import { requestError } from '../lib/appDialog';
import type { Interview } from '../types/interview.types';
import {
  CLIENT_TRACKER_OPTION_DEFAULTS,
  type ClientTrackerOptions,
} from '../lib/clientTrackerOptions';
import { CLIENT_PIPELINE_STAGE_CHOICES } from '../lib/clientReviewTypes';

export type { BulkSubmitCandidateEntry };

const DEFAULT_ALLOWED_STAGES = CLIENT_PIPELINE_STAGE_CHOICES.map((s) => s.name);

export function useSubmitToClientModal(options?: {
  onClosed?: () => void;
  onSubmitted?: () => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [reviewUrl, setReviewUrl] = useState('');
  const [candidateNames, setCandidateNames] = useState<string[]>([]);
  const [visibleCount, setVisibleCount] = useState<number | null>(null);
  const [hiddenCount, setHiddenCount] = useState<number | null>(null);
  const [jobTitle, setJobTitle] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [clientName, setClientName] = useState('');
  const [matchId, setMatchId] = useState('');
  const [batchMatchIds, setBatchMatchIds] = useState<string[]>([]);
  const [trackerOptions, setTrackerOptions] = useState<ClientTrackerOptions>(CLIENT_TRACKER_OPTION_DEFAULTS);
  const [allowedClientStages, setAllowedClientStages] = useState<string[]>(DEFAULT_ALLOWED_STAGES);
  const [clientStageCatalog, setClientStageCatalog] = useState<string[]>(DEFAULT_ALLOWED_STAGES);
  const pendingEntriesRef = useRef<BulkSubmitCandidateEntry[]>([]);
  const generateRunIdRef = useRef(0);
  const onClosed = options?.onClosed;
  const onSubmitted = options?.onSubmitted;

  const handleClose = useCallback(() => {
    if (loading) return;
    setIsOpen(false);
    setError('');
    setReviewUrl('');
    setCandidateNames([]);
    setVisibleCount(null);
    setHiddenCount(null);
    setJobTitle('');
    setClientEmail('');
    setClientName('');
    setMatchId('');
    setBatchMatchIds([]);
    setTrackerOptions(CLIENT_TRACKER_OPTION_DEFAULTS);
    setAllowedClientStages(DEFAULT_ALLOWED_STAGES);
    setClientStageCatalog(DEFAULT_ALLOWED_STAGES);
    pendingEntriesRef.current = [];
    onClosed?.();
  }, [loading, onClosed]);

  const generateFromEntries = useCallback(
    async (entries: BulkSubmitCandidateEntry[]) => {
      const runId = generateRunIdRef.current + 1;
      generateRunIdRef.current = runId;
      pendingEntriesRef.current = entries;
      setIsOpen(true);
      setLoading(true);
      setError('');
      setReviewUrl('');
      setCandidateNames(entries.map((entry) => entry.candidateName || 'Candidate').filter(Boolean));
      setVisibleCount(null);
      setHiddenCount(null);
      setJobTitle(entries.find((entry) => entry.jobTitle)?.jobTitle || '');
      setClientEmail('');
      setClientName('');
      setMatchId('');
      setBatchMatchIds([]);
      setTrackerOptions(CLIENT_TRACKER_OPTION_DEFAULTS);
      setAllowedClientStages(DEFAULT_ALLOWED_STAGES);
      setClientStageCatalog(DEFAULT_ALLOWED_STAGES);
      try {
        const result = await generateSubmitToClientPreview(entries);
        if (generateRunIdRef.current !== runId) return;
        setReviewUrl(result.reviewUrl);
        setCandidateNames(result.candidateNames);
        setVisibleCount(result.visibleCount);
        setHiddenCount(result.hiddenCount);
        setJobTitle(result.jobTitle);
        setClientEmail(result.clientEmail);
        setClientName(result.clientName);
        setMatchId(result.matchId);
        setBatchMatchIds(result.batchMatchIds);
        setTrackerOptions(result.trackerOptions);
        setAllowedClientStages(
          Array.isArray(result.allowedClientStages) && result.allowedClientStages.length
            ? result.allowedClientStages
            : DEFAULT_ALLOWED_STAGES,
        );
        setClientStageCatalog(
          Array.isArray(result.clientStageCatalog) && result.clientStageCatalog.length
            ? result.clientStageCatalog
            : Array.isArray(result.allowedClientStages) && result.allowedClientStages.length
              ? result.allowedClientStages
              : DEFAULT_ALLOWED_STAGES,
        );
        onSubmitted?.();
      } catch (err: unknown) {
        if (generateRunIdRef.current !== runId) return;
        setError(err instanceof Error ? err.message : 'Unable to generate the client preview link.');
      } finally {
        if (generateRunIdRef.current === runId) setLoading(false);
      }
    },
    [onSubmitted],
  );

  const openSubmit = useCallback(
    (params: {
      candidateId: string;
      jobId: string;
      candidateName?: string;
      jobTitle?: string;
      clientId?: string;
      matchScore?: number;
      matchId?: string;
    }) => {
      if (!params.jobId) {
        void requestError('Assign this candidate to a job before submitting to the client.');
        return;
      }
      void generateFromEntries([
        {
          candidateId: params.candidateId,
          jobId: params.jobId,
          candidateName: params.candidateName,
          jobTitle: params.jobTitle,
          clientId: params.clientId,
          matchScore: params.matchScore,
          matchId: params.matchId,
        },
      ]);
    },
    [generateFromEntries],
  );

  const openFromCandidateRow = useCallback(
    (row: Candidate) => {
      const jobId = row.pipelineJobId;
      if (!jobId) {
        void requestError('This candidate has no linked job. Assign them to a job first.');
        return;
      }
      openSubmit({
        candidateId: row.id,
        jobId,
        candidateName: row.name,
        matchScore: row.matchScore,
        matchId: row.matchId,
      });
    },
    [openSubmit],
  );

  const openFromJobDrawerRow = useCallback(
    (row: JobCandidateItem, jobId: string, jobTitle?: string, clientId?: string) => {
      openSubmit({
        candidateId: row.id,
        jobId,
        candidateName: row.candidateName,
        jobTitle,
        clientId,
        matchScore: parseJobCandidateScore(row.score),
      });
    },
    [openSubmit],
  );

  const openBulkSubmit = useCallback(
    (candidates: BulkSubmitCandidateEntry[]) => {
      if (!candidates.length) {
        void requestError('Select at least one candidate to submit to the client.');
        return;
      }
      const missingJob = candidates.find((entry) => !entry.jobId);
      if (missingJob) {
        void requestError(
          `${missingJob.candidateName || 'A selected candidate'} has no linked job. Assign them to a job first.`,
        );
        return;
      }
      void generateFromEntries(candidates);
    },
    [generateFromEntries],
  );

  const openFromInterview = useCallback(
    (interview: Interview) => {
      const candidateId = String(interview.candidate?.id || '').trim();
      const jobId = String(interview.job?.id || '').trim();
      if (!candidateId || !jobId) {
        void requestError('This interview is missing a candidate or job.');
        return;
      }
      openSubmit({
        candidateId,
        jobId,
        candidateName: interview.candidate?.name,
        jobTitle: interview.job?.title,
        clientId: interview.job?.clientId,
      });
    },
    [openSubmit],
  );

  const handleRetry = useCallback(() => {
    const pending = pendingEntriesRef.current;
    if (!pending.length) return;
    void generateFromEntries(pending);
  }, [generateFromEntries]);

  const submitModalElement = isOpen ? (
    <SubmitToClientPreviewLinkModal
      isOpen
      loading={loading}
      error={error}
      reviewUrl={reviewUrl}
      candidateNames={candidateNames}
      jobTitle={jobTitle}
      clientEmail={clientEmail}
      clientName={clientName}
      visibleCount={visibleCount}
      hiddenCount={hiddenCount}
      matchId={matchId}
      batchMatchIds={batchMatchIds}
      trackerOptions={trackerOptions}
      allowedClientStages={allowedClientStages}
      clientStageCatalog={clientStageCatalog}
      onTrackerOptionsChange={setTrackerOptions}
      onAllowedClientStagesChange={setAllowedClientStages}
      onClientStageCatalogChange={setClientStageCatalog}
      onClose={handleClose}
      onRetry={handleRetry}
    />
  ) : null;

  return {
    openSubmit,
    openBulkSubmit,
    openFromCandidateRow,
    openFromJobDrawerRow,
    openFromInterview,
    submitModalElement,
  };
}
