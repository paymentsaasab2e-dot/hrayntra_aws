/**
 * Shared OpenAI chat model for Phase 2.
 * Set OPENAI_CHAT_MODEL in .env (OPENAI_ASSISTANT_MODEL is accepted as an alias).
 * Defaults to gpt-4.1 when unset; Mistral fallback uses MISTRAL_CHAT_MODEL separately.
 */

/** Default OpenAI chat model when .env does not set one. */
export const ALLOWED_OPENAI_CHAT_MODEL = 'gpt-4.1';

const DEPRECATED_MODEL_ENV_KEYS = [
  'OPENAI_JOB_MATCH_MODEL',
  'MISTRAL_CHAT_MODEL',
];

/**
 * Call after dotenv is loaded (see config/env.js).
 * @returns {string} Resolved OpenAI chat model from env, falling back to gpt-4.1.
 */
export function resolveOpenAiChatModel() {
  const raw = String(
    process.env.OPENAI_CHAT_MODEL ||
      process.env.OPENAI_ASSISTANT_MODEL ||
      ALLOWED_OPENAI_CHAT_MODEL
  ).trim();

  for (const key of DEPRECATED_MODEL_ENV_KEYS) {
    const legacy = String(process.env[key] || '').trim();
    if (legacy) {
      console.warn(
        `[openai-model] ${key}="${legacy}" is ignored — use OPENAI_CHAT_MODEL instead.`
      );
    }
  }

  return raw || ALLOWED_OPENAI_CHAT_MODEL;
}
