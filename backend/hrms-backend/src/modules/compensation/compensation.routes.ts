import { Router } from 'express';
import { authMiddleware, authorize } from '../../shared/middleware/auth';
import { CompensationController } from './compensation.controller';

const router = Router();

router.use(authMiddleware);

router.get('/profiles', CompensationController.listProfiles);
router.get('/profiles/match', CompensationController.matchProfile);
router.get('/profiles/:id', CompensationController.getProfile);
router.post('/profiles', authorize(['ADMIN', 'HR']), CompensationController.createProfile);
router.put('/profiles/:id', authorize(['ADMIN', 'HR']), CompensationController.updateProfile);
router.delete('/profiles/:id', authorize(['ADMIN', 'HR']), CompensationController.deleteProfile);

router.post('/calculate', CompensationController.calculate);

router.get('/employee/:employeeId', CompensationController.getEmployeeCompensation);
router.put('/employee/:employeeId', authorize(['ADMIN', 'HR']), CompensationController.upsertEmployeeCompensation);

router.get('/onboarding/:onboardingId', CompensationController.getOnboardingCompensation);
router.put('/onboarding/:onboardingId', authorize(['ADMIN', 'HR']), CompensationController.upsertOnboardingCompensation);

export default router;
