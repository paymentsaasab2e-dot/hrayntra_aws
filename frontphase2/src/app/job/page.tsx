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
} from 'lucide-react';
import { AiCoinLockBadge, useAiCoinGate } from '../../components/coins/AiCoinGate';
import { downloadCsv } from '../../utils/csv';
import { ExportColumnsModal } from '../../components/export/ExportColumnsModal';
import { buildJobsCsvColumns, JOBS_EXPORT_COLUMNS } from '../../lib/export/jobsExportColumns';
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
import { ScheduleInterviewModal } from '../../components/interviews/ScheduleInterviewModal';
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
  apiCreateInterview,
  emitNotificationsUpdated,
  apiGetUsers,
  type BackendClient,
  type BackendJob,
  type BackendCandidate,
  type BackendUser,
  type JobMetrics,
  type CreateJobData,
  getCachedOrgRecruitmentMode,
  ORG_RECRUITMENT_CACHE_EVENT,
} from '../../lib/api';
import type { Candidate } from '../candidate/components/CandidateTable';
import {
  CandidateProfileDrawer,
  type CandidateInterviewerOption,
  type CandidatePipelineJobOption,
  type CandidateProfileDrawerData,
  type CandidateTagItem,
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
import { combineInterviewDateAndTimeToIso, mapInterviewUiTypeToBackend } from '../../lib/interview-schedule-helpers';
import type {
  InterviewCandidate,
  InterviewJob,
  InterviewPanelMember,
  ScheduleInterviewPayload,
} from '../../types/interview.types';
import { getAllTeamMembersForAssign, teamMembersToBackendUsers } from '../../lib/api/teamApi';
import { usePermissions } from '../../hooks/usePermissions';
import { usePageAutoRefresh } from '../../hooks/usePageAutoRefresh';
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

// Force CSR so the page hydrates skeleton placeholders before the first data
// fetch resolves — every interactive bit on this tab is client-driven.
export const dynamic = 'force-dynamic';

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 10;
const JOBS_PAGE_CACHE_KEY = 'jobs:page-cache:v1';
const JOBS_METRICS_CACHE_KEY = 'jobs:metrics-cache:v1';

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
type JobStatus = 'Active' | 'On Hold' | 'Closed';

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
    status: mapBackendStatus(backendJob.status) as JobForDrawer['status'],
    employmentType: formatEmploymentType(backendJob.type) || undefined,
    salaryRange: formatSalaryRange(backendJob.salary),
    postedDate: backendJob.postedDate
      ? new Date(backendJob.postedDate).toISOString().split('T')[0]
      : backendJob.createdAt
        ? backendJob.createdAt.split('T')[0]
        : job?.createdDate,
    recruiter: backendJob.assignedTo?.name || job?.owner,
    hiringManager: backendJob.hiringManager || undefined,
    applied:
      typeof backendJob.appliedCount === 'number'
        ? backendJob.appliedCount
        : backendJob._count?.applications ?? job?.applied ?? 0,
    interviewed: backendJob._count?.interviews || job?.interviewed || 0,
    offered: 0,
    joined: backendJob._count?.placements || job?.joined || 0,
    openings: backendJob.openings || job?.openings || 0,
    owner: backendJob.assignedTo?.name || job?.owner || '',
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
  workspaceAlertsByEntityId?: Record<string, AiWorkspaceBriefAlert[]>;
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
  const styles: Record<JobStatus, string> = {
    Active: 'bg-green-100 text-green-700 border-green-200',
    'On Hold': 'bg-amber-100 text-amber-700 border-amber-200',
    Closed: 'bg-gray-100 text-gray-700 border-gray-200',
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold border ${styles[status]}`}>
      {status}
    </span>
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

const JobsListView = ({ jobs, onJobClick, onEditJob, onAddCandidate, onDeleteJob, deletingJobId, canUpdateJob, canDeleteJob, canAddCandidate, statusEdit, onStatusChange, onRemarkChange, onSaveStatusEdit, onCancelStatusEdit, workspaceAlertsByEntityId }: JobsListViewProps) => {
  const showAiAlertColumn = Boolean(
    workspaceAlertsByEntityId &&
      Object.values(workspaceAlertsByEntityId).some((alerts) => alerts.length > 0),
  );

  return (
  <div className={PH2_TABLE_BODY_SCROLL_CLASS}>
      <table className="w-full min-w-[760px] text-left border-collapse">
        <thead className="sticky top-0 z-10">
          <tr className="border-b border-indigo-100/50 bg-gradient-to-r from-slate-50/95 via-indigo-50/50 to-violet-50/40 text-indigo-950/45 uppercase text-[9px] font-bold tracking-[0.12em] backdrop-blur-sm">
            <th className="px-3 py-2 sm:px-4 w-10 first:pl-4">
              <input type="checkbox" className="rounded border-slate-300" aria-label="Select all" />
          </th>
            <th className="min-w-[12rem] px-3 py-2 align-middle sm:min-w-[14rem] sm:px-4">Job title</th>
            <th className="px-3 py-2 sm:px-4">Client</th>
            <th className="px-3 py-2 sm:px-4">Status</th>
            <th className="px-3 py-2 sm:px-4">Pipeline</th>
            <th className="px-3 py-2 sm:px-4">Details</th>
            {showAiAlertColumn ? <WorkspaceAlertTableHeader /> : null}
            <TableAuditColumnHeader />
            <th className="px-3 py-2 sm:px-4 text-right">Actions</th>
        </tr>
      </thead>
        <tbody className="divide-y divide-slate-100/80">
          {jobs.length === 0 ? (
            <tr>
              <td colSpan={showAiAlertColumn ? 9 : 8} className="px-4 py-12 text-center">
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
                <td className="px-3 py-2 sm:px-4" onClick={(e) => e.stopPropagation()}>
                  <input type="checkbox" className="rounded border-slate-300" aria-label={`Select ${job.title}`} />
            </td>
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
                <td className="px-3 py-2 sm:px-4">
                  <span className="text-xs font-medium text-slate-800 line-clamp-2">{job.client}</span>
            </td>
                <td className="px-3 py-2 sm:px-4" onClick={(e) => e.stopPropagation()}>
              <div className="flex flex-col gap-2">
                {canUpdateJob ? (
                  <select
                        className="max-w-[10rem] rounded-full border-0 bg-slate-100/80 px-2 py-1 text-[11px] font-semibold text-slate-800 ring-1 ring-slate-200/90 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40 cursor-pointer hover:bg-slate-100"
                    value={job.status}
                    onChange={(e) =>
                      onStatusChange(job.id, e.target.value as JobStatus)
                    }
                  >
                    <option value="Active">Active</option>
                    <option value="On Hold">On Hold</option>
                    <option value="Closed">Closed</option>
                  </select>
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
                <td className="px-3 py-2 sm:px-4">
              <PipelineSnapshot
                applied={job.applied}
                interviewed={job.interviewed}
                offered={job.offered}
                joined={job.joined}
                stages={job.pipelineStages}
              />
            </td>
                <td className="px-3 py-2 sm:px-4">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Team Member</span>
                    <span className="text-xs text-slate-700">{job.owner}</span>
                    <span className="text-[10px] text-slate-500">{job.createdDate}</span>
              </div>
            </td>
                {showAiAlertColumn ? (
                  <td className="px-3 py-2 sm:px-4">
                    <WorkspaceAlertTableCell alerts={workspaceAlertsByEntityId?.[job.id]} />
                  </td>
                ) : null}
                <TableAuditCell audit={job.auditMeta} />
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

function mapBackendStatus(status: string): JobStatus {
  switch (status) {
    case 'OPEN':
    case 'PUBLISHED':
      return 'Active';
    case 'ON_HOLD':
      return 'On Hold';
    case 'CLOSED':
    case 'FILLED':
      return 'Closed';
    case 'DRAFT':
      return 'Active'; // Treat draft as active for display
    default:
      return 'Active';
  }
}

function mapFrontendStatusToBackend(status: JobStatus): string {
  switch (status) {
    case 'Active':
      return 'OPEN';
    case 'On Hold':
      return 'ON_HOLD';
    case 'Closed':
      return 'CLOSED';
    default:
      return 'OPEN';
  }
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
    status: mapBackendStatus(job.status),
    backendStatus: job.status,
    jobLocationType: job.jobLocationType ?? undefined,
    applied,
    interviewed,
    offered: 0,
    joined,
    openings: job.openings,
    owner: job.assignedTo?.name ?? 'Unassigned',
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
  const jobAiGate = useAiCoinGate('ai.job_from_prompt');
  const [searchFilter, setSearchFilter] = useState('');
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
    try {
      if (typeof window === 'undefined') return [];
      const raw = window.sessionStorage.getItem(JOBS_PAGE_CACHE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (
        parsed &&
        parsed.page === DEFAULT_PAGE &&
        parsed.pageSize === DEFAULT_PAGE_SIZE &&
        Array.isArray(parsed.jobs)
      ) {
        return parsed.jobs as Job[];
      }
      return [];
    } catch {
      return [];
    }
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
  const [scheduleInterviewers, setScheduleInterviewers] = useState<InterviewPanelMember[]>([]);
  const [statusEdit, setStatusEdit] = useState<{
    jobId: string | null;
    newStatus: JobStatus | null;
    remark: string;
  }>({
    jobId: null,
    newStatus: null,
    remark: '',
  });
  const [totalEntries, setTotalEntries] = useState(() => {
    try {
      if (typeof window === 'undefined') return 0;
      const raw = window.sessionStorage.getItem(JOBS_PAGE_CACHE_KEY);
      if (!raw) return 0;
      const parsed = JSON.parse(raw);
      if (
        parsed &&
        parsed.page === DEFAULT_PAGE &&
        parsed.pageSize === DEFAULT_PAGE_SIZE &&
        typeof parsed.totalEntries === 'number'
      ) {
        return parsed.totalEntries as number;
      }
      return 0;
    } catch {
      return 0;
    }
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
      setJobAiWizardOpen(true);
    } else if (shouldReopenDrawer) {
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

          const members = await getAllTeamMembersForAssign();
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
          getAllTeamMembersForAssign(),
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

        const nextClients = clientsList
          .map((client) => ({ id: String(client.id), name: client.companyName || 'Unnamed client' }))
          .sort((a, b) => a.name.localeCompare(b.name));
        const nextRecruiters = usersList
          .map((user) => ({ id: String(user.id), name: user.name || user.email || 'Unnamed member' }))
          .sort((a, b) => a.name.localeCompare(b.name));

        setClientOptions(nextClients);
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
          try {
            window.sessionStorage.setItem(
              JOBS_PAGE_CACHE_KEY,
              JSON.stringify({
                page: currentPage,
                pageSize,
                totalEntries: total,
                jobs: mapped,
                cachedAt: Date.now(),
              })
            );
          } catch {
            // ignore storage errors
          }
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

      if (silent) return;

      try {
        setLoadingMetrics(true);
        const response = await apiGetJobMetrics({});
        const metrics = (response as any).data?.data || (response as any).data || response;
        setJobMetrics(metrics);
        try {
          window.sessionStorage.setItem(JOBS_METRICS_CACHE_KEY, JSON.stringify(metrics));
        } catch {
          // ignore storage errors
        }
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
    void loadJobsPageData({ silent: false });
  }, [loadJobsPageData]);

  // Reusable auto-refresh: polls while visible, refreshes on focus and on
  // `jobportal:jobs-changed`. Same pattern is now reused on candidates / leads /
  // clients / interviews / dashboard so they stay in sync without manual reload.
  usePageAutoRefresh(loadJobsPageData);
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
    try {
      if (typeof window === 'undefined') return null;
      const raw = window.sessionStorage.getItem(JOBS_METRICS_CACHE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
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
    } catch {
      return null;
    }
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

  const scheduleModalCandidates = useMemo<InterviewCandidate[]>(
    () =>
      jobCandidates.map((c) => ({
        id: c.id,
        name: c.candidateName,
        email: (c.email && c.email.trim()) || '—',
      })),
    [jobCandidates]
  );

  const scheduleModalJobs = useMemo<InterviewJob[]>(() => {
    const j = jobDetails || (selectedJob ? toJobForDrawer(selectedJob) : null);
    if (!j?.id) return [];
    return [{ id: j.id, title: j.title, client: j.client, clientId: j.clientId }];
  }, [jobDetails, selectedJob]);

  const openScheduleInterviewFromJob = useCallback(
    async (candidateId: string, jobId: string) => {
      if (!canCreateInterview) return;
      try {
        const response = await apiGetUsers({ isActive: true, limit: 100 });
        const raw = (response as any).data;
        const users = unwrapCollection<BackendUser>(raw);
        setScheduleInterviewers(mapUsersToInterviewPanel(users));
      } catch {
        toast.error('Could not load interviewers');
        setScheduleInterviewers([]);
      }
      setSchedulePrefill({ candidateId, jobId });
      setScheduleInterviewOpen(true);
    },
    [canCreateInterview]
  );

  const handleJobDrawerScheduleInterview = useCallback(
    async (payload: ScheduleInterviewPayload) => {
      const jobRow = scheduleModalJobs.find((item) => item.id === payload.jobId);
      const clientId = jobRow?.clientId || payload.clientId;
      if (!clientId) {
        toast.error('This job is not linked to a client in the CRM.');
        throw new Error('Missing client');
      }
      try {
        await apiCreateInterview({
          candidateId: payload.candidateId,
          jobId: payload.jobId,
          clientId,
          round: payload.round.toUpperCase(),
          type: mapInterviewUiTypeToBackend(payload.type),
          mode: payload.mode === 'Online' ? 'ONLINE' : 'OFFLINE',
          date: combineInterviewDateAndTimeToIso(payload.date, payload.time),
          duration: payload.duration,
          timezone: payload.timezone,
          meetingPlatform:
            payload.mode === 'Online'
              ? payload.meetingPlatform === 'Google Meet'
                ? 'GOOGLE_MEET'
                : payload.meetingPlatform === 'MS Teams'
                ? 'MS_TEAMS'
                : 'ZOOM'
              : null,
          location: payload.mode === 'Offline' ? payload.location : undefined,
          panelUserIds: payload.panelIds,
          panelRoles: Object.fromEntries(payload.panelIds.map((id) => [id, 'TECHNICAL'])),
          notes: payload.notes,
          sendCalendarInvite: payload.sendCalendarInvite,
          sendEmailNotification: payload.sendEmailNotification,
          sendWhatsappReminder: payload.sendWhatsAppReminder,
        });
      } catch (error: any) {
        toast.error(error?.message || 'Unable to schedule interview');
        throw error;
      }
      toast.success('Interview scheduled successfully');
      emitNotificationsUpdated();
      const jid = jobDetails?.id || selectedJob?.id;
      if (jid) await refreshJobCandidates(jid);
    },
    [scheduleModalJobs, jobDetails?.id, selectedJob?.id, refreshJobCandidates]
  );

  const handleInlineStatusChange = (id: string, newStatus: JobStatus) => {
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

    try {
      await apiUpdateJob(statusEdit.jobId, {
        status: mapFrontendStatusToBackend(statusEdit.newStatus) as any,
        statusRemark: statusEdit.remark || undefined,
      } as any);
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
        statusRemark: 'Closed from Job drawer',
      } as any);

      setJobs((prev) =>
        prev.map((item) => (item.id === job.id ? { ...item, status: 'Closed' } : item))
      );
      setSelectedJob((prev) => (prev && prev.id === job.id ? { ...prev, status: 'Closed' } : prev));
      setJobDetails((prev) => (prev && prev.id === job.id ? { ...prev, status: 'Closed' } : prev));

      await reloadMyJobsAndMetrics();
      toast.success('Job closed successfully');
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
              <>
                <button
                  type="button"
                  onClick={() => {
                    if (jobAiGate.locked) {
                      jobAiGate.confirmAndUnlock();
                      return;
                    }
                    setJobAiWizardOpen(true);
                  }}
                  className={`px-3 py-2 rounded-lg font-semibold text-xs flex items-center gap-1.5 transition-all shadow-[0_4px_14px_-4px_rgba(13,148,136,0.25)] border active:scale-[0.98] ${
                    jobAiGate.locked
                      ? 'bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-200/80 hover:border-amber-300'
                      : 'bg-white hover:bg-teal-50 text-teal-900 border-teal-200/80 hover:border-teal-300'
                  }`}
                  title={
                    jobAiGate.locked
                      ? `Locked — needs ${jobAiGate.cost} coins (you have ${jobAiGate.coins})`
                      : `Create a job with AI (${jobAiGate.cost} coins when you generate)`
                  }
                >
                  {jobAiGate.locked ? (
                    <Lock size={16} className="text-amber-600" strokeWidth={2.25} />
                  ) : (
                    <Sparkles size={16} className="text-teal-600" strokeWidth={2.25} />
                  )}
                  <span>Create Job with AI</span>
                  <AiCoinLockBadge featureId="ai.job_from_prompt" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDuplicateFromJobId(null);
                    setCreateJobDrawerOpen(true);
                  }}
                  className="bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 hover:from-blue-700 hover:via-indigo-700 hover:to-violet-700 text-white px-3.5 py-2 rounded-lg font-semibold text-xs flex items-center gap-1.5 transition-all shadow-lg shadow-indigo-500/30 active:scale-[0.98]"
                >
                  <Plus size={16} className="text-white" strokeWidth={2.5} />
                  <span>Create Job</span>
                </button>
              </>
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
                      { value: 'CLOSED', label: 'Closed' },
                      { value: 'DRAFT', label: 'Draft' },
                      { value: 'FILLED', label: 'Filled' },
                    ]}
                    placeholder="All Status"
                    allLabel="All Status"
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
                      workspaceAlertsByEntityId={workspaceAlertsByEntityId}
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
        onRejectCandidate={canUpdateJob ? (candidateId, jobId) => { /* TODO: reject candidate */ } : undefined}
        onViewCandidateProfile={openJobDrawerCandidateView}
        onEditCandidate={canUpdateCandidate ? openJobDrawerCandidateEdit : undefined}
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

      <ScheduleInterviewModal
        isOpen={scheduleInterviewOpen}
        candidates={scheduleModalCandidates}
        jobs={scheduleModalJobs}
        interviewers={scheduleInterviewers}
        prefillCandidateId={schedulePrefill?.candidateId ?? null}
        prefillJobId={schedulePrefill?.jobId ?? null}
        lockJob
        onClose={() => {
          setScheduleInterviewOpen(false);
          setSchedulePrefill(null);
        }}
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


