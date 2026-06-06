/** Normalize raw job-portal `career_preferences` Mongo docs for Phase 2 CRM display. */

function normalizeStringArray(value) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item || '').trim()).filter(Boolean);
}

function parseSemicolonList(value) {
  if (Array.isArray(value)) return normalizeStringArray(value);
  const text = String(value || '').trim();
  if (!text) return [];
  return text
    .split(/[,;|]/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function normalizeSalaryType(value) {
  const raw = String(value || '').trim().toUpperCase();
  if (!raw) return null;
  if (raw === 'ANNUAL' || raw === 'ANNUALLY') return 'Annual';
  if (raw === 'MONTHLY') return 'Monthly';
  if (raw === 'HOURLY') return 'Hourly';
  if (raw === 'DAILY') return 'Daily';
  return String(value).trim();
}

function normalizeWorkMode(value) {
  const raw = String(value || '').trim().toUpperCase().replace(/\s+/g, '_');
  if (!raw) return null;
  if (raw === 'REMOTE') return 'Remote';
  if (raw === 'ON_SITE' || raw === 'ONSITE' || raw === 'ON-SITE') return 'On-site';
  if (raw === 'HYBRID') return 'Hybrid';
  return String(value).trim();
}

function extractWorkModes(passportNumbersByLocation, preferredWorkMode) {
  const rawMeta = passportNumbersByLocation;
  const rawModes =
    rawMeta && typeof rawMeta === 'object' && Array.isArray(rawMeta.__workModes)
      ? rawMeta.__workModes
      : [];
  const normalized = [...new Set(rawModes.map((mode) => String(mode || '').trim()).filter(Boolean))];
  if (normalized.length) {
    return normalized
      .map((mode) => (mode === 'On Site' ? 'On-site' : normalizeWorkMode(mode) || mode))
      .filter(Boolean);
  }
  const single = normalizeWorkMode(preferredWorkMode);
  return single ? [single] : [];
}

function filterPassportNumbers(passportNumbersByLocation) {
  if (!passportNumbersByLocation || typeof passportNumbersByLocation !== 'object' || Array.isArray(passportNumbersByLocation)) {
    return {};
  }
  return Object.fromEntries(
    Object.entries(passportNumbersByLocation).filter(([key, value]) => key !== '__workModes' && String(value || '').trim()),
  );
}

function parseNullableNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * @param {Record<string, unknown>|null|undefined} raw
 * @param {{ currentTitle?: string|null, designation?: string|null }} [candidate]
 */
export function normalizePortalCareerPreferences(raw, candidate = {}) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;

  const preferredRoles = normalizeStringArray(raw.preferredRoles || raw.preferredJobTitles);
  const preferredIndustries = parseSemicolonList(raw.preferredIndustries).length
    ? parseSemicolonList(raw.preferredIndustries)
    : parseSemicolonList(raw.preferredIndustry);
  const functionalAreas = parseSemicolonList(raw.functionalAreas).length
    ? parseSemicolonList(raw.functionalAreas)
    : parseSemicolonList(raw.functionalArea);
  const workModes = extractWorkModes(raw.passportNumbersByLocation, raw.preferredWorkMode);
  const noticePeriod =
    String(raw.noticePeriod || '').trim() ||
    (raw.noticePeriodDays != null && Number.isFinite(Number(raw.noticePeriodDays))
      ? `${Number(raw.noticePeriodDays)} days`
      : null);
  const relocationPreference =
    String(raw.relocationPreference || '').trim() ||
    (raw.openToRelocation === true
      ? 'Open to Relocate'
      : raw.openToRelocation === false
        ? 'Not Open to Relocate'
        : null);

  return {
    currentRole:
      String(raw.currentRole || '').trim() ||
      String(candidate.currentTitle || '').trim() ||
      String(candidate.designation || '').trim() ||
      null,
    preferredJobTitles: preferredRoles,
    preferredRoles,
    preferredIndustries,
    preferredIndustry: String(raw.preferredIndustry || '').trim() || preferredIndustries.join('; ') || null,
    functionalAreas,
    functionalArea: String(raw.functionalArea || '').trim() || functionalAreas.join('; ') || null,
    jobTypes: normalizeStringArray(raw.jobTypes),
    workModes,
    preferredWorkMode: workModes[0] || normalizeWorkMode(raw.preferredWorkMode) || null,
    preferredLocations: normalizeStringArray(raw.preferredLocations),
    relocationPreference,
    preferredCurrency: raw.preferredCurrency || raw.salaryCurrency || null,
    preferredSalary: parseNullableNumber(raw.preferredSalary ?? raw.salaryAmount),
    preferredSalaryType: normalizeSalaryType(raw.preferredSalaryType || raw.salaryFrequency),
    salaryCurrency: raw.preferredCurrency || raw.salaryCurrency || null,
    salaryAmount: parseNullableNumber(raw.preferredSalary ?? raw.salaryAmount),
    salaryFrequency: normalizeSalaryType(raw.preferredSalaryType || raw.salaryFrequency),
    preferredBenefits: normalizeStringArray(raw.preferredBenefits),
    currentCurrency: raw.currentCurrency || null,
    currentSalary: parseNullableNumber(raw.currentSalary),
    currentSalaryType: normalizeSalaryType(raw.currentSalaryType),
    currentLocation: raw.currentLocation || null,
    currentBenefits: normalizeStringArray(raw.currentBenefits),
    availabilityToStart: raw.availabilityToStart || null,
    noticePeriod,
    noticePeriodDays:
      raw.noticePeriodDays != null && Number.isFinite(Number(raw.noticePeriodDays))
        ? Number(raw.noticePeriodDays)
        : null,
    openToRelocation: Boolean(raw.openToRelocation),
    passportNumbersByLocation: filterPassportNumbers(raw.passportNumbersByLocation),
  };
}
