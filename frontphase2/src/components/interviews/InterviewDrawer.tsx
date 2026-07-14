import React, { useState } from 'react';
import { usePageDrawerLifecycle } from '../../lib/pageDrawerEvents';
import { AnimatePresence, motion } from 'motion/react';
import { CalendarPlus, Edit2, Trash2, UserRoundX, X, XCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import type { InterviewAction } from './ActionsDropdown';
import { DrawerActivityLog } from './DrawerActivityLog';
import { DrawerFeedbackTab } from './DrawerFeedbackTab';
import { DrawerFilesTab } from './DrawerFilesTab';
import { DrawerClientTab } from './DrawerClientTab';
import { DrawerNotesTab } from './DrawerNotesTab';
import { DrawerOverviewTab } from './DrawerOverviewTab';
import { EntityWorkspaceAlertsPanel } from '../ai/EntityWorkspaceAlertsPanel';
import { DrawerPanelTab } from './DrawerPanelTab';
import { DrawerEntityChatTab } from '../drawers/DrawerEntityChatTab';
import type { DrawerTab, Interview } from '../../types/interview.types';
import { isInterviewCompleted } from '../../types/interview.types';
import { getCandidateStageBadgeClasses, getCandidateStageLabel } from '../../utils/candidateStage';

interface InterviewDrawerProps {
  isOpen: boolean;
  interview: Interview | null;
  onClose: () => void;
  onOpenFeedback?: () => void;
  onOpenCancel?: () => void;
  onOpenPanelAssignment?: () => void;
  onOpenReject?: () => void;
  onOpenSubmitToClient?: () => void;
  onScheduleNextRound?: () => void;
  onAddNote?: (text: string) => Promise<void>;
  onAction?: (action: InterviewAction) => void;
}

const tabs: Array<{ id: DrawerTab; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'panel', label: 'Panel' },
  { id: 'feedback', label: 'Feedback' },
  { id: 'client', label: 'Client' },
  { id: 'notes', label: 'Remarks' },
  { id: 'activity', label: 'Activity Log' },
  { id: 'files', label: 'Files' },
  { id: 'chat', label: 'Chat' },
];

