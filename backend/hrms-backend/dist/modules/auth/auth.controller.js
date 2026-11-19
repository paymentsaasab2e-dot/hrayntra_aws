"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthController = void 0;
const auth_service_1 = require("./auth.service");
class AuthController {
    static async login(req, res) {
        try {
            const { email, password } = req.body;
            const result = await auth_service_1.AuthService.login(email, password);
            res.status(200).json(result);
        }
        catch (error) {
            res.status(401).json({ message: error.message });
        }
    }
    static async register(req, res) {
        try {
            const user = await auth_service_1.AuthService.register(req.body);
            res.status(201).json(user);
        }
        catch (error) {
            res.status(400).json({ message: error.message });
        }
    }
    static async getProfile(req, res) {
        try {
            // @ts-ignore - userId will be attached by auth middleware
            const userId = req.user.id;
            const profile = await auth_service_1.AuthService.getProfile(userId);
            res.status(200).json({ success: true, user: profile });
        }
        catch (error) {
            res.status(404).json({ message: error.message });
        }
    }
}
exports.AuthController = AuthController;
//# sourceMappingURL=auth.controller.js.map