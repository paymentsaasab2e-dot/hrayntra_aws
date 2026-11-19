import { Request, Response } from 'express';
import { CompensationPlanningService } from './compensation-planning.service';

export class CompensationPlanningController {
  static async listCycles(req: Request, res: Response) {
    try {
      const tenantId = req.orgScope?.tenantId;
      if (!tenantId) return res.status(400).json({ success: false, message: 'Tenant context required' });
      const cycles = await CompensationPlanningService.listCycles(tenantId);
      res.json({ success: true, data: cycles });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async createCycle(req: Request, res: Response) {
    try {
      const tenantId = req.orgScope?.tenantId;
      if (!tenantId) return res.status(400).json({ success: false, message: 'Tenant context required' });
      const cycle = await CompensationPlanningService.createCycle(tenantId, req.body);
      res.status(201).json({ success: true, data: cycle });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async allocatePool(req: Request, res: Response) {
    try {
      const tenantId = req.orgScope?.tenantId;
      if (!tenantId) return res.status(400).json({ success: false, message: 'Tenant context required' });
      const { cycleId, department, allocatedBudget } = req.body;
      const pool = await CompensationPlanningService.allocateDepartmentPool(
        tenantId,
        cycleId,
        department,
        parseFloat(allocatedBudget)
      );
      res.json({ success: true, data: pool });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async generateRecommendations(req: Request, res: Response) {
    try {
      const tenantId = req.orgScope?.tenantId;
      if (!tenantId) return res.status(400).json({ success: false, message: 'Tenant context required' });
      const cycleId = req.params.cycleId as string;
      const result = await CompensationPlanningService.generateRecommendationsForCycle(tenantId, cycleId);
      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async updateRecommendation(req: Request, res: Response) {
    try {
      const tenantId = req.orgScope?.tenantId;
      if (!tenantId) return res.status(400).json({ success: false, message: 'Tenant context required' });
      const id = req.params.id as string;
      const updated = await CompensationPlanningService.updateRecommendation(tenantId, id, req.body);
      res.json({ success: true, data: updated });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async applyCycle(req: Request, res: Response) {
    try {
      const tenantId = req.orgScope?.tenantId;
      if (!tenantId) return res.status(400).json({ success: false, message: 'Tenant context required' });
      const cycleId = req.params.cycleId as string;
      const userId = (req as any).user?.id;
      const result = await CompensationPlanningService.applyCycle(tenantId, cycleId, userId);
      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async getCycleDashboard(req: Request, res: Response) {
    try {
      const tenantId = req.orgScope?.tenantId;
      if (!tenantId) return res.status(400).json({ success: false, message: 'Tenant context required' });
      const cycleId = req.params.cycleId as string;
      const dashboard = await CompensationPlanningService.getCycleDashboard(tenantId, cycleId);
      res.json({ success: true, data: dashboard });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
}
