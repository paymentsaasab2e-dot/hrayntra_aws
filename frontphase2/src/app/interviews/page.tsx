'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Calendar, ChevronLeft, Download, List, Plus, RefreshCcw, Search, XCircle } from 'lucide-react';
import { toast as sonnerToast, Toaster } from 'sonner';
import { downloadCsv } from '../../utils/csv';
import { ExportColumnsModal } from '../../components/export/ExportColumnsModal';
import { buildInterviewsCsvColumns, INTERVIEWS_EXPORT_COLUMNS } from '../../lib/export/interviewsExportColumns';
import { CancelInterviewModal } from '../../components/interviews/CancelInterviewModal';
import { FeedbackModal } from '../../components/interviews/FeedbackModal';
import { InterviewCalendarView } from '../../components/interviews/InterviewCalendarView';
import { InterviewDrawer } from '../../components/interviews/InterviewDrawer';
import { InterviewKPICards } from '../../components/interviews/InterviewKPICards';
import { InterviewJobsTable } from '../../components/interviews/InterviewJobsTable';
import { InterviewRoundTabs } from '../../components/interviews/InterviewRoundTabs';
import { InterviewTable } from '../../components/interviews/InterviewTable';
import { TableColumnsMenu } from '../../components/table/TableColumnsMenu';
import { usePersistedColumnVisibility } from '../../hooks/usePersistedColumnVisibility';
import { INTERVIEW_TABLE_COLUMNS } from '../../lib/tableColumns/moduleTableColumns';
import { NoShowModal } from '../../components/interviews/NoShowModal';
import { PanelAssignmentModal } from '../../components/interviews/PanelAssignmentModal';
import { RejectCandidateModal } from '../../components/interviews/RejectCandidateModal';
import { RescheduleModal } from '../../components/interviews/RescheduleModal';
import { ScheduleInterviewModal as CandidateScheduleInterviewModal } from '../../components/drawers/CandidateProfileDrawer';
import { SubmitToClientDrawer } from '../../components/interviews/SubmitToClientDrawer';
import { useInterviewDrawer } from '../../hooks/useInterviewDrawer';
import { useInterviews } from '../../hooks/useInterviews';
import { useInterviewModals } from '../../hooks/useInterviewModals';
import { useWorkspaceEntityAlerts } from '../../hooks/useWorkspaceEntityAlerts';
import type { Interview, InterviewFiltersState, UpdateInterviewPayload } from '../../types/interview.types';
import { COMPLETED_INTERVIEW_LOCKED_ACTIONS, isInterviewCompleted } from '../../types/interview.types';
import type { InterviewAction } from '../../components/interviews/ActionsDropdown';
import { usePermissions } from '../../hooks/usePermissions';
import { usePageAutoRefresh } from '../../hooks/usePageAutoRefresh';
import { requestConfirm } from '../../lib/appDialog';
import { mapCandidateScheduledToUpdatePayload, mapInterviewToCandidateScheduled } from '../../lib/interview-schedule-helpers';
import { apiRejectCandidate, apiScheduleCandidateInterview } from '../../lib/api';
import { TableSkeleton } from '../../components/ui/Skeleton';
import { SummaryCardSkeleton, type SummaryCardColor } from '../../components/ui/SummaryCard';
import PaginationAll from '../../components/PaginationAll';
import { TABLE_PAGE_SIZE_OPTIONS, type TablePageSize } from '../../constants/tablePagination';
import {
  PH2_TABLE_BODY_SCROLL_CLASS,
  PH2_TABLE_CARD_CLASS,
  PH2_TABLE_CARD_FOOTER_CLASS,
  PH2_TOOLBAR_ROW_CLASS,
  PH2_TOOLBAR_SELECT_CLASS,
} from '../../components/layout/Ph2ModulePageLayout';
import { ALL_STATUS_LABEL } from '../../constants/filterLabels';
import {
  SmartSearchActiveKeywordsBar,
  SmartSearchPromptPanel,
  SmartSearchToggleButton,
} from '../../components/smart-search/SmartSearchToolbar';
import { useSmartSearch } from '../../hooks/useSmartSearch';
import { mapAiToInterviewsResult, parseSmartSearchWithAi } from '../../lib/smart-search/aiParser';
import {
  INTERVIEWS_SMART_SEARCH_EXAMPLES,
  parseInterviewsSmartSearchPrompt,
} from '../../lib/smart-search/parsers';
import Link from 'next/link';
import {
  InterviewModuleTabs,
  type InterviewModuleTab,
} from '../../components/interviews/InterviewModuleTabs';
import { InterviewApplicationsTab } from '../../components/interviews/InterviewApplicationsTab';
import { InterviewerApplicationsTab } from '../../components/interviews/InterviewerApplicationsTab';
import { InterviewApplicationReviewDrawer } from '../../components/interviews/InterviewApplicationReviewDrawer';
import type { InterviewApplicationRow } from '../../lib/api';
import {
  buildInterviewJobSummaries,
  candidateCountsByRoundForJob,
  filterInterviewsForJobOverview,
  interviewsForJobRound,
  paginateInterviewCandidateGroups,
  uniqueRoundNumbersForJob,
} from '../../lib/interview-job-overview';
import { buildInterviewRoundNumberById } from '../../lib/interview-schedule-helpers';

// Force CSR — every interactive bit on this tab is client-driven.
export const dynamic = 'force-dynamic';

const INTERVIEW_DATE_OPTIONS = ['This Week', 'Today', 'This Month'] as const;
const INTERVIEW_STATUS_OPTIONS = [ALL_STATUS_LABEL, 'Scheduled', 'Completed', 'Cancelled', 'Rescheduled', 'No Show'] as const;
const INTERVIEW_ROUND_OPTIONS = ['All Rounds', 'Screening', 'Technical', 'HR', 'Managerial', 'Client', 'Final'] as const;
const INTERVIEW_MODE_OPTIONS = ['All Modes', 'Online', 'Offline', 'Video', 'Phone', 'In-Person', 'Technical Test', 'Assessment'] as const;

/** Full PATCH payload required by `updateInterview` so status-only updates preserve schedule fields. */
function fullUpdatePayloadFromInterview(
  interview: Interview,
  overrides: Partial<Pick<UpdateInterviewPayload, 'status'>>
): UpdateInterviewPayload {
  const dateIso =
    interview.scheduledAt ||
    (() => {
      const parsed = new Date(`${interview.date} ${interview.time}`);
      return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
    })();

  const panelUserIds = interview.panel.map((m) => String(m.userId || m.id)).filter(Boolean);
  const panelRoles = Object.fromEntries(
    interview.panel.filter((m) => m.userId).map((m) => [String(m.userId), m.role])
  ) as NonNullable<UpdateInterviewPayload['panelRoles']>;

  return {
    candidateId: interview.candidate.id,
    jobId: interview.job.id,
    clientId: interview.job.clientId,
    round: interview.round,
    type: interview.type,
    mode: interview.mode,
    date: dateIso,
    duration: interview.duration,
    timezone: interview.timezone,
    meetingPlatform:
      interview.mode === 'Online'
        ? interview.meetingPlatform === 'Google Meet'
          ? 'Google Meet'
          : interview.meetingPlatform === 'MS Teams'
          ? 'MS Teams'
          : 'Zoom'
        : null,
    location: interview.mode === 'Offline' ? interview.location ?? null : null,
    notes: interview.notes || null,
    panelUserIds,
    panelRoles,
    ...overrides,
  };
}

