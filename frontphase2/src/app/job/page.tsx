'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { 
  Plus, 
  LayoutGrid, 
  List, 
  Filter, 
  RefreshCcw, 
  ChevronDown, 
  Eye, 
  UserPlus, 
  FileText, 
  BrainCircuit, 
  MapPin, 
  Briefcase, 
  Users, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Flame,
  MoreHorizontal,
  CheckSquare,
  Trash2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { CreateTaskModal } from '../../components/CreateTaskModal';
import { JobDetailsDrawer, type JobForDrawer, type JobCandidateItem } from '../../components/drawers/JobDetailsDrawer';
import { CreateJobDrawer } from '../../components/drawers/CreateJobDrawer';
import { StatusChangeService } from '../../components/StatusChangeService';
import {
  apiAddCandidateToPipeline,
  apiGetCandidates,
  apiGetJobs,
  apiGetJob,
  apiGetJobMetrics,
  apiDeleteJob,
  apiUpdateJob,
  type BackendJob,
  type BackendCandidate,
  type JobMetrics,
} from '../../lib/api';

// Types
type JobStatus = 'Active' | 'On Hold' | 'Closed';

interface Job {
  id: string;
  title: string;
  client: string;
  location: string;
  status: JobStatus;
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
    hiringManager: '—',
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
}

interface JobsListViewProps {
  jobs: Job[];
  onJobClick?: (job: Job) => void;
  onDeleteJob?: (jobId: string, jobTitle: string) => Promise<void>;
  deletingJobId?: string | null;
  statusEdit: {
    jobId: string | null;
    newStatus: JobStatus | null;
    remark: string;
  };
  onStatusChange: (id: string, newStatus: JobStatus) => void;
  onSaveStatusEdit: () => void;
  onCancelStatusEdit: () => void;
}

interface JobsBoardViewProps {
  jobs: Job[];
  onJobClick?: (job: Job) => void;
}

// No fallback mock data - use empty array if API fails

