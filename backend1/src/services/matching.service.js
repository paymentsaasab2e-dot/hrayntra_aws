const OpenAI = require('openai');
const { prisma } = require('../lib/prisma');
const {
  normalizeSkill,
  tokenizeText,
  summarizeCandidate,
  summarizeJob,
} = require('./job-normalization.service');
const {
  buildCandidateFeatures,
  buildJobFeatures,
} = require('./feature-extraction.service');

const apiKey = process.env.OPENAI_API_KEY;
const openai = apiKey ? new OpenAI({ apiKey }) : null;
const DEFAULT_SCORE_WEIGHTS = {
  skills: 40,
  role: 20,
  experience: 15,
  location: 10,
  education: 5,
  semantic: 10,
};
const RELATED_ROLE_CATEGORY_GROUPS = [
  ['Frontend', 'Full Stack'],
  ['Backend', 'Full Stack'],
  ['AI / ML', 'Data'],
  ['Management', 'Leadership'],
  ['Sales', 'Marketing'],
  ['HR / Talent', 'Management'],
  ['DevOps / Cloud', 'Backend'],
];

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

function calculateDomainScore(candidateSummary, jobSummary) {
  const candidateDomain = candidateSummary.domainFamily;
  const jobDomain = jobSummary.domainFamily;

  if (!candidateDomain || !jobDomain) {
    return { score: 55, match: null };
  }

  if (candidateDomain === jobDomain) {
    return { score: 100, match: true };
  }

  const compatiblePairs = new Set([
    'pharmacy:healthcare',
    'healthcare:pharmacy',
    'sales:marketing',
    'marketing:sales',
    'it:marketing',
    'marketing:it'
  ]);

  if (compatiblePairs.has(`${candidateDomain}:${jobDomain}`)) {
    return { score: 45, match: false };
  }

  return { score: 10, match: false };
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

function calculateLocationComponent(candidateFeatures, jobFeatures, weight = DEFAULT_SCORE_WEIGHTS.location) {
  if (jobFeatures.workMode === 'REMOTE') {
    return {
      score: weight,
      reason: 'Remote role is compatible with any candidate location.',
    };
  }

  const candidateTokens = new Set(candidateFeatures.location?.tokens || []);
  const preferredLocations = (candidateFeatures.preferredLocations || []).map((item) => String(item).toLowerCase());
  const jobTokens = jobFeatures.jobLocation?.tokens || [];

  let normalizedScore = 0.3;
  let reason = 'Location is partially compatible.';

  if (candidateFeatures.workModePreference && jobFeatures.workMode && candidateFeatures.workModePreference === jobFeatures.workMode) {
    normalizedScore += 0.2;
    reason = 'Preferred work mode aligns with the job.';
  }

  if (jobFeatures.workMode === 'HYBRID') {
    normalizedScore = Math.max(normalizedScore, 0.7);
    reason = 'Hybrid role offers moderate location flexibility.';
  }

  if (jobTokens.some((token) => candidateTokens.has(token))) {
    normalizedScore = 1;
    reason = 'Candidate location aligns with the job location.';
  } else if (preferredLocations.some((location) => (jobFeatures.jobLocation?.normalized || '').includes(location))) {
    normalizedScore = Math.max(normalizedScore, 0.85);
    reason = 'Job matches one of the candidate preferred locations.';
  }

  return {
    score: Math.round(normalizedScore * weight * 100) / 100,
    reason,
  };
}

function calculateRoleComponent(candidateFeatures, jobFeatures, weight = DEFAULT_SCORE_WEIGHTS.role) {
  const candidateSet = new Set(candidateFeatures.roleCategories || []);
  const jobSet = new Set(jobFeatures.roleCategories || []);
  const directMatches = [...jobSet].filter((category) => candidateSet.has(category));

  if (directMatches.length > 0) {
    return {
      score: weight,
      matches: directMatches,
      reason: `Role categories align directly: ${directMatches.join(', ')}.`,
    };
  }

  const relatedMatches = [];
  RELATED_ROLE_CATEGORY_GROUPS.forEach((group) => {
    const hasCandidate = group.some((category) => candidateSet.has(category));
    const hasJob = group.some((category) => jobSet.has(category));
    if (hasCandidate && hasJob) {
      relatedMatches.push(group.find((category) => jobSet.has(category)));
    }
  });

  if (relatedMatches.length > 0) {
    return {
      score: Math.round(weight * 0.6 * 100) / 100,
      matches: relatedMatches.filter(Boolean),
      reason: `Role categories are related through adjacent domains: ${relatedMatches.filter(Boolean).join(', ')}.`,
    };
  }

  return {
    score: Math.round(weight * 0.15 * 100) / 100,
    matches: [],
    reason: 'Role categories are weakly aligned.',
  };
}

function calculateExperienceComponent(candidateFeatures, jobFeatures, weight = DEFAULT_SCORE_WEIGHTS.experience) {
  const candidateYears = Number(candidateFeatures.experienceYears || 0);
  const requiredYears = Number(jobFeatures.requiredExperienceYears || 0);

  if (!requiredYears) {
    return {
      score: Math.round(weight * 0.8 * 100) / 100,
      reason: 'Job does not specify a strict experience threshold.',
    };
  }

  if (candidateYears >= requiredYears) {
    return {
      score: weight,
      reason: 'Candidate meets or exceeds the required experience.',
    };
  }

  const gap = requiredYears - candidateYears;
  if (gap <= 1) {
    return {
      score: Math.round(weight * 0.75 * 100) / 100,
      reason: 'Candidate is slightly below the experience threshold but still close.',
    };
  }

  if (gap <= 3) {
    return {
      score: Math.round(weight * 0.45 * 100) / 100,
      reason: 'Candidate has partial experience alignment.',
    };
  }

  return {
    score: Math.round(weight * 0.15 * 100) / 100,
    reason: 'Candidate is significantly below the required experience.',
  };
}

function calculateEducationComponent(candidateFeatures, jobFeatures, weight = DEFAULT_SCORE_WEIGHTS.education) {
  const candidateRank = candidateFeatures.educationRank || 0;
  const jobRank = jobFeatures.educationRequirementRank || 0;

  if (!jobRank) {
    return {
      score: Math.round(weight * 0.8 * 100) / 100,
      reason: 'Education requirement is flexible or unspecified.',
    };
  }

  if (candidateRank >= jobRank) {
    return {
      score: weight,
      reason: 'Candidate meets the education requirement.',
    };
  }

  if (candidateRank === jobRank - 1) {
    return {
      score: Math.round(weight * 0.5 * 100) / 100,
      reason: 'Candidate is close to the education requirement.',
    };
  }

  return {
    score: Math.round(weight * 0.2 * 100) / 100,
    reason: 'Education requirement is only partially met.',
  };
}

function calculateSkillsComponent(candidateFeatures, jobFeatures, weight = DEFAULT_SCORE_WEIGHTS.skills) {
  const candidateSet = new Set((candidateFeatures.skills || []).map(normalizeSkill).filter(Boolean));
  const requiredSkills = (jobFeatures.requiredSkills || []).map(normalizeSkill).filter(Boolean);
  const preferredSkills = (jobFeatures.preferredSkills || []).map(normalizeSkill).filter(Boolean);

  if (!requiredSkills.length) {
    return {
      score: Math.round(weight * 0.7 * 100) / 100,
      matchedSkills: preferredSkills.filter((skill) => candidateSet.has(skill)),
      missingSkills: [],
      reason: 'Job does not define required skills; preferred skills were used.',
    };
  }

  const matchedSkills = requiredSkills.filter((skill) => candidateSet.has(skill));
  const missingSkills = requiredSkills.filter((skill) => !candidateSet.has(skill));
  const overlapRatio = matchedSkills.length / Math.max(requiredSkills.length, 1);
  const preferredBonus = preferredSkills.filter((skill) => candidateSet.has(skill)).length * 0.03;
  const normalizedScore = Math.min(1, overlapRatio + preferredBonus);

  return {
    score: Math.round(normalizedScore * weight * 100) / 100,
    matchedSkills: Array.from(new Set([...matchedSkills, ...preferredSkills.filter((skill) => candidateSet.has(skill))])),
    missingSkills,
    reason: `${matchedSkills.length} of ${requiredSkills.length} required skills matched.`,
  };
}

function buildShortReason({ roleComponent, skillsComponent, experienceComponent, locationComponent }) {
  return [
    skillsComponent.reason,
    roleComponent.reason,
    experienceComponent.reason,
    locationComponent.reason,
  ].filter(Boolean).slice(0, 2).join(' ');
}

function redistributeSemanticScore(nonSemanticScore, semanticWeight = DEFAULT_SCORE_WEIGHTS.semantic) {
  if (nonSemanticScore <= 0) return 0;
  const redistributed = (nonSemanticScore / (100 - semanticWeight)) * semanticWeight;
  return Math.round(redistributed * 100) / 100;
}

async function scoreJobDeterministic(candidate, job, options = {}) {
  const weights = { ...DEFAULT_SCORE_WEIGHTS, ...(options.weights || {}) };
  const candidateSummary = options.candidateSummary || summarizeCandidate(candidate);
  const jobSummary = options.jobSummary || summarizeJob(job);
  const candidateFeatures = options.candidateFeatures || buildCandidateFeatures(candidateSummary);
  const jobFeatures = options.jobFeatures || buildJobFeatures(jobSummary);

  const skillsComponent = calculateSkillsComponent(candidateFeatures, jobFeatures, weights.skills);
  const roleComponent = calculateRoleComponent(candidateFeatures, jobFeatures, weights.role);
  const experienceComponent = calculateExperienceComponent(candidateFeatures, jobFeatures, weights.experience);
  const locationComponent = calculateLocationComponent(candidateFeatures, jobFeatures, weights.location);
  const educationComponent = calculateEducationComponent(candidateFeatures, jobFeatures, weights.education);

  const nonSemanticScore =
    skillsComponent.score +
    roleComponent.score +
    experienceComponent.score +
    locationComponent.score +
    educationComponent.score;

  let semanticScore = redistributeSemanticScore(nonSemanticScore, weights.semantic);
  let semanticReason = 'Semantic bonus redistributed proportionally from deterministic signals.';
  if (options.semanticSimilarity != null) {
    semanticScore = Math.round((Math.max(0, Math.min(100, options.semanticSimilarity)) / 100) * weights.semantic * 100) / 100;
    semanticReason = 'Semantic bonus derived from optional embedding similarity.';
  }

  const totalScore = Math.round(Math.min(100, nonSemanticScore + semanticScore));
  const shortReason = buildShortReason({
    roleComponent,
    skillsComponent,
    experienceComponent,
    locationComponent,
  });

  return {
    totalScore,
    matchedSkills: skillsComponent.matchedSkills,
    missingSkills: skillsComponent.missingSkills,
    shortReason,
    candidateSummary,
    jobSummary,
    candidateFeatures,
    jobFeatures,
    breakdown: {
      skillsScore: Math.round(skillsComponent.score * 100) / 100,
      roleScore: Math.round(roleComponent.score * 100) / 100,
      experienceScore: Math.round(experienceComponent.score * 100) / 100,
      locationScore: Math.round(locationComponent.score * 100) / 100,
      educationScore: Math.round(educationComponent.score * 100) / 100,
      semanticScore: Math.round(semanticScore * 100) / 100,
      reasons: {
        skills: skillsComponent.reason,
        role: roleComponent.reason,
        experience: experienceComponent.reason,
        location: locationComponent.reason,
        education: educationComponent.reason,
        semantic: semanticReason,
      },
    },
  };
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
  const domainRes = calculateDomainScore(candidateSummary, jobSummary);
  const titleMatch = candidateSummary.workTitles.some((title) =>
    tokenizeText(title).some((token) => jobSummary.keywords.includes(token))
  );

  let ruleScore =
    (skillRes.score * 0.4) +
    (expRes.score * 0.2) +
    (locScore * 0.1) +
    (keywordRes.score * 0.2) +
    (preferenceRes.score * 0.05) +
    (domainRes.score * 0.05);

  if (titleMatch) {
    ruleScore += 8;
  }

  const preferredMatches = jobSummary.normalizedPreferredSkills.filter((skill) => candidateSkills.has(skill));
  const directSkillMatches = Array.from(new Set([...skillRes.matched, ...preferredMatches]));

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
    domainScore: domainRes.score,
    domainMatch: domainRes.match,
    titleMatch,
    directSkillMatchCount: directSkillMatches.length,
    preferenceSignals: preferenceRes.reasons,
  };
}

