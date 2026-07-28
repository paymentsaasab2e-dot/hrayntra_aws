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

const OCCASION_LABEL_SET = new Set<string>(Object.values(LEAD_OCCASION_DETAIL_LABELS));

export type LeadOccasionPersonFields = {
  date: string;
  contactId: string;
  name: string;
  email: string;
};

export type LeadOccasionFormValues = {
  birthday: LeadOccasionPersonFields;
  anniversary: LeadOccasionPersonFields;
  specialOccasion: LeadOccasionPersonFields;
};

export type LeadOccasionContactOption = {
  id: string;
  name: string;
  email: string;
};

export function emptyLeadOccasionPerson(): LeadOccasionPersonFields {
  return { date: '', contactId: '', name: '', email: '' };
}

export function emptyLeadOccasionForm(): LeadOccasionFormValues {
  return {
    birthday: emptyLeadOccasionPerson(),
    anniversary: emptyLeadOccasionPerson(),
    specialOccasion: emptyLeadOccasionPerson(),
  };
}

export function isLeadOccasionDetailLabel(label?: string | null): boolean {
  return OCCASION_LABEL_SET.has(String(label ?? '').trim());
}

function readMapValue(
  byLabel: Map<string, string>,
  label: string,
): string {
  return byLabel.get(label) || '';
}

function personFromLabels(
  byLabel: Map<string, string>,
  dateLabel: string,
  nameLabel: string,
  emailLabel: string,
): LeadOccasionPersonFields {
  const date = readMapValue(byLabel, dateLabel);
  const name = readMapValue(byLabel, nameLabel);
  const email = readMapValue(byLabel, emailLabel);
  return {
    date,
    name,
    email,
    contactId: name || email ? `stored:${name}|${email}` : '',
  };
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

  return {
    birthday: personFromLabels(
      byLabel,
      LEAD_OCCASION_DETAIL_LABELS.birthday,
      LEAD_OCCASION_DETAIL_LABELS.birthdayName,
      LEAD_OCCASION_DETAIL_LABELS.birthdayEmail,
    ),
    anniversary: personFromLabels(
      byLabel,
      LEAD_OCCASION_DETAIL_LABELS.anniversary,
      LEAD_OCCASION_DETAIL_LABELS.anniversaryName,
      LEAD_OCCASION_DETAIL_LABELS.anniversaryEmail,
    ),
    specialOccasion: personFromLabels(
      byLabel,
      LEAD_OCCASION_DETAIL_LABELS.specialOccasion,
      LEAD_OCCASION_DETAIL_LABELS.specialOccasionName,
      LEAD_OCCASION_DETAIL_LABELS.specialOccasionEmail,
    ),
  };
}

export function stripLeadOccasionLabels(
  otherDetails?: Array<{ label: string; value: string }> | null,
): Array<{ label: string; value: string }> {
  return (otherDetails ?? []).filter((item) => !isLeadOccasionDetailLabel(item.label));
}

function pushPerson(
  entries: Array<{ label: string; value: string }>,
  dateLabel: string,
  nameLabel: string,
  emailLabel: string,
  person?: LeadOccasionPersonFields,
) {
  const date = String(person?.date ?? '').trim();
  const name = String(person?.name ?? '').trim();
  const email = String(person?.email ?? '').trim();
  if (!date && !name && !email) return;
  if (date) entries.push({ label: dateLabel, value: date });
  if (name) entries.push({ label: nameLabel, value: name });
  if (email) entries.push({ label: emailLabel, value: email });
}

export function mergeOccasionIntoOtherDetails(
  existing: Array<{ label: string; value: string }> | undefined,
  occasions: LeadOccasionFormValues,
): Array<{ label: string; value: string }> | undefined {
  const entries = [...stripLeadOccasionLabels(existing)];

  pushPerson(
    entries,
    LEAD_OCCASION_DETAIL_LABELS.birthday,
    LEAD_OCCASION_DETAIL_LABELS.birthdayName,
    LEAD_OCCASION_DETAIL_LABELS.birthdayEmail,
    occasions.birthday,
  );
  pushPerson(
    entries,
    LEAD_OCCASION_DETAIL_LABELS.anniversary,
    LEAD_OCCASION_DETAIL_LABELS.anniversaryName,
    LEAD_OCCASION_DETAIL_LABELS.anniversaryEmail,
    occasions.anniversary,
  );
  pushPerson(
    entries,
    LEAD_OCCASION_DETAIL_LABELS.specialOccasion,
    LEAD_OCCASION_DETAIL_LABELS.specialOccasionName,
    LEAD_OCCASION_DETAIL_LABELS.specialOccasionEmail,
    occasions.specialOccasion,
  );

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

export function formatOccasionPersonDisplay(person?: LeadOccasionPersonFields): string {
  if (!person) return '';
  const parts = [person.date, person.name, person.email].map((part) => String(part || '').trim()).filter(Boolean);
  return parts.join(' · ');
}
