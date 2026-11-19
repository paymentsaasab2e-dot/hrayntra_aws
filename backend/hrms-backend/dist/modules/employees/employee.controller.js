"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmployeeController = void 0;
const employee_service_1 = require("./employee.service");
const employee_change_service_1 = require("./employee-change.service");
class EmployeeController {
    static async getAll(req, res) {
        try {
            const employees = await employee_service_1.EmployeeService.getAll(req.orgScope);
            res.status(200).json(employees);
        }
        catch (error) {
            res.status(500).json({ message: error.message });
        }
    }
    static async getById(req, res) {
        try {
            const employee = await employee_service_1.EmployeeService.getById(String(req.params.id), req.orgScope);
            if (!employee)
                return res.status(404).json({ message: 'Employee not found' });
            res.status(200).json(employee);
        }
        catch (error) {
            res.status(500).json({ message: error.message });
        }
    }
    static async create(req, res) {
        try {
            const employee = await employee_service_1.EmployeeService.create(req.orgScope, req.body);
            res.status(201).json(employee);
        }
        catch (error) {
            res.status(400).json({ message: error.message });
        }
    }
    static async update(req, res) {
        try {
            const employee = await employee_service_1.EmployeeService.update(req.orgScope, String(req.params.id), req.body);
            res.status(200).json(employee);
        }
        catch (error) {
            res.status(400).json({ message: error.message });
        }
    }
    static async delete(req, res) {
        try {
            await employee_service_1.EmployeeService.delete(req.orgScope, String(req.params.id));
            res.status(204).send();
        }
        catch (error) {
            res.status(500).json({ message: error.message });
        }
    }
    // ── Employee Change Requests ──
    static async submitChangeRequest(req, res) {
        try {
            const requestedByUserId = req.user?.id || req.user?.userId;
            const changeReq = await employee_change_service_1.EmployeeChangeService.submitChangeRequest(req.orgScope, String(req.params.id), requestedByUserId, req.body);
            res.status(201).json({ success: true, data: changeReq });
        }
        catch (error) {
            res.status(400).json({ success: false, message: error.message });
        }
    }
    static async getChangeRequests(req, res) {
        try {
            const employeeId = req.params.id ? String(req.params.id) : req.query.employeeId;
            const status = req.query.status;
            const list = await employee_change_service_1.EmployeeChangeService.getChangeRequests(req.orgScope, { employeeId, status });
            res.status(200).json({ success: true, data: list });
        }
        catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    }
    static async getChangeRequestById(req, res) {
        try {
            const item = await employee_change_service_1.EmployeeChangeService.getChangeRequestById(req.orgScope, String(req.params.requestId));
            if (!item)
                return res.status(404).json({ success: false, message: 'Change request not found' });
            res.status(200).json({ success: true, data: item });
        }
        catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    }
    static async updateChangeRequestStatus(req, res) {
        try {
            const reviewedByUserId = req.user?.id || req.user?.userId;
            const { status, reviewRemark } = req.body;
            const updated = await employee_change_service_1.EmployeeChangeService.updateChangeRequestStatus(req.orgScope, String(req.params.requestId), reviewedByUserId, status, reviewRemark);
            res.status(200).json({ success: true, data: updated, message: `Change request ${status} successfully` });
        }
        catch (error) {
            res.status(400).json({ success: false, message: error.message });
        }
    }
    // ── Employment History ──
    static async getEmploymentHistory(req, res) {
        try {
            const history = await employee_change_service_1.EmployeeChangeService.getEmploymentHistory(req.orgScope, String(req.params.id));
            res.status(200).json({ success: true, data: history });
        }
        catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    }
    static async addEmploymentHistoryMilestone(req, res) {
        try {
            const recordedBy = req.user?.id || req.user?.userId;
            const milestone = await employee_change_service_1.EmployeeChangeService.addEmploymentHistoryMilestone(req.orgScope, String(req.params.id), recordedBy, req.body);
            res.status(201).json({ success: true, data: milestone });
        }
        catch (error) {
            res.status(400).json({ success: false, message: error.message });
        }
    }
    static async deleteEmploymentHistoryMilestone(req, res) {
        try {
            await employee_change_service_1.EmployeeChangeService.deleteEmploymentHistoryMilestone(req.orgScope, String(req.params.id), String(req.params.historyId));
            res.status(200).json({ success: true, message: 'Milestone deleted' });
        }
        catch (error) {
            res.status(400).json({ success: false, message: error.message });
        }
    }
}
exports.EmployeeController = EmployeeController;
//# sourceMappingURL=employee.controller.js.map