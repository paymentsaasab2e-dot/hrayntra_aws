/**
 * Phase 1 (job portal) email "from" addresses.
 * Set EMAIL_FROM_AUTH in .env (OTP / verification).
 * Set EMAIL_FROM_JOBS in .env (job match / recommendation alerts).
 */

function formatFromAddress(email, displayName = 'HRYANTRA') {
  const trimmed = String(email || '').trim();
  if (!trimmed) return trimmed;
  if (trimmed.includes('<')) return trimmed;
  const label = String(displayName || 'HRYANTRA').trim() || 'HRYANTRA';
  return `${label} <${trimmed}>`;
}

const DEFAULT_AUTH_FROM = 'auth@hryantra.com';
const DEFAULT_JOBS_FROM = 'job@hryantra.com';

function resolveAuthFrom() {
  return (
    String(process.env.EMAIL_FROM_AUTH || '').trim() ||
    String(process.env.RESEND_FROM_EMAIL || '').trim() ||
    DEFAULT_AUTH_FROM
  );
}

function resolveJobsFrom() {
  return String(process.env.EMAIL_FROM_JOBS || '').trim() || DEFAULT_JOBS_FROM;
}

/**
 * @param {string} [triggerId]
 */
function getEmailFromForTrigger(triggerId) {
  const id = String(triggerId || 'auth.otp_verification').trim();
  if (id === 'job.recommendation') {
    const jobsLabel =
      String(process.env.EMAIL_FROM_JOBS_NAME || '').trim() || 'HRYANTRA Jobs';
    return formatFromAddress(resolveJobsFrom(), jobsLabel);
  }
  if (id === 'auth.otp_verification') {
    return formatFromAddress(resolveAuthFrom());
  }
  return formatFromAddress(resolveAuthFrom());
}

module.exports = {
  getEmailFromForTrigger,
};
