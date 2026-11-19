import { Router } from 'express';
import { TrainingController } from './training.controller';
import { authMiddleware, authorize } from '../../shared/middleware/auth';
import { orgScopeMiddleware } from '../../shared/middleware/org-scope';

const router = Router();

router.use(authMiddleware, orgScopeMiddleware);

// Employee access: my training assignments and progress update
router.get('/my-assignments', TrainingController.getMyAssignments);
router.post('/assignments/:id/progress', TrainingController.updateProgress);

// Public / employee course view
router.get('/courses', TrainingController.listCourses);

// Admin & HR management & assignment
router.post('/seed-standards', authorize(['ADMIN', 'HR']), TrainingController.seedStandards);
router.post('/assign', authorize(['ADMIN', 'HR']), TrainingController.assignCourse);
router.get('/assignments', authorize(['ADMIN', 'HR', 'MANAGER']), TrainingController.listAllAssignments);
router.post('/reminders', authorize(['ADMIN', 'HR']), TrainingController.sendReminders);
router.get('/compliance-dashboard', authorize(['ADMIN', 'HR']), TrainingController.getComplianceDashboard);

export default router;
