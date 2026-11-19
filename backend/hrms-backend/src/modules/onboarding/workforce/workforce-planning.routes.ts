import { Router } from 'express';
import { WorkforcePlanningController } from './workforce-planning.controller';
import { authMiddleware, authorize } from '../../../shared/middleware/auth';
import { orgScopeMiddleware } from '../../../shared/middleware/org-scope';

const router = Router();

router.use(authMiddleware, orgScopeMiddleware);

// Headcount Budget vs Actual
router.get('/headcount-budget-vs-actual', authorize(['ADMIN', 'HR', 'MANAGER']), WorkforcePlanningController.getBudgetVsActual);
router.post('/headcount-plans/seed-standards', authorize(['ADMIN', 'HR']), WorkforcePlanningController.seedHeadcountPlans);
router.post('/headcount-plans', authorize(['ADMIN', 'HR']), WorkforcePlanningController.setHeadcountPlan);

// Job Requisitions & Headcount Governance
router.get('/requisitions', authorize(['ADMIN', 'HR', 'MANAGER']), WorkforcePlanningController.listRequisitions);
router.post('/requisitions', authorize(['ADMIN', 'HR', 'MANAGER']), WorkforcePlanningController.createRequisition);
router.post('/requisitions/:id/approve', authorize(['ADMIN', 'HR']), WorkforcePlanningController.approveRequisition);

export default router;
