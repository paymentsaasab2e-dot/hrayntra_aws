'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowRightCircle,
  Briefcase,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Download,
  FileSearch,
  FileText,
  AlertTriangle,
  Minus,
  Mail,
  MapPin,
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
} from 'lucide-react';
import { getCandidateStageBadgeClasses, getCandidateStageLabel } from '../../utils/candidateStage';
import type { LucideIcon } from 'lucide-react';
import { useFiles } from '../../hooks/useFiles';
import { apiGetJob } from '../../lib/api';

export interface CandidateTagItem {
  id: string;
  label: string;
  color: string;
}

export interface CandidatePipelineJobOption {
  id: string;
  title: string;
  department?: string | null;
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

export interface CandidateScheduledInterview {
  id: string;
  candidateId: string;
  jobId?: string | null;
  jobTitle?: string | null;
  type: string;
  round: number;
  date: string;
  time: string;
  duration: string;
  mode: 'video' | 'in-person' | 'phone';
  meetingLink?: string | null;
  location?: string | null;
  phoneNumber?: string | null;
  interviewers: Array<{
    id: string;
    name: string;
    role: 'Lead Interviewer' | 'Interviewer' | 'Observer';
  }>;
  notes?: string;
  sendCandidateInvite?: boolean;
  sendInterviewerInvite?: boolean;
  status: 'scheduled' | 'completed' | 'cancelled';
}

export interface CandidateProfileDrawerData {
  id: string;
  name: string;
  avatar?: string | null;
  currentTitle?: string | null;
  currentCompany?: string | null;
  stage?: string | null;
  experience?: number | null;
  location?: string | null;
  email?: string | null;
  phone?: string | null;
  designation?: string | null;
  expectedSalary?: string | null;
  noticePeriod?: string | null;
  assignedJob?: string | null;
  assignedJobId?: string | null;
  recruiter?: string | null;
  source?: string | null;
  availability?: 'available' | 'limited' | 'unavailable' | string | null;
  resumeUrl?: string | null;
  summary?: string | null;
  tags?: CandidateTagItem[];
  notes?: Array<{
    id: string;
    text: string;
    createdAt: string;
    recruiter: {
      id?: string;
      name: string;
      avatar?: string | null;
    };
    tags?: string[];
    isPinned?: boolean;
  }>;
  files?: Array<{ name: string; url?: string | null }>;
  activity?: Array<{
    id: string;
    type:
      | 'stage-movement'
      | 'email-sent'
      | 'resume-parsed'
      | 'added-to-pipeline'
      | 'interview-scheduled'
      | 'rejected'
      | 'note-added';
    title: string;
    description?: string | null;
    timestamp: string;
    performedBy: {
      name: string;
      avatar?: string | null;
    };
    relatedJob?: string | null;
  }>;
  aiScore?: {
    overall: number;
    breakdown: {
      skillsMatch: number;
      experienceFit: number;
      educationFit: number;
      keywordMatch: number;
    };
    insights: Array<{
      type: 'strength' | 'gap';
      text: string;
    }>;
  };
  scheduledInterviews?: CandidateScheduledInterview[];
}

interface CandidateProfileDrawerProps {
  candidate: CandidateProfileDrawerData | null;
  isOpen: boolean;
  onClose: () => void;
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
  onAction?: (
    action: 'move-stage' | 'schedule-interview' | 'send-email' | 'reject' | 'more',
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
  onRejectCandidate?: (reason: string, feedback: string, sendEmail: boolean) => void | Promise<void>;
  onScheduleInterview?: (interviewData: CandidateScheduledInterview) => void | Promise<void>;
}

type DrawerTab = 'Overview' | 'Resume' | 'Interviews' | 'Activity' | 'Notes' | 'Tags' | 'Files';

const TABS: DrawerTab[] = ['Overview', 'Resume', 'Interviews', 'Activity', 'Notes', 'Tags', 'Files'];

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

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value?: string | null;
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-3">
      <div className="mt-0.5 rounded-lg bg-slate-100 p-2 text-slate-500">
        <Icon size={16} />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
        <p className="mt-1 break-words text-sm font-medium text-slate-700">{value || '—'}</p>
      </div>
    </div>
  );
}

function CircularScore({ value }: { value: number }) {
  const size = 120;
  const stroke = 10;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const safeValue = Math.max(0, Math.min(100, value));
  const offset = circumference - (safeValue / 100) * circumference;

  return (
    <div className="relative flex h-[120px] w-[120px] items-center justify-center">
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={stroke}
          fill="transparent"
          className="text-slate-200"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={stroke}
          fill="transparent"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="text-blue-600 transition-all duration-300"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-bold text-slate-900">{safeValue}%</span>
        <span className="text-xs font-medium uppercase tracking-wide text-slate-400">Match</span>
      </div>
    </div>
  );
}

function ScoreBar({
  label,
  value,
  colorClass,
}: {
  label: string;
  value: number;
  colorClass: string;
}) {
  const safeValue = Math.max(0, Math.min(100, value));

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-slate-700">{label}</span>
        <span className="text-slate-500">{safeValue}%</span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-slate-200">
        <div className={`h-full rounded-full ${colorClass}`} style={{ width: `${safeValue}%` }} />
      </div>
    </div>
  );
}

function buildResumeViewerUrl(resumeUrl: string, zoom: number, page: number) {
  const safeZoom = Math.max(50, Math.min(200, zoom));
  return `${resumeUrl}#toolbar=0&navpanes=0&scrollbar=1&page=${page}&zoom=${safeZoom}`;
}

