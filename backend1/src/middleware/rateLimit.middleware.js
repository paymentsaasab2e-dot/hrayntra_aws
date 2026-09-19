/**
 * Lightweight in-memory rate limiter (no external dependency).
 * Suitable for single-process Node; multi-instance deploys should use Redis later.
 */

function createRateLimiter({
  windowMs = 15 * 60 * 1000,
  max = 100,
  keyGenerator = (req) => req.ip || 'unknown',
  message = 'Too many requests, please try again later.',
  skipSuccessfulRequests = false,
} = {}) {
  const hits = new Map();

  function prune(now) {
    if (hits.size < 5000) return;
    for (const [key, entry] of hits) {
      if (entry.resetAt <= now) hits.delete(key);
    }
  }

  return function rateLimitMiddleware(req, res, next) {
    const now = Date.now();
    prune(now);
    const key = String(keyGenerator(req) || 'unknown');
    let entry = hits.get(key);
    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + windowMs };
      hits.set(key, entry);
    }
    entry.count += 1;
    const remaining = Math.max(0, max - entry.count);
    res.setHeader('X-RateLimit-Limit', String(max));
    res.setHeader('X-RateLimit-Remaining', String(remaining));
    res.setHeader('X-RateLimit-Reset', String(Math.ceil(entry.resetAt / 1000)));

    if (entry.count > max) {
      return res.status(429).json({
        success: false,
        message,
        code: 'RATE_LIMITED',
        retryAfterSec: Math.ceil((entry.resetAt - now) / 1000),
      });
    }

    if (skipSuccessfulRequests) {
      const originalJson = res.json.bind(res);
      res.json = (body) => {
        if (res.statusCode < 400 && entry.count > 0) {
          entry.count -= 1;
        }
        return originalJson(body);
      };
    }

    return next();
  };
}

/** OTP send: per IP + per email */
function otpSendRateLimit() {
  const byIp = createRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: 20,
    keyGenerator: (req) => `otp-send-ip:${req.ip || req.headers['x-forwarded-for'] || 'unknown'}`,
    message: 'Too many OTP requests from this network. Please wait and try again.',
  });
  const byEmail = createRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: 5,
    keyGenerator: (req) => {
      const email = String(req.body?.email || '').trim().toLowerCase();
      return `otp-send-email:${email || 'none'}`;
    },
    message: 'Too many OTP requests for this email. Please wait before requesting another code.',
  });
  return (req, res, next) => byIp(req, res, () => byEmail(req, res, next));
}

/** OTP verify: stricter per IP + email */
function otpVerifyRateLimit() {
  const byIp = createRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: 40,
    keyGenerator: (req) => `otp-verify-ip:${req.ip || req.headers['x-forwarded-for'] || 'unknown'}`,
    message: 'Too many verification attempts. Please wait and try again.',
  });
  const byEmail = createRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: 10,
    keyGenerator: (req) => {
      const email = String(req.body?.email || '').trim().toLowerCase();
      return `otp-verify-email:${email || 'none'}`;
    },
    message: 'Too many OTP verification attempts for this email. Request a new code after waiting.',
  });
  return (req, res, next) => byIp(req, res, () => byEmail(req, res, next));
}

/** Generic auth endpoint limiter */
function authEndpointRateLimit() {
  return createRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: 60,
    keyGenerator: (req) => `auth:${req.ip || 'unknown'}`,
    message: 'Too many authentication requests. Please try again later.',
  });
}

/** AI / expensive endpoints */
function expensiveEndpointRateLimit() {
  return createRateLimiter({
    windowMs: 60 * 1000,
    max: 30,
    keyGenerator: (req) => `expensive:${req.user?.candidateId || req.ip || 'unknown'}`,
    message: 'Rate limit exceeded for this operation.',
  });
}

module.exports = {
  createRateLimiter,
  otpSendRateLimit,
  otpVerifyRateLimit,
  authEndpointRateLimit,
  expensiveEndpointRateLimit,
};
