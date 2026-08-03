'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { CalendarClock, CalendarPlus, Check, Loader2, X } from 'lucide-react';
import { ScheduleMeetingForm } from '../ScheduleMeetingForm';
import { FollowUpDateTimeField } from '../FollowUpDateTimeField';
import {
  FOLLOW_UP_POSTPONE_PRESETS,
  buildFollowUpStatusRemark,
  computePostponedFollowUpIso,
} from '../LeadFollowUpScheduler';
import { formatFollowUpDisplay } from '../../utils/formatLeadDateTime';
import { formatDateTimeDMY } from '../../utils/dateDisplay';
import {
  apiCompleteLeadFollowUp,
  apiGetLeadActivities,
  apiUpdateLead,
  type BackendActivity,
} from '../../lib/api';
import { requestError, requestWarning } from '../../lib/appDialog';

const FOLLOW_UP_SCHEDULE_LABEL = '__followUpSchedule';

type FollowUpHistoryItem = {
  id: string;
  title: string;
  description: string;
  createdAt: string;
  status: 'scheduled' | 'completed';
};

type FollowUpScheduleInfo = {
  type?: string | null;
  notes?: string | null;
  meetLink?: string | null;
  contact?: string | null;
  postponed?: boolean | null;
  postponeReason?: string | null;
};

function isCompletedActivity(activity: BackendActivity): boolean {
  const action = `${activity.action || ''}`.toLowerCase();
  const status = String((activity.metadata as any)?.status || '').toLowerCase();
  return action.includes('completed') || status === 'completed';
}

function readFollowUpSchedule(
  otherDetails?: Array<{ label: string; value: string }> | null,
): FollowUpScheduleInfo | null {
  if (!Array.isArray(otherDetails)) return null;
  const row = otherDetails.find((item) => item && item.label === FOLLOW_UP_SCHEDULE_LABEL);
  if (!row?.value) return null;
  try {
    const parsed = typeof row.value === 'string' ? JSON.parse(row.value) : row.value;
    if (!parsed || typeof parsed !== 'object') return null;
    return {
      type: parsed.type || parsed.followUpType || null,
      notes: parsed.notes || parsed.followUpNotes || null,
      meetLink: parsed.meetLink || parsed.followUpMeetLink || null,
      contact: parsed.contact || parsed.followUpContact || null,
      postponed: Boolean(parsed.postponed || parsed.followUpPostponed),
      postponeReason: parsed.postponeReason || parsed.followUpPostponeReason || null,
    };
  } catch {
    return null;
  }
}

