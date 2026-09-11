/** Multi-director storage in otherDetails (mirrors team-member numbered labels). */

export const DIRECTOR_DETAIL_LABELS = {
  salutation: 'Director Salutation',
  name: 'Director Name',
} as const;

const DIRECTOR_LABEL_SET = new Set<string>(Object.values(DIRECTOR_DETAIL_LABELS));

const DIRECTOR_NUMBERED_LABEL_REGEX =
  /^Director\s+(\d+)\s+(Salutation|Name|Email|Phone)$/i;

export type DirectorListItem = {
  id?: string;
  salutation?: string;
  name?: string;
  email?: string;
  phone?: string;
};

export function isDirectorDetailLabel(label?: string | null): boolean {
  const normalized = String(label ?? '').trim();
  return DIRECTOR_LABEL_SET.has(normalized) || DIRECTOR_NUMBERED_LABEL_REGEX.test(normalized);
}

export function createEmptyDirector(id?: string): DirectorListItem {
  return {
    id,
    salutation: '',
    name: '',
    email: '',
    phone: '',
  };
}

function normalizeDirectorItem(item?: DirectorListItem | null): DirectorListItem {
  return {
    id: item?.id,
    salutation: String(item?.salutation ?? ''),
    name: String(item?.name ?? ''),
    email: String(item?.email ?? ''),
    phone: String(item?.phone ?? ''),
  };
}

export function normalizeDirectorList(
  directors?: Array<DirectorListItem | null | undefined> | null,
): DirectorListItem[] {
  const normalized = (directors ?? []).filter(Boolean).map((d) => normalizeDirectorItem(d));
  return normalized.length > 0 ? normalized : [createEmptyDirector()];
}

export function directorHasAnyValue(director: DirectorListItem): boolean {
  return Boolean(
    String(director.salutation ?? '').trim() ||
      String(director.name ?? '').trim() ||
      String(director.email ?? '').trim() ||
      String(director.phone ?? '').trim(),
  );
}

export function directorsFromOtherDetails(
  otherDetails?: Array<{ label: string; value: string }> | null,
): DirectorListItem[] {
  const grouped = new Map<number, DirectorListItem>();

  for (const item of otherDetails ?? []) {
    const label = String(item?.label || '').trim();
    const value = String(item?.value || '').trim();
    const match = label.match(DIRECTOR_NUMBERED_LABEL_REGEX);
    if (!match) continue;

    const index = Number(match[1]);
    if (!Number.isFinite(index) || index <= 0) continue;

    const existing = grouped.get(index) || createEmptyDirector();
    const field = String(match[2] || '').toLowerCase();
    if (field === 'salutation') existing.salutation = value;
    if (field === 'name') existing.name = value;
    if (field === 'email') existing.email = value;
    if (field === 'phone') existing.phone = value;
    grouped.set(index, existing);
  }

  return Array.from(grouped.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([, director]) => normalizeDirectorItem(director));
}

/** Build full director list from primary fields + otherDetails extras. */
export function resolveDirectorList(source?: {
  directorSalutation?: string | null;
  directorName?: string | null;
  contactPerson?: string | null;
  email?: string | null;
  phone?: string | null;
  emails?: string[] | null;
  phones?: string[] | null;
  otherDetails?: Array<{ label: string; value: string }> | null;
} | null): DirectorListItem[] {
  const primaryName =
    String(source?.directorName ?? '').trim() ||
    String(source?.contactPerson ?? '').trim();
  const primaryEmail =
    String(source?.email ?? '').trim() ||
    String(Array.isArray(source?.emails) ? source?.emails?.[0] : '').trim();
  const primaryPhone =
    String(source?.phone ?? '').trim() ||
    String(Array.isArray(source?.phones) ? source?.phones?.[0] : '').trim();

  const primary: DirectorListItem = {
    salutation: String(source?.directorSalutation ?? '').trim(),
    name: primaryName,
    email: primaryEmail,
    phone: primaryPhone,
  };

  const numbered = directorsFromOtherDetails(source?.otherDetails).filter(
    (d, idx) => idx > 0 || directorHasAnyValue(d),
  );

  // Numbered list already includes Director 1 when saved via mergeDirectorsIntoOtherDetails.
  if (numbered.length > 0) {
    return normalizeDirectorList(numbered);
  }

  return normalizeDirectorList([primary]);
}

export function primaryDirectorFromList(
  directors?: Array<DirectorListItem | null | undefined> | null,
): DirectorListItem {
  return normalizeDirectorList(directors)[0] || createEmptyDirector();
}

/**
 * Persist all directors as numbered otherDetails rows.
 * Also keeps legacy "Director Name" / "Director Salutation" for primary.
 */
export function mergeDirectorsIntoOtherDetails(
  existing: Array<{ label: string; value: string }> | undefined,
  directors: DirectorListItem[],
): Array<{ label: string; value: string }> | undefined {
  const base = (Array.isArray(existing) ? existing : []).filter(
    (item) => !isDirectorDetailLabel(item.label),
  );
  const entries = [...base];
  const push = (label: string, value?: string | null) => {
    const trimmed = String(value ?? '').trim();
    if (trimmed) entries.push({ label, value: trimmed });
  };

  const normalized = normalizeDirectorList(directors).filter(directorHasAnyValue);
  const primary = normalized[0];

  if (primary) {
    push(DIRECTOR_DETAIL_LABELS.salutation, primary.salutation);
    push(DIRECTOR_DETAIL_LABELS.name, primary.name);
  }

  normalized.forEach((director, index) => {
    const position = index + 1;
    push(`Director ${position} Salutation`, director.salutation);
    push(`Director ${position} Name`, director.name);
    push(`Director ${position} Email`, director.email);
    push(`Director ${position} Phone`, director.phone);
  });

  return entries.length ? entries : undefined;
}

/** Keep primary channel arrays in sync with director list (one email/phone per director row). */
export function contactChannelsFromDirectors(directors: DirectorListItem[]): {
  emails: string[];
  phones: string[];
  email: string;
  phone: string;
} {
  const list = normalizeDirectorList(directors);
  const emails = list.map((d) => String(d.email || '').trim()).filter(Boolean);
  const phones = list.map((d) => String(d.phone || '').trim()).filter(Boolean);
  return {
    emails: emails.length ? emails : [''],
    phones: phones.length ? phones : [''],
    email: emails[0] || '',
    phone: phones[0] || '',
  };
}
