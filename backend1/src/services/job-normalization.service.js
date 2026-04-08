const SKILL_ALIASES = {
  'react.js': 'react',
  reactjs: 'react',
  reactnative: 'react native',
  'node.js': 'node',
  nodejs: 'node',
  'next.js': 'next',
  nextjs: 'next',
  'vue.js': 'vue',
  vuejs: 'vue',
  'express.js': 'express',
  expressjs: 'express',
  typescript: 'ts',
  javascript: 'js',
  postgresql: 'postgres',
  mongodb: 'mongo',
  tailwindcss: 'tailwind',
  'tailwind css': 'tailwind',
  ai: 'artificial intelligence',
  ml: 'machine learning',
};

const TOKEN_STOPWORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'but', 'by', 'for', 'from',
  'have', 'in', 'is', 'it', 'its', 'of', 'on', 'or', 'our', 'that', 'the',
  'their', 'this', 'to', 'we', 'with', 'you', 'your', 'will', 'can', 'all',
  'eg', 'etc', 'li', 'ul', 'ol', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p',
  'div', 'span', 'br', 'strong', 'em'
]);

const DOMAIN_KEYWORDS = {
  it: [
    'react', 'node', 'js', 'ts', 'frontend', 'backend', 'fullstack', 'developer',
    'software', 'web', 'api', 'mongo', 'express', 'git', 'cloud', 'devops',
    'engineering', 'engineer', 'programming', 'database', 'sql', 'python', 'java'
  ],
  pharmacy: [
    'pharmacy', 'pharmacist', 'clinicalpharmacist', 'drug', 'medicine', 'medicines',
    'dispensing', 'prescription', 'formulation', 'pharma', 'pharmaceutical',
    'hospitalpharmacy', 'patientcare', 'dosage', 'chemist'
  ],
  healthcare: [
    'healthcare', 'medical', 'nurse', 'doctor', 'clinic', 'hospital', 'health',
    'patient', 'biotech', 'diagnostic', 'therapist'
  ],
  finance: [
    'finance', 'financial', 'accounting', 'accountant', 'banking', 'investment',
    'tax', 'audit', 'payroll', 'treasury', 'analyst', 'equity'
  ],
  hr: [
    'hr', 'humanresources', 'recruiter', 'recruitment', 'talent', 'hiring',
    'peopleops', 'sourcing', 'interviewer', 'onboarding'
  ],
  marketing: [
    'marketing', 'seo', 'sem', 'content', 'brand', 'socialmedia', 'campaign',
    'digitalmarketing', 'copywriting', 'growth', 'performance'
  ],
  sales: [
    'sales', 'businessdevelopment', 'bdm', 'leadgeneration', 'accountmanager',
    'insidesales', 'outsidesales', 'closing', 'pipeline', 'clientacquisition'
  ],
  logistics: [
    'logistics', 'supplychain', 'warehouse', 'inventory', 'procurement', 'shipping',
    'transport', 'dispatch', 'operations'
  ],
};

const ROLE_CATEGORY_RULES = [
  { category: 'Frontend', patterns: ['frontend', 'react', 'angular', 'vue', 'ui', 'javascript', 'css', 'html'] },
  { category: 'Backend', patterns: ['backend', 'node', 'java', 'spring', 'api', 'server', 'django', 'express', 'php'] },
  { category: 'Full Stack', patterns: ['fullstack', 'full stack', 'mern', 'mean'] },
  { category: 'AI / ML', patterns: ['ai', 'artificial intelligence', 'machine learning', 'ml', 'deep learning', 'nlp', 'llm', 'data science'] },
  { category: 'Data', patterns: ['data', 'analytics', 'bi', 'sql', 'power bi', 'tableau', 'etl'] },
  { category: 'DevOps / Cloud', patterns: ['devops', 'cloud', 'aws', 'azure', 'gcp', 'kubernetes', 'docker', 'sre'] },
  { category: 'Management', patterns: ['manager', 'management', 'leadership', 'program manager', 'product manager', 'operations manager'] },
  { category: 'Leadership', patterns: ['cofounder', 'co-founder', 'founder', 'director', 'vp', 'head', 'chief', 'entrepreneur'] },
  { category: 'HR / Talent', patterns: ['recruiter', 'hr', 'human resources', 'talent', 'people operations'] },
  { category: 'Sales', patterns: ['sales', 'business development', 'account executive', 'account manager'] },
  { category: 'Marketing', patterns: ['marketing', 'seo', 'content', 'brand', 'growth'] },
];