function qualifiesForPersonalizedMatch(job) {
  const directSkillMatchCount = job.directSkillMatchCount || 0;
  const keywordScore = job.keywordScore || 0;
  const ruleScore = job.ruleScore || 0;
  const embeddingScore = job.embeddingScore || 0;
  const gptScore = job.gptScore || 0;
  const titleMatch = Boolean(job.titleMatch);
  const normalizedRequiredSkills = job.jobSummary?.normalizedRequiredSkills || [];
  const hasHardRequirements = normalizedRequiredSkills.length > 0;
  const candidateDomain = job.candidateSummary?.domainFamily || null;
  const jobDomain = job.jobSummary?.domainFamily || null;
  const domainMatch = job.domainMatch;
  const shouldShow = job.insights?.shouldShow;

  if (shouldShow === false) return false;
  if (candidateDomain && jobDomain && candidateDomain !== jobDomain && domainMatch === false) return false;

  if (titleMatch && directSkillMatchCount >= 1 && ruleScore >= 52 && (domainMatch !== false || !candidateDomain || !jobDomain)) return true;
  if (directSkillMatchCount >= 2 && keywordScore >= 20 && ruleScore >= 50 && (domainMatch !== false || !candidateDomain || !jobDomain)) return true;
  if (!hasHardRequirements && (titleMatch || keywordScore >= 40) && embeddingScore >= 72 && gptScore >= 68 && (domainMatch !== false || !candidateDomain || !jobDomain)) return true;

  return false;
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
    const candidateSummary = job.candidateSummary || summarizeCandidate(candidate);
    const jobSummary = job.jobSummary || summarizeJob(job);
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are a strict career matching AI. Only recommend jobs that truly fit the candidate background, domain, and transferable skills. If the candidate is from IT, prefer IT jobs. If the candidate is from pharmacy, prefer pharmacy jobs. Respond ONLY in JSON.' },
        { role: 'user', content: `Candidate summary: ${JSON.stringify({
          currentTitle: candidateSummary.currentTitle,
          domainFamily: candidateSummary.domainFamily,
          workTitles: candidateSummary.workTitles,
          skills: candidateSummary.normalizedSkills,
          preferredRoles: candidateSummary.preferredRoles,
          preferredIndustry: candidateSummary.preferredIndustry,
          summaryText: candidateSummary.summaryText,
        })}\nJob summary: ${JSON.stringify({
          title: jobSummary.title,
          domainFamily: jobSummary.domainFamily,
          company: jobSummary.company,
          requiredSkills: jobSummary.normalizedRequiredSkills,
          preferredSkills: jobSummary.normalizedPreferredSkills,
          industry: jobSummary.industry,
          education: jobSummary.education,
          responsibilities: jobSummary.responsibilities,
        })}\nCandidate rich context: ${buildRichContext('candidate', candidate)}\nJob rich context: ${buildRichContext('job', job)}\nOutput JSON: { "fitScore": 0-100, "shouldShow": true, "domainAlignment": "strong|partial|weak", "reasoning": "", "strengths": [], "gaps": [], "improvementSuggestions": [] }` }
      ],
      response_format: { type: "json_object" }
    });
    const result = JSON.parse(completion.choices[0].message.content);
    gptCache.set(key, result);
    return result;
  } catch (e) {
    return { fitScore: 70, shouldShow: true, domainAlignment: 'partial', reasoning: 'API error fallback' };
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
  qualifiesForPersonalizedMatch,
  buildCandidateFeatures,
  buildJobFeatures,
  scoreJobDeterministic,
  normalizeSkill,
  summarizeCandidate,
  summarizeJob,
};
