import { employeeService } from './employee.service.js';
import { orgService } from './org.service.js';
import { opsService } from './ops.service.js';
import { sendResponse, sendError } from '../../utils/response.js';

function statusOf(error) {
  return error?.statusCode || 500;
}

function wrap(fn) {
  return async (req, res) => {
    try {
      const data = await fn(req);
      const code = req.method === 'POST' && res.statusCode === 200 ? 201 : 200;
      sendResponse(res, data?.__status || code, data?.__message || 'OK', data?.__body !== undefined ? data.__body : data);
    } catch (error) {
      sendError(res, statusOf(error), error.message, error);
    }
  };
}

export const peoplecoreController = {
  listPacks: wrap(async () => ({
    packs: employeeService.listCountryPacks(),
    payslipsEnabled: false,
    phase: 3,
  })),
  getSettings: wrap((req) => employeeService.getSettings()),
  updateSettings: wrap((req) => employeeService.updateSettings(req.body || {})),
  getEmployees: wrap((req) => employeeService.getAll(req.query || {})),
  getEmployee: wrap((req) => employeeService.getById(req.params.id)),
  createEmployee: wrap((req) => employeeService.create(req.body || {})),
  updateEmployee: wrap((req) => employeeService.update(req.params.id, req.body || {})),
  hireFromCandidate: wrap(async (req) => {
    const result = await employeeService.hireFromCandidate(req.params.candidateId, req.body || {});
    return {
      __status: result.alreadyHired ? 200 : 201,
      __message: result.alreadyHired ? 'Candidate is already an employee' : 'Candidate hired as employee',
      __body: result,
    };
  }),
  listEmployers: wrap(() => orgService.listEmployers()),
  createEmployer: wrap((req) => orgService.createEmployer(req.body || {})),
  updateEmployer: wrap((req) => orgService.updateEmployer(req.params.id, req.body || {})),
  listLocations: wrap((req) => orgService.listLocations(req.query.legalEmployerId)),
  createLocation: wrap((req) => orgService.createLocation(req.body || {})),
  listHolidays: wrap((req) => orgService.listHolidays(req.query.legalEmployerId, req.query.year)),
  listLeaveTypes: wrap((req) => orgService.listLeaveTypes(req.query.legalEmployerId)),
  listOnboarding: wrap((req) => opsService.listOnboarding(req.params.employeeId)),
  completeOnboarding: wrap((req) => opsService.completeOnboardingTask(req.params.taskId)),
  markNoShow: wrap((req) => opsService.markNoShow(req.params.employeeId)),
  joinEmployee: wrap((req) => opsService.joinEmployee(req.params.employeeId, req.body || {})),
  deferEmployee: wrap((req) => opsService.deferEmployee(req.params.employeeId, req.body || {})),
  onboardingQueue: wrap(() => opsService.listOnboardingQueue()),
  alerts: wrap(() => opsService.alerts()),
  listLeaveBalances: wrap((req) => opsService.listLeaveBalances(req.query.employeeId)),
  paymentFile: wrap((req) => opsService.paymentFile(req.params.id)),
  muster: wrap((req) =>
    opsService.muster(req.query.legalEmployerId, req.query.year, req.query.month),
  ),
  regularise: wrap((req) => opsService.requestRegularisation(req.body || {}, req.user?.id)),
  listAssignments: wrap(() => opsService.listAssignments()),
  listPayrollExceptions: wrap((req) => opsService.listPayrollExceptions(req.params.id)),
  listDocuments: wrap((req) => opsService.listDocuments(req.params.employeeId)),
  addDocument: wrap((req) => opsService.addDocument(req.params.employeeId, req.body || {})),
  punch: wrap((req) => opsService.punch(req.body || {}, req.user?.id)),
  listPunches: wrap((req) => opsService.listPunches(req.query.employeeId, req.query.localWorkDate)),
  lockPeriod: wrap((req) =>
    opsService.lockPeriod(req.body.legalEmployerId, req.body.year, req.body.month, req.user?.id),
  ),
  getPeriod: wrap((req) => opsService.getPeriod(req.query.legalEmployerId, req.query.year, req.query.month)),
  applyLeave: wrap((req) => opsService.applyLeave(req.body || {})),
  decideLeave: wrap((req) => opsService.decideLeave(req.params.id, req.body.status, req.body.remark, req.user?.id)),
  listLeave: wrap((req) => opsService.listLeave(req.query.employeeId)),
  createExit: wrap((req) => opsService.createExit(req.body || {})),
  completeExit: wrap((req) => opsService.completeExit(req.params.id, req.body || {})),
  listExits: wrap(() => opsService.listExits()),
  createAsset: wrap((req) => opsService.createAsset(req.body || {})),
  listAssets: wrap(() => opsService.listAssets()),
  assignAsset: wrap((req) => opsService.assignAsset(req.body || {})),
  returnAsset: wrap((req) => opsService.returnAsset(req.params.id, req.body?.condition)),
  saveFnf: wrap((req) => opsService.saveFnf(req.body || {})),
  issueLetter: wrap((req) => opsService.issueLetter(req.body || {})),
  listLetters: wrap((req) => opsService.listLetters(req.query.employeeId)),
  listInbox: wrap(() => opsService.listInbox()),
  decideInbox: wrap((req) =>
    opsService.decideInbox(req.params.id, req.body.status, req.body.remark, req.body.delegatedToId),
  ),
  delegateInbox: wrap((req) => opsService.delegateInbox(req.params.id, req.body.delegatedToId)),
  reportsHome: wrap(() => opsService.reportsHome()),
  inspectorPack: wrap((req) => opsService.inspectorPack(req.query.legalEmployerId, req.query.year)),
  publishPolicy: wrap((req) => opsService.publishPolicy(req.body || {})),
  listPolicies: wrap(() => opsService.listPolicies()),
  ackPolicy: wrap((req) => opsService.ackPolicy(req.body || {})),
  getSecurity: wrap(() => opsService.getSecurityFlags()),
  updateSecurity: wrap((req) => opsService.updateSecurityFlags(req.body || {})),
  runPayroll: wrap((req) => opsService.runPayroll(req.body || {}, req.user)),
  approvePayroll: wrap((req) => opsService.approvePayroll(req.params.id)),
  lockPayroll: wrap((req) => opsService.lockPayroll(req.params.id)),
  listPayrollRuns: wrap((req) => opsService.listPayrollRuns(req.query.legalEmployerId)),
  listPayslips: wrap((req) => opsService.listPayslips(req.params.id)),
};
