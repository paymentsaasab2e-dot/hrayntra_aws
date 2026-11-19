import { Request, Response } from 'express';
import { LocationService } from './location.service';

export class LocationController {
  static async getAll(req: Request, res: Response) {
    try {
      const activeOnly = req.query.activeOnly === 'true';
      const locations = await LocationService.getAll(req.orgScope!, activeOnly);
      res.status(200).json({ success: true, data: locations });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async getById(req: Request, res: Response) {
    try {
      const location = await LocationService.getById(req.orgScope!, String(req.params.id));
      res.status(200).json({ success: true, data: location });
    } catch (error: any) {
      res.status(404).json({ success: false, message: error.message });
    }
  }

  static async create(req: Request, res: Response) {
    try {
      const location = await LocationService.create(req.orgScope!, req.body);
      res.status(201).json({ success: true, data: location });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async update(req: Request, res: Response) {
    try {
      const location = await LocationService.update(req.orgScope!, String(req.params.id), req.body);
      res.status(200).json({ success: true, data: location });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async delete(req: Request, res: Response) {
    try {
      await LocationService.delete(req.orgScope!, String(req.params.id));
      res.status(200).json({ success: true });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }
}
