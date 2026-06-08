export const TEAM_MEMBER_DETAIL_LABELS = {
  salutation: 'Team Member Salutation',
  name: 'Team Member Name',
  designation: 'Team Member Designation',
  email: 'Team Member Email',
  phone: 'Team Member Phone',
} as const;

const TEAM_MEMBER_LABEL_SET = new Set<string>(Object.values(TEAM_MEMBER_DETAIL_LABELS));

export type TeamMemberFormValues = {
  teamMemberSalutation?: string;
  teamMemberName?: string;
  teamMemberDesignation?: string;
  teamMemberEmail?: string;
  teamMemberPhone?: string;
};

export type TeamMemberListItem = TeamMemberFormValues & {
  id?: string;
};

const TEAM_MEMBER_FIELD_SUFFIX = {
  salutation: 'Salutation',
  name: 'Name',
  designation: 'Designation',
  email: 'Email',
  phone: 'Phone',
} as const;

const TEAM_MEMBER_NUMBERED_LABEL_REGEX =
  /^Team Member\s+(\d+)\s+(Salutation|Name|Designation|Email|Phone)$/i;

export function isTeamMemberDetailLabel(label?: string | null): boolean {
  const normalized = String(label ?? '').trim();
  return TEAM_MEMBER_LABEL_SET.has(normalized) || TEAM_MEMBER_NUMBERED_LABEL_REGEX.test(normalized);
}

export function createEmptyTeamMember(id?: string): TeamMemberListItem {
  return {
    id,
    teamMemberSalutation: '',
    teamMemberName: '',
    teamMemberDesignation: '',
    teamMemberEmail: '',
    teamMemberPhone: '',
  };
}

function normalizeTeamMemberItem(
  member?: TeamMemberListItem | null | undefined,
): TeamMemberListItem {
  const name =
    String(member?.teamMemberName ?? '').trim() ||
    String(member?.teamMemberDesignation ?? '').trim();
  return {
    id: member?.id,
    teamMemberSalutation: String(member?.teamMemberSalutation ?? ''),
    teamMemberName: name,
    teamMemberDesignation: name,
    teamMemberEmail: String(member?.teamMemberEmail ?? ''),
    teamMemberPhone: String(member?.teamMemberPhone ?? ''),
  };
}

export function normalizeTeamMemberList(
  members?: Array<TeamMemberListItem | null | undefined> | null,
): TeamMemberListItem[] {
  const normalized = (members ?? [])
    .filter(Boolean)
    .map((member) => normalizeTeamMemberItem(member));

  return normalized.length > 0 ? normalized : [createEmptyTeamMember()];
}

export function primaryTeamMemberFromList(
  members?: Array<TeamMemberListItem | null | undefined> | null,
): TeamMemberFormValues {
  const [first] = normalizeTeamMemberList(members);
  return {
    teamMemberSalutation: first?.teamMemberSalutation ?? '',
    teamMemberName: first?.teamMemberName ?? '',
    teamMemberDesignation: first?.teamMemberDesignation ?? '',
    teamMemberEmail: first?.teamMemberEmail ?? '',
    teamMemberPhone: first?.teamMemberPhone ?? '',
  };
}

export function hasTeamName(teamName?: string | null): boolean {
  return Boolean(String(teamName ?? '').trim());
}

export function parseTeamMemberFromOtherDetails(
  otherDetails?: Array<{ label: string; value: string }> | null,
): TeamMemberFormValues {
  const byLabel = new Map(
    (otherDetails ?? []).map((item) => [String(item.label || '').trim(), String(item.value || '').trim()]),
  );
  const name =
    byLabel.get(TEAM_MEMBER_DETAIL_LABELS.name) ||
    byLabel.get(TEAM_MEMBER_DETAIL_LABELS.designation) ||
    '';
  return {
    teamMemberSalutation: byLabel.get(TEAM_MEMBER_DETAIL_LABELS.salutation) || '',
    teamMemberName: name,
    teamMemberDesignation: name,
    teamMemberEmail: byLabel.get(TEAM_MEMBER_DETAIL_LABELS.email) || '',
    teamMemberPhone: byLabel.get(TEAM_MEMBER_DETAIL_LABELS.phone) || '',
  };
}

export function teamMembersFromOtherDetails(
  otherDetails?: Array<{ label: string; value: string }> | null,
): TeamMemberListItem[] {
  const grouped = new Map<number, TeamMemberListItem>();

  for (const item of otherDetails ?? []) {
    const label = String(item?.label || '').trim();
    const value = String(item?.value || '').trim();
    const match = label.match(TEAM_MEMBER_NUMBERED_LABEL_REGEX);
    if (!match) continue;

    const index = Number(match[1]);
    if (!Number.isFinite(index) || index <= 0) continue;

    const existing = grouped.get(index) || createEmptyTeamMember();
    const field = match[2].toLowerCase();

    if (field === 'salutation') existing.teamMemberSalutation = value;
    if (field === 'name' || field === 'designation') {
      existing.teamMemberName = value;
      existing.teamMemberDesignation = value;
    }
    if (field === 'email') existing.teamMemberEmail = value;
    if (field === 'phone') existing.teamMemberPhone = value;

    grouped.set(index, existing);
  }

  const ordered = Array.from(grouped.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([, member]) => normalizeTeamMemberItem(member));

  return ordered;
}

