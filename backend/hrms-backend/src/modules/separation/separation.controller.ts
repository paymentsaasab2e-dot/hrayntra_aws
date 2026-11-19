import { Request, Response } from 'express';
import { resolveTenantId } from '../../shared/tenant/resolve-tenant';
import { SeparationService } from './separation.service';

export class SeparationController {
  static async getPolicy(req: Request, res: Response) {
    try {
      const user = (req as any).user;
      const tenantId = await resolveTenantId(user);
      if (!tenantId) return res.status(400).json({ message: 'Tenant not found' });
      const data = await SeparationService.getExitPolicy(tenantId);
      res.status(200).json({ data });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }

  static async getMine(req: Request, res: Response) {
    try {
      const user = (req as any).user;
      const data = await SeparationService.getMine(user.id);
      res.status(200).json({ data });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }

  static async list(req: Request, res: Response) {
    try {
      const user = (req as any).user;
      const tenantId = await resolveTenantId(user);
      if (!tenantId) return res.status(400).json({ message: 'Tenant not found' });
      const scope = req.orgScope;
      const data = await SeparationService.list(tenantId, scope?.scopedEmployeeIds ?? null);
      res.status(200).json({ data });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }

  static async getById(req: Request, res: Response) {
    try {
      const user = (req as any).user;
      const tenantId = await resolveTenantId(user);
      if (!tenantId) return res.status(400).json({ message: 'Tenant not found' });
      const data = await SeparationService.getById(String(req.params.id), tenantId);
      res.status(200).json({ data });
    } catch (error: any) {
      res.status(error.message === 'Separation request not found' ? 404 : 500).json({ message: error.message });
    }
  }

  static async create(req: Request, res: Response) {
    try {
      const user = (req as any).user;
      const tenantId = await resolveTenantId(user);
      if (!tenantId) return res.status(400).json({ message: 'Tenant not found' });
      const data = await SeparationService.createOrSubmit(user.id, tenantId, req.body);
      res.status(201).json({ success: true, data });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  }

  static async withdraw(req: Request, res: Response) {
    try {
      const user = (req as any).user;
      const tenantId = await resolveTenantId(user);
      if (!tenantId) return res.status(400).json({ message: 'Tenant not found' });
      const data = await SeparationService.withdraw(String(req.params.id), user.id, tenantId);
      res.status(200).json({ success: true, data });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  }

  static async updateChecklist(req: Request, res: Response) {
    try {
      const user = (req as any).user;
      const tenantId = await resolveTenantId(user);
      if (!tenantId) return res.status(400).json({ message: 'Tenant not found' });
      const data = await SeparationService.updateChecklist(
        String(req.params.id),
        tenantId,
        req.body.items || [],
        user.id
      );
      res.status(200).json({ success: true, data });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  }

  static async complete(req: Request, res: Response) {
    try {
      const user = (req as any).user;
      const tenantId = await resolveTenantId(user);
      if (!tenantId) return res.status(400).json({ message: 'Tenant not found' });
      const data = await SeparationService.completeExit(String(req.params.id), tenantId);
      res.status(200).json({ success: true, data });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  }
}
