import { Router } from 'express';
import { env } from '../../config/env.js';
import { postSyncPortalApplication } from './portal-sync.controller.js';

const router = Router();

function portalSyncSecretMiddleware(req, res, next) {
  const expected = String(env.PHASE2_PORTAL_SYNC_SECRET || '').trim();
  if (!expected) {
    if (env.NODE_ENV === 'production') {
      return res.status(503).json({ success: false, message: 'Portal sync is not configured' });
    }
    return next();
  }
  const got = req.headers['x-phase2-portal-sync-secret'];
  if (got !== expected) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }
  return next();
}

router.post('/sync-portal-application', portalSyncSecretMiddleware, postSyncPortalApplication);

export default router;
