'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Calendar, Loader2, Search, Send, Sparkles, Upload, UserPlus, Users, X } from 'lucide-react';
import { CandidateTable } from '../../../app/candidate/components/CandidateTable';
import type { Candidate as JobDrawerTableCandidate } from '../../../app/candidate/components/CandidateTable';
import MatchCandidateTable from '../../matches/MatchCandidateTable';
import {
  AI_SCORE_TIERS,
  computeAiTierStats,
  type MatchCandidate,
} from '../../matches/types';
import PaginationAll from '../../PaginationAll';
import { TableColumnsMenu } from '../../table/TableColumnsMenu';
import { BULK_CV_ACCEPT_INPUT, BULK_CV_FORMAT_LABEL } from '../../../lib/bulkCvFileTypes';
import {
  PH2_TABLE_BODY_SCROLL_CLASS,
  PH2_TABLE_CARD_CLASS,
  PH2_TABLE_CARD_FOOTER_CLASS,
} from '../../layout/Ph2ModulePageLayout';
import { TABLE_PAGE_SIZE_OPTIONS, type TablePageSize } from '../../../constants/tablePagination';
import {
  CANDIDATE_TABLE_COLUMNS,
  MATCH_TABLE_COLUMNS,
} from '../../../lib/tableColumns/moduleTableColumns';
import { DrawerSectionCard, DRAWER_FORM_SCROLL_BG } from '../drawerFormUi';
import { requestInfo } from '../../../lib/appDialog';
import type { JobForDrawer } from '../JobDetailsDrawer';
import type { JobCandidateMatchMode, UseJobCandidatesTabReturn } from '../../../hooks/useJobCandidatesTab';

interface ColumnVisibility {
  isVisible: (columnId: string) => boolean;
  toggle: (columnId: string) => void;
  resetToDefault: () => void;
  unlockedVisibleCount: number;
}

interface CandidatesTabProps extends UseJobCandidatesTabReturn {
  job: JobForDrawer | null;
  canAddCandidate?: boolean;
  candidateColumnVisibility: ColumnVisibility;
  matchColumnVisibility: ColumnVisibility;
  onOpenBulkScheduleInterview: () => void;
  onOpenBulkSubmitToClient: () => void;
  onOpenMoveStageFromTable?: (row: JobDrawerTableCandidate) => void;
  onViewCandidateProfile?: (candidate: JobDrawerTableCandidate) => void;
  onEditCandidate?: (candidate: JobDrawerTableCandidate) => void;
}

function JobCandidateMatchModeToggle({
  mode,
  onChange,
}: {
  mode: JobCandidateMatchMode;
  onChange: (mode: JobCandidateMatchMode) => void;
}) {
  return (
    <div className="inline-flex rounded-xl border border-[#E5E7EB] bg-white p-0.5">
      <button
        type="button"
        onClick={() => onChange('applied')}
        className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${
          mode === 'applied'
            ? 'bg-[#2563EB] text-white shadow-sm'
            : 'text-slate-600 hover:bg-slate-50'
        }`}
      >
        <Users size={16} />
        AI Applied Matches
      </button>
      <button
        type="button"
        onClick={() => onChange('ai')}
        className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${
          mode === 'ai'
            ? 'bg-[#2563EB] text-white shadow-sm'
            : 'text-slate-600 hover:bg-slate-50'
        }`}
      >
        <Sparkles size={16} />
        AI Matches
      </button>
    </div>
  );
}

interface JobDrawerAiMatchesTabProps {
  job: JobForDrawer;
  aiMatchCandidates: MatchCandidate[];
  sortedAiMatchCandidates: MatchCandidate[];
  aiTierStats: ReturnType<typeof computeAiTierStats>;
  aiMatchesLoading: boolean;
  aiPipelineRunning: boolean;
  aiMatchesError: string | null;
  aiMatchSelectedIds: string[];
  aiSavedMatches: string[];
  aiExpandedAnalysis: string | null;
  onRunAiMatches: () => void | Promise<void>;
  onToggleSelect: (candidateId: string) => void;
  onToggleSelectAll: () => void;
  onToggleSave: (candidateId: string) => void;
  onToggleAnalysis: (candidateId: string) => void;
  onViewProfile: (candidateId: string) => void;
  onOpenSubmit: (candidateId: string) => void;
  isColumnVisible?: (columnId: string) => boolean;
  columnsMenu?: React.ReactNode;
}

