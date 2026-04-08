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

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
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
const AI_TOP_LIMIT = 5;
const MIN_VISIBLE_SCORE = 20;
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

STEP 2: SCORING

1. Skills Match (0-40)
2. Experience Relevance (0-25)
3. Responsibilities Match (0-20)
4. Industry Alignment (0-10)
5. Location (0-5)

----------------------------------------

STEP 3: FINAL SCORE

finalScore = sum of all

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
    normalizedCandidateSkills.some((candidateSkill) => isSkillMatch(candidateSkill, jobSkill))
  );
  const missing = normalizedRequiredSkills.filter((jobSkill) =>
    !normalizedCandidateSkills.some((candidateSkill) => isSkillMatch(candidateSkill, jobSkill))
  );

  return {
    matchedSkills: Array.from(new Set(matched.map((skill) => normalizeSkill(skill)))),
    missingSkills: Array.from(new Set(missing.map((skill) => normalizeSkill(skill)))),
  };
}

function calculateSkillsScore(candidateFeatures, jobFeatures) {
  const candidateSkills = sanitizeSkillList(candidateFeatures.skills || []);
  const jobSkills = sanitizeSkillList(jobFeatures.requiredSkills || []);

  if (!jobSkills.length) {
    return {
      score: 0,
      matchedSkills: [],
      missingSkills: [],
      matchPercent: 0,
    };
  }

  const { matchedSkills, missingSkills } = computeMatchedSkills(candidateSkills, jobSkills);
  const matchPercent = jobSkills.length === 0
    ? 0
    : matchedSkills.length / jobSkills.length;

  let score = 0;
  if (matchPercent >= 0.7) score = 40;
  else if (matchPercent >= 0.5) score = 30;
  else if (matchPercent >= 0.3) score = 20;
  else if (matchPercent > 0) score = 10;
  else score = 0;

  return {
    score: Math.round(score * 100) / 100,
    matchedSkills,
    missingSkills,
    matchPercent: Math.round(matchPercent * 100),
  };
}

function calculateRoleScore(candidateFeatures, jobFeatures) {
  const candidateRoles = new Set(candidateFeatures.roleCategories || []);
  const jobRoles = (jobFeatures.roleCategories || []).slice(0, 2);

  const exactMatches = jobRoles.filter((role) => candidateRoles.has(role));
  if (exactMatches.length > 0) {
    return { score: 20, matchedRoles: exactMatches, matchType: 'exact' };
  }

  const candidateRoleText = Array.from(candidateRoles).join(' ').toLowerCase();
  const jobRoleText = jobRoles.join(' ').toLowerCase();
  const candidateTokens = new Set(tokenizeText(candidateRoleText));
  const jobTokens = tokenizeText(jobRoleText);
  const hasFullStackBridge =
    (candidateRoles.has('Full Stack') && (jobRoles.includes('Frontend') || jobRoles.includes('Backend'))) ||
    (jobRoles.includes('Full Stack') && (candidateRoles.has('Frontend') || candidateRoles.has('Backend')));
  const sharedRoleToken = jobTokens.some((token) => candidateTokens.has(token));
  const related = hasFullStackBridge || sharedRoleToken;

  if (related) {
    return { score: 12, matchedRoles: [], matchType: 'related' };
  }

  return { score: 4, matchedRoles: [], matchType: 'none' };
}

function calculateExperienceScore(candidateFeatures, jobFeatures) {
  const candidateYears = Number(candidateFeatures.experienceYears || 0);
  const requiredYears = Number(jobFeatures.requiredExperienceYears || 0);

  if (requiredYears <= 0) {
    return 15;
  }

  if (candidateYears >= requiredYears) {
    return 15;
  }

  const ratio = clamp(candidateYears / requiredYears, 0.2, 1);
  return Math.round(ratio * 15 * 100) / 100;
}

function calculateLocationScore(candidateFeatures, jobFeatures) {
  const candidateTokens = new Set(candidateFeatures.location?.tokens || []);
  const jobLocation = jobFeatures.jobLocation?.normalized || 'unknown';

  if (jobFeatures.workMode === 'REMOTE') {
    return 10;
  }

  if (jobLocation === 'unknown') {
    return 5;
  }

  const jobTokens = jobFeatures.jobLocation?.tokens || [];
  if (jobTokens.some((token) => candidateTokens.has(token))) {
    return 9;
  }

  if (jobFeatures.workMode === 'HYBRID') {
    return 7;
  }

  return 4;
}

