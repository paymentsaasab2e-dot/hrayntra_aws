import { Router } from 'express';
import { OnboardingController } from './onboarding.controller';
import { authMiddleware, authorize } from '../../shared/middleware/auth';

const router = Router();

router.use(authMiddleware);

router.get('/', OnboardingController.getAll);
router.get('/:id', OnboardingController.getById);

// HR/Admin only
router.post('/bulk', authorize(['ADMIN', 'HR']), OnboardingController.bulkCreate);
router.post('/', authorize(['ADMIN', 'HR']), OnboardingController.create);
router.post('/:id/complete', authorize(['ADMIN', 'HR']), OnboardingController.complete);
router.put('/:id', authorize(['ADMIN', 'HR']), OnboardingController.update);
router.patch('/:id/task', authorize(['ADMIN', 'HR']), OnboardingController.updateTask);
router.delete('/:id', authorize(['ADMIN', 'HR']), OnboardingController.delete);

export default router;
