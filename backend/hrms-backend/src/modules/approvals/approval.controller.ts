import { Request, Response } from 'express';
import { ApprovalService } from './approval.service';

export class ApprovalController {
  static async getInbox(req: Request, res: Response) {
    try {
      const user = (req as any).user;
      const inbox = await ApprovalService.getInboxEnriched(req.orgScope!, user);
      res.status(200).json({ data: inbox });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }

  static async act(req: Request, res: Response) {
    try {
      const user = (req as any).user;
      const { action, remark, approvedLWD } = req.body;
      if (!['approve', 'reject'].includes(action)) {
        return res.status(400).json({ message: 'action must be approve or reject' });
      }
      const result = await ApprovalService.actOnRequest(
        String(req.params.id),
        action,
        user,
        req.orgScope!,
        remark,
        approvedLWD
      );
      res.status(200).json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  }
}
