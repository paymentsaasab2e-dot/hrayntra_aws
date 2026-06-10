/**
 * Phase 1 (job portal) email "from" addresses.
 * Set EMAIL_FROM_AUTH in .env (OTP / verification).
 */

function formatFromAddress(email) {
  const trimmed = String(email || '').trim();
  if (!trimmed) return trimmed;
  if (trimmed.includes('<')) return trimmed;
  return `HRYANTRA <${trimmed}>`;
}

const DEFAULT_AUTH_FROM = 'auth@hryantra.com';

function resolveAuthFrom() {
  return (
    String(process.env.EMAIL_FROM_AUTH || '').trim() ||
    String(process.env.RESEND_FROM_EMAIL || '').trim() ||
    DEFAULT_AUTH_FROM
  );
}

/**
 * @param {string} [triggerId]
 */
function getEmailFromForTrigger(triggerId) {
  const id = String(triggerId || 'auth.otp_verification').trim();
  if (id === 'auth.otp_verification') {
    return formatFromAddress(resolveAuthFrom());
  }
  return formatFromAddress(resolveAuthFrom());
}

module.exports = {
  getEmailFromForTrigger,
};
