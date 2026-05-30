import express from 'express';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { attachUserPermissions } from '../../middleware/permission.middleware.js';
import { dashboardController } from './dashboard.controller.js';

const router = express.Router();

router.use(authMiddleware, attachUserPermissions);

router.get('/catalog', dashboardController.getCatalog);
router.get('/overview', dashboardController.getOverview);
router.get('/data/:datasetId', dashboardController.getDataset);
router.post('/analyze', dashboardController.analyze);
router.get('/layout', dashboardController.getLayout);
router.put('/layout', dashboardController.saveLayout);

export default router;
