"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TaskController = void 0;
const task_service_1 = require("./task.service");
class TaskController {
    static async create(req, res) {
        try {
            // @ts-ignore
            const assignedBy = req.user?.employeeId || req.user?.id || null;
            const task = await task_service_1.TaskService.create(req.orgScope, req.body, assignedBy);
            res.status(201).json(task);
        }
        catch (error) {
            res.status(400).json({ message: error.message });
        }
    }
    static async createSelf(req, res) {
        try {
            // @ts-ignore
            const employeeRecordId = req.user?.employeeId;
            if (!employeeRecordId) {
                return res.status(400).json({ message: 'Employee profile required for self tasks' });
            }
            // @ts-ignore
            const assignedBy = req.user?.employeeId || req.user?.id || null;
            const task = await task_service_1.TaskService.createSelf(req.orgScope, req.body, employeeRecordId, assignedBy);
            res.status(201).json(task);
        }
        catch (error) {
            res.status(400).json({ message: error.message });
        }
    }
    static async update(req, res) {
        try {
            const task = await task_service_1.TaskService.update(req.orgScope, String(req.params.id), req.body);
            res.status(200).json(task);
        }
        catch (error) {
            res.status(400).json({ message: error.message });
        }
    }
    static async updateStatus(req, res) {
        try {
            const { status } = req.body;
            const task = await task_service_1.TaskService.updateStatus(req.orgScope, String(req.params.id), status);
            res.status(200).json(task);
        }
        catch (error) {
            res.status(400).json({ message: error.message });
        }
    }
    static async delete(req, res) {
        try {
            await task_service_1.TaskService.delete(req.orgScope, String(req.params.id));
            res.status(200).json({ message: 'Task deleted' });
        }
        catch (error) {
            res.status(400).json({ message: error.message });
        }
    }
    static async getByEmployee(req, res) {
        try {
            const tasks = await task_service_1.TaskService.getByEmployee(req.orgScope, String(req.params.employeeId));
            res.status(200).json(tasks);
        }
        catch (error) {
            res.status(500).json({ message: error.message });
        }
    }
    static async getAll(req, res) {
        try {
            const tasks = await task_service_1.TaskService.getAllForUser(req.user || {}, req.orgScope);
            res.status(200).json(tasks);
        }
        catch (error) {
            res.status(500).json({ message: error.message });
        }
    }
    static async getById(req, res) {
        try {
            const task = await task_service_1.TaskService.getById(req.orgScope, String(req.params.id));
            if (!task) {
                return res.status(404).json({ message: 'Task not found' });
            }
            res.status(200).json(task);
        }
        catch (error) {
            res.status(500).json({ message: error.message });
        }
    }
}
exports.TaskController = TaskController;
//# sourceMappingURL=task.controller.js.map