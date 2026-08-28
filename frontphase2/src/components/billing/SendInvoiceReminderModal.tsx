'use client';

/**
 * Payment reminder composer for an unpaid invoice.
 *
 * "Now" emails the client billing contact immediately; "Schedule" stores the
 * chosen date/time in the selected timezone and the backend scheduler sends it
 * when that moment arrives. Every reminder lands in the invoice activity
 * timeline either way.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Bell, CalendarClock, Send, X, Trash2 } from 'lucide-react';
import {
  apiCancelInvoiceReminder,
  apiSendInvoiceReminder,
  type InvoicePaymentReminder,
} from '../../lib/api';
import { ClientTimezoneSelect } from '../clients/ClientTimezoneSelect';
import { formatDateTimeDMY } from '../../utils/dateDisplay';

type Mode = 'now' | 'schedule';

interface Props {
  open: boolean;
  invoiceId: string | null;
  invoiceNumber?: string | null;
  outstandingLabel?: string;
  dueDateLabel?: string | null;
  clientName?: string | null;
  defaultEmail?: string;
  reminders?: InvoicePaymentReminder[];
  onClose: () => void;
  /** Called after a reminder is sent, scheduled or cancelled. */
  onSaved?: () => void;
}

function browserTimezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata';
  } catch {
    return 'Asia/Kolkata';
  }
}

