'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { matchesQuickSearch } from '../../lib/quickSearch';
import { AnimatePresence, motion } from 'motion/react';
import { buildFileHref } from '../../utils/cloudinaryUrls';
import { formatDateDMY } from '../../utils/dateDisplay';
import { ArrowRightCircle, Briefcase, Calendar, Check, CheckCircle2, ClipboardList, FileSearch, FileText, LayoutGrid, AlertTriangle, MessageSquare, MessageSquareText, MoreVertical, Pin, Plus, Search, SquarePen, SendHorizontal, StickyNote, Tag, Trash2, X, Activity, Paperclip } from 'lucide-react';
import { getCandidateStageBadgeClasses } from '../../utils/candidateStage';
import { type BackendInterviewListItem, type UpdateCandidatePayload } from '../../lib/api';
import { stripAssigneeCompanySuffix } from '../../lib/assigneeDisplay';
import { formatInterviewTimeInTimezone, getInterviewDateInputYmd, INTERVIEW_DURATION_LABELS, interviewDurationMinutesToLabel } from '../../lib/interview-schedule-helpers';
import { DEFAULT_INTERVIEW_TIMEZONE } from '../../utils/inferTimezone';
import type { CandidateProfileDrawerData, CandidateScheduledInterview, CandidateTagItem } from './candidateProfileDrawerData';

export const MAX_EDIT_AVATAR_FILE_BYTES = 5 * 1024 * 1024;

