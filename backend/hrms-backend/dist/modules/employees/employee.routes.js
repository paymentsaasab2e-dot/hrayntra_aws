"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const employee_controller_1 = require("./employee.controller");
const auth_1 = require("../../shared/middleware/auth");
const org_scope_1 = require("../../shared/middleware/org-scope");
const router = (0, express_1.Router)();
router.use(auth_1.authMiddleware, org_scope_1.orgScopeMiddleware);
router.get('/', employee_controller_1.EmployeeController.getAll);
// Global change requests (HR / Admin queue)
router.get('/change-requests', (0, auth_1.authorize)(['ADMIN', 'HR', 'MANAGER']), employee_controller_1.EmployeeController.getChangeRequests);
router.patch('/change-requests/:requestId/status', (0, auth_1.authorize)(['ADMIN', 'HR']), employee_controller_1.EmployeeController.updateChangeRequestStatus);
router.get('/change-requests/:requestId', employee_controller_1.EmployeeController.getChangeRequestById);
// Employee-specific change requests & employment history
router.get('/:id/change-requests', employee_controller_1.EmployeeController.getChangeRequests);
router.post('/:id/change-requests', employee_controller_1.EmployeeController.submitChangeRequest);
router.get('/:id/history', employee_controller_1.EmployeeController.getEmploymentHistory);
router.post('/:id/history', (0, auth_1.authorize)(['ADMIN', 'HR']), employee_controller_1.EmployeeController.addEmploymentHistoryMilestone);
router.delete('/:id/history/:historyId', (0, auth_1.authorize)(['ADMIN', 'HR']), employee_controller_1.EmployeeController.deleteEmploymentHistoryMilestone);
router.get('/:id', employee_controller_1.EmployeeController.getById);
// Only Admin and HR can create/update/delete employees
router.post('/', (0, auth_1.authorize)(['ADMIN', 'HR']), employee_controller_1.EmployeeController.create);
router.put('/:id', (0, auth_1.authorize)(['ADMIN', 'HR']), employee_controller_1.EmployeeController.update);
router.delete('/:id', (0, auth_1.authorize)(['ADMIN', 'HR']), employee_controller_1.EmployeeController.delete);
exports.default = router;
//# sourceMappingURL=employee.routes.js.map