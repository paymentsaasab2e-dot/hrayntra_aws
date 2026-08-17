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
} = require('../controllers/auth.controller');
const { protect } = require('../middleware/auth.middleware');

const router = Router();

router.post('/send-otp', sendOTP);
router.post('/verify-otp', verifyOTP);
router.post('/resend-otp', resendOTP);
router.post('/login', loginWithPassword);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.post('/check-credential', checkCredential);
router.post('/set-password', protect, setPassword);
router.get('/sessions', protect, listSessions);
router.post('/logout', protect, logout);

module.exports = router;
