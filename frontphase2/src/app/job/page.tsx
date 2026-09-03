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
import { usePersistedColumnVisibility } from '../../hooks/usePersistedColumnVisibility';
import { JOB_TABLE_COLUMNS } from '../../lib/tableColumns/moduleTableColumns';
import { fetchAllPaginated, totalPagesFromPagination } from '../../lib/export/fetchAllPaginated';
import { formatDateDMY, formatDateTimeDMY } from '../../utils/dateDisplay';
import { extractAuditMeta } from '../../utils/auditMeta';
import { TableAuditColumnHeader, TableAuditCell } from '../../components/table/TableAuditCell';
import type { AiWorkspaceBriefAlert } from '@/lib/apiAiWorkspaceBrief';
import { WorkspaceAlertTableCell, WorkspaceAlertTableHeader } from '../../components/ai/WorkspaceAlertTableCell';
import type { AuditMeta } from '../../types/audit';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import PaginationAll from '../../components/PaginationAll';
import { TABLE_PAGE_SIZE_OPTIONS, type TablePageSize } from '../../constants/tablePagination';
import { requestConfirm, requestError } from '../../lib/appDialog';
import { motion } from 'motion/react';
import { Toaster, toast } from 'sonner';
import { CreateTaskModal } from '../../components/CreateTaskModal';
import AddCandidateDrawer from '../../components/candidates/AddCandidateDrawer';
import { JobDetailsDrawer, type JobForDrawer, type JobCandidateItem } from '../../components/drawers/JobDetailsDrawer';
import { CreatePlacementDrawer } from '../../components/placements/modals/CreatePlacementDrawer';
import { CreateJobDrawer } from '../../components/drawers/CreateJobDrawer';
import { JobAiCreateWizard } from '../../components/jobs/JobAiCreateWizard';
import ModuleRecycleBinDrawer from '../../components/ModuleRecycleBinDrawer';
import {
  SmartSearchActiveKeywordsBar,
  SmartSearchPromptPanel,
  SmartSearchToggleButton,
} from '../../components/smart-search/SmartSearchToolbar';
import { useSmartSearch } from '../../hooks/useSmartSearch';
import { mapAiToJobsResult, parseSmartSearchWithAi } from '../../lib/smart-search/aiParser';
import { buildJobsListApiParams } from '../../lib/smart-search/entitySmartSearch';
import { parseJobsSmartSearchPrompt, JOBS_SMART_SEARCH_EXAMPLES, jobMatchesSmartKeywordChips, mergeJobsSmartSearchResult } from '../../lib/smart-search/parsers';
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
import {
  CandidateProfileDrawer,
  ScheduleInterviewModal as CandidateScheduleInterviewModal,
  type CandidateInterviewerOption,
  type CandidatePipelineJobOption,
  type CandidateProfileDrawerData,
  type CandidateScheduledInterview,
  type CandidateTagItem,
} from '../../components/drawers/CandidateProfileDrawer';
import {
  extractApiData,
  getTagColor,
  isValidObjectId,
  mapCandidateProfile,
} from '../../lib/mapCandidateProfile';
import { candidateTableRowToProfileStub } from '../../lib/candidateTableToProfileStub';
import { useSubmitToClientModal } from '../../hooks/useSubmitToClientModal';
import {
  profileCanSubmitToClient,
  resolveSubmitJobIdForProfile,
} from '../../lib/candidateSubmitToClient';
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
import { formatAssigneeDisplayName } from '../../lib/assigneeDisplay';
import { getActiveOrgUnitId } from '../../lib/org/orgWorkspaceStorage';
import { usePermissions } from '../../hooks/usePermissions';
import { usePageAutoRefresh } from '../../hooks/usePageAutoRefresh';
import {
  isJobsListCacheFresh,
  readJobsListCache,
  readJobsMetricsCache,
  writeJobsListCache,
  writeJobsMetricsCache,
  invalidateEmployerJobsCache,
} from '../../lib/employerPageCache';
import { useWorkspaceEntityAlerts } from '../../hooks/useWorkspaceEntityAlerts';
import { TableSkeleton } from '../../components/ui/Skeleton';
import { SummaryCard, SummaryCardSkeleton, type SummaryCardColor } from '../../components/ui/SummaryCard';
import {
  Ph2ModulePageLayout,
  PH2_TABLE_BODY_SCROLL_CLASS,
  PH2_TABLE_CARD_CLASS,
  PH2_TABLE_CARD_FOOTER_CLASS,
  PH2_TOOLBAR_ROW_CLASS,
} from '../../components/layout/Ph2ModulePageLayout';
import { SearchableToolbarFilterSelect } from '../../components/forms/SearchableToolbarFilterSelect';
import { dedupeByCompanyName } from '../../lib/companyNameKey';

// Force CSR so the page hydrates skeleton placeholders before the first data
// fetch resolves — every interactive bit on this tab is client-driven.
export const dynamic = 'force-dynamic';

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 10;

type JobsApiPayload = {
  jobs: BackendJob[];
  total: number;
};

function parseJobsApiPayload(res: any): JobsApiPayload {
  let backendJobs: BackendJob[] = [];
  let total = 0;

  if (res?.data) {
    if (Array.isArray(res.data)) {
      backendJobs = res.data;
      total = backendJobs.length;
    } else if (Array.isArray(res.data.data)) {
      backendJobs = res.data.data;
      total = res.data?.pagination?.total ?? backendJobs.length;
    } else if (Array.isArray(res.data.items)) {
      backendJobs = res.data.items;
      total = res.data?.pagination?.total ?? backendJobs.length;
    }
  }

  return { jobs: backendJobs, total };
}

// Types
type JobStatus = string;

interface JobPipelineStageSummary {
  id: string;
  name: string;
  order: number;
  count: number;
  color?: string;
  systemRole?: string | null;
}

/** Drop legacy "Apply" when an Applied/APPLIED stage exists (standalone double-bucket bug). */
function dedupeRedundantApplyPipelineStages(stages: JobPipelineStageSummary[]): JobPipelineStageSummary[] {
  if (!Array.isArray(stages) || stages.length < 2) return stages;
  const hasAppliedLike = stages.some(
    (s) =>
      String(s.systemRole || '').toUpperCase() === 'APPLIED' ||
      /^applied$/i.test(String(s.name || '').trim())
  );
  if (!hasAppliedLike) return stages;
  return stages.filter((s) => String(s.name || '').trim().toLowerCase() !== 'apply');
}

interface Job {
  id: string;
  title: string;
  client: string;
  clientId?: string;
  location: string;
  status: JobStatus;
  backendStatus?: string;
  jobLocationType?: string;
  applied: number;
  interviewed: number;
  offered: number;
  joined: number;
  openings: number;
  owner: string;
  recruiterId?: string;
  createdDate: string;
  hot: boolean;
  aiMatch: boolean;
  aiMatchCount?: number;
  noCandidates: boolean;
  candidates?: string;
  slaRisk: boolean;
  pipelineStages?: JobPipelineStageSummary[];
  auditMeta?: AuditMeta;
  priority?: string;
  employmentType?: string;
  nationality?: string;
  country?: string;
  state?: string;
  city?: string;
  industry?: string;
  description?: string;
  experienceRequired?: string;
  education?: string;
  hiringManager?: string;
  managerName?: string;
  workMode?: string;
  skills?: string[];
  requirements?: string[];
  keyResponsibilities?: string[];
  preferredSkills?: string[];
  candidateRequirements?: string[];
  benefits?: string[];
  languages?: Array<{ language?: string; proficiency?: string }>;
}

/** Map list Job to drawer JobForDrawer - uses only backend data, no mock data */
function toJobForDrawer(j: Job): JobForDrawer {
  const status = j.status as JobForDrawer['status'];
  return {
    ...j,
    status,
    employmentType: 'Full-time',
    salaryRange: undefined, // Will be populated from backend
    postedDate: j.createdDate,
    recruiter: j.owner,
    hiringManager: '-',
    overview: undefined, // Will be populated from backend
    keyResponsibilities: undefined, // Will be populated from backend
    requiredSkills: undefined, // Will be populated from backend
    preferredSkills: undefined, // Will be populated from backend
    experienceRequired: undefined, // Will be populated from backend
    education: undefined, // Will be populated from backend
    benefits: undefined, // Will be populated from backend
  };
}

function unwrapBackendJob(response: unknown): Record<string, any> {
  return (response as any).data?.data || (response as any).data || response;
}

