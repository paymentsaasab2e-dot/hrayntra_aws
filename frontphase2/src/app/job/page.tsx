'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Plus, 
  LayoutGrid, 
  List, 
  Filter, 
  RefreshCcw, 
  ChevronDown, 
  Eye, 
  Pencil,
  UserPlus, 
  FileText, 
  BrainCircuit, 
  MapPin, 
  Briefcase, 
  Users, 
  CheckCircle2, 
  Clock, 
  Flame,
  MoreHorizontal,
  CheckSquare,
  Download,
  Trash2
} from 'lucide-react';
import { downloadCsv, csvDate } from '../../utils/csv';
import { formatDateTimeDMY } from '../../utils/dateDisplay';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import PaginationAll from '../../components/PaginationAll';
import { requestConfirm, requestError } from '../../lib/appDialog';
import { motion, AnimatePresence } from 'motion/react';
import { Toaster, toast } from 'sonner';
import { CreateTaskModal } from '../../components/CreateTaskModal';
import AddCandidateDrawer from '../../components/candidates/AddCandidateDrawer';
import { JobDetailsDrawer, type JobForDrawer, type JobCandidateItem } from '../../components/drawers/JobDetailsDrawer';
import { ScheduleInterviewModal } from '../../components/interviews/ScheduleInterviewModal';
import { CreateJobDrawer } from '../../components/drawers/CreateJobDrawer';
import { StatusChangeService } from '../../components/StatusChangeService';
import {
  apiAddCandidateToPipeline,
  apiGetCandidates,
  apiGetClients,
  apiGetMatches,
  apiGetJobs,
  apiGetJob,
  apiGetJobMetrics,
  apiDeleteJob,
  apiUpdateJob,
  apiCreateInterview,
  apiGetUsers,
  type BackendClient,
  type BackendJob,
  type BackendCandidate,
  type BackendUser,
  type JobMetrics,
} from '../../lib/api';
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
import { TableSkeleton } from '../../components/ui/Skeleton';
import { SummaryCardSkeleton, type SummaryCardColor } from '../../components/ui/SummaryCard';

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
  location: string;
  status: JobStatus;
  jobLocationType?: string;
  applied: number;
  interviewed: number;
  offered: number;
  joined: number;
  openings: number;
  owner: string;
  createdDate: string;
  hot: boolean;
  aiMatch: boolean;
  noCandidates: boolean;
  slaRisk: boolean;
  pipelineStages?: JobPipelineStageSummary[];
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
}

interface JobsBoardViewProps {
  jobs: Job[];
  onJobClick?: (job: Job) => void;
  canAssignJob: boolean;
}

// No fallback mock data - use empty array if API fails

