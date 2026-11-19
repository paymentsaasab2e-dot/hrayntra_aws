"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlatformController = void 0;
const platform_service_1 = require("./platform.service");
class PlatformController {
    static async listPackages(_req, res) {
        try {
            res.status(200).json({ data: platform_service_1.PlatformService.listPackages() });
        }
        catch (error) {
            res.status(500).json({ message: error.message });
        }
    }
    static async getStats(req, res) {
        try {
            const filters = {
                minUsers: req.query.minUsers ? Number(req.query.minUsers) : undefined,
                maxUsers: req.query.maxUsers ? Number(req.query.maxUsers) : undefined,
                packageKey: req.query.packageKey ? String(req.query.packageKey) : undefined,
                status: req.query.status ? String(req.query.status) : undefined,
            };
            const data = await platform_service_1.PlatformService.getStatsSummary(filters);
            res.status(200).json({ data });
        }
        catch (error) {
            res.status(500).json({ message: error.message });
        }
    }
    static async listTenants(_req, res) {
        try {
            const data = await platform_service_1.PlatformService.listTenants();
            res.status(200).json({ data });
        }
        catch (error) {
            res.status(500).json({ message: error.message });
        }
    }
    static async getTenant(req, res) {
        try {
            const tenant = await platform_service_1.PlatformService.getTenant(String(req.params.id));
            res.status(200).json({ data: tenant });
        }
        catch (error) {
            res.status(error.message === 'Tenant not found' ? 404 : 500).json({ message: error.message });
        }
    }
    static async createTenant(req, res) {
        try {
            const tenant = await platform_service_1.PlatformService.createTenant(req.body);
            const email = tenant.email;
            const message = email?.sent
                ? 'Tenant created and welcome email sent to admin.'
                : email?.skipped
                    ? 'Tenant created (email skipped — configure RESEND_API_KEY).'
                    : tenant.tenantAdmin
                        ? `Tenant created (email failed: ${email?.message || 'unknown error'}).`
                        : 'Tenant created without admin account.';
            res.status(201).json({ success: true, message, data: tenant });
        }
        catch (error) {
            res.status(400).json({ message: error.message });
        }
    }
    static async getTenantCredentials(req, res) {
        try {
            const data = await platform_service_1.PlatformService.getTenantCredentials(String(req.params.id));
            res.status(200).json({ data });
        }
        catch (error) {
            res.status(error.message === 'Tenant not found' ? 404 : 500).json({ message: error.message });
        }
    }
    static async updateTenant(req, res) {
        try {
            const tenant = await platform_service_1.PlatformService.updateTenant(String(req.params.id), req.body);
            res.status(200).json({ success: true, data: tenant });
        }
        catch (error) {
            res.status(400).json({ message: error.message });
        }
    }
    static async updateTenantPackage(req, res) {
        try {
            const tenant = await platform_service_1.PlatformService.updateTenantPackage(String(req.params.id), req.body);
            res.status(200).json({ success: true, data: tenant });
        }
        catch (error) {
            res.status(400).json({ message: error.message });
        }
    }
    static async updateTenantAdmin(req, res) {
        try {
            const data = await platform_service_1.PlatformService.updateTenantAdmin(String(req.params.id), req.body);
            res.status(200).json({ success: true, data });
        }
        catch (error) {
            res.status(400).json({ message: error.message });
        }
    }
    static async deleteTenant(req, res) {
        try {
            await platform_service_1.PlatformService.deleteTenant(String(req.params.id));
            res.status(200).json({ success: true });
        }
        catch (error) {
            res.status(400).json({ message: error.message });
        }
    }
}
exports.PlatformController = PlatformController;
//# sourceMappingURL=platform.controller.js.map