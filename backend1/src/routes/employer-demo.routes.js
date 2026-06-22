const { Router } = require('express');
const {
  sendDemoRequestOtp,
  resendDemoRequestOtp,
  verifyDemoRequestOtp,
} = require('../controllers/employer-demo.controller');

const router = Router();

router.post('/send-otp', sendDemoRequestOtp);
router.post('/resend-otp', resendDemoRequestOtp);
router.post('/verify-otp', verifyDemoRequestOtp);

module.exports = router;