function JobDrawerAiMatchesTab({
  job,
  aiMatchCandidates,
  sortedAiMatchCandidates,
  aiTierStats,
  aiMatchesLoading,
  aiPipelineRunning,
  aiMatchesError,
  aiMatchSelectedIds,
  aiSavedMatches,
  aiExpandedAnalysis,
  onRunAiMatches,
  onToggleSelect,
  onToggleSelectAll,
  onToggleSave,
  onToggleAnalysis,
  onViewProfile,
  onOpenSubmit,
  isColumnVisible,
  columnsMenu,
}: JobDrawerAiMatchesTabProps) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<TablePageSize>(50);
  const totalPages = Math.max(1, Math.ceil(sortedAiMatchCandidates.length / pageSize));
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const pagedCandidates = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return sortedAiMatchCandidates.slice(start, start + pageSize);
  }, [sortedAiMatchCandidates, safePage, pageSize]);

  useEffect(() => {
    setPage(1);
  }, [job?.id, pageSize, sortedAiMatchCandidates.length]);

  return (
    <DrawerSectionCard
      title="AI Matches"
      subtitle={`4-pass AI pipeline for ${job.title}`}
      icon={Sparkles}
      accent="violet"
      headerRight={columnsMenu}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          {aiMatchCandidates.length > 0 ? (
            <p className="text-[11px] font-medium text-indigo-700/80">
              {AI_SCORE_TIERS.map((t) => `${t.label}: ${aiTierStats[t.id]}`).join(' · ')}
            </p>
          ) : (
            <p className="text-xs text-slate-500">
              Switch to AI Matches to run the 4-pass pipeline, or click Run AI Matches to refresh scores.
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => void onRunAiMatches()}
          disabled={!job?.id || aiMatchesLoading || aiPipelineRunning}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 via-indigo-600 to-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 transition hover:from-violet-700 hover:via-indigo-700 hover:to-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          title="Run the 4-pass AI matching pipeline for this job"
        >
          <Sparkles size={16} className={aiPipelineRunning ? 'animate-spin' : ''} strokeWidth={2.25} />
          {aiPipelineRunning ? 'Running AI matches…' : 'Run AI Matches'}
        </button>
      </div>

      {aiMatchesError ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {aiMatchesError}
        </div>
      ) : null}

      {aiMatchesLoading || aiPipelineRunning ? (
        <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500">
          <Loader2 className="size-5 animate-spin text-indigo-600" />
          {aiPipelineRunning ? 'Running AI matching pipeline…' : 'Loading matches…'}
        </div>
      ) : aiMatchCandidates.length === 0 ? (
        <div className="py-12 text-center">
          <Sparkles size={32} className="mx-auto mb-3 text-indigo-200" />
          <p className="text-sm text-slate-500">No AI matches yet. Run the pipeline to score candidates.</p>
        </div>
      ) : sortedAiMatchCandidates.length === 0 ? (
        <div className="py-12 text-center">
          <Search size={28} className="mx-auto mb-3 text-slate-300" />
          <p className="text-sm text-slate-500">No AI matches match your search.</p>
        </div>
      ) : (
        <>
          <div className="no-scrollbar -mx-1 overflow-x-auto">
            <MatchCandidateTable
              candidates={pagedCandidates}
              activeView="internal"
              selectedCandidates={aiMatchSelectedIds}
              savedMatches={aiSavedMatches}
              expandedAnalysis={aiExpandedAnalysis}
              showMatchScore
              isColumnVisible={isColumnVisible}
              onToggleSelect={onToggleSelect}
              onToggleSelectAll={() => {
                const pageIds = pagedCandidates.map((row) => row.id);
                const allPageSelected =
                  pageIds.length > 0 && pageIds.every((id) => aiMatchSelectedIds.includes(id));
                if (allPageSelected) {
                  pageIds.forEach((id) => {
                    if (aiMatchSelectedIds.includes(id)) onToggleSelect(id);
                  });
                  return;
                }
                pageIds.forEach((id) => {
                  if (!aiMatchSelectedIds.includes(id)) onToggleSelect(id);
                });
              }}
              onToggleSave={onToggleSave}
              onToggleAnalysis={onToggleAnalysis}
              onViewProfile={onViewProfile}
              onOpenPipeline={() => {
                void requestInfo('Use the Pipeline tab or Matches page to add candidates to the pipeline.');
              }}
              onOpenSubmit={onOpenSubmit}
              onOpenReject={() => {
                void requestInfo('Use the Matches page to reject AI match rows.');
              }}
              onRateMatch={() => undefined}
            />
          </div>
          <div className={PH2_TABLE_CARD_FOOTER_CLASS}>
            <PaginationAll
              initialPage={safePage}
              totalPages={totalPages}
              totalCount={sortedAiMatchCandidates.length}
              pageSize={pageSize}
              pageSizeOptions={[...TABLE_PAGE_SIZE_OPTIONS]}
              onPageSizeChange={(n) => {
                if (!(TABLE_PAGE_SIZE_OPTIONS as readonly number[]).includes(n)) return;
                setPageSize(n as TablePageSize);
                setPage(1);
              }}
              itemLabel="matches"
              onPageChange={setPage}
            />
          </div>
        </>
      )}
    </DrawerSectionCard>
  );
}

