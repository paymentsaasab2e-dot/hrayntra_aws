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
  const candidateSkills = new Set((candidate.skills || []).map(s => normalizeSkill(s.skill?.name || s)));
  // Add resume skills
  const resumeJson = candidate.resume?.resumeJson || {};
  const rSkills = Array.isArray(resumeJson.skills) ? resumeJson.skills : (resumeJson.skills?.technical || []);
  rSkills.forEach(s => candidateSkills.add(normalizeSkill(s)));

  const reqSkills = (job.skills || []).map(normalizeSkill);
  const prefSkills = (job.preferredSkills || []).map(normalizeSkill);
  
  const skillRes = calculateWeightedSkillScore(candidateSkills, reqSkills, prefSkills);
  
  // Experience
  let requiredExp = 0;
  if (job.experienceRequired) {
    const matches = job.experienceRequired.match(/(\d+)/g);
    if (matches) requiredExp = parseInt(matches[0]);
  }
  const candidateExp = candidate.profile?.totalExperience || (candidate.workExperiences?.length || 0) * 0.5;
  const expRes = calculateExperienceScore(candidateExp, requiredExp, job.experienceLevel);

  const locScore = calculateLocationScore(candidate, job);

  const ruleScore = (skillRes.score * 0.5) + (expRes.score * 0.35) + (locScore * 0.15);

  return {
    score: ruleScore,
    matchedSkills: skillRes.matched,
    missingSkills: skillRes.missing,
    penalties: skillRes.penalty + expRes.penalty
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
  normalizeSkill
};
