import { Router } from 'express';
import { authMiddleware, authorize } from '../../shared/middleware/auth';
import { orgScopeMiddleware } from '../../shared/middleware/org-scope';
import { OrgUnitController } from './org-unit.controller';

const router = Router();

router.use(authMiddleware, orgScopeMiddleware);

router.get('/', OrgUnitController.getTree);
router.get('/:id', OrgUnitController.getById);
router.post('/', authorize(['ADMIN', 'HR', 'MANAGER']), OrgUnitController.create);
router.put('/:id', authorize(['ADMIN', 'HR', 'MANAGER']), OrgUnitController.update);
router.delete('/:id', authorize(['ADMIN', 'HR']), OrgUnitController.delete);
router.post('/:id/approve', authorize(['ADMIN', 'HR']), OrgUnitController.approve);
router.post('/:id/reject', authorize(['ADMIN', 'HR']), OrgUnitController.reject);

export default router;
