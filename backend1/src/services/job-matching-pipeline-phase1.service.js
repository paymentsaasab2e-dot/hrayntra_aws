const OpenAI = require('openai');
const { prisma } = require('../lib/prisma');
const { OPENAI_CHAT_MODEL } = require('../config/openaiModel');
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
const { resolvePublicCompanyName } = require('../utils/formatPortalJob.util');

function publicCompanyLabel(job, fallback = '') {
  return resolvePublicCompanyName(job, fallback) || fallback;
}

function applyEnvOpenAiModel(client) {
  if (!client?.chat?.completions?.create) return client;
  const originalCreate = client.chat.completions.create.bind(client.chat.completions);
  client.chat.completions.create = (body = {}, ...args) =>
    originalCreate({ ...body, model: OPENAI_CHAT_MODEL }, ...args);
  return client;
}

const openai = process.env.OPENAI_API_KEY
  ? applyEnvOpenAiModel(new OpenAI({ apiKey: process.env.OPENAI_API_KEY }))
  : null;

const AI_CACHE = {
  skills: new Map(),
  roles: new Map(),
  semantic: new Map(),
  explanation: new Map(),
  aiMatch: new Map(),
  embeddings: new Map(),
  jobsApi: new Map(),
};
const PRE_FILTER_LIMIT = 50;
/** Deterministic top-N always considered for AI enrichment. */
const AI_TOP_LIMIT = Number(process.env.PHASE1_AI_TOP_LIMIT || 25);
/** Also include jobs posted within this many days in the AI pool. */
const AI_RECENT_DAYS = Number(process.env.PHASE1_AI_RECENT_DAYS || 7);
/** Cap AI pool size after merging top-N + recent. */
const AI_POOL_MAX = Number(process.env.PHASE1_AI_POOL_MAX || 30);
const MIN_VISIBLE_SCORE = 20;
/** Rule / AI blend for Match Accuracy. */
const RULE_WEIGHT = Number(process.env.PHASE1_RULE_WEIGHT || 0.7);
const AI_WEIGHT = Number(process.env.PHASE1_AI_WEIGHT || 0.3);
/** Ranking blend: Match Accuracy vs Freshness. */
const RANK_MATCH_WEIGHT = Number(process.env.PHASE1_RANK_MATCH_WEIGHT || 0.85);
const RANK_FRESHNESS_WEIGHT = Number(process.env.PHASE1_RANK_FRESHNESS_WEIGHT || 0.15);
/** Freshness half-life style decay: freshness = 100 * exp(-ageDays / tau). */
const FRESHNESS_TAU_DAYS = Number(process.env.PHASE1_FRESHNESS_TAU_DAYS || 30);
/** Below this match accuracy, freshness must not promote the job. */
const RELEVANCE_FLOOR = Number(process.env.PHASE1_RELEVANCE_FLOOR || 55);
/** Cap Match Accuracy when zero required skills match (hard miss). */
const HARD_SKILL_MISS_CAP = Number(process.env.PHASE1_HARD_SKILL_MISS_CAP || 45);
const SYSTEM_PROMPT = `
You are an expert AI hiring engine.

Your task is to evaluate how well a candidate matches a job.

You MUST perform a deep analysis based on:
- skills
- experience
- responsibilities
- tech stack relevance
- role alignment
- industry alignment
- location

DO NOT rely only on keyword matching.
DO NOT inflate scores.
BE STRICT like a real hiring manager.

----------------------------------------

STEP 1: EXTRACT TRUE TECHNICAL SIGNALS

From candidate:
- Extract actual technologies only
- Infer stack (frontend/backend/fullstack)
- Detect seniority level

From job:
- Identify REQUIRED core technologies (React, TypeScript, etc.)
- Identify secondary skills

----------------------------------------

STEP 2: SCORING (each dimension 0-100 contribution before backend weights)

1. Skills Match (0-100)
2. Experience Relevance (0-100)
3. Responsibilities Match (0-100)
4. Role Alignment (0-100)
5. Industry Alignment (0-100)
6. Location / Work Mode (0-100)
7. Education (0-100)

----------------------------------------

STEP 3: FINAL SCORE

finalScore = weighted average of dimensions above, clamped 0-100
Do NOT invent mandatory skills that are not in the job.

----------------------------------------

STEP 4: VERDICT

80+ -> Strong Fit
65-79 -> Moderate Fit
50-64 -> Weak Fit
<50 -> Reject

----------------------------------------

STEP 5: OUTPUT (STRICT JSON)

{
  "finalScore": number,
  "verdict": string,
  "breakdown": {
    "skills": number,
    "experience": number,
    "responsibilities": number,
    "industry": number,
    "location": number
  },
  "matchedSkills": [],
  "missingCriticalSkills": [],
  "analysis": {
    "summary": string,
    "strengths": [],
    "gaps": []
  }
}

----------------------------------------

STRICT RULES:

- DO NOT include generic words (web, application, system)
- ONLY consider real technologies
- Penalize missing core stack (React, TypeScript)
- Prefer strict scoring over optimistic scoring
`.trim();

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function uniqueStrings(values = []) {
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

function sanitizeSkillList(values = []) {
  return uniqueStrings(values)
    .filter((skill) => !looksLikeSentence(skill))
    .map((skill) => normalizeSkill(skill))
    .filter(Boolean);
}

function stripSkillForCompare(skill) {
  return normalizeSkill(skill).replace(/[^a-z0-9+#]/g, '');
}

function looksLikeSentence(value) {
  if (!value || typeof value !== 'string') return false;
  const wordCount = value.trim().split(/\s+/).filter(Boolean).length;
  return wordCount >= 6 || /[.!?]/.test(value);
}

function isLikelyInvalidLocation(location) {
  if (!location || typeof location !== 'string') return true;
  const normalized = location.trim().toLowerCase();
  if (!normalized) return true;
  const knownBad = new Set(['indai', 'unkown', 'unknown location', 'n/a', 'na', 'nil', 'none']);
  if (knownBad.has(normalized)) return true;
  if (normalized.length <= 2) return true;
  return false;
}

function cleanLocation(location) {
  return isLikelyInvalidLocation(location) ? 'unknown' : location.trim();
}

function buildCandidateSummaryText(candidateSummary, cleanedResumeText) {
  return [
    candidateSummary.currentTitle,
    candidateSummary.summaryText,
    candidateSummary.normalizedSkills?.slice(0, 20).join(', '),
    cleanedResumeText,
  ]
    .filter(Boolean)
    .join('\n')
    .slice(0, 6000);
}

function cleanAndExtractSkills(text) {
  if (!text || typeof text !== 'string') return [];

  const verbsToRemove = /\b(develop|build|maintain|create|collaborate|using|ensure)\b/gi;
  const normalizedText = text
    .toLowerCase()
    .replace(verbsToRemove, ' ')
    .replace(/[^a-z0-9+#.\-/,\s]/gi, ' ');

  const extracted = tokenizeText(normalizedText)
    .map((skill) => normalizeSkill(skill))
    .filter(Boolean);

  return Array.from(new Set(extracted)).slice(0, 20);
}

function extractSkillsHeuristically(job) {
  const corpus = [
    ...(Array.isArray(job.skills) ? job.skills : []),
    ...(Array.isArray(job.preferredSkills) ? job.preferredSkills : []),
    ...(Array.isArray(job.requirements) ? job.requirements : []),
    ...(Array.isArray(job.keyResponsibilities) ? job.keyResponsibilities : []),
    job.description,
    job.overview,
    job.aboutRole,
    job.responsibilities,
    job.title,
  ]
    .filter(Boolean)
    .join(' ');

  return cleanAndExtractSkills(corpus);
}

function fuzzySkillMatch(candidateSkill, requiredSkill) {
  const candidate = stripSkillForCompare(candidateSkill);
  const required = stripSkillForCompare(requiredSkill);
  if (!candidate || !required) return false;
  if (candidate === required) return true;
  if (candidate.includes(required) || required.includes(candidate)) return true;
  if (candidate.startsWith(required) || required.startsWith(candidate)) return true;
  if (candidate.length >= 4 && required.length >= 4) {
    const overlap = longestCommonTokenPrefix(candidate, required);
    if (overlap >= 4) return true;
  }
  return false;
}

function longestCommonTokenPrefix(a, b) {
  let count = 0;
  const max = Math.min(a.length, b.length);
  while (count < max && a[count] === b[count]) count += 1;
  return count;
}

function isSkillMatch(candidateSkill, jobSkill) {
  const c = String(candidateSkill || '').toLowerCase();
  const j = String(jobSkill || '').toLowerCase();

  return (
    c === j ||
    c.includes(j) ||
    j.includes(c)
  );
}

function computeMatchedSkills(candidateSkills, requiredSkills) {
  const normalizedCandidateSkills = sanitizeSkillList(candidateSkills);
  const normalizedRequiredSkills = sanitizeSkillList(requiredSkills);
  const matched = normalizedRequiredSkills.filter((jobSkill) =>
    normalizedCandidateSkills.some(
      (candidateSkill) => isSkillMatch(candidateSkill, jobSkill) || fuzzySkillMatch(candidateSkill, jobSkill)
    )
  );
  const missing = normalizedRequiredSkills.filter((jobSkill) =>
    !normalizedCandidateSkills.some(
      (candidateSkill) => isSkillMatch(candidateSkill, jobSkill) || fuzzySkillMatch(candidateSkill, jobSkill)
    )
  );

  return {
    matchedSkills: Array.from(new Set(matched.map((skill) => normalizeSkill(skill)))),
    missingSkills: Array.from(new Set(missing.map((skill) => normalizeSkill(skill)))),
  };
}

function calculateSkillsScore(candidateFeatures, jobFeatures) {
  const candidateSkills = sanitizeSkillList(candidateFeatures.skills || []);
  const requiredSkills = sanitizeSkillList(jobFeatures.requiredSkills || []);
  const preferredSkills = sanitizeSkillList(jobFeatures.preferredSkills || []).filter(
    (skill) => !requiredSkills.some((required) => isSkillMatch(skill, required) || fuzzySkillMatch(skill, required))
  );

  if (!requiredSkills.length && !preferredSkills.length) {
    return {
      score: 20,
      requiredScore: 15,
      preferredScore: 5,
      matchedSkills: [],
      missingSkills: [],
      matchedPreferredSkills: [],
      matchPercent: 0,
      preferredMatchPercent: 0,
      hardSkillMiss: false,
    };
  }

  const requiredMatch = requiredSkills.length
    ? computeMatchedSkills(candidateSkills, requiredSkills)
    : { matchedSkills: [], missingSkills: [] };
  const preferredMatch = preferredSkills.length
    ? computeMatchedSkills(candidateSkills, preferredSkills)
    : { matchedSkills: [], missingSkills: [] };

  const requiredRatio = requiredSkills.length
    ? requiredMatch.matchedSkills.length / requiredSkills.length
    : 1;
  const preferredRatio = preferredSkills.length
    ? preferredMatch.matchedSkills.length / preferredSkills.length
    : 1;

  // Required skills drive up to 30 pts; preferred only add up to 5 (never penalize missing preferred).
  const requiredScore = Math.round(30 * requiredRatio * 100) / 100;
  const preferredScore = preferredSkills.length
    ? Math.round(5 * preferredRatio * 100) / 100
    : 5;
  const hardSkillMiss = requiredSkills.length > 0 && requiredMatch.matchedSkills.length === 0;

  return {
    score: Math.round((requiredScore + preferredScore) * 100) / 100,
    requiredScore,
    preferredScore,
    matchedSkills: requiredMatch.matchedSkills,
    missingSkills: requiredMatch.missingSkills,
    matchedPreferredSkills: preferredMatch.matchedSkills,
    matchPercent: Math.round(requiredRatio * 100),
    preferredMatchPercent: Math.round(preferredRatio * 100),
    hardSkillMiss,
  };
}

function calculateRoleScore(candidateFeatures, jobFeatures) {
  const candidateRoles = new Set(candidateFeatures.roleCategories || []);
  const jobRoles = (jobFeatures.roleCategories || []).slice(0, 3);
  const candidateTitle = String(candidateFeatures.currentTitle || '').toLowerCase();
  const jobTitle = String(jobFeatures.title || '').toLowerCase();

  const exactMatches = jobRoles.filter((role) => candidateRoles.has(role));
  if (exactMatches.length > 0 || (candidateTitle && jobTitle && (candidateTitle.includes(jobTitle) || jobTitle.includes(candidateTitle)))) {
    return { score: 15, matchedRoles: exactMatches, matchType: 'exact' };
  }

  const candidateRoleText = Array.from(candidateRoles).join(' ').toLowerCase();
  const jobRoleText = jobRoles.join(' ').toLowerCase();
  const candidateTokens = new Set(tokenizeText(candidateRoleText));
  const jobTokens = tokenizeText(jobRoleText);
  const hasFullStackBridge =
    (candidateRoles.has('Full Stack') && (jobRoles.includes('Frontend') || jobRoles.includes('Backend'))) ||
    (jobRoles.includes('Full Stack') && (candidateRoles.has('Frontend') || candidateRoles.has('Backend')));
  const sharedRoleToken = jobTokens.some((token) => candidateTokens.has(token));

  if (hasFullStackBridge) {
    return { score: 11, matchedRoles: [], matchType: 'closely_related' };
  }
  if (sharedRoleToken) {
    return { score: 7, matchedRoles: [], matchType: 'related' };
  }

  return { score: 2, matchedRoles: [], matchType: 'none' };
}

function calculateExperienceScore(candidateFeatures, jobFeatures) {
  const candidateYears = Number(candidateFeatures.experienceYears || 0);
  const requiredYears = Number(jobFeatures.requiredExperienceYears || 0);

  if (requiredYears <= 0) {
    return 15;
  }

  // Smooth progressive curve — avoids a harsh cliff at the minimum.
  const ratio = candidateYears / requiredYears;
  if (ratio >= 1) return 15;
  if (ratio >= 0.85) return 13;
  if (ratio >= 0.7) return 11;
  if (ratio >= 0.5) return 8;
  if (ratio >= 0.33) return 5;
  if (ratio >= 0.15) return 3;
  return 1;
}

function calculateLocationScore(candidateFeatures, jobFeatures) {
  const candidateTokens = new Set([
    ...(candidateFeatures.location?.tokens || []),
    ...((candidateFeatures.preferredLocations || []).flatMap((loc) =>
      String(loc || '')
        .toLowerCase()
        .split(/[,\s/()-]+/)
        .filter(Boolean)
    )),
  ]);
  const jobLocation = jobFeatures.jobLocation?.normalized || 'unknown';
  const workMode = String(jobFeatures.workMode || '').toUpperCase();

  if (workMode === 'REMOTE') {
    return 5;
  }

  if (jobLocation === 'unknown') {
    return 3;
  }

  const jobTokens = jobFeatures.jobLocation?.tokens || [];
  if (jobTokens.some((token) => candidateTokens.has(token))) {
    return 5;
  }

  if (workMode === 'HYBRID') {
    return 3;
  }

  return 1;
}

function calculateEducationScore(candidateFeatures, jobFeatures) {
  const candidateRank = Number(candidateFeatures.educationRank || 0);
  const requiredRank = Number(jobFeatures.educationRequirementRank || 0);

  if (!requiredRank) return 5;
  if (candidateRank >= requiredRank) return 5;
  if (candidateRank === requiredRank - 1) return 3;
  return 1;
}

function calculateIndustryScore(candidateFeatures, jobFeatures) {
  const candidateIndustry = String(
    candidateFeatures.preferredIndustry ||
      candidateFeatures.industry ||
      candidateFeatures.domainFamily ||
      ''
  )
    .toLowerCase()
    .trim();
  const jobIndustry = String(jobFeatures.industry || jobFeatures.domainFamily || '')
    .toLowerCase()
    .trim();

  if (!jobIndustry) return 5;
  if (!candidateIndustry) return 2;
  if (candidateIndustry === jobIndustry) return 5;
  if (candidateIndustry.includes(jobIndustry) || jobIndustry.includes(candidateIndustry)) return 4;

  const candidateTokens = new Set(tokenizeText(candidateIndustry));
  const jobTokens = tokenizeText(jobIndustry);
  if (jobTokens.some((token) => candidateTokens.has(token))) return 3;
  return 1;
}

function calculateWorkModeScore(candidateFeatures, jobFeatures) {
  const preferred = String(candidateFeatures.workModePreference || '').toUpperCase();
  const jobMode = String(jobFeatures.workMode || '').toUpperCase();

  if (!jobMode) return 5;
  if (!preferred) return 3;
  if (preferred === jobMode) return 5;
  if (jobMode === 'REMOTE' || preferred === 'REMOTE') return 4;
  if (
    (preferred === 'HYBRID' && (jobMode === 'ON_SITE' || jobMode === 'REMOTE')) ||
    (jobMode === 'HYBRID' && (preferred === 'ON_SITE' || preferred === 'REMOTE'))
  ) {
    return 3;
  }
  return 1;
}

function calculateResponsibilitiesScore(candidateFeatures, jobFeatures) {
  const jobTokens = Array.from(new Set(jobFeatures.responsibilityTokens || [])).slice(0, 80);
  if (!jobTokens.length) return 8;

  const candidateTokens = new Set(candidateFeatures.responsibilityTokens || []);
  if (!candidateTokens.size) return 4;

  let hits = 0;
  for (const token of jobTokens) {
    if (candidateTokens.has(token)) hits += 1;
  }
  const ratio = hits / jobTokens.length;
  return Math.round(clamp(ratio * 15, 0, 15) * 100) / 100;
}

function resolveJobPostedAt(rawJob = {}, jobFeatures = {}) {
  return (
    rawJob.postedAt ||
    rawJob.postedDate ||
    rawJob.createdAt ||
    rawJob.updatedAt ||
    jobFeatures.postedAt ||
    null
  );
}

function calculateFreshnessScore(postedAt, { now = Date.now(), tauDays = FRESHNESS_TAU_DAYS } = {}) {
  if (!postedAt) return 35;
  const ts = new Date(postedAt).getTime();
  if (!Number.isFinite(ts)) return 35;
  const ageDays = Math.max(0, (now - ts) / (1000 * 60 * 60 * 24));
  const freshness = 100 * Math.exp(-ageDays / Math.max(1, tauDays));
  return Math.round(clamp(freshness, 0, 100) * 100) / 100;
}

function calculateRankingScore(matchAccuracy, freshnessScore, { relevanceFloor = RELEVANCE_FLOOR } = {}) {
  const match = clamp(Number(matchAccuracy) || 0, 0, 100);
  const fresh = clamp(Number(freshnessScore) || 0, 0, 100);
  if (match < relevanceFloor) {
    // Freshness must not promote low-relevance jobs.
    return Math.round(match * 100) / 100;
  }
  return (
    Math.round((match * RANK_MATCH_WEIGHT + fresh * RANK_FRESHNESS_WEIGHT) * 100) / 100
  );
}

function combineMatchAccuracy(ruleScore, aiScore, { hardSkillMiss = false } = {}) {
  let matchAccuracy = Number(ruleScore) || 0;
  if (aiScore != null && aiScore !== '' && Number.isFinite(Number(aiScore))) {
    matchAccuracy = matchAccuracy * RULE_WEIGHT + Number(aiScore) * AI_WEIGHT;
  }
  matchAccuracy = clamp(matchAccuracy, 0, 100);
  if (hardSkillMiss) {
    matchAccuracy = Math.min(matchAccuracy, HARD_SKILL_MISS_CAP);
  }
  return Math.round(matchAccuracy * 100) / 100;
}

function selectAiCandidateJobs(scoredJobs, { now = Date.now() } = {}) {
  const byId = new Map();
  const top = scoredJobs.slice(0, Math.max(1, AI_TOP_LIMIT));
  for (const job of top) byId.set(String(job.jobId), job);

  const recentCutoff = now - AI_RECENT_DAYS * 24 * 60 * 60 * 1000;
  for (const job of scoredJobs) {
    if (byId.size >= AI_POOL_MAX) break;
    const postedAt = resolveJobPostedAt(job.rawJob, job.jobFeatures);
    const ts = postedAt ? new Date(postedAt).getTime() : NaN;
    if (Number.isFinite(ts) && ts >= recentCutoff) {
      byId.set(String(job.jobId), job);
    }
  }

  return Array.from(byId.values()).slice(0, AI_POOL_MAX);
}

function computeMatchLabel(score) {
  if (score >= 80) return 'Excellent Match';
  if (score >= 65) return 'Good Match';
  if (score >= 50) return 'Potential Match';
  return 'Low Match';
}

function computeScoreColorHint(score) {
  if (score >= 85) return 'high';
  if (score >= 55) return 'medium';
  return 'low';
}

function deriveLowMatchReason(scoring) {
  const reasons = [];
  if ((scoring.breakdown.skills || 0) < 14 && scoring.missingSkills.length) {
    reasons.push(`missing ${scoring.missingSkills.slice(0, 2).join(' and ')}`);
  }
  if ((scoring.breakdown.role || 0) <= 3) {
    reasons.push('weak role alignment');
  }
  if ((scoring.breakdown.location || 0) <= 2) {
    reasons.push('location mismatch');
  }
  if ((scoring.breakdown.experience || 0) <= 7) {
    reasons.push('experience gap');
  }
  if ((scoring.breakdown.responsibilities || 0) <= 5) {
    reasons.push('limited responsibility overlap');
  }
  if (!reasons.length) {
    reasons.push('limited overall alignment');
  }
  return `Low score due to ${reasons.slice(0, 2).join(' and ')}.`;
}

function getAiCacheKey(candidateId, jobId) {
  return `${candidateId}:${jobId}`;
}

function normalizeExternalJob(job) {
  return {
    id: job.id || job.jobId || job.externalId,
    title: job.title || job.jobTitle || 'Untitled Job',
    company: job.company || null,
    client: job.client || null,
    description: job.description || '',
    overview: job.overview || '',
    aboutRole: job.aboutRole || '',
    responsibilities: job.responsibilities || '',
    keyResponsibilities: Array.isArray(job.keyResponsibilities) ? job.keyResponsibilities : [],
    skills: Array.isArray(job.skills) ? job.skills : [],
    preferredSkills: Array.isArray(job.preferredSkills) ? job.preferredSkills : [],
    requirements: Array.isArray(job.requirements) ? job.requirements : [],
    location: job.location || 'unknown',
    workMode: job.workMode || job.jobLocationType || null,
    jobLocationType: job.jobLocationType || job.workMode || null,
    experienceRequired: job.experienceRequired || job.experienceLevel || '',
    experienceLevel: job.experienceLevel || job.experienceRequired || '',
    education: job.education || null,
    source: job.source || 'external',
  };
}

async function getJobs() {
  const dbJobs = await prisma.job.findMany({
    where: {},
    include: {
      company: { select: { name: true, logoUrl: true } },
      client: { select: { companyName: true, logo: true } },
    },
  });

  const externalJobs = [];

  return [
    ...dbJobs.map((job) => ({ ...job, source: 'db' })),
    ...externalJobs.map(normalizeExternalJob),
  ];
}

function preFilterJobs(candidateFeatures, jobsWithFeatures) {
  const candidateSkillSet = new Set(expandSkillTokens(candidateFeatures.skills || []));
  const candidateRoleSet = new Set(candidateFeatures.roleCategories || []);
  const candidateKeywordSet = new Set(tokenizeText([
    ...(candidateFeatures.skills || []),
    ...(candidateFeatures.roleCategories || []),
    candidateFeatures.location?.normalized || '',
  ].join(' ')));

  const prefiltered = jobsWithFeatures
    .map((entry) => {
      const jobSkillSet = new Set(expandSkillTokens(entry.jobFeatures.requiredSkills || []));
      const jobRoleSet = new Set(entry.jobFeatures.roleCategories || []);
      const jobKeywordSet = new Set(tokenizeText([
        entry.rawJob.title,
        entry.rawJob.description,
        entry.rawJob.overview,
        entry.rawJob.aboutRole,
        entry.rawJob.responsibilities,
        ...(entry.rawJob.keyResponsibilities || []),
      ].filter(Boolean).join(' ')));

      const skillOverlap = [...jobSkillSet].filter((skill) => candidateSkillSet.has(skill)).length;
      const roleOverlap = [...jobRoleSet].filter((role) => candidateRoleSet.has(role)).length;
      const keywordOverlap = [...jobKeywordSet].filter((token) => candidateKeywordSet.has(token)).length;
      const prefilterScore = (skillOverlap * 4) + (roleOverlap * 6) + Math.min(keywordOverlap, 10);

      return {
        ...entry,
        prefilterScore,
        passesPreFilter: skillOverlap > 0 || roleOverlap > 0 || keywordOverlap > 0,
      };
    })
    .filter((entry) => entry.passesPreFilter)
    .sort((a, b) => b.prefilterScore - a.prefilterScore)
    .slice(0, PRE_FILTER_LIMIT);

  return prefiltered;
}

function computeConfidence(scoredJob, aiScore = null) {
  const skillConfidence = clamp(Number(scoredJob.diagnostics?.skillMatchPercent || 0), 0, 100);
  const roleType = scoredJob.diagnostics?.roleMatchType || 'none';
  const roleConfidence = roleType === 'exact' ? 100 : roleType === 'related' ? 70 : 30;
  const experienceConfidence = clamp(Math.round(((scoredJob.breakdown?.experience || 0) / 15) * 100), 0, 100);
  const aiAgreement = aiScore == null
    ? 50
    : clamp(100 - Math.abs(Number(scoredJob.deterministicScore || 0) - Number(aiScore || 0)) * 2, 0, 100);

  const confidenceScore = Math.round(
    (skillConfidence * 0.4) +
    (roleConfidence * 0.2) +
    (experienceConfidence * 0.2) +
    (aiAgreement * 0.2)
  );

  const confidenceLevel =
    confidenceScore >= 75 ? 'High' :
    confidenceScore >= 50 ? 'Medium' :
    'Low';

  return { confidenceScore, confidenceLevel };
}

function computeDynamicFinalScore(deterministicScore, aiScore) {
  const safeDeterministic = Number(deterministicScore || 0);
  const safeAi = Number(aiScore || 0);
  const difference = Math.abs(safeDeterministic - safeAi);

  let aiWeight = 0.3;
  if (safeDeterministic >= 80) aiWeight = 0.2;
  if (safeDeterministic < 50) aiWeight = 0.4;
  if (difference > 25) aiWeight = Math.min(aiWeight, 0.15);

  const deterministicWeight = 1 - aiWeight;
  return {
    aiWeight,
    deterministicWeight,
    finalScore: Math.min(100, Math.round(((safeDeterministic * deterministicWeight) + (safeAi * aiWeight)) * 100) / 100),
  };
}

async function extractSkillsWithOpenAI(input) {
  const text = typeof input === 'string'
    ? input
    : [
        ...(Array.isArray(input?.skills) ? input.skills : []),
        ...(Array.isArray(input?.preferredSkills) ? input.preferredSkills : []),
        ...(Array.isArray(input?.requirements) ? input.requirements : []),
        ...(Array.isArray(input?.keyResponsibilities) ? input.keyResponsibilities : []),
        input?.description,
        input?.overview,
        input?.aboutRole,
        input?.responsibilities,
        input?.title,
      ].filter(Boolean).join(' ');
  const cacheKey = `skills:${typeof input === 'object' && input?.id ? input.id : text.slice(0, 200)}`;
  if (AI_CACHE.skills.has(cacheKey)) return AI_CACHE.skills.get(cacheKey);
  if (!openai) return cleanAndExtractSkills(text);

  try {
    const completion = await openai.chat.completions.create({
      model: OPENAI_CHAT_MODEL,
      temperature: 0.1,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: 'Extract ONLY technical skills from the following text. Return ONLY a JSON object with an array field: {"skills":["react","node","mongodb"]}. No explanation.',
        },
        {
          role: 'user',
          content: `Text:\n${text}`,
        },
      ],
    });

    const parsed = JSON.parse(completion.choices[0]?.message?.content || '{}');
    const cleaned = sanitizeSkillList(parsed.skills || []);
    const result = cleaned.length ? cleaned : cleanAndExtractSkills(text);
    AI_CACHE.skills.set(cacheKey, result);
    return result;
  } catch (error) {
    return cleanAndExtractSkills(text);
  }
}

async function inferRolesWithOpenAI(candidateSummary, job) {
  const cacheKey = `${candidateSummary.id}:${job.id}:roles`;
  if (AI_CACHE.roles.has(cacheKey)) return AI_CACHE.roles.get(cacheKey);
  if (!openai) return null;

  try {
    const completion = await openai.chat.completions.create({
      model: OPENAI_CHAT_MODEL,
      temperature: 0.1,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: 'Infer the best primary and secondary role categories for a job. Keep categories short. Return JSON: {"primaryRole":"","secondaryRoles":[""]}.',
        },
        {
          role: 'user',
          content: JSON.stringify({
            candidateSummary: {
              currentTitle: candidateSummary.currentTitle,
              roleCategories: candidateSummary.roleCategories,
              summaryText: candidateSummary.summaryText,
            },
            job: {
              title: job.title,
              description: job.description,
              overview: job.overview,
              responsibilities: job.responsibilities,
            },
          }),
        },
      ],
    });

    const parsed = JSON.parse(completion.choices[0]?.message?.content || '{}');
    const result = {
      primaryRole: typeof parsed.primaryRole === 'string' ? parsed.primaryRole.trim() : null,
      secondaryRoles: uniqueStrings(parsed.secondaryRoles || []).slice(0, 2),
    };
    AI_CACHE.roles.set(cacheKey, result);
    return result;
  } catch (error) {
    return null;
  }
}

async function getSemanticBoostWithOpenAI(candidateSummaryText, job, deterministicScore) {
  const cacheKey = `${job.id}:${deterministicScore}:${candidateSummaryText.slice(0, 100)}`;
  if (AI_CACHE.semantic.has(cacheKey)) return AI_CACHE.semantic.get(cacheKey);
  if (!openai) return 0;

  try {
    const completion = await openai.chat.completions.create({
      model: OPENAI_CHAT_MODEL,
      temperature: 0.1,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: 'Assess semantic fit only as a small enhancement on top of deterministic scoring. Return JSON: {"semanticBoost":0-10}.',
        },
        {
          role: 'user',
          content: JSON.stringify({
            candidateSummary: candidateSummaryText,
            jobTitle: job.title,
            jobDescription: [
              job.description,
              job.overview,
              job.aboutRole,
              job.responsibilities,
              ...(job.keyResponsibilities || []),
            ].filter(Boolean).join('\n'),
            deterministicScore,
          }),
        },
      ],
    });

    const parsed = JSON.parse(completion.choices[0]?.message?.content || '{}');
    const boost = clamp(Number(parsed.semanticBoost || 0), 0, 10);
    AI_CACHE.semantic.set(cacheKey, boost);
    return boost;
  } catch (error) {
    return 0;
  }
}

