import type { CandidateScheduledInterview } from '../components/drawers/candidateProfileDrawerData';
import type {
  Interview,
  InterviewMode,
  InterviewRound,
  InterviewType,
  UpdateInterviewPayload,
} from '../types/interview.types';
import {
  DEFAULT_INTERVIEW_TIMEZONE,
  resolveIanaFromTimezoneValue,
} from '../utils/inferTimezone';
import {
  formatInstantDateDMY,
  formatInstantTime12h,
  getYmdInTimeZone,
  zonedWallClockToUtcIso,
} from '../utils/zonedDateTime';
import type { CreateInterviewPayload } from './api';

const BACKEND_INTERVIEW_TYPES = new Set<string>([
  'VIDEO',
  'PHONE',
  'IN_PERSON',
  'TECHNICAL_TEST',
  'ASSESSMENT',
  'GROUP_DISCUSSION',
  'ONSITE',
  'TECHNICAL',
  'FINAL',
]);

/**
 * Maps UI labels ("In-Person", "Technical Test") to Prisma / Zod enum tokens (IN_PERSON, TECHNICAL_TEST).
 * Hyphens and spaces become underscores before upper-casing.
 */
export function mapInterviewUiTypeToBackend(type: string): CreateInterviewPayload['type'] {
  const normalized = String(type || '')
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, '_');
  if (BACKEND_INTERVIEW_TYPES.has(normalized)) {
    return normalized as CreateInterviewPayload['type'];
  }
  return 'VIDEO';
}

/**
 * Builds an ISO instant from `YYYY-MM-DD` + `10:30 AM`.
 * When `timezone` is provided, the wall clock is interpreted in that IANA zone
 * (or a stored display label such as "IST (UTC+5:30)"). Otherwise the browser
 * local calendar is used.
 */
export function combineInterviewDateAndTimeToIso(
  dateYmd: string,
  time12h: string,
  timezone?: string | null,
): string {
  const ymd = String(dateYmd || '').trim();
  if (!ymd) {
    return new Date().toISOString();
  }
  const parts = ymd.split('-').map((p) => Number(p));
  const y = parts[0];
  const mo = parts[1];
  const d = parts[2];
  if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d)) {
    return new Date(ymd).toISOString();
  }
  const t = String(time12h || '').trim();
  const m = t.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  let hours = 9;
  let minutes = 0;
  if (m) {
    hours = Number(m[1]) % 12;
    minutes = Number(m[2]);
    if (m[3].toUpperCase() === 'PM') hours += 12;
  }
  const iana = String(timezone || '').trim()
    ? resolveIanaFromTimezoneValue(timezone)
    : '';
  if (iana) {
    return zonedWallClockToUtcIso(y, mo, d, hours, minutes, iana);
  }
  return new Date(y, mo - 1, d, hours, minutes, 0, 0).toISOString();
}

export function formatInterviewDateInTimezone(
  iso: string,
  timezone?: string | null,
): string {
  const iana = String(timezone || '').trim() ? resolveIanaFromTimezoneValue(timezone) : undefined;
  return formatInstantDateDMY(iso, iana);
}

export function formatInterviewTimeInTimezone(
  iso: string,
  timezone?: string | null,
): string {
  const iana = String(timezone || '').trim() ? resolveIanaFromTimezoneValue(timezone) : undefined;
  return formatInstantTime12h(iso, iana);
}

export function getInterviewDateInputYmd(
  iso: string,
  timezone?: string | null,
): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const iana = String(timezone || '').trim() ? resolveIanaFromTimezoneValue(timezone) : undefined;
  return getYmdInTimeZone(iana, d);
}

type InterviewRoundRow = {
  id: string;
  candidate: { id: string };
  job: { id: string };
  scheduledAt?: string;
  status?: string;
};

/** Chronological R1, R2, … per candidate + job (stable even when list filters hide earlier rounds). */
export function buildInterviewRoundNumberById<T extends InterviewRoundRow>(
  interviews: T[],
): Record<string, number> {
  const map = new Map<string, T[]>();
  for (const inv of interviews) {
    const candidateId = inv?.candidate?.id;
    const jobId = inv?.job?.id;
    if (!candidateId || !jobId) continue;
    const key = `${candidateId}::${jobId}`;
    const list = map.get(key);
    if (list) list.push(inv);
    else map.set(key, [inv]);
  }

  const byId: Record<string, number> = {};
  for (const rounds of map.values()) {
    const sorted = [...rounds].sort(
      (a, b) =>
        new Date(a.scheduledAt || 0).getTime() - new Date(b.scheduledAt || 0).getTime(),
    );
    sorted.forEach((inv, index) => {
      byId[inv.id] = index + 1;
    });
  }
  return byId;
}

