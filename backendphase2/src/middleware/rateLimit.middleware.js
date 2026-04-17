// Simple in-memory rate limiter for LinkedIn posts
// In production, use Redis or a proper rate limiting library

const rateLimitStore = new Map();

export const rateLimitMiddleware = (maxRequests = 10, windowMs = 60 * 60 * 1000) => {
  return (req, res, next) => {
    const userId = req.user?.id;
    if (!userId) {
      return next();
    }

    const now = Date.now();
    const userLimit = rateLimitStore.get(userId) || { count: 0, resetTime: now + windowMs };

    // Reset if window expired
    if (now > userLimit.resetTime) {
      userLimit.count = 0;
      userLimit.resetTime = now + windowMs;
    }

    // Check limit
    if (userLimit.count >= maxRequests) {
      return res.status(429).json({
        success: false,
        message: `Rate limit exceeded. Maximum ${maxRequests} posts per hour. Try again in ${Math.ceil((userLimit.resetTime - now) / 1000 / 60)} minutes.`,
      });
    }

    // Increment count
    userLimit.count++;
    rateLimitStore.set(userId, userLimit);

    next();
  };
};
