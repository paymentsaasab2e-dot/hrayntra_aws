"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserController = void 0;
const user_service_1 = require("./user.service");
class UserController {
    static async getAll(req, res) {
        try {
            const users = await user_service_1.UserService.getAll(req.orgScope);
            res.status(200).json({ success: true, data: users });
        }
        catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    }
    static async create(req, res) {
        try {
            const result = await user_service_1.UserService.create(req.body, req.orgScope?.tenantId);
            res.status(201).json({
                success: true,
                data: result.user,
                employee: result.employee,
                onboarding: result.onboarding,
                email: result.email,
                message: result.email.sent
                    ? 'User created — employee, onboarding, and welcome email sent'
                    : result.email.skipped
                        ? 'User created with employee and onboarding (email skipped — check RESEND_API_KEY)'
                        : `User created with employee and onboarding (email failed: ${result.email.message})`,
            });
        }
        catch (error) {
            res.status(400).json({ success: false, message: error.message });
        }
    }
    static async update(req, res) {
        try {
            const id = String(req.params.id);
            const user = await user_service_1.UserService.update(id, req.body, req.orgScope?.tenantId);
            res.status(200).json({ success: true, data: user });
        }
        catch (error) {
            res.status(400).json({ success: false, message: error.message });
        }
    }
    static async delete(req, res) {
        try {
            const id = String(req.params.id);
            await user_service_1.UserService.delete(id, req.orgScope?.tenantId);
            res.status(200).json({ success: true });
        }
        catch (error) {
            res.status(400).json({ success: false, message: error.message });
        }
    }
}
exports.UserController = UserController;
//# sourceMappingURL=user.controller.js.map