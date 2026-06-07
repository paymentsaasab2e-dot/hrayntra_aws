/** Client-side normalization aligned with Phase 1 profile GET + portal DB shape. */

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item || '').trim()).filter(Boolean);
}

export function parseSemicolonList(value: unknown): string[] {
  if (Array.isArray(value)) return normalizeStringArray(value);
  const text = String(value ?? '').trim();
  if (!text) return [];
  return text
    .split(/[,;|]/)
    .map((part) => part.trim())
    .filter(Boolean);
}

export function normalizeCareerSalaryTypeLabel(value: unknown): string {
  const raw = String(value ?? '').trim().toUpperCase();
  if (!raw) return '';
  if (raw === 'ANNUAL' || raw === 'ANNUALLY') return 'Annual';
  if (raw === 'MONTHLY') return 'Monthly';
  if (raw === 'HOURLY') return 'Hourly';
  if (raw === 'DAILY') return 'Daily';
  return String(value).trim();
}

export function normalizeCareerWorkModeLabel(value: unknown): string {
  const raw = String(value ?? '').trim().toUpperCase().replace(/\s+/g, '_');
  if (!raw) return '';
  if (raw === 'REMOTE') return 'Remote';
  if (raw === 'ON_SITE' || raw === 'ONSITE' || raw === 'ON-SITE') return 'On-site';
  if (raw === 'HYBRID') return 'Hybrid';
  return String(value).trim();
}

function extractWorkModes(passportNumbersByLocation: unknown, preferredWorkMode: unknown): string[] {
  const rawMeta = passportNumbersByLocation;
  const rawModes =
    rawMeta && typeof rawMeta === 'object' && !Array.isArray(rawMeta) && Array.isArray((rawMeta as Record<string, unknown>).__workModes)
      ? ((rawMeta as Record<string, unknown>).__workModes as unknown[])
      : [];
  const normalized = [...new Set(rawModes.map((mode) => String(mode || '').trim()).filter(Boolean))];
  if (normalized.length) {
    return normalized
      .map((mode) => (mode === 'On Site' ? 'On-site' : normalizeCareerWorkModeLabel(mode) || mode))
      .filter(Boolean);
  }
  const single = normalizeCareerWorkModeLabel(preferredWorkMode);
  return single ? [single] : [];
}

export function filterPassportNumbersByLocation(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([key]) => key !== '__workModes')
      .map(([key, raw]) => [String(key).trim(), String(raw ?? '').trim()])
      .filter(([key, raw]) => key && raw),
  );
}

function parseNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export type NormalizedCareerPreferences = Record<string, unknown>;

export function normalizeCareerPreferencesRecord(
  raw: Record<string, unknown> | null | undefined,
  candidate?: { currentTitle?: string | null; designation?: string | null },
): NormalizedCareerPreferences | null {
  if (!raw || typeof raw !== 'object') return null;

  const preferredRoles = normalizeStringArray(raw.preferredRoles || raw.preferredJobTitles);
  const preferredIndustries = parseSemicolonList(raw.preferredIndustries).length
    ? parseSemicolonList(raw.preferredIndustries)
    : parseSemicolonList(raw.preferredIndustry);
  const functionalAreas = parseSemicolonList(raw.functionalAreas).length
    ? parseSemicolonList(raw.functionalAreas)
    : parseSemicolonList(raw.functionalArea);
  const workModes = extractWorkModes(raw.passportNumbersByLocation, raw.preferredWorkMode);
  const noticePeriod =
    String(raw.noticePeriod ?? '').trim() ||
    (raw.noticePeriodDays != null && Number.isFinite(Number(raw.noticePeriodDays))
      ? `${Number(raw.noticePeriodDays)} days`
      : '');
  const relocationPreference =
    String(raw.relocationPreference ?? '').trim() ||
    (raw.openToRelocation === true
      ? 'Open to Relocate'
      : raw.openToRelocation === false
        ? 'Not Open to Relocate'
        : '');

  return {
    currentRole:
      String(raw.currentRole ?? '').trim() ||
      String(candidate?.currentTitle ?? '').trim() ||
      String(candidate?.designation ?? '').trim() ||
      null,
    preferredJobTitles: preferredRoles,
    preferredRoles,
    preferredIndustries,
    preferredIndustry: String(raw.preferredIndustry ?? '').trim() || preferredIndustries.join('; ') || null,
    functionalAreas,
    functionalArea: String(raw.functionalArea ?? '').trim() || functionalAreas.join('; ') || null,
    jobTypes: normalizeStringArray(raw.jobTypes),
    workModes,
    preferredWorkMode: workModes[0] || normalizeCareerWorkModeLabel(raw.preferredWorkMode) || null,
    preferredLocations: normalizeStringArray(raw.preferredLocations),
    relocationPreference: relocationPreference || null,
    preferredCurrency: raw.preferredCurrency || raw.salaryCurrency || null,
    preferredSalary: parseNullableNumber(raw.preferredSalary ?? raw.salaryAmount),
    preferredSalaryType: normalizeCareerSalaryTypeLabel(raw.preferredSalaryType || raw.salaryFrequency),
    salaryCurrency: raw.preferredCurrency || raw.salaryCurrency || null,
    salaryAmount: parseNullableNumber(raw.preferredSalary ?? raw.salaryAmount),
    salaryFrequency: normalizeCareerSalaryTypeLabel(raw.preferredSalaryType || raw.salaryFrequency),
    preferredBenefits: normalizeStringArray(raw.preferredBenefits),
    currentCurrency: raw.currentCurrency || null,
    currentSalary: parseNullableNumber(raw.currentSalary),
    currentSalaryType: normalizeCareerSalaryTypeLabel(raw.currentSalaryType),
    currentLocation: raw.currentLocation || null,
    currentBenefits: normalizeStringArray(raw.currentBenefits),
    availabilityToStart: raw.availabilityToStart || null,
    noticePeriod: noticePeriod || null,
    noticePeriodDays:
      raw.noticePeriodDays != null && Number.isFinite(Number(raw.noticePeriodDays))
        ? Number(raw.noticePeriodDays)
        : null,
    openToRelocation: Boolean(raw.openToRelocation),
    passportNumbersByLocation: filterPassportNumbersByLocation(raw.passportNumbersByLocation),
  };
}