export default function InterviewsPage() {
  const { hasPermission } = usePermissions();
  const canCreateInterview = hasPermission('interviews_create');
  const canUpdateInterview = hasPermission('interviews_update');
  const canDeleteInterview = hasPermission('interviews_delete');
  const [view, setView] = useState<'list' | 'calendar'>('list');
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportInterviews, setExportInterviews] = useState<Interview[]>([]);
  const [exportInterviewsLoading, setExportInterviewsLoading] = useState(false);
  const [panelModalOpen, setPanelModalOpen] = useState(false);
  const [submitToClientOpen, setSubmitToClientOpen] = useState(false);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectInterview, setRejectInterview] = useState<Interview | null>(null);
  const [editInterview, setEditInterview] = useState<Interview | null>(null);
  const [scheduleNextRoundFrom, setScheduleNextRoundFrom] = useState<Interview | null>(null);
  const [smartSearchInterviewIds, setSmartSearchInterviewIds] = useState<string[]>([]);
  const [moduleTab, setModuleTab] = useState<InterviewModuleTab>('scheduled');
  const [reviewApplicationId, setReviewApplicationId] = useState<string | null>(null);
  const [applicationsRefreshKey, setApplicationsRefreshKey] = useState(0);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [selectedRound, setSelectedRound] = useState<number | 'all'>(1);
  const [overviewPage, setOverviewPage] = useState(1);
  const [jobDetailLoading, setJobDetailLoading] = useState(false);
  const selectedJobIdRef = useRef<string | null>(null);
  selectedJobIdRef.current = selectedJobId;
  const interviewColumnVisibility = usePersistedColumnVisibility(
    'interviews.visibleColumns',
    INTERVIEW_TABLE_COLUMNS,
  );
  const drawer = useInterviewDrawer();
  const modals = useInterviewModals();
  const {
    interviews,
    overviewInterviews,
    jobScopedInterviews,
    fetchInterviewsForJob,
    filters,
    setFilters,
    clearFilters,
    pagination,
    setPagination,
    selectedIds,
    setSelectedIds,
    searchQuery,
    setSearchQuery,
    loading,
    error,
    retryLoad,
    toast,
    setToast,
    kpis,
    candidateOptions,
    jobOptions,
    interviewerOptions,
    interviewRoundById,
    rescheduleInterview,
    updateInterview,
    cancelInterview,
    deleteInterview,
    submitFeedback,
    addNote,
    updatePanel,
    markNoShow,
    fetchAllInterviewsForExport,
  } = useInterviews({ smartSearchInterviewIds });

  const refreshAll = useCallback(
    async (opts?: { silent?: boolean }) => {
      await retryLoad(opts);
      const jobId = selectedJobIdRef.current;
      if (jobId) await fetchInterviewsForJob(jobId);
    },
    [fetchInterviewsForJob, retryLoad],
  );

  const filteredOverviewInterviews = useMemo(
    () =>
      filterInterviewsForJobOverview(overviewInterviews, {
        searchQuery: selectedJobId ? '' : searchQuery,
        status: filters.status,
        round: selectedJobId ? 'All Rounds' : filters.round,
        mode: filters.mode,
        interviewer: filters.interviewer,
        clientJob: filters.clientJob,
        matchingInterviewIds: smartSearchInterviewIds,
        allStatusLabel: ALL_STATUS_LABEL,
      }),
    [
      filters.clientJob,
      filters.interviewer,
      filters.mode,
      filters.round,
      filters.status,
      overviewInterviews,
      searchQuery,
      selectedJobId,
      smartSearchInterviewIds,
    ],
  );

  /** Chronological R1/R2/… from all known interviews (overview + open job). */
  const effectiveRoundById = useMemo(() => {
    const byId = new Map<string, (typeof overviewInterviews)[number]>();
    for (const interview of overviewInterviews) byId.set(interview.id, interview);
    for (const interview of jobScopedInterviews) byId.set(interview.id, interview);
    const merged = Array.from(byId.values());
    if (merged.length === 0) return interviewRoundById;
    return { ...interviewRoundById, ...buildInterviewRoundNumberById(merged) };
  }, [interviewRoundById, jobScopedInterviews, overviewInterviews]);

  const jobSummaries = useMemo(
    () => buildInterviewJobSummaries(filteredOverviewInterviews, effectiveRoundById),
    [effectiveRoundById, filteredOverviewInterviews],
  );

  const selectedJobSummary = useMemo(
    () => jobSummaries.find((job) => job.jobId === selectedJobId) || null,
    [jobSummaries, selectedJobId],
  );

  const jobSourceInterviews = useMemo(() => {
    if (!selectedJobId) return [];
    const scopedForJob = jobScopedInterviews.filter((interview) => interview.job.id === selectedJobId);
    const scoped = scopedForJob.length > 0 ? scopedForJob : overviewInterviews;
    return filterInterviewsForJobOverview(scoped, {
      searchQuery,
      status: filters.status,
      // Round 1 / Round 2 tabs own chronological-round filtering.
      round: 'All Rounds',
      mode: filters.mode,
      interviewer: filters.interviewer,
      clientJob: 'All Clients',
      matchingInterviewIds: smartSearchInterviewIds,
      allStatusLabel: ALL_STATUS_LABEL,
    });
  }, [
    filters.interviewer,
    filters.mode,
    filters.status,
    jobScopedInterviews,
    overviewInterviews,
    searchQuery,
    selectedJobId,
    smartSearchInterviewIds,
  ]);

  const jobRoundNumbers = useMemo(
    () => (selectedJobId ? uniqueRoundNumbersForJob(jobSourceInterviews, selectedJobId, effectiveRoundById) : []),
    [effectiveRoundById, jobSourceInterviews, selectedJobId],
  );

  const jobRoundCandidateCounts = useMemo(
    () =>
      selectedJobId
        ? candidateCountsByRoundForJob(jobSourceInterviews, selectedJobId, effectiveRoundById)
        : {},
    [effectiveRoundById, jobSourceInterviews, selectedJobId],
  );

  const jobAllCandidatesCount = useMemo(() => {
    if (!selectedJobId) return 0;
    return new Set(jobSourceInterviews.map((interview) => interview.candidate.id)).size;
  }, [jobSourceInterviews, selectedJobId]);

  const jobRoundInterviews = useMemo(() => {
    if (!selectedJobId) return [];
    return interviewsForJobRound(jobSourceInterviews, selectedJobId, selectedRound, effectiveRoundById);
  }, [effectiveRoundById, jobSourceInterviews, selectedJobId, selectedRound]);

  const pagedJobs = useMemo(() => {
    const size = Math.max(pagination.pageSize, 1);
    const start = (overviewPage - 1) * size;
    return jobSummaries.slice(start, start + size);
  }, [jobSummaries, overviewPage, pagination.pageSize]);

  const jobsTotalPages = Math.max(1, Math.ceil(jobSummaries.length / Math.max(pagination.pageSize, 1)) || 1);

  const pagedJobCandidates = useMemo(
    () => paginateInterviewCandidateGroups(jobRoundInterviews, overviewPage, pagination.pageSize),
    [jobRoundInterviews, overviewPage, pagination.pageSize],
  );

  const displayedInterviewIds = useMemo(() => {
    if (selectedJobId) return pagedJobCandidates.items.map((interview) => interview.id);
    return filteredOverviewInterviews.map((interview) => interview.id);
  }, [filteredOverviewInterviews, pagedJobCandidates.items, selectedJobId]);

  const { alertsByEntityId: workspaceAlertsByEntityId } = useWorkspaceEntityAlerts(
    'INTERVIEW',
    displayedInterviewIds,
  );

  const selectedInterview = useMemo(() => {
    const id = drawer.selectedInterviewId;
    if (!id) return null;
    return (
      jobScopedInterviews.find((interview) => interview.id === id) ||
      overviewInterviews.find((interview) => interview.id === id) ||
      interviews.find((interview) => interview.id === id) ||
      null
    );
  }, [drawer.selectedInterviewId, interviews, jobScopedInterviews, overviewInterviews]);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(null), 1800);
    return () => window.clearTimeout(timeout);
  }, [toast, setToast]);

  useEffect(() => {
    if (moduleTab !== 'scheduled') {
      setSelectedJobId(null);
    }
  }, [moduleTab]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!selectedJobId) {
        setJobDetailLoading(false);
        await fetchInterviewsForJob(null);
        return;
      }
      setJobDetailLoading(true);
      try {
        await fetchInterviewsForJob(selectedJobId);
      } finally {
        if (!cancelled) setJobDetailLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [fetchInterviewsForJob, selectedJobId]);

  useEffect(() => {
    if (!selectedJobId) return;
    if (jobRoundNumbers.length === 0) return;
    if (selectedRound !== 'all' && !jobRoundNumbers.includes(selectedRound)) {
      setSelectedRound(jobRoundNumbers[0]);
    }
  }, [jobRoundNumbers, selectedJobId, selectedRound]);

  useEffect(() => {
    setOverviewPage(1);
  }, [searchQuery, filters.status, filters.round, filters.mode, filters.interviewer, filters.clientJob, selectedJobId, selectedRound]);

  // Reusable auto-refresh: poll while visible, refresh on tab focus and on
  // interview/job change events. `retryLoad` is the same function the page
  // already calls for explicit reloads.
  usePageAutoRefresh((opts) => refreshAll(opts), {
    events: ['jobportal:interviews-changed', 'jobportal:jobs-changed'],
  });

  const clientJobOptions = useMemo(
    () => jobOptions.map((job) => `${job.client} • ${job.title}`),
    [jobOptions]
  );

  const scheduleCandidateOptions = useMemo(() => {
    const latestByCandidate = new Map<
      string,
      { jobId: string; jobTitle: string; clientId?: string; scheduledAt: number }
    >();
    for (const interview of overviewInterviews) {
      const candidateId = interview.candidate.id;
      const scheduledAt = new Date(interview.scheduledAt || 0).getTime();
      const existing = latestByCandidate.get(candidateId);
      if (!existing || scheduledAt > existing.scheduledAt) {
        latestByCandidate.set(candidateId, {
          jobId: interview.job.id,
          jobTitle: interview.job.title,
          clientId: interview.job.clientId,
          scheduledAt,
        });
      }
    }

    return candidateOptions.map((candidate) => {
      const fromInterview = latestByCandidate.get(candidate.id);
      const candidateWithJob = candidate as typeof candidate & {
        assignedJobId?: string;
        assignedJob?: string;
      };
      return {
        id: candidate.id,
        name: candidate.name,
        assignedJobId: candidateWithJob.assignedJobId || fromInterview?.jobId,
        assignedJob: candidateWithJob.assignedJob || fromInterview?.jobTitle,
        assignedClientId: fromInterview?.clientId,
      };
    });
  }, [candidateOptions, overviewInterviews]);

  const editInterviewForPopup = useMemo(() => {
    if (!editInterview) return null;
    return mapInterviewToCandidateScheduled(
      editInterview,
      effectiveRoundById[editInterview.id] || 1,
    );
  }, [editInterview, effectiveRoundById]);

  const editInterviewCandidate = useMemo(() => {
    if (!editInterview) return null;
    return {
      id: editInterview.candidate.id,
      name: editInterview.candidate.name,
      phone: null,
      stage: editInterview.candidate.stage ?? null,
      assignedJob: editInterview.job.title,
      assignedJobId: editInterview.job.id,
    };
  }, [editInterview]);

  const scheduleNextRoundCandidate = useMemo(() => {
    if (!scheduleNextRoundFrom) return null;
    return {
      id: scheduleNextRoundFrom.candidate.id,
      name: scheduleNextRoundFrom.candidate.name,
      phone: null,
      stage: scheduleNextRoundFrom.candidate.stage ?? null,
      assignedJob: scheduleNextRoundFrom.job.title,
      assignedJobId: scheduleNextRoundFrom.job.id,
    };
  }, [scheduleNextRoundFrom]);

  const scheduleNextRoundExistingInterviews = useMemo(() => {
    if (!scheduleNextRoundFrom) return [];
    const candidateId = scheduleNextRoundFrom.candidate.id;
    const jobId = scheduleNextRoundFrom.job.id;
    const source =
      jobScopedInterviews.length > 0 ? jobScopedInterviews : overviewInterviews;
    return source
      .filter((inv) => inv.candidate.id === candidateId && inv.job.id === jobId)
      .sort(
        (a, b) =>
          new Date(a.scheduledAt || 0).getTime() - new Date(b.scheduledAt || 0).getTime(),
      )
      .map((inv, index) =>
        mapInterviewToCandidateScheduled(inv, effectiveRoundById[inv.id] || index + 1),
      );
  }, [effectiveRoundById, jobScopedInterviews, overviewInterviews, scheduleNextRoundFrom]);

  const interviewSmartSearchOptions = useMemo(
    () => ({
      interviewers: interviewerOptions
        .map((member) => ({
          id: String(member.userId || member.id),
          name: member.name?.trim() || '',
        }))
        .filter((member) => member.name),
      clientJobs: clientJobOptions,
    }),
    [clientJobOptions, interviewerOptions],
  );

  const interviewSmartSearch = useSmartSearch({
    parsePrompt: (text) => parseInterviewsSmartSearchPrompt(text, interviewSmartSearchOptions),
    parsePromptWithAi: (text) =>
      parseSmartSearchWithAi('interviews', text, { useTenantDatabase: true }, mapAiToInterviewsResult),
    applyParsed: (parsed) => {
      setPagination((p) => ({ ...p, page: 1 }));
      setFilters((prev) => ({
        ...prev,
        status: parsed.status || ALL_STATUS_LABEL,
        round: parsed.round || 'All Rounds',
        mode: parsed.mode || 'All Modes',
        interviewer: parsed.interviewer || 'All Interviewers',
        clientJob: parsed.clientJob || 'All Clients',
      }));
      setSearchQuery(parsed.searchText);
      setSmartSearchInterviewIds(
        parsed.matchingInterviewIds && parsed.matchingInterviewIds.length > 0
          ? parsed.matchingInterviewIds
          : [],
      );
    },
    onRemoveKeyword: (removed, remaining) => {
      setPagination((p) => ({ ...p, page: 1 }));
      if (removed.kind === 'status') {
        setFilters((prev) => ({ ...prev, status: ALL_STATUS_LABEL }));
      }
      if (removed.kind === 'round') {
        setFilters((prev) => ({ ...prev, round: 'All Rounds' }));
      }
      if (removed.kind === 'mode') {
        setFilters((prev) => ({ ...prev, mode: 'All Modes' }));
      }
      if (removed.kind === 'recruiter') {
        setFilters((prev) => ({ ...prev, interviewer: 'All Interviewers' }));
      }
      if (removed.kind === 'client') {
        setFilters((prev) => ({ ...prev, clientJob: 'All Clients' }));
      }
      if (removed.kind === 'text') {
        const text = remaining
          .filter((keyword) => keyword.kind === 'text')
          .map((keyword) => keyword.value)
          .join(' ');
        setSearchQuery(text);
      }
    },
    examples: INTERVIEWS_SMART_SEARCH_EXAMPLES,
  });

  const hasToolbarFilters = useMemo(() => {
    if (smartSearchInterviewIds.length > 0) return true;
    if (searchQuery.trim()) return true;
    if (interviewSmartSearch.activeKeywords.length > 0) return true;
    return (
      filters.date !== 'This Week' ||
      filters.status !== ALL_STATUS_LABEL ||
      filters.round !== 'All Rounds' ||
      filters.mode !== 'All Modes' ||
      filters.interviewer !== 'All Interviewers' ||
      filters.clientJob !== 'All Clients'
    );
  }, [filters, interviewSmartSearch.activeKeywords.length, searchQuery, smartSearchInterviewIds.length]);

  const patchFilter = (field: keyof InterviewFiltersState, value: string) => {
    setPagination((p) => ({ ...p, page: 1 }));
    setOverviewPage(1);
    setFilters((prev) => ({ ...prev, [field]: value }));
  };

  const handleClearToolbar = () => {
    clearFilters();
    setSearchQuery('');
    setSmartSearchInterviewIds([]);
    interviewSmartSearch.clearSmartSearch();
    setPagination((p) => ({ ...p, page: 1 }));
    setOverviewPage(1);
  };

  const openSelectedJob = (jobId: string) => {
    const rounds = uniqueRoundNumbersForJob(
      filterInterviewsForJobOverview(
        [
          ...overviewInterviews.filter((interview) => interview.job.id === jobId),
          ...jobScopedInterviews.filter((interview) => interview.job.id === jobId),
        ],
        {
          searchQuery: '',
          status: filters.status,
          round: 'All Rounds',
          mode: filters.mode,
          interviewer: filters.interviewer,
          clientJob: 'All Clients',
          matchingInterviewIds: smartSearchInterviewIds,
          allStatusLabel: ALL_STATUS_LABEL,
        },
      ),
      jobId,
      effectiveRoundById,
    );
    setSelectedJobId(jobId);
    setSelectedRound(rounds[0] ?? 1);
    setOverviewPage(1);
    setJobDetailLoading(true);
  };

  const closeSelectedJob = () => {
    setSelectedJobId(null);
    setSelectedRound(1);
    setOverviewPage(1);
  };

  const openInterview = (interview: Interview) => {
    drawer.openDrawer(interview.id);
  };

  const openEditFlow = (interview: Interview) => {
    if (isInterviewCompleted(interview)) return;
    setScheduleNextRoundFrom(null);
    setEditInterview(interview);
    drawer.closeDrawer();
    window.setTimeout(() => modals.open('schedule'), 260);
  };

  const openRejectFlow = (interview: Interview) => {
    if (isInterviewCompleted(interview)) return;
    setRejectInterview(interview);
    drawer.closeDrawer();
    window.setTimeout(() => setRejectModalOpen(true), 260);
  };

  const openScheduleNextRoundFlow = (interview: Interview) => {
    if (!isInterviewCompleted(interview)) return;
    setEditInterview(null);
    setScheduleNextRoundFrom(interview);
    drawer.closeDrawer();
    window.setTimeout(() => modals.open('schedule'), 260);
  };

  const handleAction = (action: InterviewAction, interview: Interview) => {
    if (
      (COMPLETED_INTERVIEW_LOCKED_ACTIONS as readonly InterviewAction[]).includes(action) &&
      isInterviewCompleted(interview)
    ) {
      return;
    }
    if (action === 'feedback' || action === 'edit' || action === 'reschedule' || action === 'noShow' || action === 'reject') {
      if (!canUpdateInterview) return;
    }
    if (action === 'cancel' && !canDeleteInterview) {
      return;
    }
    if (action === 'delete' && !canDeleteInterview) {
      return;
    }
    if (action === 'view') {
      openInterview(interview);
      return;
    }
    if (action === 'edit') {
      openEditFlow(interview);
      return;
    }
    if (action === 'reschedule') {
      openInterview(interview);
      modals.open('reschedule');
      return;
    }
    if (action === 'cancel') {
      openInterview(interview);
      modals.open('cancel');
      return;
    }
    if (action === 'delete') {
      void (async () => {
        const confirmed = await requestConfirm(`Delete ${interview.candidate.name}'s interview? This will remove it from the schedule.`);
        if (!confirmed) return;
        try {
          await deleteInterview(interview.id);
          if (drawer.selectedInterviewId === interview.id) {
            drawer.closeDrawer();
          }
        } catch {}
      })();
      return;
    }
    if (action === 'reject') {
      openRejectFlow(interview);
      return;
    }
    if (action === 'feedback') {
      openInterview(interview);
      modals.open('feedback');
      return;
    }
    if (action === 'copyLink') {
      navigator.clipboard.writeText(interview.meetingLink || '');
      setToast('Meeting link copied');
      return;
    }
    if (action === 'noShow') {
      openInterview(interview);
      modals.open('noShow');
    }
  };

  const openExportModal = async () => {
    setExportInterviewsLoading(true);
    setExportModalOpen(true);
    try {
      const all = await fetchAllInterviewsForExport();
      setExportInterviews(all);
      if (all.length === 0) {
        sonnerToast.message('No interviews to export with current filters.');
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load interviews for export';
      sonnerToast.error(message);
      setExportModalOpen(false);
      setExportInterviews([]);
    } finally {
      setExportInterviewsLoading(false);
    }
  };

  const handleExportInterviewsCsv = (selectedColumnIds: string[]) => {
    const columns = buildInterviewsCsvColumns(selectedColumnIds);
    if (columns.length === 0) {
      sonnerToast.message('Select at least one column to export.');
      return;
    }
    const rowsToExport =
      exportInterviews.length > 0
        ? exportInterviews
        : selectedJobId
          ? jobRoundInterviews
          : filteredOverviewInterviews;
    if (rowsToExport.length === 0) {
      sonnerToast.message('No interviews to export with current filters.');
      return;
    }
    downloadCsv<Interview>(`interviews-${new Date().toISOString().slice(0, 10)}.csv`, columns, rowsToExport);
    sonnerToast.success(
      `Exported ${rowsToExport.length} interview${rowsToExport.length === 1 ? '' : 's'} to CSV`,
    );
  };

  const openApplicationReview = (row: InterviewApplicationRow) => {
    setReviewApplicationId(row.id);
  };

  const bumpApplicationsRefresh = () => {
    setApplicationsRefreshKey((k) => k + 1);
  };

  const viewSegmented = (
    <div className="inline-flex w-fit items-center rounded-lg border border-indigo-100/90 bg-white/95 p-0.5 shadow-sm ring-1 ring-indigo-100/40">
      <button
        type="button"
        onClick={() => setView('list')}
        className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold whitespace-nowrap transition-all ${
          view === 'list'
            ? 'bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 text-white shadow-sm'
            : 'text-slate-600 hover:bg-indigo-50/50'
        }`}
      >
        <List size={14} className="shrink-0" />
        List
      </button>
      <button
        type="button"
        onClick={() => setView('calendar')}
        className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold whitespace-nowrap transition-all ${
          view === 'calendar'
            ? 'bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 text-white shadow-sm'
            : 'text-slate-600 hover:bg-indigo-50/50'
        }`}
      >
        <Calendar size={14} className="shrink-0" />
        Calendar
      </button>
    </div>
  );

  const selectedJobTitle =
    selectedJobSummary?.jobTitle ||
    jobSourceInterviews[0]?.job.title ||
    jobOptions.find((job) => job.id === selectedJobId)?.title ||
    'Job';
  const selectedJobClient =
    selectedJobSummary?.clientName || jobSourceInterviews[0]?.job.client || '';
  const listTotalCount = selectedJobId ? pagedJobCandidates.totalGroups : jobSummaries.length;
  const listTotalPages = selectedJobId ? pagedJobCandidates.totalPages : jobsTotalPages;
  const listItemLabel = selectedJobId ? 'candidates' : 'jobs';
  const showListPagination =
    !loading &&
    !error &&
    !(selectedJobId && jobDetailLoading) &&
    listTotalCount > 0;

  const jobContextHeader = selectedJobId ? (
    <div className="flex flex-col gap-3 border-b border-indigo-100/60 bg-gradient-to-r from-slate-50/90 via-indigo-50/45 to-violet-50/30 px-4 py-3 sm:px-5">
      <div className="flex flex-wrap items-start gap-3">
        <button
          type="button"
          onClick={closeSelectedJob}
          className="inline-flex items-center gap-1 rounded-lg border border-indigo-200/80 bg-white px-2.5 py-1.5 text-xs font-semibold text-indigo-800 shadow-sm transition-colors hover:bg-indigo-50"
        >
          <ChevronLeft size={14} />
          Jobs
        </button>
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-indigo-500">Job interviews</p>
          <h2 className="truncate text-sm font-bold text-slate-900">{selectedJobTitle}</h2>
          {selectedJobClient ? (
            <p className="truncate text-xs text-slate-500">{selectedJobClient}</p>
          ) : null}
          <p className="mt-1 text-[11px] text-slate-500">
            Candidates are grouped by interview round (Round 1, Round 2, …) based on schedule order.
          </p>
        </div>
      </div>
      <InterviewRoundTabs
        rounds={jobRoundNumbers}
        active={selectedRound}
        onChange={setSelectedRound}
        countsByRound={jobRoundCandidateCounts}
        allCount={jobAllCandidatesCount}
      />
    </div>
  ) : (
    <div className="border-b border-indigo-100/60 px-4 py-2.5 sm:px-5">
      <p className="text-xs font-semibold text-slate-700">Jobs currently under interview</p>
      <p className="text-[11px] text-slate-500">Open a job to see candidates by interview round.</p>
    </div>
  );

  const renderListTableBody = () => {
    const showJobDetail = Boolean(selectedJobId);
    const tableLoading = loading || (showJobDetail && jobDetailLoading);
    if (tableLoading) {
      return <TableSkeleton rows={8} columns={6} />;
    }
    if (error) {
      return (
        <div className="p-10 text-center">
          <p className="text-sm font-medium text-rose-600">Error: {error}</p>
          <button
            type="button"
            onClick={() => void refreshAll()}
            className="mt-4 rounded-lg bg-rose-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-rose-700"
          >
            Retry
          </button>
        </div>
      );
    }
    if (!showJobDetail) {
      return <InterviewJobsTable jobs={pagedJobs} onSelectJob={openSelectedJob} />;
    }
    if (!jobRoundInterviews.length) {
      return (
        <div className="px-4 py-14 text-center">
          <p className="text-sm font-semibold text-slate-800">No candidates in this round</p>
          <p className="mt-1 text-xs text-slate-500">
            Schedule an interview for this job, or switch to another round tab.
          </p>
          {canCreateInterview ? (
            <button
              type="button"
              onClick={() => {
                setEditInterview(null);
                setScheduleNextRoundFrom(null);
                modals.open('schedule');
              }}
              className="mt-5 rounded-lg bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-indigo-500/25 transition-all hover:from-blue-700 hover:via-indigo-700 hover:to-violet-700"
            >
              Schedule interview
            </button>
          ) : null}
        </div>
      );
    }
    return (
      <InterviewTable
        hidePagination
        hideJobColumn
        interviews={pagedJobCandidates.items}
        workspaceAlertsByEntityId={workspaceAlertsByEntityId}
        roundNumberByInterviewId={effectiveRoundById}
        selectedIds={selectedIds}
        page={overviewPage}
        totalPages={pagedJobCandidates.totalPages}
        totalEntries={pagedJobCandidates.totalGroups}
        pageSize={pagination.pageSize}
        isColumnVisible={interviewColumnVisibility.isVisible}
        onToggleSelect={(interviewId) =>
          setSelectedIds((current) =>
            current.includes(interviewId) ? current.filter((id) => id !== interviewId) : [...current, interviewId]
          )
        }
        onToggleSelectAll={() =>
          setSelectedIds((current) =>
            current.length === pagedJobCandidates.items.length
              ? []
              : pagedJobCandidates.items.map((interview) => interview.id)
          )
        }
        onRowClick={openInterview}
        onViewCandidate={(interview) => openInterview(interview)}
        onEditInterview={(interview) => openEditFlow(interview)}
        onNoShowInterview={(interview) => {
          openInterview(interview);
          modals.open('noShow');
        }}
        onMarkInterviewCompleted={
          canUpdateInterview
            ? (interview) => {
                openInterview(interview);
                modals.open('feedback');
              }
            : undefined
        }
        onRejectCandidate={(interview) => openRejectFlow(interview)}
        onPageChange={(page) => setOverviewPage(page)}
      />
    );
  };

  return (
    <>
      <Toaster position="top-right" richColors style={{ top: '5rem' }} />
      <div className="ph2-page-shell flex h-[calc(100dvh-3.5rem)] w-full flex-col overflow-hidden text-slate-900">
        <main className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
          <header className="flex min-h-[4.5rem] shrink-0 flex-wrap items-center justify-between gap-3 border-b border-indigo-100/50 bg-white/80 px-4 py-3 shadow-[inset_0_-1px_0_0_rgba(99,102,241,0.08)] backdrop-blur-md sm:px-6">
            <div className="flex items-center gap-2.5 sm:gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 via-indigo-600 to-blue-600 text-white shadow-lg shadow-indigo-500/30 ring-1 ring-white/20">
                <Calendar className="h-5 w-5" strokeWidth={2.2} />
              </div>
              <div>
                <h1 className="text-xl font-bold leading-none tracking-tight text-slate-900 sm:text-[1.35rem]">Interviews</h1>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                onClick={() => void refreshAll()}
                disabled={loading}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-indigo-200/80 bg-white text-indigo-700 shadow-[0_4px_14px_-4px_rgba(99,102,241,0.2)] transition-all hover:border-indigo-300 hover:bg-indigo-50/90 active:scale-[0.98] disabled:opacity-50"
                title="Refresh"
              >
                <RefreshCcw size={16} strokeWidth={2.25} className={loading ? 'animate-spin' : ''} />
                  </button>
              {moduleTab === 'scheduled' ? (
                  <button
                    type="button"
                onClick={() => void openExportModal()}
                className="flex items-center gap-1.5 rounded-lg border border-indigo-200/70 bg-white px-3 py-2 text-xs font-semibold text-indigo-900 shadow-[0_4px_14px_-4px_rgba(99,102,241,0.25)] transition-all hover:border-indigo-300 hover:bg-indigo-50/90 hover:shadow-[0_6px_20px_-4px_rgba(99,102,241,0.35)] active:scale-[0.98]"
                title="Export filtered interviews to CSV"
              >
                <Download size={16} className="text-indigo-600" strokeWidth={2.25} />
                <span>Export</span>
                  </button>
              ) : null}
              <Link
                href="/interviews/forms"
                className={`flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold shadow-sm transition-all active:scale-[0.98] ${
                  moduleTab === 'applications' || moduleTab === 'interviewer'
                    ? 'bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-500/30 hover:opacity-95'
                    : 'border border-indigo-200/70 bg-white text-indigo-900 hover:bg-indigo-50/90'
                }`}
              >
                <Plus size={16} strokeWidth={2.5} className={moduleTab === 'scheduled' ? 'text-indigo-600' : 'text-white'} />
                <span>Create interview form</span>
              </Link>
              {moduleTab === 'scheduled' && canCreateInterview ? (
                <button
                  type="button"
                  onClick={() => {
                    setEditInterview(null);
                    setScheduleNextRoundFrom(null);
                    modals.open('schedule');
                  }}
                  className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 px-3.5 py-2 text-xs font-semibold text-white shadow-lg shadow-indigo-500/30 transition-all hover:from-blue-700 hover:via-indigo-700 hover:to-violet-700 active:scale-[0.98]"
                >
                  <Plus size={16} className="text-white" strokeWidth={2.5} />
                  <span>Schedule interview</span>
                </button>
              ) : null}
            </div>
          </header>

          <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-3 py-4 sm:px-5 sm:py-6 lg:px-6">
            <div className="mx-auto flex min-h-0 w-full max-w-[1600px] flex-1 flex-col overflow-hidden">
              <div className="mb-5 shrink-0">
                <InterviewModuleTabs active={moduleTab} onChange={setModuleTab} />
              </div>

              {moduleTab === 'applications' ? (
                <div className="min-h-0 flex-1 overflow-auto">
                <InterviewApplicationsTab
                  key={applicationsRefreshKey}
                  onReview={openApplicationReview}
                />
                </div>
              ) : moduleTab === 'interviewer' ? (
                <div className="min-h-0 flex-1 overflow-auto">
                <InterviewerApplicationsTab
                  key={applicationsRefreshKey}
                  onReview={openApplicationReview}
                />
                </div>
              ) : (
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <div className="mb-5 shrink-0">
                {loading ? (
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-2 sm:gap-3 lg:grid-cols-4">
                    {(['blue', 'cyan', 'orange', 'purple'] as SummaryCardColor[]).map((c, i) => (
                      <SummaryCardSkeleton key={i} color={c} />
                    ))}
                  </div>
                ) : (
                  <InterviewKPICards items={kpis} />
                )}
              </div>

              {view === 'list' ? (
                <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="flex min-h-0 flex-1 flex-col overflow-hidden">
                  <div className={PH2_TABLE_CARD_CLASS}>
                    {jobContextHeader}
                    <div className={PH2_TOOLBAR_ROW_CLASS}>
                      <div className="flex w-full flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                        <div className="relative w-full lg:max-w-md lg:flex-1">
                          <Search
                            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-indigo-400"
                            size={16}
                            strokeWidth={2.25}
                          />
                          <input
                            type="text"
                            placeholder={
                              selectedJobId
                                ? 'Search candidate…'
                                : 'Search job, client, or candidate…'
                            }
                            value={searchQuery}
                            onChange={(e) => {
                              setPagination((p) => ({ ...p, page: 1 }));
                              setOverviewPage(1);
                              setSearchQuery(e.target.value);
                            }}
                            className="h-9 w-full rounded-xl border border-indigo-100/90 bg-white/95 pl-10 pr-3 text-xs text-slate-800 shadow-[inset_0_1px_2px_rgba(15,23,42,0.04)] placeholder:text-slate-400 transition-all focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                          />
                        </div>
                        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center lg:justify-end">
                          <SmartSearchToggleButton
                            open={interviewSmartSearch.open}
                            onToggle={() => interviewSmartSearch.setOpen((value) => !value)}
                          />
                          {viewSegmented}
                          <select
                            className={PH2_TOOLBAR_SELECT_CLASS}
                            value={filters.date}
                            onChange={(e) => patchFilter('date', e.target.value)}
                          >
                            {INTERVIEW_DATE_OPTIONS.map((opt) => (
                              <option key={opt} value={opt}>
                                {opt}
                              </option>
                            ))}
                          </select>
                          <select
                            className={PH2_TOOLBAR_SELECT_CLASS}
                            value={filters.status}
                            onChange={(e) => patchFilter('status', e.target.value)}
                          >
                            {INTERVIEW_STATUS_OPTIONS.map((opt) => (
                              <option key={opt} value={opt}>
                                {opt}
                              </option>
                            ))}
                          </select>
                          {!selectedJobId ? (
                            <select
                              className={PH2_TOOLBAR_SELECT_CLASS}
                              value={filters.round}
                              onChange={(e) => patchFilter('round', e.target.value)}
                            >
                              {INTERVIEW_ROUND_OPTIONS.map((opt) => (
                                <option key={opt} value={opt}>
                                  {opt}
                                </option>
                              ))}
                            </select>
                          ) : null}
                          <select
                            className={PH2_TOOLBAR_SELECT_CLASS}
                            value={filters.mode}
                            onChange={(e) => patchFilter('mode', e.target.value)}
                          >
                            {INTERVIEW_MODE_OPTIONS.map((opt) => (
                              <option key={opt} value={opt}>
                                {opt}
                              </option>
                            ))}
                          </select>
                          <select
                            className={PH2_TOOLBAR_SELECT_CLASS}
                            value={filters.interviewer}
                            onChange={(e) => patchFilter('interviewer', e.target.value)}
                          >
                            <option value="All Interviewers">All interviewers</option>
                            {interviewerOptions.map((m) => {
                              const name = m.name?.trim() || '';
                              if (!name) return null;
                              return (
                                <option key={String(m.userId || m.id)} value={name}>
                                  {name}
                                </option>
                              );
                            })}
                          </select>
                          <select
                            className={PH2_TOOLBAR_SELECT_CLASS}
                            value={filters.clientJob}
                            onChange={(e) => patchFilter('clientJob', e.target.value)}
                          >
                            <option value="All Clients">All clients / jobs</option>
                            {clientJobOptions.map((label) => (
                              <option key={label} value={label}>
                                {label}
                              </option>
                            ))}
                          </select>
                          <TableColumnsMenu
                            columns={INTERVIEW_TABLE_COLUMNS}
                            isVisible={interviewColumnVisibility.isVisible}
                            onToggle={interviewColumnVisibility.toggle}
                            onReset={interviewColumnVisibility.resetToDefault}
                            unlockedVisibleCount={interviewColumnVisibility.unlockedVisibleCount}
                          />
                          {hasToolbarFilters ? (
                            <button
                              type="button"
                              onClick={handleClearToolbar}
                              className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-semibold text-rose-600 transition-colors hover:bg-rose-50 hover:text-rose-700"
                            >
                              <XCircle size={15} className="shrink-0 text-rose-500" strokeWidth={2.35} />
                              Clear
                            </button>
                          ) : null}
                          <span className="whitespace-nowrap text-[11px] font-medium text-slate-500">
                            Total:{' '}
                            <span className="font-semibold text-slate-800">{listTotalCount}</span>
                          </span>
                        </div>
              </div>
            </div>

                    {interviewSmartSearch.open ? (
                      <SmartSearchPromptPanel
                        prompt={interviewSmartSearch.prompt}
                        onPromptChange={interviewSmartSearch.setPrompt}
                        onApply={interviewSmartSearch.handleApply}
                        previewKeywords={interviewSmartSearch.previewKeywords}
                        examples={interviewSmartSearch.examples}
                        onExampleClick={interviewSmartSearch.handleExample}
                        entityLabel="interviews"
                        applying={interviewSmartSearch.applying}
                        placeholder="e.g. scheduled technical round online this week"
                      />
                    ) : null}

                    <SmartSearchActiveKeywordsBar
                      chips={interviewSmartSearch.activeChips}
                      onClearAll={handleClearToolbar}
                      resultCount={listTotalCount}
                      showResultCount={!loading && !error}
                    />

                    <div className={PH2_TABLE_BODY_SCROLL_CLASS}>{renderListTableBody()}</div>

                    {showListPagination ? (
                      <div className={PH2_TABLE_CARD_FOOTER_CLASS}>
                        <PaginationAll
                          initialPage={overviewPage}
                          totalPages={listTotalPages}
                          totalCount={listTotalCount}
                          pageSize={pagination.pageSize}
                          pageSizeOptions={[...TABLE_PAGE_SIZE_OPTIONS]}
                          onPageSizeChange={(n) => {
                            if (!(TABLE_PAGE_SIZE_OPTIONS as readonly number[]).includes(n)) return;
                            setOverviewPage(1);
                            setPagination((current) => ({
                              ...current,
                              pageSize: n as TablePageSize,
                              page: 1,
                            }));
                          }}
                          itemLabel={listItemLabel}
                          onPageChange={(page) => setOverviewPage(page)}
                        />
                      </div>
                    ) : null}
                  </div>
              </motion.div>
            ) : (
                <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="flex min-h-0 flex-1 flex-col overflow-hidden">
                  <div className={PH2_TABLE_CARD_CLASS}>
                    {jobContextHeader}
                    <div className={PH2_TOOLBAR_ROW_CLASS}>
                      <p className="max-w-xl text-xs text-slate-600">
                        Calendar view — switch to list for search, filters, and row actions.
                      </p>
                      <div className="flex shrink-0 items-center gap-2">{viewSegmented}</div>
                    </div>
                    <div className={`${PH2_TABLE_BODY_SCROLL_CLASS} p-3 sm:p-4`}>
                <InterviewCalendarView
                  interviews={selectedJobId ? jobRoundInterviews : filteredOverviewInterviews}
                  onSelectInterview={openInterview}
                />
                    </div>
                  </div>
              </motion.div>
            )}
              </div>
              )}
          </div>
        </div>
      </main>

      <InterviewDrawer
        isOpen={drawer.isOpen}
        interview={selectedInterview}
        onClose={drawer.closeDrawer}
        onOpenFeedback={canUpdateInterview ? () => modals.open('feedback') : undefined}
        onOpenCancel={canDeleteInterview ? () => modals.open('cancel') : undefined}
        onOpenPanelAssignment={canUpdateInterview ? () => setPanelModalOpen(true) : undefined}
        onOpenReject={canUpdateInterview && selectedInterview ? () => openRejectFlow(selectedInterview) : undefined}
        onOpenSubmitToClient={
          canUpdateInterview && selectedInterview
            ? () => {
                setSubmitToClientOpen(true);
              }
            : undefined
        }
        onScheduleNextRound={
          canCreateInterview && selectedInterview && isInterviewCompleted(selectedInterview)
            ? () => openScheduleNextRoundFlow(selectedInterview)
            : undefined
        }
        onAction={selectedInterview ? (action) => handleAction(action, selectedInterview) : undefined}
        onAddNote={canUpdateInterview ? async (text) => {
          if (!selectedInterview) return;
          try {
            await addNote(selectedInterview.id, text);
          } catch {}
        } : undefined}
      />

      <SubmitToClientDrawer
        isOpen={canUpdateInterview && submitToClientOpen}
        interview={selectedInterview}
        onClose={() => setSubmitToClientOpen(false)}
        onToast={setToast}
      />

      <RejectCandidateModal
        isOpen={canUpdateInterview && rejectModalOpen}
        interview={rejectInterview}
        onClose={() => {
          setRejectModalOpen(false);
          setRejectInterview(null);
        }}
        onReject={async ({ reason, feedback, sendEmail, showFeedbackToCandidate }) => {
          if (!rejectInterview) return;
          await apiRejectCandidate(rejectInterview.candidate.id, {
            reason,
            feedback,
            sendEmail,
            showFeedbackToCandidate,
            jobId: rejectInterview.job?.id,
          });
          setToast(`${rejectInterview.candidate.name} rejected`);
          setRejectModalOpen(false);
          setRejectInterview(null);
          await refreshAll();
        }}
      />

      <CandidateScheduleInterviewModal
        isOpen={
          modals.isModalOpen('schedule') &&
          ((!editInterview && !scheduleNextRoundFrom && canCreateInterview) ||
            (!!editInterview && canUpdateInterview) ||
            (!!scheduleNextRoundFrom && canCreateInterview))
        }
        candidate={editInterview ? editInterviewCandidate : scheduleNextRoundCandidate}
        candidateOptions={
          editInterview || scheduleNextRoundFrom ? undefined : scheduleCandidateOptions
        }
        initialJobId={scheduleNextRoundFrom?.job.id ?? editInterview?.job.id ?? undefined}
        jobs={jobOptions.map((job) => ({
          id: job.id,
          title: job.title,
          clientId: job.clientId ?? null,
          clientName: job.client ?? null,
        }))}
        interviewers={interviewerOptions.map((member) => ({
          id: member.userId || member.id,
          name: member.name,
          role: member.role,
          department: member.department,
        }))}
        existingInterviews={scheduleNextRoundExistingInterviews}
        editInterview={editInterviewForPopup}
        onClose={() => {
          modals.close();
          setEditInterview(null);
          setScheduleNextRoundFrom(null);
        }}
        onScheduledSuccess={(message) => setToast(message)}
        onSchedule={async (interviewData) => {
          await apiScheduleCandidateInterview(interviewData.candidateId, {
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
          });
          setScheduleNextRoundFrom(null);
          await refreshAll();
        }}
        onUpdate={async (interviewId, interviewData) => {
          await updateInterview(
            interviewId,
            mapCandidateScheduledToUpdatePayload(
              interviewData,
              editInterview?.timezone,
              editInterview?.notes,
            ),
          );
          await refreshAll();
        }}
      />

      <RescheduleModal
        isOpen={canUpdateInterview && modals.isModalOpen('reschedule')}
        interview={selectedInterview}
        onClose={modals.close}
        onSubmit={async (payload) => {
          if (!selectedInterview) return;
          await rescheduleInterview(selectedInterview.id, payload);
          modals.close();
        }}
      />

      <CancelInterviewModal
        isOpen={canDeleteInterview && modals.isModalOpen('cancel')}
        interview={selectedInterview}
        onClose={modals.close}
        onSubmit={async (payload) => {
          if (!selectedInterview) return;
          try {
            await cancelInterview(selectedInterview.id, payload);
            modals.close();
          } catch {}
        }}
      />

      <FeedbackModal
        isOpen={canUpdateInterview && modals.isModalOpen('feedback')}
        interview={selectedInterview}
        onClose={modals.close}
        onSubmit={async (payload) => {
          if (!selectedInterview) return;
          try {
            await submitFeedback(selectedInterview.id, payload);
            modals.close();
          } catch {}
        }}
      />

      <NoShowModal
        isOpen={canUpdateInterview && modals.isModalOpen('noShow')}
        interview={selectedInterview}
        onClose={modals.close}
        onSubmit={async (payload) => {
          if (!selectedInterview) return;
          try {
            await markNoShow(selectedInterview.id, payload);
            modals.close();
          } catch {}
        }}
      />

      <PanelAssignmentModal
        isOpen={canUpdateInterview && panelModalOpen}
        interviewers={interviewerOptions}
        initialSelectedIds={selectedInterview?.panel.map((member) => member.userId || member.id) || []}
        onClose={() => setPanelModalOpen(false)}
        onSave={async (panelIds) => {
          if (!selectedInterview) return;
          try {
            await updatePanel(selectedInterview.id, panelIds);
            setPanelModalOpen(false);
          } catch {}
        }}
      />

      <InterviewApplicationReviewDrawer
        applicationId={reviewApplicationId}
        onClose={() => setReviewApplicationId(null)}
        onUpdated={bumpApplicationsRefresh}
      />

      <ExportColumnsModal
        isOpen={exportModalOpen}
        onClose={() => {
          setExportModalOpen(false);
          setExportInterviews([]);
        }}
        title="Export interviews"
        rowCount={exportInterviews.length}
        rowLabelSingular="interview"
        rowLabelPlural="interviews"
        columns={INTERVIEWS_EXPORT_COLUMNS}
        rows={exportInterviews}
        isLoading={exportInterviewsLoading}
        getRowKey={(interview) => interview.id}
        onExport={handleExportInterviewsCsv}
      />

      <AnimatePresence>
        {toast ? (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            className="fixed right-6 top-6 z-[140] rounded-xl bg-[#111827] px-4 py-3 text-sm font-medium text-white shadow-xl"
          >
            {toast}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
    </>
  );
}
