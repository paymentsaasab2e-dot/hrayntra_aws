import { Router } from 'express';
import { authMiddleware, authorize } from '../../shared/middleware/auth';
import { orgScopeMiddleware } from '../../shared/middleware/org-scope';
import { SeparationController } from './separation.controller';

const router = Router();

router.use(authMiddleware, orgScopeMiddleware);

router.get('/policy', SeparationController.getPolicy);
router.get('/mine', SeparationController.getMine);
router.post('/', SeparationController.create);
router.post('/:id/withdraw', SeparationController.withdraw);
router.get('/', authorize(['ADMIN', 'HR', 'MANAGER']), SeparationController.list);
router.get('/:id', authorize(['ADMIN', 'HR', 'MANAGER']), SeparationController.getById);
router.patch('/:id/checklist', authorize(['ADMIN', 'HR', 'MANAGER']), SeparationController.updateChecklist);
router.post('/:id/complete', authorize(['ADMIN', 'HR']), SeparationController.complete);

export default router;
