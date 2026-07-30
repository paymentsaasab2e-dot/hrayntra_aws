import { spendTenantCoins } from '../modules/setting/tenantCoinWallet.service.js';
import { sendError } from '../utils/response.js';

/**
 * Deduct coins for a billable Phase 2 AI feature after auth.
 * Usage: requireCoins('ai.job_from_prompt')
 *
 * Sets X-Coin-Balance / X-Coins-Spent headers and attaches coinBalance / coinsSpent
 * on the JSON body so browsers that cannot read CORS headers still update the UI.
 */
export function requireCoins(featureId) {
  return async (req, res, next) => {
    try {
      const result = await spendTenantCoins(featureId, {
        user: req.user,
        meta: { path: req.originalUrl || req.path },
      });
      req.coinSpend = result;
      res.setHeader('X-Coin-Balance', String(result.coins));
      res.setHeader('X-Coins-Spent', String(result.spent));

      const originalJson = res.json.bind(res);
      res.json = (body) => {
        if (body && typeof body === 'object') {
          if (body.data && typeof body.data === 'object' && !Array.isArray(body.data)) {
            body = {
              ...body,
              data: {
                ...body.data,
                coinBalance: result.coins,
                coinsSpent: result.spent,
              },
            };
          } else {
            body = {
              ...body,
              coinBalance: result.coins,
              coinsSpent: result.spent,
            };
          }
        }
        return originalJson(body);
      };

      return next();
    } catch (error) {
      if (error.code === 'INSUFFICIENT_COINS' || error.status === 402) {
        return res.status(402).json({
          success: false,
          message: error.message || 'Insufficient AI coins',
          data: {
            code: 'INSUFFICIENT_COINS',
            balance: error.meta?.balance ?? 0,
            required: error.meta?.required,
            feature: error.meta?.feature || featureId,
            shortfall: error.meta?.shortfall ?? 0,
          },
        });
      }

      console.error('[requireCoins]', error);
      return sendError(res, error.status || 500, error.message || 'Coin deduction failed', error);
    }
  };
}
