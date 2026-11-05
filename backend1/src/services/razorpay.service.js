const crypto = require('crypto');

function getRazorpayConfig() {
  const keyId = String(process.env.RAZORPAY_KEY_ID || '').trim();
  const keySecret = String(process.env.RAZORPAY_KEY_SECRET || '').trim();
  const merchantName = String(process.env.RAZORPAY_MERCHANT_NAME || 'Hryantra SAASA').trim();
  const merchantUpi = String(process.env.RAZORPAY_MERCHANT_UPI || '').trim();
  const usdToInrRate = Number(process.env.RAZORPAY_USD_TO_INR_RATE || 83);
  const currency = String(process.env.RAZORPAY_CURRENCY || 'INR').trim().toUpperCase();
  return {
    keyId,
    keySecret,
    merchantName,
    merchantUpi,
    usdToInrRate: Number.isFinite(usdToInrRate) && usdToInrRate > 0 ? usdToInrRate : 83,
    currency: 'INR',
    enabled: Boolean(keyId && keySecret),
  };
}

function assertRazorpayConfigured() {
  const config = getRazorpayConfig();
  if (!config.enabled) {
    throw Object.assign(
      new Error('Razorpay is not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in backend1 .env'),
      { status: 503 },
    );
  }
  return config;
}

function getRazorpayPublicConfig() {
  const config = getRazorpayConfig();
  return {
    enabled: config.enabled,
    mode: config.enabled ? 'live' : 'clone',
    keyId: config.keyId,
    merchantName: config.merchantName,
    merchantUpi: config.merchantUpi,
    currency: config.currency,
  };
}

function authHeader(config) {
  return `Basic ${Buffer.from(`${config.keyId}:${config.keySecret}`).toString('base64')}`;
}

function usdToPaise(usdAmount) {
  const config = getRazorpayConfig();
  const usd = Number(usdAmount);
  if (!Number.isFinite(usd) || usd <= 0) throw new Error('Invalid USD amount');
  return Math.max(100, Math.round(usd * config.usdToInrRate * 100));
}

function verifyRazorpayPaymentSignature({ orderId, paymentId, signature }) {
  const config = assertRazorpayConfigured();
  const order_id = String(orderId || '').trim();
  const payment_id = String(paymentId || '').trim();
  const razorpay_signature = String(signature || '').trim();
  if (!order_id || !payment_id || !razorpay_signature) {
    throw new Error('Incomplete Razorpay payment details');
  }
  const expected = crypto
    .createHmac('sha256', config.keySecret)
    .update(`${order_id}|${payment_id}`)
    .digest('hex');
  if (expected !== razorpay_signature) {
    throw new Error('Razorpay payment verification failed');
  }
  return { orderId: order_id, paymentId: payment_id };
}

async function razorpayRequest(method, path, body) {
  const config = assertRazorpayConfigured();
  const res = await fetch(`https://api.razorpay.com/v1${path}`, {
    method,
    headers: {
      Authorization: authHeader(config),
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error?.description || data?.message || `Razorpay API ${res.status}`);
  }
  return data;
}

async function createRazorpayOrder({ amountPaise, receipt, notes = {} }) {
  const config = assertRazorpayConfigured();
  const amount = Math.round(Number(amountPaise));
  if (!Number.isFinite(amount) || amount < 100) {
    throw new Error('Payment amount must be at least ₹1');
  }
  return razorpayRequest('POST', '/orders', {
    amount,
    currency: config.currency,
    receipt: String(receipt || `rcpt_${Date.now()}`).slice(0, 40),
    notes: { ...notes, merchant_upi: config.merchantUpi },
  });
}

async function fetchRazorpayPayment(paymentId) {
  return razorpayRequest('GET', `/payments/${encodeURIComponent(String(paymentId || '').trim())}`);
}

async function fetchRazorpayOrder(orderId) {
  return razorpayRequest('GET', `/orders/${encodeURIComponent(String(orderId || '').trim())}`);
}

async function assertRazorpayPaymentCaptured({
  orderId,
  paymentId,
  expectedAmountPaise,
  expectedNotes = {},
}) {
  const [payment, order] = await Promise.all([
    fetchRazorpayPayment(paymentId),
    fetchRazorpayOrder(orderId),
  ]);
  if (String(payment.order_id || '') !== String(orderId)) {
    throw new Error('Payment does not belong to this order');
  }
  if (!['captured', 'authorized'].includes(String(payment.status || '').toLowerCase())) {
    throw new Error('Payment is not completed yet');
  }
  if (Math.round(Number(order.amount)) !== Math.round(Number(expectedAmountPaise))) {
    throw new Error('Payment amount mismatch');
  }
  if (Math.round(Number(payment.amount)) !== Math.round(Number(expectedAmountPaise))) {
    throw new Error('Payment amount mismatch');
  }
  for (const [key, value] of Object.entries(expectedNotes)) {
    if (value != null && String(order.notes?.[key] || '') !== String(value)) {
      throw new Error(`Order note mismatch for ${key}`);
    }
  }
  return { payment, order };
}

function verifyRazorpayWebhookSignature(rawBody, signatureHeader) {
  const secret = String(process.env.RAZORPAY_WEBHOOK_SECRET || '').trim();
  if (!secret) throw new Error('RAZORPAY_WEBHOOK_SECRET is not configured');
  const signature = String(signatureHeader || '').trim();
  if (!signature) throw new Error('Missing X-Razorpay-Signature header');
  const body = typeof rawBody === 'string' ? rawBody : Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : '';
  const expected = crypto.createHmac('sha256', secret).update(body).digest('hex');
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(signature, 'utf8');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    throw new Error('Invalid Razorpay webhook signature');
  }
  return true;
}

module.exports = {
  getRazorpayConfig,
  assertRazorpayConfigured,
  getRazorpayPublicConfig,
  usdToPaise,
  verifyRazorpayPaymentSignature,
  createRazorpayOrder,
  fetchRazorpayPayment,
  fetchRazorpayOrder,
  assertRazorpayPaymentCaptured,
  verifyRazorpayWebhookSignature,
};
