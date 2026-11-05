import express from 'express';
import {
  verifyRazorpayWebhookSignature,
  parseRazorpayWebhookPayload,
  handleRazorpayWebhookEvent,
} from './razorpay.webhook.js';

const router = express.Router();

/**
 * Razorpay Dashboard → Settings → Webhooks
 * Active URL (pick one per environment):
 *   Local:      RAZORPAY_WEBHOOK_URL_LOCAL (use ngrok HTTPS tunnel to :5001)
 *   Test:       RAZORPAY_WEBHOOK_URL_TEST
 *   Production: RAZORPAY_WEBHOOK_URL_PRODUCTION
 *
 * Events to enable: payment.captured, payment.failed, payment_link.paid,
 * order.paid, refund.created
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
      const event = parseRazorpayWebhookPayload(rawBody);
      const result = await handleRazorpayWebhookEvent(event);
      res.status(200).json({ received: true, ...result });
    } catch (error) {
      console.warn('[razorpay-webhook] rejected:', error?.message || error);
      res.status(400).json({ received: false, error: error?.message || 'Webhook rejected' });
    }
  },
);

export default router;