const TITLE_NORMALIZATION_RULES = [
  { patterns: ['co-founder', 'cofounder', 'founder'], normalized: 'Entrepreneur / Leadership' },
  { patterns: ['frontend engineer', 'frontend developer', 'react developer', 'ui developer'], normalized: 'Frontend Engineer' },
  { patterns: ['backend engineer', 'backend developer', 'api developer', 'server engineer'], normalized: 'Backend Engineer' },
  { patterns: ['full stack', 'fullstack', 'mern developer', 'mean developer'], normalized: 'Full Stack Engineer' },
  { patterns: ['product manager', 'program manager'], normalized: 'Product / Program Management' },
  { patterns: ['recruiter', 'talent acquisition', 'talent partner'], normalized: 'Recruitment / Talent' },
  { patterns: ['data scientist', 'ml engineer', 'ai engineer'], normalized: 'AI / Data Science' },
];

function normalizeSkill(skill) {
  if (!skill || typeof skill !== 'string') return '';
  const cleaned = skill
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[|,;]+/g, ' ')
    .replace(/\s+/g, ' ');

  const aliasKey = cleaned.replace(/[\s.-]+/g, '');
  return SKILL_ALIASES[cleaned] || SKILL_ALIASES[aliasKey] || cleaned;
}

function uniqueNormalized(values = []) {
  return Array.from(
    new Set(
      values
        .flatMap((value) => Array.isArray(value) ? value : [value])
        .filter((value) => typeof value === 'string')
        .map((value) => value.trim())
        .filter(Boolean)
    )
  );
}

