import {
  formatInterviewDateInTimezone,
  formatInterviewTimeInTimezone,
} from './interview-schedule-helpers';

export type InterviewCandidateProposal = {
  at: string;
  timezone: string;
  note: string;
  date: string;
  time: string;
  label: string;
};

type ProposalSource = {
  rsvp?: {
    proposedAt?: string | null;
    proposedTimezone?: string | null;
    proposedNote?: string | null;
    candidateStatus?: string | null;
    recruiterDecision?: string | null;
  } | null;
  notes?: string | null;
  timezone?: string | null;
};

function lastIndexOf(pattern: RegExp, text: string): number {
  let last = -1;
  const copy = new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`);
  let match = copy.exec(text);
  while (match) {
    last = match.index;
    match = copy.exec(text);
  }
  return last;
}

function parseMarker(notes: string): { at: string; timezone: string; note: string } | null {
  const match = String(notes || '').match(/\[\[CANDIDATE_PROPOSED\]\](\{.*\})/i);
  if (!match) return null;
  try {
    const data = JSON.parse(match[1]) as { at?: string; tz?: string; timezone?: string; note?: string; status?: string };
    if (!data?.at) return null;
    const status = String(data.status || 'pending').toLowerCase();
    if (status !== 'pending') return null;
    return {
      at: String(data.at),
      timezone: String(data.tz || data.timezone || 'Asia/Kolkata'),
      note: String(data.note || ''),
    };
  } catch {
    return null;
  }
}

function parseLegacyPrefers(notes: string): { at: string; timezone: string; note: string } | null {
  const text = String(notes || '');
  const requestIdx = lastIndexOf(/Candidate reschedule request on /gi, text);
  if (requestIdx < 0) return null;
  const decided = Math.max(
    lastIndexOf(/Recruiter accepted candidate proposed/gi, text),
    lastIndexOf(/Recruiter rejected candidate proposed/gi, text),
    lastIndexOf(/Recruiter reproposed interview time/gi, text),
  );
  if (decided > requestIdx) return null;
  const slice = text.slice(requestIdx);
  const prefers = slice.match(/prefers\s+(.+?)\s+\(([^)]+)\)/i);
  if (!prefers) return null;
  const parsed = new Date(prefers[1]);
  if (Number.isNaN(parsed.getTime())) return null;
  const noteMatch = slice.match(/—\s*([^\n]+)/);
  return {
    at: parsed.toISOString(),
    timezone: String(prefers[2] || 'Asia/Kolkata').trim(),
    note: noteMatch ? String(noteMatch[1] || '').trim() : '',
  };
}

export function parseInterviewCandidateProposal(item: ProposalSource | null | undefined): InterviewCandidateProposal | null {
  if (!item) return null;
  const rsvp = item.rsvp && typeof item.rsvp === 'object' ? item.rsvp : null;
  const status = String(rsvp?.candidateStatus || '').toUpperCase();
  const decision = String(rsvp?.recruiterDecision || '').toUpperCase();
  let raw: { at: string; timezone: string; note: string } | null = null;
  if (
    rsvp?.proposedAt &&
    status === 'RESCHEDULE_REQUESTED' &&
    decision !== 'ACCEPTED' &&
    decision !== 'REJECTED' &&
    decision !== 'REPROPOSED'
  ) {
    raw = {
      at: String(rsvp.proposedAt),
      timezone: String(rsvp.proposedTimezone || item.timezone || 'Asia/Kolkata'),
      note: String(rsvp.proposedNote || ''),
    };
  } else {
    raw = parseMarker(item.notes || '') || parseLegacyPrefers(item.notes || '');
  }
  if (!raw?.at || Number.isNaN(new Date(raw.at).getTime())) return null;
  const timezone = raw.timezone || item.timezone || 'Asia/Kolkata';
  const date = formatInterviewDateInTimezone(raw.at, timezone);
  const time = formatInterviewTimeInTimezone(raw.at, timezone);
  return {
    at: raw.at,
    timezone,
    note: raw.note || '',
    date,
    time,
    label: [date, time].filter(Boolean).join(' '),
  };
}
