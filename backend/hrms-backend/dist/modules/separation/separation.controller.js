"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SeparationController = void 0;
const resolve_tenant_1 = require("../../shared/tenant/resolve-tenant");
const separation_service_1 = require("./separation.service");
class SeparationController {
    static async getPolicy(req, res) {
        try {
            const user = req.user;
            const tenantId = await (0, resolve_tenant_1.resolveTenantId)(user);
            if (!tenantId)
                return res.status(400).json({ message: 'Tenant not found' });
            const data = await separation_service_1.SeparationService.getExitPolicy(tenantId);
            res.status(200).json({ data });
        }
        catch (error) {
            res.status(500).json({ message: error.message });
        }
    }
    static async getMine(req, res) {
        try {
            const user = req.user;
            const data = await separation_service_1.SeparationService.getMine(user.id);
            res.status(200).json({ data });
        }
        catch (error) {
            res.status(500).json({ message: error.message });
        }
    }
    static async list(req, res) {
        try {
            const user = req.user;
            const tenantId = await (0, resolve_tenant_1.resolveTenantId)(user);
            if (!tenantId)
                return res.status(400).json({ message: 'Tenant not found' });
            const scope = req.orgScope;
            const data = await separation_service_1.SeparationService.list(tenantId, scope?.scopedEmployeeIds ?? null);
            res.status(200).json({ data });
        }
        catch (error) {
            res.status(500).json({ message: error.message });
        }
    }
    static async getById(req, res) {
        try {
            const user = req.user;
            const tenantId = await (0, resolve_tenant_1.resolveTenantId)(user);
            if (!tenantId)
                return res.status(400).json({ message: 'Tenant not found' });
            const data = await separation_service_1.SeparationService.getById(String(req.params.id), tenantId);
            res.status(200).json({ data });
        }
        catch (error) {
            res.status(error.message === 'Separation request not found' ? 404 : 500).json({ message: error.message });
        }
    }
    static async create(req, res) {
        try {
            const user = req.user;
            const tenantId = await (0, resolve_tenant_1.resolveTenantId)(user);
            if (!tenantId)
                return res.status(400).json({ message: 'Tenant not found' });
            const data = await separation_service_1.SeparationService.createOrSubmit(user.id, tenantId, req.body);
            res.status(201).json({ success: true, data });
        }
        catch (error) {
            res.status(400).json({ message: error.message });
        }
    }
    static async withdraw(req, res) {
        try {
            const user = req.user;
            const tenantId = await (0, resolve_tenant_1.resolveTenantId)(user);
            if (!tenantId)
                return res.status(400).json({ message: 'Tenant not found' });
            const data = await separation_service_1.SeparationService.withdraw(String(req.params.id), user.id, tenantId);
            res.status(200).json({ success: true, data });
        }
        catch (error) {
            res.status(400).json({ message: error.message });
        }
    }
    static async updateChecklist(req, res) {
        try {
            const user = req.user;
            const tenantId = await (0, resolve_tenant_1.resolveTenantId)(user);
            if (!tenantId)
                return res.status(400).json({ message: 'Tenant not found' });
            const data = await separation_service_1.SeparationService.updateChecklist(String(req.params.id), tenantId, req.body.items || [], user.id);
            res.status(200).json({ success: true, data });
        }
        catch (error) {
            res.status(400).json({ message: error.message });
        }
    }
    static async complete(req, res) {
        try {
            const user = req.user;
            const tenantId = await (0, resolve_tenant_1.resolveTenantId)(user);
            if (!tenantId)
                return res.status(400).json({ message: 'Tenant not found' });
            const data = await separation_service_1.SeparationService.completeExit(String(req.params.id), tenantId);
            res.status(200).json({ success: true, data });
        }
        catch (error) {
            res.status(400).json({ message: error.message });
        }
    }
}
exports.SeparationController = SeparationController;
//# sourceMappingURL=separation.controller.js.map