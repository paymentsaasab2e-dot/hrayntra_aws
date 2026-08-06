import type {
  DrawerAnalysisResult,
  MissingFieldIssue,
  OverdueMeetingIssue,
  TenantOverdueScanResult,
} from './types';

function trim(value: unknown): string {
  return String(value ?? '').trim();
}

function primaryFromList(list: unknown, fallback?: unknown): string {
  if (Array.isArray(list)) {
    for (const item of list) {
      const v = trim(item);
      if (v) return v;
    }
  }
  return trim(fallback);
}

export function isDateOverdue(iso?: string | null): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return false;
  return d.getTime() < Date.now();
}

function leadContactName(lead: Record<string, unknown>): string {
  return (
    trim(lead.directorName) ||
    trim(lead.contactPerson) ||
    trim(lead.contactName) ||
    ''
  );
}

function leadDisplayName(lead: Record<string, unknown>): string {
  return trim(lead.companyName) || leadContactName(lead) || 'Lead';
}

function clientDisplayName(client: Record<string, unknown>): string {
  return trim(client.companyName) || trim(client.name) || 'Client';
}

/** Analyze a lead drawer record for missing mandatory fields + overdue follow-up. */
export function analyzeLeadDrawer(lead: Record<string, unknown> | null | undefined): DrawerAnalysisResult | null {
  if (!lead || !trim(lead.id)) return null;

  const missingFields: MissingFieldIssue[] = [];
  const companyName = trim(lead.companyName);
  const contactPerson = leadContactName(lead);
  const email = primaryFromList(lead.emails, lead.email);
  const phone = primaryFromList(lead.phones, lead.phone);
  const emailNA = Boolean(lead.emailNotAvailable);
  const phoneNA = Boolean(lead.phoneNotAvailable);

  if (!companyName) {
    missingFields.push({
      field: 'companyName',
      label: 'Company',
      message: 'Company name is required',
    });
  }
  if (!contactPerson) {
    missingFields.push({
      field: 'contactPerson',
      label: 'Director / Contact',
      message: 'Director name is required',
    });
  }
  if ((emailNA && phoneNA) || (!email && !phone)) {
    missingFields.push({
      field: 'contact',
      label: 'Email or Phone',
      message: 'Provide email or mobile number (at least one)',
    });
  }

  const status = trim(lead.status).toLowerCase();
  const skipFollowUp = status === 'converted' || status === 'lost' || status === 'won';
  const overdueMeetings: OverdueMeetingIssue[] = [];
  const nextFollowUp = trim(lead.nextFollowUp) || trim(lead.nextFollowUpAt);
  if (!skipFollowUp && isDateOverdue(nextFollowUp)) {
    overdueMeetings.push({
      id: `lead-fu-${trim(lead.id)}`,
      title: `${trim(lead.followUpType) || 'Follow-up'} with ${leadDisplayName(lead)}`,
      at: nextFollowUp,
      kind: 'followup',
      entityKind: 'lead',
      entityId: trim(lead.id),
      entityName: leadDisplayName(lead),
    });
  }

  return {
    entityKind: 'lead',
    entityId: trim(lead.id),
    entityName: leadDisplayName(lead),
    missingFields,
    overdueMeetings,
  };
}