function formatTimelineDateLabel(value: string) {
  const target = new Date(value);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  const targetKey = target.toDateString();
  if (targetKey === today.toDateString()) return 'Today';
  if (targetKey === yesterday.toDateString()) return 'Yesterday';

  return target.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
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

  return new Date(value).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
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
      {existingTags.map((tag) => (
        <CandidateTagChip
          key={tag.id}
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
              {filteredTags.map((tag) => {
                const selected = normalizedSelectedIds.has(tag.id);
                return (
                  <button
                    key={tag.id}
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

interface AddToPipelineModalProps {
  isOpen: boolean;
  candidate: CandidateProfileDrawerData | null;
  jobs: CandidatePipelineJobOption[];
  recruiters: CandidatePipelineRecruiterOption[];
  onClose: () => void;
  onSubmit?: (payload: {
    candidateId: string;
    jobId: string;
    stage: string;
    recruiterId?: string;
    priority: 'High' | 'Medium' | 'Low';
    notes?: string;
  }) => void | Promise<void>;
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

function generateTimeSlots() {
  const slots: string[] = [];
  for (let hour = 9; hour <= 17; hour += 1) {
    for (const minute of [0, 30]) {
      const date = new Date();
      date.setHours(hour, minute, 0, 0);
      slots.push(
        date.toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
        })
      );
    }
  }
  return slots;
}

function generateMeetLink() {
  const part = () => Math.random().toString(36).slice(2, 5);
  return `https://meet.google.com/${part()}-${part()}-${part()}`;
}

interface ScheduleInterviewModalProps {
  candidate: Pick<
    CandidateProfileDrawerData,
    'id' | 'name' | 'phone' | 'stage' | 'assignedJob' | 'assignedJobId'
  > | null;
  linkedJobLabel?: string;
  interviewers: CandidateInterviewerOption[];
  existingInterviews: CandidateScheduledInterview[];
  isOpen: boolean;
  onClose: () => void;
  onSchedule?: (interviewData: CandidateScheduledInterview) => void | Promise<void>;
  onUpdate?: (interviewId: string, interviewData: CandidateScheduledInterview) => void | Promise<void>;
  editInterview?: CandidateScheduledInterview | null;
  onScheduledSuccess?: (message: string) => void;
}

function ScheduleInterviewModal({
  candidate,
  linkedJobLabel,
  interviewers,
  existingInterviews,
  isOpen,
  onClose,
  onSchedule,
  onUpdate,
  editInterview,
  onScheduledSuccess,
}: ScheduleInterviewModalProps) {
  const [interviewType, setInterviewType] = useState('');
  const [roundNumber, setRoundNumber] = useState(1);
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [duration, setDuration] = useState('');
  const [mode, setMode] = useState<'video' | 'in-person' | 'phone' | ''>('');
  const [meetingLink, setMeetingLink] = useState('');
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

  const typeRef = useRef<HTMLDivElement | null>(null);
  const timeRef = useRef<HTMLDivElement | null>(null);
  const durationRef = useRef<HTMLDivElement | null>(null);
  const interviewerRef = useRef<HTMLDivElement | null>(null);
  const roleMenuRef = useRef<HTMLDivElement | null>(null);

  const timeSlots = useMemo(() => generateTimeSlots(), []);
  const minimumDate = useMemo(() => new Date().toISOString().split('T')[0], []);

  useEffect(() => {
    if (!isOpen) {
      setInterviewType('');
      setRoundNumber((existingInterviews?.length || 0) + 1);
      setDate('');
      setTime('');
      setDuration('');
      setMode('');
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
    }
  }, [candidate?.phone, existingInterviews?.length, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    if (!editInterview) return;
    setInterviewType(editInterview.type || '');
    setRoundNumber(editInterview.round || 1);
    setDate(editInterview.date || '');
    setTime(editInterview.time || '');
    setDuration(editInterview.duration || '');
    setMode((editInterview.mode as any) || '');
    setMeetingLink(editInterview.meetingLink || '');
    setLocation(editInterview.location || '');
    setPhoneNumber(editInterview.phoneNumber || candidate?.phone || '');
    setSelectedInterviewers(editInterview.interviewers || []);
    setSendCandidateInvite(Boolean(editInterview.sendCandidateInvite));
    setSendInterviewerInvite(Boolean(editInterview.sendInterviewerInvite));
    setAdditionalNotes(editInterview.notes || '');
    setStatus(editInterview.status || 'scheduled');
  }, [editInterview, isOpen, candidate?.phone]);

  useEffect(() => {
    if (isOpen) {
      setRoundNumber(Math.max(1, (existingInterviews?.length || 0) + 1));
      setPhoneNumber(candidate?.phone || '');
    }
  }, [candidate?.phone, existingInterviews, isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const handleOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!typeRef.current?.contains(target)) setTypeOpen(false);
      if (!timeRef.current?.contains(target)) setTimeOpen(false);
      if (!durationRef.current?.contains(target)) setDurationOpen(false);
      if (!interviewerRef.current?.contains(target)) setInterviewerOpen(false);
      if (!roleMenuRef.current?.contains(target)) setOpenRoleMenuId(null);
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [isOpen]);

  const filteredInterviewers = useMemo(() => {
    const query = interviewerSearch.trim().toLowerCase();
    if (!query) return interviewers;
    return interviewers.filter(
      (person) =>
        person.name.toLowerCase().includes(query) ||
        (person.role || '').toLowerCase().includes(query) ||
        (person.department || '').toLowerCase().includes(query)
    );
  }, [interviewers, interviewerSearch]);

  const isInterviewerBooked = (interviewerId: string) =>
    Boolean(date && time && existingInterviews.some((interview) => interview.date === date && interview.time === time && interview.interviewers.some((item) => item.id === interviewerId)));

  const validate = () => {
    const nextErrors: Record<string, string | undefined> = {};
    if (!interviewType) nextErrors.interviewType = 'Interview type is required';
    if (!date) nextErrors.date = 'Date is required';
    if (!time) nextErrors.time = 'Time is required';
    if (!duration) nextErrors.duration = 'Duration is required';
    if (!mode) nextErrors.mode = 'Interview mode is required';
    if (selectedInterviewers.length === 0) nextErrors.interviewers = 'Select at least one interviewer';
    if (mode === 'video' && !meetingLink.trim()) nextErrors.modeField = 'Meeting link is required';
    if (mode === 'in-person' && !location.trim()) nextErrors.modeField = 'Location is required';
    if (mode === 'phone' && !phoneNumber.trim()) nextErrors.modeField = 'Phone number is required';
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const isFormValid =
    Boolean(interviewType && date && time && duration && mode) &&
    selectedInterviewers.length > 0 &&
    (mode !== 'video' || Boolean(meetingLink.trim())) &&
    (mode !== 'in-person' || Boolean(location.trim())) &&
    (mode !== 'phone' || Boolean(phoneNumber.trim()));

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

  const handleSchedule = async () => {
    if (!candidate || !validate()) return;

    const payload: CandidateScheduledInterview = {
      id: editInterview?.id || `interview-${Date.now()}`,
      type: interviewType,
      round: roundNumber,
      date,
      time,
      duration,
      mode: mode as 'video' | 'in-person' | 'phone',
      meetingLink: mode === 'video' ? meetingLink.trim() : null,
      location: mode === 'in-person' ? location.trim() : null,
      phoneNumber: mode === 'phone' ? phoneNumber.trim() : null,
      interviewers: selectedInterviewers.map((item) => ({
        id: item.id,
        name: item.name,
        role: item.role,
      })),
      jobId: candidate.assignedJobId || null,
      jobTitle: candidate.assignedJob || null,
      candidateId: candidate.id,
      notes: additionalNotes.trim() || '',
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
      const prettyDate = new Date(`${date}T00:00:00`).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
      onScheduledSuccess?.(editInterview?.id ? `Interview updated (${status})` : `Interview scheduled for ${prettyDate} at ${time}`);
      onClose();
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
                    <div className="sm:col-span-2">
                      <label className="mb-2 block text-sm font-medium text-slate-700">Status</label>
                      <select
                        value={status}
                        onChange={(e) => setStatus(e.target.value as any)}
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                      >
                        <option value="scheduled">Scheduled</option>
                        <option value="completed">Completed</option>
                        <option value="cancelled">Cancelled</option>
                      </select>
                    </div>
                    <div className="sm:col-span-2">
                      <label className="mb-2 block text-sm font-medium text-slate-700">Interview Type</label>
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
                      <label className="mb-2 block text-sm font-medium text-slate-700">Round Number</label>
                      <input
                        type="number"
                        min={1}
                        value={roundNumber}
                        onChange={(e) => setRoundNumber(Math.max(1, Number(e.target.value) || 1))}
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-700">Date</label>
                      <input
                        type="date"
                        min={minimumDate}
                        value={date}
                        onChange={(e) => {
                          setDate(e.target.value);
                          setErrors((prev) => ({ ...prev, date: undefined }));
                        }}
                        className={`w-full rounded-xl border bg-white px-3 py-2.5 text-sm text-slate-700 outline-none ${
                          errors.date ? 'border-red-300' : 'border-slate-200'
                        } focus:border-blue-400 focus:ring-2 focus:ring-blue-100`}
                      />
                      {errors.date ? <p className="mt-1 text-xs text-red-600">{errors.date}</p> : null}
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-700">Time</label>
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
                            {timeSlots.map((slot) => (
                              <button
                                key={slot}
                                type="button"
                                onClick={() => {
                                  setTime(slot);
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
                      <label className="mb-2 block text-sm font-medium text-slate-700">Duration</label>
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
                      <label className="mb-2 block text-sm font-medium text-slate-700">Interview Mode</label>
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
                        <label className="mb-2 block text-sm font-medium text-slate-700">Meeting Link</label>
                        <div className="flex gap-2">
                          <input
                            value={meetingLink}
                            onChange={(e) => {
                              setMeetingLink(e.target.value);
                              setErrors((prev) => ({ ...prev, modeField: undefined }));
                            }}
                            placeholder="Paste or generate a meeting link"
                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              setMeetingLink(generateMeetLink());
                              setErrors((prev) => ({ ...prev, modeField: undefined }));
                            }}
                            className="shrink-0 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                          >
                            Generate Link
                          </button>
                        </div>
                        {errors.modeField ? <p className="mt-1 text-xs text-red-600">{errors.modeField}</p> : null}
                      </div>
                    ) : null}

                    {mode === 'in-person' ? (
                      <div className="sm:col-span-2">
                        <label className="mb-2 block text-sm font-medium text-slate-700">Location / Office Address</label>
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
                        <label className="mb-2 block text-sm font-medium text-slate-700">Phone Number</label>
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

                    <div className="sm:col-span-2">
                      <label className="mb-2 block text-sm font-medium text-slate-700">Linked Job</label>
                      <div className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-600">
                        {linkedJobLabel || candidate?.assignedJob || (candidate?.assignedJobId ? `Job ID: ${candidate.assignedJobId}` : 'No linked job')}
                      </div>
                    </div>
                  </div>
                </section>

                <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <h4 className="text-sm font-semibold text-slate-900">Interview Panel</h4>
                  <p className="mt-1 text-sm text-slate-500">Assign Interviewers</p>
                  <div className="relative mt-4" ref={interviewerRef}>
                    <button
                      type="button"
                      onClick={() => setInterviewerOpen((prev) => !prev)}
                      className={`flex w-full items-center justify-between rounded-xl border bg-white px-3 py-2.5 text-left text-sm ${
                        errors.interviewers ? 'border-red-300' : 'border-slate-200'
                      }`}
                    >
                      <span className="text-slate-400">Search and assign interviewers</span>
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
                          {filteredInterviewers.map((person) => {
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
                          })}
                        </div>
                      </div>
                    ) : null}
                  </div>
                  {errors.interviewers ? <p className="mt-1 text-xs text-red-600">{errors.interviewers}</p> : null}

                  {selectedInterviewers.length > 0 ? (
                    <div className="mt-4 flex flex-wrap gap-2" ref={roleMenuRef}>
                      {selectedInterviewers.map((person) => (
                        <div
                          key={person.id}
                          className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2"
                        >
                          {interviewers.find((item) => item.id === person.id)?.avatar ? (
                            <img
                              src={interviewers.find((item) => item.id === person.id)?.avatar || ''}
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

function AddToPipelineModal({
  isOpen,
  candidate,
  jobs,
  recruiters,
  onClose,
  onSubmit,
}: AddToPipelineModalProps) {
  const [jobSearch, setJobSearch] = useState('');
  const [recruiterSearch, setRecruiterSearch] = useState('');
  const [selectedJobId, setSelectedJobId] = useState('');
  const [selectedStage, setSelectedStage] = useState('');
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

  const jobDropdownRef = useRef<HTMLDivElement | null>(null);
  const stageDropdownRef = useRef<HTMLDivElement | null>(null);
  const recruiterDropdownRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setJobSearch('');
      setRecruiterSearch('');
      setSelectedJobId('');
      setSelectedStage('');
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
    }
  }, [isOpen]);

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

        setJobStageOptions(stageNames);
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
      return;
    }
    if (!jobStageOptions.length) return;
    if (!jobStageOptions.includes(selectedStage)) {
      setSelectedStage(jobStageOptions[0]);
    }
  }, [selectedJobId, jobStageOptions, selectedStage]);

  const filteredJobs = useMemo(() => {
    const q = jobSearch.trim().toLowerCase();
    if (!q) return jobs;
    return jobs.filter(
      (job) =>
        job.title.toLowerCase().includes(q) ||
        (job.department || '').toLowerCase().includes(q)
    );
  }, [jobs, jobSearch]);

  const filteredRecruiters = useMemo(() => {
    const q = recruiterSearch.trim().toLowerCase();
    if (!q) return recruiters;
    return recruiters.filter((recruiter) => recruiter.name.toLowerCase().includes(q));
  }, [recruiters, recruiterSearch]);

  const selectedJob = jobs.find((job) => job.id === selectedJobId);
  const selectedRecruiter = recruiters.find((recruiter) => recruiter.id === selectedRecruiterId);

  const validate = () => {
    const nextErrors: { job?: string; stage?: string } = {};
    if (!selectedJobId) nextErrors.job = 'Job is required';
    if (!selectedStage) nextErrors.stage = 'Stage is required';
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!candidate) return;
    if (!validate()) return;

    try {
      setSubmitting(true);
      await Promise.resolve(
        onSubmit?.({
          candidateId: candidate.id,
          jobId: selectedJobId,
          stage: selectedStage,
          recruiterId: selectedRecruiterId || undefined,
          priority,
          notes: notes.trim() || undefined,
        })
      );
      if (typeof window !== 'undefined') {
        window.alert('Candidate added to pipeline successfully.');
      }
      onClose();
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
                <h3 className="text-lg font-semibold text-slate-900">Add Candidate to Pipeline</h3>
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-xl p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-5 px-5 py-5">
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
                        {selectedJob ? `${selectedJob.title}${selectedJob.department ? ` · ${selectedJob.department}` : ''}` : 'Search and select job'}
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
                          {filteredJobs.map((job) => (
                            <button
                              key={job.id}
                              type="button"
                              onClick={() => {
                                setSelectedJobId(job.id);
                                setSelectedStage('');
                                setJobSearch('');
                                setJobDropdownOpen(false);
                                setErrors((prev) => ({ ...prev, job: undefined }));
                              }}
                              className="flex w-full items-start justify-between rounded-xl px-3 py-2 text-left hover:bg-slate-50"
                            >
                              <div>
                                <p className="text-sm font-medium text-slate-800">{job.title}</p>
                                <p className="text-xs text-slate-500">{job.department || 'No department'}</p>
                              </div>
                              {selectedJobId === job.id ? <Check size={15} className="mt-1 text-blue-600" /> : null}
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                  {errors.job ? <p className="mt-1 text-xs text-red-600">{errors.job}</p> : null}
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">Select Stage</label>
                  <div className="relative" ref={stageDropdownRef}>
                    <button
                      type="button"
                      onClick={() => {
                        if (!selectedJobId || loadingJobStages || jobStageOptions.length === 0) return;
                        setStageDropdownOpen((prev) => !prev);
                      }}
                      className={`flex w-full items-center justify-between rounded-xl border bg-white px-3 py-2.5 text-left text-sm ${
                        errors.stage ? 'border-red-300' : 'border-slate-200'
                      }`}
                      disabled={!selectedJobId || loadingJobStages || jobStageOptions.length === 0}
                    >
                      <span className={selectedStage ? 'text-slate-700' : 'text-slate-400'}>
                        {loadingJobStages
                          ? 'Loading stages...'
                          : selectedJobId && jobStageOptions.length === 0
                          ? 'No pipeline configured for this job'
                          : selectedStage || 'Select stage'}
                      </span>
                      <Tag size={16} className="text-slate-400" />
                    </button>
                    {stageDropdownOpen ? (
                      <div className="absolute left-0 right-0 top-12 z-10 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
                        {jobStageOptions.map((stage) => (
                          <button
                            key={stage}
                            type="button"
                            onClick={() => {
                              setSelectedStage(stage);
                              setStageDropdownOpen(false);
                              setErrors((prev) => ({ ...prev, stage: undefined }));
                            }}
                            className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm hover:bg-slate-50"
                          >
                            <span>{stage}</span>
                            {selectedStage === stage ? <Check size={15} className="text-blue-600" /> : null}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  {errors.stage ? <p className="mt-1 text-xs text-red-600">{errors.stage}</p> : null}
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">Assign Recruiter</label>
                  <div className="relative" ref={recruiterDropdownRef}>
                    <button
                      type="button"
                      onClick={() => setRecruiterDropdownOpen((prev) => !prev)}
                      className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-left text-sm"
                    >
                      {selectedRecruiter ? (
                        <span className="flex items-center gap-2 text-slate-700">
                          {selectedRecruiter.avatar ? (
                            <img
                              src={selectedRecruiter.avatar}
                              alt={selectedRecruiter.name}
                              className="h-6 w-6 rounded-full object-cover"
                            />
                          ) : (
                            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-[10px] font-semibold text-blue-700">
                              {getAvatarInitials(selectedRecruiter.name)}
                            </span>
                          )}
                          {selectedRecruiter.name}
                        </span>
                      ) : (
                        <span className="text-slate-400">Search and select recruiter</span>
                      )}
                      <UserCircle2 size={16} className="text-slate-400" />
                    </button>
                    {recruiterDropdownOpen ? (
                      <div className="absolute left-0 right-0 top-12 z-10 rounded-2xl border border-slate-200 bg-white p-3 shadow-xl">
                        <input
                          value={recruiterSearch}
                          onChange={(e) => setRecruiterSearch(e.target.value)}
                          placeholder="Search recruiter"
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
                              {selectedRecruiterId === recruiter.id ? <Check size={15} className="text-blue-600" /> : null}
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>

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

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">Notes</label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={4}
                    placeholder="Optional notes"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                  />
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
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting ? 'Adding...' : 'Add to Pipeline'}
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
  onReject?: (reason: string, feedback: string, sendEmail: boolean) => void | Promise<void>;
}

type RejectModalStep = 'form' | 'confirm' | 'progress' | 'done';

function RejectCandidateModal({
  candidate,
  isOpen,
  onClose,
  onReject,
}: RejectCandidateModalProps) {
  const [reason, setReason] = useState('');
  const [feedback, setFeedback] = useState('');
  const [sendEmail, setSendEmail] = useState(true);
  const [errors, setErrors] = useState<{ reason?: string; feedback?: string }>({});
  const [step, setStep] = useState<RejectModalStep>('form');
  const [progressStep, setProgressStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setReason('');
      setFeedback('');
      setSendEmail(true);
      setErrors({});
      setStep('form');
      setProgressStep(0);
      setSubmitting(false);
    }
  }, [isOpen]);

  const validate = () => {
    const nextErrors: { reason?: string; feedback?: string } = {};
    if (!reason) nextErrors.reason = 'Reject reason is required';
    if (feedback.trim().length < 20) nextErrors.feedback = 'HR feedback must be at least 20 characters';
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
      await Promise.resolve(onReject?.(reason, feedback.trim(), sendEmail));
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
                      <label className="mb-2 block text-sm font-medium text-slate-700">HR Feedback</label>
                      <textarea
                        value={feedback}
                        onChange={(e) => {
                          setFeedback(e.target.value);
                          setErrors((prev) => ({ ...prev, feedback: undefined }));
                        }}
                        rows={5}
                        placeholder="Share internal rejection feedback for this candidate..."
                        className={`w-full rounded-xl border bg-white px-3 py-2.5 text-sm text-slate-700 outline-none ${
                          errors.feedback ? 'border-red-300' : 'border-slate-200'
                        } focus:border-red-400 focus:ring-2 focus:ring-red-100`}
                      />
                      <div className="mt-1 flex items-center justify-between">
                        {errors.feedback ? <p className="text-xs text-red-600">{errors.feedback}</p> : <span />}
                        <p className="text-xs text-slate-400">{feedback.trim().length}/20 min</p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <div>
                        <p className="text-sm font-medium text-slate-800">Send rejection email</p>
                        <p className="text-xs text-slate-500">Notify the candidate automatically after rejection.</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSendEmail((prev) => !prev)}
                        className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${
                          sendEmail ? 'bg-red-500' : 'bg-slate-300'
                        }`}
                      >
                        <span
                          className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                            sendEmail ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
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
                        <li>HR feedback stored</li>
                        <li>Stage updated</li>
                        <li>AI course suggestions sent</li>
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
                    {progressLabels.map((label, index) => {
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
  const [newNoteText, setNewNoteText] = useState('');
  const [newNoteTags, setNewNoteTags] = useState<string[]>([]);
  const [tagMenuOpen, setTagMenuOpen] = useState(false);
  const [actionMenuOpenId, setActionMenuOpenId] = useState<string | null>(null);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [editTags, setEditTags] = useState<string[]>([]);

  const availableTags = useMemo(() => {
    const baseTags = ['Screening', 'Interview', 'Skill', 'Culture', 'Urgent', 'Follow-up', 'Feedback'];
    const existing = notes.flatMap((note) => note.tags || []);
    return Array.from(new Set([...baseTags, ...existing]));
  }, [notes]);

  const sortedNotes = useMemo(() => {
    return [...notes].sort((a, b) => {
      if (Boolean(a.isPinned) !== Boolean(b.isPinned)) {
        return a.isPinned ? -1 : 1;
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [notes]);

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
    setTagMenuOpen(false);
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5">
      <h3 className="text-sm font-semibold text-slate-900">Internal Notes</h3>

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
                        <p className="text-sm font-semibold text-slate-900">{note.recruiter.name}</p>
                        <span className="text-xs text-slate-400">{formatRelativeTime(note.createdAt)}</span>
                        <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                          Internal only
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
                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                          />
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
                                  #{tag}
                                </button>
                              );
                            })}
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
                                  #{tag}
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
            <h4 className="mt-3 text-sm font-semibold text-slate-800">No internal notes yet</h4>
            <p className="mt-1 text-sm text-slate-500">
              Add private recruiter notes, interview feedback, and internal context here.
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
            <p className="text-xs text-slate-500">Internal only</p>
          </div>
        </div>

        <textarea
          value={newNoteText}
          onChange={(e) => setNewNoteText(e.target.value)}
          rows={4}
          placeholder="Add a private note for your team..."
          className="mt-4 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
        />

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <div className="relative">
            <button
              type="button"
              onClick={() => setTagMenuOpen((prev) => !prev)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Select Tags
            </button>

            {tagMenuOpen ? (
              <div className="absolute left-0 top-11 z-10 w-64 rounded-2xl border border-slate-200 bg-white p-3 shadow-lg">
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
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {selected ? <Check size={12} className="mr-1 inline" /> : null}
                        #{tag}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>

          <button
            type="button"
            onClick={addNote}
            disabled={!newNoteText.trim()}
            className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Add Note
          </button>
        </div>

        {newNoteTags.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {newNoteTags.map((tag) => (
              <span
                key={`selected-${tag}`}
                className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-600 ring-1 ring-slate-200"
              >
                #{tag}
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
  currentUser,
  availableTags = [],
  jobs = [],
  recruiters = [],
  interviewers = [],
  existingInterviews = [],
  onAction,
  onAddNote,
  onEditNote,
  onDeleteNote,
  onPinNote,
  onAddTag,
  onRemoveTag,
  onCreateTag,
  onAddToPipeline,
  onRejectCandidate,
  onScheduleInterview,
}: CandidateProfileDrawerProps) {
  const [activeTab, setActiveTab] = useState<DrawerTab>('Overview');
  const [resumeZoom, setResumeZoom] = useState(100);
  const [resumePage, setResumePage] = useState(1);
  const [showAddToPipelineModal, setShowAddToPipelineModal] = useState(false);
  const [showScheduleInterviewModal, setShowScheduleInterviewModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const activityContainerRef = useRef<HTMLDivElement | null>(null);
  const [editInterview, setEditInterview] = useState<CandidateScheduledInterview | null>(null);
  const candidateFileInputRef = useRef<HTMLInputElement>(null);

  const {
    files: candidateFiles,
    loading: candidateFilesLoading,
    uploading: candidateFilesUploading,
    error: candidateFilesError,
    uploadFile: uploadCandidateFile,
    deleteFile: deleteCandidateFile,
  } = useFiles('candidate', candidate?.id);

  const uploadsBase = useMemo(() => {
    const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';
    // remove trailing "/api/v1" (and possible trailing slash) to build absolute "/uploads/..." links
    return apiBase.replace(/\/api\/v1\/?$/, '');
  }, []);
  const toFileHref = (fileUrl?: string | null) => {
    if (!fileUrl) return '#';
    return /^https?:\/\//i.test(fileUrl) ? fileUrl : `${uploadsBase}${fileUrl}`;
  };

  const linkedJobLabel = useMemo(() => {
    const jobId = candidate?.assignedJobId || null;
    if (!jobId) return '';
    const job = jobs.find((j) => j.id === jobId);
    if (!job) return candidate?.assignedJob && candidate.assignedJob !== '—' ? String(candidate.assignedJob) : '';
    return `${job.title}${job.department ? ` · ${job.department}` : ''}`;
  }, [candidate?.assignedJob, candidate?.assignedJobId, jobs]);

  const titleLine = useMemo(() => {
    if (!candidate) return '—';
    if (candidate.currentTitle && candidate.currentCompany) {
      return `${candidate.currentTitle} · ${candidate.currentCompany}`;
    }
    return candidate.currentTitle || candidate.currentCompany || '—';
  }, [candidate]);

  const handleAction = (
    action: 'move-stage' | 'schedule-interview' | 'send-email' | 'reject' | 'more'
  ) => {
    if (action === 'move-stage') {
      setShowAddToPipelineModal(true);
      return;
    }
    if (action === 'schedule-interview') {
      setShowScheduleInterviewModal(true);
      return;
    }
    if (action === 'reject') {
      setShowRejectModal(true);
      return;
    }
    if (candidate) onAction?.(action, candidate);
  };

  const aiScore = candidate?.aiScore || {
    overall: 0,
    breakdown: {
      skillsMatch: 0,
      experienceFit: 0,
      educationFit: 0,
      keywordMatch: 0,
    },
    insights: [],
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

  return (
    <AnimatePresence>
      {isOpen && candidate ? (
        <>
          <AnimatePresence>
            {toastMessage ? (
              <motion.div
                initial={{ opacity: 0, y: -12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                className="fixed right-4 top-4 z-[90] rounded-2xl border border-blue-200 bg-white px-4 py-3 text-sm font-medium text-slate-800 shadow-xl"
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
          />
          <ScheduleInterviewModal
            isOpen={showScheduleInterviewModal}
            candidate={candidate}
            linkedJobLabel={linkedJobLabel}
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
          <motion.div
            className="fixed inset-0 z-40 bg-slate-950/35"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          <motion.aside
            className="fixed inset-y-0 right-0 z-50 flex w-full max-w-full sm:max-w-[680px]"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'tween', duration: 0.28 }}
          >
            <div className="flex h-full w-full flex-col bg-slate-50 shadow-2xl">
              <div className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 backdrop-blur">
                <div className="flex items-start justify-between gap-4 px-5 py-5 sm:px-6">
                  <div className="flex min-w-0 gap-4">
                    {candidate.avatar ? (
                      <img
                        src={candidate.avatar}
                        alt={candidate.name}
                        className="h-16 w-16 rounded-2xl object-cover ring-1 ring-slate-200"
                      />
                    ) : (
                      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-100 text-lg font-bold text-blue-700">
                        {getInitials(candidate.name)}
                      </div>
                    )}

                    <div className="min-w-0">
                      <h2 className="truncate text-2xl font-bold text-slate-900">{candidate.name}</h2>
                      <p className="mt-1 truncate text-sm text-slate-500">{titleLine}</p>

                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <span
                          className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${getStageClasses(
                            candidate.stage
                          )}`}
                        >
                          {getCandidateStageLabel(candidate.stage)}
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                          <Clock3 size={12} />
                          {candidate.experience ?? 0} years
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                          <MapPin size={12} />
                          {candidate.location || '—'}
                        </span>
                      </div>

                      <div className="mt-3">
                        <CandidateTagSystem
                          candidateId={candidate.id}
                          existingTags={candidate.tags || []}
                          availableTags={availableTags}
                          onAddTag={onAddTag}
                          onRemoveTag={onRemoveTag}
                          onCreateTag={onCreateTag}
                          compact
                        />
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={onClose}
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
                    <button
                      type="button"
                      onClick={() => handleAction('send-email')}
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    >
                      Send Email
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAction('reject')}
                      className="rounded-xl bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700"
                    >
                      Reject
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAction('more')}
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    >
                      More <span className="ml-1">⋯</span>
                    </button>
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

              <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-6">
                {activeTab === 'Overview' && (
                  <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                    <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
                        Basic Info
                      </h3>
                      <div className="space-y-3">
                        <InfoRow icon={Mail} label="Email" value={candidate.email} />
                        <InfoRow icon={Phone} label="Phone" value={candidate.phone} />
                        <InfoRow icon={MapPin} label="Location" value={candidate.location} />
                        <InfoRow icon={Briefcase} label="Current Company" value={candidate.currentCompany} />
                        <InfoRow icon={UserCircle2} label="Designation" value={candidate.designation || candidate.currentTitle} />
                        <InfoRow
                          icon={Clock3}
                          label="Experience"
                          value={`${candidate.experience ?? 0} years`}
                        />
                        <InfoRow icon={CheckCircle2} label="Expected Salary" value={candidate.expectedSalary} />
                        <InfoRow icon={Calendar} label="Notice Period" value={candidate.noticePeriod} />
                      </div>
                    </section>

                    <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
                        Job Info
                      </h3>
                      <div className="space-y-3">
                        <InfoRow icon={Briefcase} label="Assigned Job" value={linkedJobLabel || candidate.assignedJob} />
                        <InfoRow icon={UserCircle2} label="Recruiter" value={candidate.recruiter} />
                        <InfoRow icon={Tag} label="Stage" value={candidate.stage} />
                        <InfoRow icon={Send} label="Source" value={candidate.source} />
                        <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-3">
                          <div className="mt-0.5 rounded-lg bg-slate-100 p-2 text-slate-500">
                            <CheckCircle2 size={16} />
                          </div>
                          <div>
                            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Availability</p>
                            <div className="mt-1 flex items-center gap-2 text-sm font-medium capitalize text-slate-700">
                              <span
                                className={`h-2.5 w-2.5 rounded-full ${getAvailabilityDot(candidate.availability)}`}
                              />
                              {candidate.availability || 'Unknown'}
                            </div>
                          </div>
                        </div>
                      </div>
                    </section>
                  </div>
                )}

                {activeTab === 'Resume' && (
                  <div className="flex h-[calc(100vh-18rem)] min-h-[560px] flex-col gap-5 xl:flex-row">
                    <section className="flex h-full min-h-0 w-full flex-col rounded-2xl border border-slate-200 bg-white xl:w-[60%]">
                      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
                        <h3 className="text-sm font-semibold text-slate-900">Resume Viewer</h3>
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1">
                            <button
                              type="button"
                              onClick={() => setResumeZoom((prev) => Math.max(50, prev - 10))}
                              className="rounded-lg p-2 text-slate-600 hover:bg-white"
                            >
                              <Minus size={16} />
                            </button>
                            <span className="min-w-[3.5rem] text-center text-sm font-medium text-slate-700">
                              {resumeZoom}%
                            </span>
                            <button
                              type="button"
                              onClick={() => setResumeZoom((prev) => Math.min(200, prev + 10))}
                              className="rounded-lg p-2 text-slate-600 hover:bg-white"
                            >
                              <Plus size={16} />
                            </button>
                          </div>

                          <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1">
                            <button
                              type="button"
                              onClick={() => setResumePage((prev) => Math.max(1, prev - 1))}
                              className="rounded-lg p-2 text-slate-600 hover:bg-white"
                            >
                              <Minus size={16} />
                            </button>
                            <span className="min-w-[4rem] text-center text-sm font-medium text-slate-700">
                              Page {resumePage}
                            </span>
                            <button
                              type="button"
                              onClick={() => setResumePage((prev) => prev + 1)}
                              className="rounded-lg p-2 text-slate-600 hover:bg-white"
                            >
                              <Plus size={16} />
                            </button>
                          </div>

                          <a
                            href={candidate.resumeUrl || '#'}
                            target={candidate.resumeUrl ? '_blank' : undefined}
                            rel={candidate.resumeUrl ? 'noreferrer' : undefined}
                            download
                            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                          >
                            <Download size={16} />
                            Download
                          </a>
                        </div>
                      </div>

                      <div className="min-h-0 flex-1 overflow-auto bg-slate-100 p-4">
                        {candidate.resumeUrl ? (
                          <iframe
                            title={`${candidate.name} resume`}
                            src={buildResumeViewerUrl(candidate.resumeUrl, resumeZoom, resumePage)}
                            className="h-full min-h-[520px] w-full rounded-xl border border-slate-200 bg-white"
                          />
                        ) : (
                          <div className="flex h-full min-h-[320px] items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">
                            No resume available for this candidate.
                          </div>
                        )}
                      </div>
                    </section>

                    <section className="flex h-full min-h-0 w-full flex-col rounded-2xl border border-slate-200 bg-white xl:w-[40%]">
                      <div className="border-b border-slate-200 px-5 py-4">
                        <h3 className="text-base font-semibold text-slate-900">AI Candidate Analysis</h3>
                      </div>

                      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
                        <div className="flex justify-center">
                          <CircularScore value={aiScore.overall} />
                        </div>

                        <div className="mt-6 space-y-4">
                          <ScoreBar label="Skills Match" value={aiScore.breakdown.skillsMatch} colorClass="bg-blue-600" />
                          <ScoreBar label="Experience Fit" value={aiScore.breakdown.experienceFit} colorClass="bg-amber-500" />
                          <ScoreBar label="Education Fit" value={aiScore.breakdown.educationFit} colorClass="bg-emerald-500" />
                          <ScoreBar label="Keyword Match" value={aiScore.breakdown.keywordMatch} colorClass="bg-violet-500" />
                        </div>

                        <div className="mt-8">
                          <h4 className="mb-3 text-sm font-semibold text-slate-900">AI Insights</h4>
                          <div className="space-y-3">
                            {aiScore.insights.length > 0 ? (
                              aiScore.insights.map((insight, index) => (
                                <div
                                  key={`${insight.type}-${index}`}
                                  className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3"
                                >
                                  <span
                                    className={`mt-1 h-2.5 w-2.5 rounded-full ${
                                      insight.type === 'strength' ? 'bg-emerald-500' : 'bg-red-500'
                                    }`}
                                  />
                                  <p className="text-sm leading-6 text-slate-700">{insight.text}</p>
                                </div>
                              ))
                            ) : (
                              <p className="text-sm text-slate-500">No AI insights available yet.</p>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="border-t border-slate-200 px-5 py-4">
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => handleAction('more')}
                            className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                          >
                            Shortlist
                          </button>
                          <button
                            type="button"
                            onClick={() => handleAction('move-stage')}
                            className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                          >
                            Add to Pipeline
                          </button>
                          <button
                            type="button"
                            onClick={() => handleAction('reject')}
                            className="rounded-xl bg-red-600 px-3 py-2.5 text-sm font-medium text-white hover:bg-red-700"
                          >
                            Reject
                          </button>
                          <button
                            type="button"
                            onClick={() => handleAction('schedule-interview')}
                            className="rounded-xl bg-blue-600 px-3 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
                          >
                            Request Assessment
                          </button>
                        </div>
                      </div>
                    </section>
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
                    <section className="rounded-2xl border border-slate-200 bg-white p-5">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <h3 className="text-sm font-semibold text-slate-900">Interviews</h3>
                          <p className="mt-1 text-sm text-slate-500">
                            View scheduled interviews and schedule new ones from this drawer.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleAction('schedule-interview')}
                          className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
                        >
                          <Calendar size={16} />
                          Schedule Interview
                        </button>
                      </div>

                      <div className="mt-5 space-y-3">
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
                    </section>
                  );
                })()}

                {activeTab === 'Activity' && (
                  <section className="rounded-2xl border border-slate-200 bg-white p-5">
                    <h3 className="text-sm font-semibold text-slate-900">Recent Activity</h3>
                    <div ref={activityContainerRef} className="mt-4 max-h-[32rem] space-y-6 overflow-y-auto pr-1">
                      {groupedActivity.length > 0 ? (
                        groupedActivity.map((group) => (
                          <div key={group.label}>
                            <div className="sticky top-0 z-[1] mb-4 inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                              {group.label}
                            </div>

                            <div className="relative ml-3 space-y-5 border-l-2 border-slate-200 pl-8">
                              {group.items.map((item) => {
                                const config = getTimelineConfig(item.type);
                                const Icon = config.Icon;

                                return (
                                  <div key={item.id} className="relative rounded-2xl border border-slate-200 bg-slate-50 p-4">
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
                                            {new Date(item.timestamp).toLocaleString()}
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
                  </section>
                )}

                {activeTab === 'Notes' && (
                  <InternalNotesSection
                    notes={candidate.notes || []}
                    candidateId={candidate.id}
                    currentUser={fallbackCurrentUser}
                    onAddNote={onAddNote}
                    onEditNote={onEditNote}
                    onDeleteNote={onDeleteNote}
                    onPinNote={onPinNote}
                  />
                )}

                {activeTab === 'Tags' && (
                  <section className="rounded-2xl border border-slate-200 bg-white p-5">
                    <h3 className="text-sm font-semibold text-slate-900">Tags</h3>
                    <div className="mt-4">
                      <CandidateTagSystem
                        candidateId={candidate.id}
                        existingTags={candidate.tags || []}
                        availableTags={availableTags}
                        onAddTag={onAddTag}
                        onRemoveTag={onRemoveTag}
                        onCreateTag={onCreateTag}
                      />
                    </div>
                  </section>
                )}

                {activeTab === 'Files' && (
                  <section className="rounded-2xl border border-slate-200 bg-white p-5">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-semibold text-slate-900">Files</h3>
                        <p className="mt-1 text-sm text-slate-500">Upload and manage candidate documents.</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          ref={candidateFileInputRef}
                          type="file"
                          className="hidden"
                          onChange={async (e) => {
                            const f = e.target.files?.[0];
                            if (!f) return;
                            try {
                              await uploadCandidateFile(f, 'Other');
                            } finally {
                              e.target.value = '';
                            }
                          }}
                        />
                        <button
                          type="button"
                          disabled={!candidate?.id || candidateFilesUploading}
                          onClick={() => candidateFileInputRef.current?.click()}
                          className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <Plus size={16} />
                          {candidateFilesUploading ? 'Uploading…' : 'Upload File'}
                        </button>
                      </div>
                    </div>

                    {candidateFilesError ? (
                      <p className="mt-3 text-sm text-red-600">{candidateFilesError}</p>
                    ) : null}

                    <div className="mt-4 space-y-3">
                      {candidateFilesLoading ? (
                        <p className="text-sm text-slate-500">Loading files…</p>
                      ) : candidateFiles.length > 0 ? (
                        candidateFiles.map((file) => (
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
                      ) : (
                        <p className="text-sm text-slate-500">No files uploaded.</p>
                      )}
                    </div>
                  </section>
                )}
              </div>
            </div>
          </motion.aside>
        </>
      ) : null}
    </AnimatePresence>
  );
}
