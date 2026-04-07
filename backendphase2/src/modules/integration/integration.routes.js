import express from 'express';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { integrationController } from './integration.controller.js';

const router = express.Router();

router.get('/auth/:provider', authMiddleware, (req, res, next) =>
  integrationController.connect(req, res).catch(next)
);
router.get('/auth/:provider/callback', (req, res, next) =>
  integrationController.callback(req, res).catch(next)
);
router.post('/disconnect/:provider', authMiddleware, express.json(), (req, res, next) =>
  integrationController.disconnect(req, res).catch(next)
);
router.get('/integrations/status', authMiddleware, (req, res, next) =>
  integrationController.status(req, res).catch(next)
);

export default router;