async function getSemanticScoreWithOpenAI(candidate, job) {
  const cacheKey = `semantic:${candidate.id || 'candidate'}:${job.id}`;
  if (AI_CACHE.semantic.has(cacheKey)) return AI_CACHE.semantic.get(cacheKey);
  if (!openai) {
    return {
      score: 0,
      matchedSkills: [],
      missingSkills: [],
    };
  }

  try {
    const completion = await openai.chat.completions.create({
      model: OPENAI_CHAT_MODEL,
      temperature: 0.1,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: 'Evaluate how well the candidate matches the job. Return JSON only: {"score":0-10,"matchedSkills":[""],"missingSkills":[""]}',
        },
        {
          role: 'user',
          content: JSON.stringify({
            candidate: {
              summary: candidate.summaryText,
              skills: candidate.normalizedSkills,
              roleCategories: candidate.roleCategories,
            },
            job: {
              title: job.title,
              description: job.description || '',
              skills: job.skills || [],
            },
          }),
        },
      ],
    });

    const parsed = JSON.parse(completion.choices[0]?.message?.content || '{}');
    const result = {
      score: clamp(Number(parsed.score || 0), 0, 10),
      matchedSkills: sanitizeSkillList(parsed.matchedSkills || []).slice(0, 5),
      missingSkills: sanitizeSkillList(parsed.missingSkills || []).slice(0, 5),
    };
    AI_CACHE.semantic.set(cacheKey, result);
    return result;
  } catch (error) {
    console.log('[AI ERROR FALLBACK]');
    return {
      score: 0,
      matchedSkills: [],
      missingSkills: [],
    };
  }
}