function mapBackendJobToJobForDrawer(backendJob: Record<string, any>, fallbackJob?: Job): JobForDrawer {
  const job = fallbackJob;
  return {
    id: backendJob.id,
    title: backendJob.title,
    client: backendJob.client?.companyName || job?.client || '',
    clientId: backendJob.client?.id,
    location: backendJob.location || job?.location || '',
    status: displayJobStatusFromBackend(backendJob.status, backendJob.statusLabel) as JobForDrawer['status'],
    employmentType: formatEmploymentType(backendJob.type) || undefined,
    salaryRange: formatSalaryRange(backendJob.salary),
    postedDate: backendJob.postedDate
      ? new Date(backendJob.postedDate).toISOString().split('T')[0]
      : backendJob.createdAt
        ? backendJob.createdAt.split('T')[0]
        : job?.createdDate,
    recruiter: formatAssigneeDisplayName(backendJob.assignedTo) || backendJob.assignedTo?.name || job?.owner,
    hiringManager: backendJob.hiringManager || undefined,
    applied:
      typeof backendJob.appliedCount === 'number'
        ? backendJob.appliedCount
        : backendJob._count?.applications ?? job?.applied ?? 0,
    interviewed: backendJob._count?.interviews || job?.interviewed || 0,
    offered: 0,
    joined: backendJob._count?.placements || job?.joined || 0,
    openings: backendJob.openings || job?.openings || 0,
    owner: formatAssigneeDisplayName(backendJob.assignedTo) || backendJob.assignedTo?.name || job?.owner || '',
    createdDate: backendJob.createdAt ? backendJob.createdAt.split('T')[0] : job?.createdDate || '',
    jobCategory: backendJob.jobCategory || undefined,
    jobLocationType: backendJob.jobLocationType || undefined,
    salaryType: backendJob.salary?.type || undefined,
    salaryCurrency: backendJob.salary?.currency || undefined,
    minSalary: backendJob.salary?.min,
    maxSalary: backendJob.salary?.max,
    department: backendJob.department || undefined,
    applicationFormEnabled: backendJob.applicationFormEnabled || false,
    applicationFormLogo: backendJob.applicationFormLogo || undefined,
    applicationFormQuestions: backendJob.applicationFormQuestions || [],
    applicationFormNote: backendJob.applicationFormNote || undefined,
    preScreenAssessments: Array.isArray(backendJob.preScreenAssessments)
      ? backendJob.preScreenAssessments
      : undefined,
    applyUrl: backendJob.applyUrl || undefined,
    applications: Array.isArray(backendJob.applications)
      ? backendJob.applications.map((app: any) => ({
          id: String(app.id || ''),
          candidateId: String(app.candidateId || ''),
          status: app.status || undefined,
          appliedAt: app.appliedAt || undefined,
          screeningAnswers:
            app.screeningAnswers && typeof app.screeningAnswers === 'object'
              ? app.screeningAnswers
              : null,
          candidate: app.candidate
            ? {
                id: app.candidate.id ? String(app.candidate.id) : undefined,
                firstName: app.candidate.firstName || null,
                lastName: app.candidate.lastName || null,
                email: app.candidate.email || null,
              }
            : null,
        }))
      : [],
    overview: backendJob.overview || undefined,
    keyResponsibilities: backendJob.keyResponsibilities || undefined,
    requiredSkills: backendJob.skills || undefined,
    preferredSkills: backendJob.preferredSkills || undefined,
    experienceRequired: backendJob.experienceRequired || undefined,
    education: backendJob.education || undefined,
    benefits: backendJob.benefits || undefined,
    description: backendJob.description || undefined,
    requirements: backendJob.requirements || undefined,
    candidateRequirements: backendJob.candidateRequirements || undefined,
    nationality: backendJob.nationality || undefined,
    country: backendJob.country || undefined,
    state: backendJob.state || undefined,
    city: backendJob.city || undefined,
    priority: backendJob.priority || undefined,
    languages: Array.isArray(backendJob.languages) ? backendJob.languages : undefined,
    workMode: backendJob.workMode || undefined,
    expectedClosureDate: backendJob.expectedClosureDate
      ? new Date(backendJob.expectedClosureDate).toISOString().split('T')[0]
      : undefined,
    jdFileName: backendJob.jdFileName || undefined,
    videoMediaLink: backendJob.videoMediaLink || undefined,
    forecastRevenue: backendJob.forecastRevenue || undefined,
    hot: Boolean(backendJob.hot),
    aiMatch: Boolean(backendJob.aiMatch),
    noCandidates: Boolean(backendJob.noCandidates),
    slaRisk: Boolean(backendJob.slaRisk),
    managerName: backendJob.manager?.name || undefined,
    visibility: backendJob.visibility || undefined,
    showClientNamePublicly: backendJob.showClientNamePublicly !== false,
    publicFieldVisibility: backendJob.publicFieldVisibility || undefined,
    supportingRecruiters: Array.isArray(backendJob.supportingRecruiters)
      ? backendJob.supportingRecruiters.map(String)
      : [],
    auditMeta: extractAuditMeta(backendJob as Record<string, unknown>),
  };
}

function mapBackendPipelineStages(backendJob: Record<string, any>) {
  if (backendJob.pipelineStages && Array.isArray(backendJob.pipelineStages)) {
    return backendJob.pipelineStages.map((stage: any) => ({
      id: stage.id,
      name: stage.name,
      sla: '',
      systemRole: stage.systemRole ?? undefined,
    }));
  }
  return [];
}

interface JobStatusPillProps {
  status: JobStatus;
}

interface PipelineSnapshotProps {
  applied: number;
  interviewed: number;
  offered: number;
  joined: number;
  /** Per-stage breakdown when the job has a configured pipeline. Falls back to APP/INT/OFF/JOI buckets when absent. */
  stages?: JobPipelineStageSummary[];
}

const SYSTEM_ROLE_TO_LEGACY_KEY: Record<string, 'applied' | 'interviewed' | 'offered' | 'joined'> = {
  APPLIED: 'applied',
  SCREENING: 'applied',
  INTERVIEW: 'interviewed',
  OFFER: 'offered',
  HIRED: 'joined',
};

const SYSTEM_ROLE_NAME_FALLBACK: Array<{
  match: RegExp;
  key: 'applied' | 'interviewed' | 'offered' | 'joined';
}> = [
  { match: /appli|screen/i, key: 'applied' },
  { match: /interview|review|assess/i, key: 'interviewed' },
  { match: /offer/i, key: 'offered' },
  { match: /hire|placed|join/i, key: 'joined' },
];

function abbreviateStage(name: string): string {
  const trimmed = String(name || '').trim();
  if (!trimmed) return '—';
  const word = trimmed.split(/\s+/)[0];
  return word.slice(0, 3).toUpperCase();
}

interface JobsListViewProps {
  jobs: Job[];
  onJobClick?: (job: Job) => void;
  onEditJob?: (job: Job) => void;
  onAddCandidate?: (job: Job) => void;
  onDeleteJob?: (jobId: string, jobTitle: string) => Promise<void>;
  deletingJobId?: string | null;
  canUpdateJob: boolean;
  canDeleteJob: boolean;
  canAddCandidate: boolean;
  statusEdit: {
    jobId: string | null;
    newStatus: JobStatus | null;
    remark: string;
  };
  onStatusChange: (id: string, newStatus: JobStatus) => void;
  onRemarkChange: (remark: string) => void;
  onSaveStatusEdit: () => void;
  onCancelStatusEdit: () => void;
  statusOptions: string[];
  onAppendStatusOption: (status: string) => Promise<string[] | void>;
  onRemoveStatusOption: (status: string) => Promise<string[] | void>;
  workspaceAlertsByEntityId?: Record<string, AiWorkspaceBriefAlert[]>;
  isColumnVisible?: (columnId: string) => boolean;
}

// No fallback mock data - use empty array if API fails

