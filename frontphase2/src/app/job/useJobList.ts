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
import { fetchAllRecruitmentClientsForPicker } from '../../lib/recruitmentClients';
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

const JOBS_PIPELINE_STAGE_STORAGE_KEY = 'jobs.pipelineStageColumns';
/** All nested Pipeline stage ids (Columns → Pipeline ▾). */
const ALL_JOB_PIPELINE_STAGE_IDS = JOB_PIPELINE_STAGE_COLUMNS.map((col) => col.id);
const DEFAULT_JOB_PIPELINE_STAGE_IDS = ALL_JOB_PIPELINE_STAGE_IDS;

function readLocalColumnIds(moduleKey: string): string[] | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(tenantScopedStorageKey(moduleKey, readTenantColumnScope()));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return parsed.map((item) => String(item)).filter(Boolean);
  } catch {
    return null;
  }
}

function hasLocalColumnPrefs(moduleKey: string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(tenantScopedStorageKey(moduleKey, readTenantColumnScope())) != null;
  } catch {
    return false;
  }
}

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

export interface Job {
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
  ownerAvatar?: string | null;
  ownerEmail?: string | null;
  recruiterId?: string;
  supportingRecruiters?: string[];
  /** Resolved recruiter chips for avatar stack (primary + supporting). */
  recruiterAssignees?: Array<{ id?: string; name: string; avatar?: string; email?: string }>;
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
  hiringManagerId?: string | null;
  createdAt?: string;
  updatedAt?: string;
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

/** Map list Job to drawer JobForDrawer — never invent placeholder assignment names. */
export function toJobForDrawer(j: Job): JobForDrawer {
  const status = j.status as JobForDrawer['status'];
  const ownerLabel = String(j.owner || '').trim();
  const lead =
    ownerLabel && !/^(-|—|unassigned)$/i.test(ownerLabel) ? ownerLabel : undefined;
  const hiring = String(j.hiringManager || '').trim();
  return {
    ...j,
    status,
    employmentType: j.employmentType || undefined,
    salaryRange: undefined,
    postedDate: j.createdDate,
    recruiter: lead,
    owner: lead || 'Unassigned',
    hiringManager:
      hiring && !/^(-|—)$/i.test(hiring) ? hiring : undefined,
    hiringManagerId: (j as { hiringManagerId?: string | null }).hiringManagerId || null,
    supportingRecruiters: Array.isArray((j as { supportingRecruiters?: string[] }).supportingRecruiters)
      ? (j as { supportingRecruiters?: string[] }).supportingRecruiters
      : [],
    assignedToId: j.recruiterId || undefined,
    overview: undefined,
    keyResponsibilities: undefined,
    requiredSkills: undefined,
    preferredSkills: undefined,
    experienceRequired: undefined,
    education: undefined,
    benefits: undefined,
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
      ? formatDateDMY(backendJob.postedDate) || String(backendJob.postedDate).slice(0, 10)
      : backendJob.createdAt
        ? formatDateDMY(backendJob.createdAt) || String(backendJob.createdAt).slice(0, 10)
        : job?.createdDate,
    recruiter: formatAssigneeDisplayName(backendJob.assignedTo) || backendJob.assignedTo?.name || job?.owner,
    assignedToId: backendJob.assignedToId || backendJob.assignedTo?.id || job?.recruiterId || null,
    hiringManager: backendJob.hiringManager || undefined,
    hiringManagerId: backendJob.hiringManagerId || null,
    managerId: backendJob.managerId || backendJob.manager?.id || null,
    applied:
      typeof backendJob.appliedCount === 'number'
        ? backendJob.appliedCount
        : backendJob._count?.applications ?? job?.applied ?? 0,
    interviewed: backendJob._count?.interviews || job?.interviewed || 0,
    offered: 0,
    joined: backendJob._count?.placements || job?.joined || 0,
    openings: backendJob.openings || job?.openings || 0,
    owner: formatAssigneeDisplayName(backendJob.assignedTo) || backendJob.assignedTo?.name || job?.owner || '',
    orgUnitId:
      backendJob.orgUnitId ||
      backendJob.assignedTo?.assignCompanyId ||
      backendJob.assignedTo?.orgUnitId ||
      backendJob.assignedTo?.orgUnit?.id ||
      undefined,
    createdDate: backendJob.createdAt
      ? formatDateDMY(backendJob.createdAt) || String(backendJob.createdAt).slice?.(0, 10) || job?.createdDate || ''
      : job?.createdDate || '',
    jobCategory: backendJob.jobCategory || undefined,
    jobLocationType: backendJob.jobLocationType || undefined,
    salaryType: backendJob.salary?.type || undefined,
    salaryCurrency: backendJob.salary?.currency || undefined,
    salaryCurrencySymbol:
      (backendJob.salary as { currencySymbol?: string } | undefined)?.currencySymbol || undefined,
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
    applyLinkToken: backendJob.applyLinkToken || undefined,
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
      ? formatDateDMY(backendJob.expectedClosureDate) || String(backendJob.expectedClosureDate).slice(0, 10)
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

export interface JobStatusPillProps {
  status: JobStatus;
}

export interface PipelineSnapshotProps {
  applied: number;
  interviewed: number;
  offered: number;
  joined: number;
  /** Per-stage breakdown when the job has a configured pipeline. Falls back to APP/INT/OFF/JOI buckets when absent. */
  stages?: JobPipelineStageSummary[];
  /** When set, only these pipeline stage chips are shown (from Columns → Pipeline stages). */
  visibleStageKeys?: string[] | null;
}

export function normalizePipelineStageKey(value: string): string {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, '');
}

function pipelineStageMatchesKey(stage: JobPipelineStageSummary, stageKey: string): boolean {
  const key = normalizePipelineStageKey(stageKey);
  if (!key) return false;
  const nameKey = normalizePipelineStageKey(stage.name);
  const roleKey = normalizePipelineStageKey(String(stage.systemRole || ''));

  if (nameKey === key || roleKey === key) return true;

  if (key === 'applied') {
    return (
      roleKey === 'applied' ||
      nameKey === 'applied' ||
      nameKey === 'apply' ||
      (nameKey.includes('appli') && !nameKey.includes('client'))
    );
  }
  if (key === 'screening') {
    return roleKey === 'screening' || /screen|short|long/.test(nameKey);
  }
  if (key === 'submittoclient' || key === 'submit-to-client') {
    return (
      (nameKey.includes('submit') && nameKey.includes('client')) ||
      nameKey.includes('submittedtoclient')
    );
  }
  if (key === 'interviewing') {
    return roleKey === 'interview' || nameKey.includes('interview');
  }
  if (key === 'offer') {
    return roleKey === 'offer' || nameKey.includes('offer');
  }
  if (key === 'hired') {
    return roleKey === 'hired' || /hire|join|placed/.test(nameKey);
  }
  if (key === 'rejected') {
    return nameKey.includes('reject');
  }

  return nameKey.includes(key) || key.includes(nameKey);
}

export function filterPipelineStagesForColumns(
  stages: JobPipelineStageSummary[] | undefined,
  visibleStageKeys: string[] | null | undefined,
): JobPipelineStageSummary[] {
  const list = Array.isArray(stages) ? stages : [];
  // null/undefined = no Columns filter yet → show all. Empty array = user hid every stage.
  if (visibleStageKeys == null) return list;
  if (visibleStageKeys.length === 0) return [];
  return list.filter((stage) =>
    visibleStageKeys.some((key) => pipelineStageMatchesKey(stage, key)),
  );
}

export const LEGACY_PIPELINE_BUCKETS: Array<{
  key: 'applied' | 'interviewed' | 'offered' | 'joined';
  label: string;
  stageKeys: string[];
}> = [
  { key: 'applied', label: 'APP', stageKeys: ['applied', 'screening'] },
  { key: 'interviewed', label: 'INT', stageKeys: ['interviewing'] },
  { key: 'offered', label: 'OFF', stageKeys: ['offer'] },
  { key: 'joined', label: 'JOI', stageKeys: ['hired'] },
];

export const SYSTEM_ROLE_TO_LEGACY_KEY: Record<string, 'applied' | 'interviewed' | 'offered' | 'joined'> = {
  APPLIED: 'applied',
  SCREENING: 'applied',
  INTERVIEW: 'interviewed',
  OFFER: 'offered',
  HIRED: 'joined',
};

export const SYSTEM_ROLE_NAME_FALLBACK: Array<{
  match: RegExp;
  key: 'applied' | 'interviewed' | 'offered' | 'joined';
}> = [
  { match: /appli|screen/i, key: 'applied' },
  { match: /interview|review|assess/i, key: 'interviewed' },
  { match: /offer/i, key: 'offered' },
  { match: /hire|placed|join/i, key: 'joined' },
];

export function abbreviateStage(name: string): string {
  const trimmed = String(name || '').trim();
  if (!trimmed) return '—';
  const word = trimmed.split(/\s+/)[0];
  return word.slice(0, 3).toUpperCase();
}

export interface JobsListViewProps {
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
  /** Selected Pipeline stage keys from Columns menu (without prefix). */
  visiblePipelineStageKeys?: string[] | null;
}

// No fallback mock data - use empty array if API fails

// Stats from API — tiles use <SummaryCard /> so height/layout match Leads.
export const STATS_CONFIG: Array<{
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
  const currencySymbol = String(
    (salary as { currencySymbol?: string | null }).currencySymbol || '',
  ).trim();
  const formatted = formatJobSalaryDisplay({
    currency,
    currencySymbol,
    min: salary.min,
    max: salary.max,
    amount: salary.amount !== undefined && salary.amount !== null ? String(salary.amount) : null,
  });
  return formatted || undefined;
}

function emptyMappedJob(id = ''): Job {
  return {
    id,
    title: 'Untitled job',
    client: '-',
    location: '-',
    status: 'Active',
    applied: 0,
    interviewed: 0,
    offered: 0,
    joined: 0,
    openings: 0,
    owner: 'Unassigned',
    ownerAvatar: null,
    ownerEmail: null,
    recruiterAssignees: [],
    createdDate: '-',
    hot: false,
    aiMatch: false,
    noCandidates: false,
    slaRisk: false,
  };
}

function buildJobRecruiterAssignees(
  job: Pick<Job, 'owner' | 'ownerAvatar' | 'ownerEmail' | 'recruiterId' | 'supportingRecruiters'>,
  teamMembers: Array<{ id: string; name: string; avatar?: string; email?: string }> = [],
): Array<{ id?: string; name: string; avatar?: string; email?: string }> {
  const byId = new Map(teamMembers.map((m) => [String(m.id), m]));
  const out: Array<{ id?: string; name: string; avatar?: string; email?: string }> = [];
  const ownerName = String(job.owner || '').trim();
  if (ownerName && !/^(-|—|unassigned)$/i.test(ownerName)) {
    const primary = job.recruiterId ? byId.get(String(job.recruiterId)) : undefined;
    out.push({
      id: job.recruiterId || primary?.id,
      name: ownerName,
      avatar: job.ownerAvatar || primary?.avatar || undefined,
      email: job.ownerEmail || primary?.email || undefined,
    });
  }
  for (const rawId of job.supportingRecruiters || []) {
    const id = String(rawId || '').trim();
    if (!id) continue;
    if (job.recruiterId && id === String(job.recruiterId)) continue;
    if (out.some((u) => u.id && String(u.id) === id)) continue;
    const member = byId.get(id);
    if (member?.name) {
      out.push({
        id: member.id,
        name: member.name,
        avatar: member.avatar,
        email: member.email,
      });
    }
  }
  return out;
}

function asStringList(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const list = value.map((item) => String(item ?? '').trim()).filter(Boolean);
  return list.length ? list : undefined;
}

function mapBackendJob(job: BackendJob): Job {
  if (!job || typeof job !== 'object') {
    return emptyMappedJob();
  }
  try {
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
    ownerAvatar: job.assignedTo?.avatar || null,
    ownerEmail: job.assignedTo?.email || null,
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
    auditMeta: extractAuditMeta(job as unknown as Record<string, unknown>),
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
    hiringManagerId: (job as { hiringManagerId?: string | null }).hiringManagerId || null,
    managerName: job.manager?.name || undefined,
    workMode: job.workMode || undefined,
    skills: asStringList(job.skills),
    requirements: asStringList(job.requirements),
    keyResponsibilities: asStringList(job.keyResponsibilities),
    preferredSkills: asStringList(job.preferredSkills),
    candidateRequirements: asStringList(job.candidateRequirements),
    benefits: asStringList(job.benefits),
    languages: Array.isArray(job.languages) ? job.languages : undefined,
    supportingRecruiters: Array.isArray((job as { supportingRecruiters?: string[] }).supportingRecruiters)
      ? (job as { supportingRecruiters?: string[] }).supportingRecruiters!.map(String)
      : undefined,
    recruiterAssignees: buildJobRecruiterAssignees(
      {
        owner: formatAssigneeDisplayName(job.assignedTo) || job.assignedTo?.name || 'Unassigned',
        ownerAvatar: job.assignedTo?.avatar || null,
        ownerEmail: job.assignedTo?.email || null,
        recruiterId: job.assignedToId || job.assignedTo?.id,
        supportingRecruiters: Array.isArray((job as { supportingRecruiters?: string[] }).supportingRecruiters)
          ? (job as { supportingRecruiters?: string[] }).supportingRecruiters!.map(String)
          : undefined,
      },
      [],
    ),
  };
  } catch (error) {
    console.error('[jobs] mapBackendJob failed', error);
    return emptyMappedJob(String((job as { id?: string }).id || ''));
  }
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
    location: resolveCandidateLocationLabel(candidate),
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
  return (Array.isArray(users) ? users : []).map((user) => {
    const name = stripAssigneeCompanySuffix(safeDisplayText(user.name, 'Unknown User')) || 'Unknown User';
    return {
      id: user.id,
      userId: user.id,
      name,
      role: 'Technical',
      department: safeDisplayText(user.department, 'General'),
      email: sanitizeScheduleEmail(user.email) || 'No email available',
      phone: '-',
      avatar: initialsFromScheduleName(name, 'NA'),
    };
  });
}


export function useJobList() {
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
  const jobAiGate = useAiCoinGate('ai.job_from_prompt');
  const [searchFilter, setSearchFilter] = useState('');
  const debouncedSearchFilter = useDebouncedValue(searchFilter, 500);
  const jobsRequestGate = useListRequestGate();
  const jobsRequestGateRef = useRef(jobsRequestGate);
  jobsRequestGateRef.current = jobsRequestGate;
  const jobTableColumnsFlat = useMemo(
    () => flattenTableColumns(JOB_TABLE_COLUMNS, { includeChildren: false }),
    [],
  );
  const jobColumnVisibility = usePersistedColumnVisibility('jobs.visibleColumns', jobTableColumnsFlat);
  const [storedPipelineStageIds, setStoredPipelineStageIds] = useTenantScopedStringArray(
    JOBS_PIPELINE_STAGE_STORAGE_KEY,
  );
  const [pipelineStagePrefsSaved, setPipelineStagePrefsSaved] = useState(() =>
    hasLocalColumnPrefs(JOBS_PIPELINE_STAGE_STORAGE_KEY),
  );

  // One-time migration: earlier builds stored pipelineStage:* inside jobs.visibleColumns.
  useEffect(() => {
    const mainIds = readLocalColumnIds('jobs.visibleColumns');
    if (!mainIds?.length) return;
    const leaked = mainIds.filter((id) => id.startsWith(JOB_PIPELINE_STAGE_COLUMN_PREFIX));
    if (!leaked.length) return;
    const stageStored = readLocalColumnIds(JOBS_PIPELINE_STAGE_STORAGE_KEY);
    if (stageStored === null) {
      setStoredPipelineStageIds(leaked);
      setPipelineStagePrefsSaved(true);
    }
    jobColumnVisibility.setVisibleIds((prev) =>
      prev.filter((id) => !id.startsWith(JOB_PIPELINE_STAGE_COLUMN_PREFIX)),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const effectivePipelineStageIds =
    pipelineStagePrefsSaved || storedPipelineStageIds.length > 0
      ? storedPipelineStageIds.length > 0
        ? storedPipelineStageIds
        : ALL_JOB_PIPELINE_STAGE_IDS
      : DEFAULT_JOB_PIPELINE_STAGE_IDS;

  // Empty [] was treated as "show all" in the table but "none checked" in Columns —
  // heal that so Pipeline ▾ ticks match what's on screen.
  useEffect(() => {
    if (!pipelineStagePrefsSaved) return;
    if (storedPipelineStageIds.length > 0) return;
    if (!jobColumnVisibility.isVisible('pipeline')) return;
    setStoredPipelineStageIds(ALL_JOB_PIPELINE_STAGE_IDS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pipelineStagePrefsSaved, storedPipelineStageIds.length]);

  const visiblePipelineStageKeys = useMemo(
    () =>
      effectivePipelineStageIds
        .filter((id) => id.startsWith(JOB_PIPELINE_STAGE_COLUMN_PREFIX))
        .map((id) => id.slice(JOB_PIPELINE_STAGE_COLUMN_PREFIX.length)),
    [effectivePipelineStageIds],
  );

  const isJobColumnVisible = useCallback(
    (id: string) => {
      if (id.startsWith(JOB_PIPELINE_STAGE_COLUMN_PREFIX)) {
        return effectivePipelineStageIds.includes(id);
      }
      return jobColumnVisibility.isVisible(id);
    },
    [effectivePipelineStageIds, jobColumnVisibility.isVisible],
  );

  const toggleJobColumn = useCallback(
    (id: string) => {
      // Location display modes use radios + shared storage — never toggle as column ids.
      if (id.startsWith(LOCATION_DISPLAY_COLUMN_PREFIX)) return;
      if (id.startsWith(JOB_PIPELINE_STAGE_COLUMN_PREFIX)) {
        setStoredPipelineStageIds((prev) => {
          const base =
            pipelineStagePrefsSaved || prev.length > 0 ? prev : DEFAULT_JOB_PIPELINE_STAGE_IDS;
          return base.includes(id) ? base.filter((item) => item !== id) : [...base, id];
        });
        setPipelineStagePrefsSaved(true);
        return;
      }
      // Turning Pipeline on → select every nested stage so Columns shows ticks.
      if (id === 'pipeline') {
        const turningOn = !jobColumnVisibility.isVisible('pipeline');
        jobColumnVisibility.toggle('pipeline');
        if (turningOn) {
          setStoredPipelineStageIds(ALL_JOB_PIPELINE_STAGE_IDS);
          setPipelineStagePrefsSaved(true);
        }
        return;
      }
      jobColumnVisibility.toggle(id);
    },
    [
      jobColumnVisibility.isVisible,
      jobColumnVisibility.toggle,
      pipelineStagePrefsSaved,
      setStoredPipelineStageIds,
    ],
  );

  const resetJobColumns = useCallback(() => {
    jobColumnVisibility.resetToDefault();
    setStoredPipelineStageIds(DEFAULT_JOB_PIPELINE_STAGE_IDS);
    setPipelineStagePrefsSaved(true);
  }, [jobColumnVisibility.resetToDefault, setStoredPipelineStageIds]);
  const [statusFilter, setStatusFilter] = useState('');
  const [clientFilterId, setClientFilterId] = useState('');
  const [recruiterFilterId, setRecruiterFilterId] = useState('');
  const [isStandaloneMode, setIsStandaloneMode] = useState(
    () => typeof window !== 'undefined' && getCachedOrgRecruitmentMode() === 'standalone',
  );
  const [workspaceClientId, setWorkspaceClientId] = useState('');
  const [smartSearchJobIds, setSmartSearchJobIds] = useState<string[]>([]);
  const [clientOptions, setClientOptions] = useState<Array<{ id: string; name: string }>>([]);
  const [recruiterOptions, setRecruiterOptions] = useState<
    Array<{ id: string; name: string; avatar?: string; email?: string }>
  >([]);
  const [createTaskOpen, setCreateTaskOpen] = useState(false);
  const [createJobDrawerOpen, setCreateJobDrawerOpen] = useState(false);
  const [jobAiWizardOpen, setJobAiWizardOpen] = useState(false);
  const [createJobMode, setCreateJobMode] = useState<'ai' | 'manual'>('manual');
  const [recycleBinDrawerOpen, setRecycleBinDrawerOpen] = useState(false);
  const [showSummaryCards, setShowSummaryCards] = useState(false);
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
  const [availableDrawerTags, setAvailableDrawerTags] = useState<CandidateTagItem[]>([]);
  const [scheduleInterviewOpen, setScheduleInterviewOpen] = useState(false);
  const [schedulePrefill, setSchedulePrefill] = useState<{ candidateId: string; jobId: string } | null>(null);
  const [scheduleBulkCandidateIds, setScheduleBulkCandidateIds] = useState<string[]>([]);
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
    const list = Array.isArray(jobs) ? jobs.filter((job) => job && job.id) : [];
    const enriched = list.map((job) => ({
      ...job,
      recruiterAssignees: buildJobRecruiterAssignees(job, recruiterOptions),
    }));
    const filtered =
      jobSmartSearch.activeKeywords.length === 0
        ? enriched
        : enriched.filter((job) => jobMatchesSmartKeywordChips(job, jobSmartSearch.activeKeywords));

    const relevanceQuery =
      debouncedSearchFilter ||
      jobSmartSearch.activeKeywords
        .filter((chip) => chip.kind === 'text')
        .map((chip) => chip.value)
        .join(' ');

    if (!String(relevanceQuery || '').trim()) return filtered;

    return sortByQuickSearchRelevance(
      filtered,
      relevanceQuery,
      (job) => ({
        primary: job.title,
        secondary: [job.client, ...(Array.isArray(job.skills) ? job.skills : [])],
        tertiary: [job.location, job.city, job.country, job.owner],
      }),
      (job) => job.updatedAt || job.createdAt,
    );
  }, [jobs, jobSmartSearch.activeKeywords, recruiterOptions, debouncedSearchFilter]);

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
          search: debouncedSearchFilter || undefined,
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
          items: backendJobs.map((job) => mapBackendJob(job)),
          totalPages: totalPagesFromPagination(pagination, backendJobs.length, limit),
        };
      },
    });
    return Promise.all(allJobs.map((job) => enrichJobExportRow(job)));
  }, [clientFilterId, recruiterFilterId, debouncedSearchFilter, statusFilter]);

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
        searchFilter: debouncedSearchFilter,
        statusFilter,
        clientFilterId,
        recruiterFilterId,
        matchingJobIds: smartSearchJobIds,
      }),
    [currentPage, pageSize, debouncedSearchFilter, statusFilter, clientFilterId, recruiterFilterId, smartSearchJobIds],
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

          let members: Awaited<ReturnType<typeof getAllTeamMembersForAssign>> = [];
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
            .map((user) => ({
              id: String(user.id),
              name: user.name || user.email || 'Unnamed member',
              avatar: user.avatar || undefined,
              email: user.email || undefined,
            }))
            .sort((a, b) => a.name.localeCompare(b.name));
          setRecruiterOptions(nextRecruiters);
          return;
        }

        const [clientsList, members] = await Promise.all([
          fetchAllRecruitmentClientsForPicker(),
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

        const usersList = teamMembersToBackendUsers(members);

        const nextClients = dedupeByCompanyName(
          clientsList
            .map((client) => ({ id: String(client.id), name: client.companyName || 'Unnamed client' }))
            .sort((a, b) => a.name.localeCompare(b.name)),
          (client) => client.name,
        );
        const nextRecruiters = usersList
          .map((user) => ({
            id: String(user.id),
            name: user.name || user.email || 'Unnamed member',
            avatar: user.avatar || undefined,
            email: user.email || undefined,
          }))
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
      const gate = jobsRequestGateRef.current;
      const isSearchRequest = Boolean(String(debouncedSearchFilter || '').trim()) || smartSearchJobIds.length > 0;
      const { requestId, signal } = gate.beginRequest();
      if (!silent) {
        if (!hasVisibleJobsRef.current) setLoading(true);
        setError(null);
      }
      try {
        const jobsRes = await apiGetJobs({
          ...buildJobsQueryParams(),
          signal,
        });
        if (!gate.isCurrent(requestId)) return;

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

        const mapped = parsed.jobs
          .filter((job): job is BackendJob => Boolean(job && typeof job === 'object' && (job as BackendJob).id))
          .map((job) => mapBackendJob(job));
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
        if (gate.isAbortError(err) || !gate.isCurrent(requestId)) return;
        if (!silent) {
          setError(err?.message || 'Failed to load jobs from API.');
          setJobs([]);
          setTotalEntries(0);
        } else {
          console.warn('[jobs] background refresh failed:', err);
        }
      } finally {
        if (!silent && gate.isCurrent(requestId)) setLoading(false);
      }

      // Skip metrics refetch while typing/searching — keeps the table snappy.
      if (silent || isSearchRequest || !gate.isCurrent(requestId)) {
        return;
      }

      try {
        setLoadingMetrics(true);
        const response = await apiGetJobMetrics({});
        if (!gate.isCurrent(requestId)) return;
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
        if (gate.isCurrent(requestId)) setLoadingMetrics(false);
      }
    },
    [buildJobsQueryParams, currentPage, debouncedSearchFilter, hasActiveFilters, pageSize, smartSearchJobIds.length]
  );

  // Reset to page 1 when search text settles so results aren't on an empty deep page.
  useEffect(() => {
    setCurrentPage((page) => (page === 1 ? page : 1));
  }, [debouncedSearchFilter]);

  useEffect(() => {
    const cached = readJobsListCache(currentPage, pageSize);
    const searching = Boolean(String(debouncedSearchFilter || '').trim()) || smartSearchJobIds.length > 0;
    void loadJobsPageData({
      silent: Boolean(cached?.data?.jobs?.length) || (searching && hasVisibleJobsRef.current),
    });
  }, [loadJobsPageData]);

  // Reusable auto-refresh: polls while visible, refreshes on focus and on
  // `jobportal:jobs-changed`. Same pattern is now reused on candidates / leads /
  // clients / interviews / dashboard so they stay in sync without manual reload.
  usePageAutoRefresh(loadJobsPageData, {
    shouldSkip: () => isJobsListCacheFresh(readJobsListCache(currentPage, pageSize)),
  });
  const { alertsByEntityId: workspaceAlertsByEntityId } = useWorkspaceEntityAlerts(
    'JOB',
    (Array.isArray(jobs) ? jobs : []).map((job) => job.id),
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
    invalidateEmployerJobsCache();
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
        const mappedJob = mapBackendJob(backendJob);
        await openJobDrawer(mappedJob);
      } catch (error) {
        console.error('Failed to open job from search:', error);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [searchParams]);

  const persistJobPipelineStages = useCallback(async (jobId: string, stages: Array<{ id?: string; name: string; sla?: string; systemRole?: string | null }>) => {
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
        orgUnitId: String((j as { orgUnitId?: string | null }).orgUnitId || '').trim() || null,
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
      bulkCandidateIds?: string[],
    ) => {
      if (!canCreateInterview) return;
      try {
        const response = await apiGetUsers({
          assignable: true,
          isActive: true,
          limit: 200,
          module: 'Interviews',
          companyId: getActiveOrgUnitId() || undefined,
        });
        const raw = (response as any).data;
        const users = unwrapCollection<BackendUser>(raw);
        setScheduleInterviewers(mapUsersToInterviewPanel(users));
      } catch {
        toast.error('Could not load interviewers');
        setScheduleInterviewers([]);
      }
      setSchedulePrefill({ candidateId, jobId });
      const bulkIds = Array.isArray(bulkCandidateIds)
        ? bulkCandidateIds.map((id) => String(id || '').trim()).filter(Boolean)
        : [];
      setScheduleBulkCandidateIds(bulkIds.length > 1 ? bulkIds : []);
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
    setScheduleBulkCandidateIds([]);
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
      const targetIds =
        scheduleBulkCandidateIds.length > 1
          ? scheduleBulkCandidateIds
          : [interviewData.candidateId];

      let succeeded = 0;
      let failed = 0;
      for (const candidateId of targetIds) {
        try {
          await apiScheduleCandidateInterview(candidateId, {
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
          succeeded += 1;
        } catch {
          failed += 1;
        }
      }

      if (succeeded === 0) {
        toast.error('Unable to schedule interview');
        throw new Error('Schedule failed');
      }

      toast.success(
        succeeded === 1
          ? 'Interview scheduled successfully'
          : `Scheduled ${succeeded} interview${succeeded === 1 ? '' : 's'} successfully`,
      );
      if (failed > 0) {
        toast.error(
          `${failed} candidate${failed === 1 ? '' : 's'} could not be scheduled.`,
        );
      }
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

      setScheduleBulkCandidateIds([]);
      const jid = jobDetails?.id || selectedJob?.id;
      if (jid) await refreshJobCandidates(jid);
      invalidateEmployerCandidatesCache();
    },
    [
      jobDetails?.id,
      selectedJob?.id,
      refreshJobCandidates,
      pendingStageAfterInterview,
      scheduleBulkCandidateIds,
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
            (Array.isArray(jobs) ? jobs : []).map((job) => job.status),
          ),
        );
      } catch (err) {
        if (cancelled) return;
        console.error('Failed to load job status catalog:', err);
        setJobStatusOptions(
          mergeJobStatusOptions(undefined, (Array.isArray(jobs) ? jobs : []).map((job) => job.status)),
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
      mergeJobStatusOptions(current, (Array.isArray(jobs) ? jobs : []).map((job) => job.status)),
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
    const next = mergeJobStatusOptions(
      response?.data?.statuses,
      (Array.isArray(jobs) ? jobs : []).map((job) => job.status),
    );
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
      const backendJob = (refreshed as unknown as { data?: Record<string, unknown> })?.data ?? refreshed;
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

  return {
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
  };
}
