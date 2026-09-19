import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

const TOKEN_TYPE = 'interview_rsvp';

function secret() {
  const configured =
    process.env.INTERVIEW_RSVP_EMAIL_SECRET ||
    env.JWT_ACCESS_SECRET ||
    env.JWT_SECRET ||
    '';
  if (!String(configured || '').trim()) {
    throw new Error(
      'INTERVIEW_RSVP_EMAIL_SECRET (or JWT_ACCESS_SECRET / JWT_SECRET) is required for RSVP tokens'
    );
  }
  return configured;
}

/** Signed public link for candidate accept / reject / reschedule (no login). */
export function signInterviewRsvpToken({ interviewId, tenantDbName, expiresIn = '14d' }) {
  return jwt.sign(
    {
      interviewId,
      tenantDbName: String(tenantDbName || '').trim() || undefined,
      typ: TOKEN_TYPE,
    },
    secret(),
    { expiresIn },
  );
}

export function verifyInterviewRsvpToken(token) {
  if (!token || typeof token !== 'string') return null;
  try {
    const payload = jwt.verify(token, secret());
    if (payload?.typ !== TOKEN_TYPE) return null;
    if (!payload.interviewId) return null;
    return payload;
  } catch {
    return null;
  }
}
