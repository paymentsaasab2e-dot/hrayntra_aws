"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../../shared/middleware/auth");
const org_scope_1 = require("../../shared/middleware/org-scope");
const approval_controller_1 = require("./approval.controller");
const router = (0, express_1.Router)();
router.use(auth_1.authMiddleware, org_scope_1.orgScopeMiddleware);
router.get('/inbox', (0, auth_1.authorize)(['ADMIN', 'HR', 'MANAGER']), approval_controller_1.ApprovalController.getInbox);
router.post('/:id/act', (0, auth_1.authorize)(['ADMIN', 'HR', 'MANAGER']), approval_controller_1.ApprovalController.act);
exports.default = router;
//# sourceMappingURL=approval.routes.js.map