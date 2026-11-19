import { Request, Response } from 'express';
import { OrgChartService } from './org-chart.service';

export class OrgChartController {
  static async getReportingTree(req: Request, res: Response) {
    try {
      const rootEmployeeId = req.query.rootEmployeeId as string | undefined;
      const data = await OrgChartService.getReportingTree(req.orgScope!, rootEmployeeId);
      res.status(200).json({ success: true, data });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async getCelebrations(req: Request, res: Response) {
    try {
      const month = req.query.month !== undefined ? parseInt(String(req.query.month), 10) : undefined;
      const timeframe = req.query.timeframe as any;
      const type = req.query.type as any;

      const data = await OrgChartService.getCelebrations(req.orgScope!, {
        month: isNaN(month as any) ? undefined : month,
        timeframe,
        type,
      });
      res.status(200).json({ success: true, data });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async sendCelebrationWish(req: Request, res: Response) {
    try {
      const senderUserId = (req as any).user?.id || (req as any).user?.userId;
      const { targetEmployeeId, type, message, greetingType } = req.body;

      if (!targetEmployeeId) {
        return res.status(400).json({ success: false, message: 'Target employee ID is required' });
      }
      if (!message || !message.trim()) {
        return res.status(400).json({ success: false, message: 'A celebration message is required' });
      }

      const wish = await OrgChartService.sendCelebrationWish(
        req.orgScope!,
        senderUserId,
        targetEmployeeId,
        { type, message, greetingType }
      );

      res.status(201).json({ success: true, data: wish, message: 'Celebration greeting sent successfully!' });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async getCelebrationWishes(req: Request, res: Response) {
    try {
      const targetEmployeeId = req.query.employeeId as string | undefined;
      const wishes = await OrgChartService.getCelebrationWishes(req.orgScope!, targetEmployeeId);
      res.status(200).json({ success: true, data: wishes });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
}