export function listToSemicolon(value: unknown): string {
  if (Array.isArray(value)) return value.map((item) => String(item || '').trim()).filter(Boolean).join('; ');
  return String(value ?? '').trim();
}

export function mergeAvailabilityForSave(date: string, text: string): string {
  const t = text.trim();
  const d = date.trim();
  if (t && d) return `${d} — ${t}`;
  if (t) return t;
  if (d) return d;
  return '';
}

export function buildPassportRecordWithWorkModes(
  passportNumbers: Record<string, string>,
  workModes: string[],
): Record<string, unknown> {
  const record: Record<string, unknown> = { ...passportNumbers };
  const modes = workModes.map((mode) => String(mode || '').trim()).filter(Boolean);
  if (modes.length) record.__workModes = modes;
  return record;
}

export function parsePassportLines(value: string): Record<string, string> {
  return Object.fromEntries(
    String(value || '')
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const pipe = line.split('|').map((part) => part.trim());
        if (pipe.length >= 2) return [pipe[0], pipe.slice(1).join('|')] as const;
        const colon = line.split(':').map((part) => part.trim());
        if (colon.length >= 2) return [colon[0], colon.slice(1).join(':')] as const;
        return null;
      })
      .filter((entry): entry is readonly [string, string] => Boolean(entry)),
  );
}

export function formatPassportLines(value: Record<string, string>): string {
  return Object.entries(value)
    .map(([location, passport]) => `${location} | ${passport}`)
    .join('\n');
}

/** Normalize edited career preferences before persisting to phase1ProfileSnapshot. */
export function prepareCareerPreferencesForSave(
  raw: Record<string, unknown> | null | undefined,
  candidate?: { currentTitle?: string | null; designation?: string | null },
): Record<string, unknown> | null {
  if (!raw || typeof raw !== 'object') return null;
  const workModes = parseSemicolonList(raw.workModes).map((mode) => normalizeCareerWorkModeLabel(mode) || mode);
  const passportNumbers =
    raw.passportNumbersByLocation && typeof raw.passportNumbersByLocation === 'object'
      ? filterPassportNumbersByLocation(raw.passportNumbersByLocation)
      : typeof raw.passportNumbersText === 'string'
        ? parsePassportLines(raw.passportNumbersText)
        : {};
  const normalized = normalizeCareerPreferencesRecord(
    {
      ...raw,
      preferredRoles: parseSemicolonList(raw.preferredRoles || raw.preferredJobTitles),
      preferredJobTitles: parseSemicolonList(raw.preferredJobTitles || raw.preferredRoles),
      preferredIndustries: parseSemicolonList(raw.preferredIndustries || raw.preferredIndustry),
      functionalAreas: parseSemicolonList(raw.functionalAreas || raw.functionalArea),
      jobTypes: parseSemicolonList(raw.jobTypes),
      preferredLocations: parseSemicolonList(raw.preferredLocations),
      currentBenefits: parseSemicolonList(raw.currentBenefits),
      preferredBenefits: parseSemicolonList(raw.preferredBenefits),
      workModes,
      passportNumbersByLocation: buildPassportRecordWithWorkModes(passportNumbers, workModes),
      availabilityToStart:
        raw.availabilityToStart ||
        mergeAvailabilityForSave(
          String(raw.earliestStartDate ?? ''),
          String(raw.describeAvailability ?? ''),
        ) ||
        null,
      openToRelocation:
        raw.openToRelocation ??
        (String(raw.relocationPreference ?? '').trim() === 'Open to Relocate'
          ? true
          : String(raw.relocationPreference ?? '').trim() === 'Not Open to Relocate'
            ? false
            : undefined),
    },
    candidate,
  );
  return normalized;
}
