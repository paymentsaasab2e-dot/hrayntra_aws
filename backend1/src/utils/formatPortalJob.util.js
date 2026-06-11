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

const CONFIDENTIAL_COMPANY_LABEL = '';

function shouldShowClientNamePublicly(job) {
  if (job?.showClientNamePublicly === false) return false;
  const visibility = job?.publicFieldVisibility;
  if (visibility && typeof visibility === 'object' && visibility.client === false) return false;
  return true;
}

function isPortalFieldVisible(job, field) {
  if (field === 'client') return shouldShowClientNamePublicly(job);
  const visibility = job?.publicFieldVisibility;
  if (!visibility || typeof visibility !== 'object') return true;
  return visibility[field] !== false;
}

function resolvePublicCompanyName(job, fallback = '') {
  if (!shouldShowClientNamePublicly(job)) {
    return '';
  }
  return job?.company?.name || job?.client?.companyName || fallback;
}

const DESCRIPTION_SECTION_STRIP_PATTERNS = {
  keyResponsibilities: [
    /^key responsibilities$/i,
    /^responsibilities$/i,
    /^role & responsibilities$/i,
  ],
  qualifications: [
    /^requirements$/i,
    /^required skills$/i,
    /^qualifications/i,
    /^preferred qualifications?$/i,
    /^preferred education/i,
  ],
  candidateRequirements: [/^candidate requirements?$/i],
  skills: [/^skills$/i, /^key skills$/i],
  benefits: [/^benefits$/i, /^compensation & benefits$/i, /^compensation$/i],
};

function stripHiddenDescriptionSections(html, patterns) {
  const source = String(html || '').trim();
  if (!source || !Array.isArray(patterns) || !patterns.length) return source;

  const parts = source.split(/(?=<h[1-3][^>]*>)/i);
  if (parts.length <= 1) return source;

  const kept = [];
  for (const part of parts) {
    const headingMatch = part.match(/^<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/i);
    if (!headingMatch) {
      kept.push(part);
      continue;
    }
    const headingText = String(headingMatch[1] || '')
      .replace(/<[^>]+>/g, '')
      .trim();
    const shouldStrip = patterns.some((pattern) => pattern.test(headingText));
    if (!shouldStrip) kept.push(part);
  }

  return kept.join('').trim();
}

function scrubDescriptionForVisibility(job, value) {
  if (!value || !isPortalFieldVisible(job, 'jobDescription')) return value;
  const patterns = [];
  if (!isPortalFieldVisible(job, 'keyResponsibilities')) {
    patterns.push(...DESCRIPTION_SECTION_STRIP_PATTERNS.keyResponsibilities);
  }
  if (!isPortalFieldVisible(job, 'qualifications')) {
    patterns.push(...DESCRIPTION_SECTION_STRIP_PATTERNS.qualifications);
  }
  if (!isPortalFieldVisible(job, 'candidateRequirements')) {
    patterns.push(...DESCRIPTION_SECTION_STRIP_PATTERNS.candidateRequirements);
  }
  if (!isPortalFieldVisible(job, 'skills')) {
    patterns.push(...DESCRIPTION_SECTION_STRIP_PATTERNS.skills);
  }
  if (!isPortalFieldVisible(job, 'jobDescription')) {
    return null;
  }
  if (!patterns.length) return value;
  return stripHiddenDescriptionSections(value, patterns) || null;
}

