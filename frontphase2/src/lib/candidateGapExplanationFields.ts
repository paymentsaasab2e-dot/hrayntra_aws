export const GAP_CATEGORY_OPTIONS = ['Academic', 'Professional'] as const;

export const GAP_REASON_OPTIONS = [
  { value: 'career-break', label: 'Career Break' },
  { value: 'family-care', label: 'Family Care' },
  { value: 'health-issues', label: 'Health Issues' },
  { value: 'education', label: 'Education' },
  { value: 'travel', label: 'Travel' },
  { value: 'other', label: 'Other' },
] as const;

export const GAP_DURATION_OPTIONS = [
  'Less than 3 months',
  '3-6 months',
  '6 months - 1 year',
  '1-2 years',
  'More than 2 years',
] as const;

export const GAP_PREFERRED_SUPPORT_OPTIONS = [
  { key: 'flexibleRole', label: 'Flexible role' },
  { key: 'hybridRemote', label: 'Hybrid / Remote' },
  { key: 'midLevelReEntry', label: 'Mid-level re-entry roles' },
  { key: 'skillRefresher', label: 'Skill refresher recommendations' },
] as const;

export const MAX_GAP_SKILLS = 30;

export type GapPreferredSupport = {
  flexibleRole?: boolean;
  hybridRemote?: boolean;
  midLevelReEntry?: boolean;
  skillRefresher?: boolean;
};

export type CandidateGapExplanationRecord = {
  id?: string;
  gapCategory?: string;
  reasonForGap?: string;
  gapDuration?: string;
  selectedSkills?: string[];
  coursesText?: string;
  preferredSupport?: GapPreferredSupport;
};

function str(value: unknown): string {
  if (value === undefined || value === null) return '';
  return String(value).trim();
}

function parseSkills(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => str(item)).filter(Boolean);
  }
  const text = str(value);
  if (!text) return [];
  return text
    .split(/[,;]/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function parsePreferredSupport(value: unknown): GapPreferredSupport {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const row = value as Record<string, unknown>;
  return {
    flexibleRole: row.flexibleRole === true,
    hybridRemote: row.hybridRemote === true,
    midLevelReEntry: row.midLevelReEntry === true,
    skillRefresher: row.skillRefresher === true,
  };
}

export function formatGapReasonLabel(value: string): string {
  const match = GAP_REASON_OPTIONS.find((opt) => opt.value === value);
  return match?.label || value.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function getGapPreferredSupportLabels(support: GapPreferredSupport | undefined): string[] {
  if (!support) return [];
  return GAP_PREFERRED_SUPPORT_OPTIONS.filter(
    (option) => support[option.key as keyof GapPreferredSupport] === true,
  ).map((option) => option.label);
}

export function normalizeGapExplanationRecord(
  entry: Record<string, unknown> | CandidateGapExplanationRecord,
): CandidateGapExplanationRecord {
  const row = entry as Record<string, unknown>;
  return {
    id: str(row.id) || undefined,
    gapCategory: str(row.gapCategory),
    reasonForGap: str(row.reasonForGap),
    gapDuration: str(row.gapDuration),
    selectedSkills: parseSkills(row.selectedSkills ?? row.skills),
    coursesText: str(row.coursesText) || str(row.courses),
    preferredSupport: parsePreferredSupport(row.preferredSupport),
  };
}

export function gapExplanationRecordToSnapshotRow(
  entry: CandidateGapExplanationRecord,
): Record<string, unknown> {
  const normalized = normalizeGapExplanationRecord(entry);
  return {
    ...normalized,
    preferredSupport: {
      flexibleRole: normalized.preferredSupport?.flexibleRole === true,
      hybridRemote: normalized.preferredSupport?.hybridRemote === true,
      midLevelReEntry: normalized.preferredSupport?.midLevelReEntry === true,
      skillRefresher: normalized.preferredSupport?.skillRefresher === true,
    },
  };
}