async function getAIMatchScore(candidate, job) {
  const cacheKey = `aimatch:${candidate?.id || 'candidate'}:${job?.id || 'job'}`;
  if (AI_CACHE.aiMatch.has(cacheKey)) return AI_CACHE.aiMatch.get(cacheKey);
  if (!openai) return null;

  const response = await openai.chat.completions.create({
    model: OPENAI_CHAT_MODEL,
    temperature: 0.2,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: SYSTEM_PROMPT,
      },
      {
        role: 'user',
        content: `
CANDIDATE DATA:
${JSON.stringify(candidate)}

JOB DATA:
${JSON.stringify(job)}
`,
      },
    ],
  });

  let aiResult;

  try {
    const rawContent = response?.choices?.[0]?.message?.content || '{}';
    const cleanedContent = String(rawContent)
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();
    aiResult = JSON.parse(cleanedContent);
  } catch (err) {
    console.error('AI PARSE ERROR', err);
    return null;
  }

  const normalizedResult = {
    finalScore: clamp(Number(aiResult?.finalScore || 0), 0, 100),
    verdict: typeof aiResult?.verdict === 'string' ? aiResult.verdict : 'Closest Match',
    breakdown: aiResult?.breakdown || null,
    matchedSkills: sanitizeSkillList(aiResult?.matchedSkills || []).slice(0, 10),
    missingCriticalSkills: sanitizeSkillList(aiResult?.missingCriticalSkills || []).slice(0, 10),
    analysis: aiResult?.analysis || null,
  };

  AI_CACHE.aiMatch.set(cacheKey, normalizedResult);
  return normalizedResult;
}

