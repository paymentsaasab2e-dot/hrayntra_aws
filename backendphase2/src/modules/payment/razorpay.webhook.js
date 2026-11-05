import crypto from 'node:crypto';
import { getRazorpayConfig } from './razorpay.config.js';

/**
 * Verify Razorpay webhook signature.
 * Dashboard → Webhooks → secret must match RAZORPAY_WEBHOOK_SECRET.
 * Body must be the raw request string (not re-serialized JSON).
 */
export function verifyRazorpayWebhookSignature(rawBody, signatureHeader) {
  const secret = String(process.env.RAZORPAY_WEBHOOK_SECRET || '').trim();
  if (!secret) {
    throw new Error('RAZORPAY_WEBHOOK_SECRET is not configured');
  }
  const signature = String(signatureHeader || '').trim();
  if (!signature) {
    throw new Error('Missing X-Razorpay-Signature header');
  }
  const body = typeof rawBody === 'string' ? rawBody : Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : '';
  if (!body) {
    throw new Error('Empty webhook body');
  }
  const expected = crypto.createHmac('sha256', secret).update(body).digest('hex');
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(signature, 'utf8');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    throw new Error('Invalid Razorpay webhook signature');
  }
  return true;
}

export function parseRazorpayWebhookPayload(rawBody) {
  const text = typeof rawBody === 'string' ? rawBody : Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : '';
  return JSON.parse(text || '{}');
}

/**
 * Handle acknowledged webhook events (idempotent logging for now).
 * Checkout flows already verify payment via order+signature; webhooks cover
 * async payment_link.paid / payment.captured retries.
 */
export async function handleRazorpayWebhookEvent(event) {
  const eventName = String(event?.event || '').trim();
  const paymentEntity =
    event?.payload?.payment?.entity ||
    event?.payload?.payment_link?.entity ||
    event?.payload?.order?.entity ||
    null;

  console.log(
    `[razorpay-webhook] event=${eventName} id=${event?.payload?.payment?.entity?.id || event?.payload?.payment_link?.entity?.id || 'n/a'}`,
  );

  return {
    ok: true,
    event: eventName,
    paymentId: paymentEntity?.id || null,
    status: paymentEntity?.status || null,
    notes: paymentEntity?.notes || null,
  };
}

export function getRazorpayWebhookUrlHints() {
  const config = getRazorpayConfig();
  return {
    enabled: Boolean(config.enabled && process.env.RAZORPAY_WEBHOOK_SECRET),
    local: String(process.env.RAZORPAY_WEBHOOK_URL_LOCAL || '').trim(),
    test: String(process.env.RAZORPAY_WEBHOOK_URL_TEST || '').trim(),
    production: String(process.env.RAZORPAY_WEBHOOK_URL_PRODUCTION || '').trim(),
  };
}