function tokenizeText(value) {
  if (!value || typeof value !== 'string') return [];
  return value
    .replace(/<[^>]+>/g, ' ')
    .toLowerCase()
    .split(/[^a-z0-9+#.\-/]+/i)
    .map((part) => normalizeSkill(part))
    .filter((part) => part && part.length > 1 && !TOKEN_STOPWORDS.has(part));
}

function normalizeWorkMode(value) {
  if (!value || typeof value !== 'string') return null;
  const normalized = value.toUpperCase().replace(/[\s-]+/g, '_');
  if (normalized.includes('REMOTE')) return 'REMOTE';
  if (normalized.includes('HYBRID')) return 'HYBRID';
  if (normalized.includes('ON_SITE') || normalized.includes('ONSITE') || normalized.includes('OFFICE')) return 'ON_SITE';
  return normalized;
}

function parseExperienceYears(requiredExp) {
  if (requiredExp == null) return 0;
  if (typeof requiredExp === 'number') return requiredExp;
  if (typeof requiredExp !== 'string') return 0;
  const matches = requiredExp.match(/(\d+(?:\.\d+)?)/g);
  if (!matches || matches.length === 0) return 0;
  return Number.parseFloat(matches[0]) || 0;
}

function inferExperienceLevel({ years = 0, title = '', description = '' } = {}) {
  const corpus = `${title} ${description}`.toLowerCase();
  if (/(chief|vp|head|director|principal|staff)/.test(corpus) || years >= 10) return 'executive';
  if (/(lead|senior|sr\b)/.test(corpus) || years >= 6) return 'senior';
  if (/(mid|intermediate)/.test(corpus) || years >= 3) return 'mid';
  return 'entry';
}

function normalizeEducationLevel(value) {
  if (!value || typeof value !== 'string') return null;
  const normalized = value.toLowerCase();
  if (/(phd|doctorate)/.test(normalized)) return 'doctorate';
  if (/(master|mba|m\.tech|mtech|ms|m\.s)/.test(normalized)) return 'masters';
  if (/(bachelor|b\.tech|btech|b\.e|be|bsc|b\.sc|ba|b\.a)/.test(normalized)) return 'bachelors';
  if (/(diploma|associate)/.test(normalized)) return 'diploma';
  if (/(high school|intermediate|12th|secondary)/.test(normalized)) return 'school';
  return normalized.trim();
}

function educationLevelToRank(value) {
  const normalized = normalizeEducationLevel(value);
  switch (normalized) {
    case 'doctorate':
      return 5;
    case 'masters':
      return 4;
    case 'bachelors':
      return 3;
    case 'diploma':
      return 2;
    case 'school':
      return 1;
    default:
      return 0;
  }
}

function experienceLevelToRank(value) {
  if (typeof value === 'number') {
    if (value >= 10) return 5;
    if (value >= 6) return 4;
    if (value >= 3) return 3;
    if (value >= 1) return 2;
    return 1;
  }

  if (!value || typeof value !== 'string') return 0;
  const normalized = value.toLowerCase();
  if (normalized === 'executive') return 5;
  if (normalized === 'senior') return 4;
  if (normalized === 'mid') return 3;
  if (normalized === 'entry') return 2;
  return 0;
}

function normalizeLocation(value) {
  if (!value || typeof value !== 'string') return { raw: null, normalized: null, tokens: [] };
  const cleaned = value.replace(/\s+/g, ' ').trim();
  return {
    raw: value,
    normalized: cleaned.toLowerCase(),
    tokens: cleaned.toLowerCase().split(/[,\s/()-]+/).filter(Boolean),
  };
}

function normalizeSalary({ min, max, currency, type } = {}) {
  return {
    min: typeof min === 'number' ? min : null,
    max: typeof max === 'number' ? max : null,
    currency: currency || null,
    type: type || null,
  };
}

function normalizeJobTitle(title) {
  if (!title || typeof title !== 'string') return null;
  const normalized = title.trim().toLowerCase();
  const matched = TITLE_NORMALIZATION_RULES.find((rule) =>
    rule.patterns.some((pattern) => normalized.includes(pattern))
  );
  return matched?.normalized || title.trim();
}

function inferRoleCategories(values = []) {
  const corpus = uniqueNormalized(values).join(' ').toLowerCase();
  const categories = ROLE_CATEGORY_RULES
    .filter((rule) => rule.patterns.some((pattern) => corpus.includes(pattern)))
    .map((rule) => rule.category);

  return categories.length > 0 ? Array.from(new Set(categories)) : ['General'];
}

function inferDomainFamily(values = []) {
  const tokenCounts = new Map();

  values
    .flatMap((value) => Array.isArray(value) ? value : [value])
    .flatMap((value) => typeof value === 'string' ? tokenizeText(value) : [])
    .forEach((token) => {
      for (const [domain, domainTokens] of Object.entries(DOMAIN_KEYWORDS)) {
        if (domainTokens.includes(token)) {
          tokenCounts.set(domain, (tokenCounts.get(domain) || 0) + 1);
        }
      }
    });

  const rankedDomains = Array.from(tokenCounts.entries()).sort((a, b) => b[1] - a[1]);
  const [topDomain, topScore] = rankedDomains[0] || [];

  return {
    primary: topScore >= 2 ? topDomain : null,
    rankedDomains,
  };
}

function isProbablyInvalidUrl(url, { requireProfessionalHost = false } = {}) {
  if (!url || typeof url !== 'string') return true;
  try {
    const parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
    const host = parsed.hostname.toLowerCase();
    if (['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com'].includes(host)) return true;
    if (requireProfessionalHost && !host.includes('linkedin.com')) return true;
    return false;
  } catch (error) {
    return true;
  }
}

function buildAutoSummary(parts = []) {
  const cleanParts = uniqueNormalized(parts).slice(0, 4);
  return cleanParts.join(' | ') || 'Profile summary inferred from resume and profile data.';
}

function summarizeCandidate(candidate) {
  const resumeJson = candidate.resume?.resumeJson || {};
  const resumeSkills = Array.isArray(resumeJson.skills)
    ? resumeJson.skills
    : [
        ...(Array.isArray(resumeJson.skills?.technical) ? resumeJson.skills.technical : []),
        ...(Array.isArray(resumeJson.skills?.soft) ? resumeJson.skills.soft : []),
      ];
  const projectTechnologies = Array.isArray(candidate.project?.technologies) ? candidate.project.technologies : [];
  const certificationNames = (candidate.certifications || []).map((certification) =>
    certification.certificationName || certification.issuingOrganization
  );
  const workTitles = (candidate.workExperiences || []).map((item) => item.jobTitle).filter(Boolean);
  const educationTitles = (candidate.educations || []).map((item) =>
    [item.degree, item.fieldOfStudy, item.institution].filter(Boolean).join(' - ')
  );
  const preferredRoles = candidate.careerPreferences?.preferredRoles || [];
  const preferredLocations = candidate.careerPreferences?.preferredLocations || [];

  const normalizedSkills = uniqueNormalized([
    candidate.recruiterSkills || [],
    candidate.certificationsList || [],
    candidate.recruiterLanguages || [],
    (candidate.skills || []).map((skillItem) => skillItem.skill?.name || skillItem.name),
    resumeSkills,
    projectTechnologies,
    certificationNames,
  ]).map(normalizeSkill).filter(Boolean);

  const currentTitle = candidate.currentTitle || candidate.designation || workTitles[0] || null;
  const normalizedCurrentTitle = normalizeJobTitle(currentTitle);
  const currentLocation = candidate.profile?.city || candidate.city || candidate.location || null;
  const preferredWorkMode = normalizeWorkMode(candidate.careerPreferences?.preferredWorkMode || candidate.availability);
  const candidateExperience =
    candidate.experienceYears ??
    candidate.profile?.totalExperience ??
    (candidate.workExperiences?.length || 0) * 1.5;

  const rawSummary = uniqueNormalized([candidate.summary?.summaryText, candidate.cvSummary]).join(' | ');
  const generatedSummary = rawSummary || buildAutoSummary([
    normalizedCurrentTitle,
    workTitles[0],
    normalizedSkills.slice(0, 6).join(', '),
    candidate.profile?.city,
  ]);

  const roleCategories = inferRoleCategories([
    currentTitle,
    normalizedCurrentTitle,
    workTitles,
    preferredRoles,
    normalizedSkills,
    rawSummary,
  ]);

  const domainInference = inferDomainFamily([
    currentTitle,
    normalizedCurrentTitle,
    workTitles,
    educationTitles,
    rawSummary,
    normalizedSkills,
  ]);

  const keywords = Array.from(new Set([
    ...normalizedSkills,
    ...tokenizeText([
      currentTitle,
      normalizedCurrentTitle,
      currentLocation,
      generatedSummary,
      preferredRoles.join(' '),
      preferredLocations.join(' '),
      educationTitles.join(' '),
    ].filter(Boolean).join(' ')),
  ]));

  const normalizedEducationLevels = (candidate.educations || [])
    .map((item) => normalizeEducationLevel(item.degree || item.fieldOfStudy))
    .filter(Boolean);

  const linkedinUrl = candidate.profile?.linkedinUrl || candidate.linkedinUrl || null;
  const portfolioUrl = candidate.profile?.portfolioUrl || candidate.portfolioUrl || null;

  return {
    id: candidate.id,
    name:
      candidate.profile?.fullName ||
      [candidate.firstName, candidate.lastName].filter(Boolean).join(' ') ||
      'Candidate',
    email: candidate.profile?.email || candidate.email || null,
    currentTitle,
    normalizedCurrentTitle,
    currentLocation,
    normalizedLocation: normalizeLocation(currentLocation),
    candidateExperience,
    experienceLevel: inferExperienceLevel({ years: candidateExperience, title: currentTitle, description: generatedSummary }),
    preferredRoles: uniqueNormalized(preferredRoles),
    preferredLocations: uniqueNormalized([preferredLocations, candidate.preferredLocation]),
    preferredIndustry: candidate.careerPreferences?.preferredIndustry || null,
    preferredWorkMode,
    currentSalary: candidate.currentSalary ?? candidate.careerPreferences?.currentSalary ?? null,
    expectedSalary: candidate.expectedSalary ?? candidate.careerPreferences?.preferredSalary ?? null,
    availabilityToStart: candidate.careerPreferences?.availabilityToStart || candidate.noticePeriod || candidate.availability || null,
    openToRelocation: Boolean(candidate.careerPreferences?.openToRelocation),
    workTitles: uniqueNormalized(workTitles),
    normalizedSkills: Array.from(new Set(normalizedSkills)),
    roleCategories,
    domainFamily: domainInference.primary,
    domainSignals: domainInference.rankedDomains,
    educationLevel: normalizedEducationLevels[0] || null,
    educationLevels: normalizedEducationLevels,
    workModePreference: preferredWorkMode,
    keywords,
    summaryText: generatedSummary,
    linkedinUrl: isProbablyInvalidUrl(linkedinUrl, { requireProfessionalHost: true }) ? null : linkedinUrl,
    portfolioUrl: isProbablyInvalidUrl(portfolioUrl) ? null : portfolioUrl,
    dataQuality: {
      inferredSummary: !rawSummary,
      inferredPreferredRoles: !preferredRoles.length && roleCategories.length > 0,
      invalidLinkedin: Boolean(linkedinUrl) && isProbablyInvalidUrl(linkedinUrl, { requireProfessionalHost: true }),
      invalidPortfolio: Boolean(portfolioUrl) && isProbablyInvalidUrl(portfolioUrl),
    },
    structuredProfile: {
      skills: Array.from(new Set(normalizedSkills)),
      roleCategories,
      experienceLevel: inferExperienceLevel({ years: candidateExperience, title: currentTitle, description: generatedSummary }),
      educationLevel: normalizedEducationLevels[0] || null,
      locationPreference: uniqueNormalized([preferredLocations, currentLocation]),
      workModePreference: preferredWorkMode,
    },
    rawSnapshot: {
      profile: candidate.profile || null,
      careerPreferences: candidate.careerPreferences || null,
      summary: candidate.summary || null,
      workExperiences: candidate.workExperiences || [],
      educations: candidate.educations || [],
      project: candidate.project || null,
      internship: candidate.internship || null,
      certifications: candidate.certifications || [],
      resume: candidate.resume || null,
    },
  };
}

function summarizeJob(job) {
  const requiredSkills = uniqueNormalized([
    job.skills || [],
    job.requirements || [],
    job.keyResponsibilities || [],
  ]);
  const preferredSkills = uniqueNormalized(job.preferredSkills || []);
  const responsibilities = uniqueNormalized([
    job.responsibilities,
    job.description,
    job.overview,
    job.aboutRole,
    job.keyResponsibilities || [],
  ]);

  const normalizedTitle = normalizeJobTitle(job.title);
  const normalizedRequiredSkills = requiredSkills.map(normalizeSkill).filter(Boolean);
  const normalizedPreferredSkills = preferredSkills.map(normalizeSkill).filter(Boolean);
  const roleCategories = inferRoleCategories([
    job.title,
    normalizedTitle,
    job.department,
    job.jobCategory,
    requiredSkills,
    preferredSkills,
    responsibilities,
  ]);
  const requiredExperienceYears = parseExperienceYears(job.experienceRequired || job.experienceLevel || '');
  const experienceLevel = inferExperienceLevel({
    years: requiredExperienceYears,
    title: job.title,
    description: [job.description, job.overview, job.aboutRole].filter(Boolean).join(' '),
  });

  const titleKeywords = tokenizeText([
    job.title,
    normalizedTitle,
    job.department,
    job.jobCategory,
    job.industry,
    job.hiringManager,
  ].filter(Boolean).join(' '));
  const descriptionKeywords = responsibilities.flatMap(tokenizeText);
  const domainInference = inferDomainFamily([
    job.title,
    normalizedTitle,
    job.department,
    job.jobCategory,
    job.industry,
    job.education,
    job.description,
    requiredSkills,
    preferredSkills,
    responsibilities,
  ]);

  return {
    id: job.id,
    title: job.title,
    normalizedTitle,
    company: job.company?.name || job.client?.companyName || 'Unknown Company',
    location: job.location || null,
    normalizedLocation: normalizeLocation(job.location || null),
    workMode: normalizeWorkMode(job.workMode || job.jobLocationType),
    employmentType: job.type || job.employmentType || null,
    jobType: job.type || job.employmentType || null,
    industry: job.industry || job.department || job.jobCategory || null,
    department: job.department || null,
    experienceRequired: job.experienceRequired || job.experienceLevel || null,
    requiredExperienceYears,
    experienceLevel,
    education: job.education || null,
    educationRequirement: normalizeEducationLevel(job.education || null),
    salary: normalizeSalary({
      min: job.salaryMin ?? job.salary?.min ?? null,
      max: job.salaryMax ?? job.salary?.max ?? null,
      currency: job.salaryCurrency ?? job.salary?.currency ?? null,
      type: job.salaryType ?? job.salary?.type ?? null,
    }),
    salaryMin: job.salaryMin ?? job.salary?.min ?? null,
    salaryMax: job.salaryMax ?? job.salary?.max ?? null,
    salaryCurrency: job.salaryCurrency ?? job.salary?.currency ?? null,
    salaryType: job.salaryType ?? job.salary?.type ?? null,
    visaSponsorship: Boolean(job.visaSponsorship),
    postedAt: job.postedAt || job.createdAt || job.updatedAt || null,
    normalizedRequiredSkills,
    normalizedPreferredSkills,
    roleCategories,
    domainFamily: domainInference.primary,
    domainSignals: domainInference.rankedDomains,
    titleKeywords,
    descriptionKeywords,
    keywords: Array.from(new Set([
      ...normalizedRequiredSkills,
      ...normalizedPreferredSkills,
      ...titleKeywords,
      ...descriptionKeywords,
    ])),
    responsibilities,
    structuredProfile: {
      requiredSkills: normalizedRequiredSkills,
      preferredSkills: normalizedPreferredSkills,
      roleCategories,
      requiredExperienceLevel: experienceLevel,
      location: normalizeLocation(job.location || null),
      workMode: normalizeWorkMode(job.workMode || job.jobLocationType),
      educationRequirement: normalizeEducationLevel(job.education || null),
    },
    rawSnapshot: {
      title: job.title,
      description: job.description || null,
      overview: job.overview || job.aboutRole || null,
      responsibilities: job.responsibilities || null,
      keyResponsibilities: job.keyResponsibilities || [],
      skills: job.skills || [],
      preferredSkills: job.preferredSkills || [],
      requirements: job.requirements || [],
      benefits: job.benefits || [],
      education: job.education || null,
      experienceRequired: job.experienceRequired || job.experienceLevel || null,
      workMode: job.workMode || job.jobLocationType || null,
      location: job.location || null,
      industry: job.industry || job.department || job.jobCategory || null,
      salary: job.salary || null,
    },
  };
}

module.exports = {
  normalizeSkill,
  uniqueNormalized,
  tokenizeText,
  normalizeWorkMode,
  parseExperienceYears,
  experienceLevelToRank,
  normalizeEducationLevel,
  educationLevelToRank,
  normalizeJobTitle,
  inferRoleCategories,
  inferDomainFamily,
  summarizeCandidate,
  summarizeJob,
};
