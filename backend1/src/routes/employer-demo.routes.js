const { Router } = require('express');
const {
  sendDemoRequestOtp,
  resendDemoRequestOtp,
  verifyDemoRequestOtp,
  createEmployerPurchaseOrder,
  completeEmployerPurchase,
} = require('../controllers/employer-demo.controller');

const router = Router();

router.post('/send-otp', sendDemoRequestOtp);
router.post('/resend-otp', resendDemoRequestOtp);
router.post('/verify-otp', verifyDemoRequestOtp);
router.post('/payment-order', createEmployerPurchaseOrder);
router.post('/complete-purchase', completeEmployerPurchase);

module.exports = router;
