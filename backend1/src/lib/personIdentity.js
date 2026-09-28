const crypto = require('crypto');

function newPersonId() {
  return crypto.randomUUID();
}

function normalizeEmail(value) {
  if (value == null) return '';
  return String(value).toLowerCase().trim().replace(/\s+/g, '');
}

function normalizePhoneE164(value) {
  if (value == null) return '';
  const raw = String(value).trim();
  const hasPlus = raw.startsWith('+');
  const digits = raw.replace(/\D/g, '');
  return (hasPlus ? '+' : '') + digits;
}

function resumeSha256FromBuffer(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

function fingerprintKeys({ emailNormalized, phoneE164, resumeSha256 }) {
  const keys = [];
  if (emailNormalized) keys.push(`email|${emailNormalized}`);
  if (phoneE164) keys.push(`phone|${phoneE164}`);
  if (resumeSha256) keys.push(`resume|${resumeSha256}`);
  return keys;
}

function buildIdentityFields({ email, phone, existingPersonId, resumeSha256 }) {
  const emailNormalized = normalizeEmail(email);
  const phoneE164 = normalizePhoneE164(phone);
  const personId = existingPersonId || newPersonId();
  const keys = fingerprintKeys({
    emailNormalized,
    phoneE164,
    resumeSha256,
  });
  return {
    personId,
    emailNormalized,
    phoneE164,
    fingerprintKeys: keys,
  };
}

module.exports = {
  newPersonId,
  normalizeEmail,
  normalizePhoneE164,
  resumeSha256FromBuffer,
  fingerprintKeys,
  buildIdentityFields,
};
