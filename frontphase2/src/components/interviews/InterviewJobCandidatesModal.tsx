'use client';

import React from 'react';
import { AnimatePresence } from 'motion/react';
import { Briefcase, X } from 'lucide-react';
import { DetailsModalShell } from '../drawers/DetailsModalShell';
import { InterviewRoundTabs } from './InterviewRoundTabs';
import { InterviewTable } from './InterviewTable';
import { TableSkeleton } from '../ui/Skeleton';
import type { Interview } from '../../types/interview.types';
import type { AiWorkspaceBriefAlert } from '@/lib/apiAiWorkspaceBrief';
import { DRAWER_FORM_CONTENT_CLASS } from '../drawers/drawerFormUi';

type InterviewJobCandidatesModalProps = {
  isOpen: boolean;
  loading?: boolean;
  jobTitle: string;
  jobClient?: string;
  rounds: number[];
  selectedRound: number | 'all';
  onRoundChange: (round: number | 'all') => void;
  countsByRound: Record<number, number>;
  allCount: number;
  interviews: Interview[];
  workspaceAlertsByEntityId?: Record<string, AiWorkspaceBriefAlert[]>;
  roundNumberByInterviewId?: Record<string, number>;
  selectedIds: string[];
  page: number;
  totalPages: number;
  totalEntries: number;
  pageSize: number;
  isColumnVisible?: (columnId: string) => boolean;
  onClose: () => void;
  onToggleSelect: (interviewId: string) => void;
  onToggleSelectAll: () => void;
  onRowClick: (interview: Interview) => void;
  onViewCandidate: (interview: Interview) => void;
  onEditInterview: (interview: Interview) => void;
  onNoShowInterview: (interview: Interview) => void;
  onMarkInterviewCompleted?: (interview: Interview) => void;
  onRejectCandidate: (interview: Interview) => void;
  /** Highest interview round present on this job (enables move-to-next-round). */
  jobMaxRound?: number;
  /** Per-candidate highest round on this job. */
  candidateMaxRoundByCandidateId?: Record<string, number>;
  onScheduleNextRound?: (interview: Interview) => void;
  onPageChange: (page: number) => void;
  emptyAction?: React.ReactNode;
};

export function InterviewJobCandidatesModal({
  isOpen,
  loading = false,
  jobTitle,
  jobClient,
  rounds,
  selectedRound,
  onRoundChange,
  countsByRound,
  allCount,
  interviews,
  workspaceAlertsByEntityId,
  roundNumberByInterviewId,
  selectedIds,
  page,
  totalPages,
  totalEntries,
  pageSize,
  isColumnVisible,
  onClose,
  onToggleSelect,
  onToggleSelectAll,
  onRowClick,
  onViewCandidate,
  onEditInterview,
  onNoShowInterview,
  onMarkInterviewCompleted,
  onRejectCandidate,
  jobMaxRound = 1,
  candidateMaxRoundByCandidateId,
  onScheduleNextRound,
  onPageChange,
  emptyAction,
}: InterviewJobCandidatesModalProps) {
  return (
    <AnimatePresence>
      {isOpen ? (
        <DetailsModalShell
          onBackdropClick={onClose}
          size="lg"
          zIndexClass="z-[90]"
          dialogTitleId="interview-job-candidates-modal-title"
        >
          <div className="relative shrink-0 overflow-hidden border-b border-indigo-100/60 bg-gradient-to-br from-white via-indigo-50/45 to-violet-50/35 px-5 pb-4 pt-5 sm:px-6">
            <div
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(99,102,241,0.12),_transparent_55%)]"
              aria-hidden
            />
            <div className="relative flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-white shadow-md shadow-indigo-500/25">
                  <Briefcase className="h-3 w-3 text-indigo-100" />
                  Interviewing candidates
                </div>
                <h2
                  id="interview-job-candidates-modal-title"
                  className="mt-2.5 truncate text-xl font-bold tracking-tight text-slate-900"
                >
                  {jobTitle}
                </h2>
                {jobClient ? <p className="mt-1 text-sm text-slate-500">{jobClient}</p> : null}
                <p className="mt-1 text-xs text-slate-500">
                  Candidates currently in interview for this job, grouped by round.
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-full p-2 text-slate-400 transition-colors hover:bg-white/80 hover:text-slate-700"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <div className="relative mt-4">
              <InterviewRoundTabs
                rounds={rounds}
                active={selectedRound}
                onChange={onRoundChange}
                countsByRound={countsByRound}
                allCount={allCount}
              />
            </div>
          </div>

          <div className={`min-h-0 flex-1 overflow-hidden ${DRAWER_FORM_CONTENT_CLASS}`}>
            {loading ? (
              <div className="p-4">
                <TableSkeleton rows={6} columns={5} />
              </div>
            ) : interviews.length === 0 ? (
              <div className="px-4 py-14 text-center">
                <p className="text-sm font-semibold text-slate-800">No candidates in this round</p>
                <p className="mt-1 text-xs text-slate-500">
                  Schedule an interview for this job, or switch to another round tab.
                </p>
                {emptyAction}
              </div>
            ) : (
              <div className="min-h-0 flex-1 overflow-auto">
                <InterviewTable
                  hidePagination={false}
                  hideJobColumn
                  interviews={interviews}
                  workspaceAlertsByEntityId={workspaceAlertsByEntityId}
                  roundNumberByInterviewId={roundNumberByInterviewId}
                  selectedIds={selectedIds}
                  page={page}
                  totalPages={totalPages}
                  totalEntries={totalEntries}
                  pageSize={pageSize}
                  isColumnVisible={isColumnVisible}
                  onToggleSelect={onToggleSelect}
                  onToggleSelectAll={onToggleSelectAll}
                  onRowClick={onRowClick}
                  onViewCandidate={onViewCandidate}
                  onEditInterview={onEditInterview}
                  onNoShowInterview={onNoShowInterview}
                  onMarkInterviewCompleted={onMarkInterviewCompleted}
                  onRejectCandidate={onRejectCandidate}
                  onPageChange={onPageChange}
                  showEditCompleteNoShowActions
                  jobMaxRound={jobMaxRound}
                  candidateMaxRoundByCandidateId={candidateMaxRoundByCandidateId}
                  onScheduleNextRound={onScheduleNextRound}
                />
              </div>
            )}
          </div>
        </DetailsModalShell>
      ) : null}
    </AnimatePresence>
  );
}
