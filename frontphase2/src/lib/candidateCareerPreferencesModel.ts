import type { CandidateProfileDrawerData } from '../components/drawers/candidateProfileDrawerData';
import { getPhase1ProfileSnapshot } from './phase1ProfileSnapshot';
import {
  normalizeCareerPreferencesRecord,
  normalizeCareerSalaryTypeLabel,
  normalizeCareerWorkModeLabel,
} from './normalizeCareerPreferencesRecord';
import {
  computeTotalExperienceYears,
  formatExperienceYearsLabel,
  collectCandidateWorkEntries,
} from './candidateExperience';

export { normalizeCareerSalaryTypeLabel, normalizeCareerWorkModeLabel };

function display(value: unknown): string {
  if (value === undefined || value === null) return '';
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return String(value).trim();
}

const CURRENCY_CODES = new Set([
  'XAF', 'XOF', 'USD', 'EUR', 'GBP', 'INR', 'AED', 'CAD', 'AUD', 'NGN', 'KES', 'ZAR', 'CHF', 'JPY', 'CNY', 'SGD', 'HKD',
]);

function placeLabel(value: unknown, currency?: unknown): string {
  const text = display(value);
  if (!text) return '';
  const upper = text.toUpperCase();
  if (CURRENCY_CODES.has(upper)) return '';
  const cur = display(currency).toUpperCase();
  if (cur && upper === cur) return '';
  return text;
}

function normalizeLabelList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || '').trim()).filter(Boolean);
  }
  const text = display(value);
  if (!text) return [];
  if (text.includes(';')) {
    return text.split(';').map((item) => item.trim()).filter(Boolean);
  }
  if (text.includes('\n')) {
    return text.split('\n').map((item) => item.trim()).filter(Boolean);
  }
  return [text];
}

function normalizePreferredList(primary: unknown, fallback?: unknown): string[] {
  const primaryList = normalizeLabelList(primary);
  if (primaryList.length) return primaryList;
  return normalizeLabelList(fallback);
}

function normalizeStringMap(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value)
      .map(([key, raw]) => [String(key || '').trim(), String(raw || '').trim()])
      .filter(([key, raw]) => key && raw),
  );
}

/** Portal checkbox lists (6500 USD / car allowance) vs Overview package (2M XAF / health coverage). */
export function isPortalCheckboxCareerPrefs(prefs: Record<string, unknown> | null | undefined): boolean {
  if (!prefs || typeof prefs !== 'object' || Array.isArray(prefs)) return false;
  const preferred = Number(prefs.preferredSalary ?? prefs.salaryAmount);
  const current = Number(prefs.currentSalary);
  const prefCur = String(prefs.preferredCurrency || prefs.salaryCurrency || '').trim().toUpperCase();
  const curCur = String(prefs.currentCurrency || '').trim().toUpperCase();
  const benefitText = [
    ...(Array.isArray(prefs.preferredBenefits) ? prefs.preferredBenefits : []),
    ...(Array.isArray(prefs.currentBenefits) ? prefs.currentBenefits : []),
  ]
    .map((item) => String(item || '').toLowerCase())
    .join(' | ');
  if (/health coverage|13th month|performance bonus|other bonuses/.test(benefitText)) return false;
  if (prefCur && curCur && prefCur === curCur && Number.isFinite(preferred) && preferred >= 100000) {
    return false;
  }
  if (
    Number.isFinite(preferred) &&
    Number.isFinite(current) &&
    prefCur &&
    curCur &&
    prefCur !== curCur &&
    preferred < 50000 &&
    current > 100000
  ) {
    return true;
  }
  return (
    /car allowance|bachelor accommodation|food allowance|fuel and driver/.test(benefitText) &&
    (!Number.isFinite(preferred) || preferred < 50000)
  );
}

export function formatCareerAmount(value: unknown): string {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value.toLocaleString();
  }
  const text = display(value);
  if (!text) return '';
  const numeric = Number(text.replace(/,/g, ''));
  if (Number.isFinite(numeric) && /^\d[\d,]*(\.\d+)?$/.test(text)) {
    return numeric.toLocaleString();
  }
  return text;
}


export function parseAvailabilityFields(saved: unknown): {
  earliestStartDate: string;
  describeAvailability: string;
} {
  const s = display(saved);
  if (!s) return { earliestStartDate: '', describeAvailability: '' };
  const combined = /^(\d{4}-\d{2}-\d{2})\s*—\s*(.+)$/.exec(s);
  if (combined) {
    return { earliestStartDate: combined[1], describeAvailability: combined[2].trim() };
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    return { earliestStartDate: s, describeAvailability: '' };
  }
  return { earliestStartDate: '', describeAvailability: s };
}

export type CareerPreferencesViewModel = {
  experienceLabel: string;
  currentPackage: {
    role: string;
    currency: string;
    salaryType: string;
    salary: string;
    location: string;
    benefits: string[];
  };
  preferredPackage: {
    roles: string[];
    currency: string;
    salaryType: string;
    salary: string;
    locations: string[];
    passportNumbersByLocation: Record<string, string>;
    workModes: string[];
    benefits: string[];
  };
  roleDomain: {
    industries: string[];
    functionalAreas: string[];
    jobTypes: string[];
  };
  availability: {
    relocation: string;
    earliestStartDate: string;
    describeAvailability: string;
    noticePeriod: string;
  };
  reasonForJobChange: string;
  resume: string;
};

