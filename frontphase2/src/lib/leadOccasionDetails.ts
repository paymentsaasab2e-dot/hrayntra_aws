export const LEAD_OCCASION_DETAIL_LABELS = {
  birthday: 'Birthday',
  birthdayName: 'Birthday Name',
  birthdayEmail: 'Birthday Email',
  anniversary: 'Anniversary',
  anniversaryName: 'Anniversary Name',
  anniversaryEmail: 'Anniversary Email',
  specialOccasion: 'Special Occasion',
  specialOccasionName: 'Special Occasion Name',
  specialOccasionEmail: 'Special Occasion Email',
} as const;

const LEGACY_OCCASION_LABEL_SET = new Set<string>(Object.values(LEAD_OCCASION_DETAIL_LABELS));

const EVENT_NAME_RE = /^Event\s+(\d+)\s+Name$/i;
const EVENT_DATE_RE = /^Event\s+(\d+)\s+Date$/i;
const EVENT_REMINDER_RE = /^Event\s+(\d+)\s+Reminder$/i;
const EVENT_EMAIL_RE = /^Event\s+(\d+)\s+Email$/i;
const EVENT_PERSON_RE = /^Event\s+(\d+)\s+Person$/i;

export const LEAD_OCCASION_REMINDER_OPTIONS = [
  'No reminder',
  'On the day',
  '1 day before',
  '3 days before',
  '1 week before',
] as const;

export type LeadOccasionEventRow = {
  id: string;
  eventName: string;
  date: string;
  reminder: string;
  contactId: string;
  name: string;
  email: string;
};

/** @deprecated kept for older call sites; prefer events[] */
export type LeadOccasionPersonFields = {
  date: string;
  contactId: string;
  name: string;
  email: string;
  reminder?: string;
  eventName?: string;
};

export type LeadOccasionFormValues = {
  events: LeadOccasionEventRow[];
};

export type LeadOccasionContactOption = {
  id: string;
  name: string;
  email: string;
};

export function emptyLeadOccasionPerson(): LeadOccasionPersonFields {
  return { date: '', contactId: '', name: '', email: '', reminder: 'No reminder', eventName: '' };
}

export function createLeadOccasionEventRow(
  patch?: Partial<LeadOccasionEventRow>,
): LeadOccasionEventRow {
  return {
    id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    eventName: '',
    date: '',
    reminder: 'No reminder',
    contactId: '',
    name: '',
    email: '',
    ...patch,
  };
}

export function emptyLeadOccasionForm(): LeadOccasionFormValues {
  return { events: [] };
}

export function isLeadOccasionDetailLabel(label?: string | null): boolean {
  const text = String(label ?? '').trim();
  if (!text) return false;
  if (LEGACY_OCCASION_LABEL_SET.has(text)) return true;
  return (
    EVENT_NAME_RE.test(text) ||
    EVENT_DATE_RE.test(text) ||
    EVENT_REMINDER_RE.test(text) ||
    EVENT_EMAIL_RE.test(text) ||
    EVENT_PERSON_RE.test(text)
  );
}

function readMapValue(byLabel: Map<string, string>, label: string): string {
  return byLabel.get(label) || '';
}

function personToEvent(
  eventName: string,
  date: string,
  name: string,
  email: string,
  reminder = 'No reminder',
): LeadOccasionEventRow | null {
  if (!date && !name && !email && !eventName) return null;
  return createLeadOccasionEventRow({
    eventName,
    date,
    name,
    email,
    reminder: reminder || 'No reminder',
    contactId: name || email ? `stored:${name}|${email}` : '',
  });
}

export function readLeadOccasionFromOtherDetails(
  otherDetails?: Array<{ label: string; value: string }> | null,
): LeadOccasionFormValues {
  const byLabel = new Map(
    (otherDetails ?? []).map((item) => [
      String(item.label || '').trim(),
      String(item.value || '').trim(),
    ]),
  );

  const indexed = new Map<
    number,
    Partial<Pick<LeadOccasionEventRow, 'eventName' | 'date' | 'reminder' | 'email' | 'name'>>
  >();

  for (const [label, value] of byLabel.entries()) {
    let match = label.match(EVENT_NAME_RE);
    if (match) {
      const idx = Number(match[1]);
      indexed.set(idx, { ...(indexed.get(idx) || {}), eventName: value });
      continue;
    }
    match = label.match(EVENT_DATE_RE);
    if (match) {
      const idx = Number(match[1]);
      indexed.set(idx, { ...(indexed.get(idx) || {}), date: value });
      continue;
    }
    match = label.match(EVENT_REMINDER_RE);
    if (match) {
      const idx = Number(match[1]);
      indexed.set(idx, { ...(indexed.get(idx) || {}), reminder: value });
      continue;
    }
    match = label.match(EVENT_EMAIL_RE);
    if (match) {
      const idx = Number(match[1]);
      indexed.set(idx, { ...(indexed.get(idx) || {}), email: value });
      continue;
    }
    match = label.match(EVENT_PERSON_RE);
    if (match) {
      const idx = Number(match[1]);
      indexed.set(idx, { ...(indexed.get(idx) || {}), name: value });
    }
  }

  const events: LeadOccasionEventRow[] = [...indexed.entries()]
    .sort(([a], [b]) => a - b)
    .map(([, row]) =>
      createLeadOccasionEventRow({
        eventName: row.eventName || '',
        date: row.date || '',
        reminder: row.reminder || 'No reminder',
        email: row.email || '',
        name: row.name || '',
        contactId:
          row.name || row.email ? `stored:${row.name || ''}|${row.email || ''}` : '',
      }),
    )
    .filter((row) => row.eventName || row.date || row.email || row.name || row.reminder !== 'No reminder');

  if (events.length > 0) {
    return { events };
  }

  // Legacy birthday / anniversary / special occasion → event rows
  const legacy = [
    personToEvent(
      'Birthday',
      readMapValue(byLabel, LEAD_OCCASION_DETAIL_LABELS.birthday),
      readMapValue(byLabel, LEAD_OCCASION_DETAIL_LABELS.birthdayName),
      readMapValue(byLabel, LEAD_OCCASION_DETAIL_LABELS.birthdayEmail),
    ),
    personToEvent(
      'Anniversary',
      readMapValue(byLabel, LEAD_OCCASION_DETAIL_LABELS.anniversary),
      readMapValue(byLabel, LEAD_OCCASION_DETAIL_LABELS.anniversaryName),
      readMapValue(byLabel, LEAD_OCCASION_DETAIL_LABELS.anniversaryEmail),
    ),
    personToEvent(
      'Special Occasion',
      readMapValue(byLabel, LEAD_OCCASION_DETAIL_LABELS.specialOccasion),
      readMapValue(byLabel, LEAD_OCCASION_DETAIL_LABELS.specialOccasionName),
      readMapValue(byLabel, LEAD_OCCASION_DETAIL_LABELS.specialOccasionEmail),
    ),
  ].filter(Boolean) as LeadOccasionEventRow[];

  return { events: legacy };
}

