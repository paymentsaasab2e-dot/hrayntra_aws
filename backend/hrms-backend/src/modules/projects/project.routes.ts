import { Router } from 'express';
import { ProjectController } from './project.controller';
import { authMiddleware, authorize } from '../../shared/middleware/auth';
import { orgScopeMiddleware } from '../../shared/middleware/org-scope';

const router = Router();

router.use(authMiddleware, orgScopeMiddleware);

router.get('/', ProjectController.getAll);
router.get('/:id', ProjectController.getById);
router.post('/', authorize(['ADMIN', 'HR', 'MANAGER']), ProjectController.create);
router.put('/:id', authorize(['ADMIN', 'HR', 'MANAGER']), ProjectController.update);
router.delete('/:id', authorize(['ADMIN', 'HR', 'MANAGER']), ProjectController.delete);

export default router;
