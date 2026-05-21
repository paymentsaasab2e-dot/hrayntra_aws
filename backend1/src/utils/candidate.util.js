const crypto = require('crypto');

/**
 * Generate a unique, deterministic ID based on email (Phase 1 WhatsApp login).
 * Same email always maps to the same candidate id.
 */
function generateCandidateIdFromEmail(email) {
  const normalized = String(email || '').trim().toLowerCase();
  const hash = crypto.createHash('sha256').update(`email:${normalized}`).digest('hex');
  return hash.substring(0, 24);
}

/**
 * @deprecated Prefer generateCandidateIdFromEmail for OTP login.
 * Legacy: deterministic ID from WhatsApp number.
 */
function generateCandidateId(whatsappNumber) {
  const normalized = whatsappNumber.replace(/\s+/g, '').trim();
  const hash = crypto.createHash('sha256').update(normalized).digest('hex');
  return hash.substring(0, 24);
}

/**
 * Validate if a string is a valid MongoDB ObjectId format (24 hex characters)
 */
function isValidObjectId(id) {
  return /^[0-9a-fA-F]{24}$/.test(id);
}

module.exports = {
  generateCandidateId,
  generateCandidateIdFromEmail,
  isValidObjectId,
};
