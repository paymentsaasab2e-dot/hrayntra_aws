const { spendTokens, resolveCandidateId } = require('../services/token.service');

/**
 * Deduct tokens for a billable service after auth.
 * Usage: requireTokens('lms.resume.ai-improve')
 */
function requireTokens(serviceId) {
  return async (req, res, next) => {
    try {
      const candidateId = resolveCandidateId(req.user);
      if (!candidateId) {
        return res.status(401).json({
          success: false,
          message: 'Not authorized',
          code: 'UNAUTHORIZED',
        });
      }

      const result = await spendTokens(candidateId, serviceId);
      req.tokenSpend = result;
      res.setHeader('X-Token-Balance', String(result.tokenBalance));
      res.setHeader('X-Tokens-Spent', String(result.spent));
      return next();
    } catch (error) {
      if (error.code === 'INSUFFICIENT_TOKENS' || error.status === 402) {
        return res.status(402).json({
          success: false,
          message: error.message || 'Insufficient tokens',
          code: 'INSUFFICIENT_TOKENS',
          balance: error.balance ?? 0,
          required: error.required,
          service: error.service || serviceId,
          shortfall: Math.max(0, (error.required || 0) - (error.balance || 0)),
        });
      }

      console.error('[requireTokens]', error);
      return res.status(error.status || 500).json({
        success: false,
        message: error.message || 'Token deduction failed',
      });
    }
  };
}

module.exports = { requireTokens };
