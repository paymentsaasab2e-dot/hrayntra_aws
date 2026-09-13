import { getActiveTenantDbName } from '../../config/prisma.js';
import { resolveSessionTransferRedirectBase } from '../../config/env.js';
import { signInterviewRsvpToken } from '../../utils/interviewRsvpToken.js';

/** Video / online meetings with a real link get the Join Interview CTA. */
export function shouldShowJoinInterviewCta({ meetingLink, mode, modeLabel, type, interviewType } = {}) {
  const link = String(meetingLink || '').trim();
  if (!link || !/^https?:\/\//i.test(link)) return false;

  const modeRaw = `${mode || ''} ${modeLabel || ''}`.toLowerCase();
  const typeRaw = `${type || ''} ${interviewType || ''}`.toLowerCase();
  const offlineHints = [
    'phone',
    'call',
    'in-person',
    'in person',
    'visit',
    'offline',
    'onsite',
    'on-site',
    'in_person',
  ];
  if (offlineHints.some((hint) => modeRaw.includes(hint) || typeRaw.includes(hint))) {
    return false;
  }
  return true;
}

export function buildInterviewRsvpPublicUrls(interviewId, tenantDbName) {
  const base = resolveSessionTransferRedirectBase().replace(/\/$/, '');
  const token = signInterviewRsvpToken({
    interviewId,
    tenantDbName: tenantDbName || getActiveTenantDbName(),
  });
  const encoded = encodeURIComponent(token);
  return {
    token,
    acceptUrl: `${base}/interview-rsvp/${encoded}?action=accept`,
    rejectUrl: `${base}/interview-rsvp/${encoded}?action=reject`,
    rescheduleUrl: `${base}/interview-rsvp/${encoded}?action=reschedule`,
  };
}