function calculateEducationScore(candidateFeatures, jobFeatures) {
  const candidateRank = Number(candidateFeatures.educationRank || 0);
  const requiredRank = Number(jobFeatures.educationRequirementRank || 0);

  if (!requiredRank) return 3;
  if (candidateRank >= requiredRank) return 5;
  if (candidateRank === requiredRank - 1) return 3;
  return 2;
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
  if ((scoring.breakdown.skills || 0) < 18 && scoring.missingSkills.length) {
    reasons.push(`missing ${scoring.missingSkills.slice(0, 2).join(' and ')}`);
  }
  if ((scoring.breakdown.role || 0) <= 4) {
    reasons.push('weak role alignment');
  }
  if ((scoring.breakdown.location || 0) <= 4) {
    reasons.push('location mismatch');
  }
  if ((scoring.breakdown.experience || 0) <= 7) {
    reasons.push('experience gap');
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
      model: 'gpt-4o-mini',
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
      model: 'gpt-4o-mini',
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
      model: 'gpt-4o-mini',
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
      model: 'gpt-4o-mini',
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
    model: 'gpt-4o-mini',
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
      model: 'gpt-4o-mini',
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
              company: job.company?.name || job.client?.companyName || 'Unknown Company',
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
      model: 'gpt-4o-mini',
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
              company: job.company?.name || job.client?.companyName || 'Unknown Company',
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

  return {
    deterministicScore: Math.round((skills.score + role.score + experience + location + education) * 100) / 100,
    matchedSkills: skills.matchedSkills,
    missingSkills: skills.missingSkills,
    breakdown: {
      skills: Math.round(skills.score * 100) / 100,
      role: Math.round(role.score * 100) / 100,
      experience: Math.round(experience * 100) / 100,
      location: Math.round(location * 100) / 100,
      education: Math.round(education * 100) / 100,
      semanticBoost: 0,
    },
    diagnostics: {
      skillMatchPercent: skills.matchPercent,
      roleMatchType: role.matchType,
    },
  };
}

function formatJobResponse(scoredJob) {
  const finalLabel = scoredJob.matchLabel || getMatchLabel(scoredJob.finalScore);
  return {
    jobId: scoredJob.jobId,
    title: scoredJob.title,
    company: scoredJob.company,
    finalScore: scoredJob.finalScore,
    breakdown: scoredJob.breakdown,
    matchedSkills: scoredJob.matchedSkills,
    missingSkills: scoredJob.missingSkills,
    topMatchedSkills: scoredJob.matchedSkills.slice(0, 3),
    topMissingSkills: scoredJob.missingSkills.slice(0, 3),
    explanation: scoredJob.explanation,
    confidenceLevel: scoredJob.confidenceLevel,
    confidenceScore: scoredJob.confidenceScore,
    matchLabel: finalLabel,
    scoreColorHint: computeScoreColorHint(scoredJob.finalScore),
    location: scoredJob.location,
    workMode: scoredJob.workMode,
    deterministicScore: scoredJob.deterministicScore,
    aiScore: scoredJob.aiScore ?? null,
    aiAnalysis: scoredJob.aiAnalysis ?? null,
    whyNotMatched: scoredJob.finalScore < 50 ? scoredJob.whyNotMatched : null,
    aiEnhanced: Boolean(scoredJob.aiEnhanced),
    diagnostics: scoredJob.diagnostics,
  };
}

function getMatchLabel(score) {
  if (score >= 75) return 'Best Match';
  if (score >= 60) return 'Good Match';
  return 'Closest Match';
}

async function runJobMatchingPipeline({ candidate, cleanedResumeText, limit }) {
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

    console.log('STEP 5: SCORING PER JOB:');
    console.log(`job=${rawJob.title} (${rawJob.id})`);
    console.log('Job:', rawJob.title);
    console.log(`Skills Score: ${deterministic.breakdown.skills}`);
    console.log(`Skill Match %: ${deterministic.diagnostics.skillMatchPercent}%`);
    console.log(`Role Score: ${deterministic.breakdown.role}`);
    console.log(`Role Match Type: ${deterministic.diagnostics.roleMatchType}`);
    console.log(`Experience Score: ${deterministic.breakdown.experience}`);
    console.log(`Location Score: ${deterministic.breakdown.location}`);
    console.log(`Education Score: ${deterministic.breakdown.education}`);
    console.log(`Total Score: ${deterministic.deterministicScore}`);
    console.log(`Matched Skills: ${deterministic.matchedSkills.join(', ') || '-'}`);
    console.log(`Missing Skills: ${deterministic.missingSkills.join(', ') || '-'}`);
    console.log('Clean Candidate Skills:', candidateSkills);
    console.log('Clean Job Skills:', jobSkills);

    return {
      jobId: rawJob.id,
      title: rawJob.title,
      company: rawJob.company?.name || rawJob.client?.companyName || 'Unknown Company',
      location: rawJob.location,
      workMode: rawJob.workMode || rawJob.jobLocationType || null,
      deterministicScore: deterministic.deterministicScore,
      finalScore: deterministic.deterministicScore,
      breakdown: deterministic.breakdown,
      matchedSkills: deterministic.matchedSkills,
      missingSkills: deterministic.missingSkills,
      explanation: 'Deterministic match generated.',
      whyNotMatched: deterministic.deterministicScore < 55 ? deriveLowMatchReason(deterministic) : null,
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

  console.log('STEP 6: Ranking');
  scoredJobs.sort((a, b) => {
    if (b.deterministicScore !== a.deterministicScore) return b.deterministicScore - a.deterministicScore;
    return (b.breakdown.skills || 0) - (a.breakdown.skills || 0);
  });

  scoredJobs.slice(0, 3).forEach((job, index) => {
    console.log(`Top ${index + 1}: ${job.title} | ${job.company} | ${job.deterministicScore}`);
  });

  const safeLimit = clamp(Number(limit) || 5, 5, 10);
  const topJobs = scoredJobs.slice(0, AI_TOP_LIMIT);

  let aiApplied = false;
  const aiStartedAt = Date.now();
  console.log('[PIPELINE MODE] AI_MATCH_V2_ACTIVE');
  await Promise.all(
    topJobs.map(async (job) => {
      try {
        let aiData = null;

        try {
          aiData = await getAIMatchScore(normalizedCandidate, job.rawJob);
        } catch (err) {
          console.error('AI MATCH ERROR', err);
        }

        let finalScore = job.deterministicScore;
        if (aiData && Number.isFinite(Number(aiData.finalScore))) {
          finalScore = Math.min(
            100,
            (job.deterministicScore * 0.6) + (Number(aiData.finalScore) * 0.4)
          );
        }

        const aiMatchedSkills = sanitizeSkillList(aiData?.matchedSkills || []);
        const aiMissingSkills = sanitizeSkillList(aiData?.missingCriticalSkills || []);

        job.breakdown.aiScore = aiData?.finalScore ?? 0;
        job.breakdown.semanticBoost = 0;
        job.finalScore = Math.round(finalScore * 100) / 100;
        if (aiMatchedSkills.length) {
          job.matchedSkills = aiMatchedSkills;
        }
        if (aiMissingSkills.length) {
          job.missingSkills = aiMissingSkills;
        }
        job.aiScore = aiData?.finalScore || null;
        job.matchLabel = aiData?.verdict || 'Closest Match';
        job.aiAnalysis = aiData?.analysis || null;
        job.explanation = aiData?.analysis?.summary || 'Deterministic match generated.';
        job.whyNotMatched = job.finalScore < 50 ? deriveLowMatchReason(job) : null;
        const confidence = computeConfidence(job, aiData?.finalScore ?? null);
        job.confidenceScore = confidence.confidenceScore;
        job.confidenceLevel = confidence.confidenceLevel;
        job.aiEnhanced = Boolean(aiData);
        aiApplied = aiApplied || Boolean(aiData);

        console.log('[AI MATCH V2]');
        console.log(`Deterministic Score: ${job.deterministicScore}`);
        console.log(`AI Score: ${aiData?.finalScore ?? 0}`);
        console.log(`Combined Score: ${job.finalScore}`);
        console.log(`Matched Skills: ${job.matchedSkills.join(', ') || '-'}`);
        console.log(`Missing Skills: ${job.missingSkills.join(', ') || '-'}`);
      } catch (error) {
        console.log('[AI ERROR FALLBACK]');
        job.breakdown.aiScore = 0;
        job.breakdown.semanticBoost = 0;
        job.finalScore = job.deterministicScore;
        job.explanation = `You match this role through ${job.matchedSkills.slice(0, 3).join(', ') || 'strong core alignment'}. Adding ${job.missingSkills.slice(0, 2).join(', ') || 'clearer role-specific evidence'} would improve your fit.`;
        job.whyNotMatched = job.finalScore < 50 ? deriveLowMatchReason(job) : null;
        const confidence = computeConfidence(job, null);
        job.confidenceScore = confidence.confidenceScore;
        job.confidenceLevel = confidence.confidenceLevel;
        job.aiEnhanced = false;
      }
    })
  );
  const aiDurationMs = Date.now() - aiStartedAt;

  const finalRanked = [...scoredJobs]
    .filter((job) => job.finalScore >= MIN_VISIBLE_SCORE)
    .sort((a, b) => {
      if (b.finalScore !== a.finalScore) return b.finalScore - a.finalScore;
      return b.deterministicScore - a.deterministicScore;
    })
    .slice(0, Math.max(5, Math.min(safeLimit, Math.max(scoredJobs.length, 1))));

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

module.exports = {
  runJobMatchingPipeline,
};
