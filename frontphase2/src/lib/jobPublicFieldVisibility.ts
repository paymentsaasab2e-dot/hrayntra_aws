export const JOB_PUBLIC_VISIBILITY_FIELDS = [
  'nationality',
  'jobTitle',
  'client',
  'contactPerson',
  'openings',
  'location',
  'industryType',
  'employmentType',
  'targetHireDate',
  'experience',
  'salary',
  'languages',
  'keyResponsibilities',
  'qualifications',
  'candidateRequirements',
  'skills',
  'jobDescription',
  'videoMediaLink',
  'forecastRevenue',
  'priority',
] as const;

export type JobPublicVisibilityField = (typeof JOB_PUBLIC_VISIBILITY_FIELDS)[number];

export type JobPublicFieldVisibility = Partial<Record<JobPublicVisibilityField, boolean>>;

export const DEFAULT_JOB_PUBLIC_FIELD_VISIBILITY: JobPublicFieldVisibility = Object.fromEntries(
  JOB_PUBLIC_VISIBILITY_FIELDS.map((key) => [key, true]),
) as JobPublicFieldVisibility;

export function parseJobPublicFieldVisibility(raw: unknown): JobPublicFieldVisibility {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ...DEFAULT_JOB_PUBLIC_FIELD_VISIBILITY };
  }
  const source = raw as Record<string, unknown>;
  const merged: JobPublicFieldVisibility = { ...DEFAULT_JOB_PUBLIC_FIELD_VISIBILITY };
  for (const key of JOB_PUBLIC_VISIBILITY_FIELDS) {
    if (source[key] === false) merged[key] = false;
    else if (source[key] === true) merged[key] = true;
  }
  return merged;
}

export function isJobFieldPubliclyVisible(
  visibility: JobPublicFieldVisibility | null | undefined,
  field: JobPublicVisibilityField,
  legacyShowClient?: boolean,
): boolean {
  if (field === 'client') {
    if (legacyShowClient === false) return false;
    if (visibility?.client === false) return false;
    return true;
  }
  if (!visibility) return true;
  return visibility[field] !== false;
}

export function toggleJobPublicFieldVisibility(
  visibility: JobPublicFieldVisibility,
  field: JobPublicVisibilityField,
): JobPublicFieldVisibility {
  const currentlyVisible = isJobFieldPubliclyVisible(
    visibility,
    field,
    field === 'client' ? visibility.client !== false : undefined,
  );
  return {
    ...visibility,
    [field]: !currentlyVisible,
  };
}

export function mergeClientVisibility(
  visibility: JobPublicFieldVisibility,
  showClientNamePublicly: boolean,
): JobPublicFieldVisibility {
  return {
    ...visibility,
    client: showClientNamePublicly,
  };
}

export function resolveShowClientNamePublicly(
  visibility: JobPublicFieldVisibility | null | undefined,
  legacyShowClient?: boolean | null,
): boolean {
  if (legacyShowClient === false) return false;
  return isJobFieldPubliclyVisible(visibility, 'client', legacyShowClient ?? true);
}
