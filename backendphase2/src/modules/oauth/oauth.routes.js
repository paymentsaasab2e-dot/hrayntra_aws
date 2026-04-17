import express from 'express';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { googleOAuthController } from './google-oauth.controller.js';
import { microsoftOAuthController } from './microsoft-oauth.controller.js';
import { linkedinOAuthSettingsController } from './linkedin-oauth-settings.controller.js';

const router = express.Router();

// Google
router.get('/google/connect', authMiddleware, (req, res, next) =>
  googleOAuthController.connect(req, res).catch(next)
);
router.get('/google/callback', (req, res, next) =>
  googleOAuthController.callback(req, res).catch(next)
);
router.post('/google/disconnect', authMiddleware, express.json(), (req, res, next) =>
  googleOAuthController.disconnect(req, res).catch(next)
);

// Microsoft
router.get('/microsoft/connect', authMiddleware, (req, res, next) =>
  microsoftOAuthController.connect(req, res).catch(next)
);
router.get('/microsoft/callback', (req, res, next) =>
  microsoftOAuthController.callback(req, res).catch(next)
);
router.post('/microsoft/disconnect', authMiddleware, express.json(), (req, res, next) =>
  microsoftOAuthController.disconnect(req, res).catch(next)
);

// LinkedIn (settings / communication — JWT state)
router.get('/linkedin/connect', authMiddleware, (req, res, next) =>
  linkedinOAuthSettingsController.connect(req, res).catch(next)
);
router.get('/linkedin/callback', (req, res, next) =>
  linkedinOAuthSettingsController.callback(req, res).catch(next)
);
router.post('/linkedin/disconnect', authMiddleware, (req, res, next) =>
  linkedinOAuthSettingsController.disconnect(req, res).catch(next)
);

export default router;
