const DEFAULT_MERCHANT_UPI = 'ghodehimanshu453-4@okicici';

export function getRazorpayConfig() {
  const keyId = String(process.env.RAZORPAY_KEY_ID || '').trim();
  const keySecret = String(process.env.RAZORPAY_KEY_SECRET || '').trim();
  const merchantName = String(process.env.RAZORPAY_MERCHANT_NAME || 'Hryantra SAASA').trim();
  const merchantUpi = String(process.env.RAZORPAY_MERCHANT_UPI || DEFAULT_MERCHANT_UPI).trim();
  const usdToInrRate = Number(process.env.RAZORPAY_USD_TO_INR_RATE || 83);
  const currency = String(process.env.RAZORPAY_CURRENCY || 'INR').trim().toUpperCase();

  return {
    keyId,
    keySecret,
    merchantName,
    merchantUpi,
    usdToInrRate: Number.isFinite(usdToInrRate) && usdToInrRate > 0 ? usdToInrRate : 83,
    currency: currency === 'INR' ? 'INR' : 'INR',
    enabled: Boolean(keyId && keySecret),
  };
}

export function assertRazorpayConfigured() {
  const config = getRazorpayConfig();
  if (!config.enabled) {
    throw new Error(
      'Razorpay is not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in backend .env',
    );
  }
  return config;
}
