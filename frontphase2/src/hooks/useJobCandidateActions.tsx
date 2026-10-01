// Candidate-action state + handlers extracted from JobDetailsDrawer.tsx
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { usePageDrawerLifecycle } from '../lib/pageDrawerEvents';
import { useDrawerUnsavedGuard } from './useDrawerUnsavedGuard';
import {
  CandidateTable,
  type Candidate as JobDrawerTableCandidate,
} from '../app/candidate/components/CandidateTable';
import {
  AddToPipelineModal,
  type CandidatePipelineJobOption,
  type CandidatePipelineRecruiterOption,
  type CandidateProfileDrawerData,
} from '../components/drawers/CandidateProfileDrawer';
import { jobCandidateItemToMoveStageProfile } from '../lib/candidateTableToProfileStub';
import { motion, AnimatePresence } from 'motion/react';
import { DetailsModalShell } from '../components/drawers/DetailsModalShell';
import { DrawerTabBar } from '../components/drawers/DrawerTabBar';
import { requestCornerAlert, requestConfirm, requestError, requestInfo } from '../lib/appDialog';
import { ApiRequestError } from '../lib/apiNetworkErrors';
import { isValidObjectId } from '../lib/mapCandidateProfile';
import { RECYCLE_BIN_SYNC_EVENT } from '../constants/recycleBin';
import { invalidateEmployerCandidatesCache } from '../lib/employerPageCache';
import {
  isInterviewPipelineStage,
  isOfferPipelineStage,
} from '../lib/candidateSubmitToClient';
import { orEmpty, startAsyncLoad } from '../lib/asyncLoadGuard';
import { matchesQuickSearch, buildQuickSearchHaystack } from '../lib/quickSearch';
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
} from '../lib/api';
import {
  hasEditedCvAvailable,
  resolveDefaultCvShareMode,
  type CvShareMode,
} from '../lib/cvEditorMapping';
import { resolveSaasaCvPreviewUrl } from '../lib/saasaCvAnnotations';
import {
  DEFAULT_JOB_STATUS_OPTIONS,
  isProtectedJobStatus,
  jobStatusPillClass,
  mapJobStatusLabelToBackend,
  mergeJobStatusOptions,
  filterJobStatusOptionsForCurrent,
  isDraftJobStatus,
  canRevertJobToDraft,
} from '../lib/jobStatus';
import { useDrawerPortalDropdownPosition } from '../components/drawers/drawerFormUi';
import { createPortal } from 'react-dom';
import { toast } from 'sonner';
import { useAssignableMembers } from './useAssignableMembers';
import { AssignCompanySelect } from '../components/assign/AssignCompanySelect';
import { getCurrentUserRequestIdentity } from '../lib/api/teamApi';
import { getActiveOrgUnitId } from '../lib/org/orgWorkspaceStorage';
import {
  formatAssigneeDisplayName,
  formatAssigneeOptionLabel,
  getStoredCurrentUserId,
} from '../lib/assigneeDisplay';
import type { Placement } from '../types/placement';
import {
  extractApplicationsJobCandidateItems,
  loadJobAppliedCandidates,
  mergeJobCandidateSeeds,
  parseJobCandidateScore,
  resolveJobCandidateDisplayStage,
  unwrapMatchRows,
} from '../lib/jobAppliedMatches';
import { mapBackendMatch } from '../lib/mapBackendMatch';
import MatchCandidateTable from '../components/matches/MatchCandidateTable';
import {
  AI_SCORE_TIERS,
  computeAiTierStats,
  displayMatchBand,
  type MatchCandidate,
} from '../components/matches/types';
import { useSubmitToClientModal } from './useSubmitToClientModal';
import { useSaasaCvAnnotations } from './useSaasaCvAnnotations';
import { ResumePreviewModal } from '../components/candidates/ResumePreviewModal';
import { ImageWithFallback } from '../components/ImageWithFallback';
import { NotesService } from '../components/NotesService';
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
} from '../lib/api';
import { useJobCandidatesTab } from './useJobCandidatesTab';
import type { JobNoteTag } from '../components/drawers/jobDetailsTypes';
import { formatDateDMY, formatDateTimeDMY, formatTime12hEnGb } from '../utils/dateDisplay';
import {
  buildInterviewRoundNumberById,
  formatInterviewDateInTimezone,
  formatInterviewTimeInTimezone,
} from '../lib/interview-schedule-helpers';
import { formatTimezoneDisplay, resolveIanaFromTimezoneValue } from '../utils/inferTimezone';
import type { AuditMeta } from '../types/audit';
import { EntityAuditSummary } from '../components/table/TableAuditCell';
import { DrawerEntityChatTab } from '../components/drawers/DrawerEntityChatTab';
import { extractAuditMeta } from '../utils/auditMeta';
import { formatJobSalaryDisplay } from '../constants/jobSalary';
import { JobAssessmentsTabContent } from '../components/jobs/JobAssessmentsTabContent';
import { JobClientRemarksTab } from '../components/jobs/JobClientRemarksTab';
import { InterviewDetailHost } from '../components/interviews/InterviewDetailHost';
import { InterviewRoundTabs } from '../components/interviews/InterviewRoundTabs';
import { TableColumnsMenu } from '../components/table/TableColumnsMenu';
import { usePersistedColumnVisibility } from './usePersistedColumnVisibility';
import {
  CANDIDATE_TABLE_COLUMNS,
  MATCH_TABLE_COLUMNS,
} from '../lib/tableColumns/moduleTableColumns';
import PaginationAll from '../components/PaginationAll';
import { TABLE_PAGE_SIZE_OPTIONS, type TablePageSize } from '../constants/tablePagination';
import {
  PH2_TABLE_BODY_SCROLL_CLASS,
  PH2_TABLE_CARD_CLASS,
  PH2_TABLE_CARD_FOOTER_CLASS,
} from '../components/layout/Ph2ModulePageLayout';
import { extractApiData } from '../lib/mapCandidateProfile';
import { BULK_CV_ACCEPT_INPUT, BULK_CV_FORMAT_LABEL } from '../lib/bulkCvFileTypes';
import { filterBulkCvFiles } from '../lib/bulkCvCollect';
import { normalizeCandidateEmailInput } from '../lib/candidateEmailValidation';
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
} from '../components/drawers/drawerFormUi';
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
} from '../components/drawers/jobDetailsShared';
import type { UseJobCandidateActionsParams } from '../components/drawers/jobDrawerTabProps';
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
} from '../components/drawers/jobDetailsShared';

