import { Request, Response } from 'express';
import { CustomFieldService } from './custom-field.service';

export class CustomFieldController {
  static async list(req: Request, res: Response) {
    try {
      const includeInactive = req.query.includeInactive === 'true';
      const items = await CustomFieldService.listDefinitions(req.orgScope!, includeInactive);
      res.status(200).json({ success: true, data: items });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async create(req: Request, res: Response) {
    try {
      const item = await CustomFieldService.createDefinition(req.orgScope!, req.body);
      res.status(201).json({ success: true, data: item });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async update(req: Request, res: Response) {
    try {
      const item = await CustomFieldService.updateDefinition(req.orgScope!, String(req.params.id), req.body);
      res.status(200).json({ success: true, data: item });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async delete(req: Request, res: Response) {
    try {
      await CustomFieldService.deleteDefinition(req.orgScope!, String(req.params.id));
      res.status(200).json({ success: true, message: 'Custom field deleted successfully' });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async seedDefaults(req: Request, res: Response) {
    try {
      const tenantId = req.orgScope?.tenantId;
      if (!tenantId) {
        return res.status(400).json({ success: false, message: 'Tenant ID required' });
      }
      await CustomFieldService.seedDefaults(tenantId);
      const items = await CustomFieldService.listDefinitions(req.orgScope!, true);
      res.status(200).json({ success: true, data: items, message: 'Default templates seeded' });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async updateEmployeeValues(req: Request, res: Response) {
    try {
      const updated = await CustomFieldService.updateEmployeeCustomFields(
        req.orgScope!,
        String(req.params.employeeId),
        req.body
      );
      res.status(200).json({ success: true, data: updated, message: 'Custom fields saved' });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }
}
