"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const leave_controller_1 = require("./leave.controller");
const auth_1 = require("../../shared/middleware/auth");
const org_scope_1 = require("../../shared/middleware/org-scope");
const router = (0, express_1.Router)();
router.use(auth_1.authMiddleware, org_scope_1.orgScopeMiddleware);
router.get('/my', leave_controller_1.LeaveController.getMyLeaves);
router.get('/balance', leave_controller_1.LeaveController.getBalance);
router.get('/work-week-roster', leave_controller_1.LeaveController.getWorkWeekRoster);
router.post('/work-week-roster', (0, auth_1.authorize)(['ADMIN', 'HR']), leave_controller_1.LeaveController.updateWorkWeekRoster);
router.get('/shifts', leave_controller_1.LeaveController.getShifts);
router.post('/shifts', (0, auth_1.authorize)(['ADMIN', 'HR']), leave_controller_1.LeaveController.createOrUpdateShift);
router.delete('/shifts/:code', (0, auth_1.authorize)(['ADMIN', 'HR']), leave_controller_1.LeaveController.deleteShift);
router.get('/roster-grid', leave_controller_1.LeaveController.getRosterGrid);
router.post('/roster-bulk-assign', (0, auth_1.authorize)(['ADMIN', 'HR', 'MANAGER']), leave_controller_1.LeaveController.bulkAssignRoster);
router.post('/roster-create-schedule', (0, auth_1.authorize)(['ADMIN', 'HR', 'MANAGER']), leave_controller_1.LeaveController.createRosterSchedule);
router.post('/roster-cell-override', (0, auth_1.authorize)(['ADMIN', 'HR', 'MANAGER']), leave_controller_1.LeaveController.overrideRosterCell);
router.post('/calculate-days', leave_controller_1.LeaveController.calculateDays);
router.delete('/:id', leave_controller_1.LeaveController.cancel);
// Admin / Management routes
router.get('/', leave_controller_1.LeaveController.getAll);
router.patch('/:id/status', (0, auth_1.authorize)(['ADMIN', 'HR']), leave_controller_1.LeaveController.updateStatus);
// Employee can apply
router.post('/', leave_controller_1.LeaveController.apply);
exports.default = router;
//# sourceMappingURL=leave.routes.js.map