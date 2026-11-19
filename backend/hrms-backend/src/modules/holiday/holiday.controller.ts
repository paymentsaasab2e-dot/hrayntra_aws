import { Request, Response } from 'express';
import { HolidayService } from './holiday.service';

export class HolidayController {
  static async getAll(req: Request, res: Response) {
    try {
      const activeOnly = req.query.activeOnly === 'true';
      const holidays = await HolidayService.getAll(req.orgScope!, activeOnly);
      res.json({ success: true, data: holidays });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async create(req: Request, res: Response) {
    try {
      const holiday = await HolidayService.create(req.orgScope!, req.body);
      res.status(201).json({ success: true, data: holiday });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async bulkCreate(req: Request, res: Response) {
    try {
      const { holidays } = req.body;
      const result = await HolidayService.bulkCreate(req.orgScope!, holidays);
      res.status(201).json({ success: true, data: result });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async update(req: Request, res: Response) {
    try {
      const holiday = await HolidayService.update(req.orgScope!, String(req.params.id), req.body);
      res.json({ success: true, data: holiday });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async delete(req: Request, res: Response) {
    try {
      await HolidayService.delete(req.orgScope!, String(req.params.id));
      res.json({ success: true, message: 'Holiday deleted successfully' });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async previewCopy(req: Request, res: Response) {
    try {
      const sourceYear = parseInt(String(req.query.fromYear || new Date().getFullYear() - 1), 10);
      const targetYear = parseInt(String(req.query.toYear || new Date().getFullYear()), 10);
      const preview = await HolidayService.previewCopyFromLastYear(req.orgScope!, sourceYear, targetYear);
      res.json({ success: true, data: preview });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async executeCopy(req: Request, res: Response) {
    try {
      const { fromYear, toYear, selections } = req.body;
      const result = await HolidayService.copyFromLastYear(
        req.orgScope!,
        parseInt(String(fromYear), 10),
        parseInt(String(toYear), 10),
        selections
      );
      res.json({ success: true, data: result, message: `Copied ${result.copiedCount} holidays into ${toYear}` });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }
}
