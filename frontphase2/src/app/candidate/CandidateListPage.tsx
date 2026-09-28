// AUTO-SPLIT from page.tsx — moved code, no behavior change.
'use client';

import React, { useState, useMemo, useEffect, useCallback, useRef, Suspense } from 'react';
import { CandidateTable, Candidate } from './components/CandidateTable';
import {
  CandidateTableFilters,
  type CandidateTableColumnFilters,
  EMPTY_CANDIDATE_TABLE_COLUMN_FILTERS,
} from './components/CandidateTableFilters';
import { BulkActions } from './components/BulkActions';
import { ScheduleInterviewModal as BulkScheduleInterviewDrawer } from '../../components/interviews/ScheduleInterviewModal';
import { CreatePlacementDrawer } from '../../components/placements/modals/CreatePlacementDrawer';
import type { CreatePlacementPayload } from '../../types/placement';
import {
  combineInterviewDateAndTimeToIso,
  mapInterviewUiTypeToBackend,
} from '../../lib/interview-schedule-helpers';
import type {
  InterviewCandidate,
  InterviewJob,
  InterviewPanelMember,
  ScheduleInterviewPayload,
} from '../../types/interview.types';

import { BULK_CV_TOKENS_CHANGED, getBulkCvTokenSession } from '../../lib/bulkCvTokensStore';

import {
  SmartSearchActiveKeywordsBar,
  SmartSearchPromptPanel,
  SmartSearchToggleButton,
} from '../../components/smart-search/SmartSearchToolbar';
import { useSmartSearch } from '../../hooks/useSmartSearch';
import { mapAiToCandidatesResult, parseSmartSearchWithAi } from '../../lib/smart-search/aiParser';
import { buildCandidatesListApiParams } from '../../lib/smart-search/entitySmartSearch';
import {
  CANDIDATES_SMART_SEARCH_EXAMPLES,
  candidateMatchesSmartKeywordChips,
  mergeCandidatesSmartSearchResult,
  parseCandidatesSmartSearchPrompt,
} from '../../lib/smart-search/parsers';
import {
  FAILED_BULK_RESUMES_CHANGED,
  getActiveFailedBulkResumes,
} from '../../lib/failedBulkResumesStore';
import type {
  CandidateInterviewerOption,
  CandidateProfileDrawerData,
  CandidateScheduledInterview,
  CandidatePipelineJobOption,
  CandidatePipelineRecruiterOption,
  CandidateTagItem,
} from '../../components/drawers/CandidateProfileDrawer';
import nextDynamic from 'next/dynamic';
import { useSubmitToClientModal } from '../../hooks/useSubmitToClientModal';
import {
  Plus,
  Upload,
  FileSpreadsheet,
  FileText,
  Download,
  Search,
  AlertCircle,
  Inbox,
  RefreshCcw,
  XCircle,
  Users,
  Coins,
  Sparkles,
  Lock,
} from 'lucide-react';
import { downloadCsv } from '../../utils/csv';
import { extractAuditMeta } from '../../utils/auditMeta';
import { formatDateDMY } from '../../utils/dateDisplay';
import { displayCandidateEmail, parseBulkCopyLabel } from '../../lib/bulkCvEmail';
import {
  collectCandidateWorkEntries,
  formatCandidateExperienceForTable,
  resolveCandidateExperienceYears,
} from '../../lib/candidateExperience';
import { ExportColumnsModal } from '../../components/export/ExportColumnsModal';
import { buildCandidatesCsvColumns, CANDIDATES_EXPORT_COLUMNS } from '../../lib/export/candidatesExportColumns';
import { TableColumnsMenu } from '../../components/table/TableColumnsMenu';
import { usePersistedColumnVisibility } from '../../hooks/usePersistedColumnVisibility';
import { CANDIDATE_TABLE_COLUMNS } from '../../lib/tableColumns/moduleTableColumns';
import { fetchAllPaginated, totalPagesFromPagination } from '../../lib/export/fetchAllPaginated';
import { CreateTaskModal } from '../../components/CreateTaskModal';
import { Toaster, toast } from 'sonner';
import PaginationAll from '../../components/PaginationAll';
import { TABLE_PAGE_SIZE_OPTIONS, type TablePageSize } from '../../constants/tablePagination';
import { requestConfirm, requestError, requestPrompt } from '../../lib/appDialog';
import { RECYCLE_BIN_SYNC_EVENT } from '../../constants/recycleBin';
import { parseClientsListFromResponse, parseJobsListFromResponse } from '../../lib/parseApiList';
import { dedupeCompanyNameLabels } from '../../lib/companyNameKey';
import { resolveCountryFilterLabel, getCscCountryOptions } from '../../lib/cscData';
import {
  apiAddCandidateNote,
  apiAddCandidateTag,
  apiAddCandidateToPipeline,
  apiRemoveCandidateFromPipeline,
  apiBulkActionCandidates,
  apiBulkCvListFailedResumes,
  apiDeleteCandidate,
  apiDeleteCandidateNote,
  apiGetCandidate,
  apiGetCandidates,
  apiGetClients,
  apiGetJobs,
  apiGetPipelineStages,
  apiMoveCandidateStage,
  apiPinCandidateNote,
  apiRejectCandidate,
  apiRemoveCandidateTag,
  apiCreateInterview,
  apiCreatePlacement,
  apiScheduleCandidateInterview,
  emitNotificationsUpdated,
  apiUpdateCandidate,
  apiUpdateCandidateInterview,
  apiUpdateCandidateNote,
  type BackendCandidate,
  type BackendJob,
  getCachedPhase1CommonPoolEnabled,
  ORG_RECRUITMENT_CACHE_EVENT,
} from '../../lib/api';
import { shouldIncludePhase1CommonPool } from '../../lib/phase1CommonPoolAccess';
import { getAllTeamMembersForAssign } from '../../lib/api/teamApi';
import { getActiveOrgUnitId } from '../../lib/org/orgWorkspaceStorage';
import { usePathname, useSearchParams, useRouter } from 'next/navigation';
import { usePermissions } from '../../hooks/usePermissions';
import { usePageAutoRefresh } from '../../hooks/usePageAutoRefresh';
import {
  isCandidatesListCacheFresh,
  readCandidatesListCache,
  writeCandidatesListCache,
  invalidateEmployerCandidatesCache,
} from '../../lib/employerPageCache';
import { effectiveCandidateSearchQuery } from '../../lib/candidateSearchGate';
import { useWorkspaceEntityAlerts } from '../../hooks/useWorkspaceEntityAlerts';
import { TableSkeleton } from '../../components/ui/Skeleton';
import { AiCoinLockBadge, useAiCoinGate } from '../../components/coins/AiCoinGate';
import {
  PH2_TABLE_BODY_SCROLL_CLASS,
  PH2_TABLE_CARD_CLASS,
  PH2_TABLE_CARD_FOOTER_CLASS,
  PH2_TOOLBAR_FILTERS_CLASS,
  PH2_TOOLBAR_ROW_CLASS,
} from '../../components/layout/Ph2ModulePageLayout';
import {
  candidateShowsAppliedTag,
  resolveCandidateAssignedJobTitles,
  resolveCandidateListStage,
} from '../../lib/candidateListMapping';
import { normalizeCandidateSkillLabels } from '../../lib/normalizeCandidateSkills';
import {
  enrichBackendCandidateFromPhase1Snapshot,
  isPhase1PortalCandidate,
} from '../../lib/phase1ProfileSnapshot';
import {
  extractApiData,
  getTagColor,
  isValidObjectId,
  mapCandidateProfile,
  resolveCandidateDisplayName,
} from '../../lib/mapCandidateProfile';
import {
  candidateRowCanSubmitToClient,
  isInterviewPipelineStage,
  isOfferPipelineStage,
  isSubmitToClientStageOption,
  profileCanSubmitToClient,
  resolveSubmitJobIdForProfile,
  resolveSubmitJobIdForRow,
  resolveSubmitJobIdFromBackend,
  SUBMIT_TO_CLIENT_STAGE_OPTION_LABEL,
  SUBMIT_TO_CLIENT_STAGE_OPTION_VALUE,
} from '../../lib/candidateSubmitToClient';
import { useCandidateList, CANDIDATE_TABLE_TAB_CLASS } from '././useCandidateList';

