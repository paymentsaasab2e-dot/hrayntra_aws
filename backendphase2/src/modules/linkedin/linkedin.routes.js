import express from 'express';
import { linkedinController } from './linkedin.controller.js';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { rateLimitMiddleware } from '../../middleware/rateLimit.middleware.js';

const router = express.Router();

// Public OAuth routes
// Note: /auth/linkedin needs auth, but callback doesn't (LinkedIn redirects there)
router.get('/auth/linkedin', authMiddleware, linkedinController.initiateAuth);
router.get('/auth/linkedin/callback', linkedinController.handleCallback);

// Protected API routes
router.get('/status', authMiddleware, linkedinController.getStatus);
router.post('/post-job', authMiddleware, rateLimitMiddleware(10, 60 * 60 * 1000), linkedinController.postJob); // Max 10 posts per hour
router.delete('/disconnect', authMiddleware, linkedinController.disconnect);

export default router;