export function computeNextInterviewRound(
  interviews: Array<{ candidateId: string; jobId?: string | null; status?: string | null }>,
  candidateId: string,
  jobId?: string | null,
): number {
  const activeCount = interviews.filter((inv) => {
    if (inv.candidateId !== candidateId) return false;
    if (jobId && inv.jobId && inv.jobId !== jobId) return false;
    const status = String(inv.status || '').trim().toLowerCase();
    return status !== 'cancelled';
  }).length;
  return Math.max(1, activeCount + 1);
}

const INTERVIEW_ROUND_TO_POPUP_TYPE: Record<InterviewRound, string> = {
  Screening: 'HR Screening',
  Technical: 'Technical Round 1',
  HR: 'HR Screening',
  Managerial: 'Cultural Fit',
  Client: 'Client Interview',
  Final: 'Final Round',
};

const POPUP_TYPE_TO_INTERVIEW_ROUND: Record<string, InterviewRound> = {
  'HR Screening': 'Screening',
  'Technical Round 1': 'Technical',
  'Technical Round 2': 'Technical',
  'System Design': 'Technical',
  'Cultural Fit': 'Managerial',
  'Final Round': 'Final',
  'Client Interview': 'Client',
};

const DURATION_MINUTES_TO_LABEL: Record<number, string> = {
  30: '30 mins',
  45: '45 mins',
  60: '1 hour',
  90: '1.5 hours',
  120: '2 hours',
};

const DURATION_LABEL_TO_MINUTES: Record<string, number> = {
  '30 mins': 30,
  '45 mins': 45,
  '1 hour': 60,
  '1.5 hours': 90,
  '2 hours': 120,
};

const PANEL_ROLE_TO_POPUP_ROLE: Record<
  Interview['panel'][number]['role'],
  CandidateScheduledInterview['interviewers'][number]['role']
> = {
  HR: 'Lead Interviewer',
  Technical: 'Interviewer',
  Client: 'Observer',
};

const POPUP_ROLE_TO_PANEL_ROLE: Record<
  CandidateScheduledInterview['interviewers'][number]['role'],
  'HR' | 'Technical' | 'Client'
> = {
  'Lead Interviewer': 'HR',
  Interviewer: 'Technical',
  Observer: 'Client',
};

function interviewModeToPopupMode(interview: Interview): CandidateScheduledInterview['mode'] {
  if (interview.type === 'Phone') return 'phone';
  if (interview.mode === 'Offline' || interview.type === 'In-Person') return 'in-person';
  return 'video';
}

function interviewStatusToPopupStatus(
  status: Interview['status'],
): CandidateScheduledInterview['status'] {
  if (status === 'Completed') return 'completed';
  if (status === 'Cancelled') return 'cancelled';
  return 'scheduled';
}

function popupStatusToInterviewStatus(
  status: CandidateScheduledInterview['status'],
): Interview['status'] {
  if (status === 'completed') return 'Completed';
  if (status === 'cancelled') return 'Cancelled';
  return 'Scheduled';
}

const SYSTEM_INTERVIEW_NOTE_PREFIXES = [
  '[Submitted to client]',
  '[Client Tag]',
  '[Client Upload]',
] as const;

/** System audit lines appended to interview notes (submit-to-client, client tags, uploads). */
export function isSystemInterviewNoteLine(line: string): boolean {
  const trimmed = line.trim();
  return SYSTEM_INTERVIEW_NOTE_PREFIXES.some((prefix) => trimmed.startsWith(prefix));
}

/** User-editable notes only — strips system audit lines from the stored notes field. */
export function extractEditableInterviewNotes(notes: string | null | undefined): string {
  return String(notes || '')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !isSystemInterviewNoteLine(line))
    .join('\n');
}