/** Analyze a client drawer record for missing mandatory fields + overdue follow-up/meetings. */
export function analyzeClientDrawer(
  client: Record<string, unknown> | null | undefined,
  meetings?: Array<Record<string, unknown>> | null,
): DrawerAnalysisResult | null {
  if (!client || !trim(client.id)) return null;

  const missingFields: MissingFieldIssue[] = [];
  if (!trim(client.companyName)) {
    missingFields.push({
      field: 'companyName',
      label: 'Company',
      message: 'Company name is required',
    });
  }

  const overdueMeetings: OverdueMeetingIssue[] = [];
  const nextFollowUpDue = trim(client.nextFollowUpDue) || trim(client.nextFollowUp);
  if (isDateOverdue(nextFollowUpDue)) {
    overdueMeetings.push({
      id: `client-fu-${trim(client.id)}`,
      title: `Follow-up with ${clientDisplayName(client)}`,
      at: nextFollowUpDue,
      kind: 'followup',
      entityKind: 'client',
      entityId: trim(client.id),
      entityName: clientDisplayName(client),
    });
  }

  for (const meeting of meetings || []) {
    const status = trim(meeting.status).toUpperCase();
    if (status !== 'SCHEDULED' && status !== 'RESCHEDULED') continue;
    const at = trim(meeting.scheduledAt);
    if (!isDateOverdue(at)) continue;
    overdueMeetings.push({
      id: `client-mtg-${trim(meeting.id) || at}`,
      title: `${trim(meeting.meetingType) || 'Meeting'} with ${clientDisplayName(client)}`,
      at,
      kind: 'meeting',
      entityKind: 'client',
      entityId: trim(client.id),
      entityName: clientDisplayName(client),
    });
  }

  return {
    entityKind: 'client',
    entityId: trim(client.id),
    entityName: clientDisplayName(client),
    missingFields,
    overdueMeetings,
  };
}

export function hasDrawerIssues(result: DrawerAnalysisResult | null | undefined): boolean {
  if (!result) return false;
  return result.missingFields.length > 0 || result.overdueMeetings.length > 0;
}

export function buildDrawerAlertMessage(result: DrawerAnalysisResult): string {
  const parts: string[] = [];
  const name = result.entityName || (result.entityKind === 'lead' ? 'this lead' : 'this client');

  if (result.missingFields.length) {
    const labels = result.missingFields.map((f) => f.label).join(', ');
    parts.push(
      `Missing mandatory data for ${name}:\n• ${result.missingFields.map((f) => f.message).join('\n• ')}\n\nPlease fill: ${labels}.`,
    );
  }

  if (result.overdueMeetings.length) {
    const lines = result.overdueMeetings.map((m) => {
      const when = new Date(m.at);
      const label = Number.isNaN(when.getTime())
        ? m.at
        : when.toLocaleString([], {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          });
      return `• ${m.title} (due ${label})`;
    });
    parts.push(
      `Overdue meeting${result.overdueMeetings.length === 1 ? '' : 's'} — please complete or reschedule:\n${lines.join('\n')}`,
    );
  }

  return parts.join('\n\n');
}

export function buildTenantOverdueAlertMessage(scan: TenantOverdueScanResult): string {
  const items = scan.overdueMeetings.slice(0, 8);
  const lines = items.map((m) => {
    const when = new Date(m.at);
    const label = Number.isNaN(when.getTime())
      ? m.at
      : when.toLocaleString([], {
          day: '2-digit',
          month: 'short',
          hour: '2-digit',
          minute: '2-digit',
        });
    return `• [${m.entityKind}] ${m.title} — ${label}`;
  });
  const extra =
    scan.overdueMeetings.length > items.length
      ? `\n…and ${scan.overdueMeetings.length - items.length} more`
      : '';
  return `You have ${scan.overdueMeetings.length} overdue meeting/follow-up${
    scan.overdueMeetings.length === 1 ? '' : 's'
  }. Please complete them:\n\n${lines.join('\n')}${extra}`;
}

/** Scan lead + client lists for overdue follow-ups (tenant-wide). */
export function scanTenantOverdueFromLists(input: {
  leads?: Array<Record<string, unknown>> | null;
  clients?: Array<Record<string, unknown>> | null;
}): TenantOverdueScanResult {
  const overdueMeetings: OverdueMeetingIssue[] = [];

  for (const lead of input.leads || []) {
    const analysis = analyzeLeadDrawer(lead);
    if (analysis?.overdueMeetings.length) overdueMeetings.push(...analysis.overdueMeetings);
  }
  for (const client of input.clients || []) {
    const analysis = analyzeClientDrawer(client);
    if (analysis?.overdueMeetings.length) overdueMeetings.push(...analysis.overdueMeetings);
  }

  overdueMeetings.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());

  return {
    overdueMeetings,
    scannedAt: new Date().toISOString(),
  };
}
