import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Plus, X } from 'lucide-react';
import { PanelAssignmentModal } from './PanelAssignmentModal';
import { combineInterviewDateAndTimeToIso } from '../../lib/interview-schedule-helpers';
import type {
  Interview,
  InterviewCandidate,
  InterviewJob,
  InterviewMode,
  InterviewPanelMember,
  InterviewRound,
  InterviewType,
  ScheduleInterviewPayload,
  UpdateInterviewPayload,
} from '../../types/interview.types';

interface ScheduleInterviewModalProps {
  isOpen: boolean;
  candidates: InterviewCandidate[];
  jobs: InterviewJob[];
  interviewers: InterviewPanelMember[];
  onClose: () => void;
  onSchedule: (payload: ScheduleInterviewPayload) => Promise<void>;
  editInterview?: Interview | null;
  onUpdate?: (interviewId: string, payload: UpdateInterviewPayload) => Promise<void>;
}

const rounds: InterviewRound[] = ['Screening', 'Technical', 'HR', 'Managerial', 'Client', 'Final'];
/** Interview type options exposed when the recruiter picks an Online mode. Excludes In-Person. */
const onlineTypes: InterviewType[] = ['Video', 'Phone', 'Technical Test', 'Assessment', 'Group Discussion'];
/** Interview type options exposed when the recruiter picks an Offline mode. Excludes Video / Phone. */
const offlineTypes: InterviewType[] = ['In-Person', 'Technical Test', 'Assessment', 'Group Discussion'];
const platforms = ['Zoom', 'Google Meet', 'MS Teams'] as const;
const durationOptions: Array<{ label: string; value: number }> = [
  { label: '30 mins', value: 30 },
  { label: '45 mins', value: 45 },
  { label: '1 hour', value: 60 },
  { label: '1.5 hours', value: 90 },
  { label: '2 hours', value: 120 },
];
const timezoneOptions = [
  { label: 'IST (GMT+5:30)', value: 'Asia/Kolkata' },
  { label: 'GMT+1:00', value: 'Etc/GMT-1' },
  { label: 'GMT+0:00', value: 'UTC' },
  { label: 'GMT-5:00', value: 'Etc/GMT+5' },
] as const;

/** Build human-friendly slots (9:00 AM, 9:30 AM, ...) so the time field matches the candidates drawer modal. */
function generateTimeSlots(): string[] {
  const slots: string[] = [];
  for (let hour = 9; hour <= 17; hour += 1) {
    for (const minute of [0, 30]) {
      const date = new Date();
      date.setHours(hour, minute, 0, 0);
      slots.push(date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }));
    }
  }
  return slots;
}
const timeSlots = generateTimeSlots();

/** ISO `YYYY-MM-DD` for today, used as `min` on the date picker. */
function todayDate(): string {
  return new Date().toISOString().split('T')[0];
}

