import { Request, Response } from 'express';
import { PerformanceService } from './performance.service';
import { logger } from '../../shared/logger';

export class PerformanceController {
  static async getAll(req: Request, res: Response) {
    try {
      const filters: any = {};
      if (req.query.employeeId) filters.employeeId = req.query.employeeId;
      if (req.query.status) filters.status = req.query.status;
      if (req.query.cycleType) filters.cycleType = req.query.cycleType;
      const reviews = await PerformanceService.getAll(req.orgScope!, filters);
      res.status(200).json({ success: true, data: reviews });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async getById(req: Request, res: Response) {
    try {
      const review = await PerformanceService.getById(req.orgScope!, String(req.params.id));
      if (!review) return res.status(404).json({ success: false, message: 'Review not found' });
      res.status(200).json({ success: true, data: review });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async compute(req: Request, res: Response) {
    try {
      const { employeeId, cycle, cycleType, managerScore } = req.body;
      if (!employeeId || !cycle) {
        return res.status(400).json({ success: false, message: 'employeeId and cycle are required' });
      }
      const result = await PerformanceService.computeForEmployee(
        req.orgScope!,
        employeeId,
        cycle,
        cycleType || 'quarterly',
        managerScore || 0
      );
      res.status(200).json({ success: true, data: result });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async refresh(req: Request, res: Response) {
    try {
      const review = await PerformanceService.refreshReview(req.orgScope!, String(req.params.id));
      logger.info('performance.refresh.success', {
        reviewId: String(req.params.id),
        actorId: (req as any).user?.id,
      });
      res.status(200).json({ success: true, data: review, message: 'Scores refreshed' });
    } catch (error: any) {
      logger.error('performance.refresh.failed', {
        reviewId: String(req.params.id),
        actorId: (req as any).user?.id,
        error: error?.message,
      });
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async getAnalytics(req: Request, res: Response) {
    try {
      const cycle = String(req.query.cycle || '');
      const cycleType = String(req.query.cycleType || 'quarterly');
      if (!cycle) {
        return res.status(400).json({ success: false, message: 'cycle query param is required' });
      }
      const analytics = await PerformanceService.computeTeamAnalytics(
        req.orgScope!,
        cycle,
        cycleType as any
      );
      res.status(200).json({ success: true, data: analytics });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async getMyReviews(req: Request, res: Response) {
    try {
      const employeeId = (req as any).user?.employeeId;
      if (!employeeId) return res.status(400).json({ success: false, message: 'Employee ID required' });
      const reviews = await PerformanceService.getByEmployee(req.orgScope!, employeeId);
      res.status(200).json({ success: true, data: reviews });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async create(req: Request, res: Response) {
    try {
      const review = await PerformanceService.create(req.orgScope!, req.body);
      logger.info('performance.create.success', {
        reviewId: review.id,
        employeeId: req.body?.employeeId,
        actorId: (req as any).user?.id,
      });
      res.status(201).json({ success: true, data: review });
    } catch (error: any) {
      logger.error('performance.create.failed', {
        employeeId: req.body?.employeeId,
        actorId: (req as any).user?.id,
        error: error?.message,
      });
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async update(req: Request, res: Response) {
    try {
      const review = await PerformanceService.update(req.orgScope!, String(req.params.id), req.body);
      logger.info('performance.update.success', {
        reviewId: String(req.params.id),
        actorId: (req as any).user?.id,
      });
      res.status(200).json({ success: true, data: review });
    } catch (error: any) {
      logger.error('performance.update.failed', {
        reviewId: String(req.params.id),
        actorId: (req as any).user?.id,
        error: error?.message,
      });
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async submitSelfReview(req: Request, res: Response) {
    try {
      const review = await PerformanceService.submitSelfReview(req.orgScope!, String(req.params.id), req.body);
      logger.info('performance.self_review_submitted', {
        reviewId: String(req.params.id),
        employeeId: (req as any).user?.employeeId,
        actorId: (req as any).user?.id,
      });
      res.status(200).json({ success: true, data: review, message: 'Self review submitted' });
    } catch (error: any) {
      logger.error('performance.self_review_failed', {
        reviewId: String(req.params.id),
        actorId: (req as any).user?.id,
        error: error?.message,
      });
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async submitManagerReview(req: Request, res: Response) {
    try {
      const managerId = (req as any).user?.id;
      const review = await PerformanceService.submitManagerReview(req.orgScope!, String(req.params.id), {
        ...req.body,
        managerId,
      });
      logger.info('approval.performance.review_submitted', {
        reviewId: String(req.params.id),
        managerId,
        rating: req.body?.rating,
      });
      res.status(200).json({ success: true, data: review, message: 'Manager review submitted' });
    } catch (error: any) {
      logger.error('approval.performance.review_failed', {
        reviewId: String(req.params.id),
        actorId: (req as any).user?.id,
        error: error?.message,
      });
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async delete(req: Request, res: Response) {
    try {
      await PerformanceService.delete(req.orgScope!, String(req.params.id));
      logger.info('performance.delete.success', {
        reviewId: String(req.params.id),
        actorId: (req as any).user?.id,
      });
      res.status(200).json({ success: true, message: 'Review deleted' });
    } catch (error: any) {
      logger.error('performance.delete.failed', {
        reviewId: String(req.params.id),
        actorId: (req as any).user?.id,
        error: error?.message,
      });
      res.status(500).json({ success: false, message: error.message });
    }
  }
}
