import { Request, Response } from 'express';
import { AttendanceBulkService } from './attendance-bulk.service';

export class AttendanceBulkController {
  static async getTemplate(req: Request, res: Response) {
    try {
      const csv = AttendanceBulkService.getSampleTemplate();
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="attendance_import_template.csv"');
      res.send(csv);
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  static async validate(req: Request, res: Response) {
    try {
      const rows = req.body.rows || [];
      if (!Array.isArray(rows) || rows.length === 0) {
        return res.status(400).json({ success: false, message: 'Array of attendance rows is required' });
      }

      const result = await AttendanceBulkService.validateRows(req.orgScope!, rows);
      res.json({ success: true, data: result });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  }

  static async commit(req: Request, res: Response) {
    try {
      const { fileName = 'attendance_batch.csv', rows = [] } = req.body;
      if (!Array.isArray(rows) || rows.length === 0) {
        return res.status(400).json({ success: false, message: 'Array of attendance rows is required' });
      }

      const uploadedBy = (req.orgScope as any)?.userId || (req as any).user?.id;
      const result = await AttendanceBulkService.commitBatch(req.orgScope!, {
        fileName,
        rows,
        uploadedBy,
      });

      res.status(201).json(result);
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  }
}