async function getFullAiMatchWithOpenAI(candidateSummaryText, job, deterministicResult) {
  const cacheKey = getAiCacheKey(deterministicResult.candidateId || 'candidate', job.id);
  if (AI_CACHE.aiMatch.has(cacheKey)) {
    console.log(`[AI CACHE] HIT ${cacheKey}`);
    return AI_CACHE.aiMatch.get(cacheKey);
  }
  console.log(`[AI CACHE] MISS ${cacheKey}`);
  if (!openai) {
    return {
      aiScore: 0,
      matchedSkills: [],
      missingSkills: [],
      reasoning: '',
    };
  }

  try {
    const completion = await openai.chat.completions.create({
      model: OPENAI_CHAT_MODEL,
      temperature: 0.1,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `
You are an advanced AI recruitment engine integrated into a production-grade job matching system.

You are the FINAL decision engine for AI-based scoring.

The system already has a deterministic scoring engine.

Your job is to:
- Independently evaluate the match
- Provide an AI score (0-100)
- Identify true skill alignment
- Detect missing critical skills
- Provide a short recruiter-like reasoning

The output will be merged with deterministic results using:
FINAL SCORE = (deterministicScore * 0.7) + (aiScore * 0.3)

STRICT EVALUATION:
1. Skills Match (40%)
2. Role Relevance (20%)
3. Experience Alignment (20%)
4. Project / Domain Relevance (10%)
5. Overall Fit (10%)

STRICT RULES:
- Do NOT over-score weak matches
- Missing critical skills must reduce score
- If 5 skills are required and only 1 matches, score must be low
- Be strict like a real recruiter
- Prefer precision over generosity

SKILL RULES:
- js = javascript
- node = node.js
- reactjs = react
- ts = typescript

OUTPUT STRICT JSON ONLY:
{
  "aiScore": number,
  "matchedSkills": ["skill1", "skill2"],
  "missingSkills": ["skill1", "skill2"],
  "reasoning": "Max 2 lines explaining match quality"
}

- matchedSkills <= 5
- missingSkills <= 5
- no markdown
          `.trim(),
        },
        {
          role: 'user',
          content: JSON.stringify({
            candidateSummary: candidateSummaryText,
            job: {
              title: job.title,
              company: publicCompanyLabel(job, ''),
              description: job.description || '',
              overview: job.overview || job.aboutRole || '',
              responsibilities: job.responsibilities || '',
              keyResponsibilities: job.keyResponsibilities || [],
              skills: job.skills || [],
              preferredSkills: job.preferredSkills || [],
              location: job.location || '',
              workMode: job.workMode || job.jobLocationType || '',
              experienceRequired: job.experienceRequired || job.experienceLevel || '',
              education: job.education || '',
            },
            deterministicScore: deterministicResult.deterministicScore,
            deterministicMatchedSkills: deterministicResult.matchedSkills,
            deterministicMissingSkills: deterministicResult.missingSkills,
          }),
        },
      ],
    });

    const parsed = JSON.parse(completion.choices[0]?.message?.content || '{}');
    const result = {
      aiScore: clamp(Number(parsed.aiScore || 0), 0, 100),
      matchedSkills: sanitizeSkillList(parsed.matchedSkills || []).slice(0, 5),
      missingSkills: sanitizeSkillList(parsed.missingSkills || []).slice(0, 5),
      reasoning: typeof parsed.reasoning === 'string' ? parsed.reasoning.trim() : '',
    };
    AI_CACHE.aiMatch.set(cacheKey, result);
    return result;
  } catch (error) {
    console.log('[AI ERROR FALLBACK]');
    return {
      aiScore: 0,
      matchedSkills: [],
      missingSkills: [],
      reasoning: '',
    };
  }
}

