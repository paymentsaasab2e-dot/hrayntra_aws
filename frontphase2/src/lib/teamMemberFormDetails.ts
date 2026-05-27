export const TEAM_MEMBER_DETAIL_LABELS = {
  designation: 'Team Member Designation',
  email: 'Team Member Email',
  phone: 'Team Member Phone',
} as const;

const TEAM_MEMBER_LABEL_SET = new Set<string>(Object.values(TEAM_MEMBER_DETAIL_LABELS));

export type TeamMemberFormValues = {
  teamMemberDesignation?: string;
  teamMemberEmail?: string;
  teamMemberPhone?: string;
};

export type TeamMemberListItem = TeamMemberFormValues & {
  id?: string;
};

const TEAM_MEMBER_FIELD_SUFFIX = {
  designation: 'Designation',
  email: 'Email',
  phone: 'Phone',
} as const;

const TEAM_MEMBER_NUMBERED_LABEL_REGEX =
  /^Team Member\s+(\d+)\s+(Designation|Email|Phone)$/i;

export function isTeamMemberDetailLabel(label?: string | null): boolean {
  const normalized = String(label ?? '').trim();
  return TEAM_MEMBER_LABEL_SET.has(normalized) || TEAM_MEMBER_NUMBERED_LABEL_REGEX.test(normalized);
}

export function createEmptyTeamMember(id?: string): TeamMemberListItem {
  return {
    id,
    teamMemberDesignation: '',
    teamMemberEmail: '',
    teamMemberPhone: '',
  };
}

export function normalizeTeamMemberList(
  members?: Array<TeamMemberListItem | null | undefined> | null,
): TeamMemberListItem[] {
  const normalized = (members ?? [])
    .filter(Boolean)
    .map((member) => ({
      id: member?.id,
      teamMemberDesignation: String(member?.teamMemberDesignation ?? ''),
      teamMemberEmail: String(member?.teamMemberEmail ?? ''),
      teamMemberPhone: String(member?.teamMemberPhone ?? ''),
    }));

  return normalized.length > 0 ? normalized : [createEmptyTeamMember()];
}

export function primaryTeamMemberFromList(
  members?: Array<TeamMemberListItem | null | undefined> | null,
): TeamMemberFormValues {
  const [first] = normalizeTeamMemberList(members);
  return {
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
): { designation: string; email: string; phone: string } {
  const byLabel = new Map(
    (otherDetails ?? []).map((item) => [String(item.label || '').trim(), String(item.value || '').trim()]),
  );
  return {
    designation: byLabel.get(TEAM_MEMBER_DETAIL_LABELS.designation) || '',
    email: byLabel.get(TEAM_MEMBER_DETAIL_LABELS.email) || '',
    phone: byLabel.get(TEAM_MEMBER_DETAIL_LABELS.phone) || '',
  };
}

function parseTeamMemberListFromOtherDetails(
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

    if (field === 'designation') existing.teamMemberDesignation = value;
    if (field === 'email') existing.teamMemberEmail = value;
    if (field === 'phone') existing.teamMemberPhone = value;

    grouped.set(index, existing);
  }

  const ordered = Array.from(grouped.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([, member]) => member);

  return ordered;
}

export function resolveTeamMemberList(source?: {
  teamMemberDesignation?: string | null;
  teamMemberEmail?: string | null;
  teamMemberPhone?: string | null;
  otherDetails?: Array<{ label: string; value: string }> | null;
} | null): TeamMemberListItem[] {
  const numbered = parseTeamMemberListFromOtherDetails(source?.otherDetails);
  if (numbered.length > 0) {
    return normalizeTeamMemberList(numbered);
  }

  const explicit = {
    teamMemberDesignation: String(source?.teamMemberDesignation ?? '').trim(),
    teamMemberEmail: String(source?.teamMemberEmail ?? '').trim(),
    teamMemberPhone: String(source?.teamMemberPhone ?? '').trim(),
  };
  if (teamMemberHasAnyValue(explicit)) {
    return normalizeTeamMemberList([explicit]);
  }

  const legacy = parseTeamMemberFromOtherDetails(source?.otherDetails);
  if (legacy.designation || legacy.email || legacy.phone) {
    return normalizeTeamMemberList([
      {
        teamMemberDesignation: legacy.designation,
        teamMemberEmail: legacy.email,
        teamMemberPhone: legacy.phone,
      },
    ]);
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
  teamName: string | undefined,
  members: TeamMemberFormValues | TeamMemberListItem[],
): Array<{ label: string; value: string }> | undefined {
  const base = stripTeamMemberLabels(Array.isArray(existing) ? existing : []);
  if (!hasTeamName(teamName)) {
    return base.length ? base : undefined;
  }

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
    push(`Team Member ${position} ${TEAM_MEMBER_FIELD_SUFFIX.designation}`, member.teamMemberDesignation);
    push(`Team Member ${position} ${TEAM_MEMBER_FIELD_SUFFIX.email}`, member.teamMemberEmail);
    push(`Team Member ${position} ${TEAM_MEMBER_FIELD_SUFFIX.phone}`, member.teamMemberPhone);
  });

  return entries.length ? entries : undefined;
}

export function teamMemberPayloadFromForm(member: TeamMemberFormValues, teamName?: string) {
  if (!hasTeamName(teamName)) {
    return {
      teamMemberDesignation: null,
      teamMemberEmail: null,
      teamMemberPhone: null,
    };
  }
  return {
    teamMemberDesignation: member.teamMemberDesignation?.trim() || null,
    teamMemberEmail: member.teamMemberEmail?.trim() || null,
    teamMemberPhone: member.teamMemberPhone?.trim() || null,
  };
}

export function teamMemberHasAnyValue(member: TeamMemberFormValues): boolean {
  return Boolean(
    String(member.teamMemberDesignation ?? '').trim() ||
      String(member.teamMemberEmail ?? '').trim() ||
      String(member.teamMemberPhone ?? '').trim(),
  );
}
