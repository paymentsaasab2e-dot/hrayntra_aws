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
import { unwrapApiList, formatInterviewListStatus } from '../components/drawers/jobDetailsShared';
import type { UseJobTabDataParams } from '../components/drawers/jobDrawerTabProps';

export function useJobTabData({
  activeTab,
  displayJobCandidates,
  isOpen,
  job,
  refreshAppliedJobCandidates,
}: UseJobTabDataParams) {
const [clientRemarkCandidates, setClientRemarkCandidates] = useState<JobClientRemarkCandidate[]>([]);

const [clientRemarksClientName, setClientRemarksClientName] = useState('');

const [clientRemarksCount, setClientRemarksCount] = useState(0);

const [loadingClientRemarks, setLoadingClientRemarks] = useState(false);

const [clientRemarksError, setClientRemarksError] = useState('');

const [notesTagFilter, setNotesTagFilter] = useState<JobNoteTag | 'All'>('All');

const [pinnedNoteIds, setPinnedNoteIds] = useState<Set<string>>(new Set());

const [jobActivities, setJobActivities] = useState<BackendActivity[]>([]);

const [loadingActivities, setLoadingActivities] = useState(false);

const [activityFilter, setActivityFilter] = useState<'All' | 'Jobs' | 'Candidates' | 'Interviews' | 'Notes' | 'Files'>('All');

const [jobInterviews, setJobInterviews] = useState<BackendInterviewListItem[]>([]);

const [selectedJobInterview, setSelectedJobInterview] = useState<BackendInterviewListItem | null>(null);

const [jobInterviewDetailOpen, setJobInterviewDetailOpen] = useState(false);

const [selectedInterviewRound, setSelectedInterviewRound] = useState<number | 'all'>(1);

const [jobPlacements, setJobPlacements] = useState<Placement[]>([]);

const [loadingJobInterviews, setLoadingJobInterviews] = useState(false);

const [loadingJobPlacements, setLoadingJobPlacements] = useState(false);

// Fetch job activities when activity tab is active
useEffect(() => {
  if (!job?.id || activeTab !== 'activity') {
    setLoadingActivities(false);
    return;
  }

  const load = startAsyncLoad(setLoadingActivities);
  const fetchActivities = async () => {
    try {
      const response = await apiGetJobActivities(job.id);
      if (!load.isActive()) return;
      setJobActivities(response.data || []);
    } catch (error: any) {
      console.warn('Job activities endpoint may not be available:', error.message);
      if (load.isActive()) setJobActivities([]);
    } finally {
      load.finish();
    }
  };

  void fetchActivities();
  return () => load.abort();
}, [job?.id, activeTab]);

useEffect(() => {
  if (!isOpen || !job?.id) {
    setClientRemarkCandidates([]);
    setClientRemarksCount(0);
    setClientRemarksError('');
    setLoadingClientRemarks(false);
    return;
  }

  const load = startAsyncLoad(setLoadingClientRemarks);
  setClientRemarksError('');
  void (async () => {
    try {
      const response = await apiGetJobClientRemarks(job.id);
      if (!load.isActive()) return;
      const data = extractApiData<JobClientRemarksPayload>(response);
      setClientRemarkCandidates(Array.isArray(data?.candidates) ? data.candidates : []);
      setClientRemarksCount(Number(data?.remarkCount || 0));
      setClientRemarksClientName(String(data?.clientName || job.client || 'Client'));
    } catch (error: unknown) {
      if (!load.isActive()) return;
      setClientRemarksError(error instanceof Error ? error.message : 'Unable to load client remarks');
      setClientRemarkCandidates([]);
      setClientRemarksCount(0);
    } finally {
      load.finish();
    }
  })();
  return () => load.abort();
}, [isOpen, job?.id, job?.client, activeTab === 'client']);

useEffect(() => {
  if (!isOpen || !job?.id || activeTab !== 'interviews') {
    setLoadingJobInterviews(false);
    return;
  }

  const load = startAsyncLoad(setLoadingJobInterviews);
  void apiGetInterviews({ jobId: job.id, page: 1, limit: 100 })
    .then((response: any) => {
      if (!load.isActive()) return;
      setJobInterviews(unwrapApiList<BackendInterviewListItem>(response.data));
    })
    .catch((error: any) => {
      console.warn('Failed to load job interviews:', error);
      if (load.isActive()) setJobInterviews([]);
    })
    .finally(() => {
      load.finish();
    });

  // Prefetch assigned candidates so Schedule Interview picker is ready.
  if (!displayJobCandidates.length) {
    void refreshAppliedJobCandidates({ runPipeline: false, refresh: false });
  }

  return () => {
    load.abort();
  };
}, [activeTab, isOpen, job?.id]);

const refreshJobInterviews = useCallback(() => {
  if (!job?.id) return;
  void apiGetInterviews({ jobId: job.id, page: 1, limit: 100 })
    .then((response: any) => {
      setJobInterviews(unwrapApiList<BackendInterviewListItem>(response.data));
    })
    .catch(() => {
      /* keep current rows */
    });
}, [job?.id]);

const jobInterviewRoundById = useMemo(() => {
  const jobId = String(job?.id || '').trim();
  if (!jobId) return {} as Record<string, number>;
  const rows = jobInterviews
    .map((item: any) => {
      const candidateId = String(item.candidate?.id || '').trim();
      const interviewJobId = String(item.job?.id || jobId).trim();
      if (!candidateId || !interviewJobId) return null;
      return {
        id: item.id,
        candidate: { id: candidateId },
        job: { id: interviewJobId },
        scheduledAt: item.scheduledAt,
        status: item.status,
      };
    })
    .filter((row: any): row is NonNullable<typeof row> => Boolean(row));
  return buildInterviewRoundNumberById(rows);
}, [job?.id, jobInterviews]);

const visibleJobInterviews = useMemo(
  () =>
    jobInterviews.filter((item: any) => formatInterviewListStatus(item.status) !== 'Cancelled'),
  [jobInterviews],
);

const jobInterviewRoundNumbers = useMemo(() => {
  const rounds = new Set<number>();
  for (const item of visibleJobInterviews) {
    rounds.add(jobInterviewRoundById[item.id] || 1);
  }
  return [...rounds].sort((a: any, b: any) => a - b);
}, [jobInterviewRoundById, visibleJobInterviews]);

const jobInterviewCountsByRound = useMemo(() => {
  const byRound = new Map<number, Set<string>>();
  for (const item of visibleJobInterviews) {
    const round = jobInterviewRoundById[item.id] || 1;
    const set = byRound.get(round) || new Set<string>();
    const candidateId = String(item.candidate?.id || '').trim();
    if (candidateId) set.add(candidateId);
    byRound.set(round, set);
  }
  const out: Record<number, number> = {};
  for (const [round, candidates] of byRound) {
    out[round] = candidates.size;
  }
  return out;
}, [jobInterviewRoundById, visibleJobInterviews]);

const jobInterviewAllCandidateCount = useMemo(() => {
  const ids = new Set<string>();
  for (const item of visibleJobInterviews) {
    const candidateId = String(item.candidate?.id || '').trim();
    if (candidateId) ids.add(candidateId);
  }
  return ids.size;
}, [visibleJobInterviews]);

const filteredJobInterviews = useMemo(() => {
  if (selectedInterviewRound === 'all') return visibleJobInterviews;
  return visibleJobInterviews.filter(
    (item: any) => (jobInterviewRoundById[item.id] || 1) === selectedInterviewRound,
  );
}, [jobInterviewRoundById, selectedInterviewRound, visibleJobInterviews]);

useEffect(() => {
  if (selectedInterviewRound === 'all') return;
  if (jobInterviewRoundNumbers.length === 0) return;
  if (!jobInterviewRoundNumbers.includes(selectedInterviewRound)) {
    setSelectedInterviewRound(jobInterviewRoundNumbers[0] ?? 1);
  }
}, [jobInterviewRoundNumbers, selectedInterviewRound]);

useEffect(() => {
  if (!isOpen || !job?.id || activeTab !== 'placements') {
    setLoadingJobPlacements(false);
    return;
  }

  const load = startAsyncLoad(setLoadingJobPlacements);
  void apiGetPlacements({ jobId: job.id, page: 1, limit: 100, sortBy: 'offerDate', sortOrder: 'desc' })
    .then((response: any) => {
      if (!load.isActive()) return;
      setJobPlacements(unwrapApiList<Placement>(response.data));
    })
    .catch((error: any) => {
      console.warn('Failed to load job placements:', error);
      if (load.isActive()) setJobPlacements([]);
    })
    .finally(() => {
      load.finish();
    });

  return () => {
    load.abort();
  };
}, [activeTab, isOpen, job?.id]);

  return {
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
  };
}
