/**
 * OpenAI-first chat completions with Mistral (OpenAI-compatible API) as fallback.
 *
 * Used across backendphase2 wherever `openai.chat.completions.create` was called:
 * when OpenAI errors (quota, auth, rate limit, outage) or when OPENAI_API_KEY is
 * unset, the same request is retried against Mistral with the configured model.
 *
 * Mistral does not accept OpenAI `json_schema` response_format; those requests
 * are downgraded to `json_object` on the Mistral path (prompts already ask for JSON).
 */

import OpenAI from 'openai';
import { env } from '../config/env.js';

const openaiClient = env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: env.OPENAI_API_KEY })
  : null;

const mistralClient = env.MISTRAL_API_KEY
  ? new OpenAI({
      apiKey: env.MISTRAL_API_KEY,
      baseURL: env.MISTRAL_API_BASE_URL || 'https://api.mistral.ai/v1',
    })
  : null;

// ── TOP OF FILE — module scope (persists between HTTP requests) ─────────────
let _openAiFailedAt = null;
const OPENAI_COOLDOWN_MS = 10 * 60 * 1000; // 10 minutes after quota / 429
// ─────────────────────────────────────────────────────────────────────────────

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
 * @returns {{ circuitOpen: boolean, lastFailureAt: number | null, agoSec: number | null, lastFailureIso: string | null, cooldownMs: number }}
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

/** True if at least one of OpenAI or Mistral is configured. */
export function hasLlmProvider() {
  return Boolean(openaiClient || mistralClient);
}

function adaptRequestForMistral(body, mistralModel) {
  const next = { ...body, model: mistralModel };
  if (body.response_format?.type === 'json_schema') {
    next.response_format = { type: 'json_object' };
  }
  return next;
}

/**
 * @param {Record<string, unknown>} body
 * @param {string} [logLabel]
 * @param {{ quiet?: boolean }} [options] When `quiet: true`, suppress provider/circuit console noise (caller logs narratively).
 * @returns {Promise<unknown>}
 */
export async function chatCompletionWithFallback(body, logLabel = 'llm', options = {}) {
  const quiet = Boolean(options?.quiet);
  const mistralModel = env.MISTRAL_CHAT_MODEL || 'mistral-small-latest';

  if (!openaiClient && !mistralClient) {
    throw new Error('No LLM configured: set OPENAI_API_KEY and/or MISTRAL_API_KEY');
  }

  const runMistral = async (primaryErr, reasonLabel) => {
    if (!mistralClient) {
      if (primaryErr) throw primaryErr;
      throw new Error('MISTRAL_API_KEY is not configured');
    }
    if (!quiet) {
      if (primaryErr) {
        console.warn(
          `[${logLabel}] OpenAI failed (${primaryErr?.message || primaryErr}). Falling back to Mistral (${mistralModel}).`
        );
      } else {
        console.log(
          `[${logLabel}] Using Mistral (${mistralModel})${reasonLabel ? ` — ${reasonLabel}` : ''}.`
        );
      }
    }
    const mBody = adaptRequestForMistral(body, mistralModel);
    return mistralClient.chat.completions.create(mBody);
  };

  if (!openaiClient) {
    return runMistral(null, 'OpenAI not configured');
  }

  if (mistralClient && shouldSkipOpenAiForQuotaCooldown()) {
    if (logLabel === 'cv-parse') {
      console.log('[cv-parse] Circuit OPEN — skipping OpenAI, going directly to Mistral');
    } else if (!quiet) {
      console.log(`[${logLabel}] Circuit OPEN — skipping OpenAI, going directly to Mistral`);
    }
    return runMistral(null, 'circuit-open');
  }

  try {
    const result = await openaiClient.chat.completions.create(body);
    _openAiFailedAt = null;
    return result;
  } catch (primaryErr) {
    const st = httpStatus(primaryErr);
    const msg = primaryErr?.message ?? String(primaryErr);
    if (logLabel === 'cv-parse' || !quiet) {
      console.log(`[${logLabel}] OpenAI error: status=${st ?? 'n/a'} message=${msg}`);
    }
    if (isQuotaOr429Error(primaryErr)) {
      _openAiFailedAt = Date.now();
      if (logLabel === 'cv-parse') {
        console.warn(`[${logLabel}] OpenAI 429 — circuit OPEN for 10 min, switching to Mistral`);
      } else if (!quiet) {
        console.warn(`[${logLabel}] OpenAI 429 — circuit OPEN for 10 min, switching to Mistral`);
      }
    } else if (logLabel === 'cv-parse' || !quiet) {
      console.log(`[${logLabel}] OpenAI failed (${msg}). Falling back to Mistral.`);
    }
    return runMistral(primaryErr, null);
  }
}
