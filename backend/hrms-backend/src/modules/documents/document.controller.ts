import { Request, Response } from 'express';
import { DocumentService } from './document.service';

export class DocumentController {
  static async getAll(req: Request, res: Response) {
    try {
      const filters: any = {};
      if (req.query.category) filters.category = req.query.category;
      if (req.query.employeeId) filters.employeeId = req.query.employeeId;
      if (req.query.status) filters.status = req.query.status;
      const docs = await DocumentService.getAll(req.orgScope!, filters);
      res.status(200).json({ success: true, data: docs });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async getById(req: Request, res: Response) {
    try {
      const doc = await DocumentService.getById(req.orgScope!, String(req.params.id));
      if (!doc) return res.status(404).json({ success: false, message: 'Document not found' });
      res.status(200).json({ success: true, data: doc });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async create(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.id || 'SYSTEM';
      const doc = await DocumentService.create(req.orgScope!, { ...req.body, uploadedBy: userId });
      res.status(201).json({ success: true, data: doc });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async update(req: Request, res: Response) {
    try {
      const doc = await DocumentService.update(req.orgScope!, String(req.params.id), req.body);
      res.status(200).json({ success: true, data: doc });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async archive(req: Request, res: Response) {
    try {
      const doc = await DocumentService.archive(req.orgScope!, String(req.params.id));
      res.status(200).json({ success: true, data: doc, message: 'Document archived' });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async delete(req: Request, res: Response) {
    try {
      await DocumentService.delete(req.orgScope!, String(req.params.id));
      res.status(200).json({ success: true, message: 'Document deleted' });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
}
