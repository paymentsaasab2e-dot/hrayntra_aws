'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  CandidateTable,
  type Candidate as JobDrawerTableCandidate,
} from '../../app/candidate/components/CandidateTable';
import { buildFileHref } from '../../utils/cloudinaryUrls';
import { motion, AnimatePresence } from 'motion/react';
import { requestError, requestInfo } from '../../lib/appDialog';
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
} from 'lucide-react';
import { apiCreateMatch, apiGetMatches, apiToggleSavedMatch } from '../../lib/api';
import {
  loadJobAppliedCandidates,
  parseJobCandidateScore,
  unwrapMatchRows,
} from '../../lib/jobAppliedMatches';
import { mapBackendMatch } from '../../lib/mapBackendMatch';
import MatchCandidateTable from '../matches/MatchCandidateTable';
import {
  AI_SCORE_TIERS,
  computeAiTierStats,
  displayMatchBand,
  type MatchCandidate,
} from '../matches/types';
import { useSubmitToClientModal } from '../../hooks/useSubmitToClientModal';
import { ImageWithFallback } from '../ImageWithFallback';
import { NotesService } from '../NotesService';
import { StatusChangeService } from '../StatusChangeService';
import {
  apiGetJobActivities,
  apiUpdateJob,
  apiResetJobPipelineToOrgTemplate,
  type BackendActivity,
  getCachedOrgRecruitmentMode,
  ORG_RECRUITMENT_CACHE_EVENT,
} from '../../lib/api';
import { useFiles } from '../../hooks/useFiles';
import { formatDateDMY, formatDateTimeDMY, formatTime12hEnGb } from '../../utils/dateDisplay';

/** Render salary as `currency min - max` (or single number when only one bound). */
function formatJobSalaryRange(job: {
  salaryRange?: string;
  salaryCurrency?: string;
  minSalary?: number;
  maxSalary?: number;
}): string {
  const currency = job.salaryCurrency ? `${job.salaryCurrency} ` : '';
  const hasMin = job.minSalary !== undefined && job.minSalary !== null;
  const hasMax = job.maxSalary !== undefined && job.maxSalary !== null;
  if (hasMin && hasMax) return `${currency}${job.minSalary} - ${job.maxSalary}`;
  if (hasMin) return `${currency}${job.minSalary}`;
  if (hasMax) return `${currency}${job.maxSalary}`;
  return job.salaryRange || '';
}

export type JobDrawerStatus = 'Draft' | 'Active' | 'On Hold' | 'Closed';

export interface JobForDrawer {
  id: string;
  title: string;
  client: string;
  /** CRM client id — required for scheduling interviews from the job drawer */
  clientId?: string;
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
  applications?: JobApplicationSubmission[];
  overview?: string;
  keyResponsibilities?: string[];
  requiredSkills?: string[];
  preferredSkills?: string[];
  experienceRequired?: string;
  education?: string;
  benefits?: string[];
}

export interface JobApplicationSubmission {
  id: string;
  candidateId: string;
  status?: string;
  appliedAt?: string;
  screeningAnswers?: Record<string, unknown> | null;
  candidate?: {
    id?: string;
    firstName?: string | null;
    lastName?: string | null;
    email?: string | null;
  } | null;
}

/** Pipeline stage for Job Pipeline Configuration */
export interface JobPipelineStage {
  id: string;
  name: string;
  sla?: string;
  /** Backend lifecycle bucket (APPLIED, INTERVIEW, …) for standalone tenant pipeline sync */
  systemRole?: string | null;
}

const DEFAULT_PIPELINE_STAGE_NAMES = ['Apply', 'Interview', 'Reject', 'Placed'] as const;
const DEFAULT_PIPELINE_STAGE_IDS: Record<(typeof DEFAULT_PIPELINE_STAGE_NAMES)[number], string> = {
  Apply: 'default-apply-stage',
  Interview: 'default-interview-stage',
  Reject: 'default-reject-stage',
  Placed: 'default-placed-stage',
};
const DEFAULT_PIPELINE_STAGE_ID_SET = new Set(Object.values(DEFAULT_PIPELINE_STAGE_IDS));

const PIPELINE_SYSTEM_ROLE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: '', label: 'Auto / unset' },
  { value: 'APPLIED', label: 'Applied' },
  { value: 'SCREENING', label: 'Screening' },
  { value: 'INTERVIEW', label: 'Interview' },
  { value: 'OFFER', label: 'Offer' },
  { value: 'HIRED', label: 'Hired' },
  { value: 'REJECTED', label: 'Rejected' },
];

const getDefaultPipelineStageNameById = (id: string): (typeof DEFAULT_PIPELINE_STAGE_NAMES)[number] | null => {
  const found = DEFAULT_PIPELINE_STAGE_NAMES.find((defaultName) => DEFAULT_PIPELINE_STAGE_IDS[defaultName] === id);
  return found ?? null;
};

const getDefaultPipelineStageName = (name: string): (typeof DEFAULT_PIPELINE_STAGE_NAMES)[number] | null => {
  const trimmed = String(name || '').trim().toLowerCase();
  const found = DEFAULT_PIPELINE_STAGE_NAMES.find((defaultName) => defaultName.toLowerCase() === trimmed);
  return found ?? null;
};

const normalizeStageLabel = (value: string) =>
  String(value || '')
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const canonicalStageLabel = (value: string) => {
  const normalized = normalizeStageLabel(value);
  const tokenAliases: Record<string, string> = {
    applied: 'apply',
    application: 'apply',
    interviewed: 'interview',
    interviewing: 'interview',
    rejected: 'reject',
    offered: 'offer',
  };
  const direct = tokenAliases[normalized];
  if (direct) return direct;
  return normalized;
};

function normalizePipelineStages(stages?: JobPipelineStage[] | null): JobPipelineStage[] {
  const input = Array.isArray(stages) ? stages : [];
  const normalizedInput = input
    .map((stage) => ({
      id: String(stage?.id || `s-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`),
      name: String(stage?.name || '').trim(),
      sla: stage?.sla || '',
      systemRole:
        stage?.systemRole != null && String(stage.systemRole).trim() !== ''
          ? String(stage.systemRole).trim()
          : undefined,
    }))
    .filter((stage) => stage.name.length > 0);

  if (normalizedInput.length === 0) {
    // Last-resort fallback for jobs that have no configured pipeline yet.
    // For agency the org has no template, so we keep the historical four-stage UX.
    return DEFAULT_PIPELINE_STAGE_NAMES.map((defaultName) => ({
      id: DEFAULT_PIPELINE_STAGE_IDS[defaultName],
      name: defaultName,
      sla: '',
      systemRole: undefined,
    }));
  }

  const deduped = (() => {
    const hasAppliedLike = normalizedInput.some(
      (s) =>
        String(s.systemRole || '').toUpperCase() === 'APPLIED' ||
        /^applied$/i.test(String(s.name || '').trim())
    );
    if (!hasAppliedLike) return normalizedInput;
    return normalizedInput.filter((s) => String(s.name || '').trim().toLowerCase() !== 'apply');
  })();

  // Respect whatever the backend returned. Previously this function appended any of the four
  // legacy defaults (Apply/Interview/Reject/Placed) that weren't already present, which caused
  // standalone tenants — whose org template uses Applied/Screening/Interviewing/Offer/Hired/Rejected —
  // to see an extra "Apply" / "Interview" / "Reject" / "Placed" tail glued onto every job's pipeline.
  return deduped;
}