export function useJobCandidateActions({
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
}: UseJobCandidateActionsParams) {
const candidateColumnVisibility = usePersistedColumnVisibility(
  'candidates.visibleColumns',
  CANDIDATE_TABLE_COLUMNS,
);
const matchColumnVisibility = usePersistedColumnVisibility(
  'matches.visibleColumns',
  MATCH_TABLE_COLUMNS,
);
const [submitClientRowId, setSubmitClientRowId] = useState<string | null>(null);
const [submitCandidatePickerOpen, setSubmitCandidatePickerOpen] = useState(false);
const [scheduleCandidatePickerOpen, setScheduleCandidatePickerOpen] = useState(false);
const [schedulePickerSelectedIds, setSchedulePickerSelectedIds] = useState<string[]>([]);
const [schedulePickerSearch, setSchedulePickerSearch] = useState('');
const [pickerSelectedIds, setPickerSelectedIds] = useState<string[]>([]);
const [pickerSearch, setPickerSearch] = useState('');
/** When set, picker only lists these candidates (table selection). Null = show all job candidates. */
const [pickerScopeIds, setPickerScopeIds] = useState<string[] | null>(null);
const [pickerCvModeById, setPickerCvModeById] = useState<Record<string, CvShareMode>>({});
const [pickerResumeFileIdById, setPickerResumeFileIdById] = useState<Record<string, string>>({});
const [pickerCvMetaById, setPickerCvMetaById] = useState<Record<string, PickerCvMeta>>({});
const [pickerCvMetaLoading, setPickerCvMetaLoading] = useState(false);
const pickerCvMetaByIdRef = useRef<Record<string, PickerCvMeta>>({});
const pickerCvMetaInFlightRef = useRef<Set<string>>(new Set());
pickerCvMetaByIdRef.current = pickerCvMetaById;
const [pickerSaasaTarget, setPickerSaasaTarget] = useState<{
  id: string;
  name: string;
  resumeUrl: string | null;
  extraData: Record<string, unknown> | null;
} | null>(null);
const [pickerSaasaOpenToken, setPickerSaasaOpenToken] = useState(0);
const [pickerResumePreview, setPickerResumePreview] = useState<{
  url: string;
  name: string;
} | null>(null);
const {
  openFromJobDrawerRow,
  openSubmit,
  openBulkSubmit,
  submitModalElement: submitToClientModal,
} = useSubmitToClientModal({
  onClosed: () => setSubmitClientRowId(null),
});

const candidatesTab = useJobCandidatesTab({
  isOpen,
  job,
  jobCandidates,
  pipelineStages,
  activeTab,
  onAddToPipeline,
  onScheduleInterview,
  onCreatePlacement,
  onJobCandidatesChange,
  onViewCandidateProfile,
  openSubmit,
  setSubmitClientRowId,
  mapJobCandidateToTableRow,
  matchCandidateToJobTableRow,
});
const {
  displayJobCandidates,
  selectedCandidateIds,
  setDisplayJobCandidates,
  setSelectedCandidateIds,
  setShowMatchScores,
  setAppliedCandidatesLoading,
  setAppliedPipelineRunning,
  inlineStageOptionsByJobId,
  setInlineStageOptionsByJobId,
  setInlineStageOptionsLoadingJobId,
  setInlineStageUpdatingCandidateId,
  deletingCandidateId,
  setDeletingCandidateId,
  removingFromJobCandidateId,
  setRemovingFromJobCandidateId,
  setUploadingJobCv,
  setJobCvUploadProgress,
  fileInputRef,
  aiMatchCandidates,
  setAiMatchCandidates,
  setAiMatchesLoading,
  setAiPipelineRunning,
  setAiMatchesError,
  setAiMatchSelectedIds,
  setAiSavedMatches,
  setAiExpandedAnalysis,
  candidateMatchMode,
  setCandidateMatchMode,
  jobCandidatesSearch,
  setJobCandidatesSearch,
  candidatesStageFilterId,
  setCandidatesStageFilterId,
} = candidatesTab;
const candidatesTabProps = candidatesTab;

const applyPickerCvMeta = useCallback((
  candidateId: string,
  candidate: BackendCandidate | null,
  files: Array<{
    id: string;
    fileUrl?: string | null;
    fileType?: string;
    fileName?: string;
    uploadDate?: string;
    createdAt?: string;
  }> = [],
) => {
  const meta = buildPickerCvMeta(candidate, files);
  setPickerCvMetaById((prev) => ({ ...prev, [candidateId]: meta }));
  const defaultVersion =
    meta.resumeVersions.find((row) => row.isPrimary) || meta.resumeVersions[0] || null;
  if (defaultVersion?.id) {
    setPickerResumeFileIdById((prev) => ({ ...prev, [candidateId]: defaultVersion.id }));
  }
  const mode = resolveDefaultCvShareMode(candidate, meta.hasOriginal, meta.hasSaasa);
  if (mode === 'original' || mode === 'saasa') {
    setPickerCvModeById((prev) => ({ ...prev, [candidateId]: mode }));
  } else if (meta.hasOriginal) {
    setPickerCvModeById((prev) => ({ ...prev, [candidateId]: 'original' }));
  } else if (meta.hasSaasa) {
    setPickerCvModeById((prev) => ({ ...prev, [candidateId]: 'saasa' }));
  }
  return meta;
}, []);

const refreshPickerCvMetaForCandidate = useCallback(async (candidateId: string) => {
  try {
    const [candidateRaw, filesRaw] = await Promise.all([
      apiGetCandidate(candidateId),
      filesApiGet('candidate', candidateId).catch(() => null),
    ]);
    const candidate = extractApiData<BackendCandidate>(candidateRaw);
    const files = extractApiData(filesRaw) ?? [];
    applyPickerCvMeta(
      candidateId,
      candidate,
      files.map((f) => ({
        id: f.id,
        fileUrl: f.fileUrl,
        fileType: f.fileType,
        fileName: f.fileName,
        uploadDate: f.uploadDate,
        createdAt: (f as { createdAt?: string }).createdAt,
      })),
    );
  } catch {
    /* keep prior meta */
  }
}, [applyPickerCvMeta]);

/** Fetch CV options and paint as each finishes (don't wait for the whole list). */
const loadPickerCvMetaForIds = useCallback(
  async (ids: string[], options?: { force?: boolean }) => {
    const uniqueIds = Array.from(new Set(ids.map((id) => String(id || '').trim()).filter(Boolean)));
    const toFetch = uniqueIds.filter((id) => {
      if (!options?.force && pickerCvMetaByIdRef.current[id]) return false;
      if (pickerCvMetaInFlightRef.current.has(id)) return false;
      return true;
    });
    if (!toFetch.length) {
      setPickerCvMetaLoading(false);
      return;
    }

    setPickerCvMetaLoading(true);
    toFetch.forEach((id) => pickerCvMetaInFlightRef.current.add(id));
    let pending = toFetch.length;

    await Promise.all(
      toFetch.map(async (id) => {
        try {
          const [candidateRaw, filesRaw] = await Promise.all([
            apiGetCandidate(id),
            filesApiGet('candidate', id).catch(() => null),
          ]);
          const candidate = extractApiData<BackendCandidate>(candidateRaw);
          const files = extractApiData(filesRaw) ?? [];
          applyPickerCvMeta(
            id,
            candidate,
            files.map((f) => ({
              id: f.id,
              fileUrl: f.fileUrl,
              fileType: f.fileType,
              fileName: f.fileName,
              uploadDate: f.uploadDate,
              createdAt: (f as { createdAt?: string }).createdAt,
            })),
          );
        } catch {
          setPickerCvMetaById((prev) => ({
            ...prev,
            [id]: {
              hasOriginal: false,
              hasSaasa: false,
              hasEdited: false,
              originalUrl: null,
              saasaUrl: null,
              resumeVersions: [],
            },
          }));
        } finally {
          pickerCvMetaInFlightRef.current.delete(id);
          pending -= 1;
          if (pending <= 0) setPickerCvMetaLoading(false);
        }
      }),
    );
    setPickerCvMetaLoading(false);
  },
  [applyPickerCvMeta],
);

const ensurePickerCvMeta = useCallback(
  (candidateId: string) => {
    const id = String(candidateId || '').trim();
    if (!id) return;
    void loadPickerCvMetaForIds([id]);
  },
  [loadPickerCvMetaForIds],
);

const pickerSaasaCv = useSaasaCvAnnotations({
  candidateId: pickerSaasaTarget?.id || null,
  candidateName: pickerSaasaTarget?.name || 'Candidate',
  resumeUrl: pickerSaasaTarget?.resumeUrl || null,
  extraData: pickerSaasaTarget?.extraData || null,
  enabled: Boolean(pickerSaasaTarget?.id),
  canEdit: true,
  onToast: (message) => {
    if (message) toast.error(message);
  },
  onCandidateUpdated: async () => {
    const id = pickerSaasaTarget?.id;
    if (!id) return;
    await refreshPickerCvMetaForCandidate(id);
    setPickerCvModeById((prev) => ({ ...prev, [id]: 'saasa' }));
  },
  onViewModeChange: (mode) => {
    const id = pickerSaasaTarget?.id;
    if (!id || mode !== 'saasa') return;
    setPickerCvModeById((prev) => ({ ...prev, [id]: 'saasa' }));
    void refreshPickerCvMetaForCandidate(id);
  },
});

useEffect(() => {
  if (!pickerSaasaTarget?.id || !pickerSaasaOpenToken) return;
  const timer = window.setTimeout(() => {
    pickerSaasaCv.openModal();
  }, 200);
  return () => window.clearTimeout(timer);
  // Only re-open when the user explicitly requests the editor for a candidate.
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [pickerSaasaTarget?.id, pickerSaasaOpenToken]);

const openPickerUpdatedCvEditor = useCallback(
  async (candidateId: string, candidateName: string) => {
    try {
      const candidate = extractApiData<BackendCandidate>(await apiGetCandidate(candidateId));
      const resumeUrl = String(candidate?.resumeUrl || candidate?.resume || '').trim();
      if (!resumeUrl) {
        toast.error('No original resume on file — upload a CV before editing Updated / HRYantra CV.');
        return;
      }
      const extraData =
        candidate?.extraData &&
        typeof candidate.extraData === 'object' &&
        !Array.isArray(candidate.extraData)
          ? (candidate.extraData as Record<string, unknown>)
          : null;
      setPickerSaasaTarget({
        id: candidateId,
        name: candidateName || 'Candidate',
        resumeUrl,
        extraData,
      });
      setPickerSaasaOpenToken((n) => n + 1);
      // Ensure the row stays selected while editing.
      setPickerSelectedIds((prev) => (prev.includes(candidateId) ? prev : [...prev, candidateId]));
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Could not open HRYantra CV editor');
    }
  },
  [],
);

const [moveStageModalOpen, setMoveStageModalOpen] = useState(false);
const [moveStageCandidate, setMoveStageCandidate] = useState<CandidateProfileDrawerData | null>(null);
useEffect(() => {
  setSubmitClientRowId(null);
  setSubmitCandidatePickerOpen(false);
  setPickerSelectedIds([]);
  setPickerScopeIds(null);
  setPickerSearch('');
  setPickerCvModeById({});
  setPickerCvMetaById({});
  setPickerCvMetaLoading(false);
  setPickerSaasaTarget(null);
  setPickerSaasaOpenToken(0);
  setPickerResumePreview(null);
}, [job?.id, isOpen]);

useEffect(() => {
  setInlineStageOptionsByJobId({});
  setInlineStageOptionsLoadingJobId(null);
  setInlineStageUpdatingCandidateId(null);
}, [job?.id, isOpen]);



const pipelineJobOptions = useMemo((): CandidatePipelineJobOption[] => {
  if (!job?.id) return [];
  return [
    {
      id: job.id,
      title: job.title,
      department: job.department || job.clientName || null,
      clientId: job.clientId ?? null,
      clientName: job.clientName ?? null,
    },
  ];
}, [job?.clientId, job?.clientName, job?.department, job?.id, job?.title]);

const openMoveStageFromTable = useCallback(
  (row: JobDrawerTableCandidate) => {
    if (!job?.id || !onAddToPipeline) return;
    const source = displayJobCandidates.find((c) => c.id === row.id);
    if (!source) return;
    setMoveStageCandidate(
      jobCandidateItemToMoveStageProfile(source, {
        id: job.id,
        title: job.title,
        department: job.department,
        clientId: job.clientId,
        clientName: job.clientName,
      }),
    );
    setMoveStageModalOpen(true);
  },
  [displayJobCandidates, job, onAddToPipeline],
);

const pickerCandidates = useMemo(() => {
  const query = pickerSearch.trim().toLowerCase();
  let list = Array.isArray(displayJobCandidates) ? displayJobCandidates.filter((row) => row?.id) : [];
  if (pickerScopeIds?.length) {
    const scope = new Set(pickerScopeIds);
    list = list.filter((row) => scope.has(row.id));
  }
  if (!query) return list;
  return list.filter((row) =>
    matchesQuickSearch(
      buildQuickSearchHaystack(row.candidateName, row.email, row.currentStage),
      query,
    ),
  );
}, [displayJobCandidates, pickerScopeIds, pickerSearch]);

const openSubmitCandidatePicker = useCallback(() => {
  if (!job?.id) return;
  const list = Array.isArray(displayJobCandidates) ? displayJobCandidates.filter((row) => row?.id) : [];
  if (!list.length) {
    setActiveTab('candidates');
    void requestError('Add a candidate to this job before submitting to the client.');
    return;
  }
  const preselected = selectedCandidateIds.filter((id) => list.some((row) => row.id === id));
  // Table selection → only show those candidates. Header submit (none selected) → show all.
  if (preselected.length) {
    setPickerScopeIds(preselected);
    setPickerSelectedIds(preselected);
  } else {
    setPickerScopeIds(null);
    setPickerSelectedIds(list.length === 1 ? [list[0].id] : []);
  }
  setPickerSearch('');
  setPickerCvModeById({});
  setPickerResumeFileIdById({});
  setPickerCvMetaById({});
  pickerCvMetaByIdRef.current = {};
  pickerCvMetaInFlightRef.current.clear();
  setSubmitCandidatePickerOpen(true);

  const priorityIds = preselected.length
    ? preselected
    : list.length === 1
      ? [list[0].id]
      : list.slice(0, 3).map((row) => row.id);
  void loadPickerCvMetaForIds(priorityIds);
}, [displayJobCandidates, job?.id, loadPickerCvMetaForIds, selectedCandidateIds]);

const confirmSubmitCandidatePicker = useCallback(() => {
  if (!job?.id) return;
  const rows = (Array.isArray(displayJobCandidates) ? displayJobCandidates : []).filter((row) =>
    pickerSelectedIds.includes(row.id),
  );
  if (!rows.length) {
    void requestError('Choose at least one candidate to submit to the client.');
    return;
  }
  const missingMode = rows.find((row) => !pickerCvModeById[row.id]);
  if (missingMode) {
    void requestError(
      `Choose which CV to send for ${missingMode.candidateName || 'each selected candidate'} — a resume version (v1, v2, …) or HRYantra CV.`,
    );
    return;
  }
  setSubmitCandidatePickerOpen(false);
  openBulkSubmit(
    Array.from(
      new Map(
        rows.map((row) => {
          const mode = pickerCvModeById[row.id];
          const resumeFileId =
            mode === 'original' ? pickerResumeFileIdById[row.id] : undefined;
          return [
            row.id,
            {
      candidateId: row.id,
      jobId: job.id,
      candidateName: row.candidateName,
      jobTitle: job.title,
      clientId: job.clientId ?? undefined,
      matchScore: parseJobCandidateScore(row.score),
              cvShareMode: mode,
              resumeFileId:
                resumeFileId && isRealResumeFileId(resumeFileId) ? resumeFileId : undefined,
            },
          ];
        }),
      ).values(),
    ),
  );
  setSelectedCandidateIds([]);
  setPickerSelectedIds([]);
  setPickerScopeIds(null);
  setPickerCvModeById({});
  setPickerResumeFileIdById({});
  setPickerCvMetaById({});
}, [
  displayJobCandidates,
  job,
  openBulkSubmit,
  pickerCvModeById,
  pickerResumeFileIdById,
  pickerSelectedIds,
]);

const openBulkSubmitToClient = useCallback(() => {
  // Same flow as the header button: CV picker (Original vs HRYantra) then submit.
  openSubmitCandidatePicker();
}, [openSubmitCandidatePicker]);

const openBulkScheduleInterview = useCallback(() => {
  const jobId = String(job?.id || '').trim();
  if (!jobId) {
    toast.error('No job selected.');
    return;
  }
  if (!onScheduleInterview) {
    toast.error('Schedule Interview is not available');
    return;
  }
  const ids = selectedCandidateIds.filter(Boolean);
  if (!ids.length) {
    toast.error('Select at least one candidate to schedule an interview.');
    return;
  }
  onScheduleInterview(ids[0]!, jobId, undefined, ids.length > 1 ? ids : undefined);
}, [job?.id, onScheduleInterview, selectedCandidateIds]);

const schedulePickerCandidates = useMemo(() => {
  const query = schedulePickerSearch.trim().toLowerCase();
  const list = Array.isArray(displayJobCandidates) ? displayJobCandidates.filter((row) => row?.id) : [];
  if (!query) return list;
  return list.filter((row) =>
    matchesQuickSearch(
      buildQuickSearchHaystack(row.candidateName, row.email, row.currentStage),
      query,
    ),
  );
}, [displayJobCandidates, schedulePickerSearch]);

/** When rows are checked, only the selection-bar Submit shows — avoids two CTAs. */
const showHeaderSubmitToClient =
  Boolean(job?.id) && selectedCandidateIds.length === 0;

const stageOptionsFromJobPipeline = useMemo(() => {
  if (!job?.id) return {} as Record<string, Array<{ id: string; name: string }>>;
  // Only keep real DB stage ids — fake defaults (`default-*-stage` / `s-*`) break POST /pipeline/.../move.
  const mapped = (Array.isArray(pipelineStages) ? pipelineStages : [])
    .map((stage) => ({
      id: String(stage?.id || '').trim(),
      name: String(stage?.name || '').trim(),
    }))
    .filter((stage) => stage.id && stage.name && isValidObjectId(stage.id));
  return mapped.length ? { [job.id]: mapped } : {};
}, [job?.id, pipelineStages]);

const inlineStageOptionsMerged = useMemo(
  () => ({
    ...stageOptionsFromJobPipeline,
    ...inlineStageOptionsByJobId,
  }),
  [inlineStageOptionsByJobId, stageOptionsFromJobPipeline],
);

const loadInlineStageOptionsForCandidate = useCallback(
  async (candidate: JobDrawerTableCandidate) => {
    const jobId = candidate.pipelineJobId || job?.id;
    if (!jobId) return;
    const existing = inlineStageOptionsByJobId[jobId];
    const hasRealIds =
      Array.isArray(existing) &&
      existing.length > 0 &&
      existing.every((stage) => isValidObjectId(String(stage.id || '')));
    if (hasRealIds) return;

    try {
      setInlineStageOptionsLoadingJobId(jobId);
      const response = await apiGetPipelineStages(jobId);
      const payload = response.data;
      const stages = Array.isArray(payload)
        ? payload
        : Array.isArray((payload as { data?: unknown })?.data)
          ? (payload as { data: unknown[] }).data
          : [];

      const mappedStages = (stages as { id?: string; name?: string }[])
        .map((stage) => ({
          id: String(stage.id || ''),
          name: String(stage.name || '').trim(),
        }))
        .filter((stage) => stage.id && stage.name && isValidObjectId(stage.id));

      if (mappedStages.length) {
        setInlineStageOptionsByJobId((prev) => ({ ...prev, [jobId]: mappedStages }));
      }
    } catch (stageError: unknown) {
      const message =
        stageError instanceof Error ? stageError.message : 'Failed to load stages';
      console.error('Failed to load pipeline stages for job candidate row:', stageError);
      toast.error(message);
    } finally {
      setInlineStageOptionsLoadingJobId((prev) => (prev === jobId ? null : prev));
    }
  },
  [inlineStageOptionsByJobId, job?.id],
);

const recruiterFallbackForJob = useMemo(
  () => (job as { assignedTo?: { name?: string }; recruiter?: string })?.assignedTo?.name || job?.recruiter || 'Unassigned',
  [job],
);

const refreshAppliedJobCandidates = useCallback(
  async (opts?: { runPipeline?: boolean; refresh?: boolean; silent?: boolean; seedOverride?: JobCandidateItem[] }) => {
    if (!job?.id) {
      setDisplayJobCandidates([]);
      return [] as JobCandidateItem[];
    }
    const loadingPipeline = Boolean(opts?.runPipeline);
    const isSilent = Boolean(opts?.silent) || (displayJobCandidates && displayJobCandidates.length > 0);
    if (loadingPipeline) {
      setAppliedPipelineRunning(true);
    } else if (!isSilent) {
      setAppliedCandidatesLoading(true);
    }
    try {
      const activeSeed = opts?.seedOverride || displayJobCandidates || jobCandidates;
      const merged = await loadJobAppliedCandidates(job.id, {
        runPipeline: opts?.runPipeline,
        refresh: opts?.refresh,
        silent: isSilent,
        pipelineSeed: activeSeed,
        fallbackRecruiter: recruiterFallbackForJob,
      });
      setDisplayJobCandidates(merged);
      setShowMatchScores(merged.some((row) => parseJobCandidateScore(row.score) > 0));
      onJobCandidatesChange?.(merged);
      return merged;
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Unable to load applied candidates for this job';
      void requestError(message);
      return [] as JobCandidateItem[];
    } finally {
      if (loadingPipeline) {
        setAppliedPipelineRunning(false);
      } else {
        setAppliedCandidatesLoading(false);
      }
    }
  },
  [job?.id, displayJobCandidates, jobCandidates, onJobCandidatesChange, recruiterFallbackForJob],
);

const openScheduleInterviewCandidatePicker = useCallback(async () => {
  const jobId = String(job?.id || '').trim();
  if (!jobId) {
    toast.error('No job selected.');
    return;
  }
  if (!onScheduleInterview) {
    toast.error('Schedule Interview is not available');
    return;
  }

  let list = Array.isArray(displayJobCandidates) ? displayJobCandidates.filter((row) => row?.id) : [];
  if (!list.length) {
    const merged = await refreshAppliedJobCandidates({ runPipeline: false, refresh: false, silent: true });
    list = Array.isArray(merged) ? merged.filter((row) => row?.id) : [];
  }
  if (!list.length) {
    setActiveTab('candidates');
    void requestError('Add or assign a candidate to this job before scheduling an interview.');
    return;
  }

  setSchedulePickerSearch('');
  setSchedulePickerSelectedIds(list.length === 1 ? [list[0]!.id] : []);
  setScheduleCandidatePickerOpen(true);
}, [displayJobCandidates, job?.id, onScheduleInterview, refreshAppliedJobCandidates]);

const confirmScheduleInterviewCandidatePicker = useCallback(() => {
  const jobId = String(job?.id || '').trim();
  if (!jobId || !onScheduleInterview) return;
  const ids = schedulePickerSelectedIds.filter(Boolean);
  if (!ids.length) {
    toast.error('Select at least one candidate to schedule an interview.');
    return;
  }
  setScheduleCandidatePickerOpen(false);
  onScheduleInterview(ids[0]!, jobId, undefined, ids.length > 1 ? ids : undefined);
}, [job?.id, onScheduleInterview, schedulePickerSelectedIds]);

const handleJobCvFileSelected = useCallback(
  async (fileList: FileList | File[] | null | undefined) => {
    if (!job?.id) return;
    const rawFiles = Array.from(fileList || []);
    if (!rawFiles.length) return;

    const files = filterBulkCvFiles(rawFiles);
    if (!files.length) {
      const message = `Select CV files (${BULK_CV_FORMAT_LABEL}).`;
      toast.error(message);
      void requestError(message);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    const oversized = files.filter((file) => file.size > MAX_JOB_CV_FILE_BYTES);
    const validFiles = files.filter((file) => file.size <= MAX_JOB_CV_FILE_BYTES);
    if (oversized.length) {
      toast.error(
        oversized.length === 1
          ? `${oversized[0].name} is larger than 25MB and was skipped.`
          : `${oversized.length} files larger than 25MB were skipped.`,
      );
    }
    if (!validFiles.length) {
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    let recruiterId = '';
    try {
      const raw = localStorage.getItem('currentUser');
      if (raw) {
        const user = JSON.parse(raw) as { id?: string; _id?: string };
        recruiterId = String(user.id || user._id || '').trim();
      }
    } catch {
      recruiterId = '';
    }

    setUploadingJobCv(true);
    setJobCvUploadProgress({ done: 0, total: validFiles.length });

    let createdCount = 0;
    let linkedCount = 0;
    let failedCount = 0;
    const failedNames: string[] = [];

    const processOne = async (file: File) => {
      const parsedRes = await apiParseCandidateResumeQueued(file);
      const parsed = parsedRes.data || {};

      const attachResume = async (candidateId: string) => {
        const resumeAlreadyRemote = /^https?:\/\//i.test(String(parsed.resumeUrl || '').trim());
        if (!candidateId || resumeAlreadyRemote) return;
        try {
          await apiUploadCandidateResumeFile(candidateId, file);
        } catch (uploadError) {
          console.error('Resume upload failed after candidate creation:', uploadError);
        }
      };

      const addExistingToJob = async (candidateId: string) => {
        const pipelinePayload = {
          candidateId,
          jobId: job.id,
          stage: 'Applied',
          recruiterId: recruiterId || undefined,
          priority: 'Medium' as const,
        };
        if (onAddToPipeline) {
          await onAddToPipeline(pipelinePayload);
        } else {
          await apiAddCandidateToPipeline(candidateId, {
            jobId: job.id,
            stage: 'Applied',
            recruiterId: recruiterId || undefined,
            priority: 'Medium',
          });
        }
        await attachResume(candidateId);
      };

      const payload = payloadFromParsedJobCv(parsed, file, job.id, recruiterId || undefined);
      try {
        const createdRes = await apiCreateCandidateFromDrawer(payload);
        const created = createdRes.data || {};
        const candidateId = String(created.id || (created as { _id?: string })._id || '').trim();
        await attachResume(candidateId);
        createdCount += 1;
      } catch (createError) {
        if (createError instanceof ApiRequestError && createError.status === 409) {
          const dupData = (createError.data || {}) as {
            existingCandidate?: { _id?: string; id?: string; name?: string };
          };
          const existing = dupData.existingCandidate;
          const existingId = String(existing?._id || existing?.id || '').trim();
          if (existingId) {
            await addExistingToJob(existingId);
            linkedCount += 1;
            return;
          }
        }
        throw createError;
      }
    };

    try {
      for (let index = 0; index < validFiles.length; index += 1) {
        const file = validFiles[index];
        try {
          await processOne(file);
        } catch (error) {
          failedCount += 1;
          failedNames.push(file.name);
          console.error(`Job CV upload failed for ${file.name}:`, error);
        } finally {
          setJobCvUploadProgress({ done: index + 1, total: validFiles.length });
        }
      }

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('jobportal:candidates-changed'));
      }
      await refreshAppliedJobCandidates({ runPipeline: false, refresh: false, silent: true });

      const successTotal = createdCount + linkedCount;
      if (successTotal > 0 && failedCount === 0) {
        const message =
          validFiles.length === 1
            ? createdCount
              ? 'Candidate created successfully'
              : 'Existing candidate linked to this job'
            : `${createdCount} candidate${createdCount === 1 ? '' : 's'} created${
                linkedCount ? `, ${linkedCount} existing linked` : ''
              }`;
        toast.success(message);
        void requestCornerAlert(message, { tone: 'success', priority: 'high' });
      } else if (successTotal > 0 && failedCount > 0) {
        const message = `${successTotal} succeeded, ${failedCount} failed.`;
        toast.success(message);
        void requestCornerAlert(message, { tone: 'success', priority: 'high' });
        toast.error(
          failedNames.length <= 3
            ? `Failed: ${failedNames.join(', ')}`
            : `${failedCount} CVs could not be processed.`,
        );
      } else {
        const message =
          failedNames.length === 1
            ? `Could not create a candidate from ${failedNames[0]}.`
            : 'Could not create candidates from the selected CVs.';
        toast.error(message);
        void requestError(message);
      }
    } finally {
      setUploadingJobCv(false);
      setJobCvUploadProgress(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  },
  [job?.id, onAddToPipeline, refreshAppliedJobCandidates],
);

useEffect(() => {
  if (!isOpen || !job?.id) return;
  const onCandidatesChanged = () => {
    void refreshAppliedJobCandidates();
  };
  window.addEventListener('jobportal:candidates-changed', onCandidatesChanged);
  return () => window.removeEventListener('jobportal:candidates-changed', onCandidatesChanged);
}, [isOpen, job?.id, refreshAppliedJobCandidates]);

const handleInlineCandidateStageChange = useCallback(
  async (candidate: JobDrawerTableCandidate, stageId: string) => {
    const jobId = candidate.pipelineJobId || job?.id;
    if (!jobId) {
      toast.error('No job found for this candidate');
      return;
    }

    let resolvedStageId = String(stageId || '').trim();
    let nextStageName =
      inlineStageOptionsMerged[jobId]?.find((stage) => stage.id === resolvedStageId)?.name ||
      candidate.stage;

    // Resolve fake / local ids (`default-*-stage`, `s-*`) to real DB pipeline stage ids.
    if (!isValidObjectId(resolvedStageId)) {
      try {
        const response = await apiGetPipelineStages(jobId);
        const payload = response.data;
        const stages = Array.isArray(payload)
          ? payload
          : Array.isArray((payload as { data?: unknown })?.data)
            ? (payload as { data: unknown[] }).data
            : [];
      const mappedStages = (stages as { id?: string; name?: string }[])
        .map((stage) => ({
            id: String(stage.id || ''),
            name: String(stage.name || '').trim(),
          }))
          .filter((stage) => stage.id && stage.name && isValidObjectId(stage.id));
        if (mappedStages.length) {
          setInlineStageOptionsByJobId((prev) => ({ ...prev, [jobId]: mappedStages }));
        }
        const wanted = normalizeStageLabel(nextStageName);
        const match =
          mappedStages.find((stage) => normalizeStageLabel(stage.name) === wanted) ||
          mappedStages.find((stage) => canonicalStageLabel(stage.name) === canonicalStageLabel(nextStageName));
        if (!match) {
          toast.error('Pipeline stage not found. Save the job pipeline, then try again.');
          return;
        }
        resolvedStageId = match.id;
        nextStageName = match.name;
      } catch (stageError: unknown) {
        const message =
          stageError instanceof Error ? stageError.message : 'Failed to load pipeline stages';
        toast.error(message);
        return;
      }
    }

    // Interviewing: open Schedule Interview popup only — stage updates after schedule succeeds.
    if (isInterviewPipelineStage(nextStageName)) {
      if (onScheduleInterview) {
        onScheduleInterview(candidate.id, jobId, {
          stageId: resolvedStageId,
          stageName: nextStageName,
        });
      } else {
        toast.error('Schedule Interview is not available');
      }
      return;
    }

    // Offer: open placement flow only — stage updates after placement is created.
    if (isOfferPipelineStage(nextStageName)) {
      if (onCreatePlacement) {
        onCreatePlacement(candidate.id, jobId, {
          stageId: resolvedStageId,
          stageName: nextStageName,
        });
      } else {
        toast.error('Create Placement is not available');
      }
      return;
    }

    try {
      setInlineStageUpdatingCandidateId(candidate.id);
      await apiMoveCandidateStage(jobId, {
        candidateId: candidate.id,
        stageId: resolvedStageId,
      });

      const nextStage = nextStageName || candidate.stage;
      const updated = (displayJobCandidates || []).map((item) =>
        item.id === candidate.id
          ? {
              ...item,
              currentStage: nextStage,
              isJobAppliedCandidate:
                resolveJobCandidateDisplayStage(nextStage) === 'Applied',
            }
          : item,
      );

      setDisplayJobCandidates(updated);
      onJobCandidatesChange?.(updated);

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('jobportal:candidates-changed'));
      }

      await refreshAppliedJobCandidates({
        runPipeline: false,
        refresh: false,
        silent: true,
        seedOverride: updated,
      });
      toast.success(`Stage updated to ${nextStage}`);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to update candidate stage';
      console.error('Failed to update candidate stage from job drawer:', error);
      toast.error(message);
    } finally {
      setInlineStageUpdatingCandidateId((prev) => (prev === candidate.id ? null : prev));
    }
  },
  [
    inlineStageOptionsMerged,
    job?.id,
    displayJobCandidates,
    onJobCandidatesChange,
    onCreatePlacement,
    onScheduleInterview,
    refreshAppliedJobCandidates,
  ],
);

const handleDeleteJobCandidate = useCallback(
  async (candidate: JobDrawerTableCandidate) => {
    if (!isValidObjectId(candidate.id)) {
      toast.error('This candidate cannot be deleted (invalid id).');
      return;
    }
    if (
      !(await requestConfirm(
        `Move ${candidate.name || 'this candidate'} to the Recycle Bin? You can restore them later from Recycle Bin.`,
      ))
    ) {
      return;
    }
    try {
      setDeletingCandidateId(candidate.id);
      await apiDeleteCandidate(candidate.id);
      invalidateEmployerCandidatesCache();
      setDisplayJobCandidates((prev) => {
        const next = prev.filter((row) => row.id !== candidate.id);
        onJobCandidatesChange?.(next);
        return next;
      });
      setSelectedCandidateIds((prev) => prev.filter((id) => id !== candidate.id));
      toast.success('Candidate moved to Recycle Bin');
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent(RECYCLE_BIN_SYNC_EVENT));
        window.dispatchEvent(new CustomEvent('jobportal:candidates-changed'));
      }
      await refreshAppliedJobCandidates({ runPipeline: false, refresh: false, silent: true });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to delete candidate';
      toast.error(message);
    } finally {
      setDeletingCandidateId((prev) => (prev === candidate.id ? null : prev));
    }
  },
  [onJobCandidatesChange, refreshAppliedJobCandidates],
);

