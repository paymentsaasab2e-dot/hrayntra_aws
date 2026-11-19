"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const document_controller_1 = require("./document.controller");
const auth_1 = require("../../shared/middleware/auth");
const org_scope_1 = require("../../shared/middleware/org-scope");
const router = (0, express_1.Router)();
router.use(auth_1.authMiddleware, org_scope_1.orgScopeMiddleware);
router.get('/', document_controller_1.DocumentController.getAll);
router.get('/:id', document_controller_1.DocumentController.getById);
router.post('/', document_controller_1.DocumentController.create);
router.put('/:id', document_controller_1.DocumentController.update);
router.patch('/:id/archive', document_controller_1.DocumentController.archive);
router.delete('/:id', (0, auth_1.authorize)(['ADMIN', 'HR']), document_controller_1.DocumentController.delete);
exports.default = router;
//# sourceMappingURL=document.routes.js.map