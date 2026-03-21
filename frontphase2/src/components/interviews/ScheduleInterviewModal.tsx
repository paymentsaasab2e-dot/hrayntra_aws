import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Plus, X } from 'lucide-react';
import { PanelAssignmentModal } from './PanelAssignmentModal';
import type { InterviewCandidate, InterviewJob, InterviewPanelMember, InterviewRound, InterviewType, ScheduleInterviewPayload } from '../../types/interview.types';

interface ScheduleInterviewModalProps {
  isOpen: boolean;
  candidates: InterviewCandidate[];
  jobs: InterviewJob[];
  interviewers: InterviewPanelMember[];
  onClose: () => void;
  onSchedule: (payload: ScheduleInterviewPayload) => Promise<void>;
}

const rounds: InterviewRound[] = ['Screening', 'Technical', 'HR', 'Managerial', 'Client', 'Final'];
const types: InterviewType[] = ['Video', 'Phone', 'In-Person', 'Technical Test', 'Assessment', 'Group Discussion'];
const platforms = ['Zoom', 'Google Meet', 'MS Teams'] as const;
const timezones = ['GMT+5:30', 'GMT+1:00', 'GMT+0:00', 'GMT-5:00'];

export function ScheduleInterviewModal({
  isOpen,
  candidates,
  jobs,
  interviewers,
  onClose,
  onSchedule,
}: ScheduleInterviewModalProps) {
  const [query, setQuery] = useState('');
  const [showPanelModal, setShowPanelModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState<ScheduleInterviewPayload>({
    candidateId: candidates[0]?.id || '',
    jobId: jobs[0]?.id || '',
    clientId: undefined,
    round: 'Screening',
    type: 'Video',
    mode: 'Online',
    date: 'Feb 20, 2026',
    time: '10:00 AM',
    duration: 60,
    timezone: 'GMT+5:30',
    panelIds: interviewers.slice(0, 2).map((item) => item.id),
    meetingPlatform: 'Zoom',
    panelRoles: {},
    location: '',
    notes: '',
    sendCalendarInvite: true,
    sendEmailNotification: true,
    sendWhatsAppReminder: true,
  });

  React.useEffect(() => {
    if (isOpen && candidates[0]) {
      setQuery('');
      setForm((current) => ({
        ...current,
        candidateId: candidates[0].id,
        jobId: jobs[0]?.id || current.jobId,
        clientId: undefined,
        panelIds: interviewers.slice(0, 2).map((item) => item.id),
      }));
    }
  }, [candidates, interviewers, isOpen, jobs]);

  const filteredCandidates = useMemo(
    () =>
      candidates.filter(
        (candidate) =>
          candidate.name.toLowerCase().includes(query.toLowerCase()) ||
          candidate.email.toLowerCase().includes(query.toLowerCase())
      ),
    [candidates, query]
  );

  const selectedCandidate = candidates.find((candidate) => candidate.id === form.candidateId);
  const selectedJob = jobs.find((job) => job.id === form.jobId);

  React.useEffect(() => {
    if (selectedJob?.clientId) {
      setForm((current) => ({ ...current, clientId: selectedJob.clientId }));
    }
  }, [selectedJob?.clientId]);

  return (
    <AnimatePresence>
      {isOpen ? (
        <>
          <div className="fixed inset-0 z-[110] bg-slate-900/50" onClick={onClose} />
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'tween', duration: 0.25 }}
            className="fixed right-0 top-0 z-[120] flex h-full w-full flex-col bg-white shadow-2xl sm:max-w-[600px]"
          >
            <div className="flex items-center justify-between border-b border-[#E5E7EB] px-6 py-4">
              <div>
                <h3 className="text-xl font-semibold text-[#111827]">Schedule Interview</h3>
                <p className="text-sm text-[#6B7280]">Create and notify the interview panel in one flow.</p>
              </div>
              <button type="button" onClick={onClose} className="rounded-lg p-2 text-[#6B7280] hover:bg-[#F3F4F6]">
                <X className="size-5" />
              </button>
            </div>

            <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
              <div>
                <label className="mb-2 block text-sm font-semibold text-[#111827]">Candidate</label>
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search by candidate name or email"
                  className="mb-2 w-full rounded-xl border border-[#E5E7EB] px-3 py-2.5 text-sm outline-none focus:border-[#2563EB]"
                />
                <select
                  value={form.candidateId}
                  onChange={(event) => {
                    const candidate = candidates.find((item) => item.id === event.target.value);
                    if (!candidate) return;
                    setForm((current) => ({ ...current, candidateId: candidate.id }));
                  }}
                  className="w-full rounded-xl border border-[#E5E7EB] px-3 py-2.5 text-sm outline-none focus:border-[#2563EB]"
                >
                  {filteredCandidates.map((candidate) => (
                    <option key={candidate.id} value={candidate.id}>
                      {candidate.name} • {candidate.email}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-[#111827]">Job Role</label>
                  <select
                    value={form.jobId}
                    onChange={(event) => setForm((current) => ({ ...current, jobId: event.target.value }))}
                    className="w-full rounded-xl border border-[#E5E7EB] px-3 py-2.5 text-sm outline-none focus:border-[#2563EB]"
                  >
                    {jobs.map((job) => (
                      <option key={job.id} value={job.id}>
                        {job.title}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-[#111827]">Client</label>
                  <input value={selectedJob?.client || ''} readOnly className="w-full rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] px-3 py-2.5 text-sm text-[#374151]" />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-[#111827]">Interview Round</label>
                  <select value={form.round} onChange={(event) => setForm((current) => ({ ...current, round: event.target.value as InterviewRound }))} className="w-full rounded-xl border border-[#E5E7EB] px-3 py-2.5 text-sm outline-none focus:border-[#2563EB]">
                    {rounds.map((round) => <option key={round}>{round}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-[#111827]">Interview Type</label>
                  <select value={form.type} onChange={(event) => setForm((current) => ({ ...current, type: event.target.value as InterviewType }))} className="w-full rounded-xl border border-[#E5E7EB] px-3 py-2.5 text-sm outline-none focus:border-[#2563EB]">
                    {types.map((type) => <option key={type}>{type}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-[#111827]">Interview Mode</label>
                <div className="flex gap-2">
                  {(['Online', 'Offline'] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setForm((current) => ({ ...current, mode }))}
                      className={`rounded-xl px-4 py-2 text-sm font-semibold ${
                        form.mode === mode ? 'bg-[#2563EB] text-white' : 'border border-[#E5E7EB] text-[#374151]'
                      }`}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-[#111827]">Date</label>
                  <input value={form.date} onChange={(event) => setForm((current) => ({ ...current, date: event.target.value }))} className="w-full rounded-xl border border-[#E5E7EB] px-3 py-2.5 text-sm outline-none focus:border-[#2563EB]" />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-[#111827]">Start Time</label>
                  <input value={form.time} onChange={(event) => setForm((current) => ({ ...current, time: event.target.value }))} className="w-full rounded-xl border border-[#E5E7EB] px-3 py-2.5 text-sm outline-none focus:border-[#2563EB]" />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-[#111827]">Duration (minutes)</label>
                  <input type="number" value={form.duration} onChange={(event) => setForm((current) => ({ ...current, duration: Number(event.target.value) }))} className="w-full rounded-xl border border-[#E5E7EB] px-3 py-2.5 text-sm outline-none focus:border-[#2563EB]" />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-[#111827]">Timezone</label>
                  <select value={form.timezone} onChange={(event) => setForm((current) => ({ ...current, timezone: event.target.value }))} className="w-full rounded-xl border border-[#E5E7EB] px-3 py-2.5 text-sm outline-none focus:border-[#2563EB]">
                    {timezones.map((timezone) => <option key={timezone}>{timezone}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label className="text-sm font-semibold text-[#111827]">Interview Panel</label>
                  <button type="button" onClick={() => setShowPanelModal(true)} className="inline-flex items-center gap-1 text-sm font-semibold text-[#2563EB]">
                    <Plus className="size-4" />
                    Add Panel Members
                  </button>
                </div>
                <div className="flex flex-wrap gap-2 rounded-xl border border-[#E5E7EB] p-3">
                  {interviewers
                    .filter((item) => form.panelIds.includes(item.id))
                    .map((item) => (
                      <span key={item.id} className="rounded-full bg-[#EFF6FF] px-3 py-1 text-sm font-semibold text-[#2563EB]">
                        {item.name} • {item.role}
                      </span>
                    ))}
                </div>
              </div>

              {form.mode === 'Online' ? (
                <div className="grid gap-4">
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-[#111827]">Meeting Platform</label>
                    <select value={form.meetingPlatform} onChange={(event) => setForm((current) => ({ ...current, meetingPlatform: event.target.value as ScheduleInterviewPayload['meetingPlatform'] }))} className="w-full rounded-xl border border-[#E5E7EB] px-3 py-2.5 text-sm outline-none focus:border-[#2563EB]">
                      {platforms.map((platform) => <option key={platform}>{platform}</option>)}
                    </select>
                  </div>
                  <div className="rounded-xl border border-[#DBEAFE] bg-[#EFF6FF] px-4 py-3 text-sm text-[#1D4ED8]">
                    Meeting link will be generated automatically after scheduling.
                  </div>
                </div>
              ) : (
                <div>
                  <label className="mb-2 block text-sm font-semibold text-[#111827]">Location</label>
                  <input value={form.location} onChange={(event) => setForm((current) => ({ ...current, location: event.target.value }))} className="w-full rounded-xl border border-[#E5E7EB] px-3 py-2.5 text-sm outline-none focus:border-[#2563EB]" />
                </div>
              )}

              <div>
                <label className="mb-2 block text-sm font-semibold text-[#111827]">Notes</label>
                <textarea value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} rows={4} className="w-full rounded-xl border border-[#E5E7EB] px-3 py-2.5 text-sm outline-none focus:border-[#2563EB]" />
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  ['sendCalendarInvite', 'Send Calendar Invite'],
                  ['sendEmailNotification', 'Send Email Notification'],
                  ['sendWhatsAppReminder', 'Send WhatsApp Reminder'],
                ].map(([key, label]) => (
                  <label key={key} className="flex items-center gap-2 rounded-xl border border-[#E5E7EB] px-3 py-2 text-sm text-[#374151]">
                    <input
                      type="checkbox"
                      checked={form[key as keyof ScheduleInterviewPayload] as boolean}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          [key]: event.target.checked,
                        }))
                      }
                      className="size-4 rounded border-[#D1D5DB] text-[#2563EB]"
                    />
                    {label}
                  </label>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-[#E5E7EB] bg-white px-6 py-4">
              <button type="button" onClick={onClose} className="rounded-xl border border-[#E5E7EB] px-4 py-2 text-sm font-semibold text-[#111827]">
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  setIsSubmitting(true);
                  try {
                    await onSchedule(form);
                    onClose();
                  } finally {
                    setIsSubmitting(false);
                  }
                }}
                disabled={isSubmitting}
                className="rounded-xl bg-[#2563EB] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? 'Scheduling...' : 'Schedule Interview'}
              </button>
            </div>
          </motion.div>

          <PanelAssignmentModal
            isOpen={showPanelModal}
            interviewers={interviewers}
            initialSelectedIds={form.panelIds}
            onClose={() => setShowPanelModal(false)}
            onSave={(panelIds) => {
              setForm((current) => ({ ...current, panelIds }));
              setShowPanelModal(false);
            }}
          />
        </>
      ) : null}
    </AnimatePresence>
  );
}
