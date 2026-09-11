import type {
  DrawerAnalysisResult,
  MissingFieldIssue,
  OverdueMeetingIssue,
  TenantOverdueScanResult,
} from './types';

/** Upcoming window: due within the next 48 hours (inclusive of later today). */
export const UPCOMING_FOLLOW_UP_WINDOW_MS = 48 * 60 * 60 * 1000;

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

export function isDateUpcoming(
  iso?: string | null,
  withinMs: number = UPCOMING_FOLLOW_UP_WINDOW_MS,
): boolean {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return false;
  const now = Date.now();
  return t >= now && t <= now + withinMs;
}

/** True when this lead/client is assigned to (or created by) the given team member. */
export function isRecordAssignedToUser(
  record: Record<string, unknown> | null | undefined,
  userId?: string | null,
): boolean {
  const uid = trim(userId);
  if (!uid || !record) return false;
  if (trim(record.assignedToId) === uid) return true;
  if (Array.isArray(record.assignedToIds) && record.assignedToIds.some((id) => trim(id) === uid)) {
    return true;
  }
  if (trim(record.createdById) === uid) return true;
  if (
    Array.isArray(record.participantIds) &&
    record.participantIds.some((id) => trim(id) === uid)
  ) {
    return true;
  }
  return false;
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

/** Analyze a lead drawer record for missing mandatory fields + follow-up reminders. */
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
  const upcomingMeetings: OverdueMeetingIssue[] = [];
  const nextFollowUp = trim(lead.nextFollowUp) || trim(lead.nextFollowUpAt);
  if (!skipFollowUp && nextFollowUp) {
    const base = {
      id: `lead-fu-${trim(lead.id)}`,
      title: `${trim(lead.followUpType) || 'Follow-up'} with ${leadDisplayName(lead)}`,
      at: nextFollowUp,
      kind: 'followup' as const,
      entityKind: 'lead' as const,
      entityId: trim(lead.id),
      entityName: leadDisplayName(lead),
    };
    if (isDateOverdue(nextFollowUp)) {
      overdueMeetings.push({ ...base, urgency: 'overdue' });
    } else if (isDateUpcoming(nextFollowUp)) {
      upcomingMeetings.push({ ...base, urgency: 'upcoming' });
    }
  }

  return {
    entityKind: 'lead',
    entityId: trim(lead.id),
    entityName: leadDisplayName(lead),
    missingFields,
    overdueMeetings,
    upcomingMeetings,
  };
}

/** Analyze a client drawer record for missing mandatory fields + follow-up/meetings. */
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
  const upcomingMeetings: OverdueMeetingIssue[] = [];
  const nextFollowUpDue = trim(client.nextFollowUpDue) || trim(client.nextFollowUp);
  if (nextFollowUpDue) {
    const base = {
      id: `client-fu-${trim(client.id)}`,
      title: `Follow-up with ${clientDisplayName(client)}`,
      at: nextFollowUpDue,
      kind: 'followup' as const,
      entityKind: 'client' as const,
      entityId: trim(client.id),
      entityName: clientDisplayName(client),
    };
    if (isDateOverdue(nextFollowUpDue)) {
      overdueMeetings.push({ ...base, urgency: 'overdue' });
    } else if (isDateUpcoming(nextFollowUpDue)) {
      upcomingMeetings.push({ ...base, urgency: 'upcoming' });
    }
  }

  for (const meeting of meetings || []) {
    const status = trim(meeting.status).toUpperCase();
    if (status !== 'SCHEDULED' && status !== 'RESCHEDULED') continue;
    const at = trim(meeting.scheduledAt);
    if (!at) continue;
    const base = {
      id: `client-mtg-${trim(meeting.id) || at}`,
      title: `${trim(meeting.meetingType) || 'Meeting'} with ${clientDisplayName(client)}`,
      at,
      kind: 'meeting' as const,
      entityKind: 'client' as const,
      entityId: trim(client.id),
      entityName: clientDisplayName(client),
    };
    if (isDateOverdue(at)) {
      overdueMeetings.push({ ...base, urgency: 'overdue' });
    } else if (isDateUpcoming(at)) {
      upcomingMeetings.push({ ...base, urgency: 'upcoming' });
    }
  }

  return {
    entityKind: 'client',
    entityId: trim(client.id),
    entityName: clientDisplayName(client),
    missingFields,
    overdueMeetings,
    upcomingMeetings,
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
    parts.push(
      `Missing mandatory data for ${name}:\n• ${result.missingFields.map((f) => f.message).join('\n• ')}\n\nPlease fill: ${result.missingFields.map((f) => f.label).join(', ')}.`,
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

/**
 * Scan lead + client lists for overdue + upcoming follow-ups.
 * When `userId` is set, only records assigned to that team member are included.
 */
export function scanTenantOverdueFromLists(input: {
  leads?: Array<Record<string, unknown>> | null;
  clients?: Array<Record<string, unknown>> | null;
  userId?: string | null;
}): TenantOverdueScanResult {
  const overdueMeetings: OverdueMeetingIssue[] = [];
  const upcomingMeetings: OverdueMeetingIssue[] = [];
  const uid = trim(input.userId);

  for (const lead of input.leads || []) {
    if (uid && !isRecordAssignedToUser(lead, uid)) continue;
    const analysis = analyzeLeadDrawer(lead);
    if (analysis?.overdueMeetings.length) overdueMeetings.push(...analysis.overdueMeetings);
    if (analysis?.upcomingMeetings.length) upcomingMeetings.push(...analysis.upcomingMeetings);
  }
  for (const client of input.clients || []) {
    if (uid && !isRecordAssignedToUser(client, uid)) continue;
    const analysis = analyzeClientDrawer(client);
    if (analysis?.overdueMeetings.length) overdueMeetings.push(...analysis.overdueMeetings);
    if (analysis?.upcomingMeetings.length) upcomingMeetings.push(...analysis.upcomingMeetings);
  }

  overdueMeetings.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
  upcomingMeetings.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());

  return {
    overdueMeetings,
    upcomingMeetings,
    scannedAt: new Date().toISOString(),
  };
}
