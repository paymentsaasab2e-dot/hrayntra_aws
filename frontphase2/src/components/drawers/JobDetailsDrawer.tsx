'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { usePageDrawerLifecycle } from '../../lib/pageDrawerEvents';
import { useDrawerUnsavedGuard } from '../../hooks/useDrawerUnsavedGuard';

import { AnimatePresence } from 'motion/react';
import { DetailsModalShell } from './DetailsModalShell';
import { DrawerTabBar } from './DrawerTabBar';
import { requestInfo } from '../../lib/appDialog';

import { orEmpty } from '../../lib/asyncLoadGuard';

import { X, Pencil, LayoutGrid, Users, GitBranch, Calendar, UserCheck, Activity, StickyNote, Paperclip, MapPin, Briefcase, Banknote, Send, Copy, ExternalLink, Link2, Share2, Archive, ChevronDown, Plus, Trash2, BarChart2, UserCog, Loader2, ClipboardList, MessageSquare, Building2 } from 'lucide-react';

import { isProtectedJobStatus } from '../../lib/jobStatus';
import { useDrawerPortalDropdownPosition } from './drawerFormUi';
import { createPortal } from 'react-dom';

import { OverviewTab } from './tabs/Overview';
import { FilesTab } from './tabs/Files';
import CandidatesTab from './tabs/Candidates';
import { ClientTab } from './tabs/Client';
import { PipelineTab } from './tabs/Pipeline';
import { AnalyticsTab } from './tabs/Analytics';
import { AssignmentTab } from './tabs/Assignment';
import { InterviewsTab } from './tabs/Interviews';
import { PlacementsTab } from './tabs/Placements';
import { ActivityTab } from './tabs/Activity';
import { NotesTab } from './tabs/Notes';
import { ChatTab } from './tabs/Chat';

import { formatDateDMY } from '../../utils/dateDisplay';

import { AssessmentsTab } from './tabs/Assessments';

import { DRAWER_FORM_SCROLL_BG } from './drawerFormUi';
import { formatJobSalaryRange, formatInterviewListStatus, interviewListStatusBadgeClass, formatInterviewTypeLabel, panelNamesFromInterview, formatPlacementStatusLabel, candidateNameFromInterview, candidateNameFromPlacement, PIPELINE_SYSTEM_ROLE_OPTIONS, buildPipelineStageMatchMeta, resolveCandidateStageId, mapJobCandidateToTableRow, statusStyleFor } from './jobDetailsShared';
import type { JobDrawerStatus, JobForDrawer, JobApplicationSubmission, JobPipelineStage, JobCandidateItem, JobDetailsDrawerProps } from './jobDetailsShared';
import { useJobCandidateActions } from '../../hooks/useJobCandidateActions';
import { JobDrawerModals } from './JobDrawerModals';
import { useJobPipelineTab } from '../../hooks/useJobPipelineTab';
import { useJobTabData } from '../../hooks/useJobTabData';
import { useJobAssignmentTab } from '../../hooks/useJobAssignmentTab';
import { useJobDrawerHeader } from '../../hooks/useJobDrawerHeader';
export type {
  JobDrawerStatus,
  JobForDrawer,
  JobApplicationSubmission,
  JobPipelineStage,
  JobCandidateItem,
  JobDetailsDrawerProps
} from './jobDetailsShared';

/** Render salary with only the job's selected currency symbol (never a default $). */

/** Pipeline stage for Job Pipeline Configuration */

/** Candidate row for Job Candidates list (Candidates tab) */

const TAB_CONFIG = [
  { id: 'overview' as const, label: 'Overview', icon: LayoutGrid },
  { id: 'assessments' as const, label: 'Assessments', icon: ClipboardList },
  { id: 'candidates' as const, label: 'Candidates', icon: Users },
  { id: 'client' as const, label: 'Client', icon: Building2 },
  { id: 'pipeline' as const, label: 'Pipeline', icon: GitBranch },
  { id: 'analytics' as const, label: 'Analytics', icon: BarChart2 },
  { id: 'assignment' as const, label: 'Assignment', icon: UserCog },
  { id: 'interviews' as const, label: 'Interviews', icon: Calendar },
  { id: 'placements' as const, label: 'Placements', icon: UserCheck },
  { id: 'activity' as const, label: 'Activity', icon: Activity },
  { id: 'chat' as const, label: 'Chat', icon: MessageSquare },
  { id: 'notes' as const, label: 'Remarks', icon: StickyNote },
  { id: 'files' as const, label: 'Files', icon: Paperclip },
];
/** Analytics is only opened via header button, not shown in tab bar */
const TABS_VISIBLE_IN_BAR = TAB_CONFIG.filter((t) => t.id !== 'analytics');

