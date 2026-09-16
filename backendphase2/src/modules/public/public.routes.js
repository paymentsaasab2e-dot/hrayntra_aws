import express from 'express';
import { sendError, sendResponse } from '../../utils/response.js';
import { getPublicLandingMetrics } from './public-landing-metrics.service.js';
import { hqLeadsService } from '../hq/hq-leads.service.js';

const router = express.Router();

/**
 * GET /api/v1/public/landing-metrics
 * Safe aggregate counts only. Set LANDING_PUBLIC_METRICS=false to force demo mode.
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

/**
 * POST /api/v1/public/try-free-interest
 * Capture email + mobile from Try it free step 1 into HQ CRM leads.
 * Stored even if the visitor never requests a demo.
 */
router.post('/try-free-interest', async (req, res) => {
  try {
    const result = await hqLeadsService.captureTryFreeInterest(req.body || {});
    return sendResponse(
      res,
      200,
      result.created ? 'Interest saved' : 'Interest already on file',
      {
        leadId: result.lead?.id || null,
        created: result.created,
      },
    );
  } catch (error) {
    const message = String(error?.message || 'Unable to save your details');
    const status = /valid/i.test(message) ? 400 : 500;
    return sendError(res, status, message);
  }
});

export default router;
