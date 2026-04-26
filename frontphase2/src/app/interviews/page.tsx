'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Calendar, List, Plus, RefreshCw } from 'lucide-react';
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
import { UploadRecordingModal } from '../../components/interviews/UploadRecordingModal';
import { useInterviewDrawer } from '../../hooks/useInterviewDrawer';
import { useInterviews } from '../../hooks/useInterviews';
import { useInterviewModals } from '../../hooks/useInterviewModals';
import type { Interview } from '../../types/interview.types';
import type { InterviewAction } from '../../components/interviews/ActionsDropdown';
import { usePermissions } from '../../hooks/usePermissions';
import { requestConfirm } from '../../lib/appDialog';
import { apiRejectCandidate } from '../../lib/api';

export default function InterviewsPage() {
  const { hasPermission } = usePermissions();
  const canCreateInterview = hasPermission('interviews_create');
  const canUpdateInterview = hasPermission('interviews_update');
  const canDeleteInterview = hasPermission('interviews_delete');
  const [view, setView] = useState<'list' | 'calendar'>('list');
  const [panelModalOpen, setPanelModalOpen] = useState(false);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectInterview, setRejectInterview] = useState<Interview | null>(null);
  const [editInterview, setEditInterview] = useState<Interview | null>(null);
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
          {canCreateInterview && (
            <button type="button" onClick={() => modals.open('schedule')} className="mt-5 rounded-xl bg-[#2563EB] px-4 py-2 text-sm font-semibold text-white">
              Schedule Interview
            </button>
          )}
        </div>
      );
    }

    return (
      <InterviewTable
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
        onRejectCandidate={(interview) => openRejectFlow(interview)}
        onPageChange={(page) => setPagination((current) => ({ ...current, page }))}
      />
    );
  };

  return (
    <div className="min-h-screen w-full overflow-hidden bg-[#F8F9FB] text-[#111827]">
      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto p-8">
          <div className="space-y-8">
            <div className="flex flex-col justify-between gap-6 xl:flex-row xl:items-center">
              <div>
                <h1 className="text-[20px] font-bold leading-[28px] text-[#111827]">Interviews</h1>
                <p className="text-[13px] text-[#6B7280]">Schedule, manage, and track candidate interviews</p>
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
                {canCreateInterview && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditInterview(null);
                      modals.open('schedule');
                    }}
                    className="flex items-center gap-2 rounded-xl bg-[#2563EB] px-5 py-2.5 text-sm font-bold text-white shadow-sm"
                  >
                    <Plus className="size-4" />
                    Schedule Interview
                  </button>
                )}
              </div>
            </div>

            <InterviewKPICards items={kpis} />

            {view === 'list' ? (
              <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
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
        onOpenFeedback={canUpdateInterview ? () => modals.open('feedback') : undefined}
        onOpenReschedule={canUpdateInterview ? () => modals.open('reschedule') : undefined}
        onOpenCancel={canDeleteInterview ? () => modals.open('cancel') : undefined}
        onOpenUploadRecording={canUpdateInterview ? () => modals.open('uploadRecording') : undefined}
        onOpenPanelAssignment={canUpdateInterview ? () => setPanelModalOpen(true) : undefined}
        onOpenReject={canUpdateInterview && selectedInterview ? () => openRejectFlow(selectedInterview) : undefined}
        onAction={selectedInterview ? (action) => handleAction(action, selectedInterview) : undefined}
        onAddNote={canUpdateInterview ? async (text) => {
          if (!selectedInterview) return;
          try {
            await addNote(selectedInterview.id, text);
          } catch {}
        } : undefined}
      />

      <RejectCandidateModal
        isOpen={canUpdateInterview && rejectModalOpen}
        interview={rejectInterview}
        onClose={() => {
          setRejectModalOpen(false);
          setRejectInterview(null);
        }}
        onReject={async ({ reason, feedback, sendEmail }) => {
          if (!rejectInterview) return;
          await apiRejectCandidate(rejectInterview.candidate.id, { reason, feedback, sendEmail });
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
                date: new Date(payload.date).toISOString(),
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

      <UploadRecordingModal
        isOpen={canUpdateInterview && modals.isModalOpen('uploadRecording')}
        interview={selectedInterview}
        onClose={modals.close}
        onAttach={(type, value) => {
          if (!selectedInterview) return;
          attachRecording(selectedInterview.id, type, value);
          modals.close();
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
