import { Request, Response } from 'express';
import { OrgUnitService } from './org-unit.service';

export class OrgUnitController {
  static async getTree(req: Request, res: Response) {
    try {
      const tree = await OrgUnitService.getTree(req.orgScope!);
      res.status(200).json({ data: tree });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }

  static async getById(req: Request, res: Response) {
    try {
      const unit = await OrgUnitService.getById(String(req.params.id), req.orgScope!);
      res.status(200).json(unit);
    } catch (error: any) {
      res.status(error.message.includes('not found') ? 404 : 403).json({ message: error.message });
    }
  }

  static async create(req: Request, res: Response) {
    try {
      const user = (req as any).user;
      const unit = await OrgUnitService.create(req.body, user, req.orgScope!);
      res.status(201).json(unit);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  }

  static async update(req: Request, res: Response) {
    try {
      const unit = await OrgUnitService.update(String(req.params.id), req.body, req.orgScope!);
      res.status(200).json(unit);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  }

  static async delete(req: Request, res: Response) {
    try {
      const user = (req as any).user;
      await OrgUnitService.delete(String(req.params.id), req.orgScope!, user.role);
      res.status(204).send();
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  }

  static async approve(req: Request, res: Response) {
    try {
      const user = (req as any).user;
      const unit = await OrgUnitService.approvePending(String(req.params.id), user);
      res.status(200).json(unit);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  }

  static async reject(req: Request, res: Response) {
    try {
      const user = (req as any).user;
      await OrgUnitService.rejectPending(String(req.params.id), user);
      res.status(200).json({ success: true });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  }
}