export function stripLeadOccasionLabels(
  otherDetails?: Array<{ label: string; value: string }> | null,
): Array<{ label: string; value: string }> {
  return (otherDetails ?? []).filter((item) => !isLeadOccasionDetailLabel(item.label));
}

export function mergeOccasionIntoOtherDetails(
  existing: Array<{ label: string; value: string }> | undefined,
  occasions: LeadOccasionFormValues,
): Array<{ label: string; value: string }> | undefined {
  const entries = [...stripLeadOccasionLabels(existing)];
  const events = Array.isArray(occasions?.events) ? occasions.events : [];

  events.forEach((event, index) => {
    const n = index + 1;
    const eventName = String(event?.eventName ?? '').trim();
    const date = String(event?.date ?? '').trim();
    const reminder = String(event?.reminder ?? '').trim();
    const email = String(event?.email ?? '').trim();
    const name = String(event?.name ?? '').trim();
    if (!eventName && !date && !email && !name && (!reminder || reminder === 'No reminder')) {
      return;
    }
    if (eventName) entries.push({ label: `Event ${n} Name`, value: eventName });
    if (date) entries.push({ label: `Event ${n} Date`, value: date });
    if (reminder && reminder !== 'No reminder') {
      entries.push({ label: `Event ${n} Reminder`, value: reminder });
    }
    if (name) entries.push({ label: `Event ${n} Person`, value: name });
    if (email) entries.push({ label: `Event ${n} Email`, value: email });
  });

  return entries.length ? entries : undefined;
}

export function buildLeadOccasionContactOptions(input: {
  directorName?: string;
  directorEmail?: string;
  directorEmails?: string[];
  teamMembers?: Array<{
    teamMemberName?: string;
    teamMemberDesignation?: string;
    teamMemberEmail?: string;
  } | null | undefined>;
}): LeadOccasionContactOption[] {
  const options: LeadOccasionContactOption[] = [];
  const seen = new Set<string>();

  const push = (id: string, name: string, email: string) => {
    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    if (!trimmedName && !trimmedEmail) return;
    const key = `${trimmedName.toLowerCase()}|${trimmedEmail.toLowerCase()}`;
    if (seen.has(key)) return;
    seen.add(key);
    options.push({
      id,
      name: trimmedName || trimmedEmail,
      email: trimmedEmail,
    });
  };

  const directorName = String(input.directorName || '').trim();
  const directorEmails = [
    ...(Array.isArray(input.directorEmails) ? input.directorEmails : []),
    input.directorEmail || '',
  ]
    .map((value) => String(value || '').trim())
    .filter(Boolean);

  if (directorEmails.length > 0) {
    directorEmails.forEach((email, index) => {
      push(`director:${index}:${email}`, directorName || email, email);
    });
  } else if (directorName) {
    push('director:0', directorName, '');
  }

  (input.teamMembers || []).forEach((member, index) => {
    if (!member) return;
    const name = String(member.teamMemberName || member.teamMemberDesignation || '').trim();
    const email = String(member.teamMemberEmail || '').trim();
    push(`team:${index}:${email || name}`, name || email, email);
  });

  return options;
}

export function formatOccasionPersonDisplay(person?: LeadOccasionPersonFields | LeadOccasionEventRow): string {
  if (!person) return '';
  const eventName = 'eventName' in person ? person.eventName : '';
  const reminder = 'reminder' in person ? person.reminder : '';
  const parts = [eventName, person.date, reminder && reminder !== 'No reminder' ? reminder : '', person.name, person.email]
    .map((part) => String(part || '').trim())
    .filter(Boolean);
  return parts.join(' · ');
}

export function formatOccasionEventDisplay(event?: LeadOccasionEventRow): string {
  return formatOccasionPersonDisplay(event);
}
