"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CompensationController = void 0;
const resolve_tenant_1 = require("../../shared/tenant/resolve-tenant");
const compensation_service_1 = require("./compensation.service");
class CompensationController {
    static async listProfiles(req, res) {
        try {
            const user = req.user;
            const tenantId = await (0, resolve_tenant_1.resolveTenantId)(user);
            if (!tenantId)
                return res.status(400).json({ message: 'Tenant not found' });
            const data = await compensation_service_1.CompensationService.listProfiles(tenantId, {
                country: req.query.country ? String(req.query.country) : undefined,
            });
            res.status(200).json({ success: true, data });
        }
        catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    }
    static async matchProfile(req, res) {
        try {
            const user = req.user;
            const tenantId = await (0, resolve_tenant_1.resolveTenantId)(user);
            if (!tenantId)
                return res.status(400).json({ message: 'Tenant not found' });
            const data = await compensation_service_1.CompensationService.matchProfile(tenantId, {
                country: req.query.country ? String(req.query.country) : undefined,
                region: req.query.region ? String(req.query.region) : undefined,
                city: req.query.city ? String(req.query.city) : undefined,
                locality: req.query.locality ? String(req.query.locality) : undefined,
            });
            res.status(200).json({ success: true, data });
        }
        catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    }
    static async getProfile(req, res) {
        try {
            const user = req.user;
            const tenantId = await (0, resolve_tenant_1.resolveTenantId)(user);
            if (!tenantId)
                return res.status(400).json({ message: 'Tenant not found' });
            const data = await compensation_service_1.CompensationService.getProfile(String(req.params.id), tenantId);
            res.status(200).json({ success: true, data });
        }
        catch (error) {
            res.status(error.message === 'Compliance profile not found' ? 404 : 500).json({ success: false, message: error.message });
        }
    }
    static async createProfile(req, res) {
        try {
            const user = req.user;
            const tenantId = await (0, resolve_tenant_1.resolveTenantId)(user);
            if (!tenantId)
                return res.status(400).json({ message: 'Tenant not found' });
            const data = await compensation_service_1.CompensationService.createProfile(tenantId, req.body);
            res.status(201).json({ success: true, data });
        }
        catch (error) {
            res.status(400).json({ success: false, message: error.message });
        }
    }
    static async updateProfile(req, res) {
        try {
            const user = req.user;
            const tenantId = await (0, resolve_tenant_1.resolveTenantId)(user);
            if (!tenantId)
                return res.status(400).json({ message: 'Tenant not found' });
            const data = await compensation_service_1.CompensationService.updateProfile(String(req.params.id), tenantId, req.body);
            res.status(200).json({ success: true, data });
        }
        catch (error) {
            res.status(400).json({ success: false, message: error.message });
        }
    }
    static async deleteProfile(req, res) {
        try {
            const user = req.user;
            const tenantId = await (0, resolve_tenant_1.resolveTenantId)(user);
            if (!tenantId)
                return res.status(400).json({ message: 'Tenant not found' });
            await compensation_service_1.CompensationService.deleteProfile(String(req.params.id), tenantId);
            res.status(200).json({ success: true, message: 'Profile deleted' });
        }
        catch (error) {
            res.status(400).json({ success: false, message: error.message });
        }
    }
    static async calculate(req, res) {
        try {
            const data = compensation_service_1.CompensationService.preview(req.body);
            res.status(200).json({ success: true, data });
        }
        catch (error) {
            res.status(400).json({ success: false, message: error.message });
        }
    }
    static async getEmployeeCompensation(req, res) {
        try {
            const user = req.user;
            const tenantId = await (0, resolve_tenant_1.resolveTenantId)(user);
            if (!tenantId)
                return res.status(400).json({ message: 'Tenant not found' });
            const data = await compensation_service_1.CompensationService.getEmployeeCompensation(String(req.params.employeeId), tenantId);
            res.status(200).json({ success: true, data });
        }
        catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    }
    static async upsertEmployeeCompensation(req, res) {
        try {
            const user = req.user;
            const tenantId = await (0, resolve_tenant_1.resolveTenantId)(user);
            if (!tenantId)
                return res.status(400).json({ message: 'Tenant not found' });
            const data = await compensation_service_1.CompensationService.upsertCompensation(tenantId, {
                ...req.body,
                employeeId: String(req.params.employeeId),
            });
            res.status(200).json({ success: true, data });
        }
        catch (error) {
            res.status(400).json({ success: false, message: error.message });
        }
    }
    static async getOnboardingCompensation(req, res) {
        try {
            const user = req.user;
            const tenantId = await (0, resolve_tenant_1.resolveTenantId)(user);
            if (!tenantId)
                return res.status(400).json({ message: 'Tenant not found' });
            const data = await compensation_service_1.CompensationService.getOnboardingCompensation(String(req.params.onboardingId), tenantId);
            res.status(200).json({ success: true, data });
        }
        catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    }
    static async upsertOnboardingCompensation(req, res) {
        try {
            const user = req.user;
            const tenantId = await (0, resolve_tenant_1.resolveTenantId)(user);
            if (!tenantId)
                return res.status(400).json({ message: 'Tenant not found' });
            const data = await compensation_service_1.CompensationService.upsertCompensation(tenantId, {
                ...req.body,
                onboardingHireId: String(req.params.onboardingId),
            });
            res.status(200).json({ success: true, data });
        }
        catch (error) {
            res.status(400).json({ success: false, message: error.message });
        }
    }
}
exports.CompensationController = CompensationController;
//# sourceMappingURL=compensation.controller.js.map