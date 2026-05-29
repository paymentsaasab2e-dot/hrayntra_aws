import express from 'express';
import { matchController } from './match.controller.js';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { requireAnyPermission } from '../../middleware/permission.middleware.js';

const router = express.Router();

router.use(authMiddleware);

router.get('/', requireAnyPermission(['matches_read']), matchController.getAll);
router.post('/bulk/reject', requireAnyPermission(['matches_manage']), matchController.bulkReject);
router.post('/bulk/pipeline', requireAnyPermission(['matches_manage']), matchController.bulkAddToPipeline);
router.post('/bulk/email', requireAnyPermission(['matches_manage']), matchController.bulkEmail);
router.get('/:id', requireAnyPermission(['matches_read']), matchController.getById);
router.post('/:id/save', requireAnyPermission(['matches_manage']), matchController.save);
router.post('/:id/submit', requireAnyPermission(['matches_manage']), matchController.submit);
router.post('/:id/reject', requireAnyPermission(['matches_manage']), matchController.reject);
router.post('/', requireAnyPermission(['matches_manage']), matchController.create);
router.patch('/:id', requireAnyPermission(['matches_manage']), matchController.update);
router.delete('/:id', requireAnyPermission(['matches_manage']), matchController.delete);

export default router;