function todayInputValue() {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

const STATUS_STYLES: Record<InvoicePaymentReminder['status'], string> = {
  PENDING: 'bg-amber-50 text-amber-700 ring-amber-200',
  SENT: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  FAILED: 'bg-rose-50 text-rose-700 ring-rose-200',
  CANCELLED: 'bg-slate-100 text-slate-500 ring-slate-200',
};

export default function SendInvoiceReminderModal({
  open,
  invoiceId,
  invoiceNumber,
  outstandingLabel,
  dueDateLabel,
  clientName,
  defaultEmail,
  reminders = [],
  onClose,
  onSaved,
}: Props) {
  const [mode, setMode] = useState<Mode>('now');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('10:00');
  const [timezone, setTimezone] = useState('');
  const [email, setEmail] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [flash, setFlash] = useState('');

  useEffect(() => {
    if (!open) return;
    setMode('now');
    setDate(todayInputValue());
    setTime('10:00');
    setTimezone(browserTimezone());
    setEmail(defaultEmail || '');
    setNote('');
    setError('');
    setFlash('');
  }, [open, defaultEmail]);

  const pendingReminders = useMemo(
    () => reminders.filter((item) => item.status === 'PENDING'),
    [reminders],
  );

  const scheduleValid = Boolean(date && time && timezone);

  const handleSubmit = async () => {
    if (!invoiceId) return;
    if (mode === 'schedule' && !scheduleValid) {
      setError('Pick a date, time and timezone for the scheduled reminder.');
      return;
    }
    setSubmitting(true);
    setError('');
    setFlash('');
    try {
      const res = await apiSendInvoiceReminder(invoiceId, {
        mode,
        ...(mode === 'schedule'
          ? { scheduledDate: date, scheduledTime: time, timezone }
          : {}),
        ...(email.trim() ? { toEmail: email.trim() } : {}),
        ...(note.trim() ? { note: note.trim() } : {}),
      });
      const reminder = res.data?.reminder;
      setFlash(
        mode === 'now'
          ? `Reminder emailed to ${reminder?.toEmail || email || 'the client'}.`
          : `Reminder scheduled for ${date} ${time} (${timezone}).`,
      );
      onSaved?.();
      if (mode === 'now') {
        setTimeout(() => onClose(), 900);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to send payment reminder');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelReminder = async (reminderId: string) => {
    if (!invoiceId) return;
    setCancellingId(reminderId);
    setError('');
    try {
      await apiCancelInvoiceReminder(invoiceId, reminderId);
      setFlash('Scheduled reminder cancelled.');
      onSaved?.();
    } catch (err: any) {
      setError(err?.message || 'Failed to cancel reminder');
    } finally {
      setCancellingId(null);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-label="Send payment reminder"
        className="relative z-10 flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
      >
        <header className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-amber-600">
              <Bell size={12} /> Payment reminder
            </p>
            <h2 className="mt-1 truncate text-lg font-bold text-slate-900">
              {invoiceNumber || 'Invoice'}
            </h2>
            <p className="mt-0.5 text-[12px] text-slate-500">
              {outstandingLabel ? `${outstandingLabel} outstanding` : 'Outstanding payment'}
              {dueDateLabel && dueDateLabel !== '-' ? ` · due ${dueDateLabel}` : ''}
              {clientName ? ` · ${clientName}` : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {error ? (
            <div className="mb-3 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-[13px] text-rose-700">
              <AlertCircle size={15} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          ) : null}
          {flash ? (
            <div className="mb-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-[13px] font-medium text-emerald-700">
              {flash}
            </div>
          ) : null}

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setMode('now')}
              className={`flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2.5 text-sm font-bold transition ${
                mode === 'now'
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Send size={14} /> Now
            </button>
            <button
              type="button"
              onClick={() => setMode('schedule')}
              className={`flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2.5 text-sm font-bold transition ${
                mode === 'schedule'
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              <CalendarClock size={14} /> Schedule
            </button>
          </div>

          <p className="mt-2 text-[11px] text-slate-500">
            {mode === 'now'
              ? 'The reminder is emailed to the client immediately, stating the outstanding amount and payment due date.'
              : 'The reminder is queued and emailed automatically at the date and time you choose, in the selected timezone.'}
          </p>

          {mode === 'schedule' ? (
            <div className="mt-4 grid gap-3">
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Date
                  </span>
                  <input
                    type="date"
                    value={date}
                    min={todayInputValue()}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Time
                  </span>
                  <input
                    type="time"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </label>
              </div>
              <label className="block">
                <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Timezone
                </span>
                <ClientTimezoneSelect value={timezone} onChange={setTimezone} valueAsIana />
              </label>
            </div>
          ) : null}

          <label className="mt-4 block">
            <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Send to
            </span>
            <input
              type="email"
              value={email}
              placeholder="Client billing email (auto-detected if left blank)"
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </label>

          <label className="mt-3 block">
            <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Message (optional)
            </span>
            <textarea
              value={note}
              rows={3}
              placeholder="Add a short note for the client…"
              onChange={(e) => setNote(e.target.value)}
              className="w-full resize-none rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </label>

          {reminders.length > 0 ? (
            <div className="mt-5">
              <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                Reminder history ({pendingReminders.length} scheduled)
              </p>
              <ul className="space-y-2">
                {reminders.map((reminder) => (
                  <li
                    key={reminder.id}
                    className="flex items-start justify-between gap-2 rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ${STATUS_STYLES[reminder.status]}`}
                        >
                          {reminder.status}
                        </span>
                        <span className="text-[12px] font-semibold text-slate-700">
                          {formatDateTimeDMY(new Date(reminder.sentAt || reminder.scheduledAt))}
                        </span>
                      </div>
                      <p className="mt-0.5 truncate text-[11px] text-slate-500">
                        {reminder.toEmail}
                        {reminder.timezone ? ` · ${reminder.timezone}` : ''}
                      </p>
                      {reminder.error ? (
                        <p className="mt-0.5 text-[11px] text-rose-600">{reminder.error}</p>
                      ) : null}
                    </div>
                    {reminder.status === 'PENDING' ? (
                      <button
                        type="button"
                        onClick={() => void handleCancelReminder(reminder.id)}
                        disabled={cancellingId === reminder.id}
                        className="shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
                        aria-label="Cancel scheduled reminder"
                      >
                        <Trash2 size={14} />
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        <footer className="flex items-center justify-end gap-2 border-t border-slate-100 px-5 py-3.5">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
          >
            Close
          </button>
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={submitting || (mode === 'schedule' && !scheduleValid)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-amber-600 px-4 py-2 text-sm font-bold text-white hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {mode === 'now' ? <Send size={14} /> : <CalendarClock size={14} />}
            {submitting
              ? mode === 'now'
                ? 'Sending…'
                : 'Scheduling…'
              : mode === 'now'
                ? 'Send now'
                : 'Schedule reminder'}
          </button>
        </footer>
      </div>
    </div>
  );
}
