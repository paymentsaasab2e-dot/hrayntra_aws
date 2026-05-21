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

/** Prefer dedicated DB columns; fall back to legacy otherDetails rows. */
export function resolveTeamMemberFields(source?: {
  teamMemberDesignation?: string | null;
  teamMemberEmail?: string | null;
  teamMemberPhone?: string | null;
  otherDetails?: Array<{ label: string; value: string }> | null;
} | null): TeamMemberFormValues {
  const designation = String(source?.teamMemberDesignation ?? '').trim();
  const email = String(source?.teamMemberEmail ?? '').trim();
  const phone = String(source?.teamMemberPhone ?? '').trim();
  if (designation || email || phone) {
    return { teamMemberDesignation: designation, teamMemberEmail: email, teamMemberPhone: phone };
  }
  const legacy = parseTeamMemberFromOtherDetails(source?.otherDetails);
  return {
    teamMemberDesignation: legacy.designation,
    teamMemberEmail: legacy.email,
    teamMemberPhone: legacy.phone,
  };
}

function stripTeamMemberLabels(
  details: Array<{ label: string; value: string }>,
): Array<{ label: string; value: string }> {
  return details.filter((item) => !TEAM_MEMBER_LABEL_SET.has(String(item.label || '').trim()));
}

export function mergeTeamMemberIntoOtherDetails(
  existing: Array<{ label: string; value: string }> | undefined,
  teamName: string | undefined,
  member: TeamMemberFormValues,
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

  push(TEAM_MEMBER_DETAIL_LABELS.designation, member.teamMemberDesignation);
  push(TEAM_MEMBER_DETAIL_LABELS.email, member.teamMemberEmail);
  push(TEAM_MEMBER_DETAIL_LABELS.phone, member.teamMemberPhone);

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
