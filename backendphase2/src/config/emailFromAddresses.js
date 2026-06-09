/**
 * Per-trigger Resend/SMTP "from" addresses for HRYANTRA notifications.
 * Set mailboxes in .env (EMAIL_FROM_AUTH, EMAIL_FROM_WELCOME, …).
 * Hardcoded defaults apply only when an env var is missing (local dev).
 */

const MAILBOX_ENV_KEYS = {
  auth: 'EMAIL_FROM_AUTH',
  welcome: 'EMAIL_FROM_WELCOME',
  team: 'EMAIL_FROM_TEAM',
  operations: 'EMAIL_FROM_OPERATIONS',
  careers: 'EMAIL_FROM_CAREERS',
  employers: 'EMAIL_FROM_EMPLOYERS',
  billing: 'EMAIL_FROM_BILLING',
};

const MAILBOX_DEFAULTS = {
  auth: 'auth@hryantra.com',
  welcome: 'welcome@hryantra.com',
  team: 'team@hryantra.com',
  operations: 'operations@hryantra.com',
  careers: 'careers@hryantra.com',
  employers: 'employers@hryantra.com',
  billing: 'billing@hryantra.com',
};

/** @type {Record<string, keyof typeof MAILBOX_DEFAULTS>} */
export const TRIGGER_FROM_MAILBOX = {
  'auth.otp_verification': 'auth',
  'auth.welcome_email': 'welcome',
  'team.invite_email': 'team',
  'lead.assignment_email': 'operations',
  'lead.followup_email': 'operations',
  'client.assignment_email': 'operations',
  'client.followup_email': 'employers',
  'job.assignment_email': 'operations',
  'job.closed_email': 'operations',
  'candidate.assignment_email': 'operations',
  'interview.panel_scheduled': 'operations',
  'interview.candidate_scheduled': 'careers',
  'candidate.rejected_email': 'careers',
  'candidate.hired_email': 'careers',
  'offer.released_email': 'careers',
  'placement.joining_scheduled_candidate': 'careers',
  'placement.joining_scheduled_reporting': 'careers',
  'placement.confirmed_email': 'careers',
  'match.submission_email': 'employers',
  'billing.invoice_email': 'billing',
  'session.transfer': 'operations',
  'interview.legacy_smtp': 'operations',
};

function resolveMailboxAddress(mailboxKey) {
  const envKey = MAILBOX_ENV_KEYS[mailboxKey];
  const fromEnv = envKey ? String(process.env[envKey] || '').trim() : '';
  if (fromEnv) return fromEnv;
  return MAILBOX_DEFAULTS[mailboxKey] || '';
}

function formatFromAddress(email) {
  const trimmed = String(email || '').trim();
  if (!trimmed) return trimmed;
  if (trimmed.includes('<')) return trimmed;
  return `HRYANTRA <${trimmed}>`;
}

function globalFallbackFrom() {
  return (
    process.env.EMAIL_FROM_OPERATIONS ||
    process.env.RESEND_FROM_EMAIL ||
    process.env.EMAIL_FROM ||
    process.env.FROM_EMAIL ||
    MAILBOX_DEFAULTS.operations ||
    'onboarding@resend.dev'
  );
}

/** Expose resolved mailbox addresses (env first, then defaults). */
export function getMailboxAddresses() {
  return Object.fromEntries(
    Object.keys(MAILBOX_ENV_KEYS).map((key) => [key, resolveMailboxAddress(key)]),
  );
}

/**
 * Resolve the "from" address for a notification trigger (or pseudo-trigger).
 * @param {string | null | undefined} triggerId
 */
export function getEmailFromForTrigger(triggerId) {
  const id = String(triggerId || '').trim();
  const mailboxKey = TRIGGER_FROM_MAILBOX[id];
  if (mailboxKey) {
    const address = resolveMailboxAddress(mailboxKey);
    if (address) return formatFromAddress(address);
  }
  return formatFromAddress(globalFallbackFrom());
}

export function getDefaultEmailFrom() {
  return formatFromAddress(globalFallbackFrom());
}
