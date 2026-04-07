import express from 'express';
import { reportController } from './report.controller.js';
import { authMiddleware } from '../../middleware/auth.middleware.js';

const router = express.Router();

router.use(authMiddleware);

router.get('/summary/export/:tab/:format', reportController.exportSummaryTab);
router.get('/summary', reportController.getSummary);
router.get('/dataset/:entity', reportController.getDataset);
router.get('/export/:entity/:format', reportController.exportEntity);
router.get('/', reportController.getAll);
router.get('/:id', reportController.getById);
router.post('/', reportController.create);
router.patch('/:id', reportController.update);
router.delete('/:id', reportController.delete);

export default router;
