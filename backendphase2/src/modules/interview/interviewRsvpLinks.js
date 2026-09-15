import { getActiveTenantDbName } from '../../config/prisma.js';
import { resolveSessionTransferRedirectBase } from '../../config/env.js';
import { signInterviewRsvpToken } from '../../utils/interviewRsvpToken.js';

/** Video / online meetings with a real link get the Join Interview CTA. */
export function shouldShowJoinInterviewCta({ meetingLink, mode, modeLabel, type, interviewType } = {}) {
  const link = String(meetingLink || '').trim();
  if (!link || !/^https?:\/\//i.test(link)) return false;

  const modeRaw = `${mode || ''} ${modeLabel || ''}`.toLowerCase();
  const typeRaw = `${type || ''} ${interviewType || ''}`.toLowerCase();
  const combined = `${modeRaw} ${typeRaw}`.trim();

  // Explicit online / video signals win (e.g. "Video Call" must not be treated as phone).
  const onlineHints = [
    'video',
    'online',
    'virtual',
    'remote',
    'meet',
    'zoom',
    'teams',
    'webex',
  ];
  if (onlineHints.some((hint) => combined.includes(hint))) {
    return true;
  }

  // Do not use bare "call" — it matches "Video Call" and incorrectly hides Meet links.
  const offlineHints = [
    'phone',
    'in-person',
    'in person',
    'visit',
    'offline',
    'onsite',
    'on-site',
    'in_person',
    'walk-in',
    'walk in',
  ];
  if (offlineHints.some((hint) => combined.includes(hint))) {
    return false;
  }

  // Valid https link with no clear offline signal → show join CTA / meeting link.
  return true;
}

export function buildInterviewRsvpPublicUrls(interviewId, tenantDbName) {
  const base = resolveSessionTransferRedirectBase().replace(/\/$/, '');
  const token = signInterviewRsvpToken({
    interviewId,
    tenantDbName: tenantDbName || getActiveTenantDbName(),
  });
  // Put JWT in the query string — path JWTs break in mobile Gmail (truncated at `.`).
  const encoded = encodeURIComponent(token);
  return {
    token,
    acceptUrl: `${base}/interview-rsvp?token=${encoded}&action=accept`,
    rejectUrl: `${base}/interview-rsvp?token=${encoded}&action=reject`,
    rescheduleUrl: `${base}/interview-rsvp?token=${encoded}&action=reschedule`,
  };
}
