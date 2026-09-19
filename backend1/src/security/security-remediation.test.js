const test = require('node:test');
const assert = require('node:assert/strict');

test('OTP util hashes and matches without exposing plaintext equality path for hashes', () => {
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-for-unit-tests-only';
  process.env.OTP_PEPPER = 'test-pepper';
  const { generateOTP, hashOtp, otpMatches, normalizeOtpInput } = require('../utils/otp.util');

  const otp = generateOTP();
  assert.equal(otp.length, 6);
  assert.match(otp, /^\d{6}$/);

  const hashed = hashOtp(otp);
  assert.equal(hashed.length, 64);
  assert.ok(otpMatches(hashed, otp));
  assert.equal(otpMatches(hashed, '000000'), false);

  // Legacy plaintext still matches during migration
  assert.ok(otpMatches(normalizeOtpInput(otp), otp));
});

test('SSRF util blocks localhost and private ranges', () => {
  const { assertSafeOutboundUrl, isBlockedHostname } = require('../utils/ssrf.util');
  assert.equal(isBlockedHostname('127.0.0.1'), true);
  assert.equal(isBlockedHostname('169.254.169.254'), true);
  assert.equal(isBlockedHostname('10.0.0.5'), true);
  assert.equal(isBlockedHostname('192.168.1.1'), true);
  assert.equal(isBlockedHostname('res.cloudinary.com'), false);
  assert.throws(() => assertSafeOutboundUrl('http://127.0.0.1/secret'));
  assert.throws(() => assertSafeOutboundUrl('https://169.254.169.254/latest/meta-data/'));
  assert.doesNotThrow(() => assertSafeOutboundUrl('https://res.cloudinary.com/demo/raw/upload/v1/x.pdf'));
});

test('requireJwtSecret fails closed without env', () => {
  const prev = process.env.JWT_SECRET;
  delete process.env.JWT_SECRET;
  const { requireJwtSecret } = require('../config/secrets');
  assert.throws(() => requireJwtSecret());
  process.env.JWT_SECRET = prev || 'test-jwt-secret-for-unit-tests-only';
  assert.ok(requireJwtSecret());
});
