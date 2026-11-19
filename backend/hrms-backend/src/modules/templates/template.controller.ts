import { Request, Response } from 'express';
import { TemplateService } from './template.service';

export class TemplateController {
  static async getAll(req: Request, res: Response) {
    try {
      const type = req.query.type as any;
      const templates = await TemplateService.getAll(req.orgScope!, type);
      res.json({ success: true, data: templates });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async getById(req: Request, res: Response) {
    try {
      const template = await TemplateService.getById(req.orgScope!, String(req.params.id));
      if (!template) return res.status(404).json({ success: false, message: 'Template not found' });
      res.json({ success: true, data: template });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async create(req: Request, res: Response) {
    try {
      const template = await TemplateService.create(req.orgScope!, req.body);
      res.status(201).json({ success: true, data: template });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async update(req: Request, res: Response) {
    try {
      const template = await TemplateService.update(req.orgScope!, String(req.params.id), req.body);
      res.json({ success: true, data: template });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async delete(req: Request, res: Response) {
    try {
      const result = await TemplateService.delete(req.orgScope!, String(req.params.id));
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async duplicate(req: Request, res: Response) {
    try {
      const { newName, newCode } = req.body;
      const result = await TemplateService.duplicate(req.orgScope!, String(req.params.id), newName, newCode);
      res.status(201).json({ success: true, data: result, message: 'Template duplicated successfully' });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async apply(req: Request, res: Response) {
    try {
      const result = await TemplateService.applyTemplate(req.orgScope!, String(req.params.id), req.body);
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async seedStandards(req: Request, res: Response) {
    try {
      const result = await TemplateService.seedStandardTemplates(req.orgScope!);
      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
}

