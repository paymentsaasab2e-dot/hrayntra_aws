import React from 'react';
import { CalendarDays, CheckCircle2, Clock3, MapPin, XCircle, CalendarClock } from 'lucide-react';
import type { Interview } from '../../types/interview.types';
import { formatTimezoneDisplay, resolveIanaFromTimezoneValue } from '../../utils/inferTimezone';
import { DrawerLinkActions } from '../drawers/DrawerLinkActions';

interface DrawerOverviewTabProps {
  interview: Interview;
  onAcceptProposal?: (interview: Interview) => void;
  onRejectProposal?: (interview: Interview) => void;
  onReproposeInterview?: (interview: Interview) => void;
  proposalBusyId?: string | null;
}

function parseCandidateRsvp(notes: string, status: Interview['status']) {
  const text = String(notes || '');
  if (status === 'Accepted' || /Candidate accepted on /i.test(text)) {
    const match = text.match(/Candidate accepted on ([^\n]+)/i);
    return {
      kind: 'accepted' as const,
      title: 'Candidate accepted',
      detail: match?.[1] ? `Responded on ${match[1].trim()}` : 'The candidate confirmed this interview from the invite email.',
    };
  }
  if (/Candidate declined on /i.test(text)) {
    const match = text.match(/Candidate declined on ([^\n]+)/i);
    return {
      kind: 'declined' as const,
      title: 'Candidate declined',
      detail: match?.[1] ? match[1].trim() : 'The candidate declined this interview from the invite email.',
    };
  }
  if (/Candidate reschedule request on /i.test(text)) {
    const match = text.match(/Candidate reschedule request on ([^\n]+)/i);
    return {
      kind: 'reschedule' as const,
      title: 'Reschedule requested',
      detail: match?.[1] ? match[1].trim() : 'The candidate asked to reschedule from the invite email.',
    };
  }
  return null;
}

export function DrawerOverviewTab({
  interview,
  onAcceptProposal,
  onRejectProposal,
  onReproposeInterview,
  proposalBusyId = null,
}: DrawerOverviewTabProps) {
  const timezoneLabel = formatTimezoneDisplay(resolveIanaFromTimezoneValue(interview.timezone));
  const candidateRsvp = parseCandidateRsvp(interview.notes, interview.status);
  const proposal = interview.candidateProposal;
  const items = [
    ['Interview Round', interview.round],
    ['Interview Type', interview.type],
    ['Date', interview.date],
    ['Time', interview.time],
    ['Timezone', timezoneLabel],
    ['Duration', `${interview.duration} minutes`],
    ['Status', interview.status === 'Accepted' ? 'Candidate accepted' : interview.status],
    ['Created By', interview.createdBy],
  ];

  return (
    <div className="space-y-5">
      {proposal ? (
        <div className="rounded-xl border border-orange-200 bg-orange-50 px-4 py-3">
          <div className="flex items-start gap-3">
            <CalendarClock className="mt-0.5 size-5 shrink-0 text-orange-600" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-orange-950">Candidate proposed a new time</p>
              <p className="mt-1 text-sm font-semibold text-orange-900">
                {proposal.label} ({proposal.timezone})
              </p>
              {proposal.note ? (
                <p className="mt-1 text-sm text-orange-800">{proposal.note}</p>
              ) : null}
              <p className="mt-1 text-xs text-orange-700">
                Original schedule: {interview.date} at {interview.time}
              </p>
              {onAcceptProposal || onRejectProposal || onReproposeInterview ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {onAcceptProposal ? (
                    <button
                      type="button"
                      disabled={Boolean(proposalBusyId)}
                      onClick={() => onAcceptProposal(interview)}
                      className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:cursor-wait disabled:opacity-60"
                    >
                      {proposalBusyId === interview.id ? 'Confirming…' : 'Accept'}
                    </button>
                  ) : null}
                  {onRejectProposal ? (
                    <button
                      type="button"
                      onClick={() => onRejectProposal(interview)}
                      className="rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50"
                    >
                      Reject
                    </button>
                  ) : null}
                  {onReproposeInterview ? (
                    <button
                      type="button"
                      onClick={() => onReproposeInterview(interview)}
                      className="rounded-lg border border-indigo-200 bg-white px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-50"
                    >
                      Repropose
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : candidateRsvp ? (
        <div
          className={`rounded-xl border px-4 py-3 ${
            candidateRsvp.kind === 'accepted'
              ? 'border-emerald-200 bg-emerald-50'
              : candidateRsvp.kind === 'declined'
                ? 'border-rose-200 bg-rose-50'
                : 'border-indigo-200 bg-indigo-50'
          }`}
        >
          <div className="flex items-start gap-3">
            {candidateRsvp.kind === 'accepted' ? (
              <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-600" />
            ) : candidateRsvp.kind === 'declined' ? (
              <XCircle className="mt-0.5 size-5 shrink-0 text-rose-600" />
            ) : (
              <CalendarClock className="mt-0.5 size-5 shrink-0 text-indigo-600" />
            )}
            <div>
              <p
                className={`text-sm font-semibold ${
                  candidateRsvp.kind === 'accepted'
                    ? 'text-emerald-900'
                    : candidateRsvp.kind === 'declined'
                      ? 'text-rose-900'
                      : 'text-indigo-900'
                }`}
              >
                {candidateRsvp.title}
              </p>
              <p
                className={`mt-1 text-sm ${
                  candidateRsvp.kind === 'accepted'
                    ? 'text-emerald-800'
                    : candidateRsvp.kind === 'declined'
                      ? 'text-rose-800'
                      : 'text-indigo-800'
                }`}
              >
                {candidateRsvp.detail}
              </p>
            </div>
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        {items.map(([label, value]) => (
          <div key={label} className="rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] p-4">
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[#6B7280]">{label}</div>
            <div className="mt-2 text-sm font-semibold text-[#111827]">{value}</div>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-[#E5E7EB] p-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-[#111827]">
          <CalendarDays className="size-4 text-[#6B7280]" />
          Interview Schedule
        </div>
        <div className="mt-3 space-y-3 text-sm text-[#374151]">
          <div className="flex items-center gap-2">
            <Clock3 className="size-4 text-[#6B7280]" />
            {interview.date} at {interview.time} ({timezoneLabel})
          </div>
          {interview.meetingLink ? (
            <div className="space-y-1.5">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Meeting link</p>
              <DrawerLinkActions url={interview.meetingLink} shareTitle="Interview meeting link" />
              <a
                href={interview.meetingLink}
                target="_blank"
                rel="noreferrer"
                className="block break-all text-sm font-medium text-blue-600 hover:underline"
              >
                {interview.meetingLink}
              </a>
            </div>
          ) : null}
          {interview.location ? (
            <div className="flex items-center gap-2">
              <MapPin className="size-4 text-[#6B7280]" />
              {interview.location}
            </div>
          ) : null}
        </div>
      </div>

      <div className="rounded-xl border border-[#E5E7EB] p-4">
        <div className="text-sm font-semibold text-[#111827]">Notes</div>
        <p className="mt-2 text-sm leading-6 text-[#4B5563]">{interview.notes || 'No notes added yet.'}</p>
      </div>
    </div>
  );
}
