import { Request, Response } from 'express';
import { AssetService } from './asset.service';
import { logger } from '../../shared/logger';

export class AssetController {
  static async getAll(req: Request, res: Response) {
    try {
      const assets = await AssetService.getAll(req.orgScope!);
      res.status(200).json({ success: true, data: assets });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async getById(req: Request, res: Response) {
    try {
      const asset = await AssetService.getById(req.orgScope!, String(req.params.id));
      if (!asset) return res.status(404).json({ success: false, message: 'Asset not found' });
      res.status(200).json({ success: true, data: asset });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async create(req: Request, res: Response) {
    try {
      const asset = await AssetService.create(req.orgScope!, req.body);
      logger.info('asset.create.success', {
        assetId: asset.id,
        serialNumber: asset.serialNumber,
        actorId: (req as any).user?.id,
      });
      res.status(201).json({ success: true, data: asset });
    } catch (error: any) {
      logger.error('asset.create.failed', {
        actorId: (req as any).user?.id,
        error: error?.message,
      });
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async update(req: Request, res: Response) {
    try {
      const asset = await AssetService.update(req.orgScope!, String(req.params.id), req.body);
      logger.info('asset.update.success', {
        assetId: String(req.params.id),
        actorId: (req as any).user?.id,
      });
      res.status(200).json({ success: true, data: asset });
    } catch (error: any) {
      logger.error('asset.update.failed', {
        assetId: String(req.params.id),
        actorId: (req as any).user?.id,
        error: error?.message,
      });
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async delete(req: Request, res: Response) {
    try {
      await AssetService.delete(req.orgScope!, String(req.params.id));
      logger.info('asset.delete.success', {
        assetId: String(req.params.id),
        actorId: (req as any).user?.id,
      });
      res.status(200).json({ success: true, message: 'Asset deleted' });
    } catch (error: any) {
      logger.error('asset.delete.failed', {
        assetId: String(req.params.id),
        actorId: (req as any).user?.id,
        error: error?.message,
      });
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async getAllocations(req: Request, res: Response) {
    try {
      const allocations = await AssetService.getAllocations(req.orgScope!);
      res.status(200).json({ success: true, data: allocations });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async assignAsset(req: Request, res: Response) {
    try {
      const allocation = await AssetService.assignAsset(req.orgScope!, req.body);
      logger.info('asset.assign.success', {
        allocationId: allocation.id,
        assetId: allocation.assetId,
        employeeId: allocation.employeeId,
        actorId: (req as any).user?.id,
      });
      res.status(201).json({ success: true, data: allocation });
    } catch (error: any) {
      logger.error('asset.assign.failed', {
        assetId: req.body?.assetId,
        employeeId: req.body?.employeeId,
        actorId: (req as any).user?.id,
        error: error?.message,
      });
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async returnAsset(req: Request, res: Response) {
    try {
      const allocation = await AssetService.returnAsset(req.orgScope!, String(req.params.id), req.body);
      logger.info('asset.return.success', {
        allocationId: String(req.params.id),
        assetId: allocation.assetId,
        actorId: (req as any).user?.id,
      });
      res.status(200).json({ success: true, data: allocation });
    } catch (error: any) {
      logger.error('asset.return.failed', {
        allocationId: String(req.params.id),
        actorId: (req as any).user?.id,
        error: error?.message,
      });
      res.status(400).json({ success: false, message: error.message });
    }
  }
}