export default function CandidatesTab(props: CandidatesTabProps) {
  const job = props.job;

  return (
    <div className={`flex min-h-0 flex-1 flex-col overflow-hidden ${DRAWER_FORM_SCROLL_BG}`}>
      <div className="flex shrink-0 flex-col gap-2 px-3 pt-3 pb-2 lg:flex-row lg:items-center lg:justify-between">
        <JobCandidateMatchModeToggle
          mode={props.candidateMatchMode}
          onChange={props.setCandidateMatchMode}
        />
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
          <div className="relative min-w-0 flex-1 sm:w-64 sm:flex-none">
            <Search
              size={15}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="search"
              value={props.jobCandidatesSearch}
              onChange={(event) => props.setJobCandidatesSearch(event.target.value)}
              placeholder="Search candidates…"
              className="h-8 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-9 text-sm text-slate-800 placeholder:text-slate-400 outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-500/20"
              aria-label="Search candidates on this job"
            />
            {props.jobCandidatesSearch.trim() ? (
              <button
                type="button"
                onClick={() => props.setJobCandidatesSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                aria-label="Clear candidate search"
              >
                <X size={14} />
              </button>
            ) : null}
          </div>
          {props.candidateMatchMode === 'applied' && props.canAddCandidate && job?.id ? (
            <>
              <input
                ref={props.fileInputRef}
                type="file"
                accept={BULK_CV_ACCEPT_INPUT}
                multiple
                className="hidden"
                onChange={(event) => {
                  void props.onJobCvFileSelected(event.target.files);
                }}
              />
              <button
                type="button"
                onClick={() => props.openAssignPicker()}
                disabled={Boolean(props.assignPoolAddingId)}
                className="inline-flex h-8 shrink-0 items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                title="Assign an existing candidate from the pool to this job"
              >
                <UserPlus size={16} strokeWidth={2.25} />
                Assign
              </button>
              <button
                type="button"
                onClick={() => props.fileInputRef.current?.click()}
                disabled={props.uploadingJobCv}
                className="inline-flex h-8 shrink-0 items-center justify-center gap-2 rounded-lg border border-indigo-200 bg-white px-3 text-sm font-semibold text-indigo-700 shadow-sm transition hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-60"
                title={`Upload one or more CVs (${BULK_CV_FORMAT_LABEL}) to create candidates for this job`}
              >
                {props.uploadingJobCv ? (
                  <Loader2 size={16} className="animate-spin" strokeWidth={2.25} />
                ) : (
                  <Upload size={16} strokeWidth={2.25} />
                )}
                {props.uploadingJobCv
                  ? props.jobCvUploadProgress
                    ? `Creating ${props.jobCvUploadProgress.done}/${props.jobCvUploadProgress.total}…`
                    : 'Creating candidates…'
                  : 'Upload CV'}
              </button>
            </>
          ) : null}
        </div>
      </div>

      {props.candidateMatchMode === 'applied' ? (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-3 pb-3">
          {props.pipelineStageCountCards.length > 0 ? (
            <div className="mb-2 flex shrink-0 gap-2 overflow-x-auto pb-1 [scrollbar-width:thin]">
              <button
                type="button"
                onClick={() => props.setCandidatesStageFilterId('all')}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                  props.candidatesStageFilterId === 'all'
                    ? 'border-indigo-300 bg-indigo-600 text-white shadow-sm'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700'
                }`}
              >
                All
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                    props.candidatesStageFilterId === 'all'
                      ? 'bg-white/20 text-white'
                      : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {props.displayJobCandidates.length}
                </span>
              </button>
              {props.pipelineStageCountCards.map((stage) => {
                const active = props.candidatesStageFilterId === stage.id;
                return (
                  <button
                    key={stage.id}
                    type="button"
                    onClick={() => props.setCandidatesStageFilterId(stage.id)}
                    title={`Show ${stage.name} candidates`}
                    className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                      active
                        ? 'border-indigo-300 bg-indigo-600 text-white shadow-sm'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700'
                    }`}
                  >
                    <span className="max-w-[9rem] truncate">{stage.name}</span>
                    <span
                      className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                        active ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {stage.count}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : null}
          <div className={PH2_TABLE_CARD_CLASS}>
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-indigo-100/50 px-3 py-2">
              <p className="text-sm font-semibold text-slate-800">
                Candidates
                {props.filteredJobTableCandidates.length ? (
                  <span className="ml-1.5 text-xs font-medium text-slate-400">
                    {props.filteredJobTableCandidates.length}
                  </span>
                ) : null}
                {props.candidatesStageFilterId !== 'all' ? (
                  <span className="ml-1.5 text-xs font-medium text-indigo-500">
                    ·{' '}
                    {props.pipelineStageCountCards.find((s) => s.id === props.candidatesStageFilterId)?.name ||
                      'Stage'}
                  </span>
                ) : null}
              </p>
              <TableColumnsMenu
                columns={CANDIDATE_TABLE_COLUMNS}
                isVisible={props.candidateColumnVisibility.isVisible}
                onToggle={props.candidateColumnVisibility.toggle}
                onReset={props.candidateColumnVisibility.resetToDefault}
                unlockedVisibleCount={props.candidateColumnVisibility.unlockedVisibleCount}
              />
            </div>
            {props.selectedCandidateIds.length > 0 && job?.id ? (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-indigo-200 bg-indigo-50/80 px-3 py-2.5">
                <p className="text-sm font-semibold text-indigo-900">
                  {props.selectedCandidateIds.length} candidate
                  {props.selectedCandidateIds.length === 1 ? '' : 's'} selected
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={props.onOpenBulkScheduleInterview}
                    className="inline-flex items-center gap-2 rounded-lg border border-violet-200 bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-violet-700"
                    title="Schedule interview for selected candidates"
                  >
                    <Calendar size={14} strokeWidth={2.25} />
                    Schedule Interview
                    {props.selectedCandidateIds.length > 1
                      ? ` (${props.selectedCandidateIds.length})`
                      : ''}
                  </button>
                  <button
                    type="button"
                    onClick={props.onOpenBulkSubmitToClient}
                    className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-indigo-700"
                    title="Choose CV type, then submit selected candidates to the client"
                  >
                    <Send size={14} strokeWidth={2.25} />
                    Submit {props.selectedCandidateIds.length} to Client
                  </button>
                  <button
                    type="button"
                    onClick={() => props.setSelectedCandidateIds([])}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-white px-3 py-1.5 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-50"
                  >
                    <X size={14} />
                    Clear
                  </button>
                </div>
              </div>
            ) : null}
            {props.appliedCandidatesLoading || props.appliedPipelineRunning ? (
              <div className="flex min-h-0 flex-1 items-center justify-center gap-2 p-10 text-sm text-slate-500">
                <Loader2 size={18} className="animate-spin text-emerald-600" />
                {props.appliedPipelineRunning
                  ? 'Running AI applied matching…'
                  : 'Loading job-linked candidates…'}
              </div>
            ) : props.jobTableCandidates.length === 0 ? (
              <div className="flex min-h-0 flex-1 flex-col items-center justify-center p-8 text-center">
                <Users size={32} className="mx-auto mb-3 text-slate-300" />
                <p className="text-sm text-slate-500">
                  No candidates applied, assigned, or in the pipeline for this job yet.
                </p>
                {props.canAddCandidate && job?.id ? (
                  <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => props.openAssignPicker()}
                      disabled={Boolean(props.assignPoolAddingId)}
                      className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <UserPlus size={16} />
                      Assign candidate
                    </button>
                    <button
                      type="button"
                      onClick={() => props.fileInputRef.current?.click()}
                      disabled={props.uploadingJobCv}
                      className="inline-flex items-center gap-2 rounded-xl border border-indigo-200 bg-white px-4 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {props.uploadingJobCv ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : (
                        <Upload size={16} />
                      )}
                      {props.uploadingJobCv
                        ? props.jobCvUploadProgress
                          ? `Creating ${props.jobCvUploadProgress.done}/${props.jobCvUploadProgress.total}…`
                          : 'Creating candidates…'
                        : 'Upload CVs to add candidates'}
                    </button>
                  </div>
                ) : null}
              </div>
            ) : props.filteredJobTableCandidates.length === 0 ? (
              <div className="flex min-h-0 flex-1 flex-col items-center justify-center p-8 text-center">
                <Search size={28} className="mx-auto mb-3 text-slate-300" />
                <p className="text-sm text-slate-500">
                  {props.candidatesStageFilterId !== 'all' && !props.jobCandidatesSearch.trim()
                    ? `No candidates in “${
                        props.pipelineStageCountCards.find((s) => s.id === props.candidatesStageFilterId)
                          ?.name || 'this stage'
                      }” yet.`
                    : `No candidates match “${props.jobCandidatesSearch.trim()}”.`}
                </p>
                <div className="mt-3 flex flex-wrap items-center justify-center gap-3">
                  {props.candidatesStageFilterId !== 'all' ? (
                    <button
                      type="button"
                      onClick={() => props.setCandidatesStageFilterId('all')}
                      className="text-sm font-semibold text-indigo-600 hover:text-indigo-700"
                    >
                      Show all stages
                    </button>
                  ) : null}
                  {props.jobCandidatesSearch.trim() ? (
                    <button
                      type="button"
                      onClick={() => props.setJobCandidatesSearch('')}
                      className="text-sm font-semibold text-indigo-600 hover:text-indigo-700"
                    >
                      Clear search
                    </button>
                  ) : null}
                </div>
              </div>
            ) : (
              <>
                <div className={PH2_TABLE_BODY_SCROLL_CLASS}>
                  <CandidateTable
                    candidates={props.pagedJobTableCandidates}
                    showMatchScore={props.showMatchScores}
                    compact
                    fillScrollParent
                    selectedIds={props.selectedCandidateIds}
                    onToggleSelect={(id) =>
                      props.setSelectedCandidateIds((prev) =>
                        prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
                      )
                    }
                    onToggleSelectAll={() =>
                      props.setSelectedCandidateIds((prev) => {
                        const pageIds = props.pagedJobTableCandidates.map((row) => row.id);
                        const allPageSelected =
                          pageIds.length > 0 && pageIds.every((id) => prev.includes(id));
                        if (allPageSelected) {
                          return prev.filter((id) => !pageIds.includes(id));
                        }
                        return [...new Set([...prev, ...pageIds])];
                      })
                    }
                    onViewProfile={props.onViewCandidateProfile}
                    onEditCandidate={props.onEditCandidate}
                    stageOptionsByJobId={props.inlineStageOptionsMerged}
                    stageOptionsLoadingJobId={props.inlineStageOptionsLoadingJobId}
                    movingCandidateId={props.inlineStageUpdatingCandidateId}
                    onLoadStageOptions={props.onLoadStageOptions}
                    onChangeCandidateStage={props.onChangeCandidateStage}
                    onMoveStage={props.onOpenMoveStageFromTable}
                    onRemoveFromJob={props.onRemoveFromJob}
                    removingFromJobCandidateId={props.removingFromJobCandidateId}
                    onDeleteCandidate={props.onDeleteCandidate}
                    deletingCandidateId={props.deletingCandidateId}
                    isColumnVisible={props.candidateColumnVisibility.isVisible}
                  />
                </div>
                <div className={PH2_TABLE_CARD_FOOTER_CLASS}>
                  <PaginationAll
                    initialPage={props.safeCandidatesPage}
                    totalPages={props.candidatesTotalPages}
                    totalCount={props.filteredJobTableCandidates.length}
                    pageSize={props.candidatesPageSize}
                    pageSizeOptions={[...TABLE_PAGE_SIZE_OPTIONS]}
                    onPageSizeChange={(n) => {
                      if (!(TABLE_PAGE_SIZE_OPTIONS as readonly number[]).includes(n)) return;
                      props.setCandidatesPageSize(n as TablePageSize);
                      props.setCandidatesPage(1);
                    }}
                    itemLabel="candidates"
                    onPageChange={props.setCandidatesPage}
                  />
                </div>
              </>
            )}
          </div>
        </div>
      ) : job ? (
        <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
          <JobDrawerAiMatchesTab
            job={job}
            aiMatchCandidates={props.aiMatchCandidates}
            sortedAiMatchCandidates={props.filteredSortedAiMatchCandidates}
            aiTierStats={props.aiTierStats}
            aiMatchesLoading={props.aiMatchesLoading}
            aiPipelineRunning={props.aiPipelineRunning}
            aiMatchesError={props.aiMatchesError}
            aiMatchSelectedIds={props.aiMatchSelectedIds}
            aiSavedMatches={props.aiSavedMatches}
            aiExpandedAnalysis={props.aiExpandedAnalysis}
            onRunAiMatches={props.onRunAiMatches}
            onToggleSelect={props.onToggleAiSelect}
            onToggleSelectAll={props.onToggleAiSelectAll}
            onToggleSave={props.onToggleAiSave}
            onToggleAnalysis={props.onToggleAiAnalysis}
            onViewProfile={props.onViewAiProfile}
            onOpenSubmit={props.onOpenAiSubmit}
            isColumnVisible={props.matchColumnVisibility.isVisible}
            columnsMenu={
              <TableColumnsMenu
                columns={MATCH_TABLE_COLUMNS}
                isVisible={props.matchColumnVisibility.isVisible}
                onToggle={props.matchColumnVisibility.toggle}
                onReset={props.matchColumnVisibility.resetToDefault}
                unlockedVisibleCount={props.matchColumnVisibility.unlockedVisibleCount}
              />
            }
          />
        </div>
      ) : null}

      {props.assignPickerOpen && job?.id ? (
        <div className="fixed inset-0 z-[120] flex items-center justify-center px-4">
          <div
            className="absolute inset-0 bg-slate-900/40"
            onClick={() => props.closeAssignPicker()}
          />
          <div className="relative flex max-h-[80vh] w-full max-w-2xl flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="border-b border-slate-100 p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-lg font-bold text-slate-900">Assign candidate</div>
                  <div className="mt-1 text-xs text-slate-500">
                    Select a candidate to assign to{' '}
                    <span className="font-semibold text-slate-700">{job.title}</span>.
                  </div>
                </div>
                <button
                  type="button"
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                  onClick={() => props.closeAssignPicker()}
                >
                  Close
                </button>
              </div>
              <div className="mt-3">
                <input
                  type="text"
                  value={props.assignPoolSearch}
                  onChange={(event) => {
                    const next = event.target.value;
                    props.setAssignPoolSearch(next);
                    void props.loadAssignPoolCandidates(next);
                  }}
                  placeholder="Search by name, email, or skill"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-3">
              {props.assignPoolLoading ? (
                <div className="p-6 text-center text-sm text-slate-500">Loading candidates…</div>
              ) : props.assignPoolCandidates.length === 0 ? (
                <div className="p-6 text-center text-sm text-slate-500">
                  No candidates found
                  {props.assignPoolSearch ? ` for "${props.assignPoolSearch}"` : ''}. Try another
                  search.
                </div>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {props.assignPoolCandidates.map((candidate) => {
                    const fullName =
                      `${candidate.firstName || ''} ${candidate.lastName || ''}`.trim() ||
                      'Candidate';
                    const adding = props.assignPoolAddingId === candidate.id;
                    const alreadyOnJob = props.displayJobCandidates.some(
                      (row) => String(row.id) === String(candidate.id),
                    );
                    return (
                      <li
                        key={candidate.id}
                        className="flex items-center justify-between gap-4 px-3 py-3"
                      >
                        <div className="min-w-0">
                          <div className="truncate font-semibold text-slate-900">{fullName}</div>
                          <div className="truncate text-xs text-slate-500">
                            {candidate.email || '—'}
                            {candidate.currentTitle ? ` · ${candidate.currentTitle}` : ''}
                            {candidate.currentCompany ? ` @ ${candidate.currentCompany}` : ''}
                          </div>
                        </div>
                        <button
                          type="button"
                          disabled={adding || Boolean(props.assignPoolAddingId) || alreadyOnJob}
                          onClick={() => void props.handleAssignFromPool(candidate)}
                          className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                        >
                          {alreadyOnJob ? 'Assigned' : adding ? 'Assigning…' : 'Assign'}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
