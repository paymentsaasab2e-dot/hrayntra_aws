"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AttendanceController = void 0;
const attendance_service_1 = require("./attendance.service");
const prisma_1 = __importDefault(require("../../shared/prisma"));
const logger_1 = require("../../shared/logger");
class AttendanceController {
    static async checkIn(req, res) {
        try {
            // In a real app, employeeId would come from req.user
            const rawEmployeeId = req.body.employeeId || req.user?.employeeId;
            if (!rawEmployeeId) {
                logger_1.logger.warn('attendance.check_in.validation_failed', { reason: 'employee_id_missing' });
                return res.status(400).json({ success: false, message: "Employee ID is required" });
            }
            const employeeId = await attendance_service_1.AttendanceService.resolveEmployeeId(rawEmployeeId);
            const punchMode = req.body.punchMode || (req.file ? 'manual' : 'WEB');
            const userPermissions = req.user?.permissions;
            const isSelfPunch = String(employeeId) === String(req.user?.employeeId);
            const hrBypass = !isSelfPunch && userPermissions?.actions?.attendance_punch_hr === true;
            const canRemoteSelf = userPermissions?.actions?.attendance_punch_remote_self === true;
            const remoteAllowed = punchMode === 'remote' ? (isSelfPunch ? canRemoteSelf : hrBypass) : false;
            // If remote punch is attempted and not allowed, force geofence enforcement.
            const skipGeofence = punchMode === 'remote'
                ? remoteAllowed
                : (req.body.skipGeofence === true || hrBypass);
            const clientIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || req.ip || '127.0.0.1';
            const userAgent = req.headers['user-agent'] || 'Web Browser';
            const record = await attendance_service_1.AttendanceService.checkIn(employeeId, {
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
            logger_1.logger.info('attendance.check_in.success', {
                employeeId,
                attendanceId: record.id,
                actorId: req.user?.id
            });
            res.status(201).json({ success: true, message: 'Attendance Marked', data: record, isActive: record.isActive });
        }
        catch (error) {
            logger_1.logger.error('attendance.check_in.failed', {
                actorId: req.user?.id,
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
    static async checkOut(req, res) {
        try {
            const id = req.params.id;
            const punchMode = req.body.punchMode || (req.file ? 'manual' : 'WEB');
            const userPermissions = req.user?.permissions;
            const attendanceRecord = await prisma_1.default.attendance.findUnique({ where: { id }, select: { employeeId: true } });
            if (!attendanceRecord)
                throw new Error('Attendance record not found');
            const isSelfPunch = String(attendanceRecord.employeeId) === String(req.user?.employeeId);
            const hrBypass = !isSelfPunch && userPermissions?.actions?.attendance_punch_hr === true;
            const canRemoteSelf = userPermissions?.actions?.attendance_punch_remote_self === true;
            const remoteAllowed = punchMode === 'remote'
                ? (isSelfPunch ? canRemoteSelf : hrBypass)
                : false;
            const skipGeofence = punchMode === 'remote'
                ? remoteAllowed
                : (req.body.skipGeofence === true || hrBypass);
            const clientIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || req.ip || '127.0.0.1';
            const userAgent = req.headers['user-agent'] || 'Web Browser';
            const record = await attendance_service_1.AttendanceService.checkOut(id, {
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
            logger_1.logger.info('attendance.check_out.success', {
                attendanceId: id,
                employeeId: record.employeeId,
                actorId: req.user?.id
            });
            res.status(200).json({ success: true, message: 'Checked out successfully', data: record, isActive: false });
        }
        catch (error) {
            logger_1.logger.error('attendance.check_out.failed', {
                attendanceId: req.params.id,
                actorId: req.user?.id,
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
    static async getTodayStatus(req, res) {
        try {
            const user = req.user;
            const queryEmployeeId = req.query.employeeId;
            const canViewOthers = user?.role === 'ADMIN' || user?.role === 'HR';
            const employeeId = canViewOthers && queryEmployeeId ? queryEmployeeId : user?.employeeId;
            if (!employeeId) {
                return res.status(400).json({ success: false, message: "Employee ID is required" });
            }
            const status = await attendance_service_1.AttendanceService.getTodayStatus(employeeId);
            res.json({ success: true, ...status });
        }
        catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    }
    static async getHistory(req, res) {
        try {
            const scope = req.orgScope;
            const employeeId = scope?.employeeSelfOnly ? req.user?.employeeId : undefined;
            const history = await attendance_service_1.AttendanceService.getHistory(employeeId, scope);
            res.status(200).json({ success: true, data: history });
        }
        catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    }
    static async submitRequest(req, res) {
        try {
            const tenantId = req.orgScope?.tenantId || req.user?.tenantId || 'default-tenant';
            const userId = req.user?.id || 'system';
            const rawEmployeeId = req.body.employeeId || req.user?.employeeId;
            if (!rawEmployeeId) {
                return res.status(400).json({ success: false, message: 'Employee ID is required' });
            }
            const record = await attendance_service_1.AttendanceService.submitAttendanceRequest(tenantId, userId, rawEmployeeId, req.body);
            res.status(201).json({ success: true, message: `${req.body.type || 'Attendance'} request submitted successfully`, data: record });
        }
        catch (error) {
            res.status(400).json({ success: false, message: error.message });
        }
    }
    static async getRequests(req, res) {
        try {
            const tenantId = req.orgScope?.tenantId || req.user?.tenantId || 'default-tenant';
            const user = req.user;
            const canViewOthers = user?.role === 'ADMIN' || user?.role === 'HR' || user?.role === 'MANAGER' || user?.role === 'SUPERADMIN';
            const employeeId = canViewOthers ? req.query.employeeId : user?.employeeId;
            const status = req.query.status;
            const type = req.query.type;
            const list = await attendance_service_1.AttendanceService.getAttendanceRequests(tenantId, { employeeId, status, type });
            res.status(200).json({ success: true, data: list });
        }
        catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    }
    static async updateRequestStatus(req, res) {
        try {
            const tenantId = req.orgScope?.tenantId || req.user?.tenantId || 'default-tenant';
            const userId = req.user?.id || 'system';
            const requestId = String(req.params.id);
            const { status, adminRemark } = req.body;
            if (!status || !['APPROVED', 'REJECTED'].includes(status)) {
                return res.status(400).json({ success: false, message: 'Valid status (APPROVED or REJECTED) is required' });
            }
            const updated = await attendance_service_1.AttendanceService.updateAttendanceRequestStatus(tenantId, userId, requestId, { status, adminRemark });
            res.status(200).json({ success: true, message: `Request ${status.toLowerCase()} successfully`, data: updated });
        }
        catch (error) {
            res.status(400).json({ success: false, message: error.message });
        }
    }
    static async getMusterRoll(req, res) {
        try {
            const tenantId = req.orgScope?.tenantId || req.user?.tenantId || 'default-tenant';
            const year = req.query.year ? Number(req.query.year) : undefined;
            const month = req.query.month ? Number(req.query.month) : undefined;
            const department = req.query.department;
            const employeeId = req.query.employeeId;
            const muster = await attendance_service_1.AttendanceService.getMusterRoll(tenantId, { year, month, department, employeeId });
            res.status(200).json({ success: true, data: muster });
        }
        catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    }
    static async startBreak(req, res) {
        try {
            const tenantId = req.orgScope?.tenantId || req.user?.tenantId || 'default-tenant';
            const rawEmployeeId = req.body.employeeId || req.user?.employeeId;
            if (!rawEmployeeId) {
                return res.status(400).json({ success: false, message: 'Employee ID is required' });
            }
            const employeeId = await attendance_service_1.AttendanceService.resolveEmployeeId(rawEmployeeId);
            const breakType = req.body.breakType || 'TEA';
            const result = await attendance_service_1.AttendanceService.startBreak(tenantId, employeeId, breakType);
            res.status(200).json({ success: true, message: `Started ${breakType} break`, data: result });
        }
        catch (error) {
            res.status(400).json({ success: false, message: error.message });
        }
    }
    static async endBreak(req, res) {
        try {
            const tenantId = req.orgScope?.tenantId || req.user?.tenantId || 'default-tenant';
            const rawEmployeeId = req.body.employeeId || req.user?.employeeId;
            if (!rawEmployeeId) {
                return res.status(400).json({ success: false, message: 'Employee ID is required' });
            }
            const employeeId = await attendance_service_1.AttendanceService.resolveEmployeeId(rawEmployeeId);
            const result = await attendance_service_1.AttendanceService.endBreak(tenantId, employeeId);
            res.status(200).json({ success: true, message: 'Break ended successfully', data: result });
        }
        catch (error) {
            res.status(400).json({ success: false, message: error.message });
        }
    }
    static async toggleBreak(req, res) {
        try {
            const tenantId = req.orgScope?.tenantId || req.user?.tenantId || 'default-tenant';
            const rawEmployeeId = req.body.employeeId || req.user?.employeeId;
            if (!rawEmployeeId) {
                return res.status(400).json({ success: false, message: 'Employee ID is required' });
            }
            const employeeId = await attendance_service_1.AttendanceService.resolveEmployeeId(rawEmployeeId);
            const status = await attendance_service_1.AttendanceService.getTodayStatus(employeeId);
            if (status.onBreak) {
                const result = await attendance_service_1.AttendanceService.endBreak(tenantId, employeeId);
                return res.status(200).json({ success: true, message: 'Break ended', onBreak: false, data: result });
            }
            else {
                const breakType = req.body.breakType || 'TEA';
                const result = await attendance_service_1.AttendanceService.startBreak(tenantId, employeeId, breakType);
                return res.status(200).json({ success: true, message: `Started ${breakType} break`, onBreak: true, data: result });
            }
        }
        catch (error) {
            res.status(400).json({ success: false, message: error.message });
        }
    }
    static async getLiveMonitor(req, res) {
        try {
            const tenantId = req.orgScope?.tenantId || req.user?.tenantId || 'default-tenant';
            const department = req.query.department;
            const status = req.query.status;
            const search = req.query.search;
            const result = await attendance_service_1.AttendanceService.getLiveMonitoring(tenantId, { department, status, search });
            res.status(200).json({ success: true, ...result });
        }
        catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    }
    static async getWebPunchPermission(req, res) {
        try {
            const tenantId = req.orgScope?.tenantId || req.user?.tenantId || 'default-tenant';
            const rawEmployeeId = req.params.employeeId || req.query.employeeId || req.user?.employeeId;
            if (!rawEmployeeId) {
                return res.status(400).json({ success: false, message: 'Employee ID is required' });
            }
            const data = await attendance_service_1.AttendanceService.getEmployeeWebPunchPermission(tenantId, rawEmployeeId);
            res.status(200).json({ success: true, data });
        }
        catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    }
    static async setWebPunchPermission(req, res) {
        try {
            const tenantId = req.orgScope?.tenantId || req.user?.tenantId || 'default-tenant';
            const { employeeId, allowed } = req.body;
            if (!employeeId) {
                return res.status(400).json({ success: false, message: 'Employee ID is required' });
            }
            const result = await attendance_service_1.AttendanceService.setEmployeeWebPunchPermission(tenantId, employeeId, Boolean(allowed));
            res.status(200).json({ success: true, message: 'Web punch permission updated', data: result });
        }
        catch (error) {
            res.status(400).json({ success: false, message: error.message });
        }
    }
    static async runDailyClosure(req, res) {
        try {
            const tenantId = req.orgScope?.tenantId || req.user?.tenantId || 'default-tenant';
            const targetDate = req.body?.date || req.query?.date || undefined;
            const result = await attendance_service_1.AttendanceService.runDailyAttendanceClosure(tenantId, targetDate);
            res.status(200).json({ success: true, message: 'Daily attendance closure executed', data: result });
        }
        catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    }
    static async getTodayReminders(req, res) {
        try {
            const tenantId = req.orgScope?.tenantId || req.user?.tenantId || 'default-tenant';
            const rawEmployeeId = req.query?.employeeId || req.user?.employeeId;
            if (!rawEmployeeId) {
                return res.status(400).json({ success: false, message: 'Employee ID is required' });
            }
            const data = await attendance_service_1.AttendanceService.getTodayReminders(tenantId, rawEmployeeId);
            res.status(200).json({ success: true, data });
        }
        catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    }
    static async creditCompOff(req, res) {
        try {
            const tenantId = req.orgScope?.tenantId || req.user?.tenantId || 'default-tenant';
            const userId = req.user?.id || 'system';
            const { attendanceId } = req.body;
            if (!attendanceId) {
                return res.status(400).json({ success: false, message: 'attendanceId is required' });
            }
            const result = await attendance_service_1.AttendanceService.creditCompOffForAttendance(tenantId, userId, attendanceId);
            res.status(200).json({ success: true, message: result.message, data: result });
        }
        catch (error) {
            res.status(400).json({ success: false, message: error.message });
        }
    }
}
exports.AttendanceController = AttendanceController;
//# sourceMappingURL=attendance.controller.js.map