const CandidateProfileDrawer = nextDynamic(
  () => import('../../components/drawers/CandidateProfileDrawer').then((mod) => ({ default: mod.CandidateProfileDrawer })),
  { ssr: false, loading: () => null }
);

const CandidateScheduleInterviewModal = nextDynamic(
  () => import('../../components/drawers/CandidateProfileDrawer').then((mod) => ({ default: mod.ScheduleInterviewModal })),
  { ssr: false, loading: () => null }
);

const AddCandidateDrawer = nextDynamic(
  () => import('../../components/candidates/AddCandidateDrawer'),
  { ssr: false, loading: () => null }
);

const FailedBulkResumesDrawer = nextDynamic(
  () => import('../../components/candidates/FailedBulkResumesDrawer'),
  { ssr: false, loading: () => null }
);

const RepairBadNamesDrawer = nextDynamic(
  () => import('../../components/candidates/RepairBadNamesDrawer'),
  { ssr: false, loading: () => null }
);

const BulkCvTokensDrawer = nextDynamic(
  () => import('../../components/candidates/BulkCvTokensDrawer'),
  { ssr: false, loading: () => null }
);

const ModuleRecycleBinDrawer = nextDynamic(
  () => import('../../components/ModuleRecycleBinDrawer'),
  { ssr: false, loading: () => null }
);


