/**
 * Interviewer double-booking / time-overlap checks for interview scheduling.
 */

export const INTERVIEWER_CONFLICT_CODE = 'INTERVIEWER_CONFLICT';

/** Statuses that still occupy an interviewer slot. */
export const INTERVIEW_BLOCKING_STATUSES = [
  'SCHEDULED',
  'RESCHEDULED',
  'CONFIRMED',
  'IN_PROGRESS',
  'FEEDBACK_PENDING',
];

/** Longest interview we consider when looking back for overlaps. */
const LOOKBACK_HOURS = 8;

export class InterviewerConflictError extends Error {
  constructor(message, meta = {}) {
    super(message);
    this.name = 'InterviewerConflictError';
    this.code = INTERVIEWER_CONFLICT_CODE;
    this.statusCode = 409;
    this.meta = meta;
  }
}

function toDate(value) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function addMinutes(date, minutes) {
  return new Date(date.getTime() + Number(minutes || 0) * 60 * 1000);
}

function formatClock(date) {
  try {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return date.toISOString();
  }
}

function formatDay(date) {
  try {
    return date.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

function displayUserName(user) {
  if (!user) return 'Interviewer';
  const fromParts = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
  if (fromParts) return fromParts;
  if (user.name) return String(user.name).trim();
  if (user.email) return String(user.email).trim();
  return 'Interviewer';
}

function rangesOverlap(startA, endA, startB, endB) {
  return startA < endB && endA > startB;
}

/**
 * Throws InterviewerConflictError when any panel member already has an overlapping interview.
 *
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{
 *   interviewerIds: string[],
 *   scheduledAt: Date|string,
 *   durationMinutes?: number,
 *   excludeInterviewId?: string|null,
 * }} params
 */
export async function assertNoInterviewerScheduleConflicts(prisma, params) {
  const interviewerIds = [
    ...new Set((params?.interviewerIds || []).map((id) => String(id || '').trim()).filter(Boolean)),
  ];
  const scheduledAt = toDate(params?.scheduledAt);
  if (!interviewerIds.length || !scheduledAt) return;

  const durationMinutes =
    Number(params?.durationMinutes) > 0 ? Math.round(Number(params.durationMinutes)) : 60;
  const newStart = scheduledAt;
  const newEnd = addMinutes(newStart, durationMinutes);
  const windowStart = addMinutes(newStart, -(LOOKBACK_HOURS * 60));

  const excludeInterviewId = params?.excludeInterviewId
    ? String(params.excludeInterviewId).trim()
    : null;

  const candidates = await prisma.interview.findMany({
    where: {
      ...(excludeInterviewId ? { id: { not: excludeInterviewId } } : {}),
      status: { in: INTERVIEW_BLOCKING_STATUSES },
      scheduledAt: {
        gte: windowStart,
        lt: newEnd,
      },
      OR: [{ interviewerId: { in: interviewerIds } }, { panelIds: { hasSome: interviewerIds } }],
    },
    select: {
      id: true,
      scheduledAt: true,
      duration: true,
      interviewerId: true,
      panelIds: true,
      candidate: {
        select: { firstName: true, lastName: true, email: true },
      },
      interviewer: {
        select: { id: true, firstName: true, lastName: true, name: true, email: true },
      },
      panel: {
        select: {
          userId: true,
          user: {
            select: { id: true, firstName: true, lastName: true, name: true, email: true },
          },
        },
      },
    },
  });

  const conflicts = [];

  for (const interview of candidates) {
    const existingStart = toDate(interview.scheduledAt);
    if (!existingStart) continue;
    const existingEnd = addMinutes(
      existingStart,
      Number(interview.duration) > 0 ? interview.duration : 60,
    );
    if (!rangesOverlap(newStart, newEnd, existingStart, existingEnd)) continue;

    const busyIds = new Set(
      [...(interview.panelIds || []), interview.interviewerId]
        .map((id) => String(id || '').trim())
        .filter(Boolean),
    );
    const overlappingInterviewerIds = interviewerIds.filter((id) => busyIds.has(id));
    if (!overlappingInterviewerIds.length) continue;

    conflicts.push({ interview, overlappingInterviewerIds, existingStart, existingEnd });
  }

  if (!conflicts.length) return;

  const first = conflicts[0];
  const userById = new Map();
  if (first.interview.interviewer?.id) {
    userById.set(String(first.interview.interviewer.id), first.interview.interviewer);
  }
  for (const member of first.interview.panel || []) {
    if (member?.user?.id) userById.set(String(member.user.id), member.user);
  }

  const conflictedNames = first.overlappingInterviewerIds
    .map((id) => displayUserName(userById.get(id)))
    .filter(Boolean);
  const interviewerLabel =
    conflictedNames.length > 1
      ? conflictedNames.join(', ')
      : conflictedNames[0] || 'This interviewer';

  const candidateName =
    [first.interview.candidate?.firstName, first.interview.candidate?.lastName]
      .filter(Boolean)
      .join(' ')
      .trim() ||
    first.interview.candidate?.email ||
    'another candidate';

  const message = `${interviewerLabel} already has an interview scheduled on ${formatDay(
    first.existingStart,
  )} from ${formatClock(first.existingStart)} – ${formatClock(
    first.existingEnd,
  )} (${candidateName}). Please choose a different time or interviewer.`;

  throw new InterviewerConflictError(message, {
    conflictInterviewId: first.interview.id,
    interviewerIds: first.overlappingInterviewerIds,
    scheduledAt: first.existingStart.toISOString(),
    endsAt: first.existingEnd.toISOString(),
  });
}

export function httpStatusFromError(error, fallback = 400) {
  if (Number(error?.statusCode) > 0) return Number(error.statusCode);
  if (error?.code === INTERVIEWER_CONFLICT_CODE) return 409;
  if (error?.message === 'Interview not found') return 404;
  return fallback;
}
