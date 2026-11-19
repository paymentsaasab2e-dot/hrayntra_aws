import { Request, Response } from 'express';
import { resolveTenantId } from '../../shared/tenant/resolve-tenant';
import { OnboardingService } from './onboarding.service';

export class OnboardingController {
  static async getAll(req: Request, res: Response) {
    try {
      const user = (req as any).user;
      const tenantId = await resolveTenantId(user);
      const filters: any = {};
      if (req.query.status) filters.status = req.query.status;
      const hires = await OnboardingService.getAll(filters, tenantId);
      res.status(200).json({ success: true, data: hires });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async getById(req: Request, res: Response) {
    try {
      const user = (req as any).user;
      const tenantId = await resolveTenantId(user);
      const hire = await OnboardingService.getById(String(req.params.id), tenantId);
      if (!hire) return res.status(404).json({ success: false, message: 'Onboarding hire not found' });
      res.status(200).json({ success: true, data: hire });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async create(req: Request, res: Response) {
    try {
      const user = (req as any).user;
      const tenantId = await resolveTenantId(user);
      const hire = await OnboardingService.create(req.body, tenantId);
      res.status(201).json({ success: true, data: hire });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async bulkCreate(req: Request, res: Response) {
    try {
      const user = (req as any).user;
      const tenantId = await resolveTenantId(user);
      const candidates = Array.isArray(req.body.candidates) ? req.body.candidates : [];
      if (!candidates.length) {
        return res.status(400).json({ success: false, message: 'No candidates provided' });
      }
      const source = req.body.source || 'BULK_IMPORT';
      const hires = await OnboardingService.bulkCreate(candidates, tenantId, source);
      res.status(201).json({ success: true, data: hires });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async update(req: Request, res: Response) {
    try {
      const user = (req as any).user;
      const tenantId = await resolveTenantId(user);
      const hire = await OnboardingService.update(String(req.params.id), req.body, tenantId);
      res.status(200).json({ success: true, data: hire });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async updateTask(req: Request, res: Response) {
    try {
      const user = (req as any).user;
      const tenantId = await resolveTenantId(user);
      const { taskLabel, done } = req.body;
      const hire = await OnboardingService.updateTask(String(req.params.id), taskLabel, done, tenantId);
      res.status(200).json({ success: true, data: hire });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async complete(req: Request, res: Response) {
    try {
      const user = (req as any).user;
      const tenantId = await resolveTenantId(user);
      const result = await OnboardingService.complete(String(req.params.id), tenantId, req.body);
      res.status(200).json({ success: true, data: result.hire, graduation: result });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async delete(req: Request, res: Response) {
    try {
      const user = (req as any).user;
      const tenantId = await resolveTenantId(user);
      await OnboardingService.delete(String(req.params.id), tenantId);
      res.status(200).json({ success: true, message: 'Onboarding hire deleted' });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
}
