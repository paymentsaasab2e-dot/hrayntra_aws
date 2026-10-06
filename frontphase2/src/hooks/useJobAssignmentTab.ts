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
import { currentUserAsBackendUser, withCurrentUserFirst } from '../components/drawers/jobDetailsShared';
import type { UseJobAssignmentTabParams } from '../components/drawers/jobDrawerTabProps';

export function useJobAssignmentTab({
  activeTab,
  isOpen,
  job,
  onAssignmentUpdated,
}: UseJobAssignmentTabParams) {
const [assignmentMemberIds, setAssignmentMemberIds] = useState<string[]>([]);

const [assignmentManagerId, setAssignmentManagerId] = useState('');

const [assignmentContacts, setAssignmentContacts] = useState<
  Array<{ id: string; name: string }>
>([]);

const [assignmentHiringManagerId, setAssignmentHiringManagerId] = useState('');

const [assignmentHiringManagerName, setAssignmentHiringManagerName] = useState('');

const [loadingAssignmentMeta, setLoadingAssignmentMeta] = useState(false);

const [savingAssignment, setSavingAssignment] = useState(false);

const [assignmentDirty, setAssignmentDirty] = useState(false);

const [assignmentRecruiterOpen, setAssignmentRecruiterOpen] = useState(false);

const closeAssignmentRecruiterMenu = useCallback(() => setAssignmentRecruiterOpen(false), []);

const {
  triggerRef: assignmentRecruiterTriggerRef,
  menuRef: assignmentRecruiterMenuRef,
  menuPosition: assignmentRecruiterMenuPosition,
} = useDrawerPortalDropdownPosition(
  assignmentRecruiterOpen,
  true,
  closeAssignmentRecruiterMenu,
);

const assignmentTabActive = isOpen && activeTab === 'assignment';

const assignmentSeedOrgId = useMemo(() => {
  const fromJob = String(job?.orgUnitId || '').trim();
  if (fromJob) return fromJob;
  return getActiveOrgUnitId();
}, [job?.orgUnitId]);

const assignable = useAssignableMembers(assignmentTabActive, 'Jobs', {
  initialCompanyId: assignmentSeedOrgId,
});

const assignmentCurrentUserId = getStoredCurrentUserId();

const assignmentRecruiterUsers = assignable.users;

const loadingAssignmentRecruiters = assignable.loading;

const assignmentManagerUsers = useMemo(() => {
  const byId = new Map<string, BackendUser>();
  for (const user of assignmentRecruiterUsers) byId.set(user.id, user);
  const me =
    assignmentRecruiterUsers.find((user: any) => user.id === assignmentCurrentUserId) ||
    currentUserAsBackendUser();
  if (me) byId.set(me.id, me);
  const sorted = Array.from(byId.values()).sort((a: any, b: any) =>
    String(a.name || '').localeCompare(String(b.name || '')),
  );
  return withCurrentUserFirst(sorted, assignmentCurrentUserId);
}, [assignmentCurrentUserId, assignmentRecruiterUsers]);

const needsAssignmentOrganizationFirst =
  assignable.canSelectCompany &&
  !assignable.companyId &&
  assignable.companiesReady &&
  assignable.companies.length > 0;

const needsAssignmentManagerFirst = !assignmentManagerId;

const filteredAssignmentRecruiters = useMemo(() => {
  // Keep existing assignees visible even before a manager is chosen.
  if (!assignmentManagerId) {
    if (!assignmentMemberIds.length) return [];
    const byId = new Map(assignmentRecruiterUsers.map((user: any) => [user.id, user]));
    return assignmentMemberIds
      .map((id: any) => byId.get(id))
      .filter(Boolean) as BackendUser[];
  }
  const managerId = String(assignmentManagerId).trim();
  const byId = new Map(assignmentRecruiterUsers.map((user: any) => [user.id, user]));
  const managerUser =
    assignmentManagerUsers.find((user: any) => user.id === managerId) ||
    assignmentRecruiterUsers.find((user: any) => user.id === managerId);
  if (managerUser && !byId.has(managerUser.id)) byId.set(managerUser.id, managerUser);
  const me =
    assignmentRecruiterUsers.find((user: any) => user.id === assignmentCurrentUserId) ||
    assignmentManagerUsers.find((user: any) => user.id === assignmentCurrentUserId) ||
    currentUserAsBackendUser();
  if (me && !byId.has(me.id)) byId.set(me.id, me);
  return withCurrentUserFirst(Array.from(byId.values()), assignmentCurrentUserId);
}, [
  assignmentCurrentUserId,
  assignmentManagerId,
  assignmentManagerUsers,
  assignmentMemberIds,
  assignmentRecruiterUsers,
]);

const selectedAssignmentAssignees = useMemo(() => {
  const leadLabel = String(job?.recruiter || job?.owner || '').trim();
  return assignmentMemberIds.map((id: any, index: any) => {
    const fromFiltered = filteredAssignmentRecruiters.find((u: any) => u.id === id);
    if (fromFiltered) return fromFiltered;
    const fromAll = assignmentRecruiterUsers.find((u: any) => u.id === id);
    if (fromAll) return fromAll;
    const fallbackName =
      index === 0 && leadLabel && !/^(-|—|unassigned)$/i.test(leadLabel)
        ? leadLabel
        : 'Assigned member';
    return {
      id,
      name: fallbackName,
      email: '',
      role: '',
      isActive: true,
      createdAt: '',
    } as BackendUser;
  });
}, [
  assignmentMemberIds,
  assignmentRecruiterUsers,
  filteredAssignmentRecruiters,
  job?.owner,
  job?.recruiter,
]);

// Once assignable members load, fill missing manager / org from the primary assignee.
useEffect(() => {
  if (!assignmentTabActive || loadingAssignmentRecruiters) return;
  if (!assignmentMemberIds.length) return;

  const primaryId = assignmentMemberIds[0];
  const primaryMember = assignable.members.find((row: any) => row.id === primaryId);
  if (!primaryMember) return;

  if (!assignmentManagerId) {
    const inferred =
      String(primaryMember.manager?.id || primaryMember.managerId || '').trim();
    if (inferred) setAssignmentManagerId(inferred);
  }

  if (!assignable.companyId) {
    const memberOrg = String(
      (primaryMember as { assignCompanyId?: string | null }).assignCompanyId ||
        primaryMember.orgUnitId ||
        primaryMember.orgUnit?.id ||
        '',
    ).trim();
    if (memberOrg) assignable.setCompanyId(memberOrg);
  }
}, [
  assignmentTabActive,
  assignmentManagerId,
  assignmentMemberIds,
  assignable.companyId,
  assignable.members,
  assignable.setCompanyId,
  loadingAssignmentRecruiters,
]);

const applyAssignmentMemberIds = useCallback(
  (ids: string[]) => {
    const unique = [...new Set(ids.map((id: any) => String(id || '').trim()).filter(Boolean))];
    const primary = unique[0] || '';
    const primaryMember = assignable.members.find((row: any) => row.id === primary);
    const inferredManagerId =
      primaryMember?.manager?.id || primaryMember?.managerId || '';
    setAssignmentMemberIds(unique);
    if (inferredManagerId && !assignmentManagerId) {
      setAssignmentManagerId(inferredManagerId);
    }
    setAssignmentDirty(true);
  },
  [assignable.members, assignmentManagerId],
);

const selectAssignmentManager = (userId: string) => {
  setAssignmentManagerId(userId);
  if (assignmentMemberIds.length) {
    const allowedIds = new Set(assignmentRecruiterUsers.map((user: any) => user.id));
    if (assignmentCurrentUserId) allowedIds.add(assignmentCurrentUserId);
    if (userId) allowedIds.add(userId);
    const kept = assignmentMemberIds.filter((id: any) => allowedIds.has(id));
    if (kept.length !== assignmentMemberIds.length) {
      setAssignmentMemberIds(kept);
    }
  }
  setAssignmentDirty(true);
};

useEffect(() => {
  if (!isOpen || !job?.id || activeTab !== 'assignment') return;

  const supportingIds = Array.isArray(job.supportingRecruiters)
    ? job.supportingRecruiters.map((id: any) => String(id || '').trim()).filter(Boolean)
    : [];
  const leadId = String(job.assignedToId || '').trim();
  const memberIds = leadId
    ? [leadId, ...supportingIds.filter((id: any) => id !== leadId)]
    : supportingIds;
  const hiringId = String(job.hiringManagerId || '').trim();
  const hiringLabel = String(job.hiringManager || '').trim();
  const managerId = String(job.managerId || '').trim();

  setAssignmentMemberIds(memberIds);
  setAssignmentManagerId(managerId);
  setAssignmentHiringManagerId(hiringId);
  setAssignmentHiringManagerName(
    hiringLabel && !/^(-|—)$/i.test(hiringLabel) ? hiringLabel : '',
  );
  setAssignmentDirty(false);

  const orgId =
    String(job.orgUnitId || '').trim() ||
    assignmentSeedOrgId ||
    '';
  if (orgId && orgId !== assignable.companyId) {
    assignable.setCompanyId(orgId);
  }

  const load = startAsyncLoad(setLoadingAssignmentMeta);
  void (async () => {
    try {
      const contactsRes = await apiGetContacts(
        job.clientId ? { companyId: job.clientId } : undefined,
      ).catch(() => null);
      if (!load.isActive()) return;

      const contacts = Array.isArray(contactsRes?.data) ? contactsRes.data : [];
      const contactOptions = contacts
        .map((row: { id?: string; firstName?: string; lastName?: string; name?: string; email?: string }) => {
          const id = String(row?.id || '').trim();
          if (!id) return null;
          const name =
            formatAssigneeDisplayName(row) ||
            `${row?.firstName || ''} ${row?.lastName || ''}`.trim() ||
            String(row?.name || '').trim() ||
            String(row?.email || '').trim() ||
            id;
          return { id, name };
        })
        .filter((row: any): row is { id: string; name: string } => Boolean(row));
      setAssignmentContacts(contactOptions);

      if (hiringId && !hiringLabel) {
        const fromContact = contactOptions.find((c: any) => c.id === hiringId)?.name;
        if (fromContact) setAssignmentHiringManagerName(fromContact);
      } else if (!hiringId && hiringLabel) {
        const matched = contactOptions.find(
          (c: any) => c.name.toLowerCase() === hiringLabel.toLowerCase(),
        );
        if (matched) {
          setAssignmentHiringManagerId(matched.id);
          setAssignmentHiringManagerName(matched.name);
        }
      }
    } catch {
      if (load.isActive()) setAssignmentContacts([]);
    } finally {
      load.finish();
    }
  })();

  return () => {
    load.abort();
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [
  activeTab,
  isOpen,
  job?.id,
  job?.clientId,
  job?.orgUnitId,
  job?.assignedToId,
  job?.managerId,
  job?.hiringManager,
  job?.hiringManagerId,
  assignmentSeedOrgId,
  Array.isArray(job?.supportingRecruiters) ? job.supportingRecruiters.join(',') : '',
]);

const saveAssignment = async () => {
  if (!job?.id) return;
  const ids = assignmentMemberIds.map((id: any) => String(id || '').trim()).filter(Boolean);
  const primaryId = ids[0] || null;
  const supporting = ids.slice(1);
  const hiringId = String(assignmentHiringManagerId || '').trim();
  const hiringName = String(assignmentHiringManagerName || '').trim();
  const managerId = String(assignmentManagerId || '').trim();

  setSavingAssignment(true);
  try {
    await apiUpdateJob(job.id, {
      assignedToId: primaryId,
      supportingRecruiters: supporting,
      managerId: managerId || null,
      orgUnitId: assignable.companyId || job.orgUnitId || undefined,
      hiringManagerId: hiringId || undefined,
      hiringManager: hiringName || undefined,
    } as any);
    setAssignmentDirty(false);
    toast.success('Assignment updated.');
    await Promise.resolve(onAssignmentUpdated?.(job.id));
  } catch (error: any) {
    void requestError(error?.message || 'Failed to update assignment');
  } finally {
    setSavingAssignment(false);
  }
};

  return {
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
  };
}