const JobDrawerStatusDropdown = ({
  value,
  options,
  onSelect,
  onDelete,
  deleting,
}: {
  value: string;
  options: string[];
  onSelect: (status: string) => void;
  onDelete: (status: string) => void;
  deleting: boolean;
}) => {
  const [open, setOpen] = useState(false);
  const closeMenu = useCallback(() => setOpen(false), []);
  const { triggerRef, menuRef, menuPosition } = useDrawerPortalDropdownPosition(open, false, closeMenu);

  const menu =
    open && menuPosition && typeof document !== 'undefined'
      ? createPortal(
          <div
            ref={menuRef}
            className="fixed z-[1200] max-h-64 overflow-auto rounded-xl border border-slate-200 bg-white shadow-2xl"
            style={{
              left: menuPosition.left,
              width: Math.max(menuPosition.width, 240),
              ...(menuPosition.placement === 'top'
                ? { bottom: menuPosition.bottom }
                : { top: menuPosition.top }),
            }}
          >
            {options.map((status) => {
              const isActive = String(value || '') === String(status || '');
              const canDelete = !isProtectedJobStatus(status);
              return (
                <div
                  key={status}
                  className={`flex w-full items-center gap-1 px-1.5 py-0.5 ${
                    isActive ? 'bg-blue-50' : 'hover:bg-slate-50'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => {
                      onSelect(status);
                      setOpen(false);
                    }}
                    className={`min-w-0 flex-1 rounded-lg px-2 py-1.5 text-left text-sm ${
                      isActive ? 'text-blue-700 font-semibold' : 'text-slate-800'
                    }`}
                  >
                    {status}
                  </button>
                  {canDelete ? (
                    <button
                      type="button"
                      title={`Delete ${status}`}
                      aria-label={`Delete ${status}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        onDelete(status);
                      }}
                      disabled={deleting}
                      className="inline-flex shrink-0 items-center gap-1 rounded-md border border-rose-200 bg-rose-50 px-1.5 py-1 text-[10px] font-bold text-rose-600 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Trash2 className="h-3 w-3" />
                      Delete
                    </button>
                  ) : null}
                </div>
              );
            })}
          </div>,
          document.body,
        )
      : null;

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-bold ${statusStyleFor(value)} hover:opacity-90`}
      >
        <span>{value}</span>
        <ChevronDown size={12} className="opacity-70" />
      </button>
      {menu}
    </div>
  );
};

export function JobDetailsDrawer({
  isOpen,
  onClose,
  job,
  onEdit,
  onPublish,
  onClone,
  onCloseJob,
  jobCandidates: jobCandidatesProp,
  pipelineStages: initialPipelineStages,
  onPipelineStagesChange,
  onSavePipelineStages,
  onMoveStage,
  onAddToPipeline,
  onRemoveFromPipeline,
  pipelineRecruiters: pipelineRecruitersProp,
  onScheduleInterview,
  onCreatePlacement,
  onRejectCandidate,
  onViewCandidateProfile,
  onEditCandidate,
  onJobCandidatesChange,
  onStatusUpdated,
  onAssignmentUpdated,
  canAddCandidate = false,
  layout = 'main',
}: JobDetailsDrawerProps) {
  usePageDrawerLifecycle(isOpen);
  const jobCandidates = orEmpty(jobCandidatesProp);
  const pipelineRecruiters = orEmpty(pipelineRecruitersProp);
    const {
    draggedStageId,
    handleAddStage,
    handlePipelineReorder,
    handleRemoveStage,
    handleStageNameChange,
    handleStageSlaChange,
    handleStageSystemRoleChange,
    isDefaultPipelineStage,
    isOwnPipelineEditRef,
    jobPipelineCustomized,
    notifyPipelineChange,
    orgRecruitmentMode,
    pipelineConfigLocked,
    pipelineDirty,
    pipelineStages,
    pipelineValidationError,
    setDraggedStageId,
    setJobPipelineCustomized,
    setOrgRecruitmentMode,
    setPipelineDirty,
    setPipelineStages,
    setPipelineValidationError,
  } = useJobPipelineTab({
    initialPipelineStages,
    job,
    onPipelineStagesChange,
  });
  const {
    panelRef: jobDrawerPanelRef,
    requestClose: requestJobDrawerClose,
  } = useDrawerUnsavedGuard<HTMLDivElement>({
    isOpen,
    onClose,
    isDirty: pipelineDirty,
  });

  const [activeTab, setActiveTab] = useState<(typeof TAB_CONFIG)[number]['id']>('overview');

const {
    aiMatchCandidates,
    aiTierStats,
    applyPickerCvMeta,
    candidateColumnVisibility,
    candidateMatchMode,
    candidatesStageFilterId,
    candidatesTab,
    candidatesTabProps,
    confirmScheduleInterviewCandidatePicker,
    confirmSubmitCandidatePicker,
    deletingCandidateId,
    displayJobCandidates,
    ensureAiMatchId,
    ensurePickerCvMeta,
    fileInputRef,
    filteredSortedAiMatchCandidates,
    handleDeleteJobCandidate,
    handleInlineCandidateStageChange,
    handleJobCvFileSelected,
    handleRemoveJobCandidate,
    handleRunAiMatches,
    inlineStageOptionsByJobId,
    inlineStageOptionsMerged,
    jobCandidatesSearch,
    loadInlineStageOptionsForCandidate,
    loadPickerCvMetaForIds,
    matchColumnVisibility,
    moveStageCandidate,
    moveStageModalOpen,
    openBulkScheduleInterview,
    openBulkSubmit,
    openBulkSubmitToClient,
    openFromJobDrawerRow,
    openMoveStageFromTable,
    openPickerUpdatedCvEditor,
    openScheduleInterviewCandidatePicker,
    openSubmit,
    openSubmitCandidatePicker,
    pickerCandidates,
    pickerCvMetaById,
    pickerCvMetaByIdRef,
    pickerCvMetaInFlightRef,
    pickerCvMetaLoading,
    pickerCvModeById,
    pickerResumeFileIdById,
    pickerResumePreview,
    pickerSaasaCv,
    pickerSaasaOpenToken,
    pickerSaasaTarget,
    pickerScopeIds,
    pickerSearch,
    pickerSelectedIds,
    pipelineJobOptions,
    recruiterFallbackForJob,
    refreshAiMatches,
    refreshAppliedJobCandidates,
    refreshPickerCvMetaForCandidate,
    removingFromJobCandidateId,
    scheduleCandidatePickerOpen,
    schedulePickerCandidates,
    schedulePickerSearch,
    schedulePickerSelectedIds,
    selectedCandidateIds,
    setAiExpandedAnalysis,
    setAiMatchCandidates,
    setAiMatchSelectedIds,
    setAiMatchesError,
    setAiMatchesLoading,
    setAiPipelineRunning,
    setAiSavedMatches,
    setAppliedCandidatesLoading,
    setAppliedPipelineRunning,
    setCandidateMatchMode,
    setCandidatesStageFilterId,
    setDeletingCandidateId,
    setDisplayJobCandidates,
    setInlineStageOptionsByJobId,
    setInlineStageOptionsLoadingJobId,
    setInlineStageUpdatingCandidateId,
    setJobCandidatesSearch,
    setJobCvUploadProgress,
    setMoveStageCandidate,
    setMoveStageModalOpen,
    setPickerCvMetaById,
    setPickerCvMetaLoading,
    setPickerCvModeById,
    setPickerResumeFileIdById,
    setPickerResumePreview,
    setPickerSaasaOpenToken,
    setPickerSaasaTarget,
    setPickerScopeIds,
    setPickerSearch,
    setPickerSelectedIds,
    setRemovingFromJobCandidateId,
    setScheduleCandidatePickerOpen,
    setSchedulePickerSearch,
    setSchedulePickerSelectedIds,
    setSelectedCandidateIds,
    setShowMatchScores,
    setSubmitCandidatePickerOpen,
    setSubmitClientRowId,
    setUploadingJobCv,
    showHeaderSubmitToClient,
    sortedAiMatchCandidates,
    stageOptionsFromJobPipeline,
    submitCandidatePickerOpen,
    submitClientRowId,
    submitToClientModal,
    updateAiMatchCandidate,
  } = useJobCandidateActions({
    activeTab,
    isOpen,
    job,
    jobCandidates,
    onAddToPipeline,
    onCreatePlacement,
    onJobCandidatesChange,
    onScheduleInterview,
    onViewCandidateProfile,
    pipelineStages,
    setActiveTab,
  });

    const {
    activityFilter,
    clientRemarkCandidates,
    clientRemarksClientName,
    clientRemarksCount,
    clientRemarksError,
    filteredJobInterviews,
    jobActivities,
    jobInterviewAllCandidateCount,
    jobInterviewCountsByRound,
    jobInterviewDetailOpen,
    jobInterviewRoundById,
    jobInterviewRoundNumbers,
    jobInterviews,
    jobPlacements,
    loadingActivities,
    loadingClientRemarks,
    loadingJobInterviews,
    loadingJobPlacements,
    notesTagFilter,
    pinnedNoteIds,
    refreshJobInterviews,
    selectedInterviewRound,
    selectedJobInterview,
    setActivityFilter,
    setClientRemarkCandidates,
    setClientRemarksClientName,
    setClientRemarksCount,
    setClientRemarksError,
    setJobActivities,
    setJobInterviewDetailOpen,
    setJobInterviews,
    setJobPlacements,
    setLoadingActivities,
    setLoadingClientRemarks,
    setLoadingJobInterviews,
    setLoadingJobPlacements,
    setNotesTagFilter,
    setPinnedNoteIds,
    setSelectedInterviewRound,
    setSelectedJobInterview,
    visibleJobInterviews,
  } = useJobTabData({
    activeTab,
    displayJobCandidates,
    isOpen,
    job,
    refreshAppliedJobCandidates,
  });

const {
    applyAssignmentMemberIds,
    assignable,
    assignmentContacts,
    assignmentCurrentUserId,
    assignmentDirty,
    assignmentHiringManagerId,
    assignmentHiringManagerName,
    assignmentManagerId,
    assignmentManagerUsers,
    assignmentMemberIds,
    assignmentRecruiterMenuPosition,
    assignmentRecruiterMenuRef,
    assignmentRecruiterOpen,
    assignmentRecruiterTriggerRef,
    assignmentRecruiterUsers,
    assignmentSeedOrgId,
    assignmentTabActive,
    closeAssignmentRecruiterMenu,
    filteredAssignmentRecruiters,
    loadingAssignmentMeta,
    loadingAssignmentRecruiters,
    needsAssignmentManagerFirst,
    needsAssignmentOrganizationFirst,
    saveAssignment,
    savingAssignment,
    selectAssignmentManager,
    selectedAssignmentAssignees,
    setAssignmentContacts,
    setAssignmentDirty,
    setAssignmentHiringManagerId,
    setAssignmentHiringManagerName,
    setAssignmentManagerId,
    setAssignmentMemberIds,
    setAssignmentRecruiterOpen,
    setLoadingAssignmentMeta,
    setSavingAssignment,
  } = useJobAssignmentTab({
    activeTab,
    isOpen,
    job,
    onAssignmentUpdated,
  });

// Once assignable members load, fill missing manager / org from the primary assignee.

const {
    addJobStatusOption,
    applyJobStatusChange,
    applyLinkCopied,
    applyLinkLoading,
    applyShareMenuPosition,
    applyShareMenuRef,
    applyShareOpen,
    applyShareTriggerRef,
    applyUrl,
    closeApplyShare,
    deleteJobStatusOption,
    deletingJobStatus,
    drawerStatusOptions,
    fetchApplyLink,
    jobStatusCatalog,
    localJobStatus,
    newJobStatusValue,
    openApplyShareMenu,
    openApplyShareTarget,
    savingJobStatus,
    setApplyLinkCopied,
    setApplyLinkLoading,
    setApplyShareOpen,
    setApplyUrl,
    setDeletingJobStatus,
    setJobStatusCatalog,
    setLocalJobStatus,
    setNewJobStatusValue,
    setSavingJobStatus,
    setShowAddJobStatusInput,
    setShowStatusChange,
    setUpdatingJobStatus,
    shareApplyLink,
    showAddJobStatusInput,
    showStatusChange,
    updatingJobStatus,
  } = useJobDrawerHeader({
    isOpen,
    job,
    onStatusUpdated,
  });

// Fetch job activities when activity tab is active

useEffect(() => {
    setJobInterviews([]);
    setJobPlacements([]);
    setAssignmentMemberIds([]);
    setAssignmentManagerId('');
    setAssignmentHiringManagerId('');
    setAssignmentHiringManagerName('');
    setAssignmentDirty(false);
    setAssignmentRecruiterOpen(false);
    setSelectedJobInterview(null);
    setJobInterviewDetailOpen(false);
    setSelectedInterviewRound(1);
    setScheduleCandidatePickerOpen(false);
    setSchedulePickerSelectedIds([]);
    setSchedulePickerSearch('');
  }, [job?.id]);

const pipelineStageCountCards = useMemo(() => {
    const stageList = Array.isArray(pipelineStages) ? pipelineStages : [];
    const stageMeta = buildPipelineStageMatchMeta(stageList);
    const countsByStageId = new Map<string, number>();

    (Array.isArray(displayJobCandidates) ? displayJobCandidates : []).forEach((candidate) => {
      const stageId = resolveCandidateStageId(String(candidate?.currentStage || ''), stageMeta);
      if (!stageId) return;
      countsByStageId.set(stageId, (countsByStageId.get(stageId) || 0) + 1);
    });

    return stageList.map((stage) => {
      return {
        id: stage.id,
        name: String(stage?.name || '').trim() || 'Untitled',
        count: countsByStageId.get(stage.id) || 0,
      };
    });
  }, [pipelineStages, displayJobCandidates]);

  useEffect(() => {
    if (candidatesStageFilterId === 'all') return;
    const stillExists = pipelineStageCountCards.some((stage) => stage.id === candidatesStageFilterId);
    if (!stillExists) setCandidatesStageFilterId('all');
  }, [candidatesStageFilterId, pipelineStageCountCards]);

  return (
    <>
    <AnimatePresence>
      {isOpen ? (
      <DetailsModalShell
        key="job-detail-drawer"
        panelRef={jobDrawerPanelRef}
        onBackdropClick={() => void requestJobDrawerClose()}
        size="lg"
        zIndexClass="z-50"
        dialogTitleId="job-detail-modal-title"
        variant={layout === 'main' ? 'main' : 'centered'}
      >
        {/* Header — overflow visible so apply-link menu can sit above the tab bar */}
        <div className="relative z-20 shrink-0 border-b border-indigo-100/60 bg-gradient-to-br from-white via-indigo-50/45 to-violet-50/35 px-4 pb-2.5 pt-3 sm:px-5">
          <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(99,102,241,0.12),_transparent_55%)]" />
          </div>
          <div className="relative flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              {job ? (
                <>
                  <h2
                    id="job-detail-modal-title"
                    className="truncate text-lg font-bold tracking-tight text-slate-900 sm:text-xl"
                  >
                    {job.title}
                  </h2>
                  <div className="mt-2 flex min-w-0 flex-nowrap items-center gap-2 overflow-x-auto text-sm text-slate-600 [scrollbar-width:thin]">
                    <span className="inline-flex shrink-0 items-center gap-1.5">
                      <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 ring-1 ring-indigo-100">
                        <Briefcase size={12} />
                      </span>
                      {job.client}
                    </span>
                    <span className="inline-flex shrink-0 items-center gap-1.5">
                      <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-violet-50 text-violet-600 ring-1 ring-violet-100">
                        <MapPin size={12} />
                      </span>
                      {job.location}
                    </span>
                    {job.employmentType && (
                      <span className="shrink-0 rounded-full border border-slate-200/90 bg-white/90 px-2.5 py-1 text-[11px] font-semibold text-slate-600 shadow-sm">
                        {job.employmentType}
                      </span>
                    )}
                    {!showStatusChange ? (
                      <button
                        type="button"
                        onClick={() => setShowStatusChange(true)}
                        className={`inline-flex shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-bold transition-opacity hover:opacity-80 ${statusStyleFor(localJobStatus || job.status)}`}
                        title="Change status"
                      >
                        {localJobStatus || job.status}
                      </button>
                    ) : (
                      <div className="flex min-w-[12rem] shrink-0 items-center gap-2">
                          <JobDrawerStatusDropdown
                            value={localJobStatus || job.status}
                            options={drawerStatusOptions}
                            deleting={deletingJobStatus || updatingJobStatus}
                            onSelect={(status) => {
                              void applyJobStatusChange(status);
                            }}
                            onDelete={(status) => {
                              void deleteJobStatusOption(status);
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => {
                              setShowAddJobStatusInput((prev) => !prev);
                              setNewJobStatusValue('');
                            }}
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-700 hover:text-indigo-800"
                          >
                            <Plus className="h-3.5 w-3.5" />
                            Add status
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setShowStatusChange(false);
                              setShowAddJobStatusInput(false);
                              setNewJobStatusValue('');
                              setLocalJobStatus(job.status);
                            }}
                            className="text-[11px] font-semibold text-slate-500 hover:text-slate-700"
                          >
                            Cancel
                          </button>
                        {showAddJobStatusInput ? (
                          <>
                            <input
                              value={newJobStatusValue}
                              onChange={(e) => setNewJobStatusValue(e.target.value)}
                              className="rounded-lg border border-indigo-200 px-2 py-1 text-xs text-slate-800 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                              placeholder="Enter new status"
                              autoFocus
                            />
                            <button
                              type="button"
                              onClick={() => void addJobStatusOption()}
                              disabled={savingJobStatus}
                              className="rounded-lg bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 px-2.5 py-1 text-xs font-semibold text-white hover:brightness-110 disabled:opacity-60"
                            >
                              {savingJobStatus ? 'Adding…' : 'Add'}
                            </button>
                          </>
                        ) : null}
                      </div>
                    )}
                    {job.jobLocationType && (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-[11px] font-semibold text-indigo-700">
                        <UserCheck size={12} />
                        {job.jobLocationType}
                      </span>
                    )}
                    {(() => {
                      const salaryLabel = formatJobSalaryRange(job);
                      return salaryLabel ? (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-slate-200/90 bg-white/90 px-2.5 py-1 text-[11px] font-semibold text-slate-600 shadow-sm">
                        <Banknote size={12} />
                        {salaryLabel}
                      </span>
                      ) : null;
                    })()}
                    <span className="shrink-0 rounded-full border border-slate-200/90 bg-white/90 px-2.5 py-1 text-[11px] font-semibold text-slate-600 shadow-sm">
                      {formatDateDMY(job.postedDate ?? job.createdDate) || '—'}
                    </span>
                  </div>
                </>
              ) : (
                <h2 className="text-lg font-bold text-slate-900">Job Details</h2>
              )}
            </div>
            <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5 sm:gap-2">
              {job && onEdit ? (
                <button
                  type="button"
                  onClick={() => onEdit(job)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-100 bg-white/90 px-2.5 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-800 sm:px-3"
                  title="Edit Job"
                >
                  <Pencil size={14} />
                  <span className="hidden sm:inline">Edit Job</span>
                </button>
              ) : null}
              {job?.status === 'Draft' && onPublish ? (
                <button
                  type="button"
                  onClick={() => onPublish(job)}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 px-2.5 py-2 text-xs font-semibold text-white shadow-sm transition hover:brightness-110 sm:px-3"
                  title="Publish Job"
                >
                  <Send size={14} />
                  <span className="hidden sm:inline">Publish</span>
                </button>
              ) : null}
              {job && onClone ? (
                <button
                  type="button"
                  onClick={() => onClone(job)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-100 bg-white/90 px-2.5 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-800 sm:px-3"
                  title="Clone Job"
                >
                  <Copy size={14} />
                  <span className="hidden sm:inline">Clone Job</span>
                </button>
              ) : null}
              {job && onCloseJob ? (
                <button
                  type="button"
                  onClick={() => onCloseJob(job)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-2.5 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-100 sm:px-3"
                  title="Close Job"
                >
                  <Archive size={14} />
                  <span className="hidden sm:inline">Close Job</span>
                </button>
              ) : null}
              {showHeaderSubmitToClient ? (
                <button
                  type="button"
                  onClick={openSubmitCandidatePicker}
                  className="inline-flex items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-800 shadow-sm transition hover:bg-indigo-100"
                  aria-label="Submit to Client"
                  title="Choose a candidate and submit to the client"
                >
                  <Send size={16} strokeWidth={2.25} />
                  <span className="hidden md:inline">Submit to Client</span>
                </button>
              ) : null}
              {job?.id ? (
                <div className="relative">
                  <button
                    ref={applyShareTriggerRef}
                    type="button"
                    onClick={() => {
                      void openApplyShareMenu();
                    }}
                    disabled={applyLinkLoading && !applyUrl}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-indigo-100 bg-white/90 text-indigo-700 shadow-sm transition hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-50"
                    aria-label="Candidate apply link"
                    title={
                      applyLinkLoading && !applyUrl
                        ? 'Loading apply link…'
                        : applyUrl
                          ? 'Candidate apply link'
                          : 'Click to load apply link'
                    }
                  >
                    {applyLinkLoading ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <Link2 size={16} strokeWidth={2.25} />
                    )}
                  </button>
                  {applyShareOpen && applyUrl && applyShareMenuPosition && typeof document !== 'undefined'
                    ? createPortal(
                        <div
                          ref={applyShareMenuRef}
                          className="fixed z-[1200] max-h-72 w-44 overflow-y-auto rounded-xl border border-indigo-100 bg-white py-1 shadow-xl shadow-indigo-500/10"
                          style={{
                            width: 176,
                            left: Math.max(
                              8,
                              applyShareMenuPosition.left + applyShareMenuPosition.width - 176,
                            ),
                            ...(applyShareMenuPosition.placement === 'top'
                              ? { bottom: applyShareMenuPosition.bottom }
                              : { top: applyShareMenuPosition.top }),
                          }}
                        >
                      <p className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-indigo-400">
                        Apply link
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          void navigator.clipboard.writeText(applyUrl).then(() => {
                            setApplyLinkCopied(true);
                            setApplyShareOpen(false);
                            window.setTimeout(() => setApplyLinkCopied(false), 2000);
                            requestInfo('Apply link copied');
                          });
                        }}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-indigo-50 hover:text-indigo-900"
                      >
                        <Copy size={14} />
                        {applyLinkCopied ? 'Copied' : 'Copy'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setApplyShareOpen(false);
                          void shareApplyLink();
                        }}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-indigo-50 hover:text-indigo-900"
                      >
                        <Share2 size={14} />
                        Share
                      </button>
                      {(
                        [
                          { id: 'whatsapp', label: 'WhatsApp' },
                          { id: 'linkedin', label: 'LinkedIn' },
                          { id: 'x', label: 'X / Twitter' },
                          { id: 'facebook', label: 'Facebook' },
                          { id: 'telegram', label: 'Telegram' },
                          { id: 'email', label: 'Email' },
                        ] as const
                      ).map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => {
                            openApplyShareTarget(item.id);
                            setApplyShareOpen(false);
                          }}
                          className="flex w-full px-3 py-2 pl-9 text-left text-xs font-semibold text-slate-600 hover:bg-indigo-50 hover:text-indigo-900"
                        >
                          {item.label}
                        </button>
                      ))}
                      <a
                        href={applyUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => setApplyShareOpen(false)}
                        className="flex w-full items-center gap-2 border-t border-indigo-50 px-3 py-2 text-left text-xs font-semibold text-indigo-700 hover:bg-indigo-50"
                      >
                        <ExternalLink size={14} />
                        Open
                      </a>
                        </div>,
                        document.body,
                      )
                    : null}
                </div>
              ) : null}
              {job && (
                <button
                  type="button"
                  onClick={() => setActiveTab('analytics')}
                  className="inline-flex items-center gap-2 rounded-xl border border-indigo-100 bg-white/90 px-3 py-2 text-xs font-semibold text-indigo-700 shadow-sm transition hover:bg-indigo-50"
                  aria-label="View analytics"
                >
                  <BarChart2 size={16} /> Analytics
                </button>
              )}
              <button
                type="button"
                onClick={() => void requestJobDrawerClose()}
                className="rounded-xl p-2 text-slate-400 transition-colors hover:bg-indigo-50 hover:text-indigo-700"
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>
          </div>
        </div>

        {job ? (
          <>
            <DrawerTabBar
              ariaLabel="Job sections"
              tabs={TABS_VISIBLE_IN_BAR.map((tab) =>
                tab.id === 'client' ? { ...tab, badge: clientRemarksCount || undefined } : tab,
              )}
              activeId={activeTab}
              onChange={setActiveTab}
              compact
            />

            {/* Tab content */}
            {activeTab === 'candidates' ? (
            <CandidatesTab
              {...candidatesTabProps}
              job={job}
              canAddCandidate={canAddCandidate}
              candidateColumnVisibility={candidateColumnVisibility}
              matchColumnVisibility={matchColumnVisibility}
              onOpenBulkScheduleInterview={openBulkScheduleInterview}
              onOpenBulkSubmitToClient={openBulkSubmitToClient}
              onOpenMoveStageFromTable={openMoveStageFromTable}
              onViewCandidateProfile={onViewCandidateProfile}
              onEditCandidate={onEditCandidate}
            />
          
            ) : (
            <div className={`flex-1 overflow-y-auto ${DRAWER_FORM_SCROLL_BG}`}>
              <div className="space-y-5 p-5 sm:p-6">
              {activeTab === 'overview' && job && <OverviewTab job={job} />}

              {activeTab === 'assessments' && job && (
                <AssessmentsTab job={job} />
              )}

              {activeTab === 'client'  && <ClientTab clientRemarkCandidates={clientRemarkCandidates} clientRemarksClientName={clientRemarksClientName} clientRemarksError={clientRemarksError} displayJobCandidates={displayJobCandidates} job={job} loadingClientRemarks={loadingClientRemarks} mapJobCandidateToTableRow={mapJobCandidateToTableRow} onViewCandidateProfile={onViewCandidateProfile} />}

              {activeTab === 'pipeline'  && <PipelineTab PIPELINE_SYSTEM_ROLE_OPTIONS={PIPELINE_SYSTEM_ROLE_OPTIONS} draggedStageId={draggedStageId} handleAddStage={handleAddStage} handlePipelineReorder={handlePipelineReorder} handleRemoveStage={handleRemoveStage} handleStageNameChange={handleStageNameChange} handleStageSlaChange={handleStageSlaChange} handleStageSystemRoleChange={handleStageSystemRoleChange} isDefaultPipelineStage={isDefaultPipelineStage} job={job} notifyPipelineChange={notifyPipelineChange} onSavePipelineStages={onSavePipelineStages} pipelineConfigLocked={pipelineConfigLocked} pipelineDirty={pipelineDirty} pipelineStageCountCards={pipelineStageCountCards} pipelineStages={pipelineStages} pipelineValidationError={pipelineValidationError} setDraggedStageId={setDraggedStageId} setJobPipelineCustomized={setJobPipelineCustomized} setPipelineDirty={setPipelineDirty} setPipelineStages={setPipelineStages} setPipelineValidationError={setPipelineValidationError} />}
              {activeTab === 'analytics'  && <AnalyticsTab job={job} />}
              {activeTab === 'assignment'  && <AssignmentTab applyAssignmentMemberIds={applyAssignmentMemberIds} assignable={assignable} assignmentContacts={assignmentContacts} assignmentCurrentUserId={assignmentCurrentUserId} assignmentDirty={assignmentDirty} assignmentHiringManagerId={assignmentHiringManagerId} assignmentHiringManagerName={assignmentHiringManagerName} assignmentManagerId={assignmentManagerId} assignmentManagerUsers={assignmentManagerUsers} assignmentMemberIds={assignmentMemberIds} assignmentRecruiterMenuPosition={assignmentRecruiterMenuPosition} assignmentRecruiterMenuRef={assignmentRecruiterMenuRef} assignmentRecruiterOpen={assignmentRecruiterOpen} assignmentRecruiterTriggerRef={assignmentRecruiterTriggerRef} closeAssignmentRecruiterMenu={closeAssignmentRecruiterMenu} filteredAssignmentRecruiters={filteredAssignmentRecruiters} job={job} loadingAssignmentMeta={loadingAssignmentMeta} loadingAssignmentRecruiters={loadingAssignmentRecruiters} needsAssignmentManagerFirst={needsAssignmentManagerFirst} needsAssignmentOrganizationFirst={needsAssignmentOrganizationFirst} saveAssignment={saveAssignment} savingAssignment={savingAssignment} selectAssignmentManager={selectAssignmentManager} selectedAssignmentAssignees={selectedAssignmentAssignees} setAssignmentDirty={setAssignmentDirty} setAssignmentHiringManagerId={setAssignmentHiringManagerId} setAssignmentHiringManagerName={setAssignmentHiringManagerName} setAssignmentManagerId={setAssignmentManagerId} setAssignmentMemberIds={setAssignmentMemberIds} setAssignmentRecruiterOpen={setAssignmentRecruiterOpen} />}
              {activeTab === 'interviews'  && <InterviewsTab candidateNameFromInterview={candidateNameFromInterview} filteredJobInterviews={filteredJobInterviews} formatInterviewListStatus={formatInterviewListStatus} formatInterviewTypeLabel={formatInterviewTypeLabel} interviewListStatusBadgeClass={interviewListStatusBadgeClass} jobInterviewAllCandidateCount={jobInterviewAllCandidateCount} jobInterviewCountsByRound={jobInterviewCountsByRound} jobInterviewRoundById={jobInterviewRoundById} jobInterviewRoundNumbers={jobInterviewRoundNumbers} jobInterviews={jobInterviews} loadingJobInterviews={loadingJobInterviews} onScheduleInterview={onScheduleInterview} openScheduleInterviewCandidatePicker={openScheduleInterviewCandidatePicker} panelNamesFromInterview={panelNamesFromInterview} selectedInterviewRound={selectedInterviewRound} setJobInterviewDetailOpen={setJobInterviewDetailOpen} setSelectedInterviewRound={setSelectedInterviewRound} setSelectedJobInterview={setSelectedJobInterview} />}
              {activeTab === 'placements'  && <PlacementsTab candidateNameFromPlacement={candidateNameFromPlacement} formatPlacementStatusLabel={formatPlacementStatusLabel} job={job} jobPlacements={jobPlacements} loadingJobPlacements={loadingJobPlacements} />}
              {activeTab === 'activity'  && <ActivityTab activityFilter={activityFilter} job={job} jobActivities={jobActivities} loadingActivities={loadingActivities} setActivityFilter={setActivityFilter} />}
              {activeTab === 'notes' && <NotesTab job={job} />}
              {activeTab === 'files' && <FilesTab job={job} />}
              {activeTab === 'chat' && job && <ChatTab activeTab={activeTab} isOpen={isOpen} job={job} />}
              </div>
            </div>
            )}

          </>
        ) : (
          <div className="flex-1 flex items-center justify-center p-8 text-slate-500 text-sm">
            Select a job to view details.
          </div>
        )}
      </DetailsModalShell>
      ) : null}
    </AnimatePresence>

    <JobDrawerModals
      confirmScheduleInterviewCandidatePicker={confirmScheduleInterviewCandidatePicker}
      confirmSubmitCandidatePicker={confirmSubmitCandidatePicker}
      displayJobCandidates={displayJobCandidates}
      ensurePickerCvMeta={ensurePickerCvMeta}
      isOpen={isOpen}
      job={job}
      jobInterviewDetailOpen={jobInterviewDetailOpen}
      moveStageCandidate={moveStageCandidate}
      moveStageModalOpen={moveStageModalOpen}
      onAddToPipeline={onAddToPipeline}
      setDisplayJobCandidates={setDisplayJobCandidates}
      onJobCandidatesChange={onJobCandidatesChange}
      onClose={onClose}
      onCreatePlacement={onCreatePlacement}
      onRemoveFromPipeline={onRemoveFromPipeline}
      onScheduleInterview={onScheduleInterview}
      openFromJobDrawerRow={openFromJobDrawerRow}
      openPickerUpdatedCvEditor={openPickerUpdatedCvEditor}
      pickerCandidates={pickerCandidates}
      pickerCvMetaById={pickerCvMetaById}
      pickerCvMetaLoading={pickerCvMetaLoading}
      pickerCvModeById={pickerCvModeById}
      pickerResumeFileIdById={pickerResumeFileIdById}
      pickerResumePreview={pickerResumePreview}
      pickerSaasaCv={pickerSaasaCv}
      pickerSaasaTarget={pickerSaasaTarget}
      pickerScopeIds={pickerScopeIds}
      pickerSearch={pickerSearch}
      pickerSelectedIds={pickerSelectedIds}
      pipelineJobOptions={pipelineJobOptions}
      pipelineRecruiters={pipelineRecruiters}
      refreshAppliedJobCandidates={refreshAppliedJobCandidates}
      refreshJobInterviews={refreshJobInterviews}
      scheduleCandidatePickerOpen={scheduleCandidatePickerOpen}
      schedulePickerCandidates={schedulePickerCandidates}
      schedulePickerSearch={schedulePickerSearch}
      schedulePickerSelectedIds={schedulePickerSelectedIds}
      selectedJobInterview={selectedJobInterview}
      setJobInterviewDetailOpen={setJobInterviewDetailOpen}
      setMoveStageCandidate={setMoveStageCandidate}
      setMoveStageModalOpen={setMoveStageModalOpen}
      setPickerCvModeById={setPickerCvModeById}
      setPickerResumeFileIdById={setPickerResumeFileIdById}
      setPickerResumePreview={setPickerResumePreview}
      setPickerScopeIds={setPickerScopeIds}
      setPickerSearch={setPickerSearch}
      setPickerSelectedIds={setPickerSelectedIds}
      setScheduleCandidatePickerOpen={setScheduleCandidatePickerOpen}
      setSchedulePickerSearch={setSchedulePickerSearch}
      setSchedulePickerSelectedIds={setSchedulePickerSelectedIds}
      setSelectedJobInterview={setSelectedJobInterview}
      setSubmitCandidatePickerOpen={setSubmitCandidatePickerOpen}
      setSubmitClientRowId={setSubmitClientRowId}
      submitCandidatePickerOpen={submitCandidatePickerOpen}
      submitToClientModal={submitToClientModal}
    />
    </>
  );
}

