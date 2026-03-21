import React, { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Paperclip, RotateCcw, X, XCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { DrawerActivityLog } from './DrawerActivityLog';
import { DrawerFeedbackTab } from './DrawerFeedbackTab';
import { DrawerFilesTab } from './DrawerFilesTab';
import { DrawerNotesTab } from './DrawerNotesTab';
import { DrawerOverviewTab } from './DrawerOverviewTab';
import { DrawerPanelTab } from './DrawerPanelTab';
import type { DrawerTab, Interview } from '../../types/interview.types';
import { getCandidateStageBadgeClasses, getCandidateStageLabel } from '../../utils/candidateStage';

interface InterviewDrawerProps {
  isOpen: boolean;
  interview: Interview | null;
  onClose: () => void;
  onOpenFeedback: () => void;
  onOpenReschedule: () => void;
  onOpenCancel: () => void;
  onOpenUploadRecording: () => void;
  onOpenPanelAssignment: () => void;
  onAddNote: (text: string) => Promise<void>;
}

const tabs: Array<{ id: DrawerTab; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'panel', label: 'Panel' },
  { id: 'feedback', label: 'Feedback' },
  { id: 'notes', label: 'Notes' },
  { id: 'activity', label: 'Activity Log' },
  { id: 'files', label: 'Files' },
];

export function InterviewDrawer({
  isOpen,
  interview,
  onClose,
  onOpenFeedback,
  onOpenReschedule,
  onOpenCancel,
  onOpenUploadRecording,
  onOpenPanelAssignment,
  onAddNote,
}: InterviewDrawerProps) {
  const [activeTab, setActiveTab] = useState<DrawerTab>('overview');
  const router = useRouter();

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
            className="fixed right-0 top-0 z-[100] flex h-full w-full flex-col bg-white shadow-2xl sm:max-w-[520px]"
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

              <div className="mt-4 flex flex-wrap gap-2">
                <button type="button" onClick={onOpenFeedback} className="rounded-xl bg-[#2563EB] px-3 py-2 text-sm font-semibold text-white">
                  Add Feedback
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const candidateId = interview.candidate.id;
                    const jobId = interview.job.id;
                    router.push(`/placement?create=1&candidateId=${encodeURIComponent(candidateId)}&jobId=${encodeURIComponent(jobId)}`);
                    onClose();
                  }}
                  className="rounded-xl bg-green-600 px-3 py-2 text-sm font-semibold text-white hover:bg-green-700"
                >
                  Placed
                </button>
                <button type="button" onClick={onOpenReschedule} className="rounded-xl border border-[#E5E7EB] px-3 py-2 text-sm font-semibold text-[#111827]">
                  <span className="inline-flex items-center gap-2"><RotateCcw className="size-4" />Reschedule</span>
                </button>
                <button type="button" onClick={onOpenCancel} className="rounded-xl border border-[#E5E7EB] px-3 py-2 text-sm font-semibold text-[#111827]">
                  <span className="inline-flex items-center gap-2"><XCircle className="size-4" />Cancel Interview</span>
                </button>
                <button type="button" onClick={onOpenUploadRecording} className="rounded-xl border border-[#E5E7EB] px-3 py-2 text-sm font-semibold text-[#111827]">
                  <span className="inline-flex items-center gap-2"><Paperclip className="size-4" />Upload Recording</span>
                </button>
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
              {activeTab === 'overview' ? <DrawerOverviewTab interview={interview} /> : null}
              {activeTab === 'panel' ? (
                <DrawerPanelTab panel={interview.panel} onOpenPanelAssignment={onOpenPanelAssignment} />
              ) : null}
              {activeTab === 'feedback' ? (
                <DrawerFeedbackTab feedbackEntries={interview.feedbackEntries} onOpenFeedback={onOpenFeedback} />
              ) : null}
              {activeTab === 'notes' ? <DrawerNotesTab notes={interview.internalNotes} onAddNote={onAddNote} /> : null}
              {activeTab === 'activity' ? <DrawerActivityLog items={interview.activityLog} /> : null}
              {activeTab === 'files' ? <DrawerFilesTab interviewId={interview.id} /> : null}
            </div>
          </motion.aside>
        </>
      ) : null}
    </AnimatePresence>
  );
}
