import { Router } from 'express';
import { FieldVisitController } from './field-visit.controller';
import { authMiddleware, authorize } from '../../shared/middleware/auth';
import { orgScopeMiddleware } from '../../shared/middleware/org-scope';

const router = Router();

router.use(authMiddleware, orgScopeMiddleware);

router.get('/locations', FieldVisitController.listVisitLocations);

router.get('/roster', FieldVisitController.listRoster);
router.post('/roster', authorize(['ADMIN', 'HR', 'MANAGER']), FieldVisitController.assignRoster);
router.delete('/roster/:id', authorize(['ADMIN', 'HR', 'MANAGER']), FieldVisitController.removeAssignment);
router.post('/roster/:id/verify', FieldVisitController.verifyVisit);
router.post('/roster/:id/missed', authorize(['ADMIN', 'HR', 'MANAGER']), FieldVisitController.markMissed);

router.get('/mine/today', FieldVisitController.getMineToday);
router.post('/ping', FieldVisitController.recordPing);
router.get('/live', FieldVisitController.getLive);

export default router;
