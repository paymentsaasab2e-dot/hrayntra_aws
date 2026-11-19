"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../../shared/middleware/auth");
const platform_controller_1 = require("./platform.controller");
const router = (0, express_1.Router)();
function platformOnly(req, res, next) {
    const role = req.user?.role;
    if (role !== 'PLATFORM_OWNER') {
        return res.status(403).json({ message: 'Platform owner access required' });
    }
    next();
}
router.use(auth_1.authMiddleware, platformOnly);
router.get('/packages', platform_controller_1.PlatformController.listPackages);
router.get('/stats', platform_controller_1.PlatformController.getStats);
router.get('/tenants', platform_controller_1.PlatformController.listTenants);
router.get('/tenants/:id', platform_controller_1.PlatformController.getTenant);
router.get('/tenants/:id/credentials', platform_controller_1.PlatformController.getTenantCredentials);
router.post('/tenants', platform_controller_1.PlatformController.createTenant);
router.patch('/tenants/:id', platform_controller_1.PlatformController.updateTenant);
router.patch('/tenants/:id/admin', platform_controller_1.PlatformController.updateTenantAdmin);
router.patch('/tenants/:id/package', platform_controller_1.PlatformController.updateTenantPackage);
router.delete('/tenants/:id', platform_controller_1.PlatformController.deleteTenant);
exports.default = router;
//# sourceMappingURL=platform.routes.js.map