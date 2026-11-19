import { Request, Response } from 'express';
import { ProjectService } from './project.service';

export class ProjectController {
  static async getAll(req: Request, res: Response) {
    try {
      const projects = await ProjectService.getAll(req.orgScope!);
      res.status(200).json(projects);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }

  static async getById(req: Request, res: Response) {
    try {
      const project = await ProjectService.getById(req.orgScope!, String(req.params.id));
      if (!project) {
        return res.status(404).json({ message: 'Project not found' });
      }
      res.status(200).json(project);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }

  static async create(req: Request, res: Response) {
    try {
      const project = await ProjectService.create(req.orgScope!, req.body);
      res.status(201).json(project);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  }

  static async update(req: Request, res: Response) {
    try {
      const project = await ProjectService.update(req.orgScope!, String(req.params.id), req.body);
      res.status(200).json(project);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  }

  static async delete(req: Request, res: Response) {
    try {
      await ProjectService.delete(req.orgScope!, String(req.params.id));
      res.status(200).json({ message: 'Project deleted' });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  }
}