function redactPortalJobPayload(job, payload) {
  const out = { ...payload };
  if (!isPortalFieldVisible(job, 'jobTitle')) {
    out.title = null;
    out.jobTitle = null;
  }
  if (!isPortalFieldVisible(job, 'client')) {
    out.company = null;
    out.companyId = null;
    out.companyLogo = null;
    out.hiringManager = null;
    out.hiringManagerId = null;
    out.clientId = null;
  }
  if (!isPortalFieldVisible(job, 'location')) {
    out.location = null;
    out.city = null;
    out.state = null;
    out.country = null;
  }
  if (!isPortalFieldVisible(job, 'salary')) {
    out.salaryMin = null;
    out.salaryMax = null;
    out.salaryCurrency = null;
    out.salaryType = null;
    out.salary = undefined;
  }
  if (!isPortalFieldVisible(job, 'nationality')) out.nationality = null;
  if (!isPortalFieldVisible(job, 'priority')) out.priority = null;
  if (!isPortalFieldVisible(job, 'openings')) out.openings = null;
  if (!isPortalFieldVisible(job, 'employmentType')) {
    out.employmentType = null;
    out.type = undefined;
  }
  if (!isPortalFieldVisible(job, 'experience')) {
    out.experienceLevel = null;
    out.experienceMin = null;
    out.experienceMax = null;
    out.experienceDisplay = null;
  }
  if (!isPortalFieldVisible(job, 'languages')) out.languages = [];
  if (!isPortalFieldVisible(job, 'skills')) {
    out.skills = [];
    out.preferredSkills = [];
  }
  if (!isPortalFieldVisible(job, 'keyResponsibilities')) {
    out.keyResponsibilities = [];
    out.responsibilities = null;
  }
  if (!isPortalFieldVisible(job, 'qualifications')) {
    out.requirements = [];
    out.education = null;
  }
  if (!isPortalFieldVisible(job, 'candidateRequirements')) out.candidateRequirements = [];
  if (!isPortalFieldVisible(job, 'jobDescription')) {
    out.description = null;
    out.overview = null;
    out.jobSummary = null;
    out.jobDescriptionHtml = null;
    out.aboutRole = null;
    out.benefits = [];
  }
  if (!isPortalFieldVisible(job, 'videoMediaLink')) out.videoMediaLink = null;
  if (!isPortalFieldVisible(job, 'forecastRevenue')) out.forecastRevenue = null;
  if (!isPortalFieldVisible(job, 'contactPerson')) {
    out.hiringManager = null;
    out.hiringManagerId = null;
  }
  if (!isPortalFieldVisible(job, 'industryType')) {
    out.industry = null;
    out.jobCategory = null;
  }
  if (!isPortalFieldVisible(job, 'targetHireDate')) out.expectedClosureDate = null;

  if (out.description) {
    out.description = scrubDescriptionForVisibility(job, out.description);
  }
  if (out.overview) {
    out.overview = scrubDescriptionForVisibility(job, out.overview);
  }
  if (out.aboutRole) {
    out.aboutRole = scrubDescriptionForVisibility(job, out.aboutRole);
  }
  if (out.jobDescriptionHtml) {
    out.jobDescriptionHtml = scrubDescriptionForVisibility(job, out.jobDescriptionHtml);
  }

  return out;
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

  return redactPortalJobPayload(job, {
    id: job.id,
    title: job.title,
    company: showClient ? job.company?.name || job.client?.companyName || null : null,
    companyId: showClient ? job.company?.id || job.client?.id || null : null,
    companyLogo: showClient ? thumb : null,
    showClientNamePublicly: showClient,
    publicFieldVisibility:
      job.publicFieldVisibility && typeof job.publicFieldVisibility === 'object'
        ? job.publicFieldVisibility
        : null,
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
    candidateRequirements: Array.isArray(job.candidateRequirements)
      ? job.candidateRequirements
      : [],
    visaSponsorship: job.visaSponsorship ?? false,
    postedAt: job.postedAt ?? job.postedDate ?? job.createdAt ?? null,
    postedDate: job.postedDate ?? job.postedAt ?? job.createdAt ?? null,
    expectedClosureDate: job.expectedClosureDate ?? null,
    jdFileName: job.jdFileName ?? null,
    forecastRevenue: job.forecastRevenue ?? null,
    videoMediaLink: job.videoMediaLink ?? null,
    languages: parseLanguages(job.languages),
  });
}

module.exports = {
  formatPortalJob,
  shouldShowClientNamePublicly,
  resolvePublicCompanyName,
  CONFIDENTIAL_COMPANY_LABEL,
  parseLanguages,
  parseExperienceRange,
};
