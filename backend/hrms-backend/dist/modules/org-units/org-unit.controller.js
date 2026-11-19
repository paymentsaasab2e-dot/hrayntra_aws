"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrgUnitController = void 0;
const org_unit_service_1 = require("./org-unit.service");
class OrgUnitController {
    static async getTree(req, res) {
        try {
            const tree = await org_unit_service_1.OrgUnitService.getTree(req.orgScope);
            res.status(200).json({ data: tree });
        }
        catch (error) {
            res.status(500).json({ message: error.message });
        }
    }
    static async getById(req, res) {
        try {
            const unit = await org_unit_service_1.OrgUnitService.getById(String(req.params.id), req.orgScope);
            res.status(200).json(unit);
        }
        catch (error) {
            res.status(error.message.includes('not found') ? 404 : 403).json({ message: error.message });
        }
    }
    static async create(req, res) {
        try {
            const user = req.user;
            const unit = await org_unit_service_1.OrgUnitService.create(req.body, user, req.orgScope);
            res.status(201).json(unit);
        }
        catch (error) {
            res.status(400).json({ message: error.message });
        }
    }
    static async update(req, res) {
        try {
            const unit = await org_unit_service_1.OrgUnitService.update(String(req.params.id), req.body, req.orgScope);
            res.status(200).json(unit);
        }
        catch (error) {
            res.status(400).json({ message: error.message });
        }
    }
    static async delete(req, res) {
        try {
            const user = req.user;
            await org_unit_service_1.OrgUnitService.delete(String(req.params.id), req.orgScope, user.role);
            res.status(204).send();
        }
        catch (error) {
            res.status(400).json({ message: error.message });
        }
    }
    static async approve(req, res) {
        try {
            const user = req.user;
            const unit = await org_unit_service_1.OrgUnitService.approvePending(String(req.params.id), user);
            res.status(200).json(unit);
        }
        catch (error) {
            res.status(400).json({ message: error.message });
        }
    }
    static async reject(req, res) {
        try {
            const user = req.user;
            await org_unit_service_1.OrgUnitService.rejectPending(String(req.params.id), user);
            res.status(200).json({ success: true });
        }
        catch (error) {
            res.status(400).json({ message: error.message });
        }
    }
}
exports.OrgUnitController = OrgUnitController;
//# sourceMappingURL=org-unit.controller.js.map