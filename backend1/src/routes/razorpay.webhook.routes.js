const { Router } = require('express');
const express = require('express');
const {
  verifyRazorpayWebhookSignature,
} = require('../services/razorpay.service');

const router = Router();

/**
 * Phase 1 Razorpay webhooks.
 * Register in Razorpay Dashboard (one per env):
 *   Local:      http://localhost:5000/api/payments/razorpay/webhook  (use ngrok HTTPS)
 *   Test:       https://test-api1.hryantra.com/api/payments/razorpay/webhook
 *   Production: https://api1.hryantra.com/api/payments/razorpay/webhook
 */
router.post(
  '/webhook',
  express.raw({ type: 'application/json', limit: '2mb' }),
  async (req, res) => {
    try {
      const rawBody = Buffer.isBuffer(req.body)
        ? req.body.toString('utf8')
        : typeof req.body === 'string'
          ? req.body
          : JSON.stringify(req.body || {});
      verifyRazorpayWebhookSignature(rawBody, req.headers['x-razorpay-signature']);
      const event = JSON.parse(rawBody || '{}');
      console.log(
        `[razorpay-webhook:phase1] event=${event?.event || 'n/a'} payment=${event?.payload?.payment?.entity?.id || 'n/a'}`,
      );
      res.status(200).json({ received: true, event: event?.event || null });
    } catch (error) {
      console.warn('[razorpay-webhook:phase1] rejected:', error?.message || error);
      res.status(400).json({ received: false, error: error?.message || 'Webhook rejected' });
    }
  },
);

module.exports = router;
