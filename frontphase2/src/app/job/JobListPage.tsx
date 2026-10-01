// AUTO-SPLIT from page.tsx — moved code, no behavior change.
'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SHOW_TABLE_ROW_EDIT_ICON } from '../../constants/tableUi';
import {
  Plus, 
  RefreshCcw, 
  Search,
  XCircle,
  Pencil,
  UserPlus, 
  FileText, 
  BrainCircuit, 
  Briefcase, 
  Users, 
  CheckCircle2, 
  Clock, 
  CheckSquare,
  Download,
  Trash2,
  Inbox,
  Sparkles,
  Lock,
  ChevronDown,
} from 'lucide-react';
import { createPortal } from 'react-dom';
import { AiCoinLockBadge, useAiCoinGate } from '../../components/coins/AiCoinGate';
import { downloadCsv } from '../../utils/csv';
import { ExportColumnsModal } from '../../components/export/ExportColumnsModal';
import { buildJobsCsvColumns, JOBS_EXPORT_COLUMNS } from '../../lib/export/jobsExportColumns';
import { TableColumnsMenu } from '../../components/table/TableColumnsMenu';
import { useFormatTableLocationCell } from '../../components/table/LocationColumnHeader';
import {
  usePersistedColumnVisibility,
  useTenantScopedStringArray,
  flattenTableColumns,
  tenantScopedStorageKey,
  readTenantColumnScope,
} from '../../hooks/usePersistedColumnVisibility';
import {
  JOB_PIPELINE_STAGE_COLUMNS,
  JOB_PIPELINE_STAGE_COLUMN_PREFIX,
  JOB_TABLE_COLUMNS,
  LOCATION_DISPLAY_COLUMN_PREFIX,
} from '../../lib/tableColumns/moduleTableColumns';
import { fetchAllPaginated, totalPagesFromPagination } from '../../lib/export/fetchAllPaginated';
import { formatDateDMY, formatDateTimeDMY } from '../../utils/dateDisplay';
import { extractAuditMeta } from '../../utils/auditMeta';
import { TableAuditColumnHeader, TableAuditCell } from '../../components/table/TableAuditCell';
import type { AiWorkspaceBriefAlert } from '@/lib/apiAiWorkspaceBrief';
import { WorkspaceAlertTableCell, WorkspaceAlertTableHeader } from '../../components/ai/WorkspaceAlertTableCell';
import type { AuditMeta } from '../../types/audit';
import nextDynamic from 'next/dynamic';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import PaginationAll from '../../components/PaginationAll';
import { TABLE_PAGE_SIZE_OPTIONS, type TablePageSize } from '../../constants/tablePagination';
import { requestConfirm, requestError } from '../../lib/appDialog';
import { motion } from 'motion/react';
import { Toaster, toast } from 'sonner';
import { CreateTaskModal } from '../../components/CreateTaskModal';
import type { JobForDrawer, JobCandidateItem } from '../../components/drawers/JobDetailsDrawer';

import { PageErrorBoundary } from '../../components/PageErrorBoundary';

import {
  SmartSearchActiveKeywordsBar,
  SmartSearchPromptPanel,
  SmartSearchToggleButton,
} from '../../components/smart-search/SmartSearchToolbar';
import { useSmartSearch } from '../../hooks/useSmartSearch';
import { mapAiToJobsResult, parseSmartSearchWithAi } from '../../lib/smart-search/aiParser';
import { buildJobsListApiParams } from '../../lib/smart-search/entitySmartSearch';
import { parseJobsSmartSearchPrompt, JOBS_SMART_SEARCH_EXAMPLES, jobMatchesSmartKeywordChips, mergeJobsSmartSearchResult } from '../../lib/smart-search/parsers';
import { sortByQuickSearchRelevance } from '../../lib/quickSearch';
import { StatusChangeService } from '../../components/StatusChangeService';
import {
  apiAddCandidateNote,
  apiAddCandidateTag,
  apiAddCandidateToPipeline,
  apiGetCandidate,
  apiGetCandidates,
  apiGetClients,
  apiGetWorkspaceClient,
  apiGetMatches,
  apiGetJobs,
  apiGetJob,
  apiGetJobApplyLink,
  apiGetJobMetrics,
  apiDeleteJob,
  apiDeleteCandidateNote,
  apiPinCandidateNote,
  apiRejectCandidate,
  apiRemoveCandidateFromPipeline,
  apiRemoveCandidateTag,
  apiScheduleCandidateInterview,
  apiUpdateCandidate,
  apiUpdateCandidateInterview,
  apiUpdateCandidateNote,
  apiUpdateJob,
  apiMoveCandidateStage,
  apiCreatePlacement,
  emitNotificationsUpdated,
  apiGetUsers,
  apiGetJobStatusCatalog,
  apiAppendJobStatus,
  apiRemoveJobStatus,
  type BackendClient,
  type BackendJob,
  type BackendCandidate,
  type BackendUser,
  type JobMetrics,
  type CreateJobData,
  getCachedOrgRecruitmentMode,
  ORG_RECRUITMENT_CACHE_EVENT,
} from '../../lib/api';
import {
  DEFAULT_JOB_STATUS_OPTIONS,
  displayJobStatusFromBackend,
  isProtectedJobStatus,
  isArchivedFromJobsList,
  filterJobStatusOptionsForCurrent,
  isDraftJobStatus,
  canRevertJobToDraft,
  jobStatusPillClass,
  mapJobStatusLabelToBackend,
  mergeJobStatusOptions,
} from '../../lib/jobStatus';
import { useDrawerPortalDropdownPosition } from '../../components/drawers/drawerFormUi';
import type { Candidate } from '../candidate/components/CandidateTable';
import type {
  CandidateInterviewerOption,
  CandidatePipelineJobOption,
  CandidateProfileDrawerData,
  CandidateScheduledInterview,
  CandidateTagItem,
} from '../../components/drawers/CandidateProfileDrawer';
import {
  extractApiData,
  getTagColor,
  isValidObjectId,
  mapCandidateProfile,
} from '../../lib/mapCandidateProfile';
import { candidateTableRowToProfileStub } from '../../lib/candidateTableToProfileStub';
import {
  pickCandidateOwnerLabel,
  resolveCandidateExperienceYears,
  resolveCandidateLocationLabel,
} from '../../lib/candidateListMapping';
import {
  extractPipelineJobCandidateItems,
  extractApplicationsJobCandidateItems,
  isJobLinkedBackendMatch,
  isJobAppliedDisplayStage,
  mergeJobCandidateSeeds,
  loadJobAppliedCandidates,
  resolveJobCandidateDisplayStage,
  resolveJobCandidateStageFromMatchRow,
} from '../../lib/jobAppliedMatches';
import type { InterviewPanelMember } from '../../types/interview.types';
import { getAllTeamMembersForAssign, getAllTeamMembersForDirectory, teamMembersToBackendUsers } from '../../lib/api/teamApi';
import { formatAssigneeDisplayName, stripAssigneeCompanySuffix } from '../../lib/assigneeDisplay';
import { AssigneeAvatars } from '../leads/AssigneeAvatars';
import { useDebouncedValue, useListRequestGate } from '../../hooks/useListRequestGate';
import { getActiveOrgUnitId } from '../../lib/org/orgWorkspaceStorage';
import { formatJobSalaryDisplay } from '../../constants/jobSalary';
import { usePermissions } from '../../hooks/usePermissions';
import { usePageAutoRefresh } from '../../hooks/usePageAutoRefresh';
import {
  isJobsListCacheFresh,
  readJobsListCache,
  readJobsMetricsCache,
  writeJobsListCache,
  writeJobsMetricsCache,
  invalidateEmployerJobsCache,
  invalidateEmployerCandidatesCache,
} from '../../lib/employerPageCache';
import { useWorkspaceEntityAlerts } from '../../hooks/useWorkspaceEntityAlerts';
import { TableSkeleton } from '../../components/ui/Skeleton';
import { SummaryCard, SummaryCardSkeleton, type SummaryCardColor } from '../../components/ui/SummaryCard';
import {
  Ph2ModulePageLayout,
  PH2_KPI_ROW_CLASS,
  PH2_TABLE_BODY_SCROLL_CLASS,
  PH2_TABLE_CARD_CLASS,
  PH2_TABLE_CARD_FOOTER_CLASS,
  PH2_TOOLBAR_FILTERS_CLASS,
  PH2_TOOLBAR_ROW_CLASS,
} from '../../components/layout/Ph2ModulePageLayout';
import { ShowSummaryCardsButton } from '../../components/layout/ShowSummaryCardsButton';
import { SearchableToolbarFilterSelect } from '../../components/forms/SearchableToolbarFilterSelect';
import { dedupeByCompanyName } from '../../lib/companyNameKey';
import { useJobList, Job, toJobForDrawer, JobStatusPillProps, PipelineSnapshotProps, normalizePipelineStageKey, filterPipelineStagesForColumns, LEGACY_PIPELINE_BUCKETS, SYSTEM_ROLE_TO_LEGACY_KEY, SYSTEM_ROLE_NAME_FALLBACK, abbreviateStage, JobsListViewProps, STATS_CONFIG } from '././useJobList';

