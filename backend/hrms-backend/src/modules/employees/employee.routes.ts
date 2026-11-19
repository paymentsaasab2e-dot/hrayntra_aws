import { Router } from 'express';
import { EmployeeController } from './employee.controller';
import { OrgChartController } from './org-chart/org-chart.controller';
import beneficiaryRoutes from './beneficiary/beneficiary.routes';
import { authMiddleware, authorize } from '../../shared/middleware/auth';
import { orgScopeMiddleware } from '../../shared/middleware/org-scope';

const router = Router();

router.use(authMiddleware, orgScopeMiddleware);

router.get('/', EmployeeController.getAll);

// Global change requests (HR / Admin queue)
router.get('/change-requests', authorize(['ADMIN', 'HR', 'MANAGER']), EmployeeController.getChangeRequests);
router.patch('/change-requests/:requestId/status', authorize(['ADMIN', 'HR']), EmployeeController.updateChangeRequestStatus);
router.get('/change-requests/:requestId', EmployeeController.getChangeRequestById);

// Employee-specific change requests & employment history
router.get('/:id/change-requests', EmployeeController.getChangeRequests);
router.post('/:id/change-requests', EmployeeController.submitChangeRequest);

router.get('/:id/history', EmployeeController.getEmploymentHistory);
router.post('/:id/history', authorize(['ADMIN', 'HR']), EmployeeController.addEmploymentHistoryMilestone);
router.delete('/:id/history/:historyId', authorize(['ADMIN', 'HR']), EmployeeController.deleteEmploymentHistoryMilestone);

// Beneficiaries, Dependents, Emergency Contacts & Nominees
router.use('/:employeeId/beneficiaries', beneficiaryRoutes);

// Org Chart & Reporting Tree
router.get('/org-chart/tree', OrgChartController.getReportingTree);

// Birthday & Work Anniversary Celebrations Directory & Wishes
router.get('/celebrations', OrgChartController.getCelebrations);
router.post('/celebrations/send-wishes', OrgChartController.sendCelebrationWish);
router.get('/celebrations/wishes', OrgChartController.getCelebrationWishes);

router.get('/:id', EmployeeController.getById);

// Only Admin and HR can create/update/delete employees
router.post('/', authorize(['ADMIN', 'HR']), EmployeeController.create);
router.put('/:id', authorize(['ADMIN', 'HR']), EmployeeController.update);
router.delete('/:id', authorize(['ADMIN', 'HR']), EmployeeController.delete);

export default router;
