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
import {  } from '../components/drawers/jobDetailsShared';
import type { UseJobDrawerHeaderParams } from '../components/drawers/jobDrawerTabProps';

export function useJobDrawerHeader({
  isOpen,
  job,
  onStatusUpdated,
}: UseJobDrawerHeaderParams) {
const [showStatusChange, setShowStatusChange] = useState(false);

const [jobStatusCatalog, setJobStatusCatalog] = useState<string[]>([...DEFAULT_JOB_STATUS_OPTIONS]);

const [localJobStatus, setLocalJobStatus] = useState<string>('Active');

const [showAddJobStatusInput, setShowAddJobStatusInput] = useState(false);

const [newJobStatusValue, setNewJobStatusValue] = useState('');

const [savingJobStatus, setSavingJobStatus] = useState(false);

const [deletingJobStatus, setDeletingJobStatus] = useState(false);

const [updatingJobStatus, setUpdatingJobStatus] = useState(false);

const [applyUrl, setApplyUrl] = useState<string | null>(null);

const [applyLinkLoading, setApplyLinkLoading] = useState(false);

const [applyLinkCopied, setApplyLinkCopied] = useState(false);

const [applyShareOpen, setApplyShareOpen] = useState(false);

const closeApplyShare = useCallback(() => setApplyShareOpen(false), []);

const {
  triggerRef: applyShareTriggerRef,
  menuRef: applyShareMenuRef,
  menuPosition: applyShareMenuPosition,
} = useDrawerPortalDropdownPosition(applyShareOpen, false, closeApplyShare);

useEffect(() => {
  setShowStatusChange(false);
  setShowAddJobStatusInput(false);
  setNewJobStatusValue('');
  setLocalJobStatus(job?.status || 'Active');
}, [job?.id, job?.status]);

useEffect(() => {
  if (!isOpen) return;
  let cancelled = false;
  const load = async () => {
    try {
      const response = await apiGetJobStatusCatalog();
      if (cancelled) return;
      setJobStatusCatalog(
        mergeJobStatusOptions(response?.data?.statuses, job?.status || localJobStatus),
      );
    } catch {
      if (cancelled) return;
      setJobStatusCatalog(mergeJobStatusOptions(undefined, job?.status || localJobStatus));
    }
  };
  void load();
  return () => {
    cancelled = true;
  };
}, [isOpen, job?.id, job?.status, localJobStatus]);

const drawerStatusOptions = useMemo(
  () =>
    filterJobStatusOptionsForCurrent(
      mergeJobStatusOptions(jobStatusCatalog, localJobStatus),
      localJobStatus,
    ),
  [jobStatusCatalog, localJobStatus],
);

const applyJobStatusChange = async (status: string) => {
  if (!job?.id) return;
  if (isDraftJobStatus(status) && !canRevertJobToDraft(localJobStatus)) {
    toast.error('Once a job is Active, it cannot be set back to Draft.');
    return;
  }
  const previous = localJobStatus;
  setLocalJobStatus(status);
  setUpdatingJobStatus(true);
  try {
    await apiUpdateJob(job.id, {
      status: mapJobStatusLabelToBackend(status),
      statusLabel: status,
    } as any);
    onStatusUpdated?.(job.id, status);
    setShowStatusChange(false);
    setShowAddJobStatusInput(false);
    toast.success(`Status updated to "${status}".`);
  } catch (error: any) {
    setLocalJobStatus(previous);
    void requestError(error?.message || 'Failed to update job status');
  } finally {
    setUpdatingJobStatus(false);
  }
};

const addJobStatusOption = async () => {
  const status = String(newJobStatusValue || '').trim();
  if (!status) {
    toast.error('Enter a status name first.');
    return;
  }
  setSavingJobStatus(true);
  try {
    const response = await apiAppendJobStatus(status);
    const next = mergeJobStatusOptions(response?.data?.statuses, status);
    setJobStatusCatalog(next);
    setNewJobStatusValue('');
    setShowAddJobStatusInput(false);
    await applyJobStatusChange(status);
  } catch (error: any) {
    void requestError(error?.message || 'Failed to add status');
  } finally {
    setSavingJobStatus(false);
  }
};

const deleteJobStatusOption = async (status: string) => {
  setDeletingJobStatus(true);
  try {
    const response = await apiRemoveJobStatus(status);
    const next = mergeJobStatusOptions(response?.data?.statuses, localJobStatus);
    setJobStatusCatalog(next);
    if (localJobStatus === status) {
      const fallback = next[0] || 'Active';
      await applyJobStatusChange(fallback);
    }
    toast.success(`Status "${status}" removed.`);
  } catch (error: any) {
    void requestError(error?.message || 'Failed to remove status');
  } finally {
    setDeletingJobStatus(false);
  }
};

useEffect(() => {
      setApplyShareOpen(false);
}, [job?.id]);

const shareApplyLink = useCallback(async () => {
  if (!applyUrl) return;
  const title = job?.title ? `Apply: ${job.title}` : 'Job apply link';
  const text = job?.title
    ? `Check out this job opportunity: ${job.title}`
    : 'Check out this job opportunity';
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      await navigator.share({ title, text, url: applyUrl });
      setApplyShareOpen(false);
      return;
    }
  } catch (error: any) {
    if (error?.name === 'AbortError') return;
  }
  setApplyShareOpen((open: any) => !open);
}, [applyUrl, job?.title]);

