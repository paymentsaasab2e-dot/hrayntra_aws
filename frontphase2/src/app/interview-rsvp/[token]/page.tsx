'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { CalendarClock, CheckCircle2, Loader2, XCircle } from 'lucide-react';

function apiRoot() {
  const raw =
    process.env.NEXT_PUBLIC_API_URL?.trim() ||
    (typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
      ? 'http://localhost:5001/api/v1'
      : 'https://api2.hryantra.com/api/v1');
  return raw.replace(/\/$/, '');
}

function formatWhen(iso, timezone) {
  if (!iso) return '—';
  try {
    return new Intl.DateTimeFormat('en-US', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: timezone || 'Asia/Kolkata',
      timeZoneName: 'short',
    }).format(new Date(iso));
  } catch {
    return String(iso);
  }
}

export default function InterviewRsvpPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const token = decodeURIComponent(String(params?.token || '').trim());
  const action = String(searchParams.get('action') || 'view').toLowerCase();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState<{ kind: string; message: string } | null>(null);
  const [interview, setInterview] = useState<any>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [proposedAt, setProposedAt] = useState('');
  const [rescheduleNote, setRescheduleNote] = useState('');

  const apiBase = useMemo(() => apiRoot(), []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!token) {
        setError('Missing interview link');
        setLoading(false);
        return;
      }
      try {
        const res = await fetch(`${apiBase}/interviews/public/rsvp/${encodeURIComponent(token)}`);
        const payload = await res.json().catch(() => null);
        if (!res.ok || !payload?.success) {
          throw new Error(payload?.message || 'Unable to load interview');
        }
        if (!cancelled) setInterview(payload.data);
      } catch (err: unknown) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Unable to load interview');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [apiBase, token]);

  const submit = async (kind: 'accept' | 'reject' | 'reschedule') => {
    setSubmitting(true);
    setError('');
    try {
      const path =
        kind === 'accept'
          ? 'accept'
          : kind === 'reject'
            ? 'reject'
            : 'reschedule';
      const body =
        kind === 'reject'
          ? { reason: rejectReason }
          : kind === 'reschedule'
            ? {
                proposedAt,
                timezone: interview?.timezone,
                message: rescheduleNote,
              }
            : undefined;
      const res = await fetch(`${apiBase}/interviews/public/rsvp/${encodeURIComponent(token)}/${path}`, {
        method: 'POST',
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok || !payload?.success) {
        throw new Error(payload?.message || 'Request failed');
      }
      setInterview(payload.data);
      setDone({
        kind,
        message:
          kind === 'accept'
            ? 'Thanks — your acceptance was sent to the recruiter.'
            : kind === 'reject'
              ? 'Your decline was sent to the recruiter.'
              : `Reschedule request sent${
                  payload.data?.proposedAtLabel ? ` for ${payload.data.proposedAtLabel}` : ''
                }. The recruiter will follow up.`,
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Request failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-600">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading interview…
      </div>
    );
  }

  if (error && !interview) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="max-w-md rounded-2xl border border-rose-200 bg-white p-6 text-center shadow-sm">
          <XCircle className="mx-auto h-10 w-10 text-rose-500" />
          <h1 className="mt-3 text-lg font-semibold text-slate-900">Link unavailable</h1>
          <p className="mt-2 text-sm text-slate-600">{error}</p>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="max-w-md rounded-2xl border border-emerald-200 bg-white p-6 text-center shadow-sm">
          <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-500" />
          <h1 className="mt-3 text-lg font-semibold text-slate-900">Response recorded</h1>
          <p className="mt-2 text-sm text-slate-600">{done.message}</p>
          {interview?.showJoinCta && interview?.meetingLink ? (
            <a
              href={interview.meetingLink}
              target="_blank"
              rel="noreferrer"
              className="mt-5 inline-flex rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white"
            >
              Join Interview
            </a>
          ) : null}
        </div>
      </div>
    );
  }

  const showAccept = action === 'accept' || action === 'view';
  const showReject = action === 'reject' || action === 'view';
  const showReschedule = action === 'reschedule' || action === 'view';

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="bg-blue-600 px-6 py-5 text-white">
          <h1 className="text-xl font-bold">Interview response</h1>
          <p className="mt-1 text-sm text-blue-100">{interview?.jobTitle}</p>
        </div>
        <div className="space-y-4 px-6 py-5 text-sm text-slate-700">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Date & time</p>
            <p className="mt-1 font-medium text-slate-900">
              {formatWhen(interview?.scheduledAt, interview?.timezone)}
            </p>
          </div>
          {interview?.location ? (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Location</p>
              <p className="mt-1 font-medium text-slate-900">{interview.location}</p>
            </div>
          ) : null}
          {interview?.showJoinCta && interview?.meetingLink ? (
            <a
              href={interview.meetingLink}
              target="_blank"
              rel="noreferrer"
              className="inline-flex rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white"
            >
              Join Interview
            </a>
          ) : null}

          {error ? <p className="text-sm font-medium text-rose-600">{error}</p> : null}

          {showAccept && action === 'accept' ? (
            <button
              type="button"
              disabled={submitting}
              onClick={() => void submit('accept')}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              Confirm Accept
            </button>
          ) : null}

          {showReject && action === 'reject' ? (
            <div className="space-y-3">
              <label className="block text-sm font-semibold text-slate-900">
                Reason (optional)
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  rows={3}
                  className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-rose-200"
                />
              </label>
              <button
                type="button"
                disabled={submitting}
                onClick={() => void submit('reject')}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-rose-200 bg-white px-4 py-3 text-sm font-semibold text-rose-700 disabled:opacity-60"
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
                Confirm Reject
              </button>
            </div>
          ) : null}

          {showReschedule && action === 'reschedule' ? (
            <div className="space-y-3">
              <label className="block text-sm font-semibold text-slate-900">
                Proposed date & time
                <input
                  type="datetime-local"
                  value={proposedAt}
                  onChange={(e) => setProposedAt(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-200"
                />
              </label>
              <label className="block text-sm font-semibold text-slate-900">
                Note (optional)
                <textarea
                  value={rescheduleNote}
                  onChange={(e) => setRescheduleNote(e.target.value)}
                  rows={3}
                  className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-200"
                />
              </label>
              <button
                type="button"
                disabled={submitting || !proposedAt}
                onClick={() => void submit('reschedule')}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarClock className="h-4 w-4" />}
                Submit reschedule request
              </button>
            </div>
          ) : null}

          {action === 'view' ? (
            <div className="flex flex-wrap gap-2 pt-2">
              <button
                type="button"
                disabled={submitting}
                onClick={() => void submit('accept')}
                className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white"
              >
                Accept
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={() => {
                  window.location.search = '?action=reject';
                }}
                className="rounded-xl border border-rose-200 px-4 py-2.5 text-sm font-semibold text-rose-700"
              >
                Reject
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={() => {
                  window.location.search = '?action=reschedule';
                }}
                className="rounded-xl border border-indigo-200 px-4 py-2.5 text-sm font-semibold text-indigo-700"
              >
                Reschedule
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
