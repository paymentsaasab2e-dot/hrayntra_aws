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
  'aboutCompany',
  'recruiterProfile',
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

/** Full visibility map for API save — every field explicit so nothing is lost in transit. */
export function buildPublicFieldVisibilityPayload(
  visibility: JobPublicFieldVisibility | null | undefined,
  showClientNamePublicly: boolean,
): Record<JobPublicVisibilityField, boolean> {
  const merged = mergeClientVisibility(parseJobPublicFieldVisibility(visibility), showClientNamePublicly);
  return Object.fromEntries(
    JOB_PUBLIC_VISIBILITY_FIELDS.map((key) => [key, merged[key] !== false]),
  ) as Record<JobPublicVisibilityField, boolean>;
}

/** Whether a parsed HTML JD section heading should appear on Phase 1 / public preview. */
export function htmlSectionTitleVisibleOnPortal(
  title: string,
  show: (field: JobPublicVisibilityField) => boolean,
): boolean {
  const normalized = String(title || '').trim().toLowerCase();
  if (/^job title$/.test(normalized)) return show('jobTitle');
  if (/key responsibilities|^responsibilities$|role & responsibilities/.test(normalized)) {
    return show('keyResponsibilities');
  }
  if (
    /^requirements$|^required skills$|qualifications|preferred education|preferred qualifications/.test(
      normalized,
    )
  ) {
    return show('qualifications');
  }
  if (/candidate requirements?/.test(normalized)) return show('candidateRequirements');
  if (/^skills$|^key skills$/.test(normalized)) return show('skills');
  if (/benefits|compensation/.test(normalized)) return show('jobDescription');
  if (/^overview$|^job summary$/.test(normalized)) return show('jobDescription');
  if (/^about (the )?company$|^company overview$|^about us$/.test(normalized)) {
    return show('aboutCompany');
  }
  return show('jobDescription');
}

export function resolveShowClientNamePublicly(
  visibility: JobPublicFieldVisibility | null | undefined,
  legacyShowClient?: boolean | null,
): boolean {
  if (legacyShowClient === false) return false;
  return isJobFieldPubliclyVisible(visibility, 'client', legacyShowClient ?? true);
}

/** Strip hidden job fields for public / Phase 1 views — no confidential placeholders. */
export function redactPublicJobPayload<T extends Record<string, unknown>>(
  job: T,
  options?: {
    showClientNamePublicly?: boolean;
    publicFieldVisibility?: Record<string, boolean> | null;
  },
): T {
  const visibility = parseJobPublicFieldVisibility(options?.publicFieldVisibility ?? job.publicFieldVisibility);
  const legacyShowClient =
    options?.showClientNamePublicly !== undefined
      ? options.showClientNamePublicly !== false
      : (job as { showClientNamePublicly?: boolean }).showClientNamePublicly !== false;
  const show = (field: JobPublicVisibilityField) =>
    isJobFieldPubliclyVisible(visibility, field, legacyShowClient);

  const out: Record<string, unknown> = { ...job };
  if (!show('jobTitle')) {
    out.title = null;
    out.jobTitle = null;
  }
  if (!show('client')) {
    out.company = null;
    out.companyLogo = null;
  }
  if (!show('location')) out.location = null;
  if (!show('salary')) out.salary = null;
  if (!show('experience')) out.experienceRequired = null;
  if (!show('employmentType')) out.employmentType = null;
  if (!show('openings')) out.openings = null;
  if (!show('skills')) {
    out.skills = [];
    out.preferredSkills = [];
  }
  if (!show('keyResponsibilities')) out.keyResponsibilities = [];
  if (!show('qualifications')) {
    out.requirements = [];
    out.education = null;
  }
  if (!show('candidateRequirements')) out.candidateRequirements = [];
  if (!show('jobDescription')) {
    out.description = null;
    out.overview = null;
    out.benefits = [];
  }
  if (!show('aboutCompany')) out.aboutCompany = null;
  if (!show('recruiterProfile')) out.recruiterProfile = null;
  return out as T;
}
