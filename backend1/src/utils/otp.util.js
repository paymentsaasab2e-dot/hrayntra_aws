const crypto = require('crypto');

const MAX_VERIFY_ATTEMPTS = 5;
const RESEND_COOLDOWN_MS = 60 * 1000;

/**
 * Generate a 6-digit OTP using cryptographically strong randomness.
 */
function generateOTP() {
  return String(crypto.randomInt(100000, 1000000));
}

/**
 * Normalize user/API OTP input to a 6-digit string.
 */
function normalizeOtpInput(value) {
  const digits = String(value ?? '').replace(/\D/g, '');
  if (!digits) return '';
  return digits.length >= 6 ? digits.slice(-6) : digits.padStart(6, '0');
}

function otpPepper() {
  return String(process.env.OTP_PEPPER || process.env.JWT_SECRET || '').trim();
}

/**
 * Hash OTP at rest (sha256 + pepper). Never log the plaintext OTP.
 */
function hashOtp(otp) {
  const normalized = normalizeOtpInput(otp);
  const pepper = otpPepper();
  return crypto.createHash('sha256').update(`${pepper}:${normalized}`).digest('hex');
}

function looksLikeHash(stored) {
  return /^[a-f0-9]{64}$/i.test(String(stored || ''));
}

/**
 * Compare stored vs submitted OTP.
 * Supports hashed (preferred) and legacy plaintext rows during migration.
 */
function otpMatches(storedOtp, submittedOtp) {
  const received = normalizeOtpInput(submittedOtp);
  if (!received) return false;
  const stored = String(storedOtp ?? '');
  if (!stored) return false;

  if (looksLikeHash(stored)) {
    const expected = hashOtp(received);
    try {
      return crypto.timingSafeEqual(Buffer.from(stored, 'utf8'), Buffer.from(expected, 'utf8'));
    } catch {
      return stored === expected;
    }
  }

  // Legacy plaintext — constant-time-ish compare on normalized forms
  const expected = normalizeOtpInput(stored);
  if (expected.length !== received.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(expected, 'utf8'), Buffer.from(received, 'utf8'));
  } catch {
    return expected === received;
  }
}

/**
 * Calculate OTP expiration time (5 minutes from now)
 */
function getOTPExpiration() {
  const expiration = new Date();
  expiration.setMinutes(expiration.getMinutes() + 5);
  return expiration;
}

/**
 * Check if OTP is expired
 */
function isOTPExpired(expiresAt) {
  return new Date() > new Date(expiresAt);
}

module.exports = {
  generateOTP,
  normalizeOtpInput,
  otpMatches,
  hashOtp,
  getOTPExpiration,
  isOTPExpired,
  MAX_VERIFY_ATTEMPTS,
  RESEND_COOLDOWN_MS,
};
