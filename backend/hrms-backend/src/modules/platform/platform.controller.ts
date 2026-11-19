import { Request, Response } from 'express';
import { PlatformService } from './platform.service';

export class PlatformController {
  static async listPackages(_req: Request, res: Response) {
    try {
      res.status(200).json({ data: PlatformService.listPackages() });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }

  static async getStats(req: Request, res: Response) {
    try {
      const filters = {
        minUsers: req.query.minUsers ? Number(req.query.minUsers) : undefined,
        maxUsers: req.query.maxUsers ? Number(req.query.maxUsers) : undefined,
        packageKey: req.query.packageKey ? String(req.query.packageKey) : undefined,
        status: req.query.status ? String(req.query.status) : undefined,
      };
      const data = await PlatformService.getStatsSummary(filters);
      res.status(200).json({ data });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }

  static async listTenants(_req: Request, res: Response) {
    try {
      const data = await PlatformService.listTenants();
      res.status(200).json({ data });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }

  static async getTenant(req: Request, res: Response) {
    try {
      const tenant = await PlatformService.getTenant(String(req.params.id));
      res.status(200).json({ data: tenant });
    } catch (error: any) {
      res.status(error.message === 'Tenant not found' ? 404 : 500).json({ message: error.message });
    }
  }

  static async createTenant(req: Request, res: Response) {
    try {
      const tenant = await PlatformService.createTenant(req.body);
      const email = tenant.email;
      const message = email?.sent
        ? 'Tenant created and welcome email sent to admin.'
        : email?.skipped
          ? 'Tenant created (email skipped — configure RESEND_API_KEY).'
          : tenant.tenantAdmin
            ? `Tenant created (email failed: ${email?.message || 'unknown error'}).`
            : 'Tenant created without admin account.';
      res.status(201).json({ success: true, message, data: tenant });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  }

  static async getTenantCredentials(req: Request, res: Response) {
    try {
      const data = await PlatformService.getTenantCredentials(String(req.params.id));
      res.status(200).json({ data });
    } catch (error: any) {
      res.status(error.message === 'Tenant not found' ? 404 : 500).json({ message: error.message });
    }
  }

  static async updateTenant(req: Request, res: Response) {
    try {
      const tenant = await PlatformService.updateTenant(String(req.params.id), req.body);
      res.status(200).json({ success: true, data: tenant });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  }

  static async updateTenantPackage(req: Request, res: Response) {
    try {
      const tenant = await PlatformService.updateTenantPackage(String(req.params.id), req.body);
      res.status(200).json({ success: true, data: tenant });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  }

  static async updateTenantAdmin(req: Request, res: Response) {
    try {
      const data = await PlatformService.updateTenantAdmin(String(req.params.id), req.body);
      res.status(200).json({ success: true, data });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  }

  static async deleteTenant(req: Request, res: Response) {
    try {
      await PlatformService.deleteTenant(String(req.params.id));
      res.status(200).json({ success: true });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  }
}
