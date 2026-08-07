'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePageDrawerLifecycle } from '../../lib/pageDrawerEvents';
import { useDrawerUnsavedGuard } from '../../hooks/useDrawerUnsavedGuard';
import { AnimatePresence, motion } from 'motion/react';
import { DetailsModalShell } from './DetailsModalShell';
import { createPortal } from 'react-dom';
import { buildFileHref } from '../../utils/cloudinaryUrls';
import { CandidateResumeTabPanel } from '../candidates/CandidateResumeTabPanel';
import { CandidateAssessmentsTabPanel } from '../candidates/CandidateAssessmentsTabPanel';
import { CandidateCvFilesSection } from '../candidates/CandidateCvFilesSection';
import {
  buildCandidateEditForm,
  buildUpdatePayloadFromEditForm,
  CandidateEditAtsSections,
  validateEditFormStructured,
  type CandidateEditFormState,
} from '../candidates/CandidateEditAtsSections';
import { useCandidateCvEditor } from '../../hooks/useCandidateCvEditor';
import { useSaasaCvAnnotations } from '../../hooks/useSaasaCvAnnotations';
import type { ResumeCvViewMode } from '../../lib/cvEditorMapping';
import { pickLatestResumeFileUrl } from '../../lib/phase1ProfileSnapshot';
import { hasSaasaCvSaved, readSaasaCvAnnotations, SAASA_CV_FILE_TYPE } from '../../lib/saasaCvAnnotations';
import { formatDateDMY, formatDateTimeDMY } from '../../utils/dateDisplay';
import type { AuditMeta } from '../../types/audit';
import { EntityAuditSummary } from '../table/TableAuditCell';
import { DrawerEntityChatTab } from './DrawerEntityChatTab';
import { DrawerSectionCard, DRAWER_FORM_SCROLL_BG } from './drawerFormUi';
import { extractAuditMeta } from '../../utils/auditMeta';
import { requestSuccess } from '../../lib/appDialog';
import {
  ArrowRightCircle,
  Briefcase,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  FileSearch,
  FileText,
  Loader2,
  AlertTriangle,
  MapPin,
  MessageSquare,
  MessageSquareText,
  MoreVertical,
  Pin,
  Phone,
  Plus,
  Search,
  SquarePen,
  SendHorizontal,
  Send,
  Tag,
  Trash2,
  UserCircle2,
  Video,
  X,
  Activity,
  Paperclip,
} from 'lucide-react';
import { ImageWithFallback, initialsFromDisplayName } from '../ImageWithFallback';
import { getCandidateStageBadgeClasses, getCandidateStageLabel } from '../../utils/candidateStage';
import { useFiles } from '../../hooks/useFiles';
import { DocumentUploadButton } from '../import/documentUploadUi';
import {
  apiGenerateCandidateInterviewMeetingLink,
  apiGetCandidate,
  apiGetClient,
  apiGetClients,
  apiGetInterviews,
  apiGetJob,
  apiGetJobs,
  apiGetWorkspaceClient,
  apiUploadCandidateAvatar,
  getCachedOrgRecruitmentMode,
  type BackendCandidate,
  type BackendInterviewListItem,
  type UpdateCandidatePayload,
} from '../../lib/api';
import { extractApiData } from '../../lib/mapCandidateProfile';
import { getAllTeamMembersForAssign, getLineManagersForJobPicker, teamMembersToBackendUsers } from '../../lib/api/teamApi';
import { toast } from 'sonner';
import { requestError } from '../../lib/appDialog';
import { parseClientsListFromResponse, parseJobsListFromResponse } from '../../lib/parseApiList';
import {
  clampDateToMinLocal,
  filterInterviewSlotsForLocalDate,
  generateStandardInterviewSlotDescriptors,
  getLocalDateInputMinToday,
} from '../../utils/dateInputConstraints';
import {
  computeNextInterviewRound,
  extractEditableInterviewNotes,
  mergeEditableInterviewNotesWithAudit,
} from '../../lib/interview-schedule-helpers';
import { profileCanSubmitToClient } from '../../lib/candidateSubmitToClient';
import { CandidateAtsExtractedOverview } from '../candidates/CandidateAtsExtractedOverview';
import { EntityWorkspaceAlertsPanel } from '../ai/EntityWorkspaceAlertsPanel';
import { CandidatePhase1DetailSections } from '../candidates/CandidatePhase1DetailSections';
import { CandidatePhase1SubmitEditSections } from '../candidates/CandidatePhase1SubmitEditSections';
import { applyHiringFieldsFromEditForm, CandidateHiringEditSection } from '../candidates/CandidateHiringSection';
import {
  buildUpdatePayloadFromPhase1EditSnapshot,
  initPhase1EditSnapshotFromProfile,
} from '../../lib/phase1ClientPresentation';
import { isPhase1PortalCandidate, type Phase1ProfileSnapshot } from '../../lib/phase1ProfileSnapshot';
import {
  collectCandidateWorkEntries,
  formatCandidateExperienceForTable,
  resolveCandidateExperienceYears,
} from '../../lib/candidateExperience';
import type {
  CandidateProfileDrawerData,
  CandidateScheduledInterview,
  CandidateTagItem,
} from './candidateProfileDrawerData';

export type {
  CandidateProfileDrawerData,
  CandidateScheduledInterview,
  CandidateTagItem,
} from './candidateProfileDrawerData';

const MAX_EDIT_AVATAR_FILE_BYTES = 5 * 1024 * 1024;

function resolveCandidateAvatarPreviewUrl(raw: string, uploadsBase: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('blob:') || /^https?:\/\//i.test(trimmed)) return trimmed;
  return buildFileHref(trimmed, uploadsBase);
}

export interface CandidatePipelineJobOption {
  id: string;
  title: string;
  department?: string | null;
  clientId?: string | null;
  clientName?: string | null;
  managerId?: string | null;
  managerName?: string | null;
}

export interface CandidatePipelineRecruiterOption {
  id: string;
  name: string;
  avatar?: string | null;
}

export interface CandidateInterviewerOption {
  id: string;
  name: string;
  role?: string | null;
  department?: string | null;
  avatar?: string | null;
}

interface CandidateProfileDrawerProps {
  candidate: CandidateProfileDrawerData | null;
  isOpen: boolean;
  onClose: () => void;
  openEditDirectly?: boolean;
  loadingCandidateProfile?: boolean;
  currentUser?: {
    id: string;
    name: string;
    avatar?: string | null;
  };
  availableTags?: CandidateTagItem[];
  jobs?: CandidatePipelineJobOption[];
  recruiters?: CandidatePipelineRecruiterOption[];
  interviewers?: CandidateInterviewerOption[];
  existingInterviews?: CandidateScheduledInterview[];
  editModalOpenToken?: number | null;
  onAction?: (
    action: 'move-stage' | 'schedule-interview' | 'more' | 'edit',
    candidate: CandidateProfileDrawerData
  ) => void;
  onAddNote?: (candidateId: string, note: { text: string; tags: string[] }) => void | Promise<void>;
  onEditNote?: (candidateId: string, noteId: string, note: { text: string; tags: string[] }) => void | Promise<void>;
  onDeleteNote?: (candidateId: string, noteId: string) => void | Promise<void>;
  onPinNote?: (candidateId: string, noteId: string, isPinned: boolean) => void | Promise<void>;
  onAddTag?: (candidateId: string, tag: CandidateTagItem) => void | Promise<void>;
  onRemoveTag?: (candidateId: string, tagId: string) => void | Promise<void>;
  onCreateTag?: (candidateId: string, tagName: string) => Promise<CandidateTagItem | void> | CandidateTagItem | void;
  onAddToPipeline?: (payload: {
    candidateId: string;
    jobId: string;
    stage: string;
    recruiterId?: string;
    priority: 'High' | 'Medium' | 'Low';
    notes?: string;
  }) => void | Promise<void>;
  onRemoveFromPipeline?: (payload: { candidateId: string; jobId: string }) => void | Promise<void>;
  onRejectCandidate?: (
    reason: string,
    feedback: string,
    sendEmail: boolean,
    showFeedbackToCandidate: boolean,
    jobId?: string
  ) => void | Promise<void>;
  onScheduleInterview?: (interviewData: CandidateScheduledInterview) => void | Promise<void>;
  onUpdateCandidate?: (candidateId: string, payload: UpdateCandidatePayload) => void | Promise<void>;
  /** Reload candidate after CV editor save (e.g. loadCandidateProfile). */
  onRefreshCandidate?: (candidateId: string) => void | Promise<void>;
  /** Opens the same Submit to Client modal as Matches (Send icon in table). */
  onSubmitToClient?: (candidate: CandidateProfileDrawerData) => void;
  /** When true, drawer may show submit control if profile is job-linked (see profileCanSubmitToClient). */
  showSubmitToClient?: boolean;
  /** Render above job/details drawers (z ~115) when opened from nested contexts */
  stackAboveSiblingDrawers?: boolean;
}

type DrawerTab =
  | 'Overview'
  | 'Resume'
  | 'Interviews'
  | 'Assessments'
  | 'Activity'
  | 'Remarks'
  | 'Tags'
  | 'Files'
  | 'Chat';

const TABS: DrawerTab[] = [
  'Overview',
  'Resume',
  'Interviews',
  'Assessments',
  'Activity',
  'Remarks',
  'Tags',
  'Files',
  'Chat',
];

function getInitials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

function getStageClasses(stage?: string | null) {
  return getCandidateStageBadgeClasses(stage);
}

function getAvailabilityDot(status?: string | null) {
  switch ((status || '').toLowerCase()) {
    case 'available':
      return 'bg-emerald-500';
    case 'limited':
      return 'bg-amber-500';
    case 'unavailable':
      return 'bg-red-500';
    default:
      return 'bg-slate-400';
  }
}

/** CV JSON may store list fields as strings; coerce before .map(). */
function normalizeStringList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item ?? '').trim()).filter(Boolean);
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return [];
    if (trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) return normalizeStringList(parsed);
      } catch {
        /* plain text */
      }
    }
    return trimmed
      .split(/[;\n]/)
      .map((part) => part.trim())
      .filter(Boolean);
  }
  return [];
}

function formatTimelineDateLabel(value: string) {
  const target = new Date(value);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  const targetKey = target.toDateString();
  if (targetKey === today.toDateString()) return 'Today';
  if (targetKey === yesterday.toDateString()) return 'Yesterday';

  return formatDateDMY(target);
}

function getTimelineConfig(
  type: NonNullable<CandidateProfileDrawerData['activity']>[number]['type']
) {
  switch (type) {
    case 'stage-movement':
      return {
        dotClass: 'bg-purple-500',
        iconClass: 'text-purple-600 bg-purple-50',
        Icon: ArrowRightCircle,
      };
    case 'email-sent':
      return {
        dotClass: 'bg-blue-500',
        iconClass: 'text-blue-600 bg-blue-50',
        Icon: SendHorizontal,
      };
    case 'resume-parsed':
      return {
        dotClass: 'bg-teal-500',
        iconClass: 'text-teal-600 bg-teal-50',
        Icon: FileSearch,
      };
    case 'added-to-pipeline':
      return {
        dotClass: 'bg-emerald-500',
        iconClass: 'text-emerald-600 bg-emerald-50',
        Icon: Briefcase,
      };
    case 'interview-scheduled':
      return {
        dotClass: 'bg-amber-500',
        iconClass: 'text-amber-600 bg-amber-50',
        Icon: Calendar,
      };
    case 'rejected':
      return {
        dotClass: 'bg-red-500',
        iconClass: 'text-red-600 bg-red-50',
        Icon: X,
      };
    case 'note-added':
    default:
      return {
        dotClass: 'bg-slate-400',
        iconClass: 'text-slate-600 bg-slate-100',
        Icon: MessageSquareText,
      };
  }
}

function getAvatarInitials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

