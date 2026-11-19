"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AssetController = void 0;
const asset_service_1 = require("./asset.service");
const logger_1 = require("../../shared/logger");
class AssetController {
    static async getAll(req, res) {
        try {
            const assets = await asset_service_1.AssetService.getAll(req.orgScope);
            res.status(200).json({ success: true, data: assets });
        }
        catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    }
    static async getById(req, res) {
        try {
            const asset = await asset_service_1.AssetService.getById(req.orgScope, String(req.params.id));
            if (!asset)
                return res.status(404).json({ success: false, message: 'Asset not found' });
            res.status(200).json({ success: true, data: asset });
        }
        catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    }
    static async create(req, res) {
        try {
            const asset = await asset_service_1.AssetService.create(req.orgScope, req.body);
            logger_1.logger.info('asset.create.success', {
                assetId: asset.id,
                serialNumber: asset.serialNumber,
                actorId: req.user?.id,
            });
            res.status(201).json({ success: true, data: asset });
        }
        catch (error) {
            logger_1.logger.error('asset.create.failed', {
                actorId: req.user?.id,
                error: error?.message,
            });
            res.status(400).json({ success: false, message: error.message });
        }
    }
    static async update(req, res) {
        try {
            const asset = await asset_service_1.AssetService.update(req.orgScope, String(req.params.id), req.body);
            logger_1.logger.info('asset.update.success', {
                assetId: String(req.params.id),
                actorId: req.user?.id,
            });
            res.status(200).json({ success: true, data: asset });
        }
        catch (error) {
            logger_1.logger.error('asset.update.failed', {
                assetId: String(req.params.id),
                actorId: req.user?.id,
                error: error?.message,
            });
            res.status(400).json({ success: false, message: error.message });
        }
    }
    static async delete(req, res) {
        try {
            await asset_service_1.AssetService.delete(req.orgScope, String(req.params.id));
            logger_1.logger.info('asset.delete.success', {
                assetId: String(req.params.id),
                actorId: req.user?.id,
            });
            res.status(200).json({ success: true, message: 'Asset deleted' });
        }
        catch (error) {
            logger_1.logger.error('asset.delete.failed', {
                assetId: String(req.params.id),
                actorId: req.user?.id,
                error: error?.message,
            });
            res.status(500).json({ success: false, message: error.message });
        }
    }
    static async getAllocations(req, res) {
        try {
            const allocations = await asset_service_1.AssetService.getAllocations(req.orgScope);
            res.status(200).json({ success: true, data: allocations });
        }
        catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    }
    static async assignAsset(req, res) {
        try {
            const allocation = await asset_service_1.AssetService.assignAsset(req.orgScope, req.body);
            logger_1.logger.info('asset.assign.success', {
                allocationId: allocation.id,
                assetId: allocation.assetId,
                employeeId: allocation.employeeId,
                actorId: req.user?.id,
            });
            res.status(201).json({ success: true, data: allocation });
        }
        catch (error) {
            logger_1.logger.error('asset.assign.failed', {
                assetId: req.body?.assetId,
                employeeId: req.body?.employeeId,
                actorId: req.user?.id,
                error: error?.message,
            });
            res.status(400).json({ success: false, message: error.message });
        }
    }
    static async returnAsset(req, res) {
        try {
            const allocation = await asset_service_1.AssetService.returnAsset(req.orgScope, String(req.params.id), req.body);
            logger_1.logger.info('asset.return.success', {
                allocationId: String(req.params.id),
                assetId: allocation.assetId,
                actorId: req.user?.id,
            });
            res.status(200).json({ success: true, data: allocation });
        }
        catch (error) {
            logger_1.logger.error('asset.return.failed', {
                allocationId: String(req.params.id),
                actorId: req.user?.id,
                error: error?.message,
            });
            res.status(400).json({ success: false, message: error.message });
        }
    }
}
exports.AssetController = AssetController;
//# sourceMappingURL=asset.controller.js.map