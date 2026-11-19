"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProjectController = void 0;
const project_service_1 = require("./project.service");
class ProjectController {
    static async getAll(req, res) {
        try {
            const projects = await project_service_1.ProjectService.getAll(req.orgScope);
            res.status(200).json(projects);
        }
        catch (error) {
            res.status(500).json({ message: error.message });
        }
    }
    static async getById(req, res) {
        try {
            const project = await project_service_1.ProjectService.getById(req.orgScope, String(req.params.id));
            if (!project) {
                return res.status(404).json({ message: 'Project not found' });
            }
            res.status(200).json(project);
        }
        catch (error) {
            res.status(500).json({ message: error.message });
        }
    }
    static async create(req, res) {
        try {
            const project = await project_service_1.ProjectService.create(req.orgScope, req.body);
            res.status(201).json(project);
        }
        catch (error) {
            res.status(400).json({ message: error.message });
        }
    }
    static async update(req, res) {
        try {
            const project = await project_service_1.ProjectService.update(req.orgScope, String(req.params.id), req.body);
            res.status(200).json(project);
        }
        catch (error) {
            res.status(400).json({ message: error.message });
        }
    }
    static async delete(req, res) {
        try {
            await project_service_1.ProjectService.delete(req.orgScope, String(req.params.id));
            res.status(200).json({ message: 'Project deleted' });
        }
        catch (error) {
            res.status(400).json({ message: error.message });
        }
    }
}
exports.ProjectController = ProjectController;
//# sourceMappingURL=project.controller.js.map