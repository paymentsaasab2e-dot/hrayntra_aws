import { Router } from 'express';
import { PerformanceController } from './performance.controller';
import { authMiddleware, authorize } from '../../shared/middleware/auth';
import { orgScopeMiddleware } from '../../shared/middleware/org-scope';

const router = Router();

router.use(authMiddleware, orgScopeMiddleware);

router.get('/', PerformanceController.getAll);
router.get('/my', PerformanceController.getMyReviews);
router.get('/analytics', authorize(['ADMIN', 'HR', 'MANAGER']), PerformanceController.getAnalytics);
router.post('/compute', authorize(['ADMIN', 'HR', 'MANAGER']), PerformanceController.compute);
router.get('/:id', PerformanceController.getById);

router.patch('/:id/self-review', PerformanceController.submitSelfReview);

router.post('/', authorize(['ADMIN', 'HR', 'MANAGER']), PerformanceController.create);
router.put('/:id', authorize(['ADMIN', 'HR', 'MANAGER']), PerformanceController.update);
router.patch('/:id/manager-review', authorize(['ADMIN', 'HR', 'MANAGER']), PerformanceController.submitManagerReview);
router.post('/:id/refresh', authorize(['ADMIN', 'HR', 'MANAGER']), PerformanceController.refresh);
router.delete('/:id', authorize(['ADMIN', 'HR']), PerformanceController.delete);

export default router;
