"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const project_controller_1 = require("./project.controller");
const auth_1 = require("../../shared/middleware/auth");
const org_scope_1 = require("../../shared/middleware/org-scope");
const router = (0, express_1.Router)();
router.use(auth_1.authMiddleware, org_scope_1.orgScopeMiddleware);
router.get('/', project_controller_1.ProjectController.getAll);
router.get('/:id', project_controller_1.ProjectController.getById);
router.post('/', (0, auth_1.authorize)(['ADMIN', 'HR', 'MANAGER']), project_controller_1.ProjectController.create);
router.put('/:id', (0, auth_1.authorize)(['ADMIN', 'HR', 'MANAGER']), project_controller_1.ProjectController.update);
router.delete('/:id', (0, auth_1.authorize)(['ADMIN', 'HR', 'MANAGER']), project_controller_1.ProjectController.delete);
exports.default = router;
//# sourceMappingURL=project.routes.js.map