export function LeadFollowUpTabPanel({
  leadId,
  nextFollowUp,
  lastFollowUp,
  otherDetails,
  onScheduled,
  onCompleted,
}: {
  leadId: string;
  nextFollowUp?: string | null;
  lastFollowUp?: string | null;
  otherDetails?: Array<{ label: string; value: string }> | null;
  onScheduled?: () => void;
  onCompleted?: () => void;
}) {
  const [completedMeets, setCompletedMeets] = useState<FollowUpHistoryItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyKey, setHistoryKey] = useState(0);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [completeOpen, setCompleteOpen] = useState(false);
  const [postponeOpen, setPostponeOpen] = useState(false);
  const [remark, setRemark] = useState('');
  const [completing, setCompleting] = useState(false);
  const [postponing, setPostponing] = useState(false);
  const [postponeDate, setPostponeDate] = useState('');
  const [postponeReason, setPostponeReason] = useState('');
  const [postponePreset, setPostponePreset] = useState('1d');

  const scheduleInfo = useMemo(() => readFollowUpSchedule(otherDetails), [otherDetails]);
  const scheduledType = String(scheduleInfo?.type || 'Meet').trim() || 'Meet';
  const hasScheduledMeet = Boolean(nextFollowUp);
  const isPostponed = Boolean(scheduleInfo?.postponed);

  useEffect(() => {
    if (!leadId) return;
    let cancelled = false;
    const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
    if (!token) {
      setCompletedMeets([]);
      return;
    }

    setLoadingHistory(true);
    void apiGetLeadActivities(leadId)
      .then((response) => {
        if (cancelled) return;
        const all = Array.isArray(response.data) ? response.data : [];

        const completed: FollowUpHistoryItem[] = [];

        for (const activity of all) {
          if (isCompletedActivity(activity)) {
            const remarkText = String((activity.metadata as any)?.remark || '').trim();
            const typeLabel = String((activity.metadata as any)?.type || 'Meet').trim();
            completed.push({
              id: activity.id,
              title: `${typeLabel} Completed`,
              description: remarkText,
              createdAt: activity.createdAt,
              status: 'completed',
            });
          }
        }

        setCompletedMeets(completed);
      })
      .catch(() => {
        if (!cancelled) setCompletedMeets([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingHistory(false);
      });

    return () => {
      cancelled = true;
    };
  }, [leadId, historyKey]);

  const handleSuccess = () => {
    setScheduleOpen(false);
    setHistoryKey((k) => k + 1);
    onScheduled?.();
  };

  const openCompleteModal = () => {
    setRemark('');
    setCompleteOpen(true);
  };

  const closeCompleteModal = () => {
    if (completing) return;
    setCompleteOpen(false);
    setRemark('');
  };

  const openPostponeModal = () => {
    setPostponePreset('1d');
    setPostponeDate(computePostponedFollowUpIso(1, nextFollowUp));
    setPostponeReason('');
    setPostponeOpen(true);
  };

  const closePostponeModal = () => {
    if (postponing) return;
    setPostponeOpen(false);
    setPostponeReason('');
  };

  const handleCompleteMeet = async () => {
    const trimmed = remark.trim();
    if (!trimmed) {
      void requestWarning('Please add a remark before marking the meet as done.');
      return;
    }
    setCompleting(true);
    try {
      await apiCompleteLeadFollowUp(leadId, { remark: trimmed });
      setCompleteOpen(false);
      setRemark('');
      setHistoryKey((k) => k + 1);
      onCompleted?.();
    } catch (error: any) {
      void requestError(error?.message || 'Failed to mark meet as done');
    } finally {
      setCompleting(false);
    }
  };

  const handlePostponeFollowUp = async () => {
    const iso = String(postponeDate || '').trim();
    if (!iso) {
      void requestWarning('Please choose a postponed date and time.');
      return;
    }
    const when = new Date(iso);
    if (Number.isNaN(when.getTime()) || when.getTime() <= Date.now()) {
      void requestWarning('Postponed follow-up must be in the future.');
      return;
    }

    setPostponing(true);
    try {
      const fields = {
        nextFollowUp: iso,
        followUpType: scheduledType,
        followUpContact: scheduleInfo?.contact || undefined,
        followUpMeetLink: scheduleInfo?.meetLink || undefined,
        followUpNotes: scheduleInfo?.notes || undefined,
        followUpPostponed: true,
        followUpPostponeReason: postponeReason.trim(),
      };
      await apiUpdateLead(leadId, {
        nextFollowUp: iso,
        statusRemark: buildFollowUpStatusRemark(fields),
        followUpSchedule: {
          type: scheduledType,
          contact: scheduleInfo?.contact || undefined,
          meetLink: scheduleInfo?.meetLink || undefined,
          notes: [
            'Postponed',
            postponeReason.trim() ? `Postpone reason: ${postponeReason.trim()}` : null,
            scheduleInfo?.notes || null,
          ]
            .filter(Boolean)
            .join('. '),
          postponed: true,
          postponeReason: postponeReason.trim() || undefined,
        },
      });
      setPostponeOpen(false);
      setPostponeReason('');
      setHistoryKey((k) => k + 1);
      onScheduled?.();
    } catch (error: any) {
      void requestError(error?.message || 'Failed to postpone follow-up');
    } finally {
      setPostponing(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setScheduleOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-700"
        >
          <CalendarPlus className="h-3.5 w-3.5" />
          Schedule
        </button>
      </div>

      <section>
        <div className="mb-3">
          <h3 className="text-sm font-bold text-slate-900">Scheduled follow-ups</h3>
        </div>

        {hasScheduledMeet ? (
          <div
            className={`mb-3 rounded-xl border p-4 shadow-sm ${
              isPostponed ? 'border-amber-200 bg-amber-50/40' : 'border-sky-200 bg-sky-50/40'
            }`}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-sky-700 ring-1 ring-sky-200">
                    {scheduledType}
                  </span>
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ${
                      isPostponed
                        ? 'bg-amber-100 text-amber-800 ring-amber-200'
                        : 'bg-amber-50 text-amber-700 ring-amber-200'
                    }`}
                  >
                    {isPostponed ? 'Postponed' : 'Upcoming'}
                  </span>
                </div>
                <p className="mt-2 text-sm font-semibold text-slate-900">
                  {formatFollowUpDisplay(nextFollowUp)}
                </p>
                {scheduleInfo?.postponeReason ? (
                  <p className="mt-1.5 text-sm leading-relaxed text-amber-800">
                    Reason: {scheduleInfo.postponeReason}
                  </p>
                ) : null}
                {scheduleInfo?.notes ? (
                  <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{scheduleInfo.notes}</p>
                ) : null}
                {scheduleInfo?.meetLink ? (
                  <p className="mt-1 text-xs text-slate-500">
                    {'Meet link: '}
                    <a
                      href={scheduleInfo.meetLink}
                      target="_blank"
                      rel="noreferrer"
                      className="font-medium text-sky-700 underline-offset-2 hover:underline"
                    >
                      {scheduleInfo.meetLink}
                    </a>
                  </p>
                ) : null}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={openPostponeModal}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-amber-300 bg-white px-3.5 py-2 text-xs font-semibold text-amber-800 shadow-sm transition hover:bg-amber-50"
                >
                  <CalendarClock className="h-3.5 w-3.5" />
                  Postpone
                </button>
                <button
                  type="button"
                  onClick={openCompleteModal}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-700"
                >
                  <Check className="h-3.5 w-3.5" />
                  Complete follow-up
                </button>
              </div>
            </div>
          </div>
        ) : (
          <p className="rounded-xl border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-500">
            No follow-ups scheduled yet. Click Schedule above.
          </p>
        )}
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className="text-sm font-bold text-slate-900">Completed follow-ups</h3>
          {loadingHistory ? <Loader2 className="h-4 w-4 animate-spin text-sky-600" /> : null}
        </div>
        {loadingHistory && completedMeets.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-500">
            Loading...
          </p>
        ) : completedMeets.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-500">
            No completed follow-ups yet.
          </p>
        ) : (
          <div className="space-y-2">
            {completedMeets.map((item) => (
              <div
                key={item.id}
                className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4 shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                    <span className="inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700 ring-1 ring-emerald-200">
                      Done
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">{formatDateTimeDMY(item.createdAt)}</p>
                </div>
                {item.description ? (
                  <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{item.description}</p>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </section>

      {scheduleOpen && typeof document !== 'undefined'
        ? createPortal(
            <div className="fixed inset-0 z-[1200] flex items-center justify-center p-4">
              <button
                type="button"
                className="absolute inset-0 bg-slate-900/45 backdrop-blur-[1px]"
                aria-label="Close"
                onClick={() => setScheduleOpen(false)}
              />
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="schedule-followup-title"
                className="relative z-10 w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
              >
                <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
                  <div>
                    <h2 id="schedule-followup-title" className="text-base font-bold text-slate-900">
                      Schedule a follow-up
                    </h2>
                    <p className="mt-0.5 text-xs text-slate-500">Pick a type, date and time.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setScheduleOpen(false)}
                    className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                    aria-label="Close dialog"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="max-h-[70vh] overflow-y-auto px-5 py-4">
                  <ScheduleMeetingForm
                    entityType="lead"
                    entityId={leadId}
                    title=""
                    embedded
                    onSuccess={handleSuccess}
                    onCancel={() => setScheduleOpen(false)}
                  />
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}

      {postponeOpen && typeof document !== 'undefined'
        ? createPortal(
            <div className="fixed inset-0 z-[1200] flex items-center justify-center p-4">
              <button
                type="button"
                className="absolute inset-0 bg-slate-900/45 backdrop-blur-[1px]"
                aria-label="Close"
                onClick={closePostponeModal}
              />
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="postpone-followup-title"
                className="relative z-10 w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
              >
                <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
                  <div>
                    <h2 id="postpone-followup-title" className="text-base font-bold text-slate-900">
                      Postpone follow-up
                    </h2>
                    <p className="mt-0.5 text-xs text-slate-500">
                      Move this follow-up to a later date and add a reason.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={closePostponeModal}
                    disabled={postponing}
                    className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
                    aria-label="Close dialog"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="space-y-3 px-5 py-4">
                  <div className="flex flex-wrap gap-1.5">
                    {FOLLOW_UP_POSTPONE_PRESETS.map((preset) => {
                      const selected = postponePreset === preset.id;
                      return (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => {
                            setPostponePreset(preset.id);
                            setPostponeDate(computePostponedFollowUpIso(preset.days, nextFollowUp));
                          }}
                          className={`rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold transition ${
                            selected
                              ? 'border-amber-500 bg-amber-100 text-amber-900 shadow-sm'
                              : 'border-slate-200 bg-white text-slate-600 hover:border-amber-300'
                          }`}
                        >
                          {preset.label}
                        </button>
                      );
                    })}
                  </div>
                  <FollowUpDateTimeField
                    value={postponeDate}
                    onChange={(iso) => {
                      setPostponePreset('custom');
                      setPostponeDate(iso);
                    }}
                    showFollowUpTypes={false}
                    label="New date & time"
                  />
                  <div>
                    <label
                      htmlFor="postpone-followup-reason"
                      className="mb-1.5 block text-sm font-medium text-slate-800"
                    >
                      Reason
                    </label>
                    <textarea
                      id="postpone-followup-reason"
                      value={postponeReason}
                      onChange={(e) => setPostponeReason(e.target.value)}
                      rows={3}
                      placeholder="Why is this follow-up being postponed?"
                      className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-4">
                  <button
                    type="button"
                    onClick={closePostponeModal}
                    disabled={postponing}
                    className="rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => void handlePostponeFollowUp()}
                    disabled={postponing}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-amber-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-amber-700 disabled:opacity-50"
                  >
                    {postponing ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <CalendarClock className="h-3.5 w-3.5" />
                    )}
                    Save postpone
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}

      {completeOpen && typeof document !== 'undefined'
        ? createPortal(
            <div className="fixed inset-0 z-[1200] flex items-center justify-center p-4">
              <button
                type="button"
                className="absolute inset-0 bg-slate-900/45 backdrop-blur-[1px]"
                aria-label="Close"
                onClick={closeCompleteModal}
              />
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="complete-meet-title"
                className="relative z-10 w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
              >
                <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
                  <div>
                    <h2 id="complete-meet-title" className="text-base font-bold text-slate-900">
                      Complete a meet
                    </h2>
                    <p className="mt-0.5 text-xs text-slate-500">
                      Add a remark, then mark this scheduled meet as done.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={closeCompleteModal}
                    disabled={completing}
                    className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
                    aria-label="Close dialog"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="space-y-3 px-5 py-4">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                    <p className="text-[0.7rem] font-bold uppercase tracking-wider text-slate-500">
                      Scheduled
                    </p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">
                      {scheduledType} &middot; {formatFollowUpDisplay(nextFollowUp)}
                    </p>
                  </div>
                  <div>
                    <label
                      htmlFor="complete-meet-remark"
                      className="mb-1.5 block text-sm font-medium text-slate-800"
                    >
                      Remark <span className="text-rose-500">*</span>
                    </label>
                    <textarea
                      id="complete-meet-remark"
                      value={remark}
                      onChange={(e) => setRemark(e.target.value)}
                      rows={3}
                      placeholder="What was discussed / outcome?"
                      className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-4">
                  <button
                    type="button"
                    onClick={closeCompleteModal}
                    disabled={completing}
                    className="rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleCompleteMeet()}
                    disabled={completing}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
                  >
                    {completing ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Check className="h-3.5 w-3.5" />
                    )}
                    Mark done
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