// Stats will be loaded from API
const STATS_CONFIG = [
  { key: 'activeJobs', label: 'Active Jobs', color: 'text-blue-600', bg: 'bg-blue-50', icon: Briefcase },
  { key: 'newJobsThisWeek', label: 'New Jobs (This Week)', color: 'text-green-600', bg: 'bg-green-50', icon: Plus },
  { key: 'noCandidates', label: 'No Candidates', color: 'text-amber-600', bg: 'bg-amber-50', icon: Users },
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

const PipelineSnapshot = ({ applied, interviewed, offered, joined }: PipelineSnapshotProps) => (
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

const JobsListView = ({ jobs, onJobClick, onDeleteJob, deletingJobId, statusEdit, onStatusChange, onRemarkChange, onSaveStatusEdit, onCancelStatusEdit }: JobsListViewProps) => (
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
          <th className="p-4 text-xs font-bold text-gray-500 uppercase text-center">Indicators</th>
          <th className="p-4 text-xs font-bold text-gray-500 uppercase">Pipeline</th>
          <th className="p-4 text-xs font-bold text-gray-500 uppercase">Details</th>
          <th className="p-4 text-xs font-bold text-gray-500 uppercase text-right">Actions</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-100">
        {jobs.map((job) => (
          <tr
            key={job.id}
            onClick={() => onJobClick?.(job)}
            className="hover:bg-gray-50/50 transition-colors group cursor-pointer"
          >
            <td className="p-4" onClick={(e) => e.stopPropagation()}>
              <input type="checkbox" className="rounded border-gray-300" />
            </td>
            <td className="p-4">
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-gray-900">{job.title}</span>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <FileText size={14} className="text-gray-400 hover:text-blue-600 cursor-pointer" onClick={(e) => { e.stopPropagation(); onJobClick?.(job); }} />
                    <BrainCircuit size={14} className="text-purple-400 hover:text-purple-600 cursor-pointer" />
                  </div>
                </div>
                <span className="text-xs text-gray-400 font-mono">{job.id}</span>
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

                {statusEdit.jobId === job.id && (
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
              <div className="flex items-center justify-center gap-2">
                {job.hot && (
                  <div className="relative group/tip">
                    <Flame size={16} className="text-orange-500" />
                    <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover/tip:block bg-gray-900 text-white text-[10px] px-2 py-1 rounded whitespace-nowrap">Hot Job</span>
                  </div>
                )}
                {job.slaRisk && (
                  <div className="relative group/tip">
                    <Clock size={16} className="text-red-500" />
                    <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover/tip:block bg-gray-900 text-white text-[10px] px-2 py-1 rounded whitespace-nowrap">SLA Risk</span>
                  </div>
                )}
                {job.noCandidates && (
                  <div className="relative group/tip">
                    <AlertCircle size={16} className="text-amber-500" />
                    <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover/tip:block bg-gray-900 text-white text-[10px] px-2 py-1 rounded whitespace-nowrap">No Candidates</span>
                  </div>
                )}
                {job.aiMatch && (
                  <div className="relative group/tip">
                    <div className="bg-purple-100 p-1 rounded">
                      <BrainCircuit size={12} className="text-purple-600" />
                    </div>
                    <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover/tip:block bg-gray-900 text-white text-[10px] px-2 py-1 rounded whitespace-nowrap">AI Match Ready</span>
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
              />
            </td>
            <td className="p-4">
              <div className="flex flex-col">
                <span className="text-[11px] text-gray-400 uppercase font-bold tracking-wider">Owner</span>
                <span className="text-xs text-gray-700">{job.owner}</span>
                <span className="text-[11px] text-gray-400 mt-1">{job.createdDate}</span>
              </div>
            </td>
            <td className="p-4 text-right" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-end gap-1">
                <button type="button" onClick={() => onJobClick?.(job)} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-blue-600 transition-colors" title="Preview job">
                  <Eye size={16} />
                </button>
                <button className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-blue-600 transition-colors" title="Add Candidate">
                  <UserPlus size={16} />
                </button>
                {onDeleteJob && (
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
                <button className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-900" title="More Options">
                  <MoreHorizontal size={16} />
                </button>
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
    <div className="p-4 border-t border-gray-100 flex items-center justify-between text-sm text-gray-500">
      <span>Showing 6 of 42 jobs</span>
      <div className="flex items-center gap-2">
        <button className="px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50" disabled>Previous</button>
        <div className="flex items-center gap-1">
          {[1, 2, 3, 4, '...', 7].map((p, i) => (
            <button key={i} className={`w-8 h-8 rounded-lg flex items-center justify-center ${p === 1 ? 'bg-blue-600 text-white' : 'hover:bg-gray-100'}`}>
              {p}
            </button>
          ))}
        </div>
        <button className="px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50">Next</button>
      </div>
    </div>
  </div>
);

const JobsBoardView = ({ jobs, onJobClick }: JobsBoardViewProps) => {
  const columns = [
    { id: 'new', label: 'New Candidates', count: 12 },
    { id: 'shortlist', label: 'Shortlisted', count: 8 },
    { id: 'interview', label: 'Interviewing', count: 15 },
    { id: 'offered', label: 'Offered', count: 4 },
    { id: 'joined', label: 'Joined', count: 22 },
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
            {jobs.slice(0, 3).map((job) => (
              <div key={job.id} role="button" tabIndex={0} onClick={() => onJobClick?.(job)} onKeyDown={(e) => e.key === 'Enter' && onJobClick?.(job)} className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm hover:border-blue-400 cursor-pointer transition-all">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex flex-col">
                    <span className="text-xs font-mono text-gray-400 mb-1">{job.id}</span>
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
            <button className="py-2 border-2 border-dashed border-gray-200 rounded-xl text-gray-400 text-xs font-bold hover:bg-gray-50 hover:border-gray-300 transition-colors">
              + Assign Job
            </button>
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

function mapBackendJob(job: BackendJob): Job {
  const applied = job._count?.matches ?? 0;
  const interviewed = job._count?.interviews ?? 0;
  const joined = job._count?.placements ?? 0;

  return {
    id: job.id,
    title: job.title,
    client: job.client?.companyName ?? '—',
    location: job.location ?? '—',
    status: mapBackendStatus(job.status),
    applied,
    interviewed,
    offered: 0,
    joined,
    openings: job.openings,
    owner: job.assignedTo?.name ?? 'Unassigned',
    createdDate: job.createdAt?.slice(0, 10) ?? '—',
    hot: (job as any).hot ?? false,
    aiMatch: (job as any).aiMatch ?? false,
    noCandidates: (job as any).noCandidates ?? false,
    slaRisk: (job as any).slaRisk ?? false,
  };
}

function toJobCandidateItemFromApplied(match: any, fallbackRecruiter = '—'): JobCandidateItem {
  return {
    id: match.candidateId || match.candidate?.id || match.id,
    candidateName: match.candidate
      ? `${match.candidate.firstName || ''} ${match.candidate.lastName || ''}`.trim() || '—'
      : '—',
    currentStage: match.status || 'Applied',
    score: typeof match.score === 'number' ? `${Math.round(match.score)}%` : '—',
    recruiter: match.createdBy?.name || fallbackRecruiter,
    interviewStatus: 'Not scheduled',
    lastActivity: match.createdAt
      ? new Date(match.createdAt).toLocaleString('en-US', {
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
        })
      : '—',
  };
}

function toJobCandidateItemFromAssigned(candidate: BackendCandidate): JobCandidateItem {
  return {
    id: candidate.id,
    candidateName: `${candidate.firstName || ''} ${candidate.lastName || ''}`.trim() || '—',
    currentStage: candidate.stage || 'Applied',
    score: '—',
    recruiter: candidate.assignedTo?.name || '—',
    interviewStatus: 'Not scheduled',
    lastActivity: candidate.updatedAt
      ? new Date(candidate.updatedAt).toLocaleString('en-US', {
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
        })
      : candidate.createdAt
      ? new Date(candidate.createdAt).toLocaleString('en-US', {
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
        })
      : '—',
  };
}

export default function JobsPage() {
  const [view, setView] = useState<'list' | 'board'>('list');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [createTaskOpen, setCreateTaskOpen] = useState(false);
  const [createJobDrawerOpen, setCreateJobDrawerOpen] = useState(false);
  const [jobDrawerOpen, setJobDrawerOpen] = useState(false);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [jobCandidates, setJobCandidates] = useState<JobCandidateItem[]>([]);
  const [statusEdit, setStatusEdit] = useState<{
    jobId: string | null;
    newStatus: JobStatus | null;
    remark: string;
  }>({
    jobId: null,
    newStatus: null,
    remark: '',
  });

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

    async function loadJobs() {
      try {
        setLoading(true);
        setError(null);
        const res = await apiGetJobs({});
        if (cancelled) return;
        
        // Backend returns: { success: true, message: "...", data: { data: [...], pagination: {...} } }
        // So res.data is { data: [...], pagination: {...} }
        let backendJobs: BackendJob[] = [];
        if (res.data) {
          if (Array.isArray(res.data)) {
            // Direct array (unlikely but handle it)
            backendJobs = res.data;
          } else if (Array.isArray(res.data.data)) {
            // Paginated response: { data: [...], pagination: {...} }
            backendJobs = res.data.data;
          } else if (Array.isArray(res.data.items)) {
            // Alternative structure with items
            backendJobs = res.data.items;
          } else {
            console.warn('Unexpected response structure:', res.data);
            backendJobs = [];
          }
        }
        
        if (!Array.isArray(backendJobs)) {
          console.error('Unexpected API response format: data is not an array.', res);
          setError('Unexpected API response format.');
          setJobs([]);
          return;
        }
        
        const mapped = backendJobs.map(mapBackendJob);
        setJobs(mapped);
      } catch (err: any) {
        if (cancelled) return;
        setError(err?.message || 'Failed to load jobs from API.');
        setJobs([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    async function loadMetrics() {
      try {
        setLoadingMetrics(true);
        const response = await apiGetJobMetrics();
        if (cancelled) return;
        const metrics = (response as any).data?.data || (response as any).data || response;
        setJobMetrics(metrics);
      } catch (err: any) {
        if (cancelled) return;
        console.error('Failed to load job metrics:', err);
        // Set default metrics on error
        setJobMetrics({
          activeJobs: 0,
          newJobsThisWeek: 0,
          noCandidates: 0,
          nearSla: 0,
          closedThisMonth: 0,
        });
      } finally {
        if (!cancelled) setLoadingMetrics(false);
      }
    }

    loadJobs();
    loadMetrics();

    return () => {
      cancelled = true;
    };
  }, []);

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
  const [jobMetrics, setJobMetrics] = useState<JobMetrics | null>(null);
  const [loadingMetrics, setLoadingMetrics] = useState(false);
  const [deletingJobId, setDeletingJobId] = useState<string | null>(null);

  const handleDeleteJob = async (jobId: string, jobTitle: string) => {
    if (!window.confirm(`Are you sure you want to delete "${jobTitle}"? This action cannot be undone.`)) {
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
        const response = await apiGetJobMetrics();
        const metrics = (response as any).data?.data || (response as any).data || response;
        setJobMetrics(metrics);
      } catch (err) {
        console.error('Failed to refresh metrics:', err);
      }
      
      // Reload jobs list
      try {
        setLoading(true);
        const res = await apiGetJobs({});
        let backendJobs: BackendJob[] = [];
        if (res.data) {
          if (Array.isArray(res.data)) {
            backendJobs = res.data;
          } else if (Array.isArray(res.data.data)) {
            backendJobs = res.data.data;
          } else if (Array.isArray(res.data.items)) {
            backendJobs = res.data.items;
          }
        }
        if (Array.isArray(backendJobs)) {
          const mapped = backendJobs.map(mapBackendJob);
          setJobs(mapped);
        } else {
          setJobs([]);
        }
      } catch (err: any) {
        console.error('Failed to refresh jobs:', err);
      } finally {
        setLoading(false);
      }
    } catch (err: any) {
      console.error('Failed to delete job:', err);
      alert(err?.message || 'Failed to delete job');
    } finally {
      setDeletingJobId(null);
    }
  };

  const fetchJobCandidates = useCallback(async (jobId: string, backendJob?: any) => {
    const appliedCandidates: JobCandidateItem[] = Array.isArray(backendJob?.matches)
      ? backendJob.matches.map((match: any) => toJobCandidateItemFromApplied(match, backendJob?.assignedTo?.name || '—'))
      : [];

    try {
      const candidatesResponse = await apiGetCandidates({ page: 1, limit: 300 });
      const candidatesData = (candidatesResponse as any).data?.data || (candidatesResponse as any).data || [];
      const allCandidates: BackendCandidate[] = Array.isArray(candidatesData) ? candidatesData : [];

      const assignedCandidates = allCandidates
        .filter((candidate) => Array.isArray(candidate.assignedJobs) && candidate.assignedJobs.includes(jobId))
        .map(toJobCandidateItemFromAssigned);

      const merged = [...appliedCandidates, ...assignedCandidates];
      const deduped = Array.from(new Map(merged.map((candidate) => [candidate.id, candidate])).values());
      setJobCandidates(deduped);
    } catch (error) {
      console.error('Failed to fetch assigned candidates:', error);
      setJobCandidates(appliedCandidates);
    }
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
        location: backendJob.location || job.location,
        status: mapBackendStatus(backendJob.status) as JobForDrawer['status'],
        employmentType: backendJob.type === 'FULL_TIME' ? 'Full-time' : 
                       backendJob.type === 'PART_TIME' ? 'Part-time' :
                       backendJob.type === 'CONTRACT' ? 'Contract' : 'Internship',
        salaryRange: backendJob.salary ? 
          `$${backendJob.salary.min || '0'}k – $${backendJob.salary.max || '0'}k` : 
          undefined,
        postedDate: backendJob.postedDate ? new Date(backendJob.postedDate).toISOString().split('T')[0] : 
                   backendJob.createdAt ? backendJob.createdAt.split('T')[0] : job.createdDate,
        recruiter: backendJob.assignedTo?.name || job.owner,
        hiringManager: backendJob.hiringManager || '—',
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
          sla: '', // SLA not stored in database currently
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

  const persistJobPipelineStages = useCallback(async (jobId: string, stages: Array<{ id?: string; name: string; sla?: string }>) => {
    if (!jobId) return;
    try {
      await apiUpdateJob(jobId, {
        pipelineStages: stages.map((stage, index) => ({
          id: stage.id,
          name: stage.name,
          sla: stage.sla,
          order: index + 1,
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
          }))
        );
      }
    } catch (error) {
      console.error('Failed to save job pipeline stages:', error);
      alert((error as any)?.message || 'Failed to save pipeline');
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

  const openMoveStage = useCallback(
    async (candidateId: string, jobId: string) => {
      let stages = Array.isArray(jobPipelineStages) ? jobPipelineStages : [];
      if (!stages.length) {
        try {
          const response = await apiGetJob(jobId);
          const backendJob = (response as any).data?.data || (response as any).data || response;
          stages = Array.isArray(backendJob?.pipelineStages)
            ? backendJob.pipelineStages.map((stage: any) => ({ id: stage.id, name: stage.name }))
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
      alert((error as any)?.message || 'Failed to move stage');
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
      // Refresh jobs to get latest data
      const res = await apiGetJobs({});
      let backendJobs: BackendJob[] = [];
      if (res.data) {
        if (Array.isArray(res.data)) {
          backendJobs = res.data;
        } else if (Array.isArray(res.data.data)) {
          backendJobs = res.data.data;
        } else if (Array.isArray(res.data.items)) {
          backendJobs = res.data.items;
        }
      }
      const mapped = backendJobs.map(mapBackendJob);
      setJobs(mapped);
    } catch (err: any) {
      console.error('Failed to update job status with remark:', err);
      alert(err.message || 'Failed to update job status');
      // Revert by refreshing from backend
      try {
        const res = await apiGetJobs({});
        let backendJobs: BackendJob[] = [];
        if (res.data) {
          if (Array.isArray(res.data)) {
            backendJobs = res.data;
          } else if (Array.isArray(res.data.data)) {
            backendJobs = res.data.data;
          } else if (Array.isArray(res.data.items)) {
            backendJobs = res.data.items;
          }
        }
        const mapped = backendJobs.map(mapBackendJob);
        setJobs(mapped);
      } catch {
        // ignore
      }
    } finally {
      setStatusEdit({ jobId: null, newStatus: null, remark: '' });
    }
  };

  const handleCancelStatusEdit = async () => {
    setStatusEdit({ jobId: null, newStatus: null, remark: '' });
    // Reload to ensure UI matches backend
    try {
      const res = await apiGetJobs({});
      let backendJobs: BackendJob[] = [];
      if (res.data) {
        if (Array.isArray(res.data)) {
          backendJobs = res.data;
        } else if (Array.isArray(res.data.data)) {
          backendJobs = res.data.data;
        } else if (Array.isArray(res.data.items)) {
          backendJobs = res.data.items;
        }
      }
      const mapped = backendJobs.map(mapBackendJob);
      setJobs(mapped);
    } catch {
      // ignore
    }
  };

  return (
    <div className="w-full min-h-screen bg-gray-50 font-sans text-gray-900">
      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
          <div className="max-w-[1440px] mx-auto space-y-8">
            
            {/* Page Header */}
            <div className="flex items-end justify-between">
              <div className="space-y-1">
                <h1 className="text-3xl font-bold tracking-tight text-gray-900">Jobs</h1>
                <p className="text-gray-500">Manage your recruitment pipeline and active openings.</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="bg-white p-1 rounded-xl border border-gray-200 flex items-center shadow-sm">
                  <button 
                    onClick={() => setView('list')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${view === 'list' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'}`}
                  >
                    <List size={18} />
                    List View
                  </button>
                  <button 
                    onClick={() => setView('board')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${view === 'board' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'}`}
                  >
                    <LayoutGrid size={18} />
                    Board View
                  </button>
                </div>
                <button className="p-2.5 bg-white border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 transition-colors shadow-sm">
                  <RefreshCcw size={20} />
                </button>
                <button
                  onClick={() => setCreateTaskOpen(true)}
                  className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 transition-all shadow-sm"
                >
                  <CheckSquare size={18} />
                  Create Task
                </button>
                <button
                  onClick={() => setCreateJobDrawerOpen(true)}
                  className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-200"
                >
                  <Plus size={20} />
                  Create Job
                </button>
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
                      {loadingMetrics ? (
                        <div className="text-xs font-bold text-gray-400 bg-gray-50 px-2 py-1 rounded">
                          Loading...
                        </div>
                      ) : (
                        <div className="text-xs font-bold text-gray-400 bg-gray-50 px-2 py-1 rounded">
                          +12% <ChevronDown size={12} className="inline rotate-180" />
                        </div>
                      )}
                    </div>
                    <div className="space-y-1">
                      <p className="text-2xl font-bold text-gray-900">{loadingMetrics ? '—' : value}</p>
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
                    <button 
                      onClick={() => setIsFilterOpen(!isFilterOpen)}
                      className={`flex items-center gap-2 px-4 py-2 rounded-xl border font-bold text-sm transition-all ${isFilterOpen ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'}`}
                    >
                      <Filter size={18} />
                      Filters
                      {isFilterOpen ? <ChevronDown size={16} className="rotate-180" /> : <ChevronDown size={16} />}
                    </button>
                  </div>
                  <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-full border border-gray-200 text-xs text-gray-500">
                    <span className="font-bold text-blue-600">Active</span>
                    <button className="hover:text-red-500">×</button>
                  </div>
                  <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-full border border-gray-200 text-xs text-gray-500">
                    <span className="font-bold">Last 30 Days</span>
                    <button className="hover:text-red-500">×</button>
                  </div>
                  <button className="text-xs font-bold text-blue-600 hover:underline">Clear All</button>
                </div>
                <div className="text-sm text-gray-500 font-medium">
                  Sort by: <span className="text-gray-900 font-bold cursor-pointer hover:underline">Recently Created <ChevronDown size={14} className="inline" /></span>
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
                    <div className="bg-white p-6 rounded-2xl border border-gray-200 grid grid-cols-4 gap-6 shadow-sm">
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-500 uppercase">Job Status</label>
                        <select className="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500">
                          <option>All Statuses</option>
                          <option>Active</option>
                          <option>On Hold</option>
                          <option>Closed</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-500 uppercase">Client</label>
                        <select className="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500">
                          <option>All Clients</option>
                          <option>TechCorp Solutions</option>
                          <option>FinFlow Systems</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-500 uppercase">Location</label>
                        <input type="text" placeholder="City or Country" className="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-500 uppercase">Job Type</label>
                        <select className="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500">
                          <option>Full-time</option>
                          <option>Contract</option>
                          <option>Freelance</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-500 uppercase">Salary Range</label>
                        <div className="flex gap-2">
                          <input type="text" placeholder="Min" className="w-1/2 p-2 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                          <input type="text" placeholder="Max" className="w-1/2 p-2 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-500 uppercase">Recruiter</label>
                        <select className="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500">
                          <option>All Recruiters</option>
                          <option>Alex Rivers</option>
                          <option>Sarah Chen</option>
                        </select>
                      </div>
                      <div className="flex items-center gap-6 pt-6">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input type="checkbox" className="w-4 h-4 text-blue-600 rounded border-gray-300" />
                          <span className="text-sm font-medium">Hot Jobs Only</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input type="checkbox" className="w-4 h-4 text-blue-600 rounded border-gray-300" />
                          <span className="text-sm font-medium">AI Match Ready</span>
                        </label>
                      </div>
                      <div className="flex items-end justify-end pt-6">
                        <button className="text-sm font-bold text-blue-600 hover:text-blue-700 px-4 py-2">Reset</button>
                        <button className="bg-blue-600 text-white px-6 py-2 rounded-lg font-bold text-sm shadow-md hover:bg-blue-700 transition-colors">Apply Filters</button>
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
                <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-sm text-gray-500">
                  Loading jobs from API...
                </div>
              ) : view === 'list' ? (
                <JobsListView 
                  jobs={jobs} 
                  onJobClick={openJobDrawer} 
                  onDeleteJob={handleDeleteJob} 
                  deletingJobId={deletingJobId}
                  statusEdit={statusEdit}
                  onStatusChange={handleInlineStatusChange}
                  onRemarkChange={handleRemarkChange}
                  onSaveStatusEdit={handleSaveStatusEdit}
                  onCancelStatusEdit={handleCancelStatusEdit}
                />
              ) : (
                <JobsBoardView jobs={jobs} onJobClick={openJobDrawer} />
              )}
            </motion.div>

          </div>
        </div>

      <CreateJobDrawer
        isOpen={createJobDrawerOpen}
        onClose={() => setCreateJobDrawerOpen(false)}
        onJobCreated={() => {
          setCreateJobDrawerOpen(false);
          // Reload jobs
          const loadJobs = async () => {
            try {
              setLoading(true);
              setError(null);
              const res = await apiGetJobs({});
              
              let backendJobs: BackendJob[] = [];
              if (res.data) {
                if (Array.isArray(res.data)) {
                  backendJobs = res.data;
                } else if (Array.isArray(res.data.data)) {
                  backendJobs = res.data.data;
                } else if (Array.isArray(res.data.items)) {
                  backendJobs = res.data.items;
                }
              }
              
              if (!Array.isArray(backendJobs)) {
                console.error('Unexpected API response format: data is not an array.', res);
                setError('Unexpected API response format.');
                setJobs([]);
                return;
              }
              
              const mapped = backendJobs.map(mapBackendJob);
              setJobs(mapped);
            } catch (err: any) {
              setError(err?.message || 'Failed to load jobs from API.');
              setJobs([]);
            } finally {
              setLoading(false);
            }
          };
          loadJobs();
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
        onEdit={(job) => {
          setEditingJobId(job.id);
          setEditJobDrawerOpen(true);
        }}
        onPublish={(job) => { /* TODO: publish job */ }}
        onClone={(job) => { /* TODO: clone job */ }}
        onCloseJob={(job) => { /* TODO: close job */ }}
        onMoveStage={(candidateId, jobId) => openMoveStage(candidateId, jobId)}
        onScheduleInterview={(candidateId, jobId) => { /* TODO: schedule interview */ }}
        onRejectCandidate={(candidateId, jobId) => { /* TODO: reject candidate */ }}
        onViewCandidateProfile={(candidateId) => { /* TODO: navigate to candidate profile */ }}
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
                  <div className="text-xs text-slate-500 mt-1">Select a stage from this job’s pipeline.</div>
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
        isOpen={editJobDrawerOpen}
        jobId={editingJobId || undefined}
        onClose={() => {
          setEditJobDrawerOpen(false);
          setEditingJobId(null);
        }}
        onJobUpdated={() => {
          setEditJobDrawerOpen(false);
          setEditingJobId(null);
          // Reload jobs and refresh job details if drawer is open
          const loadJobs = async () => {
            try {
              setLoading(true);
              setError(null);
              const res = await apiGetJobs({});
              
              let backendJobs: BackendJob[] = [];
              if (res.data) {
                if (Array.isArray(res.data)) {
                  backendJobs = res.data;
                } else if (Array.isArray(res.data.data)) {
                  backendJobs = res.data.data;
                } else if (Array.isArray(res.data.items)) {
                  backendJobs = res.data.items;
                }
              }
              
              if (!Array.isArray(backendJobs)) {
                console.error('Unexpected API response format: data is not an array.', res);
                setError('Unexpected API response format.');
                setJobs([]);
                return;
              }
              
              const mapped = backendJobs.map(mapBackendJob);
              setJobs(mapped);
              
              // Refresh job details if drawer is open
              if (selectedJob && editingJobId) {
                const updatedJob = mapped.find(j => j.id === editingJobId);
                if (updatedJob) {
                  setSelectedJob(updatedJob);
                  // Reload full job details
                  try {
                    const response = await apiGetJob(editingJobId);
                    const backendJob = (response as any).data?.data || (response as any).data || response;
                    
                    const mappedJob: JobForDrawer = {
                      id: backendJob.id,
                      title: backendJob.title,
                      client: backendJob.client?.companyName || updatedJob.client,
                      location: backendJob.location || updatedJob.location,
                      status: mapBackendStatus(backendJob.status) as JobForDrawer['status'],
                      employmentType: backendJob.type === 'FULL_TIME' ? 'Full-time' : 
                                     backendJob.type === 'PART_TIME' ? 'Part-time' :
                                     backendJob.type === 'CONTRACT' ? 'Contract' : 'Internship',
                      salaryRange: backendJob.salary ? 
                        `$${backendJob.salary.min || '0'}k – $${backendJob.salary.max || '0'}k` : 
                        undefined,
                      postedDate: backendJob.postedDate ? new Date(backendJob.postedDate).toISOString().split('T')[0] : 
                                 backendJob.createdAt ? backendJob.createdAt.split('T')[0] : updatedJob.createdDate,
                      recruiter: backendJob.assignedTo?.name || updatedJob.owner,
                      hiringManager: backendJob.hiringManager || '—',
                      applied: backendJob._count?.matches || updatedJob.applied,
                      interviewed: backendJob._count?.interviews || updatedJob.interviewed,
                      offered: 0,
                      joined: backendJob._count?.placements || updatedJob.joined,
                      openings: backendJob.openings || updatedJob.openings,
                      owner: backendJob.assignedTo?.name || updatedJob.owner,
                      createdDate: backendJob.createdAt ? backendJob.createdAt.split('T')[0] : updatedJob.createdDate,
                      overview: backendJob.overview || undefined,
                      keyResponsibilities: backendJob.keyResponsibilities || undefined,
                      requiredSkills: backendJob.skills || undefined,
                      preferredSkills: backendJob.preferredSkills || undefined,
                      experienceRequired: backendJob.experienceRequired || undefined,
                      education: backendJob.education || undefined,
                      benefits: backendJob.benefits || undefined,
                    };
                    
                    setJobDetails(mappedJob);
                    
                    if (backendJob.pipelineStages && Array.isArray(backendJob.pipelineStages)) {
                      const stages = backendJob.pipelineStages.map((stage: any) => ({
                        id: stage.id,
                        name: stage.name,
                        sla: '',
                      }));
                      setJobPipelineStages(stages);
                    }
                  } catch (error) {
                    console.error('Failed to refresh job details:', error);
                  }
                }
              }
            } catch (err: any) {
              setError(err?.message || 'Failed to load jobs from API.');
              setJobs([]);
            } finally {
              setLoading(false);
            }
          };
          loadJobs();
        }}
      />

      <CreateTaskModal
        isOpen={createTaskOpen}
        onClose={() => setCreateTaskOpen(false)}
        onSuccess={() => setCreateTaskOpen(false)}
        initialRelatedTo="Job"
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
    </div>
  );
}
