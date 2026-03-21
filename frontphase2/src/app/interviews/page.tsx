'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Bell, Calendar, CheckSquare, List, Plus, RefreshCw, Search, Settings } from 'lucide-react';
import { CreateTaskModal } from '../../components/CreateTaskModal';
import { CancelInterviewModal } from '../../components/interviews/CancelInterviewModal';
import { FeedbackModal } from '../../components/interviews/FeedbackModal';
import { InterviewCalendarView } from '../../components/interviews/InterviewCalendarView';
import { InterviewDrawer } from '../../components/interviews/InterviewDrawer';
import { InterviewFilters } from '../../components/interviews/InterviewFilters';
import { InterviewKPICards } from '../../components/interviews/InterviewKPICards';
import { InterviewTable } from '../../components/interviews/InterviewTable';
import { NoShowModal } from '../../components/interviews/NoShowModal';
import { PanelAssignmentModal } from '../../components/interviews/PanelAssignmentModal';
import { RescheduleModal } from '../../components/interviews/RescheduleModal';
import { ScheduleInterviewModal } from '../../components/interviews/ScheduleInterviewModal';
import { UploadRecordingModal } from '../../components/interviews/UploadRecordingModal';
import { useInterviewDrawer } from '../../hooks/useInterviewDrawer';
import { useInterviews } from '../../hooks/useInterviews';
import { useInterviewModals } from '../../hooks/useInterviewModals';
import type { Interview } from '../../types/interview.types';
import type { InterviewAction } from '../../components/interviews/ActionsDropdown';

