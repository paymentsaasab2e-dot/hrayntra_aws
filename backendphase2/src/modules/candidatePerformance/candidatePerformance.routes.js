import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { requireAnyPermission } from '../../middleware/permission.middleware.js';
import { candidatePerformanceController } from './candidatePerformance.controller.js';

const router = Router();

router.use(authMiddleware);
router.use(
  requireAnyPermission([
    'candidates_read',
    'view_all_candidates',
    'view_assigned_candidates',
    'manage_settings',
  ]),
);

router.get('/overview', candidatePerformanceController.overview);
router.get('/cache-stats', candidatePerformanceController.cacheStats);
router.get('/history', candidatePerformanceController.history);
router.post('/run-test', candidatePerformanceController.runTest);
router.post('/compare', candidatePerformanceController.compare);
router.post('/concurrency-test', candidatePerformanceController.concurrencyTest);
router.post('/cache-refresh', candidatePerformanceController.cacheRefresh);
router.post('/cache-clear', candidatePerformanceController.cacheClear);
router.post('/reset-stats', candidatePerformanceController.resetStats);

export default router;