// Stats from API — tiles use <SummaryCard /> so height/layout match Leads.
const STATS_CONFIG: Array<{
  key: keyof JobMetrics;
  label: string;
  icon: typeof Briefcase;
  color: SummaryCardColor;
}> = [
  { key: 'activeJobs', label: 'Active jobs', icon: Briefcase, color: 'blue' },
  { key: 'newJobsThisWeek', label: 'New this week', icon: Plus, color: 'green' },
  { key: 'appliedCandidates', label: 'Applied', icon: Users, color: 'orange' },
  { key: 'nearSla', label: 'Near SLA', icon: Clock, color: 'rose' },
  { key: 'closedThisMonth', label: 'Closed (month)', icon: CheckCircle2, color: 'purple' },
];

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
            {options.map((status) => {
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

const PipelineSnapshot = ({ applied, interviewed, offered, joined, stages }: PipelineSnapshotProps) => {
  const visibleStages = Array.isArray(stages) && stages.length > 0 ? stages.slice(0, 6) : [];

  if (visibleStages.length === 0) {
    return (
      <div className="flex items-center gap-0 bg-gray-50 rounded-lg border border-gray-100 p-1">
        <div className="px-2 py-1 flex flex-col items-center border-r border-gray-200 last:border-0 min-w-[40px]">
          <span className="text-[10px] text-gray-400 font-medium">APP</span>
          <span className="text-xs font-bold text-gray-700">{applied}</span>
        </div>
        <div className="px-2 py-1 flex flex-col items-center border-r border-gray-200 last:border-0 min-w-[40px]">
          <span className="text-[10px] text-gray-400 font-medium">INT</span>
          <span className="text-xs font-bold text-gray-700">{interviewed}</span>
        </div>
        <div className="px-2 py-1 flex flex-col items-center border-r border-gray-200 last:border-0 min-w-[40px]">
          <span className="text-[10px] text-gray-400 font-medium">OFF</span>
          <span className="text-xs font-bold text-gray-700">{offered}</span>
        </div>
        <div className="px-2 py-1 flex flex-col items-center last:border-0 min-w-[40px]">
          <span className="text-[10px] text-gray-400 font-medium">JOI</span>
          <span className="text-xs font-bold text-gray-700">{joined}</span>
        </div>
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
}: JobsListViewProps) => {
  const showAiAlertColumn = Boolean(
    workspaceAlertsByEntityId &&
      Object.values(workspaceAlertsByEntityId).some((alerts) => alerts.length > 0),
  );
  const show = isColumnVisible;
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
      <table className="w-full min-w-[520px] text-left border-collapse">
        <thead className="sticky top-0 z-10">
          <tr className="border-b border-indigo-100 bg-gradient-to-r from-slate-50 via-indigo-50 to-violet-50 text-indigo-950/45 uppercase text-[9px] font-bold tracking-[0.12em]">
            {show('select') ? (
              <th className="px-3 py-2 sm:px-4 w-10 first:pl-4">
                <input type="checkbox" className="rounded border-slate-300" aria-label="Select all" />
              </th>
            ) : null}
            <th className="min-w-[12rem] px-3 py-2 align-middle sm:min-w-[14rem] sm:px-4">Job title</th>
            {show('client') ? <th className="px-3 py-2 sm:px-4">Client</th> : null}
            {show('status') ? <th className="px-3 py-2 sm:px-4">Status</th> : null}
            {show('pipeline') ? <th className="px-3 py-2 sm:px-4">Pipeline</th> : null}
            {show('details') ? <th className="px-3 py-2 sm:px-4">Details</th> : null}
            {show('location') ? <th className="px-3 py-2 sm:px-4">Location</th> : null}
            {show('openings') ? <th className="px-3 py-2 sm:px-4">Openings</th> : null}
            {show('owner') ? <th className="px-3 py-2 sm:px-4">Team member</th> : null}
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
          {jobs.length === 0 ? (
            <tr>
              <td colSpan={visibleColCount} className="px-4 py-12 text-center">
                <p className="text-xs font-medium text-slate-500">No jobs match your filters</p>
                <p className="mt-1 text-[11px] text-slate-400">Try adjusting search or clear filters</p>
              </td>
            </tr>
          ) : (
            jobs.map((job) => (
          <tr
            key={job.id}
                className="group transition-colors duration-200 even:bg-slate-50/35 hover:bg-indigo-50/45"
          >
                {show('select') ? (
                  <td className="px-3 py-2 sm:px-4" onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" className="rounded border-slate-300" aria-label={`Select ${job.title}`} />
                  </td>
                ) : null}
                <td className="min-w-[12rem] align-middle px-3 py-2 sm:min-w-[14rem] sm:px-4">
              <div className="flex flex-col justify-center">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onJobClick?.(job)}
                        className="min-w-0 flex-1 text-left text-xs font-semibold leading-snug text-slate-900 whitespace-normal break-words hover:text-indigo-700 transition-colors"
                    title={job.title}
                  >
                    {job.title}
                  </button>
                  <div className="flex shrink-0 items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
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
                    options={filterJobStatusOptionsForCurrent(statusOptions, job.status)}
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
              />
            </td>
                ) : null}
                {show('details') ? (
                <td className="px-3 py-2 sm:px-4">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Team Member</span>
                    <span className="text-xs text-slate-700">{job.owner}</span>
                    <span className="text-[10px] text-slate-500">{formatDateDMY(job.createdDate)}</span>
              </div>
            </td>
                ) : null}
                {show('location') ? (
                  <td className="px-3 py-2 sm:px-4">
                    <span className="max-w-[120px] truncate text-xs text-slate-700">{job.location || '—'}</span>
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
                    <span className="max-w-[100px] truncate text-xs text-slate-700">{job.owner || '—'}</span>
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

function mapBackendStatus(status: string, statusLabel?: string | null): JobStatus {
  return displayJobStatusFromBackend(status, statusLabel);
}

function mapFrontendStatusToBackend(status: JobStatus): string {
  return mapJobStatusLabelToBackend(status);
}

function formatEmploymentType(type?: string | null): string | undefined {
  switch (type) {
    case 'FULL_TIME':
      return 'Full-time';
    case 'PART_TIME':
      return undefined;
    case 'CONTRACT':
      return 'Contract';
    case 'FREELANCE':
      return 'Freelance';
    case 'INTERNSHIP':
      return 'Internship';
    default:
      return undefined;
  }
}

function formatSalaryRange(salary?: BackendJob['salary']): string | undefined {
  if (!salary) return undefined;

  const currency = String(salary.currency || '').trim();
  const amount = salary.amount !== undefined && salary.amount !== null ? String(salary.amount).trim() : '';

  if (amount) {
    return currency ? `${currency} ${amount}` : amount;
  }

  if (salary.min !== undefined || salary.max !== undefined) {
    const minText = salary.min !== undefined ? `${salary.min}` : '';
    const maxText = salary.max !== undefined ? `${salary.max}` : '';
    const range = [minText, maxText].filter(Boolean).join(' - ');
    return currency ? `${currency} ${range}`.trim() : range || undefined;
  }

  return undefined;
}

function mapBackendJob(job: BackendJob): Job {
  const interviewed = job._count?.interviews ?? 0;
  const joined = job._count?.placements ?? 0;

  const stageList = Array.isArray((job as any).pipelineStages) ? (job as any).pipelineStages : [];
  const pipelineStages: JobPipelineStageSummary[] = stageList
    .map((stage: any, index: number) => ({
      id: String(stage?.id || `s-${index}`),
      name: String(stage?.name || '').trim() || `Stage ${index + 1}`,
      order: Number.isFinite(Number(stage?.order)) ? Number(stage.order) : index + 1,
      count: Number(stage?._count?.entries ?? stage?.entriesCount ?? 0) || 0,
      color: typeof stage?.color === 'string' ? stage.color : undefined,
      systemRole:
        stage?.systemRole != null && String(stage.systemRole).trim()
          ? String(stage.systemRole).trim()
          : null,
    }))
    .sort((a: JobPipelineStageSummary, b: JobPipelineStageSummary) => a.order - b.order);

  const pipelineStagesDeduped = dedupeRedundantApplyPipelineStages(pipelineStages);

  const appliedFromBackend =
    typeof (job as any).appliedCount === 'number'
      ? Number((job as any).appliedCount)
      : Number(job._count?.applications ?? 0);
  const appliedStageCount = pipelineStagesDeduped.find(
    (stage) =>
      String(stage.systemRole || '').toUpperCase() === 'APPLIED' ||
      /^applied$/i.test(String(stage.name || '').trim())
  )?.count;
  const applied =
    typeof appliedStageCount === 'number' && appliedStageCount > 0
      ? appliedStageCount
      : appliedFromBackend;

  return {
    id: job.id,
    title: job.title,
    client: job.client?.companyName ?? '-',
    clientId: job.client?.id,
    location: job.location ?? '-',
    status: mapBackendStatus(job.status, (job as any).statusLabel),
    backendStatus: job.status,
    jobLocationType: job.jobLocationType ?? undefined,
    applied,
    interviewed,
    offered: 0,
    joined,
    openings: job.openings,
    owner: formatAssigneeDisplayName(job.assignedTo) || job.assignedTo?.name || 'Unassigned',
    recruiterId: job.assignedToId || job.assignedTo?.id,
    createdDate: job.createdAt ? formatDateDMY(job.createdAt) : '-',
    hot: (job as any).hot ?? false,
    aiMatch: (job as any).aiMatch ?? false,
    aiMatchCount:
      typeof (job as any).aiMatchCount === 'number'
        ? Number((job as any).aiMatchCount)
        : Number(job._count?.matches ?? 0),
    noCandidates: (job as any).noCandidates ?? false,
    candidates: '',
    slaRisk: (job as any).slaRisk ?? false,
    pipelineStages: pipelineStagesDeduped.length ? pipelineStagesDeduped : undefined,
    auditMeta: extractAuditMeta(job as Record<string, unknown>),
    priority: job.priority || undefined,
    employmentType: job.type || undefined,
    nationality: job.nationality || undefined,
    country: job.country || undefined,
    state: job.state || undefined,
    city: job.city || undefined,
    industry: job.jobCategory || job.department || undefined,
    description: job.description || job.overview || undefined,
    experienceRequired: job.experienceRequired || undefined,
    education: job.education || undefined,
    hiringManager: job.hiringManager || undefined,
    managerName: job.manager?.name || undefined,
    workMode: job.workMode || undefined,
    skills: job.skills || undefined,
    requirements: job.requirements || undefined,
    keyResponsibilities: job.keyResponsibilities || undefined,
    preferredSkills: job.preferredSkills || undefined,
    candidateRequirements: job.candidateRequirements || undefined,
    benefits: job.benefits || undefined,
    languages: job.languages || undefined,
  };
}

function extractJobCandidateNames(job: any): string[] {
  const names = new Set<string>();

  const addName = (first?: unknown, last?: unknown, fallback?: unknown) => {
    const full = `${String(first || '').trim()} ${String(last || '').trim()}`.trim();
    const normalized = full || String(fallback || '').trim();
    if (normalized) names.add(normalized);
  };

  if (Array.isArray(job?.applications)) {
    for (const app of job.applications) {
      addName(app?.candidate?.firstName, app?.candidate?.lastName);
    }
  }

  if (Array.isArray(job?.matches)) {
    for (const match of job.matches) {
      addName(
        match?.candidate?.firstName,
        match?.candidate?.lastName,
        match?.name
      );
    }
  }

  return Array.from(names);
}

async function enrichJobExportRow(baseJob: Job): Promise<Job> {
  try {
    const response = await apiGetJob(baseJob.id);
    const backendJob = (response as any).data?.data || (response as any).data || response;

    const candidateNames = extractJobCandidateNames(backendJob);
    const aiMatchCount = Array.isArray(backendJob?.matches)
      ? backendJob.matches.filter((match: any) => String(match?.matchSource || '').toLowerCase() === 'ai').length
      : Number(backendJob?._count?.matches ?? baseJob.aiMatchCount ?? 0);

    return {
      ...baseJob,
      candidates: candidateNames.join('; '),
      aiMatchCount,
      noCandidates: candidateNames.length === 0,
    };
  } catch {
    return {
      ...baseJob,
      candidates: baseJob.candidates || '',
      aiMatchCount: baseJob.aiMatchCount ?? 0,
    };
  }
}

function toJobCandidateItemFromApplied(match: any, fallbackRecruiter = 'Unassigned'): JobCandidateItem {
  const emailFromMatch =
    (match.candidate?.email && String(match.candidate.email).trim()) ||
    (match.email && String(match.email).trim()) ||
    undefined;
  const cand = match.candidate;
  const resolvedStage = resolveJobCandidateStageFromMatchRow(
    {
      status: match.status,
      candidateStage: match.candidateStage ?? cand?.stage,
      candidate: cand,
    },
  );
  return {
    id: match.candidateId || cand?.id || match.id,
    candidateName: cand
      ? `${cand.firstName || ''} ${cand.lastName || ''}`.trim() || '—'
      : match.name?.trim() || '—',
    email: emailFromMatch,
    avatar: cand?.avatar ? String(cand.avatar).trim() : match.photo?.trim() || null,
    designation: cand?.currentTitle ? String(cand.currentTitle).trim() : match.currentTitle?.trim() || '',
    company: cand?.currentCompany ? String(cand.currentCompany).trim() : match.currentCompany?.trim() || '',
    experience: resolveCandidateExperienceYears(cand || match),
    location: resolveCandidateLocationLabel(cand || match),
    phone: cand?.phone ? String(cand.phone).trim() : match.phone?.trim() || '',
    currentStage: resolvedStage,
    isJobAppliedCandidate: isJobAppliedDisplayStage(resolvedStage),
    score: typeof match.score === 'number' ? `${Math.round(match.score)}%` : '-',
    recruiter: pickCandidateOwnerLabel(
      cand?.assignedTo?.name,
      match.candidateOwner,
      match.createdBy?.name,
      fallbackRecruiter,
    ),
    interviewStatus: 'Not scheduled',
    lastActivity: match.createdAt ? formatDateTimeDMY(match.createdAt) : '—',
  };
}

function toJobCandidateItemFromAssigned(candidate: BackendCandidate): JobCandidateItem {
  return {
    id: candidate.id,
    candidateName: `${candidate.firstName || ''} ${candidate.lastName || ''}`.trim() || '-',
    email: candidate.email ? String(candidate.email).trim() : undefined,
    avatar: candidate.avatar ? String(candidate.avatar).trim() : null,
    designation: candidate.currentTitle ? String(candidate.currentTitle).trim() : '',
    company: candidate.currentCompany ? String(candidate.currentCompany).trim() : '',
    experience: candidate.experience ?? 0,
    location: candidate.location ? String(candidate.location).trim() : '—',
    phone: candidate.phone ? String(candidate.phone).trim() : '',
    currentStage: resolveJobCandidateDisplayStage(candidate.stage),
    isJobAppliedCandidate: isJobAppliedDisplayStage(candidate.stage),
    score: '-',
    recruiter: candidate.assignedTo?.name || '-',
    interviewStatus: 'Not scheduled',
    lastActivity: candidate.updatedAt
      ? formatDateTimeDMY(candidate.updatedAt)
      : candidate.createdAt
      ? formatDateTimeDMY(candidate.createdAt)
      : '-',
  };
}

function unwrapCollection<T>(value: T[] | { data?: T[] } | undefined | null): T[] {
  if (Array.isArray(value)) return value;
  if (value && typeof value === 'object' && Array.isArray((value as { data?: T[] }).data)) {
    return (value as { data: T[] }).data;
  }
  return [];
}

const isLikelyUrl = (value?: string | null) => /^https?:\/\//i.test(String(value || '').trim());

function safeDisplayText(value?: string | null, fallback = '') {
  const text = String(value || '').trim();
  if (!text || isLikelyUrl(text)) return fallback;
  return text;
}

function initialsFromScheduleName(value?: string | null, fallback = 'NA') {
  const text = safeDisplayText(value, '').trim();
  if (!text) return fallback;
  const initials = text
    .split(/\s+/)
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
  return initials || fallback;
}

function sanitizeScheduleEmail(value?: string | null) {
  const email = String(value || '').trim();
  if (!email || isLikelyUrl(email) || !email.includes('@')) return '';
  return email;
}

function mapUsersToInterviewPanel(users: BackendUser[]): InterviewPanelMember[] {
  return users.map((user) => ({
    id: user.id,
    userId: user.id,
    name: safeDisplayText(user.name, 'Unknown User'),
    role: 'Technical',
    department: safeDisplayText(user.department, 'General'),
    email: sanitizeScheduleEmail(user.email) || 'No email available',
    phone: '-',
    avatar: initialsFromScheduleName(user.name, 'NA'),
  }));
}

export default function JobsPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { hasPermission, hasAnyPermission } = usePermissions();
  const canCreateJob = hasAnyPermission(['jobs_create', 'create_job']);
  const canUpdateJob = hasAnyPermission(['jobs_update', 'edit_job']);
  const canDeleteJob = hasAnyPermission(['jobs_delete', 'delete_job']);
  const canAddCandidate = hasPermission('add_candidate');
  const canCreateInterview = hasPermission('interviews_create');
  const canUpdateCandidate = hasAnyPermission([
    'candidates_update',
    'edit_candidate',
    'move_pipeline',
    'submit_candidate',
  ]);
  const canSubmitToClient = hasAnyPermission(['submit_candidate', 'candidates_update', 'edit_candidate']);
  const jobAiGate = useAiCoinGate('ai.job_from_prompt');
  const [searchFilter, setSearchFilter] = useState('');
  const jobColumnVisibility = usePersistedColumnVisibility('jobs.visibleColumns', JOB_TABLE_COLUMNS);
  const [statusFilter, setStatusFilter] = useState('');
  const [clientFilterId, setClientFilterId] = useState('');
  const [recruiterFilterId, setRecruiterFilterId] = useState('');
  const [isStandaloneMode, setIsStandaloneMode] = useState(
    () => typeof window !== 'undefined' && getCachedOrgRecruitmentMode() === 'standalone',
  );
  const [workspaceClientId, setWorkspaceClientId] = useState('');
  const [smartSearchJobIds, setSmartSearchJobIds] = useState<string[]>([]);
  const [clientOptions, setClientOptions] = useState<Array<{ id: string; name: string }>>([]);
  const [recruiterOptions, setRecruiterOptions] = useState<Array<{ id: string; name: string }>>([]);
  const [createTaskOpen, setCreateTaskOpen] = useState(false);
  const [createJobDrawerOpen, setCreateJobDrawerOpen] = useState(false);
  const [jobAiWizardOpen, setJobAiWizardOpen] = useState(false);
  const [createJobMode, setCreateJobMode] = useState<'ai' | 'manual'>('manual');
  const [recycleBinDrawerOpen, setRecycleBinDrawerOpen] = useState(false);
  const [duplicateFromJobId, setDuplicateFromJobId] = useState<string | null>(null);
  const [addCandidateDrawerOpen, setAddCandidateDrawerOpen] = useState(false);
  /** Chooser shown before the Add Candidate drawer asking the recruiter
   *  whether they want to pick from the existing pool or create a new
   *  candidate from scratch. The selected job is parked in `selectedJobForCandidate`. */
  const [addCandidateChooserOpen, setAddCandidateChooserOpen] = useState(false);
  const [poolPickerOpen, setPoolPickerOpen] = useState(false);
  const [poolCandidates, setPoolCandidates] = useState<BackendCandidate[]>([]);
  const [poolLoading, setPoolLoading] = useState(false);
  const [poolSearch, setPoolSearch] = useState('');
  const [poolAddingId, setPoolAddingId] = useState<string | null>(null);
  const [selectedJobForCandidate, setSelectedJobForCandidate] = useState<Job | null>(null);
  const [currentUserForCandidateDrawer, setCurrentUserForCandidateDrawer] = useState<any>(null);
  const [jobDrawerOpen, setJobDrawerOpen] = useState(false);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const pendingDeepLinkJobIdRef = useRef<string | null>(null);
  const [currentPage, setCurrentPage] = useState(DEFAULT_PAGE);
  const [pageSize, setPageSize] = useState<TablePageSize>(DEFAULT_PAGE_SIZE);
  const [jobs, setJobs] = useState<Job[]>(() => {
    const cached = readJobsListCache(DEFAULT_PAGE, DEFAULT_PAGE_SIZE);
    return Array.isArray(cached?.data?.jobs) ? (cached.data.jobs as Job[]) : [];
  });
  const [loading, setLoading] = useState(() => jobs.length === 0);
  const [error, setError] = useState<string | null>(null);
  const [jobCandidates, setJobCandidates] = useState<JobCandidateItem[]>([]);
  const [candidateProfileDrawerOpen, setCandidateProfileDrawerOpen] = useState(false);
  const [selectedCandidateProfile, setSelectedCandidateProfile] =
    useState<CandidateProfileDrawerData | null>(null);
  const [candidateDrawerMode, setCandidateDrawerMode] = useState<'view' | 'edit'>('view');
  const [candidateEditOpenToken, setCandidateEditOpenToken] = useState<number | null>(null);
  const [loadingCandidateProfile, setLoadingCandidateProfile] = useState(false);
  const { openSubmit, submitModalElement } = useSubmitToClientModal();
  const [availableDrawerTags, setAvailableDrawerTags] = useState<CandidateTagItem[]>([]);
  const [scheduleInterviewOpen, setScheduleInterviewOpen] = useState(false);
  const [schedulePrefill, setSchedulePrefill] = useState<{ candidateId: string; jobId: string } | null>(null);
  const [scheduleInterviewers, setScheduleInterviewers] = useState<InterviewPanelMember[]>([]);
  const [pendingStageAfterInterview, setPendingStageAfterInterview] = useState<{
    candidateId: string;
    jobId: string;
    stageId: string;
    stageName: string;
  } | null>(null);
  const [pendingStageAfterPlacement, setPendingStageAfterPlacement] = useState<{
    candidateId: string;
    jobId: string;
    stageId: string;
    stageName: string;
  } | null>(null);
  const [placementDrawerOpen, setPlacementDrawerOpen] = useState(false);
  const [placementSubmitting, setPlacementSubmitting] = useState(false);
  const [placementPrefill, setPlacementPrefill] = useState<{
    candidateId?: string;
    jobId?: string;
    companyId?: string;
    recruiterId?: string;
  } | null>(null);
  const [statusEdit, setStatusEdit] = useState<{
    jobId: string | null;
    newStatus: JobStatus | null;
    remark: string;
  }>({
    jobId: null,
    newStatus: null,
    remark: '',
  });
  const [jobStatusOptions, setJobStatusOptions] = useState<string[]>([
    ...DEFAULT_JOB_STATUS_OPTIONS,
  ]);
  const [totalEntries, setTotalEntries] = useState(() => {
    const cached = readJobsListCache(DEFAULT_PAGE, DEFAULT_PAGE_SIZE);
    return typeof cached?.data?.totalEntries === 'number' ? cached.data.totalEntries : 0;
  });
  const hasVisibleJobsRef = useRef(jobs.length > 0);
  const cloneDrawerTimerRef = useRef<number | null>(null);
  const jobSmartSearch = useSmartSearch({
    parsePrompt: (text) =>
      parseJobsSmartSearchPrompt(text, {
        clients: clientOptions,
        recruiters: recruiterOptions,
      }),
    parsePromptWithAi: async (text) => {
      const local = parseJobsSmartSearchPrompt(text, {
        clients: clientOptions,
        recruiters: recruiterOptions,
      });
      const ai = await parseSmartSearchWithAi('jobs', text, { useTenantDatabase: true }, mapAiToJobsResult);
      if (!ai) return null;
      return mergeJobsSmartSearchResult(local, ai);
    },
    applyParsed: (parsed) => {
      setCurrentPage(1);
      const statusChip = parsed.keywords.find((chip) => chip.kind === 'status');
      const clientChip = parsed.keywords.find((chip) => chip.kind === 'client');
      const recruiterChip = parsed.keywords.find((chip) => chip.kind === 'recruiter');
      setStatusFilter(parsed.status || statusChip?.value || '');
      setClientFilterId(parsed.clientId || clientChip?.value || '');
      setRecruiterFilterId(parsed.recruiterId || recruiterChip?.value || '');
      setSearchFilter(parsed.searchText);
      setSmartSearchJobIds(
        parsed.matchingJobIds && parsed.matchingJobIds.length > 0 ? parsed.matchingJobIds : [],
      );
    },
    onRemoveKeyword: (removed, remaining) => {
      setCurrentPage(1);
      if (removed.kind === 'status') setStatusFilter('');
      if (removed.kind === 'client') setClientFilterId('');
      if (removed.kind === 'recruiter') setRecruiterFilterId('');
      if (removed.kind === 'text') {
        setSearchFilter(remaining.filter((k) => k.kind === 'text').map((k) => k.value).join(' '));
      }
    },
    examples: JOBS_SMART_SEARCH_EXAMPLES,
  });

  const displayJobs = useMemo(() => {
    if (jobSmartSearch.activeKeywords.length === 0) return jobs;
    return jobs.filter((job) => jobMatchesSmartKeywordChips(job, jobSmartSearch.activeKeywords));
  }, [jobs, jobSmartSearch.activeKeywords]);

  const hasActiveFilters = Boolean(
    smartSearchJobIds.length > 0 ||
    searchFilter ||
      statusFilter ||
      (!isStandaloneMode && clientFilterId) ||
      recruiterFilterId ||
      jobSmartSearch.activeKeywords.length > 0,
  );

  const handleClearToolbar = useCallback(() => {
    setCurrentPage(1);
    setSearchFilter('');
    setStatusFilter('');
    setClientFilterId(isStandaloneMode ? workspaceClientId : '');
    setRecruiterFilterId('');
    setSmartSearchJobIds([]);
    jobSmartSearch.clearSmartSearch();
  }, [isStandaloneMode, jobSmartSearch, workspaceClientId]);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportJobs, setExportJobs] = useState<Job[]>([]);
  const [exportJobsLoading, setExportJobsLoading] = useState(false);

  const fetchAllJobsForExport = useCallback(async (): Promise<Job[]> => {
    const allJobs = await fetchAllPaginated({
      fetchPage: async (page, limit) => {
        const jobsRes = await apiGetJobs({
          page,
          limit,
          search: searchFilter || undefined,
          status: statusFilter || undefined,
          clientId: clientFilterId || undefined,
          assignedToId: recruiterFilterId || undefined,
        });
        const parsed = parseJobsApiPayload(jobsRes);
        const backendJobs = Array.isArray(parsed.jobs) ? parsed.jobs : [];
        const pagination =
          jobsRes?.data && typeof jobsRes.data === 'object' && !Array.isArray(jobsRes.data)
            ? (jobsRes.data as { pagination?: { totalPages?: number; total?: number } }).pagination
            : undefined;
        return {
          items: backendJobs.map((job) => mapBackendJob(job, job._count?.matches || 0)),
          totalPages: totalPagesFromPagination(pagination, backendJobs.length, limit),
        };
      },
    });
    return Promise.all(allJobs.map((job) => enrichJobExportRow(job)));
  }, [clientFilterId, recruiterFilterId, searchFilter, statusFilter]);

  const openExportModal = async () => {
    setExportJobsLoading(true);
    setExportModalOpen(true);
    try {
      const all = await fetchAllJobsForExport();
      setExportJobs(all);
      if (all.length === 0) {
        toast.message('No jobs to export with current filters.');
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load jobs for export';
      toast.error(message);
      setExportModalOpen(false);
      setExportJobs([]);
    } finally {
      setExportJobsLoading(false);
    }
  };

  const handleExportJobsCsv = useCallback(
    (selectedColumnIds: string[]) => {
      const columns = buildJobsCsvColumns(selectedColumnIds);
      if (columns.length === 0) {
        toast.message('Select at least one column to export.');
        return;
      }
      const rowsToExport = exportJobs.length > 0 ? exportJobs : jobs;
      downloadCsv<Job>(`jobs-${new Date().toISOString().slice(0, 10)}.csv`, columns, rowsToExport);
      toast.success(`Exported ${rowsToExport.length} job${rowsToExport.length === 1 ? '' : 's'} to CSV`);
    },
    [exportJobs, jobs],
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem('currentUser');
      if (!raw) return;
      const parsed = JSON.parse(raw);
      setCurrentUserForCandidateDrawer(parsed);
    } catch {
      setCurrentUserForCandidateDrawer(null);
    }
  }, []);

  const buildJobsQueryParams = useCallback(
    () =>
      buildJobsListApiParams({
        currentPage,
        pageSize,
        searchFilter,
        statusFilter,
        clientFilterId,
        recruiterFilterId,
        matchingJobIds: smartSearchJobIds,
      }),
    [currentPage, pageSize, searchFilter, statusFilter, clientFilterId, recruiterFilterId, smartSearchJobIds],
  );

  useEffect(() => {
    hasVisibleJobsRef.current = jobs.length > 0;
  }, [jobs.length]);

  useEffect(() => {
    return () => {
      if (cloneDrawerTimerRef.current) {
        window.clearTimeout(cloneDrawerTimerRef.current);
      }
    };
  }, []);

  // Handle LinkedIn + X/Facebook OAuth return on the jobs page
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const linkedinParam = params.get('linkedin');
    const integrationConnected = params.get('integration_connected');
    const integrationError = params.get('integration_error');
    const shouldReopenAiWizard = sessionStorage.getItem('reopen_job_ai_wizard') === '1';
    const shouldReopenDrawer =
      !shouldReopenAiWizard &&
      (sessionStorage.getItem('reopen_create_job_drawer') === '1' ||
        linkedinParam === 'connected' ||
        linkedinParam === 'error' ||
        integrationConnected === 'twitter' ||
        integrationConnected === 'facebook' ||
        integrationError === 'twitter' ||
        integrationError === 'facebook');

    if (shouldReopenAiWizard) {
      const savedWizardMode = sessionStorage.getItem('reopen_job_ai_wizard_mode');
      sessionStorage.removeItem('reopen_job_ai_wizard_mode');
      setCreateJobMode(savedWizardMode === 'manual' ? 'manual' : 'ai');
      setJobAiWizardOpen(true);
      if (linkedinParam === 'connected') {
        toast.success('LinkedIn connected successfully.');
      } else if (linkedinParam === 'error') {
        toast.error(
          decodeURIComponent(params.get('message') || 'Failed to connect LinkedIn. Please try again.'),
        );
      }
    } else if (shouldReopenDrawer) {
      setCreateJobMode('manual');
      setCreateJobDrawerOpen(true);
      sessionStorage.removeItem('reopen_create_job_drawer');
      sessionStorage.removeItem('oauth_navigation');
      sessionStorage.removeItem('oauth_provider');
    }

    if (integrationConnected === 'twitter') {
      toast.success('X account connected successfully.');
    } else if (integrationConnected === 'facebook') {
      toast.success('Facebook account connected successfully.');
    } else if (integrationError === 'twitter') {
      toast.error('Failed to connect X account. Please try again.');
    } else if (integrationError === 'facebook') {
      toast.error('Failed to connect Facebook account. Please try again.');
    }

    if (linkedinParam || integrationConnected || integrationError) {
      const url = new URL(window.location.href);
      url.searchParams.delete('linkedin');
      url.searchParams.delete('message');
      url.searchParams.delete('integration_connected');
      url.searchParams.delete('integration_error');
      url.searchParams.delete('email');
      window.history.replaceState({}, '', url.pathname + (url.search || ''));
    }
  }, []);

  useEffect(() => {
    const syncMode = () => setIsStandaloneMode(getCachedOrgRecruitmentMode() === 'standalone');
    syncMode();
    window.addEventListener(ORG_RECRUITMENT_CACHE_EVENT, syncMode);
    return () => window.removeEventListener(ORG_RECRUITMENT_CACHE_EVENT, syncMode);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadFilterOptions = async () => {
      try {
        if (isStandaloneMode) {
          const workspaceRes = await apiGetWorkspaceClient();
          const workspaceClient = workspaceRes?.data?.workspaceClient;
          if (cancelled) return;

          if (workspaceClient?.id) {
            const workspaceId = String(workspaceClient.id);
            setWorkspaceClientId(workspaceId);
            setClientFilterId(workspaceId);
            setClientOptions([
              {
                id: workspaceId,
                name: workspaceClient.companyName || 'Your organization',
              },
            ]);
          } else {
            setWorkspaceClientId('');
            setClientFilterId('');
            setClientOptions([]);
          }

          let members = [];
          try {
            members = await getAllTeamMembersForAssign(getActiveOrgUnitId() || undefined, 'Jobs');
          } catch {
            members = [];
          }
          if (!members.length) {
            try {
              members = await getAllTeamMembersForDirectory();
            } catch {
              members = [];
            }
          }
          if (cancelled) return;
          const usersList = teamMembersToBackendUsers(members);
          const nextRecruiters = usersList
            .map((user) => ({ id: String(user.id), name: user.name || user.email || 'Unnamed member' }))
            .sort((a, b) => a.name.localeCompare(b.name));
          setRecruiterOptions(nextRecruiters);
          return;
        }

        const [clientsRes, members] = await Promise.all([
          apiGetClients({ page: 1, limit: 500 }),
          (async () => {
            try {
              const assigned = await getAllTeamMembersForAssign(getActiveOrgUnitId() || undefined, 'Jobs');
              if (assigned.length) return assigned;
            } catch {
              /* fall through to directory */
            }
            try {
              return await getAllTeamMembersForDirectory();
            } catch {
              return [];
            }
          })(),
        ]);
        if (cancelled) return;

        const clientsPayload = (clientsRes as any)?.data;
        const clientsList: BackendClient[] = Array.isArray(clientsPayload)
          ? clientsPayload
          : Array.isArray(clientsPayload?.data)
            ? clientsPayload.data
            : Array.isArray(clientsPayload?.items)
              ? clientsPayload.items
              : [];

        const usersList = teamMembersToBackendUsers(members);

        const nextClients = dedupeByCompanyName(
          clientsList
            .map((client) => ({ id: String(client.id), name: client.companyName || 'Unnamed client' }))
            .sort((a, b) => a.name.localeCompare(b.name)),
          (client) => client.name,
        );
        const nextRecruiters = usersList
          .map((user) => ({ id: String(user.id), name: user.name || user.email || 'Unnamed member' }))
          .sort((a, b) => a.name.localeCompare(b.name));

        setClientOptions(nextClients);
        setClientFilterId((current) =>
          current && !nextClients.some((client) => client.id === current) ? '' : current,
        );
        setRecruiterOptions(nextRecruiters);
      } catch (err) {
        if (!cancelled) {
          console.error('Failed to load jobs filter options:', err);
        }
      }
    };

    void loadFilterOptions();
    return () => {
      cancelled = true;
    };
  }, [isStandaloneMode]);

  const loadJobsPageData = useCallback(
    async (opts?: { silent?: boolean }) => {
      const silent = opts?.silent === true;
      if (!silent) {
        if (!hasVisibleJobsRef.current) setLoading(true);
        setError(null);
      }
      try {
        const jobsRes = await apiGetJobs(buildJobsQueryParams());

        const parsed = parseJobsApiPayload(jobsRes);
        if (!Array.isArray(parsed.jobs)) {
          if (!silent) {
            console.error('Unexpected API response format: data is not an array.', parsed);
            setError('Unexpected API response format.');
            setJobs([]);
            setTotalEntries(0);
          }
          return;
        }

        const mapped = parsed.jobs.map((job) => mapBackendJob(job));
        setJobs(mapped);
        const total = parsed.total || mapped.length;
        setTotalEntries(total);
        if (!hasActiveFilters) {
          writeJobsListCache({
            page: currentPage,
            pageSize,
            totalEntries: total,
            jobs: mapped,
          });
        }
      } catch (err: any) {
        if (!silent) {
          setError(err?.message || 'Failed to load jobs from API.');
          setJobs([]);
          setTotalEntries(0);
        } else {
          console.warn('[jobs] background refresh failed:', err);
        }
      } finally {
        if (!silent) setLoading(false);
      }

      if (silent) {
        try {
          const response = await apiGetJobMetrics({});
          const metrics = (response as any).data?.data || (response as any).data || response;
          setJobMetrics(metrics);
          writeJobsMetricsCache(metrics as Record<string, unknown>);
        } catch {
          /* keep cached metrics */
        }
        return;
      }

      try {
        setLoadingMetrics(true);
        const response = await apiGetJobMetrics({});
        const metrics = (response as any).data?.data || (response as any).data || response;
        setJobMetrics(metrics);
        writeJobsMetricsCache(metrics as Record<string, unknown>);
      } catch (err: any) {
        console.error('Failed to load job metrics:', err);
        setJobMetrics({
          activeJobs: 0,
          newJobsThisWeek: 0,
          appliedCandidates: 0,
          noCandidates: 0,
          nearSla: 0,
          closedThisMonth: 0,
        });
      } finally {
        setLoadingMetrics(false);
      }
    },
    [buildJobsQueryParams, currentPage, hasActiveFilters, pageSize]
  );

  useEffect(() => {
    const cached = readJobsListCache(currentPage, pageSize);
    void loadJobsPageData({ silent: Boolean(cached?.data?.jobs?.length) });
  }, [loadJobsPageData]);

  // Reusable auto-refresh: polls while visible, refreshes on focus and on
  // `jobportal:jobs-changed`. Same pattern is now reused on candidates / leads /
  // clients / interviews / dashboard so they stay in sync without manual reload.
  usePageAutoRefresh(loadJobsPageData, {
    shouldSkip: () => isJobsListCacheFresh(readJobsListCache(currentPage, pageSize)),
  });
  const { alertsByEntityId: workspaceAlertsByEntityId } = useWorkspaceEntityAlerts(
    'JOB',
    jobs.map((job) => job.id),
  );

  const [loadingJobDetails, setLoadingJobDetails] = useState(false);
  const [jobDetails, setJobDetails] = useState<JobForDrawer | null>(null);
  const [jobPipelineStages, setJobPipelineStages] = useState<any[]>([]);
  const [editJobDrawerOpen, setEditJobDrawerOpen] = useState(false);
  const [editingJobId, setEditingJobId] = useState<string | null>(null);
  const [jobMetrics, setJobMetrics] = useState<JobMetrics | null>(() => {
    const cached = readJobsMetricsCache();
    const parsed = cached?.data;
    if (
      parsed &&
      typeof parsed.activeJobs === 'number' &&
      typeof parsed.newJobsThisWeek === 'number' &&
      typeof parsed.nearSla === 'number' &&
      typeof parsed.closedThisMonth === 'number'
    ) {
      return {
        activeJobs: parsed.activeJobs,
        newJobsThisWeek: parsed.newJobsThisWeek,
        appliedCandidates: typeof parsed.appliedCandidates === 'number' ? parsed.appliedCandidates : 0,
        noCandidates: typeof parsed.noCandidates === 'number' ? parsed.noCandidates : 0,
        nearSla: parsed.nearSla,
        closedThisMonth: parsed.closedThisMonth,
      } as JobMetrics;
    }
    return null;
  });
  const [loadingMetrics, setLoadingMetrics] = useState(false);
  const [deletingJobId, setDeletingJobId] = useState<string | null>(null);

  const reloadMyJobsAndMetrics = useCallback(async () => {
    await loadJobsPageData({ silent: false });
  }, [loadJobsPageData]);

  const handleDeleteJob = async (jobId: string, jobTitle: string) => {
    if (!(await requestConfirm(`Are you sure you want to delete "${jobTitle}"? This action cannot be undone.`))) {
      return;
    }

    try {
      setDeletingJobId(jobId);
      await apiDeleteJob(jobId);
      invalidateEmployerJobsCache();
      
      // Remove from local state
      setJobs(prev => prev.filter(j => j.id !== jobId));
      
      // Close drawer if the deleted job was selected
      if (selectedJob?.id === jobId) {
        setJobDrawerOpen(false);
        setSelectedJob(null);
        setJobDetails(null);
        setJobPipelineStages([]);
      }
      
      // Reload metrics
      try {
        const response = await apiGetJobMetrics({});
        const metrics = (response as any).data?.data || (response as any).data || response;
        setJobMetrics(metrics);
      } catch (err) {
        console.error('Failed to refresh metrics:', err);
      }
      
      await reloadMyJobsAndMetrics();
    } catch (err: any) {
      console.error('Failed to delete job:', err);
      void requestError(err?.message || 'Failed to delete job');
    } finally {
      setDeletingJobId(null);
    }
  };

  const fetchJobCandidates = useCallback(async (jobId: string, backendJob?: any) => {
    const recruiterFallback = backendJob?.assignedTo?.name || 'Unassigned';
    const pipelineSeed = extractPipelineJobCandidateItems(backendJob, recruiterFallback);
    const applicationSeed = extractApplicationsJobCandidateItems(
      backendJob?.applications,
      recruiterFallback,
    );
    const matchSeed = (Array.isArray(backendJob?.matches) ? backendJob.matches : [])
      .filter((match: { evaluation?: unknown; createdById?: string | null }) =>
        isJobLinkedBackendMatch(match),
      )
      .map((match: any) => toJobCandidateItemFromApplied(match, recruiterFallback));
    const initialSeed = mergeJobCandidateSeeds(pipelineSeed, applicationSeed, matchSeed);
    try {
      const merged = await loadJobAppliedCandidates(jobId, {
        pipelineSeed: initialSeed,
        fallbackRecruiter: recruiterFallback,
      });
      setJobCandidates(merged);
    } catch (error) {
      console.error('Failed to fetch job-linked candidates:', error);
      setJobCandidates(initialSeed);
    }
  }, []);

  const hydrateJobDetailsFromBackend = useCallback(
    async (jobId: string, fallbackJob?: Job | null) => {
      const response = await apiGetJob(jobId);
      const backendJob = unwrapBackendJob(response);
      const mappedJob = mapBackendJobToJobForDrawer(backendJob, fallbackJob || undefined);
      setJobDetails(mappedJob);
      setJobPipelineStages(mapBackendPipelineStages(backendJob));
      await fetchJobCandidates(jobId, backendJob);
      return mappedJob;
    },
    [fetchJobCandidates],
  );

  const refreshJobDetails = useCallback(
    async (jobId: string) => {
      const fallbackJob = jobs.find((j) => j.id === jobId) || selectedJob;
      try {
        setLoadingJobDetails(true);
        await hydrateJobDetailsFromBackend(jobId, fallbackJob);
      } catch (error) {
        console.error('Failed to refresh job details:', error);
      } finally {
        setLoadingJobDetails(false);
      }
    },
    [hydrateJobDetailsFromBackend, jobs, selectedJob],
  );

  const openJobDrawer = async (job: Job) => {
    setSelectedJob(job);
    setJobDrawerOpen(true);
    setJobCandidates([]); // Reset candidates while fetching
    setJobDetails(null); // Reset until fetch completes

    try {
      setLoadingJobDetails(true);
      await hydrateJobDetailsFromBackend(job.id, job);
    } catch (error) {
      console.error('Failed to fetch job details:', error);
      setJobDetails(toJobForDrawer(job));
      setJobPipelineStages([]);
      setJobCandidates([]);
    } finally {
      setLoadingJobDetails(false);
    }
  };

  useEffect(() => {
    const jobId = searchParams.get('jobId');
    if (!jobId) {
      pendingDeepLinkJobIdRef.current = null;
      return;
    }
    // Only react when the URL parameter itself changes — without this guard,
    // closing the drawer used to re-fire the effect (because drawer-open and
    // selected-job both reset) and immediately reopen the same job.
    if (pendingDeepLinkJobIdRef.current === jobId) {
      return;
    }
    pendingDeepLinkJobIdRef.current = jobId;

    let cancelled = false;
    void (async () => {
      try {
        const response = await apiGetJob(jobId);
        if (cancelled) return;
        const backendJob = (response as any).data?.data || (response as any).data || response;
        if (!backendJob) return;
        const mappedJob = mapBackendJob(backendJob, backendJob._count?.applications || 0);
        await openJobDrawer(mappedJob);
      } catch (error) {
        console.error('Failed to open job from search:', error);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [searchParams]);

  const persistJobPipelineStages = useCallback(async (jobId: string, stages: Array<{ id?: string; name: string; sla?: string; systemRole?: string }>) => {
    if (!jobId) return;
    try {
      await apiUpdateJob(jobId, {
        pipelineStages: stages.map((stage, index) => ({
          id: stage.id,
          name: stage.name,
          sla: stage.sla,
          order: index + 1,
          systemRole: stage.systemRole,
        })),
      } as any);

      // Refresh pipeline stages so newly created stages get DB ids.
      const refreshed = await apiGetJob(jobId);
      const backendJob = (refreshed as any).data?.data || (refreshed as any).data || refreshed;
      if (backendJob?.pipelineStages && Array.isArray(backendJob.pipelineStages)) {
        setJobPipelineStages(
          backendJob.pipelineStages.map((s: any) => ({
            id: s.id,
            name: s.name,
            sla: '',
            systemRole: s.systemRole ?? undefined,
          }))
        );
      }
      toast.success('Pipeline updated');
    } catch (error) {
      console.error('Failed to save job pipeline stages:', error);
      toast.error((error as any)?.message || 'Failed to save pipeline');
    }
  }, []);

  const refreshJobCandidates = useCallback(
    async (jobId: string) => {
      try {
        const response = await apiGetJob(jobId);
        const backendJob = (response as any).data?.data || (response as any).data || response;
        await fetchJobCandidates(jobId, backendJob);
      } catch (error) {
        console.error('Failed to refresh job candidates:', error);
      }
    },
    [fetchJobCandidates]
  );

  const activeJobForCandidateDrawer = useMemo(() => {
    const j = jobDetails || (selectedJob ? toJobForDrawer(selectedJob) : null);
    if (!j?.id) return null;
    return { id: j.id, title: j.title, clientId: j.clientId, clientName: j.client };
  }, [jobDetails, selectedJob]);

  const candidateDrawerJobs = useMemo<CandidatePipelineJobOption[]>(() => {
    if (!activeJobForCandidateDrawer) return [];
    return [
      {
        id: activeJobForCandidateDrawer.id,
        title: activeJobForCandidateDrawer.title,
        clientId: activeJobForCandidateDrawer.clientId,
        clientName: activeJobForCandidateDrawer.clientName,
      },
    ];
  }, [activeJobForCandidateDrawer]);

  const candidateDrawerInterviewers = useMemo<CandidateInterviewerOption[]>(
    () =>
      scheduleInterviewers.map((member) => ({
        id: member.id,
        name: member.name,
        role: member.role,
        department: member.department,
        avatar: member.avatar,
      })),
    [scheduleInterviewers],
  );

  const candidateDrawerCurrentUser = useMemo(
    () => ({
      id: currentUserForCandidateDrawer?.id || currentUserForCandidateDrawer?._id || 'current-user',
      name: currentUserForCandidateDrawer?.name || selectedCandidateProfile?.recruiter || 'You',
      avatar: null as string | null,
    }),
    [currentUserForCandidateDrawer, selectedCandidateProfile?.recruiter],
  );

  const loadCandidateProfileInJobContext = useCallback(
    async (candidateId: string) => {
      if (!isValidObjectId(candidateId)) return null;
      const backendCandidate = extractApiData<BackendCandidate>(await apiGetCandidate(candidateId));
      let profile = mapCandidateProfile(backendCandidate);
      if (activeJobForCandidateDrawer) {
        profile = {
          ...profile,
          assignedJobId: activeJobForCandidateDrawer.id,
          assignedJob: activeJobForCandidateDrawer.title,
        };
      }
      setSelectedCandidateProfile(profile);
      return profile;
    },
    [activeJobForCandidateDrawer],
  );

  useEffect(() => {
    const onCandidatesChanged = () => {
      const openId = selectedCandidateProfile?.id;
      if (!openId || !isValidObjectId(openId)) return;
      void loadCandidateProfileInJobContext(openId);
    };
    window.addEventListener('jobportal:candidates-changed', onCandidatesChanged);
    return () => window.removeEventListener('jobportal:candidates-changed', onCandidatesChanged);
  }, [loadCandidateProfileInJobContext, selectedCandidateProfile?.id]);

  const openJobDrawerCandidateView = useCallback(
    async (candidate: Candidate) => {
      setCandidateDrawerMode('view');
      setCandidateEditOpenToken(null);
      setCandidateProfileDrawerOpen(true);
      setLoadingCandidateProfile(true);
      setSelectedCandidateProfile(
        candidateTableRowToProfileStub(candidate, {
          jobId: activeJobForCandidateDrawer?.id,
          jobTitle: activeJobForCandidateDrawer?.title,
        }),
      );
      try {
        await loadCandidateProfileInJobContext(candidate.id);
      } catch (error) {
        console.error('Failed to load candidate profile:', error);
        toast.error('Unable to load candidate profile');
      } finally {
        setLoadingCandidateProfile(false);
      }
    },
    [activeJobForCandidateDrawer, loadCandidateProfileInJobContext],
  );

  const openJobDrawerCandidateEdit = useCallback(
    async (candidate: Candidate) => {
      const editToken = Date.now();
      setCandidateDrawerMode('edit');
      setCandidateEditOpenToken(editToken);
      setCandidateProfileDrawerOpen(true);
      setLoadingCandidateProfile(true);
      setSelectedCandidateProfile(
        candidateTableRowToProfileStub(candidate, {
          jobId: activeJobForCandidateDrawer?.id,
          jobTitle: activeJobForCandidateDrawer?.title,
        }),
      );
      try {
        await loadCandidateProfileInJobContext(candidate.id);
      } catch (error) {
        console.error('Failed to load candidate profile for edit:', error);
        setCandidateEditOpenToken(null);
        setCandidateProfileDrawerOpen(false);
        toast.error('Unable to open the edit drawer right now.');
      } finally {
        setLoadingCandidateProfile(false);
      }
    },
    [activeJobForCandidateDrawer, loadCandidateProfileInJobContext],
  );

  const scheduleModalJobs = useMemo<CandidatePipelineJobOption[]>(() => {
    const j = jobDetails || (selectedJob ? toJobForDrawer(selectedJob) : null);
    if (!j?.id) return [];
    return [
      {
        id: j.id,
        title: j.title,
        clientId: j.clientId || null,
        clientName: j.client || null,
      },
    ];
  }, [jobDetails, selectedJob]);

  const schedulePopupCandidate = useMemo(() => {
    if (!schedulePrefill) return null;
    const row = jobCandidates.find((c) => c.id === schedulePrefill.candidateId);
    const job = jobDetails || (selectedJob ? toJobForDrawer(selectedJob) : null);
    return {
      id: schedulePrefill.candidateId,
      name: row?.candidateName || 'Candidate',
      phone: row?.phone || null,
      stage: row?.currentStage || null,
      assignedJob: job?.title || null,
      assignedJobId: schedulePrefill.jobId,
    };
  }, [schedulePrefill, jobCandidates, jobDetails, selectedJob]);

  const openScheduleInterviewFromJob = useCallback(
    async (
      candidateId: string,
      jobId: string,
      pendingStage?: { stageId: string; stageName: string },
    ) => {
      if (!canCreateInterview) return;
      try {
        const response = await apiGetUsers({ assignable: true, isActive: true, limit: 100 });
        const raw = (response as any).data;
        const users = unwrapCollection<BackendUser>(raw);
        setScheduleInterviewers(mapUsersToInterviewPanel(users));
      } catch {
        toast.error('Could not load interviewers');
        setScheduleInterviewers([]);
      }
      setSchedulePrefill({ candidateId, jobId });
      if (pendingStage) {
        setPendingStageAfterInterview({
          candidateId,
          jobId,
          stageId: pendingStage.stageId,
          stageName: pendingStage.stageName,
        });
      } else {
        setPendingStageAfterInterview(null);
      }
      setScheduleInterviewOpen(true);
    },
    [canCreateInterview]
  );

  const closeScheduleInterviewFromJob = useCallback(() => {
    setScheduleInterviewOpen(false);
    setSchedulePrefill(null);
    // Cancel without scheduling — do not change stage.
    setPendingStageAfterInterview(null);
  }, []);

  const openPlacementFromJob = useCallback(
    (
      candidateId: string,
      jobId: string,
      pendingStage?: { stageId: string; stageName: string },
    ) => {
      const job = jobDetails || (selectedJob ? toJobForDrawer(selectedJob) : null);
      const recruiterId =
        currentUserForCandidateDrawer?._id ||
        currentUserForCandidateDrawer?.id ||
        undefined;
      if (pendingStage?.stageId) {
        setPendingStageAfterPlacement({
          candidateId,
          jobId,
          stageId: pendingStage.stageId,
          stageName: pendingStage.stageName,
        });
      } else {
        setPendingStageAfterPlacement(null);
      }
      setPlacementPrefill({
        candidateId,
        jobId,
        companyId: job?.clientId || undefined,
        recruiterId,
      });
      setPlacementDrawerOpen(true);
    },
    [jobDetails, selectedJob, currentUserForCandidateDrawer],
  );

  const handleJobDrawerScheduleInterview = useCallback(
    async (interviewData: CandidateScheduledInterview) => {
      try {
        await apiScheduleCandidateInterview(interviewData.candidateId, {
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
        } as any);
      } catch (error: any) {
        toast.error(error?.message || 'Unable to schedule interview');
        throw error;
      }
      toast.success('Interview scheduled successfully');
      emitNotificationsUpdated();

      // Apply Interviewing stage only after the interview is actually scheduled.
      const pending = pendingStageAfterInterview;
      if (pending) {
        try {
          await apiMoveCandidateStage(pending.jobId, {
            candidateId: pending.candidateId,
            stageId: pending.stageId,
          });
        } catch (stageError: any) {
          console.error('Failed to apply stage after interview schedule:', stageError);
          toast.error(stageError?.message || 'Interview scheduled, but stage could not be updated');
        } finally {
          setPendingStageAfterInterview(null);
        }
      }

      const jid = jobDetails?.id || selectedJob?.id;
      if (jid) await refreshJobCandidates(jid);
    },
    [
      jobDetails?.id,
      selectedJob?.id,
      refreshJobCandidates,
      pendingStageAfterInterview,
    ]
  );

  useEffect(() => {
    let cancelled = false;
    const fetchJobStatusCatalog = async () => {
      try {
        const response = await apiGetJobStatusCatalog();
        if (cancelled) return;
        setJobStatusOptions(
          mergeJobStatusOptions(
            response?.data?.statuses,
            jobs.map((job) => job.status),
          ),
        );
      } catch (err) {
        if (cancelled) return;
        console.error('Failed to load job status catalog:', err);
        setJobStatusOptions(
          mergeJobStatusOptions(undefined, jobs.map((job) => job.status)),
        );
      }
    };
    void fetchJobStatusCatalog();
    return () => {
      cancelled = true;
    };
    // Intentional: load once on mount; current statuses merged via separate effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setJobStatusOptions((current) =>
      mergeJobStatusOptions(current, jobs.map((job) => job.status)),
    );
  }, [jobs]);

  const handleAppendJobStatusOption = useCallback(async (status: string) => {
    const response = await apiAppendJobStatus(status);
    const next = mergeJobStatusOptions(response?.data?.statuses, status);
    setJobStatusOptions(next);
    return next;
  }, []);

  const handleRemoveJobStatusOption = useCallback(async (status: string) => {
    const response = await apiRemoveJobStatus(status);
    const next = mergeJobStatusOptions(response?.data?.statuses, jobs.map((job) => job.status));
    setJobStatusOptions(next);
    return next;
  }, [jobs]);

  const handleInlineStatusChange = (id: string, newStatus: JobStatus) => {
    const current = jobs.find((j) => j.id === id);
    if (
      current &&
      isDraftJobStatus(newStatus) &&
      !canRevertJobToDraft(current.status)
    ) {
      toast.error('Once a job is Active, it cannot be set back to Draft.');
      return;
    }
    // Optimistically update UI
    setJobs(prev => prev.map(j => (j.id === id ? { ...j, status: newStatus } : j)));
    // Open remark editor for this row
    setStatusEdit({
      jobId: id,
      newStatus,
      remark: '',
    });
  };

  const handleRemarkChange = (remark: string) => {
    setStatusEdit(prev => ({
      ...prev,
      remark,
    }));
  };

  const handleSaveStatusEdit = async () => {
    if (!statusEdit.jobId || !statusEdit.newStatus) return;

    const jobId = statusEdit.jobId;
    const label = statusEdit.newStatus;
    try {
      await apiUpdateJob(jobId, {
        status: mapFrontendStatusToBackend(label) as any,
        statusLabel: label,
        statusRemark: statusEdit.remark || undefined,
      } as any);
      if (isArchivedFromJobsList(label)) {
        setJobs((prev) => prev.filter((j) => j.id !== jobId));
        setSelectedJob((prev) => (prev && prev.id === jobId ? null : prev));
        setJobDetails((prev) => (prev && prev.id === jobId ? null : prev));
        setJobDrawerOpen(false);
        toast.success(`Job marked "${label}" and removed from the active list.`);
      }
      await reloadMyJobsAndMetrics();
    } catch (err: any) {
      console.error('Failed to update job status with remark:', err);
      void requestError(err.message || 'Failed to update job status');
      await reloadMyJobsAndMetrics();
    } finally {
      setStatusEdit({ jobId: null, newStatus: null, remark: '' });
    }
  };

  const handleCancelStatusEdit = async () => {
    setStatusEdit({ jobId: null, newStatus: null, remark: '' });
    await reloadMyJobsAndMetrics();
  };

  const handleAddCandidateForJob = (job: Job) => {
    setSelectedJobForCandidate(job);
    setAddCandidateChooserOpen(true);
  };

  const loadPoolCandidates = useCallback(async (search: string) => {
    setPoolLoading(true);
    try {
      const response = await apiGetCandidates({ limit: 50, search: search || undefined });
      const raw = (response as any).data;
      const items: BackendCandidate[] = Array.isArray(raw)
        ? raw
        : raw?.data || raw?.items || [];
      setPoolCandidates(items);
    } catch (error) {
      console.error('Failed to load candidate pool:', error);
      setPoolCandidates([]);
    } finally {
      setPoolLoading(false);
    }
  }, []);

  const handleSelectFromPool = useCallback(
    async (candidate: BackendCandidate) => {
      const job = selectedJobForCandidate;
      if (!job?.id) return;
      setPoolAddingId(candidate.id);
      try {
        await apiAddCandidateToPipeline(candidate.id, {
          jobId: job.id,
          stage: 'Applied',
          priority: 'Medium',
        });
        toast.success(
          `${candidate.firstName || ''} ${candidate.lastName || ''}`.trim() ||
            'Candidate added to job'
        );
        setPoolPickerOpen(false);
        setSelectedJobForCandidate(null);
        await refreshJobCandidates(job.id);
        await reloadMyJobsAndMetrics();
      } catch (error: any) {
        toast.error(error?.message || 'Failed to add candidate to job');
      } finally {
        setPoolAddingId(null);
      }
    },
    [selectedJobForCandidate]
  );

  const handleCloneJob = (job: JobForDrawer) => {
    if (cloneDrawerTimerRef.current) {
      window.clearTimeout(cloneDrawerTimerRef.current);
      cloneDrawerTimerRef.current = null;
    }

    setJobDrawerOpen(false);
    setDuplicateFromJobId(job.id);
    cloneDrawerTimerRef.current = window.setTimeout(() => {
      setCreateJobDrawerOpen(true);
      cloneDrawerTimerRef.current = null;
    }, 220);
  };

  const handlePublishJob = async (job: JobForDrawer) => {
    try {
      await apiUpdateJob(job.id, { status: 'OPEN' } as CreateJobData);
      let applyUrl: string | null = null;
      try {
        const linkRes = await apiGetJobApplyLink(job.id);
        const linkData = (linkRes as { data?: { applyUrl?: string } })?.data ?? linkRes;
        applyUrl = (linkData as { applyUrl?: string })?.applyUrl ?? null;
      } catch {
        /* link may appear after next refresh */
      }
      const refreshed = await apiGetJob(job.id);
      const backendJob = (refreshed as { data?: Record<string, unknown> })?.data ?? refreshed;
      const mappedApplyUrl =
        applyUrl ||
        (typeof (backendJob as { applyUrl?: string })?.applyUrl === 'string'
          ? (backendJob as { applyUrl: string }).applyUrl
          : null);

      setJobDetails((prev) =>
        prev && prev.id === job.id
          ? { ...prev, status: 'Active', applyUrl: mappedApplyUrl || prev.applyUrl }
          : prev
      );
      setSelectedJob((prev) => (prev && prev.id === job.id ? { ...prev, status: 'Active' } : prev));
      setJobs((prev) =>
        prev.map((item) => (item.id === job.id ? { ...item, status: 'Active' } : item))
      );
      await reloadMyJobsAndMetrics();
      toast.success(
        mappedApplyUrl
          ? 'Job published. Apply link is ready in the job drawer.'
          : 'Job published successfully.'
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to publish job';
      void requestError(message);
    }
  };

  const handleCloseJob = async (job: JobForDrawer) => {
    if (!(await requestConfirm(`Close "${job.title}"? You can reopen it later by changing status.`))) {
      return;
    }

    try {
      await apiUpdateJob(job.id, {
        status: 'CLOSED' as any,
        statusLabel: 'Closed',
        statusRemark: 'Closed from Job drawer',
      } as any);

      setJobs((prev) => prev.filter((item) => item.id !== job.id));
      setSelectedJob((prev) => (prev && prev.id === job.id ? null : prev));
      setJobDetails((prev) => (prev && prev.id === job.id ? null : prev));
      setJobDrawerOpen(false);

      await reloadMyJobsAndMetrics();
      toast.success('Job closed and removed from the active list');
    } catch (err: any) {
      console.error('Failed to close job:', err);
      void requestError(err?.message || 'Failed to close job');
    }
  };

  return (
    <>
      <Toaster position="top-right" richColors />
      <Ph2ModulePageLayout
        title="Jobs"
        icon={<Briefcase className="h-5 w-5" strokeWidth={2.2} />}
        actions={
          <div className="flex flex-wrap items-center gap-2">
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
                      jobAiGate.confirmAndUnlock();
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
          <div className="mb-5 grid shrink-0 grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-5">
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
                <div className="relative w-full lg:max-w-md lg:flex-1">
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
                <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
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
                      placeholder="All clients"
                      allLabel="All clients"
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
                    isVisible={jobColumnVisibility.isVisible}
                    onToggle={jobColumnVisibility.toggle}
                    onReset={jobColumnVisibility.resetToDefault}
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
                    />
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

      <CreateJobDrawer
        isOpen={canCreateJob && createJobDrawerOpen}
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

      <JobAiCreateWizard
        isOpen={canCreateJob && jobAiWizardOpen}
        mode={createJobMode}
        onClose={() => setJobAiWizardOpen(false)}
        onJobCreated={() => {
          setJobAiWizardOpen(false);
          toast.success('Job published');
          void reloadMyJobsAndMetrics();
        }}
      />

      <JobDetailsDrawer
        isOpen={jobDrawerOpen}
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
      />

      <CandidateProfileDrawer
        key={`${selectedCandidateProfile?.id || 'job-candidate'}-${candidateDrawerMode}`}
        isOpen={candidateProfileDrawerOpen}
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
        onSubmitToClient={
          canSubmitToClient
            ? (profile) => {
                if (!profileCanSubmitToClient(profile) && !activeJobForCandidateDrawer?.id) {
                  void requestError(
                    'Submit to Client is only available for candidates assigned to, applied for, or in a job pipeline.',
                  );
                  return;
                }
                const jobId =
                  resolveSubmitJobIdForProfile(profile) || activeJobForCandidateDrawer?.id || null;
                if (!jobId) {
                  void requestError(
                    'Assign this candidate to a job (or add them to a pipeline) before submitting to the client.',
                  );
                  return;
                }
                void openSubmit({
                  candidateId: profile.id,
                  jobId,
                  candidateName: profile.name,
                  jobTitle: activeJobForCandidateDrawer?.title,
                  clientId: activeJobForCandidateDrawer?.clientId,
                });
              }
            : undefined
        }
        showSubmitToClient={canSubmitToClient}
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

      {submitModalElement}

      <CandidateScheduleInterviewModal
        isOpen={scheduleInterviewOpen}
        candidate={schedulePopupCandidate}
        linkedJobTitle={schedulePopupCandidate?.assignedJob || undefined}
        initialJobId={schedulePrefill?.jobId ?? null}
        jobs={scheduleModalJobs}
        interviewers={candidateDrawerInterviewers}
        existingInterviews={[]}
        onClose={closeScheduleInterviewFromJob}
        onSchedule={handleJobDrawerScheduleInterview}
      />

      <CreateJobDrawer
        isOpen={canUpdateJob && editJobDrawerOpen}
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

      <CreateTaskModal
        isOpen={createTaskOpen}
        onClose={() => setCreateTaskOpen(false)}
        onSuccess={() => setCreateTaskOpen(false)}
        initialRelatedTo="Job"
      />

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

      <CreatePlacementDrawer
        isOpen={placementDrawerOpen}
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

      <AddCandidateDrawer
        isOpen={canAddCandidate && addCandidateDrawerOpen}
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
      {canDeleteJob && (
        <ModuleRecycleBinDrawer
          isOpen={recycleBinDrawerOpen}
          onClose={() => setRecycleBinDrawerOpen(false)}
          kind="jobs"
          onRestored={() => void reloadMyJobsAndMetrics()}
        />
      )}
      <ExportColumnsModal
        isOpen={exportModalOpen}
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
      <style dangerouslySetInnerHTML={{ __html: `
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
          height: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #E2E8F0;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #CBD5E1;
        }
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
      `}} />
    </>
  );
}


