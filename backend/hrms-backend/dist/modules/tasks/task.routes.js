"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const task_controller_1 = require("./task.controller");
const auth_1 = require("../../shared/middleware/auth");
const org_scope_1 = require("../../shared/middleware/org-scope");
const router = (0, express_1.Router)();
router.use(auth_1.authMiddleware, org_scope_1.orgScopeMiddleware);
router.get('/', task_controller_1.TaskController.getAll);
router.get('/employee/:employeeId', task_controller_1.TaskController.getByEmployee);
router.get('/:id', task_controller_1.TaskController.getById);
router.post('/self', task_controller_1.TaskController.createSelf);
router.post('/', (0, auth_1.authorize)(['ADMIN', 'HR', 'MANAGER']), task_controller_1.TaskController.create);
router.put('/status/:id', task_controller_1.TaskController.updateStatus);
router.put('/:id', task_controller_1.TaskController.update);
router.delete('/:id', (0, auth_1.authorize)(['ADMIN', 'HR', 'MANAGER']), task_controller_1.TaskController.delete);
exports.default = router;
//# sourceMappingURL=task.routes.js.map