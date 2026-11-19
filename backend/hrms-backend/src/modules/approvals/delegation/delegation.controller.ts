import { Request, Response } from 'express';
import { DelegationService } from './delegation.service';

export class DelegationController {
  static async list(req: Request, res: Response) {
    try {
      const userId = (req.query.myOnly === 'true') ? (req as any).user?.id : undefined;
      const data = await DelegationService.listDelegations(req.orgScope!, userId);
      res.json({ success: true, data });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  }

  static async create(req: Request, res: Response) {
    try {
      const delegatorUserId = (req as any).user?.id;
      if (!delegatorUserId) {
        return res.status(401).json({ success: false, message: 'Authentication required' });
      }

      const delegation = await DelegationService.createDelegation(req.orgScope!, delegatorUserId, req.body);
      res.status(201).json({
        success: true,
        data: delegation,
        message: `Approval authority successfully delegated to ${delegation.delegatee.name}`,
      });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  }

  static async revoke(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        return res.status(401).json({ success: false, message: 'Authentication required' });
      }

      const result = await DelegationService.revokeDelegation(
        req.orgScope!,
        String(req.params.id),
        userId
      );
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  }
}