const handleRemoveJobCandidate = useCallback(
  async (candidate: JobDrawerTableCandidate) => {
    const jobId = String(job?.id || '').trim();
    if (!jobId) {
      toast.error('No job selected.');
      return;
    }
    if (!isValidObjectId(candidate.id)) {
      toast.error('This candidate cannot be removed (invalid id).');
      return;
    }
    if (
      !(await requestConfirm(
        `Remove ${candidate.name || 'this candidate'} from this job? The candidate record will stay in Candidates.`,
      ))
    ) {
      return;
    }
    try {
      setRemovingFromJobCandidateId(candidate.id);
      await apiRemoveCandidateFromPipeline(candidate.id, jobId);
      setDisplayJobCandidates((prev) => {
        const next = prev.filter((row) => row.id !== candidate.id);
        onJobCandidatesChange?.(next);
        return next;
      });
      setSelectedCandidateIds((prev) => prev.filter((id) => id !== candidate.id));
      toast.success('Candidate removed from this job');
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('jobportal:candidates-changed'));
      }
      await refreshAppliedJobCandidates({ runPipeline: false, refresh: false, silent: true });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to remove candidate from job';
      toast.error(message);
    } finally {
      setRemovingFromJobCandidateId((prev) => (prev === candidate.id ? null : prev));
    }
  },
  [job?.id, onJobCandidatesChange, refreshAppliedJobCandidates],
);