export function InterviewDrawer({
  isOpen,
  interview,
  onClose,
  onOpenFeedback,
  onOpenCancel,
  onOpenPanelAssignment,
  onOpenReject,
  onOpenSubmitToClient,
  onScheduleNextRound,
  onAddNote,
  onAction,
}: InterviewDrawerProps) {
  usePageDrawerLifecycle(isOpen);
  const [activeTab, setActiveTab] = useState<DrawerTab>('overview');
  const router = useRouter();
  const interviewLocked = interview ? isInterviewCompleted(interview) : false;

  return (
    <AnimatePresence>
      {isOpen && interview ? (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[90] bg-slate-900/40"
          />
          <motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'tween', duration: 0.25 }}
            className="fixed right-0 top-0 z-[100] flex h-full w-3/4 max-w-6xl flex-col bg-white shadow-2xl border-l border-slate-200"
          >
            <div className="border-b border-[#E5E7EB] px-6 py-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className="flex size-12 items-center justify-center rounded-full bg-blue-100 text-sm font-semibold text-[#2563EB]">
                    {interview.candidate.name
                      .split(' ')
                      .map((part) => part[0])
                      .slice(0, 2)
                      .join('')}
                  </div>
                  <div>
                    <div className="text-lg font-semibold text-[#111827]">{interview.candidate.name}</div>
                    <div className="text-sm text-[#6B7280]">{interview.candidate.email}</div>
                    <div className="mt-1 text-sm text-[#6B7280]">
                      {interview.job.title} • {interview.job.client}
                    </div>
                    <span
                      className={`mt-3 inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                        interview.status === 'Scheduled'
                          ? 'bg-blue-50 text-[#2563EB]'
                          : interview.status === 'Completed'
                          ? 'bg-green-50 text-[#16A34A]'
                          : interview.status === 'Cancelled'
                          ? 'bg-red-50 text-[#DC2626]'
                          : interview.status === 'Rescheduled'
                          ? 'bg-orange-50 text-[#F59E0B]'
                          : 'bg-slate-100 text-[#6B7280]'
                      }`}
                    >
                      {interview.status}
                    </span>
                    {interview.candidate.stage ? (
                      <span
                        className={`mt-2 inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${getCandidateStageBadgeClasses(
                          interview.candidate.stage
                        )}`}
                      >
                        {getCandidateStageLabel(interview.candidate.stage)}
                      </span>
                    ) : null}
                  </div>
                </div>
                <button type="button" onClick={onClose} className="rounded-lg p-2 text-[#6B7280] hover:bg-[#F3F4F6]">
                    <X className="size-5" />
                </button>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-4">
                {onOpenFeedback && interview.status !== 'Completed' ? (
                  <button
                    type="button"
                    onClick={onOpenFeedback}
                    className="inline-flex w-full items-center justify-center rounded-md bg-[#2563EB] px-2 py-1.5 text-[11px] font-semibold text-white hover:bg-[#1D4ED8]"
                  >
                    Completed
                  </button>
                ) : null}
                {interviewLocked && onScheduleNextRound ? (
                  <button
                    type="button"
                    onClick={onScheduleNextRound}
                    className="inline-flex w-full items-center justify-center rounded-md bg-[#2563EB] px-2 py-1.5 text-[11px] font-semibold text-white hover:bg-[#1D4ED8]"
                  >
                    <span className="inline-flex items-center gap-1">
                      <CalendarPlus className="size-3" />
                      Schedule Next Round
                    </span>
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => {
                    const candidateId = interview.candidate.id;
                    const jobId = interview.job.id;
                    router.push(`/placement?create=1&candidateId=${encodeURIComponent(candidateId)}&jobId=${encodeURIComponent(jobId)}`);
                    onClose();
                  }}
                  className="inline-flex w-full items-center justify-center rounded-md bg-green-600 px-2 py-1.5 text-[11px] font-semibold text-white hover:bg-green-700"
                >
                  Placed
                </button>
                {onOpenSubmitToClient && (
                  <button
                    type="button"
                    onClick={onOpenSubmitToClient}
                    className="inline-flex w-full items-center justify-center rounded-md bg-[#7C3AED] px-2 py-1.5 text-[11px] font-semibold text-white hover:bg-[#6D28D9]"
                  >
                    Submit to Client
                  </button>
                )}
                {onAction && !interviewLocked ? (
                  <button
                    type="button"
                    onClick={() => onAction('noShow')}
                    className="inline-flex w-full items-center justify-center rounded-md border border-[#E5E7EB] px-2 py-1.5 text-[11px] font-semibold text-[#111827]"
                  >
                    <span className="inline-flex items-center gap-1"><UserRoundX className="size-3" />Mark No Show</span>
                  </button>
                ) : null}
                {onAction && !interviewLocked ? (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveTab('overview');
                        onAction('edit');
                      }}
                      className="inline-flex w-full items-center justify-center rounded-md border border-[#E5E7EB] px-2 py-1.5 text-[11px] font-semibold text-[#111827]"
                    >
                      <span className="inline-flex items-center gap-1"><Edit2 className="size-3" />Edit Interview</span>
                    </button>
                    <button
                      type="button"
                      onClick={onOpenReject}
                      className="inline-flex w-full items-center justify-center rounded-md border border-red-200 bg-red-50 px-2 py-1.5 text-[11px] font-semibold text-red-700 hover:bg-red-100"
                    >
                      <span className="inline-flex items-center gap-1"><XCircle className="size-3" />Reject Candidate</span>
                    </button>
                    {onOpenCancel ? (
                      <button type="button" onClick={onOpenCancel} className="inline-flex w-full items-center justify-center rounded-md border border-[#E5E7EB] px-2 py-1.5 text-[11px] font-semibold text-[#111827]">
                        <span className="inline-flex items-center gap-1"><XCircle className="size-3" />Cancel Interview</span>
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => onAction('delete')}
                      className="inline-flex w-full items-center justify-center rounded-md border border-red-200 bg-red-50 px-2 py-1.5 text-[11px] font-semibold text-red-700 hover:bg-red-100"
                    >
                      <span className="inline-flex items-center gap-1"><Trash2 className="size-3" />Delete Interview</span>
                    </button>
                  </>
                ) : null}
              </div>
            </div>

            <div className="border-b border-[#E5E7EB] px-4 pt-3">
              <div className="flex overflow-x-auto scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
                <div className="flex min-w-0 shrink-0 gap-2 pb-1">
                  {tabs.map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveTab(tab.id)}
                      className={`shrink-0 rounded-t-xl px-3 py-2 text-sm font-semibold whitespace-nowrap ${
                        activeTab === tab.id
                          ? 'bg-[#EFF6FF] text-[#2563EB]'
                          : 'text-[#6B7280] hover:bg-[#F9FAFB]'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-5">
              {activeTab === 'overview' ? (
                <div className="space-y-5">
                  {interview?.id ? (
                    <>
                      <EntityWorkspaceAlertsPanel
                        entityType="INTERVIEW"
                        entityId={interview.id}
                        entityLabel={
                          [interview.candidate?.name, interview.job?.title].filter(Boolean).join(' — ') ||
                          'Interview'
                        }
                      />
                    </>
                  ) : null}
                  <DrawerOverviewTab interview={interview} />
                </div>
              ) : null}
              {activeTab === 'panel' && onOpenPanelAssignment ? (
                <DrawerPanelTab panel={interview.panel} onOpenPanelAssignment={onOpenPanelAssignment} />
              ) : null}
              {activeTab === 'feedback' && onOpenFeedback ? (
                <DrawerFeedbackTab feedbackEntries={interview.feedbackEntries} onOpenFeedback={onOpenFeedback} />
              ) : null}
              {activeTab === 'client' ? <DrawerClientTab interviewId={interview.id} /> : null}
              {activeTab === 'notes' && onAddNote ? <DrawerNotesTab notes={interview.internalNotes} onAddNote={onAddNote} /> : null}
              {activeTab === 'activity' ? (
                <DrawerActivityLog items={interview.activityLog} audit={interview.auditMeta} />
              ) : null}
              {activeTab === 'files' ? <DrawerFilesTab interviewId={interview.id} /> : null}
              {activeTab === 'chat' ? (
                <DrawerEntityChatTab
                  entityType="INTERVIEW"
                  entityId={interview.id}
                  entityLabel={`${interview.candidate.name} — ${interview.job?.title || 'Interview'}`}
                  isActive={activeTab === 'chat'}
                  isOpen={isOpen}
                />
              ) : null}
            </div>
          </motion.aside>
        </>
      ) : null}
    </AnimatePresence>
  );
}