export function mergeCareerPreferencesRecord(
  candidate: CandidateProfileDrawerData,
  override?: Record<string, unknown> | null,
): Record<string, unknown> {
  const extra = (candidate.extraData || {}) as Record<string, unknown>;
  const phase1 = getPhase1ProfileSnapshot(extra);
  const pipeline = (extra.pipeline || {}) as Record<string, unknown>;
  const professional = (pipeline.professional || extra.professional || {}) as Record<string, unknown>;

  const extraCareer =
    extra.careerPreferences && typeof extra.careerPreferences === 'object' && !Array.isArray(extra.careerPreferences)
      ? (extra.careerPreferences as Record<string, unknown>)
      : {};
  const snapshotCareer =
    ((phase1?.careerPreferences as Record<string, unknown> | null) || {});
  const portalCareer =
    ((candidate.careerPreferences as Record<string, unknown> | null) || {});

  const crmSources = [snapshotCareer, extraCareer, override || {}].filter(
    (row) => row && Object.keys(row).length && !isPortalCheckboxCareerPrefs(row),
  );
  const merged: Record<string, unknown> = Object.assign(
    {},
    ...(crmSources.length ? crmSources : [portalCareer, snapshotCareer, extraCareer, override || {}]),
  );

  const hasList = (value: unknown) => {
    if (Array.isArray(value)) return value.some((item) => String(item || '').trim());
    return Boolean(String(value ?? '').trim());
  };

  if (!crmSources.length) {
    if (
      !hasList(merged.currentBenefits) &&
      professional.currentBenefits &&
      !Object.prototype.hasOwnProperty.call(extraCareer, 'currentBenefits')
    ) {
      merged.currentBenefits = professional.currentBenefits;
    }
    if (
      !hasList(merged.preferredBenefits) &&
      professional.expectedBenefits &&
      !Object.prototype.hasOwnProperty.call(extraCareer, 'preferredBenefits')
    ) {
      merged.preferredBenefits = professional.expectedBenefits;
    }
    if (
      !String(merged.currentCurrency ?? '').trim() &&
      professional.currentSalaryCurrency &&
      !Object.prototype.hasOwnProperty.call(extraCareer, 'currentCurrency')
    ) {
      merged.currentCurrency = professional.currentSalaryCurrency;
    }
    if (
      !String(merged.preferredCurrency ?? '').trim() &&
      professional.expectedSalaryCurrency &&
      !Object.prototype.hasOwnProperty.call(extraCareer, 'preferredCurrency') &&
      !Object.prototype.hasOwnProperty.call(extraCareer, 'salaryCurrency')
    ) {
      merged.preferredCurrency = professional.expectedSalaryCurrency;
    }
  }

  const filled = (value: unknown) => {
    if (value === undefined || value === null || value === '') return false;
    return true;
  };
  const skipSmallXafPortalAmount = (value: unknown, currency: string) => {
    const amount = Number(String(value ?? '').replace(/[^\d.-]/g, ''));
    return Number.isFinite(amount) && amount > 0 && amount < 50000 && /^(XAF|XOF)$/.test(currency);
  };
  if (!filled(merged.preferredSalary) && !filled(merged.salaryAmount)) {
    const crmCurrency = String(merged.preferredCurrency || merged.salaryCurrency || '')
      .trim()
      .toUpperCase();
    const salaryFallbacks = [
      professional.expectedSalary,
      extra.expectedSalary,
      candidate.expectedSalaryValue,
      (candidate as { expectedSalary?: unknown }).expectedSalary,
    ];
    for (const fallback of salaryFallbacks) {
      if (!filled(fallback)) continue;
      if (skipSmallXafPortalAmount(fallback, crmCurrency)) continue;
      merged.preferredSalary = fallback;
      merged.salaryAmount = fallback;
      break;
    }
  }
  if (!filled(merged.currentSalary)) {
    const currentCurrency = String(merged.currentCurrency || '').trim().toUpperCase();
    const currentFallbacks = [
      professional.currentSalary,
      extra.currentSalary,
      candidate.currentSalaryValue,
      (candidate as { currentSalary?: unknown }).currentSalary,
    ];
    for (const fallback of currentFallbacks) {
      if (!filled(fallback)) continue;
      if (skipSmallXafPortalAmount(fallback, currentCurrency)) continue;
      merged.currentSalary = fallback;
      break;
    }
  }
  if (!String(merged.reasonForJobChange ?? '').trim()) {
    const fromRemarks =
      display(professional.remarks) ||
      display(extra.remarks) ||
      display(candidate.cvNotes) ||
      display((candidate as { notes?: string | null }).notes);
    if (fromRemarks) merged.reasonForJobChange = fromRemarks;
  }

  return normalizeCareerPreferencesRecord(merged, candidate) || merged;
}

