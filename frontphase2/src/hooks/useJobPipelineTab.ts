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
import { normalizePipelineStages, DEFAULT_PIPELINE_STAGE_ID_SET } from '../components/drawers/jobDetailsShared';
import type { JobPipelineStage } from '../components/drawers/jobDetailsShared';
import type { UseJobPipelineTabParams } from '../components/drawers/jobDrawerTabProps';

export function useJobPipelineTab({
  initialPipelineStages,
  job,
  onPipelineStagesChange,
}: UseJobPipelineTabParams) {
const [pipelineStages, setPipelineStages] = useState<JobPipelineStage[]>(normalizePipelineStages(initialPipelineStages));

const [draggedStageId, setDraggedStageId] = useState<string | null>(null);

const [pipelineDirty, setPipelineDirty] = useState(false);

const [pipelineValidationError, setPipelineValidationError] = useState('');

const [orgRecruitmentMode, setOrgRecruitmentMode] = useState<'agency' | 'standalone'>(() =>
  typeof window !== 'undefined' ? getCachedOrgRecruitmentMode() : 'agency'
);

const [jobPipelineCustomized, setJobPipelineCustomized] = useState(false);

const isOwnPipelineEditRef = useRef(false);

useEffect(() => {
  const on = () => setOrgRecruitmentMode(getCachedOrgRecruitmentMode());
  window.addEventListener(ORG_RECRUITMENT_CACHE_EVENT, on);
  return () => window.removeEventListener(ORG_RECRUITMENT_CACHE_EVENT, on);
}, []);

useEffect(() => {
  setJobPipelineCustomized(false);
}, [job?.id]);

useEffect(() => {
  if (job) {
    if (isOwnPipelineEditRef.current) {
      // Local edit already updated state; avoid re-normalizing and losing drag order.
    } else {
      const normalized = normalizePipelineStages(initialPipelineStages);
      setPipelineStages(normalized);
    }
    if (!isOwnPipelineEditRef.current) {
      // Never auto-mark dirty just because the backend returned no stages —
      // doing so caused the four fallback stages (Apply/Interview/Reject/Placed)
      // to silently get saved on the next user-triggered save, polluting jobs
      // that should have been using the org pipeline template instead.
      setPipelineDirty(false);
    }
    setPipelineValidationError('');
    isOwnPipelineEditRef.current = false;
  }
}, [job?.id, initialPipelineStages]);

const notifyPipelineChange = (stages: JobPipelineStage[]) => {
  isOwnPipelineEditRef.current = true;
  onPipelineStagesChange?.(stages);
};

const pipelineConfigLocked = !jobPipelineCustomized;

const handlePipelineReorder = (fromIndex: number, toIndex: number) => {
  if (pipelineConfigLocked) return;
  if (fromIndex === toIndex) return;
  const next = [...pipelineStages];
  const [removed] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, removed);
  setPipelineStages(next);
  notifyPipelineChange(next);
  setPipelineDirty(true);
  setPipelineValidationError('');
};

const handleAddStage = () => {
  if (pipelineConfigLocked) return;
  const next = [...pipelineStages, { id: `s-${Date.now()}`, name: 'New stage', sla: '' }];
  setPipelineStages(next);
  notifyPipelineChange(next);
  setPipelineDirty(true);
  setPipelineValidationError('');
};

const handleRemoveStage = (id: string) => {
  if (pipelineConfigLocked) return;
  const next = pipelineStages.filter((s: any) => s.id !== id);
  const normalized = normalizePipelineStages(next);
  setPipelineStages(normalized);
  notifyPipelineChange(normalized);
  setPipelineDirty(true);
  setPipelineValidationError('');
};

const handleStageNameChange = (id: string, name: string) => {
  if (pipelineConfigLocked) return;
  const stage = pipelineStages.find((s: any) => s.id === id);
  if (!stage) return;

  const next = pipelineStages.map((s: any) => (s.id === id ? { ...s, name } : s));
  setPipelineStages(next);
  notifyPipelineChange(next);
  setPipelineDirty(true);
  setPipelineValidationError('');
};

const handleStageSlaChange = (id: string, sla: string) => {
  if (pipelineConfigLocked) return;
  const next = pipelineStages.map((s: any) => (s.id === id ? { ...s, sla } : s));
  setPipelineStages(next);
  notifyPipelineChange(next);
  setPipelineDirty(true);
  setPipelineValidationError('');
};

const handleStageSystemRoleChange = (id: string, systemRole: string) => {
  const value = String(systemRole || '').trim();
  const next = pipelineStages.map((s: any) =>
    s.id === id ? { ...s, systemRole: value || undefined } : s
  );
  setPipelineStages(next);
  notifyPipelineChange(next);
  setPipelineDirty(true);
  setPipelineValidationError('');
};

const isDefaultPipelineStage = (stage: JobPipelineStage) => DEFAULT_PIPELINE_STAGE_ID_SET.has(String(stage.id || ''));

  return {
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
  };
}
