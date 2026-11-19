"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HolidayController = void 0;
const holiday_service_1 = require("./holiday.service");
class HolidayController {
    static async getAll(req, res) {
        try {
            const activeOnly = req.query.activeOnly === 'true';
            const holidays = await holiday_service_1.HolidayService.getAll(req.orgScope, activeOnly);
            res.json({ success: true, data: holidays });
        }
        catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    }
    static async create(req, res) {
        try {
            const holiday = await holiday_service_1.HolidayService.create(req.orgScope, req.body);
            res.status(201).json({ success: true, data: holiday });
        }
        catch (error) {
            res.status(400).json({ success: false, message: error.message });
        }
    }
    static async bulkCreate(req, res) {
        try {
            const { holidays } = req.body;
            const result = await holiday_service_1.HolidayService.bulkCreate(req.orgScope, holidays);
            res.status(201).json({ success: true, data: result });
        }
        catch (error) {
            res.status(400).json({ success: false, message: error.message });
        }
    }
    static async update(req, res) {
        try {
            const holiday = await holiday_service_1.HolidayService.update(req.orgScope, String(req.params.id), req.body);
            res.json({ success: true, data: holiday });
        }
        catch (error) {
            res.status(400).json({ success: false, message: error.message });
        }
    }
    static async delete(req, res) {
        try {
            await holiday_service_1.HolidayService.delete(req.orgScope, String(req.params.id));
            res.json({ success: true, message: 'Holiday deleted successfully' });
        }
        catch (error) {
            res.status(400).json({ success: false, message: error.message });
        }
    }
}
exports.HolidayController = HolidayController;
//# sourceMappingURL=holiday.controller.js.map