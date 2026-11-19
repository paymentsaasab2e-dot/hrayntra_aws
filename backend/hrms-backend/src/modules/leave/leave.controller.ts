import { Request, Response } from 'express';
import { LeaveService } from './leave.service';
import { logger } from '../../shared/logger';

export class LeaveController {
  static async apply(req: Request, res: Response) {
    try {
      const employeeId = (req as any).user?.employeeId || req.body.employeeId;
      const leave = await LeaveService.apply({ ...req.body, employeeId });
      logger.info('leave.apply.success', {
        leaveId: leave.id,
        employeeId,
        actorId: (req as any).user?.id
      });
      res.status(201).json({ success: true, data: leave });
    } catch (error: any) {
      logger.error('leave.apply.failed', {
        employeeId: (req as any).user?.employeeId || req.body?.employeeId,
        actorId: (req as any).user?.id,
        error: error?.message
      });
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async updateStatus(req: Request, res: Response) {
    try {
      const processedBy = (req as any).user.id;
      const { status, adminRemark } = req.body;
      const normalizedStatus = String(status || '').toUpperCase();
      const finalStatus = normalizedStatus === 'MODIFICATION_REQUESTED' ? 'REJECTED' : normalizedStatus;
      const finalRemark = normalizedStatus === 'MODIFICATION_REQUESTED'
        ? (adminRemark || 'Modification requested by approver')
        : adminRemark;
      const leave = await LeaveService.updateStatus(String(req.params.id), finalStatus, processedBy, finalRemark);
      logger.info('approval.leave.status_updated', {
        leaveId: req.params.id,
        requestedStatus: normalizedStatus,
        appliedStatus: finalStatus,
        processedBy,
        adminRemark: finalRemark
      });
      res.status(200).json({ success: true, data: leave, message: `Leave ${status} successfully` });
    } catch (error: any) {
      logger.error('approval.leave.status_update_failed', {
        leaveId: req.params.id,
        actorId: (req as any).user?.id,
        error: error?.message
      });
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async getMyLeaves(req: Request, res: Response) {
    try {
      const employeeId = (req as any).user.employeeId;
      const leaves = await LeaveService.getByEmployee(employeeId);
      res.status(200).json({ success: true, data: leaves });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async getBalance(req: Request, res: Response) {
    try {
      const employeeId = (req as any).user?.employeeId || req.params.employeeId;
      const balance = await LeaveService.getLeaveBalance(employeeId);
      res.json({ success: true, data: balance });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async cancel(req: Request, res: Response) {
    try {
      const employeeId = (req as any).user.employeeId;
      await LeaveService.cancel(String(req.params.id), employeeId);
      logger.info('leave.cancel.success', {
        leaveId: req.params.id,
        employeeId,
        actorId: (req as any).user?.id
      });
      res.json({ success: true, message: "Leave cancelled successfully" });
    } catch (error: any) {
      logger.error('leave.cancel.failed', {
        leaveId: req.params.id,
        actorId: (req as any).user?.id,
        error: error?.message
      });
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async getAll(req: Request, res: Response) {
    try {
      const filters: any = {};
      if (req.query.status) filters.status = req.query.status;
      if (req.query.userId) filters.employeeId = req.query.userId;
      
      const leaves = await LeaveService.getAll(filters, req.orgScope);
      res.status(200).json({ success: true, data: leaves });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async getWorkWeekRoster(req: Request, res: Response) {
    try {
      const tenantId = (req as any).user?.tenantId || req.orgScope?.tenantId;
      if (!tenantId) {
        return res.status(400).json({ success: false, message: 'Tenant context required' });
      }
      const year = req.query.year ? Number(req.query.year) : undefined;
      const month = req.query.month ? Number(req.query.month) : undefined;
      const roster = await LeaveService.getWorkWeekRoster(tenantId, year, month);
      res.status(200).json({ success: true, data: roster });
    } catch (error: any) {
      logger.error('leave.work_week_roster.failed', { error: error?.message });
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async updateWorkWeekRoster(req: Request, res: Response) {
    try {
      const tenantId = (req as any).user?.tenantId || req.orgScope?.tenantId;
      const userId = (req as any).user?.id;
      if (!tenantId) {
        return res.status(400).json({ success: false, message: 'Tenant context required' });
      }
      const { pattern, customWeekOffDays } = req.body;
      const updated = await LeaveService.updateWorkWeekRoster(tenantId, userId, {
        pattern,
        customWeekOffDays,
      });
      logger.info('leave.work_week_roster.updated', {
        tenantId,
        userId,
        pattern,
      });
      res.status(200).json({
        success: true,
        data: updated,
        message: 'Work week and weekend roster policy updated successfully',
      });
    } catch (error: any) {
      logger.error('leave.work_week_roster_update.failed', { error: error?.message });
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async calculateDays(req: Request, res: Response) {
    try {
      const tenantId = (req as any).user?.tenantId || req.orgScope?.tenantId;
      if (!tenantId) {
        return res.status(400).json({ success: false, message: 'Tenant context required' });
      }
      const { startDate, endDate, pattern } = req.body;
      if (!startDate || !endDate) {
        return res.status(400).json({ success: false, message: 'startDate and endDate are required' });
      }
      const result = await LeaveService.calculateDaysBreakdown(tenantId, startDate, endDate, pattern);
      res.status(200).json({ success: true, data: result });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async getRosterGrid(req: Request, res: Response) {
    try {
      const tenantId = (req as any).user?.tenantId || req.orgScope?.tenantId;
      if (!tenantId) {
        return res.status(400).json({ success: false, message: 'Tenant context required' });
      }
      const year = req.query.year ? Number(req.query.year) : undefined;
      const month = req.query.month ? Number(req.query.month) : undefined;
      const view = req.query.view as 'weekly' | 'monthly' | undefined;
      const weekIndex = req.query.weekIndex !== undefined ? Number(req.query.weekIndex) : undefined;
      const department = req.query.department as string | undefined;
      const search = req.query.search as string | undefined;

      const grid = await LeaveService.getRosterGrid(tenantId, {
        year,
        month,
        view,
        weekIndex,
        department,
        search,
      });
      res.status(200).json({ success: true, data: grid });
    } catch (error: any) {
      logger.error('leave.roster_grid.failed', { error: error?.message });
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async bulkAssignRoster(req: Request, res: Response) {
    try {
      const tenantId = (req as any).user?.tenantId || req.orgScope?.tenantId;
      const userId = (req as any).user?.id;
      if (!tenantId) {
        return res.status(400).json({ success: false, message: 'Tenant context required' });
      }
      const { employeeIds, department, pattern, shiftCode, customWeekOffDays, applyToAll } = req.body;
      const grid = await LeaveService.bulkAssignRoster(tenantId, userId, {
        employeeIds,
        department,
        pattern,
        shiftCode,
        customWeekOffDays,
        applyToAll,
      });
      logger.info('leave.roster_bulk_assign.success', {
        tenantId,
        userId,
        count: employeeIds?.length || department,
        pattern,
      });
      res.status(200).json({
        success: true,
        data: grid,
        message: 'Roster and weekly offs successfully assigned in bulk',
      });
    } catch (error: any) {
      logger.error('leave.roster_bulk_assign.failed', { error: error?.message });
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async overrideRosterCell(req: Request, res: Response) {
    try {
      const tenantId = (req as any).user?.tenantId || req.orgScope?.tenantId;
      const userId = (req as any).user?.id;
      if (!tenantId) {
        return res.status(400).json({ success: false, message: 'Tenant context required' });
      }
      const { employeeId, dateStr, shiftCode } = req.body;
      const result = await LeaveService.overrideRosterCell(tenantId, userId, {
        employeeId,
        dateStr,
        shiftCode,
      });
      res.status(200).json({ success: true, data: result, message: 'Cell shift updated' });
    } catch (error: any) {
      logger.error('leave.roster_cell_override.failed', { error: error?.message });
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async createRosterSchedule(req: Request, res: Response) {
    try {
      const tenantId = (req as any).user?.tenantId || req.orgScope?.tenantId;
      const userId = (req as any).user?.id;
      if (!tenantId) {
        return res.status(400).json({ success: false, message: 'Tenant context required' });
      }
      const {
        employeeIds,
        department,
        applyToAll,
        startDate,
        endDate,
        shiftCode,
        workingDays,
        saturdayRule,
      } = req.body;

      const result = await LeaveService.createRosterSchedule(tenantId, userId, {
        employeeIds,
        department,
        applyToAll,
        startDate,
        endDate,
        shiftCode,
        workingDays,
        saturdayRule,
      });

      logger.info('leave.roster_schedule.created', {
        tenantId,
        userId,
        employeesCount: result.employeesCount,
        daysCount: result.daysCount,
      });

      res.status(200).json({
        success: true,
        data: result,
        message: result.message,
      });
    } catch (error: any) {
      logger.error('leave.roster_schedule.failed', { error: error?.message });
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async getShifts(req: Request, res: Response) {
    try {
      const tenantId = (req as any).user?.tenantId || req.orgScope?.tenantId;
      if (!tenantId) {
        return res.status(400).json({ success: false, message: 'Tenant context required' });
      }
      const shifts = await LeaveService.getShifts(tenantId);
      res.status(200).json({ success: true, data: shifts });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async createOrUpdateShift(req: Request, res: Response) {
    try {
      const tenantId = (req as any).user?.tenantId || req.orgScope?.tenantId;
      const userId = (req as any).user?.id;
      if (!tenantId) {
        return res.status(400).json({ success: false, message: 'Tenant context required' });
      }
      const shifts = await LeaveService.createOrUpdateShift(tenantId, userId, req.body);
      res.status(200).json({ success: true, data: shifts, message: 'Shift updated successfully' });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async deleteShift(req: Request, res: Response) {
    try {
      const tenantId = (req as any).user?.tenantId || req.orgScope?.tenantId;
      const userId = (req as any).user?.id;
      if (!tenantId) {
        return res.status(400).json({ success: false, message: 'Tenant context required' });
      }
      const code = String(req.params.code);
      const shifts = await LeaveService.deleteShift(tenantId, userId, code);
      res.status(200).json({ success: true, data: shifts, message: 'Shift deleted successfully' });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async getTeamCalendar(req: Request, res: Response) {
    try {
      const { department, locationId, year, month } = req.query;
      const calendarData = await LeaveService.getTeamCalendar(req.orgScope!, {
        department: department ? String(department) : undefined,
        locationId: locationId ? String(locationId) : undefined,
        year: year ? parseInt(String(year), 10) : undefined,
        month: month ? parseInt(String(month), 10) : undefined,
      });
      res.status(200).json({ success: true, data: calendarData });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }
}