// Stats will be loaded from API
const STATS_CONFIG = [
  { key: 'activeJobs', label: 'Active Jobs', color: 'text-blue-600', bg: 'bg-blue-50', icon: Briefcase },
  { key: 'newJobsThisWeek', label: 'New Jobs (This Week)', color: 'text-green-600', bg: 'bg-green-50', icon: Plus },
  { key: 'appliedCandidates', label: 'Candidates Applied', color: 'text-amber-600', bg: 'bg-amber-50', icon: Users },
  { key: 'nearSla', label: 'Near SLA', color: 'text-red-600', bg: 'bg-red-50', icon: Clock },
  { key: 'closedThisMonth', label: 'Closed This Month', color: 'text-gray-600', bg: 'bg-gray-50', icon: CheckCircle2 },
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

const JobsListView = ({ jobs, onJobClick, onEditJob, onAddCandidate, onDeleteJob, deletingJobId, canUpdateJob, canDeleteJob, canAddCandidate, statusEdit, onStatusChange, onRemarkChange, onSaveStatusEdit, onCancelStatusEdit }: JobsListViewProps) => (
  <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
    <table className="w-full text-left border-collapse">
      <thead className="bg-gray-50 sticky top-0 z-10">
        <tr>
          <th className="p-4 w-10">
            <input type="checkbox" className="rounded border-gray-300" />
          </th>
          <th className="p-4 text-xs font-bold text-gray-500 uppercase">Job Title & ID</th>
          <th className="p-4 text-xs font-bold text-gray-500 uppercase">Client & Location</th>
          <th className="p-4 text-xs font-bold text-gray-500 uppercase">Status</th>
          <th className="p-4 text-xs font-bold text-gray-500 uppercase">Pipeline</th>
          <th className="p-4 text-xs font-bold text-gray-500 uppercase">Details</th>
          <th className="p-4 text-xs font-bold text-gray-500 uppercase text-right">Actions</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-100">
        {jobs.map((job) => (
          <tr
            key={job.id}
            className="hover:bg-gray-50/50 transition-colors group"
          >
            <td className="p-4" onClick={(e) => e.stopPropagation()}>
              <input type="checkbox" className="rounded border-gray-300" />
            </td>
            <td className="p-4">
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onJobClick?.(job)}
                    className="font-semibold text-gray-900 text-left hover:text-blue-600 transition-colors"
                    title="View job details"
                  >
                    {job.title}
                  </button>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <FileText size={14} className="text-gray-400 cursor-default" />
                    <BrainCircuit size={14} className="text-purple-400 hover:text-purple-600 cursor-pointer" />
                  </div>
                </div>
              </div>
            </td>
            <td className="p-4">
              <div className="flex flex-col">
                <span className="text-sm font-medium text-gray-700">{job.client}</span>
                <div className="flex items-center gap-1 text-xs text-gray-400">
                  <MapPin size={12} />
                  <span>{job.location}</span>
                </div>
              </div>
            </td>
            <td className="p-4" onClick={(e) => e.stopPropagation()}>
              <div className="flex flex-col gap-2">
                {canUpdateJob ? (
                  <select
                    className="px-3 py-1 rounded-full border border-slate-300 bg-white text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 cursor-pointer"
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
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="Add remark for this status change"
                      className="flex-1 px-2 py-1 text-xs border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                      value={statusEdit.remark}
                      onChange={(e) => onRemarkChange(e.target.value)}
                    />
                    <button
                      type="button"
                      className="px-2 py-1 text-xs font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
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
            <td className="p-4">
              <PipelineSnapshot
                applied={job.applied}
                interviewed={job.interviewed}
                offered={job.offered}
                joined={job.joined}
                stages={job.pipelineStages}
              />
            </td>
            <td className="p-4">
              <div className="flex flex-col">
                <span className="text-[11px] text-gray-400 uppercase font-bold tracking-wider">Recruiter</span>
                <span className="text-xs text-gray-700">{job.owner}</span>
                <span className="text-[11px] text-gray-400 mt-1">{job.createdDate}</span>
              </div>
            </td>
            <td className="p-4 text-right" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-end gap-1">
                <button type="button" onClick={() => onJobClick?.(job)} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-blue-600 transition-colors" title="Preview job">
                  <Eye size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => onEditJob?.(job)}
                  className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-amber-600 transition-colors"
                  title="Edit job"
                >
                  <Pencil size={16} />
                </button>
                {canAddCandidate && (
                  <button
                    type="button"
                    onClick={() => onAddCandidate?.(job)}
                    className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-blue-600 transition-colors"
                    title="Add Candidate"
                  >
                    <UserPlus size={16} />
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
                    className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed" 
                    title="Delete Job"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
    <div className="p-4 border-t border-gray-100 text-sm text-gray-500">
      {jobs.length === 0 && <span>No jobs found in the database yet.</span>}
    </div>
  </div>
);

const JobsBoardView = ({ jobs, onJobClick, canAssignJob }: JobsBoardViewProps) => {
  // Board columns are placeholders; job cards below use your real jobs from the API.
  const columns = [
    { id: 'new', label: 'New Candidates', count: 0 },
    { id: 'shortlist', label: 'Shortlisted', count: 0 },
    { id: 'interview', label: 'Interviewing', count: 0 },
    { id: 'offered', label: 'Offered', count: 0 },
    { id: 'joined', label: 'Joined', count: 0 },
  ];

  return (
    <div className="flex gap-6 overflow-x-auto pb-6 scrollbar-hide">
      {columns.map((col) => (
        <div key={col.id} className="min-w-[300px] flex-1 flex flex-col gap-4">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-gray-900 text-sm">{col.label}</h3>
              <span className="bg-gray-200 text-gray-600 text-[10px] px-2 py-0.5 rounded-full font-bold">{col.count}</span>
            </div>
            <button className="text-gray-400 hover:text-gray-600">
              <MoreHorizontal size={16} />
            </button>
          </div>
          
          <div className="flex flex-col gap-3">
            {jobs.slice(0, 6).map((job) => (
              <div key={job.id} role="button" tabIndex={0} onClick={() => onJobClick?.(job)} onKeyDown={(e) => e.key === 'Enter' && onJobClick?.(job)} className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm hover:border-blue-400 cursor-pointer transition-all">
              <div className="flex justify-between items-start mb-3">
                <div className="flex flex-col">
                    <h4 className="font-bold text-gray-900 text-sm leading-tight">{job.title}</h4>
                </div>
                  {job.hot && <Flame size={14} className="text-orange-500" />}
                </div>
                <div className="flex items-center justify-between mt-4">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">{job.client}</span>
                  </div>
                  <div className="flex items-center gap-1 bg-blue-50 text-blue-600 px-2 py-0.5 rounded text-[10px] font-bold">
                    <Users size={10} />
                    <span>{job.applied}</span>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-gray-50 flex items-center justify-between">
                  <div className="flex -space-x-2">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="w-6 h-6 rounded-full border-2 border-white bg-gray-200 flex items-center justify-center">
                        <span className="text-[8px] font-bold text-gray-500">JD</span>
                      </div>
                    ))}
                  </div>
                  <span className={`text-[10px] font-bold ${job.slaRisk ? 'text-red-500' : 'text-gray-400'}`}>
                    {job.slaRisk ? 'SLA Risk' : 'On Track'}
                  </span>
                </div>
              </div>
            ))}
            {canAssignJob && (
              <button className="py-2 border-2 border-dashed border-gray-200 rounded-xl text-gray-400 text-xs font-bold hover:bg-gray-50 hover:border-gray-300 transition-colors">
                + Assign Job
              </button>
            )}
          </div>
        </div>
      ))}
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

function mapBackendJob(job: BackendJob, assignedCandidateCount = 0): Job {
  const appliedFromMatches = job._count?.matches ?? 0;
  const applied = Math.max(appliedFromMatches, assignedCandidateCount);
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

  return {
    id: job.id,
    title: job.title,
    client: job.client?.companyName ?? '-',
    location: job.location ?? '-',
    status: mapBackendStatus(job.status),
    jobLocationType: job.jobLocationType ?? undefined,
    applied,
    interviewed,
    offered: 0,
    joined,
    openings: job.openings,
    owner: job.assignedTo?.name ?? 'Unassigned',
    createdDate: job.createdAt?.slice(0, 10) ?? '-',
    hot: (job as any).hot ?? false,
    aiMatch: (job as any).aiMatch ?? false,
    noCandidates: (job as any).noCandidates ?? false,
    slaRisk: (job as any).slaRisk ?? false,
    pipelineStages: pipelineStagesDeduped.length ? pipelineStagesDeduped : undefined,
  };
}

function buildAssignedCandidateCountByJob(candidates: BackendCandidate[]): Map<string, number> {
  const counts = new Map<string, number>();

  candidates.forEach((candidate) => {
    const assigned = Array.isArray(candidate.assignedJobs) ? candidate.assignedJobs : [];
    assigned.forEach((jobId) => {
      const normalizedId = String(jobId || '').trim();
      if (!normalizedId) return;
      counts.set(normalizedId, (counts.get(normalizedId) || 0) + 1);
    });
  });

  return counts;
}

function toJobCandidateItemFromApplied(match: any, fallbackRecruiter = '-'): JobCandidateItem {
  const emailFromMatch =
    (match.candidate?.email && String(match.candidate.email).trim()) ||
    (match.email && String(match.email).trim()) ||
    undefined;
  return {
    id: match.candidateId || match.candidate?.id || match.id,
    candidateName: match.candidate
      ? `${match.candidate.firstName || ''} ${match.candidate.lastName || ''}`.trim() || '-'
      : '-',
    email: emailFromMatch,
    currentStage: match.status || 'Applied',
    score: typeof match.score === 'number' ? `${Math.round(match.score)}%` : '-',
    recruiter: match.createdBy?.name || fallbackRecruiter,
    interviewStatus: 'Not scheduled',
    lastActivity: match.createdAt ? formatDateTimeDMY(match.createdAt) : '-',
  };
}

function toJobCandidateItemFromAssigned(candidate: BackendCandidate): JobCandidateItem {
  return {
    id: candidate.id,
    candidateName: `${candidate.firstName || ''} ${candidate.lastName || ''}`.trim() || '-',
    email: candidate.email ? String(candidate.email).trim() : undefined,
    currentStage: candidate.stage || 'Applied',
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
  const canAssignJob = hasPermission('assign_job');
  const canAddCandidate = hasPermission('add_candidate');
  const canCreateInterview = hasPermission('interviews_create');
  const [view, setView] = useState<'list' | 'board'>('list');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [clientFilterId, setClientFilterId] = useState('');
  const [recruiterFilterId, setRecruiterFilterId] = useState('');
  const [clientOptions, setClientOptions] = useState<Array<{ id: string; name: string }>>([]);
  const [recruiterOptions, setRecruiterOptions] = useState<Array<{ id: string; name: string }>>([]);
  const [createTaskOpen, setCreateTaskOpen] = useState(false);
  const [createJobDrawerOpen, setCreateJobDrawerOpen] = useState(false);
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
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
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
  const hasActiveFilters = Boolean(searchFilter || statusFilter || clientFilterId || recruiterFilterId);

  /** Export current page of jobs to CSV. */
  const handleExportJobsCsv = useCallback(() => {
    if (jobs.length === 0) {
      toast.message('No jobs to export.');
      return;
    }
    downloadCsv<Job>(
      `jobs-${new Date().toISOString().slice(0, 10)}.csv`,
      [
        { id: 'title', accessor: (j) => j.title },
        { id: 'client', accessor: (j) => j.client },
        { id: 'location', accessor: (j) => j.location },
        { id: 'jobLocationType', accessor: (j) => j.jobLocationType || '' },
        { id: 'status', accessor: (j) => j.status },
        { id: 'openings', accessor: (j) => j.openings ?? 0 },
        { id: 'applied', accessor: (j) => j.applied ?? 0 },
        { id: 'interviewed', accessor: (j) => j.interviewed ?? 0 },
        { id: 'offered', accessor: (j) => j.offered ?? 0 },
        { id: 'joined', accessor: (j) => j.joined ?? 0 },
        { id: 'owner', accessor: (j) => j.owner },
        { id: 'createdDate', accessor: (j) => csvDate(j.createdDate) },
        { id: 'hot', accessor: (j) => (j.hot ? 'true' : 'false') },
        { id: 'aiMatch', accessor: (j) => (j.aiMatch ? 'true' : 'false') },
        { id: 'noCandidates', accessor: (j) => (j.noCandidates ? 'true' : 'false') },
        { id: 'slaRisk', accessor: (j) => (j.slaRisk ? 'true' : 'false') },
      ],
      jobs,
    );
    toast.success(`Exported ${jobs.length} job${jobs.length === 1 ? '' : 's'} to CSV`);
  }, [jobs]);

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

  const buildJobsQueryParams = useCallback(() => ({
    page: currentPage,
    limit: pageSize,
    search: searchFilter || undefined,
    status: statusFilter || undefined,
    clientId: clientFilterId || undefined,
    assignedToId: recruiterFilterId || undefined,
  }), [currentPage, pageSize, searchFilter, statusFilter, clientFilterId, recruiterFilterId]);

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

  // Handle LinkedIn OAuth callback
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const linkedinParam = params.get('linkedin');
    
    if (linkedinParam === 'connected') {
      // Open the create job drawer when LinkedIn connection succeeds
      setCreateJobDrawerOpen(true);
      // Clean up URL
      const url = new URL(window.location.href);
      url.searchParams.delete('linkedin');
      url.searchParams.delete('message');
      window.history.replaceState({}, '', url.pathname + (url.search || ''));
    } else if (linkedinParam === 'error') {
      // Show error (will be handled by CreateJobDrawer's LinkedIn hook)
      // Still open drawer so user can see the error
      setCreateJobDrawerOpen(true);
      // Clean up URL
      const url = new URL(window.location.href);
      url.searchParams.delete('linkedin');
      url.searchParams.delete('message');
      window.history.replaceState({}, '', url.pathname + (url.search || ''));
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadFilterOptions = async () => {
      try {
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
  }, []);

  const loadJobsPageData = useCallback(
    async (opts?: { silent?: boolean }) => {
      const silent = opts?.silent === true;
      if (!silent) {
        if (!hasVisibleJobsRef.current) setLoading(true);
        setError(null);
      }
      try {
        const [jobsRes, candidatesRes] = await Promise.all([
          apiGetJobs(buildJobsQueryParams()),
          apiGetCandidates({ page: 1, limit: 500 }),
        ]);

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

        const candidatesData =
          (candidatesRes as any)?.data?.data ||
          (candidatesRes as any)?.data?.items ||
          (candidatesRes as any)?.data ||
          [];
        const allCandidates: BackendCandidate[] = Array.isArray(candidatesData) ? candidatesData : [];
        const assignedCandidateCountByJob = buildAssignedCandidateCountByJob(allCandidates);

        const mapped = parsed.jobs.map((job) =>
          mapBackendJob(job, assignedCandidateCountByJob.get(String(job.id)) || 0)
        );
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

  const [loadingJobDetails, setLoadingJobDetails] = useState(false);
  const [jobDetails, setJobDetails] = useState<JobForDrawer | null>(null);
  const [jobPipelineStages, setJobPipelineStages] = useState<any[]>([]);
  const [moveStageOpen, setMoveStageOpen] = useState(false);
  const [moveStageCandidateId, setMoveStageCandidateId] = useState<string | null>(null);
  const [moveStageJobId, setMoveStageJobId] = useState<string | null>(null);
  const [moveStageOptions, setMoveStageOptions] = useState<Array<{ id?: string; name: string }>>([]);
  const [moveStageValue, setMoveStageValue] = useState<string>('');
  const [moveStageNote, setMoveStageNote] = useState<string>('');
  const [moveStageSaving, setMoveStageSaving] = useState(false);
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
    let appliedCandidates: JobCandidateItem[] = Array.isArray(backendJob?.matches)
      ? backendJob.matches.map((match: any) => toJobCandidateItemFromApplied(match, backendJob?.assignedTo?.name || '-'))
      : [];

    const [matchesResult, candidatesResult] = await Promise.allSettled([
      apiGetMatches({ jobId, limit: 500 }),
      apiGetCandidates({ page: 1, limit: 500 }),
    ]);

    if (!appliedCandidates.length && matchesResult.status === 'fulfilled') {
      const matchesData =
        (matchesResult.value as any)?.data?.data ||
        (matchesResult.value as any)?.data?.items ||
        (matchesResult.value as any)?.data ||
        [];

      if (Array.isArray(matchesData)) {
        appliedCandidates = matchesData.map((match: any) =>
          toJobCandidateItemFromApplied(match, backendJob?.assignedTo?.name || '-')
        );
      }
    }

    let assignedCandidates: JobCandidateItem[] = [];
    if (candidatesResult.status === 'fulfilled') {
      const candidatesData =
        (candidatesResult.value as any).data?.data ||
        (candidatesResult.value as any).data?.items ||
        (candidatesResult.value as any).data ||
        [];
      const allCandidates: BackendCandidate[] = Array.isArray(candidatesData) ? candidatesData : [];

      assignedCandidates = allCandidates
        .filter((candidate) => Array.isArray(candidate.assignedJobs) && candidate.assignedJobs.includes(jobId))
        .map(toJobCandidateItemFromAssigned);
    } else {
      console.error('Failed to fetch assigned candidates:', candidatesResult.reason);
    }

    if (matchesResult.status === 'rejected') {
      console.error('Failed to fetch applied candidates (matches):', matchesResult.reason);
    }

    const merged = [...appliedCandidates, ...assignedCandidates];
    const deduped = Array.from(new Map(merged.map((candidate) => [candidate.id, candidate])).values());
    setJobCandidates(deduped);
  }, []);

  const openJobDrawer = async (job: Job) => {
    setSelectedJob(job);
    setJobDrawerOpen(true);
    setJobCandidates([]); // Reset candidates while fetching
    setJobDetails(null); // Reset until fetch completes
    
    // Fetch full job details from backend
    try {
      setLoadingJobDetails(true);
      const response = await apiGetJob(job.id);
      // Handle response structure: { success: true, data: {...} } or direct data
      const backendJob = (response as any).data?.data || (response as any).data || response;
      
      // Map backend job to JobForDrawer format
      const mappedJob: JobForDrawer = {
        id: backendJob.id,
        title: backendJob.title,
        client: backendJob.client?.companyName || job.client,
        clientId: backendJob.client?.id,
        location: backendJob.location || job.location,
        status: mapBackendStatus(backendJob.status) as JobForDrawer['status'],
        employmentType: formatEmploymentType(backendJob.type) || undefined,
        salaryRange: formatSalaryRange(backendJob.salary),
        postedDate: backendJob.postedDate ? new Date(backendJob.postedDate).toISOString().split('T')[0] : 
                   backendJob.createdAt ? backendJob.createdAt.split('T')[0] : job.createdDate,
        recruiter: backendJob.assignedTo?.name || job.owner,
        hiringManager: backendJob.hiringManager || '-',
        applied: backendJob._count?.matches || job.applied,
        interviewed: backendJob._count?.interviews || job.interviewed,
        offered: 0,
        joined: backendJob._count?.placements || job.joined,
        openings: backendJob.openings || job.openings,
        owner: backendJob.assignedTo?.name || job.owner,
        createdDate: backendJob.createdAt ? backendJob.createdAt.split('T')[0] : job.createdDate,
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
      };
      
      setJobDetails(mappedJob);
      
      // Map pipeline stages
      if (backendJob.pipelineStages && Array.isArray(backendJob.pipelineStages)) {
        const stages = backendJob.pipelineStages.map((stage: any) => ({
          id: stage.id,
          name: stage.name,
          sla: '',
          systemRole: stage.systemRole ?? undefined,
        }));
        setJobPipelineStages(stages);
      } else {
        setJobPipelineStages([]);
      }

      await fetchJobCandidates(job.id, backendJob);
    } catch (error) {
      console.error('Failed to fetch job details:', error);
      // Use basic job data from list
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
        const mappedJob = mapBackendJob(backendJob, backendJob._count?.matches || 0);
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
      const jid = jobDetails?.id || selectedJob?.id;
      if (jid) await refreshJobCandidates(jid);
    },
    [scheduleModalJobs, jobDetails?.id, selectedJob?.id, refreshJobCandidates]
  );

  const openMoveStage = useCallback(
    async (candidateId: string, jobId: string) => {
      let stages = Array.isArray(jobPipelineStages) ? jobPipelineStages : [];
      if (!stages.length) {
        try {
          const response = await apiGetJob(jobId);
          const backendJob = (response as any).data?.data || (response as any).data || response;
          stages = Array.isArray(backendJob?.pipelineStages)
            ? backendJob.pipelineStages.map((stage: any) => ({
                id: stage.id,
                name: stage.name,
                systemRole: stage.systemRole,
              }))
            : [];
          if (stages.length) {
            setJobPipelineStages(stages);
          }
        } catch (error) {
          console.error('Failed to load pipeline stages for move stage modal:', error);
        }
      }
      const effectiveStages = stages.length ? stages : [];
      const firstStage = effectiveStages[0]?.name || '';
      setMoveStageCandidateId(candidateId);
      setMoveStageJobId(jobId);
      setMoveStageOptions(effectiveStages);
      setMoveStageValue(firstStage);
      setMoveStageNote('');
      setMoveStageOpen(true);
    },
    [jobPipelineStages]
  );

  const submitMoveStage = useCallback(async () => {
    if (!moveStageCandidateId || !moveStageJobId) return;
    if (!moveStageValue.trim()) return;

    try {
      setMoveStageSaving(true);
      await apiAddCandidateToPipeline(moveStageCandidateId, {
        jobId: moveStageJobId,
        stage: moveStageValue.trim(),
        priority: 'Medium',
        notes: moveStageNote.trim() || undefined,
      });
      await refreshJobCandidates(moveStageJobId);
      setMoveStageOpen(false);
    } catch (error) {
      console.error('Failed to move candidate stage:', error);
      void requestError((error as any)?.message || 'Failed to move stage');
    } finally {
      setMoveStageSaving(false);
    }
  }, [moveStageCandidateId, moveStageJobId, moveStageNote, moveStageValue, refreshJobCandidates]);

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
    <div className="w-full min-h-screen bg-gray-50 font-sans text-gray-900">
      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
          <div className="max-w-[1440px] mx-auto space-y-8">
            
            {/* Page Header */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1 min-w-0">
                <h1 className="text-3xl font-bold tracking-tight text-gray-900">Jobs</h1>
                <p className="text-gray-500">
                  All jobs from the database are loaded here.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <div className="bg-white p-0.5 rounded-lg border border-gray-200 inline-flex items-center shadow-sm">
                  <button
                    type="button"
                    onClick={() => setView('list')}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap transition-all ${view === 'list' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-50'}`}
                  >
                    <List size={14} className="shrink-0" />
                    List View
                  </button>
                  <button
                    type="button"
                    onClick={() => setView('board')}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap transition-all ${view === 'board' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-50'}`}
                  >
                    <LayoutGrid size={14} className="shrink-0" />
                    Board View
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => void reloadMyJobsAndMetrics()}
                  className="inline-flex items-center justify-center p-1.5 bg-white border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors shadow-sm"
                  title="Reload jobs"
                >
                  <RefreshCcw size={15} className="shrink-0" />
                </button>

                <button
                  type="button"
                  onClick={handleExportJobsCsv}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 text-gray-700 rounded-lg text-xs font-semibold whitespace-nowrap hover:bg-gray-50 transition-all shadow-sm"
                  title="Export visible jobs to CSV"
                >
                  <Download size={14} className="shrink-0" />
                  Export
                </button>

                {canCreateJob && (
                  <button
                    type="button"
                    onClick={() => {
                      setDuplicateFromJobId(null);
                      setCreateJobDrawerOpen(true);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-semibold whitespace-nowrap hover:bg-blue-700 transition-all shadow-sm shadow-blue-200/50"
                  >
                    <Plus size={15} className="shrink-0" />
                    Create Job
                  </button>
                )}
              </div>
            </div>

            {/* Quick Metrics */}
            <div className="grid grid-cols-5 gap-4">
              {STATS_CONFIG.map((statConfig, i) => {
                const value = jobMetrics ? (jobMetrics as any)[statConfig.key] || 0 : 0;
                const StatIcon = statConfig.icon;
                return (
                  <div key={i} className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow group cursor-default">
                    <div className="flex items-start justify-between mb-4">
                      <div className={`${statConfig.bg} ${statConfig.color} p-2.5 rounded-xl transition-transform group-hover:scale-110`}>
                        <StatIcon size={22} />
                      </div>
                      <div className="text-xs font-bold text-gray-400 bg-gray-50 px-2 py-1 rounded">
                        {loadingMetrics ? 'Loading...' : 'Live'}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <p className="text-2xl font-bold text-gray-900">{loadingMetrics ? '-' : value}</p>
                      <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{statConfig.label}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Filters Row */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <input
                      type="text"
                      value={searchFilter}
                      onChange={(e) => {
                        setSearchFilter(e.target.value);
                        setCurrentPage(1);
                      }}
                      placeholder="Search jobs, client, location"
                      className="w-72 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>
                  <button 
                    onClick={() => setIsFilterOpen(!isFilterOpen)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl border font-bold text-sm transition-all ${isFilterOpen ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'}`}
                  >
                    <Filter size={18} />
                    Filters
                    {isFilterOpen ? <ChevronDown size={16} className="rotate-180" /> : <ChevronDown size={16} />}
                  </button>
                  {statusFilter && (
                    <div className="flex items-center gap-2 bg-blue-50 px-3 py-1.5 rounded-full border border-blue-200 text-xs text-blue-700">
                      <span className="font-bold">Status: {statusFilter.replace('_', ' ')}</span>
                      <button
                        type="button"
                        onClick={() => {
                          setStatusFilter('');
                          setCurrentPage(1);
                        }}
                        className="hover:text-red-500"
                      >
                        x
                      </button>
                    </div>
                  )}
                  {hasActiveFilters && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearchFilter('');
                        setStatusFilter('');
                        setClientFilterId('');
                        setRecruiterFilterId('');
                        setCurrentPage(1);
                      }}
                      className="text-xs font-bold text-blue-600 hover:underline"
                    >
                      Clear All
                    </button>
                  )}
                </div>
                
              </div>

              <AnimatePresence>
                {isFilterOpen && (
                  <motion.div 
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="bg-white p-6 rounded-2xl border border-gray-200 grid grid-cols-1 md:grid-cols-3 gap-4 shadow-sm">
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-500 uppercase">Job Status</label>
                        <select
                          value={statusFilter}
                          onChange={(e) => {
                            setStatusFilter(e.target.value);
                            setCurrentPage(1);
                          }}
                          className="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="">All Statuses</option>
                          <option value="OPEN">Active (Open)</option>
                          <option value="ON_HOLD">On Hold</option>
                          <option value="CLOSED">Closed</option>
                          <option value="DRAFT">Draft</option>
                          <option value="FILLED">Filled</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-500 uppercase">Client</label>
                        <select
                          value={clientFilterId}
                          onChange={(e) => {
                            setClientFilterId(e.target.value);
                            setCurrentPage(1);
                          }}
                          className="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="">All Clients</option>
                          {clientOptions.map((client) => (
                            <option key={client.id} value={client.id}>
                              {client.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-500 uppercase">Recruiter</label>
                        <select
                          value={recruiterFilterId}
                          onChange={(e) => {
                            setRecruiterFilterId(e.target.value);
                            setCurrentPage(1);
                          }}
                          className="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="">All Recruiters</option>
                          {recruiterOptions.map((recruiter) => (
                            <option key={recruiter.id} value={recruiter.id}>
                              {recruiter.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* View Switcher Content */}
            <motion.div
              key={view}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              {error && (
                <div className="mb-3 p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800">
                  {error}
                </div>
              )}
              {loading ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                    {(['blue', 'orange', 'purple', 'green', 'gray'] as SummaryCardColor[]).map((c, i) => (
                      <SummaryCardSkeleton key={i} color={c} />
                    ))}
                  </div>
                  <TableSkeleton rows={8} columns={7} />
                </div>
              ) : view === 'list' ? (
                <>
                  <JobsListView 
                    jobs={jobs} 
                    onJobClick={openJobDrawer} 
                    onEditJob={canUpdateJob ? (job) => {
                      setEditingJobId(job.id);
                      setEditJobDrawerOpen(true);
                    } : undefined}
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
                  />
                  
                  <div className="mt-4 w-full">
                    <PaginationAll
                      initialPage={currentPage}
                      totalPages={Math.ceil(totalEntries / pageSize)}
                      totalCount={totalEntries}
                      pageSize={pageSize}
                      itemLabel="jobs"
                      onPageChange={setCurrentPage}
                    />
                  </div>
                </>
              ) : (
                <JobsBoardView jobs={jobs} onJobClick={openJobDrawer} canAssignJob={canAssignJob} />
              )}
            </motion.div>

          </div>
        </div>

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
        onPublish={canUpdateJob ? (job) => { /* TODO: publish job */ } : undefined}
        onClone={canCreateJob ? handleCloneJob : undefined}
        onCloseJob={canUpdateJob ? handleCloseJob : undefined}
        onMoveStage={canUpdateJob ? (candidateId, jobId) => openMoveStage(candidateId, jobId) : undefined}
        onScheduleInterview={canCreateInterview ? openScheduleInterviewFromJob : undefined}
        onRejectCandidate={canUpdateJob ? (candidateId, jobId) => { /* TODO: reject candidate */ } : undefined}
        onViewCandidateProfile={(candidateId) => { /* TODO: navigate to candidate profile */ }}
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

      {/* Move Stage Modal */}
      {moveStageOpen ? (
        <div className="fixed inset-0 z-[120] flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => (moveStageSaving ? null : setMoveStageOpen(false))} />
          <div className="relative w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-slate-200">
            <div className="p-5 border-b border-slate-100">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-lg font-bold text-slate-900">Move candidate stage</div>
                  <div className="text-xs text-slate-500 mt-1">Select a stage from this job's pipeline.</div>
                </div>
                <button
                  type="button"
                  className="px-3 py-1.5 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-50 border border-slate-200"
                  onClick={() => (moveStageSaving ? null : setMoveStageOpen(false))}
                >
                  Close
                </button>
              </div>
            </div>

            <div className="p-5 space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase">Stage</label>
                <select
                  value={moveStageValue}
                  onChange={(e) => setMoveStageValue(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  disabled={moveStageSaving || moveStageOptions.length === 0}
                >
                  {moveStageOptions.length === 0 ? (
                    <option value="">No pipeline configured for this job</option>
                  ) : (
                    moveStageOptions.map((s: any) => (
                      <option key={s.id || s.name} value={s.name}>
                        {s.name}
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase">Note (optional)</label>
                <textarea
                  value={moveStageNote}
                  onChange={(e) => setMoveStageNote(e.target.value)}
                  rows={3}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  placeholder="Add a short note (optional)"
                  disabled={moveStageSaving}
                />
              </div>
            </div>

            <div className="p-5 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                type="button"
                className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-bold text-slate-700 hover:bg-slate-50"
                onClick={() => (moveStageSaving ? null : setMoveStageOpen(false))}
                disabled={moveStageSaving}
              >
                Cancel
              </button>
              <button
                type="button"
                className="px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 disabled:opacity-60"
                onClick={submitMoveStage}
                disabled={moveStageSaving || moveStageOptions.length === 0 || !moveStageValue.trim()}
              >
                {moveStageSaving ? 'Moving...' : 'Move stage'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <CreateJobDrawer
        isOpen={canUpdateJob && editJobDrawerOpen}
        jobId={editingJobId || undefined}
        onClose={() => {
          setEditJobDrawerOpen(false);
          setEditingJobId(null);
        }}
        onJobUpdated={() => {
          setEditJobDrawerOpen(false);
          setEditingJobId(null);
          void reloadMyJobsAndMetrics();
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
      <Toaster position="top-right" richColors />

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
    </div>
  );
}


