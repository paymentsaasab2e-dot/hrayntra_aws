import { Router } from 'express';
import { CustomFieldController } from './custom-field.controller';
import { authMiddleware, authorize } from '../../shared/middleware/auth';
import { orgScopeMiddleware } from '../../shared/middleware/org-scope';

const router = Router();

router.use(authMiddleware, orgScopeMiddleware);

// List all field definitions for active tenant
router.get('/', CustomFieldController.list);

// Manage definitions (HR / Admin only)
router.post('/', authorize(['ADMIN', 'HR']), CustomFieldController.create);
router.put('/:id', authorize(['ADMIN', 'HR']), CustomFieldController.update);
router.delete('/:id', authorize(['ADMIN', 'HR']), CustomFieldController.delete);
router.post('/seed-defaults', authorize(['ADMIN', 'HR']), CustomFieldController.seedDefaults);

// Update custom field values for an employee
router.put('/employee/:employeeId', authorize(['ADMIN', 'HR']), CustomFieldController.updateEmployeeValues);

export default router;
