/**
 * Generate a 6-digit OTP
 */
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Normalize user/API OTP input to a 6-digit string.
 */
function normalizeOtpInput(value) {
  const digits = String(value ?? '').replace(/\D/g, '');
  if (!digits) return '';
  return digits.length >= 6 ? digits.slice(-6) : digits.padStart(6, '0');
}

/**
 * Compare stored vs submitted OTP (handles legacy numeric storage in MongoDB).
 */
function otpMatches(storedOtp, submittedOtp) {
  const expected = normalizeOtpInput(storedOtp);
  const received = normalizeOtpInput(submittedOtp);
  return Boolean(expected && received && expected === received);
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
  getOTPExpiration,
  isOTPExpired,
};
