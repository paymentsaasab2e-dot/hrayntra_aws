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

function formatWhen(iso?: string | Date | null, timezone?: string | null) {
  if (!iso) return '—';
  const date = iso instanceof Date ? iso : new Date(iso);
  if (Number.isNaN(date.getTime())) return String(iso);
  const zones = [String(timezone || '').trim(), 'Asia/Kolkata', 'UTC'].filter(Boolean);
  for (const timeZone of zones) {
    try {
      return new Intl.DateTimeFormat('en-US', {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone,
        timeZoneName: 'short',
      }).format(date);
    } catch {
      // try next zone
    }
  }
  return date.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
}

function MeetingLinkBlock({ url }: { url: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Meeting link</p>
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="mt-1 block break-all text-sm font-medium text-blue-600 hover:underline"
      >
        {url}
      </a>
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="mt-3 inline-flex rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white"
      >
        Join Interview
      </a>
    </div>
  );
}

type DoneState = { kind: string; message: string; title: string };

function responseFromInterview(data: any): DoneState | null {
  const response = String(data?.candidateResponse || '').toLowerCase();
  const status = String(data?.status || '').toUpperCase();
  if (response === 'accepted' || status === 'CONFIRMED') {
    return {
      kind: 'accepted',
      title: 'Interview confirmed',
      message: 'You have already confirmed this interview. No need to accept again.',
    };
  }
  if (response === 'declined' || status === 'CANCELLED') {
    return {
      kind: 'declined',
      title: 'Interview declined',
      message: 'You have already declined this interview.',
    };
  }
  if (response === 'reschedule_requested') {
    return {
      kind: 'reschedule',
      title: 'Reschedule requested',
      message: 'Your reschedule request was already sent. The recruiter will follow up.',
    };
  }
  return null;
}

export default function InterviewRsvpPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  // JWTs contain dots — prefer pathname so we never lose segments if params truncate.
  const tokenFromPath =
    typeof window !== 'undefined'
      ? decodeURIComponent(
          window.location.pathname.split('/').filter(Boolean).slice(-1)[0] || '',
        )
      : '';
  const token = decodeURIComponent(
    String(params?.token || searchParams.get('token') || tokenFromPath || '').trim(),
  );
  const action = String(searchParams.get('action') || 'view').toLowerCase();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState<DoneState | null>(null);
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
        if (!cancelled) {
          const data = payload.data;
          setInterview(data);
          const existing = responseFromInterview(data);
          if (existing) setDone(existing);
        }
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
      const data = payload.data;
      setInterview(data);
      const existing = responseFromInterview(data);
      if (existing) {
        setDone(existing);
      } else {
        setDone({
          kind,
          title: 'Response recorded',
          message:
            kind === 'accept'
              ? 'Thanks — your acceptance was sent to the recruiter.'
              : kind === 'reject'
                ? 'Your decline was sent to the recruiter.'
                : `Reschedule request sent${
                    data?.proposedAtLabel ? ` for ${data.proposedAtLabel}` : ''
                  }. The recruiter will follow up.`,
        });
      }
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
    const isDeclined = done.kind === 'declined';
    const isReschedule = done.kind === 'reschedule';
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div
          className={`max-w-md rounded-2xl border bg-white p-6 text-center shadow-sm ${
            isDeclined
              ? 'border-rose-200'
              : isReschedule
                ? 'border-indigo-200'
                : 'border-emerald-200'
          }`}
        >
          {isDeclined ? (
            <XCircle className="mx-auto h-10 w-10 text-rose-500" />
          ) : isReschedule ? (
            <CalendarClock className="mx-auto h-10 w-10 text-indigo-500" />
          ) : (
            <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-500" />
          )}
          <h1 className="mt-3 text-lg font-semibold text-slate-900">{done.title}</h1>
          <p className="mt-2 text-sm text-slate-600">{done.message}</p>
          {interview?.jobTitle ? (
            <p className="mt-3 text-sm font-medium text-slate-800">{interview.jobTitle}</p>
          ) : null}
          {interview?.scheduledAt ? (
            <p className="mt-1 text-sm text-slate-500">
              {formatWhen(interview.scheduledAt, interview.timezone)}
            </p>
          ) : null}
          {!isDeclined && interview?.showJoinCta && interview?.meetingLink ? (
            <div className="mt-5 text-left">
              <MeetingLinkBlock url={interview.meetingLink} />
            </div>
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
            <MeetingLinkBlock url={interview.meetingLink} />
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
