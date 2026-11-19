"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OnboardingController = void 0;
const resolve_tenant_1 = require("../../shared/tenant/resolve-tenant");
const onboarding_service_1 = require("./onboarding.service");
class OnboardingController {
    static async getAll(req, res) {
        try {
            const user = req.user;
            const tenantId = await (0, resolve_tenant_1.resolveTenantId)(user);
            const filters = {};
            if (req.query.status)
                filters.status = req.query.status;
            const hires = await onboarding_service_1.OnboardingService.getAll(filters, tenantId);
            res.status(200).json({ success: true, data: hires });
        }
        catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    }
    static async getById(req, res) {
        try {
            const user = req.user;
            const tenantId = await (0, resolve_tenant_1.resolveTenantId)(user);
            const hire = await onboarding_service_1.OnboardingService.getById(String(req.params.id), tenantId);
            if (!hire)
                return res.status(404).json({ success: false, message: 'Onboarding hire not found' });
            res.status(200).json({ success: true, data: hire });
        }
        catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    }
    static async create(req, res) {
        try {
            const user = req.user;
            const tenantId = await (0, resolve_tenant_1.resolveTenantId)(user);
            const hire = await onboarding_service_1.OnboardingService.create(req.body, tenantId);
            res.status(201).json({ success: true, data: hire });
        }
        catch (error) {
            res.status(400).json({ success: false, message: error.message });
        }
    }
    static async bulkCreate(req, res) {
        try {
            const user = req.user;
            const tenantId = await (0, resolve_tenant_1.resolveTenantId)(user);
            const candidates = Array.isArray(req.body.candidates) ? req.body.candidates : [];
            if (!candidates.length) {
                return res.status(400).json({ success: false, message: 'No candidates provided' });
            }
            const source = req.body.source || 'BULK_IMPORT';
            const hires = await onboarding_service_1.OnboardingService.bulkCreate(candidates, tenantId, source);
            res.status(201).json({ success: true, data: hires });
        }
        catch (error) {
            res.status(400).json({ success: false, message: error.message });
        }
    }
    static async update(req, res) {
        try {
            const user = req.user;
            const tenantId = await (0, resolve_tenant_1.resolveTenantId)(user);
            const hire = await onboarding_service_1.OnboardingService.update(String(req.params.id), req.body, tenantId);
            res.status(200).json({ success: true, data: hire });
        }
        catch (error) {
            res.status(400).json({ success: false, message: error.message });
        }
    }
    static async updateTask(req, res) {
        try {
            const user = req.user;
            const tenantId = await (0, resolve_tenant_1.resolveTenantId)(user);
            const { taskLabel, done } = req.body;
            const hire = await onboarding_service_1.OnboardingService.updateTask(String(req.params.id), taskLabel, done, tenantId);
            res.status(200).json({ success: true, data: hire });
        }
        catch (error) {
            res.status(400).json({ success: false, message: error.message });
        }
    }
    static async complete(req, res) {
        try {
            const user = req.user;
            const tenantId = await (0, resolve_tenant_1.resolveTenantId)(user);
            const result = await onboarding_service_1.OnboardingService.complete(String(req.params.id), tenantId, req.body);
            res.status(200).json({ success: true, data: result.hire, graduation: result });
        }
        catch (error) {
            res.status(400).json({ success: false, message: error.message });
        }
    }
    static async delete(req, res) {
        try {
            const user = req.user;
            const tenantId = await (0, resolve_tenant_1.resolveTenantId)(user);
            await onboarding_service_1.OnboardingService.delete(String(req.params.id), tenantId);
            res.status(200).json({ success: true, message: 'Onboarding hire deleted' });
        }
        catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    }
}
exports.OnboardingController = OnboardingController;
//# sourceMappingURL=onboarding.controller.js.map