function formatRelativeTime(value: string) {
  const diffMs = Date.now() - new Date(value).getTime();
  const diffMinutes = Math.max(1, Math.floor(diffMs / (1000 * 60)));

  if (diffMinutes < 60) return `${diffMinutes} minute${diffMinutes === 1 ? '' : 's'} ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;

  return formatDateDMY(new Date(value));
}

interface CandidateTagSystemProps {
  candidateId: string;
  existingTags: CandidateTagItem[];
  availableTags: CandidateTagItem[];
  onAddTag?: (candidateId: string, tag: CandidateTagItem) => void | Promise<void>;
  onRemoveTag?: (candidateId: string, tagId: string) => void | Promise<void>;
  onCreateTag?: (candidateId: string, tagName: string) => Promise<CandidateTagItem | void> | CandidateTagItem | void;
  compact?: boolean;
}

function CandidateTagChip({
  tag,
  onRemove,
  removable = false,
}: {
  tag: CandidateTagItem;
  onRemove?: () => void;
  removable?: boolean;
}) {
  return (
    <span
      className="group inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ring-1"
      style={{
        backgroundColor: `${tag.color}18`,
        color: tag.color,
        boxShadow: `inset 0 0 0 1px ${tag.color}33`,
      }}
    >
      <span
        className="h-2 w-2 rounded-full"
        style={{ backgroundColor: tag.color }}
      />
      {tag.label}
      {removable ? (
        <button
          type="button"
          onClick={onRemove}
          className="ml-0.5 hidden rounded-full p-0.5 text-current/70 hover:bg-white/60 hover:text-current group-hover:inline-flex"
        >
          <X size={12} />
        </button>
      ) : null}
    </span>
  );
}

function CandidateTagSystem({
  candidateId,
  existingTags,
  availableTags,
  onAddTag,
  onRemoveTag,
  onCreateTag,
  compact = false,
}: CandidateTagSystemProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const popoverRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen) return undefined;

    const handleOutsideClick = (event: MouseEvent) => {
      if (!popoverRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isOpen]);

  const normalizedSelectedIds = useMemo(
    () => new Set(existingTags.map((tag) => tag.id)),
    [existingTags]
  );

  const filteredTags = useMemo(() => {
    const query = searchValue.trim().toLowerCase();
    if (!query) return availableTags;
    return availableTags.filter((tag) => tag.label.toLowerCase().includes(query));
  }, [availableTags, searchValue]);

  const handleCreateTag = async () => {
    const value = searchValue.trim();
    if (!value) return;

    const existing = availableTags.find((tag) => tag.label.toLowerCase() === value.toLowerCase());
    if (existing) {
      if (!normalizedSelectedIds.has(existing.id)) {
        await Promise.resolve(onAddTag?.(candidateId, existing));
      }
      setSearchValue('');
      setIsOpen(false);
      return;
    }

    const created = await Promise.resolve(onCreateTag?.(candidateId, value));
    if (created) {
      await Promise.resolve(onAddTag?.(candidateId, created));
    }
    setSearchValue('');
    setIsOpen(false);
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {existingTags.map((tag, index) => (
        <CandidateTagChip
          key={tag.id || tag.label || `existing-tag-${index}`}
          tag={tag}
          removable
          onRemove={() => onRemoveTag?.(candidateId, tag.id)}
        />
      ))}

      <div className="relative" ref={popoverRef}>
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          className={`inline-flex items-center gap-1 rounded-full border border-dashed border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-600 hover:border-blue-300 hover:text-blue-600 ${
            compact ? '' : 'shadow-sm'
          }`}
        >
          <Plus size={12} />
          Add Tag
        </button>

        {isOpen ? (
          <div className="absolute left-0 top-10 z-20 w-72 rounded-2xl border border-slate-200 bg-white p-3 shadow-xl">
            <div className="relative">
              <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleCreateTag();
                  }
                }}
                placeholder="Search or create tag"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              />
            </div>

            <div className="mt-3 max-h-56 space-y-1 overflow-y-auto">
              {filteredTags.map((tag, index) => {
                const selected = normalizedSelectedIds.has(tag.id);
                return (
                  <button
                    key={tag.id || tag.label || `filter-tag-${index}`}
                    type="button"
                    onClick={async () => {
                      if (selected) {
                        await Promise.resolve(onRemoveTag?.(candidateId, tag.id));
                      } else {
                        await Promise.resolve(onAddTag?.(candidateId, tag));
                      }
                    }}
                    className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm ${
                      selected ? 'bg-blue-50 text-blue-700' : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: tag.color }} />
                      {tag.label}
                    </span>
                    {selected ? <Check size={14} /> : null}
                  </button>
                );
              })}

              {filteredTags.length === 0 ? (
                <div className="rounded-xl bg-slate-50 px-3 py-3 text-sm text-slate-500">
                  No matching tags. Press `Enter` to create <span className="font-medium text-slate-700">{searchValue.trim()}</span>.
                </div>
              ) : null}
            </div>

            {searchValue.trim() ? (
              <button
                type="button"
                onClick={handleCreateTag}
                className="mt-3 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
              >
                Create "{searchValue.trim()}"
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export interface AddToPipelineModalProps {
  isOpen: boolean;
  candidate: CandidateProfileDrawerData | null;
  jobs: CandidatePipelineJobOption[];
  recruiters: CandidatePipelineRecruiterOption[];
  /** Pre-select job when opening from job drawer (move stage icon). */
  initialJobId?: string | null;
  /** Hide job picker and keep pipeline scoped to initialJobId. */
  lockJobToInitial?: boolean;
  onClose: () => void;
  onSubmit?: (payload: {
    candidateId: string;
    jobId: string;
    stage: string;
    recruiterId?: string;
    priority: 'High' | 'Medium' | 'Low';
    notes?: string;
  }) => void | Promise<void>;
  onRemoveFromPipeline?: (payload: { candidateId: string; jobId: string }) => void | Promise<void>;
  /** Opens reject modal (reason, feedback, email) when user picks Rejected in move stage. */
  onRequestReject?: (payload: { candidateId: string; jobId: string }) => void;
}

const PIPELINE_REJECTED_STAGE = 'Rejected';

function isRejectedPipelineStage(stage: string): boolean {
  return stage.trim().toLowerCase().includes('reject');
}

const REJECT_REASONS = [
  'Skill mismatch',
  'Salary too high',
  'Experience mismatch',
  'Client rejected',
  'Communication issue',
  'Other',
] as const;
const INTERVIEW_TYPES = [
  'HR Screening',
  'Technical Round 1',
  'Technical Round 2',
  'System Design',
  'Cultural Fit',
  'Final Round',
  'Client Interview',
] as const;
const INTERVIEW_DURATIONS = ['30 mins', '45 mins', '1 hour', '1.5 hours', '2 hours'] as const;
const INTERVIEW_PANEL_ROLES = ['Lead Interviewer', 'Interviewer', 'Observer'] as const;

type ScheduleClientContactOption = {
  id: string;
  name: string;
  designation?: string | null;
  department?: string | null;
  email?: string | null;
};

export interface ScheduleInterviewCandidateOption {
  id: string;
  name: string;
  phone?: string | null;
  assignedJob?: string | null;
  assignedJobId?: string | null;
  assignedClientId?: string | null;
}

function mapInterviewListItemToScheduled(
  item: BackendInterviewListItem,
  roundIndex: number,
): CandidateScheduledInterview {
  const scheduledAt = String(item.scheduledAt || '');
  const status = String(item.status || '').toUpperCase();
  return {
    id: item.id,
    candidateId: item.candidate.id,
    jobId: item.job?.id || null,
    jobTitle: item.job?.title || null,
    type: item.round || item.type || 'Interview',
    round: roundIndex,
    date: scheduledAt.split('T')[0] || '',
    time: scheduledAt
      ? new Date(scheduledAt).toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
        })
      : '',
    duration: item.duration ? `${item.duration} mins` : '1 hour',
    mode:
      item.mode === 'OFFLINE'
        ? 'in-person'
        : item.type === 'PHONE'
          ? 'phone'
          : 'video',
    platform:
      item.platform === 'GOOGLE_MEET'
        ? 'Google Meet'
        : item.platform === 'ZOOM'
          ? 'Zoom'
          : null,
    meetingLink: item.meetingLink || null,
    location: item.location || null,
    phoneNumber: null,
    interviewers: (item.panel || []).map((member) => ({
      id: member.user.id,
      name: member.user.name,
      role: 'Interviewer' as const,
    })),
    notes: item.notes || '',
    sendCandidateInvite: true,
    sendInterviewerInvite: true,
    status:
      status === 'COMPLETED' ? 'completed' : status === 'CANCELLED' ? 'cancelled' : 'scheduled',
  };
}

function isActiveScheduledInterview(status?: string | null): boolean {
  const normalized = String(status || '').trim().toLowerCase();
  return normalized !== 'cancelled';
}

interface ScheduleInterviewModalProps {
  candidate: Pick<
    CandidateProfileDrawerData,
    'id' | 'name' | 'phone' | 'stage' | 'assignedJob' | 'assignedJobId'
  > | null;
  /**
   * When provided (and `candidate` is null), the popup renders a candidate
   * picker so it can be used standalone — e.g. the /interviews "Schedule
   * Interview" button, where no single candidate is pre-selected.
   */
  candidateOptions?: ScheduleInterviewCandidateOption[];
  linkedJobLabel?: string;
  linkedJobTitle?: string;
  linkedJobCompany?: string;
  initialJobId?: string | null;
  jobs?: CandidatePipelineJobOption[];
  interviewers: CandidateInterviewerOption[];
  existingInterviews: CandidateScheduledInterview[];
  isOpen: boolean;
  onClose: () => void;
  onSchedule?: (interviewData: CandidateScheduledInterview) => void | Promise<void>;
  onUpdate?: (interviewId: string, interviewData: CandidateScheduledInterview) => void | Promise<void>;
  editInterview?: CandidateScheduledInterview | null;
  onScheduledSuccess?: (message: string) => void;
}

export function ScheduleInterviewModal({
  candidate: fixedCandidate,
  candidateOptions,
  linkedJobLabel,
  linkedJobTitle,
  linkedJobCompany,
  initialJobId,
  jobs: jobsProp = [],
  interviewers,
  existingInterviews,
  isOpen,
  onClose,
  onSchedule,
  onUpdate,
  editInterview,
  onScheduledSuccess,
}: ScheduleInterviewModalProps) {
  const isStandaloneMode = getCachedOrgRecruitmentMode() === 'standalone';
  const [standaloneCandidateId, setStandaloneCandidateId] = useState('');
  const [interviewType, setInterviewType] = useState('');
  const [roundNumber, setRoundNumber] = useState(1);
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [duration, setDuration] = useState('');
  const [mode, setMode] = useState<'video' | 'in-person' | 'phone' | ''>('');
  const [meetingPlatform, setMeetingPlatform] = useState<'Google Meet' | 'Zoom' | null>(null);
  const [meetingLink, setMeetingLink] = useState('');
  const [generatingMeetingLink, setGeneratingMeetingLink] = useState(false);
  const [location, setLocation] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [interviewerSearch, setInterviewerSearch] = useState('');
  const [selectedInterviewers, setSelectedInterviewers] = useState<
    Array<{ id: string; name: string; role: 'Lead Interviewer' | 'Interviewer' | 'Observer' }>
  >([]);
  const [sendCandidateInvite, setSendCandidateInvite] = useState(true);
  const [sendInterviewerInvite, setSendInterviewerInvite] = useState(true);
  const [additionalNotes, setAdditionalNotes] = useState('');
  const [status, setStatus] = useState<'scheduled' | 'completed' | 'cancelled'>('scheduled');
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [submitting, setSubmitting] = useState(false);
  const [typeOpen, setTypeOpen] = useState(false);
  const [timeOpen, setTimeOpen] = useState(false);
  const [durationOpen, setDurationOpen] = useState(false);
  const [interviewerOpen, setInterviewerOpen] = useState(false);
  const [openRoleMenuId, setOpenRoleMenuId] = useState<string | null>(null);
  const [scheduleJobOptions, setScheduleJobOptions] = useState<CandidatePipelineJobOption[]>(jobsProp);
  const [clientOptions, setClientOptions] = useState<Array<{ id: string; companyName: string }>>([]);
  const [selectedJobId, setSelectedJobId] = useState('');
  const [selectedClientId, setSelectedClientId] = useState('');
  const [loadingScheduleJobs, setLoadingScheduleJobs] = useState(false);
  const [loadingClients, setLoadingClients] = useState(false);
  const [loadingClientContacts, setLoadingClientContacts] = useState(false);
  const [clientContactOptions, setClientContactOptions] = useState<ScheduleClientContactOption[]>([]);
  const [selectedClientContacts, setSelectedClientContacts] = useState<ScheduleClientContactOption[]>([]);
  const [clientContactSearch, setClientContactSearch] = useState('');
  const [clientContactOpen, setClientContactOpen] = useState(false);
  const [lineManagerOptions, setLineManagerOptions] = useState<CandidateInterviewerOption[]>([]);
  const [teamMemberOptions, setTeamMemberOptions] = useState<CandidateInterviewerOption[]>([]);
  const [loadingLineManagers, setLoadingLineManagers] = useState(false);
  const [loadingTeamMembers, setLoadingTeamMembers] = useState(false);
  const [workspaceClientName, setWorkspaceClientName] = useState('Your organization');
  const [workspaceClientId, setWorkspaceClientId] = useState('');
  const [fetchedCandidateInterviews, setFetchedCandidateInterviews] = useState<CandidateScheduledInterview[]>([]);
  const prevAutoPanelJobIdRef = useRef('');

  const typeRef = useRef<HTMLDivElement | null>(null);
  const timeRef = useRef<HTMLDivElement | null>(null);
  const durationRef = useRef<HTMLDivElement | null>(null);
  const interviewerRef = useRef<HTMLDivElement | null>(null);
  const roleMenuRef = useRef<HTMLDivElement | null>(null);
  const clientContactRef = useRef<HTMLDivElement | null>(null);

  const selectedJob = scheduleJobOptions.find((job) => job.id === selectedJobId);
  const selectedClient = clientOptions.find((client) => client.id === selectedClientId);

  // Standalone usage (e.g. /interviews page): pick the candidate here instead of
  // inheriting it from a profile drawer. When a fixed candidate is passed, the
  // picker stays hidden and `candidate` simply mirrors that prop.
  const allowCandidatePick =
    !fixedCandidate && Array.isArray(candidateOptions) && candidateOptions.length > 0;
  const candidate = useMemo(() => {
    if (fixedCandidate) return fixedCandidate;
    const picked = candidateOptions?.find((option) => option.id === standaloneCandidateId);
    if (!picked) return null;
    return {
      id: picked.id,
      name: picked.name,
      phone: picked.phone ?? null,
      stage: null,
      assignedJob: picked.assignedJob ?? null,
      assignedJobId: picked.assignedJobId ?? null,
    };
  }, [fixedCandidate, candidateOptions, standaloneCandidateId]);

  const interviewSlotDescriptors = useMemo(() => generateStandardInterviewSlotDescriptors(), []);
  const visibleTimeSlots = useMemo(
    () => filterInterviewSlotsForLocalDate(interviewSlotDescriptors, date).map((s) => s.label),
    [interviewSlotDescriptors, date]
  );
  const isEditingInterview = Boolean(editInterview);
  const minimumDate = getLocalDateInputMinToday();

  const relevantExistingInterviews = useMemo(() => {
    const merged = new Map<string, CandidateScheduledInterview>();
    for (const interview of [...existingInterviews, ...fetchedCandidateInterviews]) {
      if (!interview?.id) continue;
      merged.set(interview.id, interview);
    }
    if (!candidate?.id) return [];
    return Array.from(merged.values()).filter((interview) => {
      if (interview.candidateId !== candidate.id) return false;
      if (selectedJobId && interview.jobId && interview.jobId !== selectedJobId) return false;
      return isActiveScheduledInterview(interview.status);
    });
  }, [
    candidate?.id,
    existingInterviews,
    fetchedCandidateInterviews,
    selectedJobId,
  ]);

  const panelMemberOptions = useMemo(() => {
    if (!isStandaloneMode) return interviewers;

    const byId = new Map<string, CandidateInterviewerOption>();
    for (const member of teamMemberOptions) {
      if (member.id) byId.set(member.id, member);
    }
    for (const member of interviewers) {
      if (member.id && !byId.has(member.id)) byId.set(member.id, member);
    }
    for (const manager of lineManagerOptions) {
      if (!manager.id) continue;
      const existing = byId.get(manager.id);
      byId.set(manager.id, {
        ...(existing || manager),
        role: 'Line Manager',
      });
    }

    if (byId.size === 0) return interviewers;
    return Array.from(byId.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [interviewers, isStandaloneMode, lineManagerOptions, teamMemberOptions]);

  const loadingPanelMembers = isStandaloneMode && (loadingLineManagers || loadingTeamMembers);

  useEffect(() => {
    if (!isOpen) {
      prevAutoPanelJobIdRef.current = '';
      setInterviewType('');
      setRoundNumber((existingInterviews?.length || 0) + 1);
      setDate('');
      setTime('');
      setDuration('');
      setMode('');
      setMeetingPlatform(null);
      setMeetingLink('');
      setLocation('');
      setPhoneNumber(candidate?.phone || '');
      setInterviewerSearch('');
      setSelectedInterviewers([]);
      setSendCandidateInvite(true);
      setSendInterviewerInvite(true);
      setAdditionalNotes('');
      setStatus('scheduled');
      setErrors({});
      setSubmitting(false);
      setTypeOpen(false);
      setTimeOpen(false);
      setDurationOpen(false);
      setInterviewerOpen(false);
      setOpenRoleMenuId(null);
      setSelectedJobId('');
      setSelectedClientId('');
      setClientContactOptions([]);
      setSelectedClientContacts([]);
      setClientContactSearch('');
      setClientContactOpen(false);
      setStandaloneCandidateId('');
      setFetchedCandidateInterviews([]);
    }
  }, [candidate?.phone, existingInterviews?.length, isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;

    let cancelled = false;
    void (async () => {
      setLoadingScheduleJobs(true);
      setLoadingClients(true);
      if (isStandaloneMode) {
        setLoadingLineManagers(true);
        setLoadingTeamMembers(true);
      }
      try {
        if (isStandaloneMode) {
          const [jobsRes, workspaceRes, lineManagers, teamMembers] = await Promise.all([
            apiGetJobs({ page: 1, limit: 500 }),
            apiGetWorkspaceClient(),
            getLineManagersForJobPicker(),
            getAllTeamMembersForAssign(),
          ]);
          if (cancelled) return;

          const workspaceClient = workspaceRes?.data?.workspaceClient;
          const wsId = workspaceClient?.id ? String(workspaceClient.id) : '';
          const wsName = workspaceClient?.companyName || 'Your organization';
          setWorkspaceClientId(wsId);
          setWorkspaceClientName(wsName);
          if (wsId) {
            setClientOptions([{ id: wsId, companyName: wsName }]);
            setSelectedClientId(wsId);
          } else {
            setClientOptions([]);
          }

          const allJobs = mapJobsToPipelineOptions(parseJobsListFromResponse(jobsRes));
          const fetchedJobs = wsId ? allJobs.filter((job) => job.clientId === wsId) : allJobs;
          const byJobId = new Map<string, CandidatePipelineJobOption>();
          for (const job of [...jobsProp, ...fetchedJobs]) {
            if (job.id) byJobId.set(job.id, job);
          }
          setScheduleJobOptions(Array.from(byJobId.values()).sort((a, b) => a.title.localeCompare(b.title)));

          setLineManagerOptions(
            lineManagers
              .filter((manager) => manager.id)
              .map((manager) => ({
                id: String(manager.id),
                name: String(manager.name || manager.email || 'Line Manager').trim() || 'Line Manager',
                role: 'Line Manager',
                department: manager.department || null,
              }))
              .sort((a, b) => a.name.localeCompare(b.name)),
          );

          setTeamMemberOptions(
            teamMembersToBackendUsers(teamMembers)
              .filter((member) => member.id)
              .map((member) => ({
                id: String(member.id),
                name: String(member.name || member.email || 'Team member').trim() || 'Team member',
                role: member.role || null,
                department: member.department || null,
                avatar: member.avatar || null,
              }))
              .sort((a, b) => a.name.localeCompare(b.name)),
          );
        } else {
          const [jobsRes, clientsRes] = await Promise.all([
            apiGetJobs({ page: 1, limit: 500 }),
            apiGetClients({ page: 1, limit: 500 }),
          ]);
          if (cancelled) return;
          const fetchedJobs = mapJobsToPipelineOptions(parseJobsListFromResponse(jobsRes));
          const byJobId = new Map<string, CandidatePipelineJobOption>();
          for (const job of [...jobsProp, ...fetchedJobs]) {
            if (job.id) byJobId.set(job.id, job);
          }
          setScheduleJobOptions(Array.from(byJobId.values()).sort((a, b) => a.title.localeCompare(b.title)));

          const clients = parseClientsListFromResponse(clientsRes)
            .filter((c) => c.id && c.companyName)
            .map((c) => ({ id: String(c.id), companyName: String(c.companyName).trim() }))
            .sort((a, b) => a.companyName.localeCompare(b.companyName));
          setClientOptions(clients);
        }
      } catch (error) {
        console.error('Failed to load schedule interview options:', error);
        if (!cancelled) {
          setScheduleJobOptions(jobsProp);
        }
      } finally {
        if (!cancelled) {
          setLoadingScheduleJobs(false);
          setLoadingClients(false);
          if (isStandaloneMode) {
            setLoadingLineManagers(false);
            setLoadingTeamMembers(false);
          }
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isOpen, isStandaloneMode, jobsProp]);

  const applyDefaultJobSelection = useCallback(
    (jobId: string, clientId?: string | null) => {
      const normalizedJobId = String(jobId || '').trim();
      if (!normalizedJobId) return false;
      const job = scheduleJobOptions.find((item) => item.id === normalizedJobId);
      if (!job) return false;
      setSelectedJobId(normalizedJobId);
      const resolvedClientId = String(clientId || job.clientId || '').trim();
      if (resolvedClientId) {
        setSelectedClientId(resolvedClientId);
      }
      return true;
    },
    [scheduleJobOptions],
  );

  useEffect(() => {
    if (!isOpen || isEditingInterview || !allowCandidatePick) return;
    if (!standaloneCandidateId) {
      setSelectedJobId('');
      setSelectedClientId('');
      return;
    }

    const picked = candidateOptions?.find((option) => option.id === standaloneCandidateId);
    if (picked?.assignedJobId && applyDefaultJobSelection(picked.assignedJobId, picked.assignedClientId)) {
      if (picked.phone) setPhoneNumber(picked.phone);
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const raw = await apiGetCandidate(standaloneCandidateId);
        const data = extractApiData<BackendCandidate>(raw);
        if (cancelled || !data?.id) return;

        if (data.phone) setPhoneNumber(String(data.phone));

        const assignedJobId = String(data.assignedJobs?.[0] || '').trim();
        if (assignedJobId && applyDefaultJobSelection(assignedJobId)) {
          return;
        }

        const interviewRes = await apiGetInterviews({
          candidateId: standaloneCandidateId,
          limit: 20,
        });
        const rows = Array.isArray(interviewRes.data?.data) ? interviewRes.data.data : [];
        const latest = [...rows].sort(
          (a, b) =>
            new Date(b.scheduledAt || 0).getTime() - new Date(a.scheduledAt || 0).getTime(),
        )[0];
        if (!cancelled && latest?.job?.id) {
          applyDefaultJobSelection(
            latest.job.id,
            latest.client?.id || latest.job.client?.id || null,
          );
        }
      } catch {
        /* best effort — user can still pick job/client manually */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    allowCandidatePick,
    applyDefaultJobSelection,
    candidateOptions,
    isEditingInterview,
    isOpen,
    standaloneCandidateId,
  ]);

  useEffect(() => {
    if (!isOpen) return;
    const defaultJobId =
      editInterview?.jobId ||
      initialJobId ||
      candidate?.assignedJobId ||
      scheduleJobOptions.find((j) => j.title === linkedJobTitle)?.id ||
      '';
    if (defaultJobId) {
      setSelectedJobId(String(defaultJobId));
    }
  }, [
    isOpen,
    editInterview?.jobId,
    initialJobId,
    candidate?.assignedJobId,
    candidate?.id,
    linkedJobTitle,
    scheduleJobOptions,
  ]);

  useEffect(() => {
    if (!selectedJobId) return;
    const job = scheduleJobOptions.find((item) => item.id === selectedJobId);
    if (job?.clientId) {
      setSelectedClientId(String(job.clientId));
    }
  }, [selectedJobId, scheduleJobOptions]);

  useEffect(() => {
    if (!isOpen || !selectedClientId || isStandaloneMode) {
      setClientContactOptions([]);
      return undefined;
    }

    let cancelled = false;
    void (async () => {
      try {
        setLoadingClientContacts(true);
        const res = await apiGetClient(selectedClientId);
        const client = (res as any).data?.data || (res as any).data || res;
        const contacts = Array.isArray(client?.contacts) ? client.contacts : [];
        if (cancelled) return;
        setClientContactOptions(
          contacts
            .filter((c: any) => c?.id)
            .map((c: any) => ({
              id: String(c.id),
              name: `${String(c.firstName || '').trim()} ${String(c.lastName || '').trim()}`.trim() || 'Contact',
              designation: c.designation || null,
              department: c.department || null,
              email: c.email || null,
            }))
            .sort((a: ScheduleClientContactOption, b: ScheduleClientContactOption) =>
              a.name.localeCompare(b.name)
            )
        );
      } catch (error) {
        console.error('Failed to load client contacts:', error);
        if (!cancelled) setClientContactOptions([]);
      } finally {
        if (!cancelled) setLoadingClientContacts(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isOpen, isStandaloneMode, selectedClientId]);

  useEffect(() => {
    if (!isOpen || !isStandaloneMode) return;
    const job = selectedJobId ? scheduleJobOptions.find((item) => item.id === selectedJobId) : null;
    const managerId = job?.managerId ? String(job.managerId) : '';
    if (!managerId) return;

    setLineManagerOptions((prev) => {
      if (prev.some((item) => item.id === managerId)) return prev;
      const managerName = job?.managerName || 'Line Manager';
      return [
        ...prev,
        {
          id: managerId,
          name: managerName,
          role: 'Line Manager',
          department: null,
        },
      ].sort((a, b) => a.name.localeCompare(b.name));
    });

    const managerName = job?.managerName || 'Line Manager';
    setTeamMemberOptions((prev) => {
      if (prev.some((item) => item.id === managerId)) return prev;
      return [
        ...prev,
        {
          id: managerId,
          name: managerName,
          role: 'Line Manager',
          department: null,
        },
      ].sort((a, b) => a.name.localeCompare(b.name));
    });
  }, [isOpen, isStandaloneMode, selectedJobId, scheduleJobOptions]);

  useEffect(() => {
    if (!isOpen || !isStandaloneMode || isEditingInterview) return;
    if (!lineManagerOptions.length) return;

    const jobChanged = prevAutoPanelJobIdRef.current !== selectedJobId;
    prevAutoPanelJobIdRef.current = selectedJobId;

    const job = selectedJobId ? scheduleJobOptions.find((item) => item.id === selectedJobId) : null;
    const preferredManagerId = job?.managerId;
    const manager =
      (preferredManagerId && lineManagerOptions.find((item) => item.id === preferredManagerId)) ||
      lineManagerOptions[0];
    if (!manager) return;

    setSelectedInterviewers((prev) => {
      if (prev.length === 0) {
        return [{ id: manager.id, name: manager.name, role: 'Lead Interviewer' }];
      }
      if (jobChanged) {
        const extras = prev.filter((item) => item.id !== manager.id && item.role !== 'Lead Interviewer');
        return [{ id: manager.id, name: manager.name, role: 'Lead Interviewer' }, ...extras];
      }
      return prev;
    });
  }, [
    isOpen,
    isStandaloneMode,
    isEditingInterview,
    lineManagerOptions,
    selectedJobId,
    scheduleJobOptions,
  ]);

  useEffect(() => {
    if (!isOpen) return;
    if (!editInterview) return;
    setInterviewType(editInterview.type || '');
    setRoundNumber(editInterview.round || 1);
    setDate(editInterview.date || '');
    setTime(editInterview.time || '');
    setDuration(editInterview.duration || '');
    setMode((editInterview.mode as any) || '');
    setMeetingPlatform(editInterview.platform || null);
    setMeetingLink(editInterview.meetingLink || '');
    setLocation(editInterview.location || '');
    setPhoneNumber(editInterview.phoneNumber || candidate?.phone || '');
    setSelectedInterviewers(editInterview.interviewers || []);
    setSelectedClientContacts(
      (editInterview.clientPanel || []).map((contact) => ({
        id: contact.id,
        name: contact.name,
        designation: contact.designation || null,
        department: null,
        email: null,
      }))
    );
    if (editInterview.clientId) setSelectedClientId(String(editInterview.clientId));
    if (editInterview.jobId) setSelectedJobId(String(editInterview.jobId));
    setSendCandidateInvite(Boolean(editInterview.sendCandidateInvite));
    setSendInterviewerInvite(Boolean(editInterview.sendInterviewerInvite));
    setAdditionalNotes(extractEditableInterviewNotes(editInterview.notes));
    setStatus(editInterview.status || 'scheduled');
  }, [editInterview, isOpen, candidate?.phone]);

  useEffect(() => {
    if (!isOpen || !candidate?.id || isEditingInterview) {
      if (!isOpen) setFetchedCandidateInterviews([]);
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const response = await apiGetInterviews({
          candidateId: candidate.id,
          ...(selectedJobId ? { jobId: selectedJobId } : {}),
          limit: 100,
        });
        const rows = Array.isArray(response.data?.data) ? response.data.data : [];
        if (cancelled) return;
        const sorted = [...rows].sort(
          (a, b) =>
            new Date(a.scheduledAt || 0).getTime() - new Date(b.scheduledAt || 0).getTime(),
        );
        setFetchedCandidateInterviews(
          sorted.map((item, index) => mapInterviewListItemToScheduled(item, index + 1)),
        );
      } catch {
        if (!cancelled) setFetchedCandidateInterviews([]);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [candidate?.id, isEditingInterview, isOpen, selectedJobId]);

  useEffect(() => {
    if (!isOpen || isEditingInterview) return;
    setRoundNumber(
      computeNextInterviewRound(relevantExistingInterviews, candidate?.id || '', selectedJobId || null),
    );
    setPhoneNumber(candidate?.phone || '');
  }, [
    candidate?.id,
    candidate?.phone,
    isEditingInterview,
    isOpen,
    relevantExistingInterviews,
    selectedJobId,
  ]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const handleOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!typeRef.current?.contains(target)) setTypeOpen(false);
      if (!timeRef.current?.contains(target)) setTimeOpen(false);
      if (!durationRef.current?.contains(target)) setDurationOpen(false);
      if (!interviewerRef.current?.contains(target)) setInterviewerOpen(false);
      if (!clientContactRef.current?.contains(target)) setClientContactOpen(false);
      if (!roleMenuRef.current?.contains(target)) setOpenRoleMenuId(null);
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [isOpen]);

  const filteredInterviewers = useMemo(() => {
    const query = interviewerSearch.trim().toLowerCase();
    if (!query) return panelMemberOptions;
    return panelMemberOptions.filter(
      (person) =>
        person.name.toLowerCase().includes(query) ||
        (person.role || '').toLowerCase().includes(query) ||
        (person.department || '').toLowerCase().includes(query)
    );
  }, [interviewerSearch, panelMemberOptions]);

  const filteredClientContacts = useMemo(() => {
    const query = clientContactSearch.trim().toLowerCase();
    if (!query) return clientContactOptions;
    return clientContactOptions.filter(
      (person) =>
        person.name.toLowerCase().includes(query) ||
        (person.designation || '').toLowerCase().includes(query) ||
        (person.department || '').toLowerCase().includes(query) ||
        (person.email || '').toLowerCase().includes(query)
    );
  }, [clientContactOptions, clientContactSearch]);

  const jobsForClient = useMemo(() => {
    if (!selectedClientId) return scheduleJobOptions;
    return scheduleJobOptions.filter((job) => job.clientId === selectedClientId);
  }, [scheduleJobOptions, selectedClientId]);

  useEffect(() => {
    if (!selectedClientId || !selectedJobId) return;
    if (!jobsForClient.some((job) => job.id === selectedJobId)) {
      setSelectedJobId('');
    }
  }, [selectedClientId, selectedJobId, jobsForClient]);

  const isInterviewerBooked = (interviewerId: string) =>
    Boolean(date && time && relevantExistingInterviews.some((interview) => interview.date === date && interview.time === time && interview.interviewers.some((item) => item.id === interviewerId)));

  const validate = () => {
    const nextErrors: Record<string, string | undefined> = {};
    if (allowCandidatePick && !standaloneCandidateId) nextErrors.candidate = 'Candidate is required';
    if (!status) nextErrors.status = 'Status is required';
    if (!interviewType) nextErrors.interviewType = 'Interview type is required';
    if (!roundNumber || roundNumber < 1) nextErrors.roundNumber = 'Round number is required';
    if (!date) nextErrors.date = 'Date is required';
    if (!time) nextErrors.time = 'Time is required';
    if (!duration) nextErrors.duration = 'Duration is required';
    if (!mode) nextErrors.mode = 'Interview mode is required';
    if (!selectedJobId) {
      nextErrors.linkedJob = 'Linked job is required';
    }
    if (selectedInterviewers.length === 0) {
      nextErrors.interviewers = isStandaloneMode
        ? 'Select at least one panel member'
        : 'Select at least one internal interviewer';
    }
    if (mode === 'video' && !meetingPlatform) nextErrors.modeField = 'Select Google Meet or Zoom';
    if (mode === 'video' && !meetingLink.trim()) nextErrors.modeField = 'Meeting link is required';
    if (mode === 'in-person' && !location.trim()) nextErrors.modeField = 'Location is required';
    if (mode === 'phone' && !phoneNumber.trim()) nextErrors.modeField = 'Phone number is required';
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const isFormValid =
    (!allowCandidatePick || Boolean(standaloneCandidateId)) &&
    Boolean(status && interviewType && roundNumber >= 1 && date && time && duration && mode) &&
    Boolean(selectedJobId) &&
    selectedInterviewers.length > 0 &&
    (mode !== 'video' || Boolean(meetingPlatform)) &&
    (mode !== 'video' || Boolean(meetingLink.trim())) &&
    (mode !== 'in-person' || Boolean(location.trim())) &&
    (mode !== 'phone' || Boolean(phoneNumber.trim()));

  const handleGenerateMeetingLink = async (platform: 'Google Meet' | 'Zoom') => {
    if (!candidate) return;
    if (!date || !time || !duration) {
      setErrors((prev) => ({
        ...prev,
        modeField: 'Select date, time, and duration before generating the meeting link',
      }));
      return;
    }

    try {
      setGeneratingMeetingLink(true);
      setMeetingPlatform(platform);
      const response = await apiGenerateCandidateInterviewMeetingLink(candidate.id, {
        jobId: selectedJobId || candidate.assignedJobId || null,
        date,
        time,
        duration,
        mode: 'video',
        platform: platform === 'Google Meet' ? 'GOOGLE_MEET' : 'ZOOM',
        interviewers: selectedInterviewers,
        notes: additionalNotes.trim() || undefined,
      });
      setMeetingLink(response.meetingLink || '');
      setErrors((prev) => ({ ...prev, modeField: undefined }));
    } catch (error: any) {
      setMeetingLink('');
      setErrors((prev) => ({
        ...prev,
        modeField: error?.message || 'Unable to generate meeting link',
      }));
    } finally {
      setGeneratingMeetingLink(false);
    }
  };

  const handleToggleInterviewer = (person: CandidateInterviewerOption) => {
    setSelectedInterviewers((prev) => {
      const exists = prev.some((item) => item.id === person.id);
      if (exists) {
        return prev.filter((item) => item.id !== person.id);
      }
      return [...prev, { id: person.id, name: person.name, role: 'Interviewer' }];
    });
    setErrors((prev) => ({ ...prev, interviewers: undefined }));
  };

  const handleToggleClientContact = (person: ScheduleClientContactOption) => {
    setSelectedClientContacts((prev) => {
      const exists = prev.some((item) => item.id === person.id);
      if (exists) return prev.filter((item) => item.id !== person.id);
      return [...prev, person];
    });
    setErrors((prev) => ({ ...prev, interviewers: undefined }));
  };

  const handleSchedule = async () => {
    if (!candidate || !validate()) return;

    const clientPanelNote =
      selectedClientContacts.length > 0
        ? `Client panel: ${selectedClientContacts
            .map((c) => `${c.name}${c.designation ? ` (${c.designation})` : ''}`)
            .join(', ')}`
        : '';
    const userFacingNotes = [additionalNotes.trim(), clientPanelNote].filter(Boolean).join('\n');
    const mergedNotes = editInterview?.id
      ? mergeEditableInterviewNotesWithAudit(userFacingNotes, editInterview.notes)
      : userFacingNotes;

    const payload: CandidateScheduledInterview = {
      id: editInterview?.id || `interview-${Date.now()}`,
      type: interviewType,
      round: roundNumber,
      date,
      time,
      duration,
      mode: mode as 'video' | 'in-person' | 'phone',
      platform: mode === 'video' ? meetingPlatform : null,
      meetingLink: mode === 'video' ? meetingLink.trim() : null,
      location: mode === 'in-person' ? location.trim() : null,
      phoneNumber: mode === 'phone' ? phoneNumber.trim() : null,
      interviewers: selectedInterviewers.map((item) => ({
        id: item.id,
        name: item.name,
        role: item.role,
      })),
      clientId: selectedClientId || workspaceClientId || selectedJob?.clientId || null,
      clientName:
        selectedClient?.companyName ||
        workspaceClientName ||
        selectedJob?.clientName ||
        linkedJobCompany ||
        null,
      clientPanel: selectedClientContacts.map((item) => ({
        id: item.id,
        name: item.name,
        role: 'Client Representative',
        designation: item.designation || null,
      })),
      jobId: selectedJobId || null,
      jobTitle: selectedJob?.title || linkedJobTitle || candidate.assignedJob || null,
      candidateId: candidate.id,
      notes: mergedNotes,
      sendCandidateInvite,
      sendInterviewerInvite,
      status,
    };

    try {
      setSubmitting(true);
      if (editInterview?.id) {
        await Promise.resolve(onUpdate?.(editInterview.id, payload));
      } else {
        await Promise.resolve(onSchedule?.(payload));
      }
      const prettyDate = formatDateDMY(new Date(`${date}T00:00:00`));
      onScheduledSuccess?.(editInterview?.id ? `Interview updated (${status})` : `Interview scheduled for ${prettyDate} at ${time}`);
      onClose();
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Failed to schedule interview. Please try again.';
      void requestError(message, { title: 'Interview conflict' });
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen ? (
        <>
          <motion.div
            className="fixed inset-0 z-[70] bg-slate-950/45"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className="fixed inset-x-0 bottom-0 top-14 z-[80] md:inset-0 md:flex md:items-center md:justify-center md:p-4"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
          >
            <div className="flex h-full w-full flex-col rounded-t-3xl border border-slate-200 bg-white shadow-2xl md:h-auto md:max-h-[90vh] md:max-w-[560px] md:rounded-3xl">
              <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
                <h3 className="text-lg font-semibold text-slate-900">{editInterview?.id ? 'Edit Interview' : 'Schedule Interview'}</h3>
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-xl p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5">
                <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <h4 className="text-sm font-semibold text-slate-900">Interview Details</h4>
                  <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                    {allowCandidatePick ? (
                      <div className="sm:col-span-2">
                        <label className="mb-2 block text-sm font-medium text-slate-700">
                          Candidate <span className="text-red-500">*</span>
                        </label>
                        <select
                          value={standaloneCandidateId}
                          onChange={(e) => {
                            setStandaloneCandidateId(e.target.value);
                            setErrors((prev) => ({ ...prev, candidate: undefined }));
                          }}
                          className={`w-full rounded-xl border bg-white px-3 py-2.5 text-sm text-slate-700 outline-none ${
                            errors.candidate ? 'border-red-300' : 'border-slate-200'
                          } focus:border-blue-400 focus:ring-2 focus:ring-blue-100`}
                        >
                          <option value="">Select candidate</option>
                          {candidateOptions?.map((option) => (
                            <option key={option.id} value={option.id}>
                              {option.name}
                            </option>
                          ))}
                        </select>
                        {errors.candidate ? (
                          <p className="mt-1 text-xs text-red-600">{errors.candidate}</p>
                        ) : null}
                      </div>
                    ) : null}
                    <div className="sm:col-span-2">
                      <label className="mb-2 block text-sm font-medium text-slate-700">
                        Status <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={status}
                        onChange={(e) => setStatus(e.target.value as any)}
                        className={`w-full rounded-xl border bg-white px-3 py-2.5 text-sm text-slate-700 outline-none ${
                          errors.status ? 'border-red-300' : 'border-slate-200'
                        } focus:border-blue-400 focus:ring-2 focus:ring-blue-100`}
                      >
                        <option value="scheduled">Scheduled</option>
                        <option value="completed">Completed</option>
                        <option value="cancelled">Cancelled</option>
                      </select>
                      {errors.status ? <p className="mt-1 text-xs text-red-600">{errors.status}</p> : null}
                    </div>
                    <div className="sm:col-span-2">
                      <label className="mb-2 block text-sm font-medium text-slate-700">
                        Interview Type <span className="text-red-500">*</span>
                      </label>
                      <div className="relative" ref={typeRef}>
                        <button
                          type="button"
                          onClick={() => setTypeOpen((prev) => !prev)}
                          className={`flex w-full items-center justify-between rounded-xl border bg-white px-3 py-2.5 text-left text-sm ${
                            errors.interviewType ? 'border-red-300' : 'border-slate-200'
                          }`}
                        >
                          <span className={interviewType ? 'text-slate-700' : 'text-slate-400'}>
                            {interviewType || 'Select interview type'}
                          </span>
                          <ChevronDown size={16} className="text-slate-400" />
                        </button>
                        {typeOpen ? (
                          <div className="absolute left-0 right-0 top-12 z-20 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
                            {INTERVIEW_TYPES.map((option) => (
                              <button
                                key={option}
                                type="button"
                                onClick={() => {
                                  setInterviewType(option);
                                  setTypeOpen(false);
                                  setErrors((prev) => ({ ...prev, interviewType: undefined }));
                                }}
                                className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm hover:bg-slate-50"
                              >
                                <span>{option}</span>
                                {interviewType === option ? <Check size={15} className="text-blue-600" /> : null}
                              </button>
                            ))}
                          </div>
                        ) : null}
                      </div>
                      {errors.interviewType ? <p className="mt-1 text-xs text-red-600">{errors.interviewType}</p> : null}
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-700">
                        Round Number <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        min={1}
                        value={roundNumber}
                        onChange={(e) => {
                          const nextValue = Math.max(1, Number(e.target.value) || 1);
                          setRoundNumber(nextValue);
                          setErrors((prev) => ({ ...prev, roundNumber: undefined }));
                        }}
                        className={`w-full rounded-xl border bg-white px-3 py-2.5 text-sm text-slate-700 outline-none ${
                          errors.roundNumber ? 'border-red-300' : 'border-slate-200'
                        } focus:border-blue-400 focus:ring-2 focus:ring-blue-100`}
                      />
                      {errors.roundNumber ? <p className="mt-1 text-xs text-red-600">{errors.roundNumber}</p> : null}
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-700">
                        Date <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="date"
                        min={isEditingInterview ? undefined : minimumDate}
                        value={date}
                        onChange={(e) => {
                          const raw = e.target.value;
                          const next = isEditingInterview ? raw : clampDateToMinLocal(raw, minimumDate);
                          setDate(next);
                          const allowed = filterInterviewSlotsForLocalDate(interviewSlotDescriptors, next).map(
                            (s) => s.label
                          );
                          setTime((prev) => (prev && allowed.includes(prev) ? prev : ''));
                          if (mode === 'video') {
                            setMeetingLink('');
                          }
                          setErrors((prev) => ({ ...prev, date: undefined }));
                        }}
                        className={`w-full rounded-xl border bg-white px-3 py-2.5 text-sm text-slate-700 outline-none ${
                          errors.date ? 'border-red-300' : 'border-slate-200'
                        } focus:border-blue-400 focus:ring-2 focus:ring-blue-100`}
                      />
                      {errors.date ? <p className="mt-1 text-xs text-red-600">{errors.date}</p> : null}
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-700">
                        Time <span className="text-red-500">*</span>
                      </label>
                      <div className="relative" ref={timeRef}>
                        <button
                          type="button"
                          onClick={() => setTimeOpen((prev) => !prev)}
                          className={`flex w-full items-center justify-between rounded-xl border bg-white px-3 py-2.5 text-left text-sm ${
                            errors.time ? 'border-red-300' : 'border-slate-200'
                          }`}
                        >
                          <span className={time ? 'text-slate-700' : 'text-slate-400'}>{time || 'Select time'}</span>
                          <ChevronDown size={16} className="text-slate-400" />
                        </button>
                        {timeOpen ? (
                          <div className="absolute left-0 right-0 top-12 z-20 max-h-56 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
                            {visibleTimeSlots.map((slot) => (
                              <button
                                key={slot}
                                type="button"
                                onClick={() => {
                                  setTime(slot);
                                  if (mode === 'video') {
                                    setMeetingLink('');
                                  }
                                  setTimeOpen(false);
                                  setErrors((prev) => ({ ...prev, time: undefined }));
                                }}
                                className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm hover:bg-slate-50"
                              >
                                <span>{slot}</span>
                                {time === slot ? <Check size={15} className="text-blue-600" /> : null}
                              </button>
                            ))}
                          </div>
                        ) : null}
                      </div>
                      {errors.time ? <p className="mt-1 text-xs text-red-600">{errors.time}</p> : null}
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-700">
                        Duration <span className="text-red-500">*</span>
                      </label>
                      <div className="relative" ref={durationRef}>
                        <button
                          type="button"
                          onClick={() => setDurationOpen((prev) => !prev)}
                          className={`flex w-full items-center justify-between rounded-xl border bg-white px-3 py-2.5 text-left text-sm ${
                            errors.duration ? 'border-red-300' : 'border-slate-200'
                          }`}
                        >
                          <span className={duration ? 'text-slate-700' : 'text-slate-400'}>
                            {duration || 'Select duration'}
                          </span>
                          <ChevronDown size={16} className="text-slate-400" />
                        </button>
                        {durationOpen ? (
                          <div className="absolute left-0 right-0 top-12 z-20 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
                            {INTERVIEW_DURATIONS.map((option) => (
                              <button
                                key={option}
                                type="button"
                                onClick={() => {
                                  setDuration(option);
                                  if (mode === 'video') {
                                    setMeetingLink('');
                                  }
                                  setDurationOpen(false);
                                  setErrors((prev) => ({ ...prev, duration: undefined }));
                                }}
                                className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm hover:bg-slate-50"
                              >
                                <span>{option}</span>
                                {duration === option ? <Check size={15} className="text-blue-600" /> : null}
                              </button>
                            ))}
                          </div>
                        ) : null}
                      </div>
                      {errors.duration ? <p className="mt-1 text-xs text-red-600">{errors.duration}</p> : null}
                    </div>

                    <div className="sm:col-span-2">
                      <label className="mb-2 block text-sm font-medium text-slate-700">
                        Interview Mode <span className="text-red-500">*</span>
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {[
                          { value: 'video', label: 'Video Call', icon: Video },
                          { value: 'in-person', label: 'In Person', icon: MapPin },
                          { value: 'phone', label: 'Phone Call', icon: Phone },
                        ].map(({ value, label, icon: Icon }) => (
                          <button
                            key={value}
                            type="button"
                            onClick={() => {
                              setMode(value as 'video' | 'in-person' | 'phone');
                              if (value !== 'video') {
                                setMeetingPlatform(null);
                                setMeetingLink('');
                              }
                              setErrors((prev) => ({ ...prev, mode: undefined, modeField: undefined }));
                            }}
                            className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium ${
                              mode === value
                                ? 'border-blue-200 bg-blue-50 text-blue-700'
                                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                            }`}
                          >
                            <Icon size={16} />
                            {label}
                          </button>
                        ))}
                      </div>
                      {errors.mode ? <p className="mt-1 text-xs text-red-600">{errors.mode}</p> : null}
                    </div>

                    {mode === 'video' ? (
                      <div className="sm:col-span-2">
                        <label className="mb-2 block text-sm font-medium text-slate-700">
                          Meeting Platform <span className="text-red-500">*</span>
                        </label>
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                          {(['Google Meet', 'Zoom'] as const).map((platform) => (
                            <button
                              key={platform}
                              type="button"
                              onClick={() => void handleGenerateMeetingLink(platform)}
                              disabled={generatingMeetingLink}
                              className={`rounded-xl border px-4 py-3 text-left text-sm ${
                                meetingPlatform === platform
                                  ? 'border-blue-200 bg-blue-50 text-blue-700'
                                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                              } disabled:cursor-not-allowed disabled:opacity-60`}
                            >
                              <span className="block font-medium">{platform}</span>
                              <span className="mt-1 block text-xs text-slate-500">
                                {generatingMeetingLink && meetingPlatform === platform
                                  ? 'Generating valid link...'
                                  : `Generate a live ${platform} meeting link`}
                              </span>
                            </button>
                          ))}
                        </div>
                        <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700">
                          {meetingLink ? (
                            <a href={meetingLink} target="_blank" rel="noreferrer" className="break-all text-blue-700 underline">
                              {meetingLink}
                            </a>
                          ) : (
                            <span className="text-slate-500">Choose Google Meet or Zoom to generate the meeting link.</span>
                          )}
                        </div>
                        {errors.modeField ? <p className="mt-1 text-xs text-red-600">{errors.modeField}</p> : null}
                      </div>
                    ) : null}

                    {mode === 'in-person' ? (
                      <div className="sm:col-span-2">
                        <label className="mb-2 block text-sm font-medium text-slate-700">
                          Location / Office Address <span className="text-red-500">*</span>
                        </label>
                        <input
                          value={location}
                          onChange={(e) => {
                            setLocation(e.target.value);
                            setErrors((prev) => ({ ...prev, modeField: undefined }));
                          }}
                          placeholder="Enter office address"
                          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                        />
                        {errors.modeField ? <p className="mt-1 text-xs text-red-600">{errors.modeField}</p> : null}
                      </div>
                    ) : null}

                    {mode === 'phone' ? (
                      <div className="sm:col-span-2">
                        <label className="mb-2 block text-sm font-medium text-slate-700">
                          Phone Number <span className="text-red-500">*</span>
                        </label>
                        <input
                          value={phoneNumber}
                          onChange={(e) => {
                            setPhoneNumber(e.target.value);
                            setErrors((prev) => ({ ...prev, modeField: undefined }));
                          }}
                          placeholder="Enter phone number"
                          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                        />
                        {errors.modeField ? <p className="mt-1 text-xs text-red-600">{errors.modeField}</p> : null}
                      </div>
                    ) : null}

                    <div className={isStandaloneMode ? 'sm:col-span-2' : ''}>
                      <label className="mb-2 block text-sm font-medium text-slate-700">
                        Linked Job <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={selectedJobId}
                        onChange={(e) => {
                          setSelectedJobId(e.target.value);
                          setErrors((prev) => ({ ...prev, linkedJob: undefined }));
                        }}
                        disabled={loadingScheduleJobs || jobsForClient.length === 0}
                        className={`w-full rounded-xl border bg-white px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 ${
                          errors.linkedJob ? 'border-red-300' : 'border-slate-200'
                        }`}
                      >
                        <option value="">
                          {loadingScheduleJobs
                            ? 'Loading jobs...'
                            : jobsForClient.length === 0
                              ? 'No jobs available'
                              : 'Select job'}
                        </option>
                        {jobsForClient.map((job) => (
                          <option key={job.id} value={job.id}>
                            {job.title}
                            {job.department ? ` · ${job.department}` : ''}
                          </option>
                        ))}
                      </select>
                      {errors.linkedJob ? <p className="mt-1 text-xs text-red-600">{errors.linkedJob}</p> : null}
                    </div>
                    {!isStandaloneMode ? (
                      <div>
                        <label className="mb-2 block text-sm font-medium text-slate-700">Company / Client</label>
                        <select
                          value={selectedClientId}
                          onChange={(e) => {
                            setSelectedClientId(e.target.value);
                            setSelectedClientContacts([]);
                          }}
                          disabled={loadingClients || clientOptions.length === 0}
                          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                        >
                          <option value="">
                            {loadingClients ? 'Loading clients...' : 'Select client'}
                          </option>
                          {clientOptions.map((client) => (
                            <option key={client.id} value={client.id}>
                              {client.companyName}
                            </option>
                          ))}
                        </select>
                        {selectedClient ? (
                          <p className="mt-1 text-xs text-slate-500">
                            Jobs filtered to this client. Assign client contacts in the interview panel below.
                          </p>
                        ) : selectedJob?.clientName ? (
                          <p className="mt-1 text-xs text-slate-500">Client from job: {selectedJob.clientName}</p>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </section>

                <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <h4 className="text-sm font-semibold text-slate-900">
                    Interview Panel <span className="text-red-500">*</span>
                  </h4>
                  <p className="mt-1 text-sm text-slate-500">
                    {isStandaloneMode
                      ? "The job's line manager is selected by default. Search below to add more team members."
                      : 'Assign internal interviewers and/or client contacts from the selected company.'}
                  </p>
                  <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {isStandaloneMode ? 'Panel members' : 'Internal panel'}
                  </p>
                  <div className="relative mt-2" ref={interviewerRef}>
                    <button
                      type="button"
                      onClick={() => setInterviewerOpen((prev) => !prev)}
                      disabled={loadingPanelMembers}
                      className={`flex w-full items-center justify-between rounded-xl border bg-white px-3 py-2.5 text-left text-sm ${
                        errors.interviewers ? 'border-red-300' : 'border-slate-200'
                      } ${loadingPanelMembers ? 'cursor-not-allowed opacity-60' : ''}`}
                    >
                      <span className="text-slate-400">
                        {isStandaloneMode
                          ? loadingPanelMembers
                            ? 'Loading team members...'
                            : 'Search and assign team members'
                          : 'Search and assign interviewers'}
                      </span>
                      <ChevronDown size={16} className="text-slate-400" />
                    </button>
                    {interviewerOpen ? (
                      <div className="absolute left-0 right-0 top-12 z-20 rounded-2xl border border-slate-200 bg-white p-3 shadow-xl">
                        <input
                          value={interviewerSearch}
                          onChange={(e) => setInterviewerSearch(e.target.value)}
                          placeholder="Search by name, role, or department"
                          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                        />
                        <div className="mt-3 max-h-56 overflow-y-auto">
                          {filteredInterviewers.length === 0 ? (
                            <p className="px-3 py-2 text-sm text-slate-500">
                              {isStandaloneMode ? 'No team members available' : 'No interviewers available'}
                            </p>
                          ) : (
                            filteredInterviewers.map((person) => {
                            const selected = selectedInterviewers.some((item) => item.id === person.id);
                            return (
                              <button
                                key={person.id}
                                type="button"
                                onClick={() => handleToggleInterviewer(person)}
                                className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm ${
                                  selected ? 'bg-blue-50 text-blue-700' : 'text-slate-700 hover:bg-slate-50'
                                }`}
                              >
                                <span className="flex items-center gap-3">
                                  {person.avatar ? (
                                    <img src={person.avatar} alt={person.name} className="h-8 w-8 rounded-full object-cover" />
                                  ) : (
                                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-[10px] font-semibold text-blue-700">
                                      {getAvatarInitials(person.name)}
                                    </span>
                                  )}
                                  <span>
                                    <span className="block font-medium">{person.name}</span>
                                    <span className="block text-xs text-slate-500">
                                      {[person.role, person.department].filter(Boolean).join(' · ') || 'Team member'}
                                    </span>
                                  </span>
                                </span>
                                {selected ? <Check size={15} /> : null}
                              </button>
                            );
                          })
                          )}
                        </div>
                      </div>
                    ) : null}
                  </div>
                  {errors.interviewers ? <p className="mt-1 text-xs text-red-600">{errors.interviewers}</p> : null}

                  {!isStandaloneMode ? (
                    <>
                      <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Client representatives
                        {selectedClient ? ` · ${selectedClient.companyName}` : ''}
                      </p>
                      <div className="relative mt-2" ref={clientContactRef}>
                    <button
                      type="button"
                      onClick={() => {
                        if (!selectedClientId) return;
                        setClientContactOpen((prev) => !prev);
                      }}
                      disabled={!selectedClientId || loadingClientContacts}
                      className={`flex w-full items-center justify-between rounded-xl border bg-white px-3 py-2.5 text-left text-sm ${
                        !selectedClientId ? 'cursor-not-allowed opacity-60' : ''
                      } ${errors.interviewers ? 'border-red-300' : 'border-slate-200'}`}
                    >
                      <span className="text-slate-400">
                        {!selectedClientId
                          ? 'Select a client above first'
                          : loadingClientContacts
                            ? 'Loading client contacts...'
                            : 'Search and assign client contacts'}
                      </span>
                      <ChevronDown size={16} className="text-slate-400" />
                    </button>
                    {clientContactOpen && selectedClientId ? (
                      <div className="absolute left-0 right-0 top-12 z-20 rounded-2xl border border-slate-200 bg-white p-3 shadow-xl">
                        <input
                          value={clientContactSearch}
                          onChange={(e) => setClientContactSearch(e.target.value)}
                          placeholder="Search client contact"
                          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                        />
                        <div className="mt-3 max-h-56 overflow-y-auto">
                          {filteredClientContacts.length === 0 ? (
                            <p className="px-3 py-2 text-sm text-slate-500">No contacts for this client</p>
                          ) : (
                            filteredClientContacts.map((person) => {
                              const selected = selectedClientContacts.some((item) => item.id === person.id);
                              return (
                                <button
                                  key={person.id}
                                  type="button"
                                  onClick={() => handleToggleClientContact(person)}
                                  className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm ${
                                    selected ? 'bg-emerald-50 text-emerald-800' : 'text-slate-700 hover:bg-slate-50'
                                  }`}
                                >
                                  <span>
                                    <span className="block font-medium">{person.name}</span>
                                    <span className="block text-xs text-slate-500">
                                      {[person.designation, person.department].filter(Boolean).join(' · ') ||
                                        'Client contact'}
                                    </span>
                                  </span>
                                  {selected ? <Check size={15} /> : null}
                                </button>
                              );
                            })
                          )}
                        </div>
                      </div>
                    ) : null}
                  </div>
                    </>
                  ) : null}

                  {selectedInterviewers.length > 0 ? (
                    <div className="mt-4 flex flex-wrap gap-2" ref={roleMenuRef}>
                      {selectedInterviewers.map((person) => (
                        <div
                          key={person.id}
                          className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2"
                        >
                          {panelMemberOptions.find((item) => item.id === person.id)?.avatar ? (
                            <img
                              src={panelMemberOptions.find((item) => item.id === person.id)?.avatar || ''}
                              alt={person.name}
                              className="h-7 w-7 rounded-full object-cover"
                            />
                          ) : (
                            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-100 text-[10px] font-semibold text-blue-700">
                              {getAvatarInitials(person.name)}
                            </span>
                          )}
                          <span className="text-sm font-medium text-slate-700">{person.name}</span>

                          <div className="relative">
                            <button
                              type="button"
                              onClick={() => setOpenRoleMenuId((prev) => (prev === person.id ? null : person.id))}
                              className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700"
                            >
                              {person.role}
                              <ChevronDown size={12} />
                            </button>
                            {openRoleMenuId === person.id ? (
                              <div className="absolute left-0 top-9 z-20 min-w-[150px] rounded-2xl border border-slate-200 bg-white p-1 shadow-xl">
                                {INTERVIEW_PANEL_ROLES.map((roleOption) => (
                                  <button
                                    key={roleOption}
                                    type="button"
                                    onClick={() => {
                                      setSelectedInterviewers((prev) =>
                                        prev.map((item) =>
                                          item.id === person.id ? { ...item, role: roleOption } : item
                                        )
                                      );
                                      setOpenRoleMenuId(null);
                                    }}
                                    className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-xs text-slate-700 hover:bg-slate-50"
                                  >
                                    <span>{roleOption}</span>
                                    {person.role === roleOption ? <Check size={13} className="text-blue-600" /> : null}
                                  </button>
                                ))}
                              </div>
                            ) : null}
                          </div>

                          {isInterviewerBooked(person.id) ? (
                            <span
                              title="Already booked at this time"
                              className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-amber-50 text-amber-600"
                            >
                              <AlertTriangle size={14} />
                            </span>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  ) : null}

                  {!isStandaloneMode && selectedClientContacts.length > 0 ? (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {selectedClientContacts.map((person) => (
                        <div
                          key={`client-${person.id}`}
                          className="flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2"
                        >
                          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-100 text-[10px] font-semibold text-emerald-700">
                            {getAvatarInitials(person.name)}
                          </span>
                          <div className="min-w-0">
                            <span className="block text-sm font-medium text-slate-800">{person.name}</span>
                            <span className="block text-[10px] text-emerald-700">
                              {selectedClient?.companyName ? `${selectedClient.companyName} · Client` : 'Client'}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleToggleClientContact(person)}
                            className="ml-1 rounded-full p-1 text-slate-400 hover:bg-white hover:text-slate-600"
                            aria-label={`Remove ${person.name}`}
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </section>

                <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <h4 className="text-sm font-semibold text-slate-900">Notifications</h4>
                  <div className="mt-4 space-y-3">
                    <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3">
                      <div>
                        <p className="text-sm font-medium text-slate-800">Send calendar invite to candidate</p>
                        <p className="text-xs text-slate-500">Email with date, time, meeting link will be sent</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSendCandidateInvite((prev) => !prev)}
                        className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${
                          sendCandidateInvite ? 'bg-blue-600' : 'bg-slate-300'
                        }`}
                      >
                        <span
                          className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                            sendCandidateInvite ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>

                    <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3">
                      <div>
                        <p className="text-sm font-medium text-slate-800">Send calendar invite to interviewers</p>
                        <p className="text-xs text-slate-500">Panel members will receive Google Calendar invite</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSendInterviewerInvite((prev) => !prev)}
                        className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${
                          sendInterviewerInvite ? 'bg-blue-600' : 'bg-slate-300'
                        }`}
                      >
                        <span
                          className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                            sendInterviewerInvite ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-700">Additional Notes</label>
                      <textarea
                        value={additionalNotes}
                        onChange={(e) => setAdditionalNotes(e.target.value.slice(0, 500))}
                        rows={4}
                        placeholder="Any instructions for the panel or candidate..."
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                      />
                      <p className="mt-1 text-right text-xs text-slate-400">{additionalNotes.length}/500</p>
                    </div>
                  </div>
                </section>
              </div>

              <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-5 py-4">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSchedule}
                  disabled={!isFormValid || submitting}
                  className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting ? 'Scheduling...' : 'Confirm Schedule'}
                </button>
              </div>
            </div>
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>
  );
}

function mapJobsToPipelineOptions(
  backendJobs: Array<{
    id: string;
    title?: string | null;
    department?: string | null;
    client?: { id?: string; companyName?: string | null } | null;
    clientId?: string | null;
    manager?: { id?: string; name?: string | null } | null;
    managerId?: string | null;
  }>,
): CandidatePipelineJobOption[] {
  return backendJobs
    .filter((job) => job.id)
    .map((job) => ({
      id: String(job.id),
      title: String(job.title || 'Untitled job').trim() || 'Untitled job',
      department: job.department || job.client?.companyName || null,
      clientId: job.client?.id || job.clientId || null,
      clientName: job.client?.companyName || null,
      managerId: job.managerId || job.manager?.id || null,
      managerName: job.manager?.name || null,
    }))
    .sort((a, b) => a.title.localeCompare(b.title));
}

export function AddToPipelineModal({
  isOpen,
  candidate,
  jobs,
  recruiters,
  initialJobId,
  lockJobToInitial = false,
  onClose,
  onSubmit,
  onRemoveFromPipeline,
  onRequestReject,
}: AddToPipelineModalProps) {
  const [jobSearch, setJobSearch] = useState('');
  const [recruiterSearch, setRecruiterSearch] = useState('');
  const [pipelineJobOptions, setPipelineJobOptions] = useState<CandidatePipelineJobOption[]>(jobs);
  const [loadingJobs, setLoadingJobs] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState('');
  const [selectedStage, setSelectedStage] = useState('');
  const [stagePath, setStagePath] = useState<string[]>([]);
  const [stagePickerValue, setStagePickerValue] = useState('');
  const [selectedRecruiterId, setSelectedRecruiterId] = useState('');
  const [priority, setPriority] = useState<'High' | 'Medium' | 'Low'>('Medium');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<{ job?: string; stage?: string }>({});
  const [jobStageOptions, setJobStageOptions] = useState<string[]>([]);
  const [loadingJobStages, setLoadingJobStages] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [jobDropdownOpen, setJobDropdownOpen] = useState(false);
  const [stageDropdownOpen, setStageDropdownOpen] = useState(false);
  const [recruiterDropdownOpen, setRecruiterDropdownOpen] = useState(false);
  const [editingJobId, setEditingJobId] = useState<string | null>(null);
  const [recentlyUpdatedJobId, setRecentlyUpdatedJobId] = useState<string | null>(null);
  const [removing, setRemoving] = useState(false);
  const [addNewJobMode, setAddNewJobMode] = useState(false);

  const jobDropdownRef = useRef<HTMLDivElement | null>(null);
  const stageDropdownRef = useRef<HTMLDivElement | null>(null);
  const recruiterDropdownRef = useRef<HTMLDivElement | null>(null);
  const formSectionRef = useRef<HTMLDivElement | null>(null);
  const wasOpenRef = useRef(false);

  useEffect(() => {
    if (!isOpen) {
      wasOpenRef.current = false;
      setJobSearch('');
      setRecruiterSearch('');
      setSelectedJobId('');
      setSelectedStage('');
      setStagePath([]);
      setStagePickerValue('');
      setSelectedRecruiterId('');
      setPriority('Medium');
      setNotes('');
      setErrors({});
      setJobStageOptions([]);
      setLoadingJobStages(false);
      setSubmitting(false);
      setJobDropdownOpen(false);
      setStageDropdownOpen(false);
      setRecruiterDropdownOpen(false);
      setEditingJobId(null);
      setRecentlyUpdatedJobId(null);
      setRemoving(false);
      setAddNewJobMode(false);
      setPipelineJobOptions(jobs);
      setLoadingJobs(false);
      return;
    }

    if (wasOpenRef.current) return;
    wasOpenRef.current = true;

    setJobSearch('');
    setRecruiterSearch('');
    setPriority('Medium');
    setErrors({});
    setRecentlyUpdatedJobId(null);
    setJobDropdownOpen(false);
    setStageDropdownOpen(false);
    setRecruiterDropdownOpen(false);

    const pipelineRows = (candidate?.assignedJobs || [])
      .filter((row) => row.isPipelineEntry && String(row.title || '').trim())
      .sort((a, b) => {
        const aTime = a.movedAt ? new Date(a.movedAt).getTime() : 0;
        const bTime = b.movedAt ? new Date(b.movedAt).getTime() : 0;
        return bTime - aTime;
      });

    const scopedJobId = lockJobToInitial && initialJobId ? String(initialJobId) : '';

    if (scopedJobId) {
      const rowForJob = pipelineRows.find((row) => row.id && String(row.id) === scopedJobId);
      if (rowForJob) {
        setEditingJobId(scopedJobId);
        setSelectedJobId(scopedJobId);
        const entryStage = String(rowForJob.stage || '').trim();
        setSelectedStage(entryStage);
        setStagePath(entryStage ? [entryStage] : []);
        setNotes(String(rowForJob.notes || '').trim());
        setSelectedRecruiterId(candidate?.recruiterId || '');
        setAddNewJobMode(false);
        return;
      }
      setSelectedJobId(scopedJobId);
      setEditingJobId(null);
      setSelectedStage('');
      setStagePath([]);
      setNotes('');
      setSelectedRecruiterId(candidate?.recruiterId || '');
      setAddNewJobMode(true);
      return;
    }

    const preferred =
      pipelineRows.find((row) => row.id && candidate?.assignedJobId && row.id === candidate.assignedJobId) ||
      pipelineRows[0];

    if (preferred?.id) {
      setEditingJobId(String(preferred.id));
      const preferredStage = String(preferred.stage || '').trim();
      setSelectedJobId(String(preferred.id));
      setSelectedStage(preferredStage);
      setStagePath(preferredStage ? [preferredStage] : []);
      setNotes(String(preferred.notes || '').trim());
      setSelectedRecruiterId(candidate?.recruiterId || '');
      setAddNewJobMode(false);
      return;
    }

    setSelectedJobId('');
    setSelectedStage('');
    setStagePath([]);
    setSelectedRecruiterId(candidate?.recruiterId || '');
    setNotes('');
    setEditingJobId(null);
    setAddNewJobMode(true);
  }, [
    isOpen,
    jobs,
    candidate?.assignedJobs,
    candidate?.assignedJobId,
    candidate?.recruiterId,
    initialJobId,
    lockJobToInitial,
  ]);

  useEffect(() => {
    if (!isOpen) return undefined;

    let cancelled = false;
    const mergeJobLists = (...lists: CandidatePipelineJobOption[][]) => {
      const byId = new Map<string, CandidatePipelineJobOption>();
      for (const list of lists) {
        for (const job of list) {
          if (job.id) byId.set(job.id, job);
        }
      }
      return Array.from(byId.values()).sort((a, b) => a.title.localeCompare(b.title));
    };

    void (async () => {
      setLoadingJobs(true);
      try {
        const res = await apiGetJobs({ page: 1, limit: 500 });
        if (cancelled) return;
        const fetched = mapJobsToPipelineOptions(parseJobsListFromResponse(res));
        setPipelineJobOptions(mergeJobLists(jobs, fetched));
      } catch (error) {
        console.error('Failed to load jobs for pipeline modal:', error);
        if (!cancelled) {
          setPipelineJobOptions(mergeJobLists(jobs));
        }
      } finally {
        if (!cancelled) setLoadingJobs(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isOpen, jobs]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const onMouseDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!jobDropdownRef.current?.contains(target)) setJobDropdownOpen(false);
      if (!stageDropdownRef.current?.contains(target)) setStageDropdownOpen(false);
      if (!recruiterDropdownRef.current?.contains(target)) setRecruiterDropdownOpen(false);
    };
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [isOpen]);

  useEffect(() => {
    const loadJobStages = async () => {
      if (!isOpen || !selectedJobId) {
        setJobStageOptions([]);
        return;
      }

      try {
        setLoadingJobStages(true);
        const response = await apiGetJob(selectedJobId);
        const backendJob = (response as any).data?.data || (response as any).data || response;
        const stageNames: string[] = Array.isArray(backendJob?.pipelineStages)
          ? backendJob.pipelineStages
              .map((stage: any) => String(stage?.name || '').trim())
              .filter(Boolean)
          : [];

        const withRejected = stageNames.some((name) => isRejectedPipelineStage(name))
          ? stageNames
          : [...stageNames, PIPELINE_REJECTED_STAGE];
        setJobStageOptions(withRejected);
      } catch (error) {
        console.error('Failed to load pipeline stages for selected job:', error);
        setJobStageOptions([]);
      } finally {
        setLoadingJobStages(false);
      }
    };

    loadJobStages();
  }, [isOpen, selectedJobId]);

  useEffect(() => {
    if (!selectedJobId) {
      setSelectedStage('');
      setStagePath([]);
    }
  }, [selectedJobId]);

  const filteredJobs = useMemo(() => {
    const q = jobSearch.trim().toLowerCase();
    if (!q) return pipelineJobOptions;
    return pipelineJobOptions.filter(
      (job) =>
        job.title.toLowerCase().includes(q) ||
        (job.department || '').toLowerCase().includes(q)
    );
  }, [pipelineJobOptions, jobSearch]);

  const filteredRecruiters = useMemo(() => {
    const q = recruiterSearch.trim().toLowerCase();
    if (!q) return recruiters;
    return recruiters.filter((recruiter) => recruiter.name.toLowerCase().includes(q));
  }, [recruiters, recruiterSearch]);

  const selectedJob = pipelineJobOptions.find((job) => job.id === selectedJobId);
  const selectedRecruiter = recruiters.find((recruiter) => recruiter.id === selectedRecruiterId);

  type PipelineEntryRow = NonNullable<CandidateProfileDrawerData['assignedJobs']>[number];

  const existingPipelineEntries = useMemo(() => {
    const rows = candidate?.assignedJobs || [];
    return rows
      .filter((row) => row.isPipelineEntry && String(row.title || '').trim())
      .sort((a, b) => {
        const aTime = a.movedAt ? new Date(a.movedAt).getTime() : 0;
        const bTime = b.movedAt ? new Date(b.movedAt).getTime() : 0;
        return bTime - aTime;
      });
  }, [candidate?.assignedJobs]);

  const existingEntryForSelectedJob = useMemo(() => {
    if (!selectedJobId) return null;
    return (
      existingPipelineEntries.find((row) => row.id && String(row.id) === selectedJobId) || null
    );
  }, [existingPipelineEntries, selectedJobId]);

  const isUpdatingEntry = Boolean(existingEntryForSelectedJob);
  const isMoveMode = Boolean(editingJobId && isUpdatingEntry && !addNewJobMode);
  const currentStageOnEntry = String(existingEntryForSelectedJob?.stage || '').trim();
  const targetStage = stagePath[stagePath.length - 1] || selectedStage;
  const stageChanged =
    isMoveMode &&
    currentStageOnEntry &&
    targetStage &&
    targetStage !== currentStageOnEntry;

  const syncStageFromPath = (path: string[]) => {
    setStagePath(path);
    setSelectedStage(path[path.length - 1] || '');
  };

  const openRejectFlowForSelectedJob = () => {
    if (!candidate?.id || !onRequestReject) return false;
    if (!selectedJobId) {
      setErrors((prev) => ({ ...prev, job: 'Select a job before rejecting this candidate' }));
      return true;
    }
    onRequestReject({ candidateId: candidate.id, jobId: selectedJobId });
    return true;
  };

  const handleSelectStageFromDropdown = (stageName: string) => {
    if (!stageName) return;
    const normalized = stageName.trim();
    if (!normalized) return;
    if (isRejectedPipelineStage(normalized)) {
      openRejectFlowForSelectedJob();
      return;
    }
    const without = stagePath.filter((s) => s.toLowerCase() !== normalized.toLowerCase());
    syncStageFromPath([...without, normalized]);
    setErrors((prev) => ({ ...prev, stage: undefined }));
  };

  const handleRemoveStageFromPath = (index: number) => {
    const nextPath = stagePath.filter((_, i) => i !== index);
    syncStageFromPath(nextPath);
    setErrors((prev) => ({ ...prev, stage: undefined }));
  };

  const loadEntryIntoForm = (row: PipelineEntryRow) => {
    if (!row.id) return;
    const entryStage = String(row.stage || '').trim();
    setAddNewJobMode(false);
    setEditingJobId(String(row.id));
    setSelectedJobId(String(row.id));
    syncStageFromPath(entryStage ? [entryStage] : []);
    setNotes(String(row.notes || '').trim());
    setSelectedRecruiterId(candidate?.recruiterId || '');
    setErrors({});
    setRecentlyUpdatedJobId(null);
  };

  const startAddNewJob = () => {
    setAddNewJobMode(true);
    setEditingJobId(null);
    setSelectedJobId('');
    syncStageFromPath([]);
    setNotes('');
    setSelectedRecruiterId(candidate?.recruiterId || '');
    setErrors({});
    setRecentlyUpdatedJobId(null);
  };

  const handleRemoveFromPipeline = async () => {
    if (!candidate || !selectedJobId || !onRemoveFromPipeline) return;
    const jobTitle = existingEntryForSelectedJob?.title || selectedJob?.title || 'this job';
    const confirmed =
      typeof window === 'undefined'
        ? true
        : window.confirm(`Remove this candidate from the pipeline for ${jobTitle}?`);
    if (!confirmed) return;

    try {
      setRemoving(true);
      await Promise.resolve(
        onRemoveFromPipeline({ candidateId: candidate.id, jobId: selectedJobId })
      );
      if (typeof window !== 'undefined') {
        void requestSuccess('Removed from pipeline.');
      }
      const remaining = existingPipelineEntries.filter((row) => row.id !== selectedJobId);
      if (remaining[0]?.id) {
        loadEntryIntoForm(remaining[0]);
      } else {
        startAddNewJob();
      }
    } finally {
      setRemoving(false);
    }
  };

  const validate = () => {
    const nextErrors: { job?: string; stage?: string } = {};
    if (!selectedJobId) nextErrors.job = 'Job is required';
    if (!stagePath.length || !targetStage) nextErrors.stage = 'Select a pipeline stage';
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!candidate) return;
    if (!validate()) return;

    if (isRejectedPipelineStage(targetStage)) {
      openRejectFlowForSelectedJob();
      return;
    }

    try {
      setSubmitting(true);
      await Promise.resolve(
        onSubmit?.({
          candidateId: candidate.id,
          jobId: selectedJobId,
          stage: targetStage,
          recruiterId: selectedRecruiterId || undefined,
          priority,
          notes: notes.trim() || undefined,
        })
      );
      if (typeof window !== 'undefined') {
        void requestSuccess(
          isMoveMode
            ? 'Stage updated successfully.'
            : isUpdatingEntry
              ? 'Pipeline entry updated successfully.'
              : 'Candidate added to pipeline successfully.'
        );
      }
      if (isMoveMode || isUpdatingEntry) {
        setRecentlyUpdatedJobId(selectedJobId);
        setEditingJobId(selectedJobId);
        setAddNewJobMode(false);
      } else {
        onClose();
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen ? (
        <>
          <motion.div
            className="fixed inset-0 z-[70] bg-slate-950/45"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className="fixed inset-0 z-[80] flex items-center justify-center p-4"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
          >
            <div className="flex max-h-[min(90vh,760px)] w-full max-w-[520px] flex-col rounded-3xl border border-slate-200 bg-white shadow-2xl">
              <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-5 py-4">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">
                    {isMoveMode ? 'Move candidate stage' : 'Add Candidate to Pipeline'}
                  </h3>
                  {candidate?.name ? (
                    <p className="mt-0.5 text-sm text-slate-500">{candidate.name}</p>
                  ) : null}
                  <p className="mt-1 text-xs text-slate-500">
                    {isMoveMode
                      ? 'Select a stage for this job pipeline or update assignment.'
                      : 'Assign this candidate to a job pipeline.'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-xl p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                >
                  <X size={18} />
                </button>
              </div>

              <div
                ref={formSectionRef}
                className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5"
              >
                {existingPipelineEntries.length > 0 ? (
                  <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Briefcase size={16} className="text-slate-500" />
                        <h4 className="text-sm font-semibold text-slate-900">Assigned jobs</h4>
                      </div>
                      <span className="text-xs font-medium text-slate-500">
                        {existingPipelineEntries.length}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">Click a job to move stage or update assignment.</p>
                    <ul className="mt-3 space-y-2">
                      {existingPipelineEntries.map((row, idx) => {
                        const key = row.pipelineEntryId || row.id || `${row.title}-${idx}`;
                        const stageLabel =
                          String(row.stage || '').trim() ||
                          getCandidateStageLabel(row.status);
                        const badgeClasses = getCandidateStageBadgeClasses(row.stage || row.status);
                        const rowJobId = row.id ? String(row.id) : '';
                        const isActiveRow = editingJobId === rowJobId;
                        return (
                          <li key={key}>
                            <button
                              type="button"
                              onClick={() => loadEntryIntoForm(row)}
                              className={`w-full rounded-xl border bg-white px-3 py-2.5 text-left transition-colors ${
                                isActiveRow
                                  ? 'border-blue-300 ring-2 ring-blue-100'
                                  : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                              }`}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-medium text-slate-800">{row.title}</p>
                                  {row.department ? (
                                    <p className="mt-0.5 truncate text-xs text-slate-500">{row.department}</p>
                                  ) : null}
                                  {row.movedAt ? (
                                    <p className="mt-0.5 text-xs text-slate-500">
                                      Updated {formatDateDMY(row.movedAt)}
                                    </p>
                                  ) : null}
                                  {recentlyUpdatedJobId === rowJobId ? (
                                    <p className="mt-1 text-xs font-semibold text-emerald-700">Just updated</p>
                                  ) : null}
                                </div>
                                <span
                                  className={`inline-flex shrink-0 items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${badgeClasses}`}
                                >
                                  {stageLabel}
                                </span>
                              </div>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                    {!addNewJobMode ? (
                      <button
                        type="button"
                        onClick={startAddNewJob}
                        className="mt-3 text-xs font-semibold text-blue-700 hover:text-blue-800"
                      >
                        + Add another job to pipeline
                      </button>
                    ) : null}
                  </section>
                ) : null}

                {addNewJobMode && !(lockJobToInitial && initialJobId) ? (
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">Select Job</label>
                    <div className="relative" ref={jobDropdownRef}>
                      <button
                        type="button"
                        onClick={() => setJobDropdownOpen((prev) => !prev)}
                        className={`flex w-full items-center justify-between rounded-xl border bg-white px-3 py-2.5 text-left text-sm ${
                          errors.job ? 'border-red-300' : 'border-slate-200'
                        }`}
                      >
                        <span className={selectedJob ? 'text-slate-700' : 'text-slate-400'}>
                          {selectedJob
                            ? `${selectedJob.title}${selectedJob.department ? ` · ${selectedJob.department}` : ''}`
                            : 'Search and select job'}
                        </span>
                        <Search size={16} className="text-slate-400" />
                      </button>
                      {jobDropdownOpen ? (
                        <div className="absolute left-0 right-0 top-12 z-10 rounded-2xl border border-slate-200 bg-white p-3 shadow-xl">
                          <input
                            value={jobSearch}
                            onChange={(e) => setJobSearch(e.target.value)}
                            placeholder="Search job title or department"
                            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                          />
                          <div className="mt-3 max-h-48 overflow-y-auto">
                            {loadingJobs ? (
                              <p className="px-3 py-2 text-sm text-slate-500">Loading jobs…</p>
                            ) : filteredJobs.length === 0 ? (
                              <p className="px-3 py-2 text-sm text-slate-500">No jobs available</p>
                            ) : (
                              filteredJobs.map((job) => (
                                <button
                                  key={job.id}
                                  type="button"
                                  onClick={() => {
                                    const existing = existingPipelineEntries.find(
                                      (row) => row.id && String(row.id) === job.id
                                    );
                                    setSelectedJobId(job.id);
                                    setJobSearch('');
                                    setJobDropdownOpen(false);
                                    setErrors((prev) => ({ ...prev, job: undefined }));
                                    if (existing) {
                                      loadEntryIntoForm(existing);
                                    } else {
                                      setAddNewJobMode(true);
                                      setEditingJobId(null);
                                      syncStageFromPath([]);
                                      setNotes('');
                                    }
                                  }}
                                  className="flex w-full items-start justify-between rounded-xl px-3 py-2 text-left hover:bg-slate-50"
                                >
                                  <div>
                                    <p className="text-sm font-medium text-slate-800">{job.title}</p>
                                    <p className="text-xs text-slate-500">{job.department || 'No department'}</p>
                                  </div>
                                  {selectedJobId === job.id ? (
                                    <Check size={15} className="mt-1 text-blue-600" />
                                  ) : null}
                                </button>
                              ))
                            )}
                          </div>
                        </div>
                      ) : null}
                    </div>
                    {errors.job ? <p className="mt-1 text-xs text-red-600">{errors.job}</p> : null}
                  </div>
                ) : null}

                {addNewJobMode && lockJobToInitial && initialJobId && selectedJob ? (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Job</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">{selectedJob.title}</p>
                    {selectedJob.department ? (
                      <p className="text-xs text-slate-500">{selectedJob.department}</p>
                    ) : null}
                  </div>
                ) : null}

                {(isMoveMode || addNewJobMode) && selectedJobId ? (
                  <div>
                    <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">
                      {isMoveMode ? 'Move to stage' : 'Pipeline stages'}
                    </label>
                    {isMoveMode && currentStageOnEntry ? (
                      <div className="mb-3 flex flex-wrap items-center gap-2">
                        <span className="text-xs text-slate-500">Current stage:</span>
                        <span
                          className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${getCandidateStageBadgeClasses(currentStageOnEntry)}`}
                        >
                          {currentStageOnEntry}
                        </span>
                        {stageChanged && targetStage ? (
                          <span className="text-xs font-medium text-blue-700">→ {targetStage}</span>
                        ) : null}
                        {stagePath.some(
                          (stage, index) =>
                            stage.toLowerCase() === currentStageOnEntry.toLowerCase() &&
                            index === stagePath.length - 1
                        ) ? (
                          <button
                            type="button"
                            onClick={() => {
                              const idx = stagePath.findIndex(
                                (stage) => stage.toLowerCase() === currentStageOnEntry.toLowerCase()
                              );
                              if (idx >= 0) handleRemoveStageFromPath(idx);
                            }}
                            className="text-xs font-semibold text-red-600 hover:text-red-700"
                          >
                            Remove
                          </button>
                        ) : null}
                      </div>
                    ) : null}

                    {loadingJobStages ? (
                      <p className="text-sm text-slate-500">Loading stages…</p>
                    ) : jobStageOptions.length === 0 ? (
                      <p className="text-sm text-slate-500">No pipeline configured for this job</p>
                    ) : (
                      <div className="space-y-3">
                        {stagePath.length > 0 ? (
                          <ol className="space-y-2">
                            {stagePath.map((stage, index) => {
                              const isCurrent = index === stagePath.length - 1;
                              return (
                                <li key={`${stage}-${index}`} className="flex items-center gap-2">
                                  {index > 0 ? (
                                    <ArrowRightCircle size={14} className="shrink-0 text-slate-300" />
                                  ) : (
                                    <span className="w-[14px] shrink-0" />
                                  )}
                                  <div
                                    className={`flex min-w-0 flex-1 items-center justify-between gap-2 rounded-xl border px-3 py-2 ${
                                      isCurrent
                                        ? 'border-blue-200 bg-blue-50'
                                        : 'border-slate-200 bg-white'
                                    }`}
                                  >
                                    <div className="min-w-0">
                                      <span
                                        className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${getCandidateStageBadgeClasses(stage)}`}
                                      >
                                        {stage}
                                      </span>
                                      {isCurrent ? (
                                        <p className="mt-1 text-[10px] font-medium text-blue-700">
                                          {isMoveMode ? 'Target stage' : 'Selected stage'}
                                        </p>
                                      ) : null}
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveStageFromPath(index)}
                                      className="shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-red-600"
                                      aria-label={`Remove ${stage}`}
                                      title="Remove stage"
                                    >
                                      <X size={14} />
                                    </button>
                                  </div>
                                </li>
                              );
                            })}
                          </ol>
                        ) : (
                          <p className="text-sm text-slate-500">No stage selected yet. Choose one from the dropdown.</p>
                        )}

                        <div>
                          <label className="mb-1 block text-xs font-medium text-slate-600">Select stage</label>
                          <select
                            value={stagePickerValue}
                            onChange={(e) => {
                              const value = e.target.value;
                              setStagePickerValue(value);
                              if (value) {
                                handleSelectStageFromDropdown(value);
                                setStagePickerValue('');
                              }
                            }}
                            disabled={loadingJobStages || jobStageOptions.length === 0}
                            className={`w-full rounded-xl border bg-white px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 ${
                              errors.stage ? 'border-red-300' : 'border-slate-200'
                            }`}
                          >
                            <option value="">
                              {jobStageOptions.length === 0
                                ? 'No stages available'
                                : 'Select a stage'}
                            </option>
                            {jobStageOptions.map((stage) => (
                              <option key={stage} value={stage}>
                                {stage}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    )}
                    {errors.stage ? <p className="mt-1 text-xs text-red-600">{errors.stage}</p> : null}
                  </div>
                ) : null}

                {(isMoveMode || addNewJobMode) ? (
                  <div>
                    <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">
                      Assign team member
                    </label>
                    {selectedRecruiter ? (
                      <div className="mb-2 flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                        <span className="flex min-w-0 items-center gap-2 text-sm text-slate-800">
                          {selectedRecruiter.avatar ? (
                            <img
                              src={selectedRecruiter.avatar}
                              alt={selectedRecruiter.name}
                              className="h-7 w-7 rounded-full object-cover"
                            />
                          ) : (
                            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-100 text-[10px] font-semibold text-blue-700">
                              {getAvatarInitials(selectedRecruiter.name)}
                            </span>
                          )}
                          <span className="truncate font-medium">{selectedRecruiter.name}</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => setSelectedRecruiterId('')}
                          className="shrink-0 text-xs font-semibold text-red-600 hover:text-red-700"
                        >
                          Remove
                        </button>
                      </div>
                    ) : (
                      <p className="mb-2 text-xs text-slate-500">No team member assigned</p>
                    )}
                    <div className="relative" ref={recruiterDropdownRef}>
                      <button
                        type="button"
                        onClick={() => setRecruiterDropdownOpen((prev) => !prev)}
                        className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-left text-sm"
                      >
                        <span className="text-slate-600">
                          {selectedRecruiter ? 'Change team member' : 'Search and select team member'}
                        </span>
                        <UserCircle2 size={16} className="text-slate-400" />
                      </button>
                      {recruiterDropdownOpen ? (
                        <div className="absolute left-0 right-0 top-12 z-10 rounded-2xl border border-slate-200 bg-white p-3 shadow-xl">
                          <input
                            value={recruiterSearch}
                            onChange={(e) => setRecruiterSearch(e.target.value)}
                            placeholder="Search team member"
                            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                          />
                          <div className="mt-3 max-h-48 overflow-y-auto">
                            {filteredRecruiters.map((recruiter) => (
                              <button
                                key={recruiter.id}
                                type="button"
                                onClick={() => {
                                  setSelectedRecruiterId(recruiter.id);
                                  setRecruiterSearch('');
                                  setRecruiterDropdownOpen(false);
                                }}
                                className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left hover:bg-slate-50"
                              >
                                <span className="flex items-center gap-2">
                                  {recruiter.avatar ? (
                                    <img
                                      src={recruiter.avatar}
                                      alt={recruiter.name}
                                      className="h-7 w-7 rounded-full object-cover"
                                    />
                                  ) : (
                                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-100 text-[10px] font-semibold text-blue-700">
                                      {getAvatarInitials(recruiter.name)}
                                    </span>
                                  )}
                                  <span className="text-sm text-slate-700">{recruiter.name}</span>
                                </span>
                                {selectedRecruiterId === recruiter.id ? (
                                  <Check size={15} className="text-blue-600" />
                                ) : null}
                              </button>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                ) : null}

                {addNewJobMode ? (
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">Priority</label>
                    <div className="flex flex-wrap gap-2">
                      {(['High', 'Medium', 'Low'] as const).map((option) => (
                        <button
                          key={option}
                          type="button"
                          onClick={() => setPriority(option)}
                          className={`rounded-xl border px-4 py-2 text-sm font-medium ${
                            priority === option
                              ? 'border-blue-200 bg-blue-50 text-blue-700'
                              : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          {option}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}

                {(isMoveMode || addNewJobMode) ? (
                  <div>
                    <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">
                      Note (optional)
                    </label>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={3}
                      placeholder="Add a short note (optional)"
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                    />
                  </div>
                ) : null}

                {isMoveMode && onRemoveFromPipeline ? (
                  <button
                    type="button"
                    onClick={handleRemoveFromPipeline}
                    disabled={removing || submitting}
                    className="w-full rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:opacity-60"
                  >
                    {removing ? 'Removing...' : 'Remove from pipeline'}
                  </button>
                ) : null}

              </div>
              <div className="flex shrink-0 items-center justify-end gap-3 border-t border-slate-200 px-5 py-4">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting
                    ? isMoveMode
                      ? 'Moving...'
                      : isUpdatingEntry
                        ? 'Updating...'
                        : 'Adding...'
                    : isMoveMode
                      ? 'Move stage'
                      : isUpdatingEntry
                        ? 'Update entry'
                        : 'Add to Pipeline'}
                </button>
              </div>
            </div>
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>
  );
}

interface RejectCandidateModalProps {
  candidate: CandidateProfileDrawerData | null;
  isOpen: boolean;
  onClose: () => void;
  onReject?: (
    reason: string,
    feedback: string,
    sendEmail: boolean,
    showFeedbackToCandidate: boolean
  ) => void | Promise<void>;
}

type RejectModalStep = 'form' | 'confirm' | 'progress' | 'done';

const REJECT_FEEDBACK_MAX_LENGTH = 100;

function ProfileRejectFormSwitch({
  checked,
  onCheckedChange,
  activeTrackClass,
}: {
  checked: boolean;
  onCheckedChange: (next: boolean) => void;
  activeTrackClass: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onCheckedChange(!checked)}
      className={`relative h-6 w-11 shrink-0 cursor-pointer rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 ${
        checked ? `${activeTrackClass} border-transparent` : 'border-slate-300 bg-slate-200'
      }`}
    >
      <span
        className={`pointer-events-none absolute left-[3px] top-[3px] block h-[18px] w-[18px] rounded-full bg-white shadow-sm ring-1 ring-black/10 transition-transform duration-200 ease-out ${
          checked ? 'translate-x-5' : 'translate-x-0'
        }`}
        aria-hidden
      />
    </button>
  );
}

function RejectCandidateModal({
  candidate,
  isOpen,
  onClose,
  onReject,
}: RejectCandidateModalProps) {
  const [reason, setReason] = useState('');
  const [feedback, setFeedback] = useState('');
  const [sendEmail, setSendEmail] = useState(true);
  const [showFeedbackToCandidate, setShowFeedbackToCandidate] = useState(true);
  const [errors, setErrors] = useState<{ reason?: string }>({});
  const [step, setStep] = useState<RejectModalStep>('form');
  const [progressStep, setProgressStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setReason('');
      setFeedback('');
      setSendEmail(true);
      setShowFeedbackToCandidate(true);
      setErrors({});
      setStep('form');
      setProgressStep(0);
      setSubmitting(false);
    }
  }, [isOpen]);

  const validate = () => {
    const nextErrors: { reason?: string } = {};
    if (!reason) nextErrors.reason = 'Reject reason is required';
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const progressLabels = [
    'Storing HR feedback...',
    'Updating candidate stage...',
    'Generating LMS suggestions...',
    'Sending rejection email...',
  ];

  const handlePrimaryReject = () => {
    if (!validate()) return;
    setStep('confirm');
  };

  const handleConfirmReject = async () => {
    setStep('progress');
    setSubmitting(true);
    try {
      for (let i = 1; i <= 4; i += 1) {
        setProgressStep(i);
        await new Promise((resolve) => window.setTimeout(resolve, 350));
      }
      await Promise.resolve(onReject?.(reason, feedback.trim(), sendEmail, showFeedbackToCandidate));
      setStep('done');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen ? (
        <>
          <motion.div
            className="fixed inset-0 z-[70] bg-slate-950/45"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className="fixed inset-0 z-[80] flex items-center justify-center p-4"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
          >
            <div className="w-full max-w-[480px] rounded-3xl border border-slate-200 bg-white shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-red-50 text-red-600">
                    <AlertTriangle size={20} />
                  </span>
                  <h3 className="text-lg font-semibold text-slate-900">Reject Candidate</h3>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-xl p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                >
                  <X size={18} />
                </button>
              </div>

              {step === 'form' ? (
                <>
                  <div className="space-y-5 px-5 py-5">
                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-700">Reject Reason</label>
                      <div className="relative">
                        <select
                          value={reason}
                          onChange={(e) => {
                            setReason(e.target.value);
                            setErrors((prev) => ({ ...prev, reason: undefined }));
                          }}
                          className={`w-full rounded-xl border bg-white px-3 py-2.5 text-sm text-slate-700 outline-none ${
                            errors.reason ? 'border-red-300' : 'border-slate-200'
                          } focus:border-red-400 focus:ring-2 focus:ring-red-100`}
                        >
                          <option value="">Select reason</option>
                          {REJECT_REASONS.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      </div>
                      {errors.reason ? <p className="mt-1 text-xs text-red-600">{errors.reason}</p> : null}
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-700">Feedback</label>
                      <textarea
                        value={feedback}
                        onChange={(e) => {
                          setFeedback(e.target.value.slice(0, REJECT_FEEDBACK_MAX_LENGTH));
                        }}
                        rows={5}
                        placeholder="Share internal rejection feedback for this candidate..."
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100"
                      />
                      <div className="mt-1 flex items-center justify-between">
                        <p className="text-xs text-slate-400">{feedback.trim().length}/{REJECT_FEEDBACK_MAX_LENGTH} chars</p>
                      </div>
                    </div>

                    <div className="flex items-start justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <div className="min-w-0 pr-2">
                        <p className="text-sm font-medium text-slate-800">Share feedback with candidate</p>
                        <p className="mt-1 text-xs text-slate-500">
                          When on, the feedback above appears on the candidate's job-portal application timeline. Internal records are kept either way.
                        </p>
                      </div>
                      <ProfileRejectFormSwitch
                        checked={showFeedbackToCandidate}
                        onCheckedChange={setShowFeedbackToCandidate}
                        activeTrackClass="bg-emerald-500"
                      />
                    </div>

                    <div className="flex items-start justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <div className="min-w-0 pr-2">
                        <p className="text-sm font-medium text-slate-800">Send rejection email</p>
                        <p className="mt-1 text-xs text-slate-500">Notify the candidate automatically after rejection.</p>
                      </div>
                      <ProfileRejectFormSwitch checked={sendEmail} onCheckedChange={setSendEmail} activeTrackClass="bg-red-500" />
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-5 py-4">
                    <button
                      type="button"
                      onClick={onClose}
                      className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handlePrimaryReject}
                      className="rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
                    >
                      Reject Candidate
                    </button>
                  </div>
                </>
              ) : null}

              {step === 'confirm' ? (
                <>
                  <div className="space-y-4 px-5 py-6">
                    <p className="text-sm leading-6 text-slate-700">
                      You are about to reject <span className="font-semibold text-slate-900">{candidate?.name || 'this candidate'}</span>.
                    </p>
                    <div className="rounded-2xl border border-red-100 bg-red-50 p-4 text-sm text-slate-700">
                      <p>This will trigger:</p>
                      <ul className="mt-2 space-y-1 text-slate-600">
                        <li>Feedback stored</li>
                        <li>Candidate stage updated</li>
                        <li>AI Courses suggestions sent</li>
                        <li>
                          {showFeedbackToCandidate
                            ? 'Feedback shared with candidate'
                            : 'Feedback kept internal — candidate will not see it'}
                        </li>
                        <li>{sendEmail ? 'Rejection email sent' : 'Rejection email skipped'}</li>
                      </ul>
                    </div>
                  </div>
                  <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-5 py-4">
                    <button
                      type="button"
                      onClick={() => setStep('form')}
                      className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    >
                      Go Back
                    </button>
                    <button
                      type="button"
                      onClick={handleConfirmReject}
                      className="rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
                    >
                      Confirm Reject
                    </button>
                  </div>
                </>
              ) : null}

              {step === 'progress' ? (
                <div className="px-5 py-6">
                  <div className="space-y-4">
                    {['Feedback stored', 'Candidate stage updated', 'AI Courses suggestions sent', 'Rejection email sent'].map((label, index) => {
                      const done = progressStep > index + 1;
                      const active = progressStep === index + 1;
                      return (
                        <div
                          key={label}
                          className={`flex items-center justify-between rounded-2xl border px-4 py-3 ${
                            done || active ? 'border-red-200 bg-red-50' : 'border-slate-200 bg-slate-50'
                          }`}
                        >
                          <span className={`text-sm ${done || active ? 'text-slate-800' : 'text-slate-500'}`}>{label}</span>
                          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white">
                            {done ? (
                              <Check size={15} className="text-emerald-600" />
                            ) : active ? (
                              <span className="h-3 w-3 animate-pulse rounded-full bg-red-500" />
                            ) : (
                              <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
                            )}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              {step === 'done' ? (
                <>
                  <div className="px-5 py-8 text-center">
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                      <CheckCircle2 size={26} />
                    </div>
                    <h4 className="mt-4 text-lg font-semibold text-slate-900">Candidate rejected. LMS courses suggested.</h4>
                    <p className="mt-2 text-sm text-slate-500">
                      The candidate stage has been updated and the rejection workflow is complete.
                    </p>
                  </div>
                  <div className="flex items-center justify-end border-t border-slate-200 px-5 py-4">
                    <button
                      type="button"
                      onClick={onClose}
                      disabled={submitting}
                      className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
                    >
                      Close
                    </button>
                  </div>
                </>
              ) : null}
            </div>
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>
  );
}

interface InternalNotesProps {
  notes: NonNullable<CandidateProfileDrawerData['notes']>;
  candidateId: string;
  currentUser: {
    id: string;
    name: string;
    avatar?: string | null;
  };
  onAddNote?: (candidateId: string, note: { text: string; tags: string[] }) => void | Promise<void>;
  onEditNote?: (candidateId: string, noteId: string, note: { text: string; tags: string[] }) => void | Promise<void>;
  onDeleteNote?: (candidateId: string, noteId: string) => void | Promise<void>;
  onPinNote?: (candidateId: string, noteId: string, isPinned: boolean) => void | Promise<void>;
}

function InternalNotesSection({
  notes,
  candidateId,
  currentUser,
  onAddNote,
  onEditNote,
  onDeleteNote,
  onPinNote,
}: InternalNotesProps) {
  const remarkFilters = ['All', 'Calls', 'WhatsApp', 'Emails'] as const;
  const [newNoteText, setNewNoteText] = useState('');
  const [newNoteTags, setNewNoteTags] = useState<string[]>([]);
  const [remarkFilter, setRemarkFilter] = useState<(typeof remarkFilters)[number]>('All');
  const [actionMenuOpenId, setActionMenuOpenId] = useState<string | null>(null);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [editTags, setEditTags] = useState<string[]>([]);

  const availableTags = useMemo(() => {
    const baseTags = ['Calls', 'WhatsApp', 'Emails'];
    const existing = notes.flatMap((note) => note.tags || []);
    return Array.from(new Set([...baseTags, ...existing]));
  }, [notes]);

  const sortedNotes = useMemo(() => {
    const filtered = notes.filter((note) =>
      remarkFilter === 'All' ? true : (note.tags || []).includes(remarkFilter)
    );
    return [...filtered].sort((a, b) => {
      if (Boolean(a.isPinned) !== Boolean(b.isPinned)) {
        return a.isPinned ? -1 : 1;
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [notes, remarkFilter]);

  const toggleTag = (tag: string, selectedTags: string[], setter: (tags: string[]) => void) => {
    setter(
      selectedTags.includes(tag)
        ? selectedTags.filter((item) => item !== tag)
        : [...selectedTags, tag]
    );
  };

  const startEdit = (note: NonNullable<CandidateProfileDrawerData['notes']>[number]) => {
    setEditingNoteId(note.id);
    setEditText(note.text);
    setEditTags(note.tags || []);
    setActionMenuOpenId(null);
  };

  const saveEdit = async (noteId: string) => {
    const text = editText.trim();
    if (!text) return;
    await Promise.resolve(onEditNote?.(candidateId, noteId, { text, tags: editTags }));
    setEditingNoteId(null);
    setEditText('');
    setEditTags([]);
  };

  const addNote = async () => {
    const text = newNoteText.trim();
    if (!text) return;
    await Promise.resolve(onAddNote?.(candidateId, { text, tags: newNoteTags }));
    setNewNoteText('');
    setNewNoteTags([]);
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-slate-900">Remarks</h3>
        <div className="flex flex-wrap items-center gap-2">
          {remarkFilters.map((filter) => (
            <button
              key={filter}
              type="button"
              onClick={() => setRemarkFilter(filter)}
              className={`rounded-xl px-3 py-2 text-xs font-medium transition-colors ${
                remarkFilter === filter
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {filter}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 space-y-4">
        {sortedNotes.length > 0 ? (
          sortedNotes.map((note) => {
            const isEditing = editingNoteId === note.id;

            return (
              <div key={note.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 flex-1 items-start gap-3">
                    {note.recruiter.avatar ? (
                      <img
                        src={note.recruiter.avatar}
                        alt={note.recruiter.name}
                        className="h-10 w-10 rounded-full object-cover ring-1 ring-slate-200"
                      />
                    ) : (
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-xs font-semibold text-blue-700">
                        {getAvatarInitials(note.recruiter.name)}
                      </div>
                    )}

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-slate-900">{`By ${note.recruiter.name}`}</p>
                        <span className="text-xs text-slate-400">{formatRelativeTime(note.createdAt)}</span>
                        <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                          Tenant team
                        </span>
                        {note.isPinned ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                            <Pin size={11} />
                            Pinned
                          </span>
                        ) : null}
                      </div>

                      {isEditing ? (
                        <div className="mt-3 space-y-3">
                          <textarea
                            value={editText}
                            onChange={(e) => setEditText(e.target.value)}
                            rows={4}
                            placeholder="Update remark..."
                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                          />
                          <div>
                            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                              Remark Type
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {availableTags.map((tag) => {
                                const selected = editTags.includes(tag);
                                return (
                                  <button
                                    key={`${note.id}-${tag}`}
                                    type="button"
                                    onClick={() => toggleTag(tag, editTags, setEditTags)}
                                    className={`rounded-full px-3 py-1 text-xs font-medium ${
                                      selected
                                        ? 'bg-blue-100 text-blue-700'
                                        : 'bg-white text-slate-600 ring-1 ring-slate-200'
                                    }`}
                                  >
                                    {selected ? <Check size={12} className="mr-1 inline" /> : null}
                                    {tag}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => saveEdit(note.id)}
                              className="rounded-xl bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingNoteId(null);
                                setEditText('');
                                setEditTags([]);
                              }}
                              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{note.text}</p>
                          {(note.tags || []).length > 0 ? (
                            <div className="mt-3 flex flex-wrap gap-2">
                              {note.tags?.map((tag) => (
                                <span
                                  key={`${note.id}-${tag}`}
                                  className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-600 ring-1 ring-slate-200"
                                >
                                {tag}
                                </span>
                              ))}
                            </div>
                          ) : null}
                        </>
                      )}
                    </div>
                  </div>

                  {isEditing ? null : (
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setActionMenuOpenId((prev) => (prev === note.id ? null : note.id))}
                        className="rounded-xl p-2 text-slate-500 hover:bg-white hover:text-slate-700"
                      >
                        <MoreVertical size={16} />
                      </button>

                      {actionMenuOpenId === note.id ? (
                        <div className="absolute right-0 top-10 z-10 w-40 rounded-xl border border-slate-200 bg-white p-1 shadow-lg">
                          <button
                            type="button"
                            onClick={() => startEdit(note)}
                            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                          >
                            <SquarePen size={14} />
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              await Promise.resolve(onPinNote?.(candidateId, note.id, !note.isPinned));
                              setActionMenuOpenId(null);
                            }}
                            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                          >
                            <Pin size={14} />
                            {note.isPinned ? 'Unpin' : 'Pin'}
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              await Promise.resolve(onDeleteNote?.(candidateId, note.id));
                              setActionMenuOpenId(null);
                            }}
                            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                          >
                            <Trash2 size={14} />
                            Delete
                          </button>
                        </div>
                      ) : null}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 py-10 text-center">
            <MessageSquareText size={28} className="mx-auto text-slate-300" />
            <h4 className="mt-3 text-sm font-semibold text-slate-800">
              {remarkFilter === 'All' ? 'No remarks yet' : `No ${remarkFilter.toLowerCase()} remarks yet`}
            </h4>
            <p className="mt-1 text-sm text-slate-500">
              Add calls, WhatsApp, email, and other shared team remarks here.
            </p>
          </div>
        )}
      </div>

      <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <div className="flex items-center gap-2">
          {currentUser.avatar ? (
            <img
              src={currentUser.avatar}
              alt={currentUser.name}
              className="h-9 w-9 rounded-full object-cover ring-1 ring-slate-200"
            />
          ) : (
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-100 text-xs font-semibold text-blue-700">
              {getAvatarInitials(currentUser.name)}
            </div>
          )}
          <div>
            <p className="text-sm font-medium text-slate-800">{currentUser.name}</p>
            <p className="text-xs text-slate-500">Visible to every teammate in this tenant</p>
          </div>
        </div>

        <textarea
          value={newNoteText}
          onChange={(e) => setNewNoteText(e.target.value)}
          rows={4}
          placeholder="Add a remark for your team..."
          className="mt-4 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
        />

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Remark Type</p>
            <div className="flex flex-wrap gap-2">
              {availableTags.map((tag) => {
                const selected = newNoteTags.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleTag(tag, newNoteTags, setNewNoteTags)}
                    className={`rounded-full px-3 py-1 text-xs font-medium ${
                      selected
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-white text-slate-700 ring-1 ring-slate-200'
                    }`}
                  >
                    {selected ? <Check size={12} className="mr-1 inline" /> : null}
                    {tag}
                  </button>
                );
              })}
            </div>
          </div>

          <button
            type="button"
            onClick={addNote}
            disabled={!newNoteText.trim()}
            className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Add Remark
          </button>
        </div>

        {newNoteTags.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {newNoteTags.map((tag) => (
              <span
                key={`selected-${tag}`}
                className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-600 ring-1 ring-slate-200"
              >
                {tag}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}

export function CandidateProfileDrawer({
  candidate,
  isOpen,
  onClose,
  openEditDirectly = false,
  loadingCandidateProfile = false,
  currentUser,
  availableTags = [],
  jobs = [],
  recruiters = [],
  interviewers = [],
  existingInterviews = [],
  editModalOpenToken = null,
  onAction,
  onAddNote,
  onEditNote,
  onDeleteNote,
  onPinNote,
  onAddTag,
  onRemoveTag,
  onCreateTag,
  onAddToPipeline,
  onRemoveFromPipeline,
  onRejectCandidate,
  onScheduleInterview,
  onUpdateCandidate,
  onRefreshCandidate,
  onSubmitToClient,
  showSubmitToClient = false,
  stackAboveSiblingDrawers = false,
}: CandidateProfileDrawerProps) {
  usePageDrawerLifecycle(isOpen);
  const {
    panelRef: candidateDrawerPanelRef,
    requestClose: requestCandidateDrawerClose,
  } = useDrawerUnsavedGuard<HTMLElement>({
    isOpen,
    onClose,
  });
  const layer = stackAboveSiblingDrawers
    ? {
        backdrop: 'z-[117]',
        panel: 'z-[118]',
        editBackdrop: 'z-[119]',
        editPanel: 'z-[120]',
        toast: 'z-[125]',
      }
    : {
        backdrop: 'z-40',
        panel: 'z-50',
        editBackdrop: 'z-[70]',
        editPanel: 'z-[75]',
        toast: 'z-[90]',
      };
  const [activeTab, setActiveTab] = useState<DrawerTab>('Overview');
  const [showAddToPipelineModal, setShowAddToPipelineModal] = useState(false);
  const [showScheduleInterviewModal, setShowScheduleInterviewModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectModalJobId, setRejectModalJobId] = useState<string | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [phase1EditSnapshot, setPhase1EditSnapshot] = useState<Phase1ProfileSnapshot | null>(null);
  const [editForm, setEditForm] = useState<CandidateEditFormState | null>(null);
  const [editAvatarFile, setEditAvatarFile] = useState<File | null>(null);
  const [editAvatarPreview, setEditAvatarPreview] = useState('');
  const editAvatarPreviewRef = useRef('');
  const [editError, setEditError] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const activityContainerRef = useRef<HTMLDivElement | null>(null);
  const lastEditModalOpenTokenRef = useRef<number | null>(null);
  const [editInterview, setEditInterview] = useState<CandidateScheduledInterview | null>(null);
  const candidateFileInputRef = useRef<HTMLInputElement>(null);
  const isDirectEditLaunch = openEditDirectly && Boolean(editModalOpenToken);
  const [drawerPortalMounted, setDrawerPortalMounted] = useState(false);

  useEffect(() => {
    setDrawerPortalMounted(true);
  }, []);

  const {
    files: candidateFiles,
    loading: candidateFilesLoading,
    uploading: candidateFilesUploading,
    uploadSuccess: candidateFilesUploadSuccess,
    uploadPercent: candidateFilesUploadPercent,
    error: candidateFilesError,
    uploadFile: uploadCandidateFile,
    deleteFile: deleteCandidateFile,
    refresh: refreshCandidateFiles,
  } = useFiles('candidate', candidate?.id);

  const handleCvToast = useCallback((message: string) => {
    setToastMessage(message);
  }, []);

  const [resumeTabViewPreference, setResumeTabViewPreference] =
    useState<ResumeCvViewMode | null>(null);

  useEffect(() => {
    setResumeTabViewPreference(null);
  }, [candidate?.id]);

  const handleCvCandidateUpdated = useCallback(async () => {
    if (!candidate?.id || !onRefreshCandidate) return;
    await Promise.resolve(onRefreshCandidate(candidate.id));
  }, [candidate?.id, onRefreshCandidate]);

  const cvEditor = useCandidateCvEditor({
    candidateId: candidate?.id,
    resumeUrl: candidate?.resumeUrl,
    enabled: isOpen && Boolean(candidate?.id),
    canEdit: Boolean(onUpdateCandidate),
    onCandidateUpdated: onRefreshCandidate ? handleCvCandidateUpdated : undefined,
    onToast: handleCvToast,
    onViewModeChange: (mode) => {
      if (mode) setResumeTabViewPreference(mode);
      if (mode === 'updated' || mode === 'ai') setActiveTab('Resume');
    },
  });

  const handleSaasaCandidateUpdated = useCallback(async () => {
    await handleCvCandidateUpdated();
    await cvEditor.refreshBackend();
  }, [handleCvCandidateUpdated, cvEditor.refreshBackend]);

  const saasaCv = useSaasaCvAnnotations({
    candidateId: candidate?.id,
    candidateName: candidate?.name,
    resumeUrl: candidate?.resumeUrl,
    extraData: candidate?.extraData ?? null,
    enabled: isOpen && Boolean(candidate?.id),
    canEdit: Boolean(onUpdateCandidate),
    onCandidateUpdated: onRefreshCandidate ? handleSaasaCandidateUpdated : undefined,
    onFilesRefresh: refreshCandidateFiles,
    onToast: handleCvToast,
    onViewModeChange: (mode) => {
      if (mode) setResumeTabViewPreference(mode);
      if (mode === 'saasa') setActiveTab('Resume');
    },
  });

  const saasaCvStored = useMemo(
    () => readSaasaCvAnnotations(candidate?.extraData ?? null),
    [candidate?.extraData]
  );

  const saasaCvFileEntry = useMemo(() => {
    if (!saasaCvStored || !hasSaasaCvSaved(saasaCvStored)) return null;
    const fromList = saasaCvStored.fileId
      ? candidateFiles.find((f) => f.id === saasaCvStored.fileId)
      : candidateFiles.find((f) => f.fileType === SAASA_CV_FILE_TYPE);
    return {
      id: fromList?.id ?? saasaCvStored.fileId,
      fileName:
        fromList?.fileName ?? saasaCvStored.fileName ?? `HRYantra CV - ${candidate?.name || 'Candidate'}`,
      fileUrl: fromList?.fileUrl ?? saasaCvStored.fileUrl ?? null,
      markCount: saasaCvStored.items.length,
      updatedAt: saasaCvStored.updatedAt,
    };
  }, [saasaCvStored, candidateFiles, candidate?.name]);

  const originalResumeFileUrl = useMemo(() => {
    const profile = String(candidate?.resumeUrl || '').trim();
    if (profile) return profile;
    return pickLatestResumeFileUrl(candidateFiles) || null;
  }, [candidate?.resumeUrl, candidateFiles]);

  const candidateFilesOther = useMemo(() => {
    const cvUrls = new Set(
      [originalResumeFileUrl, saasaCvFileEntry?.fileUrl]
        .map((url) => String(url || '').trim())
        .filter(Boolean)
    );
    return candidateFiles.filter((f) => {
      if (f.fileType === SAASA_CV_FILE_TYPE) return false;
      if (f.id && f.id === saasaCvStored?.fileId) return false;
      if (/^resume$/i.test(String(f.fileType || '').trim())) return false;
      const url = String(f.fileUrl || '').trim();
      if (url && cvUrls.has(url)) return false;
      return true;
    });
  }, [candidateFiles, saasaCvStored?.fileId, originalResumeFileUrl, saasaCvFileEntry?.fileUrl]);

  const handleViewResumeTabFromFiles = useCallback(
    (mode: ResumeCvViewMode) => {
      setResumeTabViewPreference(mode);
      setActiveTab('Resume');
    },
    []
  );

  const uploadsBase = useMemo(() => {
    const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api/v1';
    // remove trailing "/api/v1" (and possible trailing slash) to build absolute "/uploads/..." links
    return apiBase.replace(/\/api\/v1\/?$/, '');
  }, []);
  const toFileHref = (fileUrl?: string | null) => buildFileHref(fileUrl, uploadsBase);

  const linkedJob = useMemo(() => {
    const jobId = candidate?.assignedJobId || null;
    if (!jobId) return { title: '', company: '' };
    const job = jobs.find((j) => j.id === jobId);
    if (!job) {
      const fallbackTitle =
        candidate?.assignedJob && candidate.assignedJob !== '—' ? String(candidate.assignedJob) : '';
      return { title: fallbackTitle, company: '' };
    }
    return {
      title: job.title || '',
      company: job.department || '',
    };
  }, [candidate?.assignedJob, candidate?.assignedJobId, jobs]);

  const linkedJobTitle = linkedJob.title;
  const linkedJobCompany = linkedJob.company;
  const preferredAssessmentJobId = useMemo(
    () => candidate?.assignedJobId || jobs[0]?.id || null,
    [candidate?.assignedJobId, jobs],
  );
  // Backwards-compatible label kept for downstream consumers (single-line).
  const linkedJobLabel = useMemo(() => {
    if (!linkedJobTitle) return '';
    return linkedJobCompany ? `${linkedJobTitle} · ${linkedJobCompany}` : linkedJobTitle;
  }, [linkedJobTitle, linkedJobCompany]);

  const experienceDisplay = useMemo(() => {
    if (!candidate) return '—';
    const work = collectCandidateWorkEntries(candidate);
    const years = resolveCandidateExperienceYears(candidate);
    return formatCandidateExperienceForTable(years, work.length);
  }, [candidate]);

  const titleLine = useMemo(() => {
    if (!candidate) return '—';
    const role =
      candidate.currentTitle && candidate.currentCompany
        ? `${candidate.currentTitle} · ${candidate.currentCompany}`
        : candidate.currentTitle || candidate.currentCompany || '—';
    const exp =
      experienceDisplay && experienceDisplay !== '—' ? ` · ${experienceDisplay} exp (CV)` : '';
    return `${role}${exp}`;
  }, [candidate, experienceDisplay]);

  const startOverviewEdit = useCallback(() => {
    if (!candidate) return;
    setActiveTab('Overview');
    setEditError('');
    setEditForm(buildCandidateEditForm(candidate));
    if (isPhase1PortalCandidate(candidate)) {
      setPhase1EditSnapshot(initPhase1EditSnapshotFromProfile(candidate));
    } else {
      setPhase1EditSnapshot(null);
    }
    setShowEditModal(true);
  }, [candidate]);

  const cancelOverviewEdit = useCallback(() => {
    setEditError('');
    if (editAvatarPreviewRef.current) {
      URL.revokeObjectURL(editAvatarPreviewRef.current);
      editAvatarPreviewRef.current = '';
    }
    setEditAvatarFile(null);
    setEditAvatarPreview('');
    if (candidate) {
      setEditForm(buildCandidateEditForm(candidate));
      if (isPhase1PortalCandidate(candidate)) {
        setPhase1EditSnapshot(initPhase1EditSnapshotFromProfile(candidate));
      }
    }
    if (openEditDirectly) {
      onClose();
    } else {
      setShowEditModal(false);
    }
  }, [candidate, onClose, openEditDirectly]);

  const handleAction = (
    action: 'move-stage' | 'schedule-interview' | 'more' | 'edit'
  ) => {
    if (action === 'move-stage') {
      setShowAddToPipelineModal(true);
      return;
    }
    if (action === 'schedule-interview') {
      setShowScheduleInterviewModal(true);
      return;
    }
    if (action === 'edit') {
      startOverviewEdit();
      return;
    }
    if (candidate) onAction?.(action, candidate);
  };

  const fallbackCurrentUser = currentUser || {
    id: 'current-user',
    name: 'You',
    avatar: null,
  };

  const groupedActivity = useMemo(() => {
    const items = [...(candidate?.activity || [])].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    const groups: Array<{
      label: string;
      items: typeof items;
    }> = [];

    for (const item of items) {
      const label = formatTimelineDateLabel(item.timestamp);
      const existing = groups.find((group) => group.label === label);
      if (existing) {
        existing.items.push(item);
      } else {
        groups.push({ label, items: [item] });
      }
    }

    return groups;
  }, [candidate?.activity]);

  const overviewContentKey = useMemo(() => {
    if (!candidate) return 'overview-empty';
    return [
      candidate.id,
      candidate.currentTitle,
      candidate.currentCompany,
      candidate.phone,
      candidate.email,
      JSON.stringify(candidate.extraData ?? null),
    ].join('|');
  }, [candidate]);

  useEffect(() => {
    if (isOpen && activeTab === 'Activity' && activityContainerRef.current) {
      activityContainerRef.current.scrollTop = activityContainerRef.current.scrollHeight;
    }
  }, [activeTab, isOpen, groupedActivity]);

  useEffect(() => {
    if (!toastMessage) return undefined;
    const timeout = window.setTimeout(() => setToastMessage(''), 3000);
    return () => window.clearTimeout(timeout);
  }, [toastMessage]);

  useEffect(() => {
    if (!candidate) {
      setEditForm(null);
      setPhase1EditSnapshot(null);
      return;
    }
    setEditForm(buildCandidateEditForm(candidate));
    if (isPhase1PortalCandidate(candidate)) {
      setPhase1EditSnapshot(initPhase1EditSnapshotFromProfile(candidate));
    } else {
      setPhase1EditSnapshot(null);
    }
    setEditError('');
  }, [candidate]);

  useEffect(() => {
    if (!candidate || !editModalOpenToken || loadingCandidateProfile) return;
    if (lastEditModalOpenTokenRef.current === editModalOpenToken) return;
    lastEditModalOpenTokenRef.current = editModalOpenToken;
    startOverviewEdit();
  }, [candidate, editModalOpenToken, loadingCandidateProfile, startOverviewEdit]);

  const updateEditField = <K extends keyof CandidateEditFormState>(
    field: K,
    value: CandidateEditFormState[K]
  ) => {
    setEditForm((prev) => (prev ? { ...prev, [field]: value } : prev));
  };

  const handleEditAvatarFile = (file: File) => {
    if (!file) return;
    if (file.size > MAX_EDIT_AVATAR_FILE_BYTES) {
      toast.error('Photo must be 5MB or smaller.');
      return;
    }
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file.');
      return;
    }
    if (editAvatarPreviewRef.current) {
      URL.revokeObjectURL(editAvatarPreviewRef.current);
    }
    const preview = URL.createObjectURL(file);
    editAvatarPreviewRef.current = preview;
    setEditAvatarPreview(preview);
    setEditAvatarFile(file);
  };

  const clearEditAvatarFile = () => {
    if (editAvatarPreviewRef.current) {
      URL.revokeObjectURL(editAvatarPreviewRef.current);
      editAvatarPreviewRef.current = '';
    }
    setEditAvatarPreview('');
    setEditAvatarFile(null);
    updateEditField('avatar', '');
  };

  const handleEditSave = async () => {
    if (!candidate || !onUpdateCandidate) return;
    const isPhase1Edit = isPhase1PortalCandidate(candidate) && phase1EditSnapshot;
    if (!isPhase1Edit && !editForm) return;

    try {
      setIsSavingEdit(true);
      setEditError('');
      if (!isPhase1Edit && editForm) {
        validateEditFormStructured(editForm);
      }

      let payload = isPhase1Edit
        ? buildUpdatePayloadFromPhase1EditSnapshot(candidate, phase1EditSnapshot)
        : buildUpdatePayloadFromEditForm(editForm!, candidate.extraData);

      if (isPhase1Edit && editForm) {
        payload = applyHiringFieldsFromEditForm(payload, editForm);
      }

      if (editAvatarFile) {
        try {
          const uploadResponse = await apiUploadCandidateAvatar(candidate.id, editAvatarFile);
          const data = uploadResponse?.data;
          const photoUrl =
            (typeof data === 'object' && data?.fileUrl) ||
            (typeof data === 'string' ? data : null);
          if (photoUrl) {
            payload.avatar = photoUrl;
          }
        } catch (photoError: unknown) {
          const message =
            photoError instanceof Error ? photoError.message : 'Photo upload failed';
          setEditError(message);
          return;
        }
      }

      await Promise.resolve(onUpdateCandidate(candidate.id, payload));
      if (onRefreshCandidate) {
        await Promise.resolve(onRefreshCandidate(candidate.id));
      }

      if (editAvatarPreviewRef.current) {
        URL.revokeObjectURL(editAvatarPreviewRef.current);
        editAvatarPreviewRef.current = '';
      }
      setEditAvatarFile(null);
      if (openEditDirectly) {
        onClose();
      } else {
        setShowEditModal(false);
      }
      setToastMessage('Candidate updated successfully.');
    } catch (error: any) {
      setEditError(error?.message || 'Unable to update candidate right now.');
    } finally {
      setIsSavingEdit(false);
    }
  };

  const candidateEditFormSections =
    isPhase1PortalCandidate(candidate) && phase1EditSnapshot ? (
      <>
        <CandidatePhase1SubmitEditSections
          candidate={candidate}
          snapshot={phase1EditSnapshot}
          onChange={setPhase1EditSnapshot}
        />
        {editForm ? (
          <CandidateHiringEditSection
            form={editForm}
            onChange={updateEditField}
            recruiters={recruiters}
            jobs={jobs}
          />
        ) : null}
      </>
    ) : editForm ? (
      <CandidateEditAtsSections
        form={editForm}
        onChange={updateEditField}
        recruiters={recruiters}
        jobs={jobs}
        avatarPreview={editAvatarPreview}
        onAvatarFile={handleEditAvatarFile}
        onAvatarRemove={clearEditAvatarFile}
      />
    ) : null;

  const candidateEditFormActions = (
    <>
      <button
        type="button"
        onClick={cancelOverviewEdit}
        disabled={isSavingEdit}
        className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
      >
        Cancel
      </button>
      <button
        type="button"
        onClick={() => void handleEditSave()}
        disabled={
          isSavingEdit ||
          (isPhase1PortalCandidate(candidate) ? !phase1EditSnapshot : !editForm)
        }
        className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
      >
        <SquarePen size={16} />
        {isSavingEdit ? 'Saving...' : 'Save Candidate'}
      </button>
    </>
  );

  const candidateEditFormFooter = (
    <div className="sticky bottom-0 z-10 -mx-5 border-t border-slate-200 bg-slate-50/95 px-5 py-4 backdrop-blur sm:-mx-6 sm:px-6">
      <div className="flex flex-wrap items-center justify-end gap-3">
        {candidateEditFormActions}
      </div>
    </div>
  );

  const drawerTree = (
    <AnimatePresence>
      {isOpen && candidate ? (
        <React.Fragment key="candidate-profile-drawer">
          <AnimatePresence>
            {toastMessage ? (
              <motion.div
                key="candidate-profile-toast"
                initial={{ opacity: 0, y: -12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                className={`fixed right-4 top-4 ${layer.toast} rounded-2xl border border-blue-200 bg-white px-4 py-3 text-sm font-medium text-slate-800 shadow-xl`}
              >
                {toastMessage}
              </motion.div>
            ) : null}
          </AnimatePresence>
          <AddToPipelineModal
            isOpen={showAddToPipelineModal}
            candidate={candidate}
            jobs={jobs}
            recruiters={recruiters}
            onClose={() => setShowAddToPipelineModal(false)}
            onSubmit={onAddToPipeline}
            onRemoveFromPipeline={onRemoveFromPipeline}
            onRequestReject={
              onRejectCandidate
                ? ({ jobId }) => {
                    setRejectModalJobId(jobId);
                    setShowAddToPipelineModal(false);
                    setShowRejectModal(true);
                  }
                : undefined
            }
          />
          <ScheduleInterviewModal
            isOpen={showScheduleInterviewModal}
            candidate={candidate}
            linkedJobLabel={linkedJobLabel}
            linkedJobTitle={linkedJobTitle}
            linkedJobCompany={linkedJobCompany}
            initialJobId={candidate.assignedJobId}
            jobs={jobs}
            interviewers={interviewers}
            existingInterviews={existingInterviews.length ? existingInterviews : candidate.scheduledInterviews || []}
            onClose={() => {
              setShowScheduleInterviewModal(false);
              setEditInterview(null);
            }}
            onSchedule={onScheduleInterview}
            onUpdate={async (interviewId, payload) => {
              await Promise.resolve(onScheduleInterview?.({ ...payload, id: interviewId }));
            }}
            editInterview={editInterview}
            onScheduledSuccess={(message) => setToastMessage(message)}
          />
          <RejectCandidateModal
            isOpen={showRejectModal}
            candidate={candidate}
            onClose={() => setShowRejectModal(false)}
            onReject={onRejectCandidate}
          />
          {isDirectEditLaunch ? (
            <>
              <DetailsModalShell
                onBackdropClick={cancelOverviewEdit}
                size="md"
                zIndexClass="z-[110]"
                dialogTitleId="candidate-edit-modal-title"
              >
                <div className="flex h-full w-full flex-col bg-slate-50">
                  <div className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 backdrop-blur">
                    <div className="flex items-start justify-between gap-4 px-5 py-5 sm:px-6">
                      <div className="flex min-w-0 gap-4">
                        <ImageWithFallback
                          src={editAvatarPreview || candidate.avatar || ''}
                          fallbackInitials={initialsFromDisplayName(candidate.name)}
                          alt={candidate.name}
                          className="h-16 w-16 shrink-0 rounded-2xl object-cover text-lg ring-1 ring-slate-200"
                        />
                        <div className="min-w-0">
                          <div className="inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-blue-600">
                            <SquarePen size={16} />
                            Edit Candidate
                          </div>
                          <h2 className="mt-2 truncate text-2xl font-bold text-slate-900">{candidate.name}</h2>
                          <p className="mt-1 truncate text-sm text-slate-500">{titleLine}</p>
                        </div>
                      </div>
                      {!loadingCandidateProfile && onUpdateCandidate ? (
                        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                          {candidateEditFormActions}
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={cancelOverviewEdit}
                          className="rounded-xl p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
                          aria-label="Close edit candidate drawer"
                        >
                          <X size={20} />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className={`flex-1 overflow-y-auto px-5 py-5 sm:px-6 ${DRAWER_FORM_SCROLL_BG}`}>
                    {loadingCandidateProfile ? (
                      <div className="flex min-h-[20rem] flex-col items-center justify-center gap-3 text-slate-500">
                        <Loader2 size={28} className="animate-spin text-blue-600" />
                        <p className="text-sm font-medium">Loading candidate details...</p>
                      </div>
                    ) : onUpdateCandidate ? (
                      <div className="space-y-5">
                        {editError ? (
                          <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                            {editError}
                          </div>
                        ) : null}
                        {candidateEditFormSections}
                      </div>
                    ) : (
                      <p className="text-sm text-slate-500">You do not have permission to edit this candidate.</p>
                    )}
                  </div>
                </div>
              </DetailsModalShell>
            </>
          ) : (
          <>
              <DetailsModalShell
                panelRef={candidateDrawerPanelRef}
                onBackdropClick={() => void requestCandidateDrawerClose()}
                size="lg"
                zIndexClass="z-[100]"
                dialogTitleId="candidate-detail-modal-title"
              >
                <div className="flex h-full w-full flex-col bg-slate-50">
              <div className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 backdrop-blur">
                <div className="flex items-start justify-between gap-4 px-5 py-5 sm:px-6">
                  <div className="flex min-w-0 gap-4">
                    <ImageWithFallback
                      src={candidate.avatar || ''}
                      fallbackInitials={initialsFromDisplayName(candidate.name)}
                      alt={candidate.name}
                      className="h-16 w-16 shrink-0 rounded-2xl object-cover text-lg ring-1 ring-slate-200"
                    />

                    <div className="min-w-0">
                      <h2 className="truncate text-2xl font-bold text-slate-900">{candidate.name}</h2>
                      <p className="mt-1 truncate text-sm text-slate-500">{titleLine}</p>

                      <div className="mt-4 space-y-2 text-sm">
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-slate-700">
                          <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-1 text-xs">
                            <span className="font-medium text-indigo-600">Assigned Job</span>
                            <span className="font-semibold text-indigo-900">{linkedJobLabel || candidate.assignedJob || '—'}</span>
                          </span>
                          <span
                            className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold ${getStageClasses(
                              candidate.stage
                            )}`}
                          >
                            <span className="opacity-80">Stage</span>
                            <span>{candidate.stage || '—'}</span>
                          </span>
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs">
                            <span className="font-medium text-emerald-600">Team Member</span>
                            <span className="font-semibold text-emerald-900">{candidate.recruiter || '—'}</span>
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-slate-700">
                          <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                            Quick Contact
                          </span>
                          <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-xs">
                            <span className="font-medium text-blue-600">Email</span>
                            <span className="font-semibold text-blue-900">{candidate.email || '—'}</span>
                          </span>
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs">
                            <span className="font-medium text-amber-600">Phone</span>
                            <span className="font-semibold text-amber-900">{candidate.phone || '—'}</span>
                          </span>
                          <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2.5 py-1 text-xs">
                            <span className="font-medium text-violet-600">Location</span>
                            <span className="font-semibold text-violet-900">{candidate.location || '—'}</span>
                          </span>
                          <span className="inline-flex items-center gap-1 rounded-full bg-teal-50 px-2.5 py-1 text-xs">
                            <span className="font-medium text-teal-600">Experience (CV)</span>
                            <span className="font-semibold text-teal-900">{experienceDisplay}</span>
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => void requestCandidateDrawerClose()}
                    className="rounded-xl p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
                    aria-label="Close candidate profile"
                  >
                    <X size={20} />
                  </button>
                </div>

                <div className="px-5 pb-4 sm:px-6">
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={startOverviewEdit}
                      className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium ${
                        showEditModal
                          ? 'border-blue-200 bg-blue-50 text-blue-800'
                          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <SquarePen size={15} />
                      {showEditModal ? 'Editing Overview' : 'Edit Candidate'}
                    </button>
                    {candidate?.resumeUrl?.trim() ? (
                      <button
                        type="button"
                        onClick={() => saasaCv.openModal()}
                        disabled={saasaCv.busy}
                        className="inline-flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-900 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <MessageSquare size={15} />
                        HRYantra CV
                        {saasaCv.annotationCount > 0 ? (
                          <span className="rounded-full bg-amber-200 px-1.5 py-0.5 text-[10px] font-bold tabular-nums">
                            {saasaCv.annotationCount}
                          </span>
                        ) : null}
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => handleAction('move-stage')}
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    >
                      Move Stage
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAction('schedule-interview')}
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    >
                      Schedule Interview
                    </button>
                    {onSubmitToClient && showSubmitToClient && profileCanSubmitToClient(candidate) ? (
                      <button
                        type="button"
                        onClick={() => onSubmitToClient(candidate)}
                        className="inline-flex items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-medium text-indigo-800 hover:bg-indigo-100"
                      >
                        <Send size={15} />
                        Submit to Client
                      </button>
                    ) : null}
                  </div>
                </div>

                <div className="flex gap-1 overflow-x-auto border-t border-slate-200 px-3 py-2 sm:px-4">
                  {TABS.map((tab) => (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setActiveTab(tab)}
                      className={`rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
                        activeTab === tab
                          ? 'bg-blue-50 text-blue-700'
                          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                      }`}
                    >
                      {tab}
                    </button>
                  ))}
                </div>
              </div>

              <div className={`flex-1 overflow-y-auto px-5 py-5 sm:px-6 ${DRAWER_FORM_SCROLL_BG}`}>
                {activeTab === 'Overview' && (
                  <div className="space-y-5">
                    {showEditModal && onUpdateCandidate ? (
                      <>
                        {editError ? (
                          <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                            {editError}
                          </div>
                        ) : null}
                        {candidateEditFormSections}
                        {candidateEditFormFooter}
                      </>
                    ) : (
                      <>
                        {candidate?.id ? (
                          <>
                            <EntityWorkspaceAlertsPanel
                              entityType="CANDIDATE"
                              entityId={candidate.id}
                              entityLabel={candidate.name || candidate.email || 'Candidate'}
                            />
                          </>
                        ) : null}
                        {isPhase1PortalCandidate(candidate) ? (
                          <CandidatePhase1DetailSections key={overviewContentKey} candidate={candidate} />
                        ) : (
                          <CandidateAtsExtractedOverview key={overviewContentKey} candidate={candidate} />
                        )}
                      </>
                    )}
                  </div>
                )}

                {activeTab === 'Resume' && (
                  <div className="flex h-[calc(100vh-18rem)] min-h-[560px] flex-col">
                    <CandidateResumeTabPanel
                      candidate={candidate}
                      enabled={activeTab === 'Resume'}
                      cvEditor={cvEditor}
                      preferredResumeViewMode={resumeTabViewPreference}
                      saasaSavedFileUrl={saasaCv.stored?.fileUrl ?? null}
                      onOpenSaasaCv={() => saasaCv.openModal()}
                      onToast={(message) => setToastMessage(message)}
                      onCandidateUpdated={
                        onRefreshCandidate
                          ? () => onRefreshCandidate(candidate.id)
                          : undefined
                      }
                    />
                  </div>
                )}

                {activeTab === 'Interviews' && (() => {
                  const interviews =
                    (existingInterviews.length ? existingInterviews : candidate.scheduledInterviews || []).slice();
                  interviews.sort((a, b) => {
                    const aTs = new Date(`${a.date} ${a.time}`).getTime();
                    const bTs = new Date(`${b.date} ${b.time}`).getTime();
                    return bTs - aTs;
                  });

                  const ModeIcon = ({ mode }: { mode: CandidateScheduledInterview['mode'] }) => {
                    if (mode === 'video') return <Video size={14} className="text-indigo-600" />;
                    if (mode === 'phone') return <Phone size={14} className="text-emerald-600" />;
                    return <MapPin size={14} className="text-amber-600" />;
                  };
                  const statusStyles: Record<CandidateScheduledInterview['status'], string> = {
                    scheduled: 'bg-blue-50 text-blue-700 ring-blue-200',
                    completed: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
                    cancelled: 'bg-rose-50 text-rose-700 ring-rose-200',
                  };

                  return (
                    <DrawerSectionCard
                      title="Interviews"
                      subtitle="Scheduled and completed interviews for this candidate"
                      icon={Calendar}
                      accent="amber"
                    >
                      <div className="flex flex-wrap items-center justify-end gap-3">
                        <button
                          type="button"
                          onClick={() => handleAction('schedule-interview')}
                          className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
                        >
                          <Calendar size={16} />
                          Schedule Interview
                        </button>
                      </div>

                      <div className="space-y-3">
                        {interviews.length === 0 ? (
                          <div className="flex min-h-[14rem] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 py-10 text-center">
                            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-white ring-1 ring-slate-200">
                              <Calendar size={20} className="text-slate-400" />
                            </div>
                            <h4 className="text-sm font-semibold text-slate-800">No interviews scheduled</h4>
                            <p className="mt-1 max-w-sm text-sm text-slate-500">
                              Schedule an interview to track rounds, interviewers, and meeting details.
                            </p>
                          </div>
                        ) : (
                          interviews.map((it) => (
                            <div
                              key={it.id}
                              className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                            >
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">
                                      <ModeIcon mode={it.mode} />
                                      {it.mode === 'video' ? 'Video' : it.mode === 'phone' ? 'Phone' : 'In-person'}
                                    </span>
                                    <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ring-1 ${statusStyles[it.status]}`}>
                                      {it.status === 'scheduled' ? 'Scheduled' : it.status === 'completed' ? 'Completed' : 'Cancelled'}
                                    </span>
                                    <span className="inline-flex items-center rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">
                                      Round {it.round}
                                    </span>
                                    {it.jobTitle ? (
                                      <span className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-600 ring-1 ring-slate-200">
                                        <Briefcase size={12} />
                                        {it.jobTitle}
                                      </span>
                                    ) : null}
                                  </div>
                                  <h4 className="mt-3 text-sm font-semibold text-slate-900">{it.type}</h4>
                                  <p className="mt-1 text-sm text-slate-600">
                                    {it.date} · {it.time} · {it.duration}
                                  </p>
                                </div>
                                <div className="flex flex-wrap items-center gap-2">
                                  {it.status !== 'completed' ? (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setEditInterview(it);
                                        setShowScheduleInterviewModal(true);
                                      }}
                                      className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                                    >
                                      <SquarePen size={16} />
                                      Edit
                                    </button>
                                  ) : null}
                                  {it.meetingLink ? (
                                    <a
                                      href={it.meetingLink}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                                    >
                                      <Video size={16} />
                                      Join link
                                    </a>
                                  ) : null}
                                  {it.location ? (
                                    <span className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700">
                                      <MapPin size={16} />
                                      <span className="max-w-[220px] truncate">{it.location}</span>
                                    </span>
                                  ) : null}
                                  {it.phoneNumber ? (
                                    <span className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700">
                                      <Phone size={16} />
                                      {it.phoneNumber}
                                    </span>
                                  ) : null}
                                </div>
                              </div>

                              <div className="mt-4 border-t border-slate-200 pt-4">
                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                                  Interview panel
                                </p>
                                <div className="mt-2 flex flex-wrap gap-2">
                                  {it.interviewers.map((p) => (
                                    <span
                                      key={p.id}
                                      className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-700 ring-1 ring-slate-200"
                                    >
                                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-[10px] font-semibold text-blue-700">
                                        {getAvatarInitials(p.name)}
                                      </span>
                                      <span className="truncate">{p.name}</span>
                                      <span className="text-slate-400">·</span>
                                      <span className="text-slate-500">{p.role}</span>
                                    </span>
                                  ))}
                                </div>
                                {it.notes ? (
                                  <p className="mt-3 text-sm text-slate-600">{it.notes}</p>
                                ) : null}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </DrawerSectionCard>
                  );
                })()}

                {activeTab === 'Assessments' && candidate?.id ? (
                  <CandidateAssessmentsTabPanel
                    candidateId={candidate.id}
                    preferredJobId={preferredAssessmentJobId}
                    enabled={activeTab === 'Assessments'}
                  />
                ) : null}

                {activeTab === 'Activity' && (
                  <div className="space-y-5">
                    <EntityAuditSummary
                      audit={
                        candidate?.auditMeta ??
                        extractAuditMeta(candidate as Record<string, unknown> | undefined)
                      }
                    />
                    <DrawerSectionCard
                      title="Recent Activity"
                      subtitle="Stage changes, interviews, notes, and resume parsing"
                      icon={Activity}
                      accent="blue"
                    >
                    <div ref={activityContainerRef} className="max-h-[32rem] space-y-6 overflow-y-auto pr-1">
                      {groupedActivity.length > 0 ? (
                        groupedActivity.map((group, groupIndex) => (
                          <div key={`${group.label || 'activity'}-${groupIndex}`}>
                            <div className="sticky top-0 z-[1] mb-4 inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                              {group.label}
                            </div>

                            <div className="relative ml-3 space-y-5 border-l-2 border-slate-200 pl-8">
                              {group.items.map((item, itemIndex) => {
                                const config = getTimelineConfig(item.type);
                                const Icon = config.Icon;

                                return (
                                  <div
                                    key={item.id || `${groupIndex}-${itemIndex}-${item.timestamp || item.type}`}
                                    className="relative rounded-2xl border border-slate-200 bg-slate-50 p-4"
                                  >
                                    <span
                                      className={`absolute -left-[2.15rem] top-6 h-3.5 w-3.5 rounded-full border-2 border-white ${config.dotClass}`}
                                    />

                                    <div className="flex items-start gap-3">
                                      <div className={`rounded-xl p-2 ${config.iconClass}`}>
                                        <Icon size={16} />
                                      </div>

                                      <div className="min-w-0 flex-1">
                                        <div className="flex flex-wrap items-center justify-between gap-2">
                                          <div>
                                            <h4 className="text-sm font-semibold text-slate-900">{item.title}</h4>
                                            {item.description ? (
                                              <p className="mt-1 text-sm leading-6 text-slate-600">
                                                {item.description}
                                              </p>
                                            ) : null}
                                          </div>
                                          <span className="text-xs text-slate-500">
                                            {formatDateTimeDMY(item.timestamp)}
                                          </span>
                                        </div>

                                        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                                          <div className="flex items-center gap-2">
                                            {item.performedBy.avatar ? (
                                              <img
                                                src={item.performedBy.avatar}
                                                alt={item.performedBy.name}
                                                className="h-8 w-8 rounded-full object-cover ring-1 ring-slate-200"
                                              />
                                            ) : (
                                              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-xs font-semibold text-blue-700">
                                                {getAvatarInitials(item.performedBy.name)}
                                              </div>
                                            )}
                                            <div>
                                              <p className="text-xs text-slate-400">Performed by</p>
                                              <p className="text-sm font-medium text-slate-700">{item.performedBy.name}</p>
                                            </div>
                                          </div>

                                          {item.relatedJob ? (
                                            <span className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-600 ring-1 ring-slate-200">
                                              <Briefcase size={12} />
                                              {item.relatedJob}
                                            </span>
                                          ) : null}
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="flex min-h-[18rem] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 py-10 text-center">
                          <div className="relative mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-white ring-1 ring-slate-200">
                            <div className="absolute h-10 w-0.5 bg-slate-200" />
                            <span className="absolute h-3 w-3 rounded-full bg-slate-300" />
                            <Calendar size={22} className="text-slate-400" />
                          </div>
                          <h4 className="text-sm font-semibold text-slate-800">No activity yet</h4>
                          <p className="mt-1 max-w-sm text-sm text-slate-500">
                            Candidate actions like stage changes, interviews, notes, and resume parsing will appear here.
                          </p>
                        </div>
                      )}
                    </div>
                    </DrawerSectionCard>
                  </div>
                )}

                {activeTab === 'Remarks' && (
                  <DrawerSectionCard
                    title="Remarks"
                    subtitle="Internal notes and comments"
                    icon={MessageSquareText}
                    accent="rose"
                  >
                    <InternalNotesSection
                    notes={candidate.notes || []}
                    candidateId={candidate.id}
                    currentUser={fallbackCurrentUser}
                    onAddNote={onAddNote}
                    onEditNote={onEditNote}
                    onDeleteNote={onDeleteNote}
                    onPinNote={onPinNote}
                  />
                  </DrawerSectionCard>
                )}

                {activeTab === 'Tags' && (
                  <DrawerSectionCard
                    title="Tags"
                    subtitle="Organize and filter candidates"
                    icon={Tag}
                    accent="violet"
                  >
                      <CandidateTagSystem
                        candidateId={candidate.id}
                        existingTags={candidate.tags || []}
                        availableTags={availableTags}
                        onAddTag={onAddTag}
                        onRemoveTag={onRemoveTag}
                        onCreateTag={onCreateTag}
                      />
                  </DrawerSectionCard>
                )}

                {activeTab === 'Files' && (
                  <DrawerSectionCard
                    title="Files"
                    subtitle="Upload and manage candidate documents"
                    icon={Paperclip}
                    accent="indigo"
                  >
                    <div className="flex flex-wrap items-center justify-end gap-3">
                      <DocumentUploadButton
                        disabled={!candidate?.id}
                        isUploading={candidateFilesUploading}
                        uploadSuccess={candidateFilesUploadSuccess}
                        uploadPercent={candidateFilesUploadPercent}
                        label="Upload File"
                        onFilesSelected={async (files) => {
                          await uploadCandidateFile(files[0], 'Other');
                        }}
                      />
                    </div>

                    {candidateFilesError ? (
                      <p className="text-sm text-red-600">{candidateFilesError}</p>
                    ) : null}

                    <div className="space-y-4">
                      <CandidateCvFilesSection
                        candidate={candidate}
                        cvEditor={cvEditor}
                        saasaCv={saasaCv}
                        saasaCvFileEntry={saasaCvFileEntry}
                        originalResumeUrl={originalResumeFileUrl}
                        uploadsBase={uploadsBase}
                        canEdit={Boolean(onUpdateCandidate)}
                        onToast={handleCvToast}
                        onViewResumeTab={handleViewResumeTabFromFiles}
                      />

                      {candidateFilesOther.length > 0 ? (
                        <div>
                          <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Other documents
                          </h4>
                        </div>
                      ) : null}

                      {candidateFilesLoading ? (
                        <p className="text-sm text-slate-500">Loading attached files…</p>
                      ) : candidateFilesOther.length > 0 ? (
                        candidateFilesOther.map((file) => (
                          <div
                            key={file.id}
                            className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3"
                          >
                            <a
                              href={toFileHref(file.fileUrl)}
                              target={file.fileUrl ? '_blank' : undefined}
                              rel={file.fileUrl ? 'noreferrer' : undefined}
                              className="min-w-0 flex-1"
                            >
                              <div className="flex items-center justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-medium text-slate-900">{file.fileName}</p>
                                  <p className="mt-0.5 text-xs text-slate-500">
                                    {file.fileType}{file.uploadedBy?.name ? ` · ${file.uploadedBy.name}` : ''}
                                  </p>
                                </div>
                                <FileText size={16} className="shrink-0 text-slate-400" />
                              </div>
                            </a>
                            <button
                              type="button"
                              onClick={() => deleteCandidateFile(file.id)}
                              className="shrink-0 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                            >
                              Delete
                            </button>
                          </div>
                        ))
                      ) : !originalResumeFileUrl && !saasaCvFileEntry && candidateFilesOther.length === 0 ? (
                        <p className="text-sm text-slate-500">No files uploaded.</p>
                      ) : null}
                    </div>
                  </DrawerSectionCard>
                )}

                {activeTab === 'Chat' && (
                  <DrawerSectionCard
                    title="Chat"
                    subtitle={`Messages with ${candidate?.name || 'candidate'}`}
                    icon={MessageSquare}
                    accent="blue"
                  >
                    <DrawerEntityChatTab
                      entityType="CANDIDATE"
                      entityId={candidate?.id}
                      entityLabel={candidate?.name}
                      isActive={activeTab === 'Chat'}
                      isOpen={isOpen}
                    />
                  </DrawerSectionCard>
                )}
              </div>
                </div>
              </DetailsModalShell>
          </>
          )}
          {cvEditor.modals}
          {saasaCv.modals}
        </React.Fragment>
      ) : null}
    </AnimatePresence>
  );

  if (!drawerPortalMounted) return null;
  return createPortal(drawerTree, document.body);
}
