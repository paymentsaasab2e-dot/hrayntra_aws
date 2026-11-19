import { Router } from 'express';
import { TaskController } from './task.controller';
import { authMiddleware, authorize } from '../../shared/middleware/auth';
import { orgScopeMiddleware } from '../../shared/middleware/org-scope';

const router = Router();

router.use(authMiddleware, orgScopeMiddleware);

router.get('/', TaskController.getAll);
router.get('/employee/:employeeId', TaskController.getByEmployee);
router.get('/:id', TaskController.getById);
router.post('/self', TaskController.createSelf);
router.post('/', authorize(['ADMIN', 'HR', 'MANAGER']), TaskController.create);
router.put('/status/:id', TaskController.updateStatus);
router.put('/:id', TaskController.update);
router.delete('/:id', authorize(['ADMIN', 'HR', 'MANAGER']), TaskController.delete);

export default router;
