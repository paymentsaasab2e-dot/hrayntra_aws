"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FieldVisitController = void 0;
const field_visit_service_1 = require("./field-visit.service");
function localDateKey(d = new Date()) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}
class FieldVisitController {
    static async listVisitLocations(req, res) {
        try {
            const activeOnly = req.query.activeOnly === 'true';
            const data = await field_visit_service_1.FieldVisitService.listVisitLocations(activeOnly);
            res.status(200).json({ data });
        }
        catch (error) {
            res.status(500).json({ message: error.message });
        }
    }
    static async listRoster(req, res) {
        try {
            const dateKey = String(req.query.date || localDateKey());
            const employeeId = req.query.employeeId ? String(req.query.employeeId) : undefined;
            const scope = req.orgScope;
            const data = await field_visit_service_1.FieldVisitService.listRoster(dateKey, scope?.scopedEmployeeIds ?? null, employeeId);
            res.status(200).json({ data });
        }
        catch (error) {
            res.status(400).json({ message: error.message });
        }
    }
    static async assignRoster(req, res) {
        try {
            const body = req.body;
            const data = await field_visit_service_1.FieldVisitService.assignRoster({
                dateKey: body.dateKey,
                employeeId: body.employeeId,
                locationIds: body.locationIds || body.stopIds || [],
                plannedTimes: body.plannedTimes,
            });
            res.status(201).json({ success: true, data });
        }
        catch (error) {
            res.status(400).json({ message: error.message });
        }
    }
    static async removeAssignment(req, res) {
        try {
            await field_visit_service_1.FieldVisitService.removeAssignment(String(req.params.id));
            res.status(200).json({ success: true });
        }
        catch (error) {
            res.status(400).json({ message: error.message });
        }
    }
    static async getMineToday(req, res) {
        try {
            const user = req.user;
            const data = await field_visit_service_1.FieldVisitService.getMineToday(user.id);
            res.status(200).json({ data });
        }
        catch (error) {
            res.status(500).json({ message: error.message });
        }
    }
    static async verifyVisit(req, res) {
        try {
            const user = req.user;
            const isHr = ['ADMIN', 'HR', 'MANAGER'].includes(user.role);
            const { lat, lng } = req.body;
            const data = await field_visit_service_1.FieldVisitService.verifyVisit(String(req.params.id), user.id, lat, lng, isHr && req.body.hrOverride === true);
            res.status(200).json({ success: true, data });
        }
        catch (error) {
            res.status(400).json({ message: error.message });
        }
    }
    static async markMissed(req, res) {
        try {
            const data = await field_visit_service_1.FieldVisitService.markMissed(String(req.params.id));
            res.status(200).json({ success: true, data });
        }
        catch (error) {
            res.status(400).json({ message: error.message });
        }
    }
    static async recordPing(req, res) {
        try {
            const user = req.user;
            const { lat, lng } = req.body;
            const data = await field_visit_service_1.FieldVisitService.recordPing(user.id, lat, lng);
            res.status(201).json({ success: true, data });
        }
        catch (error) {
            res.status(400).json({ message: error.message });
        }
    }
    static async getLive(req, res) {
        try {
            const dateKey = String(req.query.date || localDateKey());
            const scope = req.orgScope;
            const data = await field_visit_service_1.FieldVisitService.getLiveSnapshot(dateKey, scope?.scopedEmployeeIds ?? null);
            res.status(200).json({ data });
        }
        catch (error) {
            res.status(400).json({ message: error.message });
        }
    }
}
exports.FieldVisitController = FieldVisitController;
//# sourceMappingURL=field-visit.controller.js.map