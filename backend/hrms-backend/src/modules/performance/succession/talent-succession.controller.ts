import { Request, Response } from 'express';
import { TalentSuccessionService } from './talent-succession.service';

export class TalentSuccessionController {
  static async seedSkills(req: Request, res: Response) {
    try {
      const tenantId = req.orgScope?.tenantId;
      if (!tenantId) return res.status(400).json({ success: false, message: 'Tenant context required' });
      const skills = await TalentSuccessionService.seedStandardSkills(tenantId);
      res.json({ success: true, data: skills });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async listSkills(req: Request, res: Response) {
    try {
      const tenantId = req.orgScope?.tenantId;
      if (!tenantId) return res.status(400).json({ success: false, message: 'Tenant context required' });
      const category = req.query.category as string;
      const skills = await TalentSuccessionService.listSkills(tenantId, category);
      res.json({ success: true, data: skills });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async getEmployeeSkillMatrix(req: Request, res: Response) {
    try {
      const tenantId = req.orgScope?.tenantId;
      if (!tenantId) return res.status(400).json({ success: false, message: 'Tenant context required' });
      const employeeId = req.params.employeeId as string;
      const matrix = await TalentSuccessionService.getEmployeeSkillMatrix(tenantId, employeeId);
      res.json({ success: true, data: matrix });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async recordSkillProficiency(req: Request, res: Response) {
    try {
      const tenantId = req.orgScope?.tenantId;
      if (!tenantId) return res.status(400).json({ success: false, message: 'Tenant context required' });
      const employeeId = req.params.employeeId as string;
      const { skillId, proficiencyLevel } = req.body;
      const userId = (req as any).user?.id;

      const record = await TalentSuccessionService.recordSkillProficiency(
        tenantId,
        employeeId,
        skillId,
        parseInt(proficiencyLevel, 10),
        userId
      );
      res.json({ success: true, data: record });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async assessTalent(req: Request, res: Response) {
    try {
      const tenantId = req.orgScope?.tenantId;
      if (!tenantId) return res.status(400).json({ success: false, message: 'Tenant context required' });
      const employeeId = req.params.employeeId as string;
      const userId = (req as any).user?.id;

      const assessment = await TalentSuccessionService.assessEmployeeTalent(
        tenantId,
        employeeId,
        req.body,
        userId
      );
      res.status(201).json({ success: true, data: assessment });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async getNineBoxMatrix(req: Request, res: Response) {
    try {
      const tenantId = req.orgScope?.tenantId;
      if (!tenantId) return res.status(400).json({ success: false, message: 'Tenant context required' });
      const year = (req.query.year as string) || '2026';
      const matrix = await TalentSuccessionService.getNineBoxMatrix(tenantId, year);
      res.json({ success: true, data: matrix });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async listPlans(req: Request, res: Response) {
    try {
      const tenantId = req.orgScope?.tenantId;
      if (!tenantId) return res.status(400).json({ success: false, message: 'Tenant context required' });
      const department = req.query.department as string;
      const plans = await TalentSuccessionService.listSuccessionPlans(tenantId, department);
      res.json({ success: true, data: plans });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async createPlan(req: Request, res: Response) {
    try {
      const tenantId = req.orgScope?.tenantId;
      if (!tenantId) return res.status(400).json({ success: false, message: 'Tenant context required' });
      const plan = await TalentSuccessionService.createSuccessionPlan(tenantId, req.body);
      res.status(201).json({ success: true, data: plan });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async addCandidate(req: Request, res: Response) {
    try {
      const tenantId = req.orgScope?.tenantId;
      if (!tenantId) return res.status(400).json({ success: false, message: 'Tenant context required' });
      const planId = req.params.planId as string;
      const candidate = await TalentSuccessionService.addCandidate(tenantId, planId, req.body);
      res.json({ success: true, data: candidate });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }
}
