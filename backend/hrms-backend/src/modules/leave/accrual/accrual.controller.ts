import { Request, Response } from 'express';
import { AccrualEngineService } from './accrual-engine.service';

export class AccrualController {
  static async listPlans(req: Request, res: Response) {
    try {
      const plans = await AccrualEngineService.listPlans(req.orgScope!);
      res.json({ success: true, data: plans });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async upsertPlan(req: Request, res: Response) {
    try {
      const plan = await AccrualEngineService.upsertPlan(req.orgScope!, req.body);
      res.json({ success: true, data: plan, message: 'Leave accrual plan saved successfully' });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async deletePlan(req: Request, res: Response) {
    try {
      const result = await AccrualEngineService.deletePlan(req.orgScope!, req.params.id);
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async previewAccrual(req: Request, res: Response) {
    try {
      const asOfDate = req.query.asOfDate ? new Date(String(req.query.asOfDate)) : new Date();
      const employeeId = req.query.employeeId as string | undefined;
      const planId = req.query.planId as string | undefined;
      const department = req.query.department as string | undefined;
      const preview = await AccrualEngineService.runAccrualEngine(req.orgScope!, {
        asOfDate,
        employeeId,
        planId,
        department,
        commit: false,
      });
      res.json({ success: true, data: preview });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async runAccrualNow(req: Request, res: Response) {
    try {
      const asOfDate = req.body.asOfDate ? new Date(req.body.asOfDate) : new Date();
      const employeeId = req.body.employeeId as string | undefined;
      const planId = req.body.planId as string | undefined;
      const department = req.body.department as string | undefined;
      const force = !!req.body.force;

      const result = await AccrualEngineService.runAccrualEngine(req.orgScope!, {
        asOfDate,
        employeeId,
        planId,
        department,
        commit: true,
        force,
      });
      res.json({
        success: true,
        data: result,
        message: `Accrual completed: Applied ${result.stats.totalCreditsApplied} leave days across ${result.stats.totalEmployeesEvaluated} employees`,
      });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async previewYearEnd(req: Request, res: Response) {
    try {
      const cycleYear = parseInt(String(req.query.cycleYear || new Date().getFullYear()), 10);
      const planId = req.query.planId as string | undefined;
      const department = req.query.department as string | undefined;
      const preview = await AccrualEngineService.runYearEndJob(req.orgScope!, {
        cycleYear,
        planId,
        department,
        commit: false,
      });
      res.json({ success: true, data: preview });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async executeYearEnd(req: Request, res: Response) {
    try {
      const cycleYear = parseInt(String(req.body.cycleYear || new Date().getFullYear()), 10);
      const planId = req.body.planId as string | undefined;
      const department = req.body.department as string | undefined;
      const result = await AccrualEngineService.runYearEndJob(req.orgScope!, {
        cycleYear,
        planId,
        department,
        commit: true,
      });
      res.json({
        success: true,
        data: result,
        message: `Year-end reconciliation completed: Carried forward ${result.stats.totalCarried} days, Lapsed ${result.stats.totalLapsed} days`,
      });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async requestEncashment(req: Request, res: Response) {
    try {
      const encashment = await AccrualEngineService.requestEncashment(req.orgScope!, {
        employeeId: req.body.employeeId,
        daysToEncash: Number(req.body.daysToEncash),
        planId: req.body.planId as string | undefined,
        ratePerDay: req.body.ratePerDay ? Number(req.body.ratePerDay) : undefined,
        remarks: req.body.remarks || req.body.reason,
        reason: req.body.reason,
      });
      res.status(201).json({
        success: true,
        data: encashment,
        message: `Encashment request for ${encashment.daysToEncash} days (₹${encashment.totalAmount}) approved & debited from balance`,
      });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async getLedger(req: Request, res: Response) {
    try {
      const employeeId = req.query.employeeId as string | undefined;
      const ledger = await AccrualEngineService.getLedger(req.orgScope!, employeeId);
      res.json({ success: true, data: ledger });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async importOpeningBalances(req: Request, res: Response) {
    try {
      const { rows } = req.body;
      const result = await AccrualEngineService.importOpeningBalances(req.orgScope!, rows);
      res.status(200).json({
        success: true,
        data: result,
        message: `Opening balances imported: ${result.successCount} successful, ${result.failureCount} failed`,
      });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async listLopReversals(req: Request, res: Response) {
    try {
      const { status, employeeId, month } = req.query;
      const reversals = await AccrualEngineService.listLopReversals(req.orgScope!, {
        status: status ? String(status) : undefined,
        employeeId: employeeId ? String(employeeId) : undefined,
        month: month ? String(month) : undefined,
      });
      res.status(200).json({ success: true, data: reversals });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async markLopRefunded(req: Request, res: Response) {
    try {
      const { cycleMonth } = req.body;
      const result = await AccrualEngineService.markLopRefunded(req.orgScope!, String(req.params.id), cycleMonth);
      res.status(200).json(result);
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }
}

