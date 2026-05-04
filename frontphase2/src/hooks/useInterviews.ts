import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  apiAddInterviewNote,
  apiAddInterviewPanelMember,
  apiCancelInterview,
  apiCreateInterview,
  apiDeleteInterview,
  apiGenerateInterviewFeedbackSummary,
  apiGetCandidates,
  apiGetInterviews,
  apiGetJobs,
  apiGetUsers,
  apiMarkInterviewNoShow,
  apiRemoveInterviewPanelMember,
  apiRescheduleInterview,
  apiUpdateInterview,
  apiSubmitInterviewFeedback,
  type BackendCandidate,
  type BackendInterviewKpis,
  type BackendInterviewListItem,
  type BackendInterviewListResponse,
  type BackendJob,
  type BackendUser,
} from '../lib/api';
import { MY_JOBS_LIST_PARAMS } from '../lib/myJobsListParams';
import type {
    CancelInterviewPayload,
    FeedbackPayload,
    Interview,
  InterviewFiltersState,
  InterviewKpi,
  InterviewPanelMember,
  PaginationState,
    ReschedulePayload,
    ScheduleInterviewPayload,
    NoShowPayload,
    UpdateInterviewPayload,
  } from '../types/interview.types';

const defaultFilters: InterviewFiltersState = {
  date: 'This Week',
  status: 'All Status',
  round: 'All Rounds',
  mode: 'All Modes',
  interviewer: 'All Interviewers',
  clientJob: 'All Clients',
};

const statusMap: Record<string, Interview['status']> = {
  SCHEDULED: 'Scheduled',
  RESCHEDULED: 'Rescheduled',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
  NO_SHOW: 'No Show',
  FEEDBACK_PENDING: 'Scheduled',
  FEEDBACK_SUBMITTED: 'Completed',
  IN_PROGRESS: 'Scheduled',
  CONFIRMED: 'Scheduled',
};

const feedbackStatusMap = (item: BackendInterviewListItem): Interview['feedbackStatus'] => {
  if (item.status === 'CANCELLED' || item.status === 'NO_SHOW') return 'N/A';
  return item.feedbackEntries?.length ? 'Submitted' : 'Pending';
};

const mapCandidateStageFallback = (candidateStatus?: string | null): string | null => {
  const normalized = String(candidateStatus || '').trim().toUpperCase();
  if (!normalized) return null;
  if (normalized === 'PLACED') return 'Hired';
  if (normalized === 'OFFERED') return 'Offer';
  if (normalized === 'INTERVIEWING') return 'Interviewing';
  if (normalized === 'REJECTED') return 'Rejected';
  if (normalized === 'NEW') return 'Applied';
  return null;
};

const toTitle = (value: string) =>
  value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

const formatDatePart = (value: string) =>
  new Date(value).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

const formatTimePart = (value: string) =>
  new Date(value).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });

const isLikelyUrl = (value?: string | null) => /^https?:\/\//i.test(String(value || '').trim());

const safeDisplayText = (value?: string | null, fallback = '') => {
  const text = String(value || '').trim();
  if (!text || isLikelyUrl(text)) return fallback;
  return text;
};

const initialsFromName = (value?: string | null, fallback = 'NA') => {
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
};

const extractDisplayName = (firstName?: string | null, lastName?: string | null) => {
  const name = [safeDisplayText(firstName, ''), safeDisplayText(lastName, '')].filter(Boolean).join(' ').trim();
  if (!name) return 'Unknown Candidate';
  return name;
};

const sanitizeEmail = (value?: string | null) => {
  const email = String(value || '').trim();
  if (!email || isLikelyUrl(email) || !email.includes('@')) return '';
  return email;
};

const activityColor = (action: string): 'blue' | 'green' | 'orange' | 'red' | 'slate' => {
  if (action.toLowerCase().includes('cancel') || action.toLowerCase().includes('no show')) return 'red';
  if (action.toLowerCase().includes('feedback') || action.toLowerCase().includes('recording')) return 'green';
  if (action.toLowerCase().includes('panel') || action.toLowerCase().includes('reschedule')) return 'orange';
  if (action.toLowerCase().includes('note')) return 'slate';
  return 'blue';
};

