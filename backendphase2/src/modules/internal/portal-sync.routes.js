import { Router } from 'express';
import { env } from '../../config/env.js';
import {
  postSyncPortalApplication,
  postSyncPortalWithdrawApplication,
  postSyncPortalTailoredCv,
  postPlacementOfferResponse,
  postBackfillPortalJobTenants,
  postPortalInterviewFeedbackLookup,
  postPortalInterviewRoundsLookup,
  postSyncEmployerDemoVerified,
  postProvisionEmployerTrial,
  postProvisionEmployerPaid,
} from './portal-sync.controller.js';
import { postEventTokenPayout } from './event-token-payout.service.js';

const router = Router();

function maskSecret(value) {
  const s = String(value || '');
  if (!s) return '<empty>';
  if (s.length <= 8) return `${s[0]}***`;
  return `${s.slice(0, 4)}***${s.slice(-2)} (len=${s.length})`;
}

function portalSyncSecretMiddleware(req, res, next) {
  const envSecret = String(env.PHASE2_PORTAL_SYNC_SECRET || '').trim();
  const got = String(req.headers['x-phase2-portal-sync-secret'] || '').trim();

  if (!envSecret) {
    return res
      .status(503)
      .json({ success: false, message: 'Portal sync is not configured' });
  }

  if (got && got === envSecret) return next();

  console.warn('[portal-sync] 401 secret mismatch', {
    env: maskSecret(envSecret),
    got: maskSecret(got),
    hint: 'Verify both backends share the exact same PHASE2_PORTAL_SYNC_SECRET.',
  });
  return res.status(401).json({ success: false, message: 'Unauthorized' });
}

router.post('/sync-portal-application', portalSyncSecretMiddleware, postSyncPortalApplication);
router.post(
  '/sync-portal-withdraw-application',
  portalSyncSecretMiddleware,
  postSyncPortalWithdrawApplication
);
router.post('/sync-portal-tailored-cv', portalSyncSecretMiddleware, postSyncPortalTailoredCv);
router.post('/placement-offer-response', portalSyncSecretMiddleware, postPlacementOfferResponse);
router.post(
  '/backfill-portal-job-tenants',
  portalSyncSecretMiddleware,
  postBackfillPortalJobTenants
);
router.post(
  '/portal-interview-feedback-lookup',
  portalSyncSecretMiddleware,
  postPortalInterviewFeedbackLookup
);
router.post(
  '/portal-interview-rounds-lookup',
  portalSyncSecretMiddleware,
  postPortalInterviewRoundsLookup
);
router.post(
  '/sync-employer-demo-verified',
  portalSyncSecretMiddleware,
  postSyncEmployerDemoVerified
);
router.post(
  '/provision-employer-trial',
  portalSyncSecretMiddleware,
  postProvisionEmployerTrial
);
router.post(
  '/provision-employer-paid',
  portalSyncSecretMiddleware,
  postProvisionEmployerPaid
);
router.post('/event-token-payout', portalSyncSecretMiddleware, postEventTokenPayout);

/** Phase 1 token packs + spend costs (HQ-managed) for backend1 catalog. */
router.get('/phase1-token-catalog', portalSyncSecretMiddleware, async (req, res) => {
  try {
    const { hqPhase1TokensService } = await import('../hq/hq-phase1-tokens.service.js');
    const overview = await hqPhase1TokensService.getOverview({ includeInactive: false });
    return res.status(200).json({
      success: true,
      message: 'OK',
      data: {
        packs: overview.packs,
        services: overview.services,
        serviceCosts: overview.serviceCosts,
        earns: overview.earns,
        earnRewards: overview.earnRewards,
        updatedAt: overview.updatedAt,
      },
    });
  } catch (error) {
    console.error('[portal-sync] phase1-token-catalog', error);
    return res.status(500).json({
      success: false,
      message: error?.message || 'Failed to load Phase 1 token catalog',
    });
  }
});

export default router;
