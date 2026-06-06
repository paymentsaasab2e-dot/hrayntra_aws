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

  const merged = {
    ...(((phase1?.careerPreferences as Record<string, unknown> | null) || {})),
    ...(((candidate.careerPreferences as Record<string, unknown> | null) || {})),
    ...(override || {}),
    ...(professional.currentBenefits ? { currentBenefits: professional.currentBenefits } : {}),
    ...(professional.expectedBenefits ? { preferredBenefits: professional.expectedBenefits } : {}),
  };

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
        display(careerPrefs.currentLocation) ||
        candidate.location ||
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
    model.resume,
  ];
  return values.filter((v) => display(v)).length;
}
