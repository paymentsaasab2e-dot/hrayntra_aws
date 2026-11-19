"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const user_controller_1 = require("./user.controller");
const auth_1 = require("../../shared/middleware/auth");
const org_scope_1 = require("../../shared/middleware/org-scope");
const router = (0, express_1.Router)();
router.use(auth_1.authMiddleware, org_scope_1.orgScopeMiddleware);
router.use((0, auth_1.authorize)(['ADMIN']));
router.get('/', user_controller_1.UserController.getAll);
router.post('/', user_controller_1.UserController.create);
router.put('/:id', user_controller_1.UserController.update);
router.delete('/:id', user_controller_1.UserController.delete);
exports.default = router;
//# sourceMappingURL=user.routes.js.map