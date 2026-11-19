"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const asset_controller_1 = require("./asset.controller");
const auth_1 = require("../../shared/middleware/auth");
const org_scope_1 = require("../../shared/middleware/org-scope");
const router = (0, express_1.Router)();
router.use(auth_1.authMiddleware, org_scope_1.orgScopeMiddleware);
router.get('/', asset_controller_1.AssetController.getAll);
router.get('/allocations', asset_controller_1.AssetController.getAllocations);
router.get('/:id', asset_controller_1.AssetController.getById);
router.post('/', (0, auth_1.authorize)(['ADMIN', 'HR']), asset_controller_1.AssetController.create);
router.put('/:id', (0, auth_1.authorize)(['ADMIN', 'HR']), asset_controller_1.AssetController.update);
router.delete('/:id', (0, auth_1.authorize)(['ADMIN', 'HR']), asset_controller_1.AssetController.delete);
router.post('/assign', (0, auth_1.authorize)(['ADMIN', 'HR']), asset_controller_1.AssetController.assignAsset);
router.patch('/return/:id', (0, auth_1.authorize)(['ADMIN', 'HR']), asset_controller_1.AssetController.returnAsset);
exports.default = router;
//# sourceMappingURL=asset.routes.js.map