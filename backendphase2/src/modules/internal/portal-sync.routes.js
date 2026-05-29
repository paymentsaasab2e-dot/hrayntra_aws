import { Router } from 'express';
import { env } from '../../config/env.js';
import {
  postSyncPortalApplication,
  postPlacementOfferResponse,
  postBackfillPortalJobTenants,
} from './portal-sync.controller.js';

const router = Router();

// Hardcoded local-dev fallback. Mirrored in backend1's
// `application.controller.js` so the two services always agree out of the box
// when `PHASE2_PORTAL_SYNC_SECRET` is missing or when the user forgets to
// restart one of the processes after editing `.env`. In production the env
// variable is required; the fallback is only honored in non-production.
const DEV_FALLBACK_SECRET = 'phase2-portal-sync-2026-shared-secret';

function maskSecret(value) {
  const s = String(value || '');
  if (!s) return '<empty>';
  if (s.length <= 8) return `${s[0]}***`;
  return `${s.slice(0, 4)}***${s.slice(-2)} (len=${s.length})`;
}

function portalSyncSecretMiddleware(req, res, next) {
  const envSecret = String(env.PHASE2_PORTAL_SYNC_SECRET || '').trim();
  const got = String(req.headers['x-phase2-portal-sync-secret'] || '').trim();
  const isProd = env.NODE_ENV === 'production';

  // Build the set of accepted secrets:
  //  - Always accept the env-configured secret (when set).
  //  - In non-production also accept the hardcoded dev fallback so a
  //    half-restarted dev environment doesn't silently 401.
  const accepted = new Set();
  if (envSecret) accepted.add(envSecret);
  if (!isProd) accepted.add(DEV_FALLBACK_SECRET);

  // Production with no env secret → refuse to expose the endpoint.
  if (isProd && !envSecret) {
    return res
      .status(503)
      .json({ success: false, message: 'Portal sync is not configured' });
  }

  // Dev with no env secret AND no incoming header → still accept (legacy
  // behavior so a fresh dev clone works without any env wiring).
  if (!isProd && !envSecret && !got) {
    return next();
  }

  if (got && accepted.has(got)) return next();

  // Surface a single clear diagnostic so any future mismatch is debuggable
  // from logs in one glance instead of digging through pino entries.
  console.warn(
    '[portal-sync] 401 secret mismatch',
    {
      env: maskSecret(envSecret),
      got: maskSecret(got),
      acceptedDevFallback: !isProd,
      hint: isProd
        ? 'Verify both backends share the exact same PHASE2_PORTAL_SYNC_SECRET.'
        : 'Restart backend1 (`pnpm dev`) so it reloads .env, or align both .env values.',
    }
  );
  return res.status(401).json({ success: false, message: 'Unauthorized' });
}

router.post('/sync-portal-application', portalSyncSecretMiddleware, postSyncPortalApplication);
router.post('/placement-offer-response', portalSyncSecretMiddleware, postPlacementOfferResponse);
router.post(
  '/backfill-portal-job-tenants',
  portalSyncSecretMiddleware,
  postBackfillPortalJobTenants
);

export default router;
