import express from 'express';
import multer from 'multer';
import { contactController } from './contact.controller.js';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { requireAnyPermission } from '../../middleware/permission.middleware.js';

const router = express.Router();
const importUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

router.use(authMiddleware);

// Stats endpoint (before /:id route)
router.get('/stats', requireAnyPermission(['contacts_read']), contactController.getStats);

// Duplicate detection (before /:id route)
router.get('/duplicates', requireAnyPermission(['contacts_read']), contactController.detectDuplicates);

// CRUD routes
router.get('/', requireAnyPermission(['contacts_read']), contactController.getAll);
router.post('/import/preview', requireAnyPermission(['contacts_create']), importUpload.single('file'), contactController.previewImport);
router.post('/import', requireAnyPermission(['contacts_create']), contactController.importContacts);
router.post('/', requireAnyPermission(['contacts_create']), contactController.create);
router.get('/:id', requireAnyPermission(['contacts_read']), contactController.getById);
router.patch('/:id', requireAnyPermission(['contacts_update']), contactController.update);
router.delete('/:id', requireAnyPermission(['contacts_delete']), contactController.delete);

// Bulk actions
router.post('/bulk', requireAnyPermission(['contacts_update']), contactController.bulkAction);
router.post('/merge', requireAnyPermission(['contacts_update']), contactController.mergeContacts);

// Related resources
router.post('/:id/notes', requireAnyPermission(['contacts_update']), contactController.addNote);
router.post('/:id/activities', requireAnyPermission(['contacts_update']), contactController.addActivity);
router.post('/:id/communications', requireAnyPermission(['contacts_update']), contactController.addCommunication);

export default router;