const mapInterview = (item: BackendInterviewListItem): Interview => ({
  id: item.id,
  scheduledAt: item.scheduledAt,
  candidate: {
    id: item.candidate.id,
    name: extractDisplayName(item.candidate.firstName, item.candidate.lastName),
    email: sanitizeEmail(item.candidate.email),
    avatar: isLikelyUrl(item.candidate.avatar) ? undefined : item.candidate.avatar || undefined,
    stage: item.candidate.stage || mapCandidateStageFallback(item.candidate.status),
    status: item.candidate.status || undefined,
  },
  job: {
    id: item.job.id,
    title: safeDisplayText(item.job.title, 'Untitled Job'),
    client: safeDisplayText(item.client.companyName, 'Unknown Client'),
    clientId: item.client.id,
  },
  round: (toTitle(item.round || 'Screening') as Interview['round']) || 'Screening',
  type: (toTitle(item.type) as Interview['type']) || 'Video',
  mode: item.mode === 'OFFLINE' ? 'Offline' : 'Online',
  date: formatDatePart(item.scheduledAt),
  time: formatTimePart(item.scheduledAt),
  duration: item.duration,
  timezone: item.timezone || 'UTC',
  meetingLink: item.meetingLink || undefined,
  meetingPlatform:
    item.platform === 'GOOGLE_MEET'
      ? 'Google Meet'
      : item.platform === 'MS_TEAMS'
      ? 'MS Teams'
      : item.platform === 'ZOOM'
      ? 'Zoom'
      : undefined,
  location: item.location || undefined,
  status: statusMap[item.status] || 'Scheduled',
  feedbackStatus: feedbackStatusMap(item),
  createdBy: item.createdBy?.name || 'Unknown User',
  notes: item.notes || '',
  panel: (item.panel || []).map((member) => ({
    id: member.id,
    userId: member.user.id,
    name: safeDisplayText(member.user.name, 'Unknown Interviewer'),
    role: (toTitle(member.role) as InterviewPanelMember['role']) || 'Technical',
    department: safeDisplayText(member.user.department, 'General'),
    email: sanitizeEmail(member.user.email) || 'No email available',
    phone: safeDisplayText(member.user.phone, '-'),
    avatar: initialsFromName(member.user.name, 'NA'),
  })),
  feedbackEntries: (item.feedbackEntries || []).map((entry) => ({
    id: entry.id,
    interviewerId: entry.interviewer.id,
    interviewerName: entry.interviewer.name,
    submittedAt: new Date(entry.createdAt).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }),
    ratings: {
      technicalSkills: entry.technicalScore,
      communication: entry.communicationScore,
      problemSolving: entry.problemSolvingScore,
      cultureFit: entry.cultureFitScore,
      experienceMatch: entry.experienceMatchScore,
      overallRating: Math.round(entry.overallScore),
    },
    strengths: entry.strengths || '',
    weaknesses: entry.weakness || '',
    comments: entry.comments || entry.aiSummary || '',
    recommendation: (toTitle(entry.recommendation) as 'Pass' | 'Reject' | 'Hold') || 'Hold',
  })),
  internalNotes: (item.interviewNotes || []).map((note) => ({
    id: note.id,
    author: safeDisplayText(note.author.name, 'Unknown User'),
    avatar:
      safeDisplayText(note.author.avatar, '') ||
      initialsFromName(note.author.name, 'NA'),
    timestamp: new Date(note.createdAt).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }),
    text: note.note,
  })),
  activityLog: (item.activityLogs || []).map((log) => ({
    id: log.id,
    action: log.action,
    user: log.user.name,
    timestamp: new Date(log.timestamp).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }),
    color: activityColor(log.action),
  })),
  recording: null,
});

const unwrapCollection = <T,>(value: T[] | { data?: T[]; pagination?: any } | undefined | null): T[] => {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.data)) return value.data;
  return [];
};

const mapKpis = (kpis?: BackendInterviewKpis): InterviewKpi[] => [
  { title: "Today's Interviews", value: kpis?.todayCount || 0, icon: 'calendar', accent: 'blue' },
  { title: 'Upcoming Interviews', value: kpis?.upcomingCount || 0, icon: 'clock', accent: 'orange' },
  { title: 'Pending Feedback', value: kpis?.pendingFeedbackCount || 0, icon: 'message', accent: 'purple' },
  { title: 'Completed Interviews', value: kpis?.completedCount || 0, icon: 'check', accent: 'green' },
];

