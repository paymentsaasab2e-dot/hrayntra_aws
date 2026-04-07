/**
 * Generate a 6-digit OTP
 */
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
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
  return new Date() > expiresAt;
}

module.exports = {
  generateOTP,
  getOTPExpiration,
  isOTPExpired,
};
