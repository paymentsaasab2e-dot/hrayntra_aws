import { Router } from 'express';
import { LeaveController } from './leave.controller';
import accrualRoutes from './accrual/accrual.routes';
import { authMiddleware, authorize } from '../../shared/middleware/auth';
import { orgScopeMiddleware } from '../../shared/middleware/org-scope';

const router = Router();

router.use(authMiddleware, orgScopeMiddleware);

router.get('/my', LeaveController.getMyLeaves);
router.get('/balance', LeaveController.getBalance);
router.get('/work-week-roster', LeaveController.getWorkWeekRoster);
router.post('/work-week-roster', authorize(['ADMIN', 'HR']), LeaveController.updateWorkWeekRoster);
router.get('/shifts', LeaveController.getShifts);
router.post('/shifts', authorize(['ADMIN', 'HR']), LeaveController.createOrUpdateShift);
router.delete('/shifts/:code', authorize(['ADMIN', 'HR']), LeaveController.deleteShift);
router.get('/roster-grid', LeaveController.getRosterGrid);
router.get('/team-calendar', LeaveController.getTeamCalendar);
router.post('/roster-bulk-assign', authorize(['ADMIN', 'HR', 'MANAGER']), LeaveController.bulkAssignRoster);
router.post('/roster-create-schedule', authorize(['ADMIN', 'HR', 'MANAGER']), LeaveController.createRosterSchedule);
router.post('/roster-cell-override', authorize(['ADMIN', 'HR', 'MANAGER']), LeaveController.overrideRosterCell);
router.post('/calculate-days', LeaveController.calculateDays);

// Leave Accrual Engine, Group Plans, Year-End & Encashment
router.use('/accrual', accrualRoutes);

router.delete('/:id', LeaveController.cancel);

// Admin / Management routes
router.get('/', LeaveController.getAll);
router.patch('/:id/status', authorize(['ADMIN', 'HR']), LeaveController.updateStatus);

// Employee can apply
router.post('/', LeaveController.apply);

export default router;
