'use client';

import { useCallback, useState } from 'react';
import {
  SubmitToClientDrawer,
  type SubmitToClientSource,
} from '../components/interviews/SubmitToClientDrawer';
import type { Candidate } from '../app/candidate/components/CandidateTable';
import type { JobCandidateItem } from '../components/drawers/JobDetailsDrawer';
import { parseJobCandidateScore } from '../lib/jobAppliedMatches';
import { requestError, requestInfo } from '../lib/appDialog';

export function useSubmitToClientModal(options?: { onClosed?: () => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const [source, setSource] = useState<SubmitToClientSource | null>(null);
  const onClosed = options?.onClosed;

  const handleClose = useCallback(() => {
    setIsOpen(false);
    setSource(null);
    onClosed?.();
  }, [onClosed]);

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
      setSource({
        kind: 'match',
        candidateId: params.candidateId,
        jobId: params.jobId,
        candidateName: params.candidateName,
        jobTitle: params.jobTitle,
        clientId: params.clientId,
        matchScore: params.matchScore,
        matchId: params.matchId,
      });
      setIsOpen(true);
    },
    [],
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

  const handleToast = useCallback((message: string) => {
    void requestInfo(message);
  }, []);

  const submitModalElement = (
    <SubmitToClientDrawer
      isOpen={isOpen}
      source={source}
      onClose={handleClose}
      onToast={handleToast}
    />
  );

  return {
    openSubmit,
    openFromCandidateRow,
    openFromJobDrawerRow,
    submitModalElement,
  };
}