const JobDetailsDrawer = nextDynamic(
  () => import('../../components/drawers/JobDetailsDrawer').then((mod) => ({ default: mod.JobDetailsDrawer })),
  { ssr: false, loading: () => null }
);

const CreateJobDrawer = nextDynamic(
  () =>
    import('../../components/drawers/CreateJobDrawer').then((mod) => ({
      default: mod.CreateJobDrawer,
    })),
  { ssr: false },
);

const JobAiCreateWizard = nextDynamic(
  () =>
    import('../../components/jobs/JobAiCreateWizard').then((mod) => ({
      default: mod.JobAiCreateWizard,
    })),
  { ssr: false },
);

const AddCandidateDrawer = nextDynamic(
  () => import('../../components/candidates/AddCandidateDrawer'),
  { ssr: false, loading: () => null }
);

const CandidateProfileDrawer = nextDynamic(
  () => import('../../components/drawers/CandidateProfileDrawer').then((mod) => ({ default: mod.CandidateProfileDrawer })),
  { ssr: false, loading: () => null }
);

const CandidateScheduleInterviewModal = nextDynamic(
  () => import('../../components/drawers/CandidateProfileDrawer').then((mod) => ({ default: mod.ScheduleInterviewModal })),
  { ssr: false, loading: () => null }
);

const CreatePlacementDrawer = nextDynamic(
  () => import('../../components/placements/modals/CreatePlacementDrawer').then((mod) => ({ default: mod.CreatePlacementDrawer })),
  { ssr: false, loading: () => null }
);

const ModuleRecycleBinDrawer = nextDynamic(
  () => import('../../components/ModuleRecycleBinDrawer'),
  { ssr: false, loading: () => null }
);

