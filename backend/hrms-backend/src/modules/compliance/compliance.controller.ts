import { Request, Response } from 'express';
import { ComplianceService } from './compliance.service';

export class ComplianceController {
  static async listDocuments(req: Request, res: Response) {
    try {
      const tenantId = req.orgScope?.tenantId;
      if (!tenantId) return res.status(400).json({ success: false, message: 'Tenant context required' });
      const userId = (req as any).user?.id;
      const documents = await ComplianceService.listDocuments(tenantId, userId);
      res.json({ success: true, data: documents });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async seedStandards(req: Request, res: Response) {
    try {
      const tenantId = req.orgScope?.tenantId;
      if (!tenantId) return res.status(400).json({ success: false, message: 'Tenant context required' });
      const userId = (req as any).user?.id;
      const seeded = await ComplianceService.seedDefaultDocuments(tenantId, userId);
      res.json({ success: true, message: `Seeded ${seeded.length} standard legal documents`, data: seeded });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async getPendingAcceptances(req: Request, res: Response) {
    try {
      const tenantId = req.orgScope?.tenantId;
      if (!tenantId) return res.status(400).json({ success: false, message: 'Tenant context required' });
      const userId = (req as any).user?.id;
      const pending = await ComplianceService.getPendingAcceptances(tenantId, userId);
      res.json({ success: true, count: pending.length, data: pending });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async acceptDocument(req: Request, res: Response) {
    try {
      const tenantId = req.orgScope?.tenantId;
      if (!tenantId) return res.status(400).json({ success: false, message: 'Tenant context required' });
      const user = (req as any).user;
      const { documentId, metadata } = req.body;

      if (!documentId) {
        return res.status(400).json({ success: false, message: 'documentId is required' });
      }

      const clientIp =
        (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() ||
        req.socket.remoteAddress ||
        req.ip ||
        '127.0.0.1';
      const userAgent = (req.headers['user-agent'] as string) || 'HRMS-Web-Client';

      const result = await ComplianceService.acceptDocument({
        tenantId,
        userId: user.id,
        employeeId: user.employeeId || null,
        documentId,
        ipAddress: clientIp,
        userAgent,
        metadata,
      });

      res.json({
        success: true,
        message: result.alreadyAccepted ? 'Already accepted this document version' : 'Document successfully accepted',
        data: result,
      });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async acceptAllPending(req: Request, res: Response) {
    try {
      const tenantId = req.orgScope?.tenantId;
      if (!tenantId) return res.status(400).json({ success: false, message: 'Tenant context required' });
      const user = (req as any).user;

      const clientIp =
        (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() ||
        req.socket.remoteAddress ||
        req.ip ||
        '127.0.0.1';
      const userAgent = (req.headers['user-agent'] as string) || 'HRMS-Web-Client';

      const result = await ComplianceService.acceptAllPending({
        tenantId,
        userId: user.id,
        employeeId: user.employeeId || null,
        ipAddress: clientIp,
        userAgent,
      });

      res.json({
        success: true,
        message: `Successfully accepted ${result.count} pending compliance documents`,
        data: result,
      });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async publishNewVersion(req: Request, res: Response) {
    try {
      const tenantId = req.orgScope?.tenantId;
      if (!tenantId) return res.status(400).json({ success: false, message: 'Tenant context required' });
      const userId = (req as any).user?.id;
      const documentId = req.params.id as string;
      const { newVersion, title, content, summary, effectiveDate, isMandatory } = req.body;

      if (!newVersion) {
        return res.status(400).json({ success: false, message: 'newVersion is required (e.g. "2.0")' });
      }

      const updated = await ComplianceService.publishNewVersion(
        tenantId,
        documentId,
        { newVersion, title, content, summary, effectiveDate, isMandatory },
        userId
      );

      res.json({
        success: true,
        message: `Published new version ${newVersion} successfully`,
        data: updated,
      });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async getAcceptanceAuditTrail(req: Request, res: Response) {
    try {
      const tenantId = req.orgScope?.tenantId;
      if (!tenantId) return res.status(400).json({ success: false, message: 'Tenant context required' });
      const { documentId, documentType, userId, page, limit } = req.query;

      const result = await ComplianceService.getAcceptanceAuditTrail(tenantId, {
        documentId: documentId as string,
        documentType: documentType as string,
        userId: userId as string,
        page: page ? parseInt(page as string, 10) : 1,
        limit: limit ? parseInt(limit as string, 10) : 50,
      });

      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async getComplianceOverview(req: Request, res: Response) {
    try {
      const tenantId = req.orgScope?.tenantId;
      if (!tenantId) return res.status(400).json({ success: false, message: 'Tenant context required' });
      const stats = await ComplianceService.getComplianceOverview(tenantId);
      res.json({ success: true, data: stats });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
}
