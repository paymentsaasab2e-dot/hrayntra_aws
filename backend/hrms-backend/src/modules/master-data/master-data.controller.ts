import { Request, Response } from 'express';
import { resolveTenantId } from '../../shared/tenant/resolve-tenant';
import { MasterDataService } from './master-data.service';

export class MasterDataController {
  static async getMasterData(req: Request, res: Response) {
    try {
      const user = (req as any).user;
      const tenantId = await resolveTenantId(user);
      if (!tenantId) {
        return res.status(400).json({ success: false, message: 'Tenant context required' });
      }
      const data = await MasterDataService.getMasterData(tenantId);
      res.status(200).json({ success: true, data });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  // ── Departments ──
  static async upsertDepartment(req: Request, res: Response) {
    try {
      const user = (req as any).user;
      const tenantId = await resolveTenantId(user);
      if (!tenantId) {
        return res.status(400).json({ success: false, message: 'Tenant context required' });
      }
      const data = await MasterDataService.upsertDepartment(tenantId, user.id, req.body);
      res.status(200).json({ success: true, data, message: 'Department saved successfully' });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async deleteDepartment(req: Request, res: Response) {
    try {
      const user = (req as any).user;
      const tenantId = await resolveTenantId(user);
      if (!tenantId) {
        return res.status(400).json({ success: false, message: 'Tenant context required' });
      }
      const data = await MasterDataService.deleteDepartment(tenantId, user.id, String(req.params.id));
      res.status(200).json({ success: true, data, message: 'Department removed successfully' });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  // ── Designations ──
  static async upsertDesignation(req: Request, res: Response) {
    try {
      const user = (req as any).user;
      const tenantId = await resolveTenantId(user);
      if (!tenantId) {
        return res.status(400).json({ success: false, message: 'Tenant context required' });
      }
      const data = await MasterDataService.upsertDesignation(tenantId, user.id, req.body);
      res.status(200).json({ success: true, data, message: 'Designation saved successfully' });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async deleteDesignation(req: Request, res: Response) {
    try {
      const user = (req as any).user;
      const tenantId = await resolveTenantId(user);
      if (!tenantId) {
        return res.status(400).json({ success: false, message: 'Tenant context required' });
      }
      const data = await MasterDataService.deleteDesignation(tenantId, user.id, String(req.params.id));
      res.status(200).json({ success: true, data, message: 'Designation removed successfully' });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  // ── Grades ──
  static async upsertGrade(req: Request, res: Response) {
    try {
      const user = (req as any).user;
      const tenantId = await resolveTenantId(user);
      if (!tenantId) {
        return res.status(400).json({ success: false, message: 'Tenant context required' });
      }
      const data = await MasterDataService.upsertGrade(tenantId, user.id, req.body);
      res.status(200).json({ success: true, data, message: 'Grade saved successfully' });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async deleteGrade(req: Request, res: Response) {
    try {
      const user = (req as any).user;
      const tenantId = await resolveTenantId(user);
      if (!tenantId) {
        return res.status(400).json({ success: false, message: 'Tenant context required' });
      }
      const data = await MasterDataService.deleteGrade(tenantId, user.id, String(req.params.id));
      res.status(200).json({ success: true, data, message: 'Grade removed successfully' });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  // ── Cost Centres ──
  static async upsertCostCentre(req: Request, res: Response) {
    try {
      const user = (req as any).user;
      const tenantId = await resolveTenantId(user);
      if (!tenantId) {
        return res.status(400).json({ success: false, message: 'Tenant context required' });
      }
      const data = await MasterDataService.upsertCostCentre(tenantId, user.id, req.body);
      res.status(200).json({ success: true, data, message: 'Cost Centre saved successfully' });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async deleteCostCentre(req: Request, res: Response) {
    try {
      const user = (req as any).user;
      const tenantId = await resolveTenantId(user);
      if (!tenantId) {
        return res.status(400).json({ success: false, message: 'Tenant context required' });
      }
      const data = await MasterDataService.deleteCostCentre(tenantId, user.id, String(req.params.id));
      res.status(200).json({ success: true, data, message: 'Cost Centre removed successfully' });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }
}
