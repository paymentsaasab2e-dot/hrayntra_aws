import { Request, Response } from 'express';
import { AttendanceService } from './attendance.service';
import prisma from '../../shared/prisma';
import { logger } from '../../shared/logger';

export class AttendanceController {
  static async checkIn(req: Request, res: Response) {
    try {
      // In a real app, employeeId would come from req.user
      const rawEmployeeId = req.body.employeeId || (req as any).user?.employeeId;
      if (!rawEmployeeId) {
        logger.warn('attendance.check_in.validation_failed', { reason: 'employee_id_missing' });
        return res.status(400).json({ success: false, message: "Employee ID is required" });
      }
      const employeeId = await AttendanceService.resolveEmployeeId(rawEmployeeId);
      const punchMode = req.body.punchMode || (req.file ? 'manual' : 'WEB');
      const userPermissions = (req as any).user?.permissions;
      const isSelfPunch = String(employeeId) === String((req as any).user?.employeeId);
      const hrBypass = !isSelfPunch && userPermissions?.actions?.attendance_punch_hr === true;

      const canRemoteSelf = userPermissions?.actions?.attendance_punch_remote_self === true;
      const remoteAllowed = punchMode === 'remote' ? (isSelfPunch ? canRemoteSelf : hrBypass) : false;

      // If remote punch is attempted and not allowed, force geofence enforcement.
      const skipGeofence = punchMode === 'remote'
        ? remoteAllowed
        : (req.body.skipGeofence === true || hrBypass);

      const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket?.remoteAddress || req.ip || '127.0.0.1';
      const userAgent = (req.headers['user-agent'] as string) || 'Web Browser';

      const record = await AttendanceService.checkIn(employeeId, {
        lat: req.body.lat ?? req.body.latitude,
        lng: req.body.lng ?? req.body.longitude,
        latitude: req.body.latitude ?? req.body.lat,
        longitude: req.body.longitude ?? req.body.lng,
        skipGeofence,
        punchMode,
        punchInTime: req.body.punchInTime,
        accuracy: req.body.accuracy !== undefined ? Number(req.body.accuracy) : undefined,
        ipAddress: req.body.ipAddress || clientIp,
        deviceInfo: req.body.deviceInfo || userAgent,
        browser: req.body.browser || userAgent,
      });
      logger.info('attendance.check_in.success', {
        employeeId,
        attendanceId: record.id,
        actorId: (req as any).user?.id
      });
      res.status(201).json({ success: true, message: 'Attendance Marked', data: record, isActive: record.isActive });
    } catch (error: any) {
      logger.error('attendance.check_in.failed', {
        actorId: (req as any).user?.id,
        error: error?.message
      });
      const status = error.statusCode || 400;
      res.status(status).json({
        success: false,
        message: error.message,
        ...(error.data || {}),
      });
    }
  }

  static async checkOut(req: Request, res: Response) {
    try {
      const id = req.params.id as string;

      const punchMode = req.body.punchMode || (req.file ? 'manual' : 'WEB');
      const userPermissions = (req as any).user?.permissions;
      const attendanceRecord = await prisma.attendance.findUnique({ where: { id }, select: { employeeId: true } });
      if (!attendanceRecord) throw new Error('Attendance record not found');

      const isSelfPunch = String(attendanceRecord.employeeId) === String((req as any).user?.employeeId);
      const hrBypass = !isSelfPunch && userPermissions?.actions?.attendance_punch_hr === true;

      const canRemoteSelf = userPermissions?.actions?.attendance_punch_remote_self === true;
      const remoteAllowed = punchMode === 'remote'
        ? (isSelfPunch ? canRemoteSelf : hrBypass)
        : false;

      const skipGeofence = punchMode === 'remote'
        ? remoteAllowed
        : (req.body.skipGeofence === true || hrBypass);

      const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket?.remoteAddress || req.ip || '127.0.0.1';
      const userAgent = (req.headers['user-agent'] as string) || 'Web Browser';

      const record = await AttendanceService.checkOut(id, {
        lat: req.body.lat ?? req.body.latitude,
        lng: req.body.lng ?? req.body.longitude,
        latitude: req.body.latitude ?? req.body.lat,
        longitude: req.body.longitude ?? req.body.lng,
        skipGeofence,
        punchMode,
        punchOutTime: req.body.punchOutTime,
        accuracy: req.body.accuracy !== undefined ? Number(req.body.accuracy) : undefined,
        ipAddress: req.body.ipAddress || clientIp,
        deviceInfo: req.body.deviceInfo || userAgent,
        browser: req.body.browser || userAgent,
      });
      logger.info('attendance.check_out.success', {
        attendanceId: id,
        employeeId: record.employeeId,
        actorId: (req as any).user?.id
      });
      res.status(200).json({ success: true, message: 'Checked out successfully', data: record, isActive: false });
    } catch (error: any) {
      logger.error('attendance.check_out.failed', {
        attendanceId: req.params.id,
        actorId: (req as any).user?.id,
        error: error?.message
      });
      const status = error.statusCode || 400;
      res.status(status).json({
        success: false,
        message: error.message,
        ...(error.data || {}),
      });
    }
  }