async function generateExplanationWithOpenAI(candidateSummaryText, job, scoringResult) {
  const cacheKey = `${job.id}:${scoringResult.finalScore}:${scoringResult.matchedSkills.join('|')}:${scoringResult.missingSkills.join('|')}`;
  if (AI_CACHE.explanation.has(cacheKey)) return AI_CACHE.explanation.get(cacheKey);
  if (!openai) {
    const fallback = `Matched on ${scoringResult.matchedSkills.slice(0, 5).join(', ') || 'core profile alignment'}. Improve with ${scoringResult.missingSkills.slice(0, 3).join(', ') || 'clearer job-specific evidence'}.`;
    AI_CACHE.explanation.set(cacheKey, fallback);
    return fallback;
  }

  try {
    const completion = await openai.chat.completions.create({
      model: OPENAI_CHAT_MODEL,
      temperature: 0.2,
      messages: [
        {
          role: 'system',
          content: 'Write a short personalized match explanation in at most 2 sentences. Mention strongest matched skills and 1-2 missing skills. No markdown.',
        },
        {
          role: 'user',
          content: JSON.stringify({
            candidateSummary: candidateSummaryText,
            job: {
              title: job.title,
              company: publicCompanyLabel(job, ''),
              description: job.description,
            },
            matchedSkills: scoringResult.matchedSkills,
            missingSkills: scoringResult.missingSkills,
            breakdown: scoringResult.breakdown,
            finalScore: scoringResult.finalScore,
          }),
        },
      ],
    });

    const explanation = completion.choices[0]?.message?.content?.trim();
    const result = explanation || `You match this role through ${scoringResult.matchedSkills.slice(0, 3).join(', ') || 'strong core alignment'}. Adding ${scoringResult.missingSkills.slice(0, 2).join(', ') || 'clearer role-specific evidence'} would improve your fit.`;
    AI_CACHE.explanation.set(cacheKey, result);
    return result;
  } catch (error) {
    const fallback = `You match this role through ${scoringResult.matchedSkills.slice(0, 3).join(', ') || 'strong core alignment'}. Adding ${scoringResult.missingSkills.slice(0, 2).join(', ') || 'clearer role-specific evidence'} would improve your fit.`;
    AI_CACHE.explanation.set(cacheKey, fallback);
    return fallback;
  }
}

async function validateAndNormalizeJobs(rawJobs) {
  return Promise.all(
    rawJobs.map(async (job) => {
      const directSkillArray = Array.isArray(job.skills) ? job.skills : [];
      const sentenceLikeSkills = directSkillArray.filter(looksLikeSentence);
      let cleanedSkills = sanitizeSkillList(directSkillArray.filter((skill) => !looksLikeSentence(skill)));

      const needsAiSkillCleaning = sentenceLikeSkills.length > 0 || cleanedSkills.length === 0;
      if (!cleanedSkills.length) {
        cleanedSkills = extractSkillsHeuristically(job);
      }

      const normalizedJob = {
        ...job,
        location: cleanLocation(job.location),
        skills: cleanedSkills,
        aiSkillCleaningPending: needsAiSkillCleaning,
      };

      const summary = summarizeJob(normalizedJob);
      const features = buildJobFeatures(summary);
      features.roleCategories = (features.roleCategories || []).slice(0, 2);
      features.jobLocation = {
        ...(features.jobLocation || {}),
        normalized: cleanLocation(features.jobLocation?.normalized || normalizedJob.location),
      };

      return {
        rawJob: normalizedJob,
        jobSummary: summary,
        jobFeatures: features,
      };
    })
  );
}

