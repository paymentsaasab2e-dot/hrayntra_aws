const OpenAI = require('openai');
const { prisma } = require('../lib/prisma');

const apiKey = process.env.OPENAI_API_KEY;
const openai = apiKey ? new OpenAI({ apiKey }) : null;

// Normalization maps for known variants
const SKILL_ALIASES = {
  'react.js': 'react', 'reactjs': 'react',
  'node.js': 'node', 'nodejs': 'node',
  'next.js': 'next', 'nextjs': 'next',
  'vue.js': 'vue', 'vuejs': 'vue',
  'express.js': 'express', 'expressjs': 'express',
  'typescript': 'ts',
  'postgresql': 'postgres',
  'mongodb': 'mongo',
  'tailwindcss': 'tailwind', 'tailwind css': 'tailwind',
};

/**
 * Step 1: Normalize skill strings
 */
function normalizeSkill(skill) {
  if (!skill || typeof skill !== 'string') return '';
  let cleaned = skill.toLowerCase()
    .replace(/\.js$/i, '')
    .trim()
    .replace(/[\.\-\s]+/g, '');
  return SKILL_ALIASES[cleaned] || cleaned;
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
    .toLowerCase()
    .split(/[^a-z0-9+#.\-/]+/i)
    .map((part) => normalizeSkill(part))
    .filter(Boolean);
}

function normalizeWorkMode(value) {
  if (!value || typeof value !== 'string') return null;
  const normalized = value.toUpperCase().replace(/[\s-]+/g, '_');
  if (normalized.includes('REMOTE')) return 'REMOTE';
  if (normalized.includes('HYBRID')) return 'HYBRID';
  if (normalized.includes('ON_SITE') || normalized.includes('ONSITE') || normalized.includes('OFFICE')) {
    return 'ON_SITE';
  }
  return normalized;
}

function parseRequiredExperience(requiredExp) {
  if (!requiredExp || typeof requiredExp !== 'string') return 0;
  const matches = requiredExp.match(/(\d+(?:\.\d+)?)/g);
  if (!matches || matches.length === 0) return 0;
  return Number.parseFloat(matches[0]) || 0;
}

function formatDateSafe(value) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function summarizeCandidate(candidate) {
  const resumeJson = candidate.resume?.resumeJson || {};
  const resumeSkills = Array.isArray(resumeJson.skills)
    ? resumeJson.skills
    : [
        ...(Array.isArray(resumeJson.skills?.technical) ? resumeJson.skills.technical : []),
        ...(Array.isArray(resumeJson.skills?.soft) ? resumeJson.skills.soft : []),
      ];
  const projectTechnologies = Array.isArray(candidate.project?.technologies)
    ? candidate.project.technologies
    : [];
  const certificationNames = (candidate.certifications || []).map(
    (certification) => certification.certificationName || certification.issuingOrganization
  );
  const workTitles = (candidate.workExperiences || []).map((item) => item.jobTitle);
  const educationTitles = (candidate.educations || []).map(
    (item) => [item.degree, item.fieldOfStudy, item.institution].filter(Boolean).join(' - ')
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

  const textCorpus = uniqueNormalized([
    candidate.currentTitle,
    candidate.currentCompany,
    candidate.location,
    candidate.preferredLocation,
    candidate.designation,
    candidate.cvSummary,
    candidate.summary?.summaryText,
    candidate.recruiterEducation,
    candidate.recruiterNotes,
    candidate.profile?.skillsAdditionalNotes,
    candidate.profile?.city,
    candidate.profile?.country,
    candidate.internship?.internshipTitle,
    candidate.internship?.domainDepartment,
    candidate.internship?.responsibilities,
    candidate.internship?.learnings,
    candidate.project?.projectTitle,
    candidate.project?.projectType,
    candidate.project?.projectDescription,
    candidate.project?.responsibilities,
    candidate.project?.projectOutcome,
    candidate.gapExplanation?.reasonForGap,
    candidate.gapExplanation?.selectedSkills || [],
    candidate.visaWorkAuthorization?.selectedDestination,
    candidate.visaWorkAuthorization?.additionalRemarks,
    workTitles,
    educationTitles,
    preferredRoles,
    preferredLocations,
    candidate.assignedJobs || [],
  ]);

  const combinedTokens = new Set([
    ...normalizedSkills,
    ...textCorpus.flatMap(tokenizeText),
  ]);

  const currentSalary = candidate.currentSalary ?? candidate.careerPreferences?.currentSalary ?? null;
  const expectedSalary = candidate.expectedSalary ?? candidate.careerPreferences?.preferredSalary ?? null;
  const currentLocation = candidate.profile?.city || candidate.city || candidate.location || null;
  const preferredWorkMode = normalizeWorkMode(candidate.careerPreferences?.preferredWorkMode || candidate.availability);
  const candidateExperience =
    candidate.experienceYears ??
    candidate.profile?.totalExperience ??
    (candidate.workExperiences?.length || 0) * 1.5;

  return {
    id: candidate.id,
    name:
      candidate.profile?.fullName ||
      [candidate.firstName, candidate.lastName].filter(Boolean).join(' ') ||
      'Candidate',
    email: candidate.profile?.email || candidate.email || null,
    currentTitle: candidate.currentTitle || candidate.designation || workTitles[0] || null,
    currentLocation,
    candidateExperience,
    preferredRoles: uniqueNormalized(preferredRoles),
    preferredLocations: uniqueNormalized([preferredLocations, candidate.preferredLocation]),
    preferredIndustry: candidate.careerPreferences?.preferredIndustry || null,
    preferredWorkMode,
    currentSalary,
    expectedSalary,
    availabilityToStart:
      candidate.careerPreferences?.availabilityToStart ||
      candidate.noticePeriod ||
      candidate.availability ||
      null,
    openToRelocation: Boolean(candidate.careerPreferences?.openToRelocation),
    workTitles: uniqueNormalized(workTitles),
    normalizedSkills: Array.from(new Set(normalizedSkills)),
    keywords: Array.from(combinedTokens),
    summaryText: uniqueNormalized([candidate.summary?.summaryText, candidate.cvSummary]).join(' | '),
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
  const titleKeywords = tokenizeText([
    job.title,
    job.department,
    job.jobCategory,
    job.industry,
    job.hiringManager,
  ].filter(Boolean).join(' '));
  const descriptionKeywords = responsibilities.flatMap(tokenizeText);
  const normalizedRequiredSkills = requiredSkills.map(normalizeSkill).filter(Boolean);
  const normalizedPreferredSkills = preferredSkills.map(normalizeSkill).filter(Boolean);

  return {
    id: job.id,
    title: job.title,
    company: job.company?.name || job.client?.companyName || 'Unknown Company',
    location: job.location || null,
    workMode: normalizeWorkMode(job.workMode || job.jobLocationType),
    employmentType: job.type || job.employmentType || null,
    industry: job.industry || job.department || job.jobCategory || null,
    department: job.department || null,
    experienceRequired: job.experienceRequired || job.experienceLevel || null,
    requiredExperienceYears: parseRequiredExperience(job.experienceRequired || job.experienceLevel || ''),
    education: job.education || null,
    salaryMin: job.salaryMin ?? job.salary?.min ?? null,
    salaryMax: job.salaryMax ?? job.salary?.max ?? null,
    salaryCurrency: job.salaryCurrency ?? job.salary?.currency ?? null,
    salaryType: job.salaryType ?? job.salary?.type ?? null,
    visaSponsorship: Boolean(job.visaSponsorship),
    postedAt: formatDateSafe(job.postedAt || job.createdAt || job.updatedAt),
    normalizedRequiredSkills,
    normalizedPreferredSkills,
    titleKeywords,
    descriptionKeywords,
    keywords: Array.from(
      new Set([
        ...normalizedRequiredSkills,
        ...normalizedPreferredSkills,
        ...titleKeywords,
        ...descriptionKeywords,
      ])
    ),
    responsibilities,
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

function calculateKeywordOverlap(candidateKeywords, jobKeywords) {
  if (!jobKeywords.length) return { score: 60, matches: [] };
  const candidateSet = new Set(candidateKeywords.map(normalizeSkill).filter(Boolean));
  const matched = jobKeywords.filter((item) => candidateSet.has(normalizeSkill(item)));
  return {
    score: Math.round((matched.length / Math.max(jobKeywords.length, 1)) * 100),
    matches: Array.from(new Set(matched)).slice(0, 20),
  };
}

function calculatePreferenceScore(candidateSummary, jobSummary) {
  let score = 50;
  const reasons = [];

  if (
    candidateSummary.preferredRoles.length > 0 &&
    candidateSummary.preferredRoles.some((role) =>
      tokenizeText(role).some((token) => jobSummary.keywords.includes(token))
    )
  ) {
    score += 20;
    reasons.push('preferred-role');
  }

  if (
    candidateSummary.preferredIndustry &&
    tokenizeText(candidateSummary.preferredIndustry).some((token) => jobSummary.keywords.includes(token))
  ) {
    score += 10;
    reasons.push('preferred-industry');
  }

  if (
    candidateSummary.preferredLocations.length > 0 &&
    jobSummary.location &&
    candidateSummary.preferredLocations.some((location) =>
      jobSummary.location.toLowerCase().includes(location.toLowerCase())
    )
  ) {
    score += 10;
    reasons.push('preferred-location');
  }

  if (
    candidateSummary.expectedSalary &&
    jobSummary.salaryMax &&
    jobSummary.salaryMax >= candidateSummary.expectedSalary
  ) {
    score += 10;
    reasons.push('salary-fit');
  }

  if (
    candidateSummary.preferredWorkMode &&
    jobSummary.workMode &&
    candidateSummary.preferredWorkMode === jobSummary.workMode
  ) {
    score += 10;
    reasons.push('work-mode-fit');
  }

  return { score: Math.min(100, score), reasons };
}

/**
 * Weighted Skill Scoring
 */
function calculateWeightedSkillScore(candidateSkillSet, requiredSkills, preferredSkills) {
  if (!requiredSkills.length) return { score: 100, matched: [], missing: [], penalties: 0 };
  
  // Weight Map logic (simplified for now, can be expanded)
  // Core (1.0), Secondary (0.7) - We treat first 3 required as CORE
  let totalRequiredWeight = 0;
  let matchedWeight = 0;
  const matched = [];
  const missing = [];

  requiredSkills.forEach((skill, index) => {
    const weight = index < 3 ? 1.0 : 0.7;
    totalRequiredWeight += weight;
    if (candidateSkillSet.has(skill)) {
      matchedWeight += weight;
      matched.push(skill);
    } else {
      missing.push(skill);
    }
  });

  let score = (matchedWeight / totalRequiredWeight) * 100;
  
  // Negative Scoring (Penalty)
  const penalty = missing.length * 4;
  score = Math.max(0, score - penalty);

  return { score, matched, missing, penalty };
}

/**
 * Calculate Experience Check with Gear/Role Progression Logic
 */
function calculateExperienceScore(candidateExp, requiredExp, level) {
  let score = 100;
  let penalty = 0;

  if (candidateExp < (requiredExp - 2)) {
    penalty = 20; // Experience Gap Penalty
    score -= penalty;
  } else if (candidateExp < requiredExp) {
    score = (candidateExp / requiredExp) * 100;
  }

  // Role Progression Penalty (Intern -> Senior)
  if (requiredExp - candidateExp > 4) {
    score = Math.max(10, score - 30);
  }

  return { score: Math.max(5, score), penalty };
}

/**
 * Location and Work mode fit
 */
function calculateLocationScore(candidate, job) {
  let score = 40;
  if (job.workMode === 'REMOTE') score = 100;
  else if (job.workMode === 'HYBRID') score = 80;
  else if (job.location && candidate.profile?.city && job.location.toLowerCase() === candidate.profile.city.toLowerCase()) {
    score = 100;
  }
  
  if (candidate.careerPreferences?.preferredWorkMode === job.workMode) {
    score = Math.min(100, score + 10);
  }
  return score;
}

/**
 * Build rich context for embeddings
 */
function buildRichContext(type, data) {
  if (type === 'job') {
    return `Title: ${data.title}. Skills: ${(data.skills || []).join(', ')}. Responsibilities: ${(data.keyResponsibilities || []).join(' ')}. Industry: ${data.industry || ''}. Description: ${data.description || ''}`.substring(0, 1500);
  } else {
    // candidate
    const skills = (data.skills || []).map(s => s.skill?.name || s).join(', ');
    const roles = (data.workExperiences || []).map(we => we.jobTitle).join(', ');
    return `Roles: ${roles}. Skills: ${skills}. Summary: ${data.summary?.summaryText || ''}`.substring(0, 1500);
  }
}

// Caches
const embeddingCache = new Map();
const gptCache = new Map();

/**
 * Step 1: Rule-Based Match (Fast)
 */
async function getRuleScore(candidate, job) {
  const candidateSummary = summarizeCandidate(candidate);
  const jobSummary = summarizeJob(job);
  const candidateSkills = new Set(candidateSummary.normalizedSkills);
  const skillRes = calculateWeightedSkillScore(
    candidateSkills,
    jobSummary.normalizedRequiredSkills,
    jobSummary.normalizedPreferredSkills
  );
  const expRes = calculateExperienceScore(
    candidateSummary.candidateExperience || 0,
    jobSummary.requiredExperienceYears,
    job.experienceLevel
  );
  const locScore = calculateLocationScore(
    {
      ...candidate,
      profile: { ...candidate.profile, city: candidateSummary.currentLocation },
      careerPreferences: {
        ...candidate.careerPreferences,
        preferredWorkMode: candidateSummary.preferredWorkMode,
      },
    },
    {
      ...job,
      workMode: jobSummary.workMode,
      location: jobSummary.location,
    }
  );
  const keywordRes = calculateKeywordOverlap(candidateSummary.keywords, jobSummary.keywords);
  const preferenceRes = calculatePreferenceScore(candidateSummary, jobSummary);
  const titleMatch = candidateSummary.workTitles.some((title) =>
    tokenizeText(title).some((token) => jobSummary.keywords.includes(token))
  );

  let ruleScore =
    (skillRes.score * 0.4) +
    (expRes.score * 0.2) +
    (locScore * 0.1) +
    (keywordRes.score * 0.2) +
    (preferenceRes.score * 0.1);

  if (titleMatch) {
    ruleScore += 8;
  }

  const preferredMatches = jobSummary.normalizedPreferredSkills.filter((skill) => candidateSkills.has(skill));

  return {
    score: Math.min(100, Math.max(0, ruleScore)),
    matchedSkills: Array.from(new Set([...skillRes.matched, ...keywordRes.matches, ...preferredMatches])).slice(0, 20),
    missingSkills: skillRes.missing.slice(0, 20),
    penalties: skillRes.penalty + expRes.penalty,
    candidateSummary,
    jobSummary,
    keywordScore: keywordRes.score,
    preferenceScore: preferenceRes.score,
    locationScore: locScore,
    experienceScore: expRes.score,
    titleMatch,
    preferenceSignals: preferenceRes.reasons,
  };
}

/**
 * Step 2: Embedding Match (Moderate)
 */
async function getEmbeddingScore(candidate, job) {
  if (!openai) return 70;
  try {
    const candidateText = buildRichContext('candidate', candidate);
    const jobText = buildRichContext('job', job);

    const respA = await openai.embeddings.create({ model: 'text-embedding-3-small', input: candidateText });
    const vecA = respA.data[0].embedding;

    let vecB = embeddingCache.get(job.id);
    if (!vecB) {
      const respB = await openai.embeddings.create({ model: 'text-embedding-3-small', input: jobText });
      vecB = respB.data[0].embedding;
      embeddingCache.set(job.id, vecB);
    }

    const dotProduct = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);
    return ((dotProduct + 1) / 2) * 100;
  } catch (e) {
    return 70;
  }
}

/**
 * Step 3: GPT Analysis (Slow/Costly)
 */
async function getGptAnalysis(candidate, job) {
  if (!openai) return { fitScore: 70, reasoning: 'Fallback match' };
  const key = `${candidate.id}_${job.id}`;
  if (gptCache.has(key)) return gptCache.get(key);

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are a career matching AI. Respond ONLY in JSON.' },
        { role: 'user', content: `Candidate: ${buildRichContext('candidate', candidate)}\nJob: ${buildRichContext('job', job)}\nOutput JSON: { "fitScore": 0-100, "reasoning": "", "strengths": [], "gaps": [], "improvementSuggestions": [] }` }
      ],
      response_format: { type: "json_object" }
    });
    const result = JSON.parse(completion.choices[0].message.content);
    gptCache.set(key, result);
    return result;
  } catch (e) {
    return { fitScore: 70, reasoning: 'API error fallback' };
  }
}

/**
 * Behavioral Scoring
 */
async function getBehaviorScore(candidateId, jobId) {
  try {
    const [saved, applied] = await Promise.all([
      prisma.savedJob.findUnique({ where: { candidateId_jobId: { candidateId, jobId } } }),
      prisma.application.findUnique({ where: { candidateId_jobId: { candidateId, jobId } } })
    ]);
    
    let boost = 0;
    if (applied) boost += 10;
    else if (saved) boost += 5;
    
    return boost;
  } catch (e) { return 0; }
}

module.exports = {
  getRuleScore,
  getEmbeddingScore,
  getGptAnalysis,
  getBehaviorScore,
  normalizeSkill,
  summarizeCandidate,
  summarizeJob,
};
