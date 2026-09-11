import {
  applySubmitToClientMailTemplate,
  getDefaultSubmitToClientMailTemplate,
} from './submitToClientMailTemplate';
import { plainTextToEmailHtml } from './emailLinkify';

export type MailboxComposeProvider = 'gmail' | 'outlook';

export type MailboxConnectionStatus = {
  gmail?: { connected?: boolean; email?: string };
  outlook?: { connected?: boolean; email?: string };
};

export function connectedMailboxProviders(
  status: MailboxConnectionStatus | null | undefined,
): MailboxComposeProvider[] {
  const connected: MailboxComposeProvider[] = [];
  if (status?.gmail?.connected) connected.push('gmail');
  if (status?.outlook?.connected) connected.push('outlook');
  return connected;
}

export function connectedMailboxEmail(
  status: MailboxConnectionStatus | null | undefined,
  provider: MailboxComposeProvider,
): string {
  const email =
    provider === 'gmail'
      ? String(status?.gmail?.email || '').trim()
      : String(status?.outlook?.email || '').trim();
  return email;
}

export function preferredMailboxProvider(
  connected: MailboxComposeProvider[],
): MailboxComposeProvider | null {
  if (!connected.length) return null;
  if (connected.length === 1) return connected[0]!;
  if (typeof window === 'undefined') return connected[0]!;
  const stored = window.sessionStorage.getItem('inbox_mail_provider');
  if (stored === 'gmail' || stored === 'outlook') {
    if (connected.includes(stored)) return stored;
  }
  return connected[0]!;
}

export function buildSubmitToClientMailCopy(opts: {
  reviewUrl: string;
  candidateNames: string[];
  jobTitle?: string;
  clientEmail?: string;
  clientName?: string;
  /** When set, use this template; otherwise the Settings default template. */
  template?: { subject: string; body: string } | null;
}): { subject: string; body: string } {
  const names = opts.candidateNames.filter(Boolean);
  const who =
    names.length === 0
      ? 'a candidate'
      : names.length === 1
        ? names[0]!
        : `${names[0]} and ${names.length - 1} more candidate${names.length - 1 === 1 ? '' : 's'}`;

  const template =
    opts.template ||
    (typeof window !== 'undefined' ? getDefaultSubmitToClientMailTemplate() : null);

  if (template) {
    return applySubmitToClientMailTemplate(template, {
      candidateName: names[0] || who,
      candidateNames: who,
      jobTitle: opts.jobTitle,
      reviewUrl: opts.reviewUrl,
      clientEmail: opts.clientEmail,
      clientName: opts.clientName,
      companyName: opts.clientName,
    });
  }

  const jobTitle = String(opts.jobTitle || '').trim();
  const role = jobTitle ? ` for ${jobTitle}` : '';
  return {
    subject: jobTitle ? `Candidate review: ${who} — ${jobTitle}` : `Candidate review: ${who}`,
    body: [
      `Please review ${who}${role}.`,
      '',
      'Open this secure preview link to see the profile:',
      // Keep the full URL on its own line so Gmail/Outlook auto-linkify it.
      String(opts.reviewUrl || '').trim(),
      '',
      'This preview includes only the fields marked Visible in Submit to Client settings.',
    ].join('\n'),
  };
}

/** HTML body for Graph / rich send (clickable preview links). */
export function buildSubmitToClientMailHtml(body: string): string {
  return plainTextToEmailHtml(body);
}

/**
 * Gmail / Outlook compose URLs must use %20 for spaces.
 * URLSearchParams uses `+`, which those apps often show as literal plus signs.
 */
function buildComposeQuery(params: Record<string, string>): string {
  return Object.entries(params)
    .filter(([, value]) => value !== '')
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&');
}