/** Candidate row for Job Candidates list (Candidates tab) */
export interface JobCandidateItem {
  id: string;
  candidateName: string;
  email?: string;
  avatar?: string | null;
  designation?: string;
  company?: string;
  experience?: number;
  location?: string;
  phone?: string;
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
  onViewCandidateProfile?: (candidate: JobDrawerTableCandidate) => void;
  onEditCandidate?: (candidate: JobDrawerTableCandidate) => void;
  /** Sync scored candidates back to the job page after Run AI Applied Matches */
  onJobCandidatesChange?: (candidates: JobCandidateItem[]) => void;
}

const TAB_CONFIG = [
  { id: 'overview' as const, label: 'Overview', icon: LayoutGrid },
  { id: 'candidates' as const, label: 'Candidates', icon: Users },
  { id: 'ai-matches' as const, label: 'AI Matches', icon: Sparkles },
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

function mapJobCandidateToTableRow(
  candidate: JobCandidateItem,
  jobTitle?: string | null,
  jobId?: string | null,
): JobDrawerTableCandidate {
  const matchScore = parseJobCandidateScore(candidate.score);
  return {
    id: candidate.id,
    name: candidate.candidateName,
    avatar: candidate.avatar ?? null,
    designation: candidate.designation || '—',
    company: candidate.company || '—',
    experience: candidate.experience ?? 0,
    location: candidate.location || '—',
    assignedJobs: jobTitle ? [jobTitle] : [],
    stage: candidate.currentStage || 'New',
    owner: candidate.recruiter || 'Unassigned',
    lastActivity: candidate.lastActivity || '—',
    hotlist: false,
    phone: candidate.phone || '',
    email: candidate.email || '',
    skills: [],
    noticePeriod: '',
    salary: { current: '', expected: '' },
    source: '',
    rating: 0,
    pipelineJobId: jobId || undefined,
    matchScore: matchScore > 0 ? matchScore : undefined,
    matchScoreBand: matchScore > 0 ? displayMatchBand(matchScore) : undefined,
  };
}

function matchCandidateToJobTableRow(
  match: MatchCandidate,
  jobTitle?: string | null,
  jobId?: string | null,
): JobDrawerTableCandidate {
  return {
    id: match.id,
    name: match.name,
    avatar: match.photo || null,
    designation: match.currentTitle || '—',
    company: match.currentCompany || '—',
    experience: match.experience ?? 0,
    location: match.location || '—',
    assignedJobs: jobTitle ? [jobTitle] : [],
    stage: match.status || 'New',
    owner: '—',
    lastActivity: '—',
    hotlist: false,
    phone: match.phone || '',
    email: match.email || '',
    skills: match.skills || [],
    noticePeriod: match.noticePeriod || '',
    salary: {
      current: '',
      expected: match.salary?.amount ? String(match.salary.amount) : '',
    },
    source: match.matchSource || '',
    rating: match.matchRating ?? 0,
    pipelineJobId: jobId || undefined,
    matchScore: match.score,
    matchId: match.matchId,
    matchScoreBand: match.score > 0 ? displayMatchBand(match.score) : undefined,
  };
}

const STATUS_STYLES: Record<JobDrawerStatus, string> = {
  Draft: 'bg-slate-100 text-slate-700 border-slate-200',
  Active: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  'On Hold': 'bg-amber-100 text-amber-700 border-amber-200',
  Closed: 'bg-gray-100 text-gray-600 border-gray-200',
};

interface JobDrawerAiMatchesTabProps {
  job: JobForDrawer;
  aiMatchCandidates: MatchCandidate[];
  sortedAiMatchCandidates: MatchCandidate[];
  aiTierStats: ReturnType<typeof computeAiTierStats>;
  aiMatchesLoading: boolean;
  aiPipelineRunning: boolean;
  aiMatchesError: string | null;
  aiMatchSelectedIds: string[];
  aiSavedMatches: string[];
  aiExpandedAnalysis: string | null;
  onRunAiMatches: () => void | Promise<void>;
  onToggleSelect: (candidateId: string) => void;
  onToggleSelectAll: () => void;
  onToggleSave: (candidateId: string) => void;
  onToggleAnalysis: (candidateId: string) => void;
  onViewProfile: (candidateId: string) => void;
  onOpenSubmit: (candidateId: string) => void;
}

function JobDrawerAiMatchesTab({
  job,
  aiMatchCandidates,
  sortedAiMatchCandidates,
  aiTierStats,
  aiMatchesLoading,
  aiPipelineRunning,
  aiMatchesError,
  aiMatchSelectedIds,
  aiSavedMatches,
  aiExpandedAnalysis,
  onRunAiMatches,
  onToggleSelect,
  onToggleSelectAll,
  onToggleSave,
  onToggleAnalysis,
  onViewProfile,
  onOpenSubmit,
}: JobDrawerAiMatchesTabProps) {
  return (
    <div className="overflow-hidden rounded-xl border border-indigo-100/60 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-indigo-100/40 bg-gradient-to-br from-white via-indigo-50/25 to-violet-50/20 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-950/80">AI Matches</h4>
          <p className="mt-0.5 text-xs text-slate-500">
            4-pass AI pipeline for <span className="font-semibold text-slate-700">{job.title}</span>
          </p>
          {aiMatchCandidates.length > 0 ? (
            <p className="mt-1 text-[11px] font-medium text-indigo-700/80">
              {AI_SCORE_TIERS.map((t) => `${t.label}: ${aiTierStats[t.id]}`).join(' · ')}
            </p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => void onRunAiMatches()}
          disabled={!job?.id || aiMatchesLoading || aiPipelineRunning}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 via-indigo-600 to-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 transition hover:from-violet-700 hover:via-indigo-700 hover:to-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          title="Run the 4-pass AI matching pipeline for this job"
        >
          <Sparkles size={16} className={aiPipelineRunning ? 'animate-spin' : ''} strokeWidth={2.25} />
          {aiPipelineRunning ? 'Running AI matches…' : 'Run AI Matches'}
        </button>
      </div>

      {aiMatchesError ? (
        <div className="mx-4 my-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {aiMatchesError}
        </div>
      ) : null}

      {aiMatchesLoading || aiPipelineRunning ? (
        <div className="flex items-center justify-center gap-2 px-4 py-12 text-sm text-slate-500">
          <Loader2 className="size-5 animate-spin text-indigo-600" />
          {aiPipelineRunning ? 'Running AI matching pipeline…' : 'Loading matches…'}
        </div>
      ) : sortedAiMatchCandidates.length === 0 ? (
        <div className="px-4 py-12 text-center">
          <Sparkles size={32} className="mx-auto mb-3 text-indigo-200" />
          <p className="text-sm text-slate-500">
            Open this tab to run AI matching, or click Run AI Matches to refresh scores.
          </p>
        </div>
      ) : (
        <div className="no-scrollbar overflow-x-auto px-2 pb-3 pt-1 sm:px-3">
          <MatchCandidateTable
            candidates={sortedAiMatchCandidates}
            activeView="internal"
            selectedCandidates={aiMatchSelectedIds}
            savedMatches={aiSavedMatches}
            expandedAnalysis={aiExpandedAnalysis}
            showMatchScore
            onToggleSelect={onToggleSelect}
            onToggleSelectAll={onToggleSelectAll}
            onToggleSave={onToggleSave}
            onToggleAnalysis={onToggleAnalysis}
            onViewProfile={onViewProfile}
            onOpenPipeline={() => {
              void requestInfo('Use the Pipeline tab or Matches page to add candidates to the pipeline.');
            }}
            onOpenSubmit={onOpenSubmit}
            onOpenReject={() => {
              void requestInfo('Use the Matches page to reject AI match rows.');
            }}
            onRateMatch={() => undefined}
          />
        </div>
      )}
    </div>
  );
}

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
  onEditCandidate,
  onJobCandidatesChange,
}: JobDetailsDrawerProps) {
  const [pipelineStages, setPipelineStages] = useState<JobPipelineStage[]>(normalizePipelineStages(initialPipelineStages));
  const [draggedStageId, setDraggedStageId] = useState<string | null>(null);
  const [pipelineDirty, setPipelineDirty] = useState(false);
  const [pipelineValidationError, setPipelineValidationError] = useState('');
  const [orgRecruitmentMode, setOrgRecruitmentMode] = useState<'agency' | 'standalone'>(() =>
    typeof window !== 'undefined' ? getCachedOrgRecruitmentMode() : 'agency'
  );
  const [standaloneCustomizePipeline, setStandaloneCustomizePipeline] = useState(false);
  const isOwnPipelineEditRef = useRef(false);

  useEffect(() => {
    const on = () => setOrgRecruitmentMode(getCachedOrgRecruitmentMode());
    window.addEventListener(ORG_RECRUITMENT_CACHE_EVENT, on);
    return () => window.removeEventListener(ORG_RECRUITMENT_CACHE_EVENT, on);
  }, []);

  useEffect(() => {
    setStandaloneCustomizePipeline(false);
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

  const pipelineConfigLocked = orgRecruitmentMode === 'standalone' && !standaloneCustomizePipeline;

  const [activeTab, setActiveTab] = useState<(typeof TAB_CONFIG)[number]['id']>('overview');
  const [selectedCandidateIds, setSelectedCandidateIds] = useState<string[]>([]);
  const [displayJobCandidates, setDisplayJobCandidates] = useState<JobCandidateItem[]>(jobCandidates);
  const [appliedPipelineRunning, setAppliedPipelineRunning] = useState(false);
  const [appliedCandidatesLoading, setAppliedCandidatesLoading] = useState(false);
  const prevCandidatesTabJobIdRef = useRef<string | null>(null);
  const wasOnCandidatesTabRef = useRef(false);
  const [showMatchScores, setShowMatchScores] = useState(false);
  const [submitClientRowId, setSubmitClientRowId] = useState<string | null>(null);
  const {
    openFromJobDrawerRow,
    openSubmit,
    submitModalElement: submitToClientModal,
  } = useSubmitToClientModal({
    onClosed: () => setSubmitClientRowId(null),
  });

  const [aiMatchCandidates, setAiMatchCandidates] = useState<MatchCandidate[]>([]);
  const [aiMatchesLoading, setAiMatchesLoading] = useState(false);
  const [aiPipelineRunning, setAiPipelineRunning] = useState(false);
  const [aiMatchesError, setAiMatchesError] = useState<string | null>(null);
  const [aiMatchSelectedIds, setAiMatchSelectedIds] = useState<string[]>([]);
  const [aiSavedMatches, setAiSavedMatches] = useState<string[]>([]);
  const [aiExpandedAnalysis, setAiExpandedAnalysis] = useState<string | null>(null);
  const prevAiTabJobIdRef = useRef<string | null>(null);
  const prevOnAiTabRef = useRef(false);

  useEffect(() => {
    setSubmitClientRowId(null);
  }, [job?.id, isOpen]);

  useEffect(() => {
    setDisplayJobCandidates(jobCandidates);
    const hasScores = jobCandidates.some((row) => parseJobCandidateScore(row.score) > 0);
    setShowMatchScores(hasScores);
  }, [jobCandidates, job?.id]);

  const jobTableCandidates = useMemo(
    () => displayJobCandidates.map((row) => mapJobCandidateToTableRow(row, job?.title, job?.id)),
    [displayJobCandidates, job?.id, job?.title],
  );

  const recruiterFallbackForJob = useMemo(
    () => (job as { assignedTo?: { name?: string }; recruiter?: string })?.assignedTo?.name || job?.recruiter || 'Unassigned',
    [job],
  );

  const refreshAppliedJobCandidates = useCallback(
    async (opts?: { runPipeline?: boolean; refresh?: boolean }) => {
      if (!job?.id) {
        setDisplayJobCandidates([]);
        return [] as JobCandidateItem[];
      }
      const loadingPipeline = Boolean(opts?.runPipeline);
      if (loadingPipeline) {
        setAppliedPipelineRunning(true);
      } else {
        setAppliedCandidatesLoading(true);
      }
      try {
        const merged = await loadJobAppliedCandidates(job.id, {
          runPipeline: opts?.runPipeline,
          refresh: opts?.refresh,
          pipelineSeed: jobCandidates,
          fallbackRecruiter: recruiterFallbackForJob,
        });
        setDisplayJobCandidates(merged);
        setShowMatchScores(merged.some((row) => parseJobCandidateScore(row.score) > 0));
        onJobCandidatesChange?.(merged);
        return merged;
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : 'Unable to load applied candidates for this job';
        void requestError(message);
        return [] as JobCandidateItem[];
      } finally {
        if (loadingPipeline) {
          setAppliedPipelineRunning(false);
        } else {
          setAppliedCandidatesLoading(false);
        }
      }
    },
    [job?.id, jobCandidates, onJobCandidatesChange, recruiterFallbackForJob],
  );

  const handleRunAppliedMatches = useCallback(async () => {
    if (!job?.id) return;
    try {
      const merged = await refreshAppliedJobCandidates({ runPipeline: true, refresh: true });
      const scored = merged.filter((row) => parseJobCandidateScore(row.score) > 0);
      const top = [...scored].sort(
        (a, b) => parseJobCandidateScore(b.score) - parseJobCandidateScore(a.score),
      )[0];
      if (top && parseJobCandidateScore(top.score) > 0) {
        void requestInfo(
          `Applied matching complete — ${merged.length} candidate(s). Top: ${top.candidateName} (${parseJobCandidateScore(top.score)}%).`,
        );
      } else if (merged.length) {
        void requestInfo(
          `${merged.length} job-linked candidate(s). Run AI Applied Matches to refresh scores.`,
        );
      } else {
        void requestInfo('No candidates applied, assigned, or in the pipeline for this job yet.');
      }
    } catch {
      // errors surfaced in refreshAppliedJobCandidates
    }
  }, [job?.id, refreshAppliedJobCandidates]);

  useEffect(() => {
    if (!isOpen || activeTab !== 'candidates' || !job?.id) {
      if (activeTab !== 'candidates') wasOnCandidatesTabRef.current = false;
        return;
      }
    const switchedToCandidatesTab = !wasOnCandidatesTabRef.current;
    const jobChanged = prevCandidatesTabJobIdRef.current !== job.id;
    wasOnCandidatesTabRef.current = true;
    prevCandidatesTabJobIdRef.current = job.id;
    if (switchedToCandidatesTab || jobChanged) {
      void refreshAppliedJobCandidates();
    }
  }, [isOpen, activeTab, job?.id, refreshAppliedJobCandidates]);

  const refreshAiMatches = useCallback(
    async (opts?: { runPipeline?: boolean; refresh?: boolean }) => {
      if (!job?.id) {
        setAiMatchCandidates([]);
        return [] as MatchCandidate[];
      }
      setAiMatchesLoading(true);
      setAiMatchesError(null);
      try {
        const runPipeline = Boolean(opts?.runPipeline);
        const response = await apiGetMatches({
          jobId: job.id,
          source: 'ai',
          limit: 100,
          ...(runPipeline ? { runPipeline: '1' } : {}),
          ...(opts?.refresh ? { refresh: '1' } : {}),
        });
        const matchRows = unwrapMatchRows(response);
        const merged = matchRows.map(mapBackendMatch);
        const aiOnly = merged.filter((row) => !row.isAppliedCandidate);
        setAiMatchCandidates(aiOnly);
        setAiSavedMatches(
          aiOnly.filter((candidate) => Boolean(candidate.savedAt)).map((candidate) => candidate.id),
        );
        return aiOnly;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unable to load AI matches';
        setAiMatchesError(message);
        setAiMatchCandidates([]);
        return [] as MatchCandidate[];
      } finally {
        setAiMatchesLoading(false);
      }
    },
    [job?.id],
  );

  const handleRunAiMatches = useCallback(async () => {
    if (!job?.id) return;
    setAiPipelineRunning(true);
    setAiMatchesError(null);
    try {
      const list = await refreshAiMatches({ runPipeline: true, refresh: true });
      const sorted = [...list].sort((a, b) => b.score - a.score);
      const top = sorted[0];
      const stats = computeAiTierStats(list);
      const phase1Count = list.filter((c) => c.isPhase1Candidate).length;
      if (top) {
        const summary = AI_SCORE_TIERS.map((t) => `${t.label}: ${stats[t.id]}`).join(' · ');
        const phase1Note = phase1Count ? ` · ${phase1Count} Phase 1` : '';
        void requestInfo(
          `AI complete — ${list.length} scored. Top: ${top.name} (${top.score}%). ${summary}${phase1Note}`,
        );
      } else {
        void requestInfo('AI matching complete — no scored candidates yet for this job.');
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unable to run AI matching';
      setAiMatchesError(message);
      void requestError(message);
    } finally {
      setAiPipelineRunning(false);
    }
  }, [job?.id, refreshAiMatches]);

  const updateAiMatchCandidate = useCallback(
    (candidateId: string, updater: (candidate: MatchCandidate) => MatchCandidate) => {
      setAiMatchCandidates((prev) =>
        prev.map((candidate) => (candidate.id === candidateId ? updater(candidate) : candidate)),
      );
    },
    [],
  );

  const ensureAiMatchId = useCallback(
    async (candidate: MatchCandidate): Promise<string | null> => {
      if (candidate.matchId) return candidate.matchId;
      if (!job?.id) return null;
      try {
        const response = await apiCreateMatch({
          candidateId: candidate.id,
          jobId: job.id,
          score: candidate.score,
          status: 'SUGGESTED',
        });
        const newMatchId = response?.data?.id;
        if (newMatchId) {
          updateAiMatchCandidate(candidate.id, (current) => ({
            ...current,
            matchId: newMatchId,
            isAppliedCandidate: false,
          }));
          return newMatchId;
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unable to create match record';
        void requestError(message);
      }
      return null;
    },
    [job?.id, updateAiMatchCandidate],
  );

  const sortedAiMatchCandidates = useMemo(
    () => [...aiMatchCandidates].sort((a, b) => b.score - a.score),
    [aiMatchCandidates],
  );

  const aiTierStats = useMemo(() => computeAiTierStats(aiMatchCandidates), [aiMatchCandidates]);

  useEffect(() => {
    if (!isOpen || !job?.id) {
      prevAiTabJobIdRef.current = null;
      prevOnAiTabRef.current = false;
      return;
    }
    if (activeTab !== 'ai-matches') {
      prevOnAiTabRef.current = false;
      return;
    }
    const jobChanged = prevAiTabJobIdRef.current !== job.id;
    const switchedToAi = !prevOnAiTabRef.current;
    prevAiTabJobIdRef.current = job.id;
    prevOnAiTabRef.current = true;
    if (switchedToAi || jobChanged) {
      void handleRunAiMatches();
    }
  }, [activeTab, handleRunAiMatches, isOpen, job?.id]);

  useEffect(() => {
    if (!isOpen) {
      setAiMatchCandidates([]);
      setAiMatchesError(null);
      setAiMatchSelectedIds([]);
      setAiSavedMatches([]);
      setAiExpandedAnalysis(null);
      prevAiTabJobIdRef.current = null;
      prevOnAiTabRef.current = false;
    }
  }, [isOpen]);

  useEffect(() => {
    setAiMatchCandidates([]);
    setAiMatchesError(null);
    setAiMatchSelectedIds([]);
    setAiSavedMatches([]);
    setAiExpandedAnalysis(null);
    prevAiTabJobIdRef.current = null;
    prevOnAiTabRef.current = false;
  }, [job?.id]);

  useEffect(() => {
    if (!isOpen) setSelectedCandidateIds([]);
  }, [isOpen]);

  useEffect(() => {
    setSelectedCandidateIds([]);
  }, [job?.id]);

  const [notesTagFilter, setNotesTagFilter] = useState<JobNoteTag | 'All'>('All');
  const [pinnedNoteIds, setPinnedNoteIds] = useState<Set<string>>(new Set());
  const [filesTypeFilter, setFilesTypeFilter] = useState<JobFileType | 'All'>('All');
  const [expandedApplicationIds, setExpandedApplicationIds] = useState<Set<string>>(new Set());
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
    const next = pipelineStages.filter((s) => s.id !== id);
    const normalized = normalizePipelineStages(next);
    setPipelineStages(normalized);
    notifyPipelineChange(normalized);
    setPipelineDirty(true);
    setPipelineValidationError('');
  };

  const handleStageNameChange = (id: string, name: string) => {
    if (pipelineConfigLocked) return;
    const stage = pipelineStages.find((s) => s.id === id);
    if (!stage) return;

    const next = pipelineStages.map((s) => (s.id === id ? { ...s, name } : s));
    setPipelineStages(next);
    notifyPipelineChange(next);
    setPipelineDirty(true);
    setPipelineValidationError('');
  };

  const handleStageSlaChange = (id: string, sla: string) => {
    if (pipelineConfigLocked) return;
    const next = pipelineStages.map((s) => (s.id === id ? { ...s, sla } : s));
    setPipelineStages(next);
    notifyPipelineChange(next);
    setPipelineDirty(true);
    setPipelineValidationError('');
  };

  const handleStageSystemRoleChange = (id: string, systemRole: string) => {
    const value = String(systemRole || '').trim();
    const next = pipelineStages.map((s) =>
      s.id === id ? { ...s, systemRole: value || undefined } : s
    );
    setPipelineStages(next);
    notifyPipelineChange(next);
    setPipelineDirty(true);
    setPipelineValidationError('');
  };

  const isDefaultPipelineStage = (stage: JobPipelineStage) => DEFAULT_PIPELINE_STAGE_ID_SET.has(String(stage.id || ''));
  const formatApplicationCandidateName = (app: JobApplicationSubmission) => {
    const first = String(app?.candidate?.firstName || '').trim();
    const last = String(app?.candidate?.lastName || '').trim();
    const full = [first, last].filter(Boolean).join(' ').trim();
    if (full) return full;
    return String(app?.candidate?.email || '').trim() || app.candidateId || 'Candidate';
  };
  const applicationAnswerRows = (answers?: Record<string, unknown> | null) => {
    const input = answers && typeof answers === 'object' ? answers : {};
    const rows: Array<{ key: string; label: string; value: string }> = [];
    for (const [key, raw] of Object.entries(input)) {
      if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
        const r = raw as Record<string, unknown>;
        const label = String(r.label || key).trim() || key;
        const valueRaw = r.value;
        let value = '';
        if (Array.isArray(valueRaw)) value = valueRaw.map((v) => String(v)).join(', ');
        else if (valueRaw === null || valueRaw === undefined) value = '';
        else value = String(valueRaw);
        rows.push({ key, label, value: value.trim() || '—' });
      } else {
        const value = raw === null || raw === undefined ? '—' : String(raw);
        rows.push({ key, label: key, value: value.trim() || '—' });
      }
    }
    return rows;
  };
  const pipelineStageCountCards = useMemo(() => {
    const stageList = Array.isArray(pipelineStages) ? pipelineStages : [];
    const countsByStageId = new Map<string, number>();
    const stageMeta = stageList.map((stage) => {
      const rawName = String(stage?.name || '').trim();
      const normalized = normalizeStageLabel(rawName);
      const canonical = canonicalStageLabel(rawName);
      return {
        id: stage.id,
        rawName,
        normalized,
        canonical,
      };
    });
    const normalizedStageMap = new Map(stageMeta.map((s) => [s.normalized, s.id]));
    const canonicalStageMap = new Map(stageMeta.map((s) => [s.canonical, s.id]));

    (Array.isArray(jobCandidates) ? jobCandidates : []).forEach((candidate) => {
      const candidateStageRaw = String(candidate?.currentStage || '');
      const candidateStageNormalized = normalizeStageLabel(candidateStageRaw);
      if (!candidateStageNormalized) return;

      let stageId =
        normalizedStageMap.get(candidateStageNormalized) ||
        canonicalStageMap.get(canonicalStageLabel(candidateStageRaw));

      if (!stageId) {
        const prefixMatch = stageMeta.find(
          (stage) =>
            candidateStageNormalized.startsWith(`${stage.normalized} `) ||
            stage.normalized.startsWith(`${candidateStageNormalized} `)
        );
        stageId = prefixMatch?.id;
      }

      if (!stageId) return;
      countsByStageId.set(stageId, (countsByStageId.get(stageId) || 0) + 1);
    });

    return stageList.map((stage) => {
      return {
        id: stage.id,
        name: String(stage?.name || '').trim() || 'Untitled',
        count: countsByStageId.get(stage.id) || 0,
      };
    });
  }, [pipelineStages, jobCandidates]);

  if (!isOpen) return null;

  return (
    <>
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
        className="fixed right-0 top-0 h-full w-3/4 max-w-6xl bg-white shadow-2xl z-50 pointer-events-auto border-l border-slate-200 flex flex-col"
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
                    {!showStatusChange ? (
                      <button
                        type="button"
                        onClick={() => setShowStatusChange(true)}
                        className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-bold border ${STATUS_STYLES[job.status]} hover:opacity-80 transition-opacity`}
                      >
                        {job.status}
                      </button>
                    ) : null}
                    {job.jobLocationType && (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full">
                        <UserCheck size={12} />
                        {job.jobLocationType}
                      </span>
                    )}
                    {job.salaryRange && (
                      <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded flex items-center gap-1">
                        <DollarSign size={12} />
                        {job.salaryRange}
                      </span>
                    )}
                    <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                      {job.postedDate ?? job.createdDate}
                    </span>
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
              <div className="hidden">
                <span className="text-slate-400 font-medium">Posted Date</span>
                <p className="text-slate-700 mt-0.5">{job.postedDate ?? job.createdDate}</p>
              </div>
              <div className="hidden">
                <span className="text-slate-400 font-medium">Recruiter</span>
                <p className="text-slate-700 mt-0.5">{job.recruiter ?? job.owner}</p>
              </div>
              <div className="hidden">
                <span className="text-slate-400 font-medium">Hiring Manager</span>
                <p className="text-slate-700 mt-0.5">{job.hiringManager ?? '—'}</p>
              </div>
              <div className="col-span-2 hidden">
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
                          void requestError(error.message || 'Failed to update job status');
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
                  <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="p-5 border-b border-slate-100">
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Overview</h4>
                    </div>
                    <div className="p-5 space-y-5">
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Job Title *</p>
                          <p className="mt-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800">{job.title || '—'}</p>
                        </div>
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Number Of Openings *</p>
                          <p className="mt-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800">{job.openings || '—'}</p>
                        </div>
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">For Which Company *</p>
                          <p className="mt-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800">{job.client || '—'}</p>
                        </div>
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Assign recruiter</p>
                          <p className="mt-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800">{job.recruiter || job.owner || '—'}</p>
                        </div>
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Location</p>
                          <p className="mt-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800">{job.location || '—'}</p>
                        </div>
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Work mode</p>
                          <p className="mt-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800">{job.jobLocationType || '—'}</p>
                        </div>
                        <div className="sm:col-span-2">
                          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Salary</p>
                          <p className="mt-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800">
                            {formatJobSalaryRange(job) || '—'}
                          </p>
                        </div>
                      </div>

                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Job Summary</p>
                        <div className="mt-1 min-h-[120px] rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 whitespace-pre-wrap">
                          {job.overview || 'Brief summary of the role'}
                        </div>
                      </div>

                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Key Responsibilities</p>
                        <div className="mt-1 min-h-[120px] rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 whitespace-pre-wrap">
                          {job.keyResponsibilities?.length ? job.keyResponsibilities.join('\n') : 'One responsibility per line'}
                        </div>
                      </div>

                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Qualifications and Experience</p>
                        <div className="mt-1 min-h-[120px] rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 whitespace-pre-wrap">
                          {[job.education, job.experienceRequired].filter(Boolean).join('\n') || 'One qualification per line'}
                        </div>
                      </div>

                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Compensation & Benefits</p>
                        <div className="mt-1 min-h-[120px] rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 whitespace-pre-wrap">
                          {job.benefits?.length ? job.benefits.join('\n') : '—'}
                        </div>
                      </div>

                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-2">Job Applications</p>
                        {Array.isArray(job.applications) && job.applications.length > 0 ? (
                          <div className="space-y-2">
                            {job.applications.map((app) => {
                              const answers = applicationAnswerRows(app.screeningAnswers || null);
                              const open = expandedApplicationIds.has(app.id);
                              return (
                                <div key={app.id} className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setExpandedApplicationIds((prev) => {
                                        const next = new Set(prev);
                                        if (next.has(app.id)) next.delete(app.id);
                                        else next.add(app.id);
                                        return next;
                                      });
                                    }}
                                    className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-slate-50/70 transition-colors"
                                  >
                                    <div>
                                      <p className="text-sm font-semibold text-slate-900">{formatApplicationCandidateName(app)}</p>
                                      <p className="text-xs text-slate-500 mt-0.5">
                                        {app.appliedAt ? formatDateTimeDMY(app.appliedAt) : 'Applied'}
                                        {app.status ? ` • ${app.status}` : ''}
                                      </p>
                                    </div>
                                    {open ? (
                                      <ChevronDown size={16} className="text-slate-400 shrink-0" />
                                    ) : (
                                      <ChevronRight size={16} className="text-slate-400 shrink-0" />
                                    )}
                                  </button>
                                  {open && (
                                    <div className="border-t border-slate-100 bg-slate-50/40 px-4 py-3">
                                      {answers.length > 0 ? (
                                        <div className="space-y-2">
                                          {answers.map((row) => (
                                            <div key={`${app.id}-${row.key}`} className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                                              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{row.label}</p>
                                              <p className="text-sm text-slate-800 mt-1 whitespace-pre-wrap">{row.value}</p>
                                            </div>
                                          ))}
                                        </div>
                                      ) : (
                                        <p className="text-sm text-slate-500">No screening answers submitted.</p>
                                      )}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                            No applications yet for this job.
                          </p>
                        )}
                      </div>
                    </div>
                  </section>

                  <div className="hidden">
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
                          {(() => {
                            const range = formatJobSalaryRange(job);
                            if (!range) return '—';
                            return job.salaryType ? `${job.salaryType} • ${range}` : range;
                          })()}
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
                              {job.applicationFormQuestions.map((q, idx) => {
                                let label = String(q || '').trim();
                                let typeBadge: string | null = null;
                                if (label.startsWith('{')) {
                                  try {
                                    const parsed = JSON.parse(label);
                                    if (parsed && typeof parsed === 'object' && typeof parsed.label === 'string') {
                                      label = parsed.label;
                                      const t = String(parsed.type || '');
                                      if (t === 'yes_no') typeBadge = 'Yes / No';
                                      else if (t === 'single_choice') typeBadge = 'Multiple choice';
                                      else if (t === 'slider') typeBadge = 'Proficiency slider';
                                      else if (t === 'short_text') typeBadge = 'Short text';
                                    }
                                  } catch {
                                    /* leave as plain text */
                                  }
                                }
                                return (
                                  <li key={idx}>
                                    {label}
                                    {typeBadge ? (
                                      <span className="ml-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                                        ({typeBadge})
                                      </span>
                                    ) : null}
                                  </li>
                                );
                              })}
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
                </div>
              )}

              {activeTab === 'candidates' && (
                <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                  <div className="flex flex-col gap-3 border-b border-slate-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Candidates</h4>
                      <p className="mt-0.5 text-xs text-slate-500">
                        Applied, assigned, or in this job&apos;s pipeline only — scores from AI Applied Matches
                      </p>
                  </div>
                                    <button
                                      type="button"
                      onClick={() => void handleRunAppliedMatches()}
                      disabled={!job?.id || appliedPipelineRunning || appliedCandidatesLoading}
                      className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-emerald-500/25 transition hover:from-emerald-700 hover:via-teal-700 hover:to-cyan-700 disabled:cursor-not-allowed disabled:opacity-60"
                      title="Score tenant candidates assigned or applied to this job"
                    >
                      <Users
                        size={16}
                        className={appliedPipelineRunning ? 'animate-spin' : ''}
                        strokeWidth={2.25}
                      />
                      {appliedPipelineRunning ? 'Running applied matches…' : 'Run AI Applied Matches'}
                                    </button>
                                  </div>
                  {appliedCandidatesLoading || appliedPipelineRunning ? (
                    <div className="flex items-center justify-center gap-2 p-10 text-sm text-slate-500">
                      <Loader2 size={18} className="animate-spin text-emerald-600" />
                      {appliedPipelineRunning
                        ? 'Running AI applied matching…'
                        : 'Loading job-linked candidates…'}
                    </div>
                  ) : jobTableCandidates.length === 0 ? (
                    <div className="p-8 text-center">
                      <Users size={32} className="mx-auto mb-3 text-slate-300" />
                      <p className="text-sm text-slate-500">
                        No candidates applied, assigned, or in the pipeline for this job yet.
                      </p>
                    </div>
                  ) : (
                    <div className="no-scrollbar overflow-x-auto">
                      <CandidateTable
                        candidates={jobTableCandidates}
                        showMatchScore={showMatchScores}
                        selectedIds={selectedCandidateIds}
                        onToggleSelect={(id) =>
                          setSelectedCandidateIds((prev) =>
                            prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
                          )
                        }
                        onToggleSelectAll={() =>
                          setSelectedCandidateIds((prev) =>
                            prev.length === jobTableCandidates.length
                              ? []
                              : jobTableCandidates.map((row) => row.id),
                          )
                        }
                        onViewProfile={onViewCandidateProfile}
                        onEditCandidate={onEditCandidate}
                        onSubmitToClient={
                          job?.id
                            ? (row) => {
                                const source = displayJobCandidates.find((c) => c.id === row.id);
                                if (!source) return;
                                setSubmitClientRowId(row.id);
                                openFromJobDrawerRow(
                                  source,
                                  job.id,
                                  job.title,
                                  job.clientId,
                                );
                              }
                            : undefined
                        }
                        submittingToClientCandidateId={submitClientRowId}
                      />
                    </div>
                  )}
                </div>
              )}
              {activeTab === 'ai-matches' && (
                <JobDrawerAiMatchesTab
                  job={job}
                  aiMatchCandidates={aiMatchCandidates}
                  sortedAiMatchCandidates={sortedAiMatchCandidates}
                  aiTierStats={aiTierStats}
                  aiMatchesLoading={aiMatchesLoading}
                  aiPipelineRunning={aiPipelineRunning}
                  aiMatchesError={aiMatchesError}
                  aiMatchSelectedIds={aiMatchSelectedIds}
                  aiSavedMatches={aiSavedMatches}
                  aiExpandedAnalysis={aiExpandedAnalysis}
                  onRunAiMatches={handleRunAiMatches}
                  onToggleSelect={(candidateId) =>
                    setAiMatchSelectedIds((prev) =>
                      prev.includes(candidateId)
                        ? prev.filter((id) => id !== candidateId)
                        : [...prev, candidateId],
                    )
                  }
                  onToggleSelectAll={() =>
                    setAiMatchSelectedIds((prev) =>
                      prev.length === sortedAiMatchCandidates.length
                        ? []
                        : sortedAiMatchCandidates.map((row) => row.id),
                    )
                  }
                  onToggleSave={(candidateId) => {
                    const candidate = aiMatchCandidates.find((item) => item.id === candidateId);
                    if (!candidate) return;
                    const nextSaved = !aiSavedMatches.includes(candidateId);
                    void (async () => {
                      const matchId = await ensureAiMatchId(candidate);
                      if (!matchId) return;
                      await apiToggleSavedMatch(matchId, nextSaved);
                      setAiSavedMatches((previous) =>
                        nextSaved
                          ? [...previous, candidateId]
                          : previous.filter((id) => id !== candidateId),
                      );
                      updateAiMatchCandidate(candidateId, (current) => ({
                        ...current,
                        matchId,
                        savedAt: nextSaved ? new Date().toISOString() : null,
                      }));
                    })();
                  }}
                  onToggleAnalysis={(candidateId) =>
                    setAiExpandedAnalysis((previous) =>
                      previous === candidateId ? null : candidateId,
                    )
                  }
                  onViewProfile={(candidateId) => {
                    const match = aiMatchCandidates.find((item) => item.id === candidateId);
                    if (!match || !onViewCandidateProfile) return;
                    onViewCandidateProfile(matchCandidateToJobTableRow(match, job.title, job.id));
                  }}
                  onOpenSubmit={(candidateId) => {
                    const candidate = aiMatchCandidates.find((item) => item.id === candidateId);
                    if (!candidate || !job?.id) return;
                    setSubmitClientRowId(candidateId);
                    void (async () => {
                      const matchId = await ensureAiMatchId(candidate);
                      openSubmit({
                        candidateId: candidate.id,
                        jobId: job.id,
                        candidateName: candidate.name,
                        jobTitle: job.title,
                        clientId: job.clientId,
                        matchScore: candidate.score,
                        matchId: matchId || undefined,
                      });
                    })();
                  }}
                />
              )}

              {activeTab === 'pipeline' && (
                <div className="space-y-4">
                  <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Stage counts</h4>
                    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
                      {pipelineStageCountCards.map((stage) => (
                        <div key={stage.id} className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-center">
                          <p className="text-[10px] font-bold text-slate-400 uppercase truncate" title={stage.name}>
                            {stage.name}
                          </p>
                          <p className="text-xl font-bold text-slate-900 mt-1">{stage.count}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="p-4 border-b border-slate-100">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Pipeline configuration</h4>
                          <p className="text-xs text-slate-500 mt-0.5">
                            {pipelineConfigLocked
                              ? 'Standalone org: this job uses the organization default pipeline. Use “Customize pipeline” to change stages, order, or system roles for this job only.'
                              : 'Custom hiring pipeline for this job. Drag to reorder, add or remove stages.'}
                          </p>
                          <p className="text-[11px] text-amber-600 mt-1">Note: SLA values are currently display-only and are not persisted yet.</p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 shrink-0">
                          {orgRecruitmentMode === 'standalone' && job?.id && (
                            <button
                              type="button"
                              onClick={async () => {
                                const ok = window.confirm(
                                  'Reset this job\'s pipeline to the organization default template? This wipes the current stages and any candidates already on them.'
                                );
                                if (!ok) return;
                                try {
                                  const res = await apiResetJobPipelineToOrgTemplate(job.id);
                                  const stages = res.data?.stages || [];
                                  const mapped = stages.map((s) => ({
                                    id: String(s.id),
                                    name: String(s.name || ''),
                                    sla: '',
                                    systemRole: s.systemRole || undefined,
                                  }));
                                  setPipelineStages(mapped);
                                  notifyPipelineChange(mapped);
                                  setPipelineDirty(false);
                                  setStandaloneCustomizePipeline(false);
                                  void requestInfo('Pipeline reset to org default');
                                } catch (err: any) {
                                  void requestError(err?.message || 'Failed to reset pipeline');
                                }
                              }}
                              className="px-3 py-2 rounded-lg text-xs font-bold border border-amber-200 text-amber-700 bg-amber-50 hover:bg-amber-100 transition-colors"
                              title="Replace this job's stages with the saved org template"
                            >
                              Reset to org default
                            </button>
                          )}
                          {orgRecruitmentMode === 'standalone' &&
                            (pipelineConfigLocked ? (
                              <button
                                type="button"
                                onClick={() => setStandaloneCustomizePipeline(true)}
                                className="px-3 py-2 rounded-lg text-xs font-bold border border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100 transition-colors"
                              >
                                Customize pipeline
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  setStandaloneCustomizePipeline(false);
                                  setPipelineDirty(false);
                                }}
                                className="px-3 py-2 rounded-lg text-xs font-bold border border-slate-200 text-slate-600 bg-white hover:bg-slate-50 transition-colors"
                              >
                                Lock to org view
                              </button>
                            ))}
                          <button
                            type="button"
                            onClick={() => {
                              if (pipelineConfigLocked) return;
                              const hasEmptyStageName = pipelineStages.some(
                                (stage) => String(stage.name || '').trim().length === 0
                              );
                              if (hasEmptyStageName) {
                                setPipelineValidationError('Please enter a stage name for all pipeline stages before saving.');
                                return;
                              }
                              const stagesForSave = pipelineStages.map((stage) => ({
                                ...stage,
                                name: String(stage.name || '').trim(),
                                systemRole: stage.systemRole && String(stage.systemRole).trim()
                                  ? String(stage.systemRole).trim()
                                  : undefined,
                              }));
                              setPipelineStages(stagesForSave);
                              notifyPipelineChange(stagesForSave);
                              onSavePipelineStages?.(stagesForSave);
                              setPipelineValidationError('');
                              setPipelineDirty(false);
                            }}
                            disabled={!pipelineDirty || pipelineConfigLocked}
                            className={`px-3 py-2 rounded-lg text-xs font-bold border transition-colors ${
                              pipelineDirty && !pipelineConfigLocked
                                ? 'bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700'
                                : 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                            }`}
                          >
                            Save pipeline
                          </button>
                        </div>
                      </div>
                      {!pipelineConfigLocked && (
                        <button
                          type="button"
                          onClick={handleAddStage}
                          className="mt-3 flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 border border-blue-100 transition-colors"
                        >
                          <Plus size={14} /> Add stage
                        </button>
                      )}
                      {pipelineValidationError ? (
                        <p className="mt-3 text-xs font-medium text-red-600">{pipelineValidationError}</p>
                      ) : null}
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
                            draggable={!pipelineConfigLocked}
                            onDragStart={() => {
                              if (pipelineConfigLocked) return;
                              setDraggedStageId(stage.id);
                            }}
                            onDragOver={(e) => {
                              if (pipelineConfigLocked) return;
                              e.preventDefault();
                            }}
                            onDrop={(e) => {
                              if (pipelineConfigLocked) return;
                              e.preventDefault();
                              if (!draggedStageId || draggedStageId === stage.id) return;
                              const from = pipelineStages.findIndex((s) => s.id === draggedStageId);
                              const to = index;
                              if (from >= 0 && to >= 0) handlePipelineReorder(from, to);
                              setDraggedStageId(null);
                            }}
                            onDragEnd={() => setDraggedStageId(null)}
                            className={`flex flex-wrap items-center gap-3 px-4 py-3 hover:bg-slate-50/50 transition-colors ${
                              draggedStageId === stage.id ? 'opacity-50' : ''
                            }`}
                          >
                            <span
                              className={`shrink-0 ${pipelineConfigLocked ? 'text-slate-200' : 'cursor-grab active:cursor-grabbing text-slate-400 hover:text-slate-600'}`}
                              aria-label="Drag to reorder"
                            >
                              <GripVertical size={18} />
                            </span>
                            <span className="text-sm font-medium text-slate-500 w-8 shrink-0">{index + 1}</span>
                            {pipelineConfigLocked ? (
                              <span className="flex-1 min-w-0 text-sm font-medium text-slate-900">{stage.name}</span>
                            ) : (
                              <input
                                type="text"
                                value={stage.name}
                                onChange={(e) => handleStageNameChange(stage.id, e.target.value)}
                                className="flex-1 min-w-[120px] rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                placeholder="Stage name"
                              />
                            )}
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-[10px] font-bold text-slate-400 uppercase whitespace-nowrap">Role</span>
                              {pipelineConfigLocked ? (
                                <span className="text-xs font-medium text-slate-600 min-w-[100px]">
                                  {PIPELINE_SYSTEM_ROLE_OPTIONS.find((o) => o.value === (stage.systemRole || ''))?.label ||
                                    stage.systemRole ||
                                    '—'}
                                </span>
                              ) : (
                                <select
                                  value={stage.systemRole || ''}
                                  onChange={(e) => handleStageSystemRoleChange(stage.id, e.target.value)}
                                  className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs text-slate-800 min-w-[128px]"
                                >
                                  {PIPELINE_SYSTEM_ROLE_OPTIONS.map((o) => (
                                    <option key={o.value || 'unset'} value={o.value}>
                                      {o.label}
                                    </option>
                                  ))}
                                </select>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0 w-28">
                              <Clock size={14} className="text-slate-400 shrink-0" />
                              <input
                                type="text"
                                value={stage.sla ?? ''}
                                onChange={(e) => handleStageSlaChange(stage.id, e.target.value)}
                                placeholder="e.g. 2 days"
                                disabled
                                title="SLA persistence is not enabled yet"
                                className="w-full rounded-lg border border-slate-200 bg-slate-100 px-2 py-1.5 text-xs text-slate-500 cursor-not-allowed"
                              />
                            </div>
                            {!pipelineConfigLocked && (
                              <button
                                type="button"
                                onClick={() => handleRemoveStage(stage.id)}
                                disabled={isDefaultPipelineStage(stage)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors shrink-0"
                                aria-label="Remove stage"
                              >
                                <Trash2 size={16} />
                              </button>
                            )}
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
                                dateLabel = formatDateDMY(date);
                              }

                              const timeLabel = formatTime12hEnGb(date);
                              
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
                const uploadsBase = (typeof window !== 'undefined' ? (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api/v1') : 'http://localhost:5001/api/v1').replace(/\/api\/v1\/?$/, '');
                const toFileHref = (fileUrl?: string | null) => buildFileHref(fileUrl, uploadsBase);
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
                    return formatDateDMY(d) || d;
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
              {onEdit && (
                <button
                  type="button"
                  onClick={() => onEdit(job)}
                  className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50"
                >
                  <Pencil size={14} /> Edit Job
                </button>
              )}
              {job.status === 'Draft' && onPublish && (
                <button
                  type="button"
                  onClick={() => onPublish(job)}
                  className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-xl hover:bg-blue-700"
                >
                  <Send size={14} /> Publish Job
                </button>
              )}
              {onClone && (
                <button
                  type="button"
                  onClick={() => onClone(job)}
                  className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50"
                >
                  <Copy size={14} /> Clone Job
                </button>
              )}
              {onCloseJob && (
                <button
                  type="button"
                  onClick={() => onCloseJob(job)}
                  className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-red-700 bg-red-50 border border-red-200 rounded-xl hover:bg-red-100"
                >
                  <Archive size={14} /> Close Job
                </button>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center p-8 text-slate-500 text-sm">
            Select a job to view details.
          </div>
        )}
      </motion.div>
    </AnimatePresence>

    {submitToClientModal}
    </>
  );
}