export function buildCareerPreferencesViewModel(
  candidate: CandidateProfileDrawerData,
  careerPrefsOverride?: Record<string, unknown> | null,
): CareerPreferencesViewModel {
  const careerPrefs = mergeCareerPreferencesRecord(candidate, careerPrefsOverride);
  const workEntries = collectCandidateWorkEntries(candidate);
  const computedExperienceYears = computeTotalExperienceYears(workEntries, candidate.experience ?? null);
  const availabilityRaw = parseAvailabilityFields(
    careerPrefs.availabilityToStart || candidate.cvAvailability || candidate.availability,
  );

  const workModes = normalizeLabelList(careerPrefs.workModes)
    .map((mode) => normalizeCareerWorkModeLabel(mode))
    .filter(Boolean);
  const singleWorkMode = normalizeCareerWorkModeLabel(careerPrefs.preferredWorkMode);
  const preferredWorkModes =
    workModes.length > 0 ? workModes : singleWorkMode ? [singleWorkMode] : [];

  const relocation =
    display(careerPrefs.relocationPreference) ||
    (careerPrefs.openToRelocation === true ? 'Open to Relocate' : '') ||
    (careerPrefs.openToRelocation === false ? 'Not Open to Relocate' : '');

  return {
    experienceLabel: formatExperienceYearsLabel(computedExperienceYears),
    currentPackage: {
      role:
        display(careerPrefs.currentRole) ||
        candidate.designation ||
        candidate.currentTitle ||
        '',
      currency:
        display(careerPrefs.currentCurrency) ||
        display((careerPrefs as Record<string, unknown>).currentSalaryCurrency) ||
        candidate.salaryCurrency ||
        '',
      salaryType: normalizeCareerSalaryTypeLabel(careerPrefs.currentSalaryType),
      salary:
        formatCareerAmount(careerPrefs.currentSalary) ||
        formatCareerAmount(candidate.currentSalaryValue),
      location:
        placeLabel(careerPrefs.currentLocation, careerPrefs.currentCurrency) ||
        placeLabel(candidate.location, careerPrefs.currentCurrency) ||
        candidate.cvAddress ||
        '',
      benefits: normalizeLabelList(careerPrefs.currentBenefits),
    },
    preferredPackage: {
      roles: normalizePreferredList(
        careerPrefs.preferredRoles || careerPrefs.preferredJobTitles,
        (careerPrefs as Record<string, unknown>).preferredRoles,
      ),
      currency:
        display(careerPrefs.preferredCurrency || careerPrefs.salaryCurrency) ||
        candidate.salaryCurrency ||
        '',
      salaryType: normalizeCareerSalaryTypeLabel(
        careerPrefs.preferredSalaryType || careerPrefs.salaryFrequency,
      ),
      salary:
        formatCareerAmount(careerPrefs.preferredSalary || careerPrefs.salaryAmount) ||
        formatCareerAmount(candidate.expectedSalaryValue),
      locations: normalizeLabelList(careerPrefs.preferredLocations).length
        ? normalizeLabelList(careerPrefs.preferredLocations)
        : normalizeLabelList(candidate.cvPreferredLocation),
      passportNumbersByLocation: normalizeStringMap(careerPrefs.passportNumbersByLocation),
      workModes: preferredWorkModes,
      benefits: normalizeLabelList(careerPrefs.preferredBenefits),
    },
    roleDomain: {
      industries: normalizePreferredList(careerPrefs.preferredIndustries, careerPrefs.preferredIndustry),
      functionalAreas: normalizePreferredList(careerPrefs.functionalAreas, careerPrefs.functionalArea),
      jobTypes: normalizeLabelList(careerPrefs.jobTypes),
    },
    availability: {
      relocation,
      earliestStartDate: availabilityRaw.earliestStartDate,
      describeAvailability: availabilityRaw.describeAvailability,
      noticePeriod: display(careerPrefs.noticePeriod) || candidate.noticePeriod || '',
    },
    reasonForJobChange:
      display(careerPrefs.reasonForJobChange) ||
      display((careerPrefs as Record<string, unknown>).remarks) ||
      '',
    resume: candidate.resumeUrl || '',
  };
}

export function countCareerPreferencesFilled(model: CareerPreferencesViewModel): number {
  const values = [
    model.experienceLabel,
    model.currentPackage.role,
    model.currentPackage.currency,
    model.currentPackage.salaryType,
    model.currentPackage.salary,
    model.currentPackage.location,
    model.currentPackage.benefits.join('; '),
    model.preferredPackage.roles.join('; '),
    model.preferredPackage.currency,
    model.preferredPackage.salaryType,
    model.preferredPackage.salary,
    model.preferredPackage.locations.join('; '),
    model.preferredPackage.workModes.join('; '),
    model.preferredPackage.benefits.join('; '),
    model.roleDomain.industries.join('; '),
    model.roleDomain.functionalAreas.join('; '),
    model.roleDomain.jobTypes.join('; '),
    model.availability.relocation,
    model.availability.earliestStartDate,
    model.availability.describeAvailability,
    model.availability.noticePeriod,
    model.reasonForJobChange,
    model.resume,
  ];
  return values.filter((v) => display(v)).length;
}