const refreshAiMatches = useCallback(
  async (opts?: { runPipeline?: boolean; refresh?: boolean }) => {
    if (!job?.id) {
      setAiMatchCandidates([]);
      return [] as MatchCandidate[];
    }
    setAiMatchesLoading(true);
    setAiMatchesError(null);
    try {
      const runPipeline = Boolean(opts?.runPipeline);
      const response = await apiGetMatches({
        jobId: job.id,
        source: 'ai',
        limit: 100,
        ...(runPipeline ? { runPipeline: '1' } : {}),
        ...(opts?.refresh ? { refresh: '1' } : {}),
      });
      const matchRows = unwrapMatchRows(response);
      const merged = matchRows.map(mapBackendMatch);
      setAiMatchCandidates(merged);
      setAiSavedMatches(
        merged.filter((candidate) => Boolean(candidate.savedAt)).map((candidate) => candidate.id),
      );
      return merged;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unable to load AI matches';
      setAiMatchesError(message);
      setAiMatchCandidates([]);
      return [] as MatchCandidate[];
    } finally {
      setAiMatchesLoading(false);
    }
  },
  [job?.id],
);

const handleRunAiMatches = useCallback(async () => {
  if (!job?.id) return;
  setAiPipelineRunning(true);
  setAiMatchesError(null);
  try {
    const list = await refreshAiMatches({ runPipeline: true, refresh: true });
    const sorted = [...list].sort((a, b) => b.score - a.score);
    const top = sorted[0];
    const stats = computeAiTierStats(list);
    const phase1Count = list.filter((c) => c.isPhase1Candidate).length;
    if (top) {
      const summary = AI_SCORE_TIERS.map((t) => `${t.label}: ${stats[t.id]}`).join(' · ');
      const phase1Note = phase1Count ? ` · ${phase1Count} Phase 1` : '';
      void requestInfo(
        `AI complete — ${list.length} scored. Top: ${top.name} (${top.score}%). ${summary}${phase1Note}`,
      );
    } else {
      void requestInfo('AI matching complete — no scored candidates yet for this job.');
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unable to run AI matching';
    setAiMatchesError(message);
    void requestError(message);
  } finally {
    setAiPipelineRunning(false);
  }
}, [job?.id, refreshAiMatches]);

const updateAiMatchCandidate = useCallback(
  (candidateId: string, updater: (candidate: MatchCandidate) => MatchCandidate) => {
    setAiMatchCandidates((prev) =>
      prev.map((candidate) => (candidate.id === candidateId ? updater(candidate) : candidate)),
    );
  },
  [],
);

const ensureAiMatchId = useCallback(
  async (candidate: MatchCandidate): Promise<string | null> => {
    if (candidate.matchId) return candidate.matchId;
    if (!job?.id) return null;
    try {
      const response = await apiCreateMatch({
        candidateId: candidate.id,
        jobId: job.id,
        score: candidate.score,
        status: 'SUGGESTED',
      });
      const newMatchId = response?.data?.id;
      if (newMatchId) {
        updateAiMatchCandidate(candidate.id, (current) => ({
          ...current,
          matchId: newMatchId,
          isAppliedCandidate: false,
        }));
        return newMatchId;
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unable to create match record';
      void requestError(message);
    }
    return null;
  },
  [job?.id, updateAiMatchCandidate],
);

const sortedAiMatchCandidates = useMemo(
  () => [...aiMatchCandidates].sort((a, b) => b.score - a.score),
  [aiMatchCandidates],
);

const filteredSortedAiMatchCandidates = useMemo(() => {
  const query = jobCandidatesSearch.trim().toLowerCase();
  if (!query) return sortedAiMatchCandidates;
  return sortedAiMatchCandidates.filter((row) =>
    matchesQuickSearch(
      buildQuickSearchHaystack(
        row.name,
        row.email,
        row.currentTitle,
        row.currentCompany,
        row.location,
      ),
      query,
    ),
  );
}, [sortedAiMatchCandidates, jobCandidatesSearch]);

const aiTierStats = useMemo(
  () => computeAiTierStats(filteredSortedAiMatchCandidates),
  [filteredSortedAiMatchCandidates],
);


  return {
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
  };
}
