'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Pencil,
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
  DollarSign,
  Send,
  Copy,
  Archive,
  ChevronDown,
  ChevronRight,
  ListChecks,
  Award,
  GraduationCap,
  Heart,
  MoreVertical,
  ArrowRightLeft,
  CalendarPlus,
  UserX,
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
} from 'lucide-react';
import { ImageWithFallback } from '../ImageWithFallback';
import { NotesService } from '../NotesService';
import { StatusChangeService } from '../StatusChangeService';
import { apiGetJobActivities, apiUpdateJob, type BackendActivity } from '../../lib/api';
import { useFiles } from '../../hooks/useFiles';

export type JobDrawerStatus = 'Draft' | 'Active' | 'On Hold' | 'Closed';

export interface JobForDrawer {
  id: string;
  title: string;
  client: string;
  location: string;
  status: JobDrawerStatus;
  employmentType?: string;
  salaryRange?: string;
  postedDate?: string;
  recruiter?: string;
  hiringManager?: string;
  applied: number;
  interviewed: number;
  offered: number;
  joined: number;
  openings: number;
  owner: string;
  createdDate: string;
  jobCategory?: string;
  jobLocationType?: string;
  salaryType?: string;
  salaryCurrency?: string;
  minSalary?: number;
  maxSalary?: number;
   department?: string;
   applicationFormEnabled?: boolean;
   applicationFormLogo?: string;
   applicationFormQuestions?: string[];
   applicationFormNote?: string;
  overview?: string;
  keyResponsibilities?: string[];
  requiredSkills?: string[];
  preferredSkills?: string[];
  experienceRequired?: string;
  education?: string;
  benefits?: string[];
}

/** Pipeline stage for Job Pipeline Configuration */
export interface JobPipelineStage {
  id: string;
  name: string;
  sla?: string;
}

/** Candidate row for Job Candidates list (Candidates tab) */
export interface JobCandidateItem {
  id: string;
  candidateName: string;
  currentStage: string;
  score: string | number;
  recruiter: string;
  interviewStatus: string;
  lastActivity: string;
}

export interface JobDetailsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  job: JobForDrawer | null;
  /** Candidates applied/sourced for the current job (for Candidates tab) */
  jobCandidates?: JobCandidateItem[];
  /** Custom pipeline stages for this job (for Pipeline tab config). If not provided, default stages are used. */
  pipelineStages?: JobPipelineStage[];
  /** Called when pipeline stages are reordered, added, or removed */
  onPipelineStagesChange?: (stages: JobPipelineStage[]) => void;
  /** Called when user clicks "Save pipeline" */
  onSavePipelineStages?: (stages: JobPipelineStage[]) => void;
  onEdit?: (job: JobForDrawer) => void;
  onPublish?: (job: JobForDrawer) => void;
  onClone?: (job: JobForDrawer) => void;
  onCloseJob?: (job: JobForDrawer) => void;
  onMoveStage?: (candidateId: string, jobId: string) => void;
  onScheduleInterview?: (candidateId: string, jobId: string) => void;
  onRejectCandidate?: (candidateId: string, jobId: string) => void;
  onViewCandidateProfile?: (candidateId: string) => void;
}

const TAB_CONFIG = [
  { id: 'overview' as const, label: 'Overview', icon: LayoutGrid },
  { id: 'candidates' as const, label: 'Candidates', icon: Users },
  { id: 'pipeline' as const, label: 'Pipeline', icon: GitBranch },
  { id: 'analytics' as const, label: 'Analytics', icon: BarChart2 },
  { id: 'assignment' as const, label: 'Assignment', icon: UserCog },
  { id: 'interviews' as const, label: 'Interviews', icon: Calendar },
  { id: 'placements' as const, label: 'Placements', icon: UserCheck },
  { id: 'activity' as const, label: 'Activity', icon: Activity },
  { id: 'notes' as const, label: 'Notes', icon: StickyNote },
  { id: 'files' as const, label: 'Files', icon: Paperclip },
];
/** Analytics is only opened via header button, not shown in tab bar */
const TABS_VISIBLE_IN_BAR = TAB_CONFIG.filter((t) => t.id !== 'analytics');

/** Job note (same shape as client notes, job-related tags) */
export type JobNoteTag = 'JD' | 'Requirements' | 'Feedback' | 'Hiring' | 'Other';
export interface JobNote {
  id: string;
  title: string;
  content?: string;
  tags: JobNoteTag[];
  createdBy: { name: string; avatar?: string };
  createdAt: string;
  isPinned?: boolean;
}

/** Job file (documents attached to job) */
export type JobFileType = 'JD' | 'Contract' | 'Offer Letter' | 'Policy' | 'Resume' | 'Other';
export interface JobFile {
  id: string;
  fileName: string;
  fileType: JobFileType;
  uploadedBy: { name: string; avatar?: string };
  uploadDate: string;
}

const JOB_NOTE_TAG_STYLES: Record<JobNoteTag, string> = {
  JD: 'bg-blue-100 text-blue-700 border-blue-200',
  Requirements: 'bg-violet-100 text-violet-700 border-violet-200',
  Feedback: 'bg-amber-100 text-amber-700 border-amber-200',
  Hiring: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  Other: 'bg-slate-100 text-slate-600 border-slate-200',
};

const JOB_FILE_TYPE_BADGE_STYLES: Record<JobFileType, string> = {
  JD: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  Contract: 'bg-blue-100 text-blue-700 border-blue-200',
  'Offer Letter': 'bg-emerald-100 text-emerald-700 border-emerald-200',
  Policy: 'bg-amber-100 text-amber-700 border-amber-200',
  Resume: 'bg-slate-100 text-slate-700 border-slate-200',
  Other: 'bg-slate-100 text-slate-600 border-slate-200',
};

/** Mock notes per job id */
const MOCK_JOB_NOTES: Record<string, JobNote[]> = {
  default: [
    { id: 'jn1', title: 'JD review with hiring manager', content: 'Clarified must-have vs nice-to-have skills. Remote OK.', tags: ['JD', 'Requirements'], createdBy: { name: 'Alex Thompson', avatar: 'https://images.unsplash.com/photo-1701463387028-3947648f1337?q=80&w=150' }, createdAt: 'Mar 5, 2026, 10:30 AM', isPinned: true },
    { id: 'jn2', title: 'Feedback on shortlisted candidates', content: 'Tech lead liked 2 of 5. Requested one more round.', tags: ['Feedback'], createdBy: { name: 'Sarah Chen' }, createdAt: 'Mar 4, 2026, 2:00 PM', isPinned: false },
    { id: 'jn3', title: 'Offer approval', content: 'Comp approved. Start date aligned to Apr 1.', tags: ['Hiring'], createdBy: { name: 'Alex Thompson', avatar: 'https://images.unsplash.com/photo-1701463387028-3947648f1337?q=80&w=150' }, createdAt: 'Mar 3, 2026, 5:00 PM', isPinned: true },
  ],
};

