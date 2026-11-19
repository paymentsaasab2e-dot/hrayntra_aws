import { Request, Response } from 'express';
import { FieldVisitService } from './field-visit.service';

function localDateKey(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export class FieldVisitController {
  static async listVisitLocations(req: Request, res: Response) {
    try {
      const activeOnly = req.query.activeOnly === 'true';
      const data = await FieldVisitService.listVisitLocations(activeOnly);
      res.status(200).json({ data });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }

  static async listRoster(req: Request, res: Response) {
    try {
      const dateKey = String(req.query.date || localDateKey());
      const employeeId = req.query.employeeId ? String(req.query.employeeId) : undefined;
      const scope = req.orgScope;
      const data = await FieldVisitService.listRoster(
        dateKey,
        scope?.scopedEmployeeIds ?? null,
        employeeId
      );
      res.status(200).json({ data });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  }

  static async assignRoster(req: Request, res: Response) {
    try {
      const body = req.body;
      const data = await FieldVisitService.assignRoster({
        dateKey: body.dateKey,
        employeeId: body.employeeId,
        locationIds: body.locationIds || body.stopIds || [],
        plannedTimes: body.plannedTimes,
      });
      res.status(201).json({ success: true, data });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  }

  static async removeAssignment(req: Request, res: Response) {
    try {
      await FieldVisitService.removeAssignment(String(req.params.id));
      res.status(200).json({ success: true });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  }

  static async getMineToday(req: Request, res: Response) {
    try {
      const user = (req as any).user;
      const data = await FieldVisitService.getMineToday(user.id);
      res.status(200).json({ data });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }

  static async verifyVisit(req: Request, res: Response) {
    try {
      const user = (req as any).user;
      const isHr = ['ADMIN', 'HR', 'MANAGER'].includes(user.role);
      const { lat, lng } = req.body;
      const data = await FieldVisitService.verifyVisit(
        String(req.params.id),
        user.id,
        lat,
        lng,
        isHr && req.body.hrOverride === true
      );
      res.status(200).json({ success: true, data });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  }

  static async markMissed(req: Request, res: Response) {
    try {
      const data = await FieldVisitService.markMissed(String(req.params.id));
      res.status(200).json({ success: true, data });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  }

  static async recordPing(req: Request, res: Response) {
    try {
      const user = (req as any).user;
      const { lat, lng } = req.body;
      const data = await FieldVisitService.recordPing(user.id, lat, lng);
      res.status(201).json({ success: true, data });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  }

  static async getLive(req: Request, res: Response) {
    try {
      const dateKey = String(req.query.date || localDateKey());
      const scope = req.orgScope;
      const data = await FieldVisitService.getLiveSnapshot(dateKey, scope?.scopedEmployeeIds ?? null);
      res.status(200).json({ data });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  }
}
