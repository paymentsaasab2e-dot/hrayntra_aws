import express from 'express';
import { peoplecoreController as c } from './peoplecore.controller.js';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { requireAnyPermission } from '../../middleware/permission.middleware.js';

const router = express.Router();

const PEOPLE_READ = ['candidates_read', 'view_all_candidates', 'view_assigned_candidates'];
const PEOPLE_WRITE = ['candidates_create', 'candidates_update', 'add_candidate', 'edit_candidate'];

router.use(authMiddleware);

router.get('/peoplecore/country-packs', requireAnyPermission(PEOPLE_READ), c.listPacks);
router.get('/peoplecore/settings', requireAnyPermission(PEOPLE_READ), c.getSettings);
router.put('/peoplecore/settings', requireAnyPermission(PEOPLE_WRITE), c.updateSettings);
router.get('/peoplecore/security', requireAnyPermission(PEOPLE_READ), c.getSecurity);
router.put('/peoplecore/security', requireAnyPermission(PEOPLE_WRITE), c.updateSecurity);

router.get('/legal-employers', requireAnyPermission(PEOPLE_READ), c.listEmployers);
router.post('/legal-employers', requireAnyPermission(PEOPLE_WRITE), c.createEmployer);
router.patch('/legal-employers/:id', requireAnyPermission(PEOPLE_WRITE), c.updateEmployer);
router.get('/people-locations', requireAnyPermission(PEOPLE_READ), c.listLocations);
router.post('/people-locations', requireAnyPermission(PEOPLE_WRITE), c.createLocation);
router.get('/holiday-calendars', requireAnyPermission(PEOPLE_READ), c.listHolidays);
router.get('/leave-types', requireAnyPermission(PEOPLE_READ), c.listLeaveTypes);

router.get('/employees', requireAnyPermission(PEOPLE_READ), c.getEmployees);
router.post('/employees', requireAnyPermission(PEOPLE_WRITE), c.createEmployee);
router.post('/employees/from-candidate/:candidateId', requireAnyPermission(PEOPLE_WRITE), c.hireFromCandidate);
router.get('/employees/:id', requireAnyPermission(PEOPLE_READ), c.getEmployee);
router.patch('/employees/:id', requireAnyPermission(PEOPLE_WRITE), c.updateEmployee);
router.get('/employees/:employeeId/onboarding', requireAnyPermission(PEOPLE_READ), c.listOnboarding);
router.post('/employees/:employeeId/no-show', requireAnyPermission(PEOPLE_WRITE), c.markNoShow);
router.post('/employees/:employeeId/join', requireAnyPermission(PEOPLE_WRITE), c.joinEmployee);
router.post('/employees/:employeeId/defer', requireAnyPermission(PEOPLE_WRITE), c.deferEmployee);
router.get('/peoplecore/onboarding-queue', requireAnyPermission(PEOPLE_READ), c.onboardingQueue);
router.get('/peoplecore/alerts', requireAnyPermission(PEOPLE_READ), c.alerts);
router.get('/employees/:employeeId/documents', requireAnyPermission(PEOPLE_READ), c.listDocuments);
router.post('/employees/:employeeId/documents', requireAnyPermission(PEOPLE_WRITE), c.addDocument);
router.post('/onboarding-tasks/:taskId/complete', requireAnyPermission(PEOPLE_WRITE), c.completeOnboarding);

router.post('/attendance/punches', requireAnyPermission(PEOPLE_WRITE), c.punch);
router.get('/attendance/punches', requireAnyPermission(PEOPLE_READ), c.listPunches);
router.post('/attendance/periods/lock', requireAnyPermission(PEOPLE_WRITE), c.lockPeriod);
router.get('/attendance/periods', requireAnyPermission(PEOPLE_READ), c.getPeriod);
router.get('/attendance/muster', requireAnyPermission(PEOPLE_READ), c.muster);
router.post('/attendance/regularise', requireAnyPermission(PEOPLE_WRITE), c.regularise);

router.get('/leave-balances', requireAnyPermission(PEOPLE_READ), c.listLeaveBalances);
router.get('/leave-requests', requireAnyPermission(PEOPLE_READ), c.listLeave);
router.post('/leave-requests', requireAnyPermission(PEOPLE_WRITE), c.applyLeave);
router.post('/leave-requests/:id/decide', requireAnyPermission(PEOPLE_WRITE), c.decideLeave);

router.get('/exit-cases', requireAnyPermission(PEOPLE_READ), c.listExits);
router.post('/exit-cases', requireAnyPermission(PEOPLE_WRITE), c.createExit);
router.post('/exit-cases/:id/complete', requireAnyPermission(PEOPLE_WRITE), c.completeExit);
router.post('/fnf-worksheets', requireAnyPermission(PEOPLE_WRITE), c.saveFnf);

router.get('/assets', requireAnyPermission(PEOPLE_READ), c.listAssets);
router.post('/assets', requireAnyPermission(PEOPLE_WRITE), c.createAsset);
router.post('/assets/assign', requireAnyPermission(PEOPLE_WRITE), c.assignAsset);
router.post('/asset-assignments/:id/return', requireAnyPermission(PEOPLE_WRITE), c.returnAsset);
router.get('/asset-assignments', requireAnyPermission(PEOPLE_READ), c.listAssignments);

router.get('/people-letters', requireAnyPermission(PEOPLE_READ), c.listLetters);
router.post('/people-letters', requireAnyPermission(PEOPLE_WRITE), c.issueLetter);

router.get('/people-inbox', requireAnyPermission(PEOPLE_READ), c.listInbox);
router.post('/people-inbox/:id/decide', requireAnyPermission(PEOPLE_WRITE), c.decideInbox);
router.post('/people-inbox/:id/delegate', requireAnyPermission(PEOPLE_WRITE), c.delegateInbox);

router.get('/peoplecore/reports/home', requireAnyPermission(PEOPLE_READ), c.reportsHome);
router.get('/peoplecore/reports/inspector', requireAnyPermission(PEOPLE_READ), c.inspectorPack);

router.get('/hr-policies', requireAnyPermission(PEOPLE_READ), c.listPolicies);
router.post('/hr-policies', requireAnyPermission(PEOPLE_WRITE), c.publishPolicy);
router.post('/hr-policies/ack', requireAnyPermission(PEOPLE_WRITE), c.ackPolicy);

router.get('/payroll-runs', requireAnyPermission(PEOPLE_READ), c.listPayrollRuns);
router.post('/payroll-runs', requireAnyPermission(PEOPLE_WRITE), c.runPayroll);
router.post('/payroll-runs/:id/approve', requireAnyPermission(PEOPLE_WRITE), c.approvePayroll);
router.post('/payroll-runs/:id/lock', requireAnyPermission(PEOPLE_WRITE), c.lockPayroll);
router.get('/payroll-runs/:id/payslips', requireAnyPermission(PEOPLE_READ), c.listPayslips);
router.get('/payroll-runs/:id/exceptions', requireAnyPermission(PEOPLE_READ), c.listPayrollExceptions);
router.get('/payroll-runs/:id/payment-file', requireAnyPermission(PEOPLE_READ), c.paymentFile);

export default router;