function scoreDeterministic(candidateFeatures, jobFeatures) {
  const skills = calculateSkillsScore(candidateFeatures, jobFeatures);
  const role = calculateRoleScore(candidateFeatures, jobFeatures);
  const experience = calculateExperienceScore(candidateFeatures, jobFeatures);
  const location = calculateLocationScore(candidateFeatures, jobFeatures);
  const education = calculateEducationScore(candidateFeatures, jobFeatures);
  const industry = calculateIndustryScore(candidateFeatures, jobFeatures);
  const workMode = calculateWorkModeScore(candidateFeatures, jobFeatures);
  const responsibilities = calculateResponsibilitiesScore(candidateFeatures, jobFeatures);

  const deterministicScore = Math.round(
    (
      skills.score +
      role.score +
      experience +
      responsibilities +
      industry +
      location +
      education +
      workMode
    ) * 100
  ) / 100;

  return {
    deterministicScore: clamp(deterministicScore, 0, 100),
    matchedSkills: skills.matchedSkills,
    missingSkills: skills.missingSkills,
    hardSkillMiss: Boolean(skills.hardSkillMiss),
    breakdown: {
      skills: Math.round(skills.score * 100) / 100,
      requiredSkills: Math.round((skills.requiredScore || 0) * 100) / 100,
      preferredSkills: Math.round((skills.preferredScore || 0) * 100) / 100,
      role: Math.round(role.score * 100) / 100,
      experience: Math.round(experience * 100) / 100,
      responsibilities: Math.round(responsibilities * 100) / 100,
      industry: Math.round(industry * 100) / 100,
      location: Math.round(location * 100) / 100,
      education: Math.round(education * 100) / 100,
      workMode: Math.round(workMode * 100) / 100,
      semanticBoost: 0,
    },
    diagnostics: {
      skillMatchPercent: skills.matchPercent,
      preferredSkillMatchPercent: skills.preferredMatchPercent,
      roleMatchType: role.matchType,
      hardSkillMiss: Boolean(skills.hardSkillMiss),
    },
  };
}

function formatJobResponse(scoredJob) {
  const finalLabel = scoredJob.matchLabel || getMatchLabel(scoredJob.finalScore);
  const rawJob = scoredJob.rawJob || {};
  const responsibilities =
    Array.isArray(rawJob.keyResponsibilities) && rawJob.keyResponsibilities.length
      ? rawJob.keyResponsibilities.filter(Boolean)
      : typeof rawJob.responsibilities === 'string'
      ? rawJob.responsibilities
          .split(/\r?\n|[-\u2022]/)
          .map((item) => String(item || '').trim())
          .filter(Boolean)
      : Array.isArray(rawJob.responsibilities)
      ? rawJob.responsibilities.filter(Boolean)
      : [];
  const requirements =
    Array.isArray(rawJob.requirements) && rawJob.requirements.length
      ? rawJob.requirements.filter(Boolean)
      : Array.isArray(rawJob.skills)
      ? rawJob.skills.filter(Boolean)
      : [];
  const benefits = Array.isArray(rawJob.benefits) ? rawJob.benefits.filter(Boolean) : [];

  const salaryJson =
    rawJob.salary && typeof rawJob.salary === 'object' && !Array.isArray(rawJob.salary)
      ? rawJob.salary
      : undefined;
  const salaryMin = rawJob.salaryMin ?? salaryJson?.min ?? null;
  const salaryMax = rawJob.salaryMax ?? salaryJson?.max ?? null;
  const salaryCurrency = rawJob.salaryCurrency ?? salaryJson?.currency ?? null;
  const salaryType = rawJob.salaryType ?? salaryJson?.type ?? null;
  const expectedSalary = rawJob.expectedSalary ?? salaryJson?.amount ?? null;

  // Surface the same scoring vocabulary the candidate UI uses for the legacy AI pipeline:
  // - `matchScore` is the percentage badge ("AI Fit XX% Match") — Match Accuracy only
  // - `rankingScore` is used for personalized ordering (match + freshness)
  // - `confidenceTag` drives the secondary chip (Excellent/Strong/Good/Partial)
  // - `shortReason` / `whyNotMatched` populate the low-score helper text
  const matchScoreValue = Math.round(Math.max(0, Math.min(100, Number(scoredJob.matchAccuracy ?? scoredJob.finalScore) || 0)));
  const rankingScoreValue = Math.round(
    Math.max(0, Math.min(100, Number(scoredJob.rankingScore ?? matchScoreValue) || 0)) * 100
  ) / 100;
  const freshnessScoreValue = Math.round(
    Math.max(0, Math.min(100, Number(scoredJob.freshnessScore ?? 0) || 0)) * 100
  ) / 100;
  const confidenceTag =
    matchScoreValue >= 85 ? 'Excellent Match'
    : matchScoreValue >= 70 ? 'Strong Match'
    : matchScoreValue >= 55 ? 'Good Match'
    : matchScoreValue >= 35 ? 'Partial Match'
    : 'Gap Identified';

  return {
    jobId: scoredJob.jobId,
    id: scoredJob.jobId,
    jobTitle: scoredJob.title,
    title: scoredJob.title,
    company: scoredJob.company,
    companyLogo: rawJob.company?.logoUrl || rawJob.client?.logo || null,
    openings: rawJob.openings ?? 1,
    finalScore: scoredJob.matchAccuracy ?? scoredJob.finalScore,
    matchScore: matchScoreValue,
    matchAccuracy: matchScoreValue,
    matchPercentage: matchScoreValue,
    rankingScore: rankingScoreValue,
    freshnessScore: freshnessScoreValue,
    normalizedScore: matchScoreValue,
    matchBreakdown: scoredJob.breakdown,
    breakdown: scoredJob.breakdown,
    matchedSkills: scoredJob.matchedSkills,
    missingSkills: scoredJob.missingSkills,
    topMatchedSkills: scoredJob.matchedSkills.slice(0, 3),
    topMissingSkills: scoredJob.missingSkills.slice(0, 3),
    explanation: scoredJob.explanation,
    reasoning: scoredJob.explanation,
    shortReason: scoredJob.whyNotMatched || scoredJob.explanation || null,
    confidenceLevel: scoredJob.confidenceLevel,
    confidenceScore: scoredJob.confidenceScore,
    confidenceTag,
    matchLabel: finalLabel,
    scoreColorHint: computeScoreColorHint(scoredJob.matchAccuracy ?? scoredJob.finalScore),
    location: scoredJob.location,
    workMode: scoredJob.workMode,
    deterministicScore: scoredJob.deterministicScore,
    aiScore: scoredJob.aiScore ?? null,
    aiAnalysis: scoredJob.aiAnalysis ?? null,
    whyNotMatched: (scoredJob.matchAccuracy ?? scoredJob.finalScore) < 50 ? scoredJob.whyNotMatched : null,
    aiEnhanced: Boolean(scoredJob.aiEnhanced),
    diagnostics: scoredJob.diagnostics,
    type: rawJob.type || rawJob.employmentType || null,
    employmentType: rawJob.employmentType || rawJob.type || null,
    experienceRequired: rawJob.experienceRequired || rawJob.experienceLevel || null,
    experienceLevel: rawJob.experienceLevel || rawJob.experienceRequired || null,
    salary: rawJob.salary ?? null,
    salaryMin,
    salaryMax,
    salaryCurrency,
    salaryType,
    expectedSalary,
    overview: rawJob.overview || rawJob.aboutRole || rawJob.description || null,
    description: rawJob.description || rawJob.jobDescription || rawJob.overview || rawJob.aboutRole || null,
    jobDescription: rawJob.jobDescription || rawJob.description || null,
    jobSummary: rawJob.jobSummary || rawJob.overview || rawJob.aboutRole || rawJob.description || null,
    responsibilities: rawJob.responsibilities || null,
    keyResponsibilities: responsibilities,
    qualificationsAndExperience: rawJob.qualificationsAndExperience || null,
    requirements,
    skills: Array.isArray(rawJob.skills) ? rawJob.skills : [],
    preferredSkills: Array.isArray(rawJob.preferredSkills) ? rawJob.preferredSkills : [],
    education: rawJob.education || rawJob.qualification || rawJob.educationalQualification || null,
    qualification: rawJob.qualification || rawJob.education || null,
    educationalQualification: rawJob.educationalQualification || rawJob.education || null,
    compensation: rawJob.compensation || expectedSalary || null,
    compensationBenefits: rawJob.compensationBenefits || null,
    benefits,
    companyOverview: rawJob.companyOverview || rawJob.overview || null,
    // Jobs are written by both backend1 and backendphase2; fall back through every
    // timestamp variant (postedDate, postedAt, createdAt, updatedAt) so the candidate UI
    // always has a real created-at value instead of defaulting to "Just now".
    postedDate:
      rawJob.postedDate ||
      rawJob.postedAt ||
      rawJob.createdAt ||
      rawJob.updatedAt ||
      null,
    postedAt:
      rawJob.postedAt ||
      rawJob.postedDate ||
      rawJob.createdAt ||
      rawJob.updatedAt ||
      null,
    createdAt:
      rawJob.createdAt ||
      rawJob.postedAt ||
      rawJob.postedDate ||
      rawJob.updatedAt ||
      null,
    jobLocationType: rawJob.jobLocationType || rawJob.workMode || null,
  };
}

