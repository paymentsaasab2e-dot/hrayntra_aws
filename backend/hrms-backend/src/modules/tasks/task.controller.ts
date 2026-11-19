import { Request, Response } from 'express';
import { TaskService } from './task.service';

export class TaskController {
  static async create(req: Request, res: Response) {
    try {
      // @ts-ignore
      const assignedBy = req.user?.employeeId || req.user?.id || null;
      const task = await TaskService.create(req.orgScope!, req.body, assignedBy);
      res.status(201).json(task);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  }

  static async createSelf(req: Request, res: Response) {
    try {
      // @ts-ignore
      const employeeRecordId = req.user?.employeeId;
      if (!employeeRecordId) {
        return res.status(400).json({ message: 'Employee profile required for self tasks' });
      }
      // @ts-ignore
      const assignedBy = req.user?.employeeId || req.user?.id || null;
      const task = await TaskService.createSelf(req.orgScope!, req.body, employeeRecordId, assignedBy);
      res.status(201).json(task);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  }

  static async update(req: Request, res: Response) {
    try {
      const task = await TaskService.update(req.orgScope!, String(req.params.id), req.body);
      res.status(200).json(task);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  }

  static async updateStatus(req: Request, res: Response) {
    try {
      const { status } = req.body;
      const task = await TaskService.updateStatus(req.orgScope!, String(req.params.id), status);
      res.status(200).json(task);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  }

  static async delete(req: Request, res: Response) {
    try {
      await TaskService.delete(req.orgScope!, String(req.params.id));
      res.status(200).json({ message: 'Task deleted' });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  }

  static async getByEmployee(req: Request, res: Response) {
    try {
      const tasks = await TaskService.getByEmployee(req.orgScope!, String(req.params.employeeId));
      res.status(200).json(tasks);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }

  static async getAll(req: Request, res: Response) {
    try {
      const tasks = await TaskService.getAllForUser((req as any).user || {}, req.orgScope);
      res.status(200).json(tasks);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }

  static async getById(req: Request, res: Response) {
    try {
      const task = await TaskService.getById(req.orgScope!, String(req.params.id));
      if (!task) {
        return res.status(404).json({ message: 'Task not found' });
      }
      res.status(200).json(task);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }
}
