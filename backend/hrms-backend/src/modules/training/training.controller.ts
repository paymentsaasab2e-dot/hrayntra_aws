import { Request, Response } from 'express';
import { TrainingService } from './training.service';

export class TrainingController {
  static async listCourses(req: Request, res: Response) {
    try {
      const tenantId = req.orgScope?.tenantId;
      if (!tenantId) return res.status(400).json({ success: false, message: 'Tenant context required' });
      const category = req.query.category as string;
      const courses = await TrainingService.listCourses(tenantId, category);
      res.json({ success: true, data: courses });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async seedStandards(req: Request, res: Response) {
    try {
      const tenantId = req.orgScope?.tenantId;
      if (!tenantId) return res.status(400).json({ success: false, message: 'Tenant context required' });
      const seeded = await TrainingService.seedStandardCourses(tenantId);
      res.json({
        success: true,
        message: `Standard courses (POSH, Safety, DPDP, Code of Conduct) verified/seeded`,
        data: seeded,
      });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async assignCourse(req: Request, res: Response) {
    try {
      const tenantId = req.orgScope?.tenantId;
      if (!tenantId) return res.status(400).json({ success: false, message: 'Tenant context required' });
      const { courseId, employeeIds, department, targetAll, dueInDays, notes } = req.body;

      if (!courseId) {
        return res.status(400).json({ success: false, message: 'courseId is required' });
      }

      const result = await TrainingService.assignCourse(tenantId, {
        courseId,
        employeeIds,
        department,
        targetAll,
        dueInDays,
        notes,
      });

      res.status(201).json(result);
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async getMyAssignments(req: Request, res: Response) {
    try {
      const tenantId = req.orgScope?.tenantId;
      if (!tenantId) return res.status(400).json({ success: false, message: 'Tenant context required' });
      const user = (req as any).user;

      if (!user?.employeeId) {
        return res.json({
          success: true,
          data: [],
          message: 'No associated employee profile for user',
        });
      }

      const assignments = await TrainingService.getEmployeeAssignments(tenantId, user.employeeId);
      res.json({ success: true, data: assignments });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async listAllAssignments(req: Request, res: Response) {
    try {
      const tenantId = req.orgScope?.tenantId;
      if (!tenantId) return res.status(400).json({ success: false, message: 'Tenant context required' });
      const { courseId, category, department, status, isOverdue, search, page, limit } = req.query;

      const result = await TrainingService.listAllAssignments(tenantId, {
        courseId: courseId as string,
        category: category as string,
        department: department as string,
        status: status as string,
        isOverdue: isOverdue === 'true',
        search: search as string,
        page: page ? parseInt(page as string, 10) : 1,
        limit: limit ? parseInt(limit as string, 10) : 50,
      });

      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async updateProgress(req: Request, res: Response) {
    try {
      const tenantId = req.orgScope?.tenantId;
      if (!tenantId) return res.status(400).json({ success: false, message: 'Tenant context required' });
      const assignmentId = req.params.id as string;
      const { status, score, certificateUrl, notes } = req.body;

      const updated = await TrainingService.updateProgress({
        tenantId,
        assignmentId,
        status,
        score: score !== undefined ? parseFloat(score) : undefined,
        certificateUrl,
        notes,
      });

      res.json({
        success: true,
        message: 'Training progress recorded successfully',
        data: updated,
      });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async sendReminders(req: Request, res: Response) {
    try {
      const tenantId = req.orgScope?.tenantId;
      if (!tenantId) return res.status(400).json({ success: false, message: 'Tenant context required' });
      const { courseId } = req.body || {};

      const result = await TrainingService.sendReminders(tenantId, courseId);
      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async getComplianceDashboard(req: Request, res: Response) {
    try {
      const tenantId = req.orgScope?.tenantId;
      if (!tenantId) return res.status(400).json({ success: false, message: 'Tenant context required' });
      const metrics = await TrainingService.getComplianceDashboard(tenantId);
      res.json({ success: true, data: metrics });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
}
