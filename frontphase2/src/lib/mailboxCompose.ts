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
}): { subject: string; body: string } {
  const names = opts.candidateNames.filter(Boolean);
  const jobTitle = String(opts.jobTitle || '').trim();
  const who =
    names.length === 0
      ? 'a candidate'
      : names.length === 1
        ? names[0]!
        : `${names[0]} and ${names.length - 1} more candidate${names.length - 1 === 1 ? '' : 's'}`;
  const role = jobTitle ? ` for ${jobTitle}` : '';
  return {
    subject: jobTitle ? `Candidate review: ${who} — ${jobTitle}` : `Candidate review: ${who}`,
    body: [
      `Please review ${who}${role}.`,
      '',
      'Open this secure preview link to see the profile:',
      opts.reviewUrl,
      '',
      'This preview includes only the fields marked Visible in Submit to Client settings.',
    ].join('\n'),
  };
}

export function buildMailboxComposeUrl(opts: {
  provider: MailboxComposeProvider;
  to?: string;
  subject: string;
  body: string;
}): string {
  const to = String(opts.to || '').trim();
  if (opts.provider === 'outlook') {
    const params = new URLSearchParams();
    if (to) params.set('to', to);
    params.set('subject', opts.subject);
    params.set('body', opts.body);
    return `https://outlook.office.com/mail/deeplink/compose?${params.toString()}`;
  }
  const params = new URLSearchParams({
    view: 'cm',
    fs: '1',
    tf: '1',
  });
  if (to) params.set('to', to);
  params.set('su', opts.subject);
  params.set('body', opts.body);
  return `https://mail.google.com/mail/?${params.toString()}`;
}

export function openMailboxComposeTab(url: string): boolean {
  if (typeof window === 'undefined') return false;
  const opened = window.open(url, '_blank', 'noopener,noreferrer');
  return Boolean(opened);
}
