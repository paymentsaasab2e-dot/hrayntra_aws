'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { usePageDrawerLifecycle } from '../../lib/pageDrawerEvents';
import {
  CandidateTable,
  type Candidate as JobDrawerTableCandidate,
} from '../../app/candidate/components/CandidateTable';
import {
  AddToPipelineModal,
  type CandidatePipelineJobOption,
  type CandidatePipelineRecruiterOption,
  type CandidateProfileDrawerData,
} from './CandidateProfileDrawer';
import { jobCandidateItemToMoveStageProfile } from '../../lib/candidateTableToProfileStub';
import { motion, AnimatePresence } from 'motion/react';
import { DetailsModalShell } from './DetailsModalShell';
import { DrawerTabBar } from './DrawerTabBar';
import { requestCornerAlert, requestConfirm, requestError, requestInfo } from '../../lib/appDialog';
import { ApiRequestError } from '../../lib/apiNetworkErrors';
import { isValidObjectId } from '../../lib/mapCandidateProfile';
import { RECYCLE_BIN_SYNC_EVENT } from '../../constants/recycleBin';
import { invalidateEmployerCandidatesCache } from '../../lib/employerPageCache';
import {
  isInterviewPipelineStage,
  isOfferPipelineStage,
} from '../../lib/candidateSubmitToClient';
import { orEmpty, startAsyncLoad } from '../../lib/asyncLoadGuard';
import { matchesQuickSearch, buildQuickSearchHaystack } from '../../lib/quickSearch';
import {
  X,
  Pencil,
  SquarePen,
  LayoutGrid,
  Users,
  GitBranch,
  Calendar,
  UserCheck,
  FileText,
  Activity,
  StickyNote,
  Paperclip,
  MapPin,
  Briefcase,
  Banknote,
  Send,
  Copy,
  ExternalLink,
  Link2,
  Share2,
  Archive,
  ChevronDown,
  ChevronRight,
  ListChecks,
  Award,
  GraduationCap,
  Heart,
  Eye,
  GripVertical,
  Plus,
  Trash2,
  Clock,
  BarChart2,
  Timer,
  TrendingUp,
  UserCog,
  Pin,
  Upload,
  Download,
  User,
  FileCheck,
  Sparkles,
  Loader2,
  ClipboardList,
  MessageSquare,
  Search,
  Building2,
} from 'lucide-react';
import {
  apiCreateMatch,
  apiGetInterviews,
  apiGetMatches,
  apiGetCandidate,
  apiGetJobApplyLink,
  resolveJobApplyUrlFromResponse,
  apiGetPlacements,
  apiToggleSavedMatch,
  apiGetJobStatusCatalog,
  apiAppendJobStatus,
  apiRemoveJobStatus,
  apiGetPipelineStages,
  apiMoveCandidateStage,
  apiParseCandidateResumeQueued,
  apiCreateCandidateFromDrawer,
  apiUploadCandidateResumeFile,
  apiAddCandidateToPipeline,
  apiDeleteCandidate,
  apiRemoveCandidateFromPipeline,
  filesApiGet,
  type BackendCandidate,
  type BackendInterviewListItem,
  type AddCandidatePayload,
  type ImportedProfileData,
} from '../../lib/api';
import {
  hasEditedCvAvailable,
  resolveDefaultCvShareMode,
  type CvShareMode,
} from '../../lib/cvEditorMapping';
import { resolveSaasaCvPreviewUrl } from '../../lib/saasaCvAnnotations';
import {
  DEFAULT_JOB_STATUS_OPTIONS,
  isProtectedJobStatus,
  jobStatusPillClass,
  mapJobStatusLabelToBackend,
  mergeJobStatusOptions,
  filterJobStatusOptionsForCurrent,
  isDraftJobStatus,
  canRevertJobToDraft,
} from '../../lib/jobStatus';
import { useDrawerPortalDropdownPosition } from './drawerFormUi';
import { createPortal } from 'react-dom';
import { toast } from 'sonner';
import { AssignCompanySelect } from '../assign/AssignCompanySelect';
import { getCurrentUserRequestIdentity } from '../../lib/api/teamApi';
import { getActiveOrgUnitId } from '../../lib/org/orgWorkspaceStorage';
import {
  formatAssigneeDisplayName,
  formatAssigneeOptionLabel,
  getStoredCurrentUserId,
} from '../../lib/assigneeDisplay';
import type { Placement } from '../../types/placement';
import {
  extractApplicationsJobCandidateItems,
  loadJobAppliedCandidates,
  mergeJobCandidateSeeds,
  parseJobCandidateScore,
  resolveJobCandidateDisplayStage,
  unwrapMatchRows,
} from '../../lib/jobAppliedMatches';
import { mapBackendMatch } from '../../lib/mapBackendMatch';
import MatchCandidateTable from '../matches/MatchCandidateTable';
import {
  AI_SCORE_TIERS,
  computeAiTierStats,
  displayMatchBand,
  type MatchCandidate,
} from '../matches/types';
import { ResumePreviewModal } from '../candidates/ResumePreviewModal';
import { ImageWithFallback } from '../ImageWithFallback';
import { NotesService } from '../NotesService';
import {
  apiGetContacts,
  apiGetJobActivities,
  apiGetJobClientRemarks,
  apiUpdateJob,
  apiResetJobPipelineToOrgTemplate,
  type BackendActivity,
  type BackendUser,
  type JobClientRemarkCandidate,
  type JobClientRemarksPayload,
  getCachedOrgRecruitmentMode,
  ORG_RECRUITMENT_CACHE_EVENT,
} from '../../lib/api';
import type { JobNoteTag } from './jobDetailsTypes';
import { formatDateDMY, formatDateTimeDMY, formatTime12hEnGb } from '../../utils/dateDisplay';
import {
  buildInterviewRoundNumberById,
  formatInterviewDateInTimezone,
  formatInterviewTimeInTimezone,
} from '../../lib/interview-schedule-helpers';
import { formatTimezoneDisplay, resolveIanaFromTimezoneValue } from '../../utils/inferTimezone';
import type { AuditMeta } from '../../types/audit';
import { EntityAuditSummary } from '../table/TableAuditCell';
import { DrawerEntityChatTab } from './DrawerEntityChatTab';
import { extractAuditMeta } from '../../utils/auditMeta';
import { formatJobSalaryDisplay } from '../../constants/jobSalary';
import { JobAssessmentsTabContent } from '../jobs/JobAssessmentsTabContent';
import { JobClientRemarksTab } from '../jobs/JobClientRemarksTab';
import { InterviewDetailHost } from '../interviews/InterviewDetailHost';
import { InterviewRoundTabs } from '../interviews/InterviewRoundTabs';
import { TableColumnsMenu } from '../table/TableColumnsMenu';
import {
  CANDIDATE_TABLE_COLUMNS,
  MATCH_TABLE_COLUMNS,
} from '../../lib/tableColumns/moduleTableColumns';
import PaginationAll from '../PaginationAll';
import { TABLE_PAGE_SIZE_OPTIONS, type TablePageSize } from '../../constants/tablePagination';
import {
  PH2_TABLE_BODY_SCROLL_CLASS,
  PH2_TABLE_CARD_CLASS,
  PH2_TABLE_CARD_FOOTER_CLASS,
} from '../layout/Ph2ModulePageLayout';
import { extractApiData } from '../../lib/mapCandidateProfile';
import { BULK_CV_ACCEPT_INPUT, BULK_CV_FORMAT_LABEL } from '../../lib/bulkCvFileTypes';
import { filterBulkCvFiles } from '../../lib/bulkCvCollect';
import { normalizeCandidateEmailInput } from '../../lib/candidateEmailValidation';
import {
  DrawerSectionCard,
  DRAWER_FORM_SCROLL_BG,
  DRAWER_LIST_SHELL,
  DRAWER_TABLE_ACTIONS,
  DRAWER_TABLE_BODY,
  DRAWER_TABLE_HEAD_ROW,
  DRAWER_TABLE_SCROLL,
  DRAWER_TABLE_SHELL,
  DRAWER_TABLE_TD,
  DRAWER_TABLE_TH,
  DRAWER_TABLE_TR,
} from './drawerFormUi';
import {
  formatJobSalaryRange,
  MAX_JOB_CV_FILE_BYTES,
  identityFromParsedCv,
  payloadFromParsedJobCv,
  currentUserAsBackendUser,
  withCurrentUserFirst,
  unwrapApiList,
  formatInterviewListStatus,
  interviewListStatusBadgeClass,
  formatInterviewTypeLabel,
  panelNamesFromInterview,
  formatPlacementStatusLabel,
  candidateNameFromInterview,
  candidateNameFromPlacement,
  DEFAULT_PIPELINE_STAGE_NAMES,
  DEFAULT_PIPELINE_STAGE_IDS,
  DEFAULT_PIPELINE_STAGE_ID_SET,
  PIPELINE_SYSTEM_ROLE_OPTIONS,
  getDefaultPipelineStageNameById,
  getDefaultPipelineStageName,
  normalizeStageLabel,
  canonicalStageLabel,
  buildPipelineStageMatchMeta,
  resolveCandidateStageId,
  normalizePipelineStages,
  normalizePickerResumeUrl,
  isPickerResumeFile,
  isRealResumeFileId,
  buildPickerResumeVersions,
  buildPickerCvMeta,
  mapJobCandidateToTableRow,
  matchCandidateToJobTableRow,
  STATUS_STYLES,
  statusStyleFor
} from './jobDetailsShared';
import type { JobDrawerModalsProps } from './jobDrawerTabProps';
import type {
  JobDrawerStatus,
  JobForDrawer,
  JobApplicationSubmission,
  JobPipelineStage,
  PipelineStageMatchMeta,
  JobCandidateItem,
  PickerResumeVersion,
  PickerCvMeta,
  JobDetailsDrawerProps
} from './jobDetailsShared';