export function ScheduleInterviewModal({
  isOpen,
  candidates,
  jobs,
  interviewers,
  onClose,
  onSchedule,
  editInterview = null,
  onUpdate,
}: ScheduleInterviewModalProps) {
  const isEditMode = Boolean(editInterview && onUpdate);
  const [query, setQuery] = useState('');
  const [showPanelModal, setShowPanelModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  /** New schedules start fully empty so the recruiter doesn't think a previous interview leaked through. */
  const buildDefaultForm = (): ScheduleInterviewPayload => ({
    candidateId: '',
    jobId: '',
    clientId: undefined,
    round: '' as InterviewRound,
    type: '' as InterviewType,
    mode: 'Online',
    date: '',
    time: '',
    duration: 60,
    timezone: 'Asia/Kolkata',
    panelIds: [],
    meetingPlatform: 'Zoom',
    panelRoles: {},
    location: '',
    notes: '',
    sendCalendarInvite: true,
    sendEmailNotification: true,
    sendWhatsAppReminder: true,
  });
  const buildEditForm = (interview: Interview): ScheduleInterviewPayload => ({
    candidateId: interview.candidate.id,
    jobId: interview.job.id,
    clientId: interview.job.clientId,
    round: interview.round,
    type: interview.type,
    mode: interview.mode,
    date: interview.date,
    time: interview.time,
    duration: interview.duration,
    timezone: interview.timezone || 'UTC',
    panelIds: interview.panel.map((member) => member.userId || member.id).filter(Boolean),
    meetingPlatform: interview.meetingPlatform || 'Zoom',
    panelRoles: Object.fromEntries(
      interview.panel
        .filter((member) => member.userId)
        .map((member) => [member.userId as string, 'TECHNICAL'])
    ),
    location: interview.location || '',
    notes: interview.notes || '',
    sendCalendarInvite: true,
    sendEmailNotification: true,
    sendWhatsAppReminder: true,
  });
  const [form, setForm] = useState<ScheduleInterviewPayload>(buildDefaultForm());

  React.useEffect(() => {
    if (isOpen) {
      setQuery('');
      setForm(editInterview ? buildEditForm(editInterview) : buildDefaultForm());
    }
  }, [candidates, editInterview, interviewers, isOpen, jobs]);

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
  const selectedTimezoneLabel =
    timezoneOptions.find((timezone) => timezone.value === form.timezone)?.label || form.timezone;

  /** Type options depend on the chosen mode — Online hides In-Person, Offline hides Video / Phone. */
  const typeOptionsForMode = useMemo<InterviewType[]>(
    () => (form.mode === 'Online' ? onlineTypes : offlineTypes),
    [form.mode]
  );

  /** When mode flips, drop the previously selected type if it doesn't apply to the new mode. */
  const handleModeChange = (newMode: InterviewMode) => {
    setForm((current) => {
      const validTypes = newMode === 'Online' ? onlineTypes : offlineTypes;
      const isCurrentTypeValid =
        current.type && (validTypes as InterviewType[]).includes(current.type as InterviewType);
      return {
        ...current,
        mode: newMode,
        type: isCurrentTypeValid ? current.type : ('' as InterviewType),
        meetingPlatform: newMode === 'Online' ? current.meetingPlatform || 'Zoom' : current.meetingPlatform,
        location: newMode === 'Offline' ? current.location || '' : current.location,
      };
    });
  };

  /** Block submission until the recruiter has filled the minimum required fields. */
  const isFormValid = Boolean(
    form.candidateId &&
      form.jobId &&
      form.round &&
      form.type &&
      form.date &&
      form.time &&
      form.mode &&
      form.duration > 0 &&
      form.panelIds.length > 0 &&
      (form.mode === 'Online'
        ? Boolean(form.meetingPlatform)
        : Boolean((form.location || '').trim()))
  );

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
                <h3 className="text-xl font-semibold text-[#111827]">{isEditMode ? 'Edit Interview' : 'Schedule Interview'}</h3>
                <p className="text-sm text-[#6B7280]">
                  {isEditMode ? 'Update the interview details and save the changes.' : 'Create and notify the interview panel in one flow.'}
                </p>
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
                  <option value="" disabled>
                    Select candidate
                  </option>
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
                    onChange={(event) => {
                      const nextJobId = event.target.value;
                      const nextJob = jobs.find((job) => job.id === nextJobId);
                      setForm((current) => ({
                        ...current,
                        jobId: nextJobId,
                        clientId: nextJob?.clientId || current.clientId,
                      }));
                    }}
                    className="w-full rounded-xl border border-[#E5E7EB] px-3 py-2.5 text-sm outline-none focus:border-[#2563EB]"
                  >
                    <option value="" disabled>
                      Select job role
                    </option>
                    {jobs.map((job) => (
                      <option key={job.id} value={job.id}>
                        {job.title}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-[#111827]">Client</label>
                  <input
                    value={selectedJob?.client || ''}
                    readOnly
                    className="w-full rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] px-3 py-2.5 text-sm text-[#374151]"
                  />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-[#111827]">Interview Mode</label>
                <div className="flex gap-2">
                  {(['Online', 'Offline'] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => handleModeChange(mode)}
                      className={`rounded-xl px-4 py-2 text-sm font-semibold ${
                        form.mode === mode ? 'bg-[#2563EB] text-white' : 'border border-[#E5E7EB] text-[#374151]'
                      }`}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-xs text-[#6B7280]">
                  {form.mode === 'Online'
                    ? 'Online interviews use a meeting platform like Zoom, Google Meet, or MS Teams.'
                    : 'Offline interviews are held at a physical location you provide below.'}
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-[#111827]">Interview Round</label>
                  <select
                    value={form.round}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, round: event.target.value as InterviewRound }))
                    }
                    className="w-full rounded-xl border border-[#E5E7EB] px-3 py-2.5 text-sm outline-none focus:border-[#2563EB]"
                  >
                    <option value="" disabled>
                      Select round
                    </option>
                    {rounds.map((round) => (
                      <option key={round} value={round}>
                        {round}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-[#111827]">Interview Type</label>
                  <select
                    value={form.type}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, type: event.target.value as InterviewType }))
                    }
                    className="w-full rounded-xl border border-[#E5E7EB] px-3 py-2.5 text-sm outline-none focus:border-[#2563EB]"
                  >
                    <option value="" disabled>
                      Select type
                    </option>
                    {typeOptionsForMode.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-[#111827]">Date</label>
                  <input
                    type="date"
                    min={todayDate()}
                    value={form.date}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, date: event.target.value }))
                    }
                    className="w-full rounded-xl border border-[#E5E7EB] px-3 py-2.5 text-sm outline-none focus:border-[#2563EB]"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-[#111827]">Start Time</label>
                  <select
                    value={form.time}
                    onChange={(event) => setForm((current) => ({ ...current, time: event.target.value }))}
                    className="w-full rounded-xl border border-[#E5E7EB] px-3 py-2.5 text-sm outline-none focus:border-[#2563EB]"
                  >
                    <option value="" disabled>
                      Select time
                    </option>
                    {timeSlots.map((slot) => (
                      <option key={slot} value={slot}>
                        {slot}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-[#111827]">Duration</label>
                  <select
                    value={form.duration}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, duration: Number(event.target.value) }))
                    }
                    className="w-full rounded-xl border border-[#E5E7EB] px-3 py-2.5 text-sm outline-none focus:border-[#2563EB]"
                  >
                    {durationOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-[#111827]">Timezone</label>
                  <select
                    value={form.timezone}
                    onChange={(event) => setForm((current) => ({ ...current, timezone: event.target.value }))}
                    className="w-full rounded-xl border border-[#E5E7EB] px-3 py-2.5 text-sm outline-none focus:border-[#2563EB]"
                  >
                    {timezoneOptions.map((timezone) => (
                      <option key={timezone.value} value={timezone.value}>
                        {timezone.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="rounded-xl border border-[#DBEAFE] bg-[#EFF6FF] px-4 py-3 text-sm text-[#1D4ED8]">
                Selected timezone: {selectedTimezoneLabel}
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
                  {form.panelIds.length === 0 ? (
                    <p className="text-sm text-[#6B7280]">Add at least one panel member — required to schedule.</p>
                  ) : null}
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

              {!isEditMode ? (
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
              ) : (
                <div className="rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] px-4 py-3 text-sm text-[#6B7280]">
                  Interview notifications are managed during scheduling.
                </div>
              )}
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
                    if (isEditMode && editInterview && onUpdate) {
                      await onUpdate(editInterview.id, {
                        candidateId: form.candidateId,
                        jobId: form.jobId,
                        clientId: form.clientId,
                        round: form.round,
                        type: form.type,
                        mode: form.mode,
                        date: combineInterviewDateAndTimeToIso(form.date, form.time),
                        duration: form.duration,
                        timezone: form.timezone,
                        meetingPlatform: form.mode === 'Online'
                          ? form.meetingPlatform === 'Google Meet'
                            ? 'Google Meet'
                            : form.meetingPlatform === 'MS Teams'
                            ? 'MS Teams'
                            : 'Zoom'
                          : null,
                        location: form.mode === 'Offline' ? form.location || null : null,
                        notes: form.notes || null,
                        panelUserIds: form.panelIds,
                        panelRoles: form.panelRoles,
                      });
                    } else {
                      await onSchedule(form);
                    }
                    onClose();
                  } finally {
                    setIsSubmitting(false);
                  }
                }}
                disabled={isSubmitting || !isFormValid}
                className="rounded-xl bg-[#2563EB] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? (isEditMode ? 'Saving...' : 'Scheduling...') : isEditMode ? 'Save Changes' : 'Schedule Interview'}
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
