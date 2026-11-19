import { Router } from 'express';
import { TalentSuccessionController } from './talent-succession.controller';
import { authMiddleware, authorize } from '../../../shared/middleware/auth';
import { orgScopeMiddleware } from '../../../shared/middleware/org-scope';

const router = Router();

router.use(authMiddleware, orgScopeMiddleware);

// Skills & Competencies
router.get('/skills', TalentSuccessionController.listSkills);
router.post('/skills/seed-standards', authorize(['ADMIN', 'HR']), TalentSuccessionController.seedSkills);
router.get('/employees/:employeeId/skills', TalentSuccessionController.getEmployeeSkillMatrix);
router.post('/employees/:employeeId/skills', authorize(['ADMIN', 'HR', 'MANAGER']), TalentSuccessionController.recordSkillProficiency);

// 9-Box Grid & Talent Assessment
router.get('/nine-box', authorize(['ADMIN', 'HR', 'MANAGER']), TalentSuccessionController.getNineBoxMatrix);
router.post('/employees/:employeeId/assess', authorize(['ADMIN', 'HR', 'MANAGER']), TalentSuccessionController.assessTalent);

// Succession Planning
router.get('/plans', authorize(['ADMIN', 'HR', 'MANAGER']), TalentSuccessionController.listPlans);
router.post('/plans', authorize(['ADMIN', 'HR']), TalentSuccessionController.createPlan);
router.post('/plans/:planId/candidates', authorize(['ADMIN', 'HR', 'MANAGER']), TalentSuccessionController.addCandidate);

export default router;