export function JobDrawerModals(props: JobDrawerModalsProps) {
  const {
    confirmScheduleInterviewCandidatePicker,
    confirmSubmitCandidatePicker,
    displayJobCandidates,
    ensurePickerCvMeta,
    isOpen,
    job,
    jobInterviewDetailOpen,
    moveStageCandidate,
    moveStageModalOpen,
    onAddToPipeline,
    onClose,
    onCreatePlacement,
    onRemoveFromPipeline,
    onScheduleInterview,
    openFromJobDrawerRow,
    openPickerUpdatedCvEditor,
    pickerCandidates,
    pickerCvMetaById,
    pickerCvMetaLoading,
    pickerCvModeById,
    pickerResumeFileIdById,
    pickerResumePreview,
    pickerSaasaCv,
    pickerSaasaTarget,
    pickerScopeIds,
    pickerSearch,
    pickerSelectedIds,
    pipelineJobOptions,
    pipelineRecruiters,
    refreshAppliedJobCandidates,
    refreshJobInterviews,
    scheduleCandidatePickerOpen,
    schedulePickerCandidates,
    schedulePickerSearch,
    schedulePickerSelectedIds,
    selectedJobInterview,
    setJobInterviewDetailOpen,
    setMoveStageCandidate,
    setMoveStageModalOpen,
    setPickerCvModeById,
    setPickerResumeFileIdById,
    setPickerResumePreview,
    setPickerScopeIds,
    setPickerSearch,
    setPickerSelectedIds,
    setScheduleCandidatePickerOpen,
    setSchedulePickerSearch,
    setSchedulePickerSelectedIds,
    setSelectedJobInterview,
    setSubmitCandidatePickerOpen,
    setSubmitClientRowId,
    submitCandidatePickerOpen,
    submitToClientModal,
  } = props;

  return (
    <>
    <AddToPipelineModal
      isOpen={moveStageModalOpen}
      candidate={moveStageCandidate}
      jobs={pipelineJobOptions}
      recruiters={pipelineRecruiters}
      initialJobId={job?.id ?? null}
      lockJobToInitial
      onClose={() => {
        setMoveStageModalOpen(false);
        setMoveStageCandidate(null);
      }}
      onSubmit={
        onAddToPipeline
          ? async (payload: any) => {
              await onAddToPipeline(payload);
              await refreshAppliedJobCandidates({ runPipeline: false, refresh: true });
              setMoveStageModalOpen(false);
              setMoveStageCandidate(null);
            }
          : undefined
      }
      onRemoveFromPipeline={
        onRemoveFromPipeline
          ? async (payload: any) => {
              await onRemoveFromPipeline(payload);
              await refreshAppliedJobCandidates({ runPipeline: false, refresh: true });
              setMoveStageModalOpen(false);
              setMoveStageCandidate(null);
            }
          : undefined
      }
      onRequestSubmitToClient={
        job?.id
          ? ({ candidateId, jobId }: any) => {
              const source = displayJobCandidates.find((c: any) => c.id === candidateId);
              if (!source) return;
              // Keep Move stage open so Cancel on Submit to client returns here.
              setSubmitClientRowId(candidateId);
              openFromJobDrawerRow(source, jobId, job.title, job.clientId);
            }
          : undefined
      }
      onRequestScheduleInterview={
        onScheduleInterview
          ? ({ candidateId, jobId, stage, stageId }: any) => {
              // Keep Move stage open so Cancel on Schedule Interview returns here.
              onScheduleInterview(candidateId, jobId, {
                stageId: stageId || '',
                stageName: stage,
              });
            }
          : undefined
      }
      onRequestOfferPlacement={
        onCreatePlacement
          ? ({ candidateId, jobId, stage, stageId }: any) => {
              // Keep Move stage open so Cancel on Placement returns here.
              onCreatePlacement(candidateId, jobId, {
                stageId: stageId || '',
                stageName: stage,
              });
            }
          : undefined
      }
    />

    {scheduleCandidatePickerOpen ? (
      <DetailsModalShell
        size="md"
        zIndexClass="z-[120]"
        panelClassName="!h-auto max-h-[min(85vh,720px)]"
        onBackdropClick={() => setScheduleCandidatePickerOpen(false)}
        dialogTitleId="schedule-interview-candidate-picker-title"
      >
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="flex items-start justify-between gap-3 border-b border-violet-100 px-5 py-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-violet-600">
                Schedule Interview
              </p>
              <h2
                id="schedule-interview-candidate-picker-title"
                className="mt-1 text-lg font-bold text-slate-900"
              >
                Choose candidate
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                Select who is assigned to {job?.title || 'this job'}, then continue to schedule.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setScheduleCandidatePickerOpen(false)}
              className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>
          <div className="border-b border-slate-100 px-5 py-3">
            <div className="relative">
              <Search
                size={15}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="text"
                value={schedulePickerSearch}
                onChange={(event: any) => setSchedulePickerSearch(event.target.value)}
                placeholder="Search candidate name…"
                className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm text-slate-800 placeholder:text-slate-400 outline-none focus:border-violet-300 focus:bg-white focus:ring-2 focus:ring-violet-500/20"
              />
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
            {schedulePickerCandidates.length === 0 ? (
              <p className="px-2 py-8 text-center text-sm text-slate-500">
                No candidates assigned to this job match this search.
              </p>
            ) : (
              <ul className="space-y-1">
                {schedulePickerCandidates.map((row: any) => {
                  const checked = schedulePickerSelectedIds.includes(row.id);
                  return (
                    <li key={row.id}>
                      <label
                        className={`flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 transition ${
                          checked ? 'bg-violet-50 ring-1 ring-violet-200' : 'hover:bg-slate-50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() =>
                            setSchedulePickerSelectedIds((prev: any) =>
                              prev.includes(row.id)
                                ? prev.filter((id: any) => id !== row.id)
                                : [...prev, row.id],
                            )
                          }
                          className="h-4 w-4 rounded border-slate-300 text-violet-600 focus:ring-violet-500"
                        />
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-violet-100 text-xs font-bold text-violet-700">
                          {(row.candidateName || 'C')
                            .split(/\s+/)
                            .map((part: any) => part[0])
                            .filter(Boolean)
                            .slice(0, 2)
                            .join('')
                            .toUpperCase()}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-slate-900">
                            {row.candidateName || 'Unnamed candidate'}
                          </span>
                          <span className="mt-0.5 block truncate text-xs text-slate-500">
                            {[row.currentStage, row.email].filter(Boolean).join(' · ') ||
                              'Job candidate'}
                          </span>
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          <div className="flex items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/80 px-5 py-3">
            <p className="text-xs text-slate-500">
              {schedulePickerSelectedIds.length
                ? `${schedulePickerSelectedIds.length} selected`
                : 'Select one or more candidates'}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setScheduleCandidatePickerOpen(false)}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmScheduleInterviewCandidatePicker}
                disabled={!schedulePickerSelectedIds.length}
                className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Calendar size={16} />
                Continue
              </button>
            </div>
          </div>
        </div>
      </DetailsModalShell>
    ) : null}

    {submitCandidatePickerOpen ? (
      <DetailsModalShell
        size="md"
        zIndexClass="z-[120]"
        panelClassName="!h-auto max-h-[min(85vh,720px)]"
        onBackdropClick={() => {
          setSubmitCandidatePickerOpen(false);
          setPickerScopeIds(null);
        }}
        dialogTitleId="submit-candidate-picker-title"
      >
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="flex items-start justify-between gap-3 border-b border-indigo-100 px-5 py-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-indigo-600">
                Submit to Client
              </p>
              <h2 id="submit-candidate-picker-title" className="mt-1 text-lg font-bold text-slate-900">
                Choose candidate
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                {pickerScopeIds?.length
                  ? `Review CV choice for the ${pickerScopeIds.length} selected candidate${pickerScopeIds.length === 1 ? '' : 's'}, then continue.`
                  : `Select who to submit for ${job?.title || 'this job'}, then choose a CV version (v1, v2, …) or HRYantra CV for each.`}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setSubmitCandidatePickerOpen(false);
                setPickerScopeIds(null);
              }}
              className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>
          <div className="border-b border-slate-100 px-5 py-3">
            <div className="relative">
              <Search
                size={15}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="text"
                value={pickerSearch}
                onChange={(event: any) => setPickerSearch(event.target.value)}
                placeholder="Search candidate name…"
                className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm text-slate-800 placeholder:text-slate-400 outline-none focus:border-indigo-300 focus:bg-white focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>
            {pickerCvMetaLoading ? (
              <p className="mt-2 inline-flex items-center gap-1.5 text-[11px] text-slate-500">
                <Loader2 size={12} className="animate-spin" />
                Loading CV options…
              </p>
            ) : (
              <p className="mt-2 text-[11px] text-slate-500">
                Choose a resume version (<strong>v1 · original</strong>, <strong>v2</strong>, …) or{' '}
                <strong>HRYantra CV</strong>. Use View / Preview to open the file; Edit opens the
                HRYantra editor.
              </p>
            )}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
            {pickerCandidates.length === 0 ? (
              <p className="px-2 py-8 text-center text-sm text-slate-500">
                No candidates match this search.
              </p>
            ) : (
              <ul className="space-y-1">
                {pickerCandidates.map((row: any) => {
                  const checked = pickerSelectedIds.includes(row.id);
                  const meta = pickerCvMetaById[row.id];
                  const mode = pickerCvModeById[row.id];
                  const hasOriginal = meta?.hasOriginal;
                  const hasSaasa = meta?.hasSaasa;
                  const resumeVersions = meta?.resumeVersions || [];
                  const selectedResumeId =
                    pickerResumeFileIdById[row.id] ||
                    resumeVersions.find((v: any) => v.isPrimary)?.id ||
                    resumeVersions[0]?.id ||
                    '';
                  const selectedVersion =
                    resumeVersions.find((v: any) => v.id === selectedResumeId) ||
                    resumeVersions[0] ||
                    null;
                  return (
                    <li key={row.id}>
                      <div
                        className={`rounded-xl px-3 py-2.5 transition ${
                          checked ? 'bg-indigo-50 ring-1 ring-indigo-200' : 'hover:bg-slate-50'
                        }`}
                      >
                        <label className="flex cursor-pointer items-center gap-3">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() =>
                              setPickerSelectedIds((prev: any) => {
                                if (prev.includes(row.id)) {
                                  return prev.filter((id: any) => id !== row.id);
                                }
                                ensurePickerCvMeta(row.id);
                                return [...prev, row.id];
                              })
                          }
                          className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700">
                          {(row.candidateName || 'C')
                            .split(/\s+/)
                            .map((part: any) => part[0])
                            .filter(Boolean)
                            .slice(0, 2)
                            .join('')
                            .toUpperCase()}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-slate-900">
                            {row.candidateName || 'Unnamed candidate'}
                          </span>
                          <span className="mt-0.5 block truncate text-xs text-slate-500">
                              {[row.currentStage, row.email].filter(Boolean).join(' · ') ||
                                'Job candidate'}
                          </span>
                        </span>
                      </label>
                        {checked ? (
                          <div
                            className="mt-2 ml-7 flex flex-col gap-2"
                            onClick={(event: any) => event.stopPropagation()}
                          >
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="mr-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                                CV
                              </span>
                              {!meta ? (
                                <span className="inline-flex items-center gap-1.5 text-[11px] text-slate-500">
                                  <Loader2 size={12} className="animate-spin" />
                                  Loading CV options…
                                </span>
                              ) : null}
                              {resumeVersions.length > 0
                                ? resumeVersions.map((version: any, index: any) => {
                                    const active =
                                      mode === 'original' && version.id === selectedResumeId;
                                    const label =
                                      index === 0 ? `v${index + 1} · original` : `v${index + 1}`;
                                    return (
                                      <button
                                        key={version.id}
                                        type="button"
                                        title={version.fileName}
                                        onClick={() => {
                                          setPickerCvModeById((prev: any) => ({
                                            ...prev,
                                            [row.id]: 'original',
                                          }));
                                          setPickerResumeFileIdById((prev: any) => ({
                                            ...prev,
                                            [row.id]: version.id,
                                          }));
                                        }}
                                        className={`rounded-lg border px-2 py-1 text-[11px] font-semibold transition ${
                                          active
                                            ? 'border-indigo-500 bg-indigo-600 text-white'
                                            : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                                        }`}
                                      >
                                        {label}
                                      </button>
                                    );
                                  })
                                : null}
                              {!resumeVersions.length && hasOriginal ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setPickerCvModeById((prev: any) => ({
                                      ...prev,
                                      [row.id]: 'original',
                                    }))
                                  }
                                  className={`rounded-lg border px-2 py-1 text-[11px] font-semibold transition ${
                                    mode === 'original'
                                      ? 'border-indigo-500 bg-indigo-600 text-white'
                                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                                  }`}
                                >
                                  Original CV
                                </button>
                              ) : null}
                              {hasOriginal || hasSaasa ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (hasSaasa) {
                                      setPickerCvModeById((prev: any) => ({
                                        ...prev,
                                        [row.id]: 'saasa',
                                      }));
                                      return;
                                    }
                                    void openPickerUpdatedCvEditor(
                                      row.id,
                                      row.candidateName || 'Candidate',
                                    );
                                  }}
                                  className={`rounded-lg border px-2 py-1 text-[11px] font-semibold transition ${
                                    mode === 'saasa'
                                      ? 'border-amber-500 bg-amber-500 text-white'
                                      : 'border-amber-200 bg-amber-50 text-amber-900 hover:bg-amber-100'
                                  }`}
                                >
                                  {pickerSaasaCv.busy && pickerSaasaTarget?.id === row.id
                                    ? 'Saving…'
                                    : 'HRYantra CV'}
                                </button>
                              ) : null}
                              {meta && !hasOriginal && !hasSaasa ? (
                                <span className="text-[11px] text-rose-600">
                                  No CV on file — add a resume first
                                </span>
                              ) : null}
                            </div>
                            <div className="flex flex-wrap items-center gap-1.5">
                              {mode === 'original' && selectedVersion?.fileUrl ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setPickerResumePreview({
                                      url: selectedVersion.fileUrl,
                                      name: `${row.candidateName || 'Candidate'} — ${
                                        resumeVersions.findIndex((v: any) => v.id === selectedVersion.id) ===
                                        0
                                          ? 'v1 · original'
                                          : selectedVersion.fileName || 'Resume'
                                      }`,
                                    })
                                  }
                                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 transition hover:bg-slate-50"
                                >
                                  <Eye size={12} />
                                  View selected
                                </button>
                              ) : null}
                              {mode !== 'original' && hasOriginal && meta?.originalUrl ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setPickerResumePreview({
                                      url: meta.originalUrl!,
                                      name: `${row.candidateName || 'Candidate'} — Original CV`,
                                    })
                                  }
                                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 transition hover:bg-slate-50"
                                >
                                  <Eye size={12} />
                                  View original
                                </button>
                              ) : null}
                              {hasSaasa && meta?.saasaUrl ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setPickerResumePreview({
                                      url: meta.saasaUrl!,
                                      name: `${row.candidateName || 'Candidate'} — HRYantra CV`,
                                    })
                                  }
                                  className="inline-flex items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-900 transition hover:bg-amber-100"
                                >
                                  <Eye size={12} />
                                  Preview HRYantra
                                </button>
                              ) : null}
                              {hasOriginal ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    void openPickerUpdatedCvEditor(
                                      row.id,
                                      row.candidateName || 'Candidate',
                                    )
                                  }
                                  className="inline-flex items-center gap-1 rounded-lg border border-sky-200 bg-sky-50 px-2 py-1 text-[11px] font-semibold text-sky-900 transition hover:bg-sky-100"
                                >
                                  <SquarePen size={12} />
                                  Edit HRYantra
                                </button>
                              ) : null}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-5 py-4">
            <p className="text-xs font-medium text-slate-500">
              {pickerSelectedIds.length} selected
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setSubmitCandidatePickerOpen(false);
                  setPickerScopeIds(null);
                }}
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmSubmitCandidatePicker}
                disabled={pickerSelectedIds.length === 0}
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Send size={15} strokeWidth={2.25} />
                Continue
              </button>
            </div>
          </div>
        </div>
      </DetailsModalShell>
    ) : null}

    {submitToClientModal}
    {pickerSaasaCv.modals}
    <ResumePreviewModal
      isOpen={Boolean(pickerResumePreview?.url)}
      onClose={() => setPickerResumePreview(null)}
      resumeUrl={pickerResumePreview?.url || null}
      candidateName={pickerResumePreview?.name || 'Candidate'}
    />
    <InterviewDetailHost
      interviewItem={selectedJobInterview}
      isOpen={jobInterviewDetailOpen}
      onClose={() => {
        setJobInterviewDetailOpen(false);
        setSelectedJobInterview(null);
      }}
      onChanged={refreshJobInterviews}
      zIndexClass="z-[120]"
    />

    </>
  );
}
