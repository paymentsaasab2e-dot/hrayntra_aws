'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Calendar, Download, List, Plus, RefreshCcw, Search, XCircle } from 'lucide-react';
import { toast as sonnerToast, Toaster } from 'sonner';
import { downloadCsv } from '../../utils/csv';
import { ExportColumnsModal } from '../../components/export/ExportColumnsModal';
import { buildInterviewsCsvColumns, INTERVIEWS_EXPORT_COLUMNS } from '../../lib/export/interviewsExportColumns';
import { CancelInterviewModal } from '../../components/interviews/CancelInterviewModal';
import { FeedbackModal } from '../../components/interviews/FeedbackModal';
import { InterviewCalendarView } from '../../components/interviews/InterviewCalendarView';
import { InterviewDrawer } from '../../components/interviews/InterviewDrawer';
import { InterviewKPICards } from '../../components/interviews/InterviewKPICards';
import { InterviewTable } from '../../components/interviews/InterviewTable';
import { NoShowModal } from '../../components/interviews/NoShowModal';
import { PanelAssignmentModal } from '../../components/interviews/PanelAssignmentModal';
import { RejectCandidateModal } from '../../components/interviews/RejectCandidateModal';
import { RescheduleModal } from '../../components/interviews/RescheduleModal';
import { ScheduleInterviewModal } from '../../components/interviews/ScheduleInterviewModal';
import { SubmitToClientDrawer } from '../../components/interviews/SubmitToClientDrawer';
import { useInterviewDrawer } from '../../hooks/useInterviewDrawer';
import { useInterviews } from '../../hooks/useInterviews';
import { useInterviewModals } from '../../hooks/useInterviewModals';
import type { Interview, InterviewFiltersState, UpdateInterviewPayload } from '../../types/interview.types';
import type { InterviewAction } from '../../components/interviews/ActionsDropdown';
import { usePermissions } from '../../hooks/usePermissions';
import { usePageAutoRefresh } from '../../hooks/usePageAutoRefresh';
import { requestConfirm } from '../../lib/appDialog';
import { combineInterviewDateAndTimeToIso } from '../../lib/interview-schedule-helpers';
import { apiRejectCandidate } from '../../lib/api';
import { TableSkeleton } from '../../components/ui/Skeleton';
import { SummaryCardSkeleton, type SummaryCardColor } from '../../components/ui/SummaryCard';
import PaginationAll from '../../components/PaginationAll';
import { TABLE_PAGE_SIZE_OPTIONS, type TablePageSize } from '../../constants/tablePagination';
import {
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
  const [smartSearchInterviewIds, setSmartSearchInterviewIds] = useState<string[]>([]);
  const [moduleTab, setModuleTab] = useState<InterviewModuleTab>('scheduled');
  const [reviewApplicationId, setReviewApplicationId] = useState<string | null>(null);
  const [applicationsRefreshKey, setApplicationsRefreshKey] = useState(0);
  const drawer = useInterviewDrawer();
  const modals = useInterviewModals();
  const {
    interviews,
    paginatedInterviews,
    filteredInterviews,
    filters,
    setFilters,
    clearFilters,
    pagination,
    setPagination,
    totalPages,
    totalEntries,
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
    scheduleInterview,
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

  const selectedInterview = useMemo(
    () => interviews.find((interview) => interview.id === drawer.selectedInterviewId) || null,
    [drawer.selectedInterviewId, interviews]
  );

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(null), 1800);
    return () => window.clearTimeout(timeout);
  }, [toast, setToast]);

  // Reusable auto-refresh: poll while visible, refresh on tab focus and on
  // interview/job change events. `retryLoad` is the same function the page
  // already calls for explicit reloads.
  usePageAutoRefresh(() => retryLoad(), {
    events: ['jobportal:interviews-changed', 'jobportal:jobs-changed'],
  });

  const clientJobOptions = useMemo(
    () => jobOptions.map((job) => `${job.client} • ${job.title}`),
    [jobOptions]
  );

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
    setFilters((prev) => ({ ...prev, [field]: value }));
  };

  const handleClearToolbar = () => {
    clearFilters();
    setSearchQuery('');
    setSmartSearchInterviewIds([]);
    interviewSmartSearch.clearSmartSearch();
    setPagination((p) => ({ ...p, page: 1 }));
  };

  const openInterview = (interview: Interview) => {
    drawer.openDrawer(interview.id);
  };

  const openEditFlow = (interview: Interview) => {
    setEditInterview(interview);
    drawer.closeDrawer();
    window.setTimeout(() => modals.open('schedule'), 260);
  };

  const openRejectFlow = (interview: Interview) => {
    setRejectInterview(interview);
    drawer.closeDrawer();
    window.setTimeout(() => setRejectModalOpen(true), 260);
  };

  const handleAction = (action: InterviewAction, interview: Interview) => {
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
    const rowsToExport = exportInterviews.length > 0 ? exportInterviews : filteredInterviews;
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

  const renderListTableBody = () => {
    if (loading) {
      return <TableSkeleton rows={8} columns={6} />;
    }
    if (error) {
      return (
        <div className="p-10 text-center">
          <p className="text-sm font-medium text-rose-600">Error: {error}</p>
          <button
            type="button"
            onClick={retryLoad}
            className="mt-4 rounded-lg bg-rose-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-rose-700"
          >
            Retry
          </button>
        </div>
      );
    }
    if (!filteredInterviews.length) {
      return (
        <div className="px-4 py-14 text-center">
          <p className="text-sm font-semibold text-slate-800">No interviews match your filters</p>
          <p className="mt-1 text-xs text-slate-500">Try adjusting search or clear filters, or schedule a new interview.</p>
          {canCreateInterview ? (
            <button
              type="button"
              onClick={() => {
                setEditInterview(null);
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
        interviews={paginatedInterviews}
        selectedIds={selectedIds}
        page={pagination.page}
        totalPages={totalPages}
        totalEntries={totalEntries}
        pageSize={pagination.pageSize}
        onToggleSelect={(interviewId) =>
          setSelectedIds((current) =>
            current.includes(interviewId) ? current.filter((id) => id !== interviewId) : [...current, interviewId]
          )
        }
        onToggleSelectAll={() =>
          setSelectedIds((current) =>
            current.length === paginatedInterviews.length ? [] : paginatedInterviews.map((interview) => interview.id)
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
        onPageChange={(page) => setPagination((current) => ({ ...current, page }))}
      />
    );
  };

  return (
    <>
      <Toaster position="top-right" richColors style={{ top: '5rem' }} />
      <div className="w-full min-h-screen overflow-hidden text-slate-900">
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
                onClick={retryLoad}
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

          <div className="flex-1 overflow-y-auto px-3 py-4 sm:px-5 sm:py-6 lg:px-6">
            <div className="mx-auto max-w-[1600px]">
              <div className="mb-5">
                <InterviewModuleTabs active={moduleTab} onChange={setModuleTab} />
              </div>

              {moduleTab === 'applications' ? (
                <InterviewApplicationsTab
                  key={applicationsRefreshKey}
                  onReview={openApplicationReview}
                />
              ) : moduleTab === 'interviewer' ? (
                <InterviewerApplicationsTab
                  key={applicationsRefreshKey}
                  onReview={openApplicationReview}
                />
              ) : (
              <>
              <div className="mb-5">
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
                <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="space-y-0">
                  <div className={PH2_TABLE_CARD_CLASS}>
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
                            placeholder="Search candidate, job, client, or notes…"
                            value={searchQuery}
                            onChange={(e) => {
                              setPagination((p) => ({ ...p, page: 1 }));
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
                            Total: <span className="font-semibold text-slate-800">{totalEntries}</span>
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
                      resultCount={totalEntries}
                      showResultCount={!loading && !error}
                    />

                    <div className="overflow-hidden">
                      <div className="no-scrollbar overflow-x-auto">{renderListTableBody()}</div>
                    </div>

                    {!loading && !error && filteredInterviews.length > 0 ? (
                      <div className={PH2_TABLE_CARD_FOOTER_CLASS}>
                        <PaginationAll
                          initialPage={pagination.page}
                          totalPages={Math.max(totalPages, 1)}
                          totalCount={totalEntries}
                          pageSize={pagination.pageSize}
                          pageSizeOptions={[...TABLE_PAGE_SIZE_OPTIONS]}
                          onPageSizeChange={(n) => {
                            if (!(TABLE_PAGE_SIZE_OPTIONS as readonly number[]).includes(n)) return;
                            setPagination((current) => ({
                              ...current,
                              pageSize: n as TablePageSize,
                              page: 1,
                            }));
                          }}
                          itemLabel="interviews"
                          onPageChange={(page) => setPagination((current) => ({ ...current, page }))}
                        />
                      </div>
                    ) : null}
                  </div>
              </motion.div>
            ) : (
                <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
                  <div className={PH2_TABLE_CARD_CLASS}>
                    <div className={PH2_TOOLBAR_ROW_CLASS}>
                      <p className="max-w-xl text-xs text-slate-600">
                        Calendar view — switch to list for search, filters, and row actions.
                      </p>
                      <div className="flex shrink-0 items-center gap-2">{viewSegmented}</div>
                    </div>
                    <div className="p-3 sm:p-4">
                <InterviewCalendarView interviews={filteredInterviews} onSelectInterview={openInterview} />
                    </div>
                  </div>
              </motion.div>
            )}
              </>
              )}
          </div>
        </div>
      </main>

      <InterviewDrawer
        isOpen={drawer.isOpen}
        interview={selectedInterview}
        onClose={drawer.closeDrawer}
        onOpenFeedback={canUpdateInterview ? () => modals.open('feedback') : undefined}
        onOpenReschedule={canUpdateInterview ? () => modals.open('reschedule') : undefined}
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
          await retryLoad();
        }}
      />

      <ScheduleInterviewModal
        isOpen={modals.isModalOpen('schedule') && (canCreateInterview || !!editInterview)}
        candidates={candidateOptions}
        jobs={jobOptions}
        interviewers={interviewerOptions}
        editInterview={editInterview}
        onClose={() => {
          modals.close();
          setEditInterview(null);
        }}
        onSchedule={async (payload) => {
          try {
            if (editInterview) {
              await updateInterview(editInterview.id, {
                round: payload.round,
                type: payload.type,
                mode: payload.mode,
                date: combineInterviewDateAndTimeToIso(payload.date, payload.time),
                duration: payload.duration,
                timezone: payload.timezone,
                meetingPlatform:
                  payload.mode === 'Online'
                    ? payload.meetingPlatform === 'Google Meet'
                      ? 'Google Meet'
                      : payload.meetingPlatform === 'MS Teams'
                      ? 'MS Teams'
                      : 'Zoom'
                    : null,
                location: payload.mode === 'Offline' ? payload.location || null : null,
                notes: payload.notes || null,
                panelUserIds: payload.panelIds,
                panelRoles: payload.panelRoles,
              });
            } else {
              await scheduleInterview(payload);
            }
          } catch {}
        }}
        onUpdate={updateInterview}
      />

      <RescheduleModal
        isOpen={canUpdateInterview && modals.isModalOpen('reschedule')}
        interview={selectedInterview}
        onClose={modals.close}
        onSubmit={async (payload) => {
          if (!selectedInterview) return;
          try {
            await rescheduleInterview(selectedInterview.id, payload);
            modals.close();
          } catch {}
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
