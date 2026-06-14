import express from 'express';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { attachUserPermissions, requireAnyPermission } from '../../middleware/permission.middleware.js';
import { dashboardController } from './dashboard.controller.js';

const router = express.Router();

const dashboardRead = requireAnyPermission(['view_dashboard', 'reports_read']);

router.use(authMiddleware, attachUserPermissions);

router.get('/catalog', dashboardRead, dashboardController.getCatalog);
router.get('/overview', dashboardRead, dashboardController.getOverview);
router.get('/data/:datasetId', dashboardRead, dashboardController.getDataset);
router.post('/analyze', dashboardRead, dashboardController.analyze);
router.get('/layout', dashboardRead, dashboardController.getLayout);
router.put('/layout', dashboardRead, dashboardController.saveLayout);

export default router;
