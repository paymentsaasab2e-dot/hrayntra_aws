"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MasterDataController = void 0;
const resolve_tenant_1 = require("../../shared/tenant/resolve-tenant");
const master_data_service_1 = require("./master-data.service");
class MasterDataController {
    static async getMasterData(req, res) {
        try {
            const user = req.user;
            const tenantId = await (0, resolve_tenant_1.resolveTenantId)(user);
            if (!tenantId) {
                return res.status(400).json({ success: false, message: 'Tenant context required' });
            }
            const data = await master_data_service_1.MasterDataService.getMasterData(tenantId);
            res.status(200).json({ success: true, data });
        }
        catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    }
    // ── Departments ──
    static async upsertDepartment(req, res) {
        try {
            const user = req.user;
            const tenantId = await (0, resolve_tenant_1.resolveTenantId)(user);
            if (!tenantId) {
                return res.status(400).json({ success: false, message: 'Tenant context required' });
            }
            const data = await master_data_service_1.MasterDataService.upsertDepartment(tenantId, user.id, req.body);
            res.status(200).json({ success: true, data, message: 'Department saved successfully' });
        }
        catch (error) {
            res.status(400).json({ success: false, message: error.message });
        }
    }
    static async deleteDepartment(req, res) {
        try {
            const user = req.user;
            const tenantId = await (0, resolve_tenant_1.resolveTenantId)(user);
            if (!tenantId) {
                return res.status(400).json({ success: false, message: 'Tenant context required' });
            }
            const data = await master_data_service_1.MasterDataService.deleteDepartment(tenantId, user.id, String(req.params.id));
            res.status(200).json({ success: true, data, message: 'Department removed successfully' });
        }
        catch (error) {
            res.status(400).json({ success: false, message: error.message });
        }
    }
    // ── Designations ──
    static async upsertDesignation(req, res) {
        try {
            const user = req.user;
            const tenantId = await (0, resolve_tenant_1.resolveTenantId)(user);
            if (!tenantId) {
                return res.status(400).json({ success: false, message: 'Tenant context required' });
            }
            const data = await master_data_service_1.MasterDataService.upsertDesignation(tenantId, user.id, req.body);
            res.status(200).json({ success: true, data, message: 'Designation saved successfully' });
        }
        catch (error) {
            res.status(400).json({ success: false, message: error.message });
        }
    }
    static async deleteDesignation(req, res) {
        try {
            const user = req.user;
            const tenantId = await (0, resolve_tenant_1.resolveTenantId)(user);
            if (!tenantId) {
                return res.status(400).json({ success: false, message: 'Tenant context required' });
            }
            const data = await master_data_service_1.MasterDataService.deleteDesignation(tenantId, user.id, String(req.params.id));
            res.status(200).json({ success: true, data, message: 'Designation removed successfully' });
        }
        catch (error) {
            res.status(400).json({ success: false, message: error.message });
        }
    }
    // ── Grades ──
    static async upsertGrade(req, res) {
        try {
            const user = req.user;
            const tenantId = await (0, resolve_tenant_1.resolveTenantId)(user);
            if (!tenantId) {
                return res.status(400).json({ success: false, message: 'Tenant context required' });
            }
            const data = await master_data_service_1.MasterDataService.upsertGrade(tenantId, user.id, req.body);
            res.status(200).json({ success: true, data, message: 'Grade saved successfully' });
        }
        catch (error) {
            res.status(400).json({ success: false, message: error.message });
        }
    }
    static async deleteGrade(req, res) {
        try {
            const user = req.user;
            const tenantId = await (0, resolve_tenant_1.resolveTenantId)(user);
            if (!tenantId) {
                return res.status(400).json({ success: false, message: 'Tenant context required' });
            }
            const data = await master_data_service_1.MasterDataService.deleteGrade(tenantId, user.id, String(req.params.id));
            res.status(200).json({ success: true, data, message: 'Grade removed successfully' });
        }
        catch (error) {
            res.status(400).json({ success: false, message: error.message });
        }
    }
    // ── Cost Centres ──
    static async upsertCostCentre(req, res) {
        try {
            const user = req.user;
            const tenantId = await (0, resolve_tenant_1.resolveTenantId)(user);
            if (!tenantId) {
                return res.status(400).json({ success: false, message: 'Tenant context required' });
            }
            const data = await master_data_service_1.MasterDataService.upsertCostCentre(tenantId, user.id, req.body);
            res.status(200).json({ success: true, data, message: 'Cost Centre saved successfully' });
        }
        catch (error) {
            res.status(400).json({ success: false, message: error.message });
        }
    }
    static async deleteCostCentre(req, res) {
        try {
            const user = req.user;
            const tenantId = await (0, resolve_tenant_1.resolveTenantId)(user);
            if (!tenantId) {
                return res.status(400).json({ success: false, message: 'Tenant context required' });
            }
            const data = await master_data_service_1.MasterDataService.deleteCostCentre(tenantId, user.id, String(req.params.id));
            res.status(200).json({ success: true, data, message: 'Cost Centre removed successfully' });
        }
        catch (error) {
            res.status(400).json({ success: false, message: error.message });
        }
    }
}
exports.MasterDataController = MasterDataController;
//# sourceMappingURL=master-data.controller.js.map