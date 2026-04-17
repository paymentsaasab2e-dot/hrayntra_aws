import { departmentService } from './department.service.js';
import { sendResponse, sendError } from '../../utils/response.js';

export const departmentController = {
  async getAll(req, res) {
    try {
      const departments = await departmentService.getAll();
      sendResponse(res, 200, 'Departments retrieved successfully', departments);
    } catch (error) {
      sendError(res, 500, error.message, error);
    }
  },

  async create(req, res) {
    try {
      const department = await departmentService.create(req.body);
      sendResponse(res, 201, 'Department created successfully', department);
    } catch (error) {
      sendError(res, 400, error.message, error);
    }
  },
};
