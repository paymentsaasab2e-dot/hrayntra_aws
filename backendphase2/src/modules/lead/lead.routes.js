import express from 'express';
import multer from 'multer';
import { leadController } from './lead.controller.js';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { requireAnyPermission } from '../../middleware/permission.middleware.js';

const router = express.Router();
const importUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

router.use(authMiddleware);

router.get('/', requireAnyPermission(['leads_read']), leadController.getAll);
// Recycle Bin endpoints — registered BEFORE the `/:id` routes so '/trash' isn't read as an id.
router.get('/trash', requireAnyPermission(['leads_read', 'leads_delete']), leadController.listTrash);
router.post('/trash/bulk-purge', requireAnyPermission(['leads_delete']), leadController.bulkPurge);
router.post('/:id/restore', requireAnyPermission(['leads_update', 'leads_create']), leadController.restore);
router.delete('/:id/purge', requireAnyPermission(['leads_delete']), leadController.purge);
router.post('/duplicate-check', requireAnyPermission(['leads_create']), leadController.checkCreateDuplicate);
router.post('/import/preview', requireAnyPermission(['leads_create']), importUpload.single('file'), leadController.previewImport);
router.post('/import/check-duplicates', requireAnyPermission(['leads_create']), leadController.checkImportDuplicates);
router.post('/import', requireAnyPermission(['leads_create']), leadController.importLeads);
router.get('/:id', requireAnyPermission(['leads_read']), leadController.getById);
router.get('/:id/activities', leadController.getActivities);
router.post('/', requireAnyPermission(['leads_create']), leadController.create);
router.patch('/:id', requireAnyPermission(['leads_update']), leadController.update);
router.post('/:id/convert', requireAnyPermission(['leads_update', 'clients_create']), leadController.convertToClient);
router.delete('/:id', requireAnyPermission(['leads_delete']), leadController.delete);

// Notes routes
router.get('/:leadId/notes', requireAnyPermission(['leads_read']), leadController.getNotes);
router.post('/:leadId/notes', requireAnyPermission(['leads_update']), leadController.createNote);
router.patch('/:leadId/notes/:noteId', requireAnyPermission(['leads_update']), leadController.updateNote);
router.delete('/:leadId/notes/:noteId', requireAnyPermission(['leads_delete']), leadController.deleteNote);

export default router;
