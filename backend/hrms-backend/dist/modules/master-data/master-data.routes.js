"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const master_data_controller_1 = require("./master-data.controller");
const auth_1 = require("../../shared/middleware/auth");
const router = (0, express_1.Router)();
router.use(auth_1.authMiddleware);
// Read-only for all authenticated tenant users (needed for employee forms, filters, dropdowns)
router.get('/', master_data_controller_1.MasterDataController.getMasterData);
// Manage Master Data: HR, Admin, Superadmin, Platform Owner only
router.post('/departments', (0, auth_1.authorize)(['ADMIN', 'HR', 'PLATFORM_OWNER']), master_data_controller_1.MasterDataController.upsertDepartment);
router.delete('/departments/:id', (0, auth_1.authorize)(['ADMIN', 'HR', 'PLATFORM_OWNER']), master_data_controller_1.MasterDataController.deleteDepartment);
router.post('/designations', (0, auth_1.authorize)(['ADMIN', 'HR', 'PLATFORM_OWNER']), master_data_controller_1.MasterDataController.upsertDesignation);
router.delete('/designations/:id', (0, auth_1.authorize)(['ADMIN', 'HR', 'PLATFORM_OWNER']), master_data_controller_1.MasterDataController.deleteDesignation);
router.post('/grades', (0, auth_1.authorize)(['ADMIN', 'HR', 'PLATFORM_OWNER']), master_data_controller_1.MasterDataController.upsertGrade);
router.delete('/grades/:id', (0, auth_1.authorize)(['ADMIN', 'HR', 'PLATFORM_OWNER']), master_data_controller_1.MasterDataController.deleteGrade);
router.post('/cost-centres', (0, auth_1.authorize)(['ADMIN', 'HR', 'PLATFORM_OWNER']), master_data_controller_1.MasterDataController.upsertCostCentre);
router.delete('/cost-centres/:id', (0, auth_1.authorize)(['ADMIN', 'HR', 'PLATFORM_OWNER']), master_data_controller_1.MasterDataController.deleteCostCentre);
exports.default = router;
//# sourceMappingURL=master-data.routes.js.map