function getMatchLabel(score) {
  if (score >= 75) return 'Best Match';
  if (score >= 60) return 'Good Match';
  return 'Closest Match';
}

async function runJobMatchingPipeline({ candidate, cleanedResumeText, limit, skipAi = false }) {
  const pipelineStartedAt = Date.now();
  const normalizedCandidate = summarizeCandidate(candidate);
  const candidateFeatures = buildCandidateFeatures(normalizedCandidate);
  const candidateSummaryText = buildCandidateSummaryText(normalizedCandidate, cleanedResumeText);

  console.log('[PHASE1 JOB MATCH PIPELINE] ACTIVE');
  console.log('[PIPELINE START]');
  console.log('STEP 1: Candidate Loaded');

  const jobs = await getJobs();

  console.log(`STEP 2: Jobs Loaded (${jobs.length})`);
  console.log('STEP 3: Normalization Check');
  console.log(`candidate skills (first 5): ${(normalizedCandidate.normalizedSkills || []).slice(0, 5).join(', ') || '-'}`);

  const validatedJobs = await validateAndNormalizeJobs(jobs);
  const preFilteredJobs = validatedJobs;
  console.log('[PRE-FILTER]');
  console.log(`total jobs: ${validatedJobs.length}`);
  console.log(`filtered jobs count: ${preFilteredJobs.length}`);
  validatedJobs.forEach(({ rawJob }) => {
    console.log(`job ${rawJob.id} skills (first 5): ${(rawJob.skills || []).slice(0, 5).join(', ') || '-'}`);
  });

  console.log('STEP 4: Feature Vectors Created');

  const deterministicStartedAt = Date.now();
  const scoringPool = preFilteredJobs;
  const scoredJobs = scoringPool.map(({ rawJob, jobSummary, jobFeatures }) => {
    const deterministic = scoreDeterministic(candidateFeatures, jobFeatures);
    const candidateSkills = sanitizeSkillList(candidateFeatures.skills || []);
    const jobSkills = sanitizeSkillList(jobFeatures.requiredSkills || []);
    const postedAt = resolveJobPostedAt(rawJob, jobFeatures);
    const freshnessScore = calculateFreshnessScore(postedAt);
    const matchAccuracy = combineMatchAccuracy(deterministic.deterministicScore, null, {
      hardSkillMiss: deterministic.hardSkillMiss,
    });
    const rankingScore = calculateRankingScore(matchAccuracy, freshnessScore);

    console.log('STEP 5: SCORING PER JOB:');
    console.log(`job=${rawJob.title} (${rawJob.id})`);
    console.log('Job:', rawJob.title);
    console.log(`Skills Score: ${deterministic.breakdown.skills}`);
    console.log(`Skill Match %: ${deterministic.diagnostics.skillMatchPercent}%`);
    console.log(`Role Score: ${deterministic.breakdown.role}`);
    console.log(`Role Match Type: ${deterministic.diagnostics.roleMatchType}`);
    console.log(`Experience Score: ${deterministic.breakdown.experience}`);
    console.log(`Responsibilities Score: ${deterministic.breakdown.responsibilities}`);
    console.log(`Industry Score: ${deterministic.breakdown.industry}`);
    console.log(`Location Score: ${deterministic.breakdown.location}`);
    console.log(`Education Score: ${deterministic.breakdown.education}`);
    console.log(`Work Mode Score: ${deterministic.breakdown.workMode}`);
    console.log(`Rule Score: ${deterministic.deterministicScore}`);
    console.log(`Freshness Score: ${freshnessScore}`);
    console.log(`Ranking Score: ${rankingScore}`);
    console.log(`Matched Skills: ${deterministic.matchedSkills.join(', ') || '-'}`);
    console.log(`Missing Skills: ${deterministic.missingSkills.join(', ') || '-'}`);
    console.log('Clean Candidate Skills:', candidateSkills);
    console.log('Clean Job Skills:', jobSkills);

    return {
      jobId: rawJob.id,
      title: rawJob.title,
      company: publicCompanyLabel(rawJob, ''),
      location: rawJob.location,
      workMode: rawJob.workMode || rawJob.jobLocationType || null,
      postedAt,
      deterministicScore: deterministic.deterministicScore,
      matchAccuracy,
      finalScore: matchAccuracy,
      freshnessScore,
      rankingScore,
      breakdown: deterministic.breakdown,
      matchedSkills: deterministic.matchedSkills,
      missingSkills: deterministic.missingSkills,
      hardSkillMiss: deterministic.hardSkillMiss,
      explanation: 'Deterministic match generated.',
      whyNotMatched: matchAccuracy < 55 ? deriveLowMatchReason(deterministic) : null,
      diagnostics: deterministic.diagnostics,
      confidenceScore: computeConfidence({
        deterministicScore: deterministic.deterministicScore,
        breakdown: deterministic.breakdown,
        diagnostics: deterministic.diagnostics,
      }).confidenceScore,
      confidenceLevel: computeConfidence({
        deterministicScore: deterministic.deterministicScore,
        breakdown: deterministic.breakdown,
        diagnostics: deterministic.diagnostics,
      }).confidenceLevel,
      rawJob,
      jobSummary,
      jobFeatures,
      aiSkillCleaningPending: rawJob.aiSkillCleaningPending,
      aiEnhanced: false,
      hooks: {
        embeddingReady: false,
        externalJobIngestionReady: true,
        cacheReady: true,
      },
    };
  });
  const deterministicDurationMs = Date.now() - deterministicStartedAt;

  console.log('STEP 6: Ranking (deterministic)');
  scoredJobs.sort((a, b) => {
    if (b.deterministicScore !== a.deterministicScore) return b.deterministicScore - a.deterministicScore;
    return (b.breakdown.skills || 0) - (a.breakdown.skills || 0);
  });

  scoredJobs.slice(0, 3).forEach((job, index) => {
    console.log(`Top ${index + 1}: ${job.title} | ${job.company} | ${job.deterministicScore}`);
  });

  // The candidate explore page needs every job scored, not just the AI-elite top-N.
  // AI pool = top deterministic jobs + recent jobs (deduped), capped for cost control.
  const requestedLimit = Number(limit);
  const hasExplicitLimit = Number.isFinite(requestedLimit) && requestedLimit > 0;
  const safeLimit = hasExplicitLimit ? Math.min(Math.max(requestedLimit, 5), 500) : 500;
  const topJobs = selectAiCandidateJobs(scoredJobs);

  let aiApplied = false;
  const aiStartedAt = Date.now();
  if (skipAi) {
    for (const job of topJobs) {
      job.breakdown.aiScore = 0;
      job.breakdown.semanticBoost = 0;
      job.matchAccuracy = combineMatchAccuracy(job.deterministicScore, null, {
        hardSkillMiss: job.hardSkillMiss,
      });
      job.finalScore = job.matchAccuracy;
      job.rankingScore = calculateRankingScore(job.matchAccuracy, job.freshnessScore);
      job.explanation = 'Deterministic match generated.';
      job.whyNotMatched = job.matchAccuracy < 50 ? deriveLowMatchReason(job) : null;
      const confidence = computeConfidence(job, null);
      job.confidenceScore = confidence.confidenceScore;
      job.confidenceLevel = confidence.confidenceLevel;
      job.aiEnhanced = false;
    }
  } else {
    console.log('[PIPELINE MODE] AI_MATCH_V2_ACTIVE');
    console.log(`[AI POOL] size=${topJobs.length} (top=${AI_TOP_LIMIT}, recentDays=${AI_RECENT_DAYS}, max=${AI_POOL_MAX})`);
    await Promise.all(
      topJobs.map(async (job) => {
        try {
          let aiData = null;

          try {
            aiData = await getAIMatchScore(normalizedCandidate, job.rawJob);
          } catch (err) {
            console.error('AI MATCH ERROR', err);
          }

          const aiScoreRaw = aiData && Number.isFinite(Number(aiData.finalScore))
            ? Number(aiData.finalScore)
            : null;
          const matchAccuracy = combineMatchAccuracy(job.deterministicScore, aiScoreRaw, {
            hardSkillMiss: job.hardSkillMiss,
          });

          const aiMatchedSkills = sanitizeSkillList(aiData?.matchedSkills || []);
          const aiMissingSkills = sanitizeSkillList(aiData?.missingCriticalSkills || []);

          job.breakdown.aiScore = aiScoreRaw ?? 0;
          job.breakdown.semanticBoost = 0;
          job.matchAccuracy = matchAccuracy;
          job.finalScore = matchAccuracy;
          job.rankingScore = calculateRankingScore(matchAccuracy, job.freshnessScore);
          if (aiMatchedSkills.length) {
            job.matchedSkills = aiMatchedSkills;
          }
          if (aiMissingSkills.length) {
            job.missingSkills = aiMissingSkills;
          }
          job.aiScore = aiScoreRaw;
          job.matchLabel = aiData?.verdict || 'Closest Match';
          job.aiAnalysis = aiData?.analysis || null;
          job.explanation = aiData?.analysis?.summary || 'Deterministic match generated.';
          job.whyNotMatched = job.matchAccuracy < 50 ? deriveLowMatchReason(job) : null;
          const confidence = computeConfidence(job, aiScoreRaw);
          job.confidenceScore = confidence.confidenceScore;
          job.confidenceLevel = confidence.confidenceLevel;
          job.aiEnhanced = Boolean(aiData);
          aiApplied = aiApplied || Boolean(aiData);

          console.log('[AI MATCH V2]');
          console.log(`Deterministic Score: ${job.deterministicScore}`);
          console.log(`AI Score: ${aiScoreRaw ?? 0}`);
          console.log(`Match Accuracy: ${job.matchAccuracy}`);
          console.log(`Freshness: ${job.freshnessScore}`);
          console.log(`Ranking Score: ${job.rankingScore}`);
          console.log(`Matched Skills: ${job.matchedSkills.join(', ') || '-'}`);
          console.log(`Missing Skills: ${job.missingSkills.join(', ') || '-'}`);
        } catch (error) {
          console.log('[AI ERROR FALLBACK]');
          job.breakdown.aiScore = 0;
          job.breakdown.semanticBoost = 0;
          job.matchAccuracy = combineMatchAccuracy(job.deterministicScore, null, {
            hardSkillMiss: job.hardSkillMiss,
          });
          job.finalScore = job.matchAccuracy;
          job.rankingScore = calculateRankingScore(job.matchAccuracy, job.freshnessScore);
          job.explanation = `You match this role through ${job.matchedSkills.slice(0, 3).join(', ') || 'strong core alignment'}. Adding ${job.missingSkills.slice(0, 2).join(', ') || 'clearer role-specific evidence'} would improve your fit.`;
          job.whyNotMatched = job.matchAccuracy < 50 ? deriveLowMatchReason(job) : null;
          const confidence = computeConfidence(job, null);
          job.confidenceScore = confidence.confidenceScore;
          job.confidenceLevel = confidence.confidenceLevel;
          job.aiEnhanced = false;
        }
      })
    );
  }
  const aiDurationMs = Date.now() - aiStartedAt;

  // Ensure non-AI jobs still have ranking fields populated.
  for (const job of scoredJobs) {
    if (job.matchAccuracy == null) {
      job.matchAccuracy = combineMatchAccuracy(job.deterministicScore, null, {
        hardSkillMiss: job.hardSkillMiss,
      });
      job.finalScore = job.matchAccuracy;
    }
    if (job.rankingScore == null) {
      job.rankingScore = calculateRankingScore(job.matchAccuracy, job.freshnessScore);
    }
  }

  // Sort by Ranking Score (match + freshness), never by freshness alone.
  // Displayed match % stays Match Accuracy.
  const finalRanked = [...scoredJobs]
    .sort((a, b) => {
      if (b.rankingScore !== a.rankingScore) return b.rankingScore - a.rankingScore;
      if (b.matchAccuracy !== a.matchAccuracy) return b.matchAccuracy - a.matchAccuracy;
      const aPosted = new Date(a.postedAt || 0).getTime() || 0;
      const bPosted = new Date(b.postedAt || 0).getTime() || 0;
      if (bPosted !== aPosted) return bPosted - aPosted;
      return String(a.jobId || '').localeCompare(String(b.jobId || ''));
    })
    .slice(0, safeLimit);

  console.log('[PERFORMANCE]');
  console.log(`total pipeline time: ${Date.now() - pipelineStartedAt}ms`);
  console.log(`deterministic scoring time: ${deterministicDurationMs}ms`);
  console.log(`AI processing time: ${aiDurationMs}ms`);
  console.log('[PIPELINE END]');

  return {
    candidateProfile: {
      id: normalizedCandidate.id,
      name: normalizedCandidate.name,
      currentTitle: normalizedCandidate.currentTitle,
      currentLocation: normalizedCandidate.currentLocation,
      summaryText: normalizedCandidate.summaryText,
      skills: normalizedCandidate.normalizedSkills,
      roleCategories: normalizedCandidate.roleCategories,
      experienceLevel: normalizedCandidate.candidateExperience,
      educationLevel: normalizedCandidate.educationLevel,
      location: normalizedCandidate.normalizedLocation,
      workModePreference: normalizedCandidate.workModePreference,
      featureVector: candidateFeatures,
    },
    totalJobsScanned: jobs.length,
    aiApplied,
    data: finalRanked.map(formatJobResponse),
  };
}

