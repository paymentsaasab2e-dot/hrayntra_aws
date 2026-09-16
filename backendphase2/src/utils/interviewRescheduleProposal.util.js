/**
 * Candidate-proposed interview time (email Reschedule → recruiter Accept / Reject / Repropose).
 * Stored on Interview.rsvp JSON and mirrored in notes for older rows.
 */

const MARKER = '[[CANDIDATE_PROPOSED]]';
const PENDING = 'RESCHEDULE_REQUESTED';

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
}

export function formatProposedAtLabel(iso, timezone) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const tz = String(timezone || 'Asia/Kolkata').trim() || 'Asia/Kolkata';
  try {
    return new Intl.DateTimeFormat('en-US', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: tz,
    }).format(date);
  } catch {
    return date.toISOString();
  }
}

function parseLooseDate(value) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const raw = String(value).trim();
  if (!raw) return null;
  const iso = new Date(raw);
  if (!Number.isNaN(iso.getTime())) return iso;
  const dmy = raw.match(
    /^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})(?:[, ]+(\d{1,2}):(\d{2})(?:\s*:\d{2})?\s*(AM|PM)?)?/i,
  );
  if (!dmy) return null;
  let hour = Number(dmy[4] || 0);
  const minute = Number(dmy[5] || 0);
  const ampm = String(dmy[6] || '').toUpperCase();
  if (ampm === 'PM' && hour < 12) hour += 12;
  if (ampm === 'AM' && hour === 12) hour = 0;
  const parsed = new Date(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1]), hour, minute);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function extractMarkerJson(notes) {
  const text = String(notes || '');
  const markerAt = text.search(/\[\[CANDIDATE_PROPOSED\]\]/i);
  if (markerAt < 0) return null;
  const start = text.indexOf('{', markerAt);
  if (start < 0) return null;
  let depth = 0;
  for (let i = start; i < text.length; i += 1) {
    if (text[i] === '{') depth += 1;
    else if (text[i] === '}') {
      depth -= 1;
      if (depth === 0) {
        try {
          return JSON.parse(text.slice(start, i + 1));
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

function parseMarker(notes) {
  const data = extractMarkerJson(notes);
  if (!data?.at) return null;
  const status = String(data.status || PENDING).toUpperCase();
  if (status !== PENDING && status !== 'PENDING') return null;
  const at = coerceProposedAt(data.at);
  if (!at) return null;
  return {
    at,
    timezone: String(data.tz || data.timezone || 'Asia/Kolkata'),
    note: String(data.note || ''),
  };
}

function parseLegacyPrefers(notes) {
  const text = String(notes || '');
  const requestIdx = lastIndexOf(/Candidate reschedule request on /gi, text);
  if (requestIdx < 0) return null;
  const acceptedIdx = lastIndexOf(/Recruiter accepted candidate proposed/gi, text);
  const rejectedIdx = lastIndexOf(/Recruiter rejected candidate proposed/gi, text);
  const reproposedIdx = lastIndexOf(/Recruiter reproposed interview time/gi, text);
  const decided = Math.max(acceptedIdx, rejectedIdx, reproposedIdx);
  if (decided > requestIdx) return null;

  const slice = text.slice(requestIdx);
  const prefers = slice.match(/prefers\s+(.+?)\s+\(([^)]+)\)/i);
  if (!prefers) return null;
  const tz = String(prefers[2] || 'Asia/Kolkata').trim();
  const parsed = parseLooseDate(prefers[1]);
  if (!parsed) return null;
  const noteMatch = slice.match(/—\s*([^\n]+)/);
  return {
    at: parsed.toISOString(),
    timezone: tz,
    note: noteMatch ? String(noteMatch[1] || '').trim() : '',
  };
}

function lastIndexOf(regex, text) {
  let last = -1;
  const copy = new RegExp(regex.source, regex.flags);
  let match = copy.exec(text);
  while (match) {
    last = match.index;
    match = copy.exec(text);
  }
  return last;
}

export function parseInterviewRescheduleProposal(interview) {
  if (!interview) return null;
  const rsvp = asObject(interview.rsvp);
  const status = String(rsvp?.candidateStatus || '').toUpperCase();
  const decision = String(rsvp?.recruiterDecision || '').toUpperCase();
  const proposedAt = rsvp?.proposedAt;
  if (
    proposedAt &&
    status === PENDING &&
    decision !== 'ACCEPTED' &&
    decision !== 'REJECTED' &&
    decision !== 'REPROPOSED'
  ) {
    const at = coerceProposedAt(proposedAt);
    if (at) {
      return {
        at,
        timezone: String(rsvp.proposedTimezone || interview.timezone || 'Asia/Kolkata'),
        note: String(rsvp.proposedNote || ''),
      };
    }
  }
  return parseMarker(interview.notes) || parseLegacyPrefers(interview.notes);
}

export function coerceProposedAt(value) {
  const parsed = parseLooseDate(value);
  return parsed ? parsed.toISOString() : null;
}

export function resolveCandidateProposal(interview, payload = {}) {
  const parsed = parseInterviewRescheduleProposal(interview);
  if (parsed?.at) return parsed;
  const at = coerceProposedAt(payload?.proposedAt);
  if (!at) return null;
  return {
    at,
    timezone: String(payload?.timezone || interview?.timezone || 'Asia/Kolkata'),
    note: String(payload?.note || ''),
  };
}

export function isProposalAlreadyAccepted(interview) {
  if (parseInterviewRescheduleProposal(interview)) return false;
  const status = String(interview?.status || '').toUpperCase();
  const rsvp = asObject(interview?.rsvp);
  const decision = String(rsvp?.recruiterDecision || '').toUpperCase();
  if (decision === 'ACCEPTED') return true;
  if (status === 'CONFIRMED') return true;
  return /Recruiter accepted candidate proposed/i.test(String(interview?.notes || ''));
}

export function buildProposalMarker({ at, timezone, note }) {
  return `${MARKER}${JSON.stringify({
    at,
    tz: timezone || 'Asia/Kolkata',
    note: String(note || ''),
    status: 'pending',
  })}`;
}

export function stripProposalMarker(notes) {
  return String(notes || '')
    .split(/\r?\n/)
    .filter((line) => !/\[\[CANDIDATE_PROPOSED\]\]/.test(line))
    .join('\n')
    .trim();
}

export function appendInterviewNote(notes, line) {
  return [stripProposalMarker(notes), line].filter(Boolean).join('\n');
}

export function buildPendingRsvp({ at, timezone, note }) {
  return {
    candidateStatus: PENDING,
    recruiterDecision: null,
    proposedAt: at,
    proposedTimezone: timezone || 'Asia/Kolkata',
    proposedNote: String(note || '') || null,
  };
}

export function buildClearedRsvp(decision) {
  return {
    candidateStatus: decision === 'ACCEPTED' ? 'ACCEPTED' : 'PENDING',
    recruiterDecision: decision,
    proposedAt: null,
    proposedTimezone: null,
    proposedNote: null,
  };
}

export function proposalToPublicView(interview) {
  const proposal = parseInterviewRescheduleProposal(interview);
  if (!proposal) return null;
  const label = formatProposedAtLabel(proposal.at, proposal.timezone);
  return {
    proposedAt: proposal.at,
    proposedAtLabel: label ? `${label} (${proposal.timezone})` : proposal.at,
    proposedNote: proposal.note || '',
    proposedTimezone: proposal.timezone,
  };
}

export async function updateInterviewWithRsvp(prismaClient, { id, data, include }) {
  try {
    return await prismaClient.interview.update({
      where: { id },
      data,
      include,
    });
  } catch (error) {
    const message = String(error?.message || error);
    if (!/Unknown arg|Unknown argument|`rsvp`/i.test(message)) throw error;
    const next = { ...data };
    delete next.rsvp;
    return prismaClient.interview.update({
      where: { id },
      data: next,
      include,
    });
  }
}
