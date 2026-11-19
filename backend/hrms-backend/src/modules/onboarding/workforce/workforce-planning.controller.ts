import { Request, Response } from 'express';
import { WorkforcePlanningService } from './workforce-planning.service';

export class WorkforcePlanningController {
  static async seedHeadcountPlans(req: Request, res: Response) {
    try {
      const tenantId = req.orgScope?.tenantId;
      if (!tenantId) return res.status(400).json({ success: false, message: 'Tenant context required' });
      const fiscalYear = (req.body.fiscalYear as string) || 'FY2026-27';
      const plans = await WorkforcePlanningService.seedStandardHeadcountPlans(tenantId, fiscalYear);
      res.json({ success: true, data: plans });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async getBudgetVsActual(req: Request, res: Response) {
    try {
      const tenantId = req.orgScope?.tenantId;
      if (!tenantId) return res.status(400).json({ success: false, message: 'Tenant context required' });
      const fiscalYear = (req.query.fiscalYear as string) || 'FY2026-27';
      const analysis = await WorkforcePlanningService.getHeadcountBudgetVsActual(tenantId, fiscalYear);
      res.json({ success: true, data: analysis });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async setHeadcountPlan(req: Request, res: Response) {
    try {
      const tenantId = req.orgScope?.tenantId;
      if (!tenantId) return res.status(400).json({ success: false, message: 'Tenant context required' });
      const plan = await WorkforcePlanningService.setHeadcountPlan(tenantId, {
        fiscalYear: req.body.fiscalYear || 'FY2026-27',
        department: req.body.department,
        approvedHeadcount: parseInt(req.body.approvedHeadcount, 10),
        budgetedCtcCap: req.body.budgetedCtcCap ? parseFloat(req.body.budgetedCtcCap) : undefined,
        notes: req.body.notes,
      });
      res.json({ success: true, data: plan });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async createRequisition(req: Request, res: Response) {
    try {
      const tenantId = req.orgScope?.tenantId;
      if (!tenantId) return res.status(400).json({ success: false, message: 'Tenant context required' });
      const userId = (req as any).user?.id;

      const result = await WorkforcePlanningService.createJobRequisition(
        tenantId,
        {
          title: req.body.title,
          department: req.body.department,
          numberOfOpenings: req.body.numberOfOpenings ? parseInt(req.body.numberOfOpenings, 10) : 1,
          budgetedMinCtc: parseFloat(req.body.budgetedMinCtc),
          budgetedMaxCtc: parseFloat(req.body.budgetedMaxCtc),
          employmentType: req.body.employmentType,
          justification: req.body.justification,
          fiscalYear: req.body.fiscalYear,
        },
        userId
      );
      res.status(201).json({ success: true, data: result });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async listRequisitions(req: Request, res: Response) {
    try {
      const tenantId = req.orgScope?.tenantId;
      if (!tenantId) return res.status(400).json({ success: false, message: 'Tenant context required' });
      const department = req.query.department as string;
      const status = req.query.status as string;
      const requisitions = await WorkforcePlanningService.listJobRequisitions(tenantId, { department, status });
      res.json({ success: true, data: requisitions });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async approveRequisition(req: Request, res: Response) {
    try {
      const tenantId = req.orgScope?.tenantId;
      if (!tenantId) return res.status(400).json({ success: false, message: 'Tenant context required' });
      const id = req.params.id as string;
      const userId = (req as any).user?.id;
      const notes = req.body.approvalNotes as string;

      const updated = await WorkforcePlanningService.approveJobRequisition(tenantId, id, userId, notes);
      res.json({ success: true, data: updated });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }
}
