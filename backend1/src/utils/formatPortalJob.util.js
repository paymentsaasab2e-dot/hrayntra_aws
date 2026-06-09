/**
 * Candidate-facing job payload (Phase 1 portal).
 * Maps shared Mongo `jobs` documents (Phase 2 CRM fields included).
 */

function parseLanguages(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw
      .map((row) => {
        if (!row || typeof row !== 'object') return null;
        const language = String(row.language ?? row.name ?? '').trim();
        const proficiency = String(row.proficiency ?? row.level ?? '').trim();
        if (!language) return null;
        return { language, proficiency: proficiency || '—' };
      })
      .filter(Boolean);
  }
  return [];
}

function parseExperienceRange(experienceRequired) {
  const raw = String(experienceRequired || '').trim();
  if (!raw) return { min: null, max: null, display: null };
  const range = raw.match(/^(\d+)\s*-\s*(\d+)$/);
  if (range) {
    return {
      min: Number(range[1]),
      max: Number(range[2]),
      display: `${range[1]} – ${range[2]} years`,
    };
  }
  const single = raw.match(/^(\d+)$/);
  if (single) {
    return { min: Number(single[1]), max: null, display: `${single[1]}+ years` };
  }
  return { min: null, max: null, display: raw };
}

function shouldShowClientNamePublicly(job) {
  return job?.showClientNamePublicly !== false;
}

function formatPortalJob(job, options = {}) {
  if (!job) return null;

  const showClient = shouldShowClientNamePublicly(job);

  const salaryJson = job.salary || undefined;
  const salaryMin = job.salaryMin ?? salaryJson?.min ?? null;
  const salaryMax = job.salaryMax ?? salaryJson?.max ?? null;
  const salaryCurrency = job.salaryCurrency ?? salaryJson?.currency ?? null;
  const salaryType = job.salaryType ?? salaryJson?.type ?? null;

  const responsibilitiesArray = Array.isArray(job.keyResponsibilities)
    ? job.keyResponsibilities.filter(Boolean)
    : [];
  const responsibilitiesText =
    job.responsibilities ||
    (responsibilitiesArray.length ? responsibilitiesArray.join('\n') : undefined);

  const experience = parseExperienceRange(job.experienceRequired ?? job.experienceLevel);
  const thumb =
    typeof options.thumbnail === 'string'
      ? options.thumbnail
      : typeof options.thumbnailResolver === 'function'
        ? options.thumbnailResolver(job)
        : null;

  return {
    id: job.id,
    title: job.title,
    company: showClient ? job.company?.name || job.client?.companyName || null : null,
    companyId: showClient ? job.company?.id || job.client?.id || null : null,
    companyLogo: showClient ? thumb : null,
    showClientNamePublicly: showClient,
    applicationFormLogo: job.applicationFormLogo ?? undefined,
    applicationFormEnabled: !!job.applicationFormEnabled,
    applicationFormQuestions: Array.isArray(job.applicationFormQuestions)
      ? job.applicationFormQuestions
      : [],
    applicationFormNote: job.applicationFormNote ?? null,
    location: job.location ?? null,
    city: job.city ?? null,
    state: job.state ?? null,
    country: job.country ?? null,
    nationality: job.nationality ?? null,
    priority: job.priority ?? null,
    openings: job.openings ?? 1,
    hiringManager: job.hiringManager ?? null,
    hiringManagerId: job.hiringManagerId ?? null,
    clientId: job.clientId ?? null,
    salaryMin,
    salaryMax,
    salaryCurrency,
    salaryType,
    salary: job.salary ?? undefined,
    experienceLevel: job.experienceRequired ?? job.experienceLevel ?? null,
    experienceMin: experience.min,
    experienceMax: experience.max,
    experienceDisplay: experience.display,
    employmentType: job.type || job.employmentType || null,
    type: job.type ?? job.employmentType ?? undefined,
    workMode: job.jobLocationType ?? job.workMode ?? null,
    industry: job.industry ?? job.department ?? null,
    jobCategory: job.jobCategory ?? job.industry ?? job.department ?? null,
    aboutRole: job.aboutRole ?? job.overview ?? null,
    overview: job.overview ?? null,
    description: job.description ?? null,
    jobSummary: job.jobSummary ?? null,
    jobDescriptionHtml: job.jobDescriptionHtml ?? null,
    responsibilities: responsibilitiesText ?? null,
    keyResponsibilities: responsibilitiesArray,
    education: job.education ?? null,
    benefits: Array.isArray(job.benefits) ? job.benefits : [],
    skills: Array.isArray(job.skills) ? job.skills : [],
    preferredSkills: Array.isArray(job.preferredSkills) ? job.preferredSkills : [],
    requirements: Array.isArray(job.requirements) ? job.requirements : [],
    visaSponsorship: job.visaSponsorship ?? false,
    postedAt: job.postedAt ?? job.postedDate ?? job.createdAt ?? null,
    postedDate: job.postedDate ?? job.postedAt ?? job.createdAt ?? null,
    expectedClosureDate: job.expectedClosureDate ?? null,
    jdFileName: job.jdFileName ?? null,
    forecastRevenue: job.forecastRevenue ?? null,
    videoMediaLink: job.videoMediaLink ?? null,
    languages: parseLanguages(job.languages),
  };
}

module.exports = {
  formatPortalJob,
  shouldShowClientNamePublicly,
  parseLanguages,
  parseExperienceRange,
};
