"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PolicyController = void 0;
const resolve_tenant_1 = require("../../shared/tenant/resolve-tenant");
const policy_service_1 = require("./policy.service");
class PolicyController {
    static async list(req, res) {
        try {
            const user = req.user;
            const tenantId = await (0, resolve_tenant_1.resolveTenantId)(user);
            if (!tenantId)
                return res.status(400).json({ message: 'Tenant not found' });
            const data = await policy_service_1.PolicyService.listDocuments(tenantId);
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
            const data = await policy_service_1.PolicyService.getDocument(String(req.params.id), tenantId);
            res.status(200).json({ data });
        }
        catch (error) {
            res.status(error.message === 'Policy document not found' ? 404 : 500).json({ message: error.message });
        }
    }
    static async upload(req, res) {
        try {
            const user = req.user;
            const tenantId = await (0, resolve_tenant_1.resolveTenantId)(user);
            if (!tenantId)
                return res.status(400).json({ message: 'Tenant not found' });
            const title = String(req.body.title || 'Leave & Attendance Policy');
            const data = await policy_service_1.PolicyService.createFromUpload(tenantId, user.id, {
                title,
                file: req.file,
            });
            res.status(201).json({ success: true, data });
        }
        catch (error) {
            res.status(400).json({ message: error.message });
        }
    }
    static async createManual(req, res) {
        try {
            const user = req.user;
            const tenantId = await (0, resolve_tenant_1.resolveTenantId)(user);
            if (!tenantId)
                return res.status(400).json({ message: 'Tenant not found' });
            const data = await policy_service_1.PolicyService.createManual(tenantId, user.id, req.body.title || 'Leave & Attendance Policy');
            res.status(201).json({ success: true, data });
        }
        catch (error) {
            res.status(400).json({ message: error.message });
        }
    }
    static async updateRules(req, res) {
        try {
            const user = req.user;
            const tenantId = await (0, resolve_tenant_1.resolveTenantId)(user);
            if (!tenantId)
                return res.status(400).json({ message: 'Tenant not found' });
            const data = await policy_service_1.PolicyService.updateDraftRules(String(req.params.id), tenantId, req.body.rules || req.body);
            res.status(200).json({ success: true, data });
        }
        catch (error) {
            res.status(400).json({ message: error.message });
        }
    }
    static async publish(req, res) {
        try {
            const user = req.user;
            const tenantId = await (0, resolve_tenant_1.resolveTenantId)(user);
            if (!tenantId)
                return res.status(400).json({ message: 'Tenant not found' });
            const data = await policy_service_1.PolicyService.publish(String(req.params.id), tenantId, user.id);
            res.status(200).json({ success: true, data });
        }
        catch (error) {
            res.status(400).json({ message: error.message });
        }
    }
    static async getActive(req, res) {
        try {
            const user = req.user;
            const tenantId = await (0, resolve_tenant_1.resolveTenantId)(user);
            if (!tenantId)
                return res.status(400).json({ message: 'Tenant not found' });
            const data = await policy_service_1.PolicyService.getActive(tenantId);
            res.status(200).json({ data });
        }
        catch (error) {
            res.status(500).json({ message: error.message });
        }
    }
    static async updateActive(req, res) {
        try {
            const user = req.user;
            const tenantId = await (0, resolve_tenant_1.resolveTenantId)(user);
            if (!tenantId)
                return res.status(400).json({ message: 'Tenant not found' });
            const data = await policy_service_1.PolicyService.updateActiveRules(tenantId, user.id, req.body.rules || req.body);
            res.status(200).json({ success: true, data });
        }
        catch (error) {
            res.status(400).json({ message: error.message });
        }
    }
    static async acknowledge(req, res) {
        try {
            const user = req.user;
            const data = await policy_service_1.PolicyService.acknowledge(String(req.params.versionId), user.id);
            res.status(200).json({ success: true, data });
        }
        catch (error) {
            res.status(400).json({ message: error.message });
        }
    }
}
exports.PolicyController = PolicyController;
//# sourceMappingURL=policy.controller.js.map