const openApplyShareTarget = useCallback(
  (platform: 'whatsapp' | 'linkedin' | 'x' | 'facebook' | 'email' | 'telegram') => {
    if (!applyUrl) return;
    const title = job?.title ? String(job.title) : 'this role';
    const text = `Check out this job opportunity: ${title}`;
    const encodedUrl = encodeURIComponent(applyUrl);
    const encodedText = encodeURIComponent(text);
    const encodedSubject = encodeURIComponent(job?.title ? `Job: ${job.title}` : 'Job opportunity');
    const encodedBody = encodeURIComponent(`${text}\n\n${applyUrl}`);
    const hrefByPlatform: Record<string, string> = {
      whatsapp: `https://wa.me/?text=${encodeURIComponent(`${text}\n${applyUrl}`)}`,
      linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
      x: `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedText}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
      email: `mailto:?subject=${encodedSubject}&body=${encodedBody}`,
      telegram: `https://t.me/share/url?url=${encodedUrl}&text=${encodedText}`,
    };
    const href = hrefByPlatform[platform];
    if (!href) return;
    if (platform === 'email') {
      window.location.href = href;
    } else {
      window.open(href, '_blank', 'noopener,noreferrer,width=640,height=640');
    }
    setApplyShareOpen(false);
  },
  [applyUrl, job?.title],
);

const fetchApplyLink = useCallback(async (jobId: string, fallbackToken?: string | null) => {
  const res = await apiGetJobApplyLink(jobId);
  return resolveJobApplyUrlFromResponse(res, fallbackToken);
}, []);

useEffect(() => {
  if (!job?.id) {
    setApplyUrl(null);
    setApplyLinkLoading(false);
    return;
  }

  const jobId = job.id;
  const seeded =
    String(job.applyUrl || '').trim() ||
    resolveJobApplyUrlFromResponse(null, job.applyLinkToken) ||
    null;
  setApplyUrl(seeded);

  let cancelled = false;
  setApplyLinkLoading(true);
  void fetchApplyLink(jobId, job.applyLinkToken)
    .then((url: any) => {
      if (cancelled) return;
      if (url) setApplyUrl(url);
      else if (!seeded) setApplyUrl(null);
    })
    .catch((err: any) => {
      if (cancelled) return;
      console.error('Failed to load job apply link:', err);
      if (!seeded) setApplyUrl(null);
    })
    .finally(() => {
      if (!cancelled) setApplyLinkLoading(false);
    });

  return () => {
    cancelled = true;
  };
}, [job?.id, job?.applyUrl, job?.applyLinkToken, fetchApplyLink]);

const openApplyShareMenu = useCallback(async () => {
  if (!job?.id) return;
  if (applyUrl) {
    setApplyShareOpen((open: any) => !open);
    return;
  }
  if (applyLinkLoading) return;
  setApplyLinkLoading(true);
  try {
    const url = await fetchApplyLink(job.id, job.applyLinkToken);
    if (url) {
      setApplyUrl(url);
      setApplyShareOpen(true);
      return;
    }
    void requestError('Apply link not available yet. Try publishing the job or refresh and retry.');
  } catch (err: any) {
    console.error('Failed to load job apply link:', err);
    void requestError(err?.message || 'Could not load apply link. Please try again.');
  } finally {
    setApplyLinkLoading(false);
  }
}, [applyLinkLoading, applyUrl, fetchApplyLink, job?.applyLinkToken, job?.id]);

  return {
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
  };
}