const STATUS_STYLES: Record<JobDrawerStatus, string> = {
  Draft: 'bg-slate-100 text-slate-700 border-slate-200',
  Active: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  'On Hold': 'bg-amber-100 text-amber-700 border-amber-200',
  Closed: 'bg-gray-100 text-gray-600 border-gray-200',
};

export function JobDetailsDrawer({
  isOpen,
  onClose,
  job,
  onEdit,
  onPublish,
  onClone,
  onCloseJob,
  jobCandidates = [],
  pipelineStages: initialPipelineStages,
  onPipelineStagesChange,
  onSavePipelineStages,
  onMoveStage,
  onScheduleInterview,
  onRejectCandidate,
  onViewCandidateProfile,
}: JobDetailsDrawerProps) {
  const [pipelineStages, setPipelineStages] = useState<JobPipelineStage[]>(initialPipelineStages ?? []);
  const [draggedStageId, setDraggedStageId] = useState<string | null>(null);
  const [pipelineDirty, setPipelineDirty] = useState(false);
  const isOwnPipelineEditRef = useRef(false);

  useEffect(() => {
    if (job) {
      setPipelineStages(initialPipelineStages ?? []);
      if (!isOwnPipelineEditRef.current) {
        setPipelineDirty(false);
      }
      isOwnPipelineEditRef.current = false;
    }
  }, [job?.id, initialPipelineStages]);

  const notifyPipelineChange = (stages: JobPipelineStage[]) => {
    isOwnPipelineEditRef.current = true;
    onPipelineStagesChange?.(stages);
  };

  const [activeTab, setActiveTab] = useState<(typeof TAB_CONFIG)[number]['id']>('overview');
  const [candidateMenuOpen, setCandidateMenuOpen] = useState<string | null>(null);
  const [notesTagFilter, setNotesTagFilter] = useState<JobNoteTag | 'All'>('All');
  const [pinnedNoteIds, setPinnedNoteIds] = useState<Set<string>>(new Set());
  const [filesTypeFilter, setFilesTypeFilter] = useState<JobFileType | 'All'>('All');
  const [jobActivities, setJobActivities] = useState<BackendActivity[]>([]);
  const [loadingActivities, setLoadingActivities] = useState(false);
  const [activityFilter, setActivityFilter] = useState<'All' | 'Jobs' | 'Candidates' | 'Interviews' | 'Notes' | 'Files'>('All');
  const [showStatusChange, setShowStatusChange] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { files: jobFiles, loading: filesLoading, uploading: filesUploading, error: filesError, uploadFile, deleteFile } = useFiles('job', job?.id);
  const [overviewOpen, setOverviewOpen] = useState<Record<string, boolean>>({
    overview: true,
    keyResponsibilities: true,
    requiredSkills: true,
    preferredSkills: false,
    experience: false,
    education: false,
    benefits: false,
  });

  // Fetch job activities when activity tab is active
  useEffect(() => {
    if (!job?.id || activeTab !== 'activity') return;

    const fetchActivities = async () => {
      setLoadingActivities(true);
      try {
        const response = await apiGetJobActivities(job.id);
        setJobActivities(response.data || []);
      } catch (error: any) {
        // If route doesn't exist yet, show empty state gracefully
        console.warn('Job activities endpoint may not be available:', error.message);
        setJobActivities([]);
      } finally {
        setLoadingActivities(false);
      }
    };

    fetchActivities();
  }, [job?.id, activeTab]);

  const toggleOverviewSection = (key: string) => {
    setOverviewOpen((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handlePipelineReorder = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return;
    const next = [...pipelineStages];
    const [removed] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, removed);
    setPipelineStages(next);
    notifyPipelineChange(next);
    setPipelineDirty(true);
  };

  const handleAddStage = () => {
    const next = [...pipelineStages, { id: `s-${Date.now()}`, name: 'New stage', sla: '' }];
    setPipelineStages(next);
    notifyPipelineChange(next);
    setPipelineDirty(true);
  };

  const handleRemoveStage = (id: string) => {
    const next = pipelineStages.filter((s) => s.id !== id);
    setPipelineStages(next);
    notifyPipelineChange(next);
    setPipelineDirty(true);
  };

  const handleStageNameChange = (id: string, name: string) => {
    const next = pipelineStages.map((s) => (s.id === id ? { ...s, name } : s));
    setPipelineStages(next);
    notifyPipelineChange(next);
    setPipelineDirty(true);
  };

  const handleStageSlaChange = (id: string, sla: string) => {
    const next = pipelineStages.map((s) => (s.id === id ? { ...s, sla } : s));
    setPipelineStages(next);
    notifyPipelineChange(next);
    setPipelineDirty(true);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        key="backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-[2px] pointer-events-auto"
      />
      <motion.div
        key="panel"
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="fixed right-0 top-0 h-full w-1/2 max-w-2xl bg-white shadow-2xl z-50 pointer-events-auto border-l border-slate-200 flex flex-col"
      >
        {/* Header */}
        <div className="shrink-0 border-b border-slate-200 p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              {job ? (
                <>
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">JOB DETAILS</p>
                  <h2 className="text-lg font-bold text-slate-900 mt-0.5 truncate">{job.title}</h2>
                  <div className="flex flex-wrap items-center gap-2 mt-2 text-sm text-slate-600">
                    <span className="flex items-center gap-1">
                      <Briefcase size={14} className="text-slate-400" />
                      {job.client}
                    </span>
                    <span className="flex items-center gap-1">
                      <MapPin size={14} className="text-slate-400" />
                      {job.location}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    {job.employmentType && (
                      <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                        {job.employmentType}
                      </span>
                    )}
                    {job.salaryRange && (
                      <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded flex items-center gap-1">
                        <DollarSign size={12} />
                        {job.salaryRange}
                      </span>
                    )}
                  </div>
                </>
              ) : (
                <h2 className="text-lg font-bold text-slate-900">Job Details</h2>
              )}
            </div>
            {job && (
              <button
                type="button"
                onClick={() => setActiveTab('analytics')}
                className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors shrink-0"
                aria-label="View analytics"
              >
                <BarChart2 size={16} /> Analytics
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors shrink-0"
              aria-label="Close"
            >
              <X size={20} />
            </button>
          </div>

          {/* Right-side info panel (inline in header area) */}
          {job && (
            <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
              <div>
                <span className="text-slate-400 font-medium">Job ID</span>
                <p className="font-mono text-slate-700 mt-0.5">{job.id}</p>
              </div>
              <div>
                <span className="text-slate-400 font-medium">Posted Date</span>
                <p className="text-slate-700 mt-0.5">{job.postedDate ?? job.createdDate}</p>
              </div>
              <div>
                <span className="text-slate-400 font-medium">Recruiter</span>
                <p className="text-slate-700 mt-0.5">{job.recruiter ?? job.owner}</p>
              </div>
              <div>
                <span className="text-slate-400 font-medium">Hiring Manager</span>
                <p className="text-slate-700 mt-0.5">{job.hiringManager ?? '—'}</p>
              </div>
              <div className="col-span-2">
                <span className="text-slate-400 font-medium">Status</span>
                <div className="mt-0.5">
                  {!showStatusChange ? (
                    <button
                      onClick={() => setShowStatusChange(true)}
                      className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-bold border ${STATUS_STYLES[job.status]} hover:opacity-80 cursor-pointer transition-opacity`}
                    >
                      {job.status}
                    </button>
                  ) : (
                    <StatusChangeService
                      currentStatus={job.status}
                      availableStatuses={['Active', 'On Hold', 'Closed']}
                      onStatusChange={async (newStatus, remark) => {
                        try {
                          await apiUpdateJob(job.id, {
                            status: newStatus === 'Active' ? 'OPEN' : newStatus === 'On Hold' ? 'ON_HOLD' : 'CLOSED',
                            statusRemark: remark,
                          } as any);
                          setShowStatusChange(false);
                          // Refresh job data
                          window.location.reload(); // Simple refresh for now
                        } catch (error: any) {
                          console.error('Failed to update job status:', error);
                          alert(error.message || 'Failed to update job status');
                        }
                      }}
                      onCancel={() => setShowStatusChange(false)}
                      title="Change Job Status"
                    />
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {job ? (
          <>
            {/* Tabs */}
            <div className="shrink-0 bg-slate-50/80 border-b border-slate-200 px-4 pt-1 overflow-x-auto custom-scrollbar">
              <div className="flex gap-1 min-w-max pb-1 pr-1">
                {TABS_VISIBLE_IN_BAR.map((tab) => {
                  const isActive = activeTab === tab.id;
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveTab(tab.id)}
                      className={`flex items-center gap-1.5 px-3 py-3 text-sm font-medium rounded-t-lg transition-all duration-200 whitespace-nowrap ${
                        isActive ? 'bg-white text-blue-600 border-b-2 border-blue-600 -mb-px shadow-sm' : 'border-b-2 border-transparent text-slate-500 hover:text-slate-700 hover:bg-white/60'
                      }`}
                    >
                      <Icon size={14} className={isActive ? 'text-blue-600' : 'text-slate-400'} strokeWidth={isActive ? 2.25 : 1.5} />
                      {tab.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Tab content */}
            <div className="flex-1 overflow-y-auto bg-slate-50/30 p-5">
              {activeTab === 'overview' && (
                <div className="space-y-4">
                  {/* Job Snapshot */}
                  <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="p-5 border-b border-slate-100 flex items-center justify-between gap-2">
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                        <LayoutGrid size={14} className="text-slate-400" />
                        Job Snapshot
                      </h4>
                    </div>
                    <div className="px-5 pb-5 pt-4 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3 text-sm">
                      <div>
                        <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Job Type</p>
                        <p className="text-slate-800 mt-1">{job.employmentType || '—'}</p>
                      </div>
                      <div>
                        <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Job Category</p>
                        <p className="text-slate-800 mt-1">{job.jobCategory || '—'}</p>
                      </div>
                      <div>
                        <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Job Function / Department</p>
                        <p className="text-slate-800 mt-1">{job.department || '—'}</p>
                      </div>
                      <div>
                        <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Job Location Type</p>
                        <p className="text-slate-800 mt-1">{job.jobLocationType || '—'}</p>
                      </div>
                      <div>
                        <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Openings</p>
                        <p className="text-slate-800 mt-1">{job.openings}</p>
                      </div>
                      <div>
                        <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Experience</p>
                        <p className="text-slate-800 mt-1">{job.experienceRequired || '—'}</p>
                      </div>
                      <div>
                        <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Education</p>
                        <p className="text-slate-800 mt-1">{job.education || '—'}</p>
                      </div>
                      <div>
                        <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Salary</p>
                        <p className="text-slate-800 mt-1">
                          {job.salaryRange ||
                            (job.minSalary || job.maxSalary
                              ? `${job.salaryType ? job.salaryType + ' • ' : ''}${
                                  job.salaryCurrency ? job.salaryCurrency + ' ' : ''
                                }${job.minSalary ?? ''}${job.maxSalary !== undefined ? ` – ${job.maxSalary}` : ''}`
                              : '—')}
                        </p>
                      </div>
                      <div>
                        <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Location</p>
                        <p className="text-slate-800 mt-1">{job.location || '—'}</p>
                      </div>
                    </div>
                  </section>

                  {/* Application Form Summary */}
                  {(job.applicationFormEnabled || (job.applicationFormQuestions && job.applicationFormQuestions.length > 0) || job.applicationFormNote) && (
                    <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                      <div className="p-5 border-b border-slate-100 flex items-center justify-between gap-2">
                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                          <FileText size={14} className="text-slate-400" />
                          Application Form
                        </h4>
                      </div>
                      <div className="px-5 pb-5 pt-4 space-y-3 text-sm">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Enabled</p>
                            <p className="text-slate-800 mt-1">{job.applicationFormEnabled ? 'Yes' : 'No'}</p>
                          </div>
                          <div>
                            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Logo</p>
                            <p className="text-slate-800 mt-1">
                              {job.applicationFormLogo === 'account'
                                ? 'Your Account Logo'
                                : job.applicationFormLogo === 'company'
                                ? 'Job’s Company Logo'
                                : job.applicationFormLogo === 'none'
                                ? 'No logo'
                                : '—'}
                            </p>
                          </div>
                        </div>

                        {job.applicationFormQuestions && job.applicationFormQuestions.length > 0 && (
                          <div>
                            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Questions</p>
                            <ul className="list-disc list-inside text-slate-800 space-y-0.5">
                              {job.applicationFormQuestions.map((q, idx) => (
                                <li key={idx}>{q}</li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {job.applicationFormNote && (
                          <div>
                            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Note for Candidates</p>
                            <p className="text-slate-800 whitespace-pre-wrap">{job.applicationFormNote}</p>
                          </div>
                        )}
                      </div>
                    </section>
                  )}

                  {job.overview ? (
                    <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                      <button
                        type="button"
                        onClick={() => toggleOverviewSection('overview')}
                        className="w-full p-5 flex items-center justify-between gap-2 text-left hover:bg-slate-50/50 transition-colors"
                      >
                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                          <FileText size={14} className="text-slate-400" />
                          Job Overview
                        </h4>
                        {overviewOpen.overview ? (
                          <ChevronDown size={18} className="text-slate-400 shrink-0" />
                        ) : (
                          <ChevronRight size={18} className="text-slate-400 shrink-0" />
                        )}
                      </button>
                      {overviewOpen.overview && (
                        <div className="px-5 pb-5 pt-0 border-t border-slate-100">
                          <p className="text-sm text-slate-700 whitespace-pre-wrap">{job.overview}</p>
                        </div>
                      )}
                    </section>
                  ) : null}

                  {job.keyResponsibilities && job.keyResponsibilities.length > 0 ? (
                    <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                      <button
                        type="button"
                        onClick={() => toggleOverviewSection('keyResponsibilities')}
                        className="w-full p-5 flex items-center justify-between gap-2 text-left hover:bg-slate-50/50 transition-colors"
                      >
                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                          <ListChecks size={14} className="text-slate-400" />
                          Key Responsibilities
                        </h4>
                        {overviewOpen.keyResponsibilities ? (
                          <ChevronDown size={18} className="text-slate-400 shrink-0" />
                        ) : (
                          <ChevronRight size={18} className="text-slate-400 shrink-0" />
                        )}
                      </button>
                      {overviewOpen.keyResponsibilities && (
                        <div className="px-5 pb-5 pt-0 border-t border-slate-100">
                          <ul className="list-disc list-inside text-sm text-slate-700 space-y-1">
                            {job.keyResponsibilities.map((item, i) => (
                              <li key={i}>{item}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </section>
                  ) : null}

                  {job.requiredSkills && job.requiredSkills.length > 0 ? (
                    <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                      <button
                        type="button"
                        onClick={() => toggleOverviewSection('requiredSkills')}
                        className="w-full p-5 flex items-center justify-between gap-2 text-left hover:bg-slate-50/50 transition-colors"
                      >
                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                          <Award size={14} className="text-slate-400" />
                          Required Skills
                        </h4>
                        {overviewOpen.requiredSkills ? (
                          <ChevronDown size={18} className="text-slate-400 shrink-0" />
                        ) : (
                          <ChevronRight size={18} className="text-slate-400 shrink-0" />
                        )}
                      </button>
                      {overviewOpen.requiredSkills && (
                        <div className="px-5 pb-5 pt-0 border-t border-slate-100">
                          <div className="flex flex-wrap gap-2">
                            {job.requiredSkills.map((s, i) => (
                              <span key={i} className="px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 text-xs font-medium">
                                {s}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </section>
                  ) : null}

                  {job.preferredSkills && job.preferredSkills.length > 0 ? (
                    <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                      <button
                        type="button"
                        onClick={() => toggleOverviewSection('preferredSkills')}
                        className="w-full p-5 flex items-center justify-between gap-2 text-left hover:bg-slate-50/50 transition-colors"
                      >
                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                          <Award size={14} className="text-slate-400" />
                          Preferred Skills
                        </h4>
                        {overviewOpen.preferredSkills ? (
                          <ChevronDown size={18} className="text-slate-400 shrink-0" />
                        ) : (
                          <ChevronRight size={18} className="text-slate-400 shrink-0" />
                        )}
                      </button>
                      {overviewOpen.preferredSkills && (
                        <div className="px-5 pb-5 pt-0 border-t border-slate-100">
                          <div className="flex flex-wrap gap-2">
                            {job.preferredSkills.map((s, i) => (
                              <span key={i} className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600 text-xs font-medium">
                                {s}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </section>
                  ) : null}

                  {job.experienceRequired ? (
                    <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                      <button
                        type="button"
                        onClick={() => toggleOverviewSection('experience')}
                        className="w-full p-5 flex items-center justify-between gap-2 text-left hover:bg-slate-50/50 transition-colors"
                      >
                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                          <Briefcase size={14} className="text-slate-400" />
                          Experience Required
                        </h4>
                        {overviewOpen.experience ? (
                          <ChevronDown size={18} className="text-slate-400 shrink-0" />
                        ) : (
                          <ChevronRight size={18} className="text-slate-400 shrink-0" />
                        )}
                      </button>
                      {overviewOpen.experience && (
                        <div className="px-5 pb-5 pt-0 border-t border-slate-100">
                          <p className="text-sm text-slate-700">{job.experienceRequired}</p>
                        </div>
                      )}
                    </section>
                  ) : null}

                  {job.education ? (
                    <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                      <button
                        type="button"
                        onClick={() => toggleOverviewSection('education')}
                        className="w-full p-5 flex items-center justify-between gap-2 text-left hover:bg-slate-50/50 transition-colors"
                      >
                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                          <GraduationCap size={14} className="text-slate-400" />
                          Education
                        </h4>
                        {overviewOpen.education ? (
                          <ChevronDown size={18} className="text-slate-400 shrink-0" />
                        ) : (
                          <ChevronRight size={18} className="text-slate-400 shrink-0" />
                        )}
                      </button>
                      {overviewOpen.education && (
                        <div className="px-5 pb-5 pt-0 border-t border-slate-100">
                          <p className="text-sm text-slate-700">{job.education}</p>
                        </div>
                      )}
                    </section>
                  ) : null}

                  {job.benefits && job.benefits.length > 0 ? (
                    <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                      <button
                        type="button"
                        onClick={() => toggleOverviewSection('benefits')}
                        className="w-full p-5 flex items-center justify-between gap-2 text-left hover:bg-slate-50/50 transition-colors"
                      >
                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                          <Heart size={14} className="text-slate-400" />
                          Benefits
                        </h4>
                        {overviewOpen.benefits ? (
                          <ChevronDown size={18} className="text-slate-400 shrink-0" />
                        ) : (
                          <ChevronRight size={18} className="text-slate-400 shrink-0" />
                        )}
                      </button>
                      {overviewOpen.benefits && (
                        <div className="px-5 pb-5 pt-0 border-t border-slate-100">
                          <ul className="list-disc list-inside text-sm text-slate-700 space-y-1">
                            {job.benefits.map((item, i) => (
                              <li key={i}>{item}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </section>
                  ) : null}

                  {!job.overview && !job.keyResponsibilities?.length && !job.requiredSkills?.length && !job.preferredSkills?.length && !job.experienceRequired && !job.education && !job.benefits?.length && (
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8 text-center">
                      <LayoutGrid size={32} className="mx-auto text-slate-300 mb-3" />
                      <p className="text-sm text-slate-500">No overview content yet. Edit job to add details.</p>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'candidates' && (
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="p-4 border-b border-slate-100">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Job Candidates List</h4>
                    <p className="text-xs text-slate-500 mt-0.5">All candidates applied or sourced for this job</p>
                  </div>
                  {jobCandidates.length === 0 ? (
                    <div className="p-8 text-center">
                      <Users size={32} className="mx-auto text-slate-300 mb-3" />
                      <p className="text-sm text-slate-500">No candidates yet for this job.</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead className="bg-slate-50/80">
                          <tr>
                            <th className="px-4 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Candidate Name</th>
                            <th className="px-4 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Current Stage</th>
                            <th className="px-4 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Score</th>
                            <th className="px-4 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Recruiter</th>
                            <th className="px-4 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Interview Status</th>
                            <th className="px-4 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Last Activity</th>
                            <th className="px-4 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {jobCandidates.map((c) => (
                            <tr key={c.id} className="hover:bg-slate-50/50 transition-colors">
                              <td className="px-4 py-3">
                                <span className="text-sm font-medium text-slate-900">{c.candidateName}</span>
                              </td>
                              <td className="px-4 py-3">
                                <span className="text-xs font-medium text-slate-600">{c.currentStage}</span>
                              </td>
                              <td className="px-4 py-3">
                                <span className="text-xs font-semibold text-slate-700">{typeof c.score === 'number' ? `${c.score}%` : c.score}</span>
                              </td>
                              <td className="px-4 py-3">
                                <span className="text-xs text-slate-600">{c.recruiter}</span>
                              </td>
                              <td className="px-4 py-3">
                                <span className="text-xs text-slate-600">{c.interviewStatus}</span>
                              </td>
                              <td className="px-4 py-3">
                                <span className="text-[11px] text-slate-500">{c.lastActivity}</span>
                              </td>
                              <td className="px-4 py-3 text-right">
                                <div className="relative inline-block">
                                  <button
                                    type="button"
                                    onClick={() => setCandidateMenuOpen(candidateMenuOpen === c.id ? null : c.id)}
                                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                                    aria-label="Actions"
                                  >
                                    <MoreVertical size={16} />
                                  </button>
                                  {candidateMenuOpen === c.id && (
                                    <>
                                      <div className="fixed inset-0 z-10" onClick={() => setCandidateMenuOpen(null)} aria-hidden />
                                      <div className="absolute right-0 top-full mt-1 py-1 w-52 bg-white rounded-xl border border-slate-200 shadow-lg z-20">
                                        <button type="button" onClick={() => { onMoveStage?.(c.id, job.id); setCandidateMenuOpen(null); }} className="w-full px-4 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2">
                                          <ArrowRightLeft size={14} /> Move stage
                                        </button>
                                        <button type="button" onClick={() => { onScheduleInterview?.(c.id, job.id); setCandidateMenuOpen(null); }} className="w-full px-4 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2">
                                          <CalendarPlus size={14} /> Schedule interview
                                        </button>
                                        <button type="button" onClick={() => { onRejectCandidate?.(c.id, job.id); setCandidateMenuOpen(null); }} className="w-full px-4 py-2.5 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2">
                                          <UserX size={14} /> Reject candidate
                                        </button>
                                        <button type="button" onClick={() => { onViewCandidateProfile?.(c.id); setCandidateMenuOpen(null); }} className="w-full px-4 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2">
                                          <Eye size={14} /> View profile
                                        </button>
                                      </div>
                                    </>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
              {activeTab === 'pipeline' && (
                <div className="space-y-4">
                  <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Stage counts</h4>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-center">
                        <p className="text-[10px] font-bold text-slate-400 uppercase">Applied</p>
                        <p className="text-xl font-bold text-slate-900 mt-1">{job.applied}</p>
                      </div>
                      <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-center">
                        <p className="text-[10px] font-bold text-slate-400 uppercase">Interviewed</p>
                        <p className="text-xl font-bold text-slate-900 mt-1">{job.interviewed}</p>
                      </div>
                      <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-center">
                        <p className="text-[10px] font-bold text-slate-400 uppercase">Offered</p>
                        <p className="text-xl font-bold text-slate-900 mt-1">{job.offered}</p>
                      </div>
                      <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-center">
                        <p className="text-[10px] font-bold text-slate-400 uppercase">Joined</p>
                        <p className="text-xl font-bold text-slate-900 mt-1">{job.joined}</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="p-4 border-b border-slate-100">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Pipeline configuration</h4>
                          <p className="text-xs text-slate-500 mt-0.5">Custom hiring pipeline for this job. Drag to reorder, add or remove stages, set SLA timers.</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            onSavePipelineStages?.(pipelineStages);
                            setPipelineDirty(false);
                          }}
                          disabled={!pipelineDirty}
                          className={`shrink-0 px-3 py-2 rounded-lg text-xs font-bold border transition-colors ${
                            pipelineDirty
                              ? 'bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700'
                              : 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                          }`}
                        >
                          Save pipeline
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={handleAddStage}
                        className="mt-3 flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 border border-blue-100 transition-colors"
                      >
                        <Plus size={14} /> Add stage
                      </button>
                    </div>
                    <div className="divide-y divide-slate-100">
                      {pipelineStages.length === 0 ? (
                        <div className="px-4 py-8 text-center text-sm text-slate-500">
                          No stages yet. Click &quot;+ Add stage&quot; to build your pipeline, then &quot;Save pipeline&quot; when done.
                        </div>
                      ) : (
                      pipelineStages.map((stage, index) => (
                        <div
                          key={stage.id}
                          draggable
                          onDragStart={() => setDraggedStageId(stage.id)}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={(e) => {
                            e.preventDefault();
                            if (!draggedStageId || draggedStageId === stage.id) return;
                            const from = pipelineStages.findIndex((s) => s.id === draggedStageId);
                            const to = index;
                            if (from >= 0 && to >= 0) handlePipelineReorder(from, to);
                            setDraggedStageId(null);
                          }}
                          onDragEnd={() => setDraggedStageId(null)}
                          className={`flex items-center gap-3 px-4 py-3 hover:bg-slate-50/50 transition-colors ${draggedStageId === stage.id ? 'opacity-50' : ''}`}
                        >
                          <span className="cursor-grab active:cursor-grabbing text-slate-400 hover:text-slate-600" aria-label="Drag to reorder">
                            <GripVertical size={18} />
                          </span>
                          <span className="text-sm font-medium text-slate-500 w-8 shrink-0">{index + 1}</span>
                          <input
                            type="text"
                            value={stage.name}
                            onChange={(e) => handleStageNameChange(stage.id, e.target.value)}
                            className="flex-1 min-w-0 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                            placeholder="Stage name"
                          />
                          <div className="flex items-center gap-1.5 shrink-0 w-28">
                            <Clock size={14} className="text-slate-400 shrink-0" />
                            <input
                              type="text"
                              value={stage.sla ?? ''}
                              onChange={(e) => handleStageSlaChange(stage.id, e.target.value)}
                              placeholder="e.g. 2 days"
                              className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveStage(stage.id)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors shrink-0"
                            aria-label="Remove stage"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      ))
                      )}
                    </div>
                  </div>
                </div>
              )}
              {activeTab === 'analytics' && (
                <div className="space-y-4">
                  <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="p-4 border-b border-slate-100">
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Job analytics</h4>
                      <p className="text-xs text-slate-500 mt-0.5">A stats dashboard for job performance. Helps recruiters measure hiring effectiveness.</p>
                    </div>
                    <div className="p-5">
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-center">
                          <p className="text-[10px] font-bold text-slate-400 uppercase">Applications received</p>
                          <p className="text-xl font-bold text-slate-900 mt-1">{job.applied}</p>
                        </div>
                        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-center">
                          <p className="text-[10px] font-bold text-slate-400 uppercase">Candidates screened</p>
                          <p className="text-xl font-bold text-slate-900 mt-1">{job.interviewed}</p>
                        </div>
                        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-center">
                          <p className="text-[10px] font-bold text-slate-400 uppercase">Interviews scheduled</p>
                          <p className="text-xl font-bold text-slate-900 mt-1">{job.interviewed}</p>
                        </div>
                        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-center">
                          <p className="text-[10px] font-bold text-slate-400 uppercase">Offers made</p>
                          <p className="text-xl font-bold text-slate-900 mt-1">{job.offered}</p>
                        </div>
                        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-center flex flex-col items-center justify-center">
                          <p className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1">
                            <Timer size={10} /> Time-to-fill
                          </p>
                          <p className="text-xl font-bold text-slate-900 mt-1">18 days</p>
                        </div>
                        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-center flex flex-col items-center justify-center">
                          <p className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1">
                            <TrendingUp size={10} /> Source performance
                          </p>
                          <p className="text-xl font-bold text-slate-900 mt-1">—</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              {activeTab === 'assignment' && (
                <div className="space-y-4">
                  <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="p-4 border-b border-slate-100">
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Job assignment</h4>
                      <p className="text-xs text-slate-500 mt-0.5">Assign recruiters responsible for this job. Define ownership and accountability.</p>
                    </div>
                    <div className="p-5 space-y-4">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Lead recruiter</label>
                        <div className="rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-2.5 text-sm text-slate-900">
                          {job.recruiter ?? job.owner ?? '—'}
                        </div>
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Supporting recruiters</label>
                        <div className="rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-2.5 text-sm text-slate-700">
                          Sarah Chen, Michael Ross
                        </div>
                        <p className="text-[11px] text-slate-400 mt-1">Additional recruiters helping with this job</p>
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Hiring manager</label>
                        <div className="rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-2.5 text-sm text-slate-900">
                          {job.hiringManager ?? '—'}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              {activeTab === 'interviews' && (
                <div className="space-y-4">
                  <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="p-4 border-b border-slate-100">
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Interviews</h4>
                      <p className="text-xs text-slate-500 mt-0.5">Scheduled and completed interviews for this job</p>
                    </div>
                    <div className="divide-y divide-slate-100">
                      {[
                        { id: '1', candidateName: 'Priya Sharma', date: '2026-03-12', time: '10:00 AM', type: 'Technical', stage: 'Screening', status: 'Scheduled' },
                        { id: '2', candidateName: 'Rahul Verma', date: '2026-03-11', time: '2:00 PM', type: 'HR', stage: 'HR Interview', status: 'Completed' },
                        { id: '3', candidateName: 'Anita Desai', date: '2026-03-15', time: '11:00 AM', type: 'Technical', stage: 'Technical Interview', status: 'Scheduled' },
                      ].map((i) => (
                        <div key={i.id} className="px-4 py-3 flex flex-wrap items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                            <Calendar size={16} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-slate-900">{i.candidateName}</p>
                            <p className="text-[11px] text-slate-500">{i.date} · {i.time} · {i.type}</p>
                          </div>
                          <span className="text-[11px] font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded">{i.stage}</span>
                          <span className={`text-[11px] font-medium px-2 py-0.5 rounded ${i.status === 'Scheduled' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>{i.status}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
              {activeTab === 'placements' && (
                <div className="space-y-4">
                  <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="p-4 border-b border-slate-100">
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Placements</h4>
                      <p className="text-xs text-slate-500 mt-0.5">Successful hires for this job</p>
                    </div>
                    {job.joined === 0 ? (
                      <div className="p-8 text-center">
                        <UserCheck size={32} className="mx-auto text-slate-300 mb-3" />
                        <p className="text-sm text-slate-500">No placements yet for this job.</p>
                      </div>
                    ) : (
                      <div className="divide-y divide-slate-100">
                        {[
                          { id: '1', candidateName: 'Rahul Verma', joinedDate: '2026-02-20', role: job.title },
                          { id: '2', candidateName: 'Neha Patel', joinedDate: '2026-02-28', role: job.title },
                        ].slice(0, Math.max(1, job.joined)).map((p) => (
                          <div key={p.id} className="px-4 py-3 flex flex-wrap items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                              <UserCheck size={16} />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium text-slate-900">{p.candidateName}</p>
                              <p className="text-[11px] text-slate-500">{p.joinedDate} · {p.role}</p>
                            </div>
                            <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-emerald-100 text-emerald-700">Joined</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
              {activeTab === 'activity' && (() => {
                const ACTIVITY_TIMELINE_FILTERS: Array<'All' | 'Jobs' | 'Candidates' | 'Interviews' | 'Notes' | 'Files'> = ['All', 'Jobs', 'Candidates', 'Interviews', 'Notes', 'Files'];
                
                const activities = jobActivities.filter(
                  (a) => activityFilter === 'All' || a.action.toLowerCase().includes(activityFilter.toLowerCase())
                );
                
                // Sort activities by timestamp (newest first)
                const sortedActivities = [...activities].sort((a, b) => {
                  const dateA = new Date(a.createdAt).getTime();
                  const dateB = new Date(b.createdAt).getTime();
                  return dateB - dateA;
                });
                
                const CategoryIcon = ({ category }: { category: string }) => {
                  const catLower = category.toLowerCase();
                  if (catLower.includes('job')) return <Briefcase size={16} className="text-blue-600" />;
                  if (catLower.includes('candidate')) return <User size={16} className="text-emerald-600" />;
                  if (catLower.includes('interview')) return <Calendar size={16} className="text-amber-600" />;
                  if (catLower.includes('note')) return <StickyNote size={16} className="text-slate-600" />;
                  if (catLower.includes('file')) return <Paperclip size={16} className="text-slate-600" />;
                  return <Activity size={16} className="text-slate-500" />;
                };
                
                return (
                  <div className="space-y-4">
                    {/* Timeline filters */}
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        {ACTIVITY_TIMELINE_FILTERS.map((f) => (
                          <button
                            key={f}
                            type="button"
                            onClick={() => setActivityFilter(f)}
                            className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${activityFilter === f ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                          >
                            {f}
                          </button>
                        ))}
                      </div>
                    </div>
                    {/* Vertical timeline */}
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                      <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Activity timeline</h4>
                        <p className="text-xs text-slate-500">{sortedActivities.length} events</p>
                      </div>
                      <div className="p-4 max-h-[420px] overflow-y-auto">
                        {loadingActivities ? (
                          <div className="py-8 text-center">
                            <p className="text-sm text-slate-500">Loading activities...</p>
                          </div>
                        ) : sortedActivities.length === 0 ? (
                          <div className="py-8 text-center">
                            <Activity size={24} className="mx-auto text-slate-300 mb-2" />
                            <p className="text-sm text-slate-500">No activity for this filter.</p>
                          </div>
                        ) : (
                          <div className="relative border-l-2 border-slate-200 pl-6 space-y-0">
                            {sortedActivities.map((item: BackendActivity, idx: number) => {
                              const prevItem = idx > 0 ? sortedActivities[idx - 1] : null;
                              const currentDate = new Date(item.createdAt).toDateString();
                              const prevDate = prevItem ? new Date(prevItem.createdAt).toDateString() : '';
                              const showDateSeparator = idx === 0 || currentDate !== prevDate;
                              
                              const date = new Date(item.createdAt);
                              const now = new Date();
                              const isToday = date.toDateString() === now.toDateString();
                              const isYesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000).toDateString() === date.toDateString();
                              
                              let dateLabel = '';
                              if (isToday) dateLabel = 'Today';
                              else if (isYesterday) dateLabel = 'Yesterday';
                              else {
                                dateLabel = date.toLocaleDateString('en-US', { 
                                  weekday: 'long',
                                  month: 'long', 
                                  day: 'numeric',
                                  year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
                                });
                              }
                              
                              const timeLabel = date.toLocaleTimeString('en-US', { 
                                hour: 'numeric', 
                                minute: '2-digit',
                                hour12: true 
                              });
                              
                              return (
                                <div key={item.id}>
                                  {showDateSeparator && idx > 0 && (
                                    <div className="my-4 border-t border-slate-200"></div>
                                  )}
                                  {showDateSeparator && (
                                    <div className="mb-3 -ml-6">
                                      <span className="inline-block px-3 py-1 bg-slate-100 text-slate-600 text-xs font-semibold rounded-full">
                                        {dateLabel}
                                      </span>
                                    </div>
                                  )}
                                  <div className="relative pb-6 last:pb-0">
                                    {/* Timeline dot + icon */}
                                    <div className="absolute -left-[1.625rem] top-0 w-8 h-8 rounded-full border-2 border-white shadow-sm flex items-center justify-center bg-slate-100">
                                      <CategoryIcon category={item.action} />
                                    </div>
                                    {/* Event card */}
                                    <div className="bg-slate-50/80 rounded-xl border border-slate-200 p-3 hover:border-slate-300 transition-colors">
                                      <p className="text-sm font-semibold text-slate-900">{item.action}</p>
                                      {item.description && <p className="text-xs text-slate-600 mt-1">{item.description}</p>}
                                      <div className="flex items-center justify-between gap-2 mt-2 flex-wrap">
                                        <div className="flex items-center gap-2 min-w-0">
                                          {item.user?.avatar ? (
                                            <ImageWithFallback src={item.user.avatar} alt={item.user.name} className="w-6 h-6 rounded-full border border-slate-200 shrink-0" />
                                          ) : (
                                            <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center shrink-0"><User size={12} className="text-slate-500" /></div>
                                          )}
                                          <span className="text-xs font-medium text-slate-700 truncate">{item.user?.name || 'System'}</span>
                                        </div>
                                        <span className="text-[11px] text-slate-500 shrink-0">{timeLabel}</span>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })()}
              {activeTab === 'notes' ? (
                job?.id ? (
                  <NotesService
                    entityType="job"
                    entityId={job.id}
                    availableTags={['JD', 'Requirements', 'Feedback', 'Hiring', 'Other']}
                    onNoteCreated={() => {
                      // Optionally refresh job data or show notification
                    }}
                    onNoteUpdated={() => {
                      // Optionally refresh job data or show notification
                    }}
                    onNoteDeleted={() => {
                      // Optionally refresh job data or show notification
                    }}
                  />
                ) : (
                  <div className="py-8 text-center text-sm text-slate-500">
                    No job selected
                  </div>
                )
              ) : null}
              {activeTab === 'files' && (() => {
                const JOB_FILE_TYPE_OPTIONS: (JobFileType | 'All')[] = ['All', 'JD', 'Contract', 'Offer Letter', 'Policy', 'Resume', 'Other'];
                const allFiles = jobFiles;
                const filteredFiles = filesTypeFilter === 'All' ? allFiles : allFiles.filter((f) => f.fileType === filesTypeFilter);
                const uploadsBase = (typeof window !== 'undefined' ? (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1') : 'http://localhost:5000/api/v1').replace(/\/api\/v1\/?$/, '');
                const toFileHref = (fileUrl?: string | null) => {
                  if (!fileUrl) return '#';
                  return /^https?:\/\//i.test(fileUrl) ? fileUrl : `${uploadsBase}${fileUrl}`;
                };
                const FileTypeIcon = ({ type }: { type: string }) => {
                  switch (type) {
                    case 'JD': return <Briefcase size={14} className="text-indigo-600 shrink-0" />;
                    case 'Contract': return <FileText size={14} className="text-blue-600 shrink-0" />;
                    case 'Offer Letter': return <FileCheck size={14} className="text-emerald-600 shrink-0" />;
                    case 'Policy': return <FileText size={14} className="text-amber-600 shrink-0" />;
                    case 'Resume': return <FileText size={14} className="text-slate-600 shrink-0" />;
                    case 'Other': return <Paperclip size={14} className="text-slate-500 shrink-0" />;
                    default: return <Paperclip size={14} className="text-slate-500 shrink-0" />;
                  }
                };
                const formatUploadDate = (d: string) => {
                  if (!d) return '—';
                  try {
                    const date = new Date(d);
                    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
                  } catch {
                    return d;
                  }
                };
                return (
                  <div className="space-y-4">
                    <input
                      type="file"
                      ref={fileInputRef}
                      className="hidden"
                      onChange={async (e) => {
                        const f = e.target.files?.[0];
                        if (f) {
                          try {
                            await uploadFile(f, 'JD');
                            e.target.value = '';
                          } catch (_) {}
                        }
                      }}
                    />
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <button
                          type="button"
                          disabled={!job?.id || filesUploading}
                          onClick={() => fileInputRef.current?.click()}
                          className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <Upload size={16} /> {filesUploading ? 'Uploading…' : 'Upload File'}
                        </button>
                        <div className="flex flex-wrap items-center gap-2">
                          {JOB_FILE_TYPE_OPTIONS.map((type) => (
                            <button
                              key={type}
                              type="button"
                              onClick={() => setFilesTypeFilter(type)}
                              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors shrink-0 ${filesTypeFilter === type ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                            >
                              {type}
                            </button>
                          ))}
                        </div>
                      </div>
                      {filesError && <p className="mt-2 text-sm text-red-600">{filesError}</p>}
                    </div>
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                      <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Files</h4>
                        <p className="text-xs text-slate-500">{filesLoading ? 'Loading…' : `${filteredFiles.length} files`}</p>
                      </div>
                      <div className="overflow-x-auto custom-scrollbar">
                        <table className="w-full text-left border-collapse min-w-[640px]">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-200">
                              <th className="px-4 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">File name</th>
                              <th className="px-4 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Type</th>
                              <th className="px-4 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Uploaded by</th>
                              <th className="px-4 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Upload date</th>
                              <th className="px-4 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider text-right w-32">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {filesLoading ? (
                              <tr>
                                <td colSpan={5} className="px-4 py-12 text-center text-sm text-slate-500">Loading files…</td>
                              </tr>
                            ) : filteredFiles.length === 0 ? (
                              <tr>
                                <td colSpan={5} className="px-4 py-12 text-center text-sm text-slate-500">No files for this type.</td>
                              </tr>
                            ) : (
                              filteredFiles.map((file) => (
                                <tr key={file.id} className="hover:bg-slate-50/80 transition-colors">
                                  <td className="px-4 py-3">
                                    <p className="text-sm font-medium text-slate-900 truncate max-w-[200px]">{file.fileName}</p>
                                  </td>
                                  <td className="px-4 py-3">
                                    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold border ${JOB_FILE_TYPE_BADGE_STYLES[file.fileType as JobFileType] ?? 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                                      <FileTypeIcon type={file.fileType} />
                                      {file.fileType}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3">
                                    <div className="flex items-center gap-2 min-w-0">
                                      {file.uploadedBy?.avatar ? (
                                        <ImageWithFallback src={file.uploadedBy.avatar} alt={file.uploadedBy.name} className="w-6 h-6 rounded-full border border-slate-200 shrink-0" />
                                      ) : (
                                        <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center shrink-0"><User size={12} className="text-slate-500" /></div>
                                      )}
                                      <span className="text-sm text-slate-600 truncate">{file.uploadedBy?.name ?? '—'}</span>
                                    </div>
                                  </td>
                                  <td className="px-4 py-3 text-sm text-slate-600">{formatUploadDate(file.uploadDate)}</td>
                                  <td className="px-4 py-3">
                                    <div className="flex items-center justify-end gap-1">
                                      {file.fileUrl && (
                                        <a href={toFileHref(file.fileUrl)} target="_blank" rel="noopener noreferrer" className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Download"><Download size={14} /></a>
                                      )}
                                      {file.fileUrl && (
                                        <a href={toFileHref(file.fileUrl)} target="_blank" rel="noopener noreferrer" className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors" title="Preview"><Eye size={14} /></a>
                                      )}
                                      <button type="button" onClick={() => deleteFile(file.id)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Delete"><Trash2 size={14} /></button>
                                    </div>
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Footer */}
            <div className="shrink-0 border-t border-slate-200 bg-white p-4 flex flex-wrap items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => onEdit?.(job)}
                className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50"
              >
                <Pencil size={14} /> Edit Job
              </button>
              {job.status === 'Draft' && (
                <button
                  type="button"
                  onClick={() => onPublish?.(job)}
                  className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-xl hover:bg-blue-700"
                >
                  <Send size={14} /> Publish Job
                </button>
              )}
              <button
                type="button"
                onClick={() => onClone?.(job)}
                className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50"
              >
                <Copy size={14} /> Clone Job
              </button>
              <button
                type="button"
                onClick={() => onCloseJob?.(job)}
                className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-red-700 bg-red-50 border border-red-200 rounded-xl hover:bg-red-100"
              >
                <Archive size={14} /> Close Job
              </button>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center p-8 text-slate-500 text-sm">
            Select a job to view details.
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