  static async getTodayStatus(req: Request, res: Response) {
    try {
      const user = (req as any).user;
      const queryEmployeeId = req.query.employeeId as string | undefined;
      const canViewOthers = user?.role === 'ADMIN' || user?.role === 'HR';
      const employeeId = canViewOthers && queryEmployeeId ? queryEmployeeId : user?.employeeId;
      if (!employeeId) {
        return res.status(400).json({ success: false, message: "Employee ID is required" });
      }
      const status = await AttendanceService.getTodayStatus(employeeId);
      res.json({ success: true, ...status });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async getHistory(req: Request, res: Response) {
    try {
      const scope = req.orgScope;
      const employeeId = scope?.employeeSelfOnly ? (req as any).user?.employeeId : undefined;
      const history = await AttendanceService.getHistory(employeeId, scope);
      res.status(200).json({ success: true, data: history });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async submitRequest(req: Request, res: Response) {
    try {
      const tenantId = req.orgScope?.tenantId || (req as any).user?.tenantId || 'default-tenant';
      const userId = (req as any).user?.id || 'system';
      const rawEmployeeId = req.body.employeeId || (req as any).user?.employeeId;
      if (!rawEmployeeId) {
        return res.status(400).json({ success: false, message: 'Employee ID is required' });
      }
      const record = await AttendanceService.submitAttendanceRequest(tenantId, userId, rawEmployeeId, req.body);
      res.status(201).json({ success: true, message: `${req.body.type || 'Attendance'} request submitted successfully`, data: record });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async getRequests(req: Request, res: Response) {
    try {
      const tenantId = req.orgScope?.tenantId || (req as any).user?.tenantId || 'default-tenant';
      const user = (req as any).user;
      const canViewOthers = user?.role === 'ADMIN' || user?.role === 'HR' || user?.role === 'MANAGER' || user?.role === 'SUPERADMIN';
      const employeeId = canViewOthers ? (req.query.employeeId as string | undefined) : user?.employeeId;
      const status = req.query.status as string | undefined;
      const type = req.query.type as string | undefined;

      const list = await AttendanceService.getAttendanceRequests(tenantId, { employeeId, status, type });
      res.status(200).json({ success: true, data: list });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async updateRequestStatus(req: Request, res: Response) {
    try {
      const tenantId = req.orgScope?.tenantId || (req as any).user?.tenantId || 'default-tenant';
      const userId = (req as any).user?.id || 'system';
      const requestId = String(req.params.id);
      const { status, adminRemark } = req.body;
      if (!status || !['APPROVED', 'REJECTED'].includes(status)) {
        return res.status(400).json({ success: false, message: 'Valid status (APPROVED or REJECTED) is required' });
      }
      const updated = await AttendanceService.updateAttendanceRequestStatus(tenantId, userId, requestId, { status, adminRemark });
      res.status(200).json({ success: true, message: `Request ${status.toLowerCase()} successfully`, data: updated });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async getMusterRoll(req: Request, res: Response) {
    try {
      const tenantId = req.orgScope?.tenantId || (req as any).user?.tenantId || 'default-tenant';
      const year = req.query.year ? Number(req.query.year) : undefined;
      const month = req.query.month ? Number(req.query.month) : undefined;
      const department = req.query.department as string | undefined;
      const employeeId = req.query.employeeId as string | undefined;

      const muster = await AttendanceService.getMusterRoll(tenantId, { year, month, department, employeeId });
      res.status(200).json({ success: true, data: muster });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async startBreak(req: Request, res: Response) {
    try {
      const tenantId = req.orgScope?.tenantId || (req as any).user?.tenantId || 'default-tenant';
      const rawEmployeeId = req.body.employeeId || (req as any).user?.employeeId;
      if (!rawEmployeeId) {
        return res.status(400).json({ success: false, message: 'Employee ID is required' });
      }
      const employeeId = await AttendanceService.resolveEmployeeId(rawEmployeeId);
      const breakType = req.body.breakType || 'TEA';
      const result = await AttendanceService.startBreak(tenantId, employeeId, breakType);
      res.status(200).json({ success: true, message: `Started ${breakType} break`, data: result });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async endBreak(req: Request, res: Response) {
    try {
      const tenantId = req.orgScope?.tenantId || (req as any).user?.tenantId || 'default-tenant';
      const rawEmployeeId = req.body.employeeId || (req as any).user?.employeeId;
      if (!rawEmployeeId) {
        return res.status(400).json({ success: false, message: 'Employee ID is required' });
      }
      const employeeId = await AttendanceService.resolveEmployeeId(rawEmployeeId);
      const result = await AttendanceService.endBreak(tenantId, employeeId);
      res.status(200).json({ success: true, message: 'Break ended successfully', data: result });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async toggleBreak(req: Request, res: Response) {
    try {
      const tenantId = req.orgScope?.tenantId || (req as any).user?.tenantId || 'default-tenant';
      const rawEmployeeId = req.body.employeeId || (req as any).user?.employeeId;
      if (!rawEmployeeId) {
        return res.status(400).json({ success: false, message: 'Employee ID is required' });
      }
      const employeeId = await AttendanceService.resolveEmployeeId(rawEmployeeId);
      const status = await AttendanceService.getTodayStatus(employeeId);
      if (status.onBreak) {
        const result = await AttendanceService.endBreak(tenantId, employeeId);
        return res.status(200).json({ success: true, message: 'Break ended', onBreak: false, data: result });
      } else {
        const breakType = req.body.breakType || 'TEA';
        const result = await AttendanceService.startBreak(tenantId, employeeId, breakType);
        return res.status(200).json({ success: true, message: `Started ${breakType} break`, onBreak: true, data: result });
      }
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async getLiveMonitor(req: Request, res: Response) {
    try {
      const tenantId = req.orgScope?.tenantId || (req as any).user?.tenantId || 'default-tenant';
      const department = req.query.department as string | undefined;
      const status = req.query.status as string | undefined;
      const search = req.query.search as string | undefined;

      const result = await AttendanceService.getLiveMonitoring(tenantId, { department, status, search });
      res.status(200).json({ success: true, ...result });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async getWebPunchPermission(req: Request, res: Response) {
    try {
      const tenantId = req.orgScope?.tenantId || (req as any).user?.tenantId || 'default-tenant';
      const rawEmployeeId = req.params.employeeId || (req.query.employeeId as string) || (req as any).user?.employeeId;
      if (!rawEmployeeId) {
        return res.status(400).json({ success: false, message: 'Employee ID is required' });
      }
      const data = await AttendanceService.getEmployeeWebPunchPermission(tenantId, rawEmployeeId);
      res.status(200).json({ success: true, data });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async setWebPunchPermission(req: Request, res: Response) {
    try {
      const tenantId = req.orgScope?.tenantId || (req as any).user?.tenantId || 'default-tenant';
      const { employeeId, allowed } = req.body;
      if (!employeeId) {
        return res.status(400).json({ success: false, message: 'Employee ID is required' });
      }
      const result = await AttendanceService.setEmployeeWebPunchPermission(tenantId, employeeId, Boolean(allowed));
      res.status(200).json({ success: true, message: 'Web punch permission updated', data: result });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async runDailyClosure(req: Request, res: Response) {
    try {
      const tenantId = req.orgScope?.tenantId || (req as any).user?.tenantId || 'default-tenant';
      const targetDate = req.body?.date || (req.query?.date as string) || undefined;
      const result = await AttendanceService.runDailyAttendanceClosure(tenantId, targetDate);
      res.status(200).json({ success: true, message: 'Daily attendance closure executed', data: result });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async getTodayReminders(req: Request, res: Response) {
    try {
      const tenantId = req.orgScope?.tenantId || (req as any).user?.tenantId || 'default-tenant';
      const rawEmployeeId = (req.query?.employeeId as string) || (req as any).user?.employeeId;
      if (!rawEmployeeId) {
        return res.status(400).json({ success: false, message: 'Employee ID is required' });
      }
      const data = await AttendanceService.getTodayReminders(tenantId, rawEmployeeId);
      res.status(200).json({ success: true, data });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async creditCompOff(req: Request, res: Response) {
    try {
      const tenantId = req.orgScope?.tenantId || (req as any).user?.tenantId || 'default-tenant';
      const userId = (req as any).user?.id || 'system';
      const { attendanceId } = req.body;
      if (!attendanceId) {
        return res.status(400).json({ success: false, message: 'attendanceId is required' });
      }
      const result = await AttendanceService.creditCompOffForAttendance(tenantId, userId, attendanceId);
      res.status(200).json({ success: true, message: result.message, data: result });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }
}