const normalizeInterviewListResponse = (response: BackendInterviewListResponse) => {
  const interviews = (response.data || []).map(mapInterview);
  return {
    interviews,
    totalEntries: response.total || interviews.length,
    totalPages: response.totalPages || 1,
    kpis: mapKpis(response.kpis),
  };
};

const mapUsersToPanel = (users: BackendUser[]): InterviewPanelMember[] =>
  users.map((user) => ({
    id: user.id,
    userId: user.id,
    name: safeDisplayText(user.name, 'Unknown User'),
    role: 'Technical',
    department: safeDisplayText(user.department, 'General'),
    email: sanitizeEmail(user.email) || 'No email available',
    phone: '-',
    avatar: initialsFromName(user.name, 'NA'),
  }));

const mapCandidates = (candidates: BackendCandidate[]) =>
  candidates.map((candidate) => ({
    id: candidate.id,
    name: extractDisplayName(candidate.firstName, candidate.lastName),
    email: sanitizeEmail(candidate.email),
    avatar: undefined,
  }));

const mapJobs = (jobs: BackendJob[]) =>
  jobs.map((job) => ({
    id: job.id,
    title: job.title,
    client: job.client?.companyName || 'Unknown Client',
    clientId: job.client?.id,
  }));

/** Jobs/candidates API may be forbidden for INTERVIEWERS; merge options from list payload. */
function mergeJobOptionsFromInterviews(
  existing: Interview['job'][],
  list: Interview[]
): Interview['job'][] {
  const map = new Map<string, Interview['job']>();
  existing.forEach((j) => map.set(j.id, j));
  list.forEach((inv) => {
    if (!map.has(inv.job.id)) map.set(inv.job.id, inv.job);
  });
  return Array.from(map.values());
}

function mergeCandidateOptionsFromInterviews(
  existing: Interview['candidate'][],
  list: Interview[]
): Interview['candidate'][] {
  const map = new Map<string, Interview['candidate']>();
  existing.forEach((c) => map.set(c.id, c));
  list.forEach((inv) => {
    if (!map.has(inv.candidate.id)) map.set(inv.candidate.id, inv.candidate);
  });
  return Array.from(map.values());
}

function mergeInterviewerOptionsFromInterviews(
  existing: InterviewPanelMember[],
  list: Interview[]
): InterviewPanelMember[] {
  const map = new Map<string, InterviewPanelMember>();
  existing.forEach((m) => {
    const key = m.userId || m.id;
    if (key) map.set(key, m);
  });
  list.forEach((inv) => {
    inv.panel.forEach((m) => {
      const key = m.userId || m.id;
      if (key && !map.has(key)) map.set(key, m);
    });
  });
  return Array.from(map.values());
}

const DELETED_INTERVIEWS_STORAGE_KEY = 'interviews.deletedIds.v1';

const readPersistedDeletedInterviewIds = (): string[] => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(DELETED_INTERVIEWS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((value) => typeof value === 'string') : [];
  } catch {
    return [];
  }
};

