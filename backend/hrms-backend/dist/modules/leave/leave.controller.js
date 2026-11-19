"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LeaveController = void 0;
const leave_service_1 = require("./leave.service");
const logger_1 = require("../../shared/logger");
class LeaveController {
    static async apply(req, res) {
        try {
            const employeeId = req.user?.employeeId || req.body.employeeId;
            const leave = await leave_service_1.LeaveService.apply({ ...req.body, employeeId });
            logger_1.logger.info('leave.apply.success', {
                leaveId: leave.id,
                employeeId,
                actorId: req.user?.id
            });
            res.status(201).json({ success: true, data: leave });
        }
        catch (error) {
            logger_1.logger.error('leave.apply.failed', {
                employeeId: req.user?.employeeId || req.body?.employeeId,
                actorId: req.user?.id,
                error: error?.message
            });
            res.status(400).json({ success: false, message: error.message });
        }
    }
    static async updateStatus(req, res) {
        try {
            const processedBy = req.user.id;
            const { status, adminRemark } = req.body;
            const normalizedStatus = String(status || '').toUpperCase();
            const finalStatus = normalizedStatus === 'MODIFICATION_REQUESTED' ? 'REJECTED' : normalizedStatus;
            const finalRemark = normalizedStatus === 'MODIFICATION_REQUESTED'
                ? (adminRemark || 'Modification requested by approver')
                : adminRemark;
            const leave = await leave_service_1.LeaveService.updateStatus(String(req.params.id), finalStatus, processedBy, finalRemark);
            logger_1.logger.info('approval.leave.status_updated', {
                leaveId: req.params.id,
                requestedStatus: normalizedStatus,
                appliedStatus: finalStatus,
                processedBy,
                adminRemark: finalRemark
            });
            res.status(200).json({ success: true, data: leave, message: `Leave ${status} successfully` });
        }
        catch (error) {
            logger_1.logger.error('approval.leave.status_update_failed', {
                leaveId: req.params.id,
                actorId: req.user?.id,
                error: error?.message
            });
            res.status(400).json({ success: false, message: error.message });
        }
    }
    static async getMyLeaves(req, res) {
        try {
            const employeeId = req.user.employeeId;
            const leaves = await leave_service_1.LeaveService.getByEmployee(employeeId);
            res.status(200).json({ success: true, data: leaves });
        }
        catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    }
    static async getBalance(req, res) {
        try {
            const employeeId = req.user?.employeeId || req.params.employeeId;
            const balance = await leave_service_1.LeaveService.getLeaveBalance(employeeId);
            res.json({ success: true, data: balance });
        }
        catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    }
    static async cancel(req, res) {
        try {
            const employeeId = req.user.employeeId;
            await leave_service_1.LeaveService.cancel(String(req.params.id), employeeId);
            logger_1.logger.info('leave.cancel.success', {
                leaveId: req.params.id,
                employeeId,
                actorId: req.user?.id
            });
            res.json({ success: true, message: "Leave cancelled successfully" });
        }
        catch (error) {
            logger_1.logger.error('leave.cancel.failed', {
                leaveId: req.params.id,
                actorId: req.user?.id,
                error: error?.message
            });
            res.status(400).json({ success: false, message: error.message });
        }
    }
    static async getAll(req, res) {
        try {
            const filters = {};
            if (req.query.status)
                filters.status = req.query.status;
            if (req.query.userId)
                filters.employeeId = req.query.userId;
            const leaves = await leave_service_1.LeaveService.getAll(filters, req.orgScope);
            res.status(200).json({ success: true, data: leaves });
        }
        catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    }
    static async getWorkWeekRoster(req, res) {
        try {
            const tenantId = req.user?.tenantId || req.orgScope?.tenantId;
            if (!tenantId) {
                return res.status(400).json({ success: false, message: 'Tenant context required' });
            }
            const year = req.query.year ? Number(req.query.year) : undefined;
            const month = req.query.month ? Number(req.query.month) : undefined;
            const roster = await leave_service_1.LeaveService.getWorkWeekRoster(tenantId, year, month);
            res.status(200).json({ success: true, data: roster });
        }
        catch (error) {
            logger_1.logger.error('leave.work_week_roster.failed', { error: error?.message });
            res.status(500).json({ success: false, message: error.message });
        }
    }
    static async updateWorkWeekRoster(req, res) {
        try {
            const tenantId = req.user?.tenantId || req.orgScope?.tenantId;
            const userId = req.user?.id;
            if (!tenantId) {
                return res.status(400).json({ success: false, message: 'Tenant context required' });
            }
            const { pattern, customWeekOffDays } = req.body;
            const updated = await leave_service_1.LeaveService.updateWorkWeekRoster(tenantId, userId, {
                pattern,
                customWeekOffDays,
            });
            logger_1.logger.info('leave.work_week_roster.updated', {
                tenantId,
                userId,
                pattern,
            });
            res.status(200).json({
                success: true,
                data: updated,
                message: 'Work week and weekend roster policy updated successfully',
            });
        }
        catch (error) {
            logger_1.logger.error('leave.work_week_roster_update.failed', { error: error?.message });
            res.status(400).json({ success: false, message: error.message });
        }
    }
    static async calculateDays(req, res) {
        try {
            const tenantId = req.user?.tenantId || req.orgScope?.tenantId;
            if (!tenantId) {
                return res.status(400).json({ success: false, message: 'Tenant context required' });
            }
            const { startDate, endDate, pattern } = req.body;
            if (!startDate || !endDate) {
                return res.status(400).json({ success: false, message: 'startDate and endDate are required' });
            }
            const result = await leave_service_1.LeaveService.calculateDaysBreakdown(tenantId, startDate, endDate, pattern);
            res.status(200).json({ success: true, data: result });
        }
        catch (error) {
            res.status(400).json({ success: false, message: error.message });
        }
    }
    static async getRosterGrid(req, res) {
        try {
            const tenantId = req.user?.tenantId || req.orgScope?.tenantId;
            if (!tenantId) {
                return res.status(400).json({ success: false, message: 'Tenant context required' });
            }
            const year = req.query.year ? Number(req.query.year) : undefined;
            const month = req.query.month ? Number(req.query.month) : undefined;
            const view = req.query.view;
            const weekIndex = req.query.weekIndex !== undefined ? Number(req.query.weekIndex) : undefined;
            const department = req.query.department;
            const search = req.query.search;
            const grid = await leave_service_1.LeaveService.getRosterGrid(tenantId, {
                year,
                month,
                view,
                weekIndex,
                department,
                search,
            });
            res.status(200).json({ success: true, data: grid });
        }
        catch (error) {
            logger_1.logger.error('leave.roster_grid.failed', { error: error?.message });
            res.status(500).json({ success: false, message: error.message });
        }
    }
    static async bulkAssignRoster(req, res) {
        try {
            const tenantId = req.user?.tenantId || req.orgScope?.tenantId;
            const userId = req.user?.id;
            if (!tenantId) {
                return res.status(400).json({ success: false, message: 'Tenant context required' });
            }
            const { employeeIds, department, pattern, shiftCode, customWeekOffDays, applyToAll } = req.body;
            const grid = await leave_service_1.LeaveService.bulkAssignRoster(tenantId, userId, {
                employeeIds,
                department,
                pattern,
                shiftCode,
                customWeekOffDays,
                applyToAll,
            });
            logger_1.logger.info('leave.roster_bulk_assign.success', {
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
        }
        catch (error) {
            logger_1.logger.error('leave.roster_bulk_assign.failed', { error: error?.message });
            res.status(400).json({ success: false, message: error.message });
        }
    }
    static async overrideRosterCell(req, res) {
        try {
            const tenantId = req.user?.tenantId || req.orgScope?.tenantId;
            const userId = req.user?.id;
            if (!tenantId) {
                return res.status(400).json({ success: false, message: 'Tenant context required' });
            }
            const { employeeId, dateStr, shiftCode } = req.body;
            const result = await leave_service_1.LeaveService.overrideRosterCell(tenantId, userId, {
                employeeId,
                dateStr,
                shiftCode,
            });
            res.status(200).json({ success: true, data: result, message: 'Cell shift updated' });
        }
        catch (error) {
            logger_1.logger.error('leave.roster_cell_override.failed', { error: error?.message });
            res.status(400).json({ success: false, message: error.message });
        }
    }
    static async createRosterSchedule(req, res) {
        try {
            const tenantId = req.user?.tenantId || req.orgScope?.tenantId;
            const userId = req.user?.id;
            if (!tenantId) {
                return res.status(400).json({ success: false, message: 'Tenant context required' });
            }
            const { employeeIds, department, applyToAll, startDate, endDate, shiftCode, workingDays, saturdayRule, } = req.body;
            const result = await leave_service_1.LeaveService.createRosterSchedule(tenantId, userId, {
                employeeIds,
                department,
                applyToAll,
                startDate,
                endDate,
                shiftCode,
                workingDays,
                saturdayRule,
            });
            logger_1.logger.info('leave.roster_schedule.created', {
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
        }
        catch (error) {
            logger_1.logger.error('leave.roster_schedule.failed', { error: error?.message });
            res.status(400).json({ success: false, message: error.message });
        }
    }
    static async getShifts(req, res) {
        try {
            const tenantId = req.user?.tenantId || req.orgScope?.tenantId;
            if (!tenantId) {
                return res.status(400).json({ success: false, message: 'Tenant context required' });
            }
            const shifts = await leave_service_1.LeaveService.getShifts(tenantId);
            res.status(200).json({ success: true, data: shifts });
        }
        catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    }
    static async createOrUpdateShift(req, res) {
        try {
            const tenantId = req.user?.tenantId || req.orgScope?.tenantId;
            const userId = req.user?.id;
            if (!tenantId) {
                return res.status(400).json({ success: false, message: 'Tenant context required' });
            }
            const shifts = await leave_service_1.LeaveService.createOrUpdateShift(tenantId, userId, req.body);
            res.status(200).json({ success: true, data: shifts, message: 'Shift updated successfully' });
        }
        catch (error) {
            res.status(400).json({ success: false, message: error.message });
        }
    }
    static async deleteShift(req, res) {
        try {
            const tenantId = req.user?.tenantId || req.orgScope?.tenantId;
            const userId = req.user?.id;
            if (!tenantId) {
                return res.status(400).json({ success: false, message: 'Tenant context required' });
            }
            const code = String(req.params.code);
            const shifts = await leave_service_1.LeaveService.deleteShift(tenantId, userId, code);
            res.status(200).json({ success: true, data: shifts, message: 'Shift deleted successfully' });
        }
        catch (error) {
            res.status(400).json({ success: false, message: error.message });
        }
    }
}
exports.LeaveController = LeaveController;
//# sourceMappingURL=leave.controller.js.map