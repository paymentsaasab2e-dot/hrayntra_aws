/**
 * OpenAI-first chat completions with Mistral (OpenAI-compatible API) as fallback.
 *
 * Primary: OpenAI gpt-4.1 (OPENAI_CHAT_MODEL).
 * Fallback: Mistral when OpenAI fails, is unset, or quota cooldown is active.
 *
 * Mistral does not accept OpenAI `json_schema` response_format; those requests
 * are downgraded to `json_object` on the Mistral path.
 */

import OpenAI from 'openai';
import { env } from '../config/env.js';
import { ALLOWED_OPENAI_CHAT_MODEL } from '../config/openaiModel.js';

const OPENAI_CHAT_MODEL = env.OPENAI_CHAT_MODEL;
const MISTRAL_CHAT_MODEL =
  String(env.MISTRAL_CHAT_MODEL || '').trim() || 'mistral-small-latest';

const openaiClient = env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: env.OPENAI_API_KEY })
  : null;

const mistralClient = env.MISTRAL_API_KEY
  ? new OpenAI({
      apiKey: env.MISTRAL_API_KEY,
      baseURL: env.MISTRAL_API_BASE_URL || 'https://api.mistral.ai/v1',
    })
  : null;

let _openAiFailedAt = null;
const OPENAI_COOLDOWN_MS = 10 * 60 * 1000;

function httpStatus(err) {
  const s = err?.status ?? err?.response?.status ?? err?.statusCode;
  if (typeof s === 'number' && Number.isFinite(s)) return s;
  return undefined;
}

function isQuotaOr429Error(err) {
  const status = httpStatus(err);
  if (status === 429 || Number(status) === 429) return true;
  const msg = String(err?.message || err?.error?.message || err || '').toLowerCase();
  if (msg.includes('429')) return true;
  if (
    msg.includes('quota') ||
    msg.includes('rate limit') ||
    msg.includes('insufficient_quota') ||
    msg.includes('billing_hard_limit') ||
    msg.includes('exceeded your current quota')
  ) {
    return true;
  }
  return false;
}

function shouldSkipOpenAiForQuotaCooldown() {
  return _openAiFailedAt != null && Date.now() - _openAiFailedAt < OPENAI_COOLDOWN_MS;
}

/**
 * Snapshot for CV pipeline logs (Stage 5 — circuit breaker narrative).
 */
export function getCvLlmCircuitSnapshot() {
  const last = _openAiFailedAt;
  if (last == null) {
    return {
      circuitOpen: false,
      lastFailureAt: null,
      agoSec: null,
      lastFailureIso: null,
      cooldownMs: OPENAI_COOLDOWN_MS,
    };
  }
  const agoMs = Date.now() - last;
  const circuitOpen = agoMs < OPENAI_COOLDOWN_MS;
  return {
    circuitOpen,
    lastFailureAt: last,
    agoSec: circuitOpen ? Math.round(agoMs / 1000) : null,
    lastFailureIso: new Date(last).toISOString(),
    cooldownMs: OPENAI_COOLDOWN_MS,
  };
}

/** True if OpenAI and/or Mistral API key is configured. */
export function hasLlmProvider() {
  return Boolean(openaiClient || mistralClient);
}

