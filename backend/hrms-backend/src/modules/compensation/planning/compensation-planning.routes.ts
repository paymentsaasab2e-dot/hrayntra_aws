import { Router } from 'express';
import { CompensationPlanningController } from './compensation-planning.controller';
import { authMiddleware, authorize } from '../../../shared/middleware/auth';
import { orgScopeMiddleware } from '../../../shared/middleware/org-scope';

const router = Router();

router.use(authMiddleware, orgScopeMiddleware);

router.get('/cycles', authorize(['ADMIN', 'HR', 'MANAGER']), CompensationPlanningController.listCycles);
router.post('/cycles', authorize(['ADMIN', 'HR']), CompensationPlanningController.createCycle);
router.get('/cycles/:cycleId/dashboard', authorize(['ADMIN', 'HR', 'MANAGER']), CompensationPlanningController.getCycleDashboard);
router.post('/pools', authorize(['ADMIN', 'HR']), CompensationPlanningController.allocatePool);
router.post('/cycles/:cycleId/generate-recommendations', authorize(['ADMIN', 'HR']), CompensationPlanningController.generateRecommendations);
router.put('/recommendations/:id', authorize(['ADMIN', 'HR', 'MANAGER']), CompensationPlanningController.updateRecommendation);
router.post('/cycles/:cycleId/apply', authorize(['ADMIN', 'HR']), CompensationPlanningController.applyCycle);

export default router;
