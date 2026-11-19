"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DocumentController = void 0;
const document_service_1 = require("./document.service");
class DocumentController {
    static async getAll(req, res) {
        try {
            const filters = {};
            if (req.query.category)
                filters.category = req.query.category;
            if (req.query.employeeId)
                filters.employeeId = req.query.employeeId;
            if (req.query.status)
                filters.status = req.query.status;
            const docs = await document_service_1.DocumentService.getAll(req.orgScope, filters);
            res.status(200).json({ success: true, data: docs });
        }
        catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    }
    static async getById(req, res) {
        try {
            const doc = await document_service_1.DocumentService.getById(req.orgScope, String(req.params.id));
            if (!doc)
                return res.status(404).json({ success: false, message: 'Document not found' });
            res.status(200).json({ success: true, data: doc });
        }
        catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    }
    static async create(req, res) {
        try {
            const userId = req.user?.id || 'SYSTEM';
            const doc = await document_service_1.DocumentService.create(req.orgScope, { ...req.body, uploadedBy: userId });
            res.status(201).json({ success: true, data: doc });
        }
        catch (error) {
            res.status(400).json({ success: false, message: error.message });
        }
    }
    static async update(req, res) {
        try {
            const doc = await document_service_1.DocumentService.update(req.orgScope, String(req.params.id), req.body);
            res.status(200).json({ success: true, data: doc });
        }
        catch (error) {
            res.status(400).json({ success: false, message: error.message });
        }
    }
    static async archive(req, res) {
        try {
            const doc = await document_service_1.DocumentService.archive(req.orgScope, String(req.params.id));
            res.status(200).json({ success: true, data: doc, message: 'Document archived' });
        }
        catch (error) {
            res.status(400).json({ success: false, message: error.message });
        }
    }
    static async delete(req, res) {
        try {
            await document_service_1.DocumentService.delete(req.orgScope, String(req.params.id));
            res.status(200).json({ success: true, message: 'Document deleted' });
        }
        catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    }
}
exports.DocumentController = DocumentController;
//# sourceMappingURL=document.controller.js.map