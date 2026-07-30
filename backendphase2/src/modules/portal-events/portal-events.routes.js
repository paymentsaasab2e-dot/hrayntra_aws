import express from 'express';
import multer from 'multer';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { portalEventsController } from './portal-events.controller.js';
import {
  PORTAL_EVENT_MEDIA_MAX_BYTES,
  portalEventMediaMulterFilter,
} from './portal-events-media.service.js';

const router = express.Router();

const eventMediaUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: PORTAL_EVENT_MEDIA_MAX_BYTES, files: 10 },
  fileFilter: portalEventMediaMulterFilter,
});

router.use(authMiddleware);

router.get('/', portalEventsController.listTenantEvents);
router.post('/', portalEventsController.createTenantEvent);
router.post('/media', eventMediaUpload.array('files', 10), portalEventsController.uploadTenantEventMedia);
router.get('/:id/registrations', portalEventsController.listTenantEventRegistrations);
router.put('/:id', portalEventsController.updateTenantEvent);
router.post('/:id/cancel', portalEventsController.cancelTenantEvent);
router.delete('/:id', portalEventsController.deleteTenantEvent);

export default router;
