import { employeeService } from './employee.service.js';
import { sendResponse, sendError } from '../../utils/response.js';

function statusOf(error) {
  return error?.statusCode || 500;
}

export const employeeController = {
  async listPacks(req, res) {
    try {
      sendResponse(res, 200, 'Country packs retrieved', {
        packs: employeeService.listCountryPacks(),
        payslipsEnabled: false,
        phase: 3,
      });
    } catch (error) {
      sendError(res, statusOf(error), error.message, error);
    }
  },

  async getSettings(req, res) {
    try {
      const settings = await employeeService.getSettings();
      sendResponse(res, 200, 'PeopleCore settings retrieved', settings);
    } catch (error) {
      sendError(res, statusOf(error), error.message, error);
    }
  },

  async updateSettings(req, res) {
    try {
      const settings = await employeeService.updateSettings(req.body || {});
      sendResponse(res, 200, 'PeopleCore country pack saved', settings);
    } catch (error) {
      sendError(res, statusOf(error), error.message, error);
    }
  },

  async getAll(req, res) {
    try {
      const result = await employeeService.getAll(req.query || {});
      sendResponse(res, 200, 'Employees retrieved', result);
    } catch (error) {
      sendError(res, statusOf(error), error.message, error);
    }
  },

  async getById(req, res) {
    try {
      const employee = await employeeService.getById(req.params.id);
      sendResponse(res, 200, 'Employee retrieved', employee);
    } catch (error) {
      sendError(res, statusOf(error), error.message, error);
    }
  },

  async create(req, res) {
    try {
      const employee = await employeeService.create(req.body || {});
      sendResponse(res, 201, 'Employee created', employee);
    } catch (error) {
      sendError(res, statusOf(error), error.message, error);
    }
  },

  async update(req, res) {
    try {
      const employee = await employeeService.update(req.params.id, req.body || {});
      sendResponse(res, 200, 'Employee updated', employee);
    } catch (error) {
      sendError(res, statusOf(error), error.message, error);
    }
  },

  async hireFromCandidate(req, res) {
    try {
      const result = await employeeService.hireFromCandidate(req.params.candidateId, req.body || {});
      sendResponse(
        res,
        result.alreadyHired ? 200 : 201,
        result.alreadyHired ? 'Candidate is already an employee' : 'Candidate hired as employee',
        result,
      );
    } catch (error) {
      sendError(res, statusOf(error), error.message, error);
    }
  },
};
