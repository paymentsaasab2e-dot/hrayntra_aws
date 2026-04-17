const { Router } = require('express');
const { sendOTP, verifyOTP, resendOTP } = require('../controllers/auth.controller');

const router = Router();

router.post('/send-otp', sendOTP);
router.post('/verify-otp', verifyOTP);
router.post('/resend-otp', resendOTP);

module.exports = router;