export function CandidateListPage() {
  const {
    router,
    pathname,
    searchParams,
    hasPermission,
    hasAnyPermission,
    canCreateCandidate,
    canUpdateCandidate,
    canSubmitToClient,
    canDeleteCandidate,
    canScheduleInterview,
    canExportCandidate,
    selectedIds,
    setSelectedIds,
    createTaskOpen,
    setCreateTaskOpen,
    isAddCandidateOpen,
    setIsAddCandidateOpen,
    candidateDrawerInitialTab,
    setCandidateDrawerInitialTab,
    createCandidateMode,
    setCreateCandidateMode,
    candidateAiGate,
    failedResumesDrawerOpen,
    setFailedResumesDrawerOpen,
    tokensDrawerOpen,
    setTokensDrawerOpen,
    repairNamesDrawerOpen,
    setRepairNamesDrawerOpen,
    bulkCvTokenResumeCount,
    setBulkCvTokenResumeCount,
    pendingBulkRetryFile,
    setPendingBulkRetryFile,
    pendingBulkRetryFiles,
    setPendingBulkRetryFiles,
    pendingBulkRetryServerIds,
    setPendingBulkRetryServerIds,
    failedBulkResumeCount,
    setFailedBulkResumeCount,
    recycleBinModuleOpen,
    setRecycleBinModuleOpen,
    phase1CommonPoolEnabled,
    setPhase1CommonPoolEnabled,
    listTab,
    setListTab,
    filters,
    setFilters,
    candidates,
    setCandidates,
    exportModalOpen,
    setExportModalOpen,
    exportCandidates,
    setExportCandidates,
    exportCandidatesLoading,
    setExportCandidatesLoading,
    loading,
    setLoading,
    tableLoading,
    setTableLoading,
    error,
    setError,
    hasLoadedCandidatesOnceRef,
    columnFilters,
    setColumnFilters,
    debouncedColumnFilters,
    setDebouncedColumnFilters,
    smartSearchCandidateIds,
    setSmartSearchCandidateIds,
    candidateColumnVisibility,
    debouncedSearch,
    setDebouncedSearch,
    selectedCandidateProfile,
    setSelectedCandidateProfile,
    candidateDrawerOpen,
    setCandidateDrawerOpen,
    candidateDrawerMode,
    setCandidateDrawerMode,
    candidateEditOpenToken,
    setCandidateEditOpenToken,
    pendingDeepLinkCandidateIdRef,
    loadCandidatesRequestIdRef,
    loadCandidatesAbortRef,
    candidatePrefetchGenRef,
    loadingCandidateProfile,
    setLoadingCandidateProfile,
    availableDrawerTags,
    setAvailableDrawerTags,
    pipelineJobs,
    setPipelineJobs,
    jobFilterOptions,
    setJobFilterOptions,
    pipelineRecruiters,
    setPipelineRecruiters,
    companyFilterOptions,
    setCompanyFilterOptions,
    locationFilterOptions,
    setLocationFilterOptions,
    companyFilterOptionsRef,
    locationFilterOptionsRef,
    submitClientRowId,
    setSubmitClientRowId,
    openSubmit,
    openBulkSubmit,
    submitModalElement,
    jobFilterOptionsRef,
    interviewPanelMembers,
    setInterviewPanelMembers,
    bulkScheduleInterviewOpen,
    setBulkScheduleInterviewOpen,
    bulkScheduleCandidateIds,
    setBulkScheduleCandidateIds,
    bulkSchedulePrefillJobId,
    setBulkSchedulePrefillJobId,
    bulkScheduleJobs,
    setBulkScheduleJobs,
    stageScheduleOpen,
    setStageScheduleOpen,
    stageScheduleCandidate,
    setStageScheduleCandidate,
    stageScheduleJobId,
    setStageScheduleJobId,
    pendingStageAfterWorkflow,
    setPendingStageAfterWorkflow,
    placementDrawerOpen,
    setPlacementDrawerOpen,
    placementSubmitting,
    setPlacementSubmitting,
    placementPrefill,
    setPlacementPrefill,
    bulkMoveStageOpen,
    setBulkMoveStageOpen,
    bulkMoveStageJobId,
    setBulkMoveStageJobId,
    bulkMoveStageStageId,
    setBulkMoveStageStageId,
    bulkMoveStageNote,
    setBulkMoveStageNote,
    bulkMoveStageOptions,
    setBulkMoveStageOptions,
    bulkMoveStageLoading,
    setBulkMoveStageLoading,
    bulkMoveStageSaving,
    setBulkMoveStageSaving,
    bulkAssignJobOpen,
    setBulkAssignJobOpen,
    bulkAssignJobJobId,
    setBulkAssignJobJobId,
    bulkAssignJobStageId,
    setBulkAssignJobStageId,
    bulkAssignJobNote,
    setBulkAssignJobNote,
    bulkAssignJobOptions,
    setBulkAssignJobOptions,
    bulkAssignJobLoading,
    setBulkAssignJobLoading,
    bulkAssignJobSaving,
    setBulkAssignJobSaving,
    deletingCandidateId,
    setDeletingCandidateId,
    currentPage,
    setCurrentPage,
    pageSize,
    setPageSize,
    totalEntries,
    setTotalEntries,
    candidatesFilterSig,
    inlineStageOptionsByJobId,
    setInlineStageOptionsByJobId,
    inlineStageOptionsLoadingJobId,
    setInlineStageOptionsLoadingJobId,
    inlineStageUpdatingCandidateId,
    setInlineStageUpdatingCandidateId,
    currentUser,
    setCurrentUser,
    currentDrawerUser,
    openCandidateDrawer,
    refreshFailedBulkResumeCount,
    refreshBulkCvTokenCount,
    handleBulkRetryFileConsumed,
    handleFailedResumeReupload,
    handleFailedResumeRetryFiles,
    syncCandidateCard,
    loadCandidateProfile,
    loadCandidates,
    handleRepairBadNames,
    switchListTab,
    refreshJobFilterOptions,
    candidatesAutoLoad,
    hasTableColumnFilters,
    candidateSmartSearchOptions,
    candidateSmartSearch,
    hasToolbarFilters,
    handleClearToolbar,
    handleColumnFiltersChange,
    filteredCandidates,
    workspaceAlertsByEntityId,
    buildCandidatesExportQueryParams,
    fetchAllCandidatesForExport,
    openExportModal,
    handleExportCandidatesCsv,
    handleToggleSelect,
    handleToggleSelectAll,
    loadBulkMoveStageOptions,
    loadInlineStageOptionsForCandidate,
    openScheduleInterviewForCandidate,
    closeStageScheduleInterview,
    openPlacementForCandidate,
    applyPendingStageAfterWorkflow,
    handleStageScheduleInterview,
    handleInlineCandidateStageChange,
    openBulkMoveStageModal,
    closeBulkMoveStageModal,
    loadBulkAssignJobOptions,
    openBulkAssignJobModal,
    closeBulkAssignJobModal,
    submitBulkAssignJob,
    bulkScheduleCandidates,
    bulkScheduleInterviewers,
    openBulkSubmitToClient,
    openBulkScheduleInterview,
    closeBulkScheduleInterview,
    handleBulkScheduleInterview,
    submitBulkMoveStage,
    handleDeleteCandidate,
    handleViewProfile,
    handleEditCandidate,
    handleWhatsAppCandidate,
  } = useCandidateList();

  return (
    <>
      <Toaster position="top-right" richColors style={{ top: '5rem' }} />
      <div className="ph2-page-shell flex h-[calc(100dvh-3.5rem)] w-full flex-col overflow-hidden text-slate-900">
        <main className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
          <header className="flex min-h-[4.5rem] shrink-0 flex-wrap items-center justify-between gap-3 border-b border-indigo-100/50 bg-white/80 px-4 py-3 shadow-[inset_0_-1px_0_0_rgba(99,102,241,0.08)] backdrop-blur-md sm:px-6">
            <div className="flex items-center gap-2.5 sm:gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 via-blue-600 to-indigo-600 text-white shadow-lg shadow-indigo-500/30 ring-1 ring-white/20">
                <Users className="h-5 w-5" strokeWidth={2.2} />
              </div>
              <div>
                <h1 className="text-xl font-bold leading-none tracking-tight text-slate-900 sm:text-[1.35rem]">
                  Candidates
                </h1>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  void loadCandidates();
                }}
                disabled={loading || tableLoading}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-indigo-200/80 bg-white text-indigo-700 shadow-[0_4px_14px_-4px_rgba(99,102,241,0.2)] transition-all hover:border-indigo-300 hover:bg-indigo-50/90 active:scale-[0.98] disabled:opacity-50"
                title="Refresh"
              >
                <RefreshCcw
                  size={16}
                  strokeWidth={2.25}
                  className={loading || tableLoading ? 'animate-spin' : ''}
                />
              </button>
              {canDeleteCandidate ? (
                <button
                  type="button"
                  onClick={() => setRecycleBinModuleOpen(true)}
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-indigo-200/80 bg-white text-indigo-700 shadow-[0_4px_14px_-4px_rgba(99,102,241,0.2)] transition-all hover:border-indigo-300 hover:bg-indigo-50/90 active:scale-[0.98]"
                  title="Deleted candidates"
                >
                  <Inbox size={17} strokeWidth={2.25} />
                </button>
              ) : null}
              {canCreateCandidate ? (
                <>
                  <button
                    type="button"
                    onClick={() => openCandidateDrawer('csv')}
                    className="flex items-center gap-1.5 rounded-lg border border-indigo-200/70 bg-white px-3 py-2 text-xs font-semibold text-indigo-900 shadow-[0_4px_14px_-4px_rgba(99,102,241,0.25)] transition-all hover:border-indigo-300 hover:bg-indigo-50/90 active:scale-[0.98]"
                  >
                    <FileSpreadsheet size={16} className="text-indigo-600" strokeWidth={2.25} />
                    <span>Bulk CSV</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => openCandidateDrawer('bulkResume')}
                    className="flex items-center gap-1.5 rounded-lg border border-indigo-200/70 bg-white px-3 py-2 text-xs font-semibold text-indigo-900 shadow-[0_4px_14px_-4px_rgba(99,102,241,0.25)] transition-all hover:border-indigo-300 hover:bg-indigo-50/90 active:scale-[0.98]"
                  >
                    <FileText size={16} className="text-indigo-600" strokeWidth={2.25} />
                    <span>Bulk CV</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFailedResumesDrawerOpen(true)}
                    className={`relative flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold shadow-[0_4px_14px_-4px_rgba(99,102,241,0.2)] transition-all active:scale-[0.98] ${
                      failedBulkResumeCount > 0
                        ? 'border-rose-200 bg-rose-50 text-rose-800 hover:border-rose-300 hover:bg-rose-100'
                        : 'border-indigo-200/70 bg-white text-indigo-900 hover:border-indigo-300 hover:bg-indigo-50/90'
                    }`}
                  >
                    <AlertCircle
                      size={16}
                      className={failedBulkResumeCount > 0 ? 'text-rose-600' : 'text-indigo-600'}
                      strokeWidth={2.25}
                    />
                    <span>Failed resumes</span>
                    {failedBulkResumeCount > 0 ? (
                      <span className="ml-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-600 px-1 text-[9px] font-bold text-white">
                        {failedBulkResumeCount > 99 ? '99+' : failedBulkResumeCount}
                      </span>
                    ) : null}
                  </button>
                  <button
                    type="button"
                    onClick={handleRepairBadNames}
                    className="flex items-center gap-1.5 rounded-lg border border-indigo-200/70 bg-white px-3 py-2 text-xs font-semibold text-indigo-900 shadow-[0_4px_14px_-4px_rgba(99,102,241,0.25)] transition-all hover:border-indigo-300 hover:bg-indigo-50/90 active:scale-[0.98]"
                    title="Auto-fix names taken from CV filenames / titles"
                  >
                    <Sparkles size={16} className="text-indigo-600" strokeWidth={2.25} />
                    <span>Fix names</span>
                  </button>
                </>
              ) : null}
              <button
                type="button"
                onClick={() => void openExportModal()}
                className="flex items-center gap-1.5 rounded-lg border border-indigo-200/70 bg-white px-3 py-2 text-xs font-semibold text-indigo-900 shadow-[0_4px_14px_-4px_rgba(99,102,241,0.25)] transition-all hover:border-indigo-300 hover:bg-indigo-50/90 hover:shadow-[0_6px_20px_-4px_rgba(99,102,241,0.35)] active:scale-[0.98]"
                title="Export candidates to CSV"
              >
                <Download size={16} className="text-indigo-600" strokeWidth={2.25} />
                <span>Export</span>
              </button>
              {canCreateCandidate ? (
                <button
                  type="button"
                  onClick={() => openCandidateDrawer('resume')}
                  className="flex items-center gap-1.5 rounded-lg border border-indigo-200/70 bg-white px-3 py-2 text-xs font-semibold text-indigo-900 shadow-[0_4px_14px_-4px_rgba(99,102,241,0.25)] transition-all hover:border-indigo-300 hover:bg-indigo-50/90 active:scale-[0.98]"
                >
                  <Upload size={16} className="text-indigo-600" strokeWidth={2.25} />
                  <span>Upload</span>
                </button>
              ) : null}
              {canCreateCandidate ? (
                <button
                  type="button"
                  onClick={() => setTokensDrawerOpen(true)}
                  className="flex items-center gap-1.5 rounded-lg border border-indigo-200/70 bg-white px-3 py-2 text-xs font-semibold text-indigo-900 shadow-[0_4px_14px_-4px_rgba(99,102,241,0.25)] transition-all hover:border-indigo-300 hover:bg-indigo-50/90 active:scale-[0.98]"
                  title="CV parse token usage (last bulk upload)"
                >
                  <Coins size={16} className="text-indigo-600" strokeWidth={2.25} />
                  <span>Tokens</span>
                  {bulkCvTokenResumeCount > 0 ? (
                    <span className="ml-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-indigo-600 px-1 text-[9px] font-bold text-white">
                      {bulkCvTokenResumeCount > 99 ? '99+' : bulkCvTokenResumeCount}
                    </span>
                  ) : null}
                </button>
              ) : null}
              {canCreateCandidate ? (
                <div
                  role="group"
                  aria-label="Create candidate"
                  className="inline-flex items-center rounded-lg border border-slate-200/90 bg-slate-100/90 p-0.5 shadow-[0_4px_14px_-4px_rgba(99,102,241,0.18)]"
                >
                  <button
                    type="button"
                    aria-pressed={createCandidateMode === 'ai'}
                    onClick={() => {
                      if (candidateAiGate.locked) {
                        void candidateAiGate.confirmAndUnlock();
                        return;
                      }
                      setCreateCandidateMode('ai');
                      openCandidateDrawer('manual');
                    }}
                    className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${
                      candidateAiGate.locked
                        ? 'text-amber-800 hover:bg-amber-50'
                        : createCandidateMode === 'ai'
                          ? 'bg-white text-violet-800 shadow-sm ring-1 ring-violet-200/70'
                          : 'text-slate-500 hover:bg-white/60 hover:text-violet-700'
                    }`}
                    title={
                      candidateAiGate.locked
                        ? `Locked — needs ${candidateAiGate.cost} coins (you have ${candidateAiGate.coins})`
                        : `Create a candidate with AI (${candidateAiGate.cost} coins per chat message)`
                    }
                  >
                    {candidateAiGate.locked ? (
                      <Lock size={14} className="text-amber-600" strokeWidth={2.25} />
                    ) : (
                      <Sparkles size={14} className="text-violet-600" strokeWidth={2.25} />
                    )}
                    <span>Create with AI</span>
                    <AiCoinLockBadge featureId="ai.candidate_chat" />
                  </button>
                  <button
                    type="button"
                    aria-pressed={createCandidateMode === 'manual'}
                    onClick={() => {
                      setCreateCandidateMode('manual');
                      openCandidateDrawer('manual');
                    }}
                    className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${
                      createCandidateMode === 'manual'
                        ? 'bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 text-white shadow-sm'
                        : 'text-slate-500 hover:bg-white/60 hover:text-indigo-700'
                    }`}
                    title="Create a candidate manually"
                  >
                    <Plus
                      size={14}
                      className={createCandidateMode === 'manual' ? 'text-white' : 'text-indigo-500'}
                      strokeWidth={2.5}
                    />
                    <span>Create Manually</span>
                  </button>
                </div>
              ) : null}
            </div>
          </header>

          <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-3 py-4 sm:px-5 sm:py-6 lg:px-6">
            <div className="mx-auto flex min-h-0 w-full max-w-[1600px] flex-1 flex-col overflow-hidden">

              <div className={PH2_TABLE_CARD_CLASS}>
                <div className="flex shrink-0 items-center gap-1 border-b border-indigo-100/80 bg-gradient-to-r from-indigo-50/90 via-white to-slate-50/80 px-4 sm:px-5">
                  {phase1CommonPoolEnabled ? (
                    <button
                      type="button"
                      onClick={() => switchListTab('all')}
                      className={`${CANDIDATE_TABLE_TAB_CLASS} ${
                        listTab === 'all'
                          ? 'border-indigo-600 text-indigo-700'
                          : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800'
                      }`}
                      aria-current={listTab === 'all' ? 'page' : undefined}
                    >
                      All candidates
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => switchListTab('mine')}
                    className={`${CANDIDATE_TABLE_TAB_CLASS} ${
                      listTab === 'mine'
                        ? 'border-indigo-600 text-indigo-700'
                        : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800'
                    }`}
                    aria-current={listTab === 'mine' ? 'page' : undefined}
                  >
                    My candidates
                  </button>
                </div>
                <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-indigo-100/50 px-4 py-2 sm:px-5">
                  <p className="text-xs text-slate-500">
                    {loading || tableLoading
                      ? 'Loading candidates…'
                      : listTab === 'mine'
                        ? `Showing ${totalEntries.toLocaleString()} candidate${totalEntries === 1 ? '' : 's'} you added or who applied to your jobs`
                        : phase1CommonPoolEnabled
                          ? `Showing ${totalEntries.toLocaleString()} candidate${totalEntries === 1 ? '' : 's'} — CRM + job portal + Phase 1 (candidatecommon)`
                          : `Showing ${totalEntries.toLocaleString()} candidate${totalEntries === 1 ? '' : 's'} — CRM + job portal`}
                  </p>
                </div>
                <div className={PH2_TOOLBAR_ROW_CLASS}>
                  <div className={PH2_TOOLBAR_FILTERS_CLASS}>
                    <div className="relative w-44 shrink-0 sm:w-52">
                      <Search
                        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-indigo-400"
                        size={16}
                        strokeWidth={2.25}
                      />
                      <input
                        type="text"
                        placeholder="Search name or email…"
                        value={filters.search}
                        onChange={(e) => {
                          setCurrentPage(1);
                          setFilters((prev) => ({ ...prev, search: e.target.value }));
                        }}
                        className="h-9 w-full rounded-xl border border-indigo-100/90 bg-white/95 pl-10 pr-3 text-xs text-slate-800 shadow-[inset_0_1px_2px_rgba(15,23,42,0.04)] placeholder:text-slate-400 transition-all focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                      />
            </div>
                    <SmartSearchToggleButton
                      open={candidateSmartSearch.open}
                      onToggle={() => candidateSmartSearch.setOpen((value) => !value)}
                    />
                    <CandidateTableFilters
                      filters={columnFilters}
                      onChange={handleColumnFiltersChange}
                      companyOptions={companyFilterOptions}
                      locationOptions={locationFilterOptions}
                      jobOptions={jobFilterOptions}
                    />
                    <TableColumnsMenu
                      columns={CANDIDATE_TABLE_COLUMNS}
                      isVisible={candidateColumnVisibility.isVisible}
                      onToggle={candidateColumnVisibility.toggle}
                      onReset={candidateColumnVisibility.resetToDefault}
                      unlockedVisibleCount={candidateColumnVisibility.unlockedVisibleCount}
                    />
                    <div className="flex shrink-0 items-center self-center xl:ml-auto">
                      {hasToolbarFilters ? (
                <button
                          type="button"
                          className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-semibold text-rose-600 transition-colors hover:bg-rose-50 hover:text-rose-700"
                          onClick={handleClearToolbar}
                        >
                          <XCircle size={15} className="shrink-0 text-rose-500" strokeWidth={2.35} />
                          Clear filters
                </button>
                      ) : null}
            </div>
          </div>
            </div>

                {candidateSmartSearch.open ? (
                  <SmartSearchPromptPanel
                    prompt={candidateSmartSearch.prompt}
                    onPromptChange={candidateSmartSearch.setPrompt}
                    onApply={candidateSmartSearch.handleApply}
                    previewKeywords={candidateSmartSearch.previewKeywords}
                    examples={candidateSmartSearch.examples}
                    onExampleClick={candidateSmartSearch.handleExample}
                    entityLabel="candidates"
                    applying={candidateSmartSearch.applying}
                    placeholder="e.g. React developers in Panvel interviewing on Accounts Assistant assigned to Himanshu"
                  />
                ) : null}

                <SmartSearchActiveKeywordsBar
                  chips={candidateSmartSearch.activeChips}
                  onClearAll={handleClearToolbar}
                  resultCount={filteredCandidates.length}
                  showResultCount={!loading && !error}
                />

                {error ? (
                  <div className="p-10 text-center text-sm font-medium text-rose-600">Error: {error}</div>
                ) : loading ? (
                  <div className={`${PH2_TABLE_BODY_SCROLL_CLASS} p-2`}>
                <TableSkeleton rows={8} columns={7} />
              </div>
            ) : (
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                <BulkActions
                  selectedIds={selectedIds}
                  onMoveStage={canUpdateCandidate ? openBulkMoveStageModal : undefined}
                  onAssignJob={canUpdateCandidate ? openBulkAssignJobModal : undefined}
                  onDelete={canDeleteCandidate ? async (ids) => {
                    if (
                      !(await requestConfirm(
                            `Move ${ids.length} candidate(s) to the Recycle Bin? You can restore them later from Recycle Bin.`,
                      ))
                    ) {
                      return;
                    }
                    try {
                      await Promise.all(ids.map((candidateId) => apiDeleteCandidate(candidateId)));
                      invalidateEmployerCandidatesCache();
                      toast.success(
                            `${ids.length} candidate${ids.length === 1 ? '' : 's'} moved to Recycle Bin`,
                      );
                      setSelectedIds([]);
                      if (typeof window !== 'undefined') {
                        window.dispatchEvent(new CustomEvent(RECYCLE_BIN_SYNC_EVENT));
                      }
                      await loadCandidates();
                    } catch (err: any) {
                      await loadCandidates({ silent: true });
                      toast.error(err?.message || 'Failed to delete candidates');
                    }
                  } : undefined}
                  onScheduleInterview={
                    canScheduleInterview ? openBulkScheduleInterview : undefined
                  }
                  onSubmitToClient={
                    canSubmitToClient ? openBulkSubmitToClient : undefined
                  }
                  onSendEmail={async (ids) => {
                    toast.info(`Send email to ${ids.length} candidate(s) - Feature coming soon`);
                  }}
                  onAddTag={canUpdateCandidate ? async (ids) => {
                    const tag = await requestPrompt('Enter tag name:', {
                      confirmLabel: 'Add tag',
                      cancelLabel: 'Cancel',
                      inputPlaceholder: 'Tag name',
                    });
                    if (tag?.trim()) {
                      try {
                        await apiBulkActionCandidates('add_tag', ids, { tag: tag.trim() });
                        toast.success(`Added tag "${tag.trim()}" to ${ids.length} candidate(s)`);
                        setSelectedIds([]);
                        loadCandidates();
                      } catch (err: any) {
                        toast.error(err?.message || 'Failed to add tag');
                      }
                    }
                  } : undefined}
                  onExport={canExportCandidate ? async (ids) => {
                    try {
                      const res = await apiBulkActionCandidates('export', ids);
                      const candidates = res.data?.candidates || [];
                          const headers = [
                            'ID',
                            'First Name',
                            'Last Name',
                            'Email',
                            'Phone',
                            'Company',
                            'Title',
                            'Experience',
                            'Location',
                            'Status',
                            'Source',
                            'Created At',
                          ];
                      const rows = candidates.map((c: any) => [
                        c.id,
                        c.firstName || '',
                        c.lastName || '',
                        c.email || '',
                        c.phone || '',
                        c.currentCompany || '',
                        c.currentTitle || '',
                        c.experience || '',
                        c.location || '',
                        c.status || '',
                        c.source || '',
                        c.createdAt || '',
                      ]);
                      const csv = [headers, ...rows]
                        .map((r) =>
                              r.map((cell: unknown) => `"${String(cell).replace(/"/g, '""')}"`).join(','),
                        )
                        .join('\n');
                      const blob = new Blob([csv], { type: 'text/csv' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `candidates-export-${new Date().toISOString().split('T')[0]}.csv`;
                      a.click();
                      URL.revokeObjectURL(url);
                      toast.success(`Exported ${candidates.length} candidate(s)`);
                    } catch (err: any) {
                      toast.error(err?.message || 'Failed to export candidates');
                    }
                  } : undefined}
                  onReject={canUpdateCandidate ? async (ids) => {
                        if (!(await requestConfirm(`Are you sure you want to reject ${ids.length} candidate(s)?`)))
                          return;
                    const reasonInput = await requestPrompt('Enter rejection reason (optional):', {
                      confirmLabel: 'Reject',
                      cancelLabel: 'Cancel',
                      inputPlaceholder: 'Reason',
                    });
                    if (reasonInput === null) return;
                    const reason = reasonInput.trim() || 'Bulk rejection';
                    try {
                      await apiBulkActionCandidates('reject', ids, { reason });
                      toast.success(`Rejected ${ids.length} candidate(s)`);
                      setSelectedIds([]);
                      loadCandidates();
                    } catch (err: any) {
                      toast.error(err?.message || 'Failed to reject candidates');
                    }
                  } : undefined}
                  onDeselect={() => setSelectedIds([])}
                />
                    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
                      {tableLoading ? (
                        <div
                          className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-white/60 backdrop-blur-[1px]"
                          aria-hidden
                        >
                          <RefreshCcw size={22} className="animate-spin text-indigo-500" strokeWidth={2.25} />
                        </div>
                      ) : null}
                      <div className={PH2_TABLE_BODY_SCROLL_CLASS}>
                <CandidateTable
                  candidates={filteredCandidates}
                  selectedIds={selectedIds}
                  onToggleSelect={handleToggleSelect}
                  onToggleSelectAll={handleToggleSelectAll}
                  onViewProfile={handleViewProfile}
                  onWhatsAppCandidate={handleWhatsAppCandidate}
                  onEditCandidate={handleEditCandidate}
                  onDeleteCandidate={canDeleteCandidate ? handleDeleteCandidate : undefined}
                  deletingCandidateId={deletingCandidateId}
                  stageOptionsByJobId={inlineStageOptionsByJobId}
                  stageOptionsLoadingJobId={inlineStageOptionsLoadingJobId}
                  movingCandidateId={inlineStageUpdatingCandidateId}
                  onLoadStageOptions={canUpdateCandidate ? loadInlineStageOptionsForCandidate : undefined}
                  onChangeCandidateStage={canUpdateCandidate ? handleInlineCandidateStageChange : undefined}
                  isColumnVisible={candidateColumnVisibility.isVisible}
                  onSubmitToClient={
                    canSubmitToClient
                      ? (row) => {
                          if (!candidateRowCanSubmitToClient(row)) return;
                          const jobId = resolveSubmitJobIdForRow(row);
                          if (!jobId) {
                            void requestError(
                              'This candidate must be assigned to, applied for, or in the pipeline of a job before submitting to the client.',
                            );
                            return;
                          }
                          setSubmitClientRowId(row.id);
                          void openSubmit({
                            candidateId: row.id,
                            jobId,
                            candidateName: row.name,
                            matchScore: row.matchScore,
                            matchId: row.matchId,
                          });
                        }
                      : undefined
                  }
                  canSubmitToClient={canSubmitToClient ? candidateRowCanSubmitToClient : undefined}
                  submittingToClientCandidateId={submitClientRowId}
                  workspaceAlertsByEntityId={workspaceAlertsByEntityId}
                  fillScrollParent
                />
                      </div>
                    </div>
                    <div className={PH2_TABLE_CARD_FOOTER_CLASS}>
                  <PaginationAll
                    initialPage={currentPage}
                    totalPages={Math.max(1, Math.ceil(totalEntries / pageSize))}
                    totalCount={totalEntries}
                    pageSize={pageSize}
                    pageSizeOptions={[...TABLE_PAGE_SIZE_OPTIONS]}
                    onPageSizeChange={(n) => {
                      if (!(TABLE_PAGE_SIZE_OPTIONS as readonly number[]).includes(n)) return;
                      setPageSize(n as TablePageSize);
                      setCurrentPage(1);
                    }}
                    itemLabel="candidates"
                    onPageChange={setCurrentPage}
                  />
                </div>
              </div>
            )}
            </div>
          </div>
        </div>
        </main>
      <CreateTaskModal
        isOpen={createTaskOpen}
        onClose={() => setCreateTaskOpen(false)}
        onSuccess={() => setCreateTaskOpen(false)}
        initialRelatedTo="Candidate"
      />

      <AddCandidateDrawer
        isOpen={canCreateCandidate && isAddCandidateOpen}
        onClose={() => {
          setIsAddCandidateOpen(false);
        }}
        onSuccess={() => {
          void loadCandidates({ silent: true });
        }}
        currentUser={currentUser || { _id: '', name: 'You', email: '', role: 'RECRUITER' }}
        initialTab={candidateDrawerInitialTab}
        createWithAi={createCandidateMode === 'ai' && candidateDrawerInitialTab === 'manual'}
        showMethodTabs={false}
        pendingBulkRetryFile={pendingBulkRetryFile}
        pendingBulkRetryFiles={pendingBulkRetryFiles}
        pendingBulkRetryServerIds={pendingBulkRetryServerIds}
        onBulkRetryFileConsumed={handleBulkRetryFileConsumed}
      />

      {canCreateCandidate ? (
        <FailedBulkResumesDrawer
          isOpen={failedResumesDrawerOpen}
          onClose={() => setFailedResumesDrawerOpen(false)}
          onReupload={handleFailedResumeReupload}
          onRetryFiles={handleFailedResumeRetryFiles}
        />
      ) : null}

      {canCreateCandidate ? (
        <RepairBadNamesDrawer
          isOpen={repairNamesDrawerOpen}
          onClose={() => setRepairNamesDrawerOpen(false)}
          onApplied={async () => {
            await loadCandidates({ silent: true });
          }}
        />
      ) : null}

      {canCreateCandidate ? (
        <BulkCvTokensDrawer
          isOpen={tokensDrawerOpen}
          onClose={() => setTokensDrawerOpen(false)}
        />
      ) : null}

      {canDeleteCandidate && (
        <ModuleRecycleBinDrawer
          isOpen={recycleBinModuleOpen}
          onClose={() => setRecycleBinModuleOpen(false)}
          kind="candidates"
          onRestored={() => {
            void loadCandidates({ silent: true });
          }}
        />
      )}

      {canUpdateCandidate && bulkMoveStageOpen ? (
        <div className="fixed inset-0 z-[120] flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-slate-900/40" onClick={closeBulkMoveStageModal} />
          <div className="relative w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="border-b border-slate-100 p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-lg font-bold text-slate-900">Move stage</div>
                  <div className="mt-1 text-xs text-slate-500">
                    Move {selectedIds.length} selected candidate{selectedIds.length === 1 ? '' : 's'} to another pipeline stage.
                  </div>
                </div>
                <button
                  type="button"
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                  onClick={closeBulkMoveStageModal}
                  disabled={bulkMoveStageSaving}
                >
                  Close
                </button>
              </div>
            </div>

            <div className="space-y-4 p-5">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-slate-500">Job</label>
                <select
                  value={bulkMoveStageJobId}
                  onChange={async (e) => {
                    const nextJobId = e.target.value;
                    setBulkMoveStageJobId(nextJobId);
                    await loadBulkMoveStageOptions(nextJobId);
                  }}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  disabled={bulkMoveStageSaving || pipelineJobs.length === 0}
                >
                  {pipelineJobs.length === 0 ? (
                    <option value="">No jobs available</option>
                  ) : (
                    pipelineJobs.map((job) => (
                      <option key={job.id} value={job.id}>
                        {job.title}
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-slate-500">Stage</label>
                <select
                  value={bulkMoveStageStageId}
                  onChange={(e) => setBulkMoveStageStageId(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  disabled={
                    bulkMoveStageSaving ||
                    bulkMoveStageLoading ||
                    (bulkMoveStageOptions.length === 0 && !canSubmitToClient)
                  }
                >
                  {bulkMoveStageLoading ? (
                    <option value="">Loading stages...</option>
                  ) : bulkMoveStageOptions.length === 0 && !canSubmitToClient ? (
                    <option value="">No pipeline configured for this job</option>
                  ) : (
                    <>
                      {bulkMoveStageOptions.map((stage) => (
                        <option key={stage.id} value={stage.id}>
                          {stage.name}
                        </option>
                      ))}
                      {canSubmitToClient ? (
                        <option value={SUBMIT_TO_CLIENT_STAGE_OPTION_VALUE}>
                          {SUBMIT_TO_CLIENT_STAGE_OPTION_LABEL}
                        </option>
                      ) : null}
                    </>
                  )}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-slate-500">Note (optional)</label>
                <textarea
                  value={bulkMoveStageNote}
                  onChange={(e) => setBulkMoveStageNote(e.target.value)}
                  rows={3}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  placeholder="Add a short note for this move"
                  disabled={bulkMoveStageSaving}
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-slate-100 p-5">
              <button
                type="button"
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
                onClick={closeBulkMoveStageModal}
                disabled={bulkMoveStageSaving}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-60"
                onClick={submitBulkMoveStage}
                disabled={
                  bulkMoveStageSaving ||
                  bulkMoveStageLoading ||
                  !bulkMoveStageJobId ||
                  !bulkMoveStageStageId ||
                  selectedIds.length === 0
                }
              >
                {bulkMoveStageSaving
                  ? 'Moving...'
                  : isSubmitToClientStageOption(bulkMoveStageStageId)
                    ? SUBMIT_TO_CLIENT_STAGE_OPTION_LABEL
                    : 'Move stage'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {canUpdateCandidate && bulkAssignJobOpen ? (
        <div className="fixed inset-0 z-[120] flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-slate-900/40" onClick={closeBulkAssignJobModal} />
          <div className="relative w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="border-b border-slate-100 p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-lg font-bold text-slate-900">Assign the job</div>
                  <div className="mt-1 text-xs text-slate-500">
                    Assign {selectedIds.length} selected candidate
                    {selectedIds.length === 1 ? '' : 's'} to a job pipeline at once.
                  </div>
                </div>
                <button
                  type="button"
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                  onClick={closeBulkAssignJobModal}
                  disabled={bulkAssignJobSaving}
                >
                  Close
                </button>
              </div>
            </div>

            <div className="space-y-4 p-5">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-slate-500">Job</label>
                <select
                  value={bulkAssignJobJobId}
                  onChange={async (e) => {
                    const nextJobId = e.target.value;
                    setBulkAssignJobJobId(nextJobId);
                    await loadBulkAssignJobOptions(nextJobId);
                  }}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  disabled={bulkAssignJobSaving || pipelineJobs.length === 0}
                >
                  {pipelineJobs.length === 0 ? (
                    <option value="">No jobs available</option>
                  ) : (
                    pipelineJobs.map((job) => (
                      <option key={job.id} value={job.id}>
                        {job.title}
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-slate-500">Starting stage</label>
                <select
                  value={bulkAssignJobStageId}
                  onChange={(e) => setBulkAssignJobStageId(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  disabled={
                    bulkAssignJobSaving ||
                    bulkAssignJobLoading ||
                    bulkAssignJobOptions.length === 0
                  }
                >
                  {bulkAssignJobLoading ? (
                    <option value="">Loading stages...</option>
                  ) : bulkAssignJobOptions.length === 0 ? (
                    <option value="">No pipeline configured for this job</option>
                  ) : (
                    bulkAssignJobOptions.map((stage) => (
                      <option key={stage.id} value={stage.id}>
                        {stage.name}
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-slate-500">Note (optional)</label>
                <textarea
                  value={bulkAssignJobNote}
                  onChange={(e) => setBulkAssignJobNote(e.target.value)}
                  rows={3}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  placeholder="Add a short note for this assignment"
                  disabled={bulkAssignJobSaving}
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-slate-100 p-5">
              <button
                type="button"
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
                onClick={closeBulkAssignJobModal}
                disabled={bulkAssignJobSaving}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-60"
                onClick={submitBulkAssignJob}
                disabled={
                  bulkAssignJobSaving ||
                  bulkAssignJobLoading ||
                  !bulkAssignJobJobId ||
                  !bulkAssignJobStageId ||
                  selectedIds.length === 0
                }
              >
                {bulkAssignJobSaving ? 'Assigning...' : 'Assign the job'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <CandidateScheduleInterviewModal
        isOpen={stageScheduleOpen}
        candidate={stageScheduleCandidate}
        linkedJobTitle={stageScheduleCandidate?.assignedJob || undefined}
        initialJobId={stageScheduleJobId}
        jobs={pipelineJobs.map((job) => ({
          id: job.id,
          title: job.title,
          clientId: job.clientId || null,
          clientName: job.clientName || job.department || null,
        }))}
        interviewers={interviewPanelMembers}
        existingInterviews={[]}
        onClose={closeStageScheduleInterview}
        onSchedule={handleStageScheduleInterview}
      />

      <BulkScheduleInterviewDrawer
        isOpen={bulkScheduleInterviewOpen}
        candidates={bulkScheduleCandidates}
        jobs={bulkScheduleJobs}
        interviewers={bulkScheduleInterviewers}
        bulkScheduleForCandidateIds={
          bulkScheduleCandidateIds.length > 1 ? bulkScheduleCandidateIds : undefined
        }
        prefillCandidateId={
          bulkScheduleCandidateIds.length === 1 ? bulkScheduleCandidateIds[0] : null
        }
        prefillJobId={bulkSchedulePrefillJobId}
        lockJob={Boolean(bulkSchedulePrefillJobId)}
        onClose={closeBulkScheduleInterview}
        onSchedule={handleBulkScheduleInterview}
      />

      <CreatePlacementDrawer
        isOpen={placementDrawerOpen}
        isSubmitting={placementSubmitting}
        currentUserId={currentUser?._id}
        candidates={candidates.map((row) => ({
          id: row.id,
          name: row.name,
          email: row.email || '',
        }))}
        jobs={pipelineJobs.map((job) => ({
          id: job.id,
          title: job.title,
          clientId: job.clientId || undefined,
          clientName: job.clientName || job.department || 'No client linked',
        }))}
        recruiters={pipelineRecruiters.map((member) => ({
          id: member.id,
          name: member.name,
          email: '',
        }))}
        prefill={placementPrefill || undefined}
        onClose={() => {
          if (placementSubmitting) return;
          setPlacementDrawerOpen(false);
          setPlacementPrefill(null);
          setPendingStageAfterWorkflow((prev) => (prev?.kind === 'offer' ? null : prev));
        }}
        onSubmit={async (payload, offerLetter) => {
          try {
            setPlacementSubmitting(true);
            await apiCreatePlacement(payload, offerLetter);
            toast.success('Placement created');
            await applyPendingStageAfterWorkflow();
            setPlacementDrawerOpen(false);
            setPlacementPrefill(null);
            await loadCandidates({ silent: true });
          } catch (error: any) {
            toast.error(error?.message || 'Failed to create placement');
            throw error;
          } finally {
            setPlacementSubmitting(false);
          }
        }}
      />

      <CandidateProfileDrawer
        key={`${selectedCandidateProfile?.id || 'candidate'}-${candidateDrawerMode}`}
        isOpen={candidateDrawerOpen}
        currentUser={currentDrawerUser}
        availableTags={availableDrawerTags}
        jobs={pipelineJobs}
        recruiters={pipelineRecruiters}
        interviewers={interviewPanelMembers}
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
          setCandidateDrawerOpen(false);
          setSelectedCandidateProfile(null);
          setCandidateDrawerMode('view');
          setCandidateEditOpenToken(null);
          if (searchParams.get('candidateId')) {
            const sp = new URLSearchParams(searchParams.toString());
            sp.delete('candidateId');
            pendingDeepLinkCandidateIdRef.current = null;
            const qs = sp.toString();
            router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
          }
        }}
        onAction={(action, candidate) => {
          console.log('Candidate drawer action:', action, candidate.id);
        }}
        onRejectCandidate={canUpdateCandidate ? async (reason, feedback, sendEmail, showFeedbackToCandidate, jobId) => {
          if (!selectedCandidateProfile) return;
          await apiRejectCandidate(selectedCandidateProfile.id, {
            reason,
            feedback,
            sendEmail,
            showFeedbackToCandidate,
            jobId: jobId || selectedCandidateProfile.assignedJobId || undefined,
          });
          await loadCandidateProfile(selectedCandidateProfile.id);
        } : undefined}
        onScheduleInterview={canUpdateCandidate ? async (interviewData) => {
          const payload = {
            jobId: interviewData.jobId,
            clientId: interviewData.clientId || undefined,
            type: interviewData.type,
            round: interviewData.round,
            date: interviewData.date,
            time: interviewData.time,
            duration: interviewData.duration,
            timezone: interviewData.timezone,
            mode: interviewData.mode,
            platform:
              interviewData.platform === 'Google Meet'
                ? 'GOOGLE_MEET'
                : interviewData.platform === 'Zoom'
                  ? 'ZOOM'
                  : null,
            meetingLink: interviewData.meetingLink,
            location: interviewData.location,
            phoneNumber: interviewData.phoneNumber,
            interviewers: interviewData.interviewers,
            notes: interviewData.notes,
            sendCandidateInvite: interviewData.sendCandidateInvite,
            sendInterviewerInvite: interviewData.sendInterviewerInvite,
            status: interviewData.status,
          };

          // If ID looks like a real backend interview id, update; else schedule new.
          if (String(interviewData.id || '').length >= 12 && String(interviewData.id || '').includes('interview-') === false) {
            await apiUpdateCandidateInterview(interviewData.candidateId, interviewData.id, payload);
            toast.success('Interview updated successfully');
          } else {
            await apiScheduleCandidateInterview(interviewData.candidateId, payload as any);
            toast.success('Interview scheduled successfully');
          }
          emitNotificationsUpdated();
          await loadCandidateProfile(interviewData.candidateId);
        } : undefined}
        onMoveStageScheduleInterview={
          canScheduleInterview
            ? async ({ candidateId, jobId, stage, stageId }) => {
                const row =
                  candidates.find((item) => item.id === candidateId) ||
                  (selectedCandidateProfile?.id === candidateId
                    ? ({
                        id: selectedCandidateProfile.id,
                        name: selectedCandidateProfile.name,
                        phone: selectedCandidateProfile.phone || '',
                        stage: selectedCandidateProfile.stage || '',
                        assignedJobs: selectedCandidateProfile.assignedJobs
                          ?.map((j) => j.title)
                          .filter(Boolean) as string[],
                        pipelineJobId: jobId,
                      } as Candidate)
                    : null);
                if (!row) {
                  toast.error('Candidate not found');
                  return;
                }
                let resolvedStageId = stageId || '';
                if (!resolvedStageId && jobId) {
                  try {
                    const response = await apiGetPipelineStages(jobId);
                    const payload = response.data;
                    const stages = Array.isArray(payload)
                      ? payload
                      : Array.isArray((payload as any)?.data)
                        ? (payload as any).data
                        : [];
                    const match = stages.find(
                      (s: any) =>
                        String(s?.name || '').trim().toLowerCase() ===
                        String(stage || '').trim().toLowerCase(),
                    );
                    resolvedStageId = match ? String(match.id || '') : '';
                  } catch {
                    /* keep empty; schedule still opens */
                  }
                }
                await openScheduleInterviewForCandidate(row, jobId, {
                  stageId: resolvedStageId,
                  stageName: stage,
                });
              }
            : undefined
        }
        onMoveStageCreatePlacement={
          canUpdateCandidate
            ? async ({ candidateId, jobId, stage, stageId }) => {
                const row =
                  candidates.find((item) => item.id === candidateId) ||
                  (selectedCandidateProfile?.id === candidateId
                    ? ({
                        id: selectedCandidateProfile.id,
                        name: selectedCandidateProfile.name,
                        phone: selectedCandidateProfile.phone || '',
                        stage: selectedCandidateProfile.stage || '',
                        assignedJobs: selectedCandidateProfile.assignedJobs
                          ?.map((j) => j.title)
                          .filter(Boolean) as string[],
                        pipelineJobId: jobId,
                      } as Candidate)
                    : null);
                if (!row) {
                  toast.error('Candidate not found');
                  return;
                }
                let resolvedStageId = stageId || '';
                if (!resolvedStageId && jobId) {
                  try {
                    const response = await apiGetPipelineStages(jobId);
                    const payload = response.data;
                    const stages = Array.isArray(payload)
                      ? payload
                      : Array.isArray((payload as any)?.data)
                        ? (payload as any).data
                        : [];
                    const match = stages.find(
                      (s: any) =>
                        String(s?.name || '').trim().toLowerCase() ===
                        String(stage || '').trim().toLowerCase(),
                    );
                    resolvedStageId = match ? String(match.id || '') : '';
                  } catch {
                    /* keep empty */
                  }
                }
                openPlacementForCandidate(row, jobId, {
                  stageId: resolvedStageId,
                  stageName: stage,
                });
              }
            : undefined
        }
        onAddNote={canUpdateCandidate ? async (candidateId, note) => {
          await apiAddCandidateNote(candidateId, note);
          await loadCandidateProfile(candidateId);
        } : undefined}
        onEditNote={canUpdateCandidate ? async (candidateId, noteId, updatedNote) => {
          await apiUpdateCandidateNote(candidateId, noteId, updatedNote);
          await loadCandidateProfile(candidateId);
        } : undefined}
        onDeleteNote={canUpdateCandidate ? async (candidateId, noteId) => {
          await apiDeleteCandidateNote(candidateId, noteId);
          await loadCandidateProfile(candidateId);
        } : undefined}
        onPinNote={canUpdateCandidate ? async (candidateId, noteId, isPinned) => {
          await apiPinCandidateNote(candidateId, noteId, isPinned);
          await loadCandidateProfile(candidateId);
        } : undefined}
        onAddTag={canUpdateCandidate ? async (candidateId, tag) => {
          await apiAddCandidateTag(candidateId, tag);
          await loadCandidateProfile(candidateId);
        } : undefined}
        onRemoveTag={canUpdateCandidate ? async (candidateId, tagId) => {
          await apiRemoveCandidateTag(candidateId, tagId);
          await loadCandidateProfile(candidateId);
        } : undefined}
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
        onAddToPipeline={canUpdateCandidate ? async ({ candidateId, jobId, stage, recruiterId, priority, notes }) => {
          await apiAddCandidateToPipeline(candidateId, {
            jobId,
            stage,
            recruiterId,
            priority,
            notes,
          });
          await loadCandidateProfile(candidateId);
        } : undefined}
        onRemoveFromPipeline={
          canUpdateCandidate
            ? async ({ candidateId, jobId }) => {
                await apiRemoveCandidateFromPipeline(candidateId, jobId);
                await loadCandidateProfile(candidateId);
                await loadCandidates({ silent: true });
              }
            : undefined
        }
        onUpdateCandidate={canUpdateCandidate ? async (candidateId, payload) => {
          const response = await apiUpdateCandidate(candidateId, payload);
          const updated = extractApiData<BackendCandidate>(response);
          if (updated) {
            const mappedProfile = mapCandidateProfile(updated);
            setSelectedCandidateProfile(mappedProfile);
            syncCandidateCard(mappedProfile);
          }
          await loadCandidateProfile(candidateId);
        } : undefined}
        onRefreshCandidate={
          canUpdateCandidate
            ? async (candidateId) => {
                await loadCandidateProfile(candidateId);
              }
            : undefined
        }
        openEditDirectly={Boolean(candidateEditOpenToken)}
        editModalOpenToken={candidateEditOpenToken}
        loadingCandidateProfile={loadingCandidateProfile}
      />

      {submitModalElement}
      <ExportColumnsModal
        isOpen={exportModalOpen}
        onClose={() => {
          setExportModalOpen(false);
          setExportCandidates([]);
        }}
        title="Export candidates"
        rowCount={exportCandidates.length}
        rowLabelSingular="candidate"
        rowLabelPlural="candidates"
        columns={CANDIDATES_EXPORT_COLUMNS}
        rows={exportCandidates}
        isLoading={exportCandidatesLoading}
        getRowKey={(candidate) => candidate.id}
        onExport={handleExportCandidatesCsv}
      />
    </div>
    </>
  );
}
