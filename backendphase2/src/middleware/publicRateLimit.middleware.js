/**
 * IP-based rate limiter for public / unauthenticated surfaces.
 */
const hits = new Map();

export function createIpRateLimiter({
  windowMs = 15 * 60 * 1000,
  max = 60,
  message = 'Too many requests. Please try again later.',
} = {}) {
  return function ipRateLimit(req, res, next) {
    const now = Date.now();
    const ip = String(req.ip || req.headers['x-forwarded-for'] || 'unknown').split(',')[0].trim();
    const key = `${req.baseUrl || ''}:${ip}`;
    let entry = hits.get(key);
    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + windowMs };
      hits.set(key, entry);
    }
    entry.count += 1;
    if (entry.count > max) {
      return res.status(429).json({
        success: false,
        message,
        code: 'RATE_LIMITED',
      });
    }
    return next();
  };
}

export const publicFormRateLimit = createIpRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 40,
  message: 'Too many public form requests. Please wait and try again.',
});

export const publicTokenRateLimit = createIpRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 80,
  message: 'Too many token requests. Please wait and try again.',
});
