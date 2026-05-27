import express from 'express';
import multer from 'multer';
import { clientController } from './client.controller.js';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { requireAnyPermission } from '../../middleware/permission.middleware.js';

const router = express.Router();
const importUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

router.use(authMiddleware);

router.get('/', requireAnyPermission(['clients_read']), clientController.getAll);
router.get('/metrics', requireAnyPermission(['clients_read']), clientController.getMetrics);
// Recycle Bin endpoints — registered BEFORE the `/:id` routes so '/trash' isn't read as an id.
router.get('/trash', requireAnyPermission(['clients_read', 'clients_delete']), clientController.listTrash);
router.post('/trash/bulk-purge', requireAnyPermission(['clients_delete']), clientController.bulkPurge);
router.post('/:id/restore', requireAnyPermission(['clients_update', 'clients_create']), clientController.restore);
router.delete('/:id/purge', requireAnyPermission(['clients_delete']), clientController.purge);
router.post('/import/preview', requireAnyPermission(['clients_create']), importUpload.single('file'), clientController.previewImport);
router.post('/import/check-duplicates', requireAnyPermission(['clients_create']), clientController.checkImportDuplicates);
router.post('/import', requireAnyPermission(['clients_create']), clientController.importClients);
router.get('/:id', requireAnyPermission(['clients_read']), clientController.getById);
router.get('/:clientId/activities', requireAnyPermission(['clients_read']), clientController.getActivities);
router.post('/', requireAnyPermission(['clients_create']), clientController.create);
router.patch('/:id', requireAnyPermission(['clients_update']), clientController.update);
router.delete('/:id', requireAnyPermission(['clients_delete']), clientController.delete);

// Notes routes
router.get('/:clientId/notes', requireAnyPermission(['clients_read']), clientController.getNotes);
router.post('/:clientId/notes', requireAnyPermission(['clients_update']), clientController.createNote);
router.patch('/:clientId/notes/:noteId', requireAnyPermission(['clients_update']), clientController.updateNote);
router.delete('/:clientId/notes/:noteId', requireAnyPermission(['clients_delete']), clientController.deleteNote);

// Files routes
router.get('/:clientId/files', requireAnyPermission(['clients_read']), clientController.getFiles);
router.post('/:clientId/files', requireAnyPermission(['clients_update']), clientController.createFile);
router.delete('/:clientId/files/:fileId', requireAnyPermission(['clients_delete']), clientController.deleteFile);

export default router;