/** Best-effort token counts from an OpenAI SDK error (often empty on 429). */
export function extractUsageFromLlmError(err) {
  const sources = [err?.error?.usage, err?.response?.data?.usage, err?.openAiError?.error?.usage];
  for (const usage of sources) {
    if (!usage || typeof usage !== 'object') continue;
    const inputTokens = Number(usage.prompt_tokens ?? usage.input_tokens ?? 0) || 0;
    const outputTokens = Number(usage.completion_tokens ?? usage.output_tokens ?? 0) || 0;
    const totalTokens = Number(usage.total_tokens ?? 0) || inputTokens + outputTokens;
    if (inputTokens || outputTokens || totalTokens) {
      return { inputTokens, outputTokens, totalTokens };
    }
  }
  return { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
}

function normalizeOpenAiRequestBody(body) {
  return {
    ...body,
    model: OPENAI_CHAT_MODEL,
  };
}

/** Adapt request for Mistral chat API (OpenAI-compatible). */
function normalizeMistralRequestBody(body) {
  const out = { ...body, model: MISTRAL_CHAT_MODEL };
  const rf = out.response_format;
  if (rf && typeof rf === 'object' && rf.type === 'json_schema') {
    out.response_format = { type: 'json_object' };
  }
  return out;
}

function wrapProviderError(err, { openAiError = null, mistralError = null } = {}) {
  const wrapped = err instanceof Error ? err : new Error(String(err));
  if (openAiError) wrapped.openAiError = openAiError;
  if (mistralError) wrapped.mistralError = mistralError;
  return wrapped;
}

async function runMistralChat(requestBody, logLabel, quiet) {
  if (!mistralClient) {
    throw new Error('MISTRAL_API_KEY is not configured');
  }
  const mistralBody = normalizeMistralRequestBody(requestBody);
  if (logLabel === 'cv-parse' || !quiet) {
    console.warn(`[${logLabel}] Falling back to Mistral (${MISTRAL_CHAT_MODEL})`);
  }
  return mistralClient.chat.completions.create(mistralBody);
}

/**
 * @param {Record<string, unknown>} body
 * @param {string} [logLabel]
 * @param {{ quiet?: boolean }} [options]
 * @returns {Promise<unknown>}
 */
export async function chatCompletionWithFallback(body, logLabel = 'llm', options = {}) {
  const quiet = Boolean(options?.quiet);

  if (!openaiClient && !mistralClient) {
    throw new Error(
      'At least one of OPENAI_API_KEY or MISTRAL_API_KEY is required for LLM chat.'
    );
  }

  const requestBody = { ...body };
  let openAiErr = null;

  const tryOpenAi =
    openaiClient && !shouldSkipOpenAiForQuotaCooldown();

  if (shouldSkipOpenAiForQuotaCooldown() && mistralClient) {
    if (logLabel === 'cv-parse' || !quiet) {
      console.warn(
        `[${logLabel}] OpenAI quota cooldown — using Mistral (${MISTRAL_CHAT_MODEL})`
      );
    }
    try {
      return await runMistralChat(requestBody, logLabel, quiet);
    } catch (mistralErr) {
      throw wrapProviderError(mistralErr, { mistralError: mistralErr });
    }
  }

  if (shouldSkipOpenAiForQuotaCooldown() && !mistralClient) {
    const err = new Error(
      `OpenAI quota cooldown active — set MISTRAL_API_KEY for fallback or retry after ${Math.round(OPENAI_COOLDOWN_MS / 60000)} minutes.`
    );
    if (logLabel === 'cv-parse' || !quiet) {
      console.warn(`[${logLabel}] ${err.message}`);
    }
    throw err;
  }

  if (tryOpenAi) {
    const openAiBody = normalizeOpenAiRequestBody(requestBody);
    try {
      const result = await openaiClient.chat.completions.create(openAiBody);
      _openAiFailedAt = null;
      return result;
    } catch (primaryErr) {
      openAiErr = primaryErr;
      const st = httpStatus(primaryErr);
      const msg = primaryErr?.message ?? String(primaryErr);
      if (logLabel === 'cv-parse' || !quiet) {
        console.error(
          `[${logLabel}] OpenAI error (${OPENAI_CHAT_MODEL}): status=${st ?? 'n/a'} message=${msg}`
        );
      }
      if (isQuotaOr429Error(primaryErr)) {
        _openAiFailedAt = Date.now();
        if (logLabel === 'cv-parse' || !quiet) {
          console.warn(
            `[${logLabel}] OpenAI 429 — circuit OPEN for 10 min; will use Mistral when configured`
          );
        }
      }
    }
  }

  if (mistralClient) {
    try {
      return await runMistralChat(requestBody, logLabel, quiet);
    } catch (mistralErr) {
      const st = httpStatus(mistralErr);
      const msg = mistralErr?.message ?? String(mistralErr);
      if (logLabel === 'cv-parse' || !quiet) {
        console.error(
          `[${logLabel}] Mistral error (${MISTRAL_CHAT_MODEL}): status=${st ?? 'n/a'} message=${msg}`
        );
      }
      throw wrapProviderError(mistralErr, {
        openAiError: openAiErr,
        mistralError: mistralErr,
      });
    }
  }

  if (openAiErr) {
    throw wrapProviderError(openAiErr, { openAiError: openAiErr });
  }

  throw new Error('No LLM provider available for chat completion.');
}

export {
  ALLOWED_OPENAI_CHAT_MODEL,
  OPENAI_CHAT_MODEL,
  MISTRAL_CHAT_MODEL,
};