const JobStatusPill = ({ status }: JobStatusPillProps) => {
  return (
    <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold border ${jobStatusPillClass(status)}`}>
      {status}
    </span>
  );
};

const JobStatusTableDropdown = ({
  value,
  options,
  onSelect,
  onAppend,
  onRemove,
}: {
  value: string;
  options: string[];
  onSelect: (status: string) => void;
  onAppend: (status: string) => Promise<string[] | void>;
  onRemove: (status: string) => Promise<string[] | void>;
}) => {
  const [open, setOpen] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [newStatus, setNewStatus] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const optionsList = Array.isArray(options) ? options : [];
  const closeMenu = useCallback(() => {
    setOpen(false);
    setShowAdd(false);
    setNewStatus('');
  }, []);
  const { triggerRef, menuRef, menuPosition } = useDrawerPortalDropdownPosition(open, false, closeMenu);

  const handleAdd = async () => {
    const label = String(newStatus || '').trim();
    if (!label) {
      toast.error('Enter a status name first.');
      return;
    }
    setSaving(true);
    try {
      await onAppend(label);
      onSelect(label);
      setNewStatus('');
      setShowAdd(false);
      setOpen(false);
      toast.success(`Status "${label}" added.`);
    } catch (error: any) {
      toast.error(error?.message || 'Failed to add status');
    } finally {
      setSaving(false);
    }
  };

  const menu =
    open && menuPosition && typeof document !== 'undefined'
      ? createPortal(
          <div
            ref={menuRef}
            className="fixed z-[1200] max-h-72 overflow-auto rounded-xl border border-slate-200 bg-white shadow-2xl"
            style={{
              left: menuPosition.left,
              width: Math.max(menuPosition.width, 240),
              ...(menuPosition.placement === 'top'
                ? { bottom: menuPosition.bottom }
                : { top: menuPosition.top }),
            }}
          >
            {optionsList.map((status) => {
              const isActive = String(value || '') === String(status || '');
              const canDelete = !isProtectedJobStatus(status);
              return (
                <div
                  key={status}
                  className={`flex w-full items-center gap-1 px-1.5 py-0.5 ${
                    isActive ? 'bg-indigo-50' : 'hover:bg-slate-50'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => {
                      onSelect(status);
                      setOpen(false);
                    }}
                    className={`min-w-0 flex-1 rounded-lg px-2 py-1.5 text-left text-xs font-semibold ${
                      isActive ? 'text-indigo-700' : 'text-slate-800'
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
                        void (async () => {
                          setDeleting(true);
                          try {
                            await onRemove(status);
                            toast.success(`Status "${status}" removed.`);
                          } catch (error: any) {
                            toast.error(error?.message || 'Failed to remove status');
                          } finally {
                            setDeleting(false);
                          }
                        })();
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
            <div className="border-t border-slate-100 p-2">
              {!showAdd ? (
                <button
                  type="button"
                  onClick={() => setShowAdd(true)}
                  className="inline-flex w-full items-center justify-center gap-1 rounded-lg px-2 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-50"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add status
                </button>
              ) : (
                <div className="flex flex-col gap-2">
                  <input
                    value={newStatus}
                    onChange={(e) => setNewStatus(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        void handleAdd();
                      }
                    }}
                    className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs text-slate-800 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    placeholder="Enter new status"
                    autoFocus
                  />
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => void handleAdd()}
                      disabled={saving}
                      className="rounded-lg bg-indigo-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
                    >
                      {saving ? 'Adding…' : 'Add'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowAdd(false);
                        setNewStatus('');
                      }}
                      className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
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
        className={`inline-flex max-w-[11rem] items-center gap-1 rounded-full border px-2 py-1 text-[11px] font-bold ${jobStatusPillClass(value)} hover:opacity-90`}
      >
        <span className="truncate">{value}</span>
        <ChevronDown size={12} className="shrink-0 opacity-70" />
      </button>
      {menu}
    </div>
  );
};

const PipelineSnapshot = ({
  applied,
  interviewed,
  offered,
  joined,
  stages,
  visibleStageKeys,
}: PipelineSnapshotProps) => {
  const filteredStages = filterPipelineStagesForColumns(stages, visibleStageKeys);
  const visibleStages =
    Array.isArray(filteredStages) && filteredStages.length > 0 ? filteredStages.slice(0, 8) : [];

  if (visibleStages.length === 0) {
    const legacyCounts = { applied, interviewed, offered, joined };
    // Empty visibleStageKeys = user hid every stage chip — show a dash, not all buckets.
    if (Array.isArray(visibleStageKeys) && visibleStageKeys.length === 0) {
      return <span className="text-xs text-slate-400">—</span>;
    }
    const legacyBuckets =
      visibleStageKeys && visibleStageKeys.length > 0
        ? LEGACY_PIPELINE_BUCKETS.filter((bucket) =>
            bucket.stageKeys.some((key) =>
              visibleStageKeys.some(
                (selected) => normalizePipelineStageKey(selected) === normalizePipelineStageKey(key),
              ),
            ),
          )
        : LEGACY_PIPELINE_BUCKETS;

    const bucketsToShow = legacyBuckets.length > 0 ? legacyBuckets : LEGACY_PIPELINE_BUCKETS;

    return (
      <div className="flex items-center gap-0 bg-gray-50 rounded-lg border border-gray-100 p-1">
        {bucketsToShow.map((bucket, index) => (
          <div
            key={bucket.key}
            className={`px-2 py-1 flex flex-col items-center min-w-[40px] ${
              index === bucketsToShow.length - 1 ? '' : 'border-r border-gray-200'
            }`}
          >
            <span className="text-[10px] text-gray-400 font-medium">{bucket.label}</span>
            <span className="text-xs font-bold text-gray-700">{legacyCounts[bucket.key]}</span>
          </div>
        ))}
      </div>
    );
  }

  // Some tenants don't yet move candidates into PipelineEntry rows (per-stage `count` will be 0
  // even when matches/interviews/placements are non-zero). Hydrate well-known buckets from the
  // legacy aggregate counts so the column never reads "0/0/0/0" while it's being adopted.
  const legacyByKey: Record<'applied' | 'interviewed' | 'offered' | 'joined', number> = {
    applied,
    interviewed,
    offered,
    joined,
  };

  return (
    <div className="flex items-center gap-0 bg-gray-50 rounded-lg border border-gray-100 p-1">
      {visibleStages.map((stage, index) => {
        let displayCount = stage.count;
        if (!displayCount) {
          const role = String(stage.systemRole || '').toUpperCase();
          const legacyKey = SYSTEM_ROLE_TO_LEGACY_KEY[role];
          if (legacyKey) {
            displayCount = legacyByKey[legacyKey] || 0;
          } else {
            const fallback = SYSTEM_ROLE_NAME_FALLBACK.find((entry) => entry.match.test(stage.name));
            if (fallback) displayCount = legacyByKey[fallback.key] || 0;
          }
        }
        const isLast = index === visibleStages.length - 1;
        return (
          <div
            key={stage.id}
            className={`px-2 py-1 flex flex-col items-center min-w-[40px] ${
              isLast ? '' : 'border-r border-gray-200'
            }`}
            title={stage.name}
          >
            <span className="text-[10px] text-gray-400 font-medium">{abbreviateStage(stage.name)}</span>
            <span className="text-xs font-bold text-gray-700">{displayCount}</span>
          </div>
        );
      })}
    </div>
  );
};

const JobsListView = ({
  jobs,
  onJobClick,
  onEditJob,
  onAddCandidate,
  onDeleteJob,
  deletingJobId,
  canUpdateJob,
  canDeleteJob,
  canAddCandidate,
  statusEdit,
  onStatusChange,
  onRemarkChange,
  onSaveStatusEdit,
  onCancelStatusEdit,
  statusOptions,
  onAppendStatusOption,
  onRemoveStatusOption,
  workspaceAlertsByEntityId,
  isColumnVisible = () => true,
  visiblePipelineStageKeys = null,
}: JobsListViewProps) => {
  const rows = Array.isArray(jobs) ? jobs.filter((job) => job && job.id) : [];
  const statusList = Array.isArray(statusOptions) ? statusOptions : [];
  const showAiAlertColumn = Boolean(
    workspaceAlertsByEntityId &&
      Object.values(workspaceAlertsByEntityId).some(
        (alerts) => Array.isArray(alerts) && alerts.length > 0,
      ),
  );
  const show = isColumnVisible;
  const { format: formatLocationCell } = useFormatTableLocationCell();
  const visibleColCount =
    2 + // title + actions always
    (show('select') ? 1 : 0) +
    (show('client') ? 1 : 0) +
    (show('status') ? 1 : 0) +
    (show('pipeline') ? 1 : 0) +
    (show('details') ? 1 : 0) +
    (show('location') ? 1 : 0) +
    (show('openings') ? 1 : 0) +
    (show('owner') ? 1 : 0) +
    (show('manager') ? 1 : 0) +
    (show('createdDate') ? 1 : 0) +
    (show('priority') ? 1 : 0) +
    (show('employmentType') ? 1 : 0) +
    (show('workMode') ? 1 : 0) +
    (show('jobLocationType') ? 1 : 0) +
    (show('hot') ? 1 : 0) +
    (show('aiMatch') ? 1 : 0) +
    (show('experienceRequired') ? 1 : 0) +
    (show('industry') ? 1 : 0) +
    (show('audit') ? 1 : 0) +
    (showAiAlertColumn ? 1 : 0);

  return (
  <div className={PH2_TABLE_BODY_SCROLL_CLASS}>
      <table className="w-max min-w-full text-left border-collapse">
        <thead className="sticky top-0 z-10">
          <tr className="border-b border-indigo-100 bg-gradient-to-r from-slate-50 via-indigo-50 to-violet-50 text-indigo-950/45 uppercase text-[9px] font-bold tracking-[0.12em]">
            {show('select') ? (
              <th className="px-3 py-2 sm:px-4 w-10 first:pl-4">
                <input type="checkbox" className="rounded border-slate-300" aria-label="Select all" />
              </th>
            ) : null}
            <th
              className="px-3 py-2 align-middle sm:px-4"
              style={{ width: '16rem', maxWidth: '20rem' }}
            >
              Job title
            </th>
            {show('client') ? <th className="px-3 py-2 sm:px-4">Client</th> : null}
            {show('status') ? <th className="px-3 py-2 sm:px-4">Status</th> : null}
            {show('pipeline') ? <th className="px-3 py-2 sm:px-4">Pipeline</th> : null}
            {show('details') ? <th className="px-3 py-2 sm:px-4">Details</th> : null}
            {show('location') ? <th className="px-3 py-2 sm:px-4">Location</th> : null}
            {show('openings') ? <th className="px-3 py-2 sm:px-4">Openings</th> : null}
            {show('owner') ? <th className="px-3 py-2 sm:px-4">Recruiter</th> : null}
            {show('manager') ? <th className="px-3 py-2 sm:px-4">Manager</th> : null}
            {show('createdDate') ? <th className="px-3 py-2 sm:px-4">Created</th> : null}
            {show('priority') ? <th className="px-3 py-2 sm:px-4">Priority</th> : null}
            {show('employmentType') ? <th className="px-3 py-2 sm:px-4">Employment type</th> : null}
            {show('workMode') ? <th className="px-3 py-2 sm:px-4">Work mode</th> : null}
            {show('jobLocationType') ? <th className="px-3 py-2 sm:px-4">Location type</th> : null}
            {show('hot') ? <th className="px-3 py-2 sm:px-4">Hot</th> : null}
            {show('aiMatch') ? <th className="px-3 py-2 sm:px-4">AI match</th> : null}
            {show('experienceRequired') ? <th className="px-3 py-2 sm:px-4">Experience required</th> : null}
            {show('industry') ? <th className="px-3 py-2 sm:px-4">Category</th> : null}
            {showAiAlertColumn ? <WorkspaceAlertTableHeader /> : null}
            {show('audit') ? <TableAuditColumnHeader /> : null}
            <th className="px-3 py-2 sm:px-4 text-right">Actions</th>
        </tr>
      </thead>
        <tbody className="divide-y divide-slate-100/80">
          {rows.length === 0 ? (
            <tr>
              <td colSpan={visibleColCount} className="px-4 py-12 text-center">
                <p className="text-xs font-medium text-slate-500">No jobs match your filters</p>
                <p className="mt-1 text-[11px] text-slate-400">Try adjusting search or clear filters</p>
              </td>
            </tr>
          ) : (
            rows.map((job) => (
          <tr
            key={job.id}
                className="group transition-colors duration-200 even:bg-slate-50/35 hover:bg-indigo-50/45"
          >
                {show('select') ? (
                  <td className="px-3 py-2 sm:px-4" onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" className="rounded border-slate-300" aria-label={`Select ${job.title}`} />
                  </td>
                ) : null}
                <td className="align-middle px-3 py-2 sm:px-4" style={{ width: '16rem', maxWidth: '20rem' }}>
              <div className="flex w-full max-w-[20rem] flex-col justify-center">
                <div className="flex w-full items-start gap-2">
                  <button
                    type="button"
                    onClick={() => onJobClick?.(job)}
                        className="min-w-0 flex-1 text-left text-xs font-semibold leading-snug text-slate-900 line-clamp-3 whitespace-normal break-words [overflow-wrap:anywhere] hover:text-indigo-700 transition-colors"
                    title={job.title}
                  >
                    {job.title}
                  </button>
                  <div className="flex shrink-0 items-center gap-1 pt-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <FileText size={14} className="text-slate-400 cursor-default" />
                        <BrainCircuit size={14} className="text-violet-500 hover:text-violet-700 cursor-pointer" />
                  </div>
                </div>
              </div>
            </td>
                {show('client') ? (
                  <td className="px-3 py-2 sm:px-4">
                    <span className="text-xs font-medium text-slate-800 line-clamp-2">{job.client}</span>
                  </td>
                ) : null}
                {show('status') ? (
                <td className="px-3 py-2 sm:px-4" onClick={(e) => e.stopPropagation()}>
              <div className="flex flex-col gap-2">
                {canUpdateJob ? (
                  <JobStatusTableDropdown
                    value={job.status}
                    options={filterJobStatusOptionsForCurrent(statusList, job.status)}
                    onSelect={(status) => onStatusChange(job.id, status)}
                    onAppend={onAppendStatusOption}
                    onRemove={onRemoveStatusOption}
                  />
                ) : (
                  <JobStatusPill status={job.status} />
                )}

                {canUpdateJob && statusEdit.jobId === job.id && (
                      <div className="flex flex-wrap items-center gap-2">
                    <input
                      type="text"
                          placeholder="Remark for status change"
                          className="min-w-0 flex-1 px-2 py-1 text-xs border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-400"
                      value={statusEdit.remark}
                      onChange={(e) => onRemarkChange(e.target.value)}
                    />
                    <button
                      type="button"
                          className="px-2 py-1 text-xs font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700"
                      onClick={onSaveStatusEdit}
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      className="px-2 py-1 text-xs font-medium text-slate-600 bg-slate-100 rounded-md hover:bg-slate-200"
                      onClick={onCancelStatusEdit}
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            </td>
                ) : null}
                {show('pipeline') ? (
                <td className="px-3 py-2 sm:px-4">
              <PipelineSnapshot
                applied={job.applied}
                interviewed={job.interviewed}
                offered={job.offered}
                joined={job.joined}
                stages={job.pipelineStages}
                visibleStageKeys={visiblePipelineStageKeys}
              />
            </td>
                ) : null}
                {show('details') ? (
                <td className="px-3 py-2 sm:px-4">
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Recruiter</span>
                    <AssigneeAvatars assignees={job.recruiterAssignees || []} />
                    <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Manager</span>
                    <span className="text-xs text-slate-700">{job.managerName || '—'}</span>
                    <span className="text-[10px] text-slate-500">{formatDateDMY(job.createdDate)}</span>
              </div>
            </td>
                ) : null}
                {show('location') ? (
                  <td className="px-3 py-2 sm:px-4">
                    <span className="max-w-[120px] truncate text-xs text-slate-700">
                      {formatLocationCell({
                        location: job.location,
                        country: job.country,
                        city: job.city,
                        state: (job as { state?: string }).state,
                      })}
                    </span>
                  </td>
                ) : null}
                {show('openings') ? (
                  <td className="px-3 py-2 sm:px-4">
                    <span className="text-xs font-semibold tabular-nums text-slate-700">
                      {job.openings != null ? job.openings : '—'}
                    </span>
                  </td>
                ) : null}
                {show('owner') ? (
                  <td className="px-3 py-2 sm:px-4">
                    <AssigneeAvatars assignees={job.recruiterAssignees || []} />
                  </td>
                ) : null}
                {show('manager') ? (
                  <td className="px-3 py-2 sm:px-4">
                    <span className="max-w-[100px] truncate text-xs text-slate-700">{job.managerName || '—'}</span>
                  </td>
                ) : null}
                {show('createdDate') ? (
                  <td className="px-3 py-2 sm:px-4">
                    <span className="whitespace-nowrap text-xs text-slate-600">
                      {formatDateDMY(job.createdDate) || '—'}
                    </span>
                  </td>
                ) : null}
                {show('priority') ? (
                  <td className="px-3 py-2 sm:px-4">
                    <span className="text-xs text-slate-700">{job.priority || '—'}</span>
                  </td>
                ) : null}
                {show('employmentType') ? (
                  <td className="px-3 py-2 sm:px-4">
                    <span className="text-xs text-slate-700">{job.employmentType || '—'}</span>
                  </td>
                ) : null}
                {show('workMode') ? (
                  <td className="px-3 py-2 sm:px-4">
                    <span className="text-xs text-slate-700">{job.workMode || '—'}</span>
                  </td>
                ) : null}
                {show('jobLocationType') ? (
                  <td className="px-3 py-2 sm:px-4">
                    <span className="text-xs text-slate-700">{job.jobLocationType || '—'}</span>
                  </td>
                ) : null}
                {show('hot') ? (
                  <td className="px-3 py-2 sm:px-4">
                    <span className="text-xs text-slate-700">{job.hot ? 'Yes' : 'No'}</span>
                  </td>
                ) : null}
                {show('aiMatch') ? (
                  <td className="px-3 py-2 sm:px-4">
                    <span className="text-xs tabular-nums text-slate-700">
                      {job.aiMatchCount ?? (job.aiMatch ? 'Yes' : '—')}
                    </span>
                  </td>
                ) : null}
                {show('experienceRequired') ? (
                  <td className="px-3 py-2 sm:px-4">
                    <span className="text-xs text-slate-700">{job.experienceRequired || '—'}</span>
                  </td>
                ) : null}
                {show('industry') ? (
                  <td className="px-3 py-2 sm:px-4">
                    <span className="max-w-[120px] truncate text-xs text-slate-700">{job.industry || '—'}</span>
                  </td>
                ) : null}
                {showAiAlertColumn ? (
                  <td className="px-3 py-2 sm:px-4">
                    <WorkspaceAlertTableCell alerts={workspaceAlertsByEntityId?.[job.id]} />
                  </td>
                ) : null}
                {show('audit') ? <TableAuditCell audit={job.auditMeta} /> : null}
                <td className="px-3 py-2 sm:px-4 text-right" onClick={(e) => e.stopPropagation()}>
                  <div className="inline-flex items-center justify-end gap-0.5 rounded-2xl bg-slate-100/70 p-0.5 ring-1 ring-slate-200/60">
                {SHOW_TABLE_ROW_EDIT_ICON ? (
                  <button
                    type="button"
                    onClick={() => onEditJob?.(job)}
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-amber-600 hover:bg-white hover:text-amber-800 hover:shadow-sm transition-all"
                    title="Edit job"
                  >
                    <Pencil size={15} strokeWidth={2.25} />
                  </button>
                ) : null}
                {canAddCandidate && (
                  <button
                    type="button"
                    onClick={() => onAddCandidate?.(job)}
                        className="flex h-7 w-7 items-center justify-center rounded-lg text-emerald-600 hover:bg-white hover:text-emerald-800 hover:shadow-sm transition-all"
                        title="Add candidate"
                  >
                        <UserPlus size={15} strokeWidth={2.35} />
                  </button>
                )}
                {canDeleteJob && onDeleteJob && (
                  <button 
                    type="button"
                    onClick={async (e) => {
                      e.stopPropagation();
                      await onDeleteJob(job.id, job.title);
                    }}
                    disabled={deletingJobId === job.id}
                        className="flex h-7 w-7 items-center justify-center rounded-lg text-rose-500 hover:bg-white hover:text-rose-800 hover:shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Delete job"
                  >
                        <Trash2 size={15} strokeWidth={2.35} />
                  </button>
                )}
              </div>
            </td>
          </tr>
            ))
          )}
      </tbody>
    </table>
  </div>
  );
};


export function JobListPage() {
  const {
    router,
    pathname,
    searchParams,
    hasPermission,
    hasAnyPermission,
    canCreateJob,
    canUpdateJob,
    canDeleteJob,
    canAddCandidate,
    canCreateInterview,
    canUpdateCandidate,
    jobAiGate,
    searchFilter,
    setSearchFilter,
    debouncedSearchFilter,
    jobsRequestGate,
    jobsRequestGateRef,
    jobTableColumnsFlat,
    jobColumnVisibility,
    storedPipelineStageIds,
    setStoredPipelineStageIds,
    pipelineStagePrefsSaved,
    setPipelineStagePrefsSaved,
    effectivePipelineStageIds,
    visiblePipelineStageKeys,
    isJobColumnVisible,
    toggleJobColumn,
    resetJobColumns,
    statusFilter,
    setStatusFilter,
    clientFilterId,
    setClientFilterId,
    recruiterFilterId,
    setRecruiterFilterId,
    isStandaloneMode,
    setIsStandaloneMode,
    workspaceClientId,
    setWorkspaceClientId,
    smartSearchJobIds,
    setSmartSearchJobIds,
    clientOptions,
    setClientOptions,
    recruiterOptions,
    setRecruiterOptions,
    createTaskOpen,
    setCreateTaskOpen,
    createJobDrawerOpen,
    setCreateJobDrawerOpen,
    jobAiWizardOpen,
    setJobAiWizardOpen,
    createJobMode,
    setCreateJobMode,
    recycleBinDrawerOpen,
    setRecycleBinDrawerOpen,
    showSummaryCards,
    setShowSummaryCards,
    duplicateFromJobId,
    setDuplicateFromJobId,
    addCandidateDrawerOpen,
    setAddCandidateDrawerOpen,
    addCandidateChooserOpen,
    setAddCandidateChooserOpen,
    poolPickerOpen,
    setPoolPickerOpen,
    poolCandidates,
    setPoolCandidates,
    poolLoading,
    setPoolLoading,
    poolSearch,
    setPoolSearch,
    poolAddingId,
    setPoolAddingId,
    selectedJobForCandidate,
    setSelectedJobForCandidate,
    currentUserForCandidateDrawer,
    setCurrentUserForCandidateDrawer,
    jobDrawerOpen,
    setJobDrawerOpen,
    selectedJob,
    setSelectedJob,
    pendingDeepLinkJobIdRef,
    currentPage,
    setCurrentPage,
    pageSize,
    setPageSize,
    jobs,
    setJobs,
    loading,
    setLoading,
    error,
    setError,
    jobCandidates,
    setJobCandidates,
    candidateProfileDrawerOpen,
    setCandidateProfileDrawerOpen,
    selectedCandidateProfile,
    setSelectedCandidateProfile,
    candidateDrawerMode,
    setCandidateDrawerMode,
    candidateEditOpenToken,
    setCandidateEditOpenToken,
    loadingCandidateProfile,
    setLoadingCandidateProfile,
    availableDrawerTags,
    setAvailableDrawerTags,
    scheduleInterviewOpen,
    setScheduleInterviewOpen,
    schedulePrefill,
    setSchedulePrefill,
    scheduleBulkCandidateIds,
    setScheduleBulkCandidateIds,
    scheduleInterviewers,
    setScheduleInterviewers,
    pendingStageAfterInterview,
    setPendingStageAfterInterview,
    pendingStageAfterPlacement,
    setPendingStageAfterPlacement,
    placementDrawerOpen,
    setPlacementDrawerOpen,
    placementSubmitting,
    setPlacementSubmitting,
    placementPrefill,
    setPlacementPrefill,
    statusEdit,
    setStatusEdit,
    jobStatusOptions,
    setJobStatusOptions,
    totalEntries,
    setTotalEntries,
    hasVisibleJobsRef,
    cloneDrawerTimerRef,
    jobSmartSearch,
    displayJobs,
    hasActiveFilters,
    handleClearToolbar,
    exportModalOpen,
    setExportModalOpen,
    exportJobs,
    setExportJobs,
    exportJobsLoading,
    setExportJobsLoading,
    fetchAllJobsForExport,
    openExportModal,
    handleExportJobsCsv,
    buildJobsQueryParams,
    loadJobsPageData,
    workspaceAlertsByEntityId,
    loadingJobDetails,
    setLoadingJobDetails,
    jobDetails,
    setJobDetails,
    jobPipelineStages,
    setJobPipelineStages,
    editJobDrawerOpen,
    setEditJobDrawerOpen,
    editingJobId,
    setEditingJobId,
    jobMetrics,
    setJobMetrics,
    loadingMetrics,
    setLoadingMetrics,
    deletingJobId,
    setDeletingJobId,
    reloadMyJobsAndMetrics,
    handleDeleteJob,
    fetchJobCandidates,
    hydrateJobDetailsFromBackend,
    refreshJobDetails,
    openJobDrawer,
    persistJobPipelineStages,
    refreshJobCandidates,
    activeJobForCandidateDrawer,
    candidateDrawerJobs,
    candidateDrawerInterviewers,
    candidateDrawerCurrentUser,
    loadCandidateProfileInJobContext,
    openJobDrawerCandidateView,
    openJobDrawerCandidateEdit,
    scheduleModalJobs,
    schedulePopupCandidate,
    openScheduleInterviewFromJob,
    closeScheduleInterviewFromJob,
    openPlacementFromJob,
    handleJobDrawerScheduleInterview,
    handleAppendJobStatusOption,
    handleRemoveJobStatusOption,
    handleInlineStatusChange,
    handleRemarkChange,
    handleSaveStatusEdit,
    handleCancelStatusEdit,
    handleAddCandidateForJob,
    loadPoolCandidates,
    handleSelectFromPool,
    handleCloneJob,
    handlePublishJob,
    handleCloseJob,
  } = useJobList();

  return (
    <>
      <Toaster position="top-right" richColors />
      <Ph2ModulePageLayout
        title="Jobs"
        icon={<Briefcase className="h-5 w-5" strokeWidth={2.2} />}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <ShowSummaryCardsButton
              open={showSummaryCards}
              onToggle={() => setShowSummaryCards((open) => !open)}
            />
                  <button
                    type="button"
              onClick={() => void reloadMyJobsAndMetrics()}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-indigo-200/80 bg-white text-indigo-700 shadow-[0_4px_14px_-4px_rgba(99,102,241,0.2)] transition-all hover:border-indigo-300 hover:bg-indigo-50/90 active:scale-[0.98]"
              title="Refresh jobs"
                  >
              <RefreshCcw size={16} strokeWidth={2.25} className="shrink-0" />
                  </button>
            {canDeleteJob ? (
                  <button
                    type="button"
                onClick={() => setRecycleBinDrawerOpen(true)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-indigo-200/80 bg-white text-indigo-700 shadow-[0_4px_14px_-4px_rgba(99,102,241,0.2)] transition-all hover:border-indigo-300 hover:bg-indigo-50/90 active:scale-[0.98]"
                title="Deleted jobs"
                  >
                <Inbox size={17} strokeWidth={2.25} />
                  </button>
            ) : null}
                <button
                  type="button"
                  onClick={() => void openExportModal()}
              className="bg-white hover:bg-indigo-50/90 text-indigo-900 px-3 py-2 rounded-lg font-semibold text-xs flex items-center gap-1.5 transition-all shadow-[0_4px_14px_-4px_rgba(99,102,241,0.25)] border border-indigo-200/70 hover:border-indigo-300 hover:shadow-[0_6px_20px_-4px_rgba(99,102,241,0.35)] active:scale-[0.98]"
                  title="Export visible jobs to CSV"
                >
              <Download size={16} className="text-indigo-600" strokeWidth={2.25} />
              <span>Export</span>
                </button>
            {canCreateJob ? (
              <div
                role="group"
                aria-label="Create job"
                className="inline-flex items-center rounded-lg border border-slate-200/90 bg-slate-100/90 p-0.5 shadow-[0_4px_14px_-4px_rgba(99,102,241,0.18)]"
              >
                <button
                  type="button"
                  aria-pressed={createJobMode === 'ai'}
                  onClick={() => {
                    if (jobAiGate.locked) {
                      void jobAiGate.confirmAndUnlock();
                      return;
                    }
                    setCreateJobMode('ai');
                    setDuplicateFromJobId(null);
                    setCreateJobDrawerOpen(false);
                    setJobAiWizardOpen(true);
                  }}
                  className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${
                    jobAiGate.locked
                      ? 'text-amber-800 hover:bg-amber-50'
                      : createJobMode === 'ai'
                        ? 'bg-white text-violet-800 shadow-sm ring-1 ring-violet-200/70'
                        : 'text-slate-500 hover:bg-white/60 hover:text-violet-700'
                  }`}
                  title={
                    jobAiGate.locked
                      ? `Locked — needs ${jobAiGate.cost} coins (you have ${jobAiGate.coins})`
                      : `Create a job with AI (${jobAiGate.cost} coins when you generate)`
                  }
                >
                  {jobAiGate.locked ? (
                    <Lock size={14} className="text-amber-600" strokeWidth={2.25} />
                  ) : (
                    <Sparkles size={14} className="text-violet-600" strokeWidth={2.25} />
                  )}
                  <span>Create with AI</span>
                  <AiCoinLockBadge featureId="ai.job_from_prompt" />
                </button>
                <button
                  type="button"
                  aria-pressed={createJobMode === 'manual'}
                  onClick={() => {
                    setCreateJobMode('manual');
                    setDuplicateFromJobId(null);
                    setCreateJobDrawerOpen(false);
                    setJobAiWizardOpen(true);
                  }}
                  className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${
                    createJobMode === 'manual'
                      ? 'bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 text-white shadow-sm'
                      : 'text-slate-500 hover:bg-white/60 hover:text-indigo-700'
                  }`}
                  title="Create a job manually"
                >
                  <Plus
                    size={14}
                    className={createJobMode === 'manual' ? 'text-white' : 'text-indigo-500'}
                    strokeWidth={2.5}
                  />
                  <span>Create Manually</span>
                </button>
              </div>
            ) : null}
              </div>
        }
      >
        <div className="mx-auto flex min-h-0 w-full max-w-[1600px] flex-1 flex-col overflow-hidden">
          {showSummaryCards ? (
          <div className={PH2_KPI_ROW_CLASS}>
            {loadingMetrics
              ? STATS_CONFIG.map((statConfig, i) => <SummaryCardSkeleton key={i} color={statConfig.color} />)
              : STATS_CONFIG.map((statConfig) => {
                const value = jobMetrics ? (jobMetrics as any)[statConfig.key] || 0 : 0;
                const StatIcon = statConfig.icon;
                return (
                    <SummaryCard
                      key={statConfig.key}
                      label={statConfig.label}
                      count={value}
                      color={statConfig.color}
                      icon={<StatIcon size={16} strokeWidth={2.35} />}
                    />
                );
              })}
            </div>
          ) : null}

          {loading ? (
              <div className={PH2_TABLE_CARD_CLASS}>
                <div className={PH2_TOOLBAR_ROW_CLASS}>
                  <div className="h-9 w-full max-w-md animate-pulse rounded-xl bg-white/80 ring-1 ring-indigo-100/80 lg:flex-1" />
                  <div className="h-9 w-32 animate-pulse rounded-lg bg-indigo-50/60" />
                </div>
                <div className={PH2_TABLE_BODY_SCROLL_CLASS}>
                  <TableSkeleton rows={8} columns={7} />
                </div>
              </div>
          ) : (
            <div className={PH2_TABLE_CARD_CLASS}>
              <div className={PH2_TOOLBAR_ROW_CLASS}>
                <div className="relative w-44 shrink-0 sm:w-52">
                  <Search
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-indigo-400"
                    size={16}
                    strokeWidth={2.25}
                  />
                  <input
                    type="text"
                    placeholder="Search jobs, client, location…"
                    value={searchFilter}
                    onChange={(e) => {
                      setSearchFilter(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="h-9 w-full rounded-xl border border-indigo-100/90 bg-white/95 pl-10 pr-3 text-xs text-slate-800 shadow-[inset_0_1px_2px_rgba(15,23,42,0.04)] placeholder:text-slate-400 transition-all focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                  />
                </div>
                <div className={PH2_TOOLBAR_FILTERS_CLASS}>
                  <SmartSearchToggleButton
                    open={jobSmartSearch.open}
                    onToggle={() => jobSmartSearch.setOpen((value) => !value)}
                  />
                  <SearchableToolbarFilterSelect
                    value={statusFilter}
                    onChange={(next) => {
                      setStatusFilter(next);
                      setCurrentPage(1);
                    }}
                    options={[
                      { value: 'OPEN', label: 'Active (open)' },
                      { value: 'ON_HOLD', label: 'On hold' },
                      { value: 'DRAFT', label: 'Draft' },
                      { value: 'CLOSED', label: 'Closed / not won' },
                      { value: 'FILLED', label: 'Closed Won' },
                    ]}
                    placeholder="Active list"
                    allLabel="Active list"
                    className="w-[9.5rem]"
                    ariaLabel="Filter by status"
                    searchPlaceholder="Search status…"
                  />
                  {!isStandaloneMode ? (
                    <SearchableToolbarFilterSelect
                      value={clientFilterId}
                      onChange={(next) => {
                        setClientFilterId(next);
                        setCurrentPage(1);
                      }}
                      options={clientOptions.map((client) => ({
                        value: client.id,
                        label: client.name,
                        searchText: client.id,
                      }))}
                      placeholder="All Recruitment Clients"
                      allLabel="All Recruitment Clients"
                      dedupeNormalizedLabels
                      className="w-[10rem] max-w-[12rem]"
                      ariaLabel="Filter by client"
                      searchPlaceholder="Search clients…"
                    />
                  ) : null}
                  <SearchableToolbarFilterSelect
                    value={recruiterFilterId}
                    onChange={(next) => {
                      setRecruiterFilterId(next);
                      setCurrentPage(1);
                    }}
                    options={recruiterOptions.map((recruiter) => ({
                      value: recruiter.id,
                      label: recruiter.name,
                      searchText: recruiter.id,
                    }))}
                    placeholder="All team members"
                    allLabel="All team members"
                    className="w-[10.5rem] max-w-[13rem]"
                    ariaLabel="Filter by team member"
                    searchPlaceholder="Search team members…"
                  />
                  <TableColumnsMenu
                    columns={JOB_TABLE_COLUMNS}
                    isVisible={isJobColumnVisible}
                    onToggle={toggleJobColumn}
                    onReset={resetJobColumns}
                    unlockedVisibleCount={jobColumnVisibility.unlockedVisibleCount}
                  />
                  <button
                    type="button"
                    className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-semibold text-rose-600 transition-colors hover:bg-rose-50 hover:text-rose-700"
                    onClick={handleClearToolbar}
                  >
                    <XCircle size={15} className="shrink-0 text-rose-500" strokeWidth={2.35} />
                    Clear
                  </button>
                </div>
              </div>

              {jobSmartSearch.open ? (
                <SmartSearchPromptPanel
                  prompt={jobSmartSearch.prompt}
                  onPromptChange={jobSmartSearch.setPrompt}
                  onApply={jobSmartSearch.handleApply}
                  previewKeywords={jobSmartSearch.previewKeywords}
                  examples={jobSmartSearch.examples}
                  onExampleClick={jobSmartSearch.handleExample}
                  entityLabel="jobs"
                  applying={jobSmartSearch.applying}
                  placeholder="e.g. open React jobs in Bengaluru for QuantumByte with high priority"
                />
              ) : null}

              <SmartSearchActiveKeywordsBar
                chips={jobSmartSearch.activeChips}
                onClearAll={handleClearToolbar}
                resultCount={displayJobs.length}
                showResultCount={!loading && !error}
              />

              {error ? (
                <div className="p-10 text-center text-sm font-medium text-rose-600">Error: {error}</div>
              ) : (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.22 }}
                  className="flex min-h-0 flex-1 flex-col overflow-hidden"
                >
                    <PageErrorBoundary>
                    <JobsListView
                      jobs={displayJobs}
                      onJobClick={openJobDrawer}
                      onEditJob={
                        canUpdateJob
                          ? (job) => {
                              setEditingJobId(job.id);
                              setEditJobDrawerOpen(true);
                            }
                          : undefined
                      }
                      onAddCandidate={handleAddCandidateForJob}
                      onDeleteJob={canDeleteJob ? handleDeleteJob : undefined}
                      deletingJobId={deletingJobId}
                      canUpdateJob={canUpdateJob}
                      canDeleteJob={canDeleteJob}
                      canAddCandidate={canAddCandidate}
                      statusEdit={statusEdit}
                      onStatusChange={handleInlineStatusChange}
                      onRemarkChange={handleRemarkChange}
                      onSaveStatusEdit={handleSaveStatusEdit}
                      onCancelStatusEdit={handleCancelStatusEdit}
                      statusOptions={jobStatusOptions}
                      onAppendStatusOption={handleAppendJobStatusOption}
                      onRemoveStatusOption={handleRemoveJobStatusOption}
                      workspaceAlertsByEntityId={workspaceAlertsByEntityId}
                      isColumnVisible={jobColumnVisibility.isVisible}
                      visiblePipelineStageKeys={visiblePipelineStageKeys}
                    />
                    </PageErrorBoundary>
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
                      itemLabel="jobs"
                      onPageChange={setCurrentPage}
                    />
                  </div>
                </motion.div>
              )}
            </div>
          )}
        </div>
      </Ph2ModulePageLayout>

      {canCreateJob && createJobDrawerOpen ? (
      <CreateJobDrawer
        isOpen
        duplicateFromJobId={duplicateFromJobId}
        onClose={() => {
          setCreateJobDrawerOpen(false);
          setDuplicateFromJobId(null);
        }}
        onJobCreated={() => {
          setCreateJobDrawerOpen(false);
          setDuplicateFromJobId(null);
          void reloadMyJobsAndMetrics();
        }}
      />
      ) : null}

      {canCreateJob && jobAiWizardOpen ? (
      <JobAiCreateWizard
        isOpen
        mode={createJobMode}
        onClose={() => setJobAiWizardOpen(false)}
        onJobCreated={() => {
          setJobAiWizardOpen(false);
          toast.success('Job published');
          void reloadMyJobsAndMetrics();
        }}
      />
      ) : null}

      {jobDrawerOpen ? (
      <JobDetailsDrawer
        isOpen
        onClose={() => {
          setJobDrawerOpen(false);
          setSelectedJob(null);
          setJobDetails(null);
          setJobPipelineStages([]);
          setJobCandidates([]);
          setScheduleInterviewOpen(false);
          setSchedulePrefill(null);
          setPendingStageAfterInterview(null);
          if (searchParams.get('jobId')) {
            const sp = new URLSearchParams(searchParams.toString());
            sp.delete('jobId');
            pendingDeepLinkJobIdRef.current = null;
            const qs = sp.toString();
            router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
          }
        }}
        job={jobDetails || (selectedJob ? toJobForDrawer(selectedJob) : null)}
        jobCandidates={jobCandidates}
        onJobCandidatesChange={setJobCandidates}
        canAddCandidate={canAddCandidate}
        pipelineStages={jobPipelineStages}
        onPipelineStagesChange={(stages) => {
          setJobPipelineStages(stages);
        }}
        onSavePipelineStages={(stages) => {
          const jobId = (jobDetails || (selectedJob ? toJobForDrawer(selectedJob) : null))?.id;
          if (jobId) persistJobPipelineStages(jobId, stages);
        }}
        onEdit={canUpdateJob ? (job) => {
          setEditingJobId(job.id);
          setEditJobDrawerOpen(true);
        } : undefined}
        onPublish={canUpdateJob ? handlePublishJob : undefined}
        onClone={canCreateJob ? handleCloneJob : undefined}
        onCloseJob={canUpdateJob ? handleCloseJob : undefined}
        onAddToPipeline={
          canUpdateCandidate
            ? async ({ candidateId, jobId, stage, recruiterId, priority, notes }) => {
                await apiAddCandidateToPipeline(candidateId, {
                  jobId,
                  stage,
                  recruiterId,
                  priority,
                  notes,
                });
                if (typeof window !== 'undefined') {
                  window.dispatchEvent(new CustomEvent('jobportal:candidates-changed'));
                }
                const activeJobId =
                  jobDetails?.id || (selectedJob ? toJobForDrawer(selectedJob) : null)?.id;
                if (activeJobId) {
                  await refreshJobCandidates(activeJobId);
                }
              }
            : undefined
        }
        onRemoveFromPipeline={
          canUpdateCandidate
            ? async ({ candidateId, jobId }) => {
                await apiRemoveCandidateFromPipeline(candidateId, jobId);
                const activeJobId =
                  jobDetails?.id || (selectedJob ? toJobForDrawer(selectedJob) : null)?.id;
                if (activeJobId) {
                  await refreshJobCandidates(activeJobId);
                }
              }
            : undefined
        }
        pipelineRecruiters={[]}
        onScheduleInterview={canCreateInterview ? openScheduleInterviewFromJob : undefined}
        onCreatePlacement={openPlacementFromJob}
        onRejectCandidate={canUpdateJob ? (candidateId, jobId) => { /* TODO: reject candidate */ } : undefined}
        onViewCandidateProfile={openJobDrawerCandidateView}
        onEditCandidate={canUpdateCandidate ? openJobDrawerCandidateEdit : undefined}
        onStatusUpdated={(jobId, status) => {
          setJobStatusOptions((current) => mergeJobStatusOptions(current, status));
          if (isArchivedFromJobsList(status)) {
            setJobs((prev) => prev.filter((j) => j.id !== jobId));
            setSelectedJob((prev) => (prev && prev.id === jobId ? null : prev));
            setJobDetails((prev) => (prev && prev.id === jobId ? null : prev));
            setJobDrawerOpen(false);
            toast.success(`Job marked "${status}" and removed from the active list.`);
            return;
          }
          setJobs((prev) => prev.map((j) => (j.id === jobId ? { ...j, status } : j)));
          setJobDetails((prev) => (prev && prev.id === jobId ? { ...prev, status } : prev));
          setSelectedJob((prev) => (prev && prev.id === jobId ? { ...prev, status } : prev));
        }}
        onAssignmentUpdated={async (jobId) => {
          await refreshJobDetails(jobId);
          void reloadMyJobsAndMetrics();
        }}
      />
      ) : null}

      {candidateProfileDrawerOpen ? (
      <CandidateProfileDrawer
        key={`${selectedCandidateProfile?.id || 'job-candidate'}-${candidateDrawerMode}`}
        isOpen
        stackAboveSiblingDrawers
        currentUser={candidateDrawerCurrentUser}
        availableTags={availableDrawerTags}
        jobs={candidateDrawerJobs}
        recruiters={[]}
        interviewers={candidateDrawerInterviewers}
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
          setCandidateProfileDrawerOpen(false);
          setSelectedCandidateProfile(null);
          setCandidateDrawerMode('view');
          setCandidateEditOpenToken(null);
        }}
        onRejectCandidate={
          canUpdateCandidate
            ? async (reason, feedback, sendEmail, showFeedbackToCandidate, jobId) => {
                if (!selectedCandidateProfile) return;
                await apiRejectCandidate(selectedCandidateProfile.id, {
                  reason,
                  feedback,
                  sendEmail,
                  showFeedbackToCandidate,
                  jobId:
                    jobId ||
                    selectedCandidateProfile.assignedJobId ||
                    activeJobForCandidateDrawer?.id,
                });
                await loadCandidateProfileInJobContext(selectedCandidateProfile.id);
                if (activeJobForCandidateDrawer?.id) {
                  await refreshJobCandidates(activeJobForCandidateDrawer.id);
                }
              }
            : undefined
        }
        onScheduleInterview={
          canUpdateCandidate
            ? async (interviewData) => {
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
                if (
                  String(interviewData.id || '').length >= 12 &&
                  String(interviewData.id || '').includes('interview-') === false
                ) {
                  await apiUpdateCandidateInterview(interviewData.candidateId, interviewData.id, payload);
                  toast.success('Interview updated successfully');
                } else {
                  await apiScheduleCandidateInterview(interviewData.candidateId, payload as any);
                  toast.success('Interview scheduled successfully');
                }
                emitNotificationsUpdated();
                await loadCandidateProfileInJobContext(interviewData.candidateId);
                if (activeJobForCandidateDrawer?.id) {
                  await refreshJobCandidates(activeJobForCandidateDrawer.id);
                }
              }
            : undefined
        }
        onAddNote={
          canUpdateCandidate
            ? async (candidateId, note) => {
                await apiAddCandidateNote(candidateId, note);
                await loadCandidateProfileInJobContext(candidateId);
              }
            : undefined
        }
        onEditNote={
          canUpdateCandidate
            ? async (candidateId, noteId, updatedNote) => {
                await apiUpdateCandidateNote(candidateId, noteId, updatedNote);
                await loadCandidateProfileInJobContext(candidateId);
              }
            : undefined
        }
        onDeleteNote={
          canUpdateCandidate
            ? async (candidateId, noteId) => {
                await apiDeleteCandidateNote(candidateId, noteId);
                await loadCandidateProfileInJobContext(candidateId);
              }
            : undefined
        }
        onPinNote={
          canUpdateCandidate
            ? async (candidateId, noteId, isPinned) => {
                await apiPinCandidateNote(candidateId, noteId, isPinned);
                await loadCandidateProfileInJobContext(candidateId);
              }
            : undefined
        }
        onAddTag={
          canUpdateCandidate
            ? async (candidateId, tag) => {
                await apiAddCandidateTag(candidateId, tag);
                await loadCandidateProfileInJobContext(candidateId);
              }
            : undefined
        }
        onRemoveTag={
          canUpdateCandidate
            ? async (candidateId, tagId) => {
                await apiRemoveCandidateTag(candidateId, tagId);
                await loadCandidateProfileInJobContext(candidateId);
              }
            : undefined
        }
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
        onAddToPipeline={
          canUpdateCandidate
            ? async ({ candidateId, jobId, stage, recruiterId, priority, notes }) => {
                await apiAddCandidateToPipeline(candidateId, {
                  jobId,
                  stage,
                  recruiterId,
                  priority,
                  notes,
                });
                if (typeof window !== 'undefined') {
                  window.dispatchEvent(new CustomEvent('jobportal:candidates-changed'));
                }
                await loadCandidateProfileInJobContext(candidateId);
                if (activeJobForCandidateDrawer?.id) {
                  await refreshJobCandidates(activeJobForCandidateDrawer.id);
                }
              }
            : undefined
        }
        onRemoveFromPipeline={
          canUpdateCandidate
            ? async ({ candidateId, jobId }) => {
                await apiRemoveCandidateFromPipeline(candidateId, jobId);
                await loadCandidateProfileInJobContext(candidateId);
                if (activeJobForCandidateDrawer?.id) {
                  await refreshJobCandidates(activeJobForCandidateDrawer.id);
                }
              }
            : undefined
        }
        onUpdateCandidate={
          canUpdateCandidate
            ? async (candidateId, payload) => {
                const response = await apiUpdateCandidate(candidateId, payload);
                const updated = extractApiData<BackendCandidate>(response);
                if (updated) {
                  let profile = mapCandidateProfile(updated);
                  if (activeJobForCandidateDrawer) {
                    profile = {
                      ...profile,
                      assignedJobId: activeJobForCandidateDrawer.id,
                      assignedJob: activeJobForCandidateDrawer.title,
                    };
                  }
                  setSelectedCandidateProfile(profile);
                }
                await loadCandidateProfileInJobContext(candidateId);
                if (activeJobForCandidateDrawer?.id) {
                  await refreshJobCandidates(activeJobForCandidateDrawer.id);
                }
              }
            : undefined
        }
        openEditDirectly={Boolean(candidateEditOpenToken)}
        editModalOpenToken={candidateEditOpenToken}
        loadingCandidateProfile={loadingCandidateProfile}
      />
      ) : null}

      {scheduleInterviewOpen ? (
      <CandidateScheduleInterviewModal
        isOpen
        candidate={schedulePopupCandidate}
        linkedJobTitle={schedulePopupCandidate?.assignedJob || undefined}
        initialJobId={schedulePrefill?.jobId ?? null}
        jobs={scheduleModalJobs}
        interviewers={candidateDrawerInterviewers}
        existingInterviews={[]}
        bulkScheduleForCandidateIds={
          scheduleBulkCandidateIds.length > 1 ? scheduleBulkCandidateIds : undefined
        }
        onClose={closeScheduleInterviewFromJob}
        onSchedule={handleJobDrawerScheduleInterview}
      />
      ) : null}

      {canUpdateJob && editJobDrawerOpen ? (
      <CreateJobDrawer
        isOpen
        jobId={editingJobId || undefined}
        onClose={() => {
          setEditJobDrawerOpen(false);
          setEditingJobId(null);
        }}
        onJobUpdated={async (updatedJobId) => {
          setEditJobDrawerOpen(false);
          setEditingJobId(null);
          void reloadMyJobsAndMetrics();
          if (updatedJobId && jobDrawerOpen) {
            await refreshJobDetails(updatedJobId);
          }
        }}
      />
      ) : null}

      {createTaskOpen ? (
      <CreateTaskModal
        isOpen
        onClose={() => setCreateTaskOpen(false)}
        onSuccess={() => setCreateTaskOpen(false)}
        initialRelatedTo="Job"
      />
      ) : null}

      {/* Step 1 — chooser asking how the recruiter wants to add a candidate. */}
      {canAddCandidate && addCandidateChooserOpen && selectedJobForCandidate ? (
        <div className="fixed inset-0 z-[120] flex items-center justify-center px-4">
          <div
            className="absolute inset-0 bg-slate-900/40"
            onClick={() => {
              setAddCandidateChooserOpen(false);
              setSelectedJobForCandidate(null);
            }}
          />
          <div className="relative w-full max-w-md rounded-2xl bg-white shadow-2xl border border-slate-200">
            <div className="p-5 border-b border-slate-100">
              <div className="text-lg font-bold text-slate-900">Add candidate to job</div>
              <div className="text-xs text-slate-500 mt-1">
                Choose how to add a candidate to{' '}
                <span className="font-semibold text-slate-700">{selectedJobForCandidate.title}</span>.
              </div>
            </div>
            <div className="p-5 space-y-3">
              <button
                type="button"
                onClick={() => {
                  setAddCandidateChooserOpen(false);
                  setPoolSearch('');
                  setPoolPickerOpen(true);
                  void loadPoolCandidates('');
                }}
                className="w-full flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 text-left transition-colors hover:bg-blue-50 hover:border-blue-300"
              >
                <div className="rounded-lg bg-blue-50 p-2 text-blue-600">
                  <Users size={18} />
                </div>
                <div>
                  <div className="font-semibold text-slate-900">From candidate pool</div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    Pick an existing candidate and place them in this job's pipeline.
                  </div>
                </div>
              </button>
              <button
                type="button"
                onClick={() => {
                  setAddCandidateChooserOpen(false);
                  setAddCandidateDrawerOpen(true);
                }}
                className="w-full flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 text-left transition-colors hover:bg-blue-50 hover:border-blue-300"
              >
                <div className="rounded-lg bg-emerald-50 p-2 text-emerald-600">
                  <UserPlus size={18} />
                </div>
                <div>
                  <div className="font-semibold text-slate-900">Create new candidate</div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    Add a brand new candidate (manual entry or resume upload).
                  </div>
                </div>
              </button>
            </div>
            <div className="p-5 border-t border-slate-100 flex items-center justify-end">
              <button
                type="button"
                onClick={() => {
                  setAddCandidateChooserOpen(false);
                  setSelectedJobForCandidate(null);
                }}
                className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-bold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Step 2a — pool picker shown when the recruiter chose "From pool". */}
      {canAddCandidate && poolPickerOpen && selectedJobForCandidate ? (
        <div className="fixed inset-0 z-[120] flex items-center justify-center px-4">
          <div
            className="absolute inset-0 bg-slate-900/40"
            onClick={() => {
              if (poolAddingId) return;
              setPoolPickerOpen(false);
              setSelectedJobForCandidate(null);
            }}
          />
          <div className="relative w-full max-w-2xl rounded-2xl bg-white shadow-2xl border border-slate-200 flex flex-col max-h-[80vh]">
            <div className="p-5 border-b border-slate-100">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-lg font-bold text-slate-900">Pick from candidate pool</div>
                  <div className="text-xs text-slate-500 mt-1">
                    Select a candidate to add to{' '}
                    <span className="font-semibold text-slate-700">{selectedJobForCandidate.title}</span>'s pipeline.
                  </div>
                </div>
                <button
                  type="button"
                  className="px-3 py-1.5 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-50 border border-slate-200"
                  onClick={() => {
                    if (poolAddingId) return;
                    setPoolPickerOpen(false);
                    setSelectedJobForCandidate(null);
                  }}
                >
                  Close
                </button>
              </div>
              <div className="mt-3">
                <input
                  type="text"
                  value={poolSearch}
                  onChange={(e) => {
                    const next = e.target.value;
                    setPoolSearch(next);
                    void loadPoolCandidates(next);
                  }}
                  placeholder="Search by name, email, or skill"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-3">
              {poolLoading ? (
                <div className="p-6 text-center text-sm text-slate-500">Loading candidates…</div>
              ) : poolCandidates.length === 0 ? (
                <div className="p-6 text-center text-sm text-slate-500">
                  No candidates found{poolSearch ? ` for "${poolSearch}"` : ''}. Try another search or
                  create a new candidate instead.
                </div>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {poolCandidates.map((candidate) => {
                    const fullName =
                      `${candidate.firstName || ''} ${candidate.lastName || ''}`.trim() || 'Candidate';
                    const adding = poolAddingId === candidate.id;
                    return (
                      <li key={candidate.id} className="flex items-center justify-between gap-4 px-3 py-3">
                        <div className="min-w-0">
                          <div className="font-semibold text-slate-900 truncate">{fullName}</div>
                          <div className="text-xs text-slate-500 truncate">
                            {candidate.email || '—'}
                            {candidate.currentTitle ? ` · ${candidate.currentTitle}` : ''}
                            {candidate.currentCompany ? ` @ ${candidate.currentCompany}` : ''}
                          </div>
                        </div>
                        <button
                          type="button"
                          disabled={adding || Boolean(poolAddingId)}
                          onClick={() => handleSelectFromPool(candidate)}
                          className="shrink-0 inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                        >
                          {adding ? 'Adding…' : 'Add'}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div className="p-4 border-t border-slate-100 flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  if (poolAddingId) return;
                  setPoolPickerOpen(false);
                  setAddCandidateChooserOpen(true);
                }}
                className="px-3 py-1.5 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-50 border border-slate-200"
              >
                Back
              </button>
              <button
                type="button"
                onClick={() => {
                  if (poolAddingId) return;
                  setPoolPickerOpen(false);
                  setAddCandidateDrawerOpen(true);
                }}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700"
              >
                <UserPlus size={14} />
                Create new instead
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {placementDrawerOpen ? (
      <CreatePlacementDrawer
        isOpen
        isSubmitting={placementSubmitting}
        currentUserId={
          currentUserForCandidateDrawer?._id || currentUserForCandidateDrawer?.id || undefined
        }
        candidates={jobCandidates.map((row) => ({
          id: row.id,
          name: row.candidateName,
          email: row.email || '',
        }))}
        jobs={
          activeJobForCandidateDrawer
            ? [
                {
                  id: activeJobForCandidateDrawer.id,
                  title: activeJobForCandidateDrawer.title,
                  clientId: activeJobForCandidateDrawer.clientId,
                  clientName: activeJobForCandidateDrawer.clientName || 'No client linked',
                },
              ]
            : []
        }
        recruiters={recruiterOptions.map((member) => ({
          id: member.id,
          name: member.name,
          email: '',
        }))}
        prefill={placementPrefill || undefined}
        onClose={() => {
          if (placementSubmitting) return;
          setPlacementDrawerOpen(false);
          setPlacementPrefill(null);
          setPendingStageAfterPlacement(null);
        }}
        onSubmit={async (payload, offerLetter) => {
          try {
            setPlacementSubmitting(true);
            await apiCreatePlacement(payload, offerLetter);
            toast.success('Placement created');
            const pending = pendingStageAfterPlacement;
            if (pending) {
              try {
                await apiMoveCandidateStage(pending.jobId, {
                  candidateId: pending.candidateId,
                  stageId: pending.stageId,
                });
              } catch (stageError: any) {
                console.error('Failed to apply stage after placement:', stageError);
                toast.error(
                  stageError?.message || 'Placement created, but stage could not be updated',
                );
              } finally {
                setPendingStageAfterPlacement(null);
              }
            }
            setPlacementDrawerOpen(false);
            setPlacementPrefill(null);
            const jid = jobDetails?.id || selectedJob?.id || pending?.jobId;
            if (jid) await refreshJobCandidates(jid);
          } catch (error: any) {
            toast.error(error?.message || 'Failed to create placement');
            throw error;
          } finally {
            setPlacementSubmitting(false);
          }
        }}
      />
      ) : null}

      {canAddCandidate && addCandidateDrawerOpen ? (
      <AddCandidateDrawer
        isOpen
        onClose={() => {
          setAddCandidateDrawerOpen(false);
          setSelectedJobForCandidate(null);
        }}
        onSuccess={async () => {
          if (selectedJobForCandidate?.id) {
            await refreshJobCandidates(selectedJobForCandidate.id);
          }
          await reloadMyJobsAndMetrics();
        }}
        currentUser={currentUserForCandidateDrawer || { _id: '', name: 'You', email: '', role: 'RECRUITER' }}
        initialTab="manual"
        defaultJobId={selectedJobForCandidate?.id || ''}
        lockJobSelection
      />
      ) : null}
      {canDeleteJob && recycleBinDrawerOpen ? (
        <ModuleRecycleBinDrawer
          isOpen
          onClose={() => setRecycleBinDrawerOpen(false)}
          kind="jobs"
          onRestored={() => void reloadMyJobsAndMetrics()}
        />
      ) : null}
      {exportModalOpen ? (
      <ExportColumnsModal
        isOpen
        onClose={() => {
          setExportModalOpen(false);
          setExportJobs([]);
        }}
        title="Export jobs"
        rowCount={exportJobs.length}
        rowLabelSingular="job"
        rowLabelPlural="jobs"
        columns={JOBS_EXPORT_COLUMNS}
        rows={exportJobs}
        isLoading={exportJobsLoading}
        getRowKey={(job) => job.id}
        onExport={handleExportJobsCsv}
      />
      ) : null}
      <style dangerouslySetInnerHTML={{ __html: `
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
          height: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgb(165 180 252 / 0.55);
          border-radius: 999px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgb(129 140 248 / 0.75);
        }
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
      `}} />
    </>
  );
}
