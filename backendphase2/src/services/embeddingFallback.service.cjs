// File   : embeddingFallback.service.cjs
// Purpose: OpenAI embeddings first, Mistral API fallback (native + SDK) for match pipeline.
// Part of: HRJob+Candidate Matching Pipeline v1.0

const OpenAI = require('openai');

let openAiFailedAt = null;
let embedActive = 0;
const embedWaiters = [];
const OPENAI_COOLDOWN_MS = 10 * 60 * 1000;
const EMBED_TIMEOUT_MS = Number(process.env.MATCH_EMBED_TIMEOUT_MS || 8000) || 8000;
/** Max in-flight embedding HTTP calls (pool), not per-candidate sequential delay. */
const EMBED_MAX_CONCURRENT = Math.min(
  6,
  Math.max(1, Number(process.env.MATCH_EMBED_CONCURRENCY || 4) || 4)
);
const EMBED_RETRY_MAX = Math.min(5, Math.max(0, Number(process.env.MATCH_EMBED_RETRY_MAX || 3) || 3));
const EMBED_RETRY_BASE_MS = Number(process.env.MATCH_EMBED_RETRY_BASE_MS || 1200) || 1200;

async function acquireEmbedSlot() {
  if (embedActive < EMBED_MAX_CONCURRENT) {
    embedActive += 1;
    return;
  }
  await new Promise((resolve) => {
    embedWaiters.push(resolve);
  });
  embedActive += 1;
}

function releaseEmbedSlot() {
  embedActive = Math.max(0, embedActive - 1);
  const next = embedWaiters.shift();
  if (next) next();
}

async function withEmbedRetry(fn, logLabel) {
  await acquireEmbedSlot();
  try {
    let lastErr;
    for (let attempt = 0; attempt <= EMBED_RETRY_MAX; attempt += 1) {
      try {
        return await fn();
      } catch (err) {
        lastErr = err;
        if (!isQuotaOr429Error(err) || attempt >= EMBED_RETRY_MAX) throw err;
        const wait = EMBED_RETRY_BASE_MS * 2 ** attempt;
        console.warn(
          `[${logLabel}] Embedding rate limited — retry ${attempt + 1}/${EMBED_RETRY_MAX} in ${wait}ms`
        );
        await new Promise((resolve) => setTimeout(resolve, wait));
      }
    }
    throw lastErr;
  } finally {
    releaseEmbedSlot();
  }
}

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(`embedding-timeout-${ms}ms`)), ms)),
  ]);
}

function httpStatus(err) {
  const s = err?.status ?? err?.response?.status ?? err?.statusCode;
  return typeof s === 'number' && Number.isFinite(s) ? s : undefined;
}

function isQuotaOr429Error(err) {
  const status = httpStatus(err);
  if (status === 429) return true;
  const msg = String(err?.message || err?.error?.message || err || '').toLowerCase();
  return (
    msg.includes('429') ||
    msg.includes('quota') ||
    msg.includes('rate limit') ||
    msg.includes('insufficient_quota') ||
    msg.includes('billing') ||
    msg.includes('exceeded your current quota')
  );
}

function shouldSkipOpenAi() {
  return openAiFailedAt != null && Date.now() - openAiFailedAt < OPENAI_COOLDOWN_MS;
}

function vectorNorm(vec) {
  if (!Array.isArray(vec) || !vec.length) return 0;
  let sum = 0;
  for (let i = 0; i < vec.length; i += 1) sum += vec[i] * vec[i];
  return Math.sqrt(sum);
}

function isValidEmbedding(vec) {
  return Array.isArray(vec) && vec.length >= 8 && vectorNorm(vec) > 1e-6;
}

function createClients() {
  const openaiClient = process.env.OPENAI_API_KEY
    ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    : null;
  return { openaiClient, mistralClient: null };
}

async function embedOpenAI(text, openaiClient, logLabel = 'embed-openai') {
  const res = await withEmbedRetry(
    () =>
      withTimeout(
        openaiClient.embeddings.create({
          model: process.env.OPENAI_EMBED_MODEL || 'text-embedding-3-small',
          input: text,
        }),
        EMBED_TIMEOUT_MS
      ),
    logLabel
  );
  const vec = res?.data?.[0]?.embedding;
  if (!isValidEmbedding(vec)) throw new Error('openai-invalid-embedding');
  return vec;
}

/** Native Mistral embeddings HTTP (most reliable fallback). */
async function embedMistralNative(text, logLabel = 'embed-mistral-native') {
  const apiKey = process.env.MISTRAL_API_KEY;
  if (!apiKey) throw new Error('MISTRAL_API_KEY not set');
  const base = (process.env.MISTRAL_API_BASE_URL || 'https://api.mistral.ai/v1').replace(/\/$/, '');
  const model = process.env.MISTRAL_EMBED_MODEL || 'mistral-embed';

  const res = await withEmbedRetry(
    () =>
      withTimeout(
        fetch(`${base}/embeddings`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({ model, input: text }),
        }),
        EMBED_TIMEOUT_MS
      ),
    logLabel
  );

  const bodyText = await res.text();
  if (!res.ok) {
    throw new Error(`mistral-embed-http-${res.status}: ${bodyText.slice(0, 200)}`);
  }
  let json;
  try {
    json = JSON.parse(bodyText);
  } catch {
    throw new Error('mistral-embed-invalid-json');
  }
  const vec = json?.data?.[0]?.embedding;
  if (!isValidEmbedding(vec)) throw new Error('mistral-native-invalid-embedding');
  return vec;
}

async function embedMistralSdk(text, mistralClient, logLabel = 'embed-mistral-sdk') {
  const model = process.env.MISTRAL_EMBED_MODEL || 'mistral-embed';
  const res = await withEmbedRetry(
    () =>
      withTimeout(
        mistralClient.embeddings.create({
          model,
          input: text,
        }),
        EMBED_TIMEOUT_MS
      ),
    logLabel
  );
  const vec = res?.data?.[0]?.embedding;
  if (!isValidEmbedding(vec)) throw new Error('mistral-sdk-invalid-embedding');
  return vec;
}

/**
 * @param {{ forceProvider?: 'openai' | 'mistral-native' | 'mistral-sdk' }} [options]
 *   Lock provider for a Pass 3 pair so job/candidate vectors share dimensions.
 */
async function getEmbeddingWithFallback(text, clients = null, logLabel = 'embed', options = {}) {
  const { openaiClient } = clients || createClients();
  const input = String(text || '').trim() || ' ';

  if (!openaiClient) {
    throw new Error('OPENAI_API_KEY is required for embeddings.');
  }

  if (shouldSkipOpenAi()) {
    throw new Error(
      `OpenAI embedding quota cooldown active — retry after ${Math.round(OPENAI_COOLDOWN_MS / 60000)} minutes.`
    );
  }

  try {
    const vector = await embedOpenAI(input.slice(0, 8000), openaiClient, logLabel);
    openAiFailedAt = null;
    return { vector, provider: 'openai', fallbackUsed: false };
  } catch (err) {
    if (isQuotaOr429Error(err)) {
      openAiFailedAt = Date.now();
    }
    throw err;
  }
}

module.exports = {
  createClients,
  getEmbeddingWithFallback,
  isValidEmbedding,
  shouldSkipOpenAi,
  OPENAI_COOLDOWN_MS,
};