export function useInterviews() {
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [deletedInterviewIds, setDeletedInterviewIds] = useState<string[]>(() => readPersistedDeletedInterviewIds());
  const [filters, setFilters] = useState<InterviewFiltersState>(defaultFilters);
  const [pagination, setPagination] = useState<PaginationState>({ page: 1, pageSize: 10 });
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [totalEntries, setTotalEntries] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [kpis, setKpis] = useState<InterviewKpi[]>(mapKpis());
  const [candidateOptions, setCandidateOptions] = useState<Interview['candidate'][]>([]);
  const [jobOptions, setJobOptions] = useState<Interview['job'][]>([]);
  const [interviewerOptions, setInterviewerOptions] = useState<InterviewPanelMember[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const deletedInterviewIdSet = useMemo(() => new Set(deletedInterviewIds), [deletedInterviewIds]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(DELETED_INTERVIEWS_STORAGE_KEY, JSON.stringify(deletedInterviewIds));
    } catch {
      // Ignore storage failures and continue using in-memory filtering.
    }
  }, [deletedInterviewIds]);

  const fetchMeta = useCallback(async () => {
    // Optional dropdown data — failures must NOT block the interview list (e.g. INTERVIEWERS lack jobs_read / candidates_read).
    const settled = await Promise.allSettled([
      apiGetCandidates({ limit: 100 }),
      apiGetJobs({ page: 1, ...MY_JOBS_LIST_PARAMS }),
      apiGetUsers({ isActive: true, limit: 100 }),
    ]);

    const [candidatesRes, jobsRes, usersRes] = settled;

    if (candidatesRes.status === 'fulfilled') {
      setCandidateOptions(mapCandidates(unwrapCollection(candidatesRes.value.data)));
    } else {
      setCandidateOptions([]);
    }

    if (jobsRes.status === 'fulfilled') {
      setJobOptions(mapJobs(unwrapCollection(jobsRes.value.data)));
    } else {
      setJobOptions([]);
    }

    if (usersRes.status === 'fulfilled') {
      setInterviewerOptions(mapUsersToPanel(unwrapCollection(usersRes.value.data)));
    } else {
      setInterviewerOptions([]);
    }
  }, []);

  const fetchInterviews = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiGetInterviews({
        page: pagination.page,
        limit: pagination.pageSize,
        status: filters.status !== 'All Status' ? filters.status.toUpperCase().replace(/\s+/g, '_') : undefined,
        round: filters.round !== 'All Rounds' ? filters.round.toUpperCase().replace(/\s+/g, '_') : undefined,
        mode: filters.mode === 'Online' ? 'ONLINE' : filters.mode === 'Offline' ? 'OFFLINE' : undefined,
        interviewerId:
          filters.interviewer !== 'All Interviewers'
            ? interviewerOptions.find((user) => user.name === filters.interviewer)?.id
            : undefined,
        jobId:
          filters.clientJob !== 'All Clients'
            ? jobOptions.find((job) => `${job.client} • ${job.title}` === filters.clientJob)?.id
            : undefined,
        search: searchQuery || undefined,
      });

      const snapshot = normalizeInterviewListResponse(response.data);
      setInterviews(snapshot.interviews);
      setTotalPages(snapshot.totalPages);
      setTotalEntries(snapshot.totalEntries);
      setKpis(snapshot.kpis);
    } catch (fetchError: any) {
      setError(fetchError.message || 'Unable to load interviews');
    } finally {
      setLoading(false);
    }
  }, [filters.clientJob, filters.interviewer, filters.mode, filters.round, filters.status, interviewerOptions, jobOptions, pagination.page, pagination.pageSize, searchQuery]);

  useEffect(() => {
    void fetchMeta();
  }, [fetchMeta]);

  useEffect(() => {
    void fetchInterviews();
  }, [fetchInterviews]);

  const filteredInterviews = useMemo(
    () => interviews.filter((interview) => !deletedInterviewIdSet.has(interview.id)),
    [deletedInterviewIdSet, interviews]
  );
  const paginatedInterviews = useMemo(() => filteredInterviews, [filteredInterviews]);

  const scheduleInterview = useCallback(
    async (payload: ScheduleInterviewPayload) => {
      try {
        const job = jobOptions.find((item) => item.id === payload.jobId);
        if (!job?.clientId) {
          throw new Error('Select a job linked to a client before scheduling');
        }

        await apiCreateInterview({
          candidateId: payload.candidateId,
          jobId: payload.jobId,
          clientId: job.clientId,
          round: payload.round.toUpperCase(),
          type: payload.type.toUpperCase().replace(/ /g, '_') as
            | 'VIDEO'
            | 'PHONE'
            | 'IN_PERSON'
            | 'TECHNICAL_TEST'
            | 'ASSESSMENT'
            | 'GROUP_DISCUSSION',
          mode: payload.mode === 'Online' ? 'ONLINE' : 'OFFLINE',
          date: new Date(payload.date).toISOString(),
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

        setToast('Interview scheduled successfully');
        await fetchInterviews();
      } catch (mutationError: any) {
        setError(mutationError.message || 'Unable to schedule interview');
        setToast(mutationError.message || 'Unable to schedule interview');
        throw mutationError;
      }
    },
    [fetchInterviews, jobOptions]
  );

  const rescheduleInterview = useCallback(
    async (interviewId: string, payload: ReschedulePayload) => {
      try {
        await apiRescheduleInterview(interviewId, {
          newDate: new Date(payload.date).toISOString(),
          newTime: payload.time,
          reason: payload.reason,
          notifyCandidate: payload.notifyCandidate,
          notifyInterviewer: payload.notifyInterviewer,
        });
        setToast('Interview rescheduled');
        await fetchInterviews();
      } catch (mutationError: any) {
        setError(mutationError.message || 'Unable to reschedule interview');
        setToast(mutationError.message || 'Unable to reschedule interview');
        throw mutationError;
      }
    },
    [fetchInterviews]
  );

  const cancelInterview = useCallback(
    async (interviewId: string, payload: CancelInterviewPayload) => {
      try {
        await apiCancelInterview(interviewId, payload);
        setToast('Interview cancelled');
        await fetchInterviews();
      } catch (mutationError: any) {
        setError(mutationError.message || 'Unable to cancel interview');
        setToast(mutationError.message || 'Unable to cancel interview');
        throw mutationError;
      }
    },
    [fetchInterviews]
  );

  const updateInterview = useCallback(
    async (interviewId: string, payload: UpdateInterviewPayload) => {
      try {
        await apiUpdateInterview(interviewId, {
          candidateId: payload.candidateId,
          jobId: payload.jobId,
          clientId: payload.clientId,
          round: payload.round,
          type: payload.type.toUpperCase().replace(/ /g, '_'),
          mode: payload.mode === 'Online' ? 'ONLINE' : 'OFFLINE',
          date: payload.date,
          duration: payload.duration,
          timezone: payload.timezone,
          meetingPlatform: payload.meetingPlatform
            ? payload.meetingPlatform === 'Zoom'
              ? 'ZOOM'
              : payload.meetingPlatform === 'Google Meet'
              ? 'GOOGLE_MEET'
              : 'MS_TEAMS'
            : null,
          location: payload.location,
          notes: payload.notes,
          status: payload.status,
          panelUserIds: payload.panelUserIds,
          panelRoles: payload.panelRoles,
        });
        setToast('Interview updated');
        await fetchInterviews();
      } catch (mutationError: any) {
        setError(mutationError.message || 'Unable to update interview');
        setToast(mutationError.message || 'Unable to update interview');
        throw mutationError;
      }
    },
    [fetchInterviews]
  );

  const deleteInterview = useCallback(
    async (interviewId: string) => {
      try {
        await apiDeleteInterview(interviewId);
        setDeletedInterviewIds((current) => (current.includes(interviewId) ? current : [...current, interviewId]));
        setToast('Interview deleted');
        await fetchInterviews();
      } catch (mutationError: any) {
        setError(mutationError.message || 'Unable to delete interview');
        setToast(mutationError.message || 'Unable to delete interview');
        throw mutationError;
      }
    },
    [fetchInterviews]
  );

  const submitFeedback = useCallback(
    async (interviewId: string, payload: FeedbackPayload) => {
      try {
        await apiSubmitInterviewFeedback(interviewId, {
          technicalScore: payload.ratings.technicalSkills,
          communicationScore: payload.ratings.communication,
          problemSolvingScore: payload.ratings.problemSolving,
          cultureFitScore: payload.ratings.cultureFit,
          experienceMatchScore: payload.ratings.experienceMatch,
          overallScore: payload.ratings.overallRating,
          strengths: payload.strengths,
          weakness: payload.weaknesses,
          comments: payload.comments,
          recommendation:
            payload.recommendation === 'Pass'
              ? 'PASS'
              : payload.recommendation === 'Reject'
              ? 'REJECT'
              : 'HOLD',
          salaryFit: payload.salaryFit,
          availableToJoin: payload.availableToJoin,
        });

        const updated = await apiGetInterviews({
          page: pagination.page,
          limit: pagination.pageSize,
          status: filters.status !== 'All Status' ? filters.status.toUpperCase().replace(/\s+/g, '_') : undefined,
          round: filters.round !== 'All Rounds' ? filters.round.toUpperCase().replace(/\s+/g, '_') : undefined,
          mode: filters.mode === 'Online' ? 'ONLINE' : filters.mode === 'Offline' ? 'OFFLINE' : undefined,
          interviewerId:
            filters.interviewer !== 'All Interviewers'
              ? interviewerOptions.find((user) => user.name === filters.interviewer)?.id
              : undefined,
          jobId:
            filters.clientJob !== 'All Clients'
              ? jobOptions.find((job) => `${job.client} â€¢ ${job.title}` === filters.clientJob)?.id
              : undefined,
          search: searchQuery || undefined,
        });
        const snapshot = normalizeInterviewListResponse(updated.data);
        setInterviews(snapshot.interviews);
        setTotalPages(snapshot.totalPages);
        setTotalEntries(snapshot.totalEntries);
        setKpis(snapshot.kpis);

        const submittedInterview = snapshot.interviews.find((item) => item.id === interviewId);
        if (submittedInterview?.feedbackEntries[0]) {
          try {
            await apiGenerateInterviewFeedbackSummary(interviewId, submittedInterview.feedbackEntries[0].id);
            await fetchInterviews();
          } catch {
            // Keep feedback success even if AI summary fails.
          }
        }

        setToast(payload.saveAsDraft ? 'Feedback saved' : 'Feedback submitted');
      } catch (mutationError: any) {
        setError(mutationError.message || 'Unable to submit feedback');
        setToast(mutationError.message || 'Unable to submit feedback');
        throw mutationError;
      }
    },
    [
      fetchInterviews,
      filters.clientJob,
      filters.interviewer,
      filters.mode,
      filters.round,
      filters.status,
      interviewerOptions,
      jobOptions,
      pagination.page,
      pagination.pageSize,
      searchQuery,
    ]
  );

  const addNote = useCallback(
    async (interviewId: string, text: string) => {
      if (!text.trim()) return;
      try {
        await apiAddInterviewNote(interviewId, text.trim());
        setToast('Note added');
        await fetchInterviews();
      } catch (mutationError: any) {
        setError(mutationError.message || 'Unable to add note');
        setToast(mutationError.message || 'Unable to add note');
        throw mutationError;
      }
    },
    [fetchInterviews]
  );

  const updatePanel = useCallback(
    async (interviewId: string, panelIds: string[]) => {
      try {
        const current = interviews.find((interview) => interview.id === interviewId);
        if (!current) return;

        const toRemove = current.panel.filter((member) => !panelIds.includes(member.userId || member.id));
        const toAdd = panelIds.filter((id) => !current.panel.some((member) => (member.userId || member.id) === id));

        await Promise.all([
          ...toRemove.map((member) => apiRemoveInterviewPanelMember(interviewId, member.id)),
          ...toAdd.map((userId) =>
            apiAddInterviewPanelMember(interviewId, {
              userId,
              role: 'TECHNICAL',
            })
          ),
        ]);

        setToast('Interview panel updated');
        await fetchInterviews();
      } catch (mutationError: any) {
        setError(mutationError.message || 'Unable to update interview panel');
        setToast(mutationError.message || 'Unable to update interview panel');
        throw mutationError;
      }
    },
    [fetchInterviews, interviews]
  );

  const markNoShow = useCallback(
    async (interviewId: string, payload: NoShowPayload) => {
      try {
        await apiMarkInterviewNoShow(interviewId, payload);
        setToast('Interview marked as no show');
        await fetchInterviews();
      } catch (mutationError: any) {
        setError(mutationError.message || 'Unable to mark no show');
        setToast(mutationError.message || 'Unable to mark no show');
        throw mutationError;
      }
    },
    [fetchInterviews]
  );

  const attachRecording = useCallback(async (interviewId: string, type: 'file' | 'link' | 'cloud', value: string) => {
    setInterviews((current) =>
      current.map((interview) =>
        interview.id === interviewId ? { ...interview, recording: { type, value } } : interview
      )
    );
    setToast('Recording attached locally');
  }, []);

  const retryLoad = useCallback(() => {
    void fetchMeta();
    void fetchInterviews();
  }, [fetchMeta, fetchInterviews]);

  return {
    interviews,
    filteredInterviews,
    paginatedInterviews,
    filters,
    setFilters,
    clearFilters: () => setFilters(defaultFilters),
    pagination,
    setPagination,
    totalPages,
    selectedIds,
    setSelectedIds,
    searchQuery,
    setSearchQuery,
    loading,
    error,
    setLoading,
    setError,
    retryLoad,
    toast,
    setToast,
    kpis,
    candidateOptions,
    jobOptions,
    interviewerOptions,
    scheduleInterview,
    rescheduleInterview,
    updateInterview,
    cancelInterview,
    deleteInterview,
    submitFeedback,
    addNote,
    updatePanel,
    markNoShow,
    attachRecording,
  };
}
