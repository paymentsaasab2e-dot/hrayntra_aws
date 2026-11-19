import { Router } from 'express';
import { AttendanceController } from './attendance.controller';
import { AttendanceBulkController } from './bulk-import/attendance-bulk.controller';
import { authMiddleware } from '../../shared/middleware/auth';
import { orgScopeMiddleware } from '../../shared/middleware/org-scope';

const router = Router();

router.use(authMiddleware, orgScopeMiddleware);

// Bulk Attendance Import & Correction
router.get('/bulk-import/template', AttendanceBulkController.getTemplate);
router.post('/bulk-import/validate', AttendanceBulkController.validate);
router.post('/bulk-import/commit', AttendanceBulkController.commit);

router.post('/check-in', AttendanceController.checkIn);
router.post('/check-out/:id', AttendanceController.checkOut);
router.post('/break/start', AttendanceController.startBreak);
router.post('/break/end', AttendanceController.endBreak);
router.post('/break/toggle', AttendanceController.toggleBreak);
router.get('/today-status', AttendanceController.getTodayStatus);
router.get('/live-monitor', AttendanceController.getLiveMonitor);
router.get('/web-punch-permission/:employeeId', AttendanceController.getWebPunchPermission);
router.get('/web-punch-permission', AttendanceController.getWebPunchPermission);
router.post('/web-punch-permission', AttendanceController.setWebPunchPermission);
router.get('/history', AttendanceController.getHistory);
router.get('/requests', AttendanceController.getRequests);
router.post('/requests', AttendanceController.submitRequest);
router.patch('/requests/:id/status', AttendanceController.updateRequestStatus);
router.get('/muster-roll', AttendanceController.getMusterRoll);
router.post('/closure/run', AttendanceController.runDailyClosure);
router.get('/reminders/today', AttendanceController.getTodayReminders);
router.post('/compoff/credit', AttendanceController.creditCompOff);
router.get('/', AttendanceController.getHistory);

export default router;
