"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const location_controller_1 = require("./location.controller");
const auth_1 = require("../../shared/middleware/auth");
const org_scope_1 = require("../../shared/middleware/org-scope");
const router = (0, express_1.Router)();
router.use(auth_1.authMiddleware, org_scope_1.orgScopeMiddleware);
router.get('/', location_controller_1.LocationController.getAll);
router.get('/:id', location_controller_1.LocationController.getById);
router.post('/', (0, auth_1.authorize)(['ADMIN', 'HR']), location_controller_1.LocationController.create);
router.put('/:id', (0, auth_1.authorize)(['ADMIN', 'HR']), location_controller_1.LocationController.update);
router.delete('/:id', (0, auth_1.authorize)(['ADMIN', 'HR']), location_controller_1.LocationController.delete);
exports.default = router;
//# sourceMappingURL=location.routes.js.map