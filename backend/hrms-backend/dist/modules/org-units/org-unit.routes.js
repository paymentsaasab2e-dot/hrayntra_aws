"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../../shared/middleware/auth");
const org_scope_1 = require("../../shared/middleware/org-scope");
const org_unit_controller_1 = require("./org-unit.controller");
const router = (0, express_1.Router)();
router.use(auth_1.authMiddleware, org_scope_1.orgScopeMiddleware);
router.get('/', org_unit_controller_1.OrgUnitController.getTree);
router.get('/:id', org_unit_controller_1.OrgUnitController.getById);
router.post('/', (0, auth_1.authorize)(['ADMIN', 'HR', 'MANAGER']), org_unit_controller_1.OrgUnitController.create);
router.put('/:id', (0, auth_1.authorize)(['ADMIN', 'HR', 'MANAGER']), org_unit_controller_1.OrgUnitController.update);
router.delete('/:id', (0, auth_1.authorize)(['ADMIN', 'HR']), org_unit_controller_1.OrgUnitController.delete);
router.post('/:id/approve', (0, auth_1.authorize)(['ADMIN', 'HR']), org_unit_controller_1.OrgUnitController.approve);
router.post('/:id/reject', (0, auth_1.authorize)(['ADMIN', 'HR']), org_unit_controller_1.OrgUnitController.reject);
exports.default = router;
//# sourceMappingURL=org-unit.routes.js.map