function resolveCandidateResumeText(candidate) {
  if (!candidate?.resume) return '';
  if (typeof candidate.resume.resumeText === 'string') return candidate.resume.resumeText;
  if (typeof candidate.resume.cleanedText === 'string') return candidate.resume.cleanedText;
  if (candidate.resume.resumeJson) return JSON.stringify(candidate.resume.resumeJson);
  return '';
}

/**
 * Score one candidate against one job using the same blend as the personalized pipeline.
 */
async function scoreCandidateAgainstJob({ candidate, cleanedResumeText = '', job }) {
  if (!candidate || !job?.id) return null;

  const normalizedCandidate = summarizeCandidate(candidate);
  if (cleanedResumeText) {
    buildCandidateSummaryText(normalizedCandidate, cleanedResumeText);
  }

  const [validated] = await validateAndNormalizeJobs([{ ...job, source: 'db' }]);
  if (!validated) return null;

  const candidateFeatures = buildCandidateFeatures(normalizedCandidate);
  const deterministic = scoreDeterministic(candidateFeatures, validated.jobFeatures);
  const postedAt = resolveJobPostedAt(validated.rawJob, validated.jobFeatures);
  const freshnessScore = calculateFreshnessScore(postedAt);
  let matchAccuracy = combineMatchAccuracy(deterministic.deterministicScore, null, {
    hardSkillMiss: deterministic.hardSkillMiss,
  });
  let aiEnhanced = false;
  let aiScore = null;

  if (matchAccuracy >= 50) {
    try {
      const aiData = await getAIMatchScore(normalizedCandidate, validated.rawJob);
      if (aiData && Number.isFinite(Number(aiData.finalScore))) {
        aiScore = Number(aiData.finalScore);
        matchAccuracy = combineMatchAccuracy(deterministic.deterministicScore, aiScore, {
          hardSkillMiss: deterministic.hardSkillMiss,
        });
        aiEnhanced = true;
      }
    } catch (error) {
      console.warn('[job-match-alert] AI score failed:', error?.message || error);
    }
  }

  const rankingScore = calculateRankingScore(matchAccuracy, freshnessScore);
  const matchScore = Math.round(Math.max(0, Math.min(100, matchAccuracy)));

  return {
    finalScore: matchAccuracy,
    matchScore,
    matchAccuracy,
    rankingScore,
    freshnessScore,
    deterministicScore: deterministic.deterministicScore,
    aiScore,
    aiEnhanced,
    matchedSkills: deterministic.matchedSkills,
    missingSkills: deterministic.missingSkills,
    breakdown: deterministic.breakdown,
  };
}

module.exports = {
  runJobMatchingPipeline,
  scoreCandidateAgainstJob,
  resolveCandidateResumeText,
  // Exported for unit tests / debugging
  scoreDeterministic,
  calculateFreshnessScore,
  calculateRankingScore,
  combineMatchAccuracy,
  selectAiCandidateJobs,
  calculateSkillsScore,
  calculateExperienceScore,
  RANK_MATCH_WEIGHT,
  RANK_FRESHNESS_WEIGHT,
  FRESHNESS_TAU_DAYS,
  RELEVANCE_FLOOR,
};
