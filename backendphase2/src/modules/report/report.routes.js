import express from 'express';
import { reportController } from './report.controller.js';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { requireAnyPermission } from '../../middleware/permission.middleware.js';

const router = express.Router();

router.use(authMiddleware);

router.get('/summary/export/:tab/:format', requireAnyPermission(['reports_read', 'export_data']), reportController.exportSummaryTab);
router.get('/summary', requireAnyPermission(['reports_read']), reportController.getSummary);
router.get('/dataset/:entity', requireAnyPermission(['reports_read']), reportController.getDataset);
router.get('/export/:entity/:format', requireAnyPermission(['reports_read', 'export_data']), reportController.exportEntity);
router.get('/', requireAnyPermission(['reports_read']), reportController.getAll);
router.get('/:id', requireAnyPermission(['reports_read']), reportController.getById);
router.post('/', requireAnyPermission(['reports_create']), reportController.create);
router.patch('/:id', requireAnyPermission(['reports_update']), reportController.update);
router.delete('/:id', requireAnyPermission(['reports_delete']), reportController.delete);

export default router;
