"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../../shared/middleware/auth");
const org_scope_1 = require("../../shared/middleware/org-scope");
const separation_controller_1 = require("./separation.controller");
const router = (0, express_1.Router)();
router.use(auth_1.authMiddleware, org_scope_1.orgScopeMiddleware);
router.get('/policy', separation_controller_1.SeparationController.getPolicy);
router.get('/mine', separation_controller_1.SeparationController.getMine);
router.post('/', separation_controller_1.SeparationController.create);
router.post('/:id/withdraw', separation_controller_1.SeparationController.withdraw);
router.get('/', (0, auth_1.authorize)(['ADMIN', 'HR', 'MANAGER']), separation_controller_1.SeparationController.list);
router.get('/:id', (0, auth_1.authorize)(['ADMIN', 'HR', 'MANAGER']), separation_controller_1.SeparationController.getById);
router.patch('/:id/checklist', (0, auth_1.authorize)(['ADMIN', 'HR', 'MANAGER']), separation_controller_1.SeparationController.updateChecklist);
router.post('/:id/complete', (0, auth_1.authorize)(['ADMIN', 'HR']), separation_controller_1.SeparationController.complete);
exports.default = router;
//# sourceMappingURL=separation.routes.js.map