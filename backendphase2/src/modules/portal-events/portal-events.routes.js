import express from 'express';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { portalEventsController } from './portal-events.controller.js';

const router = express.Router();

router.use(authMiddleware);

router.get('/', portalEventsController.listTenantEvents);
router.post('/', portalEventsController.createTenantEvent);
router.get('/:id/registrations', portalEventsController.listTenantEventRegistrations);

export default router;
