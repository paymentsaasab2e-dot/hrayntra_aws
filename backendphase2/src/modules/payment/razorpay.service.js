import crypto from 'node:crypto';
import axios from 'axios';
import { assertRazorpayConfigured, getRazorpayConfig } from './razorpay.config.js';

function authHeader(config) {
  const token = Buffer.from(`${config.keyId}:${config.keySecret}`).toString('base64');
  return { Authorization: `Basic ${token}` };
}

export function verifyRazorpayPaymentSignature({ orderId, paymentId, signature }) {
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

export async function createRazorpayOrder({
  amountPaise,
  receipt,
  notes = {},
}) {
  const config = assertRazorpayConfigured();
  const amount = Math.round(Number(amountPaise));
  if (!Number.isFinite(amount) || amount < 100) {
    throw new Error('Payment amount must be at least ₹1');
  }

  const { data } = await axios.post(
    'https://api.razorpay.com/v1/orders',
    {
      amount,
      currency: config.currency,
      receipt: String(receipt || `rcpt_${Date.now()}`).slice(0, 40),
      notes: {
        ...notes,
        merchant_upi: config.merchantUpi,
      },
    },
    { headers: authHeader(config) },
  );

  return data;
}

export async function fetchRazorpayPayment(paymentId) {
  const config = assertRazorpayConfigured();
  const id = String(paymentId || '').trim();
  if (!id) throw new Error('paymentId is required');

  const { data } = await axios.get(`https://api.razorpay.com/v1/payments/${id}`, {
    headers: authHeader(config),
  });
  return data;
}

export async function fetchRazorpayOrder(orderId) {
  const config = assertRazorpayConfigured();
  const id = String(orderId || '').trim();
  if (!id) throw new Error('orderId is required');

  const { data } = await axios.get(`https://api.razorpay.com/v1/orders/${id}`, {
    headers: authHeader(config),
  });
  return data;
}

export async function assertRazorpayPaymentCaptured({
  orderId,
  paymentId,
  expectedAmountPaise,
  expectedNotes = {},
}) {
  const [payment, order] = await Promise.all([
    fetchRazorpayPayment(paymentId),
    fetchRazorpayOrder(orderId),
  ]);
  const order_id = String(orderId || '').trim();
  const payment_id = String(paymentId || '').trim();

  if (String(payment.order_id || '') !== order_id) {
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
    const actual = order.notes?.[key];
    if (value != null && String(actual || '') !== String(value)) {
      throw new Error(`Order note mismatch for ${key}`);
    }
  }

  return { orderId: order_id, paymentId: payment_id, payment, order };
}

export function getRazorpayPublicConfig() {
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
