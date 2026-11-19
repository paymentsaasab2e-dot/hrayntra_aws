import { Request, Response } from 'express';
import { resolveTenantId } from '../../shared/tenant/resolve-tenant';
import { CompensationService } from './compensation.service';

export class CompensationController {
  static async listProfiles(req: Request, res: Response) {
    try {
      const user = (req as any).user;
      const tenantId = await resolveTenantId(user);
      if (!tenantId) return res.status(400).json({ message: 'Tenant not found' });
      const data = await CompensationService.listProfiles(tenantId, {
        country: req.query.country ? String(req.query.country) : undefined,
      });
      res.status(200).json({ success: true, data });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async matchProfile(req: Request, res: Response) {
    try {
      const user = (req as any).user;
      const tenantId = await resolveTenantId(user);
      if (!tenantId) return res.status(400).json({ message: 'Tenant not found' });
      const data = await CompensationService.matchProfile(tenantId, {
        country: req.query.country ? String(req.query.country) : undefined,
        region: req.query.region ? String(req.query.region) : undefined,
        city: req.query.city ? String(req.query.city) : undefined,
        locality: req.query.locality ? String(req.query.locality) : undefined,
      });
      res.status(200).json({ success: true, data });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async getProfile(req: Request, res: Response) {
    try {
      const user = (req as any).user;
      const tenantId = await resolveTenantId(user);
      if (!tenantId) return res.status(400).json({ message: 'Tenant not found' });
      const data = await CompensationService.getProfile(String(req.params.id), tenantId);
      res.status(200).json({ success: true, data });
    } catch (error: any) {
      res.status(error.message === 'Compliance profile not found' ? 404 : 500).json({ success: false, message: error.message });
    }
  }

  static async createProfile(req: Request, res: Response) {
    try {
      const user = (req as any).user;
      const tenantId = await resolveTenantId(user);
      if (!tenantId) return res.status(400).json({ message: 'Tenant not found' });
      const data = await CompensationService.createProfile(tenantId, req.body);
      res.status(201).json({ success: true, data });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async updateProfile(req: Request, res: Response) {
    try {
      const user = (req as any).user;
      const tenantId = await resolveTenantId(user);
      if (!tenantId) return res.status(400).json({ message: 'Tenant not found' });
      const data = await CompensationService.updateProfile(String(req.params.id), tenantId, req.body);
      res.status(200).json({ success: true, data });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async deleteProfile(req: Request, res: Response) {
    try {
      const user = (req as any).user;
      const tenantId = await resolveTenantId(user);
      if (!tenantId) return res.status(400).json({ message: 'Tenant not found' });
      await CompensationService.deleteProfile(String(req.params.id), tenantId);
      res.status(200).json({ success: true, message: 'Profile deleted' });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async calculate(req: Request, res: Response) {
    try {
      const data = CompensationService.preview(req.body);
      res.status(200).json({ success: true, data });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async getEmployeeCompensation(req: Request, res: Response) {
    try {
      const user = (req as any).user;
      const tenantId = await resolveTenantId(user);
      if (!tenantId) return res.status(400).json({ message: 'Tenant not found' });
      const data = await CompensationService.getEmployeeCompensation(String(req.params.employeeId), tenantId);
      res.status(200).json({ success: true, data });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async upsertEmployeeCompensation(req: Request, res: Response) {
    try {
      const user = (req as any).user;
      const tenantId = await resolveTenantId(user);
      if (!tenantId) return res.status(400).json({ message: 'Tenant not found' });
      const data = await CompensationService.upsertCompensation(tenantId, {
        ...req.body,
        employeeId: String(req.params.employeeId),
      });
      res.status(200).json({ success: true, data });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async getOnboardingCompensation(req: Request, res: Response) {
    try {
      const user = (req as any).user;
      const tenantId = await resolveTenantId(user);
      if (!tenantId) return res.status(400).json({ message: 'Tenant not found' });
      const data = await CompensationService.getOnboardingCompensation(String(req.params.onboardingId), tenantId);
      res.status(200).json({ success: true, data });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async upsertOnboardingCompensation(req: Request, res: Response) {
    try {
      const user = (req as any).user;
      const tenantId = await resolveTenantId(user);
      if (!tenantId) return res.status(400).json({ message: 'Tenant not found' });
      const data = await CompensationService.upsertCompensation(tenantId, {
        ...req.body,
        onboardingHireId: String(req.params.onboardingId),
      });
      res.status(200).json({ success: true, data });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }
}
