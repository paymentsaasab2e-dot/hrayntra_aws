"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LocationController = void 0;
const location_service_1 = require("./location.service");
class LocationController {
    static async getAll(req, res) {
        try {
            const activeOnly = req.query.activeOnly === 'true';
            const locations = await location_service_1.LocationService.getAll(req.orgScope, activeOnly);
            res.status(200).json({ success: true, data: locations });
        }
        catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    }
    static async getById(req, res) {
        try {
            const location = await location_service_1.LocationService.getById(req.orgScope, String(req.params.id));
            res.status(200).json({ success: true, data: location });
        }
        catch (error) {
            res.status(404).json({ success: false, message: error.message });
        }
    }
    static async create(req, res) {
        try {
            const location = await location_service_1.LocationService.create(req.orgScope, req.body);
            res.status(201).json({ success: true, data: location });
        }
        catch (error) {
            res.status(400).json({ success: false, message: error.message });
        }
    }
    static async update(req, res) {
        try {
            const location = await location_service_1.LocationService.update(req.orgScope, String(req.params.id), req.body);
            res.status(200).json({ success: true, data: location });
        }
        catch (error) {
            res.status(400).json({ success: false, message: error.message });
        }
    }
    static async delete(req, res) {
        try {
            await location_service_1.LocationService.delete(req.orgScope, String(req.params.id));
            res.status(200).json({ success: true });
        }
        catch (error) {
            res.status(400).json({ success: false, message: error.message });
        }
    }
}
exports.LocationController = LocationController;
//# sourceMappingURL=location.controller.js.map