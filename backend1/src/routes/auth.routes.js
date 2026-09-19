const { Router } = require('express');
const {
  sendOTP,
  verifyOTP,
  resendOTP,
  loginWithPassword,
  setPassword,
  forgotPassword,
  resetPassword,
  logout,
  checkCredential,
  listSessions,
  getMe,
} = require('../controllers/auth.controller');
const { protect } = require('../middleware/auth.middleware');
const {
  otpSendRateLimit,
  otpVerifyRateLimit,
  authEndpointRateLimit,
} = require('../middleware/rateLimit.middleware');

const router = Router();
const authLimit = authEndpointRateLimit();

router.post('/send-otp', otpSendRateLimit(), sendOTP);
router.post('/verify-otp', otpVerifyRateLimit(), verifyOTP);
router.post('/resend-otp', otpSendRateLimit(), resendOTP);
router.post('/login', authLimit, loginWithPassword);
router.post('/forgot-password', authLimit, forgotPassword);
router.post('/reset-password', authLimit, resetPassword);
router.post('/check-credential', authLimit, checkCredential);
router.post('/set-password', protect, setPassword);
router.get('/me', protect, getMe);
router.get('/sessions', protect, listSessions);
router.post('/logout', protect, logout);

module.exports = router;