export default function InterviewsPage() {
  const [view, setView] = useState<'list' | 'calendar'>('list');
  const [createTaskOpen, setCreateTaskOpen] = useState(false);
  const [panelModalOpen, setPanelModalOpen] = useState(false);
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
    cancelInterview,
    submitFeedback,
    addNote,
    updatePanel,
    markNoShow,
    attachRecording,
  } = useInterviews();

  const selectedInterview = useMemo(
    () => interviews.find((interview) => interview.id === drawer.selectedInterviewId) || null,
    [drawer.selectedInterviewId, interviews]
  );

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(null), 1800);
    return () => window.clearTimeout(timeout);
  }, [toast, setToast]);

  const openInterview = (interview: Interview) => {
    drawer.openDrawer(interview.id);
  };

  const handleAction = (action: InterviewAction, interview: Interview) => {
    if (action === 'view' || action === 'edit') {
      openInterview(interview);
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

  const renderListState = () => {
    if (loading) {
      return (
        <div className="space-y-3 rounded-2xl border border-[#E5E7EB] bg-white p-6 shadow-sm">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="h-14 animate-pulse rounded-xl bg-[#F3F4F6]" />
          ))}
        </div>
      );
    }

    if (error) {
      return (
        <div className="rounded-2xl border border-[#FECACA] bg-[#FEF2F2] p-6 text-center">
          <div className="text-lg font-semibold text-[#991B1B]">Could not load interviews</div>
          <p className="mt-1 text-sm text-[#B91C1C]">{error}</p>
          <button type="button" onClick={retryLoad} className="mt-4 rounded-xl bg-[#DC2626] px-4 py-2 text-sm font-semibold text-white">
            Retry
          </button>
        </div>
      );
    }

    if (!filteredInterviews.length) {
      return (
        <div className="rounded-2xl border border-dashed border-[#D1D5DB] bg-white p-12 text-center shadow-sm">
          <div className="text-xl font-semibold text-[#111827]">No interviews scheduled yet</div>
          <p className="mt-2 text-sm text-[#6B7280]">Try clearing filters or schedule a new interview to get started.</p>
          <button type="button" onClick={() => modals.open('schedule')} className="mt-5 rounded-xl bg-[#2563EB] px-4 py-2 text-sm font-semibold text-white">
            Schedule Interview
          </button>
        </div>
      );
    }

    return (
      <InterviewTable
        interviews={paginatedInterviews}
        selectedIds={selectedIds}
        page={pagination.page}
        totalPages={totalPages}
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
        onAction={handleAction}
        onPageChange={(page) => setPagination((current) => ({ ...current, page }))}
      />
    );
  };

  return (
    <div className="min-h-screen w-full overflow-hidden bg-[#F8F9FB] text-[#111827]">
      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-[#E5E7EB] bg-white px-8">
          <div className="flex flex-1 items-center gap-4">
            <div className="relative w-full max-w-md">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#9CA3AF]" />
              <input
                type="text"
                placeholder="Search candidates, jobs, or clients..."
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                className="w-full rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] py-2.5 pl-10 pr-4 text-sm outline-none focus:border-[#2563EB]"
              />
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button className="relative rounded-full p-2 text-[#6B7280] hover:bg-[#F3F4F6]">
              <Bell className="size-5" />
              <span className="absolute right-2 top-2 size-2 rounded-full border-2 border-white bg-[#DC2626]" />
            </button>
            <button className="rounded-full p-2 text-[#6B7280] hover:bg-[#F3F4F6]">
              <Settings className="size-5" />
            </button>
            <div className="mx-2 h-8 w-px bg-[#E5E7EB]" />
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-sm font-semibold leading-tight text-[#111827]">Alex Morgan</p>
                <p className="text-xs text-[#6B7280]">Recruitment Manager</p>
              </div>
              <div className="flex size-9 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-[#2563EB]">
                AM
              </div>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8">
          <div className="space-y-8">
            <div className="flex flex-col justify-between gap-6 xl:flex-row xl:items-center">
              <div>
                <h1 className="text-[24px] font-bold leading-[32px] text-[#111827]">Interviews</h1>
                <p className="text-[14px] text-[#6B7280]">Schedule, manage, and track candidate interviews</p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <div className="flex rounded-xl border border-[#E5E7EB] bg-white p-1 shadow-sm">
                  <button
                    type="button"
                    onClick={() => setView('list')}
                    className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium ${
                      view === 'list' ? 'bg-[#F3F4F6] text-[#111827] shadow-sm' : 'text-[#6B7280]'
                    }`}
                  >
                    <List className="size-4" />
                    List
                  </button>
                  <button
                    type="button"
                    onClick={() => setView('calendar')}
                    className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium ${
                      view === 'calendar' ? 'bg-[#F3F4F6] text-[#111827] shadow-sm' : 'text-[#6B7280]'
                    }`}
                  >
                    <Calendar className="size-4" />
                    Calendar
                  </button>
                </div>

                <button
                  type="button"
                  onClick={retryLoad}
                  className="flex items-center gap-2 rounded-xl border border-[#E5E7EB] bg-white px-4 py-2 text-sm font-medium text-[#374151] shadow-sm"
                >
                  <RefreshCw className="size-4" />
                  Refresh
                </button>
                <button
                  type="button"
                  onClick={() => setCreateTaskOpen(true)}
                  className="flex items-center gap-2 rounded-xl border border-[#E5E7EB] bg-white px-4 py-2 text-sm font-medium text-[#374151] shadow-sm"
                >
                  <CheckSquare className="size-4" />
                  Add Task
                </button>
                <button
                  type="button"
                  onClick={() => modals.open('schedule')}
                  className="flex items-center gap-2 rounded-xl bg-[#2563EB] px-5 py-2.5 text-sm font-bold text-white shadow-sm"
                >
                  <Plus className="size-4" />
                  Schedule Interview
                </button>
              </div>
            </div>

            <InterviewKPICards items={kpis} />

            {view === 'list' ? (
              <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
                <InterviewFilters
                  filters={filters}
                  interviewerOptions={interviewerOptions.map((item) => item.name)}
                  clientJobOptions={jobOptions.map((job) => `${job.client} • ${job.title}`)}
                  onChange={(field, value) => {
                    setFilters((current) => ({ ...current, [field]: value }));
                    setPagination((current) => ({ ...current, page: 1 }));
                  }}
                  onClear={() => {
                    clearFilters();
                    setPagination((current) => ({ ...current, page: 1 }));
                  }}
                />
                {renderListState()}
              </motion.div>
            ) : (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                <InterviewCalendarView interviews={filteredInterviews} onSelectInterview={openInterview} />
              </motion.div>
            )}
          </div>
        </div>
      </main>

      <InterviewDrawer
        isOpen={drawer.isOpen}
        interview={selectedInterview}
        onClose={drawer.closeDrawer}
        onOpenFeedback={() => modals.open('feedback')}
        onOpenReschedule={() => modals.open('reschedule')}
        onOpenCancel={() => modals.open('cancel')}
        onOpenUploadRecording={() => modals.open('uploadRecording')}
        onOpenPanelAssignment={() => setPanelModalOpen(true)}
        onAddNote={async (text) => {
          if (!selectedInterview) return;
          try {
            await addNote(selectedInterview.id, text);
          } catch {}
        }}
      />

      <ScheduleInterviewModal
        isOpen={modals.isModalOpen('schedule')}
        candidates={candidateOptions}
        jobs={jobOptions}
        interviewers={interviewerOptions}
        onClose={modals.close}
        onSchedule={async (payload) => {
          try {
            await scheduleInterview(payload);
          } catch {}
        }}
      />

      <RescheduleModal
        isOpen={modals.isModalOpen('reschedule')}
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
        isOpen={modals.isModalOpen('cancel')}
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
        isOpen={modals.isModalOpen('feedback')}
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
        isOpen={modals.isModalOpen('noShow')}
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

      <UploadRecordingModal
        isOpen={modals.isModalOpen('uploadRecording')}
        interview={selectedInterview}
        onClose={modals.close}
        onAttach={(type, value) => {
          if (!selectedInterview) return;
          attachRecording(selectedInterview.id, type, value);
          modals.close();
        }}
      />

      <PanelAssignmentModal
        isOpen={panelModalOpen}
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

      <CreateTaskModal
        isOpen={createTaskOpen}
        onClose={() => setCreateTaskOpen(false)}
        onSuccess={() => setCreateTaskOpen(false)}
        initialRelatedTo="Interview"
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
  );
}