function extractSystemInterviewNoteLines(notes: string | null | undefined): string[] {
  return String(notes || '')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && isSystemInterviewNoteLine(line));
}

/** Re-attaches preserved audit lines after the user edits free-form notes. */
export function mergeEditableInterviewNotesWithAudit(
  editableNotes: string,
  originalNotes: string | null | undefined,
): string {
  const userNotes = editableNotes.trim();
  const auditLines = extractSystemInterviewNoteLines(originalNotes);
  if (auditLines.length === 0) return userNotes;
  if (!userNotes) return auditLines.join('\n');
  return `${userNotes}\n${auditLines.join('\n')}`;
}

/** Maps an interviews-page `Interview` row into the candidate popup edit shape. */
export function mapInterviewToCandidateScheduled(
  interview: Interview,
  roundNumber: number,
): CandidateScheduledInterview {
  const scheduledAt = String(interview.scheduledAt || '');
  const timezone = interview.timezone || DEFAULT_INTERVIEW_TIMEZONE;
  return {
    id: interview.id,
    candidateId: interview.candidate.id,
    jobId: interview.job.id,
    jobTitle: interview.job.title,
    type: INTERVIEW_ROUND_TO_POPUP_TYPE[interview.round] || interview.round,
    round: roundNumber,
    date: scheduledAt ? getInterviewDateInputYmd(scheduledAt, timezone) : '',
    time: scheduledAt ? formatInterviewTimeInTimezone(scheduledAt, timezone) : interview.time,
    duration: DURATION_MINUTES_TO_LABEL[interview.duration] || `${interview.duration} mins`,
    mode: interviewModeToPopupMode(interview),
    platform:
      interview.meetingPlatform === 'Google Meet'
        ? 'Google Meet'
        : interview.meetingPlatform === 'Zoom'
          ? 'Zoom'
          : null,
    meetingLink: interview.meetingLink || null,
    location: interview.location || null,
    phoneNumber: null,
    interviewers: (interview.panel || []).map((member) => ({
      id: member.userId || member.id,
      name: member.name,
      role: PANEL_ROLE_TO_POPUP_ROLE[member.role] || 'Interviewer',
    })),
    clientId: interview.job.clientId || null,
    clientName: interview.job.client || null,
    notes: interview.notes || '',
    sendCandidateInvite: true,
    sendInterviewerInvite: true,
    status: interviewStatusToPopupStatus(interview.status),
    timezone,
  };
}

/** Maps popup save payload back to the interviews-page update API shape. */
export function mapCandidateScheduledToUpdatePayload(
  data: CandidateScheduledInterview,
  timezone = DEFAULT_INTERVIEW_TIMEZONE,
  originalNotes?: string | null,
): UpdateInterviewPayload {
  const mode: InterviewMode = data.mode === 'in-person' ? 'Offline' : 'Online';
  const type: InterviewType =
    data.mode === 'phone' ? 'Phone' : data.mode === 'in-person' ? 'In-Person' : 'Video';
  const resolvedTimezone = resolveIanaFromTimezoneValue(data.timezone || timezone);

  return {
    candidateId: data.candidateId,
    jobId: data.jobId || undefined,
    clientId: data.clientId || undefined,
    round: POPUP_TYPE_TO_INTERVIEW_ROUND[data.type] || 'Screening',
    type,
    mode,
    date: combineInterviewDateAndTimeToIso(data.date, data.time, resolvedTimezone),
    duration: DURATION_LABEL_TO_MINUTES[data.duration] || 60,
    timezone: resolvedTimezone,
    meetingPlatform:
      data.mode === 'video'
        ? data.platform === 'Google Meet'
          ? 'Google Meet'
          : data.platform === 'Zoom'
            ? 'Zoom'
            : null
        : null,
    location: data.mode === 'in-person' ? data.location || null : null,
    notes:
      mergeEditableInterviewNotesWithAudit(
        extractEditableInterviewNotes(data.notes),
        originalNotes,
      ) || null,
    status: popupStatusToInterviewStatus(data.status),
    panelUserIds: data.interviewers.map((member) => member.id),
    panelRoles: Object.fromEntries(
      data.interviewers.map((member) => [
        member.id,
        POPUP_ROLE_TO_PANEL_ROLE[member.role] || 'Technical',
      ]),
    ),
  };
}