export function resolveTeamMemberList(source?: {
  teamMemberDesignation?: string | null;
  teamMemberEmail?: string | null;
  teamMemberPhone?: string | null;
  otherDetails?: Array<{ label: string; value: string }> | null;
} | null): TeamMemberListItem[] {
  const numbered = teamMembersFromOtherDetails(source?.otherDetails);
  if (numbered.length > 0) {
    return normalizeTeamMemberList(numbered);
  }

  const explicit = normalizeTeamMemberItem({
    teamMemberDesignation: String(source?.teamMemberDesignation ?? '').trim(),
    teamMemberEmail: String(source?.teamMemberEmail ?? '').trim(),
    teamMemberPhone: String(source?.teamMemberPhone ?? '').trim(),
  });
  if (teamMemberHasAnyValue(explicit)) {
    return normalizeTeamMemberList([explicit]);
  }

  const legacy = parseTeamMemberFromOtherDetails(source?.otherDetails);
  if (teamMemberHasAnyValue(legacy)) {
    return normalizeTeamMemberList([legacy]);
  }

  return normalizeTeamMemberList();
}

/** Prefer dedicated DB columns; fall back to legacy otherDetails rows. */
export function resolveTeamMemberFields(source?: {
  teamMemberDesignation?: string | null;
  teamMemberEmail?: string | null;
  teamMemberPhone?: string | null;
  otherDetails?: Array<{ label: string; value: string }> | null;
} | null): TeamMemberFormValues {
  return primaryTeamMemberFromList(resolveTeamMemberList(source));
}

function stripTeamMemberLabels(
  details: Array<{ label: string; value: string }>,
): Array<{ label: string; value: string }> {
  return details.filter((item) => !isTeamMemberDetailLabel(item.label));
}

export function mergeTeamMemberIntoOtherDetails(
  existing: Array<{ label: string; value: string }> | undefined,
  members: TeamMemberFormValues | TeamMemberListItem[],
): Array<{ label: string; value: string }> | undefined {
  const base = stripTeamMemberLabels(Array.isArray(existing) ? existing : []);

  const entries = [...base];
  const push = (label: string, value?: string) => {
    const trimmed = String(value ?? '').trim();
    if (trimmed) entries.push({ label, value: trimmed });
  };

  const normalizedMembers = normalizeTeamMemberList(
    Array.isArray(members) ? members : [members],
  ).filter(teamMemberHasAnyValue);

  normalizedMembers.forEach((member, index) => {
    const position = index + 1;
    push(`Team Member ${position} ${TEAM_MEMBER_FIELD_SUFFIX.salutation}`, member.teamMemberSalutation);
    push(`Team Member ${position} ${TEAM_MEMBER_FIELD_SUFFIX.name}`, member.teamMemberName);
    push(`Team Member ${position} ${TEAM_MEMBER_FIELD_SUFFIX.email}`, member.teamMemberEmail);
    push(`Team Member ${position} ${TEAM_MEMBER_FIELD_SUFFIX.phone}`, member.teamMemberPhone);
  });

  return entries.length ? entries : undefined;
}

export function teamMemberPayloadFromForm(member: TeamMemberFormValues) {
  if (!teamMemberHasAnyValue(member)) {
    return {
      teamMemberDesignation: null,
      teamMemberEmail: null,
      teamMemberPhone: null,
    };
  }
  const name = String(member.teamMemberName ?? '').trim()
    || String(member.teamMemberDesignation ?? '').trim();
  return {
    teamMemberDesignation: name || null,
    teamMemberEmail: member.teamMemberEmail?.trim() || null,
    teamMemberPhone: member.teamMemberPhone?.trim() || null,
  };
}

export function teamMemberHasAnyValue(member: TeamMemberFormValues): boolean {
  return Boolean(
    String(member.teamMemberSalutation ?? '').trim() ||
      String(member.teamMemberName ?? '').trim() ||
      String(member.teamMemberDesignation ?? '').trim() ||
      String(member.teamMemberEmail ?? '').trim() ||
      String(member.teamMemberPhone ?? '').trim(),
  );
}

function normalizeTeamMemberEmail(email?: string | null): string {
  return String(email || '').trim().toLowerCase();
}

/** Merge contact-backed rows with numbered otherDetails rows (names from drawer save). */
export function mergeTeamMembersWithContacts(
  fromContacts: TeamMemberListItem[],
  fromStored: TeamMemberListItem[],
): TeamMemberListItem[] {
  if (!fromContacts.length) {
    return normalizeTeamMemberList(fromStored);
  }
  if (!fromStored.length) {
    return normalizeTeamMemberList(fromContacts);
  }

  const usedStored = new Set<number>();
  const merged: TeamMemberListItem[] = [];

  for (const contact of fromContacts) {
    const contactEmail = normalizeTeamMemberEmail(contact.teamMemberEmail);
    const storedIdx = fromStored.findIndex(
      (stored, idx) =>
        !usedStored.has(idx) &&
        contactEmail &&
        normalizeTeamMemberEmail(stored.teamMemberEmail) === contactEmail,
    );
    const stored = storedIdx >= 0 ? fromStored[storedIdx] : undefined;
    if (storedIdx >= 0) usedStored.add(storedIdx);

    const storedName = String(stored?.teamMemberName ?? '').trim();
    const contactName = String(contact.teamMemberName ?? '').trim();
    const resolvedName = storedName || contactName;

    merged.push({
      id: contact.id,
      teamMemberSalutation: stored?.teamMemberSalutation || contact.teamMemberSalutation || '',
      teamMemberName: resolvedName,
      teamMemberDesignation: resolvedName || stored?.teamMemberDesignation || contact.teamMemberDesignation || '',
      teamMemberEmail: contact.teamMemberEmail || stored?.teamMemberEmail || '',
      teamMemberPhone: contact.teamMemberPhone || stored?.teamMemberPhone || '',
    });
  }

  fromStored.forEach((stored, idx) => {
    if (!usedStored.has(idx) && teamMemberHasAnyValue(stored)) {
      merged.push(stored);
    }
  });

  return normalizeTeamMemberList(merged);
}
