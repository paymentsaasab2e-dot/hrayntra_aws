import { Request, Response } from 'express';
import { resolveTenantId } from '../../shared/tenant/resolve-tenant';
import { PolicyService } from './policy.service';

export class PolicyController {
  static async list(req: Request, res: Response) {
    try {
      const user = (req as any).user;
      const tenantId = await resolveTenantId(user);
      if (!tenantId) return res.status(400).json({ message: 'Tenant not found' });
      const data = await PolicyService.listDocuments(tenantId);
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
      const data = await PolicyService.getDocument(String(req.params.id), tenantId);
      res.status(200).json({ data });
    } catch (error: any) {
      res.status(error.message === 'Policy document not found' ? 404 : 500).json({ message: error.message });
    }
  }

  static async upload(req: Request, res: Response) {
    try {
      const user = (req as any).user;
      const tenantId = await resolveTenantId(user);
      if (!tenantId) return res.status(400).json({ message: 'Tenant not found' });
      const title = String(req.body.title || 'Leave & Attendance Policy');
      const data = await PolicyService.createFromUpload(tenantId, user.id, {
        title,
        file: req.file,
      });
      res.status(201).json({ success: true, data });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  }

  static async createManual(req: Request, res: Response) {
    try {
      const user = (req as any).user;
      const tenantId = await resolveTenantId(user);
      if (!tenantId) return res.status(400).json({ message: 'Tenant not found' });
      const data = await PolicyService.createManual(tenantId, user.id, req.body.title || 'Leave & Attendance Policy');
      res.status(201).json({ success: true, data });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  }

  static async updateRules(req: Request, res: Response) {
    try {
      const user = (req as any).user;
      const tenantId = await resolveTenantId(user);
      if (!tenantId) return res.status(400).json({ message: 'Tenant not found' });
      const data = await PolicyService.updateDraftRules(String(req.params.id), tenantId, req.body.rules || req.body);
      res.status(200).json({ success: true, data });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  }

  static async publish(req: Request, res: Response) {
    try {
      const user = (req as any).user;
      const tenantId = await resolveTenantId(user);
      if (!tenantId) return res.status(400).json({ message: 'Tenant not found' });
      const data = await PolicyService.publish(String(req.params.id), tenantId, user.id);
      res.status(200).json({ success: true, data });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  }

  static async getActive(req: Request, res: Response) {
    try {
      const user = (req as any).user;
      const tenantId = await resolveTenantId(user);
      if (!tenantId) return res.status(400).json({ message: 'Tenant not found' });
      const data = await PolicyService.getActive(tenantId);
      res.status(200).json({ data });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }

  static async updateActive(req: Request, res: Response) {
    try {
      const user = (req as any).user;
      const tenantId = await resolveTenantId(user);
      if (!tenantId) return res.status(400).json({ message: 'Tenant not found' });
      const data = await PolicyService.updateActiveRules(tenantId, user.id, req.body.rules || req.body);
      res.status(200).json({ success: true, data });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  }

  static async acknowledge(req: Request, res: Response) {
    try {
      const user = (req as any).user;
      const data = await PolicyService.acknowledge(String(req.params.versionId), user.id);
      res.status(200).json({ success: true, data });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  }
}