export function buildMailboxComposeUrl(opts: {
  provider: MailboxComposeProvider;
  to?: string;
  subject: string;
  body: string;
  /** Connected inbox email — prefer this account when the browser already has it signed in. */
  accountEmail?: string;
}): string {
  const to = String(opts.to || '').trim();
  const subject = String(opts.subject || '').trim();
  const accountEmail = String(opts.accountEmail || '').trim();
  // Outlook/Gmail compose handles \r\n more reliably than bare \n.
  const body = String(opts.body || '').replace(/\r?\n/g, '\r\n');

  if (opts.provider === 'outlook') {
    // Fallback only (preferred path creates a Graph draft). Avoid office.com for
    // personal @outlook.com — it forces prompt=select_account without an OWA SSO cookie.
    const query = buildComposeQuery({
      ...(to ? { to } : {}),
      subject,
      body,
    });
    const personal = /@(outlook|hotmail|live|msn)\.com$/i.test(accountEmail);
    if (personal) {
      return `https://outlook.live.com/owa/?path=/mail/action/compose&${query}`;
    }
    return `https://outlook.office.com/mail/deeplink/compose?popoutv2=1&${query}`;
  }

  // Gmail: authuser switches among already-signed-in Google sessions.
  // Avoid AccountChooser — it also forces an interactive account/sign-in screen.
  const composeQuery = buildComposeQuery({
    view: 'cm',
    fs: '1',
    tf: '1',
    ...(accountEmail ? { authuser: accountEmail } : {}),
    ...(to ? { to } : {}),
    su: subject,
    body,
  });
  return `https://mail.google.com/mail/?${composeQuery}`;
}

export function openMailboxComposeTab(url: string): boolean {
  if (typeof window === 'undefined') return false;
  const opened = window.open(url, '_blank', 'noopener,noreferrer');
  return Boolean(opened);
}

export const INBOX_COMPOSE_DRAFT_KEY = 'inbox_compose_draft';

export type InboxComposeDraft = {
  provider: MailboxComposeProvider;
  to?: string;
  subject: string;
  body: string;
  /** Cross-tab id — sessionStorage is not shared between tabs. */
  id?: string;
};

/** Survives React Strict Mode remounts within the Inbox tab. */
let lastComposeDraftCache: InboxComposeDraft | null = null;

function newComposeDraftId(): string {
  return `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Stash compose fields for the Inbox in-app composer.
 * Uses localStorage so a newly opened Inbox tab can read it (sessionStorage cannot).
 */
export function stashInboxComposeDraft(draft: InboxComposeDraft): string {
  const id = newComposeDraftId();
  const payload: InboxComposeDraft = {
    id,
    provider: draft.provider,
    to: String(draft.to || '').trim(),
    subject: String(draft.subject || ''),
    body: String(draft.body || ''),
  };
  lastComposeDraftCache = payload;
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(INBOX_COMPOSE_DRAFT_KEY, JSON.stringify(payload));
  }
  return id;
}

export function readInboxComposeDraft(draftId?: string | null): InboxComposeDraft | null {
  const wanted = String(draftId || '').trim();

  if (lastComposeDraftCache) {
    if (!wanted || lastComposeDraftCache.id === wanted) {
      return lastComposeDraftCache;
    }
  }

  if (typeof window === 'undefined') return null;

  const raw =
    window.localStorage.getItem(INBOX_COMPOSE_DRAFT_KEY) ||
    window.sessionStorage.getItem(INBOX_COMPOSE_DRAFT_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as InboxComposeDraft;
    if (parsed?.provider !== 'gmail' && parsed?.provider !== 'outlook') return null;
    const draft: InboxComposeDraft = {
      id: String(parsed.id || '').trim() || undefined,
      provider: parsed.provider,
      to: String(parsed.to || '').trim(),
      subject: String(parsed.subject || ''),
      body: String(parsed.body || ''),
    };
    if (wanted && draft.id && draft.id !== wanted) return null;
    lastComposeDraftCache = draft;
    return draft;
  } catch {
    return null;
  }
}

/** Remove persisted draft only — keep memory cache for React remounts in the Inbox tab. */
export function clearInboxComposeDraftStorage(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(INBOX_COMPOSE_DRAFT_KEY);
  window.sessionStorage.removeItem(INBOX_COMPOSE_DRAFT_KEY);
}

export function clearInboxComposeDraft(): void {
  lastComposeDraftCache = null;
  clearInboxComposeDraftStorage();
}

export function buildInboxComposePath(
  provider: MailboxComposeProvider,
  draftId?: string,
): string {
  const id = String(draftId || '').trim();
  const qs = new URLSearchParams({ mailbox: provider, compose: '1' });
  if (id) qs.set('draft', id);
  return `/inbox?${qs.toString()}`;
}
