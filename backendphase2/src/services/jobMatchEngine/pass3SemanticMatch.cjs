// File   : pass3SemanticMatch.cjs
// Purpose: Section-weighted semantic similarity via embeddings (OpenAI then Mistral).
// Part of: HRJob+Candidate Matching Pipeline v1.0

const crypto = require('crypto');
const { getSharedEmbeddingCache } = require('./pipeline.cjs');
const { fallbackLog } = require('./stageLogger.cjs');
const { createClients, getEmbeddingWithFallback } = require('../embeddingFallback.service.cjs');

function hashKey(text) {
  return crypto.createHash('sha256').update(String(text || '').slice(0, 8000)).digest('hex').slice(0, 40);
}

function cosineSimilarity(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length || !a.length) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

function normalizeForceProvider(provider) {
  if (provider === 'openai') return 'openai';
  if (provider === 'mistral-native') return 'mistral-native';
  if (provider === 'mistral') return 'mistral-sdk';
  return null;
}

function pickText(primary, fallback, max = 6000) {
  const s = String(primary || '').trim() || String(fallback || '').trim();
  return s.slice(0, max);
}

function tokenizeForLexical(text) {
  const raw = String(text || '').toLowerCase();
  const tokens = raw.match(/\b[a-z0-9+#][a-z0-9+#.\-]{1,}\b/gi) || [];
  return new Set(tokens.filter((t) => t.length >= 2 && !/^\d+$/.test(t)));
}

/** Deterministic overlap when embedding APIs are rate-limited or down. */
function lexicalSemanticScore(jobText, candidateText) {
  const a = tokenizeForLexical(jobText);
  const b = tokenizeForLexical(candidateText);
  if (!a.size || !b.size) return 32;
  let inter = 0;
  for (const t of a) {
    if (b.has(t)) inter += 1;
  }
  const union = a.size + b.size - inter;
  const jaccard = union > 0 ? inter / union : 0;
  const score = Math.round(Math.min(88, Math.max(18, jaccard * 100 + (inter >= 3 ? 8 : 0))));
  return score;
}

function buildSectionTexts(jobSections, jobText, candidateSections, candidateText) {
  const jr1 = pickText(jobSections?.responsibilities, jobText);
  const jr2 = pickText(jobSections?.requirements, jobText);
  const jr3 = pickText(jobSections?.aboutUs, jobText);
  const cr1 = pickText(candidateSections?.workExperience, candidateText);
  const cr2 = pickText(candidateSections?.skills, candidateText);
  const cr3 = pickText(candidateSections?.summary, candidateText);

  const jobParts = { r1: jr1 || jobText, r2: jr2 || jobText, r3: jr3 || jobText };
  const candParts = { r1: cr1 || candidateText, r2: cr2 || candidateText, r3: cr3 || candidateText };
  return { jobParts, candParts };
}

async function embedCached(text, clients, cache, logLabel, sessionProvider) {
  const t = String(text || '').trim() || ' ';
  const cacheKey = hashKey(t);
  if (cache.has(cacheKey)) {
    const hit = cache.get(cacheKey);
    if (Array.isArray(hit)) {
      return { vector: hit, provider: sessionProvider || 'cached', fallbackUsed: sessionProvider !== 'openai' };
    }
    if (hit?.vector) {
      return { vector: hit.vector, provider: hit.provider, fallbackUsed: Boolean(hit.fallbackUsed) };
    }
  }
  const forceProvider = normalizeForceProvider(sessionProvider);
  const result = await getEmbeddingWithFallback(t, clients, logLabel, forceProvider ? { forceProvider } : {});
  cache.set(cacheKey, result);
  return result;
}

function scoreFromSectionSims(sectionScores) {
  const sim1 = sectionScores.responsibilities ?? 0;
  const sim2 = sectionScores.requirements ?? 0;
  const sim3 = sectionScores.aboutUs ?? 0;
  const weightedAvg = sim1 * 0.5 + sim2 * 0.35 + sim3 * 0.15;
  const score = Math.round(Math.min(100, Math.max(0, weightedAvg * 100)));
  return { score, weightedAvg, sectionScores: { responsibilities: sim1, requirements: sim2, aboutUs: sim3 } };
}

/**
 * Embed job sections once per pipeline run (avoids 32× duplicate job API calls under concurrency).
 */
async function precomputeJobEmbeddingContext(jobSections, jobText, openaiClient, mistralClient) {
  const cache = getSharedEmbeddingCache();
  const clients = {
    openaiClient: openaiClient || null,
    mistralClient: mistralClient || null,
  };
  if (!clients.openaiClient && !clients.mistralClient) {
    Object.assign(clients, createClients());
  }

  const { jobParts } = buildSectionTexts(jobSections, jobText, {}, '');
  let sessionProvider = null;
  const jobVectors = {};

  for (const [key, label] of [
    ['r1', 'responsibilities'],
    ['r2', 'requirements'],
    ['r3', 'aboutUs'],
  ]) {
    const emb = await embedCached(jobParts[key], clients, cache, `pass3-job-pre-${label}`, sessionProvider);
    if (!sessionProvider) sessionProvider = emb.provider;
    jobVectors[key] = emb.vector;
  }

  return {
    clients,
    cache,
    jobParts,
    jobVectors,
    sessionProvider,
    engine: sessionProvider || 'openai',
    combinedJobText: [jobParts.r1, jobParts.r2, jobParts.r3].filter(Boolean).join('\n') || jobText,
  };
}

async function scoreCandidateWithJobVectors(jobCtx, candParts, candidateText, jobText) {
  const { clients, cache, jobVectors, sessionProvider, engine, combinedJobText } = jobCtx;
  let fallbackUsed = false;

  const sectionScores = {};
  for (const [candKey, jobKey, label] of [
    ['r1', 'r1', 'responsibilities'],
    ['r2', 'r2', 'requirements'],
    ['r3', 'r3', 'aboutUs'],
  ]) {
    const candEmb = await embedCached(
      candParts[candKey],
      clients,
      cache,
      `pass3-cand-${label}`,
      sessionProvider
    );
    if (candEmb.fallbackUsed) fallbackUsed = true;
    sectionScores[label] = cosineSimilarity(jobVectors[jobKey], candEmb.vector);
  }

  const { score, weightedAvg, sectionScores: rounded } = scoreFromSectionSims(sectionScores);
  return {
    score,
    engine,
    fallbackUsed,
    sectionScores: {
      responsibilities: Math.round((rounded.responsibilities || 0) * 1000) / 1000,
      requirements: Math.round((rounded.requirements || 0) * 1000) / 1000,
      aboutUs: Math.round((rounded.aboutUs || 0) * 1000) / 1000,
    },
    weightedAvg: Math.round(weightedAvg * 1000) / 1000,
  };
}

async function embedTriple(jobParts, candParts, clients, cache) {
  let fallbackUsed = false;
  let engine = 'openai';
  let sessionProvider = null;

  const embedPair = async (jobText, candText, sectionLabel) => {
    if (!sessionProvider) {
      const probe = await embedCached(jobText, clients, cache, `pass3-probe-${sectionLabel}`, null);
      sessionProvider = probe.provider;
      engine = probe.provider;
      fallbackUsed = probe.fallbackUsed;
    }
    const jobEmb = await embedCached(jobText, clients, cache, `pass3-job-${sectionLabel}`, sessionProvider);
    const candEmb = await embedCached(candText, clients, cache, `pass3-cand-${sectionLabel}`, sessionProvider);
    if (jobEmb.fallbackUsed || candEmb.fallbackUsed) fallbackUsed = true;
    return cosineSimilarity(jobEmb.vector, candEmb.vector);
  };

  const sim1 = await embedPair(jobParts.r1, candParts.r1, 'responsibilities');
  const sim2 = await embedPair(jobParts.r2, candParts.r2, 'requirements');
  const sim3 = await embedPair(jobParts.r3, candParts.r3, 'aboutUs');

  const { score, weightedAvg, sectionScores } = scoreFromSectionSims({
    responsibilities: sim1,
    requirements: sim2,
    aboutUs: sim3,
  });

  return {
    score,
    engine,
    fallbackUsed,
    sectionScores,
    weightedAvg,
  };
}

function lexicalPass3Result(jobText, candidateText, reason) {
  const score = lexicalSemanticScore(jobText, candidateText);
  fallbackLog('pass3', `${reason || 'embeddings failed'} — using lexical overlap score ${score}`);
  return {
    score,
    engine: 'lexical-fallback',
    fallbackUsed: true,
    sectionScores: { responsibilities: 0, requirements: 0, aboutUs: 0 },
    weightedAvg: score / 100,
  };
}

async function computePass3(
  jobSections,
  candidateSections,
  jobText,
  candidateText,
  openaiClient,
  mistralClient,
  jobEmbedCtx = null
) {
  const { jobParts, candParts } = buildSectionTexts(jobSections, jobText, candidateSections, candidateText);
  const combinedJobText = jobEmbedCtx?.combinedJobText || [jobParts.r1, jobParts.r2, jobParts.r3].join('\n') || jobText;
  const combinedCandText = [candParts.r1, candParts.r2, candParts.r3].join('\n') || candidateText;

  try {
    if (jobEmbedCtx?.jobVectors) {
      const out = await scoreCandidateWithJobVectors(jobEmbedCtx, candParts, candidateText, jobText);
      return out;
    }

    const cache = getSharedEmbeddingCache();
    const clients = {
      openaiClient: openaiClient || null,
      mistralClient: mistralClient || null,
    };
    if (!clients.openaiClient && !clients.mistralClient) {
      Object.assign(clients, createClients());
    }

    const out = await embedTriple(jobParts, candParts, clients, cache);
    return {
      score: out.score,
      engine: out.engine,
      fallbackUsed: out.fallbackUsed,
      sectionScores: {
        responsibilities: Math.round((out.sectionScores?.responsibilities || 0) * 1000) / 1000,
        requirements: Math.round((out.sectionScores?.requirements || 0) * 1000) / 1000,
        aboutUs: Math.round((out.sectionScores?.aboutUs || 0) * 1000) / 1000,
      },
      weightedAvg: Math.round((out.weightedAvg || 0) * 1000) / 1000,
    };
  } catch (e) {
    return lexicalPass3Result(combinedJobText, combinedCandText, `OpenAI + Mistral embeddings failed: ${e?.message || e}`);
  }
}

module.exports = {
  computePass3,
  precomputeJobEmbeddingContext,
  cosineSimilarity,
  lexicalSemanticScore,
};
