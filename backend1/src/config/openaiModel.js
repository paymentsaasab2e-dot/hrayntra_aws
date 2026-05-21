/**
 * Single allowed OpenAI chat model for Phase 1.
 * Set OPENAI_CHAT_MODEL=gpt-4.1 in .env (OPENAI_ASSISTANT_MODEL is accepted as an alias).
 */

require('dotenv').config();

const ALLOWED_OPENAI_CHAT_MODEL = 'gpt-4.1';

const DEPRECATED_MODEL_ENV_KEYS = ['OPENAI_JOB_MATCH_MODEL', 'MISTRAL_CHAT_MODEL'];

function resolveOpenAiChatModel() {
  const raw = String(
    process.env.OPENAI_CHAT_MODEL ||
      process.env.OPENAI_ASSISTANT_MODEL ||
      ALLOWED_OPENAI_CHAT_MODEL
  ).trim();

  if (raw && raw !== ALLOWED_OPENAI_CHAT_MODEL) {
    console.warn(
      `[openai-model] OPENAI_CHAT_MODEL="${raw}" is not allowed — using ${ALLOWED_OPENAI_CHAT_MODEL} only.`
    );
  }

  for (const key of DEPRECATED_MODEL_ENV_KEYS) {
    const legacy = String(process.env[key] || '').trim();
    if (legacy && legacy !== ALLOWED_OPENAI_CHAT_MODEL) {
      console.warn(
        `[openai-model] ${key}="${legacy}" is ignored — chat uses ${ALLOWED_OPENAI_CHAT_MODEL} only.`
      );
    }
  }

  return ALLOWED_OPENAI_CHAT_MODEL;
}

const OPENAI_CHAT_MODEL = resolveOpenAiChatModel();

module.exports = {
  ALLOWED_OPENAI_CHAT_MODEL,
  OPENAI_CHAT_MODEL,
  resolveOpenAiChatModel,
};