export function resolveCandidateAvatarPreviewUrl(raw: string, uploadsBase: string): string {
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
  /** Job status label/enum used to keep schedule picker on open roles. */
  status?: string | null;
  orgUnitId?: string | null;
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

export interface CandidateProfileDrawerProps {
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
  /** From Move stage → Interviewing: open Schedule Interview (stage after success). */
  onMoveStageScheduleInterview?: (payload: {
    candidateId: string;
    jobId: string;
    stage: string;
    stageId?: string;
  }) => void;
  /** From Move stage → Offer: open Create Placement (stage after success). */
  onMoveStageCreatePlacement?: (payload: {
    candidateId: string;
    jobId: string;
    stage: string;
    stageId?: string;
  }) => void;
  onUpdateCandidate?: (candidateId: string, payload: UpdateCandidatePayload) => void | Promise<void>;
  /** Reload candidate after CV editor save (e.g. loadCandidateProfile). */
  onRefreshCandidate?: (candidateId: string) => void | Promise<void>;
  /** Render above job/details drawers (z ~115) when opened from nested contexts */
  stackAboveSiblingDrawers?: boolean;
}

export type DrawerTab =
  | 'Overview'
  | 'Client'
  | 'Resume'
  | 'Interviews'
  | 'Assessments'
  | 'Activity'
  | 'Remarks'
  | 'Tags'
  | 'Files'
  | 'Chat';

export const TABS: Array<{ id: DrawerTab; label: string; icon: typeof LayoutGrid }> = [
  { id: 'Overview', label: 'Overview', icon: LayoutGrid },
  { id: 'Resume', label: 'Resume', icon: FileText },
  { id: 'Interviews', label: 'Interviews', icon: Calendar },
  { id: 'Assessments', label: 'Assessments', icon: ClipboardList },
  { id: 'Activity', label: 'Activity', icon: Activity },
  { id: 'Remarks', label: 'Remarks', icon: StickyNote },
  { id: 'Tags', label: 'Tags', icon: Tag },
  { id: 'Files', label: 'Files', icon: Paperclip },
  { id: 'Chat', label: 'Chat', icon: MessageSquare },
];

export function getInitials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

export function getStageClasses(stage?: string | null) {
  return getCandidateStageBadgeClasses(stage);
}

export function getAvailabilityDot(status?: string | null) {
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

export function normalizeStringList(value: unknown): string[] {
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

export function formatTimelineDateLabel(value: string) {
  const target = new Date(value);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  const targetKey = target.toDateString();
  if (targetKey === today.toDateString()) return 'Today';
  if (targetKey === yesterday.toDateString()) return 'Yesterday';

  return formatDateDMY(target);
}

export function getTimelineConfig(
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

export function getAvatarInitials(name: string) {
  return stripAssigneeCompanySuffix(name)
    .split(/\s+/)
    .filter((part) => part && part !== '·')
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

export function InterviewerInitialsAvatar({ name, size = 8 }: { name: string; size?: 7 | 8 }) {
  const box = size === 7 ? 'h-7 w-7 text-[10px]' : 'h-8 w-8 text-[10px]';
  return (
    <span className={`flex ${box} shrink-0 items-center justify-center rounded-full bg-blue-100 font-semibold text-blue-700`}>
      {getAvatarInitials(name) || 'NA'}
    </span>
  );
}

export function formatRelativeTime(value: string) {
  const diffMs = Date.now() - new Date(value).getTime();
  const diffMinutes = Math.max(1, Math.floor(diffMs / (1000 * 60)));

  if (diffMinutes < 60) return `${diffMinutes} minute${diffMinutes === 1 ? '' : 's'} ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;

  return formatDateDMY(new Date(value));
}

export interface CandidateTagSystemProps {
  candidateId: string;
  existingTags: CandidateTagItem[];
  availableTags: CandidateTagItem[];
  onAddTag?: (candidateId: string, tag: CandidateTagItem) => void | Promise<void>;
  onRemoveTag?: (candidateId: string, tagId: string) => void | Promise<void>;
  onCreateTag?: (candidateId: string, tagName: string) => Promise<CandidateTagItem | void> | CandidateTagItem | void;
  compact?: boolean;
}

export function CandidateTagChip({
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

export function CandidateTagSystem({
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
    const query = searchValue.trim();
    if (!query) return availableTags;
    return availableTags.filter((tag) => matchesQuickSearch(tag.label, query));
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
          key={`${String(tag.id || tag.label || 'tag').trim()}-${index}`}
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
  /** Opens Submit to client when user picks that option in the stage dropdown. */
  onRequestSubmitToClient?: (payload: { candidateId: string; jobId: string }) => void;
  /** Opens Schedule Interview when user picks Interviewing (stage applies after schedule). */
  onRequestScheduleInterview?: (payload: {
    candidateId: string;
    jobId: string;
    stage: string;
    stageId?: string;
  }) => void;
  /** Opens Create Placement when user picks Offer (stage applies after placement). */
  onRequestOfferPlacement?: (payload: {
    candidateId: string;
    jobId: string;
    stage: string;
    stageId?: string;
  }) => void;
}

export const PIPELINE_REJECTED_STAGE = 'Rejected';

export function isRejectedPipelineStage(stage: string): boolean {
  return stage.trim().toLowerCase().includes('reject');
}

export const REJECT_REASONS = [
  'Skill mismatch',
  'Salary too high',
  'Experience mismatch',
  'Client rejected',
  'Communication issue',
  'Other',
] as const;

export const INTERVIEW_TYPES = [
  'HR Screening',
  'Technical Round 1',
  'Technical Round 2',
  'System Design',
  'Cultural Fit',
  'Final Round',
  'Client Interview',
] as const;

export function isOpenScheduleJobStatus(status?: string | null): boolean {
  const key = String(status || '')
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, ' ');
  if (!key) return true;
  if (
    [
      'closed',
      'closed won',
      'closed not won',
      'duplicate',
      'draft',
      'cancelled',
      'canceled',
      'filled',
      'on hold',
      'hold',
    ].includes(key)
  ) {
    return false;
  }
  return true;
}

export function mergeInterviewTypeOptions(
  catalog?: string[] | null,
  current?: string | null,
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const push = (value: string) => {
    const label = String(value || '').trim();
    if (!label) return;
    const key = label.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push(label);
  };
  INTERVIEW_TYPES.forEach(push);
  (Array.isArray(catalog) ? catalog : []).forEach(push);
  if (current) push(current);
  return out;
}

export const INTERVIEW_DURATIONS = INTERVIEW_DURATION_LABELS.filter(
  (option) => !/^(10|15)\s*mins?$/i.test(option),
);

export const INTERVIEW_PANEL_ROLES = ['Lead Interviewer', 'Interviewer', 'Observer'] as const;

export type ScheduleClientContactOption = {
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

export function inferPlatformFromMeetingLink(url: string): 'Google Meet' | 'Zoom' | null {
  const value = String(url || '').trim().toLowerCase();
  if (!value) return null;
  if (value.includes('meet.google.com') || value.includes('google.com/meet')) return 'Google Meet';
  if (value.includes('zoom.us') || value.includes('zoom.com')) return 'Zoom';
  return null;
}

export function normalizePopupInterviewMode(
  interview: Pick<CandidateScheduledInterview, 'mode' | 'meetingLink' | 'platform' | 'phoneNumber'>,
): 'video' | 'in-person' | 'phone' {
  const raw = String(interview.mode || '').trim().toLowerCase();
  if (raw === 'phone' || raw === 'phonecall') return 'phone';
  if (raw === 'video' || raw === 'online' || raw === 'videocall') return 'video';
  if (raw === 'in-person' || raw === 'inperson' || raw === 'offline' || raw === 'onsite') {
    // Meeting link / platform means this is still a video interview even if mode was mis-saved.
    if (interview.meetingLink || interview.platform) return 'video';
    return 'in-person';
  }
  if (interview.phoneNumber && !interview.meetingLink) return 'phone';
  if (interview.meetingLink || interview.platform) return 'video';
  return 'video';
}

export function mapInterviewListItemToScheduled(
  item: BackendInterviewListItem,
  roundIndex: number,
): CandidateScheduledInterview {
  const scheduledAt = String(item.scheduledAt || '');
  const timezone = item.timezone || DEFAULT_INTERVIEW_TIMEZONE;
  const status = String(item.status || '').toUpperCase();
  return {
    id: item.id,
    candidateId: item.candidate?.id ?? '',
    jobId: item.job?.id || null,
    jobTitle: item.job?.title || null,
    type: item.round || item.type || 'Interview',
    round: roundIndex,
    date: scheduledAt ? getInterviewDateInputYmd(scheduledAt, timezone) : '',
    time: scheduledAt ? formatInterviewTimeInTimezone(scheduledAt, timezone) : '',
    duration: interviewDurationMinutesToLabel(Number(item.duration) || 60),
    timezone,
    mode:
      String(item.mode || '').toUpperCase() === 'OFFLINE' && !item.meetingLink && !item.platform
        ? 'in-person'
        : String(item.type || '').toUpperCase() === 'PHONE'
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
      id: member.user?.id ?? '',
      name: member.user?.name ?? '',
      role: 'Interviewer' as const,
    })),
    notes: item.notes || '',
    sendCandidateInvite: true,
    sendInterviewerInvite: true,
    status:
      status === 'COMPLETED' ? 'completed' : status === 'CANCELLED' ? 'cancelled' : 'scheduled',
  };
}

export function isActiveScheduledInterview(status?: string | null): boolean {
  const normalized = String(status || '').trim().toLowerCase();
  return normalized !== 'cancelled';
}

export interface ScheduleInterviewModalProps {
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
  bulkScheduleForCandidateIds?: string[];
  isOpen: boolean;
  onClose: () => void;
  onSchedule?: (interviewData: CandidateScheduledInterview) => void | Promise<void>;
  onUpdate?: (interviewId: string, interviewData: CandidateScheduledInterview) => void | Promise<void>;
  editInterview?: CandidateScheduledInterview | null;
  onScheduledSuccess?: (message: string) => void;
}

export function mapJobsToPipelineOptions(
  backendJobs: Array<{
    id: string;
    title?: string | null;
    department?: string | null;
    status?: string | null;
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
      department: job.department || null,
      clientId: job.client?.id || job.clientId || null,
      clientName: job.client?.companyName || null,
      managerId: job.managerId || job.manager?.id || null,
      managerName: job.manager?.name || null,
      status: job.status || null,
      orgUnitId: (job as { orgUnitId?: string | null }).orgUnitId || null,
    }))
    .sort((a, b) => a.title.localeCompare(b.title));
}

export interface RejectCandidateModalProps {
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

export type RejectModalStep = 'form' | 'confirm' | 'progress' | 'done';

export const REJECT_FEEDBACK_MAX_LENGTH = 100;

export function ProfileRejectFormSwitch({
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

export function RejectCandidateModal({
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
            className="fixed inset-0 z-[130] bg-slate-950/45"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className="fixed inset-0 z-[140] flex items-center justify-center p-4"
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

export interface InternalNotesProps {
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

export function InternalNotesSection({
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
