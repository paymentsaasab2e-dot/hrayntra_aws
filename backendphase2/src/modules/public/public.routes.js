import express from 'express';
import { sendError, sendResponse } from '../../utils/response.js';
import { getPublicLandingMetrics } from './public-landing-metrics.service.js';

const router = express.Router();

/**
 * GET /api/v1/public/landing-metrics
 * Safe aggregate counts only. Disabled unless LANDING_PUBLIC_METRICS=true.
 */
router.get('/landing-metrics', async (_req, res) => {
  try {
    const data = await getPublicLandingMetrics();
    if (!data) {
      return sendResponse(res, 200, 'Demo mode', { mode: 'demo', available: false });
    }
    return sendResponse(res, 200, 'OK', data);
  } catch (error) {
    console.error('[public/landing-metrics]', error);
    return sendError(res, 500, 'Unable to load landing metrics');
  }
});

export default router;
